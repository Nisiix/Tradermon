import * as A from '../systems/alpaca';
import * as Acc from '../systems/account';
import { S, save, LIVE_LIMITS, hasTech, TECH, classes } from '../systems/state';
import { say, choose, modal, el, esc, toast, confirm } from './core';
import { runExam } from './setup';
import { journalPrompt } from './journal';
import { openChart } from './chart';
import { BARS_SHOWN, type Timeframe } from '../systems/candles';
import { fmtPx } from '../systems/portfolio';
import * as C from '../systems/cloud';
import { cloudPlayer } from '../systems/sync';
import { unlockForm } from './account';

const NURSE = 'Dott.ssa Ratio';

function monthKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}`; }

/** Grafico a candele di un simbolo reale: barre Alpaca a 5 min, 15 min, 1 ora, 4 ore o 1 giorno. */
export function realChart(sym: string, marker?: { price: number; label: string }) {
  const isCrypto = sym.includes('/');
  const TF: Record<Timeframe, { tf: A.BarTimeframe; days: number }> = { '5m': { tf: '5Min', days: 3 }, '15m': { tf: '15Min', days: 7 }, '1h': { tf: '1Hour', days: 20 }, '4h': { tf: '4Hour', days: 70 }, '1g': { tf: '1Day', days: 260 } };
  return openChart({
    title: sym,
    marker,
    note: 'Barre fornite da Alpaca per il tuo conto (azioni: feed IEX, in ritardo rispetto al mercato). Nessun consiglio.',
    load: async (tf) => {
      const { tf: atf, days } = TF[tf];
      const end = new Date(), start = new Date(Date.now() - days * 864e5);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const r = await A.bars(sym, isCrypto ? 'crypto' : 'stocks', iso(start), iso(end), atf);
      return r.bars.map((b) => ({ t: Math.floor(new Date(b.t).getTime() / 60000), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v })).slice(-BARS_SHOWN[tf]);
    },
  });
}

export async function openAlpacaHub() {
  const st = await A.serverStatus();
  if (!st) {
    await say(A.noServerLines('il collegamento ad Alpaca (Paper e reale)'), NURSE);
    return;
  }
  if (await restoreKeys(st)) Object.assign(st, await A.serverStatus());
  for (;;) {
    const licensed = S.license === 'investitore';
    const opts = [
      st.paper.configured ? `Conto Alpaca Paper (${st.paper.keyHint})` : 'Collega Alpaca Paper (chiavi)',
      licensed ? (st.live.configured ? `Conto REALE (${st.live.keyHint})` : 'Collega conto REALE (chiavi Live)') : S.badges >= 1 ? 'Esame di Abilitazione (sblocca il conto reale)' : 'Conto reale: dopo il 1º Attestato',
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
      if (e === 0 || e === 1) {
        const env: A.Env = e === 0 ? 'paper' : 'live';
        await A.deleteKeys(env);
        let cloudMsg = '';
        if (cloudPlayer()) { try { await C.removeAlpacaKeys(env); cloudMsg = ' e da Supabase'; } catch { cloudMsg = ' (non da Supabase: riprova quando sei online)'; } }
        Object.assign(st, await A.serverStatus());
        toast(`Chiavi rimosse dal server locale${cloudMsg}.`);
      }
    } else if (c === 4) {
      await say([
        '1) Crea un account su alpaca.markets. Il conto Paper è gratuito e usa denaro finto.',
        '2) Nella dashboard Paper genera una coppia di chiavi API (Key ID e Secret).',
        '3) Inseriscile qui: il gioco le manda al server locale, che le salva sul tuo computer e non le rimanda mai al browser.',
        'Una copia viaggia anche su Supabase, cifrata nel browser con la password del tuo giocatore: sul server è illeggibile e ti permette di ritrovarle su un altro computer.',
        '4) Il conto reale richiede la verifica d\'identità fatta da Alpaca, la Licenza di Investitore e chiavi Live separate.',
        'Non condividere mai le chiavi con nessuno: chi le ha può operare sul tuo conto.',
      ], NURSE);
    }
  }
}

/** Osservatorio: conto, posizioni e prezzi Alpaca in sola lettura. Nessun pulsante d'ordine: qui si guarda, non si opera. */
export async function openObservatory() {
  const st = await A.serverStatus();
  if (!st) return say(A.noServerLines('l\'Osservatorio Alpaca'), NURSE);
  const envs: A.Env[] = [];
  if (st.paper.configured) envs.push('paper');
  if (st.live.configured && S.license === 'investitore') envs.push('live');
  if (!envs.length) return say(['Nessun conto Alpaca collegato.', 'Collega almeno il conto Paper dalla voce "Conto Alpaca": l\'Osservatorio mostra conto e prezzi senza mai inviare ordini.'], NURSE);
  let env: A.Env = envs[0];
  if (envs.length > 1) { const c = await choose(['Conto Paper', 'Conto reale', 'Annulla'], { cancel: true, prompt: 'Quale conto vuoi osservare?', who: NURSE }); if (c < 0 || c === 2) return; env = c === 0 ? 'paper' : 'live'; }
  await modal(`Osservatorio Alpaca · ${env === 'live' ? 'conto reale' : 'conto Paper'} (sola lettura)`, ({ body, button, close }) => {
    const load = async () => {
      body.innerHTML = '<p>Caricamento...</p>';
      try {
        const [acc, pos, ord, clk] = await Promise.all([A.account(env), A.positions(env), A.openOrders(env), A.clock(env).catch(() => null)]);
        const mine = S.journal.filter((j) => j.account === (env === 'live' ? 'reale' : 'paper'));
        body.innerHTML = `
          <p class="small muted">Qui si osserva soltanto: nessun ordine può partire da questa schermata.</p>
          <p><b>Valore:</b> ${Number(acc.portfolio_value).toFixed(2)} ${acc.currency} · <b>Liquidità:</b> ${Number(acc.cash).toFixed(2)} · <b>Stato:</b> ${esc(acc.status)} · ${clk ? (clk.is_open ? '<span class="good">Mercato aperto</span>' : `Mercato chiuso${clk.next_open ? ` · riapre ${new Date(clk.next_open).toLocaleString('it-IT')}` : ''}`) : ''}</p>
          ${pos.length ? `<table class="t"><tr><th>Simbolo</th><th class="n">Quantità</th><th class="n">Prezzo medio</th><th class="n">Prezzo attuale</th><th class="n">Valore</th><th class="n">P&amp;L</th><th>Diario</th></tr>${pos.map((p) => { const j = mine.filter((x) => x.asset === p.symbol); return `<tr><td><b>${esc(p.symbol)}</b></td><td class="n">${p.qty}</td><td class="n">${Number(p.avg_entry_price).toFixed(2)}</td><td class="n">${Number(p.current_price).toFixed(2)}</td><td class="n">${Number(p.market_value).toFixed(2)}</td><td class="n ${Number(p.unrealized_pl) >= 0 ? 'good' : 'bad'}">${(Number(p.unrealized_plpc) * 100).toFixed(2)}%</td><td class="small">${j.length ? esc(j[j.length - 1].reason) : '<span class="muted">—</span>'}</td></tr>`; }).join('')}</table>` : '<p class="muted">Nessuna posizione.</p>'}
          <h4>Ordini aperti</h4>${ord.length ? `<ul class="small" style="margin:0 0 0 16px">${ord.map((o) => `<li>${esc(o.side)} ${esc(o.type)} ${esc(o.symbol)} ${o.notional ? o.notional + ' $' : o.qty} · ${esc(o.status)}</li>`).join('')}</ul>` : '<span class="muted">Nessuno</span>'}
          <h4>Prezzo di un simbolo</h4>
          <div class="row"><input class="tx sym" placeholder="es. un ticker USA o BTC/USD" spellcheck="false" style="flex:1"><button class="btn look">Guarda</button><button class="btn chart">Grafico</button></div>
          <p class="msg small"></p>
          <p class="small muted">Dati forniti da Alpaca per il tuo conto. Nessun consiglio: l\'Osservatorio serve a confrontare ciò che hai scritto nel Diario con quello che è successo.</p>`;
        const look = body.querySelector('.look') as HTMLButtonElement, msg = body.querySelector('.msg') as HTMLElement, inp = body.querySelector('.sym') as HTMLInputElement;
        (body.querySelector('.chart') as HTMLButtonElement | null)?.addEventListener('click', () => { const sym = inp.value.trim().toUpperCase(); if (sym) void realChart(sym); });
        look.addEventListener('click', async () => {
          const sym = inp.value.trim().toUpperCase();
          if (!sym) return;
          msg.textContent = '...';
          try { const r = await A.latest(sym, sym.includes('/') ? 'crypto' : 'stocks'); msg.innerHTML = `<b>${esc(sym)}</b>: ${fmtPx(r.price)} $`; }
          catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; }
        });
      } catch (e) { body.innerHTML = `<p class="bad">${esc((e as Error).message)}</p>`; }
    };
    void load();
    button('Aggiorna', () => void load());
    button('Chiudi', () => close(), 'primary');
  }, { wide: true });
}

export async function keysForm(env: A.Env): Promise<boolean> {
  const res = await modal<boolean>(env === 'live' ? 'Collega il conto REALE' : 'Collega Alpaca Paper', ({ body, button, close }) => {
    body.innerHTML = `
      <p>${env === 'live' ? '<b>Attenzione: queste chiavi operano con denaro reale.</b> ' : ''}Inserisci le chiavi API generate nella dashboard di Alpaca ${env === 'live' ? '(conto Live)' : '(conto Paper)'}.</p>
      <p class="small">Le chiavi vengono inviate una sola volta al server locale di Tradermon in esecuzione sul tuo computer, che le verifica con Alpaca e le salva in <code>server/.secrets/keys.json</code>. Il gioco non le salva nel browser.</p>
      ${cloudPlayer() ? '<p class="small">Una copia va anche su Supabase, <b>cifrata qui nel browser con la password del tuo giocatore</b> (AES-256): sul server è illeggibile, anche per chi amministra il database, e ti permette di ritrovarle su un altro computer.</p>' : ''}
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
        const cloudNote = await keepCloudCopy(env, kid, sec);
        (body.querySelector('.sec') as HTMLInputElement).value = '';
        msg.innerHTML = `<span class="good">Collegato. Stato del conto: ${esc(r.account?.status ?? '')}.</span>${cloudNote ? `<br><span class="small">${esc(cloudNote)}</span>` : ''}`;
        setTimeout(() => close(true), 900);
      } catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; b.disabled = false; }
    }, 'primary');
    button('Annulla', () => close(false));
  }, { serious: env === 'live' });
  return !!res;
}

/** Copia cifrata delle chiavi su Supabase. Restituisce una nota per il giocatore ('' se tutto ok o senza giocatore). */
async function keepCloudCopy(env: A.Env, keyId: string, secret: string): Promise<string> {
  if (!cloudPlayer()) return '';
  if (!(await C.vaultUnlocked()) && !(await unlockForm('Per salvare una copia cifrata delle chiavi su Supabase serve la password del giocatore.'))) return 'Copia su Supabase non salvata: le chiavi restano solo sul server locale.';
  try { await C.storeAlpacaKeys(env, { keyId, secret }); return 'Copia cifrata salvata su Supabase.'; }
  catch (e) { return `Copia su Supabase non salvata: ${(e as Error).message}`; }
}

/** Il server locale non ha le chiavi ma su Supabase c'è la copia cifrata: le riporta sul computer (per esempio su un PC nuovo). */
async function restoreKeys(st: A.ServerStatus): Promise<boolean> {
  if (!cloudPlayer()) return false;
  const saved = await C.savedKeyEnvs();
  const missing = saved.filter((e) => !st[e].configured);
  if (!missing.length) return false;
  const names = missing.map((e) => (e === 'live' ? 'Live' : 'Paper')).join(' e ');
  if (!(await C.vaultUnlocked()) && !(await unlockForm(`Su Supabase ci sono le tue chiavi Alpaca ${names}, ma questo computer non le ha ancora.`))) return false;
  let done = 0;
  for (const env of missing) {
    try {
      const k = await C.loadAlpacaKeys(env);
      if (k) { await A.setKeys(env, k.keyId, k.secret); done++; }
    } catch (e) { toast(`Chiavi ${env === 'live' ? 'Live' : 'Paper'} non ripristinate: ${(e as Error).message}`); }
  }
  if (done) toast(`Chiavi Alpaca ${names} ripristinate da Supabase sul server locale.`);
  return done > 0;
}

async function licenseFlow() {
  if (S.license === 'apprendista' && S.badges >= 1) S.license = 'esame';
  if (S.license !== 'esame') { await say('Prima devi ottenere l\'Attestato del primo Mentore.', NURSE); return; }
  const wait = S.examLastFail + 10 * 60 * 1000 - Date.now();
  if (wait > 0) { await say(`Potrai ripetere l'esame tra ${Math.ceil(wait / 60000)} minuti. Intanto ripassa in Biblioteca!`, NURSE); return; }
  await say(['L\'Esame di Abilitazione ha 10 domande su rischio, perdite, costi, ordini e truffe.', 'Servono 9 risposte giuste. Nessun timer: prenditi il tempo che serve.'], NURSE);
  const passed = await runExam();
  if (!passed) { S.examLastFail = Date.now(); save(); await say('Non ancora. Il denaro vero merita preparazione: riprova tra 10 minuti.', NURSE); return; }
  const ok = await seriousDisclaimer();
  if (!ok) { await say('Va benissimo così. Puoi restare sul Paper per sempre: storia, Attestati e Sigilli non dipendono dal conto reale.', NURSE); return; }
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
      'Ho capito i limiti per ordine e al mese, che crescono con gli Attestati, e la pausa di riflessione.',
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
      <p>Massimi del tuo livello (${S.badges} Attestati): <b>${max.order} $</b> per ordine, <b>${max.month} $</b> al mese. Cripto: ${max.cOrder} $ / ${max.cMonth} $. Ordini consentiti: mercato${hasTech(TECH.LIMIT) ? ', limite' : ''}${hasTech(TECH.STOP) ? ', stop' : ''}.</p>
      <label>Il mio limite per ordine ($)<input class="tx po" type="number" min="0" max="${max.order}" value="${S.liveLimits.perOrder}"></label>
      <label style="display:block;margin-top:8px">Il mio limite al mese ($)<input class="tx pm" type="number" min="0" max="${max.month}" value="${S.liveLimits.perMonth}"></label>
      <p class="small">Usati questo mese: ${S.liveLimits.monthKey === monthKey() ? S.liveLimits.spentThisMonth.toFixed(2) : '0'} $.</p>
      <h4>Pausa di riflessione</h4>
      <p class="small">Blocca il conto reale per il periodo scelto. Non si può annullare prima della scadenza.</p>
      <div class="row"><button class="btn p1">24 ore</button><button class="btn p7">7 giorni</button><button class="btn p30">30 giorni</button></div>
      <p class="msg small"></p>`;
    const msg = body.querySelector('.msg') as HTMLElement;
    const pause = async (d: number) => {
      if (!(await confirm(`Bloccare il conto reale per ${d} giorni? Non potrai annullare.`))) return;
      S.liveLimits.pauseUntil = Date.now() + d * 86400000; save();
      msg.innerHTML = `<span class="good">Pausa attiva fino al ${new Date(S.liveLimits.pauseUntil).toLocaleString('it-IT')}.</span>`;
    };
    (body.querySelector('.p1') as HTMLElement).addEventListener('click', () => void pause(1));
    (body.querySelector('.p7') as HTMLElement).addEventListener('click', () => void pause(7));
    (body.querySelector('.p30') as HTMLElement).addEventListener('click', () => void pause(30));
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
        const lv = env === 'live' ? Acc.liveCheck(Number(acc.equity ?? acc.portfolio_value)) : null;
        body.innerHTML = `
          ${lv ? liveBustHtml(lv) : ''}
          ${env === 'live' ? '<p class="bad"><b>Denaro reale.</b> Nessuna XP o ricompensa di gioco da queste operazioni.</p>' : '<p class="small muted">Conto Paper di Alpaca, intero: denaro finto, prezzi reali. Il <b>conto di gioco</b> è una parte di questo conto: lo trovi nel Check-up della Clinica, e si opera solo da lì (voce «Compra / Vendi»), così ogni ordine entra nel registro delle tappe. Qui si guarda soltanto.</p>'}
          <p><b>Valore:</b> ${Number(acc.portfolio_value).toFixed(2)} ${acc.currency} · <b>Liquidità:</b> ${Number(acc.cash).toFixed(2)} · <b>Stato:</b> ${esc(acc.status)} · ${clk ? (clk.is_open ? '<span class="good">Mercato aperto</span>' : 'Mercato chiuso') : ''}</p>
          ${pos.length ? `<table class="t"><tr><th>Simbolo</th><th class="n">Quantità</th><th class="n">Prezzo medio</th><th class="n">Valore</th><th class="n">P&amp;L</th></tr>${pos.map((p) => `<tr><td>${esc(p.symbol)}</td><td class="n">${p.qty}</td><td class="n">${Number(p.avg_entry_price).toFixed(2)}</td><td class="n">${Number(p.market_value).toFixed(2)}</td><td class="n ${Number(p.unrealized_pl) >= 0 ? 'good' : 'bad'}">${(Number(p.unrealized_plpc) * 100).toFixed(2)}%</td></tr>`).join('')}</table>` : '<p class="muted">Nessuna posizione.</p>'}
          <h4>Ordini aperti</h4><div class="oo">${ord.length ? '' : '<span class="muted">Nessuno</span>'}</div>
          ${env === 'live' ? `          <h4>Nuovo ordine</h4>
          <div class="grid2">
            <label>Simbolo (es. ${classes().includes('crypto') ? 'BTC/USD' : 'un ticker USA'})<span class="row"><input class="tx sym" spellcheck="false" style="flex:1"><button class="btn chart" title="Grafico a candele prima di decidere">Grafico</button></span></label>
            <label>Lato<select class="tx side">${lv && lv.state !== 'ok' ? '' : '<option value="buy">Acquisto</option>'}<option value="sell">Vendita</option></select></label>
            <label>Tipo<select class="tx typ"><option value="market">A mercato</option>${hasTech(TECH.LIMIT) ? '<option value="limit">Limite</option>' : ''}${hasTech(TECH.STOP) ? '<option value="stop">Stop</option>' : ''}</select></label>
            <label>Importo ($) <span class="small muted">anche frazioni di titolo</span><input class="tx amt" type="number" min="1" step="any" value="10"></label>
            <label>Prezzo limite/stop<input class="tx pr" type="number" step="any"></label>
          </div>
          <p class="small muted">Il gioco non suggerisce titoli: la scelta è solo tua. Classi consentite dal tuo percorso: ${classes().map((c) => (c === 'crypto' ? 'cripto' : c === 'etf' ? 'ETF (us_equity)' : 'azioni (us_equity)')).join(', ')}.</p>` : ''}
          <p class="msg"></p>`;
        (body.querySelector('.chart') as HTMLButtonElement | null)?.addEventListener('click', () => {
          const sym = (body.querySelector('.sym') as HTMLInputElement).value.trim().toUpperCase();
          if (!sym) { toast('Scrivi prima il simbolo.'); return; }
          const p = pos.find((x) => x.symbol === sym);
          void realChart(sym, p ? { price: Number(p.avg_entry_price), label: 'carico' } : undefined);
        });
        const oo = body.querySelector('.oo') as HTMLElement;
        ord.forEach((o) => {
          const r = el('div', 'row small', `${esc(o.side)} ${esc(o.type)} ${esc(o.symbol)} ${o.notional ? o.notional + ' $' : o.qty} · ${esc(o.status)}`);
          const b = el('button', 'btn', 'Annulla');
          b.addEventListener('click', async () => { try { await A.cancelOrder(env, o.id); toast('Ordine annullato.'); void load(); } catch (e) { toast((e as Error).message); } });
          if (env === 'live') r.appendChild(b);
          oo.appendChild(r);
        });
        if (env === 'live') button2(body, env, load);
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
      // leva sul conto reale: solo dopo l'Esame della Leva, solo azioni ed ETF, entro il potere d'acquisto che Alpaca concede
      let useMargin = false;
      if (env === 'live') {
        const L = LIVE_LIMITS[Math.min(8, S.badges)];
        const perOrder = Math.min(S.liveLimits.perOrder, isCrypto ? L.cOrder : L.order);
        const perMonth = Math.min(S.liveLimits.perMonth, isCrypto ? L.cMonth : L.month);
        if (S.liveLimits.monthKey !== monthKey()) { S.liveLimits.monthKey = monthKey(); S.liveLimits.spentThisMonth = 0; }
        if (side === 'buy') {
          const now = await A.account('live');
          const lv = Acc.liveCheck(Number(now.equity ?? now.portfolio_value));
          if (lv.state !== 'ok') { void reload(); throw new Error(lv.state === 'closed' ? 'Dopo la bancarotta del conto reale il gioco non invia più acquisti con denaro vero.' : `Dopo la bancarotta del conto reale gli acquisti dal gioco sono fermi fino al ${new Date(lv.until).toLocaleDateString('it-IT')}.`); }
        }
        if (side === 'buy' && amt > perOrder) throw new Error(`Supera il tuo limite per ordine (${perOrder} $).`);
        if (side === 'buy' && S.liveLimits.spentThisMonth + amt > perMonth) throw new Error(`Supera il tuo limite mensile (${perMonth} $, già usati ${S.liveLimits.spentThisMonth.toFixed(2)} $).`);
        if (side === 'buy' && !isCrypto && S.levExam) {
          const acc = await A.account('live');
          useMargin = amt > Number(acc.cash);
          if (useMargin && !(await confirm(`Questo ordine supera la liquidità del conto reale (${Number(acc.cash).toFixed(2)} $): per eseguirlo Alpaca ti presterebbe la differenza. È LEVA con denaro vero: paghi interessi, e se i titoli scendono Alpaca può venderli senza avvisarti e puoi perdere più di quanto hai versato. Vuoi davvero usare il margine?`))) { msg.textContent = 'Ordine annullato: niente margine.'; return; }
        }
        confirmWord = await typedConfirm(`${useMargin ? 'CON MARGINE (denaro in prestito da Alpaca). ' : ''}${side === 'buy' ? 'ACQUISTO' : 'VENDITA'} ${type === 'market' ? 'a mercato' : type === 'limit' ? `limite a ${pr}` : `stop a ${pr}`} di ${sym} per circa ${amt.toFixed(2)} $. Costi: eventuale spread${isCrypto ? ' e commissione cripto di Alpaca' : ''}. Limiti: ${perOrder} $ per ordine, ${perMonth} $ al mese.`);
        if (!confirmWord) { msg.textContent = 'Ordine annullato.'; return; }
      }
      // ordini frazionati: a mercato per importo; limite e stop per quantità con i decimali, se il titolo lo permette
      // (su azioni ed ETF Alpaca li accetta solo validi per la giornata). Altrimenti quote intere.
      const frac = isCrypto || info.fractionable !== false;
      const order: A.OrderReq = { symbol: sym, side, type, time_in_force: isCrypto ? 'gtc' : 'day', client_order_id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
      if (type === 'market' && frac) order.notional = amt.toFixed(2);
      else {
        const ref = pr || (await A.latest(sym, isCrypto ? 'crypto' : 'stocks')).price;
        const q = liveQty(amt, ref, frac);
        if (!(q > 0)) throw new Error(frac ? 'Importo troppo basso per questo ordine.' : 'Questo titolo si compra solo a quote intere: l\'importo non basta per una quota.');
        order.qty = frac ? q.toFixed(6) : String(q);
      }
      if (type === 'limit') order.limit_price = String(pr);
      if (type === 'stop') {
        order.stop_price = String(pr);
        // Alpaca non accetta stop "a mercato" sulle cripto: si usa uno stop limit con un margine del 3%
        if (isCrypto) { order.type = 'stop_limit'; order.limit_price = String(+(side === 'sell' ? pr * 0.97 : pr * 1.03).toPrecision(8)); }
      }
      const out = await A.submitOrder(env, order, confirmWord, useMargin);
      let refPx = pr;
      if (!refPx) { try { refPx = (await A.latest(sym, isCrypto ? 'crypto' : 'stocks')).price; } catch { refPx = 0; } }
      if (env === 'live') {
        if (side === 'buy') S.liveLimits.spentThisMonth += amt;
        S.liveAudit.push({ t: Date.now(), symbol: sym, side, notional: amt, status: out.status, id: out.id });
        save();
      }
      msg.innerHTML = `<span class="good">Ordine inviato: stato ${esc(out.status)}.</span>`;
      setTimeout(() => void reload(), 1200);
      await journalPrompt({ asset: sym, side, amount: amt, price: refPx, account: env === 'live' ? 'reale' : 'paper' });
    } catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; }
  });
}

function typedConfirm(summary: string): Promise<string | undefined> {
  return modal<string>('Conferma ordine REALE', ({ body, button, close }) => {
    body.innerHTML = `<p>${esc(summary)}</p><p>Per confermare scrivi <b>CONFERMO</b>.</p><input class="tx cw" autocomplete="off">`;
    const i = body.querySelector('.cw') as HTMLInputElement;
    setTimeout(() => i.focus(), 30);
    const send = () => { if (i.value.trim() === 'CONFERMO') close('CONFERMO'); else i.style.borderColor = 'red'; };
    // da tastiera: Invio nel campo equivale al pulsante Invia
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    button('Invia', send, 'danger');
    button('Annulla', () => close(undefined));
  }, { serious: true, closable: false });
}

/** Quantità per un ordine dal conto reale: frazionata fino a sei decimali se il titolo lo permette, altrimenti intera. */
export function liveQty(amount: number, price: number, fractionable: boolean): number {
  if (!(amount > 0) || !(price > 0)) return 0;
  return fractionable ? Math.floor((amount / price) * 1e6) / 1e6 : Math.floor(amount / price);
}

function liveBustHtml(lv: Acc.LiveState): string {
  if (lv.state === 'ok') return lv.base > 0 ? '<p class="small muted">Se questo conto arriva a zero è bancarotta anche qui: il gioco smette di inviare acquisti, per qualche giorno o per sempre secondo la difficoltà.</p>' : '';
  const lesson = lv.fresh ? '<p>Questo conto è arrivato a zero. Fermati: prima di qualsiasi altra operazione rileggi nel Diario come ci sei arrivato. Rincorrere le perdite con altro denaro è l\'errore che le raddoppia.</p>' : '';
  if (lv.state === 'closed') return `<p class="bad"><b>BANCAROTTA SUL CONTO REALE.</b> Da questa partita il gioco non invia più acquisti con denaro vero.</p>${lesson}<p class="small">Vendere da qui e prelevare dal sito di Alpaca resta sempre possibile. Il gioco non tocca il tuo denaro.</p>`;
  return `<p class="bad"><b>BANCAROTTA SUL CONTO REALE.</b> Gli acquisti dal gioco sono fermi fino al ${new Date(lv.until).toLocaleDateString('it-IT')}.</p>${lesson}<p class="small">Vendere da qui e prelevare dal sito di Alpaca resta sempre possibile. Alla fine della pausa il gioco riparte dal patrimonio che troverà.${lv.busts <= 1 ? ' Solo questa prima volta, se proprio vuoi ricaricare il conto, la regola del gioco è: non più della metà di quello che il conto aveva all\'inizio, e dal sito di Alpaca. Il gioco non sposta denaro e non te lo chiederà mai.' : ' Stavolta nessuna ricarica: la regola del gioco la concede una volta sola.'}</p>`;
}
