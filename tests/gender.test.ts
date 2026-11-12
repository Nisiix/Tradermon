import { describe, it, expect } from 'vitest';
import { newGame, S } from '../src/systems/state';
import { gtext, g } from '../src/systems/gender';
import { playerPal } from '../src/art/art';

describe('testi accordati al genere', () => {
  it('sceglie la forma maschile o femminile', () => {
    newGame();
    expect(S.gender).toBe('m');
    expect(gtext('Benvenut{o|a}! Sei {il nuovo Campione|la nuova Campionessa}.')).toBe('Benvenuto! Sei il nuovo Campione.');
    S.gender = 'f';
    expect(gtext('Benvenut{o|a}! Sei {il nuovo Campione|la nuova Campionessa}.')).toBe('Benvenuta! Sei la nuova Campionessa.');
    expect(g('pronto', 'pronta')).toBe('pronta');
  });

  it('i vecchi salvataggi senza genere restano al maschile', () => {
    newGame();
    delete S.gender;
    expect(gtext('Sei pront{o|a}?')).toBe('Sei pronto?');
  });

  it('lascia intatti i testi senza coppie', () => {
    newGame();
    expect(gtext('Prezzo {nome} | 10% {x}')).toBe('Prezzo {nome} | 10% {x}');
  });

  it('la protagonista ha uno sprite diverso per ogni colore', () => {
    for (let i = 0; i < 8; i++) expect(playerPal(i, 'f')).not.toBe(playerPal(i, 'm'));
    expect(playerPal(3)).toBe(playerPal(3, 'm'));
  });
});
