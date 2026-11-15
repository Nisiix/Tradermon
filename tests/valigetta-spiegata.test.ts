import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { starterOptions } from '../src/data/assets';

// Prima della Valigetta: la mamma spiega le parole che senti fino alla scelta; la scheda spiega ogni titolo della vetrina.
describe('Valigetta spiegata', () => {
  const story = readFileSync('src/world/scripts/story.ts', 'utf8');
  const basics = story.slice(story.indexOf('const BASICS'), story.indexOf('export async function momIntro'));

  it('la mamma spiega titolo, ticker, borsa, portafoglio, Fiducia, Whale, Valigette, azioni, ETF e cripto', () => {
    for (const w of ['Un titolo è', 'ticker', 'La borsa è', 'portafoglio è', 'paper trading', 'Fiducia', 'Whale', 'Valigette', 'Sentiero', 'caduta storica', 'Un\\\'azione è', 'Un ETF è', 'Le cripto']) {
      expect(basics, w).toContain(w);
    }
  });

  it('la scheda della Valigetta mostra ogni titolo della vetrina con la sua descrizione', () => {
    expect(story).toContain('starterOptions(c).map((a) => `<dt><b>${esc(a.ticker)}</b> · ${esc(a.name)}');
    expect(story).toContain('<dd>${esc(a.desc)}</dd>');
    for (const c of ['stocks', 'etf', 'crypto'] as const) {
      const list = starterOptions(c);
      expect(list.length).toBeGreaterThan(0);
      for (const a of list) expect(a.desc.length, a.ticker).toBeGreaterThan(20);
    }
  });

  it('senza conto collegato non si sceglie il titolo: la vetrina si apre in Banca, prima del primo acquisto', () => {
    const start = story.slice(story.indexOf('async function startTrack'), story.indexOf('/** Nuova Partita+'));
    const linkedAt = start.indexOf('if (linked) {');
    expect(linkedAt).toBeGreaterThan(0);
    expect(start.indexOf('chooseStarter(')).toBeGreaterThan(linkedAt);
    const clinic = readFileSync('src/ui/clinic.ts', 'utf8');
    const trade = clinic.slice(clinic.indexOf('export async function trade'));
    expect(trade.indexOf('await ensureStarter(')).toBeGreaterThan(trade.indexOf('requireAccount('));
    expect(trade.indexOf('await ensureStarter(')).toBeLessThan(trade.indexOf('await modal('));
  });

  it("all'apertura del conto l'uscita da Chiavi API dice che si può collegare più tardi", () => {
    const broker = readFileSync('src/ui/broker.ts', 'utf8');
    expect(broker).toContain("T('Non voglio collegare il conto o lo farò più tardi')");
    expect(broker).toContain('await apiKeysMenu(true)');
  });
});
