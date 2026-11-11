// Dati reali di Alpaca per il mondo e per i replay storici. Nessun prezzo generato: se Alpaca non
// risponde il gioco lo dice e resta sul percorso di studio.
//
// I dati di Alpaca non si possono ridistribuire: ogni giocatore li scarica con le proprie chiavi e
// restano nel suo browser (gli ultimi prezzi anche nel salvataggio, per riaprire il gioco senza rete).
import type { AssetDef } from '../types';
import * as A from './alpaca';
import { S } from './state';
import { ASSETS } from '../data/assets';
import { computeClimate, tradingDaysBetween } from './market';

/** Periodo storico reale di un replay. Le date non vengono mostrate al giocatore finché il replay non finisce. */
export interface RealWindow {
  start: string;
  end: string;
  /** Usato al posto del periodo principale quando tra gli asset ci sono cripto (lo storico cripto è più corto). */
  crypto?: { start: string; end: string };
}

export interface Aligned { ids: string[]; dates: string[]; prices: Record<string, number[]> }

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Porta le chiusure di più simboli sulle stesse date. Il calendario è quello delle borse (azioni ed ETF)
 * se ce ne sono, altrimenti quello delle cripto. Un simbolo senza dati all'inizio del periodo o con troppi
 * buchi viene scartato: meglio un asset in meno che un prezzo inventato.
 */
export function alignBars(bars: Record<string, { t: string; c: number }[]>, ids: string[], minCoverage = 0.9): Aligned {
  const byId: Record<string, Map<string, number>> = {};
  for (const id of ids) byId[id] = new Map((bars[id] ?? []).filter((b) => b.c > 0).map((b) => [b.t.slice(0, 10), b.c]));
  const stocks = ids.filter((id) => !id.includes('/') && byId[id].size);
  const pool = stocks.length ? stocks : ids.filter((id) => byId[id].size);
  if (!pool.length) return { ids: [], dates: [], prices: {} };
  const ref = pool.reduce((best, id) => (byId[id].size > byId[best].size ? id : best), pool[0]);
  const dates = [...byId[ref].keys()].sort();
  const out: Aligned = { ids: [], dates, prices: {} };
  for (const id of ids) {
    const m = byId[id];
    const own = dates.filter((d) => m.has(d)).length;
    if (own < dates.length * minCoverage) continue;
    // deve esistere un prezzo entro i primi tre giorni: non si "riempie" all'indietro
    const first = dates.findIndex((d) => m.has(d));
    if (first < 0 || first > 2) continue;
    const series: number[] = [];
    let last = m.get(dates[first])!;
    for (const d of dates) { last = m.get(d) ?? last; series.push(last); }
    out.ids.push(id);
    out.prices[id] = series;
  }
  return out;
}

/** Scarica e allinea le chiusure reali di un periodo per un gruppo di asset. */
export async function loadWindow(w: RealWindow, assets: AssetDef[]): Promise<{ assets: AssetDef[]; prices: Record<string, number[]>; dates: string[] }> {
  const useCrypto = !!w.crypto && assets.some((a) => a.cls === 'crypto');
  const { start, end } = useCrypto ? w.crypto! : w;
  const { bars } = await A.daily(assets.map((a) => a.id), start, end);
  const al = alignBars(bars, assets.map((a) => a.id));
  if (al.dates.length < 20 || !al.ids.length) throw new Error('Alpaca non ha dati sufficienti per questo periodo.');
  return { assets: assets.filter((a) => al.ids.includes(a.id)), prices: al.prices, dates: al.dates };
}

let refreshing: Promise<boolean> | null = null;

/**
 * Aggiorna il mercato del mondo dai dati reali: ultimi prezzi a ogni chiamata (al massimo una al minuto),
 * storico giornaliero una volta al giorno. Restituisce false se Alpaca non è raggiungibile: i prezzi
 * mostrati restano gli ultimi scaricati, con la loro data.
 */
export function refreshWorld(force = false): Promise<boolean> {
  if (refreshing) return refreshing;
  const now = Date.now();
  if (!force && S.market.asOf && now - S.market.asOf < 60_000) return Promise.resolve(true);
  refreshing = (async () => {
    try {
      const ids = ASSETS.map((a) => a.id);
      const today = iso(new Date());
      if (S.market.lastBar !== today || !Object.keys(S.market.history).length) {
        const { bars } = await A.daily(ids, iso(new Date(now - 430 * 86400000)), today);
        const al = alignBars(bars, ids, 0.6);
        if (al.dates.length >= 2) {
          S.market.history = Object.fromEntries(al.ids.map((id) => [id, al.prices[id].slice(-300)]));
          const idx = al.prices['SPY'] ?? al.prices[al.ids[0]];
          const base = idx.slice(-300);
          S.market.index = base.map((v) => (v / base[0]) * 100);
          S.market.lastBar = today;
        }
      }
      const { prices } = await A.snapshot(ids);
      const next: Record<string, number> = {};
      for (const id of ids) {
        const h = S.market.history[id];
        const p = prices[id] > 0 ? prices[id] : h?.[h.length - 1] ?? S.market.prices[id];
        if (p > 0) next[id] = p;
      }
      if (!Object.keys(next).length) return false;
      S.market.prices = next;
      S.market.climate = computeClimate(S.market.index);
      S.market.day = tradingDaysBetween(S.createdAt, now);
      S.market.asOf = now;
      return true;
    } catch { return false; } finally { refreshing = null; }
  })();
  return refreshing;
}

/** Il mondo ha prezzi reali da mostrare (anche non aggiornatissimi)? */
export function hasPrices(): boolean {
  return S.market.asOf > 0 && Object.keys(S.market.prices).length > 0;
}

/** "aggiornato alle 15:42" oppure "aggiornato il 3/11 alle 21:59": i prezzi non fingono mai di essere più freschi. */
export function asOfLabel(): string {
  if (!S.market.asOf) return 'nessun prezzo scaricato';
  const d = new Date(S.market.asOf);
  const sameDay = d.toDateString() === new Date().toDateString();
  const hm = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `prezzi aggiornati alle ${hm}` : `prezzi aggiornati il ${d.getDate()}/${d.getMonth() + 1} alle ${hm}`;
}
