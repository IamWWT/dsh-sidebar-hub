/**
 * Mermaid 惰性 chunk 与主 bundle 的共享契约（纯类型 + 文案结构）。
 * 主 bundle 只 import type（不携带 mermaid 库）；chunk 实现组件。
 */
import type { ReactNode } from 'react';

/** mermaid 图所需的本地化文案（主 bundle 从 locales 取，透传给 chunk）。 */
export interface MermaidLabels {
  /** 渲染失败文案。 */
  renderFailed: string;
  /** 复制按钮标题/文案。 */
  copy: string;
  /** 已复制文案。 */
  copied: string;
  /** 代码块复制按钮标签（MarkdownText labels.code.copyLabel）。 */
  copyCode: string;
  /** 代码块已复制标签（MarkdownText labels.code.copiedLabel）。 */
  copiedCode: string;
  /** 缩放浮层按钮/提示文案。 */
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
  zoomHint: string;
  close: string;
}

/** 官方 MarkdownText 的 pathImages 解析器面（复用其类型避免依赖官方包）。 */
export interface MermaidPathImages {
  /** 把 md 内的图片目标（相对/绝对路径）解析成可显示的 URL。 */
  resolve(value: string): string | undefined;
}

/** 官方 MarkdownText 的 fileMentions 解析器面（复用其类型）。 */
export interface MermaidFileMentions {
  resolve(value: string): { open: () => void; label: string; title: string } | undefined;
}

/** MermaidMarkdown 的 props（主 bundle 组装后传给 chunk 组件）。 */
export interface MermaidChunkProps {
  /** 完整 markdown 源（单次 MarkdownText 渲染）。 */
  text: string;
  /** 图 chrome 文案。 */
  labels: MermaidLabels;
  /** md 内本地图片解析（相对路径 → /shub/file URL）。 */
  pathImages?: MermaidPathImages;
  /** md 内内联代码的文件提及解析（可选）。 */
  fileMentions?: MermaidFileMentions;
}

/** chunk 导出面：chunk-loader 物化后按名取。 */
export interface MermaidChunkExports {
  MermaidMarkdown: (props: MermaidChunkProps) => ReactNode;
}
