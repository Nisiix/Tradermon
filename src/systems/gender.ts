// Testi accordati al genere del protagonista (S.gender, scelto all'inizio con il Prof. Saldi).
// Nei testi si scrive {maschile|femminile}: "Benvenut{o|a}!", "{il nuovo Campione|la nuova Campionessa}".
// say(), choose() e toast() lo risolvono da soli; altrove si usa gtext() o g().
import { S } from './state';

const PAIR = /\{([^{}|]*)\|([^{}|]*)\}/g;

export const isFemale = (): boolean => S?.gender === 'f';

/** Sceglie la forma giusta: g('pronto', 'pronta'). */
export const g = (m: string, f: string): string => (isFemale() ? f : m);

/** Risolve tutti i {maschile|femminile} di un testo. */
export function gtext(s: string): string {
  return s.replace(PAIR, (_, m: string, f: string) => g(m, f));
}
