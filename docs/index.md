# dsh-sidebar-hub — 分类式侧边栏工作台

## 当前状态

- 文档性质：操作手册（插件总览 / 形态 / 文档导航）
- 对应版本：v0.1.4
- 状态：有效
- 维护者：AI + 用户

右侧边栏内容太多、互相穿插（引导页只有扁平胶囊，自研三大工作台被其它插件的内容打断）。本插件把**打开右侧栏后看到的起始页**改成按功能分组的分类界面（分组带语义色 + 条目首字图标块），各插件入口按 **官方 → 工作台 → 工具 → 游戏 → 其他** 分组；官方文件（Files/文本预览）保持原样，只转发入口、不接管、不替换。

**现状（v0.6–v0.8）**：hub 不再提供自研内容类型（任务/Subagent/Git/文件变动/浏览器已全部下线）；终端（v0.2）、浏览器（v0.5）、Office 预览（v0.7）均由官方内置接管；md(mermaid) 渲染器走官方 `documentPreviews` 扩展点自研保留（mermaid 管线吸收自 MIT 项目，见 `LICENSE`）。本插件只做**入口编排**。

## 要解决的问题

1. 引导页只有扁平胶囊，没有分组与描述（条目 >4 时 description 不显示）。
2. 自研三大工作台（个人/故障排查/交易）与语音工具缺乏统一入口组织。
3. 官方文件（Files/文本预览）必须保持原样——不接管、不替换。
4. 官方能力（终端/浏览器/Office）与自研工作台需要一个统一分组的入口页。

## 形态

- **起始页 = 分类框架**：用 `sidebar.right.tab.guide` 的 chain 槽接管引导页正文；分组（v0.8 起四组：官方 / 工作台 / 工具 / 游戏，另加「其他」兜底）+ 条目 = 各插件入口，点条目直接打开对应内容。
- **条目可维护**：分类页拖拽（跨组移动、组内排序、新建/重命名/删除/折叠/恢复默认）+ 官方「插件」面板里的「右侧栏分类」配置卡片（`plugins.bundle.config`，0.1.6-alpha.2 起）。
- **内容来源**：无自研落地页（v0.6 起）；官方终端/浏览器、官方 Files、三大工作台、语音工具、小游戏均为**入口转发**。md(mermaid) 渲染器接管官方 md 预览。
- **配置持久化**：DSH settings 命名空间 `dsh-sidebar-hub`（全局一份）。
- **全屏**：属 DSH WEB 应用层能力，不由本插件提供。

## 文档导航

| 文档 | 内容 |
|---|---|
| [AGENTS.md](../AGENTS.md) | 开发规范（SDD 流程、红线、命令） |
| [specs/002-right-sidebar-categories/spec.md](specs/002-right-sidebar-categories/spec.md) | SDD 规格（已冻结）：需求、非目标、分类设计、验收标准、验证方式 |
| [specs/002-right-sidebar-categories/plan.md](specs/002-right-sidebar-categories/plan.md) | 技术设计：架构、合约查证（C1–C6）、数据模型、风险 |
| [specs/002-right-sidebar-categories/tasks.md](specs/002-right-sidebar-categories/tasks.md) | 任务拆解与逐项状态 |
| [REQUIREMENTS.md](REQUIREMENTS.md) | 需求 → 决策 → 实现 → 验收追踪表（含已知取舍） |
| [PROGRESS.md](PROGRESS.md) | 本插件进度真源（轮次反馈、装机与收尾运维） |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 事故复盘（现象 → 根因 → 修复 → 教训） |
| [prototype/](prototype/) | 用户确认的原型（起始页分类框架） |
| [research-sidebar-layout-2026-09-11.md](research-sidebar-layout-2026-09-11.md) | 前期调研（2026-09-11，右侧栏机制一手出处；已被 specs/002 吸收，留档） |

## 状态

- [x] 调研 / Specify / Clarify / Plan / Tasks（用户确认）
- [x] 分类框架：起始页替换、分组与映射、拖拽/排序/折叠、settings 持久化、设置页卡片（官方「插件」面板）
- [x] v0.2–v0.8：终端/浏览器/Office 交还官方、自研内容类型全清、默认分组精简为四组、md(mermaid) 渲染保留
- [x] `pnpm check` 全绿 + 两组冒烟（`test/client-wiring.smoke.mjs` 接线/分组/settings 写回、`test/host-settings.smoke.mjs` schema 合并语义）
- [x] 真实实例 UI 验收：测试实例（3085 + `dsh-plugins/dsh-test-home/`）`test/ui-acceptance.mjs` **35/35** + `test/ui-document-v03.mjs` **11/11**，截图在 `docs/verify-v08/`；3082 全程未触碰
