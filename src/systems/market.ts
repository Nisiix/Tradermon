import type { MarketState } from '../types';
import { T } from '../i18n';

const TD = 252;

// ---------------- Mercato del mondo: solo dati reali ----------------
// I prezzi arrivano da Alpaca (systems/realdata.ts). Qui restano il clima, le metriche e l'orologio.

/** Mercato vuoto: nessun prezzo finché un conto Alpaca non è collegato. */
export function emptyMarket(): MarketState {
  return { day: 0, prices: {}, history: {}, index: [], seed: 0, climate: 'laterale', asOf: 0, lastBar: '' };
}

/** Giorni di mercato (lunedì-venerdì, senza contare le festività) tra due momenti. */
export function tradingDaysBetween(from: number, to: number): number {
  if (!(to > from)) return 0;
  const a = new Date(from), b = new Date(to);
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()), end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  const days = Math.round((end - start) / 86400000);
  const weeks = Math.floor(days / 7);
  let n = weeks * 5;
  let dow = new Date(start).getUTCDay();
  for (let i = 0; i < days % 7; i++) { dow = (dow + 1) % 7; if (dow !== 0 && dow !== 6) n++; }
  return n;
}

/** Clima del mondo, letto dall'indice reale: descrive il mercato, non lo prevede. */
export function computeClimate(index: number[]): MarketState['climate'] {
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
  return 'laterale';
}

export const CLIMATE_LABEL: Record<MarketState['climate'], string> = {
  toro: T('Toro (rialzo)'), orso: T('Orso (ribasso)'), tempesta: T('Tempesta (alta volatilità)'), laterale: T('Laterale'),
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
  const label = open ? T('Borsa USA aperta') : pre ? T('Pre-market') : after ? T('After-hours') : T('Borsa USA chiusa');
  return { open, label, night };
}
