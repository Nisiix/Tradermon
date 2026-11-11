import type { AssetClass, AssetDef } from '../types';
import { processReview, type Replay, type SimMission, type SimResult } from '../data/missions';
import { metrics } from '../systems/market';
import { loadWindow } from '../systems/realdata';
import { ASSETS, ASSET_BY_ID, SECTOR_LABEL, SECTOR_COLOR, anonymous } from '../data/assets';
import { shuffle } from '../systems/rng';
import { type Book, marketBuy, marketSell, placeOrder, processOrders, value, weights, fmtPx, fmtMoney, fmtPct, fmtQty, spreadOf } from '../systems/portfolio';
import { S, hasTech, TECH, classes } from '../systems/state';
import { DIFFICULTY, LEVERAGE } from '../systems/balance';
import { checkLink } from '../systems/account';
import { el, esc, modal, toast, say } from './core';
import { beep } from '../systems/audio';

export interface SimOpts {
  mission?: SimMission;
  scenario?: Replay;
  capital?: number;
  monthly?: number;
  dividends?: boolean;
  /** Serie già pronte (un simbolo reale scelto dal giocatore): niente anonimato, è lui ad aver scelto cosa guardare. */
  custom?: { assets: AssetDef[]; prices: Record<string, number[]>; labels?: string[] };
  sandbox?: boolean;
  /** Classi di attivo da usare al posto di quelle del percorso (duello con codice, crisi leggendarie). */
  classes?: AssetClass[];
}

export type SimOutcome = (SimResult & { ok: boolean; detail: string }) | null;

interface SimData { assets: AssetDef[]; real: AssetDef[]; prices: Record<string, number[]>; dates: string[]; anon: boolean }

/**
 * Prepara i dati del replay: chiusure giornaliere REALI del periodo, scaricate da Alpaca con le chiavi del
 * giocatore. Senza conto collegato il replay non parte: il gioco non genera prezzi.
 */
async function loadSim(o: SimOpts): Promise<SimData | string> {
  if (o.custom) {
    const n = Math.min(...Object.values(o.custom.prices).map((p) => p.length));
    return { assets: o.custom.assets, real: o.custom.assets, prices: o.custom.prices, dates: o.custom.labels ?? Array.from({ length: n }, () => ''), anon: false };
  }
  const sc = o.mission?.scenario ?? o.scenario!;
  const link = await checkLink();
  if (!link.server) return link.reason;
  if (!link.paper && !link.live) return 'La Macchina del Tempo usa solo dati reali di mercato: collega il conto Alpaca Paper dal menu, voce "Chiavi API".';
  const cls = o.classes ?? classes();
  try {
    const w = await loadWindow(sc.window, ASSETS.filter((a) => cls.includes(a.cls)));
    // prezzi a base 100 e nomi nascosti: il prezzo vero rivelerebbe il periodo, e quindi il finale
    const prices: Record<string, number[]> = {};
    for (const a of w.assets) { const p0 = w.prices[a.id][0]; prices[a.id] = w.prices[a.id].map((v) => (v / p0) * 100); }
    // a ogni tentativo l'ordine delle righe e le lettere ("Tecnologia A", "Tecnologia B") cambiano: chi rigioca non può
    // affidarsi alla memoria di quale riga è salita
    const real = shuffle(w.assets);
    return { assets: anonymous(real), real, prices, dates: w.dates, anon: true };
  } catch (e) {
    return `Non riesco a scaricare i dati reali di questo periodo: ${(e as Error).message}`;
  }
}

export async function runSim(o: SimOpts): Promise<SimOutcome> {
  const data = await loadSim(o);
  if (typeof data === 'string') { await say([data, 'Nessun prezzo viene inventato: riprova quando il conto è raggiungibile.'], 'Macchina del Tempo'); return null; }
  return simModal(o, data);
}

function simModal(o: SimOpts, data: SimData): Promise<SimOutcome> {
  const sc: Replay = o.mission?.scenario ?? o.scenario ?? { id: 'real', name: '', desc: '', window: { start: '', end: '' } };
  const assets = data.assets;
  const defs = Object.fromEntries(assets.map((a) => [a.id, a]));
  const series = { prices: data.prices };
  const days = Math.min(...Object.values(data.prices).map((p) => p.length)) - 1;
  const capital = o.capital ?? o.mission?.capital ?? 10000;
  const monthly = o.monthly ?? o.mission?.monthly ?? sc.monthly ?? 0;
  const dividends = (o.dividends ?? o.mission?.dividends ?? true) && assets.some((a) => a.dividend > 0);
  const mid = o.mission?.id ?? '';
  const feeRate = DIFFICULTY[S.difficulty].fee;
  const canLimit = hasTech(TECH.LIMIT) || mid === 'm2' || o.sandbox;
  const canStop = hasTech(TECH.STOP) || mid === 'm8' || o.sandbox;
  const canPac = hasTech(TECH.PAC) || mid === 'm4' || o.sandbox || monthly > 0;
  // leva nei replay: solo dopo l'Esame della Leva, solo su azioni ed ETF (Alpaca non la concede sulle cripto)
  const levMax = S.levExam ? DIFFICULTY[S.difficulty].replayLeverage : 1;
  let useLev = false;
  let liquidations = 0;
  const newsMap = new Map<number, string>();
  for (const n of sc.news ?? []) {
    const i = data.dates.findIndex((d) => d >= n.date);
    if (i > 0 && data.dates[0] <= n.date) newsMap.set(i, n.text);
  }

  const book: Book = { cash: capital, positions: [], orders: [], log: [] };
  let lossSales = 0;
  let day = 0;
  let contributed = capital;
  let monthsBought = new Set<number>();
  let dripShares = 0;
  let boughtShares = 0;
  let pacCash = 0;
  const values: number[] = [capital];
  const prices = () => Object.fromEntries(assets.map((a) => [a.id, series.prices[a.id][day]]));
  let selected = assets[0].id;
  let speed = 0; // 0 pausa
  let timer = 0;
  const slotsMax = 10;
  const credit = () => (useLev && levMax > 1 && defs[selected].cls !== 'crypto' ? Math.max(0, value(book, prices()) * (levMax - 1) + Math.min(0, book.cash)) : 0);

  return modal<SimOutcome>(o.mission ? `Macchina del Tempo · ${o.mission.title}` : `Zona Simulazione · ${sc.name || assets[0].ticker}`, ({ body, foot, close, button }) => {
    body.innerHTML = `
      <div class="small" style="margin-bottom:6px">${esc(o.mission?.brief ?? sc.desc)}${sc.historical ? ` <span class="muted">(Riferimento: ${esc(sc.historical)})</span>` : ''}${data.anon ? ' <span class="muted">Prezzi reali del periodo, a base 100; i nomi dei titoli sono nascosti fino alla fine.</span>' : ''}</div>
      <div class="tm">
        <div>
          <canvas width="640" height="220"></canvas>
          <div class="news"></div>
          <div class="kpi">
            <div><b>Giorno</b><span class="k-day"></span></div>
            <div><b>Valore</b><span class="k-val"></span></div>
            <div><b>Liquidità</b><span class="k-cash"></span></div>
            <div><b>Max drawdown</b><span class="k-dd"></span></div>
          </div>
          <div class="row" style="margin-top:8px">
            <button class="btn sp" data-s="0">⏸</button><button class="btn sp" data-s="1">▶ 1×</button><button class="btn sp" data-s="4">▶▶ 4×</button><button class="btn sp" data-s="16">▶▶▶ 16×</button>
            <span class="muted small">Le operazioni si fanno anche in pausa.</span>
          </div>
        </div>
        <div>
          <div class="assets"></div>
          <div class="box" style="padding:8px;margin-top:6px">
            <div class="small sel-info"></div>
            <div class="row" style="margin-top:4px"><input class="tx amt" type="number" min="0" step="10" placeholder="Importo $" style="width:110px"><button class="btn buy">Compra</button></div>
            <div class="row" style="margin-top:4px"><button class="btn s25">Vendi 25%</button><button class="btn s50">50%</button><button class="btn s100">Tutto</button></div>
            <div class="row advp" style="margin-top:4px;display:none"><input class="tx lpx" type="number" min="0" step="any" placeholder="Prezzo ordine" style="width:130px"><span class="small muted">per limite/stop</span></div>
            <div class="row adv" style="margin-top:4px"></div>
            <label class="small levrow" style="display:none;margin-top:4px"><input type="checkbox" class="lev"> Usa la leva (fino a ${levMax}×, interesse ${(LEVERAGE.interest * 100).toFixed(1)}% annuo, liquidazione sotto il ${Math.round(LEVERAGE.maintenance * 100)}% di margine)</label>
            <div class="small orders"></div>
          </div>
        </div>
      </div>
      <div class="small muted" style="margin-top:6px">Costi: ${feeRate ? `${(feeRate * 100).toFixed(2).replace('.', ',')}% per ordine (difficoltà ${DIFFICULTY[S.difficulty].name}) + ` : ''}spread stimato (0,1%, cripto 0,5%). ${monthly ? `Versamento mensile: ${monthly} $ ogni 21 giorni di mercato.` : ''} ${dividends ? 'Dividendi stimati dal rendimento medio del titolo, pagati ogni mese e reinvestiti.' : ''}</div>`;
    const $ = (s: string) => body.querySelector(s) as HTMLElement;
    const cv = body.querySelector('canvas') as HTMLCanvasElement;
    const amt = $('.amt') as HTMLInputElement;
    amt.value = String(Math.round(capital / 4));

    const adv = $('.adv');
    const lpx = $('.lpx') as HTMLInputElement;
    if (canLimit || canStop) ($('.advp') as HTMLElement).style.display = '';
    if (levMax > 1) { ($('.levrow') as HTMLElement).style.display = ''; ($('.lev') as HTMLInputElement).addEventListener('change', (e) => { useLev = (e.target as HTMLInputElement).checked; draw(); }); }
    const priceOr = (def: number) => { const v = Number(lpx.value); return v > 0 ? v : def; };
    if (canLimit) {
      const lb = el('button', 'btn', 'Limite acquisto');
      lb.addEventListener('click', () => {
        const p = prices()[selected];
        const lp = priceOr(p * 0.97);
        const a = Number(amt.value);
        if (!lp || !a) return;
        if (a > book.cash) return toast('Liquidità insufficiente.');
        placeOrder(book, { asset: selected, side: 'buy', type: 'limit', qty: (a * (1 - feeRate)) / lp, price: lp, createdDay: day });
        toast(`Ordine limite di acquisto a ${fmtPx(lp)} inserito.`);
        draw();
      });
      const ls = el('button', 'btn', 'Limite vendita');
      ls.addEventListener('click', () => {
        const pos = book.positions.find((x) => x.id === selected);
        if (!pos) return toast('Non possiedi questo asset.');
        const p = prices()[selected];
        const lp = priceOr(p * 1.05);
        if (!lp) return;
        placeOrder(book, { asset: selected, side: 'sell', type: 'limit', qty: pos.qty, price: lp, createdDay: day });
        toast(`Ordine limite di vendita a ${fmtPx(lp)} inserito.`);
        draw();
      });
      adv.append(lb, ls);
    }
    if (canStop) {
      const sb = el('button', 'btn', 'Stop loss');
      sb.addEventListener('click', () => {
        const pos = book.positions.find((x) => x.id === selected);
        if (!pos) return toast('Non possiedi questo asset.');
        const p = prices()[selected];
        const sp = priceOr(p * 0.9);
        if (sp >= p) return toast('Lo stop di vendita va messo sotto il prezzo attuale.');
        if (!sp) return;
        placeOrder(book, { asset: selected, side: 'sell', type: 'stop', qty: pos.qty, price: sp, createdDay: day });
        toast(`Stop loss a ${fmtPx(sp)} inserito.`);
        draw();
      });
      adv.append(sb);
    }
    if (canPac && monthly > 0) {
      const pb = el('button', 'btn', 'Acquisto mensile');
      pb.title = 'Investe il versamento mensile disponibile nell\'asset selezionato';
      pb.addEventListener('click', () => {
        const a = Math.min(book.cash, Math.max(pacCash, monthly));
        if (a < 1) return toast('Nessun versamento da investire.');
        doBuy(a, 'pac');
        pacCash = 0;
      });
      adv.append(pb);
    }

    const tick = (id: string) => assets.find((a) => a.id === id)!.ticker;

    const doBuy = (a: number, type = 'mercato') => {
      const r = marketBuy(book, selected, a, prices(), day, slotsMax, type, defs, feeRate, credit());
      toast(r.msg);
      if (r.ok) { boughtShares += r.qty ?? 0; monthsBought.add(Math.floor(day / 21)); beep('coin'); }
      draw();
    };
    $('.buy').addEventListener('click', () => doBuy(Number(amt.value)));
    const sell = (f: number) => {
      const pos = book.positions.find((x) => x.id === selected);
      if (!pos) return toast('Non possiedi questo asset.');
      const r = marketSell(book, selected, pos.qty * f, prices(), day, 'mercato', defs, feeRate);
      if (r.ok && r.atLoss) lossSales++;
      toast(r.msg);
      draw();
    };
    $('.s25').addEventListener('click', () => sell(0.25));
    $('.s50').addEventListener('click', () => sell(0.5));
    $('.s100').addEventListener('click', () => sell(1));
    body.querySelectorAll('.sp').forEach((b) => b.addEventListener('click', () => setSpeed(Number((b as HTMLElement).dataset.s))));

    const setSpeed = (s: number) => {
      speed = s;
      clearInterval(timer);
      body.querySelectorAll('.sp').forEach((b) => b.classList.toggle('sel', Number((b as HTMLElement).dataset.s) === s));
      if (s > 0) timer = window.setInterval(step, s === 1 ? 260 : s === 4 ? 70 : 18);
    };

    const step = () => {
      if (day >= days) { setSpeed(0); finish(); return; }
      day++;
      const px = prices();
      for (const m of processOrders(book, px, day, slotsMax, defs, feeRate)) { toast(m); if (m.includes('limite eseguito') && m.includes('Comprate')) limitFills++; if (m.includes('Comprate')) monthsBought.add(Math.floor(day / 21)); }
      if (day % 21 === 0) {
        if (monthly) { book.cash += monthly; contributed += monthly; pacCash += monthly; }
        if (dividends) {
          for (const p of book.positions) {
            const a = assets.find((x) => x.id === p.id)!;
            if (a.dividend > 0) { const q = (p.qty * px[p.id] * a.dividend) / 12 / px[p.id]; p.qty += q; dripShares += q; }
          }
        }
      }
      // leva: interesse giornaliero sul prestito e liquidazione forzata sotto il margine di mantenimento
      if (book.cash < 0) {
        book.cash *= 1 + LEVERAGE.interest / 252;
        const pv = book.positions.reduce((s2, p) => s2 + p.qty * px[p.id], 0);
        if (pv > 0 && (pv + book.cash) / pv < LEVERAGE.maintenance) {
          for (const p of book.positions.slice()) marketSell(book, p.id, p.qty, px, day, 'liquidazione', defs, feeRate);
          liquidations++;
          $('.news').textContent = `⚠ Giorno ${day}: margine sotto il ${Math.round(LEVERAGE.maintenance * 100)}%. Il broker ha venduto tutto senza chiedere: è la liquidazione forzata.`;
          beep('alert'); if (speed > 1) setSpeed(1);
        }
      }
      const n = newsMap.get(day);
      if (n) { $('.news').textContent = `📰 Giorno ${day}: ${n}`; beep('alert'); if (speed > 1) setSpeed(1); }
      values.push(value(book, px));
      draw();
    };
    let limitFills = 0;

    const draw = () => {
      const px = prices();
      const v = value(book, px);
      const m = metrics(values);
      $('.k-day').textContent = `${day}/${days}`;
      $('.k-val').innerHTML = `${fmtMoney(v)} <span class="${v >= contributed ? 'good' : 'bad'}">${fmtPct(v / contributed - 1)}</span>`;
      $('.k-cash').textContent = book.cash < 0 ? `prestito ${fmtMoney(-book.cash)}` : fmtMoney(book.cash);
      $('.k-dd').textContent = `−${(m.mdd * 100).toFixed(1)}%`;
      const list = $('.assets');
      list.innerHTML = '';
      for (const a of assets) {
        const p0 = series.prices[a.id][0];
        const p = px[a.id];
        const pos = book.positions.find((x) => x.id === a.id);
        const row = el('div', 'a' + (a.id === selected ? ' sel' : ''), `<span><span class="sector" style="background:${SECTOR_COLOR[a.sector]};font-size:calc(var(--fs) * .8);padding:1px 3px;color:#fff;border-radius:2px">${SECTOR_LABEL[a.sector].slice(0, 4)}</span> ${esc(a.ticker)}${pos ? ' ●' : ''}</span><span>${fmtPx(p)} <span class="${p >= p0 ? 'good' : 'bad'} small">${fmtPct(p / p0 - 1, 0)}</span></span>`);
        row.addEventListener('click', () => { selected = a.id; draw(); });
        list.appendChild(row);
      }
      const sa = assets.find((a) => a.id === selected)!;
      const pos = book.positions.find((x) => x.id === selected);
      const w = weights(book, px).find((x) => x.id === selected);
      $('.sel-info').innerHTML = `<b>${esc(sa.name)}</b> · ${SECTOR_LABEL[sa.sector]} · rischio ${'★'.repeat(sa.risk)}${sa.dividend ? ` · div. ${(sa.dividend * 100).toFixed(1)}%` : ''}<br>${pos ? `Possiedi ${fmtQty(pos.qty)} (${((w?.w ?? 0) * 100).toFixed(0)}% del portafoglio)` : 'Non in portafoglio'} · spread ${(spreadOf(sa) * 100).toFixed(1)}%`;
      $('.orders').innerHTML = book.orders.length ? 'Ordini aperti: ' + book.orders.map((o) => `${o.side === 'buy' ? 'Acq.' : 'Vend.'} ${o.type} ${tick(o.asset)} @ ${fmtPx(o.price)}`).join(' · ') : '';
      // grafico
      const c = cv.getContext('2d')!;
      c.clearRect(0, 0, cv.width, cv.height);
      const ser = series.prices[selected].slice(0, day + 1);
      const pv = values.map((x) => x / values[0]);
      const sv = ser.map((x) => x / ser[0]);
      const all = [...pv, ...sv];
      const lo = Math.min(...all) * 0.98;
      const hi = Math.max(...all) * 1.02;
      const X = (i: number) => 30 + (i / Math.max(1, days)) * (cv.width - 40);
      const Y = (y: number) => cv.height - 18 - ((y - lo) / (hi - lo || 1)) * (cv.height - 30);
      c.strokeStyle = '#ddd'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(30, Y(1)); c.lineTo(cv.width - 10, Y(1)); c.stroke();
      c.font = '12px monospace'; c.fillStyle = '#666';
      c.fillText(fmtPct(hi - 1, 0), 2, 14); c.fillText(fmtPct(lo - 1, 0), 2, cv.height - 20);
      const line = (arr: number[], col: string, wdt: number) => { c.strokeStyle = col; c.lineWidth = wdt; c.beginPath(); arr.forEach((y, i) => (i ? c.lineTo(X(i), Y(y)) : c.moveTo(X(i), Y(y)))); c.stroke(); };
      line(sv, SECTOR_COLOR[sa.sector], 1.5);
      line(pv, '#1d1d2b', 2.5);
      c.fillStyle = '#1d1d2b'; c.fillText('— Il tuo portafoglio', 40, cv.height - 4);
      c.fillStyle = SECTOR_COLOR[sa.sector]; c.fillText(`— ${sa.ticker}`, 220, cv.height - 4);
    };

    const finish = () => {
      clearInterval(timer);
      const px = prices();
      const m = metrics(values);
      const fv = value(book, px);
      const ws = weights(book, px);
      const fees = book.log.reduce((s, l) => s + l.fee, 0);
      const res: SimResult = {
        values, ret: m.ret, vol: m.vol, sharpe: m.sharpe, mdd: m.mdd, orders: book.log.length, limitFills, monthlyBuys: monthsBought.size, fees, contributed, lossSales,
        sectors: new Set(book.positions.map((p) => assets.find((a) => a.id === p.id)!.sector)).size, sectorsAvail: new Set(assets.map((a) => a.sector)).size, maxW: ws.reduce((x, y) => Math.max(x, y.w), 0),
        investedW: fv > 0 ? Math.min(1, 1 - Math.max(0, book.cash) / fv) : 0, finalValue: fv, startValue: contributed, dripShareGrowth: boughtShares > 0 ? dripShares / boughtShares : 0,
      };
      const chk = o.mission ? o.mission.check(res) : { ok: true, detail: '' };
      beep(chk.ok ? 'win' : 'lose');
      body.innerHTML = `
        <h3 style="margin:0 0 6px">${o.mission ? (chk.ok ? '<span class="good">Missione superata!</span>' : '<span class="bad">Missione non superata</span>') : 'Simulazione conclusa'}</h3>
        ${o.mission ? `<p>${esc(chk.detail)}</p>` : ''}
        <table class="t">
          <tr><th>Metrica</th><th class="n">Valore</th></tr>
          <tr><td>Rendimento totale</td><td class="n">${fmtPct(res.ret)}</td></tr>
          <tr><td>Volatilità annualizzata</td><td class="n">${(res.vol * 100).toFixed(1)}%</td></tr>
          <tr><td>Indice di Sharpe (tasso privo di rischio 0)</td><td class="n">${res.sharpe.toFixed(2)}</td></tr>
          <tr><td>Massimo drawdown</td><td class="n">−${(res.mdd * 100).toFixed(1)}%</td></tr>
          <tr><td>Ordini / costi totali</td><td class="n">${res.orders} / ${fmtMoney(res.fees)}</td></tr>
          <tr><td>Settori a fine periodo / peso massimo</td><td class="n">${res.sectors} / ${(res.maxW * 100).toFixed(0)}%</td></tr>
          <tr><td>Valore finale / versato</td><td class="n">${fmtMoney(res.finalValue)} / ${fmtMoney(res.contributed)}</td></tr>
        </table>
        ${o.mission ? (() => { const pr = processReview(res); return `<p><b>Processo: ${'★'.repeat(pr.stars)}${'☆'.repeat(3 - pr.stars)}</b></p><ul class="small" style="margin:0 0 6px;padding-left:18px">${pr.notes.map((n) => `<li class="${n.ok ? 'good' : 'bad'}">${esc(n.text)}</li>`).join('')}</ul>`; })() : ''}
        ${liquidations ? `<p class="bad small">Liquidazioni forzate subite: ${liquidations}. Con la leva un ribasso normale diventa una perdita definitiva.</p>` : ''}
        ${data.anon && o.mission && !chk.ok ? '<div class="box small" style="padding:8px;margin:6px 0"><b>Periodo e nomi restano coperti.</b> Li scoprirai quando superi la prova: così, se riprovi, giudichi di nuovo senza sapere come va a finire. Le righe cambiano ordine e lettera a ogni tentativo.</div>' : ''}
        ${data.anon && (!o.mission || chk.ok) ? `<div class="box small" style="padding:8px;margin:6px 0"><b>Ora si può dire.</b> Era il periodo reale dal ${fmtDate(data.dates[0])} al ${fmtDate(data.dates[data.dates.length - 1])}.<br>${assets.map((a, i) => `${esc(a.name)} = <b>${esc(data.real[i].name)}</b> (${esc(data.real[i].ticker)}) ${fmtPct(series.prices[a.id][days] / series.prices[a.id][0] - 1, 0)}`).join(' · ')}<br><span class="muted">Dati di mercato Alpaca. I rendimenti passati non dicono nulla di quelli futuri.</span></div>` : ''}
        <p class="small muted">Il rendimento conta, ma in Tradermon si vince con il rendimento corretto per il rischio: lo Sharpe e il drawdown dicono quanto è stato "faticoso" ottenerlo.</p>`;
      foot.innerHTML = '';
      button('Continua', () => close({ ...res, ...chk }), 'primary');
    };

    if (o.mission) button('Abbandona', () => { setSpeed(0); close(null); }, 'danger');
    else button('Termina ora', () => { setSpeed(0); finish(); });
    draw();
  }, { closable: false, wide: true }).then((r) => { clearInterval(timer); return r ?? null; });
}

function fmtDate(d: string): string {
  return d ? d.slice(0, 10).split('-').reverse().join('/') : '';
}
