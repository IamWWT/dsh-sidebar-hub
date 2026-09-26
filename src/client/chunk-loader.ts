/**
 * 惰性 chunk 加载器：重型预览库（mermaid / office）不内联进主 client bundle，
 * 首次用到时经 <script src="/shub/bundle/<name>.js"> 注入并执行。
 *
 * 产物契约（见 build.mjs 的 buildChunk）：dist/chunk-<name>.js 是 CJS 闭包，
 * 注册 `window.__dshChunks__[name] = (require) => exports`；chunk 的 externals
 * （react / @deepseek-ai/* 等）经本 loader 的 require 用 DSH 模块系统
 * （ctx.modules.import）解析——只用模块表种子词解析，跨版本稳定。
 *
 * 缓存：每 chunk 一个 in-flight promise，memoized 到 resetChunks；失败清缓存
 * 下次重试。脚本重复执行只覆盖全局注册槽（赋值语义），无「重复注册」错误。
 */

/** 主 bundle 与 chunk 共用的模块表种子（与 build.mjs PLATFORM_MODULES 一致）。 */
export const CHUNK_EXTERNALS: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
];

/** 一个 chunk 工厂：(require) => exports（chunk 的 CJS 闭包形状）。 */
type ChunkFactory = (require: (spec: string) => unknown) => Record<string, unknown>;

/** chunk 脚本注册的全局槽（赋值，不是注册——重复执行安全）。 */
interface ChunkRegistry {
  [name: string]: ChunkFactory | undefined;
}
function chunkRegistry(): ChunkRegistry {
  const g = globalThis as { __dshChunks__?: ChunkRegistry };
  return g.__dshChunks__ ??= {};
}

/** 模块系统服务面（DSH 客户端 `ctx.modules`，rc.8+）。 */
export interface ChunkModuleSystem {
  import(specifier: string): Promise<unknown>;
}

/** 插件全局上承载模块系统（chunk 闭包如需再 require 同一套 externals）。 */
const MODULE_SYSTEM_GLOBAL = '__dshSidebarModuleSystem__';
let injectedModuleSystem: ChunkModuleSystem | undefined;

/**
 * 注入客户端模块系统（主 bundle apply() 时用 ctx.modules 调用）。
 * @param system - DSH 模块系统；undefined 清除（测试）。
 */
export function setChunkModuleSystem(system: ChunkModuleSystem | undefined): void {
  injectedModuleSystem = system;
  const g = globalThis as Record<string, unknown>;
  if (system === undefined) delete g[MODULE_SYSTEM_GLOBAL];
  else g[MODULE_SYSTEM_GLOBAL] = system;
}

function moduleSystem(): ChunkModuleSystem | undefined {
  const g = globalThis as Record<string, unknown>;
  return injectedModuleSystem ?? g[MODULE_SYSTEM_GLOBAL] as ChunkModuleSystem | undefined;
}

/** 默认 script 注入器（同源 classic <script>，加载即执行）。 */
async function defaultScriptLoader(src: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.async = true;
    el.src = src;
    el.addEventListener('load', () => { el.remove(); resolve(); }, { once: true });
    el.addEventListener('error', () => {
      el.remove();
      reject(new Error(`[dsh-sidebar-hub] chunk script ${src} failed to load`));
    }, { once: true });
    document.head.append(el);
  });
}

/** 每页一次的外部依赖 require（从模块表种子解析，缓存）。 */
let externalsRequire: ((spec: string) => unknown) | undefined;

async function buildExternalsRequire(modules: ChunkModuleSystem): Promise<(spec: string) => unknown> {
  if (externalsRequire !== undefined) return externalsRequire;
  const entries = await Promise.all(CHUNK_EXTERNALS.map(async (spec) => {
    try {
      return [spec, await modules.import(spec)] as const;
    } catch {
      // 模块表解析失败按缺失处理；只有 chunk 实际 require 到它才 loud。
      return [spec, undefined] as const;
    }
  }));
  const table = new Map<string, unknown>(entries);
  externalsRequire = (spec: string): unknown => {
    if (!table.has(spec)) {
      throw new Error(`[dsh-sidebar-hub] chunk require('${spec}') missed the module table`);
    }
    return table.get(spec);
  };
  return externalsRequire;
}

/** 内存缓存：in-flight / 已完成；失败移除（下次重试重新注入执行）。 */
const cache = new Map<string, Promise<Record<string, unknown>>>();

/**
 * 加载（一次）并物化一个惰性 chunk，返回其模块导出。并发调用共享同一
 * in-flight promise；失败清缓存，脚本重复执行覆盖全局槽后重试成功。
 * @param name - chunk 名（= dist/chunk-<name>.js）。
 */
export async function loadChunk(name: string): Promise<Record<string, unknown>> {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  const task = (async (): Promise<Record<string, unknown>> => {
    const modules = moduleSystem();
    if (modules === undefined) {
      throw new Error(`[dsh-sidebar-hub] chunk "${name}": client module system unavailable`);
    }
    await defaultScriptLoader(`/shub/bundle/${name}.js`);
    const factory = chunkRegistry()[name];
    if (typeof factory !== 'function') {
      throw new Error(`[dsh-sidebar-hub] chunk "${name}" script did not register its factory`);
    }
    const require = await buildExternalsRequire(modules);
    return factory(require);
  })();
  cache.set(name, task);
  void task.catch(() => { cache.delete(name); });
  return task;
}

/** 清空 chunk 缓存（插件重新激活时调用；下次懒加载重新注入执行）。 */
export function resetChunks(): void {
  cache.clear();
  externalsRequire = undefined;
}
