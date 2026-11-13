// Uscita dal gioco verso la landing page.

/**
 * Indirizzo della landing page: il gioco vive nella sottocartella /gioca/ e la landing nella cartella sopra,
 * quindi di default si risale di un livello. VITE_HOME_URL lo sostituisce se la landing si sposta.
 */
export function homeUrl(loc: { href: string; pathname: string } = location): string {
  const env = (import.meta.env.VITE_HOME_URL as string | undefined)?.trim();
  if (env) return new URL(env, loc.href).href;
  const dir = loc.pathname.replace(/[^/]*$/, ''); // cartella della pagina del gioco
  return new URL(dir === '/' ? '/' : '../', new URL(dir, loc.href)).href;
}

/** Sezione Guida della landing page: lì c'è la guida completa per creare e collegare un conto Alpaca. */
export function guideUrl(loc: { href: string; pathname: string } = location): string {
  return homeUrl(loc) + '#guida';
}

/** Esce verso la home. Se il gioco gira dentro la cornice a schermo intero della landing, esce la pagina intera. */
export function goHome(): void {
  const url = homeUrl();
  try { if (window.top && window.top !== window) { window.top.location.href = url; return; } } catch { /* cornice di un altro sito */ }
  location.href = url;
}
