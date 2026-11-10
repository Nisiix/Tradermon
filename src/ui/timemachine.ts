import type { AssetDef } from '../types';
import type { SimMission, SimResult } from '../data/missions';
import type { Scenario } from '../systems/market';
import { generateScenario, metrics } from '../systems/market';
import { ASSETS, SECTOR_LABEL, SECTOR_COLOR } from '../data/assets';
import { type Book, marketBuy, marketSell, placeOrder, processOrders, value, weights, fmtPx, fmtMoney, fmtPct, fmtQty, FEE, spreadOf } from '../systems/portfolio';
import { hasTech, TECH, classes } from '../systems/state';
import { el, esc, modal, toast } from './core';
import { beep } from '../systems/audio';

export interface SimOpts {
  mission?: SimMission;
  scenario?: Scenario;
  capital?: number;
  monthly?: number;
  dividends?: boolean;
  custom?: { assets: AssetDef[]; prices: Record<string, number[]>; labels?: string[] };
  seed?: number;
  sandbox?: boolean;
}

export type SimOutcome = (SimResult & { ok: boolean; detail: string }) | null;

export function runSim(o: SimOpts): Promise<SimOutcome> {
  const sc = o.mission?.scenario ?? o.scenario!;
  const cls = classes();
  const assets = o.custom?.assets ?? ASSETS.filter((a) => cls.includes(a.cls));
  const seed = o.seed ?? Math.floor(Math.random() * 1e9);
  const series = o.custom ? { prices: o.custom.prices, index: [] as number[] } : generateScenario(sc, assets, seed);
  const days = o.custom ? Math.min(...Object.values(o.custom.prices).map((p) => p.length)) - 1 : sc.days;
  const capital = o.capital ?? (o.mission?.id === 'm4' ? 1000 : 10000);
  const monthly = o.monthly ?? o.mission?.monthly ?? (sc.id === 'sb_long' ? 200 : 0);
  const dividends = o.dividends ?? o.mission?.dividends ?? true;
  const mid = o.mission?.id ?? '';
  const canLimit = hasTech(TECH.LIMIT) || mid === 'm2' || o.sandbox;
  const canStop = hasTech(TECH.STOP) || mid === 'm8' || o.sandbox;
  const canPac = hasTech(TECH.PAC) || mid === 'm4' || o.sandbox || monthly > 0;
  const newsMap = new Map<number, string>();
  sc.shocks.forEach((s) => s.news && newsMap.set(s.day, s.news));

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

  return modal<SimOutcome>(o.mission ? `Macchina del Tempo · ${o.mission.title}` : `Zona Simulazione · ${sc.name}`, ({ body, foot, close, button }) => {
    body.innerHTML = `
      <div class="small" style="margin-bottom:6px">${esc(o.mission?.brief ?? sc.desc)}${sc.historical ? ` <span class="muted">(Ricostruzione semplificata. Riferimento: ${esc(sc.historical)})</span>` : ''}</div>
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
            <div class="row" style="margin-top:4px"><input class="tx amt" type="number" min="0" step="10" placeholder="Importo Cr" style="width:110px"><button class="btn buy">Compra</button></div>
            <div class="row" style="margin-top:4px"><button class="btn s25">Vendi 25%</button><button class="btn s50">50%</button><button class="btn s100">Tutto</button></div>
            <div class="row advp" style="margin-top:4px;display:none"><input class="tx lpx" type="number" min="0" step="any" placeholder="Prezzo ordine" style="width:130px"><span class="small muted">per limite/stop</span></div>
            <div class="row adv" style="margin-top:4px"></div>
            <div class="small orders"></div>
          </div>
        </div>
      </div>
      <div class="small muted" style="margin-top:6px">Costi: ${FEE} Cr per ordine + spread (0,1%, cripto 0,5%). ${monthly ? `Versamento mensile: ${monthly} Cr ogni 21 giorni.` : ''} ${dividends ? 'Dividendi pagati ogni mese e reinvestiti.' : ''}</div>`;
    const $ = (s: string) => body.querySelector(s) as HTMLElement;
    const cv = body.querySelector('canvas') as HTMLCanvasElement;
    const amt = $('.amt') as HTMLInputElement;
    amt.value = String(Math.round(capital / 4));

    const adv = $('.adv');
    const lpx = $('.lpx') as HTMLInputElement;
    if (canLimit || canStop) ($('.advp') as HTMLElement).style.display = '';
    const priceOr = (def: number) => { const v = Number(lpx.value); return v > 0 ? v : def; };
    if (canLimit) {
      const lb = el('button', 'btn', 'Limite acquisto');
      lb.addEventListener('click', () => {
        const p = prices()[selected];
        const lp = priceOr(p * 0.97);
        const a = Number(amt.value);
        if (!lp || !a) return;
        if (a > book.cash) return toast('Liquidità insufficiente.');
        placeOrder(book, { asset: selected, side: 'buy', type: 'limit', qty: (a - FEE) / lp, price: lp, createdDay: day });
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
        if (a <= FEE) return toast('Nessun versamento da investire.');
        doBuy(a, 'pac');
        pacCash = 0;
      });
      adv.append(pb);
    }

    const tick = (id: string) => assets.find((a) => a.id === id)!.ticker;

    const doBuy = (a: number, type = 'mercato') => {
      const r = marketBuy(book, selected, a, prices(), day, slotsMax, type);
      toast(r.msg);
      if (r.ok) { boughtShares += r.qty ?? 0; monthsBought.add(Math.floor(day / 21)); beep('coin'); }
      draw();
    };
    $('.buy').addEventListener('click', () => doBuy(Number(amt.value)));
    const sell = (f: number) => {
      const pos = book.positions.find((x) => x.id === selected);
      if (!pos) return toast('Non possiedi questo asset.');
      const r = marketSell(book, selected, pos.qty * f, prices(), day);
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
      for (const m of processOrders(book, px, day, slotsMax)) { toast(m); if (m.includes('limite eseguito') && m.includes('Comprate')) limitFills++; if (m.includes('Comprate')) monthsBought.add(Math.floor(day / 21)); }
      if (day % 21 === 0) {
        if (monthly) { book.cash += monthly; contributed += monthly; pacCash += monthly; }
        if (dividends) {
          for (const p of book.positions) {
            const a = assets.find((x) => x.id === p.id)!;
            if (a.dividend > 0) { const q = (p.qty * px[p.id] * a.dividend) / 12 / px[p.id]; p.qty += q; dripShares += q; }
          }
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
      $('.k-cash').textContent = fmtMoney(book.cash);
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
        sectors: new Set(book.positions.map((p) => assets.find((a) => a.id === p.id)!.sector)).size, maxW: ws.reduce((x, y) => Math.max(x, y.w), 0),
        investedW: fv > 0 ? 1 - book.cash / fv : 0, finalValue: fv, startValue: contributed, dripShareGrowth: boughtShares > 0 ? dripShares / boughtShares : 0,
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
        <p class="small muted">Il rendimento conta, ma in Tradermon si vince con il rendimento corretto per il rischio: lo Sharpe e il drawdown dicono quanto è stato "faticoso" ottenerlo.</p>`;
      foot.innerHTML = '';
      button('Continua', () => close({ ...res, ...chk }), 'primary');
    };

    if (o.mission) button('Abbandona', () => { setSpeed(0); close(null); }, 'danger');
    else button('Termina ora', () => { setSpeed(0); finish(); });
    draw();
  }, { closable: false, wide: true }).then((r) => { clearInterval(timer); return r ?? null; });
}
