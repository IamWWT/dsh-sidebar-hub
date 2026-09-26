# AGENTS.md — dsh-sidebar-hub

本目录是自研插件 **dsh-sidebar-hub（侧边栏分类框架）** 的独立 npm 包。

**它做什么**：把**打开右侧栏后看到的起始页**换成按功能分组的分类界面——各插件入口（自研三大工作台、语音转文字/转语音、官方 Files 等）按 **官方 → 工作台 → 工具 → 游戏** 分组（v0.8 起四组）（每组带语义色与条目图标块），未登记的 kind 自动落「其他」；分组与映射可由用户在分类页拖拽或设置页卡片维护，配置存在 DSH settings 的 `dsh-sidebar-hub` 命名空间。

**它同时提供**：官方能力交还后的**入口编排**——终端（v0.2）、浏览器（v0.5）、Office 预览（v0.7）均由官方内置接管（`kind='terminal'`/`kind='browser'` 归「官方」组；docx/pptx/xls/xlsx 走官方 office-to-pdf）；**md(mermaid) 渲染器保留**（v0.3：md 接管 + mermaid 图 + md 内本地图片，走官方 `documentPreviews` 扩展点）。**v0.6 起 hub 自研内容类型全部移除**（任务/Subagent/Git/文件变动），本插件只做分类编排，不提供落地页。

**它不是**：不是「新增一个工作台 tab 再在里面分层」；不接管官方文件的浏览与预览；不接管官方终端（UI 与模型 `terminal_*` 工具均由官方提供）、官方浏览器与 Office 预览；不提供「覆盖整个浏览器的全屏」（那是 DSH WEB 应用层能力）。

## 开发流程（SDD，规格驱动开发，强制）

按 [GitHub Spec Kit](https://github.com/github/spec-kit) 的 SDD 工作流执行，每份规格在 `docs/specs/<id>/` 下：

1. **Specify** — 写 `spec.md`（需求、非目标、验收标准、分类设计、验证方式；当前有效规格：`docs/specs/002-right-sidebar-categories/spec.md`）。经用户确认后才可进入下一步。
2. **Clarify** — 与用户澄清歧义：范围边界、吸收方式、命名、卸载时机等决策点，结论回写 spec。
3. **Plan** — 写 `plan.md`：技术架构（host/client 划分、插槽接线、状态模型、数据通道）、合约查证（逐条记录源码出处）、风险。
4. **Tasks** — 写 `tasks.md`：把 plan 拆成可独立验收的任务（每任务：改动文件、done 定义、如何验证）。
5. **Implement** — 按任务顺序实现，一个逻辑改动一个 commit。
6. **Converge** — 逐条对照 spec 验收标准收敛：`pnpm check` 通过 + 真实实例 UI 验证，必要时回改文档并记录。

**规格未获用户确认前，禁止进入实现阶段。**

## 红线（违反即视为错误）

- **禁止修改 `deepseek-harness/` 源码**（只能外部 pull 更新）。
- **不依赖第三方运行时**：v0.6 起 hub 自研内容类型全部移除，仅剩 mermaid 渲染管线（v0.3 吸收，MIT）——保留 `LICENSE` 署名与吸收来源注释；不再从第三方（如 `dsh-plugins/github/DSH-better-sidebar/`）拷贝新代码。
- **禁止接管官方文件能力**：不注册 `kind: 'files'` 的 extension，不注册 `dsh-resource://file/**` 的 viewer（`editor` 类）。官方 Files 树/文本预览保持原样，只允许 `openTab('files')` 转发入口。
- **禁止改动用户其他自研插件**（个人/故障排查/交易工作台、语音转文字/转语音）：只读它们的引导条目（自动发现），不注册同名 kind 顶替。
- **验证必须用测试实例**：`dsh-plugins/dsh-test/` + 独立 DSH_HOME + 独立端口（如 3084/3085）。**禁止** `systemctl --user restart dsh-dev-web` 或触碰 3082；测试实例不写开机自启，用完关闭。
- **禁止提交 secrets**：.env / API key / settings 敏感信息不入 git。
- **client 产物必须保持 closure-factory**：`window.__ModuleLoader__.load({id, factory})` 恰好一次、无顶层 `import`（见 `TROUBLESHOOTING.md` 的两起 bundle 事故）。

## 目录结构

```
AGENTS.md                 本文件（开发规范）
package.json              "type":"module"；main→dist/index.js；exports 含 "./client"；dsh.client.*
tsconfig.json / build.mjs esbuild 双端打包（host ESM；client CJS + closure-factory 包裹）
cordis.patch.yml          注册 Host 入口（webServer 路由等）
src/host/                 Node 侧：/shub 网关、agent-opens（sidebar_open 工具 + WS）、fs、
                          session-cwd、trust-fence、settings.ts（分类配置命名空间）。
                          终端/浏览器/Office 自 v0.2/v0.5/v0.7 起交还官方；git/jobs/subagents
                          自 v0.6 起随自研内容类型移除
src/client/               浏览器侧：
  entry.ts                  唯一接线点（分类起始页 + 设置卡片 + md 文档渲染器；v0.6 起无 hub-* 类型/正文）
  catalog/                  分类框架：mapping.ts（解析）/ CatalogFramework.tsx（UI + 拖拽）/
                            config-store.ts（配置唯一写入口）/ catalog.css
  settings/SettingsCard.tsx 设置页卡片（表单式维护映射，挂官方 `plugins.bundle.config`）+ settings.css
  document/                 documentPreviews 扩展渲染器：markdown-body（mermaid/本地图片）；
                            office-body 自 v0.7 起移除（官方内置 Office 预览）
  chunks/                   惰性 chunk 入口：mermaid.tsx（office.tsx 自 v0.7 起移除）
  chunk-loader.ts           惰性 chunk 加载器（/shub/bundle/<name>.js + 模块表 externals）
  hub-font.css              body 级字号刻度（跟随官方 --dsh-content-font-size）
  theme.ts                  prefers-color-scheme 读取（mermaid 主题跟随）
  locales.ts                本插件文案（zh/en）；样式一律 --dsw-* token
src/shared/                host 与 client 共享的纯数据模型（分类配置 + 出厂映射 + 命名空间常量）
docs/                      文档：index.md（总览）+ REQUIREMENTS.md（追踪表）+
                           TROUBLESHOOTING.md（事故复盘）+ specs/<id>/*.md（SDD 产物）
test/                      冒烟测试（见下）
LICENSE                    吸收来源 better-sidebar 后保留其 MIT 署名
```

## 常用命令

```bash
pnpm install                       # 首次（含 devDependencies 的 @deepseek-ai/schemastery）
pnpm check                         # build + typecheck + node --check + 两组冒烟（提交前必跑）
pnpm test                          # 只跑冒烟：
#   test/client-wiring.smoke.mjs   跑 dist/client.js：工厂注册恰好一次、v0.6 起无 hub-* 类型/正文、
#                                  guide chain、自动发现与映射（官方 terminal/browser 转发、
#                                  数独归游戏组）、点条目 openTab、拖拽跨组与组内排序、
#                                  settings 写回（含「移入其他写空串」）、恢复默认 unset、设置卡片表单
#   test/host-settings.smoke.mjs   用真实 schemastery 验证 schema：出厂 base、深合并、数组整桶替换、
#                                  默认值补齐、wire envelope（toJSON → new Schema）往返
npm pack                           # 产 tgz
```

排查单个 tab 报错（抓 DOM 文案 + 4xx/5xx 请求 + 控制台，一次看全）：

```bash
node test/probe-tab.mjs --url "http://127.0.0.1:3085/?token=..." --kind troubleshoot-workbench --wait 8000
```

真机 UI 验收（测试实例；会消费该实例的 token，故跑完再重启一次取新链接给人看）：

```bash
node test/ui-acceptance.mjs --url "http://127.0.0.1:3085/?token=..." \
  --profile-dir <持久 Chrome 目录> --shot-dir ./docs/verify
# 35 条断言：起始页=分类框架、四组归位+顺序+配色、**文案语言与全局一致**、**字号对齐全局尺度**、
# 官方终端/浏览器/文件转发可打开、语音转文字环境就绪、/shub/api 信封可解、
# 拖拽持久化、设置卡片（官方「插件」面板内 / 折叠 / 改归属 / 隐藏 / 恢复）、无未捕获异常
```

装进**测试实例**（禁止直接动 3082）：

```bash
cd dsh-plugins/dsh-test/deepseek-harness
DSH_HOME=<独立测试 DSH_HOME> pnpm dsh web --port 3084 --no-open
DSH_HOME=<独立测试 DSH_HOME> pnpm dsh plugin --profile web add <本插件目录或 tgz>
```

## 关键契约（改代码前先看；出处见 `docs/specs/002-*/plan.md` §2）

- 起始页替换：`sidebar.right.tab.guide` 是 **chain** 槽，注册需 `select`（首个返回非 `null` 的接管）；`select` 必须纯函数且返回稳定引用。
- 自动发现：`ctx.sidebarRightTabs.guide()` 返回 `{kind, order, title(), description?()}[]`（按 order 排序）；`subscribe()` 可观察注册表变更（其它插件后注册的入口也会进分类）。
- 正文挂载（历史契约，v0.6 起 hub 无正文）：`ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({name, key: <类型 id>, inject}, Component))`。
- 打开内容：`ctx.sidebarRight.openTab(kind)`（未注册的 kind 会抛，需 catch 并给诊断）。
- 配置持久化：host `ctx.settings.register(ns, schema, { base })`（第三个参数是 **options**！），client `ctx.settingsScope.bind({namespace})` → `getSnapshot / subscribe / mutate / unset`。
- 合并语义：settings 对普通对象**深合并**、对数组**整桶替换** ⇒「清空字段」必须写显式空值（`''`），不能删键（否则 base 出厂规则复活）。
- **`hooks` 格的钩子必须带 selector 调用**：`hooks: {catalog: source}` 在组件侧是
  `useCatalog(selector, isEqual?)`（uSES 绑定，selector 必填）。无参调用 = 框架内部
  `sel(snapshot)` 抛 `is not a function`，整个 tab body 崩。
- **宿主面板是块级滚动容器**：`ui-dockkit` 的 `paneBody` 无 `display:flex`，分类框架用
  `height:100%` 撑满（正文 `.hubTabFill` 契约随 v0.6 无正文而失效）。
- **默认四组不可删除、官方不可重命名**：`PROTECTED_GROUP_IDS`（官方/工作台/工具/游戏，
  v0.8 起删工程与任务）与 `RENAME_LOCKED_GROUP_IDS`（仅官方）在 `shared/catalog-config.ts` 定义；
  **store 层兜底拒绝写入**（防绕过），UI 层隐藏按钮；用户新建分组不受限。
- **语言只能读框架那个来源**：框架把当前语言写在 `document.documentElement.lang`
  （历史参照曾用 `body[data-ds-lang]`，那是第三方私有约定、官方没有），并通过 `ctx.locale` 暴露
  `getSnapshot().active` + `subscribe`。做法：`ctx.inject(['locale'])` → `setActiveLocale(...)`，
  取值链 locale 服务 → documentElement.lang → body → navigator；**语言要放进快照签名**，
  否则切语言不会触发重渲染。
- **字号也用 token**：`--dsw-font-{xxxs-11,xxs-12,xs-13,s-14,base-16,...}`；面板正文尺度 16/14/13，
  别用 11/12px 把界面显得比全局小。
- **上色只用语义色 token**：`--dsw-alias-state-{business,success,warn,error}-primary` 才是
  有明确色相的四个；`--dsw-alias-brand-primary` 在浅色主题解析为**墨色**
  （`--dsw-static-neutral-bluish-1000`，见 `ui-theme/src/styles/design-platform.css`），
  拿它当"蓝色"会得到一个近黑的分组色。分组色调表见
  `shared/catalog-config.ts` 的 `GROUP_TONES`。
- **设置卡片要复刻框架卡片**：框架不导出 `PluginCard`，第三方插件必须自己写同样的
   `<li>` 卡片 + 头部折叠按钮（照 `ui-settings-plugins/PluginCard.module.css` 或
  `dsh-global-auth/src/client/css.ts` 的 `.dga-card*` 抄），否则在插件列表里长相不一致。
- **`/shub/api` 信封两端各一处**：host（`wire.ts: writeOk`）写 `{ok:true, value}`。
  v0.6 起 hub 无 client API 层（terminal-api 随自研内容类型移除），剩余网络面仅
  `/shub/file`（md 图片）与 `/shub/bundle`（mermaid 惰性 chunk）。
- **验收环境关掉首页门禁 ≠ 环境可用**：任何读 `dshAuth` 的插件（如故障排查工作台的自有 API）
  在无会话时全是 401（表现为「未登录或会话已失效」）。自动化验收可在无门禁实例上跑，
  但**人工交付**要么登录（`/login`），要么用门禁为开的实例（3082）。
- **机器相关配置在 profile 层 patch**：插件自带 config 不含绝对路径（`modelDir` 等由
  `<DSH_HOME>/profiles/web/cordis.patch.yml` 提供，安装脚本写入）。新建/迁移 DSH_HOME 时，
  除 bundles 外还要带 `cordis.patch.yml` 与 `profiles/web/data/<plugin>/`，否则插件会"环境未就绪"。
- **list 槽注册必须带 `id`**：`sidebar.footer.action` 等 list 槽的 `register()`
  缺 `options.id` 会抛 `list slot ... requires options.id`。

## 文档同步

- 功能/架构/决策变更 → 同步 `docs/index.md`、`docs/REQUIREMENTS.md`、对应 `docs/specs/<id>/*`。
- 踩坑与事故 → 追加 `docs/TROUBLESHOOTING.md`（现象 → 根因 → 修复 → 教训，禁止只写「已修」）。
- README 只描述当前行为；历史决策留在 docs。
- 产品行为、构建、测试覆盖严格遵循根目录 `AGENTS.md` 与 `deepseek-harness/` 的开发规范（esbuild、dsh.client、Cordis 插件体系）。
