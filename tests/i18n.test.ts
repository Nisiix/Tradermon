// Inglese: ogni testo passato a T() ha la sua traduzione, con gli stessi segnaposto,
// e le domande tradotte rispettano le stesse regole di forma di quelle italiane.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { hashKey } from '../src/i18n/hash';
import { QUESTIONS } from '../src/data/quiz/build';
import { FILES } from '../src/i18n/en-node';

const ROOT = join(__dirname, '..');
const EN: Record<string, string> = {};
for (const part of Object.values(FILES)) Object.assign(EN, part);

function walk(d: string, out: string[] = []) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== 'i18n') walk(p, out); } else if (/\.ts$/.test(f) && !/\.d\.ts$/.test(f)) out.push(p);
  }
  return out;
}

/** Chiavi di tutte le chiamate T('…') e T`…` con un testo scritto direttamente. */
function keysInCode() {
  const keys = new Map<string, string>();
  for (const f of [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'landing'))]) {
    const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (n: ts.Node) => {
      let k: string | null = null;
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'T' && n.arguments.length === 1) {
        const a = n.arguments[0];
        if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) k = a.text;
      }
      if (ts.isTaggedTemplateExpression(n) && ts.isIdentifier(n.tag) && n.tag.text === 'T') {
        const t = n.template;
        if (ts.isNoSubstitutionTemplateLiteral(t)) k = t.text;
        else { k = t.head.text; t.templateSpans.forEach((s, i) => { k += `{${i}}` + s.literal.text; }); }
      }
      if (k !== null && !keys.has(k)) keys.set(k, `${f.slice(ROOT.length + 1)}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return keys;
}

const holes = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join();

describe('inglese', () => {
  const keys = keysInCode();

  it('en-node.ts elenca tutti i file del dizionario', () => {
    const onDisk = readdirSync(join(ROOT, 'src/i18n/en')).filter((f) => f.endsWith('.json') && f !== '_empty.json').map((f) => f.replace('.json', '')).sort();
    expect(Object.keys(FILES).sort()).toEqual(onDisk);
  });

  it('ogni testo del codice ha la traduzione inglese', () => {
    const missing = [...keys].filter(([k]) => !(k in EN)).map(([k, at]) => `${at}  ${k.slice(0, 80)}`);
    expect(missing).toEqual([]);
  });

  it('le traduzioni usano gli stessi segnaposto (o meno, quando l\'inglese non ne ha bisogno)', () => {
    const bad = Object.entries(EN).filter(([k, v]) => {
      const a = new Set(k.match(/\{\d+\}/g) ?? []);
      return (v.match(/\{\d+\}/g) ?? []).some((h) => !a.has(h));
    }).map(([k]) => k.slice(0, 80));
    expect(bad).toEqual([]);
    // i segnaposto tolti apposta in inglese (plurali e articoli italiani)
    const dropped = Object.entries(EN).filter(([k, v]) => holes(k) !== holes(v)).length;
    expect(dropped).toBeLessThanOrEqual(3);
  });

  it('nessuna collisione nel dizionario compilato', () => {
    const seen = new Map<string, string>();
    for (const k of Object.keys(EN)) {
      const h = hashKey(k);
      expect(seen.get(h) ?? k, `collisione: ${k}`).toBe(k);
      seen.set(h, k);
    }
  });

  it('niente marcatori di genere nelle traduzioni (l\'inglese non ne ha bisogno)', () => {
    const bad = Object.values(EN).filter((v) => /\{[^{}|]*\|[^{}|]*\}/.test(v));
    expect(bad).toEqual([]);
  });

  it('le domande in inglese: risposte brevi e la giusta non è quasi mai la più lunga', () => {
    const en = QUESTIONS.map((q) => ({ topic: q.topic, options: q.options.map((o) => EN[o] ?? o), prompt: EN[q.prompt] ?? q.prompt }));
    for (const q of en) for (const o of q.options) expect(o.length, o).toBeLessThanOrEqual(130);
    const longest = en.filter((q) => { const l = q.options.map((o) => o.length); return l[0] > Math.max(l[1], l[2], l[3]); }).length;
    expect(longest / en.length).toBeLessThanOrEqual(0.33);
  });
});

describe('dizionario della landing', () => {
  it('contiene ogni testo che la landing e la privacy passano a T(), e niente dei moduli del solo gioco', async () => {
    const b = await import('../scripts/i18n-build');
    const small = b.landingDictionary();
    const files = b.moduleGraph(b.LANDING_ENTRIES);
    expect(files.some((f) => f.endsWith('src/i18n/landing.ts'))).toBe(true);
    const missing = files.flatMap((f) => b.tKeys(f)).filter((k) => k in EN && !(hashKey(k) in small));
    expect(missing).toEqual([]);
    // deve restare piccolo: è il motivo per cui esiste
    expect(Object.keys(small).length).toBeLessThan(Object.keys(EN).length / 5);
  });
});
