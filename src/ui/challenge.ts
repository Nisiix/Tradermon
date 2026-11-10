// Sfida della settimana: stesso quiz per tutti (seme dalla settimana ISO), classifica locale e codice da condividere.
// Nessun server: il codice contiene settimana, punteggio e un controllo, e un amico lo inserisce per comparire in classifica.
import { S, save } from '../systems/state';
import { modal, choose, esc, say, ask, toast } from './core';
import { track, weekKey } from '../systems/progress';
import { runDuel } from './battle';
import { pickQuestions } from '../systems/quiz';
import { mulberry32 } from '../systems/rng';
import { trackTopics } from '../data/quiz/build';

const N = 8;

function seedOf(week: string): number { let h = 7; for (const ch of week) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
function checksum(week: string, score: number, name: string): string {
  let h = seedOf(week) ^ (score * 2654435761 >>> 0);
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return (h % 46656).toString(36).toUpperCase().padStart(3, '0');
}
export function makeCode(week: string, score: number, name: string): string {
  const nm = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || 'ANON';
  return `TS-${week.replace('-W', 'W')}-${nm}-${score}-${checksum(week, score, nm)}`;
}
export function parseCode(code: string): { week: string; name: string; score: number } | null {
  const m = /^TS-(\d{4})W(\d{2})-([A-Z0-9]{1,8})-(\d{1,3})-([A-Z0-9]{3})$/.exec(code.trim().toUpperCase());
  if (!m) return null;
  const week = `${m[1]}-W${m[2]}`, name = m[3], score = Number(m[4]);
  if (score > 100 || checksum(week, score, name) !== m[5]) return null;
  return { week, name, score };
}

function board(week: string) {
  return S.challenges.filter((c) => c.code.includes(week.replace('-W', 'W'))).sort((a, b) => b.score - a.score);
}

export async function weeklyChallenge() {
  const week = weekKey();
  const mine = S.challenges.find((c) => c.label === S.name && c.code.includes(week.replace('-W', 'W')));
  for (;;) {
    const opts = [mine ? `Classifica della settimana (${board(week).length})` : 'Gioca la sfida di questa settimana', 'Inserisci il codice di un amico', mine ? 'Mostra il mio codice' : '', 'Esci'].filter(Boolean);
    const c = await choose(opts, { cancel: true, prompt: `Sfida ${week}: ${N} domande uguali per tutti, un solo tentativo. Il risultato dà un codice da scambiare con gli amici.`, who: 'Operatrice' });
    if (c < 0 || opts[c] === 'Esci') return;
    if (opts[c].startsWith('Gioca')) { await play(week); return weeklyChallenge(); }
    if (opts[c].startsWith('Classifica')) await showBoard(week);
    if (opts[c].startsWith('Inserisci')) await enterCode(week);
    if (opts[c].startsWith('Mostra') && mine) await showCode(mine.code);
  }
}

async function play(week: string) {
  const rng = mulberry32(seedOf(week));
  const topics = trackTopics(S.track, S.mixedClasses, 8).concat(['macro', 'regole', 'bias']);
  const qs = pickQuestions(topics, N, { rng, minDiff: 1, maxDiff: 3 });
  const prevFid = S.stats.fiducia;
  const t0 = Date.now();
  const r = await runDuel({ foeName: `Sfida ${week}`, foeTitle: 'Tutti gli sfidanti', foePal: 11, questions: qs, need: N, damage: 0 });
  S.stats.fiducia = prevFid;
  const secs = (Date.now() - t0) / 1000;
  const score = Math.min(100, Math.round((r.correct / N) * 80 + (r.correct === N ? 20 : Math.max(0, 20 - secs / 15))));
  const code = makeCode(week, score, S.name);
  S.challenges.push({ code, score, date: new Date().toISOString().slice(0, 10), label: S.name });
  S.stats.xp += 20 + Math.round(score / 5);
  track('challenge');
  save();
  await say([`Risposte esatte: ${r.correct}/${N} in ${Math.round(secs)} secondi. Punteggio: ${score}.`, 'Ecco il tuo codice: condividilo con gli amici, loro lo inseriscono qui per confrontarsi con te.'], 'Operatrice');
  await showCode(code);
}

function showCode(code: string) {
  return modal('Il tuo codice della settimana', ({ body, button, close }) => {
    body.innerHTML = `<p style="text-align:center"><b style="font-size:1.3em;letter-spacing:1px">${esc(code)}</b></p><p class="small muted">Chi lo inserisce vede il tuo nome e il tuo punteggio nella sua classifica. Il codice non contiene dati del conto.</p>`;
    button('Copia', () => { void navigator.clipboard?.writeText(code).then(() => toast('Codice copiato.')); });
    button('Chiudi', () => close(), 'primary');
  });
}

async function enterCode(week: string) {
  const code = await ask('Codice dell\'amico', '', 32);
  if (!code) return;
  const p = parseCode(code);
  if (!p) return say('Codice non valido.', 'Operatrice');
  if (S.challenges.some((c) => c.code.toUpperCase() === code.trim().toUpperCase())) return say('Questo codice è già in classifica.', 'Operatrice');
  S.challenges.push({ code: code.trim().toUpperCase(), score: p.score, date: new Date().toISOString().slice(0, 10), label: p.name });
  save();
  await say(`${p.name} entra in classifica con ${p.score} punti${p.week === week ? '' : ` (settimana ${p.week})`}.`, 'Operatrice');
}

function showBoard(week: string) {
  const rows = board(week);
  return modal('Classifica della settimana', ({ body, button, close }) => {
    body.innerHTML = rows.length ? `<table class="t"><tr><th>#</th><th>Nome</th><th class="n">Punti</th><th>Data</th></tr>${rows.map((r, i) => `<tr${r.label === S.name ? ' style="font-weight:bold"' : ''}><td>${i + 1}</td><td>${esc(r.label)}</td><td class="n">${r.score}</td><td>${esc(r.date)}</td></tr>`).join('')}</table>` : '<p class="muted">Nessun risultato per questa settimana.</p>';
    button('Chiudi', () => close(), 'primary');
  });
}
