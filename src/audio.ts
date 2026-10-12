// Tiny synthesized sound kit — no audio files, so the single-file build stays small.

type Key = 'sound' | 'music' | 'haptic';

const flags: Record<Key, boolean> = { sound: true, music: true, haptic: true };
try {
  const saved = JSON.parse(localStorage.getItem('beescrew_audio') ?? 'null');
  if (saved) Object.assign(flags, saved);
} catch { /* storage blocked: keep defaults */ }

let ctx: AudioContext | null = null;

/** Call from a user gesture: browsers only start audio after one. */
export function unlockAudio(): void {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slide = 0): void {
  if (!flags.sound || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** A short band-passed noise burst: clicks and pops. */
function noise(dur: number, freq: number, vol: number, delay = 0): void {
  if (!flags.sound || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 1.4;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(bp).connect(gain).connect(ctx.destination);
  src.start(t);
}

export const sfx = {
  /** "Pặc": the screw snaps out — a crisp click over a short low thump. */
  pop(k: number): void {
    noise(0.03, 2400 + Math.min(k, 12) * 80, 0.18);
    tone(180, 0.08, 'sine', 0.06, 0, 0.6);
    tone(820 * Math.pow(1.035, Math.min(k, 14)), 0.05, 'triangle', 0.035, 0.01, 1.3);
  },
  /** Grip: a tiny creak while the bee strains. */
  grip(): void { noise(0.06, 900, 0.04); },
  /** A bee comes home to the big hive. */
  home(): void { tone(1320, 0.05, 'sine', 0.035); },
  /** A hive is tapped and flies into a slot. */
  tap(): void { tone(520, 0.08, 'triangle', 0.08, 0, 1.6); },
  /** A bee pulls a screw out; the pitch climbs with the run. */
  unscrew(k: number): void { tone(900 * Math.pow(1.04, Math.min(k, 16)), 0.06, 'square', 0.025, 0, 1.4); tone(1400, 0.04, 'sine', 0.04, 0.03); },
  /** A block or plate falls off. */
  drop(): void { tone(180, 0.14, 'triangle', 0.09, 0, 0.6); tone(95, 0.18, 'sine', 0.08, 0.03); },
  /** A hive is done and flies home. */
  hive(): void { [659, 784, 988].forEach((f, i) => tone(f, 0.1, 'triangle', 0.08, i * 0.05)); },
  buzz(): void { tone(210, 0.18, 'sawtooth', 0.015, 0, 1.1); },
  win(): void { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.35, 'triangle', 0.16, i * 0.09)); },
  lose(): void { [440, 370, 311, 262].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.06, i * 0.14)); },
  booster(): void { tone(300, 0.4, 'sine', 0.15, 0, 3); tone(900, 0.25, 'triangle', 0.08, 0.1); },
  drill(): void { tone(1200, 0.3, 'sawtooth', 0.03, 0, 1.5); },
  smash(): void { tone(120, 0.2, 'square', 0.08, 0, 0.5); tone(70, 0.25, 'triangle', 0.1, 0.02); },
  warn(): void { tone(660, 0.08, 'square', 0.05); tone(660, 0.08, 'square', 0.05, 0.12); },
  click(): void { tone(900, 0.04, 'triangle', 0.06); },
};

export function haptic(ms: number): void {
  if (flags.haptic && 'vibrate' in navigator) {
    try { navigator.vibrate(ms); } catch { /* not allowed */ }
  }
}

export const audio = {
  set(key: Key, on: boolean): void {
    flags[key] = on;
    try { localStorage.setItem('beescrew_audio', JSON.stringify(flags)); } catch { /* ignore */ }
  },
  get(key: Key): boolean { return flags[key]; },
};
