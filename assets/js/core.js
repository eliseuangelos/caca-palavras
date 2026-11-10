/* ============================================================
   NÚCLEO DE GERAÇÃO  (sem dependência de DOM – roda no navegador e no Node)
   - normalização e leitura da lista de palavras
   - direções permitidas
   - posicionamento das palavras (algoritmo aperfeiçoado do projeto original)
   - identificação sequencial (P0001 → P0002 …)
   - distribuição equilibrada de um banco de palavras entre vários jogos
   - geração em lote com progresso (até 50 jogos)
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WSCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var MIN_WORD_LEN = 2;          // "FÉ" (2 letras) é aceita
  var MAX_WORDS_PER_PUZZLE = 40;
  var MAX_GAMES = 50;
  var SIZES = [10, 15, 20];

  /* ---------- Erros com código (a interface decide como exibir) ---------- */
  class PuzzleError extends Error {
    constructor(code, message, details) {
      super(message);
      this.name = 'PuzzleError';
      this.code = code;
      this.details = details || {};
    }
  }

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  /* ---------- Aleatoriedade ---------- */
  function makeRng(seed) {                       // mulberry32 – usado nos testes (reprodutível)
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function defaultRng() { return Math.random(); }
  function randInt(rng, n) { return Math.floor(rng() * n); }
  function shuffle(arr, rng) {                   // Fisher–Yates (retorna cópia)
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(rng || defaultRng, i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- Texto ---------- */
  // Remove acentos, espaços, hífens e qualquer caractere fora de A–Z (somente para a matriz).
  function normalizeWord(str) {
    return String(str == null ? '' : str).normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase();
  }
  // Mantém acentuação e capitalização digitadas; só limpa espaços e caracteres de controle.
  function cleanDisplay(str) {
    return String(str == null ? '' : str).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function reverseStr(s) { return s.split('').reverse().join(''); }
  function compareWords(a, b) { return a.clean < b.clean ? -1 : (a.clean > b.clean ? 1 : 0); }
  function splitList(text) {
    return String(text == null ? '' : text).split(/[,;\n\r]+/).map(cleanDisplay).filter(function (s) { return s.length > 0; });
  }

  /* Lê o campo único de palavras (separadas por vírgula; também aceita ponto e vírgula e quebras de linha).
     Devolve listas separadas para que a interface explique cada problema. */
  function parseWords(text, opts) {
    opts = opts || {};
    var size = opts.size || 0, minLen = opts.minLen || MIN_WORD_LEN;
    var parts = splitList(text);
    var res = { total: parts.length, entries: [], duplicates: [], tooLong: [], tooShort: [], noLetters: [], substrings: [] };
    var seen = Object.create(null);
    parts.forEach(function (raw) {
      var display = raw.slice(0, 60), clean = normalizeWord(display);
      if (!clean.length) { res.noLetters.push({ display: display }); return; }
      if (seen[clean]) { res.duplicates.push({ display: display, clean: clean, of: seen[clean].display }); return; }
      var entry = { display: display, clean: clean };
      seen[clean] = entry;
      if (clean.length < minLen) res.tooShort.push(entry);
      else if (size && clean.length > size) res.tooLong.push({ display: display, clean: clean, length: clean.length });
      else res.entries.push(entry);
    });
    if (res.entries.length <= 60) {              // palavra contida em outra gera mais de uma ocorrência na matriz
      res.entries.forEach(function (a) {
        res.entries.forEach(function (b) {
          if (a !== b && a.clean.length < b.clean.length &&
              (b.clean.indexOf(a.clean) >= 0 || reverseStr(b.clean).indexOf(a.clean) >= 0)) {
            res.substrings.push({ inner: a.display, outer: b.display });
          }
        });
      });
    }
    return res;
  }

  /* Reescreve o texto digitado sem os itens problemáticos (botões "Remover" da interface).
     drop = { dups: repetidas, long: maiores que a matriz, short: curtas demais ou sem letras } */
  function rebuildText(text, size, drop) {
    drop = drop || {};
    var seen = Object.create(null), out = [];
    splitList(text).forEach(function (raw) {
      var clean = normalizeWord(raw);
      if (drop.short && clean.length < MIN_WORD_LEN) return;
      if (drop.long && size && clean.length > size) return;
      if (drop.dups && clean && seen[clean]) return;
      if (clean) seen[clean] = true;
      out.push(raw);
    });
    return out.join(', ');
  }

  /* Banco de palavras (revista): texto livre + temas. Palavras inutilizáveis são descartadas e contabilizadas. */
  function buildPool(sources, size, themes) {
    var parsed = parseWords(sources.text || '', { size: size });
    var pool = parsed.entries.slice(), seen = Object.create(null);
    pool.forEach(function (e) { seen[e.clean] = true; });
    var stats = {
      fromText: parsed.entries.length, fromThemes: 0, duplicates: parsed.duplicates.length,
      tooLong: parsed.tooLong.length, tooShort: parsed.tooShort.length + parsed.noLetters.length
    };
    (sources.themes || []).forEach(function (key) {
      var t = themes && themes[key];
      if (!t) return;
      t.words.forEach(function (w) {
        var display = cleanDisplay(w), clean = normalizeWord(display);
        if (!clean || clean.length < MIN_WORD_LEN) { stats.tooShort++; return; }
        if (clean.length > size) { stats.tooLong++; return; }
        if (seen[clean]) { stats.duplicates++; return; }
        seen[clean] = true; pool.push({ display: display, clean: clean }); stats.fromThemes++;
      });
    });
    return { pool: pool, stats: stats };
  }

  /* ---------- Direções ---------- */
  var DIRS = [
    { id: 'E',  dr: 0,  dc: 1,  sym: '→', axis: 'h', label: 'Horizontal para a direita' },
    { id: 'W',  dr: 0,  dc: -1, sym: '←', axis: 'h', label: 'Horizontal para a esquerda' },
    { id: 'S',  dr: 1,  dc: 0,  sym: '↓', axis: 'v', label: 'Vertical para baixo' },
    { id: 'N',  dr: -1, dc: 0,  sym: '↑', axis: 'v', label: 'Vertical para cima' },
    { id: 'SE', dr: 1,  dc: 1,  sym: '↘', axis: 'd', label: 'Diagonal inferior direita' },
    { id: 'NW', dr: -1, dc: -1, sym: '↖', axis: 'd', label: 'Diagonal superior esquerda' },
    { id: 'SW', dr: 1,  dc: -1, sym: '↙', axis: 'd', label: 'Diagonal inferior esquerda' },
    { id: 'NE', dr: -1, dc: 1,  sym: '↗', axis: 'd', label: 'Diagonal superior direita' }
  ];
  var DIR_BY_ID = {};
  DIRS.forEach(function (d) { DIR_BY_ID[d.id] = d; });
  var DIR_PRESETS = {
    all: ['E', 'W', 'S', 'N', 'SE', 'NW', 'SW', 'NE'],
    horizontal: ['E', 'W'],
    vertical: ['S', 'N'],
    diagonal: ['SE', 'NW', 'SW', 'NE'],
    hv: ['E', 'W', 'S', 'N']
  };
  function sanitizeDirs(ids) {                   // ids válidos, sem repetição, em ordem canônica
    var set = {};
    (ids || []).forEach(function (id) { if (DIR_BY_ID[id]) set[id] = true; });
    return DIRS.filter(function (d) { return set[d.id]; }).map(function (d) { return d.id; });
  }

  /* ---------- Identificação sequencial ---------- */
  function addToDigits(digits, add) {            // soma inteira em string, preservando zeros à esquerda
    var a = digits.split('').map(Number), carry = add, i = a.length - 1;
    while (carry > 0) {
      if (i < 0) { a.unshift(0); i = 0; }
      var v = a[i] + carry; a[i] = v % 10; carry = Math.floor(v / 10); i--;
    }
    return a.join('');
  }
  function parseIdPattern(raw, count) {
    var base = cleanDisplay(raw || '').slice(0, 24) || 'P0001';
    var m = /^(.*?)(\d+)$/.exec(base);
    if (m) return { prefix: m[1], digits: m[2], hasNumber: true };
    // Sem número no final: acrescenta um sufixo sequencial (ATIVIDADE → ATIVIDADE-01, ATIVIDADE-02 …)
    var sep = /[A-Za-z0-9À-ÿ]$/.test(base) ? '-' : '';
    var width = Math.max(2, String(count || 1).length);
    return { prefix: base + sep, digits: new Array(width).join('0') + '1', hasNumber: false };
  }
  function makeIds(raw, count) {
    var p = parseIdPattern(raw, count), out = [];
    for (var i = 0; i < count; i++) out.push(p.prefix + addToDigits(p.digits, i));
    return out;
  }

  /* ---------- Distribuição das palavras entre os jogos ---------- */
  function checkDistribution(poolSize, games, perGame, reuse) {
    var need = games * perGame;
    if (perGame > poolSize) {
      return { ok: false, code: 'POOL_TOO_SMALL', need: perGame, have: poolSize,
        message: 'O banco tem apenas ' + poolSize + ' palavra(s) utilizável(is), mas cada jogo precisa de ' + perGame + '. Adicione palavras, escolha mais temas ou reduza as palavras por jogo.' };
    }
    if (!reuse && need > poolSize) {
      return { ok: false, code: 'NOT_ENOUGH_WORDS', need: need, have: poolSize, missing: need - poolSize,
        message: 'Faltam ' + (need - poolSize) + ' palavras: ' + games + ' jogo(s) com ' + perGame + ' palavras, sem reutilização, exigem ' + need + ' palavras diferentes e o banco tem ' + poolSize + '. Adicione palavras, escolha mais temas, reduza a quantidade ou permita a reutilização.' };
    }
    return { ok: true, need: need, have: poolSize, cycles: reuse ? need / poolSize : Math.min(1, need / poolSize) };
  }

  /* "Baralho" embaralhado: cada palavra só volta depois que todas as outras foram usadas (equilibrado). */
  function createDealer(pool, rng, reuse) {
    var deck = shuffle(pool, rng);
    return {
      deal: function (n) {
        var picked = [], used = Object.create(null), skipped = [];
        while (picked.length < n) {
          if (!deck.length) {
            if (!reuse) throw new PuzzleError('NOT_ENOUGH_WORDS', 'As palavras do banco acabaram antes do último jogo.');
            deck = shuffle(pool, rng);
          }
          var w = deck.shift();
          if (used[w.clean]) { skipped.push(w); continue; }   // nunca repete dentro do mesmo jogo
          used[w.clean] = true; picked.push(w);
        }
        deck = deck.concat(skipped);
        return picked;
      },
      giveBack: function (entries) { deck = deck.concat(entries); }
    };
  }

  /* ---------- Posicionamento ---------- */
  function candidates(grid, size, word, d) {      // todas as posições válidas para a palavra nesta direção
    var L = word.length, out = [];
    var rMin = d.dr < 0 ? L - 1 : 0, rMax = d.dr > 0 ? size - L : size - 1;
    var cMin = d.dc < 0 ? L - 1 : 0, cMax = d.dc > 0 ? size - L : size - 1;
    for (var r = rMin; r <= rMax; r++) {
      for (var c = cMin; c <= cMax; c++) {
        var ok = true, ov = 0;
        for (var i = 0; i < L; i++) {
          var ch = grid[(r + d.dr * i) * size + (c + d.dc * i)];
          if (ch === '') continue;
          if (ch !== word.charAt(i)) { ok = false; break; }
          ov++;
        }
        if (ok && ov < L) out.push({ r: r, c: c, ov: ov });   // ov === L: palavra "escondida" dentro de outra
      }
    }
    return out;
  }
  function chooseCandidate(list, bias, rng) {
    if (!bias) return list[randInt(rng, list.length)];
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += 1 + bias * list[i].ov;
    var x = rng() * total;
    for (i = 0; i < list.length; i++) { x -= 1 + bias * list[i].ov; if (x <= 0) return list[i]; }
    return list[list.length - 1];
  }
  function tryPlace(words, size, dirs, rng, bias) {
    var grid = new Array(size * size).fill(''), placements = [];
    for (var wi = 0; wi < words.length; wi++) {
      var e = words[wi], perDir = [];
      for (var di = 0; di < dirs.length; di++) {
        var d = DIR_BY_ID[dirs[di]], list = candidates(grid, size, e.clean, d);
        if (list.length) perDir.push({ d: d, list: list });
      }
      if (!perDir.length) return { ok: false, failed: e };
      var pick = perDir[randInt(rng, perDir.length)];       // direção sorteada entre as que ainda cabem
      var cand = chooseCandidate(pick.list, bias, rng), cells = [];
      for (var i = 0; i < e.clean.length; i++) {
        var r = cand.r + pick.d.dr * i, c = cand.c + pick.d.dc * i;
        grid[r * size + c] = e.clean.charAt(i);
        cells.push({ r: r, c: c });
      }
      placements.push({ display: e.display, clean: e.clean, dir: pick.d.id, start: cells[0], end: cells[cells.length - 1], cells: cells });
    }
    return { ok: true, grid: grid, placements: placements };
  }

  /* Ocorrências de uma palavra na matriz (nas 8 direções). Chave = extremidades ordenadas (palíndromos contam uma vez). */
  function occKey(a, b) {
    var k1 = a.r + ',' + a.c, k2 = b.r + ',' + b.c;
    return k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
  }
  function findOccurrences(grid, size, word) {
    var L = word.length, found = Object.create(null), out = [];
    for (var di = 0; di < DIRS.length; di++) {
      var d = DIRS[di];
      var rMin = d.dr < 0 ? L - 1 : 0, rMax = d.dr > 0 ? size - L : size - 1;
      var cMin = d.dc < 0 ? L - 1 : 0, cMax = d.dc > 0 ? size - L : size - 1;
      for (var r = rMin; r <= rMax; r++) for (var c = cMin; c <= cMax; c++) {
        var ok = true;
        for (var i = 0; i < L; i++) {
          if (grid[(r + d.dr * i) * size + (c + d.dc * i)] !== word.charAt(i)) { ok = false; break; }
        }
        if (!ok) continue;
        var a = { r: r, c: c }, b = { r: r + d.dr * (L - 1), c: c + d.dc * (L - 1) }, k = occKey(a, b);
        if (!found[k]) { found[k] = true; out.push({ key: k, r: r, c: c, dr: d.dr, dc: d.dc, len: L }); }
      }
    }
    return out;
  }

  /* Preenche as células vazias e tenta eliminar ocorrências "por acaso" (ambiguidade) trocando só letras de preenchimento. */
  function fillAndClean(grid, size, placements, rng) {
    var letters = placements.map(function (p) { return p.clean; }).join('');
    var isFill = new Array(size * size).fill(false), i;
    for (i = 0; i < grid.length; i++) {
      if (grid[i] === '') {
        isFill[i] = true;
        grid[i] = (rng() < 0.5) ? letters.charAt(randInt(rng, letters.length)) : ALPHABET.charAt(randInt(rng, 26));
      }
    }
    var extras = 0;
    for (var iter = 0; iter < 25; iter++) {
      var changed = false; extras = 0;
      placements.forEach(function (p) {
        var own = occKey(p.start, p.end);
        findOccurrences(grid, size, p.clean).forEach(function (o) {
          if (o.key === own) return;
          extras++;
          var idxs = [];
          for (var k = 0; k < o.len; k++) {
            var idx = (o.r + o.dr * k) * size + (o.c + o.dc * k);
            if (isFill[idx]) idxs.push(idx);
          }
          if (!idxs.length) return;
          var target = idxs[randInt(rng, idxs.length)], old = grid[target], nl;
          do { nl = ALPHABET.charAt(randInt(rng, 26)); } while (nl === old);
          grid[target] = nl; changed = true;
        });
      });
      if (!changed) break;
    }
    return extras;
  }

  /* Gera UMA matriz. Lança PuzzleError quando não consegue posicionar todas as palavras. */
  function generatePuzzle(entries, opts) {
    opts = opts || {};
    var size = opts.size | 0, rng = opts.rng || defaultRng;
    var dirs = sanitizeDirs(opts.dirs === undefined ? DIR_PRESETS.all : opts.dirs);
    if (!dirs.length) throw new PuzzleError('NO_DIRECTIONS', 'Selecione ao menos uma direção para as palavras.');
    if (SIZES.indexOf(size) < 0 && !opts.anySize) throw new PuzzleError('BAD_SIZE', 'Tamanho de matriz inválido.');
    if (!entries || !entries.length) throw new PuzzleError('NO_WORDS', 'Nenhuma palavra para posicionar.');
    var seen = Object.create(null), total = 0;
    entries.forEach(function (e) {
      if (!e.clean || e.clean.length < MIN_WORD_LEN) throw new PuzzleError('WORD_TOO_SHORT', 'A palavra "' + e.display + '" é muito curta.', { word: e.display });
      if (e.clean.length > size) throw new PuzzleError('WORD_TOO_LONG', 'A palavra "' + e.display + '" tem ' + e.clean.length + ' letras e não cabe em uma matriz ' + size + '×' + size + '.', { word: e.display });
      if (seen[e.clean]) throw new PuzzleError('DUPLICATE', 'A palavra "' + e.display + '" está repetida.', { word: e.display });
      seen[e.clean] = true; total += e.clean.length;
    });
    if (total > size * size) {
      throw new PuzzleError('TOO_DENSE', 'As palavras somam ' + total + ' letras, mais do que as ' + (size * size) + ' células de uma matriz ' + size + '×' + size + '.', { letters: total });
    }

    var t0 = now(), budget = opts.timeBudgetMs || 1500, maxRestarts = opts.maxRestarts || 150;
    var result = null, failedWord = null, attempts = 0, fails = 0, improve = 0;
    while (attempts < maxRestarts) {
      var bias = fails < 8 ? 0 : Math.min(6, (fails - 7) * 0.4);   // só aumenta a densidade se houver falhas
      var order = shuffle(entries, rng).sort(function (a, b) { return b.clean.length - a.clean.length; });
      var r = tryPlace(order, size, dirs, rng, bias);
      attempts++;
      if (r.ok) {
        // Preenche e conta ocorrências "extras" (palavra que aparece por acaso em outro lugar). Se houver,
        // tenta mais algumas disposições e fica com a que tiver menos ambiguidade (palavras curtas, como "FÉ").
        r.extras = fillAndClean(r.grid, size, r.placements, rng);
        if (!result || r.extras < result.extras) result = r;
        if (result.extras === 0 || ++improve >= 20 || now() - t0 > budget) break;
      } else {
        fails++; failedWord = r.failed;
        if (attempts >= 12 && now() - t0 > budget) break;
      }
    }
    if (!result) {
      throw new PuzzleError('PLACEMENT_FAILED',
        'Não foi possível posicionar todas as palavras (por exemplo "' + failedWord.display + '") na matriz ' + size + '×' + size +
        ' com as direções escolhidas. Aumente o tamanho da matriz, reduza a quantidade de palavras ou ative mais direções.',
        { word: failedWord.display, attempts: attempts });
    }
    var extras = result.extras;

    // Ordem final de exibição: a do usuário (listOrder 'input') ou alfabética.
    var order2 = opts.listOrder === 'alpha' ? entries.slice().sort(compareWords) : entries.slice();
    var byClean = {};
    result.placements.forEach(function (p) { byClean[p.clean] = p; });
    var placements = order2.map(function (e, i) { var p = byClean[e.clean]; p.id = 'w' + i; return p; });
    var rows = [];
    for (var rr = 0; rr < size; rr++) rows.push(result.grid.slice(rr * size, rr * size + size).join(''));
    return { size: size, grid: rows, placements: placements, dirs: dirs, meta: { attempts: attempts, extras: extras, ms: Math.round(now() - t0) } };
  }

  /* ---------- Seleção do jogador (compara as LETRAS selecionadas, nos dois sentidos) ---------- */
  function readLine(grid, a, b) {
    var dr = b.r - a.r, dc = b.c - a.c, n = Math.max(Math.abs(dr), Math.abs(dc));
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
    var sr = Math.sign(dr), sc = Math.sign(dc), s = '';
    for (var i = 0; i <= n; i++) s += grid[a.r + sr * i].charAt(a.c + sc * i);
    return s;
  }
  function matchSelection(grid, a, b, remaining) {
    var s = readLine(grid, a, b);
    if (!s || s.length < MIN_WORD_LEN) return null;
    var rev = reverseStr(s), hit = null, i, p;
    for (i = 0; i < remaining.length; i++) {      // 1º: a posição sorteada exata
      p = remaining[i];
      var same = (p.start.r === a.r && p.start.c === a.c && p.end.r === b.r && p.end.c === b.c);
      var inv = (p.start.r === b.r && p.start.c === b.c && p.end.r === a.r && p.end.c === a.c);
      if (same || inv) return p;
    }
    for (i = 0; i < remaining.length; i++) {      // 2º: qualquer ocorrência com as mesmas letras
      p = remaining[i];
      if (p.clean === s || p.clean === rev) { hit = p; break; }
    }
    return hit;
  }

  /* ---------- Geração em lote (revista) ---------- */
  function defaultYield() { return new Promise(function (r) { setTimeout(r, 0); }); }

  async function buildBatch(cfg) {
    var rng = cfg.rng || defaultRng, yieldFn = cfg.yieldFn || defaultYield;
    var check = checkDistribution(cfg.pool.length, cfg.games, cfg.perGame, cfg.reuse);
    if (!check.ok) throw new PuzzleError(check.code, check.message, check);
    var ids = makeIds(cfg.startId, cfg.games), dealer = createDealer(cfg.pool, rng, cfg.reuse), puzzles = [], sigs = Object.create(null);
    for (var i = 0; i < cfg.games; i++) {
      if (cfg.isCancelled && cfg.isCancelled()) throw new PuzzleError('CANCELLED', 'Geração cancelada.');
      var puzzle = null, lastErr = null;
      for (var attempt = 0; attempt < 5 && !puzzle; attempt++) {
        var words = dealer.deal(cfg.perGame);
        try {
          puzzle = generatePuzzle(words, { size: cfg.size, dirs: cfg.dirs, rng: rng, listOrder: 'alpha' });
          var sig = puzzle.grid.join('');
          if (sigs[sig]) { puzzle = null; dealer.giveBack(words); continue; }   // matriz idêntica a outra: refaz
          sigs[sig] = true;
        } catch (err) {
          if (!(err instanceof PuzzleError) || (err.code !== 'PLACEMENT_FAILED' && err.code !== 'TOO_DENSE')) throw err;
          lastErr = err; puzzle = null; dealer.giveBack(words);
        }
      }
      if (!puzzle) {
        throw new PuzzleError('GAME_FAILED',
          'Não foi possível gerar o jogo ' + ids[i] + ' com estas configurações' + (lastErr && lastErr.details.word ? ' (palavra "' + lastErr.details.word + '")' : '') +
          '. Aumente o tamanho da matriz, reduza as palavras por jogo ou ative mais direções.', { id: ids[i], index: i });
      }
      puzzle.id = ids[i]; puzzle.index = i;
      puzzles.push(puzzle);
      if (cfg.onProgress) cfg.onProgress(i + 1, cfg.games);
      await yieldFn();
    }
    return puzzles;
  }

  return {
    ALPHABET: ALPHABET, MIN_WORD_LEN: MIN_WORD_LEN, MAX_WORDS_PER_PUZZLE: MAX_WORDS_PER_PUZZLE,
    MAX_GAMES: MAX_GAMES, SIZES: SIZES, DIRS: DIRS, DIR_BY_ID: DIR_BY_ID, DIR_PRESETS: DIR_PRESETS,
    PuzzleError: PuzzleError, makeRng: makeRng, shuffle: shuffle, normalizeWord: normalizeWord,
    cleanDisplay: cleanDisplay, parseWords: parseWords, rebuildText: rebuildText, buildPool: buildPool,
    sanitizeDirs: sanitizeDirs, makeIds: makeIds, checkDistribution: checkDistribution, createDealer: createDealer,
    generatePuzzle: generatePuzzle, findOccurrences: findOccurrences, readLine: readLine,
    matchSelection: matchSelection, buildBatch: buildBatch
  };
});
