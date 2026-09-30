/**
 * 分类框架的解析层：自动发现结果 + 分类配置 → 可渲染的分组视图。
 *
 * 数据模型与默认值在 `src/shared/catalog-config.ts`（host/client 共享同一份，
 * host 用它作 settings 命名空间的组合 base 层）；本文件只做解析：
 * 条目来源是运行时从侧栏 tab 注册表自动发现（entry.ts 读
 * `SidebarRightTabs.guide()`），再用映射表归组；未登记的 kind 落「其他」组。
 */
import {
  OTHER_GROUP_ID, OTHER_GROUP_TITLE, PROTECTED_GROUP_IDS, RENAME_LOCKED_GROUP_IDS, toneOf,
  type CategoryConfig,
} from '../../shared/catalog-config.ts';

export {
  DEFAULT_GROUPS, DEFAULT_ENTRY_RULES, GROUP_TONES, OTHER_GROUP_ID, OTHER_GROUP_TITLE,
  PROTECTED_GROUP_IDS, RENAME_LOCKED_GROUP_IDS, defaultConfig, toneOf,
  type CategoryConfig, type CategoryEntryRule, type CategoryGroup,
} from '../../shared/catalog-config.ts';

/** 自动发现到的一个入口（来自官方 guide 盒子；v0.1.5 起只此一路来源）。 */
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
    };
    // 归属只认**显式规则**（出厂映射 + 用户编辑）；没有规则 → 「其他」。
    // v0.1.5：不再按 `@deepseek-ai/` 前缀猜「官方」并自动归组（那是插件自己的
    // 判断，会凭空改变官方入口的位置；用户 2026-09-30 纠正）。
    const target = rule?.groupId === undefined ? undefined : byId.get(rule.groupId);
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

/** 漂移提醒（v0.1.4 R2）：新增的一条能力（落点分组标题 = 显式规则解析结果）。 */
export interface DriftAddedKind {
  kind: string;
  title: string;
  groupTitle: string;
}

/** 漂移提醒：已移除的一条能力（标题取自漂移基线快照）。 */
export interface DriftRemovedKind {
  kind: string;
  title: string;
}

/** 漂移提醒视图：基线快照与当前注册表快照的差（用户「知道了」后清空）。 */
export interface DriftView {
  added: DriftAddedKind[];
  removed: DriftRemovedKind[];
}

export const EMPTY_DRIFT: DriftView = Object.freeze({ added: [], removed: [] });