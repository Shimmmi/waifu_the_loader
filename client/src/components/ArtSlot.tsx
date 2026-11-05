import { useEffect, useState } from 'react';

const BASE = import.meta.env.BASE_URL;

export const terminalMapUrl = () => `${BASE}terminal/map.webp`;
export const buildingArtUrl = (sector: string) => `${BASE}terminal/buildings/${sector}.webp`;
export const interiorArtUrl = (sector: string) => `${BASE}terminal/interiors/${sector}.webp`;

/** Картинка по фиксированному пути. Если файла нет, остаётся подпись, клик не ломается. */
export function ArtSlot({ src, alt, fit, className, label }: { src?: string; alt: string; fit: 'contain' | 'cover'; className?: string; label?: string }) {
  const [ok, setOk] = useState(Boolean(src));
  useEffect(() => setOk(Boolean(src)), [src]);
  if (!src || !ok) {
    return (
      <span className={`art-fallback ${className ?? ''}`} aria-hidden={!label}>
        {label ?? ''}
      </span>
    );
  }
  return <img src={src} alt={alt} className={className} style={{ objectFit: fit }} onError={() => setOk(false)} />;
}
