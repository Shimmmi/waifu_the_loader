/**
 * Идемпотентная заготовка шаблонов. Без --model рисует локальные webp,
 * чтобы найм не зависел от числа роллов. С --model сюда подставляется RouterAI.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = resolve(root, 'client/public/assets/templates');
const manifestPath = resolve(outDir, 'manifest.json');

interface Row {
  template_id: string;
  race: string;
  class: string;
  first_name: string;
  last_name: string;
  look_tags: string[];
  portrait: string;
  thumb: string;
  status: 'draft' | 'approved' | 'rejected';
  pack_version: number;
  phash: string;
}

const FIRST = ['Мира', 'Нина', 'Лера', 'Кира', 'Ася', 'Вера', 'Нина', 'Тома', 'Яна', 'Рита', 'Софа', 'Даша', 'Оля', 'Катя', 'Женя', 'Люба', 'Зоя', 'Инга', 'Майя', 'Тая'];
const LAST = ['Вокс', 'Рельс', 'Кран', 'Док', 'Пыль', 'Иней', 'Бухта', 'Смена', 'Лампа', 'Гайка', 'Трос', 'Кипа', 'Норд', 'Штиль', 'Борт', 'Кедр', 'Искра', 'Молот', 'Руда', 'Сема'];
const TAGS = ['short_hair', 'long_hair', 'orange_hair', 'silver_hair', 'goggles', 'red_overalls', 'jacket', 'gloves', 'boots', 'scarf'];

const args = process.argv.slice(2);
const target = Number(args.find((a) => a.startsWith('--per='))?.slice(6) ?? 5);
const approve = args.includes('--approve');

function hashBits(buf: Buffer): string {
  let bits = '';
  let sum = 0;
  for (const b of buf) sum += b;
  const avg = sum / buf.length;
  for (const b of buf) bits += b >= avg ? '1' : '0';
  return bits;
}

function hamming(a: string, b: string): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n += 1;
  return n;
}

async function paint(race: string, job: string, nn: number, salt: number): Promise<{ main: Buffer; thumb: Buffer; phash: string }> {
  const h = createHash('sha256').update(`${race}:${job}:${nn}:${salt}`).digest();
  const r = h[0] ?? 40;
  const g = h[1] ?? 40;
  const b = h[2] ?? 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024">
    <rect width="768" height="1024" fill="rgb(${r},${g},${b})"/>
    <rect x="180" y="220" width="400" height="560" rx="40" fill="rgb(${255 - r},${255 - g},${200})"/>
    <circle cx="${200 + (h[3] ?? 0) % 300}" cy="${300 + (h[4] ?? 0) % 200}" r="70" fill="rgb(${h[5] ?? 0},${r},${g})"/>
    <text x="384" y="860" text-anchor="middle" font-size="42" fill="#111">${race} ${job} ${nn}</text>
  </svg>`;
  const main = await sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
  const thumb = await sharp(Buffer.from(svg)).resize(256, 341).webp({ quality: 85 }).toBuffer();
  const raw = await sharp(Buffer.from(svg)).resize(8, 8, { fit: 'fill' }).greyscale().raw().toBuffer();
  return { main, thumb, phash: hashBits(raw) };
}

async function main(): Promise<void> {
  const races = JSON.parse(readFileSync(resolve(root, 'config/v3/races.json'), 'utf8')) as { id: string }[];
  const classes = JSON.parse(readFileSync(resolve(root, 'config/v3/classes.json'), 'utf8')) as { id: string }[];
  const rows: Row[] = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
  const usedNames = new Set(rows.map((r) => `${r.first_name} ${r.last_name}`));
  let nameI = 0;
  function nextName(): [string, string] {
    for (let guard = 0; guard < 5000; guard++) {
      const first = FIRST[nameI % FIRST.length] ?? 'Мира';
      const last = LAST[Math.floor(nameI / FIRST.length) % LAST.length] ?? 'Вокс';
      nameI += 1;
      const full = `${first} ${last}`;
      if (usedNames.has(full)) continue;
      usedNames.add(full);
      return [first, last];
    }
    const first = `Имя${nameI}`;
    return [first, 'Док'];
  }
  let made = 0;
  for (const race of races) {
    for (const job of classes) {
      const have = rows.filter((r) => r.race === race.id && r.class === job.id && r.status !== 'rejected');
      for (let i = have.length; i < target; i++) {
        const nn = String(i + 1).padStart(2, '0');
        const id = `tpl_${race.id}_${job.id}_${nn}`;
        if (rows.some((r) => r.template_id === id)) continue;
        const rel = `${race.id}/${job.id}/${race.id}_${job.id}_${nn}.webp`;
        const file = resolve(outDir, rel);
        const thumbFile = file.replace(/\.webp$/, '_t.webp');
        if (existsSync(file)) continue;
        let salt = 0;
        let painted = await paint(race.id, job.id, i + 1, salt);
        const hashes = rows.filter((r) => r.race === race.id && r.class === job.id).map((r) => r.phash);
        while (hashes.some((h) => hamming(h, painted.phash) < 6) && salt < 8) {
          salt += 1;
          painted = await paint(race.id, job.id, i + 1, salt);
        }
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, painted.main);
        writeFileSync(thumbFile, painted.thumb);
        const [first, last] = nextName();
        rows.push({
          template_id: id,
          race: race.id,
          class: job.id,
          first_name: first,
          last_name: last,
          look_tags: [TAGS[(i + salt) % TAGS.length] ?? 'gloves', TAGS[(i + 3) % TAGS.length] ?? 'boots'],
          portrait: `assets/templates/${rel}`,
          thumb: `assets/templates/${rel.replace(/\.webp$/, '_t.webp')}`,
          status: approve ? 'approved' : 'draft',
          pack_version: 1,
          phash: painted.phash,
        });
        made += 1;
      }
    }
  }
  writeFileSync(manifestPath, JSON.stringify(rows, null, 2));
  console.log(`шаблонов в манифесте: ${rows.length}, новых файлов: ${made}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
