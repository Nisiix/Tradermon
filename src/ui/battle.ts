import { gtext } from '../systems/gender';
import { play, stop, currentTrack, jingle } from '../systems/music';
import { track } from '../systems/progress';
import type { Question } from '../types';
import { el, esc, getStage, wait, bar } from './core';
import { pushHandler, popHandler, type Key } from './input';
import { S, profileTimer } from '../systems/state';
import { recordAnswer } from '../systems/quiz';
import { shuffle } from '../systems/rng';
import { portrait, playerPal } from '../art/art';
import { arenaTransition, mountArena, ARENA_ACCENT, ARENA_TAPE, type Arena } from './arena';
import { beep } from '../systems/audio';
import { markDuelDone } from './savebtn';
import { FIDUCIA_PER_CORRECT, DIFFICULTY } from '../systems/balance';
import { studyHint } from '../data/quiz/hint';
import { errorsAllowed, errorsLeft, lifeAfterWrong, lifeShown, fiduciaAfterWin } from '../systems/duelLife';
import { T } from '../i18n';

export interface DuelOpts {
  foeName: string;
  foeTitle?: string;
  foePal: number;
  questions: Question[];
  need: number;
  /**
   * > 0: sfida con rischio, la barra del giocatore è la sua Fiducia e gli errori la consumano davvero.
   * 0: sfida senza rischio, la barra parte piena e la Fiducia resta com'era.
   * In entrambi i casi ogni errore toglie 100 / (errori concessi + 1): vedi systems/duelLife.ts.
   */
  damage: number;
  intro?: string;
  /** Sfida a numero fisso di domande (Whale e Wall Street): si rispondono tutte, ma a Fiducia zero si va in tilt. */
  fixed?: boolean;
  /** Allenamento a punteggio (Ripasso, sfide con codice): si risponde a tutte le domande e la barra del giocatore non c'è. */
  practice?: boolean;
  /** Sfida di prova (il primo duello con Leo): come un allenamento, ma con l'avversario e la sua Convinzione. Nessuna sconfitta. */
  tutorial?: boolean;
  /** Luogo della sfida: decide sfondo, colori e nastro (predefinito: la piazza delle quotazioni). */
  arena?: Arena;
}

export interface DuelResult { win: boolean; correct: number; total: number; perfect: boolean; tilted: boolean; ids: string[]; wrong: string[] }

/**
 * Esito dell'ultimo duello: in tilt solo se la Fiducia è finita PRIMA di esaurire gli errori concessi
 * (si era partiti con poca Fiducia). Perdere per troppi errori porta la barra a zero ma non è un tilt.
 */
export let lastDuelTilted = false;

export async function runDuel(o: DuelOpts): Promise<DuelResult> {
  if (o.tutorial) o = { ...o, practice: true, damage: 0, fixed: true };
  const prevTrack = currentTrack();
  play('battle');
  const theme: Arena = o.arena ?? 'piazza';
  await arenaTransition(theme);
  lastDuelTilted = false;
  const total = o.questions.length;
  const allowed = errorsAllowed(total, o.need);
  const risky = o.damage > 0;
  // con rischio la barra è la Fiducia di adesso; senza rischio parte piena e non tocca la Fiducia salvata
  let life = risky ? S.stats.fiducia : 100;
  let wrongs = 0;
  return new Promise((resolve) => {
    const stage = getStage();
    const root = el('div', `battle th-${theme}`);
    root.style.setProperty('--acc', ARENA_ACCENT[theme]);
    const words = ARENA_TAPE[theme].map((w) => `<span class="${w.endsWith('▼') ? 'dn' : 'up'}">${esc(w)}</span>`).join('');
    // due postazioni affiancate alla stessa altezza, entrambe rivolte al giocatore: un confronto in sala, non un incontro nell'erba
    root.innerHTML = `
      <div class="tape" aria-hidden="true"><div class="tape-in">${words}${words}</div></div>
      <div class="arena">
        <div class="side me">
          <div class="plate me-p"><div class="nm">${esc(S.name)}</div>${S.title ? `<div class="tt">${esc(T(S.title))}</div>` : T('<div class="tt">Sfidante</div>')}${o.tutorial ? T('<div class="row-m"><span class="lb">Sfida di prova</span><b>nessun rischio</b></div>') : o.practice ? T('<div class="row-m"><span class="lb">Allenamento</span><b>nessun rischio</b></div>') : `<div class="row-m"><span class="lb">${risky ? T('Fiducia') : T('Tenuta')}</span><b class="fv">${lifeShown(life)}</b></div><div class="mebar">${bar(lifeShown(life))}</div><div class="small el"></div>`}</div>
          <div class="fig"><img class="sprite" src="${portrait(playerPal(S.avatar, S.gender))}" alt=""></div>
          <div class="desk"><i></i></div>
        </div>
        <div class="side foe">
          <div class="plate foe-p"><div class="nm">${esc(o.foeName)}</div><div class="tt">${esc(o.foeTitle ?? T('Avversario'))}</div><div class="row-m"><span class="lb">${T('Convinzione')}</span><b class="cv">100</b></div><div class="foebar">${bar(100)}</div></div>
          <div class="fig"><img class="sprite" src="${portrait(o.foePal)}" alt=""></div>
          <div class="desk"><i></i></div>
        </div>
      </div>
      <div class="box q"><div class="qhead row" style="justify-content:space-between"><span class="small muted qn"></span><span class="timer"></span></div><div class="qt"></div><div class="opts"></div><div class="exp"></div></div>`;
    stage.appendChild(root);
    const unmount = mountArena(root, theme, o.foeName);
    const $ = (s: string) => root.querySelector(s) as HTMLElement;
    let foe = 100;
    let correct = 0;
    let idx = 0;
    let perfect = true;
    let tilted = false;
    const wrongIds: string[] = [];
    const per = 100 / o.need;
    const errLeft = () => {
      if (lifeShown(life) <= 0) return wrongs > allowed ? T('troppi errori') : T('Fiducia esaurita');
      const left = errorsLeft(life, wrongs, total, o.need);
      return left === 0 ? T('nessun errore concesso') : left === 1 ? T('1 errore concesso') : T`${left} errori concessi`;
    };
    const drawMe = () => {
      if (o.practice) return;
      $('.mebar').innerHTML = bar(lifeShown(life));
      $('.fv').textContent = String(lifeShown(life));
      $('.el').textContent = errLeft();
    };
    drawMe();
    let handler: ((k: Key) => void) | null = null;
    const setHandler = (h: ((k: Key) => void) | null) => {
      if (handler) popHandler(handler);
      handler = h;
      if (h) pushHandler(h);
    };

    const finish = async (win: boolean) => {
      setHandler(null);
      await wait(400);
      unmount();
      root.remove();
      if (prevTrack) play(prevTrack); else stop();
      markDuelDone();
      if (win && o.damage > 0) {
        // vincere ridà Fiducia, tanto più quanto è bassa la difficoltà scelta a inizio partita
        S.stats.fiducia = fiduciaAfterWin(S.stats.fiducia, DIFFICULTY[S.difficulty].fiduciaWin);
        track('duel_win'); if (perfect) track('duel_perfect'); jingle('win');
      }
      if (!win && o.damage > 0) track('duel_loss');
      resolve({ win, correct, total: idx, perfect: perfect && win, tilted, ids: o.questions.slice(0, idx).map((q) => q.id), wrong: wrongIds });
    };

    const ask = async () => {
      if (!o.fixed && foe <= 0.01) return finish(true);
      // Barra del giocatore a zero (anche Whale e Wall Street): troppi errori per vincere, oppure tilt se la Fiducia
      // è finita prima degli errori concessi. Negli allenamenti a punteggio si risponde comunque a tutto.
      if (!o.practice && lifeShown(life) <= 0) { tilted = wrongs <= allowed; lastDuelTilted = tilted; return finish(false); }
      if (idx >= o.questions.length) return finish(correct >= o.need);
      const q = o.questions[idx];
      idx++;
      $('.qn').textContent = o.tutorial ? T`Domanda ${idx}/${o.questions.length} · sfida di prova, nessuna penalità` : o.need === 1 ? T`Domanda ${idx}/${o.questions.length} · serve una risposta giusta` : T`Domanda ${idx}/${o.questions.length} · servono ${o.need} risposte giuste`;
      $('.qt').textContent = gtext(q.q);
      $('.exp').innerHTML = '';
      const order = shuffle([0, 1, 2, 3]);
      const optsEl = $('.opts');
      let sel = 0;
      const render = () => {
        optsEl.innerHTML = '';
        order.forEach((oi, i) => {
          const b = el('button', 'btn' + (i === sel ? ' sel' : ''), `${'ABCD'[i]}. ${esc(gtext(q.options[oi]))}`);
          b.addEventListener('click', () => answer(i));
          optsEl.appendChild(b);
        });
      };
      render();
      const limit = profileTimer();
      let left = limit;
      let answered = false;
      const timerEl = $('.timer');
      timerEl.textContent = limit ? `⏱ ${left}s` : T('Modalità Studio');
      const iv = limit ? window.setInterval(() => {
        left--;
        timerEl.textContent = `⏱ ${left}s`;
        if (left <= 0) answer(-1);
      }, 1000) : 0;

      const answer = async (i: number) => {
        if (answered) return;
        answered = true;
        clearInterval(iv);
        setHandler(null);
        const ok = i >= 0 && order[i] === q.answer;
        recordAnswer(q, ok);
        const btns = optsEl.querySelectorAll('button');
        btns.forEach((b, j) => { if (order[j] === q.answer) b.classList.add('right'); else if (j === i) b.classList.add('wrong'); });
        if (ok) {
          correct++;
          foe = Math.max(0, foe - per);
          if (risky) life = Math.min(100, life + FIDUCIA_PER_CORRECT);
          beep('ok');
          $('.foe .fig').classList.add('shake');
        } else {
          perfect = false;
          wrongIds.push(q.id);
          wrongs++;
          life = lifeAfterWrong(life, wrongs, total, o.need);
          beep('bad');
          $('.me .fig').classList.add('shake');
        }
        $('.foebar').innerHTML = bar(foe);
        $('.cv').textContent = String(Math.round(foe));
        if (risky) S.stats.fiducia = lifeShown(life);
        drawMe();
        setTimeout(() => { root.querySelectorAll('.shake').forEach((e) => e.classList.remove('shake')); }, 350);
        const verdict = i < 0 ? T('<b class="bad">Tempo scaduto!</b>') : ok ? T('<b class="good">Giusto!</b>') : T`<b class="bad">Sbagliato.</b> Risposta corretta: ${esc(gtext(q.options[q.answer]))}`;
        const hint = ok ? '' : studyHint(q);
        $('.exp').innerHTML = `<p>${verdict} ${esc(gtext(q.explain))}</p>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}`;
        const cont = el('button', 'btn primary', T('Continua ▶'));
        cont.style.marginTop = '6px';
        $('.exp').appendChild(cont);
        const go = () => { setHandler(null); void ask(); };
        cont.addEventListener('click', go);
        setTimeout(() => setHandler((k) => { if (k === 'a' || k === 'b') go(); }), 250);
      };

      setHandler((k) => {
        if (k === 'up') { sel = (sel + 3) % 4; render(); }
        else if (k === 'down') { sel = (sel + 1) % 4; render(); }
        else if (k === 'left' || k === 'right') { sel = sel ^ 1; render(); }
        else if (k === 'a') void answer(sel);
      });
    };

    if (o.intro) $('.qt').textContent = gtext(o.intro);
    setTimeout(() => void ask(), o.intro ? 1400 : 300);
  });
}
