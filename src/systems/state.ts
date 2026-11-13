import type { SaveData, AssetClass, Track, RiskProfile, BiasId } from '../types';
import { emptyMarket } from './market';
import { newPortfolio } from './portfolio';
import { ANSWER_SECONDS, DIFFICULTY } from './balance';
import { ASSETS, ASSET_BY_ID, classesOf, unlockedAssets } from '../data/assets';
import { T } from '../i18n';

export const SAVE_KEY = 'tradermon.save.v1';
const KEY = SAVE_KEY;
export const SLOTS_BY_BADGE = [3, 4, 5, 6, 6, 8, 8, 10, 10];

export let S: SaveData = null as unknown as SaveData;

export function newGame(): SaveData {
  // identificativo breve della partita: marca gli ordini inviati ad Alpaca (client_order_id)
  const saveId = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  S = {
    version: SAVE_VERSION, createdAt: Date.now(), name: 'Alex', avatar: 0, gender: 'm', rival: 'Leo', profile: 'equilibrato', profileScore: 3,
    goal: '', horizon: '', track: 'listed', mixedClasses: [], map: 'home', x: 4, y: 4, facing: 'down', flags: {}, badges: 0, techniques: [],
    stats: { xp: 0, fiducia: 100, disciplina: 50, pazienza: 50, reputazione: 0 }, bias: null, biasSeen: [], cards: {}, lessonsRead: [], booksRead: [], tipsHeard: [], defeated: [], visited: ['t0'],
    portfolio: newPortfolio(DIFFICULTY.investitore.capital, 0, 'equilibrato'), market: emptyMarket(), saveId, difficulty: 'investitore', seals: 0, exDone: 0, exTools: { limit: false, stop: false }, levExam: false,
    lastSeen: { t: 0, value: 0 }, boss: { run: null, beaten: [], tries: {} }, review: {}, reviewDue: {}, answered: {}, daily: { lastDate: '', streak: 0 },
    tower: { best: 0 }, legends: [], stepCounter: 0, lastClinic: { map: 'home', x: 4, y: 4 }, ngPlus: 0, playMs: 0,
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
export const SAVE_VERSION = 4;

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
  // v3 → v4: tre Valigette. Titoli e Indici confluiscono in Azioni + ETF; il Sentiero Misto ha sempre tutte e tre le classi
  3: (s) => {
    const old = String(s.track);
    const mixed = Array.isArray(s.mixedClasses) ? s.mixedClasses : [];
    if (old === 'crypto') s.track = 'crypto';
    else if (old === 'mixed' && (mixed.length === 0 || mixed.includes('crypto'))) s.track = 'mixed';
    else s.track = 'listed';
    s.mixedClasses = [];
    // le classi aggiunte dal nuovo percorso entrano subito nell'Investidex, come dopo un Attestato (prima si comprano solo in Banca)
    const had: string[] = old === 'mixed' ? mixed : old === 'stocks' || old === 'etf' || old === 'crypto' ? [old] : classesOf(s.track);
    if (s.flags?.starter && s.badges >= 1) for (const a of unlockedAssets(s.track, [], s.badges)) if (!had.includes(a.cls) && !s.cards[a.id]) s.cards[a.id] = { xp: 0, gold: false, flawless: true, seen: 0 };
    // la tecnica della quinta Whale del vecchio Sentiero degli Indici prende il nome di quella del nuovo percorso
    if (old === 'etf') s.techniques = (s.techniques ?? []).map((t) => (t === 'Analisi del Prospetto' ? 'Lettura del Bilancio' : t === 'Prospectus Analysis' ? 'Balance Sheet Reading' : t));
  },
};

export function migrate(raw: SaveData): SaveData {
  const s = deepFill(newGameShape(), raw);
  let v = Number(raw.version) || 1;
  while (v < SAVE_VERSION) { MIGRATIONS[v]?.(s); v++; }
  s.version = SAVE_VERSION;
  dropObsolete(s);
  return s;
}

/**
 * Campi che le versioni precedenti salvavano e che il gioco non usa più: Tradermon usa solo il conto Paper, con
 * denaro finto, quindi ogni dato di un conto diverso esce dal salvataggio.
 */
const OBSOLETE = ['license', 'examLastFail', 'liveLimits', 'liveAudit'];
const OBSOLETE_FLAGS = ['liveBase', 'liveBust', 'liveClosed', 'liveBusts'];
function dropObsolete(s: SaveData) {
  const rec = s as unknown as Record<string, unknown>;
  for (const k of OBSOLETE) delete rec[k];
  for (const k of OBSOLETE_FLAGS) delete s.flags[k];
  s.journal = (s.journal ?? []).filter((j) => j.account === 'prova' || j.account === 'paper');
  s.achievements = (s.achievements ?? []).filter((a) => a !== 'license');
  s.decor = (s.decor ?? []).filter((d) => d !== 'frame_license');
  if (s.title === 'Abilitato') s.title = '';
}
function newGameShape(): SaveData {
  const keep = S;
  const n = newGame();
  S = keep;
  return n;
}

/** Controlla la struttura minima di un salvataggio importato: evita che un file alterato blocchi il gioco. */
export function validSave(d: unknown): string | null {
  if (!isObj(d)) return T('il file non contiene un salvataggio');
  if (typeof d.version !== 'number' || d.version < 1 || d.version > SAVE_VERSION) return T('versione del salvataggio non riconosciuta');
  if (typeof d.name !== 'string' || typeof d.map !== 'string') return T('nome o posizione mancanti');
  if (typeof d.x !== 'number' || typeof d.y !== 'number') return T('coordinate non valide');
  const pf = d.portfolio;
  if (!isObj(pf) || typeof pf.cash !== 'number' || !Array.isArray(pf.positions)) return T('portafoglio non valido');
  if (pf.positions.some((p) => !isObj(p) || typeof p.id !== 'string' || typeof p.qty !== 'number')) return T('posizioni non valide');
  const mk = d.market;
  if (!isObj(mk) || !isObj(mk.prices) || !isObj(mk.history) || typeof mk.day !== 'number') return T('mercato non valido');
  if (d.flags !== undefined && !isObj(d.flags)) return T('flag non validi');
  for (const k of ['defeated', 'visited', 'techniques'] as const) if (d[k] !== undefined && !Array.isArray(d[k])) return T`${k} non valido`;
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
export const TECH = { LIMIT: T('Ordine Limite'), REBAL: T('Ribilanciamento'), PAC: T('Piano di Accumulo'), STOP: T('Stop Loss'), COLD: T('Mente Fredda'), TICKER: T('Lettura del Ticker'), DRIP: T('Reinvestimento') };
export function hasArchiveTech(): boolean { return S.badges >= 5; }

export function classes(): AssetClass[] { return classesOf(S.track, S.mixedClasses); }

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

/**
 * Nuova Partita+: tutto riparte da zero (conto di gioco con capitale nuovo, Attestati, Sigilli, Prove sul conto,
 * Esame della Leva, storia, accesso a Torre e Boss), tranne i TROFEI già guadagnati e ciò che riguarda il giocatore
 * e non la partita: nome e aspetto, opzioni, tempo di gioco.
 * La nuova difficoltà si sceglie subito dopo, e da qui in poi è disponibile anche la più alta.
 */
export function newGamePlus(track: Track) {
  const old = S;
  newGame();
  Object.assign(S, {
    // chi sei
    name: old.name, avatar: old.avatar, gender: old.gender, rival: old.rival, options: old.options, track, createdAt: old.createdAt, playMs: old.playMs,
    profile: old.profile, profileScore: old.profileScore, goal: old.goal, horizon: old.horizon,
    ngPlus: old.ngPlus + 1,
    // trofei
    tower: old.tower, legends: old.legends, achievements: old.achievements, title: old.title, decor: old.decor,
    challenges: old.challenges, minigames: old.minigames, daily: old.daily, journal: old.journal,
    boss: { run: null, runs: {}, beaten: old.boss.beaten, tries: old.boss.tries },
  });
  Object.entries(old.cards).filter(([, c]) => c.gold).forEach(([id, c]) => (S.cards[id] = c));
}

/** Profilo dichiarato dal punteggio delle 3 domande sul rischio (0-6). */
export function profileFromScore(score: number): RiskProfile {
  return score <= 1 ? 'prudente' : score <= 3 ? 'equilibrato' : 'audace';
}

export function allAssetIds(): string[] { return ASSETS.map((a) => a.id); }
