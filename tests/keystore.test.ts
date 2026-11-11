// Chiavi Alpaca tenute solo sul dispositivo: cifrate con la chiave della cassaforte, mai in chiaro e mai su Supabase.
import { describe, it, expect, beforeAll, vi } from 'vitest';

const cloud = vi.hoisted(() => ({
  user: 'g1' as string | null, key: null as CryptoKey | null, locked: false,
  remote: {} as Record<string, { keyId: string; secret: string } | undefined>,
}));
vi.mock('../src/systems/cloud', () => ({
  vaultKey: async () => { if (!cloud.user) throw new Error('Nessun giocatore collegato.'); if (cloud.locked || !cloud.key) throw new Error('LOCKED'); return { user: cloud.user, key: cloud.key }; },
  vaultUnlocked: async () => !!cloud.user && !cloud.locked,
  currentPlayer: async () => (cloud.user ? { id: cloud.user, name: 'Ada' } : null),
  savedKeyEnvs: async () => Object.keys(cloud.remote).filter((e) => cloud.remote[e]),
  loadAlpacaKeys: async (env: string) => cloud.remote[env] ?? null,
  removeAlpacaKeys: async (env: string) => { delete cloud.remote[env]; },
}));

import * as K from '../src/systems/keystore';

const mem = new Map<string, string>();
const PAPER = { keyId: 'PKTESTTESTTEST00', secret: 'segreto-paper-'.padEnd(40, 'x') };
const LIVE = { keyId: 'AKLIVELIVELIVE00', secret: 'segreto-live-'.padEnd(40, 'y') };

beforeAll(async () => {
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; } });
  cloud.key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
});

describe('chiavi Alpaca solo sul dispositivo', () => {
  it('salvate cifrate: nel dispositivo non c\'è il segreto in chiaro, e si riaprono identiche', async () => {
    await K.storeKeys('paper', PAPER);
    await K.storeKeys('live', LIVE);
    const all = [...mem.values()].join('\n');
    expect(all).not.toContain(PAPER.secret);
    expect(all).not.toContain(LIVE.secret);
    expect(all).not.toContain(PAPER.keyId);
    expect(await K.loadKeys('paper')).toEqual(PAPER);
    expect(await K.loadKeys('live')).toEqual(LIVE);
    expect((await K.keyEnvs()).sort()).toEqual(['live', 'paper']);
  });

  it('con la cassaforte chiusa non si aprono; un altro giocatore sullo stesso dispositivo non le vede', async () => {
    cloud.locked = true;
    await expect(K.loadKeys('paper')).rejects.toThrow('LOCKED');
    expect((await K.keyEnvs()).sort()).toEqual(['live', 'paper']); // l'elenco si legge senza aprirle
    cloud.locked = false;
    cloud.user = 'g2';
    expect(await K.keyEnvs()).toEqual([]);
    expect(await K.loadKeys('paper')).toBeNull();
    cloud.user = 'g1';
  });

  it('una copia spostata sul conto sbagliato non si apre', async () => {
    mem.set('tradermon.alpaca.g1.live', mem.get('tradermon.alpaca.g1.paper')!);
    await expect(K.loadKeys('live')).rejects.toThrow();
    await K.storeKeys('live', LIVE);
  });

  it('scollegare cancella la copia dal dispositivo', async () => {
    await K.removeKeys('live');
    expect(await K.loadKeys('live')).toBeNull();
    expect(await K.keyEnvs()).toEqual(['paper']);
  });

  it('le vecchie copie su Supabase vengono portate sul dispositivo e poi cancellate da Supabase', async () => {
    await K.removeKeys('paper');
    cloud.remote = { paper: PAPER, live: LIVE };
    const moved = await K.migrateFromCloud();
    expect(moved.sort()).toEqual(['live', 'paper']);
    expect(await K.loadKeys('paper')).toEqual(PAPER);
    expect(await K.loadKeys('live')).toEqual(LIVE);
    expect(cloud.remote).toEqual({});
    expect(await K.migrateFromCloud()).toEqual([]);
  });

  it('se sul dispositivo c\'è già una chiave, la copia su Supabase viene solo cancellata', async () => {
    const other = { keyId: 'PKALTRAALTRA0000', secret: 'z'.repeat(40) };
    cloud.remote = { paper: other };
    await K.migrateFromCloud();
    expect(await K.loadKeys('paper')).toEqual(PAPER);
    expect(cloud.remote).toEqual({});
  });
});
