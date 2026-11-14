import * as THREE from 'three';
import { BOAT_COLORS, type BoatDir } from '../art/boat';

/** Altezza del fondo della barca su cui poggiano i piedi del personaggio, e ampiezza del galleggiamento. */
export const BOAT_FLOOR = 0.07;
export const BOAT_BOB = 0.03;

/** Sagoma vista dall'alto: prua a punta verso +x, poppa arrotondata. */
const SIZE = 1.3;
function hullShape(k: number): THREE.Shape {
  const L = 0.6 * k * SIZE, S = 0.5 * k * SIZE, W = 0.3 * k * SIZE;
  const s = new THREE.Shape();
  s.moveTo(L, 0);
  s.quadraticCurveTo(L * 0.55, W * 1.08, 0, W);
  s.lineTo(-S * 0.8, W * 0.92);
  s.quadraticCurveTo(-S * 1.04, W * 0.7, -S, 0);
  s.quadraticCurveTo(-S * 1.04, -W * 0.7, -S * 0.8, -W * 0.92);
  s.lineTo(0, -W);
  s.quadraticCurveTo(L * 0.55, -W * 1.08, L, 0);
  return s;
}

/** Estrusione della sagoma verso l'alto (la forma sta nel piano XZ, l'altezza su Y). */
function extrudeUp(shape: THREE.Shape, depth: number, bevel = 0): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 14 });
  g.rotateX(-Math.PI / 2);
  return g;
}

const YAW: Record<BoatDir, number> = { 0: -Math.PI / 2, 1: Math.PI / 2, 2: Math.PI, 3: 0 };

/**
 * Barchetta 2.5D del Flusso di Liquidità: scafo con fiancata dipinta e riga bianca, bordo di legno, fondo ad assi,
 * bandierina che sventola; gira dolcemente verso la direzione di marcia, galleggia e lascia una scia di schiuma.
 */
export class Boat3D {
  readonly root = new THREE.Group();
  private hull = new THREE.Group();
  private flag: THREE.Mesh;
  private foam: { m: THREE.Mesh; t: number; life: number; grow: number; vx: number; vz: number }[] = [];
  private rings: { m: THREE.Mesh; t: number; life: number; grow: number }[] = [];
  private yaw = 0;
  private wake = 0;
  private ring = 0;
  private last = 0;
  private wasOn = false;

  constructor(parent: THREE.Object3D) {
    const C = BOAT_COLORS;
    const hullMat = new THREE.MeshLambertMaterial({ color: C.hull });
    const rimMat = new THREE.MeshLambertMaterial({ color: C.rim });
    const floorMat = new THREE.MeshLambertMaterial({ color: C.floor });
    const stripeMat = new THREE.MeshLambertMaterial({ color: C.stripe });
    // fiancate: anello tra la sagoma esterna e quella interna (facce in alto = bordo di legno, lati = vernice)
    const ring = hullShape(1);
    ring.holes.push(new THREE.Path(hullShape(0.84).getPoints(28).reverse()));
    const walls = new THREE.Mesh(extrudeUp(ring, 0.32, 0.018), [rimMat, hullMat]);
    walls.position.y = -0.08;
    // riga bianca appena fuori dalla fiancata
    const band = hullShape(1.025);
    band.holes.push(new THREE.Path(hullShape(0.98).getPoints(28).reverse()));
    const stripe = new THREE.Mesh(extrudeUp(band, 0.035), stripeMat);
    stripe.position.y = 0.08;
    // fondo con le assi
    const floor = new THREE.Mesh(extrudeUp(hullShape(0.86), 0.04), floorMat);
    floor.position.y = BOAT_FLOOR - 0.04;
    const planks = new THREE.Group();
    for (const x of [-0.3, 0, 0.3]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.012, 0.58), new THREE.MeshLambertMaterial({ color: C.floorDark }));
      p.position.set(x, BOAT_FLOOR + 0.006, 0);
      planks.add(p);
    }
    // bandierina a poppa
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), new THREE.MeshLambertMaterial({ color: C.pole }));
    pole.position.set(-0.52, 0.2 + 0.25, 0);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.2, -0.05, 0, 0, -0.12, 0], 3));
    fg.computeVertexNormals();
    this.flag = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ color: C.flag, side: THREE.DoubleSide }));
    this.flag.position.set(-0.52, 0.7, 0);
    for (const m of [walls, stripe, floor, pole, this.flag]) { m.castShadow = true; m.receiveShadow = true; }
    this.hull.add(walls, stripe, floor, planks, pole, this.flag);
    this.hull.rotation.order = 'YXZ';
    this.root.add(this.hull);
    this.root.visible = false;
    parent.add(this.root);
    const foamMat = new THREE.MeshBasicMaterial({ color: C.foam, transparent: true, opacity: 0, depthWrite: false });
    // schiuma della scia: macchie morbide che si allargano e restano indietro
    const blob = new THREE.CircleGeometry(0.07, 12);
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(blob, foamMat.clone());
      m.rotation.x = -Math.PI / 2; m.visible = false;
      parent.add(m);
      this.foam.push({ m, t: 0, life: 1, grow: 1, vx: 0, vz: 0 });
    }
    // cerchi sottili intorno alla barca ferma o appena salita
    const ringG = new THREE.RingGeometry(0.47, 0.5, 40);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(ringG, foamMat.clone());
      m.rotation.x = -Math.PI / 2; m.visible = false;
      parent.add(m);
      this.rings.push({ m, t: 0, life: 1, grow: 1 });
    }
  }

  /** Disegna la barca per questo fotogramma; `b` assente = nessuno sull'acqua. */
  update(b: { x: number; y: number; dir: BoatDir; moving: boolean; bob: number; roll: number; pitch: number } | undefined, now: number) {
    const dt = Math.min(100, this.last ? now - this.last : 16);
    this.last = now;
    this.tickFoam(dt);
    if (!b) { this.root.visible = false; this.wasOn = false; return; }
    const cx = b.x, cz = b.y - 0.45;
    const target = YAW[b.dir];
    if (!this.wasOn) {
      this.yaw = target;
      for (let i = 0; i < 2; i++) this.ripple(cx, cz, 1 + i * 0.35, 900 + i * 250, 0.7);
    }
    this.wasOn = true;
    // virata morbida: l'angolo più corto verso la nuova direzione
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt / 110);
    this.root.visible = true;
    this.root.position.set(cx, b.bob * BOAT_BOB, cz);
    this.hull.rotation.set(b.roll, this.yaw, b.pitch);
    this.flag.rotation.y = Math.sin(now / 160) * 0.35 + (b.moving ? 0.25 : 0);
    if (b.moving) {
      this.wake -= dt;
      if (this.wake <= 0) {
        this.wake = 70;
        const bx = Math.cos(this.yaw), bz = -Math.sin(this.yaw);
        const sx = -bz, sz = bx; // di fianco
        // scia a V: due file di schiuma dalla poppa che si aprono verso l'esterno
        for (const side of [-1, 1]) {
          const r = (Math.random() - 0.5) * 0.06;
          this.spawn(cx - bx * 0.62 + sx * side * 0.16 + r, cz - bz * 0.62 + sz * side * 0.16 + r, 1.1, 900, 0.75, sx * side * 0.00035 - bx * 0.0001, sz * side * 0.00035 - bz * 0.0001);
        }
        // baffo d'acqua ai lati della prua
        for (const side of [-1, 1]) this.spawn(cx + bx * 0.55 + sx * side * 0.2, cz + bz * 0.55 + sz * side * 0.2, 0.7, 380, 0.6, sx * side * 0.0005, sz * side * 0.0005);
      }
    } else {
      this.ring -= dt;
      if (this.ring <= 0) { this.ring = 1500; this.ripple(cx, cz, 1, 1500, 0.5); }
    }
  }

  /** Il pezzo libero (o quello più vecchio) del gruppo. */
  private take<F extends { m: THREE.Mesh; t: number; life: number }>(pool: F[]): F {
    return pool.reduce((a, c) => (!a.m.visible ? a : !c.m.visible ? c : c.t / c.life > a.t / a.life ? c : a));
  }

  private spawn(x: number, z: number, size: number, life: number, alpha: number, vx = 0, vz = 0) {
    const f = this.take(this.foam);
    Object.assign(f, { t: 0, life, grow: size, vx, vz });
    f.m.visible = true; f.m.position.set(x, 0.015, z); f.m.userData.alpha = alpha;
  }

  private ripple(x: number, z: number, size: number, life: number, alpha: number) {
    const f = this.take(this.rings);
    Object.assign(f, { t: 0, life, grow: size });
    f.m.visible = true; f.m.position.set(x, 0.014, z); f.m.userData.alpha = alpha;
  }

  private tickFoam(dt: number) {
    for (const f of [...this.foam, ...this.rings] as { m: THREE.Mesh; t: number; life: number; grow: number; vx?: number; vz?: number }[]) {
      if (!f.m.visible) continue;
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) { f.m.visible = false; continue; }
      f.m.position.x += (f.vx ?? 0) * dt; f.m.position.z += (f.vz ?? 0) * dt;
      const s = f.grow * (0.6 + k * 1.2);
      f.m.scale.set(s, s, 1);
      (f.m.material as THREE.MeshBasicMaterial).opacity = (f.m.userData.alpha ?? 0.6) * (1 - k) * (1 - k);
    }
  }
}
