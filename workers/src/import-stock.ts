/**
 * Конвертирует сгенерированные PNG в webp-сток:
 *   npx tsx src/import-stock.ts [dir]
 * Имена: stock-{RARITY}-{archetype}-{variant}.png
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const srcDir = resolve(process.argv[2] ?? `${root}/data/stock-src`);
const outDir = resolve(root, 'server/assets/portraits/stock');
const NAME = /^stock-(N|R|SR|SSR|UR)-([a-z_]+)-(\d+)\.(png|jpe?g|webp)$/i;

let n = 0;
for (const file of await readdir(srcDir)) {
  const m = NAME.exec(file);
  if (!m) continue;
  const rarity = m[1]!.toUpperCase();
  const archetype = m[2]!;
  const variant = m[3]!;
  const raw = await readFile(resolve(srcDir, file));
  const image = await sharp(raw).resize(768, 1024, { fit: 'cover', position: 'attention' }).webp({ quality: 82 }).toBuffer();
  const thumb = await sharp(image).resize(240, 320, { fit: 'cover' }).webp({ quality: 72 }).toBuffer();
  const dir = resolve(outDir, rarity);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, `${archetype}_${variant}.webp`), image);
  await writeFile(resolve(dir, `${archetype}_${variant}_thumb.webp`), thumb);
  n++;
  console.log(`+ ${rarity}/${archetype}_${variant}`);
}
console.log(`готово: ${n} портретов → ${outDir}`);
