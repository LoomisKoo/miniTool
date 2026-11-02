/* 词卡弹幕肉鸽 · 子弹=卡片字母字形 · 字母属性决定弹种特效 */
(function (global) {
  'use strict';

  var WAVES = 5;
  var BOSS_NAMES = ['班主任', '教导主任', '阅卷组长', '命题人', '总监考官'];
  var MAX_HP = 5;
  var PICK = 1;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function hexA(hex, a) {
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
    seedBg();
    root.classList.add('open');
    if (api.cards && api.cards.length) startRun(api.cards);
    else showSelect();
  }
  // 由首页「远征」直接带卡开局
  function start(cards, opts) {
    opts = opts || {};
    opts.cards = cards;
    open(opts);
  }
  function close() {
    stopLoop();
    if (root) root.classList.remove('open');
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
      box.innerHTML = '<div class="bpick-empty">还没有词卡<br><span>先去拆封抽卡，再来远征</span></div>';
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
      var stars = (api.starsOf && api.starsOf(w)) || 0;
      var ammo = buildAmmo(w);
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'bpick kind-' + kind + (chosen[w.w] ? ' on' : '');
      var thumb = document.createElement('canvas');
      thumb.width = 72; thumb.height = 72;
      thumb.className = 'bpick-thumb';
      drawLetterThumb(thumb.getContext('2d'), ammo[0], kind, 72);
      item.appendChild(thumb);
      var meta = document.createElement('div');
      meta.className = 'bpick-meta';
      meta.innerHTML =
        '<span class="bw">' + w.w + '<em class="blv">' + (w.hid ? 'EX' : 'Lv' + (w.lvl || 1)) + '</em></span>' +
        '<span class="bk">' + kindLabel(kind) + '</span>' +
        '<span class="bc">' + (w.cn || '') + '</span>' +
        '<span class="bs">' + '◆'.repeat(Math.max(1, stars)) + '</span>';
      item.appendChild(meta);
      item.onclick = function () {
        if (PICK === 1) {
          chosen = {};
          count = 0;
          var all = box.querySelectorAll('.bpick');
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

  function drawLetterThumb(c, letter, kind, size) {
    c.clearRect(0, 0, size, size);
    var g = c.createRadialGradient(size * 0.3, size * 0.2, 2, size * 0.5, size * 0.5, size * 0.6);
    g.addColorStop(0, hexA(kindColor(kind), 0.22));
    g.addColorStop(1, 'rgba(20,14,10,.9)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    c.strokeStyle = hexA(kindColor(kind), 0.55);
    c.lineWidth = 1.5;
    c.strokeRect(1, 1, size - 2, size - 2);
    if (!letter) {
      c.fillStyle = kindColor(kind);
      c.font = '600 28px Georgia, serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('?', size / 2, size / 2);
      return;
    }
    var sc = (size * 0.55) / Math.max(letter.gw, letter.gh);
    c.save();
    c.translate(size / 2 - (letter.gw * sc) / 2, size / 2 - (letter.gb * sc) * 0.55);
    c.scale(sc, sc);
    try {
      var path = new Path2D(letter.d);
      c.shadowColor = kindGlow(kind);
      c.shadowBlur = 12;
      if (letter.treat === 'outline') {
        c.strokeStyle = letter.ink; c.lineWidth = 2 / sc; c.stroke(path);
      } else if (letter.treat === 'gold' || letter.treat === 'rubric') {
        c.fillStyle = letter.accent; c.fill(path);
      } else {
        c.fillStyle = letter.dark ? '#f3e6c8' : letter.ink; c.fill(path);
      }
    } catch (e) {}
    c.restore();
  }

  /* ── 开局 ─────────────────────────────────────── */
  function startRun(cards) {
    if (api.onStart && api.onStart() === false) return;
    state = {
      cards: cards.map(function (w) {
        var ammo = buildAmmo(w);
        return {
          word: w,
          kind: shotKind(w),
          stars: (api.starsOf && api.starsOf(w)) || 0,
          cd: 0,
          ammo: ammo,
          cursor: 0,
          color: kindColor(shotKind(w)),
        };
      }),
      active: 0,
      hp: MAX_HP,
      shield: 0,
      wave: 1,
      kills: 0,
      strongHits: 0,
      perfect: true,
      buffs: { dmg: 1, fire: 1, pierceBonus: 0, frostBonus: 0, blastBonus: 0, shieldBonus: 0, rootLink: 0 },
      player: { x: W / 2, y: H - 86, r: 18 },
      bullets: [],
      enemyShots: [],
      enemies: [],
      particles: [],
      volley: [],
      spawnLeft: 0,
      spawnTimer: 0,
      waveClearTimer: 0,
      invuln: 0,
      ended: false,
      paused: false,
      touchX: null,
      autoFire: false,
      fireAcc: 0,
      shake: 0,
    };
    setPanel('play');
    resize();
    state.player.x = W / 2;
    state.player.y = H - 90;
    bindPlay();
    renderHud();
    beginWave();
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
    if (state) {
      state.player.x = clamp(state.player.x, 24, W - 24);
      state.player.y = clamp(state.player.y, H * 0.3, H - 36);
    }
  }

  function beginWave() {
    var n = 4 + state.wave * 2;
    state.spawnLeft = n + 1;
    state.boss = null;
    state.waveStats = { t: 0, hits: 0, kills0: state.kills, strong0: state.strongHits };
    state.spawnTimer = 0.25;
    state.waveClearTimer = 0;
    state.enemies = [];
    state.enemyShots = [];
    state.bullets = state.bullets.filter(function (b) { return b.from === 'player'; });
    toastInGame('第 ' + state.wave + ' 关 · ' + BOSS_NAMES[state.wave - 1] + ' 坐镇');
  }

  function toastInGame(msg) {
    var t = el('battleToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('show'); }, 900);
  }

  function renderHud() {
    var hp = el('battleHp');
    if (hp) {
      var s = '';
      for (var i = 0; i < MAX_HP; i++) {
        s += '<i class="' + (i < state.hp ? 'on' : '') + '"></i>';
      }
      if (state.shield > 0) s += '<em>盾' + state.shield + '</em>';
      hp.innerHTML = s;
    }
    var wv = el('battleWave');
    if (wv) wv.textContent = state.wave + ' / ' + WAVES;
    var kill = el('battleKill');
    if (kill) kill.textContent = state.kills;
    renderSlots();
  }

  function renderSlots() {
    var box = el('battleSlots');
    if (!box) return;
    box.innerHTML = '';
    state.cards.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'bslot kind-' + c.kind + (i === state.active ? ' on' : '');
      var thumb = document.createElement('canvas');
      thumb.width = 56; thumb.height = 56;
      drawLetterThumb(thumb.getContext('2d'), c.ammo[c.cursor % Math.max(1, c.ammo.length)] || c.ammo[0], c.kind, 56);
      b.appendChild(thumb);
      var info = document.createElement('span');
      info.className = 'bslot-info';
      info.innerHTML = '<b>' + c.word.w + '</b><em>' + kindLabel(c.kind) + '</em>';
      b.appendChild(info);
      b.onclick = function (e) {
        e.stopPropagation();
        state.active = i;
        renderSlots();
      };
      box.appendChild(b);
    });
  }

  /* ── 输入 ─────────────────────────────────────── */
  function bindPlay() {
    var stage = el('battleStage');
    if (!stage || stage._bound) return;
    stage._bound = true;
    // 相对拖动：手指不遮挡角色，可向任意方向移动
    stage.addEventListener('pointerdown', function (e) {
      if (state && state.paused) return;
      if (e.target.closest && e.target.closest('.bslot, .bcharge-btn')) return;
      state.touchX = e.clientX;
      state.drag = { px: e.clientX, py: e.clientY, x0: state.player.x, y0: state.player.y };
      state.autoFire = true;
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener('pointermove', function (e) {
      if (!state || !state.drag || state.paused) return;
      var d = state.drag;
      state.player.x = clamp(d.x0 + (e.clientX - d.px) * 1.15, 24, W - 24);
      state.player.y = clamp(d.y0 + (e.clientY - d.py) * 1.15, H * 0.3, H - 36);
    });
    function up() {
      if (!state) return;
      state.touchX = null;
      state.drag = null;
      state.autoFire = false;
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    el('battleFireStrong').onclick = function (e) { e.stopPropagation(); openCharge(); };
    el('battleQuit').onclick = function () { endRun(false); };
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  }

  /* ── 射击：打出字母 ───────────────────────────── */
  function nextLetter(card) {
    if (!card.ammo.length) return null;
    var L = card.ammo[card.cursor % card.ammo.length];
    card.cursor = (card.cursor + 1) % card.ammo.length;
    return L;
  }

  function fireWeak() {
    var card = state.cards[state.active];
    if (!card || card.cd > 0) return;
    card.cd = Math.max(0.11, (0.26 - card.stars * 0.028) / state.buffs.fire);
    spawnLetterBullet(card, nextLetter(card), false, 0);
  }

  function fireStrong(success) {
    var card = state.cards[state.active];
    if (!card) return;
    if (success) {
      state.strongHits++;
      // 整词齐射：每个字母依次弹出
      var n = Math.max(1, card.ammo.length);
      for (var i = 0; i < n; i++) {
        state.volley.push({
          at: tGlobal + i * 0.05,
          cardIndex: state.active,
          letter: card.ammo[i],
          strong: true,
          spread: (i - (n - 1) / 2) * 38,
        });
      }
      toastInGame('强射 · ' + String(card.word.w || '').toUpperCase());
      muzzle(card.kind, true);
    } else {
      state.perfect = false;
      spawnLetterBullet(card, nextLetter(card), false, 0);
      toastInGame('弱射脱出');
    }
  }

  function spawnLetterBullet(card, letter, strong, spreadX) {
    var kind = (letter && letter.kind) || card.kind;
    var lv = (letter && letter.lv) || 1;
    var base = 11 + card.stars * 4 + card.word.tier * 2;
    var dmg = base * state.buffs.dmg * (strong ? 2.4 : 1) * (1 + 0.2 * (lv - 1));
    if (kind === 'pierce') dmg *= 1 + state.buffs.pierceBonus;
    if (kind === 'frost') dmg *= 1 + state.buffs.frostBonus;
    if (kind === 'blast') dmg *= 1 + state.buffs.blastBonus;

    if (kind === 'shield') {
      state.shield = Math.min(3 + (lv >= 4 ? 1 : 0), state.shield + (strong ? 2 : 1) + (state.buffs.shieldBonus > 0 ? 1 : 0) + (lv >= 3 ? 1 : 0));
      renderHud();
      ringBurst(state.player.x, state.player.y, kindColor(kind), strong ? 18 : 10);
      return;
    }

    if (kind === 'swift') {
      dmg *= 0.7;
      card.cd *= 0.5;
    }
    if (kind === 'pierce') dmg *= 1.35;
    // 弹道原型：爆破=三向散射，疾射=自动追踪，穿透=激光贯穿
    var fans = kind === 'blast' ? [-1, 0, 1] : [0];
    var per = fans.length > 1 ? 0.55 : 1;
    var size = strong ? 42 : kind === 'swift' ? 24 : 30;
    fans.forEach(function (dir) {
      state.bullets.push({
        from: 'player',
        x: state.player.x + (spreadX || 0),
        y: state.player.y - 22,
        vx: (spreadX || 0) * 0.35 + dir * 150,
        vy: strong ? -560 : kind === 'swift' ? -620 : -440,
        r: size * 0.48,
        size: size,
        dmg: dmg * per,
        kind: kind,
        lv: lv,
        strong: strong,
        pierce: kind === 'pierce' ? (strong ? 4 : 2) + state.buffs.pierceBonus + Math.floor((lv - 1) / 2) : 0,
        life: kind === 'pierce' ? 3.0 : 2.4,
        spin: rnd(-2.5, 2.5),
        rot: rnd(-0.3, 0.3),
        word: card.word.w,
        letter: letter,
        color: kindColor(kind),
        hit: {},
        trail: 0,
      });
    });
    muzzle(kind, strong);
  }

  function muzzle(kind, strong) {
    ringBurst(state.player.x, state.player.y - 18, kindColor(kind), strong ? 14 : 6);
  }

  /* ── 强射默写 ─────────────────────────────────── */
  function openCharge() {
    if (!state || state.ended) return;
    state.paused = true;
    setPanel('charge');
    var card = state.cards[state.active];
    var w = card.word;
    el('chargeCn').textContent = w.cn || '';
    el('chargeMeta').textContent = (w.pos || '') + '　' + (w.ph || '') + '　·　' + kindLabel(card.kind);
    // 预览字母
    var prev = el('chargePreview');
    if (prev) {
      prev.width = 120; prev.height = 120;
      drawLetterThumb(prev.getContext('2d'), card.ammo[0], card.kind, 120);
    }
    var inp = el('chargeInput');
    inp.value = '';
    el('chargeFoot').textContent = '写对：整词字母齐射　·　写错：单字母弱射';
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 40);
    el('chargeSubmit').onclick = function () {
      var val = inp.value.trim().toLowerCase().replace(/\s+/g, '');
      var ok = val === w.w.toLowerCase();
      if (ok && api.onStrongWrite) api.onStrongWrite(w);
      closeCharge();
      fireStrong(ok);
    };
    el('chargeCancel').onclick = closeCharge;
    inp.onkeydown = function (e) { if (e.key === 'Enter') el('chargeSubmit').click(); };
  }
  function closeCharge() {
    setPanel('play');
    if (state) state.paused = false;
  }

  /* ── 敌人 ─────────────────────────────────────── */
  function spawnEnemy() {
    var wave = state.wave;
    var hp = 30 + wave * 18 + rnd(0, 12);
    var speed = 26 + wave * 6 + rnd(0, 12);
    var boss = state.spawnLeft === 1;
    var type = boss ? 'boss' : (Math.random() < 0.22 ? 'paper' : (Math.random() < 0.2 ? 'clock' : 'norm'));
    if (type === 'paper') { hp *= 1.15; speed *= 0.8; }
    if (type === 'clock') { hp *= 0.72; speed *= 1.45; }
    if (type === 'boss') { hp *= wave >= WAVES ? 16 : 5 + wave * 1.5; speed = 60; }

    var quiz = null;
    if (Math.random() < 0.38) {
      var target = pick(state.cards).word;
      quiz = { cn: target.cn, answer: target.w };
    }

    state.enemies.push({
      _id: Math.random().toString(36).slice(2, 9),
      x: boss ? W / 2 : rnd(36, W - 36),
      y: boss ? -50 : -28,
      r: type === 'boss' ? (wave >= WAVES ? 46 : 36 + wave * 2) : type === 'paper' ? 25 : type === 'clock' ? 15 : 19,
      hp: hp, maxHp: hp,
      vy: speed, vx: boss ? 70 : rnd(-28, 28),
      type: type,
      slow: 0,
      quiz: quiz,
      rot: rnd(0, Math.PI * 2),
      spin: rnd(-0.8, 0.8),
      hue: type === 'tank' ? 18 : type === 'swift' ? 210 : 32,
      shootCd: rnd(.8, 1.8),
      shotGlyph: type === 'boss' ? '!' : type === 'paper' ? '?' : type === 'clock' ? '×' : '·',
    });
    if (boss) {
      state.boss = state.enemies[state.enemies.length - 1];
      state.boss.quiz = null;
      state.boss.name = BOSS_NAMES[wave - 1];
      toastInGame('BOSS 登场 · ' + state.boss.name);
    }
  }

  var UPGRADES = [
    { id: 'dmg', name: '词锋', desc: '所有字母伤害 +25%', apply: function (b) { b.dmg *= 1.25; } },
    { id: 'fire', name: '速记', desc: '射速 +20%', apply: function (b) { b.fire *= 1.2; } },
    { id: 'pierce', name: '贯穿', desc: '穿透字母 +1 穿透', apply: function (b) { b.pierceBonus += 1; } },
    { id: 'frost', name: '凝霜', desc: '冰控字母减速加强', apply: function (b) { b.frostBonus += 0.35; } },
    { id: 'blast', name: '炸裂', desc: '爆破字母伤害 +40%', apply: function (b) { b.blastBonus += 0.4; } },
    { id: 'shield', name: '护词', desc: '护盾额外 +1 层', apply: function (b) { b.shieldBonus += 1; } },
    { id: 'heal', name: '回声', desc: '立刻回复 1 生命', apply: function () { state.hp = Math.min(MAX_HP, state.hp + 1); } },
    { id: 'root', name: '词根共鸣', desc: '伤害 +15%', apply: function (b) { b.dmg *= 1.15; b.rootLink += 1; } },
  ];

  // 关卡评分：受伤、用时、强射决定等级，等级决定墨水
  function gradeWave() {
    var ws = state.waveStats;
    var par = 18 + state.wave * 6;
    var score = 100 - ws.hits * 22 - Math.max(0, ws.t - par) * 1.5 + (state.strongHits - ws.strong0) * 4;
    score = Math.round(clamp(score, 0, 100));
    var g = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : 'C';
    var ink = { S: 30, A: 20, B: 12, C: 6 }[g] + state.wave * 3;
    return { g: g, score: score, ink: ink, t: ws.t, hits: ws.hits, kills: state.kills - ws.kills0 };
  }

  function showUpgrade() {
    state.paused = true;
    var r = gradeWave();
    state.waveLog = state.waveLog || [];
    state.waveLog.push(r);
    setPanel('upgrade');
    var last = state.wave >= WAVES;
    var box = el('battleUpgrade');
    box.innerHTML =
      '<div class="wclear">' +
        '<div class="wc-top">第 ' + state.wave + ' 关 · 击败' + BOSS_NAMES[state.wave - 1] + '</div>' +
        '<div class="wc-grade g' + r.g + '">' + r.g + '</div>' +
        '<div class="wc-score">评分 <b>' + r.score + '</b></div>' +
        '<div class="wc-stats">' +
          '<div><b>' + Math.round(r.t) + 's</b><span>用时</span></div>' +
          '<div><b>' + r.hits + '</b><span>受伤</span></div>' +
          '<div><b>' + r.kills + '</b><span>击杀</span></div>' +
        '</div>' +
        '<div class="wc-ink"><i></i><b>+' + r.ink + '</b><em>墨水</em></div>' +
        '<div class="wc-rule">S 30 · A 20 · B 12 · C 6　另加关卡数 × 3</div>' +
        '<button class="btn primary wc-next" id="wcNext">' + (last ? '查看结算' : '下 一 关') + '</button>' +
      '</div>';
    el('wcNext').onclick = function () {
      state.paused = false;
      setPanel('play');
      if (last) endRun(true);
      else { state.wave++; beginWave(); renderHud(); }
    };
  }


  function endRun(win) {
    if (state.ended) return;
    state.ended = true;
    state.paused = true;
    stopLoop();
    setPanel('result');
    // 结算只发材料：墨水 = 每波 4 + 击杀（上限 40）+ 通关 20 + 完美 10
    var log = state.waveLog || [];
    var inkN = log.reduce(function (a, r) { return a + r.ink; }, 0);
    el('battleResultTitle').textContent = '结 算';
    el('battleResultBody').innerHTML =
      '<div class="bres-hero ' + (win ? 'win' : 'lose') + '">' +
        '<div class="bres-badge">' + (win ? '胜' : '败') + '</div>' +
        '<h2>' + (win ? '远征胜利' : '远征失败') + '</h2>' +
        '<p>' + (win ? (state.perfect ? '完美通关 · 全部 BOSS 已击败' : '全部 BOSS 已击败') : '止步第 ' + state.wave + ' 关') + '</p>' +
      '</div>' +
      '<div class="bres-stats">' +
        '<div><b>' + log.length + '/' + WAVES + '</b><span>通关</span></div>' +
        '<div><b>' + state.kills + '</b><span>击杀</span></div>' +
        '<div><b>' + state.strongHits + '</b><span>强射</span></div>' +
      '</div>' +
      '<div class="bres-reward">' +
        '<div class="bres-rt">获得材料</div>' +
        '<div class="bres-ink"><i></i><b id="bresInk">+0</b><em>墨水</em></div>' +
        '<ul>' + (log.length ? log.map(function (r, i) {
          return '<li><span>第' + (i + 1) + '关</span><em class="g' + r.g + '">' + r.g + '</em><b>+' + r.ink + '</b></li>';
        }).join('') : '<li><span>未通过任何关卡</span></li>') + '</ul>' +
      '</div>';
    var shown = 0, inkEl = el('bresInk');
    var tick = setInterval(function () {
      shown = Math.min(inkN, shown + Math.max(1, Math.ceil(inkN / 24)));
      if (inkEl) inkEl.textContent = '+' + shown;
      if (shown >= inkN) clearInterval(tick);
    }, 30);
    if (api.onReward) api.onReward(0, {
      win: win, kills: state.kills, ink: inkN,
      waves: log.length, strong: state.strongHits,
      grade: (function () {
        var order = { S: 4, A: 3, B: 2, C: 1 }, best = '';
        log.forEach(function (r) { if (!best || order[r.g] > order[best]) best = r.g; });
        return best;
      })(),
      word: (state.cards[0] && state.cards[0].word && state.cards[0].word.w) || '',
    });
    el('battleAgain').onclick = exitToHome;
    el('battleBack').onclick = exitToHome;
  }

  function exitToHome() {
    close();
    if (api && api.onExit) api.onExit();
  }

  /* ── 主循环 ───────────────────────────────────── */
  function startLoop() {
    stopLoop();
    running = true;
    lastTs = 0;
    raf = requestAnimationFrame(frame);
  }
  function stopLoop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function frame(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.033, (ts - lastTs) / 1000);
    lastTs = ts;
    tGlobal += dt;
    if (state && !state.paused && !state.ended) update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function update(dt) {
    if (state.waveStats) state.waveStats.t += dt;
    state.cards.forEach(function (c) { if (c.cd > 0) c.cd -= dt; });
    if (state.invuln > 0) state.invuln -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 8);

    // 齐射队列
    if (state.volley.length) {
      var left = [];
      for (var v = 0; v < state.volley.length; v++) {
        var item = state.volley[v];
        if (tGlobal >= item.at) {
          var card = state.cards[item.cardIndex];
          if (card) spawnLetterBullet(card, item.letter, item.strong, item.spread);
        } else left.push(item);
      }
      state.volley = left;
    }

    if (state.autoFire) {
      state.fireAcc += dt;
      if (state.fireAcc > 0.04) { state.fireAcc = 0; fireWeak(); }
    }

    if (state.spawnLeft > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy();
        state.spawnLeft--;
        state.spawnTimer = Math.max(0.32, 0.82 - state.wave * 0.05);
      }
    }

    state.enemies.forEach(function (e) {
      var mul = e.slow > 0 ? 0.32 : 1;
      if (e.slow > 0) e.slow -= dt;
      if (e.type === 'boss' && e.y >= H * 0.18) e.vy = 0;
      e.x += e.vx * dt * mul;
      e.y += e.vy * dt * mul;
      e.rot += e.spin * dt;
      if (e.x < e.r || e.x > W - e.r) e.vx *= -1;
      e.shootCd -= dt;
      if (e.type === 'boss' && e.shootCd <= 0 && e.y > 20) {
        var rage = e.hp < e.maxHp * 0.5;
        e.shootCd = (rage ? 1.1 : 1.6) + (WAVES - state.wave) * 0.12;
        e.burst = (e.burst || 0) + 1;
        var nShot = (state.wave < 3 ? 3 : 5) + (rage ? 2 : 0);
        for (var si = 0; si < nShot; si++) {
          var ang = Math.PI / 2 + (si - (nShot - 1) / 2) * 0.22 + (e.burst % 2 ? 0.11 : 0);
          state.enemyShots.push({
            x: e.x, y: e.y + e.r * 0.6, vx: Math.cos(ang) * 170, vy: Math.sin(ang) * 170,
            r: 8, glyph: '!', life: 5, color: '#ff5474',
          });
        }
        return;
      }
      if (e.type !== 'boss' && e.shootCd <= 0 && e.y > 20 && e.y < H * .7) {
        e.shootCd = 1.65 + Math.random() * 1.2;
        state.enemyShots.push({
          x: e.x, y: e.y + e.r, vx: (state.player.x - e.x) * 0.22,
          vy: e.type === 'boss' ? 210 : 175, r: e.type === 'boss' ? 9 : 6,
          glyph: e.shotGlyph, life: 4, color: e.type === 'boss' ? '#ff5474' : '#ef9c55',
        });
      }
    });

    state.bullets.forEach(function (b) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      b.life -= dt;
      b.trail += dt;
      // 弹种轨迹差异
      if (b.kind === 'frost') b.vx += Math.sin(tGlobal * 10 + b.y * 0.02) * 40 * dt;
      if (b.kind === 'pierce') b.vy = Math.min(b.vy, -520);
      if (b.kind === 'swift') {
        // 自动追踪最近的敌人
        var tg = null, bd = 1e9;
        state.enemies.forEach(function (e) {
          if (e.hp <= 0) return;
          var d = dist(b, e);
          if (d < bd) { bd = d; tg = e; }
        });
        if (tg) {
          var ang = Math.atan2(tg.y - b.y, tg.x - b.x);
          var sp0 = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 520;
          b.vx += Math.cos(ang) * 1300 * dt;
          b.vy += Math.sin(ang) * 1300 * dt;
          var sp1 = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
          b.vx = (b.vx / sp1) * sp0;
          b.vy = (b.vy / sp1) * sp0;
        }
      }
    });

    state.enemyShots.forEach(function (b) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (dist(b, state.player) < b.r + state.player.r && state.invuln <= 0) {
        if (state.shield > 0) { state.shield--; toastInGame('监考弹幕被护盾挡下'); }
        else { state.hp--; state.perfect = false; state.waveStats.hits++; toastInGame('考试警告 -1'); state.shake = 0.45; }
        state.invuln = 1.0;
        b.life = 0;
        renderHud();
        if (state.hp <= 0) endRun(false);
      }
    });

    state.bullets.forEach(function (b) {
      if (b.from !== 'player' || b.life <= 0) return;
      state.enemies.forEach(function (e) {
        if (e.hp <= 0 || b.hit[e._id]) return;
        if (dist(b, e) > b.r + e.r) return;
        b.hit[e._id] = 1;
        var dmg = b.dmg;
        if (e.quiz) dmg *= (b.word === e.quiz.answer) ? 2.3 : 0.55;
        e.hp -= dmg;
        letterBurst(b.x, b.y, b);
        var blv = b.lv || 1;
        if (b.kind === 'frost') e.slow = Math.max(e.slow, 1.35 + state.buffs.frostBonus + 0.3 * (blv - 1));
        if (b.kind === 'blast') {
          state.enemies.forEach(function (o) {
            if (o === e || o.hp <= 0) return;
            if (dist(o, e) < 58 + 10 * (blv - 1)) o.hp -= b.dmg * 0.48;
          });
          ringBurst(e.x, e.y, kindColor('blast'), 20);
          state.shake = 0.25;
        }
        if (b.pierce > 0) b.pierce--;
        else b.life = 0;
        if (e.hp <= 0) {
          state.kills++;
          ringBurst(e.x, e.y, '#ffe6a0', 22);
          state.shake = Math.max(state.shake, 0.18);
        }
      });
    });

    state.enemies.forEach(function (e) {
      if (e.hp <= 0) return;
      var touch = dist(e, state.player) < e.r + state.player.r * 0.8;
      var leak = e.y - e.r > H;
      if (touch || leak) {
        if (state.invuln <= 0) {
          if (state.shield > 0) { state.shield--; toastInGame('护盾抵挡'); }
          else { state.hp--; state.perfect = false; state.waveStats.hits++; toastInGame(leak ? '漏网一个 -1' : '受伤 -1'); state.shake = 0.4; }
          state.invuln = 1.0;
          renderHud();
          if (state.hp <= 0) endRun(false);
        }
        if (e.type !== 'boss') e.hp = 0;
      }
    });

    state.enemies = state.enemies.filter(function (e) { return e.hp > 0 && e.y < H + 50; });
    state.bullets = state.bullets.filter(function (b) { return b.life > 0 && b.y > -60 && b.y < H + 40; });
    state.enemyShots = state.enemyShots.filter(function (b) { return b.life > 0 && b.y < H + 40; });
    state.particles = state.particles.filter(function (p) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.spin || 0) * dt;
      return p.life > 0;
    });

    if (state.spawnLeft <= 0 && state.enemies.length === 0 && !state.ended && !state.paused) {
      state.waveClearTimer += dt;
      if (state.waveClearTimer > 0.55) {
        state.waveClearTimer = -999;
        showUpgrade();
      }
    }

    // 槽位字母预览随射击滚动：每 0.4s 刷新一次太重，改在 fire 后轻量刷新
  }

  function ringBurst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + rnd(-0.1, 0.1);
      var sp = rnd(50, 180);
      state.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rnd(0.25, 0.6), color: color, r: rnd(1.4, 3.2), kind: 'dot',
      });
    }
  }
  function letterBurst(x, y, b) {
    ringBurst(x, y, b.color || kindColor(b.kind), b.strong ? 12 : 6);
    if (b.letter && b.letter.ch) {
      state.particles.push({
        x: x, y: y, vx: rnd(-20, 20), vy: rnd(-40, -10),
        life: 0.45, color: b.color, r: 10, kind: 'glyph', letter: b.letter, rot: b.rot, spin: rnd(-4, 4),
      });
    }
  }

  /* ── 绘制 ─────────────────────────────────────── */
  function draw() {
    if (!ctx) return;
    var sx = state && state.shake ? rnd(-2, 2) * state.shake * 4 : 0;
    var sy = state && state.shake ? rnd(-2, 2) * state.shake * 4 : 0;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.clearRect(-4, -4, W + 8, H + 8);

    // 深空羊皮纸底
    var g0 = ctx.createRadialGradient(W * 0.5, H * 0.2, 20, W * 0.5, H * 0.55, H * 0.85);
    g0.addColorStop(0, '#2a2118');
    g0.addColorStop(0.45, '#15100c');
    g0.addColorStop(1, '#070504');
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, W, H);

    // 漂浮暗字母
    bgStars.forEach(function (s) {
      var yy = ((s.y * H + tGlobal * s.sp) % (H + 40)) - 20;
      var xx = s.x * W;
      ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(tGlobal * 2 + s.x * 10));
      ctx.fillStyle = '#c9a227';
      ctx.font = s.s * 7 + 'px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.ch, xx, yy);
    });
    ctx.globalAlpha = 1;

    // 内框光
    ctx.strokeStyle = 'rgba(201,162,39,.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(6.5, 6.5, W - 13, H - 13);
    ctx.strokeStyle = 'rgba(201,162,39,.08)';
    ctx.strokeRect(11.5, 11.5, W - 23, H - 23);

    if (!state) { ctx.restore(); return; }

    // 敌人
    state.enemies.forEach(drawEnemy);

    // 主考官发射的试卷/警告弹
    state.enemyShots.forEach(drawEnemyShot);

    // 子弹字母
    state.bullets.forEach(drawBullet);

    // 粒子
    state.particles.forEach(function (p) {
      ctx.globalAlpha = clamp(p.life * 2.2, 0, 1);
      if (p.kind === 'glyph' && p.letter) {
        drawGlyph(p.letter, p.x, p.y, 16, p.rot || 0, p.color, false, null);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    drawPlayer();
    if (state.boss && state.boss.hp > 0) drawBossBar(state.boss);
    ctx.restore();
  }

  function drawBossBar(b) {
    var bw = W - 60, x = 30, y = 18, p = clamp(b.hp / b.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x - 2, y - 2, bw + 4, 12);
    var g = ctx.createLinearGradient(x, 0, x + bw, 0);
    g.addColorStop(0, '#ff3d5a'); g.addColorStop(1, '#ffb347');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, bw * p, 8);
    ctx.fillStyle = '#fff3dc';
    ctx.font = '600 11px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.name + (b.hp < b.maxHp * 0.5 ? ' · 狂暴' : ''), W / 2, y + 24);
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot * 0.15);
    var r = e.r;
    // 墨印体
    var eg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
    if (e.type === 'boss') {
      eg.addColorStop(0, '#ff5c75'); eg.addColorStop(1, '#4a1025');
    } else if (e.type === 'paper') {
      eg.addColorStop(0, '#e7d9b9'); eg.addColorStop(1, '#765d43');
    } else if (e.type === 'clock') {
      eg.addColorStop(0, '#83c8d8'); eg.addColorStop(1, '#193c58');
    } else if (e.type === 'tank') {
      eg.addColorStop(0, '#8a5a3a'); eg.addColorStop(1, '#3a2218');
    } else if (e.type === 'swift') {
      eg.addColorStop(0, '#5a7a9a'); eg.addColorStop(1, '#1a2430');
    } else {
      eg.addColorStop(0, '#6a4a30'); eg.addColorStop(1, '#2a1a12');
    }
    ctx.beginPath();
    if (e.type === 'boss') {
      for (var bi = 0; bi < 8; bi++) {
        var ba = (bi / 8) * Math.PI * 2 - Math.PI / 2;
        var bx = Math.cos(ba) * r, by = Math.sin(ba) * r;
        if (bi === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
      }
    } else if (e.type === 'paper') {
      ctx.rect(-r * .78, -r, r * 1.56, r * 2);
    } else if (e.type === 'clock') {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(0, 0); ctx.lineTo(0, -r * .65);
      ctx.moveTo(0, 0); ctx.lineTo(r * .55, r * .2);
    } else if (e.type === 'swift') {
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.85, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.85, 0);
    } else if (e.type === 'tank') {
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        var px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    } else {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fillStyle = eg;
    ctx.fill();
    ctx.strokeStyle = e.slow > 0 ? '#b8f0ff' : 'rgba(232,213,165,.4)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // 内环
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201,162,39,.35)';
    ctx.stroke();
    ctx.restore();

    // 血条
    var bw = r * 2.1;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(e.x - bw / 2, e.y - r - 10, bw, 4);
    var grd = ctx.createLinearGradient(e.x - bw / 2, 0, e.x + bw / 2, 0);
    grd.addColorStop(0, '#c45a2a');
    grd.addColorStop(1, '#e6c25a');
    ctx.fillStyle = grd;
    ctx.fillRect(e.x - bw / 2, e.y - r - 10, bw * clamp(e.hp / e.maxHp, 0, 1), 4);

    ctx.fillStyle = e.type === 'boss' ? '#ffb1bc' : '#f4e4c1';
    ctx.font = '700 ' + (e.type === 'boss' ? 12 : 9) + 'px "Songti SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(e.type === 'boss' ? e.name : e.type === 'paper' ? '试卷怪' : e.type === 'clock' ? '倒计时' : '监考官', e.x, e.y - r - 15);

    if (e.quiz) {
      ctx.fillStyle = 'rgba(12,8,5,.72)';
      var tw = Math.min(110, ctx.measureText ? 80 : 80);
      ctx.font = '11px "Songti SC", serif';
      var m = ctx.measureText(e.quiz.cn);
      tw = Math.min(120, m.width + 14);
      roundRect(e.x - tw / 2, e.y - 6, tw, 16, 2);
      ctx.fill();
      ctx.fillStyle = '#f2e9d8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.quiz.cn, e.x, e.y + 2);
    }
  }

  function drawEnemyShot(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.globalAlpha = clamp(b.life * 2, 0, 1);
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2a0e17';
    ctx.font = '700 ' + Math.max(9, b.r * 1.35) + 'px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.glyph, 0, 1);
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

  function drawBullet(b) {
    // 拖尾
    if (b.kind === 'pierce') {
      // 激光：拉长光束 + 双层拖尾
      ctx.strokeStyle = hexA(b.color, 0.16);
      ctx.lineWidth = b.strong ? 10 : 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x + b.vx * 0.05, b.y + b.vy * 0.05);
      ctx.lineTo(b.x - b.vx * 0.12, b.y - b.vy * 0.12);
      ctx.stroke();
      ctx.strokeStyle = hexA('#ffffff', 0.55);
      ctx.lineWidth = b.strong ? 3 : 1.6;
      ctx.beginPath();
      ctx.moveTo(b.x + b.vx * 0.02, b.y + b.vy * 0.02);
      ctx.lineTo(b.x - b.vx * 0.09, b.y - b.vy * 0.09);
      ctx.stroke();
    }
    if (b.kind === 'swift') {
      ctx.strokeStyle = hexA(b.color, 0.28);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.05, b.y - b.vy * 0.05);
      ctx.stroke();
    }
    if (b.kind === 'frost') {
      ctx.strokeStyle = 'rgba(180,240,255,.25)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (b.kind === 'blast' && b.strong) {
      ctx.strokeStyle = 'rgba(255,150,60,.3)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * 0.7 + Math.sin(tGlobal * 20) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 光晕
    ctx.save();
    ctx.shadowColor = kindGlow(b.kind);
    ctx.shadowBlur = b.strong ? 18 : 10;
    if (b.letter) {
      drawGlyph(b.letter, b.x, b.y, b.size, b.rot, b.color, b.strong, b.kind);
    } else {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGlyph(letter, x, y, size, rot, color, strong, kind) {
    if (!letter || !letter.d) return;
    var sc = size / Math.max(letter.gw, letter.gh);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(sc, sc);
    ctx.translate(-letter.gw / 2, -letter.gb * 0.72);
    try {
      var path = new Path2D(letter.d);
      if (letter.treat === 'outline') {
        ctx.strokeStyle = color || letter.ink;
        ctx.lineWidth = (strong ? 3.2 : 2.2) / sc;
        ctx.stroke(path);
      } else if (letter.treat === 'gold' || letter.treat === 'rubric') {
        ctx.fillStyle = letter.accent || color;
        ctx.fill(path);
      } else {
        ctx.fillStyle = color || (letter.dark ? '#f3e6c8' : letter.ink);
        ctx.fill(path);
      }
      if (strong) {
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.lineWidth = 1.2 / sc;
        ctx.stroke(path);
      }
    } catch (e) {}
    ctx.restore();

    // 弹种角标小点
    if (kind === 'pierce') {
      ctx.fillStyle = '#6ec8ff';
      ctx.fillRect(x - 1, y - size * 0.55, 2, size * 0.25);
    }
  }

  function drawPlayer() {
    var p = state.player;
    var card = state.cards[state.active];
    ctx.save();
    if (state.invuln > 0 && ((state.invuln * 12) | 0) % 2 === 0) ctx.globalAlpha = 0.35;

    // 底座光环
    var rg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 40);
    rg.addColorStop(0, hexA(card ? card.color : '#e8d5a5', 0.35));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 40, 0, Math.PI * 2);
    ctx.fill();

    // 法典机体：菱形+横翼
    ctx.translate(p.x, p.y);
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 4);
    ctx.lineTo(8, 14);
    ctx.lineTo(-8, 14);
    ctx.lineTo(-14, 4);
    ctx.closePath();
    var body = ctx.createLinearGradient(0, -18, 0, 14);
    body.addColorStop(0, '#f0e0b0');
    body.addColorStop(1, '#8a6a28');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,160,.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 翼
    ctx.beginPath();
    ctx.moveTo(-16, 2); ctx.lineTo(-28, 10); ctx.lineTo(-12, 10);
    ctx.moveTo(16, 2); ctx.lineTo(28, 10); ctx.lineTo(12, 10);
    ctx.strokeStyle = hexA(card ? card.color : '#e8d5a5', 0.8);
    ctx.stroke();

    // 中心宝石
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = card ? card.color : '#e8d5a5';
    ctx.shadowColor = kindGlow(card ? card.kind : 'blast');
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (state.shield > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 26 + Math.sin(tGlobal * 6) * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(125,255,176,.65)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // 当前装填字母
    if (card && card.ammo.length) {
      var L = card.ammo[card.cursor % card.ammo.length];
      drawGlyph(L, p.x, p.y - 36, 18, Math.sin(tGlobal * 3) * 0.15, card.color, false, card.kind);
      ctx.fillStyle = 'rgba(242,233,216,.7)';
      ctx.font = '600 10px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.word.w.toUpperCase(), p.x, p.y + 30);
      ctx.fillStyle = hexA(card.color, 0.85);
      ctx.font = '9px "Songti SC", serif';
      ctx.fillText(kindLabel(card.kind), p.x, p.y + 42);
    }
  }

  global.Battle = { open: open, start: start, close: close };
})(window);
