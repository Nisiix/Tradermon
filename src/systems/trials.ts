// Prove pratiche di Wall Street: non sono replay del passato, sono controlli sul conto di gioco com'è adesso.
// Il giocatore opera con ordini veri sul mercato attuale (conto Alpaca Paper) e la prova verifica se l'obiettivo
// è stato raggiunto. Gli obiettivi riguardano il metodo (quanto è investito, come è diviso, come è protetto):
// mai un rendimento, che nessuno controlla. Una prova non riuscita si sistema con altri ordini e si ripete.
import type { Portfolio } from '../types';
import { S } from './state';
import { ASSET_BY_ID, isDefensive, unlockedAssets } from '../data/assets';
import { margin } from './account';
import { pctArt } from './portfolio';

export const TRIAL = {
  /** Quota minima del patrimonio investita (prove 1 e del Campione). */
  invested: 0.5,
  /** Numero minimo di titoli diversi. */
  assets: 3,
  /** Peso massimo di un solo titolo sul totale investito. */
  maxWeight: 0.4,
  /** Quota dell'investito coperta da ordini stop attivi. */
  stopCover: 0.25,
  /** Scostamento massimo (punti) tra la quota rischiosa dell'investito e quella del proprio piano. */
  planGap: 15,
  /** Decisioni motivate nel Diario. */
  journal: 3,
} as const;

export interface Book {
  equity: number;
  invested: number;
  /** Valore per titolo, solo posizioni eseguite. */
  byAsset: Record<string, number>;
  maxWeight: number;
  /** Quota dell'investito coperta da stop attivi (0-1). */
  stopCover: number;
  /** Quota rischiosa dell'investito, in punti (0-100). */
  risky: number;
  /** Quota rischiosa prevista dal piano del giocatore, in punti. */
  riskyPlan: number;
  defensive: boolean;
  /** Acquisti accettati ma non ancora eseguiti (mercato chiuso). */
  waiting: number;
}

/** Fotografia del conto di gioco per le prove: contano solo le posizioni eseguite, non gli ordini in coda. */
export function book(pf: Portfolio = S.portfolio, prices: Record<string, number> = S.market.prices): Book {
  const byAsset: Record<string, number> = {};
  let invested = 0;
  let risky = 0;
  let defensive = false;
  for (const p of pf.positions) {
    const v = p.qty * (prices[p.id] ?? 0);
    if (!(v > 0)) continue;
    byAsset[p.id] = v;
    invested += v;
    if (isDefensive(ASSET_BY_ID[p.id])) defensive = true; else risky += v;
  }
  let stops = 0;
  for (const o of pf.pending) {
    if (o.side !== 'sell' || o.type !== 'stop') continue;
    stops += Math.max(0, (o.qty ?? 0) - o.filledQty) * (prices[o.asset] ?? 0);
  }
  const t = pf.target;
  const planTot = t.risky + t.defensive;
  return {
    equity: pf.cash + invested - pf.loan,
    invested,
    byAsset,
    maxWeight: invested > 0 ? Math.max(...Object.values(byAsset)) / invested : 0,
    stopCover: invested > 0 ? Math.min(1, stops / invested) : 0,
    risky: invested > 0 ? (risky / invested) * 100 : 0,
    riskyPlan: planTot > 0 ? (t.risky / planTot) * 100 : 100,
    defensive,
    waiting: pf.pending.filter((o) => o.side === 'buy').length,
  };
}

export interface Check { label: string; ok: boolean; now: string }
export interface TrialResult { ok: boolean; checks: Check[]; waiting: number }
export interface Trial { id: string; title: string; brief: string; checks: (b: Book) => Check[] }

const pct = (x: number) => `${Math.round(x * 100)}%`;

function cInvested(b: Book): Check {
  return { label: `Almeno il ${pct(TRIAL.invested)} del patrimonio investito`, ok: b.equity > 0 && b.invested + 0.005 >= b.equity * TRIAL.invested, now: b.equity > 0 ? pct(b.invested / b.equity) : '0%' };
}
function cAssets(b: Book): Check {
  const n = Object.keys(b.byAsset).length;
  return { label: `Almeno ${TRIAL.assets} titoli diversi`, ok: n >= TRIAL.assets, now: String(n) };
}
function cDefensive(b: Book): Check | null {
  // si chiede un titolo difensivo solo se il percorso del giocatore ne offre almeno uno
  const avail = unlockedAssets(S.track, S.mixedClasses, S.badges, Object.keys(S.cards)).some((a) => isDefensive(a));
  return avail ? { label: 'Almeno un titolo difensivo (obbligazioni, oro, stablecoin o azioni a basso rischio)', ok: b.defensive, now: b.defensive ? 'sì' : 'no' } : null;
}
function cWeight(b: Book): Check {
  return { label: `Nessun titolo oltre il ${pct(TRIAL.maxWeight)} dell'investito`, ok: b.invested > 0 && b.maxWeight <= TRIAL.maxWeight + 0.005, now: b.invested > 0 ? pct(b.maxWeight) : 'niente investito' };
}
function cStops(b: Book): Check {
  return { label: `Ordini stop attivi su almeno il ${pct(TRIAL.stopCover)} dell'investito`, ok: b.invested > 0 && b.stopCover + 0.005 >= TRIAL.stopCover, now: pct(b.stopCover) };
}
function cPlan(b: Book): Check {
  const gap = Math.abs(b.risky - b.riskyPlan);
  const plan = Math.round(b.riskyPlan);
  const lo = Math.max(0, plan - TRIAL.planGap), hi = Math.min(100, plan + TRIAL.planGap);
  return { label: `Titoli rischiosi tra ${pctArt(lo)} e ${pctArt(hi)} di quanto hai investito (il tuo piano dice ${plan}%)`, ok: b.invested > 0 && gap <= TRIAL.planGap + 0.05, now: b.invested > 0 ? `${Math.round(b.risky)}%` : 'niente investito' };
}
function cJournal(): Check {
  const n = S.journal.filter((j) => (j.reason ?? '').trim().length > 0).length;
  return { label: `Almeno ${TRIAL.journal} decisioni motivate nel Diario`, ok: n >= TRIAL.journal, now: String(n) };
}
function cCalm(): Check {
  const call = margin().call;
  return { label: 'Nessuna chiamata di margine aperta', ok: !call, now: call ? 'aperta' : 'nessuna' };
}

const some = (xs: (Check | null)[]) => xs.filter((x): x is Check => !!x);

/** Prova pratica del Superiore i (0-4). La terza (Regole) resta lo sportello delle offerte e non passa dal conto. */
export function leagueTrial(i: number): Trial | null {
  switch (i) {
    case 0: return { id: 'l1', title: 'Capitale al lavoro', brief: 'Tassi e cicli non si prevedono: ci si prepara. Mostrami un conto investito davvero, diviso tra più titoli e con una parte che regge quando il vento gira.', checks: (b) => some([cInvested(b), cAssets(b), cDefensive(b)]) };
    case 1: return { id: 'l2', title: 'Entrata e uscita', brief: 'Un grafico serve a decidere prima dove si esce. Mostrami un conto senza scommesse su un solo titolo e con gli stop già piazzati su Alpaca.', checks: (b) => [cWeight(b), cStops(b)] };
    case 2: return null;
    case 3: return { id: 'l4', title: 'Il piano prima dell\'umore', brief: 'La mente fredda si vede dai fatti: un conto che somiglia al piano che ti sei dat{o|a}, e decisioni scritte con il loro motivo.', checks: (b) => [cPlan(b), cJournal()] };
    default: return { id: 'l5', title: 'La prova del Campione', brief: 'Tutto insieme, sul tuo conto, oggi: investito, diviso, protetto, fedele al piano.', checks: (b) => some([cInvested(b), cAssets(b), cWeight(b), cStops(b), cPlan(b), cCalm()]) };
  }
}

export function runTrial(t: Trial, pf: Portfolio = S.portfolio, prices: Record<string, number> = S.market.prices): TrialResult {
  const b = book(pf, prices);
  const checks = t.checks(b);
  return { ok: checks.every((c) => c.ok), checks, waiting: b.waiting };
}
