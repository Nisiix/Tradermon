import { defineConfig } from 'vite';

// Porta del server locale (API Alpaca): la stessa letta da server/index.mjs.
const API_PORT = Number(process.env.TRADERMON_PORT || process.env.PORT || 8888);

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    proxy: { '/api': `http://127.0.0.1:${API_PORT}` },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    // hd2d.html è il prototipo 2.5D (Three.js): si apre da /hd2d.html, separato dal gioco
    rollupOptions: { input: { main: 'index.html', hd2d: 'hd2d.html' } },
  },
});
