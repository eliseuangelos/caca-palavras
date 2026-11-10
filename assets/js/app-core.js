/* ============================================================
   INTERFACE — BASE
   Utilitários, armazenamento local, avisos, diálogos, tema, navegação por abas e os
   componentes reutilizados pelas três telas:
     • seletor visual do tamanho da matriz;
     • seletor de direções (bússola + atalhos);
     • diagnóstico do campo de palavras (contagem, repetidas, longas demais…);
     • menu de configurações (salvar, carregar, importar/exportar JSON e histórico);
     • pré-visualização paginada das páginas do PDF (o mesmo desenho do PDF, em canvas).
   Segurança: nenhum texto digitado pelo usuário entra no DOM por innerHTML; tudo usa textContent.
   ============================================================ */
(function (root) {
  'use strict';

  var Core = root.WSCore, Sheets = root.WSSheets, Metrics = root.WSMetrics, THEMES = root.WS_THEMES;
  var APP_ID = 'gerador-caca-palavras';
  var KEY = 'cpg:';
  var VIEWS = ['individual', 'revista', 'pagina', 'ajuda', 'creditos'];
  var VIEW_TITLES = {
    individual: 'Jogo individual', revista: 'Gerar revista', pagina: 'Página personalizada',
    ajuda: 'Ajuda e como utilizar', creditos: 'Créditos'
  };
  var BASE_TITLE = document.title;

  /* ---------- DOM ---------- */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function make(ns, tag, attrs, kids) {
    var el = ns ? document.createElementNS(ns, tag) : document.createElement(tag), k, v;
    attrs = attrs || {};
    for (k in attrs) {
      v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    [].concat(kids == null ? [] : kids).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
    return el;
  }
  function h(tag, attrs, kids) { return make(null, tag, attrs, kids); }
  function sv(tag, attrs, kids) { return make(SVGNS, tag, attrs, kids); }

  /* ---------- Texto e datas ---------- */
  function q(s) { return '“' + s + '”'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function todayBR() { var d = new Date(); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function whenBR(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function debounce(fn, ms) {
    var t;
    return function () { var a = arguments, me = this; clearTimeout(t); t = setTimeout(function () { fn.apply(me, a); }, ms); };
  }
  function reducedMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  /* ---------- Armazenamento local (nunca quebra se o navegador bloquear) ---------- */
  var Store = {
    get: function (key, fallback) {
      try { var v = root.localStorage.getItem(KEY + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set: function (key, val) {
      try { root.localStorage.setItem(KEY + key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
    del: function (key) { try { root.localStorage.removeItem(KEY + key); } catch (e) { /* sem armazenamento */ } }
  };

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob), a = h('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* ---------- Avisos (toast) e diálogos ---------- */
  var toastTimer = null;
  function toast(msg, kind) {
    var el = $('#toast'); if (!el) return;
    el.textContent = msg; el.className = 'toast on' + (kind === 'erro' ? ' erro' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, kind === 'erro' ? 7000 : 3800);
  }
  function openDlg(d) {
    if (!d) return;
    if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  }
  function closeDlg(d) {
    if (!d) return;
    if (typeof d.close === 'function') { if (d.open) d.close(); } else d.removeAttribute('open');
  }

  /* Diálogo de progresso: só aparece se a tarefa demorar mais de 250 ms (evita "piscar"). */
  var Progress = {
    cancelled: false, timer: null, shown: false,
    init: function () {
      var self = this, d = $('#dlg-progresso');
      $('#pg-cancelar').addEventListener('click', function () { self.cancel(); });
      d.addEventListener('cancel', function (e) { e.preventDefault(); self.cancel(); });
    },
    cancel: function () {
      this.cancelled = true; $('#pg-texto').textContent = 'Cancelando…'; $('#pg-cancelar').disabled = true;
    },
    open: function (title, text) {
      var self = this;
      this.cancelled = false; this.shown = false;
      $('#pg-titulo').textContent = title; $('#pg-texto').textContent = text || 'Preparando…';
      $('#pg-barra').value = 0; $('#pg-cancelar').disabled = false;
      clearTimeout(this.timer);
      this.timer = setTimeout(function () { self.shown = true; openDlg($('#dlg-progresso')); }, 250);
    },
    set: function (done, total, text) {
      $('#pg-barra').value = total ? Math.round(done * 100 / total) : 0;
      if (!this.cancelled) $('#pg-texto').textContent = text || (done + ' de ' + total);
    },
    close: function () { clearTimeout(this.timer); this.shown = false; closeDlg($('#dlg-progresso')); }
  };

  /* ---------- Erros de formulário ---------- */
  function showErrors(box, msgs, title) {
    msgs = [].concat(msgs);
    box.textContent = '';
    if (msgs.length === 1) {
      box.appendChild(h('strong', { text: (title || 'Não foi possível continuar') + ': ' }));
      box.appendChild(document.createTextNode(msgs[0]));
    } else {
      box.appendChild(h('strong', { text: (title || 'Corrija os itens abaixo antes de continuar') + ':' }));
      box.appendChild(h('ul', null, msgs.map(function (m) { return h('li', { text: m }); })));
    }
    box.hidden = false;
    box.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    box.focus({ preventScroll: true });
  }
  function clearErrors(box) { box.hidden = true; box.textContent = ''; }

  /* ---------- Tema claro / escuro (padrão da marca pessoal) ----------
     O tema fica em data-theme="light|dark" no <html> e na chave "ed-theme" do localStorage, a mesma do site pessoal
     (as duas páginas estão na mesma origem, eliseuangelos.github.io), então a escolha vale nos dois.
     Na primeira visita vale o tema do sistema; o <head> já aplica o tema antes da pintura (sem "piscar"). */
  var THEME_KEY = 'ed-theme', THEME_COLORS = { light: '#F4F7FB', dark: '#111C28' };
  function savedTheme() {
    try { var t = root.localStorage.getItem(THEME_KEY); return (t === 'dark' || t === 'light') ? t : null; } catch (e) { return null; }
  }
  function systemTheme() {
    return (root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    return (t === 'light' || t === 'dark') ? t : (savedTheme() || systemTheme());
  }
  function applyTheme(t) {
    var btn = $('#btn-tema');
    document.documentElement.setAttribute('data-theme', t);
    $$('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', THEME_COLORS[t]); });
    if (btn) btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    document.dispatchEvent(new CustomEvent('cpg:tema', { detail: t }));          // o tabuleiro (canvas) se redesenha com as novas cores
  }
  function initTheme() {
    var btn = $('#btn-tema'), mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;
    applyTheme(currentTheme());
    if (btn) btn.addEventListener('click', function () {
      var d = document.documentElement, next = currentTheme() === 'dark' ? 'light' : 'dark';
      d.classList.add('no-tr');                                                  // troca instantânea: sem transições por um instante
      applyTheme(next);
      try { root.localStorage.setItem(THEME_KEY, next); } catch (e) { /* sem armazenamento */ }
      void d.offsetWidth;
      setTimeout(function () { d.classList.remove('no-tr'); }, 60);
    });
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (!savedTheme()) applyTheme(systemTheme()); });
  }

  /* ---------- Navegação por abas (hash) ---------- */
  var Router = {
    current: null, token: 0,
    init: function () {
      var self = this;
      $$('.view').forEach(function (v) { v.classList.remove('is-active'); });
      root.addEventListener('hashchange', function () { self.fromHash(true); });
      this.fromHash(false);
    },
    hashName: function () {
      var n = (root.location.hash || '').replace(/^#/, '');
      return VIEWS.indexOf(n) >= 0 ? n : null;
    },
    fromHash: function (user) {
      var n = this.hashName();
      if (n) this.show(n, user); else if (!this.current) this.show('individual', false);   // "#conteudo" e outros: não muda a aba
    },
    show: function (name, userAction) {
      var self = this, next = $('#view-' + name), prev = this.current ? $('#view-' + this.current) : null, tk = ++this.token;
      if (!next || name === this.current) return;
      this.current = name;
      $$('.aba').forEach(function (a) {
        if (a.getAttribute('data-view') === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      var tab = $('.aba[data-view="' + name + '"]');
      if (tab && tab.scrollIntoView) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      document.title = name === 'individual' ? BASE_TITLE : VIEW_TITLES[name] + ' — Gerador de Caça-Palavras';
      var animate = !!prev && !reducedMotion();
      $$('.view').forEach(function (v) {
        if (v === next) return;
        if (v === prev && animate) v.classList.add('saindo'); else v.classList.remove('is-active', 'saindo');
      });
      function enter() {
        if (tk !== self.token) return;
        if (prev) prev.classList.remove('is-active', 'saindo');
        next.classList.add('is-active');
        if (userAction) {
          root.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          var cab = $('.view-cab', next);
          if (cab && cab.offsetParent) cab.focus({ preventScroll: true });
        }
        document.dispatchEvent(new CustomEvent('cpg:view', { detail: name }));
      }
      if (animate) setTimeout(enter, 120); else enter();
    }
  };

  /* ---------- Componente: tamanho da matriz ---------- */
  var SIZE_INFO = [{ n: 10, label: 'Pequeno' }, { n: 15, label: 'Médio' }, { n: 20, label: 'Grande' }];
  function miniGrid(n) {
    var svg = sv('svg', { viewBox: '0 0 48 48', 'aria-hidden': 'true', focusable: 'false' }), step = 44 / n, i;
    function at(k) { return (2 + (k + 0.5) * step).toFixed(2); }
    svg.appendChild(sv('rect', { class: 'mini-fundo', x: 2, y: 2, width: 44, height: 44, rx: 2 }));
    for (i = 1; i < n; i++) {
      var pos = (2 + i * step).toFixed(2);
      svg.appendChild(sv('line', { class: 'mini-linha', x1: pos, y1: 2, x2: pos, y2: 46 }));
      svg.appendChild(sv('line', { class: 'mini-linha', x1: 2, y1: pos, x2: 46, y2: pos }));
    }
    var sw = (step * 0.78).toFixed(2), a = Math.round(n * 0.2), b = Math.round(n * 0.55), r = n - 3;
    svg.appendChild(sv('line', { class: 'mini-marca', x1: at(a), y1: at(a), x2: at(b), y2: at(b), 'stroke-width': sw }));
    svg.appendChild(sv('line', { class: 'mini-marca', x1: at(Math.round(n * 0.3)), y1: at(r), x2: at(n - 3), y2: at(r), 'stroke-width': sw }));
    svg.appendChild(sv('rect', { class: 'mini-borda', x: 2, y: 2, width: 44, height: 44, rx: 2 }));
    return svg;
  }
  function buildSize(host) {
    var wrap = h('div', { class: 'tamanhos', role: 'radiogroup', 'aria-label': 'Tamanho da matriz' });
    SIZE_INFO.forEach(function (it) {
      var input = h('input', { type: 'radio', name: 'tamanho', value: it.n, checked: it.n === 15 });
      wrap.appendChild(h('label', { class: 'cartao-tam' }, [
        input, miniGrid(it.n), h('strong', { text: it.n + ' × ' + it.n }), h('small', { text: it.label })
      ]));
    });
    host.appendChild(wrap);
  }
  function getSize(form) {
    var el = $('input[name="tamanho"]:checked', form);
    return el ? Number(el.value) : 15;
  }
  function setSize(form, n) {
    var el = $('input[name="tamanho"][value="' + n + '"]', form);
    if (el && !el.checked) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  /* ---------- Componente: direções ---------- */
  var DIR_LAYOUT = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE'];
  var DIR_ROT = { E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: 225, N: 270, NE: 315 };
  var PRESETS = [
    { id: 'all', label: 'Todas as direções' }, { id: 'horizontal', label: 'Apenas horizontal' },
    { id: 'vertical', label: 'Apenas vertical' }, { id: 'diagonal', label: 'Apenas diagonal' },
    { id: 'hv', label: 'Horizontal e vertical' }
  ];
  function getDirs(form) {
    return Core.sanitizeDirs($$('input[name="dir"]:checked', form).map(function (i) { return i.value; }));
  }
  function buildDirs(host) {
    var form = host.closest('form'), wrap = h('div', { class: 'dirs' });
    var compass = h('div', { class: 'bussola', role: 'group', 'aria-label': 'Direções permitidas' });
    var center = h('div', { class: 'dir-centro', 'aria-hidden': 'true' });
    DIR_LAYOUT.forEach(function (id) {
      if (!id) { compass.appendChild(center); return; }
      var d = Core.DIR_BY_ID[id];
      var input = h('input', { type: 'checkbox', name: 'dir', value: id, checked: true, 'aria-label': d.label });
      var svg = sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
        [sv('use', { href: '#i-seta', transform: 'rotate(' + DIR_ROT[id] + ' 12 12)' })]);
      compass.appendChild(h('label', { class: 'dir-btn', title: d.label }, [input, svg]));
    });
    var presets = h('div', { class: 'presets', role: 'group', 'aria-label': 'Atalhos de direções' });
    var info = h('p', { class: 'dica', 'aria-live': 'polite' });
    PRESETS.forEach(function (pr) {
      presets.appendChild(h('button', {
        type: 'button', class: 'chip-btn', 'data-preset': pr.id, 'aria-pressed': 'false', text: pr.label,
        onclick: function () {
          var set = Core.DIR_PRESETS[pr.id];
          $$('input[name="dir"]', host).forEach(function (i) { i.checked = set.indexOf(i.value) >= 0; });
          sync();
          form.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }));
    });
    wrap.appendChild(compass); wrap.appendChild(h('div', { class: 'dirs-lado' }, [presets, info]));
    host.appendChild(wrap);

    function sync() {
      var now = getDirs(form), n = now.length;
      center.textContent = n + '/8';
      $$('.chip-btn', presets).forEach(function (b) {
        var set = Core.DIR_PRESETS[b.getAttribute('data-preset')];
        b.setAttribute('aria-pressed', (set.length === n && set.every(function (x) { return now.indexOf(x) >= 0; })) ? 'true' : 'false');
      });
      info.textContent = n === 0 ? 'Selecione ao menos uma direção.' :
        (n === 8 ? 'Todas as direções estão ativas.' : n + ' de 8 direções ativas.');
      info.className = 'dica' + (n === 0 ? ' aviso-erro' : '');
    }
    wrap.addEventListener('change', sync);
    form.addEventListener('reset', function () { setTimeout(sync, 0); });
    form.addEventListener('change', function (e) { if (e.target && e.target.name === 'dir') return; sync(); });
    sync();
  }

  /* ---------- Componente: diagnóstico do campo de palavras ----------
     o = { form, area, out, min, max, strict, setSize }
     strict (jogo e página): repetidas, longas demais e curtas demais bloqueiam a geração.
     bank   (revista): esses itens são apenas ignorados e contabilizados. */
  function line(cls, text, buttons) {
    return h('div', { class: 'aviso-linha ' + cls }, [h('span', { text: text })].concat(buttons || []));
  }
  function examples(arr, fmt) {
    return arr.slice(0, 4).map(fmt).join(', ') + (arr.length > 4 ? ' e mais ' + (arr.length - 4) : '');
  }
  function renderWordsState(o, size) {
    var res = Core.parseWords(o.area.value, { size: size }), out = o.out, blocking = false;
    out.textContent = '';
    if (!res.total) { o.area.removeAttribute('aria-invalid'); return { res: res, blocking: false }; }
    var ok = res.entries.length, letters = res.entries.reduce(function (s, e) { return s + e.clean.length; }, 0), cells = size * size;
    var bad = res.duplicates.length + res.tooLong.length + res.tooShort.length + res.noLetters.length;
    var fix = h('button', {
      type: 'button', class: 'btn-mini',
      text: o.strict ? 'Remover repetidas e inválidas' : 'Limpar o banco (remover ignoradas)',
      onclick: function () {
        o.area.value = Core.rebuildText(o.area.value, size, { dups: true, long: true, short: true });
        o.area.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    var count = o.strict ? plural(ok, 'palavra reconhecida', 'palavras reconhecidas') : plural(ok, 'palavra utilizável', 'palavras utilizáveis') + ' no banco';
    var cls = 'contador';
    if (o.strict && o.max && ok > o.max) { count += ' (o limite é ' + o.max + ')'; cls += ' aviso-erro'; blocking = true; }
    else if (o.strict && o.min && ok < o.min) { count += ' (mínimo: ' + o.min + ')'; cls += ' aviso-aviso'; }
    else cls += ' aviso-ok';
    out.appendChild(line(cls, count));

    var tag = o.strict ? 'aviso-erro' : 'aviso-aviso', lead = o.strict ? '' : 'Ignoradas: ';
    if (res.duplicates.length) {
      out.appendChild(line(tag, (o.strict ? 'Repetidas (a acentuação é ignorada): ' : lead + 'repetidas: ') +
        examples(res.duplicates, function (d) { return q(d.display) + ' = ' + q(d.of); }) + '.'));
      if (o.strict) blocking = true;
    }
    if (res.tooLong.length) {
      var maxLen = res.tooLong.reduce(function (m, w) { return Math.max(m, w.length); }, 0);
      var bigger = Core.SIZES.filter(function (n) { return n > size && n >= maxLen; })[0];
      var btns = [];
      if (o.strict && bigger && o.setSize) btns.push(h('button', { type: 'button', class: 'btn-mini', text: 'Usar ' + bigger + ' × ' + bigger, onclick: function () { o.setSize(bigger); } }));
      out.appendChild(line(tag, (o.strict ? 'Maiores que a matriz ' + size + ' × ' + size + ': ' : lead + 'maiores que a matriz ' + size + ' × ' + size + ': ') +
        examples(res.tooLong, function (w) { return q(w.display) + ' (' + w.length + ' letras)'; }) + '.', btns));
      if (o.strict) blocking = true;
    }
    if (res.tooShort.length || res.noLetters.length) {
      var shorts = res.tooShort.concat(res.noLetters);
      out.appendChild(line(tag, (o.strict ? 'Curtas demais ou sem letras (mínimo de 2 letras): ' : lead + 'curtas demais ou sem letras: ') +
        examples(shorts, function (w) { return q(w.display); }) + '.'));
      if (o.strict) blocking = true;
    }
    if (bad) out.appendChild(h('div', { class: 'aviso-linha' }, [fix]));
    if (o.strict && letters > cells) {
      out.appendChild(line('aviso-erro', 'As palavras somam ' + letters + ' letras, mais do que as ' + cells + ' células da matriz.')); blocking = true;
    } else if (o.strict && letters > cells * 0.6) {
      out.appendChild(line('aviso-aviso', 'As palavras ocupam ' + Math.round(letters * 100 / cells) + '% da matriz. Pode ser difícil posicionar todas; prefira uma matriz maior ou menos palavras.'));
    }
    if (o.strict && res.substrings.length) {
      out.appendChild(line('aviso-aviso', 'Atenção: ' + examples(res.substrings, function (s) { return q(s.inner) + ' aparece dentro de ' + q(s.outer); }) +
        '. As duas podem ser encontradas no mesmo trecho da matriz.'));
    }
    if (blocking) o.area.setAttribute('aria-invalid', 'true'); else o.area.removeAttribute('aria-invalid');
    return { res: res, blocking: blocking };
  }
  function bindWordsState(o) {
    var run = function () { return renderWordsState(o, getSize(o.form)); };
    o.area.addEventListener('input', debounce(run, 160));
    o.form.addEventListener('change', function (e) { if (e.target && e.target.name === 'tamanho') run(); });
    o.form.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
    return { refresh: run };
  }

  /* ---------- Componente: menu de configurações ---------- */
  var FIRST_FIELDS = ['modo', 'tamanho', 'dir'];     // aplicados antes dos demais (alteram opções dependentes)
  function collect(form) {
    var out = {}, seen = {};
    $$('input, textarea, select', form).forEach(function (el) {
      var n = el.name;
      if (!n || el.type === 'file' || el.type === 'button' || el.type === 'submit') return;
      if (el.type === 'radio') { if (el.checked) out[n] = el.value; return; }
      if (el.type === 'checkbox') {
        if ($$('input[type="checkbox"][name="' + n + '"]', form).length > 1) {
          if (!seen[n]) { seen[n] = true; out[n] = []; }
          if (el.checked) out[n].push(el.value);
        } else out[n] = el.checked;
        return;
      }
      out[n] = el.value;
    });
    return out;
  }
  function setField(form, n, v) {
    var els = $$('[name="' + n + '"]', form); if (!els.length) return;
    var first = els[0];
    if (first.type === 'radio') els.forEach(function (e) { e.checked = String(e.value) === String(v); });
    else if (first.type === 'checkbox') {
      if (els.length > 1) {
        var set = Array.isArray(v) ? v.map(String) : [];
        els.forEach(function (e) { e.checked = set.indexOf(e.value) >= 0; });
      } else first.checked = v === true;
    } else if (first.tagName === 'SELECT') {
      if ($$('option', first).some(function (o) { return o.value === String(v); })) first.value = String(v);
    } else {
      var str = (typeof v === 'string' || typeof v === 'number') ? String(v) : '';
      if (first.maxLength > 0) str = str.slice(0, first.maxLength);
      first.value = str;
    }
  }
  function applyValues(form, vals) {
    if (!vals || typeof vals !== 'object') return;
    FIRST_FIELDS.forEach(function (n) { if (Object.prototype.hasOwnProperty.call(vals, n)) setField(form, n, vals[n]); });
    form.dispatchEvent(new Event('change', { bubbles: true }));
    Object.keys(vals).forEach(function (n) { if (FIRST_FIELDS.indexOf(n) < 0) setField(form, n, vals[n]); });
    $$('textarea, input[type="text"], input[type="number"]', form).forEach(function (el) { el.dispatchEvent(new Event('input', { bubbles: true })); });
    form.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* o = { view, form, label(valores) → texto do histórico, afterApply() } */
  function configMenu(host, o) {
    var view = o.view, form = o.form, det = h('details', { class: 'menu-cfg' });
    var hist = h('div', { class: 'historico' });
    var file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Escolher arquivo de configuração (JSON)' });
    function loadHist() { var a = Store.get('hist:' + view, []); return Array.isArray(a) ? a : []; }
    function afterApply() { if (o.afterApply) o.afterApply(); }
    function renderHist() {
      hist.textContent = '';
      var items = loadHist();
      if (!items.length) {
        hist.appendChild(h('p', { class: 'historico-vazio', text: 'Ainda não há configurações no histórico. Elas aparecem aqui depois de cada geração.' }));
        return;
      }
      items.forEach(function (it) {
        hist.appendChild(h('button', {
          type: 'button', class: 'btn btn-sm', text: whenBR(it.t) + ' — ' + String(it.l || 'Configuração'),
          onclick: function () { applyValues(form, it.v); afterApply(); toast('Configuração do histórico aplicada.'); }
        }));
      });
    }
    function remember() {
      var v = collect(form), json = JSON.stringify(v);
      var items = loadHist().filter(function (it) { return JSON.stringify(it.v) !== json; });
      items.unshift({ t: new Date().toISOString(), l: o.label(v), v: v });
      Store.set('hist:' + view, items.slice(0, 5));
      renderHist();
    }
    var buttons = h('div', { class: 'menu-cfg-botoes' }, [
      h('button', { type: 'button', class: 'btn btn-sm', text: 'Salvar neste navegador', onclick: function () {
        var saved = Store.set('cfg:' + view, { t: new Date().toISOString(), v: collect(form) });
        toast(saved ? 'Configuração salva neste navegador.' : 'Não foi possível salvar: o navegador bloqueou o armazenamento local.', saved ? '' : 'erro');
      } }),
      h('button', { type: 'button', class: 'btn btn-sm', text: 'Carregar salva', onclick: function () {
        var s = Store.get('cfg:' + view, null);
        if (!s || !s.v) { toast('Ainda não há configuração salva para esta tela.', 'erro'); return; }
        applyValues(form, s.v); afterApply(); toast('Configuração carregada.');
      } }),
      h('button', { type: 'button', class: 'btn btn-sm', text: 'Exportar JSON', onclick: function () {
        var data = { app: APP_ID, versao: 1, tela: view, criado: new Date().toISOString(), valores: collect(form) };
        var name = root.WSPdf.nextStamp() + '-configuracao-' + view + '.json';
        downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), name);
        toast('Arquivo criado: ' + name);
      } }),
      h('button', { type: 'button', class: 'btn btn-sm', text: 'Importar JSON', onclick: function () { file.click(); } }),
      h('button', { type: 'button', class: 'btn btn-sm btn-ghost', text: 'Apagar dados salvos', onclick: function () {
        if (!root.confirm('Apagar a configuração salva e o histórico desta tela neste navegador?')) return;
        Store.del('cfg:' + view); Store.del('hist:' + view); renderHist(); toast('Dados salvos apagados.');
      } })
    ]);
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      if (f.size > 300 * 1024) { toast('O arquivo é grande demais para ser uma configuração.', 'erro'); file.value = ''; return; }
      var rd = new FileReader();
      rd.onload = function () {
        var obj = null;
        try { obj = JSON.parse(String(rd.result)); } catch (e) { obj = null; }
        if (!obj || obj.app !== APP_ID || typeof obj.valores !== 'object' || obj.valores === null) {
          toast('Arquivo inválido: escolha um JSON exportado por este gerador.', 'erro');
        } else if (obj.tela !== view) {
          toast('Esta configuração é da tela “' + String(obj.tela).slice(0, 20) + '”. Importe-a na aba correspondente.', 'erro');
        } else { applyValues(form, obj.valores); afterApply(); toast('Configuração importada.'); }
        file.value = '';
      };
      rd.onerror = function () { toast('Não foi possível ler o arquivo.', 'erro'); file.value = ''; };
      rd.readAsText(f);
    });
    det.appendChild(h('summary', { text: 'Configurações' }));
    det.appendChild(h('div', { class: 'menu-cfg-corpo' }, [
      h('p', { class: 'dica', text: 'Salve o que você preencheu, exporte para um arquivo ou volte a uma configuração recente. Tudo fica apenas neste navegador; nada é enviado para servidores.' }),
      buttons, file,
      h('div', null, [h('h4', { text: 'Últimas configurações usadas' }), hist])
    ]));
    host.appendChild(det);
    renderHist();
    return { remember: remember, refresh: renderHist };
  }

  /* ---------- Componente: pré-visualização paginada ----------
     Usa o mesmo desenho do PDF (Sheets.drawPage) em um canvas; as larguras do texto vêm da
     tabela de métricas da fonte do PDF, então as quebras de linha são idênticas. */
  function createPreview(host) {
    var state = { pages: [], i: 0 };
    host.textContent = '';
    var prev = h('button', { type: 'button', class: 'btn btn-sm', text: '◀ Anterior', 'aria-label': 'Página anterior' });
    var next = h('button', { type: 'button', class: 'btn btn-sm', text: 'Próxima ▶', 'aria-label': 'Próxima página' });
    var label = h('span', { class: 'previa-pag', 'aria-live': 'polite' });
    var jumps = h('div', { class: 'previa-saltos' });
    var canvas = h('canvas', { role: 'img' });
    var sheet = h('div', { class: 'previa-folha' }, [canvas]);
    host.appendChild(h('div', { class: 'previa-barra' }, [prev, label, next, jumps]));
    host.appendChild(sheet);

    function measure(s, pt, bold) { return Metrics.width(s, pt, bold); }
    function render() {
      var pg = state.pages[state.i]; if (!pg || !host.offsetParent) return;
      var size = Sheets.pageSize(pg), dpr = Math.min(root.devicePixelRatio || 1, 2);
      var cssW = Math.max(240, Math.min(sheet.clientWidth - 26, 900));
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssW * dpr * size.h / size.w);
      canvas.style.width = cssW + 'px';
      Sheets.drawPage(Sheets.makeCanvasPainter(canvas, size.w, size.h, measure), pg);
      label.textContent = 'Página ' + (state.i + 1) + ' de ' + state.pages.length;
      canvas.setAttribute('aria-label', 'Pré-visualização da página ' + (state.i + 1) + ' de ' + state.pages.length + ' do PDF');
      prev.disabled = state.i === 0; next.disabled = state.i >= state.pages.length - 1;
    }
    function go(i) { state.i = Math.max(0, Math.min(state.pages.length - 1, i)); render(); }
    prev.addEventListener('click', function () { go(state.i - 1); });
    next.addEventListener('click', function () { go(state.i + 1); });
    var rerender = debounce(render, 120);
    root.addEventListener('resize', rerender);
    document.addEventListener('cpg:view', function () { setTimeout(render, 0); });
    return {
      show: function (pages, jumpList) {
        state.pages = pages; state.i = 0; jumps.textContent = '';
        (jumpList || []).forEach(function (j) {
          jumps.appendChild(h('button', { type: 'button', class: 'btn btn-sm btn-ghost', text: j.label, onclick: function () { go(j.index); } }));
        });
        render();
      },
      refresh: render, go: go
    };
  }

  /* ---------- Preenchimento dos seletores de tema e inicialização ---------- */
  function themeList() {
    return Object.keys(THEMES).map(function (k) { return { key: k, name: THEMES[k].name, count: THEMES[k].words.length }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); });
  }
  function fillThemes(select, withCount) {
    themeList().forEach(function (t) {
      select.appendChild(h('option', { value: t.key, text: withCount ? t.name + ' (' + t.count + ' palavras)' : t.name }));
    });
  }
  /* Plano B para navegadores sem o seletor :has() (por exemplo Firefox anterior ao 121): o destaque dos cartões
     de tamanho e dos botões de direção marcados passa a vir de uma classe (.is-on). Nos demais navegadores não faz nada. */
  function installHasFallback() {
    var ok = false;
    try { ok = !!(root.CSS && root.CSS.supports && root.CSS.supports('selector(:has(*))')); } catch (e) { ok = false; }
    if (ok) return;
    function paint() {
      $$('.cartao-tam, .dir-btn').forEach(function (label) {
        var input = label.querySelector('input');
        label.classList.toggle('is-on', !!(input && input.checked));
      });
    }
    document.addEventListener('change', paint);
    document.addEventListener('reset', function () { setTimeout(paint, 0); }, true);
    document.addEventListener('cpg:view', function () { setTimeout(paint, 0); });
    paint();
  }
  function init() {
    initTheme(); Progress.init();
    $$('[data-comp="size"]').forEach(buildSize);
    $$('[data-comp="dirs"]').forEach(buildDirs);
    installHasFallback();
    Router.init();
  }

  root.WSUI = {
    $: $, $$: $$, h: h, sv: sv, q: q, plural: plural, todayBR: todayBR, debounce: debounce, Store: Store,
    toast: toast, openDlg: openDlg, closeDlg: closeDlg, Progress: Progress, Router: Router,
    showErrors: showErrors, clearErrors: clearErrors, downloadBlob: downloadBlob, reducedMotion: reducedMotion,
    getSize: getSize, setSize: setSize, getDirs: getDirs, bindWordsState: bindWordsState,
    collect: collect, applyValues: applyValues, configMenu: configMenu, createPreview: createPreview,
    themeList: themeList, fillThemes: fillThemes, init: init
  };
})(typeof self !== 'undefined' ? self : this);
