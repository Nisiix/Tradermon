// Modelli e texture esterni per il mondo 2.5D (facoltativi).
// Se in public/assets3d/ c'è un manifest.json, gli oggetti elencati sostituiscono quelli generati dalla pixel art:
//   { "models": { "tree": "tree.glb", "fence": "fence.glb" }, "scale": { "tree": 1.4 } }
// Le chiavi sono i nomi dei tile (vedi TILE in art/art.ts, in minuscolo: tree, fence, sign, plant, shelf, ...).
// I file .glb possono venire da pacchetti CC0 (Kenney, KayKit, Quaternius) o da generatori con piano gratuito
// (Meshy, Tripo) tramite scripts/ai-assets.mjs. Vanno rispettate le licenze: niente modelli estratti da altri giochi.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface AssetManifest { models?: Record<string, string>; scale?: Record<string, number>; lift?: Record<string, number> }

let manifestP: Promise<AssetManifest | null> | null = null;
const models = new Map<string, Promise<THREE.Object3D | null>>();

export function assetManifest(): Promise<AssetManifest | null> {
  if (!manifestP) {
    manifestP = fetch('assets3d/manifest.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<AssetManifest>) : null))
      .catch(() => null);
  }
  return manifestP;
}

/** Carica (una volta) il modello esterno di un tile: normalizzato a 1 cella di larghezza, base a terra. */
export function externalModel(key: string): Promise<THREE.Object3D | null> {
  let p = models.get(key);
  if (p) return p;
  p = assetManifest().then(async (m) => {
    const file = m?.models?.[key];
    if (!file) return null;
    try {
      const gltf = await new GLTFLoader().loadAsync('assets3d/' + file);
      const obj = gltf.scene;
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3(); box.getSize(size);
      const s = (m?.scale?.[key] ?? 1) / Math.max(1e-6, Math.max(size.x, size.z));
      obj.scale.setScalar(s);
      obj.position.set(-(box.min.x + size.x / 2) * s, -box.min.y * s + (m?.lift?.[key] ?? 0), -(box.min.z + size.z / 2) * s);
      obj.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) { mm.castShadow = true; mm.receiveShadow = true; } });
      const wrap = new THREE.Group(); wrap.add(obj);
      return wrap;
    } catch (e) { console.warn('Modello 3D non caricato:', file, e); return null; }
  });
  models.set(key, p);
  return p;
}
