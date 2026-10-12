import sharp from 'sharp';
import { generateProceduralProfile, mulberry32, type Content, type EconomyConfig, type Rarity, type WaifuProfile } from '@wl/shared';

/** ТЗ 10.2: абстракция провайдеров. RouterAiProvider (M3) реализует оба интерфейса. */
export interface TextProvider {
  readonly name: string;
  generateProfile(req: { rarity: Rarity; archetype?: string; seed: number }): Promise<WaifuProfile>;
}

export interface ImageResult {
  image: Buffer;
  thumb: Buffer;
  contentType: string;
}

export interface ImageProvider {
  readonly name: string;
  generatePortrait(req: { profile: WaifuProfile; seed: number }): Promise<ImageResult>;
}

export class ProceduralTextProvider implements TextProvider {
  readonly name = 'procedural-text';
  constructor(
    private readonly content: Content,
    private readonly cfg: EconomyConfig,
  ) {}

  async generateProfile(req: { rarity: Rarity; archetype?: string; seed: number }): Promise<WaifuProfile> {
    return generateProceduralProfile(req, this.content, this.cfg);
  }
}

/**
 * Временный ImageProvider до M3: берёт базовый портрет архетипа и делает вариацию
 * (сдвиг оттенка, насыщенность, зеркало), затем постобработка — WebP + миниатюра.
 */
export class VariantImageProvider implements ImageProvider {
  readonly name = 'variant-image';
  constructor(private readonly loadBase: (archetype: string) => Promise<Buffer | null>) {}

  async generatePortrait(req: { profile: WaifuProfile; seed: number }): Promise<ImageResult> {
    const base = await this.loadBase(req.profile.archetype);
    if (!base) throw new Error(`no base portrait for ${req.profile.archetype}`);
    const rnd = mulberry32(req.seed ^ 0x9e3779b9);
    const hue = Math.floor(rnd() * 360);
    const saturation = 0.85 + rnd() * 0.35;
    const brightness = 0.95 + rnd() * 0.1;
    let img = sharp(base).modulate({ hue, saturation, brightness });
    if (rnd() < 0.5) img = img.flop();
    const full = await img.resize(768, 1024, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
    const thumb = await sharp(full).resize(240, 320, { fit: 'cover' }).webp({ quality: 72 }).toBuffer();
    return { image: full, thumb, contentType: 'image/webp' };
  }
}
