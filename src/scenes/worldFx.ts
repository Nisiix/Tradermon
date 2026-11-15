// Effetti della scena del mondo: meteo legato al clima di mercato, tinta di notte e di crisi, nuvole del volo.
// Staccati da scenes/world.ts (che li richiama): toccano solo lo stato grafico della scena, non la logica del gioco.
import type { WorldScene } from './world';
import type { Painter } from '../render3d/view';
import { S } from '../systems/state';
import { marketClock } from '../systems/market';
import { RS, P } from '../art/art';

/** Altezza massima del volo del Trasferimento di Capitale, in pixel. */
export const FLIGHT_PX = 56 * 3;

/** Posizione del personaggio e dell'ombra durante il volo; le nuvole scorrono verso il basso sopra la scena. */
export function renderFlight(sc: WorldScene) {
  const k = sc.flightLift;
  if (!sc.walk) sc.player.setPosition(S.x * P + P / 2, S.y * P + P - k * FLIGHT_PX);
  sc.playerShadow?.setScale(1 - 0.55 * k).setAlpha(1 - 0.6 * k);
  const cam = sc.cameras.main;
  const g: Painter = sc.view3d ? sc.view3d.painter : sc.weather;
  for (const c of sc.flightClouds) {
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

export function updateWeather(sc: WorldScene, delta: number) {
  const clk = marketClock();
  const kind = sc.map.interior ? '' : S.market.climate + (clk.night ? '_n' : '');
  const cam = sc.cameras.main;
  const W = cam.width, H = cam.height;
  if (kind !== sc.weatherKind) {
    sc.weatherKind = kind;
    sc.drops = [];
    if (clk.night !== sc.night) { sc.night = clk.night; sc.refreshNpcs(); sc.animateTiles(); sc.syncMood(); }
    const n = kind.startsWith('orso') ? 90 : kind.startsWith('tempesta') ? 160 : kind.startsWith('toro') ? 28 : kind ? 10 : 0;
    for (let i = 0; i < n; i++) sc.drops.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, s: 1 + Math.random(), a: Math.random(), k: Math.random() });
    if (clk.night && kind) for (let i = 0; i < 14; i++) sc.drops.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, s: 0.4 + Math.random() * 0.5, a: Math.random(), k: 2 + Math.random() });
  }
  const g: Painter = sc.view3d ? sc.view3d.painter : sc.weather;
  g.clear();
  if (!sc.view3d) sc.paintCaveDark(g);
  if (!kind) return;
  const dt = Math.min(50, delta) / 16.7;
  const climate = S.market.climate;
  for (const d of sc.drops) {
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
    if (sc.time.now > sc.nextBolt) {
      sc.nextBolt = sc.time.now + 4000 + Math.random() * 6000;
      cam.flash(140, 230, 235, 255);
    }
  }
}

export function applyTint(sc: WorldScene) {
  const clk = marketClock();
  const cam = sc.cameras.main;
  sc.overlay.setSize(cam.width, cam.height);
  let color = 0x000000, alpha = 0;
  if (!sc.map.interior) {
    if (clk.night) { color = 0x0a1240; alpha = 0.32; }
    if (S.market.climate === 'orso') { color = clk.night ? 0x0a1240 : 0x34405a; alpha = Math.max(alpha, 0.18); }
    if (S.market.climate === 'tempesta') { color = 0x2a1a40; alpha = Math.max(alpha, 0.25); }
    if (S.market.climate === 'toro' && !clk.night) { color = 0xffe9a0; alpha = 0.08; }
  }
  sc.overlay.setFillStyle(color, alpha);
}
