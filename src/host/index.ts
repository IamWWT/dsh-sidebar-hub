/**
 * dsh-sidebar-hub — Host 入口。
 *
 * 注册 /shub/* 路由（JSON 网关 + 媒体/上传/沙箱 HTML 预览 + agent-opens WS），
 * 全部前置 trust-fence。另注册 settings 命名空间 `dsh-sidebar-hub`（分类配置；
 * client 侧 bind 读写）。
 *
 * 终端自 v0.2 起交还官方（`kind='terminal'`，builtin）：本插件不再装配
 * node-pty / 模型 terminal_* 工具（与官方 dsh-tool-terminal 重名冲突源已移除）；
 * 保留的 `agent-opens`（sidebar_open 工具 + WS 推送）是独立能力。
 */
import { resolveConfig } from './config.ts';
import type { SidebarHubConfig } from './config.ts';
import type { Context, ContextWithTools } from './types.ts';
import { registerHubRoutes } from './routes.ts';
import { AgentOpenRegistry, registerOpenTool } from './agent-opens.ts';
import { sessionCwdOf } from './session-cwd.ts';
import { HUB_SETTINGS_BASE, HubSettingsSchema, SETTINGS_NAMESPACE, type HubSettings } from './settings.ts';

export const name = 'sidebar-hub';

/** 硬依赖：浏览器 HTTP/WS 载体服务（负责 /shub/* 路由与 upgrade）。 */
export const inject = ['webServer', 'webRuntime', 'sessions'];

/** settings 服务的最小面（可选依赖：缺失时分类配置退回出厂默认）。 */
interface SettingsLike {
  /** 注册一个命名空间（options.base = 组合基准层）。 */
  register<T>(namespace: string, schema: unknown, options?: { base?: unknown }): unknown;
}

/** 可选依赖的宿主上下文面。 */
interface ContextWithSettings {
  settings: SettingsLike;
}


/** Cordis 插件入口。config 来自 profile patch 的 config: 段。 */
export function apply(ctx: Context, rawConfig: unknown = {}): void {
  console.log('[sidebar-hub] host apply');
  const cfg: SidebarHubConfig = resolveConfig(rawConfig);

  // sidebar_open 请求队列（模型打开文件/文件夹/网页到侧边栏；WS 推送 + 会话排队）。
  const agentOpenRegistry = new AgentOpenRegistry();

  // sidebar_open 工具：可选依赖 tools 服务（headless / 无工具宿主下静默跳过）。
  let openToolDisposer: (() => void) | null = null;
  ctx.inject(['tools'], (raw) => {
    const toolsCtx = raw as ContextWithTools;
    if (openToolDisposer === null) {
      openToolDisposer = registerOpenTool(
        toolsCtx,
        agentOpenRegistry,
        (sessionId) => sessionCwdOf(ctx, sessionId),
      );
    }
  });

  // 分类配置的 settings 命名空间（可选依赖：settings 服务缺失时静默跳过，
  // client 侧读到 unavailable 会退回出厂默认并在设置卡片给出提示）。
  ctx.inject(['settings'], (raw) => {
    const settingsCtx = raw as unknown as ContextWithSettings;
    try {
      // 第三个参数是 register 的 options（base = 组合基准层），不是 base 本身。
      settingsCtx.settings.register<HubSettings>(SETTINGS_NAMESPACE, HubSettingsSchema, { base: HUB_SETTINGS_BASE });
      console.log(`[sidebar-hub] settings 命名空间已注册：${SETTINGS_NAMESPACE}`);
    } catch (error) {
      ctx.logger?.warn(`[sidebar-hub] 注册 settings 命名空间失败：${String(error)}`);
    }
  });

  ctx.effect(() => {
    const disposers = registerHubRoutes(ctx, cfg, agentOpenRegistry);
    return () => {
      openToolDisposer?.();
      openToolDisposer = null;
      agentOpenRegistry.dispose();
      for (const dispose of disposers) dispose();
    };
  });
}
