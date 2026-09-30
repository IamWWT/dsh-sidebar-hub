/**
 * dsh-sidebar-hub — Client 入口（接线层，无业务逻辑）。
 *
 * 打包契约：本文件编译为 CJS 后由 build.mjs 统一包一层
 * `window.__ModuleLoader__.load({id, factory})`（classic `<script>`，externals 经
 * factory 的 `require` 解析）；这里只做模块导出与注册，**不再自调
 * `__ModuleLoader__.load`**。
 *
 * 接线（spec 002「右侧栏分类框架」+ spec 003「升级漂移同步」）：
 * ③ 分类框架 → `ctx.slots.inject('sidebar.right.tab.guide', …)`，chain 槽
 *      `select` 恒接管：打开右侧栏看到的起始页就是分组化的入口清单；
 *   ④ 自动发现（v0.1.4 R1）：读 `ctx.sidebarRightTabs.entries()` 全量在效定义
 *      ∪ `guide()` 引导条目（旧宿主无 `entries` 时退回 guide-only），按 kind 去重
 *      ——上游新引入、即使没有引导条目的能力类型也会出现在分类里；
 *   ⑤ 漂移检测（v0.1.4 R2）：能力快照存 settings 的 `drift` 桶；DSH 升级后
 *      新增/移除的入口在分类页顶部提醒，用户「知道了」确认新基线；
 *   ⑥ 自动归组（v0.1.4 R3）：未登记归属的官方（`@deepseek-ai/*` 实现）kind
 *      自动落「官方」组，第三方落「其他」；用户显式规则始终优先；
 *   ⑦ 分类配置：绑定 settings 命名空间 `dsh-sidebar-hub`（host 注册、base =
 *      出厂分类），读写统一走 `catalog/config-store.ts`；服务不可用时退回内存态
 *      并在分类页标出「未持久化」；
 *   ⑧ 设置页卡片：`plugins.bundle.config`（key = 包名 dsh-sidebar-hub，官方
 *      0.1.6-alpha.2 起替代旧 `settings.plugin.item`）——表单式维护映射，
 *      与分类页共用同一份配置；
 *   ⑩ 文档渲染器扩展（仅 md/mermaid；Office 自 v0.7 起交还官方内置）。
 *
 * 官方 Files / 官方终端 / 官方浏览器：只转发 `openTab('files')` / `openTab('terminal')` /
 * `openTab('browser')`，不注册同名类型、不认领其资源（红线；终端 v0.2、浏览器 v0.5 交还官方内置能力）。
 * hub 自研内容类型（tasks/subagent/git/changes）自 v0.6 起全部移除——分类框架只做入口编排。
 */
import * as React from 'react';
import { CatalogFramework, type CatalogProps } from './catalog/CatalogFramework.tsx';
import { createCatalogConfigStore, hasDriftBaseline, type SettingsScopeLike } from './catalog/config-store.ts';
import {
  EMPTY_DRIFT, OTHER_GROUP_TITLE, PROTECTED_GROUP_IDS, RENAME_LOCKED_GROUP_IDS, resolveCatalog,
  type CatalogGroup, type DiscoveredEntry, type DriftView,
} from './catalog/mapping.ts';
import { currentLocaleId, setActiveLocale } from './locales.ts';
import { SettingsCard, type SettingsCardProps, type SettingsGroupOption, type SettingsRow } from './settings/SettingsCard.tsx';
import { SETTINGS_NAMESPACE, SETTINGS_CARD_KEY, type CategoryConfig } from '../shared/catalog-config.ts';
import { setChunkModuleSystem } from './chunk-loader.ts';
import { HUB_MARKDOWN_BODY_ID, HubMarkdownBody, type HubMarkdownBodyProps } from './document/markdown-body.tsx';
import './hub-font.css';
import type { TerminalChoices } from './catalog/TerminalLauncher.tsx';

/** 插件名（DSH 客户端插件标识，与包名一致）。 */
export const name = 'sidebar-hub';

/** 依赖的客户端服务：插槽系统、侧栏 tab 注册表、侧栏导航面。 */
export const inject = ['slots', 'sidebarRightTabs', 'sidebarRight', 'webTerminals'];

/** 稳定引用：chain 的 `select` 必须纯函数，返回共享常量以免每次读取换身份。 */
const GUIDE_MATCH = Object.freeze({});

/** 客户端根上下文的最小面（只声明本文件用到的成员）。 */
interface ClientCtx {
  effect(callback: () => void | (() => void)): () => void;
  /** 可选依赖：按服务名回调（服务缺失时不调用，插件照常工作）。 */
  inject(names: string[], callback: (raw: unknown) => void): (() => void) | void;
  slots: {
    inject(key: string, callback: () => void | (() => void)): () => void;
    register(spec: Record<string, unknown>, component: unknown): () => void;
  };
  sidebarRightTabs: {
    register(definition: Record<string, unknown>): () => void;
    /** 全量在效 tab 定义（v0.1.4 R1；旧宿主无此方法，discover 退回 guide-only）。 */
    entries?(): readonly { id: string; kind: string; title: (address: string) => string }[];
    guide(): readonly { kind: string; title: () => string; description?: () => string }[];
    subscribe?(listener: () => void): () => void;
  };
  sidebarRight: {
    openTab(kind: string): void;
    openTabIn(sessionId: string, kind: string, options?: { params: { shellPath: string } }): void;
  };
  webTerminals: {
    launchShells(sessionId: string, signal: AbortSignal): Promise<TerminalChoices>;
    selectShell(path: string): void;
  };
  /** 可选依赖：DSH locale 服务（提供当前语言与变更订阅）。 */
  locale?: {
    getSnapshot(): { active: string };
    subscribe(listener: () => void): () => void;
  };
}

/** 一个可订阅快照源（喂 UI 的 hooks 格）。 */
interface SnapshotSource<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

/**
 * 读一次注册表（v0.1.5 起）：**只读 `guide()`**——即官方「起始页能力入口」的
 * 唯一公开来源（每个 tab 类型用 `guide[]` 声明自己是否在引导页给出入口盒子：
 * title/description/order）。**有什么就放什么**，不做任何推断式增补。
 *
 * 为什么不读 `entries()`（v0.1.4 的错误做法，v0.1.5 修正）：`entries()` 是
 * **标签类型注册表**（VS Code editor-resolver 语义：谁认识哪种 address、谁渲染），
 * 里面既有用户可见入口，也有纯资源查看器/内部类型（plan、changes-review、
 * subagentchat、text…）。把它们当入口灌进分类页 = 凭空多出官方起始页根本没有的
 * 条目（用户 2026-09-30 纠正）。能力是否出现在侧栏，由官方是否启用该插件决定
 * （例如浏览器：上游 web profile 默认禁用 `ui-sidebar-browser` → 没有 guide 盒子
 * → 分类页就不该有它；重新启用走 profile 补丁，而不是靠插件自己找出来）。
 * @param registry - `ctx.sidebarRightTabs`（只用 guide 面）。
 * @returns 引导条目列表（title/description 原样透传，异常时退回 kind）。
 */
function readRegistry(registry: {
  guide(): readonly { kind: string; title: () => string; description?: () => string }[];
}): readonly DiscoveredEntry[] {
  let boxes: readonly { kind: string; title: () => string; description?: () => string }[] = [];
  try {
    boxes = registry.guide();
  } catch (error) {
    console.warn('[sidebar-hub] 读取引导条目失败：', error);
    return [];
  }

  const byKind = new Map<string, DiscoveredEntry>();
  for (const box of boxes) {
    if (byKind.has(box.kind)) continue;
    let title = '';
    try {
      title = box.title();
    } catch {
      title = box.kind;
    }
    let description: string | undefined;
    try {
      description = box.description?.();
    } catch {
      description = undefined;
    }
    byKind.set(box.kind, { kind: box.kind, title, ...(description === undefined ? {} : { description }) });
  }
  return [...byKind.values()];
}

/**
 * 构造带「变更才换身份」语义的快照源：React 的 useSyncExternalStore 靠引用
 * 变化判断重渲染，因此内容没变时必须返回同一个引用。
 * @param compute - 计算当前值的纯函数。
 * @returns 快照源与一个 `sync()`（重算并在变化时通知订阅者）。
 */
function createSource<T>(compute: () => T): { source: SnapshotSource<T>; sync: () => void } {
  let value: T = compute();
  // 签名带上当前语言：locale 变了必须换快照身份，订阅者才会重渲染
  // （组件里的 t() 是模块级函数，重渲染时才重新取值）。
  let signature = `${currentLocaleId()}\u0000${JSON.stringify(value)}`;
  const listeners = new Set<() => void>();
  return {
    source: {
      getSnapshot: () => value,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
    },
    sync: () => {
      const next = compute();
      const nextSignature = `${currentLocaleId()}\u0000${JSON.stringify(next)}`;
      if (nextSignature === signature) return;
      signature = nextSignature;
      value = next;
      for (const listener of listeners) listener();
    },
  };
}

/**
 * 客户端插件主体：注册分类起始页、设置页卡片、md 文档渲染器。
 * @param ctx - 客户端根上下文（slots / sidebarRightTabs / sidebarRight）。
 */
export function apply(ctx: ClientCtx): void {
  const { slots, sidebarRightTabs: registry, sidebarRight } = ctx;

  /** 打开一个 kind 的内容；未注册的 kind、侧栏未挂载时给出诊断而不是静默。 */
  const openTab = (kind: string): void => {
    try {
      sidebarRight.openTab(kind);
    } catch (error) {
      console.warn(`[sidebar-hub] openTab("${kind}") 失败：`, error);
    }
  };

  // ── 分类配置 store（settings 持久化 + 全部写操作）──────────────────────
  const configStore = createCatalogConfigStore(() => { refreshCatalog(); });

  // ── 自动发现 ──────────────────────────────────────────────────────────
  /** 注册表发现到的入口（apply 后由 refreshCatalog 填充）。 */
  let discovered: readonly DiscoveredEntry[] = [];

  /** 读一次注册表（v0.1.5：只读 guide()，见 readRegistry）。 */
  const discover = (): readonly DiscoveredEntry[] => readRegistry(registry);

  // 三个 UI 数据源：分类页分组、设置卡片行、设置卡片分组选项。
  const catalog = createSource<readonly CatalogGroup[]>(() => resolveCatalog(discovered, configStore.getConfig()));
  const rows = createSource<readonly SettingsRow[]>(() => {
    const config = configStore.getConfig();
    const seen = new Set<string>();
    const list: SettingsRow[] = [];
    for (const entry of discovered) {
      const rule = config.entries[entry.kind];
      list.push({
        kind: entry.kind,
        title: rule?.label !== undefined && rule.label !== '' ? rule.label : entry.title,
        groupId: rule?.groupId,
        hidden: rule?.hidden === true,
        registered: true,
        ...(entry.description === undefined ? {} : { description: entry.description }),
      });
      seen.add(entry.kind);
    }
    // 配置里存在、注册表当前没有的 kind（插件卸载/改名遗留）→ 标「未登记」。
    for (const [kind, rule] of Object.entries(config.entries)) {
      if (seen.has(kind)) continue;
      list.push({
        kind,
        title: rule.label !== undefined && rule.label !== '' ? rule.label : kind,
        groupId: rule.groupId,
        hidden: rule.hidden === true,
        registered: false,
      });
    }
    return list.sort((left, right) =>
      (left.groupId ?? '~').localeCompare(right.groupId ?? '~') || left.title.localeCompare(right.title));
  });
  const groupOptions = createSource<readonly SettingsGroupOption[]>(() =>
    configStore.getConfig().groups.map(group => ({
      id: group.id,
      title: group.title,
      protected: PROTECTED_GROUP_IDS.has(group.id),
      renameLocked: RENAME_LOCKED_GROUP_IDS.has(group.id),
    })));

  // ── 漂移检测（v0.1.4 R2，v0.1.5 改为基于 guide 入口集）：能力快照 vs 已确认基线 ──
  /** 快照签名：只取 kind 集合（标题变化不重复提醒）。 */
  const driftSignature = (kinds: Record<string, unknown>): string => Object.keys(kinds).sort().join('\u0000');

  /** 当前提醒视图（引用稳定；变化才换引用并通知 hooks 订阅者）。 */
  let driftView: DriftView = { added: [], removed: [] };
  const driftListeners = new Set<() => void>();
  const driftSource: SnapshotSource<DriftView> = {
    getSnapshot: () => driftView,
    subscribe: (listener) => {
      driftListeners.add(listener);
      return () => { driftListeners.delete(listener); };
    },
  };
  const publishDrift = (next: DriftView): void => {
    if (next === driftView) return;
    driftView = next;
    for (const listener of driftListeners) listener();
  };

  /**
   * 漂移对账（R2）：当前能力快照 vs 已确认基线。
   * - 基线未初始化（首跑 / 内存态）→ 静默写入首份快照，不提醒；
   * - 能力新增/移除 → 出提醒，等用户「知道了」（ackDrift）确认新基线，
   *   确认后提醒消失且跨会话不复发（基线已写 settings）。
   * 内存态（settings 不可用）下基线只活在本进程：重启后重新静默初始化，
   * 与「未持久化」降级语义一致。
   */
  const syncDrift = (): void => {
    const snapshot: Record<string, { title: string }> = {};
    for (const entry of discovered) snapshot[entry.kind] = { title: entry.title };
    const stored = configStore.getConfig().drift;
    const baseline = stored !== undefined && hasDriftBaseline(stored) ? stored : null;
    if (baseline === null) {
      if (Object.keys(snapshot).length > 0) configStore.noteDrift(snapshot, driftSignature(snapshot));
      publishDrift(EMPTY_DRIFT);
      return;
    }
    const added = discovered.filter(entry => baseline.kinds[entry.kind] === undefined);
    const removed = Object.keys(baseline.kinds).filter(kind => discovered.every(entry => entry.kind !== kind));
    if (added.length === 0 && removed.length === 0) {
      publishDrift(EMPTY_DRIFT);
      return;
    }
    const resolved = resolveCatalog(discovered, configStore.getConfig());
    const groupTitleOf = (kind: string): string => {
      for (const group of resolved) if (group.items.some(item => item.kind === kind)) return group.title;
      return OTHER_GROUP_TITLE;
    };
    publishDrift({
      added: added.map(entry => ({ kind: entry.kind, title: entry.title, groupTitle: groupTitleOf(entry.kind) })),
      removed: removed.map(kind => ({ kind, title: baseline.kinds[kind].title })),
    });
  };

  /** 用户「知道了」：以当前能力快照为新基线（noteDrift → onChange → 提醒清空）。 */
  const ackDrift = (): void => {
    const snapshot: Record<string, { title: string }> = {};
    for (const entry of discovered) snapshot[entry.kind] = { title: entry.title };
    configStore.noteDrift(snapshot, driftSignature(snapshot));
  };

  /** 重算全部 UI 数据源（配置或注册表变化后调用）。 */
  function refreshCatalog(): void {
    discovered = discover();
    syncDrift();
    catalog.sync();
    rows.sync();
    groupOptions.sync();
  }

  // ── ③ 分类框架接管起始页（chain 槽，select 恒接管）────────────────────
  slots.inject('sidebar.right.tab.guide', () =>
    slots.register(
      {
        name: 'sidebar.right.tab.guide',
        select: () => GUIDE_MATCH,
        inject: (sessionId: string): Omit<CatalogProps, 'useCatalog' | 'useDrift'> & {
          hooks: { catalog: SnapshotSource<readonly CatalogGroup[]>; drift: SnapshotSource<DriftView> };
        } => ({
          terminal: {
            load: signal => ctx.webTerminals.launchShells(sessionId, signal),
            launch: path => {
              if (path !== undefined) ctx.webTerminals.selectShell(path);
              ctx.sidebarRight.openTabIn(sessionId, 'terminal', path === undefined ? undefined : { params: { shellPath: path } });
            },
          },
          openTab,
          toggleGroup: (groupId: string) => { configStore.toggleGroup(groupId); },
          addGroup: (title: string) => configStore.addGroup(title),
          renameGroup: (groupId: string, title: string) => { configStore.renameGroup(groupId, title); },
          deleteGroup: (groupId: string) => { configStore.deleteGroup(groupId); },
          moveEntry: (kind: string, toGroupId: string | null, order?: Record<string, string[]>) => {
            configStore.moveEntry(order === undefined ? { kind, toGroupId } : { kind, toGroupId, order });
          },
          resetCatalog: () => { configStore.reset(); },
          refreshCatalog,
          ackDrift,
          persistence: () => configStore.persistence(),
          hooks: { catalog: catalog.source, drift: driftSource },
        }),
      },
      (props: CatalogProps) => React.createElement(CatalogFramework, props),
    ));

  // ── ④ 设置页卡片（官方 0.1.6-alpha.2 起挂 `plugins.bundle.config`，key=包名；
  //      与分类页同源配置）───────────────────────────────────────────────
  slots.inject('plugins.bundle.config', () =>
    slots.register(
      {
        name: 'plugins.bundle.config',
        key: SETTINGS_CARD_KEY,
        inject: (): Omit<SettingsCardProps, 'useRows' | 'useGroups'> & {
          hooks: { rows: SnapshotSource<readonly SettingsRow[]>; groups: SnapshotSource<readonly SettingsGroupOption[]> };
        } => ({
          assign: (kind: string, groupId: string | null) => { configStore.moveEntry({ kind, toGroupId: groupId }); },
          setLabel: (kind: string, label: string) => { configStore.setEntryLabel(kind, label); },
          setHidden: (kind: string, hidden: boolean) => { configStore.setEntryHidden(kind, hidden); },
          forget: (kind: string) => { configStore.forgetEntry(kind); },
          addGroup: (title: string) => configStore.addGroup(title),
          renameGroup: (groupId: string, title: string) => { configStore.renameGroup(groupId, title); },
          deleteGroup: (groupId: string) => { configStore.deleteGroup(groupId); },
          resetCatalog: () => { configStore.reset(); },
          persistence: () => configStore.persistence(),
          hooks: { rows: rows.source, groups: groupOptions.source },
        }),
      },
      (props: SettingsCardProps) => React.createElement(SettingsCard, props),
    ));

  // ── ⑤ 语言跟随 DSH（中英文与全局一致）────────────────────────────────
  // 框架把当前语言写在 documentElement.lang 并通过 locale 服务暴露；这里读服务
  // （权威）并在切换时重算快照，让分类页/设置卡片的文案跟着切。
  ctx.inject(['locale'], (raw) => {
    const locale = (raw as { locale: NonNullable<ClientCtx['locale']> }).locale;
    const adopt = (): void => { setActiveLocale(locale.getSnapshot().active); };
    adopt();
    const unsubscribe = locale.subscribe(() => { adopt(); refreshCatalog(); });
    ctx.effect(() => () => { unsubscribe(); });
    console.log(`[sidebar-hub] 语言跟随 DSH：${locale.getSnapshot().active}`);
  });

  // ── ⑥ 分类配置绑定 settings（可选依赖：缺失则内存态）────────────────────
  // v0.1.7：上游 0.2.0-rc.2 起客户端 settings 接口为 `configForms`（`settingsScope`
  // 已移除）。`configForms.get(entryId)` 返回的 ConfigForm 与 SettingsScopeLike
  // 同构（getSnapshot/subscribe/mutate/unset；snapshot 多出 base/user/revision）。
  // 命名空间 = profile 条目 id（`sidebar-hub`）；decode 不再需要（normalizeConfig
  // 已在 store 内做形状把关）。
  ctx.inject(['configForms'], (raw) => {
    try {
      const configForms = (raw as {
        configForms: { get<T>(entryId: string): SettingsScopeLike<T> };
      }).configForms;
      configStore.attach(configForms.get<CategoryConfig>(SETTINGS_NAMESPACE));
      ctx.effect(() => () => { configStore.detach(); });
      console.log(`[sidebar-hub] 分类配置已绑定 settings 命名空间：${SETTINGS_NAMESPACE}`);
    } catch (error) {
      console.warn('[sidebar-hub] 绑定 settings 命名空间失败，分类改动仅在本次会话生效：', error);
    }
  });

  // ── ⑧ 文档渲染器扩展（v0.3 引入；Office 自 v0.7 起交还官方内置）───────
  // 通过官方 documentpreview 的公开扩展点注册 priority:'extension' 的
  // md 渲染器（官方 builtin 无 mermaid）；惰性 chunk 经 /shub/bundle 伺服。
  ctx.inject(['documentPreviews', 'modules'], (raw) => {
    const face = raw as {
      documentPreviews?: {
        register(def: {
          id: string; extensions: readonly string[]; binaryExtensions?: readonly string[];
          priority: 'builtin' | 'extension'; title: () => string;
          loading: 'text-pages' | 'bytes-complete'; wrap?: boolean;
        }): () => void;
      };
      modules?: { import(specifier: string): Promise<unknown> };
    };
    // chunk-loader 需要模块系统解析 chunk 的 externals（react 等种子词）。
    if (face.modules !== undefined) {
      setChunkModuleSystem(face.modules);
      ctx.effect(() => () => { setChunkModuleSystem(undefined); });
    }
    if (face.documentPreviews === undefined) return;
    // md 渲染器：接管官方 builtin（v0.3 决策，见 spec §0）。
    face.documentPreviews.register({
      id: HUB_MARKDOWN_BODY_ID,
      extensions: ['md', 'markdown'],
      priority: 'extension',
      title: () => 'Markdown',
      loading: 'text-pages',
      wrap: false,
    });
    slots.inject('sidebar.right.tab.document', () =>
      slots.register(
        { name: 'sidebar.right.tab.document', key: HUB_MARKDOWN_BODY_ID },
        (props: unknown) => React.createElement(HubMarkdownBody, props as HubMarkdownBodyProps),
      ));
    console.log('[sidebar-hub] 文档渲染器已注册：markdown(mermaid)');
  });

  // ── ⑦ 发现：先算一次，随后跟随注册表变更（其它插件注册完即入分类）──────
  refreshCatalog();
  if (typeof registry.subscribe === 'function') {
    const unsubscribe = registry.subscribe(refreshCatalog);
    ctx.effect(() => () => { unsubscribe(); });
  }
}

export {};
