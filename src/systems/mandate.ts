// Mandati dei Boss con ordini veri. Presentare il piano compra davvero il titolo sul conto di gioco (Alpaca Paper),
// per un importo dimensionato sul rischio scelto, e mette uno stop vero al prezzo del piano.
//  - Il giudizio (punti dell'esito) resta sulle candele reali del periodo: systems/boss.ts, `outcome`.
//  - Il denaro segue gli ordini: se il piano va male la perdita resta sul conto, e la sfida si rifà da capo.
//  - Vendere il titolo fuori dal piano (Banca, sito di Alpaca) annulla la sfida: lo fa systems/account.ts.
//  - L'ordine parte solo quando il giocatore invia il piano: il gioco non compra mai da solo.
import type { BossPlan } from '../types';
import * as A from './alpaca';
import * as Acc from './account';
import type { OrderResult } from './account';
import { S, save } from './state';
import { ASSET_BY_ID } from '../data/assets';
import { DIFFICULTY } from './balance';
import { fmtMoney, fmtPx } from './portfolio';
import { planError, positionSize, mandateOn, sellOut, type BossDef } from './boss';

const isCrypto = (id: string) => id.includes('/');
const STOP_TAG = 'boss-stop';

export interface OpenResult { ok: boolean; msg: string; plan?: BossPlan; notes: string[] }
const fail = (msg: string): OpenResult => ({ ok: false, msg, notes: [] });

/** Vendere questo titolo adesso annullerebbe la sfida con un Boss? Restituisce il Boss, per chiederlo PRIMA della vendita. */
export function sellCancelsMandate(asset: string): string | null {
  return mandateOn(S.boss, asset);
}

/** Importo che il piano comprerebbe adesso, con il capitale e la liquidità del momento. */
export function sizeFor(entry: number, stop: number, risk: number): { amount: number; capped: boolean } {
  return positionSize(Acc.equity(), risk, entry, stop, Acc.usableCash() / (1 + DIFFICULTY[S.difficulty].fee));
}

/** Si può aprire adesso un mandato su questo titolo? Restituisce il motivo del no, o ''. */
export function assetProblem(asset: string): string {
  const a = ASSET_BY_ID[asset];
  if (!a) return 'Titolo non in vetrina.';
  const pf = S.portfolio;
  if (Object.values(S.boss.runs ?? {}).some((r) => r.plan?.asset === asset)) return `${a.ticker} è già il titolo di un altro piano in corso.`;
  if (pf.positions.some((p) => p.id === asset) || pf.pending.some((p) => p.asset === asset)) return `Hai già ${a.ticker} in portafoglio o in un ordine: per il piano serve un titolo che non possiedi, così la posizione del mandato resta distinta dalle altre.`;
  return '';
}

/**
 * Presenta il piano: compra a mercato sul conto di gioco e mette lo stop vero. Il mandato parte solo se l'acquisto
 * viene eseguito subito (cripto, oppure azioni a Borsa aperta): un ordine in coda darebbe un ingresso sconosciuto.
 */
export async function openMandate(def: BossDef, want: { asset: string; stop: number; target: number; risk: number }, quality: number): Promise<OpenResult> {
  const run = S.boss.runs?.[def.id];
  if (!run) return fail('Prima supera il quiz del Boss.');
  if (run.plan) return fail('Hai già un piano in corso con questo Boss.');
  const bad = assetProblem(want.asset);
  if (bad) return fail(bad);
  const a = ASSET_BY_ID[want.asset];
  const crypto = isCrypto(want.asset);
  let last = 0;
  try {
    if (!crypto && !(await A.clock('paper')).is_open) return fail('La Borsa è chiusa: l\'ordine resterebbe in coda e il mandato partirebbe a un prezzo che non conosci. Torna a Borsa aperta, oppure scegli una cripto.');
    last = (await A.latest(want.asset, crypto ? 'crypto' : 'stocks')).price;
  } catch (e) { return fail(`Non riesco a leggere il mercato: ${(e as Error).message}`); }
  const err = planError({ entry: last, stop: want.stop, target: want.target, risk: want.risk });
  if (err) return fail(`Il prezzo è ora ${fmtPx(last)} $ e il piano non regge: ${err}`);
  const equity = Acc.equity();
  const size = sizeFor(last, want.stop, want.risk);
  if (!(size.amount >= 1)) return fail('Non hai liquidità disponibile per questo piano: libera capitale dalla Banca e riprova.');

  const b = await Acc.buy(want.asset, size.amount, { tag: 'boss' });
  if (!b.ok) return fail(b.msg);
  if (!b.filled) {
    const queued = S.portfolio.pending.find((p) => p.asset === want.asset && p.side === 'buy' && p.tag === 'boss');
    if (queued) await Acc.cancel(queued);
    return fail('Alpaca non ha eseguito subito l\'acquisto, quindi l\'ho annullato: il mandato parte solo con un ingresso eseguito al momento. Riprova tra poco.');
  }
  const entry = b.price ?? last;
  const qty = S.portfolio.positions.find((p) => p.id === want.asset)?.qty ?? b.qty ?? 0;
  // il rischio vero dipende da quanto si è comprato davvero: se la liquidità non bastava è più basso di quello chiesto
  const risk = size.capped ? Math.max(0, (size.amount * (entry - want.stop)) / entry / equity) : want.risk;
  const plan: BossPlan = { asset: want.asset, side: 'long', entry, stop: want.stop, target: want.target, risk, placedAt: Date.now(), deadline: Date.now() + def.durationMs, quality, real: true, amount: size.amount, qty };
  if (!(want.stop < entry && entry < want.target)) {
    save();
    return fail(`L'acquisto è stato eseguito a ${fmtPx(entry)} $, fuori dai prezzi del piano: il mandato non parte. La posizione su ${a.ticker} è tua: puoi tenerla o venderla dalla Banca. Il quiz resta valido.`);
  }
  run.plan = plan;
  const notes = [`Comprati ${fmtMoney(size.amount)} di ${a.ticker} a ${fmtPx(entry)} $ sul conto di gioco.`];
  if (size.capped) notes.push(`La liquidità disponibile non bastava per il rischio che avevi chiesto: la posizione è più piccola e il rischio vero è ${(risk * 100).toFixed(1)}% del capitale.`);
  const s = await Acc.sell(want.asset, qty, { type: 'stop', price: want.stop, tag: STOP_TAG });
  notes.push(s.ok ? s.msg : `Lo stop vero non è partito (${s.msg}). Puoi rimetterlo dalla Torre; il piano vale comunque e lo stop viene giudicato sulle candele.`);
  save();
  return { ok: true, msg: notes[0], plan, notes };
}

const planOf = (id: string) => { const p = S.boss.runs?.[id]?.plan; return p?.real ? p : null; };
/** Quantità ancora in portafoglio per il mandato. I residui minuscoli lasciati dalle quote frazionarie non contano. */
const held = (asset: string) => {
  const q = S.portfolio.positions.find((p) => p.id === asset)?.qty ?? 0;
  const whole = Object.values(S.boss.runs ?? {}).find((r) => r.plan?.asset === asset)?.plan?.qty ?? 0;
  return q > Math.max(1e-9, whole * 1e-3) ? q : 0;
};

/** Il mandato ha ancora la posizione ma lo stop vero non c'è più (per esempio uno stop frazionario scaduto a fine seduta). */
export function stopMissing(id: string): boolean {
  const p = planOf(id);
  return !!p && held(p.asset) > 0 && !S.portfolio.pending.some((x) => x.asset === p.asset && x.tag === STOP_TAG);
}

export async function restoreStop(id: string): Promise<OrderResult> {
  const p = planOf(id);
  if (!p || !(held(p.asset) > 0)) return { ok: false, msg: 'Non c\'è una posizione da proteggere.' };
  return Acc.sell(p.asset, held(p.asset), { type: 'stop', price: p.stop, tag: STOP_TAG });
}

/**
 * Vende la posizione del mandato con un ordine vero.
 *  - 'annulla': il giocatore rinuncia al titolo prima della scadenza; la sfida è annullata (anche se vende una parte).
 *  - 'obiettivo': incassa l'obiettivo raggiunto; 'mandato': chiude la posizione a mandato finito. Non annullano nulla.
 */
export async function closeMandate(id: string, why: 'annulla' | 'obiettivo' | 'mandato', frac = 1): Promise<OrderResult> {
  const p = planOf(id);
  if (!p) return { ok: false, msg: 'Nessun piano con ordini veri in corso.' };
  const q = held(p.asset);
  if (!(q > 0)) {
    // la posizione non c'è più (lo stop è già scattato): resta solo da annullare la sfida, se è questo che si chiede
    if (why === 'annulla') { sellOut(S.boss, id); save(); }
    return { ok: why === 'annulla', msg: 'La posizione del mandato è già stata venduta.' };
  }
  const r = await Acc.sell(p.asset, q * Math.min(1, Math.max(0, frac)), { tag: why === 'annulla' ? 'mercato' : why });
  // la decisione di vendere annulla la sfida anche se la vendita non è partita per un problema di rete
  if (why === 'annulla' && !r.ok && S.boss.runs?.[id]) { sellOut(S.boss, id); save(); }
  return r;
}

export interface MandateMoney { held: number; sold: number; realized: number; open: number; result: number }

/** Quanto capitale del conto di gioco ha mosso il mandato: vendite già fatte e valore della parte ancora in portafoglio, rispetto all'ingresso. */
export function mandateMoney(id: string): MandateMoney | null {
  const p = planOf(id);
  if (!p) return null;
  const q = held(p.asset);
  const sold = p.sold ?? 0;
  const realized = (p.proceeds ?? 0) - sold * p.entry;
  const open = q * ((S.market.prices[p.asset] ?? p.entry) - p.entry);
  return { held: q, sold, realized, open, result: realized + open };
}
