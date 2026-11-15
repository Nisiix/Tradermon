// Vetrina della Valigetta: la scelta del primo titolo vero. Si apre dal Professore quando il conto Alpaca Paper
// è già collegato, altrimenti in Banca al primo "Compra / Vendi" dopo il collegamento: senza conto non c'è niente da comprare.
import type { AssetClass } from '../types';
import { S, save, card } from '../systems/state';
import { say, modal, esc, el } from './core';
import { hasPrices } from '../systems/realdata';
import { caseOpen } from '../systems/account';
import { fmtPx, withUsd } from '../systems/portfolio';
import { ASSET_BY_ID, starterOptions, classesOf, SECTOR_LABEL, CLASS_LABEL } from '../data/assets';
import { T } from '../i18n';

/** Vetrina della Valigetta: il primo titolo vero, scelto dal giocatore tra pochi nomi curati. Non è un consiglio. */
export async function chooseStarter(cls: AssetClass | AssetClass[]): Promise<string> {
  const groups = (Array.isArray(cls) ? cls : [cls]).map((c) => ({ cls: c, opts: starterOptions(c) }));
  const px = S.market.prices;
  for (;;) {
    const id = await modal<string>(T('La vetrina della Valigetta'), ({ body, button, close }) => {
      // si sceglie toccando la card, poi si conferma con l'unico pulsante OK (come nel Carrello diversificato)
      let pick = '';
      body.innerHTML = T`<p class="small">Scegli il tuo primo titolo: tocca la sua scheda, poi premi OK. Sono titoli veri, messi in vetrina perché si prestano a imparare: non è un consiglio, e gli altri li ritroverai tutti dopo il primo Attestato.</p>`;
      const cards: HTMLButtonElement[] = [];
      // con più classi le schede sono compatte, così si vedono tutte insieme: la descrizione compare sotto, per il titolo scelto
      const compact = groups.length > 1;
      const detail = el('p', 'small', compact ? T('Tocca una scheda per leggere la descrizione del titolo.') : '');
      // una griglia per classe, con il nome della classe sopra quando la Valigetta ne contiene più di una
      for (const g of groups) {
        if (groups.length > 1) body.appendChild(el('p', 'small', `<b>${CLASS_LABEL[g.cls]}</b>`));
        const grid = el('div', compact ? 'cards compact' : 'cards');
        for (const a of g.opts) {
          const c = el('button', 'card pick', T`<span><b>${esc(a.name)}</b> (${esc(a.ticker)})<br><span class="small">${SECTOR_LABEL[a.sector]} · rischio indicativo ${'★'.repeat(a.risk)}${hasPrices() && px[a.id] ? ` · ${withUsd(fmtPx(px[a.id]))}` : ''}</span><br><span class="small">${compact ? '' : esc(a.desc)}</span></span>`.replace('<br><span class="small"></span>', ''));
          c.type = 'button';
          c.dataset.id = a.id;
          c.setAttribute('aria-pressed', 'false');
          c.addEventListener('click', (ev) => {
            pick = a.id;
            if (compact) detail.innerHTML = `<b>${esc(a.name)}</b>: ${esc(a.desc)}`;
            for (const o of cards) { const on = o.dataset.id === pick; o.classList.toggle('gold', on); o.setAttribute('aria-pressed', String(on)); }
            ok.disabled = false;
            // da tastiera o pulsante A (clic senza puntatore) si passa subito a OK: un altro A conferma
            if (ev.detail === 0) ok.focus();
          });
          grid.appendChild(c);
          cards.push(c);
        }
        body.appendChild(grid);
      }
      if (compact) body.appendChild(detail);
      const ok = button('OK', () => { if (pick) close(pick); }, 'primary');
      ok.disabled = true;
      setTimeout(() => cards[0]?.focus(), 40);
    }, { closable: false, wide: true });
    if (id) return id;
  }
}

/** Mette il titolo scelto nell'Album e lo ricorda come titolo della Valigetta. */
export async function takeStarter(id: string, who: string): Promise<void> {
  S.flags.starterAsset = id;
  card(id);
  save();
  await say([T`La scheda di ${ASSET_BY_ID[id].name} è entrata nel tuo Album dell'investitore.`], who);
}

/** Chi ha rimandato il collegamento del conto sceglie il titolo della Valigetta prima del primo acquisto. */
export async function ensureStarter(who: string): Promise<void> {
  if (!S.flags.starter || S.flags.starterAsset || caseOpen()) return;
  await say([T('Prima di aprire la Valigetta scegli il titolo con cui aprirla: ecco la vetrina.')], who);
  await takeStarter(await chooseStarter(classesOf(S.track, S.mixedClasses)), who);
}
