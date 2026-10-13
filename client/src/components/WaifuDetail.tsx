import { useState } from 'react';
import {
  archetypeById,
  levelCap,
  loadContent,
  loadEconomy,
  loadMeta,
  starCost,
  STATS,
  talentActive,
  waifuLevelCost,
  type Talent,
} from '@wl/shared';
import { api } from '../api';
import { useFlavor, useFmt, useLive, useText } from '../hooks';
import { useT, type TKey } from '../i18n';
import { useStore } from '../store';
import { Cost, displayName, Modal, rarityName, rarityStyle, Stars } from './ui';

/** Таланты тренировок и контрактов работают вне склада */
const M4_EFFECTS = new Set(['contract_bonus', 'training_speed']);

function TalentRow({ t: tal, active }: { t: Talent; active: boolean }) {
  const t = useT();
  const text = useText();
  const on = active || M4_EFFECTS.has(tal.effect_type);
  return (
    <div className={`talent ${on ? '' : 'off'}`}>
      <b>{text(tal.name)}</b>
      <span className="small">{text(tal.description)}</span>
      {!on && <div className="small muted">({t('w.inactive')})</div>}
    </div>
  );
}

export function WaifuDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const toast = useStore((s) => s.toast);
  const busy = useStore((s) => s.busy);
  const t = useT();
  const fmt = useFmt();
  const text = useText();
  const flavor = useFlavor();
  const live = useLive();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const w = state.waifu.find((x) => x.id === id);
  if (!w) return null;
  const cfg = loadEconomy();
  const content = loadContent();
  const arch = archetypeById(content, w.archetype);
  const cap = levelCap(w.stars, cfg);
  const cost = waifuLevelCost(w.rarity, w.level, cfg);
  const sCost = starCost(w.rarity, w.stars, cfg);
  const crew = state.waifu.filter((x) => x.zone === 'warehouse');
  const canLevel = live && w.level < cap && live.coins.gte(cost.coins) && live.protein.gte(cost.protein);
  const maxStat = Math.max(...STATS.map((k) => w.stats[k]));
  const name = displayName(w);

  const act = (fn: () => Promise<typeof state>, okText?: string) =>
    run(async () => {
      apply(await fn());
      if (okText) toast(okText, 'success');
    });

  return (
    <Modal onClose={onClose} wide title={<span style={rarityStyle(w.rarity)}>{text(name)}</span>}>
      <div className="detail" style={rarityStyle(w.rarity)}>
        <div>
          <img className="portrait" src={w.portraitUrl} alt={name} />
          <div className="row" style={{ marginTop: 8, justifyContent: 'center' }}>
            <span className="tag rc">
              {w.rarity} · {rarityName(w.rarity)}
            </span>
            <Stars n={w.stars} />
          </div>
        </div>
        <div>
          <div className="row">
            <span className="tag">{arch?.name ?? w.archetype}</span>
            <span className="tag">
              {t('w.age')}: {w.age}
            </span>
            <span className="tag">💪 {fmt(w.power)}</span>
          </div>
          <p className="quote">«{text(w.quote)}»</p>
          <p>{text(w.bio)}</p>

          <h3>{t('w.stats')}</h3>
          {STATS.map((k) => (
            <div className="statbar" key={k}>
              <span>{t(`stat.${k}` as TKey)}</span>
              <span className="bar">
                <i style={{ width: `${(w.stats[k] / maxStat) * 100}%` }} />
              </span>
              <b title={w.statBonus[k] ? t('w.bonusHint', { n: w.statBonus[k] ?? 0 }) : undefined}>
                {w.stats[k]}
                {!!w.statBonus[k] && <small className="ok"> +{w.statBonus[k]}</small>}
              </b>
            </div>
          ))}
          <div className="statbar">
            <span>{t('w.fatigue')}</span>
            <span className="bar fatigue">
              <i style={{ width: `${Math.min(100, w.fatigue)}%` }} />
            </span>
            <b>{w.fatigue}</b>
          </div>
          {w.xpNeed > 0 && (
            <div className="statbar">
              <span>{t('w.xp')}</span>
              <span className="bar">
                <i style={{ width: `${Math.min(100, (w.xp / w.xpNeed) * 100)}%` }} />
              </span>
              <b className="small">
                {w.xp}/{w.xpNeed}
              </b>
            </div>
          )}

          <h3 style={{ marginTop: 12 }}>{t('w.talents')}</h3>
          {w.talents.map((tal) => (
            <TalentRow key={tal.id} t={tal} active={w.zone === 'warehouse' && talentActive(tal, crew)} />
          ))}

          <div className="panel" style={{ marginTop: 12 }}>
            <div className="row">
              <b>
                {t('w.level')} {w.level}/{cap}
              </b>
              <span className="spacer" />
              {w.level < cap ? (
                <>
                  <Cost coins={cost.coins.toString()} protein={cost.protein.toString()} okCoins={!!live?.coins.gte(cost.coins)} okProtein={!!live?.protein.gte(cost.protein)} />
                  <button className="btn primary small" disabled={!canLevel || busy} onClick={() => act(() => api.levelUp(w.id, 1), flavor(content.flavor.level_up, { name }))}>
                    {t('w.levelUp')} +1
                  </button>
                  <button className="btn small" disabled={!canLevel || busy} onClick={() => act(() => api.levelUp(w.id, 10))}>
                    +10
                  </button>
                </>
              ) : (
                <span className="small muted">{t('w.cap')}</span>
              )}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <b>
                {t('w.stars')} <Stars n={w.stars} />
              </b>
              <span className="spacer" />
              {sCost !== null && (
                <>
                  <span className="small" style={{ color: state.resources.shards >= sCost ? undefined : 'var(--danger)' }}>
                    💠 {state.resources.shards}/{sCost}
                  </span>
                  <button
                    className="btn small"
                    disabled={state.resources.shards < sCost || busy}
                    onClick={() => act(() => api.starUp(w.id), flavor(content.flavor.star_up, { name }))}
                  >
                    ⭐ {t('w.starUp')}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            {w.zone === 'gym' || w.zone === 'contract' ? (
              <span className="tag">{t(w.zone === 'gym' ? 'w.busyGym' : 'w.busyContract')}</span>
            ) : (
              <>
                {w.zone === 'warehouse' ? (
                  <button className="btn" disabled={busy} onClick={() => act(() => api.assign(w.id, null))}>
                    {t('w.fromBrigade')}
                  </button>
                ) : (
                  <button className="btn primary" disabled={busy || crew.length >= state.slots} onClick={() => act(() => api.assign(w.id, 'warehouse'))}>
                    📦 {t('w.toBrigade')} ({crew.length}/{state.slots})
                  </button>
                )}
                {w.zone === 'clerk' ? (
                  <button className="btn" disabled={busy} onClick={() => act(() => api.assign(w.id, null))}>
                    {t('w.fromClerk')}
                  </button>
                ) : (
                  <button className="btn" disabled={busy} onClick={() => act(() => api.assign(w.id, 'clerk'))}>
                    🗄️ {t('w.toClerk')}
                  </button>
                )}
              </>
            )}
            <span className="spacer" />
            {state.meta.regen[w.id] === 'pending' ? (
              <span className="tag">{t('w.regenPending')}</span>
            ) : state.meta.regen[w.id] === 'done' ? (
              <span className="tag">{t('w.regenDone')}</span>
            ) : (
              <button className="btn small" disabled={busy || state.resources.tokens < loadMeta().regenTokens} onClick={() => act(() => api.regenPortrait(w.id))}>
                {t('w.regen', { n: loadMeta().regenTokens })}
              </button>
            )}
            {renaming ? (
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(() => api.rename(w.id, newName || null)).then(() => setRenaming(false));
                }}
              >
                <input className="input" style={{ width: 200 }} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} placeholder={w.name} autoFocus />
                <button className="btn small primary">{t('p.save')}</button>
              </form>
            ) : (
              <button className="btn small" onClick={() => (setNewName(w.customName ?? ''), setRenaming(true))}>
                ✏️ {t('w.rename')}
              </button>
            )}
          </div>
          <p className="small muted">{text(w.appearance)}</p>
        </div>
      </div>
    </Modal>
  );
}
