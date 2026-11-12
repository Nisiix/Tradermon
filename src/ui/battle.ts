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
import { FIDUCIA_PER_CORRECT } from '../systems/balance';
import { studyHint } from '../data/quiz/hint';

export interface DuelOpts {
  foeName: string;
  foeTitle?: string;
  foePal: number;
  questions: Question[];
  need: number;
  damage: number;
  intro?: string;
  /** Sfida a numero fisso di domande (Mentori e Lega): si rispondono tutte, ma a Fiducia zero si va in tilt. */
  fixed?: boolean;
  /** Luogo della sfida: decide sfondo, colori e nastro (predefinito: la piazza delle quotazioni). */
  arena?: Arena;
}

export interface DuelResult { win: boolean; correct: number; total: number; perfect: boolean; tilted: boolean; ids: string[]; wrong: string[] }

export async function runDuel(o: DuelOpts): Promise<DuelResult> {
  const prevTrack = currentTrack();
  play('battle');
  const theme: Arena = o.arena ?? 'piazza';
  await arenaTransition(theme);
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
          <div class="plate me-p"><div class="nm">${esc(S.name)}</div>${S.title ? `<div class="tt">${esc(S.title)}</div>` : '<div class="tt">Sfidante</div>'}<div class="row-m"><span class="lb">Fiducia</span><b class="fv">${S.stats.fiducia}</b></div><div class="mebar">${bar(S.stats.fiducia)}</div></div>
          <div class="fig"><img class="sprite" src="${portrait(playerPal(S.avatar))}" alt=""></div>
          <div class="desk"><i></i></div>
        </div>
        <div class="side foe">
          <div class="plate foe-p"><div class="nm">${esc(o.foeName)}</div><div class="tt">${esc(o.foeTitle ?? 'Avversario')}</div><div class="row-m"><span class="lb">Convinzione</span><b class="cv">100</b></div><div class="foebar">${bar(100)}</div></div>
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
      if (win && o.damage > 0) { track('duel_win'); if (perfect) track('duel_perfect'); jingle('win'); }
      if (!win && o.damage > 0) track('duel_loss');
      resolve({ win, correct, total: idx, perfect: perfect && win, tilted, ids: o.questions.slice(0, idx).map((q) => q.id), wrong: wrongIds });
    };

    const ask = async () => {
      if (!o.fixed && foe <= 0.01) return finish(true);
      // Fiducia esaurita: tilt, in ogni sfida con danno (anche Mentori e Lega)
      if (o.damage > 0 && S.stats.fiducia <= 0) { tilted = true; return finish(false); }
      if (idx >= o.questions.length) return finish(correct >= o.need);
      const q = o.questions[idx];
      idx++;
      $('.qn').textContent = `Domanda ${idx}/${o.questions.length} · servono ${o.need} risposte giuste`;
      $('.qt').textContent = q.q;
      $('.exp').innerHTML = '';
      const order = shuffle([0, 1, 2, 3]);
      const optsEl = $('.opts');
      let sel = 0;
      const render = () => {
        optsEl.innerHTML = '';
        order.forEach((oi, i) => {
          const b = el('button', 'btn' + (i === sel ? ' sel' : ''), `${'ABCD'[i]}. ${esc(q.options[oi])}`);
          b.addEventListener('click', () => answer(i));
          optsEl.appendChild(b);
        });
      };
      render();
      const limit = profileTimer();
      let left = limit;
      let answered = false;
      const timerEl = $('.timer');
      timerEl.textContent = limit ? `⏱ ${left}s` : 'Modalità Studio';
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
          if (o.damage > 0) S.stats.fiducia = Math.min(100, S.stats.fiducia + FIDUCIA_PER_CORRECT);
          beep('ok');
          $('.foe .fig').classList.add('shake');
        } else {
          perfect = false;
          wrongIds.push(q.id);
          S.stats.fiducia = Math.max(0, S.stats.fiducia - o.damage);
          beep('bad');
          $('.me .fig').classList.add('shake');
        }
        $('.foebar').innerHTML = bar(foe);
        $('.cv').textContent = String(Math.round(foe));
        $('.mebar').innerHTML = bar(S.stats.fiducia);
        $('.fv').textContent = String(S.stats.fiducia);
        setTimeout(() => { root.querySelectorAll('.shake').forEach((e) => e.classList.remove('shake')); }, 350);
        const verdict = i < 0 ? '<b class="bad">Tempo scaduto!</b>' : ok ? '<b class="good">Giusto!</b>' : `<b class="bad">Sbagliato.</b> Risposta corretta: ${esc(q.options[q.answer])}`;
        const hint = ok ? '' : studyHint(q);
        $('.exp').innerHTML = `<p>${verdict} ${esc(q.explain)}</p>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}`;
        const cont = el('button', 'btn primary', 'Continua ▶');
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

    if (o.intro) $('.qt').textContent = o.intro;
    setTimeout(() => void ask(), o.intro ? 1400 : 300);
  });
}
