import { rarityConfig } from './config.js';
import { STATS, WaifuProfileSchema, type EconomyConfig, type WaifuProfile } from './schemas.js';

/** Стоп-лист: дискриминация, сексуальный контент, детские черты. Мат ошибкой не считается. */
const word = (alts: string): RegExp => new RegExp(`(?<!\\p{L})(${alts})(?!\\p{L})`, 'iu');
const FORBIDDEN: RegExp[] = [
  word('лоли|loli|shota|шота'),
  word('школьниц\\p{L}*|подрост\\p{L}*|несовершеннолет\\p{L}*|ребён\\p{L}*|ребен\\p{L}*|малолет\\p{L}*|девочк\\p{L}*|child\\p{L}*|kids?|teen\\p{L}*|underage|minor|schoolgirls?|school uniform|young girl|little girl|baby face|chibi'),
  word('секс\\p{L}*|эрот\\p{L}*|голая|голой|обнаж\\p{L}*|порн\\p{L}*|nsfw|nude|naked|sexy|sexual|lewd'),
  word('хач\\p{L}*|чурк\\p{L}*|жид\\p{L}*|ниггер\\p{L}*|nigg\\p{L}*|пидор\\p{L}*|пидар\\p{L}*|faggot'),
];

/** Иероглифы и прочие письменности — типичный сбой LLM посреди русского текста. */
const FOREIGN_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Arabic}\p{Script=Thai}\p{Script=Hebrew}]+/u;

export function findForbidden(text: string): string | null {
  for (const re of FORBIDDEN) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

/** Валидация профиля waifu (ТЗ 10.1 п.2). Пустой массив — профиль ок. */
export function validateProfile(input: unknown, cfg: EconomyConfig): string[] {
  const parsed = WaifuProfileSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  const p: WaifuProfile = parsed.data;
  const errs: string[] = [];
  const rc = rarityConfig(cfg, p.rarity);

  const sum = STATS.reduce((s, k) => s + p.stats[k], 0);
  if (sum !== rc.stat_budget) errs.push(`сумма статов ${sum} ≠ бюджету ${rc.stat_budget}`);
  for (const k of STATS) {
    if (p.stats[k] > Math.ceil(rc.stat_budget * 0.6)) errs.push(`стат ${k} больше 60% бюджета`);
  }
  if (p.talents.length !== rc.talent_count) errs.push(`талантов ${p.talents.length}, нужно ${rc.talent_count}`);
  if (p.age < 18) errs.push('возраст < 18');

  for (const field of [p.name, p.bio, p.quote, p.appearance, ...p.talents.flatMap((t) => [t.name, t.description])]) {
    const bad = findForbidden(field);
    if (bad) errs.push(`запрещённое слово: «${bad}»`);
    const alien = field.match(FOREIGN_SCRIPT);
    if (alien) errs.push(`посторонние символы «${alien[0]}»: пиши только кириллицей и латиницей`);
  }
  return errs;
}
