/**
 * settings 命名空间 `sidebar-hub`：分类配置的 schema 与默认值。
 *
 * 设计要点（v0.1.7 起适配上游 0.2.0-rc.2 新契约）：
 * - **命名空间 = profile 条目 id**（`cordis.patch.yml` insert 的 `id: sidebar-hub`），
 *   不再是包名（旧版 `dsh-sidebar-hub` 已随 `settingsScope` 接口一并退役）。
 * - **schema 来自 entry 导出的 `Config`**：上游 `SettingsForms.describe()` 遍历
 *   所有 entry，`ns = entry.options.id`、`schema = entry.fiber.runtime.Config`，
 *   并用 `volatileForm()` 只投影**标了 `.volatile()` 的字段**成表单。因此本文件
 *   导出的 `Config`（z.object）就是命名空间的 schema；设置字段标 volatile，
 *   运行配置字段不标（只进 entry config，不进设置文档）。
 * - **组合 base 层 = schema 默认值**：`groups`/`entries`/`order` 的出厂值就是
 *   插件的默认分类（`z.default()`）；用户改动写进 user 层（profile patch 的
 *   config override）。「恢复默认」= client `scope.unset(field)` 清掉 user 层。
 * - **桶式字段**：`groups`（数组）、`entries`/`order`（字典）各是一个字段。settings
 *   的 `mergeLayers` 对普通对象**深合并**、对数组**整桶替换**（见
 *   `packages/settings/settings/src/index.ts`），所以「改一条映射」与「改整个分组
 *   列表」天然是两种写粒度。
 * - **存储形态 = 字段齐全**：schema 给每个子字段 `.default()`，wire/文档里的
 *   `entries[kind]` 恒为 `{groupId, label, hidden}`（空值用 `''`/`false` 表示未
 *   设置）。client 的内存形态是**稀疏**的（`shared/catalog-config.ts` 的
 *   CategoryConfig），两侧由 `catalog/config-store.ts` 的 normalize 桥接。
 * - 不放任何机密字段（本插件没有 secret），因此不需要 `role('secret')`。
 */
import z from '@deepseek-ai/schemastery';
import {
  DEFAULT_GROUPS, DEFAULT_ENTRY_RULES, SETTINGS_NAMESPACE, SETTINGS_CARD_KEY, type CategoryEntryRule,
} from '../shared/catalog-config.ts';

export { SETTINGS_NAMESPACE, SETTINGS_CARD_KEY };

/** 一个分组（存储形态：字段齐全）。 */
export interface HubSettingsGroup {
  id: string;
  title: string;
  collapsed: boolean;
}

/** 一条 kind 规则（存储形态：字段齐全；`''` / `false` = 未设置）。 */
export interface HubSettingsEntry {
  groupId: string;
  label: string;
  hidden: boolean;
}

/**
 * 漂移基线（存储形态；v0.1.4 能力漂移检测，spec 003 R2）。
 * v0.1.5：每项只留标题（比对只按 kind 集合）。
 */
export interface HubSettingsDrift {
  kinds: Record<string, { title: string }>;
  ack: string;
}

/** entry config 的**运行配置**部分（不进 settings 文档；只被 host 消费）。 */
export type SidebarHubRuntimeConfig = Record<string, unknown>;

/**
 * 出厂分类（= settings 文档的 base / schema 默认值；也是「恢复默认」的回落目标）。
 * 仅用作 `Config` 各设置字段的 `.default()`。
 */
export const HUB_SETTINGS_BASE = {
  groups: DEFAULT_GROUPS.map(group => ({ id: group.id, title: group.title, collapsed: group.collapsed === true })),
  entries: Object.fromEntries(Object.entries(DEFAULT_ENTRY_RULES).map(([kind, rule]) => [kind, {
    groupId: rule.groupId ?? '',
    label: rule.label ?? '',
    hidden: rule.hidden === true,
  }])),
  order: {},
  // 漂移基线空表 = 「从未初始化」；client 首跑时静默写入首份快照（不提醒）。
  drift: { kinds: {}, ack: '' },
} as const;

const groupSchema = z.object({
  id: z.string(),
  title: z.string().default(''),
  collapsed: z.boolean().default(false),
});
const entrySchema = z.object({
  groupId: z.string().default(''),
  label: z.string().default(''),
  hidden: z.boolean().default(false),
});

/**
 * 本 entry 的 Config schema（上游新契约的命名空间 schema 来源）。
 * 运行配置字段不标 volatile（只进 entry config）；设置字段标 `.volatile()`
 * 才会被 `SettingsForms.describe()` 投影成 `sidebar-hub` 文档的表单。
 */
export const Config = z.object({
  // ── 运行配置（host 消费；不进设置文档）────────────
  workspaceFenceEnabled: z.boolean().default(true),
  uploadLimitBytes: z.number().default(10 * 1024 * 1024),
  mediaLimitBytes: z.number().default(10 * 1024 * 1024),
  listLimit: z.number().default(1000),
  readLimit: z.number().default(1024 * 1024),
  // ── 分类配置（volatile → settings 文档字段）────────
  groups: z.array(groupSchema).default(HUB_SETTINGS_BASE.groups as never).volatile(),
  entries: z.dict(entrySchema).default(HUB_SETTINGS_BASE.entries as never).volatile(),
  order: z.dict(z.array(z.string())).default({}).volatile(),
  drift: z.object({
    kinds: z.dict(z.object({ title: z.string().default('') })).default({}),
    ack: z.string().default(''),
  }).default({ kinds: {}, ack: '' }).volatile(),
});

/** 从 entry config 里取运行配置部分（兼容新旧字段名，缺省用默认）。 */
export function resolveRuntimeConfig(raw: unknown): Record<string, unknown> {
  const cfg = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    workspaceFenceEnabled: cfg.workspaceFenceEnabled ?? true,
    uploadLimitBytes: cfg.uploadLimitBytes ?? 10 * 1024 * 1024,
    mediaLimitBytes: cfg.mediaLimitBytes ?? 10 * 1024 * 1024,
    listLimit: cfg.listLimit ?? 1000,
    readLimit: cfg.readLimit ?? 1024 * 1024,
  };
}