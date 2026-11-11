// Cuore del collegamento al conto Alpaca Paper (denaro finto): Tradermon è un gioco e non usa mai denaro reale.
// Condiviso da tre ospiti: il server locale (server/index.mjs), il browser dal sito pubblico (src/systems/alpaca.ts)
// e la funzione Supabase "alpaca" (index.ts in questa cartella), la riserva che il giocatore può scegliere.
// JavaScript puro, senza dipendenze: gira identico su Node, Deno e nel browser. Le regole sono le stesse per tutti:
// solo il conto Paper, elenco chiuso di endpoint, niente vendite allo scoperto, acquisti entro la liquidità (o entro
// il potere d'acquisto di Alpaca quando il giocatore usa la leva). Chi ospita decide da dove arrivano le chiavi (keysOf).

// inizia con una lettera o una cifra e non contiene due punti di fila: "." e ".." cambierebbero il percorso della richiesta
export const SYMBOL_RE = /^(?!.*\.\.)[A-Z0-9][A-Z0-9.]{0,11}(\/[A-Z]{3,5})?$/;
const ORDER_ID_RE = /^[a-f0-9-]{36}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIMEFRAMES = new Set(['5Min', '15Min', '1Hour', '4Hour', '1Day']);

/** Forma plausibile di una coppia di chiavi Alpaca (la verifica vera la fa Alpaca). */
export function validKeys(keyId, secret) {
  return typeof keyId === 'string' && typeof secret === 'string' && /^[A-Z0-9]{10,40}$/i.test(keyId) && secret.length >= 20 && secret.length <= 120 && !/\s/.test(secret);
}

const fail = (status, message) => Object.assign(new Error(message), { status });

/**
 * @param {object} cfg
 * @param {{ paper: string }} cfg.trading       indirizzo delle API di trading del conto Paper
 * @param {string} cfg.data                     indirizzo delle API dei dati di mercato
 * @param {(env: string) => ({ keyId: string, secret: string } | null)} cfg.keysOf  chiavi del conto, o null
 * @param {() => string} cfg.dataEnv            conto le cui chiavi leggono i dati di mercato
 * @param {(entry: object) => unknown} [cfg.audit]  registro degli ordini (senza chiavi)
 * @param {typeof fetch} [cfg.fetch]
 */
export function createCore(cfg) {
  const doFetch = cfg.fetch ?? fetch;
  const TRADING = cfg.trading;
  const DATA = cfg.data;
  const audit = async (entry) => { if (cfg.audit) await cfg.audit(entry); };

  async function alpaca(env, method, url, body) {
    const k = cfg.keysOf(env);
    if (!k) throw fail(400, 'Nessuna chiave Paper configurata. Inseriscila dalla voce "Chiavi API".');
    const r = await doFetch(url, {
      method,
      headers: { 'APCA-API-KEY-ID': k.keyId, 'APCA-API-SECRET-KEY': k.secret, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
    if (!r.ok) throw fail(r.status, data.message || `Alpaca ha risposto ${r.status}`);
    return data;
  }

  async function latestPrice(symbol, isCrypto) {
    const env = cfg.dataEnv();
    if (isCrypto) {
      const d = await alpaca(env, 'GET', `${DATA}/v1beta3/crypto/us/latest/trades?symbols=${encodeURIComponent(symbol)}`);
      return { price: d.trades?.[symbol]?.p ?? 0 };
    }
    const d = await alpaca(env, 'GET', `${DATA}/v2/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=iex`);
    return { price: d.trade?.p ?? 0 };
  }

  async function validateOrder(env, o, margin = false) {
    if (!o || typeof o !== 'object') throw fail(400, 'Ordine non valido');
    const symbol = String(o.symbol || '').toUpperCase();
    if (!SYMBOL_RE.test(symbol)) throw fail(400, 'Simbolo non valido');
    if (!['buy', 'sell'].includes(o.side)) throw fail(400, 'Lato non valido');
    if (!['market', 'limit', 'stop', 'stop_limit'].includes(o.type)) throw fail(400, 'Tipo di ordine non consentito');
    if (!['day', 'gtc', 'ioc'].includes(o.time_in_force)) throw fail(400, 'Validità non consentita');
    if (!o.notional && !o.qty) throw fail(400, 'Serve un importo o una quantità');

    const clean = {
      symbol, side: o.side, type: o.type, time_in_force: o.time_in_force,
      client_order_id: String(o.client_order_id || `tm-${Date.now()}`).slice(0, 48),
    };
    if (o.notional) clean.notional = String(Number(o.notional).toFixed(2));
    if (o.qty) clean.qty = String(Number(o.qty));
    if (o.type === 'limit' || o.type === 'stop_limit') clean.limit_price = String(Number(o.limit_price));
    if (o.type === 'stop' || o.type === 'stop_limit') clean.stop_price = String(Number(o.stop_price));
    for (const k of ['notional', 'qty']) if (k in clean && !(Number(clean[k]) > 0)) throw fail(400, 'Importo o quantità non validi');
    for (const k of ['limit_price', 'stop_price']) if (k in clean && !(Number(clean[k]) > 0)) throw fail(400, 'Prezzo limite/stop non valido');
    // sulle cripto Alpaca accetta solo validità gtc o ioc e non accetta lo stop semplice
    if (symbol.includes('/')) {
      if (clean.time_in_force === 'day') clean.time_in_force = 'gtc';
      if (clean.type === 'stop') throw fail(400, 'Sulle cripto usa uno stop limit');
    } else if (clean.notional && (clean.type !== 'market' || clean.time_in_force !== 'day')) {
      throw fail(400, 'Gli ordini frazionari (per importo) sulle azioni devono essere a mercato e giornalieri');
    }

    // prezzo stimato per i controlli
    const isCrypto = symbol.includes('/');
    let price = Number(o.limit_price || o.stop_price || 0);
    if (!price) {
      try { price = (await latestPrice(symbol, isCrypto)).price; } catch { price = 0; }
    }
    const estimate = clean.notional ? Number(clean.notional) : Number(clean.qty) * price;

    if (o.side === 'buy') {
      const acc = await alpaca(env, 'GET', `${TRADING[env]}/account`);
      const cash = Number(acc.cash);
      // con la leva (scelta del giocatore, solo dopo l'Esame della Leva) vale il potere d'acquisto di Alpaca, che ne fissa il tetto
      const limit = margin ? Number(acc.buying_power) : cash;
      if (estimate > limit) throw fail(403, margin ? 'Potere d\'acquisto insufficiente: supera il margine concesso da Alpaca' : 'Liquidità insufficiente: senza leva Tradermon non usa margine né prestiti');
    } else {
      let pos = null;
      try { pos = await alpaca(env, 'GET', `${TRADING[env]}/positions/${encodeURIComponent(symbol.replace('/', ''))}`); } catch { pos = null; }
      if (!pos) throw fail(403, 'Non possiedi questo titolo: le vendite allo scoperto non sono consentite');
      const owned = Number(pos.qty);
      const mv = Number(pos.market_value);
      if ((clean.qty && Number(clean.qty) > owned + 1e-9) || (clean.notional && Number(clean.notional) > mv + 0.01)) {
        throw fail(403, 'Stai vendendo più di quanto possiedi: niente vendite allo scoperto');
      }
    }
    return { clean, estimate };
  }

  /**
   * Gestisce le rotte "alpaca/paper/..." e "data/...".
   * @param {{ method: string, parts: string[], query: URLSearchParams, header: (name: string) => (string | null | undefined), body: () => Promise<any> }} rq
   *        `parts` sono i segmenti del percorso dopo "/api".
   * @returns {Promise<{ status: number, body: any } | null>} null se la rotta non è tra quelle ammesse
   */
  async function handle(rq) {
    const { method, parts, query } = rq;
    const ok = (body) => ({ status: 200, body });
    const bad = (message) => ({ status: 400, body: { message } });

    if (parts[0] === 'alpaca' && parts[1] === 'paper') {
      const env = 'paper';
      const base = TRADING.paper;
      if (!base) throw fail(403, 'Il conto Paper non è disponibile qui.');
      const rest = parts.slice(2);
      if (method === 'GET' && rest.length === 1 && ['account', 'positions', 'clock'].includes(rest[0])) {
        return ok(await alpaca(env, 'GET', `${base}/${rest[0]}`));
      }
      if (method === 'GET' && rest[0] === 'orders' && rest.length === 1) {
        const want = query.get('status');
        const status = want === 'all' || want === 'closed' ? want : 'open';
        return ok(await alpaca(env, 'GET', `${base}/orders?status=${status}&limit=${status === 'closed' ? 100 : 50}&direction=desc`));
      }
      if (method === 'GET' && rest[0] === 'assets' && rest.length >= 2) {
        const sym = decodeURIComponent(rest.slice(1).join('/')).toUpperCase();
        if (!SYMBOL_RE.test(sym)) return bad('Simbolo non valido');
        return ok(await alpaca(env, 'GET', `${base}/assets/${encodeURIComponent(sym)}`));
      }
      if (method === 'POST' && rest[0] === 'orders' && rest.length === 1) {
        const body = await rq.body();
        const { clean, estimate } = await validateOrder(env, body, rq.header('x-tradermon-margin') === '1');
        try {
          const out = await alpaca(env, 'POST', `${base}/orders`, clean);
          await audit({ event: 'order', env, symbol: clean.symbol, side: clean.side, type: clean.type, estimate, id: out.id, client_order_id: clean.client_order_id, status: out.status });
          return ok(out);
        } catch (e) {
          await audit({ event: 'order_rejected', env, symbol: clean.symbol, side: clean.side, estimate, reason: e.message });
          throw e;
        }
      }
      if (method === 'GET' && rest[0] === 'orders' && rest.length === 2) {
        if (!ORDER_ID_RE.test(rest[1])) return bad('Id ordine non valido');
        return ok(await alpaca(env, 'GET', `${base}/orders/${rest[1]}`));
      }
      if (method === 'DELETE' && rest[0] === 'orders' && rest.length === 2) {
        if (!ORDER_ID_RE.test(rest[1])) return bad('Id ordine non valido');
        await alpaca(env, 'DELETE', `${base}/orders/${rest[1]}`);
        await audit({ event: 'order_cancel', env, id: rest[1] });
        return ok({ ok: true });
      }
      return null;
    }

    if (parts[0] === 'data' && method === 'GET' && (parts[1] === 'daily' || parts[1] === 'snapshot')) {
      // più simboli insieme: azioni/ETF e cripto vanno su endpoint diversi di Alpaca
      const list = String(query.get('symbols') || '').toUpperCase().split(',').map((x) => x.trim()).filter(Boolean);
      if (!list.length || list.length > 60 || list.some((x) => !SYMBOL_RE.test(x))) return bad('Elenco di simboli non valido');
      const stocks = list.filter((x) => !x.includes('/'));
      const crypto = list.filter((x) => x.includes('/'));
      const env = cfg.dataEnv();
      if (parts[1] === 'snapshot') {
        const prices = {};
        if (stocks.length) {
          const d = await alpaca(env, 'GET', `${DATA}/v2/stocks/trades/latest?symbols=${encodeURIComponent(stocks.join(','))}&feed=iex`);
          for (const [k, v] of Object.entries(d.trades ?? {})) prices[k] = v.p;
        }
        if (crypto.length) {
          const d = await alpaca(env, 'GET', `${DATA}/v1beta3/crypto/us/latest/trades?symbols=${encodeURIComponent(crypto.join(','))}`);
          for (const [k, v] of Object.entries(d.trades ?? {})) prices[k] = v.p;
        }
        return ok({ prices });
      }
      const start = String(query.get('start') || '').slice(0, 10);
      const end = String(query.get('end') || '').slice(0, 10);
      if (!DATE_RE.test(start) || !DATE_RE.test(end)) return bad('Date non valide');
      const out = {};
      const page = async (u) => {
        let token = '';
        for (let i = 0; i < 40; i++) {
          const d = await alpaca(env, 'GET', u + (token ? `&page_token=${encodeURIComponent(token)}` : ''));
          for (const [k, v] of Object.entries(d.bars ?? {})) (out[k] ??= []).push(...v);
          token = d.next_page_token;
          if (!token) break;
        }
      };
      if (stocks.length) {
        // storico: il feed SIP gratuito copre il passato (non gli ultimi 15 minuti); se il piano non lo consente si ripiega su IEX
        const recent = Date.parse(end) > Date.now() - 2 * 86400000;
        const q = `${DATA}/v2/stocks/bars?symbols=${encodeURIComponent(stocks.join(','))}&timeframe=1Day&start=${start}&end=${end}&limit=10000&adjustment=split`;
        try { await page(q + `&feed=${recent ? 'iex' : 'sip'}`); } catch { await page(q + '&feed=iex'); }
      }
      if (crypto.length) await page(`${DATA}/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(crypto.join(','))}&timeframe=1Day&start=${start}&end=${end}&limit=10000`);
      return ok({ bars: out });
    }

    if (parts[0] === 'data' && method === 'GET' && (parts[1] === 'latest' || parts[1] === 'bars')) {
      const sym = String(query.get('symbol') || '').toUpperCase();
      const cls = query.get('class') === 'crypto' ? 'crypto' : 'stocks';
      if (!SYMBOL_RE.test(sym)) return bad('Simbolo non valido');
      if (parts[1] === 'latest') return ok(await latestPrice(sym, cls === 'crypto'));
      const start = String(query.get('start') || '').slice(0, 10);
      const end = String(query.get('end') || '').slice(0, 10);
      if (!DATE_RE.test(start) || !DATE_RE.test(end)) return bad('Date non valide');
      const tf = String(query.get('timeframe') || '1Day');
      if (!TIMEFRAMES.has(tf)) return bad('Orizzonte non valido (5Min, 15Min, 1Hour, 4Hour, 1Day)');
      const env = cfg.dataEnv();
      if (cls === 'crypto') {
        const d = await alpaca(env, 'GET', `${DATA}/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(sym)}&timeframe=${tf}&start=${start}&end=${end}&limit=10000`);
        return ok({ bars: d.bars?.[sym] ?? [] });
      }
      const d = await alpaca(env, 'GET', `${DATA}/v2/stocks/${encodeURIComponent(sym)}/bars?timeframe=${tf}&start=${start}&end=${end}&limit=10000&adjustment=all&feed=iex`);
      return ok({ bars: d.bars ?? [] });
    }
    return null;
  }

  return { alpaca, latestPrice, validateOrder, handle };
}
