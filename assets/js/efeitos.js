/* ============================================================
   EFEITOS DE VITÓRIA
   - efeito visual em CSS: confete, anel e brilho sobre a matriz e destaque da lista de palavras
     (as animações ficam em style.css; aqui só se ligam as classes e se criam as peças do confete);
   - toque sonoro de vitória sintetizado pela Web Audio API: nenhum arquivo de áudio, funciona offline;
   - botão de som (liga/desliga) com a escolha salva no navegador (chave "cpg:som").
   Regras: o som só toca depois de uma ação da pessoa (exigência dos navegadores); quem pede "reduzir movimento"
   no sistema não vê confete nem movimento; uma falha de áudio nunca interrompe o jogo.
   ============================================================ */
(function (root) {
  'use strict';

  var KEY = 'cpg:som';
  var AC = root.AudioContext || root.webkitAudioContext;
  var ctx = null;
  var enabled = readEnabled();
  var COLORS = ['var(--color-accent)', 'var(--color-accent-secondary)', 'var(--color-primary)'];   // cores da marca, nos dois temas
  var confettiTimer = null;

  function noop() { /* ignora */ }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function reducedMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function readEnabled() { try { return root.localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } }
  function saveEnabled(on) { try { root.localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* sem armazenamento */ } }

  /* ---------- Som ---------- */
  function activated() {                           // o navegador só libera o áudio logo depois de um toque, clique ou tecla
    var ua = root.navigator && root.navigator.userActivation;
    return !ua || ua.isActive;
  }
  /* Cria/retoma o contexto de áudio. É chamado nos primeiros toques da pessoa para que, na hora da vitória,
     o som já esteja liberado (no iPhone e no Safari isso é obrigatório). */
  function unlock() {
    if (!enabled || !AC) return;
    if (!ctx) {
      if (!activated()) return;
      try { ctx = new AC(); } catch (e) { ctx = null; return; }
    }
    if (ctx.state === 'suspended' && activated()) {
      try { var p = ctx.resume(); if (p && p.catch) p.catch(noop); } catch (e) { /* ignora */ }
    }
  }
  /* Uma nota: ataque rápido e queda suave, para soar como sino e nunca como "bipe". */
  function tone(out, freq, t0, dur, type, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function bus(level) {                            // saída com volume moderado e filtro que tira o agudo áspero
    var master = ctx.createGain(), lp = ctx.createBiquadFilter();
    master.gain.value = level; lp.type = 'lowpass'; lp.frequency.value = 5200;
    master.connect(lp); lp.connect(ctx.destination);
    return master;
  }
  /* Toque de vitória (≈ 1,7 s): arpejo ascendente em Dó maior e acorde final com brilho. */
  function playWin() {
    if (!enabled) return false;
    unlock();
    if (!ctx) return false;
    try {
      var t = ctx.currentTime + 0.03, out = bus(0.16), notes = [523.25, 659.25, 783.99, 1046.5], chord = [523.25, 659.25, 783.99, 1046.5, 1318.5], i;
      for (i = 0; i < notes.length; i++) {
        tone(out, notes[i], t + i * 0.11, 0.42, 'triangle', 0.5);
        tone(out, notes[i] * 2, t + i * 0.11, 0.24, 'sine', 0.12);
      }
      var tc = t + 0.56;
      for (i = 0; i < chord.length; i++) tone(out, chord[i], tc, 1.1, i < 3 ? 'triangle' : 'sine', i < 3 ? 0.34 : 0.16);
      tone(out, 2093, tc + 0.14, 0.5, 'sine', 0.07);
      return true;
    } catch (e) { return false; }
  }
  /* Confirmação curta ao ligar o som (duas notas). */
  function playBlip() {
    if (!enabled) return false;
    unlock();
    if (!ctx) return false;
    try {
      var t = ctx.currentTime + 0.02, out = bus(0.12);
      tone(out, 659.25, t, 0.16, 'triangle', 0.5);
      tone(out, 880, t + 0.09, 0.22, 'triangle', 0.5);
      return true;
    } catch (e) { return false; }
  }

  /* ---------- Confete ---------- */
  function clearConfetti() {
    clearTimeout(confettiTimer);
    var host = document.getElementById('confete');
    if (host) host.textContent = '';
  }
  /* Rajada saindo do centro da matriz: cada peça recebe suas medidas por variáveis CSS e a animação é toda do CSS. */
  function confetti(anchor) {
    var host = document.getElementById('confete');
    if (!host) return 0;
    clearConfetti();
    var vw = root.innerWidth || 800, vh = root.innerHeight || 600, n = vw < 600 ? 28 : 46;
    var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    var ox = r ? r.left + r.width / 2 : vw / 2, oy = r ? r.top + r.height / 2 : vh / 2;
    ox = Math.max(vw * 0.15, Math.min(vw * 0.85, ox)); oy = Math.max(vh * 0.3, Math.min(vh * 0.7, oy));
    host.style.setProperty('--ox', Math.round(ox) + 'px'); host.style.setProperty('--oy', Math.round(oy) + 'px');
    var spread = Math.min(vw * 0.46, 440), frag = document.createDocumentFragment(), i, p, round, size;
    for (i = 0; i < n; i++) {
      p = document.createElement('i'); round = Math.random() < 0.3; size = rnd(6, 10);
      p.style.setProperty('--w', (round ? size : rnd(5, 8)).toFixed(1) + 'px');
      p.style.setProperty('--h', (round ? size : rnd(9, 15)).toFixed(1) + 'px');
      p.style.setProperty('--r', round ? '50%' : '2px');
      p.style.setProperty('--cor', COLORS[i % COLORS.length]);
      p.style.setProperty('--dx', Math.round(rnd(-spread, spread)) + 'px');
      p.style.setProperty('--up', '-' + Math.round(rnd(110, 330)) + 'px');
      p.style.setProperty('--down', Math.round(rnd(60, 380)) + 'px');
      p.style.setProperty('--rot', Math.round(rnd(-600, 600)) + 'deg');
      p.style.setProperty('--t', Math.round(rnd(1500, 2400)) + 'ms');
      p.style.setProperty('--d', Math.round(rnd(0, 180)) + 'ms');
      frag.appendChild(p);
    }
    host.appendChild(frag);
    confettiTimer = setTimeout(clearConfetti, 3200);
    return n;
  }

  /* ---------- Comemoração ---------- */
  function restart(el, cls) {                      // reinicia a animação mesmo que a classe já estivesse lá
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }
  /* o = { board: elemento da matriz, list: lista de palavras }. Devolve true se o toque sonoro foi iniciado. */
  function celebrate(o) {
    o = o || {};
    clear();
    var words = o.list ? [].slice.call(o.list.querySelectorAll('.palavra')) : [];
    words.forEach(function (w, i) { w.style.setProperty('--i', String(Math.min(i, 14))); });   // as palavras "pulam" em sequência
    restart(o.board, 'venceu'); restart(o.list, 'venceu');
    if (!reducedMotion()) confetti(o.board);
    return playWin();
  }
  function clear() {
    [].slice.call(document.querySelectorAll('.venceu')).forEach(function (el) { el.classList.remove('venceu'); });
    clearConfetti();
  }

  /* ---------- Botão de som e desbloqueio do áudio ---------- */
  /* o = { button, onToggle(ligado) } */
  function init(o) {
    o = o || {};
    var btn = o.button;
    function paint() {
      if (!btn) return;
      btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      btn.title = 'Som de vitória: ' + (enabled ? 'ligado' : 'desligado');
    }
    paint();
    ['pointerdown', 'pointerup', 'touchend', 'keydown'].forEach(function (ev) { document.addEventListener(ev, unlock, { capture: true, passive: true }); });
    if (btn) btn.addEventListener('click', function () {
      enabled = !enabled; saveEnabled(enabled); paint();
      if (enabled) playBlip();
      if (o.onToggle) o.onToggle(enabled);
    });
  }

  root.WSFx = {
    init: init, celebrate: celebrate, clear: clear, reducedMotion: reducedMotion,
    sound: {
      playWin: playWin, playBlip: playBlip, unlock: unlock,
      get enabled() { return enabled; },
      set: function (on) { enabled = !!on; saveEnabled(enabled); }
    }
  };
})(typeof self !== 'undefined' ? self : this);
