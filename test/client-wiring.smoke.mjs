/**
 * 客户端接线冒烟测试（无浏览器：直接跑 dist/client.js 的 closure-factory）。
 *
 * 覆盖 spec 002 的接线契约（浏览器验证之外的第一道门禁）：
 *   1. 工厂注册恰好一次（`__ModuleLoader__.load`），没有顶层 import；
 *   2. v0.6 起不注册任何 `hub-*` 类型与正文（自研内容全部下线，只做入口编排）；
 *   3. `sidebar.right.tab.guide` chain 条目注册，`select` 恒接管且返回稳定引用；
 *   4. 自动发现 + 映射表：分组、官方标记、hidden 条目、未登记 kind 落「其他」；
 *   5. 点条目 → `openTab(kind)`；点分组头 → 折叠状态进快照。
 *
 * 用假 react（createElement 记录树 + hooks 直通）代替真实渲染，
 * 因此它验证的是「接线与数据流」，不是像素。
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const code = await readFile(new URL('../dist/client.js', import.meta.url), 'utf8');

// ── 假 react：够跑组件函数体与 createElement 记录 ──────────────────────────
/**
 * 状态化的迷你 React：支持
 *   - createElement / jsx 记录元素；
 *   - **函数组件递归展开**（真实 React 会展开，纯记录不会，测试就会"看不到"子组件）；
 *   - `useState` 在**同一实例**的多次重渲染之间保持（实例按树内路径稳定标识），
 *     于是"点开折叠卡片 → 再渲染 → 看到表格"这类交互能在冒烟里测出来。
 * 这样冒烟装配与真实 React 的差异只剩「事件批处理」这类无关项。
 */
let currentInstance = null;
const instances = new Map();
let renderEpoch = 0;

const react = {
  createElement: (type, props, ...children) => ({
    type,
    props: props ?? {},
    children: children.flat(),
  }),
  Fragment: Symbol('Fragment'),
  useState: (initial) => {
    const instance = currentInstance;
    const index = instance === null ? 0 : instance.cursor++;
    if (instance !== null && !(index in instance.hooks)) {
      instance.hooks[index] = typeof initial === 'function' ? initial() : initial;
    }
    const value = instance === null ? (typeof initial === 'function' ? initial() : initial) : instance.hooks[index];
    return [value, (next) => {
      if (instance === null) return;
      instance.hooks[index] = typeof next === 'function' ? next(instance.hooks[index]) : next;
    }];
  },
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useRef: (value) => ({ current: value }),
};

/**
 * 递归展开元素树：函数组件按「树内路径」找回自己的实例（状态跨重渲染保持）。
 * @param node - 元素、数组或文本。
 * @param path - 树内稳定路径。
 * @returns 展开后的节点（children 已展开）。
 */
const expandTree = (node, path = '0') => {
  if (Array.isArray(node)) return node.map((child, index) => expandTree(child, `${path}.${index}`));
  if (typeof node !== 'object' || node === null) return node;
  let current = node;
  if (typeof current.type === 'function') {
    let instance = instances.get(path);
    if (instance === undefined) {
      instance = { hooks: [], cursor: 0 };
      instances.set(path, instance);
    }
    instance.cursor = 0;
    const previous = currentInstance;
    currentInstance = instance;
    try {
      current = current.type(current.props);
    } finally {
      currentInstance = previous;
    }
    // 展开结果可能仍是函数组件（注册包装层 → 真组件）：换一条子路径继续展开，
    // 否则包装层与真组件会共享同一个实例槽（cursor/hooks 互相踩）。
    return expandTree(current, `${path}#r`);
  }
  if (typeof current !== 'object' || current === null) return current;
  const children = (current.children ?? []).map((child, index) => expandTree(child, `${path}.c${index}`));
  return { ...current, children };
};

/**
 * 渲染一个注册项（先调用注册包装，再展开）。
 * @param registration - `{ component }` 注册记录。
 * @param props - 组件 props。
 * @returns 展开后的树。
 */
const registrationPaths = new WeakMap();
let registrationSeq = 0;
const renderRegistered = (registration, props) => {
  // 同一个注册项的各次重渲染必须落在**同一条实例路径**上，useState 才会保持
  // （每渲染换前缀 = 每次都是新实例 = 折叠永远打不开）。
  let prefix = registrationPaths.get(registration);
  if (prefix === undefined) {
    prefix = `reg${++registrationSeq}`;
    registrationPaths.set(registration, prefix);
  }
  renderEpoch += 1;
  return expandTree(registration.component(props), prefix);
};

/**
 * jsx-runtime 形态：children 在 props 里（第三个参数是 key，不是 child）。
 * @param type - 元素类型。
 * @param props - 元素属性（children 也在这里）。
 * @param key - 可选 key。
 * @returns 与 createElement 同形的节点。
 */
const jsx = (type, props, key) => {
  const children = props?.children === undefined ? [] : [].concat(props.children);
  return { type, props: { ...(props ?? {}) }, key, children: children.flat() };
};

const loaded = [];
globalThis.window = {
  __ModuleLoader__: { load: (mod) => { loaded.push(mod); } },
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { origin: 'http://127.0.0.1:3084' },
};
globalThis.document = {
  createElement: () => ({ textContent: '' }),
  head: { appendChild: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
};

/** 通用桩：任何命名导出都返回一个可调用的占位组件（本测不看它们的渲染）。 */
const primitivesStub = new Proxy({}, {
  get: (_target, prop) => {
    if (prop === '__esModule') return true;
    return (props) => react.createElement(String(prop), props ?? {});
  },
});

const requireFn = (id) => {
  if (id === 'react') return react;
  if (id === 'react/jsx-runtime') {
    return { jsx, jsxs: jsx, Fragment: react.Fragment };
  }
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub;
  throw new Error(`smoke: 未覆盖的 external require(${id})`);
};

// ── 执行产物（等价于浏览器 <script> 加载）────────────────────────────────
// eslint-disable-next-line no-new-func
new Function('window', 'document', 'require', code)(globalThis.window, globalThis.document, requireFn);

assert.equal(loaded.length, 1, '工厂必须恰好注册一次');

// 静态门禁（spec §7-8/§7-9）：不注册官方文件 kind、closure-factory 契约、无 /sidebar 前缀残留
assert.equal((code.match(/__ModuleLoader__\.load\(/g) ?? []).length, 1, 'closure-factory 必须恰好注册一次');
assert.ok(!/^\s*import\s+[\s\S]*?from\s+['"]/m.test(code.replace(/^[\s\S]*?"use strict";/, '')), '产物不得有顶层 import');
// v0.3：渲染器解析官方 file 地址（dsh-resource://file/session/...）是合法行为；
// 红线收窄为「不得注册 kind=files 的类型 / 不得认领 file/** viewer」。
assert.ok(!/kind:\s*['"]files['"]/.test(code), '不得注册 kind="files" 的类型（红线）');
// v0.6 起 hub 自研内容类型全部移除，client API 层（terminal-api）不再存在；
// 本插件唯一剩余的网络面是 /shub/file（md 图片）与 /shub/bundle（惰性 chunk）。
assert.ok(!/editor/.test(code) || !/patterns:\s*\[[^\]]*file\/\*\*/.test(code), '不得注册 file/** 的 viewer（红线）');
assert.equal(loaded[0].id, 'dsh-sidebar-hub');

// v0.3 惰性 chunk 产物门禁：dist/chunk-mermaid.js 存在且注册工厂
// （window.__dshChunks__[name] = factory），即主 bundle 惰性加载的契约成立。
// office chunk 自 v0.7 起移除（官方内置 Office 预览接管）。
for (const name of ['mermaid']) {
  const chunkCode = await readFile(new URL(`../dist/chunk-${name}.js`, import.meta.url), 'utf8');
  assert.match(chunkCode, new RegExp(`__dshChunks__\\[${JSON.stringify(name)}\\]\\s*=\\s*function`),
    `chunk-${name}.js 必须注册 __dshChunks__ 工厂`);
}

const plugin = loaded[0].factory(requireFn);
assert.equal(plugin.name, 'sidebar-hub');
assert.deepEqual(plugin.inject, ['slots', 'sidebarRightTabs', 'sidebarRight', 'webTerminals']);

// ── 假 ctx：迷你 tab 注册表 + 插槽系统 ───────────────────────────────────
const definitions = [];
const registrations = [];
const injections = [];
const opened = [];
const terminalCalls = [];
let guideEntries = [];
const subscribers = new Set();

const registry = {
  register: (definition) => {
    definitions.push(definition);
    for (const entry of definition.guide ?? []) {
      guideEntries.push({ ...entry, kind: definition.kind, _def: definition });
    }
    guideEntries.sort((left, right) => left.order - right.order);
    for (const listener of subscribers) listener();
    // 可注销：模拟 DSH 升级/插件卸载移除一个能力（漂移「移除」场景）。
    return () => {
      const at = definitions.indexOf(definition);
      if (at >= 0) definitions.splice(at, 1);
      guideEntries = guideEntries.filter(entry => entry._def !== definition);
      guideEntries.sort((left, right) => left.order - right.order);
      for (const listener of subscribers) listener();
    };
  },
  /** v0.1.4 R1：全量在效 tab 定义（旧宿主没有此方法，discover 退回 guide-only）。 */
  entries: () => definitions,
  guide: () => guideEntries,
  subscribe: (listener) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; },
};

const injectedCallbacks = new Map();
const ctx = {
  effect: (callback) => { callback(); return () => {}; },
  inject: (names, callback) => { for (const name of names) injectedCallbacks.set(name, callback); return () => {}; },
  slots: {
    inject: (key, callback) => { const dispose = callback(); injections.push({ key, dispose }); return () => {}; },
    register: (spec, component) => { registrations.push({ spec, component }); return () => {}; },
  },
  sidebarRightTabs: registry,
  sidebarRight: { openTab: (kind) => { opened.push(kind); }, openTabIn: (session, kind, options) => { opened.push(kind); terminalCalls.push(['open', session, kind, options]); } },
  webTerminals: { launchShells: async (session, signal) => { terminalCalls.push(['load', session, signal]); return { shells: [{ name: 'PowerShell', path: 'C:/Windows/pwsh.exe' }, { name: 'bash', path: '/bin/bash' }] }; }, selectShell(path) { terminalCalls.push(['select', path]); } },
};

// 预置：三个自研工作台 + 语音工具 + 官方 files/terminal/browser + 小游戏（模拟其它插件先注册）
// v0.1.4 R1：官方 kind 用 @deepseek-ai/ 前缀 id（真实 DSH 的官方包命名），
// 自研插件用 seed/ 前缀（第三方 → 非官方）。
for (const [kind, title, order, official = false] of [
  ['daily-workbench', '个人工作台', 10],
  ['troubleshoot-workbench', '故障排查工作台', 11],
  ['trading-workbench', '交易工作台', 12],
  ['audio-transcriber', '语音转文字', 40],
  ['files', '文件', 5, true],
  ['terminal', '终端', 6, true],                     // 官方内置终端（v0.2 起转发）
  ['browser', '浏览器', 7, true],                    // 官方内置浏览器（v0.5 起转发）
  ['guide', '开始', 3, true],                        // 框架内部 kind → 映射表 hidden
  ['text', '文本查看器', 4, true],                    // 框架内部 kind → 映射表 hidden
  ['minesweeper', '🎮 扫雷', 80],
  ['sudoku', '🧩 数独', 81],
  ['mystery-plugin', '未知插件', 90],
]) {
  registry.register({ id: official ? `@deepseek-ai/${kind}` : `seed/${kind}`, kind, title: () => title, guide: [{ order, title: () => title }] });
}
// v0.1.4 R1/R3 关键形态：DSH 升级后新出现的 kind **只有 tab 定义、没有 guide 入口**
// （0.2.x 里浏览器能力正是这样消失的）——只能靠 entries() 发现。
registry.register({ id: '@deepseek-ai/fresh-official', kind: 'fresh-official', title: () => '新官方能力' });
registry.register({ id: 'fresh-plugin', kind: 'fresh-plugin', title: () => '新插件入口' });

plugin.apply(ctx);

// 1) v0.6 起 hub 自研内容类型全部移除：不注册任何 hub-* 类型与正文，只做入口编排。
const hubKinds = definitions.filter(d => d.kind.startsWith('hub-')).map(d => d.kind);
assert.deepEqual(hubKinds, [], '不得再注册任何 hub-* 类型（v0.6 起自研内容全部下线）');
assert.ok(!definitions.some(d => d.kind === 'hub-terminal' || d.kind === 'hub-browser'), '不得注册 hub-terminal / hub-browser');

// 2) 无正文（v0.6 起 hub 没有可打开的落地页）+ guide chain
const paneInjections = injections.filter(i => i.key === 'sidebar.right.pane.tab');
assert.equal(paneInjections.length, 0, 'v0.6 起不注册任何 hub 正文');
assert.equal(injections.filter(i => i.key === 'sidebar.right.tab.guide').length, 1, 'guide chain 一条');
assert.equal(registrations.filter(r => r.spec.name === 'sidebar.right.pane.tab').length, 0, 'sidebar.right.pane.tab 无注册');

// 3) guide chain：select 恒接管、引用稳定
const guideReg = registrations.find(r => r.spec.name === 'sidebar.right.tab.guide');
assert.equal(typeof guideReg.spec.select, 'function');

assert.equal(guideReg.spec.select({}), guideReg.spec.select({}), 'select 必须返回稳定引用');

// ── 4) 分类数据流（自动发现 + 映射表）──────────────────────────────────
const guideFace = guideReg.spec.inject('session-1');
const signal = new AbortController().signal;
const shells = await guideFace.terminal.load(signal);
assert.deepEqual(terminalCalls.at(-1), ['load', 'session-1', signal]);
for (const shell of shells.shells) {
  guideFace.terminal.launch(shell.path);
  assert.deepEqual(terminalCalls.slice(-2), [['select', shell.path], ['open', 'session-1', 'terminal', { params: { shellPath: shell.path } }]]);
}
guideFace.terminal.launch();
assert.deepEqual(terminalCalls.at(-1), ['open', 'session-1', 'terminal', undefined]);
/**
 * 模拟框架的 hooks 绑定（`ui-renderer/src/client/bind.ts: bindSnapshotSelector`）：
 * 绑出来的钩子签名是 `(selector, isEqual?) => S`，selector 必填——无参调用会在
 * 框架内部崩（真实实例上出现过 `is not a function`）。因此这里必须带 selector。
 */
const bindSelectorHook = (source) => (select, isEqual) => {
  const value = source.getSnapshot();
  const picked = select(value);
  return typeof isEqual === 'function' ? picked : picked;
};
assert.deepEqual(Object.keys(guideFace.hooks), ['catalog', 'drift'], 'v0.1.4 起 hooks 格含 catalog + drift');
const props = { ...guideFace, useCatalog: bindSelectorHook(guideFace.hooks.catalog), useDrift: bindSelectorHook(guideFace.hooks.drift) };

/** 渲染起始页（每次重渲染都新调用一次组件体，等价于 React 重渲染）。 */
const render = () => renderRegistered(guideReg, props);

const groupsOf = (node) => (node.children ?? []).flatMap(child =>
  (typeof child === 'object' && child !== null && child.props?.className === 'catalogGroup' ? [child] : []));
const itemsOf = (group) => {
  const out = [];
  const walk = (node) => {
    if (typeof node !== 'object' || node === null) return;
    if (node.props?.className === 'catalogItem') out.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(group);
  return out;
};
const labelOf = (item) => (item.children.find(c => typeof c === 'object' && c.props?.className === 'catalogItemLabel')?.children ?? []).join('');
const titleOf = (group) => group.children
  .flatMap(c => (typeof c === 'object' && c !== null && c.props?.className === 'catalogGroupHeadRow' ? c.children : []))
  .flatMap(c => (typeof c === 'object' && c !== null && c.props?.className === 'catalogGroupHead' ? c.children : []))
  .flatMap(c => (typeof c === 'object' && c !== null && c.props?.className === 'catalogGroupTitle' ? c.children : [])).join('');

let tree = render();
let groups = groupsOf(tree);
const byTitle = (title) => groupsOf(render()).find(group => titleOf(group) === title);
const labelsIn = (title) => { const group = byTitle(title); return group === undefined ? [] : itemsOf(group).map(labelOf); };

// 分组顺序（用户 2026-09-13 指定：官方第一、工作台第二；v0.8 起四组）
assert.deepEqual(
  groupsOf(render()).map(titleOf).slice(0, 2),
  ['官方', '工作台'],
  '前两组应为 官方 → 工作台',
);

for (const title of ['工作台', '工具', '游戏', '官方', '其他']) {
  assert.ok(byTitle(title) !== undefined, `应有「${title}」分组`);
}
assert.ok(byTitle('工程与任务') === undefined, 'v0.8 起默认无「工程与任务」分组');
assert.deepEqual(labelsIn('工作台').sort(), ['个人工作台', '交易工作台', '故障排查工作台'].sort());
assert.deepEqual(labelsIn('工具').sort(), ['语音转文字'].sort(), '「浏览与工具」v0.8 改名「工具」');
assert.deepEqual(labelsIn('游戏').sort(), ['🧩 数独', '🎮 扫雷'].sort(), '扫雷与数独应落在默认「游戏」组');
assert.deepEqual(labelsIn('官方').sort(), ['文件', '终端', '浏览器', '新官方能力'].sort(), '官方内置终端/浏览器/文件与「无 guide 的官方新 kind」同处「官方」组（R1 发现 + R3 自动归组）');
assert.deepEqual(labelsIn('其他').sort(), ['新插件入口', '未知插件'].sort(), '未登记第三方 kind 自动落「其他」（R3）');
// 「游戏」组现在有默认成员（扫雷、数独），不再是空分组。
assert.ok(!groups.map(titleOf).some(title =>
  labelsIn(title).includes('开始') || labelsIn(title).includes('文本查看器')), 'hidden 条目不应出现');

// ── 5) 点条目 → openTab(kind)；官方条目带标记 ───────────────────────────
// v0.6 起无 hub-* 条目，改用「语音转文字」（自研语音插件入口）验证点击转发。
const voiceItem = itemsOf(byTitle('工具')).find(item => item.props['data-kind'] === 'audio-transcriber');
voiceItem.props.onClick();
assert.deepEqual(opened.slice(-1), ['audio-transcriber'], '点条目应 openTab 对应 kind');
const terminalItem = itemsOf(byTitle('官方')).find(item => item.props['data-kind'] === 'terminal');
assert.ok(terminalItem !== undefined, '官方终端条目应出现在「官方」组');
assert.ok(terminalItem.children.some(c => typeof c === 'object' && c.props?.className === 'catalogItemOfficial'),
  '官方终端条目应带「官方」标记');
terminalItem.props.onClick();
assert.deepEqual(opened.slice(-1), ['terminal'], '点官方终端条目应 openTab("terminal")（转发官方）');
const filesItem = itemsOf(byTitle('官方')).find(item => item.props['data-kind'] === 'files');
assert.ok(filesItem !== undefined && filesItem.children.some(c => typeof c === 'object' && c.props?.className === 'catalogItemOfficial'),
  '官方 Files 条目应带「官方」标记');

// ── 6) 折叠：点分组头 → 快照里 collapsed（内存态，settings 未绑定）───────
const headOf = (title) => byTitle(title).children
  .find(c => typeof c === 'object' && c.props?.className === 'catalogGroupHeadRow').children
  .find(c => typeof c === 'object' && c.props?.className === 'catalogGroupHead');
headOf('游戏').props.onClick();
assert.equal(guideFace.hooks.catalog.getSnapshot().find(group => group.id === 'games').collapsed, true, '折叠状态应进入快照');
headOf('游戏').props.onClick();

// ── 7) T5：settings 绑定 + 写回 + 恢复默认 ─────────────────────────────
const writes = [];
const unsetFields = [];
/** 取某次写入里某个桶的值。 */
const opValue = (ops, field) => ops.find(op => op.path[0] === field).value;
const groupsOfWrite = (index) => opValue(writes[index], 'groups');
const entriesOfWrite = (index) => opValue(writes[index], 'entries');
const orderOf = (ops) => opValue(ops, 'order');
const settingsListeners = new Set();
let scopeValue = {
  groups: [
    { id: 'workbench', title: '工作台', collapsed: false },
    { id: 'browse-tools', title: '工具', collapsed: false },
    { id: 'games', title: '游戏', collapsed: false },
    { id: 'official', title: '官方', collapsed: false },
  ],
  // 真实的 settings 读回值是**已解析的**（base ⊕ user 深合并）完整桶：
  // 出厂映射 + 用户把 mystery-plugin 放进「游戏」组。
  entries: {
    'daily-workbench': { groupId: 'workbench' },
    'troubleshoot-workbench': { groupId: 'workbench' },
    'trading-workbench': { groupId: 'workbench' },
    'terminal': { groupId: 'official' },
    'browser': { groupId: 'official' },
    'audio-transcriber': { groupId: 'browse-tools' },
    files: { groupId: 'official' },
    'mystery-plugin': { groupId: 'games' },
    'ghost-plugin': { groupId: 'games' },
  },
  order: {},
  // v0.1.4 R2：首跑时尚无漂移基线（base 的出厂形态）
  drift: { kinds: {}, ack: '' },
};
const fakeScope = {
  getSnapshot: () => ({ status: 'ready', value: scopeValue, writable: true, mode: 'host' }),
  subscribe: (listener) => { settingsListeners.add(listener); return () => { settingsListeners.delete(listener); }; },
  // 模拟真实 settings：写回立即落到用户层并通知快照订阅者（adopt 重算）
  mutate: (ops) => {
    writes.push(ops);
    for (const op of ops) { if (op.op === 'set') scopeValue[op.path[0]] = op.value; }
    for (const listener of settingsListeners) listener();
    return Promise.resolve();
  },
  unset: (field) => {
    unsetFields.push(field);
    delete scopeValue[field];
    for (const listener of settingsListeners) listener();
    return Promise.resolve();
  },
};
const settingsCb = injectedCallbacks.get('settingsScope');
assert.equal(typeof settingsCb, 'function', '应通过 ctx.inject 等待 settingsScope');
settingsCb({ settingsScope: { bind: (spec) => { assert.equal(spec.namespace, 'dsh-sidebar-hub'); assert.equal(typeof spec.decode, 'function'); return fakeScope; } } });

// 绑定后：以 settings 值为准（mystery 被分到「游戏」组）
assert.deepEqual(labelsIn('游戏'), ['未知插件'], '绑定 settings 后应采用其 entries');
assert.ok(guideFace.persistence() === 'host', '可写时持久化状态为 host');

// v0.1.4 R2：首跑（无基线）静默初始化漂移基线——恰好一次 drift 写，之后清掉，
// 让后续按序号断言的写序列保持原索引。
assert.equal(writes.length, 1, '首跑应静默初始化漂移基线（恰好一次写）');
assert.equal(writes[0][0].path[0], 'drift', '首跑基线应写 drift 桶');
assert.ok(Object.keys(writes[0][0].value.kinds).includes('fresh-official'), '基线应覆盖「只有 tab 定义、没有 guide 入口」的新 kind（R1 发现路径）');
assert.ok(Object.keys(writes[0][0].value.kinds).includes('terminal'), '基线应含常规 kind');
assert.equal(guideFace.hooks.drift.getSnapshot().added.length, 0, '首跑初始化不产生提醒');
writes.length = 0;

// 拖拽：把「语音转文字」从「工具」拖到「游戏」组末尾
// 注意：假 react 的 useRef 每次渲染都新建，所以一次交互内的节点必须取自**同一次渲染**。
const pickFrom = (nodes, title) => nodes.find(group => titleOf(group) === title);
let nodes = groupsOf(render());
const dragItem = itemsOf(pickFrom(nodes, '工具')).find(item => item.props['data-kind'] === 'audio-transcriber');
const gameGroup = pickFrom(nodes, '游戏');
dragItem.props.onDragStart({ dataTransfer: { setData: () => {}, effectAllowed: '' } });
gameGroup.props.onDragOver({ preventDefault: () => {} });
gameGroup.props.onDrop({ preventDefault: () => {} });
assert.equal(writes.length, 1, '拖拽应产生一次原子写');
const ops = writes[0];
assert.deepEqual(ops.map(op => op.path[0]).sort(), ['entries', 'order'], '拖拽写 entries + order 两个桶');
assert.equal(entriesOfWrite(0)['audio-transcriber'].groupId, 'games');
assert.deepEqual(orderOf(ops).games, ['mystery-plugin', 'audio-transcriber'], '落点末尾 = 现有顺序 + 追加');
// 工具组在 settings 里无显式 order（出厂默认顺序），拖出后不实体化顺序桶。
assert.equal(orderOf(ops)['browse-tools'], undefined, '无显式顺序的组不写 order 桶');
assert.deepEqual(labelsIn('游戏').sort(), ['语音转文字', '未知插件'].sort(), '拖拽后语音转文字出现在「游戏」组末尾');

// 移到「其他」：写出的 groupId 必须是空串（显式盖住 settings base 里的出厂分组，
// 否则 settings 的字典深合并会让 base 规则「复活」，条目又回到出厂分组）
const movesBefore = writes.length;
guideFace.moveEntry('mystery-plugin', null);
const otherWrite = entriesOfWrite(movesBefore);
assert.equal(otherWrite['mystery-plugin'].groupId, '', '移入「其他」应写空串而不是删键');
assert.equal(otherWrite['mystery-plugin'].hidden, false, '存储形态字段齐全');
assert.ok(labelsIn('其他').includes('未知插件'), '分类页应立刻反映「其他」归属');
guideFace.moveEntry('mystery-plugin', 'games');

// 组内排序：把「未知插件」拖到「语音转文字」前面
nodes = groupsOf(render());
const mysteryItem = itemsOf(pickFrom(nodes, '游戏')).find(item => item.props['data-kind'] === 'mystery-plugin');
const audioItemInGames = itemsOf(pickFrom(nodes, '游戏')).find(item => item.props['data-kind'] === 'audio-transcriber');
mysteryItem.props.onDragStart({ dataTransfer: { setData: () => {}, effectAllowed: '' } });
audioItemInGames.props.onDragOver({ preventDefault: () => {}, stopPropagation: () => {} });
audioItemInGames.props.onDrop({ preventDefault: () => {}, stopPropagation: () => {} });
assert.deepEqual(orderOf(writes[writes.length - 1]).games, ['mystery-plugin', 'audio-transcriber'], '组内排序应写入新的顺序');
assert.deepEqual(labelsIn('游戏'), ['未知插件', '语音转文字'], '组内排序生效');

// 新建分组 + 重命名 + 删除（按「这一次调用产生的写」断言，不用硬编码下标）
const addedId = guideFace.addGroup('我的分组');
assert.ok(groupsOfWrite(writes.length - 1).some(group => group.id === addedId && group.title === '我的分组'), '新建分组应写入 groups');
guideFace.renameGroup(addedId, '剪藏');
assert.ok(groupsOfWrite(writes.length - 1).some(group => group.id === addedId && group.title === '剪藏'), '重命名应写入 groups');
guideFace.deleteGroup(addedId);
assert.ok(!groupsOfWrite(writes.length - 1).some(group => group.id === addedId), '删除分组应从 groups 移除');
assert.equal(entriesOfWrite(writes.length - 1)['audio-transcriber'].groupId, 'games', '与删除分组无关的条目不受影响');

// 恢复默认：清 user 层（回落组合 base），不写拷贝
guideFace.resetCatalog();
await Promise.resolve();
assert.deepEqual(unsetFields.sort(), ['entries', 'groups', 'order'], '恢复默认应清三个桶');

// ── 8) T6：设置页卡片（官方 0.1.6-alpha.2 起 plugins.bundle.config）──────
const cardReg = registrations.find(r => r.spec.name === 'plugins.bundle.config');
assert.ok(cardReg !== undefined, '应注册设置页卡片（plugins.bundle.config）');
assert.equal(cardReg.spec.key, 'dsh-sidebar-hub', '卡片 key = settings 命名空间');

const cardFace = cardReg.spec.inject();
const cardProps = {
  ...cardFace,
  useRows: bindSelectorHook(cardFace.hooks.rows),
  useGroups: bindSelectorHook(cardFace.hooks.groups),
};
let cardTree = renderRegistered(cardReg, cardProps);

/** 在（已展开的）树里按 className 找元素。 */
const findIn = (node, predicate, out = []) => {
  if (typeof node !== 'object' || node === null) return out;
  if (Array.isArray(node)) { for (const child of node) findIn(child, predicate, out); return out; }
  if (predicate(node)) out.push(node);
  for (const child of node.children ?? []) findIn(child, predicate, out);
  return out;
};
/** 找到卡片内的可折叠小节头部（按小节标题文本）。 */
const subHeadOf = (tree, title) => findIn(tree, node =>
  node.props?.className === 'hubSubHead'
  && findIn(node, inner => inner.children?.includes?.(title) === true).length > 0)[0];

// 卡片默认收起（与框架插件卡片一致）→ 点开头部，再展开「条目映射」小节
const cardHead = findIn(cardTree, node => node.props?.className === 'hubCardHead')[0];
assert.equal(cardHead?.props['aria-expanded'], false, '卡片默认收起');
cardHead.props.onClick();
cardTree = renderRegistered(cardReg, cardProps);
assert.ok(findIn(cardTree, node => node.props?.className === 'hubSubHead').length >= 2, '展开后出现两个小节');
const entriesHead = subHeadOf(cardTree, '条目映射');
assert.ok(entriesHead !== undefined, '应有「条目映射」小节');
entriesHead.props.onClick();
cardTree = renderRegistered(cardReg, cardProps);

/** 收集卡片里的表格行（<tr data-kind>）。 */
const cardRows = () => findIn(cardTree, node =>
  node.type === 'tr' && typeof node.props?.['data-kind'] === 'string');
const rowOf = (kind) => cardRows().find(row => row.props['data-kind'] === kind);
/** 卡片交互后重渲染（迷你 React 保持 useState）。 */
const rerenderCard = () => { cardTree = renderRegistered(cardReg, cardProps); };
assert.ok(rowOf('audio-transcriber') !== undefined, '已登记条目应出现在卡片里');
assert.equal(rowOf('ghost-plugin').props['data-unregistered'], 'true', '配置有、注册表没有的 kind 应标「未登记」');
assert.ok(rowOf('files') !== undefined, '官方 files 也应可配置');

/** 在行内找元素（按 type 与可选条件）。 */
const inCell = (row, type, match = () => true) => {
  const out = [];
  const walk = (node) => {
    if (typeof node !== 'object' || node === null) return;
    if (node.type === type && match(node)) out.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(row);
  return out;
};

// 表单改归属：audio-transcriber → 工作台
const beforeWrites = writes.length;
inCell(rowOf('audio-transcriber'), 'select')[0].props.onChange({ target: { value: 'workbench' } });
assert.equal(entriesOfWrite(beforeWrites)['audio-transcriber'].groupId, 'workbench', '下拉改归属应写 entries');
assert.deepEqual(labelsIn('工作台').sort(), ['语音转文字', '个人工作台', '交易工作台', '故障排查工作台'].sort(), '改归属即时反映到分类页');

// 勾选隐藏：audio-transcriber 从分类页消失
inCell(rowOf('audio-transcriber'), 'input', node => node.props?.type === 'checkbox')[0].props.onChange({ target: { checked: true } });
assert.equal(entriesOfWrite(writes.length - 1)['audio-transcriber'].hidden, true, '勾选隐藏应写 entries');
assert.ok(!labelsIn('工作台').includes('语音转文字'), '隐藏后分类页不再显示该条目');

// 移除规则：未登记的 ghost-plugin 从配置里清掉
inCell(rowOf('ghost-plugin'), 'button', node => node.props?.title?.includes('移除'))[0].props.onClick();
const afterForget = entriesOfWrite(writes.length - 1);
assert.equal(afterForget['ghost-plugin'], undefined, '移除规则应删除该 kind');
rerenderCard();
assert.ok(!cardRows().some(row => row.props['data-kind'] === 'ghost-plugin'), '移除后卡片不再有该行');

// 新建分组（卡片入口）
const cardGroupsBefore = cardFace.hooks.groups.getSnapshot().length;
cardFace.addGroup('卡片新建');
assert.equal(cardFace.hooks.groups.getSnapshot().length, cardGroupsBefore + 1, '卡片新建分组应进分组源');

// ── 9) v0.1.4 R1/R2/R3：升级漂移（新发现自动归组 + 提醒 + ack 基线滚动）──
const driftView = () => guideFace.hooks.drift.getSnapshot();
assert.deepEqual(driftView(), { added: [], removed: [] }, '基线 = 当前快照时无提醒');

// 模拟 DSH 升级：新能力被注册（有 tab 定义、无 guide 入口 —— 正是 0.2.x 的形态）
registry.register({ id: '@deepseek-ai/upgraded-cap', kind: 'upgraded-cap', title: () => '升级新增能力' });
registry.register({ id: 'vendor-cap', kind: 'vendor-cap', title: () => '第三方新入口' });
assert.deepEqual(driftView().added.map(a => a.kind).sort(), ['upgraded-cap', 'vendor-cap'], '新发现能力应进入提醒');
assert.equal(driftView().added.find(a => a.kind === 'upgraded-cap').groupTitle, '官方', '官方新能力应自动归入「官方」组（R3）');
assert.equal(driftView().added.find(a => a.kind === 'upgraded-cap').official, true, '官方包能力应标记官方');
assert.equal(driftView().added.find(a => a.kind === 'vendor-cap').groupTitle, '其他', '未登记第三方新入口自动落「其他」（R3）');
assert.ok(labelsIn('官方').includes('升级新增能力'), '新官方能力应出现在「官方」组');
assert.ok(labelsIn('其他').includes('第三方新入口'), '第三方新入口应出现在「其他」组');

// 提醒横幅出现在分类页；点「知道了」→ 基线滚动、提醒消失
let driftTree = render();
const driftHead = findIn(driftTree, node => node.props?.className === 'catalogDriftHead')[0];
assert.ok(driftHead !== undefined, '漂移提醒横幅应出现在分类页');
const ackBtn = driftHead.children.find(c => typeof c === 'object' && c.props?.className === 'catalogBtn');
assert.ok(ackBtn !== undefined, '横幅应含确认按钮');
ackBtn.props.onClick();
assert.deepEqual(driftView(), { added: [], removed: [] }, '「知道了」后提醒应消失');
const ackWrite = writes[writes.length - 1];
assert.equal(ackWrite[0].path[0], 'drift', 'ack 应写 drift 桶');
assert.ok(ackWrite[0].value.kinds['upgraded-cap'] !== undefined, 'ack 后的新基线应包含新能力（升级后不再反复提醒）');
assert.ok(findIn(render(), node => node.props?.className === 'catalogDriftHead')[0] === undefined, 'ack 后横幅应从页面消失');

// 能力移除（DSH 升级移除/插件卸载）也要提醒；再次 ack 后才安静
const disposeTemp = registry.register({ id: 'temp-cap', kind: 'temp-cap', title: () => '临时能力' });
assert.deepEqual(driftView().added.map(a => a.kind), ['temp-cap'], '此前未见过的新能力再次进入提醒');
guideFace.ackDrift();
assert.deepEqual(driftView(), { added: [], removed: [] }, 'ack 后回到安静态');
disposeTemp();
assert.deepEqual(driftView().removed.map(r => r.kind), ['temp-cap'], '被移除的能力应出现在提醒');
assert.equal(driftView().removed[0].title, '临时能力');
guideFace.ackDrift();
assert.deepEqual(driftView(), { added: [], removed: [] }, '用户确认移除提醒后保持安静');

console.log('smoke: client wiring OK（1 工厂 / 0 hub-* 类型 / 0 正文 / 1 guide chain / 分组顺序与点击 / 官方终端·浏览器转发 / 拖拽与排序 / settings 写回与恢复默认 / 设置卡片折叠与表单 / v0.1.4 漂移发现·自动归组·提醒与 ack）');
