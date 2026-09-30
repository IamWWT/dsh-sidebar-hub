# dsh-sidebar-hub · 进度

## 当前状态

- 文档性质：历史记录（本插件进度真源；已完成部分已压成历史沿革，待办见「进行中 / 下一步」）
- 对应版本：v0.1.7
- 状态：历史记录，结论按当时口径（当前有效能力见 index.md 与 REQUIREMENTS.md）
- 维护者：AI + 用户

> 本文件是**本插件唯一进度真源**（谁开发谁维护）；工作区根 `progress.md` 仅做总分发索引。
> 需求与架构见 [REQUIREMENTS.md](REQUIREMENTS.md) / `specs/`，踩坑记录见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

## 🔄 进行中（中断点）

- **v0.1.7（settings 契约适配上游 0.2.0-rc.2）已实现，`pnpm check` 全绿**（2026-10-01）：
  - **根因**：上游把客户端 settings 接口从 `settingsScope` 换成 `ctx.configForms`，
    host 侧 `SettingsForms` 移除 `register()`（改为遍历 entry：`ns = entry.options.id`、
    schema = 插件导出 `Config` 的 volatile 字段投影）。hub 仍绑旧名/调旧方法 →
    绑定永不触发 → 全程内存态 →「未持久化」徽标 + 漂移「知道了」写不进基线
    （每次刷新重新提醒，无限循环）。
  - **修复**：client 绑 `configForms.get('sidebar-hub')`（命名空间 = profile 条目 id，
    不再用包名）；host 删除失效 register、入口导出 `Config`（设置字段标 `.volatile()`）；
    设置卡片 key 拆为 `SETTINGS_CARD_KEY`（= 包名）；schemastery 升 3.18.4。
  - **复验（3084 测试实例 0.1.7）**：`ui-acceptance.mjs` 26/36（FAIL 全为最小 profile
    缺语音/工作台插件的环境项），**关键项全 PASS**：5b `memoryBadge: false`
    （「未持久化」消失，0.1.5 时为 true）、设置卡片读写、无内部类型混入；
    定向探针「拖 minesweeper → 工作台 → 重载后仍在工作台」= settings 持久化闭环 PASS
    （探针 `ops/validation/persist-probe-v017.mjs`，截图 `docs/verify-v017/`）。
- 中断点（接手先读）：
  - **3082**：0.1.7 已装入 profile（deps/bundles 引用 0.1.7 tgz，dist 物化完整）；
    R4 浏览器补丁早已应用（`cordis.patch.yml` 追加 `ui-sidebar-browser: disabled: false`，
    备份 `cordis.patch.yml.bak-browser-20260930-210709`）。**仅剩重启**（用户操作/同意）：
    `systemctl --user restart dsh-dev-web` → 官方组出现第三个入口「浏览器」、
    工作台组出现「应急指挥工作台」；且 settings 从此**可持久化**（「未持久化」消失，
    「知道了」能落盘、提醒不再复发）。
  - 旧命名空间 `dsh-sidebar-hub` 在 settings.yaml.imported 里只有 `{}`（空），无需迁移。
  - 3084 复验截图 `docs/verify-v017/`；故障工作台已移除（用户指示，代码保留待重新设计）。

## ⏭ 下一步 + 待确认

- 重启 3082（用户操作/同意）：`systemctl --user restart dsh-dev-web` → 期待：
  分类页「官方」组 = 工作区文件 / 新建终端 / **浏览器**（R4 补丁生效）；
  「工作台」组出现**应急指挥工作台**；顶部不再有「未持久化」徽标。
- 若重启后首次进分类页弹漂移提醒（浏览器/应急指挥为新增）→ 属预期，点「知道了」
  写入新基线；**这次能真正落盘，提醒不会再复发**。
- 用户确认 3082 在 0.1.7 下正常后：无遗留旧 tgz（0.1.3/0.1.5/0.1.6 已删），
  目录只留 0.1.7（AGENTS 铁律）。

## 历史沿革（v0.2–v0.9，压成 5 条；逐条过程见 TROUBLESHOOTING.md 与 `specs/002-*/`）

1. **2026-09-13 · 分类框架落地 + 真机验收（T1–T13）** — `sidebar.right.tab.guide` chain 槽接管起始页；自动发现
   `guide()` 全部插件入口 + 出厂映射分组（工作台/工程与任务/浏览与工具/游戏/官方/其他）；当时六个 `hub-*` 自研类型；
   拖拽跨组与组内排序；settings 命名空间 `dsh-sidebar-hub` 持久化；设置页卡片。真机逐轮反馈修复：语言读
   `documentElement.lang`（非 `body[data-ds-lang]`）、字号统一到 `--dsw-font-*`、五组不可删 / 官方不可改名、扫雷归游戏组。
   `pnpm check` 全绿 + UI 验收 41/41（测试实例 3085 + `dsh-plugins/dsh-test-home/`），截图 `docs/verify/`。
   装机 3082（profile deps/bundles），用户同期卸载 better-sidebar；其死配置段已从 3082 `settings.yaml` 清理（备份 `.bak-20260913-125728`）。
2. **2026-09-15 · v0.2 终端交还官方 + 数独归游戏组** — 官方 `ui-sidebar-terminal`（kind=`terminal`）与
   `dsh-tool-terminal` 的 `terminal_*` 工具与 hub 自研重名 → 删自研终端全链（client `TerminalView` 系列 +
   host `pty-manager`/`agent-pty`/`pty-deps`/`terminal-ws`/`tools`），依赖去 `node-pty`/`@xterm/*`；
   出厂映射 `terminal → 官方`组、`sudoku → 游戏`组。同日修复：用户「恢复默认」后官方终端落「工程与任务」组 →
   `DEFAULT_ENTRY_RULES.terminal` 改 `groupId:'official'`。验收 41/41，截图 `docs/verify-v02b/`。
3. **2026-09-17 · v0.3 md(mermaid) 接管 + v0.4 字号跟随** — 走官方 `documentPreviews` 扩展点注册
   `priority:'extension'` 渲染器：`dsh-sidebar-hub/markdown`（md 接管 + mermaid 图 + md 内相对图片经 `/shub/file`）与
   `dsh-sidebar-hub/office`（mammoth/jszip）；重型库惰性 chunk（`dist/chunk-mermaid.js`/`chunk-office.js` 经 `/shub/bundle`）。
   `hub-font.css` 在 `body` 声明 `--hub-font-*` = `calc(var(--dsh-content-font-size,14px) + 偏移)`，全插件替换固定字号。
   验收：`test/ui-document-v03.mjs` **11/11**、`test/ui-font-v04c.mjs` 三档通过。
4. **2026-09-19 · v0.5–v0.7 三项交还官方 / 清空自研内容** — v0.5 浏览器交还官方（kind=`browser` 归官方组，
   删 `BrowserView`/`browser.ts`/`SandboxStatusBar`/host `browser-probe`）；v0.6 清空全部 `hub-*` 类型与正文及
   host `git.*`/`jobs.*`/`subagents.live`/`changes.ops`；v0.7 Office 渲染器交还官方内置（删 mammoth/jszip 与 office chunk），
   仅 md(mermaid) 渲染器保留；设置卡片随官方 0.1.6-alpha.2 设置页重构迁至左侧栏「插件」面板包详情页
   （`plugins.bundle.config`）。验收 UI **35/35** + 文档 **11/11**。
5. **2026-09-19/20 · v0.8 默认四组 + v0.9 插件改名跟随** — 删空组「工程与任务」、「浏览与工具」改名「工具」
   （id `browse-tools` 不变）→ 四组（官方/工作台/工具/游戏）；出厂映射键 `personal-workbench` → `daily-workbench`
   （标题仍「个人工作台」，仍归「工作台」组），测试环境 `dsh-test-home/profiles/web` 依赖改
   `link:dsh-daily-workbench` 并同步 bundles/lockfile。验收 UI **35/35**（2e 工作台组四条）。
