// Candele ricostruite da una serie giornaliera: servono SOLO ai test di aggregazione e lettura del grafico.
// Nel gioco le candele sono sempre barre reali di Alpaca.
import { mulberry32, gauss, hashString } from '../../src/systems/rng';
import { aggregate, BARS_SHOWN, TF_MINUTES, type Candle, type Timeframe } from '../../src/systems/candles';

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

