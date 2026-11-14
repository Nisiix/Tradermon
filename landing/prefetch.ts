// Scaricamento anticipato della prima schermata del gioco (elenco messo nella pagina da vite.config.ts,
// gamePrefetch): a pagina ferma, con priorità minima, così toccando "Gioca" il titolo arriva dalla cache.
// Niente con il risparmio dati attivo o su una rete lenta: chi guarda solo la landing non paga il gioco.
type Conn = { saveData?: boolean; effectiveType?: string };

export function prefetchGame(): void {
  const list = document.querySelector<HTMLMetaElement>('meta[name="tradermon-prefetch"]')?.content.trim();
  if (!list) return;
  const c = (navigator as Navigator & { connection?: Conn }).connection;
  if (c?.saveData || /(^|-)2g$/.test(c?.effectiveType ?? '')) return;
  const go = () => {
    for (const f of list.split(/\s+/)) {
      const l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = './' + f;
      // il gioco chiede moduli e stili con CORS (attributo crossorigin): stesso modo, così la copia anticipata vale
      l.crossOrigin = 'anonymous';
      document.head.appendChild(l);
    }
  };
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 4000 }) : setTimeout(go, 1500));
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });
}
