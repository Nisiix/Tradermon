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
  it('le grotte buie si incontrano solo dopo la Whale che dà la Lanterna: chi arriva a una bocca può già entrare', () => {
    const mouths = allMapIds().filter((id) => !id.startsWith('cave_') && getMap(id).warps.some((w) => w.lock === 'dark'));
    expect(mouths.sort()).toEqual(['r6', 'r7', 'r8', 't6', 't7']);
    // ogni grotta è buia: nessuna bocca senza il blocco della Lanterna
    for (const id of allMapIds()) for (const w of getMap(id).warps) if (w.to.startsWith('cave_') && !id.startsWith('cave_')) expect(w.lock, `${id} → ${w.to}`).toBe('dark');
    // con un Attestato in meno nessuna bocca è raggiungibile; con la Lanterna la prima grotta si apre subito
    const before = mapsOf(explore(ABILITY.dark.badge - 1).seen);
    for (const id of mouths) expect(before.has(id), id).toBe(false);
    expect(mapsOf(explore(ABILITY.dark.badge).seen).has('cave_gold')).toBe(true);
    // le altre due seguono il viaggio: Galleria del Dark Pool dal Percorso 7, Grotta delle Perle dal Percorso 8
    expect(mapsOf(explore(5).seen).has('cave_dp')).toBe(false);
    expect(mapsOf(explore(6).seen).has('cave_dp')).toBe(true);
    expect(mapsOf(explore(6).seen).has('cave_pearl')).toBe(false);
    expect(mapsOf(explore(7).seen).has('cave_pearl')).toBe(true);
  });
});
