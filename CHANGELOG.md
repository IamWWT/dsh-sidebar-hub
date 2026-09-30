## 0.1.6 · 2026-09-30

**出厂映射补充 + R4 应用**（承接 0.1.5 的 guide-only 纠正）：

- 出厂映射表新增 `'opscrew-workbench': { groupId: 'workbench' }` —— 应急指挥工作台
  （`dsh-opscrew`，用户 2026-09-30 新增，kind=`opscrew-workbench`）归「工作台」组；
  冒烟测试同步加种子断言。
- 交付状态：0.1.5（guide-only 纠正）与 0.1.6 均已装入 3082 profile（0.1.5 由用户重启后生效）；
  R4 浏览器补丁已按用户指示应用（`cordis.patch.yml` 追加 `ui-sidebar-browser: disabled: false`，
  备份 `cordis.patch.yml.bak-browser-20260930-210709`）；**重启 3082 后生效**：
  官方组应出现第三个入口「浏览器」，工作台组出现「应急指挥工作台」。
- 旧 tgz（0.1.3/0.1.5）已按「每插件一份」规则删除，目录只留 0.1.6。

## 0.1.5 · 2026-09-30

**发现架构纠正（用户 2026-09-30 反馈：分类页出现「聊天/人物详情」等不该有的入口）**：

- **发现源改回 guide-only**：分类页只呈现官方 `guide()` 引导盒子里真实存在的入口
  （kind/title/description 原样透传）。v0.1.4 读 `entries()`（**标签类型注册表**：VS Code
  editor-resolver 语义，谁认领哪种 address、谁渲染）会把纯资源查看器/内部类型
  （plan、changes-review、subagentchat、text…）当成入口灌进分类页——官方起始页根本没有它们。
- **撤销 R3 官方推断**：删除 `@deepseek-ai/` 前缀判定、自动归「官方」组与「官方」角标
  （含 TerminalLauncher 硬编码角标、CSS 规则、locale 键）。归组只认显式规则
  （出厂映射 + 用户编辑），未登记 kind 一律落「其他」。官方入口 files/terminal/browser
  在出厂表显式列出，浏览器是否出现由官方是否启用其插件决定（R4 补丁）。
- 漂移检测（R2）对账对象改为 guide 入口集；drift 记录收敛为 `{title}`（不再存 official）。
- 测试：client-wiring 冒烟重写（guide-only 发现、无 guide 的内部类型不入页/不进基线/不进提醒、
  显式规则归组）；ui-acceptance 新增 2b2 内部类型混入守卫；host-settings drift 形状断言更新；
  `pnpm check` 全绿。
- 3084 复验：`ui-acceptance.mjs` 26/36，关键项 PASS——2b2「无内部 tab 类型混入分类页」、
  2d「官方组 = files+terminal（浏览器未启用时）」；截图 `docs/verify-v015/`。

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