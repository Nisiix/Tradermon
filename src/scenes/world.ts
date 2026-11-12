import { play, setMood, trackForMap } from '../systems/music';
import { track } from '../systems/progress';
import { decorateHome } from '../world/decor';
import Phaser from 'phaser';
import { drawPlaque } from '../art/plaque';
import { P, RS, scale3x, TILE, SOLID, drawTiles, drawCharacters, TILE_COUNT, CW, CH, visualTiles, ANIMATED, tileIndex, playerPal } from '../art/art';
import { getMap, type MapDef, type NpcDef } from '../world/maps';
import { interact, npcVisible, onEnterTown, travelTo, librarySection, type WorldApi } from '../world/scripts';
import { S, save, hasTech, TECH } from '../systems/state';
import { heldDir, takeDirTap, hasWorldPress, takeWorldPress, uiActive, clearWorld, type Key } from '../ui/input';
import { say, toast, getStage, el, esc, choose } from '../ui/core';
import { pauseMenu } from '../ui/menu';
import { initSaveButton, setSaveGuard, takeDuelDone } from '../ui/savebtn';
import { canSwim, canCut, canSeeDark, boulderFlag, ABILITY } from '../world/travel';
import { hiddenPage, findPage, isTapeShelf, tapeShelf, atHodlStone, hodlRitual } from '../world/secrets';
import { SECRET_FLAGS, HODL_MS } from '../world/secretsData';
import { marketClock, CLIMATE_LABEL } from '../systems/market';
import { beep } from '../systems/audio';
import { addPlayTime, formatPlayTime, startPlayTimeAutosave } from '../systems/playtime';
import { View3D, type MirrorFrame, type MirrorItem, type Painter } from '../render3d/view';
import { tick } from '../systems/account';

const DIRS: Record<string, [number, number, 0 | 1 | 2 | 3]> = { down: [0, 1, 0], up: [0, -1, 1], left: [-1, 0, 2], right: [1, 0, 3] };
const DIR_NAME = ['down', 'up', 'left', 'right'] as const;

interface NpcSprite { def: NpcDef; spr?: Phaser.GameObjects.Sprite; shadow?: Phaser.GameObjects.Image; x: number; y: number; dir: number; hx: number; hy: number; nextIdle: number; walking?: boolean; foot: number }

/** Personaggi che passeggiano o si guardano intorno quando il giocatore non interagisce. */
const WANDER_KINDS = new Set(['talk', 'resident', 'student', 'daily']);
const STEP_MS = 180;
/** Altezza (in pixel di scena) a cui sale il personaggio durante il Trasferimento di Capitale. */
const FLIGHT_PX = 56 * 3;
/** Tocco breve da fermi: il personaggio si gira sul posto; tenendo premuto oltre questo tempo cammina. */
const TURN_MS = 85;
/** Appena fermati, un cambio di direzione riparte subito senza la pausa di rotazione. */
const MOMENTUM_MS = 110;
type Dir = 'up' | 'down' | 'left' | 'right';
interface Walk { fx: number; fy: number; tx: number; ty: number; di: number; t: number; chain: boolean; done: () => void }

export class WorldScene extends Phaser.Scene {
  map!: MapDef;
  layer?: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
  tilemap?: Phaser.Tilemaps.Tilemap;
  player!: Phaser.GameObjects.Sprite;
  npcs: NpcSprite[] = [];
  moving = false;
  busy = false;
  overlay!: Phaser.GameObjects.Rectangle;
  weather!: Phaser.GameObjects.Graphics;
  drops: { x: number; y: number; vx: number; vy: number; s: number; a: number; k: number }[] = [];
  weatherKind = '';
  nextBolt = 0;
  hud!: HTMLElement;
  lastMs = 0;
  animFrame = 0;
  animCells: [number, number][] = [];
  night = false;
  walkFrame = 0;
  turnLock = 0;
  bumpLock = 0;
  bumpToken = 0;
  /** Passo in corso, avanzato a mano in update() così da concatenare i passi senza scatti. */
  walk?: Walk;
  lastStepEnd = -1e9;
  lastSignMap = '';
  /** Tempo passato immobili davanti alla pietra delle Mani di Diamante (rituale segreto). */
  idleMs = 0;
  playerShadow?: Phaser.GameObjects.Image;
  raft?: Phaser.GameObjects.Graphics;
  grassOver?: Phaser.GameObjects.Sprite;
  /** Resa 2.5D (Opzioni → Grafica): rispecchia questa scena in un diorama Three.js; la logica resta qui. */
  view3d?: View3D;
  view3dFx = '';
  /** Trasferimento di Capitale: altezza del volo (0 a terra, 1 in cielo) e nuvole che scorrono sullo schermo. */
  flightLift = 0; flightClouds: { x: number; y: number; w: number; s: number }[] = [];

  constructor() { super('world'); }

  preload() {
    if (!this.textures.exists('tiles')) {
      this.textures.addSpriteSheet('tiles', drawTiles() as unknown as HTMLImageElement, { frameWidth: P, frameHeight: P });
      this.textures.addSpriteSheet('chars', drawCharacters() as unknown as HTMLImageElement, { frameWidth: CW * RS, frameHeight: CH * RS });
      // ombra morbida sotto i personaggi
      const sh = document.createElement('canvas'); sh.width = 14 * RS; sh.height = 5 * RS;
      const g = sh.getContext('2d')!;
      const grad = g.createRadialGradient(7 * RS, 2.5 * RS, 0, 7 * RS, 2.5 * RS, 7 * RS);
      grad.addColorStop(0, 'rgba(0,0,0,.34)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.beginPath(); g.ellipse(7 * RS, 2.5 * RS, 7 * RS, 2.4 * RS, 0, 0, Math.PI * 2); g.fill();
      this.textures.addCanvas('shadow', sh);
      // fumetto "!" in pixel art
      const bb = document.createElement('canvas'); bb.width = 12; bb.height = 14;
      const b = bb.getContext('2d')!;
      b.fillStyle = '#202020'; b.fillRect(1, 0, 10, 11); b.fillRect(0, 1, 12, 9); b.fillRect(4, 11, 4, 1); b.fillRect(5, 12, 2, 1);
      b.fillStyle = '#ffffff'; b.fillRect(2, 1, 8, 9); b.fillRect(1, 2, 10, 7); b.fillRect(5, 10, 2, 1);
      b.fillStyle = '#d83020'; b.fillRect(5, 2, 2, 5); b.fillRect(5, 8, 2, 1);
      this.textures.addCanvas('bubble', RS === 3 ? scale3x(bb) : bb);
    }
  }

  create() {
    this.hud = el('div', 'hud');
    getStage().appendChild(this.hud);
    initSaveButton();
    setSaveGuard(() => !this.busy && !this.moving && !uiActive());
    this.overlay = this.add.rectangle(0, 0, 10, 10, 0x000000, 0).setOrigin(0).setScrollFactor(0).setDepth(100);
    this.weather = this.add.graphics().setScrollFactor(0).setDepth(99);
    // post-processing della camera (filtri nativi di Phaser 4, solo WebGL): vignetta morbida e colori un po' più vivi
    try {
      const cam = this.cameras.main;
      cam.filters.internal.addVignette(0.5, 0.5, 0.95, 0.32, 0x0a1020);
      const cm = cam.filters.internal.addColorMatrix();
      cm.colorMatrix.saturate(0.12).contrast(0.05);
    } catch { /* renderer Canvas: nessun filtro */ }
    this.applyGraphics();
    window.addEventListener('tradermon:options', () => this.applyGraphics());
    this.loadMap(S.map, S.x, S.y, (DIR_NAME.indexOf(S.facing) as 0 | 1 | 2 | 3));
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateHud() });
    this.time.addEvent({ delay: 550, loop: true, callback: () => this.animateTiles() });
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.idleNpcs() });
    this.lastMs = performance.now();
    startPlayTimeAutosave();
  }

  /** Accende o spegne la resa 2.5D secondo le Opzioni. Se il WebGL non regge, resta il 2D. */
  applyGraphics() {
    const want = S.options.gfx === '3d' ? S.options.fx : '';
    if (want === this.view3dFx) return;
    this.view3d?.destroy(); this.view3d = undefined;
    this.view3dFx = want;
    if (want) {
      try {
        this.view3d = new View3D(document.getElementById('game')!, want as 'alti' | 'bassi');
        if (this.map) { this.syncMood(); this.view3d.loadMap(this.map, this.night, this.animFrame); }
      } catch (e) { console.error(e); this.view3d = undefined; this.view3dFx = ''; S.options.gfx = '2d'; toast('Grafica 2.5D non disponibile su questo dispositivo: resta il 2D.'); }
    }
    this.game.canvas.style.display = this.view3d ? 'none' : '';
    if (!this.view3d) this.scale.refresh();
  }

  syncMood() {
    const clk = marketClock();
    this.view3d?.setMood({ night: clk.night, climate: S.market.climate, interior: this.map.interior, dark: this.map.tiles.some((r) => r.includes(TILE.CAVE)) && !canSeeDark() });
  }

  /** Stato del fotogramma per la resa 2.5D: camera, dissolvenze, tinta e tutti gli sprite della scena. */
  mirror(): MirrorFrame {
    const cam = this.cameras.main;
    const items: MirrorItem[] = [];
    type GO = { texture?: { key: string }; frame?: { name: string | number }; x: number; y: number; alpha: number; visible: boolean; scaleX: number; type: string; fillColor?: number; getData?: (k: string) => unknown };
    for (const c of this.children.list as unknown as GO[]) {
      if (!c.visible || c.alpha <= 0) continue;
      const key = c.texture?.key;
      if (key === 'chars') {
        const lift = c === (this.player as unknown as GO) ? this.flightLift : 0;
        items.push({ kind: 'char', frame: Number(c.frame?.name ?? 0), x: c.x / P, y: (c.y + lift * FLIGHT_PX) / P, alpha: c.alpha, lift });
      }
      else if (key === 'tiles' && c.type === 'Sprite' && c !== (this.grassOver as unknown as GO)) items.push({ kind: 'tile', frame: Number(c.frame?.name ?? 0), x: c.x / P, y: c.y / P, alpha: c.alpha });
      else if (key === 'bubble') items.push({ kind: 'bubble', x: c.x / P, y: (c.y + 24 * RS) / P, scale: c.scaleX });
      else if (c.type === 'Rectangle' && c.getData && c.getData('z0') !== undefined) { const z0 = Number(c.getData('z0')); items.push({ kind: 'leaf', x: c.x / P, z: z0 / P, h: (z0 - c.y) / P + 0.15, color: c.fillColor ?? 0x88d058, alpha: c.alpha }); }
    }
    if (this.raft?.visible) items.push({ kind: 'raft', x: this.player.x / P, y: this.player.y / P });
    type Fx = { isRunning?: boolean; isComplete?: boolean; alpha?: number; red?: number; green?: number; blue?: number };
    const fe = (cam as unknown as { fadeEffect?: Fx }).fadeEffect, fl = (cam as unknown as { flashEffect?: Fx }).flashEffect, sh = (cam as unknown as { shakeEffect?: Fx }).shakeEffect;
    return {
      cx: cam.midPoint.x / P, cy: cam.midPoint.y / P, zoom: cam.zoom,
      shake: !!sh?.isRunning,
      fade: fe && (fe.isRunning || fe.isComplete) ? { r: fe.red ?? 0, g: fe.green ?? 0, b: fe.blue ?? 0, a: fe.alpha ?? 0 } : undefined,
      flash: fl?.isRunning ? { r: fl.red ?? 255, g: fl.green ?? 255, b: fl.blue ?? 255, a: fl.alpha ?? 0 } : undefined,
      // in 2.5D la notte è già fatta di luci e ombre: la tinta 2D resta leggera
      tint: { color: this.overlay.fillColor, alpha: this.overlay.fillAlpha * 0.35 },
      items,
    };
  }

  api(): WorldApi {
    return {
      warp: (m, x, y, d) => this.loadMap(m, x, y, d ?? 0),
      refresh: () => this.refreshNpcs(),
      player: () => ({ x: S.x, y: S.y }),
      approach: (id) => this.approach(id),
      exclaim: (id) => this.exclaim(id),
      bumpBack: () => this.bumpBack(),
      town: () => this.map.town ?? 0,
    };
  }

  loadMap(id: string, x: number, y: number, dir: 0 | 1 | 2 | 3) {
    this.map = getMap(id);
    if (id === 'home') this.map = decorateHome(this.map);
    // Massi delle Commissioni già frantumati: copia della mappa con il pavimento al loro posto
    if (this.map.tiles.some((r) => r.includes(TILE.BOULDER))) {
      const m = this.map;
      const floor = m.tiles.some((r) => r.includes(TILE.CAVE)) ? TILE.CAVE : TILE.PATH;
      this.map = { ...m, tiles: m.tiles.map((r, yy) => r.map((t, xx) => (t === TILE.BOULDER && S.flags[boulderFlag(id, xx, yy)] ? floor : t))) };
    }
    // passaggi segreti già aperti (lo scaffale della Sala del Nastro): il pavimento prende il posto dello scaffale
    if (S.flags[SECRET_FLAGS.tapeOpen] && this.map.warps.some((w) => w.lock === 'secret')) {
      const m = this.map;
      const open = new Set(m.warps.filter((w) => w.lock === 'secret').map((w) => `${w.x},${w.y}`));
      this.map = { ...m, tiles: m.tiles.map((r, yy) => r.map((t, xx) => (open.has(`${xx},${yy}`) ? TILE.FLOOR : t))) };
    }
    S.map = id; S.x = x; S.y = y; S.facing = DIR_NAME[dir];
    this.idleMs = 0;
    // l'ultima Clinica in cui sei entrato è quella in cui rinasci dopo una sconfitta
    if (/^clinic_\d+$/.test(id)) S.lastClinic = { map: id, x: 5, y: 4 };
    this.walk = undefined;
    this.children.list.filter((c) => c !== this.overlay && c !== this.weather).forEach((c) => c.destroy());
    this.tilemap?.destroy();
    this.animFrame = 0;
    this.night = marketClock().night;
    this.tilemap = this.make.tilemap({ data: visualTiles(this.map.tiles, 0, this.night), tileWidth: P, tileHeight: P });
    this.animCells = [];
    this.map.tiles.forEach((row, yy) => row.forEach((t, xx) => { if (ANIMATED.has(t)) this.animCells.push([xx, yy]); }));
    const ts = this.tilemap.addTilesetImage('tiles', 'tiles', P, P, 0, 0, 0)!;
    this.layer = this.tilemap.createLayer(0, ts, 0, 0)!;
    // insegne sul muro frontale degli edifici speciali (Clinica, Palestra, ...): le case normali non ne hanno
    for (const pl of this.map.plaques ?? []) {
      const key = `plaque_${pl.kind}_${pl.text}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, drawPlaque(pl.text, pl.kind));
      this.add.image((pl.x + 0.5) * P, pl.y * P - 2 * RS, key).setOrigin(0.5, 0).setDepth(2);
    }
    this.cameras.main.setBackgroundColor(this.map.interior ? '#1b1b24' : '#2e7d32');
    this.player = this.add.sprite(x * P + P / 2, y * P + P, 'chars', playerPal(S.avatar) * 12 + dir * 3).setOrigin(0.5, 1).setDepth(10 + y);
    this.playerShadow = this.add.image(x * P + P / 2, y * P + P - RS, 'shadow').setDepth(4);
    this.raft = undefined;
    this.placeRaft(this.onWater(x, y));
    this.grassOver = undefined;
    const now = this.time.now;
    this.npcs = this.map.npcs.map((d) => ({ def: d, x: d.x, y: d.y, dir: d.dir, hx: d.x, hy: d.y, foot: 0, nextIdle: now + 1500 + Math.random() * 3000 }));
    this.refreshNpcs(false);
    this.updateGrass();
    const cam = this.cameras.main;
    const mw = this.map.w * P, mh = this.map.h * P;
    cam.stopFollow();
    const vw = cam.width, vh = cam.height;
    if (mw <= vw && mh <= vh) { cam.removeBounds(); cam.centerOn(mw / 2, mh / 2); }
    else { cam.setBounds(Math.min(0, (mw - vw) / 2), Math.min(0, (mh - vh) / 2), Math.max(mw, vw), Math.max(mh, vh)); cam.startFollow(this.player, true, 1, 1); }
    if (this.map.town !== undefined && !this.map.interior) void onEnterTown(this.map.id);
    if (id === 'sea') S.flags.seaVisited = true;
    setMood(S.market.climate);
    play(trackForMap(id, this.map.interior, marketClock().night));
    if (/^h\d+_/.test(id) && !S.flags[`visited_${id}`]) { S.flags[`visited_${id}`] = true; track('house_unique'); }
    this.updateHud(true);
    this.applyTint();
    if (this.view3d) { this.syncMood(); this.view3d.loadMap(this.map, this.night, this.animFrame); }
  }

  /** Crea o rimuove gli sprite dei personaggi. Chi compare o sparisce a mappa già caricata lo fa con una dissolvenza. */
  refreshNpcs(animate = true) {
    for (const n of this.npcs) {
      const vis = npcVisible(n.def);
      if (!vis) {
        const spr = n.spr, sh = n.shadow;
        n.spr = undefined; n.shadow = undefined;
        if (spr && animate) this.tweens.add({ targets: [spr, sh].filter(Boolean), alpha: 0, duration: 300, onComplete: () => { spr.destroy(); sh?.destroy(); } });
        else { spr?.destroy(); sh?.destroy(); }
        continue;
      }
      if (n.def.kind === 'case') {
        if (!n.spr) { const col = ({ stocks: 'case_blue', etf: 'case_green', crypto: 'case_orange' } as Record<string, string>)[String(n.def.data?.cls)] ?? 'case_blue'; n.spr = this.add.sprite(n.x * P + P / 2, n.y * P + P, 'tiles', tileIndex(col)).setOrigin(0.5, 1).setDepth(5); }
        continue;
      }
      if (n.def.hiddenSprite) continue;
      if (!n.spr) {
        n.spr = this.add.sprite(n.x * P + P / 2, n.y * P + P, 'chars', this.palFor(n.def) * 12 + n.dir * 3).setOrigin(0.5, 1).setDepth(10 + n.y);
        n.shadow = this.add.image(n.x * P + P / 2, n.y * P + P - RS, 'shadow').setDepth(4);
        if (animate) { n.spr.setAlpha(0); n.shadow.setAlpha(0); this.tweens.add({ targets: [n.spr, n.shadow], alpha: 1, duration: 300 }); }
      }
    }
  }

  /** Comportamento a riposo: chi abita il mondo si guarda intorno e fa qualche passo vicino a casa. */
  idleNpcs() {
    if (this.busy || uiActive()) return;
    const now = this.time.now;
    for (const n of this.npcs) {
      if (!n.spr || n.walking || now < n.nextIdle || n.def.sight || !WANDER_KINDS.has(n.def.kind)) continue;
      n.nextIdle = now + 1800 + Math.random() * 3500;
      const behindCounter = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => [TILE.COUNTER, TILE.CASE_TABLE].includes(this.map.tiles[n.y + dy]?.[n.x + dx] as never));
      const d = Math.floor(Math.random() * 4);
      const [dx, dy] = Object.values(DIRS)[d];
      const nx = n.x + dx, ny = n.y + dy;
      const free = !behindCounter && Math.random() < 0.45 && Math.abs(nx - n.hx) <= 1 && Math.abs(ny - n.hy) <= 1
        && !this.blocked(nx, ny) && !(nx === S.x && ny === S.y) && !this.map.warps.some((w) => w.x === nx && w.y === ny)
        && this.map.tiles[ny]?.[nx] !== TILE.DOOR && !this.nearPlayer(nx, ny);
      n.dir = d;
      if (free) void this.stepNpc(n, nx, ny, d);
      else n.spr.setFrame(this.palFor(n.def) * 12 + d * 3);
    }
  }

  nearPlayer(x: number, y: number) { return Math.abs(x - S.x) + Math.abs(y - S.y) <= 1 || (this.moving && Math.abs(x - S.x) + Math.abs(y - S.y) <= 2); }

  /** Un passo di un personaggio, con il piede che si alterna come il giocatore. */
  stepNpc(n: NpcSprite, nx: number, ny: number, di: number, ms = STEP_MS + 60): Promise<void> {
    if (!n.spr) { n.x = nx; n.y = ny; return Promise.resolve(); }
    n.walking = true;
    n.x = nx; n.y = ny; n.dir = di; // la casella è occupata subito, così nessuno ci entra
    n.foot = 1 - n.foot;
    const base = this.palFor(n.def) * 12 + di * 3;
    const spr = n.spr, sh = n.shadow;
    spr.setFrame(base + 1 + n.foot).setDepth(10 + ny);
    return new Promise((r) => {
      this.tweens.add({ targets: spr, x: nx * P + P / 2, y: ny * P + P, duration: ms,
        onUpdate: (tw) => { if (tw.progress > 0.5) spr.setFrame(base); sh?.setPosition(spr.x, spr.y - RS); },
        onComplete: () => { spr.setFrame(base); n.walking = false; r(); } });
    });
  }

  /** Erba alta sopra i piedi del giocatore, come nei classici. */
  updateGrass() {
    const t = this.map.tiles[S.y]?.[S.x];
    if (t === TILE.MARKET) {
      if (!this.grassOver) this.grassOver = this.add.sprite(0, 0, 'tiles', tileIndex('tall0')).setOrigin(0, 0);
      this.grassOver.setPosition(S.x * P, S.y * P + P / 2).setCrop(0, P / 2, P, P / 2).setDisplayOrigin(0, P / 2).setDepth(10.5 + S.y).setVisible(true);
    } else this.grassOver?.setVisible(false);
  }

  rustle(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      const leaf = this.add.rectangle(x * P + P / 2, y * P + P * 0.75, 2 * RS, 2 * RS, i % 2 ? 0x58a838 : 0x88d058).setDepth(30 + y);
      leaf.setData('z0', leaf.y);
      this.tweens.add({ targets: leaf, x: leaf.x + (i - 1.5) * 5 * RS, y: leaf.y - (5 + Math.random() * 4) * RS, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => leaf.destroy() });
    }
  }

  palFor(d: NpcDef): number {
    if (d.kind === 'mentor') return [0, 2, 3, 4, 5, 8, 9, 6, 7][d.data?.n as number] ?? 3;
    return d.pal;
  }

  isVisible(n: NpcSprite) { return npcVisible(n.def); }

  npcAt(x: number, y: number): NpcSprite | undefined {
    return this.npcs.find((n) => n.x === x && n.y === y && this.isVisible(n));
  }

  /** player: il giocatore può entrare nell'acqua con il Flusso di Liquidità; i personaggi no. */
  blocked(x: number, y: number, player = false): boolean {
    if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return true;
    const t = this.map.tiles[y][x];
    if (player && t === TILE.WATER && canSwim()) return !!this.npcAt(x, y);
    if (t === TILE.NOISE && hasTech(TECH.COLD)) return false;
    if (SOLID.has(t)) return true;
    return !!this.npcAt(x, y);
  }

  update(time: number, delta: number) {
    const now = performance.now();
    addPlayTime(now - this.lastMs);
    this.lastMs = now;
    this.updateWeather(delta);
    if (this.flightLift > 0 || this.flightClouds.length) this.renderFlight();
    this.view3d?.frame(this.mirror());
    // tempo reale (non quello "addolcito" da Phaser, che sui fotogrammi lenti conta 16 ms): così il passo dura
    // lo stesso anche quando la resa 2.5D va sotto i 5 fps
    if (this.walk) { this.idleMs = 0; return void this.advanceWalk(Math.min(this.game.loop.rawDelta || delta, 100)); }
    if (this.busy || this.moving || uiActive()) { this.idleMs = 0; return; }
    if (this.time.now < this.turnLock) return;
    const p = takeWorldPress();
    if (p) this.idleMs = 0;
    if (p === 'menu') return void this.runScript(async () => pauseMenu((id) => this.flyTo(id)));
    if (p === 'a') return void this.interactFront();
    const dir = this.nextDir();
    if (dir) { this.idleMs = 0; this.tryMove(dir, this.time.now - this.lastStepEnd < MOMENTUM_MS); return; }
    this.tickHodl(delta);
    void time;
  }

  /** Rituale delle Mani di Diamante: un minuto immobili davanti alla pietra, senza premere nulla. */
  tickHodl(delta: number) {
    if (!atHodlStone()) { this.idleMs = 0; return; }
    const before = this.idleMs;
    this.idleMs += Math.min(delta, 100);
    if (before < HODL_MS / 2 && this.idleMs >= HODL_MS / 2) toast('Le mani di pietra sembrano scaldarsi...');
    if (this.idleMs >= HODL_MS) { this.idleMs = 0; void this.runScript(() => hodlRitual()); }
  }

  /** Direzione voluta: l'ultimo tasto tenuto premuto, altrimenti un tocco breve rimasto in memoria. */
  nextDir(): Dir | undefined {
    const tap = takeDirTap();
    return (heldDir() ?? tap) as Dir | undefined;
  }

  setFacing(d: 'up' | 'down' | 'left' | 'right') {
    S.facing = d;
    this.player.setFrame(playerPal(S.avatar) * 12 + DIRS[d][2] * 3);
  }

  /** Cammina contro un ostacolo: passo sul posto e suono, come nei classici (senza ripetere il suono a raffica). */
  bump(di: number) {
    const now = this.time.now;
    if (now < this.bumpLock) return;
    this.bumpLock = now + 380;
    beep('bump');
    // l'animazione non blocca i comandi: si può girare e ripartire subito
    this.walkFrame = (this.walkFrame + 1) % 2;
    this.player.setFrame(playerPal(S.avatar) * 12 + di * 3 + 1 + this.walkFrame);
    const token = ++this.bumpToken;
    this.time.delayedCall(200, () => { if (token === this.bumpToken && !this.walk) this.player.setFrame(playerPal(S.avatar) * 12 + DIRS[S.facing][2] * 3); });
  }

  /** continuing: il giocatore stava già camminando, quindi un cambio di direzione cammina subito. */
  tryMove(d: Dir, continuing = false, carry = 0) {
    const [dx, dy, di] = DIRS[d];
    const turned = S.facing !== d;
    if (turned) { this.setFacing(d); this.bumpToken++; }
    // da fermi un tocco breve gira il personaggio sul posto; tenendo premuto si cammina
    if (turned && !continuing) this.turnLock = this.time.now + TURN_MS;
    const nx = S.x + dx, ny = S.y + dy;
    const warp = this.map.warps.find((w) => w.x === nx && w.y === ny) ?? (this.map.tiles[ny]?.[nx] === TILE.DOOR ? undefined : undefined);
    if (warp && !this.blockedNpcOnly(nx, ny)) {
      if (warp.lock === 'archive' && S.badges < 5) { void this.runScript(() => say(['La porta dell\'Archivio è chiusa.', 'Una targa dice: "Si apre solo a chi sa leggere oltre la superficie" (Mentore 5).'], 'Archivio')); return; }
      if (warp.lock === 'tower' && !S.flags.champion) { void this.runScript(() => say(['La Torre delle Sfide apre solo al Campione della Lega.'], 'Torre')); return; }
      if (warp.lock === 'secret' && !S.flags[SECRET_FLAGS.tapeOpen]) { if (!turned || continuing) this.bump(di); return; }
      if (warp.lock === 'swim' && !canSwim()) { if (!turned || continuing) this.bump(di); return; }
      if (warp.lock === 'dark' && !canSeeDark()) { void this.runScript(() => say(['È buio pesto: non si vede nemmeno dove mettere i piedi.', `Senza la ${ABILITY.dark.name} (Attestato ${ABILITY.dark.badge}) è meglio non entrare.`])); return; }
      this.walkTo(nx, ny, di, () => {
        beep('door');
        this.moving = true;
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.time.delayedCall(240, () => { this.loadMap(warp.to, warp.tx, warp.ty, warp.dir ?? (di as 0 | 1 | 2 | 3)); this.cameras.main.fadeIn(260, 0, 0, 0); this.moving = false; save(); });
      });
      return;
    }
    if (this.blocked(nx, ny, true)) {
      if (!turned || continuing) this.bump(di);
      return;
    }
    if (turned && !continuing) return;
    this.walkTo(nx, ny, di, () => this.afterStep(), carry, true);
  }

  blockedNpcOnly(x: number, y: number) { return !!this.npcAt(x, y); }

  walkTo(nx: number, ny: number, di: number, done: () => void, carry = 0, chain = false) {
    this.moving = true;
    this.bumpToken++;
    this.walkFrame = (this.walkFrame + 1) % 2;
    this.player.setDepth(10 + Math.max(ny, S.y));
    this.walk = { fx: S.x, fy: S.y, tx: nx, ty: ny, di, t: carry, chain, done };
    this.renderWalk();
  }

  /** Posizione e fotogramma del passo in corso. */
  renderWalk() {
    const w = this.walk!;
    const k = Math.min(1, w.t / STEP_MS);
    this.player.setPosition((w.fx + (w.tx - w.fx) * k) * P + P / 2, (w.fy + (w.ty - w.fy) * k) * P + P);
    // primo mezzo passo con il piede avanti, secondo mezzo in piedi: l'andatura dei classici
    const base = playerPal(S.avatar) * 12 + w.di * 3;
    this.player.setFrame(k < 0.5 ? base + 1 + this.walkFrame : base);
    this.placeRaft(this.onWater(k < 0.5 ? w.fx : w.tx, k < 0.5 ? w.fy : w.ty));
  }

  onWater(x: number, y: number) { return this.map.tiles[y]?.[x] === TILE.WATER; }

  /** Zattera del Flusso di Liquidità sotto i piedi del giocatore quando è sull'acqua (al posto dell'ombra). */
  placeRaft(water: boolean) {
    const px = this.player.x, py = this.player.y;
    this.playerShadow?.setPosition(px, py - RS).setVisible(!water);
    if (!water) { this.raft?.setVisible(false); return; }
    if (!this.raft) {
      const g = this.add.graphics();
      const u = RS;
      g.fillStyle(0x5a3418, 1).fillRect(-8 * u, -6 * u, 16 * u, 7 * u);
      g.fillStyle(0xb07838, 1).fillRect(-7 * u, -6 * u, 14 * u, 6 * u);
      g.fillStyle(0x8a5828, 1);
      for (let i = -5; i <= 5; i += 3) g.fillRect(i * u, -6 * u, u, 6 * u);
      g.fillStyle(0xd8a860, 1).fillRect(-7 * u, -6 * u, 14 * u, u);
      g.fillStyle(0xe8f4ff, 0.8).fillRect(-9 * u, 0, 3 * u, u).fillRect(6 * u, 0, 3 * u, u);
      this.raft = g;
    }
    this.raft.setPosition(px, py).setDepth(this.player.depth - 0.5).setVisible(true);
  }

  /** Avanza il passo; a fine casella, se una direzione è ancora premuta, riparte subito con il tempo avanzato. */
  advanceWalk(delta: number) {
    const w = this.walk!;
    w.t += delta;
    this.renderWalk();
    if (w.t < STEP_MS) return;
    const extra = Math.min(w.t - STEP_MS, STEP_MS / 2);
    this.walk = undefined;
    S.x = w.tx; S.y = w.ty; this.moving = false;
    this.lastStepEnd = this.time.now;
    this.updateGrass();
    if (this.map.tiles[w.ty]?.[w.tx] === TILE.MARKET) this.rustle(w.tx, w.ty);
    w.done();
    if (!w.chain || this.walk || this.busy || this.moving || uiActive() || hasWorldPress()) return;
    const dir = this.nextDir();
    if (dir) this.tryMove(dir, true, extra);
  }

  afterStep() {
    if (this.onWater(S.x, S.y) && !S.flags.raftTip) {
      S.flags.raftTip = true;
      toast('Flusso di Liquidità: la zattera ti porta sull\'acqua. Cerca le Isole della Liquidità sui Percorsi 3, 5 e 7!');
    }
    // allievi dell'Accademia: chi prova a superarli alle spalle viene fermato
    for (const n of this.npcs) {
      if (n.def.guardY === undefined || S.y >= n.def.guardY || !this.isVisible(n) || S.defeated.includes(n.def.id)) continue;
      if (S.badges >= Number(n.def.data?.n ?? 0)) continue; // Medaglia già presa: nessun blocco
      void this.runScript(() => this.challenge(n, true));
      return;
    }
    // investitori con linea di vista
    for (const n of this.npcs) {
      if (!n.def.sight || !this.isVisible(n) || S.defeated.includes(n.def.id)) continue;
      const [dx, dy] = Object.values(DIRS)[n.dir];
      for (let k = 1; k <= n.def.sight; k++) {
        const tx = n.x + dx * k, ty = n.y + dy * k;
        if (SOLID.has(this.map.tiles[ty]?.[tx] ?? TILE.TREE)) break;
        if (tx === S.x && ty === S.y) { void this.runScript(() => this.challenge(n, false)); return; }
      }
    }
    if (this.map.route) {
      S.stepCounter++;
      track('steps');
      if (S.stepCounter % 60 === 0) tick();
    }
  }

  interactFront() {
    const [dx, dy] = DIRS[S.facing];
    const fx = S.x + dx, fy = S.y + dy;
    let n = this.npcAt(fx, fy);
    // dietro al bancone
    if (!n && [TILE.COUNTER, TILE.CASE_TABLE, TILE.TABLE].includes(this.map.tiles[fy]?.[fx] as never)) n = this.npcAt(fx + dx, fy + dy) ?? n;
    if (n) {
      if (n.walking) return; // aspetta che finisca il passo
      if (n.spr) { n.dir = [1, 0, 3, 2][DIRS[S.facing][2]]; n.spr.setFrame(this.palFor(n.def) * 12 + n.dir * 3); }
      n.nextIdle = this.time.now + 4000;
      void this.runScript(() => interact(n!.def, this.api()));
      return;
    }
    const sign = this.map.signs.find((s) => s.x === fx && s.y === fy);
    if (sign) return void this.runScript(() => say(sign.text));
    const t = this.map.tiles[fy]?.[fx];
    const page = hiddenPage(S.map, fx, fy);
    if (page) return void this.runScript(() => findPage(page));
    if (t === TILE.SHELF && isTapeShelf(S.map, fx, fy) && !S.flags[SECRET_FLAGS.tapeOpen]) {
      return void this.runScript(async () => {
        const opened = await tapeShelf(async (prompt) => (await choose(['Sì', 'No'], { prompt, cancel: true })) === 0);
        if (opened) { this.cameras.main.shake(160, 0.004); this.loadMap(S.map, S.x, S.y, DIRS[S.facing][2] as 0 | 1 | 2 | 3); }
      });
    }
    const sec = this.map.sections?.find((sc) => fy === sc.y && fx >= sc.x && fx < sc.x + sc.w);
    if (t === TILE.SHELF && sec) return void this.runScript(() => librarySection(sec, Number(/^library_(\d+)$/.exec(this.map.id)?.[1] ?? 0)));
    if (t === TILE.SHELF) return void this.runScript(() => say('Scaffali pieni di libri di economia. Le lezioni si leggono parlando con la Bibliotecaria o dal menu.'));
    if (t === TILE.NOISE) return void this.runScript(() => say(hasTech(TECH.COLD) ? 'Il rumore delle notizie non ti tocca più: puoi attraversare.' : ['Un muro di notizie urlate, grafici impazziti e "consigli" dai social.', 'Serve una mente fredda per attraversarlo (Mentore 7).']));
    if (t === TILE.STATION) { const st = this.npcs.find((x) => x.def.kind === 'station'); if (st) void this.runScript(() => interact(st.def, this.api())); }
    if (t === TILE.BOULDER) return void this.runScript(() => this.breakBoulder(fx, fy));
    if (t === TILE.CAVE_MOUTH) return void this.runScript(() => say('L\'ingresso di una grotta. Cammina verso di lui per entrare.'));
    if (t === TILE.WATER) return void this.runScript(() => say(canSwim() ? ['L\'acqua scorre tranquilla. Con il Flusso di Liquidità puoi attraversarla: cammina verso di lei.'] : ['L\'acqua scorre tranquilla. Come la liquidità: utile, ma col tempo l\'inflazione la erode.', 'Con il Flusso di Liquidità (Medaglia 3) potresti attraversarla.']));
  }

  /** Taglio dei Costi: frantuma un Masso delle Commissioni (resta rotto nel salvataggio). */
  async breakBoulder(x: number, y: number) {
    if (!canCut()) return say(['Un masso enorme, pieno di crepe a forma di "%". Le chiamano Massi delle Commissioni.', `Con il ${ABILITY.cut.name} (Attestato ${ABILITY.cut.badge}) potresti toglierlo di mezzo.`]);
    if ((await choose(['Sì', 'No'], { prompt: `Un Masso delle Commissioni blocca il passaggio. Usare ${ABILITY.cut.name}?`, cancel: true })) !== 0) return;
    beep('bump');
    S.flags[boulderFlag(S.map, x, y)] = true;
    this.cameras.main.shake(180, 0.006);
    const dir = DIRS[S.facing][2];
    this.loadMap(S.map, S.x, S.y, dir);
    toast('Costi tagliati: il masso si sbriciola e il passaggio è libero!');
    save();
  }

  async runScript(fn: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    clearWorld();
    try { await fn(); } catch (e) { console.error(e); toast('Errore: ' + (e as Error).message); }
    // dopo ogni sfida a quiz con un personaggio (vinta o persa) la partita si salva da sola
    if (takeDuelDone()) save();
    clearWorld();
    this.busy = false;
    this.refreshNpcs();
    this.updateHud(true);
  }

  /** Sfida di un allenatore che ti nota: (se serve) si gira verso di te, "!", ti viene incontro e parte il duello a quiz. */
  async challenge(n: NpcSprite, turn: boolean) {
    if (turn && n.spr) {
      const dx = S.x - n.x, dy = S.y - n.y;
      n.dir = Math.abs(dy) >= Math.abs(dx) ? (dy > 0 ? 0 : 1) : (dx < 0 ? 2 : 3);
      n.spr.setFrame(this.palFor(n.def) * 12 + n.dir * 3);
      await new Promise((r) => this.time.delayedCall(220, r));
    }
    await this.exclaim(n.def.id);
    await this.approach(n.def.id);
    await interact(n.def, this.api());
    // se perde contro un allievo, defeatRespawn (scripts.ts) lo riporta nella Clinica della stessa città
  }

  async exclaim(id: string) {
    const n = this.npcs.find((x) => x.def.id === id);
    if (!n?.spr) return;
    beep('alert');
    const t = this.add.image(n.spr.x, n.spr.y - 24 * RS, 'bubble').setOrigin(0.5, 1).setDepth(50).setScale(0.2);
    this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    await new Promise((r) => this.time.delayedCall(750, r));
    t.destroy();
  }

  async approach(id: string) {
    const n = this.npcs.find((x) => x.def.id === id);
    if (!n) return;
    if (!n.spr && !n.def.hiddenSprite) this.refreshNpcs();
    for (let i = 0; i < 12; i++) {
      const dx = Math.sign(S.x - n.x), dy = Math.sign(S.y - n.y);
      if (Math.abs(S.x - n.x) + Math.abs(S.y - n.y) <= 1) break;
      let nx = n.x, ny = n.y, di = 0;
      if (dx !== 0 && !this.blocked(n.x + dx, n.y)) { nx += dx; di = dx > 0 ? 3 : 2; }
      else if (dy !== 0 && !this.blocked(n.x, n.y + dy)) { ny += dy; di = dy > 0 ? 0 : 1; }
      else break;
      await this.stepNpc(n, nx, ny, di, STEP_MS + 20);
    }
    const fx = Math.sign(S.x - n.x), fy = Math.sign(S.y - n.y);
    n.dir = fy > 0 ? 0 : fy < 0 ? 1 : fx < 0 ? 2 : 3;
    n.spr?.setFrame(this.palFor(n.def) * 12 + n.dir * 3);
    const face = (['up', 'down', 'right', 'left'] as const)[n.dir];
    this.setFacing(face);
  }

  bumpBack() {
    const [dx, dy] = DIRS[S.facing];
    const bx = S.x - dx, by = S.y - dy;
    if (!this.blocked(bx, by, true)) {
      S.x = bx; S.y = by;
      this.player.setDepth(10 + by);
      this.tweens.add({ targets: this.player, x: bx * P + P / 2, y: by * P + P, duration: STEP_MS, onUpdate: () => this.placeRaft(this.onWater(bx, by)), onComplete: () => this.updateGrass() });
    }
  }

  /** Meteo legato al clima di mercato: pioggia con l'orso, temporale con lampi nella tempesta, scintille con il toro, foglie e lucciole altrimenti. */
  /** Trasferimento di Capitale: decollo con nuvole, dissolvenza bianca, atterraggio nella città scelta. */
  async flyTo(dest: string) {
    const cam = this.cameras.main;
    const lift = (to: number, ms: number) => new Promise<void>((res) => this.tweens.add({ targets: this, flightLift: to, duration: ms, ease: to ? 'Quad.easeIn' : 'Quad.easeOut', onComplete: () => res() }));
    this.setFacing('down');
    beep('coin');
    for (let i = 0; i < 9; i++) this.flightClouds.push({ x: Math.random() * cam.width, y: -40 * RS - Math.random() * cam.height, w: (14 + Math.random() * 22) * RS, s: 0.6 + Math.random() * 0.8 });
    cam.zoomTo(0.72, 1000, 'Quad.easeInOut');
    await lift(1, 1000);
    cam.fadeOut(320, 255, 255, 255);
    await new Promise((r) => this.time.delayedCall(340, r));
    travelTo(dest, this.api());
    cam.setZoom(0.72);
    cam.fadeIn(500, 255, 255, 255);
    cam.zoomTo(1, 1000, 'Quad.easeInOut');
    await lift(0, 1000);
    this.flightClouds = [];
    this.player.setPosition(S.x * P + P / 2, S.y * P + P);
    this.playerShadow?.setScale(1).setAlpha(1);
  }

  /** Posizione del personaggio e dell'ombra durante il volo; le nuvole scorrono verso il basso sopra la scena. */
  renderFlight() {
    const k = this.flightLift;
    if (!this.walk) this.player.setPosition(S.x * P + P / 2, S.y * P + P - k * FLIGHT_PX);
    this.playerShadow?.setScale(1 - 0.55 * k).setAlpha(1 - 0.6 * k);
    const cam = this.cameras.main;
    const g: Painter = this.view3d ? this.view3d.painter : this.weather;
    for (const c of this.flightClouds) {
      c.y += (2 + 9 * k) * c.s;
      if (c.y > cam.height + 30 * RS) { c.y = -30 * RS - Math.random() * 60 * RS; c.x = Math.random() * cam.width; }
      const a = 0.25 + 0.6 * k;
      g.fillStyle(0xffffff, a);
      g.fillRect(c.x, c.y, c.w, 6 * RS);
      g.fillRect(c.x + c.w * 0.2, c.y - 4 * RS, c.w * 0.55, 4 * RS);
      g.fillRect(c.x + c.w * 0.1, c.y + 6 * RS, c.w * 0.8, 3 * RS);
      g.fillStyle(0xffffff, a * 0.5);
      g.fillRect(c.x - 3 * RS, c.y + 2 * RS, c.w + 6 * RS, 3 * RS);
    }
  }

  updateWeather(delta: number) {
    const clk = marketClock();
    const kind = this.map.interior ? '' : S.market.climate + (clk.night ? '_n' : '');
    const cam = this.cameras.main;
    const W = cam.width, H = cam.height;
    if (kind !== this.weatherKind) {
      this.weatherKind = kind;
      this.drops = [];
      if (clk.night !== this.night) { this.night = clk.night; this.refreshNpcs(); this.animateTiles(); this.syncMood(); }
      const n = kind.startsWith('orso') ? 90 : kind.startsWith('tempesta') ? 160 : kind.startsWith('toro') ? 28 : kind ? 10 : 0;
      for (let i = 0; i < n; i++) this.drops.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, s: 1 + Math.random(), a: Math.random(), k: Math.random() });
      if (clk.night && kind) for (let i = 0; i < 14; i++) this.drops.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, s: 0.4 + Math.random() * 0.5, a: Math.random(), k: 2 + Math.random() });
    }
    const g: Painter = this.view3d ? this.view3d.painter : this.weather;
    g.clear();
    if (!kind) return;
    const dt = Math.min(50, delta) / 16.7;
    const climate = S.market.climate;
    for (const d of this.drops) {
      if (d.k >= 2) {
        // lucciole: vagano lente e pulsano
        d.a += 0.03 * dt; d.x += Math.sin(d.a * 1.7 + d.k) * 0.6 * dt; d.y += Math.cos(d.a * 1.3 + d.k) * 0.4 * dt;
        const al = 0.35 + 0.65 * Math.abs(Math.sin(d.a));
        g.fillStyle(0xe8ff90, al); g.fillRect(d.x, d.y, RS, RS);
        g.fillStyle(0xe8ff90, al * 0.25); g.fillRect(d.x - RS, d.y - RS, RS * 3, RS * 3);
      } else if (climate === 'orso' || climate === 'tempesta') {
        const storm = climate === 'tempesta';
        d.x -= (storm ? 3 : 1) * d.s * dt; d.y += (storm ? 11 : 8) * d.s * dt;
        g.lineStyle(RS * 0.6, storm ? 0xb8c8e8 : 0xa8c0f0, 0.35 + 0.3 * d.s);
        g.lineBetween(d.x, d.y, d.x - (storm ? 3 : 1) * RS * 0.5, d.y + 4 * RS * 0.7);
      } else if (climate === 'toro') {
        // scintille dorate che salgono piano e brillano
        d.a += 0.05 * dt; d.y -= 0.35 * d.s * dt; d.x += Math.sin(d.a) * 0.3 * dt;
        const al = 0.2 + 0.6 * Math.abs(Math.sin(d.a));
        g.fillStyle(0xfff0a0, al); g.fillRect(d.x, d.y, RS, RS);
        g.fillStyle(0xfff0a0, al * 0.5); g.fillRect(d.x - RS, d.y, RS * 3, RS); g.fillRect(d.x, d.y - RS, RS, RS * 3);
      } else {
        // foglie che scendono dondolando
        d.a += 0.04 * dt; d.y += 0.8 * d.s * dt; d.x += (0.5 + Math.sin(d.a) * 1.2) * dt;
        g.fillStyle(d.k > 0.5 ? 0x8cc850 : 0xd8a040, 0.8); g.fillRect(d.x, d.y, RS * 1.5, RS);
      }
      if (d.y > H + 8) { d.y = -8; d.x = Math.random() * W; }
      if (d.y < -8) { d.y = H + 8; d.x = Math.random() * W; }
      if (d.x < -8) d.x = W + 8; else if (d.x > W + 8) d.x = -8;
    }
    if (climate === 'tempesta') {
      if (this.time.now > this.nextBolt) {
        this.nextBolt = this.time.now + 4000 + Math.random() * 6000;
        cam.flash(140, 230, 235, 255);
      }
    }
  }

  animateTiles() {
    if (!this.layer || !this.animCells.length) return;
    this.animFrame = 1 - this.animFrame;
    const vis = visualTiles(this.map.tiles, this.animFrame, this.night);
    for (const [x, y] of this.animCells) this.layer.putTileAt(vis[y][x], x, y);
    this.view3d?.animate(this.animFrame, this.night);
  }

  applyTint() {
    const clk = marketClock();
    const cam = this.cameras.main;
    this.overlay.setSize(cam.width, cam.height);
    let color = 0x000000, alpha = 0;
    if (!this.map.interior) {
      if (clk.night) { color = 0x0a1240; alpha = 0.32; }
      if (S.market.climate === 'orso') { color = clk.night ? 0x0a1240 : 0x34405a; alpha = Math.max(alpha, 0.18); }
      if (S.market.climate === 'tempesta') { color = 0x2a1a40; alpha = Math.max(alpha, 0.25); }
      if (S.market.climate === 'toro' && !clk.night) { color = 0xffe9a0; alpha = 0.08; }
    }
    this.overlay.setFillStyle(color, alpha);
  }

  updateHud(force = false) {
    if (!this.hud) return;
    const clk = marketClock();
    if (force && this.lastSignMap !== this.map.id) {
      this.lastSignMap = this.map.id;
      // cartello del luogo, come nei classici: entra dall'alto, resta qualche secondo ed esce
      getStage().querySelectorAll('.locsign').forEach((e) => e.remove());
      const sign = el('div', 'locsign' + (this.map.interior ? ' inside' : ''), esc(this.map.name));
      getStage().appendChild(sign);
      setTimeout(() => sign.remove(), 3200);
    }
    this.hud.innerHTML = `<span class="pill playtime" title="Tempo di gioco totale">Tempo <b>${formatPlayTime(S.playMs)}</b></span>
      <span class="pill">${clk.open ? '<i class="dot on"></i>' : '<i class="dot"></i>'}${clk.label} · ${CLIMATE_LABEL[S.market.climate]}</span>
      <span class="pill">Fiducia <b>${S.stats.fiducia}</b> · Attestati <b>${S.badges}</b>${S.badges ? ` · Sigilli <b>${S.seals}</b>` : ''}</span>`;
    if (force) this.applyTint();
  }

}

export const TILE_TOTAL = TILE_COUNT;
