/**
 * 类型面（自研精简版）：结构对齐 dsh 的 webServer / sessions / sessionPersistence
 * / webStartup / tools 服务的实际形状。
 * context-types.ts，只保留本插件 host 侧消费的面。
 */

/** 路由处理器见到的请求面（node IncomingMessage 的结构子集）。 */
export interface SidebarHttpRequest {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  [Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>;
}

/** 路由处理器写入的响应面（node ServerResponse 的结构子集）。 */
export interface SidebarHttpResponse {
  statusCode: number;
  writeHead(status: number, headers?: Record<string, string>): void;
  end(body?: string | Uint8Array): void;
}

/** upgrade 套接字面（结构子集：fence 用的 destroy）。 */
export interface SidebarUpgradeSocket {
  destroy(): void;
}

/** upgrade head 字节（运行时是 Buffer，类型按字节声明避免 Node 全局泄入声明图）。 */
export type SidebarUpgradeHead = Uint8Array;

/** 一条命名 webServer 路由（host-webserver WebRoute 的镜像）。 */
export interface SidebarWebRoute {
  kind: 'exact' | 'prefix';
  path: string;
  handler: (req: SidebarHttpRequest, res: SidebarHttpResponse) => void | Promise<void>;
}

/** 一条 exact-path HTTP upgrade 注册（WebUpgradeRoute 镜像）。 */
export interface SidebarWebUpgradeRoute {
  path: string;
  handler: (req: SidebarHttpRequest, socket: SidebarUpgradeSocket, head: SidebarUpgradeHead) => void | Promise<void>;
}

/** 本插件用到的 webServer 服务面。 */
export interface SidebarWebServer {
  register(route: SidebarWebRoute): () => void;
  registerUpgrade(route: SidebarWebUpgradeRoute): () => void;
}

/** 会话摘要（header.cwd 是 sessionCwdOf 的第一权威来源）。 */
export interface SidebarSessionSummary {
  id: string;
  header: Record<string, unknown> & { cwd?: string };
  /** 会话追加日志的不可变快照（jobs output 回放用）。 */
  snapshotEvents(): readonly SidebarSessionEvent[];
}

/** sessions 服务面（只读 get）。 */
export interface SidebarSessionsService {
  get(sessionId: string): SidebarSessionSummary | undefined;
}

/** 会话事件（透传，宽松形状）。 */
export interface SidebarSessionEvent {
  type: string;
  /** 会话日志序号（jobs trace 去重/排序用）。 */
  seq: number;
  /** 事件载荷（宽松）。 */
  data?: unknown;
  [key: string]: unknown;
}

/** sessionPersistence 服务面（冷会话读 header/事件日志）。 */
export interface SidebarSessionPersistenceService {
  open(id: string, mode: 'read'): Promise<SidebarSessionHandle>;
}

/** 持久化会话读句柄。 */
export interface SidebarSessionHandle {
  readonly header: Record<string, unknown> & { cwd?: string };
  readonly inheritedEventCount?: number;
  read(): Promise<{ events: readonly SidebarSessionEvent[] }>;
  close(): Promise<void>;
}

/** webStartup 服务面（trustedHosts 供 API fence）。 */
export interface SidebarWebStartup {
  trustedHosts: readonly string[];
}

/** 工具注册服务面（@deepseek-ai/dsh-tools 的宿主侧 face）。 */
export interface SidebarToolsService {
  /** 注册一个工具定义；返回注销器。 */
  register(tool: unknown): () => void;
}

/** 后台任务注册表面（jobs 服务；缺失时 jobs.* 降级 503）。 */
export interface SidebarJobsService {
  /** 请求取消；未知或外来的任务抛错。返回任务结果（'requested' 或 'already-finished'）。 */
  kill(id: string, caller: unknown, reason?: string): 'requested' | 'already-finished';
}

/** 活动 agent 注册表面（agents 服务；缺失时 kill 的 caller 为 undefined）。 */
export interface SidebarAgentsService {
  get(sessionId: string): unknown;
}

/** subagent 运行时面（ctx.get('subagents')；缺失时 subagents.live 降级 503）。 */
export interface SidebarSubagentsService {
  listDescendants(rootSessionId: string): Promise<readonly {
    kind: 'child' | 'root';
    id: string;
    activity?: string;
    label?: string;
  }[]>;
}

/** 插件运行上下文（自定面，不继承 cordis Context 以避免 sessions 类型冲突）。 */
export interface Context {
  /** 注册一个随 fiber 生命周期清理的 effect；返回清理器。 */
  effect(fn: () => void | (() => void), label?: string): void;
  /** 读取命名服务（不声明 inject 的服务不可直接属性访问）。 */
  get(name: string): unknown;
  /** 可选服务注入回调（cordis 语义：依赖满足才回调）。 */
  inject(deps: readonly string[], cb: (ctx: Context) => void): void;
  /** 会话事件订阅（jobs output 镜像用；缺失时镜像降级为 seed-only 回放）。 */
  on?(event: string, listener: (session: unknown, event: SidebarSessionEvent) => void): () => void;
  logger?: { warn(message: string): void; info(message: string): void };
  webServer: SidebarWebServer;
  sessions: SidebarSessionsService;
  webStartup: SidebarWebStartup;
  tools?: SidebarToolsService;
}

/** 带必选 tools 服务的上下文（模型工具注册回调里使用）。 */
export interface ContextWithTools extends Context {
  tools: SidebarToolsService;
}