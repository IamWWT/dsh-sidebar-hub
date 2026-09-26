import { useEffect, useState } from 'react';
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives';
import { t } from '../locales.ts';

export interface TerminalChoices {
  shells: readonly { path: string; name: string }[];
  selectedShell?: string;
}
export interface TerminalLaunchActions {
  load: (signal: AbortSignal) => Promise<TerminalChoices>;
  launch: (path?: string) => void;
}

/** Hub owns only the launcher; discovery, preference and all terminal tabs belong to DSH. */
export function TerminalLauncher({ title, actions }: { title: string; actions: TerminalLaunchActions }) {
  const [visible, setVisible] = useState(false);
  const [choices, setChoices] = useState<TerminalChoices | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setChoices(null);
    setFailure(null);
    actions.load(controller.signal).then(value => {
      if (!controller.signal.aborted) setChoices(value);
    }, error => {
      if (!controller.signal.aborted) setFailure(String(error));
    });
    return () => controller.abort();
  }, [visible, attempt, actions]);
  const items = failure !== null
    ? [{ id: '$error', label: failure, disabled: true }, { id: '$retry', label: t('terminal.retry') }]
    : choices === null ? [{ id: '$loading', label: t('terminal.loading'), disabled: true }]
      : choices.shells.length === 0 ? [{ id: '$empty', label: t('terminal.empty'), disabled: true }]
        : choices.shells.map(shell => ({ id: shell.path, label: shell.name }));
  return <div className="catalogTerminal">
    <button type="button" className="catalogItem" data-kind="terminal" data-official="true" onClick={() => actions.launch()}>
      <span className="catalogItemTile" aria-hidden="true">›_</span>
      <span className="catalogItemLabel">{title}</span>
      <span className="catalogItemOfficial">{t('catalog.official')}</span>
    </button>
    <Menu open={visible} portal autoFocus align="end" items={items} selectedId={choices?.selectedShell}
      onClose={() => setVisible(false)} onSelect={path => {
        if (path === '$retry') { setAttempt(value => value + 1); return; }
        actions.launch(path);
        setVisible(false);
      }} anchor={<button type="button" className="catalogBtn" aria-label={t('terminal.choose')}
        aria-haspopup="menu" aria-expanded={visible} onClick={() => setVisible(value => !value)}>▾</button>} />
  </div>;
}
