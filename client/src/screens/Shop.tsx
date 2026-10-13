import { inShop, loadMeta, type CosmeticDef } from '@wl/shared';
import { api } from '../api';
import { useT } from '../i18n';
import { useStore } from '../store';

const KIND: Record<CosmeticDef['kind'], 'sh.kind.frame' | 'sh.kind.warehouse' | 'sh.kind.summon' | 'sh.kind.card' | 'sh.kind.title'> = {
  frame: 'sh.kind.frame',
  warehouse: 'sh.kind.warehouse',
  summon: 'sh.kind.summon',
  card: 'sh.kind.card',
  title: 'sh.kind.title',
};

export function Shop() {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const busy = useStore((s) => s.busy);
  const t = useT();
  const meta = loadMeta();
  const owned = new Set(state.meta.owned);
  const loadout = state.meta.loadout;

  const act = (fn: () => Promise<typeof state>) => run(async () => apply(await fn()));
  const equipped = (item: CosmeticDef) => loadout[item.kind] === item.id;

  return (
    <div>
      <p className="muted">{t('sh.blurb', { n: state.resources.tokens })}</p>
      <div className="tree">
        {meta.cosmetics.map((item) => {
          const have = owned.has(item.id);
          const onSale = inShop(item);
          return (
            <div key={item.id} className={`node ${have ? 'maxed' : ''}`}>
              <b>{item.name}</b>
              <span className="small muted">{t(KIND[item.kind])} · {item.description}</span>
              {have ? (
                <button className="btn small" disabled={busy} onClick={() => act(() => api.equipCosmetic(item.kind, equipped(item) ? null : item.id))}>
                  {equipped(item) ? t('sh.off') : t('sh.equip')}
                </button>
              ) : onSale ? (
                <button className="btn small primary" disabled={busy || state.resources.tokens < item.price} onClick={() => act(() => api.buyCosmetic(item.id))}>
                  {t('sh.buy')} · {item.price}
                </button>
              ) : (
                <span className="small muted">{item.unlock === 'shop' ? t('sh.soon') : t('sh.grant')}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
