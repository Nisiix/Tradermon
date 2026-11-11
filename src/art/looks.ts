// Aspetti dei personaggi generici (abitanti, passanti, allenatori, allievi, guardie...).
// Generati in modo deterministico: stesso seme → stesso aspetto, su ogni dispositivo e a ogni avvio.
// I personaggi principali (Professore, Rivale, Mentori, Lega...) mantengono la loro palette in art.ts.

import { mulberry32 } from '../systems/rng';

export interface Look { skin: string; hair: string; shirt: string; pants: string; extra?: string; eyes: string }

/** Carnagioni dalla più chiara alla più scura. */
export const SKINS = ['#fbd8c0', '#f5c9a0', '#eebb8e', '#e0a878', '#c98e62', '#b07850', '#8d5a3a', '#6e4430', '#5a3626'];
/** Capelli naturali (giovani e adulti). */
const HAIR = ['#1f1f2a', '#2a2018', '#3a2a1a', '#5a3418', '#6a4a2a', '#8a5a30', '#b85a28', '#c8463d', '#d8a848', '#e8c547', '#f0e0a0'];
/** Tinte vivaci, rare. */
const HAIR_DYED = ['#3d7fd9', '#ff8ab0', '#4fb06a', '#8a56c2', '#7af0ff'];
/** Capelli brizzolati, grigi e bianchi per gli anziani. */
const HAIR_ELDER = ['#8a8a8a', '#a8a8b0', '#c8c8c8', '#e8e0d0', '#f2f2f2', '#6a6a70'];
export const EYES = ['#3a2416', '#5a3418', '#6a5a28', '#2f6a40', '#2a5aa8', '#4a5868', '#7a5020', '#1f1f2a'];
const SHIRTS = [
  '#e0473d', '#3d8ee8', '#3a9a5b', '#e8c547', '#8a56c2', '#f2a541', '#5fc9c9', '#e5546b', '#f2f2f2', '#9aa5b1',
  '#2a5ea8', '#b84848', '#58a8a0', '#c870a8', '#486848', '#4858a0', '#ffb347', '#7fd1ae', '#b06ad9', '#6cc04a',
  '#d87850', '#a0c8f0', '#f0a0b0', '#c8b890', '#384858', '#f0d878', '#a05080', '#40a0d0',
];
const PANTS = ['#2d3b6b', '#3a3a3a', '#4a3a2a', '#2a2a3a', '#3a5a7a', '#5a5a6a', '#1f1f2a', '#c8b890', '#3a5a2a', '#5878b8', '#6a4a3a', '#f0f0f0', '#7a2a2a', '#585868'];
const ACCENTS = ['#e8c547', '#c84848', '#f2f2f2', '#3d7fd9', '#4fb06a'];

/** Distanza approssimativa tra due colori #rrggbb (0..441). */
function dist(a: string, b: string): number {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return Math.hypot(p(a, 0) - p(b, 0), p(a, 1) - p(b, 1), p(a, 2) - p(b, 2));
}

function buildPool(n: number, seed: number, hairOf: (r: () => number, i: number) => string): Look[] {
  const r = mulberry32(seed);
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const out: Look[] = [];
  for (let i = 0; i < n; i++) {
    const skin = SKINS[(i * 4) % SKINS.length]; // tutte le carnagioni ugualmente presenti
    const hair = hairOf(r, i);
    let shirt = pick(SHIRTS), pants = pick(PANTS);
    // maglia e pantaloni ben distinti, e maglia diversa dalla pelle
    for (let k = 0; k < 8 && (dist(shirt, pants) < 90 || dist(shirt, skin) < 60); k++) { shirt = pick(SHIRTS); pants = pick(PANTS); }
    const look: Look = { skin, hair, shirt, pants, eyes: pick(EYES) };
    if (r() < 0.3) look.extra = pick(ACCENTS);
    out.push(look);
  }
  return out;
}

/** Folla: 72 combinazioni con capelli naturali e qualche tinta. */
export const CROWD: Look[] = buildPool(72, 0x7ade, (r, i) => (i % 9 === 4 ? HAIR_DYED[Math.floor(r() * HAIR_DYED.length)] : HAIR[Math.floor(r() * HAIR.length)]));
/** Anziani: capelli grigi o bianchi. */
export const ELDERS: Look[] = buildPool(12, 0xe1de, (r) => HAIR_ELDER[Math.floor(r() * HAIR_ELDER.length)]);

/** Uniformi: cambia solo la persona (pelle, capelli, occhi), i vestiti restano quelli del ruolo. */
function uniform(base: { shirt: string; pants: string; extra?: string }, n: number, seed: number): Look[] {
  const r = mulberry32(seed);
  return Array.from({ length: n }, (_, i) => ({
    ...base,
    skin: SKINS[(i * 2 + 1) % SKINS.length],
    hair: ((h) => h[Math.floor(r() * h.length)])(r() < 0.15 ? HAIR_ELDER : HAIR),
    eyes: EYES[Math.floor(r() * EYES.length)],
  }));
}
export const GUARDS: Look[] = uniform({ shirt: '#2a5ea8', pants: '#2a2a2a', extra: '#e8c547' }, 8, 0x6a7d);
export const SPECS: Look[] = uniform({ shirt: '#1f1f2a', pants: '#1f1f2a', extra: '#c84848' }, 8, 0x5bec);

export type LookPool = 'crowd' | 'elder' | 'guard' | 'spec';
export const POOLS: Record<LookPool, Look[]> = { crowd: CROWD, elder: ELDERS, guard: GUARDS, spec: SPECS };
export const POOL_ORDER: LookPool[] = ['crowd', 'elder', 'guard', 'spec'];

/** Hash FNV-1a a 32 bit di una stringa. */
export function hashId(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Indice nel gruppo per un seme (id o nome); `bump` passa alla combinazione successiva per evitare doppioni. */
export function lookIndex(seed: string, pool: LookPool, bump = 0): number {
  const n = POOLS[pool].length;
  return (hashId(seed) + bump) % n;
}

const ELDER_RE = /pension|nonn|anzian/i;
/** Gruppo adatto a un personaggio generico, dal nome o dal mestiere. */
export function poolFor(text: string): LookPool { return ELDER_RE.test(text) ? 'elder' : 'crowd'; }
