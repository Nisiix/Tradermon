import { describe, it, expect, beforeEach, vi } from 'vitest';

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

// Supabase finto: il test controlla le decisioni della sincronizzazione, non la rete
const cloud = { save: null as null | { data: Record<string, unknown>; playMs: number; updatedAt: string }, pushed: [] as unknown[], offline: false };
vi.mock('../src/systems/cloud', async (orig) => {
  const real = await orig<typeof import('../src/systems/cloud')>();
  return {
    ...real,
    fetchSave: async () => { if (cloud.offline) throw new Error('rete'); return cloud.save; },
    pushSave: async (_u: string, d: unknown) => { if (cloud.offline) throw new Error('rete'); cloud.pushed.push(JSON.parse(JSON.stringify(d))); },
    pushPlayTime: async () => undefined,
  };
});

import { nameEmail, nameProblem, passwordProblem, normName } from '../src/systems/cloud';
import { createDataKey, unwrapDataKey, rewrapDataKey, seal, open } from '../src/systems/vault';
import { newGame, S, SAVE_KEY, save, setSaveListener } from '../src/systems/state';
import { syncAtBoot, flush, OWNER_KEY, PENDING_KEY, setCloudPlayer, startCloudSync } from '../src/systems/sync';

describe('nome giocatore', () => {
  it('stesso nome con maiuscole diverse → stesso indirizzo interno (unicità)', () => {
    expect(nameEmail('Alex')).toBe(nameEmail('  alex '));
    expect(nameEmail('Prova Uno')).toBe('g70726f766120756e6f@giocatori.tradermon.invalid');
    // stesso calcolo del trigger SQL: 'g' || encode(convert_to(lower(n), 'UTF8'), 'hex')
    expect(nameEmail('Niccolò')).toBe('g6e6963636f6cc3b2@giocatori.tradermon.invalid');
    expect(normName('  Leo   Rossi ')).toBe('Leo Rossi');
  });
  it('regole su nome e password', () => {
    expect(nameProblem('Al')).toMatch(/da 3 a 15/);
    expect(nameProblem('a'.repeat(16))).toMatch(/da 3 a 15/);
    expect(nameProblem('-Alex')).toMatch(/lettere/);
    expect(nameProblem('Alex<b>')).toMatch(/lettere/);
    expect(nameProblem('Niccolò_99')).toBeNull();
    expect(passwordProblem('1234567')).toMatch(/almeno 8/);
    expect(passwordProblem('12345678')).toBeNull();
  });
  it('il nome più lungo con accenti entra nel limite di 64 caratteri dell\'indirizzo', () => {
    expect(nameEmail('è'.repeat(15)).split('@')[0].length).toBeLessThanOrEqual(64);
  });
});

describe('cassaforte delle chiavi', () => {
  it('cifra e decifra con la password giusta, rifiuta quella sbagliata', async () => {
    const { wrapped, key } = await createDataKey('password-giusta', 1000);
    const sealed = await seal(key, { keyId: 'PKTEST1234', secret: 'segreto-lungo-abcdefghij' }, 'tradermon:alpaca:u1:paper');
    expect(sealed.ciphertext).not.toContain('PKTEST');
    expect(JSON.stringify(wrapped)).not.toContain('password');
    const again = await unwrapDataKey(wrapped, 'password-giusta');
    expect(await open(again, sealed, 'tradermon:alpaca:u1:paper')).toEqual({ keyId: 'PKTEST1234', secret: 'segreto-lungo-abcdefghij' });
    await expect(unwrapDataKey(wrapped, 'password-sbagliata')).rejects.toBeTruthy();
    // dato legato a giocatore e conto: spostato su un altro conto non si apre
    await expect(open(again, sealed, 'tradermon:alpaca:u1:live')).rejects.toBeTruthy();
  });
  it('la chiave dati in uso non è estraibile', async () => {
    const { key } = await createDataKey('pw-12345678', 1000);
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toBeTruthy();
  });
  it('cambio password: le chiavi cifrate restano leggibili con la nuova', async () => {
    const { wrapped, key } = await createDataKey('vecchia-pw', 1000);
    const sealed = await seal(key, { a: 1 }, 'x');
    const w2 = await rewrapDataKey(wrapped, 'vecchia-pw', 'nuova-pw-123');
    expect(await open(await unwrapDataKey(w2, 'nuova-pw-123'), sealed, 'x')).toEqual({ a: 1 });
    await expect(unwrapDataKey(w2, 'vecchia-pw')).rejects.toBeTruthy();
  });
});

describe('sincronizzazione del salvataggio', () => {
  const me = { id: 'u1', name: 'Alex' };
  beforeEach(() => { mem.clear(); cloud.save = null; cloud.pushed = []; cloud.offline = false; setCloudPlayer(null); setSaveListener(null); newGame(); });
  const no = async () => false;

  it('la partita su Supabase diventa la copia del dispositivo', async () => {
    cloud.save = { data: { ...S, playMs: 5000 } as unknown as Record<string, unknown>, playMs: 5000, updatedAt: '' };
    expect(await syncAtBoot(me, no)).toBe('ok');
    expect(JSON.parse(mem.get(SAVE_KEY)!).playMs).toBe(5000);
    expect(mem.get(OWNER_KEY)).toBe('u1');
  });

  it('una copia del dispositivo salvata senza rete e più avanti viene inviata', async () => {
    S.playMs = 9000; mem.set(SAVE_KEY, JSON.stringify(S)); mem.set(OWNER_KEY, 'u1'); mem.set(PENDING_KEY, '1');
    cloud.save = { data: { ...S, playMs: 4000 } as unknown as Record<string, unknown>, playMs: 4000, updatedAt: '' };
    await syncAtBoot(me, no);
    expect(cloud.pushed).toHaveLength(1);
    expect((cloud.pushed[0] as { playMs: number }).playMs).toBe(9000);
    expect(mem.get(PENDING_KEY)).toBeUndefined();
  });

  it('la copia di un altro giocatore non viene mai caricata', async () => {
    mem.set(SAVE_KEY, JSON.stringify({ ...S, name: 'Altro' })); mem.set(OWNER_KEY, 'u2');
    await syncAtBoot(me, no);
    expect(mem.get(SAVE_KEY)).toBeUndefined();
    expect(cloud.pushed).toHaveLength(0);
  });

  it('vecchia partita del browser: portata nel giocatore se lo chiede, altrimenti copia di riserva', async () => {
    mem.set(SAVE_KEY, JSON.stringify(S));
    await syncAtBoot(me, async () => true);
    expect(cloud.pushed).toHaveLength(1);
    mem.clear(); cloud.pushed = [];
    mem.set(SAVE_KEY, JSON.stringify(S));
    await syncAtBoot(me, no);
    expect(cloud.pushed).toHaveLength(0);
    expect(mem.get('tradermon.save.backup')).toBeTruthy();
    expect(mem.get(SAVE_KEY)).toBeUndefined();
  });

  it('senza rete il salvataggio resta in attesa e parte quando torna', async () => {
    await syncAtBoot(me, no);
    startCloudSync(() => undefined);
    cloud.offline = true;
    save();
    expect(mem.get(PENDING_KEY)).toBe('1');
    expect(await flush()).toBe(false);
    cloud.offline = false;
    expect(await flush()).toBe(true);
    expect(cloud.pushed).toHaveLength(1);
    expect(mem.get(PENDING_KEY)).toBeUndefined();
  });
});

describe('cancellazione del giocatore su questo dispositivo', () => {
  it('toglie partita e chiavi del giocatore, lascia preferenze e chiavi di altri giocatori', async () => {
    const { forgetPlayerOnDevice } = await import('../src/systems/sync');
    for (const k of [SAVE_KEY, OWNER_KEY, PENDING_KEY, 'tradermon.alpaca.u1.paper', 'tradermon.alpaca.u1.live', 'tradermon.alpaca.relay', 'tradermon.alpaca.u2.paper', 'tradermon.prefs']) mem.set(k, 'x');
    forgetPlayerOnDevice('u1');
    expect([...mem.keys()].sort()).toEqual(['tradermon.alpaca.u2.paper', 'tradermon.prefs']);
  });
});
