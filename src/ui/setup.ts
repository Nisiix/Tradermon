import { S, profileFromScore, save } from '../systems/state';
import { say, choose, ask, modal, el, esc } from './core';
import { pickQuestions } from '../systems/quiz';
import { runDuel } from './battle';
import { PAL, titleBackdrop, portrait } from '../art/art';
import { getStage } from './core';
import { newPortfolio } from '../systems/portfolio';

export async function disclaimer(): Promise<void> {
  await modal('Prima di iniziare', ({ body, button, close }) => {
    body.innerHTML = `
      <p><b>Tradermon è un gioco educativo.</b> Non fornisce consulenza finanziaria né raccomandazioni personalizzate.</p>
      <p>Il mondo, i personaggi e gli asset della Borsa di Capitalia sono di fantasia. I quiz citano fonti pubbliche di educazione finanziaria (SEC Investor.gov, Investopedia, Consob, Banca d'Italia, CFA Institute, ESMA).</p>
      <p>Tutto il gioco si completa con denaro finto. Il collegamento opzionale a un conto reale Alpaca si sblocca solo più avanti, dopo un esame, con limiti prudenti e solo per maggiorenni. Investire comporta il rischio di perdere il capitale.</p>
      <label><input type="checkbox" class="ck"> <span>Ho capito: è un gioco educativo, non consulenza.</span></label>`;
    const b = button('Inizia', () => close(), 'primary');
    b.disabled = true;
    (body.querySelector('.ck') as HTMLInputElement).addEventListener('change', (e) => { b.disabled = !(e.target as HTMLInputElement).checked; });
  }, { serious: true, closable: false });
}

const QUESTIONS: [string, string[]][] = [
  ['Il tuo portafoglio perde il 20% in un mese. Cosa fai?', ['Vendo tutto', 'Aspetto e ripasso il piano', 'Compro ancora']],
  ['Cosa preferisci?', ['+3% quasi certo', '+7% con oscillazioni', '+15% oppure −15%']],
  ['Per quanto tempo non ti servono questi soldi?', ['Meno di 3 anni', 'Da 3 a 10 anni', 'Più di 10 anni']],
  ['Quanta esperienza hai con gli investimenti?', ['Nessuna', 'Ho letto qualcosa', 'Ho già investito']],
  ['Una perdita del 30% per te sarebbe...', ['Inaccettabile', 'Dura ma gestibile', 'Parte del gioco']],
];

export async function questionnaire(): Promise<number> {
  await say(['Rispondi con sincerità: non ci sono risposte giuste o sbagliate.', 'Questo questionario è ispirato a quelli di adeguatezza dei consulenti, ma qui serve solo a regolare il gioco.'], 'Prof. Saldi');
  let score = 0;
  for (const [q, opts] of QUESTIONS) {
    const c = await choose(opts, { prompt: q, who: 'Prof. Saldi' });
    score += c;
    if (q.startsWith('Per quanto')) S.horizon = opts[c];
  }
  return score;
}

export async function onboarding(): Promise<void> {
  await disclaimer();
  // scena d'introduzione: il Professore su una pedana, come nei classici
  const intro = el('div', 'intro-stage', `<img class="sprite" src="${portrait(PAL.PROF)}" alt="Prof. Saldi">`);
  getStage().prepend(intro);
  await say(['Ciao! Benvenuto nella Regione di Capitalia!', 'Mi chiamo Bruno Saldi, ma tutti mi chiamano "il Prof".', 'Ho passato trent\'anni a gestire i risparmi degli altri. Ho visto bolle, crolli e riprese.', 'Oggi insegno ai giovani investitori a non ripetere i miei errori.'], 'Prof. Saldi');
  S.name = (await ask('Come ti chiami?', 'Alex', 10)) || 'Alex';
  await say(`${S.name}! Che bel nome.`, 'Prof. Saldi');
  const av = await choose(['Stile rosso', 'Stile blu', 'Stile verde'], { prompt: 'Scegli il tuo aspetto (non cambia nulla nel gioco).', who: 'Prof. Saldi' });
  S.avatar = av;
  await say('Ora qualche domanda per conoscerti come investitore.', 'Prof. Saldi');
  const score = await questionnaire();
  S.profileScore = score;
  S.profile = profileFromScore(score);
  const desc = { prudente: 'PRUDENTE: preferisci la stabilità. Le tue missioni avranno limiti di perdita più severi.', equilibrato: 'EQUILIBRATO: cerchi un compromesso tra crescita e tranquillità.', audace: 'AUDACE: tolleri bene le oscillazioni. Attento però: audace non vuol dire avventato!' }[S.profile];
  await say([`Il tuo profilo è ${desc}`, 'Ricorda: non è una raccomandazione. Puoi rifare il questionario in ogni Clinica.'], 'Prof. Saldi');
  const g = await choose(['Imparare le basi', 'Costruire un piano di lungo periodo', 'Capire il trading'], { prompt: 'Qual è il tuo obiettivo principale?', who: 'Prof. Saldi' });
  S.goal = ['basi', 'piano', 'trading'][g];
  await say('Questo è mio nipote. Siete cresciuti insieme, ma investe in modo molto diverso da te...', 'Prof. Saldi');
  S.rival = (await ask('Come si chiama il tuo rivale?', 'Leo', 10)) || 'Leo';
  await say([`Giusto, ${S.rival}! Ora vai a casa a riposare.`, 'Domani vieni al mio Laboratorio: ti aspetta una scelta importante.'], 'Prof. Saldi');
  intro.remove();
  S.portfolio = newPortfolio(10000, 0, S.profile);
  S.map = 'home'; S.x = 2; S.y = 4; S.facing = 'down';
  save();
}

export async function portfolioSetup(): Promise<void> {
  await say(['Ciao, sono la Dott.ssa Ratio! Lavoro nelle Cliniche del Portafoglio di tutta la regione.', 'Il Professore mi ha chiesto di aprirti il tuo Conto di Prova: denaro finto, lezioni vere.'], 'Dott.ssa Ratio');
  const res = await modal<{ cap: number; monthly: number; drip: boolean; risky: number; def: number; cash: number }>('Il tuo Conto di Prova', ({ body, button, close }) => {
    const t = S.profile === 'prudente' ? [40, 50, 10] : S.profile === 'audace' ? [80, 10, 10] : [60, 30, 10];
    body.innerHTML = `
      <p class="small">Tutto in <b>Crediti</b> (1 Credito = 1 dollaro virtuale). I punteggi sono in percentuale: un capitale più grande non dà vantaggi.</p>
      <div class="grid2">
        <label>Capitale virtuale<select class="tx cap"><option>1000</option><option selected>10000</option><option>50000</option></select></label>
        <label>Versamento mensile simulato<select class="tx mon"><option>0</option><option>100</option><option>250</option><option>500</option></select></label>
      </div>
      <p><b>Allocazione obiettivo</b> <span class="small muted">(preset per il profilo ${S.profile}; la somma deve fare 100)</span></p>
      <div class="grid2">
        <label>Asset rischiosi %<input class="tx r" type="number" min="0" max="100" value="${t[0]}"></label>
        <label>Asset difensivi % <span class="small muted">${S.track === 'crypto' ? '(stablecoin, oro tokenizzato)' : '(obbligazioni, settori difensivi, oro)'}</span><input class="tx d" type="number" min="0" max="100" value="${t[1]}"></label>
        <label>Liquidità %<input class="tx c" type="number" min="0" max="100" value="${t[2]}"></label>
        <label style="align-self:end"><input type="checkbox" class="drip" checked> Reinvesti automaticamente i dividendi</label>
      </div>
      <p class="msg small bad"></p>`;
    button('Apri il conto', () => {
      const q = (s: string) => Number((body.querySelector(s) as HTMLInputElement).value);
      const r = q('.r'), d = q('.d'), c = q('.c');
      if (r + d + c !== 100 || [r, d, c].some((x) => x < 0)) { (body.querySelector('.msg') as HTMLElement).textContent = 'Le tre percentuali devono sommare a 100.'; return; }
      close({ cap: q('.cap'), monthly: q('.mon'), drip: (body.querySelector('.drip') as HTMLInputElement).checked, risky: r, def: d, cash: c });
    }, 'primary');
  }, { closable: false });
  const r = res!;
  S.portfolio = newPortfolio(r.cap, r.monthly, S.profile);
  S.portfolio.drip = r.drip;
  S.portfolio.target = { risky: r.risky, defensive: r.def, cash: r.cash };
  await say([`Conto aperto con ${r.cap.toLocaleString('it-IT')} Crediti.`, 'Ogni città ha una Clinica come questa: lì controlli la salute del portafoglio, compri, vendi e salvi.', 'E se un giorno perderai tutto in simulazione, potrai ricaricare il conto di prova una volta per regione. Ma ti costerà un po\' di Reputazione!'], 'Dott.ssa Ratio');
}

export async function runExam(): Promise<boolean> {
  const qs = pickQuestions(['esame'], 10);
  const prev = S.options.studyMode;
  const prevFid = S.stats.fiducia;
  S.options.studyMode = true;
  S.stats.fiducia = 100;
  const r = await runDuel({ foeName: 'Commissione d\'Esame', foeTitle: 'Esame di Abilitazione', foePal: PAL.PROF, questions: qs, need: 9, damage: 0 });
  S.options.studyMode = prev;
  S.stats.fiducia = prevFid;
  return r.correct >= 9;
}

export function titleScreen(hasSave: boolean): Promise<'new' | 'continue' | 'import'> {
  return new Promise((resolve) => {
    const stage = document.getElementById('stage')!;
    const t = el('div', 'title-screen');
    t.style.backgroundImage = `url(${titleBackdrop()})`;
    t.innerHTML = `<h1>TRADERMON</h1><div class="sub">IL VIAGGIO DELL'INVESTITORE</div><div class="opts row" style="flex-direction:column;gap:10px;margin-top:14px"></div>
      <div class="foot">Gioco educativo · non è consulenza finanziaria · mondo e personaggi originali<br>Frecce/WASD per muoverti · Z/Invio conferma · X/Esc indietro · M menu</div>`;
    const opts = t.querySelector('.opts')!;
    const add = (label: string, v: 'new' | 'continue' | 'import') => {
      const b = el('button', 'btn' + (opts.children.length === 0 ? ' primary' : ''), esc(label));
      b.style.minWidth = '220px';
      b.addEventListener('click', () => { t.remove(); resolve(v); });
      opts.appendChild(b);
    };
    if (hasSave) add('Continua', 'continue');
    add('Nuova partita', 'new');
    add('Importa salvataggio', 'import');
    stage.appendChild(t);
    setTimeout(() => (opts.querySelector('button') as HTMLButtonElement)?.focus(), 50);
  });
}

export async function saveAfter() { save(); }
