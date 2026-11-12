// Conto di gioco: un registro dentro il conto Alpaca Paper del giocatore.
//
// Alpaca non permette di fissare il saldo del conto Paper e somma le posizioni per simbolo, quindi il
// gioco tiene un proprio registro (S.portfolio): parte dal capitale della difficoltà e cambia SOLO con
// gli ordini che il gioco ha inviato e che Alpaca ha eseguito, ai prezzi reali di esecuzione. Ogni ordine
// porta un client_order_id "tm-<partita>-<numero>", così il registro riconosce i propri.
//
// Regole fisse:
//  - la progressione (rate di tappa, Sigilli, leva di gioco, bancarotta) vive solo qui, sul Paper;
//  - il gioco non invia mai ordini da solo, tranne la liquidazione forzata dopo una chiamata di margine
//    non coperta, e solo sul Paper;
//  - un esercizio di tappa vale quando Alpaca ACCETTA l'ordine: a mercato chiuso l'ordine resta in coda
//    e il gioco non aspetta l'esecuzione;
//  - a ogni sincronizzazione il registro si riconcilia con le posizioni vere: non può mai contenere più
//    titoli di quanti Alpaca ne ha davvero.
import type { Portfolio, PendingOrder, AssetDef } from '../types';
import * as A from './alpaca';
import { S, save, slots, addRep } from './state';
import { BOSS_BY_ID, mandateOn, sellOut } from './boss';
import { ASSET_BY_ID, unlockedAssets } from '../data/assets';
import { DIFFICULTY, RATE, STAGES, STAGE_TOOL, LEVERAGE, REWARD , ZERO, PROVA_IGNORE } from './balance';
import { value, fmtMoney, fmtPx, fmtQty } from './portfolio';
import { refreshWorld } from './realdata';
import { tradingDaysBetween } from './market';
import { hashString } from './rng';
import { toast } from '../ui/core';
import { clampStat } from './state';

const ENV: A.Env = 'paper';

// ---------------- Collegamento ----------------

export interface Link { server: boolean; paper: boolean; reason: string }
let link: Link = { server: false, paper: false, reason: 'Collegamento non ancora verificato.' };
let linkAt = 0;

/** Verifica server e chiavi. Il risultato resta valido per 20 secondi, salvo `force`. */
export async function checkLink(force = false): Promise<Link> {
  if (!force && Date.now() - linkAt < 20_000) return link;
  const st = await A.serverStatus();
  linkAt = Date.now();
  if (!st) link = { server: false, paper: false, reason: A.isLocalHost() ? 'Il server locale di Tradermon non risponde: avvialo come spiegato nel file README.' : 'Dal sito colleghi il conto Alpaca quando entri con il tuo giocatore: ricarica la pagina ed entra con nome e password.' };
  else link = { server: true, paper: st.paper.configured, reason: st.paper.configured ? '' : 'Le chiavi del conto Alpaca Paper non sono collegate.' };
  return link;
}

/** Conto Paper collegato secondo l'ultima verifica (senza rete). */
export function linked(): boolean { return link.server && link.paper; }
export function linkInfo(): Link { return link; }
/** Segna il conto come non raggiungibile dopo un errore di rete su una chiamata vera. */
function unreachable(e: unknown): string {
  const msg = (e as Error)?.message || 'Alpaca non risponde.';
  if (/fetch|network|Failed|ECONN|timeout/i.test(msg)) { link = { ...link, server: false, reason: 'Il server o Alpaca non rispondono in questo momento.' }; linkAt = 0; }
  return msg;
}

// ---------------- Capitale, rate di tappa, esercizi ----------------

const fee = () => DIFFICULTY[S.difficulty].fee;

/** Ha vinto la Lega in questa partita: apre Torre, Boss e aumenti di capitale. La Nuova Partita+ riparte da zero. */
export function graduated(): boolean {
  return !!S.flags.champion;
}

/**
 * Quota di capitale che si può investire: tutta, dal momento in cui il conto è aperto. Le tappe chiedono un
 * investimento MINIMO (vedi exNeed), mai un massimo: quanto rischiare oltre il minimo lo decide il giocatore.
 */
export function releasedFrac(): number {
  return S.flags.starter ? 1 : 0;
}

/** Capitale non ancora investibile: solo prima di aprire il conto (poi è sempre zero). */
export function locked(pf: Portfolio = S.portfolio): number {
  return Math.max(0, Math.min(pf.cash, pf.initial * (1 - releasedFrac())));
}

export function reserved(pf: Portfolio = S.portfolio): number {
  return pf.pending.reduce((s, p) => s + (p.side === 'buy' ? p.reserved : 0), 0);
}

/** Liquidità che si può davvero investire adesso. */
export function usableCash(pf: Portfolio = S.portfolio): number {
  return Math.max(0, pf.cash - locked(pf) - reserved(pf));
}

/** Patrimonio netto del conto di gioco: valore meno prestito della leva. */
export function equity(pf: Portfolio = S.portfolio): number {
  return value(pf, S.market.prices) - pf.loan;
}

/** Leva sul conto: dopo l'Esame della Leva e la Medaglia dello Scudo, solo azioni ed ETF, mai oltre il tetto di Alpaca. */
export function leverageOpen(): boolean {
  return S.levExam && S.badges >= LEVERAGE.fromBadge;
}

/** Prestito ancora disponibile con la leva. */
export function credit(pf: Portfolio = S.portfolio): number {
  if (!leverageOpen()) return 0;
  const free = equity(pf) - locked(pf);
  return Math.max(0, free * (LEVERAGE.max - 1) - pf.loan);
}

export interface Exercise { stage: number; open: boolean; need: number; got: number; toolOk: boolean; tool: string; allDone: boolean }

/** Acquisti accettati necessari, in totale, per completare la Prova sul conto della tappa k (le quote minime si sommano). Contano gli acquisti fatti: restano validi anche dopo una ripartenza. */
export function exNeed(k: number): number {
  return (k + 1) * stageQuota();
}

/** Capitale di partenza della difficoltà: tutte le quote si misurano su questo, mai sul patrimonio del momento. */
export function startCapital(): number {
  return DIFFICULTY[S.difficulty].capital;
}

/** Quota minima di una tappa, in dollari: fissa per tutta la partita, anche dopo una ripartenza. */
export function stageQuota(): number {
  return startCapital() * RATE * (1 - DIFFICULTY[S.difficulty].tolerance);
}

function heldIds(pf: Portfolio): string[] {
  return [...new Set([...pf.positions.map((p) => p.id), ...pf.pending.filter((p) => p.side === 'buy').map((p) => p.asset)])];
}

function toolOk(k: number): boolean {
  const pf = S.portfolio;
  // un titolo venduto durante la Prova non conta più nemmeno come "secondo titolo" o come settore
  const ids = heldIds(pf).filter((id) => !(pf.exBarred ?? []).includes(id));
  switch (STAGE_TOOL[k]?.key) {
    case 'second': return ids.length >= 2;
    case 'limit': return S.exTools.limit;
    case 'stop': return S.exTools.stop;
    case 'sectors': {
      const avail = new Set(unlockedAssets(S.track, S.mixedClasses, S.badges, Object.keys(S.cards)).map((a) => a.sector)).size;
      const mine = new Set(ids.map((id) => ASSET_BY_ID[id]?.sector)).size;
      return avail >= 3 ? mine >= 3 : ids.length >= 3;
    }
    default: return true;
  }
}

/** Stato dell'esercizio di tappa da fare adesso. */
export function exercise(): Exercise {
  const k = S.exDone;
  if (k >= STAGES) return { stage: STAGES, open: false, need: 0, got: credited(), toolOk: true, tool: '', allDone: true };
  return { stage: k, open: !!S.flags.starter && k <= S.badges, need: exNeed(k), got: credited(), toolOk: toolOk(k), tool: STAGE_TOOL[k].text, allDone: false };
}

/** Acquisti che contano per le Prove: quelli accettati da Alpaca, meno quelli delle Prove annullate da una vendita. */
export function credited(pf: Portfolio = S.portfolio): number {
  return Math.max(0, pf.bought - (pf.exVoid ?? 0) + (pf.exSkip ?? 0));
}

/** Titoli venduti durante la Prova in corso: i loro acquisti non contano finché la Prova non è completata. */
export function exBarred(): string[] {
  return [...(S.portfolio.exBarred ?? [])];
}

const stageName = (k: number) => (k === 0 ? 'della Valigetta' : `della tappa ${k}`);

/**
 * Vendere questo titolo adesso, anche solo in parte, annullerebbe la Prova sul conto in corso? Sì se la Prova è
 * aperta e il titolo è tra quelli comprati per lei. Serve all'interfaccia per chiederlo PRIMA della vendita.
 */
export function sellCancels(asset: string): { stage: number } | null {
  const ex = exercise();
  if (ex.allDone || !ex.open || graduated()) return null;
  return (S.portfolio.exBuys?.[asset] ?? 0) > 0.005 ? { stage: ex.stage } : null;
}

/** Azzera la quota della tappa in corso (le Prove già completate restano) e segna la Prova come andata male. */
function resetStage(k: number): number {
  const pf = S.portfolio;
  const base = k === 0 ? 0 : exNeed(k - 1);
  const lost = Math.max(0, credited(pf) - base);
  pf.exVoid = (pf.exVoid ?? 0) + lost;
  pf.exBuys = {};
  pf.exFailed = k;
  // gli acquisti ancora in coda facevano parte della Prova annullata: se poi saltano non vanno tolti una seconda volta
  for (const p of pf.pending) if (p.side === 'buy' && (p.stage ?? k) === k) p.noCredit = true;
  S.exTools = { limit: false, stop: false };
  return lost;
}

/** Dopo una Prova chiusa: l'elenco dei titoli venduti riparte vuoto; gli acquisti oltre la quota contano già per la tappa seguente e restano legati ai loro titoli, in proporzione. */
function finishStage(): void {
  const pf = S.portfolio;
  pf.exBarred = [];
  pf.exFailed = undefined;
  const buys = pf.exBuys ?? {};
  const tot = Object.values(buys).reduce((s, v) => s + v, 0);
  const extra = S.exDone >= STAGES ? 0 : credited(pf) - exNeed(S.exDone - 1);
  const f = tot > 0 && extra > 0.005 ? Math.min(1, extra / tot) : 0;
  pf.exBuys = Object.fromEntries(Object.entries(buys).map(([id, v]) => [id, v * f] as [string, number]).filter(([, v]) => v > 0.005));
}

// ---- Opzione "prosegui anche se la Prova va male" (solo Apprendista e Investitore) ----

/** L'opzione esiste solo nelle difficoltà normali. */
export function ignoreAllowed(): boolean {
  return PROVA_IGNORE.includes(S.difficulty);
}

/** Opzione attiva: una Prova sul conto andata male non blocca, il suo esito viene ignorato. */
export function ignoreOn(): boolean {
  return ignoreAllowed() && !!S.options.ignoreProva;
}

/** Tappe la cui Prova è stata chiusa ignorando un esito negativo. */
export function ignored(): number[] {
  return [...(S.portfolio.exIgnored ?? [])];
}

export const IGNORE_WARNING = 'Scelta sconsigliata se vuoi imparare a investire o a fare trading in modo efficiente e corretto: la Prova serve proprio a mettere in pratica il metodo.';

/**
 * Accende o spegne l'opzione. Non salta nessuna Prova: se quella in corso è già andata male il suo esito viene
 * ignorato subito, altrimenti si aspetta che abbia un esito. Restituisce la frase per il giocatore ('' se non cambia nulla).
 */
export function setIgnore(on: boolean): string {
  if (on && !ignoreAllowed()) return '';
  S.options.ignoreProva = on;
  let msg = '';
  if (on) {
    const ex = exercise();
    if (!ex.allDone && ex.open && !graduated() && S.portfolio.exFailed === ex.stage) msg = passIgnored(ex.stage);
  }
  save();
  return msg;
}

/** Chiude la Prova della tappa k ignorando l'esito negativo: conta come superata e la tappa seguente chiede solo la propria quota. */
function passIgnored(k: number): string {
  const pf = S.portfolio;
  pf.exSkip = (pf.exSkip ?? 0) + Math.max(0, exNeed(k) - credited(pf));
  pf.exIgnored = [...new Set([...(pf.exIgnored ?? []), k])];
  S.exDone = k + 1;
  S.exTools = { limit: false, stop: false };
  finishStage();
  const seals = grantSeals();
  return `Hai attivato "Prosegui anche se la Prova va male": l'esito negativo viene ignorato, la Prova ${stageName(k)} conta come superata e puoi proseguire.${seals.length ? ` Sigillo pratico ${seals.join(' e ')} ottenuto.` : ''} ${IGNORE_WARNING}`;
}

/**
 * Regola delle sfide: decidere di vendere il titolo di una Prova, anche solo in parte, annulla la Prova. La quota
 * della tappa riparte da zero (le Prove già completate restano), gli attrezzi vanno riusati e il titolo venduto non
 * conta più finché la Prova non è completata con un altro titolo. Restituisce la frase per il giocatore ('' se la
 * vendita non tocca nessuna Prova).
 */
function voidExercise(asset: string, forced = false): string {
  const hit = sellCancels(asset);
  if (!hit) return '';
  const pf = S.portfolio;
  const k = hit.stage;
  resetStage(k);
  const tick = ASSET_BY_ID[asset]?.ticker ?? asset;
  if (ignoreOn()) return `${forced ? `La vendita forzata della leva ha venduto ${tick}` : `Hai venduto ${tick}`}: la Prova sul conto ${stageName(k)} sarebbe annullata. ${passIgnored(k)}`;
  // la vendita forzata non è una scelta del giocatore: annulla la Prova, ma non esclude nessun titolo
  if (forced) return `La vendita forzata della leva ha venduto ${tick}: la Prova sul conto ${stageName(k)} è annullata e riparte da zero.`;
  const barred = new Set([...(pf.exBarred ?? []), asset]);
  const others = unlockedAssets(S.track, S.mixedClasses, S.badges, Object.keys(S.cards)).some((a) => !barred.has(a.id));
  pf.exBarred = others ? [...barred] : [];
  const head = `Hai venduto ${tick}: la Prova sul conto ${stageName(k)} è annullata e riparte da zero. Vendere il titolo di una Prova, anche solo una parte, vuol dire rinunciare a quel titolo.`;
  return others
    ? `${head} Rifai la Prova con un altro titolo: gli acquisti di ${tick} non contano finché non la completi.`
    : `${head} In vetrina non ci sono altri titoli, quindi puoi rifarla anche con ${tick}.`;
}

/** Dopo un ordine accettato: chiude gli esercizi completati (in ordine) e dice quali. */
function closeExercises(): string {
  let msg = '';
  for (;;) {
    const ex = exercise();
    if (ex.allDone || !ex.open || ex.got + 0.005 < ex.need || !ex.toolOk) break;
    S.exDone = ex.stage + 1;
    S.exTools = { limit: false, stop: false };
    msg = `Esercizio ${ex.stage === 0 ? 'della Valigetta' : 'della tappa ' + ex.stage} completato: l'ordine è stato accettato da Alpaca.`;
  }
  if (msg) finishStage();
  const seals = grantSeals();
  if (seals.length) msg += ` Sigillo pratico ${seals.join(' e ')} ottenuto: la Medaglia è completa!`;
  return msg;
}

/** La Valigetta è aperta dal primo acquisto accettato. */
export function caseOpen(): boolean {
  return S.exDone > 0 || S.portfolio.bought > 0;
}

/**
 * Sigillo pratico m: Attestato m e Prova sul conto della tappa m (quota minima investita con ordini veri sul mercato
 * attuale, usando la Tecnica appena imparata). I Sigilli si ottengono in ordine. Restituisce quelli nuovi.
 * I replay della Macchina del Tempo sono allenamento: non servono per il Sigillo.
 */
export function grantSeals(): number[] {
  const got: number[] = [];
  while (S.seals < 8) {
    const m = S.seals + 1;
    if (S.badges < m || S.exDone < m + 1 || S.flags.bankrupt) break;
    S.seals = m;
    got.push(m);
    // il premio è lo stesso qualunque sia l'ultimo pezzo arrivato (missione dal Mentore o esercizio in Clinica),
    // e si riceve una volta sola anche se il Sigillo viene sospeso e poi ripreso
    if (m > Number(S.flags.sealPaid ?? 0)) {
      S.flags.sealPaid = m;
      addRep(REWARD.rep.badge / 2);
      S.stats.xp += REWARD.xp.badge / 2;
    }
  }
  return got;
}

/**
 * L'accredito di un esercizio all'accettazione dell'ordine è provvisorio: se l'ordine finisce annullato, scaduto o
 * rifiutato senza esecuzione, la quota non è stata investita davvero. Gli esercizi che non sono più coperti dagli
 * acquisti tornano "da fare", e i Sigilli ottenuti grazie a loro restano sospesi finché la quota non viene investita davvero.
 * Dopo la Lega non si torna indietro.
 */
export function reopenExercises(boughtBefore: number): string[] {
  if (graduated()) return [];
  const notes: string[] = [];
  const before = S.exDone;
  // torna indietro solo ciò che era coperto PROPRIO dall'ordine non eseguito (dopo un conto azzerato o una
  // ripartenza gli acquisti ripartono da zero, e gli esercizi già fatti non si toccano)
  while (S.exDone > 0 && credited() + 0.005 < exNeed(S.exDone - 1) && boughtBefore + 0.005 >= exNeed(S.exDone - 1)) S.exDone--;
  if (S.exDone === before) return notes;
  // l'attrezzo era già stato usato: resta valido, manca solo la quota
  S.exTools = { limit: true, stop: true };
  notes.push(`${S.exDone === 0 ? 'L\'esercizio della Valigetta' : `L'esercizio della tappa ${S.exDone}`} torna da fare: l'ordine non è stato eseguito, quindi la quota della tappa non è stata investita davvero.`);
  const keep = Math.max(0, S.exDone - 1);
  if (S.seals > keep) {
    notes.push(`${S.seals - keep === 1 ? `Il Sigillo ${S.seals} resta sospeso` : `I Sigilli da ${keep + 1} a ${S.seals} restano sospesi`} finché non investi la quota con un acquisto eseguito.`);
    S.seals = keep;
  }
  return notes;
}

/** Rata ancora da versare per l'esercizio in corso (0 se manca solo l'attrezzo). */
export function exMissing(): number {
  const ex = exercise();
  return ex.allDone ? 0 : Math.max(0, ex.need - ex.got);
}

// ---------------- Ordini reali ----------------

export interface OrderResult { ok: boolean; msg: string; filled?: boolean; price?: number; qty?: number; atLoss?: boolean; exercise?: string; /** Frase da mostrare se la vendita ha annullato la Prova sul conto in corso. */ cancelled?: string }

const TERMINAL = new Set(['filled', 'canceled', 'expired', 'rejected']);
const isCrypto = (id: string) => id.includes('/');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const floorTo = (v: number, inc: number) => (inc > 0 ? Math.floor(v / inc + 1e-9) * inc : v);
const dec = (inc: number) => Math.max(0, Math.min(9, Math.ceil(-Math.log10(inc || 1e-6) - 1e-9)));

async function increments(id: string): Promise<{ qty: number; price: number; min: number }> {
  if (!isCrypto(id)) return { qty: 1e-6, price: 0.01, min: 0 };
  try {
    const a = await A.asset(ENV, id);
    return { qty: Number(a.min_trade_increment) || 1e-6, price: Number(a.price_increment) || 0.01, min: Number(a.min_order_size) || 0 };
  } catch { return { qty: 1e-6, price: 0.01, min: 0 }; }
}

function logFill(pf: Portfolio, p: PendingOrder, qty: number, price: number, cost: number) {
  pf.log.push({ day: S.market.day, asset: p.asset, side: p.side, qty, price, fee: cost, type: p.tag });
  if (pf.log.length > 500) pf.log.shift();
}

/** Registra nel conto di gioco le esecuzioni nuove di un ordine. Restituisce le righe da mostrare al giocatore. */
export function applyOrder(pf: Portfolio, p: PendingOrder, o: A.AlpacaOrder): { notes: string[]; atLoss: boolean; done: boolean; price: number; qty: number } {
  const notes: string[] = [];
  const a = ASSET_BY_ID[p.asset];
  const tick = a?.ticker ?? p.asset;
  const fq = Number(o.filled_qty ?? 0), avg = Number(o.filled_avg_price ?? 0);
  let atLoss = false;
  const dq = fq - p.filledQty;
  if (dq > 1e-12 && avg > 0) {
    const total = fq * avg;
    const dCost = total - p.filledCost;
    const cost = dCost * fee();
    if (p.side === 'buy') {
      pf.cash -= dCost + cost;
      p.reserved = Math.max(0, p.reserved - (dCost + cost));
      const pos = pf.positions.find((x) => x.id === p.asset);
      if (pos) { pos.qty += dq; pos.cost += dCost; } else pf.positions.push({ id: p.asset, qty: dq, cost: dCost });
      // con la leva la liquidità non scende mai sotto la Riserva: la differenza è prestito
      const floor = pf.initial * (1 - releasedFrac());
      const short = Math.min(pf.cash, floor) < floor ? floor - pf.cash : pf.cash < 0 ? -pf.cash : 0;
      if (short > 0 && p.lev) { pf.loan += short; pf.cash += short; if (!pf.interestDay) pf.interestDay = today(); }
      notes.push(`Comprate ${fmtQty(dq)} ${tick} a ${fmtPx(avg)} $ (${p.tag}).`);
    } else {
      const pos = pf.positions.find((x) => x.id === p.asset);
      if (pos) {
        atLoss = avg < pos.cost / Math.max(pos.qty, 1e-12);
        const q = Math.min(dq, pos.qty);
        // risultato realizzato: ricavo vero (al netto del costo didattico) meno il prezzo di carico della parte venduta
        pf.realized = (pf.realized ?? 0) + (dCost - cost) - pos.cost * (q / pos.qty);
        pos.cost *= 1 - q / pos.qty;
        pos.qty -= q;
        if (pos.qty < 1e-9) pf.positions = pf.positions.filter((x) => x !== pos);
      }
      let proceeds = dCost - cost;
      if (pf.loan > 0) { const repay = Math.min(pf.loan, Math.max(0, proceeds)); pf.loan -= repay; proceeds -= repay; }
      pf.cash += proceeds;
      notes.push(`Vendute ${fmtQty(dq)} ${tick} a ${fmtPx(avg)} $ (${p.tag}).`);
      // uno stop che scatta è una vendita decisa in anticipo: per la Prova in corso vale come ogni altra vendita
      if (p.type === 'stop' && pf === S.portfolio) { const c = voidExercise(p.asset); if (c) notes.push(c); }
      if (pf === S.portfolio) {
        trackMandate(p, dq, dCost - cost);
        // lo stop del piano che scatta È il piano; uno stop diverso sullo stesso titolo è una vendita fuori dal piano
        if (p.type === 'stop' && p.tag !== 'boss-stop') { const m = voidMandate(p.asset); if (m) notes.push(m); }
      }
    }
    pf.costs += cost;
    logFill(pf, p, dq, avg, cost);
    p.filledQty = fq;
    p.filledCost = total;
  }
  const done = TERMINAL.has(o.status);
  if (done) {
    pf.pending = pf.pending.filter((x) => x !== p);
    if (o.status !== 'filled') {
      // la parte non eseguita di un acquisto torna disponibile e va versata di nuovo nella tappa seguente
      const boughtBefore = credited(pf);
      const counted = p.side === 'buy' && !p.noCredit;
      if (counted) {
        const back = Math.max(0, (p.notional ?? (p.qty ?? 0) * (p.price ?? 0)) - p.filledCost);
        pf.bought = Math.max(0, pf.bought - back);
        if (pf.exBuys?.[p.asset]) pf.exBuys[p.asset] = Math.max(0, pf.exBuys[p.asset] - back);
      }
      const why = o.status === 'expired' ? 'è scaduto a fine giornata senza essere eseguito' : o.status === 'canceled' ? 'è stato annullato' : 'è stato rifiutato da Alpaca';
      notes.push(p.type === 'stop' ? `Lo stop su ${tick} ${why}: la protezione non è più attiva. Rimettilo dalla Clinica se la vuoi ancora.` : `L'ordine ${p.type === 'limit' ? 'limite' : 'a mercato'} su ${tick} ${why}.`);
      if (counted && pf === S.portfolio) notes.push(...reopenExercises(boughtBefore));
    }
  }
  return { notes, atLoss, done, price: avg, qty: fq };
}

const today = () => new Date().toISOString().slice(0, 10);

/** Dopo l'invio: qualche lettura ravvicinata per registrare subito un'esecuzione a mercato aperto. */
async function settle(pf: Portfolio, p: PendingOrder, first: A.AlpacaOrder) {
  let r = applyOrder(pf, p, first);
  for (let i = 0; i < 3 && !r.done; i++) {
    await wait(i === 0 ? 400 : 800);
    try { r = applyOrder(pf, p, await A.order(ENV, p.id)); } catch { break; }
  }
  return r;
}

function pre(asset: string): { a?: AssetDef; err?: string } {
  if (!S.flags.starter) return { err: 'Prima scegli la tua Valigetta dal Professore.' };
  if (!linked()) return { err: link.reason || 'Il conto Alpaca Paper non è collegato.' };
  const a = ASSET_BY_ID[asset];
  if (!a) return { err: 'Titolo non in vetrina.' };
  return { a };
}

/**
 * Acquisto sul conto di gioco: un ordine reale sul conto Alpaca Paper. `amount` è in dollari.
 * A mercato chiuso Alpaca accetta l'ordine e lo esegue alla riapertura: il denaro resta riservato.
 */
export async function buy(asset: string, amount: number, o: { type?: 'market' | 'limit'; price?: number; tag?: string; lev?: boolean } = {}): Promise<OrderResult> {
  const { a, err } = pre(asset);
  if (!a) return { ok: false, msg: err! };
  const pf = S.portfolio;
  const type = o.type ?? 'market';
  amount = Math.floor(amount * 100) / 100;
  if (!(amount >= 1)) return { ok: false, msg: 'Importo troppo basso: almeno 1 $.' };
  if (type === 'limit' && !(o.price! > 0)) return { ok: false, msg: 'Indica il prezzo limite.' };
  const ids = heldIds(pf);
  if (!ids.includes(asset) && ids.length >= slots()) return { ok: false, msg: `Hai già ${slots()} titoli tra posizioni e ordini: è il massimo per il tuo livello.` };
  const lev = !!o.lev && !isCrypto(asset) && leverageOpen();
  const total = amount * (1 + fee());
  const avail = usableCash(pf) + (lev ? credit(pf) : 0);
  if (total > avail + 0.005) {
    return { ok: false, msg: `Puoi investire ancora ${fmtMoney(avail)}: il resto del capitale è già nei titoli o riservato agli ordini in coda.` };
  }
  const crypto = isCrypto(asset);
  const req: A.OrderReq = { symbol: asset, side: 'buy', type, time_in_force: crypto ? 'gtc' : 'day', client_order_id: `tm-${S.saveId}-${pf.orderSeq + 1}` };
  let qty: number | undefined;
  if (type === 'market') req.notional = amount.toFixed(2);
  else {
    const inc = await increments(asset);
    const px = floorTo(o.price!, inc.price);
    qty = floorTo(amount / px, inc.qty);
    if (!(qty > 0) || qty < inc.min) return { ok: false, msg: 'Importo troppo basso per questo ordine limite.' };
    req.qty = qty.toFixed(dec(inc.qty));
    req.limit_price = px.toFixed(dec(inc.price));
    o.price = px;
  }
  let out: A.AlpacaOrder;
  try { out = await A.submitOrder(ENV, req, lev); } catch (e) { return { ok: false, msg: unreachable(e) }; }
  pf.orderSeq++;
  // un titolo venduto durante la Prova in corso si può ricomprare, ma per quella Prova non conta più
  const noCredit = (pf.exBarred ?? []).includes(asset);
  const p: PendingOrder = { id: out.id, cid: req.client_order_id, asset, side: 'buy', type, notional: type === 'market' ? amount : undefined, qty, price: o.price, reserved: total, filledQty: 0, filledCost: 0, createdAt: Date.now(), tag: o.tag ?? (type === 'limit' ? 'limite' : 'mercato'), lev, stage: S.exDone, noCredit: noCredit || undefined };
  pf.pending.push(p);
  if (!noCredit) {
    pf.bought += amount;
    pf.exBuys = { ...(pf.exBuys ?? {}), [asset]: (pf.exBuys?.[asset] ?? 0) + amount };
    if (type === 'limit') S.exTools.limit = true;
  }
  const r = await settle(pf, p, out);
  let ex = closeExercises();
  if (noCredit) ex = `${ex ? ex + ' ' : ''}${a.ticker} non conta per la Prova sul conto in corso: l'hai venduto, quindi la Prova si rifà con un altro titolo.`;
  save();
  const head = r.done && r.qty > 0 ? r.notes[0] : type === 'limit' ? `Ordine limite accettato da Alpaca: compra ${a.ticker} se il prezzo scende a ${fmtPx(o.price!)} $.${crypto ? '' : ' Vale fino alla chiusura di oggi (o della prossima seduta, se il mercato è chiuso).'}` : `Ordine accettato da Alpaca: ${fmtMoney(amount)} di ${a.ticker} saranno comprati all'apertura del mercato. Il denaro è riservato.`;
  return { ok: true, msg: head, filled: r.done && r.qty > 0, price: r.price || o.price || S.market.prices[asset], qty: r.qty, exercise: ex };
}

/** Vendite che non sono una decisione del giocatore: annullano la Prova in corso senza escludere titoli. */
const FORCED = new Set(['liquidazione', 'chiusura']);

// ---------------- Mandati dei Boss con ordini veri ----------------
/** Vendite che fanno parte del piano presentato al Boss: lo stop che scatta, l'obiettivo incassato, la chiusura a scadenza. */
const MANDATE_SELLS = new Set(['boss-stop', 'obiettivo', 'mandato']);

/**
 * Una vendita del titolo di un mandato che non fa parte del piano (dalla Clinica, dal sito di Alpaca, uno stop
 * diverso, la vendita forzata della leva) annulla la sfida con quel Boss: si ripete da capo con un altro titolo.
 */
function voidMandate(asset: string): string {
  const id = mandateOn(S.boss, asset);
  if (!id || !sellOut(S.boss, id)) return '';
  const tick = ASSET_BY_ID[asset]?.ticker ?? asset;
  return `Hai venduto ${tick}, il titolo del tuo piano con ${BOSS_BY_ID[id]?.name ?? 'il Boss'}: il mandato è annullato. Non conta come sconfitta: ripeti la sfida da capo, quiz compreso, con un titolo diverso da ${tick}.`;
}

/** Registra nel piano del Boss le vendite che ne fanno parte: servono a dire quanto capitale del conto di gioco ha mosso il mandato. */
function trackMandate(p: PendingOrder, qty: number, net: number): void {
  if (!MANDATE_SELLS.has(p.tag)) return;
  const plan = Object.values(S.boss.runs ?? {}).find((r) => r.plan?.real && r.plan.asset === p.asset)?.plan;
  if (!plan) return;
  plan.sold = (plan.sold ?? 0) + qty;
  plan.proceeds = (plan.proceeds ?? 0) + net;
}

/** Quantità già impegnata in ordini di vendita aperti. */
function committed(pf: Portfolio, asset: string): number {
  return pf.pending.filter((p) => p.side === 'sell' && p.asset === asset && p.type !== 'stop').reduce((s, p) => s + ((p.qty ?? 0) - p.filledQty), 0);
}

/**
 * Vendita (a mercato) oppure stop di protezione su una posizione del conto di gioco.
 * Lo stop su quote frazionarie vale solo per la giornata: è un limite di Alpaca, e il gioco lo dice.
 */
export async function sell(asset: string, qty: number, o: { type?: 'market' | 'stop'; price?: number; tag?: string } = {}): Promise<OrderResult> {
  const { a, err } = pre(asset);
  if (!a) return { ok: false, msg: err! };
  const pf = S.portfolio;
  const pos = pf.positions.find((p) => p.id === asset);
  if (!pos) return { ok: false, msg: 'Non possiedi questo titolo: le vendite allo scoperto non sono consentite.' };
  const type = o.type ?? 'market';
  const crypto = isCrypto(asset);
  // lo stop di un mandato tiene impegnata la posizione: prima di una vendita a mercato va tolto
  if (type === 'market') {
    const bs = pf.pending.find((p) => p.asset === asset && p.tag === 'boss-stop');
    if (bs) await cancel(bs);
  }
  // la quantità vera su Alpaca fa fede (le cripto pagano la commissione in quantità)
  let real = pos.qty;
  try { const ps = await A.positions(ENV); real = Number(ps.find((x) => x.symbol === asset.replace('/', ''))?.qty ?? 0); } catch (e) { return { ok: false, msg: unreachable(e) }; }
  const inc = await increments(asset);
  const free = Math.min(pos.qty, real) - (type === 'stop' ? 0 : committed(pf, asset));
  qty = floorTo(Math.min(qty, free), inc.qty);
  if (!(qty > 0)) return { ok: false, msg: real <= 0 ? 'Su Alpaca questa posizione non c\'è più: aggiorno il registro.' : 'Quantità non disponibile: è già impegnata in un altro ordine.' };
  const req: A.OrderReq = { symbol: asset, side: 'sell', type, time_in_force: crypto ? 'gtc' : Number.isInteger(qty) && type === 'stop' ? 'gtc' : 'day', qty: qty.toFixed(dec(inc.qty)), client_order_id: `tm-${S.saveId}-${pf.orderSeq + 1}` };
  if (type === 'stop') {
    if (!(o.price! > 0) || o.price! >= S.market.prices[asset]) return { ok: false, msg: 'Lo stop di vendita va messo sotto il prezzo attuale.' };
    const px = floorTo(o.price!, inc.price);
    req.stop_price = px.toFixed(dec(inc.price));
    // Alpaca non accetta lo stop semplice sulle cripto: stop con limite, 3% sotto
    if (crypto) { req.type = 'stop_limit'; req.limit_price = floorTo(px * 0.97, inc.price).toFixed(dec(inc.price)); }
    o.price = px;
  }
  let out: A.AlpacaOrder;
  try { out = await A.submitOrder(ENV, req); } catch (e) { return { ok: false, msg: unreachable(e) }; }
  pf.orderSeq++;
  const p: PendingOrder = { id: out.id, cid: req.client_order_id, asset, side: 'sell', type, qty, price: o.price, reserved: 0, filledQty: 0, filledCost: 0, createdAt: Date.now(), tag: o.tag ?? (type === 'stop' ? 'stop' : 'mercato') };
  pf.pending.push(p);
  // la decisione di vendere vale da subito, anche se l'ordine si esegue all'apertura; lo stop conta solo se scatta.
  // Anche la vendita forzata della leva annulla la Prova, ma senza escludere titoli: non è una scelta del giocatore.
  const cancelled = type === 'market' ? [voidExercise(asset, FORCED.has(p.tag)), MANDATE_SELLS.has(p.tag) ? '' : voidMandate(asset)].filter(Boolean).join(' ') : '';
  const stopWarn = type === 'stop' && sellCancels(asset) ? ' Se scatta è una vendita: annulla la Prova sul conto in corso, che rifarai con un altro titolo.' : '';
  if (type === 'stop' && !(pf.exBarred ?? []).includes(asset)) S.exTools.stop = true;
  const r = await settle(pf, p, out);
  const ex = closeExercises();
  save();
  const dayOnly = req.time_in_force === 'day';
  const head = r.done && r.qty > 0 ? r.notes[0] : type === 'stop' ? `Stop accettato da Alpaca: vende ${fmtQty(qty)} ${a.ticker} se il prezzo scende a ${fmtPx(o.price!)} $.${dayOnly ? ' Sulle quote frazionarie Alpaca lo tiene valido solo fino alla chiusura della seduta: domani va rimesso.' : ''}${stopWarn}` : `Ordine di vendita accettato da Alpaca: sarà eseguito all'apertura del mercato.`;
  return { ok: true, msg: head, filled: r.done && r.qty > 0, price: r.price || S.market.prices[asset], qty: r.qty || qty, atLoss: r.atLoss, exercise: ex, cancelled: cancelled || undefined };
}

/** Annulla un ordine aperto su Alpaca e aggiorna il registro. */
export async function cancel(p: PendingOrder): Promise<string> {
  try {
    await A.cancelOrder(ENV, p.id);
    await wait(300);
    const r = applyOrder(S.portfolio, p, await A.order(ENV, p.id));
    save();
    return r.notes.join(' ') || 'Annullamento inviato ad Alpaca.';
  } catch (e) { return unreachable(e); }
}

// ---------------- Sincronizzazione e riconciliazione ----------------

let syncing: Promise<string[]> | null = null;
let syncAt = 0;

/**
 * Allinea il conto di gioco alla realtà: prezzi, ordini aperti, posizioni vere, interessi della leva.
 * Restituisce le novità da raccontare al giocatore. Senza conto collegato non fa nulla.
 */
export function sync(force = false): Promise<string[]> {
  if (syncing) return syncing;
  if (!force && Date.now() - syncAt < 60_000) return Promise.resolve([]);
  syncing = (async () => {
    const notes: string[] = [];
    try {
      if (!(await checkLink(force)).paper) return notes;
      await refreshWorld(force);
      const pf = S.portfolio;
      for (const p of pf.pending.slice()) {
        try { notes.push(...applyOrder(pf, p, await A.order(ENV, p.id)).notes); }
        catch (e) {
          if (/404|not found/i.test((e as Error).message)) { pf.pending = pf.pending.filter((x) => x !== p); notes.push(`Un ordine su ${ASSET_BY_ID[p.asset]?.ticker ?? p.asset} non esiste più su Alpaca: l'ho tolto dal registro.`); }
        }
      }
      // gli ordini chiusi servono solo a dare il prezzo vero alle vendite fatte fuori dal gioco: se mancano si prosegue
      const [acc, real, closed] = await Promise.all([A.account(ENV), A.positions(ENV), A.closedOrders(ENV).catch(() => [] as A.AlpacaOrder[])]);
      notes.push(...reconcile(pf, acc, real, closed));
      accrue(pf);
      const day = today();
      if (S.flags.vhDay !== day) {
        S.flags.vhDay = day;
        const v = equity(pf);
        pf.peak = Math.max(pf.peak, v);
        pf.valueHistory.push(v);
        // le date servono ai confronti: i punti non sono giorni consecutivi, sono i giorni in cui hai aperto il gioco
        const days = (pf.valueDays ?? []).slice(-(pf.valueHistory.length - 1));
        pf.valueDays = [...Array(Math.max(0, pf.valueHistory.length - 1 - days.length)).fill(''), ...days, day];
        if (pf.valueHistory.length > 400) { pf.valueHistory.shift(); pf.valueDays.shift(); }
      }
      const exMsg = closeExercises();
      if (exMsg) notes.push(exMsg);
      patienceDay();
      syncAt = Date.now();
      save();
    } catch (e) { unreachable(e); } finally { syncing = null; }
    return notes;
  })();
  return syncing;
}

/** Impronta del conto Alpaca: cambia se il conto Paper viene azzerato, eliminato o sostituito. */
function tagOf(acc: A.AlpacaAccount): string {
  return hashString(`${acc.account_number}|${acc.created_at ?? ''}`).toString(36);
}

/**
 * Il registro non può avere più titoli di quanti Alpaca ne ha davvero. Differenze piccole (commissioni cripto
 * pagate in quantità) si correggono in silenzio; quelle grandi sono operazioni fatte fuori dal gioco e vengono
 * annotate al prezzo attuale. Se il conto è un altro (azzerato o sostituito) il registro riparte dal capitale.
 */
/**
 * Prezzo medio a cui Alpaca ha eseguito le vendite NON partite da questa partita (dashboard di Alpaca, app, altri
 * programmi) su un simbolo, dopo l'ultima riconciliazione. 0 se tra gli ordini chiusi non ce n'è nessuna.
 */
function externalSellPrice(asset: string, closed: A.AlpacaOrder[], since: number): number {
  const sym = asset.replace('/', '');
  const mine = `tm-${S.saveId}-`;
  let qty = 0, total = 0;
  for (const o of closed) {
    if (o.side !== 'sell' || o.symbol.replace('/', '') !== sym || (o.client_order_id ?? '').startsWith(mine)) continue;
    const q = Number(o.filled_qty ?? 0), px = Number(o.filled_avg_price ?? 0);
    const at = Date.parse(o.filled_at ?? o.submitted_at ?? '') || 0;
    if (!(q > 0) || !(px > 0) || at <= since) continue;
    qty += q; total += q * px;
  }
  return qty > 0 ? total / qty : 0;
}

/**
 * Allinea il registro alle posizioni vere. Una posizione che su Alpaca è più piccola del registro è stata venduta
 * fuori dal gioco: la vendita entra nel registro al prezzo vero di esecuzione (letto dagli ordini chiusi di Alpaca,
 * `closed`), il ricavo rimborsa prima il prestito e la perdita o il guadagno finiscono nel risultato realizzato.
 * Se l'ordine non si trova vale il prezzo attuale. La bancarotta si controlla dopo, sui dati aggiornati.
 */
export function reconcile(pf: Portfolio, acc: A.AlpacaAccount, real: A.AlpacaPosition[], closed: A.AlpacaOrder[] = []): string[] {
  const notes: string[] = [];
  const tag = tagOf(acc);
  if (pf.accountTag && pf.accountTag !== tag) {
    if (pf.positions.length || pf.pending.length || pf.loan > 0) {
      // gli acquisti già fatti restano contati per le Prove; quelli ancora in coda non sono mai avvenuti
      pf.bought = Math.max(0, pf.bought - unfilledBuys(pf));
      pf.positions = []; pf.pending = []; pf.loan = 0; pf.cash = pf.initial; pf.marginCallAt = 0;
      pf.external.push({ t: Date.now(), asset: '', qty: 0, note: 'conto Paper azzerato o sostituito' });
      notes.push('Il conto Paper su Alpaca è stato azzerato o sostituito: il registro di gioco riparte dal capitale iniziale. Tappe, Attestati e Sigilli restano tuoi.');
    }
  }
  pf.accountTag = tag;
  const since = pf.reconAt ?? 0;
  const qtyOf = new Map(real.map((p) => [p.symbol, Number(p.qty)]));
  const busy = new Set(pf.pending.map((p) => p.asset));
  for (const pos of pf.positions.slice()) {
    if (busy.has(pos.id)) continue; // un ordine in corso può aver già cambiato la posizione vera
    const have = qtyOf.get(pos.id.replace('/', '')) ?? 0;
    if (pos.qty <= have * (1 + 1e-9) + 1e-12) continue;
    const diff = pos.qty - have;
    const rel = diff / pos.qty;
    const basis = pos.cost * rel;
    pos.cost *= have / pos.qty;
    pos.qty = have;
    if (rel > 0.01) {
      const fillPx = externalSellPrice(pos.id, closed, since);
      const px = fillPx || (S.market.prices[pos.id] ?? 0);
      let proceeds = diff * px;
      const result = proceeds - basis;
      pf.realized = (pf.realized ?? 0) + result;
      if (pf.loan > 0) { const repay = Math.min(pf.loan, proceeds); pf.loan -= repay; proceeds -= repay; }
      pf.cash += proceeds;
      pf.external.push({ t: Date.now(), asset: pos.id, qty: diff, note: `venduto fuori dal gioco a ${fmtPx(px)} $` });
      if (pf.external.length > 50) pf.external.shift();
      const tick = ASSET_BY_ID[pos.id]?.ticker ?? pos.id;
      // una vendita fatta sul sito di Alpaca vale come una fatta nel gioco: annulla la Prova di quel titolo
      const voided = pf === S.portfolio ? [voidExercise(pos.id), voidMandate(pos.id)].filter(Boolean).join(' ') : '';
      notes.push(`Su Alpaca mancano ${fmtQty(diff)} ${tick} rispetto al registro: li registro come venduti fuori dal gioco a ${fmtPx(px)} $ (${fillPx ? 'prezzo di esecuzione letto da Alpaca' : 'prezzo attuale: l\'ordine non è tra quelli chiusi'}), con ${result < 0 ? `una perdita realizzata di ${fmtMoney(-result)}` : `un guadagno realizzato di ${fmtMoney(result)}`}.`);
      if (voided) notes.push(voided);
    }
    if (pos.qty < 1e-9) pf.positions = pf.positions.filter((x) => x !== pos);
  }
  pf.reconAt = Date.now();
  return notes;
}

// ---------------- Leva: interessi, chiamata di margine, bancarotta ----------------

/** Interesse sul prestito, calcolato per i giorni di mercato passati dall'ultima volta. */
export function accrue(pf: Portfolio, now = Date.now()): number {
  if (pf.loan <= 0) { pf.interestDay = ''; return 0; }
  const from = pf.interestDay ? Date.parse(pf.interestDay) : now;
  const days = tradingDaysBetween(from, now);
  pf.interestDay = new Date(now).toISOString().slice(0, 10);
  if (days <= 0) return 0;
  const interest = pf.loan * (LEVERAGE.interest / 252) * days;
  pf.loan += interest;
  pf.costs += interest;
  return interest;
}

export interface MarginState { loan: number; ratio: number; call: boolean; daysLeft: number; bankrupt: boolean }

/** Margine del conto di gioco: patrimonio netto sul valore dei titoli. Sotto il mantenimento scatta la chiamata. */
export function margin(pf: Portfolio = S.portfolio, now = Date.now()): MarginState {
  const pv = pf.positions.reduce((s, p) => s + p.qty * (S.market.prices[p.id] ?? 0), 0);
  const eq = equity(pf);
  const ratio = pf.loan > 0 && pv > 0 ? (pv - pf.loan) / pv : 1;
  const call = pf.loan > 0 && ratio < LEVERAGE.maintenance;
  const daysLeft = call && pf.marginCallAt ? Math.max(0, LEVERAGE.callDays - tradingDaysBetween(pf.marginCallAt, now)) : LEVERAGE.callDays;
  // bancarotta solo a conto azzerato, e solo se ogni titolo ha un prezzo vero: un prezzo mancante non è una perdita
  const priced = pf.positions.every((p) => (S.market.prices[p.id] ?? 0) > 0);
  return { loan: pf.loan, ratio, call, daysLeft, bankrupt: S.market.asOf > 0 && !!S.flags.starter && priced && eq < ZERO };
}

/** La chiamata di margine parte quando il giocatore la vede: nessuna scadenza corre mentre il gioco è chiuso. */
export function seeMarginCall(): void {
  const m = margin();
  if (m.call && !S.portfolio.marginCallAt) { S.portfolio.marginCallAt = Date.now(); save(); }
  if (!m.call && S.portfolio.marginCallAt) { S.portfolio.marginCallAt = 0; save(); }
}

/** Liquidazione forzata (solo Paper): vende quanto basta, in proporzione, per riportare il margine sopra il minimo. */
export async function liquidate(): Promise<string[]> {
  const pf = S.portfolio;
  const pv = pf.positions.reduce((s, p) => s + p.qty * (S.market.prices[p.id] ?? 0), 0);
  if (pf.loan <= 0 || pv <= 0) return [];
  const f = Math.min(1, (pf.loan * 1.1) / pv);
  const notes: string[] = [];
  for (const pos of pf.positions.slice()) {
    const r = await sell(pos.id, pos.qty * f, { tag: 'liquidazione' });
    notes.push(r.msg);
    if (r.cancelled) notes.push(r.cancelled);
  }
  pf.marginCallAt = 0;
  save();
  return notes;
}

/** Parte non eseguita degli acquisti ancora in coda: accreditata in via provvisoria, da togliere se l'ordine sparisce. */
function unfilledBuys(pf: Portfolio): number {
  return pf.pending.filter((p) => p.side === 'buy' && !p.noCredit).reduce((s, p) => s + Math.max(0, (p.notional ?? (p.qty ?? 0) * (p.price ?? 0)) - p.filledCost), 0);
}

/** Chiude tutte le posizioni e riparte con metà del capitale di partenza: la ripartenza dopo una bancarotta. */
export async function restartAfterBankruptcy(): Promise<string[]> {
  const pf = S.portfolio;
  const notes: string[] = [];
  for (const p of pf.pending.slice()) notes.push(await cancel(p));
  // la bancarotta annulla la Prova sul conto in corso: la quota della tappa riparte da zero, le Prove già fatte restano
  const ex = exercise();
  if (!ex.allDone && ex.open && !graduated() && credited(pf) > (ex.stage === 0 ? 0 : exNeed(ex.stage - 1)) + 0.005) {
    resetStage(ex.stage);
    notes.push(ignoreOn()
      ? `Con la bancarotta la Prova sul conto ${stageName(ex.stage)} sarebbe annullata. ${passIgnored(ex.stage)}`
      : `Con la bancarotta anche la Prova sul conto ${stageName(ex.stage)} è annullata: la quota della tappa riparte da zero.`);
  }
  for (const pos of pf.positions.slice()) notes.push((await sell(pos.id, pos.qty, { tag: 'chiusura' })).msg);
  const half = Math.round(startCapital() * LEVERAGE.restart);
  pf.bankruptcies += 1;
  pf.loan = 0; pf.marginCallAt = 0; pf.interestDay = '';
  // le Prove già fatte restano fatte: gli acquisti eseguiti restano contati, quelli in coda no
  pf.bought = Math.max(0, pf.bought - unfilledBuys(pf));
  pf.initial = half; pf.contributed = half; pf.cash = half; pf.peak = half;
  // le posizioni ancora in vendita (mercato chiuso) escono dal registro: il loro ricavato non rientra nel nuovo capitale
  pf.positions = []; pf.pending = [];
  S.exTools = { limit: false, stop: false };
  save();
  return notes;
}

/**
 * Dopo la Lega: aumento del capitale del conto di gioco (denaro finto del conto Paper). Il registro non può
 * superare ciò che il conto Paper contiene davvero.
 */
export async function deposit(amount: number): Promise<string> {
  const pf = S.portfolio;
  if (!graduated()) return 'Il capitale si può aumentare solo dopo la Lega.';
  try {
    const acc = await A.account(ENV);
    if (Number(acc.equity) < equity(pf) + amount) return `Il tuo conto Paper su Alpaca vale ${fmtMoney(Number(acc.equity))}: non basta per un conto di gioco più grande. Puoi azzerarlo o ricaricarlo dalla dashboard Paper di Alpaca.`;
  } catch (e) { return unreachable(e); }
  pf.cash += amount; pf.contributed += amount; pf.peak += amount;
  pf.valueHistory = pf.valueHistory.map((v) => v + amount);
  save();
  return `Capitale aumentato di ${fmtMoney(amount)}. Il rendimento resta calcolato su quanto hai versato in tutto.`;
}

// ---------------- Tempo reale ----------------

/**
 * Chiamata dal mondo (passi, duelli, viaggi) al posto dei vecchi "giorni simulati": allinea il conto alla realtà,
 * al massimo una volta al minuto, e racconta le novità. Il tempo del conto è quello vero dei mercati.
 */
export function tick(): void {
  if (!S || !S.flags.starter) return;
  void sync().then((notes) => notes.forEach((n) => toast(n)));
}

/** Pazienza: una volta per giorno di mercato reale, se hai posizioni e non vendi da dieci giorni di mercato. */
export function patienceDay(): void {
  const pf = S.portfolio;
  const d = S.market.day;
  if (!pf.positions.length || Number(S.flags.patDay ?? -1) === d || d % 10 !== 0) return;
  S.flags.patDay = d;
  if (!pf.log.some((l) => l.side === 'sell' && l.day > d - 10)) clampStat('pazienza', 1);
}
