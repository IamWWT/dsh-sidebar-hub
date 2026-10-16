# Plan 002 右侧栏分类框架 — 技术设计

## 当前状态

- 文档性质：规格（技术设计：架构 / 合约 / 数据模型 / 风险）
- 对应版本：v0.1.3
- 状态：有效
- 维护者：AI + 用户

- 状态：**已实现并冒烟验证**（真实实例 UI 验收待 T7）/ 日期 2026-09-13
- 前置：[BRD-002-right-sidebar-categories.md](../需求/BRD-002-right-sidebar-categories.md)（需求已冻结）

> 注（2026-10-13）：本文件是 **v0.1.3 时点的设计快照**，此后已发生的变化（不改原文）：
> 自研 `hub-*` 内容类型与六功能正文全部移除（v0.6，仅保留 md(mermaid) 渲染器）、终端与浏览器交还官方
> （v0.2/v0.5）、Office 渲染器交还官方（v0.7）、settings 命名空间改为 `sidebar-hub` 且
> `ctx.settings.register` / `ctx.settingsScope` 均被上游移除（v0.1.7，改 `configForms.get(entryId)`）。
> 当前态见插件 [README.md](../../README.md) 与 [BRD-业务需求说明书.md](../需求/BRD-业务需求说明书.md)。

## 1. 架构

```
client（浏览器）                                     host（Node）
┌──────────────────────────────────────┐        ┌────────────────────────────────┐
│ entry.ts（唯一接线点）                 │        │ settings.ts                    │
│  ├ 6 个 hub-* tab 类型注册（静态定义）  │        │  └ 分类配置 schema + 默认值      │
│  │   + 正文 keyed slot               │        │     （DSH settings 持久化，       │
│  ├ 分类框架 → 替换 guide 正文          │        │      全局一份）                  │
│  │   （sidebar.right.tab.guide 链）   │        │                                │
│  └ 设置卡片 → settings.plugin.item     │        │ 现有 /shub 能力（全部复用）：     │
│                                       │        │  api/routes/pty/git/jobs/       │
│ catalog/                              │        │  subagent/browser/fs/            │
│  ├ CatalogFramework.tsx  起始页分类框架 │        │  terminal-ws/agent-opens        │
│  ├ mapping.ts   默认映射 + 自动发现      │        │  settings.ts                    │
│  ├ config-store.ts  配置写入唯一入口     │        │   └ 命名空间 dsh-sidebar-hub     │
│  └ catalog.css                         │        │      schema + base=出厂分类      │
│ settings/SettingsCard.tsx + .css       │        │                                │
│ tabs/HubTabBodies.tsx  六个正文适配     │        └────────────────────────────────┘
│ hub-store.ts  偏好 + 终端生命周期策略    │
│ views/（复用已实现的六功能视图）        │
│  TerminalView / BrowserView /         │
│  GitLens / ChangesTab / DiffPane /    │
│  SubagentView + 辅助                  │
└──────────────────────────────────────┘
```

## 2. 关键合约（已逐项查证）

| # | 合约 | 事实来源（已读源码） | 用途 |
|---|---|---|---|
| C1 | 替换引导页：chain 槽，需 `select`（首个非空接管），owner 声明 `inject.hooks.tabInfo`，组件另可带自有 inject 面 | `packages/client/ui-sidebar-right/src/client/contract/slots.ts` L75-80、`ui-slots/src/index.ts` L533-541 | 分类框架接管起始页 |
| C2 | 自动发现：`guide()` 返回 `{kind, order, title(), description?(), icon?}[]`（按 order 排序、引用稳定）；`subscribe(listener)` 可观察注册表变更 | `ui-sidebar-right/src/client/tab-registry.ts` L316/L385 | 枚举全部插件入口 |
| C3 | 打开条目：`ISidebarRight.openTab(kind, options?)`；`active()` / `isExpanded()` 可读当前 tab 与展开态 | `ui-sidebar-right/src/client/service.ts` L138-200 | 点条目打开内容 |
| C4 | 分类配置持久化：host `ctx.settings.register(ns, schema, { base })`；`mergeLayers` 对普通对象深合并、数组整桶替换；client `ctx.settingsScope.bind({namespace})` 读快照 + `mutate/unset` 写 | `packages/settings/settings/src/index.ts` L287-295/L419-436、`ui-settings/src/client/settings-scope.ts` | 存映射关系 |
| C5 | 设置卡片注册：`settings.plugin.item` 是 keyed/root 槽，**key = settings 命名空间**（目录按已注册命名空间分发） | `ui-settings-plugins/src/client/slot-contract.ts`、`client/index.ts` L100-165 | 设置页维护界面 |
| C6 | 六功能 tab 类型注册：`register({id, kind, title, guide})` 两段式 + `sidebar.right.pane.tab` 按类型 `id` 挂载正文；正文拿标准 props（`sessionId`、`useTabInfo()`、`useSessions()`） | `ui-sidebar-right/src/client/tab-registry.ts` L86-127、`ui-sidebar-right/src/client/shell/SidebarRight.tsx` L176-200、`ui-session/src/client/index.ts` L102-120 | 自研六功能入口 |

## 3. 数据模型（分类配置）

```ts
interface CategoryConfig {
  /** 分组定义（顺序即展示顺序）。 */
  groups: Array<{ id: string; title: string; collapsed?: boolean }>
  /** kind → 归属（未出现的 kind 落「其他」组）。 */
  entries: Record<string, {
    groupId?: string        // 归属分组；缺省 = 其他组
    label?: string          // 覆盖显示名；缺省用注册表的 title()
    hidden?: boolean        // 隐藏该条目
  }>
  /** 组内条目顺序：groupId → kind[]（缺省按发现顺序）。 */
  order?: Record<string, string[]>
}
```

默认值（spec §2.3）：`groups = [工作台, 工程与任务, 浏览与工具, 游戏, 官方]`；
`entries` 按默认映射表填（personal-workbench/troubleshoot-workbench/trading-workbench/report-studio → 工作台；
hub-* 六项 → 工程与任务/浏览与工具；audio-transcriber/audio-tts → 浏览与工具；files → 官方）；
官方内置（`files`）带「官方」标识（由映射表的 `official: true` 或 kind 白名单决定）。

## 4. 实现顺序（对应 tasks）

1. **T1** 清理与骨架：删除旧容器残留（已做）、locales 清理、目录结构落位
2. **T2** 分类框架：查证 C1/C2/C3 → `Catalog.tsx`（分组渲染 + 条目点击打开）+ `mapping.ts`（默认映射 + 自动发现 + 未登记兜底）
3. **T3** 六功能类型注册：`hub-*` 六类型 + 正文（复用现有视图）
4. **T4** 拖拽与分组管理：跨组/组内排序、增删改/折叠/恢复默认
5. **T5** 持久化：查证 C4 → 配置存 DSH settings（全局一份）
6. **T6** 设置卡片：查证 C5 → 「右侧栏分类」卡片（分组管理 + 条目映射 + 未登记提示 + 隐藏 + 恢复默认）
7. **T7** 验证：3084 测试环境逐条跑 spec §7 验收

## 5. 风险与对策

| 风险 | 对策 |
|---|---|
| guide 链式替换的注册细节不清（C1） | 先读 `slots.ts` + `GuideBody.tsx` + 找第三方先例（better-sidebar 是否用过该 slot：它注册的是 tab 类型而非 guide 替换；需自己验证） |
| `entries()` 可能返回内部类型（含资源查看器 `text` 等不该上分类的） | 过滤规则：只取 `guide()` 里有入口的类型（用户可见入口），或按 canOpen/patterns 排除纯 viewer |
| 与 better-sidebar 共存期 kind 撞名 | hub 自研用 `hub-*` 前缀；映射表里 better-sidebar 的 kind 默认隐藏（`hidden: true`） |
| settings schema 与 client 卡片注册耦合错误 | 参考 global-auth 的成熟实践（已知 3082 在用） |
| 全局配置 + 多会话 | 配置只存一份（settings），组件订阅同一来源 |

## 6. 复用清单（不重写）

- **host 全部**：`api.ts`（/shub 方法表）/`routes.ts`/`pty-*`/`git.ts`/`jobs-routes.ts`/`subagent-*`/`browser-probe.ts`/`fs-*`/`terminal-ws.ts`/`agent-opens.ts`/`tools.ts`/`trust-fence.ts`/`session-*`/`wire.ts`/`html-route.ts`/`config.ts`
- **client 视图**：`TerminalView`/`BrowserView`/`GitLens`/`ChangesTab`/`DiffPane`/`SessionLens`/`SubagentView` + `diff/*`/`ops.ts`/`terminal-*`/`theme.ts`/`paths.ts`/`use-polling.ts`/`icons.tsx`/`locales.ts`
- **已修复的构建契约**：client closure-factory（`build.mjs`）、host `inject: ['webServer','webStartup','sessions']`、`/shub` 路由前缀
