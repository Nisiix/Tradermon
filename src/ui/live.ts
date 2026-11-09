import * as A from '../systems/alpaca';
import { S, save, LIVE_LIMITS, hasTech, TECH, classes } from '../systems/state';
import { say, choose, modal, el, esc, toast } from './core';
import { runExam } from './setup';

const NURSE = 'Dott.ssa Ratio';

function monthKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}`; }

export async function openAlpacaHub() {
  const st = await A.serverStatus();
  if (!st) {
    await say(['Non riesco a contattare il server locale di Tradermon.', 'Per usare Alpaca avvia il gioco con "npm run dev" oppure "npm start" (vedi il file LEGGIMI). Senza server il gioco funziona lo stesso con il mercato simulato.'], NURSE);
    return;
  }
  for (;;) {
    const licensed = S.license === 'investitore';
    const opts = [
      st.paper.configured ? `Conto Alpaca Paper (${st.paper.keyHint})` : 'Collega Alpaca Paper (chiavi)',
      licensed ? (st.live.configured ? `Conto REALE (${st.live.keyHint})` : 'Collega conto REALE (chiavi Live)') : S.badges >= 1 ? 'Esame di Abilitazione (sblocca il conto reale)' : 'Conto reale: bloccato (serve la 1ª Medaglia)',
      'Limiti e pausa di riflessione',
      'Scollega chiavi',
      'Come ottenere le chiavi',
      'Indietro',
    ];
    const dis = [false, !licensed && S.badges < 1, !licensed, false, false, false];
    const c = await choose(opts, { cancel: true, title: 'ALPACA', disabled: dis });
    if (c < 0 || c === 5) return;
    if (c === 0) {
      if (!st.paper.configured) { if (await keysForm('paper')) Object.assign(st, await A.serverStatus()); }
      else await accountScreen('paper');
    } else if (c === 1) {
      if (!licensed) { await licenseFlow(); continue; }
      if (S.liveLimits.pauseUntil > Date.now()) { await say(`Pausa di riflessione attiva fino al ${new Date(S.liveLimits.pauseUntil).toLocaleString('it-IT')}. Il conto reale è bloccato.`, NURSE); continue; }
      if (!st.live.configured) { if (await keysForm('live')) Object.assign(st, await A.serverStatus()); }
      else await accountScreen('live');
    } else if (c === 2) await limitsScreen();
    else if (c === 3) {
      const e = await choose(['Scollega Paper', 'Scollega Reale', 'Annulla'], { cancel: true });
      if (e === 0 || e === 1) { await A.deleteKeys(e === 0 ? 'paper' : 'live'); Object.assign(st, await A.serverStatus()); toast('Chiavi rimosse dal server locale.'); }
    } else if (c === 4) {
      await say([
        '1) Crea un account su alpaca.markets. Il conto Paper è gratuito e usa denaro finto.',
        '2) Nella dashboard Paper genera una coppia di chiavi API (Key ID e Secret).',
        '3) Inseriscile qui: il gioco le manda al server locale, che le salva sul tuo computer e non le rimanda mai al browser.',
        '4) Il conto reale richiede la verifica d\'identità fatta da Alpaca, la Licenza di Investitore e chiavi Live separate.',
        'Non condividere mai le chiavi con nessuno: chi le ha può operare sul tuo conto.',
      ], NURSE);
    }
  }
}

async function keysForm(env: A.Env): Promise<boolean> {
  const res = await modal<boolean>(env === 'live' ? 'Collega il conto REALE' : 'Collega Alpaca Paper', ({ body, button, close }) => {
    body.innerHTML = `
      <p>${env === 'live' ? '<b>Attenzione: queste chiavi operano con denaro reale.</b> ' : ''}Inserisci le chiavi API generate nella dashboard di Alpaca ${env === 'live' ? '(conto Live)' : '(conto Paper)'}.</p>
      <p class="small">Le chiavi vengono inviate una sola volta al server locale di Tradermon in esecuzione sul tuo computer, che le verifica con Alpaca e le salva in <code>server/.secrets/keys.json</code>. Il gioco non le salva nel browser e non le rilegge mai.</p>
      <label>Key ID<input class="tx kid" autocomplete="off" spellcheck="false"></label>
      <label style="display:block;margin-top:8px">Secret Key<input class="tx sec" type="password" autocomplete="off" spellcheck="false"></label>
      <p class="msg small"></p>`;
    const msg = body.querySelector('.msg') as HTMLElement;
    const b = button('Verifica e salva', async () => {
      const kid = (body.querySelector('.kid') as HTMLInputElement).value.trim();
      const sec = (body.querySelector('.sec') as HTMLInputElement).value.trim();
      if (!kid || !sec) { msg.textContent = 'Compila entrambi i campi.'; return; }
      b.disabled = true;
      msg.textContent = 'Verifica con Alpaca in corso...';
      try {
        const r = await A.setKeys(env, kid, sec);
        (body.querySelector('.sec') as HTMLInputElement).value = '';
        msg.innerHTML = `<span class="good">Collegato. Stato del conto: ${esc(r.account?.status ?? '')}.</span>`;
        setTimeout(() => close(true), 900);
      } catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; b.disabled = false; }
    }, 'primary');
    button('Annulla', () => close(false));
  }, { serious: env === 'live' });
  return !!res;
}

async function licenseFlow() {
  if (S.license === 'apprendista' && S.badges >= 1) S.license = 'esame';
  if (S.license !== 'esame') { await say('Prima devi ottenere la Medaglia del primo Mentore.', NURSE); return; }
  const wait = S.examLastFail + 10 * 60 * 1000 - Date.now();
  if (wait > 0) { await say(`Potrai ripetere l'esame tra ${Math.ceil(wait / 60000)} minuti. Intanto ripassa in Biblioteca!`, NURSE); return; }
  await say(['L\'Esame di Abilitazione ha 10 domande su rischio, perdite, costi, ordini e truffe.', 'Servono 9 risposte giuste. Nessun timer: prenditi il tempo che serve.'], NURSE);
  const passed = await runExam();
  if (!passed) { S.examLastFail = Date.now(); save(); await say('Non ancora. Il denaro vero merita preparazione: riprova tra 10 minuti.', NURSE); return; }
  const ok = await seriousDisclaimer();
  if (!ok) { await say('Va benissimo così. Puoi restare in paper per sempre: storia e Medaglie non cambiano.', NURSE); return; }
  S.license = 'investitore';
  const L = LIVE_LIMITS[Math.min(8, S.badges)];
  S.liveLimits = { ...S.liveLimits, perOrder: L.order, perMonth: L.month, monthKey: monthKey(), spentThisMonth: 0 };
  save();
  await say(['Congratulazioni: hai la Licenza di Investitore!', `I tuoi limiti iniziali sono ${L.order} $ per ordine e ${L.month} $ al mese (cripto ${L.cOrder}/${L.cMonth}). Puoi abbassarli quando vuoi.`, 'Ricorda: nessun premio di gioco viene dal denaro reale.'], NURSE);
}

function seriousDisclaimer(): Promise<boolean> {
  return modal<boolean>('Attivazione del conto reale', ({ body, button, close }) => {
    const items = [
      'Sono maggiorenne.',
      'Capisco che investendo posso perdere in tutto o in parte il capitale, soprattutto con le cripto-attività.',
      'Tradermon è un gioco educativo: non fornisce consulenza né raccomandazioni personalizzate.',
      'Gli ordini sono eseguiti da Alpaca sul conto che ho aperto io a mio nome; Tradermon non detiene né gestisce il mio denaro.',
      'Nessun premio di gioco (XP, Medaglie, classifiche, carte) deriva da operazioni con denaro reale.',
      'Ho capito i limiti per ordine e al mese, che crescono con le Medaglie, e la pausa di riflessione.',
      'Se risiedo in Italia, so di dover dichiarare il conto estero e i redditi (quadri RW e RT).',
    ];
    body.innerHTML = '<p>Leggi e spunta ogni dichiarazione. Questa schermata è volutamente fuori dallo stile del gioco.</p>' + items.map((t, i) => `<label><input type="checkbox" data-i="${i}"> <span>${esc(t)}</span></label>`).join('');
    const go = button('Attiva la Licenza', () => close(true), 'primary');
    go.disabled = true;
    body.querySelectorAll('input').forEach((c) => c.addEventListener('change', () => { go.disabled = [...body.querySelectorAll('input')].some((x) => !(x as HTMLInputElement).checked); }));
    button('Resto in paper', () => close(false));
  }, { serious: true, closable: false }).then((v) => !!v);
}

async function limitsScreen() {
  const max = LIVE_LIMITS[Math.min(8, S.badges)];
  await modal('Limiti e pausa di riflessione', ({ body, button, close }) => {
    body.innerHTML = `
      <p>Massimi del tuo livello (${S.badges} Medaglie): <b>${max.order} $</b> per ordine, <b>${max.month} $</b> al mese. Cripto: ${max.cOrder} $ / ${max.cMonth} $. Ordini consentiti: mercato${hasTech(TECH.LIMIT) ? ', limite' : ''}${hasTech(TECH.STOP) ? ', stop' : ''}.</p>
      <label>Il mio limite per ordine ($)<input class="tx po" type="number" min="0" max="${max.order}" value="${S.liveLimits.perOrder}"></label>
      <label style="display:block;margin-top:8px">Il mio limite al mese ($)<input class="tx pm" type="number" min="0" max="${max.month}" value="${S.liveLimits.perMonth}"></label>
      <p class="small">Usati questo mese: ${S.liveLimits.monthKey === monthKey() ? S.liveLimits.spentThisMonth.toFixed(2) : '0'} $.</p>
      <h4>Pausa di riflessione</h4>
      <p class="small">Blocca il conto reale per il periodo scelto. Non si può annullare prima della scadenza.</p>
      <div class="row"><button class="btn p1">24 ore</button><button class="btn p7">7 giorni</button><button class="btn p30">30 giorni</button></div>
      <p class="msg small"></p>`;
    const msg = body.querySelector('.msg') as HTMLElement;
    const pause = (d: number) => {
      if (!window.confirm(`Bloccare il conto reale per ${d} giorni? Non potrai annullare.`)) return;
      S.liveLimits.pauseUntil = Date.now() + d * 86400000; save();
      msg.innerHTML = `<span class="good">Pausa attiva fino al ${new Date(S.liveLimits.pauseUntil).toLocaleString('it-IT')}.</span>`;
    };
    (body.querySelector('.p1') as HTMLElement).addEventListener('click', () => pause(1));
    (body.querySelector('.p7') as HTMLElement).addEventListener('click', () => pause(7));
    (body.querySelector('.p30') as HTMLElement).addEventListener('click', () => pause(30));
    button('Salva limiti', () => {
      const po = Math.max(0, Math.min(max.order, Number((body.querySelector('.po') as HTMLInputElement).value)));
      const pm = Math.max(0, Math.min(max.month, Number((body.querySelector('.pm') as HTMLInputElement).value)));
      S.liveLimits.perOrder = po; S.liveLimits.perMonth = pm; save();
      msg.innerHTML = `<span class="good">Limiti salvati: ${po} $ per ordine, ${pm} $ al mese (mai oltre il massimo del livello).</span>`;
    }, 'primary');
    button('Chiudi', () => close());
  }, { serious: true });
}

async function accountScreen(env: A.Env) {
  await modal(env === 'live' ? 'Conto REALE Alpaca' : 'Conto Alpaca Paper', ({ body, button, close }) => {
    const load = async () => {
      body.innerHTML = '<p>Caricamento...</p>';
      try {
        const [acc, pos, ord, clk] = await Promise.all([A.account(env), A.positions(env), A.openOrders(env), A.clock(env).catch(() => null)]);
        body.innerHTML = `
          ${env === 'live' ? '<p class="bad"><b>Denaro reale.</b> Nessuna XP o ricompensa di gioco da queste operazioni.</p>' : '<p class="small muted">Conto Paper di Alpaca: denaro finto, prezzi reali.</p>'}
          <p><b>Valore:</b> ${Number(acc.portfolio_value).toFixed(2)} ${acc.currency} · <b>Liquidità:</b> ${Number(acc.cash).toFixed(2)} · <b>Stato:</b> ${esc(acc.status)} · ${clk ? (clk.is_open ? '<span class="good">Mercato aperto</span>' : 'Mercato chiuso') : ''}</p>
          ${pos.length ? `<table class="t"><tr><th>Simbolo</th><th class="n">Quantità</th><th class="n">Prezzo medio</th><th class="n">Valore</th><th class="n">P&amp;L</th></tr>${pos.map((p) => `<tr><td>${esc(p.symbol)}</td><td class="n">${p.qty}</td><td class="n">${Number(p.avg_entry_price).toFixed(2)}</td><td class="n">${Number(p.market_value).toFixed(2)}</td><td class="n ${Number(p.unrealized_pl) >= 0 ? 'good' : 'bad'}">${(Number(p.unrealized_plpc) * 100).toFixed(2)}%</td></tr>`).join('')}</table>` : '<p class="muted">Nessuna posizione.</p>'}
          <h4>Ordini aperti</h4><div class="oo">${ord.length ? '' : '<span class="muted">Nessuno</span>'}</div>
          <h4>Nuovo ordine</h4>
          <div class="grid2">
            <label>Simbolo (es. ${classes().includes('crypto') ? 'BTC/USD' : 'un ticker USA'})<input class="tx sym" spellcheck="false"></label>
            <label>Lato<select class="tx side"><option value="buy">Acquisto</option><option value="sell">Vendita</option></select></label>
            <label>Tipo<select class="tx typ"><option value="market">A mercato</option>${hasTech(TECH.LIMIT) ? '<option value="limit">Limite</option>' : ''}${hasTech(TECH.STOP) ? '<option value="stop">Stop</option>' : ''}</select></label>
            <label>Importo ($)<input class="tx amt" type="number" min="1" step="1" value="10"></label>
            <label>Prezzo limite/stop<input class="tx pr" type="number" step="any"></label>
          </div>
          <p class="small muted">Il gioco non suggerisce titoli: la scelta è solo tua. Classi consentite dal tuo percorso: ${classes().map((c) => (c === 'crypto' ? 'cripto' : c === 'etf' ? 'ETF (us_equity)' : 'azioni (us_equity)')).join(', ')}.</p>
          <p class="msg"></p>`;
        const oo = body.querySelector('.oo') as HTMLElement;
        ord.forEach((o) => {
          const r = el('div', 'row small', `${esc(o.side)} ${esc(o.type)} ${esc(o.symbol)} ${o.notional ? o.notional + ' $' : o.qty} · ${esc(o.status)}`);
          const b = el('button', 'btn', 'Annulla');
          b.addEventListener('click', async () => { try { await A.cancelOrder(env, o.id); toast('Ordine annullato.'); void load(); } catch (e) { toast((e as Error).message); } });
          r.appendChild(b); oo.appendChild(r);
        });
        button2(body, env, load);
      } catch (e) { body.innerHTML = `<p class="bad">${esc((e as Error).message)}</p>`; }
    };
    void load();
    button('Apri Alpaca (depositi e prelievi)', () => window.open(A.ALPACA_DASHBOARD, '_blank', 'noopener'));
    button('Chiudi', () => close(), 'primary');
  }, { serious: env === 'live', wide: true });
}

function button2(body: HTMLElement, env: A.Env, reload: () => Promise<void>) {
  const msg = body.querySelector('.msg') as HTMLElement;
  const send = el('button', 'btn primary', env === 'live' ? 'Rivedi e invia ordine REALE' : 'Invia ordine paper');
  body.appendChild(send);
  send.addEventListener('click', async () => {
    const sym = (body.querySelector('.sym') as HTMLInputElement).value.trim().toUpperCase();
    const side = (body.querySelector('.side') as HTMLSelectElement).value as 'buy' | 'sell';
    const type = (body.querySelector('.typ') as HTMLSelectElement).value as 'market' | 'limit' | 'stop';
    const amt = Number((body.querySelector('.amt') as HTMLInputElement).value);
    const pr = Number((body.querySelector('.pr') as HTMLInputElement).value);
    if (!sym || !(amt > 0)) { msg.innerHTML = '<span class="bad">Indica simbolo e importo.</span>'; return; }
    if (type !== 'market' && !(pr > 0)) { msg.innerHTML = '<span class="bad">Indica il prezzo limite/stop.</span>'; return; }
    try {
      const info = await A.asset(env, sym);
      const isCrypto = info.class === 'crypto';
      const allowed = classes();
      if (isCrypto && !allowed.includes('crypto')) throw new Error('Il tuo percorso non comprende le cripto.');
      if (!isCrypto && !allowed.includes('stocks') && !allowed.includes('etf')) throw new Error('Il tuo percorso comprende solo cripto.');
      if (!info.tradable) throw new Error('Questo asset non è negoziabile su Alpaca.');
      let confirmWord: string | undefined;
      if (env === 'live') {
        const L = LIVE_LIMITS[Math.min(8, S.badges)];
        const perOrder = Math.min(S.liveLimits.perOrder, isCrypto ? L.cOrder : L.order);
        const perMonth = Math.min(S.liveLimits.perMonth, isCrypto ? L.cMonth : L.month);
        if (S.liveLimits.monthKey !== monthKey()) { S.liveLimits.monthKey = monthKey(); S.liveLimits.spentThisMonth = 0; }
        if (side === 'buy' && amt > perOrder) throw new Error(`Supera il tuo limite per ordine (${perOrder} $).`);
        if (side === 'buy' && S.liveLimits.spentThisMonth + amt > perMonth) throw new Error(`Supera il tuo limite mensile (${perMonth} $, già usati ${S.liveLimits.spentThisMonth.toFixed(2)} $).`);
        confirmWord = await typedConfirm(`${side === 'buy' ? 'ACQUISTO' : 'VENDITA'} ${type === 'market' ? 'a mercato' : type === 'limit' ? `limite a ${pr}` : `stop a ${pr}`} di ${sym} per circa ${amt.toFixed(2)} $. Costi: eventuale spread${isCrypto ? ' e commissione cripto di Alpaca' : ''}. Limiti: ${perOrder} $ per ordine, ${perMonth} $ al mese.`);
        if (!confirmWord) { msg.textContent = 'Ordine annullato.'; return; }
      }
      const fractional = type === 'market' && info.fractionable !== false;
      const order: A.OrderReq = { symbol: sym, side, type, time_in_force: isCrypto ? 'gtc' : 'day', client_order_id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
      if (fractional) order.notional = amt.toFixed(2);
      else {
        const ref = pr || (await A.latest(sym, isCrypto ? 'crypto' : 'stocks')).price;
        const q = isCrypto ? amt / ref : Math.floor(amt / ref);
        if (q <= 0) throw new Error('Importo troppo basso per una quota intera con questo tipo di ordine.');
        order.qty = isCrypto ? q.toFixed(6) : String(q);
      }
      if (type === 'limit') order.limit_price = String(pr);
      if (type === 'stop') order.stop_price = String(pr);
      const out = await A.submitOrder(env, order, confirmWord);
      if (env === 'live') {
        if (side === 'buy') S.liveLimits.spentThisMonth += amt;
        S.liveAudit.push({ t: Date.now(), symbol: sym, side, notional: amt, status: out.status, id: out.id });
        save();
      }
      msg.innerHTML = `<span class="good">Ordine inviato: stato ${esc(out.status)}.</span>`;
      setTimeout(() => void reload(), 1200);
    } catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; }
  });
}

function typedConfirm(summary: string): Promise<string | undefined> {
  return modal<string>('Conferma ordine REALE', ({ body, button, close }) => {
    body.innerHTML = `<p>${esc(summary)}</p><p>Per confermare scrivi <b>CONFERMO</b>.</p><input class="tx cw" autocomplete="off">`;
    const i = body.querySelector('.cw') as HTMLInputElement;
    setTimeout(() => i.focus(), 30);
    button('Invia', () => { if (i.value.trim() === 'CONFERMO') close('CONFERMO'); else i.style.borderColor = 'red'; }, 'danger');
    button('Annulla', () => close(undefined));
  }, { serious: true, closable: false });
}
