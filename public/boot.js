// Guardiano dell'avvio del gioco (script classico, gira prima del codice del gioco e anche se quello non parte).
// - Mostra subito "Caricamento…": su telefono il codice del gioco è grande e, senza, si vede solo uno schermo nero.
// - Se il gioco non arriva alla prima schermata entro 25 secondi, o se un errore lo ferma prima, mostra un pannello
//   con il motivo (testo dell'errore, browser, grafica) e tre uscite: riprova, grafica semplificata, torna alla home.
// - Dopo l'avvio un errore non gestito compare in una striscia in basso, così sul telefono si può leggere e riferire.
// Testi in italiano e inglese qui dentro: questo file non passa dal sistema di traduzione del gioco.
(function () {
  'use strict';
  var lang = 'en';
  try {
    var v = localStorage.getItem('tradermon.lang');
    if (v === 'it' || v === 'en') lang = v;
    else if (localStorage.getItem('tradermon.save.v1')) lang = 'it';
  } catch (e) { /* storage non disponibile */ }
  var TX = {
    it: {
      loading: 'Caricamento di Tradermon…',
      slow: 'Il gioco ci mette troppo ad avviarsi.',
      failed: 'Il gioco non è riuscito ad avviarsi.',
      hint: 'Prova a ricaricare. Se resta così, scegli la grafica semplificata. Se vuoi segnalarlo, manda questo testo:',
      retry: 'Riprova',
      lite: 'Grafica semplificata',
      home: 'Torna alla home',
      oops: 'Qualcosa si è inceppato:',
      reload: 'Ricarica',
      close: 'Chiudi',
      none: 'nessun errore registrato',
    },
    en: {
      loading: 'Loading Tradermon…',
      slow: 'The game is taking too long to start.',
      failed: 'The game could not start.',
      hint: 'Try reloading. If it stays like this, choose simplified graphics. To report it, send this text:',
      retry: 'Retry',
      lite: 'Simplified graphics',
      home: 'Back to home',
      oops: 'Something went wrong:',
      reload: 'Reload',
      close: 'Close',
      none: 'no error recorded',
    },
  }[lang];

  var errors = [];
  var ready = false;
  var box = null;
  var bar = null;

  function text(e) {
    if (!e) return 'unknown';
    if (typeof e === 'string') return e;
    var s = (e.name ? e.name + ': ' : '') + (e.message || String(e));
    if (e.stack) s += '\n' + String(e.stack).split('\n').slice(0, 4).join('\n');
    return s;
  }
  function graphics() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2');
      if (!gl) return 'WebGL2: no' + (c.getContext('webgl') ? ' (WebGL1 ok)' : ', WebGL1: no');
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      var half = !!(gl.getExtension('EXT_color_buffer_half_float') || gl.getExtension('EXT_color_buffer_float'));
      var out = 'WebGL2: ' + gpu + ', max texture ' + gl.getParameter(gl.MAX_TEXTURE_SIZE) + ', float targets ' + (half ? 'yes' : 'no');
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return out;
    } catch (e) { return 'WebGL: ' + text(e); }
  }
  function report() {
    var lines = [];
    lines.push(errors.length ? errors.join('\n---\n') : TX.none);
    lines.push('UA: ' + navigator.userAgent);
    lines.push('Screen: ' + screen.width + 'x' + screen.height + ' @' + (window.devicePixelRatio || 1) + ', view ' + innerWidth + 'x' + innerHeight);
    lines.push(graphics());
    try { lines.push('Renderer: ' + (localStorage.getItem('tradermon.renderer') || 'auto') + ', 2.5D: ' + (localStorage.getItem('tradermon.no3d') === '1' ? 'off' : 'on')); } catch (e) { /* niente */ }
    return lines.join('\n');
  }
  function btn(label, primary, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'font:12px/1.4 "Press Start 2P",monospace;padding:10px 12px;border:3px solid #000;box-shadow:3px 3px 0 #000;cursor:pointer;' +
      (primary ? 'background:#3060c8;color:#fff;' : 'background:#f8f8f0;color:#383840;');
    b.addEventListener('click', fn);
    return b;
  }
  function home() {
    var url = new URL('../', location.href).href;
    try { if (window.top && window.top !== window) { window.top.location.href = url; return; } } catch (e) { /* cornice di un altro sito */ }
    location.href = url;
  }
  function lite() {
    try { localStorage.setItem('tradermon.no3d', '1'); localStorage.setItem('tradermon.renderer', 'canvas'); } catch (e) { /* niente */ }
    location.reload();
  }

  // "Caricamento…" mentre arriva il codice del gioco
  var wait = document.createElement('div');
  wait.id = 'boot-wait';
  wait.setAttribute('role', 'status');
  wait.style.cssText = 'position:fixed;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:#101018;color:#f8d860;font:14px/1.5 monospace;text-align:center;padding:16px;pointer-events:none;';
  wait.textContent = TX.loading;

  function panel(title) {
    if (ready || box) return;
    if (wait.parentNode) wait.parentNode.removeChild(wait);
    box = document.createElement('div');
    box.id = 'boot-fail';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;inset:0;z-index:100000;overflow:auto;background:#101018;color:#f0f0f0;font:15px/1.5 monospace;padding:16px;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;';
    var h = document.createElement('p'); h.style.cssText = 'margin:0;color:#f8d860;font-weight:bold;text-align:center;'; h.textContent = title;
    var p = document.createElement('p'); p.style.cssText = 'margin:0;max-width:40em;text-align:center;'; p.textContent = TX.hint;
    var pre = document.createElement('textarea');
    pre.readOnly = true; pre.value = report();
    pre.style.cssText = 'width:min(100%,46em);height:9em;flex-shrink:0;font:11px/1.4 monospace;background:#000;color:#c8f0c8;border:2px solid #404858;padding:6px;';
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;';
    row.appendChild(btn(TX.retry, true, function () { location.reload(); }));
    row.appendChild(btn(TX.lite, false, lite));
    row.appendChild(btn(TX.home, false, home));
    box.appendChild(h); box.appendChild(p); box.appendChild(pre); box.appendChild(row);
    (document.body || document.documentElement).appendChild(box);
  }
  function strip(msg) {
    if (bar || !document.body) return;
    bar = document.createElement('div');
    bar.setAttribute('role', 'alert');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:100000;background:#2a0e12;color:#fff;border-top:3px solid #d03838;font:12px/1.4 monospace;padding:6px 8px;display:flex;gap:8px;align-items:center;';
    var t = document.createElement('span'); t.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; t.textContent = TX.oops + ' ' + msg.split('\n')[0];
    t.title = msg;
    var r = btn(TX.reload, true, function () { location.reload(); }); r.style.padding = '6px 8px'; r.style.fontSize = '10px';
    var c = btn(TX.close, false, function () { if (bar) bar.remove(); }); c.style.padding = '6px 8px'; c.style.fontSize = '10px';
    bar.appendChild(t); bar.appendChild(r); bar.appendChild(c);
    document.body.appendChild(bar);
  }
  function benign(msg) {
    // avvisi del browser che non fermano niente
    return /ResizeObserver loop|Script error\.?$|fullscreen|orientation|play\(\) request|NotAllowedError|AbortError/i.test(msg);
  }
  function onError(e) {
    var msg = text(e);
    if (benign(msg)) return;
    if (errors.length < 5) errors.push(msg);
    if (!ready) panel(TX.failed);
    else strip(msg);
  }
  window.addEventListener('error', function (ev) {
    // errori di caricamento di uno script o di un modulo (es. rete caduta): il gioco non può partire
    var tgt = ev.target;
    if (tgt && tgt !== window && tgt.tagName === 'SCRIPT') { onError('Script not loaded: ' + (tgt.src || '?')); return; }
    if (tgt && tgt !== window) return; // immagini, suoni: non bloccano
    onError(ev.error || ev.message);
  }, true);
  window.addEventListener('unhandledrejection', function (ev) { onError(ev.reason); });

  var timer = setTimeout(function () { panel(TX.slow); }, 25000);
  /** Chiamata dal gioco quando la prima schermata è visibile. */
  window.__tradermonBoot = {
    ready: function () {
      if (ready) return;
      ready = true;
      clearTimeout(timer);
      if (wait.parentNode) wait.parentNode.removeChild(wait);
      if (box) { box.remove(); box = null; }
    },
    /** Il gioco ha rilevato un problema serio dopo l'avvio (es. la grafica non disegna): lo mostra nella striscia. */
    report: function (e) { onError(e); },
    /** Annota un problema già gestito dal gioco (compare solo nei dettagli del pannello, se poi l'avvio fallisce). */
    note: function (e) { if (errors.length < 5) errors.push(text(e)); },
    details: report,
  };
  function mount() { if (!ready && !box) document.body.appendChild(wait); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
