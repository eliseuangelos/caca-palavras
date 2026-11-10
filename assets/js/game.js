/* ============================================================
   JOGO INTERATIVO (tabuleiro em canvas)
   - três camadas: letras, marcações das palavras achadas e seleção em andamento;
   - seleção por mouse, toque ou caneta (arrastar) e também pelo teclado;
   - as 8 direções são "imantadas": o arrasto sempre forma uma linha reta válida;
   - dicas, gabarito, cronômetro e impressão em alta resolução.
   ============================================================ */
(function (root, factory) {
  root.WSGame = factory(root.WSCore);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  var FONT = '"Inter", "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';
  var PRINT_PX = 1800;                              // lado do canvas na impressão (≈300 dpi em 150 mm)

  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ---------- Cronômetro ---------- */
  function Timer(onTick) {
    this.onTick = onTick; this.t0 = 0; this.base = 0; this.id = null;
  }
  Timer.prototype.seconds = function () {
    return this.base + (this.id ? Math.floor((Date.now() - this.t0) / 1000) : 0);
  };
  Timer.prototype.start = function () {
    var self = this;
    this.stop(); this.base = 0; this.t0 = Date.now(); this.onTick(fmtTime(0));
    this.id = setInterval(function () { self.onTick(fmtTime(self.seconds())); }, 500);
  };
  Timer.prototype.stop = function () {
    if (this.id) { this.base = this.seconds(); clearInterval(this.id); this.id = null; }
  };
  Timer.prototype.reset = function () { this.stop(); this.base = 0; this.onTick(fmtTime(0)); };

  /* ---------- Jogo ---------- */
  class Game {
    /* els: { board, grid, lines, drag }   handlers: { onFound(pl, found, total), onWin(), onAnnounce(msg) } */
    constructor(els, handlers) {
      this.board = els.board; this.cvGrid = els.grid; this.cvLines = els.lines; this.cvDrag = els.drag;
      this.h = handlers || {};
      this.puzzle = null; this.found = new Set(); this.showAnswers = false;
      this.cell = 0; this.css = 0; this.k = 1;
      this.sel = null; this.dragging = false;
      this.cursor = { r: 0, c: 0 }; this.kStart = null;
      this.printing = false; this.printAnswers = false;
      this.bind();
    }

    load(puzzle) {
      this.puzzle = puzzle; this.found.clear(); this.showAnswers = false;
      this.sel = null; this.dragging = false; this.kStart = null; this.cursor = { r: 0, c: 0 };
      this.layout();
    }
    get total() { return this.puzzle ? this.puzzle.placements.length : 0; }
    get remaining() { return this.puzzle.placements.filter(function (p) { return !this.found.has(p.id); }, this); }
    get complete() { return !!this.puzzle && this.found.size === this.total; }

    /* ----- desenho ----- */
    colors() {
      var cs = getComputedStyle(document.documentElement);
      var v = function (n, d) { return (cs.getPropertyValue(n) || '').trim() || d; };
      if (this.printing) return { ink: '#000', found: 'rgba(11,126,130,.38)', drag: 'rgba(29,66,99,.3)', cursor: '#1D4263' };   // impressão: sempre texto preto sobre papel branco
      return { ink: v('--cv-ink', '#162638'), found: v('--cv-found', 'rgba(11,126,130,.30)'), drag: v('--cv-drag', 'rgba(37,99,235,.28)'), cursor: v('--cv-cursor', '#2563EB') };
    }
    layout() {
      if (!this.puzzle) return;
      var css = Math.floor(this.board.clientWidth);        // área interna (sem a borda); os canvases ocupam 100% dela
      if (css < 20) return;                                // tela oculta: redesenha quando aparecer
      var dpr = this.printing ? PRINT_PX / css : Math.min(window.devicePixelRatio || 1, 3);
      var px = Math.round(css * dpr);
      var self = this;
      [this.cvGrid, this.cvLines, this.cvDrag].forEach(function (cv) { cv.width = px; cv.height = px; });
      this.css = css; this.k = px / css; this.cell = css / this.puzzle.size;
      self.redraw();
    }
    redraw() {
      if (!this.puzzle || !this.cell) return;
      this.drawGrid(); this.drawLines(); this.drawDrag();
    }
    ctx(cv) { var c = cv.getContext('2d'); c.setTransform(this.k, 0, 0, this.k, 0, 0); c.clearRect(0, 0, this.css, this.css); return c; }
    center(pt) { return { x: pt.c * this.cell + this.cell / 2, y: pt.r * this.cell + this.cell / 2 }; }
    stroke(ctx, a, b, color) {
      var p = this.center(a), q = this.center(b);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
      ctx.strokeStyle = color; ctx.lineWidth = this.cell * 0.76; ctx.lineCap = 'round'; ctx.stroke();
    }
    drawGrid() {
      var ctx = this.ctx(this.cvGrid), n = this.puzzle.size, col = this.colors(), cell = this.cell, r, c;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = '700 ' + (cell * 0.56) + 'px ' + FONT; ctx.fillStyle = col.ink;
      var off = cell * 0.56 * 0.36;                        // centraliza a maiúscula na linha de base
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) ctx.fillText(this.puzzle.grid[r].charAt(c), c * cell + cell / 2, r * cell + cell / 2 + off);
    }
    drawLines() {
      var ctx = this.ctx(this.cvLines), col = this.colors(), self = this;
      this.puzzle.placements.forEach(function (pl) {
        var show = self.printing ? self.printAnswers : (self.showAnswers || self.found.has(pl.id));
        if (show) self.stroke(ctx, pl.start, pl.end, col.found);
      });
    }
    drawDrag() {
      var ctx = this.ctx(this.cvDrag), col = this.colors(), cell = this.cell;
      if (this.printing) return;
      if (this.sel) this.stroke(ctx, this.sel.a, this.sel.b, col.drag);
      var show = document.activeElement === this.board;   // o cursor do teclado só aparece com o foco no tabuleiro
      if (show && this.kStart) {
        this.stroke(ctx, this.kStart, this.alignedEnd(this.kStart, this.cursor) || this.kStart, col.drag);
      }
      if (show) {
        ctx.strokeStyle = col.cursor; ctx.lineWidth = Math.max(2, cell * 0.08);
        ctx.strokeRect(this.cursor.c * cell + 2, this.cursor.r * cell + 2, cell - 4, cell - 4);
      }
    }

    /* ----- geometria da seleção ----- */
    cellAt(e) {
      var rect = this.cvGrid.getBoundingClientRect(), n = this.puzzle.size;
      var fx = (e.clientX - rect.left) / (rect.width / n), fy = (e.clientY - rect.top) / (rect.height / n);
      var c = Math.max(0, Math.min(n - 1, Math.floor(fx))), r = Math.max(0, Math.min(n - 1, Math.floor(fy)));
      return { r: r, c: c, fx: fx, fy: fy };
    }
    /* Imanta o ponto atual a uma das 8 direções a partir da célula inicial (sem nunca sair da matriz). */
    snap(a, p) {
      var dx = p.fx - (a.c + 0.5), dy = p.fy - (a.r + 0.5);
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return { r: a.r, c: a.c };
      var ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      var sr = Math.round(Math.sin(ang)), sc = Math.round(Math.cos(ang)), n = this.puzzle.size;
      var dist = Math.round(sr !== 0 && sc !== 0 ? Math.min(Math.abs(dx), Math.abs(dy)) * 0.5 + Math.max(Math.abs(dx), Math.abs(dy)) * 0.5 : Math.max(Math.abs(dx), Math.abs(dy)));
      var maxR = sr > 0 ? n - 1 - a.r : (sr < 0 ? a.r : Infinity), maxC = sc > 0 ? n - 1 - a.c : (sc < 0 ? a.c : Infinity);
      dist = Math.max(0, Math.min(dist, maxR, maxC));
      return { r: a.r + sr * dist, c: a.c + sc * dist };
    }
    alignedEnd(a, b) {                                 // extremidade válida (linha reta nas 8 direções) ou null
      var dr = b.r - a.r, dc = b.c - a.c;
      return (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) ? b : null;
    }

    /* ----- entrada: ponteiro (mouse, toque, caneta) ----- */
    bind() {
      var self = this, b = this.board;
      b.addEventListener('pointerdown', function (e) {
        if (!self.puzzle || (e.pointerType === 'mouse' && e.button !== 0)) return;
        var c = self.cellAt(e);
        self.sel = { a: { r: c.r, c: c.c }, b: { r: c.r, c: c.c } }; self.dragging = true; self.kStart = null;
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* navegadores antigos */ }
        self.drawDrag(); e.preventDefault();
      });
      b.addEventListener('pointermove', function (e) {
        if (!self.dragging) return;
        var end = self.snap(self.sel.a, self.cellAt(e));
        if (end.r !== self.sel.b.r || end.c !== self.sel.b.c) { self.sel.b = end; self.drawDrag(); }
      });
      function finish(cancel) {
        if (!self.dragging) return;
        var s = self.sel; self.dragging = false; self.sel = null; self.drawDrag();
        if (!cancel && s) self.check(s.a, s.b, true);
      }
      b.addEventListener('pointerup', function () { finish(false); });
      b.addEventListener('pointercancel', function () { finish(true); });
      b.addEventListener('keydown', function (e) { self.onKey(e); });
      b.addEventListener('focus', function () { self.drawDrag(); });
      b.addEventListener('blur', function () { self.kStart = null; self.drawDrag(); });
      if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', function () { self.redraw(); });   // fonte da marca carregada: redesenha as letras
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(function () { self.layout(); }).observe(b);
      else window.addEventListener('resize', function () { self.layout(); });
    }

    /* ----- entrada: teclado ----- */
    announce(msg) { if (this.h.onAnnounce) this.h.onAnnounce(msg); }
    onKey(e) {
      if (!this.puzzle) return;
      var n = this.puzzle.size, cur = this.cursor, moved = true;
      switch (e.key) {
        case 'ArrowUp': cur.r = Math.max(0, cur.r - 1); break;
        case 'ArrowDown': cur.r = Math.min(n - 1, cur.r + 1); break;
        case 'ArrowLeft': cur.c = Math.max(0, cur.c - 1); break;
        case 'ArrowRight': cur.c = Math.min(n - 1, cur.c + 1); break;
        case 'Home': cur.c = 0; break;
        case 'End': cur.c = n - 1; break;
        case ' ': case 'Enter':
          e.preventDefault();
          if (!this.kStart) {
            this.kStart = { r: cur.r, c: cur.c };
            this.announce('Início marcado na linha ' + (cur.r + 1) + ', coluna ' + (cur.c + 1) + ', letra ' + this.puzzle.grid[cur.r].charAt(cur.c) + '. Mova até a última letra e pressione Espaço.');
          } else {
            var s = this.kStart; this.kStart = null;
            if (!this.alignedEnd(s, cur)) this.announce('Seleção inválida: use uma linha reta na horizontal, vertical ou diagonal.');
            else this.check(s, { r: cur.r, c: cur.c }, true);
          }
          this.drawDrag(); return;
        case 'Escape':
          if (this.kStart) { this.kStart = null; this.announce('Seleção cancelada.'); this.drawDrag(); e.preventDefault(); }
          return;
        default: moved = false;
      }
      if (moved) {
        e.preventDefault(); this.drawDrag();
        this.announce('Linha ' + (cur.r + 1) + ', coluna ' + (cur.c + 1) + ': ' + this.puzzle.grid[cur.r].charAt(cur.c));
      }
    }

    /* ----- regras ----- */
    check(a, b, speak) {
      if (a.r === b.r && a.c === b.c) return null;
      var hit = Core.matchSelection(this.puzzle.grid, a, b, this.remaining);
      if (hit) this.markFound(hit);
      else if (speak) this.announce('Essas letras não formam uma palavra da lista.');
      return hit;
    }
    markFound(pl) {
      this.found.add(pl.id); this.drawLines();
      this.announce('Palavra encontrada: ' + pl.display + '. ' + this.found.size + ' de ' + this.total + '.');
      if (this.h.onFound) this.h.onFound(pl, this.found.size, this.total);
      if (this.complete && this.h.onWin) this.h.onWin();
    }
    reveal() {                                         // dica: revela uma palavra ainda não encontrada
      var rest = this.remaining;
      if (!rest.length) return null;
      var pl = rest[Math.floor(Math.random() * rest.length)];
      this.markFound(pl); return pl;
    }
    setAnswers(on) { this.showAnswers = !!on; this.drawLines(); }

    /* ----- impressão: redesenha em alta resolução (e volta ao normal depois) ----- */
    beginPrint(answers) { this.printing = true; this.printAnswers = !!answers; this.layout(); }
    endPrint() { this.printing = false; this.layout(); }
  }

  return { Game: Game, Timer: Timer, fmtTime: fmtTime };
});
