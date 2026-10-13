/**
 * /shub/* 路由注册：JSON 网关 + 媒体/上传/沙箱 HTML 预览 + agent-opens WS。
 * 全部前置 trust-fence（isTrustedApiRequest + webStartup.trustedHosts）。
 * 终端 WS（/shub/ws/terminal、/shub/ws/agent-terminals）自 v0.2 起随自研终端
 * 移除——官方 kind='terminal' 与 dsh-tool-terminal 接管。
 */
import { stat, readFile } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Context, SidebarHttpRequest, SidebarHttpResponse } from './types.ts';
import { isTrustedApiRequest } from './trust-fence.ts';
import { SidebarError, readJsonBody, writeJson, writeOk, writeError } from './wire.ts';
import { buildApi } from './api.ts';
import { ensureWorkspacePath } from './path-security.ts';
import { writeWorkspaceUpload } from './fs-operations.ts';
import { sessionCwdOf } from './session-cwd.ts';
import { decodeHtmlUrl } from './html-route.ts';
import { attachAgentOpen } from './agent-opens.ts';
import type { AgentOpenRegistry } from './agent-opens.ts';
import type { SidebarHubConfig } from './config.ts';

/** 按媒体类型返回 Content-Type（图片/文本/JSON 等）。 */
export function mediaTypeForPath(path: string): string {
  const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
  const map: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
    '.json': 'application/json', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.pdf': 'application/pdf',
  };
  return map[ext] ?? 'application/octet-stream';
}

/** 注册全部 /shub 路由；返回 disposer 数组。 */
export function registerHubRoutes(
  ctx: Context,
  cfg: SidebarHubConfig,
  agentOpenRegistry: AgentOpenRegistry,
): Array<() => void> {
  const disposers: Array<() => void> = [];
  const fence = (req: SidebarHttpRequest): boolean => isTrustedApiRequest(req, ctx.webStartup.trustedHosts);
  const api = buildApi(ctx, cfg);

  // ── JSON 网关：/shub/api/<method>（POST）──────────────────────────────
  disposers.push(ctx.webServer.register({
    kind: 'prefix',
    path: '/shub/api',
    handler: async (req, res) => {
      if (!fence(req)) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } });
        return;
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } });
        return;
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname;
      const method = pathname.startsWith('/shub/api/') ? pathname.slice('/shub/api/'.length) : undefined;
      if (method === undefined || method.includes('/')) {
        writeError(res, new SidebarError('not-found', 'unknown sidebar API method', 404));
        return;
      }
      try {
        const payload = await readJsonBody(req);
        const handler = api[method];
        if (handler === undefined) {
          throw new SidebarError('not-found', `unknown sidebar API method "${method}"`, 404);
        }
        writeOk(res, await handler(payload));
      } catch (error) {
        writeError(res, error);
      }
    },
  }));

  // ── 原始上传：/shub/upload（POST，一次一文件）─────────────────────────
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/shub/upload',
    handler: async (req, res) => {
      if (!fence(req)) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } });
        return;
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } });
        return;
      }
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal');
        const sessionId = url.searchParams.get('sessionId');
        const dir = url.searchParams.get('dir');
        const relativePath = url.searchParams.get('relativePath');
        if (sessionId === null || dir === null || relativePath === null || relativePath.trim() === '') {
          throw new SidebarError('bad-request', 'sessionId, dir, and relativePath are required');
        }
        const cwd = await sessionCwdOf(ctx, sessionId, url.searchParams.get('cwd') ?? undefined);
        const { path, size } = await writeWorkspaceUpload({
          cwd,
          dir,
          relativePath,
          chunks: req,
          limit: cfg.uploadLimitBytes,
          fence: cfg.workspaceFenceEnabled,
        });
        writeOk(res, { path, size });
      } catch (error) {
        writeError(res, error);
      }
    },
  }));

  // ── 媒体路由：/shub/file（GET，图片/下载等）───────────────────────────
  disposers.push(ctx.webServer.register({
    kind: 'prefix',
    path: '/shub/file',
    handler: async (req, res) => {
      if (!fence(req)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      if (req.method !== 'GET') {
        res.writeHead(405);
        res.end();
        return;
      }
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal');
        const sessionId = url.searchParams.get('sessionId');
        const raw = url.searchParams.get('path');
        if (sessionId === null || raw === null) throw new SidebarError('bad-request', 'sessionId and path are required');
        const cwd = await sessionCwdOf(ctx, sessionId, url.searchParams.get('cwd') ?? undefined);
        // 支持工作区相对路径（md 内图片等由客户端按会话 cwd 解析为相对路径）：
        // 相对时先拼到会话 cwd，再走 ensureWorkspacePath 的围栏校验。
        const target = isAbsolute(raw) ? raw : join(cwd, raw);
        const path = await ensureWorkspacePath(cwd, target, cfg.workspaceFenceEnabled);
        const info = await stat(path);
        if (!info.isFile() || info.size > cfg.mediaLimitBytes) {
          throw new SidebarError('fs-error', 'not a file or too large', 400);
        }
        const type = mediaTypeForPath(path);
        const body = await readFile(path);
        const headers: Record<string, string> = { 'content-type': type, 'cache-control': 'no-cache' };
        if (url.searchParams.get('download') === '1') {
          headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(basename(path))}`;
        }
        res.writeHead(200, headers);
        res.end(body);
      } catch (error) {
        writeError(res, error);
      }
    },
  }));

  // ── 沙箱 HTML 预览：/shub/html（GET，opaque origin + CSP）─────────────
  disposers.push(ctx.webServer.register({
    kind: 'prefix',
    path: '/shub/html',
    handler: async (req, res) => {
      if (!fence(req)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      if (req.method !== 'GET') {
        res.writeHead(405);
        res.end();
        return;
      }
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal');
        const decoded = decodeHtmlUrl(url.pathname);
        if (!decoded.ok) {
          writeError(res, new SidebarError('bad-request', decoded.message, 400));
          return;
        }
        const { sessionId, path } = decoded.ref;
        const cwd = await sessionCwdOf(ctx, sessionId);
        const absolute = await ensureWorkspacePath(cwd, path, cfg.workspaceFenceEnabled);
        const info = await stat(absolute);
        if (!info.isFile() || info.size > cfg.mediaLimitBytes) {
          throw new SidebarError('fs-error', 'not a file or too large', 400);
        }
        const type = mediaTypeForPath(absolute);
        const body = await readFile(absolute);
        res.writeHead(200, {
          'content-type': type === 'text/html' ? 'text/html; charset=utf-8' : type,
          'cache-control': 'no-cache',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer',
          'content-security-policy': "sandbox allow-scripts allow-popups allow-downloads allow-modals; object-src 'none'",
        });
        res.end(body);
      } catch (error) {
        writeError(res, error);
      }
    },
  }));

  // ── 惰性 chunk 伺服：/shub/bundle/<name>.js（mermaid/office 等重型库）──
  // client 侧 chunk-loader 只在功能首次使用时注入 <script> 加载；产物为
  // dist/chunk-<name>.js（与 dist/index.js 同目录），由 build.mjs 构建。
  const chunkDir = fileURLToPath(new URL('.', import.meta.url));
  disposers.push(ctx.webServer.register({
    kind: 'prefix',
    path: '/shub/bundle',
    handler: async (req, res) => {
      if (!fence(req)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      if (req.method !== 'GET') {
        res.writeHead(405);
        res.end();
        return;
      }
      const url = new URL(req.url ?? '/', 'http://dsh.internal');
      const name = url.pathname.slice('/shub/bundle/'.length);
      if (name === '' || name.includes('/') || name.includes('..') || !/^[a-z0-9-]+\.js$/.test(name)) {
        res.writeHead(400);
        res.end('bad chunk name');
        return;
      }
      const file = join(chunkDir, `chunk-${name}`);
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('chunk not found');
      }
    },
  }));

  // ── Agent opens 推送：/shub/ws/agent-opens（sidebar_open 请求）
  const agentOpenWss = new WebSocketServer({ noServer: true });
  disposers.push(ctx.webServer.registerUpgrade({
    path: '/shub/ws/agent-opens',
    handler: (req, socket, head) => {
      if (!fence(req)) {
        socket.destroy();
        return;
      }
      agentOpenWss.handleUpgrade(
        req as unknown as IncomingMessage,
        socket as unknown as Duplex,
        head as Buffer,
        (ws) => {
          void attachAgentOpen(agentOpenRegistry, ws, req);
        },
      );
    },
  }));
  disposers.push(() => { agentOpenWss.close(); });

  return disposers;
}