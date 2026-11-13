import { readFileSync, readdirSync } from 'node:fs';
import { englishDictionary, landingDictionary } from './scripts/i18n-build';
import { defineConfig, type Plugin } from 'vite';

// Porta del server locale (API Alpaca): la stessa letta da server/index.mjs.
const API_PORT = Number(process.env.TRADERMON_PORT || process.env.PORT || 8888);

/** Origine (schema e host) di un indirizzo, oppure '' se non è un indirizzo valido. */
const origin = (u: string | undefined) => { try { return u ? new URL(u).origin : ''; } catch { return ''; } };

/**
 * Regole della pagina pubblicata (Content-Security-Policy). Dal sito le chiavi Alpaca vivono nel browser, quindi
 * la pagina deve poter eseguire SOLO il codice del gioco e parlare SOLO con Alpaca e con il servizio dei
 * salvataggi: uno script estraneo non viene eseguito e nessun dato può partire verso altri indirizzi.
 * Vale per la versione compilata (in sviluppo Vite ha bisogno di script in linea).
 */
export function contentPolicy(env: Record<string, string | undefined> = process.env): string {
  const fallback = /VITE_SUPABASE_URL \?\? '([^']+)'/.exec(readFileSync(new URL('./src/config/supabase.ts', import.meta.url), 'utf8'))?.[1];
  const supabase = origin(env.VITE_SUPABASE_URL ?? fallback);
  const connect = ["'self'", 'data:', 'blob:', 'https://paper-api.alpaca.markets', 'https://data.alpaca.markets', supabase, origin(env.VITE_API_BASE)].filter(Boolean);
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

function pagePolicy(): Plugin {
  return {
    name: 'tradermon-content-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: contentPolicy() }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ],
  };
}

/**
 * Dizionari inglesi come moduli virtuali: '#i18n-en' (tutto, per il gioco) e '#i18n-en-landing' (solo i testi di landing
 * e privacy). Unicono src/i18n/en/*.json, scritti come { "testo italiano": "English text" }, con la chiave corta
 * hashKey(testo italiano). Vedi scripts/i18n-build.ts.
 */
function i18nPlugin(): Plugin {
  // '#i18n-en…' (package.json "imports") porta qui dentro Vite e Vitest; fuori (esbuild, tsx) porta a src/i18n/en-node.ts
  const ids: Record<string, () => Record<string, string>> = { '#i18n-en': englishDictionary, '#i18n-en-landing': landingDictionary };
  return {
    name: 'tradermon-i18n',
    // prima della risoluzione di Vite: altrimenti "imports" di package.json porta a en-node.ts, che spedisce tutti i
    // JSON (italiano e inglese) e calcola le chiavi a ogni apertura della pagina
    enforce: 'pre',
    resolveId: (s) => (s in ids ? '\0virtual:' + s.slice(1) : null),
    load(s) {
      const name = s.startsWith('\0virtual:') ? '#' + s.slice('\0virtual:'.length) : '';
      if (!(name in ids)) return null;
      const dir = new URL('./src/i18n/en/', import.meta.url);
      for (const f of readdirSync(dir)) this.addWatchFile(new URL(f, dir).pathname);
      return `export default ${JSON.stringify(ids[name]())};`;
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [i18nPlugin(), pagePolicy()],
  server: {
    port: 5173,
    proxy: { '/api': `http://127.0.0.1:${API_PORT}` },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    // index.html è la landing page; il gioco vive in gioca/index.html (Gioca a Tradermon).
    // hd2d.html è il prototipo 2.5D (Three.js): si apre da /hd2d.html, separato dal gioco
    rollupOptions: {
      input: { landing: 'index.html', main: 'gioca/index.html', hd2d: 'hd2d.html', privacy: 'privacy/index.html' },
      // ogni dizionario nel suo file: senza, Rollup può mettere quello intero del gioco nel pezzo condiviso con la landing
      output: { manualChunks: (id) => (id === '\0virtual:i18n-en' ? 'i18n-en' : id === '\0virtual:i18n-en-landing' ? 'i18n-landing' : undefined) },
    },
  },
});
