# dsh-sidebar-hub — 分类式侧边栏工作台
> ## ⚠️ 已归档（Archived，2026-10-24）
>
> **归档原因**：其所承载的「游戏」分组入口指向的游戏插件（扫雷/数独）已于 2026-10-24 全部归档，分类入口失去对象，用户决定一并卸载。
>
> **状态**：本仓为只读归档，不再维护。源码于 2026-10-24 从 `dsh-plugins` 工作区移出、独立成仓，
> 保留完整提交历史，定格在 **0.1.8**。`docs/` 中原本指向 dsh-plugins 工作区的跨仓相对链接保持原样，
> 可能已失效。


## 一句话定位

把**打开右侧栏后看到的起始页**换成按功能分组的分类界面：各插件入口按 **官方 → 工作台 → 工具 → 游戏** 四组归类，分组与映射由用户在分类页拖拽或设置页卡片维护，配置存 DSH settings 的 `sidebar-hub` 命名空间（= profile 条目 `id`，非包名）。本插件**只做入口编排**，不提供落地页。

## 当前能力清单

**分类框架**

- 接管 `sidebar.right.tab.guide`（chain 槽，起始页替换）：条目按四组归位，每组带语义色左条/圆点，条目带首字图标块；未登记的 kind 自动落「其他」。
- **可维护**：分类页拖拽（跨组移动、组内排序、新建/重命名/删除/折叠/恢复默认）+ 官方「插件」面板里的「右侧栏分类」配置卡片（`plugins.bundle.config`），两处共用同一份配置。
- 默认四组不可删除、官方组不可重命名（`PROTECTED_GROUP_IDS` / `RENAME_LOCKED_GROUP_IDS`，store 层兜底拒绝写入，UI 隐藏按钮）；用户新建分组不受限。
- **配置持久化**：DSH settings 命名空间 `sidebar-hub`（= profile 条目 `id`，全局一份；卡片 key 另用包名 `SETTINGS_CARD_KEY`）；client 经 `ctx.configForms.get('sidebar-hub')` 绑定，settings 不可用时退内存态并在分类页标「未持久化」。
- 自动发现其它插件的引导条目（`ctx.sidebarRightTabs.guide()` + `subscribe()`），后注册的入口也会进分类。

**官方能力交还 / 自研保留**

- 终端、浏览器、Office 预览均由**官方内置**接管（`kind='files'` / `kind='terminal'` / `kind='browser'` 在出厂映射里**显式**归「官方」组；v0.1.5 起不做任何官方性推断、也不再有「官方」角标，条目出现与否由官方 guide 入口决定；doc/docx/xls/xlsx/ppt/pptx 走官方 office-to-pdf），本插件只转发入口，不接管、不替换。
- **保留 md(mermaid) 渲染器**（走官方 `documentPreviews` 扩展点）：md 接管 + mermaid 图 + md 内本地图片（官方仍无 mermaid），经 `/shub/bundle` 惰性 chunk 加载。
- 字号跟随官方「设置 → 通用设置 → 字号」（`--hub-font-*` 偏移刻度）；文案 zh/en，语言取 `document.documentElement.lang`（经 `ctx.locale`）。
- hub 自研内容类型（任务/Subagent/Git/文件变动）已全部移除，仅保留上述入口编排与 md 渲染。

**宿主面**

- `/shub/api/<method>` JSON 网关（POST，`{ok:true, value}` 信封，session/fs 基础）+ `/shub/file`（md 图片）+ `/shub/html`（沙箱 HTML 预览，host 侧保留、当前 client 未调用）+ `/shub/upload` + `/shub/bundle/<name>.js`（惰性 chunk）+ `/shub/ws/agent-opens`（`sidebar_open` 推送），全部前置信任围栏（`isTrustedApiRequest` + `ctx.webStartup.trustedHosts`）。
- client 产物为 closure-factory（`window.__ModuleLoader__.load({id, factory})` 恰好一次，无顶层 `import`）。

**明确不做**

- 不接管官方文件浏览/预览（不注册 `kind:'files'` extension 与 `dsh-resource://file/**` viewer，只允许 `openTab('files')` 转发）；不接管官方终端/浏览器/Office 预览；不提供「覆盖整个浏览器的全屏」（那是 DSH WEB 应用层能力）；不改动其它自研插件。

## 安装

一律 **tgz 安装**（无 link 安装）：

```bash
cd dsh-plugins/dsh-sidebar-hub
pnpm check && pnpm pack        # 产出 dsh-sidebar-hub-0.1.8.tgz

cd ../../deepseek-harness
DSH_HOME=~/.dsh-dev pnpm dsh plugin --profile web add \
  /home/wwt/Downloads/aigc/proj/deepseek/dsh-plugins/dsh-sidebar-hub/dsh-sidebar-hub-0.1.8.tgz
```

- 装完核对 `~/.dsh-dev/profiles/web/node_modules/dsh-sidebar-hub/dist` 真实存在。
- **重打包必须升版本号**（同版本 pnpm 按 integrity 判「已最新」，不重解压 → 缺 `dist/` 启动即报错）。
- Ubuntu 上 `dsh` 不在 PATH：用 harness 根的脚本 `pnpm dsh`，或显式 `DSH_CLI=<cli 绝对路径>`（`ops/linux/install-plugin.sh <tgz> --apply` 即此封装）。
- 重启 3082 **需用户同意**：`systemctl --user restart dsh-dev-web`（Ubuntu 现为 systemd 单元 `dsh-dev-web` 监听 127.0.0.1:3083 + `dsh-web-relay` 在 0.0.0.0:3082 做纯 TCP 转发）；windows-lite 托盘退出后重开桌面应用。
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
- `test/host-settings.smoke.mjs`：用真实 schemastery 验证 schema——命名空间 = profile 条目 id（`sidebar-hub`）、出厂 base、深合并、数组整桶替换、默认值补齐、volatile 字段投影、wire envelope 往返。
- **真机 UI 验收**（测试实例，会消费该实例 token，跑完重启一次取新链接）：

```bash
node test/ui-acceptance.mjs --url "http://127.0.0.1:3085/?token=..." \
  --profile-dir <持久 Chrome 目录> --shot-dir ./docs/测试/证据/verify-<版本>
```

- 单个 tab 报错排查（抓 DOM 文案 + 4xx/5xx 请求 + 控制台）：

```bash
node test/probe-tab.mjs --url "http://127.0.0.1:3085/?token=..." --kind trading-workbench --wait 8000
```

## 环境支持矩阵

| 环境 | 支持度 | 验证状态 |
|---|---|---|
| `ubuntu-4090`（源码树 tsx 直跑；`dsh-dev-web` 单元 127.0.0.1:3083 + `dsh-web-relay` 0.0.0.0:3082 纯 TCP 转发；验证用测试实例 3084/3085） | 全量 | 0.1.8 复验 = `pnpm check` 全绿（见 CHANGELOG）；最近一轮测试实例 UI 验收 **35/35**（截图 `docs/测试/证据/verify-v08/`，v0.7–v0.8 时期）；3082 始终未碰 |
| `windows-lite`（官方桌面版 profile `desktop`，无 systemd） | 全量 | 本插件无本地模型 / 数据库 / Python 依赖，行为一致；**本版实机验收未记录 → 未在 Windows 实测** |

- 环境差异走配置键（本插件配置 = DSH settings 命名空间 `sidebar-hub`，全局一份），不做 OS 探测分支；`systemctl` 与 Bash 命令仅适用于 `ubuntu-4090`。
- 无门禁实例 ≠ 环境可用：读 `dshAuth` 的插件在无会话时全 401，自动化验收可在无门禁实例跑，**人工交付**需登录（`/login`）或用门禁为开的 3082。

## 文档索引

| 文件 | 一句话 |
|---|---|
| [docs/README.md](docs/README.md) | 总览与文档导航（按工程阶段组织） |
| [docs/FILE_INDEX.md](docs/FILE_INDEX.md) | 全插件文档的唯一导航索引 |
| [docs/需求/BRD-业务需求说明书.md](docs/需求/BRD-业务需求说明书.md) | 需求→决策→实现→验收追踪表（含已知取舍） |
| [docs/需求/BRD-002-right-sidebar-categories.md](docs/需求/BRD-002-right-sidebar-categories.md) | 分类框架规格（需求已冻结，含 v0.2–v0.9 增补验收） |
| [docs/需求/BRD-003-upgrade-drift-sync.md](docs/需求/BRD-003-upgrade-drift-sync.md) | 升级漂移同步规格（R1–R4，含 v0.1.5 / v0.1.7 修订） |
| [docs/管理/PP-项目计划.md](docs/管理/PP-项目计划.md) | 本插件进度真源（中断点 + 历史沿革） |
| [docs/管理/RMP-风险管理.md](docs/管理/RMP-风险管理.md) | 事故复盘档案（现象→根因→修复→教训） |
| [docs/管理/PP-002-right-sidebar-categories-计划.md](docs/管理/PP-002-right-sidebar-categories-计划.md) 等同 id 文件 | 规格的实施计划与任务清单（`PP-002-*` / `PP-003-*` / `PP-20260925-*`） |
| [docs/分析/DAS-侧栏布局调研-20260911.md](docs/分析/DAS-侧栏布局调研-20260911.md) | 「右侧边栏内容排列方式」调研（含上游源码出处） |
| [docs/设计/原型/](docs/设计/原型) | 分类式侧边栏原型（`right-sidebar-categorized-prototype.html`、`q7-q8-explainer.html`、截图） |
| [docs/测试/证据/](docs/测试/证据) | 历次测试实例 UI 验收截图（`verify-v08` = 35/35 那一轮） |
| [docs/glossary.md](docs/glossary.md) | 术语表 |
| [AGENTS.md](AGENTS.md) | 开发规范（SDD 流程、红线、关键契约、命令） |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录 |

## 版本号

**0.1.8**（`package.json.version` = tgz 文件名 `dsh-sidebar-hub-0.1.8.tgz`）

> 注：[CHANGELOG.md](CHANGELOG.md) 详见 0.1.3–0.1.6（修复/漂移/纠正/归组）、0.1.7（settings 契约适配）与 0.1.8（`webRuntime` → `webStartup` 服务迁移）。

## 附：仓库与共用目录

唯一代码仓库 = `IamWWT/dsh-plugins`（private monorepo），本插件目录 `dsh-plugins/dsh-sidebar-hub/`；分支 `main`（集成）/ `ubuntu`（agent 开发）/ `windows`（用户）。遵循 DeepSeek 共用目录约定（见 dsh-agent-presets: `docs/DIRECTORY-LAYOUT.md`），管理根统一写作 `<DEEPSEEK_ROOT>`（`.../deepseek/`）；历史部署记录不能视为当前机器状态。
