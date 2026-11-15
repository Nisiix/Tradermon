// Dove si studia ciò che si chiede: ogni duello fuori dalle grotte interroga sugli argomenti che la Biblioteca della
// città in cui ti trovi spiega, e dopo un errore rimanda a quella Biblioteca. A Borgo Semina la Biblioteca non c'è:
// lì (e sul Percorso 1 finché non arrivi a Ponte Cedola) si chiede solo ciò che ti ha spiegato la Mamma.
import type { QuizTopic } from '../types';
import { S } from '../systems/state';
import { getMap } from './maps';
import { mentorTopics } from '../data/quiz/build';
import { TOWNS } from '../data/story';
import { T } from '../i18n';
import { progressCity } from '../systems/quiz';

/** Scaffali comuni a tutte le Biblioteche: gli stessi temi per ogni percorso. */
export const RULES_SHELF: QuizTopic[] = ['regole', 'personale'];
export const ECONOMY_SHELF: QuizTopic[] = ['macro', 'tassi', 'analisi'];

/**
 * Città la cui Biblioteca vale per il posto `mapId`: la città stessa (anche dentro i suoi edifici); su un Percorso la
 * città verso cui porta, se l'hai già raggiunta, altrimenti quella da cui arrivi. 0 = Borgo Semina, senza Biblioteca.
 * undefined fuori dalle città e dai Percorsi (Wall Street, grotte, Accademia): lì valgono le regole di quei posti.
 */
export function studyTown(mapId: string = S.map): number | undefined {
  let m = getMap(mapId);
  for (let i = 0; m && m.interior && i < 4; i++) m = m.warps[0] ? getMap(m.warps[0].to) : m;
  if (!m) return undefined;
  if (m.town !== undefined) return m.town >= 0 && m.town <= 8 ? m.town : undefined;
  const r = /^r(\d+)$/.exec(m.id);
  if (!r) return undefined;
  const k = Number(r[1]);
  if (k < 1 || k > 8) return undefined;
  return S.visited.includes(`t${k}`) ? k : k - 1;
}

/** Temi dello scaffale della città n (quelli della sua Whale). */
export function cityTopics(n: number): QuizTopic[] {
  return n ? mentorTopics(n, S.track, S.mixedClasses) : [];
}

/** Tutti i temi che la Biblioteca della città n spiega: i suoi, quelli delle città già attraversate e gli scaffali comuni. */
export function libraryTopics(n: number): QuizTopic[] {
  if (!n) return [];
  const out = new Set<QuizTopic>([...RULES_SHELF, ...ECONOMY_SHELF]);
  for (let i = 1; i <= n; i++) cityTopics(i).forEach((t) => out.add(t));
  return [...out];
}

/** Nome dello scaffale della Biblioteca n su cui sta il tema (come lo vedi nella stanza). */
export function shelfLabel(n: number, topic: QuizTopic): string {
  if (cityTopics(n).includes(topic)) return T`Temi di ${TOWNS[n]?.name ?? ''}`;
  if (RULES_SHELF.includes(topic)) return T('Regole e finanza personale');
  if (ECONOMY_SHELF.includes(topic)) return T('Economia e mercati');
  return T('Città già attraversate');
}

/**
 * Argomenti che si possono chiedere qui: quelli già studiati che la Biblioteca della città spiega.
 * Se il filtro non lascia nulla (o il posto non ha una città) restano tutti quelli studiati.
 */
export function localTopics(studied: QuizTopic[], mapId: string = S.map): QuizTopic[] {
  const n = studyTown(mapId);
  if (n === undefined || n === 0) return studied;
  const lib = libraryTopics(n);
  const out = studied.filter((t) => lib.includes(t));
  return out.length ? out : studied;
}

/** Vero dove non c'è ancora una Biblioteca: a Borgo Semina e sul Percorso 1 prima di Ponte Cedola. */
export function momPlace(mapId: string = S.map): boolean {
  return studyTown(mapId) === 0;
}

/**
 * Città raggiunta valida per un duello qui: quella del viaggio, ma se torni in una città già attraversata valgono i
 * concetti della sua Biblioteca (vedi data/quiz/progress.ts).
 */
export function localCity(mapId: string = S.map): number {
  const n = studyTown(mapId);
  const p = progressCity();
  return n !== undefined && n >= 1 ? Math.min(n, p) : p;
}
