# dsh-sidebar-hub — 分类式侧边栏工作台

**打开右侧栏后看到的起始页，本身就是按功能分组的分类界面**（不是新增一个工作台 tab，也不在 tab 里再分层）：

- **分类框架**：接管 `sidebar.right.tab.guide`（chain 槽），把各插件入口按 **官方 → 工作台 → 工具 → 游戏** 分组（v0.8 起四组；每组带语义色左条/圆点，条目带首字图标块）；未登记的 kind 自动落「其他」。v0.6 起 **hub 自研内容类型全部移除**（任务/Subagent/Git/文件变动下线），本插件只做入口编排，不提供落地页。
- **可维护**：分类页拖拽（跨组移动、组内排序、新建/重命名/删除/折叠/恢复默认）+ 官方「插件」面板的「右侧栏分类」配置卡片（`plugins.bundle.config`，0.1.6-alpha.2 起），两处共用同一份配置。
- **官方能力交还**：终端（v0.2）、浏览器（v0.5）、Office 预览（v0.7）均由官方内置接管——`kind='terminal'` / `kind='browser'` 映射进「官方」组（与 Files 同组）标「官方」；docx/pptx/xls/xlsx 由官方 office-to-pdf 预览。**md(mermaid) 渲染器保留**（v0.3）：md 接管 + mermaid 图 + md 内本地图片，官方仍无 mermaid。
- **收纳（仅转发入口）**：自研三大工作台（个人/故障排查/交易）、语音转文字/转语音；官方文件（Files）、官方终端、官方浏览器**只提供入口、不接管、不替换**。
- **配置持久化**：DSH settings 命名空间 `dsh-sidebar-hub`（全局一份）；settings 不可用时退内存态并在分类页标「未持久化」。
- **宿主路由**：`/shub/api/<method>` JSON 网关（session/fs 基础）+ `/shub/file|upload|bundle`（md 渲染/惰性 chunk），全部前置信任围栏。
- **全屏**：属 DSH WEB 应用层能力（不由本插件提供）。

## 文档

- [AGENTS.md](AGENTS.md) — 开发规范（SDD 流程、红线、命令）
- [docs/index.md](docs/index.md) — 总览与文档导航
- [docs/specs/002-right-sidebar-categories/spec.md](docs/specs/002-right-sidebar-categories/spec.md) — 需求规格（已冻结）
- [docs/specs/002-right-sidebar-categories/plan.md](docs/specs/002-right-sidebar-categories/plan.md) — 技术设计与合约查证
- [docs/specs/002-right-sidebar-categories/tasks.md](docs/specs/002-right-sidebar-categories/tasks.md) — 任务拆解与状态
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — 需求→决策→实现→验收追踪（含已知取舍）
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — 事故复盘

## 状态

- [x] 调研 / Specify / Clarify / Plan / Tasks
- [x] 分类框架：起始页替换、分组与映射、拖拽/排序/折叠、settings 持久化、设置页卡片
- [x] `pnpm check` 全绿（build + typecheck + `node --check` + 两组冒烟）
- [x] 真实实例 UI 验收：`test/ui-acceptance.mjs` **35/35**（测试实例 3085 + `dsh-plugins/dsh-test-home/`；截图 `docs/verify-v08/`）；3082 始终未碰
- [x] v0.2：终端交还官方（kind=`terminal`），数独归「游戏」组（2026-09-15，见 `docs/specs/002-*/spec.md` §0）
- [x] v0.3：md 渲染接管（mermaid 图 + md 内本地图片，官方仍无 mermaid），走官方 `documentPreviews` 扩展点 + 惰性 chunk（2026-09-17，`test/ui-document-v03.mjs` 11/11）
- [x] v0.4：字号跟随官方「设置→通用设置→字号」（`--hub-font-*` 偏移刻度，2026-09-17）
- [x] v0.5：浏览器交还官方（官方内置 `kind=browser` 归「官方」组、删 hub-browser 全链）；设置卡片适配官方「插件」面板（`plugins.bundle.config`）（2026-09-19）
- [x] v0.6：hub 自研内容类型全部移除（任务/Subagent/Git/文件变动），分类框架只做入口编排（2026-09-19）
- [x] v0.7：Office 渲染器交还官方（官方内置 doc/docx/xls/xlsx/ppt/pptx 预览），md(mermaid) 渲染器保留（2026-09-19）
- [x] v0.8：默认分组精简为四组（删「工程与任务」、「浏览与工具」改名「工具」）（2026-09-19）
- [x] v0.9：跟随 `dsh-personal-workbench` → `dsh-daily-workbench` 改名（kind `personal-workbench` → `daily-workbench`）（2026-09-20）

## 开发

```bash
pnpm install
pnpm check        # build + typecheck + node --check + 客户端接线冒烟（test/client-wiring.smoke.mjs）
# 真实实例验证（禁止触碰 3082）：测试环境 = dsh-plugins/dsh-test/ + 独立 DSH_HOME + 独立端口
cd ../../dsh-plugins/dsh-test/deepseek-harness
DSH_HOME=<独立测试 DSH_HOME> pnpm dsh web --port 3084 --no-open
```
<!-- deepseek-shared-layout -->

## Windows / Ubuntu 共用目录

本项目遵循 [DeepSeek 共用目录约定](../dsh-agent-presets/docs/DIRECTORY-LAYOUT.md)。管理根统一写作 `<DEEPSEEK_ROOT>`（`.../deepseek/`），历史部署记录不能视为当前机器状态；Bash/systemd 命令只适用于对应环境，配置文件中的路径须在本机解析。

## 0.1.2 · 2026-09-25

保留官方 guide provider 的完整入口，恢复终端 shell 下拉；分类拖拽仍由 Hub 管理。 见 [修复规格](docs/specs/20260925-native-entry-ui/spec.md)。
