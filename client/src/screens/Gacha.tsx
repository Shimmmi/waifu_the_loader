import { useEffect, useMemo, useState } from 'react';
import {
  baseRates,
  effectiveRates,
  formatDuration,
  loadContent,
  loadEconomy,
  loadGacha,
  rarityIndex,
  RARITIES,
  type BannerDTO,
  type GachaHistoryItemDTO,
  type PullItemDTO,
  type Rarity,
} from '@wl/shared';
import { api } from '../api';
import { playCue } from '../sound';
import { useFlavor, useText } from '../hooks';
import { ruPlural, useT } from '../i18n';
import { useStore } from '../store';
import { displayName, rarityName, rarityStyle, WaifuCard } from '../components/ui';

const GLOW: Record<Rarity, string> = { N: '#cfd3d6', R: '#4fa3ff', SR: '#b06cff', SSR: '#ffb020', UR: '#ff4d6d' };

function PullStage({ items, onClose }: { items: PullItemDTO[]; onClose: () => void }) {
  const t = useT();
  const text = useText();
  const flavor = useFlavor();
  const skipAnim = useStore((s) => s.settings.skipGachaAnim);
  const sound = useStore((s) => s.settings.sound);
  const lang = useStore((s) => s.settings.lang);
  const best = items.reduce<Rarity>((m, i) => (rarityIndex(i.rarity) > rarityIndex(m) ? i.rarity : m), 'N');
  const epic = best === 'SSR' || best === 'UR';
  const [phase, setPhase] = useState<'box' | 'open' | 'done'>(skipAnim ? 'done' : 'box');
  const content = loadContent();
  const caption = useMemo(() => {
    const top = items.find((i) => i.rarity === best);
    if (top?.duplicate) return flavor(content.flavor.gacha_duplicate, { name: displayName(top.waifu), shards: String(top.shards) });
    return flavor(content.flavor.gacha_reveal[best] ?? [], { name: top ? displayName(top.waifu) : '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    if (sound) playCue(epic ? 'rare' : 'tick');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- один раз на вскрытие
  }, []);

  useEffect(() => {
    if (phase === 'box') {
      const h = setTimeout(() => setPhase('open'), epic ? 2600 : 1200);
      return () => clearTimeout(h);
    }
    if (phase === 'open') {
      const h = setTimeout(() => setPhase('done'), 350);
      return () => clearTimeout(h);
    }
  }, [phase, epic]);

  return (
    <div className={`pull-stage ${phase !== 'done' && epic ? `glow-${best}` : ''}`} onClick={() => phase !== 'done' && setPhase('done')}>
      {phase !== 'done' ? (
        <>
          <div className={`pull-box ${phase === 'open' ? 'open' : ''}`} style={{ ['--glow' as string]: GLOW[best] }}>
            📦
          </div>
          <div className="pull-caption">{epic ? t('g.heavy') : t('g.opening')}</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => setPhase('done')}>
            {t('g.skip')} ⏭
          </button>
        </>
      ) : (
        <>
          <div className={`pull-results ${items.length === 1 ? 'single' : ''}`}>
            {items.map((i, idx) => (
              <div key={idx} style={{ position: 'relative', animationDelay: `${idx * 0.07}s` }}>
                <WaifuCard
                  w={i.waifu}
                  showDuty={false}
                  badge={
                    <>
                      {!i.duplicate && <span className="newtag">{t('g.new')}</span>}
                      {i.duplicate && (
                        <span className="dupe">
                          {t('g.duplicate', {
                            n: i.shards,
                            shardWord: lang === 'en' ? t(i.shards === 1 ? 'g.shardOne' : 'g.shardMany') : ruPlural(i.shards, t('g.shardOne'), t('g.shardFew'), t('g.shardMany')),
                          })}
                        </span>
                      )}
                    </>
                  }
                />
              </div>
            ))}
          </div>
          <div className="pull-caption" style={{ fontSize: 20 }}>
            {text(caption)}
          </div>
          <button className="btn primary big" style={{ marginTop: 16 }} onClick={onClose}>
            {t('g.close')}
          </button>
        </>
      )}
    </div>
  );
}

let ratesCache: { base: Record<Rarity, number>; eff: Record<Rarity, number> } | null = null;
function getRates() {
  if (!ratesCache) {
    const base = baseRates(loadEconomy());
    ratesCache = { base, eff: effectiveRates(base, loadGacha()) };
  }
  return ratesCache;
}

function Rates() {
  const t = useT();
  const g = loadGacha();
  const { base, eff } = getRates();
  return (
    <div className="panel">
      <h3>{t('g.rates')}</h3>
      <table className="rates">
        <thead>
          <tr>
            <th />
            <th>{t('g.base')}</th>
            <th>{t('g.effective')}</th>
          </tr>
        </thead>
        <tbody>
          {[...RARITIES].reverse().map((r) => (
            <tr key={r} style={rarityStyle(r)}>
              <td>
                <span className="tag rc">{r}</span> {rarityName(r)}
              </td>
              <td>{(base[r] * 100).toFixed(1)}%</td>
              <td>{(eff[r] * 100).toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">
        {t('g.ratesNote', { soft: g.soft_pity_start, step: g.soft_pity_step * 100, hard: g.hard_pity, sr: g.sr_guarantee_every })}
      </p>
    </div>
  );
}

function History() {
  const t = useT();
  const [items, setItems] = useState<GachaHistoryItemDTO[] | null>(null);
  const state = useStore((s) => s.state);
  useEffect(() => {
    api.history().then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [state?.resources.tickets]);
  const g = loadGacha();
  return (
    <div className="panel">
      <h3>{t('g.history')}</h3>
      {!items?.length && <p className="muted small">—</p>}
      {items?.slice(0, 20).map((h, i) => (
        <div key={i} className="small" style={{ borderBottom: '1px dashed var(--line)', padding: '6px 0' }}>
          <span className="muted">
            {new Date(h.createdAt).toLocaleString()} · {g.banners.find((b) => b.id === h.bannerId)?.name ?? h.bannerId}
          </span>
          <div className="row" style={{ gap: 4, marginTop: 3 }}>
            {h.items.map((x, j) => (
              <span key={j} className="tag rc" style={{ ...rarityStyle(x.rarity), opacity: x.duplicate ? 0.55 : 1 }} title={`${x.name}${x.duplicate ? ' (дубль)' : ''}`}>
                {x.rarity}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function timeLeft(b: BannerDTO): string | null {
  if (!b.ends_at) return null;
  return formatDuration((new Date(b.ends_at).getTime() - Date.now()) / 1000);
}

export function Gacha() {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const busy = useStore((s) => s.busy);
  const t = useT();
  const text = useText();
  const visible = state.banners.filter((b) => b.active || b.type !== 'newbie');
  const [sel, setSel] = useState<string>(() => visible.find((b) => b.type === 'newbie' && b.active)?.id ?? 'standard');
  const [result, setResult] = useState<PullItemDTO[] | null>(null);
  const banner = state.banners.find((b) => b.id === sel) ?? visible[0];
  const g = loadGacha();
  if (!banner) return null;

  const doPull = (count: number) =>
    run(async () => {
      const r = await api.pull(banner.id, count, crypto.randomUUID());
      setResult(r.items);
      apply(r.state);
    });

  const tickets = state.resources.tickets;
  return (
    <>
      <div className="banners">
        {visible.map((b) => (
          <button key={b.id} className={`banner-tab ${b.id === banner.id ? 'on' : ''}`} onClick={() => setSel(b.id)}>
            {b.name}
            <span className="t">{b.type === 'event' ? `⏳ ${timeLeft(b) ?? ''}` : b.type === 'newbie' ? '🎁' : '∞'}</span>
          </button>
        ))}
      </div>

      <div className={`banner-hero ${banner.type}`} style={{ marginTop: 10 }}>
        <h2>{banner.name}</h2>
        <p>{text(banner.description)}</p>
        {banner.featured_archetype && (
          <p className="small">
            ⭐ {loadContent().archetypes.find((a) => a.id === banner.featured_archetype)?.name} — {Math.round(banner.featured_share * 100)}% SSR+
          </p>
        )}
        <div className="big-box">📦</div>
        <div className="row" style={{ marginTop: 16, position: 'relative' }}>
          {banner.pull_sizes.map((n) => {
            const cost = banner.cost_per_pull * n;
            return (
              <button key={n} className="btn primary big" disabled={!banner.active || busy || tickets < cost} onClick={() => doPull(n)}>
                {n === 1 ? t('g.pull1') : t('g.pull10')} · {cost === 0 ? t('g.free') : `🎟 ${cost}`}
              </button>
            );
          })}
          {!banner.active && <span className="tag">{banner.type === 'newbie' ? t('g.used') : t('g.closed')}</span>}
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div>
          <div className="panel">
            <div className="pitybar">
              <span>{t('g.toSsr')}</span>
              <span className="progress">
                <i style={{ width: `${(banner.pity.sinceSsr / g.hard_pity) * 100}%` }} />
              </span>
              <b>
                {banner.pity.sinceSsr}/{g.hard_pity}
              </b>
              <span>{t('g.toSr')}</span>
              <span className="progress">
                <i style={{ width: `${(banner.pity.sinceSr / g.sr_guarantee_every) * 100}%` }} />
              </span>
              <b>
                {banner.pity.sinceSr}/{g.sr_guarantee_every}
              </b>
            </div>
          </div>
          <Rates />
        </div>
        <History />
      </div>

      {result && (
        <PullStage
          items={result}
          onClose={() => {
            setResult(null);
            if (!banner.active) setSel('standard');
          }}
        />
      )}
    </>
  );
}
