import Decimal from 'break_infinity.js';

export { Decimal };
export type DecimalSource = Decimal | number | string;

export const D = (v: DecimalSource): Decimal => new Decimal(v);
export const ZERO = new Decimal(0);

/** Сериализация для БД/JSON: мантисса+экспонента в строке ("1.5e20"). */
export const dstr = (v: Decimal): string => v.toString();

const LETTER_START_TIER = 5; // после T идут aa, ab, …
const SHORT = ['', 'K', 'M', 'B', 'T'];

export type Notation = 'letters' | 'scientific';

function letters(tier: number): string {
  const idx = tier - LETTER_START_TIER;
  const a = Math.floor(idx / 26);
  const b = idx % 26;
  return String.fromCharCode(97 + (a % 26)) + String.fromCharCode(97 + b);
}

function trim(n: number, digits: number, pad = false): string {
  const s = n.toFixed(digits);
  return pad || digits === 0 ? s : s.replace(/\.?0+$/, '');
}

/** 1.23K, 4.5M, 7.8B, 1T, далее aa, ab… или научная нотация. pad держит хвост нулей, чтобы цифра не прыгала по ширине. */
export function formatNumber(value: DecimalSource, notation: Notation = 'letters', pad = false): string {
  const v = D(value);
  if (v.lt(0)) return '-' + formatNumber(v.neg(), notation, pad);
  if (v.lt(1000)) {
    const n = v.toNumber();
    if (pad) return n.toFixed(1);
    return n < 10 && n % 1 !== 0 ? trim(n, 2) : trim(n, n < 100 ? 1 : 0);
  }
  let e = v.exponent;
  let mantissa = v.mantissa;
  // Округление 9.995 → 10.0 переносим в порядок, иначе получится «10e5» или «1000K»
  if (Number(mantissa.toFixed(2)) >= 10) {
    mantissa /= 10;
    e += 1;
  }
  if (notation === 'scientific') return `${trim(mantissa, 2, pad)}e${e}`;
  let tier = Math.floor(e / 3);
  let scaled = mantissa * Math.pow(10, e - tier * 3);
  const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  if (Number(scaled.toFixed(digits)) >= 1000) {
    tier += 1;
    scaled /= 1000;
  }
  const suffix = tier < LETTER_START_TIER ? SHORT[tier] : letters(tier);
  return trim(scaled, scaled < 10 ? 2 : scaled < 100 ? 1 : 0, pad) + suffix;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h >= 48) return `${Math.floor(h / 24)} д ${h % 24} ч`;
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин ${ss} с`;
  return `${ss} с`;
}
