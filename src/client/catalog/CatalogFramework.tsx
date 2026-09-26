/**
 * 分类框架 —— 右侧栏起始页（替换原生引导页正文）。
 *
 * 由 entry.ts 注册进 `sidebar.right.tab.guide`（chain slot，select 恒接管）：
 * 打开右侧栏看到的起始页就是分组化的插件入口清单。
 *
 * 交互（T4）：
 *   - 点条目 → `openTab(kind)` 打开对应内容；
 *   - 拖拽条目 → 跨分组移动 / 组内排序（写回分类配置）；
 *   - 分组头 → 折叠展开、重命名、删除；底部「＋ 新分组」新建；
 *   - 头部「⟲ 恢复默认」清空自定义（回落出厂分类）。
 *
 * 数据来自 entry.ts 的 inject 面：`useCatalog()`（自动发现 + 配置解析后的分组）
 * 与一组写操作（统一经 config-store 落 DSH settings）。
 */
import './catalog.css';
import { useEffect, useRef, useState } from 'react';
import type { CatalogGroup } from './mapping.ts';
import { OTHER_GROUP_ID } from '../catalog/mapping.ts';
import { t } from '../locales.ts';
import type * as ReactNS from 'react';
import { TerminalLauncher, type TerminalLaunchActions } from './TerminalLauncher.tsx';

/** 组件从 inject 面收到的数据与回调（entry.ts 装配）。 */
export interface CatalogInjected {
  terminal: TerminalLaunchActions;
  /** 打开一个 kind 的内容（apply 闭包经 ctx.sidebarRight.openTab）。 */
  openTab: (kind: string) => void;
  /** 折叠/展开一个分组。 */
  toggleGroup: (groupId: string) => void;
  /** 新建分组并返回其 id（便于立刻进入重命名态）。 */
  addGroup: (title: string) => string;
  /** 重命名分组。 */
  renameGroup: (groupId: string, title: string) => void;
  /** 删除分组（组内条目落回「其他」）。 */
  deleteGroup: (groupId: string) => void;
  /** 移动/排序条目：kind 归入 toGroupId（null = 其他），并整桶替换 order。 */
  moveEntry: (kind: string, toGroupId: string | null, order?: Record<string, string[]>) => void;
  /** 恢复出厂分类。 */
  resetCatalog: () => void;
  /** 重新读注册表并解析分类（低频兜底；结果未变则空转）。 */
  refreshCatalog: () => void;
  /** 分类配置的持久化状态（'memory' = settings 不可用，改动只在本次会话）。 */
  persistence: () => 'pending' | 'host' | 'memory';
}

/**
 * 框架把 inject 的 `hooks` 格绑成 **uSES 选择器钩子**：签名是
 * `use<Name>(selector, isEqual?)`，**selector 是必填参数**
 * （`ui-renderer/src/client/bind.ts` 的 `bindSnapshotSelector`）。无参调用
 * 会在框架内部 `sel(snapshot)` 处抛 `is not a function`。
 */
export type SelectorHook<T> = <S>(select: (value: T) => S, isEqual?: (left: S, right: S) => boolean) => S;

/** 组件 props：inject 面 + hooks 格绑出的 useCatalog。 */
export type CatalogProps = CatalogInjected & {
  /** 分类数据读取（选择器钩子；本组件取全量，故用恒等选择器）。 */
  useCatalog: SelectorHook<readonly CatalogGroup[]>;
};

/** 兜底轮询间隔（毫秒）：注册表变更订阅缺失时的保险，改动才触发重渲染。 */
const REFRESH_INTERVAL_MS = 4000;

/** 拖拽中的条目 kind（HTML5 DnD 的 dragover 读不到 dataTransfer，故用模块级态）。 */
let draggingKind: string | null = null;

/**
 * 条目图标块里的一个字：中文取首字，英文/数字取首字母（大写）。
 * 纯装饰（`aria-hidden`），只为一眼分辨条目。
 * @param title - 条目显示名。
 * @returns 一个字符。
 */
function tileGlyph(title: string): string {
  const trimmed = title.trim();
  if (trimmed === '') return '·';
  const first = [...trimmed][0] ?? '·';
  return /[a-z]/.test(first) ? first.toUpperCase() : first;
}

/**
 * 起始页分类框架。
 * @param props - inject 面（openTab/分组与条目编辑/refreshCatalog）+ useCatalog 钩子。
 * @returns 分组化的插件入口界面。
 */
export function CatalogFramework(props: CatalogProps): ReactNS.ReactElement {
  const {
    openTab, toggleGroup, addGroup, renameGroup, deleteGroup, moveEntry, resetCatalog,
    refreshCatalog, persistence, useCatalog,
  } = props;
  const groups = useCatalog(value => value);

  /** 重命名中的分组 id（null = 无）。 */
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  /** 重命名输入框的草稿。 */
  const [draft, setDraft] = useState('');
  /** 拖拽落点提示：`${groupId}:${kind}` 或 `${groupId}:end`。 */
  const [dropAt, setDropAt] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);

  // 起始页可能比其它插件先挂载：挂载后补一次发现，并低频兜底（refresh 内部去重）。
  useEffect(() => {
    refreshCatalog();
    const timer = window.setInterval(refreshCatalog, REFRESH_INTERVAL_MS);
    return () => { window.clearInterval(timer); };
  }, [refreshCatalog]);

  /** 目标分组里「拖入 kind 之后」的顺序数组。 */
  const orderAfter = (groupId: string, kind: string, beforeKind: string | null): string[] => {
    const current = groups.find(group => group.id === groupId)?.items.map(item => item.kind) ?? [];
    const without = current.filter(existing => existing !== kind);
    if (beforeKind === null) return [...without, kind];
    const at = without.indexOf(beforeKind);
    if (at < 0) return [...without, kind];
    return [...without.slice(0, at), kind, ...without.slice(at)];
  };

  /** 处理一次落点（`beforeKind` 为 null 表示落到该组末尾）。 */
  const drop = (targetGroupId: string, beforeKind: string | null): void => {
    const kind = dragRef.current;
    dragRef.current = null;
    draggingKind = null;
    setDropAt(null);
    if (kind === null) return;
    const sourceGroupId = groups.find(group => group.items.some(item => item.kind === kind))?.id;
    const order: Record<string, string[]> = {};
    if (targetGroupId !== OTHER_GROUP_ID) order[targetGroupId] = orderAfter(targetGroupId, kind, beforeKind);
    if (sourceGroupId !== undefined && sourceGroupId !== targetGroupId && sourceGroupId !== OTHER_GROUP_ID) {
      order[sourceGroupId] = (groups.find(group => group.id === sourceGroupId)?.items ?? [])
        .map(item => item.kind).filter(existing => existing !== kind);
    }
    moveEntry(kind, targetGroupId === OTHER_GROUP_ID ? null : targetGroupId, order);
  };

  const memoryMode = persistence() !== 'host';

  return (
    <div className="hubCatalog">
      <div className="catalogHead">
        <span className="catalogTitle">{t('catalog.title')}</span>
        <div className="catalogActions">
          {memoryMode && (
            <span className="catalogWarn" title={t('catalog.memoryHint')}>{t('catalog.memoryBadge')}</span>
          )}
          <button type="button" className="catalogBtn" title={t('catalog.reset')} onClick={resetCatalog}>
            {'\u27f2 '}{t('catalog.reset')}
          </button>
        </div>
      </div>

      {groups.map(group => (
        <section
          key={group.id}
          className="catalogGroup"
          data-tone={group.tone}
          data-drop={dropAt !== null && dropAt.startsWith(`${group.id}:`) ? 'true' : undefined}
          onDragOver={(event) => {
            if (draggingKind === null) return;
            event.preventDefault();
            setDropAt(`${group.id}:end`);
          }}
          onDrop={(event) => {
            event.preventDefault();
            drop(group.id, null);
          }}
        >
          <div className="catalogGroupHeadRow">
            <button
              type="button"
              className="catalogGroupHead"
              aria-expanded={!group.collapsed}
              onClick={() => { toggleGroup(group.id); }}
            >
              <span className="catalogCaret">{group.collapsed ? '▸' : '▾'}</span>
              {editingGroup === group.id ? (
                <input
                  className="catalogGroupInput"
                  value={draft}
                  autoFocus
                  onChange={(event) => { setDraft(event.target.value); }}
                  onClick={(event) => { event.stopPropagation(); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { renameGroup(group.id, draft); setEditingGroup(null); }
                    if (event.key === 'Escape') setEditingGroup(null);
                  }}
                  onBlur={() => { renameGroup(group.id, draft); setEditingGroup(null); }}
                />
              ) : (
                <span className="catalogGroupTitle">{group.title}</span>
              )}
              <span className="catalogCount">{group.items.length}</span>
            </button>
            {group.id !== OTHER_GROUP_ID && editingGroup !== group.id && (group.protected !== true || group.renameLocked !== true) && (
              <span className="catalogGroupTools">
                {!group.renameLocked && (
                  <button
                    type="button"
                    className="catalogIconBtn"
                    title={t('catalog.renameGroup')}
                    onClick={() => { setEditingGroup(group.id); setDraft(group.title); }}
                  >{'✎'}</button>
                )}
                {!group.protected && (
                  <button
                    type="button"
                    className="catalogIconBtn"
                    title={t('catalog.deleteGroup')}
                    onClick={() => {
                      if (window.confirm(t('catalog.confirmDelete').replace('{name}', group.title))) deleteGroup(group.id);
                    }}
                  >{'✕'}</button>
                )}
              </span>
            )}
          </div>

          {!group.collapsed && (
            <div className="catalogItems">
              {group.items.map(item => (
                item.kind === 'terminal' ? <div key={item.kind} data-kind="terminal" draggable
                  onDragStart={event => {
                    draggingKind = item.kind; dragRef.current = item.kind;
                    event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.kind);
                  }}
                  onDragEnd={() => { draggingKind = null; dragRef.current = null; setDropAt(null); }}
                  onDragOver={event => { if (draggingKind === null) return; event.preventDefault(); event.stopPropagation(); setDropAt(`${group.id}:${item.kind}`); }}
                  onDrop={event => { event.preventDefault(); event.stopPropagation(); drop(group.id, item.kind); }}>
                  <TerminalLauncher title={item.title} actions={props.terminal} />
                </div> :
                <button
                  key={item.kind}
                  type="button"
                  className="catalogItem"
                  title={item.description ?? item.title}
                  data-kind={item.kind}
                  data-official={item.official ? 'true' : undefined}
                  data-drop={dropAt === `${group.id}:${item.kind}` ? 'true' : undefined}
                  draggable
                  onDragStart={(event) => {
                    draggingKind = item.kind;
                    dragRef.current = item.kind;
                    event.dataTransfer.effectAllowed = 'move';
                    // Firefox 需要 setData 才会启动拖拽。
                    try { event.dataTransfer.setData('text/plain', item.kind); } catch { /* 忽略 */ }
                  }}
                  onDragEnd={() => { draggingKind = null; dragRef.current = null; setDropAt(null); }}
                  onDragOver={(event) => {
                    if (draggingKind === null) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setDropAt(`${group.id}:${item.kind}`);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    drop(group.id, item.kind);
                  }}
                  onClick={() => { openTab(item.kind); }}
                >
                  <span className="catalogItemTile" aria-hidden="true">{tileGlyph(item.title)}</span>
                  <span className="catalogItemLabel">{item.title}</span>
                  {item.official && <span className="catalogItemOfficial">{t('catalog.official')}</span>}
                </button>
              ))}
              {group.items.length === 0 && (
                <span className="catalogEmpty">{t('catalog.empty')}</span>
              )}
            </div>
          )}
        </section>
      ))}

      <div className="catalogFooter">
        <button
          type="button"
          className="catalogBtn"
          onClick={() => {
            const id = addGroup(t('catalog.newGroup'));
            setEditingGroup(id);
            setDraft(t('catalog.newGroup'));
          }}
        >＋ {t('catalog.addGroup')}</button>
        <span className="catalogHint">{t('catalog.hint')}</span>
      </div>
    </div>
  );
}
