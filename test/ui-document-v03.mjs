#!/usr/bin/env node
/**
 * v0.3 文档渲染器验收（CDP 驱动本机 Chrome，零第三方依赖）。
 *
 * 覆盖（spec 002 §7 增补 A17–A21）：
 *   A17 官方文件树里打开 .md → hub 的 md 渲染器接管（MarkdownText 渲染正常）；
 *   A18 含 mermaid fence 的 .md → 惰性加载 /shub/bundle/mermaid.js 并把
 *       `language-mermaid` 代码块换成图（[data-mermaid-diagram] 出现、
 *       图内 svg 存在、普通代码块仍是代码块）；
 *   A19/A20 docx/pptx → 官方内置 Office 预览承接（v0.7 起 hub 自研 office
 *       渲染器移除，官方 office-to-pdf 接管；断言「无无法查看空状态」）；
 *   附：md 内本地图片（![pic](./pic.png)）→ /shub/file 可显示（img 元素出现）。
 *
 * 用法：
 *   node test/ui-document-v03.mjs --url "http://127.0.0.1:3085/?token=..." [--keep]
 */
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};
const url = argOf('--url', '');
if (url === '') { console.error('[v03] 需要 --url "<tokenized url>"'); process.exit(2); }

const results = [];
let failed = 0;
function check(name, ok, detail = '') {
  results.push({ name, ok: ok === true });
  if (ok !== true) failed += 1;
  console.log(`${ok === true ? 'PASS' : 'FAIL'}  ${name}${detail === '' ? '' : `  — ${detail}`}`);
}

// ── Chrome + CDP ─────────────────────────────────────────────────────────
const cdpPort = 24000 + Math.floor(Math.random() * 4000);
const userDir = mkdtempSync(join(tmpdir(), 'shub-v03-'));
const chrome = execFile('/usr/bin/google-chrome', [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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
if (page === null) { console.error('[v03] FAIL 未取到页面'); process.exit(1); }

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
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.reload', { ignoreCache: true });
await sleep(3500);

const evalJs = async (expression) => {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (reply.result?.exceptionDetails !== undefined) {
    return { __error: String(reply.result.exceptionDetails.exception?.description ?? 'eval failed') };
  }
  return reply.result?.result?.value;
};
const waitFor = async (expression, timeoutMs = 30000, stepMs = 500) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await evalJs(expression);
    if (value === true || (typeof value === 'object' && value !== null && value.__error === undefined && value.value === true)) {
      return true;
    }
    if (typeof value === 'object' && value !== null && value.__error !== undefined) return false;
    await sleep(stepMs);
  }
  return false;
};

// ── 打开右侧栏 → 文件 ───────────────────────────────────────────────────
await evalJs(`(() => { const b = document.querySelector('[data-sidebar-right-toggle]'); if (b) b.click(); return true; })()`);
await sleep(1500);
check('A16. 右侧栏打开且分类框架在', (await evalJs(`(() => !!document.querySelector('.hubCatalog'))()`)) === true);
await evalJs(`(() => { const item = document.querySelector('.catalogItem[data-kind="files"]'); if (item) item.click(); return true; })()`);
await sleep(3000);
check('A17a. 官方文件树出现', (await waitFor(`(() => !!document.querySelector('[data-files-state="tree"]'))()`)) === true);

// 导航：dsh-plugins → dsh-sidebar-hub → test → fixtures-v03
async function openDirectory(relativePath) {
  // 逐个确保目录展开（已展开的 aria-expanded=true 则不重复点击，避免折叠）
  const parts = relativePath.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current = current === '' ? part : `${current}/${part}`;
    const ok = await waitFor(`(() => {
      const el = [...document.querySelectorAll('[data-files-entry="directory"]')]
        .find(e => (e.getAttribute('data-files-path') ?? '').endsWith('/${current}'));
      if (!el) return false;
      const btn = el.querySelector('button');
      if (!btn) return false;
      if (btn.getAttribute('aria-expanded') === 'true') return true;
      btn.click();
      return true;
    })()`, 15000, 800);
    if (!ok) return false;
    await sleep(900);
  }
  return true;
}

// 打开文件前：先激活「文件」tab（若当前在别的 tab），再确保导航到 fixtures-v03
async function ensureFixturesTree() {
  await evalJs(`(() => {
    const chip = [...document.querySelectorAll('[data-dockkit-tab]')]
      .find(n => n.textContent.trim() === '文件');
    if (chip) chip.click();
    return true;
  })()`);
  await sleep(800);
  return openDirectory('dsh-plugins/dsh-sidebar-hub/test/fixtures-v03');
}

// 官方文件树根是会话 cwd（工作区根）。逐层进入 fixtures-v03。
// 目录导航可能因默认折叠需要递归展开；先尝试直路。
const navOk = await openDirectory('dsh-plugins/dsh-sidebar-hub/test/fixtures-v03');
check('A17b. 导航到 fixtures-v03', navOk);

// 打开一个文件（用 data-files-path 后缀匹配，比 textContent 可靠）
async function openFile(name) {
  return waitFor(`(() => {
    const el = [...document.querySelectorAll('[data-files-entry="file"]')]
      .find(e => (e.getAttribute('data-files-path') ?? '').endsWith('${name}'));
    if (!el) return false;
    const btn = el.querySelector('button');
    if (!btn) return false;
    btn.click();
    return true;
  })()`, 15000, 800);
}

// ── md + mermaid ───────────────────────────────────────────────────────
const mdOpened = await openFile('demo-mermaid.md');
check('A17c. 打开 demo-mermaid.md', mdOpened);
await waitFor(`(() => {
  const body = document.querySelector('[data-textpreview-body]');
  return body !== null && (body.textContent ?? '').includes('测试文档');
})()`, 20000);
await sleep(2000);
const mdState = await evalJs(`(() => {
  const md = document.querySelector('[data-hub-mermaid-markdown]');
  const body = document.querySelector('[data-textpreview-body]');
  const mermaidDiagrams = document.querySelectorAll('[data-mermaid-diagram]').length;
  const codeBlocks = document.querySelectorAll('.md-code-block').length;
  return { hubMarkdown: md !== null, mermaidDiagrams, codeBlocks, bodyText: (body?.textContent ?? '').slice(0, 120) };
})()`);
check('A17. hub md 渲染器接管（MarkdownText 正常渲染）',
  mdState.hubMarkdown === true || (mdState.bodyText ?? '').length > 20,
  JSON.stringify(mdState));
check('A18. mermaid 图已渲染（>0 个 diagram）', (mdState.mermaidDiagrams ?? 0) >= 1, JSON.stringify(mdState));
check('A18b. mermaid chunk 已加载（diagram 内有 svg）',
  (await evalJs(`(() => {
    const d = document.querySelector('[data-mermaid-diagram]');
    return d !== null && d.querySelector('svg') !== null;
  })()`)) === true);
check('A18c. md 内本地图片经 /shub/file 显示',
  (await waitFor(`(() => {
    const md = document.querySelector('[data-hub-mermaid-markdown]');
    if (md === null) return false;
    // 滚动让 lazy 图片进入视口；等 img[src*=shub/file] 出现
    md.scrollIntoView({ block: 'end' });
    const imgs = [...md.querySelectorAll('img')].filter(i => (i.src ?? '').includes('/shub/file'));
    if (imgs.length === 0) return false;
    return imgs[0].complete === true || imgs[0].naturalWidth > 0 || (imgs[0].currentSrc ?? '') !== '';
  })()`, 20000, 800)) === true);

// ── Office（v0.7 起交还官方内置：官方 office-to-pdf 预览承接 doc/docx/ppt/pptx/xls/xlsx）──
await ensureFixturesTree();
await openFile('demo.docx');
const docxOk = await waitFor(`(() => {
  // 官方预览就绪信号：预览 body 出现（官方转 PDF / 渲染占位），且无「无法查看」空状态
  const unavailable = document.querySelector('[data-sidebar-right-unavailable]') !== null;
  const body = document.querySelector('[data-textpreview-body], [data-office-body], iframe, [data-document-preview]');
  return body !== null && !unavailable;
})()`, 30000, 900);
const docxState = await evalJs(`(() => {
  const body = document.querySelector('[data-textpreview-body]');
  const text = (body?.textContent ?? '').slice(0, 150);
  return { body: body !== null, text };
})()`);
check('A19. docx → 官方内置 Office 预览承接（无「无法查看」空状态）',
  docxOk === true,
  JSON.stringify(docxState));

// ── pptx ───────────────────────────────────────────────────────────────
await ensureFixturesTree();
await openFile('demo.pptx');
const pptxOk = await waitFor(`(() => {
  const unavailable = document.querySelector('[data-sidebar-right-unavailable]') !== null;
  const body = document.querySelector('[data-textpreview-body], [data-office-body], iframe, [data-document-preview]');
  return body !== null && !unavailable;
})()`, 30000, 900);
const pptxState = await evalJs(`(() => {
  const body = document.querySelector('[data-textpreview-body]');
  return { body: body !== null, text: (body?.textContent ?? '').slice(0, 120) };
})()`);
check('A20. pptx → 官方内置 Office 预览承接（无「无法查看」空状态）',
  pptxOk === true,
  JSON.stringify(pptxState));

check('A21. 无未捕获异常 / 无 error 级控制台输出',
  exceptions.length === 0 && consoleErrors.length === 0,
  `exceptions=${exceptions.length} errors=${consoleErrors.length}\n${[...exceptions, ...consoleErrors].slice(0, 3).join('\n')}`);

console.log(`\n结果：${results.length - failed}/${results.length} 通过`);
process.exit(failed === 0 ? 0 : 1);