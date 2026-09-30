# dsh-sidebar-hub — 分类式侧边栏工作台

## 一句话定位

把**打开右侧栏后看到的起始页**换成按功能分组的分类界面：各插件入口按 **官方 → 工作台 → 工具 → 游戏** 四组归类，分组与映射由用户在分类页拖拽或设置页卡片维护，配置存 DSH settings 的 `dsh-sidebar-hub` 命名空间。本插件**只做入口编排**，不提供落地页。

## 当前能力清单

**分类框架**

- 接管 `sidebar.right.tab.guide`（chain 槽，起始页替换）：条目按四组归位，每组带语义色左条/圆点，条目带首字图标块；未登记的 kind 自动落「其他」。
- **可维护**：分类页拖拽（跨组移动、组内排序、新建/重命名/删除/折叠/恢复默认）+ 官方「插件」面板里的「右侧栏分类」配置卡片（`plugins.bundle.config`），两处共用同一份配置。
- 默认四组不可删除、官方组不可重命名（`PROTECTED_GROUP_IDS` / `RENAME_LOCKED_GROUP_IDS`，store 层兜底拒绝写入，UI 隐藏按钮）；用户新建分组不受限。
- **配置持久化**：DSH settings 命名空间 `dsh-sidebar-hub`（全局一份）；settings 不可用时退内存态并在分类页标「未持久化」。
- 自动发现其它插件的引导条目（`ctx.sidebarRightTabs.guide()` + `subscribe()`），后注册的入口也会进分类。

**官方能力交还 / 自研保留**

- 终端、浏览器、Office 预览均由**官方内置**接管（`kind='terminal'` / `kind='browser'` 映射进「官方」组并标「官方」；doc/docx/xls/xlsx/ppt/pptx 走官方 office-to-pdf），本插件只转发入口，不接管、不替换。
- **保留 md(mermaid) 渲染器**（走官方 `documentPreviews` 扩展点）：md 接管 + mermaid 图 + md 内本地图片（官方仍无 mermaid），经 `/shub/bundle` 惰性 chunk 加载。
- 字号跟随官方「设置 → 通用设置 → 字号」（`--hub-font-*` 偏移刻度）；文案 zh/en，语言取 `document.documentElement.lang`（经 `ctx.locale`）。
- hub 自研内容类型（任务/Subagent/Git/文件变动）已全部移除，仅保留上述入口编排与 md 渲染。

**宿主面**

- `/shub/api/<method>` JSON 网关（`{ok:true, value}` 信封，session/fs 基础）+ `/shub/file`（md 图片）+ `/shub/upload` + `/shub/bundle`（惰性 chunk），全部前置信任围栏。
- client 产物为 closure-factory（`window.__ModuleLoader__.load({id, factory})` 恰好一次，无顶层 `import`）。

**明确不做**

- 不接管官方文件浏览/预览（不注册 `kind:'files'` extension 与 `dsh-resource://file/**` viewer，只允许 `openTab('files')` 转发）；不接管官方终端/浏览器/Office 预览；不提供「覆盖整个浏览器的全屏」（那是 DSH WEB 应用层能力）；不改动其它自研插件。

## 安装

一律 **tgz 安装**（无 link 安装）：

```bash
cd dsh-plugins/dsh-sidebar-hub
pnpm check && npm pack        # 产出 dsh-sidebar-hub-0.1.4.tgz

cd ../../deepseek-harness
DSH_HOME=~/.dsh-dev pnpm dsh plugin --profile web add \
  /home/wwt/Downloads/aigc/proj/deepseek/dsh-plugins/dsh-sidebar-hub/dsh-sidebar-hub-0.1.4.tgz
```

- 装完核对 `~/.dsh-dev/profiles/web/node_modules/dsh-sidebar-hub/dist` 真实存在。
- **重打包必须升版本号**（同版本 pnpm 按 integrity 判「已最新」，不重解压 → 缺 `dist/` 启动即报错）。
- 重启 3082 **需用户同意**：`systemctl --user restart dsh-dev-web`；windows-lite 手动重启 dsh 进程。
- 装进**测试实例**（禁止直接动 3082）：`cd dsh-plugins/dsh-test/deepseek-harness`，`DSH_HOME=<独立测试 DSH_HOME> pnpm dsh web --port 3084 --no-open`，再 `pnpm dsh plugin --profile web add <本插件目录或 tgz>`。

## 构建与验证

`package.json` scripts：`build` / `typecheck` / `test` / `check` / `pack`。

```bash
pnpm install      # 首次（含 devDependencies 的 @deepseek-ai/schemastery）
pnpm check        # build + typecheck + node --check 双产物 + 两组冒烟（提交前必跑）
pnpm test         # client-wiring.smoke.mjs + host-settings.smoke.mjs
npm pack          # 产 tgz（= pnpm build && npm pack）
```

- `test/client-wiring.smoke.mjs`：跑 `dist/client.js`——工厂注册恰好一次、guide chain、自动发现与映射（官方 terminal/browser 转发、数独归游戏组）、点条目 `openTab`、拖拽跨组与组内排序、settings 写回（含「移入其他写空串」）、恢复默认 unset、设置卡片表单。
- `test/host-settings.smoke.mjs`：用真实 schemastery 验证 schema——出厂 base、深合并、数组整桶替换、默认值补齐、wire envelope 往返。
- **真机 UI 验收**（测试实例，会消费该实例 token，跑完重启一次取新链接）：

```bash
node test/ui-acceptance.mjs --url "http://127.0.0.1:3085/?token=..." \
  --profile-dir <持久 Chrome 目录> --shot-dir ./docs/verify
```

- 单个 tab 报错排查（抓 DOM 文案 + 4xx/5xx 请求 + 控制台）：

```bash
node test/probe-tab.mjs --url "http://127.0.0.1:3085/?token=..." --kind troubleshoot-workbench --wait 8000
```

## 环境支持矩阵

| 环境 | 支持度 | 验证状态 |
|---|---|---|
| `ubuntu-4090`（源码树 + systemd 3082；验证用测试实例 3085） | 全量 | `pnpm check` 全绿 + 测试实例 UI 验收 **35/35**（截图 `docs/verify-v08/`）；3082 始终未碰 |
| `windows-lite`（源码树 + `dsh-dev` 手动启动，无 systemd） | 全量 | 本插件无本地模型 / 数据库 / Python 依赖，行为一致；**本版实机验收未记录 → 未验证** |

- 环境差异走配置键（本插件配置 = DSH settings 命名空间 `dsh-sidebar-hub`，全局一份），不做 OS 探测分支；`systemctl` 与 Bash 命令仅适用于 `ubuntu-4090`。
- 无门禁实例 ≠ 环境可用：读 `dshAuth` 的插件在无会话时全 401，自动化验收可在无门禁实例跑，**人工交付**需登录（`/login`）或用门禁为开的 3082。

## 文档索引

| 文件 | 一句话 |
|---|---|
| [docs/index.md](docs/index.md) | 总览与文档导航（插件定位与阅读顺序） |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | 需求→决策→实现→验收追踪表（含已知取舍） |
| [docs/PROGRESS.md](docs/PROGRESS.md) | 本插件唯一进度真源 |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | 事故复盘（现象→根因→修复→教训） |
| [docs/research-sidebar-layout-2026-09-11.md](docs/research-sidebar-layout-2026-09-11.md) | 「右侧边栏内容排列方式」调研（含上游源码出处） |
| `docs/specs/002-right-sidebar-categories/` | 当前有效规格：spec（已冻结）/ plan（合约查证）/ tasks |
| `docs/specs/20260925-native-entry-ui/` | 保留官方 guide provider 完整入口 + 恢复终端 shell 下拉的修复规格 |
| `docs/prototype/` | 分类式侧边栏原型（`right-sidebar-categorized-prototype.html`、`q7-q8-explainer.html`、截图） |
| `docs/verify*/` | 历次测试实例 UI 验收截图（`verify-v08` = 35/35 那一轮） |
| [AGENTS.md](AGENTS.md) | 开发规范（SDD 流程、红线、关键契约、命令） |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录 |

## 版本号

**0.1.4**（`package.json.version` = tgz 文件名 `dsh-sidebar-hub-0.1.4.tgz`）

> 注：[CHANGELOG.md](CHANGELOG.md) 已补记 0.1.3（native-entry-ui 修复）与 0.1.4（DSH 升级漂移同步，spec 003）。

## 附：仓库与共用目录

唯一代码仓库 = `IamWWT/dsh-plugins`（private monorepo），本插件目录 `dsh-plugins/dsh-sidebar-hub/`；分支 `main`（集成）/ `ubuntu`（agent 开发）/ `windows`（用户）。遵循 [DeepSeek 共用目录约定](../dsh-agent-presets/docs/DIRECTORY-LAYOUT.md)，管理根统一写作 `<DEEPSEEK_ROOT>`（`.../deepseek/`）；历史部署记录不能视为当前机器状态。
