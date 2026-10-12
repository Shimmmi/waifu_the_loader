import { useState } from 'react';
import {
  fatigueGain,
  fatiguePenalty,
  loadEconomy,
  prestigeMods,
  statBonusCap,
  statBonusTotal,
  trainingSeconds,
  trainingSpeed,
  type TrainingType,
} from '@wl/shared';
import { api } from '../api';
import { useText, useTicker } from '../hooks';
import { useT, type TKey } from '../i18n';
import { useStore } from '../store';
import { displayName, fmtDur, rarityStyle, WaifuCard } from '../components/ui';

function expectedChance(type: TrainingType, durationMin: number, fatigue: number): number {
  const t = loadEconomy().training;
  const base = Math.min(t.stat_chance_max, t.stat_chance_base + (t.stat_chance_per_hour * durationMin) / 60) * (type.stat_chance_mult ?? 1);
  const pen = fatiguePenalty(fatigue, loadEconomy());
  const great = t.great_chance;
  return Math.round((great + (1 - great) * base * (1 - pen)) * (1 - t.fail_chance - pen * 0.3) * 100);
}

export function Training() {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const notify = useStore((s) => s.notify);
  const setScreen = useStore((s) => s.setScreen);
  const busy = useStore((s) => s.busy);
  const t = useT();
  const text = useText();
  useTicker(1);
  const cfg = loadEconomy();
  const [pick, setPick] = useState<string | null>(null);
  const [typeId, setTypeId] = useState(cfg.training.types[0]!.id);
  const [dur, setDur] = useState(cfg.training.durations_min[1] ?? cfg.training.durations_min[0]!);

  const slots = state.limits.gymSlots;
  if (slots < 1)
    return (
      <div className="panel taped">
        <h2>🏋️ {t('tr.title')}</h2>
        <p>{t('tr.noGym')}</p>
        <button className="btn primary" onClick={() => setScreen('buildings')}>
          {t('tr.toBuildings')}
        </button>
      </div>
    );

  const byId = new Map(state.waifu.map((w) => [w.id, w]));
  const crew = state.waifu.filter((w) => w.zone === 'warehouse');
  const free = state.waifu.filter((w) => w.zone !== 'gym' && w.zone !== 'contract').sort((a, b) => a.fatigue - b.fatigue || b.power - a.power);
  const chosen = pick ? byId.get(pick) : undefined;
  const type = cfg.training.types.find((x) => x.id === typeId)!;
  const mods = prestigeMods(state.prestige.upgrades, state.prestige.sealsEarned, cfg);
  const now = Date.now();

  const claim = (id: string) =>
    run(async () => {
      const r = await api.trainingClaim(id);
      apply(r.state);
      notify(r.notice);
    });
  const start = () =>
    chosen &&
    run(async () => {
      apply(await api.trainingStart(chosen.id, typeId, dur));
      setPick(null);
    });

  const capLeft = chosen ? statBonusCap(chosen.rarity, cfg) - statBonusTotal(chosen.statBonus) : 0;
  const realSec = chosen ? trainingSeconds(dur, trainingSpeed(chosen, crew, state.buildings, cfg)) : dur * 60;

  return (
    <div>
      <div className="panel taped">
        <div className="row">
          <h2 style={{ margin: 0 }}>🏋️ {t('tr.title')}</h2>
          <span className="spacer" />
          <span className="tag">{t('tr.slots', { used: state.trainings.length, max: slots })}</span>
        </div>
        <h3>{t('tr.active')}</h3>
        {!state.trainings.length && <p className="muted small">{t('tr.none')}</p>}
        {state.trainings.map((j) => {
          const w = byId.get(j.instanceId);
          const end = Date.parse(j.endsAt);
          const startMs = Date.parse(j.startedAt);
          const ready = end <= now;
          const tt = cfg.training.types.find((x) => x.id === j.type);
          return (
            <div className="job" key={j.id} style={w ? rarityStyle(w.rarity) : undefined}>
              {w && <img src={w.thumbUrl} alt="" />}
              <div>
                <b>{w ? text(displayName(w)) : '—'}</b> · {tt?.icon} {tt?.name ?? j.type} · {fmtDur(j.durationMin * 60)}
                <div className="progress">
                  <i style={{ width: `${Math.min(100, ((now - startMs) / Math.max(1, end - startMs)) * 100)}%` }} />
                </div>
                {!ready && <span className="small muted">{t('tr.left', { t: fmtDur((end - now) / 1000) })}</span>}
              </div>
              <button className="btn primary" disabled={!ready || busy} onClick={() => claim(j.id)}>
                {t('tr.claim')}
              </button>
            </div>
          );
        })}
      </div>

      {state.trainings.length < slots && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>{t('tr.new')}</h3>
          <h4>{t('tr.pickWaifu')}</h4>
          {!free.length && <p className="muted small">{t('tr.free')}</p>}
          <div className="pick-grid">
            {free.map((w) => (
              <WaifuCard key={w.id} w={w} picked={pick === w.id} onClick={() => setPick(w.id)} />
            ))}
          </div>

          <h4>{t('tr.pickType')}</h4>
          <div className="opt-grid">
            {cfg.training.types.map((x) => (
              <button key={x.id} className={`opt ${typeId === x.id ? 'on' : ''}`} onClick={() => setTypeId(x.id)}>
                <b>
                  {x.icon} {x.name}
                </b>
                <div className="small muted">{text(x.description)}</div>
                <div className="small">{x.stats.map((s) => t(`stat.${s}` as TKey)).join(', ')}</div>
              </button>
            ))}
          </div>

          <h4>{t('tr.pickDuration')}</h4>
          <div className="seg">
            {cfg.training.durations_min.map((d) => (
              <button key={d} className={dur === d ? 'on' : ''} onClick={() => setDur(d)}>
                {fmtDur(d * 60)}
              </button>
            ))}
          </div>

          {chosen && (
            <div className="panel" style={{ marginTop: 12 }}>
              <div className="small">
                <b>{text(displayName(chosen))}</b> · {t('tr.real', { t: fmtDur(realSec) })}
              </div>
              <div className="small">
                {t('tr.expect', {
                  xp: Math.floor(cfg.training.xp_per_min * dur * type.xp_mult * mods.xpMult),
                  chance: capLeft > 0 ? expectedChance(type, dur, chosen.fatigue) : 0,
                  fatigue: Math.round(fatigueGain('training', dur, state.buildings, cfg)),
                })}
              </div>
              {capLeft <= 0 && <div className="small muted">{t('tr.capped')}</div>}
            </div>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary big" disabled={!chosen || busy} onClick={start}>
              {t('tr.start')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
