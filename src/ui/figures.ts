// Figure dei libri: piccoli disegni vettoriali sotto una pagina, per vedere un concetto invece di leggerlo soltanto.
// Sono disegnati in codice (nessuna immagine esterna), con i colori del tema (variabili CSS) e testi tradotti.
// Nessuna figura chiede di fare calcoli: mostrano la forma di un'idea (asimmetria delle perdite, curva composta…).
import { T, LOCALE } from '../i18n';

const px = (v: number) => v.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface Figure { svg: string; caption: string }

const W = 320, H = 150;
const wrap = (inner: string, label: string) =>
  `<svg class="fig-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label.replace(/"/g, '&quot;')}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const txt = (x: number, y: number, s: string, opts: { anchor?: 'start' | 'middle' | 'end'; cls?: string; size?: number } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${opts.anchor ?? 'middle'}" class="${opts.cls ?? 'fig-t'}"${opts.size ? ` font-size="${opts.size}"` : ''}>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const line = (pts: [number, number][], cls = 'fig-l') => `<polyline class="${cls}" points="${pts.map((p) => p.join(',')).join(' ')}"/>`;
const axis = (x0 = 30, y0 = 125, x1 = 305, y1 = 15) => `<line class="fig-ax" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}"/><line class="fig-ax" x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}"/>`;
const arrowDef = `<defs><marker id="fa" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="fig-ah"/></marker></defs>`;
const arrow = (x1: number, y1: number, x2: number, y2: number, cls = 'fig-l') => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#fa)"/>`;

function candle(): Figure {
  const c = (x: number, o: number, cl: number, hi: number, lo: number, up: boolean) =>
    `<line class="fig-l" x1="${x}" y1="${hi}" x2="${x}" y2="${lo}"/><rect class="${up ? 'fig-up' : 'fig-down'}" x="${x - 14}" y="${Math.min(o, cl)}" width="28" height="${Math.abs(o - cl)}"/>`;
  const inner = arrowDef + c(90, 100, 50, 25, 125, true) + c(230, 50, 100, 25, 125, false)
    + txt(150, 28, T('massimo'), { anchor: 'start' }) + txt(150, 124, T('minimo'), { anchor: 'start' })
    + txt(40, 53, T('chiusura'), { anchor: 'end', size: 10 }) + txt(40, 103, T('apertura'), { anchor: 'end', size: 10 })
    + txt(280, 53, T('apertura'), { anchor: 'start', size: 10 }) + txt(280, 103, T('chiusura'), { anchor: 'start', size: 10 })
    + txt(90, 145, T('candela in rialzo')) + txt(230, 145, T('candela in ribasso'))
    + `<line class="fig-dash" x1="45" y1="50" x2="74" y2="50"/><line class="fig-dash" x1="45" y1="100" x2="74" y2="100"/><line class="fig-dash" x1="246" y1="50" x2="276" y2="50"/><line class="fig-dash" x1="246" y1="100" x2="276" y2="100"/>`;
  return { svg: wrap(inner, T('Due candele giapponesi')), caption: T('Il corpo va dall\'apertura alla chiusura, le ombre arrivano al massimo e al minimo del periodo.') };
}

function drawdown(): Figure {
  const pts: [number, number][] = [[30, 110], [70, 80], [110, 40], [150, 70], [190, 105], [230, 80], [270, 55], [305, 35]];
  const inner = arrowDef + axis() + line(pts) + `<circle class="fig-dot" cx="110" cy="40" r="4"/><circle class="fig-dot bad" cx="190" cy="105" r="4"/>`
    + arrow(120, 42, 184, 100, 'fig-bad') + txt(160, 62, T('drawdown'), { anchor: 'start', cls: 'fig-t bad' })
    + txt(110, 30, T('massimo')) + txt(190, 121, T('minimo successivo')) + txt(270, 48, T('recupero'), { anchor: 'end' });
  return { svg: wrap(inner, T('Massimo drawdown')), caption: T('Il massimo drawdown è la caduta più profonda da un massimo al minimo che lo segue.') };
}

function asimmetria(): Figure {
  const bar = (x: number, h: number, cls: string, label: string) => `<rect class="${cls}" x="${x}" y="${h >= 0 ? 75 - h : 75}" width="34" height="${Math.abs(h)}"/>` + txt(x + 17, h >= 0 ? 70 - h : 89 - h, label, { size: 11 });
  const inner = `<line class="fig-ax" x1="20" y1="75" x2="305" y2="75"/>`
    + bar(40, -12, 'fig-down', '−10%') + bar(80, 13, 'fig-up', '+11%')
    + bar(140, -24, 'fig-down', '−20%') + bar(180, 30, 'fig-up', '+25%')
    + bar(230, -30, 'fig-down', '−50%') + bar(270, 60, 'fig-up', '+100%')
    + txt(78, 140, T('perdita'), { size: 10, cls: 'fig-t bad' }) + txt(160, 140, T('poi serve per tornare pari'), { size: 10 });
  return { svg: wrap(inner, T('Perdite e risalita necessaria')), caption: T('Più la caduta è profonda, più la risalita necessaria per tornare al punto di partenza è grande.') };
}

function diversificazione(): Figure {
  const pts: [number, number][] = [];
  for (let n = 1; n <= 30; n++) pts.push([30 + (n - 1) * 9.4, 125 - 100 * Math.sqrt(0.3 + 0.7 / n)]);
  const floor = 125 - 100 * Math.sqrt(0.3);
  const inner = axis() + `<line class="fig-dash" x1="30" y1="${floor}" x2="305" y2="${floor}"/>` + line(pts)
    + txt(300, floor - 6, T('rischio di mercato: resta'), { anchor: 'end', size: 10 })
    + txt(70, 30, T('rischio specifico: cala'), { anchor: 'start', size: 10 })
    + txt(168, 143, T('numero di titoli diversi')) + txt(14, 70, T('rischio'), { size: 10 });
  return { svg: wrap(inner, T('Diversificazione e rischio')), caption: T('Aggiungere titoli poco legati tra loro riduce il rischio specifico; quello di mercato resta.') };
}

function composto(): Figure {
  const simp: [number, number][] = [], comp: [number, number][] = [], cost: [number, number][] = [];
  for (let y = 0; y <= 30; y++) {
    const x = 30 + y * 9.1;
    simp.push([x, 120 - (1 + 0.06 * y - 1) * 30]);
    comp.push([x, 120 - (Math.pow(1.06, y) - 1) * 23]);
    cost.push([x, 120 - (Math.pow(1.04, y) - 1) * 23]);
  }
  const inner = axis(30, 120) + line(simp, 'fig-dash') + line(comp) + line(cost, 'fig-bad')
    + txt(300, 22, T('interessi composti'), { anchor: 'end', size: 10 }) + txt(300, 80, T('con costi più alti'), { anchor: 'end', size: 10, cls: 'fig-t bad' })
    + txt(300, 112, T('interessi semplici'), { anchor: 'end', size: 10 }) + txt(168, 140, T('anni'));
  return { svg: wrap(inner, T('Interesse composto')), caption: T('Gli interessi che producono altri interessi fanno curvare la crescita verso l\'alto; i costi annui la abbassano ogni anno.') };
}

function spread(): Figure {
  const row = (y: number, w: number, cls: string, label: string, side: 'l' | 'r') => side === 'l'
    ? `<rect class="${cls}" x="${150 - w}" y="${y}" width="${w}" height="14"/>` + txt(145 - w, y + 11, label, { anchor: 'end', size: 10 })
    : `<rect class="${cls}" x="170" y="${y}" width="${w}" height="14"/>` + txt(175 + w, y + 11, label, { anchor: 'start', size: 10 });
  const inner = row(30, 60, 'fig-up', px(99.98), 'l') + row(50, 90, 'fig-up', px(99.97), 'l') + row(70, 40, 'fig-up', px(99.95), 'l')
    + row(30, 50, 'fig-down', px(100.02), 'r') + row(50, 80, 'fig-down', px(100.03), 'r') + row(70, 70, 'fig-down', px(100.05), 'r')
    + txt(100, 18, T('denaro (chi compra)'), { size: 10 }) + txt(230, 18, T('lettera (chi vende)'), { size: 10 })
    + `<line class="fig-bad" x1="150" y1="110" x2="170" y2="110"/>` + txt(160, 128, T('spread'), { cls: 'fig-t bad' });
  return { svg: wrap(inner, T('Libro degli ordini e spread')), caption: T('Il prezzo migliore di chi compra (denaro) e quello di chi vende (lettera) non coincidono: la distanza è lo spread.') };
}

function ordini(): Figure {
  const pts: [number, number][] = [[30, 70], [70, 60], [110, 75], [150, 65], [190, 80], [230, 72]];
  const inner = axis() + line(pts) + `<circle class="fig-dot" cx="230" cy="72" r="4"/>` + txt(238, 76, T('prezzo di adesso'), { anchor: 'start', size: 10 })
    + `<line class="fig-dash" x1="30" y1="95" x2="305" y2="95"/>` + txt(304, 91, T('limite di acquisto: compra qui o meno'), { anchor: 'end', size: 10 })
    + `<line class="fig-bad" x1="30" y1="115" x2="305" y2="115"/>` + txt(304, 111, T('stop di vendita: sotto qui vende'), { anchor: 'end', size: 10, cls: 'fig-t bad' })
    + `<line class="fig-dash" x1="30" y1="40" x2="305" y2="40"/>` + txt(304, 36, T('limite di vendita: vende qui o più'), { anchor: 'end', size: 10 });
  return { svg: wrap(inner, T('Ordini limite e stop')), caption: T('Un ordine a mercato si esegue subito al prezzo disponibile; limite e stop aspettano che il prezzo arrivi a una soglia.') };
}

function paniere(): Figure {
  let dots = '';
  for (let i = 0; i < 24; i++) dots += `<rect class="${i % 3 ? 'fig-up' : 'fig-down'}" x="${30 + (i % 6) * 18}" y="${30 + Math.floor(i / 6) * 22}" width="12" height="14"/>`;
  const inner = arrowDef + dots + arrow(150, 70, 205, 70) + `<rect class="fig-box" x="215" y="45" width="80" height="50"/>` + txt(255, 75, T('una quota'))
    + txt(80, 135, T('tanti titoli dell\'indice')) + txt(255, 115, T('un solo acquisto'));
  return { svg: wrap(inner, T('Un ETF come paniere')), caption: T('Con una quota di ETF compri un pezzetto di tutti i titoli del paniere che replica.') };
}

function tassi(): Figure {
  const inner = arrowDef + `<polygon class="fig-box" points="150,120 170,120 160,100"/>`
    + `<line class="fig-l" x1="60" y1="70" x2="260" y2="130" stroke-width="4"/>`
    + arrow(60, 60, 60, 25, 'fig-bad') + txt(60, 18, T('tassi di mercato su'), { cls: 'fig-t bad', size: 11 })
    + arrow(260, 120, 260, 145, 'fig-l') + txt(250, 100, T('prezzo delle obbligazioni giù'), { anchor: 'end', size: 11 });
  return { svg: wrap(inner, T('Tassi e prezzi delle obbligazioni')), caption: T('Tassi e prezzi delle obbligazioni già emesse vanno in direzioni opposte: più lunga la durata, più forte l\'effetto.') };
}

function curva(): Figure {
  const norm: [number, number][] = [], inv: [number, number][] = [];
  for (let i = 0; i <= 10; i++) { const x = 40 + i * 26; norm.push([x, 110 - 60 * Math.sqrt(i / 10)]); inv.push([x, 50 + 40 * Math.sqrt(i / 10)]); }
  const inner = axis(40, 125) + line(norm) + line(inv, 'fig-bad')
    + txt(300, 44, T('normale'), { anchor: 'end', size: 10 }) + txt(300, 84, T('invertita'), { anchor: 'end', size: 10, cls: 'fig-t bad' })
    + txt(172, 143, T('scadenza: da breve a lunga')) + txt(18, 70, T('rendimento'), { size: 10 });
  return { svg: wrap(inner, T('Curva dei rendimenti')), caption: T('Di solito chi presta più a lungo chiede un rendimento più alto; quando la curva si inverte è un segnale da osservare.') };
}

function chiavi(): Figure {
  const box = (x: number, label: string, cls = 'fig-box') => `<rect class="${cls}" x="${x}" y="50" width="80" height="40"/>` + txt(x + 40, 74, label, { size: 10 });
  const inner = arrowDef + box(15, T('seed phrase'), 'fig-down') + arrow(97, 70, 118, 70) + box(120, T('chiave privata'), 'fig-down') + arrow(202, 70, 223, 70) + box(225, T('indirizzo'), 'fig-up')
    + txt(95, 30, T('segreti: mai a nessuno'), { cls: 'fig-t bad', size: 10 }) + txt(265, 30, T('pubblico'), { size: 10 })
    + txt(160, 120, T('si va solo in avanti: dall\'indirizzo non si risale alla chiave'), { size: 10 });
  return { svg: wrap(inner, T('Seed phrase, chiave e indirizzo')), caption: T('Chi ha la seed phrase o la chiave privata controlla i fondi; l\'indirizzo si può dare a chiunque.') };
}

function allocazione(): Figure {
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, cls: string) => {
    const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `<path class="${cls}" d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} z"/>`;
  };
  const pie = (cx: number, a: number, b: number) => arc(cx, 70, 45, -Math.PI / 2, -Math.PI / 2 + a * 2 * Math.PI, 'fig-up')
    + arc(cx, 70, 45, -Math.PI / 2 + a * 2 * Math.PI, -Math.PI / 2 + (a + b) * 2 * Math.PI, 'fig-box')
    + arc(cx, 70, 45, -Math.PI / 2 + (a + b) * 2 * Math.PI, 1.5 * Math.PI, 'fig-down');
  const inner = arrowDef + pie(80, 0.6, 0.3) + arrow(140, 70, 180, 70) + pie(240, 0.75, 0.2)
    + txt(80, 135, T('il piano')) + txt(240, 135, T('dopo un anno di rialzi'))
    + `<rect class="fig-up" x="10" y="8" width="10" height="10"/>` + txt(24, 17, T('azioni'), { anchor: 'start', size: 10 })
    + `<rect class="fig-box" x="80" y="8" width="10" height="10"/>` + txt(94, 17, T('obbligazioni'), { anchor: 'start', size: 10 })
    + `<rect class="fig-down" x="185" y="8" width="10" height="10"/>` + txt(199, 17, T('liquidità'), { anchor: 'start', size: 10 });
  return { svg: wrap(inner, T('Allocazione e deriva')), caption: T('Senza ribilanciare, la parte che sale di più si allarga da sola e il portafoglio si allontana dal piano.') };
}

function correlazione(): Figure {
  const a: [number, number][] = [], b: [number, number][] = [], c: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const x = 30 + i * 22, s = Math.sin(i / 1.6); a.push([x, 70 - 30 * s]); b.push([x, 78 - 26 * s]); c.push([x, 70 + 28 * s]); }
  const inner = axis() + line(a) + line(b, 'fig-dash') + line(c, 'fig-bad')
    + txt(300, 20, T('si muovono insieme'), { anchor: 'end', size: 10 }) + txt(300, 140, T('si muovono in modo opposto'), { anchor: 'end', size: 10, cls: 'fig-t bad' });
  return { svg: wrap(inner, T('Correlazione')), caption: T('Due titoli molto correlati salgono e scendono insieme: tenerli entrambi diversifica poco.') };
}

function rischioRendimento(): Figure {
  const inner = axis() + `<line class="fig-dash" x1="30" y1="80" x2="305" y2="80"/>` + txt(304, 76, T('ingresso'), { anchor: 'end', size: 10 })
    + `<rect class="fig-down" x="140" y="80" width="40" height="25"/>` + txt(186, 98, T('rischio: fino allo stop'), { anchor: 'start', size: 10, cls: 'fig-t bad' })
    + `<rect class="fig-up" x="140" y="30" width="40" height="50"/>` + txt(186, 52, T('obiettivo: dove prendi il guadagno'), { anchor: 'start', size: 10 });
  return { svg: wrap(inner, T('Rischio e rendimento di un\'operazione')), caption: T('Prima di entrare si decide dove uscire se si sbaglia (stop) e dove se si ha ragione (obiettivo).') };
}

function opzione(): Figure {
  const inner = axis(30, 110) + line([[30, 110], [170, 110], [300, 30]]) + `<line class="fig-dash" x1="170" y1="20" x2="170" y2="125"/>`
    + txt(170, 140, T('prezzo di esercizio (strike)')) + txt(296, 26, T('guadagno se il prezzo sale molto'), { anchor: 'end', size: 10 })
    + txt(100, 104, T('al massimo perdi il premio pagato'), { size: 10, cls: 'fig-t bad' });
  return { svg: wrap(inner, T('Opzione call a scadenza')), caption: T('Chi compra una call paga un premio: se a scadenza il prezzo è sotto lo strike perde il premio, sopra partecipa al rialzo.') };
}

function budget(): Figure {
  const seg = (x: number, w: number, cls: string, label: string) => `<rect class="${cls}" x="${x}" y="55" width="${w}" height="30"/>` + txt(x + w / 2, 105, label, { size: 10 });
  const inner = txt(160, 35, T('entrate del mese')) + seg(20, 140, 'fig-box', T('spese fisse')) + seg(160, 70, 'fig-down', T('spese variabili')) + seg(230, 40, 'fig-up', T('risparmio')) + seg(270, 30, 'fig-up', T('emergenze'))
    + txt(160, 135, T('prima si mette da parte, poi si spende il resto'), { size: 10 });
  return { svg: wrap(inner, T('Il budget')), caption: T('Un budget divide le entrate tra spese, risparmio e fondo per gli imprevisti, decidendo prima e non a fine mese.') };
}

export const FIGURES: Record<string, () => Figure> = {
  candela: candle, drawdown, asimmetria, diversificazione, composto, spread, ordini, paniere, tassi, curva, chiavi, allocazione, correlazione,
  rr: rischioRendimento, opzione, budget,
};

export function figure(id: string): Figure | null {
  const f = FIGURES[id];
  return f ? f() : null;
}
