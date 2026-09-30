# dsh-sidebar-hub · 进度

## 当前状态

- 文档性质：历史记录（本插件进度真源；已完成部分已压成历史沿革，待办见「进行中 / 下一步」）
- 对应版本：v0.1.4
- 状态：历史记录，结论按当时口径（当前有效能力见 index.md 与 REQUIREMENTS.md）
- 维护者：AI + 用户

> 本文件是**本插件唯一进度真源**（谁开发谁维护）；工作区根 `progress.md` 仅做总分发索引。
> 需求与架构见 [REQUIREMENTS.md](REQUIREMENTS.md) / `specs/`，踩坑记录见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

## 🔄 进行中（中断点）

- **v0.1.4（spec 003，DSH 升级漂移同步）已实现并 `pnpm check` 全绿**（2026-09-30）：
  R1 发现源升级（`entries()` ∪ `guide()`，官方性按 `@deepseek-ai/` 前缀）；R2 漂移检测
  （settings `drift` 桶首跑静默初始化、新增/移除提醒、「知道了」滚动基线）；R3 官方能力
  未登记归属时自动落「官方」组。0.1.x→0.2.0 升级后浏览器等原生能力从分类页消失的根因诊断见
  `docs/specs/003-upgrade-drift-sync/spec.md` §0 与管理根 `ops/validation/dsh-test-boot-rc2.html`
  （上游 web profile 默认禁用 `ui-sidebar-browser`，非本插件 bug）。
- 中断点（接手先读）：
  - tgz 已产出（`dsh-sidebar-hub-0.1.4.tgz`）；**3084 测试实例端到端复验未做**（重启 3084 →
    `pnpm dsh plugin --profile web add <tgz>` → `test/ui-acceptance.mjs` 走 token 链接）。
  - 3082（用户日常实例）装 0.1.4 + 重启 = **用户批准事项**，未批准前不动。
  - 浏览器能力重启用（R4）= 用户批准事项：管理根 `ops/browser-web-enable-patch-20260930.md`
    补丁（3082 profile `cordis.patch.yml` 加 `ui-sidebar-browser: disabled: false`），未批准不应用。

## ⏭ 下一步 + 待确认

- 用户批准 3082 升级后：装 0.1.4 tgz → 重启（`systemctl --user restart dsh-dev-web`）→ 首次进入
  分类页应见漂移提醒（0.2.0 能力面 vs 0.1.x 基线的新增/移除）→「知道了」后安静。
- 若用户要浏览器入口回到 3082 侧栏：先应用上述补丁再重启（web profile 为 iframe 形态浏览器）。
- 3084 验收到 3082 后，旧版 tgz（0.1.3）删除，只留 profile 引用的 0.1.4（AGENTS 铁律：每插件一份 tgz）。

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
