# TROUBLESHOOTING — dsh-sidebar-hub

> 现象 → 根因 → 修复 → 教训。随事故补充。
> 注：本文件是**历史事故档案**——各条目反映事故发生时的代码形态；其中涉及的自研内容类型（终端/浏览器/任务/Subagent/Git/文件变动/Office 渲染）已随 v0.2–v0.7 交还官方或移除，对应条目仅作复盘参考，不代表当前代码结构。

## 2026-09-12：临时实例 `/shub/api/*` 全部 400 空 body

**现象**：独立临时实例（DSH_HOME 工作区内 + 端口 3084）中，任何 `/shub/api/<method>` 请求（含未注册方法）都返回 `400 Bad Request` 空 body。

**排查链**（逐步排除）：
1. 服务启动成功、bundle 全解析（`resolveBundleDir` 对 dsh-sidebar-hub 通过）→ 插件被 profile 接受。
2. host `apply` 加日志 → `[sidebar-hub] host apply` 打印 → 插件执行。
3. `registerHubRoutes` 前后加日志 → `routes registered` → 路由注册成功。
4. 网关入口加日志 → `gateway hit POST /shub/api/shell.get` → 网关被命中。
5. 网关 catch 分支无输出 → 异常发生在 **try 之外**（fence 调用处）。
6. 源码定位：webserver 兜底 `handle() reject → 400`（packages/host/webserver/src/index.ts），确认 400 来自 handler 抛错。

**根因**：`fence(req)` 内访问 `ctx.webRuntime.trustedHosts`——`webRuntime` 未在插件的 `export const inject` 声明。Cordis 上下文是 Proxy：**未声明 inject 的属性直接访问会抛 `cannot get property ... without inject`**（不返回 undefined）。fence 在网关 try/catch 之外 → handler reject → webserver 兜底 400 空 body（异常被吞，只在 logger.warn）。

**后续同类**：`sessionCwdOf` 访问 `ctx.sessions` 同样报 `cannot get property "sessions" without inject`。

**修复**：`inject = ['webServer', 'webRuntime', 'sessions']`（AGENTS.md 工程规范早有此条——"Host 侧凡在 apply/路由里直接 ctx.xxx 取用的服务，必须写 inject"；吸收代码时漏了这两处）。

**验证**：`shell.get` / `terminal.deps` / `fs.tree` / `git.status` / `changes.ops` 全部返回 `{"ok":true,...}`。

**教训**：
- 从 better-sidebar 拷贝 host 代码时，其 `Context` 类型面把 `webRuntime`/`sessions` 声明为必选属性，掩盖了 Cordis proxy 的 inject 要求；自研精简 types.ts 后必须逐服务核对 `inject` 声明。
- 400 空 body 是 dsh webserver 兜底（handler reject）的典型信号，**不是**路由未注册（那是 404）也不是 SPA fallback（那是 405/200）。定位时先加网关入口与 catch 日志二分。

## 2026-09-12：临时 profile 构建

**现象**：临时 profile `pnpm install` 失败：`@deepseek-ai/dsh-tools@>=0.1.0` 无匹配版本（npm 上仅 alpha/rc 预发布）。

**根因**：pnpm 不自动用 pre-release 满足 range；`@deepseek-ai/*` 的 peer/依赖 range 指向未发布稳定版；且 pnpm 11 的 `pnpm.overrides` 需放 `pnpm-workspace.yaml`（package.json 的 `pnpm` 字段不再读取）。

**解决**：复用 dev profile 的 `node_modules`（复制 + 重建相对 symlink 为绝对路径 + 手动 link 插件源码目录），绕过全新 install。教训：临时实例应复制成熟 profile 的依赖树，而不是从零 install @deepseek-ai 预发布包。
## 2026-09-12：临时实例 client bundle "loaded without registering @deepseek-ai/dsh-typert-registry"

**现象**：3084 页面 `HARNESS Failed to load plugins`，报 `client-modules: bundle /plugins/??…&rev=… loaded without registering "@deepseek-ai/dsh-typert-registry" via __ModuleLoader__.load`。

**根因**：dsh 的 client bundle 加载器用 **classic `<script>`**（`ClientModuleSystem.defaultLoadBundle` → `document.createElement('script')`，非 `type=module`），client bundle 必须是 **closure-factory**：`window.__ModuleLoader__.load({id, factory:(require)=>{…}})`，externals 经 factory 的 `require` 解析（模块表 CJS 模型，无 import map）。我们的 build.mjs client 之前用了 `format:'esm'`（顶层 `import react`/`@deepseek-ai/*`）——ESM 顶层 import 在 classic script 里是语法错误，导致合并 bundle 整体解析失败、所有包（含第一个 typert-registry）都未注册。

**修复**：client 改为 `format:'cjs'`（externals → `require`），产物包裹成 `__ModuleLoader__.load({id:'dsh-sidebar-hub', factory:(require)=>{…CJS…}}) `；CSS 经 esbuild plugin 转为 `<style>` 副作用模块（factory 执行时注入）。对齐官方 `packages/client/tsdown.client.ts` 的 closure-factory 预设与 better-sidebar `lib/client.js` 头部形态。

**验证**：`dist/client.js` 顶层 import 语句 = 0；含 `__ModuleLoader__.load` 与 `factory(require)`；`node --check` 通过。

**教训**：dsh client bundle 的模块解析是 **CJS require（模块表）**，不是 ESM import map——新插件 client 构建必须产出 closure-factory（tsdown 预设或等效的 cjs+包裹），不要用 esbuild `format:'esm'` + external 的"模块表 import map"假设。

## 2026-09-12：`duplicate factory registration for "dsh-sidebar-hub"`

**现象**：修复首次 bundle 格式后，页面报 `client-modules: duplicate factory registration`。

**根因**：`src/client/entry.ts` 自己调用了一次 `__ModuleLoader__.load`，而 `build.mjs` 的 CJS closure-factory 包装层又调用了一次；factory 物化时内层注册再次执行，产生同一 id 的 duplicate factory。

**修复**：entry 改为普通模块逻辑 + ESM 导出 `name/inject/apply`；由 build.mjs 唯一负责 `__ModuleLoader__.load({id, factory})` 包装。

**验证**：`dist/client.js` 中 `__ModuleLoader__.load` 出现次数为 1；用 mock `window/document/require` 执行 factory 后导出 keys 为 `apply/inject/name`。

## 2026-09-13：`@deepseek-ai/schemastery` 依赖拿不到（pnpm store 只读）

**现象**：host `settings.ts` `import z from '@deepseek-ai/schemastery'` → `tsc` 报 `TS2307: Cannot find module`；`pnpm install` 想装该 dev 依赖时失败：`EROFS: read-only file system, symlink … -> ~/.local/share/pnpm/store/v11/projects/…`。

**根因**：本机 pnpm store（`~/.local/share/pnpm`）处于只读沙箱，无法为新增依赖写链接条目；而 `@deepseek-ai/schemastery` 只存在于目标 profile（`~/.dsh-dev/profiles/web/node_modules/@deepseek-ai/schemastery`，3.18.2），不在插件自己的 `node_modules`。

**修复（两步，都已落地）**：
1. `package.json` 的 devDependencies 声明 `@deepseek-ai/schemastery`（`>=3.18.0 <4.0.0-0`）——有写权限的机器 `pnpm install` 即可。
2. 本机临时用 profile 那份做开发期解析：
   `ln -sfn ~/.dsh-dev/profiles/web/node_modules/@deepseek-ai/schemastery node_modules/@deepseek-ai/schemastery`
   （`node_modules` 在仓库内，`pnpm install` 之后会被正规链接替换。）

**运行时不受影响**：host 产物把 `@deepseek-ai/*` 保持 external，解析的是目标 profile 自带的那份。

**教训**：DSH 插件的 `@deepseek-ai/*` 运行时依赖来自 profile、不进 bundle；开发期类型解析受限时不要写"猜的" ambient 声明（第一版曾用最小 ambient 声明，随后发现它掩盖了真实类型：schemastery 的 `z.string()` 推断为**必填** `string`、`.default()` 才让字段可选，导致 schema 的 base/默认值类型全错）。**能用真实类型就必须用真实类型**，拿不到时应在文档里明确"这是权宜"，并用真实 schema 的行为测试兜住（见 `test/host-settings.smoke.mjs`）。

## 2026-09-13：分类配置写入路径的三个坑

**现象/根因**（冒烟测试先暴露，避免上线才踩）：

1. **settings 读回值是「已解析」的完整桶**，不是 user 层 diff。`mergeLayers` 对普通对象**深合并**、对数组**整桶替换**（`packages/settings/settings/src/index.ts:287`）：所以 `entries`/`order` 这类字典缺键时继承 base 的出厂映射，`groups` 这种数组则被整桶替换。据此定下写策略：client 一律**整桶写**（`mutate([{op:'set',path:['groups'|'entries'|'order']}])`），一条映射的改动也只写它所属的桶；「恢复默认」用 `unset` 三个桶回落 base，而不是写回一份拷贝。
2. **`settings.register(ns, schema, options)` 第三个参数是 options 对象**（`{ base }`），不是 base 本身。传错时 base 不生效，schema 的 `.default()` 顶上来，出厂映射会静默丢失。
3. **"清空一个字段"必须写空值，不能删键**。深合并意味着"键缺席"= 继承 base：把条目移到「其他」如果只是删掉 `groupId`，写出去后 base（出厂分类）的同名规则会「复活」，条目又回到出厂分组。因此 client 写 `entries` 时统一转成**字段齐全的存储形态**（`groupId: ''` / `label: ''` / `hidden: false` 表示"未设置"），见 `config-store.ts` 的 `toStoredEntries()`。

**教训**：写 settings 前先读 `register/resolve/mergeLayers` 三处源码，别按直觉传参；数组与字典的合并语义不同，配置模型要按这个语义设计（本插件把「分组列表」和「映射表」分成两个桶正是为此），并且"写稀疏值"在深合并语义下是错的——**要么不写这个键，要么写一个显式的空值**。上述结论都用真实 schema 测了一遍：`test/host-settings.smoke.mjs`（深合并保留出厂规则、数组整桶替换、wire envelope 往返）与 `test/client-wiring.smoke.mjs`（移入「其他」写空串）。

## 2026-09-13：真实实例验收暴露的三个真问题（冒烟测试全绿却全崩）

**背景**：自测 `pnpm check` 全绿（含模拟框架装配的冒烟），一上真实实例（3085）打开右侧栏就是 `slot entry crashed in 'sidebar.right.tab.guide': TypeError: l is not a function`，26 条 UI 断言只过 3 条。

**根因与修复**：

1. **inject 的 `hooks` 格是 uSES 选择器钩子，selector 是必填参数。**
   `ui-renderer/src/client/bind.ts` 的 `bindSnapshotSelector` 返回
   `function useSelector(sel, eq?) { return useSyncExternalStoreWithSelector(subscribe, getSnapshot, undefined, sel, eq) }`
   —— `sel` 会被直接调用。我按"无参 hook"写（`useCatalog()`、`useSessions()`），于是框架内部 `sel(snapshot)` 抛 `is not a function`。
   **修复**：所有 `hooks` 格钩子都以选择器调用（`useCatalog(v => v)`、`useSessions(v => v)`），并把 props 类型改成
   `SelectorHook<T> = <S>(select: (value: T) => S, isEqual?) => S`。
   **冒烟测试已补回归门禁**：`useSessions` 桩失败即断言（selector 必须是函数）。

2. **框架的 `paneBody` 是块级滚动容器，子元素的 `flex:1` 不生效。**
   `ui-dockkit` 的 `.paneBody { flex: 1 1 auto; min-height: 0; overflow: auto }` —— 是 **block**（没有 `display:flex`），
   而我们六个正文都沿用 better-sidebar 的 `flex:1` 假设 → 内容自我收缩（任务管理视图只有 39px 高，终端/浏览器全靠内容自撑）。
   **修复**：新增 `.hubTabFill { height: 100%; display: flex; flex-direction: column }` 外壳包住六个正文，
   分类页 `.hubCatalog` 也从 `flex:1` 改为 `height:100%`。两种父容器下都成立。

3. **`subagents.live` 的 `live` 字段防御。**
   渲染期 `Object.keys(live)` 在 `live === undefined` 时整个 tab body 崩。
   **修复**：`setLive(result.live ?? {})` + 组件侧 `useSubagentLive(...) ?? {}`。

**教训**：
- **模拟装配 ≠ 真实装配**。冒烟测试把 hooks 绑成"无参可调"是我自己的假设，等于把 bug 写进了测试的 mock 里；真实实例一跑就现形。凡是"框架约定"（hook 签名、容器布局），要么读框架源码抄下来，要么用真机验证——这次两者都做了：先读 `bind.ts`/`dockkit.module.css` 确认契约，再上新写的 `test/ui-acceptance.mjs`（CDP + 本机 Chrome，零第三方依赖）做真机断言。
- **布局契约要连容器一起看**：只读 `pane.tab` 的 slot 说明不会知道宿主容器是 block 还是 flex；`.paneBody` 的 CSS 才是事实。
- 真机验收脚本值得留在仓库里（`test/ui-acceptance.mjs`）：28 条断言 + 截图，回归成本从"手动点"降到一条命令。

## 2026-09-13：吸色踩坑与"第三方卡片要自己复刻框架卡片"

**发现 1：`--dsw-alias-brand-primary` 不是蓝色，是墨色。**
给分组上色时先用了 `brand-primary`，在浅色主题下得到一个近黑的分组色（分组之间几乎分不出来）。
`ui-theme/src/styles/design-platform.css` 里它解析为 `--dsw-static-neutral-bluish-1000`
（框架自己的注释也写着 "brand-primary resolves to ink in this sheet"）。
**结论**：有明确色相的只有 `--dsw-alias-state-{business,success,warn,error}-primary`
（蓝 65,118,230 / 绿 34,197,94 / 琥珀 245,158,11 / 红 236,19,19）；`brand-primary` 只适合
描边、焦点环、链接这类"结构性强调"，不适合当分类色。

**发现 2：框架不导出 `PluginCard`，第三方设置卡片必须自己复刻。**
`settings.plugin.item` 的宿主只把卡片塞进 `<ul>`，框架内置卡片各自渲染自己的
`<li class="card">`（0.5px 边框 / 16px 圆角 / 层 3 背景 / 头部 14×16 内边距 / 名称 15px-600 /
描述 13px-tertiary / chevron 180° 翻转 / body 上边线 `border-l2`）。第一版本插件卡片没照这个来，
在插件列表里一眼就不像"同一个设置页"。
**结论**：照 `ui-settings-plugins/src/client/PluginCard.module.css`（或 `dsh-global-auth` 的
`.dga-card*` 抄本）复刻；卡片默认收起，内部再按需拆可折叠小节。

**发现 3：list 槽注册必须带 `options.id`。**
`dsh-global-auth` 往 `sidebar.footer.action`（list 槽）注册用户区时漏了 `id`，
框架抛 `list slot "sidebar.footer.action" requires options.id`，控制台每次加载 2 条 error。
已补 `id: 'dsh-auth-user'`（并记入其 CHANGELOG）。
**结论**：`kind: 'list'` 的槽（`sidebar.footer.action`、`settings.plugins.tab`、
`conversation.*.item` 等）注册时必须给 `id`；`keyed` 槽必须给 `key`。

## 2026-09-13：Git / 文件变动 tab 报 `listed.some is not a function`（API 信封没拆）

**现象**：右侧栏打开 Git 或文件变动（Changes）两个 tab，视图直接崩在
`listed.some is not a function`（`GitLens.tsx` 的 `const listed = await gitApi.worktrees(scope)`）。

**根因**：host 的 JSON 网关用**成功信封**回包 —— `wire.ts` 的 `writeOk` 写的是
`{ok: true, value}`；而 client 侧 `terminal-api.ts` 的 `apiPost()` 把整个信封当结果返回，
调用点拿到的是 `{ok,value}` 而不是数组 → `listed.some` 自然不是函数。
**所有走 `/shub/api` 的调用点都受影响**（git.*、fs.*、changes.ops、jobs.*、browser.probe、
subagents.live、terminal.deps…），只是 GitLens 第一个摸到数组方法，先炸出来。
之前几轮"后端验证通过"只看 HTTP 响应体（确实含 `{ok:true,...}`），没人验证过 **client 解包后的形状**。

**修复**：`apiPost()` 在 `response.ok` 之后拆信封（`ok === true` 且存在自有属性 `value` 时返回
`value`，否则原样返回以兼容旧 host）。冒烟测试补了产物级门禁（必须存在对该 `value` 键的判断）。

**教训**：
- 网关的"信封约定"必须在**两端各有一处**实现并被测试：host 写 `{ok,value}`、client 拆 `{ok,value}`。缺了 client 那一处，接口一个个都"能连上"但数据全是错的。
- 真机验收要断言**数据面**（分支名、变更区、行数），只断言"视图根元素存在"会漏掉这一类全崩。

**验证**：`test/ui-acceptance.mjs` 新增
- `0c. /shub/api 成功信封可解（shell.get）` → `{"status":200,"ok":true,"hasValue":true,"shell":"/bin/bash"}`
- `3c. Git 视图读到真实仓库数据` → `{"error":"","branch":"master","sections":3}`
- `3d. 文件变动视图读到数据且无错误` → `{"lenses":["Git 视角","会话轮"],"gitSections":3}`

## 2026-09-13：语音转文字显示「环境未就绪」（测试 profile 缺机器级 patch）

**现象**：测试实例里「语音转文字」面板顶部徽章是 `● 环境未就绪`。

**排查**：插件自带 config 里 `modelDir` **没有默认值**（`dsh-audio-transcriber/cordis.patch.yml` 注释写明
"modelDir 属机器配置，无默认 —— 由 profile 层 cordis.patch.yml 按 id 覆盖提供，
`install-to-dsh.sh` 自动写入"）。直接跑插件的自检函数复现：

```bash
node -e "import('./src/transcriber.mjs').then(async m => {
  console.log(await m.createTranscriber({}).check());
  console.log(await m.createTranscriber({ modelDir: '${MODEL_ROOT}/whisper-large-v3' }).check());
})"
# → {"pythonOk":true,"modelOk":false,"ffmpegOk":true,"ready":false}
# → {"pythonOk":true,"modelOk":true,"ffmpegOk":true,"ready":true}
```

对照 3082：`~/.dsh-dev/profiles/web/cordis.patch.yml` 里有 `id: audio-transcriber` 的
`pythonBin` + `modelDir` 覆盖（由安装脚本写入）；**测试 profile 根本没有 `cordis.patch.yml`** →
插件落到默认层 → 没有 `modelDir` → `modelOk=false` → 未就绪。venv 与 ffmpeg 一直是好的。

**修复**：给测试 profile 写 `cordis.patch.yml`（照 dev 的同款 audio-transcriber 块，路径同机同值）；
顺带把 `~/.dsh-dev/profiles/web/data/dsh-audio-tts/settings.json`（`modelDir` / `engine` /
`edgeEnabled`）复制到测试 home，让文字转语音也带上模型目录。

**教训**：
- 插件的 **bundle 默认 config 是可移植的、不含绝对路径**；机器相关路径在 **profile 层 patch**。
  迁移/新建一个 DSH_HOME 时，bundle 列表（`dsh.profile.bundles`）**不等于**配置迁移完成——
  还要带上 `profiles/web/cordis.patch.yml` 与 `profiles/web/data/<plugin>/`。
- 排查"环境未就绪"先跑插件自己的自检函数（每个插件都该有），一次就能定位到具体哪一项 false。

**验证**：`test/ui-acceptance.mjs` 新增 `3e. 语音转文字环境就绪` →
`{"badge":"● 环境就绪","status":"模型与 ffmpeg 就绪，可以转写"}`。

## 2026-09-13：故障排查工作台报「未登录或会话已失效」= 没有会话，不是 bug

**现象**：测试实例（首页门禁被我关掉）里打开故障排查工作台，顶部出现
「未登录或会话已失效」，各面板停在加载中。

**排查**（用新写的探针 `test/probe-tab.mjs` 一次拿全现场）：

```bash
node test/probe-tab.mjs --url "http://127.0.0.1:3085/?token=..." --kind troubleshoot-workbench --wait 8000
# → 可见文案：… 未登录或会话已失效 / 总览加载中…
# → 失败请求：401 /api/troubleshoot-workbench/{status,docs,reports,incidents/*,troubleshoot-progress,...}（共 10 个）
# → 控制台无异常
```

**根因**：工作台的自有 API 由 `dshAuth`（dsh-global-auth）**逐请求守卫**
（`dsh-troubleshoot-workbench/src/host/auth-guard.ts`，未登录 → 401）；而当时测试实例的
`gateEnabled=false`（我为无凭据自动化验收临时关的），浏览器里没有会话 cookie → 全部 401。
前端按设计"如实展示错误"（`incident-panel.ts` 注释即如此），于是把那句服务端文案显示出来。

**结论/处置**：这不是插件缺陷，而是**环境缺登录**：
- 3082 的门禁是开的（`gateEnabled=true`），登录后工作台正常；
- 测试实例若要用工作台，先访问 `/login` 登录即可（门禁关 ≠ 登录页不存在）。

**教训**：把"门禁关掉"当成"便于验收的环境"是有代价的——凡是有鉴权的插件（工作台的自有 API、
任何读 `dshAuth` 的功能）都会变成 401 现场。验收环境要么登录，要么只在自动化断言里用
`/shub` 与无鉴权能力，别把它当人工可用环境交付。探针脚本 `test/probe-tab.mjs` 已留仓，
以后遇到"某 tab 报错"先跑它，别猜。

## 2026-09-13：界面中文、右侧栏「分类」却是英文（读错了语言来源）

**现象**：3082（language 设置为中文）打开右侧栏，分类框架的文案是英文
（Categories / Restore defaults / Built-in…），其它界面都是中文。

**根因**：`locales.ts` 的 `currentLang()` 读 `document.body.dataset.dsLang`。
框架**根本不写这个属性**——它同步语言写的是 `document.documentElement.lang`
（`packages/client/locale/src/client/index.ts` 的 `syncDocumentLanguage`：
`document.documentElement.lang = snapshot.active === 'zh' ? 'zh-CN' : snapshot.active`）。
于是取值恒为 `undefined` → 回落到 `navigator.language` → 开发/CI 机上是 zh 就"看着对"，
用户浏览器是 `en-US` 就整块变英文。
真机证据（验收 `1d`）：`{"lang":"zh-CN","bodyLang":null,"navLang":"zh-CN","titleText":"分类"}`。

**修复**：
1. `setActiveLocale(locale)`：entry.ts 通过 `ctx.inject(['locale'])` 拿 DSH locale 服务的
   `getSnapshot().active`（权威来源）注入；
2. `currentLang()` 取值链改为 **locale 服务 → `documentElement.lang` → `body[data-ds-lang]` → navigator**；
3. 订阅 locale 变更：语言切换时 `refreshCatalog()`；并且**把语言放进快照签名**
   （`createSource` 的 signature 前缀带当前语言），保证语言变了快照换身份 → 组件重渲染，
   模块级 `t()` 才跟着换（否则切语言要等下一次无关重渲染才生效）。

**教训**：跨插件读"全局状态"时，**照抄框架的实现**（它写哪个 DOM 属性、挂在哪个服务上），
不要照抄第三方插件的习惯（`data-ds-lang` 是 better-sidebar 的私有约定，框架层没有）。
能做"读服务"就别"读 DOM"。

## 2026-09-13：字号比全局小一档（用了 11/12px 而在 14/16px 的界面里）

**现象**：用户反馈右侧栏分类"字体偏小"，与 DSH 其它界面不一致。

**根因**：分类页/设置卡片大量使用 `--dsw-font-xxxs-11`（11px）与 `--dsw-font-xxs-12`（12px），
而 DSH 面板/设置卡片的正文尺度是 15–16px、条目 13–14px（框架 `PluginCard` 用名称 15px / 描述 13px）。

**修复**：整体上抬一档并全部改用框架字号 token（不再写死 px）：
标题 `--dsw-font-base-strong-16`(16)、分组 `--dsw-font-s-strong-14`(14)、
条目/表体 `--dsw-font-xs-13`(13)、计数与注释 `--dsw-font-xxs-12`(12)；
设置卡片头部仍保持 15px/13px 与框架 `PluginCard` 像素一致。
验收新增 `1e`：标题 ≥16px、分组 ≥14px、条目 ≥13px。

**教训**：字号也要走 token（`--dsw-font-*`），否则主题的字号设置与后续改版都不会带上我们。

## 2026-09-25：分类页一直标「未持久化」（settings 命名空间实际未注册）

**现象**：3082 实例上 hub 分类页右上角持续显示「未持久化」（`persistence()` 返回 `'memory'`），
拖拽/改归属只在本次会话生效。同时 `~/.dsh-dev/profiles/web/settings.yaml` **始终不存在**，
在 UI 里做写操作也不会生成该文件。

**排查链（含排除项）**：
1. 插件 host 侧确实调用 `ctx.inject(['settings'], …)` 并 `register(SETTINGS_NAMESPACE, schema, { base })`
   （`src/host/index.ts:60-69`）——代码路径正确。
2. 运行日志只有 `[sidebar-hub] host apply`，**没有** `[sidebar-hub] settings 命名空间已注册`，
   也**没有** catch 分支的 `注册 settings 命名空间失败` 警告 ⇒ `inject` 回调从未触发（不是注册抛错）。
3. 客户端 `persistence()` 返回 `'memory'` 的两个条件（`src/client/catalog/config-store.ts:193-195`）：
   `scope === null` 或 `snapshot.writable === false`。框架侧 `ConfigForm` 构造时 `writable` 初值为
   `false`，只有 `derive()` 在 mirror 里找到该命名空间、且 `mirrored.view.writable` 为真时才置真
   （`dsh-client-ui-settings/lib/types/client/config-form.js:41-56,145-167`）。
4. DSH_HOME 根存在 `settings.yaml.imported`（149B，2026-09-24 14:51:08）+ `settings.yaml.lock`，
   而 `settings.yaml` 本体不存在 ⇒ 框架的 legacy 迁移 `importLegacyDocument()`
   （`packages/settings/settings/src/index.ts:241-258`）把文档 `rename` 成 `.imported` 后，
   逐 section `update()` 回写；**回写没有落盘，文档也没重建**。
5. 排除插件自身：`dsh-audio-tts` 同期用**自己的** `data/<plugin>/settings.json` 写盘成功
   ⇒ 磁盘可写、profile 目录可写，问题只在框架 settings 服务这一条链路。

**根因（已验证，可复现）**：**不是本插件的问题，也不是磁盘权限问题**，而是框架的
legacy 迁移 `importLegacyDocument()`（`deepseek-harness/packages/settings/settings/src/index.ts:241-258`）
把 `settings.yaml` **改名**为 `settings.yaml.imported` 之后，逐命名空间 `update()` 的**回写没有落盘**，
因此从未重建 `settings.yaml`。settings 文档缺失 ⇒ 客户端 mirror 取不到任何命名空间
⇒ `ConfigForm` 的 `writable` 停在构造初值 `false`
（`dsh-client-ui-settings/lib/types/client/config-form.js:41-56,145-167`）
⇒ `config-store.persistence()` 返回 `'memory'` ⇒ 分类页标「未持久化」。

**隔离复现（三次，均为干净 DSH_HOME，与本插件无关）**：

| 种子 | 启动前 | 完整启动后 |
|---|---|---|
| `settings.yaml`（115 B） | 存在 | 变成 `settings.yaml.imported`（115 B），**无新 `settings.yaml`** |
| `settings.yaml`（30 B） | 存在 | 变成 `settings.yaml.imported`（30 B），**无新 `settings.yaml`** |

启动输出中**没有** `settings: imported …`（info）也**没有** `section … was not imported`（warn）
⇒ 迁移路径静默执行：改名发生了，回写既没成功也没报错。
（对照：迁移前不种 `settings.yaml` 时，启动后同样什么也不生成。）

**旁证（排除「磁盘/权限」整类假设）**：
- 真实 home 的 `dsh-audio-tts/data/<plugin>/settings.json` 同期写盘成功；
- 同样在 `~/.dsh-dev` 根，`.credentials.yaml` / `.anonymous-user-id` / `storages/workspace.json`
  都能正常创建 ⇒ 目录可写。
- 运行日志只有 `[sidebar-hub] host apply`，**没有** `[sidebar-hub] settings 命名空间已注册`，
  也**没有** catch 分支的注册失败警告 ⇒ `ctx.inject(['settings'], …)` 回调根本没被调用。

**影响**：所有依赖 framework settings 的插件在这台机器上都拿不到持久化
（hub 分类配置退回内存态；`locale`/`agent-presets` 等用户设置也停在被改名的
`settings.yaml.imported` 里没生效）。

**处置（按 `deepseek/AGENTS.md`：禁止改上游源码）**：
1. **不修改 `deepseek-harness`**，不做 monkey patch / 兼容层；此条按「上游缺口」记录，附证据路径。
2. 本插件可控的改进：`ctx.inject` 静默跳过时**主动打一条可观察日志**，把「命名空间未注册」
   从「只有一个含义模糊的 UI 提示」变成可查的现场信号（待办）。
3. 用户侧临时缓解：`settings.yaml.imported` 里是**真实用户设置**（`locale: zh`、
   `agent-presets: default: minimal` 等）；在框架修好前，如需生效可手工确认后回写成
   `settings.yaml`，但**回写是否会被下次启动再次消费掉需先验证**，不要盲改。
4. 上报建议：迁移应在 `rename` 后校验新文档确实写成功，失败则回滚改名并报错，
   而不是静默留下「文档消失 + 无警告」。

**未验证 / 边界**：未定位到 `update()` 为何不落盘的具体代码路径（是
`profileContext` 缺失导致 `update` 提前 return，还是写入路径本身有问题）；
未验证手工回写 `settings.yaml` 能否稳定恢复。以上均属上游问题，需按上游流程处理。

**教训**：
1. **可选依赖的 `ctx.inject` 是静默的**——服务不在时回调根本不跑，既不抛错也不警告。插件对
   「可选依赖缺失」必须**自己发一条可观察的信号**（日志/状态位），否则现场只剩一个含义模糊的 UI 提示，
   排查要从「UI 文案 → 客户端 store → 框架 writable 语义 → 服务是否挂载」倒推四层。
2. **`.imported` 后缀是「迁移已执行」的证据，不是备份**。重建 DSH_HOME 或搬迁 profile 时，
   若看到 `settings.yaml.imported` 而没有 `settings.yaml`，说明迁移消费了旧文档但回写未落盘——
   用户设置（locale/preset 等）停在该文件里，需要人工确认是否恢复。
3. 判断「环境问题 vs 插件问题」时，找一个**不走该服务、但同样写盘的兄弟插件**做对照
   （这里用 `dsh-audio-tts/settings.json` 写盘成功），能一步把「磁盘/权限」整类假设排除掉。
