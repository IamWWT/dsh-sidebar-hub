/**
 * 分类配置的**共享数据模型**（host 与 client 都 import；纯数据，无框架依赖）。
 *
 * - client：渲染分组（`resolveCatalog`）与设置页编辑；
 * - host：注册 settings 命名空间的默认值（`defaultConfig()` = 组合 base 层）。
 *
 * 放在 `shared/` 的原因：两边必须是同一份默认值，否则「恢复默认」在两端含义
 * 不一致。本文件不得 import 任何 `@deepseek-ai/*` 值（client bundle 的模块表
 * 只有白名单那几个包），也不得 import React/CSS。
 */

/**
 * 本插件在 DSH settings 中的命名空间（host 注册、client 绑定）。
 * v0.1.7：上游 0.2.0-rc.2 起命名空间 = **profile 条目 id**（cordis.patch.yml
 * insert 的 `id: sidebar-hub`），不再是包名（`configForms.get(entryId)` 按
 * entry id 寻址；SettingsForms.describe 以 `entry.options.id` 为 ns）。
 * 设置页卡片 key 用 `SETTINGS_CARD_KEY`（= bundle 包名，官方契约）与之区分。
 */
export const SETTINGS_NAMESPACE = 'sidebar-hub';

/** 设置页卡片 key（官方 `plugins.bundle.config` 槽 keyed by bundle 包名）。 */
export const SETTINGS_CARD_KEY = 'dsh-sidebar-hub';

/** 一个分组。 */
export interface CategoryGroup {
  id: string;
  title: string;
  collapsed?: boolean;
}

/** 一个 kind 的归属规则（设置页可改）。 */
export interface CategoryEntryRule {
  /** 目标分组 id；缺省 = 「其他」兜底组。 */
  groupId?: string;
  /** 覆盖显示名；缺省用注册表给的 title。 */
  label?: string;
  /** 隐藏该条目（分类框架不显示）。 */
  hidden?: boolean;
}

/** 分类配置（全局一份，存 DSH settings 的 `dsh-sidebar-hub` 命名空间）。 */
export interface CategoryConfig {
  groups: CategoryGroup[];
  entries: Record<string, CategoryEntryRule>;
  /** 组内条目顺序（groupId → kind[]）；缺省按发现顺序。 */
  order?: Record<string, string[]>;
  /**
   * 漂移基线（v0.1.4，spec 003）：最后一次被用户确认过的「注册表能力快照」。
   * host 的 base 层恒提供 `{kinds:{}, ack:''}`（= 从未初始化）；client 在
   * settings 上读写，用于 DSH 升级后新增/移除入口的提醒。
   */
  drift?: CategoryDrift;
}

/**
 * 漂移快照里的一个 kind 记录（v0.1.5：只留标题，用于提醒文案；
 * 比对只按 kind 集合，标题变化不重复提醒）。
 */
export interface DriftKindRecord {
  title: string;
}

/** 能力快照：kind → 记录；`ack` 为快照签名（用户「知道了」后写入）。 */
export interface CategoryDrift {
  kinds: Record<string, DriftKindRecord>;
  ack: string;
}

/**
 * 默认分组的 id（用户 2026-09-13 指定：**不可删除**；官方**不可重命名**）。
 * 出厂分组与用户新建分组的区别由此判定。
 * v0.6 清空 hub 自研内容后「工程与任务」组为空，v0.8 起从默认分组移除
 * （默认五组 → 四组：官方/工作台/工具/游戏）。
 */
export const DEFAULT_GROUP_IDS: readonly string[] = ['official', 'workbench', 'browse-tools', 'games'];

/** 不可删除的分组 id（默认四组；「其他」兜底组本就不可删）。 */
export const PROTECTED_GROUP_IDS: ReadonlySet<string> = new Set(DEFAULT_GROUP_IDS);

/** 不可重命名的分组 id（仅官方；其余默认组可改名）。 */
export const RENAME_LOCKED_GROUP_IDS: ReadonlySet<string> = new Set(['official']);

/**
 * 默认分组（顺序即展示顺序）。用户 2026-09-13 指定：
 * 官方第一行、工作台第二行，其余随意；「浏览与工具」v0.8 改名「工具」。
 */
export const DEFAULT_GROUPS: CategoryGroup[] = [
  { id: 'official', title: '官方' },
  { id: 'workbench', title: '工作台' },
  { id: 'browse-tools', title: '工具' },
  { id: 'games', title: '游戏' },
];

/** 分组色调（仅用于界面着色；CSS 用 `[data-tone]` 映射到 --dsw-* token）。 */
export const GROUP_TONES: Readonly<Record<string, string>> = {
  // 相邻分组换色相（蓝 / 绿 / 青 / 红），避免"一片蓝"看不出分区
  official: 'brand',
  workbench: 'success',
  'browse-tools': 'business',
  games: 'error',
  other: 'neutral',
};

/**
 * 一个分组 id 的色调：优先查表，未知分组按 id 稳定散列到调色板
 * （新增分组也有颜色，且不随渲染顺序变化）。
 * @param groupId - 分组 id。
 * @returns 色调名（CSS 侧 `[data-tone=...]`）。
 */
export function toneOf(groupId: string): string {
  const known = GROUP_TONES[groupId];
  if (known !== undefined) return known;
  const palette = ['brand', 'business', 'success', 'warn', 'error'];
  let hash = 0;
  for (let index = 0; index < groupId.length; index += 1) {
    hash = (hash * 31 + groupId.charCodeAt(index)) >>> 0;
  }
  return palette[hash % palette.length] ?? 'neutral';
}

/** 兜底分组 id（未登记 kind 的落点）。 */
export const OTHER_GROUP_ID = 'other';
/** 兜底分组标题。 */
export const OTHER_GROUP_TITLE = '其他';

/**
 * 默认映射表（kind → 分组 id）。
 *
 * - 官方/工作台/小游戏入口归组；自研 `hub-*` 内容类型自 v0.6 起全部移除，
 *   分类框架只做入口编排。
 * - 终端（v0.2）与浏览器（v0.5）自官方内置起交还官方（kind=`terminal`/`browser`，
 *   builtin）并归**官方组**（与官方 Files 同组，恢复默认后保持一致）。
 * - v0.1.5：归组**只**由本表 + 用户编辑决定，不再有「官方自动归组」的推断
 *   （未登记 kind 一律落「其他」）。官方入口（files/terminal/browser…）在此显式列出。
 */
export const DEFAULT_ENTRY_RULES: Record<string, CategoryEntryRule> = {
  // 工作台（daily-workbench 由 personal-workbench 改名，v0.9 跟随其 kind；
  // opscrew-workbench = 应急指挥工作台，用户 2026-09-30 新增，v0.1.6 起归组）
  'daily-workbench': { groupId: 'workbench' },
  'troubleshoot-workbench': { groupId: 'workbench' },
  'trading-workbench': { groupId: 'workbench' },
  'report-studio': { groupId: 'workbench' },
  'opscrew-workbench': { groupId: 'workbench' },
  // 浏览与工具
  'audio-transcriber': { groupId: 'browse-tools' },
  'audio-tts': { groupId: 'browse-tools' },
  // 游戏（小游戏插件）
  minesweeper: { groupId: 'games' },
  sudoku: { groupId: 'games' },
  // 官方（0.1.6 内置终端 / 0.1.6-alpha.2 内置浏览器，与 Files 同组）
  terminal: { groupId: 'official' },
  browser: { groupId: 'official' },
  files: { groupId: 'official' },
  // 不显示：引导页自身与纯资源查看器（框架内部 kind）
  guide: { hidden: true },
  text: { hidden: true },
};

/** 默认配置（新副本，调用方可自由改）。 */
export function defaultConfig(): CategoryConfig {
  return {
    groups: DEFAULT_GROUPS.map(group => ({ ...group })),
    entries: { ...DEFAULT_ENTRY_RULES },
  };
}
