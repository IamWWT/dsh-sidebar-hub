/**
 * 分类配置 store：**唯一的配置写入口**（T5/T4/T6 共用）。
 *
 * 数据流（spec 002 §2.5）：
 *   DSH settings 命名空间 `dsh-sidebar-hub`（host 注册，base = 出厂分类）
 *     → client `settingsScope.bind()` 读快照（getSnapshot/subscribe）
 *     → 本 store 作为「当前配置」的唯一来源
 *     → 任何用户改动（拖拽/重命名/隐藏/恢复默认）经本 store 写回：
 *         · settings 可写 → `mutate()` 整桶替换（原子、带 revision 栅栏）
 *         · 不可用/只读 → 退回内存态（`persistence() === 'memory'`，设置卡片提示）
 *
 * 写桶而非写叶子：`groups` / `entries` / `order` 各是一个字段，改一条映射就是
 * 整字段替换。好处是心智简单、无多写竞态；代价是每次改动写一份完整桶（这个
 * 体量下可忽略）。
 */
import {
  OTHER_GROUP_ID, PROTECTED_GROUP_IDS, RENAME_LOCKED_GROUP_IDS, defaultConfig,
  type CategoryConfig, type CategoryEntryRule, type CategoryGroup,
} from '../../shared/catalog-config.ts';

/** settings 写操作（与 `SettingsPathOpView` 同形）。 */
export type SettingsOp =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] };

/** settings 命名空间绑定的最小面（ui-settings 的 SettingsScope）。 */
export interface SettingsScopeLike<T> {
  getSnapshot(): {
    status: 'loading' | 'ready' | 'unavailable';
    value: T | undefined;
    writable: boolean;
    mode: 'host' | 'memory';
  };
  subscribe(listener: () => void): () => void;
  mutate(ops: readonly SettingsOp[], expectedRevision?: number): Promise<void>;
  unset(field: string): Promise<void>;
}

/** 配置持久化状态（供设置卡片显示）。 */
export type PersistenceState = 'pending' | 'host' | 'memory';

/** 一次移动：改归属、改顺序，或两者同时（单次原子写）。 */
export interface MoveSpec {
  /** 要改归属的 kind；给 `null` 分组 id 表示移入「其他」。 */
  kind?: string;
  /** 目标分组 id；`null` = 「其他」（即清除 kind 的 groupId 规则）。 */
  toGroupId?: string | null;
  /** 整桶替换这些分组的组内顺序（groupId → kind[]）。 */
  order?: Record<string, string[]>;
}

/** 分类配置 store。 */
export interface CatalogConfigStore {
  /** 当前生效配置（settings 已就绪时是 settings 值，否则出厂默认）。 */
  getConfig(): CategoryConfig;
  /** 持久化状态。 */
  persistence(): PersistenceState;
  /** 绑定 settings 作用域（未绑定时一切改动只在内存）。 */
  attach(scope: SettingsScopeLike<CategoryConfig> | null): void;
  /** 解绑并订阅清理。 */
  detach(): void;
  /** 折叠/展开一个分组。 */
  toggleGroup(groupId: string): void;
  /** 新建分组，返回新分组 id。 */
  addGroup(title: string): string;
  /** 重命名分组。 */
  renameGroup(groupId: string, title: string): void;
  /** 删除分组：组内条目落回「其他」（不清除条目的显示名/隐藏标记）。 */
  deleteGroup(groupId: string): void;
  /** 移动/排序条目（见 {@link MoveSpec}）。 */
  moveEntry(spec: MoveSpec): void;
  /** 隐藏/显示一个条目。 */
  setEntryHidden(kind: string, hidden: boolean): void;
  /** 覆盖条目显示名（空串 = 恢复注册表标题）。 */
  setEntryLabel(kind: string, label: string): void;
  /** 从配置里移除一个 kind 的规则（回到「未登记」状态，落「其他」组）。 */
  forgetEntry(kind: string): void;
  /** 恢复出厂分类（清空 settings 的 user 层，回落到组合 base）。 */
  reset(): void;
}

/** 是否自有属性（不用 Object.hasOwn 以兼容旧运行时）。 */
function next_hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

/** 深拷贝一份配置（写入前必须与快照脱钩）。 */
function cloneConfig(source: CategoryConfig): CategoryConfig {
  return {
    groups: source.groups.map(group => ({ ...group })),
    entries: Object.fromEntries(Object.entries(source.entries).map(([kind, rule]) => [kind, { ...rule }])),
    ...(source.order === undefined
      ? {}
      : { order: Object.fromEntries(Object.entries(source.order).map(([id, kinds]) => [id, [...kinds]])) }),
  };
}

/** 归一化 settings 快照值（容忍缺字段/坏形状，绝不把 undefined 传下去）。 */
function normalizeConfig(value: CategoryConfig | undefined): CategoryConfig | undefined {
  if (value === undefined || value === null || typeof value !== 'object') return undefined;
  const groups = Array.isArray(value.groups) ? value.groups.filter(group =>
    typeof group === 'object' && group !== null && typeof group.id === 'string' && group.id !== '') : [];
  if (groups.length === 0) return undefined;
  const entries: Record<string, CategoryEntryRule> = {};
  if (typeof value.entries === 'object' && value.entries !== null) {
    for (const [kind, rule] of Object.entries(value.entries)) {
      if (typeof rule !== 'object' || rule === null) continue;
      entries[kind] = {
        ...(typeof rule.groupId === 'string' && rule.groupId !== '' ? { groupId: rule.groupId } : {}),
        ...(typeof rule.label === 'string' && rule.label !== '' ? { label: rule.label } : {}),
        ...(rule.hidden === true ? { hidden: true } : {}),
      };
    }
  }
  const order: Record<string, string[]> = {};
  if (typeof value.order === 'object' && value.order !== null) {
    for (const [groupId, kinds] of Object.entries(value.order)) {
      if (Array.isArray(kinds)) order[groupId] = kinds.filter((kind): kind is string => typeof kind === 'string');
    }
  }
  return {
    groups: groups.map(group => ({
      id: group.id,
      title: typeof group.title === 'string' && group.title !== '' ? group.title : group.id,
      ...(group.collapsed === true ? { collapsed: true } : {}),
    })),
    entries,
    order,
  };
}

/**
 * 创建分类配置 store。
 * @param onChange - 配置变更后的回调（entry.ts 用来重算快照并通知渲染）。
 * @returns store 实例；未 {@link CatalogConfigStore.attach} 时改动只落在内存。
 */
export function createCatalogConfigStore(onChange: () => void): CatalogConfigStore {
  let config: CategoryConfig = defaultConfig();
  let scope: SettingsScopeLike<CategoryConfig> | null = null;
  let unsubscribe: (() => void) | null = null;

  /** 采纳 settings 快照；非 ready 状态保持当前值。 */
  const adopt = (): void => {
    if (scope === null) return;
    const snapshot = scope.getSnapshot();
    if (snapshot.status !== 'ready') return;
    const next = normalizeConfig(snapshot.value);
    if (next === undefined) return;
    config = next;
    onChange();
  };

  /**
   * 稀疏规则 → 存储形态（字段齐全，空值用 `''`/`false`）。
   *
   * 必须显式写空值：settings 的 `mergeLayers` 对字典**深合并**，若某键整条缺席，
   * base（出厂分类）里的同名规则会"复活"——例如把条目移到「其他」只是删掉
   * `groupId`，写出去就会又落回出厂分组。写 `groupId: ''` 才能盖住 base。
   * @param entries - 稀疏规则表。
   * @returns 字段齐全的存储表。
   */
  const toStoredEntries = (entries: Record<string, CategoryEntryRule>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(entries).map(([kind, rule]) => [kind, {
      groupId: rule.groupId ?? '',
      label: rule.label ?? '',
      hidden: rule.hidden === true,
    }]));

  /**
   * 提交一份新配置：就地生效 + 尽力持久化。
   * @param next - 新配置（已与当前配置脱钩）。
   * @param fields - 需要写回的桶名（`groups` / `entries` / `order`）。
   */
  const commit = (next: CategoryConfig, fields: readonly string[]): void => {
    config = next;
    onChange();
    const target = scope;
    if (target === null || !target.getSnapshot().writable) return;
    const ops: SettingsOp[] = fields.map(field => ({
      op: 'set',
      path: [field],
      value: field === 'groups'
        ? next.groups
        : field === 'entries' ? toStoredEntries(next.entries) : (next.order ?? {}),
    }));
    void target.mutate(ops).catch((error: unknown) => {
      console.warn('[sidebar-hub] 保存分类配置失败（改动已在本次会话生效）：', error);
    });
  };

  return {
    getConfig: () => config,
    persistence: () => (scope === null
      ? 'memory'
      : scope.getSnapshot().writable ? 'host' : 'memory'),

    attach: (next) => {
      unsubscribe?.();
      unsubscribe = null;
      scope = next;
      if (next !== null) {
        unsubscribe = next.subscribe(adopt);
        adopt();
      }
    },

    detach: () => {
      unsubscribe?.();
      unsubscribe = null;
      scope = null;
    },

    toggleGroup: (groupId) => {
      const next = cloneConfig(config);
      next.groups = next.groups.map(group =>
        (group.id === groupId ? { ...group, collapsed: !(group.collapsed === true) } : group));
      commit(next, ['groups']);
    },

    addGroup: (title) => {
      const next = cloneConfig(config);
      const id = `g${Date.now().toString(36)}${Math.floor(Math.random() * 1e3).toString(36)}`;
      const label = title.trim() === '' ? '新分组' : title.trim();
      next.groups = [...next.groups, { id, title: label }];
      commit(next, ['groups']);
      return id;
    },

    renameGroup: (groupId, title) => {
      // 官方分组不可重命名（UI 不显示改名钮；这里兜住一切写入路径）。
      if (RENAME_LOCKED_GROUP_IDS.has(groupId)) return;
      const label = title.trim();
      if (label === '') return;
      const next = cloneConfig(config);
      next.groups = next.groups.map(group => (group.id === groupId ? { ...group, title: label } : group));
      commit(next, ['groups']);
    },

    deleteGroup: (groupId) => {
      // 默认五组不可删除（UI 不显示删除钮；这里兜住一切写入路径，包括被调手改）。
      if (groupId === OTHER_GROUP_ID || PROTECTED_GROUP_IDS.has(groupId)) return;
      const next = cloneConfig(config);
      next.groups = next.groups.filter(group => group.id !== groupId);
      // 组内条目回落到「其他」：清除其 groupId，保留 label/hidden。
      next.entries = Object.fromEntries(Object.entries(next.entries).map(([kind, rule]) => {
        if (rule.groupId !== groupId) return [kind, rule];
        const { groupId: _dropped, ...rest } = rule;
        return [kind, rest as CategoryEntryRule];
      }));
      if (next.order !== undefined) {
        const { [groupId]: _removed, ...restOrder } = next.order;
        next.order = restOrder;
      }
      commit(next, ['groups', 'entries', 'order']);
    },

    moveEntry: (spec) => {
      const next = cloneConfig(config);
      const fields: string[] = [];
      if (spec.kind !== undefined) {
        const rule: CategoryEntryRule = { ...(next.entries[spec.kind] ?? {}) };
        if (spec.toGroupId === undefined || spec.toGroupId === null) delete rule.groupId;
        else rule.groupId = spec.toGroupId;
        next.entries = { ...next.entries, [spec.kind]: rule };
        fields.push('entries');
      }
      if (spec.order !== undefined) {
        const order = { ...(next.order ?? {}) };
        for (const [groupId, kinds] of Object.entries(spec.order)) {
          if (kinds.length === 0) delete order[groupId];
          else order[groupId] = [...kinds];
        }
        next.order = order;
        fields.push('order');
      }
      if (fields.length === 0) return;
      commit(next, fields);
    },

    setEntryHidden: (kind, hidden) => {
      const next = cloneConfig(config);
      const rule: CategoryEntryRule = { ...(next.entries[kind] ?? {}) };
      if (hidden) rule.hidden = true;
      else delete rule.hidden;
      next.entries = { ...next.entries, [kind]: rule };
      commit(next, ['entries']);
    },

    setEntryLabel: (kind, label) => {
      const next = cloneConfig(config);
      const rule: CategoryEntryRule = { ...(next.entries[kind] ?? {}) };
      const trimmed = label.trim();
      if (trimmed === '') delete rule.label;
      else rule.label = trimmed;
      next.entries = { ...next.entries, [kind]: rule };
      commit(next, ['entries']);
    },

    forgetEntry: (kind) => {
      if (next_hasOwn(config.entries, kind) === false) return;
      const next = cloneConfig(config);
      const { [kind]: _dropped, ...rest } = next.entries;
      next.entries = rest;
      if (next.order !== undefined) {
        next.order = Object.fromEntries(Object.entries(next.order)
          .map(([groupId, kinds]) => [groupId, kinds.filter(existing => existing !== kind)]));
      }
      commit(next, ['entries', 'order']);
    },

    reset: () => {
      const target = scope;
      // 出厂分类就是 settings 的组合 base：清掉 user 层字段即回落（不需要写一份拷贝）。
      if (target !== null && target.getSnapshot().writable) {
        void Promise.all(['groups', 'entries', 'order'].map(field => target.unset(field)))
          .then(() => { adopt(); })
          .catch((error: unknown) => {
            console.warn('[sidebar-hub] 恢复默认失败：', error);
          });
        return;
      }
      config = defaultConfig();
      onChange();
    },
  };
}

/** 供 UI 使用的分组类型别名（组件只依赖这些类型）。 */
export type { CategoryConfig, CategoryGroup, CategoryEntryRule };
