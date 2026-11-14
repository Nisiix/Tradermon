// Cattura gli spezzoni di gioco del trailer, un fotogramma alla volta (30 fps esatti anche su un PC lento).
// Serve il gioco in sviluppo e solo locale:  VITE_SUPABASE_URL= VITE_SUPABASE_KEY= npx vite --port 5173
// Poi:  node trailer/cattura.cjs            (tutti gli spezzoni)
//       node trailer/cattura.cjs sea wall   (solo alcuni)
// Ogni spezzone diventa trailer/assets/clips/<nome>.mp4 (1920×1080, 30 fps); serve ffmpeg.
// Come funziona: crea una partita finta con 8 Attestati, entra nella mappa voluta, ferma il ciclo di Phaser e lo fa
// avanzare a mano di 1/30 di secondo (anche l'orologio del browser), tenendo premuto il tasto di direzione.
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// nome: [mappa, x, y, direzione iniziale, tasti "Tasto:fotogrammi" separati da virgole]
const CLIPS = {
  lab: ['lab', 6, 8, 'up', 'ArrowUp:22,none:44'], // Borgo Semina, Laboratorio delle Valigette
  r1: ['r1', 3, 7, 'right', 'ArrowRight:66'], // Percorso 1
  academy: ['academy_1', 6, 11, 'up', 'ArrowUp:40,none:26'], // Exchange di Ponte Cedola
  sea: ['sea', 14, 10, 'right', 'ArrowRight:66'], // Mare della Liquidità, in zattera
  simzone: ['simzone', 5, 7, 'up', 'ArrowUp:20,none:46'], // Diversia, Zona Simulazione
  casino: ['casino', 5, 7, 'up', 'ArrowUp:25,none:41'], // Interessa, Casinò dello Speculatore
  cave: ['cave_gold', 4, 8, 'right', 'ArrowRight:66'], // Miniera dei Lingotti, con la Lanterna
  wall: ['t9', 13, 14, 'up', 'ArrowUp:70'], // Wall Street
};
const URL = process.env.TRADERMON_URL || 'http://localhost:5173/gioca/?debug';
const OUT = path.join(__dirname, 'assets', 'clips');

async function capture(name, [map, x, y, facing, keys]) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1620, height: 1080 }, locale: 'it-IT' });
  await p.goto(URL);
  await p.waitForTimeout(2000);
  await p.evaluate(async ([map, x, y, facing]) => {
    const st = await import('/src/systems/state.ts');
    const s = st.newGame();
    s.badges = 8; s.seals = 8; s.flags.champion = true; s.flags.seaVisited = true;
    s.map = map; s.x = x; s.y = y; s.facing = facing;
    s.defeated = ['student_1_a', 'student_1_b'];
    s.visited = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9'];
    s.options.volume = 0; s.options.music = 0;
    st.save();
  }, [map, x, y, facing]);
  await p.reload();
  await p.waitForSelector('.title-screen button', { timeout: 120000 });
  await p.evaluate(() => [...document.querySelectorAll('.title-screen button')].find((b) => b.textContent.includes('Continua')).click());
  await p.waitForTimeout(2500);
  for (let i = 0; i < 6; i++) { await p.evaluate(() => document.querySelector('.tut-skip')?.click()); await p.waitForTimeout(800); }
  await p.waitForFunction(() => window.__game && window.__game.loop && window.tradermon?.scene?.map, null, { timeout: 180000 });
  await p.addStyleTag({ content: '#ui{visibility:hidden !important}' }); // niente HUD né finestre
  await p.waitForTimeout(3000);
  await p.evaluate(() => {
    const g = window.__game; g.loop.sleep();
    window.__V = performance.now();
    performance.now = () => window.__V;
    window.__stepF = () => { window.__V += 1000 / 30; g.loop.step(window.__V); };
  });
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), `trailer-${name}-`));
  let f = 0;
  for (const seg of keys.split(',')) {
    const [k, n] = seg.split(':');
    if (k !== 'none') await p.keyboard.down(k);
    for (let i = 0; i < +n; i++) {
      await p.evaluate(() => window.__stepF());
      // il canvas 3:2 tagliato a 16:9
      await p.screenshot({ path: path.join(dir, `f${String(f++).padStart(4, '0')}.png`), clip: { x: 0, y: 84, width: 1620, height: 912 }, timeout: 180000 });
    }
    if (k !== 'none') await p.keyboard.up(k);
  }
  await b.close();
  fs.mkdirSync(OUT, { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', path.join(dir, 'f%04d.png'),
    '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-g', '10',
    '-movflags', '+faststart', path.join(OUT, `${name}.mp4`)]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${name}: ${f} fotogrammi`);
}

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS);
  for (const n of names) await capture(n, CLIPS[n]);
})();
