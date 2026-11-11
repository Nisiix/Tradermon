// Server locale di Tradermon: serve il gioco e fa da unico intermediario verso Alpaca.
// Nessuna dipendenza esterna: richiede solo Node.js 20+.
//
// Sicurezza:
//  - ascolta solo su 127.0.0.1 (configurabile con TRADERMON_HOST);
//  - le chiavi Alpaca inserite nel gioco sono salvate in server/.secrets/keys.json (permessi 600, escluso da Git)
//    e non vengono mai restituite al browser;
//  - solo un elenco chiuso di endpoint Alpaca è raggiungibile;
//  - gli ordini LIVE richiedono la parola di conferma e rispettano un tetto rigido per ordine;
//  - niente vendite allo scoperto; gli acquisti non superano la liquidità disponibile, oppure, quando il giocatore
//    usa la leva (intestazione x-tradermon-margin), il potere d'acquisto concesso da Alpaca;
//  - ogni ordine è registrato in server/.secrets/audit.log.

import http from 'node:http';
import { readFile, writeFile, mkdir, appendFile, stat, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(ROOT, '..', 'dist');
const SECRETS = process.env.TRADERMON_SECRETS_DIR ? path.resolve(process.env.TRADERMON_SECRETS_DIR) : path.join(ROOT, '.secrets');
const KEYS_FILE = path.join(SECRETS, 'keys.json');
const AUDIT_FILE = path.join(SECRETS, 'audit.log');
const PORT = Number(process.env.TRADERMON_PORT || process.env.PORT || 8888);
const HOST = process.env.TRADERMON_HOST || '127.0.0.1';
const LIVE_MAX_ORDER = Number(process.env.TRADERMON_LIVE_MAX_ORDER || 2500);

// Indirizzi di Alpaca. TRADERMON_ALPACA_MOCK serve solo ai test automatici (un finto Alpaca locale):
// è accettato soltanto se punta a questo stesso computer.
const MOCK = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.TRADERMON_ALPACA_MOCK || '') ? process.env.TRADERMON_ALPACA_MOCK : '';
const TRADING = MOCK ? { paper: `${MOCK}/paper/v2`, live: `${MOCK}/live/v2` } : { paper: 'https://paper-api.alpaca.markets/v2', live: 'https://api.alpaca.markets/v2' };
const DATA = MOCK ? `${MOCK}/data` : 'https://data.alpaca.markets';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

let keys = { paper: null, live: null };

async function loadKeys() {
  try { keys = { paper: null, live: null, ...JSON.parse(await readFile(KEYS_FILE, 'utf8')) }; } catch { /* nessuna chiave */ }
}

async function saveKeys() {
  await mkdir(SECRETS, { recursive: true });
  await writeFile(KEYS_FILE, JSON.stringify(keys, null, 2), { mode: 0o600 });
  try { await chmod(KEYS_FILE, 0o600); } catch { /* Windows */ }
}

function hint(k) {
  return k ? { configured: true, keyHint: `${k.keyId.slice(0, 4)}…${k.keyId.slice(-3)}` } : { configured: false };
}

function send(res, code, body) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw new Error('Richiesta troppo grande');
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function alpaca(env, method, url, body) {
  const k = keys[env];
  if (!k) { const e = new Error(`Nessuna chiave ${env === 'live' ? 'Live' : 'Paper'} configurata. Inseriscila nella Clinica.`); e.status = 400; throw e; }
  const r = await fetch(url, {
    method,
    headers: { 'APCA-API-KEY-ID': k.keyId, 'APCA-API-SECRET-KEY': k.secret, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!r.ok) { const e = new Error(data.message || `Alpaca ha risposto ${r.status}`); e.status = r.status; throw e; }
  return data;
}

function dataEnv() { return keys.live ? 'live' : 'paper'; }

async function audit(entry) {
  await mkdir(SECRETS, { recursive: true });
  await appendFile(AUDIT_FILE, JSON.stringify({ t: new Date().toISOString(), ...entry }) + '\n', { mode: 0o600 });
}

const SYMBOL_RE = /^[A-Z0-9.]{1,12}(\/[A-Z]{3,5})?$/;

async function validateOrder(env, o, confirm, margin = false) {
  if (!o || typeof o !== 'object') throw Object.assign(new Error('Ordine non valido'), { status: 400 });
  const symbol = String(o.symbol || '').toUpperCase();
  if (!SYMBOL_RE.test(symbol)) throw Object.assign(new Error('Simbolo non valido'), { status: 400 });
  if (!['buy', 'sell'].includes(o.side)) throw Object.assign(new Error('Lato non valido'), { status: 400 });
  if (!['market', 'limit', 'stop', 'stop_limit'].includes(o.type)) throw Object.assign(new Error('Tipo di ordine non consentito'), { status: 400 });
  if (!['day', 'gtc', 'ioc'].includes(o.time_in_force)) throw Object.assign(new Error('Validità non consentita'), { status: 400 });
  if (!o.notional && !o.qty) throw Object.assign(new Error('Serve un importo o una quantità'), { status: 400 });
  if (env === 'live' && confirm !== 'CONFERMO') throw Object.assign(new Error('Per gli ordini reali serve la parola di conferma CONFERMO'), { status: 403 });

  const clean = {
    symbol, side: o.side, type: o.type, time_in_force: o.time_in_force,
    client_order_id: String(o.client_order_id || `tm-${Date.now()}`).slice(0, 48),
  };
  if (o.notional) clean.notional = String(Number(o.notional).toFixed(2));
  if (o.qty) clean.qty = String(Number(o.qty));
  if (o.type === 'limit' || o.type === 'stop_limit') clean.limit_price = String(Number(o.limit_price));
  if (o.type === 'stop' || o.type === 'stop_limit') clean.stop_price = String(Number(o.stop_price));
  for (const k of ['limit_price', 'stop_price']) if (k in clean && !(Number(clean[k]) > 0)) throw Object.assign(new Error('Prezzo limite/stop non valido'), { status: 400 });
  // sulle cripto Alpaca accetta solo validità gtc o ioc e non accetta lo stop semplice
  if (symbol.includes('/')) {
    if (clean.time_in_force === 'day') clean.time_in_force = 'gtc';
    if (clean.type === 'stop') throw Object.assign(new Error('Sulle cripto usa uno stop limit'), { status: 400 });
  } else if (clean.notional && (clean.type !== 'market' || clean.time_in_force !== 'day')) {
    throw Object.assign(new Error('Gli ordini frazionari (per importo) sulle azioni devono essere a mercato e giornalieri'), { status: 400 });
  }

  // prezzo stimato per i controlli
  const isCrypto = symbol.includes('/');
  let price = Number(o.limit_price || o.stop_price || 0);
  if (!price) {
    try { price = (await latestPrice(symbol, isCrypto)).price; } catch { price = 0; }
  }
  const estimate = clean.notional ? Number(clean.notional) : Number(clean.qty) * price;

  if (env === 'live' && estimate > LIVE_MAX_ORDER) throw Object.assign(new Error(`L'ordine supera il tetto del server (${LIVE_MAX_ORDER} $)`), { status: 403 });

  if (o.side === 'buy') {
    const acc = await alpaca(env, 'GET', `${TRADING[env]}/account`);
    const cash = Number(acc.cash);
    // con la leva (scelta del giocatore, solo dopo l'Esame della Leva) vale il potere d'acquisto di Alpaca, che ne fissa il tetto
    const limit = margin ? Number(acc.buying_power) : cash;
    if (estimate > limit) throw Object.assign(new Error(margin ? 'Potere d\'acquisto insufficiente: supera il margine concesso da Alpaca' : 'Liquidità insufficiente: senza leva Tradermon non usa margine né prestiti'), { status: 403 });
  } else {
    let pos = null;
    try { pos = await alpaca(env, 'GET', `${TRADING[env]}/positions/${encodeURIComponent(symbol.replace('/', ''))}`); } catch { pos = null; }
    if (!pos) throw Object.assign(new Error('Non possiedi questo titolo: le vendite allo scoperto non sono consentite'), { status: 403 });
    const owned = Number(pos.qty);
    const mv = Number(pos.market_value);
    if ((clean.qty && Number(clean.qty) > owned + 1e-9) || (clean.notional && Number(clean.notional) > mv + 0.01)) {
      throw Object.assign(new Error('Stai vendendo più di quanto possiedi: niente vendite allo scoperto'), { status: 403 });
    }
  }
  return { clean, estimate };
}

async function latestPrice(symbol, isCrypto) {
  const env = dataEnv();
  if (isCrypto) {
    const d = await alpaca(env, 'GET', `${DATA}/v1beta3/crypto/us/latest/trades?symbols=${encodeURIComponent(symbol)}`);
    return { price: d.trades?.[symbol]?.p ?? 0 };
  }
  const d = await alpaca(env, 'GET', `${DATA}/v2/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=iex`);
  return { price: d.trade?.p ?? 0 };
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  if (parts[1] === 'status' && req.method === 'GET') {
    return send(res, 200, { ok: true, paper: hint(keys.paper), live: hint(keys.live), liveMaxOrder: LIVE_MAX_ORDER });
  }
  if (parts[1] === 'keys') {
    if (req.method === 'POST') {
      const b = await readBody(req);
      const env = b.env === 'live' ? 'live' : b.env === 'paper' ? 'paper' : null;
      const keyId = String(b.keyId || '').trim();
      const secret = String(b.secret || '').trim();
      if (!env || !/^[A-Z0-9]{10,40}$/i.test(keyId) || secret.length < 20 || secret.length > 120) return send(res, 400, { message: 'Chiavi non valide' });
      const prev = keys[env];
      keys[env] = { keyId, secret };
      try {
        const acc = await alpaca(env, 'GET', `${TRADING[env]}/account`);
        await saveKeys();
        await audit({ event: 'keys_set', env });
        return send(res, 200, { ok: true, account: { status: acc.status, currency: acc.currency } });
      } catch (e) {
        keys[env] = prev;
        return send(res, 400, { message: `Alpaca ha rifiutato le chiavi ${env === 'live' ? 'Live' : 'Paper'}: ${e.message}` });
      }
    }
    if (req.method === 'DELETE' && (parts[2] === 'paper' || parts[2] === 'live')) {
      keys[parts[2]] = null;
      await saveKeys();
      await audit({ event: 'keys_deleted', env: parts[2] });
      return send(res, 200, { ok: true });
    }
  }
  if (parts[1] === 'alpaca' && (parts[2] === 'paper' || parts[2] === 'live')) {
    const env = parts[2];
    const rest = parts.slice(3);
    const base = TRADING[env];
    if (req.method === 'GET' && rest.length === 1 && ['account', 'positions', 'clock'].includes(rest[0])) {
      return send(res, 200, await alpaca(env, 'GET', `${base}/${rest[0]}`));
    }
    if (req.method === 'GET' && rest[0] === 'orders' && rest.length === 1) {
      const status = url.searchParams.get('status') === 'all' ? 'all' : 'open';
      return send(res, 200, await alpaca(env, 'GET', `${base}/orders?status=${status}&limit=50`));
    }
    if (req.method === 'GET' && rest[0] === 'assets' && rest.length >= 2) {
      const sym = decodeURIComponent(rest.slice(1).join('/')).toUpperCase();
      if (!SYMBOL_RE.test(sym)) return send(res, 400, { message: 'Simbolo non valido' });
      return send(res, 200, await alpaca(env, 'GET', `${base}/assets/${encodeURIComponent(sym)}`));
    }
    if (req.method === 'POST' && rest[0] === 'orders' && rest.length === 1) {
      const body = await readBody(req);
      const { clean, estimate } = await validateOrder(env, body, req.headers['x-tradermon-confirm'], req.headers['x-tradermon-margin'] === '1');
      try {
        const out = await alpaca(env, 'POST', `${base}/orders`, clean);
        await audit({ event: 'order', env, symbol: clean.symbol, side: clean.side, type: clean.type, estimate, id: out.id, client_order_id: clean.client_order_id, status: out.status });
        return send(res, 200, out);
      } catch (e) {
        await audit({ event: 'order_rejected', env, symbol: clean.symbol, side: clean.side, estimate, reason: e.message });
        throw e;
      }
    }
    if (req.method === 'GET' && rest[0] === 'orders' && rest.length === 2) {
      const id = rest[1];
      if (!/^[a-f0-9-]{36}$/i.test(id)) return send(res, 400, { message: 'Id ordine non valido' });
      return send(res, 200, await alpaca(env, 'GET', `${base}/orders/${id}`));
    }
    if (req.method === 'DELETE' && rest[0] === 'orders' && rest.length === 2) {
      const id = rest[1];
      if (!/^[a-f0-9-]{36}$/i.test(id)) return send(res, 400, { message: 'Id ordine non valido' });
      await alpaca(env, 'DELETE', `${base}/orders/${id}`);
      await audit({ event: 'order_cancel', env, id });
      return send(res, 200, { ok: true });
    }
  }
  if (parts[1] === 'data' && (parts[2] === 'daily' || parts[2] === 'snapshot')) {
    // più simboli insieme: azioni/ETF e cripto vanno su endpoint diversi di Alpaca
    const list = String(url.searchParams.get('symbols') || '').toUpperCase().split(',').map((x) => x.trim()).filter(Boolean);
    if (!list.length || list.length > 60 || list.some((x) => !SYMBOL_RE.test(x))) return send(res, 400, { message: 'Elenco di simboli non valido' });
    const stocks = list.filter((x) => !x.includes('/'));
    const crypto = list.filter((x) => x.includes('/'));
    const env = dataEnv();
    if (parts[2] === 'snapshot') {
      const prices = {};
      if (stocks.length) {
        const d = await alpaca(env, 'GET', `${DATA}/v2/stocks/trades/latest?symbols=${encodeURIComponent(stocks.join(','))}&feed=iex`);
        for (const [k, v] of Object.entries(d.trades ?? {})) prices[k] = v.p;
      }
      if (crypto.length) {
        const d = await alpaca(env, 'GET', `${DATA}/v1beta3/crypto/us/latest/trades?symbols=${encodeURIComponent(crypto.join(','))}`);
        for (const [k, v] of Object.entries(d.trades ?? {})) prices[k] = v.p;
      }
      return send(res, 200, { prices });
    }
    const start = String(url.searchParams.get('start') || '').slice(0, 10);
    const end = String(url.searchParams.get('end') || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return send(res, 400, { message: 'Date non valide' });
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
    return send(res, 200, { bars: out });
  }
  if (parts[1] === 'data') {
    const sym = String(url.searchParams.get('symbol') || '').toUpperCase();
    const cls = url.searchParams.get('class') === 'crypto' ? 'crypto' : 'stocks';
    if (!SYMBOL_RE.test(sym)) return send(res, 400, { message: 'Simbolo non valido' });
    if (parts[2] === 'latest') return send(res, 200, await latestPrice(sym, cls === 'crypto'));
    if (parts[2] === 'bars') {
      const start = String(url.searchParams.get('start') || '').slice(0, 10);
      const end = String(url.searchParams.get('end') || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return send(res, 400, { message: 'Date non valide' });
      const TIMEFRAMES = new Set(['5Min', '15Min', '1Hour', '4Hour', '1Day']);
      const tf = String(url.searchParams.get('timeframe') || '1Day');
      if (!TIMEFRAMES.has(tf)) return send(res, 400, { message: 'Orizzonte non valido (5Min, 15Min, 1Hour, 4Hour, 1Day)' });
      const env = dataEnv();
      if (cls === 'crypto') {
        const d = await alpaca(env, 'GET', `${DATA}/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(sym)}&timeframe=${tf}&start=${start}&end=${end}&limit=10000`);
        return send(res, 200, { bars: d.bars?.[sym] ?? [] });
      }
      const d = await alpaca(env, 'GET', `${DATA}/v2/stocks/${encodeURIComponent(sym)}/bars?timeframe=${tf}&start=${start}&end=${end}&limit=10000&adjustment=all&feed=iex`);
      return send(res, 200, { bars: d.bars ?? [] });
    }
  }
  return send(res, 404, { message: 'Endpoint non disponibile' });
}

async function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(DIST, '.' + p);
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  let target = file;
  try {
    const st = await stat(target);
    // cartella senza barra finale (es. /gioca): come GitHub Pages, reindirizza a /gioca/
    if (st.isDirectory() && existsSync(path.join(file, 'index.html'))) { res.writeHead(301, { Location: p + '/' + url.search }); return res.end(); }
    if (!st.isFile()) target = path.join(DIST, 'index.html');
  } catch { target = path.join(DIST, 'index.html'); }
  try {
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Build non trovata. Esegui "npm run build" oppure usa "npm run dev".');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      // accetta solo richieste dalla stessa origine locale
      const origin = req.headers.origin;
      if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return send(res, 403, { message: 'Origine non consentita' });
      return await handleApi(req, res, url);
    }
    return await serveStatic(req, res, url);
  } catch (e) {
    return send(res, e.status && e.status < 600 ? e.status : 500, { message: e.message || 'Errore interno' });
  }
});

await loadKeys();
server.listen(PORT, HOST, () => {
  const built = existsSync(path.join(DIST, 'index.html'));
  console.log(`Tradermon server su http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}${built ? '' : '  (solo API: build non trovata)'}`);
});
