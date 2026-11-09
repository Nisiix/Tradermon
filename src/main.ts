import Phaser from 'phaser';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './style.css';
import { WorldScene } from './scenes/world';
import { initUI, el, toast } from './ui/core';
import { initInput, initTouch } from './ui/input';
import { titleScreen, onboarding } from './ui/setup';
import { applyOptions } from './ui/menu';
import { newGame, load, hasSave, importSave } from './systems/state';

function pickFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const inp = el('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.addEventListener('change', async () => {
      const f = inp.files?.[0];
      resolve(f ? await f.text() : null);
    });
    inp.click();
  });
}

async function boot() {
  initUI();
  initInput();
  initTouch(document.getElementById('app')!);
  for (;;) {
    const choice = await titleScreen(hasSave());
    if (choice === 'continue') { if (load()) break; toast('Salvataggio non leggibile.'); continue; }
    if (choice === 'import') {
      const txt = await pickFile();
      if (txt && importSave(txt)) { toast('Salvataggio importato.'); break; }
      toast('File di salvataggio non valido.');
      continue;
    }
    newGame();
    applyOptions();
    await onboarding();
    break;
  }
  applyOptions();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 240,
    height: 160,
    pixelArt: true,
    backgroundColor: '#101018',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [WorldScene],
  });
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => undefined); });
}

void boot();

// Accesso allo stato per i test automatici e il debug da console (solo in sviluppo o con ?debug).
import * as state from './systems/state';
import { QUESTIONS } from './data/quiz/build';
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) Object.defineProperty(window, 'tradermon', { get: () => ({ state: state.S, questions: QUESTIONS, scene: (window as unknown as { __game?: Phaser.Game }).__game?.scene.getScene('world') }) });
