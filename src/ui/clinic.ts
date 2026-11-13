import { track } from '../systems/progress';
import { S, save, slots, hasTech, TECH, classes, card, learnBias, profileFromScore } from '../systems/state';
import type { BiasId } from '../types';
import { unlockedAssets, ASSET_BY_ID, SECTOR_LABEL, SECTOR_COLOR, isDefensive } from '../data/assets';
import { value, weights, health, diagnosis, rebalanceGap, maxGap, allocation, fmtMoney, fmtPx, fmtPct, fmtQty, presetTarget, withUsd, pctArt } from '../systems/portfolio';
import { metrics, CLIMATE_LABEL } from '../systems/market';
import { say, choose, modal, el, esc, toast, bar, confirm } from './core';
import { LESSONS } from '../data/lessons';
import { BIAS_CURE_Q, BIAS_INFO } from '../data/events';
import { beep } from '../systems/audio';
import { openObservatory, realChart } from './alpaca';
import * as Acc from '../systems/account';
import { sellCancelsMandate } from '../systems/mandate';
import { BOSS_BY_ID } from '../systems/boss';
import { asOfLabel, hasPrices } from '../systems/realdata';
import { marketClock } from '../systems/market';
import { DIFFICULTY } from '../systems/balance';
import { requireAccount, apiKeysMenu, stageScreen, leverageDesk, accountAlerts, nextSealLine } from './broker';
import { journalPrompt } from './journal';
import { questionnaire } from './setup';
import { mirrorReport, profileName } from '../systems/mirror';
import { shuffle } from '../systems/rng';
import { onBuy, onSell } from '../systems/character';
import { T, LOCALE } from '../i18n';

const NURSE = T('Dott.ssa Ratio');

const provaName = (k: number) => (k === 0 ? T('della Valigetta') : T`della tappa ${k}`);

export function extraUnlocked(): string[] {
  return Object.keys(S.cards);
}

export function tradable() {
  return unlockedAssets(S.track, S.mixedClasses, S.badges, extraUnlocked());
}

export async function openClinic(townIdx: number) {
  await say([T('Benvenut{o|a} alla Banca del Portafoglio!'), T('Qui teniamo i conti delle tue scelte e, se inciampi, ti riapriamo il credito di Fiducia. Come posso aiutarti?')], NURSE);
  if (S.flags.migratedV3) {
    delete S.flags.migratedV3;
    await say([T('Una novità importante: a Capitalia non si scambiano più titoli inventati. Da oggi si opera solo su titoli veri, con prezzi veri, attraverso un conto Alpaca Paper.'), T`Il tuo vecchio conto di prova è stato chiuso e ne ho aperto uno nuovo da ${fmtMoney(S.portfolio.initial)}. Attestati, Tecniche e tutto ciò che hai studiato restano tuoi; i Sigilli pratici si guadagnano ora sul conto Paper, con prezzi veri e denaro finto.`], NURSE);
    save();
  }
  // il conto si allinea alla realtà a ogni visita: prezzi, ordini eseguiti, chiamate di margine
  if (S.flags.starter && (await Acc.checkLink()).paper) { (await Acc.sync()).forEach((n) => toast(n)); await accountAlerts(); }
  for (;;) {
    const opts = [
      T('Salva e ricarica la Fiducia'), T('Check-up'), T('Compra / Vendi'), T('Ordini aperti'), T('Diagnosi'), T('Calcolo del ribilanciamento'), T('Lezione sui bias'),
      T('Tappe, Prove e Sigilli'), T('Leva e margine'), T('Dividendi'), T('Capitale del conto di gioco'), T('Estratto conto'), T('Chiavi API (conto Paper)'), T('Osservatorio Alpaca (sola lettura)'), T('Specchio dell\'investitore'), T('Arrivederci'),
    ];
    const dis = opts.map((o) => (o.startsWith(T('Ordini aperti')) && !hasTech(TECH.LIMIT) && !hasTech(TECH.STOP)) || (o.startsWith(T('Calcolo del ribilanciamento')) && !hasTech(TECH.REBAL)));
    const c = await choose(opts, { cancel: true, title: T('BANCA DEL PORTAFOGLIO'), disabled: dis });
    if (c < 0 || c === opts.length - 1) { await say(T('Abbi cura del tuo portafoglio!'), NURSE); return; }
    switch (opts[c]) {
      case T('Salva e ricarica la Fiducia'): {
        S.stats.fiducia = 100;
        S.lastClinic = { map: `clinic_${townIdx}`, x: 5, y: 4 };
        beep('heal');
        const ok = save();
        await say([T`Credito di Fiducia ricaricato: è tornata al massimo.${ok ? T(' Partita salvata.') : T(' Attenzione: salvataggio non riuscito (spazio del browser?).')}`, T('Torna quando vuoi!')], NURSE);
        break;
      }
      case T('Check-up'): await checkup(); break;
      case T('Compra / Vendi'): await trade(); break;
      case T('Ordini aperti'): await openOrders(); break;
      case T('Diagnosi'): await diagnose(); break;
      case T('Calcolo del ribilanciamento'): await rebalance(); break;
      case T('Lezione sui bias'): await reflect(); break;
      case T('Tappe, Prove e Sigilli'): await stageScreen(); break;
      case T('Leva e margine'): await leverageDesk(); break;
      case T('Dividendi'): await dividends(); break;
      case T('Capitale del conto di gioco'): await deposit(); break;
      case T('Estratto conto'): await records(); break;
      case T('Chiavi API (conto Paper)'): await apiKeysMenu(); break;
      case T('Osservatorio Alpaca (sola lettura)'): await openObservatory(); break;
      case T('Specchio dell\'investitore'): {
        const before = S.profile;
        await say(mirrorReport().lines, NURSE);
        const redo = await choose([T('No, va bene così'), T('Rifaccio il questionario')], { prompt: T`Profilo dichiarato ${profileName(S.profile).toUpperCase()} (orizzonte: ${S.horizon ? T(S.horizon) : '—'}). Vuoi rifare il questionario? Le tue scelte nelle missioni restano nello Specchio.`, who: NURSE });
        if (redo !== 1) break;
        const sc = await questionnaire();
        S.profileScore = sc;
        S.profile = profileFromScore(sc);
        await say(T`Il tuo profilo ora è: ${profileName(S.profile).toUpperCase()}. Ricorda: è uno strumento per conoscerti, non una raccomandazione.`, NURSE);
        if (S.profile !== before) {
          S.portfolio.target = presetTarget(S.profile);
          toast(T('Piano del conto aggiornato in base al nuovo profilo.'));
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
  if (!S.flags.starter) return T('<p class="muted">Il conto di gioco si apre con la Valigetta, dal Professore.</p>');
  if (!hasPrices()) return T`<p><b>Capitale del conto di gioco:</b> ${fmtMoney(pf.initial)} (${DIFFICULTY[S.difficulty].name}).</p><p class="muted">Nessun prezzo scaricato: collega il conto Alpaca Paper dal menu, voce "Chiavi API". Il gioco mostra solo prezzi reali.</p>`;
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
  return T`
    <div class="grid2">
      <div><b>Patrimonio:</b> ${fmtMoney(v)} <span class="${v >= pf.contributed ? 'good' : 'bad'}">(${fmtPct(v / pf.contributed - 1)} sul capitale)</span><br>
      <b>Da investire:</b> ${fmtMoney(Acc.usableCash(pf))}${Acc.reserved(pf) > 0 ? T` · <b>in ordini:</b> ${fmtMoney(Acc.reserved(pf))}` : ''}${pf.loan > 0 ? T` · <b class="bad">prestito:</b> ${fmtMoney(pf.loan)}` : ''}<br>
      <b>Slot:</b> ${pf.positions.length}/${slots()} · <b>Clima:</b> ${CLIMATE_LABEL[S.market.climate]} · ${clk.label}</div>
      <div><b>Salute: ${h.state}</b> (${h.score}/100)${bar(h.score)}
      <span class="small">Peso massimo ${h.maxW.toFixed(0)}% · drawdown ${h.dd.toFixed(1)}% · settori ${h.sectors}</span></div>
    </div>
    <p class="small"><b>Allocazione del conto</b> rischiosi ${al.risky.toFixed(0)}% · difensivi ${al.defensive.toFixed(0)}% · liquidità ${al.cash.toFixed(0)}% — <span class="muted">obiettivo ${pf.target.risky}/${pf.target.defensive}/${pf.target.cash}</span><br>
    <b>Storico del conto</b> (${pf.valueHistory.length} giorni) rendimento ${fmtPct(m.ret)} · volatilità ${(m.vol * 100).toFixed(1)}% · max drawdown −${(m.mdd * 100).toFixed(1)}% · costi didattici e interessi ${fmtMoney(pf.costs)}</p>
    ${rows ? T`<table class="t"><tr><th>Asset</th><th class="n">Quote</th><th class="n">Prezzo</th><th class="n">Valore</th><th class="n">Peso</th><th class="n">P&amp;L</th></tr>${rows}</table>` : T('<p class="muted">Nessuna posizione. Usa "Compra / Vendi" in una Banca per il primo investimento.</p>')}
    <p class="small muted">Titoli e prezzi reali, eseguiti sul tuo conto Alpaca Paper (denaro finto) · ${asOfLabel()}. ${nextSealLine()}</p>`;
}

async function checkup() {
  track('checkup');
  await modal(T('Check-up del portafoglio'), ({ body, button, close }) => {
    body.innerHTML = checkupHtml();
    button(T('Chiudi'), () => close(), 'primary');
  }, { wide: true });
}

/** La parte pratica è chiusa dopo una bancarotta senza ripartenze. */
async function practiceClosed(): Promise<boolean> {
  if (!S.flags.bankrupt) return false;
  await say([T('Dopo la bancarotta la parte pratica di questa partita è chiusa.'), T('Lo studio continua: per tornare a operare serve una nuova partita.')], NURSE);
  return true;
}

/**
 * Compra / Vendi: ogni pulsante invia un ordine REALE al conto Alpaca Paper. Restituisce true se almeno un
 * acquisto è stato accettato (serve alla scena della Valigetta).
 */
export async function trade(guided = false): Promise<boolean> {
  if (await practiceClosed()) return false;
  if (!(await requireAccount(T('comprare e vendere')))) return false;
  let bought = false;
  await modal(T('Compra / Vendi · conto di gioco (Alpaca Paper)'), ({ body, button, close }) => {
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
      body.innerHTML = T`${msg ? `<p class="${msg.startsWith('!') ? 'bad' : 'good'}">${esc(msg.replace(/^!/, ''))}</p>` : ''}
        <p class="small">Puoi investire <b>${fmtMoney(Acc.usableCash(pf) + (useLev ? Acc.credit(pf) : 0))}</b>${useLev ? T(' (leva attiva)') : ''} · patrimonio ${fmtMoney(v - pf.loan)} (bancarotta a zero) · slot ${pf.positions.length}/${slots()} · ${fee ? T`costo didattico ${(fee * 100).toFixed(2).replace('.', ',')}% per ordine` : T('nessun costo didattico')}.<br>
        ${clk.open ? T('<span class="good">Borsa USA aperta</span>: gli ordini a mercato si eseguono subito.') : T`${clk.label}: puoi ordinare lo stesso, azioni ed ETF si eseguono alla prossima apertura (le cripto sempre).`} <span class="muted">${asOfLabel()}.</span><br>
        ${ex.allDone ? '' : ex.open ? T`<b>Prova sul conto ${ex.stage === 0 ? T('della Valigetta') : T('della tappa ') + ex.stage}:</b> ${ex.got + 0.005 >= ex.need ? T('quota minima investita') : T`al minimo mancano ${fmtMoney(ex.need - ex.got)} di acquisti (puoi investire anche di più)`}${ex.toolOk ? '' : ` · ${esc(ex.tool)}`}${Acc.exBarred().length ? T` · <span class="bad">Prova annullata da una vendita: rifalla con un altro titolo (non contano ${esc(Acc.exBarred().map((id) => ASSET_BY_ID[id]?.ticker ?? id).join(', '))})</span>` : ''}` : ''}${guided ? T(' <b>Suggerimento:</b> apri la Valigetta con il titolo che hai scelto in vetrina.') : ''}</p>`;
      const tbl = el('table', 't');
      tbl.innerHTML = T('<tr><th>Asset</th><th class="n">Prezzo $</th><th class="n">1 mese</th><th class="n">Possiedi</th><th></th></tr>');
      for (const a of list) {
        const h = S.market.history[a.id] ?? [];
        const p30 = h[Math.max(0, h.length - 22)] ?? px[a.id];
        const pos = pf.positions.find((p) => p.id === a.id);
        const tr = el('tr');
        tr.innerHTML = `<td><span class="card sector" style="background:${SECTOR_COLOR[a.sector]};border:0;padding:2px 4px">${SECTOR_LABEL[a.sector]}</span> <b>${esc(a.ticker)}</b> ${esc(a.name)} <span class="small muted">rischio ${'★'.repeat(a.risk)}</span></td><td class="n">${fmtPx(px[a.id])}</td><td class="n ${px[a.id] >= p30 ? 'good' : 'bad'}">${fmtPct(px[a.id] / p30 - 1)}</td><td class="n">${pos ? fmtMoney(pos.qty * px[a.id]) : '—'}</td>`;
        const td = el('td');
        const ch = el('button', 'btn', T('Grafico'));
        ch.title = T('Grafico a candele reale: 5 min, 15 min, 1 ora, 4 ore, 1 giorno');
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
          render(r.ok ? (r.cancelled ? '!' : '') + [r.msg, r.cancelled, r.exercise].filter(Boolean).join(' ') : '!' + r.msg);
        };
        const b = el('button', 'btn', T('Compra'));
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
          const s = el('button', 'btn', T('Vendi'));
          s.addEventListener('click', async () => {
            const amt = Number(inp.value);
            const qty = amt > 0 ? Math.min(pos.qty, amt / px[a.id]) : pos.qty;
            if (!(await sellOk(a.id, qty, pos.qty))) return;
            void run(() => Acc.sell(a.id, qty), (r) => {
              onSell(pf, a.id, !!r.atLoss, S.market.day);
              void journalPrompt({ asset: a.id, side: 'sell', amount: qty * (r.price ?? px[a.id]), price: r.price ?? px[a.id], account: 'paper' });
            });
          });
          td.append(s);
          if (hasTech(TECH.STOP)) {
            const st = el('button', 'btn', 'Stop −10%');
            st.title = T('Ordine stop reale: vende se il prezzo scende del 10%');
            st.addEventListener('click', async () => {
              if (sellCancelsMandate(a.id)) { await say(T`${a.ticker} ha già lo stop vero del piano che hai presentato al Boss: si gestisce dalla Torre, non da qui.`, NURSE); return; }
              const hit = Acc.sellCancels(a.id);
              if (hit && !(await confirm(T`${a.ticker} è un titolo della tua Prova sul conto ${provaName(hit.stage)}. Mettere lo stop non annulla nulla, ma se lo stop scatta è una vendita: la Prova viene annullata e la rifai con un altro titolo. Metto lo stop?`, NURSE))) return;
              void run(() => Acc.sell(a.id, pos.qty, { type: 'stop', price: px[a.id] * 0.9 }));
            });
            td.append(st);
          }
        }
        if (hasTech(TECH.LIMIT)) {
          const lb = el('button', 'btn', T('Limite −3%'));
          lb.title = T('Ordine limite reale: compra solo se il prezzo scende del 3%');
          lb.addEventListener('click', () => void run(() => Acc.buy(a.id, Number(inp.value), { type: 'limit', price: px[a.id] * 0.97 }), () => { bought = true; }));
          td.append(lb);
        }
        tr.appendChild(td);
        tbl.appendChild(tr);
      }
      body.appendChild(tbl);
      if (!list.length) body.appendChild(el('p', 'bad', T('Nessun prezzo disponibile per i tuoi titoli in questo momento: riprova tra poco.')));
      body.appendChild(el('p', 'small muted', T('Ogni pulsante invia un ordine vero al tuo conto Alpaca Paper: denaro finto, prezzi e orari reali. La vetrina è scelta dal gioco per insegnare, non è un consiglio. Prima di decidere apri il Grafico. Scegli l\'importo in dollari: compri anche una frazione di titolo, non serve una quota intera. Gli stop su quote frazionarie valgono fino alla chiusura della seduta: è una regola di Alpaca.')));
    };
    // la vendita del titolo di una Prova la annulla: il giocatore deve dirlo in modo esplicito, anche per una parte
    const sellOk = async (id: string, qty: number, held: number) => {
      // il titolo del piano presentato a un Boss: venderlo, anche in parte, annulla quella sfida
      const boss = sellCancelsMandate(id);
      if (boss) {
        const t = ASSET_BY_ID[id].ticker;
        const c = await choose([T('Vendo per annullare la sfida'), T('Non vendo')], { cancel: true, who: NURSE, prompt: T`${t} è il titolo del tuo piano con ${BOSS_BY_ID[boss]?.name ?? T('un Boss')}. Venderlo adesso, anche solo in parte, annulla la sfida: lo stop del piano viene tolto e la ripeti da capo, quiz compreso, con un altro titolo. Non conta come sconfitta.` });
        if (c !== 0) return false;
      }
      const hit = Acc.sellCancels(id);
      if (!hit) return true;
      const tick = ASSET_BY_ID[id].ticker;
      const partial = qty < held * 0.999;
      const c = await choose([partial ? T('Vendo una parte per annullare la Prova') : T('Vendo per annullare la Prova'), T('Non vendo')], {
        cancel: true, who: NURSE,
        prompt: T`${tick} è un titolo della tua Prova sul conto ${provaName(hit.stage)}. Decidere di venderlo, anche solo in parte, annulla la Prova: la quota della tappa riparte da zero e la rifai con un altro titolo (gli acquisti di ${tick} non conteranno finché non la completi). ${partial ? T`Stai vendendo solo una parte (${fmtMoney(qty * S.market.prices[id])} su ${fmtMoney(held * S.market.prices[id])}): vale lo stesso.` : ''} ${Acc.ignoreOn() ? T('Hai attivato "Prosegui anche se la Prova va male": l\'annullamento verrà ignorato e la Prova conterà come superata.') : T('Confermi che vendi per annullare la Prova e rifarla con un altro titolo?')}`,
      });
      return c === 0;
    };
    const summaryOk = async (id: string, amt: number) => {
      const a = ASSET_BY_ID[id];
      const free = Math.max(1, value(S.portfolio, S.market.prices) - Acc.locked());
      const held = S.portfolio.positions.length;
      if (held >= 1 && amt > free * 0.5 && !(await confirm(T`Riepilogo: stai per investire ${fmtMoney(amt)} in ${a.name}, cioè ${pctArt((amt / free) * 100)} del tuo conto in un solo asset (rischio ${a.risk}/5). Confermi?`))) return false;
      return true;
    };
    render();
    button(T('Aggiorna prezzi'), () => { void Acc.sync(true).then((n) => render(n.join(' '))); });
    button(T('Chiudi'), () => close(), 'primary');
  }, { wide: true });
  save();
  // una vendita in perdita può aver portato il conto a zero: il controllo si fa subito, sui dati appena aggiornati
  await accountAlerts();
  return bought;
}

async function openOrders() {
  if (!(await requireAccount(T('vedere gli ordini aperti')))) return;
  (await Acc.sync(true)).forEach((n) => toast(n));
  await modal(T('Ordini aperti su Alpaca'), ({ body, button, close }) => {
    const render = (msg = '') => {
      const o = S.portfolio.pending;
      body.innerHTML = (msg ? `<p class="small">${esc(msg)}</p>` : '') + (o.length ? '' : T('<p class="muted">Nessun ordine in attesa.</p>'));
      o.forEach((x) => {
        const a = ASSET_BY_ID[x.asset];
        const what = x.notional ? fmtMoney(x.notional) : `${fmtQty(x.qty ?? 0)} quote`;
        const r = el('div', 'row', T`${x.side === 'buy' ? T('Acquisto') : T('Vendita')} ${x.type === 'limit' ? T('limite') : x.type === 'stop' ? 'stop' : T('a mercato')} · ${a?.ticker ?? x.asset} · ${what}${x.price ? ` @ ${withUsd(fmtPx(x.price))}` : ''} · inviato il ${new Date(x.createdAt).toLocaleString(LOCALE, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}${x.filledQty > 0 ? T(' · eseguito in parte') : ''}`);
        const b = el('button', 'btn', T('Annulla'));
        b.addEventListener('click', async () => { b.disabled = true; render(await Acc.cancel(x)); });
        r.appendChild(b);
        body.appendChild(r);
      });
      body.appendChild(el('p', 'small muted', T('Gli ordini a mercato chiuso restano in coda fino all\'apertura. Limite e stop su azioni ed ETF frazionari scadono a fine seduta; sulle cripto restano finché non li annulli.')));
    };
    render();
    button(T('Chiudi'), () => close(), 'primary');
  });
}

async function diagnose() {
  if (!hasPrices()) { await say(T('Senza prezzi reali non posso fare una diagnosi: collega il conto dalla voce "Chiavi API".'), NURSE); return; }
  const d = diagnosis(S.portfolio, S.market.prices, S.market.day, Acc.locked());
  await say(d.map((x) => x.text), NURSE);
  const lessons = d.filter((x) => x.lesson).map((x) => LESSONS.find((l) => l.id === x.lesson)!).filter(Boolean);
  if (lessons.length) {
    const c = await choose([...lessons.map((l) => T`Leggi: ${l.title}`), T('No, grazie')], { cancel: true, prompt: T('Vuoi ripassare la lezione collegata?'), who: NURSE });
    if (c >= 0 && c < lessons.length) await say(lessons[c].body, lessons[c].title);
  }
}

const GROUP_LABEL = { risky: T('Asset rischiosi'), defensive: T('Asset difensivi'), cash: T('Liquidità') } as const;

/**
 * Calcolo del ribilanciamento: mostra quanto ogni gruppo si è allontanato dal piano del giocatore. Il gioco non propone
 * ordini né titoli; il giocatore decide in Compra / Vendi, dove ogni vendita passa per i soliti controlli sulle Prove.
 */
async function rebalance() {
  if (await practiceClosed()) return;
  if (!(await requireAccount(T('il ribilanciamento')))) return;
  const before = rebalanceGap(S.portfolio, S.market.prices, Acc.locked());
  if (maxGap(before) < 2) { await say(T('Il conto è già vicino alla tua allocazione obiettivo: nessuno scostamento da correggere.'), NURSE); return; }
  const mine = (g: 'risky' | 'defensive') => S.portfolio.positions.filter((p) => (g === 'defensive') === isDefensive(ASSET_BY_ID[p.id])).map((p) => ASSET_BY_ID[p.id].name);
  const go = await modal<boolean>(T('Calcolo del ribilanciamento'), ({ body, button, close }) => {
    const rows = before.map((g) => `<tr><td>${GROUP_LABEL[g.group]}</td><td class="n">${g.now.toFixed(0)}%</td><td class="n">${g.target}%</td><td class="n">${g.amount >= 0 ? '+' : '−'}${fmtMoney(Math.abs(g.amount))}</td></tr>`).join('');
    const held = (['risky', 'defensive'] as const).map((g) => `<li>${GROUP_LABEL[g]}: ${mine(g).length ? mine(g).map(esc).join(', ') : T('<span class="muted">nessuna posizione</span>')}</li>`).join('');
    body.innerHTML = T`<p class="small">Questo è il confronto tra il conto e il <b>tuo</b> piano, calcolato su tutto il conto. L'ultima colonna dice quanto manca (+) o avanza (−) in ogni gruppo.</p>
      <table class="tbl"><tr><th>Gruppo</th><th class="n">Ora</th><th class="n">Piano</th><th class="n">Differenza</th></tr>${rows}</table>
      <p class="small">Le tue posizioni per gruppo:</p><ul class="small">${held}</ul>
      <p class="small muted">Quali titoli vendere o comprare, e quanto, lo decidi tu: è l'esercizio. Il gioco non sceglie al posto tuo e non è un consiglio. Ricorda che vendere un titolo di una Prova in corso la annulla.</p>`;
    button(T('Apri Compra / Vendi'), () => close(true), 'primary');
    button(T('Chiudi'), () => close(false), '');
  }, { wide: true });
  if (!go) return;
  await trade();
  const after = rebalanceGap(S.portfolio, S.market.prices, Acc.locked());
  if (maxGap(after) + 1 < maxGap(before)) {
    track('rebalance');
    S.stats.disciplina = Math.min(100, S.stats.disciplina + 3);
    toast(T('Il conto ora è più vicino al tuo piano.'));
    save();
  }
}

async function reflect() {
  // lezione facoltativa: nessuno "stato" da curare, solo una domanda per riconoscere il bias
  const ids = Object.keys(BIAS_INFO) as BiasId[];
  const c = await choose(ids.map((b) => BIAS_INFO[b].name + (S.biasSeen.includes(b) ? ' ✓' : '')), { cancel: true, prompt: T('Di quale bias vuoi parlare?'), who: NURSE });
  if (c < 0) return;
  const b = ids[c];
  const [q, right, ...wrong] = BIAS_CURE_Q[b];
  await say([`${BIAS_INFO[b].name}: ${BIAS_INFO[b].effect}`, T('Vediamo se sai riconoscerlo.')], NURSE);
  const opts = shuffle([right, ...wrong]);
  const k = await choose(opts, { prompt: q, who: NURSE });
  if (opts[k] === right) {
    learnBias(b);
    beep('heal');
    await say([T('Esatto. Riconoscere un bias è il primo passo per non farsi guidare da lui.'), T('L\'ho annotato nel tuo Investidex.')], NURSE);
  } else {
    await say(T`Non proprio. La risposta migliore era: "${right}". Riprova quando vuoi.`, NURSE);
  }
}

async function dividends() {
  const payers = S.portfolio.positions.map((p) => ASSET_BY_ID[p.id]).filter((a) => a && a.dividend > 0);
  await say([
    T('I dividendi sono la parte degli utili che un\'azienda distribuisce ai soci. Reinvestirli compra nuove quote, e sulle nuove quote arrivano altri dividendi.'),
    payers.length ? T`Tra i tuoi titoli pagano di solito un dividendo: ${payers.map((a) => T`${a.name} (circa ${(a.dividend * 100).toFixed(1)}% l'anno)`).join(', ')}.` : T('In questo momento non hai titoli che pagano dividendi.'),
    T('In Tradermon i dividendi sono un argomento di teoria: si studiano in Biblioteca e nei duelli, ma nessuna Prova sul conto li richiede. Il conto Paper di Alpaca non li paga, quindi sul conto di gioco non li vedrai arrivare.'),
    T('Nella realtà arrivano in contanti, sono tassati, e reinvestirli è una tua scelta. Un rendimento da dividendo molto alto non è un regalo: spesso è il prezzo che è sceso.'),
  ], NURSE);
}

async function deposit() {
  const pf = S.portfolio;
  const lines = [
    T`Capitale del conto di gioco: ${fmtMoney(pf.initial)}, fissato dalla difficoltà ${DIFFICULTY[S.difficulty].name}. Patrimonio attuale ${fmtMoney(Acc.equity())}.`,
    T('Durante il viaggio non si aggiunge e non si toglie denaro: il conto cambia solo con le tue operazioni e con il mercato. Il capitale è tutto investibile dal primo giorno: le tappe chiedono solo un minimo.'),
    T('È tutto denaro finto del conto Paper di Alpaca: Tradermon è un gioco, non usa mai soldi reali e non ti chiederà mai di versarne.'),
  ];
  if (!Acc.graduated()) { await say([...lines, T('Dopo Wall Street potrai aumentare il capitale del conto di gioco da qui.')], NURSE); return; }
  await say([...lines, T('Sei {Campione|Campionessa}: ora puoi aumentare il capitale del conto di gioco. È sempre denaro finto del conto Paper.')], NURSE);
  const steps = [0.25, 0.5, 1];
  const c = await choose([...steps.map((f) => T`Aggiungi ${fmtMoney(pf.initial * f)}`), T('Niente')], { cancel: true, who: NURSE });
  if (c < 0 || c >= steps.length) return;
  if (!(await requireAccount(T('aumentare il capitale')))) return;
  const r = await Acc.deposit(pf.initial * steps[c]);
  await say(r, NURSE);
}

async function records() {
  await modal(T('Estratto conto'), ({ body, button, close }) => {
    const pf = S.portfolio;
    const log = pf.log.slice().reverse();
    const h = pf.valueHistory;
    const tk = (id: string) => ASSET_BY_ID[id]?.ticker ?? id;
    body.innerHTML = T`<canvas width="640" height="140" style="width:100%;height:140px;border:2px solid #1d1d2b;border-radius:4px;background:#fff"></canvas>
      <p class="small">Risultato realizzato dalle vendite (dentro e fuori dal gioco): <b class="${(pf.realized ?? 0) < 0 ? 'bad' : 'good'}">${(pf.realized ?? 0) < 0 ? '−' : '+'}${fmtMoney(Math.abs(pf.realized ?? 0))}</b> · costi didattici e interessi pagati: <b>${fmtMoney(pf.costs)}</b> · bancarotte: ${pf.bankruptcies}${pf.external.length ? T` · operazioni fuori dal gioco: ${pf.external.length}` : ''}</p>
      ${log.length ? T`<table class="t"><tr><th>Giorno</th><th>Operazione</th><th class="n">Quote</th><th class="n">Prezzo $</th><th class="n">Costo $</th></tr>${log.slice(0, 100).map((l) => `<tr><td>${l.day}</td><td>${l.side === 'buy' ? T('Acquisto') : T('Vendita')} ${l.type} ${tk(l.asset)}</td><td class="n">${fmtQty(l.qty)}</td><td class="n">${fmtPx(l.price)}</td><td class="n">${l.fee.toFixed(2)}</td></tr>`).join('')}</table>` : T('<p class="muted">Nessuna operazione.</p>')}
      ${pf.external.length ? T`<p class="small muted">Fuori dal gioco: ${pf.external.slice(-5).map((e) => `${new Date(e.t).toLocaleDateString(LOCALE)} ${e.asset ? esc(tk(e.asset)) + ' ' : ''}${esc(e.note)}`).join(' · ')}</p>` : ''}
      <p class="small muted">Prezzi di esecuzione reali del conto Alpaca Paper, con denaro finto. Il CSV serve a rileggere le tue operazioni di gioco.</p>`;
    const cv = body.querySelector('canvas') as HTMLCanvasElement;
    const c = cv.getContext('2d')!;
    const lo = Math.min(...h) * 0.98, hi = Math.max(...h) * 1.02;
    c.strokeStyle = '#2f6fd6'; c.lineWidth = 2; c.beginPath();
    h.forEach((v, i) => { const x = (i / Math.max(1, h.length - 1)) * cv.width; const y = cv.height - ((v - lo) / (hi - lo || 1)) * cv.height; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.stroke();
    button(T('Esporta CSV'), () => {
      const rows = [['giorno', 'lato', 'tipo', 'asset', 'quote', 'prezzo', 'costo'], ...pf.log.map((l) => [l.day, l.side, l.type, l.asset, l.qty.toFixed(6), l.price.toFixed(4), l.fee.toFixed(2)])];
      download(T('tradermon-estratto-conto.csv'), rows.map((r) => r.join(';')).join('\n'));
    });
    button(T('Chiudi'), () => close(), 'primary');
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
  return classes().map((c) => (c === 'stocks' ? T('Titoli') : c === 'etf' ? 'ETF' : T('Cripto'))).join(' + ');
}
