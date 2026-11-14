// Grotte: struttura delle tre grotte (due livelli, scale, stanze chiuse dai massi, bivi della Miniera), reperti,
// domande riservate (mai viste prima, del livello giusto, mai fuori dalle grotte), taccuini, traguardi e arredi.
import { describe, it, expect, beforeEach } from 'vitest';
import { getMap, allMapIds, GOLD_ENTRY, type MapDef } from '../src/world/maps';
import { SOLID, TILE, DECOR_TILE, WALL_DECOR } from '../src/art/art';
import { CAVES, RELICS, relicFlag, relicsOf, caveOf, TRAPS, OYSTER_LEVEL, type CaveKey } from '../src/world/caves';
import { newGame, S } from '../src/systems/state';
import { pickCaveQuestions, pickQuestions, targetDiff, diffMix } from '../src/systems/quiz';
import { caveQuestions, byTopic, trackTopics, QUESTIONS } from '../src/data/quiz/build';
import { BOOK_BY_ID } from '../src/data/books';
import { SOURCES } from '../src/data/sources';
import { ACHIEVEMENTS, DECOR_INFO, checkAchievements } from '../src/systems/progress';
import { decorateHome } from '../src/world/decor';
import { trackForMap, TRACKS } from '../src/systems/music';
import { studyHint } from '../src/data/quiz/hint';

const KEYS = Object.keys(CAVES) as CaveKey[];
const CRYSTALS = [TILE.CRYSTAL_GOLD, TILE.CRYSTAL_DARK, TILE.CRYSTAL_SEA];

/** Caselle raggiungibili a piedi dentro una mappa (senza usare passaggi). boulders: i massi sono già stati rotti. */
function walk(m: MapDef, sx: number, sy: number, boulders: boolean, water = true): Set<string> {
  const block = new Set(m.npcs.filter((n) => n.kind !== 'relic').map((n) => `${n.x},${n.y}`));
  const free = (x: number, y: number) => {
    const t = m.tiles[y]?.[x];
    if (t === undefined || block.has(`${x},${y}`)) return false;
    if (t === TILE.BOULDER) return boulders;
    if (t === TILE.WATER) return water;
    return !SOLID.has(t);
  };
  const seen = new Set([`${sx},${sy}`]);
  const q: [number, number][] = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || !free(nx, ny) || m.warps.some((w) => w.x === nx && w.y === ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}
const nextTo = (seen: Set<string>, x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`));

describe('struttura delle grotte', () => {
  it('ogni grotta ha due livelli collegati da una scala nei due sensi, cristalli del suo colore e incisioni che danno Conoscenza', () => {
    for (const k of KEYS) {
      const [up, down] = CAVES[k].maps.map((id) => getMap(id));
      expect(up.cave, up.id).toBe(k); expect(down.cave, down.id).toBe(k);
      expect(caveOf(up.id)).toBe(k); expect(caveOf(down.id)).toBe(k);
      const a = up.warps.find((w) => w.to === down.id)!, b = down.warps.find((w) => w.to === up.id)!;
      expect(a, `${k}: scala in discesa`).toBeDefined(); expect(b, `${k}: scala in salita`).toBeDefined();
      expect(up.tiles[a.y][a.x]).toBe(TILE.LADDER); expect(down.tiles[b.y][b.x]).toBe(TILE.LADDER);
      // si arriva accanto alla scala dell'altro livello, su una casella libera
      expect(SOLID.has(down.tiles[a.ty][a.tx])).toBe(false); expect(Math.abs(a.tx - b.x) + Math.abs(a.ty - b.y)).toBe(1);
      expect(SOLID.has(up.tiles[b.ty][b.tx])).toBe(false); expect(Math.abs(b.tx - a.x) + Math.abs(b.ty - a.y)).toBe(1);
      for (const m of [up, down]) {
        const cr = m.tiles.flat().filter((t) => CRYSTALS.includes(t as never));
        expect(cr.length, `${m.id}: cristalli`).toBeGreaterThanOrEqual(3);
        expect(new Set(cr).size, `${m.id}: un solo colore`).toBe(1);
        expect(m.signs.length, `${m.id}: incisioni`).toBeGreaterThanOrEqual(1);
        for (const s of m.signs) { expect(m.tiles[s.y][s.x], `${m.id} ${s.x},${s.y}`).toBe(TILE.TABLET); expect(s.xp).toBe(true); }
      }
    }
    // nessuna mappa di grotta resta fuori dall'elenco
    expect(allMapIds().filter((id) => id.startsWith('cave_')).sort()).toEqual(KEYS.flatMap((k) => CAVES[k].maps).sort());
  });

  it('tre reperti per grotta, ognuno al suo posto; l\'ultimo sta in una stanza chiusa da un Masso delle Commissioni', () => {
    expect(RELICS.length).toBe(9);
    for (const k of KEYS) {
      const maps = CAVES[k].maps.map((id) => getMap(id));
      const spots = maps.flatMap((m) => m.npcs.filter((n) => n.kind === 'relic' || n.kind === 'oyster').map((n) => ({ m, n })));
      expect(spots.length, k).toBe(3);
      expect(relicsOf(k).length).toBe(3);
      if (k === 'pearl') expect(spots.map((s) => s.n.data?.n).sort()).toEqual([1, 2, 3]);
      else expect(spots.map((s) => s.n.data?.relic).sort()).toEqual(relicsOf(k).map((r) => r.id).sort());
      for (const { m, n } of spots) expect(m.tiles[n.y][n.x], `${n.id}`).toBe(TILE.CAVE);
      // livello inferiore: un masso interno, e dietro c'è l'ultimo reperto (irraggiungibile finché il masso è intero)
      const down = maps[1];
      expect(down.tiles.flat().filter((t) => t === TILE.BOULDER).length, `${k}: masso interno`).toBe(1);
      const arrive = maps[0].warps.find((w) => w.to === down.id)!;
      const closed = walk(down, arrive.tx, arrive.ty, false), open = walk(down, arrive.tx, arrive.ty, true);
      const behind = down.npcs.filter((n) => (n.kind === 'relic' || n.kind === 'oyster') && !nextTo(closed, n.x, n.y) && !closed.has(`${n.x},${n.y}`));
      expect(behind.length, `${k}: reperti dietro il masso`).toBe(1);
      for (const n of down.npcs.filter((x) => x.kind === 'relic' || x.kind === 'oyster')) expect(nextTo(open, n.x, n.y) || open.has(`${n.x},${n.y}`), n.id).toBe(true);
    }
  });

  it('ogni grotta ha una guida all\'ingresso con il suo taccuino, e tre sfidanti (la Grotta delle Perle: le tre ostriche e il Pescatore)', () => {
    for (const k of KEYS) {
      const maps = CAVES[k].maps.map((id) => getMap(id));
      const guide = maps[0].npcs.find((n) => n.kind === 'caveguide' || (n.kind === 'hermit' && n.data?.key === 'perle'));
      expect(guide, k).toBeDefined();
      const book = BOOK_BY_ID[CAVES[k].book];
      expect(book?.topic, k).toBe('grotte');
      expect(book.pages.length).toBeGreaterThanOrEqual(6);
      const trainers = maps.flatMap((m) => m.npcs.filter((n) => n.kind === 'trainer'));
      expect(trainers.length, k).toBe(k === 'pearl' ? 0 : 3);
      // gli sfidanti delle grotte portano la tappa del loro Percorso: è quella a decidere la difficoltà
      for (const t of trainers) expect(t.data?.r, t.id).toBe(k === 'gold' ? 6 : 7);
    }
    expect(OYSTER_LEVEL.length).toBe(3);
  });

  it('Miniera: tre gallerie delle promesse riportano all\'ingresso, e la strada giusta porta da un\'uscita all\'altra', () => {
    const m = getMap('cave_gold');
    const traps = m.warps.filter((w) => w.trap);
    expect(traps.map((w) => w.trap).sort()).toEqual(Object.keys(TRAPS).sort());
    for (const w of traps) {
      expect(w.to).toBe('cave_gold');
      expect(Object.values(GOLD_ENTRY).some((e) => e.x === w.tx && e.y === w.ty), w.trap).toBe(true);
      expect(TRAPS[w.trap!].lesson.length).toBeGreaterThanOrEqual(2);
    }
    // senza usare alcun passaggio (quindi nessuna galleria che gira su sé stessa) si va dall'ingresso ovest a quello est
    const seen = walk(m, GOLD_ENTRY.west.x, GOLD_ENTRY.west.y, true);
    expect(seen.has(`${GOLD_ENTRY.east.x},${GOLD_ENTRY.east.y}`)).toBe(true);
    // ogni galleria delle promesse è raggiungibile (altrimenti il bivio non sarebbe una scelta), e ha la sua incisione
    for (const w of traps) expect(nextTo(seen, w.x, w.y), w.trap).toBe(true);
    expect(m.signs.filter((s) => s.text.join(' ').includes('«')).length).toBeGreaterThanOrEqual(4);
    // gli ingressi sono proprio le caselle d'arrivo dalle due bocche
    expect(getMap('r6').warps.find((w) => w.to === 'cave_gold')).toMatchObject({ tx: GOLD_ENTRY.west.x, ty: GOLD_ENTRY.west.y });
    expect(getMap('t6').warps.find((w) => w.to === 'cave_gold')).toMatchObject({ tx: GOLD_ENTRY.east.x, ty: GOLD_ENTRY.east.y });
  });

  it('Dark Pool: la Lanterna illumina meno e gli sfidanti si rivelano solo da vicino; nelle altre grotte si vede fin dove arriva la luce', () => {
    expect(CAVES.dp.light).toBeLessThan(CAVES.gold.light);
    expect(CAVES.dp.reveal).toBeLessThan(CAVES.dp.light);
    expect(CAVES.gold.reveal).toBe(CAVES.gold.light);
    expect(CAVES.pearl.reveal).toBe(CAVES.pearl.light);
  });

  it('Grotta delle Perle: la prima ostrica sta oltre il laghetto, si raggiunge solo sull\'acqua', () => {
    const m = getMap('cave_pearl');
    const o1 = m.npcs.find((n) => n.kind === 'oyster' && n.data?.n === 1)!;
    const entry = getMap('r8').warps.find((w) => w.to === 'cave_pearl')!;
    expect(nextTo(walk(m, entry.tx, entry.ty, true, false), o1.x, o1.y)).toBe(false);
    expect(nextTo(walk(m, entry.tx, entry.ty, true, true), o1.x, o1.y)).toBe(true);
  });

  it('il Cippo dei Costi sul Percorso 5 è chiuso da un masso e dà Conoscenza alla prima lettura', () => {
    const r5 = getMap('r5');
    const sign = r5.signs.find((s) => s.xp)!;
    expect(sign).toBeDefined();
    expect(r5.tiles[sign.y + 2][sign.x]).toBe(TILE.BOULDER);
  });

  it('ogni grotta ha la sua musica, su entrambi i livelli, e ogni battuta di ogni brano ha 16 passi', () => {
    const ids = KEYS.map((k) => CAVES[k].maps.map((id) => trackForMap(id, true, false)));
    for (const pair of ids) expect(pair[0]).toBe(pair[1]);
    expect(new Set(ids.map((p) => p[0])).size).toBe(3);
    for (const p of ids) expect(p[0]).not.toBe('interior');
    for (const [id, tr] of Object.entries(TRACKS)) {
      expect(tr.drums.length, id).toBe(16);
      expect(tr.lead.length % tr.chords.length, id).toBe(0);
      for (const bar of tr.lead) expect(bar.trim().split(/\s+/).length, `${id}: ${bar}`).toBe(16);
    }
  });
});

describe('domande delle grotte', () => {
  beforeEach(() => { newGame(); S.difficulty = 'stratega'; S.badges = 6; });
  const topics = () => trackTopics(S.track, S.mixedClasses, S.badges);

  it('ogni grotta ha domande sue per tutti i livelli che servono, con fonte valida e un taccuino che ne spiega i termini', () => {
    for (const k of KEYS) {
      const qs = caveQuestions(CAVES[k].quiz);
      expect(qs.length, k).toBeGreaterThanOrEqual(11);
      for (const d of [2, 3, 4]) expect(qs.filter((q) => q.diff === d).length, `${k} livello ${d}`).toBeGreaterThanOrEqual(1);
      for (const q of qs) { expect(SOURCES[q.source], q.id).toBeDefined(); expect(studyHint(q)).toContain(BOOK_BY_ID[CAVES[k].book].title); }
    }
    expect(byTopic('grotte').length).toBe(KEYS.reduce((s, k) => s + caveQuestions(CAVES[k].quiz).length, 0));
  });

  it('i tre sfidanti di una grotta, uno dopo l\'altro, fanno solo domande della grotta, mai viste e del livello della tappa', () => {
    for (const [k, r] of [['gold', 6], ['dp', 7]] as const) {
      S.answered = {};
      const target = targetDiff(r - 1);
      const asked = new Set<string>();
      for (let i = 0; i < 3; i++) {
        const qs = pickCaveQuestions(CAVES[k].quiz, 3, target, topics());
        expect(qs.length).toBe(3);
        const mix = diffMix(3, target);
        for (const [level, n] of mix) expect(qs.filter((q) => q.diff === level).length, `${k} sfidante ${i + 1} livello ${level}`).toBe(n);
        for (const q of qs) {
          expect(q.id.startsWith(`grotte_${CAVES[k].quiz}_`), q.id).toBe(true);
          expect(asked.has(q.id), `${q.id} ripetuta`).toBe(false);
          asked.add(q.id);
          S.answered[q.id] = 1;
        }
      }
    }
  });

  it('finite le domande nuove della grotta si passa a domande mai viste del proprio percorso, e solo dopo si ripete', () => {
    const own = caveQuestions('oro');
    for (const q of own) S.answered[q.id] = 1;
    const qs = pickCaveQuestions('oro', 3, 2, topics());
    expect(qs.every((q) => q.topic !== 'grotte' && !S.answered[q.id] && q.diff === 2)).toBe(true);
    // anche quelle esaurite: tornano le domande della grotta viste meno volte
    for (const t of topics()) for (const q of byTopic(t)) S.answered[q.id] = 1;
    own.filter((q) => q.diff === 2).forEach((q, i) => { S.answered[q.id] = i < 3 ? 1 : 5; });
    const again = pickCaveQuestions('oro', 3, 2, topics());
    expect(again.every((q) => q.topic === 'grotte' && S.answered[q.id] === 1)).toBe(true);
  });

  it('ostriche ed eremita: una domanda del livello dell\'ostrica, poi cinque domande nuove per la sfida del Pescatore', () => {
    S.badges = 7;
    const asked = new Set<string>();
    for (const level of OYSTER_LEVEL) {
      const [q] = pickCaveQuestions('perle', 1, level, topics());
      expect(q.diff).toBe(level); expect(q.id.startsWith('grotte_perle_')).toBe(true); expect(asked.has(q.id)).toBe(false);
      asked.add(q.id); S.answered[q.id] = 1;
    }
    const duel = pickCaveQuestions('perle', 5, targetDiff(Math.max(3, S.badges) + 2), topics());
    expect(duel.length).toBe(5);
    expect(duel.every((q) => q.id.startsWith('grotte_perle_') && !asked.has(q.id))).toBe(true);
  });

  it('fuori dalle grotte quelle domande non escono mai, nemmeno quando gli argomenti non bastano', () => {
    for (let i = 0; i < 30; i++) {
      expect(pickQuestions(['regole'], 40, { target: 3 }).some((q) => q.topic === 'grotte')).toBe(false);
      expect(pickQuestions(['regole'], 400).some((q) => q.topic === 'grotte')).toBe(false);
    }
    for (let b = 0; b <= 8; b++) expect(trackTopics('listed', [], b)).not.toContain('grotte');
    expect(QUESTIONS.some((q) => q.topic === 'grotte')).toBe(true);
  });
});

describe('reperti: titoli e arredi', () => {
  beforeEach(() => { newGame(); });

  it('i tre reperti di una grotta danno titolo e oggetto per la casa; tutti e nove la Lanterna d\'oro', () => {
    const ach = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;
    for (const [k, id] of [['gold', 'relics_gold'], ['dp', 'relics_dp'], ['pearl', 'relics_pearl']] as const) {
      const rs = relicsOf(k);
      S.flags[relicFlag(rs[0].id)] = true; S.flags[relicFlag(rs[1].id)] = true;
      expect(ach(id).check(), `${k}: due su tre`).toBe(false);
      S.flags[relicFlag(rs[2].id)] = true;
      expect(ach(id).check(), `${k}: tre su tre`).toBe(true);
      expect(ach(id).title).toBeTruthy();
      expect(DECOR_INFO[ach(id).decor!], id).toBeDefined();
    }
    expect(ach('caves_all').check()).toBe(true);
    checkAchievements();
    for (const d of ['ingot', 'order_frame', 'pearl', 'lantern']) expect(S.decor).toContain(d);
  });

  it('in casa c\'è posto per tutti gli arredi del gioco, senza chiudere il passaggio verso la porta', () => {
    const base = getMap('home');
    for (const [id, info] of Object.entries(DECOR_INFO)) expect(DECOR_TILE[info.tile], id).toBeDefined();
    S.decor = Object.keys(DECOR_INFO);
    const m = decorateHome(base);
    const placed = (wall: boolean) => m.tiles.flat().filter((t, i) => t !== base.tiles.flat()[i] && WALL_DECOR.has(t) === wall).length;
    const wall = Object.values(DECOR_INFO).filter((d) => WALL_DECOR.has(DECOR_TILE[d.tile])).length;
    expect(placed(true)).toBe(wall);
    expect(placed(false)).toBe(Object.keys(DECOR_INFO).length - wall);
    // dalla porta si raggiungono ancora la mamma e ogni casella libera
    const door = m.warps[0];
    const seen = walk({ ...m, npcs: [] }, door.x, door.y - 1, true);
    const free = m.tiles.flatMap((r, y) => r.map((t, x) => (!SOLID.has(t) && !(x === door.x && y === door.y) ? `${x},${y}` : ''))).filter(Boolean);
    expect(free.filter((k) => !seen.has(k))).toEqual([]);
    expect(free.length).toBeGreaterThanOrEqual(12);
  });
});
