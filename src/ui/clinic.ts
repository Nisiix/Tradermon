import { track } from '../systems/progress';
import { S, save, slots, hasTech, TECH, classes, card, learnBias, profileFromScore } from '../systems/state';
import type { BiasId } from '../types';
import { unlockedAssets, ASSET_BY_ID, SECTOR_LABEL, SECTOR_COLOR } from '../data/assets';
import { value, weights, health, diagnosis, rebalancePlan, allocation, fmtMoney, fmtPx, fmtPct, fmtQty, presetTarget } from '../systems/portfolio';
import { metrics, CLIMATE_LABEL } from '../systems/market';
import { say, choose, modal, el, esc, toast, bar, confirm } from './core';
import { LESSONS } from '../data/lessons';
import { BIAS_CURE_Q, BIAS_INFO } from '../data/events';
import { beep } from '../systems/audio';
import { openObservatory, realChart } from './live';
import * as Acc from '../systems/account';
import { asOfLabel, hasPrices } from '../systems/realdata';
import { marketClock } from '../systems/market';
import { DIFFICULTY } from '../systems/balance';
import { requireAccount, apiKeysMenu, stageScreen, leverageDesk, accountAlerts, nextSealLine } from './broker';
import { journalPrompt } from './journal';
import { questionnaire } from './setup';
import { mirrorReport } from '../systems/mirror';
import { shuffle } from '../systems/rng';
import { onBuy, onSell } from '../systems/character';

const NURSE = 'Dott.ssa Ratio';

export function extraUnlocked(): string[] {
  return Object.keys(S.cards);
}

export function tradable() {
  return unlockedAssets(S.track, S.mixedClasses, S.badges, extraUnlocked());
}

export async function openClinic(townIdx: number) {
  await say(['Benvenuto alla Clinica del Portafoglio!', 'Qui curiamo le scelte, non i soldi persi. Come posso aiutarti?'], NURSE);
  if (S.flags.migratedV3) {
    delete S.flags.migratedV3;
    await say(['Una novità importante: a Capitalia non si scambiano più titoli inventati. Da oggi si opera solo su titoli veri, con prezzi veri, attraverso un conto Alpaca Paper.', `Il tuo vecchio conto di prova è stato chiuso e ne ho aperto uno nuovo da ${fmtMoney(S.portfolio.initial)}. Attestati, Tecniche e tutto ciò che hai studiato restano tuoi; i Sigilli pratici si guadagnano ora sul conto vero.`], NURSE);
    save();
  }
  // il conto si allinea alla realtà a ogni visita: prezzi, ordini eseguiti, chiamate di margine
  if (S.flags.starter && (await Acc.checkLink()).paper) { (await Acc.sync()).forEach((n) => toast(n)); await accountAlerts(); }
  for (;;) {
    const opts = [
      'Salva e riposa', 'Check-up', 'Compra / Vendi', 'Ordini aperti', 'Diagnosi', 'Cura: ribilanciamento', 'Lezione sui bias',
      'Tappe, rate e Sigilli', 'Leva e margine', 'Dividendi', 'Depositi e prelievi', 'Cartella clinica', 'Chiavi API e conto reale', 'Osservatorio Alpaca (sola lettura)', 'Specchio dell\'investitore', 'Arrivederci',
    ];
    const dis = opts.map((o) => (o.startsWith('Ordini aperti') && !hasTech(TECH.LIMIT) && !hasTech(TECH.STOP)) || (o.startsWith('Cura') && !hasTech(TECH.REBAL)));
    const c = await choose(opts, { cancel: true, title: 'CLINICA DEL PORTAFOGLIO', disabled: dis });
    if (c < 0 || c === opts.length - 1) { await say('Abbi cura del tuo portafoglio!', NURSE); return; }
    switch (opts[c]) {
      case 'Salva e riposa': {
        S.stats.fiducia = 100;
        S.lastClinic = { map: `clinic_${townIdx}`, x: 5, y: 4 };
        beep('heal');
        const ok = save();
        await say([`La tua Fiducia è tornata al massimo.${ok ? ' Partita salvata.' : ' Attenzione: salvataggio non riuscito (spazio del browser?).'}`, 'Torna quando vuoi!'], NURSE);
        break;
      }
      case 'Check-up': await checkup(); break;
      case 'Compra / Vendi': await trade(); break;
      case 'Ordini aperti': await openOrders(); break;
      case 'Diagnosi': await diagnose(); break;
      case 'Cura: ribilanciamento': await rebalance(); break;
      case 'Lezione sui bias': await reflect(); break;
      case 'Tappe, rate e Sigilli': await stageScreen(); break;
      case 'Leva e margine': await leverageDesk(); break;
      case 'Dividendi': await dividends(); break;
      case 'Depositi e prelievi': await deposit(); break;
      case 'Cartella clinica': await records(); break;
      case 'Chiavi API e conto reale': await apiKeysMenu(); break;
      case 'Osservatorio Alpaca (sola lettura)': await openObservatory(); break;
      case 'Specchio dell\'investitore': {
        const before = S.profile;
        await say(mirrorReport().lines, NURSE);
        const t0 = S.portfolio.target;
        const redo = await choose(['No, va bene così', 'Rifaccio il questionario'], { prompt: `Profilo dichiarato ${S.profile.toUpperCase()} (orizzonte: ${S.horizon || '—'}), obiettivo del conto ${t0.risky}/${t0.defensive}/${t0.cash}. Vuoi rifare il questionario? Le tue scelte nelle missioni restano nello Specchio.`, who: NURSE });
        if (redo !== 1) break;
        const sc = await questionnaire();
        S.profileScore = sc;
        S.profile = profileFromScore(sc);
        await say(`Il tuo profilo ora è: ${S.profile.toUpperCase()}. Ricorda: è uno strumento per conoscerti, non una raccomandazione.`, NURSE);
        if (S.profile !== before) {
          const pt = presetTarget(S.profile);
          const t = S.portfolio.target;
          const upd = await choose([`Sì: ${pt.risky}/${pt.defensive}/${pt.cash}`, `No, tengo ${t.risky}/${t.defensive}/${t.cash}`], { prompt: `Vuoi aggiornare anche l'allocazione obiettivo del conto (rischiosi/difensivi/liquidità)? Diagnosi e ribilanciamento la useranno.`, who: NURSE });
          if (upd === 0) { S.portfolio.target = { ...pt }; toast(`Obiettivo aggiornato: ${pt.risky}/${pt.defensive}/${pt.cash}.`); }
        }
        save();
        break;
      }
    }
  }
}

export function checkupHtml(): string {
  const pf = S.portfolio;
  const px = S.market.prices;
  if (!S.flags.starter) return '<p class="muted">Il conto di gioco si apre con la Valigetta, dal Professore.</p>';
  if (!hasPrices()) return `<p><b>Capitale del conto di gioco:</b> ${fmtMoney(pf.initial)} (${DIFFICULTY[S.difficulty].name}).</p><p class="muted">Nessun prezzo scaricato: collega il conto Alpaca Paper dal menu, voce "Chiavi API". Il gioco mostra solo prezzi reali.</p>`;
  const lock = Acc.locked(pf);
  const v = value(pf, px) - pf.loan;
  const h = health(pf, px, lock);
  const m = metrics(pf.valueHistory.slice(-250));
  const al = allocation(pf, px, lock);
  const free = Math.max(1, value(pf, px) - lock);
  const rows = weights(pf, px).sort((a, b) => b.v - a.v).map((w) => {
    const p = pf.positions.find((x) => x.id === w.id)!;
    const a = ASSET_BY_ID[w.id];
    const pl = w.v / p.cost - 1;
    const wf = w.v / free;
    const tired = pl < -0.2 || (pf.positions.length > 1 && wf > 0.4);
    return `<tr><td><span class="card sector" style="background:${SECTOR_COLOR[a.sector]};border:0;padding:2px 4px">${SECTOR_LABEL[a.sector]}</span> ${esc(a.name)} (${a.ticker})${tired ? ' <span class="bad small">affaticata</span>' : ''}</td><td class="n">${fmtQty(p.qty)}</td><td class="n">${fmtPx(px[w.id])}</td><td class="n">${fmtMoney(w.v)}</td><td class="n">${(wf * 100).toFixed(1)}%</td><td class="n ${pl >= 0 ? 'good' : 'bad'}">${fmtPct(pl)}</td></tr>`;
  }).join('');
  const clk = marketClock();
  return `
    <div class="grid2">
      <div><b>Patrimonio:</b> ${fmtMoney(v)} <span class="${v >= pf.contributed ? 'good' : 'bad'}">(${fmtPct(v / pf.contributed - 1)} sul capitale)</span><br>
      <b>Da investire:</b> ${fmtMoney(Acc.usableCash(pf))} · <b>Riserva dell'Accademia:</b> ${fmtMoney(lock)}${Acc.reserved(pf) > 0 ? ` · <b>in ordini:</b> ${fmtMoney(Acc.reserved(pf))}` : ''}${pf.loan > 0 ? ` · <b class="bad">prestito:</b> ${fmtMoney(pf.loan)}` : ''}<br>
      <b>Slot:</b> ${pf.positions.length}/${slots()} · <b>Clima:</b> ${CLIMATE_LABEL[S.market.climate]} · ${clk.label}</div>
      <div><b>Salute: ${h.state}</b> (${h.score}/100)${bar(h.score)}
      <span class="small">Peso massimo ${h.maxW.toFixed(0)}% · drawdown ${h.dd.toFixed(1)}% · settori ${h.sectors}</span></div>
    </div>
    <p class="small"><b>Allocazione del capitale liberato</b> rischiosi ${al.risky.toFixed(0)}% · difensivi ${al.defensive.toFixed(0)}% · liquidità ${al.cash.toFixed(0)}% — <span class="muted">obiettivo ${pf.target.risky}/${pf.target.defensive}/${pf.target.cash}</span><br>
    <b>Storico del conto</b> (${pf.valueHistory.length} giorni) rendimento ${fmtPct(m.ret)} · volatilità ${(m.vol * 100).toFixed(1)}% · max drawdown −${(m.mdd * 100).toFixed(1)}% · costi didattici e interessi ${fmtMoney(pf.costs)}</p>
    ${rows ? `<table class="t"><tr><th>Asset</th><th class="n">Quote</th><th class="n">Prezzo</th><th class="n">Valore</th><th class="n">Peso</th><th class="n">P&amp;L</th></tr>${rows}</table>` : '<p class="muted">Nessuna posizione. Usa "Compra / Vendi" in una Clinica per il primo investimento.</p>'}
    <p class="small muted">Titoli e prezzi reali, eseguiti sul tuo conto Alpaca Paper (denaro finto) · ${asOfLabel()}. ${nextSealLine()}</p>`;
}

async function checkup() {
  track('checkup');
  await modal('Check-up del portafoglio', ({ body, button, close }) => {
    body.innerHTML = checkupHtml();
    button('Chiudi', () => close(), 'primary');
  }, { wide: true });
}

/** La parte pratica è chiusa dopo una bancarotta senza ripartenze. */
async function practiceClosed(): Promise<boolean> {
  if (!S.flags.bankrupt) return false;
  await say(['Dopo la bancarotta la parte pratica di questa partita è chiusa.', 'Lo studio continua: per tornare a operare serve una nuova partita.'], NURSE);
  return true;
}

/**
 * Compra / Vendi: ogni pulsante invia un ordine REALE al conto Alpaca Paper. Restituisce true se almeno un
 * acquisto è stato accettato (serve alla scena della Valigetta).
 */
export async function trade(guided = false): Promise<boolean> {
  if (await practiceClosed()) return false;
  if (!(await requireAccount('comprare e vendere'))) return false;
  let bought = false;
  await modal('Compra / Vendi · conto di gioco (Alpaca Paper)', ({ body, button, close }) => {
    let busy = false;
    const render = (msg = '') => {
      const pf = S.portfolio;
      const px = S.market.prices;
      const list = tradable().filter((a) => px[a.id] > 0);
      const v = value(pf, px);
      const ex = Acc.exercise();
      const clk = marketClock();
      const useLev = !!S.flags.useLev && Acc.leverageOpen();
      const fee = DIFFICULTY[S.difficulty].fee;
      body.innerHTML = `${msg ? `<p class="${msg.startsWith('!') ? 'bad' : 'good'}">${esc(msg.replace(/^!/, ''))}</p>` : ''}
        <p class="small">Puoi investire <b>${fmtMoney(Acc.usableCash(pf) + (useLev ? Acc.credit(pf) : 0))}</b>${useLev ? ' (leva attiva)' : ''} · Riserva dell'Accademia ${fmtMoney(Acc.locked(pf))} · patrimonio ${fmtMoney(v - pf.loan)} · slot ${pf.positions.length}/${slots()} · ${fee ? `costo didattico ${(fee * 100).toFixed(2).replace('.', ',')}% per ordine` : 'nessun costo didattico'}.<br>
        ${clk.open ? '<span class="good">Borsa USA aperta</span>: gli ordini a mercato si eseguono subito.' : `${clk.label}: puoi ordinare lo stesso, azioni ed ETF si eseguono alla prossima apertura (le cripto sempre).`} <span class="muted">${asOfLabel()}.</span><br>
        ${ex.allDone ? '' : ex.open ? `<b>Esercizio ${ex.stage === 0 ? 'della Valigetta' : 'della tappa ' + ex.stage}:</b> ${ex.got + 0.005 >= ex.need ? 'rata versata' : `mancano ${fmtMoney(ex.need - ex.got)} di acquisti`}${ex.toolOk ? '' : ` · ${esc(ex.tool)}`}` : ''}${guided ? ' <b>Suggerimento:</b> versa la prima rata sul titolo della tua Valigetta.' : ''}</p>`;
      const tbl = el('table', 't');
      tbl.innerHTML = '<tr><th>Asset</th><th class="n">Prezzo $</th><th class="n">1 mese</th><th class="n">Possiedi</th><th></th></tr>';
      for (const a of list) {
        const h = S.market.history[a.id] ?? [];
        const p30 = h[Math.max(0, h.length - 22)] ?? px[a.id];
        const pos = pf.positions.find((p) => p.id === a.id);
        const tr = el('tr');
        tr.innerHTML = `<td><span class="card sector" style="background:${SECTOR_COLOR[a.sector]};border:0;padding:2px 4px">${SECTOR_LABEL[a.sector]}</span> <b>${esc(a.ticker)}</b> ${esc(a.name)} <span class="small muted">rischio ${'★'.repeat(a.risk)}</span></td><td class="n">${fmtPx(px[a.id])}</td><td class="n ${px[a.id] >= p30 ? 'good' : 'bad'}">${fmtPct(px[a.id] / p30 - 1)}</td><td class="n">${pos ? fmtMoney(pos.qty * px[a.id]) : '—'}</td>`;
        const td = el('td');
        const ch = el('button', 'btn', 'Grafico');
        ch.title = 'Grafico a candele reale: 5 min, 15 min, 1 ora, 4 ore, 1 giorno';
        ch.addEventListener('click', () => void realChart(a.id, pos ? { price: pos.cost / pos.qty, label: 'carico' } : undefined));
        td.appendChild(ch);
        const inp = el('input', 'tx') as HTMLInputElement;
        inp.type = 'number'; inp.min = '0'; inp.placeholder = '$'; inp.style.width = '90px'; inp.style.fontSize = '18px';
        const missing = Acc.exMissing();
        inp.value = String(Math.max(0, Math.floor(Math.min(Acc.usableCash(pf), missing > 0 ? missing / (1 + fee) + 0.99 : pf.initial * 0.05))));
        const run = async (fn: () => Promise<Acc.OrderResult>, after?: (r: Acc.OrderResult) => void) => {
          if (busy) return;
          busy = true;
          body.querySelectorAll('button').forEach((x) => ((x as HTMLButtonElement).disabled = true));
          const r = await fn();
          busy = false;
          if (r.ok) after?.(r);
          render(r.ok ? [r.msg, r.exercise].filter(Boolean).join(' ') : '!' + r.msg);
        };
        const b = el('button', 'btn', 'Compra');
        b.addEventListener('click', async () => {
          const amt = Number(inp.value);
          if (!(await summaryOk(a.id, amt))) return;
          void run(() => Acc.buy(a.id, amt, { lev: useLev }), (r) => {
            bought = true; card(a.id).xp += 3; beep('coin'); S.flags.firstBuy = true; onBuy(amt / Math.max(1, v - Acc.locked(pf)));
            void journalPrompt({ asset: a.id, side: 'buy', amount: amt, price: r.price ?? px[a.id], account: 'paper' });
          });
        });
        td.append(inp, b);
        if (pos) {
          const s = el('button', 'btn', 'Vendi');
          s.addEventListener('click', () => {
            const amt = Number(inp.value);
            const qty = amt > 0 ? Math.min(pos.qty, amt / px[a.id]) : pos.qty;
            void run(() => Acc.sell(a.id, qty), (r) => {
              onSell(pf, a.id, !!r.atLoss, S.market.day);
              void journalPrompt({ asset: a.id, side: 'sell', amount: qty * (r.price ?? px[a.id]), price: r.price ?? px[a.id], account: 'paper' });
            });
          });
          td.append(s);
          if (hasTech(TECH.STOP)) {
            const st = el('button', 'btn', 'Stop −10%');
            st.title = 'Ordine stop reale: vende se il prezzo scende del 10%';
            st.addEventListener('click', () => void run(() => Acc.sell(a.id, pos.qty, { type: 'stop', price: px[a.id] * 0.9 })));
            td.append(st);
          }
        }
        if (hasTech(TECH.LIMIT)) {
          const lb = el('button', 'btn', 'Limite −3%');
          lb.title = 'Ordine limite reale: compra solo se il prezzo scende del 3%';
          lb.addEventListener('click', () => void run(() => Acc.buy(a.id, Number(inp.value), { type: 'limit', price: px[a.id] * 0.97 }), () => { bought = true; }));
          td.append(lb);
        }
        tr.appendChild(td);
        tbl.appendChild(tr);
      }
      body.appendChild(tbl);
      if (!list.length) body.appendChild(el('p', 'bad', 'Nessun prezzo disponibile per i tuoi titoli in questo momento: riprova tra poco.'));
      body.appendChild(el('p', 'small muted', 'Ogni pulsante invia un ordine vero al tuo conto Alpaca Paper: denaro finto, prezzi e orari reali. La vetrina è scelta dal gioco per insegnare, non è un consiglio. Prima di decidere apri il Grafico. Gli stop su quote frazionarie valgono fino alla chiusura della seduta: è una regola di Alpaca.'));
    };
    const summaryOk = async (id: string, amt: number) => {
      const a = ASSET_BY_ID[id];
      const free = Math.max(1, value(S.portfolio, S.market.prices) - Acc.locked());
      const held = S.portfolio.positions.length;
      if (held >= 1 && amt > free * 0.5 && !(await confirm(`Riepilogo: stai per investire ${fmtMoney(amt)} in ${a.name}, cioè il ${((amt / free) * 100).toFixed(0)}% del capitale liberato in un solo asset (rischio ${a.risk}/5). Confermi?`))) return false;
      return true;
    };
    render();
    button('Aggiorna prezzi', () => { void Acc.sync(true).then((n) => render(n.join(' '))); });
    button('Chiudi', () => close(), 'primary');
  }, { wide: true });
  save();
  return bought;
}

async function openOrders() {
  if (!(await requireAccount('vedere gli ordini aperti'))) return;
  (await Acc.sync(true)).forEach((n) => toast(n));
  await modal('Ordini aperti su Alpaca', ({ body, button, close }) => {
    const render = (msg = '') => {
      const o = S.portfolio.pending;
      body.innerHTML = (msg ? `<p class="small">${esc(msg)}</p>` : '') + (o.length ? '' : '<p class="muted">Nessun ordine in attesa.</p>');
      o.forEach((x) => {
        const a = ASSET_BY_ID[x.asset];
        const what = x.notional ? fmtMoney(x.notional) : `${fmtQty(x.qty ?? 0)} quote`;
        const r = el('div', 'row', `${x.side === 'buy' ? 'Acquisto' : 'Vendita'} ${x.type === 'limit' ? 'limite' : x.type === 'stop' ? 'stop' : 'a mercato'} · ${a?.ticker ?? x.asset} · ${what}${x.price ? ` @ ${fmtPx(x.price)} $` : ''} · inviato il ${new Date(x.createdAt).toLocaleString('it-IT', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}${x.filledQty > 0 ? ' · eseguito in parte' : ''}`);
        const b = el('button', 'btn', 'Annulla');
        b.addEventListener('click', async () => { b.disabled = true; render(await Acc.cancel(x)); });
        r.appendChild(b);
        body.appendChild(r);
      });
      body.appendChild(el('p', 'small muted', 'Gli ordini a mercato chiuso restano in coda fino all\'apertura. Limite e stop su azioni ed ETF frazionari scadono a fine seduta; sulle cripto restano finché non li annulli.'));
    };
    render();
    button('Chiudi', () => close(), 'primary');
  });
}

async function diagnose() {
  if (!hasPrices()) { await say('Senza prezzi reali non posso fare una diagnosi: collega il conto dalla voce "Chiavi API".', NURSE); return; }
  const d = diagnosis(S.portfolio, S.market.prices, S.market.day, Acc.locked());
  await say(d.map((x) => x.text), NURSE);
  const lessons = d.filter((x) => x.lesson).map((x) => LESSONS.find((l) => l.id === x.lesson)!).filter(Boolean);
  if (lessons.length) {
    const c = await choose([...lessons.map((l) => `Leggi: ${l.title}`), 'No, grazie'], { cancel: true, prompt: 'Vuoi ripassare la lezione collegata?', who: NURSE });
    if (c >= 0 && c < lessons.length) await say(lessons[c].body, lessons[c].title);
  }
}

async function rebalance() {
  if (await practiceClosed()) return;
  if (!(await requireAccount('il ribilanciamento'))) return;
  const plan = rebalancePlan(S.portfolio, S.market.prices, Acc.locked());
  if (!plan.length) { await say('Il portafoglio è già vicino al tuo obiettivo. Nessuna cura necessaria!', NURSE); return; }
  await say(['Ecco la cura che propongo per tornare alla tua allocazione obiettivo, calcolata sul capitale già liberato.', 'Confermerai tu ogni singolo ordine: io propongo, non eseguo da sola. Sono ordini veri sul conto Paper.'], NURSE);
  for (const p of plan) {
    const a = ASSET_BY_ID[p.id];
    const ok = (await choose(['Conferma', 'Salta'], { prompt: `${p.side === 'buy' ? 'Comprare' : 'Vendere'} circa ${fmtMoney(p.amount)} di ${a.name}?`, who: NURSE })) === 0;
    if (!ok) continue;
    const px = S.market.prices;
    const r = p.side === 'buy' ? await Acc.buy(p.id, Math.min(p.amount, Acc.usableCash()), { tag: 'ribilanciamento' }) : await Acc.sell(p.id, p.amount / px[p.id], { tag: 'ribilanciamento' });
    toast(r.msg);
  }
  track('rebalance');
  S.stats.disciplina = Math.min(100, S.stats.disciplina + 3);
  save();
}

async function reflect() {
  // lezione facoltativa: nessuno "stato" da curare, solo una domanda per riconoscere il bias
  const ids = Object.keys(BIAS_INFO) as BiasId[];
  const c = await choose(ids.map((b) => BIAS_INFO[b].name + (S.biasSeen.includes(b) ? ' ✓' : '')), { cancel: true, prompt: 'Di quale bias vuoi parlare?', who: NURSE });
  if (c < 0) return;
  const b = ids[c];
  const [q, right, ...wrong] = BIAS_CURE_Q[b];
  await say([`${BIAS_INFO[b].name}: ${BIAS_INFO[b].effect}`, 'Vediamo se sai riconoscerlo.'], NURSE);
  const opts = shuffle([right, ...wrong]);
  const k = await choose(opts, { prompt: q, who: NURSE });
  if (opts[k] === right) {
    learnBias(b);
    beep('heal');
    await say(['Esatto. Riconoscere un bias è il primo passo per non farsi guidare da lui.', 'L\'ho annotato nel tuo Investidex.'], NURSE);
  } else {
    await say(`Non proprio. La risposta migliore era: "${right}". Riprova quando vuoi.`, NURSE);
  }
}

async function dividends() {
  const payers = S.portfolio.positions.map((p) => ASSET_BY_ID[p.id]).filter((a) => a && a.dividend > 0);
  await say([
    'I dividendi sono la parte degli utili che un\'azienda distribuisce ai soci. Reinvestirli compra nuove quote, e sulle nuove quote arrivano altri dividendi.',
    payers.length ? `Tra i tuoi titoli pagano di solito un dividendo: ${payers.map((a) => `${a.name} (circa ${(a.dividend * 100).toFixed(1)}% l'anno)`).join(', ')}.` : 'In questo momento non hai titoli che pagano dividendi.',
    'Una cosa da sapere: il conto Paper di Alpaca non simula i dividendi, quindi sul conto di gioco non li vedrai arrivare. Sul conto reale arrivano in contanti, e reinvestirli è una tua scelta.',
    'Per vedere l\'effetto del reinvestimento su un anno intero c\'è la missione del sesto Mentore, nella Macchina del Tempo.',
  ], NURSE);
}

async function deposit() {
  const pf = S.portfolio;
  const lines = [
    `Capitale del conto di gioco: ${fmtMoney(pf.initial)}, fissato dalla difficoltà ${DIFFICULTY[S.difficulty].name}. Patrimonio attuale ${fmtMoney(Acc.equity())}.`,
    'Durante il viaggio non si aggiunge e non si toglie denaro: il conto cambia solo con le tue operazioni e con il mercato. L\'Accademia libera il capitale a rate, una per tappa.',
    'Conto reale: i PRELIEVI si possono sempre fare, dal sito di Alpaca. I DEPOSITI non passano mai dal gioco, e Tradermon non ti chiederà mai di versare denaro.',
  ];
  if (!S.flags.champion) { await say([...lines, 'Dopo la Lega potrai aumentare il capitale del conto di gioco da qui.'], NURSE); return; }
  await say([...lines, 'Sei Campione: ora puoi aumentare il capitale del conto di gioco. È sempre denaro finto del conto Paper.'], NURSE);
  const steps = [0.25, 0.5, 1];
  const c = await choose([...steps.map((f) => `Aggiungi ${fmtMoney(pf.initial * f)}`), 'Niente'], { cancel: true, who: NURSE });
  if (c < 0 || c >= steps.length) return;
  if (!(await requireAccount('aumentare il capitale'))) return;
  const r = await Acc.deposit(pf.initial * steps[c]);
  await say(r, NURSE);
}

async function records() {
  await modal('Cartella clinica', ({ body, button, close }) => {
    const pf = S.portfolio;
    const log = pf.log.slice().reverse();
    const h = pf.valueHistory;
    const tk = (id: string) => ASSET_BY_ID[id]?.ticker ?? id;
    body.innerHTML = `<canvas width="640" height="140" style="width:100%;height:140px;border:2px solid #1d1d2b;border-radius:4px;background:#fff"></canvas>
      <p class="small">Costi didattici e interessi pagati: <b>${fmtMoney(pf.costs)}</b> · bancarotte: ${pf.bankruptcies}${pf.external.length ? ` · operazioni fuori dal gioco: ${pf.external.length}` : ''}</p>
      ${log.length ? `<table class="t"><tr><th>Giorno</th><th>Operazione</th><th class="n">Quote</th><th class="n">Prezzo $</th><th class="n">Costo $</th></tr>${log.slice(0, 100).map((l) => `<tr><td>${l.day}</td><td>${l.side === 'buy' ? 'Acquisto' : 'Vendita'} ${l.type} ${tk(l.asset)}</td><td class="n">${fmtQty(l.qty)}</td><td class="n">${fmtPx(l.price)}</td><td class="n">${l.fee.toFixed(2)}</td></tr>`).join('')}</table>` : '<p class="muted">Nessuna operazione.</p>'}
      ${pf.external.length ? `<p class="small muted">Fuori dal gioco: ${pf.external.slice(-5).map((e) => `${new Date(e.t).toLocaleDateString('it-IT')} ${e.asset ? tk(e.asset) + ' ' : ''}${e.note}`).join(' · ')}</p>` : ''}
      <p class="small muted">Prezzi di esecuzione reali del conto Alpaca Paper. Nota fiscale: con un broker estero come Alpaca chi risiede in Italia deve dichiarare conto e redditi del conto reale (quadri RW e RT). Il CSV è un aiuto per il tuo commercialista, non una consulenza fiscale.</p>`;
    const cv = body.querySelector('canvas') as HTMLCanvasElement;
    const c = cv.getContext('2d')!;
    const lo = Math.min(...h) * 0.98, hi = Math.max(...h) * 1.02;
    c.strokeStyle = '#2f6fd6'; c.lineWidth = 2; c.beginPath();
    h.forEach((v, i) => { const x = (i / Math.max(1, h.length - 1)) * cv.width; const y = cv.height - ((v - lo) / (hi - lo || 1)) * cv.height; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.stroke();
    button('Esporta CSV', () => {
      const rows = [['giorno', 'lato', 'tipo', 'asset', 'quote', 'prezzo', 'costo'], ...pf.log.map((l) => [l.day, l.side, l.type, l.asset, l.qty.toFixed(6), l.price.toFixed(4), l.fee.toFixed(2)])];
      download('tradermon-cartella-clinica.csv', rows.map((r) => r.join(';')).join('\n'));
    });
    button('Chiudi', () => close(), 'primary');
  }, { wide: true });
}

export function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function classesLabel(): string {
  return classes().map((c) => (c === 'stocks' ? 'Titoli' : c === 'etf' ? 'ETF' : 'Cripto')).join(' + ');
}
