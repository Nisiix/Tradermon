// Musica originale di Tradermon, generata in codice con Web Audio (nessun file audio).
// Tre voci: melodia, basso (triangolo) e percussioni (rumore). Le melodie sono composte per questo gioco.
// Due famiglie di brani, perché si senta subito dove sei:
// - esplorazione (città, percorsi, interni, notte, grotte, titolo): melodia morbida (triangolo o sinusoide)
//   un'ottava più in basso, tempi calmi, quasi niente charleston;
// - sfida (duelli, Exchange, Wall Street): minore, più veloce, melodia "di ottoni" (dente di sega filtrato)
//   con un basso che spinge. Calda, non stridente: il filtro taglia gli acuti.
// Tutta la musica passa da un filtro passa-basso, così niente fischia. Con il mercato in ribasso i brani
// in maggiore passano al minore e rallentano; con il rialzo accelerano un poco.

export type TrackId = 'title' | 'town' | 'route' | 'interior' | 'academy' | 'battle' | 'league' | 'night' | 'cave_gold' | 'cave_dp' | 'cave_pearl';
export type Mood = 'toro' | 'orso' | 'laterale' | 'tempesta';

interface Track {
  bpm: number;
  key: number; // semitoni rispetto a Do
  minor?: boolean; // scritto già in minore: non va convertito
  lead: string[]; // battute da 16 sedicesimi; "." prolunga, "_" pausa
  chords: string[]; // una sigla per battuta: C, Am, F, G, E...
  bass: 'walk' | 'drive' | 'soft';
  drums: string; // 16 passi: k cassa, s rullante, h charleston, _ niente
  leadWave?: OscillatorType;
  /** Spostamento della melodia in semitoni (−12 = un'ottava sotto, come è scritta). */
  shift?: number;
  /** Taglio degli acuti della melodia, in Hz. */
  lp?: number;
  /** Brano di sfida: melodia di ottoni filtrata e attacco più deciso. */
  challenge?: boolean;
}

const T: Record<TrackId, Track> = {
  town: {
    bpm: 96, key: 0, bass: 'walk', drums: 'k_______s_______', leadWave: 'triangle', shift: -12, lp: 2200,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'],
    lead: [
      'E5 . G5 . C6 . B5 A5 G5 . . . E5 . D5 .',
      'C5 . E5 . A5 . G5 . E5 . . . C5 . D5 .',
      'F5 . A5 . C6 . A5 . G5 . F5 . E5 . D5 .',
      'D5 . F5 . B5 . A5 . G5 . . . _ _ _ _',
      'E5 . G5 . C6 . D6 . E6 . D6 . C6 . A5 .',
      'A5 . C6 . E6 . D6 . C6 . . . A5 . G5 .',
      'F5 . A5 . G5 . E5 . D5 . C5 . D5 . E5 .',
      'D5 . . . G4 . B4 . C5 . . . _ _ _ _',
    ],
  },
  title: {
    bpm: 90, key: 5, bass: 'soft', drums: 'k_______s_______', leadWave: 'triangle', shift: -12, lp: 2200,
    chords: ['C', 'G', 'Am', 'F'],
    lead: [
      'G5 . . . E5 . . . C6 . . . B5 . G5 .',
      'D5 . . . G5 . . . B5 . . . A5 . G5 .',
      'E5 . . . A5 . . . C6 . . . E6 . D6 .',
      'C6 . . . A5 . . . F5 . G5 . A5 . . .',
    ],
  },
  route: {
    bpm: 108, key: 7, bass: 'walk', drums: 'k___s___k___s__h', leadWave: 'triangle', shift: -12, lp: 2400,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
    lead: [
      'C5 . . E5 G5 . E5 . C6 . . . B5 . G5 .',
      'D5 . . G5 B5 . G5 . D6 . . . C6 . B5 .',
      'A5 . . C6 E6 . C6 . A5 . G5 . E5 . C5 .',
      'F5 . . A5 C6 . A5 . G5 . . . _ _ _ _',
      'C5 . E5 . G5 . C6 . E6 . D6 . C6 . G5 .',
      'B4 . D5 . G5 . B5 . D6 . C6 . B5 . G5 .',
      'A5 . C6 . F5 . A5 . E5 . G5 . C6 . E5 .',
      'D5 . . . G4 . . . B4 . D5 . G5 . . .',
    ],
  },
  interior: {
    bpm: 84, key: 5, bass: 'soft', drums: '________________', leadWave: 'sine', shift: -12, lp: 1800,
    chords: ['C', 'Am', 'Dm', 'G'],
    lead: [
      'G5 . . . E5 . . . C5 . D5 . E5 . . .',
      'A5 . . . E5 . . . C5 . . . _ _ _ _',
      'F5 . . . A5 . . . D6 . C6 . A5 . . .',
      'G5 . . . B4 . . . D5 . . . _ _ _ _',
    ],
  },
  academy: {
    bpm: 120, key: 2, minor: true, bass: 'drive', drums: 'k___s___k_k_s___', challenge: true, shift: -12, lp: 1500,
    chords: ['Am', 'G', 'F', 'E'],
    lead: [
      'E5 . A5 . C6 . B5 . A5 . . . E5 . . .',
      'D5 . G5 . B5 . A5 . G5 . . . D5 . . .',
      'C5 . F5 . A5 . G5 . F5 . E5 . D5 . C5 .',
      'B4 . E5 . G#5 . B5 . E6 . . . _ _ _ _',
    ],
  },
  battle: {
    bpm: 138, key: 0, minor: true, bass: 'drive', drums: 'k_h_s_h_k_k_s_h_', challenge: true, shift: -12, lp: 1600,
    chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E'],
    lead: [
      'A5 . A5 _ C6 . A5 _ E6 . D6 . C6 . B5 .',
      'A5 . . . E5 . A5 . C6 . B5 . A5 . G5 .',
      'F5 . A5 . C6 . F6 . E6 . C6 . A5 . F5 .',
      'G5 . B5 . D6 . G6 . F6 . D6 . B5 . G5 .',
      'A5 . C6 . E6 . A6 . G6 . E6 . C6 . A5 .',
      'E6 . D6 . C6 . B5 . A5 . G5 . A5 . B5 .',
      'C6 . . . A5 . . . F5 . A5 . C6 . F6 .',
      'E6 . . . G#5 . . . B5 . . . E6 . . .',
    ],
  },
  league: {
    bpm: 116, key: 5, minor: true, bass: 'drive', drums: 'k___s___k_k_s___', challenge: true, shift: -12, lp: 1500,
    chords: ['Am', 'F', 'C', 'E'],
    lead: [
      'A4 . . . E5 . . . A5 . . . G5 . E5 .',
      'F5 . . . D5 . . . A4 . . . _ _ _ _',
      'C5 . . . G5 . . . C6 . . . B5 . G5 .',
      'E5 . . . G#5 . . . B5 . . . E6 . . .',
    ],
  },
  night: {
    bpm: 76, key: 3, bass: 'soft', drums: '________________', leadWave: 'sine', shift: -12, lp: 1600,
    chords: ['Am', 'F', 'C', 'G'],
    lead: [
      'E5 . . . . . A5 . . . G5 . E5 . . .',
      'F5 . . . . . C5 . . . _ _ _ _ _ _',
      'G5 . . . . . E5 . . . C6 . . . . .',
      'B5 . . . A5 . G5 . . . _ _ _ _ _ _',
    ],
  },
  // Grotte: tre brani lenti in minore, con molto silenzio. Miniera: passo di piccone e melodia che sale e ricade
  // (come le promesse); Dark Pool: poche note basse e sospese; Perle: arpeggi d'acqua.
  cave_gold: {
    bpm: 84, key: 2, minor: true, bass: 'walk', drums: 'k___________k___', leadWave: 'triangle', shift: -12, lp: 2000,
    chords: ['Am', 'Am', 'F', 'E', 'Am', 'G', 'F', 'E'],
    lead: [
      'A4 . . . C5 . E5 . . . D5 . C5 . . .',
      'E5 . . . . . C5 . A4 . . . _ _ _ _',
      'F5 . . . A5 . C6 . . . A5 . F5 . . .',
      'E5 . . . G#5 . B5 . . . . . _ _ _ _',
      'A5 . . . E5 . C5 . A5 . G5 . E5 . . .',
      'G5 . . . D5 . B4 . G5 . . . _ _ _ _',
      'F5 . . . C5 . A4 . D5 . C5 . A4 . . .',
      'E5 . . . . . G#4 . B4 . . . _ _ _ _',
    ],
  },
  cave_dp: {
    bpm: 72, key: 10, minor: true, bass: 'soft', drums: '________________', leadWave: 'triangle', shift: -12, lp: 1800,
    chords: ['Am', 'F', 'Dm', 'E'],
    lead: [
      'A4 . . . . . . . E5 . . . . . D#5 .',
      'F5 . . . . . . . C5 . . . _ _ _ _',
      'D5 . . . . . . . A4 . . . F5 . . .',
      'E5 . . . . . G#4 . . . . . _ _ _ _',
    ],
  },
  cave_pearl: {
    bpm: 80, key: 5, minor: true, bass: 'soft', drums: '________________', leadWave: 'sine', shift: -12, lp: 2000,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'],
    lead: [
      'A4 C5 E5 A5 . . E5 . C5 . E5 . A5 . . .',
      'F4 A4 C5 F5 . . C5 . A4 . C5 . F5 . . .',
      'C5 E5 G5 C6 . . G5 . E5 . G5 . C6 . . .',
      'G4 B4 D5 G5 . . D5 . B4 . . . _ _ _ _',
      'A5 . E5 . C5 . E5 . A5 . . . C6 . B5 .',
      'A5 . F5 . C5 . F5 . A5 . . . G5 . F5 .',
      'D5 F5 A5 D6 . . A5 . F5 . D5 . F5 . . .',
      'E5 . . . G#5 . . . B5 . . . _ _ _ _',
    ],
  },
};

const JINGLES: Record<'win' | 'badge' | 'quest' | 'secret', string> = {
  win: 'C5 E5 G5 C6 . G5 C6 . E6 . . . _ _ _ _',
  badge: 'G5 . C6 . E6 . G6 . . . E6 G6 . . . .',
  quest: 'E5 G5 C6 . . . _ _',
  secret: 'A4 E5 A5 . G#5 . E5 . B5 . . . _ _ _ _',
};

const NOTE: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function midi(n: string): number {
  const m = /^([A-G][#b]?)(\d)$/.exec(n);
  if (!m) return -1;
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
}
const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Da maggiore a minore naturale: abbassa terza, sesta e settima (Mi, La, Si in Do). */
function minorize(m: number): number {
  const pc = ((m % 12) + 12) % 12;
  return pc === 4 || pc === 9 || pc === 11 ? m - 1 : m;
}

const CHORD_ROOT: Record<string, number> = { C: 0, Dm: 2, D: 2, Em: 4, E: 4, F: 5, G: 7, Am: 9, A: 9, Bb: 10, B: 11 };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let musicVol = 0.5;
let current: TrackId | null = null;
let wanted: TrackId | null = null;
let mood: Mood = 'laterale';
let step = 0;
let nextTime = 0;
let timer = 0;
let ducked = false;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      master = ctx.createGain();
      // filtro generale: toglie gli acuti più fastidiosi a tutta la musica
      const soft = ctx.createBiquadFilter();
      soft.type = 'lowpass'; soft.frequency.value = 4200; soft.Q.value = 0.5;
      master.connect(soft).connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function applyGain() {
  if (master && ctx) master.gain.setTargetAtTime(musicVol * (ducked ? 0.35 : 1) * 0.5, ctx.currentTime, 0.05);
}

export function setMusicVolume(v: number) {
  musicVol = v;
  applyGain();
  if (v <= 0) stop(); else if (wanted && !current) play(wanted);
}

/** Abbassa la musica durante i jingle e i dialoghi importanti. */
export function duck(on: boolean) { ducked = on; applyGain(); }

export function setMood(m: Mood) { mood = m; }

/** Una nota: attacco morbido (o deciso), leggero calo e coda breve; con `lp` passa da un filtro passa-basso. */
function voice(c: AudioContext, f: number, t: number, dur: number, type: OscillatorType, gain: number, lp?: number, attack = 0.01) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  const a = Math.min(attack, dur / 3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + a);
  g.gain.linearRampToValueAtTime(gain * 0.7, t + Math.max(a + 0.01, dur * 0.6));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  let out: AudioNode = o;
  if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = 0.7; out = o.connect(fl); }
  out.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function drum(c: AudioContext, kind: string, t: number) {
  if (kind === 'k') {
    const o = c.createOscillator(); const g = c.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.38, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(master!); o.start(t); o.stop(t + 0.16);
    return;
  }
  if (!noise) return;
  const s = c.createBufferSource(); s.buffer = noise;
  // charleston e rullante piano e scuri: niente fruscio acuto
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = kind === 'h' ? 4500 : 1200; f.Q.value = kind === 'h' ? 1 : 0.8;
  const g = c.createGain(); const len = kind === 'h' ? 0.03 : 0.1;
  g.gain.setValueAtTime(kind === 'h' ? 0.05 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(f).connect(g).connect(master!); s.start(t); s.stop(t + len + 0.02);
}

function trackFor(id: TrackId) { return T[id]; }

function schedule() {
  const c = ctx;
  if (!c || !current) return;
  const tr = trackFor(current);
  const minor = !tr.minor && (mood === 'orso' || mood === 'tempesta');
  const tempo = tr.bpm * (mood === 'orso' ? 0.9 : mood === 'toro' ? 1.05 : 1);
  const sec = 60 / tempo / 4;
  const bars = tr.lead.length;
  while (nextTime < c.currentTime + 0.15) {
    const bar = Math.floor(step / 16) % bars, pos = step % 16;
    const tokens = tr.lead[bar].trim().split(/\s+/);
    const tok = tokens[pos] ?? '_';
    const tf = (m: number) => freq((minor ? minorize(m) : m) + tr.key);
    // melodia: morbida nell'esplorazione, di ottoni filtrati nelle sfide (con un'eco un'ottava sotto)
    const m = midi(tok);
    if (m > 0) {
      let len = 1;
      while (pos + len < 16 && tokens[pos + len] === '.') len++;
      const n = m + (tr.shift ?? 0), dur = sec * len * 0.92;
      if (tr.challenge) {
        voice(c, tf(n), nextTime, dur, 'sawtooth', 0.07, tr.lp ?? 1500, 0.015);
        voice(c, tf(n - 12), nextTime, dur, 'triangle', 0.06, undefined, 0.015);
      } else voice(c, tf(n), nextTime, dur, tr.leadWave ?? 'triangle', tr.leadWave === 'sine' ? 0.13 : 0.11, tr.lp, 0.04);
    }
    // basso dagli accordi
    const ch = tr.chords[bar % tr.chords.length];
    const root = 36 + (CHORD_ROOT[ch] ?? 0) + 12;
    if (tr.bass === 'drive' && pos % 2 === 0) voice(c, tf(root - 12 + (pos % 4 === 2 ? 12 : 0)), nextTime, sec * 1.6, 'triangle', 0.16);
    if (tr.bass === 'walk' && pos % 4 === 0) voice(c, tf(root - 12 + [0, 12, 7, 12][pos / 4]), nextTime, sec * 3.4, 'triangle', 0.16);
    if (tr.bass === 'soft' && pos % 8 === 0) voice(c, tf(root - 12 + (pos === 8 ? 7 : 0)), nextTime, sec * 7.5, 'triangle', 0.14);
    // percussioni (con la tempesta la cassa raddoppia)
    const d = tr.drums[pos];
    if (d && d !== '_') drum(c, d, nextTime);
    if (mood === 'tempesta' && pos % 4 === 2) drum(c, 'k', nextTime);
    nextTime += sec;
    step++;
  }
}

/** Avvia un brano (se è già in corso non lo ricomincia). */
export function play(id: TrackId) {
  wanted = id;
  if (musicVol <= 0) return;
  if (current === id) return;
  const c = audio();
  if (!c) return;
  current = id;
  step = 0;
  nextTime = c.currentTime + 0.08;
  applyGain();
  clearInterval(timer);
  timer = window.setInterval(schedule, 25);
}

/** Il browser avvia l'audio solo dopo un gesto: al primo tasto o tocco riprende il brano richiesto. */
export function unlock() {
  const fn = () => {
    const c = audio();
    if (c && wanted && !current) play(wanted);
    if (c && c.state === 'running') { document.removeEventListener('keydown', fn); document.removeEventListener('pointerdown', fn); }
  };
  document.addEventListener('keydown', fn);
  document.addEventListener('pointerdown', fn);
}

export function stop() {
  clearInterval(timer);
  timer = 0;
  current = null;
}

export function currentTrack(): TrackId | null { return current ?? wanted; }

/** Breve motivo per vittorie, Medaglie e missioni: suona sopra la musica, che si abbassa. */
export function jingle(id: keyof typeof JINGLES) {
  const c = audio();
  if (!c || musicVol <= 0) return;
  duck(true);
  const sec = 0.11;
  const tokens = JINGLES[id].split(/\s+/);
  let t = c.currentTime + 0.05;
  tokens.forEach((tok, i) => {
    const m = midi(tok);
    if (m > 0) {
      let len = 1;
      while (tokens[i + len] === '.') len++;
      voice(c, freq(m - 12), t, sec * len, 'triangle', 0.13, 2400, 0.02);
      voice(c, freq(m - 24), t, sec * len, 'sine', 0.1, undefined, 0.02);
    }
    t += sec;
  });
  setTimeout(() => duck(false), tokens.length * sec * 1000 + 200);
}

/** Brano adatto alla mappa. */
export function trackForMap(id: string, interior: boolean, night: boolean): TrackId {
  if (id === 'league' || id === 'tower') return 'league';
  if (id.startsWith('academy')) return 'academy';
  // ogni grotta ha il suo brano, su entrambi i livelli
  if (id.startsWith('cave_gold')) return 'cave_gold';
  if (id.startsWith('cave_dp')) return 'cave_dp';
  if (id.startsWith('cave_pearl')) return 'cave_pearl';
  if (interior) return 'interior';
  if (/^r\d/.test(id)) return night ? 'night' : 'route';
  return night ? 'night' : 'town';
}

/** Tutti i brani, per i test (ogni battuta deve avere 16 passi). */
export { T as TRACKS };
