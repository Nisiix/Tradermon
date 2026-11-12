import { readFileSync } from 'node:fs';
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

export default defineConfig({
  base: './',
  plugins: [pagePolicy()],
  server: {
    port: 5173,
    proxy: { '/api': `http://127.0.0.1:${API_PORT}` },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    // index.html è la landing page; il gioco vive in gioca/index.html (Gioca a Tradermon).
    // hd2d.html è il prototipo 2.5D (Three.js): si apre da /hd2d.html, separato dal gioco
    rollupOptions: { input: { landing: 'index.html', main: 'gioca/index.html', hd2d: 'hd2d.html', privacy: 'privacy/index.html' } },
  },
});
