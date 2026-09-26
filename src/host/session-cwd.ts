/**
 * 解析会话权威 cwd（独立模块，避免 api.ts ↔ routes.ts 循环依赖）。
 * 会话 header → 调用方 cwd（绝对化）→ 持久化冷读 → 进程 cwd。
 */
import type { Context } from './types.ts';
import { SidebarError } from './wire.ts';
import { requireAbsolute } from './fs-tree.ts';
import { readPersistedSession } from './session-store.ts';

export async function sessionCwdOf(ctx: Context, sessionId: string, clientCwd?: string): Promise<string> {
  const session = ctx.sessions.get(sessionId);
  const headerCwd = session?.header.cwd;
  if (headerCwd !== undefined && headerCwd !== '') return headerCwd;
  if (clientCwd !== undefined && clientCwd !== '') {
    try {
      return requireAbsolute(clientCwd);
    } catch {
      throw new SidebarError('bad-request', `invalid working directory "${clientCwd}"`, 400);
    }
  }
  const persistence = (ctx as { get(name: string): unknown }).get('sessionPersistence');
  if (persistence !== undefined && typeof (persistence as { open?: unknown }).open === 'function') {
    try {
      const persisted = await readPersistedSession(persistence as never, sessionId);
      const metaCwd = persisted.header.cwd;
      if (metaCwd !== undefined && metaCwd !== '') {
        try {
          return requireAbsolute(metaCwd);
        } catch {
          throw new SidebarError('bad-request', `invalid working directory "${metaCwd}"`, 400);
        }
      }
    } catch {
      // 冷读失败不阻断：退回进程 cwd（部署无持久化时）。
    }
  }
  return process.cwd();
}