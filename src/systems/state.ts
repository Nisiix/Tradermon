import type { SaveData, AssetClass, Track, RiskProfile, BiasId } from '../types';
import { emptyMarket } from './market';
import { newPortfolio } from './portfolio';
import { ANSWER_SECONDS, DIFFICULTY } from './balance';
import { ASSETS, ASSET_BY_ID } from '../data/assets';

export const SAVE_KEY = 'tradermon.save.v1';
const KEY = SAVE_KEY;
export const SLOTS_BY_BADGE = [3, 4, 5, 6, 6, 8, 8, 10, 10];

export const LIVE_LIMITS: { order: number; month: number; cOrder: number; cMonth: number }[] = [
  { order: 0, month: 0, cOrder: 0, cMonth: 0 },
  { order: 100, month: 300, cOrder: 50, cMonth: 150 },
  { order: 200, month: 600, cOrder: 100, cMonth: 300 },
  { order: 300, month: 1000, cOrder: 150, cMonth: 500 },
  { order: 500, month: 1500, cOrder: 250, cMonth: 750 },
  { order: 750, month: 2500, cOrder: 350, cMonth: 1200 },
  { order: 1000, month: 4000, cOrder: 500, cMonth: 2000 },
  { order: 1500, month: 6000, cOrder: 750, cMonth: 3000 },
  { order: 2500, month: 10000, cOrder: 1000, cMonth: 5000 },
];

export let S: SaveData = null as unknown as SaveData;

export function newGame(): SaveData {
  // identificativo breve della partita: marca gli ordini inviati ad Alpaca (client_order_id)
  const saveId = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  S = {
    version: SAVE_VERSION, createdAt: Date.now(), name: 'Alex', avatar: 0, rival: 'Leo', profile: 'equilibrato', profileScore: 3,
    goal: '', horizon: '', track: 'stocks', mixedClasses: [], map: 'home', x: 4, y: 4, facing: 'down', flags: {}, badges: 0, techniques: [],
    stats: { xp: 0, fiducia: 100, disciplina: 50, pazienza: 50, reputazione: 0 }, bias: null, biasSeen: [], cards: {}, lessonsRead: [], booksRead: [], tipsHeard: [], defeated: [], visited: ['t0'],
    portfolio: newPortfolio(DIFFICULTY.investitore.capital, 0, 'equilibrato'), market: emptyMarket(), saveId, difficulty: 'investitore', seals: 0, exDone: 0, exTools: { limit: false, stop: false }, levExam: false,
    lastSeen: { t: 0, value: 0 }, boss: { run: null, beaten: [], tries: {} }, review: {}, reviewDue: {}, answered: {}, daily: { lastDate: '', streak: 0 },
    tower: { best: 0 }, legends: [], stepCounter: 0, lastClinic: { map: 'home', x: 4, y: 4 }, license: 'apprendista', examLastFail: 0,
    liveLimits: { perOrder: 0, perMonth: 0, pauseUntil: 0, monthKey: '', spentThisMonth: 0 }, liveAudit: [], ngPlus: 0, playMs: 0,
    options: { textSpeed: 2, fontScale: 1, contrast: false, studyMode: false, volume: 0.5, music: 0.5, gfx: '3d', fx: 'alti' },
    counters: {}, agenda: { day: '', week: '', daily: [], weekly: [], dailyDone: 0 }, achievements: [], title: '', decor: [], rematch: {},
    quests: {}, journal: [], minigames: {}, challenges: [], npcMemory: {},
  };
  return S;
}

export function setState(s: SaveData) { S = s; }

export function hasSave(): boolean {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

// Il salvataggio vive su Supabase, legato al giocatore (nome + password): systems/sync.ts lo invia
// a ogni save(). Qui si scrive la copia di lavoro del dispositivo (localStorage), che permette di
// continuare anche senza rete e viene spedita appena la connessione torna.
let saveListener: (() => void) | null = null;
/** Chi deve sapere che c'è un nuovo salvataggio (la sincronizzazione con Supabase). */
export function setSaveListener(fn: (() => void) | null): void { saveListener = fn; }

let persistAsked = false;
function askPersistentStorage() {
  if (persistAsked) return;
  persistAsked = true;
  // chiede al browser di non cancellare i dati del sito quando lo spazio scarseggia
  try { void navigator.storage?.persist?.().catch(() => undefined); } catch { /* non supportato */ }
}

export function save(): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(S)); askPersistentStorage(); } catch { return false; }
  saveListener?.();
  return true;
}

export function load(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    S = migrate(JSON.parse(raw));
    return S;
  } catch { return null; }
}

/** Versione corrente del formato di salvataggio: ogni cambio di struttura aggiunge un passo in MIGRATIONS. */
export const SAVE_VERSION = 3;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Unisce in profondità: i campi mancanti (anche dentro portfolio, market, opzioni...) prendono il valore di base. */
function deepFill<T>(base: T, s: unknown): T {
  if (!isObj(base) || !isObj(s)) return (s === undefined || s === null ? base : s) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(s)) {
    const b = (base as Record<string, unknown>)[k];
    // i dizionari liberi (prezzi, flag, carte...) si copiano così come sono; le strutture note si completano
    out[k] = isObj(b) && isObj(v) && Object.keys(b).length ? deepFill(b, v) : v === undefined || v === null ? b : v;
  }
  return out as T;
}

/** Passi di migrazione: da versione n a n+1. */
const MIGRATIONS: Record<number, (s: SaveData) => void> = {
  // v1 → v2: ripasso con scadenze (ripetizione spaziata) e ordini con validità
  1: (s) => {
    s.reviewDue = s.reviewDue ?? {};
    // le domande già sapute tornano nel ripasso più avanti; quelle sbagliate restano in scadenza oggi
    const d = new Date();
    const key = (n: number) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    for (const [id, box] of Object.entries(s.review ?? {})) if (!s.reviewDue[id]) s.reviewDue[id] = box <= 1 ? key(0) : key(box === 2 ? 3 : 7);
    for (const o of s.portfolio?.orders ?? []) if (o.expiresDay === undefined) o.expiresDay = (o.createdDay ?? 0) + 20;
  },
  // v2 → v3: il gioco passa ai dati reali di Alpaca. I titoli inventati e il mercato simulato spariscono:
  // il conto di gioco riparte dal capitale della difficoltà Apprendista (la più indulgente), con il mercato vuoto
  // finché non si collega il conto Paper. Medaglie (ora Attestati), Tecniche, studio e storia restano.
  2: (s) => {
    const fresh = newPortfolio(DIFFICULTY.apprendista.capital, 0, s.profile);
    fresh.target = s.portfolio?.target ?? fresh.target;
    s.portfolio = fresh;
    s.difficulty = 'apprendista';
    s.market = emptyMarket();
    s.seals = 0; s.exDone = 0; s.exTools = { limit: false, stop: false }; s.levExam = false;
    s.lastSeen = { t: 0, value: 0 }; s.boss = { run: null, beaten: [], tries: {} };
    // le carte dei titoli inventati escono dall'Investidex; le leggende simulate non valgono più come replay reali
    for (const id of Object.keys(s.cards ?? {})) if (!ASSET_BY_ID[id]) delete s.cards[id];
    s.legends = [];
    if (s.flags.starter) s.flags.migratedV3 = true;
  },
};

export function migrate(raw: SaveData): SaveData {
  const s = deepFill(newGameShape(), raw);
  let v = Number(raw.version) || 1;
  while (v < SAVE_VERSION) { MIGRATIONS[v]?.(s); v++; }
  s.version = SAVE_VERSION;
  return s;
}
function newGameShape(): SaveData {
  const keep = S;
  const n = newGame();
  S = keep;
  return n;
}

/** Controlla la struttura minima di un salvataggio importato: evita che un file alterato blocchi il gioco. */
export function validSave(d: unknown): string | null {
  if (!isObj(d)) return 'il file non contiene un salvataggio';
  if (typeof d.version !== 'number' || d.version < 1 || d.version > SAVE_VERSION) return 'versione del salvataggio non riconosciuta';
  if (typeof d.name !== 'string' || typeof d.map !== 'string') return 'nome o posizione mancanti';
  if (typeof d.x !== 'number' || typeof d.y !== 'number') return 'coordinate non valide';
  const pf = d.portfolio;
  if (!isObj(pf) || typeof pf.cash !== 'number' || !Array.isArray(pf.positions)) return 'portafoglio non valido';
  if (pf.positions.some((p) => !isObj(p) || typeof p.id !== 'string' || typeof p.qty !== 'number')) return 'posizioni non valide';
  const mk = d.market;
  if (!isObj(mk) || !isObj(mk.prices) || !isObj(mk.history) || typeof mk.day !== 'number') return 'mercato non valido';
  if (d.flags !== undefined && !isObj(d.flags)) return 'flag non validi';
  for (const k of ['defeated', 'visited', 'techniques'] as const) if (d[k] !== undefined && !Array.isArray(d[k])) return `${k} non valido`;
  return null;
}

export function exportSave(): string {
  return JSON.stringify(S, null, 1);
}

export function importSave(text: string): boolean {
  try {
    const d = JSON.parse(text);
    if (validSave(d)) return false;
    S = migrate(d);
    save();
    return true;
  } catch { return false; }
}

// ---------------- Helper di gioco ----------------

export function level(xp = S.stats.xp): number {
  let n = 1;
  while (xp >= Math.round(50 * Math.pow(n, 1.5))) { xp -= Math.round(50 * Math.pow(n, 1.5)); n++; }
  return n;
}
export function xpToNext(): { cur: number; need: number } {
  let xp = S.stats.xp;
  let n = 1;
  while (xp >= Math.round(50 * Math.pow(n, 1.5))) { xp -= Math.round(50 * Math.pow(n, 1.5)); n++; }
  return { cur: xp, need: Math.round(50 * Math.pow(n, 1.5)) };
}

/** Capitale del conto di gioco fissato dalla difficoltà. */
export function capital(): number { return DIFFICULTY[S.difficulty].capital; }

export function slots(): number { return SLOTS_BY_BADGE[Math.min(8, S.badges)]; }
export function hasTech(t: string): boolean { return S.techniques.includes(t); }
export const TECH = { LIMIT: 'Ordine Limite', REBAL: 'Ribilanciamento', PAC: 'Piano di Accumulo', STOP: 'Stop Loss', COLD: 'Mente Fredda', TICKER: 'Lettura del Ticker', DRIP: 'Reinvestimento' };
export function hasArchiveTech(): boolean { return S.badges >= 5; }

export function classes(): AssetClass[] { return S.track === 'mixed' ? S.mixedClasses : [S.track as AssetClass]; }

export function clampStat(k: 'disciplina' | 'pazienza', d: number) {
  S.stats[k] = Math.max(0, Math.min(100, S.stats[k] + d));
}

export function addRep(d: number) { S.stats.reputazione = Math.max(0, Math.round(S.stats.reputazione + d)); }

export function card(id: string) {
  if (!S.cards[id]) S.cards[id] = { xp: 0, gold: false, flawless: true, seen: 0 };
  return S.cards[id];
}
export function cardLevel(id: string): number {
  const c = S.cards[id];
  if (!c) return 0;
  let lv = c.xp >= 150 ? 4 : c.xp >= 80 ? 3 : c.xp >= 30 ? 2 : 1;
  if (!hasTech(TECH.TICKER)) lv = Math.min(lv, 1);
  if (S.badges < 5) lv = Math.min(lv, 2);
  return lv;
}

export function unlockCard(id: string) { card(id); }

/** Segna un bias come conosciuto (Investidex). Non esistono più "stati alterati":
 *  nulla nel gioco cambia il patrimonio o le regole fuori dalle scelte del giocatore. */
export function learnBias(b: BiasId): void {
  if (!S.biasSeen.includes(b)) S.biasSeen.push(b);
}

/** Secondi per rispondere: uguali per tutti. Il profilo di rischio descrive chi sei, non dà vantaggi di gioco. */
export function profileTimer(): number {
  if (S.options.studyMode) return 0;
  return ANSWER_SECONDS;
}

export function newGamePlus(track: Track) {
  // il conto di gioco è reale e segue il giocatore: capitale, posizioni, difficoltà ed esercizi di tappa non ripartono
  const keep = { name: S.name, avatar: S.avatar, rival: S.rival, tower: S.tower, legends: S.legends, gold: Object.entries(S.cards).filter(([, c]) => c.gold), ng: S.ngPlus + 1, options: S.options, bankrupt: !!S.flags.bankrupt,
    portfolio: S.portfolio, market: S.market, saveId: S.saveId, difficulty: S.difficulty, exDone: S.exDone, levExam: S.levExam, boss: S.boss, license: S.license, liveLimits: S.liveLimits, liveAudit: S.liveAudit, createdAt: S.createdAt };
  newGame();
  Object.assign(S, { name: keep.name, avatar: keep.avatar, rival: keep.rival, tower: keep.tower, legends: keep.legends, ngPlus: keep.ng, options: keep.options, track,
    portfolio: keep.portfolio, market: keep.market, saveId: keep.saveId, difficulty: keep.difficulty, exDone: keep.exDone, levExam: keep.levExam, boss: keep.boss, license: keep.license, liveLimits: keep.liveLimits, liveAudit: keep.liveAudit, createdAt: keep.createdAt });
  keep.gold.forEach(([id, c]) => (S.cards[id] = c));
  // la parte pratica chiusa da una bancarotta definitiva resta chiusa: il conto è lo stesso
  if (keep.bankrupt) S.flags.bankrupt = true;
}

/** Profilo dichiarato dal punteggio delle 3 domande sul rischio (0-6). */
export function profileFromScore(score: number): RiskProfile {
  return score <= 1 ? 'prudente' : score <= 3 ? 'equilibrato' : 'audace';
}

export function allAssetIds(): string[] { return ASSETS.map((a) => a.id); }
