import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RARITIES, ThemeSchema, type AiSettings, type Rarity } from '@wl/shared';
import { adminApi, ApiError, type AiLogItem, type AiOverview, type AiSettingsVersion, type AiTestResult, type ModelInfo, type ReviewItem } from '../api';
import { rarityStyle } from '../components/ui';
import { useStore } from '../store';

type Tab = 'overview' | 'settings' | 'test' | 'review' | 'log';
const TABS: [Tab, string][] = [
  ['overview', 'Сводка'],
  ['settings', 'Настройки'],
  ['test', 'Тест'],
  ['review', 'Модерация'],
  ['log', 'Журнал'],
];

const rub = (n: number) => `${n.toFixed(2)} ₽`;
const dt = (s: string) => new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function useToastError() {
  const toast = useStore((s) => s.toast);
  return useCallback((e: unknown) => toast(e instanceof ApiError ? e.message : String(e), 'error'), [toast]);
}

export function Admin() {
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<AiOverview | null>(null);
  const onError = useToastError();
  const reload = useCallback(() => adminApi.overview().then(setOverview).catch(onError), [onError]);
  useEffect(() => void reload(), [reload]);

  return (
    <div>
      <h2>🤖 ИИ-цех</h2>
      <div className="seg" style={{ marginBottom: 14 }}>
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {!overview ? (
        <div className="panel muted">Загрузка…</div>
      ) : (
        <>
          {tab === 'overview' && <Overview o={overview} onReload={reload} />}
          {tab === 'settings' && <Settings current={overview.current} onSaved={reload} />}
          {tab === 'test' && <TestRun archetypes={overview.archetypes} onDone={reload} />}
          {tab === 'review' && <Review onChange={reload} />}
          {tab === 'log' && <Log />}
        </>
      )}
    </div>
  );
}

function Overview({ o, onReload }: { o: AiOverview; onReload: () => void }) {
  const s = o.current.settings;
  const lim = s.limits;
  const byKind = Object.fromEntries(o.week.calls.map((c) => [c.kind, c]));
  const v = byKind.validation;
  const pool = (r: Rarity, src: 'ai' | 'procedural', status: string) => o.pool.find((p) => p.rarity === r && p.source === src && p.status === status)?.n ?? 0;
  const verdict = (st: string) => o.week.verdicts.find((x) => x.status === st)?.n ?? 0;
  const onError = useToastError();
  const resetDaily = async () => {
    if (!confirm(`Начать считать сегодняшний расход с нуля? Ещё до ${rub(lim.daily_rub)} сегодня. Месячный лимит не меняется.`)) return;
    await adminApi.resetDaily().then(onReload).catch(onError);
  };
  return (
    <>
      {!o.keyConfigured && <div className="panel" style={{ borderColor: 'var(--danger)' }}>⚠️ Ключ RouterAI не задан в .env — генерация через ИИ не работает, пул пополняется процедурно.</div>}
      <div className="grid2">
        <div className="panel">
          <h3>Расходы</h3>
          <Bar label="Сегодня" value={o.spend.todayRub} max={lim.daily_rub} />
          <Bar label="Месяц" value={o.spend.monthRub} max={lim.monthly_rub} />
          <p className="muted" style={{ fontSize: 13 }}>
            Сутки и месяц — по Москве. При исчерпании лимита воркер останавливает ИИ, игра продолжает выдавать процедурных waifu.
            {o.spend.resetAt && ` Дневной лимит сброшен в ${dt(o.spend.resetAt)}.`}
          </p>
          <button className="btn small" onClick={() => void resetDaily()}>
            Сбросить дневной лимит
          </button>
        </div>
        <div className="panel">
          <h3>За 7 дней</h3>
          <table className="tbl">
            <tbody>
              <tr>
                <td>Валидация профилей</td>
                <td>{v ? `${v.calls - v.failed}/${v.calls} (${pct(v.calls - v.failed, v.calls)}), с первой попытки ${pct(v.first_try, v.calls)}` : '—'}</td>
              </tr>
              <tr>
                <td>Модерация</td>
                <td>
                  ✅ {verdict('ready') + verdict('taken')} · 🕵️ {verdict('review')} · ⛔ {verdict('rejected')}
                </td>
              </tr>
              {(['text', 'image', 'moderation'] as const).map((k) => (
                <tr key={k}>
                  <td>Вызовы {k}</td>
                  <td>{byKind[k] ? `${byKind[k].calls} (ошибок ${byKind[k].failed}), ${rub(byKind[k].cost)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {o.themes.length > 0 && (
        <div className="panel">
          <h3>Темы образов в ИИ-пуле</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Тема</th>
                <th>В пуле и выдано</th>
                <th>На проверке</th>
                <th>Брак</th>
              </tr>
            </thead>
            <tbody>
              {o.themes.map((t) => (
                <tr key={t.theme}>
                  <td>{s.image.themes.find((x) => x.id === t.theme)?.name ?? t.theme}</td>
                  <td>{t.ok}</td>
                  <td>{t.review}</td>
                  <td>
                    {t.rejected}
                    {t.ok + t.review + t.rejected > 0 && <span className="muted"> ({pct(t.rejected, t.ok + t.review + t.rejected)})</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Пул</h3>
          <button className="btn small" onClick={onReload}>
            ↻ Обновить
          </button>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          ИИ: {s.enabled ? 'включён' : 'выключен'} · редкости {s.pool.ai_rarities.join(', ') || '—'} · цель {s.pool.ai_target} на редкость · версия настроек v{o.current.version}
        </p>
        <table className="tbl">
          <thead>
            <tr>
              <th>Редкость</th>
              <th>ИИ готово</th>
              <th>ИИ выдано</th>
              <th>На проверке</th>
              <th>Процедурно готово</th>
            </tr>
          </thead>
          <tbody>
            {RARITIES.map((r) => (
              <tr key={r}>
                <td>
                  <b style={{ ...rarityStyle(r), color: 'var(--rc)' }}>{r}</b>
                </td>
                <td>
                  {pool(r, 'ai', 'ready')}
                  {s.pool.ai_rarities.includes(r) && <span className="muted"> / {s.pool.ai_target}</span>}
                </td>
                <td>{pool(r, 'ai', 'taken')}</td>
                <td>{pool(r, 'ai', 'review')}</td>
                <td>{pool(r, 'procedural', 'ready')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const p = max > 0 ? Math.min(100, (value / max) * 100) : 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>{label}</span>
        <b>
          {rub(value)} / {rub(max)}
        </b>
      </div>
      <div className="progress">
        <i style={{ width: `${p}%`, background: p >= 90 ? 'var(--danger)' : undefined }} />
      </div>
    </div>
  );
}

// ---------- настройки ----------

type Path = [keyof AiSettings, string];

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="afield">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

function Settings({ current, onSaved }: { current: AiSettingsVersion; onSaved: () => void }) {
  const [draft, setDraft] = useState<AiSettings>(current.settings);
  const [comment, setComment] = useState('');
  const [versions, setVersions] = useState<AiSettingsVersion[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const toast = useStore((s) => s.toast);
  const onError = useToastError();

  useEffect(() => setDraft(current.settings), [current]);
  useEffect(() => {
    adminApi.versions().then((r) => setVersions(r.versions)).catch(onError);
    adminApi.models().then((r) => setModels(r.models)).catch(onError);
  }, [current, onError]);

  const lists = useMemo(
    () => ({
      text: models.filter((m) => m.output.includes('text') && !m.output.includes('image')),
      image: models.filter((m) => m.output.includes('image')),
      vision: models.filter((m) => m.input.includes('image') && m.output.includes('text')),
    }),
    [models],
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(current.settings);

  const set = ([block, key]: Path, value: unknown) =>
    setDraft((d) => (key ? { ...d, [block]: { ...(d[block] as object), [key]: value } } : { ...d, [block]: value }));
  const str = (p: Path) => (d: AiSettings) => String((d[p[0]] as Record<string, unknown>)[p[1]] ?? '');
  const text = (p: Path, list?: ModelInfo[]) => (
    <input className="input" list={list ? `ml-${p.join('-')}` : undefined} value={str(p)(draft)} onChange={(e) => set(p, e.target.value)} />
  );
  const num = (p: Path, step = 1) => (
    <input className="input" type="number" step={step} value={str(p)(draft)} onChange={(e) => set(p, Number(e.target.value))} />
  );
  const area = (p: Path, rows = 5) => <textarea className="input" rows={rows} value={str(p)(draft)} onChange={(e) => set(p, e.target.value)} />;
  const datalist = (p: Path, list: ModelInfo[]) => (
    <datalist id={`ml-${p.join('-')}`}>
      {list.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </datalist>
  );
  const modelPair = (block: 'text' | 'image' | 'moderation', list: ModelInfo[]) => (
    <div className="grid2">
      <Field label="Модель">
        {text([block, 'model'], list)}
        {datalist([block, 'model'], list)}
      </Field>
      <Field label="Резервная модель" hint="Используется при ошибке или таймауте основной">
        {text([block, 'fallback'], list)}
        {datalist([block, 'fallback'], list)}
      </Field>
    </div>
  );

  const save = async () => {
    setBusy(true);
    try {
      const r = await adminApi.save(draft, comment);
      toast(`Сохранено: версия v${r.version}`, 'success');
      setComment('');
      onSaved();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const rollback = async (v: number) => {
    if (!confirm(v === 0 ? 'Вернуть настройки по умолчанию?' : `Откатить к версии v${v}?`)) return;
    try {
      const r = await adminApi.rollback(v);
      toast(`Откат выполнен: новая версия v${r.version}`, 'success');
      onSaved();
    } catch (e) {
      onError(e);
    }
  };

  return (
    <>
      <div className="panel">
        <label className="row">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => set(['enabled', ''], e.target.checked)} />
          <b>Генерация через ИИ включена</b>
          <span className="muted">— выключите, чтобы пул пополнялся только процедурно</span>
        </label>
      </div>

      <div className="panel">
        <h3>Текст профиля</h3>
        {modelPair('text', lists.text)}
        <div className="grid4">
          <Field label="Температура">{num(['text', 'temperature'], 0.05)}</Field>
          <Field label="max_tokens">{num(['text', 'max_tokens'], 100)}</Field>
          <Field label="Таймаут, с">{num(['text', 'timeout_sec'])}</Field>
          <Field label="Мат в текстах">
            <select className="input" value={draft.text.swear ? '1' : '0'} onChange={(e) => set(['text', 'swear'], e.target.value === '1')}>
              <option value="1">умеренный</option>
              <option value="0">без мата</option>
            </select>
          </Field>
        </div>
        <Field label="Системный промпт">{area(['text', 'system_prompt'], 8)}</Field>
      </div>

      <div className="panel">
        <h3>Портрет</h3>
        {modelPair('image', lists.image)}
        <div className="grid4">
          <Field label="Соотношение сторон">
            <select className="input" value={draft.image.aspect_ratio} onChange={(e) => set(['image', 'aspect_ratio'], e.target.value)}>
              {['3:4', '2:3', '1:1'].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Seed" hint="0 — случайный">
            {num(['image', 'seed'])}
          </Field>
          <Field label="Таймаут, с">{num(['image', 'timeout_sec'])}</Field>
          <Field label="Разрешение" hint="Пусто — по умолчанию модели">
            {text(['image', 'resolution'])}
          </Field>
        </div>
        <Field label="Стиль (добавляется к каждому портрету)">{area(['image', 'style_prompt'], 4)}</Field>
        <Field label="Негативный промпт" hint="Оговорка «adult woman, 21+» добавляется сервером всегда и не редактируется">
          {area(['image', 'negative_prompt'], 3)}
        </Field>
        <div className="grid2">
          {RARITIES.filter((r) => draft.pool.ai_rarities.includes(r)).map((r) => (
            <Field key={r} label={`Модификатор ${r}`}>
              <input
                className="input"
                value={draft.image.rarity_modifiers[r] ?? ''}
                onChange={(e) => set(['image', 'rarity_modifiers'], { ...draft.image.rarity_modifiers, [r]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </div>

      <Looks draft={draft} onChange={(image) => setDraft((d) => ({ ...d, image }))} />

      <div className="panel">
        <h3>Автомодерация</h3>
        <label className="row" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={draft.moderation.enabled} onChange={(e) => set(['moderation', 'enabled'], e.target.checked)} />
          Проверять каждую картинку vision-моделью
          <span className="muted">— без проверки все ИИ-waifu уходят в ручную модерацию</span>
        </label>
        {modelPair('moderation', lists.vision)}
        <Field label="Промпт модерации">{area(['moderation', 'prompt'], 6)}</Field>
      </div>

      <div className="panel">
        <h3>Лимиты и пул</h3>
        <div className="grid4">
          <Field label="Лимит в сутки, ₽">{num(['limits', 'daily_rub'], 10)}</Field>
          <Field label="Лимит в месяц, ₽">{num(['limits', 'monthly_rub'], 100)}</Field>
          <Field label="ИИ-waifu на редкость">{num(['pool', 'ai_target'])}</Field>
          <Field label="За один прогон">{num(['pool', 'ai_batch'])}</Field>
          <Field label="Процедурный запас" hint="На случай остановки ИИ">
            {num(['pool', 'procedural_reserve'])}
          </Field>
        </div>
        <Field label="Редкости, которые рисует ИИ">
          <div className="row">
            {RARITIES.map((r) => (
              <label key={r} className="row" style={{ gap: 4 }}>
                <input
                  type="checkbox"
                  checked={draft.pool.ai_rarities.includes(r)}
                  onChange={(e) =>
                    set(['pool', 'ai_rarities'], e.target.checked ? RARITIES.filter((x) => x === r || draft.pool.ai_rarities.includes(x)) : draft.pool.ai_rarities.filter((x) => x !== r))
                  }
                />
                {r}
              </label>
            ))}
          </div>
        </Field>
      </div>

      <div className="panel sticky-actions">
        <div className="row">
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Комментарий к версии (что поменяли)" value={comment} maxLength={200} onChange={(e) => setComment(e.target.value)} />
          <button className="btn" disabled={!dirty || busy} onClick={() => setDraft(current.settings)}>
            Сбросить
          </button>
          <button className="btn primary" disabled={!dirty || busy} onClick={() => void save()}>
            Сохранить как новую версию
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>История версий</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Версия</th>
              <th>Когда</th>
              <th>Кто</th>
              <th>Комментарий</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.version}>
                <td>
                  <b>v{v.version}</b>
                  {v.version === current.version && <span className="muted"> (текущая)</span>}
                </td>
                <td>{dt(v.createdAt)}</td>
                <td>{v.createdBy ?? '—'}</td>
                <td>{v.comment || <span className="muted">—</span>}</td>
                <td>
                  {v.version !== current.version && (
                    <button className="btn small" onClick={() => void rollback(v.version)}>
                      Откатить
                    </button>
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <b>v0</b>
              </td>
              <td colSpan={3} className="muted">
                Значения по умолчанию из кода
              </td>
              <td>
                {current.version !== 0 && (
                  <button className="btn small" onClick={() => void rollback(0)}>
                    Откатить
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- темы образов ----------

const lines = (xs: string[]) => xs.join('\n');
const unlines = (t: string) =>
  t
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

function Looks({ draft, onChange }: { draft: AiSettings; onChange: (image: AiSettings['image']) => void }) {
  const img = draft.image;
  const [json, setJson] = useState(() => JSON.stringify(img.themes, null, 2));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setJson((cur) => {
      try {
        if (JSON.stringify(JSON.parse(cur)) === JSON.stringify(img.themes)) return cur;
      } catch {
        /* текст с ошибкой заменяется актуальными темами */
      }
      setError(null);
      return JSON.stringify(img.themes, null, 2);
    });
  }, [img.themes]);

  const applyJson = (text: string) => {
    setJson(text);
    try {
      const parsed = ThemeSchema.array().min(1).safeParse(JSON.parse(text));
      if (!parsed.success) return setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      setError(null);
      onChange({ ...img, themes: parsed.data });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const setWeight = (id: string, weight: number) => onChange({ ...img, themes: img.themes.map((t) => (t.id === id ? { ...t, weight } : t)) });
  const total = img.themes.reduce((a, t) => a + t.weight, 0);

  return (
    <div className="panel">
      <h3>Образы</h3>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Для каждой waifu сервер выбирает тему (место, одежда, груз, свет), позу и план. Темы, которых в пуле меньше их доли, выпадают чаще. Вес 0 — тема
        выключена.
      </p>
      <table className="tbl">
        <thead>
          <tr>
            <th>Тема</th>
            <th>С редкости</th>
            <th>Вес</th>
            <th>Доля</th>
          </tr>
        </thead>
        <tbody>
          {img.themes.map((t) => (
            <tr key={t.id}>
              <td>
                {t.name} <span className="muted">({t.id})</span>
              </td>
              <td>{t.min_rarity}</td>
              <td>
                <input className="input" style={{ width: 80 }} type="number" step={0.1} min={0} value={t.weight} onChange={(e) => setWeight(t.id, Number(e.target.value))} />
              </td>
              <td className="muted">{pct(t.weight, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid2">
        <Field label="Позы (по одной в строке)">
          <textarea className="input" rows={7} value={lines(img.poses)} onChange={(e) => onChange({ ...img, poses: unlines(e.target.value) })} />
        </Field>
        <Field label="Планы и ракурсы (по одному в строке)">
          <textarea className="input" rows={7} value={lines(img.shots)} onChange={(e) => onChange({ ...img, shots: unlines(e.target.value) })} />
        </Field>
      </div>
      <details>
        <summary>Редактировать темы целиком (JSON)</summary>
        <Field label="Темы" hint="Поля: id, name, weight, min_rarity, scene, outfits[], cargo[], lighting[], story_ru">
          <textarea className="input" rows={18} value={json} onChange={(e) => applyJson(e.target.value)} />
        </Field>
        {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>Не сохранится: {error}</p>}
      </details>
    </div>
  );
}

// ---------- тест ----------

function TestRun({ archetypes, onDone }: { archetypes: AiOverview['archetypes']; onDone: () => void }) {
  const [rarity, setRarity] = useState<Rarity>('SSR');
  const [archetype, setArchetype] = useState('');
  const [state, setState] = useState<string | null>(null);
  const [result, setResult] = useState<AiTestResult | null>(null);
  const [started, setStarted] = useState(0);
  const [now, setNow] = useState(Date.now());
  const onError = useToastError();

  useEffect(() => {
    if (!state || state === 'completed' || state === 'failed') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state]);

  const run = async () => {
    setResult(null);
    setState('waiting');
    setStarted(Date.now());
    try {
      const { jobId } = await adminApi.test(rarity, archetype || undefined);
      for (;;) {
        await new Promise((r) => setTimeout(r, 2500));
        const s = await adminApi.testStatus(jobId);
        setState(s.state);
        if (s.state === 'completed') {
          setResult(s.result);
          break;
        }
        if (s.state === 'failed') {
          setResult({ ok: false, stage: 'worker', error: s.error ?? 'задача упала', costRub: 0, durationMs: 0, models: {} });
          break;
        }
      }
      onDone();
    } catch (e) {
      setState(null);
      onError(e);
    }
  };
  const running = !!state && state !== 'completed' && state !== 'failed';

  return (
    <>
      <div className="panel">
        <p className="muted" style={{ marginTop: 0 }}>
          Одна пробная waifu текущими сохранёнными настройками: профиль → портрет → модерация. В пул не попадает. Стоит около 5 ₽ и идёт в общий лимит.
        </p>
        <div className="row">
          <select className="input" style={{ width: 'auto' }} value={rarity} onChange={(e) => setRarity(e.target.value as Rarity)}>
            {RARITIES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select className="input" style={{ width: 'auto' }} value={archetype} onChange={(e) => setArchetype(e.target.value)}>
            <option value="">архетип — наименее частый</option>
            {archetypes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button className="btn primary" disabled={running} onClick={() => void run()}>
            {running ? `Генерация… ${Math.round((now - started) / 1000)} с` : '▶ Тест'}
          </button>
        </div>
      </div>
      {result && <TestResultView r={result} />}
    </>
  );
}

function TestResultView({ r }: { r: AiTestResult }) {
  const p = r.profile;
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>
          {r.ok ? (r.verdict === 'ready' ? '✅ Готово' : r.verdict === 'review' ? '🕵️ На ручную проверку' : '⛔ Отклонено модерацией') : `❌ Ошибка на этапе «${r.stage}»`}
        </h3>
        <span className="muted">
          {(r.durationMs / 1000).toFixed(1)} с · {rub(r.costRub)}
          {r.attempts ? ` · попыток текста: ${r.attempts}` : ''}
        </span>
      </div>
      {r.error && <p style={{ color: 'var(--danger)' }}>{r.error}</p>}
      {r.reasons && r.reasons.length > 0 && <p>Причины: {r.reasons.join(', ')}</p>}
      <div className="test-result">
        {r.portraitUrl && <img src={r.portraitUrl} alt="" />}
        <div>
          {p && (
            <>
              <h3 style={{ ...rarityStyle(p.rarity), color: 'var(--rc)' }}>
                {p.name}, {p.age} · {p.rarity} · {p.archetype}
              </h3>
              <p>{p.bio}</p>
              <p>
                <i>«{p.quote}»</i>
              </p>
              <p className="muted">{p.appearance}</p>
              <p>
                {Object.entries(p.stats)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(' · ')}
              </p>
              <ul>
                {p.talents.map((t) => (
                  <li key={t.name}>
                    <b>{t.name}</b> — {t.description}
                  </li>
                ))}
              </ul>
            </>
          )}
          {r.look && (
            <p style={{ fontSize: 13 }}>
              Образ: <b>{r.look.themeName}</b> · {r.look.outfit} · груз: {r.look.cargo} · {r.look.pose} · {r.look.shot}
            </p>
          )}
          <p className="muted" style={{ fontSize: 12 }}>
            Модели: {[r.models.text, r.models.image, r.models.moderation].filter(Boolean).join(' · ')}
          </p>
          {r.validationErrors && r.validationErrors.length > 0 && (
            <details>
              <summary>Отклонённые попытки текста ({r.validationErrors.length})</summary>
              <ul style={{ fontSize: 13 }}>
                {r.validationErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
          {r.imagePrompt && (
            <details>
              <summary>Промпт портрета</summary>
              <pre className="pre">{r.imagePrompt}</pre>
            </details>
          )}
          {r.moderation !== undefined && (
            <details>
              <summary>Ответ модерации</summary>
              <pre className="pre">{JSON.stringify(r.moderation, null, 2)}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- ручная модерация ----------

function Review({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState<'review' | 'rejected'>('review');
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const onError = useToastError();
  const load = useCallback(() => adminApi.review(status).then((r) => setItems(r.items)).catch(onError), [status, onError]);
  useEffect(() => void load(), [load]);

  const decide = async (id: string, action: 'approve' | 'reject') => {
    try {
      await adminApi.decide(id, action);
      setItems((xs) => xs?.filter((x) => x.id !== id) ?? null);
      onChange();
    } catch (e) {
      onError(e);
    }
  };

  return (
    <>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={status === 'review' ? 'on' : ''} onClick={() => setStatus('review')}>
          🕵️ Ждут проверки
        </button>
        <button className={status === 'rejected' ? 'on' : ''} onClick={() => setStatus('rejected')}>
          ⛔ Отклонённые
        </button>
      </div>
      {!items ? (
        <div className="panel muted">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="panel muted">{status === 'review' ? 'Очередь пуста — автомодерация справляется' : 'Отклонённых нет'}</div>
      ) : (
        <div className="review-grid">
          {items.map((w) => (
            <div key={w.id} className="panel review-card">
              <img src={w.portrait_url} alt="" loading="lazy" />
              <div>
                <b style={{ ...rarityStyle(w.rarity), color: 'var(--rc)' }}>{w.rarity}</b> {w.name}, {w.age}
                <div className="muted" style={{ fontSize: 12 }}>
                  {w.archetype} · {dt(w.created_at)}
                  {w.gen_cost_rub != null && ` · ${rub(w.gen_cost_rub)}`}
                </div>
              </div>
              {w.moderation && (
                <div style={{ fontSize: 13 }}>
                  {w.moderation.reasons?.length ? `Причины: ${w.moderation.reasons.join(', ')}` : ''}
                  {w.moderation.estimated_min_age != null && ` · возраст на вид ≥ ${w.moderation.estimated_min_age}`}
                  {w.moderation.notes && <div className="muted">{w.moderation.notes}</div>}
                </div>
              )}
              <details style={{ fontSize: 13 }}>
                <summary>Текст</summary>
                <p>{w.bio}</p>
                <p>
                  <i>«{w.quote}»</i>
                </p>
              </details>
              <div className="row">
                <button className="btn small primary" onClick={() => void decide(w.id, 'approve')}>
                  ✅ В пул
                </button>
                {status === 'review' && (
                  <button className="btn small danger" onClick={() => void decide(w.id, 'reject')}>
                    ⛔ Отклонить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- журнал ----------

const KIND_ICON: Record<string, string> = { text: '📝', image: '🖼️', moderation: '🕵️', validation: '✔️' };

function Log() {
  const [items, setItems] = useState<AiLogItem[] | null>(null);
  const onError = useToastError();
  const load = useCallback(() => adminApi.log(150).then((r) => setItems(r.items)).catch(onError), [onError]);
  useEffect(() => void load(), [load]);
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Последние вызовы</h3>
        <button className="btn small" onClick={() => void load()}>
          ↻ Обновить
        </button>
      </div>
      {!items ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Когда</th>
                <th />
                <th>Модель</th>
                <th>Цель</th>
                <th>Редк.</th>
                <th>Время</th>
                <th>Токены</th>
                <th>₽</th>
                <th>Итог</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id}>
                  <td>{dt(x.created_at)}</td>
                  <td title={x.kind}>{KIND_ICON[x.kind] ?? x.kind}</td>
                  <td style={{ fontSize: 12 }}>{x.model}</td>
                  <td>{x.purpose === 'test' ? 'тест' : 'пул'}</td>
                  <td>{x.rarity ?? ''}</td>
                  <td>{(x.duration_ms / 1000).toFixed(1)} с</td>
                  <td style={{ fontSize: 12 }}>{x.prompt_tokens != null ? `${x.prompt_tokens}/${x.completion_tokens ?? 0}` : ''}</td>
                  <td>{x.cost_rub ? x.cost_rub.toFixed(2) : ''}</td>
                  <td style={{ fontSize: 12, maxWidth: 380 }}>
                    {x.ok ? (x.kind === 'validation' ? `✅ с ${x.attempts}-й попытки` : '✅') : <span style={{ color: 'var(--danger)' }}>❌ {x.error}</span>}
                    {x.ok && x.kind === 'validation' && x.error && <div className="muted">{x.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
