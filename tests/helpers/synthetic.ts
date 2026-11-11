// Serie di prezzi GENERATE, solo per i test automatici: il gioco non le usa mai (lavora sui dati reali
// di Alpaca, che non si possono ridistribuire nel repository). Servono a provare il motore dei replay,
// il registro e le metriche con numeri ripetibili.
import type { AssetDef, Sector } from '../../src/types';
import { gauss, mulberry32, type Rng } from '../../src/systems/rng';

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
  /** Spostamento casuale (in giorni, ±) di fasi e shock, deciso dal seme: il giocatore sa che lo shock arriverà, non quando. */
  jitter?: number;
}

/** Scenario concreto per un seme: fasi e shock spostati dello stesso numero di giorni, così restano coerenti tra loro. */
export function resolveScenario(sc: Scenario, seed: number): Scenario {
  if (!sc.jitter) return sc;
  const off = Math.round((mulberry32(seed ^ 0x5bd1e995)() * 2 - 1) * sc.jitter);
  const clampDay = (d: number) => Math.max(1, Math.min(sc.days, d + off));
  return {
    ...sc,
    phases: sc.phases.map((ph) => ({ ...ph, until: ph.until >= sc.days ? ph.until : clampDay(ph.until) })),
    shocks: sc.shocks.map((sh) => ({ ...sh, day: clampDay(sh.day) })),
  };
}

export function startPrice(id: string): number {
  return id.includes('/') ? 100 + (id.charCodeAt(0) % 40) * 50 : 20 + (id.charCodeAt(0) % 60) * 2;
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
export function generateScenario(sc0: Scenario, assets: AssetDef[], seed: number): { prices: Record<string, number[]>; index: number[] } {
  const sc = resolveScenario(sc0, seed);
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

