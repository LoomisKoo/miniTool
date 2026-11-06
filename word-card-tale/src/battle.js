/* 词卡弹幕肉鸽 · 子弹=卡片字母字形 · 字母属性决定弹种特效 */
(function (global) {
  'use strict';

  var WAVES = 5;
  var BOSS_NAMES = ['班主任', '教导主任', '阅卷组长', '命题人', '总监考官'];
  var MAX_HP = 3;
  var PICK = 1;

  function bossNames() {
    var r = api && api.region;
    if (r && r.bosses && r.bosses.length) return r.bosses;
    return BOSS_NAMES;
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // 原地压缩数组（等价于 arr = arr.filter(fn)，但不产生新数组）
  function compact(arr, fn) {
    var j = 0;
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (fn(v)) arr[j++] = v;
    }
    arr.length = j;
    return arr;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function hexA(hex, a) {
    if (hex && hex.indexOf('hsl(') === 0) return 'hsla(' + hex.slice(4, -1) + ',' + a + ')';
    if (global.Card && global.Card.hexA) return global.Card.hexA(hex, a);
    return hex;
  }

  function shotKind(word) {
    if (global.Card && global.Card.dominantKind) return global.Card.dominantKind(word);
    var p = String(word.pos || '').toLowerCase();
    if (p.indexOf('adv') === 0) return 'shield';
    if (p.indexOf('adj') === 0) return 'frost';
    if (p.indexOf('v') === 0) return 'pierce';
    return 'blast';
  }
  function letterKind(ch, fallback) {
    if (global.Card && global.Card.letterKind) return global.Card.letterKind(ch);
    return fallback || 'blast';
  }
  function kindLabel(k) {
    var K = global.Card && global.Card.KINDS;
    return (K && K[k] && K[k].nm) || '普通';
  }
  function kindColor(k) {
    var K = global.Card && global.Card.KINDS;
    return (K && K[k] && K[k].c) || '#f0d78c';
  }
  function kindGlow(k) {
    return hexA(kindColor(k), 0.55);
  }

  /* ══ 品阶 ══════════════════════════════════════════════════
     1 N / 2 R / 3 SR / 4 SSR / 5 UR / 6 EX（隐藏款）
     子弹一律小号；品阶决定：伤害系数、满级弹幕形态、华丽度、大招演出。
     火力格数（maxP）由卡片等级决定，见 MAXP_BY_LV；所有卡开局都是 P1，差距靠局内吃 P 拉开。 */
  var TIER_FX = {
    1: { tag: 'N',   dmg: 1.00, maxP: 3, evolve: 0, fx: 0, crit: .08 },
    2: { tag: 'R',   dmg: 1.12, maxP: 3, evolve: 0, fx: 1, crit: .09 },
    3: { tag: 'SR',  dmg: 1.26, maxP: 4, evolve: 0, fx: 2, crit: .10 },
    4: { tag: 'SSR', dmg: 1.42, maxP: 4, evolve: 0, fx: 3, crit: .11 },
    5: { tag: 'UR',  dmg: 1.6,  maxP: 5, evolve: 1, fx: 4, crit: .12 },
    6: { tag: 'EX',  dmg: 1.8,  maxP: 5, evolve: 1, fx: 5, crit: .14 },
  };
  // 卡片等级 → 火力格数；觉醒再 +2，武器等级上限 7
  var MAXP_BY_LV = { 1: 3, 2: 4, 3: 4, 4: 5, 5: 6, 6: 6 };
  function cardLvOfLevels(lvs) {
    if (!lvs || !lvs.length) return 1;
    return clamp(Math.min.apply(null, lvs), 1, 6);
  }
  function fxFor(rank, lvs) {
    return Object.assign({}, TIER_FX[rank], { maxP: MAXP_BY_LV[cardLvOfLevels(lvs)], evolve: 0 });
  }
  // 品阶打击感：子弹体型 / 光晕 / 命中冲击环 / 火花 / 震屏 / 射程，N → EX 逐级加码
  var TIER_HIT = {
    1: { size: 0.9,  glow: 0.8, ring: 0,   spark: 1, shake: 0,     reach: 1 },
    2: { size: 0.98, glow: 0.9, ring: 0,   spark: 2, shake: 0,     reach: 1.05 },
    3: { size: 1.06, glow: 1,   ring: 0.8, spark: 2, shake: 0.012, reach: 1.1 },
    4: { size: 1.14, glow: 1.1, ring: 1,   spark: 3, shake: 0.02,  reach: 1.18 },
    5: { size: 1.24, glow: 1.25, ring: 1.2, spark: 4, shake: 0.03, reach: 1.26 },
    6: { size: 1.34, glow: 1.4, ring: 1.45, spark: 5, shake: 0.04, reach: 1.35 },
  };
  function tierHit() { return TIER_HIT[clamp((state && state.card && state.card.rank) || 1, 1, 6)]; }
  function rankOf(letter, card) {
    if ((letter && letter.mythic) || (card && card.word && card.word.hid)) return 6;
    var t = (letter && letter.tier) || (card && card.word && card.word.tier) || 1;
    return t < 1 ? 1 : t > 5 ? 5 : t;
  }
  function tierFx(rank) { return TIER_FX[rank] || TIER_FX[1]; }
  function tierInk(rank) {
    var T = global.TIERS && global.TIERS[Math.min(5, rank)];
    if (!T) return '#f0d78c';
    return rank >= 6 ? '#ffe6a8' : (T.foil || T.color);
  }

  /* 从卡面 spec 抽出可绘制字母弹药 */
  function buildAmmo(word) {
    if (!global.Card || !global.Card.spec) return [];
    var sp = global.Card.spec(word);
    var out = [];
    var lvs = (api && api.levelsOf && api.levelsOf(word)) || [];
    for (var i = 0; i < sp.letters.length; i++) {
      var st = sp.letters[i];
      if (!st || !st.g || !st.g.d) continue;
      out.push({
        ch: st.ch,
        lv: lvs[i] || 1,
        d: st.g.d,
        gw: st.g.w,
        gh: st.g.h,
        gb: st.g.b || st.g.h * 0.8,
        treat: st.treat || 'fill',
        ink: sp.theme.ink,
        accent: sp.theme.accent,
        paper: sp.theme.paper,
        dark: sp.theme.dark,
        tier: sp.tier,
        kind: letterKind(st.ch, shotKind(word)),
        mythic: !!word.hid,
      });
    }
    return out;
  }

  var api = null, root = null, canvas = null, ctx = null;
  var W = 360, H = 560, running = false, raf = 0, lastTs = 0;
  var state = null;
  var bgStars = [];
  var tGlobal = 0;

  function el(id) { return document.getElementById(id); }

  function open(opts) {
    api = opts || {};
    root = el('battle');
    canvas = el('battleCanvas');
    if (!root || !canvas) return;
    ctx = canvas.getContext('2d');
    stopLoop();
    pauseHangar();
    seedBg();
    root.classList.add('open');
    // 战斗是覆盖层，底下的漫游页仍在跑一堆 infinite CSS 动画（卡面光带、旋转射线…）。
    // 战斗期间把它从绘制里摘掉，合成器只处理战斗层。
    if (document.body) document.body.classList.add('in-battle');
    if (api.cards && api.cards.length) startRun(api.cards);
    else showSelect();
  }
  // 战斗是 fixed 覆盖层，漫游页并没有被隐藏 —— 机库里那台"满配预览"的
  // 弹幕循环（Battle.preview）会继续以屏幕刷新率满速跑，等于同屏两套渲染。
  // 进战斗时先把它停掉；退出时 app.js 的 onExit → renderExpedition 会重新启动。
  function pauseHangar() {
    var pv = document.getElementById('expShip');
    if (!pv) return;
    pv._stop = true;
    if (pv._raf) { cancelAnimationFrame(pv._raf); pv._raf = null; }
  }
  // 退出战斗时把机库预览接回（选卡面板直接关闭不会走 app 的 onExit）
  function resumeHangar() {
    var pv = document.getElementById('expShip');
    if (!pv || pv._stop !== true) return;
    pv._stop = false;
    if (pv._lastCard && global.Battle) global.Battle.preview(pv, pv._lastCard, pv._lastLv, pv._lastOpts || {});
  }
  // 由首页「漫游」直接带卡开局
  function start(cards, opts) {
    opts = opts || {};
    opts.cards = cards;
    open(opts);
  }
  function close() {
    stopLoop();
    if (root) root.classList.remove('open');
    if (document.body) document.body.classList.remove('in-battle');
    var ov = el('battlePauseOver');
    if (ov) ov.classList.remove('on');
    resumeHangar();
    setPanel('select');
  }
  function setPanel(name) {
    ['select', 'play', 'charge', 'upgrade', 'result'].forEach(function (n) {
      var p = el('battle-' + n);
      if (p) p.classList.toggle('on', n === name);
    });
  }
  function seedBg() {
    bgStars = [];
    var alphabet = 'ABCDEFGHKLMNOPRSTUVWXYZ';
    for (var i = 0; i < 48; i++) {
      bgStars.push({
        x: Math.random(), y: Math.random(),
        s: rnd(0.6, 2.2), a: rnd(0.08, 0.28),
        sp: rnd(4, 18),
        ch: alphabet[(Math.random() * alphabet.length) | 0],
      });
    }
  }

  /* ── 选卡 ─────────────────────────────────────── */
  function ownedPool() {
    var list = [], owned = (api.getOwned && api.getOwned()) || {}, WORDS = global.WORDS || [];
    for (var i = 0; i < WORDS.length; i++) {
      if (owned[WORDS[i].w]) list.push(api.viewOf ? api.viewOf(WORDS[i]) : WORDS[i]);
    }
    // 只出战已拥有的卡：卡片等级高的在前，同级按最近获得
    list.sort(function (a, b) {
      return (b.lvl || 1) - (a.lvl || 1) || ((owned[b.w] || {}).at || 0) - ((owned[a.w] || {}).at || 0);
    });
    return list;
  }

  function showSelect() {
    setPanel('select');
    stopLoop();
    var pool = ownedPool();
    var box = el('battlePick');
    if (!box) return;
    box.innerHTML = '';
    if (!pool.length) {
      box.innerHTML = '<div class="bpick-empty">还没有词卡<br><span>先去抽卡，再来漫游</span></div>';
      var sb = el('battleStart');
      if (sb) sb.disabled = true;
      var tp = el('battlePickTip');
      if (tp) tp.textContent = '暂无可出战的卡';
      return;
    }
    var chosen = {}, count = 0;
    pool.slice(0, PICK).forEach(function (w) { chosen[w.w] = 1; count++; });

    function syncStart() {
      var btn = el('battleStart');
      if (btn) btn.disabled = count !== PICK;
      var tip = el('battlePickTip');
      if (tip) tip.textContent = '已选 ' + count + ' / ' + PICK;
    }

    pool.forEach(function (w) {
      var kind = shotKind(w);
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'bpick-card' + (chosen[w.w] ? ' on' : '');
      var C = global.Card;
      if (C && C.render && C.CARD_W) item.appendChild(pickCardThumb(w, C));
      else {
        var thumb = document.createElement('canvas');
        thumb.width = 72; thumb.height = 72;
        thumb.className = 'bpick-thumb';
        drawLetterThumb(thumb.getContext('2d'), buildAmmo(w)[0], kind, 72);
        item.appendChild(thumb);
      }
      item.onclick = function () {
        if (PICK === 1) {
          chosen = {};
          count = 0;
          var all = box.querySelectorAll('.bpick-card');
          for (var ai = 0; ai < all.length; ai++) all[ai].classList.remove('on');
          chosen[w.w] = 1;
          count = 1;
          item.classList.add('on');
        } else if (chosen[w.w]) {
          delete chosen[w.w]; count--; item.classList.remove('on');
        } else if (count < PICK) {
          chosen[w.w] = 1; count++; item.classList.add('on');
        }
        syncStart();
      };
      box.appendChild(item);
    });
    syncStart();
    el('battleStart').onclick = function () {
      var cards = pool.filter(function (w) { return chosen[w.w]; }).slice(0, PICK);
      if (cards.length < PICK) return;
      startRun(cards);
    };
    el('battleCloseSelect').onclick = close;
  }

  // 选卡缩略图：直接复用收藏页的卡面渲染，保证两边长得一样
  function pickCardThumb(w, C) {
    var vw = Math.min(430, global.innerWidth || 390);
    var width = Math.round((vw - 46) / 2);
    var scale = width / C.CARD_W;
    var box = document.createElement('div');
    box.className = 'cthumb bpick-thumb2';
    box.style.width = width + 'px';
    box.style.height = Math.round(C.CARD_H * scale) + 'px';
    box.style.borderRadius = Math.max(4, Math.round(16 * scale)) + 'px';
    var inner = C.render(w, {
      mastery: (api.starsOf && api.starsOf(w)) || 0,
      levels: api.levelsOf ? api.levelsOf(w) : null,
      compact: true, lite: true,
    });
    inner.classList.add('cthumb-in');
    inner.style.transform = 'scale(' + scale + ')';
    box.appendChild(inner);
    return box;
  }

  function drawLetterThumb(c, letter, kind, size) {    c.clearRect(0, 0, size, size);
    c.fillStyle = 'rgba(20,14,10,.92)';
    c.fillRect(0, 0, size, size);
    if (!letter) {
      c.fillStyle = kindColor(kind);
      c.font = '600 28px Georgia, serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('?', size / 2, size / 2);
      return;
    }
    drawTileLetter(c, letter, size / 2, size / 2, size * 0.92, 0, false);
  }

  /* 战场上的字母瓦片：形状 / 底色 / 纹样 / 描边都跟卡面走 */
  var SHAPE_CACHE = {};
  function shape2d(shape) {
    if (SHAPE_CACHE[shape] !== undefined) return SHAPE_CACHE[shape];
    var P = global.Card && global.Card.SHAPE_PATH;
    var d = (P && P[shape]) || (P && P.square) || 'M4 4H96V96H4Z';
    var p = null;
    try { p = new Path2D(d); } catch (e) { p = null; }
    SHAPE_CACHE[shape] = p;
    return p;
  }

  function drawTileLetter(c, letter, x, y, size, rot, strong) {
    if (!letter || !letter.d) return;
    var look = (global.Card && global.Card.tileLook)
      ? global.Card.tileLook(letter.ch, letter.lv, { mythic: letter.mythic })
      : { shape: 'square', bg: '#2b2350', fg: '#fff', ln: '#c9a227', lv: 1, pattern: null };
    var S = size / 100;
    var path = shape2d(look.shape);

    c.save();
    c.translate(x, y);
    c.rotate(rot || 0);
    c.scale(S, S);
    c.translate(-50, -50);   // 形状路径是 0..100，平移回中心，避免瓦片偏移与裁切

    // 底色
    if (path) {
      var g = c.createLinearGradient(0, 0, 0, 100);
      g.addColorStop(0, hexA(look.bg, 1));
      g.addColorStop(1, hexA(look.bg, 0.82));
      c.fillStyle = g;
      c.fill(path);

      // 纹样：按等级画，裁剪在形状内
      if (look.pattern) {
        c.save();
        c.clip(path);
        c.fillStyle = hexA(look.ln, 0.2);
        c.strokeStyle = hexA(look.ln, 0.22);
        c.lineWidth = 2;
        var kindP = look.pattern;
        if (kindP === 'grid' || kindP === 'cross') {
          for (var i = 8; i < 100; i += 16) {
            c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 100); c.stroke();
            c.beginPath(); c.moveTo(0, i); c.lineTo(100, i); c.stroke();
          }
        } else if (kindP === 'checker') {
          for (var cx = 0; cx < 100; cx += 20) {
            for (var cy = 0; cy < 100; cy += 20) {
              if (((cx + cy) / 20) % 2 === 0) c.fillRect(cx, cy, 20, 20);
            }
          }
        } else if (kindP === 'waves') {
          for (var wy = 12; wy < 100; wy += 18) {
            c.beginPath();
            for (var wx = 0; wx <= 100; wx += 10) {
              c.lineTo(wx, wy + Math.sin(wx / 12) * 4);
            }
            c.stroke();
          }
        } else if (kindP === 'gems' || kindP === 'stars') {
          for (var gx = 10; gx < 100; gx += 22) {
            for (var gy = 10; gy < 100; gy += 22) {
              c.beginPath();
              c.moveTo(gx, gy - 4); c.lineTo(gx + 4, gy);
              c.lineTo(gx, gy + 4); c.lineTo(gx - 4, gy);
              c.closePath(); c.fill();
            }
          }
        } else {
          for (var dx = 8; dx < 100; dx += 14) {
            for (var dy = 8; dy < 100; dy += 14) {
              c.beginPath(); c.arc(dx, dy, 2, 0, 6.2832); c.fill();
            }
          }
        }
        c.restore();
      }

      // 描边
      var edge = look.lv >= 5 ? '#f6d77a' : look.ln;
      c.strokeStyle = edge;
      c.lineWidth = look.lv >= 5 ? 5.5 : look.lv >= 3 ? 4 : 2.8;
      c.stroke(path);
      if (look.lv >= 3) {
        c.strokeStyle = hexA(look.ln, 0.55);
        c.lineWidth = 1.4;
        c.save(); c.translate(50, 50); c.scale(0.84, 0.84); c.translate(-50, -50);
        c.stroke(path); c.restore();
      }
    }

    // 字形
    var k = 62 / Math.max(letter.gw, letter.gh);
    var gx = 50 - (letter.gw * k) / 2;
    var gy = 50 + 30 - letter.gb * k;
    c.save();
    c.translate(gx, gy);
    c.scale(k, k);
    var gp = null;
    try { gp = new Path2D(letter.d); } catch (e) { gp = null; }
    if (gp) {
      c.fillStyle = look.fg;
      c.fill(gp);
      if (strong) {
        c.strokeStyle = 'rgba(255,255,255,.6)';
        c.lineWidth = 2 / k;
        c.stroke(gp);
      }
    }
    c.restore();
    c.restore();
  }

  /* ── 合成音效：Web Audio 实时生成，0 体积 ─────────── */
  // 音效统一由 sfx.js 提供（全局 Sfx），对局内外共用一套合成音色
  var Sfx = global.Sfx || {
    play: function () {}, unlock: function () {}, isOn: function () { return true; },
    toggle: function () { return true; }, recent: function () { return false; },
  };

  /* ── 开局 ─────────────────────────────────────── */
  var BOSS_AT = 60;          // 第 60 秒首领登场，整关约 75 秒
  var hudTop = 44, hudBot = 64, eid = 0;
  var hudRowY = 26, hudSide = 58;   // 顶部按钮行的中线 / 两侧按钮占用宽度（拼词条夹在中间）
  /* 大招充能：开局 0 格，随时间充满一格，最多存 3 格；品阶越高充得越快（N 40 秒 → EX 20 秒），放大招期间暂停充能 */
  var ULT_CHARGE_T = { 1: 40, 2: 36, 3: 32, 4: 28, 5: 24, 6: 20 };
  function chargeUlt(dt) {
    if (state.ult || state.phase === 'clear') return;
    if (state.bombs >= 3) { state.charge = 0; return; }
    state.charge += dt / (ULT_CHARGE_T[state.card.rank] || 36);
    if (state.charge >= 1) {
      state.charge = 0;
      state.bombs++;
      Sfx.play('item');
      popText(state.player.x, state.player.y - 30, ULT_NAME[state.card.kind] + ' 就绪', '#ffd36b');
      renderHud();
    }
    var bb = el('battleBomb'), pc = Math.round(state.charge * 100);
    if (bb && bb._pc !== pc) { bb._pc = pc; bb.style.setProperty('--c', (pc / 100).toFixed(2)); }
  }
  // 大招按钮图标（24×24 描边路径）
  var ULT_ICON = {
    blast: '<path d="M19 5 9 15"/><path d="M15 3 7 11"/><path d="M21 9 13 17"/><circle cx="7" cy="17" r="3.2"/>',
    pierce: '<path d="M12 2v20"/><path d="M8 4v16M16 4v16" opacity=".5"/><path d="M5 12h2M17 12h2"/>',
    swift: '<path d="M4 20 12 4l8 16"/><path d="M8 20l4-8 4 8"/>',
    thunder: '<path d="M13 2 5 13h6l-1 9 8-12h-6z"/>',
    frost: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><circle cx="12" cy="12" r="2.5"/>',
    tide: '<path d="M2 15c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/><path d="M2 20c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/><path d="M6 10c0-4 4-7 9-6-3 1-4 3-3 6"/>',
    blade: '<path d="M4 20C8 10 14 5 21 3c-2 7-7 13-17 17z"/><path d="M4 20l5-5"/>',
  };
  var ULT_NAME = { blast: '流星', pierce: '光柱', swift: '蜂群', thunder: '雷暴', frost: '冻结', shield: '字环', tide: '狂潮', blade: '刃舞' };
  var ULT_FULL = { blast: '字母流星雨', pierce: '巨型光柱', swift: '字母蜂群', thunder: '连锁雷暴', frost: '时间冻结', shield: '扩散字环', tide: '海啸巨浪', blade: '千刃风暴' };
  // 觉醒时长随单词长度增加：长词难拼，奖励更久（3 字母约 7 秒 → 12 字母以上 14 秒）
  function awakenT() { return clamp(5 + spellLen() * 0.75, 6, 14); }
  var ULT_PASSES = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3 }, ULT_PASS_T = 1.7;
  var TIDE_WAVES = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3 }, TIDE_WAVE_T = 0.95;

  function makeCard(w) {
    // tier 是单词稀有度；卡片等级保存在字母等级中，不再覆盖 tier
    var rank = w.hid ? 6 : clamp(w.rarity || w.tier || 1, 1, 5);
    var lvs = (api.levelsOf && api.levelsOf(w)) || null;
    var wk = (global.Card && global.Card.weaponKinds) ? global.Card.weaponKinds(w, lvs)
      : { main: shotKind(w), sub: null, ammo: {} };
    var kind = wk.main, sub = wk.sub;
    // 弹药等级 1–6：字母越高级，伤害越高、弹道越华丽；EX 再 +1
    var vt = {};
    for (var k in wk.ammo) vt[k] = clamp(wk.ammo[k] + (rank >= 6 ? 1 : 0), 1, 6);
    return {
      word: w, kind: kind, sub: sub, rank: rank, fx: fxFor(rank, lvs), vt: vt,
      stars: (api.starsOf && api.starsOf(w)) || 0,
      ammo: buildAmmo(w), cursor: 0,
      color: kindColor(kind), ink: tierInk(rank),
      trait: traitProfile(w, lvs),
    };
  }
  // 每个字母只强化自己对应的武器，数量会增加效果，但不会把整张卡的所有属性重复叠到一起。
  function traitProfile(w, lvs) {
    var out = {};
    if (!global.Card || !global.Card.letterTraits) return out;
    global.Card.letterTraits(w, lvs).forEach(function (t) {
      out[t.kind] = out[t.kind] || { count: 0, levels: 0, value: 0 };
      out[t.kind].count++;
      out[t.kind].levels += t.level || 1;
      out[t.kind].value += t.value || 0;
    });
    return out;
  }
  function traitAmp(kind) {
    var p = state.card.trait && state.card.trait[kind];
    if (!p) return 1;
    if (kind === 'shield') return 1;
    // 每个同类字母提供少量稳定增益；升级提供更明显的增益，避免长度造成成倍差距。
    return 1 + p.count * 0.012 + Math.max(0, p.levels - p.count) * 0.02;
  }
  function shieldCooldownMul() {
    var p = state.card.trait && state.card.trait.shield;
    return p ? Math.max(0.5, 1 - p.value / 100) : 1;
  }
  function baseDmg() {
    var c = state.card;
    return 4 * c.fx.dmg * (1 + 0.08 * c.stars) *
      (state.memoryEcho ? 1.1 : 1);
  }
  function spellLen() {
    var c = state.card;
    return c.ammo.length || String(c.word.w || '').length || 1;
  }
  function spellChar(i) {
    var c = state.card;
    if (c.ammo[i]) return c.ammo[i].ch.toUpperCase();
    return String(c.word.w || '').charAt(i).toUpperCase();
  }
  function rankColor(i) {
    var c = state.card;
    if (c.rank >= 6) return 'hsl(' + (((i || 0) * 37 + tGlobal * 240) % 360) + ',100%,70%)';
    if (c.rank >= 5) return '#ffd36b';
    return c.ink;
  }

  function startRun(cards) {
    if (api.onStart && api.onStart() === false) return;
    var card = makeCard(cards[0]);
    var stage = clamp(api.stage || 0, 0, 4);
    var regionId = (api.region && api.region.id) || 'london';
    var th = global.StageArt ? global.StageArt.theme(regionId, stage) : { title: '', drone: 'scone', shooter: 'teacup', elite: 'bus', boss: 'bigben' };
    state = {
      region: api.region || null, regionId: regionId, stage: stage, theme: th,
      card: card, cards: [card],
      level: stage + 1, t: 0, phase: 'stage', script: [], boss: null, clearT: 0,
      hp: MAX_HP, shield: card.kind === 'shield' ? 1 : 0,
      power: 1, bombs: 0, charge: 0,
      player: { x: W / 2, y: H - 110, r: 3.5, bank: 0 },
      wp: { main: { kind: card.kind, t: 0 }, sub: card.sub ? { kind: card.sub, t: 0.05 } : null },
      shots: [], eshots: [], enemies: [], items: [], particles: [], pops: [], arcs: [], beams: [], orbs: [], orbA: 0, orbCd: {},
      spell: 0, wordsDone: 0, wordShow: 0, spellFlash: 0, awaken: 0, memoryEcho: false, banner: null,
      ult: null, frozen: false, invuln: 0, shake: 0, flash: 0, hurtFlash: 0, warnT: 0,
      kills: 0, perfect: true, ended: false, paused: false, seen: {}, seenList: [], codexGot: [],
      drag: null, keys: {}, inkBonus: 0, hitSfxT: 0, zapT: 0, impT: 0,
    };
    var KD = global.Card && global.Card.KINDS && global.Card.KINDS[card.kind];
    state.banner = { t: 2.4, text: '主武器 · ' + kindLabel(card.kind), sub: (KD && KD.tip) || '' };
    setPanel('play');
    var pov = el('battlePauseOver');
    if (pov) pov.classList.remove('on');
    resize();
    state.player.x = W / 2;
    state.player.y = H - hudBot - 60;
    bindPlay();
    beginLevel();
    startLoop();
  }

  function resize() {
    var wrap = el('battleStage');
    if (!wrap || !canvas) return;
    var rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    W = Math.max(280, Math.floor(rect.width));
    H = Math.max(420, Math.floor(rect.height));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var top = root && root.querySelector('.sx-top');
    if (top) hudTop = Math.max(36, Math.round(top.getBoundingClientRect().bottom - rect.top));
    var qb = root && root.querySelector('#battleQuit');
    if (qb) {
      var qr = qb.getBoundingClientRect();
      if (qr.height) {
        hudRowY = Math.round(qr.top - rect.top + qr.height / 2);
        hudSide = Math.round(qr.right - rect.left + 10);
      }
    }
    // 拼词行下方再留一条：关卡信息 / 首领血条
    hudTop += 22;
    var bot = root && root.querySelector('.sx-bottom');
    if (bot) hudBot = Math.max(48, Math.round(rect.bottom - bot.getBoundingClientRect().top));
    if (state) clampPlayer();
  }
  function clampPlayer() {
    var p = state.player;
    p.x = clamp(p.x, 14, W - 14);
    p.y = clamp(p.y, hudTop + 70, H - hudBot - 16);
  }

  function regionPlace() {
    return (state.region && state.region.place) || '漫游';
  }
  /* 全局难度档：地区和关内进度一起算，1 = 第一个地区第一关。
     （原来只按「地区内第几关」算，换地区后进度清零；need 又在上限处截断，
      于是后期根本没有变难，全靠玩家自己变强）
     progressTier 把地区解锁需求（0~348）折算成 0~1 的流程进度，
     这样 30 个地区 150 关的难度能一路爬到满档，而不是在 need 240 处封死。 */
  function progressTier() {
    var need = (state.region && state.region.need) || 0;
    return clamp(Math.min(need, 360) / 360, 0, 1);
  }
  function diffTier() {
    return clamp(1 + 0.7 * (state.stage || 0) + progressTier() * 12, 1, 18);
  }
  // 弹幕密度倍率：新手关只有六成，后期最高 1.5 倍
  function bScale() { return clamp(0.5 + 0.08 * diffTier(), 0.55, 1.5); }
  // 按难度缩放弹数，至少 1 发
  function bCount(n) { return Math.max(1, Math.round(n * bScale())); }

  function levelMul() {
    // 关内 1~5 关 × 地区流程进度，150 关全程约 1 → 3 倍
    return (1 + 0.15 * (state.level - 1)) * (1 + 0.9 * progressTier());
  }
  // 精英 / 首领血量按关卡和地区渐进：前期宽松，后期增加但不让高战力被反向拖慢
  function bossMul() {
    return (1 + 0.11 * (state.level - 1)) * (1 + 1.1 * progressTier());
  }
  // 逆平衡：卡牌越强（阶级 / 武器等级 / 字母等级），敌人弹速和刷怪密度同步上升，
  // 但血量不跟着涨 —— 否则升级在战斗里没有体感，无尽模式的分数也失去意义
  function cardPowerMul() {
    var c = state.card;
    if (!c) return 1;
    var vt = 1;
    for (var k in c.vt) vt = Math.max(vt, c.vt[k] || 1);
    var lv = Math.min(7, state.power + (c.fx.evolve && state.power >= c.fx.maxP ? 1 : 0));
    var m = 1 + 0.07 * ((c.rank || 1) - 1) + 0.055 * (lv - 1) + 0.05 * (vt - 1);
    return Math.min(1.75, m);
  }
  // 小怪只吃一半加成，保持清场的爽快感
  /* 自适应强度：实测本局输出（每 2 秒结算一次、只统计屏上有怪且不在大招/觉醒期间的伤害），
     与 N 卡开局的参考输出比得到 dpsRatio。小怪血量按 ratio^0.6 跟随、精英首领按 ratio^0.5 跟随，
     刷怪密度也随 ratio 提升 —— 强卡依旧杀得更快更爽，但不会一出来就秒、挂机通关；弱卡也不会被血量卡住 */
  var REF_DPS = 30;
  function initDps() {
    var c = state.card, vt = 1;
    for (var k in c.vt) vt = Math.max(vt, c.vt[k] || 1);
    state.dps = baseDmg() * 7.5 * (1 + 0.15 * (vt - 1)) * (1 + 0.12 * ((c.rank || 1) - 1));
    state.dmgAcc = 0; state.dpsT = 0;
  }
  function trackDps(dt) {
    if (state.ult || state.awaken > 0) return;
    var on = false;
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (!e.dead && e.y > hudTop && e.y < H - hudBot) { on = true; break; }
    }
    if (!on) return;
    state.dpsT += dt;
    if (state.dpsT >= 2) {
      state.dps = state.dps * 0.6 + (state.dmgAcc / state.dpsT) * 0.4;
      state.dmgAcc = 0; state.dpsT = 0;
    }
  }
  function dpsRatio() { return clamp((state.dps || REF_DPS) / REF_DPS, 0.6, 8); }
  function mobMul() { return Math.pow(dpsRatio(), 0.6); }
  function bigMul() { return Math.min(1.2, Math.max(1, Math.pow(dpsRatio(), 0.16))); }
  /* 关卡风格：每个地区 5 关各有不同的出怪编队与入场方向（含从底部包抄），shB = 射手从底部进场的概率 */
  var STAGE_STYLE = [
    { forms: ['line', 'v', 'sweepL', 'sweepR'], shB: 0 },
    { forms: ['v', 'dive', 'sweepL', 'rise', 'sweepR'], shB: 0.15 },
    { forms: ['line', 'rise', 'pincer', 'v', 'dive'], shB: 0.3 },
    { forms: ['sweepL', 'pincer', 'flank', 'rise', 'sweepR', 'v'], shB: 0.35 },
    { forms: ['v', 'rise', 'flank', 'pincer', 'dive', 'line', 'ring'], shB: 0.4 },
  ];
  function stageStyle() {
    var rid = state.regionId || '', rh = 0;
    for (var i = 0; i < rid.length; i++) rh = (rh * 31 + rid.charCodeAt(i)) % 997;
    var st = STAGE_STYLE[clamp(state.stage || 0, 0, 4)];
    // 同一关在不同地区换个出场顺序
    var f = st.forms.slice(), r = rh % f.length;
    return { forms: f.slice(r).concat(f.slice(0, r)), shB: st.shB };
  }
  // 屏上补怪：小怪太少时按输出补一波，强卡场面更满
  function fillMobs(dt) {
    if (state.phase !== 'stage' || state.t < 8 || state.t > BOSS_AT - 6) return;
    state.fillT = (state.fillT || 0) - dt;
    if (state.fillT > 0) return;
    var r = dpsRatio(), n = 0;
    state.fillT = Math.max(2.1, 3.5 / Math.sqrt(r));
    state.enemies.forEach(function (e) { if (!e.dead && e.type === 'drone') n++; });
    if (n < Math.min(4, 2 + r * 0.55)) {
      var f = stageStyle().forms;
      spawnForm(f[(Math.random() * f.length) | 0]);
    }
  }
  function shotSpd() { return (1 + 0.045 * (diffTier() - 1)) * (1 + (cardPowerMul() - 1) * 0.2) * (0.86 + 0.16 * powerProg()); }
  // 局内火力进度 0..1：P1 = 0，满火力（含进化）= 1
  function powerProg() {
    var c = state.card;
    return clamp((state.power - 1) / Math.max(1, c.fx.maxP - 1), 0, 1);
  }
  /* 动态压力（敌人开火频率倍率）：
     - 火力没升起来时敌人开火慢，升满后明显加压，避免"前期打不过、后期无敌"
     - 没有护盾类武器（卫星挡弹）的卡整体少 12% 弹幕，有护盾的多 8%
     - 每关开局约 12 秒逐步加压，先让玩家吃到火力 */
  function fireRate() {
    var c = state.card, pw = powerProg();
    var guard = (c.kind === 'shield' || c.sub === 'shield') ? 1.08 : 0.88;
    // 首领开火频率也吃全局难度：第一关只有六成，后期最多 1.35 倍
    var ramp = state.phase === 'boss' ? clamp(0.5 + 0.1 * diffTier(), 0.5, 1.35) : clamp(0.4 + state.t / 30, 0.4, 1);
    return (0.5 + 0.5 * pw) * guard * ramp * (state.awaken > 0 ? 1.1 : 1) * clamp(0.85 + 0.08 * dpsRatio(), 0.85, 1.25);
  }
  function spriteName(id) {
    return global.StageArt ? global.StageArt.info(id) : { en: id, cn: '' };
  }

  function beginLevel() {
    state.t = 0;
    state.phase = 'stage';
    state.stats = { t: 0, hits: 0, ultUsed: 0, bossT: 0 };
    if (state.dps == null) initDps();
    state.script = buildScript(state.level);
    // 开局补给：先给一波字母和一份火力，避免"怪已经压下来但子弹还不够"
    var p = state.player, n = state.level <= 2 ? 4 : 3;
    for (var i = 0; i < n; i++) {
      state.items.push({
        type: 'L', x: p.x + (i - (n - 1) / 2) * 26, y: p.y - 40 - Math.abs(i - (n - 1) / 2) * 6,
        vx: 0, vy: 0, t: 0, start: true,
      });
    }
    if (state.level >= 2 || state.power < 2) {
      state.items.push({ type: 'P', x: p.x, y: p.y - 96, vx: 0, vy: 0, t: 0, start: true });
    }
    renderHud();
    toastInGame(regionPlace() + ' · ' + state.theme.title);
  }

  function buildScript(lv) {
    var s = [], forms = stageStyle().forms, i = 0;
    // 波次间隔随关卡小幅收紧（早期更宽松），避免开局就铺满屏
    var gap = Math.max(2.0, 3.4 - lv * 0.22);
    for (var t = 3.5; t < BOSS_AT - 5; t += gap) s.push({ at: t, ev: 'form', form: forms[i++ % forms.length] });
    // 射手：后半段加密，形成"波次压力"而不是纯粹刷小怪
    var shooters = lv >= 4 ? [12, 20, 28, 36, 44, 52]
      : lv >= 2 ? [16, 26, 36, 46, 56]
      : [18, 30, 42, 54];
    shooters.forEach(function (t) { s.push({ at: t, ev: 'shooter' }); });
    // 顶级卡额外追加射手：越强压力越大
    var extra = Math.round((cardPowerMul() - 1) * 5);
    for (var x2 = 0; x2 < extra; x2++) s.push({ at: 18 + x2 * ((BOSS_AT - 24) / Math.max(1, extra)), ev: 'shooter' });
    // 精英：低关 1 个，高关 3 个
    var elites = lv >= 4 ? [20, 36, 50] : lv >= 2 ? [20, 40] : [22];
    elites.forEach(function (t) { s.push({ at: t, ev: 'elite' }); });
    s.push({ at: BOSS_AT - 3, ev: 'warn' });
    s.push({ at: BOSS_AT, ev: 'boss' });
    s.sort(function (a, b) { return a.at - b.at; });
    return s;
  }
  function runScript() {
    while (state.script.length && state.script[0].at <= state.t) {
      var e = state.script.shift();
      if (e.ev === 'form') spawnForm(e.form);
      else if (e.ev === 'shooter') spawnShooter();
      else if (e.ev === 'elite') spawnElite();
      else if (e.ev === 'warn') { state.warnT = WARN_T; Sfx.play('warn'); }
      else if (e.ev === 'boss') spawnBoss();
    }
  }

  function toastInGame(msg) {
    var t = el('battleToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('show'); }, 1100);
  }

  function renderHud() {
    if (!state) return;
    var wv = el('battleWave');
    if (wv) wv.innerHTML = '<em>' + regionPlace() + '</em><b>' + (state.stage + 1) + '<i>/5</i></b><span>' + (state.theme.title || '') + '</span>';
    var bb = el('battleBomb');
    if (bb) {
      var nm = ULT_NAME[state.card.kind] || '大招';
      var ic = bb.querySelector('svg');
      if (ic && ic._k !== state.card.kind) { ic._k = state.card.kind; ic.innerHTML = ULT_ICON[state.card.kind] || ULT_ICON.blast; }
      bb.setAttribute('aria-label', nm);
      var lab = el('battleBombLab');
      if (lab && lab.textContent !== nm) lab.textContent = nm;
      bb.classList.toggle('ready', state.bombs > 0);
      bb.setAttribute('data-n', state.bombs);
      var dots = '';
      for (var i = 0; i < 3; i++) dots += '<i class="' + (i < state.bombs ? 'on' : '') + '"></i>';
      var d = el('battleBombDots');
      if (d) d.innerHTML = dots;
      bb.disabled = state.bombs <= 0;
    }
    var sb = el('battleSound');
    if (sb) sb.classList.toggle('off', !Sfx.isOn());
  }

  /* ── 输入：相对拖动，上下左右自由走位；键盘方向键/WASD，空格大招 ── */
  function bindPlay() {
    var stage = el('battleStage');
    if (!stage || stage._bound) return;
    stage._bound = true;
    stage.addEventListener('pointerdown', function (e) {
      Sfx.unlock();
      if (!state || state.paused) return;
      if (e.target.closest && e.target.closest('.sx-btn, .sx-bomb')) return;
      state.drag = { px: e.clientX, py: e.clientY, x0: state.player.x, y0: state.player.y };
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener('pointermove', function (e) {
      if (!state || !state.drag || state.paused) return;
      var d = state.drag, p = state.player;
      var nx = d.x0 + (e.clientX - d.px) * 1.2;
      p.bank = clamp((nx - p.x) * 0.08, -1, 1);
      p.x = nx;
      p.y = d.y0 + (e.clientY - d.py) * 1.2;
      clampPlayer();
    });
    function up() { if (state) state.drag = null; }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    el('battleBomb').onclick = function (e) { e.stopPropagation(); Sfx.unlock(); useBomb(); };
    el('battleQuit').onclick = exitToHome;
    var snd = el('battleSound');
    if (snd) snd.onclick = function (e) { e.stopPropagation(); Sfx.play('tap'); Sfx.toggle(); renderHud(); };
    var pb = el('battlePause'), rs = el('battleResume'), q2 = el('battleQuit2');
    if (pb) pb.onclick = function (e) { e.stopPropagation(); setPaused(true); };
    if (rs) rs.onclick = function (e) { e.stopPropagation(); setPaused(false); };
    if (q2) q2.onclick = function (e) { e.stopPropagation(); exitToHome(); };
    window.addEventListener('keydown', function (e) {
      if (!state || !running) return;
      if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!state.paused); e.preventDefault(); return; }
      if (state.paused) return;
      if (e.code === 'Space') { useBomb(); e.preventDefault(); return; }
      state.keys[e.code] = 1;
    });
    window.addEventListener('keyup', function (e) { if (state) state.keys[e.code] = 0; });
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  }

  /* ── 敌人：本关主题物品 ─────────────────────────── */
  function pushEnemy(o) {
    o._id = ++eid;
    o.t = 0; o.flash = 0; o.slow = 0; o.popT = 0; o.orbCd = 0; o.cd = o.cd || 1; o.cd2 = 1.2;
    state.enemies.push(o);
    return o;
  }
  function addDrone(o) {
    o.type = 'drone';
    o.sprite = state.theme.drone;
    o.r = 13;
    o.hp = o.maxHp = 10 * levelMul() * mobMul();
    o.cd = rnd(1.6, 4);
    // 只有一部分小怪能开火，并且在开火前先亮一下准星（可躲避）
    o.gunner = Math.random() < gunnerRate();
    o.aimT = 0;
    return pushEnemy(o);
  }
  // 会开火的小怪比例：随关卡缓慢上升，最高 55%
  function gunnerRate() {
    var pw = powerProg(), ramp = clamp(state.t / 18, 0.3, 1);
    if (state.level <= 1) return 0.07 * (0.4 + 0.6 * pw) * ramp;
    return Math.min(0.3, 0.11 + 0.045 * (state.level - 1)) * (0.4 + 0.6 * pw) * ramp;
  }

  function spawnForm(form) {
    // 波次规模也跟关卡走，前两关不再一上来铺满屏
    var i, n = state.level <= 1 ? 3 : state.level === 2 ? 4 : 5;
    // 火力还没升起来 / 开局前 15 秒：编队少一到两只
    if (n > 3 && (powerProg() < 0.34 || state.t < 15)) n--;
    if (n > 3 && powerProg() < 0.34 && state.t < 15) n--;
    if (form === 'line') {
      var x0 = rnd(50, W - 50);
      for (i = 0; i < n; i++) addDrone({ x: x0, y: -20 - i * 32, vx: 0, vy: 125, path: 'sine', ph: i * 0.5 });
    } else if (form === 'v') {
      var cx = rnd(80, W - 80);
      for (i = 0; i < n; i++) {
        var k = i - 2;
        addDrone({ x: cx + k * 28, y: -20 - Math.abs(k) * 24, vx: 0, vy: 110, path: 'straight' });
      }
    } else if (form === 'sweepL' || form === 'sweepR') {
      var dir = form === 'sweepL' ? 1 : -1, y0 = rnd(hudTop + 70, H * 0.36);
      for (i = 0; i < n; i++) {
        addDrone({ x: dir > 0 ? -20 - i * 30 : W + 20 + i * 30, y: y0, vx: 120 * dir, vy: 18, path: 'sweep', ph: i * 0.6 });
      }
    } else if (form === 'rise') {
      // 从底部两侧贴边升起，越过玩家后才进入射击区
      var side = Math.random() < 0.5 ? 1 : -1, rx = side > 0 ? rnd(26, 60) : W - rnd(26, 60);
      for (i = 0; i < n; i++) addDrone({ x: rx, y: H + 20 + i * 34, vx: 0, vy: -150, path: 'sine', ph: i * 0.5 });
    } else if (form === 'pincer') {
      // 底部两角斜向上包夹
      for (i = 0; i < n; i++) {
        var lr = i % 2 ? 1 : -1;
        addDrone({ x: lr < 0 ? -20 : W + 20, y: H - hudBot - 20 + ((i / 2) | 0) * 30, vx: -lr * 95, vy: -135, path: 'straight' });
      }
    } else if (form === 'flank') {
      // 中段从侧面横穿，带一点下坠
      var fd = Math.random() < 0.5 ? 1 : -1, fy = rnd(H * 0.3, H * 0.5);
      for (i = 0; i < n; i++) addDrone({ x: fd > 0 ? -20 - i * 34 : W + 20 + i * 34, y: fy - i * 10, vx: 150 * fd, vy: -10, path: 'straight' });
    } else if (form === 'ring') {
      // 上下同时出：一半从顶部、一半从底部
      for (i = 0; i < n; i++) {
        var up2 = i % 2 === 0;
        addDrone({ x: W * (0.2 + 0.6 * i / Math.max(1, n - 1)), y: up2 ? -20 : H + 20, vx: 0, vy: up2 ? 110 : -130, path: 'straight' });
      }
    } else {
      for (i = 0; i < Math.min(4, n); i++) addDrone({ x: rnd(30, W - 30), y: -20 - i * 46, vx: 0, vy: 70, path: 'dive' });
    }
    if (state.t > 2) Sfx.play('wave');
  }
  function spawnShooter() {
    var st = stageStyle(), fromB = Math.random() < st.shB;
    var e = pushEnemy({
      type: 'shooter', sprite: state.theme.shooter, r: 17, x: rnd(40, W - 40), y: fromB ? H + 24 : -24, vx: 0, vy: fromB ? -150 : 120,
      ty: rnd(hudTop + 70, H * 0.36), stay: 6, cd: 1.1, fromB: fromB,
    });
    e.hp = e.maxHp = 50 * levelMul() * mobMul();
  }
  function spawnElite() {
    var e = pushEnemy({
      type: 'elite', sprite: state.theme.elite, r: 26, x: W / 2, y: -40, vx: 0, vy: 90,
      ty: hudTop + 90, stay: 14, cd: 1.4,
    });
    e.name = spriteName(e.sprite).cn;
    e.hp = e.maxHp = 420 * bossMul() * bigMul();
    toastInGame('精英 · ' + e.name);
  }
  function spawnBoss() {
    var e = pushEnemy({
      type: 'boss', sprite: state.theme.boss, r: 40, x: W / 2, y: -60, vx: 0, vy: 70,
      ty: hudTop + 110, cd: 1.6, phase: 1, spin: 0, landmark: state.stage === 4,
    });
    var nm = spriteName(e.sprite);
    e.name = (e.landmark ? '' : '巨无霸') + nm.cn;
    e.hp = e.maxHp = 1700 * bossMul() * bigMul() * (e.landmark ? 1.25 : 1);
    // 每个地区的前 4 关首领各分到不同的战斗风格，第 5 关地标首领是三阶段混合型
    var rid = state.regionId || '', rh = 0;
    for (var i = 0; i < rid.length; i++) rh = (rh * 31 + rid.charCodeAt(i)) % 997;
    // 第一关固定冲锋型（招式最直观、弹幕最少），第二关在冲锋 / 弹跳之间轮换，
    // 第三关起才轮到狙击 / 花弹 / 召唤这些弹幕型
    e.arch = e.landmark ? 'landmark'
      : state.stage === 0 ? 'charger'
        : state.stage === 1 ? (rh % 2 ? 'charger' : 'bouncer')
          : BOSS_ARCH[(state.stage + rh) % BOSS_ARCH.length];
    e.st = 'idle'; e.stT = 1.2; e.vis = 1; e.tele = [];
    toastInGame('首领 · ' + e.name + ' · ' + BOSS_ARCH_NM[e.arch]);
    Sfx.play('boss');
    Sfx.music('boss');
    state.boss = e;
    state.phase = 'boss';
    renderHud();
  }

  // extra：hold 悬停秒数 / curve 角速度 / acc 加速度(倍/秒) + vmax / bounce 侧墙反弹次数 / split 秒后裂成 sn 颗 rice
  var curShooter = null;
  function eshot(x, y, ang, sp, type, extra) {
    sp *= shotSpd();
    // 被冰冻的怪射出的子弹也变慢
    if (curShooter && curShooter.slow > 0 && curShooter.chill) sp *= 0.4 + curShooter.chill;
    var o = {
      x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      type: type || 'orb', r: type === 'big' ? 7 : type === 'rice' ? 3.5 : 4.5, life: 8,
    };
    if (extra) for (var k in extra) o[k] = extra[k];
    state.eshots.push(o);
    return o;
  }
  function aim(e) { return Math.atan2(state.player.y - e.y, state.player.x - e.x); }

  function updateEnemy(e, dt) {
    var mul = e.slow > 0 ? (e.chill || 0.45) : 1;
    if (e.slow > 0) { e.slow -= dt; if (e.slow <= 0) e.chill = 0; }
    curShooter = e;
    if (e.flash > 0) e.flash -= dt;
    if (e.popT > 0) e.popT -= dt;
    if (e.orbCd > 0) e.orbCd -= dt;
    e.t += dt;
    if (e.type !== 'boss') e.cd -= dt * mul * fireRate();
    var top = e.y > hudTop + 10 && e.y < H * 0.75;

    if (e.type === 'drone') {
      if (e.path === 'sine') e.x += Math.cos(e.t * 3 + e.ph) * 70 * dt;
      if (e.path === 'sweep') e.vy = Math.sin(e.t * 2 + e.ph) * 40 + 20;
      if (e.path === 'dive' && e.t > 0.9 && !e.dived) {
        e.dived = true;
        var a = aim(e);
        e.vx = Math.cos(a) * 230; e.vy = Math.max(120, Math.sin(a) * 230);
      }
      e.x += e.vx * dt * mul;
      e.y += e.vy * dt * mul;
      if (e.gunner && top) {
        if (e.cd <= 0) {
          e.cd = rnd(3.6, 6.4);
          eshot(e.x, e.y + 8, aim(e), 130, 'orb');
          Sfx.play('eshoot');
        }
      }
      if (e.x < -60 || e.x > W + 60 || (e.vy >= 0 ? e.y > H + 40 : e.y < -60)) e.gone = true;
    } else if (e.type === 'shooter') {
      if (e.stay > 0) {
        if (e.fromB ? e.y > e.ty : e.y < e.ty) e.y += (e.fromB ? -150 : 120) * dt * mul;
        else {
          e.x += Math.sin(e.t * 1.3) * 22 * dt;
          e.stay -= dt;
          if (e.cd <= 0) {
            e.cd = 1.5 / (1 + 0.06 * (diffTier() - 1));
            var a0 = aim(e);
            for (var k = -1; k <= 1; k++) eshot(e.x, e.y + 10, a0 + k * 0.22, 140, 'rice');
          }
        }
      } else if (e.fromB) {
        e.y -= 150 * dt * mul;
        if (e.y < -40) e.gone = true;
      } else {
        e.y += 150 * dt * mul;
        if (e.y > H + 40) e.gone = true;
      }
    } else if (e.type === 'elite') {
      if (e.y < e.ty && e.stay > 0) e.y += 90 * dt * mul;
      else if (e.stay > 0) {
        if (e.mv0 == null) { e.mv0 = e.t; e.lx = e.x; }
        // 入场后再摆动，摆动幅度从 0 平滑展开，避免第一帧瞬移
        var mt0 = e.t - e.mv0;
        var nx0 = W / 2 + Math.sin(mt0 * 0.7) * W * 0.3 * Math.min(1, mt0 / 0.9);
        e.x = smoothX(e, nx0, dt, 260);
        e.stay -= dt;
        if (e.cd <= 0) {
          e.cd = 1.7;
          e.alt = !e.alt;
          if (e.alt) {
            var a1 = aim(e);
            for (var j = -3; j <= 3; j++) eshot(e.x, e.y + 14, a1 + j * 0.16, 135, 'rice');
          } else {
            var off = Math.random() * 0.4;
            for (var r = 0; r < 10; r++) eshot(e.x, e.y, off + r * Math.PI * 2 / 10, 105, 'orb');
          }
        }
      } else {
        e.y -= 80 * dt;
        if (e.y < -60) e.gone = true;
      }
    } else if (e.type === 'boss') {
      if (e.y < e.ty && e.mv0 == null) { e.y += 70 * dt; return; }
      if (e.mv0 == null) e.mv0 = e.t;
      bossAI(e, dt * mul);
    }
  }

  // 横向位置平滑：单帧位移封顶，任何原因导致的座标跳变都会变成短距离滑动
  function smoothX(e, nx, dt, maxSpd) {
    if (e.lx == null) e.lx = nx;
    var d = nx - e.lx, cap = maxSpd * dt;
    if (d > cap) d = cap; else if (d < -cap) d = -cap;
    e.lx += d;
    return e.lx;
  }

  /* ── 首领风格：移动方式 + 招式各不相同，三阶段按血量 66% / 33% 切换 ── */
  var BOSS_ARCH = ['charger', 'sniper', 'spinner', 'summoner', 'bouncer'];
  var BOSS_ARCH_NM = { charger: '冲锋型', sniper: '狙击型', spinner: '花弹型', summoner: '召唤型', bouncer: '弹跳型', landmark: '地标' };

  // 朝目标点移动，单帧位移封顶，任何风格切换都不会瞬移
  function bossSeek(e, tx, ty, spd, dt) {
    var dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy), m = spd * dt;
    if (d <= m || d < 0.01) { e.x = tx; e.y = ty; return true; }
    e.x += dx / d * m; e.y += dy / d * m;
    return false;
  }
  function bossRing(e, n, sp, type, off, extra) {
    n = Math.min(bCount(n), 24);
    for (var i = 0; i < n; i++) eshot(e.x, e.y, (off || 0) + i * Math.PI * 2 / n, sp, type, extra);
  }
  function bossFan(e, ang, n, gap, sp, type, extra) {
    n = bCount(n);
    for (var i = 0; i < n; i++) eshot(e.x, e.y + 16, ang + (i - (n - 1) / 2) * gap, sp, type, extra);
  }
  function bossTele(e, ang, len, dur, w) {
    e.tele.push({ x: e.x, y: e.y, a: ang, len: len, t: dur, max: dur, w: w || 6 });
  }
  function bossSummon(e, n) {
    if (state.enemies.length > 16) return;
    for (var i = 0; i < n; i++) {
      var a = Math.PI * (0.15 + 0.7 * i / Math.max(1, n - 1));
      addDrone({ x: e.x + Math.cos(a) * 46, y: e.y + Math.sin(a) * 30, vx: 0, vy: 90, path: 'sine', ph: i * 0.7 });
    }
    ringPulse(e.x, e.y, '#c49bff', 10, 70, 0.4, 2);
  }

  function bossAI(e, dt) {
    var hpP = e.hp / e.maxHp, ph = hpP > 0.66 ? 1 : hpP > 0.33 ? 2 : 3;
    if (ph !== e.phase) {
      e.phase = ph;
      e.cd = 1.0; e.cd2 = 1.6;
      if (e.arch === 'charger' || e.arch === 'sniper') { e.st = 'idle'; e.stT = 0.8; e.vis = 1; }
      state.shake = Math.max(state.shake, 0.4);
      ringPulse(e.x, e.y, '#ffd36b', 6, 90, 0.4, 2);
      toastInGame(e.name + ' · 第 ' + ph + ' 阶段');
    }
    // 首领的招式冷却同样吃动态压力（landmark 稍轻）
    var fr = fireRate() * (e.landmark ? 1.3 : 1.5);
    e.cd -= dt * fr; e.cd2 -= dt * fr; e.stT -= dt;
    for (var ti = e.tele.length - 1; ti >= 0; ti--) { e.tele[ti].t -= dt; if (e.tele[ti].t <= 0) e.tele.splice(ti, 1); }
    // 延时招式：先画预警，到点才真正发射
    if (e.pend) {
      for (var pi = e.pend.length - 1; pi >= 0; pi--) {
        e.pend[pi].t -= dt;
        if (e.pend[pi].t <= 0) { var fn = e.pend[pi].fn; e.pend.splice(pi, 1); fn(); }
      }
    }
    if (e.lz && updateBossLaser(e, dt)) return;
    var mt = e.t - e.mv0, hy = e.ty, p = state.player, i;
    var A = BOSS_AI[e.arch] || BOSS_AI.spinner;
    A(e, dt, ph, mt, hy, p);
  }

  var BOSS_AI = {
    // 冲锋型：8 字盘旋 → 红线预警锁定 → 高速俯冲（沿途撒弹）→ 回位；冲锋间隙放扇形弹
    charger: function (e, dt, ph, mt, hy, p) {
      var gap = [4.2, 3.4, 2.7][ph - 1];
      if (e.st === 'idle') {
        bossSeek(e, W / 2 + Math.sin(mt * 0.8) * W * 0.3, hy + Math.sin(mt * 1.6) * 26, 200, dt);
        if (e.cd <= 0) { e.cd = 1.4; bossFan(e, aim(e), ph + 2, 0.18, 150, 'rice'); }
        if (e.stT <= 0) {
          e.st = 'tele'; e.stT = 0.85;
          e.dx = clamp(p.x, 40, W - 40); e.dy = Math.min(H * 0.72, p.y - 20);
          bossTele(e, Math.atan2(e.dy - e.y, e.dx - e.x), Math.sqrt((e.dx - e.x) * (e.dx - e.x) + (e.dy - e.y) * (e.dy - e.y)) + 30, 0.85, e.r * 1.2);
          Sfx.play('warn');
        }
      } else if (e.st === 'tele') {
        e.x += Math.sin(e.t * 60) * 0.8;
        if (e.stT <= 0) { e.st = 'dash'; e.dropT = 0; state.shake = Math.max(state.shake, 0.25); }
      } else if (e.st === 'dash') {
        e.dropT -= dt;
        if (e.dropT <= 0) {
          e.dropT = 0.07 / bScale();
          eshot(e.x, e.y, Math.PI, 50 + ph * 15, 'orb');
          eshot(e.x, e.y, 0, 50 + ph * 15, 'orb');
        }
        if (bossSeek(e, e.dx, e.dy, 560 + ph * 60, dt)) {
          e.st = 'back';
          state.shake = Math.max(state.shake, 0.45);
          ringPulse(e.x, e.y, '#ff9a3c', 8, 80, 0.35, 3);
          bossRing(e, 10 + ph * 4, 120, 'big', Math.random());
        }
      } else if (bossSeek(e, W / 2, hy, 280, dt)) {
        e.st = 'idle'; e.stT = gap;
      }
    },

    // 狙击型：闪现换位 → 短暂停顿 → 一串高速直线弹（2 阶段 3 道、3 阶段 5 道）
    sniper: function (e, dt, ph, mt, hy, p) {
      if (e.st === 'idle') {
        e.vis = Math.min(1, e.vis + dt * 5);
        e.x += Math.sin(e.t * 1.7) * 18 * dt;
        if (ph >= 3 && e.cd2 <= 0) { e.cd2 = 1.8; bossRing(e, 10, 80, 'orb', Math.random()); }
        if (e.stT <= 0) {
          e.st = 'aim'; e.stT = 0.35;
          e.la = aim(e);
        }
      } else if (e.st === 'aim') {
        if (e.stT <= 0) {
          var n2 = bCount([1, 3, 5][ph - 1]), per = bCount(9);
          for (var k2 = 0; k2 < n2; k2++) {
            for (var s = 0; s < per; s++) eshot(e.x, e.y + 10, e.la + (k2 - (n2 - 1) / 2) * 0.32, 200 + s * 22, 'rice');
          }
          Sfx.play('eshoot');
          e.st = 'out'; e.stT = 0.9;
        }
      } else if (e.st === 'out') {
        if (e.stT < 0.35) e.vis = Math.max(0, e.vis - dt * 4);
        if (e.stT <= 0) {
          e.x = rnd(60, W - 60); e.y = rnd(hudTop + 70, H * 0.32);
          sparks(e.x, e.y, '#ff9ad0', 10, 160);
          e.st = 'idle'; e.stT = [1.3, 1.0, 0.8][ph - 1];
        }
      }
    },

    // 花弹型：居中缓漂；1 阶段双臂螺旋（定时换向）/ 2 阶段左右旋花瓣交叉 / 3 阶段四臂螺旋 + 悬停后加速的弹环
    spinner: function (e, dt, ph, mt, hy, p) {
      bossSeek(e, W / 2 + Math.sin(mt * 0.3) * W * 0.12, hy + Math.sin(mt * 0.5) * 14, 120, dt);
      if (ph === 1 || ph === 3) {
        // 螺旋转 2.2 秒、歇 1 秒，不再是一刻不停的弹流
        if (e.cd <= 0 && mt % 3.2 < 2.2) {
          e.cd = Math.max(0.1, (ph === 1 ? 0.12 : 0.1) / bScale());
          var dir = Math.floor(mt / 3) % 2 ? -1 : 1, arms = ph === 1 ? 2 : Math.max(2, Math.min(4, bCount(4)));
          e.spin += 0.23 * dir;
          for (var a = 0; a < arms; a++) eshot(e.x, e.y, e.spin + a * Math.PI * 2 / arms, 110, 'orb');
        }
      }
      if (ph === 2 && e.cd <= 0) {
        e.cd = 1.5;
        e.alt = !e.alt;
        bossRing(e, 22, 105, 'rice', Math.random(), { curve: e.alt ? 0.7 : -0.7 });
      }
      if (ph === 3 && e.cd2 <= 0) {
        e.cd2 = 2.2;
        bossRing(e, 12, 30, 'big', Math.random(), { hold: 0.5, acc: 1.4, vmax: 220 });
      }
    },

    // 召唤型：在两侧之间巡游、到边停顿；召唤小怪护卫 + 慢速泡泡弹定时裂开
    summoner: function (e, dt, ph, mt, hy, p) {
      var side = clamp(Math.sin(mt * 0.45) * 1.7, -1, 1);
      bossSeek(e, W / 2 + side * W * 0.3, hy + Math.cos(mt * 0.9) * 18, 170, dt);
      if (e.stT <= 0) { e.stT = [6, 5, 4.2][ph - 1]; bossSummon(e, Math.max(1, bCount(ph + 2))); }
      if (e.cd <= 0) {
        e.cd = [1.9, 1.6, 1.3][ph - 1] / bScale();
        var a0 = aim(e), n = bCount(ph + 1);
        for (var k = 0; k < n; k++) eshot(e.x, e.y + 16, a0 + (k - (n - 1) / 2) * 0.45, 70, 'big', { split: 1.1, sn: bCount(6 + ph * 2), ssp: 105 });
      }
      if (ph >= 3 && e.cd2 <= 0) {
        e.cd2 = 0.35;
        eshot(e.x, e.y + 16, aim(e) + rnd(-0.1, 0.1), 200, 'rice');
      }
    },

    // 弹跳型：在上半屏斜向反弹乱窜，撞墙炸一圈；发射会在侧墙反弹的弹
    bouncer: function (e, dt, ph, mt, hy, p) {
      if (e.bvx == null) { e.bvx = 130 * (Math.random() < 0.5 ? -1 : 1); e.bvy = 80; }
      var sp = [1, 1.25, 1.5][ph - 1], ramp = Math.min(1, mt / 1.2);
      e.x += e.bvx * sp * ramp * dt; e.y += e.bvy * sp * ramp * dt;
      var hit = false;
      if (e.x < 50) { e.x = 50; e.bvx = Math.abs(e.bvx); hit = true; }
      if (e.x > W - 50) { e.x = W - 50; e.bvx = -Math.abs(e.bvx); hit = true; }
      if (e.y < hudTop + 70) { e.y = hudTop + 70; e.bvy = Math.abs(e.bvy); hit = true; }
      if (e.y > H * 0.5) { e.y = H * 0.5; e.bvy = -Math.abs(e.bvy); hit = true; }
      if (hit) {
        bossRing(e, [8, 12, 16][ph - 1], 105, 'orb', Math.random());
        state.shake = Math.max(state.shake, 0.18);
        ringPulse(e.x, e.y, '#ff4f6d', 6, 50, 0.25, 2);
      }
      if (e.cd <= 0) {
        e.cd = [1.4, 1.15, 0.9][ph - 1] / bScale();
        var a1 = aim(e), nb = bCount(2);
        for (var bi = 0; bi < nb; bi++) {
          eshot(e.x, e.y, a1 + (bi - (nb - 1) / 2) * 0.5, 150, 'big', { bounce: 2 });
        }
      }
    },

    // 地标首领：1 阶段弹幕帘（先亮安全区再落弹）/ 2 阶段分段螺旋 + 重弹 / 3 阶段召唤 + 裂弹 + 加速弹环
    // 大招「蓄力光束」：进入 2、3 阶段立刻放一次，之后定时再放；蓄力期间停火、全程有预警
    landmark: function (e, dt, ph, mt, hy, p) {
      if (e.lzT == null) e.lzT = 8;
      e.lzT -= dt;
      if (ph >= 2 && (e.lzPh !== ph || e.lzT <= 0)) {
        e.lzPh = ph; e.lzT = ph === 2 ? 10 : 8;
        var la = aim(e);
        startBossLaser(e, ph === 2 ? [la - 0.6, la, la + 0.6] : [la - 0.95, la - 0.32, la + 0.32, la + 0.95], ph === 2 ? 30 : 26);
        return;
      }
      if (ph === 1) {
        bossSeek(e, W / 2 + Math.sin(mt * 0.5) * W * 0.18, hy, 140, dt);
        if (e.cd <= 0) {
          e.cd = 2.9;
          var gx = clamp(p.x + rnd(-70, 70), 60, W - 60), gw = 96, gy = hudTop + 40;
          var step = 26 / bScale();
          for (var x = 10; x < W; x += step) if (Math.abs(x - gx) > gw / 2) eshot(x, gy, Math.PI / 2, 95, 'rice');
          Sfx.play('eshoot');
        }
        if (e.cd2 <= 0) { e.cd2 = 2.1; bossFan(e, aim(e), 4, 0.18, 150, 'rice'); }
      } else if (ph === 2) {
        bossSeek(e, W / 2 + Math.cos(mt * 0.6) * W * 0.22, hy + Math.sin(mt * 0.6) * 30, 160, dt);
        // 螺旋分段：转 2 秒、停 1.4 秒，留出穿插的空档
        if (mt % 3.4 < 2 && e.cd <= 0) {
          e.cd = 0.17;
          e.spin += 0.29;
          for (var arm = 0; arm < 3; arm++) eshot(e.x, e.y, e.spin + arm * 2.094, 110, 'orb');
        }
        if (e.cd2 <= 0) { e.cd2 = 2.8; bossFan(e, aim(e), 3, 0.14, 180, 'big'); }
      } else {
        bossSeek(e, W / 2 + Math.sin(mt * 0.4) * W * 0.25, hy, 150, dt);
        if (e.stT <= 0) { e.stT = 7; bossSummon(e, 3); }
        if (e.cd <= 0) {
          e.cd = 2.1;
          e.alt = !e.alt;
          if (e.alt) bossRing(e, 14, 30, 'big', Math.random(), { hold: 0.5, acc: 1.4, vmax: 220 });
          else bossFan(e, aim(e), 3, 0.5, 70, 'big', { split: 1.1, sn: 8, ssp: 105 });
        }
        if (e.cd2 <= 0) { e.cd2 = 0.8; eshot(e.x, e.y + 20, aim(e), 200, 'rice'); }
      }
    },
  };

  /* 首领大招 · 蓄力光束：1.35 秒预警（光束走廊 + 流动箭头 + 蓄能球 + 汇聚粒子）→ 0.95 秒实体光束 → 收束 */
  var LZ_CHARGE = 1.35, LZ_FIRE = 0.95;
  function lzColor() { return (state.region && state.region.c1) || '#ffcf5a'; }
  function startBossLaser(e, angs, w) {
    e.lz = { st: 'charge', t: 0, angs: angs, w: w || 30 };
    e.pend = null;
    Sfx.play('warn');
    toastInGame(e.name + ' · 大招蓄力');
  }
  function updateBossLaser(e, dt) {
    var z = e.lz, p = state.player;
    z.t += dt;
    if (z.st === 'charge') {
      var k = z.t / LZ_CHARGE;
      for (var c = 0; c < 2; c++) {
        var a = rnd(0, Math.PI * 2), r = rnd(46, 96);
        state.particles.push({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.4, vy: -Math.sin(a) * r * 2.4,
          life: 0.38, max: 0.38, color: c ? '#fff3c0' : lzColor(), r: rnd(1.2, 2.2 + k * 1.5), kind: 'dot' });
      }
      state.shake = Math.max(state.shake, k * 0.12);
      if (z.t >= LZ_CHARGE) {
        z.st = 'fire'; z.t = 0;
        state.shake = Math.max(state.shake, 0.6);
        state.flash = Math.max(state.flash, 0.28);
        ringPulse(e.x, e.y, '#fff3c0', 10, 120, 0.45, 4);
        Sfx.play('laser'); Sfx.play('bigboom');
      }
      return true;
    }
    if (z.st === 'fire') {
      state.shake = Math.max(state.shake, 0.16);
      if (state.invuln <= 0 && z.t > 0.06) {
        for (var i = 0; i < z.angs.length; i++) {
          var ca = Math.cos(z.angs[i]), sa = Math.sin(z.angs[i]), rx = p.x - e.x, ry = p.y - e.y;
          if (rx * ca + ry * sa <= 0) continue;
          if (Math.abs(rx * sa - ry * ca) < z.w * 0.4 + p.r) { hurt(); break; }
        }
      }
      // 光束沿途冲散玩家子弹之外不做别的，保证只有"站在光里"才会受伤
      if (Math.random() < 0.7) {
        var ai = z.angs[(Math.random() * z.angs.length) | 0], d = rnd(40, H);
        sparks(e.x + Math.cos(ai) * d, e.y + Math.sin(ai) * d, '#fff3c0', 1, 140);
      }
      if (z.t >= LZ_FIRE) { z.st = 'end'; z.t = 0; }
      return true;
    }
    if (z.t >= 0.35) { e.lz = null; e.cd = Math.max(e.cd, 0.9); e.cd2 = Math.max(e.cd2, 1.2); }
    return true;
  }

  /* ── 武器：主武器 = 主导属性，次武器 = 第二属性 ──────
     火力 P 提升武器等级；UR/EX 满火力 +1 级（进化）；拼满单词觉醒 +2 级（时长随词长）。 */
  function nextLetter(card) {
    if (!card.ammo.length) return null;
    var L = card.ammo[card.cursor % card.ammo.length];
    card.cursor = (card.cursor + 1) % card.ammo.length;
    return L;
  }
  function wLevel(slot) {
    var c = state.card, lv = state.power;
    if (c.fx.evolve && state.power >= c.fx.maxP) lv++;
    if (state.awaken > 0) lv += 2;
    return slot === 'sub' ? Math.max(1, lv - 2) : lv;
  }
  function vtOf(kind) { return state.card.vt[kind] || 1; }
  var TYPE_KIND = { pellet: 'blast', shard: 'frost', missile: 'swift', pea: 'shield', bolt: 'pierce', tide: 'tide', blade: 'blade' };
  // 命中音按弹种区分材质，避免所有子弹一个"鼓点"
  var HIT_SFX = {
    blast: 'hit_blast', pellet: 'hit_blast', frost: 'hit_frost', shard: 'hit_frost',
    swift: 'hit_swift', missile: 'hit_swift', word: 'hit_swift', shield: 'hit_shield', pea: 'hit_shield',
    pierce: 'hit_pierce', bolt: 'hit_pierce', thunder: 'hit_thunder', tide: 'hit_tide', blade: 'hit_blade',
  };
  function addShot(o) {
    o.hit = {};
    o.life = o.life || 1.6;
    o.letter = o.letter || nextLetter(state.card);
    o.rank = state.card.rank;
    o.vt = o.vt || vtOf(TYPE_KIND[o.type] || state.card.kind);
    o.hue = rnd(0, 360);
    o.tr = 0;
    o._tr = null;
    state.shots.push(o);
    return o;
  }
  function shotAt(type, x, y, a, sp, dmg, extra) {
    var o = { type: type, x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: dmg };
    if (extra) for (var k in extra) o[k] = extra[k];
    return addShot(o);
  }
  // 飞刃的齐发数量：1→1 2→2 3→3 4→3 5→4 6→4 7→5
  var BLADE_N = { 1: 4, 2: 5, 3: 6, 4: 6, 5: 7, 6: 7, 7: 8 };
  var FROST_PAT = { 1: [0], 2: [-4, 4], 3: [-8, 0, 8], 4: [-12, -4, 4, 12], 5: [-16, -8, 0, 8, 16], 6: [-20, -12, -4, 4, 12, 20], 7: [-24, -16, -8, 0, 8, 16, 24] };

  /* 武器平衡：单发伤害 × 数量 ÷ 间隔 ≈ 25~30（以基础伤害为单位，7 级、子弹等级 1）
     没有一把是全维度最强的，各自的长板/短板：
       blast  霰弹  近身极限最高（贴脸可达 100），但射程最短、散射最大，远了只能蹭到几发
       frost  冰锥  最窄最直、附带减速，命中数稳定但缺爆发
       swift  追踪  必中所以单发最低，单体稳定、清场最差
       thunder 雷电 单体最弱（约 15），但连锁 9 跳，怪越多越猛（3 只以上全场第一）
       pierce 激光  全屏贯穿、无射程限制，但同一条线上只有 1~2 道能命中
       tide   潮汐  覆盖最宽、带溅射，正面命中少但能扫到整排
       blade  飞刃  穿透整列且回旋，单发最高、频率最低，站位不好就白丢
       shield 卫星  唯一能挡弹的，输出最低、安全性最高 */
  function weaponTick(slot, dt) {
    var w = state.wp[slot];
    if (!w) return;
    var vt = vtOf(w.kind);
    var lv = Math.min(7, wLevel(slot)), mul = (slot === 'sub' ? 0.55 : 1) * (1 + 0.15 * (vt - 1)),
      base = baseDmg() * mul * traitAmp(w.kind), p = state.player, th = tierHit();
    var up = -Math.PI / 2;
    w.t -= dt;
    if (w.kind === 'blast') {
      if (w.t <= 0) {
        w.t = lv >= 6 ? 0.24 : 0.34;
        var n = 3 + 2 * (lv - 1), half = (14 + 4 * lv) * Math.PI / 180;
        for (var i = 0; i < n; i++) {
          var a = up + (n > 1 ? (i / (n - 1) * 2 - 1) * half : 0) + rnd(-0.03, 0.03);
          shotAt('pellet', p.x, p.y - 12, a, rnd(640, 760), base * 1.6, { life: 1.5, life0: 1.5, near: (0.32 + lv * 0.02) * th.reach, r: 3 * th.size });
        }
      }
    } else if (w.kind === 'frost') {
      if (w.t <= 0) {
        w.t = 0.13;
        FROST_PAT[lv].forEach(function (d) {
          shotAt('shard', p.x + d * 0.6, p.y - 14, up + d * Math.PI / 180, 760, base * 1.25, { r: 3.5 * th.size, shatter: 1 });
        });
      }
    } else if (w.kind === 'swift') {
      if (w.t <= 0) {
        w.t = 0.3;
        var m = [1, 2, 2, 3, 4, 5, 6][lv - 1];
        for (var j = 0; j < m; j++) {
          var a2 = up + (j - (m - 1) / 2) * 0.5;
          shotAt('missile', p.x + (j - (m - 1) / 2) * 8, p.y - 6, a2, 380, base * 1.5, { homing: 1.8, life: 2.2, r: 4 * th.size, accel: 1 });
        }
      }
    } else if (w.kind === 'thunder') {
      if (w.t <= 0) {
        var tt = thunderTier(), isSubT = slot === 'sub';
        w.t = lv >= 6 ? 0.3 : 0.48;
        chainLightning(p.x, p.y - 12, 1 + Math.ceil(lv * 0.7) + tt.jump, base * 4.4, tt.reach + lv * 20, vt, isSubT ? 0.6 : 1);
      }
    } else if (w.kind === 'pierce' && slot === 'sub') {
      // 副武器的激光改为点射光针，避免满屏都是持续光束
      if (w.t <= 0) {
        w.t = 0.22;
        var nb = lv >= 4 ? 2 : 1;
        for (var bi = 0; bi < nb; bi++) {
          shotAt('bolt', p.x + (nb > 1 ? (bi ? 9 : -9) : 0), p.y - 12, up, 900, base * 2.4, { r: 3, pierce: 1, life: 0.8 });
        }
      }
    } else if (w.kind === 'pierce') {
      var angs = lv >= 7 ? [0, -0.1, 0.1, -0.2, 0.2] : lv >= 5 ? [0, -0.12, 0.12] : [0];
      var bw = (3 + Math.min(lv, 4) * 1.2) * th.size;
      angs.forEach(function (da) {
        state.beams.push({ x: p.x, y: p.y - 14, a: up + da, w: bw, vt: vt, dps: base * (16 + 4 * lv) / angs.length * (angs.length > 1 ? 1.6 : 1) });
      });
    } else if (w.kind === 'tide') {
      // 水弹：左右摆动前进，命中炸开水花；等级越高水柱越密、扇面越宽
      if (w.t <= 0) {
        w.t = 0.26 - lv * 0.008;
        var tn = [1, 1, 2, 2, 3, 3, 4][lv - 1];
        for (var ti = 0; ti < tn; ti++) {
          var ta = up + (ti - (tn - 1) / 2) * 0.26;
          shotAt('tide', p.x + (ti - (tn - 1) / 2) * 8, p.y - 12, ta, 470 + lv * 18, base * 1.9, {
            r: (6 + lv * 0.4) * th.size, life: 1.2, wob: 150 + lv * 30, ph: 0, mir: ti < (tn - 1) / 2 ? -1 : 1, splash: (34 + lv * 4) * th.reach,
          });
        }
      }
    } else if (w.kind === 'blade') {
      /* 飞刃：低频、超高单发、360° 全方位贯穿。
         - 火力等级 lv：刃数 4→10、单发伤害 16→28 倍基础、刃体变大；lv6 起变成十字手里剑形态
         - 卡牌品阶 rank：SR 起每轮多 1 片、UR 起再多 1 片；刃体与判定按品阶放大
         - 飞行中刃体逐渐张开（判定 ×1.5），越远越好命中；觉醒时出刃更快 */
      if (w.t <= 0) {
        var rk = state.card.rank || 1;
        w.t = state.awaken > 0 ? 0.5 : 0.75;
        var bn = (BLADE_N[lv] || 4) + (rk >= 5 ? 1 : 0);
        w.rot = ((w.rot || 0) + Math.PI / bn * 0.5) % (Math.PI * 2);
        var br0 = (8 + lv * 0.8 + rk * 0.7) * th.size;
        for (var bi2 = 0; bi2 < bn; bi2++) {
          var ba = up + w.rot + bi2 * Math.PI * 2 / bn;
          shotAt('blade', p.x, p.y - 6, ba, 560 + lv * 15, base * (9 + lv * 1.3), {
            r: br0, r0: br0, life: 1.8, pierce: 99, spin: rnd(0, 6), blv: lv,
          });
        }
      }
    } else if (w.kind === 'shield') {
      var cnt = Math.min(6, 1 + lv), isSub = slot === 'sub', R = (34 + lv * 3) * (isSub ? 0.78 : 1);
      for (var o = 0; o < cnt; o++) {
        var oa = state.orbA * (isSub ? -1 : 1) + o * Math.PI * 2 / cnt;
        state.orbs.push({
          x: p.x + Math.cos(oa) * R, y: p.y + Math.sin(oa) * R, dmg: base * 4.2,
          i: o, li: o + (isSub ? 6 : 0), vt: vt, a: oa, key: slot + o, sub: isSub, r: R,
        });
      }
      if (w.t <= 0) {
        w.t = 0.16;
        shotAt('pea', p.x, p.y - 14, up, 780, base * 1.0, { r: 3 * th.size });
      }
    }
  }

  // 潮汐摆动：以发射线为中轴按正弦左右摆（位移式，不累计漂移），成对弹道镜像
  function tideSway(b, dt) {
    b.ph = (b.ph || 0) + dt * 11;
    var off = Math.sin(b.ph) * (b.wob / 11) * (b.mir || 1);
    b.x += off - (b.off0 || 0);
    b.off0 = off;
  }

  /* 雷电按卡牌品阶分档：EX 全屏索敌 + 天雷齐落；越低级首跳射程越短、连锁越近、电弧越细、震屏越轻。
     reach < 1 表示屏高的比例 */
  var THUNDER_TIER = {
    1: { reach: 190, hop: 88,  w: 0.85, sky: 0, jump: 0, shake: 0.03,  flash: 0,    node: 0 },
    2: { reach: 215, hop: 98,  w: 1,    sky: 0, jump: 0, shake: 0.04,  flash: 0,    node: 0 },
    3: { reach: 245, hop: 110, w: 1.15, sky: 0, jump: 1, shake: 0.05,  flash: 0.02, node: 1 },
    4: { reach: 275, hop: 122, w: 1.3,  sky: 0, jump: 1, shake: 0.06,  flash: 0.03, node: 1 },
    5: { reach: 305, hop: 135, w: 1.45, sky: 1, jump: 1, shake: 0.06,  flash: 0.03, node: 2 },
    6: { reach: 340, hop: 150, w: 1.6,  sky: 1, jump: 2, shake: 0.07,  flash: 0.04, node: 2 },
  };
  function thunderTier() {
    var t = THUNDER_TIER[clamp(state.card.rank || 1, 1, 6)];
    return { reach: t.reach < 1 ? H * t.reach : t.reach, hop: t.hop, w: t.w, sky: t.sky, jump: t.jump, shake: t.shake, flash: t.flash, node: t.node };
  }
  function chainLightning(x, y, jumps, dmg, range, vt, scale) {
    var pts = [{ x: x, y: y }], hit = {}, cx = x, cy = y, fx = state.card.fx, tt = thunderTier(), col = kindColor('thunder');
    scale = scale || 1;
    vt = vt || 1;
    var d0 = dmg;
    for (var j = 0; j < jumps; j++) {
      var best = null, bd = range;
      for (var i = 0; i < state.enemies.length; i++) {
        var e = state.enemies[i];
        if (e.dead || hit[e._id] || e.y < hudTop - 10) continue;
        var d = Math.sqrt((e.x - cx) * (e.x - cx) + (e.y - cy) * (e.y - cy));
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      hit[best._id] = 1;
      pts.push({ x: best.x, y: best.y });
      var crit = Math.random() < fx.crit;
      hitEnemy(best, dmg * (crit ? 2 : 1), crit, best.x, best.y, null, col, false, null, 'thunder');
      dmg *= 0.9;
      cx = best.x; cy = best.y;
      // 连锁距离：品阶（表）+ 火力等级 + 子弹等级；下一个目标超出这个距离就断链
      range = (tt.hop + state.power * 8) * scale + vt * 10;
    }
    var aw = (1.4 + vt * 0.35) * tt.w * scale;
    if (pts.length > 1) {
      var rage = state.awaken > 0;
      state.arcs.push({ src: pts, amp: (9 + tt.w * 3) * (rage ? 1.4 : 1), pts: jagged(pts, 10), life: 0.16 + vt * 0.025 + tt.w * 0.03, max: 0.16 + vt * 0.025 + tt.w * 0.03, w: aw * (rage ? 1.2 : 1), vt: vt, br: (vt >= 2 || tt.node || rage) ? forks(pts, Math.max(vt, tt.node * 2 + 1), rage) : null, rage: rage ? 1 : 0, seed: rnd(0, 1), nodes: tt.node && scale >= 1 ? 1 : 0 });
      // 每个被劈中的节点都炸一下：低级只有落点小环，高级每跳都有冲击环 + 火花
      for (var n = 1; n < pts.length; n++) {
        if (n < pts.length - 1 && !tt.node) continue;
        ringPulse(pts[n].x, pts[n].y, col, 2, (14 + vt * 5) * tt.w, 0.2, (1.2 + vt * 0.2) * tt.w);
        if (tt.node >= 2) sparks(pts[n].x, pts[n].y, '#efe4ff', 3, 180);
      }
    }
    // 天雷：品阶 4 起额外从屏幕顶劈下，目标不限距离 —— 顶级卡全屏都在雷区里
    var sky = scale >= 1 ? tt.sky : 0, struck = 0;
    if (sky) {
      var skyR = tt.reach * 1.3, sp0 = state.player;
      var pool = state.enemies.filter(function (e) { return !e.dead && !hit[e._id] && e.y > hudTop - 10 && e.y < H && dist(e, sp0) < skyR; });
      for (var s = 0; s < sky && pool.length; s++) {
        var tg = pool.splice((Math.random() * pool.length) | 0, 1)[0];
        var top = { x: tg.x + rnd(-36, 36), y: hudTop - 6 };
        var bolt = [top, { x: tg.x, y: tg.y }];
        state.arcs.push({ src: bolt, amp: 16, fv: 4, pts: jagged(bolt, 16), life: 0.24, max: 0.24, w: aw * 1.15, big: 1, vt: Math.max(4, vt), br: forks(bolt, 4, rage), rage: rage ? 1 : 0, seed: rnd(0, 1), nodes: 1 });
        hitEnemy(tg, d0 * 0.6, false, tg.x, tg.y, null, col, false, null, 'thunder');
        ringPulse(tg.x, tg.y, '#efe4ff', 3, 22 + vt * 5, 0.26, 2.4);
        sparks(tg.x, tg.y, col, 5, 220);
        struck++;
      }
    }
    if (pts.length > 1 || struck) {
      if (state.zapT <= 0) { Sfx.play('zap'); state.zapT = 0.12; }
      state.shake = Math.max(state.shake || 0, tt.shake * scale + vt * 0.008);
      if (tt.flash && scale >= 1) state.flash = Math.max(state.flash, tt.flash);
    }
  }
  // 中点位移生成自然电弧：逐级细分 + 幅度递减，转角圆润不生硬
  function jagged(pts, amp) {
    var out = pts.slice(), a = amp;
    for (var pass = 0; pass < 3; pass++) {
      var next = [out[0]];
      for (var i = 1; i < out.length; i++) {
        var p0 = out[i - 1], p1 = out[i];
        var dx = p1.x - p0.x, dy = p1.y - p0.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = -dy / len, ny = dx / len;
        var off = rnd(-a, a);
        next.push({ x: (p0.x + p1.x) / 2 + nx * off, y: (p0.y + p1.y) / 2 + ny * off });
        next.push(p1);
      }
      out = next;
      a *= 0.5;
    }
    return out;
  }

  // 闪电分叉：从主干随机点岔出枝杈，等级越高枝越多；狂暴（觉醒）时枝更长、更多，还会二次分叉
  function forks(pts, vt, rage) {
    var out = [];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], n = (vt >= 5 ? 2 : 1) + (rage ? 1 : 0);
      var segL = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
      for (var k = 0; k < n; k++) {
        var t = rnd(0.15, 0.85), sx = a.x + (b.x - a.x) * t, sy = a.y + (b.y - a.y) * t;
        var ang = Math.atan2(b.y - a.y, b.x - a.x) + (Math.random() < 0.5 ? -1 : 1) * rnd(0.35, rage ? 1.3 : 1.0);
        var len = rage ? rnd(26, 36 + vt * 6) + Math.min(60, segL * 0.18) : rnd(14, 22 + vt * 4);
        var end = { x: sx + Math.cos(ang) * len, y: sy + Math.sin(ang) * len };
        var br = jagged([{ x: sx, y: sy }, end], rage ? 9 : 5);
        out.push(br);
        if (rage && Math.random() < 0.4) {
          var m = br[(br.length * rnd(0.3, 0.6)) | 0], a2 = ang + (Math.random() < 0.5 ? -1 : 1) * rnd(0.4, 0.9), l2 = len * rnd(0.4, 0.6);
          out.push(jagged([m, { x: m.x + Math.cos(a2) * l2, y: m.y + Math.sin(a2) * l2 }], 5));
        }
      }
    }
    return out;
  }

  /* ── 命中 / 击杀 / 掉落 ───────────────────────── */
  function hitEnemy(e, dmg, crit, x, y, letter, color, noGlyph, fxCol, src) {
    if (e.dead) return;
    e.hp -= dmg;
    if (!state.ult) state.dmgAcc = (state.dmgAcc || 0) + dmg;
    e.flash = 0.07;
    var L = letter || nextLetter(state.card);
    if (crit) {
      // 暴击才显示字母：镂空描边字，和实心瓦片的道具字母区分开
      popGlyph(x, y, L, true);
      sparks(x, y, lvColor(L), 8, 200);
      Sfx.play('crit');
    } else {
      // 普通命中不出字母，只出火花；火花颜色 / 大小 / 环数随字母等级升级
      if (!noGlyph) hitFx(x, y, L, fxCol);
      sparks(x, y, color, 2, 120);
      if (state.hitSfxT <= 0) { Sfx.play(HIT_SFX[src] || 'hit'); state.hitSfxT = 0.06; }
    }
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e, shatter) {
    if (e.dead) return;
    e.dead = true;
    state.kills++;
    var big = e.type === 'boss' || e.type === 'elite';
    ringPulse(e.x, e.y, '#fff3d0', e.r * 0.4, e.r * (big ? 3.2 : 2.2), big ? 0.5 : 0.3, big ? 4 : 2.5);
    pixelBurst(e);
    if (e.slow > 0 || state.frozen) {
      // 冰封碎裂：冰晶碎片四散
      for (var iq = 0; iq < (big ? 16 : 8); iq++) {
        var qa = rnd(0, Math.PI * 2), qs = rnd(90, 340);
        state.particles.push({
          x: e.x + rnd(-6, 6), y: e.y + rnd(-6, 6), vx: Math.cos(qa) * qs, vy: Math.sin(qa) * qs - 60,
          g: 760, life: rnd(0.45, 0.95), max: 0.95, kind: 'ice',
          r: rnd(2, 4.4), rot: rnd(0, 6), spin: rnd(-9, 9),
          color: pick(['#f2fdff', '#cdf3ff', '#8fdcff']),
        });
      }
      e.slow = 0;
    }
    Sfx.play(big ? 'bigboom' : 'boom');
    state.shake = Math.max(state.shake, big ? 0.6 : 0.08);
    // 首次击败某种物品：浮出英文 + 中文
    if (!state.seen[e.sprite]) {
      state.seen[e.sprite] = 1;
      var nm = spriteName(e.sprite);
      state.seenList.push(e.sprite);
      popText(e.x, e.y - e.r - 6, nm.en + ' ' + nm.cn, '#fff3dc', 1.6);
    }
    if (shatter) {
      var sn = 3 + state.card.rank;
      for (var i = 0; i < sn; i++) {
        shotAt('shard', e.x, e.y, i * Math.PI * 2 / sn, 520, baseDmg() * 0.6, { r: 3, life: 0.25 + state.card.rank * 0.03 });
      }
      ringPulse(e.x, e.y, '#e6faff', 4, 20 + state.card.rank * 6, 0.3, 2);
    }
    dropItems(e);
    if (e.type === 'boss') {
      state.phase = 'clear';
      state.clearT = 2.2;
      state.flash = 0.5;
      state.stats.bossT = state.stats.t;   // 击败首领的用时，用于成就
      clearShots(true);
      for (var k = 0; k < 3; k++) {
        ringPulse(e.x + rnd(-30, 30), e.y + rnd(-30, 30), pick(['#ffd36b', '#ff9e7a', '#fff']), 10, 120 + k * 40, 0.6 + k * 0.15, 3);
      }
      Sfx.play('clear');
    }
  }

  // 像素碎块：从精灵图取色，炸成方块
  function pixelBurst(e) {
    var sp = global.StageArt && global.StageArt.SPRITES[e.sprite];
    var cols = ['#fff6dc'];
    if (sp) for (var k in sp.pal) cols.push(sp.pal[k]);
    var n = e.type === 'boss' ? 40 : e.type === 'elite' ? 24 : 12, px = e.r * 2.4 / 16;
    for (var i = 0; i < n; i++) {
      state.particles.push({
        x: e.x + rnd(-e.r, e.r), y: e.y + rnd(-e.r, e.r), vx: rnd(-180, 180), vy: rnd(-220, 40),
        life: rnd(0.4, 0.8), max: 0.8, color: pick(cols), r: Math.max(1.5, px * 0.6), kind: 'debris',
        rot: 0, spin: 0, g: 420,
      });
    }
  }

  function dropItems(e) {
    var r = Math.random, list = [], c0 = state.card, sK = (c0.kind === 'shield' || c0.sub === 'shield') ? 1 : 1.5;
    // 场上同类道具有上限：字母最多 3 颗、火力最多 1 颗、总数最多 6 个，满了就不再掉
    var onL = 0, onP = 0, onAll = state.items.length;
    state.items.forEach(function (it) { if (it.type === 'L') onL++; else if (it.type === 'P') onP++; });
    var big = e.type === 'elite' || e.type === 'boss';
    if (!big && onAll >= 6) return dropCodex(e);
    // 长词需要更多字母，掉率提高得更明显（3 字母 ×0.8 → 12 字母约 ×1.8）
    var lK = clamp(0.8 + (spellLen() - 3) * 0.125, 0.8, 1.8), maxP = state.power >= c0.fx.maxP;
    var pity = state.power < 2 && state.t > 8 && !onP;   // 火力保底：还停在 P1 且场上没有 P 时才补
    if (e.type === 'drone') {
      var early = state.level <= 2;
      if (onL < 3 && r() < (early ? 0.16 : 0.11) * lK) list.push('L');
      if (!onP && (pity || r() < (maxP ? 0.01 : early ? 0.06 : 0.03))) list.push('P');
      if (r() < 0.008) list.push('B');
      if (r() < 0.012 * sK) list.push('S');
      if (r() < 0.006) list.push('H');
    } else if (e.type === 'shooter') {
      if (onL < 3 && r() < 0.3 * lK) list.push('L');
      if (!onP && (pity || r() < (maxP ? 0.03 : 0.08))) list.push('P');
      if (r() < 0.03) list.push('B');
      if (r() < 0.04 * sK) list.push('S');
      if (r() < 0.02) list.push('H');
    } else if (e.type === 'elite') {
      list.push('L');
      if (spellLen() >= 8) list.push('L');
      if (!maxP) list.push('P');
      if (r() < 0.4) list.push('B');
    } else if (e.type === 'boss') {
      list.push('H', 'L', 'L');
      if (spellLen() >= 10) list.push('L');
      if (!maxP) list.push('P');
    }
    list.forEach(function (t, i) {
      state.items.push({
        type: t, x: e.x + (i - (list.length - 1) / 2) * 14, y: e.y,
        vx: rnd(-50, 50), vy: rnd(-150, -80), t: 0,
      });
    });
    dropCodex(e);
  }
  // 怪物图鉴：已收录的不再掉落（避免重复获得毫无意义的道具）；不受场上道具上限限制
  function dropCodex(e) {
    var owned = (api.codexHas && api.codexHas(e.sprite)) || state.codexGot.indexOf(e.sprite) >= 0;
    var ch = CODEX_RATE[e.type] || 0;
    if (!owned && e.sprite && Math.random() < ch) {
      state.items.push({ type: 'C', sprite: e.sprite, x: e.x, y: e.y, vx: rnd(-30, 30), vy: rnd(-170, -120), t: 0 });
    }
  }
  // 刻意压得很低：普通怪要刷很久，精英 / 首领才值得反复挑战
  // 怪物图鉴掉率：调整为原设定的 1/5。
  var CODEX_RATE = { drone: 0.0007, shooter: 0.0012, elite: 0.0044, boss: 0.01 };

  function collect(it) {
    var p = state.player, c = state.card;
    if (it.type === 'P') {
      if (state.power < c.fx.maxP) {
        state.power++;
        var evo = c.fx.evolve && state.power >= c.fx.maxP;
        popText(p.x, p.y - 30, evo ? '武器进化' : state.power >= c.fx.maxP ? 'MAX POWER' : 'POWER UP', '#ffb347');
        Sfx.play('power');
      } else {
        state.inkBonus += 2;
        popText(p.x, p.y - 30, '+2 成长点', '#ffb347');
        Sfx.play('item');
      }
    } else if (it.type === 'B') {
      if (state.bombs < 3) { state.bombs++; popText(p.x, p.y - 30, ULT_NAME[c.kind] + ' +1', '#ffd36b'); }
      else { state.inkBonus += 2; popText(p.x, p.y - 30, '+2 成长点', '#ffd36b'); }
      Sfx.play('item');
    } else if (it.type === 'S') {
      state.shield = Math.min(2, state.shield + 1);
      popText(p.x, p.y - 30, '护盾', '#6ee7f0');
      Sfx.play('shield');
    } else if (it.type === 'H') {
      if (state.hp < MAX_HP) { state.hp++; popText(p.x, p.y - 30, '生命 +1', '#ff6b81'); }
      else { state.inkBonus += 2; popText(p.x, p.y - 30, '+2 成长点', '#ff6b81'); }
      Sfx.play('item');
    } else if (it.type === 'C') {
      var fresh = !(api.codexHas && api.codexHas(it.sprite)) && state.codexGot.indexOf(it.sprite) < 0;
      state.codexGot.push(it.sprite);
      var nm = spriteName(it.sprite);
      state.codexPop = { sprite: it.sprite, t: 0, dur: fresh ? 2.2 : 1.5, fresh: fresh, nm: nm };
      state.flash = Math.max(state.flash, fresh ? 0.55 : 0.3);
      state.shake = Math.max(state.shake, 0.16);
      for (var ci = 0; ci < 3; ci++) ringPulse(p.x, p.y, ci ? '#fff3c0' : '#ffe08a', 8 + ci * 10, 70 + ci * 46, 0.45 + ci * 0.12, 3);
      sparks(p.x, p.y, '#ffe08a', fresh ? 26 : 12, 280);
      sparks(p.x, p.y, '#fff8dc', fresh ? 14 : 6, 180);
      Sfx.play(fresh ? 'awaken' : 'power');
    } else if (it.type === 'L') {
      state.spell++;
      state.spellFlash = 0.3;
      Sfx.play('letter');
      if (state.spell >= spellLen()) wordComplete();
    }
    renderHud();
  }

  // 拼满一个词：武器觉醒（时长随词长）+ 计入卡片熟练度（局外）
  function wordComplete() {
    var c = state.card, p = state.player;
    // 长词用更多弹幕表现完整拼词，但大招总伤害保持在同一预算内。
    var n = Math.max(6, Math.min(12, 5 + Math.round(spellLen() * 0.55)));
    state.wordsDone++;
    state.spell = 0;
    state.wordShow = 1.4;
    state.awaken = state.awakenMax = awakenT();
    if (c.word.hid && !state.memoryEcho) {
      state.memoryEcho = true;
      state.banner = { t: 2, text: '完整记忆 · 战斗强化', sub: '隐藏被动：所有武器词条效果 +10%' };
    } else {
      state.banner = { t: 1.4, text: '觉醒 · ' + String(c.word.w || '').toUpperCase(), sub: kindLabel(c.kind) + '强化 ' + (Math.round(state.awaken * 10) / 10) + ' 秒' };
    }
    var base = baseDmg(), shotDmg = base * 18 / n;
    Sfx.play('awaken');
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.4;
      shotAt('word', p.x, p.y - 10, a, 480, shotDmg, {
        letter: c.ammo.length ? c.ammo[i % c.ammo.length] : null, pierce: 2, homing: 1.4, life: 2.4, r: 7,
      });
    }
    ringPulse(p.x, p.y, c.ink, 10, 120, 0.6, 3);
    var gain = api.onWordSpelled ? api.onWordSpelled(c.word) : 0;
    if (gain > 0) popText(p.x, p.y - 46, c.word.w + ' 熟练度 +' + gain, '#9ff0c0', 1.4);
    else if (api.onWordSpelled) popText(p.x, p.y - 46, '今日熟练度已满', 'rgba(255,248,230,.6)', 1.2);
  }

  /* ── 大招：每种主武器一种 ─────────────────────── */
  // 大招时长系数：按卡牌阶级（N1 → EX6）
  function ultScale(c) {
    var r = Math.max(1, Math.min(6, (c && c.rank) || 1));
    return 1 + (r - 1) * 0.15;
  }

  function useBomb() {
    if (!state || state.ended || state.paused || state.bombs <= 0 || state.ult || state.phase === 'clear') return;
    var c = state.card, k = c.kind;
    state.bombs--;
    state.stats.ultUsed = (state.stats.ultUsed || 0) + 1;
    // 阶级越高持续时间越长：N(1) 1× → EX(6) 1.75×
    var mul = ultScale(c);
    var dur = ({ blast: 1.9, pierce: 1.6, swift: 1.4, thunder: 1.6, frost: 3.2, shield: 1.45, tide: 2.2, blade: 1.6 }[k] || 1.5) * mul;
    // 光柱：左右来回扫；海啸：浪墙自下而上推，次数都按品阶
    var passes = k === 'pierce' ? ULT_PASSES[c.rank] || 1 : k === 'tide' ? TIDE_WAVES[c.rank] || 1 : 0;
    if (passes) dur = passes * (k === 'tide' ? TIDE_WAVE_T : ULT_PASS_T) + 0.4;
    // 出招窗口按比例拉长，密度不变，只是持续更久
    var winF = { blast: 0.74, pierce: 0.81, swift: 1, thunder: 0.87, frost: 1, shield: 0.85, tide: 0.9, blade: 0.94 }[k] || 0.9;
    state.ult = { kind: k, t: 0, dur: dur, win: passes ? dur : dur * winF, acc: 0, hit: {}, cap: null, n: 0, passes: passes, pass: -1 };
    state.invuln = Math.max(state.invuln, dur + 0.8);
    state.banner = { t: 1.1, text: ULT_FULL[k] || '大招', sub: String(c.word.w || '').toUpperCase() };
    if (k === 'frost') state.frozen = true;
    if (k === 'blast' || k === 'swift' || k === 'thunder' || k === 'blade' || k === 'shield') clearShots(true);
    Sfx.play('ult_' + k, dur);
    Sfx.duck(dur);
    ultIntro(c);
    if (k === 'swift') {
      var p = state.player, n = 24 + c.fx.fx * 3;
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2;
        shotAt('word', p.x, p.y, a, 300 + (i % 3) * 60, baseDmg() * 4.5 * ULT_DMG, {
          letter: c.ammo.length ? c.ammo[i % c.ammo.length] : null, homing: 2.4, life: 2.6, r: 7, ult: 1,
        });
      }
    }
    renderHud();
  }

  // 大招开场：从机体炸开多层冲击环 + 闪白 + 震屏，品阶越高层数越多；文字改由横幅切入演出
  function ultIntro(c) {
    var p = state.player, rk = c.rank, col = kindColor(c.kind);
    state.flash = Math.max(state.flash, 0.18 + rk * 0.04);
    state.shake = Math.max(state.shake, 0.3 + rk * 0.06);
    for (var i = 0; i < 1 + Math.ceil(rk / 2); i++) {
      ringPulse(p.x, p.y, i % 2 ? '#ffffff' : col, 8 + i * 6, 90 + i * 55 + rk * 10, 0.45 + i * 0.1, 3 + rk * 0.3);
    }
    sparks(p.x, p.y, col, 10 + rk * 4, 320);
    softBoom(p.x, p.y, 60 + rk * 10, col);
    state.banner = null;
  }

  // 大招整体伤害倍率：小怪基本一碰即死；对首领单次大招最多扣 15% 血，避免直接秒首领。
  // 这 15% 按大招时长均摊：每一击都按当前进度结算，所以每一道雷劈中都有伤害，
  // 不会出现前几下打满上限、后面几十道全是 0 的情况。
  var ULT_DMG = 3;
  function ultHit(e, d) {
    var u = state.ult;
    d *= ULT_DMG;
    if (e.type === 'boss') {
      var cap = e.maxHp * 0.15;
      if (u) {
        u.bossHit = u.bossHit || {};
        var st = u.bossHit[e._id] || (u.bossHit[e._id] = { cap: cap, used: 0 });
        var prog = clamp(u.t / Math.max(0.2, u.dur || 1), 0, 1);
        // 至少保底 1 点，保证「劈中一次就算一次伤害」
        d = Math.min(d, Math.max(1, st.cap * prog - st.used));
        st.used += d;
      } else {
        d = Math.min(d, cap);
      }
    }
    hitEnemy(e, d, false, e.x, e.y, null, '#fff');
  }

  function updateUlt(dt) {
    var u = state.ult;
    if (!u) return;
    u.t += dt;
    var c = state.card, base = baseDmg();
    if (u.kind !== 'frost' && u.kind !== 'pierce' && u.kind !== 'tide') clearShots(true);
    var top0 = hudTop + 10, bot0 = H - hudBot - 10;
    if (u.kind === 'blast') {
      // 流星雨铺满全屏：落点从顶栏到底栏均匀分布，一半瞄准敌人
      u.acc += dt;
      var gap = 0.05 - c.rank * 0.004;
      while (u.acc > gap && u.t < u.win) {
        u.acc -= gap;
        var alive0 = state.enemies.filter(function (e) { return !e.dead && e.y > top0; });
        var aimE = alive0.length && Math.random() < 0.5 ? pick(alive0) : null;
        var ty0 = aimE ? aimE.y : rnd(top0, bot0), tx0 = aimE ? aimE.x : rnd(10, W - 10);
        var fall = (ty0 + 20) / 700;
        state.particles.push({
          kind: 'meteor', x: tx0 + 110 * fall, y: -20, vx: -110, vy: 700,
          ty: ty0, letter: c.ammo.length ? c.ammo[(u.n++) % c.ammo.length] : null,
          life: 3, max: 3, color: rankColor(u.n),
        });
      }
    } else if (u.kind === 'pierce') {
      // 巨型光柱左右来回扫，来回次数按品阶；扫到哪清到哪
      var pi = Math.min(u.passes - 1, Math.floor(u.t / ULT_PASS_T));
      var pk = clamp((u.t - pi * ULT_PASS_T) / ULT_PASS_T, 0, 1);
      pk = pk < 0.5 ? 2 * pk * pk : 1 - Math.pow(-2 * pk + 2, 2) / 2;
      var dirR = pi % 2 === 0, M = 70;
      if (pi !== u.pass) { u.pass = pi; state.shake = Math.max(state.shake, 0.3 + c.rank * 0.04); Sfx.play('laser'); }
      var pbx = u.bx == null ? (dirR ? -M : W + M) : u.bx;
      u.bx = u.t >= u.passes * ULT_PASS_T ? null : (dirR ? -M + (W + 2 * M) * pk : W + M - (W + 2 * M) * pk);
      if (u.bx != null) {
        var bw0 = 40 + c.rank * 7;
        clearShotsBand(pbx - bw0, u.bx + bw0, '#ffd0f0');
        state.enemies.forEach(function (e) {
          if (!e.dead && Math.abs(e.x - u.bx) < bw0 + e.r && e.y > 0) ultHit(e, base * 70 * dt);
        });
      }
    } else if (u.kind === 'thunder') {
      // 连锁雷暴：从上下左右四个方向随机劈向敌人，没有敌人时劈满全屏随机点
      u.acc += dt;
      var tgap = 0.075 - c.rank * 0.006;
      while (u.acc > tgap && u.t < u.win) {
        u.acc -= tgap;
        var alive = state.enemies.filter(function (e) { return !e.dead && e.y > top0 - 20; });
        // 有敌人时每道雷都必须落到目标上；只有场上没有敌人时才劈随机位置。
        var tgt = alive.length ? pick(alive) : { x: rnd(16, W - 16), y: rnd(top0, bot0) };
        var side = (Math.random() * 4) | 0, src;
        if (side === 0) src = { x: tgt.x + rnd(-90, 90), y: -14 };
        else if (side === 1) src = { x: tgt.x + rnd(-90, 90), y: H + 14 };
        else if (side === 2) src = { x: -14, y: tgt.y + rnd(-90, 90) };
        else src = { x: W + 14, y: tgt.y + rnd(-90, 90) };
        var bolt = [src, { x: tgt.x, y: tgt.y }];
        state.arcs.push({ src: bolt, amp: 24, fv: 5, pts: jagged(bolt, 24), life: 0.32, max: 0.32, w: 2.2 + c.rank * 0.45, big: 1,
          vt: Math.max(4, c.rank), br: forks(bolt, 5, true), rage: 1, seed: rnd(0, 1), nodes: 1 });
        ringPulse(tgt.x, tgt.y, '#efe4ff', 4, 30 + c.rank * 6, 0.3, 3);
        softBoom(tgt.x, tgt.y, 26 + c.rank * 5, '#b38cff');
        sparks(tgt.x, tgt.y, kindColor('thunder'), 6, 220);
        if (tgt._id) ultHit(tgt, base * 12);
        state.flash = Math.max(state.flash, 0.1);
        state.shake = Math.max(state.shake, 0.22);
        if (state.zapT <= 0) { Sfx.play('zap'); state.zapT = 0.08; }
      }
    } else if (u.kind === 'tide') {
      // 海啸巨浪：整面浪墙从屏幕底部推到顶部，浪头扫过的敌人受击、敌弹被冲走；品阶越高浪越多
      var wi = Math.min(u.passes - 1, Math.floor(u.t / TIDE_WAVE_T));
      var wk2 = clamp((u.t - wi * TIDE_WAVE_T) / TIDE_WAVE_T, 0, 1);
      if (wi !== u.pass) { u.pass = wi; u.hit = {}; state.shake = Math.max(state.shake, 0.35); Sfx.play('surge'); }
      var py0 = u.wy == null ? H + 40 : u.wy;
      u.wy = u.t >= u.passes * TIDE_WAVE_T ? null : H + 40 - (H + 100) * (1 - Math.pow(1 - wk2, 2));
      if (u.wy != null) {
        state.eshots = state.eshots.filter(function (s2) {
          if (s2.y < u.wy - 10 || s2.y > py0 + 30) return true;
          if (Math.random() < 0.5) state.particles.push({ x: s2.x, y: s2.y, vx: rnd(-40, 40), vy: -90, g: 400, life: 0.4, max: 0.4, color: pick(['#7fe6ff', '#3fb8f0']), r: 2, kind: 'dot' });
          return false;
        });
        state.enemies.forEach(function (e) {
          if (e.dead || u.hit[e._id] || e.y < u.wy - e.r || e.y > py0 + e.r + 30) return;
          u.hit[e._id] = 1;
          ultHit(e, base * (18 + c.rank * 2));
          e.slow = 1.2;
          ringPulse(e.x, e.y, '#4fd6e8', 4, 30 + c.rank * 4, 0.3, 2.6);
        });
        for (var sp0 = 0; sp0 < 3 + c.rank; sp0++) {
          state.particles.push({ x: rnd(0, W), y: u.wy + rnd(-4, 8), vx: rnd(-60, 60), vy: rnd(-260, -120), g: 520, life: rnd(0.4, 0.7), max: 0.7,
            color: pick(['#bff6ff', '#4fd6e8', '#2a8fe0', '#eafaff']), r: rnd(1.4, 3), kind: 'dot' });
        }
      }
    } else if (u.kind === 'blade') {
      // 千刃轮：头顶巨型刀轮高速旋转，一圈圈向四面八方甩出大号进化飞刃（与普通飞刃同款外观）
      u.acc += dt;
      var wn = 10 + c.rank * 2, wv = 0.32 - c.rank * 0.015;
      while (u.acc > wv && u.t < u.win) {
        u.acc -= wv;
        var pu = state.player, rot0 = u.n * Math.PI / wn;
        for (var wi = 0; wi < wn; wi++) {
          var wa = rot0 + wi * Math.PI * 2 / wn, wr = 18 + c.rank * 2;
          shotAt('blade', pu.x + Math.cos(wa) * 30, pu.y + Math.sin(wa) * 30, wa, 520, base * 2.6 * ULT_DMG, {
            r: wr, r0: wr, life: 2, pierce: 999, spin: rnd(0, 6), blv: 7, ult: 1,
          });
        }
        ringPulse(pu.x, pu.y, kindColor('blade'), 30, 90 + c.rank * 10, 0.3, 2.5);
        state.shake = Math.max(state.shake, 0.08);
        u.n++;
      }
    } else if (u.kind === 'shield') {
      var R = 20 + Math.sqrt(W * W + H * H) * clamp(u.t / u.win, 0, 1);
      u.R = R;
      var p = state.player;
      state.enemies.forEach(function (e) {
        if (e.dead || u.hit[e._id]) return;
        if (dist(e, p) < R + e.r) { u.hit[e._id] = 1; ultHit(e, base * 22); }
      });
    }
    if (u.t >= u.dur) {
      if (u.kind === 'frost') {
        state.frozen = false;
        state.flash = 0.5;
        state.shake = 0.7;
        clearShots(true);
        state.enemies.forEach(function (e) { if (!e.dead && e.y > -e.r) ultHit(e, base * 26); });
        state.enemies.forEach(function (e) {
          if (!e.dead) {
            sparks(e.x, e.y, '#bfefff', 10, 220);
            for (var k = 0; k < 8; k++) {
              var aa = rnd(0, Math.PI * 2), sp = rnd(80, 320);
              state.particles.push({
                x: e.x, y: e.y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp - 40,
                g: 700, life: rnd(0.5, 0.9), max: 0.9, kind: 'ice',
                r: rnd(2, 4), rot: rnd(0, 6), spin: rnd(-8, 8),
                color: pick(['#eafaff', '#bfefff', '#8fdcff']),
              });
            }
          }
        });
        Sfx.stopBed();
        Sfx.play('bigboom');
      } else {
        Sfx.play('ult_end');
      }
      state.ult = null;
    }
  }

  function meteorLand(q) {
    var rk = state.card.rank, R = 38 + rk * 4, base = baseDmg();
    state.enemies.forEach(function (e) {
      if (!e.dead && dist(e, q) < R + e.r) ultHit(e, base * 14);
    });
    ringPulse(q.x, q.y, '#fff3c0', 4, R * 0.6, 0.18, 4);
    ringPulse(q.x, q.y, q.color, 6, R, 0.34, 3);
    sparks(q.x, q.y, '#ffb347', 8 + rk * 2, 220);
    for (var i = 0; i < 3 + rk; i++) {
      state.particles.push({ x: q.x + rnd(-8, 8), y: q.y + rnd(-8, 8), vx: rnd(-40, 40), vy: rnd(-60, -10), life: 0.5, max: 0.5, color: pick(['#ff8a3d', '#ffb347', '#5a3020']), r: rnd(3, 6), kind: 'smoke' });
    }
    state.shake = Math.max(state.shake, 0.25);
    if (state.hitSfxT <= 0) { Sfx.play('boom'); state.hitSfxT = 0.07; }
  }

  function clearShots(toSpark) {
    if (toSpark) {
      state.eshots.forEach(function (s) {
        if (Math.random() < 0.5) {
          state.particles.push({ x: s.x, y: s.y, vx: 0, vy: -40, life: 0.3, max: 0.3, color: '#ffe6a0', r: 1.8, kind: 'dot' });
        }
      });
    }
    state.eshots = [];
  }
  // 只清掉落在 [x0, x1] 竖带里的敌弹（扫屏类大招：扫到哪清到哪）
  function clearShotsBand(x0, x1, col) {
    var lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    state.eshots = state.eshots.filter(function (s) {
      if (s.x < lo || s.x > hi) return true;
      if (Math.random() < 0.6) state.particles.push({ x: s.x, y: s.y, vx: rnd(-30, 30), vy: -50, life: 0.3, max: 0.3, color: col || '#ffe6a0', r: 1.8, kind: 'dot' });
      return false;
    });
  }

  function hurt() {
    if (state.invuln > 0 || state.ended) return;
    var p = state.player;
    if (state.shield > 0) {
      state.shield--;
      Sfx.play('shield');
      popText(p.x, p.y - 30, '护盾抵挡', '#6ee7f0');
    } else {
      state.hp--;
      state.perfect = false;
      state.stats.hits++;
      state.hurtFlash = 0.35;
      Sfx.play('hurt');
      // 被击中掉 1 级火力，并把 P 抛出去，可以再捡回来
      if (state.power > 1) {
        state.power--;
        state.items.push({ type: 'P', x: p.x, y: p.y - 10, vx: rnd(-60, 60), vy: -220, t: 0 });
      }
    }
    state.invuln = 1.6;
    state.shake = 0.5;
    // 只清掉几乎贴着玩家的弹，别把整片弹幕抹掉
    state.eshots = state.eshots.filter(function (s) { return dist(s, p) > 40; });
    renderHud();
    if (state.hp <= 0) endRun(false);
  }

  /* ── 结算：单关，按表现给 1-3 星 ─────────────────── */
  function grade() {
    var ws = state.stats;
    var score = 100 - ws.hits * 20 - Math.max(0, ws.t - (BOSS_AT + 12)) * 1.0 + state.wordsDone * 4;
    score = Math.round(clamp(score, 0, 100));
    var g = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : 'C';
    return { g: g, score: score, stars: g === 'S' ? 3 : g === 'A' ? 2 : 1 };
  }

  function endRun(win) {
    if (state.ended) return;
    state.ended = true;
    state.paused = true;
    stopLoop();
    setPanel('result');
    var r = grade(), stars = win ? r.stars : 0;
    if (win) Sfx.play('win', stars); else Sfx.play('lose');
    var ink0 = win ? ({ S: 30, A: 20, B: 12, C: 6 }[r.g] + state.level * 3 + state.inkBonus) : Math.min(10, Math.floor(state.kills / 4)) + state.inkBonus;
    // 每日收益递减在结算前就应用，结算页显示的就是实际到手的量
    var inkMul = (api && api.inkMul) ? api.inkMul() : 1;
    var ink = Math.max(1, Math.round(ink0 * inkMul));
    var gradeCh = win ? r.g : 'F';
    var starHtml = '';
    for (var i = 0; i < 3; i++) starHtml += '<i class="' + (i < stars ? 'on' : '') + '">★</i>';
    function lootRow(id, fresh, tag) {
      var n = spriteName(id);
      return '<div class="loot-row ' + (fresh ? 'is-new' : 'is-known') + '" data-sprite="' + id + '">' +
        '<span class="loot-ico"><canvas width="64" height="64"></canvas></span>' +
        '<span class="loot-txt"><b>' + n.cn + '</b><i>' + n.en + '</i></span>' +
        '<span class="loot-tag' + (fresh ? ' new' : '') + '">' + tag + '</span></div>';
    }
    var lootHtml = '';
    if (state.codexGot.length) {
      lootHtml += '<div class="loot-head"><i></i><span>获得图鉴</span><i></i></div>' +
        state.codexGot.map(function (id) {
          var fresh = !(api.codexHas && api.codexHas(id));
          return lootRow(id, fresh, fresh ? 'NEW' : '图鉴 +1');
        }).join('');
    }
    var score = win ? r.score : 0;
    var cw = state.card.word, KS = global.Card && global.Card.KINDS;
    var wTag = function (k, sub) {
      if (!KS || !KS[k]) return '';
      return '<span class="ek-tag' + (sub ? ' sub' : '') + '" style="--c:' + KS[k].c + '">' +
        (global.Card.weaponIcon ? global.Card.weaponIcon(k, sub ? 'sub' : '') : '') +
        '<b>' + KS[k].nm + '</b><em>' + (sub ? '副' : '主') + '</em></span>';
    };
    var cStars = '';
    for (var si = 0; si < 3; si++) cStars += '<i class="' + (si < state.card.stars ? 'on' : '') + '">★</i>';
    var cardHtml = '<div class="br-card" style="--c:' + state.card.color + '">' +
      '<div class="brc-main"><span class="brc-k">出战词卡</span>' +
        '<b class="brc-w">' + String(cw.w || '').toLowerCase() + '</b>' +
        '<span class="brc-cn">' + String(cw.cn || '').split(/[；;]/)[0] + '</span></div>' +
      '<div class="brc-side"><span class="brc-stars">' + cStars + '</span>' +
        '<span class="brc-ws">' + wTag(state.card.kind) + (state.card.sub ? wTag(state.card.sub, true) : '') + '</span></div>' +
    '</div>';
    var seenHtml = '';
    if (state.seenList.length) {
      seenHtml = '<div class="br-seen"><div class="loot-head"><i></i><span>本局遭遇 ' + state.seenList.length + '</span><i></i></div><div class="brs-grid">' +
        state.seenList.map(function (id) {
          var n = spriteName(id);
          return '<span class="brs-cell" data-sprite="' + id + '"><canvas width="64" height="64"></canvas><i>' + (n.cn || n.en) + '</i></span>';
        }).join('') + '</div></div>';
    }
    el('battleResultBody').innerHTML =
      '<div class="br-hero ' + (win ? 'win' : 'lose') + ' g' + gradeCh + '">' +
        '<div class="br-badge">' +
          '<i class="br-rays"></i>' +
          '<div class="br-rank"><b>' + gradeCh + '</b></div>' +
          '<div class="br-stars">' + starHtml + '</div>' +
        '</div>' +
        '<div class="br-info">' +
          '<h2>' + (win ? '通 关' : '失 利') + '</h2>' +
          '<p>' + regionPlace() + ' · ' + state.theme.title + '</p>' +
          '<em class="br-note">' + (win ? (state.stage < 4 ? '已解锁下一关' : '本地区全部通关') : '再接再厉') + '</em>' +
          '<div class="br-score"><span>评分</span><div class="br-bar"><i style="width:' + score + '%"></i></div><b>' + score + '</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="bres-stats">' +
        '<div class="st-time"><b>' + Math.round(state.stats.t) + '<em>s</em></b><span>用时</span></div>' +
        '<div class="st-hit"><b>' + state.stats.hits + '</b><span>受伤</span></div>' +
        '<div class="st-word"><b>' + state.wordsDone + '</b><span>拼词</span></div>' +
        '<div class="st-kill"><b>' + state.kills + '</b><span>击杀</span></div>' +
      '</div>' +
      '<div class="br-ink"><i></i><b id="bresInk">+0</b><span>成长点</span></div>' +
      cardHtml +
      seenHtml +
      (lootHtml ? '<div class="bres-loot">' + lootHtml + '</div>'
        : '<div class="bres-empty">本关没有新图鉴 · 再挑战试试</div>');
    drawDexSprites(el('battleResultBody'));
    var shown = 0, inkEl = el('bresInk'), tickN = 0;
    // 成长点计数等庆祝号角响完再开始，音高随进度抬升，数完叮一声
    var tick = 0;
    setTimeout(function () {
      tick = setInterval(function () {
        shown = Math.min(ink, shown + Math.max(1, Math.ceil(ink / 24)));
        if (++tickN % 3 === 0 && shown < ink) Sfx.play('scoreTick', ink ? shown / ink : 1);
        if (inkEl) inkEl.textContent = '+' + shown;
        if (shown >= ink) { clearInterval(tick); if (ink > 0) Sfx.play('inkDone'); }
      }, 30);
    }, win ? 900 : 400);
    if (api.onReward) api.onReward(0, {
      win: win, kills: state.kills, ink: ink, stars: stars,
      region: state.regionId, stage: state.stage,
      stageName: regionPlace() + ' ' + (state.stage + 1) + '-5 ' + state.theme.title,
      waves: win ? 1 : 0, strong: state.wordsDone, grade: win ? r.g : '',
      word: (state.card && state.card.word && state.card.word.w) || '',
      codex: state.codexGot.slice(),
      time: state.stats.t,
      hits: state.stats.hits,
      nohit: win && state.stats.hits === 0,
      noUlt: win && !(state.stats.ultUsed || 0),
      bossT: state.stats.bossT || 0,
      words: state.wordsDone,
    });
    el('battleAgain').onclick = exitToHome;
    el('battleBack').onclick = exitToHome;
  }

  // 结算页图鉴格：把像素怪物画进 canvas
  function drawDexSprites(root) {
    if (!root || !global.StageArt) return;
    var cells = root.querySelectorAll('[data-sprite]');
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i].querySelector('canvas');
      if (!c) continue;
      var g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      global.StageArt.draw(g, cells[i].getAttribute('data-sprite'), 32, 32, 64, false);
    }
  }

  function exitToHome() {    close();
    if (api && api.onExit) api.onExit();
  }

  /* ── 暂停 ─────────────────────────────────────── */
  // 只冻结逻辑，不中断渲染：画面停在最后一帧，浮层盖在上面
  function setPaused(on) {
    if (!state || state.ended) return;
    on = !!on;
    if (state.paused === on) return;
    state.paused = on;
    if (on) {
      state.drag = null;
      state.keys = {};
      if (state.player) state.player.bank = 0;
      Sfx.play('tap');
      Sfx.music(null);
    } else {
      Sfx.play('tap');
      Sfx.music(state.phase === 'boss' ? 'boss' : 'stage');
    }
    var ov = el('battlePauseOver');
    if (ov) ov.classList.toggle('on', on);
  }

  /* ── 主循环 ───────────────────────────────────── */
  function startLoop() {
    stopLoop();
    running = true;
    lastTs = 0;
    raf = requestAnimationFrame(frame);
    Sfx.music('stage');
  }
  function stopLoop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    Sfx.stopBed();
    Sfx.music(null);
  }
  // 帧率上限：整个战场按 60fps 设计，高刷屏（120/144Hz）上多出来的帧只是重复绘制，
  // 白白拉高 GPU / 功耗。阈值取 0.62 帧：120Hz 稳定降到 60fps，144Hz 约 72fps，
  // 60Hz / 90Hz 屏幕则不受影响（不会被压到 45fps 那种明显卡顿）。dt 仍按真实间隔累加。
  var FRAME_MS = 1000 / 60, FRAME_MIN = FRAME_MS * 0.62;
  function frame(ts) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    var gap = ts - lastTs;
    if (gap < FRAME_MIN) return;
    var dt = Math.min(0.033, gap / 1000);
    lastTs = ts;
    tGlobal += dt;
    if (state && !state.paused && !state.ended) update(dt);
    draw();
  }

  function update(dt) {
    var p = state.player, fx = state.card.fx;
    state.t += dt;
    chargeUlt(dt);
    trackDps(dt);
    fillMobs(dt);
    state.stats.t += dt;
    if (state.invuln > 0) state.invuln -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 3);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.6);
    if (state.hurtFlash > 0) state.hurtFlash -= dt;
    if (state.wordShow > 0 && !state.codexPop) state.wordShow -= dt;
    if (state.spellFlash > 0) state.spellFlash -= dt;
    if (state.warnT > 0) state.warnT -= dt;
    if (state.codexPop) {
      state.codexPop.t += dt;
      if (state.codexPop.t >= state.codexPop.dur) state.codexPop = null;
    }
    if (state.hitSfxT > 0) state.hitSfxT -= dt;
    if (state.zapT > 0) state.zapT -= dt;
    if (state.impT > 0) state.impT -= dt;
    if (state.awaken > 0) state.awaken -= dt;
    if (state.banner) { state.banner.t -= dt; if (state.banner.t <= 0) state.banner = null; }
    p.bank *= 0.86;
    // 背景视差：卷动速度（冻结几乎停、大招加速）+ 随角色左右位置平移
    state.bgT = (state.bgT || 0) + dt * (state.frozen ? 0.08 : state.ult ? 2.4 : 1);
    state.bgPan = (state.bgPan || 0) + (clamp((p.x - W / 2) / (W / 2), -1, 1) - (state.bgPan || 0)) * Math.min(1, dt * 4);

    var K = state.keys, kx = (K.ArrowRight || K.KeyD ? 1 : 0) - (K.ArrowLeft || K.KeyA ? 1 : 0);
    var ky = (K.ArrowDown || K.KeyS ? 1 : 0) - (K.ArrowUp || K.KeyW ? 1 : 0);
    if (kx || ky) { p.x += kx * 280 * dt; p.y += ky * 280 * dt; p.bank = clamp(p.bank + kx * 0.2, -1, 1); clampPlayer(); }

    // 武器
    state.beams = [];
    state.orbs = [];
    for (var ok in state.orbCd) if (state.orbCd[ok] > 0) state.orbCd[ok] -= dt;
    state.orbA += dt * (3 + wLevel('main') * 0.2);
    if (state.phase !== 'clear') {
      if (!state.frozen) runScript();
      weaponTick('main', dt);
      weaponTick('sub', dt);
    }
    updateUlt(dt);

    // 激光：射线判定，穿透整列
    state.beams.forEach(function (bm) {
      var dx = Math.cos(bm.a), dy = Math.sin(bm.a);
      var len = 0;
      state.enemies.forEach(function (e) {
        if (e.dead || e.y < -e.r) return;
        var rx = e.x - bm.x, ry = e.y - bm.y, along = rx * dx + ry * dy;
        if (along < 0) return;
        var perp = Math.abs(rx * dy - ry * dx);
        if (perp < e.r + bm.w) hitEnemy(e, bm.dps * dt, false, e.x + rnd(-4, 4), e.y + e.r * 0.4, null, kindColor('pierce'), true, null, 'pierce');
      });
      bm.len = len;
    });
    // 环绕卫星：近身伤害 + 挡弹
    state.orbs.forEach(function (o) {
      state.enemies.forEach(function (e) {
        if (e.dead || e.orbCd > 0) return;
        if (dist(o, e) < e.r + 8) {
          e.orbCd = 0.25;
          var crit = Math.random() < fx.crit;
          hitEnemy(e, o.dmg * (crit ? 2 : 1), crit, o.x, o.y, null, kindColor('shield'), false, null, 'shield');
        }
      });
      // 每颗卫星挡一发后进入冷却（变暗），大弹挡不住
      o.cd = state.orbCd[o.key] || 0;
      if (o.cd > 0) return;
      for (var si = 0; si < state.eshots.length; si++) {
        var s = state.eshots[si];
        if (s.type === 'big' || s.life <= 0 || dist(s, o) > 9 + s.r) continue;
        s.life = 0;
        o.cdMax = (1.6 - o.vt * 0.1) * shieldCooldownMul();
        state.orbCd[o.key] = o.cdMax;
        o.cd = 1;
        sparks(s.x, s.y, kindColor('shield'), 4, 120);
        break;
      }
    });

    if (!state.frozen) state.enemies.forEach(function (e) { if (!e.dead) updateEnemy(e, dt); });
    curShooter = null;

    // 玩家投射物
    state.shots.forEach(function (b) {
      if (b.homing) {
        var tg = null, bd = 1e9;
        state.enemies.forEach(function (e) {
          if (e.dead || e.y < 0) return;
          var d = dist(b, e);
          if (d < bd) { bd = d; tg = e; }
        });
        if (tg) {
          var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          var cur = Math.atan2(b.vy, b.vx), want = Math.atan2(tg.y - b.y, tg.x - b.x);
          var diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
          var turn = clamp(diff, -b.homing * 7 * dt, b.homing * 7 * dt);
          b.vx = Math.cos(cur + turn) * sp;
          b.vy = Math.sin(cur + turn) * sp;
        }
      }
      if (b.accel) {
        var s0 = Math.sqrt(b.vx * b.vx + b.vy * b.vy), s1 = Math.min(720, s0 + 700 * dt);
        b.vx *= s1 / s0; b.vy *= s1 / s0;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // 潮汐：正弦摆动；飞刃：上抛后回旋下落
      if (b.type === 'tide') {
        tideSway(b, dt);
      } else if (b.type === 'blade') {
        b.spin = (b.spin || 0) + dt * 22;
        if (b.r0) { b.bt = (b.bt || 0) + dt; b.r = b.r0 * (1 + 0.25 * clamp(b.bt / 0.8, 0, 1)); }
      }
      b.life -= dt;
      // 采样历史轨迹，用于绘制平滑锥形拖尾（比直线线段精致得多）
      if (!b._tr) b._tr = [];
      b._tr.push(b.x, b.y);
      if (b._tr.length > 22) b._tr.splice(0, b._tr.length - 22);
      b.tr += dt;
      if (b.type === 'missile' && b.tr > 0.03) {
        b.tr = 0;
        state.particles.push({ x: b.x, y: b.y, vx: rnd(-10, 10), vy: rnd(-10, 10), life: 0.3, max: 0.3, color: 'rgba(230,230,240,.7)', r: 2, kind: 'smoke' });
        if (b.vt >= 3) state.particles.push({ x: b.x, y: b.y, vx: rnd(-30, 30), vy: rnd(-30, 30), life: 0.25, max: 0.25, color: shotColor(b), r: 1.2 + b.vt * 0.2, kind: 'dot' });
      } else if (b.vt >= 4 && b.tr > 0.05 && b.type !== 'word') {
        b.tr = 0;
        state.particles.push({ x: b.x, y: b.y, vx: rnd(-14, 14), vy: rnd(-14, 14), life: 0.22, max: 0.22, color: shotColor(b), r: 1 + (b.vt - 3) * 0.4, kind: 'dot' });
      }
    });

    // 投射物命中
    state.shots.forEach(function (b) {
      if (b.life <= 0) return;
      for (var i = 0; i < state.enemies.length; i++) {
        var e = state.enemies[i];
        if (e.dead || b.hit[e._id] || e.y < -e.r * 0.3) continue;
        var dx = b.x - e.x, dy = b.y - e.y, rr = e.r + (b.r || 3);
        if (dx * dx + dy * dy > rr * rr) continue;
        b.hit[e._id] = 1;
        var crit = Math.random() < fx.crit;
        var col = shotColor(b), thh = tierHit();
        if (b.type === 'shard') {
          // 冰冻：移速/攻速降到 12%~30%（品阶越高越狠，首领 55%），持续时间随品阶延长
          e.slow = Math.max(e.slow, 0.9 + state.card.rank * 0.15);
          e.chill = e.type === 'boss' ? 0.55 : e.type === 'elite' ? 0.4 : Math.max(0.12, 0.32 - state.card.rank * 0.035);
        }
        // 品阶冲击：SR 起命中带冲击环，越高越大、火花越多、震屏越明显（限频，避免高射速糊屏）
        if (thh.ring && state.impT <= 0) {
          ringPulse(b.x, b.y, b.type === 'shard' ? '#e6faff' : col, 2, (9 + (b.vt || 1) * 2) * thh.ring, 0.16, 0.8 + thh.ring);
          state.impT = 0.035;
        }
        if (thh.spark > 2) sparks(b.x, b.y, b.type === 'shard' ? '#dff6ff' : col, thh.spark - 2, 170);
        if (thh.shake) state.shake = Math.max(state.shake, thh.shake);
        // 散弹全屏射程，但贴脸伤害翻倍，飞出近程后衰减到 40%
        if (b.life0) {
          b.dmg0 = b.dmg0 || b.dmg;
          var fly = b.life0 - b.life, near = b.near || 0.4;
          b.dmg = b.dmg0 * (fly <= near ? 2 - 1.2 * fly / near : 0.8 - 0.4 * clamp((fly - near) / 0.5, 0, 1));
        }
        var willShatter = b.type === 'shard' && b.shatter && e.hp <= b.dmg * (crit ? 2 : 1) && e.type !== 'boss';
        if (willShatter) {
          e.hp = 0;
          popGlyph(b.x, b.y, b.letter, crit);
          killEnemy(e, true);
        } else if (b.ult && e.type === 'boss') {
          // 大招弹丸同样受首领单次大招伤害上限约束，否则蜂群 50 发追踪弹能直接秒首领
          ultHit(e, b.dmg * (crit ? 2 : 1));
        } else hitEnemy(e, b.dmg * (crit ? 2 : 1), crit, b.x, b.y, b.letter, col, false, b.type === 'shard' ? '#dff6ff' : null, b.type);
        if (b.type === 'missile') {
          var mr = 16 + state.card.rank * 5;
          ringPulse(b.x, b.y, '#ffd36b', 4, mr, 0.22, 1.4 + thh.ring);
          if (state.card.rank >= 4) softBoom(b.x, b.y, mr * 0.7, '#ffb347');
          state.enemies.forEach(function (o) {
            if (o === e || o.dead || dist(o, b) > mr + o.r) return;
            if (b.ult && o.type === 'boss') ultHit(o, b.dmg * 0.5);
            else hitEnemy(o, b.dmg * 0.5, false, o.x, o.y, null, col, false, null, b.type);
          });
        }
        if (b.type === 'tide' && b.splash) {
          // 潮汐特色：命中炸开水花，溅射周围敌人并冲掉附近敌弹
          var sr = b.splash, rk2 = state.card.rank;
          ringPulse(b.x, b.y, '#4fd6e8', 4, sr * 1.1, 0.3, 2.6);
          ringPulse(b.x, b.y, '#2a8fe0', 2, sr * 0.6, 0.2, 2);
          state.enemies.forEach(function (o) {
            if (o !== e && !o.dead && dist(o, b) < sr + o.r) hitEnemy(o, b.dmg * 0.45, false, o.x, o.y, null, col, false, null, 'tide');
          });
          var washed = 0;
          for (var wi = 0; wi < state.eshots.length; wi++) {
            var es = state.eshots[wi];
            if (es.life > 0 && dist(es, b) < sr * 0.95) {
              es.life = 0;
              washed++;
              state.particles.push({
                x: es.x, y: es.y, vx: rnd(-30, 30), vy: rnd(-40, 10),
                life: 0.3, max: 0.3, color: '#d8fbff', r: 1.8, kind: 'dot',
              });
            }
          }
          if (washed) popText(b.x, b.y - 12, '冲散 ' + washed, '#bff6ff', 0.5);
          // 水花
          for (var si = 0; si < 4 + rk2; si++) {
            var sa = rnd(-Math.PI, 0), ss = rnd(70, 200);
            state.particles.push({
              x: b.x, y: b.y, vx: Math.cos(sa) * ss, vy: Math.sin(sa) * ss,
              g: 620, life: rnd(0.3, 0.5), max: 0.5, color: pick(['#7fe6ff', '#3fb8f0', '#bff6ff', '#2a8fe0']),
              r: rnd(1.4, 2.6), kind: 'dot',
            });
          }
        }
        if (b.pierce > 0) b.pierce--;
        else { b.life = 0; break; }
      }
    });

    // 敌弹（冻结时停住）
    if (!state.frozen) {
      var esf = state.card.kind === 'frost' ? 0.78 : 1;
      state.eshots.forEach(function (s) {
        var sdt = dt * esf;
        if (s.hold > 0) { s.hold -= sdt; return; }
        if (s.curve) {
          var ca = s.curve * sdt, cs = Math.cos(ca), sn = Math.sin(ca), nvx = s.vx * cs - s.vy * sn;
          s.vy = s.vx * sn + s.vy * cs; s.vx = nvx;
        }
        if (s.acc && s.vx * s.vx + s.vy * s.vy < (s.vmax || 260) * (s.vmax || 260)) {
          var ak = 1 + s.acc * sdt;
          s.vx *= ak; s.vy *= ak;
        }
        s.x += s.vx * sdt;
        s.y += s.vy * sdt;
        s.life -= dt;
        if (s.bounce > 0 && (s.x < 6 || s.x > W - 6)) {
          s.vx = -s.vx; s.x = clamp(s.x, 6, W - 6); s.bounce--;
        }
        if (s.split != null) {
          s.split -= sdt;
          if (s.split <= 0) {
            s.life = 0;
            var sn2 = s.sn || 8, so = Math.random() * Math.PI;
            for (var si = 0; si < sn2; si++) eshot(s.x, s.y, so + si * Math.PI * 2 / sn2, s.ssp || 110, 'rice');
            ringPulse(s.x, s.y, '#ff4fd8', 3, 20, 0.2, 1.5);
          }
        }
        if (!s._tr) s._tr = [];
        s._tr.push(s.x, s.y);
        if (s._tr.length > 12) s._tr.splice(0, s._tr.length - 12);
      });
    }
    state.eshots.forEach(function (s) {
      var dx = s.x - p.x, dy = s.y - p.y, rr = s.r + p.r;
      if (dx * dx + dy * dy < rr * rr && state.invuln <= 0) { s.life = 0; hurt(); }
    });
    if (state.ended) return;

    state.enemies.forEach(function (e) {
      if (e.dead || state.invuln > 0) return;
      if (dist(e, p) < e.r * 0.7 + p.r) {
        hurt();
        if (e.type === 'drone') hitEnemy(e, e.hp + 1, false, e.x, e.y, null, '#fff', true);
      }
    });
    if (state.ended) return;

    // 道具
    state.items.forEach(function (it) {
      it.t += dt;
      var d = dist(it, p);
      if (state.phase === 'clear' || (d < 78 && it.t > 0.35)) {
        var a = Math.atan2(p.y - it.y, p.x - it.x);
        it.x += Math.cos(a) * 520 * dt;
        it.y += Math.sin(a) * 520 * dt;
      } else {
        it.vy = Math.min(68, it.vy + 220 * dt);
        it.vx *= 0.97;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        if (it.x < 14 || it.x > W - 14) it.vx *= -1;
      }
      if (d < 22 && it.t > 0.25) { it.got = true; collect(it); }
    });
    // 原地压缩：主循环每帧都要清理 6~7 个数组，用 filter 会每帧新建 6~7 个数组
    // （60fps 下每秒 400+ 次分配），JS 引擎的 GC 抖动在手机上同样耗电。原地复用即可。
    compact(state.items, function (it) { return !it.got && it.y < H + 20 && it.t < 8; });
    compact(state.enemies, function (e) { return !e.dead && !e.gone; });
    compact(state.shots, function (b) {
      if (b.life <= 0) return false;
      if (b.type === 'blade' && b.ult) return true;
      return b.y > -30 && b.y < H + 30 && b.x > -30 && b.x < W + 30;
    });
    compact(state.eshots, function (s) { return s.life > 0 && s.y < H + 20 && s.y > -40 && s.x > -20 && s.x < W + 20; });
    compact(state.arcs, function (a) { a.life -= dt; return a.life > 0; });
    compact(state.particles, function (q) {
      q.life -= dt;
      if (q.g) q.vy += q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.spin) q.rot += q.spin * dt;
      if (q.kind === 'meteor' && q.y >= q.ty) { meteorLand(q); return false; }
      return q.life > 0;
    });
    compact(state.pops, function (q) { q.life -= dt; q.y -= 30 * dt; return q.life > 0; });

    if (state.phase === 'clear') {
      state.clearT -= dt;
      if ((state.clearT <= 0 && !state.items.length) || state.clearT < -2) endRun(true);
    }
  }

  /* ── 特效粒子 ─────────────────────────────────── */
  function sparks(x, y, color, n, sp) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = rnd(sp * 0.3, sp);
      state.particles.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: rnd(0.15, 0.4), max: 0.4, color: color, r: rnd(1, 2.4), kind: 'dot',
      });
    }
  }
  function softBoom(x, y, r, color) {
    state.particles.push({ x: x, y: y, vx: 0, vy: 0, life: 0.24, max: 0.24, color: color, r1: r, kind: 'boom' });
  }
  function ringPulse(x, y, color, r0, r1, life, width) {
    state.particles.push({
      x: x, y: y, vx: 0, vy: 0, life: life, max: life, color: color,
      r0: r0, r1: r1, w: width || 2, kind: 'ring',
    });
  }
  // 命中字母瓦片缓存：同一张卡的同字母只画一次，之后直接缩放贴图（省性能、也不会有像素感）
  var tileCache = {};
  function glyphTile(letter) {
    if (!letter || !letter.d) return null;
    var key = letter.ch + '|' + (letter.lv || 0) + '|' + (letter.mythic ? 1 : 0);
    if (tileCache[key]) return tileCache[key];
    var cv = document.createElement('canvas');
    var N = 84;                             // 留出边距，避免描边/纹样被画布裁掉
    cv.width = N; cv.height = N;
    var g2 = cv.getContext('2d');
    drawTileLetter(g2, letter, N / 2, N / 2, N - 12, 0, false);
    tileCache[key] = cv;
    return cv;
  }

  // 字母等级配色：沿用品阶色（1 常本 → 5 孤本），EX 字母彩虹
  function letterLv(letter) { return letter ? (letter.mythic ? 6 : clamp(letter.lv || 1, 1, 6)) : 1; }
  function lvColor(letter) {
    var lv = letterLv(letter);
    if (lv >= 6) return 'hsl(' + ((tGlobal * 260) % 360) + ',100%,72%)';
    return lv <= 1 ? '#fff4dc' : tierInk(lv);
  }
  function hitFx(x, y, letter, fxCol) {
    var n = 0;
    for (var i = 0; i < state.particles.length; i++) if (state.particles[i].kind === 'hitfx') n++;
    if (n > 40) return;
    var lv = letterLv(letter);
    state.particles.push({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: 0, vy: 0, life: 0.2, max: 0.2, kind: 'hitfx', lv: lv, col: fxCol || lvColor(letter), rot: rnd(0, Math.PI) });
  }
  function popGlyph(x, y, letter, crit) {
    var glyphs = 0;
    for (var i = 0; i < state.particles.length; i++) if (state.particles[i].kind === 'glyph') glyphs++;
    if (glyphs > 34) { for (var j = 0; j < state.particles.length; j++) { if (state.particles[j].kind === 'glyph') { state.particles.splice(j, 1); break; } } }
    state.particles.push({
      x: x + rnd(-6, 6), y: y + rnd(-5, 5), vx: rnd(-14, 14), vy: crit ? -74 : -56,
      life: crit ? 0.6 : 0.42, max: crit ? 0.6 : 0.42,
      kind: 'glyph', letter: letter, crit: crit,
      rot: rnd(-0.08, 0.08) + (crit ? rnd(-0.14, 0.14) : 0),
      spin: crit ? rnd(-1.6, 1.6) : rnd(-0.7, 0.7),
      col: lvColor(letter), lv: letterLv(letter),
    });
  }
  function popText(x, y, text, color, life) {
    life = life || 0.9;
    state.pops.push({ x: clamp(x, 60, W - 60), y: y, text: text, color: color, life: life, max: life });
  }

  /* ── 绘制 ─────────────────────────────────────── */
  var OUTLINE = '#2a1712';
  var GLYPH_CACHE = {};
  function glyphPath(letter) {
    if (!letter || !letter.d) return null;
    var k = letter.d;
    if (GLYPH_CACHE[k] === undefined) {
      try { GLYPH_CACHE[k] = new Path2D(letter.d); } catch (e) { GLYPH_CACHE[k] = null; }
    }
    return GLYPH_CACHE[k];
  }

  // 弹药等级配色：1–3 本色，4 提亮，5 鎏金，6 彩虹流转
  var VT_GOLD = { blast: '#ffd36b', frost: '#d8f6ff', swift: '#ffe58a', shield: '#c8ffd8', pierce: '#ff5fc8', thunder: '#e6d4ff', tide: '#bff6ff', blade: '#ffd0f6' };
  // 冷色系（冰 / 水）满级不走彩虹，只在本色相带里冷光闪烁，保持"冰就是冰"
  var VT_COLD = { frost: [196, 14, 86] };
  // 潮汐：浅青 → 海蓝的冷色层次，满级在青蓝之间流动，亮度压低避免叠加发白
  var TIDE_VT = { 5: '#2fb6f0' };
  function vtColor(kind, vt, hue) {
    var cold = VT_COLD[kind];
    if (cold && vt >= 5) {
      var sh = Math.sin(tGlobal * 5 + (hue || 0) * 0.05);
      return 'hsl(' + (cold[0] + sh * cold[1] * 0.5).toFixed(0) + ',95%,' + (cold[2] + (vt >= 6 ? sh * 6 : 0)).toFixed(0) + '%)';
    }
    if (kind === 'tide' && vt >= 5) {
      if (vt === 5) return TIDE_VT[5];
      return 'hsl(' + (192 + Math.sin(tGlobal * 3 + (hue || 0) * 0.05) * 14).toFixed(0) + ',90%,56%)';
    }
    if (vt >= 6) return 'hsl(' + (((hue || 0) + tGlobal * 260) % 360) + ',100%,72%)';
    if (vt >= 5) return VT_GOLD[kind] || '#ffd36b';
    return kindColor(kind);
  }
  function shotColor(b) {
    return vtColor(TYPE_KIND[b.type] || state.card.kind, b.vt || 1, b.hue);
  }

  function draw() {
    if (!ctx) return;
    var sh = state && state.shake ? state.shake : 0;
    ctx.save();
    ctx.translate(rnd(-1, 1) * sh * 7, rnd(-1, 1) * sh * 7);
    ctx.clearRect(-10, -10, W + 20, H + 20);
    drawBg();
    if (!state) { ctx.restore(); return; }

    drawUltUnder();
    state.items.forEach(drawItem);
    state.enemies.forEach(drawEnemy);
    drawBeams();
    drawShots();
    drawArcs();
    drawPlayer();
    drawOrbs();
    drawEnemyShots();
    drawParticles();
    drawUltOver();
    ctx.restore();

    if (state.awaken > 0) drawAwakenEdge();
    drawHud();
    drawWordShow();
    drawBanner();
    if (state.warnT > 0) drawWarn();
    if (state.codexPop) drawCodexPop();
    if (state.flash > 0) {
      ctx.globalAlpha = clamp(state.flash, 0, 0.6);
      ctx.fillStyle = '#fff6e0';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (state.hurtFlash > 0) {
      var g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(255,40,60,0)');
      g.addColorStop(1, 'rgba(255,40,60,' + (state.hurtFlash * 1.4).toFixed(2) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ── 战场背景：俯视卷轴地图（离屏缓存一张可上下无缝拼接的地块，逐帧只做平移） ──
     每个地区一套专属地貌配方（河流 / 海岸 / 沙漠 / 雪原 / 街区…），地面 → 高楼楼顶 → 云影 → 云层 → 飞尘 */
  var bgCache = { key: '' };
  var BG_M = 40;
  var REGION_HIGH = { nyc: 1, hongkong: 1, seoul: 1, singapore: 1 };

  function bgCanvas(w, h) {
    var sc = 1.5, cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.floor(w * sc));
    cv.height = Math.max(1, Math.floor(h * sc));
    var g = cv.getContext('2d');
    g.scale(sc, sc);
    return { cv: cv, g: g };
  }
  function bgRand(seed) {
    return function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  }
  // 物体跨越地块上下边界时在另一端补画一次，保证纵向无缝
  function bgWrap(th, y, s, fn) {
    [0, th, -th].forEach(function (d) { if (y + d + s > 0 && y + d - s < th) fn(y + d); });
  }
  function roofRect(g, x, y, w, h, fill) {
    g.fillStyle = fill; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x, y, w, 1.2); g.fillRect(x, y, 1.2, h);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + h - 1.6, w, 1.6); g.fillRect(x + w - 1.6, y, 1.6, h);
  }

  function buildGround(rid, w, th, c1) {
    var o = bgCanvas(w, th), g = o.g, TAU = Math.PI * 2;
    var seed = 24601;
    for (var si = 0; si < rid.length; si++) seed = (seed * 31 + rid.charCodeAt(si)) & 0x7fffff;
    var rr = bgRand(seed);
    var waters = [];
    function pick(a) { return a[Math.floor(rr() * a.length)]; }
    function wet(x, y) { for (var i = 0; i < waters.length; i++) if (waters[i](x, y)) return true; return false; }
    function landPt(pad) {
      for (var k = 0; k < 16; k++) {
        var x = rr() * w, y = rr() * th;
        if (!wet(x, y) && !wet(x - pad, y) && !wet(x + pad, y)) return [x, y];
      }
      return null;
    }
    function waterPt() {
      for (var k = 0; k < 30; k++) { var x = rr() * w, y = rr() * th; if (wet(x - 14, y) && wet(x + 14, y)) return [x, y]; }
      return null;
    }
    function wrap(y, s, fn) { bgWrap(th, y, s, fn); }
    function circ(x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    function vpath(fx, lw, col, dash) {
      g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.setLineDash(dash || []);
      g.beginPath();
      for (var y = -12; y <= th + 12; y += 6) { if (y === -12) g.moveTo(fx(y), y); else g.lineTo(fx(y), y); }
      g.stroke(); g.setLineDash([]);
    }
    function sy(y, k) { return Math.sin(y / th * TAU * k); }

    /* —— 地貌部件 —— */
    function base(col, speck) {
      g.fillStyle = col; g.fillRect(0, 0, w, th);
      for (var i = 0; i < 600; i++) {
        g.fillStyle = rr() < 0.5 ? 'rgba(255,255,255,' + (speck || 0.03) + ')' : 'rgba(0,0,0,.12)';
        g.fillRect(rr() * w, rr() * th, 1 + rr() * 2.5, 1 + rr() * 2.5);
      }
    }
    function river(cx, amp, width, col, bank) {
      var fx = function (y) { return w * cx + sy(y, 1) * w * amp + sy(y, 3) * 8; };
      vpath(fx, width + 14, bank || 'rgba(70,80,60,.5)');
      vpath(fx, width, col);
      vpath(function (y) { return fx(y) - width * 0.22; }, 1.2, 'rgba(200,230,255,.16)', [10, 14]);
      vpath(function (y) { return fx(y) + width * 0.2; }, 1, 'rgba(200,230,255,.1)', [6, 18]);
      waters.push(function (x, y) { return Math.abs(x - fx(y)) < width / 2 + 8; });
      return fx;
    }
    function coast(side, pos, col, sand) {
      var fx = function (y) { return w * pos + sy(y, 2) * 26 + sy(y, 5) * 8; };
      var edge = side > 0 ? w + 2 : -2;
      g.beginPath(); g.moveTo(edge, -2);
      for (var y = 0; y <= th; y += 6) g.lineTo(fx(y), y);
      g.lineTo(fx(th), th + 2); g.lineTo(edge, th + 2); g.closePath();
      g.fillStyle = col; g.fill();
      if (sand) vpath(function (y) { return fx(y) - side * 7; }, 14, sand);
      for (var s = 0; s < 4; s++) {
        vpath(function (y) { return fx(y) + side * (5 + s * 15); }, 1.2, 'rgba(190,230,255,' + (0.22 - s * 0.045).toFixed(3) + ')');
      }
      waters.push(function (x, y) { return side > 0 ? x > fx(y) - 10 : x < fx(y) + 10; });
      return fx;
    }
    function bridges(fx, n, span) {
      for (var k = 0; k < n; k++) {
        var y = (k + 0.4) * th / n, x = fx(y);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - span / 2, y + 4, span, 8);
        roofRect(g, x - span / 2, y, span, 8, 'rgba(160,150,140,.6)');
      }
    }
    // 街区：道路按段检测，不会画进水里；每格切 1~split² 栋楼顶
    function blocks(op) {
      var rows = Math.max(3, Math.round(th / (op.bh || 150))), bh = th / rows;
      var cols = op.cols || 3, bw = w / cols, road = op.road || 14, x, y, c, r;
      g.fillStyle = op.roadCol || 'rgba(255,255,255,.045)';
      for (c = 0; c <= cols; c++) for (y = 0; y < th; y += 6) if (!wet(c * bw, y + 3)) g.fillRect(c * bw - road / 2, y, road, 6);
      for (r = 0; r <= rows; r++) for (x = 0; x < w; x += 6) if (!wet(x + 3, r * bh)) g.fillRect(x, r * bh - road / 2, 6, road);
      if (op.lane) {
        g.fillStyle = op.lane;
        for (c = 0; c <= cols; c++) for (y = 0; y < th; y += 18) if (!wet(c * bw, y)) g.fillRect(c * bw - 0.6, y, 1.2, 8);
      }
      for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
        var x0 = c * bw + road / 2 + 3, y0 = r * bh + road / 2 + 3, ww = bw - road - 6, hh = bh - road - 6;
        if (op.skip && rr() < op.skip) continue;
        if (op.park && rr() < op.park && !wet(x0 + ww / 2, y0 + hh / 2)) { parkCell(x0, y0, ww, hh, op.treeCols); continue; }
        var nx = 1 + Math.floor(rr() * (op.split || 2)), ny = 1 + Math.floor(rr() * (op.split || 2));
        for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) {
          var rw = ww / nx - 4, rh = hh / ny - 4, rx = x0 + i * (ww / nx) + 2, ry = y0 + j * (hh / ny) + 2;
          if (wet(rx, ry) || wet(rx + rw, ry + rh) || wet(rx + rw, ry) || wet(rx, ry + rh)) continue;
          roofRect(g, rx, ry, rw, rh, pick(op.roofs));
          if (op.deco) op.deco(rx, ry, rw, rh);
          else if (rr() < 0.5) { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(rx + 3 + rr() * (rw - 12), ry + 3 + rr() * (rh - 10), 5 + rr() * 5, 4 + rr() * 3); }
        }
      }
      return { bw: bw, bh: bh, cols: cols, rows: rows, road: road };
    }
    function parkCell(x, y, ww, hh, cols) {
      g.fillStyle = 'rgba(46,88,48,.55)'; g.fillRect(x, y, ww, hh);
      g.strokeStyle = 'rgba(220,210,170,.16)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + ww * 0.7, y + hh * 0.3, x + ww, y + hh); g.stroke();
      for (var i = 0; i < 6 + ww * hh / 900; i++) tree(x + 6 + rr() * (ww - 12), y + 6 + rr() * (hh - 12), 4 + rr() * 4, pick(cols || ['rgba(60,120,60,.85)', 'rgba(80,140,70,.8)']));
    }
    function tree(x, y, r, col) {
      wrap(y, r + 6, function (yy) {
        circ(x + r * 0.35, yy + r * 0.45, r, 'rgba(0,0,0,.32)');
        circ(x, yy, r, col);
        circ(x - r * 0.3, yy - r * 0.3, r * 0.45, 'rgba(255,255,255,.12)');
      });
    }
    function trees(n, cols, r0, r1) {
      for (var i = 0; i < n; i++) { var pt = landPt(r1); if (pt) tree(pt[0], pt[1], r0 + rr() * (r1 - r0), pick(cols)); }
    }
    function palm(x, y, r) {
      var rot = rr() * 6;
      wrap(y, r + 6, function (yy) {
        circ(x + 4, yy + 5, r * 0.8, 'rgba(0,0,0,.3)');
        g.strokeStyle = 'rgba(80,150,70,.75)'; g.lineWidth = 2.4; g.lineCap = 'round';
        for (var f = 0; f < 6; f++) {
          var an = rot + f * TAU / 6;
          g.beginPath(); g.moveTo(x, yy);
          g.quadraticCurveTo(x + Math.cos(an + 0.3) * r * 0.6, yy + Math.sin(an + 0.3) * r * 0.6, x + Math.cos(an) * r, yy + Math.sin(an) * r);
          g.stroke();
        }
        circ(x, yy, 1.8, 'rgba(120,90,50,.9)');
      });
    }
    function palms(n, r0, r1, near) {
      for (var i = 0; i < n; i++) {
        var pt = near ? (function () { var y = rr() * th; return [near(y), y]; })() : landPt(r1);
        if (pt && !wet(pt[0], pt[1])) palm(pt[0], pt[1], r0 + rr() * (r1 - r0));
      }
    }
    function boat(x, y, len, col, wake) {
      wrap(y, len + 30, function (yy) {
        if (wake) {
          g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1.4;
          g.beginPath(); g.moveTo(x - len * 0.15, yy + len * 0.4); g.lineTo(x - len * 0.6, yy + len * 1.6);
          g.moveTo(x + len * 0.15, yy + len * 0.4); g.lineTo(x + len * 0.6, yy + len * 1.6); g.stroke();
        }
        var bw = Math.max(4, len * 0.28);
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath(); g.ellipse(x + 3, yy + 3, bw / 2, len / 2, 0, 0, TAU); g.fill();
        g.fillStyle = col;
        g.beginPath(); g.moveTo(x, yy - len / 2); g.quadraticCurveTo(x + bw / 2, yy - len * 0.2, x + bw / 2, yy + len / 2);
        g.lineTo(x - bw / 2, yy + len / 2); g.quadraticCurveTo(x - bw / 2, yy - len * 0.2, x, yy - len / 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - bw * 0.25, yy - len * 0.05, bw * 0.5, len * 0.3);
      });
    }
    function boats(n, l0, l1, cols, onRiver) {
      for (var i = 0; i < n; i++) {
        var pt;
        if (onRiver) { var y = rr() * th; pt = [onRiver(y) + (rr() - 0.5) * 16, y]; } else pt = waterPt();
        if (pt) boat(pt[0], pt[1], l0 + rr() * (l1 - l0), pick(cols), true);
      }
    }
    function dome(x, y, r, col) {
      wrap(y, r + 6, function (yy) {
        circ(x + r * 0.3, yy + r * 0.4, r, 'rgba(0,0,0,.35)');
        var dg = g.createRadialGradient(x - r * 0.35, yy - r * 0.35, 1, x, yy, r);
        dg.addColorStop(0, 'rgba(255,255,255,.55)'); dg.addColorStop(0.35, col); dg.addColorStop(1, 'rgba(0,0,0,.5)');
        g.fillStyle = dg; g.beginPath(); g.arc(x, yy, r, 0, TAU); g.fill();
        circ(x, yy, 1.8, hexA(c1, 0.9));
      });
    }
    function onion(x, y, r, col) {
      dome(x, y, r, col);
      wrap(y, r, function (yy) {
        g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.2;
        for (var k = 0; k < 5; k++) { g.beginPath(); g.arc(x, yy, r * 0.8, k * 1.256, k * 1.256 + 0.7); g.stroke(); }
      });
    }
    function pyramid(x, y, s) {
      wrap(y, s * 2, function (yy) {
        g.fillStyle = 'rgba(0,0,0,.4)';
        g.beginPath(); g.moveTo(x + s, yy - s); g.lineTo(x + s * 2.2, yy + s * 0.6); g.lineTo(x + s * 0.6, yy + s * 2.2); g.lineTo(x - s, yy + s); g.closePath(); g.fill();
        [[-1, -1, 1, -1, 'rgba(240,210,150,.7)'], [-1, -1, -1, 1, 'rgba(220,185,120,.62)'], [1, -1, 1, 1, 'rgba(150,115,70,.62)'], [-1, 1, 1, 1, 'rgba(120,90,55,.66)']].forEach(function (t) {
          g.fillStyle = t[4];
          g.beginPath(); g.moveTo(x + t[0] * s, yy + t[1] * s); g.lineTo(x + t[2] * s, yy + t[3] * s); g.lineTo(x, yy); g.closePath(); g.fill();
        });
      });
    }
    function dunes(n) {
      for (var i = 0; i < n; i++) {
        var x = rr() * w, y = rr() * th, L = 30 + rr() * 70, a = -0.35 + rr() * 0.7;
        if (wet(x, y)) continue;
        wrap(y, L, function (yy) {
          g.save(); g.translate(x, yy); g.rotate(a);
          g.strokeStyle = 'rgba(255,225,160,.14)'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, -L * 0.25, L / 2, 0); g.stroke();
          g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 4;
          g.beginPath(); g.moveTo(-L / 2, 3); g.quadraticCurveTo(0, -L * 0.25 + 3, L / 2, 3); g.stroke();
          g.restore();
        });
      }
    }
    function contours(n, r0, r1, tint) {
      for (var m = 0; m < n; m++) {
        var pt = landPt(r1); if (!pt) continue;
        var mx = pt[0], mr = r0 + rr() * (r1 - r0), rings = 4 + Math.floor(rr() * 3), ph = rr() * 6;
        wrap(pt[1], mr * 1.2, function (yy) {
          for (var q = 0; q < rings; q++) {
            var rad = mr * (1 - q / rings);
            g.beginPath();
            for (var a = 0; a <= 24; a++) {
              var an = a / 24 * TAU, rj = rad * (1 + 0.14 * Math.sin(an * 3 + ph + q) + 0.06 * Math.sin(an * 5 + ph));
              if (a) g.lineTo(mx + Math.cos(an) * rj * 1.2, yy + Math.sin(an) * rj); else g.moveTo(mx + Math.cos(an) * rj * 1.2, yy + Math.sin(an) * rj);
            }
            g.closePath();
            g.fillStyle = tint || 'rgba(70,120,70,.14)'; g.fill();
            g.strokeStyle = 'rgba(255,255,255,' + (0.04 + q * 0.02).toFixed(3) + ')'; g.lineWidth = 1; g.stroke();
          }
        });
      }
    }
    function tracks(fx, tie) {
      vpath(function (y) { return fx(y) - 4; }, 1.2, 'rgba(200,200,215,.35)');
      vpath(function (y) { return fx(y) + 4; }, 1.2, 'rgba(200,200,215,.35)');
      g.fillStyle = tie || 'rgba(120,100,80,.4)';
      for (var y = 0; y < th; y += 7) g.fillRect(fx(y) - 6, y, 12, 2);
    }
    function glows(n, cols, r0, r1) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < n; i++) {
        var pt = landPt(4); if (!pt) continue;
        var r = r0 + rr() * (r1 - r0), col = pick(cols);
        wrap(pt[1], r, function (yy) {
          var lg = g.createRadialGradient(pt[0], yy, 0, pt[0], yy, r);
          lg.addColorStop(0, hexA(col, 0.4)); lg.addColorStop(1, hexA(col, 0));
          g.fillStyle = lg; g.fillRect(pt[0] - r, yy - r, r * 2, r * 2);
          circ(pt[0], yy, 1.3, hexA(col, 0.9));
        });
      }
      g.restore();
    }
    function vehicles(b, n, cols, len) {
      for (var i = 0; i < n; i++) {
        var c = Math.floor(rr() * (b.cols + 1)), y = rr() * th, x = c * b.bw + (rr() < 0.5 ? -3 : 3);
        if (wet(x, y)) continue;
        roofRect(g, x - 2, y, 4, len || 7, pick(cols));
      }
    }
    function stalls(b, n) {
      var cs = ['#ff5a6e', '#ffd166', '#5ac8ff', '#ff9ec4', '#7cf0a8'];
      for (var i = 0; i < n; i++) {
        var c = Math.floor(rr() * (b.cols + 1)), y = rr() * th, x = c * b.bw + (rr() < 0.5 ? -1 : 1) * (b.road / 2 + 7);
        if (wet(x, y)) continue;
        var col = pick(cs);
        wrap(y, 12, function (yy) {
          g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 4, yy - 5, 11, 13);
          g.fillStyle = hexA(col, 0.75); g.fillRect(x - 5, yy - 6, 10, 12);
          g.fillStyle = 'rgba(255,255,255,.35)';
          for (var s = 0; s < 3; s++) g.fillRect(x - 5 + s * 3.4, yy - 6, 1.6, 12);
        });
      }
    }
    function tilePatch(x, y, s) {
      wrap(y, s, function (yy) {
        for (var i = 0; i < s; i += 6) for (var j = 0; j < s; j += 6) {
          g.fillStyle = (i + j) / 6 % 2 ? 'rgba(70,120,200,.5)' : 'rgba(230,235,245,.28)';
          g.fillRect(x + i, yy + j, 5.4, 5.4);
          g.fillStyle = 'rgba(40,80,170,.6)'; g.beginPath(); g.arc(x + i + 2.7, yy + j + 2.7, 1.2, 0, TAU); g.fill();
        }
      });
    }
    function papel(n) {
      var cs = ['#ff5a8a', '#ffd166', '#5ad1ff', '#9b7bff', '#7cf0a8', '#ff8a3d'];
      for (var i = 0; i < n; i++) {
        var y = rr() * th, sag = 8 + rr() * 8;
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(w / 2, y + sag * 2, w, y); g.stroke();
        for (var x = 6; x < w; x += 10) {
          var t = x / w, yy = y + 4 * sag * t * (1 - t);
          g.fillStyle = hexA(pick(cs), 0.7);
          g.beginPath(); g.moveTo(x - 3.5, yy); g.lineTo(x + 3.5, yy); g.lineTo(x, yy + 7); g.closePath(); g.fill();
        }
      }
    }

    /* —— 地区配方 —— */
    var R = {
      london: function () {
        base('#1b1f25');
        var fx = river(0.5, 0.2, 52, 'rgba(40,60,80,.95)');
        var b = blocks({ cols: 3, roofs: ['rgba(70,74,84,.95)', 'rgba(84,78,74,.95)', 'rgba(60,64,72,.95)'], park: 0.12 });
        bridges(fx, 3, 90);
        vehicles(b, 10, ['rgba(210,40,40,.9)'], 11);
        glows(18, ['#ffd38a'], 8, 12);
      },
      nyc: function () {
        base('#120f18');
        var b = blocks({ cols: 4, bh: 110, split: 2, roofs: ['rgba(52,48,66,.95)', 'rgba(64,56,76,.95)', 'rgba(44,44,58,.95)'], lane: hexA(c1, 0.12) });
        var px = b.bw + 10, pw = b.bw - 20, ph = th * 0.42, py = th * 0.3;
        g.fillStyle = 'rgba(40,86,48,.9)'; g.fillRect(px, py, pw, ph);
        g.fillStyle = 'rgba(40,70,110,.9)'; g.beginPath(); g.ellipse(px + pw / 2, py + ph * 0.6, pw * 0.3, ph * 0.12, 0, 0, TAU); g.fill();
        for (var i = 0; i < 30; i++) tree(px + 6 + rr() * (pw - 12), py + 6 + rr() * (ph - 12), 4 + rr() * 3, pick(['rgba(60,120,60,.9)', 'rgba(80,140,70,.85)']));
        vehicles(b, 26, ['rgba(255,205,40,.95)'], 7);
        glows(24, [c1, '#7ad7ff'], 8, 14);
      },
      tokyo: function () {
        base('#1d1820');
        var tx = function (y) { return w * 0.62 + sy(y, 1) * 22; };
        var b = blocks({ cols: 5, bh: 90, road: 8, split: 2, roofs: ['rgba(60,66,84,.95)', 'rgba(74,70,84,.95)', 'rgba(88,64,70,.95)'] });
        g.fillStyle = 'rgba(30,26,34,1)'; for (var y = 0; y < th; y += 6) g.fillRect(tx(y) - 12, y, 24, 6);
        tracks(tx);
        trees(46, ['rgba(255,170,200,.85)', 'rgba(255,200,220,.8)', 'rgba(240,140,180,.8)'], 5, 10);
        for (var i = 0; i < 160; i++) { g.fillStyle = 'rgba(255,190,215,.35)'; g.fillRect(rr() * w, rr() * th, 1.6, 1.2); }
        glows(10, ['#ffd0e0'], 8, 12);
      },
      paris: function () {
        base('#211a18');
        var fx = river(0.5, 0.24, 34, 'rgba(48,70,84,.95)');
        blocks({ cols: 4, bh: 100, split: 2, roofs: ['rgba(80,84,96,.95)', 'rgba(150,130,110,.85)', 'rgba(96,98,110,.95)'] });
        var cx = w * 0.3, cy = th * 0.5;
        g.strokeStyle = 'rgba(200,190,170,.12)'; g.lineWidth = 12;
        for (var k = 0; k < 8; k++) {
          var a = k * TAU / 8, L = th * 0.42;
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); g.stroke();
          for (var d = 34; d < L; d += 14) {
            var ex = cx + Math.cos(a) * d, ey = cy + Math.sin(a) * d;
            if (!wet(ex, ey)) { circ(ex - Math.sin(a) * 9, ey + Math.cos(a) * 9, 3, 'rgba(70,120,60,.85)'); circ(ex + Math.sin(a) * 9, ey - Math.cos(a) * 9, 3, 'rgba(70,120,60,.85)'); }
          }
        }
        circ(cx, cy, 24, 'rgba(180,170,150,.35)'); roofRect(g, cx - 8, cy - 6, 16, 12, 'rgba(200,185,150,.85)');
        bridges(fx, 4, 60);
        glows(16, ['#ffcf8a'], 8, 12);
      },
      singapore: function () {
        base('#13201d');
        coast(1, 0.5, 'rgba(10,50,70,.95)', 'rgba(220,200,150,.25)');
        blocks({ cols: 3, split: 2, roofs: ['rgba(70,90,96,.95)', 'rgba(220,220,230,.35)', 'rgba(60,76,84,.95)'], park: 0.2 });
        palms(18, 7, 11);
        glows(8, ['#c27bff', '#7cf0ff'], 14, 22);
        boats(10, 18, 40, ['rgba(220,80,60,.9)', 'rgba(230,230,235,.9)', 'rgba(60,120,200,.9)']);
      },
      istanbul: function () {
        base('#211a14');
        coast(1, 0.66, 'rgba(24,60,92,.95)', 'rgba(200,180,140,.2)');
        blocks({ cols: 3, split: 3, roofs: ['rgba(150,80,56,.85)', 'rgba(130,70,50,.85)', 'rgba(110,90,80,.85)'],
          deco: function (x, y, ww, hh) {
            if (rr() < 0.28 && ww > 30 && hh > 30) {
              var r = Math.min(ww, hh) * 0.36;
              dome(x + ww / 2, y + hh / 2, r, 'rgba(110,140,150,.9)');
              [[x + 4, y + 4], [x + ww - 4, y + 4], [x + 4, y + hh - 4], [x + ww - 4, y + hh - 4]].forEach(function (q) { circ(q[0], q[1], 2.6, 'rgba(220,210,190,.9)'); });
            }
          } });
        boats(8, 16, 30, ['rgba(230,230,235,.9)', 'rgba(200,60,50,.9)']);
      },
      seoul: function () {
        base('#100f19');
        var b = blocks({ cols: 3, bh: 120, split: 2, road: 18, roofs: ['rgba(44,46,64,.95)', 'rgba(54,50,72,.95)'] });
        stalls(b, 40);
        glows(30, ['#ff6fae', '#6fd8ff', '#ffe066', '#a37bff'], 8, 16);
        contours(2, 40, 60, 'rgba(60,90,70,.16)');
      },
      bangkok: function () {
        base('#1d1a10');
        var fx = river(0.42, 0.16, 64, 'rgba(80,70,40,.92)', 'rgba(60,90,50,.5)');
        blocks({ cols: 4, bh: 120, skip: 0.15, roofs: ['rgba(140,60,50,.85)', 'rgba(100,90,70,.85)'],
          deco: function (x, y, ww, hh) {
            if (rr() < 0.18 && ww > 28) {
              roofRect(g, x + 3, y + 3, ww - 6, hh - 6, 'rgba(180,60,40,.85)');
              roofRect(g, x + 8, y + 8, ww - 16, hh - 16, 'rgba(210,170,60,.85)');
              circ(x + ww / 2, y + hh / 2, 3, 'rgba(255,220,120,.95)');
            }
          } });
        boats(14, 14, 24, ['rgba(200,80,50,.9)', 'rgba(60,140,90,.9)', 'rgba(240,200,80,.9)'], fx);
        palms(20, 6, 10, function (y) { return fx(y) + (rr() < 0.5 ? -1 : 1) * (42 + rr() * 10); });
      },
      mexico: function () {
        base('#211521');
        var b = blocks({ cols: 4, bh: 100, split: 2, roofs: ['rgba(200,90,120,.7)', 'rgba(60,150,150,.7)', 'rgba(220,170,70,.7)', 'rgba(120,80,160,.7)'] });
        papel(5);
        for (var i = 0; i < 18; i++) {
          var pt = landPt(6); if (!pt) continue;
          for (var k = 0; k < 9; k++) circ(pt[0] + (rr() - 0.5) * 18, pt[1] + (rr() - 0.5) * 14, 1.8 + rr() * 1.4, pick(['rgba(255,150,30,.9)', 'rgba(255,200,40,.9)']));
        }
        glows(26, ['#ffb24a'], 6, 10);
        vehicles(b, 6, ['rgba(80,200,120,.9)'], 9);
      },
      cairo: function () {
        base('#2e2416', 0.05);
        var fx = river(0.84, 0.05, 34, 'rgba(30,70,90,.95)', 'rgba(70,110,50,.75)');
        dunes(80);
        pyramid(w * 0.28, th * 0.25, 30); pyramid(w * 0.52, th * 0.42, 22); pyramid(w * 0.2, th * 0.7, 16);
        palms(22, 6, 10, function (y) { return fx(y) + (rr() < 0.5 ? -1 : 1) * (24 + rr() * 8); });
        boats(5, 12, 20, ['rgba(240,240,230,.9)'], fx);
      },
      lisbon: function () {
        base('#16191c');
        coast(1, 0.74, 'rgba(26,62,86,.95)', 'rgba(210,190,150,.2)');
        blocks({ cols: 4, bh: 80, road: 9, split: 2, roofs: ['rgba(190,100,60,.8)', 'rgba(170,80,50,.8)', 'rgba(200,120,70,.75)'] });
        for (var i = 0; i < 6; i++) { var pt = landPt(30); if (pt) tilePatch(pt[0] - 15, pt[1] - 15, 30); }
        var tx = function (y) { return w * 0.34 + sy(y, 2) * w * 0.12; };
        tracks(tx, 'rgba(90,80,70,.3)');
        for (var k = 0; k < 3; k++) { var y = (k + 0.3) * th / 3; roofRect(g, tx(y) - 5, y, 10, 22, 'rgba(250,200,40,.95)'); }
      },
      rome: function () {
        base('#251e19');
        river(0.78, 0.08, 30, 'rgba(50,80,70,.9)');
        blocks({ cols: 4, bh: 100, skip: 0.25, split: 2, roofs: ['rgba(190,120,70,.75)', 'rgba(200,150,90,.7)', 'rgba(170,100,60,.75)'] });
        var cx = w * 0.36, cy = th * 0.48;
        g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(cx + 8, cy + 10, 52, 42, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(200,170,130,.85)'; g.beginPath(); g.ellipse(cx, cy, 52, 42, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(90,70,50,.6)'; g.lineWidth = 1;
        for (var k = 0; k < 40; k++) { var a = k / 40 * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 22); g.lineTo(cx + Math.cos(a) * 52, cy + Math.sin(a) * 42); g.stroke(); }
        g.fillStyle = 'rgba(140,105,70,.95)'; g.beginPath(); g.ellipse(cx, cy, 28, 20, 0, 0, TAU); g.fill();
        circ(w * 0.6, th * 0.15, 14, 'rgba(200,190,170,.5)'); circ(w * 0.6, th * 0.15, 10, 'rgba(70,140,190,.8)');
        for (var i = 0; i < 26; i++) {
          var pt = landPt(4); if (!pt) continue;
          wrap(pt[1], 12, function (yy) {
            g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(pt[0] + 4, yy + 6, 3, 9, 0.4, 0, TAU); g.fill();
            g.fillStyle = 'rgba(40,80,40,.95)'; g.beginPath(); g.ellipse(pt[0], yy, 3.4, 7, 0, 0, TAU); g.fill();
          });
        }
      },
      hongkong: function () {
        base('#140f18');
        coast(1, 0.7, 'rgba(16,40,70,.95)');
        var b = blocks({ cols: 4, bh: 80, road: 8, split: 2, roofs: ['rgba(56,50,66,.95)', 'rgba(66,58,74,.95)', 'rgba(48,46,60,.95)'] });
        contours(3, 40, 60, 'rgba(50,90,60,.18)');
        glows(34, ['#ff6fae', '#ffb066', '#6fd8ff'], 6, 14);
        boats(9, 18, 32, ['rgba(40,120,80,.95)', 'rgba(230,230,235,.9)']);
        vehicles(b, 6, ['rgba(220,60,60,.9)'], 6);
      },
      rio: function () {
        base('#13201a');
        var fx = coast(1, 0.64, 'rgba(14,70,90,.95)', 'rgba(230,210,160,.35)');
        var k = Math.round(th / 26);
        g.strokeStyle = 'rgba(240,240,240,.28)'; g.lineWidth = 2;
        g.beginPath();
        for (var y = 0; y <= th; y += 2) { var x = fx(y) - 26 + Math.sin(y / th * TAU * k) * 5; if (y) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
        contours(4, 44, 70, 'rgba(60,120,70,.2)');
        for (var i = 0; i < 70; i++) { var pt = landPt(6); if (pt && pt[0] < w * 0.35) roofRect(g, pt[0], pt[1], 6 + rr() * 5, 5 + rr() * 4, pick(['rgba(220,120,80,.7)', 'rgba(90,170,200,.7)', 'rgba(240,210,90,.7)', 'rgba(230,230,230,.5)'])); }
        palms(20, 6, 10, function (y) { return fx(y) - 40 - rr() * 14; });
        boats(5, 14, 24, ['rgba(240,240,240,.9)']);
      },
      mumbai: function () {
        base('#211a12');
        var fx = coast(-1, 0.32, 'rgba(20,60,80,.95)', 'rgba(220,200,150,.25)');
        for (var y = 6; y < th; y += 14) circ(fx(y) + 18, y, 1.8, 'rgba(255,220,140,.8)');
        var b = blocks({ cols: 4, bh: 80, road: 9, split: 3, roofs: ['rgba(160,110,80,.8)', 'rgba(110,130,140,.8)', 'rgba(180,90,90,.75)', 'rgba(120,110,90,.85)'] });
        vehicles(b, 30, ['rgba(255,210,50,.9)', 'rgba(60,170,90,.9)'], 5);
        palms(14, 6, 10, function (y) { return fx(y) + 30 + rr() * 10; });
        boats(4, 14, 24, ['rgba(200,80,60,.9)']);
      },
      moscow: function () {
        base('#262d3a', 0.09);
        river(0.7, 0.14, 38, 'rgba(60,80,100,.9)', 'rgba(200,210,230,.25)');
        blocks({ cols: 3, bh: 140, split: 2, roofs: ['rgba(180,190,205,.55)', 'rgba(150,160,180,.55)', 'rgba(200,205,215,.5)'] });
        var sx = w * 0.12, sy2 = th * 0.3;
        g.fillStyle = 'rgba(140,40,40,.55)'; g.fillRect(sx, sy2, w * 0.4, th * 0.2);
        g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1;
        for (var x = sx; x < sx + w * 0.4; x += 6) { g.beginPath(); g.moveTo(x, sy2); g.lineTo(x, sy2 + th * 0.2); g.stroke(); }
        var oc = ['rgba(220,60,60,.9)', 'rgba(60,160,110,.9)', 'rgba(230,190,60,.9)', 'rgba(70,120,210,.9)'];
        [[0.2, 0.55, 10], [0.3, 0.57, 7], [0.4, 0.55, 9], [0.3, 0.62, 6], [0.15, 0.6, 6]].forEach(function (d) { onion(w * d[0], th * d[1], d[2], pick(oc)); });
        trees(30, ['rgba(220,230,240,.55)', 'rgba(180,200,215,.5)'], 4, 7);
        for (var i = 0; i < 260; i++) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(rr() * w, rr() * th, 1.4, 1.4); }
      },
      sydney: function () {
        base('#16202a');
        coast(1, 0.66, 'rgba(18,70,110,.95)', 'rgba(230,215,170,.3)');
        blocks({ cols: 3, bh: 110, split: 2, park: 0.2, roofs: ['rgba(80,90,104,.9)', 'rgba(96,104,116,.9)', 'rgba(70,78,92,.9)'] });
        for (var k = 0; k < 3; k++) { var y = (k + 0.5) * th / 3, x = w * 0.72; roofRect(g, x - 9, y - 6, 18, 12, 'rgba(240,240,232,.85)'); }
        boats(8, 14, 26, ['rgba(240,240,240,.9)', 'rgba(250,200,60,.9)']);
      },
      barcelona: function () {
        base('#241a14');
        coast(1, 0.8, 'rgba(20,70,100,.95)', 'rgba(230,210,160,.3)');
        blocks({ cols: 4, bh: 72, road: 10, split: 1, roofs: ['rgba(190,110,70,.8)', 'rgba(170,96,64,.8)', 'rgba(200,130,80,.75)'],
          deco: function (x, y, ww, hh) { g.fillStyle = 'rgba(40,30,24,.6)'; g.fillRect(x + ww * 0.3, y + hh * 0.3, ww * 0.4, hh * 0.4); } });
        for (var i = 0; i < 6; i++) { var pt = landPt(24); if (pt) tilePatch(pt[0] - 12, pt[1] - 12, 24); }
        palms(10, 6, 9, function (y) { return w * 0.78 - 10 - rr() * 10; });
      },
      amsterdam: function () {
        base('#182024');
        [0.22, 0.5, 0.78].forEach(function (cx) { var fx = river(cx, 0.03, 22, 'rgba(30,60,80,.95)', 'rgba(80,90,90,.5)'); bridges(fx, 4, 34); boats(3, 10, 18, ['rgba(200,80,60,.9)', 'rgba(60,120,80,.9)'], fx); });
        blocks({ cols: 6, bh: 70, road: 6, split: 1, roofs: ['rgba(120,70,50,.85)', 'rgba(90,60,46,.85)', 'rgba(140,90,60,.8)'] });
        trees(30, ['rgba(70,120,60,.85)'], 3, 5);
      },
      berlin: function () {
        base('#1c1d22');
        river(0.3, 0.1, 30, 'rgba(40,60,76,.95)');
        var b = blocks({ cols: 3, bh: 120, split: 2, park: 0.18, roofs: ['rgba(90,92,100,.9)', 'rgba(110,104,96,.9)', 'rgba(76,80,90,.9)'] });
        vehicles(b, 12, ['rgba(250,210,60,.9)', 'rgba(230,230,230,.8)'], 8);
        glows(14, ['#ffd38a'], 6, 10);
      },
      athens: function () {
        base('#2a271f', 0.05);
        contours(3, 50, 80, 'rgba(160,150,110,.16)');
        blocks({ cols: 4, bh: 80, road: 8, split: 2, skip: 0.2, roofs: ['rgba(230,225,210,.6)', 'rgba(210,200,180,.6)', 'rgba(190,120,80,.6)'] });
        var cx = w * 0.42, cy = th * 0.3;
        roofRect(g, cx - 34, cy - 16, 68, 32, 'rgba(230,220,195,.85)');
        for (var i = 0; i < 8; i++) circ(cx - 28 + i * 8, cy - 12, 2, 'rgba(120,110,90,.6)');
        trees(40, ['rgba(110,130,70,.8)', 'rgba(90,110,60,.8)'], 3, 5);
      },
      marrakech: function () {
        base('#3a2218', 0.05);
        dunes(30);
        var b = blocks({ cols: 5, bh: 64, road: 6, split: 2, roofs: ['rgba(200,110,70,.8)', 'rgba(180,96,60,.8)', 'rgba(210,130,80,.75)'] });
        stalls(b, 30);
        for (var i = 0; i < 5; i++) { var pt = landPt(20); if (pt) tilePatch(pt[0] - 10, pt[1] - 10, 20); }
        palms(14, 6, 9);
      },
      hanoi: function () {
        base('#18221a');
        var lx = w * 0.5, ly = th * 0.45;
        g.fillStyle = 'rgba(30,80,80,.95)'; g.beginPath(); g.ellipse(lx, ly, w * 0.18, th * 0.16, 0, 0, TAU); g.fill();
        waters.push(function (x, y) { var dx = (x - lx) / (w * 0.18 + 8), dy = (y - ly) / (th * 0.16 + 8); return dx * dx + dy * dy < 1; });
        roofRect(g, lx - 5, ly - 5, 10, 10, 'rgba(210,200,160,.9)');
        var b = blocks({ cols: 5, bh: 60, road: 6, split: 2, roofs: ['rgba(200,180,120,.7)', 'rgba(160,110,80,.75)', 'rgba(120,140,110,.7)'] });
        vehicles(b, 40, ['rgba(230,60,60,.9)', 'rgba(240,240,240,.8)', 'rgba(60,140,220,.9)'], 3);
        trees(30, ['rgba(60,120,60,.85)'], 4, 6);
      },
      beijing: function () {
        base('#2a1c1a');
        blocks({ cols: 5, bh: 60, road: 6, split: 2, roofs: ['rgba(110,110,120,.85)', 'rgba(96,96,108,.85)'],
          deco: function (x, y, ww, hh) { g.fillStyle = 'rgba(160,50,40,.4)'; g.fillRect(x, y + hh - 2, ww, 2); } });
        var cx = w * 0.5, cy = th * 0.38;
        g.fillStyle = 'rgba(140,40,40,.65)'; g.fillRect(cx - w * 0.22, cy - th * 0.12, w * 0.44, th * 0.24);
        roofRect(g, cx - 40, cy - 40, 80, 80, 'rgba(200,170,90,.5)');
        circ(cx, cy, 20, 'rgba(60,90,180,.85)'); circ(cx, cy, 12, 'rgba(70,110,200,.9)'); circ(cx, cy, 3, 'rgba(240,200,80,.95)');
        trees(30, ['rgba(70,110,60,.85)'], 3, 5);
        glows(16, ['#ff5a4a', '#ffcc55'], 5, 9);
      },
      toronto: function () {
        base('#1c1818');
        coast(-1, 0.28, 'rgba(24,60,90,.95)', 'rgba(200,190,160,.2)');
        var b = blocks({ cols: 4, bh: 100, split: 2, park: 0.15, roofs: ['rgba(80,84,96,.9)', 'rgba(100,96,92,.9)', 'rgba(66,70,82,.9)'] });
        trees(30, ['rgba(220,80,50,.85)', 'rgba(240,150,50,.85)', 'rgba(200,60,40,.85)'], 4, 7);
        vehicles(b, 10, ['rgba(220,40,40,.9)'], 10);
        circ(w * 0.45, th * 0.6, 7, 'rgba(200,205,215,.8)');
      },
      capetown: function () {
        base('#16201e');
        coast(1, 0.7, 'rgba(14,64,90,.95)', 'rgba(235,225,200,.35)');
        roofRect(g, w * 0.08, th * 0.2, w * 0.4, th * 0.22, 'rgba(90,110,90,.7)');
        contours(3, 40, 64, 'rgba(70,110,80,.2)');
        for (var i = 0; i < 60; i++) { var pt = landPt(6); if (pt) roofRect(g, pt[0], pt[1], 5 + rr() * 4, 4 + rr() * 3, pick(['rgba(240,120,150,.7)', 'rgba(90,170,220,.7)', 'rgba(250,210,80,.7)', 'rgba(130,200,120,.7)'])); }
        boats(6, 12, 22, ['rgba(240,240,240,.9)']);
      },
      buenosaires: function () {
        base('#1a1626');
        river(0.86, 0.04, 40, 'rgba(70,60,40,.9)', 'rgba(90,80,60,.5)');
        var b = blocks({ cols: 4, bh: 80, road: 10, split: 2, roofs: ['rgba(80,74,96,.9)', 'rgba(100,90,110,.9)', 'rgba(70,66,86,.9)'], lane: hexA(c1, 0.12) });
        g.fillStyle = 'rgba(240,240,240,.12)'; g.fillRect(b.bw * 2 - 14, 0, 28, th);
        for (var i = 0; i < 5; i++) { var pt = landPt(18); if (pt) tilePatch(pt[0] - 9, pt[1] - 9, 18); }
        papel(3);
      },
      cusco: function () {
        base('#1e2818', 0.05);
        contours(6, 40, 90, 'rgba(80,130,70,.18)');
        for (var y = 0; y < th; y += 18) { g.strokeStyle = 'rgba(160,150,120,.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.05, y); g.lineTo(w * 0.35, y + 6); g.stroke(); }
        blocks({ cols: 3, bh: 90, road: 8, split: 2, skip: 0.4, roofs: ['rgba(170,80,60,.75)', 'rgba(150,70,50,.75)'] });
        trees(24, ['rgba(70,120,60,.85)'], 3, 6);
      },
      sanfrancisco: function () {
        base('#1a1a20');
        coast(1, 0.72, 'rgba(22,60,90,.95)');
        var fx = function (y) { return w * 0.6; };
        tracks(function (y) { return w * 0.3 + sy(y, 2) * 10; }, 'rgba(120,100,80,.3)');
        var b = blocks({ cols: 4, bh: 70, road: 9, split: 2, roofs: ['rgba(220,200,180,.6)', 'rgba(180,200,220,.6)', 'rgba(230,180,160,.6)'] });
        for (var k = 0; k < 2; k++) { var y = (k + 0.4) * th / 2; roofRect(g, fx(y), y, w * 0.4, 8, 'rgba(210,80,50,.9)'); }
        vehicles(b, 8, ['rgba(200,40,40,.9)'], 10);
        boats(6, 12, 22, ['rgba(240,240,240,.9)']);
      },
      honolulu: function () {
        base('#14281f');
        var fx = coast(1, 0.58, 'rgba(10,90,110,.95)', 'rgba(240,225,180,.45)');
        contours(3, 44, 70, 'rgba(70,130,70,.2)');
        for (var i = 0; i < 40; i++) { var pt = landPt(6); if (pt && pt[0] < w * 0.45) roofRect(g, pt[0], pt[1], 6 + rr() * 5, 5 + rr() * 4, pick(['rgba(240,240,230,.6)', 'rgba(250,180,120,.6)', 'rgba(120,200,210,.6)'])); }
        palms(26, 6, 10, function (y) { return fx(y) - 24 - rr() * 18; });
        boats(6, 10, 18, ['rgba(250,210,60,.9)', 'rgba(240,240,240,.9)']);
      },
    };
    (R[rid] || R.london)();
    var tg = g.createLinearGradient(0, 0, 0, th);
    tg.addColorStop(0, 'rgba(4,3,10,.3)'); tg.addColorStop(0.5, 'rgba(4,3,10,.2)'); tg.addColorStop(1, 'rgba(4,3,10,.3)');
    g.fillStyle = tg; g.fillRect(0, 0, w, th);
    return o.cv;
  }

  // 高楼楼顶层：比地面卷得快、平移幅度大，带投影 → 俯视下的高度感
  function buildHigh(rid, w, th, c1) {
    if (!REGION_HIGH[rid]) return null;
    var o = bgCanvas(w, th), g = o.g, rr = bgRand(8191 + rid.length * 31);
    var n = Math.round(th / 130);
    for (var i = 0; i < n; i++) {
      var bw = 34 + rr() * 26, bh = 34 + rr() * 30;
      var x = 10 + rr() * (w - bw - 20), y = (i + rr() * 0.6) * th / n;
      bgWrap(th, y, bh + 24, function (yy) {
        g.fillStyle = 'rgba(0,0,0,.42)';
        g.beginPath();
        g.moveTo(x + bw, yy); g.lineTo(x + bw + 16, yy + 20); g.lineTo(x + bw + 16, yy + bh + 20);
        g.lineTo(x + 16, yy + bh + 20); g.lineTo(x, yy + bh); g.closePath(); g.fill();
        roofRect(g, x, yy, bw, bh, 'rgba(46,44,64,.96)');
        g.strokeStyle = hexA(c1, 0.22); g.lineWidth = 1;
        g.strokeRect(x + 4, yy + 4, bw - 8, bh - 8);
        g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + bw * 0.3, yy + bh * 0.3, bw * 0.4, bh * 0.4);
        g.fillStyle = '#ff4d5e'; g.beginPath(); g.arc(x + bw - 6, yy + 6, 1.8, 0, Math.PI * 2); g.fill();
      });
    }
    return o.cv;
  }

  var bgMist = null, bgMotes = null;
  function seedBgFx() {
    bgMist = []; bgMotes = [];
    for (var i = 0; i < 6; i++) bgMist.push({ x: Math.random(), y: Math.random(), r: rnd(0.28, 0.5), sp: rnd(90, 130), a: rnd(0.07, 0.12), e: rnd(1.2, 1.8) });
    for (var j = 0; j < 18; j++) bgMotes.push({ x: Math.random(), y: Math.random(), r: rnd(0.7, 1.6), sp: rnd(260, 420), a: rnd(0.12, 0.28) });
  }
  // 卷动地块：源图上下无缝，所以预先拼一张 2 倍高的图，每帧只做一次采样绘制。
  // 原来每层要两次全屏 drawImage（2 层 = 4 屏混合），现在每层只混合一屏。
  function drawTile(cv, spd, panK, T, pan) {
    var th = H, off = (T * spd) % th, x = -BG_M - pan * panK;
    if (off < 0) off += th;
    var tall = cv._tall;
    if (!tall) {
      tall = document.createElement('canvas');
      tall.width = cv.width;
      tall.height = cv.height * 2;
      var g = tall.getContext('2d');
      g.drawImage(cv, 0, 0);
      g.drawImage(cv, 0, cv.height);
      cv._tall = tall;
    }
    var sc = cv.height / th;    // 源像素 / CSS 像素
    ctx.drawImage(tall, 0, cv.height - off * sc, cv.width, cv.height, x, 0, W + BG_M * 2, th);
  }
  // 云 / 暗角预渲染贴图：逐帧 12 个半屏大径向渐变 → 一次生成、之后只做贴图（视觉一致）
  var mistCache = {}, vigCache = null;
  function mistSprite(c1, shadow) {
    var key = (shadow ? 'shadow' : c1) + '|' + (shadow ? 1 : 0);
    var cv = mistCache[key];
    if (cv) return cv;
    var N = 128;
    cv = document.createElement('canvas');
    cv.width = N; cv.height = N;
    var g = cv.getContext('2d');
    var ng = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    if (shadow) {
      ng.addColorStop(0, 'rgba(0,0,0,1)'); ng.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      var t = tintHex(c1, 0.75);
      ng.addColorStop(0, hexA(t, 1));
      ng.addColorStop(0.6, hexA(t, 0.45));
      ng.addColorStop(1, hexA(c1, 0));
    }
    g.fillStyle = ng;
    g.fillRect(0, 0, N, N);
    mistCache[key] = cv;
    return cv;
  }
  function vignetteTex() {
    var key = W + 'x' + H;
    if (vigCache && vigCache.key === key) return vigCache.cv;
    var cv = document.createElement('canvas');
    cv.width = Math.max(2, Math.round(W + 20));
    cv.height = Math.max(2, Math.round(H + 20));
    var g = cv.getContext('2d');
    var vg = g.createRadialGradient(W / 2 + 10, H / 2 + 10, Math.min(W, H) * 0.35, W / 2 + 10, H / 2 + 10, Math.max(W, H) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = vg;
    g.fillRect(0, 0, cv.width, cv.height);
    vigCache = { key: key, cv: cv };
    return cv;
  }
  // 云层：12 个半屏大的柔光团 → 合成到一张半分辨率离屏，每帧只贴一次。
  // 云本身就是极平滑的径向渐变，半分辨率放大看不出差别；但混色面积只剩 1/4。
  var cloudBuf = null;
  function cloudLayer() {
    var key = W + 'x' + H;
    if (cloudBuf && cloudBuf.key === key) return cloudBuf;
    var cv = document.createElement('canvas');
    cv.width = Math.max(2, Math.ceil(W / 2));
    cv.height = Math.max(2, Math.ceil(H / 2));
    cloudBuf = { key: key, cv: cv, g: cv.getContext('2d') };
    return cloudBuf;
  }
  function drawBg() {
    var reg = state && state.region;
    var c1 = (reg && reg.c1) || '#c9a227';
    var pan = state ? state.bgPan || 0 : 0, T = state ? state.bgT || 0 : tGlobal;
    var rid = (reg && reg.id) || 'london';
    var key = rid + '|' + W + 'x' + H + '|' + c1;
    if (bgCache.key !== key) {
      bgCache.key = key;
      bgCache.ground = buildGround(rid, W + BG_M * 2, H, c1);
      bgCache.high = buildHigh(rid, W + BG_M * 2, H, c1);
    }
    if (!bgMist) seedBgFx();
    // 地面地块本身完全不透明且左右都超出屏幕，底色不再单独铺一次
    drawTile(bgCache.ground, 42, 14, T, pan);
    if (bgCache.high) drawTile(bgCache.high, 64, 26, T, pan);

    // 云：先在地面投下偏移的云影，再画半透明云团（最快、视差最大）
    var mShadow = mistSprite(c1, true), mCloud = mistSprite(c1, false);
    var cl = cloudLayer(), prevCtx = ctx;
    ctx = cl.g;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, cl.cv.width, cl.cv.height);
    ctx.scale(0.5, 0.5);
    bgMist.forEach(function (m) {
      var R = m.r * W, span = H + R * 2;
      var yy = ((m.y * span + T * m.sp) % span) - R, xx = m.x * W - pan * 50;
      ctx.save();
      ctx.globalAlpha = Math.min(1, m.a * 2.2);
      ctx.translate(xx + 36, yy + 60);
      ctx.scale(m.e, 1);
      ctx.drawImage(mShadow, -R, -R, R * 2, R * 2);
      ctx.restore();
    });
    bgMist.forEach(function (m) {
      var R = m.r * W, span = H + R * 2;
      var yy = ((m.y * span + T * m.sp) % span) - R, xx = m.x * W - pan * 50;
      ctx.save();
      ctx.globalAlpha = m.a;
      ctx.translate(xx, yy);
      ctx.scale(m.e, 1);
      ctx.drawImage(mCloud, -R, -R, R * 2, R * 2);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    ctx = prevCtx;
    ctx.drawImage(cl.cv, 0, 0, W, H);

    // 速度线飞尘
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    bgMotes.forEach(function (d) {
      var yy = (d.y * (H + 40) + T * d.sp) % (H + 40) - 20;
      var xx = ((d.x * W - pan * 70) % W + W) % W;
      ctx.globalAlpha = d.a;
      ctx.fillStyle = hexA(tintHex(c1, 0.6), 1);
      ctx.fillRect(xx - d.r * 0.5, yy, d.r, d.r * 8);
    });
    ctx.restore();

    var vg = vignetteTex();
    ctx.drawImage(vg, -10, -10, W + 20, H + 20);
  }

  /* 敌人：16×16 像素图按整数倍放大 */
  // 首领预警线：红色危险线（越临近出手越亮越细），safe 类型为绿色安全通道
  /* 首领预警：走廊渐变 + 流动虚线边 + 前进箭头 + 起点蓄光，越临近发射闪得越快；绿色 = 安全区 */
  function drawChevron(x, s) {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, -s); ctx.lineTo(x + s * 0.4, 0); ctx.lineTo(x - s * 0.6, s);
    ctx.stroke();
  }
  function drawBossTele(e) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < e.tele.length; i++) {
      var t = e.tele[i], k = 1 - t.t / t.max, blink = 0.55 + 0.45 * Math.sin(tGlobal * (12 + 30 * k));
      if (t.curtain) {
        // 弹幕帘的落弹点：顶部一排红色菱形，安全缺口处留空
        ctx.fillStyle = 'rgba(255,70,100,' + ((0.35 + 0.5 * k) * blink).toFixed(3) + ')';
        for (var cx = 10; cx < W; cx += 22) {
          if (Math.abs(cx - t.gx) <= t.gw / 2) continue;
          var ds = 2.5 + k * 2.5;
          ctx.beginPath(); ctx.moveTo(cx, t.y - ds); ctx.lineTo(cx + ds, t.y); ctx.lineTo(cx, t.y + ds); ctx.lineTo(cx - ds, t.y); ctx.closePath(); ctx.fill();
        }
        continue;
      }
      var rgb = t.safe ? '107,255,176' : '255,59,92';
      var sx = t.safe ? t.x : e.x, sy = t.safe ? t.y : e.y;
      var w = t.safe ? t.w : t.w * (1.15 - k * 0.45);
      ctx.save();
      ctx.translate(sx, sy); ctx.rotate(t.a);
      var g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
      g.addColorStop(0, 'rgba(' + rgb + ',' + (0.32 * blink).toFixed(3) + ')');
      g.addColorStop(0.5, 'rgba(' + rgb + ',' + (0.06 + 0.1 * k).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',' + (0.32 * blink).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, -w / 2, t.len, w);
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.5 + 0.45 * k).toFixed(3) + ')';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([10, 7]);
      ctx.lineDashOffset = -tGlobal * 90;
      ctx.beginPath(); ctx.moveTo(0, -w / 2); ctx.lineTo(t.len, -w / 2); ctx.moveTo(0, w / 2); ctx.lineTo(t.len, w / 2); ctx.stroke();
      ctx.setLineDash([]);
      if (!t.safe) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.6 * k * blink).toFixed(3) + ')';
        ctx.fillRect(0, -0.6, t.len, 1.2);
      }
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      var cs = Math.min(7, w * 0.3);
      for (var d = (tGlobal * 170) % 42 + 18; d < t.len; d += 42) {
        ctx.strokeStyle = 'rgba(' + rgb + ',' + ((0.7 - d / t.len * 0.5) * (0.5 + k * 0.5)).toFixed(3) + ')';
        drawChevron(d, cs);
      }
      if (!t.safe) softGlow(0, 0, 8 + 18 * k, '#ff3b5c', 0.5 + 0.4 * blink);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBossLaser(e) {
    var z = e.lz, L = Math.max(W, H) * 1.4, col = lzColor();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (z.st === 'charge') {
      var k = clamp(z.t / LZ_CHARGE, 0, 1), blink = 0.5 + 0.5 * Math.sin(tGlobal * (10 + 34 * k));
      z.angs.forEach(function (a) {
        ctx.save();
        ctx.translate(e.x, e.y); ctx.rotate(a);
        var w = z.w * (1.4 - k * 0.4);
        var g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
        g.addColorStop(0, 'rgba(255,59,92,' + (0.38 * blink).toFixed(3) + ')');
        g.addColorStop(0.5, 'rgba(255,59,92,' + (0.08 + 0.14 * k).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,59,92,' + (0.38 * blink).toFixed(3) + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, -w / 2, L, w);
        ctx.strokeStyle = 'rgba(255,90,110,' + (0.55 + 0.4 * k).toFixed(3) + ')';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([12, 8]);
        ctx.lineDashOffset = -tGlobal * 120;
        ctx.beginPath(); ctx.moveTo(0, -w / 2); ctx.lineTo(L, -w / 2); ctx.moveTo(0, w / 2); ctx.lineTo(L, w / 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + 0.7 * k * blink).toFixed(3) + ')';
        ctx.fillRect(0, -0.8, L, 1.6);
        ctx.lineWidth = 2.4;
        for (var d = (tGlobal * 260) % 48 + 30; d < L; d += 48) {
          ctx.strokeStyle = 'rgba(255,120,140,' + (0.75 * (0.4 + k * 0.6)).toFixed(3) + ')';
          drawChevron(d, Math.min(9, w * 0.32));
        }
        ctx.restore();
      });
      // 蓄能球 + 旋转符环
      var R = 10 + k * 26;
      softGlow(e.x, e.y, R * 2.2, col, 0.85);
      softGlow(e.x, e.y, R, '#ffffff', 0.9);
      ctx.strokeStyle = fadeA(col, 0.8);
      ctx.lineWidth = 2;
      for (var r = 0; r < 3; r++) {
        var a0 = tGlobal * (3 + r) * (r % 2 ? -1 : 1);
        ctx.beginPath(); ctx.arc(e.x, e.y, R * (1.3 + r * 0.35), a0, a0 + 1.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(e.x, e.y, R * (1.3 + r * 0.35), a0 + Math.PI, a0 + Math.PI + 1.6); ctx.stroke();
      }
      // 屏幕上沿的警告条
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.6 + 0.4 * blink;
      ctx.fillStyle = 'rgba(255,40,70,.85)';
      ctx.font = '800 13px "PingFang SC", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⚠ 光束即将发射 · 躲到红线外', W / 2, hudTop + 18);
      ctx.restore();
      return;
    }
    // 发射：外晕 → 主体 → 白热芯 → 能量丝 → 流动光斑，开头 0.12 秒由细变粗、结尾收束
    var u = z.st === 'fire' ? z.t : LZ_FIRE + z.t;
    var open = clamp(u / 0.12, 0, 1), close = z.st === 'end' ? clamp(1 - z.t / 0.35, 0, 1) : 1;
    var wobble = 1 + Math.sin(tGlobal * 60) * 0.06;
    z.angs.forEach(function (a, i) {
      var w = z.w * (0.25 + 0.75 * open) * close * wobble;
      if (w < 0.5) return;
      ctx.save();
      ctx.translate(e.x, e.y); ctx.rotate(a);
      var g = ctx.createLinearGradient(0, -w * 1.3, 0, w * 1.3);
      g.addColorStop(0, 'rgba(255,40,80,0)');
      g.addColorStop(0.25, 'rgba(255,60,90,.35)');
      g.addColorStop(0.5, fadeA(col, 0.6));
      g.addColorStop(0.75, 'rgba(255,60,90,.35)');
      g.addColorStop(1, 'rgba(255,40,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, -w * 1.3, L, w * 2.6);
      var g2 = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
      g2.addColorStop(0, fadeA(col, 0.2));
      g2.addColorStop(0.3, fadeA(col, 0.95));
      g2.addColorStop(0.5, '#ffffff');
      g2.addColorStop(0.7, fadeA(col, 0.95));
      g2.addColorStop(1, fadeA(col, 0.2));
      ctx.fillStyle = g2;
      ctx.fillRect(0, -w / 2, L, w);
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.fillRect(0, -w * 0.14, L, w * 0.28);
      ctx.strokeStyle = 'rgba(255,250,220,.75)';
      ctx.lineWidth = 1.3;
      for (var s = 0; s < 2; s++) {
        ctx.beginPath();
        for (var d = 0; d <= L; d += 10) {
          var o = Math.sin(d * 0.045 - tGlobal * 26 + s * Math.PI + i) * w * 0.38;
          if (d) ctx.lineTo(d, o); else ctx.moveTo(d, o);
        }
        ctx.stroke();
      }
      for (var q = 0; q < 6; q++) {
        var dd = (tGlobal * 900 + q * L / 6) % L;
        softGlow(dd, 0, w * 0.7, '#ffffff', 0.7);
      }
      ctx.restore();
    });
    var fr = z.w * (1.6 + Math.sin(tGlobal * 40) * 0.2) * close;
    softGlow(e.x, e.y, fr * 1.8, col, 0.95);
    softGlow(e.x, e.y, fr * 0.8, '#ffffff', 1);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(tGlobal * 5);
    ctx.globalAlpha = close;
    star4(fr * 1.5, 'rgba(255,255,255,.9)');
    ctx.rotate(Math.PI / 4);
    star4(fr, fadeA(col, 0.9));
    ctx.restore();
    ctx.restore();
  }

  function drawEnemy(e) {
    var size = Math.round(e.r * 2.4 / 16) * 16 || 32;
    var bob = state.frozen ? 0 : Math.sin(e.t * 5 + e._id) * 1.5;
    var y = e.y + bob;
    if (e.tele && e.tele.length) drawBossTele(e);
    if (e.lz) drawBossLaser(e);
    var va = e.vis == null ? 1 : e.vis;
    if (va <= 0.02) return;
    ctx.globalAlpha = va;
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + size * 0.5, size * 0.32, size * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    if (global.StageArt) {
      global.StageArt.draw(ctx, e.sprite, e.x, y, size, false);
      if (e.flash > 0) {
        ctx.globalAlpha = 0.8 * va;
        global.StageArt.draw(ctx, e.sprite, e.x, y, size, true);
      }
    }
    ctx.globalAlpha = 1;
    if (e.type === 'boss' && !e.landmark) {
      var c1 = (state.region && state.region.c1) || '#ffd36b', cw = size * 0.42, cy = y - size * 0.5;
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.moveTo(e.x - cw / 2, cy + 6);
      ctx.lineTo(e.x - cw / 2, cy - 6); ctx.lineTo(e.x - cw / 4, cy);
      ctx.lineTo(e.x, cy - 9); ctx.lineTo(e.x + cw / 4, cy);
      ctx.lineTo(e.x + cw / 2, cy - 6); ctx.lineTo(e.x + cw / 2, cy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.stroke();
    }
    if (e.slow > 0 || state.frozen) {
      // 冰封：六棱冰晶壳 + 切面高光 + 裂纹 + 顶部冰刺
      var hw = size * 0.56;
      ctx.save();
      var hex = [];
      for (var hi = 0; hi < 6; hi++) {
        var ha = -Math.PI / 2 + hi * Math.PI / 3;
        hex.push([e.x + Math.cos(ha) * hw, y + Math.sin(ha) * hw * 1.06]);
      }
      var ig = ctx.createLinearGradient(e.x - hw, y - hw, e.x + hw, y + hw);
      ig.addColorStop(0, 'rgba(236,252,255,.5)');
      ig.addColorStop(0.42, 'rgba(150,220,255,.18)');
      ig.addColorStop(1, 'rgba(196,240,255,.42)');
      ctx.fillStyle = ig;
      ctx.beginPath();
      hex.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.closePath();
      ctx.fill();
      // 棱面
      ctx.strokeStyle = 'rgba(232,250,255,.6)';
      ctx.lineWidth = 0.85;
      for (var fi = 1; fi < 6; fi += 2) {
        ctx.beginPath(); ctx.moveTo(hex[fi][0], hex[fi][1]); ctx.lineTo(e.x, y); ctx.stroke();
      }
      // 外缘霜光
      ctx.strokeStyle = 'rgba(238,252,255,.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#bfefff';
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // 裂纹
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 0.9;
      var cr = size * 0.5;
      for (var ci = 0; ci < 3; ci++) {
        var ca = ci * 2.1 + e._id;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(ca) * cr * 0.18, y + Math.sin(ca) * cr * 0.18);
        ctx.lineTo(e.x + Math.cos(ca) * cr * 0.72, y + Math.sin(ca) * cr * 0.72);
        ctx.lineTo(e.x + Math.cos(ca + 0.5) * cr * 0.95, y + Math.sin(ca + 0.5) * cr * 0.95);
        ctx.stroke();
      }
      // 顶部冰刺
      ctx.fillStyle = 'rgba(244,254,255,.92)';
      [-0.3, 0, 0.3].forEach(function (ox, oi) {
        var bx = e.x + ox * size * 0.5, bh = size * (oi === 1 ? 0.3 : 0.2);
        ctx.beginPath();
        ctx.moveTo(bx - size * 0.08, y - hw * 0.82);
        ctx.lineTo(bx, y - hw * 0.82 - bh);
        ctx.lineTo(bx + size * 0.08, y - hw * 0.82);
        ctx.closePath(); ctx.fill();
      });
      ctx.restore();
    }
    if (e.aimT > 0) {
      // 开火预警：准星环 + 指向玩家的细线，给玩家躲避时间
      var pr = clamp(1 - e.aimT / 0.45, 0, 1);
      var pa = Math.atan2(state.player.y - y, state.player.x - e.x);
      ctx.save();
      ctx.globalAlpha = 0.55 + pr * 0.35;
      ctx.strokeStyle = 'rgba(255,120,140,.75)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(e.x, y); ctx.lineTo(e.x + Math.cos(pa) * 90, y + Math.sin(pa) * 90); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,160,170,.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(e.x, y, size * 0.36 * (1.5 - pr * 0.5), -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (e.type === 'elite') {
      var bw = size * 0.9;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(e.x - bw / 2, y - size / 2 - 10, bw, 4);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(e.x - bw / 2, y - size / 2 - 10, bw * clamp(e.hp / e.maxHp, 0, 1), 4);
      ctx.fillStyle = '#fff3dc';
      ctx.font = '600 10px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(e.name, e.x, y - size / 2 - 13);
    }
  }

  var ESHOT_COL = { orb: '#ff4f6d', rice: '#ff9a3c', big: '#ff4fd8' };
  function drawEnemyShots() {
    // 拖尾：锥形渐变带（比原来的椭圆块自然）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    state.eshots.forEach(function (s) {
      ribbon(s, ESHOT_COL[s.type], s.type === 'big' ? 5 : s.type === 'rice' ? 3.4 : 4);
    });
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    state.eshots.forEach(function (s) {
      var c = ESHOT_COL[s.type];
      var g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.6);
      g.addColorStop(0, hexA(c, 0.42));
      g.addColorStop(0.5, hexA(c, 0.14));
      g.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.6, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
    state.eshots.forEach(function (s) {
      var c = ESHOT_COL[s.type];
      if (s.type === 'rice') {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Math.atan2(s.vy, s.vx));
        var rg = ctx.createRadialGradient(-s.r * 0.3, -s.r * 0.4, 0, 0, 0, s.r * 2.1);
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(0.45, tintHex(c, 0.35));
        rg.addColorStop(1, hexA(c, 0.06));
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.ellipse(0, 0, s.r * 2.1, s.r * 1.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(s.x, s.y);
        orbCore(s.r * 1.05, c, 0.4);
        ctx.restore();
        // 旋转外环
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(tGlobal * 4 + s.x * 0.03);
        ctx.strokeStyle = hexA(c, 0.55);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, s.r * 1.7, 0.4, 2.1); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, s.r * 1.7, 3.5, 5.2); ctx.stroke();
        ctx.restore();
      }
    });
  }

  /* 投射物：每种武器一种外形；弹药等级 1→6 逐级加尾迹 / 光晕 / 造型 / 鎏金 / 彩虹 */
  // 锥形拖尾：用历史轨迹点生成一条"由细到粗、由透明到实"的带状拖尾
  // 只算一次几何：每个点的中心 + 单位法线；三层不同宽度直接复用，不再重复遍历轨迹
  function ribbonGeom(p, n) {
    var out = new Array(n);
    for (var i = 0; i < n; i++) {
      var x = p[i * 2], y = p[i * 2 + 1];
      var pi = i > 0 ? i - 1 : i;
      var dx = x - p[pi * 2], dy = y - p[pi * 2 + 1];
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.001) { dx = 0; dy = 1; d = 1; }
      out[i] = [x, y, -dy / d, dx / d];
    }
    return out;
  }
  function ribbonFill(pts, w) {
    var n = pts.length, i, q, u, hw;
    ctx.beginPath();
    for (i = 0; i < n; i++) {
      q = pts[i];
      u = n > 1 ? i / (n - 1) : 1;
      hw = w * (0.04 + 0.96 * u * u * u) * 0.5;
      if (i) ctx.lineTo(q[0] + q[2] * hw, q[1] + q[3] * hw);
      else ctx.moveTo(q[0] + q[2] * hw, q[1] + q[3] * hw);
    }
    for (i = n - 1; i >= 0; i--) {
      q = pts[i];
      u = n > 1 ? i / (n - 1) : 1;
      hw = w * (0.04 + 0.96 * u * u * u) * 0.5;
      ctx.lineTo(q[0] - q[2] * hw, q[1] - q[3] * hw);
    }
    ctx.closePath();
  }
  function fadeA(col, a) {
    if (!col) return 'rgba(255,255,255,' + a + ')';
    if (col.charAt(0) === '#') return hexA(col, a);
    if (col.indexOf('hsl(') === 0) return 'hsla(' + col.slice(4, -1) + ',' + a + ')';
    return col;
  }
  function ribbon(b, col, w) {
    var p = b._tr;
    if (!p || p.length < 4) return;
    if (p[p.length - 2] !== b.x || p[p.length - 1] !== b.y) p.push(b.x, b.y);
    var n = p.length / 2;
    var pts = ribbonGeom(p, n);
    var hx = p[(n - 1) * 2], hy = p[(n - 1) * 2 + 1], tx = p[0], ty = p[1];
    var g1 = ctx.createLinearGradient(tx, ty, hx, hy);
    g1.addColorStop(0, fadeA(col, 0));
    g1.addColorStop(0.35, fadeA(col, 0.12));
    g1.addColorStop(0.75, fadeA(col, 0.42));
    g1.addColorStop(1, fadeA(col, 0.7));
    ribbonFill(pts, w * 2.6);
    ctx.fillStyle = g1;
    ctx.fill();

    var g2 = ctx.createLinearGradient(tx, ty, hx, hy);
    g2.addColorStop(0, fadeA(col, 0));
    g2.addColorStop(0.4, fadeA(col, 0.45));
    g2.addColorStop(1, 'rgba(255,255,255,.95)');
    ribbonFill(pts, w);
    ctx.fillStyle = g2;
    ctx.fill();

    var g3 = ctx.createLinearGradient(tx, ty, hx, hy);
    g3.addColorStop(0, 'rgba(255,255,255,0)');
    g3.addColorStop(0.6, 'rgba(255,255,255,.45)');
    g3.addColorStop(1, 'rgba(255,255,255,1)');
    ribbonFill(pts, w * 0.34);
    ctx.fillStyle = g3;
    ctx.fill();
  }
  // 潮汐拖尾：沿轨迹留下一串由大到小、由深到浅的水泡（不用带状拖尾，摆动轨迹折返时会叠出锯齿块）
  function bubbleTrail(b, col, sz, v) {
    var p = b._tr;
    if (!p || p.length < 6) return;
    var n = p.length / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (var i = n - 2; i >= 0; i -= 2) {
      var u = i / (n - 1), r = (1.2 + u * (2.2 + v * 0.35)) * sz;
      ctx.globalAlpha = 0.12 + u * 0.4;
      ctx.fillStyle = u > 0.6 ? col : '#1f6fb8';
      ctx.beginPath(); ctx.arc(p[i * 2], p[i * 2 + 1], r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  /* 柔光贴图缓存：光晕 / 柔光都是"圆形径向衰减 + 强度线性缩放"的形状，
     预先烘焙成一张贴图后只做 drawImage + globalAlpha，比逐帧新建径向渐变便宜很多。
     形状（各 stop 的 alpha 比例）与强度无关，所以强度可以用 globalAlpha 精确还原；
     动态彩虹色（hsl 每帧变化）不进缓存，仍走原来的渐变路径。 */
  var glowTex = {};
  function glowSprite(key, paint) {
    var cv = glowTex[key];
    if (cv) return cv;
    var N = 96;
    cv = document.createElement('canvas');
    cv.width = N; cv.height = N;
    var g = cv.getContext('2d');
    paint(g, N);
    glowTex[key] = cv;
    return cv;
  }
  function halo(r, col, a) {
    var old = ctx.globalAlpha, k = Math.min(1, a * 1.5);
    if (col && col.indexOf('hsl(') !== 0) {
      var sp = glowSprite('h|' + col, function (g, N) {
        var ng = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
        ng.addColorStop(0, hexA(col, 1));
        ng.addColorStop(0.42, hexA(col, 0.55 / 1.5));
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = ng;
        g.fillRect(0, 0, N, N);
      });
      ctx.globalAlpha = old * k;
      ctx.drawImage(sp, -r, -r, r * 2, r * 2);
      ctx.globalAlpha = old;
      return;
    }
    var g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g2.addColorStop(0, hexA(col, k));
    g2.addColorStop(0.42, hexA(col, a * 0.55));
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  }
  // 柔光核心：中心白、外圈本色、最外透明，用来替代生硬的实心圆
  function orbCore(r, col, hot) {
    var g = ctx.createRadialGradient(-r * 0.22, -r * 0.3, r * 0.05, 0, 0, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(hot || 0.42, tintHex(col, 0.32));
    g.addColorStop(0.72, col);
    g.addColorStop(1, tintHex(col, -0.34));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // 高光点 + 内环，做出玻璃质感
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.beginPath(); ctx.ellipse(-r * 0.26, -r * 0.34, r * 0.24, r * 0.17, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hexA('#ffffff', 0.34);
    ctx.lineWidth = Math.max(0.5, r * 0.14);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.76, 0.5, 2.6); ctx.stroke();
  }
  function star4(r, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.22, -r * 0.22); ctx.lineTo(r, 0); ctx.lineTo(r * 0.22, r * 0.22);
    ctx.lineTo(0, r); ctx.lineTo(-r * 0.22, r * 0.22); ctx.lineTo(-r, 0); ctx.lineTo(-r * 0.22, -r * 0.22);
    ctx.closePath(); ctx.fill();
  }

  function drawPellet(v, col, b) {
    // 火弹：泪滴形火苗 —— 外焰本色渐隐、内焰亮白，等级越高越长越亮
    var r = 2.1 + v * 0.3, L = 5.5 + v * 1.6;
    var fg = ctx.createLinearGradient(0, -L, 0, r * 1.8);
    fg.addColorStop(0, 'rgba(255,255,255,.98)');
    fg.addColorStop(0.3, fadeA(col, 0.95));
    fg.addColorStop(0.75, fadeA(col, 0.55));
    fg.addColorStop(1, fadeA(col, 0));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(0, -L);
    ctx.bezierCurveTo(r * 1.5, -L * 0.45, r * 1.25, r * 0.6, 0, r * 1.8);
    ctx.bezierCurveTo(-r * 1.25, r * 0.6, -r * 1.5, -L * 0.45, 0, -L);
    ctx.fill();
    var cg = ctx.createRadialGradient(0, -L * 0.2, 0, 0, -L * 0.2, r * 1.1);
    cg.addColorStop(0, 'rgba(255,255,255,1)');
    cg.addColorStop(0.6, 'rgba(255,250,230,.85)');
    cg.addColorStop(1, 'rgba(255,250,230,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(0, -L * 0.2, r * 0.75, r * 1.3, 0, 0, Math.PI * 2); ctx.fill();
    if (v >= 5) {
      var a = tGlobal * 14 + (b.hue || 0);
      ctx.fillStyle = 'rgba(255,246,200,.9)';
      for (var s = 0; s < 2; s++) {
        var aa = a + s * Math.PI;
        ctx.beginPath(); ctx.arc(Math.cos(aa) * (r + 3), Math.sin(aa) * (r + 3) - L * 0.2, 0.9, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (v >= 6) { ctx.save(); ctx.translate(0, -L * 0.2); ctx.globalAlpha = 0.7; star4(6.5, '#fff'); ctx.restore(); }
  }

  // 小六角雪花（冰弹尾部与碎晶用）
  function snowflake(r, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = '#f2fbff';
    ctx.lineWidth = Math.max(0.6, r * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var k = 0; k < 6; k++) {
      var a = k * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a);
      ctx.moveTo(0, 0); ctx.lineTo(ca * r, sa * r);
      var mx = ca * r * 0.55, my = sa * r * 0.55, br = r * 0.32;
      ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a + 0.8) * br, my + Math.sin(a + 0.8) * br);
      ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a - 0.8) * br, my + Math.sin(a - 0.8) * br);
    }
    ctx.stroke();
    ctx.restore();
  }
  function drawShard(v, col, b) {
    // 冰棱：六棱柱式切面 —— 左侧背光深蓝、右侧受光浅蓝、中脊白亮；内部有冰裂纹，外缘结霜，尾部飘雪花
    var L = 8 + v * 2.4, Wd = 2.8 + v * 0.45, seed = b.hue || 0;
    var tip = { x: 0, y: -L }, rT = { x: Wd, y: -L * 0.3 }, rB = { x: Wd * 0.7, y: L * 0.38 }, bot = { x: 0, y: L * 0.95 };
    var lT = { x: -Wd, y: -L * 0.3 }, lB = { x: -Wd * 0.7, y: L * 0.38 }, mid = { x: Wd * 0.12, y: -L * 0.1 };
    function poly(pts, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath(); ctx.fill();
    }
    // 冷雾外晕
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var mg = ctx.createRadialGradient(0, 0, 0, 0, 0, L * 1.3);
    mg.addColorStop(0, 'rgba(150,215,255,.32)');
    mg.addColorStop(1, 'rgba(120,190,255,0)');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.ellipse(0, 0, Wd * 2.6, L * 1.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 四个切面：明暗不同，构成立体棱柱
    var gL = ctx.createLinearGradient(-Wd, 0, 0, 0);
    gL.addColorStop(0, 'rgba(40,110,190,.9)'); gL.addColorStop(1, 'rgba(110,185,240,.92)');
    poly([tip, lT, lB, bot, mid], gL);
    var gR = ctx.createLinearGradient(0, 0, Wd, 0);
    gR.addColorStop(0, 'rgba(205,240,255,.95)'); gR.addColorStop(1, 'rgba(150,215,250,.9)');
    poly([tip, mid, bot, rB, rT], gR);
    poly([tip, rT, mid], 'rgba(255,255,255,.9)');
    poly([lB, bot, { x: -Wd * 0.2, y: L * 0.5 }], 'rgba(25,80,160,.55)');
    // 冰裂纹（内部细线，按种子固定形状）
    ctx.strokeStyle = 'rgba(235,250,255,.7)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    var cy = -L * 0.05 + Math.sin(seed) * L * 0.15;
    ctx.moveTo(-Wd * 0.55, cy); ctx.lineTo(-Wd * 0.05, cy + L * 0.12); ctx.lineTo(Wd * 0.4, cy + L * 0.02);
    ctx.moveTo(-Wd * 0.05, cy + L * 0.12); ctx.lineTo(-Wd * 0.2, cy + L * 0.38);
    ctx.stroke();
    // 棱线：中脊亮白、外轮廓细霜边
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(mid.x, mid.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,245,255,.6)';
    ctx.lineWidth = 0.7;
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(rT.x, rT.y); ctx.lineTo(rB.x, rB.y); ctx.lineTo(bot.x, bot.y);
    ctx.lineTo(lB.x, lB.y); ctx.lineTo(lT.x, lT.y); ctx.closePath(); ctx.stroke();
    // 尖端星芒
    ctx.save();
    ctx.translate(0, -L);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(tGlobal * 14 + seed);
    star4(2.5 + v * 0.6, '#ffffff');
    ctx.restore();
    // 外缘霜晶（等级越高越多，绕弹体缓慢旋转闪烁）
    if (v >= 2) {
      var n = Math.min(6, v);
      for (var i = 0; i < n; i++) {
        var a = i * 2.4 + seed + tGlobal * 2;
        ctx.save();
        ctx.translate(Math.cos(a) * (Wd + 3), Math.sin(a) * L * 0.55);
        ctx.rotate(a);
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(tGlobal * 10 + i * 1.7);
        if (v >= 4 && i % 2 === 0) snowflake(2.2 + v * 0.25, 0.9);
        else { ctx.fillStyle = '#eaf8ff'; ctx.beginPath(); ctx.moveTo(0, -1.8); ctx.lineTo(1.1, 0); ctx.lineTo(0, 1.8); ctx.lineTo(-1.1, 0); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
    }
    // 尾部雪花
    if (v >= 3) {
      ctx.save();
      ctx.translate(0, L * 1.25);
      ctx.rotate(tGlobal * 3 + seed);
      snowflake(3 + v * 0.5, 0.75);
      ctx.restore();
    }
    if (v >= 6) { ctx.save(); ctx.globalAlpha = 0.55; ctx.globalCompositeOperation = 'lighter'; star4(10, '#dff6ff'); ctx.restore(); }
  }

  function drawMissile(v, col, b) {
    // 追踪弹：细长梭形弹体 + 尾焰 + 侧鳍 + 掠光
    var fl = 7 + v * 1.9 + Math.sin(tGlobal * 40 + b.hue) * (2.4 + v * 0.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var fg = ctx.createLinearGradient(0, 5, 0, 5 + fl * 1.9);
    fg.addColorStop(0, 'rgba(255,255,255,.95)');
    fg.addColorStop(0.22, hexA(col, 0.85));
    fg.addColorStop(0.6, hexA(col, 0.3));
    fg.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-2.6, 5);
    ctx.quadraticCurveTo(0, 5 + fl * 2.1, 2.6, 5);
    ctx.quadraticCurveTo(0, 5 + fl * 0.45, -2.6, 5);
    ctx.closePath(); ctx.fill();
    // 焰芯
    ctx.fillStyle = 'rgba(255,252,240,.95)';
    ctx.beginPath();
    ctx.moveTo(-1.1, 5); ctx.quadraticCurveTo(0, 5 + fl * 0.9, 1.1, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // 侧鳍
    ctx.fillStyle = hexA(col, 0.9);
    ctx.beginPath();
    ctx.moveTo(-2.2, 0.4); ctx.lineTo(-5.6 - v * 0.3, 5.6); ctx.lineTo(-2.1, 4.6); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2.2, 0.4); ctx.lineTo(5.6 + v * 0.3, 5.6); ctx.lineTo(2.1, 4.6); ctx.closePath(); ctx.fill();

    // 弹体：梭形
    var bg = ctx.createLinearGradient(-3, 0, 3, 0);
    bg.addColorStop(0, '#6a5e52');
    bg.addColorStop(0.34, '#efe4cd');
    bg.addColorStop(0.52, '#ffffff');
    bg.addColorStop(0.78, '#cfc2ab');
    bg.addColorStop(1, '#6a5e52');
    ctx.fillStyle = bg;
    var nose = 12 + v * 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -nose);
    ctx.quadraticCurveTo(3.1, -6, 2.5, 4.6);
    ctx.quadraticCurveTo(0, 6.6, -2.5, 4.6);
    ctx.quadraticCurveTo(-3.1, -6, 0, -nose);
    ctx.closePath();
    ctx.fill();
    // 弹头高光 + 描边
    ctx.strokeStyle = hexA(col, 0.55);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.ellipse(-0.85, -nose * 0.42, 0.55, nose * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    // 弹头灯
    ctx.fillStyle = hexA(col, 0.95);
    ctx.beginPath(); ctx.arc(0, -nose * 0.72, 1.3 + v * 0.12, 0, Math.PI * 2); ctx.fill();
    if (v >= 5) { ctx.save(); ctx.translate(0, -nose * 0.72); star4(3.6 + v * 0.4, '#fff'); ctx.restore(); }
  }

  function drawBolt(v, col) {
    // 光针：两头收尖的菱形光矛，中线白芯，前端一点星芒
    var L = 9 + v * 2.4, wd = 1.5 + v * 0.3;
    var bg2 = ctx.createLinearGradient(0, -L, 0, L * 0.9);
    bg2.addColorStop(0, 'rgba(255,255,255,1)');
    bg2.addColorStop(0.3, fadeA(col, 0.95));
    bg2.addColorStop(1, fadeA(col, 0));
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.moveTo(0, -L);
    ctx.quadraticCurveTo(wd, -L * 0.35, wd * 0.7, L * 0.2);
    ctx.lineTo(0, L * 0.9);
    ctx.lineTo(-wd * 0.7, L * 0.2);
    ctx.quadraticCurveTo(-wd, -L * 0.35, 0, -L);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = Math.max(0.6, wd * 0.45);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -L * 0.9); ctx.lineTo(0, L * 0.25); ctx.stroke();
    if (v >= 4) { ctx.save(); ctx.translate(0, -L * 0.82); ctx.globalAlpha = 0.85; star4(3 + v * 0.45, '#fff'); ctx.restore(); }
  }

  function drawPea(v, col) {
    // 能量核：六棱光晶 + 柔光核心，高等级外加旋转晶环
    var r = 2.6 + v * 0.32;
    ctx.save();
    ctx.rotate(tGlobal * 2.4);
    hexPath(0, 0, r * 1.25, 1);
    var hg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.3);
    hg.addColorStop(0, 'rgba(255,255,255,1)');
    hg.addColorStop(0.45, fadeA(col, 0.95));
    hg.addColorStop(1, fadeA(col, 0.35));
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.restore();
    if (v >= 4) {
      ctx.save();
      ctx.rotate(-tGlobal * 4);
      ctx.strokeStyle = fadeA(col, 0.8);
      ctx.lineWidth = 0.9;
      ctx.lineCap = 'round';
      for (var k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.arc(0, 0, r + 3 + v * 0.3, k * 2.09, k * 2.09 + 1.1); ctx.stroke();
      }
      ctx.restore();
    }
    if (v >= 6) { ctx.save(); ctx.globalAlpha = 0.75; ctx.rotate(tGlobal * 3); star4(4.6 + v * 0.4, '#fff6cf'); ctx.restore(); }
  }

  function drawTide(v, col, b) {
    // 水弹：深海蓝底 → 本色青 → 顶部一小块白色高光，像一颗有体积的水珠，不再整颗发白
    var r = 3.4 + v * 0.42;
    var wg = ctx.createLinearGradient(0, -r * 2, 0, r * 1.6);
    wg.addColorStop(0, fadeA(col, 0.95));
    wg.addColorStop(0.55, '#1f8fd0');
    wg.addColorStop(1, 'rgba(14,60,130,.85)');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(0, -r * (2.1 + v * 0.1));
    ctx.bezierCurveTo(r * 1.25, -r * 0.6, r * 1.2, r * 1.5, 0, r * 1.5);
    ctx.bezierCurveTo(-r * 1.2, r * 1.5, -r * 1.25, -r * 0.6, 0, -r * (2.1 + v * 0.1));
    ctx.fill();
    ctx.strokeStyle = fadeA(col, 0.7);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // 内部反光弧 + 高光点
    ctx.strokeStyle = 'rgba(200,245,255,.55)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.8, 0.3, 1.5); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.5, r * 0.22, r * 0.36, -0.35, 0, Math.PI * 2); ctx.fill();
    if (v >= 4) {
      // 涟漪：一圈青色细环
      var ph = ((b.ph || 0) * 0.35) % 1;
      ctx.globalAlpha = 0.5 * (1 - ph);
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.ellipse(0, 0, r * (1.2 + ph * 1.3), r * (1.5 + ph * 1.7), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /* 飞刃：金属回旋镖轮 —— 钩状锯齿外缘 + 拉丝钢面（明暗分带）+ 刻槽内环 + 发光符文 + 轴心宝石；
     高光固定在左上方不随刃旋转，转起来才有金属反光感；lv6 起齿数增加并带外圈能量环 */
  function drawBlade(v, col, b) {
    var R = b && b.r0 ? b.r * 0.95 : 9.5 + v * 0.9, sp = b && b.spin != null ? b.spin : 0;
    var evo = b && b.blv >= 6, teeth = evo ? 8 : 6, k, a0, a1;
    ctx.save();
    // 旋转残影：一圈淡色动感模糊
    ctx.globalCompositeOperation = 'lighter';
    var mb = ctx.createRadialGradient(0, 0, R * 0.55, 0, 0, R * 1.12);
    mb.addColorStop(0, fadeA(col, 0));
    mb.addColorStop(0.75, fadeA(col, 0.22));
    mb.addColorStop(1, fadeA(col, 0));
    ctx.fillStyle = mb;
    ctx.beginPath(); ctx.arc(0, 0, R * 1.12, 0, Math.PI * 2); ctx.fill();
    if (evo) {
      ctx.strokeStyle = fadeA(col, 0.55);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([R * 0.5, R * 0.35]);
      ctx.lineDashOffset = -sp * R;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.18, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.rotate(sp);
    // 刃身：钩状锯齿外缘，中间镂空
    ctx.beginPath();
    for (k = 0; k < teeth; k++) {
      a0 = k * Math.PI * 2 / teeth; a1 = a0 + Math.PI * 2 / teeth;
      var vx = Math.cos(a0) * R * 0.66, vy = Math.sin(a0) * R * 0.66;
      var tx = Math.cos(a0 + 0.42 * (Math.PI * 2 / teeth)) * R, ty = Math.sin(a0 + 0.42 * (Math.PI * 2 / teeth)) * R;
      if (k === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
      // 刃口：外凸弧线冲到齿尖，再沿内凹弧线收回下一个齿根
      ctx.quadraticCurveTo(Math.cos(a0 + 0.05) * R * 1.02, Math.sin(a0 + 0.05) * R * 1.02, tx, ty);
      ctx.quadraticCurveTo(Math.cos(a1 - 0.35) * R * 0.72, Math.sin(a1 - 0.35) * R * 0.72, Math.cos(a1) * R * 0.66, Math.sin(a1) * R * 0.66);
    }
    ctx.closePath();
    ctx.moveTo(R * 0.24, 0);
    ctx.arc(0, 0, R * 0.24, 0, Math.PI * 2, true);
    var steel = ctx.createLinearGradient(-R, -R, R, R);
    steel.addColorStop(0, '#f6f9fd');
    steel.addColorStop(0.28, '#b9c4d4');
    steel.addColorStop(0.45, '#5d6879');
    steel.addColorStop(0.6, '#d9e1ec');
    steel.addColorStop(0.8, '#7e8a9c');
    steel.addColorStop(1, '#3b4352');
    ctx.fillStyle = steel;
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(20,24,34,.85)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // 刃口淬火色：外缘一圈武器色细光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = fadeA(col, 0.85);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (k = 0; k < teeth; k++) {
      a0 = k * Math.PI * 2 / teeth;
      var t2x = Math.cos(a0 + 0.42 * (Math.PI * 2 / teeth)) * R, t2y = Math.sin(a0 + 0.42 * (Math.PI * 2 / teeth)) * R;
      ctx.moveTo(Math.cos(a0) * R * 0.7, Math.sin(a0) * R * 0.7);
      ctx.quadraticCurveTo(Math.cos(a0 + 0.05) * R * 1.02, Math.sin(a0 + 0.05) * R * 1.02, t2x, t2y);
    }
    ctx.stroke();
    ctx.restore();
    // 刻槽内环 + 符文点
    ctx.strokeStyle = 'rgba(30,36,48,.7)';
    ctx.lineWidth = Math.max(0.8, R * 0.06);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.48, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.53, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = col;
    for (k = 0; k < teeth / 2; k++) {
      var ra = k * Math.PI * 4 / teeth + 0.3, rx = Math.cos(ra) * R * 0.48, ry = Math.sin(ra) * R * 0.48, rs = Math.max(1, R * 0.07);
      ctx.beginPath(); ctx.moveTo(rx, ry - rs); ctx.lineTo(rx + rs * 0.7, ry); ctx.lineTo(rx, ry + rs); ctx.lineTo(rx - rs * 0.7, ry); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // 轴心宝石
    var hub = ctx.createRadialGradient(-R * 0.06, -R * 0.06, 0, 0, 0, R * 0.2);
    hub.addColorStop(0, '#ffffff');
    hub.addColorStop(0.45, col);
    hub.addColorStop(1, tintHex(col, -0.5));
    ctx.fillStyle = hub;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 固定方向的镜面高光（不随旋转）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = Math.max(1, R * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, R * 0.62, -2.5, -1.6); ctx.stroke();
    ctx.restore();
  }

  var SHOT_W = { pellet: [1.6, 0.45], shard: [1.5, 0.4], missile: [2.6, 0.5], bolt: [2.4, 0.5], tide: [3, 0.5], blade: [2.2, 0.35], pea: [1.5, 0.36] };
  var GLOW_R = { pellet: [6, 1.2], shard: [5, 1], missile: [6, 1], bolt: [5.5, 1], tide: [7, 1.1], blade: [5, 0.5], pea: [6, 1.1] };
  function drawShotBody(b, col, v) {
    if (b.type === 'pellet') drawPellet(v, col, b);
    else if (b.type === 'shard') drawShard(v, col, b);
    else if (b.type === 'missile') drawMissile(v, col, b);
    else if (b.type === 'bolt') drawBolt(v, col);
    else if (b.type === 'tide') drawTide(v, col, b);
    else if (b.type === 'blade') drawBlade(v, col, b);
    else drawPea(v, col);
  }
  // 两遍绘制：先用叠加模式画拖尾与柔光，再用正常模式画弹体，弹体颜色不会被叠成一片白
  function drawShotList(list, colOf) {
    var i, b, col, v;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < list.length; i++) {
      b = list[i];
      if (b.type === 'word') continue;
      col = colOf(b); v = b.vt || 1;
      var th = TIER_HIT[b.rank || 1] || TIER_HIT[1];
      var sw = SHOT_W[b.type] || SHOT_W.pea, gr = GLOW_R[b.type] || GLOW_R.pea;
      if (b.type === 'tide') bubbleTrail(b, col, th.size, v);
      else ribbon(b, col, (sw[0] + v * sw[1]) * th.size);
      ctx.save();
      ctx.translate(b.x, b.y);
      halo((gr[0] + v * gr[1]) * th.size * th.glow * (b.big ? 1.5 : 1) * (b.returned ? 1.3 : 1), b.returned ? '#fff2c4' : col, (0.24 + v * 0.025 + th.glow * 0.04) * (b.type === 'tide' ? 0.45 : 1));
      ctx.restore();
    }
    ctx.restore();
    for (i = 0; i < list.length; i++) {
      b = list[i];
      if (b.type === 'word') continue;
      var sz = (TIER_HIT[b.rank || 1] || TIER_HIT[1]).size;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
      if (sz !== 1) ctx.scale(sz, sz);
      drawShotBody(b, colOf(b), b.vt || 1);
      ctx.restore();
    }
  }
  function drawShots() {
    drawShotList(state.shots, shotColor);
    // 觉醒 / 蜂群的字母弹：带尾迹的字母
    state.shots.forEach(function (b, i) {
      if (b.type !== 'word') return;
      var col = state.card.rank >= 5 ? rankColor(i) : state.card.ink;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ribbon(b, col, 5 + (b.vt || 1) * 0.6);
      ctx.translate(b.x, b.y);
      halo(12, col, 0.35);
      ctx.restore();
      drawLetterAt(b.letter, b.x, b.y, 13, '#fff8e6', 'rgba(40,16,6,.7)', 0);
    });
  }

  // 中心白、外圈本色、边缘透明的柔光圆（预烘焙贴图 + globalAlpha，形状与强度无关）
  function softGlow(x, y, r, col, a) {
    if (r <= 0) return;
    var old = ctx.globalAlpha;
    if (col && col.indexOf('hsl(') !== 0) {
      var sp = glowSprite('s|' + col, function (g, N) {
        var ng = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
        ng.addColorStop(0, 'rgba(255,255,255,1)');
        ng.addColorStop(0.25, fadeA(col, 0.6));
        ng.addColorStop(1, fadeA(col, 0));
        g.fillStyle = ng;
        g.fillRect(0, 0, N, N);
      });
      ctx.globalAlpha = old * a;
      ctx.drawImage(sp, x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = old;
      return;
    }
    var g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, 'rgba(255,255,255,' + a + ')');
    g2.addColorStop(0.25, fadeA(col, a * 0.6));
    g2.addColorStop(1, fadeA(col, 0));
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // 光束外晕：垂直于光束的线性衰减带（替代 shadowBlur）。
  // 原来对一条贯穿全屏的线做 shadowBlur 20~28，等于每帧对整屏高度做一遍高斯模糊，
  // 在移动端 GPU 上是最贵的一笔；渐变带是同样的"中心亮、两侧透明"，但只填充一次。
  function beamBand(x, y, dx, dy, len, halfW, col, a) {
    var nx = -dy, ny = dx;
    // 发射口收成圆锥：从很窄逐渐张开到全宽，避免起点被平切成一条硬边
    var tp = Math.min(len * 0.3, halfW * 3.2), h0 = halfW * 0.22;
    ctx.beginPath();
    ctx.moveTo(x + nx * h0, y + ny * h0);
    ctx.quadraticCurveTo(x + dx * tp * 0.35 + nx * halfW * 0.9, y + dy * tp * 0.35 + ny * halfW * 0.9, x + dx * tp + nx * halfW, y + dy * tp + ny * halfW);
    ctx.lineTo(x + dx * len + nx * halfW, y + dy * len + ny * halfW);
    ctx.lineTo(x + dx * len - nx * halfW, y + dy * len - ny * halfW);
    ctx.lineTo(x + dx * tp - nx * halfW, y + dy * tp - ny * halfW);
    ctx.quadraticCurveTo(x + dx * tp * 0.35 - nx * halfW * 0.9, y + dy * tp * 0.35 - ny * halfW * 0.9, x - nx * h0, y - ny * h0);
    ctx.arc(x, y, h0, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
    ctx.closePath();
    var ax = x + nx * halfW, ay = y + ny * halfW, bx = x - nx * halfW, by = y - ny * halfW;
    var g = ctx.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, fadeA(col, 0));
    g.addColorStop(0.5, fadeA(col, a));
    g.addColorStop(1, fadeA(col, 0));
    ctx.fillStyle = g;
    ctx.fill();
  }
  // 激光配色：外层必须是饱和色，lighter 叠加下淡色会直接加成一片白
  function beamPal(v, i) {
    if (v >= 6) {
      var h = (i * 60 + tGlobal * 200) % 360;
      return { o: 'hsl(' + h.toFixed(0) + ',100%,52%)', m: 'hsl(' + ((h + 50) % 360).toFixed(0) + ',100%,64%)', c: '#fff6fb', s: 'hsl(' + ((h + 120) % 360).toFixed(0) + ',100%,70%)' };
    }
    if (v >= 5) return { o: '#8a2dff', m: '#ff3fa8', c: '#ffe7b0', s: '#ffd36b' };
    if (v >= 3) return { o: '#d81f8f', m: '#ff58d0', c: '#ffeefa', s: '#ffa8e6' };
    return { o: '#ff2a78', m: '#ff6fae', c: '#ffe2ee', s: '#ff9cc6' };
  }
  function drawBeamList(list, L) {
    if (!list.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    list.forEach(function (bm, i) {
      var v = bm.vt || 1, dx = Math.cos(bm.a), dy = Math.sin(bm.a), nx = -dy, ny = dx;
      var ex = bm.x + dx * L, ey = bm.y + dy * L, al = bm.al != null ? bm.al : 1;
      var P = beamPal(v, i);
      var w = bm.w * (1 + Math.sin(tGlobal * 50 + i * 1.7) * 0.1);
      function line(lw, ox) {
        ox = ox || 0;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(bm.x + nx * ox, bm.y + ny * ox);
        ctx.lineTo(ex + nx * ox, ey + ny * ox);
        ctx.stroke();
      }
      // 外晕
      ctx.globalAlpha = (0.42 + v * 0.04) * al;
      beamBand(bm.x, bm.y, dx, dy, L, w * 1.2 + Math.min(30, w * (2.4 + v * 0.45)) * 1.3, P.o, 0.9);
      // 光束本体
      ctx.strokeStyle = P.o;
      ctx.globalAlpha = 0.8 * al;
      line(w * 1.05);
      // 两侧导轨：做出"能量管"的边缘
      ctx.strokeStyle = P.m;
      ctx.globalAlpha = 0.75 * al;
      line(Math.max(0.8, w * 0.16), w * 0.62);
      line(Math.max(0.8, w * 0.16), -w * 0.62);
      // 流动能量段
      ctx.setLineDash([w * 3.2, w * 2.4]);
      ctx.lineDashOffset = -tGlobal * (520 + v * 60);
      ctx.globalAlpha = 0.7 * al;
      line(w * 0.5);
      ctx.setLineDash([]);
      // 细芯（只留一条细线，避免整束发白）
      ctx.strokeStyle = P.c;
      ctx.globalAlpha = 0.9 * al;
      line(Math.max(0.9, w * 0.2));
      // 双螺旋
      if (v >= 3) {
        var amp = w * (0.85 + v * 0.12), ph = tGlobal * 18;
        ctx.lineWidth = 1 + (v - 3) * 0.3;
        for (var s = 0; s < 2; s++) {
          ctx.strokeStyle = s ? P.s : P.m;
          ctx.globalAlpha = 0.6 * al;
          ctx.beginPath();
          for (var d = 0; d <= L; d += 8) {
            var o = Math.sin(d * 0.06 - ph + s * Math.PI) * amp;
            var px = bm.x + dx * d + nx * o, py = bm.y + dy * d + ny * o;
            if (d) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          }
          ctx.stroke();
        }
      }
      // 沿光束上行的能量环
      if (v >= 2) {
        var nR = 1 + v;
        ctx.strokeStyle = P.m;
        ctx.lineWidth = 1.1 + v * 0.15;
        for (var k = 0; k < nR; k++) {
          var dd = (tGlobal * (620 + v * 40) + k * L / nR) % L;
          ctx.globalAlpha = 0.75 * al * (1 - dd / L * 0.6);
          ctx.beginPath();
          ctx.ellipse(bm.x + dx * dd, bm.y + dy * dd, w * (1.2 + v * 0.12), w * 0.38, bm.a + Math.PI / 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // 两侧飘散的火花
      var nS = 4 + v * 3;
      for (var q = 0; q < nS; q++) {
        var sd = (q * 97.3 + tGlobal * (260 + (q % 3) * 90)) % L;
        var side = (q % 2 ? 1 : -1) * w * (1.1 + ((q * 0.618) % 1) * 1.6 + (sd / L) * 1.2);
        var fl = 0.5 + 0.5 * Math.sin(tGlobal * 22 + q * 2.3);
        ctx.globalAlpha = (0.35 + fl * 0.6) * al;
        ctx.fillStyle = q % 3 ? P.s : P.c;
        var sr = 0.8 + (q % 4) * 0.35 + (v >= 5 ? 0.4 : 0);
        ctx.fillRect(bm.x + dx * sd + nx * side - sr, bm.y + dy * sd + ny * side - sr, sr * 2, sr * 2);
      }
      // 发射口：光球 + 旋转双弧
      ctx.globalAlpha = al;
      softGlow(bm.x, bm.y, w * (2.1 + v * 0.25), P.o, 0.95);
      softGlow(bm.x, bm.y, w * 1.1, P.m, 0.9);
      ctx.save();
      ctx.translate(bm.x, bm.y);
      ctx.rotate(tGlobal * 6 + i);
      ctx.strokeStyle = P.s;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.85 * al;
      var mr = w * (1.5 + v * 0.15);
      ctx.beginPath(); ctx.arc(0, 0, mr, 0, 1.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, mr, Math.PI, Math.PI + 1.6); ctx.stroke();
      if (v >= 5) {
        ctx.rotate(-tGlobal * 10);
        star4(w * 2.2, P.c);
      }
      ctx.restore();
    });
    ctx.restore();
  }
  function drawBeams() { drawBeamList(state.beams, H + 40); }

  // 锥形折线带：整条一次填充成闭合多边形，节点处不会叠出亮珠，也没有逐段描边的硬接缝
  function taperPoly(pts, w0, w1) {
    var n = pts.length, Lp = [], Rp = [];
    for (var i = 0; i < n; i++) {
      var a = pts[i > 0 ? i - 1 : 0], b = pts[i < n - 1 ? i + 1 : n - 1];
      var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var u = n > 1 ? i / (n - 1) : 0, hw = (w0 + (w1 - w0) * u) * 0.5;
      Lp.push(pts[i].x - dy / d * hw, pts[i].y + dx / d * hw);
      Rp.push(pts[i].x + dy / d * hw, pts[i].y - dx / d * hw);
    }
    ctx.beginPath();
    ctx.moveTo(Lp[0], Lp[1]);
    for (var j = 2; j < Lp.length; j += 2) ctx.lineTo(Lp[j], Lp[j + 1]);
    for (var k = Rp.length - 2; k >= 0; k -= 2) ctx.lineTo(Rp[k], Rp[k + 1]);
    ctx.closePath();
  }
  // 用中点二次曲线连接折点：保留闪电走势，但转角圆滑、不出生硬尖角
  function strokePts(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length < 3) { ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.stroke(); return; }
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }
  // 闪电：四层叠加描边（宽淡外晕 / 中晕 / 本色 / 白芯）模拟柔光，不用 shadowBlur（太耗性能）
  function drawArcList(list) {
    if (!list.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    list.forEach(function (a) {
      var t = clamp(a.life / a.max, 0, 1), v = a.vt || 1;
      var col = a.col || vtColor('thunder', v, 0);
      if (a.src && !a.straight && (a._jt == null || tGlobal - a._jt > 0.08 || tGlobal < a._jt)) {
        a._jt = tGlobal;
        a.pts = jagged(a.src, a.amp || 10);
        if (a.br) a.br = forks(a.src, a.fv || v, a.rage);
      }
      var fade = 1 - (1 - t) * (1 - t);
      var w = a.w * (a.big ? 1.35 : 1);
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.08 * fade; ctx.lineWidth = w * 5; strokePts(a.pts);
      ctx.globalAlpha = 0.18 * fade; ctx.lineWidth = w * 2.6; strokePts(a.pts);
      ctx.globalAlpha = 0.7 * fade; ctx.lineWidth = w * 1.15; strokePts(a.pts);
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.95 * fade; ctx.lineWidth = Math.max(0.7, w * 0.42); strokePts(a.pts);
      if (a.br) {
        a.br.forEach(function (bp) {
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.14 * fade; ctx.lineWidth = w * 2; strokePts(bp);
          ctx.globalAlpha = 0.55 * fade; ctx.lineWidth = w * 0.6; strokePts(bp);
          ctx.strokeStyle = '#ffffff';
          ctx.globalAlpha = 0.6 * fade; ctx.lineWidth = Math.max(0.5, w * 0.22); strokePts(bp);
        });
      }
      var st = a.pts[0], end = a.pts[a.pts.length - 1];
      ctx.globalAlpha = fade;
      softGlow(end.x, end.y, (8 + v * 2) * (0.8 + (1 - t) * 0.5) * Math.max(1, a.w / 3), col, 0.7);
      if (!a.straight) softGlow(st.x, st.y, 5 + v, col, 0.5);
      if (a.nodes && a.src) {
        for (var ni = 1; ni < a.src.length - 1; ni++) softGlow(a.src[ni].x, a.src[ni].y, (6 + v * 1.5) * (0.7 + (1 - t) * 0.5), col, 0.6);
      }
    });
    ctx.restore();
  }
  function drawArcs() { drawArcList(state.arcs); }

  function drawOrbs() {
    if (state.orbs.length) drawOrbList(state.orbs, state.player, state.card.ammo);
  }
  // 把卫星按半径分环：同环才能连成一圈（原来两环混算半径，弧线错位、圈合不上）
  function orbRings(list, p) {
    var rings = [];
    for (var i = 0; i < list.length; i++) {
      var o = list[i], R = o.r != null ? o.r : dist(o, p), key = Math.round(R / 4), hit = null;
      for (var j = 0; j < rings.length; j++) if (rings[j].key === key) { hit = rings[j]; break; }
      if (!hit) { hit = { key: key, R: R, n: 0, vt: o.vt || 1, sub: !!o.sub }; rings.push(hit); }
      hit.n++;
    }
    return rings;
  }

  function drawOrbList(list, p, ammo) {
    var v = list[0].vt || 1, col0 = vtColor('shield', v, 0);
    // 每环一个闭合圆环 + 旋转亮段：满级时外圈完整闭合
    orbRings(list, p).forEach(function (rg) {
      if (rg.n < 3) return;
      var vv = rg.vt || v;
      var col = vv >= 6 ? 'hsl(' + ((tGlobal * 240) % 360) + ',100%,70%)' : vtColor('shield', vv, 0);
      var sp = tGlobal * (rg.sub ? -0.9 : 1.1) * (0.7 + vv * 0.12);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      // 闭合底环
      ctx.globalAlpha = 0.1 + Math.min(0.22, vv * 0.035);
      ctx.lineWidth = 1 + vv * 0.12;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, rg.R, 0, Math.PI * 2); ctx.stroke();
      // 旋转亮段：正好把相邻盾片连起来
      var segLen = Math.PI * 2 / rg.n * (vv >= 5 ? 0.8 : 0.62);
      ctx.globalAlpha = 0.28 + Math.min(0.4, vv * 0.06);
      ctx.lineWidth = 1.6 + vv * 0.22;
      for (var k = 0; k < rg.n; k++) {
        var a0 = sp + k * Math.PI * 2 / rg.n;
        ctx.beginPath(); ctx.arc(p.x, p.y, rg.R, a0, a0 + segLen); ctx.stroke();
      }
      // 满级：外面再套一圈反向流动的细虚线环
      if (vv >= 5) {
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 0.9;
        ctx.setLineDash([6, 10]);
        ctx.lineDashOffset = -tGlobal * 26 * (rg.sub ? -1 : 1);
        ctx.beginPath(); ctx.arc(p.x, p.y, rg.R + 5, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    });
    list.forEach(function (o) {
      var cooling = o.cd > 0;
      var col = cooling ? '#7d8b86' : (v >= 6 ? 'hsl(' + ((o.i * 60 + tGlobal * 240) % 360) + ',100%,70%)' : col0);
      var dim = cooling ? 0.38 : 1;
      ctx.save();
      ctx.globalAlpha = dim;
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(o.x, o.y);
      halo(8 + v, col, (0.24 + v * 0.03) * dim);
      ctx.restore();

      // 等级形态：1-2 光点 / 3 菱形符板 / 4+ 六棱盾片 + 旋转能量弧
      if (v >= 3) {
        ctx.save();
        ctx.globalAlpha = dim;
        ctx.translate(o.x, o.y);
        var rotO = tGlobal * (1.1 + v * 0.12) * (o.i % 2 ? -1 : 1);
        var sides = v >= 4 ? 6 : 4, RR = 8.5 + v * 0.45;
        ctx.save();
        ctx.rotate(rotO);
        ctx.beginPath();
        for (var si = 0; si < sides; si++) {
          var sa = -Math.PI / 2 + si * Math.PI * 2 / sides;
          var sx2 = Math.cos(sa) * RR, sy2 = Math.sin(sa) * RR;
          if (si) ctx.lineTo(sx2, sy2); else ctx.moveTo(sx2, sy2);
        }
        ctx.closePath();
        // 卫星数量多且每帧绘制；用半透明填充代替每颗卫星单独创建径向渐变。
        ctx.fillStyle = hexA(col, 0.28);
        ctx.fill();
        ctx.strokeStyle = hexA(col, 0.92);
        ctx.lineWidth = 1.15;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.4)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (var si2 = 0; si2 < sides; si2++) {
          var sa3 = -Math.PI / 2 + si2 * Math.PI * 2 / sides;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(sa3) * RR * 0.92, Math.sin(sa3) * RR * 0.92);
        }
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.rotate(-rotO * 1.6);
        ctx.strokeStyle = hexA(col, 0.5 + Math.min(0.4, v * 0.06));
        ctx.lineWidth = 1 + v * 0.12;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, RR * 1.22, -0.4, 0.5 + v * 0.12); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, RR * 1.22, Math.PI - 0.2, Math.PI + 0.7 + v * 0.1); ctx.stroke();
        ctx.restore();
        ctx.restore();
      }

      // 字母按单词顺序排列：主环 0..n-1，副环接着往下数，转一圈读出来就是这个词
      var li = o.li != null ? o.li : o.i;
      var Lt = ammo && ammo.length ? ammo[li % ammo.length] : null;
      ctx.globalAlpha = dim * (o.sub ? 0.72 : 1);
      drawLetterAt(Lt, o.x, o.y, 11 + Math.min(3, v * 0.5), '#f2fff8', v >= 4 ? 'rgba(10,40,25,.8)' : null, 0);
      ctx.globalAlpha = 1;
      if (cooling) {
        var maxCd = o.cdMax || 1.6, ready = 1 - Math.min(1, o.cd / maxCd);
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.strokeStyle = 'rgba(210,230,220,.75)';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, 12.5 + v * 0.35, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ready);
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  function drawLetterAt(letter, x, y, size, fill, stroke, rot) {
    var path = glyphPath(letter);
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (path) {
      var sc = size / Math.max(letter.gw, letter.gh);
      ctx.scale(sc, sc);
      ctx.translate(-letter.gw / 2, -letter.gb * 0.72);
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 3.2 / sc;
        ctx.lineJoin = 'round';
        ctx.stroke(path);
      }
      ctx.fillStyle = fill;
      ctx.fill(path);
    } else {
      var ch = letter && letter.ch ? letter.ch.toUpperCase() : '✦';
      ctx.font = '700 ' + size + 'px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.strokeText(ch, 0, 0); }
      ctx.fillStyle = fill;
      ctx.fillText(ch, 0, 0);
    }
    ctx.restore();
  }

  /* 主/副武器专属挂载：让不同武器在机身上有不同的"装备形态" */
  function drawShipRig(mainKind, subKind, lvArg, vtArg) {
    var t = tGlobal;
    var lv = lvArg != null ? lvArg : Math.min(7, wLevel('main'));
    var vt = vtArg != null ? vtArg : vtOf(mainKind);
    var col = kindColor(mainKind);
    ctx.save();

    if (mainKind === 'blast') {
      [-1, 1].forEach(function (s) {
        ctx.fillStyle = '#3b2a22';
        roundRect(s * 12.5 - 3.6, -7, 7.2, 13, 2.6); ctx.fill();
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.9; ctx.stroke();
        // 炮口热光
        var g = ctx.createRadialGradient(s * 12.5, -9, 0, s * 12.5, -9, 7 + vt);
        g.addColorStop(0, 'rgba(255,244,214,.9)');
        g.addColorStop(0.5, hexA(col, 0.5));
        g.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s * 12.5, -9, 7 + vt, 0, Math.PI * 2); ctx.fill();
      });
    } else if (mainKind === 'frost') {
      [-1, 1].forEach(function (s) {
        var g = ctx.createLinearGradient(s * 6, -8, s * 20, 4);
        g.addColorStop(0, 'rgba(236,252,255,.95)');
        g.addColorStop(0.6, hexA(col, 0.55));
        g.addColorStop(1, hexA(col, 0.05));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(s * 7, -5);
        ctx.lineTo(s * (15 + vt), -13);
        ctx.lineTo(s * (18 + vt), -2);
        ctx.lineTo(s * 8, 3);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(244,254,255,.65)';
        ctx.lineWidth = 0.7; ctx.stroke();
        // 冰晶碎粒
        ctx.fillStyle = 'rgba(232,250,255,.85)';
        ctx.beginPath(); ctx.arc(s * (13 + vt * 0.4), -8 - Math.sin(t * 3 + s) * 1.4, 1.2, 0, Math.PI * 2); ctx.fill();
      });
    } else if (mainKind === 'pierce') {
      [-1, 1].forEach(function (s) {
        ctx.strokeStyle = '#4a3340'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s * 8, 1); ctx.lineTo(s * 8, -12 - vt); ctx.stroke();
        var g = ctx.createLinearGradient(0, -12 - vt, 0, 2);
        g.addColorStop(0, hexA(col, 0.1));
        g.addColorStop(0.5, hexA(col, 0.95));
        g.addColorStop(1, hexA(col, 0.2));
        ctx.strokeStyle = g; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s * 8, -12 - vt); ctx.lineTo(s * 8, 2); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(s * 8, -12 - vt, 1.7, 0, Math.PI * 2); ctx.fill();
      });
    } else if (mainKind === 'thunder') {
      [-1, 1].forEach(function (s, si) {
        for (var k = 0; k < 3; k++) {
          var yy = -1 - k * 4.2, rr = 5.2 - k * 0.7;
          ctx.strokeStyle = hexA(col, 0.8 - k * 0.18);
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(s * 10.5, yy, rr, rr * 0.52, 0, 0, Math.PI * 2); ctx.stroke();
        }
        // 电弧跳动
        if (Math.sin(t * 11 + si * 2.4) > 0.55) {
          ctx.strokeStyle = 'rgba(233,222,255,.95)';
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(s * 10.5, -12);
          ctx.lineTo(s * (13 + Math.sin(t * 20 + si) * 2), -16);
          ctx.lineTo(s * (9 + Math.cos(t * 17 + si) * 2), -19);
          ctx.stroke();
        }
      });
    } else if (mainKind === 'swift') {
      [-1, 1].forEach(function (s) {
        ctx.fillStyle = '#3d3320';
        roundRect(s * 12 - 3, -2, 6, 9, 2); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(s * 12 - 3, -2); ctx.lineTo(s * 12, -8.5); ctx.lineTo(s * 12 + 3, -2);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,250,220,.6)'; ctx.lineWidth = 0.6; ctx.stroke();
      });
    } else if (mainKind === 'shield') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var R0 = 19 + Math.sin(t * 3) * 1.4;
      ctx.strokeStyle = hexA(col, 0.5);
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.ellipse(0, -2, R0 * 0.55, R0 * 1.02, 0, 0, Math.PI * 2); ctx.stroke();
      // 三块旋转护符
      for (var k2 = 0; k2 < 3; k2++) {
        var aa = t * 1.4 + k2 * Math.PI * 2 / 3;
        var px = Math.cos(aa) * R0 * 0.72, pyy = -2 + Math.sin(aa) * R0 * 1.15;
        ctx.fillStyle = hexA(col, 0.75);
        ctx.beginPath();
        ctx.moveTo(px, pyy - 2.4); ctx.lineTo(px + 1.8, pyy); ctx.lineTo(px, pyy + 2.4); ctx.lineTo(px - 1.8, pyy);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    } else if (mainKind === 'tide') {
      [-1, 1].forEach(function (s) {
        var g = ctx.createLinearGradient(s * 6, 0, s * 19, 8);
        g.addColorStop(0, hexA(col, 0.9));
        g.addColorStop(1, hexA(col, 0.03));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(s * 6, 2);
        ctx.quadraticCurveTo(s * 15, -1 + Math.sin(t * 4 + s) * 1.2, s * (17 + vt), 9);
        ctx.quadraticCurveTo(s * 12, 7, s * 6, 6);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(220,248,255,.5)';
        ctx.lineWidth = 0.7; ctx.stroke();
      });
    } else if (mainKind === 'blade') {
      [-1, 1].forEach(function (s, si) {
        var rr = 4.6 + vt * 0.42, sp = t * (7 + si * 1.6);
        ctx.save();
        ctx.translate(s * (14 + vt * 0.45), 2);
        ctx.rotate(sp);
        ctx.fillStyle = hexA(col, 0.9);
        for (var k3 = 0; k3 < 5; k3++) {
          ctx.rotate(Math.PI * 2 / 5);
          ctx.beginPath();
          ctx.moveTo(0, -rr); ctx.lineTo(1.9, -rr * 0.32); ctx.lineTo(-1.9, -rr * 0.32);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.beginPath(); ctx.arc(0, 0, rr * 0.24, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    }

    // 副武器：翼尖小挂载，颜色区分
    if (subKind) {
      var sc2 = kindColor(subKind);
      [-1, 1].forEach(function (s) {
        ctx.fillStyle = sc2;
        ctx.beginPath(); ctx.arc(s * 15, 9, 2.1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 0.7; ctx.stroke();
      });
    }
    ctx.restore();
  }

  /* ── 战机外形：机翼轮廓随主武器变化；机体档次随武器等级（1-2 / 3-4 / 5-6 / 7）逐级华丽 ── */
  var WING = {
    blast:   [[4, -4], [18, 5], [19.5, 10], [13, 11], [4, 9]],
    frost:   [[4, -7], [12, -2], [21, 7], [15.5, 7.5], [17, 12], [4, 9]],
    swift:   [[4, -1], [15, -7], [18, -5], [10, 5], [13, 10.5], [4, 9]],
    thunder: [[4, -6], [13, -1], [10.5, 2.5], [20, 9], [13.5, 8], [15, 12.5], [4, 9]],
    pierce:  [[4, -2], [14, 4], [16.5, 9], [4, 8]],
    shield:  [[4, -7], [11, -7], [17, -2], [18.5, 5], [14, 10.5], [4, 9]],
    tide:    [[4, -3], [12, 0], [20.5, 7], [18, 12.5], [12, 8.5], [4, 10]],
    blade:   [[4, -8], [10, -11], [20.5, -2], [14, 2], [19, 10.5], [4, 8]],
  };
  var NOSE = { pierce: -23, swift: -21, blade: -20 };
  function shipTier(lv) { return lv >= 7 ? 4 : lv >= 5 ? 3 : lv >= 3 ? 2 : 1; }
  function wingPath(pts, sx, sy, oy) {
    ctx.beginPath();
    for (var s = -1; s <= 1; s += 2) {
      for (var i = 0; i < pts.length; i++) {
        var x = pts[i][0] * sx * s, y = pts[i][1] * sy + oy;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
    }
  }
  function wingTip(pts) {
    var best = pts[0];
    for (var i = 1; i < pts.length; i++) if (pts[i][0] > best[0]) best = pts[i];
    return best;
  }

  function drawShipArt(o) {
    var kind = WING[o.kind] ? o.kind : 'blast', lv = o.lv || 1, tier = shipTier(lv), rk = o.rank || 1, t = tGlobal;
    var col = kindColor(kind), dark = tintHex(col, -0.55), lite = tintHex(col, 0.45);
    var trim = rk >= 6 ? 'hsl(' + ((t * 160) % 360) + ',100%,72%)' : (rk >= 5 || tier >= 4) ? '#ffd36b' : null;
    var wp = WING[kind], ws = 1 + (tier - 1) * 0.05, tip = wingTip(wp);
    var nose = NOSE[kind] || -18, hw = tier >= 3 ? 5.6 : 5;
    var s, i;

    // ① 背光：3 档起机身下一圈本色柔光（不画任何闭合圆环，避免和护盾气泡混淆）
    if (tier >= 3) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      halo(28 + tier * 3, col, 0.12 + (tier - 3) * 0.05);
      ctx.restore();
    }

    // ② 4 档光翼：每侧三片半透明羽刃，缓慢呼吸
    if (tier >= 4) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var fcol = trim || col;
      for (s = -1; s <= 1; s += 2) {
        for (var f = 0; f < 3; f++) {
          var fa = -0.55 + f * 0.42 + Math.sin(t * 2.2 + f) * 0.06, len = 25 - f * 3;
          ctx.save();
          ctx.translate(s * 6, 3);
          ctx.scale(s, 1);
          ctx.rotate(fa);
          var lg = ctx.createLinearGradient(0, 0, len, 0);
          lg.addColorStop(0, fadeA(fcol, 0.75));
          lg.addColorStop(0.6, fadeA(col, 0.32));
          lg.addColorStop(1, fadeA(col, 0));
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(len * 0.5, -3.8, len, 0);
          ctx.quadraticCurveTo(len * 0.5, 1.6, 0, 0);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // ③ 引擎尾焰：1 / 2 / 3 喷口，狂暴时更长、转为赤焰
    var eng = tier >= 3 ? [-5.5, 0, 5.5] : tier >= 2 ? [-3, 3] : [0];
    var boost = o.rage ? 1.6 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    eng.forEach(function (ex, ei) {
      var big = eng.length !== 2 && ei === (eng.length - 1) / 2;
      var fw = big ? 3.4 : 2.5, fl = (big ? 11 : 8) * boost + Math.random() * 5, ey = 10.5;
      var fg = ctx.createLinearGradient(0, ey, 0, ey + fl);
      fg.addColorStop(0, 'rgba(255,255,255,.95)');
      fg.addColorStop(0.3, fadeA(o.rage ? '#ff8a4a' : lite, 0.85));
      fg.addColorStop(1, fadeA(o.rage ? '#ff3c3c' : col, 0));
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(ex - fw, ey);
      ctx.quadraticCurveTo(ex, ey + fl * 1.15, ex + fw, ey);
      ctx.closePath();
      ctx.fill();
      softGlow(ex, ey + 1, fw * 2.2, o.rage ? '#ff6a3c' : col, 0.55);
    });
    ctx.restore();

    ctx.lineJoin = 'round';
    // ④ 3 档起外翼：深色复层翼 + 亮边
    if (tier >= 3) {
      wingPath(wp, ws * 1.12, 1.06, 2.5);
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.strokeStyle = fadeA(trim || lite, 0.85);
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    // ⑤ 主翼：前缘亮、后缘暗
    wingPath(wp, ws, 1, 0);
    var wg = ctx.createLinearGradient(0, -8, 0, 13);
    wg.addColorStop(0, lite);
    wg.addColorStop(0.45, col);
    wg.addColorStop(1, dark);
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    if (tier >= 2) {
      // 翼面分割线 + 翼尖航灯
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (s = -1; s <= 1; s += 2) {
        ctx.moveTo(s * 6, 3);
        ctx.lineTo(s * tip[0] * ws * 0.78, tip[1] * 0.78 + 1.5);
      }
      ctx.stroke();
      if (tier >= 3) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = fadeA(trim || lite, 0.8);
        ctx.shadowColor = trim || col;
        ctx.shadowBlur = 4;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (s = -1; s <= 1; s += 2) {
          ctx.moveTo(s * 5.5, -1);
          ctx.lineTo(s * tip[0] * ws * 0.9, tip[1] * 0.9);
        }
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var blink = 0.55 + 0.45 * Math.sin(t * 6);
      ctx.globalAlpha = blink;
      softGlow(tip[0] * ws, tip[1], 3.2 + tier * 0.4, trim || lite, 0.95);
      softGlow(-tip[0] * ws, tip[1], 3.2 + tier * 0.4, trim || lite, 0.95);
      ctx.restore();
      // 尾翼
      ctx.fillStyle = dark;
      ctx.beginPath();
      for (s = -1; s <= 1; s += 2) {
        ctx.moveTo(s * 4, 5.5); ctx.lineTo(s * 8.5, 13.5); ctx.lineTo(s * 4.4, 12); ctx.closePath();
      }
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    drawShipRig(kind, o.sub, lv, o.vt || 1);

    // ⑥ 机身：低档象牙白，高档转为枪灰金属
    ctx.beginPath();
    ctx.moveTo(0, nose);
    ctx.quadraticCurveTo(hw * 0.9, nose * 0.55, hw, -5);
    ctx.lineTo(hw * 1.05, 8.5);
    ctx.lineTo(hw * 0.65, 11.5);
    ctx.lineTo(-hw * 0.65, 11.5);
    ctx.lineTo(-hw * 1.05, 8.5);
    ctx.lineTo(-hw, -5);
    ctx.quadraticCurveTo(-hw * 0.9, nose * 0.55, 0, nose);
    ctx.closePath();
    var hg = ctx.createLinearGradient(-hw, 0, hw, 0);
    if (tier >= 3) {
      hg.addColorStop(0, '#363b4a'); hg.addColorStop(0.3, '#9aa3b8'); hg.addColorStop(0.5, '#f4f6fb');
      hg.addColorStop(0.7, '#8790a6'); hg.addColorStop(1, '#2b2f3c');
    } else {
      hg.addColorStop(0, '#b3ab99'); hg.addColorStop(0.45, '#ffffff'); hg.addColorStop(1, '#958c78');
    }
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 中脊色带
    if (tier >= 2) {
      ctx.save();
      if (tier >= 3) { ctx.shadowColor = trim || col; ctx.shadowBlur = 5; }
      ctx.fillStyle = trim || col;
      roundRect(-1, -2, 2, 12, 1);
      ctx.fill();
      ctx.restore();
    }
    // 座舱
    var cy = nose * 0.42 + 2, chh = tier >= 3 ? 5.6 : 4.8;
    var cg = ctx.createLinearGradient(0, cy - chh, 0, cy + chh);
    if (o.rage) { cg.addColorStop(0, '#ffe6d6'); cg.addColorStop(0.45, '#ff6a4a'); cg.addColorStop(1, '#5a1010'); }
    else { cg.addColorStop(0, '#d8f4ff'); cg.addColorStop(0.45, '#4aa8e8'); cg.addColorStop(1, '#173a66'); }
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(0, cy, 2.5, chh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.ellipse(-0.8, cy - chh * 0.45, 0.7, chh * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    // 4 档 / 高品阶：机鼻晶核
    if (trim) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      softGlow(0, nose + 3, 4.5, trim, 0.9);
      ctx.restore();
    }
  }

  // 狂暴（觉醒）光环：赤焰外壳 + 上卷火舌 + 反向旋转符文弧 + 上飘火星
  function drawRageAura(col) {
    var t = tGlobal, pulse = 0.5 + 0.5 * Math.sin(t * 9), i;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var R = 31 + pulse * 3;
    var g = ctx.createRadialGradient(0, 2, 6, 0, 2, R);
    g.addColorStop(0, 'rgba(255,90,50,0)');
    g.addColorStop(0.55, 'rgba(255,80,40,' + (0.14 + pulse * 0.08).toFixed(3) + ')');
    g.addColorStop(0.85, fadeA(col, 0.2));
    g.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 2, R, 0, Math.PI * 2); ctx.fill();
    for (i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2 + t * 1.5;
      var len = 8 + Math.sin(t * 13 + i * 2.3) * 4;
      var bx = Math.cos(a) * 20, by = 2 + Math.sin(a) * 22;
      var fg = ctx.createLinearGradient(bx, by, bx, by - len * 1.7);
      fg.addColorStop(0, 'rgba(255,200,120,.5)');
      fg.addColorStop(1, 'rgba(255,70,40,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(bx - 3, by);
      ctx.quadraticCurveTo(bx + Math.sin(t * 7 + i) * 2.5, by - len, bx, by - len * 1.7);
      ctx.quadraticCurveTo(bx + 1, by - len * 0.6, bx + 3, by);
      ctx.fill();
    }
    ctx.lineCap = 'round';
    for (var k = 0; k < 2; k++) {
      ctx.save();
      ctx.rotate(t * (k ? -2.2 : 1.6));
      ctx.strokeStyle = k ? 'rgba(255,220,150,.65)' : 'rgba(255,90,60,.7)';
      ctx.lineWidth = 1.3;
      for (var j = 0; j < 3; j++) {
        ctx.beginPath(); ctx.arc(0, 2, 25 + k * 4, j * 2.09, j * 2.09 + 1.2); ctx.stroke();
      }
      ctx.restore();
    }
    for (i = 0; i < 7; i++) {
      var ph = (t * 0.9 + i / 7) % 1;
      ctx.globalAlpha = 1 - ph;
      softGlow(Math.sin(i * 3.7 + t) * 16, 14 - ph * 46, 2.6, '#ff8a4a', 0.9);
    }
    ctx.restore();
  }

  // 护盾：层数 n（1-2），档次随武器等级 —— 1 菲涅尔气泡 / 2 加蜂巢纹 / 3 加符文刻度环 / 4 加金环晶石
  function drawShieldBubble(n, tier) {
    var t = tGlobal, PI2 = Math.PI * 2;
    for (var i = 0; i < n; i++) {
      var R = 23 + i * 6 + Math.sin(t * 3.2 + i * 1.7) * 0.9, al = 1 - i * 0.25, k;
      ctx.save();
      var g = ctx.createRadialGradient(0, 0, R * 0.35, 0, 0, R);
      g.addColorStop(0, 'rgba(126,232,255,0)');
      g.addColorStop(0.72, 'rgba(126,232,255,' + (0.06 * al).toFixed(3) + ')');
      g.addColorStop(0.93, 'rgba(190,248,255,' + (0.26 * al).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(126,232,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, PI2); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      if (tier >= 2) {
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, R * 0.97, 0, PI2); ctx.clip();
        ctx.strokeStyle = 'rgba(160,240,255,' + (0.15 * al).toFixed(3) + ')';
        ctx.lineWidth = 0.6;
        var hs = 4.2, off = (t * 4 * (i % 2 ? -1 : 1)) % (hs * 3);
        ctx.beginPath();
        for (var row = 0, gy = -R - hs * 3; gy < R + hs * 3; gy += hs * 1.5, row++) {
          for (var gx = -R - hs * 2; gx < R + hs * 2; gx += hs * 1.732) {
            var hx = gx + (row % 2 ? hs * 0.866 : 0), hy = gy + off;
            for (k = 0; k < 6; k++) {
              var ha = k * Math.PI / 3 - Math.PI / 2;
              var px = hx + Math.cos(ha) * hs * 0.92, py = hy + Math.sin(ha) * hs * 0.92;
              if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
            }
            ctx.closePath();
          }
        }
        ctx.stroke();
        ctx.restore();
      }
      ctx.shadowColor = '#7ee8ff';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(200,250,255,' + (0.75 * al).toFixed(3) + ')';
      ctx.lineWidth = tier >= 3 ? 1.6 : 1.2;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, PI2); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * al).toFixed(3) + ')';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.82, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
      if (tier >= 3) {
        ctx.save();
        ctx.rotate(t * (i % 2 ? -0.9 : 0.9));
        ctx.strokeStyle = 'rgba(160,245,255,' + (0.7 * al).toFixed(3) + ')';
        ctx.lineWidth = 1.4;
        for (k = 0; k < 3; k++) {
          ctx.beginPath(); ctx.arc(0, 0, R + 3, k * 2.094, k * 2.094 + 0.8); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(200,250,255,' + (0.45 * al).toFixed(3) + ')';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (k = 0; k < 12; k++) {
          var ta = k * Math.PI / 6;
          ctx.moveTo(Math.cos(ta) * (R + 1.5), Math.sin(ta) * (R + 1.5));
          ctx.lineTo(Math.cos(ta) * (R + 4.5), Math.sin(ta) * (R + 4.5));
        }
        ctx.stroke();
        ctx.restore();
      }
      if (tier >= 4) {
        ctx.save();
        ctx.rotate(-t * 0.6);
        ctx.strokeStyle = 'rgba(255,211,107,' + (0.6 * al).toFixed(3) + ')';
        ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.arc(0, 0, R + 6.5, 0, PI2); ctx.stroke();
        for (k = 0; k < 4; k++) {
          var ka = k * Math.PI / 2;
          ctx.save();
          ctx.translate(Math.cos(ka) * (R + 6.5), Math.sin(ka) * (R + 6.5));
          softGlow(0, 0, 6, '#ffd36b', 0.7);
          ctx.rotate(ka);
          ctx.fillStyle = '#ffd36b';
          ctx.beginPath(); ctx.moveTo(0, -3.2); ctx.lineTo(2, 0); ctx.lineTo(0, 3.2); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.85)';
          ctx.beginPath(); ctx.moveTo(0, -2.4); ctx.lineTo(0.8, 0); ctx.lineTo(0, 0.6); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
      ctx.restore();
    }
  }

  function drawPlayer() {
    var p = state.player, c = state.card;
    var blink = state.invuln > 0 && !state.ult && ((state.invuln * 14) | 0) % 2 === 0;
    var lv = Math.min(7, wLevel('main')), rage = state.awaken > 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.4;
    ctx.translate(p.x, p.y);
    ctx.scale(0.92, 0.92);
    if (rage) drawRageAura(c.color);
    ctx.scale(1 - Math.abs(p.bank) * 0.25, 1);
    drawShipArt({ kind: c.kind, sub: c.sub, lv: lv, vt: vtOf(c.kind), rank: c.rank, rage: rage });
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff4f6d';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 1.6, 0, Math.PI * 2); ctx.stroke();

    if (state.shield > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      drawShieldBubble(state.shield, shipTier(lv));
      ctx.restore();
    }
  }

  var ITEM_LOOK = {
    P: { c: '#ff9d3c', c2: '#ffe3ad', t: 'P' },
    B: { c: '#ffd36b', c2: '#fff6cf', t: 'B' },
    S: { c: '#6ee7f0', c2: '#d8fdff', t: 'S' },
    H: { c: '#ff6b81', c2: '#ffd6dc', t: '♥' },
  };
  function drawItem(it) {
    var blink = it.t > 6 && ((it.t * 8) | 0) % 2 === 0;
    if (blink) return;
    var y = it.y + Math.sin(it.t * 5) * 2;
    var pulse = 0.5 + 0.5 * Math.sin(it.t * 5.5);
    if (it.type === 'L') {
      var ink = state.card.ink;
      // 光晕
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var lg = ctx.createRadialGradient(it.x, y, 0, it.x, y, 20 + pulse * 4);
      lg.addColorStop(0, hexA(ink, 0.5));
      lg.addColorStop(1, hexA(ink, 0));
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(it.x, y, 20 + pulse * 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // 六边形宝石座
      ctx.save();
      ctx.translate(it.x, y);
      ctx.rotate(Math.sin(it.t * 2.2) * 0.08);
      var rg = ctx.createLinearGradient(0, -12, 0, 12);
      rg.addColorStop(0, '#241a30');
      rg.addColorStop(1, '#100a18');
      ctx.fillStyle = rg;
      hexPath(0, 0, 11, 0.86);
      ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.9;
      hexPath(0, 0, 8.2, 0.86); ctx.stroke();
      ctx.restore();
      // 内容改为「字块」：三枚小字母叠在一起，索引只由这颗道具自身决定（it.seed），
      // 拾取别的字母后不会再变——字母轨道到底需要哪个字母，交给底部 HUD 显示
      if (it.seed == null) it.seed = Math.random() * 997;
      var am = state.card.ammo, an = am.length || spellLen();
      for (var li = 0; li < 3; li++) {
        var k2 = ((it.seed | 0) + li * 5) % an;
        var L2 = am[k2] || { ch: spellChar(k2) };
        ctx.globalAlpha = 0.4 + li * 0.3;
        drawLetterAt(L2, it.x + (li - 1) * 3.4, y + (li - 1) * 1.4, 11, '#fffdf2', 'rgba(20,8,24,.9)', (li - 1) * 0.2);
      }
      ctx.globalAlpha = 1;
      return;
    }
    if (it.type === 'C') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var cg = ctx.createRadialGradient(it.x, y, 0, it.x, y, 26 + pulse * 5);
      cg.addColorStop(0, 'rgba(255,232,160,' + (0.5 + pulse * 0.2).toFixed(2) + ')');
      cg.addColorStop(0.55, 'rgba(255,196,90,.18)');
      cg.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(it.x, y, 26 + pulse * 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(it.x, y);
      ctx.rotate(Math.sin(it.t * 3) * 0.14);
      // 卡册本体
      ctx.fillStyle = 'rgba(28,18,40,.96)';
      roundRect(-11, -14, 22, 28, 4); ctx.fill();
      var bg2 = ctx.createLinearGradient(0, -14, 0, 14);
      bg2.addColorStop(0, 'rgba(255,224,150,.28)');
      bg2.addColorStop(1, 'rgba(160,90,220,.16)');
      ctx.fillStyle = bg2;
      roundRect(-11, -14, 22, 28, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,140,.95)'; ctx.lineWidth = 1.8;
      roundRect(-11, -14, 22, 28, 4); ctx.stroke();
      if (global.StageArt) global.StageArt.draw(ctx, it.sprite, 0, -3, 17, false);
      ctx.fillStyle = 'rgba(255,220,150,.9)';
      ctx.fillRect(-5, 9, 10, 1.6);
      ctx.restore();
      // 右上角星芒
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,245,200,' + (0.5 + pulse * 0.5).toFixed(2) + ')';
      var ss = 2.4 + pulse * 1.6, sx = it.x + 11, sy = y - 13;
      ctx.beginPath();
      ctx.moveTo(sx, sy - ss); ctx.lineTo(sx + ss * 0.35, sy - ss * 0.35);
      ctx.lineTo(sx + ss, sy); ctx.lineTo(sx + ss * 0.35, sy + ss * 0.35);
      ctx.lineTo(sx, sy + ss); ctx.lineTo(sx - ss * 0.35, sy + ss * 0.35);
      ctx.lineTo(sx - ss, sy); ctx.lineTo(sx - ss * 0.35, sy - ss * 0.35);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      return;
    }
    var L2 = ITEM_LOOK[it.type];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g3 = ctx.createRadialGradient(it.x, y, 0, it.x, y, 17 + pulse * 3);
    g3.addColorStop(0, hexA(L2.c, 0.42));
    g3.addColorStop(1, hexA(L2.c, 0));
    ctx.fillStyle = g3;
    ctx.beginPath(); ctx.arc(it.x, y, 17 + pulse * 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(it.x, y);
    ctx.rotate(Math.sin(it.t * 2.4) * 0.1);
    var body = ctx.createLinearGradient(0, -10, 0, 10);
    body.addColorStop(0, L2.c2 || '#fff');
    body.addColorStop(0.45, L2.c);
    body.addColorStop(1, tintHex(L2.c, -0.28));
    ctx.fillStyle = body;
    hexPath(0, 0, 10.5, 0.82);
    ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.9;
    hexPath(0, 0, 7, 0.82); ctx.stroke();
    ctx.restore();

    ctx.font = '900 12px "PingFang SC", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(28,16,10,.85)';
    ctx.strokeText(L2.t, it.x, y + 0.5);
    ctx.fillStyle = '#fffdf4';
    ctx.fillText(L2.t, it.x, y + 0.5);
  }

  function hexPath(cx, cy, r, k) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3 - Math.PI / 2;
      var px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * (k || 1);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  function tintHex(hex, amt) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    var n = parseInt(m[1], 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var v = amt < 0 ? ch[i] * (1 + amt) : ch[i] + (255 - ch[i]) * amt;
      out += ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    }
    return out;
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    state.particles.forEach(function (q) {
      if (q.kind === 'boom') {
        var bk = clamp(q.life / q.max, 0, 1);
        ctx.globalAlpha = bk;
        softGlow(q.x, q.y, q.r1 * (1.15 - bk * 0.5), q.color, 0.9);
        return;
      }
      if (q.kind !== 'dot') return;
      var a = clamp(q.life / (q.max || 0.4), 0, 1);
      ctx.globalAlpha = a * 0.95;
      // 圆形软光点，不用 fillRect（方块会显像素感）
      ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.5, q.r * 0.42), 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
    ctx.globalAlpha = 1;
    state.particles.forEach(function (q) {
      var t = clamp(q.life / (q.max || 0.4), 0, 1);
      if (q.kind === 'ring') {
        var rr = q.r0 + (q.r1 - q.r0) * (1 - t * t);
        ctx.globalAlpha = t;
        ctx.strokeStyle = q.color;
        ctx.shadowColor = q.color;
        ctx.shadowBlur = 4 + q.w * 2;
        ctx.lineWidth = Math.max(0.6, q.w * t);
        ctx.beginPath(); ctx.arc(q.x, q.y, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (q.kind === 'debris') {
        ctx.globalAlpha = t;
        ctx.fillStyle = q.color;
        ctx.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
      } else if (q.kind === 'ice') {
        // 冰晶碎片：菱形棱体，边旋转边下坠
        ctx.globalAlpha = t;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot || 0);
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.moveTo(0, -q.r * 1.9); ctx.lineTo(q.r * 0.72, 0); ctx.lineTo(0, q.r * 1.9); ctx.lineTo(-q.r * 0.72, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.beginPath();
        ctx.moveTo(0, -q.r * 1.6); ctx.lineTo(q.r * 0.26, 0); ctx.lineTo(0, q.r * 1.2); ctx.lineTo(-q.r * 0.26, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (q.kind === 'smoke') {
        ctx.globalAlpha = t * 0.5;
        ctx.fillStyle = q.color;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r + (1 - t) * 3, 0, Math.PI * 2); ctx.fill();
      } else if (q.kind === 'meteor') {
        var rk = state.card.rank, tl = 0.09 + rk * 0.012;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 锥形火尾：头部粗亮、尾部收尖，外层再叠一圈柔光
        var tx = q.x - q.vx * tl * 1.4, ty = q.y - q.vy * tl * 1.4;
        var g = ctx.createLinearGradient(q.x, q.y, tx, ty);
        g.addColorStop(0, 'rgba(255,243,192,.95)');
        g.addColorStop(0.25, fadeA(q.color, 0.8));
        g.addColorStop(1, 'rgba(255,80,40,0)');
        ctx.fillStyle = g;
        ctx.shadowColor = '#ff8a3d';
        ctx.shadowBlur = 12;
        taperPoly([{ x: q.x, y: q.y }, { x: (q.x + tx) / 2, y: (q.y + ty) / 2 }, { x: tx, y: ty }], 10 + rk * 1.4, 0.5);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        taperPoly([{ x: q.x, y: q.y }, { x: (q.x + tx) / 2, y: (q.y + ty) / 2 }], 3.5 + rk * 0.4, 0.3);
        ctx.fill();
        var hg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 10 + rk * 2);
        hg.addColorStop(0, 'rgba(255,250,220,.95)');
        hg.addColorStop(0.4, hexA(q.color.charAt(0) === '#' ? q.color : '#ffb347', 0.6));
        hg.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(q.x, q.y, 10 + rk * 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
        drawLetterAt(q.letter, q.x, q.y, 16 + rk, '#fff8e6', 'rgba(60,20,0,.9)', 0);
      } else if (q.kind === 'hitfx') {
        // 命中火花：四芒星闪 + 柔光；字母等级越高越大，3 级起加冲击环，5 级起加交叉第二层星芒
        var u2 = 1 - t, R = (4.5 + q.lv * 1.5) * (0.55 + u2 * 0.7);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(q.x, q.y);
        ctx.globalAlpha = t;
        softGlow(0, 0, R * 1.5, q.col, 0.75);
        ctx.rotate(q.rot);
        star4(R, fadeA(q.col, 0.9));
        star4(R * 0.45, '#ffffff');
        if (q.lv >= 5) { ctx.rotate(Math.PI / 4); star4(R * 0.7, fadeA(q.col, 0.7)); }
        if (q.lv >= 3) {
          ctx.strokeStyle = fadeA(q.col, 0.85);
          ctx.lineWidth = 1 + (q.lv - 3) * 0.3;
          ctx.beginPath(); ctx.arc(0, 0, R * (0.7 + u2 * 0.6), 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      } else if (q.kind === 'glyph') {
        // 暴击字母：小号镂空描边字（等级色发光边 + 白芯线），外圈环数随字母等级 1 / 2 / 3 档
        var mxl = q.max || 0.3, age = mxl - q.life, u = clamp(age / mxl, 0, 1);
        var pop = u < 0.18 ? 1.5 - (u / 0.18) * 0.5 : 1 - (u - 0.18) * 0.15;
        var al = u < 0.5 ? 1 : 1 - (u - 0.5) / 0.5;
        var gs = 17 * pop;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp(al * (1 - u), 0, 1);
        var rings = q.lv >= 5 ? 3 : q.lv >= 3 ? 2 : 1;
        ctx.strokeStyle = fadeA(q.col, 0.9);
        ctx.lineWidth = 1.4;
        for (var rI = 0; rI < rings; rI++) {
          ctx.beginPath(); ctx.arc(0, 0, gs * (0.7 + u * 0.9) + rI * 4, 0, Math.PI * 2); ctx.stroke();
        }
        softGlow(0, 0, gs * 0.9, q.col, 0.5);
        ctx.restore();
        var gp = glyphPath(q.letter);
        if (gp) {
          var lt = q.letter, sc = gs / Math.max(lt.gw, lt.gh);
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot || 0);
          ctx.scale(sc, sc);
          ctx.translate(-lt.gw / 2, -lt.gb * 0.72);
          ctx.globalAlpha = clamp(al, 0, 1);
          ctx.lineJoin = 'round';
          ctx.shadowColor = q.col;
          ctx.shadowBlur = 8;
          ctx.strokeStyle = q.col;
          ctx.lineWidth = 3 / sc;
          ctx.stroke(gp);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.1 / sc;
          ctx.stroke(gp);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    });
    ctx.globalAlpha = 1;
    state.pops.forEach(function (q) {
      var t = clamp(q.life / q.max, 0, 1);
      ctx.globalAlpha = clamp(t * 2.5, 0, 1);
      ctx.font = '800 12px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20,10,10,.85)';
      ctx.strokeText(q.text, q.x, q.y);
      ctx.fillStyle = q.color;
      ctx.fillText(q.text, q.x, q.y);
    });
    ctx.globalAlpha = 1;
  }

  /* 大招画面：先压暗全场 + 武器色暗角，再按品阶叠层（光柱 / 字环在敌人之下，冻结在上层） */
  var ULT_TINT = { blast: '255,140,60', pierce: '255,95,162', swift: '255,216,77', thunder: '179,140,255', frost: '127,216,255', shield: '95,224,160', tide: '79,214,232', blade: '255,122,224' };
  function ultTint(k) { return ULT_TINT[k] || '255,255,255'; }
  function ultFade(u) {
    return clamp(u.t / 0.18, 0, 1) * clamp((u.dur - u.t) / 0.3 + 0.2, 0, 1);
  }
  function top0Of() { return hudTop + 10; }
  function drawUltUnder() {
    var u = state.ult;
    if (!u) return;
    var c = state.card, rk = c.rank, fa = ultFade(u);
    // 压暗 + 暗角
    ctx.fillStyle = 'rgba(8,4,16,' + (0.32 * fa).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.72);
    vg.addColorStop(0, 'rgba(' + ultTint(u.kind) + ',0)');
    vg.addColorStop(1, 'rgba(' + ultTint(u.kind) + ',' + (0.38 * fa).toFixed(3) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    if (u.kind === 'pierce' && u.bx != null) {
      var bw = 80 + rk * 14;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var col = rk >= 6 ? 'hsla(' + ((tGlobal * 200) % 360) + ',100%,65%,' : rk >= 5 ? 'rgba(255,211,107,' : 'rgba(255,95,162,';
      var g = ctx.createLinearGradient(u.bx - bw, 0, u.bx + bw, 0);
      g.addColorStop(0, col + '0)');
      g.addColorStop(0.25, col + '.25)');
      g.addColorStop(0.42, col + '.7)');
      g.addColorStop(0.5, 'rgba(255,255,255,.95)');
      g.addColorStop(0.58, col + '.7)');
      g.addColorStop(0.75, col + '.25)');
      g.addColorStop(1, col + '0)');
      ctx.fillStyle = g;
      ctx.fillRect(u.bx - bw, -10, bw * 2, H + 20);
      // 光柱内的能量流线：柔光细线向上流动，代替硬边线
      var j = Math.sin(tGlobal * 60) * 2, pc = rk >= 6 ? 'hsl(' + ((tGlobal * 200) % 360) + ',100%,70%)' : rk >= 5 ? '#ffd36b' : '#ff5fa2';
      ctx.shadowColor = pc;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(u.bx - bw * 0.36 + j, 0); ctx.lineTo(u.bx - bw * 0.36 + j, H);
      ctx.moveTo(u.bx + bw * 0.36 - j, 0); ctx.lineTo(u.bx + bw * 0.36 - j, H);
      ctx.stroke();
      ctx.shadowBlur = 0;
      for (var s = 0; s < 10 + rk * 3; s++) {
        var sy = H - ((s * 97 + tGlobal * 900) % (H + 40)), sx = u.bx + (s % 2 ? 1 : -1) * (bw * 0.2 + ((s * 37) % (bw * 0.7)));
        softGlow(sx, sy, 3 + (s % 3), pc, 0.9);
      }
      // 光柱两端的爆光
      softGlow(u.bx, H, bw * 1.1, pc, 0.7);
      softGlow(u.bx, 0, bw * 0.8, pc, 0.5);
      ctx.restore();
      var n = spellLen();
      for (var i = 0; i < n * 2; i++) {
        var yy = ((i / (n * 2)) * H + tGlobal * 520) % H;
        drawLetterAt(c.ammo[i % n] || { ch: spellChar(i % n) }, u.bx, yy, 22 + rk * 1.5, '#ffffff', null, 0);
      }
    }
    if (u.kind === 'shield' && u.R) {
      var p = state.player, rings = rk >= 6 ? 3 : rk >= 4 ? 2 : 1;
      for (var r = 0; r < rings; r++) {
        var R = u.R * (1 - r * 0.22), dir = r % 2 ? -1 : 1, n2 = 18 + rk * 2, a0 = tGlobal * 2 * dir;
        if (R <= 10) continue;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var rc = rk >= 5 ? rankColor(r) : kindColor('shield');
        // 冲击环：径向渐变做出前沿亮、后沿拖影的软边波面
        var rg = ctx.createRadialGradient(p.x, p.y, Math.max(0, R - 34), p.x, p.y, R + 8);
        rg.addColorStop(0, fadeA(rc, 0));
        rg.addColorStop(0.7, fadeA(rc, 0.22));
        rg.addColorStop(0.88, 'rgba(255,255,255,.55)');
        rg.addColorStop(1, fadeA(rc, 0));
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(p.x, p.y, R + 8, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = rc;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = rc;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        for (var k = 0; k < n2; k++) {
          var a = a0 + k * Math.PI * 2 / n2;
          var L = c.ammo.length ? c.ammo[k % c.ammo.length] : null;
          drawLetterAt(L, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, 18 + rk, rankColor(k), 'rgba(10,30,20,.85)', a + Math.PI / 2);
        }
      }
    }
    if (u.kind === 'thunder') {
      // 雷云：顶部暗紫云带 + 缓慢漂移的云团，云团内部随落雷闪亮
      ctx.save();
      var cg = ctx.createLinearGradient(0, 0, 0, H * 0.34);
      cg.addColorStop(0, 'rgba(40,20,80,' + (0.75 * fa).toFixed(3) + ')');
      cg.addColorStop(1, 'rgba(40,20,80,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H * 0.34);
      var flashK = 0.5 + 0.5 * Math.sin(tGlobal * 37) * Math.sin(tGlobal * 13);
      for (var cb = 0; cb < 7; cb++) {
        var cx0 = ((cb * 0.17 + tGlobal * 0.03 * (cb % 2 ? 1 : -1)) % 1 + 1) % 1 * (W + 120) - 60;
        var cy0 = H * (0.03 + (cb % 3) * 0.05), cr = 60 + (cb % 4) * 18;
        var cgr = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, cr);
        cgr.addColorStop(0, 'rgba(70,40,130,' + (0.5 * fa).toFixed(3) + ')');
        cgr.addColorStop(1, 'rgba(50,25,100,0)');
        ctx.fillStyle = cgr;
        ctx.beginPath(); ctx.arc(cx0, cy0, cr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (var cf = 0; cf < 3; cf++) {
        var fx0 = ((cf * 0.37 + Math.floor(tGlobal * 6) * 0.29) % 1) * W;
        ctx.globalAlpha = fa * flashK * 0.6;
        softGlow(fx0, H * 0.06, 70, '#b38cff', 0.5);
      }
      // 全屏片状闪电：整屏随机位置的云内闪光 + 偶发全屏紫白闪
      for (var sf = 0; sf < 4; sf++) {
        var sseed = Math.floor(tGlobal * 9) * 7 + sf * 13;
        var sx0 = ((sseed * 0.618) % 1) * W, sy0 = top0Of() + ((sseed * 0.371) % 1) * (H - top0Of());
        ctx.globalAlpha = fa * (0.3 + 0.4 * flashK);
        softGlow(sx0, sy0, 90 + rk * 10, '#9b7bff', 0.35);
      }
      ctx.globalAlpha = fa * Math.max(0, flashK - 0.6) * 0.5;
      ctx.fillStyle = 'rgba(200,180,255,.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (u.kind === 'swift') {
      // 蜂群：中心光晕 + 旋转放射光 + 扩散冲击环 + 螺旋蜂群（带拖尾和字母蜂）+ 满屏金闪
      var sp2 = state.player, Rr = Math.sqrt(W * W + H * H);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // ① 中心光晕（呼吸）
      var haloR = 90 + rk * 26 + Math.sin(tGlobal * 6) * 10;
      var halo = ctx.createRadialGradient(sp2.x, sp2.y, 0, sp2.x, sp2.y, haloR);
      halo.addColorStop(0, 'rgba(255,244,190,' + (0.36 * fa).toFixed(3) + ')');
      halo.addColorStop(0.4, 'rgba(255,206,60,' + (0.2 * fa).toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(255,180,30,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(sp2.x, sp2.y, haloR, 0, 6.2832); ctx.fill();

      // ② 旋转放射光：宽窄交替 + 亮度脉动，做出"龙卷"的层次
      var rays2 = 16 + rk * 2;
      for (var ray = 0; ray < rays2; ray++) {
        var ra = ray / rays2 * Math.PI * 2 + tGlobal * 0.9;
        var pulse2 = 0.55 + 0.45 * Math.sin(tGlobal * 7 + ray * 1.7);
        var rg3 = ctx.createLinearGradient(sp2.x, sp2.y, sp2.x + Math.cos(ra) * Rr, sp2.y + Math.sin(ra) * Rr);
        rg3.addColorStop(0, 'rgba(255,228,120,' + (0.34 * fa * pulse2).toFixed(3) + ')');
        rg3.addColorStop(0.55, 'rgba(255,196,50,' + (0.12 * fa * pulse2).toFixed(3) + ')');
        rg3.addColorStop(1, 'rgba(255,180,30,0)');
        ctx.strokeStyle = rg3;
        ctx.lineWidth = (ray % 3 === 0 ? 14 : 5) + (ray % 2) * 4;
        ctx.beginPath(); ctx.moveTo(sp2.x, sp2.y); ctx.lineTo(sp2.x + Math.cos(ra) * Rr, sp2.y + Math.sin(ra) * Rr); ctx.stroke();
      }

      // ③ 一圈圈向外扩散的冲击光环
      var ringMax = Math.min(W, H) * 0.62;
      for (var rn2 = 0; rn2 < 3; rn2++) {
        var rr3 = (tGlobal * 340 + rn2 * ringMax * 0.33) % ringMax;
        ctx.globalAlpha = fa * (1 - rr3 / ringMax) * 0.5;
        ctx.strokeStyle = '#ffe9a0';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(sp2.x, sp2.y, rr3, 0, 6.2832); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ④ 螺旋蜂群：一圈圈绕机体盘旋，带拖尾；部分节点是字母蜂
      var bees = 30 + rk * 5, beeMax = Math.min(W, H) * 0.55;
      for (var bi = 0; bi < bees; bi++) {
        var seed = (bi * 0.6180339887) % 1;
        var ang2 = seed * Math.PI * 2 + tGlobal * (1.5 + (bi % 5) * 0.22) * (bi % 2 ? 1 : -1);
        var rad2 = 40 + ((seed * 7.3) % 1) * 44 + ((tGlobal * 150 + bi * 37) % beeMax);
        var bx2 = sp2.x + Math.cos(ang2) * rad2, by2 = sp2.y + Math.sin(ang2) * rad2 * 0.92;
        ctx.strokeStyle = 'rgba(255,226,120,' + (0.5 * fa).toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx2, by2);
        ctx.lineTo(bx2 - Math.cos(ang2) * 12, by2 - Math.sin(ang2) * 12);
        ctx.stroke();
        ctx.fillStyle = bi % 3 ? '#ffe58a' : '#fff6cf';
        ctx.beginPath(); ctx.arc(bx2, by2, 1.6 + (bi % 3) * 0.7, 0, 6.2832); ctx.fill();
        if (bi % 6 === 0 && c.ammo.length) {
          drawLetterAt(c.ammo[((bi / 6) | 0) % c.ammo.length], bx2, by2, 15 + rk * 0.8, rankColor(bi), 'rgba(40,24,0,.8)', ang2 + Math.PI / 2);
        }
      }

      // ⑤ 满屏闪烁星点
      for (var gl = 0; gl < 26 + rk * 4; gl++) {
        var gx2 = (gl * 73.1) % W, gy2 = (gl * 131.7 + tGlobal * 40) % H;
        ctx.globalAlpha = fa * (0.5 + 0.5 * Math.sin(tGlobal * 9 + gl));
        ctx.save(); ctx.translate(gx2, gy2); star4(2 + (gl % 3), '#ffe58a'); ctx.restore();
      }
      ctx.restore();
    }
    if (u.kind === 'blast') {
      // 流星雨：整屏火光天幕 + 满屏飘落的余烬
      ctx.save();
      var sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, 'rgba(255,110,40,' + (0.3 * fa).toFixed(3) + ')');
      sky.addColorStop(0.5, 'rgba(180,50,20,' + (0.12 * fa).toFixed(3) + ')');
      sky.addColorStop(1, 'rgba(255,140,60,' + (0.22 * fa).toFixed(3) + ')');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (var em = 0; em < 30 + rk * 6; em++) {
        var ex0 = (em * 61.7 + Math.sin(tGlobal + em) * 20) % W, ey0 = (em * 97 + tGlobal * (120 + (em % 5) * 40)) % H;
        ctx.globalAlpha = fa * (0.4 + (em % 3) * 0.2);
        ctx.fillStyle = em % 2 ? '#ffb347' : '#ff7a3d';
        ctx.beginPath(); ctx.arc(ex0, ey0, 1 + (em % 3) * 0.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    if (u.kind === 'tide') {
      // 海啸：整面浪墙从底部推到顶部 —— 深海蓝水体、青色浪身、只有浪尖是白色泡沫；身后留下退潮水色
      ctx.save();
      var tint = ctx.createLinearGradient(0, 0, 0, H);
      tint.addColorStop(0, 'rgba(20,80,140,' + (0.18 * fa).toFixed(3) + ')');
      tint.addColorStop(1, 'rgba(10,50,110,' + (0.3 * fa).toFixed(3) + ')');
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      if (u.wy != null) {
        var crest = u.wy, wavePath = function (yo, amp, ph) {
          ctx.beginPath();
          ctx.moveTo(-10, H + 10);
          for (var wx = -10; wx <= W + 10; wx += 8) ctx.lineTo(wx, crest + yo + Math.sin(wx * 0.035 + ph) * amp + Math.sin(wx * 0.11 + ph * 1.7) * amp * 0.35);
          ctx.lineTo(W + 10, H + 10);
          ctx.closePath();
        };
        // 浪身：后层深蓝、前层青蓝，高度差做出层次
        var body = ctx.createLinearGradient(0, crest - 20, 0, Math.min(H, crest + H * 0.6));
        body.addColorStop(0, 'rgba(79,214,232,.75)');
        body.addColorStop(0.25, 'rgba(32,150,210,.6)');
        body.addColorStop(1, 'rgba(12,60,130,.35)');
        wavePath(-12, 14, tGlobal * 5);
        ctx.fillStyle = 'rgba(20,90,170,.45)';
        ctx.fill();
        wavePath(0, 10, tGlobal * 7 + 1.3);
        ctx.fillStyle = body;
        ctx.fill();
        // 浪尖泡沫：只有顶上一条白，带断续的泡沫团
        ctx.strokeStyle = 'rgba(240,252,255,.9)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (var fx1 = -10; fx1 <= W + 10; fx1 += 8) {
          var fy1 = crest + Math.sin(fx1 * 0.035 + tGlobal * 7 + 1.3) * 10 + Math.sin(fx1 * 0.11 + (tGlobal * 7 + 1.3) * 1.7) * 3.5;
          if (fx1 === -10) ctx.moveTo(fx1, fy1); else ctx.lineTo(fx1, fy1);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(235,250,255,.85)';
        for (var fb = 0; fb < 14 + rk * 2; fb++) {
          var bxp = (fb * 47.3 + tGlobal * 30) % W, byp = crest + Math.sin(bxp * 0.035 + tGlobal * 7 + 1.3) * 10 - 2;
          ctx.beginPath(); ctx.arc(bxp, byp, 2 + (fb % 3), 0, Math.PI * 2); ctx.fill();
        }
        // 浪身里的反光条纹
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(127,230,255,.25)';
        ctx.lineWidth = 1.5;
        for (var rl = 1; rl <= 4; rl++) {
          ctx.beginPath();
          for (var rx = -10; rx <= W + 10; rx += 12) {
            var ry = crest + rl * 28 + Math.sin(rx * 0.05 + tGlobal * 4 + rl) * 5;
            if (rx === -10) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    if (u.kind === 'blade') {
      // 千刃轮：机体上方一枚半透明巨型刀轮 + 全屏放射刀光
      var bcol = kindColor('blade'), pu2 = state.player;
      var grow = clamp(u.t / 0.45, 0, 1), Rg = (W * 0.22 + c.rank * 6) * (0.4 + 0.6 * grow);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var Rr2 = Math.sqrt(W * W + H * H);
      for (var ry = 0; ry < 12; ry++) {
        var ra2 = ry / 12 * Math.PI * 2 - tGlobal * 2.4;
        var rg4 = ctx.createLinearGradient(pu2.x, pu2.y, pu2.x + Math.cos(ra2) * Rr2, pu2.y + Math.sin(ra2) * Rr2);
        rg4.addColorStop(0, hexA(bcol, 0.3 * fa));
        rg4.addColorStop(1, hexA(bcol, 0));
        ctx.strokeStyle = rg4;
        ctx.lineWidth = 3 + (ry % 2) * 5;
        ctx.beginPath(); ctx.moveTo(pu2.x, pu2.y); ctx.lineTo(pu2.x + Math.cos(ra2) * Rr2, pu2.y + Math.sin(ra2) * Rr2); ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.translate(pu2.x, pu2.y);
      ctx.globalAlpha = 0.55 * fa;
      drawBlade(6, bcol, { r: Rg, r0: Rg, spin: tGlobal * 9, blv: 7 });
      ctx.restore();
    }
  }

  // 一道月牙刀光（刃口在弧外，尾端收成尖）
  function drawSlash(cx, cy, ang, len, wid, col, al, mirror) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    if (mirror) ctx.scale(-1, 1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = al;
    var g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
    g.addColorStop(0, hexA(col, 0));
    g.addColorStop(0.35, hexA(col, 0.14));
    g.addColorStop(0.72, hexA(col, 0.5));
    g.addColorStop(1, 'rgba(255,255,255,.95)');
    ctx.fillStyle = g;
    ctx.shadowColor = hexA(col, 0.95);
    ctx.shadowBlur = wid * 0.9;
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.quadraticCurveTo(0, -wid * 1.7, len / 2, 0);
    ctx.quadraticCurveTo(0, wid * 0.16, -len / 2, 0);
    ctx.closePath();
    ctx.fill();
    // 白色刃芯
    ctx.shadowBlur = wid * 0.4;
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = Math.max(1, wid * 0.17);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-len * 0.44, -wid * 0.02);
    ctx.quadraticCurveTo(0, -wid * 1.48, len * 0.5, 0);
    ctx.stroke();
    // 尾部残影细丝
    ctx.shadowBlur = 0;
    ctx.globalAlpha = al * 0.45;
    ctx.strokeStyle = hexA(col, 0.85);
    ctx.lineWidth = 1;
    for (var s = 1; s <= 3; s++) {
      ctx.beginPath();
      ctx.moveTo(-len * 0.46 + s * 12, 0);
      ctx.quadraticCurveTo(0, -wid * (1.7 - s * 0.4), len * 0.44 - s * 10, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawUltOver() {
    var u = state.ult;
    if (state.frozen) drawFrost(u);
    if (u && u.t < 1.35) drawUltCutin(u);
  }
  // 大招切入横幅：斜向色带从左滑入、停顿、向右滑出；品阶越高边线越华丽（UR 金边，EX 流光）
  function drawUltCutin(u) {
    var c = state.card, rk = c.rank, t = u.t, tint = ultTint(u.kind);
    var inK = clamp(t / 0.24, 0, 1), outK = clamp((t - 1.02) / 0.33, 0, 1);
    var ease = function (x) { return 1 - Math.pow(1 - x, 3); };
    var off = (1 - ease(inK)) * -W * 1.2 + ease(outK) * W * 1.2;
    var cy = H * 0.36, bh = 54 + rk * 4;
    ctx.save();
    ctx.translate(W / 2 + off, cy);
    ctx.rotate(-0.1);
    var g = ctx.createLinearGradient(-W, 0, W, 0);
    g.addColorStop(0, 'rgba(' + tint + ',0)');
    g.addColorStop(0.25, 'rgba(' + tint + ',.55)');
    g.addColorStop(0.5, 'rgba(20,10,30,.82)');
    g.addColorStop(0.75, 'rgba(' + tint + ',.55)');
    g.addColorStop(1, 'rgba(' + tint + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(-W, -bh / 2, W * 2, bh);
    var edge = rk >= 6 ? 'hsl(' + ((tGlobal * 300) % 360) + ',100%,70%)' : rk >= 5 ? '#ffd36b' : 'rgba(' + tint + ',1)';
    ctx.fillStyle = edge;
    ctx.fillRect(-W, -bh / 2 - 2, W * 2, 2 + (rk >= 5 ? 1 : 0));
    ctx.fillRect(-W, bh / 2, W * 2, 2 + (rk >= 5 ? 1 : 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 6 + rk; i++) {
      var sx = ((i * 97 + tGlobal * 1400) % (W * 2)) - W, sy = ((i * 37) % bh) - bh / 2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 40 + (i % 3) * 20, sy); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 ' + (22 + rk) + 'px "PingFang SC", sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10,4,20,.9)';
    ctx.strokeText(ULT_FULL[u.kind] || '大招', 0, -8);
    ctx.fillStyle = '#fffaf0';
    ctx.fillText(ULT_FULL[u.kind] || '大招', 0, -8);
    ctx.font = 'italic 700 12px Georgia, serif';
    ctx.fillStyle = edge;
    spacedText(String(c.word.w || '').toUpperCase() + '  ·  ' + (c.fx.tag || ''), 0, 16, 3);
    ctx.restore();
  }
  // 时间冻结：冰霜暗角 + 雪花 + 中央倒计时冰环
  function drawFrost(u) {
    var k = u ? clamp(u.t / 0.3, 0, 1) : 1, rk = state.card.rank;
    ctx.save();
    // 冷色调 + 暗角，先压出"寒气"而不是直接刷白
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.78);
    vg.addColorStop(0, 'rgba(120,180,255,' + (0.05 * k).toFixed(3) + ')');
    vg.addColorStop(0.55, 'rgba(110,170,255,' + (0.16 * k).toFixed(3) + ')');
    vg.addColorStop(1, 'rgba(180,230,255,' + (0.5 * k).toFixed(3) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // 四角冰壳：多边形碎冰 + 内部渐变，不再用细线画雪花
    [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]].forEach(function (cn) {
      var reach = 86 + rk * 10;
      ctx.save();
      ctx.translate(cn[0], cn[1]);
      ctx.scale(cn[2], cn[3]);
      var ig = ctx.createLinearGradient(0, 0, reach, reach);
      ig.addColorStop(0, 'rgba(235,250,255,' + (0.55 * k).toFixed(3) + ')');
      ig.addColorStop(0.55, 'rgba(170,225,255,' + (0.2 * k).toFixed(3) + ')');
      ig.addColorStop(1, 'rgba(150,210,255,0)');
      ctx.fillStyle = ig;
      var pts = [[0, 0], [reach * 0.52, 0], [reach * 0.34, reach * 0.24], [reach * 0.66, reach * 0.36],
        [reach * 0.3, reach * 0.52], [reach * 0.38, reach * 0.78], [0, reach * 0.6]];
      ctx.beginPath();
      pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(245,253,255,' + (0.6 * k).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // 冰面高光
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * k).toFixed(3) + ')';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(reach * 0.1, reach * 0.1); ctx.lineTo(reach * 0.44, reach * 0.16); ctx.stroke();
      ctx.restore();
    });

    // 冰裂纹：从四角与边缘向屏内延伸的霜裂
    if (k > 0.4) {
      ctx.save();
      ctx.strokeStyle = 'rgba(240,253,255,' + (0.42 * k).toFixed(3) + ')';
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      var crSeed = 1234;
      function crr() { crSeed = (crSeed * 1103515245 + 12345) & 0x7fffffff; return crSeed / 0x7fffffff; }
      for (var ci2 = 0; ci2 < 9; ci2++) {
        var ex = ci2 < 3 ? 0 : ci2 < 6 ? W : crr() * W;
        var ey = ci2 < 3 ? crr() * H * 0.7 : ci2 < 6 ? crr() * H * 0.7 : (ci2 % 2 ? 0 : H);
        var ang = Math.atan2(H * 0.5 - ey, W * 0.5 - ex) + (crr() - 0.5) * 0.7;
        var len = (70 + crr() * 120) * k;
        var cx2 = ex, cy2 = ey, a2 = ang;
        ctx.beginPath(); ctx.moveTo(cx2, cy2);
        for (var seg = 0; seg < 4; seg++) {
          var sl = len / 4;
          a2 += (crr() - 0.5) * 0.55;
          cx2 += Math.cos(a2) * sl; cy2 += Math.sin(a2) * sl;
          ctx.lineTo(cx2, cy2);
          if (seg === 1) {
            ctx.moveTo(cx2, cy2);
            ctx.lineTo(cx2 + Math.cos(a2 + 0.9) * sl * 0.7, cy2 + Math.sin(a2 + 0.9) * sl * 0.7);
            ctx.moveTo(cx2, cy2);
          }
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // 飘雪：圆形柔光，大小/速度随机感
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var s = 0; s < 34 + rk * 5; s++) {
      var sx = (s * 53.7) % W + Math.sin(tGlobal * 0.8 + s) * 9;
      var sy = (s * 91 + tGlobal * (20 + (s % 5) * 7)) % H;
      var sr = 0.9 + (s % 4) * 0.5;
      ctx.globalAlpha = 0.5 + (s % 3) * 0.16;
      ctx.fillStyle = '#f2fbff';
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    if (u) {
      var cx = W / 2, cy = H * 0.42, r = 42 + rk * 2, left = 1 - u.t / u.dur;
      // 外圈寒气
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var rg2 = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.9);
      rg2.addColorStop(0, 'rgba(180,235,255,' + (0.28 * k).toFixed(3) + ')');
      rg2.addColorStop(1, 'rgba(120,190,255,0)');
      ctx.fillStyle = rg2;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // 进度环：底环 + 渐变进度 + 端点光球
      ctx.globalAlpha = 0.95 * k;
      ctx.strokeStyle = 'rgba(200,240,255,.22)';
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      var pg = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      pg.addColorStop(0, '#7fd6ff');
      pg.addColorStop(0.5, '#d9f6ff');
      pg.addColorStop(1, '#9be8ff');
      ctx.strokeStyle = pg;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      var endA = -Math.PI / 2 + left * Math.PI * 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, endA); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(endA) * r, cy + Math.sin(endA) * r, 3.4, 0, Math.PI * 2);
      ctx.fill();

      // 六棱雪花：粗线 + 分支 + 柔光，替代细笔画
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tGlobal * 0.45);
      ctx.globalCompositeOperation = 'lighter';
      for (var i2 = 0; i2 < 6; i2++) {
        var a2 = i2 * Math.PI / 3, R2 = r * 0.62;
        var lg = ctx.createLinearGradient(0, 0, Math.cos(a2) * R2, Math.sin(a2) * R2);
        lg.addColorStop(0, 'rgba(255,255,255,.2)');
        lg.addColorStop(1, 'rgba(235,251,255,.95)');
        ctx.strokeStyle = lg;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a2) * R2, Math.sin(a2) * R2); ctx.stroke();
        var mx2 = Math.cos(a2) * R2 * 0.62, my2 = Math.sin(a2) * R2 * 0.62;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mx2, my2); ctx.lineTo(mx2 + Math.cos(a2 + 0.9) * 9, my2 + Math.sin(a2 + 0.9) * 9);
        ctx.moveTo(mx2, my2); ctx.lineTo(mx2 + Math.cos(a2 - 0.9) * 9, my2 + Math.sin(a2 - 0.9) * 9);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.beginPath(); ctx.arc(Math.cos(a2) * R2, Math.sin(a2) * R2, 1.7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawAwakenEdge() {
    var a = clamp(state.awaken / 1, 0, 1) * (0.55 + Math.sin(tGlobal * 8) * 0.2);
    var col = state.card.rank >= 6 ? 'hsla(' + ((tGlobal * 200) % 360) + ',100%,65%,' : 'rgba(' + hexRgb(state.card.ink) + ',';
    var g = ctx.createLinearGradient(0, 0, 18, 0);
    g.addColorStop(0, col + (0.6 * a).toFixed(2) + ')'); g.addColorStop(1, col + '0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 18, H);
    var g2 = ctx.createLinearGradient(W, 0, W - 18, 0);
    g2.addColorStop(0, col + (0.6 * a).toFixed(2) + ')'); g2.addColorStop(1, col + '0)');
    ctx.fillStyle = g2; ctx.fillRect(W - 18, 0, 18, H);
  }
  function hexRgb(hex) {
    var h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  /* ── 画布 HUD：进度 / 首领血条 / 拼词格 / 生命 / 火力 / 武器 ── */
  // 毛玻璃面板：深色半透明底 + 顶部高光 + 细描边
  function hudPanel(x, y, w, h, r, edge) {
    ctx.save();
    roundRect(x, y, w, h, r);
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(28,22,44,.72)');
    g.addColorStop(1, 'rgba(10,8,20,.78)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = edge || 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r, y + 1); ctx.lineTo(x + w - r, y + 1);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.stroke();
    ctx.restore();
  }
  function hudText(txt, x, y, font, fill, align) {
    ctx.font = font;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8,6,16,.85)';
    ctx.strokeText(txt, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(txt, x, y);
  }
  function drawHud() {
    var x0 = 12;
    var c1h = (state.region && state.region.c1) || '#ffd36b';

    // 顶部关卡进度：细线 + 前端亮点
    var pr = clamp(state.t / BOSS_AT, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(0, 0, W, 3);
    var pg0 = ctx.createLinearGradient(0, 0, W, 0);
    pg0.addColorStop(0, hexA(c1h, 0.25));
    pg0.addColorStop(1, hexA(c1h, 0.95));
    ctx.fillStyle = pg0;
    ctx.fillRect(0, 0, W * pr, 3);
    if (pr > 0 && pr < 1) softGlow(W * pr, 1.5, 7, c1h, 0.9);

    // 第二行：平时显示关卡信息；首领出场后换成紧凑血条（不再横贯全屏）
    var hasBoss = state.boss && !state.boss.dead;
    var ry = hudTop - 20;
    if (hasBoss) {
      var b = state.boss, pb = clamp(b.hp / b.maxHp, 0, 1);
      b.hpLag = b.hpLag == null ? pb : Math.max(pb, b.hpLag - 0.35 * (1 / 60));
      var bbw = Math.min(240, W - hudSide * 2), bx = W / 2 - bbw / 2, bh = 6, by = ry + 11;
      hudText(b.name, bx, ry + 5, '800 10px "PingFang SC", sans-serif', '#ffd9cc');
      hudText(Math.ceil(pb * 100) + '%', bx + bbw, ry + 5, '800 9.5px "SF Mono", Menlo, monospace', '#ffb3a8', 'right');
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      roundRect(bx - 1, by - 1, bbw + 2, bh + 2, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,140,130,.45)'; ctx.lineWidth = 1;
      roundRect(bx - 1, by - 1, bbw + 2, bh + 2, 4); ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,220,.75)';
      roundRect(bx, by, Math.max(4, bbw * b.hpLag), bh, 3); ctx.fill();
      var g = ctx.createLinearGradient(0, by, 0, by + bh);
      g.addColorStop(0, '#ff8a7a'); g.addColorStop(0.5, '#ff3d5a'); g.addColorStop(1, '#b3122f');
      ctx.fillStyle = g;
      roundRect(bx, by, Math.max(4, bbw * pb), bh, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(bx + 2, by + 1, Math.max(0, bbw * pb - 4), 1);
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      for (var tk = 1; tk < 10; tk++) ctx.fillRect(bx + bbw * tk / 10, by + 1, 1, bh - 2);
    } else {
      var cap = regionPlace() + '  ' + (state.stage + 1) + '/5' + (state.theme && state.theme.title ? '  ·  ' + state.theme.title : '');
      hudText(cap, W / 2, ry + 9, '600 10.5px "PingFang SC", sans-serif', 'rgba(255,243,220,.5)', 'center');
    }

    // 拼词格：与返回 / 暂停按钮同一行居中；已拼亮色、当前格呼吸描边
    var n = spellLen(), gap = 3, tw = Math.max(11, Math.min(22, (W - hudSide * 2 - 16) / n - gap));
    var total = n * (tw + gap) - gap, sx = W / 2 - total / 2, ink = state.card.ink;
    var sy = hudRowY - (tw + 4) / 2;
    hudPanel(sx - 8, sy - 5, total + 16, tw + 14, 9);
    // 觉醒：整块拼词面板当作进度条，从左往右随剩余时间退去
    var ak = 0;
    if (state.awaken > 0) {
      ak = clamp(state.awaken / (state.awakenMax || 8), 0, 1);
      var pw2 = (total + 16) * ak, px1 = sx - 8, py1 = sy - 5, ph1 = tw + 14;
      ctx.save();
      roundRect(px1, py1, total + 16, ph1, 9); ctx.clip();
      var ag = ctx.createLinearGradient(px1, 0, px1 + Math.max(4, pw2), 0);
      ag.addColorStop(0, hexA(ink, 0.16));
      ag.addColorStop(0.72, hexA(ink, 0.3));
      ag.addColorStop(1, hexA(ink, 0.5));
      ctx.fillStyle = ag;
      ctx.fillRect(px1, py1, pw2, ph1);
      // 前沿亮线 + 内侧光晕
      if (pw2 > 3) {
        ctx.fillStyle = hexA(ink, 0.75 + Math.sin(tGlobal * 9) * 0.25);
        ctx.fillRect(px1 + pw2 - 1.6, py1 + 1, 1.6, ph1 - 2);
        softGlow(px1 + pw2 - 1, py1 + ph1 / 2, 12, ink, 0.32);
      }
      ctx.restore();
      // 面板边框随觉醒呼吸
      ctx.strokeStyle = hexA(ink, 0.45 + Math.sin(tGlobal * 7) * 0.3);
      ctx.lineWidth = 1.2;
      roundRect(sx - 8, sy - 5, total + 16, tw + 14, 9); ctx.stroke();
    }
    for (var i = 0; i < n; i++) {
      var xx = sx + i * (tw + gap), done = i < state.spell, next = i === state.spell;
      roundRect(xx, sy, tw, tw + 4, 4);
      if (done) {
        var tg = ctx.createLinearGradient(0, sy, 0, sy + tw + 4);
        tg.addColorStop(0, tintHex(ink, 0.35)); tg.addColorStop(1, ink);
        ctx.fillStyle = tg;
      } else ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.fill();
      ctx.lineWidth = next ? 1.6 : 1;
      ctx.strokeStyle = next ? hexA(ink, 0.55 + Math.sin(tGlobal * 8) * 0.4) : done ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.12)';
      ctx.stroke();
      if (done || next) {
        ctx.fillStyle = done ? '#1b1420' : 'rgba(255,248,230,.45)';
        ctx.font = '700 ' + Math.round(tw * 0.62) + 'px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(spellChar(i), xx + tw / 2, sy + (tw + 4) / 2 + 0.5);
      }
    }
    if (state.spellFlash > 0) {
      ctx.globalAlpha = state.spellFlash / 0.3;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      roundRect(sx - 6, sy - 6, total + 12, tw + 16, 8); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 左下状态：无底板，生命心形浮在上、火力条贴底下 —— 和大招钮区分开
    var c = state.card, maxP = c.fx.maxP, awk = state.awaken > 0;
    var px0 = x0 + 4, py0 = H - hudBot + 18;
    // 生命 / 护盾
    for (var h = 0; h < MAX_HP; h++) drawHeart(px0 + 10 + h * 18, py0, h < state.hp);
    for (var s2 = 0; s2 < state.shield; s2++) drawShieldIcon(px0 + 10 + (MAX_HP + s2) * 18, py0);
    // 火力：细长能量条 + 分段
    var barW = Math.max(72, maxP * 14 + 8), bx = px0 + 2, by = py0 + 14;
    roundRect(bx, by, barW, 10, 5);
    ctx.fillStyle = 'rgba(8, 6, 16, .55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 210, 120, .22)';
    ctx.lineWidth = 1;
    roundRect(bx, by, barW, 10, 5); ctx.stroke();
    var fillW = Math.max(0, (barW - 4) * Math.min(1, state.power / Math.max(1, maxP)));
    if (fillW > 0) {
      roundRect(bx + 2, by + 2, fillW, 6, 3);
      var pg = ctx.createLinearGradient(bx, by, bx + barW, by);
      if (awk) { pg.addColorStop(0, '#fff3c0'); pg.addColorStop(1, '#ffb020'); }
      else { pg.addColorStop(0, '#ffd27a'); pg.addColorStop(0.55, '#ff9a3c'); pg.addColorStop(1, '#ff6a2f'); }
      ctx.fillStyle = pg; ctx.fill();
    }
    // 分段刻度
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    for (var k = 1; k < maxP; k++) {
      var tx = bx + 2 + (barW - 4) * k / maxP;
      ctx.fillRect(tx - 0.5, by + 2, 1, 6);
    }
    hudText(awk ? '觉醒' : (c.fx.tag || '火力'), bx + barW + 8, by + 5,
      '800 10px "PingFang SC", sans-serif', awk ? '#ffe08a' : 'rgba(255,243,220,.55)');
  }
  function drawShieldIcon(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(6, -4.5); ctx.lineTo(5.2, 2); ctx.quadraticCurveTo(3, 5.5, 0, 7);
    ctx.quadraticCurveTo(-3, 5.5, -5.2, 2); ctx.lineTo(-6, -4.5); ctx.closePath();
    var g = ctx.createLinearGradient(0, -7, 0, 7);
    g.addColorStop(0, '#b8f6ff'); g.addColorStop(1, '#2fb6d8');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(8,30,50,.8)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillRect(-3, -4.5, 2, 4);
    ctx.restore();
  }

  function drawHeart(x, y, on) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.05, 1.05);
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-10, -1, -6, -9, 0, -3.5);
    ctx.bezierCurveTo(6, -9, 10, -1, 0, 6);
    if (on) {
      var g = ctx.createLinearGradient(0, -8, 0, 6);
      g.addColorStop(0, '#ff9aa8'); g.addColorStop(0.5, '#ff4d6d'); g.addColorStop(1, '#c41d45');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(40,6,16,.85)'; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.ellipse(-3.2, -3, 1.8, 1.1, -0.6, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }

  function drawWordShow() {
    if (state.wordShow <= 0 || state.codexPop) return;
    var t = state.wordShow, a = clamp(Math.min(t / 0.3, (1.4 - t) / 0.15), 0, 1);
    var w = state.card.word, cy = H * 0.5;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(12,9,18,.78)';
    roundRect(W / 2 - 110, cy - 34, 220, 78, 10); ctx.fill();
    ctx.strokeStyle = hexA(state.card.ink, 0.7);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = state.card.ink;
    ctx.font = '700 26px Georgia, serif';
    ctx.fillText(String(w.w || ''), W / 2, cy - 8);
    ctx.fillStyle = 'rgba(255,248,230,.65)';
    ctx.font = '12px Georgia, serif';
    ctx.fillText(w.ph || '', W / 2, cy + 14);
    ctx.fillStyle = '#fff3dc';
    ctx.font = '600 13px "PingFang SC", sans-serif';
    ctx.fillText((w.pos ? w.pos + ' ' : '') + (w.cn || ''), W / 2, cy + 32);
    ctx.globalAlpha = 1;
  }

  // 大招 / 觉醒横幅：斜切色带 + 大字
  function drawBanner() {
    var b = state.banner;
    if (!b) return;
    var t = b.t, a = clamp(Math.min(t / 0.25, 1), 0, 1), slide = clamp((1.1 - t) / 0.15, 0, 1);
    var cy = H * 0.3, col = rankColor(0);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate((1 - slide) * -W, 0);
    ctx.fillStyle = 'rgba(8,6,14,.82)';
    ctx.beginPath(); ctx.moveTo(0, cy - 26); ctx.lineTo(W, cy - 34); ctx.lineTo(W, cy + 22); ctx.lineTo(0, cy + 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col;
    ctx.fillRect(0, cy - 30, W, 2);
    ctx.fillRect(0, cy + 26, W, 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 22px "PingFang SC", sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.strokeText(b.text, W / 2, cy - 6);
    ctx.fillStyle = col;
    ctx.fillText(b.text, W / 2, cy - 6);
    ctx.font = '700 11px Georgia, "PingFang SC", serif';
    ctx.fillStyle = 'rgba(255,248,230,.8)';
    ctx.fillText(b.sub, W / 2, cy + 14);
    ctx.restore();
  }

  // 逐字等距排字（canvas 不一定支持 letterSpacing）
  function spacedText(text, x, y, sp) {
    var ws = [], tot = 0;
    for (var i = 0; i < text.length; i++) { ws.push(ctx.measureText(text[i]).width); tot += ws[i]; }
    tot += sp * (text.length - 1);
    var cx = x - tot / 2;
    ctx.textAlign = 'left';
    for (var j = 0; j < text.length; j++) { ctx.fillText(text[j], cx, y); cx += ws[j] + sp; }
    ctx.textAlign = 'center';
  }
  // 首领警告：红色呼吸暗角 + 横向展开的警示横幅（上下危险斜纹滚动）+ 故障抖动大字 + 顶部下指箭头
  var WARN_T = 2.4;
  function drawWarn() {
    var t = state.warnT, k = 1 - t / WARN_T;
    var open = clamp(k / 0.1, 0, 1), close = clamp(t / 0.3, 0, 1), s = Math.min(open, close);
    var e = 1 - Math.pow(1 - s, 3);
    var pulse = 0.5 + 0.5 * Math.sin(tGlobal * 10);
    var cy = H * 0.38, bh = 58, bw = W * e;
    ctx.save();

    // ① 红色暗角
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(255,30,60,0)');
    vg.addColorStop(1, 'rgba(255,30,60,' + ((0.18 + pulse * 0.22) * s).toFixed(3) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // ② 横幅底板
    ctx.globalAlpha = s;
    var bg = ctx.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2);
    bg.addColorStop(0, 'rgba(40,4,12,.55)');
    bg.addColorStop(0.5, 'rgba(70,6,20,.82)');
    bg.addColorStop(1, 'rgba(40,4,12,.55)');
    ctx.fillStyle = bg;
    ctx.fillRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);

    // ③ 上下危险斜纹带（反向滚动）
    [cy - bh / 2 - 9, cy + bh / 2 + 1].forEach(function (y0, bi) {
      ctx.save();
      ctx.beginPath(); ctx.rect(W / 2 - bw / 2, y0, bw, 8); ctx.clip();
      ctx.fillStyle = 'rgba(20,2,6,.85)';
      ctx.fillRect(W / 2 - bw / 2, y0, bw, 8);
      ctx.fillStyle = 'rgba(255,70,90,.9)';
      var off = ((tGlobal * 60 * (bi ? -1 : 1)) % 16 + 16) % 16;
      ctx.beginPath();
      for (var x = -16 + off; x < W + 16; x += 16) {
        ctx.moveTo(x, y0 + 8); ctx.lineTo(x + 8, y0); ctx.lineTo(x + 14, y0); ctx.lineTo(x + 6, y0 + 8);
      }
      ctx.fill();
      ctx.restore();
    });
    // 横幅边线（发光）
    ctx.shadowColor = '#ff3b5c';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(255,110,130,.95)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - bw / 2, cy - bh / 2 - 10); ctx.lineTo(W / 2 + bw / 2, cy - bh / 2 - 10);
    ctx.moveTo(W / 2 - bw / 2, cy + bh / 2 + 10); ctx.lineTo(W / 2 + bw / 2, cy + bh / 2 + 10);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ④ 大字：先出红 / 青错位残影，再落定；带呼吸辉光
    if (e > 0.6) {
      var ta = clamp((e - 0.6) / 0.4, 0, 1);
      var glitch = k < 0.22 || Math.random() < 0.06;
      ctx.font = 'italic 900 30px Georgia, "Times New Roman", serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      if (glitch) {
        var gx = rnd(2, 5);
        ctx.globalAlpha = ta * 0.7;
        ctx.fillStyle = 'rgba(0,240,255,.8)';
        spacedText('WARNING', W / 2 - gx, cy - 6, 6);
        ctx.fillStyle = 'rgba(255,0,80,.8)';
        spacedText('WARNING', W / 2 + gx, cy - 6, 6);
      }
      ctx.globalAlpha = ta;
      ctx.shadowColor = '#ff2d55';
      ctx.shadowBlur = 12 + pulse * 10;
      var tg = ctx.createLinearGradient(0, cy - 20, 0, cy + 8);
      tg.addColorStop(0, '#ffe3e8');
      tg.addColorStop(0.5, '#ff5c78');
      tg.addColorStop(1, '#c4123a');
      ctx.fillStyle = tg;
      spacedText('WARNING', W / 2, cy - 6, 6);
      ctx.shadowBlur = 0;
      var nm = spriteName(state.theme.boss);
      ctx.font = '700 11px "PingFang SC", sans-serif';
      ctx.fillStyle = 'rgba(255,225,230,.92)';
      spacedText('首领 ' + nm.cn + ' · ' + String(nm.en).toUpperCase() + ' 接近中', W / 2, cy + 17, 1.5);
      // 两侧三角警示标
      [-1, 1].forEach(function (sd) {
        var tx = W / 2 + sd * (W * 0.42), ty = cy - 2;
        ctx.globalAlpha = ta * (0.6 + pulse * 0.4);
        ctx.fillStyle = '#ff4f6d';
        ctx.beginPath(); ctx.moveTo(tx, ty - 11); ctx.lineTo(tx + 11, ty + 8); ctx.lineTo(tx - 11, ty + 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a0610';
        ctx.font = '900 12px Georgia, serif';
        ctx.fillText('!', tx, ty + 2);
      });
    }

    // ⑤ 顶部下指箭头：依次点亮，提示首领从上方来
    ctx.globalAlpha = s;
    for (var c = 0; c < 3; c++) {
      var on = ((tGlobal * 4 - c) % 3 + 3) % 3 < 1;
      var ay = hudTop + 22 + c * 11;
      ctx.strokeStyle = on ? 'rgba(255,90,110,.95)' : 'rgba(255,90,110,.25)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(W / 2 - 12, ay); ctx.lineTo(W / 2, ay + 8); ctx.lineTo(W / 2 + 12, ay); ctx.stroke();
    }
    ctx.restore();
  }

  /* ── 图鉴掉落狂欢：金光 + 旋转光柱 + 卡片弹出 ── */
  function drawCodexPop() {
    var cp = state.codexPop, dur = cp.dur, p = clamp(cp.t / dur, 0, 1);
    var fade = p < 0.1 ? p / 0.1 : p > 0.8 ? (1 - p) / 0.2 : 1;
    var a = clamp(fade, 0, 1);
    var cx = W / 2, cy = H * 0.44;
    var age = cp.t;
    var sc = age < 0.13 ? 0.45 + (age / 0.13) * 0.72
      : age < 0.22 ? 1.17 - (age - 0.13) / 0.09 * 0.17 : 1;

    ctx.save();
    // 全屏金光
    var rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.78);
    rg.addColorStop(0, 'rgba(255,236,180,' + (0.5 * a).toFixed(3) + ')');
    rg.addColorStop(0.42, 'rgba(255,196,96,' + (0.17 * a).toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(255,150,50,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    // 旋转光芒
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cx, cy);
    ctx.rotate(tGlobal * 0.9);
    for (var i = 0; i < 14; i++) {
      ctx.rotate(Math.PI * 2 / 14);
      var len = 150 + Math.sin(tGlobal * 4 + i * 1.7) * 24;
      var gg = ctx.createLinearGradient(0, 0, len, 0);
      gg.addColorStop(0, 'rgba(255,240,190,' + (0.28 * a).toFixed(3) + ')');
      gg.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(len, -13); ctx.lineTo(len, 13); ctx.lineTo(0, 4); ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    var pw = 156, ph = 176;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.globalAlpha = a;
    // 面板
    ctx.shadowColor = 'rgba(255,200,110,.9)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = 'rgba(24,15,32,.97)';
    roundRect(-pw / 2, -ph / 2, pw, ph, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
    var bg = ctx.createLinearGradient(0, -ph / 2, 0, ph / 2);
    bg.addColorStop(0, 'rgba(255,224,150,.22)');
    bg.addColorStop(0.5, 'rgba(255,170,90,.06)');
    bg.addColorStop(1, 'rgba(120,70,180,.16)');
    ctx.fillStyle = bg;
    roundRect(-pw / 2, -ph / 2, pw, ph, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,150,.95)';
    ctx.lineWidth = 2;
    roundRect(-pw / 2, -ph / 2, pw, ph, 14);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    roundRect(-pw / 2 + 5, -ph / 2 + 5, pw - 10, ph - 10, 11);
    ctx.stroke();

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe6a8';
    ctx.font = '800 11px "PingFang SC", sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    ctx.fillText(cp.fresh ? '新 图 鉴' : '图 鉴 + 1', 0, -ph / 2 + 22);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    // 精灵
    if (cp.sprite && global.StageArt) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var sg = ctx.createRadialGradient(0, -14, 0, 0, -14, 46);
      sg.addColorStop(0, 'rgba(255,236,170,.5)');
      sg.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(0, -14, 46, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      var bob = Math.sin(tGlobal * 5) * 3;
      global.StageArt.draw(ctx, cp.sprite, 0, -14 + bob, 62, false);
    }

    // 名字
    ctx.fillStyle = '#fff8ea';
    ctx.font = '800 17px "PingFang SC", sans-serif';
    ctx.fillText(cp.nm.cn || '？？？', 0, 34);
    ctx.fillStyle = 'rgba(255,226,170,.72)';
    ctx.font = 'italic 11px Georgia, serif';
    ctx.fillText(cp.nm.en || '', 0, 52);

    // 星芒点缀
    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < 8; k++) {
      var ang2 = k * 1.7 + tGlobal * 1.6;
      var rr = 62 + Math.sin(tGlobal * 3 + k) * 12;
      var sx = Math.cos(ang2) * rr, sy = Math.sin(ang2) * rr * 0.78;
      var ss = 2 + Math.sin(tGlobal * 8 + k * 2) * 1.6;
      ctx.fillStyle = 'rgba(255,240,190,' + (0.5 + Math.sin(tGlobal * 6 + k) * 0.4).toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(sx, sy - ss); ctx.lineTo(sx + ss * 0.4, sy - ss * 0.4);
      ctx.lineTo(sx + ss, sy); ctx.lineTo(sx + ss * 0.4, sy + ss * 0.4);
      ctx.lineTo(sx, sy + ss); ctx.lineTo(sx - ss * 0.4, sy + ss * 0.4);
      ctx.lineTo(sx - ss, sy); ctx.lineTo(sx - ss * 0.4, sy - ss * 0.4);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ── 漫游页展示台：当前出战卡吃满所有特效（P 满 + 进化 + 觉醒 + 双层护盾），火力以卡牌实际品阶 / 字母等级为准 ── */
  function preview(canvas, word, levels, opts) {
    if (!canvas || !canvas.getContext || !word) return null;
    opts = opts || {};
    if (canvas._raf) { cancelAnimationFrame(canvas._raf); canvas._raf = null; }
    canvas._stop = false;
    var g = canvas.getContext('2d');
    var wk = (global.Card && global.Card.weaponKinds)
      ? global.Card.weaponKinds(word, levels || null)
      : { main: shotKind(word), sub: null, ammo: {} };
    var mainKind = wk.main || 'blast', subKind = wk.sub || null;
    var rank = word.hid ? 6 : clamp(word.tier || 1, 1, 5), fxT = fxFor(rank, levels);
    var lv = Math.min(7, fxT.maxP + 2), subLv = Math.max(1, lv - 2);
    function vtK(k) { return clamp(((wk.ammo && wk.ammo[k]) || 1) + (rank >= 6 ? 1 : 0), 1, 6); }
    var vtMain = vtK(mainKind), vtSub = subKind ? vtK(subKind) : 1;
    var ammo = buildAmmo(word);
    var shots = [], beams = [], arcs = [], orbs = [], timers = { main: 0, sub: 0.05 };
    var tt = 0, last = 0, dprS = 1, cw = 0, ch = 0, tick = 0, orbA = 0;
    var SHIP_S = 1.6;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      cw = Math.max(1, Math.round(rect.width));
      ch = Math.max(1, Math.round(rect.height));
      dprS = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(cw * dprS);
      canvas.height = Math.round(ch * dprS);
    }
    resize();
    canvas._rw = resize;
    canvas._setBottom = function (v) { opts.bottom = v; };

    function shipAt() {
      var gap = opts.bottom != null ? opts.bottom : Math.max(150, ch * 0.24);
      return { x: cw / 2, y: ch - gap };
    }
    function emit(type, x, y, a, sp, vt, extra) {
      var o = { type: type, x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vt: vt, hue: rnd(0, 360), _tr: [], rank: rank };
      if (extra) for (var k in extra) o[k] = extra[k];
      shots.push(o);
    }
    function zap(x, y, v, L) {
      var T = THUNDER_TIER[rank] || THUNDER_TIER[1];
      var pts = [{ x: x, y: y }], cx = x, cy = y, n = Math.min(4 + T.jump, 1 + Math.ceil(L / 2) + T.jump);
      for (var i = 0; i < n; i++) {
        cx = clamp(cx + rnd(-70, 70), 20, cw - 20);
        cy -= rnd(ch * 0.07, ch * 0.12) * (0.8 + T.w * 0.2);
        pts.push({ x: cx, y: cy });
      }
      var life = 0.16 + v * 0.025 + T.w * 0.03;
      arcs.push({ src: pts, amp: 9 + T.w * 3, pts: jagged(pts, 10), life: life, max: life, w: (1.4 + v * 0.35) * T.w, vt: v, br: (v >= 2 || T.node) ? forks(pts, Math.max(v, T.node * 2 + 1)) : null, seed: Math.random(), nodes: T.node ? 1 : 0 });
      for (var s = 0; s < T.sky; s++) {
        var tx = rnd(30, cw - 30), ty = rnd(ch * 0.12, ch * 0.5), bolt = [{ x: tx + rnd(-30, 30), y: 0 }, { x: tx, y: ty }];
        arcs.push({ src: bolt, amp: 16, fv: 4, pts: jagged(bolt, 16), life: 0.22, max: 0.22, w: (1.4 + v * 0.35) * T.w, big: 1, vt: Math.max(4, v), br: forks(bolt, 4), seed: Math.random(), nodes: 1 });
      }
    }
    // 与战斗内 weaponTick 同一套弹幕形态
    function weapon(slot, kind, L, vt, dt) {
      var p = shipAt(), up = -Math.PI / 2, mx = p.x, my = p.y - 14 * SHIP_S, i;
      timers[slot] -= dt;
      if (kind === 'pierce' && slot === 'main') {
        var angs = L >= 7 ? [0, -0.1, 0.1, -0.2, 0.2] : L >= 5 ? [0, -0.12, 0.12] : [0];
        var bw = 3 + Math.min(L, 4) * 1.2;
        angs.forEach(function (da) { beams.push({ x: mx, y: my, a: up + da, w: bw, vt: vt }); });
        return;
      }
      if (kind === 'shield') {
        var cnt = Math.min(6, 1 + L), R = (34 + L * 3) * 1.25 * (slot === 'sub' ? 0.78 : 1);
        for (i = 0; i < cnt; i++) {
          var oa = orbA * (slot === 'sub' ? -1 : 1) + i * Math.PI * 2 / cnt;
          orbs.push({ x: p.x + Math.cos(oa) * R, y: p.y + Math.sin(oa) * R, i: i, li: i + (slot === 'sub' ? 6 : 0), vt: vt, a: oa, cd: 0, sub: slot === 'sub', r: R });
        }
      }
      if (timers[slot] > 0) return;
      if (kind === 'blast') {
        timers[slot] = L >= 6 ? 0.24 : 0.34;
        var n = 3 + 2 * (L - 1), half = (14 + 4 * L) * Math.PI / 180;
        for (i = 0; i < n; i++) emit('pellet', mx, my, up + (n > 1 ? (i / (n - 1) * 2 - 1) * half : 0), rnd(560, 640), vt);
      } else if (kind === 'frost') {
        timers[slot] = 0.14;
        FROST_PAT[L].forEach(function (d) { emit('shard', mx + d * 0.9, my, up + d * Math.PI / 180, 640, vt); });
      } else if (kind === 'swift') {
        timers[slot] = 0.3;
        var m = [1, 2, 2, 3, 4, 5, 6][L - 1];
        for (i = 0; i < m; i++) emit('missile', mx + (i - (m - 1) / 2) * 10, my + 8, up + (i - (m - 1) / 2) * 0.22, 420, vt);
      } else if (kind === 'thunder') {
        timers[slot] = L >= 6 ? 0.3 : 0.48;
        zap(mx, my, vt, L);
      } else if (kind === 'pierce') {
        timers[slot] = 0.22;
        var nb = L >= 4 ? 2 : 1;
        for (i = 0; i < nb; i++) emit('bolt', mx + (nb > 1 ? (i ? 12 : -12) : 0), my, up, 820, vt);
      } else if (kind === 'tide') {
        timers[slot] = 0.26 - L * 0.008;
        var tn = [1, 1, 2, 2, 3, 3, 4][L - 1];
        for (i = 0; i < tn; i++) emit('tide', mx + (i - (tn - 1) / 2) * 10, my, up + (i - (tn - 1) / 2) * 0.26, 420 + L * 18, vt, { wob: 120, ph: 0, mir: i < (tn - 1) / 2 ? -1 : 1 });
      } else if (kind === 'blade') {
        timers[slot] = 0.7;
        var bn = (BLADE_N[Math.min(7, L)] || 4) + (rank >= 5 ? 1 : 0);
        timers.brot = ((timers.brot || 0) + Math.PI / bn * 0.5) % (Math.PI * 2);
        for (i = 0; i < bn; i++) emit('blade', mx, my, up + timers.brot + i * Math.PI * 2 / bn, 520, vt, { spin: rnd(0, 6), blv: L, r: 8 + L * 0.8 + rank * 0.7, r0: 8 + L * 0.8 + rank * 0.7 });
      } else if (kind === 'shield') {
        timers[slot] = 0.16;
        emit('pea', mx, my, up, 700, vt);
      }
    }
    function shotCol(b) { return vtColor(TYPE_KIND[b.type] || mainKind, b.vt, b.hue); }

    function drawShip() {
      var p = shipAt();
      g.save();
      g.translate(p.x, p.y);
      g.scale(SHIP_S, SHIP_S);
      g.rotate(Math.sin(tt * 1.6) * 0.05);
      drawRageAura(kindColor(mainKind));
      drawShipArt({ kind: mainKind, sub: subKind, lv: lv, vt: vtMain, rank: rank, rage: true });
      // 展示台固定处于觉醒态：补上战斗中“觉醒”时围绕机体的脉冲环，
      // 避免背面预览看起来只有满火力，没有觉醒强化。
      var pulse = (tt * 1.8) % 1;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = (1 - pulse) * .55;
      g.strokeStyle = '#ffe08a';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(0, 0, 28 + pulse * 28, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = .8;
      for (var ai = 0; ai < 8; ai++) {
        var aa = tt * 1.4 + ai * Math.PI / 4;
        var ar = 25 + pulse * 10;
        g.fillStyle = ai % 2 ? '#ff6a4a' : '#ffe08a';
        g.fillRect(Math.cos(aa) * ar - 1, Math.sin(aa) * ar - 1, 2, 2);
      }
      g.restore();
      drawShieldBubble(2, shipTier(lv));
      g.restore();
    }

    function frame(now) {
      if (canvas._stop || !canvas.isConnected) { canvas._raf = null; return; }
      canvas._raf = requestAnimationFrame(frame);
      if (last && now - last < FRAME_MIN) return;   // 与战斗同一个 60fps 上限
      if (++tick % 20 === 0) {
        if (canvas.offsetWidth === 0) { canvas._raf = null; return; }   // 页面不可见时停掉
        var rr2 = canvas.getBoundingClientRect();
        if (Math.round(rr2.width) !== cw || Math.round(rr2.height) !== ch) resize();
      }
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now; tt += dt;
      var prevCtx = ctx, prevT = tGlobal;
      ctx = g; tGlobal = tt;
      g.setTransform(dprS, 0, 0, dprS, 0, 0);
      g.clearRect(0, 0, cw, ch);

      beams = []; orbs = [];
      orbA += dt * (3 + lv * 0.2);
      weapon('main', mainKind, lv, vtMain, dt);
      if (subKind) weapon('sub', subKind, subLv, vtSub, dt);

      shots.forEach(function (b) {
        if (b.type === 'tide') tideSway(b, dt);
        if (b.type === 'blade') b.spin = (b.spin || 0) + dt * 22;
        b.x += b.vx * dt; b.y += b.vy * dt;
        b._tr.push(b.x, b.y);
        if (b._tr.length > 20) b._tr.splice(0, b._tr.length - 20);
      });
      shots = shots.filter(function (b) { return b.y > -30 && b.y < ch + 40 && b.x > -60 && b.x < cw + 60; });
      arcs.forEach(function (a) { a.life -= dt; });
      arcs = arcs.filter(function (a) { return a.life > 0; });

      drawBeamList(beams, ch * 1.2);
      drawShotList(shots, shotCol);
      drawArcList(arcs);
      drawShip();
      if (orbs.length) drawOrbList(orbs, shipAt(), ammo);

      ctx = prevCtx; tGlobal = prevT;
    }
    canvas._raf = requestAnimationFrame(frame);
    return { lv: lv, maxP: fxT.maxP, main: mainKind, sub: subKind, vtMain: vtMain, vtSub: vtSub };
  }

  global.Battle = { open: open, start: start, close: close, preview: preview };
})(window);
