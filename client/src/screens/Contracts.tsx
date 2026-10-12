import { useState } from 'react';
import { contractChance, loadContent, loadEconomy, type ContractDTO, type ContractTag, type StatKey } from '@wl/shared';
import { api } from '../api';
import { useFmt, useText, useTicker } from '../hooks';
import { useT, type TKey } from '../i18n';
import { useStore } from '../store';
import { displayName, fmtDur, Modal, rarityStyle, WaifuCard } from '../components/ui';

const TAG_ICON: Record<string, string> = { piano: '🎹', fridge: '🧊', office: '🗄️', safe: '🔐', fragile: '🍷', weird: '🦑', boxes: '📦' };

function TeamPicker({ c, onClose }: { c: ContractDTO; onClose: () => void }) {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const busy = useStore((s) => s.busy);
  const t = useT();
  const fmt = useFmt();
  const cfg = loadEconomy();
  const [team, setTeam] = useState<string[]>([]);
  const free = state.waifu.filter((w) => w.zone !== 'gym' && w.zone !== 'contract').sort((a, b) => b.power - a.power);
  const members = team.map((id) => state.waifu.find((w) => w.id === id)!).filter(Boolean);
  const chance = contractChance(members, { requiredPower: c.requiredPower, stat: c.stat as StatKey, tag: c.tag as ContractTag }, cfg);
  const power = members.reduce((s, w) => s + w.power, 0);
  const max = cfg.contracts.team_max;
  const toggle = (id: string) => setTeam((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length < max ? [...x, id] : x));
  const send = () =>
    run(async () => {
      apply(await api.contractStart(c.id, team));
      onClose();
    });

  return (
    <Modal onClose={onClose} wide title={t('ct.team', { n: max })}>
      <div className="row">
        <span className="tag">{t('ct.need', { p: fmt(c.requiredPower) })}</span>
        <span className="tag">{t('ct.teamPower', { p: fmt(power) })}</span>
        <span className="tag">{t('ct.keyStat', { s: t(`stat.${c.stat}` as TKey) })}</span>
        <b>{t('ct.chance', { p: team.length ? Math.round(chance * 100) : 0 })}</b>
        <span className="spacer" />
        <button className="btn primary" disabled={!team.length || busy} onClick={send}>
          {t('ct.send')}
        </button>
      </div>
      <div className="pick-grid" style={{ marginTop: 12 }}>
        {free.map((w) => (
          <WaifuCard key={w.id} w={w} picked={team.includes(w.id)} onClick={() => toggle(w.id)} />
        ))}
      </div>
    </Modal>
  );
}

export function Contracts() {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const notify = useStore((s) => s.notify);
  const setScreen = useStore((s) => s.setScreen);
  const busy = useStore((s) => s.busy);
  const t = useT();
  const fmt = useFmt();
  const text = useText();
  useTicker(1);
  const [picking, setPicking] = useState<ContractDTO | null>(null);
  const content = loadContent().contracts;

  const slots = state.limits.contractSlots;
  if (slots < 1)
    return (
      <div className="panel taped">
        <h2>📞 {t('ct.title')}</h2>
        <p>{t('ct.noDispatch')}</p>
        <button className="btn primary" onClick={() => setScreen('buildings')}>
          {t('tr.toBuildings')}
        </button>
      </div>
    );

  const now = Date.now();
  const offers = state.contracts.filter((c) => c.status === 'offer');
  const active = state.contracts.filter((c) => c.status === 'active');
  const byId = new Map(state.waifu.map((w) => [w.id, w]));
  const client = (id: string) => content.clients.find((x) => x.id === id);
  const cargo = (id: string) => content.cargo.find((x) => x.id === id);

  const claim = (id: string) =>
    run(async () => {
      const r = await api.contractClaim(id);
      apply(r.state);
      notify(r.notice);
    });

  return (
    <div>
      <div className="panel taped">
        <div className="row">
          <h2 style={{ margin: 0 }}>📞 {t('ct.title')}</h2>
          <span className="spacer" />
          <span className="tag">{t('ct.slots', { used: active.length, max: slots })}</span>
        </div>
        <h3>{t('ct.active')}</h3>
        {!active.length && <p className="muted small">{t('ct.none')}</p>}
        {active.map((c) => {
          const end = c.endsAt ? Date.parse(c.endsAt) : now;
          const st = c.startedAt ? Date.parse(c.startedAt) : now;
          const ready = end <= now;
          return (
            <div className="job" key={c.id}>
              <div className="bicon">{TAG_ICON[c.tag] ?? '📦'}</div>
              <div>
                <b>{text(cargo(c.cargoId)?.name ?? c.cargoId)}</b> · {text(client(c.clientId)?.name ?? c.clientId)}
                <div className="thumbs">
                  {c.team.map((id) => {
                    const w = byId.get(id);
                    return w ? <img key={id} src={w.thumbUrl} alt={displayName(w)} title={displayName(w)} style={rarityStyle(w.rarity)} /> : null;
                  })}
                </div>
                <div className="progress">
                  <i style={{ width: `${Math.min(100, ((now - st) / Math.max(1, end - st)) * 100)}%` }} />
                </div>
                <span className="small muted">
                  {t('ct.chance', { p: Math.round((c.successChance ?? 0) * 100) })}
                  {!ready && ` · ${t('ct.left', { t: fmtDur((end - now) / 1000) })}`}
                </span>
              </div>
              <button className="btn primary" disabled={!ready || busy} onClick={() => claim(c.id)}>
                {t('ct.claim')}
              </button>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>{t('ct.board')}</h3>
        {!offers.length && <p className="muted small">{t('ct.none')}</p>}
        <div className="grid2">
          {offers.map((c) => {
            const cg = cargo(c.cargoId);
            const cl = client(c.clientId);
            return (
              <div className="panel offer" key={c.id}>
                <h3>
                  {TAG_ICON[c.tag] ?? '📦'} {text(cg?.name ?? c.cargoId)}
                </h3>
                <div className="small muted">{text(cg?.blurb ?? '')}</div>
                <div className="small" style={{ marginTop: 6 }}>
                  <b>{text(cl?.name ?? c.clientId)}</b> — {text(cl?.blurb ?? '')}
                </div>
                <div className="row" style={{ marginTop: 6 }}>
                  <span className="tag">⏱ {fmtDur(c.durationMin * 60)}</span>
                  <span className="tag">💪 {t('ct.need', { p: fmt(c.requiredPower) })}</span>
                  <span className="tag">{t('ct.keyStat', { s: t(`stat.${c.stat}` as TKey) })}</span>
                </div>
                <div className="row" style={{ marginTop: 6 }}>
                  <span className="reward">
                    {t('ct.reward')}: 🪙 {fmt(c.rewardCoins)}
                    {c.rewardProtein !== '0' && ` · 🥤 ${fmt(c.rewardProtein)}`}
                  </span>
                  {c.ticketChance > 0 && <span className="small muted">🎟 {t('ct.ticket', { p: Math.round(c.ticketChance * 100) })}</span>}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn primary" disabled={busy || active.length >= slots} onClick={() => setPicking(c)}>
                    {t('ct.take')}
                  </button>
                  <button className="btn small" disabled={busy} onClick={() => run(async () => apply(await api.contractDismiss(c.id)))}>
                    {t('ct.dismiss')}
                  </button>
                  <span className="spacer" />
                  <span className="small muted">{t('ct.expires', { t: fmtDur((Date.parse(c.expiresAt) - now) / 1000) })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {picking && <TeamPicker c={picking} onClose={() => setPicking(null)} />}
    </div>
  );
}
