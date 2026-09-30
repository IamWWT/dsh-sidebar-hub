/**
 * dsh-sidebar-hub — Host 入口。
 *
 * 注册 /shub/* 路由（JSON 网关 + 媒体/上传/沙箱 HTML 预览 + agent-opens WS），
 * 全部前置 trust-fence。分类配置的 settings 命名空间自 v0.1.7 起**不再需要
 * 注册**：上游 0.2.0-rc.2 的 `SettingsForms.describe()` 自动遍历 profile 里
 * 的 entry，`ns = entry.options.id`（= cordis.patch.yml 的 `id: sidebar-hub`）、
 * schema = 本模块导出的 `Config`（volatile 字段投影成设置表单；见 settings.ts）。
 * 因此这里只导出 Config，不主动调 register。
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

export { Config } from './settings.ts';
export { SETTINGS_NAMESPACE, SETTINGS_CARD_KEY } from './settings.ts';

export const name = 'sidebar-hub';

/** 硬依赖：浏览器 HTTP/WS 载体服务（负责 /shub/* 路由与 upgrade）。 */
export const inject = ['webServer', 'webRuntime', 'sessions'];


/** Cordis 插件入口。config 来自 profile patch 的 config: 段（经 `Config` schema 校验）。 */
export function apply(ctx: Context, rawConfig: unknown = {}): void {
  console.log('[sidebar-hub] host apply');
  const cfg: SidebarHubConfig = resolveConfig(rawConfig);
  // 分类配置的 settings 命名空间由上游 `SettingsForms.describe()` 从本模块导出的
  // `Config`（volatile 字段）自动投影生成（v0.1.7 新契约，见文件头注释），
  // 此处无需（也无法）再调 `settings.register`。

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
