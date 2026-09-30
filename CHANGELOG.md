## 0.1.4 · 2026-09-30

**DSH 升级漂移同步（spec 003，R1–R3）**：DSH 升级引入/移除原生能力后，分类页不再「静默变化」。

- R1 发现升级：分类页读 `sidebarRightTabs.entries()`（全量在效 tab 定义）∪ guide 引导条目，
  按 kind 去重 —— 上游新引入、即使没有引导胶囊的原生能力（0.2.0 浏览器消失的根因形态）也会出现在
  分类页；旧宿主无 `entries()` 时退回旧行为（guide-only）。
- R2 漂移提醒：settings `dsh-sidebar-hub` 命名空间新增 `drift` 桶（能力快照 + 确认签名）。
  首跑静默初始化基线；此后 DSH 升级/插件增删导致能力新增或移除时，分类页顶部出现提醒
  （新增/移除分列 + 自动归组落点），「知道了」写新基线并持续安静（跨重启保留）。
- R3 官方自动归组：无用户规则且由 `@deepseek-ai/*` 实现的 kind 自动落「官方」组，
  第三方落「其他」；用户显式规则始终优先。
- UI：条目「新」角标（未确认的新能力）；中英文案与 token 化提醒横幅样式。
- 测试：client-wiring 冒烟新增（`entries()` 主源、无 guide 新 kind、首跑静默初始化、
  漂移新增/移除/ack 全流程、官方自动归组）+ host-settings 的 drift 桶合并/补默认断言；
  `pnpm check` 全绿。
- 背景：0.1.x→0.2.0 升级后浏览器从右侧栏消失的根因是上游 web profile 默认禁用
  `ui-sidebar-browser`（非本插件 bug，证据见 spec 003 §0 与管理根 `ops/validation/`）；
  web 侧重新启用为 profile 层补丁（管理根 `ops/browser-web-enable-patch-20260930.md`），
  是否应用由用户决定。
- 交付状态：源码与 tgz 完成（`dsh-sidebar-hub-0.1.4.tgz`）；3082 安装与重启待用户批准，
  3084 测试实例复验见 `docs/PROGRESS.md`。

## 0.1.3 · 2026-09-25（2026-09-30 补记）

原生入口交互修复（spec `20260925-native-entry-ui`）：保留官方 guide provider 的完整入口、
恢复终端多类型 shell 下拉；分类拖拽仍由 Hub 管理。
（下方 0.1.2 条目描述的即该工作，当时版本号误标。）

## 0.1.2 · 2026-09-25

保留官方 guide provider 的完整入口，恢复终端 shell 下拉；分类拖拽仍由 Hub 管理。