#!/usr/bin/env node
/** 探测官方文件树：打开右侧栏 → 点「文件」→ 输出面板完整文本与可能的根路径（v0.3 验收用）。 */
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const url = process.argv[2];
if (url === '') { console.error('usage: node probe-files.mjs "<tokenized url>"'); process.exit(2); }

const cdpPort = 20000 + Math.floor(Math.random() * 4000);
const userDir = mkdtempSync(join(tmpdir(), 'shub-probe-'));
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
if (page === null) { console.error('[probe] no page'); process.exit(1); }

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
  if (reply.result?.exceptionDetails !== undefined) {
    return { __error: String(reply.result.exceptionDetails.exception?.description ?? 'eval failed') };
  }
  return reply.result?.result?.value;
};
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.reload', { ignoreCache: true });
await sleep(3500);

await evalJs(`(() => { const b = document.querySelector('[data-sidebar-right-toggle]'); if (b) b.click(); return true; })()`);
await sleep(1500);
const clicked = await evalJs(`(() => {
  const item = document.querySelector('.catalogItem[data-kind="files"]');
  if (!item) return false;
  item.click();
  return true;
})()`);
console.log('clicked files:', clicked);
await sleep(4000);

const info = await evalJs(`(() => {
  const tree = document.querySelector('[data-files-state="tree"]');
  if (tree === null) {
    return { tree: null, states: [...document.querySelectorAll('[data-files-state]')].map(e => e.getAttribute('data-files-state')) };
  }
  const root = tree.getAttribute('data-files-root') ?? '';
  const entries = [...tree.querySelectorAll('[data-files-entry]')].map(e => ({
    kind: e.getAttribute('data-files-entry'),
    path: e.getAttribute('data-files-path'),
    name: e.querySelector('.name')?.textContent?.trim() ?? '',
  }));
  return { tree: 'ok', root, entries: entries.slice(0, 30) };
})()`);
console.log(JSON.stringify(info, null, 1));
process.exit(0);