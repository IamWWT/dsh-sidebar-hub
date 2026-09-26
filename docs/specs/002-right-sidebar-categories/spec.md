# Spec 002 右侧栏分类框架（起始页替换）

- 状态：**需求已冻结（v0.8 变更已登记，2026-09-19）** / 初版日期 2026-09-12
- 历史来源（不再借鉴）：初版曾参考 `dsh-plugins/github/DSH-better-sidebar` v0.19.0（commit `e786d8f`，MIT）；v0.6 起 hub 自研内容类型全部移除，仅 mermaid 渲染管线保留其 MIT 署名（见 `LICENSE`）。

## 0. 变更记录

### v0.9（2026-09-20，插件改名跟随）

- 用户原话：「个人工作台id改变,默认需要变动」。
- 背景事实：`dsh-personal-workbench` 已改名 `dsh-daily-workbench`，其右侧栏标签注册 kind 由 `personal-workbench` 改为 **`daily-workbench`**（标题仍为「个人工作台」，order=21，priority=extension；出处 `dsh-plugins/dsh-daily-workbench/src/client/entry.ts:250-259`）。
- 决策：hub 出厂映射 `DEFAULT_ENTRY_RULES` 的键跟随改名（`'personal-workbench'` → `'daily-workbench'`，仍归「工作台」组）；旧 kind 不再出现在出厂映射。用户层若残留 `personal-workbench` 规则会在设置卡片显示为「未登记」行，可手动移除或「恢复默认」。
- 验收：`pnpm check` 全绿（host-settings/client-wiring 断言同步为 `daily-workbench`）；测试实例 UI 验收中「个人工作台」条目归「工作台」组。

### v0.8（2026-09-19，用户反馈）

- 用户原话：「工程与任务那里的默认框啥都没 默认可以删除了」「浏览与工具 改成 工具 就行了」。
- 背景事实：v0.6 清空 hub 自研内容后「工程与任务」组为空组（无任何条目）；「浏览与工具」组当前仅语音转文字/转语音。
- 决策：
  1. **默认删除「工程与任务」组**：`DEFAULT_GROUP_IDS`/`DEFAULT_GROUPS`/`PROTECTED_GROUP_IDS` 移除 `engineering`（默认五组 → 四组：官方/工作台/工具/游戏）；用户已有自定义分组不受影响；已存在的用户配置若含该组仍显示（恢复默认后消失）。
  2. **「浏览与工具」改名为「工具」**：`DEFAULT_GROUPS` 中 browse-tools 的 `title` 改「工具」（分组 id 不变，用户已有归属规则不受影响）。
- 验收标准：见 §7 增补（A27）。

### v0.6 + v0.7（2026-09-19，用户确认删除冗余自研功能）

- 用户原话：「我们的git 文件变动 subagent功能 也去掉」「另外官方新版本查看是否已经支持docx预览了 文件打开时,如果是,我们多余做的功能是不是就要去掉」；确认：「三个全删 + 任务管理也删」「删除自研 office 渲染器」。
- 背景事实：
  - 官方 0.1.6-alpha.2 **无** Git/文件变动/Subagent 右侧栏 kind（`ui-subagent` 是会话内 `subagentchat`，不是右侧栏面板）；删后无官方承接。
  - 官方 0.1.6-alpha.2 已内置 Office 预览（`ui-sidebar-documentpreview/office`，doc/docx/xls/xlsx/ppt/pptx，Host `office-to-pdf` 转 PDF + PDF body）；md(mermaid) 渲染器官方仍无。
- 决策：
  1. **v0.6 清空 hub 自研内容类型**：移除 `hub-git`/`hub-changes`/`hub-subagent`/`hub-tasks` 四类型及其正文（`GitLens`/`ChangesTab`/`SubagentView`/diff 等）与 host 支持（git.*/changes.*/subagents.live/jobs.*/fs 视图相关）；分类框架只做官方/工作台/小游戏入口编排；`hub-*` kind 彻底不注册。
  2. **v0.7 删除自研 office 渲染器**：移除 `dsh-sidebar-hub/office` 渲染器（office-body.tsx / office chunk / mammoth+jszip 依赖），Office 预览交由官方内置；md(mermaid) 渲染器（`dsh-sidebar-hub/markdown`）保留。
- 验收标准：见 §7 增补（A24–A25）。

### v0.5（2026-09-19，用户反馈）

- 用户原话：「刚刚dsh又更新了,新增了浏览器功能, 我们这边更新一下, 现在浏览器在其他里面 ,你放到官方里面,并删除浏览与工具里面的原本的浏览器功能」。
- 背景事实：harness 更新至 0.1.6-alpha.2，官方内置右侧栏浏览器（`@deepseek-ai/dsh-client-ui-sidebar-browser`，kind=`browser`，builtin，guide 标题「浏览器」）；与 hub 自研 `hub-browser` 不同名，无冲突。
- 决策（同 v0.2 终端交还官方模式）：
  1. **浏览器交还官方**：hub 移除自研浏览器实现（client `BrowserView`/`browser.ts`/`SandboxStatusBar` + host `browser-probe` 与 `browser.probe` API）；分类框架「浏览器」条目改为官方 `kind='browser'`，出厂映射归「官方」组（与 Files/终端同组，标「官方」）。
  2. hub-store 移除浏览器偏好（`browserNoSandbox`/`browserAllowedLoopback` 等）；terminal-api 移除 `browserProbe`。
  3. 官方浏览器行为以官方实现为准；hub 不再提供沙箱偏好配置（官方无此配置项）。
  4. **设置卡片适配官方 0.1.6-alpha.2 设置页重构**：官方移除旧 `settings.plugin.item` 插槽，第三方插件配置迁到左侧栏「插件」全局面板（`plugins.bundle.config`，key=包名）的**包详情页**；hub 设置卡片随之迁移注册并完整可达（含隐藏/恢复回归）。
- 验收标准：见 §7 增补（A22–A23）。

### v0.3（2026-09-15，用户反馈）

- 用户原话：「官方的工作区文件打开后点击部分文件只能查看txt md java等文本文档, 无法查看docx ppt 图片 以及md里面mermaid没有渲染为图片, 修复一下, 如果修复过程需要替换官方功能, 请给出说明」「同意, 实现」。
- 背景事实：
  - 官方 `documentpreview`（kind=`text`）是**可扩展注册中心**：`ctx.documentPreviews.register()`（`priority: 'extension'` 优先于 builtin）+ `sidebar.right.tab.document` keyed 槽挂组件——官方预留第三方渲染器扩展位；
  - 官方不支持：docx/ppt/xlsx（`UNVIEWABLE_BINARY_EXTENSIONS` 黑名单 →「无法查看」空状态）、md 内 mermaid（`MarkdownText` 无 mermaid 分支）、md 内本地图片（官方 body 未传 `pathImages`）；
  - better-sidebar（MIT）有完整 mermaid 管线（`mermaid.tsx`/`mermaid-sanitize.ts`/`mermaid-blocks.ts`）可吸收；hub 依赖已含 `mermaid ^11.16.1`。
- 决策：
  1. **md 渲染接管（替换官方 builtin md 渲染器，走官方扩展位，不动官方源码/files 树）**：注册 id=`dsh-sidebar-hub/markdown`、extensions=`['md','markdown']`、`priority:'extension'` 的渲染器；整体走官方 `MarkdownText` 渲染 + layout effect 把 `language-mermaid` 代码块换成图（吸收 better-sidebar 管线，SVG 消毒/主题跟随/点击放大）；同时传 `pathImages` 修 md 内相对路径图片。
  2. **Office 渲染器（新增）**：注册 id=`dsh-sidebar-hub/office`、extensions=`['docx','pptx','ppt','xlsx','xls']`（binary）、`priority:'extension'`；docx 用 `mammoth` 转 HTML，pptx/xlsx 做结构化文本提取（轻量，不追求原版式）。
  3. 图片独立文件官方已支持常见格式（png/jpg/gif/webp/bmp/ico/svg），不在本变更范围；heic/tiff/avif 等如有需要后续补。
- 验收标准：见 §7 增补（A17–A20）。

### v0.4（2026-09-15，用户反馈）

- 用户原话：「hub分类里面希望字体可以调整大小, 最好跟随 设置->通用设置->字号里面的」。
- 背景事实：官方字号机制是 `--dsh-content-font-size`（body 上由 `ui-theme` bootstrap 写入，12–17px，默认 14），派生 `--dsw-font-markdown-*`；hub 分类页/设置卡片/正文当前用**固定刻度** `--dsw-font-{base-16,xs-13,xxs-12,...}`，不随官方字号设置变化。
- 决策：hub 界面字号改为**沿官方 `--dsh-content-font-size` 的偏移刻度**——在 hub 各 css 根声明本地变量 `--hub-font-{title,body,small,tiny}` = `calc(var(--dsh-content-font-size, 14px) + 偏移)`（title=+2、body=+0、small=−1、tiny=−2，默认即现有 16/14/13/12 视觉）；所有分类页/设置卡片/正文使用这些变量替代固定 token。用户调「通用设置→字号」时 hub 界面整体缩放。
- 验收：见 §7 增补（A22–A23）。

### v0.2（2026-09-15，用户反馈）

- 用户原话：「更新 deepseek harness 后，我发现右侧栏多了一个新建终端，你看看是不是官方的，如果是，就把我们的 hub 里面的设置一下，默认成官方的，另外原先参考 better-sidebar 这个的 terminal 就可以删除了」「数独也设置成默认游戏的」。
- 背景事实：harness 更新至 0.1.6-alpha.1 后，官方内置右侧栏终端（`@deepseek-ai/dsh-client-ui-sidebar-terminal`，kind=`terminal`，builtin，guide 卡「新建终端」）；官方 `@deepseek-ai/dsh-tool-terminal` 提供模型工具 `terminal_open/send/read/signal/close/list`（其中 `send/read/signal/close/list` 与 hub 自研 tools.ts 的 `terminal_*` 工具**重名**，更新后即冲突源）。
- 决策：
  1. **终端交还官方**：hub 移除自研终端实现（client `TerminalView` 体系 + host `node-pty` 体系 + 8 个模型 `terminal_*` 工具）；分类框架「终端」条目默认映射官方 `kind='terminal'`（归「官方」组，与官方 Files 同组，标「官方」）；模型终端工具统一走官方 `dsh-tool-terminal`。
  2. **数独默认归游戏组**：`kind='sudoku'` 出厂映射进「游戏」组（与扫雷同组）。
  3. `terminal_*` 工具重名冲突随自研实现移除一并消除；`agent-opens`（sidebar_open 独立功能）保留。
- 验收标准：见 §7 增补（A13–A16）。

## 1. 目标（一句话）

**打开右侧栏后看到的起始页，直接就是按类别分组的所有插件入口**——不新增标签、不套中间层；其他插件原来贡献的扁平引导胶囊不再单独出现，入口统一由分类框架组织。

## 2. 形态与交互

### 2.1 起始页替换（Q7 已确认）

- 实现路径：接管 dsh 的引导页正文扩展点 `sidebar.right.tab.guide`（chain slot，整页替换），
  打开右侧栏（无指定页面被直接打开时）看到的就是分类框架。
- 顶部 tab 条保持原生（框架固定渲染，无法分组——已与用户确认的边界）；点条目打开的内容出现在 tab 条里。
- 其他插件的原生引导胶囊不再显示（入口统一在分类框架里）。

### 2.2 条目来源：自动发现 + 映射表（Q8 已确认，选 A）

- 启动时从注册表枚举：`ctx.sidebarRightTabs.entries()` / `guide()` → 得到全部已注册类型。
- 每个 kind 经**映射表**归组；映射表未登记的 kind → 落「其他」组（可见，可手动拖动归组）。
- 映射表可在**设置页维护**（见 2.5），不是写死代码。

### 2.3 默认分组（Q5 已确认 + 新增游戏组；v0.8 起四组）

| 分组 | 条目 |
|---|---|
| 工作台 | 个人工作台、故障排查工作台、交易工作台、报告工作台 |
| 工具 | 语音转文字、文字转语音（「浏览与工具」v0.8 改名「工具」） |
| **游戏** | 扫雷、数独（v0.2 加入） |
| 官方 | 文件、终端、浏览器（官方内置，带「官方」标识） |
| 其他 | 未登记 kind 的自动兜底组 |

> 历史：v0.6 清空 hub 自研内容后「工程与任务」组为空，v0.8 从默认分组删除（默认五组 → 四组）。

### 2.4 拖拽与分组管理（Q3 已确认）

- 条目可**跨组拖动** + 组内排序。
- 分组可：新增、改名、删除、排序、折叠/展开、恢复默认。
- 布局**全局一份**（Q12=A：所有会话共用同一套分组配置）。

### 2.5 设置页配置（本次新增，Q16–18 已确认）

设置页新增一张卡片「右侧栏分类」，内容：

- **分组管理**：拖动排序、改名、＋新增、✕删除、恢复默认。
- **条目映射**：逐条列出自动发现的插件（kind / 显示名 / 分组下拉 / 隐藏开关）；
  未登记的插件带「未登记」提示，可一键归组。
- 起始页与设置页**共用同一份配置**（起始页拖拽 = 快捷操作）。
- 所有配置存 **DSH settings**（`$DSH_HOME/settings.yaml` 的插件段，可备份、跨浏览器生效）。

### 2.6 条目行为

- 点条目 → 打开对应内容（出现在顶部原生 tab 条，可并行切换）。
- 官方内置项带「官方」标识；官方 files **仅转发打开，不接管、不改动**。
- 支持**隐藏条目**（Q15=A）：隐藏后不在分类框架显示，可在设置页恢复。

## 3. 本插件提供内容的范围（v0.6 起：无自研落地页）

**v0.6 起 hub 自研内容类型全部移除**（任务管理 / Subagent / Git / 文件变动 / 浏览器均已下线），
分类框架只做**入口编排**，不提供任何 `hub-*` 落地页；未登记 kind 自动落「其他」组。

**官方能力交还**：终端（v0.2）、浏览器（v0.5）、Office 预览（v0.7）均由官方内置接管——
`kind='terminal'` / `kind='browser'` 映射进「官方」组（与 Files 同组，标「官方」），点条目打开官方功能；
docx/pptx/xls/xlsx 由官方 office-to-pdf 预览。

**md(mermaid) 渲染器保留（v0.3）**：走官方 `documentPreviews` 扩展点注册 `priority:'extension'`
渲染器，md 接管 + mermaid 图（SVG 消毒/主题跟随/点击放大）+ md 内本地图片；mermaid 管线吸收自
MIT 项目（见 `LICENSE` 署名），官方仍无 mermaid。

**其余全部转发**：个人/故障排查/交易/报告工作台、语音转文字、文字转语音、官方文件——只 `openTab`，不改动它们。

## 4. 非目标

- 不做插件独立的全屏功能（全屏 = DSH WEB 整体，浏览器 F11 之类，用户自行处理）。
- 不接管官方 files（不注册 files extension、不认领 `dsh-resource://file/**`）。
- 不改动三大工作台等既有插件（只转发）。
- 不改动 tab 条的分组（框架边界）。

## 5. 上游跟踪（用户新增要求）

- 基线：better-sidebar **v0.19.0** / commit `e786d8f`。
- 方式：定期 `git fetch` + `git log --oneline e786d8f..origin/main` 审阅上游新提交，
  逐条判断是否影响我们吸收改造过的文件，需要时同步补丁进本插件源码。
- 跟踪记录维护在本规格或 `docs/REQUIREMENTS.md`。

## 6. 落地顺序（Q11 已确认）

1. 先在 **3084 测试环境**（`dsh-plugins/dsh-test/` 的独立 clone + 独立 DSH_HOME + 端口 3084）做完全部验证；
2. 验证通过后再谈 3082 正式环境（安装 + 卸载 better-sidebar）。

## 7. 验收标准（在 3084 测试环境逐条验证）

1. 打开右侧栏 → **直接看到分类框架**（不是原生扁平胶囊列表，也不需再点任何标签）。
2. 分类框架列出自动发现的所有插件入口，按默认 5 组 + 其他组归位。
3. 点条目能打开对应内容（终端/任务/Git/文件变动/浏览器/Subagent 自研可用；工作台/语音/文字转语音/官方文件转发打开）。
4. 条目可跨组拖动、组内排序；分组可增删改/折叠；布局在所有会话间一致（全局）。
5. 设置页「右侧栏分类」卡片可维护映射（改分组、改显示名、隐藏条目、管理分组、恢复默认）。
6. 新装一个未登记插件 → 自动出现在「其他」组，设置页显示「未登记」。
7. 隐藏条目后分类框架不再显示该条目，设置页可恢复。
8. 官方 files 未被接管：原始文件树/文本预览正常工作，本插件不注册 files extension、不认领 file/**。
9. 构建门禁：`pnpm check` 全绿；client bundle 为 closure-factory（`__ModuleLoader__.load` 仅 1 次、无顶层 import）；`/shub` 路由前缀门禁零残留。
10. 全部在 3084 测试环境验证，**不触碰 3082**。

### v0.2 增补（2026-09-15）

11. 分类框架里的「终端」条目点击打开**官方终端**（kind=`terminal`），不再打开 hub 自研终端；`hub-terminal` kind 不再注册。
12. 官方终端归「官方」组（与官方 Files 同组）且带「官方」标识（`OFFICIAL_KINDS` 含 `terminal`）。
13. 数独（kind=`sudoku`）默认归「游戏」组。
14. hub 不再注册任何 `terminal_*` 模型工具（`terminal_create` 等 8 个移除），模型终端工具只剩官方 `dsh-tool-terminal`（`terminal_open/send/read/signal/close/list`），无重名冲突。

### v0.3 增补（2026-09-15，官方 documentpreview 扩展）

15. 官方文件树打开 `.md/.markdown` → **hub 的 md 渲染器接管**（id=`dsh-sidebar-hub/markdown`，`priority:'extension'` 优先于官方 builtin）；`MarkdownText` 正常渲染，官方文件树 / `text` 类型定义 / 源码均未改动（走官方 `documentPreviews` 扩展点）。
16. 含 mermaid fence 的 md → 惰性加载 `/shub/bundle/mermaid.js`（mermaid 库仅 3.37MB min 不内联主 bundle），`language-mermaid` 代码块替换为渲染图（SVG 消毒 / 主题跟随 / 点击放大）；普通代码块保持高亮。
17. md 内相对路径本地图片 → 经 `/shub/file?sessionId=..&path=..` 显示（host 路由支持工作区相对路径，围栏校验保留）；远程 http(s) 图片照常。
18. 打开 `.docx` → hub Office 渲染器（id=`dsh-sidebar-hub/office`）mammoth 转 HTML；`.pptx/.xlsx` → jszip 文本提取；`.ppt/.xls` 旧二进制格式给明确提示。重型库在 `/shub/bundle/office.js` 惰性 chunk。
19. 验证：`pnpm check` 全绿；测试实例 3085 跑 `test/ui-document-v03.mjs` **11/11 通过**（A16–A21）。

### v0.4 增补（2026-09-15，字号跟随）

20. hub 全插件字号跟随官方「设置→通用设置→字号」（`--dsh-content-font-size`）：`body` 声明 `--hub-font-{title,body,small,tiny,micro}` 偏移刻度（+2/+0/−1/−2/−3，默认 14 → 16/14/13/12/11，与既有视觉一致）；分类框架 / 设置卡片 / Git / 浏览器 / Subagent / 文件变动全部改用它。
21. 验证：测试实例改 `--dsh-content-font-size` 16→17→12，hub 探针元素计算字号恒跟随（title=+2 等），三档通过（`test/ui-font-v04c.mjs`）。

### v0.5 增补（2026-09-19，官方浏览器接管）

22. 官方内置浏览器（`@deepseek-ai/dsh-client-ui-sidebar-browser`，kind=`browser`，0.1.6-alpha.2）归「官方」组且带「官方」标识（`OFFICIAL_KINDS` 含 `browser`）；hub 自研 `hub-browser`（`BrowserView`/`browser.ts`/`SandboxStatusBar` + host `browser.probe`）全部移除，不再注册。
23. 验证：`pnpm check` 全绿（4 类型 / 4 正文）；测试实例（3085，harness 已 pull 至 0.1.6-alpha.2 并重建 client libs/web）UI 验收 **41/41 全通过**：分类页「浏览器（官方）」在「官方」组且带「官方」标记、「浏览与工具」组仅剩语音工具、点开官方浏览器（地址栏可见；官方初始无 URL 时不渲染 iframe 为官方行为）、官方 Files/终端/浏览器转发正常、设置卡片在官方「插件」面板的 dsh-sidebar-hub 包详情页可达（`plugins.bundle.config`，含隐藏/恢复回归）。

### v0.6 + v0.7 增补（2026-09-19，清空自研内容 + Office 交还官方）

24. **v0.6 清空 hub 自研内容类型**：不再注册 `hub-git`/`hub-changes`/`hub-subagent`/`hub-tasks` 及任何 `hub-*` kind 与正文；host `git.*`/`jobs.*`/`subagents.live`/`changes.ops` 方法与相关模块（git.ts/jobs-routes/subagent-live-route/subagent-activity）全部移除；client 视图（GitLens/ChangesTab/SubagentView/DiffPane/SessionLens/diff/*）与 API 层（terminal-api）删除；「工程与任务」组无自研条目（保留为空组）。
25. **v0.7 Office 渲染器交还官方**：官方 0.1.6-alpha.2 已内置 Office 预览（doc/docx/xls/xlsx/ppt/pptx，Host office-to-pdf 转 PDF），移除 hub 自研 `dsh-sidebar-hub/office` 渲染器（office-body.tsx / chunks/office.tsx / office chunk / mammoth+jszip 依赖）；md(mermaid) 渲染器保留（官方仍无 mermaid）。
26. 验证：`pnpm check` 全绿（0 hub-* 类型 / 0 正文 / 仅 mermaid chunk）；测试实例 3085 UI 验收 **35/35 全通过**（分类框架正常、无 hub-* 条目、官方终端/浏览器/文件转发正常、语音转文字在浏览与工具组、设置卡片可达且隐藏/恢复回归）+ 文档验收 **11/11**（md 接管 + mermaid + md 内图片 + docx/pptx 官方内置承接 + 无控制台错误）。

### v0.8 增补（2026-09-19，默认分组精简）

27. 默认分组由五组缩减为**四组**（官方/工作台/工具/游戏）：删除空组「工程与任务」（v0.6 清空自研内容后无条目）；「浏览与工具」改名「工具」（分组 id `browse-tools` 不变，用户既有归属规则不受影响）。验证：`pnpm check` 全绿；出厂 base 四组、`groups[2].title='工具'`、「工程与任务」出厂不存在；UI 验收 2a/2c/2f 断言同步（重启 3082 后恢复默认可见新分组）。

### v0.9 增补（2026-09-20，插件改名跟随）

28. 出厂映射跟随 `dsh-personal-workbench` → `dsh-daily-workbench`：`DEFAULT_ENTRY_RULES['daily-workbench'] = { groupId: 'workbench' }`（标题「个人工作台」仍归「工作台」组）；旧键 `personal-workbench` 不再出现在出厂映射。
29. 验证：`pnpm check` 全绿（client-wiring seed/scopeValue、host-settings 断言同步）；测试实例 3085 UI 验收 **35/35**，「工作台」组 = 个人工作台 / 故障排查工作台 / 报告工作台 / 交易工作台。附带修复测试环境：`dsh-test-home/profiles/web` 依赖由失效旧 tgz 改为 `link:` 新目录（否则测试实例缺「个人工作台」）。
