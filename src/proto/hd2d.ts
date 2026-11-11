// Prototipo "HD-2D": la stessa mappa e la stessa pixel art di Tradermon rese in 2.5D con Three.js (MIT).
// Terreno piatto con i tile, case estruse in 3D, alberi e personaggi come cartelli (billboard), luce con ombre, nebbia e inclinazione da DS.
// Non è collegato al gioco: serve a valutare la resa. Nessun modello di terze parti: tutte le texture vengono da src/art/art.ts.
import * as THREE from 'three';
import { getMap } from '../world/maps';
import { drawTiles, drawCharacters, visualTiles, TILE, TILE_ATLAS_COLS, tileIndex, P, CH, RS, CHAR_PER_ROW } from '../art/art';

const params = new URLSearchParams(location.search);
const mapId = params.get('map') ?? 't0';
const map = getMap(mapId);
const W = map.w, H = map.h;

const atlasCv = drawTiles();
const atlas = new THREE.CanvasTexture(atlasCv);
atlas.magFilter = THREE.LinearFilter; atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.colorSpace = THREE.SRGBColorSpace;
const ACOLS = TILE_ATLAS_COLS, AROWS = atlasCv.height / P;
const charsCv = drawCharacters();
const chars = new THREE.CanvasTexture(charsCv);
chars.magFilter = THREE.LinearFilter; chars.minFilter = THREE.LinearFilter; chars.colorSpace = THREE.SRGBColorSpace;

/** UV di un tile dell'atlante (con un piccolo margine per evitare le righe tra le celle). */
function uvOf(idx: number): [number, number, number, number] {
  const cx = idx % ACOLS, cy = Math.floor(idx / ACOLS);
  const e = 0.3 / P;
  return [(cx + e) / ACOLS, 1 - (cy + 1 - e) / AROWS, (cx + 1 - e) / ACOLS, 1 - (cy + e) / AROWS];
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc8ff);
scene.fog = new THREE.Fog(0x9fc8ff, 14, 34);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const vis = visualTiles(map.tiles, 0, params.has('night'));
const SOLID3D = new Set<number>([TILE.ROOF, TILE.ROOF_CLINIC, TILE.ROOF_ACADEMY, TILE.ROOF_SPECIAL, TILE.WALL, TILE.WINDOW, TILE.DOOR]);
const ROOFS = new Set<number>([TILE.ROOF, TILE.ROOF_CLINIC, TILE.ROOF_ACADEMY, TILE.ROOF_SPECIAL]);

// ---- terreno: un solo mesh con le UV dell'atlante per cella ----
{
  const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = map.tiles[y][x];
    let ti = vis[y][x];
    if (t === TILE.TREE || SOLID3D.has(t)) ti = tileIndex('grass0');
    if (t === TILE.TREE) ti = tileIndex('grass_sh');
    const [u0, v0, u1, v1] = uvOf(ti);
    const z0 = y, z1 = y + 1, x0 = x, x1 = x + 1;
    pos.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1);
    uv.push(u0, v1, u1, v1, u1, v0, u0, v0);
    for (let k = 0; k < 4; k++) nor.push(0, 1, 0);
    idx.push(n, n + 2, n + 1, n, n + 3, n + 2); n += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  const ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: atlas }));
  ground.receiveShadow = true;
  scene.add(ground);
}

// ---- case: muri estrusi (texture del tile sulla faccia frontale) e tetti rialzati e spioventi ----
function boxUv(geo: THREE.BoxGeometry, faceUv: ([number, number, number, number] | null)[]) {
  // ordine facce di BoxGeometry: +x, -x, +y, -y, +z, -z (4 vertici ciascuna)
  const a = geo.getAttribute('uv') as THREE.BufferAttribute;
  faceUv.forEach((f, i) => {
    const [u0, v0, u1, v1] = f ?? uvOf(tileIndex('iwall'));
    const o = i * 4;
    a.setXY(o, u0, v1); a.setXY(o + 1, u1, v1); a.setXY(o + 2, u0, v0); a.setXY(o + 3, u1, v0);
  });
  a.needsUpdate = true;
}
const wallMat = new THREE.MeshLambertMaterial({ map: atlas });
const isWallRow = (t: number | undefined) => t === TILE.WALL || t === TILE.WINDOW || t === TILE.DOOR;
// Nel 2D una casa è: 2 righe di tetto, una riga di finestre, una riga con la porta. In 3D diventa un corpo profondo 2 celle
// e alto 2, con finestre al piano di sopra e porta a quello di sotto, e un tetto a due falde che sale verso il retro.
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const t = map.tiles[y][x];
  if (!SOLID3D.has(t)) continue;
  const face = uvOf(vis[y][x]);
  const side = uvOf(tileIndex('wall1'));
  if (ROOFS.has(t)) {
    const front = ROOFS.has(map.tiles[y - 1]?.[x]) && !ROOFS.has(map.tiles[y + 1]?.[x]); // falda davanti (riga bassa del tetto)
    const z = y + 2;
    const h0 = front ? 2.0 : 2.55, h1 = front ? 2.55 : 3.0;
    const geo = new THREE.BoxGeometry(1.02, 0.06, 1);
    boxUv(geo, [face, face, face, face, face, face]);
    const m = new THREE.Mesh(geo, wallMat);
    m.position.set(x + 0.5, (h0 + h1) / 2, z + 0.5);
    m.rotation.x = Math.atan2(h1 - h0, 1);
    m.scale.z = Math.hypot(1, h1 - h0);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (!front) {
      // corpo posteriore della casa, sotto la falda alta
      const g2 = new THREE.BoxGeometry(1, 2, 1);
      boxUv(g2, [side, side, null, null, side, side]);
      const fill = new THREE.Mesh(g2, wallMat);
      fill.position.set(x + 0.5, 1, z + 0.5); fill.castShadow = true; fill.receiveShadow = true;
      scene.add(fill);
    }
  } else {
    const upper = isWallRow(map.tiles[y + 1]?.[x]); // riga delle finestre: sta sopra la riga della porta
    const z = upper ? y + 1 : y;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    boxUv(geo, [side, side, null, null, face, side]);
    const m = new THREE.Mesh(geo, wallMat);
    m.position.set(x + 0.5, upper ? 1.5 : 0.5, z + 0.5);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }
}

// ---- alberi e personaggi: cartelli sempre rivolti alla camera ----
const billboards: THREE.Mesh[] = [];
function billboard(uvs: [number, number, number, number], tex: THREE.Texture, w: number, h: number, x: number, z: number) {
  const geo = new THREE.PlaneGeometry(w, h);
  const a = geo.getAttribute('uv') as THREE.BufferAttribute;
  const [u0, v0, u1, v1] = uvs;
  a.setXY(0, u0, v1); a.setXY(1, u1, v1); a.setXY(2, u0, v0); a.setXY(3, u1, v0); a.needsUpdate = true;
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  m.position.set(x, h / 2, z);
  m.castShadow = true;
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  scene.add(m); billboards.push(m);
  return m;
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (map.tiles[y][x] !== TILE.TREE) continue;
  billboard(uvOf(vis[y][x]), atlas, 1.15, 1.25, x + 0.5, y + 0.55);
}
const CROWS = charsCv.height / (CH * RS);
function charUv(pal: number, dir: number): [number, number, number, number] {
  const col = (pal % CHAR_PER_ROW) * 12 + dir * 3, row = Math.floor(pal / CHAR_PER_ROW), FR = 12 * CHAR_PER_ROW;
  return [col / FR, 1 - (row + 1) / CROWS, (col + 1) / FR, 1 - row / CROWS];
}
const PX = Number(params.get('x') ?? Math.floor(W / 2)), PY = Number(params.get('y') ?? Math.floor(H / 2));
billboard(charUv(0, 0), chars, 1, 1.5, PX + 0.5, PY + 0.6);
for (const n of map.npcs) if (!n.hiddenSprite) billboard(charUv(n.pal, n.dir), chars, 1, 1.5, n.x + 0.5, n.y + 0.6);

// ---- luci: cielo, sole con ombre, lampioni di notte ----
const night = params.has('night');
scene.add(new THREE.HemisphereLight(night ? 0x3a4a90 : 0xdfeaff, night ? 0x101828 : 0x5a7a40, night ? 0.5 : 0.9));
const sun = new THREE.DirectionalLight(night ? 0x8090c0 : 0xfff2d0, night ? 0.35 : 1.4);
sun.position.set(W / 2 - 6, 12, H / 2 + 4);
sun.target.position.set(W / 2, 0, H / 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -W; sc.right = W; sc.top = H; sc.bottom = -H; sc.near = 1; sc.far = 50;
scene.add(sun, sun.target);
if (night) { scene.background = new THREE.Color(0x0b1230); scene.fog = new THREE.Fog(0x0b1230, 10, 28); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (map.tiles[y][x] === TILE.WINDOW) { const l = new THREE.PointLight(0xffd080, 2.2, 5, 1.6); l.position.set(x + 0.5, 0.8, y + 1.2); scene.add(l); } }

// ---- camera inclinata come su DS ----
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
let cx = PX + 0.5, cz = PY + 0.5, yaw = 0, tilt = Number(params.get('tilt') ?? 0.9), dist = Number(params.get('dist') ?? 15);
function placeCamera() {
  camera.position.set(cx + Math.sin(yaw) * Math.cos(tilt) * dist, Math.sin(tilt) * dist, cz + Math.cos(yaw) * Math.cos(tilt) * dist);
  camera.lookAt(cx, 0.4, cz);
}
const keys = new Set<string>();
addEventListener('keydown', (e) => keys.add(e.key));
addEventListener('keyup', (e) => keys.delete(e.key));
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
function frame() {
  const s = 0.12;
  if (keys.has('ArrowLeft')) cx -= s; if (keys.has('ArrowRight')) cx += s; if (keys.has('ArrowUp')) cz -= s; if (keys.has('ArrowDown')) cz += s;
  if (keys.has('q')) yaw -= 0.02; if (keys.has('e')) yaw += 0.02;
  if (keys.has('+')) tilt = Math.min(1.5, tilt + 0.01); if (keys.has('-')) tilt = Math.max(0.3, tilt - 0.01);
  placeCamera();
  for (const b of billboards) b.rotation.y = yaw;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
placeCamera();
frame();
(window as unknown as { hd2d: unknown }).hd2d = { scene, camera, set: (o: Partial<{ cx: number; cz: number; yaw: number; tilt: number; dist: number }>) => { ({ cx = cx, cz = cz, yaw = yaw, tilt = tilt, dist = dist } = o); } };
