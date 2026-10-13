import { inShop, loadMeta, type CosmeticDef } from '@wl/shared';
import { api } from '../api';
import { useT } from '../i18n';
import { useStore } from '../store';

const KIND: Record<CosmeticDef['kind'], string> = {
  frame: 'Рамка',
  warehouse: 'Склад',
  summon: 'Призыв',
  card: 'Карточка',
  title: 'Титул',
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
      <p className="muted">Жетоны: {state.resources.tokens}. Монеты и билеты на мерч не меняются.</p>
      <div className="tree">
        {meta.cosmetics.map((item) => {
          const have = owned.has(item.id);
          const onSale = inShop(item);
          return (
            <div key={item.id} className={`node ${have ? 'maxed' : ''}`}>
              <b>{item.name}</b>
              <span className="small muted">{KIND[item.kind]} · {item.description}</span>
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
