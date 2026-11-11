/* 卡面：稀有度 → 边框体系；主题 → 纸色/字体；排版 → 墨迹守恒 + 基线对齐
   DOM 与 Canvas 共用同一份 spec / frameSpec */
(function (global) {
  'use strict';

  var CARD_W = 330;
  var CARD_H = 406;

  /* ── 确定性随机 ─────────────────────────────────────────── */
  function hash32(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, arr) { return arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ── 稀有度：边框架构 / 工艺 / 边距 ─────────────────────── */
  // 越高阶：层数越多、框越向内、字体越多、烫印越亮
  var RARITY = {
    1: { pad: 13, frame: 'hair',   treat: 'fill',   fonts: 1, foil: 0,    sweep: 0 },
    2: { pad: 14, frame: 'double', treat: 'fill',   fonts: 2, foil: 0,    sweep: 0 },
    3: { pad: 16, frame: 'groove', treat: 'accent', fonts: 2, foil: 0.22, sweep: 0.12 },
    4: { pad: 17, frame: 'gothic', treat: 'accent', fonts: 3, foil: 0.34, sweep: 0.26 },
    5: { pad: 19, frame: 'royal',  treat: 'accent', fonts: 3, foil: 0.46, sweep: 0.5 },
  };

  /* ── 统一风格套组：整张卡共享视觉语法，字母只做局部强调 ───── */
  var THEMES = {
    herbarium: { name: '植物标本', paper: '#e9efd9', deep: '#c6d4b0', ink: '#22331f', accent: '#6d8f3f', dark: false,
      fonts: ['garamond', 'cormorant'], texture: 'leaf',
      word: 'garamond', emblem: 'cormorant', shape: 'circle', ground: '#3f6b33', glow: '#a8e06a', letter: '#f4f7e0' },
    blueprint: { name: '蓝图档案', paper: '#d6e8f0', deep: '#a2c4d6', ink: '#0f3546', accent: '#2e7fa0', dark: false,
      fonts: ['cinzel', 'playfair'], texture: 'grid',
      word: 'cinzel', emblem: 'playfair', shape: 'diamond', ground: '#14536e', glow: '#63d9ff', letter: '#e6f7fc' },
    vermilion: { name: '朱印古册', paper: '#f6dcdc', deep: '#dfb0b4', ink: '#4a1620', accent: '#c2384c', dark: false,
      fonts: ['garamond', 'abril'], texture: 'fibers',
      word: 'playfair', emblem: 'abril', shape: 'square', ground: '#b02a41', glow: '#ff7f8f', letter: '#fde8e8' },
    nightchart: { name: '夜航星图', paper: '#1e2b4a', deep: '#0f1830', ink: '#eef1ff', accent: '#8fa6dd', dark: true,
      fonts: ['cinzel', 'playfair'], texture: 'stars',
      word: 'cinzel', emblem: 'cinzel', shape: 'ring', ground: '#1a2a5c', glow: '#93b4ff', letter: '#f0f4ff' },
    blackletter: { name: '黑金秘典', paper: '#251a33', deep: '#120b1e', ink: '#f0e2b8', accent: '#d7ab48', dark: true,
      fonts: ['fraktur', 'cinzel', 'abril'], texture: 'grain',
      word: 'cinzel', emblem: 'fraktur', shape: 'shield', ground: '#2b1640', glow: '#ffcc55', letter: 'gold' },
    vellum: { name: '羊皮书页', paper: '#f6ecd2', deep: '#e0cda2', ink: '#3a2a17', accent: '#a3762f', dark: false,
      fonts: ['cormorant', 'garamond', 'playfair'], texture: 'paper',
      word: 'cormorant', emblem: 'garamond', shape: 'arch', ground: '#8a5a22', glow: '#ffd385', letter: '#fdf3dc' },
    sakura: { name: '樱笺物语', paper: '#fde3ee', deep: '#f2bfd5', ink: '#5c1a3a', accent: '#dd5c96', dark: false,
      fonts: ['cormorant', 'playfair'], texture: 'paper',
      word: 'cormorant', emblem: 'playfair', shape: 'circle', ground: '#c73f7e', glow: '#ff9ecb', letter: '#fff0f6' },
    lavender: { name: '紫藤信笺', paper: '#e9e0fb', deep: '#cbb8ef', ink: '#301a52', accent: '#8a5fd6', dark: false,
      fonts: ['playfair', 'cormorant'], texture: 'stars',
      word: 'playfair', emblem: 'cormorant', shape: 'diamond', ground: '#6a3fb5', glow: '#c9a4ff', letter: '#f6efff' },
    coral: { name: '珊瑚食谱', paper: '#ffe4d3', deep: '#f5bfa2', ink: '#5a2410', accent: '#e0622f', dark: false,
      fonts: ['abril', 'garamond'], texture: 'fibers',
      word: 'abril', emblem: 'garamond', shape: 'square', ground: '#c74a1e', glow: '#ffa271', letter: '#fff1e6' },
    aqua: { name: '碧水手记', paper: '#d7f2ec', deep: '#a6dbd2', ink: '#0c3a36', accent: '#279083', dark: false,
      fonts: ['cormorant', 'cinzel'], texture: 'waves',
      word: 'cormorant', emblem: 'cinzel', shape: 'circle', ground: '#157067', glow: '#6ff0dd', letter: '#e8fffb' },
    rosewood: { name: '檀木词录', paper: '#5a2c2c', deep: '#33161a', ink: '#f6dfc8', accent: '#d99a5e', dark: true,
      fonts: ['playfair', 'cinzel'], texture: 'grain',
      word: 'playfair', emblem: 'cinzel', shape: 'shield', ground: '#4a1f24', glow: '#ffb373', letter: 'gold' },
  };
  var TAG_THEME = {
    nature: 'herbarium', light: 'aqua', sound: 'nightchart', feeling: 'sakura',
    time: 'lavender', place: 'vellum', people: 'rosewood', motion: 'blueprint',
    rare: 'blackletter', study: 'blueprint', tech: 'aqua', body: 'herbarium',
    food: 'coral', object: 'vellum', sky: 'nightchart', beast: 'herbarium',
  };

  /* ── 配色微调 ───────────────────────────────────────────── */
  function hexToHsl(hex) {
    var n = hex.replace('#', '');
    if (n.length === 3) n = n[0] + n[0] + n[1] + n[1] + n[2] + n[2];
    var r = parseInt(n.slice(0, 2), 16) / 255, g = parseInt(n.slice(2, 4), 16) / 255, b = parseInt(n.slice(4, 6), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    function f(n) {
      var k = (n + h / 30) % 12;
      var a = s * Math.min(l, 1 - l);
      var c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
      return Math.round(255 * c).toString(16).padStart(2, '0');
    }
    return '#' + f(0) + f(8) + f(4);
  }
  function tint(hex, dh, dl, ds) {
    if (!hex || hex.charAt(0) !== '#') return hex;
    var p = hexToHsl(hex);
    return hslToHex(p[0] + dh, p[1] + (ds || 0), p[2] + dl);
  }
  function hexA(hex, a) {
    if (!hex || hex.charAt(0) !== '#') return hex;
    var n = hex.replace('#', '');
    if (n.length === 3) n = n[0] + n[0] + n[1] + n[1] + n[2] + n[2];
    return 'rgba(' + parseInt(n.slice(0, 2), 16) + ',' + parseInt(n.slice(2, 4), 16) + ',' +
      parseInt(n.slice(4, 6), 16) + ',' + a + ')';
  }

  /* ── 主题解析 ───────────────────────────────────────────── */
  function themedFor(word) {
    var tier = word.tier || 1;
    var r = rng(hash32(word.w + ':th' + tier));
    var base = THEMES[TAG_THEME[word.tag] || 'vellum'];
    var dh = (r() - 0.5) * 34;
    var dl = (r() - 0.5) * 0.03;
    return {
      id: base.name, key: TAG_THEME[word.tag] || 'vellum', dark: base.dark,
      paper: tint(base.paper, dh, dl),
      deep: tint(base.deep, dh, dl - 0.015),
      ink: base.ink,
      accent: tint(base.accent, dh * 1.4, base.dark ? 0.01 : -0.015, base.dark ? 0.05 : 0.03),
      fonts: base.fonts, texture: base.texture,
      word: base.word, emblem: base.emblem, shape: base.shape,
      ground: base.ground, glow: base.glow, letter: base.letter,
      caseType: base.dark ? 'upper' : 'lower',
      round: r() * 1000,
    };
  }

  // 每个字体的"字高"（大写字高），用于跨字体光学对齐
  var OPT = {};
  (function () {
    var probe = 'OENMHRASDLCUTPG';
    for (var id in global.GLYPHS) {
      var set = global.GLYPHS[id];
      if (!set || !set.glyphs) continue;
      var hs = [];
      for (var i = 0; i < probe.length; i++) {
        var g = set.glyphs[probe[i]];
        if (g && g.b) hs.push(g.b);
      }
      if (!hs.length) continue;
      hs.sort(function (a, b) { return a - b; });
      OPT[id] = hs[Math.floor(hs.length / 2)] || 700;
    }
  })();

  function applyCase(w, c) {
    if (c === 'upper') return w.toUpperCase();
    return w.toLowerCase();
  }

  /* ── 逐字字体 / 处理 ───────────────────────────────────── */
  function lettersFor(word, th, tier) {
    var R = RARITY[tier] || RARITY[1];
    var txt = word.w.toUpperCase();
    var n = txt.length;
    var out = [];
    var accentIdx = R.treat === 'accent' ? null : -1;
    var r0 = rng(hash32(word.w + ':lead' + tier));
    accentIdx = R.treat === 'accent' ? (n > 4 && r0() < 0.34 ? 1 + Math.floor(r0() * (n - 2)) : 0) : -1;
    var outlineIdx = tier >= 5 && n > 5 ? n - 2 : -1;

    var fontId = global.GLYPHS[th.word] ? th.word : 'garamond';
    var set = global.GLYPHS[fontId];
    for (var i = 0; i < n; i++) {
      var ch = txt[i];
      var g = set.glyphs[ch] || set.glyphs[ch.toUpperCase()] || set.glyphs['E'];
      if (!g) continue;
      var treat = 'fill';
      if (i === accentIdx) treat = th.dark ? 'gold' : 'rubric';
      if (i === outlineIdx) treat = 'outline';
      out.push({ ch: ch, fontId: fontId, set: set, g: g, treat: treat });
    }
    return out;
  }

  /* ── 稀有度：词库标注的学习价值，不由词长推导 ───────────── */
  function rarityOf(word) {
    if (word.hid) return 5;
    var t = typeof word.rarity === 'number' ? word.rarity :
      typeof word.tier === 'number' ? word.tier : 1;
    return Math.max(1, Math.min(5, Math.round(t)));
  }

  /* ── 文本测量与断行（中文按字、英文按词）────────────────── */
  var _mctx = null;
  function mctx() {
    if (!_mctx) {
      var cv = document.createElement('canvas');
      _mctx = cv.getContext('2d');
    }
    return _mctx;
  }
  var FONT_CN = '400 22px "Songti SC", "Noto Serif CJK SC", serif';
  var FONT_CN_SM = '400 19px "Songti SC", "Noto Serif CJK SC", serif';
  var FONT_EN = 'italic 14px Georgia, serif';
  var FONT_EXCN = '400 12.5px "Songti SC", "Noto Serif CJK SC", serif';

  function splitLines(text, font, maxW, cjk, maxLines) {
    var c = mctx();
    c.font = font;
    text = String(text || '');
    if (!text) return [''];
    var words = cjk ? text.split('') : text.split(/\s+/);
    var lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var tryS = cjk ? cur + words[i] : (cur ? cur + ' ' + words[i] : words[i]);
      if (c.measureText(tryS).width > maxW && cur) {
        lines.push(cur);
        cur = words[i];
        if (lines.length >= maxLines) { cur = ''; break; }
      } else cur = tryS;
    }
    if (cur) lines.push(cur);
    if (!lines.length) lines = [''];
    if (lines.length > maxLines) lines = lines.slice(0, maxLines);
    // 末行溢出加省略号
    var last = lines[lines.length - 1];
    if (c.measureText(last).width > maxW) {
      while (last.length > 1 && c.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      lines[lines.length - 1] = last + '…';
    }
    return lines;
  }

  /* ── 版面 ───────────────────────────────────────────────── */
  function sizeFor(n) {
    return Math.min(74, 132 / Math.sqrt(n));
  }

  var HERO_H = 94;      // 主词区高度
  var TRACK = 0.012;    // 字距（em）

  // 主词：混合字体、按字高归一化、自动缩放至撑满宽度
  function heroLayout(letters, availW) {
    var maxPx = HERO_H / 0.71;
    function K(list) {
      var k = 0;
      for (var i = 0; i < list.length; i++) {
        var st = list[i];
        k += 0.71 * ((st.g.a || st.g.w) / (OPT[st.fontId] || 700));
      }
      return k + TRACK * (list.length - 1);
    }
    function fit(list) { return availW / Math.max(0.001, K(list)); }

    var rows = [letters];
    var px = fit(letters);

    // 长词放不下就均衡分两行
    if ((px < 26 && letters.length >= 10) || px < 15) {
      var half = Math.ceil(letters.length / 2);
      rows = [letters.slice(0, half), letters.slice(half)];
      px = Math.min(fit(rows[0]), fit(rows[1]));
    }
    px = Math.max(19, Math.min(maxPx, px));

    var out = [];
    var lh = px * 1.18;
    var totalH = rows.length * px * 0.71 + (rows.length - 1) * (lh - px * 0.71);
    var firstBase = HERO_H / 2 - totalH / 2 + px * 0.71;

    for (var r = 0; r < rows.length; r++) {
      var list = rows[r];
      var sc = [], wsum = 0;
      for (var i = 0; i < list.length; i++) {
        var s1 = (0.71 * px) / (OPT[list[i].fontId] || 700);
        sc.push(s1);
        wsum += (list[i].g.a || list[i].g.w) * s1;
      }
      wsum += TRACK * px * (list.length - 1);
      var x = (CARD_W - wsum) / 2;
      var base = firstBase + r * lh;

      for (var j = 0; j < list.length; j++) {
        var st = list[j], s2 = sc[j];
        out.push({
          st: st, x: x + (st.g.l || 0) * s2, base: base,
          sc: s2, gw: st.g.w * s2, gh: st.g.h * s2, lead: st.g.b * s2,
        });
        x += (st.g.a || st.g.w) * s2 + TRACK * px;
      }
    }
    return { px: px, rows: rows.length, items: out };
  }

  var TEXT_TOP = 178, TEXT_BOT = 336;

  function buildText(cn, ex, exCn, cnPx, maxW) {
    var cnFont = cnPx > 20 ? FONT_CN : FONT_CN_SM;
    var cnLh = 28, exLh = 20, exCnLh = 18;
    var cnLines = splitLines(cn, cnFont, maxW, true, 2);
    var exLines = splitLines(ex, FONT_EN, maxW - 6, false, 3);
    var exCnLines = splitLines(exCn, FONT_EXCN, maxW - 6, true, 2);

    var h = cnLines.length * cnLh + 18 + exLines.length * exLh + 9 + exCnLines.length * exCnLh;
    var y = TEXT_TOP + Math.max(0, (TEXT_BOT - TEXT_TOP - h) / 2);

    var cnTop = y;
    y += cnLines.length * cnLh + 18;
    var exTop = y;
    y += exLines.length * exLh + 9;
    var exCnTop = y;

    return {
      cn: { lines: cnLines, top: cnTop, lh: cnLh, px: cnPx },
      ex: { lines: exLines, top: exTop, lh: exLh, px: 14 },
      exCn: { lines: exCnLines, top: exCnTop, lh: exCnLh, px: 12.5 },
    };
  }

  function spec(word) {
    var tier = rarityOf(word);
    var R = RARITY[tier];
    var th = themedFor({ w: word.w, tier: tier, tag: word.tag });
    var letters = lettersFor({ w: word.w, tier: tier }, th, tier);
    var contentW = CARD_W - R.pad * 2;
    var hero = heroLayout(letters, contentW - 10);

    var senses0 = word.senses && word.senses.length ? word.senses : null;
    var exs0 = word.exs && word.exs.length ? word.exs : null;
    var cnText = senses0 ? senses0.map(function (x) { return x.cn; }).join('；') : (word.cn || '');
    var exText = exs0 ? exs0[0].en : (word.ex || '');
    var exCnText = exs0 ? exs0[0].cn : (word.exCn || '');
    var cnPx = cnText.length > 18 ? 19 : 22;
    var text = buildText(cnText, exText, exCnText, cnPx, contentW - 26);

    return {
      theme: th, rarity: R, tier: tier, letters: letters, hero: hero, text: text,
      pad: R.pad, contentW: contentW, heroTop: 46,
      hdTop: R.pad + 5,
      phBase: 150, ruleY: 167,
      cnBase: 195, cnLh: 27,
      exBase: 249, exLh: 19,
      exCnBase: 299, exCnLh: 17.5,
      statY: 344, footY: 376,
      serial: 'No.' + (100 + (hash32(word.w) % 900)),
      word: word.w,
      raw: word.w,
      cardW: CARD_W, cardH: CARD_H,
    };
  }

  /* ── 真实字形排版（可读单词用矢量衬线，跨设备一致）───────── */
  function typeSVG(text, fontId, px, color, tracking) {
    var set = global.GLYPHS[fontId] || global.GLYPHS.garamond;
    var upm = set.upm;
    var sc = px / upm;
    var tr = (tracking || 0) * px;
    var pen = 0, parts = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var g = set.glyphs[ch] || set.glyphs[ch.toUpperCase()] || set.glyphs['e'];
      if (!g) continue;
      var gx = pen + (g.l || 0) * sc;
      parts.push('<g transform="translate(' + gx.toFixed(2) + ',0)"><path d="' + g.d + '" fill="' + color + '"/></g>');
      pen += (g.a || g.w) * sc + tr;
    }
    var width = Math.max(0, pen - tr);
    return {
      width: width,
      svg: '<svg width="' + width.toFixed(2) + '" height="' + (px * 1.0).toFixed(2) +
        '" viewBox="0 0 ' + (upm * (width / px)).toFixed(1) + ' ' + upm +
        '" preserveAspectRatio="none" style="display:block;overflow:visible"></svg>',
    };
  }

  // 直接返回包装好的 svg 字符串（含垂直居中于 px 高度）
  function wordSVG(text, fontId, px, color, tracking) {
    var set = global.GLYPHS[fontId] || global.GLYPHS.garamond;
    var upm = set.upm, sc = px / upm, tr = (tracking || 0) * px;
    var pen = 0, parts = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var g = set.glyphs[ch] || set.glyphs[ch.toUpperCase()] || set.glyphs['e'];
      if (!g) continue;
      parts.push('<g transform="translate(' + (pen + (g.l || 0) * sc).toFixed(2) + ',0)">' +
        '<path d="' + g.d + '" fill="' + color + '"/></g>');
      pen += (g.a || g.w) * sc + tr;
    }
    var width = Math.max(1, pen - tr);
    var asc = px * 0.78, desc = px * 0.26;
    return '<svg width="' + width.toFixed(2) + '" height="' + (asc + desc).toFixed(2) +
      '" viewBox="0 ' + (-asc * upm / px).toFixed(1) + ' ' + upm + ' ' + ((asc + desc) * upm / px).toFixed(1) +
      '" style="display:block;overflow:visible">' + parts.join('') + '</svg>';
  }

  /* ── 边框：一份数据，DOM 与 Canvas 共用 ─────────────────── */
  // 平面几何角饰，随稀有度叠层：单线 → 双线+角标 → 三线+菱角 → 嵌套括号 → 全套徽记
  function frameSpec(tier, th) {
    var a = th.accent, i = th.ink;
    var rects = [], paths = [], fills = [];
    var off = RARITY[tier].pad - 4;

    function rect(inset, w, c) { rects.push({ inset: inset, w: w, c: c }); }
    function four(d, w, c, at) {
      var o = at === undefined ? off : at;
      [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (m) {
        paths.push({ d: d, t: [m[0], m[1], o], c: c, w: w });
      });
    }
    function centre(d, c, w) { paths.push({ d: d, t: null, c: c, w: w }); }
    function sideDots(r, c) {
      fills.push({ d: dpoly(off, CARD_H / 2, r), t: null, c: c });
      fills.push({ d: dpoly(CARD_W - off, CARD_H / 2, r), t: null, c: c });
    }
    function fill(d) { fills.push({ d: d, t: null, c: hexA(a, 0.85) }); }
    function cornerDots(r, at) {
      var o = at === undefined ? off : at;
      [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (m) {
        fills.push({ d: dpoly(o + 7, o + 7, r), t: [m[0], m[1], 0], c: hexA(a, 0.85) });
      });
    }

    if (tier === 1) {
      rect(off, 0.9, hexA(i, 0.26));
    } else if (tier === 2) {
      rect(off, 1.0, hexA(i, 0.34));
      rect(off + 3.5, 0.55, hexA(a, 0.36));
      four(bracket(12), 1.1, hexA(a, 0.7));
    } else if (tier === 3) {
      rect(off, 1.1, hexA(a, 0.5));
      rect(off + 3.5, 0.7, hexA(a, 0.3));
      rect(off + 6.5, 0.45, hexA(a, 0.15));
      four(bracket(26), 1.1, hexA(a, 0.72));
      sideDots(2.6, hexA(a, 0.8));
    } else if (tier === 4) {
      rect(off, 1.4, hexA(a, 0.62));
      rect(off + 4, 0.8, hexA(a, 0.34));
      rect(off + 7.5, 0.45, hexA(a, 0.16));
      four(bracket(30), 1.2, hexA(a, 0.85));
      four(bracket(20, 6), 0.7, hexA(a, 0.5));
      sideDots(3.0, hexA(a, 0.9));
      centre(bandCrest(), hexA(a, 0.9), 1.1);
    } else {
      rect(off, 1.6, hexA(a, 0.78));
      rect(off + 4.5, 1.0, hexA(a, 0.45));
      rect(off + 8.5, 0.6, hexA(a, 0.24));
      rect(off + 11.5, 0.4, hexA(a, 0.14));
      four(bracket(34), 1.3, hexA(a, 0.95));
      four(bracket(23, 7), 0.8, hexA(a, 0.6));
      four(bracket(12, 14), 0.5, hexA(a, 0.34));
      sideDots(3.4, hexA(a, 1));
      centre(bandCrest(), hexA(a, 1), 1.2);
      centre(rosette(CARD_W / 2, CARD_H - 21, 4.4), hexA(a, 0.85), 0.6);
    }
    return { rects: rects, paths: paths, fills: fills };
  }

  // 角部直角括号：原点在内框角点，向卡片内侧伸 len
  function bracket(len, gap) {
    var g = gap || 0;
    return 'M' + g + ' ' + (g + len) + 'V' + g + 'H' + (g + len);
  }
  function dpoly(x, y, r) {
    return 'M' + x + ' ' + (y - r) + 'L' + (x + r) + ' ' + y + 'L' + x + ' ' + (y + r) +
      'L' + (x - r) + ' ' + y + 'Z';
  }
  function lozenge(cx, cy, r) {
    return 'M' + cx + ' ' + (cy - r) + 'L' + (cx + r * 0.62) + ' ' + cy + 'L' + cx + ' ' + (cy + r) +
      'L' + (cx - r * 0.62) + ' ' + cy + 'Z';
  }
  function bandCrest() {
    var cy = CARD_H - 8, cx = CARD_W / 2;
    return 'M' + (cx - 16) + ' ' + cy + 'h8M' + (cx + 8) + ' ' + cy + 'h8' +
      dpoly(cx, cy, 3.4);
  }
  function rosette(cx, cy, r) {
    var s = '';
    for (var i = 0; i < 8; i++) {
      var ang = (i * Math.PI) / 4;
      s += 'M' + cx + ' ' + cy + 'L' + (cx + Math.cos(ang) * r).toFixed(2) + ' ' +
        (cy + Math.sin(ang) * r).toFixed(2);
    }
    return s;
  }

  function transformOf(t) {
    if (!t) return '';
    var sx = t[0], sy = t[1], off = t[2] || 0;
    if (sy > 0 && t[1] === 1) {
      // 左上
      return 'translate(' + off + ',' + off + ') scale(' + sx + ',' + (t[1] * 1) + ')';
    }
    return '';
  }

  // 四角镜像矩阵（绝对坐标下）
  function cornerMatrix(t, W, H) {
    var sx = t[0], sy = t[1], off = t[2] || 0;
    var tx = sx > 0 ? off : W - off;
    var ty = sy > 0 ? off : H - off;
    return 'translate(' + tx.toFixed(2) + ',' + ty.toFixed(2) + ') scale(' + sx + ',' + sy + ')';
  }

  function frameHTML(tier, th) {
    var fs = frameSpec(tier, th);
    var out = '';
    fs.rects.forEach(function (r) {
      out += '<span class="fr" style="inset:' + r.inset + 'px;border-width:' + r.w +
        'px;border-color:' + r.c + '"></span>';
    });
    var paths = '', fills = '';
    fs.paths.forEach(function (p) {
      var tr = p.t ? ' transform="' + cornerMatrix(p.t, CARD_W, CARD_H) + '"' : '';
      paths += '<path d="' + p.d + '" fill="none" stroke="' + p.c + '" stroke-width="' + p.w +
        '" stroke-linecap="round" stroke-linejoin="round"' + tr + '/>';
    });
    fs.fills.forEach(function (f) {
      var tr = f.t ? ' transform="' + cornerMatrix(f.t, CARD_W, CARD_H) + '"' : '';
      fills += '<path d="' + f.d + '" fill="' + f.c + '"' + tr + '/>';
    });
    out += '<svg class="fr-svg" viewBox="0 0 ' + CARD_W + ' ' + CARD_H + '">' + paths + fills + '</svg>';
    return out;
  }

  /* ── 烫印层 ─────────────────────────────────────────────── */
  function foilStops(tier, th) {
    if (tier === 3) return ['rgba(232,240,250,.55)', 'rgba(160,182,204,.18)', 'rgba(232,240,250,.42)'];
    if (tier === 4) return ['rgba(255,246,214,.6)', 'rgba(201,162,39,.16)', 'rgba(255,246,214,.5)'];
    return ['rgba(255,214,232,.5)', 'rgba(196,176,255,.22)', 'rgba(255,238,196,.5)'];
  }

  /* ── 瓦片 ───────────────────────────────────────────────── */
  function tileBG(st, th, tier) {
    if (st.treat === 'rubric') return th.accent;
    if (st.treat === 'gold') return hexA(th.accent, th.dark ? 0.1 : 0.06);
    if (st.treat === 'outline') return 'transparent';
    var a = 0.022 + tier * 0.015;
    return th.dark ? hexA('#ffffff', a) : hexA(th.ink, a);
  }

  function tileBorderColor(st, th, tier) {
    if (st.treat === 'rubric') return hexA(th.accent, 0.95);
    if (st.treat === 'outline') return 'transparent';
    if (tier <= 1) return 'transparent';
    return hexA(th.accent, 0.08 + tier * 0.06);
  }

  function tileShadow(st, th) {
    if (st.treat === 'rubric') return '0 2px 6px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.18)';
    if (st.treat === 'outline') return 'none';
    return th.dark
      ? '0 1px 3px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.07)'
      : '0 1px 3px rgba(90,68,38,.16), inset 0 1px 0 rgba(255,255,255,.6)';
  }

  function tileBorderWidth(tier) {
    return tier <= 1 ? 0 : tier <= 3 ? 0.7 : 1.1;
  }

  function glyphSVG(st, tile, th) {
    var upm = st.set.upm;
    var capH = OPT[st.fontId] || 700;
    var sc = (tile.size * 0.60) / capH;
    var gw = st.g.w * sc, gh = st.g.h * sc;
    var left = tile.size / 2 - gw / 2;
    var top = tile.baseline - tile.top - st.g.b * sc;
    var fill, extra = '';
    if (st.treat === 'rubric') fill = th.paper;
    else if (st.treat === 'gold') fill = 'url(#au' + th.round + '_' + tile.size.toFixed(0) + ')';
    else if (st.treat === 'outline') { fill = 'none'; }
    else fill = th.ink;

    var body;
    if (st.treat === 'outline') {
      body = '<path d="' + st.g.d + '" fill="none" stroke="' + th.ink + '" stroke-width="' +
        ((tile.size * 0.05) / sc).toFixed(1) + '" stroke-linejoin="round"/>';
    } else if (st.treat === 'gold') {
      body = '<path d="' + st.g.d + '" fill="' + fill + '"/>' +
        '<path d="' + st.g.d + '" fill="none" stroke="rgba(255,248,220,.4)" stroke-width="' +
        ((tile.size * 0.018) / sc).toFixed(1) + '"/>';
    } else {
      body = '<path d="' + st.g.d + '" fill="' + fill + '"/>';
    }
    return '<span class="gl" style="left:' + left.toFixed(2) + 'px;top:' + top.toFixed(2) +
      'px;width:' + gw.toFixed(2) + 'px;height:' + gh.toFixed(2) + 'px">' +
      '<svg viewBox="0 0 ' + st.g.w + ' ' + st.g.h + '" width="' + gw.toFixed(2) + '" height="' +
      gh.toFixed(2) + '" style="display:block;overflow:visible">' +
      (st.treat === 'gold' ? '<defs><linearGradient id="au' + th.round + '_' + tile.size.toFixed(0) +
        '" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#f8e8b4"/>' +
        '<stop offset=".3" stop-color="#d4ac3a"/><stop offset=".55" stop-color="#8f6d16"/>' +
        '<stop offset=".8" stop-color="#e8cc72"/><stop offset="1" stop-color="#a8851c"/>' +
        '</linearGradient></defs>' : '') + body + '</svg></span>';
  }

  /* ── 属性：由词本身推出，可解释 ────────────────────────── */
  // 字母等级上限由单词稀有度决定，升级无法突破
  var LV_CAP = { 1: 3, 2: 3, 3: 4, 4: 4, 5: 5 };
  function levelCap(word) { return LV_CAP[rarityOf(word)] || 3; }
  function cardLevel(word, levels) {
    var n = word.w.length, lv = 99;
    for (var i = 0; i < n; i++) lv = Math.min(lv, (levels && levels[i]) || 1);
    return lv === 99 ? 1 : lv;
  }
  function statsOf(word, levels) {
    var n = word.w.length;
    var str = Math.max(1, Math.ceil(n / 2));
    var posW = { n: 2, v: 3, adj: 3, adv: 4 }[word.pos] || 2;
    var wis = posW + rarityOf(word) + (word.tag === 'rare' ? 2 : 0);
    var syl = Math.max(1, (word.w.match(/[aeiouy]+/g) || []).length);
    var res = syl + Math.floor(rarityOf(word) / 2);
    var k = 1 + 0.25 * (cardLevel(word, levels) - 1);
    return { str: Math.round(str * k), wis: Math.round(wis * k), res: Math.round(res * k) };
  }

  /* ── 主词渲染 ───────────────────────────────────────────── */
  function heroHTML(sp, th) {
    var out = '';
    for (var i = 0; i < sp.hero.items.length; i++) {
      var it = sp.hero.items[i], st = it.st;
      var fill;
      if (st.treat === 'rubric') fill = th.paper;
      else if (st.treat === 'gold') fill = 'url(#hg' + th.round + ')';
      else fill = th.ink;

      var body;
      if (st.treat === 'outline') {
        body = '<path d="' + st.g.d + '" fill="none" stroke="' + th.ink + '" stroke-width="' +
          (1.6 / it.sc).toFixed(2) + '"/>';
      } else {
        body = '<path d="' + st.g.d + '" fill="' + fill + '"/>';
      }
      out += '<span class="hg" style="left:' + it.x.toFixed(2) + 'px;top:' + (it.base - it.lead).toFixed(2) +
        'px;width:' + it.gw.toFixed(2) + 'px;height:' + it.gh.toFixed(2) + 'px">' +
        '<svg viewBox="0 0 ' + st.g.w + ' ' + st.g.h + '" width="' + it.gw.toFixed(2) + '" height="' +
        it.gh.toFixed(2) + '">' + body + '</svg></span>';
    }
    return out;
  }

  /* ── DOM 渲染 ───────────────────────────────────────────── */
  /* ── 战斗属性：字母 → 弹种（卡面与漫游共用）──────────────── */
  var KINDS = {
    shield:  { nm: '卫星', c: '#5fe0a0', shot: '环绕字母卫星', tip: '字母卫星环绕撞敌，每颗挡一发后要充能，大弹挡不住；开局自带 1 层护盾' },
    blast:   { nm: '散弹', c: '#ff8a3d', shot: '扇形霰弹', tip: '扇形散射，贴近敌人伤害翻倍，远了很弱' },
    frost:   { nm: '冰霜', c: '#7fd8ff', shot: '冰锥减速', tip: '冰锥让敌人减速、击杀时碎裂溅射，全场敌弹变慢' },
    pierce:  { nm: '激光', c: '#ff5fa2', shot: '贯穿光束', tip: '一道直线光束贯穿整列，伤害最高，但要对准' },
    swift:   { nm: '追踪', c: '#ffd84d', shot: '追踪飞弹', tip: '飞弹自动找敌人，不用瞄准，单发较弱' },
    thunder: { nm: '雷电', c: '#b38cff', shot: '连锁闪电', tip: '自动劈最近的敌人并连锁跳跃，弹药等级越高射程越远、分叉越多' },
    tide:    { nm: '潮汐', c: '#4fd6e8', shot: '波动水弹', tip: '水弹摆动前进，命中炸开水花溅射周围并冲散敌弹，清场与保命兼备' },
    blade:   { nm: '飞刃', c: '#ff7ae0', shot: '回旋飞刃', tip: '旋转飞刃贯穿敌人后回旋下落，单发能打多个目标' },
  };
  // 卡片没有单一"类型"：取字母里出现最多的一种作为主倾向，平局取靠前的字母
  function dominantKind(word) {
    var s = String((word && word.w) || ''), cnt = {}, max = 0, i;
    for (i = 0; i < s.length; i++) {
      var k = letterKind(s[i]);
      // 元音太常见，权重减半，否则大半卡牌都会是护盾
      cnt[k] = (cnt[k] || 0) + (k === 'shield' ? 0.5 : 1);
      if (cnt[k] > max) max = cnt[k];
    }
    for (i = 0; i < s.length; i++) {
      var kk = letterKind(s[i]);
      if (cnt[kk] === max) return kk;
    }
    return 'blast';
  }
  // 次武器：去掉主倾向后占比最高的属性；单一属性的词没有次武器
  function secondKind(word) {
    var s = String((word && word.w) || ''), main = dominantKind(word), cnt = {}, best = null, max = 0, i;
    for (i = 0; i < s.length; i++) {
      var k = letterKind(s[i]);
      if (k === main) continue;
      cnt[k] = (cnt[k] || 0) + (k === 'shield' ? 0.5 : 1);
    }
    for (i = 0; i < s.length; i++) {
      var kk = letterKind(s[i]);
      if (cnt[kk] > max) { max = cnt[kk]; best = kk; }
    }
    return best;
  }
  // 主 / 副武器只由「字母构成（数量）」决定，与字母等级无关：
  // 升级不会把玩家养好的武器换掉，也不会让某条词条突然失效。
  function kindOrder(word) {
    var s = String((word && word.w) || ''), cnt = {}, order = [], dom = dominantKind(word), i;
    for (i = 0; i < s.length; i++) {
      var k = letterKind(s[i]);
      if (cnt[k] === undefined) { cnt[k] = 0; order.push(k); }
      cnt[k] += (k === 'shield' ? 0.5 : 1);
    }
    return order.slice().sort(function (a, b) {
      return (cnt[b] - cnt[a]) || ((b === dom) - (a === dom)) || (order.indexOf(a) - order.indexOf(b));
    });
  }
  function weaponKinds(word, levels) {
    var s = String((word && word.w) || ''), cnt = {}, tot = {}, order = kindOrder(word), i;
    for (i = 0; i < s.length; i++) {
      var k = letterKind(s[i]), lv = (levels && levels[i]) || 1;
      cnt[k] = (cnt[k] || 0) + 1;
      tot[k] = (tot[k] || 0) + lv;
    }
    // 弹药等级仍取该类字母的平均等级（只影响主 / 副武器的弹道与射速）
    var ammo = {};
    for (var k2 in cnt) ammo[k2] = Math.max(1, Math.round(tot[k2] / cnt[k2]));
    return { main: order[0] || 'blast', sub: order[1] || null, aux: order.slice(2), ammo: ammo };
  }
  // 每个字母的角色：main 主武器 / sub 副武器 / aux 通用（不参战，但提供通用词条）
  function letterRoles(word) {
    var order = kindOrder(word), main = order[0], sub = order[1] || null;
    var seen = {};
    return String((word && word.w) || '').toUpperCase().split('').map(function (ch) {
      var k = letterKind(ch);
      var role = k === main ? 'main' : (sub && k === sub ? 'sub' : 'aux');
      // 同一属性的重复字母不再重复生成同一种武器词条，后续转为共鸣。
      if (role !== 'aux') {
        if (seen[k]) role = 'resonance';
        seen[k] = true;
      }
      return role;
    });
  }
  function letterKind(ch) {
    ch = String(ch || '').toUpperCase();
    if ('AEIOU'.indexOf(ch) >= 0) return 'shield';
    if ('RPGB'.indexOf(ch) >= 0) return 'blast';
    if ('SCF'.indexOf(ch) >= 0) return 'frost';
    if ('TD'.indexOf(ch) >= 0) return 'pierce';
    if ('LMZQ'.indexOf(ch) >= 0) return 'thunder';
    if ('JYV'.indexOf(ch) >= 0) return 'tide';
    if ('KXW'.indexOf(ch) >= 0) return 'blade';
    return 'swift';
  }

  /* ── 字母词条：每个字母都有自己的可解释成长效果 ───────── */
  var LETTER_TRAITS = {
    shield:  { nm: '卫星', unit: '充能时间', base: 1, step: 1, fmt: function (v) { return '-' + v + '%'; } },
    blast:   { nm: '散弹', unit: '散弹伤害', base: 2, step: 2, fmt: function (v) { return '+' + v + '%'; } },
    frost:   { nm: '冰霜', unit: '减速效果', base: 8, step: 4, fmt: function (v) { return '+' + v + '%'; } },
    pierce:  { nm: '激光', unit: '激光伤害', base: 2, step: 2, fmt: function (v) { return '+' + v + '%'; } },
    swift:   { nm: '追踪', unit: '追踪强度', base: 10, step: 5, fmt: function (v) { return '+' + v + '%'; } },
    thunder: { nm: '雷电', unit: '连锁距离', base: 24, step: 8, fmt: function (v) { return '+' + v; } },
    tide:    { nm: '潮汐', unit: '溅射范围', base: 12, step: 4, fmt: function (v) { return '+' + v; } },
    blade:   { nm: '飞刃', unit: '回旋伤害', base: 4, step: 3, fmt: function (v) { return '+' + v + '%'; } },
  };
  // 成长率与学习价值挂钩，但档差收窄，避免稀有卡数值碾压普通卡
  var GROW = { 1: 1, 2: 1.08, 3: 1.16, 4: 1.25, 5: 1.35, 6: 1.35 };
  function growOf(word) {
    var rank = word.hid ? 6 : rarityOf(Object.assign({}, word, { lvl: null }));
    return { rank: rank, rate: GROW[rank], name: rank === 6 ? '隐藏' : (window.TIERS[rank] || {}).name };
  }
  /* ── 第二层：非主 / 副类字母的通用词条 ───────────────────
     这类字母不进战斗武器，但升级仍然有真实收益，不会被浪费。 */
  var AUX_TRAITS = {
    dmg:   { unit: '主武器伤害', base: 1, step: 1, fmt: function (v) { return '+' + v + '%'; } },
    crit:  { unit: '暴击率',     base: 1, step: 1, fmt: function (v) { return '+' + v + '%'; } },
    ult:   { unit: '大招蓄力速度', base: 2, step: 2, fmt: function (v) { return '+' + v + '%'; } },
    guard: { unit: '受击无敌',   base: 2, step: 1, fmt: function (v) { return '+' + v + '%'; } },
  };
  var AUX_BY_KIND = {
    blast: 'dmg', tide: 'dmg',
    frost: 'crit', blade: 'crit',
    thunder: 'ult', swift: 'ult',
    shield: 'guard', pierce: 'guard',
  };
  function auxTraitKey(kind) { return AUX_BY_KIND[kind] || 'dmg'; }
  function letterTrait(ch, lv, g, role) {
    var kind = letterKind(ch);
    lv = Math.max(1, Math.round(lv || 1));
    g = g || 1;
    if (role === 'aux' || role === 'resonance') {
      var key = auxTraitKey(kind), a = AUX_TRAITS[key];
      var av = function (l) { return a.base + Math.round((l - 1) * a.step * g); };
      return {
        kind: kind, role: role, scope: 'aux', effect: key,
        name: role === 'resonance' ? '共鸣' : '通用', unit: a.unit, level: lv,
        base: a.base, step: a.step, grow: g,
        value: av(lv),
        text: a.unit + ' ' + a.fmt(av(lv)),
        next: a.unit + ' ' + a.fmt(av(lv + 1)),
      };
    }
    var t = LETTER_TRAITS[kind] || LETTER_TRAITS.swift;
    var val = function (l) { return t.base + Math.round((l - 1) * t.step * g); };
    return {
      kind: kind, role: role || 'main', scope: 'weapon',
      name: t.nm, unit: t.unit, level: lv,
      base: t.base, step: t.step, grow: g,
      value: val(lv),
      text: t.unit + ' ' + t.fmt(val(lv)),
      next: t.unit + ' ' + t.fmt(val(lv + 1)),
    };
  }
  function letterTraits(word, levels) {
    var g = growOf(word).rate, roles = letterRoles(word);
    return String(word && word.w || '').toUpperCase().split('').map(function (ch, i) {
      return letterTrait(ch, levels && levels[i], g, roles[i]);
    });
  }

  /* ── 首字母徽章：Initialis 式「字母 + 底形 + 纹样」，整卡唯一视觉主体 ── */
  var SHAPES = {
    circle: '<circle cx="80" cy="80" r="70"/>',
    ring: '<circle cx="80" cy="80" r="70"/>',
    diamond: '<path d="M80 6L154 80L80 154L6 80Z"/>',
    square: '<rect x="13" y="13" width="134" height="134" rx="8"/>',
    shield: '<path d="M18 14H142V82Q142 134 80 152Q18 134 18 82Z"/>',
    arch: '<path d="M16 152V74Q16 10 80 10Q144 10 144 74V152Z"/>',
    octagon: '<path d="M50 13H110L147 50V110L110 147H50L13 110V50Z"/>',
  };
  function patternDef(id, th) {
    var c = hexA(th.glow, 0.32);
    var body;
    if (th.texture === 'leaf') {
      body = '<pattern id="' + id + '" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">' +
        '<ellipse cx="11" cy="11" rx="7" ry="2.6" fill="' + c + '"/></pattern>';
    } else if (th.texture === 'grid') {
      body = '<pattern id="' + id + '" width="12" height="12" patternUnits="userSpaceOnUse">' +
        '<path d="M12 0H0V12" fill="none" stroke="' + c + '" stroke-width=".8"/></pattern>';
    } else if (th.texture === 'stars') {
      body = '<pattern id="' + id + '" width="26" height="26" patternUnits="userSpaceOnUse">' +
        '<circle cx="5" cy="7" r="1.1" fill="' + c + '"/><circle cx="18" cy="19" r=".8" fill="' + c + '"/>' +
        '<circle cx="21" cy="4" r=".6" fill="' + c + '"/></pattern>';
    } else {
      body = '<pattern id="' + id + '" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
        '<path d="M0 0V7" stroke="' + c + '" stroke-width="1.2"/></pattern>';
    }
    return body;
  }
  function emblemSVG(word, size) {
    var th = themedFor({ w: word.w, tier: rarityOf(word), tag: word.tag });
    var uid = 'e' + hash32(word.w + size).toString(36);
    var fontId = global.GLYPHS[th.emblem] ? th.emblem : 'garamond';
    var set = global.GLYPHS[fontId];
    var ch = word.w.charAt(0).toUpperCase();
    var g = set.glyphs[ch] || set.glyphs.E;
    var cap = OPT[fontId] || 700;
    var sc = 92 / cap;
    var gw = g.w * sc, gh = g.h * sc;
    var base = 80 + 92 / 2;
    var x = 80 - gw / 2, y = base - g.b * sc;
    var shape = SHAPES[th.shape] || SHAPES.circle;
    var fill = th.letter === 'gold' ? 'url(#' + uid + 'au)' : th.letter;

    var s = '<svg class="emb" viewBox="0 0 160 160" width="' + size + '" height="' + size + '">' +
      '<defs>' + patternDef(uid + 'p', th) +
      '<radialGradient id="' + uid + 'g" cx=".35" cy=".3" r=".8">' +
      '<stop offset="0" stop-color="' + tint(th.ground, 0, 0.12) + '"/>' +
      '<stop offset="1" stop-color="' + tint(th.ground, 0, -0.08) + '"/></radialGradient>' +
      '<linearGradient id="' + uid + 'au" x1="0" y1="0" x2=".3" y2="1">' +
      '<stop offset="0" stop-color="#fff2c0"/><stop offset=".35" stop-color="#e2b54a"/>' +
      '<stop offset=".6" stop-color="#94680f"/><stop offset="1" stop-color="#f0cf72"/></linearGradient>' +
      '<clipPath id="' + uid + 'c">' + shape + '</clipPath></defs>' +
      '<g fill="url(#' + uid + 'g)">' + shape + '</g>' +
      '<g clip-path="url(#' + uid + 'c)"><rect width="160" height="160" fill="url(#' + uid + 'p)"/></g>' +
      '<g fill="none" stroke="' + hexA(th.glow, 0.75) + '" stroke-width="2.4">' + shape + '</g>';
    if (th.shape === 'ring') {
      s += '<circle cx="80" cy="80" r="60" fill="none" stroke="' + hexA(th.glow, 0.4) +
        '" stroke-width="1" stroke-dasharray="2 4"/>';
    }
    s += '<svg x="' + (x + 2).toFixed(1) + '" y="' + (y + 3).toFixed(1) + '" width="' + gw.toFixed(1) +
      '" height="' + gh.toFixed(1) + '" viewBox="0 0 ' + g.w + ' ' + g.h + '" overflow="visible">' +
      '<path d="' + g.d + '" fill="rgba(0,0,0,.35)"/></svg>' +
      '<svg x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + gw.toFixed(1) +
      '" height="' + gh.toFixed(1) + '" viewBox="0 0 ' + g.w + ' ' + g.h + '" overflow="visible">' +
      '<path d="' + g.d + '" fill="' + fill + '"/></svg></svg>';
    return s;
  }

  /* ── 名牌：整词同一字体，按宽度自适应 ───────────────────── */
  function plateSVG(text, fontId, px, maxW, color) {
    var set = global.GLYPHS[fontId] || global.GLYPHS.garamond;
    var cap = OPT[fontId] || 700;
    function measure(p) {
      var sc = p / cap, tr = p * 0.06, w = 0;
      for (var i = 0; i < text.length; i++) {
        var g = set.glyphs[text[i]] || set.glyphs.E;
        w += (g.a || g.w) * sc + (i ? tr : 0);
      }
      return w;
    }
    var w = measure(px);
    if (w > maxW) { px = px * maxW / w; w = measure(px); }
    var sc = px / cap, tr = px * 0.06, pen = 0, base = px * 1.08, out = '';
    for (var i = 0; i < text.length; i++) {
      var g = set.glyphs[text[i]] || set.glyphs.E;
      out += '<svg x="' + (pen + (g.l || 0) * sc).toFixed(2) + '" y="' + (base - g.b * sc).toFixed(2) +
        '" width="' + (g.w * sc).toFixed(2) + '" height="' + (g.h * sc).toFixed(2) +
        '" viewBox="0 0 ' + g.w + ' ' + g.h + '" overflow="visible"><path d="' + g.d + '" fill="' + color + '"/></svg>';
      pen += (g.a || g.w) * sc + tr;
    }
    return '<svg class="plate-word" width="' + w.toFixed(1) + '" height="' + (px * 1.3).toFixed(1) +
      '" overflow="visible">' + out + '</svg>';
  }

  /* ── 字母瓦片：每个字母独立的字体 / 底形 / 纹样，墨色取自整卡调色板 ── */
  var TILE_FONTS = ['playfair', 'cinzel', 'garamond', 'abril', 'cormorant', 'fraktur'];
  var TILE_SHAPES = ['square', 'circle', 'arch', 'diamond', 'shield', 'octagon', 'none'];
  var TILE_PATTERNS = ['dots', 'gems', 'grid', 'cross', 'waves', 'stars', 'checker', 'scales', 'zigzag'];
  /* 光学尺寸统一：方形/菱形/八角会顶到画布四角，看起来比圆形大得多，
     所以统一收进 4–8 的内边；圆形则保持接近满幅，六种形状观感才一致 */
  var TILE_SHAPE_SVG = {
    square: '<rect x="6" y="6" width="88" height="88" rx="8"/>',
    circle: '<circle cx="50" cy="50" r="47"/>',
    arch: '<path d="M8 94V44Q8 6 50 6Q92 6 92 44V94Z"/>',
    diamond: '<path d="M50 4L96 50L50 96L4 50Z"/>',
    shield: '<path d="M9 7H91V50Q91 85 50 95Q9 85 9 50Z"/>',
    octagon: '<path d="M31 5H69L95 31V69L69 95H31L5 69V31Z"/>',
    none: '<rect x="6" y="6" width="88" height="88" rx="8"/>',
  };
  // 同一套形状的 Path2D 路径数据（canvas 战场复用，保证子弹和卡面一致）
  var SHAPE_PATH = {
    square: 'M14 6H86A8 8 0 0 1 94 14V86A8 8 0 0 1 86 94H14A8 8 0 0 1 6 86V14A8 8 0 0 1 14 6Z',
    circle: 'M3 50A47 47 0 1 1 97 50A47 47 0 1 1 3 50Z',
    arch: 'M8 94V44Q8 6 50 6Q92 6 92 44V94Z',
    diamond: 'M50 4L96 50L50 96L4 50Z',
    shield: 'M9 7H91V50Q91 85 50 95Q9 85 9 50Z',
    octagon: 'M31 5H69L95 31V69L69 95H31L5 69V31Z',
  };
  SHAPE_PATH.none = SHAPE_PATH.square;

  /* 战场用：把某字母某等级的外观抽出来（形状 / 配色 / 纹样），canvas 直接画 */
  function tileLook(ch, lv, opts) {
    opts = opts || {};
    var mythic = !!opts.mythic;
    var kind = letterKind(ch);
    var S = TYPE_STYLE[kind];
    var L = Math.max(1, Math.min(5, Math.round(lv || 1)));
    var b = S.bgs[L - 1];
    return {
      kind: kind,
      shape: S.shape,
      bg: mythic ? tint(S.bg, 0, -0.1) : S.bg,
      fg: S.fg,
      ln: S.ln,
      lv: L,
      pattern: b ? b[1] : null,
      deco: !!(b && b[0] === 'd'),
      mythic: mythic,
    };
  }
  function tilePattern(id, kind, c) {
    var open = '<pattern id="' + id + '" patternUnits="userSpaceOnUse" ';
    if (kind === 'dots') return open + 'width="10" height="10"><circle cx="5" cy="5" r="2.2" fill="' + c + '"/></pattern>';
    if (kind === 'gems') return open + 'width="14" height="14"><path d="M7 2.5L10 7L7 11.5L4 7Z" fill="' + c + '"/><circle cx="0" cy="0" r="1.2" fill="' + c + '"/><circle cx="14" cy="0" r="1.2" fill="' + c + '"/><circle cx="0" cy="14" r="1.2" fill="' + c + '"/><circle cx="14" cy="14" r="1.2" fill="' + c + '"/></pattern>';
    if (kind === 'stripes') return open + 'width="10" height="10" patternTransform="rotate(40)"><rect width="4.5" height="10" fill="' + c + '"/></pattern>';
    if (kind === 'grid') return open + 'width="12" height="12"><path d="M12 0H0V12" fill="none" stroke="' + c + '" stroke-width="1.8"/></pattern>';
    if (kind === 'cross') return open + 'width="10" height="10" patternTransform="rotate(45)"><path d="M0 5H10M5 0V10" stroke="' + c + '" stroke-width="1.6"/></pattern>';
    if (kind === 'waves') return open + 'width="20" height="10"><path d="M0 5Q5 0 10 5T20 5" fill="none" stroke="' + c + '" stroke-width="2.2"/></pattern>';
    if (kind === 'stars') return open + 'width="22" height="22"><path d="M6 1L7.4 4.6L11 5L8.2 7.4L9 11L6 9L3 11L3.8 7.4L1 5L4.6 4.6Z" fill="' + c + '"/><circle cx="17" cy="17" r="1.6" fill="' + c + '"/></pattern>';
    if (kind === 'checker') return open + 'width="16" height="16"><rect width="8" height="8" fill="' + c + '"/><rect x="8" y="8" width="8" height="8" fill="' + c + '"/></pattern>';
    if (kind === 'scales') return open + 'width="14" height="10"><path d="M0 10A7 7 0 0 1 14 10M-7 5A7 7 0 0 1 7 5M7 5A7 7 0 0 1 21 5" fill="none" stroke="' + c + '" stroke-width="1.6"/></pattern>';
    if (kind === 'zigzag') return open + 'width="14" height="10"><path d="M0 7L3.5 3L7 7L10.5 3L14 7" fill="none" stroke="' + c + '" stroke-width="2"/></pattern>';
    if (kind === 'hex') return open + 'width="15" height="26"><path d="M7.5 0L15 4.3V13L7.5 17.3L0 13V4.3ZM7.5 17.3V26" fill="none" stroke="' + c + '" stroke-width="1.5"/></pattern>';
    if (kind === 'arrows') return open + 'width="14" height="12"><path d="M2 9L7 4L12 9" fill="none" stroke="' + c + '" stroke-width="2.2"/></pattern>';
    if (kind === 'speed') return open + 'width="24" height="9"><path d="M0 3H14M8 7.5H24" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/></pattern>';
    return '';
  }
  // 整块绘制的背景装饰（非平铺）
  function tileDeco(kind, c, c2) {
    var i, s = '';
    if (kind === 'rays') {
      // 半径收到 44 以内，不再溢出瓦片
      for (i = 0; i < 16; i += 2) {
        var a0 = i * Math.PI / 8, a1 = (i + 1) * Math.PI / 8;
        s += '<path d="M50 50L' + (50 + 44 * Math.cos(a0)).toFixed(1) + ' ' + (50 + 44 * Math.sin(a0)).toFixed(1) +
          'L' + (50 + 44 * Math.cos(a1)).toFixed(1) + ' ' + (50 + 44 * Math.sin(a1)).toFixed(1) + 'Z" fill="' + c + '"/>';
      }
      return s;
    }
    if (kind === 'rings') {
      for (i = 46; i > 0; i -= 9) s += '<circle cx="50" cy="50" r="' + i + '" fill="none" stroke="' + c + '" stroke-width="3.2"/>';
      return s;
    }
    if (kind === 'split') return '<path d="M0 0H100L0 100Z" fill="' + c2 + '"/>';
    if (kind === 'halves') return '<rect x="0" y="50" width="100" height="50" fill="' + c2 + '"/>';
    if (kind === 'frame') return '<rect x="14" y="14" width="72" height="72" fill="none" stroke="' + c + '" stroke-width="4"/>' +
      '<rect x="22" y="22" width="56" height="56" fill="none" stroke="' + c + '" stroke-width="1.4"/>';
    if (kind === 'floral') {
      [[14, 14], [86, 14], [14, 86], [86, 86]].forEach(function (p) {
        for (var k = 0; k < 4; k++) {
          s += '<ellipse cx="' + p[0] + '" cy="' + (p[1] - 6) + '" rx="3.5" ry="6" fill="' + c + '" transform="rotate(' + (k * 90) + ' ' + p[0] + ' ' + p[1] + ')"/>';
        }
        s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.6" fill="' + c2 + '"/>';
      });
      return s;
    }
    if (kind === 'blob') return '<circle cx="50" cy="52" r="34" fill="' + c2 + '"/>';
    if (kind === 'flame') {
      for (i = 0; i < 5; i++) {
        var fx = 10 + i * 20, fh = 30 + (i % 2) * 16;
        s += '<path d="M' + (fx - 10) + ' 100Q' + (fx - 12) + ' ' + (100 - fh * 0.6) + ' ' + fx + ' ' + (100 - fh) +
          'Q' + (fx + 12) + ' ' + (100 - fh * 0.6) + ' ' + (fx + 10) + ' 100Z" fill="' + c + '"/>';
      }
      return s;
    }
    if (kind === 'snow') {
      [[20, 20, 9], [80, 22, 7], [22, 80, 7], [80, 78, 9], [50, 50, 30]].forEach(function (p) {
        for (var k = 0; k < 3; k++) {
          var a = k * Math.PI / 3, dx = p[2] * Math.cos(a), dy = p[2] * Math.sin(a);
          s += '<path d="M' + (p[0] - dx).toFixed(1) + ' ' + (p[1] - dy).toFixed(1) + 'L' + (p[0] + dx).toFixed(1) + ' ' + (p[1] + dy).toFixed(1) +
            '" stroke="' + c + '" stroke-width="' + (p[2] > 20 ? 3 : 2) + '" stroke-linecap="round"/>';
        }
      });
      return s;
    }
    if (kind === 'crystal') {
      return '<path d="M50 12L63 37L88 50L63 63L50 88L37 63L12 50L37 37Z" fill="' + c + '"/>' +
        '<path d="M50 26L57 43L74 50L57 57L50 74L43 57L26 50L43 43Z" fill="' + c2 + '"/>';
    }
    if (kind === 'bolt') {
      return '<path d="M60 0L24 56H46L36 100L78 38H54L68 0Z" fill="' + c + '"/>';
    }
    if (kind === 'sparkle') {
      [[22, 22, 12], [78, 26, 9], [26, 78, 9], [76, 76, 13]].forEach(function (p) {
        var r0 = p[2], r1 = p[2] * 0.22;
        s += '<path d="M' + p[0] + ' ' + (p[1] - r0) + 'L' + (p[0] + r1) + ' ' + (p[1] - r1) + 'L' + (p[0] + r0) + ' ' + p[1] +
          'L' + (p[0] + r1) + ' ' + (p[1] + r1) + 'L' + p[0] + ' ' + (p[1] + r0) + 'L' + (p[0] - r1) + ' ' + (p[1] + r1) +
          'L' + (p[0] - r0) + ' ' + p[1] + 'L' + (p[0] - r1) + ' ' + (p[1] - r1) + 'Z" fill="' + c + '"/>';
      });
      return s;
    }
    return '';
  }

  /* ── 隐藏款火焰光晕：噪声扭曲 + 沿边缘顺时针游走的火团 ── */
  var FIRE_COLS = ['#ff5fa8', '#ffb347', '#ffe066', '#5fe0a0', '#6fb6ff', '#b07cff'];
  function fireDefs(id, scale) {
    return '<filter id="' + id + '" x="-60%" y="-60%" width="220%" height="220%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.04 0.08" numOctaves="2" seed="4" result="n">' +
      '<animate attributeName="baseFrequency" values="0.04 0.08;0.06 0.12;0.035 0.07;0.04 0.08" dur="7s" repeatCount="indefinite"/></feTurbulence>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="' + scale + '" xChannelSelector="R" yChannelSelector="G"/>' +
      '<feGaussianBlur stdDeviation="' + (scale / 2.6).toFixed(1) + '"/></filter>';
  }
  // path：顺时针闭合路径；n 团火，dur 一圈时长；r 火团半径
  function fireBody(fid, path, n, dur, r, strokeW) {
    var s = '<g filter="url(#' + fid + ')" style="mix-blend-mode:screen" opacity=".32">';
    s += '<path d="' + path + '" fill="none" stroke="#ff9ad0" stroke-width="' + strokeW + '" opacity=".45">' +
      '<animate attributeName="opacity" values=".3;.55;.4;.5;.3" dur="6s" repeatCount="indefinite"/></path>';
    for (var i = 0; i < n; i++) {
      var c = FIRE_COLS[i % FIRE_COLS.length];
      var d1 = (4 + (i * 1.37) % 2.5).toFixed(2), d2 = (5 + (i * 1.73) % 3).toFixed(2);
      s += '<circle r="' + r + '" fill="' + c + '">' +
        '<animateMotion dur="' + dur + 's" begin="-' + (dur * i / n).toFixed(2) + 's" repeatCount="indefinite" path="' + path + '"/>' +
        '<animate attributeName="r" values="' + [r, r * 1.25, r * 0.9, r * 1.15, r].map(function (v) { return v.toFixed(1); }).join(';') +
        '" dur="' + d1 + 's" repeatCount="indefinite"/>' +
        '<animate attributeName="opacity" values=".35;.75;.5;.7;.4;.35" dur="' + d2 + 's" repeatCount="indefinite"/></circle>';
    }
    return s + '</g>';
  }
  function roundRectPath(x, y, w, h, rx) {
    return 'M' + (x + rx) + ' ' + y + 'H' + (x + w - rx) + 'A' + rx + ' ' + rx + ' 0 0 1 ' + (x + w) + ' ' + (y + rx) +
      'V' + (y + h - rx) + 'A' + rx + ' ' + rx + ' 0 0 1 ' + (x + w - rx) + ' ' + (y + h) +
      'H' + (x + rx) + 'A' + rx + ' ' + rx + ' 0 0 1 ' + x + ' ' + (y + h - rx) +
      'V' + (y + rx) + 'A' + rx + ' ' + rx + ' 0 0 1 ' + (x + rx) + ' ' + y + 'Z';
  }
  // 常亮彩虹光边 + 沿边缘顺时针缓慢流动的不等长光带
  // shapeEl：带 {A} 占位的 SVG 图形元素（需闭合、顺时针），gid：彩虹渐变 id
  function flowEl(shapeEl, dur, attrs) {
    var tag = shapeEl.match(/^<(\w+)/)[1];
    return shapeEl.replace('{A}', 'fill="none" stroke-linecap="round" pathLength="100" stroke-dasharray="18 15.33 18 15.33 18 15.34" ' + attrs)
      .replace('/>', '><animate attributeName="stroke-dashoffset" from="0" to="-100" dur="' + dur + 's" repeatCount="indefinite"/></' + tag + '>');
  }
  // 三段沿边缘顺时针流动的柔光；haloK 控制外圈光晕宽度
  function edgeGlow(shapeEl, fid, w, dur, haloK) {
    return '<g filter="url(#' + fid + 'h)" style="mix-blend-mode:screen">' + flowEl(shapeEl, dur, 'stroke="#ffe9f6" stroke-width="' + (w * (haloK || 13)) + '" opacity=".42"') + '</g>' +
      '<g filter="url(#' + fid + 's)" style="mix-blend-mode:screen">' + flowEl(shapeEl, dur, 'stroke="#fff4fb" stroke-width="' + (w * 2.6) + '" opacity=".62"') + '</g>';
  }
  function edgeFlow(shapeEl, gid, fid, w, dur) {
    // 彩虹描边 + 流动柔光
    return shapeEl.replace('{A}', 'fill="none" stroke="url(#' + gid + ')" stroke-width="' + w + '"') + edgeGlow(shapeEl, fid, w, dur);
  }

  function edgeDefs(fid, glow, soft) {
    return '<filter id="' + fid + 'h" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="' + (glow * 5) + '"/></filter>' +
      '<filter id="' + fid + 'g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="' + glow + '"/></filter>' +
      '<filter id="' + fid + 's" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="' + soft + '"/></filter>';
  }
  function rainbowDef(id, dur) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ff7ab8"/><stop offset=".3" stop-color="#ffd27a"/>' +
      '<stop offset=".6" stop-color="#7fe0b8"/><stop offset="1" stop-color="#8fb8ff"/>' +
      '<animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="' + dur + 's" repeatCount="indefinite"/>' +
      '</linearGradient>';
  }
  function cardAuraSVG() {
    var p = 60, W = CARD_W + p * 2, H = CARD_H + p * 2;
    var shape = '<rect x="' + (p + 1.5) + '" y="' + (p + 1.5) + '" width="' + (CARD_W - 3) + '" height="' + (CARD_H - 3) + '" rx="15" {A}/>';
    return '<svg class="gc-aura" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="left:-' + p + 'px;top:-' + p + 'px">' +
      '<defs>' + rainbowDef('caRb', 20) + edgeDefs('caF', 5, 6) + '</defs>' + edgeFlow(shape, 'caRb', 'caF', 3, 28) + '</svg>';
  }

  /* ── 新方案：类型决定色系/底形/字体，等级决定背景复杂度 ── */
  // 宝石色：中深饱和底 + 亮字，在深色卡面上光效才显
  var TYPE_STYLE = {
    shield: { shape: 'shield', font: 'garamond', bg: '#1f7a55', fg: '#effff6', ln: '#7ef0b8',
      bgs: [null, ['p', 'dots'], ['p', 'scales'], ['p', 'hex'], ['d', 'floral']] },
    blast: { shape: 'octagon', font: 'abril', bg: '#b8461c', fg: '#fff3e0', ln: '#ffa45c',
      bgs: [null, ['p', 'gems'], ['p', 'checker'], ['d', 'rays'], ['d', 'flame']] },
    frost: { shape: 'diamond', font: 'cinzel', bg: '#1c5f94', fg: '#eef9ff', ln: '#8fdcff',
      bgs: [null, ['p', 'grid'], ['p', 'cross'], ['d', 'snow'], ['d', 'crystal']] },
    pierce: { shape: 'arch', font: 'playfair', bg: '#a3245f', fg: '#fff0f6', ln: '#ff8cc0',
      bgs: [null, ['p', 'zigzag'], ['p', 'arrows'], ['d', 'rings'], ['p', 'stars']] },
    thunder: { shape: 'square', font: 'abril', bg: '#4a34a8', fg: '#f3eeff', ln: '#c6a2ff',
      bgs: [null, ['p', 'cross'], ['p', 'checker'], ['d', 'bolt'], ['d', 'rays']] },
    swift: { shape: 'circle', font: 'cormorant', bg: '#9a7206', fg: '#fffbe6', ln: '#ffe066',
      bgs: [null, ['p', 'waves'], ['p', 'speed'], ['d', 'bolt'], ['d', 'sparkle']] },
    tide: { shape: 'arch', font: 'cormorant', bg: '#0f6b7a', fg: '#effdff', ln: '#5fe6ff',
      bgs: [null, ['p', 'waves'], ['p', 'grid'], ['d', 'rings'], ['d', 'crystal']] },
    blade: { shape: 'octagon', font: 'cinzel', bg: '#8a1f6b', fg: '#fff0fb', ln: '#ff9ae6',
      bgs: [null, ['p', 'zigzag'], ['p', 'arrows'], ['d', 'rings'], ['d', 'rays']] },
  };
  // opts.mythic：超稀有，统一哥特体 + 彩虹描边
  var typeUid = 0;
  function typeGlyph(set, ch) {
    var up = String(ch || '').toUpperCase();
    return set.glyphs[up] || set.glyphs[up.toLowerCase()] || set.glyphs.E;
  }
  function typeTileSVG(ch, lv, size, opts) {
    opts = opts || {};
    lv = Math.max(1, Math.min(5, lv || 1));
    var kind = letterKind(ch);
    var S = TYPE_STYLE[kind] || TYPE_STYLE.swift;
    var mythic = !!opts.mythic;
    var fontId = mythic ? 'fraktur' : S.font;
    if (!global.GLYPHS[fontId]) fontId = 'garamond';
    var bgCol = mythic ? tint(S.bg, 0, -0.12) : S.bg;
    var lnCol = S.ln;
    var b = S.bgs[Math.min(lv, 5) - 1];
    // 每个瓦片独立 id：同词重复字母不会共享 clipPath / 渐变，
    // 避免 WebKit 里第二个同 id 的 SVG 偶发不绘制（字母成长偶见缺字）。
    var uid = 'y' + (++typeUid) + hash32(ch + lv + kind + size + (mythic ? 'm' : '')).toString(36);
    var sh = TILE_SHAPE_SVG[S.shape];

    var set = global.GLYPHS[fontId];
    var g = typeGlyph(set, ch);
    var sc = (opts.compact ? 46 : 56) / (OPT[fontId] || 700);
    var gw = g.w * sc, gh = g.h * sc;
    var x = 50 - gw / 2, y = 50 + (opts.compact ? 25 : 28) - g.b * sc;

    var defs = '<clipPath id="' + uid + 'c">' + sh + '</clipPath>';
    if (b && b[0] === 'p') defs += tilePattern(uid + 'p', b[1], hexA(lnCol, lv >= 4 ? 0.55 : 0.45));
    if (mythic) defs += '<linearGradient id="' + uid + 'r" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ff6b9a"/><stop offset=".33" stop-color="#ffd84d"/>' +
      '<stop offset=".66" stop-color="#5fe0a0"/><stop offset="1" stop-color="#7fb6ff"/>' +
      '<animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="8s" repeatCount="indefinite"/>' +
      '</linearGradient>';

    if (mythic) defs += edgeDefs(uid + 'e', 1.6, 2.4);
    var s = '<svg class="tile lv' + Math.min(lv, 5) + (mythic ? ' mythic' : '') + '" width="' + size + '" height="' + size +
      '" viewBox="0 0 100 100" style="overflow:visible"><defs>' + defs + '</defs>';
    // 隐藏款光晕垫在底形下面，只向外发光，不会给字母和纹样蒙一层白雾
    if (mythic) s += edgeGlow(sh.replace('/>', ' {A}/>'), uid + 'e', 3.4, 16, 5);
    s += '<g fill="' + bgCol + '">' + sh + '</g><g clip-path="url(#' + uid + 'c)">';
    if (b && b[0] === 'd') s += '<g opacity=".3" transform="translate(50 50) scale(.9) translate(-50 -50)">' + tileDeco(b[1], lnCol, hexA(lnCol, 0.5)) + '</g>';
    if (b && b[0] === 'p') s += '<rect width="100" height="100" fill="url(#' + uid + 'p)"/>';
    s += '</g>';
    var edge = mythic ? 'url(#' + uid + 'r)' : lv >= 5 ? '#f6d77a' : lnCol;
    if (mythic) s += '<g fill="none" stroke="url(#' + uid + 'r)" stroke-width="3.4">' + sh + '</g>';
    else s += '<g fill="none" stroke="' + edge + '" stroke-width="' + (lv >= 5 ? 5 : lv >= 3 ? 3.5 : 2.5) + '">' + sh + '</g>';
    if (lv >= 3) s += '<g fill="none" stroke="' + lnCol + '" stroke-width="1.2" stroke-opacity=".6" transform="translate(50 50) scale(.84) translate(-50 -50)">' + sh + '</g>';
    if (mythic) {
      // 闪烁星芒
      [[16, 16, 7, 0], [86, 20, 5, 0.8], [84, 84, 7, 1.5], [18, 82, 5, 2.2]].forEach(function (p) {
        var r0 = p[2], r1 = p[2] * 0.2;
        s += '<path d="M' + p[0] + ' ' + (p[1] - r0) + 'L' + (p[0] + r1) + ' ' + (p[1] - r1) + 'L' + (p[0] + r0) + ' ' + p[1] +
          'L' + (p[0] + r1) + ' ' + (p[1] + r1) + 'L' + p[0] + ' ' + (p[1] + r0) + 'L' + (p[0] - r1) + ' ' + (p[1] + r1) +
          'L' + (p[0] - r0) + ' ' + p[1] + 'L' + (p[0] - r1) + ' ' + (p[1] - r1) + 'Z" fill="#fff" opacity="0">' +
          '<animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="' + p[3] + 's" repeatCount="indefinite"/></path>';
      });
    }
    // 字母一律用亮色实心 + 深色描边，保证在彩色底形上也有足够对比；
    // 隐藏款把彩虹挪到描边和光晕上，不再直接填在字形里
    var fg = S.fg;
    // 未获得的隐藏款：保留底形与边框，字母换成问号
    if (opts.q) {
      return s + '<text x="51.5" y="70" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="56" fill="rgba(0,0,0,.4)">?</text>' +
        '<text x="50" y="68" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="56" fill="' + fg +
        '" stroke="rgba(18,10,22,.55)" stroke-width="2">?</text></svg>';
    }
    var glyphSc = sc.toFixed(4);
    var gx = x.toFixed(1), gy = y.toFixed(1), sx = (x + 2).toFixed(1), sy = (y + 2.4).toFixed(1);
    // 直接把字形路径放进外层 SVG（不再嵌套 <svg>）：少一层视口计算，
    // 翻面 / 缩放时不会因为嵌套视口造成个别字母短暂消失。
    s += '<g transform="translate(' + sx + ' ' + sy + ') scale(' + glyphSc + ')">' +
      '<path d="' + g.d + '" fill="rgba(0,0,0,.45)"/></g>' +
      '<g transform="translate(' + gx + ' ' + gy + ') scale(' + glyphSc + ')">' +
      '<path d="' + g.d + '" fill="' + fg + '" stroke="rgba(18,10,22,.55)" stroke-width="' + (2.2 / sc).toFixed(2) +
      '" stroke-opacity="' + (mythic ? 0.6 : 0.9) + '" stroke-linejoin="round"/>' +
      (mythic ? '<path d="' + g.d + '" fill="none" stroke="url(#' + uid + 'r)" stroke-width="' + (4.8 / sc).toFixed(2) +
        '" stroke-linejoin="round" opacity=".95"/>' : '') + '</g>' + '</svg>';
    return s;
  }
  // Initialis 式独立配色：底 / 字 / 纹 / 第二色
  var INKS = [
    ['#c8102e', '#fff4dc', '#ffd2a8', '#7a0a1c'],
    ['#14365d', '#f2c14e', '#3d6aa0', '#f2c14e'],
    ['#1f5c3a', '#f7d8e0', '#3c8a5c', '#e98aa5'],
    ['#111111', '#ffd60a', '#444444', '#ffd60a'],
    ['#0f766e', '#ffb35c', '#2aa198', '#ff8c42'],
    ['#4b2a7b', '#b9f6ca', '#7a52b3', '#f4a7ff'],
    ['#f4ead2', '#c8102e', '#e3cfa2', '#14365d'],
    ['#ffd60a', '#111111', '#f2b705', '#c8102e'],
    ['#e85d75', '#fff4dc', '#f48aa0', '#3a0d1a'],
    ['#2b2d42', '#8ecae6', '#43465e', '#ffb703'],
    ['#7f5539', '#ffe8c2', '#9c6b4a', '#2f1b0e'],
    ['#00a6a6', '#102a43', '#3cc6c6', '#f6f7d7'],
    ['#ff7a00', '#1b1b3a', '#ff9d3f', '#fff1d6'],
    ['#e9f5db', '#386641', '#c7e3a8', '#bc4749'],
  ];
  var DECOS = ['rays', 'rings', 'split', 'halves', 'frame', 'floral', 'blob'];
  // 字母等级决定样式：1 统一朴素 / 2 独立配色+纹样 / 3 独立字体+装饰 / 4 金边 / 5 流光
  function tileSVG(word, i, ch, size, lv, th) {
    var r = rng(hash32(word.w + '|tile|' + i));
    var h = hash32(word.w + '|tiles');
    // 步长与列表长度互质，保证相邻字母各不相同
    var fontId = lv >= 3 ? TILE_FONTS[(h + i * 5) % TILE_FONTS.length] : th.word;
    if (!global.GLYPHS[fontId]) fontId = 'garamond';
    var shape = lv >= 2 ? TILE_SHAPES[((h >>> 4) + i * 3) % 6] : 'square';
    var ink = lv >= 2 ? INKS[((h >>> 8) + i * 5) % INKS.length]
      : [th.ground, th.letter === 'gold' ? '#f2cf6a' : th.letter, th.glow, th.glow];
    var col = { bg: ink[0], fg: ink[1], pt: hexA(ink[2], 0.85), line: ink[3] };
    var bgKinds = TILE_PATTERNS.concat(DECOS);
    var bgKind = bgKinds[((h >>> 12) + i * 7) % bgKinds.length];
    var isDeco = lv >= 3 && DECOS.indexOf(bgKind) >= 0;
    var pat = 'solid';
    // 1 级：全词统一样式，但随稀有度变华丽
    var rt = rarityOf(word);
    if (lv === 1) {
      shape = ['square', 'square', 'arch', 'octagon', 'shield', 'diamond'][rt] || 'square';
      if (rt >= 2) pat = ['dots', 'dots', 'gems', 'scales', 'stars', 'stars'][rt];
      if (rt >= 4) bgKind = rt >= 5 ? 'rays' : 'frame', isDeco = true;
    }
    if (lv === 2) pat = TILE_PATTERNS[((h >>> 12) + i * 7) % TILE_PATTERNS.length];
    else if (lv >= 3) pat = isDeco ? TILE_PATTERNS[Math.floor(r() * TILE_PATTERNS.length)] : bgKind;
    var tiltDeg = lv >= 2 ? ((r() - 0.5) * (lv >= 3 ? 8 : 4)).toFixed(1) : '0';
    var tier = lv === 1 ? (rt >= 5 ? 4 : Math.min(rt, 3)) : lv;
    var uid = 't' + hash32(word.w + i + size + lv).toString(36);

    var set = global.GLYPHS[fontId];
    var g = set.glyphs[ch] || set.glyphs.E;
    var cap = OPT[fontId] || 700;
    var sc = 58 / cap;
    var gw = g.w * sc, gh = g.h * sc;
    var x = 50 - gw / 2, y = 50 + 29 - g.b * sc;
    var sh = TILE_SHAPE_SVG[shape];
    var bare = shape === 'none';

    var s = '<svg class="tile lv' + lv + '" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" style="transform:rotate(' +
      tiltDeg + 'deg)"><defs>' + tilePattern(uid + 'p', pat, col.pt) +
      '<clipPath id="' + uid + 'c">' + sh + '</clipPath></defs>';
    if (!bare) {
      s += '<g fill="' + col.bg + '">' + sh + '</g>';
      s += '<g clip-path="url(#' + uid + 'c)">';
      if (isDeco) s += '<g opacity="' + (bgKind === 'split' || bgKind === 'halves' || bgKind === 'blob' ? 0.85 : 0.42) + '">' + tileDeco(bgKind, col.pt, ink[2]) + '</g>';
      if (pat !== 'solid') s += '<rect width="100" height="100" fill="url(#' + uid + 'p)" opacity="' + (isDeco ? 0.4 : 1) + '"/>';
      s += '</g>';
      s += '<g fill="none" stroke="' + (tier >= 4 ? '#f6d77a' : col.line) + '" stroke-width="' + (tier >= 4 ? 4 : 2.5) + '">' + sh + '</g>';
      if (tier >= 3) s += '<g fill="none" stroke="' + col.line + '" stroke-width="1" stroke-opacity=".45" transform="translate(50 50) scale(.86) translate(-50 -50)">' + sh + '</g>';
    }
    var fg = bare ? th.glow : col.fg;
    s += '<svg x="' + (x + 2.5).toFixed(1) + '" y="' + (y + 3).toFixed(1) + '" width="' + gw.toFixed(1) + '" height="' + gh.toFixed(1) +
      '" viewBox="0 0 ' + g.w + ' ' + g.h + '" overflow="visible"><path d="' + g.d + '" fill="rgba(0,0,0,.35)"/></svg>' +
      '<svg x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + gw.toFixed(1) + '" height="' + gh.toFixed(1) +
      '" viewBox="0 0 ' + g.w + ' ' + g.h + '" overflow="visible"><path d="' + g.d + '" fill="' + fg + '"/></svg></svg>';
    return s;
  }
  // 在给定区域里排成若干行，让瓦片尽量大
  function tilesHTML(word, levels, th, areaW, areaH, mask) {
    var chars = word.w.toUpperCase().split('');
    var n = chars.length, gap = 6, best = { size: 0, per: n };
    for (var rows = 1; rows <= 4; rows++) {
      var per = Math.ceil(n / rows);
      var size = Math.min((areaW - gap * (per - 1)) / per, (areaH - gap * (rows - 1)) / rows, 74);
      if (size > best.size) best = { size: size, per: per };
    }
    var sz = Math.floor(best.size), out = '<div class="gc-tiles" style="gap:' + gap + 'px">';
    for (var i = 0; i < n; i += best.per) {
      out += '<div class="tr">';
      for (var j = i; j < Math.min(n, i + best.per); j++) out += typeTileSVG(chars[j], (levels && levels[j]) || 1, sz, { mythic: !!word.hid, q: !!mask });
      out += '</div>';
    }
    return out + '</div>';
  }

  /* ── 外圈边框：装帧书籍风。框宽统一，装饰全部收在卡片矩形内；
     越高阶线条层次越多、角花越精细，而不是越粗越大 ── */
  var RING = { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10 };
  var FRAME_KEY = { 1: 'n', 2: 'r', 3: 'sr', 4: 'ssr', 5: 'ur' };
  var FRAME_INK = {
    1: ['#eef0f3', '#3d4148'], 2: ['#f6d6ad', '#4a2c14'], 3: ['#fff1c4', '#5a3d08'],
    4: ['#ffffff', '#474a5a'], 5: ['#fff6d8', '#6a4510'],
  };
  var FRAME_GEM = { 4: ['#b9a2ff', '#5a3fc4'], 5: ['#ff8a9c', '#a3142f'] };
  function gemPath(cx, cy, r) {
    return 'M' + cx + ' ' + (cy - r) + 'L' + (cx + r) + ' ' + cy + 'L' + cx + ' ' + (cy + r) + 'L' + (cx - r) + ' ' + cy + 'Z';
  }
  // 角花：局部坐标原点在内框角点，正方向指向卡面内部
  function frameCorner(tier, hi, lo) {
    var g = '';
    if (tier >= 3) {
      g += '<path d="M3 21V3H21" fill="none" stroke="' + hi + '" stroke-width="1" stroke-linecap="round"/>' +
        '<circle cx="3" cy="23" r="1.2" fill="' + hi + '"/><circle cx="23" cy="3" r="1.2" fill="' + hi + '"/>';
    }
    if (tier >= 4) {
      g += '<path d="M3 9Q9 9 9 3" fill="none" stroke="' + hi + '" stroke-width=".8" stroke-opacity=".85"/>' +
        '<circle cx="7.6" cy="7.6" r="1" fill="' + hi + '"/>';
    }
    if (tier >= 5) {
      g += '<path d="M6 28V6H28" fill="none" stroke="' + hi + '" stroke-width=".6" stroke-opacity=".55"/>' +
        '<path d="M28 6q3-2.5 5 0q-2 2.5-5 0Z" fill="' + hi + '" fill-opacity=".8"/>' +
        '<path d="M6 28q-2.5 3 0 5q2.5-2 0-5Z" fill="' + hi + '" fill-opacity=".8"/>';
    }
    if (tier >= 2) {
      g += '<path d="' + gemPath(0, 0, tier >= 3 ? 4.2 : 3.4) + '" fill="' + hi + '" stroke="' + lo + '" stroke-width=".7"/>';
    }
    return g;
  }
  function frameSVG(tier, hid) {
    var W = CARD_W, H = CARD_H, ring = RING[tier], m = ring / 2;
    var hi = FRAME_INK[tier][0], lo = FRAME_INK[tier][1];
    var defs = '';
    if (hid) {
      hi = 'url(#exInk)';
      defs += '<linearGradient id="exInk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd1e0"/><stop offset=".3" stop-color="#fff2b8"/>' +
        '<stop offset=".6" stop-color="#c8f4ff"/><stop offset="1" stop-color="#e6d2ff"/></linearGradient>';
    }
    var s = '<svg class="gc-frame" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">';
    // 外缘高光 + 内缘压线：一条细金属边
    s += '<rect x="1.2" y="1.2" width="' + (W - 2.4) + '" height="' + (H - 2.4) + '" rx="15" fill="none" stroke="' + hi + '" stroke-opacity=".55" stroke-width="1"/>';
    s += '<rect x="' + (ring - .6) + '" y="' + (ring - .6) + '" width="' + (W - ring * 2 + 1.2) + '" height="' + (H - ring * 2 + 1.2) +
      '" rx="9.5" fill="none" stroke="' + lo + '" stroke-opacity=".9" stroke-width="1.2"/>';
    if (tier >= 2) {
      // 双线：框带中央一道刻线
      s += '<rect x="' + m + '" y="' + m + '" width="' + (W - m * 2) + '" height="' + (H - m * 2) + '" rx="12.5" fill="none" stroke="' +
        lo + '" stroke-opacity=".5" stroke-width=".7"/>';
    }
    if (tier >= 3) {
      // 内框一道细金线，像书页压印
      s += '<rect x="' + (ring + 3.5) + '" y="' + (ring + 3.5) + '" width="' + (W - ring * 2 - 7) + '" height="' + (H - ring * 2 - 7) +
        '" rx="7" fill="none" stroke="' + hi + '" stroke-opacity=".28" stroke-width=".6"/>';
    }
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (d) {
      var x = d[0] > 0 ? ring : W - ring, y = d[1] > 0 ? ring : H - ring;
      s += '<g transform="translate(' + x + ' ' + y + ') scale(' + d[0] + ' ' + d[1] + ')">' + frameCorner(tier, hi, lo) + '</g>';
    });
    if (tier >= 4) {
      // 两侧腰线小菱 + 底部中央小菱
      [[m, H / 2], [W - m, H / 2], [W / 2, H - ring]].forEach(function (p) {
        s += '<path d="' + gemPath(p[0], p[1], 3) + '" fill="' + hi + '" stroke="' + lo + '" stroke-width=".6"/>';
      });
      // 顶部中央：一颗嵌在框带上的椭圆宝石，两侧短横线收束
      var cx = W / 2, cy = ring, gc = FRAME_GEM[tier] || FRAME_GEM[5];
      var gid = hid ? 'exGem' : 'fgem' + tier;
      if (hid) {
        defs += '<linearGradient id="exGem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ec0"/><stop offset=".35" stop-color="#ffe680"/>' +
          '<stop offset=".65" stop-color="#8ee8ff"/><stop offset="1" stop-color="#c49bff"/></linearGradient>';
      } else {
        defs += '<radialGradient id="' + gid + '" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="' + gc[0] +
          '"/><stop offset="1" stop-color="' + gc[1] + '"/></radialGradient>';
      }
      s += '<path d="M' + (cx - 30) + ' ' + m + 'H' + (cx - 13) + 'M' + (cx + 13) + ' ' + m + 'H' + (cx + 30) + '" stroke="' + hi + '" stroke-width="1" stroke-linecap="round"/>';
      if (tier >= 5) s += '<ellipse class="gc-gem-halo" cx="' + cx + '" cy="' + cy + '" rx="14" ry="10" fill="' + (hid ? '#fff' : gc[0]) + '" fill-opacity=".35"/>';
      s += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="9" ry="6.2" fill="' + lo + '" stroke="' + hi + '" stroke-width="1.2"/>';
      s += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="6.6" ry="4.4" fill="url(#' + gid + ')"/>';
      s += '<path d="M' + (cx - 2.6) + ' ' + (cy - 1.6) + 'q1.6-1.4 3.4-.8" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width=".8" stroke-linecap="round"/>';
    }
    if (defs) s += '<defs>' + defs + '</defs>';
    return s + '</svg>';
  }

  /* ── DOM 渲染：手游卡牌结构 ─────────────────────────────── */
  function render(word, opts) {
    opts = opts || {};
    var sp = spec(word);
    var th = sp.theme, tier = sp.tier;
    var T = global.TIERS[tier];
    var mastery = opts.mastery || 0;
    var levels = opts.levels || null;
    var cLv = cardLevel(word, levels);
    var senses = word.senses && word.senses.length ? word.senses : null;
    var cnText = senses ? senses.map(function (x) { return x.cn; }).join('；') : (word.cn || '');
    var mask = !!opts.mask;   // 未获得的隐藏款：单词按字母数显示问号，释义只显示一个问号
    if (mask) cnText = '?';

    var card = document.createElement('article');
    card.className = 'card gc tier-' + tier + ' theme-' + th.key + (word.hid ? ' gc-hid' : '') + (opts.compact ? ' sm' : '');
    card.setAttribute('data-word', word.w);
    card.style.width = CARD_W + 'px';
    card.style.height = CARD_H + 'px';
    card.style.setProperty('--glow', th.glow);
    card.style.setProperty('--ground', th.ground);

    var fkey = word.hid ? 'ex' : FRAME_KEY[tier];
    var fimg = global.FRAME_IMG && global.FRAME_IMG[fkey];
    var ring = RING[tier], innerW = CARD_W - ring * 2;
    card.style.setProperty('--ring', ring + 'px');
    if (fimg) {
      // 图片边框：内容区按实测框带厚度内缩，压进框带 1.5px 避免透缝
      var raw = global.FRAME_INSET[fkey];
      var ins = raw.map(function (v) { return Math.max(0, v - 1.5) + 'px'; });
      card.classList.add('gc-img');
      card.style.setProperty('--in', ins[2] + ' ' + ins[1] + ' ' + ins[3] + ' ' + ins[0]);
      card.style.setProperty('--band-top', raw[2] + 'px');
      innerW = CARD_W - parseFloat(ins[0]) - parseFloat(ins[1]);
    }

    var lite = !!opts.lite;
    var perf = !!opts.perf;
    var html = word.hid && !lite ? cardAuraSVG() : '';
    html += '<div class="gc-in">';

    html += '<div class="gc-art">' +
      (tier >= 3 && !lite ? '<span class="gc-rays"></span>' : '') +
      tilesHTML(word, levels, th, innerW - 28, 116, mask) +
      (fimg ? '' : '<div class="gc-badge">' + lvGem(word.lvl || cLv) + '</div>' +
          '<div class="gc-tier">' + (word.hid ? 'EX' : T.code) + '</div>') +
      '</div>';

    var plateFs = opts.compact
      ? Math.min(38, Math.floor((innerW - 24) / (word.w.length * 0.66)))
      : Math.min(30, Math.floor((innerW - 40) / (word.w.length * 0.72)));
    html += '<div class="gc-plate"><span class="plate-word" style="font-size:' + plateFs + 'px">' +
      (mask ? word.w.replace(/./g, '?') : word.w.toLowerCase()) + '</span></div>';
    var wk = weaponKinds(word, levels);

    html += '<div class="gc-info">' +
      '<div class="gc-ph">' +
        (word.pos && !mask ? '<b class="pos">' + word.pos + '</b>' : '') +
        '<span class="ipa">' + (mask ? '' : (word.ph || '')) + '</span>' +
      '</div>' +
      '<div class="gc-cn">' + cnText + '</div>';

    html += '<div class="gc-wpn"><span class="gc-wico">' + weaponIcon(wk.main, 'main') + (wk.sub ? weaponIcon(wk.sub, 'sub') : '') + '</span>' +
      '<span class="gc-pow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6M16 16l4 4M19 21l2-2"/></svg><b>' + powerOf(word, levels) + '</b></span></div>' +
      '</div>';

    if (tier >= 4 && !lite) html += '<span class="gc-holo"></span>';
    html += '</div>';
    // 图片边框：品级宝石、等级圆章压在框的左上 / 右上角
    if (fimg) {
      html += '<img class="gc-fimg" src="' + fimg + '" alt="">' +
        '<img class="gc-rank" src="' + global.GEM_IMG[fkey] + '" alt="">' +
        '<div class="gc-title"><b>' + (word.hid ? 'EX' : T.code) + '</b></div>' +
        '<div class="gc-lv" style="background-image:url(' + global.LV_IMG[fkey] + ')"><b>' + (word.lvl || cLv) + '</b></div>';
    } else {
      html += frameSVG(tier, !!word.hid);
    }

    // 列表用：去掉 SVG 动画和模糊滤镜层（隐藏款流光等），只留静态外观
    if (lite || perf) {
      html = html.replace(/<animate(?:Transform|Motion)?\b[^>]*\/>/g, '');
      if (perf) card.classList.add('perf');
    }
    if (lite) {
      html = html.replace(/<g filter="url\([^)]*\)"[^>]*>[\s\S]*?<\/g>/g, '');
      card.classList.add('lite');
    }
    card.innerHTML = html;
    card._spec = sp;
    return card;
  }
  // 武器图标（24×24 描边路径），与战斗内大招按钮同一套造型
  var KIND_ICON = {
    blast: '<path d="M19 5 9 15"/><path d="M15 3 7 11"/><path d="M21 9 13 17"/><circle cx="7" cy="17" r="3.2"/>',
    pierce: '<path d="M12 2v20"/><path d="M8 4v16M16 4v16" opacity=".5"/>',
    swift: '<path d="M4 20 12 4l8 16"/><path d="M8 20l4-8 4 8"/>',
    thunder: '<path d="M13 2 5 13h6l-1 9 8-12h-6z"/>',
    frost: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    tide: '<path d="M2 15c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/><path d="M2 20c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/>',
    blade: '<path d="M4 20C8 10 14 5 21 3c-2 7-7 13-17 17z"/><path d="M4 20l5-5"/>',
  };
  function weaponIcon(kind, cls) {
    var K = KINDS[kind];
    return '<i class="wico ' + cls + '" style="--c:' + K.c + '" title="' + (cls === 'sub' ? '副武器 · ' : '主武器 · ') + K.nm + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      KIND_ICON[kind] + '</svg></i>';
  }
  // 综合战力：尽量复用 battle.js 的武器参数，避免“显示战力”和实战脱节。
  var COMBAT_RANK = { 1: 1, 2: 1.12, 3: 1.26, 4: 1.42, 5: 1.6, 6: 1.6 };
  function weaponEstimate(kind, lv, vt, rank, sub) {
    var base = 4 * (COMBAT_RANK[rank] || 1) * (1 + 0.15 * Math.max(0, vt - 1));
    var dps = 0, def = 0, ctl = 0, cover = 0, multi = 0, reliable = 0, hit = sub ? .78 : .9;
    lv = Math.max(1, Math.min(7, lv || 1));
    if (kind === 'blast') {
      dps = base * (3 + 2 * (lv - 1)) * 1.6 / (lv >= 6 ? .24 : .34) * hit;
      cover = 1.1 + lv * .18; multi = 1.2 + lv * .22; reliable = .58;
    } else if (kind === 'frost') {
      var fn = [1, 2, 3, 4, 5, 6, 7][lv - 1];
      dps = base * fn * 1.25 / .13 * hit;
      ctl = fn * (0.8 + lv * .12);
      cover = fn * .8; multi = fn * .55; reliable = .86;
    } else if (kind === 'swift') {
      var sm = [1, 2, 2, 3, 4, 5, 6][lv - 1];
      dps = base * sm * 1.5 / .3 * hit;
      ctl = sm * 0.7;
      cover = sm * .7; multi = sm * .4; reliable = .98;
    } else if (kind === 'thunder') {
      var jumps = 1 + Math.ceil(lv * .7);
      dps = base * 4.4 * jumps / (lv >= 6 ? .3 : .48) * hit;
      ctl = jumps * 1.5;
      cover = 1.2 + jumps * .7; multi = jumps * 1.3; reliable = .78;
    } else if (kind === 'pierce') {
      var beams = lv >= 7 ? 5 : lv >= 5 ? 3 : 1;
      dps = base * (16 + 4 * lv) * (beams > 1 ? 1.6 : 1) * hit;
      ctl = beams * 1.2;
      cover = beams * 1.8 + 2.5; multi = beams * 1.1; reliable = .82;
    } else if (kind === 'tide') {
      var tn = [1, 1, 2, 2, 3, 3, 4][lv - 1];
      dps = base * tn * 1.9 / (.26 - lv * .008) * hit;
      ctl = tn * (1.1 + lv * .18);
      cover = tn * 1.4; multi = tn * .9; reliable = .72;
    } else if (kind === 'blade') {
      var bn = [4, 5, 6, 6, 7, 7, 8][lv - 1] + (rank >= 5 ? 1 : 0);
      dps = base * bn * (9 + lv * 1.3) / .75 * (sub ? .48 : .58);
      ctl = bn * .35;
      cover = 2.2 + lv * .35; multi = bn * .8; reliable = .55;
    } else if (kind === 'shield') {
      var satellites = 1 + lv;
      dps = base * satellites * 4.2 * .25 + base / .16 * hit;
      def = satellites / Math.max(.8, (1.6 - vt * .1));
      ctl = satellites * .25;
      cover = satellites * .65; multi = satellites * .25; reliable = .9;
    }
    return { dps: dps, def: def, ctl: ctl, cover: cover, multi: multi, reliable: reliable };
  }
  function powerParts(word, levels) {
    var traits = letterTraits(word, levels), wk = weaponKinds(word, levels);
    var g = growOf(word);
    var def = 0, ctl = 0, cover = 0, multi = 0, reliable = 0, weaponScore = 0;
    var cardLv = cardLevel(word, levels), mainLv = cardLv, subLv = Math.max(1, cardLv - 2);
    var main = weaponEstimate(wk.main, mainLv, wk.ammo[wk.main] || 1, g.rank, false);
    weaponScore += main.dps; def += main.def; ctl += main.ctl;
    cover += main.cover; multi += main.multi; reliable += main.reliable;
    if (wk.sub) {
      var sub = weaponEstimate(wk.sub, subLv, wk.ammo[wk.sub] || 1, g.rank, true);
      weaponScore += sub.dps; def += sub.def; ctl += sub.ctl;
      cover += sub.cover; multi += sub.multi; reliable += sub.reliable;
    }
    // 第一层：主 / 副类字母只增强对应武器；第二层：其余字母提供通用词条。
    var traitAmp = {}, aux = {};
    traits.forEach(function (t) {
      if (t.scope === 'aux') { aux[t.effect] = (aux[t.effect] || 0) + t.value; return; }
      traitAmp[t.kind] = (traitAmp[t.kind] || 0) + t.level;
    });
    var mainTrait = 1 + (traitAmp[wk.main] || 0) * .025;
    var subTrait = wk.sub ? 1 + (traitAmp[wk.sub] || 0) * .02 : 0;
    weaponScore = main.dps * mainTrait + (wk.sub ? (weaponScore - main.dps) * subTrait : 0);
    if (traitAmp.shield) def += traitAmp.shield * .45;
    weaponScore *= 1 + (aux.dmg || 0) / 100;
    reliable += (aux.crit || 0) * .01;
    ctl += (aux.ult || 0) * .12;
    def += (aux.guard || 0) * .12;
    var rank = g.rank;
    var factor = COMBAT_RANK[rank] || 1;
    // 以同等级下的所有武器平均表现为基准，避免单一武器把总分拉开数倍。
    var kinds = ['shield', 'blast', 'frost', 'pierce', 'swift', 'thunder', 'tide', 'blade'];
    var refDps = 0, refRel = 0, refCover = 0, refCtl = 0, refDef = 0;
    kinds.forEach(function (kind) {
      var ref = weaponEstimate(kind, mainLv, mainLv, rank, false);
      refDps += ref.dps; refRel += ref.reliable; refCover += ref.cover + ref.multi * .8;
      refCtl += ref.ctl; refDef += ref.def;
    });
    refDps /= kinds.length; refRel /= kinds.length; refCover /= kinds.length;
    refCtl /= kinds.length; refDef /= kinds.length;
    if (wk.sub) {
      var subRefDps = 0, subRefRel = 0, subRefCover = 0, subRefCtl = 0, subRefDef = 0;
      kinds.forEach(function (kind) {
        var sr = weaponEstimate(kind, subLv, subLv, rank, true);
        subRefDps += sr.dps; subRefRel += sr.reliable; subRefCover += sr.cover + sr.multi * .8;
        subRefCtl += sr.ctl; subRefDef += sr.def;
      });
      refDps += subRefDps / kinds.length; refRel += subRefRel / kinds.length;
      refCover += subRefCover / kinds.length; refCtl += subRefCtl / kinds.length; refDef += subRefDef / kinds.length;
    }
    var rawCover = cover + multi * .8;
    var stability = reliable / (wk.sub ? 2 : 1);
    var roleFactor = .48 * weaponScore / Math.max(1, refDps) +
      .16 * stability / Math.max(.1, refRel) +
      .14 * rawCover / Math.max(.1, refCover) +
      .12 * ctl / Math.max(.1, refCtl) +
      .10 * def / Math.max(.1, refDef);
    roleFactor = Math.max(.86, Math.min(1.14, roleFactor));
    var lengthFactor = 1 + Math.max(-.03, Math.min(.08, (traits.length - 5) * .012));
    var levelBase = 70 + cardLv * 12 + rank * 10;
    var total = Math.round(levelBase * factor * g.rate * roleFactor * lengthFactor);
    var output = Math.round((levelBase * .42 * roleFactor) * factor * g.rate);
    var coverage = Math.round((levelBase * .16 * roleFactor) * factor * g.rate);
    var control = Math.round((levelBase * .12 * roleFactor) * factor * g.rate);
    var defense = Math.round((levelBase * .12 * roleFactor) * factor * g.rate);
    var stabilityScore = Math.round((levelBase * .18 * roleFactor) * factor * g.rate);
    return {
      grow: g.rate, tier: g.name, len: traits.length, rank: rank,
      weapon: output, stability: stabilityScore, coverage: coverage,
      defense: defense, control: control,
      total: total,
    };
  }
  function powerOf(word, levels) { return powerParts(word, levels).total; }
  /* ── 通用角标：大卡 / 列表 / 图鉴共用，尺寸由外层 font-size 决定 ── */
  function lvGem(lv) {
    return '<i class="lvgem"><small>LV</small><b>' + lv + '</b></i>';
  }
  function elemGem(kind, cls) {
    var K = KINDS[kind];
    return '<i class="elgem ' + (cls || '') + '" style="--k:' + K.c + '" title="' + K.nm + '">' + K.nm.charAt(0) + '</i>';
  }
  function elemGems(word, levels) {
    var wk = weaponKinds(word, levels);
    return '<span class="elgems">' + elemGem(wk.main, 'main') + (wk.sub ? elemGem(wk.sub, 'sub') : '') + '</span>';
  }

  function dividerSVG(th) {
    return '<svg width="150" height="9" viewBox="0 0 150 9">' +
      '<path d="M0 4.5H66M84 4.5H150" stroke="' + hexA(th.accent, 0.5) + '" stroke-width=".8"/>' +
      '<path d="M75 .8L78.7 4.5L75 8.2L71.3 4.5Z" fill="' + hexA(th.accent, 0.85) + '"/>' +
      '<circle cx="66" cy="4.5" r="1.1" fill="' + hexA(th.accent, 0.55) + '"/>' +
      '<circle cx="84" cy="4.5" r="1.1" fill="' + hexA(th.accent, 0.55) + '"/></svg>';
  }

  /* ── 卡背 ───────────────────────────────────────────────── */
  // 同一套骨架，按抽卡主题换底色 / 烫金色 / 中央徽记；不透任何稀有度信息
  var BACK_THEMES = {
    all: { nm: '万 象', foil: '#dcbb78', rgb: '226,196,136',
      bg: 'radial-gradient(120% 82% at 50% 12%, #3b2f5e 0%, #241a3e 34%, #150e26 66%, #0a0614 100%)' },
    wild: { nm: '自 然 奇 境', foil: '#b9e28c', rgb: '176,222,140',
      bg: 'radial-gradient(120% 82% at 50% 12%, #2f5a3a 0%, #1c3b26 34%, #0f2316 66%, #06110a 100%)' },
    life: { nm: '人 间 烟 火', foil: '#f2b77e', rgb: '242,178,122',
      bg: 'radial-gradient(120% 82% at 50% 12%, #6a3324 0%, #4a2118 34%, #2a110c 66%, #140605 100%)' },
    mind: { nm: '心 智 工 坊', foil: '#8fd0ff', rgb: '140,200,250',
      bg: 'radial-gradient(120% 82% at 50% 12%, #1f4a72 0%, #14304f 34%, #0a1a30 66%, #040b18 100%)' },
    mood: { nm: '光 影 心 绪', foil: '#ffb3dc', rgb: '255,176,218',
      bg: 'radial-gradient(120% 82% at 50% 12%, #5a2a62 0%, #3c1b46 34%, #220d2a 66%, #100515 100%)' },
  };

  // 主题徽记：24×24 坐标（中心 12,12，半径 ≤ 11）。
  // main 是主轮廓，卡背和抽卡主题按钮共用；face/shade/detail/dots 只画在卡背上
  function polar(r, deg) {
    var a = (deg * Math.PI) / 180;
    return (12 + Math.cos(a) * r).toFixed(2) + ' ' + (12 + Math.sin(a) * r).toFixed(2);
  }
  function circ(cx, cy, r) {
    return 'M' + (cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0Z';
  }
  var SIGILS = (function () {
    var i, d;
    // 万象：八芒罗盘星，长芒指四正，短芒指四隅
    var star = [], facets = '';
    for (i = 0; i < 16; i++) star.push(polar(i % 2 ? 2.6 : (i % 4 ? 6.4 : 10.6), i * 22.5 - 90));
    for (i = 0; i < 16; i += 2) facets += 'M12 12L' + star[i] + 'L' + star[(i + 1) % 16] + 'Z';
    // 心智：三轨星核，三条椭圆轨道互成 60°，每轨一颗电子
    var orbits = '', electrons = '';
    for (i = 0; i < 3; i++) {
      d = i * 60 - 90;
      var ca = Math.cos((d * Math.PI) / 180), sa = Math.sin((d * Math.PI) / 180);
      var p1 = (12 + ca * 10.4).toFixed(2) + ' ' + (12 + sa * 10.4).toFixed(2);
      var p2 = (12 - ca * 10.4).toFixed(2) + ' ' + (12 - sa * 10.4).toFixed(2);
      orbits += 'M' + p1 + 'A10.4 3.6 ' + d + ' 1 0 ' + p2 + 'A10.4 3.6 ' + d + ' 1 0 ' + p1 + 'Z';
      var t = ((i * 120 + 35) * Math.PI) / 180, ex = Math.cos(t) * 10.4, ey = Math.sin(t) * 3.6;
      electrons += circ(+(12 + ex * ca - ey * sa).toFixed(2), +(12 + ex * sa + ey * ca).toFixed(2), 0.85);
    }

    return {
      all: {
        main: 'M' + star.join('L') + 'Z',
        face: 'M' + star.join('L') + 'Z',
        shade: facets,
        detail: circ(12, 12, 8.6) + 'M12 12L' + star[4] + 'M12 12L' + star[12] + 'M12 12L' + star[0] + 'M12 12L' + star[8],
        dots: circ(12, 12, 1.15)
      },
      wild: {
        main: 'M12 2.5C14.6 4.6 14.6 7.8 12 9.6C9.4 7.8 9.4 4.6 12 2.5Z' +
          'M12 11.2C13.2 8 16 6.6 19 6.8C18.4 9.8 15.6 11.6 12 11.2Z' +
          'M12 11.2C10.8 8 8 6.6 5 6.8C5.6 9.8 8.4 11.6 12 11.2Z' +
          'M12 16C13.4 12.9 16.4 11.8 19.4 12.4C18.4 15.3 15.4 16.7 12 16Z' +
          'M12 16C10.6 12.9 7.6 11.8 4.6 12.4C5.6 15.3 8.6 16.7 12 16Z' +
          'M12 9.6V21.2',
        face: 'M12 2.5C14.6 4.6 14.6 7.8 12 9.6C9.4 7.8 9.4 4.6 12 2.5Z' +
          'M12 11.2C13.2 8 16 6.6 19 6.8C18.4 9.8 15.6 11.6 12 11.2Z' +
          'M12 11.2C10.8 8 8 6.6 5 6.8C5.6 9.8 8.4 11.6 12 11.2Z' +
          'M12 16C13.4 12.9 16.4 11.8 19.4 12.4C18.4 15.3 15.4 16.7 12 16Z' +
          'M12 16C10.6 12.9 7.6 11.8 4.6 12.4C5.6 15.3 8.6 16.7 12 16Z',
        detail: 'M12 4V8.6M12.7 10.7Q15.4 8.6 18 7.4M11.3 10.7Q8.6 8.6 6 7.4' +
          'M12.7 15.5Q15.6 13.4 18.4 12.9M11.3 15.5Q8.4 13.4 5.6 12.9',
        dots: circ(12, 21.4, 0.95) + circ(9.6, 19.6, 0.6) + circ(14.4, 19.6, 0.6)
      },
      life: {
        main: 'M12 1.8C13.2 5 17.6 7.6 17.6 13.4C17.6 17.6 15.2 20.8 12 20.8C8.8 20.8 6.4 17.6 6.4 13.4' +
          'C6.4 10.4 8 8.4 9.2 7C9.2 9.2 10 10.4 11 11C10.6 7.6 11 4.4 12 1.8Z' +
          'M12 10.4C13 12.4 15 13.8 15 16.4C15 18.4 13.7 19.6 12 19.6C10.3 19.6 9 18.4 9 16.6' +
          'C9 15 9.8 14 10.6 13.4C10.6 14.6 11 15.2 11.6 15.6C11.4 13.8 11.4 12 12 10.4Z',
        face: 'M12 1.8C13.2 5 17.6 7.6 17.6 13.4C17.6 17.6 15.2 20.8 12 20.8C8.8 20.8 6.4 17.6 6.4 13.4' +
          'C6.4 10.4 8 8.4 9.2 7C9.2 9.2 10 10.4 11 11C10.6 7.6 11 4.4 12 1.8Z',
        shade: 'M12 10.4C13 12.4 15 13.8 15 16.4C15 18.4 13.7 19.6 12 19.6C10.3 19.6 9 18.4 9 16.6' +
          'C9 15 9.8 14 10.6 13.4C10.6 14.6 11 15.2 11.6 15.6C11.4 13.8 11.4 12 12 10.4Z',
        detail: 'M15.4 9.8C16.4 11.2 16.6 14.6 15 17.4M12.6 4.6C13.4 6.4 14.6 7.6 15.2 8.6M8 10.6C7.6 11.8 7.6 13 7.8 14.2',
        dots: 'M12 15.4C12.8 16.4 13.4 17 13.4 17.8A1.4 1.4 0 0 1 10.6 17.8C10.6 17 11.2 16.4 12 15.4Z' +
          'M18.6 4.2L19 5.4L20.2 5.8L19 6.2L18.6 7.4L18.2 6.2L17 5.8L18.2 5.4Z' +
          circ(19.6, 9.4, 0.55) + circ(5.4, 6.2, 0.5) + circ(4.8, 9.6, 0.38)
      },
      mind: {
        main: orbits + circ(12, 12, 2.1),
        face: circ(12, 12, 4.4),
        shade: circ(12, 12, 2.9),
        detail: circ(12, 12, 4.4) + circ(12, 12, 10.6),
        dots: circ(12, 12, 1.25) + electrons
      },
      mood: {
        main: 'M10.66 4.51A8.5 8.5 0 1 0 19.06 15.7A7 7 0 0 1 10.66 4.51Z' +
          'M17.6 3L18.35 5.45L20.8 6.2L18.35 6.95L17.6 9.4L16.85 6.95L14.4 6.2L16.85 5.45Z',
        face: 'M10.66 4.51A8.5 8.5 0 1 0 19.06 15.7A7 7 0 0 1 10.66 4.51Z',
        shade: 'M17.6 3L18.35 5.45L20.8 6.2L18.35 6.95L17.6 9.4L16.85 6.95L14.4 6.2L16.85 5.45Z',
        detail: 'M4.92 10.42A6.6 6.6 0 0 0 11.8 19.55',
        dots: circ(20.3, 11, 0.75) + circ(14.3, 11.6, 0.55)
      }
    };
  })();

  // 卡背徽记：画在曼陀罗内环里（200×200 坐标，中心 100,100）
  function backSigil(id, c) {
    var g = SIGILS[id];
    if (!g) return '';
    return '<g transform="translate(100 100) scale(3.1) translate(-12 -12)" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="' + g.face + '" fill="' + hexA(c, 0.16) + '" fill-rule="evenodd"/>' +
      (g.shade ? '<path d="' + g.shade + '" fill="' + hexA(c, 0.42) + '"/>' : '') +
      '<path d="' + g.detail + '" fill="none" stroke="' + hexA(c, 0.5) + '" stroke-width=".3"/>' +
      '<path d="' + g.main + '" fill="none" stroke="' + hexA(c, 0.95) + '" stroke-width=".66"/>' +
      '<path d="' + g.dots + '" fill="' + hexA(c, 0.95) + '"/></g>';
  }

  // 抽卡主题按钮图标：与卡背徽记同形
  function sigilIcon(id) {
    var g = SIGILS[id] || SIGILS.all;
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + g.main + '"/></svg>';
  }

  // 中央曼陀罗：刻度环 + 双层花瓣 + 八芒星（主题卡池换成主题徽记）
  function backMandala(c, sigil) {
    var i, a, s = '';
    // 外圈刻度
    var ticks = '';
    for (i = 0; i < 72; i++) {
      a = (i * Math.PI) / 36;
      var r1 = 96, r2 = i % 6 === 0 ? 86 : 91.5;
      ticks += 'M' + (100 + Math.cos(a) * r2).toFixed(1) + ' ' + (100 + Math.sin(a) * r2).toFixed(1) +
        'L' + (100 + Math.cos(a) * r1).toFixed(1) + ' ' + (100 + Math.sin(a) * r1).toFixed(1);
    }
    s += '<path d="' + ticks + '" stroke="' + hexA(c, 0.5) + '" stroke-width=".9"/>';
    // 外环 / 虚线环
    s += '<circle cx="100" cy="100" r="99" fill="none" stroke="' + hexA(c, 0.62) + '" stroke-width="1.9"/>';
    s += '<circle cx="100" cy="100" r="84" fill="none" stroke="' + hexA(c, 0.3) + '" stroke-width=".7"/>';
    s += '<circle cx="100" cy="100" r="80" fill="none" stroke="' + hexA(c, 0.42) +
      '" stroke-width=".9" stroke-dasharray="1 4.2"/>';

    // 12 片大花瓣
    var big = '';
    for (i = 0; i < 12; i++) {
      big += '<g transform="rotate(' + i * 30 + ' 100 100)">' +
        '<path d="M100 24C112 40 114 58 100 72C86 58 88 40 100 24Z" fill="none" stroke="' +
        hexA(c, 0.46) + '" stroke-width="1"/></g>';
    }
    s += big;

    // 8 片小花瓣：必须和大花瓣同频（12 片），并偏移半个夹角
    // 12 与 8 的间距无法对齐，小花瓣会在相邻大花瓣间左右摇摆
    var small = '';
    for (i = 0; i < 12; i++) {
      small += '<g transform="rotate(' + (i * 30 + 15) + ' 100 100)">' +
        '<path d="M100 44C108 54 108 64 100 72C92 64 92 54 100 44Z" fill="' + hexA(c, 0.16) +
        '" stroke="' + hexA(c, 0.5) + '" stroke-width=".8"/></g>';
    }
    s += small;

    s += '<circle cx="100" cy="100" r="42" fill="none" stroke="' + hexA(c, 0.55) + '" stroke-width="1.2"/>';
    s += '<circle cx="100" cy="100" r="40" fill="' + hexA(c, 0.1) + '"/>';
    s += '<circle cx="100" cy="100" r="37.5" fill="none" stroke="' + hexA(c, 0.3) +
      '" stroke-width=".7" stroke-dasharray=".6 3" stroke-linecap="round"/>';
    s += sigil;
    // 四向菱饰
    [[100, 18], [100, 182], [18, 100], [182, 100]].forEach(function (p) {
      s += '<path d="M' + p[0] + ' ' + (p[1] - 5) + 'L' + (p[0] + 5) + ' ' + p[1] +
        'L' + p[0] + ' ' + (p[1] + 5) + 'L' + (p[0] - 5) + ' ' + p[1] + 'Z" fill="' + hexA(c, 0.85) + '"/>';
    });
    return s;
  }

  // 角花：双弧 + 卷草
  function cornerFlourish(c) {
    return '<g fill="none" stroke="' + hexA(c, 0.5) + '" stroke-width="1.1" stroke-linecap="round">' +
      '<path d="M2 40C2 18 18 2 40 2"/>' +
      '<path d="M8 40C8 22 22 8 40 8"/>' +
      '<path d="M14 34C16 22 22 16 34 14"/>' +
      '<path d="M20 24C22 20 24 18 28 16"/>' +
      '</g>' +
      '<path d="M14 14L19 14L14 19Z" fill="' + hexA(c, 0.75) + '"/>';
  }

  function renderBack(tier, themeId) {
    var id = BACK_THEMES[themeId] ? themeId : 'all';
    var B = BACK_THEMES[id];
    var el = document.createElement('article');
    el.className = 'card back th-back bk-' + id;
    el.style.width = CARD_W + 'px';
    el.style.height = CARD_H + 'px';
    el.style.background = B.bg;
    el.style.setProperty('--bk-foil', B.foil);
    el.style.setProperty('--bk-rgb', B.rgb);

    var c = B.foil;
    var html = '';

    // 底色面板
    html += '<span class="bk-panel"></span>';
    // 菱格织纹
    html += '<span class="bk-lattice"></span>';
    // 双层描金框
    html += '<span class="bk-line l1"></span>';
    html += '<span class="bk-line l2"></span>';

    // 四角卷草
    var corners = '';
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (m) {
      corners += '<g transform="' + cornerMatrix([m[0] ? -1 : 1, m[1] ? -1 : 1, 16], CARD_W, CARD_H) + '">' +
        cornerFlourish(c) + '</g>';
    });
    html += '<svg class="bk-corner" viewBox="0 0 ' + CARD_W + ' ' + CARD_H + '">' + corners + '</svg>';

    // 中央曼陀罗
    html += '<svg class="bk-emblem" viewBox="0 0 200 200">' + backMandala(c, backSigil(id, c)) + '</svg>';

    // 上下菱链
    html += '<span class="bk-chain top"></span>';
    html += '<span class="bk-chain bot"></span>';

    // 品牌字
    html += '<div class="bk-cap">词 卡 物 语</div>';
    html += '<div class="bk-pool">' + B.nm + '</div>';

    el.innerHTML = html;
    return el;
  }

  /* ── Canvas 导出 ────────────────────────────────────────── */
  function drawToCanvas(ctx, W, H, word, opts) {
    opts = opts || {};
    var sp = spec(word);
    var th = sp.theme, tier = sp.tier, R = sp.rarity;
    var T = global.TIERS[tier];
    var mastery = opts.mastery || 0;
    var S = W / CARD_W;
    var senses = word.senses && word.senses.length ? word.senses : null;
    var exs = word.exs && word.exs.length ? word.exs : null;
    var cnText = senses ? senses.map(function (x) { return x.cn; }).join('；') : (word.cn || '');
    var exText = exs ? exs[0].en : (word.ex || '');
    var exCnText = exs ? exs[0].cn : (word.exCn || '');

    ctx.save();
    ctx.scale(S, S);
    ctx.textBaseline = 'alphabetic';

    var g0 = ctx.createRadialGradient(CARD_W * 0.3, 0, 12, CARD_W * 0.3, 0, CARD_W * 1.25);
    g0.addColorStop(0, th.paper);
    g0.addColorStop(1, th.deep);
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    if (R.foil) {
      var fst = foilStops(tier, th);
      var gf = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
      gf.addColorStop(0, fst[0]);
      gf.addColorStop(0.34, 'rgba(255,255,255,0)');
      gf.addColorStop(0.55, fst[1]);
      gf.addColorStop(0.7, 'rgba(255,255,255,0)');
      gf.addColorStop(1, fst[2]);
      ctx.globalAlpha = R.foil;
      ctx.fillStyle = gf;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      ctx.globalAlpha = 1;
    }

    var fs = frameSpec(tier, th);
    fs.rects.forEach(function (r) {
      ctx.strokeStyle = r.c;
      ctx.lineWidth = r.w;
      ctx.strokeRect(r.inset + r.w / 2, r.inset + r.w / 2, CARD_W - r.inset * 2 - r.w, CARD_H - r.inset * 2 - r.w);
    });
    fs.paths.forEach(function (p) {
      ctx.save();
      if (p.t) applyMatrix(ctx, p.t, CARD_W, CARD_H);
      ctx.strokeStyle = p.c;
      ctx.lineWidth = p.w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      try { ctx.stroke(new Path2D(p.d)); } catch (e) {}
      ctx.restore();
    });
    fs.fills.forEach(function (f) {
      ctx.save();
      if (f.t) applyMatrix(ctx, f.t, CARD_W, CARD_H);
      ctx.fillStyle = f.c;
      try { ctx.fill(new Path2D(f.d)); } catch (e) {}
      ctx.restore();
    });

    // 页眉：稀有度字标
    ctx.font = 'italic 900 13px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = th.dark ? hexA(T.foil, 0.9) : T.color;
    ctx.fillText(word.hid ? 'EX' : T.code, R.pad + 3, sp.hdTop + 9);

    // 主词
    sp.hero.items.forEach(function (it) {
      ctx.save();
      ctx.translate(it.x, sp.heroTop + it.base - it.lead);
      ctx.scale(it.sc, it.sc);
      var path = null;
      try { path = new Path2D(it.st.g.d); } catch (e) {}
      if (!path) { ctx.restore(); return; }
      if (it.st.treat === 'outline') {
        ctx.strokeStyle = th.ink;
        ctx.lineWidth = 1.6 / it.sc;
        ctx.stroke(path);
      } else if (it.st.treat === 'rubric') {
        ctx.fillStyle = th.paper;
        ctx.fill(path);
      } else if (it.st.treat === 'gold') {
        var lg = ctx.createLinearGradient(0, 0, it.st.g.w * 0.4, it.st.g.h);
        lg.addColorStop(0, '#f8e8b4'); lg.addColorStop(0.3, '#d4ac3a');
        lg.addColorStop(0.55, '#8f6d16'); lg.addColorStop(0.8, '#e8cc72');
        lg.addColorStop(1, '#a8851c');
        ctx.fillStyle = lg;
        ctx.fill(path);
      } else {
        ctx.fillStyle = th.ink;
        ctx.fill(path);
      }
      ctx.restore();
    });

    // 音标（放大，与卡面 DOM 版一致）
    ctx.textAlign = 'center';
    ctx.fillStyle = hexA(th.ink, th.dark ? 0.78 : 0.72);
    ctx.font = 'italic 15px Georgia, "Times New Roman", serif';
    ctx.fillText((word.pos ? word.pos + '  ' : '') + (word.ph || ''), CARD_W / 2, sp.phBase);

    // 分隔
    var cy = sp.ruleY + 4;
    ctx.strokeStyle = hexA(th.accent, 0.5);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(CARD_W / 2 - 75, cy); ctx.lineTo(CARD_W / 2 - 9, cy);
    ctx.moveTo(CARD_W / 2 + 9, cy); ctx.lineTo(CARD_W / 2 + 75, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CARD_W / 2, cy - 3.7); ctx.lineTo(CARD_W / 2 + 3.7, cy);
    ctx.lineTo(CARD_W / 2, cy + 3.7); ctx.lineTo(CARD_W / 2 - 3.7, cy);
    ctx.closePath();
    ctx.fillStyle = hexA(th.accent, 0.85);
    ctx.fill();

    // 释义 / 例句
    ctx.textAlign = 'center';
    ctx.fillStyle = th.ink;
    ctx.font = sp.text.cn.px > 20 ? FONT_CN : FONT_CN_SM;
    sp.text.cn.lines.forEach(function (ln, i) {
      ctx.fillText(ln, CARD_W / 2, sp.text.cn.top + sp.text.cn.lh * (i + 0.78));
    });

    ctx.fillStyle = hexA(th.ink, 0.82);
    ctx.font = FONT_EN;
    sp.text.ex.lines.forEach(function (ln, i) {
      ctx.fillText(ln, CARD_W / 2, sp.text.ex.top + sp.text.ex.lh * (i + 0.76));
    });

    ctx.fillStyle = hexA(th.ink, 0.55);
    ctx.font = FONT_EXCN;
    sp.text.exCn.lines.forEach(function (ln, i) {
      ctx.fillText(ln, CARD_W / 2, sp.text.exCn.top + sp.text.exCn.lh * (i + 0.76));
    });

    // 武器胶囊：主 / 副（与卡面 DOM 版一致）
    var wk = weaponKinds(word, opts.levels);
    var chips = [wk.main].concat(wk.sub ? [wk.sub] : []).map(function (k) {
      return { c: KINDS[k].c, t: KINDS[k].nm };
    });
    ctx.font = '600 12.5px "PingFang SC", sans-serif';
    var chH = 24, chGap = 8;
    chips.forEach(function (c) { c.w = ctx.measureText(c.t).width + 30; });
    var chTotal = chips.reduce(function (s, c) { return s + c.w; }, 0) + chGap * (chips.length - 1);
    var chx = CARD_W / 2 - chTotal / 2, chy = sp.statY - 4;
    chips.forEach(function (c) {
      var pill = null;
      try { pill = new Path2D(roundRectPath(chx, chy, c.w, chH, 12)); } catch (e) {}
      if (pill) {
        ctx.fillStyle = hexA(c.c, 0.14);
        ctx.fill(pill);
        ctx.strokeStyle = hexA(c.c, 0.5);
        ctx.lineWidth = 0.8;
        ctx.stroke(pill);
      }
      ctx.beginPath();
      ctx.arc(chx + 12, chy + chH / 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = c.c;
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = tint(c.c, 0, th.dark ? 0.05 : -0.2);
      ctx.fillText(c.t, chx + 21, chy + 16.5);
      chx += c.w + chGap;
    });

    // 掌握星
    for (var si = 0; si < 3; si++) {
      var sx2 = R.pad + 5 + si * 8, sy2 = sp.footY + 4;
      ctx.beginPath();
      ctx.moveTo(sx2, sy2 - 2.6); ctx.lineTo(sx2 + 2.6, sy2);
      ctx.lineTo(sx2, sy2 + 2.6); ctx.lineTo(sx2 - 2.6, sy2);
      ctx.closePath();
      if (si < mastery) { ctx.fillStyle = th.dark ? T.foil : th.accent; ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(120,120,120,.34)'; ctx.lineWidth = 0.8; ctx.stroke(); }
    }

    ctx.restore();
  }

  /* ── 稀有度铭牌（Canvas 镜像）──────────────────────────── */
  function drawPlaque(ctx, sp, th, tier, T) {
    if (tier < 3) return;
    var cx = CARD_W / 2, cy = sp.plaqueY;
    var w = tier >= 5 ? 96 : 84, h = 17;
    ctx.save();
    ctx.strokeStyle = hexA(th.accent, 0.42);
    ctx.lineWidth = 0.7;
    ctx.strokeRect(cx - w / 2, cy, w, h);
    ctx.fillStyle = hexA(th.ink, th.dark ? 0.72 : 0.6);
    ctx.font = '600 7.5px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(T.code, cx - 4, cy + 11.5);
    ctx.font = '7.5px "Songti SC", serif';
    ctx.fillStyle = hexA(th.ink, 0.42);
    ctx.fillText(T.name, cx + 16, cy + 11.5);
    ctx.fillStyle = hexA(th.accent, 0.7);
    ctx.fillRect(cx - w / 2 - 6, cy + 8, 3, 1);
    ctx.fillRect(cx + w / 2 + 3, cy + 8, 3, 1);
    ctx.restore();
  }

  function applyMatrix(ctx, t, W, H) {
    var sx = t[0], sy = t[1], off = t[2] || 0;
    var tx = sx > 0 ? off : W - off;
    var ty = sy > 0 ? off : H - off;
    ctx.translate(tx, ty);
    ctx.scale(sx, sy);
  }

  function drawType(ctx, text, fontId, px, color, cx, baseline, tracking) {
    var set = global.GLYPHS[fontId] || global.GLYPHS.garamond;
    var upm = set.upm, sc = px / upm, tr = (tracking || 0) * px;
    var pen = 0, glyphs = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var g = set.glyphs[ch] || set.glyphs[ch.toUpperCase()] || set.glyphs['e'];
      if (!g) continue;
      glyphs.push({ g: g, x: pen + (g.l || 0) * sc });
      pen += (g.a || g.w) * sc + tr;
    }
    var width = Math.max(0, pen - tr);
    ctx.save();
    ctx.translate(cx - width / 2, baseline);
    ctx.fillStyle = color;
    glyphs.forEach(function (it) {
      var path = null;
      try { path = new Path2D(it.g.d); } catch (e) {}
      if (!path) return;
      ctx.save();
      ctx.translate(it.x, 0);
      ctx.scale(sc, sc);
      ctx.fill(path);
      ctx.restore();
    });
    ctx.restore();
  }

  function wrapText(ctx, text, cx, y, maxW, lh, maxLines) {
    var words = String(text).split(' ');
    var line = '', yy = y, n = 1;
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(t).width > maxW && line) {
        if (n >= maxLines) { line = t; break; }
        ctx.fillText(line, cx, yy);
        yy += lh; line = words[i]; n++;
      } else line = t;
    }
    if (line) ctx.fillText(line, cx, yy);
  }

  function wrapCJK(ctx, text, cx, y, maxW, lh, maxLines, px) {
    var chars = String(text).split('');
    var line = '', yy = y, n = 1;
    for (var i = 0; i < chars.length; i++) {
      var t = line + chars[i];
      if (ctx.measureText(t).width > maxW && line) {
        if (n >= maxLines) { line = t; break; }
        ctx.fillText(line, cx, yy);
        yy += lh; line = chars[i]; n++;
      } else line = t;
    }
    if (line) ctx.fillText(line, cx, yy);
  }

  global.Card = {
    rarityOf: rarityOf,
    statsOf: statsOf,
    levelCap: levelCap,
    typeTileSVG: typeTileSVG,
    tileLook: tileLook,
    SHAPE_PATH: SHAPE_PATH,
    cardLevel: cardLevel,
    CARD_W: CARD_W,
    CARD_H: CARD_H,
    RARITY: RARITY,
    THEMES: THEMES,
    themedFor: themedFor,
    render: render,
    emblemSVG: emblemSVG,
    letterKind: letterKind,
    letterTrait: letterTrait,
    letterTraits: letterTraits,
    growOf: growOf,
    powerOf: powerOf,
    powerParts: powerParts,
    weaponEstimate: weaponEstimate,
    weaponIcon: weaponIcon,
    dominantKind: dominantKind,
    secondKind: secondKind,
    weaponKinds: weaponKinds,
    kindOrder: kindOrder,
    letterRoles: letterRoles,
    lvGem: lvGem,
    elemGems: elemGems,
    KINDS: KINDS,
    renderBack: renderBack,
    BACK_THEMES: BACK_THEMES,
    sigilIcon: sigilIcon,
    spec: spec,
    frameSpec: frameSpec,
    drawToCanvas: drawToCanvas,
    hexA: hexA,
    sizeFor: sizeFor,
  };
})(window);
