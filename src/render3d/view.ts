// Resa 2.5D "HD-2D" del mondo (stile Pokémon su DS): la mappa logica diventa un diorama con Three.js,
// gli oggetti sono volumi ricavati dalla stessa pixel art del gioco (vedi relief.ts), i personaggi
// restano sprite in piedi, la camera è inclinata, con ombre, luci di notte e post-produzione
// (occlusione ambientale SSAO, bagliore, tilt-shift) dalla libreria postprocessing.
//
// La logica del gioco resta nella scena Phaser (scenes/world.ts): questa classe la "rispecchia" ogni
// fotogramma (posizioni di giocatore e personaggi, camera, dissolvenze, tinta) e disegna il meteo su un
// livello 2D sopra la scena, con le stesse chiamate che usa la grafica 2D.
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, TiltShiftEffect, VignetteEffect, SMAAEffect, SSAOEffect, NormalPass, DepthDownsamplingPass, BlendFunction, KernelSize } from 'postprocessing';
import { drawTiles, drawCharacters, visualTiles, TILE, TILE_ATLAS_COLS, tileIndex, tileName, drawTileRaw, P, RS, CH, CHAR_PER_ROW, T, drawSpotBubble } from '../art/art';
import { drawPlaque } from '../art/plaque';
import type { MapDef } from '../world/maps';
import { reprOf, HOUSE_ROOFS, HOUSE_WALLS, WALL_LIKE } from './props';
import { propSprite, propAtlas, GeoBuilder, uprightRelief, flatRelief, crossPlanes, billboardQuad, propUv } from './relief';
import { assetManifest, externalModel, type AssetManifest } from './assets';

/** Le stesse chiamate di Phaser.GameObjects.Graphics usate dal meteo. */
export interface Painter {
  clear(): void;
  fillStyle(color: number, alpha?: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  lineStyle(width: number, color: number, alpha?: number): void;
  lineBetween(x1: number, y1: number, x2: number, y2: number): void;
}

export type MirrorItem =
  | { kind: 'char'; frame: number; x: number; y: number; alpha: number; lift?: number }
  | { kind: 'tile'; frame: number; x: number; y: number; alpha: number }
  | { kind: 'bubble'; x: number; y: number; scale: number }
  | { kind: 'leaf'; x: number; z: number; h: number; color: number; alpha: number }
  | { kind: 'raft'; x: number; y: number };

export interface MirrorFrame {
  cx: number; cy: number; // centro della vista in caselle
  zoom?: number; // zoom della camera 2D (1 = normale): in 2.5D allontana la camera
  shake: boolean;
  fade?: { r: number; g: number; b: number; a: number };
  flash?: { r: number; g: number; b: number; a: number };
  tint: { color: number; alpha: number };
  items: MirrorItem[];
}

export interface Mood { night: boolean; climate: string; interior: boolean; dark?: boolean }
export type FxLevel = 'alti' | 'bassi';

const VW = 240 * RS, VH = 160 * RS; // vista logica (come la camera Phaser)
const SKIRT = 6;
const FOV = 36, TILT = 0.98, DIST = 14.2;

function hexToCss(c: number, a: number) { return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`; }

export class View3D {
  readonly canvas: HTMLCanvasElement;
  readonly fx: HTMLCanvasElement;
  readonly painter: Painter;
  private ctx: CanvasRenderingContext2D;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private atlas: THREE.CanvasTexture;
  private chars: THREE.CanvasTexture;
  private charRows: number;
  private acols: number; private arows: number;
  private matTiles: THREE.MeshLambertMaterial;
  private matProps: THREE.MeshLambertMaterial;
  private matSides: THREE.MeshLambertMaterial;
  private matChar: THREE.MeshLambertMaterial;
  private matBubble: THREE.MeshBasicMaterial;
  private matShadow: THREE.MeshBasicMaterial;
  private matLeaf: THREE.MeshLambertMaterial;
  private staticGroup = new THREE.Group();
  private dynGroup = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private lamps: THREE.PointLight[] = [];
  private windows: [number, number][] = [];
  private animated: { x: number; y: number; v0: number }[] = [];
  private groundUv?: THREE.BufferAttribute;
  private map?: MapDef;
  private mood: Mood = { night: false, climate: 'neutro', interior: false };
  private charPool: THREE.Mesh[] = [];
  private tilePool: THREE.Mesh[] = [];
  private bubblePool: THREE.Mesh[] = [];
  private leafPool: THREE.Mesh[] = [];
  private shadowPool: THREE.Mesh[] = [];
  private raft: THREE.Mesh;
  private rect = { w: 0, h: 0, l: 0, t: 0 };
  private dpr = 1;
  private avgCache = new Map<string, [number, number, number]>();
  private yaw = 0;
  private free?: { cx: number; cz: number; yaw: number; tilt: number; dist: number };
  private tiltNow = TILT; private distNow = DIST;
  private disposed = false;
  private fxLevel: FxLevel;
  /** Modelli esterni (public/assets3d/manifest.json): se presenti sostituiscono gli oggetti generati. */
  private manifest: AssetManifest | null = null;

  constructor(private parent: HTMLElement, fx: FxLevel = 'alti') {
    this.fxLevel = fx;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'view3d';
    this.fx = document.createElement('canvas');
    this.fx.className = 'view3d-fx';
    this.fx.width = VW; this.fx.height = VH;
    for (const c of [this.canvas, this.fx]) { c.style.position = 'absolute'; c.style.pointerEvents = 'none'; parent.appendChild(c); }
    this.ctx = this.fx.getContext('2d')!;
    const ctx = this.ctx;
    this.painter = {
      clear: () => ctx.clearRect(0, 0, VW, VH),
      fillStyle: (c, a = 1) => { ctx.fillStyle = hexToCss(c, a); },
      fillRect: (x, y, w, h) => ctx.fillRect(x, y, w, h),
      lineStyle: (w, c, a = 1) => { ctx.lineWidth = w; ctx.strokeStyle = hexToCss(c, a); },
      lineBetween: (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
    };
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.camera = new THREE.PerspectiveCamera(FOV, VW / VH, 0.5, 80);
    this.scene.add(this.staticGroup, this.dynGroup);
    // texture: lo stesso atlante dei tile e lo stesso foglio dei personaggi della grafica 2D
    const atlasCv = drawTiles();
    this.atlas = new THREE.CanvasTexture(atlasCv);
    this.atlas.magFilter = THREE.LinearFilter; this.atlas.minFilter = THREE.LinearMipmapLinearFilter; this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.atlas.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.acols = TILE_ATLAS_COLS; this.arows = atlasCv.height / P;
    const charsCv = drawCharacters();
    this.chars = new THREE.CanvasTexture(charsCv);
    this.chars.magFilter = THREE.LinearFilter; this.chars.minFilter = THREE.LinearFilter; this.chars.colorSpace = THREE.SRGBColorSpace;
    this.charRows = charsCv.height / (CH * RS);
    this.matTiles = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true });
    this.matProps = new THREE.MeshLambertMaterial({ map: propAtlas(), transparent: false, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true });
    this.matSides = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.matChar = new THREE.MeshLambertMaterial({ map: this.chars, alphaTest: 0.5, side: THREE.DoubleSide, transparent: true });
    this.matBubble = new THREE.MeshBasicMaterial({ map: this.bubbleTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
    this.matShadow = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    this.matLeaf = new THREE.MeshLambertMaterial({ vertexColors: false, transparent: true });
    // zattera del Flusso di Liquidità
    const raftG = new THREE.BoxGeometry(0.95, 0.1, 0.7);
    this.raft = new THREE.Mesh(raftG, new THREE.MeshLambertMaterial({ color: 0xb07838 }));
    this.raft.castShadow = true; this.raft.visible = false;
    this.dynGroup.add(this.raft);
    // luci
    this.hemi = new THREE.HemisphereLight(0xdfeaff, 0x5a7a40, 0.9);
    this.sun = new THREE.DirectionalLight(0xfff2d0, 1.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    const sc = this.sun.shadow.camera; sc.left = -13; sc.right = 13; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 60;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    for (let i = 0; i < 8; i++) { const l = new THREE.PointLight(0xffd080, 0, 5.5, 1.5); l.visible = false; this.lamps.push(l); this.scene.add(l); }
    // post-produzione
    this.composer = new EffectComposer(this.renderer, { multisampling: 0, frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new BloomEffect({ luminanceThreshold: 0.72, luminanceSmoothing: 0.25, intensity: 0.55, mipmapBlur: true, radius: 0.55 });
    const vignette = new VignetteEffect({ offset: 0.22, darkness: 0.42 });
    if (fx === 'alti') {
      // occlusione ambientale: ombreggia gli angoli tra oggetti e terreno, così i volumi "si appoggiano" davvero
      const normalPass = new NormalPass(this.scene, this.camera);
      const depthDown = new DepthDownsamplingPass({ normalBuffer: normalPass.texture, resolutionScale: 0.5 });
      const ssao = new SSAOEffect(this.camera, normalPass.texture, {
        blendFunction: BlendFunction.MULTIPLY, distanceScaling: true, depthAwareUpsampling: true, normalDepthBuffer: depthDown.texture,
        samples: 12, rings: 4, worldDistanceThreshold: 24, worldDistanceFalloff: 4, worldProximityThreshold: 0.35, worldProximityFalloff: 0.1,
        luminanceInfluence: 0.6, radius: 0.1, intensity: 1.6, bias: 0.02, fade: 0.01, resolutionScale: 0.5 });
      this.composer.addPass(normalPass);
      this.composer.addPass(depthDown);
      this.composer.addPass(new EffectPass(this.camera, ssao, bloom, vignette));
    } else this.composer.addPass(new EffectPass(this.camera, bloom, vignette));
    if (fx === 'alti') this.composer.addPass(new EffectPass(this.camera, new TiltShiftEffect({ offset: 0.04, focusArea: 0.78, feather: 0.3, kernelSize: KernelSize.VERY_SMALL, resolutionScale: 0.5 })));
    this.composer.addPass(new EffectPass(this.camera, new SMAAEffect()));
    this.resize(true);
    void assetManifest().then((m) => { this.manifest = m; if (m?.models && this.map && !this.disposed) this.loadMap(this.map, this.mood.night); });
  }

  /** Modalità libera (prototipo): camera comandata da fuori. */
  setFree(f?: { cx: number; cz: number; yaw: number; tilt: number; dist: number }) { this.free = f; }

  destroy() {
    this.disposed = true;
    this.staticGroup.clear();
    this.composer.dispose();
    this.renderer.dispose();
    this.canvas.remove(); this.fx.remove();
  }

  /** Adatta i canvas al riquadro 3:2 centrato nel genitore (come Phaser.Scale.FIT). */
  resize(force = false) {
    const pw = this.parent.clientWidth || innerWidth, ph = this.parent.clientHeight || innerHeight;
    const w = Math.floor(Math.min(pw, ph * 1.5)), h = Math.floor(w / 1.5);
    const l = Math.floor((pw - w) / 2), t = Math.floor((ph - h) / 2);
    const dpr = Math.min(this.fxLevel === 'alti' ? 1.5 : 1, devicePixelRatio || 1, 1600 / Math.max(1, w));
    if (!force && w === this.rect.w && h === this.rect.h && l === this.rect.l && t === this.rect.t && dpr === this.dpr) return;
    this.rect = { w, h, l, t }; this.dpr = dpr;
    for (const c of [this.canvas, this.fx]) { c.style.left = l + 'px'; c.style.top = t + 'px'; c.style.width = w + 'px'; c.style.height = h + 'px'; }
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(Math.max(2, Math.round(w * dpr)), Math.max(2, Math.round(h * dpr)), false);
    this.composer.setSize(Math.max(2, Math.round(w * dpr)), Math.max(2, Math.round(h * dpr)));
    this.camera.aspect = 1.5; this.camera.updateProjectionMatrix();
  }

  // ---------------- texture di servizio ----------------

  private bubbleTexture(): THREE.CanvasTexture {
    const bb = drawSpotBubble();
    const t = new THREE.CanvasTexture(bb); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** UV di un tile dell'atlante (piccolo margine per non far sbavare le celle vicine). */
  private uvOf(idx: number): [number, number, number, number] {
    const cx = idx % this.acols, cy = Math.floor(idx / this.acols);
    const e = 0.3 / T;
    return [(cx + e) / this.acols, 1 - (cy + 1 - e) / this.arows, (cx + 1 - e) / this.acols, 1 - (cy + e) / this.arows];
  }

  private charUv(frame: number): [number, number, number, number] {
    const pal = Math.floor(frame / 12), f = frame % 12;
    const col = (pal % CHAR_PER_ROW) * 12 + f, row = Math.floor(pal / CHAR_PER_ROW), FR = 12 * CHAR_PER_ROW;
    const e = 0.3 / T;
    return [(col + e) / FR, 1 - (row + 1 - e / 1.5) / this.charRows, (col + 1 - e) / FR, 1 - (row + e / 1.5) / this.charRows];
  }

  /** Colore medio (lineare) di un tile, per i fianchi dei blocchi. */
  private avgColor(name: string, k = 1): [number, number, number] {
    let c = this.avgCache.get(name);
    if (!c) {
      const d = drawTileRaw(name).getContext('2d')!.getImageData(0, 0, T, T).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 40) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      const lin = (v: number) => { v = v / 255 / Math.max(1, n); return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      c = [lin(r), lin(g), lin(b)];
      this.avgCache.set(name, c);
    }
    return [c[0] * k, c[1] * k, c[2] * k];
  }

  // ---------------- costruzione del mondo statico ----------------

  loadMap(map: MapDef, night: boolean, frame = 0) {
    this.map = map;
    this.staticGroup.clear();
    this.animated = []; this.windows = [];
    const W = map.w, H = map.h, tiles = map.tiles;
    const vis = visualTiles(tiles, frame, night);
    const ground = new GeoBuilder(), solid = new GeoBuilder(), props = new GeoBuilder(), sides = new GeoBuilder();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : tiles[y][x]);
    const cave = tiles.some((r) => r.includes(TILE.CAVE));
    const uvq = (u: [number, number, number, number]) => [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]], [u[0], u[3]]];
    const groundQuad = (x: number, y: number, idx: number, h = 0) => {
      const v0 = ground.uv.length / 2;
      ground.quad([[x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y]], [0, 1, 0], uvq(this.uvOf(idx)));
      return v0;
    };
    const defaultGround = (t: number) => (cave ? tileIndex('cave') : map.interior ? tileIndex('floor') : t === TILE.BOULDER && !cave ? tileIndex('path0') : tileIndex('grass0'));
    // blocco con texture sopra (e davanti) e fianchi colorati
    const block = (x: number, y: number, h: number, topIdx: number, frontIdx: number | null, color: [number, number, number], skip: { l: boolean; r: boolean; b: boolean; f: boolean }) => {
      solid.quad([[x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y]], [0, 1, 0], uvq(this.uvOf(topIdx)));
      if (!skip.f) {
        if (frontIdx !== null) solid.quad([[x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, h, y + 1], [x, h, y + 1]], [0, 0, 1], uvq(this.uvOf(frontIdx)));
        else sides.quad([[x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, h, y + 1], [x, h, y + 1]], [0, 0, 1], undefined, color);
      }
      const dark: [number, number, number] = [color[0] * 0.75, color[1] * 0.75, color[2] * 0.75];
      if (!skip.l) sides.quad([[x, 0, y], [x, 0, y + 1], [x, h, y + 1], [x, h, y]], [-1, 0, 0], undefined, dark);
      if (!skip.r) sides.quad([[x + 1, 0, y + 1], [x + 1, 0, y], [x + 1, h, y], [x + 1, h, y + 1]], [1, 0, 0], undefined, dark);
      if (!skip.b) sides.quad([[x + 1, 0, y], [x, 0, y], [x, h, y], [x + 1, h, y]], [0, 0, -1], undefined, dark);
    };
    const wallSide = this.uvOf(tileIndex('wall1'));
    const TILE_KEY = new Map<number, string>(Object.entries(TILE).map(([k, v]) => [v, k.toLowerCase()]));
    const extCells = new Map<string, [number, number][]>();
    const isHouse = (t: number) => HOUSE_WALLS.has(t) || HOUSE_ROOFS.has(t);
    // ciuffi d'erba: pannelli piccoli rivolti alla camera, sparsi in modo deterministico dentro la cella
    const hash = (x: number, y: number, k: number) => { let h = (x * 374761393 + y * 668265263 + k * 1274126177) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const tufts = (x: number, y: number, n: number, w: number, h: number) => {
      for (let k = 0; k < n; k++) {
        const sp = propSprite(`tuft${Math.floor(hash(x, y, k * 3 + 2) * 3)}`, null);
        const dx = (hash(x, y, k * 3) - 0.5) * (1 - w * 0.6), dz = (hash(x, y, k * 3 + 1) - 0.5) * (1 - w * 0.6);
        billboardQuad(props, sp, x + dx, y + dz, w, h, TILT, 0.01);
      }
    };
    const cell = (x: number, y: number, sx: number, sy: number, skirt: boolean) => {
      const t = tiles[sy][sx];
      let r = reprOf(t);
      if (skirt && r.kind !== 'ground' && r.kind !== 'cross') r = { kind: 'ground' };
      const vi = vis[sy][sx];
      const vname = tileName(vi);
      const extKey = TILE_KEY.get(t) ?? '';
      if (!skirt && this.manifest?.models?.[extKey] && (r.kind === 'upright' || r.kind === 'cross' || r.kind === 'flat' || r.kind === 'block')) {
        // modello esterno al posto dell'oggetto generato: qui solo il terreno
        groundQuad(x, y, r.ground ? tileIndex(r.ground) : defaultGround(t));
        const list = extCells.get(extKey) ?? []; list.push([x, y]); extCells.set(extKey, list);
        return;
      }
      switch (r.kind) {
        case 'ground': {
          const v0 = groundQuad(x, y, skirt && r.kind === 'ground' && t !== TILE.GRASS && t !== TILE.PATH && t !== TILE.WATER && t !== TILE.SAND ? tileIndex('grass0') : vi);
          if (!skirt && (t === TILE.WATER || t === TILE.FLOWERS)) this.animated.push({ x, y, v0 });
          // prato: un ciuffo ogni tre celle circa, così l'erba non è un pavimento piatto
          if (t === TILE.GRASS && !cave && hash(x, y, 9) < 0.4) tufts(x, y, 1, 0.34 + hash(x, y, 10) * 0.14, 0.28 + hash(x, y, 11) * 0.12);
          break;
        }
        case 'cross': {
          groundQuad(x, y, r.ground ? tileIndex(r.ground) : defaultGround(t));
          const sp = propSprite(vname, r.base);
          // alberi: pannello rivolto alla camera (come i personaggi), più un pannello incrociato per l'ombra e la profondità
          if (t === TILE.TREE) { billboardQuad(props, sp, x, y, r.w, r.h, TILT, 0.02); crossPlanes(props, sp, x, y, r.w * 0.8, r.h * 0.9, 0.01); }
          else if (t === TILE.MARKET) {
            // erba alta: il tile scuro e fitto fa da terreno e sopra crescono cinque ciuffi sfalsati, che si sovrappongono con le celle vicine
            ground.quad([[x, 0.004, y + 1], [x + 1, 0.004, y + 1], [x + 1, 0.004, y], [x, 0.004, y]], [0, 1, 0], uvq(this.uvOf(vi)));
            tufts(x, y, 5, 0.6, 0.55);
          }
          else billboardQuad(props, sp, x, y, r.w, r.h, TILT, 0.01);
          break;
        }
        case 'upright': {
          groundQuad(x, y, r.ground ? tileIndex(r.ground) : defaultGround(t));
          const sp = propSprite(vname, r.base);
          uprightRelief(props, sides, sp, x, y, r.depth, r.w ?? 1, r.h ?? 1);
          break;
        }
        case 'flat': {
          groundQuad(x, y, defaultGround(t));
          const sp = propSprite(vname, vname === 'boulder_cave' ? '#6a5c50' : r.base);
          flatRelief(props, sides, sp, x, y, r.h);
          break;
        }
        case 'block': {
          groundQuad(x, y, r.ground ? tileIndex(r.ground) : defaultGround(t));
          const same = (n: number) => n === t || (t === TILE.ROCK && n === TILE.CAVE_MOUTH) || (t === TILE.CAVE_MOUTH && n === TILE.ROCK);
          const h = t === TILE.ROCK && cave ? 1.6 : r.h;
          block(x, y, h, vi, r.front ? vi : null, this.avgColor(vname, 0.9), { l: same(at(sx - 1, sy)), r: same(at(sx + 1, sy)), b: same(at(sx, sy - 1)), f: same(at(sx, sy + 1)) });
          break;
        }
        case 'house': {
          groundQuad(x, y, tileIndex('grass0'));
          const face = this.uvOf(vi);
          if (HOUSE_ROOFS.has(t)) {
            const front = HOUSE_ROOFS.has(at(sx, sy - 1)) && !HOUSE_ROOFS.has(at(sx, sy + 1));
            const z = y + 2;
            const h0 = front ? 2.0 : 2.55, h1 = front ? 2.55 : 3.0;
            const ov = front ? 0.12 : 0; // gronda sporgente davanti
            solid.quad([[x - 0.02, h0, z + 1 + ov], [x + 1.02, h0, z + 1 + ov], [x + 1.02, h1, z], [x - 0.02, h1, z]], [0, 0.88, 0.47], uvq(face));
            const rc = this.avgColor(vname, 0.55);
            // spessore della falda: bordo frontale e laterali
            const th = 0.1;
            if (front) sides.quad([[x - 0.02, h0 - th, z + 1 + ov], [x + 1.02, h0 - th, z + 1 + ov], [x + 1.02, h0, z + 1 + ov], [x - 0.02, h0, z + 1 + ov]], [0, 0, 1], undefined, rc);
            if (!HOUSE_ROOFS.has(at(sx - 1, sy))) sides.quad([[x - 0.02, h1 - th, z], [x - 0.02, h0 - th, z + 1 + ov], [x - 0.02, h0, z + 1 + ov], [x - 0.02, h1, z]], [-1, 0, 0], undefined, rc);
            if (!HOUSE_ROOFS.has(at(sx + 1, sy))) sides.quad([[x + 1.02, h0 - th, z + 1 + ov], [x + 1.02, h1 - th, z], [x + 1.02, h1, z], [x + 1.02, h0, z + 1 + ov]], [1, 0, 0], undefined, rc);
            if (!front) {
              // corpo posteriore della casa sotto la falda alta
              const zb = z, wc = this.avgColor('wall1', 1);
              if (!isHouse(at(sx - 1, sy))) solid.quad([[x, 0, zb], [x, 0, zb + 1], [x, 2, zb + 1], [x, 2, zb]], [-1, 0, 0], uvq(wallSide));
              if (!isHouse(at(sx + 1, sy))) solid.quad([[x + 1, 0, zb + 1], [x + 1, 0, zb], [x + 1, 2, zb], [x + 1, 2, zb + 1]], [1, 0, 0], uvq(wallSide));
              if (!HOUSE_ROOFS.has(at(sx, sy - 1))) sides.quad([[x + 1, 0, zb], [x, 0, zb], [x, 2.55, zb], [x + 1, 2.55, zb]], [0, 0, -1], undefined, wc);
              // timpano: pannello verticale sopra i 2 m, sotto la falda più alta
              if (!HOUSE_ROOFS.has(at(sx - 1, sy))) sides.quad([[x, 2, zb], [x, 2, zb + 1], [x, 2.55, zb + 1], [x, 3, zb]], [-1, 0, 0], undefined, wc);
              if (!HOUSE_ROOFS.has(at(sx + 1, sy))) sides.quad([[x + 1, 2, zb + 1], [x + 1, 2, zb], [x + 1, 3, zb], [x + 1, 2.55, zb + 1]], [1, 0, 0], undefined, wc);
            }
          } else {
            const upper = HOUSE_WALLS.has(at(sx, sy + 1)); // riga delle finestre: sta sopra la riga della porta
            const z = upper ? y + 1 : y, b = upper ? 1 : 0, tp = b + 1;
            const inset = t === TILE.DOOR ? 0.12 : 0;
            solid.quad([[x, b, z + 1 - inset], [x + 1, b, z + 1 - inset], [x + 1, tp, z + 1 - inset], [x, tp, z + 1 - inset]], [0, 0, 1], uvq(face));
            if (inset) {
              const wc = this.avgColor('wall1', 0.8);
              sides.quad([[x, b, z + 1], [x, b, z + 1 - inset], [x, tp, z + 1 - inset], [x, tp, z + 1]], [1, 0, 0], undefined, wc);
              sides.quad([[x + 1, b, z + 1 - inset], [x + 1, b, z + 1], [x + 1, tp, z + 1], [x + 1, tp, z + 1 - inset]], [-1, 0, 0], undefined, wc);
              sides.quad([[x, tp, z + 1], [x, tp, z + 1 - inset], [x + 1, tp, z + 1 - inset], [x + 1, tp, z + 1]], [0, -1, 0], undefined, wc);
            }
            if (!isHouse(at(sx - 1, sy))) solid.quad([[x, b, z], [x, b, z + 1], [x, tp, z + 1], [x, tp, z]], [-1, 0, 0], uvq(wallSide));
            if (!isHouse(at(sx + 1, sy))) solid.quad([[x + 1, b, z + 1], [x + 1, b, z], [x + 1, tp, z], [x + 1, tp, z + 1]], [1, 0, 0], uvq(wallSide));
            if (t === TILE.WINDOW) this.windows.push([x + 0.5, z + 1.3]);
          }
          break;
        }
        case 'wall': {
          groundQuad(x, y, tileIndex('floor'));
          const below = at(sx, sy + 1), below2 = at(sx, sy + 2);
          if (WALL_LIKE.has(below) && !WALL_LIKE.has(below2)) break; // metà alta di un muro orizzontale: è già nel blocco sotto
          const topUv = this.uvOf(tileIndex('iwall_top')), lowUv = this.uvOf(vi === tileIndex('iwall_top') ? tileIndex('iwall') : vi);
          const wc = this.avgColor('iwall', 1), wcd = this.avgColor('iwall', 0.8);
          solid.quad([[x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, 1, y + 1], [x, 1, y + 1]], [0, 0, 1], uvq(lowUv));
          solid.quad([[x, 1, y + 1], [x + 1, 1, y + 1], [x + 1, 2, y + 1], [x, 2, y + 1]], [0, 0, 1], uvq(topUv));
          sides.quad([[x, 2, y + 1], [x + 1, 2, y + 1], [x + 1, 2, y], [x, 2, y]], [0, 1, 0], undefined, wc);
          if (!WALL_LIKE.has(at(sx - 1, sy))) sides.quad([[x, 0, y], [x, 0, y + 1], [x, 2, y + 1], [x, 2, y]], [-1, 0, 0], undefined, wcd);
          if (!WALL_LIKE.has(at(sx + 1, sy))) sides.quad([[x + 1, 0, y + 1], [x + 1, 0, y], [x + 1, 2, y], [x + 1, 2, y + 1]], [1, 0, 0], undefined, wcd);
          if (!WALL_LIKE.has(at(sx, sy - 1))) sides.quad([[x + 1, 0, y], [x, 0, y], [x, 2, y], [x + 1, 2, y]], [0, 0, -1], undefined, wcd);
          break;
        }
        case 'none': break;
      }
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cell(x, y, x, y, false);
    if (map.interior) {
      // pareti laterali fuori mappa, così la stanza è una scatola e non una pedana sospesa
      const lowUv = this.uvOf(tileIndex('iwall')), topUv = this.uvOf(tileIndex('iwall_top'));
      const wc = this.avgColor('iwall', 1);
      for (let y = -1; y <= H; y++) {
        solid.quad([[0, 0, y + 1], [0, 0, y], [0, 1, y], [0, 1, y + 1]], [1, 0, 0], uvq(lowUv));
        solid.quad([[0, 1, y + 1], [0, 1, y], [0, 2, y], [0, 2, y + 1]], [1, 0, 0], uvq(topUv));
        solid.quad([[W, 0, y], [W, 0, y + 1], [W, 1, y + 1], [W, 1, y]], [-1, 0, 0], uvq(lowUv));
        solid.quad([[W, 1, y], [W, 1, y + 1], [W, 2, y + 1], [W, 2, y]], [-1, 0, 0], uvq(topUv));
        sides.quad([[-0.3, 2, y + 1], [0, 2, y + 1], [0, 2, y], [-0.3, 2, y]], [0, 1, 0], undefined, wc);
        sides.quad([[W, 2, y + 1], [W + 0.3, 2, y + 1], [W + 0.3, 2, y], [W, 2, y]], [0, 1, 0], undefined, wc);
      }
    } else {
      for (let y = -SKIRT; y < H + SKIRT; y++) for (let x = -SKIRT; x < W + SKIRT; x++) {
        if (x >= 0 && y >= 0 && x < W && y < H) continue;
        cell(x, y, Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(H - 1, y)), true);
      }
    }
    const add = (b: GeoBuilder, mat: THREE.Material, cast: boolean, alphaDepth = false) => {
      if (b.empty) return undefined;
      const m = new THREE.Mesh(b.build(), mat);
      m.castShadow = cast; m.receiveShadow = true;
      if (alphaDepth) m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: propAtlas(), alphaTest: 0.5 });
      this.staticGroup.add(m);
      return m;
    };
    for (const [key, cells] of extCells) {
      void externalModel(key).then((obj) => {
        if (!obj || this.map !== map || this.disposed) return;
        for (const [x, y] of cells) { const c = obj.clone(); c.position.set(x + 0.5, 0, y + 0.5); this.staticGroup.add(c); }
      });
    }
    this.matProps.map = propAtlas();
    const gm = add(ground, this.matTiles, false);
    this.groundUv = gm ? (gm.geometry.getAttribute('uv') as THREE.BufferAttribute) : undefined;
    add(solid, this.matTiles, true);
    add(sides, this.matSides, true);
    add(props, this.matProps, true, true);
    // insegne degli edifici pubblici sulla facciata
    for (const pl of map.plaques ?? []) {
      const cv = drawPlaque(pl.text, pl.kind);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
      const pw = cv.width / P, ph = cv.height / P;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshLambertMaterial({ map: tex, transparent: true }));
      // la fila delle finestre sta sopra quella della porta: la facciata è a z = riga della porta + 1
      m.position.set(pl.x + 0.5, 2 - ph / 2 - 0.04, pl.y + 2 + 0.015);
      this.staticGroup.add(m);
    }
    this.applyMood();
  }

  /** Nuovo fotogramma dei tile animati (acqua, fiori). */
  animate(frame: number, night: boolean) {
    if (!this.map || !this.groundUv) return;
    const vis = visualTiles(this.map.tiles, frame, night);
    for (const a of this.animated) {
      const [u0, v0, u1, v1] = this.uvOf(vis[a.y][a.x]);
      this.groundUv.setXY(a.v0, u0, v0); this.groundUv.setXY(a.v0 + 1, u1, v0); this.groundUv.setXY(a.v0 + 2, u1, v1); this.groundUv.setXY(a.v0 + 3, u0, v1);
    }
    this.groundUv.needsUpdate = true;
  }

  setMood(m: Mood) {
    const changed = m.night !== this.mood.night;
    this.mood = m;
    this.applyMood();
    if (changed && this.map) this.loadMap(this.map, m.night);
  }

  private applyMood() {
    const { night, climate, interior, dark } = this.mood;
    const bg = interior ? new THREE.Color(dark ? 0x05040a : 0x12121c) : night ? new THREE.Color(0x0b1230) : climate === 'orso' || climate === 'tempesta' ? new THREE.Color(0x6d7890) : new THREE.Color(0x9fc8ff);
    this.scene.background = bg;
    this.scene.fog = interior ? null : new THREE.Fog(bg, night ? 12 : 16, night ? 30 : 42);
    if (interior) {
      this.hemi.color.set(0xe8e4ff); this.hemi.groundColor.set(0x4a4038); this.hemi.intensity = dark ? 0.25 : 1.05;
      this.sun.color.set(0xfff4e0); this.sun.intensity = dark ? 0.2 : 0.9;
    } else if (night) {
      this.hemi.color.set(0x4a5aa8); this.hemi.groundColor.set(0x141a30); this.hemi.intensity = 0.75;
      this.sun.color.set(0x90a0d8); this.sun.intensity = 0.5;
    } else if (climate === 'orso' || climate === 'tempesta') {
      this.hemi.color.set(0xb8c0d8); this.hemi.groundColor.set(0x4a5a48); this.hemi.intensity = 0.85;
      this.sun.color.set(0xd8dce8); this.sun.intensity = 0.9;
    } else {
      this.hemi.color.set(0xdfeaff); this.hemi.groundColor.set(0x5a7a40); this.hemi.intensity = 0.95;
      this.sun.color.set(climate === 'toro' ? 0xfff0c0 : 0xfff2d0); this.sun.intensity = climate === 'toro' ? 1.55 : 1.4;
    }
    for (const l of this.lamps) { l.visible = false; l.intensity = 0; }
  }

  // ---------------- rispecchiamento del fotogramma ----------------

  private pooled(pool: THREE.Mesh[], i: number, make: () => THREE.Mesh): THREE.Mesh {
    let m = pool[i];
    if (!m) { m = make(); pool.push(m); this.dynGroup.add(m); }
    m.visible = true;
    return m;
  }

  private setPlaneUv(m: THREE.Mesh, uv: [number, number, number, number]) {
    const a = m.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const [u0, v0, u1, v1] = uv;
    a.setXY(0, u0, v1); a.setXY(1, u1, v1); a.setXY(2, u0, v0); a.setXY(3, u1, v0); a.needsUpdate = true;
  }

  frame(f: MirrorFrame) {
    if (this.disposed) return;
    this.resize();
    // camera: inclinata come su DS, segue il centro della vista 2D (così limiti e inquadrature restano quelli del gioco)
    let cx = f.cx, cz = f.cy, yaw = 0, tilt = TILT, dist = DIST;
    if (f.zoom && f.zoom > 0) dist = DIST / f.zoom;
    if (this.free) ({ cx, cz, yaw, tilt, dist } = this.free);
    if (f.shake) { cx += (Math.random() - 0.5) * 0.25; cz += (Math.random() - 0.5) * 0.25; }
    this.yaw = yaw; this.tiltNow = tilt; this.distNow = dist;
    this.camera.position.set(cx + Math.sin(yaw) * Math.cos(tilt) * dist, Math.sin(tilt) * dist, cz + Math.cos(yaw) * Math.cos(tilt) * dist);
    this.camera.lookAt(cx, 0.4, cz);
    // il sole e la sua ombra seguono la vista
    this.sun.position.set(cx - 7, 16, cz + 6);
    this.sun.target.position.set(cx, 0, cz);
    this.sun.target.updateMatrixWorld();
    // lampade alle finestre di notte: le 8 più vicine
    if (this.mood.night && !this.mood.interior && this.windows.length) {
      const near = this.windows.map((w) => ({ w, d: (w[0] - cx) ** 2 + (w[1] - cz) ** 2 })).sort((a, b) => a.d - b.d).slice(0, this.lamps.length);
      this.lamps.forEach((l, i) => { const n = near[i]; if (!n) { l.visible = false; return; } l.visible = true; l.intensity = 2.4; l.position.set(n.w[0], 0.9, n.w[1]); });
    }
    // oggetti dinamici
    let ci = 0, ti = 0, bi = 0, li = 0, si = 0;
    let raft = false;
    for (const it of f.items) {
      if (it.kind === 'char') {
        const m = this.pooled(this.charPool, ci++, () => { const mm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), this.matChar.clone()); mm.castShadow = true; mm.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.chars, alphaTest: 0.5 }); return mm; });
        this.setPlaneUv(m, this.charUv(it.frame));
        const lift = it.lift ?? 0;
        m.position.set(it.x, 0.75 + lift * 2.6, it.y - 0.38 - lift * 0.3);
        m.rotation.y = this.yaw;
        (m.material as THREE.MeshLambertMaterial).opacity = it.alpha;
        const sh = this.pooled(this.shadowPool, si++, () => { const mm = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), this.matShadow); mm.rotation.x = -Math.PI / 2; mm.scale.set(0.42, 0.26, 1); return mm; });
        sh.position.set(it.x, 0.012, it.y - 0.45);
        sh.scale.set(0.42 * (1 - 0.5 * lift), 0.26 * (1 - 0.5 * lift), 1);
        (sh.material as THREE.MeshBasicMaterial).opacity = 0.28 * it.alpha * (1 - 0.6 * lift);
      } else if (it.kind === 'tile') {
        const m = this.pooled(this.tilePool, ti++, () => { const mm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.matProps.clone()); mm.castShadow = true; mm.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: propAtlas(), alphaTest: 0.5 }); return mm; });
        const sp = propSprite(tileName(it.frame), null);
        (m.material as THREE.MeshLambertMaterial).map = propAtlas();
        this.setPlaneUv(m, propUv(sp));
        m.position.set(it.x, 0.5, it.y - 0.4);
        m.rotation.y = this.yaw;
      } else if (it.kind === 'bubble') {
        const m = this.pooled(this.bubblePool, bi++, () => new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.58), this.matBubble));
        m.position.set(it.x, 1.55 + 0.29 * it.scale, it.y - 0.4);
        m.scale.set(it.scale, it.scale, 1);
        m.rotation.y = this.yaw;
      } else if (it.kind === 'leaf') {
        const m = this.pooled(this.leafPool, li++, () => new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.12), this.matLeaf.clone()));
        const mat = m.material as THREE.MeshLambertMaterial;
        mat.color.setHex(it.color); mat.opacity = it.alpha;
        m.position.set(it.x, it.h, it.z);
      } else if (it.kind === 'raft') {
        raft = true;
        this.raft.position.set(it.x, 0.04, it.y - 0.45);
      }
    }
    for (let i = ci; i < this.charPool.length; i++) this.charPool[i].visible = false;
    for (let i = si; i < this.shadowPool.length; i++) this.shadowPool[i].visible = false;
    for (let i = ti; i < this.tilePool.length; i++) this.tilePool[i].visible = false;
    for (let i = bi; i < this.bubblePool.length; i++) this.bubblePool[i].visible = false;
    for (let i = li; i < this.leafPool.length; i++) this.leafPool[i].visible = false;
    this.raft.visible = raft;
    this.composer.render();
    // livello 2D sopra la scena: tinta del clima, lampo e dissolvenza (il meteo è già stato disegnato dal painter)
    const c = this.ctx;
    if (f.tint.alpha > 0) { c.fillStyle = hexToCss(f.tint.color, f.tint.alpha); c.fillRect(0, 0, VW, VH); }
    if (f.flash && f.flash.a > 0) { c.fillStyle = `rgba(${f.flash.r},${f.flash.g},${f.flash.b},${f.flash.a})`; c.fillRect(0, 0, VW, VH); }
    if (f.fade && f.fade.a > 0) { c.fillStyle = `rgba(${f.fade.r},${f.fade.g},${f.fade.b},${f.fade.a})`; c.fillRect(0, 0, VW, VH); }
  }

  get info() { return { tilt: this.tiltNow, dist: this.distNow, yaw: this.yaw }; }
}
