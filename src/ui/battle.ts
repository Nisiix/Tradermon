import { play, stop, currentTrack, jingle } from '../systems/music';
import { track } from '../systems/progress';
import type { Question } from '../types';
import { el, esc, getStage, wait, bar } from './core';
import { pushHandler, popHandler, type Key } from './input';
import { S, profileTimer } from '../systems/state';
import { recordAnswer } from '../systems/quiz';
import { shuffle } from '../systems/rng';
import { portrait, portraitBack, playerPal } from '../art/art';
import { beep } from '../systems/audio';
import { markDuelDone } from './savebtn';
import { FIDUCIA_PER_CORRECT } from '../systems/balance';

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
}

export interface DuelResult { win: boolean; correct: number; total: number; perfect: boolean; tilted: boolean; ids: string[]; wrong: string[] }

/** Transizione d'ingresso al duello: due lampi, poi bande nere che si chiudono da lati alterni. */
export async function battleTransition(): Promise<void> {
  const stage = getStage();
  const t = el('div', 'bt-trans');
  t.innerHTML = '<div class="fl"></div>' + Array.from({ length: 8 }, (_, i) => `<i style="top:${i * 12.5}%;animation-delay:${520 + i * 45}ms" class="${i % 2 ? 'r' : 'l'}"></i>`).join('');
  stage.appendChild(t);
  beep('alert');
  await wait(1050);
  return new Promise((r) => { setTimeout(() => t.remove(), 450); t.classList.add('out'); r(); });
}

export async function runDuel(o: DuelOpts): Promise<DuelResult> {
  const prevTrack = currentTrack();
  play('battle');
  await battleTransition();
  return new Promise((resolve) => {
    const stage = getStage();
    const root = el('div', 'battle');
    root.innerHTML = `
      <div class="arena">
        <div class="box plate foe-p"><div class="nm">${esc(o.foeName)}${o.foeTitle ? ` <span class="muted">· ${esc(o.foeTitle)}</span>` : ''}</div><div class="small">Convinzione</div><div class="foebar">${bar(100)}</div></div>
        <div class="foe"><img class="sprite" src="${portrait(o.foePal)}" alt=""></div>
        <div class="me"><img class="sprite" src="${portraitBack(playerPal(S.avatar))}" alt=""></div>
        <div class="box plate me-p"><div class="nm">${esc(S.name)}${S.title ? ` <span class="muted">· ${esc(S.title)}</span>` : ''}</div><div class="small">Fiducia <span class="fv">${S.stats.fiducia}</span>/100</div><div class="mebar">${bar(S.stats.fiducia)}</div></div>
      </div>
      <div class="box q"><div class="qhead row" style="justify-content:space-between"><span class="small muted qn"></span><span class="timer"></span></div><div class="qt"></div><div class="opts"></div><div class="exp"></div></div>`;
    stage.appendChild(root);
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
      root.remove();
      if (prevTrack) play(prevTrack); else stop();
      markDuelDone();
      if (win && o.damage > 0) { track('duel_win'); if (perfect) track('duel_perfect'); jingle('win'); }
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
          ($('.foe') as HTMLElement).classList.add('shake');
        } else {
          perfect = false;
          wrongIds.push(q.id);
          S.stats.fiducia = Math.max(0, S.stats.fiducia - o.damage);
          beep('bad');
          ($('.me') as HTMLElement).classList.add('shake');
        }
        $('.foebar').innerHTML = bar(foe);
        $('.mebar').innerHTML = bar(S.stats.fiducia);
        $('.fv').textContent = String(S.stats.fiducia);
        setTimeout(() => { root.querySelectorAll('.shake').forEach((e) => e.classList.remove('shake')); }, 350);
        const verdict = i < 0 ? '<b class="bad">Tempo scaduto!</b>' : ok ? '<b class="good">Giusto!</b>' : `<b class="bad">Sbagliato.</b> Risposta corretta: ${esc(q.options[q.answer])}`;
        $('.exp').innerHTML = `<p>${verdict} ${esc(q.explain)}</p>`;
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
