// Effetti sonori chiptune generati con WebAudio (nessun file audio).
let ctx: AudioContext | null = null;
let vol = 0.5;

export function setVolume(v: number) { vol = v; }

function ac(): AudioContext | null {
  if (vol <= 0) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', delay = 0, gain = 0.06) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = c.currentTime + delay;
  g.gain.setValueAtTime(gain * vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export type Sfx = 'tick' | 'ok' | 'bad' | 'win' | 'lose' | 'bump' | 'door' | 'alert' | 'heal' | 'badge' | 'coin';

export function beep(s: Sfx) {
  switch (s) {
    case 'tick': tone(880, 0.03, 'square', 0, 0.025); break;
    case 'ok': tone(660, 0.06); tone(990, 0.08, 'square', 0.06); break;
    case 'bad': tone(220, 0.15, 'sawtooth'); break;
    case 'bump': tone(110, 0.06, 'square', 0, 0.04); break;
    case 'door': tone(330, 0.05); tone(440, 0.05, 'square', 0.05); break;
    case 'alert': tone(1200, 0.08); tone(1200, 0.08, 'square', 0.12); break;
    case 'coin': tone(988, 0.05); tone(1319, 0.12, 'square', 0.05); break;
    case 'heal': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', i * 0.12, 0.08)); break;
    case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', i * 0.13)); break;
    case 'lose': [392, 349, 311, 262].forEach((f, i) => tone(f, 0.2, 'triangle', i * 0.18, 0.08)); break;
    case 'badge': [784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => tone(f, 0.16, 'square', i * 0.12)); break;
  }
}
