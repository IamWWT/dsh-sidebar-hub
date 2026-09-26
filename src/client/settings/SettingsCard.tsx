/**
 * 设置页卡片「右侧栏分类」（`settings.plugin.item`，key = settings 命名空间）。
 *
 * 与右侧栏分类页**共用同一份配置**（都经 `catalog/config-store.ts` 读写），
 * 只是编辑手段不同：这里是表单（下拉改归属 / 输入改显示名 / 勾选隐藏），
 * 分类页是拖拽。
 *
 * 外观与交互**对齐框架内置插件卡片**（`ui-settings-plugins` 的 PluginCard）：
 * 外层是一张 `<li>` 卡片（0.5px 边框 / 16px 圆角 / `--dsw-alias-bg-layer-3`），
 * 头部按钮折叠展开，body 与头部之间一条 `--dsw-alias-border-l2` 分隔线。
 * 卡片内部再用两个可折叠小节（分组 / 条目映射）承载表单，避免一屏塞满表格。
 *
 * 表格覆盖两类行：
 *   - 已登记：注册表发现到的 kind（有真实入口）；
 *   - 未登记：配置里存在、但注册表当前没有的 kind（插件卸载/改名遗留）——
 *     标「未登记」并可「移除规则」。
 */
import './settings.css';
import { useState } from 'react';
// 上游 ui-primitives 已把「尺寸写进名字」（IconChevronDownOutline14）改成
// 「字重写进名字 + size 属性」：Regular = 1px 描边，Artwork 默认 size=14，
// 与原 14px 语义一致。旧名字在新版导出里已不存在，引用会得到 undefined，
// 渲染时抛 React #130（Element type is invalid），整张设置卡片空白。
import { IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { OTHER_GROUP_ID, toneOf } from '../catalog/mapping.ts';
import { t } from '../locales.ts';
import type * as ReactNS from 'react';

/** 卡片里的一行（entry.ts 由「发现 + 配置」派生）。 */
export interface SettingsRow {
  kind: string;
  /** 当前显示名（配置覆盖或注册表标题）。 */
  title: string;
  /** 所属分组 id；`undefined` = 「其他」。 */
  groupId: string | undefined;
  /** 是否隐藏。 */
  hidden: boolean;
  /** 注册表里是否还有这个入口（false = 未登记）。 */
  registered: boolean;
  /** 注册表给的说明（未登记时为空）。 */
  description?: string;
}

/** 卡片可选分组。 */
export interface SettingsGroupOption {
  id: string;
  title: string;
  /** 默认五组：不可删除（隐藏 ✕）。 */
  protected: boolean;
  /** 官方分组：不可重命名（输入框只读）。 */
  renameLocked: boolean;
}

/**
 * 框架把 inject 的 `hooks` 格绑成 uSES 选择器钩子：`(selector, isEqual?) => S`，
 * selector 必填（见 `CatalogFramework.tsx` 的同名说明）。
 */
export type SelectorHook<T> = <S>(select: (value: T) => S, isEqual?: (left: S, right: S) => boolean) => S;

/** 卡片从 inject 面收到的数据与回调。 */
export interface SettingsCardInjected {
  /** 行数据读取（选择器钩子）。 */
  useRows: SelectorHook<readonly SettingsRow[]>;
  /** 可选分组列表（不含「其他」；选择器钩子）。 */
  useGroups: SelectorHook<readonly SettingsGroupOption[]>;
  /** 改归属（null = 「其他」）。 */
  assign: (kind: string, groupId: string | null) => void;
  /** 改显示名（空串 = 恢复注册表标题）。 */
  setLabel: (kind: string, label: string) => void;
  /** 隐藏/显示。 */
  setHidden: (kind: string, hidden: boolean) => void;
  /** 移除该 kind 的规则（未登记条目清理）。 */
  forget: (kind: string) => void;
  /** 新建分组。 */
  addGroup: (title: string) => string;
  /** 重命名分组。 */
  renameGroup: (groupId: string, title: string) => void;
  /** 删除分组（组内条目落「其他」）。 */
  deleteGroup: (groupId: string) => void;
  /** 恢复出厂分类。 */
  resetCatalog: () => void;
  /** 持久化状态。 */
  persistence: () => 'pending' | 'host' | 'memory';
}

/** 卡片 props。 */
export type SettingsCardProps = SettingsCardInjected;

/**
 * 条目图标块里的一个字（与分类页一致的视觉语言）。
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
 * 卡片内的一个可折叠小节。
 * @param props - 标题、计数、默认展开态与内容。
 * @returns 小节元素。
 */
function SubSection(props: {
  title: string;
  count: number;
  defaultOpen: boolean;
  children: ReactNS.ReactNode;
}): ReactNS.ReactElement {
  const [open, setOpen] = useState(props.defaultOpen);
  return (
    <section className="hubSub">
      <button
        type="button"
        className="hubSubHead"
        aria-expanded={open}
        onClick={() => { setOpen(!open); }}
      >
        <span className="hubSubTitle">{props.title}</span>
        <span className="hubSubCount">{props.count}</span>
        <IconChevronDownOutlineRegular className={open ? 'hubChevron hubChevronOpen' : 'hubChevron'} />
      </button>
      {open ? <div className="hubSubBody">{props.children}</div> : null}
    </section>
  );
}

/**
 * 「右侧栏分类」卡片。
 * @param props - inject 面（行数据 + 全部写操作）。
 * @returns 与框架插件卡片同款的分类映射维护卡片。
 */
export function SettingsCard(props: SettingsCardProps): ReactNS.ReactElement {
  const {
    useRows, useGroups, assign, setLabel, setHidden, forget,
    addGroup, renameGroup, deleteGroup, resetCatalog, persistence,
  } = props;
  const rows = useRows(value => value);
  const groups = useGroups(value => value);

  /** 卡片是否展开（与框架插件卡片一致：默认收起）。 */
  const [open, setOpen] = useState(false);
  /** 显示名草稿（kind → 输入值）。 */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** 分组名草稿（groupId → 输入值）。 */
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  /** 新建分组的草稿名。 */
  const [newGroup, setNewGroup] = useState('');
  const memoryMode = persistence() !== 'host';
  const hiddenCount = rows.filter(row => row.hidden).length;
  const unregisteredCount = rows.filter(row => !row.registered).length;

  return (
    <li className={open ? 'hubCard hubCardOpen' : 'hubCard'}>
      <button
        type="button"
        className="hubCardHead"
        aria-expanded={open}
        aria-label={`${t(open ? 'settings.collapse' : 'settings.expand')}: ${t('settings.title')}`}
        onClick={() => { setOpen(!open); }}
      >
        <span className="hubCardHeadText">
          <span className="hubCardName">{t('settings.title')}</span>
          <span className="hubCardDesc">{t('settings.description')}</span>
        </span>
        {memoryMode && <span className="hubTag hubTagWarn">{t('catalog.memoryBadge')}</span>}
        {unregisteredCount > 0 && (
          <span className="hubTag">{t('settings.unregisteredCount').replace('{n}', String(unregisteredCount))}</span>
        )}
        <IconChevronDownOutlineRegular className={open ? 'hubChevron hubChevronOpen' : 'hubChevron'} />
      </button>

      {open && (
        <div className="hubCardBody">
          <p className="hubHint">{t('settings.hint')}</p>

          <SubSection title={t('settings.groups')} count={groups.length} defaultOpen>
            <div className="hubGroupList">
              {groups.map(group => (
                <span key={group.id} className="hubGroupChip" data-tone={toneOf(group.id)}>
                  <span className="hubGroupDot" aria-hidden="true" />
                  <input
                    className="hubGroupInput"
                    value={groupDrafts[group.id] ?? group.title}
                    readOnly={group.renameLocked}
                    title={group.renameLocked ? t('settings.renameLockedHint') : undefined}
                    onChange={(event) => { setGroupDrafts({ ...groupDrafts, [group.id]: event.target.value }); }}
                    onBlur={() => {
                      const next = groupDrafts[group.id];
                      if (next !== undefined && next.trim() !== '') renameGroup(group.id, next);
                    }}
                  />
                  <span className="hubGroupCount">
                    {rows.filter(row => row.groupId === group.id).length}
                  </span>
                  {!group.protected && (
                    <button
                      type="button"
                      className="hubIconBtn"
                      title={t('catalog.deleteGroup')}
                      onClick={() => {
                        if (window.confirm(t('catalog.confirmDelete').replace('{name}', group.title))) deleteGroup(group.id);
                      }}
                    >{'✕'}</button>
                  )}
                </span>
              ))}
            </div>
            <div className="hubRow">
              <input
                className="hubInput"
                placeholder={t('catalog.newGroup')}
                value={newGroup}
                onChange={(event) => { setNewGroup(event.target.value); }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || newGroup.trim() === '') return;
                  addGroup(newGroup);
                  setNewGroup('');
                }}
              />
              <button
                type="button"
                className="hubBtn"
                disabled={newGroup.trim() === ''}
                onClick={() => { addGroup(newGroup); setNewGroup(''); }}
              >＋ {t('catalog.addGroup')}</button>
            </div>
          </SubSection>

          <SubSection
            title={t('settings.entries')}
            count={rows.length}
            defaultOpen={false}
          >
            <table className="hubSettingsTable">
              <thead>
                <tr>
                  <th>{t('settings.colEntry')}</th>
                  <th>{t('settings.colGroup')}</th>
                  <th>{t('settings.colLabel')}</th>
                  <th>{t('settings.colHidden')}</th>
                  <th aria-label={t('settings.colActions')} />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.kind} data-kind={row.kind} data-unregistered={row.registered ? undefined : 'true'}>
                    <td className="hubKindCell">
                      <span className="hubKindMain">
                        <span className="hubKindTile" data-tone={toneOf(row.groupId ?? OTHER_GROUP_ID)} aria-hidden="true">
                          {tileGlyph(row.title)}
                        </span>
                        <span className="hubKindText">
                          <span className="hubKind">{row.title}</span>
                          <span className="hubKindId">{row.kind}</span>
                        </span>
                      </span>
                      {!row.registered && <span className="hubTag hubTagWarn">{t('settings.unregistered')}</span>}
                    </td>
                    <td>
                      <select
                        className="hubSelect"
                        value={row.groupId ?? OTHER_GROUP_ID}
                        onChange={(event) => {
                          const value = event.target.value;
                          assign(row.kind, value === OTHER_GROUP_ID ? null : value);
                        }}
                      >
                        {groups.map(group => <option key={group.id} value={group.id}>{group.title}</option>)}
                        <option value={OTHER_GROUP_ID}>{t('settings.otherGroup')}</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="hubInput"
                        placeholder={row.registered ? row.title : ''}
                        value={drafts[row.kind] ?? (row.title === row.kind ? '' : row.title)}
                        onChange={(event) => { setDrafts({ ...drafts, [row.kind]: event.target.value }); }}
                        onBlur={() => {
                          const next = drafts[row.kind];
                          if (next !== undefined) setLabel(row.kind, next);
                        }}
                      />
                    </td>
                    <td className="hubCheckCell">
                      <input
                        type="checkbox"
                        checked={row.hidden}
                        onChange={(event) => { setHidden(row.kind, event.target.checked); }}
                      />
                    </td>
                    <td className="hubActionCell">
                      <button
                        type="button"
                        className="hubBtn"
                        title={t('settings.forget')}
                        onClick={() => { forget(row.kind); }}
                      >{t('settings.forgetShort')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SubSection>

          <div className="hubCardFooter">
            {hiddenCount > 0 && (
              <span className="hubFooterNote">{t('settings.hiddenNote').replace('{n}', String(hiddenCount))}</span>
            )}
            <button type="button" className="hubBtn" onClick={resetCatalog}>{t('catalog.reset')}</button>
          </div>
        </div>
      )}
    </li>
  );
}
