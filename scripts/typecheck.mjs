#!/usr/bin/env node
/**
 * dsh-sidebar-hub — 可移植 typecheck（跨平台；**不含机器专属绝对路径**）。
 *
 * 为什么需要它（2026-09-28 实证）：
 *   本插件是**唯一**依赖 `@deepseek-ai/dsh-client-ui-*`（client 侧 UI 包）的插件。
 *   这些包在 harness 里是 workspace 内部包（**不发布为可解析的 node_modules 条目**，
 *   而是被 bundle 进 web 产物），因此只能靠"装一份 npm 上的同名包"来通过 tsc。
 *   但 npm 上 `0.1.5-rc.2` 的 tarball 其 `lib/types` **落后于源码**
 *   （实测：已发布包 icons 导出 `OutlineRegular` 0 个，harness 本地构建 79 个），
 *   于是插件 typecheck 报 "has no exported member 'IconChevronDownOutlineRegular'"。
 *
 * 处置（遵守 AGENTS.md 铁律：不给插件打兼容补丁）：
 *   **不**改上游、**不**复制上游实现、**不**用旧命名去适配。
 *   本脚本把 tsc 的**类型解析指向 harness 源码树**（同一份真源，只是不经 npm 中转），
 *   路径由 paths.mjs 跨平台解析（env → 同级 harness → DSH home），无硬编码。
 *
 * 注：产物构建（build.mjs）不受影响 —— esbuild 把 `@deepseek-ai/*` 全部标 external，
 *     运行期由宿主模块表提供；本文件只解决「类型从哪来」。
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { buildFallbackDirs, findTsc, findTypeRoots } from "./paths.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

/** 需要在 harness 里定位的 client UI 包（目录名 → 包名）。 */
const CLIENT_PKGS = [
  ["ui-primitives", "@deepseek-ai/dsh-client-ui-primitives"],
  ["ui-slots", "@deepseek-ai/dsh-client-ui-slots"],
  ["ui-conversation", "@deepseek-ai/dsh-client-ui-conversation"],
  ["ui-sidebar-right", "@deepseek-ai/dsh-client-ui-sidebar-right"],
];

/**
 * 定位 harness 仓库根：优先 env，其次「同级/上级的 deepseek-harness」，
 * 复用 paths.mjs 的候选链（含 DSH home profile），避免另造路径探测。
 */
function findHarnessRoot() {
  const dirs = buildFallbackDirs({ importMetaUrl: import.meta.url });
  for (const d of dirs) {
    // d 形如 <harness>/node_modules 或 <profile>/node_modules
    const guess = d.replace(/[\\/]node_modules[\\/]?$/, "");
    if (existsSync(join(guess, "packages", "client", "ui-primitives", "package.json"))) return guess;
  }
  // 兜底：从插件目录向上找兄弟 deepseek-harness
  let dir = root;
  for (let i = 0; i < 5; i += 1) {
    const cand = join(dir, "deepseek-harness");
    if (existsSync(join(cand, "packages", "client", "ui-primitives", "package.json"))) return cand;
    const up = resolve(dir, "..");
    if (up === dir) break;
    dir = up;
  }
  return undefined;
}

const harness = findHarnessRoot();
const tsPath = findTsc(root, buildFallbackDirs({ importMetaUrl: import.meta.url }));
if (!tsPath) {
  console.error("[typecheck] 找不到 tsc（可设 DSH_HARNESS_ROOT，或把 deepseek-harness 放在同级目录）");
  process.exit(1);
}

let failed = false;
let tmpDir;

/** 构造一个「仅注入 paths」的临时 tsconfig，扩展插件自带的那个。 */
function withClientPaths(baseCfg) {
  if (!harness) return baseCfg;
  const paths = {};
  for (const [dirName, pkgName] of CLIENT_PKGS) {
    const pkgDir = join(harness, "packages", "client", dirName);
    const typesEntry = join(pkgDir, "lib", "types", "index.d.ts");
    if (existsSync(typesEntry)) {
      // 两个键都写：精确包名 + 通配子路径（部分代码 import 具体文件）
      paths[pkgName] = [typesEntry];
      paths[`${pkgName}/*`] = [join(pkgDir, "lib", "types", "*")];
    }
  }
  if (Object.keys(paths).length === 0) return baseCfg;
  // TS 7 移除了 baseUrl —— paths 的替换值直接用**绝对路径**（无需 baseUrl）。
  tmpDir = mkdtempSync(join(tmpdir(), "shub-tsconfig-"));
  const out = join(tmpDir, "tsconfig.typecheck.json");
  writeFileSync(out, JSON.stringify({
    extends: baseCfg,
    compilerOptions: { paths },
  }, null, 2));
  return out;
}

const cfgPath = withClientPaths(join(root, "tsconfig.json"));
const typeRoots = findTypeRoots(root, buildFallbackDirs({ importMetaUrl: importMetaUrlOf() }));
const args = ["-p", cfgPath, "--noEmit"];
if (typeRoots.length > 0) args.push("--typeRoots", typeRoots.join(","));

const r = spawnSync(process.execPath, [tsPath, ...args], { encoding: "utf-8", cwd: root });
if (r.status !== 0) {
  console.error(`[typecheck] 失败（exit ${r.status}）`);
  if (r.stdout) console.error(r.stdout);
  if (r.stderr) console.error(r.stderr);
  failed = true;
} else {
  console.log(`[typecheck] 通过（0 错误）${harness ? `｜类型来自 harness: ${harness}` : "｜未定位 harness，使用本地 node_modules"}`);
}
if (!harness) {
  console.warn("[typecheck] 警告：未定位到 harness，@deepseek-ai/dsh-client-ui-* 类型可能来自 npm（可能是陈旧的 rc.2 tarball）");
}

if (tmpDir) { try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* 忽略 */ } }
process.exit(failed ? 1 : 0);

/** 供 paths.mjs 用的 import.meta.url（抽出来避免在函数里直接引用）。 */
function importMetaUrlOf() { return import.meta.url; }
