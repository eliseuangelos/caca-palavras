/* ============================================================
   EXPORTAÇÃO EM PDF
   - "pintor" jsPDF: desenha as páginas de sheets.js em vetores (texto, linhas e retângulos),
     sem transformar a matriz em imagem;
   - nome do arquivo: AAAAMMDDHHMMSS (horário do clique) + descrição, com sufixo sequencial
     quando houver mais de uma exportação no mesmo segundo;
   - carrega o jsPDF só quando o PDF é pedido (a página abre mais rápido no celular);
   - monta as páginas em etapas, para a tela mostrar o progresso e permitir cancelar.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sheets.js'), require('./metrics.js'));
  else root.WSPdf = factory(root.WSSheets, root.WSMetrics);
})(typeof self !== 'undefined' ? self : this, function (Sheets, Metrics) {
  'use strict';

  var root = typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : {});
  var LOCAL_JSPDF = 'assets/vendor/jspdf.umd.min.js';
  var CDN_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';   // plano B, caso a pasta vendor não tenha sido enviada
  var jsPdfPromise = null;

  /* ---------- Nome do arquivo ---------- */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(d) {                              // AAAAMMDDHHMMSS no horário local do aparelho
    d = d || new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
  }
  var lastStamp = '', sameSecond = 0;
  /* Chame no instante do clique. Devolve o identificador temporal (com sufixo "-2", "-3"… se repetir no mesmo segundo). */
  function nextStamp(d) {
    var s = stamp(d);
    if (s === lastStamp) sameSecond++; else { lastStamp = s; sameSecond = 1; }
    return sameSecond > 1 ? s + '-' + sameSecond : s;
  }
  function fileName(stampId, label, ext) { return stampId + '-' + label + '.' + (ext || 'pdf'); }

  /* ---------- Carregamento sob demanda do jsPDF ---------- */
  function addScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { s.remove(); reject(new Error('Falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadJsPdf() {
    if (root.jspdf && root.jspdf.jsPDF) return Promise.resolve(root.jspdf.jsPDF);
    if (!jsPdfPromise) {
      jsPdfPromise = addScript(LOCAL_JSPDF).catch(function () { return addScript(CDN_JSPDF); }).then(function () {
        if (!(root.jspdf && root.jspdf.jsPDF)) throw new Error('A biblioteca de PDF não foi inicializada.');
        return root.jspdf.jsPDF;
      }).catch(function (err) {
        jsPdfPromise = null;                       // permite tentar de novo
        throw new Error('Não foi possível carregar a biblioteca de PDF. Verifique a conexão e tente novamente. (' + err.message + ')');
      });
    }
    return jsPdfPromise;
  }

  /* ---------- Pintor jsPDF ---------- */
  function makePainter(doc, W, H) {
    var C = Sheets.COLORS;
    function setFont(size, bold) { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); }
    return {
      pageW: W, pageH: H,
      width: function (s, size, bold) { return Metrics.width(Sheets.safe(s), size, bold); },
      text: function (s, x, y, o) {
        var t = Sheets.safe(s); if (!t) return;
        var c = o.color || C.ink;
        setFont(o.size, o.bold); doc.setTextColor(c[0], c[1], c[2]);
        doc.text(t, x, y, { align: o.align || 'left' });
      },
      line: function (x1, y1, x2, y2, o) {
        doc.setDrawColor(o.color[0], o.color[1], o.color[2]); doc.setLineWidth(o.w);
        doc.setLineCap(o.round ? 'round' : 'butt');
        doc.line(x1, y1, x2, y2);
      },
      rect: function (x, y, w, h, o) {
        var style = (o.fill && o.stroke) ? 'FD' : (o.fill ? 'F' : 'S');
        if (o.fill) doc.setFillColor(o.fill[0], o.fill[1], o.fill[2]);
        if (o.stroke) { doc.setDrawColor(o.stroke[0], o.stroke[1], o.stroke[2]); doc.setLineWidth(o.lw || 0.3); }
        doc.setLineCap('butt'); doc.setLineJoin('miter');
        if (o.r) doc.roundedRect(x, y, w, h, o.r, o.r, style); else doc.rect(x, y, w, h, style);
      }
    };
  }

  function nextTick() { return new Promise(function (r) { setTimeout(r, 0); }); }

  /* Monta o documento (uma página por item de `pages`). Devolve o objeto jsPDF. */
  async function buildDoc(JsPDF, pages, opts) {
    opts = opts || {};
    var doc = null, i, size, p, orient;
    for (i = 0; i < pages.length; i++) {
      if (opts.isCancelled && opts.isCancelled()) throw new Error('CANCELADO');
      size = Sheets.pageSize(pages[i]);
      orient = size.w > size.h ? 'landscape' : 'portrait';
      if (!doc) doc = new JsPDF({ orientation: orient, unit: 'mm', format: 'a4', compress: true });
      else doc.addPage('a4', orient);
      p = makePainter(doc, size.w, size.h);
      Sheets.drawPage(p, pages[i]);
      if (opts.onProgress) opts.onProgress(i + 1, pages.length);
      if ((i & 1) === 1 || pages.length < 8) await nextTick();       // deixa a tela respirar
    }
    doc.setProperties({
      title: Sheets.safe(opts.title || 'Caça-Palavras'), subject: 'Caça-palavras para imprimir',
      creator: 'Gerador de Caça-Palavras - ' + Sheets.SITE, keywords: 'caça-palavras, atividade, passatempo'
    });
    return doc;
  }

  /* Gera e baixa o PDF. opts: { label, stampId, title, onProgress, isCancelled } */
  async function exportPages(pages, opts) {
    var JsPDF = await loadJsPdf();
    var doc = await buildDoc(JsPDF, pages, opts);
    var name = fileName(opts.stampId, opts.label);
    doc.save(name);
    return { name: name, pages: pages.length };
  }

  return {
    stamp: stamp, nextStamp: nextStamp, fileName: fileName, loadJsPdf: loadJsPdf,
    makePainter: makePainter, buildDoc: buildDoc, exportPages: exportPages
  };
});
