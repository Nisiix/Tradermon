// Il giocatore cancella se stesso: solo il proprio utente, solo con una sessione appena aperta (password reinserita).
import { describe, it, expect, beforeEach } from 'vitest';
import { handleRequest, FRESH_MS, type Deps } from '../supabase/functions/elimina-giocatore/index';

const NOW = Date.parse('2026-11-11T20:00:00Z');
let deleted: string[] = [];
const deps = (over: Partial<Deps> = {}): Deps => ({
  verifyUser: async (t) => (t === 'fresco' ? { id: 'u1', lastSignIn: NOW - 30_000 } : t === 'vecchio' ? { id: 'u1', lastSignIn: NOW - FRESH_MS - 1 } : null),
  deleteUser: async (id) => { deleted.push(id); return true; },
  now: () => NOW,
  ...over,
});
const post = (token?: string, body?: unknown) => new Request('https://x.supabase.co/functions/v1/elimina-giocatore', {
  method: 'POST', headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
});

beforeEach(() => { deleted = []; });

describe('funzione elimina-giocatore', () => {
  it('cancella il giocatore del token appena aperto', async () => {
    const r = await handleRequest(post('fresco'), deps());
    expect(r.status).toBe(200);
    expect(deleted).toEqual(['u1']);
  });

  it("l'id da cancellare non arriva mai dalla richiesta", async () => {
    const r = await handleRequest(post('fresco', { id: 'altro', user_id: 'altro' }), deps());
    expect(r.status).toBe(200);
    expect(deleted).toEqual(['u1']);
  });

  it('senza sessione valida non cancella nulla', async () => {
    expect((await handleRequest(post(), deps())).status).toBe(401);
    expect((await handleRequest(post('falso'), deps())).status).toBe(401);
    expect(deleted).toEqual([]);
  });

  it('una sessione rimasta aperta da tempo non basta: serve reinserire la password', async () => {
    const r = await handleRequest(post('vecchio'), deps());
    expect(r.status).toBe(403);
    expect(((await r.json()) as { error: string }).error).toMatch(/password/);
    expect(deleted).toEqual([]);
  });

  it('accetta solo POST e dice al browser che può chiamarla', async () => {
    expect((await handleRequest(new Request('https://x/f', { method: 'GET' }), deps())).status).toBe(405);
    const pre = await handleRequest(new Request('https://x/f', { method: 'OPTIONS' }), deps());
    expect(pre.headers.get('access-control-allow-methods')).toMatch(/POST/);
  });

  it('se Supabase non cancella, lo dice', async () => {
    const r = await handleRequest(post('fresco'), deps({ deleteUser: async () => false }));
    expect(r.status).toBe(500);
  });
});
