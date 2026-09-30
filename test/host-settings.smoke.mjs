/**
 * Host settings 冒烟测试：用**真实 schemastery**（目标 profile 里那份 3.18.2）验证
 * `dsh-sidebar-hub` 命名空间的 schema 行为，不启动 DSH。
 *
 * 为什么值得单独测：settings 的解析/合并语义（`mergeLayers` 深合并普通对象、
 * 数组整桶替换、schema 补默认值）决定「用户只改一条映射」时会不会把出厂映射
 * 冲掉——这是 T5 最容易静默出错的地方，靠读源码得到的结论必须用真实 schema 证一遍。
 *
 * 做法：用 esbuild 把 `src/host/settings.ts` 打成临时 ESM（schemastery 保持
 * external，于是解析到插件的 node_modules → 目标 profile 那份），再 import 断言。
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
const { HubSettingsSchema: schema, HUB_SETTINGS_BASE: base, SETTINGS_NAMESPACE: ns } = mod;
/** schemastery 模块本身（client 侧 `new Schema(json)` 还原 wire envelope）。 */
const schemastery = (await import('@deepseek-ai/schemastery')).default;

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

// 1) 命名空间与出厂 base
assert.equal(ns, 'dsh-sidebar-hub');
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

// 2) 无 user 层：schema(base) 即出厂分类（schema 补默认字段）
const fresh = schema(base);
assert.equal(fresh.groups.length, 4, 'v0.8 起默认四组');
assert.equal(fresh.groups[0].collapsed, false, 'schema 应补 collapsed 默认值');
assert.equal(fresh.entries.files.groupId, 'official');
assert.equal(fresh.entries.files.label, '', '未设置字段应为空串（存储形态字段齐全）');

// 3) 用户只改一条映射：深合并保留其它出厂规则
const patched = schema(mergeLayers(base, { entries: { mystery: { groupId: 'games' } } }));
assert.equal(patched.entries.mystery.groupId, 'games', '新规则应生效');
assert.equal(patched.entries.terminal.groupId, 'official', '其余出厂规则必须保留（字典深合并）');

// 4) 用户改分组列表：数组整桶替换（因此「恢复默认」只能 unset，不能 set）
const replaced = schema(mergeLayers(base, { groups: [{ id: 'mine', title: '我的分组' }] }));
assert.deepEqual(replaced.groups.map(group => group.id), ['mine'], '数组整桶替换（settings 语义）');
assert.equal(replaced.groups[0].collapsed, false);

// 5) order 也是字典：深合并、缺键继承
const ordered = schema(mergeLayers(base, { order: { games: ['a', 'b'] } }));
assert.deepEqual(ordered.order.games, ['a', 'b']);
assert.deepEqual(ordered.order['browse-tools'] ?? [], [], '未设置的组无顺序桶');

// 6) wire envelope：toJSON() 可序列化，且能被 client 侧 `new Schema(json)` 还原
//    （settings 的描述镜像把 schema.toJSON() 发到浏览器，client 再 rehydrate 校验；
//    这个往返是「映射写入后分类页能否读回」的关键路径）
const envelope = JSON.parse(JSON.stringify(schema.toJSON()));
assert.equal(typeof envelope, 'object');
assert.ok(envelope.refs !== undefined, 'envelope 应是 {uid, refs} 引用表形态');
const revived = new schemastery(envelope);
assert.deepEqual(Object.keys(revived(mergeLayers(base, {}))).sort(), ['drift', 'entries', 'groups', 'order']);
assert.equal(revived(base).entries['audio-transcriber'].groupId, 'browse-tools', '还原后的 schema 仍能解析出厂分类');

// 7) v0.1.4 R2：drift 桶 —— base 是空基线（首跑触发静默初始化），用户层整值写入
assert.deepEqual(revived(base).drift, { kinds: {}, ack: '' }, 'drift 出厂即空基线');
const userDrift = { kinds: { terminal: { title: '终端' } }, ack: 'terminal\u0000' };
assert.deepEqual(revived(mergeLayers(base, { drift: userDrift })).drift, userDrift, '用户层 drift 整值保留');
assert.deepEqual(revived(mergeLayers(base, { drift: { ack: 'sig' } })).drift, { kinds: {}, ack: 'sig' }, '部分 drift 由 schema 补默认值');
assert.deepEqual(revived(mergeLayers(base, { drift: { kinds: { files: { title: '文件' } }, ack: 'x' } })).drift.kinds.files, { title: '文件' },
  'v0.1.5：drift 记录只留 title（不再有 official）');

await rm(outFile, { force: true });
console.log('smoke: host settings OK（命名空间 / 出厂 base / 深合并 / 数组整桶替换 / 默认值补齐）');
