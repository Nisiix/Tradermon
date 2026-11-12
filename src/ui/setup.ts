import { S, profileFromScore, save } from '../systems/state';
import { say, choose, ask, modal, el, esc } from './core';
import { mountArena } from './arena';
import { pickQuestions } from '../systems/quiz';
import { runDuel } from './battle';
import { PAL, titleBackdrop, portrait, playerPal, PLAYER_COLOR_LIST } from '../art/art';
import { getStage } from './core';
import { controlsTutorial } from './tutorial';
import { pushHandler, popHandler, type Key } from './input';
import { applyDifficulty, chooseDifficulty } from './broker';
import { keysOf } from '../systems/controls';
import { T } from '../i18n';

export async function disclaimer(): Promise<void> {
  await modal(T('Prima di iniziare'), ({ body, button, close }) => {
    body.innerHTML = T`
      <p><b>Tradermon è un gioco educativo.</b> Non fornisce consulenza finanziaria né raccomandazioni personalizzate.</p>
      <p>Il mondo e i personaggi di Capitalia sono di fantasia. <b>Titoli, prezzi e grafici sono reali</b>: arrivano da Alpaca, un broker, attraverso un conto Paper gratuito (denaro finto) che colleghi tu. I titoli in vetrina sono scelti per insegnare, non per consigliarti. I quiz citano fonti pubbliche di educazione finanziaria (SEC Investor.gov, Investopedia, Consob, Banca d'Italia, CFA Institute, ESMA).</p>
      <p><b>È un gioco per imparare:</b> usa esclusivamente il conto Paper di Alpaca e non usa mai soldi reali. Senza conto collegato resta il percorso di studio. Fuori dal gioco, investire denaro vero comporta il rischio di perderlo.</p>
      <label><input type="checkbox" class="ck"> <span>Ho capito: è un gioco educativo, con denaro finto, e non è consulenza.</span></label>`;
    const b = button(T('Inizia'), () => close(), 'primary');
    b.disabled = true;
    (body.querySelector('.ck') as HTMLInputElement).addEventListener('change', (e) => { b.disabled = !(e.target as HTMLInputElement).checked; });
  }, { serious: true, closable: false });
}

/** Tre domande sulla propensione al rischio: ogni risposta vale 0, 1 o 2 punti (totale 0-6).
 *  Il profilo che ne esce è quello DICHIARATO: lo Specchio dell'investitore lo confronterà con le scelte vere. */
/** Orizzonti salvati in italiano (chiave del testo) e mostrati con T(), così restano giusti se cambi lingua. */
const HORIZONS = ['Meno di 3 anni', 'Da 3 a 10 anni', 'Più di 10 anni'];
const QUESTIONS: [string, string[]][] = [
  [T('Il tuo portafoglio perde il 20% in un mese. Cosa fai?'), [T('Vendo tutto'), T('Aspetto e ripasso il piano'), T('Compro ancora')]],
  [T('Per quanto tempo non ti servono questi soldi?'), HORIZONS.map((h) => T(h))],
  [T('Una perdita del 30% per te sarebbe...'), [T('Inaccettabile'), T('Dura ma gestibile'), T('Parte del gioco')]],
];

export async function questionnaire(): Promise<number> {
  await say([T('Rispondi con sincerità: non ci sono risposte giuste o sbagliate.'), T('Il profilo non ti darà vantaggi né svantaggi. Nelle missioni però osserverò come ti comporti davvero quando il mercato scende: alla Banca lo Specchio dell\'investitore ti mostrerà se dire e fare coincidono.')], T('Prof. Saldi'));
  let score = 0;
  for (const [q, opts] of QUESTIONS) {
    const c = await choose(opts, { prompt: q, who: T('Prof. Saldi') });
    score += c;
    if (q === QUESTIONS[1][0]) S.horizon = HORIZONS[c];
  }
  return score;
}

export async function onboarding(playerName?: string): Promise<void> {
  await disclaimer();
  await controlsTutorial();
  // scena d'introduzione: il Prof dietro il suo banco, davanti alla lavagna dell'aula
  const intro = el('div', 'intro-stage', `<div class="fig"><img class="sprite" src="${portrait(PAL.PROF)}" alt="Prof. Saldi"></div><div class="desk"></div>`);
  getStage().prepend(intro);
  const unmountIntro = mountArena(intro, 'aula', 'prof');
  await say([T('Ciao! Ti do il benvenuto nella Regione di Capitalia!'), T('Mi chiamo Bruno Saldi, ma tutti mi chiamano "il Prof".'), T('Ho passato trent\'anni a gestire i risparmi degli altri. Ho visto bolle, crolli e riprese.'), T('Oggi insegno ai giovani investitori a non ripetere i miei errori.')], T('Prof. Saldi'));
  if (playerName) {
    S.name = playerName;
    await say(T`Tu devi essere ${S.name}! Il tuo nome è già scritto nel registro dei giovani investitori.`, T('Prof. Saldi'));
  } else {
    S.name = (await ask(T('Come ti chiami?'), 'Alex', 10)) || 'Alex';
    await say(T`${S.name}! Che bel nome.`, T('Prof. Saldi'));
  }
  const img = intro.querySelector('img')!;
  // il genere accorda i testi ({maschile|femminile}) e sceglie lo sprite; anteprima dal vivo dietro il banco
  const genders = ['m', 'f'] as const;
  const bodies = genders.map((gd) => portrait(playerPal(0, gd)));
  const gi = await choose([T('Ragazzo'), T('Ragazza')], { prompt: T('Dimmi, sei un ragazzo o una ragazza?'), who: T('Prof. Saldi'), onMove: (i) => { img.src = bodies[i]; img.alt = S.name; } });
  S.gender = genders[gi];
  // il colore scelto tinge vestiti e cappellino del protagonista ovunque (mappa, sfide); anteprima dal vivo dietro il banco
  const looks = PLAYER_COLOR_LIST.map((_, i) => portrait(playerPal(i, S.gender)));
  const av = await choose(PLAYER_COLOR_LIST.map((c) => c.name), { prompt: T('Qual è il tuo colore preferito? Vestiti e cappellino saranno di quel colore (non cambia nulla nel gioco).'), who: T('Prof. Saldi'), onMove: (i) => { img.src = looks[i]; img.alt = S.name; } });
  S.avatar = av;
  await say(T`Ti sta proprio bene, ${S.name}!`, T('Prof. Saldi'));
  img.src = portrait(PAL.PROF); img.alt = T('Prof. Saldi');
  await say(T('Ora qualche domanda per conoscerti come investitore.'), T('Prof. Saldi'));
  const score = await questionnaire();
  S.profileScore = score;
  S.profile = profileFromScore(score);
  const desc = { prudente: T('PRUDENTE: preferisci la stabilità e oscillazioni contenute.'), equilibrato: T('EQUILIBRATO: cerchi un compromesso tra crescita e tranquillità.'), audace: T('AUDACE: tolleri bene le oscillazioni. Attent{o|a} però: audace non vuol dire avventato!') }[S.profile];
  await say([T`Il tuo profilo è ${desc}`, T('Non è una raccomandazione: serve a conoscerti, e in base alle risposte preparerò il piano del tuo conto di gioco.')], T('Prof. Saldi'));
  // il rivale: un bambino rimasto senza famiglia che il Prof ha adottato; ha un nome suo, non lo sceglie il giocatore
  S.rival = 'Leo';
  img.src = portrait(PAL.RIVAL); img.alt = 'Leo';
  await say([T('E lui è Leo. Quando era piccolo è rimasto senza famiglia: l\'ho adottato e da allora vive con me.'), T('Siete cresciuti insieme in questo borgo, ma investe in modo molto diverso da te...'), T('Mi ha chiesto lui di fare il tuo stesso viaggio. Credo voglia dimostrare qualcosa, a me e a sé stesso.')], T('Prof. Saldi'));
  img.src = portrait(PAL.PROF); img.alt = T('Prof. Saldi');
  await say([T`Ora vai a casa a riposare, ${S.name}.`, T('Domani vieni al mio Laboratorio: ti aspetta una scelta importante.')], T('Prof. Saldi'));
  unmountIntro();
  intro.remove();
  await say([T('Un\'ultima scelta: la difficoltà.'), T('Decide quanto capitale avrà il tuo conto di gioco e quanto margine di errore ti lascio lungo il viaggio. I punteggi sono in percentuale: un capitale più grande non dà vantaggi.')], T('Prof. Saldi'));
  applyDifficulty(await chooseDifficulty());
  S.map = 'home'; S.x = 2; S.y = 4; S.facing = 'down';
  save();
}

export function titleScreen(hasSave: boolean): Promise<'new' | 'continue' | 'import'> {
  return new Promise((resolve) => {
    const stage = document.getElementById('stage')!;
    const t = el('div', 'title-screen');
    t.style.backgroundImage = `url(${titleBackdrop()})`;
    t.innerHTML = T`<h1>TRADERMON</h1><div class="sub">IL VIAGGIO DELL'INVESTITORE</div><div class="opts row" style="flex-direction:column;gap:10px;margin-top:14px"></div>
      <div class="foot">Gioco educativo · non è consulenza finanziaria · mondo e personaggi originali<br>${[0, 1].map((i) => (['up', 'left', 'down', 'right'] as const).map((a) => keysOf(a)[i] ?? '').join('')).filter(Boolean).join('/')} per muoverti · ${keysOf('a').slice(0, 2).join('/')} conferma · ${keysOf('b').slice(0, 2).join('/')} indietro · ${keysOf('menu')[0] ?? '—'} menu · ${keysOf('settings')[0] ? keysOf('settings')[0] + '/' : ''}⚙ impostazioni</div>`;
    const opts = t.querySelector('.opts')!;
    const add = (label: string, v: 'new' | 'continue' | 'import') => {
      const b = el('button', 'btn' + (opts.children.length === 0 ? ' primary' : ''), esc(label));
      b.style.minWidth = '220px';
      b.addEventListener('click', () => { popHandler(h); t.remove(); resolve(v); });
      opts.appendChild(b);
    };
    if (hasSave) add(T('Continua'), 'continue');
    add(T('Nuova partita'), 'new');
    add(T('Importa salvataggio'), 'import');
    stage.appendChild(t);
    const list = () => [...opts.querySelectorAll('button')] as HTMLButtonElement[];
    const h = (k: Key) => {
      const bs = list(); const cur = bs.indexOf(document.activeElement as HTMLButtonElement);
      if (k === 'a') { (bs[Math.max(0, cur)]).click(); return true; }
      if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { bs[(Math.max(0, cur) + (k === 'down' || k === 'right' ? 1 : bs.length - 1)) % bs.length].focus(); return true; }
      return true;
    };
    pushHandler(h);
    setTimeout(() => (opts.querySelector('button') as HTMLButtonElement)?.focus(), 50);
  });
}

export async function saveAfter() { save(); }
