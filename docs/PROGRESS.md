# dsh-sidebar-hub · 进度

## 当前状态

- 文档性质：历史记录（本插件进度真源；已完成部分已压成历史沿革，待办见「进行中 / 下一步」）
- 对应版本：v0.1.6
- 状态：历史记录，结论按当时口径（当前有效能力见 index.md 与 REQUIREMENTS.md）
- 维护者：AI + 用户

> 本文件是**本插件唯一进度真源**（谁开发谁维护）；工作区根 `progress.md` 仅做总分发索引。
> 需求与架构见 [REQUIREMENTS.md](REQUIREMENTS.md) / `specs/`，踩坑记录见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

## 🔄 进行中（中断点）

- **v0.1.5（发现架构纠正）+ v0.1.6（opscrew 归组）已实现，`pnpm check` 全绿**（2026-09-30）：
  - **纠正**（用户 2026-09-30 反馈「聊天/人物详情」等不该有的入口）：发现源改回 **guide-only**
    ——分类页只呈现官方 `guide()` 引导盒子里真实存在的入口；v0.1.4 读 `entries()`（标签类型注册表）
    把 plan/changes-review/subagentchat 等纯资源查看器灌进分类页，v0.1.5 起撤销，并删除
    `@deepseek-ai/` 前缀官方推断、自动归组与「官方」角标（归组只认显式规则，未登记落「其他」）。
  - 漂移检测（R2）对账对象 = guide 入口集（与分类页同源）；drift 记录收敛为 `{title}`。
  - v0.1.6：出厂映射新增 `'opscrew-workbench': { groupId: 'workbench' }`（应急指挥工作台，
    dsh-opscrew，用户新增）。
- 中断点（接手先读）：
  - **3082**：0.1.5 已由用户重启生效（用户确认「官方组只看到2个」= files+terminal，符合预期）；
    0.1.6 已装入 profile（deps/bundles 引用 0.1.6 tgz）；**R4 浏览器补丁已应用**
    （`cordis.patch.yml` 追加 `ui-sidebar-browser: disabled: false`，备份
    `cordis.patch.yml.bak-browser-20260930-210709`；patch 现 23 个顶层条目，含用户自加的
    `dsh-opscrew` 机器级条目）。**仅剩**：`systemctl --user restart dsh-dev-web`（用户操作/同意）
    → 官方组出现第三个入口「浏览器」、工作台组出现「应急指挥工作台」；若基线先于补丁写入，
    重启后分类页会弹漂移提醒「新增：浏览器 → 官方」（R2 正常行为，点「知道了」即可）。
  - 3084 复验（0.1.5）：`ui-acceptance.mjs` **26/36**，关键项全 PASS：2b2「无内部 tab 类型
    混入分类页」、2d「官方组 = files+terminal（浏览器未启用时）」；截图 `docs/verify-v015/`。
  - 故障工作台已从 3082 移除（2026-09-30，用户指示；代码保留待重新设计）。

## ⏭ 下一步 + 待确认

- 重启 3082（用户操作/同意）：`systemctl --user restart dsh-dev-web` → 期待：
  分类页「官方」组 = 工作区文件 / 新建终端 / **浏览器**（R4 补丁生效）；
  「工作台」组出现**应急指挥工作台**（opscrew-workbench 归组规则随 0.1.6 生效）。
- 若重启后首次进分类页弹漂移提醒（浏览器/应急指挥为新增）→ 属预期，点「知道了」写入新基线。
- 用户确认 3082 在 0.1.6 下正常后：无遗留旧 tgz（0.1.3/0.1.5 已删，0.1.4 早删），
  目录只留 0.1.6（AGENTS 铁律）。

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
