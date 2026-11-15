// Lettore dei libri: una pagina alla volta, con il numero di pagina, il livello del libro e le figure.
// A fine lettura propone una verifica veloce (una o due domande su quel libro, senza timer e senza perdere
// Fiducia): ricordare subito ciò che si è letto lo fissa molto più che rileggerlo. Le risposte entrano nel Ripasso.
// Come nei duelli, chi sbaglia non vede la risposta giusta: torna alla pagina che la spiega.
import type { Question } from '../types';
import type { Book } from '../data/books';
import { modal, esc, choose, el } from './core';
import type { Key } from './input';
import { figure } from './figures';
import { bookLevel, LEVEL_LABEL, questionsForBook, bookPageFor } from '../data/bookmap';
import { S } from '../systems/state';
import { recordAnswer, targetDiff, storyStage } from '../systems/quiz';
import { shuffle } from '../systems/rng';
import { gtext } from '../systems/gender';
import { beep } from '../systems/audio';
import { T } from '../i18n';

export interface ReadResult { finished: boolean; checked: number; right: number }

/** Mostra il libro dalla pagina `start`. Restituisce true se il giocatore è arrivato all'ultima pagina. */
export async function showBook(book: Book, start = 0): Promise<boolean> {
  let page = Math.max(0, Math.min(book.pages.length - 1, start));
  let reachedEnd = page === book.pages.length - 1;
  let render = () => {};
  const res = await modal<boolean>(book.title, ({ body, button, close }) => {
    const prev = button(T('◀ Indietro'), () => go(-1));
    const next = button(T('Avanti ▶'), () => go(1), 'primary');
    button(T('Chiudi'), () => close(reachedEnd));
    const go = (d: number) => {
      const p = page + d;
      if (p < 0) return;
      if (p >= book.pages.length) { close(true); return; }
      page = p; beep('tick'); render();
    };
    render = () => {
      if (page === book.pages.length - 1) reachedEnd = true;
      const fig = book.figs?.[page] ? figure(book.figs[page]) : null;
      body.innerHTML = `<div class="book-meta small muted">${esc(LEVEL_LABEL[bookLevel(book)])} · ${esc(T`Pagina ${page + 1} di ${book.pages.length}`)}</div>`
        + `<p class="book-page">${esc(gtext(book.pages[page]))}</p>`
        + (fig ? `<figure class="fig">${fig.svg}<figcaption class="small muted">${esc(fig.caption)}</figcaption></figure>` : '');
      prev.disabled = page === 0;
      next.textContent = page === book.pages.length - 1 ? T('Fine ▶') : T('Avanti ▶');
      next.focus();
    };
    render();
  }, { wide: true, cls: 'book', onKey: (k: Key) => {
    // le frecce sfogliano: sinistra indietro, destra avanti (A conferma il pulsante evidenziato, cioè Avanti)
    if (k !== 'left' && k !== 'right') return false;
    const btn = document.querySelector<HTMLButtonElement>(`.modal.book .foot button:nth-child(${k === 'left' ? 1 : 2})`);
    if (btn && !btn.disabled) btn.click();
    return true;
  } });
  return reachedEnd || !!res;
}

/** Domande per la verifica: spiegate da questo libro, non oltre il livello della storia, prima quelle mai viste. */
export function checkQuestions(book: Book, n = 2, rng: () => number = Math.random): Question[] {
  const cap = Math.max(2, Math.ceil(targetDiff(storyStage())));
  const pool = questionsForBook(book.id).filter((q) => q.diff <= cap);
  return shuffle(pool, rng).sort((a, b) => (S.answered[a.id] ?? 0) - (S.answered[b.id] ?? 0)).slice(0, n);
}

/** Una domanda della verifica: niente timer, niente Fiducia in gioco. Se sbagli ti dice quale pagina rileggere. */
async function checkOne(q: Question, book: Book, i: number, n: number): Promise<boolean> {
  const order = shuffle([0, 1, 2, 3]);
  let ok = false;
  await modal(T`Verifica · ${i}/${n}`, ({ body, close, foot }) => {
    body.innerHTML = `<p><b>${esc(gtext(q.q))}</b></p>`;
    const opts = el('div', 'check-opts');
    body.appendChild(opts);
    const out = el('div', 'check-out');
    body.appendChild(out);
    order.forEach((o, j) => {
      const b = el('button', 'btn opt', `${'ABCD'[j]}. ${esc(gtext(q.options[o]))}`) as HTMLButtonElement;
      b.addEventListener('click', () => {
        if (opts.dataset.done) return;
        opts.dataset.done = '1';
        ok = o === q.answer;
        recordAnswer(q, ok);
        beep(ok ? 'ok' : 'bad');
        b.classList.add(ok ? 'right' : 'wrong');
        opts.querySelectorAll('button').forEach((x) => { (x as HTMLButtonElement).disabled = x !== b; });
        const page = bookPageFor(q, [book])?.page ?? 0;
        out.innerHTML = ok
          ? `<p>${T('<b class="good">Giusto!</b>')} ${esc(gtext(q.explain))}</p>`
          : `<p>${T('<b class="bad">Non è così.</b>')} ${esc(book.pages.length > 1 ? T`La risposta è a pagina ${page + 1}: rileggila e riprova più avanti.` : T('Rileggi il libro e riprova più avanti.'))}</p>`;
        const cont = el('button', 'btn primary', T('Continua ▶'));
        cont.addEventListener('click', () => close());
        foot.appendChild(cont);
        cont.focus();
      });
      opts.appendChild(b);
    });
    setTimeout(() => (opts.querySelector('button') as HTMLButtonElement | null)?.focus(), 30);
  }, { wide: true, cls: 'check' });
  return ok;
}

/**
 * Legge un libro e, se arrivi in fondo, propone la verifica. Le domande sbagliate restano nel Ripasso.
 * `check: false` per i libri senza domande (taccuini delle grotte, storie dei mercati).
 */
export async function readBook(book: Book, opts: { check?: boolean } = {}): Promise<ReadResult> {
  const finished = await showBook(book);
  const out: ReadResult = { finished, checked: 0, right: 0 };
  if (!finished || opts.check === false) return out;
  const qs = checkQuestions(book);
  if (!qs.length) return out;
  const c = await choose([T('Mi metto alla prova'), T('Basta così')], { cancel: true, prompt: T('Due domande veloci su quello che hai appena letto? Niente timer, niente Fiducia in gioco.') });
  if (c !== 0) return out;
  for (let i = 0; i < qs.length; i++) {
    out.checked++;
    if (await checkOne(qs[i], book, i + 1, qs.length)) out.right++;
  }
  S.counters.bookCheck = (S.counters.bookCheck ?? 0) + out.checked;
  if (out.right < out.checked) {
    const again = await choose([T('Rileggo il libro'), T('Più tardi')], { cancel: true, prompt: T`${out.right} su ${out.checked}. Le domande sbagliate torneranno nel Ripasso.` });
    if (again === 0) await showBook(book);
  }
  return out;
}
