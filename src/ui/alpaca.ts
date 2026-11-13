// Collegamento al conto Alpaca Paper: chiavi, stato del conto, Osservatorio e grafici con le barre reali.
// Tradermon è un gioco: usa solo il conto Paper di Alpaca, con denaro finto, e non usa mai denaro reale.
import * as A from '../systems/alpaca';
import { S } from '../systems/state';
import { say, choose, modal, esc, toast, confirm } from './core';
import { openChart } from './chart';
import { BARS_SHOWN, type Timeframe } from '../systems/candles';
import { fmtPx, withUsd } from '../systems/portfolio';
import * as C from '../systems/cloud';
import * as K from '../systems/keystore';
import { cloudPlayer } from '../systems/sync';
import { unlockForm } from './account';
import { T, LOCALE } from '../i18n';

const NURSE = T('Dott.ssa Ratio');

/** Frase unica, ripetuta dove il giocatore collega o guarda il conto. */
export const PAPER_ONLY = T('Tradermon è un gioco per imparare: usa solo il conto Paper di Alpaca, con denaro finto e prezzi veri. Non vengono mai usati soldi reali.');

/** Grafico a candele di un simbolo reale: barre Alpaca a 5 min, 15 min, 1 ora, 4 ore o 1 giorno. */
export function realChart(sym: string, marker?: { price: number; label: string }) {
  const isCrypto = sym.includes('/');
  const TF: Record<Timeframe, { tf: A.BarTimeframe; days: number }> = { '5m': { tf: '5Min', days: 3 }, '15m': { tf: '15Min', days: 7 }, '1h': { tf: '1Hour', days: 20 }, '4h': { tf: '4Hour', days: 70 }, '1g': { tf: '1Day', days: 260 } };
  return openChart({
    title: sym,
    marker,
    note: T('Barre fornite da Alpaca per il tuo conto (azioni: feed IEX, in ritardo rispetto al mercato). Nessun consiglio.'),
    load: async (tf) => {
      const { tf: atf, days } = TF[tf];
      const end = new Date(), start = new Date(Date.now() - days * 864e5);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const r = await A.bars(sym, isCrypto ? 'crypto' : 'stocks', iso(start), iso(end), atf);
      return r.bars.map((b) => ({ t: Math.floor(new Date(b.t).getTime() / 60000), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v })).slice(-BARS_SHOWN[tf]);
    },
  });
}

/** Scollega il conto Alpaca Paper da questo dispositivo, dopo conferma. Restituisce true se le chiavi sono state tolte. */
export async function unlinkPaper(st: A.ServerStatus): Promise<boolean> {
  if (!(await confirm(T('Scollegare il conto Alpaca Paper? Potrai collegarlo di nuovo quando vuoi: se ne colleghi uno diverso, il registro di gioco si riallinea al nuovo conto e riparte dal capitale iniziale.')))) return false;
  await A.deleteKeys('paper');
  // le versioni precedenti tenevano una copia cifrata online: se c'è ancora, va via anche quella
  if (cloudPlayer()) { try { await C.removeAlpacaKeys('paper'); } catch { /* nessuna copia o offline: verrà tolta al prossimo accesso */ } }
  toast(onSite(st) ? T('Conto Alpaca Paper scollegato da questo dispositivo. Per rendere le chiavi inutilizzabili ovunque, revocale anche dalla dashboard di Alpaca.') : T('Conto Alpaca Paper scollegato: chiavi rimosse dal server locale.'));
  return true;
}

/** Chi aveva scelto di passare dal servizio di Tradermon può tornare al collegamento diretto con Alpaca. */
export async function backToDirect(): Promise<void> {
  await say(T('Su questo dispositivo hai scelto di far passare il conto Paper dal servizio di Tradermon, perché il browser non raggiungeva Alpaca. Se ora la connessione lo permette puoi tornare al collegamento diretto.'), NURSE);
  if ((await choose([T('Torna al collegamento diretto'), T('Resta così')], { cancel: true })) === 0) { A.allowRelay(false); toast(T('Collegamento diretto con Alpaca riattivato: le chiavi non passano più dal servizio di Tradermon.')); }
}

/** Osservatorio: conto Paper, posizioni e prezzi Alpaca in sola lettura. Nessun pulsante d'ordine: qui si guarda, non si opera. */
export async function openObservatory() {
  const st = await A.serverStatus();
  if (!st) return say(A.noServerLines(T('l\'Osservatorio Alpaca')), NURSE);
  if (!st.paper.configured) return say([T('Nessun conto Alpaca Paper collegato.'), T('Collegalo dalla voce "Chiavi API": l\'Osservatorio mostra conto e prezzi senza mai inviare ordini.')], NURSE);
  const env: A.Env = 'paper';
  await modal(T('Osservatorio Alpaca · conto Paper (sola lettura)'), ({ body, button, close }) => {
    const load = async () => {
      body.innerHTML = T('<p>Caricamento...</p>');
      try {
        const [acc, pos, ord, clk] = await Promise.all([A.account(env), A.positions(env), A.openOrders(env), A.clock(env).catch(() => null)]);
        const mine = S.journal.filter((j) => j.account === 'paper');
        body.innerHTML = T`
          <p class="small muted">Qui si osserva soltanto: nessun ordine può partire da questa schermata. ${esc(PAPER_ONLY)}</p>
          <p><b>Valore:</b> ${Number(acc.portfolio_value).toFixed(2)} ${acc.currency} · <b>Liquidità:</b> ${Number(acc.cash).toFixed(2)} · <b>Stato:</b> ${esc(acc.status)} · ${clk ? (clk.is_open ? T('<span class="good">Mercato aperto</span>') : T`Mercato chiuso${clk.next_open ? ` · riapre ${new Date(clk.next_open).toLocaleString(LOCALE)}` : ''}`) : ''}</p>
          ${pos.length ? T`<table class="t"><tr><th>Simbolo</th><th class="n">Quantità</th><th class="n">Prezzo medio</th><th class="n">Prezzo attuale</th><th class="n">Valore</th><th class="n">P&amp;L</th><th>Diario</th></tr>${pos.map((p) => { const j = mine.filter((x) => x.asset === p.symbol); return `<tr><td><b>${esc(p.symbol)}</b></td><td class="n">${p.qty}</td><td class="n">${Number(p.avg_entry_price).toFixed(2)}</td><td class="n">${Number(p.current_price).toFixed(2)}</td><td class="n">${Number(p.market_value).toFixed(2)}</td><td class="n ${Number(p.unrealized_pl) >= 0 ? 'good' : 'bad'}">${(Number(p.unrealized_plpc) * 100).toFixed(2)}%</td><td class="small">${j.length ? esc(j[j.length - 1].reason) : '<span class="muted">—</span>'}</td></tr>`; }).join('')}</table>` : T('<p class="muted">Nessuna posizione.</p>')}
          <h4>Ordini aperti</h4>${ord.length ? `<ul class="small" style="margin:0 0 0 16px">${ord.map((o) => `<li>${esc(o.side)} ${esc(o.type)} ${esc(o.symbol)} ${o.notional ? o.notional + ' $' : o.qty} · ${esc(o.status)}</li>`).join('')}</ul>` : T('<span class="muted">Nessuno</span>')}
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
          try { const r = await A.latest(sym, sym.includes('/') ? 'crypto' : 'stocks'); msg.innerHTML = `<b>${esc(sym)}</b>: ${withUsd(fmtPx(r.price))}`; }
          catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; }
        });
      } catch (e) { body.innerHTML = `<p class="bad">${esc((e as Error).message)}</p>`; }
    };
    void load();
    button(T('Aggiorna'), () => void load());
    button(T('Chiudi'), () => close(), 'primary');
  }, { wide: true });
}

/** Il gioco è aperto dal sito pubblico: nessun server locale, le chiavi stanno sul dispositivo. */
const onSite = (st: A.ServerStatus | null) => !!(st?.direct || st?.cloud);

/** Avviso prima dell'inserimento delle chiavi: dove restano, a chi vengono inviate, che cosa comporta. */
function keysNotice(site: boolean): string {
  const game = `<p><b>${esc(PAPER_ONLY)}</b></p>`;
  if (!site) return T`<div class="small keys-notice">${game}<p>Le chiavi vengono inviate una sola volta al server locale di Tradermon in esecuzione sul tuo computer, che le verifica con Alpaca e le salva in <code>server/.secrets/keys.json</code>. Il gioco non le salva nel browser, non le manda online e non le mette nel salvataggio: su un altro computer dovrai inserirle di nuovo.</p></div>`;
  return T`
    <div class="small keys-notice">
      ${game}
      <p><b>Dove restano le chiavi.</b> Solo su questo dispositivo, cifrate (AES-256) con la password del tuo giocatore. Non vanno online, non entrano nel salvataggio della partita e nessun server di Tradermon le riceve o le conserva.</p>
      <p><b>A chi vengono inviate.</b> Soltanto ad Alpaca: è il tuo browser a parlare direttamente con Alpaca, su connessione cifrata, ogni volta che il gioco legge il conto Paper o invia un ordine deciso da te.</p>
      <p><b>Che cosa comporta.</b> Su un altro dispositivo o browser dovrai inserirle di nuovo. Se cancelli i dati del sito le perdi: ne generi di nuove dalla dashboard di Alpaca. Chi usa questo browser mentre il tuo giocatore è collegato può usarle: su un dispositivo condiviso esci dal giocatore quando hai finito. Puoi revocarle in ogni momento dalla dashboard di Alpaca: smettono di funzionare subito.</p>
    </div>`;
}

const RELAY_TEXT = T('Le chiavi Paper verranno inviate, a ogni richiesta e su connessione cifrata, al servizio di Tradermon, che le usa per parlare con Alpaca e non le salva. Vale solo su questo dispositivo: puoi tornare al collegamento diretto dalla voce "Chiavi API" del menu.');

/** Il browser non raggiunge Alpaca: chiede al giocatore se far passare il conto Paper dal servizio di Tradermon. */
export async function offerRelay(): Promise<boolean> {
  await say([T('Questo browser non riesce a raggiungere Alpaca direttamente: può dipendere dalla rete o da un blocco di contenuti.'), RELAY_TEXT], NURSE);
  const ok = (await choose([T('Sì, passa dal servizio di Tradermon'), T('No, riprovo più tardi')], { cancel: true, prompt: T('Vuoi far passare il conto Paper dal servizio di Tradermon?'), who: NURSE })) === 0;
  if (ok) A.allowRelay(true);
  return ok;
}

/** Modulo per le chiavi del conto Alpaca Paper. */
export async function keysForm(): Promise<boolean> {
  const site = onSite(await A.serverStatus());
  const res = await modal<boolean>(T('Collega Alpaca Paper'), ({ body, button, close }) => {
    body.innerHTML = T`
      <p>Inserisci le chiavi API generate nella dashboard di Alpaca, in modalità <b>Paper</b>.</p>
      ${keysNotice(site)}
      ${site ? T('<label class="small"><input type="checkbox" class="read"> <span>Ho letto dove restano le chiavi e che cosa comporta.</span></label>') : ''}
      <label style="display:block;margin-top:8px">Key ID<input class="tx kid" autocomplete="off" spellcheck="false"></label>
      <label style="display:block;margin-top:8px">Secret Key<input class="tx sec" type="password" autocomplete="off" spellcheck="false"></label>
      <p class="msg small"></p>`;
    const msg = body.querySelector('.msg') as HTMLElement;
    const read = body.querySelector('.read') as HTMLInputElement | null;
    const submit = async () => {
      const kid = (body.querySelector('.kid') as HTMLInputElement).value.trim();
      const sec = (body.querySelector('.sec') as HTMLInputElement).value.trim();
      if (!kid || !sec) { msg.textContent = T('Compila entrambi i campi.'); return; }
      b.disabled = true;
      msg.textContent = T('Verifica con Alpaca in corso...');
      try {
        const r = await A.setKeys('paper', kid, sec);
        const note = site ? await keepOnDevice(r) : '';
        (body.querySelector('.sec') as HTMLInputElement).value = '';
        msg.innerHTML = T`<span class="good">Collegato. Stato del conto: ${esc(r.account?.status ?? '')}.</span>${note ? `<br><span class="small">${esc(note)}</span>` : ''}`;
        setTimeout(() => close(true), note ? 2200 : 900);
      } catch (e) {
        const m = (e as Error).message;
        // la riserva non parte da sola: la sceglie il giocatore
        if (m === A.DIRECT_BLOCKED && (await offerRelay())) { b.disabled = false; void submit(); return; }
        msg.innerHTML = `<span class="bad">${esc(m)}</span>`;
        b.disabled = !!read && !read.checked;
      }
    };
    const b = button(T('Verifica e salva'), () => void submit(), 'primary');
    if (read) { b.disabled = true; read.addEventListener('change', () => { b.disabled = !read.checked; }); }
    button(T('Annulla'), () => close(false));
  });
  return !!res;
}

/** Dal sito: le chiavi verificate vanno salvate cifrate sul dispositivo. Restituisce una nota per il giocatore ('' se salvate). */
async function keepOnDevice(r: { stored?: boolean; storeError?: string }): Promise<string> {
  if (r.stored) return T('Chiavi salvate cifrate su questo dispositivo.');
  const only = T('le chiavi valgono solo finché questa pagina resta aperta, poi andranno inserite di nuovo.');
  if (r.storeError) return T`Chiavi non salvate sul dispositivo (${r.storeError}): ${only}`;
  if (!(await unlockForm(T('Per salvare le chiavi cifrate su questo dispositivo serve la password del giocatore.')))) return T`Chiavi non salvate sul dispositivo: ${only}`;
  const again = await A.persistKeys('paper');
  return again.stored ? T('Chiavi salvate cifrate su questo dispositivo.') : T`Chiavi non salvate sul dispositivo${again.storeError ? ` (${again.storeError})` : ''}: ${only}`;
}

/**
 * Le chiavi Paper ci sono ma non sono pronte. Dal sito: sono salvate cifrate su questo dispositivo e si aprono con
 * la password del giocatore. Le copie cifrate che le versioni precedenti tenevano su Supabase vengono portate sul
 * dispositivo (o, in locale, sul server del computer) e cancellate da Supabase.
 */
export async function restoreKeys(st: A.ServerStatus): Promise<boolean> {
  if (!cloudPlayer() || st.paper.configured) return false;
  const site = onSite(st);
  let legacy = false;
  try { legacy = (await C.savedKeyEnvs()).includes('paper'); } catch { legacy = false; }
  const locked = site ? (await A.lockedKeys()).includes('paper') : false;
  if (!legacy && !locked) return false;
  if (!(await C.vaultUnlocked()) && !(await unlockForm(site ? T('Le tue chiavi Alpaca Paper sono salvate cifrate: per usarle su questo dispositivo serve la password del giocatore.') : T('Una versione precedente del gioco ha salvato online una copia cifrata delle tue chiavi Alpaca Paper: per riportarle su questo computer serve la password del giocatore.')))) return false;
  if (site) {
    try { await K.migrateFromCloud(); } catch (e) { toast(T`Copia online delle chiavi non spostata: ${(e as Error).message}`); }
    const now = await A.serverStatus();
    if (!now?.paper.configured) return false;
    toast(T('Chiavi Alpaca Paper aperte su questo dispositivo.'));
    return true;
  }
  try {
    const k = await C.loadAlpacaKeys('paper');
    if (!k) return false;
    await A.setKeys('paper', k.keyId, k.secret);
    await C.removeAlpacaKeys('paper');
    toast(T('Chiavi Alpaca Paper riportate sul server locale e tolte dalla copia online.'));
    return true;
  } catch (e) { toast(T`Chiavi Paper non ripristinate: ${(e as Error).message}`); return false; }
}
