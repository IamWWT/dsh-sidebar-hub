# dsh-sidebar-hub · 进度

> 本文件是**本插件唯一进度真源**（谁开发谁维护）；工作区根 `progress.md` 仅做总分发索引。
> 需求与架构见 [REQUIREMENTS.md](REQUIREMENTS.md) / `specs/`，踩坑记录见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

## 🔄 进行中（中断点）

- **v0.5–v0.8 全部完成并验收**：`pnpm check` 全绿（0 hub-* 类型 / 0 正文 / 默认四组）；测试实例 3085 UI 验收 **35/35**（v0.8：删「工程与任务」空组、「浏览与工具」改名「工具」）+ 文档验收 **11/11**。
- 待办：3082 侧 v0.3–v0.8 均待重启生效（须用户同意）。

## ⏭ 下一步 + 待确认

- 3082 侧：v0.3–v0.8 尚未在 3082 重启生效（须用户同意后 `systemctl --user restart dsh-dev-web`）。重启后 hub 只剩「分类框架 + 设置卡片 + md(mermaid) 渲染」三件事；官方接管终端/浏览器/Office 预览。

## 已完成

### 2026-09-20 · v0.9 插件改名跟随（daily-workbench）

- 用户反馈：「个人工作台id改变,默认需要变动」。
- `dsh-personal-workbench` → `dsh-daily-workbench`，其右侧栏 kind 由 `personal-workbench` 改为 `daily-workbench`（标题仍「个人工作台」）。
- 改动：hub 出厂映射键跟随改名（仍归「工作台」组）；测试（client-wiring seed/scopeValue）同步。
- 测试环境修复：`dsh-plugins/dsh-test-home/profiles/web/package.json` 依赖由失效的旧 tgz 改为 `link:.../dsh-daily-workbench`（bundles 同步改名）+ lockfile 更新，否则测试实例根本没有「个人工作台」。
- 验收：`pnpm check` 全绿；测试实例 UI 验收 **35/35**，2e「工作台」组 = 个人工作台 / 故障排查工作台 / 报告工作台 / 交易工作台。

### 2026-09-19 · v0.8 默认分组精简

- 用户反馈：「工程与任务那里的默认框啥都没 默认可以删除了」「浏览与工具 改成 工具 就行了」。
- 默认分组五组 → 四组：删除空组「工程与任务」（v0.6 清空自研内容后无条目）；「浏览与工具」改名「工具」（id `browse-tools` 不变）。
- `pnpm check` 全绿（host-settings/client-wiring 断言四组与「工具」名）；UI 验收 35/35 同步。

### 2026-09-19 · v0.6 清空 hub 自研内容类型 + v0.7 Office 交还官方

- 用户确认：「三个全删 + 任务管理也删」（v0.6）；「删除自研 office 渲染器」（v0.7，官方已内置）。
- v0.6：不再注册任何 `hub-*` kind/正文；host git.*/jobs.*/subagents.live/changes.ops 与模块移除；client 视图（GitLens/ChangesTab/SubagentView/DiffPane/SessionLens/diff/*）、API 层（terminal-api）、相关 locales 键删除；catalog-config 出厂映射删 hub-*。分类框架只做入口编排（官方/工作台/小游戏/语音转发）。
- v0.7：移除 office 渲染器（office-body.tsx / chunks/office.tsx / office chunk / mammoth+jszip 依赖）；docx/pptx/xls/xlsx 由官方 office-to-pdf 承接；md(mermaid) 渲染器保留（官方仍无 mermaid）。
- 验收：`pnpm check` 全绿；UI 验收 **35/35**（2c 工程与任务组无条目、2h hub-* 全移除、11 条=去除 hub-* 后正确数量、官方终端/浏览器/文件转发正常、设置卡片可达含隐藏/恢复）；文档验收 **11/11**（A17–A21：md 接管 + mermaid 2 图 + md 内图片 + docx/pptx 官方承接 + 无控制台错误）。

### 2026-09-19 · v0.5 浏览器交还官方（官方 0.1.6-alpha.2 内置）

- 官方新增 `@deepseek-ai/dsh-client-ui-sidebar-browser`（kind=`browser`，builtin，标题「浏览器」）；与 hub 自研 `hub-browser` 不同名无冲突。
- hub 移除自研浏览器全链：client `BrowserView.tsx`/`browser.ts`/`browser.css`/`SandboxStatusBar.tsx`/`hub-store.ts`（仅浏览器偏好用）+ host `browser-probe.ts` 与 `api.ts` 的 `browser.probe`；`terminal-api.ts` 删 `browserProbe`；`locales.ts` 删 13 个浏览器键。
- 分类映射：`browser` → 官方组（与 Files/终端同组），`OFFICIAL_KINDS` 加 browser，删 `hub-browser` 映射。
- 测试：client-wiring（4 类型/4 正文/官方浏览器转发）、ui-acceptance（官方浏览器打开断言、官方组含 browser、隐藏测试改用 hub-tasks）更新；`pnpm check` 全绿。

### 2026-09-15 · v0.2 终端交还官方 + 数独归游戏组

- 用户反馈（harness 0.1.6-alpha.1）：右侧栏出现官方「新建终端」（`@deepseek-ai/dsh-client-ui-sidebar-terminal`，kind=`terminal`）；
  官方 `dsh-tool-terminal` 提供 `terminal_open/send/read/signal/close/list`（与 hub 自研 `terminal_*` 五工具重名，是更新后的冲突源）。
- 决策：删除 hub 自研终端全套（client `TerminalView`/terminal-* 与 host `pty-manager`/`agent-pty`/`pty-deps`/`terminal-ws`/`tools`），
  分类框架「终端」条目改为转发官方 kind=`terminal`（出厂映射归「官方」组，与 Files 同组，标「官方」）；数独（kind=`sudoku`）出厂归「游戏」组。
- 依赖清理：`node-pty` / `@xterm/xterm` / `@xterm/addon-fit` 从 package.json 移除。
- `pnpm check` 全绿（build + typecheck + `node --check` + 两组冒烟）；变更已登记进 `docs/specs/002-*/spec.md` §0（v0.2）与 tasks.md。
- **测试实例验收 41/41**（3085 + `dsh-plugins/dsh-test-home/`，sudoku 手工 link 进测试 profile）：
  分类页「终端（官方）」点击打开官方终端（`[data-sidebar-terminal]` 可见）、官方 Files 转发正常、数独与扫雷同在「游戏」组、
  `hub-terminal` 条目消失、better-sidebar 无残留、页面无未捕获异常；截图 `docs/verify-v02b/`。

### 2026-09-15 · 修复：出厂映射终端归「官方」组

- 用户重启 3082 后点「恢复默认」，官方终端落在「工程与任务」组（当时出厂映射为 engineering）。
- 用户预期：恢复默认后官方终端应与官方 Files 同处「官方」组。已把 `DEFAULT_ENTRY_RULES.terminal` 改为
  `groupId: 'official'`，并同步 client-wiring / host-settings / ui-acceptance 三组测试断言与文档；`pnpm check` 全绿。

### 2026-09-13 · spec 002「右侧栏起始页 = 分类框架」落地（T1–T12）

- `sidebar.right.tab.guide` chain 槽接管起始页；自动发现 `guide()` 全部插件入口 + 出厂映射分组（工作台/工程与任务/浏览与工具/游戏/官方/其他）。
- 六个 `hub-*` 自研内容类型：终端·任务管理·Subagent·Git·文件变动·浏览器。
- 拖拽跨组与组内排序；settings 命名空间 `dsh-sidebar-hub` 持久化；设置页卡片「右侧栏分类」。
- 文档同步：AGENTS.md、README、docs/{index,REQUIREMENTS,TROUBLESHOOTING}、specs/002 的 plan/tasks。

### 2026-09-13 · T13 真机验收与后续反馈轮次

- **第二轮反馈 5 项已落地**：测试实例卸载 better-sidebar、分组上色、分组顺序改为 官方→工程与任务→工作台、设置卡片重写为框架同款折叠卡片。`test/ui-acceptance.mjs`（CDP 驱动本机 Chrome）37/37 通过（第三轮又修两处：`/shub/api` 的 `{ok,value}` 信封在 client 未拆导致 Git/文件变动崩 `listed.some is not a function`；测试 profile 缺 `cordis.patch.yml` 使语音转文字 `modelDir` 为空显示「环境未就绪」）。截图在 `docs/verify/`。
- **真机暴露并修复三个问题**（hooks 格是 uSES 选择器钩子必须传 selector；宿主 paneBody 是块级容器需 `height:100%`；subagents.live 缺字段防御），记入 TROUBLESHOOTING。
- **第四轮反馈（本插件部分）**：③修复「界面中文、右侧栏分类英文」——根因是读 `body[data-ds-lang]`（框架不写该属性，实际写 `documentElement.lang`），改为 locale 服务 + `documentElement.lang` 并订阅变更；④字号统一到 `--dsw-font-*` 并上抬一档（16/14/13/12）。验收 39/39。
- **第五轮反馈 3 项**：① 默认五组（官方/工程与任务/工作台/浏览与工具/游戏）不可删除（数据层+store+UI 三层防护，用户新建组可删）；② 官方分组不可重命名；③ 扫雷插件（dsh-minesweeper，kind=minesweeper）纳入出厂映射 → 游戏组（测试实例已装并验证）。验收 41/41。

### 2026-09-13 · 装机 3082 与收尾运维

- 已装到 3082（profile 的 deps/bundles + 源码软链）；用户同时卸载 better-sidebar；我先前为共存期写的 7 条隐藏规则已随卸载移除（备份 `settings.json/yaml.bak-20260913-125728`）。重启后 journal 显示 `[sidebar-hub] host apply` + `settings 命名空间已注册`，无加载错误。
- 删除 3082 `settings.yaml` 里 better-sidebar 的死配置段（卸载后的收尾清理）。

### 2026-09-17 · v0.3 官方文件预览增强（md 接管 + mermaid + Office）

- 用户反馈：官方工作区文件里 docx/ppt/图片看不了、md 里 mermaid 不渲染为图，要求修复（替换官方功能需说明）。
- 决策：**走官方 documentpreviews 扩展点**注册 `priority:'extension'` 渲染器（不碰官方源码/files 树/`text` 类型）：
  - `dsh-sidebar-hub/markdown`（md/markdown）——整体 `MarkdownText` + layout effect 把 `language-mermaid` 块换图（吸收 better-sidebar 的 mermaid 管线，MIT，SVG 消毒/主题跟随/点击放大）+ `pathImages` 让 md 内相对图片经 `/shub/file` 显示；
  - `dsh-sidebar-hub/office`（docx/pptx/xls/xlsx）——mammoth 转 HTML + jszip 文本提取；
  - 重型库（mermaid 3.37MB / mammoth）走**惰性 chunk**：build.mjs 额外产出 `dist/chunk-mermaid.js` / `dist/chunk-office.js`，host `/shub/bundle/<name>.js` 伺服，client chunk-loader 首次用到才注入；主 bundle 仅 +~几十 KB。
  - host `/shub/file` 支持工作区相对路径（md 内图片按会话 cwd 解析，围栏保留）。
- 依赖：+`mammoth` +`jszip`（mermaid 已在）。
- 验收：`pnpm check` 全绿（含 chunk 产物门禁）；测试实例 3085 `test/ui-document-v03.mjs` **11/11**（A16–A21）。

### 2026-09-17 · v0.4 字号跟随官方「设置→通用设置→字号」

- 用户反馈：hub 分类里希望字体可调、跟随官方字号设置。
- 实现：`src/client/hub-font.css` 在 `body` 声明 `--hub-font-{title,body,small,tiny,micro}` = `calc(var(--dsh-content-font-size,14px) + 偏移)`（+2/+0/−1/−2/−3）；分类框架/设置卡片/Git/浏览器/Subagent/文件变动全部改用这些变量（替换固定 `--dsw-font-*` 与硬编码 10–15px）。
- 验收：`test/ui-font-v04c.mjs` 改 `--dsh-content-font-size` 16→17→12，hub 元素计算字号恒跟随，三档通过。
