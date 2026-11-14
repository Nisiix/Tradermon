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

  // Schermata di caricamento a tema, dal primo istante: il grafico a candele cresce con l'avanzamento (una candela per
  // tratto di strada), la candela in formazione pulsa e la barra dorata avanza da sola verso il prossimo traguardo.
  // Le animazioni usano solo transform e opacity: le muove il compositore del browser anche mentre il gioco è
  // impegnato a preparare la grafica (sul telefono il codice blocca la pagina per qualche secondo alla volta).
  var CANDLES = [[3, 5, 2, 6], [5, 4, 3, 6], [4, 7, 4, 8], [7, 6, 5, 8], [6, 9, 5, 10], [9, 8, 7, 10], [8, 11, 8, 12], [11, 12, 10, 12]];
  var css = '@font-face{font-family:"Press Start 2P";src:url(../fonts/press-start-2p.woff2) format("woff2");font-display:swap;unicode-range:U+0000-00FF}' +
    '#boot-wait{position:fixed;inset:0;z-index:96;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(8px,3vh,18px);' +
    'padding:16px;background:#101018;color:#c8d0e0;cursor:progress;transition:opacity .22s ease-out}' +
    '#boot-wait.out{opacity:0;pointer-events:none}' +
    '#boot-wait .bw-mark{margin:0;font:clamp(15px,3.6vmin,26px)/1 "Press Start 2P",monospace;letter-spacing:.08em;color:#f8d860;text-shadow:3px 3px 0 #6a4a08}' +
    '#boot-wait .bw-chart{position:relative;width:min(340px,72vw);height:min(150px,30vh);border:3px solid #404858;border-radius:4px;overflow:hidden;' +
    'background:#182438;box-shadow:inset 0 0 0 2px #2c3c58,inset 0 6px 0 rgba(0,0,0,.25)}' +
    '#boot-wait .bw-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(120,144,192,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(120,144,192,.12) 1px,transparent 1px);background-size:100% 25%,12.5% 100%}' +
    '#boot-wait .bw-c{position:absolute;top:8%;bottom:8%;width:7%;opacity:0;transform:translateY(6px);transition:opacity .18s steps(2),transform .18s steps(2)}' +
    '#boot-wait .bw-c.on{opacity:1;transform:none}' +
    '#boot-wait .bw-c.now{opacity:1;transform:none}' +
    '#boot-wait .bw-c i,#boot-wait .bw-c b{position:absolute;display:block}' +
    '#boot-wait .bw-c i{left:calc(50% - 1px);width:2px;background:var(--cd)}' +
    '#boot-wait .bw-c b{left:0;right:0;background:var(--c);box-shadow:inset -2px -2px 0 var(--cd),inset 2px 2px 0 rgba(255,255,255,.35);transform-origin:50% 100%}' +
    '#boot-wait .bw-c.now b{animation:bw-form 1.1s steps(4) infinite alternate}' +
    '#boot-wait .bw-c.now i{opacity:.5}' +
    '@keyframes bw-form{from{transform:scaleY(.25)}to{transform:scaleY(1)}}' +
    '#boot-wait .bw-track{width:min(340px,72vw);height:6px;background:#242c40;border-radius:3px;overflow:hidden}' +
    '#boot-wait .bw-fill{height:100%;background:#f8d860;transform-origin:0 50%;transform:scaleX(0);transition:transform .3s ease-out}' +
    '#boot-wait .bw-label{margin:0;min-height:1.5em;font:14px/1.5 system-ui,sans-serif;text-align:center;max-width:30em}' +
    '@media (max-height:360px){#boot-wait .bw-chart{height:26vh}#boot-wait .bw-label{font-size:13px}}' +
    '@media (prefers-reduced-motion:reduce){#boot-wait .bw-c.now b{animation:none}#boot-wait .bw-fill{transition:none}}';
  var wait = document.createElement('div');
  wait.id = 'boot-wait';
  wait.setAttribute('role', 'status');
  wait.setAttribute('aria-live', 'polite');
  var mark = document.createElement('p'); mark.className = 'bw-mark'; mark.textContent = 'TRADERMON'; mark.setAttribute('aria-hidden', 'true');
  var chartEl = document.createElement('div'); chartEl.className = 'bw-chart'; chartEl.setAttribute('aria-hidden', 'true');
  chartEl.innerHTML = '<div class="bw-grid"></div>';
  var candles = [];
  CANDLES.forEach(function (k, i) {
    var o = k[0], c = k[1], lo = k[2], hi = k[3], up = c >= o, b0 = Math.min(o, c), b1 = Math.max(o, c);
    var pc = function (n) { return (n / 12 * 100) + '%'; };
    var el = document.createElement('div');
    el.className = 'bw-c';
    el.style.left = (5 + i * 11.6) + '%';
    el.style.setProperty('--c', up ? '#48e070' : '#f05858');
    el.style.setProperty('--cd', up ? '#208840' : '#a02828');
    el.innerHTML = '<i style="bottom:' + pc(lo) + ';top:calc(100% - ' + pc(hi) + ')"></i><b style="bottom:' + pc(b0) + ';top:calc(100% - ' + pc(b1) + ')"></b>';
    chartEl.appendChild(el);
    candles.push(el);
  });
  var track = document.createElement('div'); track.className = 'bw-track'; track.setAttribute('aria-hidden', 'true');
  var fill = document.createElement('div'); fill.className = 'bw-fill'; track.appendChild(fill);
  var label = document.createElement('p'); label.className = 'bw-label'; label.textContent = TX.loading;
  wait.appendChild(mark); wait.appendChild(chartEl); wait.appendChild(track); wait.appendChild(label);
  // nessun tocco deve arrivare al gioco sotto mentre si carica
  ['click', 'pointerdown', 'touchstart'].forEach(function (ev) { wait.addEventListener(ev, function (e) { e.stopPropagation(); e.preventDefault(); }, { passive: false }); });
  var shown = false, progress = 0, creepTimer = 0, hideTimer = 0;

  /** Porta l'avanzamento a `p` (0..1), poi lo fa scivolare da solo verso `to` in `ms` (attesa lunga senza notizie). */
  function setProgress(p, to, ms) {
    progress = Math.max(0, Math.min(1, p));
    clearTimeout(creepTimer);
    fill.style.transition = 'transform .3s ease-out';
    fill.style.transform = 'scaleX(' + progress + ')';
    var n = Math.min(CANDLES.length, Math.floor(progress * CANDLES.length + 0.0001));
    candles.forEach(function (c, i) { c.className = 'bw-c' + (i < n ? ' on' : i === n ? ' now' : ''); });
    if (to && to > progress && ms) {
      // la transizione lunga gira sul compositore: la barra avanza anche se la pagina è bloccata dal lavoro del gioco
      creepTimer = setTimeout(function () {
        fill.style.transition = 'transform ' + (ms / 1000) + 's cubic-bezier(.2,.6,.35,1)';
        fill.style.transform = 'scaleX(' + to + ')';
      }, 320);
    }
  }
  function showWait(text) {
    clearTimeout(hideTimer);
    if (text) label.textContent = text;
    wait.classList.remove('out');
    if (!wait.parentNode && document.body) document.body.appendChild(wait);
    shown = true;
  }
  function hideWait() {
    if (!shown) return;
    shown = false;
    clearTimeout(creepTimer);
    wait.classList.add('out');
    hideTimer = setTimeout(function () { if (!shown && wait.parentNode) wait.parentNode.removeChild(wait); }, 260);
  }
  setProgress(0.04, 0.4, 6000);

  function panel(title) {
    if (ready || box) return;
    if (wait.parentNode) wait.parentNode.removeChild(wait);
    shown = false;
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
  /** Ponte con il gioco (src/systems/bootGuard.ts). */
  window.__tradermonBoot = {
    /** Il codice del gioco è arrivato e gira: il guardiano non aspetta più (la schermata di caricamento resta). */
    alive: function () { clearTimeout(timer); timer = 0; },
    /** La prima schermata del gioco è visibile: via la schermata di caricamento. */
    ready: function () {
      clearTimeout(timer); timer = 0;
      if (!ready) { ready = true; if (box) { box.remove(); box = null; } }
      hideWait();
    },
    /** Avanzamento (0..1) con il testo del passo in corso; `to`/`ms`: dove arriva da sola la barra se il passo dura. */
    step: function (p, text, to, ms) { if (text) label.textContent = text; if (typeof p === 'number') setProgress(p, to, ms); },
    /**
     * Rimette la schermata di caricamento (per esempio mentre si prepara il mondo dopo il titolo). Se non torna
     * via entro `limitMs`, compare il pannello con il motivo e le uscite, come all'avvio.
     */
    show: function (text, limitMs) {
      if (box) return;
      setProgress(0, 0, 0);
      showWait(text);
      clearTimeout(timer);
      timer = setTimeout(function () { ready = false; panel(TX.slow); }, limitMs || 90000);
    },
    /** La schermata di caricamento è visibile? */
    visible: function () { return shown; },
    /** Il gioco ha rilevato un problema serio dopo l'avvio (es. la grafica non disegna): lo mostra nella striscia. */
    report: function (e) { onError(e); },
    /** Annota un problema già gestito dal gioco (compare solo nei dettagli del pannello, se poi l'avvio fallisce). */
    note: function (e) { if (errors.length < 5) errors.push(text(e)); },
    details: report,
  };
  function mount() {
    if (ready || box) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    showWait();
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
