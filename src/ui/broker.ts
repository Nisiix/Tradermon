// Sportello del conto: collegamento ad Alpaca e chiavi API, guida, apertura del conto di gioco, difficoltà,
// stato delle tappe (Attestati, Sigilli, quote minime), leva, chiamata di margine, bancarotta e "Mentre eri via".
import * as A from '../systems/alpaca';
import * as Acc from '../systems/account';
import { S, save } from '../systems/state';
import type { Difficulty } from '../types';
import { DIFFICULTY, DIFFICULTIES, LEVERAGE, RATE, STAGES, STAGE_TOOL } from '../systems/balance';
import { fmtMoney, fmtPct, newPortfolio, value } from '../systems/portfolio';
import { asOfLabel, hasPrices } from '../systems/realdata';
import { marketClock } from '../systems/market';
import { guideUrl } from '../systems/home';
import { LEVERAGE_EXAM } from '../data/leverage';
import { PAL } from '../art/art';
import { shuffle } from '../systems/rng';
import { say, choose, modal, toast, esc } from './core';
import { ASSET_BY_ID } from '../data/assets';
import { runDuel } from './battle';
import { keysForm, offerRelay, openAlpacaHub, restoreKeys, PAPER_ONLY } from './alpaca';

const NURSE = 'Dott.ssa Ratio';
const pctTxt = (x: number) => (x * 100).toFixed(2).replace('.', ',').replace(/,?0+$/, '') + '%';

// ---------------- Chiavi API e guida ----------------

/** Guida breve: come si apre il conto e che cosa il gioco può e non può fare. */
export const GUIDE_LINES = [
  PAPER_ONLY,
  '1) Registrati sulla piattaforma di Alpaca (alpaca.markets): per il conto Paper basta questo, ed è gratuito.',
  '2) Nella dashboard, in modalità Paper, genera una coppia di chiavi API (Key ID e Secret) e inseriscile alla voce "Chiavi API" del menu.',
  '3) Le chiavi restano solo sul tuo dispositivo. Dal sito sono cifrate con la password del tuo giocatore e il browser le usa per parlare direttamente con Alpaca: non vanno online e nessun server di Tradermon le riceve. Giocando sul tuo computer le custodisce il server locale di Tradermon, che non le rimanda mai al browser.',
  'DOVE SI OPERA: dal sito è il tuo browser a inviare gli ordini direttamente al conto Paper di Alpaca; devi entrare con il tuo giocatore, perché la tua password apre le chiavi. Su un altro dispositivo le chiavi vanno inserite di nuovo. Se il browser non riesce a raggiungere Alpaca, il gioco ti chiede se far passare il conto Paper dal servizio di Tradermon.',
  'Il conto Paper diventa il tuo conto di gioco, in dollari come i mercati americani da cui arrivano i prezzi. Gli ordini si danno in dollari e comprano anche frazioni di titolo. Tradermon non ti chiederà mai di versare denaro.',
  'Le regole del viaggio (Prove sul conto, Sigilli, leva, Boss) te le spiegano i personaggi quando servono. Il riepilogo delle tappe è nel menu, alla voce "Tappe, Prove e Sigilli".',
];

/** Voce "Chiavi API" del menu: stato del collegamento al conto Alpaca Paper, chiavi, guida. */
export async function apiKeysMenu(): Promise<void> {
  let askedUnlock = false, askedRelay = false;
  for (;;) {
    const link = await Acc.checkLink(true);
    if (!link.server) { await say([...A.noServerLines('collegare il conto Alpaca'), 'Guida completa: ' + guideUrl()], 'Chiavi API'); return; }
    const st = await A.serverStatus();
    // dal sito le chiavi salvate cifrate sul dispositivo si aprono con la password del giocatore, senza reinserirle
    if (st && (st.direct || st.cloud) && !askedUnlock && (askedUnlock = true) && (await restoreKeys(st))) { await Acc.checkLink(true); (await Acc.sync(true)).forEach((n) => toast(n)); continue; }
    // il browser non raggiunge Alpaca: la riserva per il Paper la sceglie il giocatore
    if (A.directBlocked() && !A.relayAllowed() && !askedRelay && (askedRelay = true) && (await offerRelay())) { await Acc.checkLink(true); (await Acc.sync(true)).forEach((n) => toast(n)); continue; }
    const opts = [
      st?.paper.configured ? `Conto Paper collegato (${st.paper.keyHint})` : 'Collega il conto Alpaca Paper',
      'Conto Paper e scollegamento',
      'Guida: come ottenere le chiavi',
      'Indietro',
    ];
    const c = await choose(opts, { cancel: true, title: 'CHIAVI API', prompt: PAPER_ONLY });
    if (c < 0 || c === 3) return;
    if (c === 0) {
      if (st?.paper.configured) await say(['Il conto Paper è collegato: è il tuo conto di gioco, con denaro finto.', st.direct ? 'Collegamento: diretto, dal tuo browser ad Alpaca. Le chiavi restano cifrate su questo dispositivo.' : st.cloud ? 'Collegamento: attraverso il servizio di Tradermon, come hai scelto su questo dispositivo perché il browser non raggiungeva Alpaca.' : 'Collegamento: server locale di Tradermon su questo computer, che custodisce le chiavi.', 'Per cambiarlo scollega le chiavi da "Conto Paper e scollegamento": il registro di gioco si riallinea al nuovo conto e riparte dal capitale iniziale.'], 'Chiavi API');
      else if (await keysForm()) { await Acc.checkLink(true); (await Acc.sync(true)).forEach((n) => toast(n)); toast('Conto Paper collegato: prezzi reali scaricati.'); }
    } else if (c === 1) await openAlpacaHub();
    else await say(GUIDE_LINES, 'Guida');
  }
}

/**
 * Le sfide che operano sul conto richiedono il conto raggiungibile ADESSO. Se non lo è, il gioco lo dice,
 * offre di ricollegarlo e non inventa nulla. Restituisce true quando il conto Paper risponde.
 */
export async function requireAccount(what: string, who = NURSE): Promise<boolean> {
  let link = await Acc.checkLink(true);
  if (link.paper) { (await Acc.sync()).forEach((n) => toast(n)); if (Acc.linked()) return true; link = Acc.linkInfo(); }
  await say([`Per ${what} serve il conto Alpaca Paper collegato e raggiungibile.`, link.reason || 'In questo momento non risponde.', 'Lo studio continua comunque: storia, biblioteche, duelli e Attestati non dipendono dal conto.'], who);
  if (!link.server) return false;
  const c = await choose(['Apri "Chiavi API"', 'Più tardi'], { cancel: true, who });
  if (c !== 0) return false;
  await apiKeysMenu();
  return (await Acc.checkLink(true)).paper;
}

// ---------------- Difficoltà e apertura del conto ----------------

/** Scelta della difficoltà: fissa il capitale del conto di gioco e non si cambia più. */
export async function chooseDifficulty(who = 'Prof. Saldi'): Promise<Difficulty> {
  // la difficoltà più alta si sblocca solo con la Nuova Partita+
  const lockedTop = S.ngPlus === 0;
  for (;;) {
    const c = await choose(DIFFICULTIES.map((d) => `${DIFFICULTY[d].name} · ${fmtMoney(DIFFICULTY[d].capital)}${d === 'leggenda' && lockedTop ? ' (si sblocca con la Nuova Partita+)' : ''}`), { prompt: 'Con quale difficoltà vuoi giocare? Fissa il capitale del tuo conto di gioco e non si potrà cambiare.', who, disabled: DIFFICULTIES.map((d) => d === 'leggenda' && lockedTop) });
    const d = DIFFICULTIES[Math.max(0, c)];
    if (d === 'leggenda' && lockedTop) continue;
    const D = DIFFICULTY[d];
    const ok = await choose(['Scelgo questa', 'Fammi vedere le altre'], { prompt: `${D.name}: ${D.desc} Capitale ${fmtMoney(D.capital)}, quota minima di ${fmtMoney(D.capital * RATE * (1 - D.tolerance))} per tappa, fissa per tutta la partita.`, who });
    if (ok === 0) return d;
  }
}

/** Applica la difficoltà a una partita appena iniziata (prima della Valigetta). */
export function applyDifficulty(d: Difficulty): void {
  S.difficulty = d;
  const target = S.portfolio?.target;
  S.portfolio = newPortfolio(DIFFICULTY[d].capital, 0, S.profile);
  if (target && S.flags.starter) S.portfolio.target = target;
}

/**
 * Schemi da manuale (rischiosi/difensivi/liquidità). Sono esempi di scuola, uguali per tutti: NON dipendono dal profilo
 * del questionario, che serve solo a conoscersi. L'allocazione obiettivo la scrive sempre il giocatore.
 */
export const TEXTBOOK_MIXES: { name: string; risky: number; defensive: number; cash: number }[] = [
  { name: 'più difensivo', risky: 40, defensive: 50, cash: 10 },
  { name: 'intermedio', risky: 60, defensive: 30, cash: 10 },
  { name: 'più rischioso', risky: 80, defensive: 10, cash: 10 },
];

/**
 * Modulo dell'allocazione obiettivo: tre campi che il giocatore compila. `current` precompila la sua scelta precedente
 * (mai un valore deciso dal gioco). Gli esempi da manuale riempiono i campi solo se il giocatore li clicca.
 */
export async function allocationForm(title: string, introHtml: string, current: { risky: number; defensive: number; cash: number } | null, closable = true): Promise<{ risky: number; defensive: number; cash: number } | undefined> {
  return modal<{ risky: number; defensive: number; cash: number }>(title, ({ body, button, close }) => {
    const v = (n: number | undefined) => (n === undefined ? '' : String(n));
    body.innerHTML = `
      ${introHtml}
      <p><b>Allocazione obiettivo</b> <span class="small muted">(la scrivi tu; la somma deve fare 100)</span></p>
      <div class="grid2">
        <label>Asset rischiosi %<input class="tx r" type="number" min="0" max="100" value="${v(current?.risky)}"></label>
        <label>Asset difensivi % <span class="small muted">${S.track === 'crypto' ? '(stablecoin)' : '(obbligazioni, settori difensivi, oro)'}</span><input class="tx d" type="number" min="0" max="100" value="${v(current?.defensive)}"></label>
        <label>Liquidità %<input class="tx c" type="number" min="0" max="100" value="${v(current?.cash)}"></label>
      </div>
      <p class="small muted">Esempi da manuale, uguali per tutti e non legati al tuo profilo: ${TEXTBOOK_MIXES.map((m) => `${m.name} ${m.risky}/${m.defensive}/${m.cash}`).join(' · ')}. Più quota rischiosa vuol dire oscillazioni e cali più ampi. Puoi copiarne uno o scrivere il tuo.</p>
      <p class="small muted">È il tuo piano, non un consiglio: la Diagnosi e il Calcolo del ribilanciamento lo confrontano con il conto.</p>
      <p class="msg small bad"></p>`;
    const set = (m: { risky: number; defensive: number; cash: number }) => {
      (body.querySelector('.r') as HTMLInputElement).value = String(m.risky);
      (body.querySelector('.d') as HTMLInputElement).value = String(m.defensive);
      (body.querySelector('.c') as HTMLInputElement).value = String(m.cash);
    };
    for (const m of TEXTBOOK_MIXES) button(`Esempio ${m.risky}/${m.defensive}/${m.cash}`, () => set(m), '');
    button('Conferma il mio piano', () => {
      const raw = ['.r', '.d', '.c'].map((sel) => (body.querySelector(sel) as HTMLInputElement).value.trim());
      const [r, d, c] = raw.map(Number);
      const msg = body.querySelector('.msg') as HTMLElement;
      if (raw.some((x) => x === '')) { msg.textContent = 'Compila le tre percentuali: il piano lo decidi tu.'; return; }
      if (r + d + c !== 100 || [r, d, c].some((x) => !Number.isFinite(x) || x < 0)) { msg.textContent = 'Le tre percentuali devono sommare a 100.'; return; }
      close({ risky: r, defensive: d, cash: c });
    }, 'primary');
  }, { closable });
}

/** La Dott.ssa Ratio apre il conto di gioco: spiega le regole, fa scegliere l'allocazione obiettivo e collega il Paper. */
export async function openGameAccount(): Promise<boolean> {
  const D = DIFFICULTY[S.difficulty];
  await say([
    'Ciao, sono la Dott.ssa Ratio! Lavoro nelle Banche del Portafoglio di tutta la regione.',
    'Il Professore mi ha chiesto di aprirti il conto di gioco, presso un broker dei Mercati di Fuori che si chiama Alpaca.',
    `Il tuo conto parte da ${fmtMoney(D.capital)}, come vuole la difficoltà ${D.name}. È denaro finto su un conto Paper, ma prezzi, orari e ordini sono quelli veri.`,
    `Il capitale è tutto tuo da subito. Ogni tappa ti chiede solo un minimo da investire: ${fmtMoney(D.capital * RATE * (1 - D.tolerance))} adesso, con la Valigetta, e altrettanto a ogni Attestato. Sopra il minimo decidi tu, anche tutto il capitale.`,
    `Le quote si calcolano sempre sul capitale di partenza, non su quello che ti resta: se perdi, pesano di più. Se il conto arriva a zero è bancarotta: finché tieni un titolo la perdita è sulla carta, quando lo vendi diventa vera.`,
  ], NURSE);
  const res = await allocationForm('Il tuo conto di gioco', `<p class="small">Importi in <b>dollari ($)</b>, la valuta dei mercati dove comprerai. Capitale <b>${fmtMoney(D.capital)}</b> (${D.name})${D.fee ? `, costo didattico ${pctTxt(D.fee)} per ordine` : ', nessun costo didattico'}. Nessun deposito e nessuna ricarica: il conto cambia solo con le tue operazioni e con il mercato.</p>`, null, false);
  if (res) S.portfolio.target = res;
  save();
  const link = await Acc.checkLink(true);
  if (link.paper) { await Acc.sync(true); await say(['Il tuo conto Alpaca Paper è già collegato: la Valigetta si può aprire subito.'], NURSE); return true; }
  await say(['Per aprire la Valigetta serve il conto Alpaca Paper: è gratuito e basta registrarsi sulla piattaforma di Alpaca.', ...(link.server ? ['Ti apro "Chiavi API": se non hai ancora le chiavi, la Guida spiega tutto in tre passi.'] : [link.reason])], NURSE);
  if (link.server) await apiKeysMenu();
  const ok = (await Acc.checkLink(true)).paper;
  if (ok) await Acc.sync(true);
  else await say(['Nessun problema: la Valigetta resta sigillata e il tuo viaggio di studio comincia lo stesso.', 'Quando vorrai aprirla, collega il conto dal menu (voce "Chiavi API") e passa in una Banca.'], NURSE);
  return ok;
}

// ---------------- Tappe: Attestati, Sigilli, Prove sul conto ----------------

/** Che cosa manca al prossimo Sigillo pratico. */
export function nextSealLine(): string {
  if (S.seals >= 8) return 'Hai tutti e otto i Sigilli pratici.';
  const m = S.seals + 1;
  const miss: string[] = [];
  if (S.badges < m) miss.push(`l'Attestato del Mentore ${m}`);
  if (S.exDone < m + 1) miss.push(S.exDone < m ? `le Prove sul conto fino alla tappa ${m}` : `la Prova sul conto della tappa ${m}`);
  return miss.length ? `Per il Sigillo ${m} ${miss.length > 1 ? 'mancano' : 'manca'}: ${miss.join(' e ')}.` : `Il Sigillo ${m} è pronto.`;
}

export function stageHtml(): string {
  const pf = S.portfolio;
  const ex = Acc.exercise();
  const D = DIFFICULTY[S.difficulty];
  const rows = Array.from({ length: STAGES }, (_, k) => {
    const done = S.exDone > k;
    const open = !!S.flags.starter && k <= S.badges;
    return `<tr><td>${k === 0 ? 'Valigetta' : `Tappa ${k}`}</td><td>${STAGE_TOOL[k].text}</td><td class="n">${fmtMoney(Acc.exNeed(k))}</td><td>${done ? `<span class="good">fatto</span>${Acc.ignored().includes(k) ? ' <span class="muted">(esito ignorato)</span>' : ''}` : open ? '<b>da fare</b>' : `<span class="muted">con l'Attestato ${k}</span>`}</td></tr>`;
  }).join('');
  const eq = Acc.equity();
  const missing = Acc.exMissing();
  return `
    <p><b>Attestati</b> ${S.badges}/8 · <b>Sigilli pratici</b> ${S.seals}/8 · <b>Prove sul conto</b> ${S.exDone}/${STAGES}</p>
    <p class="small">Capitale ${fmtMoney(pf.initial)} (${D.name}) · puoi investire ancora ${fmtMoney(Acc.usableCash())} · patrimonio ${fmtMoney(eq)} · bancarotta se il conto arriva a zero.</p>
    ${ex.allDone ? '<p class="good">Tutte le Prove sul conto sono completate.</p>' : `<p class="small">${ex.open ? `<b>Prova in corso (${ex.stage === 0 ? 'Valigetta' : 'tappa ' + ex.stage}):</b> acquisti ${fmtMoney(ex.got)} su un minimo di ${fmtMoney(ex.need)} in totale${ex.toolOk ? '' : ' · manca: ' + ex.tool}${Acc.exBarred().length ? ` · <span class="bad">annullata da una vendita: rifalla con un altro titolo (non contano ${esc(Acc.exBarred().map((id) => ASSET_BY_ID[id]?.ticker ?? id).join(', '))})</span>` : ''}` : `La prossima Prova si apre con l'Attestato del Mentore ${ex.stage}.`}</p>`}
    <table class="t"><tr><th>Tappa</th><th>Prova sul conto</th><th class="n">Acquisti minimi in totale</th><th></th></tr>${rows}</table>
    <p class="small muted">${nextSealLine()} La quota di tappa è un minimo fisso (${fmtMoney(Acc.stageQuota())} per tappa in ${D.name}), calcolato sul capitale di partenza di ${fmtMoney(Acc.startCapital())} e non su quello che ti resta: sopra il minimo investi quanto vuoi.${!ex.allDone && ex.open && missing > Math.max(0, eq) ? ' Il tuo patrimonio è sotto la quota che manca: per la Prova contano gli acquisti fatti, quindi puoi arrivarci reinvestendo ciò che vendi.' : ''}${!ex.allDone && ex.open ? ' Se con un titolo non riesci ad arrivare all\'obiettivo della Prova puoi venderlo e puntare su un altro. Decidere di vendere un titolo comprato per la Prova in corso, anche solo una parte, annulla la Prova: la quota della tappa riparte da zero e la rifai con un altro titolo. Una vendita in perdita resta una perdita vera, e le perdite realizzate sono la strada che porta il conto verso lo zero.' : ''} Una Prova vale quando Alpaca accetta l'ordine, anche a mercato chiuso; se poi l'ordine viene annullato o scade senza essere eseguito, la Prova torna da fare.</p>`;
}

export async function stageScreen(): Promise<void> {
  await modal('Tappe, Prove e Sigilli', ({ body, button, close }) => { body.innerHTML = stageHtml(); button('Chiudi', () => close(), 'primary'); }, { wide: true });
}

// ---------------- Leva ----------------

async function leverageExam(): Promise<boolean> {
  await say(['L\'Esame della Leva ha 8 domande: ne servono 7 giuste. Nessun timer.', 'La leva non è una Tecnica come le altre: prima di usarla devi sapere come ti può rovinare.'], NURSE);
  const prev = S.options.studyMode, fid = S.stats.fiducia;
  S.options.studyMode = true; S.stats.fiducia = 100;
  const r = await runDuel({ foeName: 'Commissione d\'Esame', foeTitle: 'Esame della Leva', foePal: PAL.PROF, questions: shuffle(LEVERAGE_EXAM), need: 7, damage: 0, arena: 'aula' });
  S.options.studyMode = prev; S.stats.fiducia = fid;
  return r.correct >= 7;
}

/** Sportello della Leva: esame, stato del margine, interruttore per i nuovi acquisti. */
export async function leverageDesk(): Promise<void> {
  if (!S.levExam) {
    if (S.badges < LEVERAGE.examBadge) return say([`L'Esame della Leva si può sostenere dal ${LEVERAGE.examBadge}º Attestato.`, 'Fino ad allora la leva non esiste, né sul conto né nei replay.'], NURSE);
    if (Number(S.flags.levFail ?? 0) + 10 * 60 * 1000 > Date.now()) return say('Hai appena provato l\'esame: riprova tra qualche minuto, dopo un ripasso.', NURSE);
    if ((await choose(['Sostengo l\'Esame della Leva', 'Non ora'], { cancel: true, who: NURSE })) !== 0) return;
    if (!(await leverageExam())) { S.flags.levFail = Date.now(); save(); return say('Non ancora. Con la leva gli errori costano doppio: ripassa e riprova tra dieci minuti.', NURSE); }
    S.levExam = true; save();
    await say(['Esame superato. Da adesso la leva è disponibile nei replay della Macchina del Tempo, dove sbagliare non costa nulla.', `Sul conto di gioco si apre con l'8º Attestato, quello dello Scudo: prima le protezioni, poi il debito. Tetto ${LEVERAGE.max}×, solo azioni ed ETF.`, 'Il denaro prestato è finto come il resto del conto Paper: gli errori costano capitale di gioco, non soldi veri.'], NURSE);
    return;
  }
  const m = Acc.margin();
  const lines = [
    Acc.leverageOpen() ? `Leva sul conto di gioco: fino a ${LEVERAGE.max}×, solo azioni ed ETF. Prestito attuale ${fmtMoney(m.loan)}, ancora disponibile ${fmtMoney(Acc.credit())}.` : `Leva sul conto di gioco: si apre con l'8º Attestato. Per ora la usi solo nei replay.`,
    `Interesse ${(LEVERAGE.interest * 100).toFixed(1)}% annuo sul prestito, calcolato per giorno di mercato. Margine di mantenimento ${Math.round(LEVERAGE.maintenance * 100)}%: sotto quella soglia scatta la chiamata di margine.`,
    m.loan > 0 ? `Margine attuale ${(m.ratio * 100).toFixed(0)}%.${m.call ? ' SEI IN CHIAMATA DI MARGINE.' : ''}` : 'Nessun prestito in corso.',
  ];
  await say(lines, NURSE);
  if (!Acc.leverageOpen()) return;
  const on = !!S.flags.useLev;
  const c = await choose([on ? 'Disattiva la leva per i nuovi acquisti' : 'Attiva la leva per i nuovi acquisti', m.loan > 0 ? 'Come rimborso il prestito?' : 'Indietro'], { cancel: true, who: NURSE });
  if (c === 0) { S.flags.useLev = !on; save(); toast(S.flags.useLev ? 'Leva attiva: gli acquisti oltre la liquidità usano il prestito.' : 'Leva disattivata.'); }
  else if (c === 1 && m.loan > 0) await say('Ogni vendita rimborsa prima il prestito, poi torna in liquidità. Per uscire dalla leva vendi quanto basta dalla voce "Compra / Vendi".', NURSE);
}

/**
 * Avvisi sul conto: chiamata di margine e bancarotta. La scadenza della chiamata parte quando il giocatore la vede
 * qui, mai mentre il gioco è chiuso. La liquidazione forzata avviene solo sul conto Paper.
 */
export async function accountAlerts(): Promise<void> {
  if (!S.flags.starter || !hasPrices() || S.flags.bankrupt) return;
  const pf = S.portfolio;
  let m = Acc.margin();
  if (m.call) {
    const first = !pf.marginCallAt;
    Acc.seeMarginCall();
    m = Acc.margin();
    if (m.daysLeft <= 0 && !first) {
      await say(['La chiamata di margine non è stata coperta nei tre giorni di mercato.', 'Come farebbe un broker vero, vendo io quanto basta a rimborsare il prestito. Succede solo qui, sul conto Paper.'], NURSE);
      const sold = await Acc.liquidate();
      sold.forEach((n) => toast(n));
      const hit = sold.find((n) => n.includes('Prova sul conto'));
      if (hit) await say(hit, NURSE);
    } else {
      await say([`CHIAMATA DI MARGINE: il tuo margine è al ${(m.ratio * 100).toFixed(0)}%, sotto il minimo del ${Math.round(LEVERAGE.maintenance * 100)}%.`, `Hai ${m.daysLeft} giorni di mercato per vendere una parte dei titoli e rimborsare il prestito (${fmtMoney(m.loan)}). Se non lo fai, vendo io.`, 'Nella realtà il broker può vendere anche subito e senza avvisare: qui ti lascio il tempo di capire.'], NURSE);
    }
  } else if (pf.marginCallAt) Acc.seeMarginCall();
  if (Acc.margin().bankrupt) await bankruptcy();
}

async function bankruptcy(): Promise<void> {
  const pf = S.portfolio;
  const D = DIFFICULTY[S.difficulty];
  const eq = Acc.equity();
  await say([`BANCAROTTA: il conto di gioco è arrivato a zero (${fmtMoney(Math.max(0, eq))}).`, 'Non resta abbastanza nemmeno per l\'ordine più piccolo. È il punto in cui un investitore vero ha perso tutto. Fermiamoci a capire come ci siamo arrivati: guarda la Estratto conto.'], NURSE);
  const canRestart = D.bankrupt === 'riparti' || (D.bankrupt === 'una-volta' && pf.bankruptcies < 1);
  if (!canRestart) {
    S.flags.bankrupt = true; save();
    await say([D.bankrupt === 'game-over' ? 'In difficoltà Leggenda non ci sono ripartenze: la parte pratica di questa partita finisce qui.' : 'In difficoltà Stratega la ripartenza è una sola, e l\'hai già usata: la parte pratica di questa partita finisce qui.', 'Lo studio resta aperto: storia, duelli e Attestati continuano. Per tornare a operare serve una nuova partita.'], NURSE);
    return;
  }
  if (!(await requireAccount('chiudere le posizioni e ripartire'))) return;
  const closed = await Acc.restartAfterBankruptcy();
  closed.forEach((n) => toast(n));
  const hit = closed.find((n) => n.includes('Prova sul conto'));
  if (hit) await say(hit, NURSE);
  await say([`Chiudo tutto e riparti con ${fmtMoney(S.portfolio.initial)}: metà del capitale di partenza. Attestati, Sigilli e Prove già fatte restano tuoi, e le quote di tappa non cambiano.`, 'Nessun versamento aggiuntivo: nella realtà rincorrere le perdite con altro denaro è l\'errore che le raddoppia.'], NURSE);
}

// ---------------- Mentre eri via ----------------

/** All'avvio: che cosa è cambiato sul conto dall'ultima volta, con i prezzi veri. */
export async function whileAway(): Promise<void> {
  if (!S.flags.starter) return;
  const link = await Acc.checkLink(true);
  if (!link.paper) return;
  const before = S.lastSeen;
  const notes = await Acc.sync(true);
  if (!hasPrices()) return;
  const now = Acc.equity();
  const away = before.t ? Date.now() - before.t : 0;
  if (away > 6 * 3600 * 1000 && before.value > 0) {
    const d = now / before.value - 1;
    const days = Math.round(away / 86400000);
    await modal('Mentre eri via', ({ body, button, close }) => {
      body.innerHTML = `<p>${days >= 1 ? `Sono passati ${days} giorni.` : 'È passata qualche ora.'} Il conto di gioco vale <b>${fmtMoney(now)}</b> <span class="${d >= 0 ? 'good' : 'bad'}">(${fmtPct(d)} dall'ultima volta)</span>.</p>
        ${notes.length ? `<ul class="small">${notes.map((n) => `<li>${n.replace(/</g, '&lt;')}</li>`).join('')}</ul>` : '<p class="small muted">Nessun ordine eseguito o scaduto nel frattempo.</p>'}
        <p class="small muted">${asOfLabel()} · ${marketClock().label}. Il mercato vero si muove anche quando non giochi: per questo qui nessuna sfida ti chiede di restare davanti allo schermo.</p>`;
      button('Continua', () => close(), 'primary');
    });
  } else notes.forEach((n) => toast(n));
  S.lastSeen = { t: Date.now(), value: now };
  save();
  await accountAlerts();
}

/** Valore del conto per il riepilogo (senza rete). */
export function accountValue(): number { return value(S.portfolio, S.market.prices) - S.portfolio.loan; }
