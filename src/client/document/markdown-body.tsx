/**
 * Markdown 渲染器（替换官方 builtin，id=`dsh-sidebar-hub/markdown`）。
 *
 * 通过官方 `documentPreviews` 扩展点注册 `priority:'extension'` 的 md 渲染器：
 * - 含 mermaid fence 的文档 → 惰性加载 `/shub/bundle/mermaid.js`（吸收自
 *   dsh-better-sidebar 的管线：官方 MarkdownText 整体渲染 + 换图 + SVG 消毒）；
 * - 其余 md → 直接官方 `MarkdownText`（与官方体验一致，仅多传 `pathImages`
 *   让 md 内相对路径图片经 /shub/file 显示——官方 body 未传导致本地图不显）。
 *
 * 替换语义（v0.3 决策，spec §0）：走官方预留的渲染器扩展位，不触碰官方
 * 源码 / files 树 / `text` 类型定义；只对 md/markdown 后缀生效。
 */
import {
  useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { MarkdownText, type MarkdownFileMentions, type MarkdownLabels, type MarkdownPathImages } from '@deepseek-ai/dsh-client-ui-primitives';
import { loadChunk } from '../chunk-loader.ts';
import { hasMermaidFence } from '../mermaid-blocks.ts';
import type { MermaidChunkExports } from '../mermaid-contract.ts';
import type { MermaidLabels } from '../mermaid-contract.ts';
import { t } from '../locales.ts';
import './document-body.css';

/** 本渲染器的文档槽 key（与 documentPreviews 注册的 id 一致）。 */
export const HUB_MARKDOWN_BODY_ID = 'dsh-sidebar-hub/markdown';

/** 官方渲染器挂载时给出的 owner props 最小面（避免与官方类型强耦合）。 */
export interface HubMarkdownBodyProps {
  /** 原始文件地址（dsh-resource://file/session/<id>/<path>）。 */
  resourceAddress: string;
  /** 已加载内容：文本累积前缀直到 eof。 */
  content?: { kind: 'text'; text: string; eof: boolean } | { kind: 'bytes'; data: Uint8Array<ArrayBuffer> };
  /** 换行偏好（透传给 MarkdownText 所在的文档工具栏）。 */
  wrap: boolean;
}

/** 从 file 资源地址解析出 { sessionId, path }（对齐官方 hostFileOf）。 */
function hostFileOf(address: string): { sessionId: string; path: string } | null {
  // dsh-resource://file/session/<sessionId>/<path>（path 为工作区相对路径）。
  const match = /^dsh-resource:\/\/file\/session\/([^/]+)\/(.*)$/.exec(address);
  if (match === null) return null;
  const path = decodeURIComponent(match[2] ?? '');
  if (path === '') return null;
  return { sessionId: decodeURIComponent(match[1]!), path };
}

/** 规范化 md 内图片目标：相对路径基于 md 所在目录；绝对工作区路径原样。 */
function resolveMdImageTarget(basePath: string, target: string): string | null {
  if (/^[a-z]+:/i.test(target) || target.startsWith('//')) return null; // 外部协议/URL
  const normalized = target.replaceAll('\\', '/');
  const baseDir = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/')) : '';
  // POSIX 风格路径合并（工作区路径统一 /）。
  const parts = [...(baseDir === '' ? [] : baseDir.split('/')), ...normalized.split('/')];
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') { stack.pop(); continue; }
    stack.push(part);
  }
  if (stack.length === 0) return null;
  return stack.join('/');
}

/** MarkdownText 需要的 labels（代码块复制/脚注 chrome）。 */
function markdownLabels(): MarkdownLabels {
  return {
    code: { copyLabel: t('copyCode'), copiedLabel: t('copiedCode') },
    footnotes: t('footnotes'),
  };
}

/** mermaid chunk 的图 chrome 文案（从本插件 locales 取）。 */
function mermaidLabels(): MermaidLabels {
  return {
    renderFailed: t('mermaidRenderFailed'),
    copy: t('copy'),
    copied: t('copied'),
    copyCode: t('copyCode'),
    copiedCode: t('copiedCode'),
    zoomIn: t('mermaidZoomIn'),
    zoomOut: t('mermaidZoomOut'),
    zoomReset: t('mermaidZoomReset'),
    zoomHint: t('mermaidZoomHint'),
    close: t('close'),
  };
}

/**
 * md 正文：检测 mermaid → 惰性 chunk；否则官方 MarkdownText + pathImages。
 * @param props - 官方 documentpreview 挂载时给的 owner props。
 */
export function HubMarkdownBody(props: HubMarkdownBodyProps): ReactNode {
  const file = useMemo(() => hostFileOf(props.resourceAddress), [props.resourceAddress]);
  const text = props.content?.kind === 'text' ? props.content.text : '';
  const eof = props.content?.kind === 'text' && props.content.eof === true;
  const [mermaid, setMermaid] = useState<MermaidChunkExports | null>(null);
  const [chunkError, setChunkError] = useState<string | null>(null);
  const requestedRef = useRef(false);

  // 惰性加载 mermaid chunk：仅当文档含 mermaid fence 且已完整（eof）时触发。
  const needMermaid = eof && hasMermaidFence(text);
  useEffect(() => {
    if (!needMermaid || requestedRef.current) return;
    requestedRef.current = true;
    let cancelled = false;
    loadChunk('mermaid')
      .then((exports) => {
        if (!cancelled) setMermaid(exports as unknown as MermaidChunkExports);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setChunkError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => { cancelled = true; };
  }, [needMermaid]);

  // md 内本地图片 → /shub/file 可显示 URL（复用现有信任围栏路由）。
  const pathImages = useMemo<MarkdownPathImages | undefined>(() => {
    if (file === null) return undefined;
    const { sessionId, path } = file;
    return {
      resolve: (value: string): string | undefined => {
        const target = resolveMdImageTarget(path, value);
        if (target === null) return undefined;
        const url = new URL('/shub/file', window.location.origin);
        url.searchParams.set('sessionId', sessionId);
        url.searchParams.set('path', target);
        return url.toString();
      },
    };
  }, [file]);

  const labels = useMemo(() => markdownLabels(), []);
  const mermaidCopy = useMemo(() => mermaidLabels(), []);

  if (chunkError !== null) {
    return (
      <div className="hubMarkdownError" data-hub-md-error>
        {t('mermaidLoadFailed')}：{chunkError}
      </div>
    );
  }

  if (needMermaid && mermaid !== null) {
    const MermaidMarkdown = mermaid.MermaidMarkdown;
    return <MermaidMarkdown text={text} labels={mermaidCopy} pathImages={pathImages} />;
  }

  if (needMermaid) {
    // chunk 未就绪：先渲染官方 MarkdownText，就绪后换（避免空白闪烁）。
    return <MarkdownText text={text} streaming={!eof} labels={labels} pathImages={pathImages} />;
  }

  return <MarkdownText text={text} streaming={!eof} labels={labels} pathImages={pathImages} />;
}
