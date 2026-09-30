/**
 * settings 命名空间 `dsh-sidebar-hub`：分类配置的 schema 与默认值。
 *
 * 设计要点：
 * - **组合 base 层 = 出厂分类**（`HUB_SETTINGS_BASE`）：`groups`/`entries` 的
 *   出厂值就是插件的默认分类；用户改动写进 user 层。「恢复默认」= 清掉 user 层的
 *   桶（client `scope.unset(field)`），而不是把一份拷贝写回去。
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
  DEFAULT_GROUPS, DEFAULT_ENTRY_RULES, SETTINGS_NAMESPACE, type CategoryEntryRule,
} from '../shared/catalog-config.ts';

export { SETTINGS_NAMESPACE };

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

/** 漂移基线（存储形态；v0.1.4 能力漂移检测，spec 003 R2）。 */
export interface HubSettingsDrift {
  kinds: Record<string, { title: string; official: boolean }>;
  ack: string;
}

/** settings 文档中的一节。 */
export interface HubSettings {
  groups: HubSettingsGroup[];
  entries: Record<string, HubSettingsEntry>;
  order: Record<string, string[]>;
  drift: HubSettingsDrift;
}

/**
 * 出厂分类规则 → 存储形态。
 * @param rule - 共享模型里的稀疏规则。
 * @returns 字段齐全的存储规则。
 */
function toStoredEntry(rule: CategoryEntryRule): HubSettingsEntry {
  return {
    groupId: rule.groupId ?? '',
    label: rule.label ?? '',
    hidden: rule.hidden === true,
  };
}

/** 出厂分类（组合 base 层；也是「恢复默认」的回落目标）。 */
export const HUB_SETTINGS_BASE: HubSettings = {
  groups: DEFAULT_GROUPS.map(group => ({ id: group.id, title: group.title, collapsed: group.collapsed === true })),
  entries: Object.fromEntries(Object.entries(DEFAULT_ENTRY_RULES).map(([kind, rule]) => [kind, toStoredEntry(rule)])),
  order: {},
  // 漂移基线空表 = 「从未初始化」；client 首跑时静默写入首份快照（不提醒）。
  drift: { kinds: {}, ack: '' },
};

/** wire schema：允许的字段与类型；缺省即出厂分类。 */
export const HubSettingsSchema = z.object({
  groups: z.array(z.object({
    id: z.string(),
    title: z.string().default(''),
    collapsed: z.boolean().default(false),
  })).default(HUB_SETTINGS_BASE.groups),
  entries: z.dict(z.object({
    groupId: z.string().default(''),
    label: z.string().default(''),
    hidden: z.boolean().default(false),
  })).default(HUB_SETTINGS_BASE.entries),
  order: z.dict(z.array(z.string())).default({}),
  // 漂移基线（v0.1.4）：kinds 为 last-acknowledged 的能力快照，ack 是其签名。
  drift: z.object({
    kinds: z.dict(z.object({
      title: z.string().default(''),
      official: z.boolean().default(false),
    })).default({}),
    ack: z.string().default(''),
  }).default({ kinds: {}, ack: '' }),
});
