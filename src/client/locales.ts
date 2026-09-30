/**
 * client 文案（精简 zh/en 字典）。
 * 语言取 body[data-ds-lang]（DSH 主题根），缺省跟随 navigator.language。
 */
export type LocaleKey =
  | 'terminal.choose' | 'terminal.loading' | 'terminal.empty' | 'terminal.retry'
  | 'copy'
  | 'copied'
  | 'catalog.title'
  | 'catalog.reset'
  | 'catalog.official'
  | 'catalog.empty'
  | 'catalog.hint'
  | 'catalog.addGroup'
  | 'catalog.newGroup'
  | 'catalog.renameGroup'
  | 'catalog.deleteGroup'
  | 'catalog.confirmDelete'
  | 'catalog.memoryBadge'
  | 'catalog.memoryHint'
  | 'catalog.driftNote'
  | 'catalog.driftAck'
  | 'catalog.driftAckHint'
  | 'catalog.driftAdded'
  | 'catalog.driftRemoved'
  | 'catalog.driftNew'
  | 'catalog.driftNewHint'
  | 'settings.title'
  | 'settings.hint'
  | 'settings.groups'
  | 'settings.entries'
  | 'settings.entriesCount'
  | 'settings.colEntry'
  | 'settings.colGroup'
  | 'settings.colLabel'
  | 'settings.colHidden'
  | 'settings.colActions'
  | 'settings.unregistered'
  | 'settings.otherGroup'
  | 'settings.forget'
  | 'settings.forgetShort'
  | 'settings.description'
  | 'settings.collapse'
  | 'settings.expand'
  | 'settings.unregisteredCount'
  | 'settings.hiddenNote'
  | 'settings.renameLockedHint'
  | 'refresh'
  | 'close'
  | 'timeJustNow'
  | 'timeMinutesAgo'
  | 'timeHoursAgo'
  | 'timeYesterday'
  | 'copyCode'
  | 'copiedCode'
  | 'footnotes'
  | 'mermaidRenderFailed'
  | 'mermaidLoadFailed'
  | 'mermaidZoomIn'
  | 'mermaidZoomOut'
  | 'mermaidZoomReset'
  | 'mermaidZoomHint'
  | 'close'
const DICT: Record<'zh' | 'en', Record<LocaleKey, string>> = {
  zh: {
    'terminal.choose': '选择终端类型', 'terminal.loading': '正在查找终端…', 'terminal.empty': '没有发现可用终端', 'terminal.retry': '重试',
    copy: '复制',
    copied: '已复制',
    copyCode: '复制代码',
    copiedCode: '已复制',
    footnotes: '脚注',
    mermaidRenderFailed: 'Mermaid 渲染失败',
    mermaidLoadFailed: 'Mermaid 加载失败',
    mermaidZoomIn: '放大',
    mermaidZoomOut: '缩小',
    mermaidZoomReset: '重置',
    mermaidZoomHint: '滚轮缩放 · 拖拽平移 · Esc 关闭',
    'catalog.title': '分类',
    'catalog.reset': '恢复默认',
    'catalog.official': '官方',
    'catalog.empty': '暂无条目',
    'catalog.hint': '拖拽条目可调整分组与顺序',
    'catalog.addGroup': '新分组',
    'catalog.newGroup': '新分组',
    'catalog.renameGroup': '重命名分组',
    'catalog.deleteGroup': '删除分组',
    'catalog.confirmDelete': '删除分组「{name}」？组内条目会移到「其他」。',
    'catalog.memoryBadge': '未持久化',
    'catalog.memoryHint': 'settings 服务不可用：分类改动只在本次会话生效（刷新后恢复出厂分类）。',
    'catalog.driftNote': '检测到 {n} 项能力变化（DSH 升级/插件增减）：',
    'catalog.driftAck': '知道了',
    'catalog.driftAckHint': '确认并隐藏提醒（以当前能力为新基线）',
    'catalog.driftAdded': '新增',
    'catalog.driftRemoved': '移除',
    'catalog.driftNew': '新',
    'catalog.driftNewHint': 'DSH 升级后新发现的能力；「知道了」后标记消失',
    'settings.title': '右侧栏分类',
    'settings.hint': '右侧栏起始页按这里的分类展示插件入口。两处都能改：分类页拖拽条目调整分组与顺序，这里用表单精确维护（改归属 / 显示名 / 隐藏 / 新建分组）。隐藏的条目不会出现在分类页。',
    'settings.groups': '分组',
    'settings.entries': '条目映射',
    'settings.entriesCount': '共 {n} 条',
    'settings.colEntry': '入口',
    'settings.colGroup': '所属分组',
    'settings.colLabel': '显示名',
    'settings.colHidden': '隐藏',
    'settings.colActions': '操作',
    'settings.unregistered': '未登记',
    'settings.otherGroup': '其他',
    'settings.forget': '移除该 kind 的分类规则（条目落回「其他」）',
    'settings.forgetShort': '移除规则',
    'settings.description': '右侧栏起始页按这里的分类展示插件入口（分类页可拖拽，这里可精确维护）。',
    'settings.collapse': '收起',
    'settings.expand': '展开',
    'settings.unregisteredCount': '{n} 条未登记',
    'settings.hiddenNote': '已隐藏 {n} 条（分类页不显示）',
    'settings.renameLockedHint': '官方分组不可重命名',
    refresh: '刷新',
    close: '关闭',
    timeJustNow: '刚刚',
    timeMinutesAgo: '{n} 分钟前',
    timeHoursAgo: '{n} 小时前',
    timeYesterday: '昨天',
  },
  en: {
    'terminal.choose': 'Choose terminal shell', 'terminal.loading': 'Discovering shells…', 'terminal.empty': 'No shells available', 'terminal.retry': 'Retry',
    copy: 'Copy',
    copied: 'Copied',
    copyCode: 'Copy code',
    copiedCode: 'Copied',
    footnotes: 'Footnotes',
    mermaidRenderFailed: 'Mermaid render failed',
    mermaidLoadFailed: 'Mermaid chunk failed to load',
    mermaidZoomIn: 'Zoom in',
    mermaidZoomOut: 'Zoom out',
    mermaidZoomReset: 'Reset',
    mermaidZoomHint: 'Scroll to zoom · drag to pan · Esc to close',
    'catalog.title': 'Categories',
    'catalog.reset': 'Restore defaults',
    'catalog.official': 'Built-in',
    'catalog.empty': 'No entries',
    'catalog.hint': 'Drag entries to change group or order',
    'catalog.addGroup': 'New group',
    'catalog.newGroup': 'New group',
    'catalog.renameGroup': 'Rename group',
    'catalog.deleteGroup': 'Delete group',
    'catalog.confirmDelete': 'Delete group "{name}"? Its entries move to "Other".',
    'catalog.memoryBadge': 'Not saved',
    'catalog.memoryHint': 'The settings service is unavailable: category edits last only for this session.',
    'catalog.driftNote': '{n} capability change(s) detected (DSH upgrade / plugin add-remove):',
    'catalog.driftAck': 'Got it',
    'catalog.driftAckHint': 'Acknowledge and dismiss (current capabilities become the new baseline)',
    'catalog.driftAdded': 'Added',
    'catalog.driftRemoved': 'Removed',
    'catalog.driftNew': 'NEW',
    'catalog.driftNewHint': 'Newly discovered after a DSH upgrade; the badge clears after you acknowledge',
    'settings.title': 'Right-sidebar categories',
    'settings.hint': 'The right sidebar start page lists plugin entries by these categories. Edit them in either place: drag entries on the categories page, or use the form here for exact control (group / label / hide / new group). Hidden entries stay off the categories page.',
    'settings.groups': 'Groups',
    'settings.entries': 'Entry mapping',
    'settings.entriesCount': '{n} entries',
    'settings.colEntry': 'Entry',
    'settings.colGroup': 'Group',
    'settings.colLabel': 'Label',
    'settings.colHidden': 'Hidden',
    'settings.colActions': 'Actions',
    'settings.unregistered': 'Unregistered',
    'settings.otherGroup': 'Other',
    'settings.forget': 'Remove this kind\u2019s category rule (the entry falls back to "Other")',
    'settings.forgetShort': 'Remove rule',
    'settings.description': 'The right sidebar start page groups plugin entries by these categories (drag on the page, or edit exactly here).',
    'settings.collapse': 'Collapse',
    'settings.expand': 'Expand',
    'settings.unregisteredCount': '{n} unregistered',
    'settings.hiddenNote': '{n} hidden (kept off the categories page)',
    'settings.renameLockedHint': 'The built-in group cannot be renamed',
    refresh: 'Refresh',
    close: 'Close',
    timeJustNow: 'just now',
    timeMinutesAgo: '{n} min ago',
    timeHoursAgo: '{n} h ago',
    timeYesterday: 'yesterday',
  },
};

/** 框架 locale 服务报来的当前语言（entry.ts 注入；权威来源，优先于 DOM 推断）。 */
let activeLocale: string | undefined;

/**
 * 由 entry.ts 注入 DSH locale 服务的当前语言。
 *
 * 为什么必须走服务：框架的语言同步写的是 **`document.documentElement.lang`**
 * （`ui-theme`/`locale` 的 `syncDocumentLanguage`），并不会写 `body[data-ds-lang]`。
 * 早期版本读 `body.dataset.dsLang` → 永远 undefined → 回落到 `navigator.language`
 * → 界面是中文、侧栏分类却是英文（真实反馈）。
 * @param locale - locale id（`zh` / `en` / …），undefined 表示未知。
 */
export function setActiveLocale(locale: string | undefined): void {
  activeLocale = locale;
}

/** 当前语言：服务 → `documentElement.lang` → `body[data-ds-lang]` → navigator。 */
function currentLang(): 'zh' | 'en' {
  const candidates = [
    activeLocale,
    typeof document === 'undefined' ? undefined : document.documentElement?.lang,
    typeof document === 'undefined' ? undefined : document.body?.dataset?.dsLang,
    typeof navigator === 'undefined' ? undefined : navigator.language,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate !== '') {
      return candidate.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    }
  }
  return 'en';
}

/** 当前语言（供快照签名使用：语言变了要触发重渲染）。 */
export function currentLocaleId(): 'zh' | 'en' {
  return currentLang();
}

/** 文案键（subagent-jobs 等以 CopyKey 引用）。 */
export type CopyKey = LocaleKey;

/** 取当前语言文案；`{name}` 占位符按 params 插值。 */
export function t(key: LocaleKey, params?: Record<string, string | number>): string {
  let text = DICT[currentLang()][key];
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** 相对时间（吸收源 relativeTime 语义；ISO 字符串 → 简述）。 */
export function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return t('timeJustNow');
  if (seconds < 3600) return t('timeMinutesAgo', { n: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('timeHoursAgo', { n: Math.floor(seconds / 3600) });
  if (seconds < 172800) return t('timeYesterday');
  const date = new Date(then);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}