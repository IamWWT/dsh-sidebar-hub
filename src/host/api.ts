/**
 * /shub/api/<method> JSON 网关的方法表（wire 契约：点号方法名）。
 *
 * 当前方法：session/fs 基础 + settings.* / open.external（其余随功能加入）。
 * 终端方法（pty/terminal.deps 等）自 v0.2、浏览器方法（browser.probe）自 v0.5、
 * git.* / jobs.* / subagents.live / changes.ops 自 v0.6 起随自研终端/浏览器/
 * 内容类型移除（官方 kind='terminal'/'browser' 接管；hub-* 自研内容全部下线）。
 * 所有方法在 routes.ts 的网关里统一执行，错误归一为 SidebarError → { ok:false }。
 */
import { readFile, stat, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Context } from './types.ts';
import { SidebarError } from './wire.ts';
import { listDirectory, rootLabel, parentOf } from './fs-tree.ts';
import { searchFiles } from './fs-search.ts';
import { ensureWorkspacePath, ensureWorkspaceWritePath } from './path-security.ts';
import { renameWorkspaceEntry, removeWorkspaceEntry } from './fs-operations.ts';
import { sessionCwdOf } from './session-cwd.ts';
import type { SidebarHubConfig } from './config.ts';

/** 一个 API 方法：接收 JSON payload，返回 JSON 序列化值（错误一律 throw SidebarError）。 */
export type ApiMethod = (payload: unknown) => Promise<unknown>;

/** 从 payload 里取必填字符串，缺失/非字符串抛 400。 */
function requireString(payload: unknown, key: string): string {
  const value = (payload !== null && typeof payload === 'object' ? (payload as Record<string, unknown>)[key] : undefined);
  if (typeof value !== 'string' || value === '') {
    throw new SidebarError('bad-request', `missing string field "${key}"`, 400);
  }
  return value;
}

/** 会话作用域解析：{ sessionId, cwd }（所有方法的第一段）。 */
async function cwdOf(ctx: Context, payload: unknown): Promise<{ sessionId: string; cwd: string }> {
  const sessionId = requireString(payload, 'sessionId');
  const record = payload as { cwd?: unknown } | null;
  const clientCwd = typeof record?.cwd === 'string' && record.cwd !== '' ? record.cwd : undefined;
  return { sessionId, cwd: await sessionCwdOf(ctx, sessionId, clientCwd) };
}

/** 读取工作区内文本（binary 检测 + 上限截断）；对齐吸收源 readText 语义。 */
async function readText(path: string, readLimit: number): Promise<
  | { kind: 'text'; content: string; truncated: boolean }
  | { kind: 'binary'; size: number; truncated: boolean; head: string }
> {
  const info = await stat(path).catch((error: unknown) => {
    throw new SidebarError('fs-error', `cannot read "${path}": ${error instanceof Error ? error.message : String(error)}`, 400);
  });
  if (info.isDirectory()) throw new SidebarError('fs-error', `"${path}" is a directory`, 400);
  const size = info.size;
  const truncated = size > readLimit;
  const bytes = await readFile(path, { encoding: null }).catch((error: unknown) => {
    throw new SidebarError('fs-error', `cannot read "${path}": ${error instanceof Error ? error.message : String(error)}`, 400);
  });
  const head = truncated ? bytes.subarray(0, readLimit) : bytes;
  if (head.includes(0)) return { kind: 'binary', size, truncated, head: head.toString('base64') };
  return { kind: 'text', content: head.toString('utf8'), truncated };
}

/** 构建方法表。 */
export function buildApi(
  ctx: Context,
  cfg: SidebarHubConfig,
): Record<string, ApiMethod> {
  const fence = (): boolean => cfg.workspaceFenceEnabled;
  return {
    'session.cwd': async (payload) => {
      const { sessionId, cwd } = await cwdOf(ctx, payload);
      return { sessionId, cwd, root: rootLabel(cwd), parent: parentOf(cwd) ?? null };
    },
    'fs.tree': async (payload) => {
      const { cwd } = await cwdOf(ctx, payload);
      const record = payload as { path?: unknown };
      const target = record.path === undefined ? cwd : await ensureWorkspacePath(cwd, requireString(payload, 'path'), fence());
      return listDirectory(target, cfg.listLimit);
    },
    'fs.search': async (payload) => {
      const { cwd } = await cwdOf(ctx, payload);
      return searchFiles(cwd, requireString(payload, 'query'));
    },
    'fs.read': async (payload) => {
      const { cwd } = await cwdOf(ctx, payload);
      const path = await ensureWorkspacePath(cwd, requireString(payload, 'path'), fence());
      const result = await readText(path, cfg.readLimit);
      if (result.kind === 'binary') {
        return { kind: 'binary', size: result.size, truncated: result.truncated, head: result.head };
      }
      return { kind: 'text', content: result.content, truncated: result.truncated };
    },
    'fs.write': async (payload) => {
      const { cwd } = await cwdOf(ctx, payload);
      const path = await ensureWorkspaceWritePath(cwd, requireString(payload, 'path'), fence());
      const content = requireString(payload, 'content');
      const tmp = `${path}.dsh-shub-tmp-${process.pid}`;
      try {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(tmp, content, 'utf8');
        await rename(tmp, path);
      } catch (error) {
        await rm(tmp, { force: true }).catch(() => {});
        throw new SidebarError('fs-error', `cannot write "${path}": ${error instanceof Error ? error.message : String(error)}`, 400);
      }
      return { ok: true };
    },
    'fs.rename': async (payload) => {
      const { cwd } = await cwdOf(ctx, payload);
      return renameWorkspaceEntry({
        cwd,
        path: requireString(payload, 'path'),
        name: requireString(payload, 'name'),
        fence: fence(),
      });
    },
    'fs.remove': async (payload) => {
      const { cwd } = await cwdOf(ctx, payload);
      return removeWorkspaceEntry({
        cwd,
        path: requireString(payload, 'path'),
        fence: fence(),
      });
    },
  };
}