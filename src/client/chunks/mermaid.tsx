/**
 * Mermaid markdown 渲染器（惰性 chunk 主体：dist/chunk-mermaid.js）。
 *
 * 吸收自 dsh-better-sidebar（MIT）：整个文档经官方 `MarkdownText` 渲染
 * （交叉 fence 语义保留），再以 layout effect 把每个 `language-mermaid`
 * 代码块换成图（看图为主，源码备查），mermaid 库与 d3/dagre/cytoscape
 * 只在此 chunk 内打包，首次遇到 mermaid fence 才经 /shub/bundle/mermaid.js
 * 注入执行。
 *
 * 安全：mermaid.render 输出经 sanitizeSvg 消毒后才 innerHTML；不应用
 * bindFunctions（静态图）、securityLevel='strict'、htmlLabels=false；
 * 点击图打开缩放/平移浮层（克隆图无事件面，浮层不增加攻击面）。
 *
 * 本 chunk 的 externals（react / MarkdownText / clipboard / icon）由
 * chunk-loader 用 DSH 模块系统种子词解析；mermaid 库内联打包。
 */
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type MouseEvent as ReactMouseEvent, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import mermaid from 'mermaid';
// 同 SettingsCard：上游把尺寸从名字挪进 size 属性（Artwork 默认 size=16），
// 旧名 IconCopyOutline16 已不存在，取值会是 undefined → React #130。
import { IconCopyOutlineRegular, MarkdownText, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives';
import { isDarkScheme, subscribeColorScheme } from '../theme.ts';
import { sanitizeSvg } from '../svg-sanitize.ts';
import type { MermaidChunkExports, MermaidChunkProps } from '../mermaid-contract.ts';
import '../mermaid.css';

/** 单调 id 种子：每次渲染唯一。 */
let mermaidSeq = 0;

/** 按当前配色配置 mermaid（幂等）。 */
function configureMermaid(): void {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    // 标签为纯 SVG <text>：mermaid 默认 htmlLabels 把节点文本放进
    // <foreignObject>，会被消毒器整体剥离——强制纯 SVG 文本让标签可见，
    // 同时关闭 HTML 标签通道（strict 已转义标签内容）。
    htmlLabels: false,
    // Mermaid 11 在拒绝非法图前会向 document.body 渲染一个大错误 SVG；
    // 组件自带错误回退，抑制该全局副作用保持 DSH 壳完整。
    suppressErrorRendering: true,
    theme: isDarkScheme() ? 'dark' : 'default',
  });
}

/** mermaid 错误首几行（其 dump 很大，头部已够解释）。 */
function summarizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n').slice(0, 6).join('\n');
}

/** 一张已渲染图：头部 chrome + 图（或错误 + 源码）。 */
function MermaidDiagram({ code, labels, copyLabel, copiedLabel }: {
  code: string;
  labels: MermaidChunkProps['labels'];
  copyLabel: string;
  copiedLabel: string;
}): ReactNode {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** 配色翻转时用匹配主题重渲染。 */
  const [dark, setDark] = useState(() => isDarkScheme());
  /** 缩放浮层中展示的 svg 克隆（null = 关闭）。 */
  const [zoomSvg, setZoomSvg] = useState<SVGSVGElement | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => subscribeColorScheme(() => { setDark(isDarkScheme()); }), []);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    if (code.trim() === '') return () => { cancelled = true; };
    configureMermaid();
    const id = `dsh-md-mermaid-${mermaidSeq += 1}`;
    mermaid.render(id, code)
      .then(({ svg: rendered }) => {
        if (cancelled) return;
        const clean = sanitizeSvg(rendered);
        if (clean === '') {
          // 解析/消毒拒绝：绝不把原始串透传。
          setError(labels.renderFailed);
          return;
        }
        setSvg(clean);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(summarizeError(reason) === '' ? labels.renderFailed : summarizeError(reason));
      });
    return () => { cancelled = true; };
  }, [code, dark, labels.renderFailed]);

  const onCopy = useCallback(() => {
    if (copied) return;
    writeClipboard(code).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => { setCopied(false); }, 1000);
    });
  }, [code, copied]);

  /** 点图打开缩放浮层（消毒过的克隆）。 */
  const onBodyClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const svgEl = (event.target as Element).closest('svg');
    if (svgEl === null) return;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    // 浮层自管尺寸/变换；剥掉预览里的内联几何。
    clone.removeAttribute('style');
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    setZoomSvg(clone);
  };

  return (
    <div className="hubMermaidWrap" data-mermaid-diagram>
      <div className="hubMermaidHeader">
        <span className="hubMermaidInfo">mermaid</span>
        <button
          type="button"
          className="hubMermaidCopy"
          onClick={onCopy}
          aria-label={copyLabel}
          title={copyLabel}
        >
          <IconCopyOutlineRegular />
          <span>{copied ? copiedLabel : copyLabel}</span>
        </button>
      </div>
      {error !== null && (
        <div className="hubMermaidError" data-mermaid-error title={error}>{labels.renderFailed}</div>
      )}
      {svg !== null && (
        <div
          className="hubMermaidBody"
          onClick={onBodyClick}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      {error !== null && <pre className="hubMermaidCode"><code>{code}</code></pre>}
      {zoomSvg !== null && (
        <MermaidZoomModal
          svg={zoomSvg}
          labels={labels}
          onClose={() => { setZoomSvg(null); }}
        />
      )}
    </div>
  );
}

/** 一次被替换的挂载：图根 + 它顶掉的 CodeBlock children。 */
interface MermaidMount {
  root: Root;
  source: string;
  removed: ChildNode[];
}

/**
 * 渲染出的 CodeBlock 是否为 mermaid fence。DSH CodeBlock 有两个体：shiki
 * 路径在生成的 <code> 上带 `language-*` 类，纯文本路径（mermaid 通常走
 * 这条——无 shiki grammar）只在横幅 info 串里显示语言（CSS-module 类已
 * hash，故该匹配是结构化的）。
 */
function isMermaidBlock(block: HTMLElement): boolean {
  const code = block.querySelector('code');
  if (code !== null && [...code.classList].some(c => c.startsWith('language-mermaid'))) return true;
  const infostring = block.firstElementChild?.firstElementChild?.firstElementChild;
  return infostring !== null
    && infostring !== undefined
    && (infostring.textContent ?? '').trim() === 'mermaid';
}

/**
 * markdown 预览渲染器：一次 `MarkdownText` 渲染全源，然后把每个渲染出的
 * `language-mermaid` 代码块换成 `MermaidDiagram`。`.md-code-block` 宿主
 * 留在 React 树里——只替换其 children——回收时不会丢宿主；块不再是
 * mermaid fence 时恢复原 children。仅当源含至少一段 mermaid fence 时挂载
 * （见 markdown body 的检测）。
 */
export function MermaidMarkdown({ text, labels, pathImages, fileMentions }: MermaidChunkProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountsRef = useRef(new Map<HTMLElement, MermaidMount>());
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  const codeLabels = useMemo(() => ({
    code: {
      copyLabel: labels.copyCode ?? labels.copy,
      copiedLabel: labels.copiedCode ?? labels.copied,
    },
    footnotes: '',
  }), [labels]);

  const markdownProps = useMemo(() => ({
    text,
    labels: codeLabels,
    ...(pathImages === undefined ? {} : { pathImages }),
    ...(fileMentions === undefined ? {} : { fileMentions }),
  }), [text, codeLabels, pathImages, fileMentions]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const mounts = mountsRef.current;
    const seen = new Set<HTMLElement>();

    for (const block of container.querySelectorAll<HTMLElement>('.md-code-block')) {
      const mount = mounts.get(block);
      const isMermaid = isMermaidBlock(block);
      if (!isMermaid) {
        // 之前被替换、现在不再是 mermaid fence 的块：恢复 React 仍在管的
        // CodeBlock children，普通 fence 恢复正常渲染。
        if (mount !== undefined) {
          mount.root.unmount();
          block.replaceChildren(...mount.removed);
          block.removeAttribute('data-mermaid-processed');
          mounts.delete(block);
        }
        continue;
      }
      seen.add(block);
      // 纯文本体总在 <code> 里带 fence 源码。
      const source = block.querySelector('code')?.textContent ?? '';
      if (mount !== undefined && mount.source === source) continue;
      if (mount === undefined) {
        const host = document.createElement('div');
        const removed = [...block.childNodes];
        block.replaceChildren(host);
        block.setAttribute('data-mermaid-processed', 'true');
        const root = createRoot(host);
        mounts.set(block, { root, source, removed });
        root.render(<MermaidDiagram
          code={source}
          labels={labelsRef.current}
          copyLabel={labelsRef.current.copy}
          copiedLabel={labelsRef.current.copied}
        />);
      } else {
        mount.source = source;
        mount.root.render(<MermaidDiagram
          code={source}
          labels={labelsRef.current}
          copyLabel={labelsRef.current.copy}
          copiedLabel={labelsRef.current.copied}
        />);
      }
    }

    // 丢弃代码块已离开树的挂载（fence 被删/文档重构）。
    for (const [block, mount] of mounts) {
      if (seen.has(block)) continue;
      mount.root.unmount();
      mounts.delete(block);
    }
  }, [text]);

  useEffect(() => () => {
    for (const { root } of mountsRef.current.values()) root.unmount();
    mountsRef.current.clear();
  }, []);

  return (
    <div className="hubMermaidMarkdown" ref={containerRef} data-hub-mermaid-markdown>
      <MarkdownText {...markdownProps} />
    </div>
  );
}

/** 缩放/平移浮层（点击放大；克隆图无事件面）。 */
export function MermaidZoomModal({ svg, labels, onClose }: {
  svg: SVGSVGElement;
  labels: MermaidChunkProps['labels'];
  onClose: () => void;
}): ReactNode {
  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0 });
  const zoomRef = useRef({ scale: 1, tx: 0, ty: 0 });

  const applyTransform = (): void => {
    const node = svgRef.current;
    if (node === null) return;
    const { scale, tx, ty } = zoomRef.current;
    node.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };

  /** 滚轮缩放保持舞台点（centerX/centerY）不动。 */
  const zoom = useCallback((delta: number, centerX?: number, centerY?: number): void => {
    const stage = stageRef.current;
    if (stage === null) return;
    const rect = stage.getBoundingClientRect();
    const cx = centerX ?? rect.width / 2;
    const cy = centerY ?? rect.height / 2;
    const current = zoomRef.current;
    const newScale = Math.min(8, Math.max(0.2, current.scale * delta));
    const sx = rect.width / 2;
    const sy = rect.height / 2;
    const ratio = newScale / current.scale;
    current.tx = cx - sx - (cx - sx - current.tx) * ratio;
    current.ty = cy - sy - (cy - sy - current.ty) * ratio;
    current.scale = newScale;
    applyTransform();
  }, []);

  const reset = useCallback((): void => {
    zoomRef.current = { scale: 1, tx: 0, ty: 0 };
    applyTransform();
  }, []);

  const close = useCallback((): void => { onClose(); }, [onClose]);

  // 挂到浮层（调用方提供的消毒 svg 克隆，命令式：React 类型不接受原始
  // DOM 节点作 child，且浮层拥有节点生命周期）。
  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;
    svgRef.current = svg;
    stage.appendChild(svg);
    return () => {
      svg.remove();
      svgRef.current = null;
    };
  }, [svg]);

  useEffect(() => {
    const stage = stageRef.current;
    const node = svgRef.current;
    const overlay = overlayRef.current;
    if (stage === null || node === null || overlay === null) return;

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - rect.left, event.clientY - rect.top);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { close(); return; }
      if (event.key === '+' || event.key === '=') zoom(1.2);
      else if (event.key === '-') zoom(1 / 1.2);
      else if (event.key === '0') reset();
    };
    const onMouseDown = (event: MouseEvent): void => {
      event.preventDefault();
      dragRef.current = {
        active: true,
        startX: event.clientX - zoomRef.current.tx,
        startY: event.clientY - zoomRef.current.ty,
      };
    };
    const onMouseMove = (event: MouseEvent): void => {
      if (!dragRef.current.active) return;
      zoomRef.current.tx = event.clientX - dragRef.current.startX;
      zoomRef.current.ty = event.clientY - dragRef.current.startY;
      applyTransform();
    };
    const onMouseUp = (): void => { dragRef.current.active = false; };
    const onOverlayClick = (event: MouseEvent): void => {
      if (event.target === overlay) close();
    };

    // React 合成 wheel 是被动的；需要原生监听器做 preventDefault。
    stage.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKey);
    overlay.addEventListener('click', onOverlayClick);
    return () => {
      stage.removeEventListener('wheel', onWheel);
      node.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKey);
      overlay.removeEventListener('click', onOverlayClick);
    };
  }, [zoom, reset, close]);

  return createPortal(
    <div className="hubMermaidModal" data-mermaid-modal ref={overlayRef}>
      <div className="hubMermaidModalToolbar">
        <button type="button" className="hubMermaidModalButton" title={labels.zoomOut} onClick={() => zoom(1 / 1.2)}>−</button>
        <button type="button" className="hubMermaidModalButton" title={labels.zoomIn} onClick={() => zoom(1.2)}>+</button>
        <button type="button" className="hubMermaidModalButton" title={labels.zoomReset} onClick={reset}>⟳</button>
        <button type="button" className="hubMermaidModalButton" title={labels.close} onClick={close}>✕</button>
      </div>
      <div className="hubMermaidModalStage" ref={stageRef} />
      <div className="hubMermaidModalHint">{labels.zoomHint}</div>
    </div>,
    document.body,
  );
}

/** chunk 导出面（chunk-loader 物化后按名取）。 */
export const chunkExports: MermaidChunkExports = { MermaidMarkdown };