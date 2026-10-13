/** Короткие сигналы через WebAudio: без файлов и без автовоспроизведения до первого жеста. */

type Cue = 'win' | 'rare' | 'tick' | 'fail';

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(ac: AudioContext, freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'triangle') {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

export function playCue(cue: Cue) {
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime;
  if (cue === 'tick') tone(ac, 660, t, 0.08, 0.04, 'square');
  if (cue === 'fail') tone(ac, 180, t, 0.18, 0.05, 'sawtooth');
  if (cue === 'win') {
    tone(ac, 523, t, 0.12, 0.06);
    tone(ac, 659, t + 0.1, 0.16, 0.06);
  }
  if (cue === 'rare') {
    tone(ac, 523, t, 0.14, 0.07);
    tone(ac, 659, t + 0.12, 0.14, 0.07);
    tone(ac, 784, t + 0.24, 0.28, 0.08);
  }
}
