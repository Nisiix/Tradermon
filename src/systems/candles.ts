// Candele: tipi, aggregazione, media mobile e lettura guidata. Le barre sono sempre quelle reali di Alpaca
// (ui/alpaca.ts realChart): il gioco non ricostruisce e non inventa candele.

export type Timeframe = '5m' | '15m' | '1h' | '4h' | '1g';
export const TIMEFRAMES: Timeframe[] = ['5m', '15m', '1h', '4h', '1g'];
export const TF_MINUTES: Record<Timeframe, number> = { '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1g': 1440 };
export const TF_LABEL: Record<Timeframe, string> = { '5m': '5 min', '15m': '15 min', '1h': '1 ora', '4h': '4 ore', '1g': '1 giorno' };

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

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

export function sma(bars: Candle[], n: number): (number | null)[] {
  return bars.map((_, i) => (i + 1 < n ? null : bars.slice(i + 1 - n, i + 1).reduce((s, b) => s + b.c, 0) / n));
}

/** Lettura didattica del grafico: descrive cosa si vede e fa una domanda sul piano del giocatore (non un consiglio). */
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
  // Solo descrizione di ciò che il grafico mostra, più una domanda sul piano del giocatore: mai un'indicazione su come
  // o quando operare su questo titolo (sarebbe una raccomandazione su uno strumento preciso).
  if (trend === 'su') lines.push('Tendenza al rialzo: il prezzo è sopra la media a 20 barre. Domanda per il tuo piano: avevi deciso prima come e quando entrare, o lo decide il grafico?');
  else if (trend === 'giu') lines.push('Tendenza al ribasso: il prezzo è sotto la media a 20 barre. Un prezzo sceso non è per forza basso. Domanda per il tuo piano: quale motivo, fuori dal grafico, giustificherebbe una decisione?');
  else lines.push('Fase laterale: il prezzo oscilla intorno alla media a 20 barre, dentro un intervallo. Domanda per il tuo piano: hai già deciso dove metteresti lo stop, se dovessi entrare?');
  if (tf === '5m' || tf === '15m') lines.push('Su questi orizzonti il grafico è quasi tutto rumore: chi investe di solito non decide su candele così brevi.');
  if (tf === '1g') lines.push('È l\'orizzonte dell\'investitore: qui si vedono le fasi di mercato. Confronta con i fondamentali dell\'Asset Card prima di decidere.');
  return { lines, trend };
}
