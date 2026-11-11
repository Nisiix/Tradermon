// Minigiochi didattici: brevi, con punteggio da 0 a 100 e nessun effetto sul conto.
// Ognuno allena un'abilità: leggere un grafico, stimare l'interesse composto, diversificare, confrontare bilanci.
import { S, save } from '../systems/state';
import { modal, choose, esc, el, toast, say } from './core';
import { track } from '../systems/progress';
import { ASSETS, SECTOR_LABEL } from '../data/assets';
import { mulberry32, shuffle } from '../systems/rng';

export const MINIGAMES = [
  { id: 'chart', name: 'Indovina il grafico', desc: 'Riconosci volatilità, trend e drawdown da un grafico.' },
  { id: 'compound', name: 'Corsa dell\'interesse composto', desc: 'Stima a occhio quanto cresce un capitale nel tempo.' },
  { id: 'basket', name: 'Carrello diversificato', desc: 'Componi il paniere con meno rischio concentrato.' },
  { id: 'balance', name: 'Bilancio in ordine', desc: 'Confronta aziende con P/E, debito e margini.' },
] as const;
type GameId = (typeof MINIGAMES)[number]['id'];

const ROUNDS = 5;

function finish(id: GameId, score: number) {
  const prev = S.minigames[id] ?? 0;
  S.minigames[id] = Math.max(prev, score);
  S.stats.xp += Math.round(score / 10) + 5;
  track('minigame');
  save();
  return say([`Punteggio: ${score}/100${score > prev ? (prev ? ' · nuovo record!' : '') : ` (record ${prev})`}.`, `+${Math.round(score / 10) + 5} Conoscenza.`], 'Minigioco');
}

/** Menu dei minigiochi, offerto dalla Bibliotecaria e dall'Operatrice. */
export async function playMinigame(who: string) {
  const c = await choose([...MINIGAMES.map((m) => `${m.name}${S.minigames[m.id] !== undefined ? ` (record ${S.minigames[m.id]})` : ''}`), 'Annulla'], { cancel: true, prompt: 'Quale minigioco? Sono brevi e non toccano il conto.', who });
  if (c < 0 || c >= MINIGAMES.length) return;
  const m = MINIGAMES[c];
  await say(m.desc, who);
  if (m.id === 'chart') return chartGame();
  if (m.id === 'compound') return compoundGame();
  if (m.id === 'basket') return basketGame();
  return balanceGame();
}

/** Una domanda a scelta multipla dentro una finestra, con spiegazione dopo la risposta. */
function quizRound(title: string, html: string, options: string[], right: number, explain: string): Promise<boolean> {
  return new Promise((resolve) => {
    void modal<boolean>(title, ({ body, foot, close }) => {
      body.innerHTML = html;
      const opts = el('div', 'row', '');
      opts.style.flexWrap = 'wrap';
      options.forEach((o, i) => {
        const b = el('button', 'btn' + (i === 0 ? ' primary' : ''), esc(o));
        b.addEventListener('click', () => {
          const ok = i === right;
          [...opts.querySelectorAll('button')].forEach((x, j) => { x.disabled = true; if (j === right) x.classList.add('primary'); });
          body.appendChild(el('p', ok ? 'good' : 'bad', `${ok ? 'Esatto!' : 'No.'} ${esc(explain)}`));
          const n = el('button', 'btn primary', 'Avanti');
          n.addEventListener('click', () => close(ok));
          foot.appendChild(n);
          setTimeout(() => n.focus(), 30);
        });
        opts.appendChild(b);
      });
      body.appendChild(opts);
      setTimeout(() => (opts.querySelector('button') as HTMLButtonElement)?.focus(), 30);
    }, { closable: false }).then((v) => resolve(!!v));
  });
}

function svgChart(series: number[], w = 320, h = 120): string {
  const min = Math.min(...series), max = Math.max(...series);
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 10) - 5}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;background:#f4f6ff;border:2px solid var(--line);border-radius:6px"><polyline fill="none" stroke="#3060c0" stroke-width="2" points="${pts}"/></svg>`;
}

function walk(rng: () => number, n: number, drift: number, vol: number, crashAt = -1, crash = 0): number[] {
  const out = [100];
  for (let i = 1; i < n; i++) {
    const g = (rng() + rng() + rng() - 1.5) * 2;
    let r = drift / 250 + vol / Math.sqrt(250) * g;
    if (i === crashAt) r = crash;
    out.push(out[i - 1] * (1 + r));
  }
  return out;
}

function stats(s: number[]) {
  const ret = s[s.length - 1] / s[0] - 1;
  let peak = s[0], mdd = 0;
  for (const v of s) { peak = Math.max(peak, v); mdd = Math.max(mdd, 1 - v / peak); }
  const rs = s.slice(1).map((v, i) => v / s[i] - 1);
  const m = rs.reduce((a, b) => a + b, 0) / rs.length;
  const vol = Math.sqrt(rs.reduce((a, b) => a + (b - m) ** 2, 0) / rs.length) * Math.sqrt(250);
  return { ret, mdd, vol };
}

async function chartGame() {
  const rng = mulberry32(Date.now() % 100000);
  let score = 0;
  const kinds = [
    { k: 'calmo', label: 'Rialzo tranquillo (volatilità bassa)', mk: () => walk(rng, 120, 0.15, 0.08) },
    { k: 'nervoso', label: 'Rialzo nervoso (volatilità alta)', mk: () => walk(rng, 120, 0.2, 0.45) },
    { k: 'crollo', label: 'Crollo improvviso e ripresa', mk: () => walk(rng, 120, 0.3, 0.15, 50, -0.3) },
    { k: 'orso', label: 'Ribasso prolungato', mk: () => walk(rng, 120, -0.35, 0.18) },
    { k: 'laterale', label: 'Laterale senza direzione', mk: () => walk(rng, 120, 0, 0.12) },
  ];
  for (let r = 0; r < ROUNDS; r++) {
    const order = shuffle(kinds.map((_, i) => i), rng).slice(0, 3);
    const rightIdx = order[Math.floor(rng() * 3)];
    const s = kinds[rightIdx].mk();
    const st = stats(s);
    const ok = await quizRound(`Indovina il grafico · ${r + 1}/${ROUNDS}`, `<p class="small">Quale descrizione corrisponde a questo andamento di 120 giorni?</p>${svgChart(s)}`,
      order.map((i) => kinds[i].label), order.indexOf(rightIdx),
      `Rendimento ${(st.ret * 100).toFixed(0)}%, volatilità annua ${(st.vol * 100).toFixed(0)}%, drawdown massimo ${(st.mdd * 100).toFixed(0)}%.`);
    if (ok) score += 20;
  }
  await finish('chart', score);
}

async function compoundGame() {
  const rng = mulberry32(Date.now() % 100000);
  let score = 0;
  for (let r = 0; r < ROUNDS; r++) {
    const cap = [1000, 2000, 5000, 10000][Math.floor(rng() * 4)];
    const rate = [3, 5, 7, 10][Math.floor(rng() * 4)];
    const years = [10, 20, 30][Math.floor(rng() * 3)];
    const fv = cap * (1 + rate / 100) ** years;
    const simple = cap * (1 + (rate / 100) * years);
    const low = fv * 0.55;
    const opts = shuffle([fv, simple, low], rng);
    const fmt = (v: number) => `${Math.round(v / 100) * 100} $`;
    const ok = await quizRound(`Interesse composto · ${r + 1}/${ROUNDS}`, `<p>${cap} $ al <b>${rate}%</b> annuo per <b>${years} anni</b>, reinvestendo tutto. Quanto diventano, circa?</p><p class="small muted">Suggerimento: regola del 72 → raddoppia ogni ${Math.round(72 / rate)} anni.</p>`,
      opts.map(fmt), opts.indexOf(fv), `${fmt(fv)}. Con l'interesse semplice (senza reinvestire) sarebbero solo ${fmt(simple)}.`);
    if (ok) score += 20;
  }
  await finish('compound', score);
}

async function basketGame() {
  const rng = mulberry32(Date.now() % 100000);
  const pool = shuffle(ASSETS.filter((a) => a.sector !== 'stable'), rng).slice(0, 8);
  const chosen = new Set<string>();
  const result = await modal<number>('Carrello diversificato', ({ body, button, close }) => {
    const render = () => {
      body.innerHTML = `<p class="small">Scegli <b>4</b> asset su 8 per il paniere meno concentrato: settori diversi, classi diverse, rischio medio contenuto. Selezionati: <b>${chosen.size}/4</b></p>`;
      const grid = el('div', 'cards');
      for (const a of pool) {
        const b = el('button', 'card' + (chosen.has(a.id) ? ' gold' : ''), `<b>${esc(a.ticker)}</b> ${esc(a.name)}<br><span class="small">${SECTOR_LABEL[a.sector]} · ${a.cls} · rischio ${'★'.repeat(a.risk)}</span>`);
        b.style.textAlign = 'left'; b.style.cursor = 'pointer'; b.style.font = 'inherit';
        b.addEventListener('click', () => { if (chosen.has(a.id)) chosen.delete(a.id); else if (chosen.size < 4) chosen.add(a.id); render(); });
        grid.appendChild(b);
      }
      body.appendChild(grid);
    };
    render();
    button('Valuta il paniere', () => {
      if (chosen.size < 4) { toast('Scegli 4 asset.'); return; }
      const sel = pool.filter((a) => chosen.has(a.id));
      const sectors = new Set(sel.map((a) => a.sector)).size, classes = new Set(sel.map((a) => a.cls)).size;
      const risk = sel.reduce((s, a) => s + a.risk, 0) / sel.length;
      const bestSectors = Math.min(4, new Set(pool.map((a) => a.sector)).size), bestClasses = Math.min(3, new Set(pool.map((a) => a.cls)).size);
      let sc = Math.round((sectors / bestSectors) * 50 + (classes / bestClasses) * 30 + (risk <= 3 ? 20 : risk <= 3.5 ? 10 : 0));
      sc = Math.max(0, Math.min(100, sc));
      body.appendChild(el('p', sc >= 70 ? 'good' : 'bad', `Settori diversi: ${sectors}/${bestSectors} · classi: ${classes}/${bestClasses} · rischio medio ${risk.toFixed(1)}. Punteggio ${sc}.`));
      setTimeout(() => close(sc), 900);
    }, 'primary');
  }, { wide: true, closable: false });
  await finish('basket', result ?? 0);
}

async function balanceGame() {
  const rng = mulberry32(Date.now() % 100000);
  let score = 0;
  const names = ['Alfa', 'Beta', 'Gamma'];
  for (let r = 0; r < ROUNDS; r++) {
    const cos = names.map((n) => ({ n, price: 20 + Math.round(rng() * 180), eps: 1 + Math.round(rng() * 90) / 10, de: Math.round(rng() * 25) / 10, margin: 2 + Math.round(rng() * 30) }));
    const q = Math.floor(rng() * 3);
    const pe = (c: typeof cos[0]) => c.price / c.eps;
    const qs = [
      { text: 'Quale azienda ha il <b>P/E più basso</b> (paghi meno per ogni unità di utile)?', right: cos.indexOf([...cos].sort((a, b) => pe(a) - pe(b))[0]), why: 'P/E = prezzo ÷ utile per azione. Basso non vuol dire "a buon mercato" di sicuro: va confrontato con il settore.' },
      { text: 'Quale azienda ha <b>meno debito</b> rispetto al patrimonio (D/E più basso)?', right: cos.indexOf([...cos].sort((a, b) => a.de - b.de)[0]), why: 'D/E = debiti ÷ patrimonio netto. Più è alto, più l\'azienda è fragile quando i tassi salgono.' },
      { text: 'Quale azienda trattiene <b>più utile per ogni 100 di ricavi</b> (margine netto più alto)?', right: cos.indexOf([...cos].sort((a, b) => b.margin - a.margin)[0]), why: 'Il margine netto dice quanto resta dopo tutti i costi. Alto e stabile è segno di un vantaggio competitivo.' },
    ][q];
    const table = `<table class="t"><tr><th>Azienda</th><th class="n">Prezzo</th><th class="n">Utile/azione</th><th class="n">P/E</th><th class="n">D/E</th><th class="n">Margine</th></tr>${cos.map((c) => `<tr><td><b>${c.n}</b></td><td class="n">${c.price}</td><td class="n">${c.eps.toFixed(1)}</td><td class="n">${pe(c).toFixed(1)}</td><td class="n">${c.de.toFixed(1)}</td><td class="n">${c.margin}%</td></tr>`).join('')}</table>`;
    const ok = await quizRound(`Bilancio in ordine · ${r + 1}/${ROUNDS}`, `<p>${qs.text}</p>${table}`, names, qs.right, qs.why);
    if (ok) score += 20;
  }
  await finish('balance', score);
}
