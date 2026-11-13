// Primo import: il dizionario inglese completo, prima dei moduli che calcolano testi all'avvio.
import './i18n/full';
import Phaser from 'phaser';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/dotgothic16/latin-400.css';
import '@fontsource/dotgothic16/latin-ext-400.css';
import './style.css';
import { WorldScene } from './scenes/world';
import { RS } from './art/art';
import { initUI, el, toast, modal, esc, confirm } from './ui/core';
import { initInput, initTouch } from './ui/input';
import { titleScreen, onboarding } from './ui/setup';
import { mentorMission, leagueMission } from './data/missions';
import { play, unlock } from './systems/music';
import { refreshAgenda } from './systems/progress';
import { applyOptions } from './ui/menu';
import { controlsTutorial, controlsSeen } from './ui/tutorial';
import { initSettings, setPhase } from './ui/settings';
import { safariNoticeOnce } from './ui/storageNotice';
import { leaveIfMoved, receiveTransfer } from './systems/transfer';
import { newGame, load, hasSave, importSave } from './systems/state';
import { initMobile } from './ui/mobile';
import { rendererType, guardRendering } from './systems/render';
import { cloudEnabled, currentPlayer } from './systems/cloud';
import { syncAtBoot, startCloudSync, cloudPlayer } from './systems/sync';
import { accountScreen, legacyPrompt } from './ui/account';
import { busy, pauseBusy } from './ui/loading';
import { whileAway } from './ui/broker';
import { translateDom } from './i18n/dom';

translateDom();

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
  if (await leaveIfMoved()) return; // vecchio indirizzo: porta i dati al nuovo
  initUI();
  initMobile();
  const moved = await receiveTransfer((local, inc) => new Promise((ok) => {
    let answer = false;
    void modal(T('Salvataggio trovato'), ({ body, button, close }) => {
      body.innerHTML = T`<p>Dal vecchio indirizzo del gioco è arrivata la partita di <b>${esc(inc.name)}</b> (${Math.round(inc.playMs / 60000)} min, ${inc.badges} Attestati).</p>
        <p>In questo browser c'è già la partita di <b>${esc(local.name)}</b> (${Math.round(local.playMs / 60000)} min). Se la sostituisci, resta una copia di riserva.</p>`;
      button(T('Usa quella arrivata'), () => { answer = true; close(); }, 'primary');
      button(T('Tieni questa'), () => close());
    }).then(() => ok(answer));
  }));
  if (moved === 'imported') toast(T('Salvataggio trasferito dal vecchio indirizzo.'));
  initInput();
  initTouch(document.getElementById('app')!);
  initSettings();
  unlock();
  play('title');
  // Giocatore (nome univoco + password) prima di tutto, tutorial compreso: la partita vive su Supabase.
  if (cloudEnabled()) {
    const player = (await busy(T('Controllo l\'accesso'), currentPlayer())) ?? (await accountScreen());
    const r = await busy(T('Carico la partita'), syncAtBoot(player, (c) => pauseBusy(() => legacyPrompt(c))));
    if (r === 'offline') toast(T('Il servizio dei salvataggi non è raggiungibile: giochi con la copia di questo dispositivo e la invio appena torna la rete.'));
    startCloudSync(() => toast(T('Salvato su questo dispositivo: lo invio online appena torna la connessione.')));
  }
  for (;;) {
    const choice = await titleScreen(hasSave());
    if (choice === 'continue') { if (load()) break; toast(T('Salvataggio non leggibile.')); continue; }
    if (choice === 'import') {
      const txt = await pickFile();
      if (txt && importSave(txt)) { toast(T('Salvataggio importato.')); break; }
      toast(T('File di salvataggio non valido.'));
      continue;
    }
    if (hasSave() && !(await confirm(T('Iniziare una nuova partita? Al primo salvataggio sostituirà quella che hai adesso.')))) continue;
    newGame();
    applyOptions();
    setPhase('onboarding');
    await onboarding(cloudPlayer()?.name);
    break;
  }
  setPhase('game');
  applyOptions();
  refreshAgenda();
  if (!controlsSeen()) await controlsTutorial();
  await safariNoticeOnce();
  const game = new Phaser.Game({
    // WebGL se possibile; Canvas 2D se su questo dispositivo WebGL ha già dato schermo nero
    type: rendererType(),
    parent: 'game',
    // risoluzione interna 720×480 (tre volte la griglia logica 240×160): i pixel art vengono
    // smussati in fase di disegno (Scale3x) e il canvas è poi adattato allo schermo con filtro lineare
    width: 240 * RS,
    height: 160 * RS,
    pixelArt: false,
    antialias: true,
    roundPixels: true,
    backgroundColor: '#101018',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // sotto i 5 fps Phaser conterebbe 16 ms a fotogramma (timer e dissolvenze rallentano): accetta fino a 500 ms
    // e, dopo un cambio di scheda, torna al tempo reale dopo 20 fotogrammi invece di 120;
    // così su un dispositivo lento la resa 2.5D va a scatti ma il gioco scorre a tempo reale
    fps: { min: 2, panicMax: 20 },
    scene: [WorldScene],
  });
  (window as unknown as { __game: Phaser.Game }).__game = game;
  game.events.once(Phaser.Core.Events.READY, () => {
    guardRendering(game, 'world');
    // il mercato vero si è mosso mentre il gioco era chiuso: allinea il conto e racconta che cosa è cambiato
    void whileAway().catch(() => undefined);
  });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => undefined); });
}

void boot();

// Accesso allo stato per i test automatici e il debug da console (solo in sviluppo o con ?debug).
import * as state from './systems/state';
import { QUESTIONS } from './data/quiz/build';
import { allMapIds } from './world/maps';
import { T } from './i18n';
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) Object.defineProperty(window, 'tradermon', { get: () => ({ state: state.S, questions: QUESTIONS, maps: allMapIds(), missions: { mentorMission, leagueMission }, scene: (window as unknown as { __game?: Phaser.Game }).__game?.scene.getScene('world') }) });
