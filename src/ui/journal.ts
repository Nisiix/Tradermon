// Diario dell'investitore: una riga di motivazione dopo ogni operazione e una rilettura dopo 30 giorni.
// Il Diario non tocca mai il conto: registra solo il perché delle scelte.
import { S, save } from '../systems/state';
import { modal, esc, el, toast } from './core';
import { track } from '../systems/progress';
import { ASSET_BY_ID } from '../data/assets';
import { fmtMoney, fmtPx, fmtPct } from '../systems/portfolio';
import type { JournalEntry } from '../types';

export const REASONS: { id: string; text: string; comment: string; warn?: boolean }[] = [
  { id: 'piano', text: 'Segue il mio piano di allocazione', comment: 'Ottimo: le decisioni prese a mente fredda, prima di guardare il prezzo, sono quelle che reggono meglio nel tempo.' },
  { id: 'diversifica', text: 'Per diversificare', comment: 'La diversificazione è l\'unico "pasto gratis" degli investimenti: riduce il rischio senza ridurre per forza il rendimento atteso.' },
  { id: 'lungo', text: 'Credo nel lungo periodo', comment: 'Bene. Ricorda però che "lungo periodo" vuol dire anche sopportare i ribassi senza cambiare idea a metà strada.' },
  { id: 'ribilancio', text: 'Ribilanciamento', comment: 'Il ribilanciamento vende ciò che è salito e compra ciò che è sceso: è una disciplina, non una previsione.' },
  { id: 'sceso', text: 'Il prezzo è sceso: sembra un\'occasione', comment: 'Attenzione: un prezzo basso non è automaticamente un affare. Chiediti se è cambiato qualcosa nell\'azienda o nel mercato, non solo nel grafico.', warn: true },
  { id: 'salito', text: 'Il prezzo sta salendo e non voglio restare fuori', comment: 'Questa si chiama FOMO (paura di restare fuori): è il modo più comune per comprare ai massimi. Rileggerai questa riga tra 30 giorni.', warn: true },
  { id: 'profitto', text: 'Prendo profitto', comment: 'Vendere in guadagno va bene se rientra nel piano. Se lo fai solo per "mettere al sicuro", chiediti dove reinvestirai.' },
  { id: 'perdita', text: 'Taglio una perdita', comment: 'Tagliare una perdita è sensato se la tesi iniziale è saltata. Se vendi solo perché fa male vederla, è avversione alla perdita.', warn: true },
  { id: 'consiglio', text: 'Me l\'ha consigliato qualcuno', comment: 'Un consiglio non è un\'analisi. Chi te l\'ha dato condivide anche le perdite? Rileggi questa riga tra 30 giorni.', warn: true },
  { id: 'boh', text: 'Non so bene', comment: 'Onesto! Un\'operazione senza un perché è la prima da rivedere. Per ora va bene scriverlo: è così che si impara.', warn: true },
];

type Draft = { asset: string; side: 'buy' | 'sell'; amount: number; price: number; account: JournalEntry['account'] };

/** Chiede il perché dell'operazione appena fatta e annota la riga nel Diario. */
export async function journalPrompt(d: Draft): Promise<void> {
  const name = ASSET_BY_ID[d.asset]?.name ?? d.asset;
  const r = await modal<string | null>('Diario dell\'investitore', ({ body, button, close }) => {
    body.innerHTML = `<p class="small">${d.side === 'buy' ? 'Acquisto' : 'Vendita'} di <b>${esc(name)}</b> per ${fmtMoney(d.amount)} a ${fmtPx(d.price)}${d.account !== 'prova' ? ` (conto ${d.account})` : ''}.</p>
      <p>Perché l'hai fatto? Una riga oggi vale un ripasso tra 30 giorni.</p>
      <div class="why">${REASONS.map((x, i) => `<label style="display:block;margin:2px 0"><input type="radio" name="why" value="${x.id}"${i === 0 ? ' checked' : ''}> ${esc(x.text)}</label>`).join('')}</div>
      <label style="display:block;margin-top:6px">Nota (facoltativa) <input class="tx note" maxlength="120" placeholder="es. voglio tenerlo almeno 5 anni"></label>
      <p class="small muted">Frecce per scegliere il motivo, Z/A per confermare.</p>`;
    button('Salta', () => close(null));
    button('Annota', () => close(((body.querySelector('input[name=why]:checked') as HTMLInputElement)?.value ?? REASONS[0].id) + '|' + (body.querySelector('.note') as HTMLInputElement).value.trim()), 'primary');
  });
  if (!r) return;
  const [why, note] = r.split('|');
  const reason = REASONS.find((x) => x.id === why) ?? REASONS[0];
  const e: JournalEntry = { id: `j${Date.now().toString(36)}`, day: S.market.day, date: new Date().toISOString().slice(0, 10), asset: d.asset, side: d.side, amount: d.amount, price: d.price, reason: reason.text, note: note ?? '', account: d.account, reviewed: false };
  S.journal.push(e);
  if (S.journal.length > 200) S.journal.splice(0, S.journal.length - 200);
  track('journal');
  save();
  await modal('Dott.ssa Ratio', ({ body, button, close }) => {
    body.innerHTML = `<p class="${reason.warn ? 'bad' : 'good'}">${esc(reason.comment)}</p>`;
    button('Ok', () => close(), 'primary');
  });
}

/** Righe da rileggere: 30 giorni di mercato simulato (conto di prova) o 30 giorni reali (paper e reale). */
export function dueReviews(): JournalEntry[] {
  const today = Date.now();
  return S.journal.filter((e) => !e.reviewed && (e.account === 'prova' ? S.market.day - e.day >= 30 : today - Date.parse(e.date) >= 30 * 86400000));
}

async function review(e: JournalEntry) {
  const name = ASSET_BY_ID[e.asset]?.name ?? e.asset;
  const now = e.account === 'prova' ? S.market.prices[e.asset] : undefined;
  const chg = now ? now / e.price - 1 : undefined;
  const verdict = await modal<number>('Col senno di poi', ({ body, button, close }) => {
    body.innerHTML = `<p>${e.side === 'buy' ? 'Comprasti' : 'Vendesti'} <b>${esc(name)}</b> a ${fmtPx(e.price)} il giorno ${e.day}${e.date ? ` (${e.date})` : ''}.<br>Motivo: <i>${esc(e.reason)}</i>${e.note ? `<br>Nota: "${esc(e.note)}"` : ''}</p>
      ${chg !== undefined ? `<p>Oggi vale ${fmtPx(now!)} (<span class="${chg >= 0 ? 'good' : 'bad'}">${fmtPct(chg)}</span>).</p>` : '<p class="small muted">Per i conti Alpaca controlla il prezzo attuale nell\'Osservatorio.</p>'}
      <p>Rileggendo il motivo, oggi rifaresti la stessa scelta?</p>`;
    button('Sì, era coerente col piano', () => close(0), 'primary');
    button('No, ho seguito l\'emozione', () => close(1));
    button('Non so', () => close(2));
  });
  if (verdict === undefined) return;
  e.reviewed = true;
  e.note = (e.note ? e.note + ' · ' : '') + ['Rilettura: coerente', 'Rilettura: emotiva', 'Rilettura: incerta'][verdict];
  track('review_journal');
  S.stats.xp += 10;
  const good = chg === undefined ? null : (e.side === 'buy') === (chg >= 0);
  toast(verdict === 1 ? 'Riconoscere un\'emozione è già metà della cura. +10 Conoscenza' : good === false ? 'Il risultato non era buono, ma un buon processo conta più di un singolo esito. +10 Conoscenza' : 'Rilettura annotata. +10 Conoscenza');
  save();
}

export async function openJournal() {
  for (;;) {
    const due = dueReviews();
    const r = await modal<string>('Diario dell\'investitore', ({ body, button, close }) => {
      const warnShare = S.journal.length ? S.journal.filter((e) => REASONS.find((x) => x.text === e.reason)?.warn).length / S.journal.length : 0;
      body.innerHTML = `<p class="small">Righe: <b>${S.journal.length}</b> · da rileggere: <b>${due.length}</b> · motivi "emotivi": <b>${Math.round(warnShare * 100)}%</b>${S.journal.length >= 5 ? (warnShare > 0.5 ? ' <span class="bad">(più della metà: fermati a riflettere prima di operare)</span>' : ' <span class="good">(bene: la maggior parte delle scelte segue un piano)</span>') : ''}</p>`;
      if (!S.journal.length) body.appendChild(el('p', 'muted', 'Dopo ogni acquisto o vendita, in Clinica o con Alpaca, ti chiederò il perché. Le righe compaiono qui.'));
      const tbl = el('table', 't');
      tbl.innerHTML = '<tr><th>Giorno</th><th>Operazione</th><th>Motivo</th><th></th></tr>';
      for (const e of [...S.journal].reverse().slice(0, 40)) {
        const tr = el('tr');
        const name = ASSET_BY_ID[e.asset]?.name ?? e.asset;
        tr.innerHTML = `<td>${e.day}<br><span class="small muted">${esc(e.date)}</span></td><td>${e.side === 'buy' ? 'Compra' : 'Vendi'} <b>${esc(name)}</b> ${fmtMoney(e.amount)} a ${fmtPx(e.price)}${e.account !== 'prova' ? ` <span class="small muted">${e.account}</span>` : ''}</td><td><i>${esc(e.reason)}</i>${e.note ? `<br><span class="small">${esc(e.note)}</span>` : ''}</td>`;
        const td = el('td');
        if (due.includes(e)) { const b = el('button', 'btn', 'Rileggi'); b.addEventListener('click', () => close(e.id)); td.appendChild(b); }
        else if (e.reviewed) td.innerHTML = '<span class="small good">✓</span>';
        tr.appendChild(td);
        tbl.appendChild(tr);
      }
      body.appendChild(tbl);
      if (due.length) button(`Rileggi la più vecchia (${due.length})`, () => close(due[0].id));
      button('Chiudi', () => close(), 'primary');
    }, { wide: true });
    if (!r) return;
    const e = S.journal.find((x) => x.id === r);
    if (e) await review(e);
  }
}
