// Sportello del conto: collegamento ad Alpaca e chiavi API, guida, apertura del conto di gioco, difficoltà,
// stato delle tappe (Attestati, Sigilli, rate), leva, chiamata di margine, bancarotta e "Mentre eri via".
import * as A from '../systems/alpaca';
import * as Acc from '../systems/account';
import { S, save } from '../systems/state';
import type { Difficulty } from '../types';
import { DIFFICULTY, DIFFICULTIES, LEVERAGE, RATE, STAGES, STAGE_TOOL } from '../systems/balance';
import { fmtMoney, fmtPct, presetTarget, newPortfolio, value } from '../systems/portfolio';
import { asOfLabel, hasPrices } from '../systems/realdata';
import { marketClock } from '../systems/market';
import { guideUrl } from '../systems/home';
import { LEVERAGE_EXAM } from '../data/leverage';
import { PAL } from '../art/art';
import { shuffle } from '../systems/rng';
import { say, choose, modal, toast } from './core';
import { runDuel } from './battle';
import { keysForm, openAlpacaHub } from './live';

const NURSE = 'Dott.ssa Ratio';
const pctTxt = (x: number) => (x * 100).toFixed(2).replace('.', ',').replace(/,?0+$/, '') + '%';

// ---------------- Chiavi API e guida ----------------

/** Guida breve: come si apre il conto e che cosa il gioco può e non può fare. */
export const GUIDE_LINES = [
  '1) Crea un account su alpaca.markets: per il conto Paper basta l\'email. È gratuito e usa denaro finto con prezzi veri.',
  '2) Nella dashboard, in modalità Paper, genera una coppia di chiavi API (Key ID e Secret) e inseriscile alla voce "Chiavi API" del menu.',
  '3) Le chiavi restano sul server locale di Tradermon, sul tuo computer: il gioco non le rilegge e non le mostra mai.',
  'Il conto Paper è il conto di gioco: capitale fissato dalla difficoltà, rate di tappa, Sigilli e Lega vivono lì.',
  'Il conto reale (Live) è facoltativo e separato dalla storia: si collega dopo il primo Attestato e l\'Esame di Abilitazione, con chiavi Live distinte. Potrebbe non essere disponibile per tutti i Paesi: lo decide Alpaca in fase di verifica.',
  'Sul conto reale i PRELIEVI si possono sempre fare, dal sito di Alpaca. I DEPOSITI non passano mai dal gioco: Tradermon non sposta denaro e non ti chiederà mai di versarne.',
  'Il conto è in dollari. Chi risiede in Italia e usa un broker estero deve dichiarare conto e redditi: il gioco esporta un CSV, non fa consulenza fiscale.',
  'Limiti di Alpaca da conoscere: gli stop su quote frazionarie valgono solo per la giornata; il Paper non paga dividendi; le cripto non hanno leva.',
];

/** Voce "Chiavi API" del menu: stato del collegamento, chiavi Paper e Live, guida. */
export async function apiKeysMenu(): Promise<void> {
  for (;;) {
    const link = await Acc.checkLink(true);
    if (!link.server) { await say([...A.noServerLines('collegare il conto Alpaca'), 'Guida completa: ' + guideUrl()], 'Chiavi API'); return; }
    const st = await A.serverStatus();
    const opts = [
      st?.paper.configured ? `Conto Paper collegato (${st.paper.keyHint})` : 'Collega il conto Alpaca Paper',
      S.license === 'investitore' ? (st?.live.configured ? `Conto reale collegato (${st.live.keyHint})` : 'Collega il conto reale (chiavi Live)') : 'Conto reale: dopo il 1º Attestato e l\'Esame',
      'Conto reale, limiti e scollegamento',
      'Guida: come ottenere le chiavi',
      'Indietro',
    ];
    const c = await choose(opts, { cancel: true, title: 'CHIAVI API', disabled: [false, S.license !== 'investitore', false, false, false] });
    if (c < 0 || c === 4) return;
    if (c === 0) {
      if (st?.paper.configured) await say(['Il conto Paper è collegato: è il tuo conto di gioco.', 'Per cambiarlo scollega le chiavi da "Conto reale, limiti e scollegamento": il registro di gioco si riallinea al nuovo conto e riparte dal capitale iniziale.'], 'Chiavi API');
      else if (await keysForm('paper')) { await Acc.checkLink(true); (await Acc.sync(true)).forEach((n) => toast(n)); toast('Conto Paper collegato: prezzi reali scaricati.'); }
    } else if (c === 1) {
      if (st?.live.configured) await openAlpacaHub();
      else if (await keysForm('live')) toast('Conto reale collegato.');
    } else if (c === 2) await openAlpacaHub();
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
  for (;;) {
    const c = await choose(DIFFICULTIES.map((d) => `${DIFFICULTY[d].name} · ${fmtMoney(DIFFICULTY[d].capital)}`), { prompt: 'Con quale difficoltà vuoi giocare? Fissa il capitale del tuo conto di gioco e non si potrà cambiare.', who });
    const d = DIFFICULTIES[Math.max(0, c)];
    const D = DIFFICULTY[d];
    const ok = await choose(['Scelgo questa', 'Fammi vedere le altre'], { prompt: `${D.name}: ${D.desc} Capitale ${fmtMoney(D.capital)}, rate di ${fmtMoney(D.capital * RATE)} per tappa.`, who });
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

/** La Dott.ssa Ratio apre il conto di gioco: spiega le regole, fa scegliere l'allocazione obiettivo e collega il Paper. */
export async function openGameAccount(): Promise<boolean> {
  const D = DIFFICULTY[S.difficulty];
  await say([
    'Ciao, sono la Dott.ssa Ratio! Lavoro nelle Cliniche del Portafoglio di tutta la regione.',
    'Il Professore mi ha chiesto di aprirti il conto di gioco. A Capitalia si studia; i titoli veri si comprano sui Mercati di Fuori, attraverso un broker che si chiama Alpaca.',
    `Il tuo conto parte da ${fmtMoney(D.capital)}: è la difficoltà ${D.name}, e non cambia più. È denaro finto su un conto Paper, ma prezzi, orari e ordini sono quelli veri.`,
    `L'Accademia libera il capitale a rate: ${fmtMoney(D.capital * RATE)} adesso, con la Valigetta, e un'altra rata a ogni Attestato. Il resto sta nella Riserva dell'Accademia e non pesa sui tuoi conti.`,
  ], NURSE);
  const res = await modal<{ risky: number; def: number; cash: number }>('Il tuo conto di gioco', ({ body, button, close }) => {
    const pt = presetTarget(S.profile);
    body.innerHTML = `
      <p class="small">Importi in <b>dollari ($)</b>, la valuta dei mercati dove comprerai. Capitale <b>${fmtMoney(D.capital)}</b> (${D.name})${D.fee ? `, costo didattico ${pctTxt(D.fee)} per ordine` : ', nessun costo didattico'}. Nessun deposito e nessuna ricarica: il conto cambia solo con le tue operazioni e con il mercato.</p>
      <p><b>Allocazione obiettivo</b> <span class="small muted">(preset per il profilo ${S.profile}; la somma deve fare 100)</span></p>
      <div class="grid2">
        <label>Asset rischiosi %<input class="tx r" type="number" min="0" max="100" value="${pt.risky}"></label>
        <label>Asset difensivi % <span class="small muted">${S.track === 'crypto' ? '(stablecoin)' : '(obbligazioni, settori difensivi, oro)'}</span><input class="tx d" type="number" min="0" max="100" value="${pt.defensive}"></label>
        <label>Liquidità %<input class="tx c" type="number" min="0" max="100" value="${pt.cash}"></label>
      </div>
      <p class="small muted">È il tuo piano, non un consiglio: Diagnosi e Ribilanciamento lo useranno, calcolato solo sul capitale già liberato.</p>
      <p class="msg small bad"></p>`;
    button('Apri il conto', () => {
      const q = (s: string) => Number((body.querySelector(s) as HTMLInputElement).value);
      const r = q('.r'), d = q('.d'), c = q('.c');
      if (r + d + c !== 100 || [r, d, c].some((x) => x < 0)) { (body.querySelector('.msg') as HTMLElement).textContent = 'Le tre percentuali devono sommare a 100.'; return; }
      close({ risky: r, def: d, cash: c });
    }, 'primary');
  }, { closable: false });
  if (res) S.portfolio.target = { risky: res.risky, defensive: res.def, cash: res.cash };
  save();
  const link = await Acc.checkLink(true);
  if (link.paper) { await Acc.sync(true); await say(['Il tuo conto Alpaca Paper è già collegato: la Valigetta si può aprire subito.'], NURSE); return true; }
  await say(['Per aprire la Valigetta serve il conto Alpaca Paper: gratuito, basta un\'email, denaro finto.', ...(link.server ? ['Ti apro "Chiavi API": se non hai ancora le chiavi, la Guida spiega tutto in tre passi.'] : [link.reason])], NURSE);
  if (link.server) await apiKeysMenu();
  const ok = (await Acc.checkLink(true)).paper;
  if (ok) await Acc.sync(true);
  else await say(['Nessun problema: la Valigetta resta sigillata e il tuo viaggio di studio comincia lo stesso.', 'Quando vorrai aprirla, collega il conto dal menu (voce "Chiavi API") e passa in una Clinica.'], NURSE);
  return ok;
}

// ---------------- Tappe: Attestati, Sigilli, rate ----------------

/** Che cosa manca al prossimo Sigillo pratico. */
export function nextSealLine(): string {
  if (S.seals >= 8) return 'Hai tutti e otto i Sigilli pratici.';
  const m = S.seals + 1;
  const miss: string[] = [];
  if (S.badges < m) miss.push(`l'Attestato del Mentore ${m}`);
  if (!S.flags[`m${m}_mission`]) miss.push(`la missione del Mentore ${m} sui dati reali`);
  if (S.exDone < m + 1) miss.push(`l'esercizio della tappa ${m} sul conto`);
  return miss.length ? `Per il Sigillo ${m} ${miss.length > 1 ? 'mancano' : 'manca'}: ${miss.join(', ')}.` : `Il Sigillo ${m} è pronto.`;
}

export function stageHtml(): string {
  const pf = S.portfolio;
  const ex = Acc.exercise();
  const rel = Acc.releasedFrac();
  const rows = Array.from({ length: STAGES }, (_, k) => {
    const done = S.exDone > k;
    const open = !!S.flags.starter && k <= S.badges;
    return `<tr><td>${k === 0 ? 'Valigetta' : `Tappa ${k}`}</td><td>${STAGE_TOOL[k].text}</td><td class="n">${fmtMoney(Acc.exNeed(k))}</td><td>${done ? '<span class="good">fatto</span>' : open ? '<b>da fare</b>' : `<span class="muted">con l'Attestato ${k}</span>`}</td></tr>`;
  }).join('');
  return `
    <p><b>Attestati</b> ${S.badges}/8 · <b>Sigilli pratici</b> ${S.seals}/8 · <b>Esercizi di tappa</b> ${S.exDone}/${STAGES}</p>
    <p class="small">Capitale ${fmtMoney(pf.initial)} (${DIFFICULTY[S.difficulty].name}) · liberato ${(rel * 100).toFixed(0)}% · Riserva dell'Accademia ${fmtMoney(Acc.locked())} · puoi investire ancora ${fmtMoney(Acc.usableCash())}.</p>
    ${ex.allDone ? '<p class="good">Tutti gli esercizi di tappa sono completati.</p>' : `<p class="small">${ex.open ? `<b>Esercizio in corso (${ex.stage === 0 ? 'Valigetta' : 'tappa ' + ex.stage}):</b> acquisti accettati ${fmtMoney(ex.got)} su ${fmtMoney(ex.need)} in totale${ex.toolOk ? '' : ' · manca: ' + ex.tool}` : `Il prossimo esercizio si apre con l'Attestato del Mentore ${ex.stage}.`}</p>`}
    <table class="t"><tr><th>Tappa</th><th>Esercizio sul conto</th><th class="n">Acquisti totali</th><th></th></tr>${rows}</table>
    <p class="small muted">${nextSealLine()} Le rate hanno una tolleranza solo verso il basso (${Math.round(DIFFICULTY[S.difficulty].tolerance * 100)}% in ${DIFFICULTY[S.difficulty].name}): puoi versare meno, mai più del capitale liberato. Un esercizio vale quando Alpaca accetta l'ordine, anche a mercato chiuso.</p>`;
}

export async function stageScreen(): Promise<void> {
  await modal('Tappe, rate e Sigilli', ({ body, button, close }) => { body.innerHTML = stageHtml(); button('Chiudi', () => close(), 'primary'); }, { wide: true });
}

// ---------------- Leva ----------------

async function leverageExam(): Promise<boolean> {
  await say(['L\'Esame della Leva ha 8 domande: ne servono 7 giuste. Nessun timer.', 'La leva non è una Tecnica come le altre: prima di usarla devi sapere come ti può rovinare.'], NURSE);
  const prev = S.options.studyMode, fid = S.stats.fiducia;
  S.options.studyMode = true; S.stats.fiducia = 100;
  const r = await runDuel({ foeName: 'Commissione d\'Esame', foeTitle: 'Esame della Leva', foePal: PAL.PROF, questions: shuffle(LEVERAGE_EXAM), need: 7, damage: 0 });
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
    await say(['Esame superato. Da adesso la leva è disponibile nei replay della Macchina del Tempo, dove sbagliare non costa nulla.', `Sul conto di gioco si apre con l'8º Attestato, quello dello Scudo: prima le protezioni, poi il debito. Tetto ${LEVERAGE.max}×, solo azioni ed ETF.`, 'Sul conto reale, se lo usi, il tetto è quello che Alpaca concede al tuo conto: il gioco non lo supera mai.'], NURSE);
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
      (await Acc.liquidate()).forEach((n) => toast(n));
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
  await say([`BANCAROTTA: il patrimonio del conto di gioco è sceso a ${fmtMoney(Math.max(0, eq))}, sotto il ${Math.round(LEVERAGE.bankrupt * 100)}% del capitale.`, 'È il punto in cui un investitore vero ha perso quasi tutto. Fermiamoci a capire come ci siamo arrivati: guarda la Cartella clinica.'], NURSE);
  const canRestart = D.bankrupt === 'riparti' || (D.bankrupt === 'una-volta' && pf.bankruptcies < 1);
  if (!canRestart) {
    S.flags.bankrupt = true; save();
    await say([D.bankrupt === 'game-over' ? 'In difficoltà Leggenda non ci sono ripartenze: la parte pratica di questa partita finisce qui.' : 'In difficoltà Stratega la ripartenza è una sola, e l\'hai già usata: la parte pratica di questa partita finisce qui.', 'Lo studio resta aperto: storia, duelli e Attestati continuano. Per tornare a operare serve una nuova partita.'], NURSE);
    return;
  }
  if (!(await requireAccount('chiudere le posizioni e ripartire'))) return;
  (await Acc.restartAfterBankruptcy()).forEach((n) => toast(n));
  await say([`Chiudo tutto e riparti con ${fmtMoney(S.portfolio.initial)}: metà del capitale di prima. Attestati, Sigilli ed esercizi già fatti restano tuoi.`, 'Nessun versamento aggiuntivo: nella realtà rincorrere le perdite con altro denaro è l\'errore che le raddoppia.'], NURSE);
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
