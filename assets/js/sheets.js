/* ============================================================
   FOLHAS (layout das páginas)
   Desenha as páginas usando um "pintor" abstrato (unidades em milímetros).
   O MESMO código alimenta o PDF (jsPDF) e a pré-visualização (canvas),
   então a pré-visualização mostra o que será exportado.
   Interface do pintor:
     p.pageW, p.pageH
     p.width(texto, pt, negrito) → mm
     p.text(texto, x, y, {size, bold, color, align})      (y = linha de base)
     p.line(x1, y1, x2, y2, {w, color, round})
     p.rect(x, y, w, h, {fill, stroke, lw, r})
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WSSheets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PT = 0.352778;                              // milímetros por ponto
  var SITE = 'eliseuangelos.github.io/caca-palavras';
  var COLORS = {                                  // identidade da marca pessoal: azul-marinho #1D4263, verde-azulado #0B7E82 e cinzas azulados
    brand: [29, 66, 99], accent: [11, 126, 130], ink: [22, 38, 56], muted: [82, 101, 121], faint: [110, 126, 143],
    line: [213, 222, 232], white: [255, 255, 255], tint: [233, 239, 245], gridLine: [190, 203, 217],
    hiFill: [153, 213, 210], hiEdge: [70, 164, 166], dimLetter: [128, 141, 156]
  };

  /* ---------- Texto seguro para as fontes padrão do PDF (WinAnsi) ---------- */
  var WIN_EXTRA = [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x20AC, 0x2122];
  function safe(str) {
    var out = '', s = String(str == null ? '' : str), i, ch, code, base;
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i); code = s.charCodeAt(i);
      if (code === 9 || code === 10 || code === 13) out += ' ';
      else if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || WIN_EXTRA.indexOf(code) >= 0) out += ch;
      else {
        base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
        out += (base.length === 1 && base.charCodeAt(0) >= 32 && base.charCodeAt(0) < 127) ? base : '?';
      }
    }
    return out;
  }
  function pad(n, w) { var s = String(n); while (s.length < (w || 2)) s = '0' + s; return s; }

  /* ---------- Quebra de linhas ---------- */
  function wrapPara(p, str, size, bold, maxW) {
    var words = String(str).split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) {
      while (p.width(w, size, bold) > maxW && w.length > 1) {      // palavra maior que a coluna: quebra por letras
        var cut = w.length - 1;
        while (cut > 1 && p.width(w.slice(0, cut), size, bold) > maxW) cut--;
        if (cur) { lines.push(cur); cur = ''; }
        lines.push(w.slice(0, cut)); w = w.slice(cut);
      }
      var test = cur ? cur + ' ' + w : w;
      if (cur && p.width(test, size, bold) > maxW) { lines.push(cur); cur = w; } else cur = test;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function wrapParas(p, text, size, bold, maxW) {     // [[linhas do parágrafo 1], [..2], …]  (linha em branco separa parágrafos)
    var out = [];
    String(text || '').replace(/\r/g, '').split(/\n\s*\n+|\n/).forEach(function (para) {
      if (para.trim()) out.push(wrapPara(p, para.trim(), size, bold, maxW));
    });
    return out;
  }
  function fitText(p, str, size, bold, maxW) {
    str = String(str);
    if (p.width(str, size, bold) <= maxW) return str;
    while (str.length > 1 && p.width(str + '…', size, bold) > maxW) str = str.slice(0, -1);
    return str + '…';
  }

  /* ---------- Matriz ---------- */
  function drawGrid(p, puz, x, y, cell, o) {
    o = o || {};
    var n = puz.size, W = n * cell, i, r, c, ans = null;
    function cx(pt) { return x + pt.c * cell + cell / 2; }
    function cy(pt) { return y + pt.r * cell + cell / 2; }
    if (o.cellLines) {
      for (i = 1; i < n; i++) {
        p.line(x + i * cell, y, x + i * cell, y + W, { w: 0.15, color: COLORS.gridLine });
        p.line(x, y + i * cell, x + W, y + i * cell, { w: 0.15, color: COLORS.gridLine });
      }
    }
    if (o.answers) {
      ans = {};
      puz.placements.forEach(function (pl) { pl.cells.forEach(function (ce) { ans[ce.r + ',' + ce.c] = 1; }); });
      var hw = cell * 0.8, edge = Math.max(0.18, cell * 0.055);
      puz.placements.forEach(function (pl) {          // 1º as bordas, 2º o preenchimento: união limpa quando as palavras se cruzam
        p.line(cx(pl.start), cy(pl.start), cx(pl.end), cy(pl.end), { w: hw + 2 * edge, color: COLORS.hiEdge, round: true });
      });
      puz.placements.forEach(function (pl) {
        p.line(cx(pl.start), cy(pl.start), cx(pl.end), cy(pl.end), { w: hw, color: COLORS.hiFill, round: true });
      });
    }
    p.rect(x, y, W, W, { stroke: COLORS.ink, lw: o.frameW || 0.5 });
    var pt = cell * 2.05, off = 0.359 * pt * PT;      // letra maiúscula centralizada na célula
    for (r = 0; r < n; r++) {
      for (c = 0; c < n; c++) {
        var dim = ans && !ans[r + ',' + c];
        p.text(puz.grid[r].charAt(c), x + c * cell + cell / 2, y + r * cell + cell / 2 + off,
          { size: pt, bold: true, color: dim ? COLORS.dimLetter : COLORS.ink, align: 'center' });
      }
    }
  }

  /* ---------- Lista de palavras (com caixinha de marcação) ---------- */
  function listLayout(p, words, size, maxW) {
    var widest = 0;
    words.forEach(function (w) { widest = Math.max(widest, p.width(w.display, size, false)); });
    var colW = widest + 9, cols = Math.max(1, Math.min(4, Math.floor(maxW / colW)));
    if (words.length <= 3) cols = Math.min(cols, words.length);
    var rows = Math.ceil(words.length / cols), rowH = size * PT + 2.6;
    return { cols: cols, rows: rows, rowH: rowH, colW: maxW / cols, h: rows * rowH };
  }
  function drawList(p, words, x, y, size, maxW, lay) {   // y = topo da lista
    var boxS = size * PT * 0.82;
    words.forEach(function (w, i) {
      var col = i % lay.cols, row = Math.floor(i / lay.cols);
      var wx = x + col * lay.colW, wy = y + row * lay.rowH + size * PT;
      p.rect(wx, wy - boxS * 0.95, boxS, boxS, { stroke: COLORS.muted, lw: 0.2, r: 0.4 });
      p.text(fitText(p, w.display, size, false, lay.colW - boxS - 3), wx + boxS + 1.8, wy - 0.15, { size: size, color: COLORS.ink });
    });
  }

  /* ---------- Rodapé ---------- */
  function drawFooter(p, pg, M) {
    var W = p.pageW, H = p.pageH, y = H - 11.5;
    p.line(M, y - 4.5, W - M, y - 4.5, { w: 0.2, color: COLORS.line });
    if (pg.footLeft) p.text(fitText(p, pg.footLeft, 8.5, false, (W - 2 * M) * 0.7), M, y, { size: 8.5, color: COLORS.muted });
    if (pg.pageNo) {
      var tw = String(pg.totalPages || 0).length < 2 ? 2 : String(pg.totalPages).length;
      var label = 'Página ' + pad(pg.pageNo, tw) + (pg.totalPages > 1 ? ' de ' + pad(pg.totalPages, tw) : '');
      p.text(label, W - M, y, { size: 8.5, bold: true, color: COLORS.muted, align: 'right' });
    }
    p.text('Gerado em ' + (pg.date || '') + '  ·  ' + SITE, W / 2, H - 6.3, { size: 7, color: COLORS.faint, align: 'center' });
  }

  /* ---------- Página de atividade (A4 retrato) ---------- */
  function drawActivityPage(p, pg) {
    var W = p.pageW, H = p.pageH, M = 16, cw = W - 2 * M, puz = pg.puzzle, n = puz.size;
    if (pg.kicker) p.text(fitText(p, pg.kicker, 9, true, cw * 0.78), M, 12.5, { size: 9, bold: true, color: pg.answers ? COLORS.accent : COLORS.brand });
    p.line(M, 15.5, W - M, 15.5, { w: 0.35, color: COLORS.brand });

    var y = 23, x0 = M, headW = cw, badgeBottom = y;
    if (pg.badge) {
      var bs = 17, bw = Math.min(cw * 0.5, p.width(pg.badge, bs, true) + 9);
      p.rect(M, y, bw, 12.5, { fill: COLORS.brand, r: 2.5 });
      p.text(fitText(p, pg.badge, bs, true, bw - 4), M + bw / 2, y + 8.8, { size: bs, bold: true, color: COLORS.white, align: 'center' });
      x0 = M + bw + 6; headW = cw - bw - 6; badgeBottom = y + 12.5;
    }
    var hs = 22, hl = wrapPara(p, pg.heading || '', hs, true, headW).slice(0, 2), lh = hs * PT * 1.15;
    var by = y + (pg.badge ? 9.2 : 7);
    hl.forEach(function (ln, i) { p.text(ln, x0, by + i * lh, { size: hs, bold: true, color: COLORS.ink }); });
    y = Math.max(badgeBottom, by + (hl.length - 1) * lh + 2.2) + 4.5;

    if (pg.subtitle) {
      var ss = 11.5, sl = wrapPara(p, pg.subtitle, ss, false, cw).slice(0, 3);
      sl.forEach(function (ln, i) { p.text(ln, M, y + ss * PT + i * ss * PT * 1.35, { size: ss, color: COLORS.muted }); });
      y += sl.length * ss * PT * 1.35 + 2.5;
    }
    if (pg.note && !pg.answers) {
      var ns = 10, nl = wrapPara(p, pg.note, ns, false, cw - 9).slice(0, 4), nh = nl.length * ns * PT * 1.35 + 5;
      p.rect(M, y, cw, nh, { fill: COLORS.tint, r: 2 });
      nl.forEach(function (ln, i) { p.text(ln, M + 4.5, y + 2.5 + ns * PT + i * ns * PT * 1.35, { size: ns, color: COLORS.ink }); });
      y += nh + 2.5;
    }

    // Lista + matriz distribuídas no espaço restante
    var showList = pg.showList !== false && puz.placements.length > 0 && !pg.answers;
    var listSize = 11, lay = showList ? listLayout(p, puz.placements, listSize, cw) : null;
    var listH = showList ? 11 + lay.h : 0, gap = showList ? 8 : 0;
    var bottom = H - 21, availH = bottom - y - listH - gap;
    var cell = Math.min(Math.min(cw, 170) / n, availH / n, 13.5);
    var gridH = cell * n, total = gridH + gap + listH, offset = Math.max(0, (bottom - y - total) * 0.3);
    var gx = (W - gridH) / 2, gy = y + offset;
    drawGrid(p, puz, gx, gy, cell, { cellLines: true, answers: !!pg.answers });
    if (showList) {
      var ly = gy + gridH + gap;
      p.text('PALAVRAS PARA ENCONTRAR', M, ly + 3, { size: 10, bold: true, color: COLORS.brand });
      p.line(M, ly + 5, W - M, ly + 5, { w: 0.5, color: COLORS.accent });
      drawList(p, puz.placements, M, ly + 8, listSize, cw, lay);
    }
    drawFooter(p, pg, M);
  }

  /* ---------- Gabaritos compactos: 4 por página A4 ---------- */
  function drawAnswerCards(p, pg) {
    var W = p.pageW, H = p.pageH, M = 12;
    p.text('GABARITO', M, 17, { size: 20, bold: true, color: COLORS.brand });
    if (pg.kicker) p.text(fitText(p, pg.kicker, 9.5, false, (W - 2 * M) * 0.6), W - M, 17, { size: 9.5, color: COLORS.muted, align: 'right' });
    p.line(M, 21, W - M, 21, { w: 0.35, color: COLORS.brand });
    var gap = 6, top = 27, bottom = H - 17, cw = (W - 2 * M - gap) / 2, ch = (bottom - top - gap) / 2;
    pg.cards.forEach(function (card, i) {
      var x = M + (i % 2) * (cw + gap), y = top + Math.floor(i / 2) * (ch + gap), n = card.puzzle.size;
      p.rect(x, y, cw, ch, { stroke: COLORS.line, lw: 0.3, r: 2 });
      p.text(fitText(p, 'Gabarito ' + card.id, 12, true, cw * 0.56), x + 4, y + 8, { size: 12, bold: true, color: COLORS.brand });
      p.text('Atividade na página ' + pad(card.activityPage, pg.pageDigits || 2), x + cw - 4, y + 8, { size: 8.5, color: COLORS.muted, align: 'right' });
      p.line(x + 4, y + 11, x + cw - 4, y + 11, { w: 0.2, color: COLORS.line });
      var cell = Math.min((cw - 8) / n, (ch - 19) / n), gridBottom = y + 15 + cell * n;
      drawGrid(p, card.puzzle, x + (cw - cell * n) / 2, y + 15, cell, { answers: true, frameW: 0.3 });
      drawCardWords(p, card.puzzle.placements, x + 4, gridBottom + 3.2, cw - 8, y + ch - 2.5);
    });
    drawFooter(p, pg, M);
  }
  /* Palavras do jogo em letra pequena, abaixo da matriz do gabarito (só se couberem no espaço que sobra). */
  function drawCardWords(p, words, x, top, w, bottom) {
    var size = 7, rowH = size * PT + 1.15, cols, rows;
    for (cols = 3; cols <= 5; cols++) {
      rows = Math.ceil(words.length / cols);
      if (top + rows * rowH <= bottom) break;
      if (cols === 5) return;                              // não cabe: omite (a matriz continua legível)
    }
    var colW = w / cols;
    words.forEach(function (wd, i) {
      p.text(fitText(p, wd.display, size, false, colW - 1.5), x + (i % cols) * colW, top + Math.floor(i / cols) * rowH + size * PT,
        { size: size, color: COLORS.muted });
    });
  }

  /* ---------- Página personalizada (A4 paisagem, duas colunas) ---------- */
  function measureLeft(p, pg, colW, s) {
    var blocks = [], answers = !!pg.answers, gap = 4.2 * s;
    var tS = 26 * s, tl = wrapPara(p, pg.title || '', tS, true, colW);
    if (answers) blocks.push({ h: 5, draw: function (x, y) { p.text('GABARITO', x, y + 3.2, { size: 10 * s, bold: true, color: COLORS.accent }); } });
    if (tl.length) blocks.push({ h: tl.length * tS * PT * 1.15, draw: function (x, y) {
      tl.forEach(function (ln, i) { p.text(ln, x, y + tS * PT * 0.95 + i * tS * PT * 1.15, { size: tS, bold: true, color: COLORS.brand }); });
    } });
    var sS = 13 * s, sl = pg.subtitle ? wrapPara(p, pg.subtitle, sS, false, colW) : [];
    if (sl.length) blocks.push({ h: sl.length * sS * PT * 1.3, draw: function (x, y) {
      sl.forEach(function (ln, i) { p.text(ln, x, y + sS * PT + i * sS * PT * 1.3, { size: sS, color: COLORS.muted }); });
    } });
    blocks.push({ h: 1.4, draw: function (x, y) { p.rect(x, y, 16, 1.2, { fill: COLORS.accent }); } });
    if (!answers && pg.text) {
      var xS = 11 * s, paras = wrapParas(p, pg.text, xS, false, colW), xl = xS * PT * 1.38, parGap = 2.6 * s, hh = 0;
      paras.forEach(function (pl, i) { hh += pl.length * xl + (i < paras.length - 1 ? parGap : 0); });
      if (paras.length) blocks.push({ h: hh, draw: function (x, y) {
        var yy = y;
        paras.forEach(function (pl) {
          pl.forEach(function (ln, i) { p.text(ln, x, yy + xS * PT + i * xl, { size: xS, color: COLORS.ink }); });
          yy += pl.length * xl + parGap;
        });
      } });
    }
    if (!answers && pg.note) {
      var iS = 10.5 * s, pd = 3.6 * s, il = wrapParas(p, pg.note, iS, false, colW - 2 * pd), ilh = iS * PT * 1.36, lab = 9 * s;
      var lines = []; il.forEach(function (pl, i) { pl.forEach(function (ln) { lines.push(ln); }); if (i < il.length - 1) lines.push(''); });
      var bh = pd * 2 + lab * PT * 1.5 + lines.length * ilh;
      blocks.push({ h: bh, draw: function (x, y) {
        p.rect(x, y, colW, bh, { fill: COLORS.tint, r: 2.2 });
        p.text('INSTRUÇÕES', x + pd, y + pd + lab * PT * 0.95, { size: lab, bold: true, color: COLORS.brand });
        lines.forEach(function (ln, i) { p.text(ln, x + pd, y + pd + lab * PT * 1.5 + iS * PT + i * ilh, { size: iS, color: COLORS.ink }); });
      } });
    }
    var words = pg.puzzle.placements;
    if (pg.showList !== false && words.length) {
      var wS = 10.5 * s, lay = listLayout(p, words, wS, colW);
      blocks.push({ h: 9 + lay.h, draw: function (x, y) {
        p.text(answers ? 'PALAVRAS DA ATIVIDADE' : 'PALAVRAS PARA ENCONTRAR', x, y + 3, { size: 9.5 * s, bold: true, color: COLORS.brand });
        p.line(x, y + 5, x + colW, y + 5, { w: 0.45, color: COLORS.accent });
        drawList(p, words, x, y + 8, wS, colW, lay);
      } });
    }
    var h = 0; blocks.forEach(function (b, i) { h += b.h + (i < blocks.length - 1 ? gap : 0); });
    return { h: h, gap: gap, blocks: blocks };
  }
  function customGeometry(p, pg) {
    var W = p.pageW, H = p.pageH, M = 12, top = 12, bottom = H - 17, n = pg.puzzle.size;
    var badgeH = pg.id ? 11.5 : 0, gapB = pg.id ? 4.5 : 0, availH = bottom - top - badgeH - gapB;
    var cell = Math.min(13, Math.floor(Math.min(150, availH) / n * 10) / 10), gridW = cell * n;
    var gx = W - M - gridW, gy = top + badgeH + gapB, leftW = gx - M - 13;
    return { W: W, H: H, M: M, top: top, bottom: bottom, cell: cell, gridW: gridW, gx: gx, gy: gy, badgeH: badgeH, leftW: leftW };
  }
  /* Reduz a fonte (até 60%) até caber; nunca corta o texto. A escala vem sempre da página de ATIVIDADE,
     para que a página de respostas use exatamente o mesmo tamanho de letra. */
  function fitLeft(p, pg, g) {
    var availH = g.bottom - g.top, act = Object.assign({}, pg, { answers: false });
    for (var s = 1; s >= 0.595; s -= 0.05) {
      if (measureLeft(p, act, g.leftW, s).h <= availH) return { ok: true, scale: s, layout: measureLeft(p, pg, g.leftW, s) };
    }
    return { ok: false, scale: 0.6, layout: null };
  }
  function checkCustomFit(p, pg) { var f = fitLeft(p, pg, customGeometry(p, pg)); return { ok: f.ok, scale: f.scale }; }

  function drawCustomPage(p, pg) {
    var g = customGeometry(p, pg), f = fitLeft(p, pg, g);
    if (g.badgeH) {
      var bs = 14, bw = Math.min(g.gridW, p.width(pg.id, bs, true) + 9);
      p.rect(g.gx, g.top, bw, g.badgeH, { fill: COLORS.brand, r: 2.2 });
      p.text(fitText(p, pg.id, bs, true, bw - 4), g.gx + bw / 2, g.top + 7.9, { size: bs, bold: true, color: COLORS.white, align: 'center' });
    }
    drawGrid(p, pg.puzzle, g.gx, g.gy, g.cell, { cellLines: true, answers: !!pg.answers });
    p.line(g.gx - 6.5, g.top, g.gx - 6.5, g.bottom, { w: 0.25, color: COLORS.line });
    if (f.ok) {
      var y = g.top;
      f.layout.blocks.forEach(function (b) { b.draw(g.M, y); y += b.h + f.layout.gap; });
    } else {                                           // aviso visível (a interface bloqueia a exportação antes disso)
      p.text('O conteúdo é longo demais para a coluna.', g.M, g.top + 8, { size: 11, bold: true, color: [185, 28, 28] });
    }
    var y2 = g.H - 11;
    p.line(g.M, y2 - 4.5, g.W - g.M, y2 - 4.5, { w: 0.2, color: COLORS.line });
    p.text('Gerado em ' + (pg.date || '') + '  ·  ' + SITE, g.M, y2, { size: 7.5, color: COLORS.faint });
    p.text(pg.answers ? 'Gabarito' : 'Atividade', g.W - g.M, y2, { size: 8.5, bold: true, color: COLORS.muted, align: 'right' });
  }

  /* ---------- Revista: plano de páginas (atividades + gabaritos no final) ---------- */
  function planMagazine(puzzles, cfg) {
    var pages = [], perPage = 4, i, kicker = cfg.title || '', date = cfg.date || '';
    var answerPages = Math.ceil(puzzles.length / perPage), answerStart = puzzles.length + 1;
    var total = puzzles.length + answerPages, digits = Math.max(2, String(total).length);
    puzzles.forEach(function (pz, k) {
      pages.push({ kind: 'activity', puzzle: pz, kicker: kicker, heading: 'Caça-Palavras', subtitle: cfg.subtitle, note: cfg.note, badge: pz.id,
        showList: cfg.showList !== false, date: date, pageNo: k + 1, totalPages: total,
        footLeft: 'Atividade ' + pz.id + '  ·  Gabarito na página ' + pad(answerStart + Math.floor(k / perPage), digits) });
    });
    for (i = 0; i < puzzles.length; i += perPage) {
      pages.push({ kind: 'answers', kicker: kicker, date: date, pageNo: answerStart + i / perPage, totalPages: total, pageDigits: digits,
        footLeft: 'Gabaritos ' + puzzles[i].id + ' a ' + puzzles[Math.min(i + perPage, puzzles.length) - 1].id,
        cards: puzzles.slice(i, i + perPage).map(function (pz, k) { return { id: pz.id, puzzle: pz, activityPage: i + k + 1 }; }) });
    }
    return pages;
  }

  /* ---------- Jogo individual: atividade + gabarito (A4 retrato) ---------- */
  function planSingle(puz, cfg, only) {
    var base = { kind: 'activity', puzzle: puz, heading: cfg.title || 'Meu Caça-Palavras', subtitle: cfg.subtitle, note: cfg.note, badge: cfg.id || '',
      showList: cfg.showList !== false, date: cfg.date, footLeft: cfg.id ? 'Atividade ' + cfg.id : '' };
    var act = Object.assign({}, base, { kicker: '' });
    var ans = Object.assign({}, base, { kicker: 'GABARITO', answers: true });
    var pages = only === 'answers' ? [ans] : [act, ans];
    pages.forEach(function (pg, i) { pg.pageNo = i + 1; pg.totalPages = pages.length; });
    return pages;
  }
  function planCustom(puz, cfg) {
    var base = { kind: 'custom', puzzle: puz, title: cfg.title, subtitle: cfg.subtitle, text: cfg.text, note: cfg.note, id: cfg.id || '',
      showList: cfg.showList !== false, date: cfg.date };
    return [Object.assign({}, base, { answers: false }), Object.assign({}, base, { answers: true })];
  }

  function pageSize(pg) { return pg.kind === 'custom' ? { w: 297, h: 210 } : { w: 210, h: 297 }; }
  function drawPage(p, pg) {
    if (pg.kind === 'answers') drawAnswerCards(p, pg);
    else if (pg.kind === 'custom') drawCustomPage(p, pg);
    else drawActivityPage(p, pg);
  }

  /* ---------- Pintor para canvas (pré-visualização) ---------- */
  function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function makeCanvasPainter(canvas, pageW, pageH, measure) {
    var ctx = canvas.getContext('2d'), k = canvas.width / pageW;
    ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    function rr(x, y, w, h, r) {
      ctx.beginPath(); r = Math.min(r, w / 2, h / 2);
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    return {
      pageW: pageW, pageH: pageH,
      width: function (s, size, bold) { return measure(safe(s), size, bold); },
      text: function (s, x, y, o) {
        ctx.font = (o.bold ? 'bold ' : '') + (o.size * PT * k) + 'px Helvetica, Arial, "Liberation Sans", sans-serif';
        ctx.fillStyle = rgb(o.color || COLORS.ink); ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(safe(s), x * k, y * k);
      },
      line: function (x1, y1, x2, y2, o) {
        ctx.beginPath(); ctx.moveTo(x1 * k, y1 * k); ctx.lineTo(x2 * k, y2 * k);
        ctx.strokeStyle = rgb(o.color); ctx.lineWidth = o.w * k; ctx.lineCap = o.round ? 'round' : 'butt'; ctx.stroke();
      },
      rect: function (x, y, w, h, o) {
        if (o.r) rr(x * k, y * k, w * k, h * k, o.r * k); else { ctx.beginPath(); ctx.rect(x * k, y * k, w * k, h * k); }
        if (o.fill) { ctx.fillStyle = rgb(o.fill); ctx.fill(); }
        if (o.stroke) { ctx.strokeStyle = rgb(o.stroke); ctx.lineWidth = (o.lw || 0.3) * k; ctx.stroke(); }
      }
    };
  }

  return {
    COLORS: COLORS, SITE: SITE, PT: PT, safe: safe, pad: pad, planMagazine: planMagazine, planSingle: planSingle,
    planCustom: planCustom, pageSize: pageSize, drawPage: drawPage, checkCustomFit: checkCustomFit,
    makeCanvasPainter: makeCanvasPainter, drawGrid: drawGrid
  };
});
