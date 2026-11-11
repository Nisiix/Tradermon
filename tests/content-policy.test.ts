// La pagina pubblicata può eseguire solo il codice del gioco e parlare solo con Alpaca e con il servizio dei
// salvataggi: dal sito le chiavi Alpaca vivono nel browser, quindi nessuno script estraneo deve poter girare.
import { describe, it, expect } from 'vitest';
import { contentPolicy } from '../vite.config';

const rule = (policy: string, name: string) => policy.split('; ').find((r) => r.startsWith(name + ' '))?.split(' ').slice(1) ?? [];

describe('regole della pagina pubblicata (Content-Security-Policy)', () => {
  const policy = contentPolicy({ VITE_SUPABASE_URL: 'https://progetto.supabase.co/qualcosa' });

  it('gli script arrivano solo dal sito del gioco: niente script in linea, niente eval, niente siti esterni', () => {
    expect(rule(policy, 'script-src')).toEqual(["'self'"]);
    expect(rule(policy, 'default-src')).toEqual(["'self'"]);
    expect(rule(policy, 'object-src')).toEqual(["'none'"]);
    expect(rule(policy, 'base-uri')).toEqual(["'self'"]);
    expect(rule(policy, 'form-action')).toEqual(["'none'"]);
  });

  it('la pagina può chiamare solo Alpaca e il servizio dei salvataggi', () => {
    const hosts = rule(policy, 'connect-src').filter((h) => h.startsWith('http'));
    expect(hosts.sort()).toEqual(['https://data.alpaca.markets', 'https://paper-api.alpaca.markets', 'https://progetto.supabase.co']);
    expect(policy).not.toMatch(/\*/);
  });

  it('senza indicazioni usa il progetto Supabase predefinito; il gioco solo locale non apre altri indirizzi', () => {
    expect(rule(contentPolicy({}), 'connect-src').some((h) => /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(h))).toBe(true);
    const local = rule(contentPolicy({ VITE_SUPABASE_URL: '' }), 'connect-src').filter((h) => h.startsWith('http'));
    expect(local.every((h) => h.endsWith('.alpaca.markets'))).toBe(true);
  });
});
