import { randomBytes, randomInt } from 'node:crypto';

/** Криптографический RNG ∈ [0, 1) с 53 битами точности (ТЗ 6). */
export function cryptoRandom(): number {
  const b = randomBytes(8);
  const hi = b.readUInt32BE(0) >>> 5;
  const lo = b.readUInt32BE(4) >>> 6;
  return (hi * 67108864 + lo) / 9007199254740992;
}

export function cryptoSeed(): number {
  return randomInt(1, 2 ** 31 - 1);
}
