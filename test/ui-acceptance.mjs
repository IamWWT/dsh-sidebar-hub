#!/usr/bin/env node
/**
 * 真实实例 UI 验收（spec 002 §7 十条）——CDP 驱动本机 Chrome，零第三方依赖
 * （Node 内置 fetch/WebSocket + `google-chrome`）。
 *
 * 覆盖：
 *   1. 打开右侧栏 → 起始页是分类框架（`.hubCatalog` 在，原生引导页 `[data-sidebar-right-guide]` 不在）
 *   2. 自动发现 + 默认分组（工作台/工具/游戏/官方，未登记落「其他」）
 *   3. 点条目能打开内容（官方终端/浏览器 + 语音转文字转发 + 官方「文件」转发）
 *   4. 拖拽跨组 + 重载后仍生效（全局持久化）
 *   5. 设置页卡片「右侧栏分类」可维护（官方「插件」面板 → dsh-sidebar-hub 包详情 → 卡片存在）
 *   7. 隐藏条目后分类页不再显示（设置卡片勾选隐藏 → 分类页核对）
 *   8. 官方 files 未被接管（转发打开后无「无法查看」提示；静态红线由冒烟测试守）
 *   9. 无未捕获异常 / 无 error 级控制台输出
 *
 * 用法：
 *   node test/ui-acceptance.mjs --url "http://127.0.0.1:3085/?token=..." [--shot-dir ./docs/verify] [--keep]
 * 说明：
 *   - token 化 URL 是**一次性**的：本脚本会消费它；要给人看，请另起实例拿新 URL。
 *   - 只读断言 + 一次「拖拽后拖回」的写操作，不改用户的正式环境（目标实例必须是测试实例）。
 */
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};
const url = argOf('--url', process.env.SHUB_UI_URL ?? '');
const shotDir = argOf('--shot-dir', new URL('../docs/verify/', import.meta.url).pathname);
const keep = args.includes('--keep');
/** Chrome 用户目录：复用同一个可保住已认证 cookie（token 只需消费一次）。 */
const profileDir = argOf('--profile-dir', '');
const chromeBin = process.env.DSH_UI_CHROME ?? '/usr/bin/google-chrome';

if (url === '') {
  console.error('[ui] 需要 --url "<tokenized url>"（测试实例启动日志里的 http://127.0.0.1:PORT/?token=...）');
  process.exit(2);
}

const results = [];
let failed = 0;
/** 记录一条断言。 */
function check(name, ok, detail = '') {
  results.push({ name, ok: ok === true, detail: String(detail) });
  if (ok !== true) failed += 1;
  console.log(`${ok === true ? 'PASS' : 'FAIL'}  ${name}${detail === '' ? '' : `  — ${detail}`}`);
}

// ── Chrome + CDP 承载 ───────────────────────────────────────────────────
const cdpPort = 19200 + Math.floor(Math.random() * 8000);
const userDir = profileDir === '' ? mkdtempSync(join(tmpdir(), 'shub-ui-')) : profileDir;
const chrome = execFile(chromeBin, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDir}`,
  '--window-size=1680,1050', url,
]);
const killChrome = () => { try { chrome.kill(); } catch { /* 已退出 */ } };
process.on('exit', killChrome);

let page = null;
for (let i = 0; i < 40 && page === null; i += 1) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
    page = list.find(target => target.type === 'page' && target.url.startsWith('http')) ?? null;
  } catch { /* CDP 未就绪 */ }
}
if (page === null) {
  console.error('[ui] FAIL 未取到 Chrome 页面目标');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let seq = 0;
const pending = new Map();
const consoleErrors = [];
const exceptions = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push((msg.params.args ?? []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push(String(msg.params.exceptionDetails?.exception?.description
      ?? msg.params.exceptionDetails?.text ?? 'unknown').slice(0, 300));
  }
};
const send = (method, params = {}) => {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise(resolve => pending.set(id, resolve));
};
await send('Runtime.enable');
await send('Page.enable');
await send('Console.enable');
// 插件 bundle 走 HTTP 缓存：不禁用的话测到的是上一次构建的 client.js
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.reload', { ignoreCache: true });
await sleep(3000);

/** 在页面里求值（返回可序列化值）。 */
const evalJs = async (expression) => {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (reply.result?.exceptionDetails !== undefined) {
    return { __error: String(reply.result.exceptionDetails.exception?.description ?? 'eval failed') };
  }
  return reply.result?.result?.value;
};
/** 轮询等待条件成立。 */
const waitFor = async (expression, timeoutMs = 20000, stepMs = 500) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await evalJs(expression);
    if (value === true) return true;
    if (Date.now() > deadline) return false;
    await sleep(stepMs);
  }
};
/** 截图落盘。 */
let shotSeq = 0;
const shot = async (name) => {
  const reply = await send('Page.captureScreenshot', { format: 'png' });
  const data = reply.result?.data;
  if (typeof data !== 'string') return '';
  mkdirSync(shotDir, { recursive: true });
  const file = join(shotDir, `${String(++shotSeq).padStart(2, '0')}-${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
};

// ── API 信封门禁：/shub/api 错误信封须为 {ok:false, error:{code,message}} ───
// 成功信封 {ok:true, value} 的解包已由「3c/3d 数据面」与 client-wiring 冒烟的
// 产物级门禁（apiPost 拆 value）覆盖；这里验证错误归一与 HTTP 状态映射。
// 注：v0.2 起 `shell.get` 随自研终端移除，改用未知方法验证 404 错误信封。
const apiProbe = await evalJs(`(async () => {
  const reply = await fetch('/shub/api/shell.get', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const body = await reply.json();
  return { status: reply.status, ok: body?.ok, code: body?.error?.code ?? null, hasErrorEnvelope: body !== null && typeof body === 'object' && typeof body?.error === 'object' };
})()`);
check('0c. /shub/api 错误信封归一（未知方法 → 404 + {ok:false,error}）',
  apiProbe?.status === 404 && apiProbe?.ok === false && apiProbe?.code === 'not-found' && apiProbe?.hasErrorEnvelope === true,
  JSON.stringify(apiProbe));

// ── 打开应用 + 右侧栏 ───────────────────────────────────────────────────
const booted = await waitFor(`(() => document.querySelector('[data-sidebar-right-toggle]') !== null)()`, 45000);
check('0. 应用壳与右侧栏开关就绪', booted);

await evalJs(`(() => { const b = document.querySelector('[data-sidebar-right-toggle]'); if (b) b.click(); return true; })()`);
const expanded = await waitFor(`(() => document.querySelector('[data-sidebar-right-open]') !== null)()`, 15000);
check('1a. 右侧栏可展开', expanded);
await sleep(1500);

// 预检：先「恢复默认」清掉上一次验收留下的改动（顺带验证「恢复默认」可用）
const resetDone = await evalJs(`(() => {
  const btn = [...document.querySelectorAll('.catalogHead .catalogBtn')]
    .find(b => /恢复默认|Restore defaults/.test(b.textContent ?? ''));
  if (!btn) return false;
  btn.click();
  return true;
})()`);
check('0b. 分类页「恢复默认」可用', resetDone === true);
await sleep(1800);

// §7-1：起始页 = 分类框架（不是原生引导胶囊）
const guideState = await evalJs(`(() => ({
  catalog: !!document.querySelector('.hubCatalog'),
  shippedGuide: !!document.querySelector('[data-sidebar-right-guide]'),
  shippedEntries: document.querySelectorAll('[data-sidebar-right-guide-entry]').length,
  groups: [...document.querySelectorAll('.catalogGroup')].length,
  chips: [...document.querySelectorAll('[data-dockkit-tab]')].map(n => n.textContent.trim()),
}))()`);
check('1b. 起始页直接是分类框架（.hubCatalog）', guideState?.catalog === true, JSON.stringify(guideState));
check('1c. 原生引导页胶囊已被替换（不出现）',
  guideState?.shippedGuide === false && guideState?.shippedEntries === 0,
  `guide=${guideState?.shippedGuide} entries=${guideState?.shippedEntries}`);
const firstShot = await shot('catalog');
console.log(`     截图：${firstShot}`);

// 语言与字号：必须与 DSH 全局一致（语言取框架同步的 documentElement.lang；字号取框架 token 尺度）
const i18nFont = await evalJs(`(() => {
  const lang = document.documentElement.lang || '';
  const title = document.querySelector('.catalogTitle');
  const item = document.querySelector('.catalogItem');
  const group = document.querySelector('.catalogGroupTitle');
  const px = (el) => el === null ? 0 : parseFloat(getComputedStyle(el).fontSize);
  return {
    lang,
    bodyLang: document.body?.dataset?.dsLang ?? null,
    navLang: navigator.language,
    titleText: title?.textContent?.trim() ?? '',
    resetText: [...document.querySelectorAll('.catalogHead .catalogBtn')].map(b => b.textContent.trim()).join('|'),
    titlePx: px(title), itemPx: px(item), groupPx: px(group),
  };
})()`);
const zhApp = String(i18nFont?.lang ?? '').toLowerCase().startsWith('zh');
check('1d. 文案语言与 DSH 全局一致（zh 界面 → 中文；en 界面 → 英文）',
  zhApp
    ? i18nFont?.titleText === '分类' && (i18nFont?.resetText ?? '').includes('恢复默认')
    : i18nFont?.titleText === 'Categories' && (i18nFont?.resetText ?? '').includes('Restore defaults'),
  JSON.stringify(i18nFont));
check('1e. 字号与全局尺度一致（标题 ≥16px / 条目 ≥13px / 分组 ≥14px）',
  (i18nFont?.titlePx ?? 0) >= 16 && (i18nFont?.itemPx ?? 0) >= 13 && (i18nFont?.groupPx ?? 0) >= 14,
  `title=${i18nFont?.titlePx} group=${i18nFont?.groupPx} item=${i18nFont?.itemPx}`);

// §7-2：分组与条目
const catalog = await evalJs(`(() => [...document.querySelectorAll('.catalogGroup')].map(g => ({
  title: g.querySelector('.catalogGroupTitle')?.textContent?.trim() ?? '',
  items: [...g.querySelectorAll('.catalogItem')].map(i => ({
    kind: i.getAttribute('data-kind'),
    label: i.querySelector('.catalogItemLabel')?.textContent?.trim() ?? '',
    // v0.1.5：不再有「官方」角标（不做官方性判定）
    official: false,
  })),
})))()`);
const titles = (catalog ?? []).map(g => g.title);
const DEFAULT_GROUPS = ['工作台', '工具', '游戏', '官方'];
check('2a. 默认四组齐备（v0.8 删工程与任务、浏览与工具改名工具）',
  DEFAULT_GROUPS.every(t => titles.includes(t)) && !titles.includes('工程与任务'),
  `实际：${titles.join(' / ')}`);
const allItems = (catalog ?? []).flatMap(g => g.items);
// v0.1.5：条目数取决于该实例装了哪些插件（最小 profile 自然少）——只断言「非空」。
check('2b. 条目来自自动发现（非空）', allItems.length > 0 && allItems.every(i => typeof i.kind === 'string' && i.kind !== ''), `${allItems.length} 条：${allItems.map(i => i.kind).join(',')}`);
// v0.1.5 回归防线：只有 tab 定义、没有 guide 盒子的**内部类型**不得出现在分类页
// （v0.1.4 读 entries() 时「聊天/计划/变更审查」被当入口灌进来的正是这一类）。
const INTERNAL_KINDS = ['plan', 'changes-review', 'subagentchat', 'text', 'guide'];
const leaked = allItems.filter(i => INTERNAL_KINDS.includes(i.kind)).map(i => i.kind);
check('2b2. 无内部 tab 类型混入分类页（v0.1.5 guide-only 发现）', leaked.length === 0,
  leaked.length === 0 ? `全部 ${allItems.length} 条均来自 guide 入口` : `混入：${leaked.join(',')}`);
const officialGroup = (catalog ?? []).find(g => g.title === '官方');
const terminalItem = (catalog ?? []).flatMap(g => g.items).find(i => i.kind === 'terminal');
const browserItem = (catalog ?? []).flatMap(g => g.items).find(i => i.kind === 'browser');
const toolsGroup = (catalog ?? []).find(g => g.title === '工具');
check('2c. 语音工具在「工具」组（v0.8 改名）',
  toolsGroup?.items.some(i => i.kind === 'audio-transcriber'),
  `工具组：${(toolsGroup?.items ?? []).map(i => i.label).join(',')}`);
check('2d. 官方 Files/终端 同处「官方」组（浏览器仅在其插件启用时出现）',
  officialGroup?.items.some(i => i.kind === 'files') === true
  && officialGroup?.items.some(i => i.kind === 'terminal') === true
  && (browserItem === undefined || officialGroup?.items.some(i => i.kind === 'browser') === true),
  JSON.stringify(officialGroup?.items ?? []));
const otherGroup = (catalog ?? []).find(g => g.title === '其他');
console.log(`     其他组（未登记 kind）：${(otherGroup?.items ?? []).map(i => `${i.label}(${i.kind})`).join(', ') || '（无）'}`);
check('2e. 三大工作台归入「工作台」',
  (catalog ?? []).find(g => g.title === '工作台')?.items.length >= 3,
  JSON.stringify((catalog ?? []).find(g => g.title === '工作台')?.items.map(i => i.label) ?? []));

check('2f. 分组顺序 = 官方 → 工作台（前二，v0.8）',
  JSON.stringify(titles.slice(0, 2)) === JSON.stringify(['官方', '工作台']),
  `实际：${titles.slice(0, 3).join(' → ')}`);

const tones = await evalJs(`(() => ({
  tones: [...document.querySelectorAll('.catalogGroup')].map(g => g.getAttribute('data-tone')),
  tiles: document.querySelectorAll('.catalogItemTile').length,
  officialBadge: document.querySelectorAll('.catalogItemOfficial').length,
  betterSidebarKinds: [...document.querySelectorAll('.catalogItem')]
    .map(i => i.getAttribute('data-kind'))
    // terminal（v0.2）/browser（v0.5）已是官方 kind；hub 自研内容类型 v0.6 起全部移除
    .filter(k => ['git', 'subagent', 'sidechat', 'editor', 'diff'].includes(k)),
}))()`);
check('2g. 分组带色调、条目带图标块', (tones?.tones ?? []).every(t => typeof t === 'string' && t !== '')
  && (tones?.tiles ?? 0) >= 11,
  `tones=${JSON.stringify(tones?.tones)} tiles=${tones?.tiles}`);
check('2h. 无第三方残余 kind / hub-* 自研类型全部移除（无同名 kind 条目）',
  (tones?.betterSidebarKinds ?? []).length === 0
  && !(catalog ?? []).flatMap(g => g.items).some(i => i.kind.startsWith('hub-')),
  `${JSON.stringify(tones?.betterSidebarKinds)} hub残留=${(catalog ?? []).flatMap(g => g.items).filter(i => i.kind.startsWith('hub-')).map(i => i.kind).join(',')}`);
const gamesKinds = await evalJs(`(() => {
  const groups = [...document.querySelectorAll('.catalogGroup')];
  const games = groups.find(g => (g.querySelector('.catalogGroupTitle')?.textContent ?? '').trim() === '游戏');
  return games ? [...games.querySelectorAll('.catalogItem')].map(i => i.getAttribute('data-kind')) : [];
})()`);
check('2i. 扫雷与数独落在默认「游戏」组',
  (gamesKinds ?? []).includes('minesweeper') && (gamesKinds ?? []).includes('sudoku'),
  JSON.stringify(gamesKinds));

// 回到分类页：关掉除 guide 之外的所有 tab（guide 的 chip 文案是「开始」/「Start」）
const backToCatalog = `(() => {
  for (const btn of [...document.querySelectorAll('[data-dockkit-tab-close]')]) {
    const chip = btn.closest('[data-dockkit-tab]') ?? btn.parentElement;
    const text = chip ? chip.textContent.trim() : '';
    if (!text.includes('开始') && !text.includes('Start')) btn.click();
  }
  return true;
})()`;

// §7-3：逐个打开六个自研入口 + 官方文件转发
// 说明：任务管理视图在会话没有后台任务时合法地不渲染 `.jobsSection`
// （JobsSection 空集返回 null），因此断言用「视图挂载 + 标题」而不是任务行。
const VIEWS = [
  ['terminal', '终端（官方）', `document.querySelector('[data-sidebar-terminal]') !== null`, '.terminalWrap, [data-sidebar-terminal]'],
  // 官方浏览器初始无 URL 时不渲染 iframe（官方开始占位页），断言地址栏出现即可
  ['browser', '浏览器（官方）', `document.querySelector('input[aria-label*="HTTP(S) 地址"], input[aria-label*="address"]') !== null`, 'input[aria-label*="HTTP(S) 地址"], input[aria-label*="address"]'],
];
for (const [kind, label, assertion, elSelector] of VIEWS) {
  await evalJs(backToCatalog);
  await sleep(800);
  const clicked = await evalJs(`(() => {
    const item = document.querySelector('.catalogItem[data-kind="${kind}"]');
    if (!item) return false;
    item.click();
    return true;
  })()`);
  const ok = clicked === true && await waitFor(
    `(() => { const el = (${assertion}) ? document.querySelector('${elSelector}') : null; return (${assertion}) && el !== null && el.getBoundingClientRect().height > 20; })()`,
    20000,
  );
  const unavailable = await evalJs(`(() => !!document.querySelector('[data-sidebar-right-unavailable]'))()`);
  if (!ok) {
    const diag = await evalJs(`(() => ({
      title: document.querySelector('.subagentTitle')?.textContent ?? null,
      body: document.querySelector('.subagentBody')?.getBoundingClientRect().height ?? null,
      kinds: [...document.querySelectorAll('[data-dockkit-tab]')].map(n => n.textContent.trim()),
    }))()`);
    console.log(`     诊断（${label}）：${JSON.stringify(diag)}`);
  }
  check(`3. 点「${label}」打开内容`, ok && unavailable !== true,
    `clicked=${clicked} unavailable=${unavailable}`);
  if (!ok) await shot(`fail-${kind}`);
}
await evalJs(backToCatalog);
await sleep(800);

// 3c/3d 原为 Git/文件变动数据面断言——v0.6 起 hub 自研内容类型全部移除，无此视图。

await evalJs(backToCatalog);
await sleep(800);

// 语音转文字：环境必须就绪（缺 profile 级 modelDir 时会显示「环境未就绪」）
await evalJs(`(() => { document.querySelector('.catalogItem[data-kind="audio-transcriber"]')?.click(); return true; })()`);
await sleep(3000);
const atcState = await evalJs(`(() => ({
  badge: document.querySelector('.atc-badge')?.textContent?.trim() ?? '',
  status: document.querySelector('.atc-status')?.textContent?.trim() ?? '',
}))()`);
check('3e. 语音转文字环境就绪', (atcState?.badge ?? '').includes('就绪') && !(atcState?.badge ?? '').includes('未就绪'),
  JSON.stringify(atcState));
await evalJs(backToCatalog);
await sleep(800);

// §7-3（转发）：官方 Files 只做转发
const filesClicked = await evalJs(`(() => {
  const item = document.querySelector('.catalogItem[data-kind="files"]');
  if (!item) return false;
  item.click();
  return true;
})()`);
await sleep(2500);
const filesState = await evalJs(`(() => ({
  unavailable: !!document.querySelector('[data-sidebar-right-unavailable]'),
  chips: [...document.querySelectorAll('[data-dockkit-tab]')].map(n => n.textContent.trim()),
  ourViews: ['.hubCatalog', '[data-sidebar-terminal]', '[data-sidebar-browser-frame]']
    .filter(s => document.querySelector(s) !== null),
}))()`);
check('3b. 官方「文件」转发打开（无"无法查看"提示）',
  filesClicked === true && filesState?.unavailable === false,
  JSON.stringify(filesState));
console.log(`     转发后 tab 胶囊：${(filesState?.chips ?? []).join(' | ')}`);
const filesShot = await shot('files-forward');
console.log(`     截图：${filesShot}`);

// 分组保护（2026-09-13 用户要求）：默认五组不可删除、官方不可重命名
await evalJs(backToCatalog);
await sleep(1000);
const protection = await evalJs(`(() => {
  const collect = (root) => [...root.querySelectorAll('.catalogGroup')].map(g => ({
    title: g.querySelector('.catalogGroupTitle')?.textContent?.trim() ?? '',
    hasTools: g.querySelector('.catalogGroupTools') !== null,
    hasRename: [...(g.querySelectorAll('.catalogGroupTools button'))].some(b => b.textContent.trim() === '✎'),
    hasDelete: [...(g.querySelectorAll('.catalogGroupTools button'))].some(b => b.textContent.trim() === '✕'),
  }));
  return { catalog: collect(document), official: collect(document).find(g => g.title === '官方') };
})()`);
const officialTools = protection?.official;
check('4g. 默认组保护：官方无改名/删除钮，其它默认组无删除钮',
  officialTools !== undefined && officialTools?.hasRename === false && officialTools?.hasDelete === false
  && (protection?.catalog ?? []).every(g => g.hasDelete === false),
  JSON.stringify(protection?.catalog ?? []).slice(0, 300));

// §7-4：拖拽跨组 + 重载后仍生效
await evalJs(backToCatalog);
await sleep(1000);
const dragResult = await evalJs(`(() => {
  const item = document.querySelector('.catalogItem[data-kind="audio-transcriber"]');
  const groups = [...document.querySelectorAll('.catalogGroup')];
  const target = groups.find(g => (g.querySelector('.catalogGroupTitle')?.textContent ?? '').trim() === '游戏');
  if (!item || !target) return { ok: false, why: 'selector' };
  const dt = new DataTransfer();
  item.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  item.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  return { ok: true };
})()`);
await sleep(2000);
const inGames = await evalJs(`(() => {
  const groups = [...document.querySelectorAll('.catalogGroup')];
  const target = groups.find(g => (g.querySelector('.catalogGroupTitle')?.textContent ?? '').trim() === '游戏');
  return target ? [...target.querySelectorAll('.catalogItem')].map(i => i.getAttribute('data-kind')) : [];
})()`);
check('4a. 拖拽把「语音转文字」移入「游戏」组', dragResult?.ok === true && (inGames ?? []).includes('audio-transcriber'),
  `游戏组=${JSON.stringify(inGames)}`);

await send('Page.reload', { ignoreCache: false });
await sleep(6000);
await evalJs(`(() => { const b = document.querySelector('[data-sidebar-right-toggle]'); if (b) b.click(); return true; })()`);
await waitFor(`(() => document.querySelector('.hubCatalog') !== null)()`, 30000);
const afterReload = await evalJs(`(() => {
  const groups = [...document.querySelectorAll('.catalogGroup')];
  const target = groups.find(g => (g.querySelector('.catalogGroupTitle')?.textContent ?? '').trim() === '游戏');
  return target ? [...target.querySelectorAll('.catalogItem')].map(i => i.getAttribute('data-kind')) : [];
})()`);
check('4b. 重载后仍是跨组后的布局（写入 DSH settings）', (afterReload ?? []).includes('audio-transcriber'),
  `游戏组=${JSON.stringify(afterReload)}`);

// 复原：把「语音转文字」拖回「工具」
await evalJs(`(() => {
  const item = document.querySelector('.catalogItem[data-kind="audio-transcriber"]');
  const groups = [...document.querySelectorAll('.catalogGroup')];
  const target = groups.find(g => (g.querySelector('.catalogGroupTitle')?.textContent ?? '').trim() === '工具');
  if (!item || !target) return false;
  const dt = new DataTransfer();
  item.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  return true;
})()`);
await sleep(1500);
const restored = await evalJs(`(() => {
  const groups = [...document.querySelectorAll('.catalogGroup')];
  const target = groups.find(g => (g.querySelector('.catalogGroupTitle')?.textContent ?? '').trim() === '工具');
  return target ? [...target.querySelectorAll('.catalogItem')].map(i => i.getAttribute('data-kind')) : [];
})()`);
check('4c. 复原拖拽（语音转文字回到「工具」）', (restored ?? []).includes('audio-transcriber'), JSON.stringify(restored));

// §7-5 / §7-7：设置页卡片
/** 打开设置面板（模态）。 */
const dialogOpen = () => evalJs(`(() => document.querySelector('[role="dialog"]') !== null)()`);
const openSettings = async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // 先看是不是已经开着——重复点同一个开关会把它关掉。
    if (await dialogOpen() === true) return true;
    await evalJs(`(() => {
      const buttons = [...document.querySelectorAll('button')];
      const trigger = buttons.find(b => {
        const label = (b.getAttribute('aria-label') ?? '') + (b.getAttribute('title') ?? '');
        return label.includes('设置') || /settings/i.test(label);
      });
      if (trigger) trigger.click();
      return true;
    })()`);
    for (let wait = 0; wait < 20; wait += 1) {
      await sleep(500);
      if (await dialogOpen() === true) return true;
    }
  }
  return false;
};
/** 关闭设置面板（Escape 优先，回退到关闭按钮）。 */
const closeSettings = async () => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(800);
  if (await evalJs(`(() => document.querySelector('[role="dialog"]') !== null)()`)) {
    await evalJs(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const close = [...(dialog?.querySelectorAll('button') ?? [])].find(b => /关闭|Close|✕|×/.test((b.getAttribute('aria-label') ?? '') + b.textContent));
      if (close) close.click();
      return true;
    })()`);
    await sleep(800);
  }
};

/** 打开设置面板并确保「右侧栏分类」卡片所在的可配置插件页可见。 */
const openSettingsAndCard = async () => {
  const opened = await openSettings();
  if (opened !== true) return false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (let wait = 0; wait < 12; wait += 1) {
      const visible = await evalJs(`(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return false;
        if (dialog.querySelector('.hubSettingsTable') !== null) return true;
        // 可配置插件的标签页在 zh 下叫「插件」（历史上也用过「可配置插件」）
        const tabs = [...dialog.querySelectorAll('button, [role="tab"], li')];
        const exact = tabs.find(t => (t.textContent ?? '').trim() === '插件');
        const loose = exact ?? tabs.find(t => /可配置|Configurable/.test(t.textContent ?? ''));
        if (loose) loose.click();
        return false;
      })()`);
      await sleep(500);
      if (visible === true) return true;
    }
  }
  return await evalJs(`(() => document.querySelector('.hubSettingsTable') !== null)()`);
};

/** 展开「右侧栏分类」卡片本身（默认收起，与框架插件卡片一致）。 */
const expandCard = () => evalJs(`(() => {
  const head = document.querySelector('.hubCardHead');
  if (!head) return false;
  if (head.getAttribute('aria-expanded') !== 'true') head.click();
  return true;
})()`);
/** 展开卡片内的「条目映射」小节（默认收起）。 */
const expandEntries = () => evalJs(`(() => {
  const sub = [...document.querySelectorAll('.hubSubHead')]
    .find(button => (button.querySelector('.hubSubTitle')?.textContent ?? '').includes('条目映射')
      || (button.querySelector('.hubSubTitle')?.textContent ?? '').includes('Entry mapping'));
  if (!sub) return false;
  if (sub.getAttribute('aria-expanded') !== 'true') sub.click();
  return true;
})()`);

/** 打开官方「插件」面板并进入 dsh-sidebar-hub 包详情（0.1.6-alpha.2 起配置区在包详情页）。 */
const openHubConfigPage = async () => {
  // 左侧栏「插件」面板（aria-label=插件；0.1.6-alpha.2 起插件管理是全局面板）
  await evalJs(`(() => {
    const t = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === '插件');
    if (t) t.click();
    return true;
  })()`);
  await sleep(3000);
  // 展开「已安装」分组
  await evalJs(`(() => {
    const t = [...document.querySelectorAll('[class*=group],[class*=Group],button,[role=button]')]
      .find(e => /已安装/.test(e.textContent ?? ''));
    if (t) t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  })()`);
  await sleep(2500);
  // 点 sidebar-hub 包卡片（进入详情页）
  const clicked = await evalJs(`(() => {
    const li = [...document.querySelectorAll('li')].find(l => l.getAttribute('data-plugin-package') === 'dsh-sidebar-hub');
    const btn = li?.querySelector('button');
    if (btn) { btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
    return false;
  })()`);
  await sleep(4000);
  return clicked === true && await evalJs(`(() => document.querySelector('.hubCard') !== null)()`);
};

const settingsOpenedOk = await openHubConfigPage();
check('5a. 官方插件面板可打开并进入 hub 详情', settingsOpenedOk === true,
  `hubCard=${settingsOpenedOk}`);
await sleep(1500);
const card = await evalJs(`(() => {
  const text = document.body?.innerText ?? '';
  return { ok: text.includes('右侧栏分类'), text: text.slice(0, 120) };
})()`);

const cardChrome = await evalJs(`(() => {
  const card = document.querySelector('li.hubCard');
  const head = card?.querySelector('.hubCardHead');
  return {
    collapsed: head?.getAttribute('aria-expanded') === 'false',
    name: card?.querySelector('.hubCardName')?.textContent?.trim() ?? '',
    hasDesc: (card?.querySelector('.hubCardDesc')?.textContent?.trim().length ?? 0) > 10,
    chevron: card?.querySelector('svg') !== null,
    borderStyle: card ? getComputedStyle(card).borderRadius : '',
  };
})()`);
check('4e. 卡片外观与框架插件卡片一致（li 卡片 / 名称 / 描述 / chevron / 默认收起）',
  cardChrome?.name === '右侧栏分类' && cardChrome?.hasDesc === true && cardChrome?.chevron === true
  && cardChrome?.collapsed === true && cardChrome?.borderStyle === '16px',
  JSON.stringify(cardChrome));

await expandCard();
await sleep(800);
const subSections = await evalJs(`(() => document.querySelectorAll('.hubSubHead').length)()`);
check('4f. 展开后有可折叠小节（分组 / 条目映射）', (subSections ?? 0) >= 2, `subsections=${subSections}`);
await expandEntries();
await sleep(800);
const cardState = await evalJs(`(() => {
  const text = document.body?.innerText ?? '';
  return {
    hasCard: text.includes('右侧栏分类'),
    hasTable: document.querySelectorAll('.hubSettingsTable tbody tr').length,
    hasUnregistered: text.includes('未登记'),
    memoryBadge: text.includes('未持久化'),
    tiles: document.querySelectorAll('.hubKindTile').length,
    snippet: text.slice(0, 200),
  };
})()`);
check('5b. 插件详情页有「右侧栏分类」卡片', cardState?.hasCard === true, JSON.stringify(cardState).slice(0, 300));
check('5c. 卡片列出条目映射表', (cardState?.hasTable ?? 0) >= 6, `rows=${cardState?.hasTable}`);
await evalJs(`(() => {
  const card = document.querySelector('li.hubCard');
  if (card) card.scrollIntoView({ block: 'start' });
  return true;
})()`);
await sleep(600);
const settingsShot = await shot('settings-card');
console.log(`     截图：${settingsShot}`);

// 隐藏一个条目 → 分类页应不再显示（§7-7；退出插件面板后核对）
await expandCard();
await expandEntries();
await sleep(800);
const hid = await evalJs(`(() => {
  const row = document.querySelector('tr[data-kind="audio-transcriber"]');
  const box = row?.querySelector('input[type=checkbox]');
  if (!box) return false;
  box.click();
  return true;
})()`);
await sleep(2000);
const hiddenState = await evalJs(`(() => ({
  checked: document.querySelector('tr[data-kind="audio-transcriber"] input[type=checkbox]')?.checked,
}))()`);
check('7a. 设置卡片可勾选隐藏（audio-transcriber）', hid === true && hiddenState?.checked !== false, JSON.stringify(hiddenState));
// 退出插件面板（点「新建会话」切走；插件面板是全屏全局面板）→ 打开右侧栏分类页核对
await evalJs(`(() => {
  const t = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? '') === '新建会话' || (b.textContent ?? '').trim() === '新会话');
  if (t) t.click();
  return true;
})()`);
await sleep(1500);
await evalJs(`(() => {
  if (document.querySelector('.hubCatalog') === null) {
    const b = document.querySelector('[data-sidebar-right-toggle]');
    if (b) b.click();
  }
  return true;
})()`);
await sleep(1200);
const catalogAfterHide = await evalJs(`(() => [...document.querySelectorAll('.catalogItem')].map(i => i.getAttribute('data-kind')))()`);
check('7b. 隐藏后分类页不再显示该条目', (catalogAfterHide ?? []).length > 0 && !(catalogAfterHide ?? []).includes('audio-transcriber'),
  `仍在=${JSON.stringify((catalogAfterHide ?? []).filter(k => k === 'audio-transcriber'))} 条目数=${(catalogAfterHide ?? []).length}`);
const hideShot = await shot('catalog-after-hide');
console.log(`     截图：${hideShot}`);

// 恢复显示
const reopened = await openHubConfigPage();
if (reopened !== true) console.log('     设置面板二次打开失败，跳过恢复显示断言');

await expandCard();
await expandEntries();
await sleep(800);
const restoredHide = await evalJs(`(() => {
  const row = document.querySelector('tr[data-kind="audio-transcriber"]');
  const box = row?.querySelector('input[type=checkbox]');
  if (!box) return { clicked: false, found: false };
  const before = box.checked;
  if (box.checked) box.click();
  return { clicked: true, found: true, before };
})()`);
await sleep(1800);
const restoredChecked = await evalJs(`(() => {
  return document.querySelector('tr[data-kind="audio-transcriber"] input[type=checkbox]')?.checked ?? null;
})()`);
check('7c. 设置卡片可恢复显示', restoredHide?.found === true && restoredChecked === false,
  `before=${restoredHide?.before} after=${restoredChecked}`);
// 退出插件面板（点「新建会话」切走）→ 打开右侧栏分类页确认条目又出现
await evalJs(`(() => {
  const t = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? '') === '新建会话' || (b.textContent ?? '').trim() === '新会话');
  if (t) t.click();
  return true;
})()`);
await sleep(1500);
await evalJs(`(() => {
  if (document.querySelector('.hubCatalog') === null) {
    const b = document.querySelector('[data-sidebar-right-toggle]');
    if (b) b.click();
  }
  return true;
})()`);
await sleep(1200);
// 回分类页确认条目又出现了（恢复生效）
const backAfterRestore = await evalJs(`(() => [...document.querySelectorAll('.catalogItem')].map(i => i.getAttribute('data-kind')))()`);
check('7d. 恢复后条目回到分类页', (backAfterRestore ?? []).includes('audio-transcriber'),
  `条目数=${(backAfterRestore ?? []).length}`);

// §7-9：无未捕获异常 / 无 error 级控制台输出（过滤已知无害项）
const allNoise = [...consoleErrors, ...exceptions].filter(t =>
  t !== '' && !/favicon|Download the React DevTools|ResizeObserver loop/.test(t));
// 已知**非本插件**的错误：dsh-global-auth 往 list 槽 `sidebar.footer.action` 注册时
// 没带 options.id（当前 harness 的 list 槽要求 id）。单列出来交回用户，不计入本插件判定。
const foreign = allNoise.filter(t => /sidebar\.footer\.action/.test(t));
const noisy = allNoise.filter(t => !/sidebar\.footer\.action/.test(t));
check('9b. 页面无未捕获异常与 error 级控制台输出', noisy.length === 0, noisy.slice(0, 4).join(' || '));
if (foreign.length > 0) console.log(`     注意：另有 ${foreign.length} 条**非本插件**报错（dsh-global-auth 的 sidebar.footer.action 缺 id）：${foreign[0].slice(0, 100)}`);

const finalShot = await shot('final');
console.log(`\n结果：${results.length - failed}/${results.length} 通过；截图目录 ${shotDir}；末图 ${finalShot}`);
if (keep !== true) killChrome();
process.exit(failed === 0 ? 0 : 1);
