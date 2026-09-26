/**
 * 分类框架的解析层：自动发现结果 + 分类配置 → 可渲染的分组视图。
 *
 * 数据模型与默认值在 `src/shared/catalog-config.ts`（host/client 共享同一份，
 * host 用它作 settings 命名空间的组合 base 层）；本文件只做解析：
 * 条目来源是运行时从侧栏 tab 注册表自动发现（entry.ts 读
 * `SidebarRightTabs.guide()`），再用映射表归组；未登记的 kind 落「其他」组。
 */
import {
  OFFICIAL_KINDS, OTHER_GROUP_ID, OTHER_GROUP_TITLE, PROTECTED_GROUP_IDS, RENAME_LOCKED_GROUP_IDS, toneOf,
  type CategoryConfig,
} from '../../shared/catalog-config.ts';

export {
  DEFAULT_GROUPS, DEFAULT_ENTRY_RULES, GROUP_TONES, OFFICIAL_KINDS, OTHER_GROUP_ID, OTHER_GROUP_TITLE,
  PROTECTED_GROUP_IDS, RENAME_LOCKED_GROUP_IDS, defaultConfig, toneOf,
  type CategoryConfig, type CategoryEntryRule, type CategoryGroup,
} from '../../shared/catalog-config.ts';

/** 自动发现到的一个入口（来自注册表 guide 条目）。 */
export interface DiscoveredEntry {
  kind: string;
  title: string;
  description?: string;
}

/** 一个渲染用的条目。 */
export interface CatalogItem {
  kind: string;
  title: string;
  description?: string;
  official: boolean;
}

/** 一个渲染用的分组。 */
export interface CatalogGroup {
  id: string;
  title: string;
  /** 分组色调（CSS `[data-tone]` → `--dsw-*` token；条目继承该色）。 */
  tone: string;
  /** 默认五组：不可删除（UI 隐藏删除钮；store 也拒绝）。 */
  protected: boolean;
  /** 官方分组：不可重命名（UI 隐藏改名钮；store 也拒绝）。 */
  renameLocked: boolean;
  collapsed: boolean;
  items: CatalogItem[];
}

/**
 * 把「自动发现 + 配置」解析成渲染分组列表。
 * 未登记/未知分组的 kind 落「其他」组；`hidden` 的 kind 不出现。
 * @param discovered - 注册表发现的入口（按 guide order 已排序）。
 * @param config - 当前分类配置。
 * @returns 分组列表（含「其他」兜底组，仅有内容时出现）。
 */
export function resolveCatalog(discovered: readonly DiscoveredEntry[], config: CategoryConfig): CatalogGroup[] {
  const groups: CatalogGroup[] = config.groups.map(group => ({
    id: group.id,
    title: group.title,
    tone: toneOf(group.id),
    protected: PROTECTED_GROUP_IDS.has(group.id),
    renameLocked: RENAME_LOCKED_GROUP_IDS.has(group.id),
    collapsed: group.collapsed === true,
    items: [],
  }));
  const byId = new Map(groups.map(group => [group.id, group]));
  const others: CatalogItem[] = [];

  for (const entry of discovered) {
    const rule = config.entries[entry.kind];
    if (rule?.hidden === true) continue;
    const item: CatalogItem = {
      kind: entry.kind,
      title: rule?.label !== undefined && rule.label !== '' ? rule.label : entry.title,
      description: entry.description,
      official: OFFICIAL_KINDS.has(entry.kind),
    };
    const target = rule?.groupId !== undefined ? byId.get(rule.groupId) : undefined;
    if (target !== undefined) target.items.push(item);
    else others.push(item);
  }

  // 组内顺序：配置里的 order 优先，其余按发现顺序。
  for (const group of groups) {
    const wanted = config.order?.[group.id];
    if (wanted === undefined) continue;
    const rank = new Map(wanted.map((kind, index) => [kind, index]));
    group.items.sort((a, b) => (rank.get(a.kind) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.kind) ?? Number.MAX_SAFE_INTEGER));
  }

  if (others.length > 0) {
    groups.push({
      id: OTHER_GROUP_ID,
      title: OTHER_GROUP_TITLE,
      tone: toneOf(OTHER_GROUP_ID),
      protected: true,
      renameLocked: false,
      collapsed: false,
      items: others,
    });
  }
  return groups;
}