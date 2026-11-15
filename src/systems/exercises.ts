// Prove sul conto: gli acquisti richiesti a ogni tappa (quote sul capitale iniziale), l'attrezzo della tappa, i
// Sigilli e la scelta di ignorare la Prova. Staccato da systems/account.ts, che lo riesporta: chi importa da
// account continua a funzionare.
import type { Portfolio } from '../types';
import { S, save, addRep } from './state';
import { ASSET_BY_ID, unlockedAssets } from '../data/assets';
import { DIFFICULTY, RATE, STAGES, STAGE_TOOL, REWARD, PROVA_IGNORE } from './balance';
import { T, listJoin } from '../i18n';
import { graduated } from './account';

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

export function heldIds(pf: Portfolio): string[] {
  return [...new Set([...pf.positions.map((p) => p.id), ...pf.pending.filter((p) => p.side === 'buy').map((p) => p.asset)])];
}

export function toolOk(k: number): boolean {
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

export const stageName = (k: number) => (k === 0 ? T('della Valigetta') : T`della tappa ${k}`);

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
export function resetStage(k: number): number {
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
export function finishStage(): void {
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

export const IGNORE_WARNING = T('Scelta sconsigliata se vuoi imparare a investire o a fare trading in modo efficiente e corretto: la Prova serve proprio a mettere in pratica il metodo.');

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
export function passIgnored(k: number): string {
  const pf = S.portfolio;
  pf.exSkip = (pf.exSkip ?? 0) + Math.max(0, exNeed(k) - credited(pf));
  pf.exIgnored = [...new Set([...(pf.exIgnored ?? []), k])];
  S.exDone = k + 1;
  S.exTools = { limit: false, stop: false };
  finishStage();
  const seals = grantSeals();
  return T`Hai attivato "Prosegui anche se la Prova va male": l'esito negativo viene ignorato, la Prova ${stageName(k)} conta come superata e puoi proseguire.${seals.length ? T` Sigillo pratico ${listJoin(seals)} ottenuto.` : ''} ${IGNORE_WARNING}`;
}

/**
 * Regola delle sfide: decidere di vendere il titolo di una Prova, anche solo in parte, annulla la Prova. La quota
 * della tappa riparte da zero (le Prove già completate restano), gli attrezzi vanno riusati e il titolo venduto non
 * conta più finché la Prova non è completata con un altro titolo. Restituisce la frase per il giocatore ('' se la
 * vendita non tocca nessuna Prova).
 */
export function voidExercise(asset: string, forced = false): string {
  const hit = sellCancels(asset);
  if (!hit) return '';
  const pf = S.portfolio;
  const k = hit.stage;
  resetStage(k);
  const tick = ASSET_BY_ID[asset]?.ticker ?? asset;
  if (ignoreOn()) return T`${forced ? T`La vendita forzata della leva ha venduto ${tick}` : T`Hai venduto ${tick}`}: la Prova sul conto ${stageName(k)} sarebbe annullata. ${passIgnored(k)}`;
  // la vendita forzata non è una scelta del giocatore: annulla la Prova, ma non esclude nessun titolo
  if (forced) return T`La vendita forzata della leva ha venduto ${tick}: la Prova sul conto ${stageName(k)} è annullata e riparte da zero.${ignoreHint()}`;
  const barred = new Set([...(pf.exBarred ?? []), asset]);
  const others = unlockedAssets(S.track, S.mixedClasses, S.badges, Object.keys(S.cards)).some((a) => !barred.has(a.id));
  pf.exBarred = others ? [...barred] : [];
  const head = T`Hai venduto ${tick}: la Prova sul conto ${stageName(k)} è annullata e riparte da zero. Vendere il titolo di una Prova, anche solo una parte, vuol dire rinunciare a quel titolo.`;
  return (others
    ? T`${head} Rifai la Prova con un altro titolo: gli acquisti di ${tick} non contano finché non la completi.`
    : T`${head} In vetrina non ci sono altri titoli, quindi puoi rifarla anche con ${tick}.`) + ignoreHint();
}

/** L'opzione "prosegui anche se la Prova va male" si presenta la prima volta che una Prova si annulla, dove serve. */
export function ignoreHint(): string {
  if (!ignoreAllowed() || ignoreOn() || S.flags.ignoreHint) return '';
  S.flags.ignoreHint = true;
  return T(' In questa difficoltà puoi attivare, dalle Opzioni (⚙ o menu di gioco), "Prove sul conto: prosegui anche se vanno male": l\'esito negativo viene ignorato e prosegui lo stesso. ') + IGNORE_WARNING;
}

/** Dopo un ordine accettato: chiude gli esercizi completati (in ordine) e dice quali. */
export function closeExercises(): string {
  let msg = '';
  for (;;) {
    const ex = exercise();
    if (ex.allDone || !ex.open || ex.got + 0.005 < ex.need || !ex.toolOk) break;
    S.exDone = ex.stage + 1;
    S.exTools = { limit: false, stop: false };
    msg = T`Esercizio ${ex.stage === 0 ? T('della Valigetta') : T('della tappa ') + ex.stage} completato: l'ordine è stato accettato da Alpaca.`;
  }
  if (msg) finishStage();
  const seals = grantSeals();
  if (seals.length) msg += T` Sigillo pratico ${listJoin(seals)} ottenuto: l'Attestato è completo!`;
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
    // il premio è lo stesso qualunque sia l'ultimo pezzo arrivato (Prova sul conto, da qualsiasi Banca),
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
 * Dopo Wall Street non si torna indietro.
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
  notes.push(T`${S.exDone === 0 ? T('L\'esercizio della Valigetta') : T`L'esercizio della tappa ${S.exDone}`} torna da fare: l'ordine non è stato eseguito, quindi la quota della tappa non è stata investita davvero.`);
  const keep = Math.max(0, S.exDone - 1);
  if (S.seals > keep) {
    notes.push(T`${S.seals - keep === 1 ? T`Il Sigillo ${S.seals} resta sospeso` : T`I Sigilli da ${keep + 1} a ${S.seals} restano sospesi`} finché non investi la quota con un acquisto eseguito.`);
    S.seals = keep;
  }
  return notes;
}

/** Rata ancora da versare per l'esercizio in corso (0 se manca solo l'attrezzo). */
export function exMissing(): number {
  const ex = exercise();
  return ex.allDone ? 0 : Math.max(0, ex.need - ex.got);
}

