#!/usr/bin/env node
// Genera risorse grafiche con servizi esterni che hanno un piano gratuito e le salva in public/assets3d/.
// Nessuna chiave è nel repository: si passano come variabili d'ambiente.
//
//   node scripts/ai-assets.mjs image "recinto di legno, pixel art, vista frontale, sfondo trasparente" fence.png
//       → Pollinations (https://pollinations.ai). Senza chiave è limitato e può avere un marchio;
//         con POLLINATIONS_KEY (registrazione gratuita) usa l'endpoint autenticato.
//   node scripts/ai-assets.mjs model "low poly wooden fence, game asset" fence.glb
//       → Meshy text-to-3D (https://www.meshy.ai, piano gratuito con crediti mensili). Serve MESHY_API_KEY.
//
// Higgsfield (https://higgsfield.ai) offre solo un'API a consumo (ricarica minima a pagamento) per video e immagini,
// e i crediti del piano web non valgono per l'API: per questo non è integrato.
// Nota: gli endpoint seguono la documentazione pubblica dei servizi; verifica le condizioni d'uso e la licenza
// delle immagini/modelli generati prima di distribuirli con il gioco.
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const [, , kind, prompt, outName] = process.argv;
const outDir = join(process.cwd(), 'public', 'assets3d');
if (!kind || !prompt || !outName) {
  console.log('Uso: node scripts/ai-assets.mjs image|model "descrizione" nomefile');
  process.exit(1);
}
await mkdir(outDir, { recursive: true });
const out = join(outDir, outName);

async function image() {
  const key = process.env.POLLINATIONS_KEY;
  const q = new URLSearchParams({ width: '512', height: '512', nologo: key ? 'true' : 'false', model: 'flux' });
  const url = key
    ? `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${q}`
    : `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${q}`;
  const r = await fetch(url, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
  if (!r.ok) throw new Error(`Pollinations ${r.status}: ${await r.text()}`);
  await writeFile(out, Buffer.from(await r.arrayBuffer()));
  console.log('Immagine salvata in', out);
}

async function model() {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error('Serve MESHY_API_KEY (chiave gratuita da https://www.meshy.ai)');
  const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const create = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', { method: 'POST', headers: H, body: JSON.stringify({ mode: 'preview', prompt, art_style: 'realistic', should_remesh: true, topology: 'triangle', target_polycount: 3000 }) });
  if (!create.ok) throw new Error(`Meshy ${create.status}: ${await create.text()}`);
  const { result: id } = await create.json();
  console.log('Attività Meshy', id, '(anteprima: pochi crediti; la texture richiede un secondo passaggio "refine")');
  for (;;) {
    await new Promise((r) => setTimeout(r, 8000));
    const st = await fetch(`https://api.meshy.ai/openapi/v2/text-to-3d/${id}`, { headers: H });
    const j = await st.json();
    process.stdout.write(`  ${j.status} ${j.progress ?? ''}%\r`);
    if (j.status === 'SUCCEEDED') {
      const glb = j.model_urls?.glb;
      if (!glb) throw new Error('Nessun file GLB nella risposta');
      const f = await fetch(glb);
      await writeFile(out, Buffer.from(await f.arrayBuffer()));
      console.log('\nModello salvato in', out, '- aggiungilo a public/assets3d/manifest.json');
      return;
    }
    if (j.status === 'FAILED' || j.status === 'CANCELED') throw new Error('Generazione fallita: ' + JSON.stringify(j.task_error ?? j));
  }
}

try { await (kind === 'image' ? image() : kind === 'model' ? model() : Promise.reject(new Error('Tipo sconosciuto: ' + kind))); }
catch (e) { console.error(e.message); process.exit(1); }
