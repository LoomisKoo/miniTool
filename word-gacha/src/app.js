/* 抽词成册 · 交互 */
(function () {
  'use strict';

  var WORDS = window.WORDS;
  var TAGS = window.TAGS;
  var TIERS = window.TIERS;
  var Card = window.Card;
  var FX = window.FX;

  var BY_WORD = {};
  for (var i = 0; i < WORDS.length; i++) BY_WORD[WORDS[i].w] = WORDS[i];

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage');
  var KEY = 'wordcodex.v3';
  var DEV_MODE = true;     // 开发预览开关：开启后不读写本地状态、不限次数，每次刷新都是新局
  var FREE_PER_DAY = 6;   // 每日免费拆封（每次 3 张 = 18 词）
  var BATTLE_PER_DAY = 3; // 每日免费远征
  var BONUS_CAP = 6;      // 默写最多再换几次
  var DUP_INK = { 1: 6, 2: 10, 3: 20, 4: 40, 5: 80 }; // 重复卡转墨水
  var WRITE_INK = 3;                                  // 每次默写正确
  var state = {
    owned: {}, draws: 0, recent: [], ink: DEV_MODE ? 300 : 0,
    day: null, streak: 0, lastDay: '', records: [],
    quota: { d: '', used: 0, bonus: 0, battleUsed: 0, battleBonus: 0 },
  };
  var busy = false;
  var bookFilter = 'got';
  var bookSort = 'tier';
  var deckEl = null;
  var deckWords = [];
  var activeIdx = 0;

  /* ── 存储 ─────────────────────────────────────── */
  function sget() {
    if (DEV_MODE) return null;
    try {
      if (window.xhs && window.xhs.miniTool && window.xhs.miniTool.getStorage) {
        return window.xhs.miniTool.getStorage(KEY);
      }
    } catch (e) {}
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function sset(str) {
    if (DEV_MODE) return;
    try {
      if (window.xhs && window.xhs.miniTool && window.xhs.miniTool.setStorage) {
        window.xhs.miniTool.setStorage(KEY, str);
        return;
      }
    } catch (e) {}
    try { localStorage.setItem(KEY, str); } catch (e) {}
  }
  function load() {
    var raw = sget();
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      if (!o) return;
      state.owned = o.owned || {};
      state.draws = o.draws || 0;
      state.recent = o.recent || [];
      state.day = o.day || null;
      state.streak = o.streak || 0;
      state.lastDay = o.lastDay || '';
      state.quota = o.quota || state.quota;
      state.ink = o.ink || 0;
      state.records = o.records || [];
    } catch (e) {}
  }
  function save() {
    sset(JSON.stringify({
      owned: state.owned, draws: state.draws, recent: state.recent,
      day: state.day, streak: state.streak, lastDay: state.lastDay,
      quota: state.quota, ink: state.ink, records: state.records,
    }));
  }

  /* ── 日期 ─────────────────────────────────────── */
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function yesterdayStr() {
    var d = new Date(Date.now() - 86400000);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /* ── 每日额度 ─────────────────────────────────── */
  function quotaLeft() {
    if (DEV_MODE) return 999;
    var t = todayStr();
    if (state.quota.d !== t) state.quota = { d: t, used: 0, bonus: 0, battleUsed: 0, battleBonus: 0 };
    return Math.max(0, FREE_PER_DAY + state.quota.bonus - state.quota.used);
  }
  function battleQuotaLeft() {
    if (DEV_MODE) return 999;
    var t = todayStr();
    if (state.quota.d !== t) state.quota = { d: t, used: 0, bonus: 0, battleUsed: 0, battleBonus: 0 };
    return Math.max(0, BATTLE_PER_DAY + (state.quota.battleBonus || 0) - (state.quota.battleUsed || 0));
  }
  function battleQuotaUse() {
    if (DEV_MODE) return;
    state.quota.battleUsed = (state.quota.battleUsed || 0) + 1;
    save();
    renderBattleQuota();
  }
  function grantBattleBonus() {
    var t = todayStr();
    if (state.quota.d !== t) state.quota = { d: t, used: 0, bonus: 0, battleUsed: 0, battleBonus: 0 };
    if ((state.quota.battleBonus || 0) >= BONUS_CAP) return false;
    state.quota.battleBonus = (state.quota.battleBonus || 0) + 1;
    save();
    renderBattleQuota();
    return true;
  }
  function quotaUse() {
    quotaLeft();
    state.quota.used++;
    save();
    renderQuota();
  }
  function grantBonus() {
    var t = todayStr();
    if (state.quota.d !== t) state.quota = { d: t, used: 0, bonus: 0 };
    if (state.quota.bonus >= BONUS_CAP) return false;
    state.quota.bonus++;
    save();
    renderQuota();
    return true;
  }
  function renderQuota() {
    var n = quotaLeft();
    var el = $('drawQuota');
    if (el) el.textContent = DEV_MODE ? '∞' : n;
    var btn = $('btnDraw');
    if (btn && !busy) {
      btn.textContent = n > 0 ? '拆 封' : '今日已尽';
      btn.disabled = n <= 0;
    }
    updateDailyBrief();
  }
  function renderBattleQuota() {
    var el = $('expQuota');
    if (el) el.textContent = DEV_MODE ? '∞' : battleQuotaLeft();
  }
  function updateDailyBrief() {
    var el = $('dailyBrief');
    if (!el) return;
    var day = state.day;
    var total = day && day.picks ? day.picks.length : 0;
    var done = 0;
    if (day && day.picks) day.picks.forEach(function (p) { if (p.done) done++; });
    el.textContent = total
      ? '今日 ' + done + ' / ' + total + '　·　连续 ' + (state.streak || 1) + ' 天'
      : '今日 0 / 6　·　连续 ' + (state.streak || 1) + ' 天';
  }

  /* ── 抽卡 ─────────────────────────────────────── */
  var HIDDEN_RATE = 0.003; // 隐藏款：只能抽到，等级上限 6
  if (DEV_MODE && /[?&]hid\b/.test(location.search)) HIDDEN_RATE = 1;
  // 抽到的卡片等级（概率）
  function weightedTier() {
    var W = window.TIER_WEIGHTS;
    var order = [5, 4, 3, 2, 1];
    var total = 0;
    for (var i = 0; i < order.length; i++) total += W[order[i]];
    var r = Math.random() * total;
    for (var j = 0; j < order.length; j++) {
      r -= W[order[j]];
      if (r <= 0) return order[j];
    }
    return 1;
  }

  // 单词等概率抽取，不再区分稀有度
  function drawWord(exclude) {
    var pool = WORDS.filter(function (w) {
      return state.recent.indexOf(w.w) < 0 && (!exclude || exclude.indexOf(w.w) < 0);
    });
    if (!pool.length) pool = WORDS.slice();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function rollBatch(n) {
    var picks = [], names = [];
    for (var i = 0; i < n; i++) {
      var w = drawWord(names);
      var hid = Math.random() < HIDDEN_RATE;
      picks.push({ w: w, lv: hid ? 5 : weightedTier(), hid: hid });
      names.push(w.w);
    }
    return picks;
  }

  // 返回本次重复转化的墨水数
  function collect(p) {
    var w = p.w, o = state.owned[w.w];
    state.draws++;
    state.recent.push(w.w);
    if (state.recent.length > 10) state.recent.shift();
    if (!o) {
      state.owned[w.w] = {
        m: 0, at: Date.now(), cl: p.lv, hid: p.hid,
        lv: w.w.split('').map(function () { return p.lv; }),
      };
      return 0;
    }
    var up = (p.hid && !o.hid) || p.lv > (o.cl || 1);
    if (up) {
      if (p.hid) o.hid = true;
      o.cl = Math.max(o.cl || 1, p.lv);
      o.lv = levelsOf(w).map(function (x) { return Math.max(x, p.lv); });
      return 0;
    }
    var got = DUP_INK[p.lv] || 6;
    state.ink += got;
    return got;
  }
  function rec(w) { return state.owned[w.w] || { m: 0, at: 0 }; }

  /* ── 卡片等级 / 字母等级 / 墨水 ─────────────────── */
  function cardLvOf(w) { var o = state.owned[w.w]; return o ? (o.cl || 1) : 0; }
  function capOf(w) { var o = state.owned[w.w]; return o && o.hid ? 6 : 5; }
  // 带卡片等级的展示对象，供渲染 / 战斗使用
  function viewOf(w) {
    var o = state.owned[w.w];
    if (!o) return w;
    return Object.assign({}, w, { tier: Math.min(5, o.cl || 1), lvl: o.cl || 1, hid: !!o.hid });
  }
  function levelsOf(w) {
    var o = state.owned[w.w];
    if (!o) return null;
    if (!o.lv || o.lv.length !== w.w.length) o.lv = w.w.split('').map(function () { return o.cl || 1; });
    return o.lv;
  }
  function upgradeCost(lv) { return 5 * lv; }
  function cardUpgradeCost(cl) { return 25 * cl; }
  function upgradeLetter(w, i) {
    var lv = levelsOf(w);
    if (!lv) return false;
    if (lv[i] >= cardLvOf(w)) { toast('字母已达卡片等级，先升级卡片'); return false; }
    var cost = upgradeCost(lv[i]);
    if (state.ink < cost) { toast('墨水不足，需要 ' + cost); return false; }
    state.ink -= cost;
    lv[i]++;
    save();
    refreshCounts();
    toast(w.w.charAt(i).toUpperCase() + ' 升至 Lv ' + lv[i]);
    return true;
  }
  function canUpgradeCard(w) {
    var cl = cardLvOf(w);
    return cl < capOf(w) && levelsOf(w).every(function (x) { return x >= cl; });
  }
  function upgradeCard(w) {
    var o = state.owned[w.w];
    if (!o) return false;
    if (o.cl >= capOf(w)) { toast('已达最高等级'); return false; }
    if (!canUpgradeCard(w)) { toast('所有字母升到 Lv ' + o.cl + ' 才能升级卡片'); return false; }
    var cost = cardUpgradeCost(o.cl);
    if (state.ink < cost) { toast('墨水不足，需要 ' + cost); return false; }
    state.ink -= cost;
    o.cl++;
    save();
    refreshCounts();
    toast('卡片升至 Lv ' + o.cl + '！');
    return true;
  }

  function refreshCounts() {
    var owned = 0, mastered = 0;
    for (var k in state.owned) {
      owned++;
      if (BY_WORD[k] && starsOf(BY_WORD[k]) >= 3) mastered++;
    }
    var map = { drawOwned: owned, drawInk: state.ink, mineOwned: owned,
      mineMastered: mastered, mineInk: state.ink, drawStreak: state.streak || 1 };
    for (var id in map) {
      var el = $(id);
      if (el) el.textContent = map[id];
    }
  }

  /* ── 基础 UI ──────────────────────────────────── */
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('show'); }, 1700);
  }
  function buzz(p) {
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {}
  }
  function mk(tag, cls) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  /* ── 抽卡流程 ─────────────────────────────────── */
  function draw() {
    if (busy) return;
    if (quotaLeft() <= 0) {
      toast('今日 ' + (FREE_PER_DAY + BONUS_CAP) + ' 次已用完，答题可换次数');
      return;
    }
    quotaUse();
    busy = true;
    var btn = $('btnDraw');
    btn.disabled = true;
    btn.textContent = '拆 封 中';

    var picks = rollBatch(3);
    var dupInk = 0;
    picks = picks.map(function (p) { dupInk += collect(p); return viewOf(p.w); });
    save();
    refreshCounts();

    stage.innerHTML = '';
    var pack = mk('div', 'pack');
    pack.innerHTML = '<div class="seal">抽</div><div class="cap">轻 触 拆 封</div>';
    stage.appendChild(pack);
    $('hint').textContent = '拆封中…';

    requestAnimationFrame(function () { pack.classList.add('shake'); });
    setTimeout(function () {
      pack.classList.add('burst');
      var r = pack.getBoundingClientRect();
      var best = picks.reduce(function (a, b) { return (b.hid ? 6 : b.tier) > (a.hid ? 6 : a.tier) ? b : a; }, picks[0]);
      var bLv = best.hid ? 6 : best.tier;
      FX.burst(bLv, {
        x: r.left + r.width / 2, y: r.top + r.height / 2,
        count: best.hid ? 200 : best.tier >= 5 ? 150 : best.tier >= 4 ? 116 : best.tier >= 3 ? 76 : 46,
      });
      packFlash(best.tier, best.hid);
      setTimeout(function () {
        showDeck(picks);
        if (dupInk) toast('重复卡已转化 · 墨水 +' + dupInk);
        busy = false;
        renderQuota();
        buzz(best.tier >= 4 ? [16, 40, 16, 40, 30] : 12);
      }, 360);
    }, 620);
  }

  function packFlash(tier, hid) {
    var lv = hid ? 6 : tier;
    var col = hid ? '#ffb3d0' : TIERS[tier].color;
    // 暗场：等级越高压得越沉，让光效跳出来
    var veil = mk('div', 'fx-veil');
    document.body.appendChild(veil);
    setTimeout(function () {
      veil.classList.add('out');
      setTimeout(function () { veil.parentNode && veil.parentNode.removeChild(veil); }, 760);
    }, lv >= 4 ? 900 : lv >= 3 ? 620 : 380);

    var beam = mk('div', 'beam');
    document.body.appendChild(beam);
    requestAnimationFrame(function () { beam.classList.add('go'); });
    setTimeout(function () { beam.parentNode && beam.parentNode.removeChild(beam); }, 720);

    // 冲击波：等级越高层数越多，C/SR 甚至没有
    var rings = lv >= 5 ? 3 : lv >= 4 ? 2 : lv >= 3 ? 1 : 0;
    for (var i = 0; i < rings; i++) (function (i) {
      setTimeout(function () {
        var r = mk('div', 'shock' + (hid ? ' ex' : ''));
        r.style.borderColor = hid ? 'rgba(255,226,160,.9)' : TIERS[tier].foil;
        document.body.appendChild(r);
        requestAnimationFrame(function () { r.classList.add('go'); });
        setTimeout(function () { r.parentNode && r.parentNode.removeChild(r); }, 780 + i * 120);
      }, i * 150);
    })(i);

    if (lv >= 3) {
      var rays = mk('div', 'rays');
      rays.style.background =
        'repeating-conic-gradient(from 0deg, ' + col + '00 0deg 6deg, ' + col + '99 6deg 7.6deg)';
      document.body.appendChild(rays);
      requestAnimationFrame(function () { rays.classList.add('go'); });
      setTimeout(function () { rays.parentNode && rays.parentNode.removeChild(rays); }, lv >= 5 ? 2600 : 1700);
    }
    // EX：反方向再叠一层彩虹放射
    if (lv >= 6) {
      var ex = mk('div', 'rays ex');
      document.body.appendChild(ex);
      requestAnimationFrame(function () { ex.classList.add('go'); });
      setTimeout(function () { ex.parentNode && ex.parentNode.removeChild(ex); }, 3000);
    }
    if (lv >= 4) {
      var b = mk('div', 'banner' + (hid ? ' ex' : ''));
      b.style.color = hid ? '#ffe6a8' : TIERS[tier].foil;
      b.textContent = hid ? 'EX · 隐藏款' : TIERS[tier].code + ' · ' + TIERS[tier].name;
      document.body.appendChild(b);
      setTimeout(function () { b.parentNode && b.parentNode.removeChild(b); }, 1900);
    }
    // LR / EX：全场扫光
    if (lv >= 5) {
      var fl = mk('div', 'screenflash');
      document.body.appendChild(fl);
      setTimeout(function () { fl.parentNode && fl.parentNode.removeChild(fl); }, 900);
    }
  }

  /* 一张可翻面的卡：背面先出，点击翻正面 */
  function makeFlipper(w) {
    var flip = mk('div', 'flipper');
    flip.style.width = Card.CARD_W + 'px';
    flip.style.height = Card.CARD_H + 'px';

    var backFace = mk('div', 'face back');
    backFace.appendChild(Card.renderBack(w.tier));

    var frontFace = mk('div', 'face front');
    var card = Card.render(w, { mastery: starsOf(w), levels: levelsOf(w) });
    frontFace.appendChild(card);

    flip.appendChild(backFace);
    flip.appendChild(frontFace);
    flip._word = w;
    flip._flipped = false;
    flip.onclick = function () { flipCard(flip); };
    return flip;
  }

  function flipCard(flip) {
    if (flip._flipped) {
      openDetail(flip._word);
      return;
    }
    flip._flipped = true;
    flip.classList.add('flipped');
    var w = flip._word;
    var lv = w.hid ? 6 : w.tier;
    var r = flip.getBoundingClientRect();
    FX.burst(lv, {
      x: r.left + r.width / 2, y: r.top + r.height * 0.4,
      count: lv >= 6 ? 150 : lv >= 5 ? 100 : lv >= 4 ? 64 : lv >= 3 ? 40 : 22,
    });
    if (lv >= 4) {
      var sh = mk('div', 'shock' + (w.hid ? ' ex' : ''));
      sh.style.borderColor = w.hid ? 'rgba(255,226,160,.9)' : TIERS[w.tier].foil;
      document.body.appendChild(sh);
      requestAnimationFrame(function () { sh.classList.add('go'); });
      setTimeout(function () { sh.parentNode && sh.parentNode.removeChild(sh); }, 800);
    }
    if (lv >= 5) packFlash(w.tier, w.hid);
    buzz(lv >= 4 ? [12, 30, 12] : 8);
    updateHint();
  }

  function showDeck(picks) {
    deckWords = picks;
    stage.innerHTML = '';
    deckEl = mk('div', 'deck');
    picks.forEach(function (w, i) {
      var slide = mk('div', 'slide' + (i === 0 ? ' on' : ''));
      slide.appendChild(makeFlipper(w));
      var tl = mk('div', 'tagline');
      tl.textContent = '· · ·';
      slide.appendChild(tl);
      deckEl.appendChild(slide);
    });
    stage.appendChild(deckEl);
    deckEl.addEventListener('scroll', onDeckScroll, { passive: true });

    activeIdx = 0;
    setTimeout(function () { syncDeckIndex(); }, 70);
  }

  function onDeckScroll() {
    if (!deckEl) return;
    var center = deckEl.scrollLeft + deckEl.clientWidth / 2;
    var slides = deckEl.children, idx = 0, best = Infinity;
    for (var i = 0; i < slides.length; i++) {
      var d = Math.abs(slides[i].offsetLeft + slides[i].offsetWidth / 2 - center);
      if (d < best) { best = d; idx = i; }
    }
    if (idx !== activeIdx) {
      activeIdx = idx;
      syncDeckIndex();
    }
  }

  function syncDeckIndex() {
    if (!deckEl) return;
    var slides = deckEl.children;
    for (var i = 0; i < slides.length; i++) slides[i].classList.toggle('on', i === activeIdx);
    updateHint();
  }

  function updateHint() {
    if (!deckEl) return;
    var slide = deckEl.children[activeIdx];
    if (!slide) return;
    var flip = slide.querySelector('.flipper');
    var w = flip && flip._word;
    if (!w) return;
    var tl = slide.querySelector('.tagline');
    if (flip._flipped) {
      if (tl) tl.textContent = TIERS[w.tier].code + ' · ' + TIERS[w.tier].name + ' · ' + (TAGS[w.tag] || '');
    }
    $('hint').textContent = (activeIdx + 1) + ' / ' + deckWords.length + ' · ' +
      (TAGS[w.tag] || '') + ' · 默写 ' + recWrite(w).wr + '/' + needOf(w) +
      (flip._flipped ? ' · 点卡片看详情' : ' · 点卡片翻面');
  }

  /* ── 主界面 Tab ───────────────────────────────── */
  var SCREENS = { draw: 'screenDraw', expedition: 'screenExpedition', mine: 'screenMine' };
  var curTab = 'draw';

  function switchTab(name) {
    if (!SCREENS[name]) return;
    curTab = name;
    for (var k in SCREENS) {
      var s = $(SCREENS[k]);
      if (s) s.classList.toggle('on', k === name);
    }
    var tabs = document.querySelectorAll('#tabbar .tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === name);
    }
    if (name === 'expedition') renderExpedition();
    if (name === 'mine') renderMine();
    if (name === 'draw') { refreshCounts(); renderQuota(); updateDailyBrief(); }
  }

  /* ── 远征页 ───────────────────────────────────── */
  var expKind = 'all';
  var expSortMode = 'lv';
  var expPick = null;
  var expRenderToken = 0;
  // 分类按卡片等级，不再按所谓"卡片类型"（一张卡本来就有多种字母弹种）
  var EXP_KINDS = [
    ['all', '全部'], ['low', 'Lv1-2'], ['mid', 'Lv3-4'], ['high', 'Lv5'], ['ex', 'EX']
  ];

  function shotKindOf(w) {
    if (Card.dominantKind) return Card.dominantKind(w);
    var p = String(w.pos || '').toLowerCase();
    if (p.indexOf('adv') === 0) return 'shield';
    if (p.indexOf('adj') === 0) return 'frost';
    if (p.indexOf('v') === 0) return 'pierce';
    return 'blast';
  }

  function renderExpTabs() {
    var box = $('expTabs');
    if (!box) return;
    box.innerHTML = '';
    EXP_KINDS.forEach(function (k) {
      var b = mk('button', expKind === k[0] ? 'on' : '');
      b.type = 'button';
      b.textContent = k[1];
      b.onclick = function () { expKind = k[0]; renderExpedition(); };
      box.appendChild(b);
    });
  }

  function expPool() {
    var list = [];
    for (var i = 0; i < WORDS.length; i++) {
      if (state.owned[WORDS[i].w]) list.push(viewOf(WORDS[i]));
    }
    if (expSortMode === 'new') {
      list.sort(function (a, b) { return (rec(b).at || 0) - (rec(a).at || 0); });
    } else {
      list.sort(function (a, b) {
        return (b.lvl || 1) - (a.lvl || 1) || (rec(b).at || 0) - (rec(a).at || 0);
      });
    }
    if (expKind !== 'all') {
      list = list.filter(function (w) {
        var lv = w.lvl || 1;
        if (expKind === 'ex') return !!w.hid;
        if (expKind === 'high') return !w.hid && lv >= 5;
        if (expKind === 'mid') return lv === 3 || lv === 4;
        if (expKind === 'low') return lv <= 2;
        return true;
      });
    }
    return list;
  }

  // 真实卡面缩略图：整张卡等比缩小
  function cardThumb(w, width) {
    var scale = width / Card.CARD_W;
    var box = mk('div', 'cthumb');
    box.style.width = width + 'px';
    box.style.height = Math.round(Card.CARD_H * scale) + 'px';
    // 圆角跟着缩放走，否则和外框对不上会被切掉
    box.style.borderRadius = Math.max(3, Math.round(16 * scale)) + 'px';
    var inner = Card.render(w, { mastery: starsOf(w), levels: levelsOf(w) });
    inner.classList.add('cthumb-in');
    inner.style.transform = 'scale(' + scale + ')';
    box.appendChild(inner);
    return box;
  }

  function syncExpDock(w) {
    var btn = $('expStart');
    var info = $('expPickInfo');
    if (!btn || !info) return;
    if (!w) {
      btn.disabled = true;
      info.textContent = '请选择一张词卡';
      return;
    }
    if (battleQuotaLeft() <= 0) {
      btn.disabled = true;
      info.textContent = '今日远征次数已用完，默写可换次数';
      return;
    }
    btn.disabled = false;
    info.innerHTML = '已选 <b>' + w.w + '</b>　·　' +
      (w.hid ? 'EX 隐藏款' : 'Lv' + (w.lvl || 1)) +
      '　·　' + (w.w.length) + ' 字母';
  }

  function renderExpedition() {
    if (!$('expList')) return;
    var token = ++expRenderToken;
    renderExpTabs();
    renderBattleQuota();

    var pool = expPool();
    var box = $('expList');
    box.innerHTML = '';
    $('expCount').textContent = pool.length + ' 张可选';

    var sortBtn = $('expSort');
    sortBtn.textContent = expSortMode === 'lv' ? '等级优先' : '最近获得';
    sortBtn.onclick = function () {
      expSortMode = expSortMode === 'lv' ? 'new' : 'lv';
      renderExpedition();
    };

    if (!pool.length) {
      expPick = null;
      box.innerHTML =
        '<div class="exp-empty">' +
          '<p>' + (Object.keys(state.owned).length ? '这个等级还没有词卡' : '还没有词卡') + '</p>' +
          '<span>先去抽卡，再来远征</span>' +
          '<button class="btn" id="expGoDraw">去抽卡</button>' +
        '</div>';
      var go = $('expGoDraw');
      if (go) go.onclick = function () { switchTab('draw'); };
      syncExpDock(null);
      return;
    }

    var found = null;
    for (var i = 0; i < pool.length; i++) if (pool[i].w === expPick) found = pool[i];
    if (!found) { found = pool[0]; expPick = found.w; }

    var width = Math.min(112, Math.floor((Math.min(430, window.innerWidth) - 36 - 20) / 3));
    var idx = 0;
    (function chunk() {
      if (token !== expRenderToken) return;
      var end = Math.min(pool.length, idx + 24);
      for (; idx < end; idx++) box.appendChild(buildExpCard(pool[idx], width, box));
      if (idx < pool.length) requestAnimationFrame(chunk);
    })();
    syncExpDock(found);
  }

  function buildExpCard(w, width, box) {
    var item = mk('button', 'exp-card' + (w.w === expPick ? ' on' : ''));
    item.type = 'button';
    var thumb = cardThumb(w, width);
    item.appendChild(thumb);

    // 只保留等级标记，预览不再堆属性
    var lv = mk('span', 'exp-lv' + (w.hid ? ' hid' : ''));
    lv.textContent = w.hid ? 'EX' : 'Lv' + (w.lvl || 1);
    thumb.appendChild(lv);

    var nm = mk('span', 'exp-nm');
    nm.textContent = w.w;
    item.appendChild(nm);

    item.onclick = function () {
      expPick = w.w;
      var all = box.querySelectorAll('.exp-card');
      for (var ai = 0; ai < all.length; ai++) all[ai].classList.remove('on');
      item.classList.add('on');
      syncExpDock(w);
    };
    return item;
  }

  function battleApi() {
    return {
      getOwned: function () { return state.owned; },
      levelsOf: levelsOf,
      viewOf: viewOf,
      starsOf: starsOf,
      onStrongWrite: function (w) {
        // 强射写对也计入默写成长
        var o = recWrite(w);
        o.wr++;
        o.m = starsOf(w);
        save();
        refreshCounts();
        rewardWrite();
      },
      onStart: function () {
        if (battleQuotaLeft() <= 0) {
          toast('今日远征次数已用完，默写可换次数');
          return false;
        }
        battleQuotaUse();
        return true;
      },
      onExit: function () {
        renderExpedition();
        refreshCounts();
      },
      onReward: function (n, info) {
        var t = todayStr();
        if (state.quota.d !== t) state.quota = { d: t, used: 0, bonus: 0, battleUsed: 0, battleBonus: 0 };
        state.quota.battleBonus = (state.quota.battleBonus || 0) + n;
        var ink = (info && info.ink) || 0;
        state.ink += ink;
        if (info) pushRecord(info);
        save();
        renderBattleQuota();
        refreshCounts();
        if (curTab === 'mine') renderMine();
        toast('远征奖励 · 墨水 +' + ink + (n ? ' · 远征 +' + n : ''));
      },
    };
  }

  function startExpedition() {
    if (!expPick) { toast('先选择一张词卡'); return; }
    var w = BY_WORD[expPick];
    if (!w) { toast('词卡不存在'); return; }
    if (battleQuotaLeft() <= 0) { toast('今日远征次数已用完，默写可换次数'); return; }
    if (!window.Battle || !window.Battle.start) { toast('远征模块未加载'); return; }
    window.Battle.start([viewOf(w)], battleApi());
  }

  function pushRecord(info) {
    state.records = state.records || [];
    state.records.unshift({
      at: Date.now(),
      win: !!info.win,
      word: info.word || (expPick || ''),
      waves: info.waves || 0,
      kills: info.kills || 0,
      strong: info.strong || 0,
      ink: info.ink || 0,
      grade: info.grade || '',
    });
    if (state.records.length > 30) state.records.length = 30;
  }

  /* ── 我的：图鉴 / 战绩 / 成就 ─────────────────── */
  var curPane = 'book';

  function renderMine() {
    refreshCounts();
    showMinePane(curPane);
  }

  function showMinePane(name) {
    curPane = name;
    var tabs = document.querySelectorAll('#mineTabs button');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('on', tabs[i].getAttribute('data-pane') === name);
    }
    var panes = { book: 'paneBook', record: 'paneRecord', ach: 'paneAch' };
    for (var k in panes) {
      var p = $(panes[k]);
      if (p) p.classList.toggle('on', k === name);
    }
    if (name === 'book') { renderBookTabs(); renderChips(); renderSort(); renderGrid(); }
    if (name === 'record') renderRecords();
    if (name === 'ach') renderAchievements();
  }

  function renderRecords() {
    var box = $('paneRecord');
    if (!box) return;
    var list = state.records || [];
    var wins = 0, best = 0, ink = 0, kills = 0;
    list.forEach(function (r) {
      if (r.win) wins++;
      if ((r.waves || 0) > best) best = r.waves;
      ink += r.ink || 0;
      kills += r.kills || 0;
    });
    var rate = list.length ? Math.round(wins / list.length * 100) : 0;

    var html =
      '<div class="rec-sum">' +
        '<div><b>' + list.length + '</b><span>远征次数</span></div>' +
        '<div><b>' + wins + '</b><span>胜利</span></div>' +
        '<div><b>' + rate + '%</b><span>胜率</span></div>' +
        '<div><b>' + best + '</b><span>最高关</span></div>' +
      '</div>';

    if (!list.length) {
      box.innerHTML = html +
        '<div class="rec-empty"><p>还没有战绩</p><span>打一场远征，记录会出现在这里</span>' +
        '<button class="btn" id="recGoExp">去远征</button></div>';
      var go = $('recGoExp');
      if (go) go.onclick = function () { switchTab('expedition'); };
      return;
    }

    var rows = list.map(function (r) {
      var d = new Date(r.at);
      var date = (d.getMonth() + 1) + '.' + d.getDate();
      return '<div class="rec">' +
        '<span class="rec-badge ' + (r.win ? 'win' : 'lose') + '">' + (r.win ? '胜' : '败') + '</span>' +
        '<div class="rec-main">' +
          '<p class="rec-w">' + (r.word || '—') + '</p>' +
          '<p class="rec-sub">' + (r.waves || 0) + ' / 5 关　·　击杀 ' + (r.kills || 0) +
            '　·　强射 ' + (r.strong || 0) + '</p>' +
        '</div>' +
        '<div class="rec-right"><b>+' + (r.ink || 0) + '</b><span>墨水</span><em>' + date + '</em></div>' +
      '</div>';
    }).join('');
    box.innerHTML = html + '<div class="rec-list">' + rows + '</div>' +
      '<p class="rec-total">累计 ' + list.length + ' 场 · 击杀 ' + kills + ' · 墨水 ' + ink + '</p>';
  }

  function openBook() {
    switchTab('mine');
    showMinePane('book');
  }

  var bookTab = 'cards';
  var bookTier = 0;

  function renderBookTabs() {
    var box = $('bookTabs');
    box.innerHTML = '';
    [['cards', '卡片收藏'], ['atlas', '字母图鉴']].forEach(function (t) {
      var b = mk('button', 'btab' + (bookTab === t[0] ? ' on' : ''));
      b.textContent = t[1];
      b.onclick = function () { bookTab = t[0]; renderBookTabs(); };
      box.appendChild(b);
    });
    $('bookCards').style.display = bookTab === 'cards' ? '' : 'none';
    $('atlas').style.display = bookTab === 'atlas' ? '' : 'none';
    if (bookTab === 'atlas' && !$('atlas').innerHTML) $('atlas').innerHTML = atlasHTML();
  }

  var SORTS = [
    { k: 'tier', nm: '稀有度' },
    { k: 'str', nm: '伤害' },
    { k: 'wis', nm: '技能' },
    { k: 'res', nm: '连击' },
    { k: 'new', nm: '最新' },
  ];

  function renderSort() {
    var box = $('sorts');
    if (!box) return;
    box.innerHTML = '<span class="chip-lab">排序</span>';
    SORTS.forEach(function (o) {
      var b = mk('button', 'chip' + (bookSort === o.k ? ' on' : ''));
      b.textContent = o.nm;
      b.onclick = function () { bookSort = o.k; renderSort(); renderGrid(); };
      box.appendChild(b);
    });
  }

  function sortWords(list) {
    var arr = list.slice();
    if (bookSort === 'new') {
      arr.sort(function (a, b2) { return (rec(b2).at || 0) - (rec(a).at || 0); });
    } else if (bookSort === 'tier') {
      arr.sort(function (a, b2) { return cardLvOf(b2) - cardLvOf(a) || (state.owned[b2.w] && state.owned[b2.w].hid ? 1 : 0) - (state.owned[a.w] && state.owned[a.w].hid ? 1 : 0) || a.w.length - b2.w.length; });
    } else {
      arr.sort(function (a, b2) {
        var d = Card.statsOf(viewOf(b2), levelsOf(b2))[bookSort] - Card.statsOf(viewOf(a), levelsOf(a))[bookSort];
        return d || cardLvOf(b2) - cardLvOf(a);
      });
    }
    return arr;
  }

  function renderChips() {
    var box = $('chips');
    box.innerHTML = '<span class="chip-lab">筛选</span>';
    [['got', '已获得'], ['locked', '未获得'], ['all', '全部']].forEach(function (o) {
      var b = mk('button', 'chip' + (bookFilter === o[0] ? ' on' : ''));
      b.textContent = o[1];
      b.onclick = function () { bookFilter = o[0]; renderChips(); renderGrid(); };
      box.appendChild(b);
    });
    box.appendChild(mk('i', 'chip-sep'));
    [0, 1, 2, 3, 4, 5].forEach(function (t) {
      var b = mk('button', 'chip' + (bookTier === t ? ' on' : ''));
      b.textContent = t ? TIERS[t].code : '全稀有度';
      b.onclick = function () { bookTier = t; renderChips(); renderGrid(); };
      box.appendChild(b);
    });
  }

  function renderGrid() {
    var grid = $('grid');
    grid.innerHTML = '';
    var list = sortWords(WORDS.filter(function (w) {
      var got = !!state.owned[w.w];
      if (bookFilter === 'got' && !got) return false;
      if (bookFilter === 'locked' && got) return false;
      return !bookTier || cardLvOf(w) === bookTier;
    }));
    if (!list.length) {
      grid.innerHTML = '<div class="grid-empty">' + (bookFilter === 'got' ? '还没有获得卡片，去拆封吧' : '没有符合条件的卡片') + '</div>';
    }
    list.forEach(function (w) {
      var got = !!state.owned[w.w];
      var tier = Math.max(1, Math.min(5, cardLvOf(w)));
      var el = mk('div', 'mini r' + tier + ' ' + (got ? 'got' : 'locked'));
      var first = w.w.charAt(0).toUpperCase();
      var inner = '<div class="mi">' + (got ? '<span class="t">' + (state.owned[w.w].hid ? 'EX' : TIERS[tier].code) + '</span>' : '');
      if (got) {
        var lv = levelsOf(w);
        var hid = state.owned[w.w].hid;
        if (hid) el.classList.add('hid');
        inner += '<span class="lvt">Lv' + cardLvOf(w) + '</span>' +
          '<div class="mt">' + Card.typeTileSVG(first, lv[0] || 1, 54, { mythic: hid }) + '</div>' +
          '<span class="mw">' + w.w + '</span>';
        el.onclick = function () { openDetail(w); };
      } else {
        var cn = w.senses && w.senses.length ? w.senses[0].cn : (w.cn || '');
        inner += '<div class="mt q">?</div>' +
          '<span class="mw">' + new Array(w.w.length + 1).join('_ ').trim() + '</span>' +
          '<span class="mc">' + cn + '</span>';
      }
      el.innerHTML = inner + '</div>';
      grid.appendChild(el);
    });
    var owned = 0;
    for (var k in state.owned) owned++;
    $('bookStat').textContent = '已获得 ' + owned + ' / ' + WORDS.length;
  }

  /* ── 字母图鉴 ─────────────────────────────────── */
  function atlasHTML() {
    var out = '<p class="at-intro">字母决定攻击效果；等级越高，背景越华丽、效果越强。隐藏款只能抽到，字母使用哥特体和彩虹描边，最高可升到 Lv6。</p>';
    [['护盾', 'A E I O U', '获得护盾', 'A'], ['散射', 'B P R G', '三向散射', 'B'],
     ['减速', 'C F S T', '冰缓敌人', 'S'], ['激光', 'D K M N V W X Z', '贯穿激光', 'K'],
     ['追踪', 'H J L Q Y', '自动追敌', 'L']].forEach(function (t) {
      var h = '<div class="at-tiles">';
      for (var lv = 1; lv <= 5; lv++) h += '<div class="at-cell">' + Card.typeTileSVG(t[3], lv, 46) + 'Lv' + lv + '</div>';
      h += '<div class="at-cell mythic">' + Card.typeTileSVG(t[3], 5, 46, { mythic: true }) + '隐藏款</div>';
      out += '<div class="at-row"><div class="at-lab"><b>' + t[0] + '</b><span>' + t[1] + ' · ' + t[2] + '</span></div>' + h + '</div></div>';
    });
    return out;
  }

  function countMastered() {
    var n = 0;
    for (var k in state.owned) if (BY_WORD[k] && starsOf(BY_WORD[k]) >= 3) n++;
    return n;
  }

  function tierLabel(w) {
    var v = viewOf(w);
    if (v.hid) return '隐藏款 · EX';
    return TIERS[v.tier].name + ' · ' + TIERS[v.tier].code;
  }

  function openDetail(w0) {
    var w = viewOf(w0);
    var box = $('detailCard');
    box.innerHTML = '';
    box.appendChild(Card.render(w, { mastery: starsOf(w), levels: levelsOf(w) }));
    $('detailTier').textContent = tierLabel(w);
    var acts = $('detailActions');
    acts.innerHTML = '';
    var b1 = mk('button', 'btn primary');
    b1.textContent = '默 写';
    b1.onclick = function () { startWrite(w0); };
    var b2 = mk('button', 'btn');
    b2.textContent = '存为图片';
    b2.onclick = function () { exportImage(w); };
    acts.appendChild(b1);
    acts.appendChild(b2);
    renderUpgrade(w0);

    var st = Card.statsOf(w, levelsOf(w));
    var at = rec(w).at ? new Date(rec(w).at) : null;
    $('detailEntry').innerHTML = entryHTML(w);
    $('detailMeta').innerHTML =
      '等级 <span>' + tierLabel(w) + '</span><br>' +
      '默写 <span>' + recWrite(w).wr + ' / ' + needOf(w) + '</span>　·　看答案 <span>' +
      recWrite(w).pk + ' 次</span><br>' +
      (at ? '收于 <span>' + at.getFullYear() + '.' + (at.getMonth() + 1) + '.' + at.getDate() + '</span><br>' : '') +
      '伤害 <span>' + st.str + '</span>　·　技能 <span>' + st.wis + '</span>　·　连击 <span>' + st.res + '</span>';
    $('detail').classList.add('open');
  }

  function renderUpgrade(w) {
    var box = $('detailLv');
    if (!box) {
      box = mk('div', 'lv-panel');
      box.id = 'detailLv';
      var acts = $('detailActions');
      acts.parentNode.insertBefore(box, acts.nextSibling);
    }
    var lv = levelsOf(w);
    if (!lv) { box.innerHTML = ''; return; }
    var cl = cardLvOf(w), cap = capOf(w);
    box.innerHTML = '<div class="lv-head">养成 <span>墨水 ' + state.ink + '</span></div>';

    var cardRow = mk('div', 'lv-card');
    var maxed = cl >= cap;
    var ready = canUpgradeCard(w);
    cardRow.innerHTML = '<div><b>卡片 Lv ' + cl + '</b><span>最高 Lv ' + cap + ' · 字母上限 = 卡片等级</span></div>';
    var cb = mk('button', 'btn lv-up' + (ready ? ' ready' : ''));
    cb.textContent = maxed ? '已满级' : '升级 · ' + cardUpgradeCost(cl);
    if (maxed) cb.disabled = true;
    cb.onclick = function () { if (upgradeCard(w)) openDetail(w); };
    cardRow.appendChild(cb);
    box.appendChild(cardRow);
    if (!maxed && !ready) box.insertAdjacentHTML('beforeend', '<div class="lv-tip">所有字母升到 Lv ' + cl + ' 后才能升级卡片</div>');

    var row = mk('div', 'lv-row');
    w.w.toUpperCase().split('').forEach(function (ch, i) {
      var b = mk('button', 'lv-btn');
      var k = Card.letterKind(ch);
      var full = lv[i] >= cl;
      b.style.setProperty('--k', Card.KINDS[k].c);
      b.innerHTML = '<b>' + ch + '</b><i>Lv' + lv[i] + '</i><em>' + (full ? '已满' : upgradeCost(lv[i])) + '</em>';
      if (full) b.disabled = true;
      b.onclick = function () { if (upgradeLetter(w, i)) openDetail(w); };
      row.appendChild(b);
    });
    box.appendChild(row);
  }

  /* ── 词条（详情页完整释义）───────────────────── */
  function entryHTML(w) {
    var poses = { n: 'n.', v: 'v.', adj: 'adj.', adv: 'adv.' };
    var rows = '';
    if (w.senses && w.senses.length) {
      w.senses.forEach(function (x, i) {
        rows += '<div class="ei"><span class="no">' + (i + 1) + '</span>' +
          '<span class="pos">' + (poses[x.pos] || poses[w.pos] || '') + '</span>' +
          '<span class="txt">' + x.cn + '</span></div>';
      });
    } else {
      rows = '<div class="ei"><span class="no">1</span>' +
        '<span class="pos">' + (poses[w.pos] || '') + '</span>' +
        '<span class="txt">' + (w.cn || '') + '</span></div>';
    }
    var exs = (w.exs && w.exs.length) ? w.exs : (w.ex ? [{ en: w.ex, cn: w.exCn }] : []);
    var exHtml = exs.map(function (e) {
      return '<div class="ee"><p class="en">' + e.en + '</p><p class="cn">' + e.cn + '</p></div>';
    }).join('');
    return '<div class="entry">' + rows + '</div>' +
      (exHtml ? '<div class="exlist">' + exHtml + '</div>' : '');
  }

  /* ── 导出图片 ─────────────────────────────────── */
  function exportImage(w) {
    var scale = 3;
    var cv = document.createElement('canvas');
    cv.width = Card.CARD_W * scale;
    cv.height = Card.CARD_H * scale;
    var ctx = cv.getContext('2d');
    Card.drawToCanvas(ctx, cv.width, cv.height, w, { mastery: starsOf(w) });
    var url = cv.toDataURL('image/png');

    var ov = mk('div');
    ov.style.cssText =
      'position:fixed;inset:0;z-index:96;background:rgba(12,9,6,.97);display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:16px;padding:26px;';
    ov.innerHTML =
      '<img src="' + url + '" style="max-width:100%;max-height:70vh;box-shadow:0 24px 60px -24px #000">' +
      '<div style="font-size:11px;letter-spacing:.22em;color:rgba(242,233,216,.45)">长按图片保存</div>';
    var close = mk('button', 'btn');
    close.textContent = '关 闭';
    close.style.cssText = 'padding:0 34px;height:42px;flex:0 0 auto';
    close.onclick = function () { ov.parentNode.removeChild(ov); };
    ov.appendChild(close);
    document.body.appendChild(ov);
  }

  /* ── 今日词历 ─────────────────────────────────── */
  function ensureDay() {
    var t = todayStr();
    if (state.day && state.day.d === t) return;
    // 3 个新词 + 1 个复习
    var picks = [], names = [];
    var fresh = WORDS.filter(function (w) { return !state.owned[w.w]; });
    if (fresh.length < 3) fresh = WORDS.slice();
    for (var i = 0; i < 4; i++) {
      var w = pickFrom(fresh, names);
      if (!w) break;
      picks.push({ w: w.w, kind: 'new', done: false });
      names.push(w.w);
    }
    var review = WORDS.filter(function (w) {
      return state.owned[w.w] && BY_WORD[w.w] && starsOf(BY_WORD[w.w]) < 3 && names.indexOf(w.w) < 0;
    });
    if (!review.length) review = WORDS.filter(function (w) { return names.indexOf(w.w) < 0; });
    for (var rv = 0; rv < 2; rv++) {
      var rw = pickFrom(review, names);
      if (!rw) break;
      picks.push({ w: rw.w, kind: 'review', done: false });
      names.push(rw.w);
    }

    // 连续天数
    if (state.lastDay) {
      if (state.lastDay === yesterdayStr()) state.streak = (state.streak || 0) + 1;
      else if (state.lastDay !== t) state.streak = 1;
    } else state.streak = 1;
    state.lastDay = t;

    state.day = { d: t, picks: picks };
    save();
  }

  function pickFrom(arr, exclude) {
    var pool = arr.filter(function (w) { return exclude.indexOf(w.w) < 0; });
    if (!pool.length) pool = arr;
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function openDaily() {
    ensureDay();
    renderDaily();
    $('daily').classList.add('open');
  }

  function renderDaily() {
    var day = state.day;
    var doneN = day.picks.filter(function (p) { return p.done; }).length;
    $('dailyStreak').textContent = '连续 ' + (state.streak || 1) + ' 天';
    $('dailyNote').innerHTML = '今日 <b>' + doneN + ' / ' + day.picks.length + '</b>' +
      '　·　4 个新词 + 2 个复习　·　点卡片揭晓';
    updateDailyBrief();

    var grid = $('dailyGrid');
    grid.innerHTML = '';
    day.picks.forEach(function (p, i) {
      var w = BY_WORD[p.w];
      if (!w) return;
      var cell = mk('div', 'dcell' + (p.done ? ' done' : ''));
      var kind = p.kind === 'review' ? '复习' : '新词';
      if (!p.done) {
        cell.innerHTML = '<span class="k">' + kind + '</span><div class="emblem">' +
          TIERS[w.tier].code + '</div>';
        cell.onclick = function () {
          p.done = true;
          if (!state.owned[w.w]) state.owned[w.w] = { m: 0, at: Date.now() };
          state.draws++;
          save();
          refreshCounts();
          renderDaily();
          FX.sprinkle(14, w.tier);
          buzz(10);
        };
      } else {
        cell.innerHTML = '<span class="k">' + kind + '</span><div class="w">' + w.w +
          '</div><div class="c">' + w.cn + '</div>';
        cell.onclick = function () { startWrite(w); };
      }
      grid.appendChild(cell);
    });
  }

  function renderAchievements() {
    var owned = Object.keys(state.owned).length;
    var mastered = countMastered();
    var t5 = 0, maxLv = 0;
    for (var k in state.owned) {
      var w = BY_WORD[k];
      if (!w) continue;
      if (cardLvOf(w) >= 5) t5++;
      if (cardLvOf(w) > maxLv) maxLv = cardLvOf(w);
    }
    var recs = state.records || [];
    var wins = 0;
    recs.forEach(function (r) { if (r.win) wins++; });

    var list = [
      { nm: '初开卷', d: '收集 10 张词卡', cur: owned, max: 10 },
      { nm: '藏书家', d: '收集 100 张词卡', cur: owned, max: 100 },
      { nm: '半部词册', d: '收集一半词卡', cur: owned, max: Math.round(WORDS.length / 2) },
      { nm: '通晓十词', d: '10 个单词默写满星', cur: mastered, max: 10 },
      { nm: '通晓五十', d: '50 个单词默写满星', cur: mastered, max: 50 },
      { nm: '拾得孤本', d: '获得一张 Lv5 词卡', cur: t5, max: 1 },
      { nm: '连续七日', d: '连续 7 天打开词册', cur: state.streak || 1, max: 7 },
      { nm: '抽满百次', d: '累计拆封 100 次', cur: state.draws, max: 100 },
      { nm: '远征首胜', d: '第一次通关远征', cur: wins, max: 1 },
      { nm: '远征十胜', d: '累计通关 10 次', cur: wins, max: 10 },
    ];
    var unlocked = list.filter(function (a) { return a.cur >= a.max; }).length;

    var box = $('paneAch');
    if (!box) return;
    var html = '<div class="ach-head">已解锁 <b>' + unlocked + '</b> / ' + list.length + '</div>' +
      '<div class="ach-list">';
    list.forEach(function (a) {
      var on = a.cur >= a.max;
      var pct = Math.min(100, Math.round(a.cur / a.max * 100));
      html += '<div class="ach-row' + (on ? ' on' : '') + '">' +
        '<div class="ach-ic">' + (on ? '✓' : '·') + '</div>' +
        '<div class="ach-main">' +
          '<div class="ach-top"><b>' + a.nm + '</b><span>' + Math.min(a.cur, a.max) + ' / ' + a.max + '</span></div>' +
          '<p>' + a.d + '</p>' +
          '<div class="ach-bar"><i style="width:' + pct + '%"></i></div>' +
        '</div>' +
      '</div>';
    });
    box.innerHTML = html + '</div>';
  }

  /* ── 默写 ─────────────────────────────────────── */
  // 规则：每词需默写 3 次满星；看一次答案，需求 +1，已写次数不变 → 必须多写
  var WRITE_BASE = 3;
  var PEEK_PENALTY = 1;
  var curWrite = null;

  function recWrite(w) {
    var o = state.owned[w.w] || (state.owned[w.w] = { m: 0, at: Date.now(), wr: 0, pk: 0 });
    if (o.wr === undefined) o.wr = 0;
    if (o.pk === undefined) o.pk = 0;
    return o;
  }
  function needOf(w) {
    var o = recWrite(w);
    return Math.min(8, WRITE_BASE + o.pk * PEEK_PENALTY);
  }
  function starsOf(w) {
    var o = recWrite(w);
    var need = needOf(w);
    if (!need) return 0;
    return Math.max(0, Math.min(3, Math.floor((o.wr * 3) / need)));
  }

  function startWrite(w) {
    curWrite = { w: w, tries: 0, revealed: false, mode: 'pick', picks: [], bank: buildBank(w) };
    $('quiz').classList.add('open');
    renderWrite();
  }

  // 字母池：正确字母打乱 + 1~2 个干扰字母
  function buildBank(w) {
    var letters = w.w.toLowerCase().split('');
    var pool = letters.slice();
    var extra = Math.min(2, Math.max(1, 6 - letters.length + 1));
    var used = {};
    for (var i = 0; i < letters.length; i++) used[letters[i]] = 1;
    var alpha = 'abcdefghijklmnopqrstuvwxyz';
    var guard = 0;
    while (extra > 0 && guard++ < 200) {
      var ch = alpha[(Math.random() * 26) | 0];
      if (used[ch]) continue;
      used[ch] = 1;
      pool.push(ch);
      extra--;
    }
    for (var j = pool.length - 1; j > 0; j--) {
      var k = (Math.random() * (j + 1)) | 0, t = pool[j];
      pool[j] = pool[k]; pool[k] = t;
    }
    return pool;
  }

  function renderWrite() {
    var w = curWrite.w;
    var o = recWrite(w);
    var need = needOf(w);
    var poses = { n: 'n.', v: 'v.', adj: 'adj.', adv: 'adv.' };

    $('qKind').textContent = '默 写';
    $('qProg').textContent = (TAGS[w.tag] || '') + '　·　' + o.wr + ' / ' + need + ' 次';

    var senses = (w.senses && w.senses.length) ? w.senses : [{ pos: w.pos, cn: w.cn }];
    var cnHtml = senses.map(function (x, i) {
      return '<div class="wcn-item"><span class="pos">' + (poses[x.pos] || '') + '</span>' + x.cn + '</div>';
    }).join('');

    var mode = curWrite.mode || 'pick';
    var body = $('qBody');
    body.innerHTML =
      '<div class="wcn">' + cnHtml + '</div>' +
      '<div class="wmeta">' + (w.w.length) + ' 个字母' +
      (curWrite.revealed ? '　·　' + (w.ph || '') : '') + '</div>' +
      '<div id="wMain"></div>' +
      '<div class="wbar"><span id="wBarFill" style="width:' +
      Math.min(100, (o.wr / need) * 100).toFixed(1) + '%"></span></div>' +
      '<div class="wacts">' +
      '<button class="btn" id="wMode">' + (mode === 'pick' ? '⌨ 手写' : '◈ 点选') + '</button>' +
      '<button class="btn" id="wPeek">看答案</button>' +
      (mode === 'type' ? '<button class="btn primary" id="wSubmit">提 交</button>' : '') +
      '</div>' +
      '<div class="wfoot" id="wFoot"></div>';

    renderMain();
    $('wMode').onclick = function () {
      curWrite.mode = mode === 'pick' ? 'type' : 'pick';
      renderWrite();
    };
    $('wPeek').onclick = peekAnswer;
    renderPeekState();
  }

  function renderMain() {
    var box = $('wMain');
    if (!box) return;
    var w = curWrite.w;
    if (curWrite.mode === 'type') {
      box.innerHTML = '<input id="wInput" class="winput" type="text" autocomplete="off" autocorrect="off" ' +
        'autocapitalize="off" spellcheck="false" placeholder="默写这个单词">';
      var inp = $('wInput');
      inp.onkeydown = function (e) { if (e.key === 'Enter') submitTyped(); };
      inp.oninput = function () { $('wFoot').innerHTML = ''; };
      $('wSubmit').onclick = submitTyped;
      setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
      return;
    }
    box.innerHTML =
      '<div class="wslots" id="wSlots"></div>' +
      '<div class="wbank" id="wBank"></div>' +
      '<div class="wtips"><button id="wUndo">退格</button><button id="wClear">清空</button>' +
      '<span>按顺序点字母</span></div>';
    renderSlots();
    var bank = $('wBank');
    curWrite.bank.forEach(function (ch, i) {
      var b = mk('button', 'wkey');
      b.type = 'button';
      b.textContent = ch;
      b.setAttribute('data-i', i);
      b.onclick = function () { pickLetter(i); };
      bank.appendChild(b);
    });
    syncBank();
    $('wUndo').onclick = undoPick;
    $('wClear').onclick = clearPicks;
    $('wFoot').innerHTML = '';
  }

  function renderSlots() {
    var box = $('wSlots');
    if (!box) return;
    var n = curWrite.w.w.length;
    var html = '';
    for (var i = 0; i < n; i++) {
      var idx = curWrite.picks[i];
      var ch = idx != null ? curWrite.bank[idx] : '';
      html += '<span class="wslot' + (ch ? ' on' : '') + '" data-i="' + i + '">' + (ch || '') + '</span>';
    }
    box.innerHTML = html;
  }

  function syncBank() {
    var bank = $('wBank');
    if (!bank) return;
    var used = {};
    curWrite.picks.forEach(function (i) { used[i] = 1; });
    for (var i = 0; i < bank.children.length; i++) {
      var b = bank.children[i];
      b.classList.toggle('used', !!used[b.getAttribute('data-i')]);
    }
  }

  function pickLetter(i) {
    if (curWrite.lock) return;
    var n = curWrite.w.w.length;
    if (curWrite.picks.length >= n) return;
    curWrite.picks.push(i);
    renderSlots();
    syncBank();
    if (curWrite.picks.length === n) setTimeout(checkPick, 140);
  }

  function undoPick() {
    if (curWrite.lock) return;
    curWrite.picks.pop();
    renderSlots();
    syncBank();
  }
  function clearPicks() {
    curWrite.picks = [];
    renderSlots();
    syncBank();
  }
  function resetPicks() {
    curWrite.picks = [];
    curWrite.lock = false;
    var slots = $('wSlots');
    if (slots) { slots.classList.remove('bad', 'good'); }
    renderSlots();
    syncBank();
  }

  function checkPick() {
    var w = curWrite.w;
    var got = curWrite.picks.map(function (i) { return curWrite.bank[i]; }).join('');
    if (got === w.w.toLowerCase()) {
      var slots = $('wSlots');
      if (slots) slots.classList.add('good');
      writeCorrect();
      setTimeout(resetPicks, 720);
    } else {
      curWrite.lock = true;
      var s2 = $('wSlots');
      if (s2) s2.classList.add('bad');
      buzz([8, 40, 8]);
      writeWrong();
      setTimeout(resetPicks, 620);
    }
  }

  function renderPeekState() {
    var w = curWrite.w;
    var o = recWrite(w);
    var peek = $('wPeek');
    if (!peek) return;
    if (curWrite.revealed) {
      peek.textContent = '再显示';
      peek.style.opacity = '.55';
    }
    $('qProg').textContent = (TAGS[w.tag] || '') + '　·　' + o.wr + ' / ' + needOf(w) + ' 次';
  }

  function peekAnswer() {
    var w = curWrite.w;
    var o = recWrite(w);
    if (!curWrite.revealed) {
      curWrite.revealed = true;
      o.pk++;
      save();
      renderPeekState();
      var body = $('qBody');
      var old = body.querySelector('.wreveal');
      if (old) old.parentNode.removeChild(old);
      var rv = mk('div', 'wreveal');
      rv.innerHTML = '<span class="rw">' + w.w + '</span><span class="rp">' + (w.ph || '') + '</span>';
      body.insertBefore(rv, body.querySelector('#wMain') || body.querySelector('.winput'));
      $('wFoot').innerHTML = '<span class="wnote">看了答案，需多默写 ' + PEEK_PENALTY +
        ' 次（共 ' + o.wr + ' / ' + needOf(w) + '）</span>';
      var bar = $('wBarFill');
      if (bar) bar.style.width = Math.min(100, (o.wr / needOf(w)) * 100).toFixed(1) + '%';
      var inp = $('wInput');
      if (inp) { try { inp.focus(); } catch (e) {} }
    }
  }

  function writeCorrect() {
    var w = curWrite.w;
    var o = recWrite(w);
    o.wr++;
    o.at = o.at || Date.now();
    o.m = starsOf(w);
    save();
    refreshCounts();
    rewardWrite();
    var bar = $('wBarFill');
    if (bar) bar.style.width = Math.min(100, (o.wr / needOf(w)) * 100).toFixed(1) + '%';
    renderPeekState();
    buzz(12);
    FX.sprinkle(14, w.tier);
    var left = Math.max(0, needOf(w) - o.wr);
    $('wFoot').innerHTML = left > 0
      ? '<span class="wok">对了　·　再默 ' + left + ' 次满星</span>'
      : '<span class="wok">' + (o.m >= 3 ? '通晓了' : '完成本轮') + '　·　' + w.w + '</span>' +
        '<button class="btn" id="wDone" style="margin-top:10px;height:40px">返 回</button>';
    if (left === 0) {
      var dn = $('wDone');
      if (dn) dn.onclick = closeQuiz;
    }
  }

  function writeWrong() {
    curWrite.tries++;
    $('wFoot').innerHTML = '<span class="wbad">顺序不对　·　错 ' + curWrite.tries +
      ' 次　·　可再试，或看答案（会多加 1 次）</span>';
  }

  function submitTyped() {
    var inp = $('wInput');
    if (!inp) return;
    var w = curWrite.w;
    var val = inp.value.trim().toLowerCase().replace(/\s+/g, '');
    if (!val) return;

    if (val === w.w.toLowerCase()) {
      inp.value = '';
      inp.classList.remove('bad');
      inp.classList.add('good');
      setTimeout(function () { inp.classList.remove('good'); }, 420);
      writeCorrect();
      try { inp.focus(); } catch (e) {}
    } else {
      inp.classList.remove('good');
      inp.classList.add('bad');
      buzz([8, 40, 8]);
      setTimeout(function () { inp.classList.remove('bad'); }, 420);
      writeWrong();
      inp.select();
    }
  }

  function closeQuiz() {
    $('quiz').classList.remove('open');
    curWrite = null;
    if ($('daily').classList.contains('open')) renderDaily();
    if (curTab === 'mine' && curPane === 'book') {
      renderGrid();
      if ($('detail').classList.contains('open')) {
        var dc = $('detailCard').querySelector('.card');
        var dw = dc && dc.getAttribute('data-word');
        if (dw && BY_WORD[dw]) openDetail(BY_WORD[dw]);
      }
    }
    if (curTab === 'expedition') renderExpedition();
    if (deckEl) {
      var slide = deckEl.children[activeIdx];
      var flip = slide && slide.querySelector('.flipper');
      if (flip && flip._flipped) {
        var front = flip.querySelector('.face.front');
        if (front) {
          front.innerHTML = '';
          var nc = Card.render(flip._word, { mastery: starsOf(flip._word), levels: levelsOf(flip._word) });
          nc.onclick = function () { openDetail(flip._word); };
          front.appendChild(nc);
        }
      }
      updateHint();
    }
  }

  /* ── 默写奖励额度 ─────────────────────────────── */
  var WRITES_PER_BONUS = 3;
  var writeTally = 0;

  function rewardWrite() {
    state.ink += WRITE_INK;
    refreshCounts();
    writeTally++;
    if (writeTally % WRITES_PER_BONUS !== 0) return;
    if (grantBattleBonus()) toast('默写 ' + WRITES_PER_BONUS + ' 次 · 多得一次远征');
  }

  /* ── 绑定 ─────────────────────────────────────── */
  load();
  ensureDay();
  refreshCounts();
  renderQuota();
  renderBattleQuota();
  updateDailyBrief();

  $('btnDraw').onclick = draw;
  $('btnDaily').onclick = openDaily;
  $('expStart').onclick = startExpedition;
  $('dailyClose').onclick = function () { $('daily').classList.remove('open'); updateDailyBrief(); };
  $('detailClose').onclick = function () { $('detail').classList.remove('open'); };
  $('qBack').onclick = closeQuiz;

  var tabBtns = document.querySelectorAll('#tabbar .tab');
  for (var ti = 0; ti < tabBtns.length; ti++) {
    tabBtns[ti].onclick = function () { switchTab(this.getAttribute('data-tab')); };
  }
  var mineBtns = document.querySelectorAll('#mineTabs button');
  for (var mi = 0; mi < mineBtns.length; mi++) {
    mineBtns[mi].onclick = function () { showMinePane(this.getAttribute('data-pane')); };
  }

  stage.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.pack')) draw();
  });

  if (window.xhs && window.xhs.miniTool && window.xhs.miniTool.setNavigationBar) {
    try {
      window.xhs.miniTool.setNavigationBar({ title: '抽词成册', backgroundColor: '#13100d', frontColor: '#ffffff' });
    } catch (e) {}
  }
})();
