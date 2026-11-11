import { describe, it, expect } from 'vitest';
import { homeUrl } from '../src/systems/home';

const at = (href: string) => { const u = new URL(href); return { href, pathname: u.pathname }; };

describe('Torna alla home', () => {
  it('dal gioco in /gioca/ va alla landing nella cartella sopra', () => {
    expect(homeUrl(at('https://nisiix.github.io/tradermon/gioca/'))).toBe('https://nisiix.github.io/tradermon/');
    expect(homeUrl(at('https://nisiix.github.io/tradermon/gioca/index.html?debug'))).toBe('https://nisiix.github.io/tradermon/');
  });
  it('in locale alla radice resta sulla radice', () => {
    expect(homeUrl(at('http://localhost:5173/'))).toBe('http://localhost:5173/');
  });
});
