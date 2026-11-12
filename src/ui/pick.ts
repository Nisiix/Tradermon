import type { PickMission } from '../data/missions';
import { el, esc, modal } from './core';
import { beep } from '../systems/audio';
import { shuffle } from '../systems/rng';
import { T } from '../i18n';

export function runPick(m: PickMission): Promise<{ ok: boolean; detail: string } | null> {
  let round = 0;
  let score = 0;
  return modal<{ ok: boolean; detail: string }>(`Missione · ${m.title}`, ({ body, foot, close, button }) => {
    const show = () => {
      foot.innerHTML = '';
      if (round >= m.rounds.length) {
        const ok = score >= m.need;
        beep(ok ? 'win' : 'lose');
        body.innerHTML = T`<h3 class="${ok ? 'good' : 'bad'}">${ok ? T('Missione superata!') : T('Missione non superata')}</h3><p>Risposte corrette: ${score}/${m.rounds.length} (servono ${m.need}).</p>`;
        button(T('Continua'), () => close({ ok, detail: `${score}/${m.rounds.length} corrette` }), 'primary');
        return;
      }
      const r = m.rounds[round];
      body.innerHTML = `<p class="small muted">${esc(m.brief)}</p><p><b>${round + 1}. ${esc(r.prompt)}</b></p>`;
      const cards = el('div', 'cards');
      shuffle(r.options).forEach((op) => {
        const c = el('div', 'card', `<b>${esc(op.title)}</b>${op.lines.length ? '<ul style="margin:4px 0 0;padding-left:18px">' + op.lines.map((l) => `<li>${esc(l)}</li>`).join('') + '</ul>' : ''}`);
        c.style.cursor = 'pointer';
        c.tabIndex = 0;
        const pick = () => {
          if (op.correct) { score++; beep('ok'); } else beep('bad');
          body.innerHTML += `<p class="${op.correct ? 'good' : 'bad'}"><b>${op.correct ? T('Giusto!') : T('Non è la scelta migliore.')}</b> ${esc(op.why)}</p>`;
          const right = r.options.find((x) => x.correct)!;
          if (!op.correct) body.innerHTML += T`<p class="small">La scelta migliore era <b>${esc(right.title)}</b>: ${esc(right.why)}</p>`;
          cards.remove();
          foot.innerHTML = '';
          round++;
          button(T('Avanti ▶'), show, 'primary');
        };
        c.addEventListener('click', pick);
        c.addEventListener('keydown', (e) => { if (e.key === 'Enter') pick(); });
        cards.appendChild(c);
      });
      body.appendChild(cards);
    };
    show();
  }, { closable: false }).then((r) => r ?? null);
}
