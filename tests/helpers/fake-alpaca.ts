// Finto Alpaca per i test automatici: un piccolo server HTTP locale che imita le risposte di Alpaca usate dal gioco.
// I prezzi sono generati (i dati veri di Alpaca non si possono ridistribuire, quindi non stanno nel repository).
// Il server di Tradermon lo raggiunge solo con TRADERMON_ALPACA_MOCK=http://127.0.0.1:<porta>.
import http from 'node:http';
import { randomUUID } from 'node:crypto';

export interface FakeOrder { id: string; client_order_id: string; symbol: string; side: string; type: string; qty: string | null; notional: string | null; status: string; limit_price: string | null; stop_price: string | null; submitted_at: string; filled_avg_price: string | null; filled_qty: string; time_in_force: string; filled_at?: string | null }

export interface FakeAlpaca {
  url: string;
  open: boolean;
  prices: Record<string, number>;
  cash: number;
  accountNumber: string;
  positions: Record<string, number>;
  orders: Map<string, FakeOrder>;
  /** Esegue gli ordini in coda come farebbe la borsa alla riapertura (o al nuovo prezzo). */
  match(): void;
  /** Fine seduta: gli ordini giornalieri non eseguiti scadono. */
  endOfDay(): void;
  close(): Promise<void>;
}

/** Serie giornaliera generata e ripetibile: giorni feriali tra due date, andamento liscio attorno al prezzo dato. */
export function fakeDaily(symbol: string, start: string, end: string, last: number, crypto = false): { t: string; o: number; h: number; l: number; c: number; v: number }[] {
  const out: { t: string; o: number; h: number; l: number; c: number; v: number }[] = [];
  let seed = [...symbol].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const days: string[] = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += 86400000) {
    const d = new Date(t);
    if (crypto || (d.getUTCDay() !== 0 && d.getUTCDay() !== 6)) days.push(d.toISOString().slice(0, 10));
  }
  days.forEach((day, i) => {
    seed = (seed * 9301 + 49297) % 233280;
    const c = last * (0.9 + (0.1 * (i + 1)) / days.length) * (1 + (seed / 233280 - 0.5) * 0.02);
    out.push({ t: `${day}T05:00:00Z`, o: c * 0.995, h: c * 1.01, l: c * 0.99, c, v: 1000 });
  });
  return out;
}

export async function startFakeAlpaca(): Promise<FakeAlpaca> {
  const st: FakeAlpaca = {
    url: '', open: true, cash: 100000, accountNumber: 'PA0000001', positions: {}, orders: new Map(),
    prices: { AAPL: 200, KO: 60, JNJ: 150, JPM: 220, NEE: 70, XOM: 110, MSFT: 400, SPY: 500, 'BTC/USD': 60000 },
    match() {
      for (const o of st.orders.values()) {
        if (o.status !== 'new' || (!st.open && !o.symbol.includes('/'))) continue;
        const px = st.prices[o.symbol];
        if (o.type === 'limit' && o.side === 'buy' && px > Number(o.limit_price)) continue;
        if ((o.type === 'stop' || o.type === 'stop_limit') && px > Number(o.stop_price)) continue;
        fill(o, px);
      }
    },
    endOfDay() { for (const o of st.orders.values()) if (o.status === 'new' && o.time_in_force === 'day') o.status = 'expired'; },
    close: () => new Promise((r) => srv.close(() => r())),
  };
  const key = (s: string) => s.replace('/', '');
  function fill(o: FakeOrder, px: number) {
    const qty = o.notional ? Number(o.notional) / px : Number(o.qty);
    if (o.side === 'buy') { st.cash -= qty * px; st.positions[key(o.symbol)] = (st.positions[key(o.symbol)] ?? 0) + qty; }
    else { st.cash += qty * px; st.positions[key(o.symbol)] = (st.positions[key(o.symbol)] ?? 0) - qty; if (st.positions[key(o.symbol)] < 1e-9) delete st.positions[key(o.symbol)]; }
    o.status = 'filled'; o.filled_qty = String(qty); o.filled_avg_price = String(px); o.filled_at = new Date().toISOString();
  }
  const bySym = (k: string) => Object.keys(st.prices).find((s) => key(s) === k) ?? k;
  const posJson = (k: string) => { const px = st.prices[bySym(k)] ?? 0; const q = st.positions[k]; return { symbol: k, qty: String(q), market_value: String(q * px), unrealized_pl: '0', unrealized_plpc: '0', avg_entry_price: String(px), current_price: String(px), asset_class: k.endsWith('USD') ? 'crypto' : 'us_equity' }; };
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    const send = (code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (!req.headers['apca-api-key-id']) return send(401, { message: 'unauthorized' });
    const p = u.pathname.replace(/^\/paper\/v2/, '');
    const syms = (u.searchParams.get('symbols') ?? '').split(',').filter(Boolean);
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (u.pathname.startsWith('/data/')) {
        if (u.pathname.includes('latest/trades') || u.pathname.includes('trades/latest')) {
          const one = /stocks\/([^/]+)\/trades\/latest/.exec(u.pathname);
          if (one) return send(200, { trade: { p: st.prices[decodeURIComponent(one[1])] ?? 0 } });
          return send(200, { trades: Object.fromEntries(syms.filter((s) => st.prices[s]).map((s) => [s, { p: st.prices[s] }])) });
        }
        if (u.pathname.endsWith('/bars')) {
          const start = u.searchParams.get('start')!, end = u.searchParams.get('end')!;
          const one = /stocks\/([^/]+)\/bars/.exec(u.pathname);
          if (one) return send(200, { bars: fakeDaily(one[1], start, end, st.prices[one[1]] ?? 100) });
          return send(200, { bars: Object.fromEntries(syms.filter((s) => st.prices[s]).map((s) => [s, fakeDaily(s, start, end, st.prices[s], s.includes('/'))])) });
        }
        return send(404, { message: 'not found' });
      }
      if (p === '/account') return send(200, { status: 'ACTIVE', currency: 'USD', cash: String(st.cash), equity: String(st.cash + Object.keys(st.positions).reduce((s, k) => s + st.positions[k] * (st.prices[bySym(k)] ?? 0), 0)), buying_power: String(st.cash * 2), portfolio_value: String(st.cash), account_number: st.accountNumber, created_at: '2026-01-01T00:00:00Z' });
      if (p === '/clock') return send(200, { is_open: st.open, next_open: '', next_close: '' });
      if (p === '/positions') return send(200, Object.keys(st.positions).map(posJson));
      if (p.startsWith('/positions/')) { const k = decodeURIComponent(p.slice(11)); return st.positions[k] ? send(200, posJson(k)) : send(404, { message: 'position does not exist' }); }
      if (p.startsWith('/assets/')) return send(200, { symbol: decodeURIComponent(p.slice(8)), class: 'crypto', tradable: true, fractionable: true, name: '', min_order_size: '0.0001', min_trade_increment: '0.0001', price_increment: '1' });
      if (p === '/orders' && req.method === 'POST') {
        const b = JSON.parse(raw || '{}');
        if (!(b.symbol in st.prices)) return send(422, { message: `asset ${b.symbol} not found` });
        const o: FakeOrder = { id: randomUUID(), client_order_id: b.client_order_id, symbol: b.symbol, side: b.side, type: b.type, qty: b.qty ?? null, notional: b.notional ?? null, status: 'new', limit_price: b.limit_price ?? null, stop_price: b.stop_price ?? null, submitted_at: new Date().toISOString(), filled_avg_price: null, filled_qty: '0', time_in_force: b.time_in_force };
        st.orders.set(o.id, o);
        st.match();
        return send(200, o);
      }
      if (p.startsWith('/orders/')) {
        const o = st.orders.get(p.slice(8));
        if (!o) return send(404, { message: 'order not found' });
        if (req.method === 'DELETE') { if (o.status === 'new') o.status = 'canceled'; res.writeHead(204); return res.end(); }
        return send(200, o);
      }
      if (p === '/orders') {
        const want = u.searchParams.get('status') ?? 'open';
        return send(200, [...st.orders.values()].filter((o) => want === 'all' || (want === 'closed' ? o.status !== 'new' : o.status === 'new')));
      }
      return send(404, { message: 'not found' });
    });
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  st.url = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  return st;
}
