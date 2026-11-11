#!/usr/bin/env node
// Verifica, con le TUE chiavi Alpaca Paper, che i periodi storici usati da missioni, Lab e crisi leggendarie
// abbiano dati per tutti i titoli della vetrina. Va lanciato con il server di Tradermon acceso e le chiavi
// già collegate dal gioco:   npm start   (in un altro terminale)   node scripts/check-windows.mjs
// I dati scaricati non vengono salvati da nessuna parte: lo script stampa solo un riepilogo.
import { readFile } from 'node:fs/promises';

const BASE = process.env.TRADERMON_URL || 'http://localhost:8888';
const get = async (p) => { const r = await fetch(BASE + p); const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { message: t }; } if (!r.ok) throw new Error(d.message || r.status); return d; };

const st = await get('/api/status').catch(() => null);
if (!st) { console.error(`Il server di Tradermon non risponde su ${BASE}: avvialo con "npm start".`); process.exit(1); }
if (!st.paper.configured) { console.error('Nessuna chiave Alpaca collegata: collegala dal gioco (menu, voce "Chiavi API").'); process.exit(1); }

const assetsSrc = await readFile(new URL('../src/data/assets.ts', import.meta.url), 'utf8');
const ids = [...assetsSrc.matchAll(/A\(\{ id: '([^']+)'[^\n]*?cls: '(\w+)'/g)].map((m) => ({ id: m[1], cls: m[2] }));
const missionsSrc = await readFile(new URL('../src/data/missions.ts', import.meta.url), 'utf8');
const windows = new Map();
for (const m of missionsSrc.matchAll(/start: '(\d{4}-\d\d-\d\d)', end: '(\d{4}-\d\d-\d\d)'/g)) windows.set(`${m[1]} → ${m[2]}`, { start: m[1], end: m[2] });

console.log(`Titoli in vetrina: ${ids.length}. Periodi da verificare: ${windows.size}.\n`);
let bad = 0;
for (const [label, w] of windows) {
  try {
    const { bars } = await get(`/api/data/daily?symbols=${encodeURIComponent(ids.map((a) => a.id).join(','))}&start=${w.start}&end=${w.end}`);
    const days = Math.max(0, ...Object.values(bars).map((b) => b.length));
    const stockDays = Math.max(0, ...ids.filter((a) => a.cls !== 'crypto').map((a) => bars[a.id]?.length ?? 0));
    const missing = ids.filter((a) => (bars[a.id]?.length ?? 0) < (a.cls === 'crypto' ? days : stockDays) * 0.9).map((a) => a.id);
    const ret = (id) => { const b = bars[id]; return b?.length ? `${(((b[b.length - 1].c / b[0].c) - 1) * 100).toFixed(1)}%` : 'n/d'; };
    console.log(`${label}: ${stockDays} sedute. SPY ${ret('SPY')}, BTC ${ret('BTC/USD')}.${missing.length ? ` SENZA DATI SUFFICIENTI: ${missing.join(', ')}` : ' Tutti i titoli coperti.'}`);
    if (stockDays < 20) { bad++; console.log('   ATTENZIONE: meno di 20 sedute, il replay non partirebbe.'); }
  } catch (e) { bad++; console.log(`${label}: ERRORE ${e.message}`); }
}
console.log(bad ? `\n${bad} periodi da sistemare.` : '\nTutti i periodi hanno dati. I titoli segnalati senza dati vengono semplicemente esclusi da quel replay.');
process.exit(bad ? 1 : 0);
