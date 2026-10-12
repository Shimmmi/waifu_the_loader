/**
 * Сравнение вариантов стиля портретов: каждый стиль × каждый персонаж с одинаковым seed.
 *   npx tsx src/style-test.ts [model]
 * Результат: data/ai-test/styles/<style>__<char>.webp и общий лист sheet.jpg.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { DEFAULT_AI_SETTINGS, extractJson, moderationVerdict, ModerationSchema } from '@wl/shared';
import { logAiCall } from '../../server/src/ai-store.js';
import { sql } from '../../server/src/db.js';
import { env } from '../../server/src/env.js';
import { RouterAiClient } from './routerai.js';

const STYLES: Record<string, string> = {
  A_tv:
    'Modern TV anime style, like a frame from a seasonal anime series. Simple cel shading with one shadow tone, clean bold outlines, flat bright colors, expressive anime eyes. Simplified background with few details, soft even lighting.',
  B_gacha:
    'Clean mobile gacha game character splash art. Crisp thin lineart, soft anime shading, bright saturated colors, glossy anime eyes. Simple gradient background with only a couple of props, character is the clear focus.',
  C_retro:
    '1990s retro anime cel style, hand-painted cel look, flat colors with hard-edged shadows, slightly muted palette, simple painted background, light film grain.',
  D_flat:
    'Flat-color anime illustration, thick clean outlines, almost no shading, simple shapes, limited color palette, plain solid-color background with a minimal hint of the setting, sticker-like readability.',
};

const CHARS: Record<string, string> = {
  goth:
    'Adult woman in her late twenties, pale skin, long straight black hair with blunt bangs, dark eyeliner, black hoodie and black jeans, silver choker, calm deadpan expression, carrying a large black wardrobe on her back with straps through a night city street.',
  beach:
    'Adult woman around thirty, tanned athletic build, short messy orange hair, big confident grin, sporty two-piece swimsuit with board shorts, sunglasses pushed up on her head, carrying a full-size red vending machine on one shoulder along a sunny beach.',
};

const ADULT = 'The character is an adult woman, 21 or older, with a mature adult face and adult body proportions. SFW, non-sexualized pose.';
const NEG = 'child, kid, teen, loli, schoolgirl, childlike face, baby face, chibi, nudity, lingerie, sexualized pose, text, letters, watermark, logo, real person likeness';

const model = process.argv[2] ?? DEFAULT_AI_SETTINGS.image.model;
const out = resolve(process.cwd(), '..', 'data', 'ai-test', 'styles');
mkdirSync(out, { recursive: true });
const client = new RouterAiClient(env.routerai);
const tiles: { file: string; label: string }[] = [];
let total = 0;

for (const [sid, style] of Object.entries(STYLES)) {
  for (const [cid, ch] of Object.entries(CHARS)) {
    const prompt = `${style}\nVertical full-body character card art.\nCharacter: ${ch}\n${ADULT}\nAvoid: ${NEG}.`;
    const t0 = Date.now();
    try {
      const r = await client.image(model, prompt, { aspectRatio: '3:4', seed: 4242, timeoutSec: 180 });
      total += r.costRub;
      await logAiCall({ kind: 'image', purpose: 'test', model: r.model, ok: true, costRub: r.costRub, durationMs: r.durationMs });
      const file = resolve(out, `${sid}__${cid}.webp`);
      await sharp(r.value).resize(768, 1024, { fit: 'cover', position: 'attention' }).webp({ quality: 86 }).toFile(file);
      let verdict = '';
      if (cid === 'beach') {
        const m = await client.chat(
          DEFAULT_AI_SETTINGS.moderation.model,
          [{ role: 'user', content: [{ type: 'text', text: DEFAULT_AI_SETTINGS.moderation.prompt }, { type: 'image_url', image_url: { url: `data:image/webp;base64,${(await sharp(file).toBuffer()).toString('base64')}` } }] }],
          { json: true, maxTokens: 600, timeoutSec: 60 },
        );
        total += m.costRub;
        await logAiCall({ kind: 'moderation', purpose: 'test', model: m.model, ok: true, costRub: m.costRub, durationMs: m.durationMs });
        const v = moderationVerdict(ModerationSchema.parse(extractJson(m.value)));
        verdict = ` mod=${v.verdict}${v.reasons.length ? ` (${v.reasons.join(',')})` : ''}`;
      }
      console.log(`${sid} ${cid}: ${r.costRub.toFixed(2)} ₽ ${((Date.now() - t0) / 1000).toFixed(0)} s${verdict}`);
      tiles.push({ file, label: `${sid} / ${cid}` });
    } catch (e) {
      console.log(`${sid} ${cid}: FAIL ${(e as Error).message}`);
    }
  }
}

const W = 384;
const H = 512;
const cols = Object.keys(CHARS).length;
const rows = Math.ceil(tiles.length / cols);
const comps = await Promise.all(
  tiles.map(async (t, i) => {
    const label = Buffer.from(`<svg width="${W}" height="34"><rect width="100%" height="100%" fill="black" opacity="0.7"/><text x="10" y="24" font-size="20" font-family="sans-serif" fill="white">${t.label}</text></svg>`);
    const img = await sharp(t.file).resize(W, H).composite([{ input: label, top: 0, left: 0 }]).toBuffer();
    return { input: img, left: (i % cols) * W, top: Math.floor(i / cols) * H };
  }),
);
await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#111' } })
  .composite(comps)
  .jpeg({ quality: 82 })
  .toFile(resolve(out, 'sheet.jpg'));
writeFileSync(resolve(out, 'styles.json'), JSON.stringify({ model, styles: STYLES, chars: CHARS }, null, 2));
console.log(`total ${total.toFixed(2)} ₽`);
await sql.end();
