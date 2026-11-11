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
import { createCore, validKeys } from '../supabase/functions/alpaca/core.js';

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

function dataEnv() { return keys.live ? 'live' : 'paper'; }

async function audit(entry) {
  await mkdir(SECRETS, { recursive: true });
  await appendFile(AUDIT_FILE, JSON.stringify({ t: new Date().toISOString(), ...entry }) + '\n', { mode: 0o600 });
}

// Regole e rotte verso Alpaca: le stesse della funzione Supabase del sito pubblico (che però ammette solo il Paper).
const core = createCore({ trading: TRADING, data: DATA, keysOf: (env) => keys[env], dataEnv, audit, liveMaxOrder: LIVE_MAX_ORDER });
const alpaca = core.alpaca;

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
      if (!env || !validKeys(keyId, secret)) return send(res, 400, { message: 'Chiavi non valide' });
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
  const out = await core.handle({ method: req.method, parts: parts.slice(1), query: url.searchParams, header: (n) => req.headers[n], body: () => readBody(req) });
  if (out) return send(res, out.status, out.body);
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
