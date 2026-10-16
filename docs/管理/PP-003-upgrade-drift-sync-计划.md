# Spec 003 Plan（已随 v0.1.4 实现，2026-09-30；契约出处不变）

> 上游契约出处以 **DSH 0.2.0-rc.2**（本机 checkout `dsh-v0.2.0-rc.2`，2026-09-30 核实）为准。
> 所有扩展点均为上游公开 API；不修改上游、不写兼容垫片。

> 注（2026-10-13）：本文为 v0.1.4 定稿的计划原文，两处已被后续修订取代——① settings 命名空间自
> v0.1.7 起为 `sidebar-hub`（= profile 条目 id），且 host 不再调 `settings.register()`，schema 由
> entry 导出的 `Config`（`.volatile()` 字段）自动发现；② 发现源自 v0.1.5 起为 `guide()` only，
> `entries()` 与官方性推断（`@deepseek-ai/` 前缀）已删除。见
> [BRD-003-upgrade-drift-sync.md](../需求/BRD-003-upgrade-drift-sync.md) 的两节「修订」。

## 1. 契约出处（只读引用）

| 契约 | 出处（上游相对路径） | 说明 |
|---|---|---|
| `ctx.sidebarRightTabs` = `SidebarRightTabRegistry` | `packages/client/ui-sidebar-right/src/client/tab-registry.ts` | `register(definition)` / `entries()`（全部在编类型）/ `guide()`（仅带引导胶囊的条目，含 `providerId`）/ `get(kind)` / `subscribe(fn)` |
| `SidebarRightTabDefinition` | 同上 | `id`（实现身份，`@deepseek-ai/*` = 官方包）、`kind`、`title(address)`、`guide?` |
| 引导页 chain 槽 `sidebar.right.tab.guide` | `packages/client/ui-sidebar-right/src/client/contract/slots.ts` | hub 已接管（v0.1.x 既有，不变） |
| settings 命名空间 `dsh-sidebar-hub` | 本插件 `src/host/settings.ts`（schemastery schema） | 本次新增 `drift` 字段（见 §3） |
| profile 层 `disabled` 覆盖 | `packages/bundle/web-app/cordis.patch.yml` + 上游 overlay `apps/web/tests/sidebar-browser.overlay.yml` | R4 浏览器恢复用（profile 层，非代码） |

## 2. 划分（host / client）

**host**（本插件 `src/host/`）
- `settings.ts`：`HubSettingsSchema` 增加字段 `drift`：
  `kinds: z.dict(z.object({ title: string, official: boolean, group: string }))`（默认 `{}`）
  + `ack: z.string()`（漂移差异签名，默认 `''`）。
  语义：base 层为空快照；user 层承载"上次已确认的注册表状态"。
- 不新增路由/网络面；无 host 运行时逻辑（发现与比对全在 client）。

**client**（`src/client/`）
- `entry.ts`
  - 发现源升级（R1）：`registry.entries()` 为主源（全量在编类型；`title = def.title('')`，
    异常时回退 kind 文本），`guide()` 的 box 按 kind 合并补充 `description`；按 kind 去重。
  - 官方性（R3）：`official = def.id.startsWith('@deepseek-ai/')`，随发现结果传给 store。
  - 漂移检测（R2）：发现结果 → 与 settings `drift.kinds` 快照比对 → 差异签名
    （`added`/`removed` 的 kind 集合排序哈希）与 `ack` 比较，不等则 UI 显示提醒条；
    「知道了」→ 写 `drift.kinds` = 当前快照、`ack` = 当前签名。
  - 首次（`kinds == {}` 且 `ack == ''`）静默初始化快照，不提醒。
    **职责边界（原型已验证，`ops/validation/drift-prototype.mjs`，12/12 通过）**：
    纯 diff 函数对空快照会把全部现有 kind 报为 added——首跑抑制是**调用方策略**
    （isFirstRun = 无 ack 且 kinds 为空 → 抑制提醒），不放进纯函数内部。
- `catalog/config-store.ts`：`CategoryConfig` 内存模型 + normalize/normalizeStored 桥接新增 `drift`
  （存储形态字段齐全，沿用现有深合并/整桶替换语义）。
- `catalog/CatalogFramework.tsx`：
  - 顶部漂移提醒条：「上游能力变化：新增 A、B（已自动归组）；消失 C（可能上游停用，
    检查 profile 补丁或 DSH 版本）」+「知道了」按钮；
  - 条目「新」角标（`added` 集合内且无用户显式规则）。
- `catalog/mapping.ts`：`resolveCatalog` 归组优先级
  **用户显式规则 > 官方自动（official → `official` 组）> 其他组兜底**；
  `OFFICIAL_KINDS` 常量降级为兼容兜底（设置卡片展示用）。
- `locales.ts`：提醒条/角标文案（zh/en）。
- `SettingsCard.tsx`：设置卡展示「新」条目当前归属，可改组/隐藏（复用既有交互）。

## 3. 风险与对策

| 风险 | 对策 |
|---|---|
| `entries()` 含内部 kind（`guide`/`text` 等）混入分类页 | 沿用默认隐藏规则（guide/text hidden）；其余未知 kind 落「其他」 |
| `title('')` 对个别类型异常 | try/catch 回退 `kind` 文本 |
| web 侧启用 iframe 浏览器属 opt-in（上游有意关闭） | 仅本机 profile 层启用（R4 补丁，用户批准）；文档明示上游默认策略 |
| 测试实例（dsh-test）仍停在 0.1.7-rc.2 | 验证前先 `git pull --ff-only` 至 rc.2 并整包重装（独立 DSH_HOME/端口） |
| 上游后续再改 registry API | 只依赖 `register/entries/guide/subscribe` 四件套；升级核对时按 §上游升级核对 流程过一遍 |

## 4. 验证矩阵

1. `pnpm check`（build + typecheck + `node --check` + client-wiring / host-settings 两组冒烟）。
2. 测试实例（dsh-test，3085，独立 DSH_HOME）：
   - 装新版 tgz；UI 验收脚本（probe-tab / ui-acceptance）：分类页含全部在编类型；
   - 测试实例 profile 加浏览器补丁 → 「官方」组出现浏览器；
   - 漂移演练：profile 层临时 disable 一个类型 → 分类页出现"消失"提醒；恢复 → "新增"提醒；
     「知道了」后不重复；重启后保持。
3. 3082（**用户批准后**）：装 tgz + 应用浏览器补丁 + 重启 → 用户真机目检（官方组含浏览器）。

## 5. 回滚

- tgz 降回 0.1.3 + 重启（`drift` 字段为新键，旧版 schema 忽略，无迁移负担）。
- 浏览器补丁：删除 profile 中 3 行 + 重启。