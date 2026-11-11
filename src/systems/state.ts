import type { SaveData, AssetClass, Track, RiskProfile, BiasId } from '../types';
import { createWorldMarket, advanceWorldMarket } from './market';
import { newPortfolio, value } from './portfolio';
import { ASSETS, ASSET_BY_ID } from '../data/assets';

const KEY = 'tradermon.save.v1';
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
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  S = {
    version: 1, createdAt: Date.now(), name: 'Alex', avatar: 0, rival: 'Leo', profile: 'equilibrato', profileScore: 5,
    goal: '', horizon: '', track: 'stocks', mixedClasses: [], map: 'home', x: 4, y: 4, facing: 'down', flags: {}, badges: 0, techniques: [],
    stats: { xp: 0, fiducia: 100, disciplina: 50, pazienza: 50, reputazione: 0 }, bias: null, biasSeen: [], cards: {}, lessonsRead: [], tipsHeard: [], defeated: [], visited: ['t0'],
    portfolio: newPortfolio(10000, 0, 'equilibrato'), market: createWorldMarket(seed), review: {}, answered: {}, daily: { lastDate: '', streak: 0 },
    tower: { best: 0 }, legends: [], stepCounter: 0, lastClinic: { map: 'home', x: 4, y: 4 }, license: 'apprendista', examLastFail: 0,
    liveLimits: { perOrder: 0, perMonth: 0, pauseUntil: 0, monthKey: '', spentThisMonth: 0 }, liveAudit: [], ngPlus: 0, playMs: 0,
    options: { textSpeed: 2, fontScale: 1, contrast: false, studyMode: false, volume: 0.5, music: 0.5 },
    counters: {}, agenda: { day: '', week: '', daily: [], weekly: [], dailyDone: 0 }, achievements: [], title: '', decor: [], rematch: {},
    quests: {}, journal: [], minigames: {}, challenges: [], npcMemory: {},
  };
  return S;
}

export function setState(s: SaveData) { S = s; }

export function hasSave(): boolean {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

// Il salvataggio vive solo in questo browser (localStorage, non sessionStorage): resta dopo la
// chiusura della scheda e del browser, non viene mai inviato a un server e non è visibile da
// altri dispositivi (per spostarlo si usa Esporta/Importa salvataggio).
let persistAsked = false;
function askPersistentStorage() {
  if (persistAsked) return;
  persistAsked = true;
  // chiede al browser di non cancellare i dati del sito quando lo spazio scarseggia
  try { void navigator.storage?.persist?.().catch(() => undefined); } catch { /* non supportato */ }
}

export function save(): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(S)); askPersistentStorage(); return true; } catch { return false; }
}

export function load(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    S = migrate(JSON.parse(raw));
    return S;
  } catch { return null; }
}

function migrate(s: SaveData): SaveData {
  const base = newGameShape();
  return { ...base, ...s, stats: { ...base.stats, ...s.stats }, options: { ...base.options, ...s.options }, agenda: { ...base.agenda, ...(s.agenda ?? {}) } };
}
function newGameShape(): SaveData {
  const keep = S;
  const n = newGame();
  S = keep;
  return n;
}

export function exportSave(): string {
  return JSON.stringify(S, null, 1);
}

export function importSave(text: string): boolean {
  try {
    const d = JSON.parse(text);
    if (!d || d.version !== 1 || !d.portfolio) return false;
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

export function profileTimer(): number {
  if (S.options.studyMode) return 0;
  const base = S.profile === 'prudente' ? 30 : S.profile === 'audace' ? 20 : 25;
  return base + Math.floor((level() - 1) / 5) * 5;
}

/** Avanza il mercato del mondo di n giorni, con ordini, dividendi e uova. */
export function advanceDays(n: number): string[] {
  const msgs: string[] = [];
  const pf = S.portfolio;
  for (let i = 0; i < n; i++) {
    advanceWorldMarket(S.market);
    const prices = S.market.prices;
    // dividendi mensili (ogni 21 giorni di mercato)
    if (S.market.day % 21 === 0) {
      for (const p of pf.positions) {
        const a = ASSET_BY_ID[p.id];
        if (a.dividend > 0) {
          const amt = (p.qty * prices[p.id] * a.dividend) / 12;
          if (pf.drip) {
            const hatch = S.market.day + (hasTech(TECH.DRIP) ? 1 : 3);
            pf.eggs.push({ asset: p.id, amount: amt, hatchDay: hatch });
          } else pf.cash += amt;
        }
        card(p.id).xp += 2;
      }
    }
    for (const egg of pf.eggs.slice()) {
      if (S.market.day >= egg.hatchDay) {
        const pos = pf.positions.find((p) => p.id === egg.asset);
        if (pos) { pos.qty += egg.amount / prices[egg.asset]; pos.cost += egg.amount; msgs.push(`Un uovo si è schiuso: +${(egg.amount / prices[egg.asset]).toFixed(4)} quote di ${ASSET_BY_ID[egg.asset].ticker} grazie al dividendo reinvestito!`); }
        else pf.cash += egg.amount;
        pf.eggs = pf.eggs.filter((e) => e !== egg);
      }
    }
    const v = value(pf, prices);
    pf.peak = Math.max(pf.peak, v);
    pf.valueHistory.push(v);
    if (pf.valueHistory.length > 400) pf.valueHistory.shift();
  }
  return msgs;
}

export function newGamePlus(track: Track) {
  const keep = { name: S.name, avatar: S.avatar, rival: S.rival, tower: S.tower, legends: S.legends, gold: Object.entries(S.cards).filter(([, c]) => c.gold), ng: S.ngPlus + 1, options: S.options };
  newGame();
  Object.assign(S, { name: keep.name, avatar: keep.avatar, rival: keep.rival, tower: keep.tower, legends: keep.legends, ngPlus: keep.ng, options: keep.options, track });
  keep.gold.forEach(([id, c]) => (S.cards[id] = c));
}

export function profileFromScore(score: number): RiskProfile {
  return score <= 3 ? 'prudente' : score <= 6 ? 'equilibrato' : 'audace';
}

export function allAssetIds(): string[] { return ASSETS.map((a) => a.id); }
