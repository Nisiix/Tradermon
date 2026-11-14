import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// Menu della landing su telefono: aprirlo e toccare "Gioca" non deve mai lasciare la pagina bloccata.

/** Elemento finto, quanto basta a playInShell. */
function el(tag: string) {
  const e: Record<string, unknown> & { children: unknown[]; style: Record<string, string> } = {
    tagName: tag.toUpperCase(), children: [], style: {}, className: '',
    appendChild(c: unknown) { this.children.push(c); return c; },
    addEventListener() { /* niente */ },
    setAttribute() { /* niente */ },
    remove() { (e as { removed?: boolean }).removed = true; },
  };
  return e;
}

describe('Gioca dal menu su telefono', () => {
  let body: ReturnType<typeof el> & { classList: { removed: string[]; remove: (c: string) => void } };
  let shell: ReturnType<typeof el> | undefined;
  let frame: ReturnType<typeof el> | undefined;
  let fullscreen: () => Promise<void>;

  beforeEach(() => {
    vi.resetModules();
    const removed: string[] = [];
    body = Object.assign(el('body'), { classList: { removed, remove: (c: string) => { removed.push(c); } } });
    shell = frame = undefined;
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)' }));
    vi.stubGlobal('navigator', { maxTouchPoints: 5 });
    vi.stubGlobal('screen', { orientation: { lock: () => new Promise(() => undefined) } });
    vi.stubGlobal('location', { href: 'https://example.test/' });
    vi.stubGlobal('document', {
      body,
      fullscreenEnabled: true,
      documentElement: { style: {} },
      querySelector: (s: string) => (s === '.play-shell' && shell && !(shell as { removed?: boolean }).removed ? shell : null),
      createElement: (tag: string) => {
        const e = el(tag);
        if (tag === 'div') { shell = e; e.requestFullscreen = () => fullscreen(); }
        if (tag === 'iframe') frame = e;
        return e;
      },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('carica il gioco subito anche se il telefono non risponde mai allo schermo intero', async () => {
    fullscreen = () => new Promise(() => undefined); // promessa che non si chiude mai
    const { playInShell, shellOpen } = await import('../landing/play');
    expect(playInShell('https://example.test/gioca/')).toBe(true);
    expect(frame?.src).toBe('https://example.test/gioca/');
    expect(body.classList.removed).toContain('menu-open');
    expect(shellOpen()).toBe(true);
  });

  it('non aspetta la rotazione in orizzontale (su alcuni telefoni non finisce mai)', async () => {
    fullscreen = () => Promise.resolve();
    const { playInShell } = await import('../landing/play');
    playInShell('https://example.test/gioca/');
    await new Promise((r) => setTimeout(r, 0));
    expect(frame?.src).toBe('https://example.test/gioca/');
    expect((shell as { removed?: boolean }).removed).toBeUndefined();
  });

  it('se lo schermo intero è rifiutato toglie la cornice e apre il gioco come pagina normale', async () => {
    fullscreen = () => Promise.reject(new Error('no'));
    const { playInShell, shellOpen } = await import('../landing/play');
    playInShell('https://example.test/gioca/');
    await new Promise((r) => setTimeout(r, 0));
    expect((shell as { removed?: boolean }).removed).toBe(true);
    expect(shellOpen()).toBe(false);
    expect((globalThis as unknown as { location: { href: string } }).location.href).toBe('https://example.test/gioca/');
  });

  it('il gesto "indietro" chiude la cornice invece di lasciarla ferma sopra la pagina', async () => {
    fullscreen = () => Promise.resolve();
    const handlers: Record<string, () => void> = {};
    const pushed: unknown[] = [];
    vi.stubGlobal('addEventListener', (t: string, f: () => void) => { handlers[t] = f; });
    vi.stubGlobal('history', { state: null, pushState: (s: unknown) => { pushed.push(s); }, back: () => undefined });
    const { playInShell, shellOpen } = await import('../landing/play');
    playInShell('https://example.test/gioca/');
    expect(pushed).toHaveLength(1);
    expect(shellOpen()).toBe(true);
    handlers.popstate();
    expect(shellOpen()).toBe(false);
  });
});

describe('Barra in alto della landing', () => {
  const css = readFileSync(new URL('../landing/landing.css', import.meta.url), 'utf8');
  it('non ha filtri o trasformazioni che catturano il menu a tendina (position: fixed)', () => {
    const rule = /(^|\n)\.bar \{([^}]*)\}/.exec(css)?.[2] ?? '';
    expect(rule).toContain('position: fixed');
    expect(rule).not.toMatch(/backdrop-filter|(^|[\s;])filter:|transform|will-change|contain:/);
  });
  it('il menu aperto su telefono può scorrere se non entra nello schermo', () => {
    expect(css).toMatch(/\.menu \{ max-height: calc\(100svh[^}]*overflow-y: auto/);
  });
});
