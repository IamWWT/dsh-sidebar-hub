/**
 * 插件配置（cordis.patch.yml 对齐；settings.yaml 可覆盖）。
 * 只声明代码实际消费的键（工程规范）。终端配置自 v0.2 起由官方终端负责。
 */
export interface SidebarHubConfig {
  /** 工作区围栏：true=只放行会话工作区内路径（默认安全）；false=放行任意绝对路径 */
  workspaceFenceEnabled: boolean;
  /** 上传单文件字节上限 */
  uploadLimitBytes: number;
  /** 媒体/HTML 预览单文件字节上限 */
  mediaLimitBytes: number;
  /** 目录列表返回条数上限 */
  listLimit: number;
  /** fs.read 文本读取字节上限 */
  readLimit: number;
}

export const DEFAULT_CONFIG: SidebarHubConfig = {
  workspaceFenceEnabled: true,
  uploadLimitBytes: 10 * 1024 * 1024,
  mediaLimitBytes: 10 * 1024 * 1024,
  listLimit: 1000,
  readLimit: 1024 * 1024,
};

export function resolveConfig(raw: unknown): SidebarHubConfig {
  const cfg = (raw !== null && typeof raw === 'object' ? raw : {}) as Partial<SidebarHubConfig>;
  return {
    workspaceFenceEnabled: cfg.workspaceFenceEnabled ?? DEFAULT_CONFIG.workspaceFenceEnabled,
    uploadLimitBytes: cfg.uploadLimitBytes ?? DEFAULT_CONFIG.uploadLimitBytes,
    mediaLimitBytes: cfg.mediaLimitBytes ?? DEFAULT_CONFIG.mediaLimitBytes,
    listLimit: cfg.listLimit ?? DEFAULT_CONFIG.listLimit,
    readLimit: cfg.readLimit ?? DEFAULT_CONFIG.readLimit,
  };
}
