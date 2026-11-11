import { S, advanceDays, hasTech, TECH } from '../systems/state';
import { TOWNS, mentor } from '../data/story';
import { getMap } from '../world/maps';
import { ABILITY, ISLET_ROUTES, LABEL_ABOVE, REGION_POS, canSwim, canTransfer, outdoorOf, transferTargets, TRANSFER_BADGE } from '../world/travel';
import { modal, esc, el, confirm, toast } from './core';
import { beep } from '../systems/audio';

/** Luogo in cui si trova il giocatore sulla mappa: una città o il punto medio di un percorso. */
function herePos(): { pos: [number, number]; label: string; town?: string } {
  const out = outdoorOf(S.map, getMap);
  if (REGION_POS[out]) return { pos: REGION_POS[out], label: TOWNS.find((t) => t.id === out)?.name ?? out, town: out };
  const r = /^r(\d+)$/.exec(out);
  if (r) {
    const k = Number(r[1]);
    const a = REGION_POS[`t${k - 1}`], b = REGION_POS[`t${k}`];
    return { pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], label: `Percorso ${k}` };
  }
  return { pos: REGION_POS.t0, label: 'Borgo Semina' };
}

function svg(): string {
  const vis = (id: string) => S.visited.includes(id);
  const here = herePos();
  let s = `<svg viewBox="0 0 100 62" class="region-svg" role="img" aria-label="Mappa della Regione di Capitalia">
    <defs><linearGradient id="rgSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f9fe0"/><stop offset="1" stop-color="#2f6fc0"/></linearGradient>
    <pattern id="rgWave" width="6" height="4" patternUnits="userSpaceOnUse"><path d="M0 2 q1.5 -1.4 3 0 t3 0" fill="none" stroke="#8cc8f8" stroke-width=".35" opacity=".7"/></pattern></defs>
    <rect width="100" height="62" fill="url(#rgSea)"/><rect width="100" height="62" fill="url(#rgWave)"/>
    <path d="M3 6 Q20 1 45 5 Q70 2 92 8 Q99 18 97 34 Q99 50 90 58 Q60 61 35 59 Q12 61 4 55 Q0 40 4 28 Q1 16 3 6Z" fill="#7cc65a" stroke="#3f7f2a" stroke-width=".8"/>
    <path d="M30 30 Q50 26 70 32 Q82 36 84 42 Q60 40 40 41 Q25 40 22 35Z" fill="#5fae45" opacity=".55"/>`;
  // percorsi: da t(k-1) a t(k)
  for (let k = 1; k <= 9; k++) {
    const a = REGION_POS[`t${k - 1}`], b = REGION_POS[`t${k}`];
    const known = vis(`t${k - 1}`);
    s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${known ? '#e8d8a0' : '#b0c890'}" stroke-width="${known ? 2.2 : 1.6}" stroke-linecap="round" ${known ? '' : 'stroke-dasharray="1.5 1.5"'}/>`;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (known && ISLET_ROUTES.includes(k)) {
      const done = !!S.flags[`islet_r${k}`];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const side = k === 5 ? -1 : 1;
      const ix = mx + side * ((b[1] - a[1]) / len) * 6, iy = my - side * ((b[0] - a[0]) / len) * 6;
      s += `<g><title>Isola della Liquidità (Percorso ${k})</title><ellipse cx="${ix}" cy="${iy}" rx="4" ry="2.5" fill="#3a8ad8" stroke="#2060a8" stroke-width=".4"/><ellipse cx="${ix}" cy="${iy - 0.2}" rx="1.6" ry="1" fill="${done ? '#f0c040' : '#6cc04a'}"/></g>`;
    }
    if (known && k === 7) s += `<path d="M${mx - 3} ${my - 3} l1 -1.6 l1 1.6 l1 -1.6 l1 1.6 l1 -1.6 l1 1.6" fill="none" stroke="#e04848" stroke-width=".7"><title>Muro del Rumore</title></path>`;
    if (known) s += `<text x="${mx}" y="${my + 1}" class="rg-route">${k}</text>`;
  }
  // città
  TOWNS.forEach((t, i) => {
    const [x, y] = REGION_POS[t.id];
    const v = vis(t.id);
    const gold = i >= 1 && i <= 8 && S.badges >= i;
    const fill = !v ? '#9aa0a8' : i === 9 ? '#c050c0' : gold ? '#f0c040' : '#f8f8f8';
    s += `<g><title>${esc(v ? t.name : 'Città non ancora visitata')}</title><rect x="${x - 2.6}" y="${y - 2.6}" width="5.2" height="5.2" rx="1" fill="${fill}" stroke="#203050" stroke-width=".7"/>`;
    s += `<text x="${x}" y="${LABEL_ABOVE.has(t.id) ? y - 3.6 : y + 6.6}" class="rg-name${v ? '' : ' rg-unknown'}">${esc(v ? t.name : '???')}</text></g>`;
  });
  const [hx, hy] = here.pos;
  s += `<g class="rg-here"><circle cx="${hx}" cy="${hy}" r="3.8" fill="none" stroke="#e03030" stroke-width=".8"/><path d="M${hx} ${hy - 3.6} l-1.8 -3 h3.6z" fill="#e03030" stroke="#701010" stroke-width=".3"/></g>`;
  return s + '</svg>';
}

/** Mappa riepilogativa della regione; da qui parte il Trasferimento di Capitale. Restituisce la città scelta. */
export async function openRegionMap(): Promise<string | undefined> {
  const here = herePos();
  const inLeague = S.map === 'league';
  const dest = await modal<string>('Mappa della Regione', ({ body, button, close }) => {
    body.appendChild(el('div', 'region-map', svg()));
    body.appendChild(el('p', 'small', `Sei qui: <b>${esc(here.label)}</b> · Città visitate: <b>${S.visited.filter((v) => /^t\d$/.test(v)).length}/${TOWNS.length}</b>`));
    if (canTransfer()) {
      const targets = transferTargets(here.town ?? '');
      if (inLeague) body.appendChild(el('p', 'small muted', 'Dentro la Lega il Trasferimento di Capitale non funziona: finisci prima le sfide.'));
      else if (!targets.length) body.appendChild(el('p', 'small muted', 'Visita altre città per poterti trasferire.'));
      else {
        body.appendChild(el('h4', '', 'Trasferimento di Capitale'));
        const grid = el('div', 'region-dest');
        for (const id of targets) {
          const b = el('button', 'btn', esc(TOWNS.find((t) => t.id === id)!.name));
          b.addEventListener('click', () => close(id));
          grid.appendChild(b);
        }
        body.appendChild(grid);
      }
    } else body.appendChild(el('p', 'small muted', `Il Trasferimento di Capitale si sblocca battendo il Mentore di mezzo (Medaglia ${TRANSFER_BADGE}). Intanto, dalla seconda Medaglia, le stazioni collegano le città visitate.`));
    const ab = [
      { a: ABILITY.swim, ok: canSwim() },
      { a: ABILITY.transfer, ok: canTransfer() },
      { a: ABILITY.cold, ok: hasTech(TECH.COLD) },
    ];
    body.appendChild(el('div', 'small', ab.map(({ a, ok }) => `<p style="margin:3px 0">${ok ? '✓' : '🔒'} <b>${esc(a.name)}</b>: ${ok ? esc(a.desc) : `si sblocca con la Medaglia ${a.badge} (${esc(mentor(a.badge, S.track).badge)}).`}</p>`).join('')));
    button('Chiudi', () => close(), 'primary');
  }, { wide: true });
  if (!dest) return undefined;
  const name = TOWNS.find((t) => t.id === dest)?.name ?? dest;
  if (!(await confirm(`Trasferire il capitale a ${name}? Il regolamento è T+1: passerà un giorno di mercato.`))) return undefined;
  beep('ok');
  advanceDays(1).forEach((m) => toast(m));
  toast(`Trasferimento completato: benvenuto a ${name}.`);
  return dest;
}
