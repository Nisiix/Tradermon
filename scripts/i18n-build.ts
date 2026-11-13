// Compilazione dei dizionari inglesi (usata da vite.config.ts e dai test, solo in Node). Vedi src/i18n/index.ts.
// - englishDictionary(): tutto src/i18n/en/*.json, per il gioco.
// - landingDictionary(): solo i testi della landing e della pagina privacy: le frasi di T() nei moduli che
//   queste pagine importano (seguendo gli import relativi) e i testi delle loro pagine HTML.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import { hashKey } from '../src/i18n/hash';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const EN_DIR = join(ROOT, 'src/i18n/en');

/** Ingressi della landing e della privacy, con le loro pagine HTML. */
export const LANDING_ENTRIES = ['landing/main.ts', 'landing/privacy.ts'];
export const LANDING_PAGES = ['index.html', 'privacy/index.html'];

/** I file del dizionario come { testo italiano: English }, nell'ordine di sovrascrittura (extra.json per ultimo). */
export function dictionaryFiles(): [string, Record<string, string>][] {
  return readdirSync(EN_DIR).filter((n) => n.endsWith('.json'))
    .sort((a, b) => Number(a === 'extra.json') - Number(b === 'extra.json') || a.localeCompare(b))
    .map((f) => [f, JSON.parse(readFileSync(join(EN_DIR, f), 'utf8')) as Record<string, string>]);
}

function merged(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, part] of dictionaryFiles()) Object.assign(out, part);
  return out;
}

const compile = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([it, en]) => [hashKey(it), en]));

export function englishDictionary(): Record<string, string> { return compile(merged()); }

/** Chiavi delle chiamate T('…') e T`…` con un testo scritto direttamente. */
export function tKeys(file: string, code = readFileSync(file, 'utf8')): string[] {
  const keys: string[] = [];
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'T' && n.arguments.length === 1) {
      const a = n.arguments[0];
      if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) keys.push(a.text);
    }
    if (ts.isTaggedTemplateExpression(n) && ts.isIdentifier(n.tag) && n.tag.text === 'T') {
      const t = n.template;
      if (ts.isNoSubstitutionTemplateLiteral(t)) keys.push(t.text);
      else { let k = t.head.text; t.templateSpans.forEach((s, i) => { k += `{${i}}` + s.literal.text; }); keys.push(k); }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return keys;
}

/** Moduli TypeScript raggiunti dagli ingressi seguendo gli import relativi. */
export function moduleGraph(entries: string[]): string[] {
  const seen = new Set<string>();
  const todo = entries.map((e) => join(ROOT, e));
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f) || !existsSync(f)) continue;
    seen.add(f);
    const code = readFileSync(f, 'utf8');
    for (const m of code.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]/g)) {
      const spec = m[1] ?? m[2];
      if (/\.(css|json)$/.test(spec)) continue;
      const base = resolve(dirname(f), spec);
      for (const c of [base, base + '.ts', join(base, 'index.ts')]) if (/\.ts$/.test(c) && existsSync(c)) { todo.push(c); break; }
    }
  }
  return [...seen];
}

const norm = (s: string) => s.replace(/\s+/g, ' ');

/** Chiavi italiane che servono alla landing e alla privacy. */
export function landingKeys(all = merged()): Set<string> {
  const keys = new Set<string>();
  for (const f of moduleGraph(LANDING_ENTRIES)) for (const k of tKeys(f)) keys.add(k);
  // testi delle pagine HTML: landing.json nasce da lì; in più le frasi degli altri file che compaiono nelle pagine
  const html = LANDING_PAGES.map((p) => norm(readFileSync(join(ROOT, p), 'utf8'))).join('\n');
  const landing = JSON.parse(readFileSync(join(EN_DIR, 'landing.json'), 'utf8')) as Record<string, string>;
  for (const k of Object.keys(landing)) keys.add(k);
  for (const k of Object.keys(all)) if (k.length > 3 && html.includes(k)) keys.add(k);
  return keys;
}

export function landingDictionary(): Record<string, string> {
  const all = merged();
  const pick: Record<string, string> = {};
  for (const k of landingKeys(all)) if (k in all) pick[k] = all[k];
  return compile(pick);
}
