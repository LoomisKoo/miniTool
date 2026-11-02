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
    herbarium: { name: '植物标本', paper: '#e8ead8', deep: '#cbd2b8', ink: '#26372b', accent: '#718b4f', dark: false,
      fonts: ['garamond', 'cormorant'], texture: 'leaf',
      word: 'garamond', emblem: 'cormorant', shape: 'circle', ground: '#4f6f3a', glow: '#9fd36b', letter: '#f3f1dc' },
    blueprint: { name: '蓝图档案', paper: '#d8e5e8', deep: '#a8c2ca', ink: '#173743', accent: '#367d91', dark: false,
      fonts: ['cinzel', 'playfair'], texture: 'grid',
      word: 'cinzel', emblem: 'playfair', shape: 'diamond', ground: '#1d5b72', glow: '#6fd8ff', letter: '#e6f6fa' },
    vermilion: { name: '朱印古册', paper: '#ead8cd', deep: '#c9aaa0', ink: '#3e211d', accent: '#a84739', dark: false,
      fonts: ['garamond', 'abril'], texture: 'fibers',
      word: 'playfair', emblem: 'abril', shape: 'square', ground: '#a3372a', glow: '#ff8a5c', letter: '#fbe9d6' },
    nightchart: { name: '夜航星图', paper: '#202c43', deep: '#11192b', ink: '#e9e5d4', accent: '#73a6c2', dark: true,
      fonts: ['cinzel', 'playfair'], texture: 'stars',
      word: 'cinzel', emblem: 'cinzel', shape: 'ring', ground: '#18264a', glow: '#8fb8ff', letter: '#eef2ff' },
    blackletter: { name: '黑金秘典', paper: '#2b211d', deep: '#130f0e', ink: '#eadbb8', accent: '#c99f3d', dark: true,
      fonts: ['fraktur', 'cinzel', 'abril'], texture: 'grain',
      word: 'cinzel', emblem: 'fraktur', shape: 'shield', ground: '#2a1a12', glow: '#ffc24a', letter: 'gold' },
    vellum: { name: '羊皮书页', paper: '#f1e6ca', deep: '#d8c39b', ink: '#33271b', accent: '#93613b', dark: false,
      fonts: ['cormorant', 'garamond', 'playfair'], texture: 'paper',
      word: 'cormorant', emblem: 'garamond', shape: 'arch', ground: '#7a4a26', glow: '#ffcf8a', letter: '#f8ebcf' },
  };
  var TAG_THEME = {
    nature: 'herbarium', light: 'blueprint', sound: 'nightchart', feeling: 'vellum',
    time: 'vermilion', place: 'vellum', people: 'vermilion', motion: 'blueprint',
    rare: 'blackletter', study: 'blueprint', tech: 'blueprint', body: 'herbarium',
    food: 'vermilion', object: 'vellum', sky: 'nightchart', beast: 'herbarium',
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

  /* ── 稀有度：由"生僻度"算出，不是随机 ─────────────────── */
  // 生僻度 = 词长 + 词性抽象度 + 分类稀有度 → 五档
  function rarityOf(word) {
    // 已拥有的卡：外观等级 = 卡片等级
    if (typeof word.lvl === 'number') return Math.max(1, Math.min(5, word.lvl));
    var n = word.w.length;
    var len = n <= 5 ? 0 : n <= 7 ? 1 : n <= 9 ? 2 : n <= 12 ? 3 : 4;
    var pos = { n: 0, v: 1, adj: 1, adv: 2 }[word.pos] || 0;
    var tag = word.tag === 'rare' ? 2 : word.tag === 'study' ? 1 : 0;
    var score = len + pos + tag;
    var t = score <= 1 ? 1 : score === 2 ? 2 : score === 3 ? 3 : score === 4 ? 4 : 5;
    // 与人工标注取均值，避免公式把明显的日常词抬得过高
    if (typeof word.tier === 'number') t = Math.round((t + word.tier) / 2) || 1;
    return Math.max(1, Math.min(5, t));
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
  /* ── 战斗属性：字母 → 弹种（卡面与远征共用）──────────────── */
  var KINDS = {
    shield: { nm: '护盾', c: '#5fe0a0', shot: '环绕护盾' },
    blast:  { nm: '散射', c: '#ff8a3d', shot: '三向散射' },
    frost:  { nm: '减速', c: '#7fd8ff', shot: '冰缓弹' },
    pierce: { nm: '激光', c: '#b38cff', shot: '贯穿激光' },
    swift:  { nm: '追踪', c: '#ffd84d', shot: '自动追踪' },
  };
  // 卡片没有单一"类型"：取字母里出现最多的一种作为主倾向，平局取靠前的字母
  function dominantKind(word) {
    var s = String((word && word.w) || ''), cnt = {}, max = 0, i;
    for (i = 0; i < s.length; i++) {
      var k = letterKind(s[i]);
      cnt[k] = (cnt[k] || 0) + 1;
      if (cnt[k] > max) max = cnt[k];
    }
    for (i = 0; i < s.length; i++) {
      var kk = letterKind(s[i]);
      if (cnt[kk] === max) return kk;
    }
    return 'blast';
  }
  function letterKind(ch) {
    ch = String(ch || '').toUpperCase();
    if ('AEIOU'.indexOf(ch) >= 0) return 'shield';
    if ('BPRG'.indexOf(ch) >= 0) return 'blast';
    if ('CFST'.indexOf(ch) >= 0) return 'frost';
    if ('DKMNVWXZ'.indexOf(ch) >= 0) return 'pierce';
    return 'swift';
  }

  /* ── 首字母徽章：Initialis 式「字母 + 底形 + 纹样」，整卡唯一视觉主体 ── */
  var SHAPES = {
    circle: '<circle cx="80" cy="80" r="70"/>',
    ring: '<circle cx="80" cy="80" r="70"/>',
    diamond: '<path d="M80 6L154 80L80 154L6 80Z"/>',
    square: '<rect x="13" y="13" width="134" height="134" rx="8"/>',
    shield: '<path d="M18 14H142V82Q142 134 80 152Q18 134 18 82Z"/>',
    arch: '<path d="M16 152V74Q16 10 80 10Q144 10 144 74V152Z"/>',
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
  var TILE_SHAPE_SVG = {
    square: '<rect x="4" y="4" width="92" height="92" rx="7"/>',
    circle: '<circle cx="50" cy="50" r="46"/>',
    arch: '<path d="M6 96V44Q6 4 50 4Q94 4 94 44V96Z"/>',
    diamond: '<path d="M50 2L98 50L50 98L2 50Z"/>',
    shield: '<path d="M8 6H92V50Q92 86 50 98Q8 86 8 50Z"/>',
    octagon: '<path d="M30 4H70L96 30V70L70 96H30L4 70V30Z"/>',
    none: '<rect x="4" y="4" width="92" height="92" rx="7"/>',
  };
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
      for (i = 0; i < 16; i += 2) {
        var a0 = i * Math.PI / 8, a1 = (i + 1) * Math.PI / 8;
        s += '<path d="M50 50L' + (50 + 80 * Math.cos(a0)).toFixed(1) + ' ' + (50 + 80 * Math.sin(a0)).toFixed(1) +
          'L' + (50 + 80 * Math.cos(a1)).toFixed(1) + ' ' + (50 + 80 * Math.sin(a1)).toFixed(1) + 'Z" fill="' + c + '"/>';
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
      return '<path d="M50 2L66 34L98 50L66 66L50 98L34 66L2 50L34 34Z" fill="' + c + '"/>' +
        '<path d="M50 18L58 42L82 50L58 58L50 82L42 58L18 50L42 42Z" fill="' + c2 + '"/>';
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
  function edgeFlow(shapeEl, gid, fid, w, dur) {
    function el(attrs) { return shapeEl.replace('{A}', attrs); }
    var tag = shapeEl.match(/^<(\w+)/)[1];
    var flow = function (attrs) {
      return el('fill="none" stroke-linecap="round" pathLength="100" stroke-dasharray="18 15.33 18 15.33 18 15.34" ' + attrs)
        .replace('/>', '><animate attributeName="stroke-dashoffset" from="0" to="-100" dur="' + dur + 's" repeatCount="indefinite"/></' + tag + '>');
    };
    // 彩虹描边 + 三段沿边缘顺时针流动的柔光
    return el('fill="none" stroke="url(#' + gid + ')" stroke-width="' + w + '"') +
      '<g filter="url(#' + fid + 'h)" style="mix-blend-mode:screen">' + flow('stroke="#ffe9f6" stroke-width="' + (w * 13) + '" opacity=".42"') + '</g>' +
      '<g filter="url(#' + fid + 's)" style="mix-blend-mode:screen">' + flow('stroke="#fff4fb" stroke-width="' + (w * 2.6) + '" opacity=".62"') + '</g>';
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
    pierce: { shape: 'arch', font: 'playfair', bg: '#5a32a0', fg: '#f6eeff', ln: '#c6a2ff',
      bgs: [null, ['p', 'zigzag'], ['p', 'arrows'], ['d', 'rings'], ['p', 'stars']] },
    swift: { shape: 'circle', font: 'cormorant', bg: '#9a7206', fg: '#fffbe6', ln: '#ffe066',
      bgs: [null, ['p', 'waves'], ['p', 'speed'], ['d', 'bolt'], ['d', 'sparkle']] },
  };
  // opts.mythic：超稀有，统一哥特体 + 彩虹描边
  function typeTileSVG(ch, lv, size, opts) {
    opts = opts || {};
    var kind = letterKind(ch);
    var S = TYPE_STYLE[kind];
    var mythic = !!opts.mythic;
    var fontId = mythic ? 'fraktur' : S.font;
    if (!global.GLYPHS[fontId]) fontId = 'garamond';
    var bgCol = mythic ? tint(S.bg, 0, -0.12) : S.bg;
    var lnCol = S.ln;
    var b = S.bgs[Math.min(lv, 5) - 1];
    var uid = 'y' + hash32(ch + lv + kind + size + (mythic ? 'm' : '')).toString(36);
    var sh = TILE_SHAPE_SVG[S.shape];

    var set = global.GLYPHS[fontId];
    var g = set.glyphs[ch] || set.glyphs.E;
    var sc = 56 / (OPT[fontId] || 700);
    var gw = g.w * sc, gh = g.h * sc;
    var x = 50 - gw / 2, y = 50 + 28 - g.b * sc;

    var defs = '<clipPath id="' + uid + 'c">' + sh + '</clipPath>';
    if (b && b[0] === 'p') defs += tilePattern(uid + 'p', b[1], hexA(lnCol, lv >= 4 ? 0.55 : 0.45));
    if (mythic) defs += '<linearGradient id="' + uid + 'r" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ff6b9a"/><stop offset=".33" stop-color="#ffd84d"/>' +
      '<stop offset=".66" stop-color="#5fe0a0"/><stop offset="1" stop-color="#7fb6ff"/>' +
      '<animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="8s" repeatCount="indefinite"/>' +
      '</linearGradient>';

    if (mythic) defs += edgeDefs(uid + 'e', 3.2, 4.2);
    var s = '<svg class="tile lv' + Math.min(lv, 5) + (mythic ? ' mythic' : '') + '" width="' + size + '" height="' + size +
      '" viewBox="0 0 100 100" style="overflow:visible"><defs>' + defs + '</defs>';
    s += '<g fill="' + bgCol + '">' + sh + '</g><g clip-path="url(#' + uid + 'c)">';
    if (b && b[0] === 'd') s += '<g opacity=".5">' + tileDeco(b[1], lnCol, hexA(lnCol, 0.5)) + '</g>';
    if (b && b[0] === 'p') s += '<rect width="100" height="100" fill="url(#' + uid + 'p)"/>';
    s += '</g>';
    var edge = mythic ? 'url(#' + uid + 'r)' : lv >= 5 ? '#f6d77a' : lnCol;
    if (mythic) s += edgeFlow(sh.replace('/>', ' {A}/>'), uid + 'r', uid + 'e', 3.4, 16);
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
    var fg = mythic ? 'url(#' + uid + 'r)' : S.fg;
    s += '<svg x="' + (x + 2.5).toFixed(1) + '" y="' + (y + 3).toFixed(1) + '" width="' + gw.toFixed(1) + '" height="' + gh.toFixed(1) +
      '" viewBox="0 0 ' + g.w + ' ' + g.h + '" overflow="visible"><path d="' + g.d + '" fill="rgba(0,0,0,.38)"/></svg>' +
      '<svg x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + gw.toFixed(1) + '" height="' + gh.toFixed(1) +
      '" viewBox="0 0 ' + g.w + ' ' + g.h + '" overflow="visible"><path d="' + g.d + '" fill="' + fg + '"/></svg></svg>';
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
      if (isDeco) s += '<g opacity="' + (bgKind === 'split' || bgKind === 'halves' || bgKind === 'blob' ? 1 : 0.8) + '">' + tileDeco(bgKind, col.pt, ink[2]) + '</g>';
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
  function tilesHTML(word, levels, th, areaW, areaH) {
    var chars = word.w.toUpperCase().split('');
    var n = chars.length, gap = 4, best = { size: 0, per: n };
    for (var rows = 1; rows <= 4; rows++) {
      var per = Math.ceil(n / rows);
      var size = Math.min((areaW - gap * (per - 1)) / per, (areaH - gap * (rows - 1)) / rows, 74);
      if (size > best.size) best = { size: size, per: per };
    }
    var sz = Math.floor(best.size), out = '<div class="gc-tiles" style="gap:' + gap + 'px">';
    for (var i = 0; i < n; i += best.per) {
      out += '<div class="tr">';
      for (var j = i; j < Math.min(n, i + best.per); j++) out += typeTileSVG(chars[j], (levels && levels[j]) || 1, sz, { mythic: !!word.hid });
      out += '</div>';
    }
    return out + '</div>';
  }

  /* ── 外圈边框：只画在卡片金属边上，不压内容；稀有度越高越宽、造型越复杂 ── */
  var RING = { 1: 6, 2: 8, 3: 10, 4: 12, 5: 14 };
  var FRAME_INK = {
    1: ['#f2f5f8', '#5b6168'], 2: ['#ffe2b8', '#5a3416'], 3: ['#fff3c4', '#6d4706'],
    4: ['#efe8ff', '#2a1f86'], 5: ['#fff7d6', '#7a2453'],
  };
  function gemPath(cx, cy, r) {
    return 'M' + cx + ' ' + (cy - r) + 'L' + (cx + r) + ' ' + cy + 'L' + cx + ' ' + (cy + r) + 'L' + (cx - r) + ' ' + cy + 'Z';
  }
  function frameSVG(tier) {
    var W = CARD_W, H = CARD_H, ring = RING[tier];
    var hi = FRAME_INK[tier][0], lo = FRAME_INK[tier][1];
    var m = ring / 2;
    var s = '<svg class="gc-frame" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">';
    // 外圈高光 + 内圈暗线，做出金属厚度
    s += '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="15" fill="none" stroke="' + hi + '" stroke-opacity=".7" stroke-width="1.2"/>';
    s += '<rect x="' + (ring - 1) + '" y="' + (ring - 1) + '" width="' + (W - ring * 2 + 2) + '" height="' + (H - ring * 2 + 2) +
      '" rx="' + Math.max(4, 12 - ring / 2) + '" fill="none" stroke="' + lo + '" stroke-opacity=".9" stroke-width="1.5"/>';

    if (tier >= 2) {
      // 环中线
      s += '<rect x="' + m + '" y="' + m + '" width="' + (W - m * 2) + '" height="' + (H - m * 2) + '" rx="13" fill="none" stroke="' +
        lo + '" stroke-opacity=".45" stroke-width=".8"/>';
      // 四角铆钉
      [[m, m], [W - m, m], [m, H - m], [W - m, H - m]].forEach(function (p) {
        s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (ring * 0.32) + '" fill="' + hi + '" stroke="' + lo + '" stroke-width=".8"/>';
      });
    }
    if (tier >= 3) {
      // 边中点的菱形钉饰
      [[W / 2, m], [W / 2, H - m], [m, H / 2], [W - m, H / 2]].forEach(function (p) {
        s += '<path d="' + gemPath(p[0], p[1], ring * 0.55) + '" fill="' + hi + '" stroke="' + lo + '" stroke-width=".8"/>';
      });
      // 四角护角：L 形压条
      var L = 34;
      [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (d) {
        var x0 = d[0] > 0 ? 3 : W - 3, y0 = d[1] > 0 ? 3 : H - 3;
        s += '<path d="M' + x0 + ' ' + (y0 + d[1] * L) + 'V' + y0 + 'H' + (x0 + d[0] * L) + '" fill="none" stroke="' + hi +
          '" stroke-width="2.4" stroke-linecap="round"/>';
      });
    }
    if (tier >= 4) {
      // 两侧符文条
      [m, W - m].forEach(function (x) {
        for (var k = -2; k <= 2; k++) {
          if (!k) continue;
          s += '<path d="' + gemPath(x, H / 2 + k * 22, ring * 0.28) + '" fill="' + hi + '" fill-opacity=".85"/>';
        }
      });
      // 顶部拱形徽冠
      s += '<path d="M' + (W / 2 - 36) + ' ' + ring + 'Q' + (W / 2) + ' -12 ' + (W / 2 + 36) + ' ' + ring + 'Z" fill="' + lo + '" stroke="' + hi + '" stroke-width="1.4"/>';
      s += '<path d="' + gemPath(W / 2, 4, 5) + '" fill="' + hi + '"/>';
      // 底部徽带
      s += '<path d="M' + (W / 2 - 46) + ' ' + (H - ring) + 'H' + (W / 2 + 46) + 'L' + (W / 2 + 38) + ' ' + H + 'H' + (W / 2 - 38) + 'Z" fill="' + lo +
        '" stroke="' + hi + '" stroke-width="1.2"/>';
    }
    if (tier >= 5) {
      // 王冠
      var cx = W / 2, top = -2, base = ring + 2;
      s += '<path d="M' + (cx - 44) + ' ' + base + 'L' + (cx - 40) + ' ' + (top + 6) + 'L' + (cx - 22) + ' ' + (base - 4) + 'L' + cx + ' ' + top +
        'L' + (cx + 22) + ' ' + (base - 4) + 'L' + (cx + 40) + ' ' + (top + 6) + 'L' + (cx + 44) + ' ' + base + 'Z" fill="url(#lrCrown)" stroke="' + hi + '" stroke-width="1.2"/>';
      [cx - 40, cx, cx + 40].forEach(function (x, k) {
        s += '<circle cx="' + x + '" cy="' + (k === 1 ? top + 3 : top + 8) + '" r="3" fill="' + ['#68ddff', '#ff5d8f', '#bd7bff'][k] + '" stroke="#fff" stroke-width=".6"/>';
      });
      // 四角大宝石
      [[m + 2, m + 2], [W - m - 2, m + 2], [m + 2, H - m - 2], [W - m - 2, H - m - 2]].forEach(function (p, k) {
        s += '<path d="' + gemPath(p[0], p[1], 8) + '" fill="' + ['#ff5d8f', '#68ddff', '#ffe074', '#bd7bff'][k] + '" stroke="#fff" stroke-width="1"/>';
      });
      s += '<defs><linearGradient id="lrCrown" x1="0" x2="1"><stop offset="0" stop-color="#ff5d8f"/><stop offset=".35" stop-color="#ffe074"/>' +
        '<stop offset=".7" stop-color="#68ddff"/><stop offset="1" stop-color="#bd7bff"/></linearGradient></defs>';
    }
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
    var st = statsOf(word, levels);
    var cLv = cardLevel(word, levels);
    var senses = word.senses && word.senses.length ? word.senses : null;
    var cnText = senses ? senses.map(function (x) { return x.cn; }).join('；') : (word.cn || '');

    var card = document.createElement('article');
    card.className = 'card gc tier-' + tier + ' theme-' + th.key + (word.hid ? ' gc-hid' : '');
    card.setAttribute('data-word', word.w);
    card.style.width = CARD_W + 'px';
    card.style.height = CARD_H + 'px';
    card.style.setProperty('--glow', th.glow);
    card.style.setProperty('--ground', th.ground);

    var ring = RING[tier];
    var innerW = CARD_W - ring * 2;
    card.style.setProperty('--ring', ring + 'px');

    var html = word.hid ? cardAuraSVG() : '';
    html += '<div class="gc-in">';

    html += '<div class="gc-art">' +
      (tier >= 3 ? '<span class="gc-rays"></span>' : '') +
      tilesHTML(word, levels, th, innerW - 24, 132) +
      '<div class="gc-badge"><b>' + (word.hid ? 'EX' : T.code) + '</b><span>' + (word.hid ? '隐藏款' : T.name) +
      '</span><em>Lv ' + (word.lvl || cLv) + '</em></div>' +
      '<div class="gc-tag">' + (global.TAGS[word.tag] || '词') + '</div>' +
      '</div>';

    var letters = word.w.toUpperCase().split('');
    var plateFs = Math.min(24, Math.floor((innerW - 40) / (letters.length * 0.72)));
    html += '<div class="gc-plate"><span class="plate-word" style="font-size:' + plateFs + 'px">';
    letters.forEach(function (ch) {
      html += '<i style="--k:' + KINDS[letterKind(ch)].c + '">' + ch.toLowerCase() + '</i>';
    });
    html += '</span></div>';

    html += '<div class="gc-info">' +
      '<div class="gc-ph">' + (word.pos || '') + '&nbsp;&nbsp;' + (word.ph || '') + '</div>' +
      '<div class="gc-cn">' + cnText + '</div>';

    html += '<div class="gc-stats">' +
      statBar('伤害', st.str) + statBar('技能', st.wis) + statBar('连击', st.res) + '</div>' +
      '<div class="gc-foot"><span class="gc-stars">';
    for (var i = 0; i < 3; i++) html += '<i class="' + (i < mastery ? 'on' : '') + '"></i>';
    html += '</span><span class="gc-no">' + sp.serial + '</span></div>' +
      '</div>';

    if (tier >= 4) html += '<span class="gc-holo"></span>';
    html += '</div>' + frameSVG(tier);

    card.innerHTML = html;
    card._spec = sp;
    return card;
  }
  function statBar(nm, v) {
    return '<div class="sb"><span>' + nm + '</span><i><b style="width:' + Math.min(100, v / 12 * 100).toFixed(0) +
      '%"></b></i><em>' + v + '</em></div>';
  }

  function dividerSVG(th) {
    return '<svg width="150" height="9" viewBox="0 0 150 9">' +
      '<path d="M0 4.5H66M84 4.5H150" stroke="' + hexA(th.accent, 0.5) + '" stroke-width=".8"/>' +
      '<path d="M75 .8L78.7 4.5L75 8.2L71.3 4.5Z" fill="' + hexA(th.accent, 0.85) + '"/>' +
      '<circle cx="66" cy="4.5" r="1.1" fill="' + hexA(th.accent, 0.55) + '"/>' +
      '<circle cx="84" cy="4.5" r="1.1" fill="' + hexA(th.accent, 0.55) + '"/></svg>';
  }

  /* ── 卡背 ───────────────────────────────────────────────── */
  function renderBack(tier) {
    tier = tier || 1;
    var T = global.TIERS[tier];
    var R = RARITY[tier];
    var el = document.createElement('article');
    el.className = 'card back tier-' + tier + ' th-back';
    el.style.width = CARD_W + 'px';
    el.style.height = CARD_H + 'px';
    el.style.background =
      'radial-gradient(110% 70% at 50% 18%, #4a3a78 0%, #2a1f4f 55%, #160f2e 100%)';

    var g = hexA(T.foil, 1);
    var off = Math.max(10, R.pad - 4);
    var html = '';

    // 边光：稀有度预告
    if (tier >= 3) {
      html += '<span class="fr" style="inset:' + (off - 4) + 'px;border-width:3px;border-color:' +
        hexA(T.foil, 0.06 + tier * 0.022) + ';filter:blur(3px)"></span>';
    }

    // 双框 + 四角括号
    html += '<span class="fr" style="inset:' + off + 'px;border-width:1.1px;border-color:' +
      hexA(T.foil, 0.34 + tier * 0.05) + '"></span>';
    html += '<span class="fr" style="inset:' + (off + 4) + 'px;border-width:.5px;border-color:' +
      hexA(T.foil, 0.16 + tier * 0.03) + '"></span>';

    var br = '';
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (m) {
      br += '<path d="' + bracket(17) + '" transform="' +
        cornerMatrix([m[0], m[1], off + 4], CARD_W, CARD_H) +
        '" fill="none" stroke="' + hexA(T.foil, 0.4) + '" stroke-width="1"/>';
    });
    html += '<svg class="fr-svg" viewBox="0 0 ' + CARD_W + ' ' + CARD_H + '">' + br + '</svg>';

    // 点阵底纹
    html += '<span class="bk-weave"></span>';

    // 中央徽记
    var cx = 80, cy = 80;
    var rays = '';
    for (var i = 0; i < 16; i++) {
      var a = (i * Math.PI) / 8;
      var r1 = i % 2 ? 30 : 34, r2 = i % 2 ? 37 : 42;
      rays += 'M' + (cx + Math.cos(a) * r1).toFixed(1) + ' ' + (cy + Math.sin(a) * r1).toFixed(1) +
        'L' + (cx + Math.cos(a) * r2).toFixed(1) + ' ' + (cy + Math.sin(a) * r2).toFixed(1);
    }
    var star = '';
    for (var k = 0; k < 8; k++) {
      var ang = (k * Math.PI) / 4;
      star += 'M' + cx + ' ' + cy + 'L' + (cx + Math.cos(ang) * 20).toFixed(1) + ' ' +
        (cy + Math.sin(ang) * 20).toFixed(1);
    }
    html +=
      '<svg class="bk-emblem" viewBox="0 0 160 160" width="176" height="176">' +
      '<circle cx="80" cy="80" r="46" fill="none" stroke="' + hexA(T.foil, 0.62) + '" stroke-width="1.1"/>' +
      '<circle cx="80" cy="80" r="43" fill="none" stroke="' + hexA(T.foil, 0.22) +
        '" stroke-width=".6" stroke-dasharray="1 3.4"/>' +
      '<circle cx="80" cy="80" r="30" fill="none" stroke="' + hexA(T.foil, 0.46) + '" stroke-width=".8"/>' +
      '<path d="' + rays + '" stroke="' + hexA(T.foil, 0.55) + '" stroke-width="1" stroke-linecap="round"/>' +
      '<path d="' + star + '" stroke="' + hexA(T.foil, 0.72) + '" stroke-width=".8"/>' +
      '<circle cx="80" cy="80" r="13" fill="none" stroke="' + hexA(T.foil, 0.62) + '" stroke-width=".9"/>' +
      '<path d="M80 68L87 80L80 92L73 80Z" fill="' + hexA(T.foil, 0.9) + '"/>' +
      '<path d="M80 74L83.4 80L80 86L76.6 80Z" fill="#141009"/>' +
      '<g fill="' + hexA(T.foil, 0.85) + '">' +
      '<circle cx="80" cy="34" r="1.8"/><circle cx="80" cy="126" r="1.8"/>' +
      '<circle cx="34" cy="80" r="1.8"/><circle cx="126" cy="80" r="1.8"/>' +
      '</g></svg>';

    html += '<div class="bk-cap">' + T.code + '　·　' + T.name + '</div>';
    html += '<div class="bk-mark">抽 词 成 册</div>';

    el.innerHTML = html;
    return el;
  }

  /* ── Canvas 导出 ────────────────────────────────────────── */
  function drawToCanvas(ctx, W, H, word, opts) {
    opts = opts || {};
    var sp = spec(word);
    var th = sp.theme, tier = sp.tier, R = sp.rarity;
    var T = global.TIERS[tier];
    var st = statsOf(word);
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

    // 页眉
    ctx.font = '9.5px "Songti SC", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = hexA(th.ink, th.dark ? 0.72 : 0.58);
    ctx.fillText(global.TAGS[word.tag] || '词语', R.pad + 3, sp.hdTop + 8);
    ctx.textAlign = 'right';
    ctx.fillStyle = th.dark ? hexA(T.foil, 0.9) : T.color;
    ctx.fillText(T.name, CARD_W - R.pad - 3, sp.hdTop + 8);

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

    // 音标
    ctx.textAlign = 'center';
    ctx.fillStyle = hexA(th.ink, th.dark ? 0.62 : 0.55);
    ctx.font = 'italic 11px Georgia, serif';
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

    // 属性
    ctx.fillStyle = hexA(th.ink, th.dark ? 0.7 : 0.62);
    ctx.font = '11px "Songti SC", serif';
    var stats = [['力', st.str], ['智', st.wis], ['韵', st.res]];
    var gap = 46, x0 = CARD_W / 2 - gap;
    stats.forEach(function (v, i) {
      var cx2 = x0 + i * gap;
      ctx.fillStyle = hexA(th.ink, 0.4);
      ctx.font = '10px "Songti SC", serif';
      ctx.fillText(v[0], cx2 - 8, sp.statY + 11);
      ctx.fillStyle = hexA(th.ink, th.dark ? 0.8 : 0.66);
      ctx.font = '12px Georgia, serif';
      ctx.fillText(String(v[1]), cx2 + 6, sp.statY + 11);
    });

    // 页脚
    ctx.textAlign = 'center';
    ctx.fillStyle = hexA(th.ink, th.dark ? 0.55 : 0.42);
    ctx.font = '9px Georgia, serif';
    ctx.fillText(sp.serial, CARD_W / 2, sp.footY + 8);

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
    cardLevel: cardLevel,
    CARD_W: CARD_W,
    CARD_H: CARD_H,
    RARITY: RARITY,
    THEMES: THEMES,
    themedFor: themedFor,
    render: render,
    emblemSVG: emblemSVG,
    letterKind: letterKind,
    dominantKind: dominantKind,
    KINDS: KINDS,
    renderBack: renderBack,
    spec: spec,
    frameSpec: frameSpec,
    drawToCanvas: drawToCanvas,
    hexA: hexA,
    sizeFor: sizeFor,
  };
})(window);
