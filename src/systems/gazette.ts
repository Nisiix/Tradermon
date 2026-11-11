// Giornale dei Mercati: le sedute appena passate, raccontate dai prezzi REALI scaricati da Alpaca. Deterministico dai prezzi,
// così il Giornale descrive ciò che è successo senza mai alimentarlo (niente profezie che si autoavverano).
import { S } from './state';
import { ASSETS, SECTOR_LABEL } from '../data/assets';
import type { Sector } from '../types';
import { CLIMATE_LABEL } from './market';

export interface Headline { day: number; title: string; body: string; tone: 'su' | 'giu' | 'neutro' }

const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;

/** Rendimento del giorno `i` (indice nella storia) per ogni asset e per settore. */
function dayReturns(i: number): { byAsset: { id: string; name: string; r: number }[]; bySector: { sector: Sector; r: number }[] } {
  const byAsset = ASSETS.filter((a) => S.market.history[a.id]?.length > i).map((a) => {
    const h = S.market.history[a.id];
    return { id: a.id, name: a.name, r: h[i] / h[i - 1] - 1 };
  });
  const acc = new Map<Sector, number[]>();
  for (const a of ASSETS) { const x = byAsset.find((b) => b.id === a.id); if (x) (acc.get(a.sector) ?? acc.set(a.sector, []).get(a.sector)!).push(x.r); }
  const bySector = [...acc.entries()].map(([sector, rs]) => ({ sector, r: rs.reduce((s, v) => s + v, 0) / rs.length }));
  return { byAsset, bySector };
}

export function headlines(days = 8): Headline[] {
  const idx = S.market.index;
  const n = idx.length;
  const out: Headline[] = [];
  const first = ASSETS[0] && S.market.history[ASSETS[0].id];
  const histLen = first?.length ?? 0;
  for (let k = 1; k <= days && n - k >= 1 && histLen - k >= 1; k++) {
    const i = n - k, hi = histLen - k;
    const m = idx[i] / idx[i - 1] - 1;
    const { byAsset, bySector } = dayReturns(hi);
    const best = [...bySector].sort((a, b) => b.r - a.r)[0];
    const worst = [...bySector].sort((a, b) => a.r - b.r)[0];
    const mover = [...byAsset].sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];
    const day = S.market.day - (k - 1);
    const tone: Headline['tone'] = m > 0.01 ? 'su' : m < -0.01 ? 'giu' : 'neutro';
    const title = Math.abs(m) > 0.03 ? (m > 0 ? `I Mercati di Fuori festeggiano: S&P 500 ${pct(m)}` : `Giornata nera: S&P 500 ${pct(m)}`)
      : Math.abs(m) > 0.01 ? (m > 0 ? `Borsa in rialzo (${pct(m)})` : `Borsa in calo (${pct(m)})`) : `Seduta tranquilla (${pct(m)})`;
    const parts: string[] = [];
    if (best && worst && best.sector !== worst.sector) parts.push(`Bene ${SECTOR_LABEL[best.sector].toLowerCase()} (${pct(best.r)}), male ${SECTOR_LABEL[worst.sector].toLowerCase()} (${pct(worst.r)}).`);
    if (mover && Math.abs(mover.r) > 0.04) parts.push(`Il titolo del giorno è ${mover.name}: ${pct(mover.r)}.`);
    const ops = S.journal.filter((e) => e.account === 'paper' && e.day === day).length;
    if (ops) parts.push(`Tu quel giorno hai fatto ${ops} operazion${ops === 1 ? 'e' : 'i'}: rileggile nel Diario.`);
    out.push({ day, title, body: parts.join(' '), tone });
  }
  return out;
}

/** Riquadro di apertura: la settimana e il clima, con il promemoria che il giornale racconta il passato. */
export function weekSummary(): string {
  const idx = S.market.index;
  if (idx.length < 6) return 'Nessun prezzo reale scaricato: il Giornale si riempie quando colleghi il conto Alpaca Paper (menu, voce "Chiavi API").';
  const w = idx[idx.length - 1] / idx[idx.length - 6] - 1;
  return `Ultime 5 sedute reali: S&P 500 ${pct(w)}. Clima: ${CLIMATE_LABEL[S.market.climate]}. Il Giornale racconta ieri: serve a capire cosa è successo, non a prevedere domani.`;
}
