/**
 * Markdown/mermaid fence 检测（吸收自 dsh-better-sidebar，MIT）。
 *
 * md 预览把整个文档经一次 DSH `MarkdownText` 渲染（交叉 fence 语义——
 * 引用式链接/脚注/列表连续性——保持不变），mermaid 惰性 chunk 再把已渲染的
 * `language-mermaid` 代码块换成图。本模块的纯切分器用于检测源里是否含
 * mermaid fence，以决定是否拉取 mermaid chunk（仅在需要时）。
 */

/** 一段被提出的 mermaid 图（info 串已剥离）。 */
export interface MermaidBlock {
  kind: 'mermaid';
  /** fence 之间的原始图源码。 */
  code: string;
}

/** 一段普通 markdown 源（自身可含非 mermaid fence）。 */
export interface MarkdownBlock {
  kind: 'markdown';
  text: string;
}

export type MdBlock = MarkdownBlock | MermaidBlock;

/** CommonMark 开 fence：0-3 空格缩进 + 3+ 反引号或波浪号。 */
export const OPEN_FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/** 闭 fence 行：0-3 空格缩进 + 3+ 反引号/波浪号 + 仅尾随空格。 */
export const CLOSE_FENCE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

/**
 * 从 fence 行尾解析 info 串；非法返回 null。
 * @param rest - fence 运行串之后的整行尾部。
 * @param fence - 匹配到的 fence 运行串。
 */
export function fenceInfo(rest: string, fence: string): string | null {
  const info = rest.trimStart().split(/\s+/)[0] ?? '';
  // CommonMark：反引号 fence 的 info 串不得含反引号——否则不是开 fence。
  if (fence.charAt(0) === '`' && info.includes('`')) return null;
  return info;
}

/** info 串是否指名 mermaid（裸 `mermaid` 或 `mermaid{...}`）。 */
function isMermaidInfo(info: string): boolean {
  const word = info.toLowerCase();
  return word === 'mermaid' || word.startsWith('mermaid{');
}

/**
 * 把 markdown 源切成 md/mermaid 块用于检测：只提出 info 为 mermaid 的 fence，
 * 其余行原样留在 markdown 流里。遵守 CommonMark fence 规则——3+ 反引号或
 * 波浪号的开 fence，闭 fence 须用相同字符且长度不小于开 fence；未闭合的
 * mermaid fence 吞掉文件剩余部分（与 CommonMark 对开放 fence 的恢复一致）。
 * @param text - 完整 markdown 源。
 * @returns md/mermaid 块序列。
 */
export function splitMermaidBlocks(text: string): MdBlock[] {
  if (text === '') return [];
  const lines = text.split('\n');
  const blocks: MdBlock[] = [];
  let markdown: string[] = [];
  let index = 0;
  const flushMarkdown = (): void => {
    if (markdown.length === 0) return;
    blocks.push({ kind: 'markdown', text: markdown.join('\n') });
    markdown = [];
  };
  while (index < lines.length) {
    const line = lines[index] ?? '';
    const fenceMatch = OPEN_FENCE_RE.exec(line);
    if (fenceMatch === null) {
      markdown.push(line);
      index += 1;
      continue;
    }
    const fence = fenceMatch[1]!;
    // 行尾 = 整段匹配前缀（缩进 + fence 运行串）之后的部分。
    const rest = line.slice(fenceMatch.index + fenceMatch[0].length);
    const info = fenceInfo(rest, fence);
    if (info === null || !isMermaidInfo(info)) {
      markdown.push(line);
      index += 1;
      continue;
    }
    flushMarkdown();
    const char = fence.charAt(0);
    const length = fence.length;
    const code: string[] = [];
    index += 1;
    while (index < lines.length) {
      const candidate = lines[index] ?? '';
      const close = CLOSE_FENCE_RE.exec(candidate);
      if (close !== null && close[1]!.charAt(0) === char && close[1]!.length >= length) break;
      code.push(candidate);
      index += 1;
    }
    // 消费闭 fence（或开放 fence 时跑完）。
    index += 1;
    blocks.push({ kind: 'mermaid', code: code.join('\n') });
  }
  flushMarkdown();
  return blocks;
}

/** 源是否含至少一段 mermaid fence（决定是否拉取 mermaid chunk）。 */
export function hasMermaidFence(text: string): boolean {
  return splitMermaidBlocks(text).some((block) => block.kind === 'mermaid');
}