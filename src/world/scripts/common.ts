// Funzioni comuni agli script dei PNG: API del mondo, esito dei duelli, recupero di credito in Banca, rivincite con le domande sbagliate.
import { townOf, type NpcDef } from '../maps';
import type { Question } from '../../types';
import { S, save, addRep } from '../../systems/state';
import { track, type GameEvent } from '../../systems/progress';
import { say } from '../../ui/core';
import { storyStage } from '../../systems/quiz';
import { BY_ID } from '../../data/quiz/build';
import { TRAINER_TIPS } from '../../data/story';
import { beep } from '../../systems/audio';
import { lastDuelTilted } from '../../ui/battle';
import { pick, shuffle } from '../../systems/rng';
import { tick } from '../../systems/account';
import { T } from '../../i18n';

export interface WorldApi {
  warp(map: string, x: number, y: number, dir?: 0 | 1 | 2 | 3): void;
  refresh(): void;
  player(): { x: number; y: number };
  approach(npcId: string): Promise<void>;
  exclaim(npcId: string): Promise<void>;
  bumpBack(): void;
  town(): number;
}

export const TRACK_LABEL: Record<string, string> = { stocks: T('Sentiero dei Titoli'), etf: T('Sentiero degli Indici'), crypto: T('Sentiero Cripto'), mixed: T('Sentiero Misto') };

/** Tappa di un avversario sul Percorso r: quella in cui lo si incontra di solito (r − 1 medaglie), o più avanti se lo affronti dopo. */
export function routeStage(n: NpcDef): number {
  return Math.max(storyStage(), ((n.data?.r as number) ?? 1) - 1);
}

/**
 * Esito positivo di un'attività, in un punto solo: Reputazione, Conoscenza, avversario battuto, evento per
 * agenda e traguardi, e salvataggio. Gli script non toccano più i numeri a mano (i valori stanno in balance.ts).
 */
export function reward(o: { rep?: number; xp?: number; defeated?: string; event?: GameEvent; flag?: string; save?: boolean } = {}): void {
  if (o.defeated && !S.defeated.includes(o.defeated)) S.defeated.push(o.defeated);
  if (o.flag) S.flags[o.flag] = true;
  if (o.rep) addRep(o.rep);
  if (o.xp) S.stats.xp += o.xp;
  if (o.event) track(o.event);
  if (o.save !== false) save();
}

export async function afterDuel(win: boolean, id: string, rep: number, w: WorldApi, who: string) {
  tick();
  if (win) {
    reward({ defeated: id, rep });
    await say([T('Complimenti, sei preparat{o|a}!'), pick(TRAINER_TIPS)], who);
  } else {
    await say(T('Ah! Ripassa e riprova.'), who);
    await defeatRespawn(w);
  }
  w.refresh();
}

/**
 * Sconfitta in un duello: recupero di credito. Il giocatore torna alla Banca della città in cui si trova
 * (sui Percorsi, nell'ultima Banca visitata; a casa se non ne ha ancora visitata una) con la Fiducia al massimo.
 */
export async function defeatRespawn(w: WorldApi) {
  beep('lose');
  // la barra arriva a zero a ogni sconfitta: è tilt solo se la Fiducia è finita prima degli errori concessi
  const tilt = lastDuelTilted;
  const town = townOf(S.map);
  const dest = town !== undefined ? { map: `clinic_${town}`, x: 5, y: 4 } : S.lastClinic;
  const atHome = !dest.map.startsWith('clinic_');
  await say([
    tilt ? T('Hai perso tutta la Fiducia e sei andat{o|a} in tilt!') : T('Non sei riuscit{o|a} a rispondere alle domande e hai perso la sfida.'),
    atHome ? T('Torni di corsa a casa per riprenderti.') : town !== undefined ? T('Torni alla Banca della città per un recupero di credito.') : T('Torni all\'ultima Banca visitata per un recupero di credito.'),
  ], T('Sistema'));
  if (tilt) S.stats.reputazione = Math.round(S.stats.reputazione * 0.95);
  S.stats.fiducia = 100;
  S.lastClinic = { ...dest };
  w.warp(dest.map, dest.x, dest.y, atHome ? 0 : 1);
  save();
  if (!atHome) await say([T('Una sconfitta non chiude il conto: ti riapriamo la linea di credito e la tua Fiducia torna al massimo.'), T('Il debito lo ripaghi studiando. Ripassa con calma e ritenta la sfida quando vuoi!')], T('Dott.ssa Ratio'));
}

/** Dopo una sconfitta con una Whale o un Superiore: si riprova solo dopo aver studiato. */
export function lockRetry(key: string, wrong: string[]) {
  S.flags[`${key}_lock`] = `${S.counters.lesson ?? 0}|${S.counters.review ?? 0}`;
  S.flags[`${key}_wrong`] = wrong.join(',');
}

export function clearRetry(key: string) { delete S.flags[`${key}_lock`]; delete S.flags[`${key}_wrong`]; }

export function retryUnlocked(key: string): boolean {
  const lock = S.flags[`${key}_lock`];
  if (typeof lock !== 'string') return true;
  const [l, r] = lock.split('|').map(Number);
  return (S.counters.lesson ?? 0) > l || (S.counters.review ?? 0) > r;
}

/** Le domande sbagliate nel tentativo precedente tornano (fino a metà del duello). */
export function withPreviousMistakes(key: string, qs: Question[]): Question[] {
  const prev = String(S.flags[`${key}_wrong`] ?? '').split(',').map((id) => BY_ID[id]).filter(Boolean).slice(0, Math.floor(qs.length / 2));
  if (!prev.length) return qs;
  return shuffle([...prev, ...qs.filter((q) => !prev.includes(q))].slice(0, qs.length));
}
