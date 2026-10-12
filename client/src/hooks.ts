import { useEffect, useState } from 'react';
import { censor, formatNumber, pickLine, type DecimalSource, type FlavorLine } from '@wl/shared';
import { liveResources, useStore } from './store';

/** Перерисовка 10 раз в секунду. */
export function useTicker(hz = 10): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
  return now;
}

export function useLive() {
  const state = useStore((s) => s.state);
  const receivedAt = useStore((s) => s.receivedAt);
  const now = useTicker();
  return state ? liveResources(state, receivedAt, now) : null;
}

export function useFmt(): (v: DecimalSource) => string {
  const notation = useStore((s) => s.settings.notation);
  return (v) => formatNumber(v, notation);
}

/** Текст с учётом режима мата: 0 — маскируем. */
export function useText(): (t: string) => string {
  const swear = useStore((s) => s.settings.swear);
  return (t) => (swear === 0 ? censor(t) : t);
}

export function useFlavor(): (lines: FlavorLine[], vars?: Record<string, string>) => string {
  const swear = useStore((s) => s.settings.swear);
  return (lines, vars) => {
    const t = pickLine(lines, swear, vars);
    return swear === 0 ? censor(t) : t;
  };
}
