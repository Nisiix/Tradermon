import type { Portfolio, OpenOrder, OrderLog, AssetDef } from '../types';
import { ASSET_BY_ID, SECTOR_LABEL, isDefensive } from '../data/assets';

export interface Book {
  cash: number;
  positions: { id: string; qty: number; cost: number }[];
  orders: OpenOrder[];
  log: OrderLog[];
}

/**
 * Spread stimato nei replay storici (i dati giornalieri non contengono denaro e lettera): 0,1% per azioni
 * ed ETF, 0,5% per le cripto. Sul conto reale lo spread è quello vero dell'esecuzione di Alpaca.
 */
export function spreadOf(a: AssetDef): number {
  return a.cls === 'crypto' ? 0.005 : 0.001;
}

/** Valore iniziale interno dell'allocazione, sostituito subito da quella che il giocatore scrive all'apertura del conto. */
export function presetTarget(profile: string): { risky: number; defensive: number; cash: number } {
  return profile === 'prudente' ? { risky: 40, defensive: 50, cash: 10 } : profile === 'audace' ? { risky: 80, defensive: 10, cash: 10 } : { risky: 60, defensive: 30, cash: 10 };
}

export function newPortfolio(initial: number, monthly: number, profile: string): Portfolio {
  const target = presetTarget(profile);
  return {
    cash: initial, initial, contributed: initial, positions: [], orders: [], log: [], peak: initial,
    valueHistory: [initial], eggs: [], drip: true, monthly, refillsUsed: 0, target,
    pending: [], orderSeq: 0, bought: 0, costs: 0, loan: 0, interestDay: '', marginCallAt: 0, bankruptcies: 0, accountTag: '', external: [],
  };
}

export function value(b: Book, prices: Record<string, number>): number {
  return b.cash + b.positions.reduce((s, p) => s + p.qty * (prices[p.id] ?? 0), 0);
}

export function weights(b: Book, prices: Record<string, number>): { id: string; w: number; v: number }[] {
  const tot = value(b, prices);
  return b.positions.map((p) => ({ id: p.id, v: p.qty * prices[p.id], w: tot > 0 ? (p.qty * prices[p.id]) / tot : 0 }));
}

export interface TradeResult { ok: boolean; msg: string; qty?: number; price?: number; fee?: number; atLoss?: boolean }

/** Asset di riferimento: quelli del gioco, oppure quelli passati dal simulatore (per esempio un simbolo reale di Alpaca). */
export type AssetDefs = Record<string, AssetDef>;
const defOf = (id: string, defs?: AssetDefs): AssetDef | undefined => defs?.[id] ?? ASSET_BY_ID[id];

/**
 * Acquisto e vendita nei replay storici (Macchina del Tempo): un libro contabile in memoria, sui prezzi reali
 * del periodo. Il conto di gioco vero passa invece da systems/account.ts, che invia ordini ad Alpaca.
 * `feeRate` è il costo didattico della difficoltà (percentuale del controvalore); `credit` è il prestito
 * ancora disponibile quando nel replay è attiva la leva.
 */
export function marketBuy(b: Book, id: string, amount: number, prices: Record<string, number>, day: number, maxSlots: number, type = 'mercato', defs?: AssetDefs, feeRate = 0, credit = 0): TradeResult {
  const a = defOf(id, defs);
  if (!a) return { ok: false, msg: 'Asset sconosciuto.' };
  const FEE = amount * feeRate;
  if (!(amount >= 1)) return { ok: false, msg: 'Importo troppo basso: almeno 1 $.' };
  if (amount > b.cash + credit + 1e-9) return { ok: false, msg: credit > 0 ? 'Supera la liquidità più il prestito disponibile.' : 'Liquidità insufficiente.' };
  const has = b.positions.find((p) => p.id === id);
  if (!has && b.positions.length >= maxSlots) return { ok: false, msg: `Hai già ${maxSlots} posizioni: è il massimo per il tuo livello (slot di portafoglio).` };
  const px = prices[id] * (1 + spreadOf(a) / 2);
  const qty = (amount - FEE) / px;
  b.cash -= amount;
  if (has) { has.qty += qty; has.cost += amount - FEE; } else b.positions.push({ id, qty, cost: amount - FEE });
  b.log.push({ day, asset: id, side: 'buy', qty, price: px, fee: FEE + (amount - FEE) * spreadOf(a) / 2, type });
  return { ok: true, msg: `Comprate ${fmtQty(qty)} ${a.ticker} a ${fmtPx(px)}.`, qty, price: px, fee: FEE };
}

export function marketSell(b: Book, id: string, qty: number, prices: Record<string, number>, day: number, type = 'mercato', defs?: AssetDefs, feeRate = 0): TradeResult {
  const a = defOf(id, defs);
  const pos = b.positions.find((p) => p.id === id);
  if (!a || !pos) return { ok: false, msg: 'Non possiedi questo asset: le vendite allo scoperto non sono consentite.' };
  qty = Math.min(qty, pos.qty);
  if (qty <= 0) return { ok: false, msg: 'Quantità non valida.' };
  const px = prices[id] * (1 - spreadOf(a) / 2);
  const FEE = qty * px * feeRate;
  const proceeds = qty * px - FEE;
  const atLoss = px < pos.cost / pos.qty;
  pos.cost *= 1 - qty / pos.qty;
  pos.qty -= qty;
  if (pos.qty < 1e-9) b.positions = b.positions.filter((p) => p !== pos);
  b.cash += Math.max(0, proceeds);
  b.log.push({ day, asset: id, side: 'sell', qty, price: px, fee: FEE + qty * px * spreadOf(a) / 2, type });
  return { ok: true, msg: `Vendute ${fmtQty(qty)} ${a.ticker} a ${fmtPx(px)}.`, qty, price: px, fee: FEE, atLoss };
}

export function placeOrder(b: Book, o: Omit<OpenOrder, 'id'>): OpenOrder {
  const order = { ...o, id: Math.random().toString(36).slice(2, 9) };
  b.orders.push(order);
  return order;
}

/** Esegue gli ordini limite/stop compatibili con i prezzi del giorno. */
export function processOrders(b: Book, prices: Record<string, number>, day: number, maxSlots: number, defs?: AssetDefs, feeRate = 0): string[] {
  const msgs: string[] = [];
  for (const o of b.orders.slice()) {
    const px = prices[o.asset];
    let fire = false;
    if (o.type === 'limit') fire = o.side === 'buy' ? px <= o.price : px >= o.price;
    else fire = o.side === 'sell' ? px <= o.price : px >= o.price;
    if (!fire) continue;
    b.orders = b.orders.filter((x) => x !== o);
    // l'ordine limite si esegue al prezzo limite o migliore; lo stop al prezzo corrente (possibile gap)
    const execPrices = { ...prices };
    if (o.type === 'limit') execPrices[o.asset] = o.side === 'buy' ? Math.min(px, o.price) : Math.max(px, o.price);
    const tag = o.type === 'limit' ? 'limite' : 'stop';
    const r = o.side === 'buy'
      ? marketBuy(b, o.asset, Math.min(b.cash, o.qty * execPrices[o.asset] * (1 + feeRate)), execPrices, day, maxSlots, tag, defs, feeRate)
      : marketSell(b, o.asset, o.qty, execPrices, day, tag, defs, feeRate);
    msgs.push(r.ok ? `Ordine ${tag} eseguito. ${r.msg}` : `Ordine ${tag} annullato: ${r.msg}`);
  }
  return msgs;
}

// ---------------- Salute e diagnosi ----------------

export interface Health { score: number; state: 'Ottima' | 'Buona' | 'Ha la febbre' | 'Affaticata'; maxW: number; dd: number; cashW: number; dev: number; sectors: number }

/**
 * Allocazione in percentuale. `locked` è il capitale non ancora investibile (solo prima di aprire il conto: poi è
 * sempre zero): non è una scelta del giocatore, quindi non conta né come liquidità né nel totale.
 */
export function allocation(b: Book, prices: Record<string, number>, locked = 0): { risky: number; defensive: number; cash: number } {
  const tot = Math.max(0, value(b, prices) - locked) || 1;
  let risky = 0;
  let def = 0;
  for (const p of b.positions) {
    const v = p.qty * prices[p.id];
    if (isDefensive(ASSET_BY_ID[p.id])) def += v; else risky += v;
  }
  return { risky: (risky / tot) * 100, defensive: (def / tot) * 100, cash: (Math.max(0, b.cash - locked) / tot) * 100 };
}

export function health(pf: Portfolio, prices: Record<string, number>, locked = 0): Health {
  const tot = value(pf, prices);
  const free = Math.max(1, tot - locked);
  // i pesi si misurano sul capitale investibile, cioè tutto il conto una volta aperto
  const ws = weights(pf, prices).map((x) => ({ ...x, w: x.v / free }));
  const maxW = pf.positions.length > 1 ? ws.reduce((m, x) => Math.max(m, x.w), 0) * 100 : 0;
  const dd = pf.peak > 0 ? Math.max(0, (1 - tot / pf.peak) * 100) : 0;
  const al = allocation(pf, prices, locked);
  const dev = (Math.abs(al.risky - pf.target.risky) + Math.abs(al.defensive - pf.target.defensive) + Math.abs(al.cash - pf.target.cash)) / 2;
  let score = 100;
  score -= Math.max(0, maxW - 25) * 1.5;
  score -= dd;
  if (pf.log.length > 0 && al.cash < 2) score -= 10;
  if (pf.log.length > 0 && al.cash > 60) score -= 10;
  score -= dev * 0.5;
  score = Math.max(0, Math.round(score));
  const sectors = new Set(pf.positions.map((p) => ASSET_BY_ID[p.id].sector)).size;
  const state = score >= 80 ? 'Ottima' : score >= 60 ? 'Buona' : score >= 40 ? 'Ha la febbre' : 'Affaticata';
  return { score, state, maxW, dd, cashW: al.cash, dev, sectors };
}

export function diagnosis(pf: Portfolio, prices: Record<string, number>, day: number, locked = 0): { text: string; lesson: string }[] {
  const out: { text: string; lesson: string }[] = [];
  const h = health(pf, prices, locked);
  const free = Math.max(1, value(pf, prices) - locked);
  const ws = pf.positions.length > 1 ? weights(pf, prices).map((x) => ({ ...x, w: x.v / free })).sort((a, b) => b.w - a.w) : [];
  if (ws[0] && ws[0].w > 0.4) out.push({ text: `Il ${Math.round(ws[0].w * 100)}% del portafoglio è in ${ASSET_BY_ID[ws[0].id].name}: se va male, va male quasi tutto.`, lesson: 'l_div_1' });
  if (pf.positions.length >= 2 && h.sectors === 1) out.push({ text: `Tutte le posizioni sono nel settore ${SECTOR_LABEL[ASSET_BY_ID[pf.positions[0].id].sector]}: un evento di settore le colpirebbe insieme.`, lesson: 'l_div_2' });
  if (h.dd > 15) out.push({ text: `Sei il ${h.dd.toFixed(0)}% sotto il massimo: ricordi il tuo piano?`, lesson: 'l_gestione_1' });
  if (pf.log.length > 0 && h.cashW > 60) out.push({ text: 'Gran parte è ferma in liquidità: l\'inflazione la erode nel tempo.', lesson: 'l_costi_1' });
  const recent = pf.log.filter((l) => l.day > day - 21).length;
  if (recent > 10) out.push({ text: `${recent} ordini nell'ultimo mese di mercato: più ordini significano più costi e spesso più emozioni.`, lesson: 'l_costi_2' });
  if (h.dev > 15) out.push({ text: `L'allocazione si è allontanata di ${h.dev.toFixed(0)} punti dal tuo obiettivo: valuta un ribilanciamento.`, lesson: 'l_div_2' });
  for (const p of pf.positions) {
    const v = p.qty * prices[p.id];
    if (p.cost > 0 && v / p.cost - 1 < -0.2) out.push({ text: `${ASSET_BY_ID[p.id].name} è affaticata (${((v / p.cost - 1) * 100).toFixed(0)}%). La domanda giusta: la compreresti oggi?`, lesson: 'l_bias_1' });
  }
  if (out.length === 0) out.push({ text: 'Nessun sintomo: il portafoglio rispetta il tuo piano. Continua così!', lesson: '' });
  return out;
}

/**
 * Calcolo del ribilanciamento: per ogni gruppo (rischiosi, difensivi, liquidità) quanto il conto si è allontanato
 * dal piano del giocatore, in punti e in dollari. Non propone ordini né titoli: quali titoli usare lo decide il giocatore.
 */
export function rebalanceGap(pf: Portfolio, prices: Record<string, number>, locked = 0): { group: 'risky' | 'defensive' | 'cash'; now: number; target: number; amount: number }[] {
  const tot = Math.max(0, value(pf, prices) - locked);
  const al = allocation(pf, prices, locked);
  return (['risky', 'defensive', 'cash'] as const).map((g) => ({ group: g, now: al[g], target: pf.target[g], amount: ((pf.target[g] - al[g]) / 100) * tot }));
}

/** Scostamento massimo, in punti, tra un gruppo del conto e il piano. Sotto i 2 punti il conto è considerato in linea. */
export function maxGap(gaps: { now: number; target: number }[]): number {
  return Math.max(0, ...gaps.map((g) => Math.abs(g.target - g.now)));
}

export function fmtPx(p: number): string {
  if (p >= 1000) return p.toLocaleString('it-IT', { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return p.toLocaleString('it-IT', { maximumFractionDigits: 4 });
}
export function fmtQty(q: number): string {
  return q >= 100 ? q.toFixed(0) : q >= 1 ? q.toFixed(2) : q.toFixed(4);
}
/** Importi sempre in dollari, anche sul conto Paper: è la valuta dei prezzi reali. */
export function fmtMoney(v: number): string {
  const small = Math.abs(v) < 100 && Math.round(v) !== v;
  return v.toLocaleString('it-IT', { minimumFractionDigits: small ? 2 : 0, maximumFractionDigits: small ? 2 : 0 }) + ' $';
}
export function fmtPct(v: number, digits = 1): string {
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(digits) + '%';
}
