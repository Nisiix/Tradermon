// Trama principale: Professore, Valigette, Rivale, mamma.
import { type NpcDef } from '../maps';
import type { AssetClass } from '../../types';
import { S, save, addRep, card, classes } from '../../systems/state';
import { say, choose, modal, esc, wait } from '../../ui/core';
import { runDuel } from '../../ui/battle';
import { trade } from '../../ui/clinic';
import { portfolioSetup } from '../../ui/setup';
import { pickQuestions, targetDiff, storyStage } from '../../systems/quiz';
import { trackTopics } from '../../data/quiz/build';
import { antagonist } from '../../data/story';
import { DUEL, REWARD } from '../../systems/balance';
import { ASSETS, ASSET_BY_ID, starterFor, SECTOR_LABEL } from '../../data/assets';
import { metrics } from '../../systems/market';
import { PAL } from '../../art/art';
import { beep } from '../../systems/audio';
import { track } from '../../systems/progress';
import { reward, TRACK_LABEL, defeatRespawn } from './common';
import type { WorldApi } from './common';

export async function mom() {
  if (!S.flags.starter) return say([`${S.name}, finalmente sei sveglio!`, 'Il Professor Saldi ti aspetta al Laboratorio, qui a Borgo Semina.', 'E ricorda: i soldi che servono per l\'affitto non si investono!'], 'Zia Mara');
  S.stats.fiducia = 100;
  beep('heal');
  return say(['Riposati un po\'. Ecco, la tua Fiducia è tornata al massimo.', 'Tuo zio diceva sempre: "Il mercato può restare irrazionale più a lungo di quanto tu resti solvibile".'], 'Zia Mara');
}

// ---------------- Prologo ----------------

export async function prof(w: WorldApi) {
  if (!S.flags.starter) {
    if (!S.flags.profIntro) {
      await say(['Eccoti! Benvenuto nel mio Laboratorio.', 'Su quel tavolo ci sono tre Valigette. Ognuna contiene la prima Asset Card di un percorso diverso.', 'Blu: il Sentiero dei Titoli, le azioni delle aziende.', 'Verde: il Sentiero degli Indici, gli ETF.', 'Arancione: il Sentiero Cripto, la frontiera più rischiosa.', 'Avvicinati a una Valigetta per leggere la scheda. Oppure parla con me se vuoi un percorso misto.'], 'Prof. Saldi');
      S.flags.profIntro = true;
    }
    const c = await choose(['Guardo le Valigette', 'Vorrei il Sentiero Misto', 'Cos\'è la Licenza?'], { cancel: true, prompt: 'Allora, hai deciso?', who: 'Prof. Saldi' });
    if (c === 2) return licenseTalk();
    if (c !== 1) return;
    await say(['Il Sentiero Misto! Combinerai due o tre classi di attivo.', 'I Mentori 5 e 6 ti parleranno di asset allocation. Scegli le classi.'], 'Prof. Saldi');
    const sets: AssetClass[][] = [['stocks', 'etf'], ['stocks', 'crypto'], ['etf', 'crypto'], ['stocks', 'etf', 'crypto']];
    const s = await choose(['Titoli + ETF', 'Titoli + Cripto', 'ETF + Cripto', 'Titoli + ETF + Cripto', 'Ci ripenso'], { cancel: true });
    if (s < 0 || s === 4) return;
    S.mixedClasses = sets[s];
    return startTrack('mixed', w);
  }
  if (S.badges >= 8 && S.defeated.includes('league_4')) return say(['Campione! Sono fiero di te.', 'Alla Torre delle Sfide trovi le crisi leggendarie. E se vuoi, dalla Torre puoi iniziare una Nuova Partita+ in un altro percorso.'], 'Prof. Saldi');
  return say([`Il tuo percorso: ${TRACK_LABEL[S.track]}. Medaglie: ${S.badges}/8.`, S.badges === 0 ? 'Il primo Mentore, Gaia Primo, è a Ponte Cedola, oltre il Percorso 1.' : 'Continua così, e ricorda di passare dalle Cliniche.', 'E non fidarti di chi ti promette guadagni garantiti!'], 'Prof. Saldi');
}

async function licenseTalk() {
  await say(['Per ora giocherai con monete di prova: denaro finto, lezioni vere.', 'Batti il primo Mentore e potrai sostenere l\'Esame di Abilitazione per la Licenza di Investitore.', 'Con la Licenza potrai collegare un conto Alpaca con le chiavi API: prima Paper, con denaro finto, e se vorrai quello reale, con limiti che crescono insieme alle tue Medaglie.', 'Senza un conto collegato resta il percorso di apprendimento con il mercato simulato: le sfide sui grafici e sui titoli reali richiedono le chiavi.', 'Come creare il conto e collegarlo è spiegato nella sezione Guida della pagina iniziale.', 'Ma potrai anche restare in prova per sempre: la storia non cambia.'], 'Prof. Saldi');
}

export async function chooseCase(n: NpcDef, w: WorldApi) {
  const cls = n.data?.cls as AssetClass;
  const a = ASSET_BY_ID[starterFor(cls)];
  const info = {
    stocks: { stars: 3, vol: '15-30% annuo per i grandi indici, molto di più per i singoli titoli', dd: 'circa −57% (S&P 500, 2007-2009)', tone: 'Imprenditori, bilanci, aziende da conoscere' },
    etf: { stars: 2, vol: '15-18% annuo per un ETF azionario globale', dd: 'circa −50% nelle grandi crisi', tone: 'Pazienza, lungo termine, costi' },
    crypto: { stars: 5, vol: 'spesso sopra il 60% annuo', dd: 'circa −77% (Bitcoin, 2021-2022)', tone: 'Tecnologia, volatilità, truffe da evitare' },
  }[cls];
  const ok = await modal<boolean>(n.name, ({ body, button, close }) => {
    body.innerHTML = `<p><b>${TRACK_LABEL[cls]}</b></p>
      <p>Asset Card iniziale: <b>${esc(a.name)} (${a.ticker})</b> · ${SECTOR_LABEL[a.sector]}<br><span class="small">${esc(a.desc)}</span></p>
      <table class="t"><tr><td>Rischio della classe</td><td>${'★'.repeat(info.stars)}${'☆'.repeat(5 - info.stars)}</td></tr>
      <tr><td>Volatilità tipica</td><td>${info.vol}</td></tr><tr><td>Esempio di caduta storica</td><td>${info.dd}</td></tr>
      <tr><td>Antagonisti</td><td>${antagonist(cls).team}</td></tr><tr><td>Tono della storia</td><td>${info.tone}</td></tr></table>
      <p class="small muted">Il percorso non si cambia a metà partita: dopo la Lega potrai iniziare una Nuova Partita+ in un altro percorso.</p>`;
    button('Scelgo questa Valigetta', () => close(true), 'primary');
    button('Ci penso ancora', () => close(false));
  });
  if (!ok) return;
  await startTrack(cls, w);
}

async function startTrack(track: S_Track, w: WorldApi) {
  S.track = track;
  S.flags.starter = true;
  const first = track === 'mixed' ? S.mixedClasses[0] : (track as AssetClass);
  card(starterFor(first));
  beep('badge');
  await say([`Hai scelto il ${TRACK_LABEL[track]}!`, `Ricevi la Asset Card ${ASSET_BY_ID[starterFor(first)].name}. È entrata nel tuo Investidex.`], 'Prof. Saldi');
  await say(['Ah, eccola. La Dott.ssa Ratio è passata per aprirti il conto.'], 'Prof. Saldi');
  await portfolioSetup();
  await say(['Facciamo subito il primo acquisto, così vedi come funziona.', 'Un consiglio: non investire tutto in una volta, e guarda il riepilogo.'], 'Dott.ssa Ratio');
  await trade(true);
  await licenseTalk();
  await say(['Ah, e prendi questa: la Licenza da Apprendista. La trovi nel menu (tasto M), insieme all\'Investidex e al tuo Profilo.'], 'Prof. Saldi');
  await say(['Un\'ultima cosa, la più importante: da Ponte Cedola in poi ogni città ha una Biblioteca.', 'Gli scaffali in alto a sinistra sono la Sezione del Mentore: libri sull\'argomento su cui il Mentore di quella città ti interrogherà nel duello.', 'Leggili prima di sfidarlo: in questo gioco si vince studiando, non indovinando.'], 'Prof. Saldi');
  save();
  w.refresh();
  await wait(200);
  await rivalIntro(w);
}

type S_Track = 'stocks' | 'etf' | 'crypto' | 'mixed';

// ---------------- Rivale ----------------

async function rivalIntro(w: WorldApi) {
  await w.approach('lab_rival');
  const style = S.profile === 'prudente' ? 'audace' : 'prudente';
  S.flags.rivalStyle = style;
  await say([`Ehi ${S.name}! Anch'io ho preso una Valigetta.`, style === 'audace' ? 'Io punto in alto: niente noiosa diversificazione, solo i titoli che salgono di più!' : 'Io vado sul sicuro: tengo quasi tutto liquido. Zero rischi!', 'Vediamo chi ne sa di più. Sfida!'], S.rival);
  await rivalDuel(1, w);
}

export async function rival(n: NpcDef, w: WorldApi) {
  const k = n.data?.n as number;
  const lines: Record<number, string[]> = {
    2: [`${S.name}! Ti stavo aspettando.`, 'Ho guadagnato un sacco questa settimana. E tu?', 'Confrontiamo le nostre conoscenze... e i nostri portafogli!'],
    3: ['Anche tu a Diversia?', 'Qui tutti parlano di correlazioni. Io preferisco i risultati!'],
    4: ['Sapevo che saresti arrivato fin qui.', 'Prima della Lega, un\'ultima sfida tra noi due. Niente sconti!'],
  };
  await say(lines[k] ?? ['Sfida!'], S.rival);
  await rivalDuel(k, w);
}

async function rivalDuel(k: number, w: WorldApi) {
  const topics = trackTopics(S.track, S.mixedClasses, S.badges);
  const P = k === 1 ? DUEL.rivalFirst : DUEL.rival;
  const qs = pickQuestions(topics, P.n, { target: targetDiff(k === 1 ? 0 : storyStage()), preferReview: true });
  const r = await runDuel({ foeName: S.rival, foeTitle: 'Rivale', foePal: PAL.RIVAL, questions: qs, ...P });
  if (!r.win) { await say(['Ah! Te l\'avevo detto.', 'Ripassa un po\' e riprova.'], S.rival); return defeatRespawn(w); }
  reward({ defeated: `rival_${k}`, rep: REWARD.rep.rival, save: false });
  beep('win');
  await say(['Uff, sai il fatto tuo...', k === 1 ? 'Ma il mercato vero è un\'altra cosa. Ci vediamo sul Percorso 2!' : 'Ma vediamo i portafogli!'], S.rival);
  if (k > 1) await comparePortfolios();
  w.refresh();
  save();
}

async function comparePortfolios() {
  const style = (S.flags.rivalStyle as string) ?? 'audace';
  const n = 120;
  const hist = S.market.history;
  const pool = ASSETS.filter((a) => classes().includes(a.cls));
  const picks = style === 'audace' ? pool.filter((a) => a.risk >= 4).slice(0, 2) : pool.filter((a) => a.risk <= 2).slice(0, 1);
  const chosen = picks.length ? picks : pool.slice(0, 1);
  const investedShare = style === 'audace' ? 1 : 0.25;
  const rv: number[] = [];
  for (let i = 0; i < n; i++) {
    let growth = 0;
    for (const a of chosen) { const h = hist[a.id].slice(-n); growth += (h[i] ?? h[h.length - 1]) / h[0] / chosen.length; }
    rv.push(10000 * (1 - investedShare + investedShare * growth));
  }
  const me = metrics(S.portfolio.valueHistory.slice(-n));
  const rm = metrics(rv);
  const row = (l: string, a: string, b: string) => `<tr><td>${l}</td><td class="n">${a}</td><td class="n">${b}</td></tr>`;
  await modal('Confronto dei portafogli', ({ body, button, close }) => {
    body.innerHTML = `<p>Ultimi ${n} giorni di mercato. ${S.rival} ha uno stile <b>${style}</b>.</p>
      <table class="t"><tr><th></th><th class="n">${esc(S.name)}</th><th class="n">${esc(S.rival)}</th></tr>
      ${row('Rendimento', (me.ret * 100).toFixed(1) + '%', (rm.ret * 100).toFixed(1) + '%')}
      ${row('Volatilità', (me.vol * 100).toFixed(1) + '%', (rm.vol * 100).toFixed(1) + '%')}
      ${row('Max drawdown', '−' + (me.mdd * 100).toFixed(1) + '%', '−' + (rm.mdd * 100).toFixed(1) + '%')}
      ${row('Sharpe', me.sharpe.toFixed(2), rm.sharpe.toFixed(2))}</table>
      <p>${me.sharpe >= rm.sharpe ? 'Il tuo rendimento corretto per il rischio è migliore.' : `${esc(S.rival)} ha uno Sharpe migliore in questo periodo.`} ${rm.ret > me.ret && rm.vol > me.vol ? 'Ha guadagnato di più, ma con molte più oscillazioni: in un periodo diverso avrebbe potuto perdere molto.' : ''}</p>
      <p class="small muted">Lo Sharpe divide il rendimento per la volatilità: confronta in modo equo stili diversi.</p>`;
    button('Ok', () => close(), 'primary');
  });
}

// ---------------- Avversari ----------------
