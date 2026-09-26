# Tasks 002 右侧栏分类框架

- 状态：**T1–T7 全部完成**（T7 已在测试实例 28/28 通过）/ 日期 2026-09-13
- 规则：一个任务一个逻辑改动；每任务有完成定义与验证；全程在 **3084 测试环境**验证，不碰 3082。

## T1 清理与骨架 — ✅ 完成

- 目标：删掉错误方向的实施（容器内分层），保留可复用资产，目录按新方向落位。
- 改动：删 `Categories.tsx`/`ContentArea.tsx`/`HubShell.tsx`/`hub-store.ts`/`hub.css`、`docs/specs/001-*`；旧 `hub.*` 文案键换成 `catalog.*`/`settings.*`；新目录 `catalog/`、`settings/`、`tabs/`、`shared/`。
- 完成定义：`pnpm typecheck` 通过（无悬空引用）；`pnpm check` 全绿。
- 验证：`pnpm check`（build + typecheck + node --check + 冒烟）绿；`grep -rn "HubShell\|createHubStore(" src` 只剩新 store。

## T2 分类框架 = 起始页替换 — ✅ 完成

- 目标：打开右侧栏直接看到分类框架（不是原生胶囊列表）。
- 改动：`shared/catalog-config.ts`（数据模型 + 出厂映射，host/client 同源）、`catalog/mapping.ts`（解析：发现 + 配置 → 分组视图）、`catalog/CatalogFramework.tsx` + `catalog.css`、`entry.ts`（注册到 `sidebar.right.tab.guide`，chain `select` 恒接管）。
- 前置查证：C1（chain 槽合约）、C2（`guide()` 返回形状与 `subscribe`）、C3（`openTab`）。
- 完成定义：五个默认分组 + 「其他」；点条目打开对应内容；未登记 kind 落「其他」；hidden 不显示；官方带「官方」标记。
- 验证：冒烟测试断言分组/标签/官方标记/点击 openTab（`test/client-wiring.smoke.mjs` 段 4–5）。

## T3 六功能类型注册（自研内容）— ✅ 完成

- 目标：终端/任务管理/Subagent/Git/文件变动/浏览器 作为 `hub-*` 类型可用。
- 改动：`entry.ts` 注册 6 个类型（`hub-*` kind + 类型 `id` + guide 入口）+ `tabs/HubTabBodies.tsx` 六个正文适配（复用既有视图；`SubagentView` 加 `mode` 面用于「任务管理/Subagent」两入口）+ `hub-store.ts`（偏好 + 终端生命周期策略）；host `/shub` 能力全量复用。
- 完成定义：6 个条目点击后内容正常（终端可输入、浏览器可导航、Git 显示变更、文件变动显示 diff、任务列表可终止、Subagent 显示）。
- 验证：冒烟测试断言 6 类型 + 6 正文注册与渲染不抛错；交互（真实实例）归 T7。

## T4 拖拽与分组管理 — ✅ 完成

- 目标：条目跨组拖动 + 组内排序；分组增删改/折叠/恢复默认。
- 改动：`CatalogFramework.tsx` 内的 HTML5 DnD（条目 `draggable` + 分组/条目落点）+ 分组头重命名/删除、底部新建分组、头部恢复默认。
- 选型说明：不用自研 pointer 拖拽——原生 DnD 在侧栏这种小区域足够，且少一份坐标计算；`dragover` 读不到 `dataTransfer` 的浏览器差异用模块级 `draggingKind` 兜住。
- 完成定义：跨组移动与组内排序各产生**一次**原子写（`entries` + `order` 两个桶）；分组增删改可用。
- 验证：冒烟测试段 7（拖拽跨组/组内排序/新建/重命名/删除）。

## T5 配置持久化（全局一份）— ✅ 完成

- 目标：映射与分组配置存 DSH settings（`settings.yaml` 插件段），所有会话共用。
- 改动：host `settings.ts`（命名空间 `dsh-sidebar-hub` + schemastery schema，`base` = 出厂分类）+ `host/index.ts` 注册（可选依赖 `settings`）+ client `catalog/config-store.ts`（唯一写入口：settings 可写则 `mutate` 整桶、否则内存态）+ `entry.ts` 绑定 `settingsScope`。
- 前置查证：C4（`register(ns, schema, {base})`、`mergeLayers` 深合并/数组整桶替换、client `bind/mutate/unset`）。
- 完成定义：改动配置 → 写入 settings → 重载后保持；「恢复默认」= `unset` 三个桶（回落到 base），不是写回拷贝。
- 验证：冒烟测试段 7（写 entries+order、`persistence()`、reset 调 `unset`）；真实实例重载检查归 T7。

## T6 设置页卡片 — ✅ 完成

- 目标：设置页「右侧栏分类」卡片可维护映射。
- 改动：`settings/SettingsCard.tsx` + `settings.css`（分组管理 + 每条 kind 的分组下拉/显示名/隐藏勾选/移除规则；未登记标「未登记」）+ `entry.ts` 注册到 `settings.plugin.item`（key = 命名空间）。
- 前置查证：C5（keyed/root、key = settings 命名空间、目录按已注册命名空间分发）。
- 完成定义：分组管理 + 每条 kind 的（分组下拉 / 显示名 / 隐藏开关）+ 未登记提示 + 恢复默认；改完分类页同步。
- 验证：冒烟测试段 8（卡片注册 key、未登记标记、下拉改归属、隐藏勾选、移除规则、新建分组）。

## T7 收敛验证 — ✅ 完成

- 目标：spec §7 十条验收在测试实例全部通过。
- 命令：
  - `pnpm check`（build + typecheck + `node --check` + 两组冒烟）
  - `node test/ui-acceptance.mjs --url "<测试实例 tokenized URL>" --profile-dir <持久 Chrome 目录>`
    → CDP 驱动本机 Chrome 做真实 UI 断言（含截图落到 `docs/verify/`）
- 用户反馈 5 项（2026-09-13 第二轮）与处置：
  | # | 反馈 | 处置 |
  |---|---|---|
  | 1 | better-sidebar 还装着，按预期要卸载 | 测试实例已卸载（profile 的 deps/bundles 移除，目录移到 `dsh-plugins/dsh-test-home/_uninstalled/`）；出厂映射表随之删掉 its 同名 kind 的隐藏规则（设置卡片行数 22 → 15） |
  | 2 | 要颜色，现在不友好 | 分组色调（`[data-tone]` → 语义色：官方=墨色兜底 / 工程与任务=琥珀 / 工作台=绿 / 浏览与工具=蓝 / 游戏=红）+ 左色条 + 圆点 + 计数胶囊 + 条目首字图标块；官方条目品牌色描边 |
  | 3 | 顺序：官方第一、工程与任务第二、工作台第三 | `DEFAULT_GROUPS` 改为 官方 → 工程与任务 → 工作台 → 浏览与工具 → 游戏（接受标准里加了顺序断言） |
  | 4 | 设置卡片要和其他设置一样（可折叠、友好、全局一致） | 卡片重写为框架 `PluginCard` 同款：`<li>` 卡片（0.5px 边框 / 16px 圆角 / 层 3）、头部按钮折叠（默认收起）、名称+描述+chevron、内部两个可折叠小节（分组 / 条目映射）；配色/字号/圆角全用同一套 token |
  | 5 | 顺手修发现的问题 | `dsh-global-auth` 的 `sidebar.footer.action` 注册补 `options.id`（list 槽要求），控制台 error 消失 |
- 第三轮反馈（2026-09-13）与处置：
  | # | 反馈 | 根因 | 处置 |
  |---|---|---|---|
  | 1 | Git / 文件变动 tab 报 `listed.some is not a function` | host 网关回 `{ok,value}` 信封，client `apiPost` 没拆 → 所有 `/shub/api` 调用点拿到的是信封而非值 | `apiPost` 拆信封（并有冒烟门禁 + 验收 `0c`）；Git/文件变动新增数据面断言 `3c/3d` |
  | 2 | 语音转文字显示「环境未就绪」 | 测试 profile 缺 `cordis.patch.yml` → 插件的 `modelDir`（机器配置，默认层不含）为空 → `modelOk=false` | 写入测试 profile 的 `cordis.patch.yml`（照 dev 的 audio-transcriber 块）+ 复制 audio-tts 的 `data/` 运行时设置；验收 `3e` 断言徽章「● 环境就绪」 |
- 第四轮反馈（2026-09-13）与处置：
  | # | 反馈 | 根因 | 处置 |
  |---|---|---|---|
  | 1 | 故障工作台报「未登录或会话已失效」要修 | 工作台自有 API 由 `dshAuth` 守卫，无会话必 401；前端只把服务端文案铺在面板上，用户不知下一步 | 给 `dsh-troubleshoot-workbench` 加「需要登录」横幅（说明 + 去 `/login` + 我已登录重试；登录后任一成功请求自动消失），覆盖三处请求入口；0.8.1 → 0.8.2 构建并用探针在测试实例验证 |
  | 2 | 删掉 better-sidebar 的残留配置 | 插件已卸载，`settings.yaml` 里 `dsh-better-sidebar:` 成死配置 | 已删（备份 `settings.yaml.bak-20260913-131535`） |
  | 3 | 分类页为何是英文，要和 DSH 全局一致 | `locales.ts` 读 `body[data-ds-lang]`（框架不写这个属性）→ 落到 `navigator.language`；框架实际写 `documentElement.lang` | 改为 locale 服务（权威）→ `documentElement.lang` → body → navigator 的取值链；订阅 locale 变更并把语言纳入快照签名，切换即时生效；验收 `1d` |
  | 4 | 字号偏小 | 用了 11/12px，DSH 面板正文尺度是 15–16px | 全面改用 `--dsw-font-*` token 并上抬一档（16/14/13/12）；卡片头仍与框架 `PluginCard` 的 15/13 一致；验收 `1e` |
- 第五轮反馈（2026-09-13）与处置：
  | # | 要求 | 处置 |
  |---|---|---|
  | 1 | 默认五个分组不可删除 | 数据层（`PROTECTED_GROUP_IDS`）强制 + store 拒绝 + UI 隐藏 ✕；用户新建分组仍可删 |
  | 2 | 官方分组不可重命名 | `RENAME_LOCKED_GROUP_IDS`（仅官方）+ store 拒绝 + UI 隐藏 ✎ + 设置卡片输入框只读 |
  | 3 | 扫雷游戏插件进默认「游戏」组 | `DEFAULT_ENTRY_RULES` 加 `minesweeper → games`（测试实例已装 dsh-minesweeper 验证） |
- 结果（测试实例：`DSH_HOME=dsh-plugins/dsh-test-home`、端口 3086、装齐用户全部本地插件、better-sidebar 已卸载）：**41/41 通过**
  | spec §7 | 验收点 | 证据 |
  |---|---|---|
  | 1 | 起始页直接是分类框架，原生引导胶囊不再出现 | `.hubCatalog` 在、`[data-sidebar-right-guide-entry]` = 0 |
  | 2 | 自动发现 + 五组归位 + 分组顺序 + 分组配色 | 5 组、13 条目、顺序=官方→工程与任务→工作台→浏览与工具→游戏、每组都有 `data-tone`、13 个条目图标块、官方=工作区文件（带「官方」标记）、其他组空 |
  | 3 | 六个自研入口 + 官方转发可打开 | 终端/任务管理/Subagent/Git/文件变动/浏览器逐个断言视图根元素；官方「文件」转发后无「无法查看」 |
  | 4 | 拖拽跨组、组内排序、重载后一致 | 拖 Git→游戏组、reload 后仍在；复原拖拽回工程与任务；写盘可见于 `dsh-plugins/dsh-test-home/settings.yaml` 的 `dsh-sidebar-hub` 段 |
  | 5 | 设置页卡片可维护映射，且与框架卡片同款 | 卡片 `li.hubCard`（16px 圆角 / 默认收起 / 名称+描述+chevron）、展开后 2 个可折叠小节、15 行映射表（含「未登记」行）、每行带色调图标块 |
  | 6 | 未登记插件落「其他」+ 卡片标「未登记」 | 卡片 `hasUnregistered=true`；当前 profile 的所有插件 kind 都已在映射表内，故「其他」组为空 |
  | 7 | 隐藏后分类页不显示、可恢复 | 勾选隐藏 hub-browser → 分类页消失 → 取消勾选 → 条目回来（13 条） |
  | 8 | 官方 files 未被接管 | 转发打开正常；静态红线由冒烟测试守（产物无 `files` kind、无 `dsh-resource://file`） |
  | 9 | 构建门禁 | `pnpm check` 全绿；closure-factory 恰好 1 次、无顶层 import；`/sidebar/` 前缀零残留；`apiPost` 拆 `{ok,value}` 信封（新增门禁） |
  | 10 | 不触碰 3082 | 全程只在 3085 + `dsh-plugins/dsh-test-home`；3082 未重启、未改配置 |
- 真机暴露并修复的三个问题（冒烟测试没抓到，教训见 TROUBLESHOOTING）：
  1. inject 的 `hooks` 格是 **uSES 选择器钩子**，组件必须传 selector（原来 `useCatalog()`/`useSessions()` 无参调用 → `slot entry crashed`）；
  2. 框架 `paneBody` 是**块级滚动容器**，视图的 `flex:1` 不生效 → 六个正文改用 `height:100%` 外壳（任务管理此前只有 39px 高）；
  3. `subagents.live` 的 `live` 字段缺失防御（`Object.keys(undefined)` 会让整个 tab body 崩）。
- 另记（**非本插件**，交回用户）：`dsh-global-auth` 往 list 槽 `sidebar.footer.action` 注册时未带 `options.id`，当前 harness 的 list 槽要求 id → 控制台 2 条 error。本插件验收已把它单列，不计入判定。
- 截图证据：`docs/verify/01-catalog.png`、`02-files-forward.png`、`03-settings-card.png`、`04-catalog-after-hide.png`、`05-final.png`。

## v0.2 变更（2026-09-15）— 终端交还官方 + 数独归游戏组 ✅ 完成

- 用户反馈：harness 更新至 0.1.6-alpha.1 后官方内置右侧栏终端（kind=`terminal`，guide 卡「新建终端」）；官方 `dsh-tool-terminal` 提供 `terminal_open/send/read/signal/close/list`（与 hub 自研 `terminal_*` 五工具重名）。要求 hub 默认用官方终端、删除参考 better-sidebar 的自研终端；数独归「游戏」组。
- 改动：
  - **client**：`entry.ts`（五个 `hub-*` 类型/正文，去掉 hub-terminal）；`tabs/HubTabBodies.tsx`（删 HubTerminalBody）；`hub-store.ts`（删终端 facet/偏好，留浏览器偏好）；`terminal-api.ts`（改名 `hubApi`，删终端方法/WS 地址，保留 gitApi/browserProbe/subagentsLive/job*）；删 `TerminalView.tsx` / `terminal.css` / `terminal-font.ts` / `terminal-links.ts` / `terminal-prefs.ts` / `one-dark-palette.ts`；`locales.ts` 删终端文案键；`icons.tsx` 删终端图标。
  - **host**：`index.ts`（去 pty/工具装配，保留 agent-opens 与 settings）；`routes.ts`（删终端/agent 终端 WS，agent-opens WS 就地接线）；`api.ts`（删 `pty.close`/`shell.get`/`terminal.deps`/`agent.pty.close`）；`config.ts` + `cordis.patch.yml`（删终端配置键）；删 `pty-manager.ts` / `agent-pty.ts` / `pty-deps.ts` / `terminal-ws.ts` / `tools.ts`；`agent-opens.ts` 补 `attachAgentOpen`；`wire.ts` 删 pty 错误码。
  - **映射**：`shared/catalog-config.ts` 出厂映射 `terminal → official`（官方组，与 Files 同组）、`sudoku → games`，删 `hub-terminal`。
  - **依赖**：package.json 删 `node-pty` / `@xterm/xterm` / `@xterm/addon-fit`。
  - **测试**：`client-wiring.smoke.mjs`（五类型五正文 + 官方终端转发 + 数独断言）；`host-settings.smoke.mjs`（terminal/sudoku 出厂规则）；`ui-acceptance.mjs`（官方终端打开断言 `[data-sidebar-terminal]`、数独在游戏组、hub-terminal 消失）。
- 完成定义：`pnpm check` 全绿；测试实例分类页「终端」点击打开官方终端；数独在「游戏」组；无 `terminal_*` 重名冲突。
- 验证：`pnpm check` 绿（build + typecheck + 两组冒烟）；测试实例 3085 UI 验收（见 PROGRESS.md）。

## v0.3 变更（2026-09-17）— 官方文件预览增强（md 接管 + mermaid + Office）✅ 完成

- 用户反馈：官方工作区文件 docx/ppt/图片看不了，md 里 mermaid 不渲染为图；修复如需替换官方功能需说明。
- 做法：官方 `documentPreviews` 扩展点注册 `priority:'extension'` 渲染器（`dsh-sidebar-hub/markdown` + `dsh-sidebar-hub/office`），
  惰性 chunk（mermaid/mammoth）经 `/shub/bundle/<name>.js` 伺服；`/shub/file` 支持相对路径。
- 产物：dist/chunk-mermaid.js、dist/chunk-office.js；依赖 +mammoth +jszip。
- 验证：`pnpm check` 全绿（含 chunk 门禁）；`test/ui-document-v03.mjs` 11/11（md/mermaid/图片/docx/pptx）。

## v0.4 变更（2026-09-17）— 字号跟随官方设置 ✅ 完成

- 用户反馈：hub 分类字体希望可调、跟随「设置→通用设置→字号」。
- 做法：`hub-font.css` 在 body 声明 `--hub-font-*` 偏移刻度，全插件 css 改用；验证 `test/ui-font-v04c.mjs` 三档通过。

## v0.5 变更（2026-09-19）— 浏览器交还官方 ✅ 完成

- 用户反馈：harness 0.1.6-alpha.2 官方新增浏览器（kind=`browser`，builtin），当前在「其他」组；要求放「官方」组并删除 hub 自研浏览器。
- 改动：
  - `shared/catalog-config.ts`：`browser` → official 组，`OFFICIAL_KINDS` 加 browser；删 `hub-browser` 出厂映射。
  - client：删 `BrowserView.tsx` / `browser.ts` / `browser.css` / `SandboxStatusBar.tsx` / `hub-store.ts`（仅浏览器偏好用）；`entry.ts`/`tabs/HubTabBodies.tsx` 五类型五正文 → 四类型四正文；`terminal-api.ts` 删 `browserProbe`；`locales.ts` 删 13 个浏览器键。
  - host：删 `browser-probe.ts` 与 `api.ts` 的 `browser.probe` 方法。
- 验证：`pnpm check` 全绿（4 类型 / 4 正文）；`test/ui-acceptance.mjs` 断言更新（官方浏览器打开 `[data-sidebar-browser-frame]`、官方组含 browser、浏览与工具剩语音工具、隐藏测试改用 hub-tasks）。

## v0.6 变更（2026-09-19）— 清空 hub 自研内容类型 ✅ 完成

- 用户确认：删 hub-git/hub-changes/hub-subagent + 任务管理也删。
- 改动：不再注册任何 `hub-*` kind/正文；host git.*/jobs.*/subagents.live/changes.ops 与模块移除；client 视图（GitLens/ChangesTab/SubagentView/DiffPane/SessionLens/diff/*）、API 层（terminal-api）、相关 locales 键删除；catalog-config 出厂映射删 hub-*。
- 验证：`pnpm check` 全绿；UI 验收 35/35（工程与任务组无条目、hub-* 全移除、官方转发正常）。

## v0.7 变更（2026-09-19）— Office 渲染器交还官方 ✅ 完成

- 用户确认：官方已内置 Office 预览（doc/docx/xls/xlsx/ppt/pptx），删 hub 自研 office 渲染器。
- 改动：移除 office-body.tsx / chunks/office.tsx / office chunk / mammoth+jszip 依赖 / office locales 键；md(mermaid) 渲染器保留。
- 验证：文档验收 11/11（md 接管 + mermaid + md 内图片 + docx/pptx 官方内置承接 + 无控制台错误）。

## v0.8 变更（2026-09-19）— 默认分组精简 ✅ 完成

- 用户反馈：「工程与任务那里的默认框啥都没 默认可以删除了」「浏览与工具 改成 工具 就行了」。
- 改动：`DEFAULT_GROUP_IDS`/`DEFAULT_GROUPS`/`PROTECTED_GROUP_IDS` 移除 engineering（默认五组 → 四组：官方/工作台/工具/游戏）；browse-tools 组 title 改「工具」（分组 id 不变，用户归属规则不受影响）。
- 验证：`pnpm check` 全绿（host-settings 断言四组与「工具」名、client-wiring 断言无「工程与任务」组）；测试实例 UI 验收同步。


## v0.9 变更（2026-09-20）— 插件改名跟随 ✅ 完成

- 用户反馈：「个人工作台id改变,默认需要变动」。
- 改动：`catalog-config.ts` 出厂映射 `'personal-workbench'` → `'daily-workbench'`（归「工作台」组）；client-wiring 冒烟 seed 与 settings scopeValue 同步。
- 测试环境：`dsh-test-home/profiles/web/package.json` 依赖改 `link:dsh-daily-workbench` + bundles 改名 + lockfile 更新（原指向已删除的旧 tgz，导致测试实例无「个人工作台」）。
- 验证：`pnpm check` 全绿；UI 验收 35/35（2e 工作台组含「个人工作台」）。
