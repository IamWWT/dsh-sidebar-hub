/**
 * SVG 消毒（mermaid 渲染结果；吸收自 dsh-better-sidebar，MIT）。
 *
 * 图来源于不可信 markdown 源，SVG 在进入 dangerouslySetInnerHTML 前必须
 * 重新消毒——在 mermaid 自身 `securityLevel: 'strict'`（标签转义、点击指令
 * 惰性）与 `htmlLabels: false`（标签为纯 SVG <text>）之上做纵深防御。
 *
 * 移除内容与原因：
 * - `foreignObject`：能携带原始 HTML 的唯一通道；移除后敌意标签无法经 XML
 *   解析走私 <img onerror> / <iframe>；
 * - `script` 与外来 HTML 元素（img/iframe/object/embed/video/audio/input/
 *   button/form/link/meta/base）：元素名大小写不敏感匹配；输出重新经 HTML
 *   解析（其解析器会归一化标签大小写，故混合大小写拼写同样被捕获）；
 * - `@*` / `on*` 属性：事件通道（大小写不敏感）；
 * - 全部 `href` / `xlink:href`：图为静态（无 bindFunctions、无点击导航），
 *   链接无价值，且攻击者控制的 URL 可能把整个 GUI 导航离开侧栏。
 *
 * 解析用 `image/svg+xml`：畸形 SVG 解析失败即返回 ''（调用方走错误回退），
 * 绝不把原始字符串透传；只接受根节点为 <svg> 的文档。
 */

/** 需剥离的元素本地名（一律小写匹配）。 */
const STRIP_ELEMENTS = new Set([
  'foreignobject',
  'script',
  'img',
  'iframe',
  'object',
  'embed',
  'video',
  'audio',
  'input',
  'button',
  'form',
  'link',
  'meta',
  'base',
]);

/**
 * 消毒一段 mermaid 渲染出的 SVG 字符串。
 * @param svg - mermaid.generate 的输出。
 * @returns 可安全 innerHTML 的 SVG 字符串；解析失败返回空串。
 */
export function sanitizeSvg(svg: string): string {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return '';
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  } catch {
    return '';
  }
  if (doc.querySelector('parsererror') !== null) return '';
  if (doc.documentElement === null || doc.documentElement.localName !== 'svg') return '';
  doc.querySelectorAll('*').forEach((node) => {
    // XML 元素名保留大小写；字符串随后重新经 HTML 解析（解析器归一化标签
    // 大小写）——所以混合大小写拼写（<sCrIpT>/<foreignobject>）也必须与
    // 规范形式同样捕获。
    if (STRIP_ELEMENTS.has(node.localName.toLowerCase())) {
      node.remove();
      return;
    }
    for (const attribute of [...node.attributes]) {
      const normalized = attribute.name.toLowerCase();
      if (normalized.startsWith('@') || normalized.startsWith('on')) {
        node.removeAttribute(attribute.name);
        continue;
      }
      if (normalized === 'href' || normalized === 'xlink:href') {
        node.removeAttribute(attribute.name);
      }
    }
  });
  return new XMLSerializer().serializeToString(doc.documentElement);
}