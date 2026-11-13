// Trama principale: Professore, Valigette, Rivale, mamma.
import { type NpcDef } from '../maps';
import type { AssetClass } from '../../types';
import { S, save, addRep, card, classes, capital } from '../../systems/state';
import { say, choose, modal, esc, wait, el } from '../../ui/core';
import { runDuel } from '../../ui/battle';
import { trade } from '../../ui/clinic';
import { openGameAccount } from '../../ui/broker';
import { hasPrices } from '../../systems/realdata';
import { caseOpen, releasedFrac } from '../../systems/account';
import { fmtMoney, fmtPx, withUsd } from '../../systems/portfolio';
import { DIFFICULTY, RATE } from '../../systems/balance';
import { pickQuestions, targetDiff, storyStage } from '../../systems/quiz';
import { trackTopics } from '../../data/quiz/build';
import { antagonist, mentor } from '../../data/story';
import { DUEL, REWARD } from '../../systems/balance';
import { ASSETS, ASSET_BY_ID, starterFor, starterOptions, SECTOR_LABEL } from '../../data/assets';
import { metrics, tradingDaysBetween } from '../../systems/market';
import { PAL } from '../../art/art';
import { beep } from '../../systems/audio';
import { keysOf } from '../../systems/controls';
import { track } from '../../systems/progress';
import { reward, TRACK_LABEL, defeatRespawn } from './common';
import type { WorldApi } from './common';
import { T } from '../../i18n';

export async function mom() {
  if (!S.flags.starter) return say([T`${S.name}, finalmente sei svegli{o|a}!`, T('Il Professor Saldi ti aspetta al Laboratorio, qui a Borgo Semina.'), T('E ricorda: i soldi che servono per l\'affitto non si investono!')], T('Zia Mara'));
  S.stats.fiducia = 100;
  beep('heal');
  return say([T('Riposati un po\'. Ecco, la tua Fiducia è tornata al massimo.'), T('Tuo zio diceva sempre: "Il mercato può restare irrazionale più a lungo di quanto tu resti solvibile".')], T('Zia Mara'));
}

// ---------------- Prologo ----------------

export async function prof(w: WorldApi) {
  if (!S.flags.starter) {
    if (!S.flags.profIntro) {
      await say([T('Eccoti! Benvenut{o|a} nel mio Laboratorio.'), T('A Capitalia si studia. I titoli veri si comprano fuori dalla regione, sui Mercati di Fuori: le borse del mondo reale, con prezzi veri e orari veri.'), T('Su quel tavolo ci sono tre Valigette. Ognuna apre un percorso e contiene la scheda del tuo primo titolo vero, scelto da te in una piccola vetrina.'), T('Blu: il Sentiero dei Titoli, le azioni delle aziende.'), T('Verde: il Sentiero degli Indici, gli ETF.'), T('Arancione: il Sentiero Cripto, la frontiera più rischiosa.'), T('Avvicinati a una Valigetta per leggere la scheda. Oppure parla con me se vuoi un percorso misto.')], T('Prof. Saldi'));
      await say([T('In ogni città c\'è una Whale: battila in un duello di conoscenza e avrai il suo Attestato, che apre la strada verso la città successiva. Il resto te lo spiegherà lei.')], T('Prof. Saldi'));
      S.flags.profIntro = true;
    }
    const c = await choose([T('Guardo le Valigette'), T('Vorrei il Sentiero Misto'), T('Si usano soldi veri?')], { cancel: true, prompt: T('Allora, hai deciso?'), who: T('Prof. Saldi') });
    if (c === 2) return moneyTalk();
    if (c !== 1) return;
    await say([T('Il Sentiero Misto! Combinerai due o tre classi di attivo.'), T('Le Whale 5 e 6 ti parleranno di asset allocation. Scegli le classi.')], T('Prof. Saldi'));
    const sets: AssetClass[][] = [['stocks', 'etf'], ['stocks', 'crypto'], ['etf', 'crypto'], ['stocks', 'etf', 'crypto']];
    const s = await choose([T('Titoli + ETF'), T('Titoli + Cripto'), T('ETF + Cripto'), T('Titoli + ETF + Cripto'), T('Ci ripenso')], { cancel: true });
    if (s < 0 || s === 4) return;
    S.mixedClasses = sets[s];
    return startTrack('mixed', w);
  }
  if (!caseOpen()) await say([T('La tua Valigetta è ancora sigillata: si apre con il primo acquisto sul conto Alpaca Paper.'), T('Collega il conto dal menu, voce "Chiavi API", e passa in una Banca. Nel frattempo studia: Attestati e storia non aspettano il conto.')], T('Prof. Saldi'));
  if (S.badges >= 8 && S.defeated.includes('league_4')) return say([T('{Campione|Campionessa}! Sono fiero di te.'), T('Alla Torre delle Sfide trovi le crisi leggendarie e i Boss. E se vuoi, dalla Torre puoi iniziare una Nuova Partita+: da zero, con i tuoi trofei e la difficoltà Leggenda.')], T('Prof. Saldi'));
  return say([T`Il tuo percorso: ${TRACK_LABEL[S.track]}. Attestati: ${S.badges}/8${S.badges ? T` · Sigilli pratici: ${S.seals}/8` : ''}.`, S.badges === 0 ? T('La prima Whale, Gaia Primo, è a Ponte Cedola, oltre il Percorso 1.') : T('Continua così, e ricorda di passare dalle Banche.'), T('E non fidarti di chi ti promette guadagni garantiti!')], T('Prof. Saldi'));
}

async function moneyTalk() {
  await say([
    T('No, mai. Tradermon è un gioco per imparare a muovere i primi passi negli investimenti e nel trading.'),
    T('Il conto di gioco è un conto Alpaca Paper, gratuito, con denaro finto e prezzi veri. Lo colleghi con le chiavi API dal menu, voce "Chiavi API". Lì fai le Prove sul conto e guadagni i Sigilli pratici.'),
    T('Puoi sbagliare quanto vuoi: le perdite costano capitale di gioco, non soldi tuoi. È proprio per questo che qui si impara.'),
    T('Senza quel conto puoi comunque studiare tutto: storia, biblioteche, duelli e Attestati delle Whale. Ti mancheranno i Sigilli, Wall Street e le sfide sui grafici veri.'),
  ], T('Prof. Saldi'));
}

export async function chooseCase(n: NpcDef, w: WorldApi) {
  const cls = n.data?.cls as AssetClass;
  const info = {
    stocks: { stars: 3, vol: T('15-30% annuo per i grandi indici, molto di più per i singoli titoli'), dd: T('circa −57% (S&P 500, 2007-2009)'), tone: T('Imprenditori, bilanci, aziende da conoscere') },
    etf: { stars: 2, vol: T('15-18% annuo per un ETF azionario globale'), dd: T('circa −50% nelle grandi crisi'), tone: T('Pazienza, lungo termine, costi') },
    crypto: { stars: 5, vol: T('spesso sopra il 60% annuo'), dd: T('circa −77% (Bitcoin, 2021-2022)'), tone: T('Tecnologia, volatilità, truffe da evitare') },
  }[cls];
  const ok = await modal<boolean>(n.name, ({ body, button, close }) => {
    body.innerHTML = T`<p><b>${TRACK_LABEL[cls]}</b></p>
      <p>Nella Valigetta c'è una vetrina di titoli veri tra cui scegliere il primo: ${starterOptions(cls).map((a) => `<b>${esc(a.ticker)}</b>`).join(', ')}.</p>
      <table class="t"><tr><td>Rischio della classe</td><td>${'★'.repeat(info.stars)}${'☆'.repeat(5 - info.stars)}</td></tr>
      <tr><td>Volatilità tipica</td><td>${info.vol}</td></tr><tr><td>Esempio di caduta storica</td><td>${info.dd}</td></tr>
      <tr><td>Antagonisti</td><td>${antagonist(cls).team}</td></tr><tr><td>Tono della storia</td><td>${info.tone}</td></tr></table>
      <p class="small muted">Il percorso non si cambia a metà partita: dopo Wall Street potrai iniziare una Nuova Partita+ in un altro percorso, ripartendo da zero.</p>`;
    button(T('Scelgo questa Valigetta'), () => close(true), 'primary');
    button(T('Ci penso ancora'), () => close(false));
  });
  if (!ok) return;
  await startTrack(cls, w);
}

/** Vetrina della Valigetta: il primo titolo vero, scelto dal giocatore tra pochi nomi curati. Non è un consiglio. */
export async function chooseStarter(cls: AssetClass): Promise<string> {
  const opts = starterOptions(cls);
  const px = S.market.prices;
  for (;;) {
    const id = await modal<string>(T('La vetrina della Valigetta'), ({ body, button, close }) => {
      // si sceglie toccando la card, poi si conferma con l'unico pulsante OK (come nel Carrello diversificato)
      let pick = '';
      body.innerHTML = T`<p class="small">Scegli il tuo primo titolo: tocca la sua scheda, poi premi OK. Sono titoli veri, messi in vetrina perché si prestano a imparare: non è un consiglio, e gli altri li ritroverai tutti dopo il primo Attestato.</p>`;
      const grid = el('div', 'cards');
      const cards = opts.map((a) => {
        const c = el('button', 'card pick', T`<span><b>${esc(a.name)}</b> (${esc(a.ticker)})<br><span class="small">${SECTOR_LABEL[a.sector]} · rischio indicativo ${'★'.repeat(a.risk)}${hasPrices() && px[a.id] ? ` · ${withUsd(fmtPx(px[a.id]))}` : ''}</span><br><span class="small">${esc(a.desc)}</span></span>`);
        c.type = 'button';
        c.dataset.id = a.id;
        c.setAttribute('aria-pressed', 'false');
        c.addEventListener('click', (ev) => {
          pick = a.id;
          for (const o of cards) { const on = o.dataset.id === pick; o.classList.toggle('gold', on); o.setAttribute('aria-pressed', String(on)); }
          ok.disabled = false;
          // da tastiera o pulsante A (clic senza puntatore) si passa subito a OK: un altro A conferma
          if (ev.detail === 0) ok.focus();
        });
        grid.appendChild(c);
        return c;
      });
      body.appendChild(grid);
      const ok = button('OK', () => { if (pick) close(pick); }, 'primary');
      ok.disabled = true;
      setTimeout(() => cards[0]?.focus(), 40);
    }, { closable: false, wide: true });
    if (id) return id;
  }
}

async function startTrack(track: S_Track, w: WorldApi) {
  S.track = track;
  const first = track === 'mixed' ? S.mixedClasses[0] : (track as AssetClass);
  beep('badge');
  await say([T`Hai scelto il ${TRACK_LABEL[track]}!`], T('Prof. Saldi'));
  await say([T('Ah, eccola. La Dott.ssa Ratio è passata per aprirti il conto.')], T('Prof. Saldi'));
  const linked = await openGameAccount();
  const starter = await chooseStarter(first);
  S.flags.starter = true;
  S.flags.starterAsset = starter;
  card(starter);
  await say([T`La scheda di ${ASSET_BY_ID[starter].name} è entrata nel tuo Investidex.`], T('Prof. Saldi'));
  if (linked) {
    const D = DIFFICULTY[S.difficulty];
    await say([T('Apriamo la Valigetta con il primo acquisto, così vedi come funziona un ordine vero.'), T`Il minimo per aprirla è ${fmtMoney(capital() * RATE * (1 - D.tolerance))}. Se la Borsa è chiusa l'ordine parte lo stesso e si esegue all'apertura.`], T('Dott.ssa Ratio'));
    if (await trade(true)) { await say(T('Valigetta aperta: il tuo primo titolo vero è nel conto, o in coda per l\'apertura dei mercati.'), T('Dott.ssa Ratio')); }
    else await say(T('Nessun acquisto per ora: la Valigetta resta sigillata. La apri quando vuoi, da una Banca.'), T('Dott.ssa Ratio'));
  }
  await say([T`Ah, e prendi questa: la tessera da Apprendista. La trovi nel menu${keysOf('menu')[0] ? ` (tasto ${keysOf('menu')[0]})` : ''}, insieme all'Investidex e al tuo Profilo.`], T('Prof. Saldi'));
  await say([T('Un\'ultima cosa, la più importante: da Ponte Cedola in poi ogni città ha una Biblioteca.'), T('Gli scaffali in alto a sinistra sono la Sezione della Whale: libri sull\'argomento su cui la Whale di quella città ti interrogherà nel duello.'), T('Leggili prima di sfidarla: in questo gioco si vince studiando, non indovinando.')], T('Prof. Saldi'));
  save();
  w.refresh();
  await wait(200);
  await rivalIntro(w);
}

/** Nuova Partita+: le schede dei titoli che hai già in portafoglio restano disponibili. */
function unlockHeld() {
  for (const p of S.portfolio.positions) if (ASSET_BY_ID[p.id]) card(p.id);
}

type S_Track = 'stocks' | 'etf' | 'crypto' | 'mixed';

// ---------------- Rivale ----------------

async function rivalIntro(w: WorldApi) {
  await w.approach('lab_rival');
  const style = S.profile === 'prudente' ? 'audace' : 'prudente';
  S.flags.rivalStyle = style;
  await say([T`Ehi ${S.name}! Anch'io ho preso una Valigetta.`, style === 'audace' ? T('Io punto in alto: niente noiosa diversificazione, solo i titoli che salgono di più!') : T('Io vado sul sicuro: tengo quasi tutto liquido. Zero rischi!'), T('Vediamo chi ne sa di più. Sfida!')], S.rival);
  await rivalDuel(1, w);
}

/** Leo ti aspetta al primo ingresso a Ponte Cedola: è già passato dall'Exchange e ti spiega a cosa servono gli edifici. Nessuna sfida, una volta sola. */
export const LEO_TOUR_FLAG = 'leoTourT1';
export const LEO_TOUR_NPC = 't1_leo';

export function leoTourPending(mapId: string): boolean {
  return mapId === 't1' && !!S.flags.starter && S.badges === 0 && !S.flags[LEO_TOUR_FLAG];
}

export async function leoTour(w: WorldApi) {
  if (S.flags[LEO_TOUR_FLAG]) return;
  await w.exclaim(LEO_TOUR_NPC);
  await w.approach(LEO_TOUR_NPC);
  await say([
    T`Ehi ${S.name}! Finalmente sei arrivat{o|a} a Ponte Cedola.`,
    T`Io sono qui da stamattina e ho già battuto ${mentor(1, S.track).name}, la Whale dell'Exchange. Il suo Attestato ce l'ho già io!`,
    T('Visto che sei appena arrivat{o|a}, ti spiego come funziona una città.'),
  ], S.rival);
  await say([
    T('Banca del Portafoglio: qui ricarichi la Fiducia e salvi la partita. Se perdi un duello, riparti dall\'ultima Banca in cui sei entrat{o|a}.'),
    T('Allo sportello della Banca segui anche il tuo conto Paper: compri, vendi e controlli il portafoglio, con denaro finto.'),
    T('Biblioteca: nella Sezione della Whale ci sono i libri sull\'argomento del suo duello. La Bibliotecaria ti spiega le lezioni e nell\'archivio ripassi gli errori.'),
    T('Exchange: prima affronti i due allievi, che non si lasciano scavalcare, poi la Whale. Se la batti nel duello di conoscenza ricevi il suo Attestato.'),
    T('Senza quell\'Attestato la Guardia della Borsa, in fondo alla strada, non ti fa passare verso il Percorso 2.'),
    T('Nelle case vivono gli abitanti: entra pure, qualcuno ha una storia da raccontarti. La stazione invece apre solo dal secondo Attestato.'),
  ], S.rival);
  await say([T('Io vado avanti. Studia bene e non metterci troppo!')], S.rival);
  S.flags[LEO_TOUR_FLAG] = true;
  save();
}

export async function rival(n: NpcDef, w: WorldApi) {
  if (n.id === LEO_TOUR_NPC) return leoTour(w);
  const k = n.data?.n as number;
  const lines: Record<number, string[]> = {
    2: [T`${S.name}! Ti stavo aspettando.`, T('Ho guadagnato un sacco questa settimana. E tu?'), T('Confrontiamo le nostre conoscenze... e i nostri portafogli!')],
    3: [T('Anche tu a Diversia?'), T('Qui tutti parlano di correlazioni. Io preferisco i risultati!')],
    4: [T('Sapevo che saresti arrivat{o|a} fin qui.'), T('Prima di Wall Street, un\'ultima sfida tra noi due. Niente sconti!')],
  };
  await say(lines[k] ?? [T('Sfida!')], S.rival);
  await rivalDuel(k, w);
}

async function rivalDuel(k: number, w: WorldApi) {
  const topics = trackTopics(S.track, S.mixedClasses, S.badges);
  const P = k === 1 ? DUEL.rivalFirst : DUEL.rival;
  const qs = pickQuestions(topics, P.n, { target: targetDiff(k === 1 ? 0 : storyStage()), preferReview: true });
  const r = await runDuel({ foeName: S.rival, foeTitle: T('Rivale'), foePal: PAL.RIVAL, questions: qs, ...P, arena: 'tetto' });
  if (!r.win) { await say([T('Ah! Te l\'avevo detto.'), T('Ripassa un po\' e riprova.')], S.rival); return defeatRespawn(w); }
  reward({ defeated: `rival_${k}`, rep: REWARD.rep.rival, save: false });
  beep('win');
  await say([T('Uff, sai il fatto tuo...'), k === 1 ? T('Ma il mercato vero è un\'altra cosa. Ci vediamo sul Percorso 2!') : T('Ma vediamo i portafogli!')], S.rival);
  if (k > 1) await comparePortfolios();
  w.refresh();
  save();
}

/**
 * Confronto con il rivale sugli STESSI giorni reali: quelli in cui il tuo conto è stato misurato, dal più vecchio
 * disponibile. Il rivale ha il tuo stesso capitale e ne investe una parte fissa secondo il
 * suo stile. Con pochi giorni si guardano solo rendimento e calo massimo: volatilità e Sharpe non direbbero nulla.
 */
export const RIVAL_SHARE = { audace: 0.8, prudente: 0.3 } as const;

export function rivalSeries(style: string): { me: number[]; rival: number[]; days: number } | null {
  const pf = S.portfolio;
  const hist = S.market.history;
  const dates = pf.valueDays ?? [];
  const last = S.market.lastBar ? Date.parse(S.market.lastBar) : 0;
  const pool = ASSETS.filter((a) => classes().includes(a.cls) && (hist[a.id]?.length ?? 0) >= 30);
  if (!last || !pool.length) return null;
  const picks = style === 'audace' ? pool.filter((a) => a.risk >= 4).slice(0, 2) : pool.filter((a) => a.risk <= 2).slice(0, 1);
  const chosen = picks.length ? picks : pool.slice(0, 1);
  const len = Math.min(...chosen.map((a) => hist[a.id].length));
  // posizione di ogni giorno misurato dentro lo storico reale (che finisce all'ultima chiusura scaricata)
  const pts: { v: number; i: number }[] = [];
  pf.valueHistory.forEach((v, k) => {
    const d = dates[k];
    if (!d) return;
    const back = tradingDaysBetween(Date.parse(d), last);
    if (back < len) pts.push({ v, i: len - 1 - back });
  });
  if (pts.length < 5) return null;
  // quota investita dal rivale: fissa, secondo lo stile (il resto è liquidità)
  const share = (style === 'audace' ? RIVAL_SHARE.audace : RIVAL_SHARE.prudente) * releasedFrac();
  const at = (i: number) => chosen.reduce((s, a) => { const h = hist[a.id].slice(-len); return s + h[i] / h[pts[0].i] / chosen.length; }, 0);
  return { me: pts.map((p) => p.v), rival: pts.map((p) => capital() * (1 - share + share * at(p.i))), days: pts.length };
}

async function comparePortfolios() {
  const style = (S.flags.rivalStyle as string) ?? 'audace';
  // senza prezzi reali (conto non collegato) non c'è nulla da confrontare: il gioco non inventa andamenti
  const cmp = hasPrices() ? rivalSeries(style) : null;
  if (!cmp) { await say([T`${S.rival} voleva confrontare i portafogli, ma ${!hasPrices() ? T('il tuo conto non è collegato') : T('il tuo conto è ancora troppo giovane')}: servono i prezzi veri e almeno cinque giorni in cui il conto è stato misurato.`], T('Narratore')); return; }
  const me = metrics(cmp.me);
  const rm = metrics(cmp.rival);
  const full = cmp.days >= 20;
  const row = (l: string, a: string, b: string) => `<tr><td>${l}</td><td class="n">${a}</td><td class="n">${b}</td></tr>`;
  await modal(T('Confronto dei portafogli'), ({ body, button, close }) => {
    body.innerHTML = T`<p>Stessi ${cmp.days} giorni reali per entrambi, stesso capitale di partenza. ${S.rival} ha uno stile <b>${style}</b>.</p>
      <table class="t"><tr><th></th><th class="n">${esc(S.name)}</th><th class="n">${esc(S.rival)}</th></tr>
      ${row(T('Rendimento'), (me.ret * 100).toFixed(1) + '%', (rm.ret * 100).toFixed(1) + '%')}
      ${row(T('Max drawdown'), '−' + (me.mdd * 100).toFixed(1) + '%', '−' + (rm.mdd * 100).toFixed(1) + '%')}
      ${full ? row(T('Volatilità'), (me.vol * 100).toFixed(1) + '%', (rm.vol * 100).toFixed(1) + '%') + row(T('Sharpe'), me.sharpe.toFixed(2), rm.sharpe.toFixed(2)) : ''}</table>
      <p>${full ? (me.sharpe >= rm.sharpe ? T('Il tuo rendimento corretto per il rischio è migliore.') : T`${esc(S.rival)} ha uno Sharpe migliore in questo periodo.`) : (me.mdd <= rm.mdd ? T('Finora il tuo conto è sceso meno del suo nei momenti peggiori.') : T`Finora il conto di ${esc(S.rival)} è sceso meno del tuo nei momenti peggiori.`)} ${rm.ret > me.ret && rm.mdd > me.mdd ? T('Ha guadagnato di più, ma con cali più profondi: in un periodo diverso avrebbe potuto perdere molto.') : ''}</p>
      <p class="small muted">${full ? T('Lo Sharpe divide il rendimento per la volatilità: confronta in modo equo stili diversi.') : T('Con meno di 20 giorni misurati volatilità e Sharpe non sono affidabili: li vedrai più avanti.')} Pochi giorni non dicono chi è più bravo: dicono solo com'è andata.</p>`;
    button('Ok', () => close(), 'primary');
  });
}

// ---------------- Avversari ----------------
