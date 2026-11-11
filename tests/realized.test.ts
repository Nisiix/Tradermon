// Perdite realizzate e vendite fatte fuori dal gioco: il registro le prende al prezzo vero di esecuzione,
// e la bancarotta (conto a zero) si controlla sui dati aggiornati.
import { describe, it, expect, beforeEach } from 'vitest';
import { newGame, S } from '../src/systems/state';
import * as Acc from '../src/systems/account';
import type { AlpacaAccount, AlpacaOrder, AlpacaPosition } from '../src/systems/alpaca';
import type { PendingOrder } from '../src/types';

const acc = { status: 'ACTIVE', currency: 'USD', cash: '0', equity: '0', buying_power: '0', portfolio_value: '0', account_number: 'PA1', created_at: '2026-01-01T00:00:00Z' } as AlpacaAccount;
const pos = (symbol: string, qty: number): AlpacaPosition => ({ symbol, qty: String(qty), market_value: '0', unrealized_pl: '0', unrealized_plpc: '0', avg_entry_price: '0', current_price: '0', asset_class: 'us_equity' });
const sold = (symbol: string, qty: number, price: number, cid = 'web-1', at = Date.now()): AlpacaOrder => ({ id: 'o-' + cid, client_order_id: cid, symbol, side: 'sell', type: 'market', qty: String(qty), notional: null, status: 'filled', limit_price: null, stop_price: null, submitted_at: new Date(at).toISOString(), filled_at: new Date(at).toISOString(), filled_avg_price: String(price), filled_qty: String(qty) });

beforeEach(() => {
  newGame();
  S.flags.starter = 'AAPL';
  S.market.asOf = Date.now();
  S.market.prices.AAPL = 180;
  S.market.prices.KO = 60;
  const pf = S.portfolio;
  pf.cash = 600;
  pf.positions = [{ id: 'AAPL', qty: 2, cost: 400 }];
  pf.accountTag = '';
});

describe('vendite fuori dal gioco', () => {
  it('una vendita esterna in perdita entra nel registro al prezzo vero di esecuzione, non al prezzo attuale', () => {
    const pf = S.portfolio;
    const notes = Acc.reconcile(pf, acc, [], [sold('AAPL', 2, 100)]);
    expect(pf.positions).toHaveLength(0);
    expect(pf.cash).toBeCloseTo(800, 6); // 600 + 2 × 100, non 2 × 180
    expect(pf.realized).toBeCloseTo(-200, 6);
    expect(pf.external.at(-1)).toMatchObject({ asset: 'AAPL', qty: 2 });
    expect(notes.join(' ')).toMatch(/perdita/i);
  });

  it('una vendita esterna parziale tocca solo la parte venduta', () => {
    const pf = S.portfolio;
    Acc.reconcile(pf, acc, [pos('AAPL', 1.5)], [sold('AAPL', 0.5, 160)]);
    expect(pf.positions[0].qty).toBeCloseTo(1.5, 9);
    expect(pf.positions[0].cost).toBeCloseTo(300, 6);
    expect(pf.cash).toBeCloseTo(680, 6);
    expect(pf.realized).toBeCloseTo(-20, 6);
  });

  it('se Alpaca non restituisce l\'ordine chiuso vale il prezzo attuale', () => {
    const pf = S.portfolio;
    Acc.reconcile(pf, acc, [], []);
    expect(pf.cash).toBeCloseTo(960, 6);
    expect(pf.realized).toBeCloseTo(-40, 6);
  });

  it('gli ordini inviati dal gioco e quelli già visti non contano come vendite esterne', () => {
    const pf = S.portfolio;
    pf.reconAt = Date.now() - 1000;
    Acc.reconcile(pf, acc, [], [sold('AAPL', 2, 50, `tm-${S.saveId}-7`), sold('AAPL', 2, 70, 'web-old', Date.now() - 60_000)]);
    expect(pf.cash).toBeCloseTo(960, 6); // nessuno dei due vale: resta il prezzo attuale
  });

  it('con la leva il ricavo di una vendita esterna rimborsa prima il prestito', () => {
    const pf = S.portfolio;
    pf.loan = 150;
    Acc.reconcile(pf, acc, [], [sold('AAPL', 2, 100)]);
    expect(pf.loan).toBe(0);
    expect(pf.cash).toBeCloseTo(650, 6);
  });

  it('dopo la riconciliazione la bancarotta si legge sui dati aggiornati: perdite realizzate fino a zero', () => {
    const pf = S.portfolio;
    pf.cash = 0.2;
    expect(Acc.margin(pf).bankrupt).toBe(false); // 2 AAPL a 180 valgono ancora 360 $
    Acc.reconcile(pf, acc, [], [sold('AAPL', 2, 0.1)]);
    expect(Acc.equity(pf)).toBeCloseTo(0.4, 6);
    expect(Acc.margin(pf).bankrupt).toBe(true);
  });
});

describe('vendite dentro il gioco', () => {
  it('una vendita in perdita aggiorna il risultato realizzato con il prezzo di esecuzione', () => {
    const pf = S.portfolio;
    const p: PendingOrder = { id: 'x', cid: 'tm-1', asset: 'AAPL', side: 'sell', type: 'market', qty: 1, reserved: 0, filledQty: 0, filledCost: 0, createdAt: Date.now(), tag: 'mercato' };
    pf.pending.push(p);
    const r = Acc.applyOrder(pf, p, sold('AAPL', 1, 150, 'tm-1'));
    expect(r.atLoss).toBe(true);
    expect(pf.realized).toBeCloseTo(-50 - 150 * 0.001, 6); // prezzo di carico 200, venduta a 150, meno il costo didattico
  });

  it('una vendita in guadagno lo aumenta', () => {
    const pf = S.portfolio;
    const p: PendingOrder = { id: 'x', cid: 'tm-1', asset: 'AAPL', side: 'sell', type: 'market', qty: 2, reserved: 0, filledQty: 0, filledCost: 0, createdAt: Date.now(), tag: 'mercato' };
    pf.pending.push(p);
    Acc.applyOrder(pf, p, sold('AAPL', 2, 250, 'tm-1'));
    expect(pf.realized).toBeCloseTo(100 - 500 * 0.001, 6);
  });
});
