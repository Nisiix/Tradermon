import { S, save, slots, hasTech, TECH, classes, card, setBias, profileFromScore } from '../systems/state';
import { unlockedAssets, ASSET_BY_ID, SECTOR_LABEL, SECTOR_COLOR } from '../data/assets';
import { value, weights, health, diagnosis, rebalancePlan, marketBuy, marketSell, placeOrder, allocation, fmtMoney, fmtPx, fmtPct, fmtQty, FEE } from '../systems/portfolio';
import { metrics, CLIMATE_LABEL } from '../systems/market';
import { say, choose, modal, el, esc, toast, bar } from './core';
import { LESSONS } from '../data/lessons';
import { BIAS_CURE_Q, BIAS_INFO } from '../data/events';
import { beep } from '../systems/audio';
import { openAlpacaHub } from './live';
import { questionnaire } from './setup';
import { shuffle } from '../systems/rng';

const NURSE = 'Dott.ssa Ratio';

export function extraUnlocked(): string[] {
  return Object.keys(S.cards);
}

export function tradable() {
  return unlockedAssets(S.track, S.mixedClasses, S.badges, extraUnlocked());
}

export async function openClinic(townIdx: number) {
  await say(['Benvenuto alla Clinica del Portafoglio!', 'Qui curiamo le scelte, non i soldi persi. Come posso aiutarti?'], NURSE);
  for (;;) {
    const opts = [
      'Salva e riposa', 'Check-up', 'Compra / Vendi', 'Ordini aperti', 'Diagnosi', 'Cura: ribilanciamento', 'Riflessione (cura dei bias)',
      'Uova dei dividendi', 'Deposita / Ricarica di prova', 'Cartella clinica', 'Conto Alpaca (paper e reale)', 'Rifai il questionario', 'Arrivederci',
    ];
    const dis = opts.map((o) => (o.startsWith('Ordini aperti') && !hasTech(TECH.LIMIT) && !hasTech(TECH.STOP)) || (o.startsWith('Cura') && !hasTech(TECH.REBAL)) || (o.startsWith('Riflessione') && !S.bias));
    const c = await choose(opts, { cancel: true, title: 'CLINICA DEL PORTAFOGLIO', disabled: dis });
    if (c < 0 || c === opts.length - 1) { await say('Abbi cura del tuo portafoglio!', NURSE); return; }
    switch (opts[c]) {
      case 'Salva e riposa': {
        S.stats.fiducia = 100;
        S.lastClinic = { map: `clinic_${townIdx}`, x: 5, y: 4 };
        beep('heal');
        const ok = save();
        await say([`La tua Fiducia è tornata al massimo.${ok ? ' Partita salvata.' : ' Attenzione: salvataggio non riuscito (spazio del browser?).'}`, S.bias ? `Vedo però un bias attivo: ${BIAS_INFO[S.bias].name}. Ti propongo una breve riflessione.` : 'Torna quando vuoi!'], NURSE);
        break;
      }
      case 'Check-up': await checkup(); break;
      case 'Compra / Vendi': await trade(); break;
      case 'Ordini aperti': await openOrders(); break;
      case 'Diagnosi': await diagnose(); break;
      case 'Cura: ribilanciamento': await rebalance(); break;
      case 'Riflessione (cura dei bias)': await reflect(); break;
      case 'Uova dei dividendi': await eggs(); break;
      case 'Deposita / Ricarica di prova': await deposit(); break;
      case 'Cartella clinica': await records(); break;
      case 'Conto Alpaca (paper e reale)': await openAlpacaHub(); break;
      case 'Rifai il questionario': {
        const sc = await questionnaire();
        S.profileScore = sc;
        S.profile = profileFromScore(sc);
        await say(`Il tuo profilo ora è: ${S.profile.toUpperCase()}. Ricorda: è uno strumento per conoscerti, non una raccomandazione.`, NURSE);
        break;
      }
    }
  }
}

export function checkupHtml(): string {
  const pf = S.portfolio;
  const px = S.market.prices;
  const v = value(pf, px);
  const h = health(pf, px);
  const m = metrics(pf.valueHistory.slice(-250));
  const al = allocation(pf, px);
  const rows = weights(pf, px).sort((a, b) => b.v - a.v).map((w) => {
    const p = pf.positions.find((x) => x.id === w.id)!;
    const a = ASSET_BY_ID[w.id];
    const pl = w.v / p.cost - 1;
    const tired = pl < -0.2 || w.w > 0.4;
    return `<tr><td><span class="card sector" style="background:${SECTOR_COLOR[a.sector]};border:0;padding:2px 4px">${SECTOR_LABEL[a.sector]}</span> ${esc(a.name)} (${a.ticker})${tired ? ' <span class="bad small">affaticata</span>' : ''}</td><td class="n">${fmtQty(p.qty)}</td><td class="n">${fmtPx(px[w.id])}</td><td class="n">${fmtMoney(w.v)}</td><td class="n">${(w.w * 100).toFixed(1)}%</td><td class="n ${pl >= 0 ? 'good' : 'bad'}">${fmtPct(pl)}</td></tr>`;
  }).join('');
  return `
    <div class="grid2">
      <div><b>Valore totale:</b> ${fmtMoney(v)} <span class="${v >= pf.contributed ? 'good' : 'bad'}">(${fmtPct(v / pf.contributed - 1)} sul versato)</span><br>
      <b>Liquidità:</b> ${fmtMoney(pf.cash)} · <b>Slot:</b> ${pf.positions.length}/${slots()}<br>
      <b>Giorno di mercato:</b> ${S.market.day} · <b>Clima:</b> ${CLIMATE_LABEL[S.market.climate]}</div>
      <div><b>Salute: ${h.state}</b> (${h.score}/100)${bar(h.score)}
      <span class="small">Peso massimo ${h.maxW.toFixed(0)}% · drawdown ${h.dd.toFixed(1)}% · settori ${h.sectors}</span></div>
    </div>
    <p class="small"><b>Allocazione</b> rischiosi ${al.risky.toFixed(0)}% · difensivi ${al.defensive.toFixed(0)}% · liquidità ${al.cash.toFixed(0)}% — <span class="muted">obiettivo ${pf.target.risky}/${pf.target.defensive}/${pf.target.cash}</span><br>
    <b>Ultimi 250 giorni</b> rendimento ${fmtPct(m.ret)} · volatilità ${(m.vol * 100).toFixed(1)}% · Sharpe ${m.sharpe.toFixed(2)} · max drawdown −${(m.mdd * 100).toFixed(1)}%</p>
    ${rows ? `<table class="t"><tr><th>Asset</th><th class="n">Quote</th><th class="n">Prezzo</th><th class="n">Valore</th><th class="n">Peso</th><th class="n">P&amp;L</th></tr>${rows}</table>` : '<p class="muted">Nessuna posizione. Usa "Compra / Vendi" per il primo investimento.</p>'}
    <p class="small muted">Mercato simulato della Borsa di Capitalia: asset di fantasia a scopo didattico.</p>`;
}

async function checkup() {
  await modal('Check-up del portafoglio', ({ body, button, close }) => {
    body.innerHTML = checkupHtml();
    button('Chiudi', () => close(), 'primary');
  });
}

export async function trade(guided = false) {
  await modal('Compra / Vendi (conto di prova)', ({ body, button, close }) => {
    const render = (msg = '') => {
      const px = S.market.prices;
      const list = tradable();
      const v = value(S.portfolio, px);
      body.innerHTML = `${msg ? `<p class="${msg.startsWith('!') ? 'bad' : 'good'}">${esc(msg.replace(/^!/, ''))}</p>` : ''}
        <p class="small">Liquidità <b>${fmtMoney(S.portfolio.cash)}</b> · valore ${fmtMoney(v)} · slot ${S.portfolio.positions.length}/${slots()} · costo ${FEE} Cr per ordine + spread.${guided ? ' <b>Suggerimento:</b> per il primo acquisto investi una parte, non tutto.' : ''}</p>`;
      const tbl = el('table', 't');
      tbl.innerHTML = '<tr><th>Asset</th><th class="n">Prezzo</th><th class="n">30 gg</th><th class="n">Possiedi</th><th></th></tr>';
      for (const a of list) {
        const h = S.market.history[a.id];
        const p30 = h[Math.max(0, h.length - 22)];
        const pos = S.portfolio.positions.find((p) => p.id === a.id);
        const tr = el('tr');
        tr.innerHTML = `<td><span class="card sector" style="background:${SECTOR_COLOR[a.sector]};border:0;padding:2px 4px">${SECTOR_LABEL[a.sector]}</span> <b>${esc(a.ticker)}</b> ${esc(a.name)} <span class="small muted">rischio ${'★'.repeat(a.risk)}</span></td><td class="n">${fmtPx(px[a.id])}</td><td class="n ${px[a.id] >= p30 ? 'good' : 'bad'}">${fmtPct(px[a.id] / p30 - 1)}</td><td class="n">${pos ? fmtMoney(pos.qty * px[a.id]) : '—'}</td>`;
        const td = el('td');
        const inp = el('input', 'tx') as HTMLInputElement;
        inp.type = 'number'; inp.min = '0'; inp.placeholder = 'Cr'; inp.style.width = '90px'; inp.style.fontSize = '18px';
        inp.value = String(Math.max(0, Math.round(Math.min(S.portfolio.cash, v * 0.15))));
        const b = el('button', 'btn', 'Compra');
        b.addEventListener('click', () => {
          const amt = Number(inp.value);
          if (!summaryOk(a.id, amt)) return;
          const r = marketBuy(S.portfolio, a.id, amt, px, S.market.day, slots());
          if (r.ok) { card(a.id).xp += 3; beep('coin'); S.flags.firstBuy = true; }
          render(r.ok ? r.msg : '!' + r.msg);
        });
        td.append(inp, b);
        if (pos) {
          const s = el('button', 'btn', 'Vendi');
          s.addEventListener('click', () => {
            const amt = Number(inp.value);
            const qty = amt > 0 ? Math.min(pos.qty, amt / px[a.id]) : pos.qty;
            const r = marketSell(S.portfolio, a.id, qty, px, S.market.day);
            render(r.ok ? r.msg : '!' + r.msg);
          });
          td.append(s);
          if (hasTech(TECH.STOP)) {
            const st = el('button', 'btn', 'Stop −10%');
            st.addEventListener('click', () => { placeOrder(S.portfolio, { asset: a.id, side: 'sell', type: 'stop', qty: pos.qty, price: px[a.id] * 0.9, createdDay: S.market.day }); render(`Stop loss a ${fmtPx(px[a.id] * 0.9)} inserito.`); });
            td.append(st);
          }
        }
        if (hasTech(TECH.LIMIT)) {
          const lb = el('button', 'btn', 'Limite −3%');
          lb.addEventListener('click', () => {
            const amt = Number(inp.value);
            if (amt > S.portfolio.cash) return render('!Liquidità insufficiente.');
            placeOrder(S.portfolio, { asset: a.id, side: 'buy', type: 'limit', qty: (amt - FEE) / (px[a.id] * 0.97), price: px[a.id] * 0.97, createdDay: S.market.day });
            render(`Ordine limite a ${fmtPx(px[a.id] * 0.97)} inserito: si esegue se il prezzo scende fin lì.`);
          });
          td.append(lb);
        }
        tr.appendChild(td);
        tbl.appendChild(tr);
      }
      body.appendChild(tbl);
      body.appendChild(el('p', 'small muted', 'Riepilogo prima di ogni acquisto: l\'importo comprende la commissione; il prezzo include metà spread. Il mercato avanza mentre esplori (1 giorno ogni 60 passi sui percorsi e a ogni sfida).'));
    };
    const summaryOk = (id: string, amt: number) => {
      const a = ASSET_BY_ID[id];
      const v = value(S.portfolio, S.market.prices);
      if (amt > v * 0.5 && !window.confirm(`Riepilogo: stai per investire ${fmtMoney(amt)} in ${a.name}, cioè il ${((amt / v) * 100).toFixed(0)}% del portafoglio in un solo asset (rischio ${a.risk}/5). Confermi?`)) return false;
      return true;
    };
    render();
    button('Chiudi', () => close(), 'primary');
  }, { wide: true });
}

async function openOrders() {
  await modal('Ordini aperti', ({ body, button, close }) => {
    const render = () => {
      const o = S.portfolio.orders;
      body.innerHTML = o.length ? '' : '<p class="muted">Nessun ordine in attesa.</p>';
      o.forEach((x) => {
        const r = el('div', 'row', `${x.side === 'buy' ? 'Acquisto' : 'Vendita'} ${x.type === 'limit' ? 'limite' : 'stop'} · ${ASSET_BY_ID[x.asset].ticker} · ${fmtQty(x.qty)} @ ${fmtPx(x.price)} (giorno ${x.createdDay})`);
        const b = el('button', 'btn', 'Annulla');
        b.addEventListener('click', () => { S.portfolio.orders = S.portfolio.orders.filter((y) => y !== x); render(); });
        r.appendChild(b);
        body.appendChild(r);
      });
    };
    render();
    button('Chiudi', () => close(), 'primary');
  });
}

async function diagnose() {
  const d = diagnosis(S.portfolio, S.market.prices, S.market.day);
  await say(d.map((x) => x.text), NURSE);
  const lessons = d.filter((x) => x.lesson).map((x) => LESSONS.find((l) => l.id === x.lesson)!).filter(Boolean);
  if (lessons.length) {
    const c = await choose([...lessons.map((l) => `Leggi: ${l.title}`), 'No, grazie'], { cancel: true, prompt: 'Vuoi ripassare la lezione collegata?', who: NURSE });
    if (c >= 0 && c < lessons.length) await say(lessons[c].body, lessons[c].title);
  }
}

async function rebalance() {
  const plan = rebalancePlan(S.portfolio, S.market.prices);
  if (!plan.length) { await say('Il portafoglio è già vicino al tuo obiettivo. Nessuna cura necessaria!', NURSE); return; }
  await say(['Ecco la cura che propongo per tornare alla tua allocazione obiettivo.', 'Confermerai tu ogni singolo ordine: io propongo, non eseguo da sola.'], NURSE);
  for (const p of plan) {
    const a = ASSET_BY_ID[p.id];
    const ok = (await choose(['Conferma', 'Salta'], { prompt: `${p.side === 'buy' ? 'Comprare' : 'Vendere'} circa ${fmtMoney(p.amount)} di ${a.name}?`, who: NURSE })) === 0;
    if (!ok) continue;
    const px = S.market.prices;
    const r = p.side === 'buy' ? marketBuy(S.portfolio, p.id, Math.min(p.amount, S.portfolio.cash), px, S.market.day, slots(), 'ribilanciamento') : marketSell(S.portfolio, p.id, p.amount / px[p.id], px, S.market.day, 'ribilanciamento');
    toast(r.msg);
  }
  S.stats.disciplina = Math.min(100, S.stats.disciplina + 3);
}

async function reflect() {
  if (!S.bias) return;
  const b = S.bias;
  const [q, right, ...wrong] = BIAS_CURE_Q[b];
  await say([`Il bias "${BIAS_INFO[b].name}" ti sta condizionando: ${BIAS_INFO[b].effect}`, 'Fermiamoci un momento a riflettere.'], NURSE);
  const opts = shuffle([right, ...wrong]);
  const c = await choose(opts, { prompt: q, who: NURSE });
  if (opts[c] === right) {
    setBias(null);
    beep('heal');
    await say(['Esatto. La consapevolezza è la cura migliore.', 'Il bias è sparito.'], NURSE);
  } else {
    await say('Non proprio. Riprova quando vuoi: non c\'è fretta.', NURSE);
  }
}

async function eggs() {
  const e = S.portfolio.eggs;
  if (!e.length) { await say(['Nessun uovo in incubazione.', 'Quando un asset paga un dividendo e il reinvestimento è attivo, compare un uovo che si schiude in nuove quote.', `Reinvestimento automatico: ${S.portfolio.drip ? 'ATTIVO' : 'DISATTIVO'}.`], NURSE); }
  else await say(e.map((x) => `Uovo di ${ASSET_BY_ID[x.asset].name}: ${fmtMoney(x.amount)} di dividendi, si schiude tra ${Math.max(0, x.hatchDay - S.market.day)} giorni di mercato.`), NURSE);
  const c = await choose([S.portfolio.drip ? 'Disattiva reinvestimento' : 'Attiva reinvestimento', 'Lascia così'], { cancel: true });
  if (c === 0) S.portfolio.drip = !S.portfolio.drip;
}

async function deposit() {
  const pf = S.portfolio;
  const v = value(pf, S.market.prices);
  const can = pf.refillsUsed < S.badges + 1 && v < pf.initial;
  await say([`Valore attuale ${fmtMoney(v)}. Capitale iniziale ${fmtMoney(pf.initial)}.`, `Ricariche di prova usate: ${pf.refillsUsed}. Ne hai una per ogni regione (Medaglie + 1).`, 'I depositi e prelievi reali si fanno solo sul sito di Alpaca: dalla voce "Conto Alpaca" ti mostro il saldo e apro la pagina giusta.'], NURSE);
  if (!can) { await say(v >= pf.initial ? 'Il portafoglio vale più del capitale iniziale: nessuna ricarica necessaria.' : 'Hai già usato la ricarica di questa regione.', NURSE); return; }
  const ok = (await choose(['Sì, ricarica', 'No'], { prompt: 'Vuoi riportare il conto di prova al capitale iniziale? Costa il 10% della Reputazione.', who: NURSE })) === 0;
  if (!ok) return;
  pf.cash += pf.initial - v;
  pf.contributed += pf.initial - v;
  pf.refillsUsed++;
  S.stats.reputazione = Math.round(S.stats.reputazione * 0.9);
  await say('Fatto. Le perdite però restano una lezione: guardale nella Cartella clinica.', NURSE);
}

async function records() {
  await modal('Cartella clinica', ({ body, button, close }) => {
    const log = S.portfolio.log.slice().reverse();
    const h = S.portfolio.valueHistory;
    body.innerHTML = `<canvas width="640" height="140" style="width:100%;height:140px;border:2px solid #1d1d2b;border-radius:4px;background:#fff"></canvas>
      ${log.length ? `<table class="t"><tr><th>Giorno</th><th>Operazione</th><th class="n">Quote</th><th class="n">Prezzo</th><th class="n">Costo</th></tr>${log.slice(0, 100).map((l) => `<tr><td>${l.day}</td><td>${l.side === 'buy' ? 'Acquisto' : 'Vendita'} ${l.type} ${ASSET_BY_ID[l.asset].ticker}</td><td class="n">${fmtQty(l.qty)}</td><td class="n">${fmtPx(l.price)}</td><td class="n">${l.fee.toFixed(2)}</td></tr>`).join('')}</table>` : '<p class="muted">Nessuna operazione.</p>'}
      <p class="small muted">Nota fiscale: con un broker estero come Alpaca chi risiede in Italia deve dichiarare conto e redditi (quadri RW e RT). Il CSV è un aiuto per il tuo commercialista, non una consulenza fiscale.</p>`;
    const cv = body.querySelector('canvas') as HTMLCanvasElement;
    const c = cv.getContext('2d')!;
    const lo = Math.min(...h) * 0.98, hi = Math.max(...h) * 1.02;
    c.strokeStyle = '#2f6fd6'; c.lineWidth = 2; c.beginPath();
    h.forEach((v, i) => { const x = (i / Math.max(1, h.length - 1)) * cv.width; const y = cv.height - ((v - lo) / (hi - lo || 1)) * cv.height; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.stroke();
    button('Esporta CSV', () => {
      const rows = [['giorno', 'lato', 'tipo', 'asset', 'quote', 'prezzo', 'costo'], ...S.portfolio.log.map((l) => [l.day, l.side, l.type, l.asset, l.qty.toFixed(6), l.price.toFixed(4), l.fee.toFixed(2)])];
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
