import { loadMeta } from '@wl/shared';
import { api } from '../api';
import { useT } from '../i18n';
import { useStore } from '../store';
import { Modal } from './ui';

export function MiniEvent() {
  const mini = useStore((s) => s.state?.meta.mini);
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const busy = useStore((s) => s.busy);
  const t = useT();
  if (!mini) return null;
  const tpl = loadMeta().minis.find((m) => m.id === mini.templateId);
  if (!tpl) return null;
  return (
    <Modal title={t('ev.mini')} onClose={() => undefined}>
      <p>{tpl.text}</p>
      <div className="row">
        {tpl.choices.map((c, i) => (
          <button key={c.text} className="btn primary" disabled={busy} onClick={() => run(async () => apply(await api.resolveMini(mini.id, i)))}>
            {c.text}
          </button>
        ))}
      </div>
    </Modal>
  );
}
