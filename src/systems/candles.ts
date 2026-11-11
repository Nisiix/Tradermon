// Candele intraday per il conto di prova: dai prezzi giornalieri del mondo si ricostruisce un percorso
// a 5 minuti (ponte browniano tra chiusura precedente e chiusura del giorno), deterministico per asset e giorno,
// poi aggregato a 15 minuti, 1 ora, 4 ore e 1 giorno. I prezzi reali di Alpaca arrivano già in barre.
import { mulberry32, gauss, hashString } from './rng';

export type Timeframe = '5m' | '15m' | '1h' | '4h' | '1g';
export const TIMEFRAMES: Timeframe[] = ['5m', '15m', '1h', '4h', '1g'];
export const TF_MINUTES: Record<Timeframe, number> = { '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1g': 1440 };
export const TF_LABEL: Record<Timeframe, string> = { '5m': '5 min', '15m': '15 min', '1h': '1 ora', '4h': '4 ore', '1g': '1 giorno' };

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

/** Barre a 5 minuti di un giorno: 78 per i mercati azionari (6,5 ore), 288 per le cripto (24 ore). */
export function dayBars5m(id: string, dayIndex: number, prevClose: number, close: number, dailyVol: number, isCrypto: boolean, seed = 0): Candle[] {
  const n = isCrypto ? 288 : 78;
  const rng = mulberry32(hashString(`${id}:${dayIndex}:${seed}`));
  // ponte browniano: parte da prevClose, arriva a close, con rumore proporzionale alla volatilità giornaliera
  const sigma = Math.max(0.002, dailyVol) * 0.8 / Math.sqrt(n);
  const path: number[] = [prevClose];
  let w = 0;
  const steps: number[] = [];
  for (let k = 0; k < n; k++) { const g = gauss(rng); steps.push(g); w += g; }
  for (let k = 1; k <= n; k++) {
    const bridge = steps.slice(0, k).reduce((s, x) => s + x, 0) - (k / n) * w;
    const drift = prevClose + ((close - prevClose) * k) / n;
    path.push(Math.max(0.0001, drift * (1 + sigma * bridge)));
  }
  const out: Candle[] = [];
  const base = dayIndex * 1440 + (isCrypto ? 0 : 570); // minuti dall'inizio (9:30 per le azioni)
  for (let k = 0; k < n; k++) {
    const o = path[k], c = path[k + 1];
    const wick = Math.abs(c - o) * (0.3 + rng() * 0.7) + o * sigma * 0.6 * rng();
    const h = Math.max(o, c) + wick * rng(), l = Math.max(0.0001, Math.min(o, c) - wick * rng());
    const v = Math.round(1000 * (0.5 + rng()) * (1 + 4 * Math.abs(c - o) / Math.max(o, 0.0001) / sigma));
    out.push({ t: base + k * 5, o, h, l, c, v });
  }
  return out;
}

/** Raggruppa barre consecutive in barre più lunghe (fattore = minuti / 5). */
export function aggregate(bars: Candle[], minutes: number): Candle[] {
  if (minutes <= 5) return bars;
  const out: Candle[] = [];
  for (const b of bars) {
    const bucket = Math.floor(b.t / minutes) * minutes;
    const last = out[out.length - 1];
    if (last && last.t === bucket) { last.h = Math.max(last.h, b.h); last.l = Math.min(last.l, b.l); last.c = b.c; last.v += b.v; }
    else out.push({ t: bucket, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
  }
  return out;
}

/** Quante barre mostrare per ciascun orizzonte. */
export const BARS_SHOWN: Record<Timeframe, number> = { '5m': 90, '15m': 90, '1h': 90, '4h': 90, '1g': 120 };

/** Candele simulate per un asset del mondo, dall'ultimo giorno a ritroso fino a riempire il grafico. */
export function simulatedCandles(id: string, history: number[], tf: Timeframe, isCrypto: boolean, seed = 0): Candle[] {
  const minutes = TF_MINUTES[tf];
  const perDay = isCrypto ? 288 : 78;
  const barsPerDay = tf === '1g' ? 1 : Math.max(1, Math.floor((perDay * 5) / minutes));
  const daysNeeded = Math.ceil(BARS_SHOWN[tf] / barsPerDay) + 1;
  const rets: number[] = [];
  for (let i = 1; i < history.length; i++) rets.push(Math.log(history[i] / history[i - 1]));
  const dailyVol = rets.length ? Math.sqrt(rets.slice(-40).reduce((s, r) => s + r * r, 0) / Math.max(1, Math.min(40, rets.length))) : 0.01;
  const from = Math.max(1, history.length - daysNeeded);
  let all: Candle[] = [];
  for (let d = from; d < history.length; d++) all = all.concat(dayBars5m(id, d, history[d - 1], history[d], dailyVol, isCrypto, seed));
  const agg = tf === '1g' ? aggregate(all.map((b) => ({ ...b, t: Math.floor(b.t / 1440) * 1440 })), 1440) : aggregate(all, minutes);
  return agg.slice(-BARS_SHOWN[tf]);
}

export function sma(bars: Candle[], n: number): (number | null)[] {
  return bars.map((_, i) => (i + 1 < n ? null : bars.slice(i + 1 - n, i + 1).reduce((s, b) => s + b.c, 0) / n));
}

/** Lettura didattica del grafico: cosa si vede e quale approccio è coerente (non un consiglio). */
export function reading(bars: Candle[], tf: Timeframe): { lines: string[]; trend: 'su' | 'giu' | 'laterale' } {
  if (bars.length < 10) return { lines: ['Pochi dati per una lettura.'], trend: 'laterale' };
  const last = bars[bars.length - 1].c;
  const m20 = sma(bars, 20)[bars.length - 1];
  const hi = Math.max(...bars.map((b) => b.h)), lo = Math.min(...bars.map((b) => b.l));
  const range = (hi - lo) / lo;
  const first = bars[Math.max(0, bars.length - 30)].c;
  const chg = (last - first) / first;
  const trend: 'su' | 'giu' | 'laterale' = chg > 0.03 && m20 !== null && last > m20 ? 'su' : chg < -0.03 && m20 !== null && last < m20 ? 'giu' : 'laterale';
  const lines: string[] = [];
  const horizon = tf === '1g' ? 'di settimane o mesi' : tf === '4h' || tf === '1h' ? 'di giorni' : 'di ore: rumore, per chi investe';
  lines.push(`Orizzonte ${TF_LABEL[tf]}: movimenti ${horizon}. Ultime 30 barre: ${chg >= 0 ? '+' : ''}${(chg * 100).toFixed(1)}%, escursione massimo-minimo ${(range * 100).toFixed(1)}%.`);
  if (trend === 'su') lines.push('Tendenza al rialzo sopra la media a 20 barre. Chi compra ora insegue: meglio entrare a rate (PAC) o con un ordine limite su un ritracciamento, con uno stop sotto l\'ultimo minimo.');
  else if (trend === 'giu') lines.push('Tendenza al ribasso sotto la media a 20 barre. Un prezzo "basso" può scendere ancora: serve una ragione fondamentale per comprare, e in caso uno stop stretto. Non mediare al ribasso senza un piano.');
  else lines.push('Fase laterale intorno alla media: il prezzo rimbalza in un intervallo. Gli ordini limite vicino al minimo dell\'intervallo e lo stop sotto di esso sono coerenti; inseguire i movimenti brevi costa commissioni.');
  if (tf === '5m' || tf === '15m') lines.push('Su questi orizzonti il grafico è quasi tutto rumore: utile per scegliere il momento di un ordine già deciso, non per decidere se investire.');
  if (tf === '1g') lines.push('È l\'orizzonte dell\'investitore: qui si vedono le fasi di mercato. Confronta con i fondamentali dell\'Asset Card prima di decidere.');
  return { lines, trend };
}
