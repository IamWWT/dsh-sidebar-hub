#!/usr/bin/env node
/**
 * 单 tab 现场探针：打开右侧栏分类里的某个条目，抓 **DOM 文本 + 控制台 + 失败请求**。
 *
 * 用途：排查"某个 tab 报错"时不用靠猜——一次拿到
 *   - 该 tab body 渲染出来的可见文案（错误提示原文）；
 *   - 控制台 error/异常；
 *   - 该页发出的 HTTP 请求里 4xx/5xx 的（URL + 状态 + 响应体片段）。
 *
 * 用法：
 *   node test/probe-tab.mjs --url "http://127.0.0.1:3085/?token=..." --kind troubleshoot-workbench
 *   node test/probe-tab.mjs --url ... --kind hub-git --wait 8000 --shot /tmp/x.png
 * 注意：token 一次性；探测会消费它。
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};
const url = argOf('--url', '');
const kind = argOf('--kind', '');
const waitMs = Number(argOf('--wait', '6000'));
const shotPath = argOf('--shot', '');
const chromeBin = process.env.DSH_UI_CHROME ?? '/usr/bin/google-chrome';
if (url === '' || kind === '') {
  console.error('[probe] 需要 --url "<tokenized url>" 与 --kind <catalog item kind>');
  process.exit(2);
}

const cdpPort = 19200 + Math.floor(Math.random() * 8000);
const userDir = mkdtempSync(join(tmpdir(), 'shub-probe-'));
const chrome = execFile(chromeBin, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDir}`,
  '--window-size=1680,1050', url,
]);
process.on('exit', () => { try { chrome.kill(); } catch { /* 已退出 */ } });

let page = null;
for (let i = 0; i < 40 && page === null; i += 1) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
    page = list.find(target => target.type === 'page' && target.url.startsWith('http')) ?? null;
  } catch { /* 未就绪 */ }
}
if (page === null) { console.error('[probe] 未取到 Chrome 页面'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let seq = 0;
const pending = new Map();
const consoleErrors = [];
const exceptions = [];
const badResponses = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push((msg.params.args ?? []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 400));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push(String(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text ?? '').slice(0, 400));
  }
  if (msg.method === 'Network.responseReceived') {
    const { response } = msg.params;
    if (response.status >= 400) {
      badResponses.push({ status: response.status, url: response.url.slice(0, 200) });
    }
  }
};
const send = (method, params = {}) => {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise(resolve => pending.set(id, resolve));
};
const evalJs = async (expression) => {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (reply.result?.exceptionDetails !== undefined) {
    return { __error: String(reply.result.exceptionDetails.exception?.description ?? 'eval failed') };
  }
  return reply.result?.result?.value;
};
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Console.enable');

await sleep(4000);
await evalJs(`(() => { const b = document.querySelector('[data-sidebar-right-toggle]'); if (b) b.click(); return true; })()`);
await sleep(1500);
const clicked = await evalJs(`(() => {
  const item = document.querySelector('.catalogItem[data-kind="${kind}"]');
  if (!item) return false;
  item.click();
  return true;
})()`);
console.log(`[probe] 条目 ${kind} 点击=${clicked}`);
await sleep(waitMs);

const dom = await evalJs(`(() => {
  const strip = document.querySelector('[data-dockkit-strip]');
  const body = document.querySelector('[data-dockkit-surface]') ?? document.body;
  const text = (body.innerText ?? '').replace(/\\n{2,}/g, '\\n').trim();
  return { tabs: strip ? [...strip.querySelectorAll('[data-dockkit-tab]')].map(n => n.textContent.trim()) : [], text: text.slice(0, 2500) };
})()`);
console.log('\n===== 可见文案（前 2500 字）=====');
console.log(dom?.text ?? '(取不到)');
console.log('\n===== 失败请求 =====');
for (const bad of badResponses) console.log(`${bad.status}  ${bad.url}`);
console.log('\n===== 控制台 error / 异常 =====');
for (const line of [...consoleErrors, ...exceptions].slice(0, 12)) console.log(`- ${line}`);

if (shotPath !== '') {
  const reply = await send('Page.captureScreenshot', { format: 'png' });
  if (typeof reply.result?.data === 'string') {
    writeFileSync(shotPath, Buffer.from(reply.result.data, 'base64'));
    console.log(`\n[probe] 截图 → ${shotPath}`);
  }
}
chrome.kill();
process.exit(0);
