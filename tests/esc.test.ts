import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { pushHandler, popHandler, markClosable, topClosable } from '../src/ui/input';

// Esc (tasto Opzioni) chiude la finestra o il menu in cima invece di aprire le Opzioni sopra.
describe('Esc chiude la finestra aperta', () => {
  it('conta solo ciò che sta in cima e si può chiudere', () => {
    expect(topClosable()).toBe(false);
    const win = () => true;
    const talk = () => true;
    markClosable(win);
    pushHandler(win);
    expect(topClosable()).toBe(true);
    pushHandler(talk);
    expect(topClosable()).toBe(false);
    popHandler(talk);
    expect(topClosable()).toBe(true);
    popHandler(win);
    expect(topClosable()).toBe(false);
  });
  it('finestre chiudibili e menu annullabili sono segnati; il tasto Opzioni li chiude', () => {
    const core = readFileSync('src/ui/core.ts', 'utf8');
    expect(core).toContain('if (opts.cancel) markClosable(h);');
    expect(core).toContain('if (opts.closable !== false) markClosable(h);');
    expect(readFileSync('src/ui/settings.ts', 'utf8')).toContain("if (open || topClosable()) press('b')");
  });
});
