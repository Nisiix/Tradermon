// Carattere dell'investitore: Disciplina, Pazienza e gradi della Reputazione.
// Le statistiche non cambiano mai il denaro: aprono dialoghi, titoli, scaffali e l'epilogo.
import { S, clampStat } from './state';
import { REP_TIERS, TRAIT_HIGH, TRAIT_LOW } from './balance';
import type { Portfolio } from '../types';
import { T } from '../i18n';

export function repTier(rep = S.stats.reputazione): { index: number; name: string; next?: number } {
  let i = 0;
  REP_TIERS.forEach((t, k) => { if (rep >= t.min) i = k; });
  return { index: i, name: REP_TIERS[i].name, next: REP_TIERS[i + 1]?.min };
}

/** Grado minimo per i Fascicoli riservati dell'Archivio e per le rivincite delle Whale. */
export const TIER_ARCHIVE = 2; // Stimato
export const TIER_MENTOR_REMATCH = 3; // Rinomato

export const highDisc = () => S.stats.disciplina >= TRAIT_HIGH;
export const highPat = () => S.stats.pazienza >= TRAIT_HIGH;

/** Saluto degli abitanti in base al grado di Reputazione. */
export function repGreeting(): string {
  switch (repTier().index) {
    case 0: return '';
    case 1: return T`Ah, tu sei ${S.name}! In città qualcuno parla di te.`;
    case 2: return T`${S.name}! Tutti dicono che sei {un investitore serio|un'investitrice seria}. È un onore.`;
    case 3: return T`Non ci credo, ${S.name} in persona! Le Whale parlano bene di te.`;
    default: return T`${S.name}, la leggenda della regione! Posso stringerti la mano?`;
  }
}

/** Il commento della Whale sul carattere, quando consegna la Medaglia. */
export function mentorCharacterLine(): string {
  const d = S.stats.disciplina, p = S.stats.pazienza;
  if (d >= TRAIT_HIGH && p >= TRAIT_HIGH) return T('Hai disciplina e pazienza: sono le due qualità che nessun mercato può comprare.');
  if (d >= TRAIT_HIGH) return T('Hai disciplina: segui il piano anche quando è scomodo. Lavora sulla pazienza, lascia lavorare il tempo.');
  if (p >= TRAIT_HIGH) return T('Sei paziente, e il tempo ti ripaga. Ora rafforza la disciplina: decidi con un piano, non con l\'umore.');
  if (d <= TRAIT_LOW) return T('Attent{o|a}: troppe scelte d\'impulso. Una regola scritta prima di comprare vale più di mille previsioni.');
  if (p <= TRAIT_LOW) return T('Vendi e compri troppo in fretta. Il mercato premia chi sa aspettare.');
  return T('Il tuo carattere da investitore si sta formando: le scelte di ogni giorno contano quanto le risposte.');
}

/** Epilogo dopo Wall Street, diverso secondo il carattere. */
export function epilogue(): string[] {
  const d = S.stats.disciplina, p = S.stats.pazienza;
  if (d >= TRAIT_HIGH && p >= TRAIT_HIGH) return [T('Anni dopo, a Capitalia si racconta di {un investitore|un\'investitrice} che non inseguiva le mode.'), T('Comprava con un piano, aspettava con calma e insegnava ai giovani a fare lo stesso. {Quell\'investitore|Quell\'investitrice} eri tu.')];
  if (d >= TRAIT_HIGH) return [T('Negli anni il tuo piano scritto è diventato famoso: lo copiano in tanti.'), T('Qualche volta hai venduto troppo presto, ma non hai mai rotto le tue regole.')];
  if (p >= TRAIT_HIGH) return [T('Gli anni sono passati e i tuoi investimenti sono cresciuti piano piano.'), T('Non sempre avevi un piano preciso, ma sapevi aspettare: il tempo ha fatto il resto.')];
  return [T('Wall Street è tua, ma il viaggio vero comincia ora.'), T('Disciplina e pazienza si allenano ogni giorno: torna a trovare le Whale quando vuoi.')];
}

// ---------------- Azioni sul conto che formano il carattere ----------------

/** Acquisto: concentrare oltre metà del portafoglio su un solo asset abbassa la Disciplina. */
export function onBuy(shareOfPortfolio: number): void {
  if (shareOfPortfolio > 0.5) clampStat('disciplina', -3);
}

/** Una riga di Diario dopo un'operazione: decidere con una ragione scritta alza la Disciplina. */
export function onJournal(): void { clampStat('disciplina', 2); }

/** Vendita in perdita pochi giorni dopo l'acquisto: la Pazienza scende. */
export function onSell(pf: Portfolio, asset: string, atLoss: boolean, day: number): void {
  if (!atLoss) return;
  const lastBuy = [...pf.log].reverse().find((l) => l.asset === asset && l.side === 'buy');
  if (lastBuy && day - lastBuy.day < 5) clampStat('pazienza', -2);
}

/** Ogni 10 giorni di mercato senza vendite, con almeno una posizione aperta, la Pazienza sale. */
export function onMarketDay(pf: Portfolio, day: number): void {
  if (day % 10 !== 0 || !pf.positions.length) return;
  if (!pf.log.some((l) => l.side === 'sell' && l.day > day - 10)) clampStat('pazienza', 1);
}
