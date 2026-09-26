/**
 * 配色方案读取（mermaid 主题跟随用，v0.3 吸收自 better-sidebar 管线）。
 *
 * DSH 官方主题把明暗解析到 `prefers-color-scheme` media query（ui-theme
 * 服务持有该 media 并解析 system 模式）；这里直接读同一 media，让 mermaid
 * 图与 DSH 全局明暗一致（不感知主题 id，只关心明暗）。
 */

/** 当前是否深色配色（跟随系统偏好；无 matchMedia 时回退浅色）。 */
export function isDarkScheme(): boolean {
  if (typeof matchMedia === 'undefined') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

/** 订阅配色方案变化；返回注销器。 */
export function subscribeColorScheme(listener: () => void): () => void {
  if (typeof matchMedia === 'undefined') return () => {};
  const media = matchMedia('(prefers-color-scheme: dark)');
  const onChange = (): void => { listener(); };
  media.addEventListener('change', onChange);
  return () => { media.removeEventListener('change', onChange); };
}