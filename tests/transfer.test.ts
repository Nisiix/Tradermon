import { describe, it, expect } from 'vitest';
import { collect, encode, decode, merge, BACKUP_KEY } from '../src/systems/transfer';
import { newGame, exportSave } from '../src/systems/state';

class Mem implements Storage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}
const game = (name: string, playMs: number) => { const s = newGame(); s.name = name; s.playMs = playMs; return exportSave(); };

describe('trasloco del salvataggio', () => {
  it('codifica e decodifica tutti i dati tradermon.*', async () => {
    const st = new Mem();
    st.setItem('tradermon.save.v1', game('Ada', 1000));
    st.setItem('tradermon.controlsSeen', '1');
    st.setItem('altro.sito', 'x');
    const b = collect(st);
    expect(Object.keys(b.keys).sort()).toEqual(['tradermon.controlsSeen', 'tradermon.save.v1']);
    const enc = await encode(b);
    expect(enc).toMatch(/^[zj]\.[A-Za-z0-9_-]+$/);
    expect(enc.length).toBeLessThan(200_000);
    expect(await decode(enc)).toEqual(b);
    expect(await decode('z.rotto')).toBeNull();
  });

  it('importa se il browser nuovo è vuoto, senza chiedere', async () => {
    const src = new Mem(); src.setItem('tradermon.save.v1', game('Ada', 1000)); src.setItem('tradermon.prefs', '{"a":1}');
    const dst = new Mem();
    const r = await merge(collect(src), async () => { throw new Error('non deve chiedere'); }, dst);
    expect(r).toBe('imported');
    expect(dst.getItem('tradermon.save.v1')).toBe(src.getItem('tradermon.save.v1'));
    expect(dst.getItem('tradermon.prefs')).toBe('{"a":1}');
  });

  it('tiene la partita più avanti e conserva l\'altra come copia', async () => {
    const src = new Mem(); src.setItem('tradermon.save.v1', game('Vecchia', 5000));
    const dst = new Mem(); dst.setItem('tradermon.save.v1', game('Nuova', 100)); dst.setItem('tradermon.prefs', 'mie');
    src.setItem('tradermon.prefs', 'sue');
    expect(await merge(collect(src), async () => true, dst)).toBe('imported');
    expect(JSON.parse(dst.getItem('tradermon.save.v1')!).name).toBe('Vecchia');
    expect(JSON.parse(dst.getItem(BACKUP_KEY)!).name).toBe('Nuova');
    expect(dst.getItem('tradermon.prefs')).toBe('mie');
    // partita locale più avanti: non si tocca
    const dst2 = new Mem(); dst2.setItem('tradermon.save.v1', game('Avanti', 9999));
    expect(await merge(collect(src), async () => true, dst2)).toBe('kept-local');
    expect(JSON.parse(dst2.getItem('tradermon.save.v1')!).name).toBe('Avanti');
    // l'utente rifiuta la sostituzione
    const dst3 = new Mem(); dst3.setItem('tradermon.save.v1', game('Mia', 1));
    expect(await merge(collect(src), async () => false, dst3)).toBe('kept-local');
  });

  it('scarta salvataggi non validi', async () => {
    const dst = new Mem();
    expect(await merge({ v: 1, at: 0, keys: { 'tradermon.save.v1': '{"hack":1}' } }, async () => true, dst)).toBe('nothing');
    expect(dst.getItem('tradermon.save.v1')).toBeNull();
  });
});
