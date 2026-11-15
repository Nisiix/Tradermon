// Registro dei flag (src/systems/flags.ts): ogni nome di flag scritto per esteso nel codice è registrato,
// e il registro non tiene nomi che il codice non usa più.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FLAGS, knownFlag } from '../src/systems/flags';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []; });
}
const SRC = files(join(__dirname, '../src')).filter((f) => !f.includes('/i18n/'));
const code = SRC.map((f) => readFileSync(f, 'utf8')).join('\n');

/** Nomi di flag scritti per esteso: S.flags.nome, S.flags['nome'], reward({ flag: 'nome' }). Le parti `${…}` diventano «x1». */
function literalFlags(): string[] {
  const out = new Set<string>();
  for (const m of code.matchAll(/\b[sS]\.flags\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) out.add(m[1]);
  for (const m of code.matchAll(/\bflags\[(['`])([^'`\]]+)\1\]/g)) out.add(m[2]);
  for (const m of code.matchAll(/\bflag: (['`])([^'`]+)\1/g)) out.add(m[2]);
  return [...out].map((n) => n.replace(/\$\{[^}]*\}/g, 'x1'));
}

describe('registro dei flag', () => {
  it('ogni flag scritto nel codice è nel registro', () => {
    // «x1» sta per la parte variabile: la forma deve combaciare con un modello del registro (numero o id)
    const probe = (n: string) => knownFlag(n.replace(/x1/g, '1')) || knownFlag(n.replace(/x1/g, 'a'));
    expect(literalFlags().filter((n) => !probe(n))).toEqual([]);
  });
  it('il registro non tiene nomi che il codice non usa', () => {
    const unused = Object.keys(FLAGS).filter((n) => !code.includes(n) || code.split(n).length - 1 <= 1);
    expect(unused).toEqual([]);
  });
});
