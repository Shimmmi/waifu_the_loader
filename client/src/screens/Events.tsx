import { activeEvent, D, loadMeta } from '@wl/shared';
import { api } from '../api';
import { useFmt } from '../hooks';
import { useT } from '../i18n';
import { useStore } from '../store';

export function Events() {
  const state = useStore((s) => s.state)!;
  const run = useStore((s) => s.run);
  const apply = useStore((s) => s.apply);
  const busy = useStore((s) => s.busy);
  const t = useT();
  const fmt = useFmt();
  const meta = loadMeta();
  const ev = activeEvent(meta.events);
  const prog = state.meta;

  return (
    <div>
      <div className="panel taped">
        <h2 style={{ marginTop: 0 }}>{ev ? ev.name : t('nav.events')}</h2>
        {ev ? (
          <>
            <p>{ev.description}</p>
            <b>{t('ev.score', { n: prog.event?.score ?? 0 })}</b>
            {ev.milestones.map((ms, i) => {
              const got = prog.event?.claimed.includes(i);
              const ready = (prog.event?.score ?? 0) >= ms.score && !got;
              return (
                <div className="row" key={i} style={{ marginTop: 8 }}>
                  <span>
                    {ms.score} · {ms.tokens ? `+${ms.tokens} жетонов` : ''} {ms.tickets ? `+${ms.tickets} билетов` : ''} {ms.cosmetic ? '· косметика' : ''}
                  </span>
                  <span className="spacer" />
                  {got ? <span className="tag">{t('ac.done')}</span> : (
                    <button className="btn small primary" disabled={!ready || busy} onClick={() => run(async () => apply(await api.claimEvent(i)))}>
                      {t('ev.claim')}
                    </button>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <p className="muted">{t('ev.empty')}</p>
        )}
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>{t('ev.quests')}</h3>
        {meta.quests.map((q) => {
          const row = prog.quests.find((x) => x.id === q.id);
          const ready = !!row && row.progress >= q.need && !row.claimed;
          return (
            <div className="row" key={q.id} style={{ marginTop: 8 }}>
              <div>
                <b>{q.name}</b>
                <div className="small muted">{q.description}</div>
              </div>
              <span className="spacer" />
              <span className="small">{Math.min(row?.progress ?? 0, q.need)}/{q.need}</span>
              {row?.claimed ? <span className="tag">{t('ac.done')}</span> : (
                <button className="btn small primary" disabled={!ready || busy} onClick={() => run(async () => apply(await api.claimQuest(q.id)))}>
                  +{q.tokens}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>{t('ev.board')}</h3>
        {!prog.board.length && <p className="muted small">{t('ev.empty')}</p>}
        {prog.board.map((b) => (
          <div className="row" key={b.rank}>
            <b>{b.rank}.</b>
            <span>{b.nickname}</span>
            <span className="spacer" />
            <span>{fmt(b.cargo)} кг</span>
          </div>
        ))}
        <p className="small muted">
          {t('ev.you')}: {prog.myRank ? `#${prog.myRank}` : '—'} · {fmt(D(prog.myCargo))} кг
        </p>
      </div>
    </div>
  );
}
