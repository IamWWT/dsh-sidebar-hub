/**
 * 构建脚本：TypeScript 源码 → dist 产物（DSH 加载的就是 dist）。
 *
 * - Host（src/host/index.ts）→ dist/index.js（Node ESM；node 内建、
 *   @deepseek-ai/*、node-pty、ws 保持 external）
 * - Client（src/client/entry.ts）→ dist/client.js（**closure-factory**：
 *   window.__ModuleLoader__.load({id, factory})，externals 经 factory 的
 *   require 解析（模块表 CJS 模型，classic <script> 加载，无 import map）。
 *   react/react-dom/@deepseek-ai/* 保持 external；clsx/dompurify/mermaid/
 *   react-icons 内联；.css 经 plugin 转为 <style> 注入）
 *
 * 安装：pnpm build 后 npm pack 产 tarball，再装进目标 profile。
 * 验证：临时实例（DSH_HOME 工作区内 + 端口 3084）。
 */
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";

const common = {
  bundle: true,
  sourcemap: false,
  target: "es2022",
  logLevel: "info",
};

await build({
  ...common,
  entryPoints: ["src/host/index.ts"],
  format: "esm",
  platform: "node",
  external: ["node:*", "@deepseek-ai/*", "node-pty", "ws"],
  outfile: "dist/index.js",
});

// DSH 模块表种子（packages/client/web/src/platform.ts PLATFORM_MODULES）：
// client 的 bare import 由模块表在运行时经 factory require 解析。
const PLATFORM_MODULES = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/client",
  "@deepseek-ai/cordis",
  "@deepseek-ai/dsh-client-store",
  "@deepseek-ai/dsh-client-ui-slots",
  "@deepseek-ai/dsh-client-ui-primitives",
  "@deepseek-ai/dsh-client-ui-dockkit",
];

// .css import → 副作用模块：注入 <style>（避免 esbuild 产出独立 css 文件）。
const cssInjectPlugin = {
  name: "css-inject",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const css = await readFile(args.path, "utf8");
      return {
        contents:
          `const style = document.createElement('style');`
          + `style.textContent = ${JSON.stringify(css)};`
          + `document.head.appendChild(style);`,
        loader: "js",
      };
    });
  },
};

// Client：CJS bundle（externals → require），再包成 __ModuleLoader__ 工厂。
// 注意：esbuild 的 CJS 产物假定 `module`/`exports` 由宿主（CommonJS 环境）
// 提供，并不会自己声明 var module —— 而 DSH 的 factory 里没有它们，所以
// factory 必须声明 var module/var exports 供产物使用（entry.ts 以
// exports.name/inject/apply 赋值，build.mjs 最后 return module.exports）。
const client = await build({
  ...common,
  entryPoints: ["src/client/entry.ts"],
  format: "cjs",
  platform: "browser",
  plugins: [cssInjectPlugin],
  external: [...PLATFORM_MODULES, "@deepseek-ai/*"],
  write: false,
});
const code = client.outputFiles[0].text;
const wrapped =
  `window.__ModuleLoader__.load({\n`
  + `  id: "dsh-sidebar-hub",\n`
  + `  factory: function (require) {\n`
  + `    var module = { exports: {} };\n`
  + `    var exports = module.exports;\n`
  + `${code}\n`
  + `    return module.exports;\n`
  + `  },\n`
  + `});\n`;
await writeFile("dist/client.js", wrapped);

// ── 惰性 chunk（mermaid）：重型库不内联进主 client bundle ──────────────
// 每个 chunk 是独立 CJS bundle，注册到 window.__dshChunks__[name] 工厂；
// externals 与主 bundle 相同（PLATFORM_MODULES + @deepseek-ai/*），由
// client 侧 chunk-loader 用 ctx.modules.import 解析。host 的
// /shub/bundle/<name>.js 静态路由伺服这些产物（见 src/host/routes.ts）。
// office chunk 自 v0.7 起移除（官方内置 Office 预览接管）。
const buildChunk = async (name, entry) => {
  const chunk = await build({
    ...common,
    entryPoints: [entry],
    format: "cjs",
    platform: "browser",
    plugins: [cssInjectPlugin],
    external: [...PLATFORM_MODULES, "@deepseek-ai/*"],
    write: false,
  });
  const body = chunk.outputFiles[0].text;
  const wrappedChunk =
    `window.__dshChunks__ = window.__dshChunks__ || {};\n`
    + `window.__dshChunks__[${JSON.stringify(name)}] = function (require) {\n`
    + `  var module = { exports: {} };\n`
    + `  var exports = module.exports;\n`
    + `${body}\n`
    + `  return module.exports;\n`
    + `};\n`;
  await writeFile(`dist/chunk-${name}.js`, wrappedChunk);
  console.log(`chunk done → dist/chunk-${name}.js`);
};

await buildChunk("mermaid", "src/client/chunks/mermaid.tsx");

console.log("build done → dist/index.js + dist/client.js + chunks");