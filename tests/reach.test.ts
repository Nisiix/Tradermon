import { describe, it, expect } from 'vitest';
import { allMapIds, getMap } from '../src/world/maps';
import { ABILITY } from '../src/world/travel';
import { explore, mapsOf, type St } from './reachSim';

describe('struttura del mondo', () => {
  it('con N Medaglie non si arriva oltre la città N+1 (nessuna scorciatoia salta un\'Accademia)', () => {
    for (let b = 0; b <= 8; b++) {
      const maps = mapsOf(explore(b).seen);
      for (let n = 1; n <= 8; n++) expect(maps.has(`academy_${n}`), `Medaglie ${b}: Accademia ${n}`).toBe(n <= b + 1);
      expect(maps.has('league'), `Medaglie ${b}: Lega`).toBe(b >= 8);
    }
  });
  it('con tutte le Medaglie ogni luogo del mondo è raggiungibile', () => {
    const maps = mapsOf(explore(8).seen);
    const missing = allMapIds().filter((id) => id !== 'tower' && !maps.has(id));
    expect(missing).toEqual([]);
  });
  it('da ogni casella raggiungibile si torna sempre a casa (nessun vicolo senza uscita)', () => {
    for (const b of [0, 2, 3, 4, 5, 7, 8]) {
      const { seen, edges, start } = explore(b);
      const back = new Map<St, St[]>();
      for (const [f, ts] of edges) for (const t of ts) (back.get(t) ?? back.set(t, []).get(t)!).push(f);
      const ok = new Set<St>([start]);
      const q = [start];
      while (q.length) for (const p of back.get(q.shift()!) ?? []) if (!ok.has(p)) { ok.add(p); q.push(p); }
      const stuck = [...seen].filter((s) => !ok.has(s));
      expect(stuck.slice(0, 5), `Medaglie ${b}`).toEqual([]);
    }
  });
  it('la Miniera dei Lingotti si apre dal percorso che segue la Whale della Lanterna (chi arriva alla bocca può già entrare)', () => {
    const route = ABILITY.dark.badge + 1;
    const mouths = allMapIds().filter((id) => getMap(id).warps.some((w) => w.to === 'cave_gold'));
    expect(mouths.sort()).toEqual([`r${route}`, `t${route}`].sort());
    // con un Attestato in meno la bocca della miniera non è nemmeno raggiungibile
    const before = mapsOf(explore(ABILITY.dark.badge - 1).seen);
    expect(before.has(`r${route}`)).toBe(false);
    expect(mapsOf(explore(ABILITY.dark.badge).seen).has('cave_gold')).toBe(true);
  });
});
