import type { AssetDef, MarketState, Sector } from '../types';
import { ASSETS } from '../data/assets';
import { gauss, mulberry32, type Rng } from './rng';

const TD = 252;

export interface Phase { until: number; drift: number; vol: number }
export interface DayShock { day: number; market?: number; sectors?: Partial<Record<Sector, number>>; asset?: Record<string, number>; news?: string }

export interface Scenario {
  id: string;
  name: string;
  desc: string;
  days: number;
  phases: Phase[];
  shocks: DayShock[];
  historical?: string;
}

const START_PRICE: Record<string, number> = {};
ASSETS.forEach((a) => {
  START_PRICE[a.id] = a.sector === 'stable' ? 1 : a.cls === 'crypto' ? (a.id === 'GRN' ? 30000 : a.id === 'LMN' ? 2000 : a.id === 'MEM' ? 0.08 : a.id === 'ORT' ? 60 : 3) : a.cls === 'etf' ? 50 + (a.id.charCodeAt(0) % 40) : 20 + (a.id.charCodeAt(1) % 60) * 2;
});

export function startPrice(id: string): number {
  return START_PRICE[id] ?? 50;
}

const SECTOR_FACTOR_VOL: Partial<Record<Sector, number>> = { crypto: 0.45, tech: 0.12, energy: 0.15, finance: 0.1, bond: 0.03, gold: 0.1, stable: 0 };

/** Un giorno di mercato: rendimento di ciascun asset con modello a fattori. */
export function stepReturns(rng: Rng, assets: AssetDef[], drift: number, vol: number, shock?: DayShock): { market: number; ret: Record<string, number> } {
  const m = drift / TD + (vol / Math.sqrt(TD)) * gauss(rng) + (shock?.market ?? 0);
  const sectorF: Partial<Record<Sector, number>> = {};
  const ret: Record<string, number> = {};
  for (const a of assets) {
    if (sectorF[a.sector] === undefined) sectorF[a.sector] = ((SECTOR_FACTOR_VOL[a.sector] ?? 0.08) / Math.sqrt(TD)) * gauss(rng);
    if (a.sector === 'stable') {
      ret[a.id] = 0.0003 * gauss(rng) + (shock?.asset?.[a.id] ?? 0);
      continue;
    }
    const sysVar = a.beta * a.beta * vol * vol + (SECTOR_FACTOR_VOL[a.sector] ?? 0.08) ** 2;
    const idio = Math.sqrt(Math.max(a.sigma * a.sigma - sysVar, 0.0025)) / Math.sqrt(TD);
    const alpha = (a.mu - a.beta * 0.07) / TD; // la deriva di mercato "normale" è il 7%
    let r = alpha + a.beta * m + (sectorF[a.sector] as number) + idio * gauss(rng);
    r += shock?.sectors?.[a.sector] ?? 0;
    r += shock?.asset?.[a.id] ?? 0;
    ret[a.id] = Math.max(-0.95, r);
  }
  return { market: m, ret };
}

export function phaseAt(phases: Phase[], day: number): Phase {
  return phases.find((p) => day < p.until) ?? phases[phases.length - 1];
}

/** Genera l'intera serie di prezzi di uno scenario (deterministica dal seed). */
export function generateScenario(sc: Scenario, assets: AssetDef[], seed: number): { prices: Record<string, number[]>; index: number[] } {
  const rng = mulberry32(seed);
  const prices: Record<string, number[]> = {};
  assets.forEach((a) => (prices[a.id] = [startPrice(a.id)]));
  const index = [100];
  const shockMap = new Map<number, DayShock>();
  sc.shocks.forEach((s) => shockMap.set(s.day, s));
  for (let d = 1; d <= sc.days; d++) {
    const ph = phaseAt(sc.phases, d);
    const { market, ret } = stepReturns(rng, assets, ph.drift, ph.vol, shockMap.get(d));
    index.push(index[index.length - 1] * (1 + market));
    for (const a of assets) {
      const last = prices[a.id][prices[a.id].length - 1];
      let p = last * (1 + ret[a.id]);
      if (a.sector === 'stable') p = shockMap.get(d)?.asset?.[a.id] ? p : 1 + (p - 1) * 0.5;
      prices[a.id].push(Math.max(0.0001, p));
    }
  }
  return { prices, index };
}

// ---------------- Mercato persistente del mondo ----------------

export function createWorldMarket(seed: number): MarketState {
  const st: MarketState = { day: 0, prices: {}, history: {}, index: [100], seed, climate: 'laterale' };
  ASSETS.forEach((a) => {
    st.prices[a.id] = startPrice(a.id);
    st.history[a.id] = [st.prices[a.id]];
  });
  for (let i = 0; i < 260; i++) advanceWorldMarket(st);
  st.day = 0;
  return st;
}

export function advanceWorldMarket(st: MarketState, shock?: DayShock): Record<string, number> {
  const rng = mulberry32(st.seed + st.day * 7919 + st.index.length);
  const regime = st.climate === 'orso' ? { d: -0.05, v: 0.2 } : st.climate === 'tempesta' ? { d: 0, v: 0.3 } : { d: 0.07, v: 0.15 };
  const { market, ret } = stepReturns(rng, ASSETS, regime.d, regime.v, shock);
  st.index.push(st.index[st.index.length - 1] * (1 + market));
  if (st.index.length > 400) st.index.shift();
  for (const a of ASSETS) {
    let p = st.prices[a.id] * (1 + ret[a.id]);
    if (a.sector === 'stable') p = 1 + (p - 1) * 0.5;
    st.prices[a.id] = Math.max(0.0001, p);
    const h = st.history[a.id];
    h.push(st.prices[a.id]);
    if (h.length > 400) h.shift();
  }
  st.day += 1;
  st.climate = computeClimate(st.index, rng);
  return ret;
}

export function computeClimate(index: number[], rng?: Rng): MarketState['climate'] {
  if (index.length < 60) return 'laterale';
  const last = index[index.length - 1];
  const ma50 = index.slice(-50).reduce((s, x) => s + x, 0) / 50;
  const vol = (n: number) => {
    const sl = index.slice(-n - 1);
    const r = sl.slice(1).map((x, i) => x / sl[i] - 1);
    const m = r.reduce((s, x) => s + x, 0) / r.length;
    return Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / r.length);
  };
  const v20 = vol(20);
  const v60 = vol(60);
  if (v20 > v60 * 1.5) return 'tempesta';
  if (last > ma50 * 1.02) return 'toro';
  if (last < ma50 * 0.98) return 'orso';
  // lieve casualità per evitare stalli eterni nel laterale
  if (rng && rng() < 0.002) return 'toro';
  return 'laterale';
}

export const CLIMATE_LABEL: Record<MarketState['climate'], string> = {
  toro: 'Toro (rialzo)', orso: 'Orso (ribasso)', tempesta: 'Tempesta (alta volatilità)', laterale: 'Laterale',
};

// ---------------- Metriche ----------------

export function metrics(values: number[]): { ret: number; vol: number; sharpe: number; mdd: number } {
  if (values.length < 2) return { ret: 0, vol: 0, sharpe: 0, mdd: 0 };
  const r = values.slice(1).map((v, i) => (values[i] > 0 ? v / values[i] - 1 : 0));
  const mean = r.reduce((s, x) => s + x, 0) / r.length;
  const sd = Math.sqrt(r.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, r.length - 1));
  let peak = values[0];
  let mdd = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    mdd = Math.max(mdd, peak > 0 ? 1 - v / peak : 0);
  }
  const vol = sd * Math.sqrt(TD);
  const annRet = mean * TD;
  return { ret: values[values.length - 1] / values[0] - 1, vol, sharpe: vol > 0 ? annRet / vol : 0, mdd };
}

// ---------------- Orologio di mercato reale ----------------

export function nyTime(now = new Date()): { h: number; m: number; dow: number } {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false });
  const parts = fmt.formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
  return { h, m, dow };
}

export function marketClock(now = new Date()): { open: boolean; label: string; night: boolean } {
  const { h, m, dow } = nyTime(now);
  const mins = h * 60 + m;
  const weekday = dow >= 1 && dow <= 5;
  const open = weekday && mins >= 570 && mins < 960;
  const pre = weekday && mins >= 240 && mins < 570;
  const after = weekday && mins >= 960 && mins < 1200;
  const localH = now.getHours();
  const night = localH >= 21 || localH < 6;
  const label = open ? 'Borsa USA aperta' : pre ? 'Pre-market' : after ? 'After-hours' : 'Borsa USA chiusa';
  return { open, label, night };
}
