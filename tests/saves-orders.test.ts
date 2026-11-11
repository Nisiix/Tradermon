import { describe, it, expect } from 'vitest';
import { newGame, advanceDays, migrate, validSave, SAVE_VERSION, setState } from '../src/systems/state';
import { placeOrder, marketBuy, marketSell } from '../src/systems/portfolio';
import type { AssetDef } from '../src/types';
import type { SaveData } from '../src/types';

describe('ordini del conto di prova nel mondo', () => {
  it('limite e stop si eseguono quando il mercato del mondo avanza', () => {
    const S = newGame();
    const id = 'SLR';
    const px0 = S.market.prices[id];
    // un limite sopra il prezzo e uno stop sopra il prezzo scattano al primo giorno
    placeOrder(S.portfolio, { asset: id, side: 'buy', type: 'limit', qty: 1, price: px0 * 10, createdDay: 0, expiresDay: 20 });
    advanceDays(1);
    expect(S.portfolio.orders.length).toBe(0);
    expect(S.portfolio.positions.find((p) => p.id === id)).toBeTruthy();
    placeOrder(S.portfolio, { asset: id, side: 'sell', type: 'stop', qty: 1, price: S.market.prices[id] * 10, createdDay: S.market.day, expiresDay: S.market.day + 20 });
    advanceDays(1);
    expect(S.portfolio.orders.length).toBe(0);
    expect(S.portfolio.log.filter((l) => l.type === 'stop').length).toBe(1);
  });
  it('un ordine mai raggiunto scade dopo 20 giorni', () => {
    const S = newGame();
    placeOrder(S.portfolio, { asset: 'SLR', side: 'buy', type: 'limit', qty: 1, price: 0.0000001, createdDay: 0, expiresDay: 20 });
    advanceDays(20);
    expect(S.portfolio.orders.length).toBe(1);
    advanceDays(1);
    expect(S.portfolio.orders.length).toBe(0);
  });
});

describe('salvataggi', () => {
  it('migrazione: completa i campi mancanti anche dentro portfolio e porta alla versione corrente', () => {
    const S = newGame();
    marketBuy(S.portfolio, 'SLR', 100, S.market.prices, 0, 5);
    const old = JSON.parse(JSON.stringify(S)) as Record<string, any>;
    old.version = 1;
    delete old.reviewDue;
    delete old.portfolio.target;
    old.portfolio.orders = [{ id: 'x', asset: 'SLR', side: 'buy', type: 'limit', qty: 1, price: 1, createdDay: 5 }];
    const m = migrate(old as SaveData);
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.reviewDue).toEqual({});
    expect(m.portfolio.target.cash).toBeGreaterThan(0);
    expect(m.portfolio.orders[0].expiresDay).toBe(25);
    expect(m.portfolio.positions.length).toBe(1);
    setState(m);
  });
  it('importazione: rifiuta file alterati', () => {
    const S = newGame();
    const ok = JSON.parse(JSON.stringify(S));
    expect(validSave(ok)).toBeNull();
    expect(validSave({ ...ok, portfolio: { cash: 'tanti' } })).not.toBeNull();
    expect(validSave({ ...ok, version: 99 })).not.toBeNull();
    expect(validSave({ ...ok, market: null })).not.toBeNull();
    expect(validSave('ciao')).not.toBeNull();
  });
});

describe('replay di dati reali Alpaca', () => {
  it('si può comprare e vendere il simbolo reale passato al simulatore', () => {
    const REAL = { id: 'REAL', ticker: 'AAPL', name: 'AAPL', cls: 'stocks', sector: 'world', risk: 3, mu: 0, sigma: 0.2, beta: 1, dividend: 0, desc: '', facts: [], unlock: 'real' } as AssetDef;
    const book = { cash: 1000, positions: [], orders: [], log: [] };
    const defs = { REAL };
    expect(marketBuy(book, 'REAL', 500, { REAL: 100 }, 0, 10).ok).toBe(false); // prima della correzione: "Asset sconosciuto"
    expect(marketBuy(book, 'REAL', 500, { REAL: 100 }, 0, 10, 'mercato', defs).ok).toBe(true);
    expect(marketSell(book, 'REAL', 1, { REAL: 110 }, 1, 'mercato', defs).ok).toBe(true);
  });
});
