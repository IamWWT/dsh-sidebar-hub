/**
 * Host settings 冒烟测试：用**真实 schemastery**（3.18.4，含 `.volatile()`）验证
 * `sidebar-hub` 命名空间的 schema 行为，不启动 DSH。
 *
 * 为什么值得单独测：settings 的解析/合并语义（`mergeLayers` 深合并普通对象、
 * 数组整桶替换、schema 补默认值）决定「用户只改一条映射」时会不会把出厂映射
 * 冲掉——这是 T5 最容易静默出错的地方，靠读源码得到的结论必须用真实 schema 证一遍。
 *
 * 上游 0.2.0-rc.2 新契约：命名空间 schema 来自 entry 导出的 `Config`
 * （`SettingsForms.describe()` 遍历 entry → `schema = entry.fiber.runtime.Config`，
 *   `volatileForm` 只投影标 `.volatile()` 的字段 → `projectForm` 投影值）。
 * 本测试用与上游相同的手法（validate → 解 volatile → projectForm）验证
 * 出厂分类 / 深合并 / 数组整桶替换 / 默认值补齐。
 *
 * 做法：用 esbuild 把 `src/host/settings.ts` 打成临时 ESM（schemastery 保持
 * external，于是解析到插件的 node_modules），再 import 断言。
 */
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = resolve(root, 'node_modules/.cache/shub-smoke/host-settings.mjs');

const result = await build({
  entryPoints: [resolve(root, 'src/host/settings.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  external: ['@deepseek-ai/schemastery'],
  write: false,
  logLevel: 'silent',
});
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, result.outputFiles[0].text);

const mod = await import(pathToFileURL(outFile).href);
const { Config: schema, HUB_SETTINGS_BASE: base, SETTINGS_NAMESPACE: ns } = mod;
/** schemastery 模块本身（client 侧 `new Schema(json)` 还原 wire envelope）。 */
const schemastery = (await import('@deepseek-ai/schemastery')).default;

// ── 上游 describe 链路的最小复刻（`packages/settings/settings/src/schema.ts`）──
// volatile 字段经 schemastery 解析后是 `Symbol.for('cosmokit.volatile.write')`
// 标记的引用包装，`plainConfig` 解开；`volatileForm` 只投影 volatile 字段。
const VOLATILE = Symbol.for('cosmokit.volatile.write');

/** 解开 volatile 引用包装（等价 `schema.ts: plainConfig`）。 */
function plainConfig(value) {
  if (typeof value === 'object' && value !== null && VOLATILE in value) return plainConfig(value.get());
  if (Array.isArray(value)) return value.map(plainConfig);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plainConfig(child)]));
  }
  return value;
}

/** 只保留带 `.volatile()` 标记的字段（等价 `schema.ts: volatileForm`）。 */
function volatileForm(schemaLike) {
  if (schemaLike.meta?.volatile) return schemaLike;
  if (schemaLike.type === 'object') {
    const dict = Object.fromEntries(Object.entries(schemaLike.dict ?? {}).flatMap(([key, child]) => {
      const field = volatileForm(child);
      return field === undefined ? [] : [[key, field]];
    }));
    return Object.keys(dict).length === 0 ? undefined : schemastery.object(dict);
  }
  return undefined;
}

/** 按字段投影（等价 `schema.ts: projectForm`）。 */
function projectForm(schemaLike, value) {
  if (schemaLike.type === 'object' && value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(schemaLike.dict ?? {}).flatMap(([key, child]) => {
      const field = Reflect.get(value, key);
      return field === undefined ? [] : [[key, projectForm(child, field)]];
    }));
  }
  return value;
}

/**
 * 把一层输入（出厂 base 或 base ⊕ 用户补丁）解析成**设置文档值**：
 * `Config.validate` → 解 volatile → 按 volatile 字段投影。
 * 这就是上游 `SettingsForms.describe()` 对某个 entry 做的同样三件事。
 */
function formOf(input) {
  const validated = schema['~standard'].validate(input);
  if (validated.issues) throw new Error(`schema validate 失败: ${JSON.stringify(validated.issues)}`);
  const form = volatileForm(schema);
  return projectForm(form, plainConfig(validated.value));
}

/**
 * settings 服务的层合并（镜像 `packages/settings/settings/src/index.ts` 的
 * `mergeLayers`）：普通对象深合并，数组/标量整块替换。
 */
function mergeLayers(under, over) {
  if (over === undefined) return under;
  const isPlain = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
  if (!isPlain(under) || !isPlain(over)) return over;
  const merged = { ...under };
  for (const [key, value] of Object.entries(over)) {
    merged[key] = key in merged ? mergeLayers(merged[key], value) : value;
  }
  return merged;
}

// 1) 命名空间与出厂 base（v0.1.7：命名空间 = profile 条目 id，不再是包名）
assert.equal(ns, 'sidebar-hub');
assert.match(ns, /^[a-z][a-z0-9-]*$/, '命名空间必须是「小写连字符」标识');
// 用户 2026-09-13 指定顺序：官方第一、工作台第二；v0.8 起四组（工程与任务删除）
assert.deepEqual(
  base.groups.map(group => group.id),
  ['official', 'workbench', 'browse-tools', 'games'],
);
assert.equal(base.groups[2].title, '工具', '「浏览与工具」v0.8 改名「工具」（分组 id 不变）');
assert.equal(base.entries['audio-transcriber'].groupId, 'browse-tools');
assert.equal(base.entries.guide.hidden, true, '框架内部 kind（引导页）出厂即隐藏');
assert.equal(base.entries.terminal.groupId, 'official', '官方终端出厂归「官方」组（与 Files 同组，恢复默认一致）');
assert.equal(base.entries.browser.groupId, 'official', '官方浏览器出厂归「官方」组（v0.5）');
assert.equal(base.entries.sudoku.groupId, 'games', '数独出厂归「游戏」组（v0.2）');
assert.equal(base.entries['hub-terminal'], undefined, '自研终端 kind 不再保留规则');
assert.equal(base.entries['hub-git'], undefined, 'v0.6 起 hub 自研内容类型不再保留规则');
assert.equal(base.entries['hub-browser'], undefined, '自研浏览器 kind 不再保留规则');

// 2) 设置字段必须标 volatile（否则 describe 不投影），运行配置字段不标
const formSchema = volatileForm(schema);
assert.deepEqual(Object.keys(formSchema.dict ?? {}).sort(), ['drift', 'entries', 'groups', 'order'],
  'v0.1.7：settings 文档只含 volatile 设置字段（运行配置不进设置文档）');

// 3) 无 user 层：formOf({}) 即出厂分类（schema 补默认字段）
const fresh = formOf({});
assert.equal(fresh.groups.length, 4, 'v0.8 起默认四组');
assert.equal(fresh.groups[0].collapsed, false, 'schema 应补 collapsed 默认值');
assert.equal(fresh.entries.files.groupId, 'official');
assert.equal(fresh.entries.files.label, '', '未设置字段应为空串（存储形态字段齐全）');

// 4) 用户只改一条映射：深合并保留其它出厂规则
const patched = formOf(mergeLayers(base, { entries: { mystery: { groupId: 'games' } } }));
assert.equal(patched.entries.mystery.groupId, 'games', '新规则应生效');
assert.equal(patched.entries.terminal.groupId, 'official', '其余出厂规则必须保留（字典深合并）');

// 5) 用户改分组列表：数组整桶替换（因此「恢复默认」只能 unset，不能 set）
const replaced = formOf(mergeLayers(base, { groups: [{ id: 'mine', title: '我的分组' }] }));
assert.deepEqual(replaced.groups.map(group => group.id), ['mine'], '数组整桶替换（settings 语义）');
assert.equal(replaced.groups[0].collapsed, false);

// 6) order 也是字典：深合并、缺键继承
const ordered = formOf(mergeLayers(base, { order: { games: ['a', 'b'] } }));
assert.deepEqual(ordered.order.games, ['a', 'b']);
assert.deepEqual(ordered.order['browse-tools'] ?? [], [], '未设置的组无顺序桶');

// 7) wire envelope：toJSON() 可序列化，且能被 client 侧 `new Schema(json)` 还原
//    （settings 的描述镜像把 schema.toJSON() 发到浏览器，client 再 rehydrate 校验；
//    这个往返是「映射写入后分类页能否读回」的关键路径）
const envelope = JSON.parse(JSON.stringify(schema.toJSON()));
assert.equal(typeof envelope, 'object');
assert.ok(envelope.refs !== undefined, 'envelope 应是 {uid, refs} 引用表形态');
const revived = new schemastery(envelope);
assert.deepEqual(Object.keys(formOf(mergeLayers(base, {}))).sort(), ['drift', 'entries', 'groups', 'order']);
assert.equal(formOf(base).entries['audio-transcriber'].groupId, 'browse-tools', '还原后的 schema 仍能解析出厂分类');

// 8) v0.1.4 R2：drift 桶 —— base 是空基线（首跑触发静默初始化），用户层整值写入
assert.deepEqual(formOf(base).drift, { kinds: {}, ack: '' }, 'drift 出厂即空基线');
const userDrift = { kinds: { terminal: { title: '终端' } }, ack: 'terminal\u0000' };
assert.deepEqual(formOf(mergeLayers(base, { drift: userDrift })).drift, userDrift, '用户层 drift 整值保留');
assert.deepEqual(formOf(mergeLayers(base, { drift: { ack: 'sig' } })).drift, { kinds: {}, ack: 'sig' }, '部分 drift 由 schema 补默认值');
assert.deepEqual(formOf(mergeLayers(base, { drift: { kinds: { files: { title: '文件' } }, ack: 'x' } })).drift.kinds.files, { title: '文件' },
  'v0.1.5：drift 记录只留 title（不再有 official）');

await rm(outFile, { force: true });
console.log('smoke: host settings OK（命名空间=sidebar-hub / 出厂 base / 深合并 / 数组整桶替换 / 默认值补齐 / Config volatile 字段）');
