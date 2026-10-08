# dsh-sidebar-hub — 需求 · 决策 · 实现 · 验收

## 当前状态

- 文档性质：规格（需求 → 决策 → 实现 → 验收追踪表）
- 对应版本：v0.1.7
- 状态：有效
- 维护者：AI + 用户

> 追踪表（以终为始，只记当前有效方向）。规格：[../需求/BRD-002-right-sidebar-categories.md](../需求/BRD-002-right-sidebar-categories.md)（需求已冻结）；
> 技术：[PP-002-right-sidebar-categories-计划.md](../管理/PP-002-right-sidebar-categories-计划.md)；任务与状态：[PP-002-right-sidebar-categories-任务.md](../管理/PP-002-right-sidebar-categories-任务.md)。
> 事故复盘：[RMP-风险管理.md](../管理/RMP-风险管理.md)。

## 需求 → 决策

| 需求 | 决策 | 出处 |
|---|---|---|
| 打开右侧栏，**里面的内容被彻底分组**（不是新增一个工作台 tab、不在 tab 内再分层） | 用 `sidebar.right.tab.guide` 的 **chain 槽接管「起始页」正文**：`select` 恒接管，原生引导胶囊不再单独出现 | spec §1/§2.1 |
| 三大工作台放一起、按功能分区 | 出厂 4 组（v0.8 起），顺序：**官方 → 工作台 → 工具 → 游戏**（「浏览与工具」改名「工具」、删空组「工程与任务」）；未登记 kind 落「其他」；每组有语义色 + 条目首字图标块 | spec §2.3、2026-09-13 用户反馈 / v0.8 |
| 应急指挥工作台（dsh-opscrew）归入「工作台」组（2026-09-30 用户新增） | 出厂映射加 `'opscrew-workbench': { groupId: 'workbench' }`（v0.1.6）；该插件已在 3082 profile 安装（含其 `cordis.patch.yml` 机器级配置） | 用户 2026-09-30 指示 / v0.1.6 |
| ~~吸收 better-sidebar 的常用功能~~ → **v0.6 起不再吸收**（历史决策，已全线取消） | 初版曾以五个 `hub-*` 类型（任务管理 / Subagent / Git / 文件变动 / 浏览器）自研承接并脱钩 better-sidebar 运行时；**v0.6 起全部移除**，本插件只做入口编排。终端（v0.2）、浏览器（v0.5）、Office 预览（v0.7）均交还官方内置 | spec §2.2 / §0（v0.2、v0.6、v0.7）/ §3 |
| 官方 files 保持原样 | **不注册** `kind:'files'` extension、**不认领** `dsh-resource://file/**`；只在分类里 `openTab('files')` 转发并标「官方」 | spec §2.4（红线） |
| 分类可维护、可自定义 | 出厂映射表 + 运行时**自动发现**（v0.1.6：**只读 `guide()`** 引导条目——官方起始页能力的唯一公开来源；v0.1.4 曾读 `entries()` 类型注册表，把纯资源查看器（plan/changes-review/subagentchat…）当入口灌进分类页，用户 2026-09-30 纠正后 v0.1.5 起改回 guide-only）；分类页拖拽与设置页表单两处可编辑 | spec §2.5 / spec 003 R1（v0.1.5 修订） |
| DSH 升级引入/移除能力时**用户能察觉**（2026-09-30 用户原话「避免我不知道」） | 能力快照存 settings `dsh-sidebar-hub` 的 `drift` 桶：首跑静默初始化基线；此后注册表新增/移除入口 → 分类页顶部提醒（新增/移除分列 + 落点分组），「知道了」写新基线并保持安静（跨重启）；v0.1.5 起对账对象 = **guide 入口集**（与分类页同源） | spec 003 R2 |
| ~~官方能力不该落进「其他」~~ → **v0.1.5 已撤销（用户纠正）** | v0.1.4 曾按 `@deepseek-ai/` 前缀推断「官方」并自动归组/打角标——这是插件自己的判断，会把官方起始页没有的入口（如内部查看器）凭空挪进「官方」组；v0.1.5 起**不做任何官方性推断**：归组只认显式规则（出厂映射 + 用户编辑），未登记一律落「其他」；官方入口（files/terminal/browser）在出厂表显式列出 | spec 003 R3（v0.1.5 撤销） |
| 浏览器升级后从侧栏消失，用户无感知（2026-09-29 事故） | 根因在上游 web profile 默认禁用 `ui-sidebar-browser`（非本插件 bug，证据 spec 003 §0）；重启用 = 3082 profile 层 `cordis.patch.yml` 补丁（管理根 `ops/browser-web-enable-patch-20260930.md`）：**2026-09-30 已应用**（用户反馈「没看到三个官方，只看到2个」= 要求浏览器回来；备份 `cordis.patch.yml.bak-browser-*`），**重启 3082 后生效** | spec 003 R4（已应用，重启待用户） |
| 配置全局一份、可持久化 | DSH settings 命名空间 `sidebar-hub`（v0.1.7 起 = **profile 条目 id**，旧包名 `dsh-sidebar-hub` 退役）；绑定上游 `configForms`（旧 `settingsScope` 已移除）；`base` = 出厂分类（entry `Config` 的 volatile 字段默认值），「恢复默认」= `unset` 回落 base | spec §2.5 / v0.1.7 settings 契约适配 |
| 全屏展示（覆盖整个浏览器） | **不由本插件实现**：属 DSH WEB 层能力，用户在应用层处理；插件只做侧栏内容 | spec §2.6（非目标） |
| 独立路由 | `/shub/*`（JSON 网关 + WS + 媒体/HTML/上传 + `/shub/bundle` 惰性 chunk），前置 trust-fence | plan §1 |
| 官方文件预览增强：docx/ppt 看不了、md 里 mermaid 不渲染（v0.3） | 走**官方 `documentPreviews` 扩展点**注册 `priority:'extension'` 渲染器（不碰官方源码/files 树/`text` 类型）：`dsh-sidebar-hub/markdown`（md 接管 + mermaid 图 + 本地图片）+ `dsh-sidebar-hub/office`（mammoth docx / jszip pptx·xlsx 文本提取）；重型库惰性 chunk（`/shub/bundle`） | spec §0（v0.3）/ §7 A15–A19 |
| hub 分类字号跟随官方字号设置（v0.4） | `body` 声明 `--hub-font-*` 偏移刻度（基于 `--dsh-content-font-size`），全插件 css 改用；官方改字号 hub 整体缩放 | spec §0（v0.4）/ §7 A20–A21 |
| 官方新增浏览器，hub 浏览器交还官方（v0.5） | 官方 `kind='browser'`（0.1.6-alpha.2 内置）归「官方」组并标「官方」；hub 自研浏览器（`BrowserView`/`browser.ts`/`SandboxStatusBar` + host `browser.probe`）全链移除 | spec §0（v0.5）/ §7 A22–A23 |
| 清空 hub 自研内容类型（v0.6） | 不再注册 `hub-*` kind/正文；host git.*/jobs.*/subagents.live/changes.ops 与视图/API 层全部移除；分类框架只做入口编排 | spec §0（v0.6）/ §7 A24 |
| Office 预览交还官方（v0.7） | 官方 0.1.6-alpha.2 内置 Office 预览（doc/docx/xls/xlsx/ppt/pptx）；移除 hub 自研 office 渲染器（mammoth/jszip + office chunk）；md(mermaid) 渲染器保留 | spec §0（v0.7）/ §7 A25 |
| 验证不碰 3082 | 测试环境（`dsh-plugins/dsh-test/` + 独立 DSH_HOME + 独立端口）；3082 只在用户点头后动 | spec §4、AGENTS.md |

## 实现 → 验收（随任务推进勾选）

| 任务 | 内容 | 状态 |
|---|---|---|
| T0 | 插件骨架（build / typecheck / check / 冒烟脚本） | ✅ 完成 |
| T1 | Host 基础：`/shub` 网关（api / 媒体 / HTML / 上传 / WS）+ fs·session 方法 | ✅ 完成 |
| T2 | 终端 Host：`pty-manager` + WS 控制帧（close/park/resize）+ agent 终端 + `terminal_*` 八工具 | ✅ 完成 → **v0.2 已移除**（交还官方：`dsh-tool-terminal` 提供 `terminal_open/send/read/signal/close/list`，与 hub 原 `terminal_*` 五工具重名冲突随之消除） |
| T3 | 终端 Client：`TerminalView`（xterm 6、字体/链接/重连） | ✅ 完成 → **v0.2 已移除**（官方 `ui-sidebar-terminal` 接管 UI） |
| T4 | 浏览器：`browser-probe` + `BrowserView` + `SandboxStatusBar` + 沙箱策略 | ✅ 完成 |
| T5 | Subagent / 任务：`subagents.live` / `jobs.output` / `jobs.kill` + `SubagentView`（新增 `mode` 面，拆出「任务管理」与「Subagent」两入口） | ✅ 完成 |
| T6 | Git：`git.ts` 14 个方法 + `GitLens`（worktree / 分支 / 提交 / 历史分页 / 危险操作确认） | ✅ 完成 |
| T7 | 文件变动 / Diff：`changes.ops` + ops·diff 子系统 + `SessionLens` + `DiffPane` + `ChangesTab` | ✅ 完成 |
| T8 | 分类框架（起始页替换）：`shared/catalog-config.ts` + `catalog/mapping.ts` + `catalog/CatalogFramework.tsx` + guide chain 注册 | ✅ 完成（冒烟段 4–5） |
| T9 | 功能类型（自研内容）：`hub-*` 五类型 + `tabs/HubTabBodies.tsx` 五正文 + `hub-store.ts`（v0.2 起终端除外） | ✅ 完成（冒烟段 2–3） |
| T10 | 拖拽与分组管理：跨组移动 / 组内排序 / 新建·重命名·删除·折叠 / 恢复默认 | ✅ 完成（冒烟段 7） |
| T11 | 配置持久化：host settings 命名空间（schema + base）+ client `config-store`（唯一写入口） | ✅ 完成（冒烟段 7） |
| T12 | 设置页卡片「右侧栏分类」：分组管理 + 每条 kind（分组 / 显示名 / 隐藏 / 移除规则）+ 未登记提示 | ✅ 完成（冒烟段 8） |
| T13 | 收敛：spec §7 十条验收在测试实例逐条通过（`test/ui-acceptance.mjs` **41/41**，含数据面与语音环境断言）+ 文档同步 + 3082 未被触碰 | ✅ 完成（测试实例 3085，better-sidebar 已卸载，截图在 `docs/verify/`） |
| S03 | **v0.1.4–0.1.6 升级漂移同步（spec 003）**：v0.1.4 实现 R1（entries()∪guide() 发现）+ R2（漂移提醒）+ R3（官方自动归组）；**v0.1.5 用户纠正**：发现源改为 guide-only、撤销 R3 官方推断/角标/自动归组、漂移改对账 guide 入口集；**v0.1.6** 出厂映射加 `opscrew-workbench`（应急指挥工作台）归「工作台」；`pnpm check` 全绿；3084 复验关键项 PASS（2b2：无内部类型混入）；0.1.5/0.1.6 已装入 3082，重启待用户 | ✅ v0.1.6 实现完成（2026-09-30） |

## 当前已知取舍（诚实记录，不掩盖）

- **终端交还官方（v0.2）**：终端 UI 与模型 `terminal_*` 工具统一由官方提供（`ui-sidebar-terminal` + `dsh-tool-terminal`），本插件不再装配 node-pty。官方终端的行为（会话保活、清理、shell 选择）以官方实现为准，本插件不承诺自研时期的部分语义（如旧的"关 tab 不杀 pty"park 策略）。
- **拖拽用原生 HTML5 DnD**（非自研 pointer 坐标）：侧栏区域小、收益低；`dragover` 读不到 `dataTransfer` 的浏览器差异用模块级状态兜住。
- **删除分组**只把条目落回「其他」，不清除其显示名/隐藏规则（可再拖回）。
- **默认四组受保护（v0.8 起）**：官方/工作台/工具/游戏 不可删除（用户新建分组可删）；官方不可重命名（其余默认组可改名）。
- **视图尺寸（历史，v0.6 起无正文）**：框架面板的 body 是块级滚动容器（`paneBody` 无 `display:flex`），曾对五个 hub 正文套 `.hubTabFill { height:100% }`；该取舍随自研内容类型移除而失效，分类框架自身用 `height:100%` 撑满即可。
- **settings 存储形态 vs 内存形态**：存储（`settings.yaml`）里 `entries[kind]` 恒为 `{groupId, label, hidden}` 三键齐全（空值 `''`/`false` = 未设置），因为 settings 对字典**深合并**——「键缺席」等于继承 base，删键会让出厂规则复活；client 内存里是稀疏形态。桥接在 `config-store.ts` 的 `toStoredEntries()` / `normalizeConfig()`。
- **`@deepseek-ai/schemastery` dev 依赖**：本机 pnpm store 只读，开发期用 `node_modules/@deepseek-ai/schemastery → ~/.dsh-dev/profiles/web/...` 的软链解析类型；正式机器 `pnpm install` 即可。运行时该依赖由目标 profile 自带（host 产物 external）。详见 TROUBLESHOOTING。
- **不再依赖 better-sidebar（已达成，v0.6 起）**：目标形态成立——hub 自研内容类型全部移除（仅 mermaid 渲染管线保留其 MIT 署名，见 `LICENSE`），测试实例已卸载；**不再跟踪其上游**（无拷贝/改造文件需要同步）。
