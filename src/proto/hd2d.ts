// Pagina di prova della resa 2.5D (hd2d.html): usa lo stesso motore del gioco (render3d/view.ts) con una camera libera.
// Parametri: map, x, y, dist, tilt, night. Tasti: frecce muovono la camera, Q/E ruotano, +/- inclinano, N notte.
import { View3D, type MirrorItem } from '../render3d/view';
import { getMap } from '../world/maps';
import { playerPal } from '../art/art';

const params = new URLSearchParams(location.search);
const map = getMap(params.get('map') ?? 't0');
const night = params.has('night');
const parent = document.getElementById('game') ?? document.body;
const view = new View3D(parent, params.get('fx') === 'bassi' ? 'bassi' : 'alti');
view.setMood({ night, climate: params.get('clima') ?? 'neutro', interior: map.interior });
view.loadMap(map, night);
let cx = Number(params.get('x') ?? Math.floor(map.w / 2)) + 0.5, cz = Number(params.get('y') ?? Math.floor(map.h / 2)) + 0.5;
let yaw = 0, tilt = Number(params.get('tilt') ?? 0.98), dist = Number(params.get('dist') ?? 14.2);
const keys = new Set<string>();
addEventListener('keydown', (e) => { keys.add(e.key); if (e.key === 'n') { view.setMood({ night: !night, climate: 'neutro', interior: map.interior }); } });
addEventListener('keyup', (e) => keys.delete(e.key));
let frame = 0;
setInterval(() => { frame = 1 - frame; view.animate(frame, night); }, 550);
function loop() {
  const s = 0.12;
  if (keys.has('ArrowLeft')) cx -= s; if (keys.has('ArrowRight')) cx += s; if (keys.has('ArrowUp')) cz -= s; if (keys.has('ArrowDown')) cz += s;
  if (keys.has('q')) yaw -= 0.02; if (keys.has('e')) yaw += 0.02;
  if (keys.has('+')) tilt = Math.min(1.5, tilt + 0.01); if (keys.has('-')) tilt = Math.max(0.3, tilt - 0.01);
  view.setFree({ cx, cz, yaw, tilt, dist });
  const items: MirrorItem[] = [{ kind: 'char', frame: playerPal(0) * 12, x: cx, y: cz + 0.5, alpha: 1 }];
  for (const n of map.npcs) if (!n.hiddenSprite && n.kind !== 'case') items.push({ kind: 'char', frame: n.pal * 12 + n.dir * 3, x: n.x + 0.5, y: n.y + 1, alpha: 1 });
  view.frame({ cx, cy: cz, shake: false, tint: { color: 0, alpha: 0 }, items });
  requestAnimationFrame(loop);
}
loop();
(window as unknown as { hd2d: unknown }).hd2d = { view, set: (o: Partial<{ cx: number; cz: number; yaw: number; tilt: number; dist: number }>) => { ({ cx = cx, cz = cz, yaw = yaw, tilt = tilt, dist = dist } = o); } };
