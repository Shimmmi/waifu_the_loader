import sharp from 'sharp';
import { generateProceduralProfile, mulberry32, pickStock, type Content, type EconomyConfig, type Rarity, type WaifuProfile } from '@wl/shared';

/** ТЗ 10.2: абстракция провайдеров. RouterAiProvider (M3) реализует оба интерфейса. */
export interface TextProvider {
  readonly name: string;
  generateProfile(req: { rarity: Rarity; archetype?: string; seed: number }): Promise<WaifuProfile>;
}

export interface ImageResult {
  image: Buffer;
  thumb: Buffer;
  contentType: string;
  /** Если задан — файл уже лежит в Storage, refill не копирует его заново. */
  reuse?: { portrait: string; thumb: string };
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
 * Готовые портреты: 20 штук на редкость (2 на архетип). Для N/R — основной источник,
 * для SR/SSR/UR — запас, когда нет бюджета RouterAI. Зеркало по seed, без перекраски.
 */
export class StockImageProvider implements ImageProvider {
  readonly name = 'stock-image';
  constructor(private readonly load: (key: string) => Promise<Buffer | null>) {}

  async generatePortrait(req: { profile: WaifuProfile; seed: number }): Promise<ImageResult> {
    const stock = pickStock(req.profile.rarity, req.profile.archetype, req.seed);
    const stockP = await this.load(stock.portrait);
    const stockT = await this.load(stock.thumb);
    const portrait = stockP ?? (await this.load(`base/${req.profile.archetype}.webp`));
    const thumb = stockT ?? (await this.load(`base/${req.profile.archetype}_thumb.webp`));
    if (!portrait || !thumb) throw new Error(`no stock portrait for ${req.profile.rarity}/${req.profile.archetype}`);
    const reuse = stockP && stockT ? { portrait: stock.portrait, thumb: stock.thumb } : undefined;
    if (mulberry32(req.seed ^ 0x9e3779b9)() >= 0.5) return { image: portrait, thumb, contentType: 'image/webp', reuse };
    return {
      image: await sharp(portrait).flop().webp({ quality: 80 }).toBuffer(),
      thumb: await sharp(thumb).flop().webp({ quality: 72 }).toBuffer(),
      contentType: 'image/webp',
    };
  }
}

/** @deprecated используйте StockImageProvider */
export const VariantImageProvider = StockImageProvider;
