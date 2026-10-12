import { useState } from 'react';
import { loadContent, loadEconomy, rarityIndex, RARITIES, type Rarity } from '@wl/shared';
import { useT } from '../i18n';
import { useStore } from '../store';
import { WaifuCard } from '../components/ui';
import { WaifuDetail } from '../components/WaifuDetail';

type Sort = 'power' | 'level' | 'new' | 'rarity';

export function Collection() {
  const state = useStore((s) => s.state)!;
  const t = useT();
  const [rar, setRar] = useState<Rarity | 'all'>('all');
  const [arch, setArch] = useState<string>('all');
  const [sort, setSort] = useState<Sort>('power');
  const [open, setOpen] = useState<string | null>(null);
  const content = loadContent();
  const cfg = loadEconomy();

  const list = state.waifu
    .filter((w) => (rar === 'all' || w.rarity === rar) && (arch === 'all' || w.archetype === arch))
    .sort((a, b) => {
      if (sort === 'power') return b.power - a.power;
      if (sort === 'level') return b.level - a.level;
      if (sort === 'rarity') return rarityIndex(b.rarity) - rarityIndex(a.rarity) || b.power - a.power;
      return b.obtainedAt.localeCompare(a.obtainedAt);
    });

  return (
    <>
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="row">
          <div className="seg">
            <button className={rar === 'all' ? 'on' : ''} onClick={() => setRar('all')}>
              {t('c.filterAll')}
            </button>
            {RARITIES.map((r) => (
              <button key={r} className={rar === r ? 'on' : ''} onClick={() => setRar(r)}>
                {r}
              </button>
            ))}
          </div>
          <select className="input" style={{ width: 'auto' }} value={arch} onChange={(e) => setArch(e.target.value)}>
            <option value="all">{t('c.filterAll')}</option>
            {content.archetypes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="power">{t('c.sortPower')}</option>
            <option value="level">{t('c.sortLevel')}</option>
            <option value="rarity">{t('c.sortRarity')}</option>
            <option value="new">{t('c.sortNew')}</option>
          </select>
          <span className="spacer" />
          <span className="small muted">{t('c.count', { n: state.waifu.length, max: content.archetypes.length * cfg.rarities.length })}</span>
        </div>
      </div>
      {list.length ? (
        <div className="cards">
          {list.map((w) => (
            <WaifuCard key={w.id} w={w} onClick={() => setOpen(w.id)} />
          ))}
        </div>
      ) : (
        <p className="muted">{t('c.empty')}</p>
      )}
      {open && <WaifuDetail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
