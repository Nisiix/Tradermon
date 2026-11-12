// Funzioni comuni agli script dei PNG: API del mondo, esito dei duelli, risveglio in Clinica, rivincite con le domande sbagliate.
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

export interface WorldApi {
  warp(map: string, x: number, y: number, dir?: 0 | 1 | 2 | 3): void;
  refresh(): void;
  player(): { x: number; y: number };
  approach(npcId: string): Promise<void>;
  exclaim(npcId: string): Promise<void>;
  bumpBack(): void;
  town(): number;
}

export const TRACK_LABEL: Record<string, string> = { stocks: 'Sentiero dei Titoli', etf: 'Sentiero degli Indici', crypto: 'Sentiero Cripto', mixed: 'Sentiero Misto' };

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
    await say(['Complimenti, sei preparato!', pick(TRAINER_TIPS)], who);
  } else {
    await say('Ah! Ripassa e riprova.', who);
    await defeatRespawn(w);
  }
  w.refresh();
}

/**
 * Sconfitta in un duello: come nei classici, il giocatore si risveglia nella Clinica della città in cui si trova
 * (sui Percorsi, nell'ultima Clinica visitata; a casa se non ne ha ancora visitata una) con la Fiducia al massimo.
 */
export async function defeatRespawn(w: WorldApi) {
  beep('lose');
  // la barra arriva a zero a ogni sconfitta: è tilt solo se la Fiducia è finita prima degli errori concessi
  const tilt = lastDuelTilted;
  const town = townOf(S.map);
  const dest = town !== undefined ? { map: `clinic_${town}`, x: 5, y: 4 } : S.lastClinic;
  const atHome = !dest.map.startsWith('clinic_');
  await say([
    tilt ? `${S.name} ha perso tutta la Fiducia ed è andato in tilt!` : `${S.name} non è riuscito a rispondere alle domande e ha perso la sfida.`,
    atHome ? 'Torni di corsa a casa per riprenderti.' : town !== undefined ? 'Torni di corsa alla Clinica della città per riprenderti.' : 'Torni di corsa all\'ultima Clinica visitata per riprenderti.',
  ], 'Sistema');
  if (tilt) S.stats.reputazione = Math.round(S.stats.reputazione * 0.95);
  S.stats.fiducia = 100;
  S.lastClinic = { ...dest };
  w.warp(dest.map, dest.x, dest.y, atHome ? 0 : 1);
  save();
  if (!atHome) await say(['Ecco fatto: la tua Fiducia è tornata al massimo.', 'Ripassa con calma e ritenta la sfida quando vuoi!'], 'Dott.ssa Ratio');
}

/** Dopo una sconfitta con un Mentore o un Superiore: si riprova solo dopo aver studiato. */
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
