import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/**
 * Хранилище портретов (ТЗ 0.2). Сейчас — папка на диске VPS, раздаётся Nginx.
 * Замена на S3 + CDN — новая реализация этого интерфейса без правок игровой логики.
 */
export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
  publicUrl(key: string): string;
}

export class LocalDiskStorage implements Storage {
  constructor(
    private readonly root: string,
    private readonly baseUrl: string,
  ) {}

  private path(key: string): string {
    const p = resolve(this.root, key);
    if (!p.startsWith(this.root)) throw new Error('Invalid storage key');
    return p;
  }

  async put(key: string, data: Buffer): Promise<string> {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
    return this.publicUrl(key);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.path(key));
    } catch {
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.path(key));
      return true;
    } catch {
      return false;
    }
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}
