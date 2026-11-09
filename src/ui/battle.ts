import type { Question } from '../types';
import { el, esc, getStage, wait, bar } from './core';
import { pushHandler, popHandler, type Key } from './input';
import { S, profileTimer, setBias } from '../systems/state';
import { recordAnswer } from '../systems/quiz';
import { shuffle } from '../systems/rng';
import { SOURCES } from '../data/sources';
import { portrait, portraitBack } from '../art/art';
import { beep } from '../systems/audio';
import { BIAS_INFO } from '../data/events';

export interface DuelOpts {
  foeName: string;
  foeTitle?: string;
  foePal: number;
  questions: Question[];
  need: number;
  damage: number;
  intro?: string;
}

export interface DuelResult { win: boolean; correct: number; total: number; perfect: boolean; ids: string[] }

export function runDuel(o: DuelOpts): Promise<DuelResult> {
  return new Promise((resolve) => {
    const stage = getStage();
    const root = el('div', 'battle');
    root.innerHTML = `
      <div class="arena">
        <div class="box plate foe-p"><div class="nm">${esc(o.foeName)}${o.foeTitle ? ` <span class="muted">· ${esc(o.foeTitle)}</span>` : ''}</div><div class="small">Convinzione</div><div class="foebar">${bar(100)}</div></div>
        <div class="foe"><img class="sprite" src="${portrait(o.foePal)}" alt=""></div>
        <div class="me"><img class="sprite" src="${portraitBack(S.avatar)}" alt=""></div>
        <div class="box plate me-p"><div class="nm">${esc(S.name)} ${S.bias ? `<span class="tag" style="background:#7a2a6a;color:#fff">${BIAS_INFO[S.bias].name}</span>` : ''}</div><div class="small">Fiducia <span class="fv">${S.stats.fiducia}</span>/100</div><div class="mebar">${bar(S.stats.fiducia)}</div></div>
      </div>
      <div class="box q"><div class="qhead row" style="justify-content:space-between"><span class="small muted qn"></span><span class="timer"></span></div><div class="qt"></div><div class="opts"></div><div class="exp"></div></div>`;
    stage.appendChild(root);
    const $ = (s: string) => root.querySelector(s) as HTMLElement;
    let foe = 100;
    let correct = 0;
    let idx = 0;
    let streakFast = 0;
    let perfect = true;
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
      resolve({ win, correct, total: idx, perfect: perfect && win, ids: o.questions.slice(0, idx).map((q) => q.id) });
    };

    const ask = async () => {
      if (foe <= 0.01) return finish(true);
      if (S.stats.fiducia <= 0) return finish(false);
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
          if (S.bias === 'gregge' && oi === herdOpt) b.innerHTML += `<span class="herd">il 78% ha scelto questa</span>`;
          b.addEventListener('click', () => answer(i));
          optsEl.appendChild(b);
        });
      };
      const herdOpt = 1 + Math.floor(Math.random() * 3);
      render();
      let limit = profileTimer();
      if (S.bias === 'panico' && limit) limit = Math.ceil(limit / 2);
      let left = limit;
      const t0 = Date.now();
      let answered = false;
      let shuffled = false;
      const timerEl = $('.timer');
      timerEl.textContent = limit ? `⏱ ${left}s` : 'Modalità Studio';
      const iv = limit ? window.setInterval(() => {
        left--;
        timerEl.textContent = `⏱ ${left}s`;
        if (S.bias === 'fomo' && !shuffled && left <= limit / 2) { shuffled = true; order.splice(0, 4, ...shuffle(order)); render(); }
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
          beep('ok');
          ($('.foe') as HTMLElement).classList.add('shake');
          if (Date.now() - t0 < 4000) streakFast++; else streakFast = 0;
        } else {
          perfect = false;
          streakFast = 0;
          S.stats.fiducia = Math.max(0, S.stats.fiducia - o.damage);
          beep('bad');
          ($('.me') as HTMLElement).classList.add('shake');
        }
        $('.foebar').innerHTML = bar(foe);
        $('.mebar').innerHTML = bar(S.stats.fiducia);
        $('.fv').textContent = String(S.stats.fiducia);
        setTimeout(() => { root.querySelectorAll('.shake').forEach((e) => e.classList.remove('shake')); }, 350);
        const src = SOURCES[q.source];
        const verdict = i < 0 ? '<b class="bad">Tempo scaduto!</b>' : ok ? '<b class="good">Giusto!</b>' : `<b class="bad">Sbagliato.</b> Risposta corretta: ${esc(q.options[q.answer])}`;
        if (S.bias === 'euforia') $('.exp').innerHTML = `<p>${verdict} <span class="muted small">(Eccesso di fiducia: spiegazione nascosta. Curati alla Clinica.)</span></p>`;
        else $('.exp').innerHTML = `<p>${verdict} ${esc(q.explain)}${src ? ` <span class="small muted">Fonte: <a href="${src.url}" target="_blank" rel="noopener">${esc(src.publisher)} – ${esc(src.title)}</a></span>` : ''}</p>`;
        if (streakFast >= 5 && !S.bias) { if (setBias('euforia')) $('.exp').innerHTML += `<p class="bad small">Cinque risposte velocissime di fila... ti senti invincibile. Stato: Eccesso di fiducia!</p>`; streakFast = 0; }
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
