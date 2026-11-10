/* ============================================================
   INTERFACE — TELAS
   Liga cada formulário ao núcleo de geração (core.js), às páginas do PDF (sheets.js, pdf.js)
   e ao jogo interativo (game.js):
     • Jogo individual → valida, gera, joga, imprime e exporta em PDF;
     • Revista         → gera até 50 jogos em lote (com progresso e cancelamento), pré-visualiza e exporta;
     • Página          → gera a folha A4 horizontal (texto + matriz), confere o encaixe, pré-visualiza e exporta.
   Os jogos mostrados na pré-visualização são exatamente os que vão para o PDF: nada é regenerado na exportação.
   Segurança: textos digitados entram no DOM somente por textContent (ver h() em app-core.js).
   ============================================================ */
(function (root) {
  'use strict';

  var Core = root.WSCore, Sheets = root.WSSheets, Metrics = root.WSMetrics, Pdf = root.WSPdf;
  var WSGame = root.WSGame, UI = root.WSUI, Fx = root.WSFx, THEMES = root.WS_THEMES;
  var $ = UI.$, h = UI.h, q = UI.q, plural = UI.plural;

  var EXAMPLE = 'AMOR, ESPERANÇA, FÉ, SABEDORIA, BONDADE, PACIÊNCIA, JUSTIÇA, PERDÃO, RESPEITO, GRATIDÃO';
  var MIN_WORDS = 3, MAX_WORDS = Core.MAX_WORDS_PER_PUZZLE, ALL_DIRS = Core.DIR_PRESETS.all;
  var DEFAULTS = {
    individual: { modo: 'manual', tamanho: 15, dir: ALL_DIRS, lista: true },
    revista: { tamanho: 15, dir: ALL_DIRS, lista: true, reuso: false },
    pagina: { tamanho: 15, dir: ALL_DIRS, lista: true }
  };
  // "Pintor" só de medição: permite conferir o encaixe do texto da página sem desenhar nada.
  var MEASURER = { pageW: 297, pageH: 210, width: function (s, size, bold) { return Metrics.width(Sheets.safe(s), size, bold); } };

  /* ---------- Apoio ---------- */
  function sample(arr, n) { return Core.shuffle(arr, Math.random).slice(0, n); }
  function field(v, key, max) { return Core.cleanDisplay(v[key] || '').slice(0, max); }
  function multiline(s, max) {                       // preserva as quebras de linha dos parágrafos
    return String(s || '').replace(/\r/g, '').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').slice(0, max);
  }
  function listOf(arr, fmt) { return arr.slice(0, 4).map(fmt).join(', ') + (arr.length > 4 ? ' e mais ' + (arr.length - 4) : ''); }
  function setHidden(el, hide) { if (el) el.hidden = !!hide; }

  /* Mensagens de validação do campo de palavras (jogo e página). */
  function wordErrors(res, size, min, max) {
    var out = [], cells = size * size, letters, shorts;
    if (!res.total) return ['Digite as palavras para encontrar, separadas por vírgulas.'];
    if (res.duplicates.length) {
      out.push('Palavras repetidas (a acentuação é ignorada): ' + listOf(res.duplicates, function (d) { return q(d.display) + ' = ' + q(d.of); }) + '. Remova as repetidas.');
    }
    if (res.tooLong.length) {
      out.push('Palavras maiores que a matriz ' + size + ' × ' + size + ': ' + listOf(res.tooLong, function (w) { return q(w.display) + ' (' + w.length + ' letras)'; }) +
        '. Escolha uma matriz maior ou remova a palavra.');
    }
    shorts = res.tooShort.concat(res.noLetters);
    if (shorts.length) out.push('Palavras curtas demais ou sem letras (mínimo de 2 letras): ' + listOf(shorts, function (w) { return q(w.display); }) + '.');
    if (res.entries.length < min) out.push('Informe pelo menos ' + min + ' palavras válidas (há ' + res.entries.length + ').');
    if (res.entries.length > max) out.push('O limite é de ' + max + ' palavras por caça-palavras (há ' + res.entries.length + ').');
    letters = res.entries.reduce(function (s, e) { return s + e.clean.length; }, 0);
    if (letters > cells) out.push('As palavras somam ' + letters + ' letras, mais do que as ' + cells + ' células da matriz ' + size + ' × ' + size + '.');
    return out;
  }

  function failMessage(err) {
    return (err && err.code) ? err.message : 'Ocorreu um erro inesperado ao gerar o caça-palavras. Tente novamente.';
  }

  /* Volta o formulário ao estado inicial (valores originais + padrões dos componentes). */
  function clearForm(form, defaults, extra) {
    form.reset();
    UI.applyValues(form, defaults);
    if (extra) extra();
  }

  /* Adiciona ao campo as palavras de um tema que ainda não estão lá. `limit` (opcional) sorteia só algumas. */
  function addThemeWords(area, key, size, limit) {
    var t = THEMES[key];
    if (!t) { UI.toast('Escolha um tema primeiro.', 'erro'); return; }
    var cur = Core.parseWords(area.value), have = Object.create(null);
    cur.entries.concat(cur.tooLong, cur.tooShort).forEach(function (e) { have[e.clean] = true; });
    var seen = Object.create(null), fresh = [];
    t.words.forEach(function (w) {
      var c = Core.normalizeWord(w);
      if (c.length < Core.MIN_WORD_LEN || c.length > size || have[c] || seen[c]) return;
      seen[c] = true; fresh.push(w);
    });
    if (!fresh.length) { UI.toast('Todas as palavras deste tema que cabem na matriz já estão na lista.', 'erro'); return; }
    var add = limit ? sample(fresh, limit) : fresh, base = area.value.trim().replace(/[,;\s]+$/, '');
    area.value = (base ? base + ', ' : '') + add.join(', ');
    area.dispatchEvent(new Event('input', { bubbles: true }));
    UI.toast(plural(add.length, 'palavra', 'palavras') + ' do tema ' + q(t.name) + (limit ? ' sorteadas e adicionadas.' : ' adicionadas.'));
  }

  /* ============================================================
     1) JOGO INDIVIDUAL
     ============================================================ */
  var QTD_RANGE = { 10: [3, 7], 15: [7, 15], 20: [10, 20] };
  var WIN_DELAY = 1500;                                  // tempo da comemoração antes de abrir o diálogo de vitória (ms)

  function setupIndividual() {
    var form = $('#ind-form'), box = $('#ind-erros'), setup = $('#ind-setup'), play = $('#ind-jogo');
    var area = $('#ind-palavras'), selTema = $('#ind-tema'), selQtd = $('#ind-qtd'), live = $('#jg-live');
    var st = { entries: [], opts: null, cfg: null, puzzle: null }, winTimer = null;
    var timer = new WSGame.Timer(function (t) { $('#jg-tempo').textContent = t; });
    var game = new WSGame.Game(
      { board: $('#tabuleiro'), grid: $('#cv-grade'), lines: $('#cv-linhas'), drag: $('#cv-arrasto') },
      {
        onFound: onFound, onWin: onWin,
        onAnnounce: function (m) { live.textContent = ''; root.requestAnimationFrame(function () { live.textContent = m; }); }
      });

    UI.fillThemes(selTema, true);
    document.addEventListener('cpg:tema', function () { game.redraw(); });     // trocou o tema: o canvas usa as cores novas

    /* --- opções que dependem do modo e do tamanho --- */
    function syncMode() {
      var tema = UI.collect(form).modo === 'tema';
      setHidden($('#ind-manual'), tema); setHidden($('#ind-auto'), !tema);
    }
    function updateQtd(force) {
      var size = UI.getSize(form), r = QTD_RANGE[size] || QTD_RANGE[15], keep = Number(selQtd.value) || 0, i;
      if (!force && selQtd.getAttribute('data-size') === String(size) && selQtd.options.length) return;
      selQtd.textContent = '';
      for (i = r[0]; i <= r[1]; i++) selQtd.appendChild(h('option', { value: i, text: i }));
      selQtd.value = String((keep >= r[0] && keep <= r[1] && !force) ? keep : Math.floor((r[0] + r[1]) / 2));
      selQtd.setAttribute('data-size', String(size));
    }
    form.addEventListener('change', function () { syncMode(); updateQtd(false); });
    syncMode(); updateQtd(true);

    var words = UI.bindWordsState({
      form: form, area: area, out: $('#ind-palavras-estado'), min: MIN_WORDS, max: MAX_WORDS, strict: true,
      setSize: function (n) { UI.setSize(form, n); }
    });
    $('#ind-exemplo').addEventListener('click', function () {
      area.value = EXAMPLE; area.dispatchEvent(new Event('input', { bubbles: true })); area.focus();
    });

    var menu = UI.configMenu($('.menu-cfg-host[data-cfg="individual"]'), {
      view: 'individual', form: form,
      label: function (v) {
        var n = v.modo === 'tema' ? 'tema ' + (THEMES[v.tema] ? THEMES[v.tema].name : '—') : plural(Core.parseWords(v.palavras).entries.length, 'palavra', 'palavras');
        return (v.titulo || 'Sem título') + ' · ' + n + ' · ' + v.tamanho + '×' + v.tamanho;
      },
      afterApply: function () { syncMode(); updateQtd(false); words.refresh(); }
    });

    /* --- leitura e validação do formulário --- */
    function readForm() {
      var v = UI.collect(form), size = UI.getSize(form), dirs = UI.getDirs(form), errors = [], entries = [], themeName = '', order = 'input', pool = null, qty = 0;
      if (!dirs.length) errors.push('Selecione ao menos uma direção para as palavras.');
      if (v.modo === 'tema') {
        order = 'alpha';
        if (!v.tema || !THEMES[v.tema]) errors.push('Selecione um tema para sortear as palavras.');
        else {
          themeName = THEMES[v.tema].name; qty = parseInt(v.qtd, 10) || 0;
          pool = Core.buildPool({ themes: [v.tema] }, size, THEMES).pool;
          if (qty < 1) errors.push('Escolha a quantidade de palavras.');
          else if (pool.length < qty) {
            errors.push('O tema ' + q(themeName) + ' tem apenas ' + pool.length + ' palavras que cabem em uma matriz ' + size + ' × ' + size + '. Reduza a quantidade ou escolha uma matriz maior.');
          }
        }
      } else {
        var res = Core.parseWords(v.palavras, { size: size });
        errors = errors.concat(wordErrors(res, size, MIN_WORDS, MAX_WORDS));
        entries = res.entries;
      }
      return {
        v: v, size: size, dirs: dirs, errors: errors, entries: entries, pool: pool, qty: qty, order: order,
        cfg: {
          title: field(v, 'titulo', 60) || (themeName ? 'Caça-Palavras — ' + themeName : 'Meu Caça-Palavras'),
          subtitle: field(v, 'subtitulo', 100) || (themeName ? 'Encontre as palavras relacionadas ao tema ' + themeName + '.' : 'Encontre as palavras escondidas!'),
          note: field(v, 'instrucoes', 300), id: field(v, 'id', 24), showList: v.lista !== false, date: UI.todayBR()
        }
      };
    }

    function generate() {
      UI.clearErrors(box);
      var inp = readForm(), puzzle = null, lastErr = null, tries, entries = inp.entries;
      if (inp.errors.length) { UI.showErrors(box, inp.errors); return; }
      var opts = { size: inp.size, dirs: inp.dirs, listOrder: inp.order };
      for (tries = 0; tries < (inp.pool ? 8 : 1) && !puzzle; tries++) {         // no sorteio por tema, tenta outras palavras
        if (inp.pool) entries = sample(inp.pool, inp.qty);
        try { puzzle = Core.generatePuzzle(entries, opts); } catch (err) { lastErr = err; }
      }
      if (!puzzle) { UI.showErrors(box, failMessage(lastErr), 'Não foi possível gerar o caça-palavras'); return; }
      st.entries = entries; st.opts = opts; st.cfg = inp.cfg; st.puzzle = puzzle;
      menu.remember();
      showGame(true);
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); generate(); });
    $('#ind-limpar').addEventListener('click', function () {
      clearForm(form, DEFAULTS.individual, function () { updateQtd(true); words.refresh(); });
      UI.clearErrors(box); area.focus();
    });

    /* --- tela do jogo --- */
    function renderList() {
      var ul = $('#jg-lista'), total = st.puzzle.placements.length;
      ul.textContent = '';
      st.puzzle.placements.forEach(function (pl) { ul.appendChild(h('li', { class: 'palavra', 'data-id': pl.id, text: pl.display })); });
      $('#jg-total').textContent = total; $('#jg-cont').textContent = 0; $('#jg-achadas').textContent = '0/' + total;
      $('#jg-lista-card').classList.toggle('lista-oculta', !st.cfg.showList);
    }
    function showGame(fresh) {
      var c = st.cfg;
      setHidden(setup, true); setHidden(play, false);
      $('#jg-titulo').textContent = c.title;
      $('#jg-id').textContent = c.id; setHidden($('#jg-id'), !c.id);
      $('#jg-sub').textContent = c.subtitle; setHidden($('#jg-sub'), !c.subtitle);
      $('#jg-instr').textContent = c.note; setHidden($('#jg-instr'), !c.note);
      $('#jg-marca').textContent = 'Gerado em ' + c.date + ' · ' + Sheets.SITE;
      var gab = $('#jg-gabarito'); gab.setAttribute('aria-pressed', 'false'); gab.textContent = 'Mostrar gabarito';
      renderList();
      clearTimeout(winTimer); Fx.clear();                      // novo jogo: encerra qualquer comemoração em andamento
      game.load(st.puzzle); timer.start();
      if (fresh) { root.scrollTo({ top: 0, left: 0, behavior: 'instant' }); $('#jg-titulo').focus({ preventScroll: true }); }
    }
    function onFound(pl, found, total) {
      var li = $('#jg-lista [data-id="' + pl.id + '"]');
      if (li) li.classList.add('achada');
      $('#jg-cont').textContent = found; $('#jg-achadas').textContent = found + '/' + total;
    }
    /* Vitória: o tempo para na hora; a matriz comemora (animação em CSS, confete e toque sonoro) e só então abre o diálogo.
       Se a pessoa já tiver embaralhado ou voltado ao formulário nesse meio-tempo, o diálogo não abre. */
    function onWin() {
      timer.stop();
      $('#vit-tempo').textContent = ' em ' + $('#jg-tempo').textContent;
      var puzzle = st.puzzle;
      Fx.celebrate({ board: $('#tabuleiro'), list: $('#jg-lista') });
      clearTimeout(winTimer);
      winTimer = setTimeout(function () {
        if (st.puzzle === puzzle && !play.hidden) UI.openDlg($('#dlg-vitoria'));
      }, UI.reducedMotion() ? 0 : WIN_DELAY);
    }
    function backToSetup() {
      clearTimeout(winTimer); Fx.clear();
      timer.stop(); UI.closeDlg($('#dlg-vitoria'));
      setHidden(play, true); setHidden(setup, false);
      var cab = $('.view-cab', setup); if (cab) cab.focus({ preventScroll: true });
      root.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    function reshuffle() {                                      // nova matriz com as mesmas palavras
      try { st.puzzle = Core.generatePuzzle(st.entries, st.opts); } catch (err) { UI.toast(failMessage(err), 'erro'); return; }
      UI.closeDlg($('#dlg-vitoria')); showGame(false); UI.toast('Nova matriz gerada com as mesmas palavras.');
    }

    $('#jg-dica').addEventListener('click', function () { game.reveal(); });
    $('#jg-embaralhar').addEventListener('click', reshuffle);
    $('#jg-editar').addEventListener('click', backToSetup);
    $('#jg-gabarito').addEventListener('click', function () {
      var on = this.getAttribute('aria-pressed') !== 'true';
      game.setAnswers(on); this.setAttribute('aria-pressed', on ? 'true' : 'false'); this.textContent = on ? 'Ocultar gabarito' : 'Mostrar gabarito';
    });

    /* --- impressão: o tabuleiro é redesenhado em alta resolução e volta ao normal depois --- */
    function printGame(answers) {
      if (!st.puzzle) return;
      var done = false, fallback;
      function after() {
        if (done) return; done = true; clearTimeout(fallback);
        root.removeEventListener('afterprint', after); game.endPrint();
      }
      root.addEventListener('afterprint', after);
      fallback = setTimeout(after, 60000);
      game.beginPrint(answers);
      setTimeout(function () { root.print(); }, 120);
    }
    $('#jg-imprimir').addEventListener('click', function () { printGame(false); });
    $('#jg-imprimir-gab').addEventListener('click', function () { printGame(true); });

    /* --- PDF (o horário do nome do arquivo é o do clique) --- */
    function exportPdf(answersOnly) {
      if (!st.puzzle) return;
      var stampId = Pdf.nextStamp();
      var pages = Sheets.planSingle(st.puzzle, st.cfg, answersOnly ? 'answers' : undefined);
      UI.toast('Gerando o PDF…');
      Pdf.exportPages(pages, { label: answersOnly ? 'gabarito-caca-palavras' : 'caca-palavras', stampId: stampId, title: st.cfg.title })
        .then(function (r) { UI.toast('PDF criado: ' + r.name); })
        .catch(function (err) { UI.toast(err.message || 'Não foi possível criar o PDF.', 'erro'); });
    }
    $('#jg-pdf').addEventListener('click', function () { exportPdf(false); });
    $('#jg-pdf-gab').addEventListener('click', function () { exportPdf(true); });

    /* --- diálogo de vitória --- */
    $('#vit-gab').addEventListener('click', function () { UI.closeDlg($('#dlg-vitoria')); printGame(true); });
    $('#vit-pdf').addEventListener('click', function () { exportPdf(true); });
    $('#vit-embaralhar').addEventListener('click', reshuffle);
    $('#vit-novo').addEventListener('click', backToSetup);
    $('#vit-fechar').addEventListener('click', function () { UI.closeDlg($('#dlg-vitoria')); });
  }

  /* ============================================================
     2) REVISTA
     ============================================================ */
  function setupRevista() {
    var form = $('#rev-form'), box = $('#rev-erros'), area = $('#rev-banco'), live = $('#rev-live'), result = $('#rev-resultado');
    var preview = UI.createPreview($('#rev-previa'));
    var st = { pages: null, cfg: null };

    UI.fillThemes($('#rev-tema'), true);
    UI.bindWordsState({
      form: form, area: area, out: $('#rev-banco-estado'), strict: false, setSize: function (n) { UI.setSize(form, n); }
    });
    var menu = UI.configMenu($('.menu-cfg-host[data-cfg="revista"]'), {
      view: 'revista', form: form,
      label: function (v) { return (v.titulo || 'Revista') + ' · ' + v.quantidade + ' jogos · ' + v.tamanho + '×' + v.tamanho; },
      afterApply: updateLive
    });

    $('#rev-add-tema').addEventListener('click', function () {
      var key = $('#rev-tema').value;
      if (!key) { UI.toast('Escolha um tema para adicionar ao banco.', 'erro'); return; }
      addThemeWords(area, key, UI.getSize(form), 0);
    });

    /* Resumo ao vivo: o banco comporta a quantidade pedida? */
    function updateLive() {
      var v = UI.collect(form), size = UI.getSize(form), games = Number(v.quantidade), per = Number(v.porjogo);
      var pool = Core.buildPool({ text: v.banco }, size, THEMES).pool.length, msg = '', cls = 'aviso-ok';
      live.textContent = '';
      if (!pool) { msg = 'O banco está vazio. Digite palavras separadas por vírgulas ou carregue um tema.'; cls = 'aviso-aviso'; }
      else if (Number.isInteger(games) && games >= 1 && games <= Core.MAX_GAMES && Number.isInteger(per) && per >= MIN_WORDS && per <= MAX_WORDS) {
        var chk = Core.checkDistribution(pool, games, per, !!v.reuso);
        if (!chk.ok) { msg = chk.message; cls = 'aviso-erro'; }
        else if (v.reuso) {
          msg = plural(games, 'jogo', 'jogos') + ' × ' + per + ' palavras = ' + chk.need + ' sorteios para ' + pool + ' palavras no banco' +
            (chk.need > pool ? ': algumas palavras aparecerão em mais de um jogo.' : '.');
        } else msg = plural(games, 'jogo', 'jogos') + ' × ' + per + ' palavras usam ' + chk.need + ' das ' + pool + ' palavras do banco, sem repetição.';
      }
      if (msg) live.appendChild(h('div', { class: 'aviso-linha ' + cls, text: msg }));
    }
    var liveSoon = UI.debounce(updateLive, 200);
    form.addEventListener('input', liveSoon);
    form.addEventListener('change', updateLive);
    form.addEventListener('reset', function () { setTimeout(updateLive, 0); });
    updateLive();

    function readForm() {
      var v = UI.collect(form), size = UI.getSize(form), dirs = UI.getDirs(form), errors = [];
      var games = Number(v.quantidade), per = Number(v.porjogo), pool = Core.buildPool({ text: v.banco }, size, THEMES).pool;
      if (!Number.isInteger(games) || games < 1 || games > Core.MAX_GAMES) errors.push('A quantidade de caça-palavras deve ser um número inteiro de 1 a ' + Core.MAX_GAMES + '.');
      if (!Number.isInteger(per) || per < MIN_WORDS || per > MAX_WORDS) errors.push('As palavras por caça-palavras devem ser um número inteiro de ' + MIN_WORDS + ' a ' + MAX_WORDS + '.');
      if (!dirs.length) errors.push('Selecione ao menos uma direção para as palavras.');
      if (!pool.length) errors.push('O banco de palavras está vazio. Digite palavras separadas por vírgulas ou carregue um tema.');
      else if (!errors.length) {
        var chk = Core.checkDistribution(pool.length, games, per, !!v.reuso);   // validação antecipada, antes de gerar
        if (!chk.ok) errors.push(chk.message);
      }
      return {
        v: v, size: size, dirs: dirs, errors: errors, pool: pool, games: games, per: per,
        cfg: {
          title: field(v, 'titulo', 60) || 'Revista de Passatempo',
          subtitle: field(v, 'subtitulo', 100) || 'Encontre todas as palavras e divirta-se!',
          note: field(v, 'instrucoes', 300), showList: v.lista !== false, date: UI.todayBR()
        }
      };
    }

    async function generate() {
      UI.clearErrors(box);
      var inp = readForm();
      if (inp.errors.length) { UI.showErrors(box, inp.errors); return; }
      UI.Progress.open('Gerando a revista', 'Preparando…');
      try {
        var puzzles = await Core.buildBatch({
          pool: inp.pool, games: inp.games, perGame: inp.per, size: inp.size, dirs: inp.dirs, reuse: !!inp.v.reuso, startId: inp.v.id,
          onProgress: function (d, t) { UI.Progress.set(d, t, 'Gerando o jogo ' + d + ' de ' + t + '…'); },
          isCancelled: function () { return UI.Progress.cancelled; }
        });
        st.cfg = inp.cfg; st.pages = Sheets.planMagazine(puzzles, inp.cfg);
        showResult(puzzles, inp);
        menu.remember();
      } catch (err) {
        if (err && err.code === 'CANCELLED') UI.toast('Geração cancelada.');
        else UI.showErrors(box, failMessage(err), 'Não foi possível gerar a revista');
      } finally { UI.Progress.close(); }
    }

    function showResult(puzzles, inp) {
      var total = st.pages.length, answerPages = Math.ceil(puzzles.length / 4), ul = $('#rev-resumo');
      var chips = [
        plural(puzzles.length, 'caça-palavras', 'caça-palavras'),
        'Matriz ' + inp.size + ' × ' + inp.size,
        plural(inp.per, 'palavra', 'palavras') + ' por jogo',
        'Identificações ' + puzzles[0].id + (puzzles.length > 1 ? ' a ' + puzzles[puzzles.length - 1].id : ''),
        plural(total, 'página', 'páginas') + ' A4 (' + puzzles.length + ' de atividades + ' + answerPages + ' de gabaritos)',
        'Gabaritos ' + (answerPages > 1 ? 'nas páginas ' : 'na página ') + (puzzles.length + 1) + (answerPages > 1 ? ' a ' + total : '')
      ];
      ul.textContent = '';
      chips.forEach(function (t) { ul.appendChild(h('li', { text: t })); });
      setHidden(result, false);
      preview.show(st.pages, [{ label: 'Primeira atividade', index: 0 }, { label: 'Gabaritos', index: puzzles.length }]);
      var hd = $('#rev-res-h'); hd.scrollIntoView({ block: 'start', behavior: UI.reducedMotion() ? 'auto' : 'smooth' }); hd.focus({ preventScroll: true });
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); generate(); });
    $('#rev-limpar').addEventListener('click', function () {
      clearForm(form, DEFAULTS.revista, updateLive);
      UI.clearErrors(box); setHidden(result, true); st.pages = null; $('#rev-titulo').focus();
    });

    $('#rev-baixar').addEventListener('click', async function () {
      if (!st.pages) return;
      var stampId = Pdf.nextStamp();                                // horário exato do clique
      UI.Progress.open('Criando o PDF', 'Preparando…');
      try {
        var r = await Pdf.exportPages(st.pages, {
          label: 'revista-caca-palavras', stampId: stampId, title: st.cfg.title,
          onProgress: function (d, t) { UI.Progress.set(d, t, 'Página ' + d + ' de ' + t + '…'); },
          isCancelled: function () { return UI.Progress.cancelled; }
        });
        UI.toast('PDF criado: ' + r.name);
      } catch (err) {
        if (String(err && err.message) === 'CANCELADO') UI.toast('Exportação cancelada.');
        else UI.toast((err && err.message) || 'Não foi possível criar o PDF.', 'erro');
      } finally { UI.Progress.close(); }
    });
  }

  /* ============================================================
     3) PÁGINA PERSONALIZADA
     ============================================================ */
  function setupPagina() {
    var form = $('#pag-form'), box = $('#pag-erros'), area = $('#pag-palavras'), result = $('#pag-resultado'), adj = $('#pag-ajuste');
    var preview = UI.createPreview($('#pag-previa'));
    var st = { pages: null, cfg: null };

    UI.fillThemes($('#pag-tema'), true);
    var words = UI.bindWordsState({
      form: form, area: area, out: $('#pag-palavras-estado'), min: MIN_WORDS, max: MAX_WORDS, strict: true,
      setSize: function (n) { UI.setSize(form, n); }
    });
    $('#pag-exemplo').addEventListener('click', function () {
      area.value = EXAMPLE; area.dispatchEvent(new Event('input', { bubbles: true })); area.focus();
    });
    $('#pag-add-tema').addEventListener('click', function () {
      var key = $('#pag-tema').value;
      if (!key) { UI.toast('Escolha um tema para carregar palavras.', 'erro'); return; }
      addThemeWords(area, key, UI.getSize(form), 12);               // sorteia 12 palavras por clique
    });
    var menu = UI.configMenu($('.menu-cfg-host[data-cfg="pagina"]'), {
      view: 'pagina', form: form,
      label: function (v) { return (v.titulo || 'Sem título') + ' · ' + plural(Core.parseWords(v.palavras).entries.length, 'palavra', 'palavras') + ' · ' + v.tamanho + '×' + v.tamanho; },
      afterApply: function () { words.refresh(); }
    });

    function generate() {
      UI.clearErrors(box); setHidden(adj, true);
      var v = UI.collect(form), size = UI.getSize(form), dirs = UI.getDirs(form), errors = [];
      var res = Core.parseWords(v.palavras, { size: size });
      if (!dirs.length) errors.push('Selecione ao menos uma direção para as palavras.');
      errors = errors.concat(wordErrors(res, size, MIN_WORDS, MAX_WORDS));
      if (errors.length) { UI.showErrors(box, errors); return; }
      var puzzle;
      try { puzzle = Core.generatePuzzle(res.entries, { size: size, dirs: dirs, listOrder: 'input' }); }
      catch (err) { UI.showErrors(box, failMessage(err), 'Não foi possível gerar a página'); return; }
      var cfg = {
        title: field(v, 'titulo', 80) || 'Atividade de Caça-Palavras', subtitle: field(v, 'subtitulo', 120),
        text: multiline(v.texto, 3000), note: multiline(v.instrucoes, 400), id: field(v, 'id', 24),
        showList: v.lista !== false, date: UI.todayBR()
      };
      var pages = Sheets.planCustom(puzzle, cfg), fit = Sheets.checkCustomFit(MEASURER, pages[0]);
      if (!fit.ok) {
        UI.showErrors(box, 'O conteúdo da coluna da esquerda não cabe na página, mesmo com a letra reduzida. Encurte o texto, as instruções ou a lista de palavras, ou desmarque a lista de palavras.', 'Não foi possível montar a página');
        return;
      }
      st.cfg = cfg; st.pages = pages;
      if (fit.scale < 0.999) {
        adj.textContent = 'Para caber na página, o texto da coluna da esquerda foi reduzido para ' + Math.round(fit.scale * 100) + '% do tamanho padrão.';
        setHidden(adj, false);
      }
      var ul = $('#pag-resumo'), chips = [
        'Matriz ' + size + ' × ' + size, plural(puzzle.placements.length, 'palavra', 'palavras'),
        cfg.id ? 'Identificação ' + cfg.id : 'Sem identificação', 'A4 horizontal · 2 páginas (atividade e respostas)'
      ];
      ul.textContent = '';
      chips.forEach(function (t) { ul.appendChild(h('li', { text: t })); });
      setHidden(result, false);
      preview.show(pages, [{ label: 'Atividade', index: 0 }, { label: 'Respostas', index: 1 }]);
      menu.remember();
      var hd = $('#pag-res-h'); hd.scrollIntoView({ block: 'start', behavior: UI.reducedMotion() ? 'auto' : 'smooth' }); hd.focus({ preventScroll: true });
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); generate(); });
    $('#pag-limpar').addEventListener('click', function () {
      clearForm(form, DEFAULTS.pagina, function () { words.refresh(); });
      UI.clearErrors(box); setHidden(result, true); setHidden(adj, true); st.pages = null; $('#pag-titulo').focus();
    });

    $('#pag-baixar').addEventListener('click', function () {
      if (!st.pages) return;
      var stampId = Pdf.nextStamp();                                // horário exato do clique
      UI.toast('Gerando o PDF…');
      Pdf.exportPages(st.pages, { label: 'atividade-personalizada', stampId: stampId, title: st.cfg.title })
        .then(function (r) { UI.toast('PDF criado: ' + r.name); })
        .catch(function (err) { UI.toast((err && err.message) || 'Não foi possível criar o PDF.', 'erro'); });
    });
  }

  /* ---------- Inicialização ---------- */
  function boot() {
    UI.init();                                   // componentes (tamanho, direções), tema e navegação por abas
    Fx.init({ button: $('#btn-som'), onToggle: function (on) { UI.toast('Som de vitória ' + (on ? 'ligado.' : 'desligado.')); } });
    setupIndividual(); setupRevista(); setupPagina();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof self !== 'undefined' ? self : this);
