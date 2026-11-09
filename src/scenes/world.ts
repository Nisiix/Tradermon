import Phaser from 'phaser';
import { T, TILE, SOLID, drawTiles, drawCharacters, TILE_COUNT, CW, CH, visualTiles, ANIMATED, tileIndex } from '../art/art';
import { getMap, type MapDef, type NpcDef } from '../world/maps';
import { interact, npcVisible, onEnterTown, travelTo, type WorldApi } from '../world/scripts';
import { S, save, advanceDays, hasTech, TECH } from '../systems/state';
import { held, takeWorldPress, uiActive, clearWorld, type Key } from '../ui/input';
import { say, toast, getStage, el, esc } from '../ui/core';
import { pauseMenu } from '../ui/menu';
import { marketClock, CLIMATE_LABEL } from '../systems/market';
import { beep } from '../systems/audio';

const DIRS: Record<string, [number, number, 0 | 1 | 2 | 3]> = { down: [0, 1, 0], up: [0, -1, 1], left: [-1, 0, 2], right: [1, 0, 3] };
const DIR_NAME = ['down', 'up', 'left', 'right'] as const;

interface NpcSprite { def: NpcDef; spr?: Phaser.GameObjects.Sprite; shadow?: Phaser.GameObjects.Image; x: number; y: number; dir: number; hx: number; hy: number; nextIdle: number; walking?: boolean; foot: number }

/** Personaggi che passeggiano o si guardano intorno quando il giocatore non interagisce. */
const WANDER_KINDS = new Set(['talk', 'resident', 'student', 'daily']);
const STEP_MS = 180;

export class WorldScene extends Phaser.Scene {
  map!: MapDef;
  layer?: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
  tilemap?: Phaser.Tilemaps.Tilemap;
  player!: Phaser.GameObjects.Sprite;
  npcs: NpcSprite[] = [];
  moving = false;
  busy = false;
  overlay!: Phaser.GameObjects.Rectangle;
  hud!: HTMLElement;
  lastMs = 0;
  animFrame = 0;
  animCells: [number, number][] = [];
  walkFrame = 0;
  turnLock = 0;
  bumpLock = 0;
  lastSignMap = '';
  playerShadow?: Phaser.GameObjects.Image;
  grassOver?: Phaser.GameObjects.Sprite;

  constructor() { super('world'); }

  preload() {
    if (!this.textures.exists('tiles')) {
      this.textures.addSpriteSheet('tiles', drawTiles() as unknown as HTMLImageElement, { frameWidth: T, frameHeight: T });
      this.textures.addSpriteSheet('chars', drawCharacters() as unknown as HTMLImageElement, { frameWidth: CW, frameHeight: CH });
      // ombra morbida sotto i personaggi
      const sh = document.createElement('canvas'); sh.width = 14; sh.height = 5;
      const g = sh.getContext('2d')!; g.fillStyle = 'rgba(0,0,0,.28)';
      g.beginPath(); g.ellipse(7, 2.5, 6.5, 2.2, 0, 0, Math.PI * 2); g.fill();
      this.textures.addCanvas('shadow', sh);
      // fumetto "!" in pixel art
      const bb = document.createElement('canvas'); bb.width = 12; bb.height = 14;
      const b = bb.getContext('2d')!;
      b.fillStyle = '#202020'; b.fillRect(1, 0, 10, 11); b.fillRect(0, 1, 12, 9); b.fillRect(4, 11, 4, 1); b.fillRect(5, 12, 2, 1);
      b.fillStyle = '#ffffff'; b.fillRect(2, 1, 8, 9); b.fillRect(1, 2, 10, 7); b.fillRect(5, 10, 2, 1);
      b.fillStyle = '#d83020'; b.fillRect(5, 2, 2, 5); b.fillRect(5, 8, 2, 1);
      this.textures.addCanvas('bubble', bb);
    }
  }

  create() {
    this.hud = el('div', 'hud');
    getStage().appendChild(this.hud);
    this.overlay = this.add.rectangle(0, 0, 10, 10, 0x000000, 0).setOrigin(0).setScrollFactor(0).setDepth(100);
    this.loadMap(S.map, S.x, S.y, (DIR_NAME.indexOf(S.facing) as 0 | 1 | 2 | 3));
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateHud() });
    this.time.addEvent({ delay: 550, loop: true, callback: () => this.animateTiles() });
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.idleNpcs() });
    this.lastMs = performance.now();
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
    S.map = id; S.x = x; S.y = y; S.facing = DIR_NAME[dir];
    this.children.list.filter((c) => c !== this.overlay).forEach((c) => c.destroy());
    this.tilemap?.destroy();
    this.animFrame = 0;
    this.tilemap = this.make.tilemap({ data: visualTiles(this.map.tiles, 0), tileWidth: T, tileHeight: T });
    this.animCells = [];
    this.map.tiles.forEach((row, yy) => row.forEach((t, xx) => { if (ANIMATED.has(t)) this.animCells.push([xx, yy]); }));
    const ts = this.tilemap.addTilesetImage('tiles', 'tiles', T, T, 0, 0, 0)!;
    this.layer = this.tilemap.createLayer(0, ts, 0, 0)!;
    this.cameras.main.setBackgroundColor(this.map.interior ? '#1b1b24' : '#2e7d32');
    this.player = this.add.sprite(x * T + 8, y * T + 16, 'chars', S.avatar * 12 + dir * 3).setOrigin(0.5, 1).setDepth(10 + y);
    this.playerShadow = this.add.image(x * T + 8, y * T + 15, 'shadow').setDepth(4);
    this.grassOver = undefined;
    const now = this.time.now;
    this.npcs = this.map.npcs.map((d) => ({ def: d, x: d.x, y: d.y, dir: d.dir, hx: d.x, hy: d.y, foot: 0, nextIdle: now + 1500 + Math.random() * 3000 }));
    this.refreshNpcs(false);
    this.updateGrass();
    const cam = this.cameras.main;
    const mw = this.map.w * T, mh = this.map.h * T;
    cam.stopFollow();
    const vw = cam.width, vh = cam.height;
    if (mw <= vw && mh <= vh) { cam.removeBounds(); cam.centerOn(mw / 2, mh / 2); }
    else { cam.setBounds(Math.min(0, (mw - vw) / 2), Math.min(0, (mh - vh) / 2), Math.max(mw, vw), Math.max(mh, vh)); cam.startFollow(this.player, true, 1, 1); }
    if (this.map.town !== undefined && !this.map.interior) void onEnterTown(this.map.id);
    this.updateHud(true);
    this.applyTint();
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
        if (!n.spr) { const col = ({ stocks: 'case_blue', etf: 'case_green', crypto: 'case_orange' } as Record<string, string>)[String(n.def.data?.cls)] ?? 'case_blue'; n.spr = this.add.sprite(n.x * T + 8, n.y * T + 16, 'tiles', tileIndex(col)).setOrigin(0.5, 1).setDepth(5); }
        continue;
      }
      if (n.def.hiddenSprite) continue;
      if (!n.spr) {
        n.spr = this.add.sprite(n.x * T + 8, n.y * T + 16, 'chars', this.palFor(n.def) * 12 + n.dir * 3).setOrigin(0.5, 1).setDepth(10 + n.y);
        n.shadow = this.add.image(n.x * T + 8, n.y * T + 15, 'shadow').setDepth(4);
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
      this.tweens.add({ targets: spr, x: nx * T + 8, y: ny * T + 16, duration: ms,
        onUpdate: (tw) => { if (tw.progress > 0.5) spr.setFrame(base); sh?.setPosition(spr.x, spr.y - 1); },
        onComplete: () => { spr.setFrame(base); n.walking = false; r(); } });
    });
  }

  /** Erba alta sopra i piedi del giocatore, come nei classici. */
  updateGrass() {
    const t = this.map.tiles[S.y]?.[S.x];
    if (t === TILE.MARKET) {
      if (!this.grassOver) this.grassOver = this.add.sprite(0, 0, 'tiles', tileIndex('tall0')).setOrigin(0, 0);
      this.grassOver.setPosition(S.x * T, S.y * T + 8).setCrop(0, 8, 16, 8).setDisplayOrigin(0, 8).setDepth(10.5 + S.y).setVisible(true);
    } else this.grassOver?.setVisible(false);
  }

  rustle(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      const leaf = this.add.rectangle(x * T + 8, y * T + 12, 2, 2, i % 2 ? 0x58a838 : 0x88d058).setDepth(30 + y);
      this.tweens.add({ targets: leaf, x: leaf.x + (i - 1.5) * 5, y: leaf.y - 5 - Math.random() * 4, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => leaf.destroy() });
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

  blocked(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return true;
    const t = this.map.tiles[y][x];
    if (t === TILE.NOISE && hasTech(TECH.COLD)) return false;
    if (SOLID.has(t)) return true;
    return !!this.npcAt(x, y);
  }

  update(time: number) {
    const now = performance.now();
    S.playMs += now - this.lastMs;
    this.lastMs = now;
    if (this.busy || this.moving || uiActive()) return;
    if (this.time.now < this.turnLock) return;
    const p = takeWorldPress();
    if (p === 'menu') return void this.runScript(async () => pauseMenu((id) => travelTo(id, this.api())));
    if (p === 'a') return void this.interactFront();
    let dir: Key | undefined;
    for (const k of ['up', 'down', 'left', 'right'] as Key[]) if (held.has(k)) dir = k;
    if (!dir && p && ['up', 'down', 'left', 'right'].includes(p)) dir = p;
    if (dir) this.tryMove(dir as 'up' | 'down' | 'left' | 'right');
    void time;
  }

  setFacing(d: 'up' | 'down' | 'left' | 'right') {
    S.facing = d;
    this.player.setFrame(S.avatar * 12 + DIRS[d][2] * 3);
  }

  /** Cammina contro un ostacolo: passo sul posto e suono, come nei classici (senza ripetere il suono a raffica). */
  bump(di: number) {
    const now = this.time.now;
    if (now < this.bumpLock) return;
    this.bumpLock = now + 380;
    beep('bump');
    this.moving = true;
    this.walkFrame = (this.walkFrame + 1) % 2;
    this.player.setFrame(S.avatar * 12 + di * 3 + 1 + this.walkFrame);
    this.time.delayedCall(200, () => { this.player.setFrame(S.avatar * 12 + di * 3); this.moving = false; });
  }

  tryMove(d: 'up' | 'down' | 'left' | 'right') {
    const [dx, dy, di] = DIRS[d];
    const turned = S.facing !== d;
    this.setFacing(d);
    // un tocco breve gira il personaggio sul posto; tenendo premuto si cammina
    if (turned && !this.moving) { this.turnLock = this.time.now + 70; }
    const nx = S.x + dx, ny = S.y + dy;
    const warp = this.map.warps.find((w) => w.x === nx && w.y === ny) ?? (this.map.tiles[ny]?.[nx] === TILE.DOOR ? undefined : undefined);
    if (warp && !this.blockedNpcOnly(nx, ny)) {
      if (warp.lock === 'archive' && S.badges < 5) { void this.runScript(() => say(['La porta dell\'Archivio è chiusa.', 'Una targa dice: "Si apre solo a chi sa leggere oltre la superficie" (Mentore 5).'], 'Archivio')); return; }
      if (warp.lock === 'tower' && !S.flags.champion) { void this.runScript(() => say(['La Torre delle Sfide apre solo al Campione della Lega.'], 'Torre')); return; }
      this.moving = true;
      this.walkTo(nx, ny, di, () => {
        beep('door');
        this.moving = true;
        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.time.delayedCall(240, () => { this.loadMap(warp.to, warp.tx, warp.ty, warp.dir ?? (di as 0 | 1 | 2 | 3)); this.cameras.main.fadeIn(260, 0, 0, 0); this.moving = false; save(); });
      });
      return;
    }
    if (this.blocked(nx, ny)) {
      if (!turned) this.bump(di);
      return;
    }
    if (turned) return;
    this.walkTo(nx, ny, di, () => this.afterStep());
  }

  blockedNpcOnly(x: number, y: number) { return !!this.npcAt(x, y); }

  walkTo(nx: number, ny: number, di: number, done: () => void) {
    this.moving = true;
    this.walkFrame = (this.walkFrame + 1) % 2;
    const base = S.avatar * 12 + di * 3;
    this.player.setFrame(base + 1 + this.walkFrame);
    const intoGrass = this.map.tiles[ny]?.[nx] === TILE.MARKET;
    this.tweens.add({
      targets: this.player, x: nx * T + 8, y: ny * T + 16, duration: STEP_MS,
      onStart: () => this.player.setDepth(10 + Math.max(ny, S.y)),
      // primo mezzo passo con il piede avanti, secondo mezzo in piedi: l'andatura dei classici
      onUpdate: (tw) => { if (tw.progress > 0.5) this.player.setFrame(base); this.playerShadow?.setPosition(this.player.x, this.player.y - 1); },
      onComplete: () => {
        S.x = nx; S.y = ny; this.player.setFrame(base); this.moving = false;
        this.updateGrass();
        if (intoGrass) this.rustle(nx, ny);
        done();
      },
    });
  }

  afterStep() {
    // investitori con linea di vista
    for (const n of this.npcs) {
      if (!n.def.sight || !this.isVisible(n) || S.defeated.includes(n.def.id)) continue;
      const [dx, dy] = Object.values(DIRS)[n.dir];
      for (let k = 1; k <= n.def.sight; k++) {
        const tx = n.x + dx * k, ty = n.y + dy * k;
        if (SOLID.has(this.map.tiles[ty]?.[tx] ?? TILE.TREE)) break;
        if (tx === S.x && ty === S.y) { void this.runScript(async () => { await this.exclaim(n.def.id); await this.approach(n.def.id); await interact(n.def, this.api()); }); return; }
      }
    }
    if (this.map.route) {
      S.stepCounter++;
      if (S.stepCounter % 60 === 0) { const msgs = advanceDays(1); msgs.forEach((m) => toast(m)); }
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
    if (t === TILE.SHELF) return void this.runScript(() => say('Scaffali pieni di libri di economia. Le lezioni si leggono parlando con la Bibliotecaria o dal menu.'));
    if (t === TILE.NOISE) return void this.runScript(() => say(hasTech(TECH.COLD) ? 'Il rumore delle notizie non ti tocca più: puoi attraversare.' : ['Un muro di notizie urlate, grafici impazziti e "consigli" dai social.', 'Serve una mente fredda per attraversarlo (Mentore 7).']));
    if (t === TILE.STATION) { const st = this.npcs.find((x) => x.def.kind === 'station'); if (st) void this.runScript(() => interact(st.def, this.api())); }
    if (t === TILE.WATER) return void this.runScript(() => say('L\'acqua scorre tranquilla. Come la liquidità: utile, ma col tempo l\'inflazione la erode.'));
  }

  async runScript(fn: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    clearWorld();
    try { await fn(); } catch (e) { console.error(e); toast('Errore: ' + (e as Error).message); }
    clearWorld();
    this.busy = false;
    this.refreshNpcs();
    this.updateHud(true);
  }

  async exclaim(id: string) {
    const n = this.npcs.find((x) => x.def.id === id);
    if (!n?.spr) return;
    beep('alert');
    const t = this.add.image(n.spr.x, n.spr.y - 24, 'bubble').setOrigin(0.5, 1).setDepth(50).setScale(0.2);
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
    if (!this.blocked(bx, by)) {
      S.x = bx; S.y = by;
      this.player.setDepth(10 + by);
      this.tweens.add({ targets: this.player, x: bx * T + 8, y: by * T + 16, duration: STEP_MS, onUpdate: () => this.playerShadow?.setPosition(this.player.x, this.player.y - 1), onComplete: () => this.updateGrass() });
    }
  }

  animateTiles() {
    if (!this.layer || !this.animCells.length) return;
    this.animFrame = 1 - this.animFrame;
    const vis = visualTiles(this.map.tiles, this.animFrame);
    for (const [x, y] of this.animCells) this.layer.putTileAt(vis[y][x], x, y);
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
    this.hud.innerHTML = `<span></span>
      <span class="pill">${clk.open ? '<i class="dot on"></i>' : '<i class="dot"></i>'}${clk.label} · ${CLIMATE_LABEL[S.market.climate]}</span>
      <span class="pill">Fiducia <b>${S.stats.fiducia}</b> · Medaglie <b>${S.badges}</b></span>`;
    if (force) this.applyTint();
  }

}

export const TILE_TOTAL = TILE_COUNT;
