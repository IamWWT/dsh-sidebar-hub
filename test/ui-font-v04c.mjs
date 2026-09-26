#!/usr/bin/env node
/** v0.4 字号联动验证（真实元素）：插入套用 --hub-font-* 的元素，改 --dsh-content-font-size 看计算字号。 */
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const url = process.argv[2];
const cdpPort = 50000 + Math.floor(Math.random() * 2000);
const userDir = mkdtempSync(join(tmpdir(), 'shub-fontc-'));
const chrome = execFile('/usr/bin/google-chrome', [
  '--headless', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDir}`,
  '--window-size=1680,1050', url,
]);
process.on('exit', () => { try { chrome.kill(); } catch { /* ignore */ } });
let page = null;
for (let i = 0; i < 40 && page === null; i += 1) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
    page = list.find(t => t.type === 'page' && t.url.startsWith('http')) ?? null;
  } catch { /* not ready */ }
}
if (page === null) { console.error('no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let seq = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise(resolve => pending.set(id, resolve));
};
const evalJs = async (expression) => {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (reply.result?.exceptionDetails !== undefined) return { __error: String(reply.result.exceptionDetails.exception?.description ?? 'eval failed') };
  return reply.result?.result?.value;
};
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.reload', { ignoreCache: true });
await sleep(5000);

// 插入 5 个套用 hub 字号变量的探针元素
await evalJs(`(() => {
  const host = document.createElement('div');
  host.id = 'hubFontProbe';
  host.style.cssText = 'position:fixed;left:-9999px;top:0;';
  const mk = (id, font) => {
    const el = document.createElement('span');
    el.id = id;
    el.style.font = font;
    el.textContent = 'x';
    host.appendChild(el);
  };
  mk('pTitle', 'var(--hub-font-title)');
  mk('pBody', 'var(--hub-font-body)');
  mk('pSmall', 'var(--hub-font-small)');
  mk('pTiny', 'var(--hub-font-tiny)');
  mk('pMicro', 'var(--hub-font-micro)');
  document.body.appendChild(host);
  return true;
})()`);
await sleep(600);

const readSizes = () => evalJs(`(() => {
  const f = (id) => { const el = document.getElementById(id); return el === null ? null : parseFloat(getComputedStyle(el).fontSize).toFixed(1); };
  return { base: parseFloat(getComputedStyle(document.body).getPropertyValue('--dsh-content-font-size')) || 14,
    title: f('pTitle'), body: f('pBody'), small: f('pSmall'), tiny: f('pTiny'), micro: f('pMicro') };
})()`);

const before = await readSizes();
await evalJs(`(() => { document.body.style.setProperty('--dsh-content-font-size', '17px'); return true; })()`);
await sleep(600);
const after17 = await readSizes();
await evalJs(`(() => { document.body.style.setProperty('--dsh-content-font-size', '12px'); return true; })()`);
await sleep(600);
const after12 = await readSizes();
console.log('默认:', JSON.stringify(before));
console.log('17px:', JSON.stringify(after17));
console.log('12px:', JSON.stringify(after12));

const check = (r, label) => {
  const b = r.base;
  const ok = r.title === `${b + 2}.0` && r.body === `${b}.0` && r.small === `${b - 1}.0`
    && r.tiny === `${b - 2}.0` && r.micro === `${b - 3}.0`;
  console.log(`${label}(base=${b}): ${ok ? 'OK' : 'MISMATCH ' + JSON.stringify(r)}`);
  return ok;
};
const allOk = check(before, '默认') && check(after17, '17px') && check(after12, '12px');
process.exit(allOk ? 0 : 1);
