# AGENTS.md — dsh-sidebar-hub

本目录是自研插件 **dsh-sidebar-hub（侧边栏分类框架）** 的独立 npm 包。

**定位**：把右侧栏**起始页**换成按功能分组的分类界面：各插件入口按 **官方 → 工作台 → 工具 →
游戏** 四组归类（带语义色与图标），未登记 kind 落「其他」；分组与映射可由用户在分类页拖拽或
设置页卡片维护，配置存 DSH settings 的 `dsh-sidebar-hub` 命名空间。本插件只做**入口编排**——
终端/浏览器/Office 预览由官方内置接管，仅保留 md(mermaid) 渲染器（走官方 `documentPreviews`）；
自研内容类型已全部移除，不提供落地页。
**不是**：不接管官方文件浏览/预览、终端/浏览器/Office 预览；不做「覆盖整个浏览器的全屏」；
不是「新增一个工作台 tab 再分层」。

## 开发流程（SDD，强制）

按 [GitHub Spec Kit](https://github.com/github/spec-kit) 流程，规格在 `docs/specs/<id>/`
（当前有效：`docs/specs/002-right-sidebar-categories/spec.md`）：Specify（spec.md：需求/非目标/
验收标准）→ Clarify → Plan（host/client 划分、插槽接线、合约出处、风险）→ Tasks → Implement →
Converge（`pnpm check` + 真实实例 UI 逐条对照验收）。**规格未获用户确认前禁止进入实现。**

## 红线（违反即视为错误）

- **禁止修改 `deepseek-harness/` 源码**（只能外部 pull）；不写兼容垫片、不 monkey patch。
- **禁止接管官方文件能力**：不注册 `kind:'files'` extension 与 `dsh-resource://file/**` viewer，
  只允许 `openTab('files')` 转发入口。
- **禁止改动用户其他自研插件**：只读其引导条目（自动发现），不注册同名 kind 顶替。
- **不依赖第三方运行时**：仅剩 mermaid 管线（吸收自 better-sidebar，MIT，保留署名与来源注释）。
- **验证必须用测试实例**：`dsh-plugins/dsh-test/` + 独立 DSH_HOME + 独立端口（3084/3085）；
  **禁止**触碰 3082；测试实例用完关闭，不写开机自启。
- **client 产物必须是 closure-factory**：`__ModuleLoader__.load({id, factory})` 恰好一次、无顶层
  `import`（见 `TROUBLESHOOTING.md`）。**禁止提交 secrets**。

## 结构与命令

布局：`src/host/`（/shub 网关、`sidebar_open` + WS、settings.ts）、`src/client/`（entry.ts 接线点、
catalog/ 分类框架、SettingsCard.tsx、document/、chunks/）、`src/shared/`（分类配置纯数据）、
`build.mjs`（双端 esbuild + 产物门禁）、`cordis.patch.yml`（Host 入口）。

```bash
pnpm install   # 首次（含 devDependencies 的 @deepseek-ai/schemastery）
pnpm check     # build + typecheck + node --check + 两组冒烟（提交前必跑）
pnpm test      # client-wiring（注册恰好一次、guide chain、自动发现与映射、openTab、拖拽排序、
               #   settings 写回与恢复默认）+ host-settings（base/深合并/数组整桶替换/wire 往返）
npm pack       # 产 tgz
```

真机 UI 验收（测试实例 3085；断言含起始页=分类框架、四组归位/配色、语言与字号对齐全局、
官方入口转发、信封可解、拖拽持久化、设置卡片；跑完重启一次取新 token 链接给人看）：

```bash
node test/ui-acceptance.mjs --url "http://127.0.0.1:3085/?token=..." \
  --profile-dir <持久 Chrome 目录> --shot-dir ./docs/verify
node test/probe-tab.mjs --url "http://127.0.0.1:3085/?token=..." --kind <kind> --wait 8000  # 单 tab 排错
```

装进测试实例（禁止直接动 3082）：`cd dsh-plugins/dsh-test/deepseek-harness`，
`DSH_HOME=<独立测试 DSH_HOME> pnpm dsh web --port 3084 --no-open`，再
`pnpm dsh plugin --profile web add <本插件目录或 tgz>`。

## 关键契约（出处见 `docs/specs/002-*/plan.md` §2）

- `sidebar.right.tab.guide` 是 **chain** 槽：注册需 `select`（首个返回非 `null` 者接管），纯函数、
  返回稳定引用；自动发现用 `ctx.sidebarRightTabs.guide()` → `{kind, order, title()}[]` + `subscribe()`；
  打开用 `ctx.sidebarRight.openTab(kind)`（未注册会抛）。
- 配置：host `ctx.settings.register(ns, schema, { base })`（第三参是 **options**）；client
  `ctx.settingsScope.bind({namespace})` → `getSnapshot / subscribe / mutate / unset`。
- settings 对普通对象**深合并**、数组**整桶替换** ⇒ 清空字段要写显式 `''`，不能删键（否则出厂
  规则复活）。
- `hooks` 格的钩子必须带 selector（`useCatalog(selector, isEqual?)`），无参调用抛 `is not a function`；
  面板是块级滚动容器，用 `height:100%` 撑满。
- `PROTECTED_GROUP_IDS` / `RENAME_LOCKED_GROUP_IDS`：四组不可删、官方不可改名，**store 层兜底
  拒绝写入**。
- 语言只取 `document.documentElement.lang`（`body[data-ds-lang]` 是第三方私有约定，勿用），经
  `ctx.locale` 暴露；**语言要进快照签名**，否则切语言不重渲染。
- 样式只用 token：字号 `--dsw-font-*`；上色用 `--dsw-alias-state-{business,success,warn,error}-primary`
  （`--dsw-alias-brand-primary` 浅色下是墨色，勿当"蓝色"用）；色调表见 `shared/catalog-config.ts`。
- 设置卡片需自写 `<li>` + 折叠按钮（框架不导出 `PluginCard`，照
  `ui-settings-plugins/PluginCard.module.css`）。
- `/shub/api` 信封由 host `wire.ts: writeOk` 写 `{ok:true, value}`；网络面仅 `/shub/file`（md 图片）与
  `/shub/bundle`（mermaid chunk）。
- 无门禁实例 ≠ 环境可用：读 `dshAuth` 的插件无会话时全 401；人工交付需登录态或 3082。
- 机器相关配置在 profile 层 patch（`modelDir` 等由 `cordis.patch.yml` 提供）；迁移 DSH_HOME 时除
  bundles 还要带 `cordis.patch.yml` 与 `profiles/web/data/<plugin>/`。
- list 槽注册必须带 `id`。

## 文档同步

- 功能/架构/决策变更 → 同步 `docs/index.md`、`docs/REQUIREMENTS.md`、`docs/specs/<id>/*`。
- 踩坑/事故 → 追加 `docs/TROUBLESHOOTING.md`（现象 → 根因 → 修复 → 教训）。
- README 只描述当前行为，历史决策留 docs；通用规则见 `../AGENTS.md` 与 `../../AGENTS.md`。
