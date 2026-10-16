# Spec 003 Tasks（R1–R3 已实现 v0.1.4；R1 纠正 + R3 撤销 v0.1.5；R4 应用 + opscrew 归组 v0.1.6；settings 契约适配 v0.1.7；3082 重启待用户）

> 依赖顺序：T1 → T2/T3（可并行）→ T4 → T5。实现经用户 2026-09-30 原话确认（见 spec「状态」）。

- [x] T0（已备）：诊断证据归档（spec §0）；测试实例盘点（dsh-test 停在 0.2.0-rc.2；
      `ops/validation/dsh-test-boot-rc2.html`：66 条目、无 browser、terminal/files 在列）——2026-09-30。
- [x] T1 发现源升级（R1）：`entry.ts` `readRegistry()` = `entries()` ∪ `guide()` 按 kind 去重；
      `official` 判定 = 定义 id `@deepseek-ai/` 前缀（guide-only 时 providerId 兜底）；
      旧宿主无 `entries()` 时退回 guide-only（行为与 v0.1.3 一致；可选调用，非垫片）。
- [x] T2 漂移检测（R2）：`host/settings.ts` 加 `drift` 桶（base `{kinds:{}, ack:''}`）；
      `shared/catalog-config.ts` `CategoryDrift`；`config-store.ts` `noteDrift` /
      `hasDriftBaseline` / normalize 容错；`entry.ts` `syncDrift`（首跑静默初始化、
      新增/移除 diff、ack 滚动基线、基线跨重启保持）。
- [x] T3 提醒条 + 新角标（R2/R3）：`CatalogFramework.tsx` 漂移横幅（新增/移除分列 + 落点分组 +
      「知道了」）与「新」角标；`mapping.ts` 官方自动归组（显式规则 > 官方归组 > 「其他」）；
      `locales.ts` 中英文案；`catalog.css` 纯 token 样式。
- [x] T4 测试：client-wiring 冒烟（fake registry 带 `entries()`/可注销 dispose、`@deepseek-ai/`
      官方前缀 seed、无 guide 新 kind、首跑静默初始化写断言、漂移新增/移除/ack 全流程、
      hooks 键 = catalog+drift）+ host-settings（drift 桶深合并/schema 补默认）；
      `pnpm check` 全绿（2026-09-30，`ops/validation/test-build-2.log` 为 rc.2 测试实例构建证据）。
- [x] T5 打包与交付：版本 0.1.4 四处同步 + 打包完成（`pnpm pack` 产 `dsh-sidebar-hub-0.1.4.tgz`，含
      `dist/`；本机 `npm pack` 因只读 pnpm store 报 EROFS，`pnpm pack` 等价替代）；README/PP-项目计划（原 PROGRESS）/
      CHANGELOG/RMP（原 TROUBLESHOOTING）同步完成；3084 测试实例端到端复验**已做**（装 tgz + 重启 3084 +
      `ui-acceptance.mjs` **23/35**：12 项 FAIL 全部归因最小 profile 缺插件与上游 web 禁用浏览器，
      0.1.4 新能力项全 PASS，截图 `docs/测试/证据/verify-v014/`，复盘入 `docs/管理/RMP-风险管理.md`（原 TROUBLESHOOTING）2026-09-30 条目）；
      3082 安装待用户批准。
- [ ] T6（用户侧动作，代理协助）：批准 → 应用管理根 `docs/history/ops/browser-web-enable-patch-20260930.md`
      补丁（3082 profile 的 `cordis.patch.yml`）；批准 → 重启 3082；真机目检验收（spec §3 条 1/3）。