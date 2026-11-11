// Musica originale di Tradermon, generata in codice con Web Audio (nessun file audio).
// Tre voci in stile chiptune: melodia (onda quadra), basso (triangolo) e percussioni (rumore).
// Le melodie sono composte per questo gioco. Con il mercato in ribasso i brani in maggiore
// passano al minore e rallentano; con il rialzo accelerano un poco.

export type TrackId = 'title' | 'town' | 'route' | 'interior' | 'academy' | 'battle' | 'league' | 'night';
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
}

const T: Record<TrackId, Track> = {
  town: {
    bpm: 112, key: 0, bass: 'walk', drums: 'k_h_s_h_k_h_s_hh',
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
    bpm: 100, key: 5, bass: 'soft', drums: 'k_______s_______',
    chords: ['C', 'G', 'Am', 'F'],
    lead: [
      'G5 . . . E5 . . . C6 . . . B5 . G5 .',
      'D5 . . . G5 . . . B5 . . . A5 . G5 .',
      'E5 . . . A5 . . . C6 . . . E6 . D6 .',
      'C6 . . . A5 . . . F5 . G5 . A5 . . .',
    ],
  },
  route: {
    bpm: 132, key: 7, bass: 'drive', drums: 'k_hhs_hhk_hhs_hk',
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
    bpm: 92, key: 5, bass: 'soft', drums: '____h_______h___', leadWave: 'triangle',
    chords: ['C', 'Am', 'Dm', 'G'],
    lead: [
      'G5 . . . E5 . . . C5 . D5 . E5 . . .',
      'A5 . . . E5 . . . C5 . . . _ _ _ _',
      'F5 . . . A5 . . . D6 . C6 . A5 . . .',
      'G5 . . . B4 . . . D5 . . . _ _ _ _',
    ],
  },
  academy: {
    bpm: 120, key: 2, minor: true, bass: 'drive', drums: 'k_h_s_h_k_k_s_h_',
    chords: ['Am', 'G', 'F', 'E'],
    lead: [
      'E5 . A5 . C6 . B5 . A5 . . . E5 . . .',
      'D5 . G5 . B5 . A5 . G5 . . . D5 . . .',
      'C5 . F5 . A5 . G5 . F5 . E5 . D5 . C5 .',
      'B4 . E5 . G#5 . B5 . E6 . . . _ _ _ _',
    ],
  },
  battle: {
    bpm: 152, key: 0, minor: true, bass: 'drive', drums: 'k_hhs_hhk_hhs_hk',
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
    bpm: 120, key: 5, minor: true, bass: 'walk', drums: 'k___s___k_k_s_hh',
    chords: ['Am', 'F', 'C', 'E'],
    lead: [
      'A4 . . . E5 . . . A5 . . . G5 . E5 .',
      'F5 . . . D5 . . . A4 . . . _ _ _ _',
      'C5 . . . G5 . . . C6 . . . B5 . G5 .',
      'E5 . . . G#5 . . . B5 . . . E6 . . .',
    ],
  },
  night: {
    bpm: 84, key: 3, bass: 'soft', drums: '________h_______', leadWave: 'triangle',
    chords: ['Am', 'F', 'C', 'G'],
    lead: [
      'E5 . . . . . A5 . . . G5 . E5 . . .',
      'F5 . . . . . C5 . . . _ _ _ _ _ _',
      'G5 . . . . . E5 . . . C6 . . . . .',
      'B5 . . . A5 . G5 . . . _ _ _ _ _ _',
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
      master.connect(ctx.destination);
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

function voice(c: AudioContext, f: number, t: number, dur: number, type: OscillatorType, gain: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.setValueAtTime(gain * 0.8, t + Math.max(0.02, dur - 0.04));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function drum(c: AudioContext, kind: string, t: number) {
  if (kind === 'k') {
    const o = c.createOscillator(); const g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(master!); o.start(t); o.stop(t + 0.16);
    return;
  }
  if (!noise) return;
  const s = c.createBufferSource(); s.buffer = noise;
  const f = c.createBiquadFilter(); f.type = kind === 'h' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'h' ? 7000 : 1800;
  const g = c.createGain(); const len = kind === 'h' ? 0.04 : 0.12;
  g.gain.setValueAtTime(kind === 'h' ? 0.12 : 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
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
    // melodia
    const m = midi(tok);
    if (m > 0) {
      let len = 1;
      while (pos + len < 16 && tokens[pos + len] === '.') len++;
      voice(c, tf(m), nextTime, sec * len * 0.92, tr.leadWave ?? 'square', 0.09);
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
      voice(c, freq(m), t, sec * len, 'square', 0.12);
      voice(c, freq(m - 12), t, sec * len, 'triangle', 0.12);
    }
    t += sec;
  });
  setTimeout(() => duck(false), tokens.length * sec * 1000 + 200);
}

/** Brano adatto alla mappa. */
export function trackForMap(id: string, interior: boolean, night: boolean): TrackId {
  if (id === 'league' || id === 'tower') return 'league';
  if (id.startsWith('academy')) return 'academy';
  if (interior) return 'interior';
  if (/^r\d/.test(id)) return night ? 'night' : 'route';
  return night ? 'night' : 'town';
}
