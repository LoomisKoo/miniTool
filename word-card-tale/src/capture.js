/* 收服战：点开一张卡 → 放大翻面居中 → 照着拼 → 收下或逃掉 */
(function (global) {
  'use strict';

  var Card = global.Card;
  var Sfx = global.Sfx || { play: function () {} };
  function sfx(n, a) { try { Sfx.play(n, a); } catch (e) {} }

  var DUR = { 1: 55, 2: 52, 3: 50, 4: 46, 5: 42, 6: 40 };
  // 翻面时长：越高阶翻得越慢、越有分量
  var FLIP_MS = { 1: 520, 2: 560, 3: 620, 4: 700, 5: 790, 6: 880 };
  // 子等级只做细节微调：卡等每高一阶多加十几毫秒，始终不会跨过主档
  function flipDur(tier, sub) {
    return (FLIP_MS[tier] || 640) + ((sub || 1) - 1) * 16;
  }
  var GAIN = 5.5;      // 拼对一个字母，稳定度回升
  var PENALTY = 8;     // 拼错一个字母，稳定度下降
  var MERCY = 22;      // 低于此值进入减速
  var SKILL_KEY = 'wordcodex.capskill';

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 第一轮永远照着卡面拼；只有高稀有度才追加一轮遮词回忆
  // 轮次只看单词本身：长词（≥8 字母）或罕见词（词表 rarity ≥4）
  // 卡等（lv）只决定奖励与特效，不参与轮次判定
  function roundsFor(w) {
    var word = (w && w.w) || '';
    var long = word.length >= 8;
    var rare = !!w && w.tier >= 4;
    return (long || rare) ? ['copy', 'recall'] : ['copy'];
  }

  function skill() {
    var v = 1;
    try { v = parseFloat(localStorage.getItem(SKILL_KEY)) || 1; } catch (e) {}
    return Math.max(0.8, Math.min(1.3, v));
  }
  function bumpSkill(f) {
    try { localStorage.setItem(SKILL_KEY, String(Math.max(0.8, Math.min(1.3, skill() * f)))); } catch (e) {}
  }

  // 每个档位一套场景色，跟卡背/卡面同一色系
  // 底色全档统一；只有翻开那一刻才淡入该档位的光晕，避免开奖前就被背景剧透
  var SCENE = {
    1: { glow: 'rgba(170, 190, 220, .26)', floor: 'rgba(120, 140, 175, .16)' },
    2: { glow: 'rgba(230, 170, 100, .3)',  floor: 'rgba(170, 120, 70, .18)' },
    3: { glow: 'rgba(96, 216, 172, .3)',   floor: 'rgba(60, 160, 125, .18)' },
    4: { glow: 'rgba(140, 120, 255, .36)', floor: 'rgba(90, 70, 200, .22)' },
    5: { glow: 'rgba(255, 196, 100, .38)', floor: 'rgba(220, 120, 60, .22)' },
    6: { glow: 'rgba(240, 140, 255, .4)',  floor: 'rgba(150, 110, 255, .24)' },
  };

  var root = null, ui = {}, S = null, raf = 0, lastT = 0;

  // 卡周围一圈闪烁星芒：位置固定，按序错开亮起
  function starsHtml() {
    var h = '';
    for (var i = 0; i < 14; i++) {
      var a = i / 14 * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
      var r = 52 + (i * 37 % 17);
      h += '<i style="--x:' + (50 + Math.cos(a) * r).toFixed(1) + '%;--y:' + (50 + Math.sin(a) * r * 0.86).toFixed(1) +
        '%;--d:' + (i * 47 % 9) * 45 + 'ms;--s:' + (0.55 + (i * 29 % 10) / 14).toFixed(2) + '"></i>';
    }
    return h;
  }

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'capw';
    root.innerHTML =
      '<div class="cap-bg" id="capBg"></div>' +
      '<div class="cap-whiteout"></div>' +
      '<div class="cap-stage" id="capStage">' +
        '<div class="cap-card" id="capCard">' +
          '<span class="cap-pillar"></span>' +
          '<span class="cap-halo"></span>' +
          '<span class="cap-rays"></span>' +
          '<span class="cap-bloom"></span>' +
          '<span class="cap-shock s1"></span>' +
          '<span class="cap-shock s2"></span>' +
          '<span class="cap-stars">' + starsHtml() + '</span>' +
          '<div class="cap-wob" id="capWob">' +
            '<div class="cf-in" id="cfIn">' +
              '<div class="cf-face cf-back" id="cfBack"></div>' +
              '<div class="cf-face cf-front" id="cfFront"></div>' +
            '</div>' +
            '<span class="cf-flash"></span>' +
            '<span class="cf-glint"></span>' +
            '<span class="cf-holo"></span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<canvas class="cap-confetti" id="capConfetti"></canvas>' +
      '<div class="cap-panel">' +
        '<div class="cap-head">' +
          '<div class="cap-prompt" id="capPrompt">' +
            '<b id="capPromptT">照卡面拼写</b>' +
            '<i id="capPromptS">超时 · 词灵会跑掉</i>' +
          '</div>' +
          '<span class="cap-round" id="capRound"></span>' +
        '</div>' +
        '<div class="cap-timer"><span id="capFill"></span></div>' +
        '<div class="cap-slots" id="capSlots"></div>' +
        '<div class="cap-bank" id="capBank"></div>' +
        '<div class="cap-foot" id="capFoot"></div>' +
      '</div>' +
      '<div class="cap-toast" id="capToast">' +
        '<span class="ct-ring"></span>' +
        '<span class="ct-rays"></span>' +
        '<b id="capToastT">已收入图鉴</b>' +
        '<i id="capToastS"></i>' +
      '</div>' +
      '<div class="cap-tease">' +
        '<b>词灵苏醒中<span class="ctz-dots"><i></i><i></i><i></i></span></b>' +
        '<small>轻点卡牌 · 立即翻开</small>' +
      '</div>' +
      '<button class="cap-quit" id="capQuit" type="button" aria-label="放弃">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>' +
      '</button>' +
      '<div class="cap-veil" id="capVeil"></div>' +
      '<div class="cap-confirm" id="capConfirm">' +
        '<p>放弃这张卡？</p>' +
        '<small>它会立刻挣脱飞走，这一张就没了</small>' +
        '<div class="cc-btns">' +
          '<button id="ccNo" type="button">继续拼</button>' +
          '<button id="ccYes" class="no" type="button">放弃</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    ['capBg', 'capStage', 'capCard', 'capWob', 'cfIn', 'cfBack', 'cfFront',
      'capFill', 'capSlots', 'capBank', 'capFoot', 'capConfirm', 'capConfetti', 'capVeil',
      'capPrompt', 'capPromptT', 'capPromptS', 'capRound', 'capToast', 'capToastT', 'capToastS']
      .forEach(function (id) { ui[id] = root.querySelector('#' + id); });
    root.querySelector('#capQuit').onclick = askQuit;
    root.querySelector('#ccNo').onclick = function () { closeQuit(); if (S) S.paused = false; };
    root.querySelector('#ccYes').onclick = function () { closeQuit(); abandon(); };
    ui.capVeil.onclick = function () { closeQuit(); if (S) S.paused = false; };
    // 兜底：任何情况下点卡面都能翻开
    ui.capCard.addEventListener('click', function () {
      if (S && !S.done && !S.revealed) flipVisual();
    });
    document.addEventListener('click', function (e) {
      var k = e.target && e.target.closest ? e.target.closest('.cap-key') : null;
      if (k) tap(+k.getAttribute('data-ki'));
    }, false);
  }

  /* ── 入口：rect 是原卡在页面上的位置 ─────────── */
  function run(pick, opts) {
    build();
    opts = opts || {};
    // 主层次（华丽段落）看词表稀有度，子等级（细节强度）看抽卡卡等
    var sub = pick.lv || 1;
    var tier = pick.hid ? 6 : ((pick.w && pick.w.tier) || sub);
    S = {
      pick: pick, tier: tier, sub: sub,
      rounds: roundsFor(pick.w), ri: 0,
      word: pick.w.w.toLowerCase(),
      filled: [], usedIdx: {}, bank: [],
      stab: 100, dur: (DUR[tier] || 50) * skill(),
      wrong: 0, done: false, revealed: false, arrived: false, locked: false, started: false, paused: false,
      elapsed: 0, panic: 0,
      onDone: opts.onDone,
      onSettle: opts.onSettle,
      settled: false,
      from: opts.rect || null,
      rot: opts.rot || 0,
    };
    lastT = 0;

    ui.cfBack.innerHTML = '';
    ui.cfFront.innerHTML = '';
    ui.cfBack.appendChild(Card.renderBack(pick.lv, pick.th));
    ui.cfFront.appendChild(Card.render(
      Object.assign({}, pick.w, { lvl: pick.lv, hid: !!pick.hid }),
      { mastery: 0, levels: pick.w.w.split('').map(function () { return pick.lv; }) }
    ));
    var sc = SCENE[tier] || SCENE[1];
    root.style.setProperty('--sc-glow', sc.glow);
    root.style.setProperty('--sc-floor', sc.floor);

    // 复位翻面：背面显示、正面隐藏、折叠动画清零
    cancelFlip();
    ui.cfIn.style.transition = 'none';
    ui.cfIn.style.transform = 'none';
    ui.cfIn.style.opacity = '1';
    ui.cfFront.className = 'cf-face cf-front';
    ui.cfBack.className = 'cf-face cf-back';
    ui.cfFront.style.display = 'none';
    ui.cfFront.style.opacity = '0';
    ui.cfBack.style.display = 'block';
    ui.cfBack.style.opacity = '1';
    void ui.cfIn.offsetWidth;
    ui.cfIn.style.transition = '';

    ui.capCard.className = 'cap-card fx-t' + tier;
    ui.capCard.removeAttribute('data-tz');
    root.classList.remove('rv-whiteout', 'tease-cap', 'lit', 'fleeing', 'recall');
    root.classList.add('teasing');
    ui.capCard.style.setProperty('--flip-dur', flipDur(tier, sub) + 'ms');
    ui.capCard.style.opacity = '1';
    ui.capWob.className = 'cap-wob';
    ui.capConfirm.classList.remove('on');
    if (ui.capVeil) ui.capVeil.classList.remove('on');
    ui.capFill.style.width = '100%';
    ui.capFill.className = '';
    ui.capToast.className = 'cap-toast';
    ui.capPrompt.className = 'cap-prompt';
    ui.capPromptT.textContent = '词灵现身';
    ui.capPromptS.textContent = '翻面后拼写正确即可收入图鉴';
    ui.capFoot.className = 'cap-foot';
    ui.capFoot.textContent = '';
    ui.capSlots.innerHTML = '';
    ui.capSlots.className = 'cap-slots';
    ui.capBank.innerHTML = '';
    ui.capRound.textContent = '';
    root.classList.remove('closing');
    root.classList.remove('dim');
    root.classList.remove('leave');
    ui.capBg.style.transition = '';
    ui.capBg.style.opacity = '';
    // 面板内容先排好（悬念阶段不可见），保证卡片落点按面板的最终高度来算，不会被挡住
    S.bank = shuffle(S.word.split(''));
    renderSlots();
    renderBank();
    ui.capPromptT.textContent = '照卡面拼写';
    root.classList.add('open');

    // 从原卡位置起手
    var r = S.from;
    if (r && r.width) {
      ui.capCard.style.transition = 'none';
      setCard(r.left + r.width / 2, r.top + r.height / 2, r.width / Card.CARD_W, S.rot);
      void ui.capCard.offsetWidth;
      ui.capCard.style.transition = '';
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!S) return;
        grow();
      });
    });
  }

  function flipNow() {
    try {
      flipVisual();
    } catch (e) {
      ui.cfBack.style.opacity = '0';
      ui.cfFront.style.opacity = '1';
      ui.cfIn.style.transform = 'scaleX(1) scaleY(1)';
      if (S && !S.started) beginRound();
    }
  }

  /* ── 开奖悬念：卡背光色逐级跳档、心跳越来越急，最后停在真实稀有度上再翻；点卡可跳过 ── */
  var TEASE_COL = { 1: '#dfe7f2', 2: '#ffd29a', 3: '#8ff5cf', 4: '#a9b8ff', 5: '#ffe08a', 6: '#ffb6f3' };
  var TEASE_STEPS = { 1: [1], 2: [1, 2], 3: [1, 2, 3], 4: [1, 3, 4], 5: [1, 3, 4, 5], 6: [1, 3, 5, 6] };
  function tease() {
    if (!S || S.done || S.revealed) return;
    var cur = S, steps = TEASE_STEPS[S.tier] || [1], k = 0;
    root.classList.add('tease-cap');
    ui.capCard.classList.add('rv-tease');
    function step() {
      if (S !== cur || cur.done || cur.revealed) return;
      if (k >= steps.length) { flipNow(); return; }
      ui.capCard.style.setProperty('--tz', TEASE_COL[steps[k]]);
      ui.capCard.setAttribute('data-tz', k + 1);
      ui.capCard.classList.remove('tz-ping');
      void ui.capCard.offsetWidth;
      ui.capCard.classList.add('tz-ping');
      sfx('tease', { i: k, lv: steps[k], last: k === steps.length - 1 });
      buzz(6 + k * 5);
      k++;
      cur.teaseT = setTimeout(step, k === steps.length ? 560 : 480);
    }
    cur.teaseT = setTimeout(step, 240);
  }

  function setCard(cx, cy, k, rot) {
    // cx / cy 是视口坐标，需换算成 stage 内坐标（绝对定位以 stage 内边为原点）
    var st = ui.capStage;
    var r = st.getBoundingClientRect();
    var ox = r.left + st.clientLeft;
    var oy = r.top + st.clientTop;
    ui.capCard.style.left = (cx - ox) + 'px';
    ui.capCard.style.top = (cy - oy) + 'px';
    ui.capCard.style.transform = 'translate(-50%, -50%) scale(' + k.toFixed(4) + ')' +
      (rot ? ' rotate(' + rot + 'deg)' : '');
  }

  // 卡片落点：底部面板高度已定，舞台剩余空间尽量都给卡牌
  // 两种摆法取较大者：卡牌够宽会碰到右上角关闭钮 → 顶部让出一条；或收窄到关闭钮内侧 → 顶部贴边
  var SPOT_DROP = 20, SPOT_GAP = 16, QUIT_CLEAR = 44, QUIT_SIDE = 60, SPOT_MAX = 1.35;
  function cardSpot() {
    var st = ui.capStage.getBoundingClientRect();
    var vw = Math.min(430, window.innerWidth || 390);
    // 翻面悬念阶段不让底部拼写面板参与布局，卡片先真正位于整块屏幕中央；
    // beginRound 移除 teasing 后再按面板高度重新计算，形成“顶上去”的让位动画。
    if (root && root.classList.contains('teasing')) {
      var fullH = Math.max(260, window.innerHeight || 700);
      var fullK = Math.min(SPOT_MAX, (vw - 72) / Card.CARD_W, (fullH - 96) / Card.CARD_H);
      return { x: st.left + st.width / 2, y: fullH / 2, k: Math.max(0.3, fullK) };
    }
    var H = st.height - SPOT_GAP - SPOT_DROP;
    var kWide = Math.min(SPOT_MAX, (vw - 24) / Card.CARD_W, (H - QUIT_CLEAR) / Card.CARD_H);
    var kNarrow = Math.min(SPOT_MAX, (vw - QUIT_SIDE * 2) / Card.CARD_W, H / Card.CARD_H);
    var narrow = kNarrow >= kWide;
    var k = Math.max(0.3, narrow ? kNarrow : kWide);
    var top = narrow ? 0 : QUIT_CLEAR;
    var h = Card.CARD_H * k, spare = Math.max(0, H - top - h);
    return { x: st.left + st.width / 2, y: st.top + SPOT_DROP + top + spare / 2 + h / 2, k: k };
  }

  // 面板高度变化后（换段、换行）把卡片平滑挪到新落点
  function fitCard() {
    if (!S || !S.arrived) return;
    var p = cardSpot();
    ui.capCard.style.transition = 'left .3s ease, top .3s ease, transform .3s ease';
    setCard(p.x, p.y, p.k, 0);
    setTimeout(function () { if (S) ui.capCard.style.transition = ''; }, 320);
  }

  // 放大到模态中的落点
  function grow() {
    sfx('sheet');
    var p = cardSpot();
    ui.capCard.style.transition = 'left .52s cubic-bezier(.22,.8,.3,1), top .52s cubic-bezier(.22,.8,.3,1), transform .52s cubic-bezier(.22,.8,.3,1)';
    setCard(p.x, p.y, p.k, 0);
    buzz(8);
    setTimeout(function () {
      if (!S) { ui.capCard.style.transition = ''; return; }
      ui.capCard.style.transition = '';
      S.arrived = true;
      tease();
    }, 560);
  }

  /* ── 翻面：整张卡绕 Y 轴翻过来，翻完才出特效 ── */
  function cancelFlip() {
    if (!ui.cfIn) return;
    clearTimeout(ui.cfIn._t1);
    clearTimeout(ui.cfIn._t2);
    ui.cfIn.classList.remove('flipping');
  }

  // 折叠式翻面：整张卡沿竖轴收拢 → 最窄时换面 → 再展开
  function flipVisual() {
    if (!S || S.revealed) return;
    S.revealed = true;
    clearTimeout(S.teaseT);
    root.classList.remove('tease-cap');
    ui.capCard.classList.remove('rv-tease', 'tz-ping');
    ui.capCard.removeAttribute('data-tz');
    var cur = S, dur = flipDur(S.tier, S.sub);
    ui.capToast.className = 'cap-toast';
    ui.capPrompt.className = 'cap-prompt';
    ui.capPromptT.textContent = '词灵现身';
    ui.capPromptS.textContent = '翻面后拼写正确即可收入图鉴';
    sfx('flip', dur);
    if (S.tier >= 3) sfx('charge', { tier: S.tier, dur: dur });
    buzz(12);
    cancelFlip();
    // 高档位翻面前先蓄力：卡身微颤、背后透出档位色光
    if (S.tier >= 3) {
      ui.capCard.classList.remove('rv-charge');
      void ui.capCard.offsetWidth;
      ui.capCard.classList.add('rv-charge');
    }

    // 先把当前面摆正，再挂动画类（强制 reflow 保证动画从头播）
    ui.cfIn.style.transition = 'none';
    ui.cfIn.style.transform = 'none';
    void ui.cfIn.offsetWidth;
    ui.cfIn.style.transition = '';
    ui.cfIn.classList.add('flipping');

    var swapped = false;
    function swapFace() {
      if (swapped) return;
      swapped = true;
      ui.cfBack.classList.add('hide');
      ui.cfBack.style.display = 'none';
      ui.cfBack.style.opacity = '0';
      ui.cfFront.classList.add('show');
      ui.cfFront.style.display = 'block';
      ui.cfFront.style.opacity = '1';
      ui.cfFront.style.zIndex = '2';
      ui.cfBack.style.zIndex = '1';
      // 正面就位后重新起一次展开动画
      ui.cfIn.classList.remove('flipping');
      void ui.cfIn.offsetWidth;
      ui.cfIn.classList.add('flip-out');
    }

    // 收拢到最窄那一刻换面（即使动画没跑，时间到了也一定换）
    var half = Math.round(dur * 0.48);
    ui.cfIn.style.setProperty('--half-dur', half + 'ms');
    ui.cfIn.style.setProperty('--half-out', (dur - half) + 'ms');
    ui.cfIn._t1 = setTimeout(function () { if (S) swapFace(); }, half);
    ui.cfIn._t2 = setTimeout(function () {
      if (!S) return;
      swapFace();
      ui.cfIn.classList.remove('flipping', 'flip-out');
      if (S.done) return;
      revealFx();
      root.classList.add('lit');
      sfx('reveal', S.tier);
      buzz([0, 14, 30, 10]);
      // 让揭示特效先独占舞台，再升起拼写面板
      setTimeout(function () {
        if (S === cur && !cur.started) beginRound();
      }, (cur.tier >= 5 ? 900 : cur.tier >= 3 ? 600 : 400) + 500);
    }, dur + 20);
  }

  // 揭示特效：每档在上一档基础上叠一层
  var RV_CLASSES = ['rv-flash', 'rv-shock', 'rv-shock2', 'rv-bloom', 'rv-glint', 'rv-rays', 'rv-rays-long',
    'rv-charge', 'rv-stars', 'rv-pillar', 'rv-halo', 'rv-holo', 'rv-tease', 'tz-ping'];
  function clearReveal() {
    RV_CLASSES.forEach(function (c) { ui.capCard.classList.remove(c); });
    ui.cfIn.classList.remove('rv-punch', 'rv-punch-big');
    root.classList.remove('rv-whiteout');
  }

  function revealFx() {
    var t = S.tier;
    clearReveal();
    void ui.capCard.offsetWidth;
    var add = ['rv-flash', 'rv-shock'];
    if (t >= 2) add.push('rv-glint', 'rv-stars');
    if (t >= 3) add.push('rv-bloom', 'rv-rays');
    if (t >= 4) add.push('rv-shock2', 'rv-pillar');
    if (t >= 5) { add.splice(add.indexOf('rv-rays'), 1); add.push('rv-rays-long', 'rv-halo', 'rv-holo'); }
    add.forEach(function (c) { ui.capCard.classList.add(c); });
    ui.cfIn.classList.add(t >= 4 ? 'rv-punch-big' : 'rv-punch');
    if (t >= 5) {
      root.style.setProperty('--wo', t >= 6 ? 'rgba(255,190,245,.6)' : 'rgba(255,224,150,.55)');
      root.classList.add('rv-whiteout');
    }
    // 粒子只给中高档，量也收敛，避免廉价感
    if (t >= 3 && global.FX && global.FX.burst) {
      try {
        var box = ui.capCard.getBoundingClientRect();
        global.FX.burst(t, {
          x: box.left + box.width / 2, y: box.top + box.height / 2,
          count: (t >= 6 ? 90 : t >= 5 ? 70 : t >= 4 ? 48 : 28) + (S.sub - 1) * 4,
        });
      } catch (e) {}
    }
    setTimeout(function () {
      if (ui.cfIn) ui.cfIn.classList.remove('rv-punch', 'rv-punch-big');
    }, 720);
  }

  // 落位后开始计时与字母池
  function beginRound() {
    if (!S || S.done || S.started) return;
    root.classList.remove('teasing', 'tease-cap');
    // 兜底：无论动画是否被打断，这里都保证正面已翻出来
    ui.cfBack.style.display = 'none';
    ui.cfBack.style.opacity = '0';
    ui.cfFront.style.display = 'block';
    ui.cfFront.style.opacity = '1';
    ui.cfFront.style.zIndex = '2';
    ui.cfFront.classList.add('show');
    ui.cfIn.classList.remove('flipping', 'flip-out');
    ui.cfIn.style.transform = 'none';
    startRound();
    paintStab();
    fitCard();

    S.started = true;
    S.paused = false;
    lastT = 0;
    raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!S || S.done || !S.started) return;
    var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
    lastT = now;
    if (S.paused) { raf = requestAnimationFrame(tick); return; }
    S.elapsed += dt;
    var p = S.stab / 100;
    var rate = (100 / S.dur) * (0.45 + 1.5 * (1 - p));
    if (S.stab < MERCY) rate *= 0.55;
    S.stab = Math.max(0, S.stab - rate * dt);
    paintStab();
    if (S.stab <= 0) { escape(); return; }
    raf = requestAnimationFrame(tick);
  }

  // 轮次说明：多轮时让玩家知道「为什么还要再拼一次」
  function roundLabel() {
    if (!S || S.rounds.length <= 1) return '';
    return '第 ' + Math.min(S.ri + 1, S.rounds.length) + '/' + S.rounds.length + ' 段 · ';
  }
  function roundHint() {
    if (!S) return '';
    return S.rounds[S.ri] === 'recall'
      ? '卡面已遮 · 凭释义默写'
      : '照卡面拼 · 拼对即收录';
  }

  function paintStab() {
    if (!S || S.handoff) return;
    var v = S.stab;
    ui.capFill.style.width = v.toFixed(1) + '%';
    ui.capFill.className = v > 60 ? '' : v > 35 ? 'warn' : 'crit';
    var pv = v > 66 ? 1 : v > 42 ? 2 : v > 22 ? 3 : 4;
    if (pv !== S.panic) {
      S.panic = pv;
      ui.capWob.className = 'cap-wob p' + pv + (S.rounds[S.ri] === 'recall' ? ' veil' : '');
    }
    if (!S.revealed) return;
    var warn = v < MERCY ? '撑住 · 还有机会'
      : v < 45 ? '词灵快挣脱了…' : v < 70 ? '词灵正在挣脱…' : '';
    ui.capPromptS.textContent = roundLabel() + (warn || roundHint());
    ui.capPrompt.classList.toggle('alert', !!warn);
    ui.capPrompt.classList.toggle('alert-hi', v < 45);
  }

  /* ── 多轮拼写：第二轮遮住卡面，凭释义默写 ──────── */
  function maskCard(on) {
    root.classList.toggle('recall', !!on);
  }

  /* ── 每一轮 ───────────────────────────────────── */
  function startRound(enter) {
    var r = S.rounds[S.ri];
    // 只把单词本身的字母打乱，不加干扰字母
    S.bank = shuffle(S.word.split(''));
    S.filled = [];
    S.usedIdx = {};
    S.locked = false;
    S.panic = 0;
    ui.capWob.className = 'cap-wob p1' + (r === 'recall' ? ' veil' : '');
    ui.capPrompt.className = 'cap-prompt';

    var cn = (S.pick.w.senses && S.pick.w.senses.length) ? S.pick.w.senses[0].cn : (S.pick.w.cn || '');
    ui.capPromptT.textContent = r === 'copy'
      ? '照卡面拼写'
      : '遮住卡面 · 默写';
    ui.capPromptS.textContent = roundLabel() + (r === 'recall' ? cn + ' · 凭记忆拼' : '拼对即收录 · 超时会跑掉');
    ui.capRound.textContent = S.rounds.length > 1 ? (S.ri + 1) + ' / ' + S.rounds.length : '';

    renderSlots();
    renderBank();
    if (enter) {
      ui.capSlots.classList.add('enter');
      ui.capBank.classList.add('enter');
      for (var i = 0; i < ui.capSlots.children.length; i++) ui.capSlots.children[i].style.animationDelay = (i * 40) + 'ms';
      for (var j = 0; j < ui.capBank.children.length; j++) ui.capBank.children[j].style.animationDelay = (120 + j * 30) + 'ms';
      setTimeout(function () {
        if (!S) return;
        ui.capSlots.classList.remove('enter');
        ui.capBank.classList.remove('enter');
      }, 900);
    }
    maskCard(r === 'recall');
    ui.capFoot.className = 'cap-foot';
    ui.capFoot.textContent = '';
  }

  // 槽位尽量大：单词越短字越大，始终一行
  function renderSlots() {
    var n = S.word.length;
    var avail = Math.min(430, window.innerWidth || 390) - 40 - 28;
    var gap = n > 9 ? 4 : 6;
    var sw = Math.max(20, Math.min(48, Math.floor((avail - gap * (n - 1)) / n)));
    var st = ' style="width:' + sw + 'px;height:' + Math.round(sw * 1.2) + 'px;font-size:' + Math.round(sw * 0.62) + 'px"';
    var html = '';
    for (var i = 0; i < n; i++) {
      var got = S.filled[i];
      html += '<span class="cap-slot' + (got ? ' on' : '') + (i === S.filled.length ? ' cur' : '') + '"' + st + '>' + (got || '') + '</span>';
    }
    ui.capSlots.style.gap = gap + 'px';
    ui.capSlots.className = 'cap-slots';
    ui.capSlots.innerHTML = html;
  }

  function renderBank() {
    var n = S.bank.length;
    var avail = Math.min(430, window.innerWidth || 390) - 40 - 28;
    var gap = n > 9 ? 4 : 6;
    var w = Math.floor((avail - gap * (n - 1)) / n);
    var kw = Math.max(20, Math.min(52, w));
    var fs = Math.max(13, Math.min(24, Math.round(kw * 0.52)));
    ui.capBank.className = 'cap-bank' + (n > 14 ? ' wrap' : '');
    var html = '';
    for (var i = 0; i < n; i++) {
      html += '<button class="cap-key' + (S.usedIdx[i] ? ' used' : '') +
        '" type="button" data-ki="' + i + '"' +
        ' style="width:' + kw + 'px;min-width:' + kw + 'px;height:' + Math.max(40, Math.round(kw * 1.12)) + 'px;font-size:' + fs + 'px">' +
        S.bank[i] + '</button>';
    }
    ui.capBank.style.gap = gap + 'px';
    if (n > 14) { kw = 28; fs = 15; }
    ui.capBank.innerHTML = html;
  }

  function tap(i) {
    if (!S || S.done || S.locked || !S.started || S.paused) return;
    if (S.usedIdx[i]) return;
    var c = S.bank[i];
    var need = S.word.charAt(S.filled.length);
    if (c === need) {
      S.filled.push(c);
      S.usedIdx[i] = 1;
      S.stab = Math.min(100, S.stab + GAIN);
      paintStab();
      renderSlots();
      renderBank();
      var slot = ui.capSlots.children[S.filled.length - 1];
      if (slot) slot.classList.add('pop');
      sfx('correct', S.filled.length - 1);
      buzz(6);
      if (S.filled.length === S.word.length) roundClear();
    } else {
      S.wrong++;
      S.stab = Math.max(0, S.stab - PENALTY);
      paintStab();
      S.locked = true;
      ui.capSlots.className = 'cap-slots bad';
      sfx('wrong');
      buzz([10, 40, 10]);
      setTimeout(function () {
        if (!S || S.done) return;
        S.locked = false;
        if (S.stab <= 0) { escape(); return; }
        renderSlots();
      }, 320);
    }
  }

  function roundClear() {
    S.locked = true;
    ui.capSlots.className = 'cap-slots good';

    var next = S.rounds[S.ri + 1];
    S.handoff = true;
    sfx('claim');
    buzz([8, 26, 8]);
    if (!next) {
      setTimeout(function () {
        if (!S || S.done) return;
        S.ri++;
        capture();
      }, 460);
      return;
    }
    // 还有下一段：字母依次飞进卡片 → 卡片吸收发光 → 段数徽章跳到下一格 → 新的空格依次弹出
    var cur = S;
    ui.capPrompt.className = 'cap-prompt done';
    ui.capPromptT.textContent = '第 ' + (S.ri + 1) + ' 次完成';
    ui.capPromptS.textContent = '再拼一次即可收录';
    setTimeout(function () {
      if (S !== cur || S.done) return;
      flySlots();
    }, 260);
    setTimeout(function () {
      if (S !== cur || S.done) return;
      clearReveal();
      root.classList.remove('recall');   // 本段拼完，短暂揭晓卡面再进下一段
      void ui.capCard.offsetWidth;
      ui.capCard.classList.add('rv-shock', 'rv-glint');
      roundFx(S.ri + 2, S.rounds.length);
    }, 720);
    setTimeout(function () {
      if (S !== cur || S.done) return;
      S.ri++;
      S.stab = Math.min(100, S.stab + 8);
      S.handoff = false;
      paintStab();
      startRound(true);
    }, 1400);
  }

  // 已拼好的字母逐个飞向段数徽章
  function flySlots() {
    var tg = ui.capRound.getBoundingClientRect();
    var cx, cy;
    if (tg.width) {
      cx = tg.left + tg.width / 2; cy = tg.top + tg.height / 2;
    } else {
      var card = ui.capCard.getBoundingClientRect();
      cx = card.left + card.width / 2; cy = card.top + card.height * 0.45;
    }
    var kids = ui.capSlots.children;
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect();
      kids[i].style.setProperty('--fx', (cx - r.left - r.width / 2).toFixed(0) + 'px');
      kids[i].style.setProperty('--fy', (cy - r.top - r.height / 2).toFixed(0) + 'px');
      kids[i].style.animationDelay = (i * 45) + 'ms';
    }
    ui.capSlots.className = 'cap-slots fly';
  }

  // 段数徽章：数字放大翻跳 + 中央大字提示
  function roundFx(n, total) {
    ui.capRound.textContent = n + ' / ' + total;
    ui.capRound.classList.remove('bump');
    void ui.capRound.offsetWidth;
    ui.capRound.classList.add('bump');
    var fx = document.createElement('div');
    fx.className = 'cap-roundfx';
    fx.innerHTML = '<b>' + n + '<i>/' + total + '</i></b><span>再拼一次</span>';
    root.appendChild(fx);
    setTimeout(function () { if (fx.parentNode) fx.parentNode.removeChild(fx); }, 1300);
    sfx('claim');
    buzz([10, 30, 16]);
  }

  /* ── 收服：卡片缩小飞回原位 ──────────────────── */
  function capture() {
    if (!S || S.done) return;
    var cur = S;
    S.done = true;
    cancelAnimationFrame(raf);
    root.classList.remove('recall');   // 拼对后揭晓卡面
    var perfect = cur.wrong === 0;
    var quality = perfect ? 'perfect' : cur.wrong <= 2 ? 'good' : 'plain';
    var result = { ok: true, quality: quality, pick: cur.pick };
    // 先把「关窗」定下来：后面任何视觉代码出问题都不会让窗口卡住
    setTimeout(function () { if (S === cur) backToSlot(result); }, 1500);
    try {
      bumpSkill(perfect && cur.elapsed < cur.dur * 0.45 ? 1.06 : 0.99);
      ui.capWob.className = 'cap-wob win' + (cur.rounds[cur.ri - 1] === 'recall' ? ' veil' : '');
      clearReveal();
      void ui.capCard.offsetWidth;
      var winFx = ['rv-flash', 'rv-shock', 'rv-shock2', 'rv-bloom', 'rv-glint', 'rv-stars'];
      if (perfect) winFx.push('rv-rays', 'rv-pillar', 'rv-holo');
      if (perfect && cur.tier >= 4) winFx.push('rv-halo');
      winFx.forEach(function (c) { ui.capCard.classList.add(c); });
      if (global.FX && global.FX.burst) {
        var bx = ui.capCard.getBoundingClientRect();
        global.FX.burst(Math.max(3, cur.tier), {
          x: bx.left + bx.width / 2, y: bx.top + bx.height / 2,
          count: (perfect ? 70 : 36) + (cur.sub - 1) * 5,
        });
      }
      ui.capPrompt.className = 'cap-prompt done';
      ui.capPromptT.textContent = perfect ? '完美收服' : '收服成功';
      ui.capPromptS.textContent = perfect ? '零失误 · 词灵已归册' : '词灵已归册';
      ui.capFoot.className = 'cap-foot';
      ui.capFoot.textContent = '';
    } catch (e) {}
    sfx(perfect ? 'perfect' : quality === 'good' ? 'good' : 'plain', cur.tier);
    buzz(perfect ? [14, 34, 14, 34, 20] : 14);
    try { settle(result); } catch (e) {}          // 先把卡位换成正面
    try { showToast(true, perfect, cur.pick); } catch (e) {}
    try { confetti(cur.tier, cur.sub); } catch (e) {}      // 撒花：底部冲上来，1.5s 渐隐
  }

  /* ── 撒花：从底部冲上来，1.5s 内渐隐 ────────────── */
  var confRaf = 0;

  function confStop() {
    if (confRaf) cancelAnimationFrame(confRaf);
    confRaf = 0;
    var cv = ui.capConfetti;
    if (cv) {
      var ctx = cv.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
    }
  }

  function confetti(tier, sub) {
    var cv = ui.capConfetti;
    if (!cv) return;
    confStop();
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var W = root.clientWidth || innerWidth;
    var H = root.clientHeight || innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var pal = ['#fff6de', '#ffe6a8', '#ffd479', '#f0b64a'];
    if (tier >= 5) pal = pal.concat(['#ff9fd0', '#d3b4ff', '#fff0f6']);
    else if (tier >= 3) pal = pal.concat(['#8fe6c4', '#d9ffef']);
    else pal = pal.concat(['#a9c3e8', '#e8f1ff']);

    var n = 96 + (tier >= 5 ? 44 : tier >= 3 ? 24 : 0) + ((sub || 1) - 1) * 5;
    var parts = [];
    for (var i = 0; i < n; i++) {
      var ang = (Math.random() - 0.5) * 0.62;
      var sp = H * (1.5 + Math.random() * 1.0);
      parts.push({
        x: W * (0.05 + Math.random() * 0.9),
        y: H + 10 + Math.random() * H * 0.18,
        vx: Math.sin(ang) * sp * 0.6,
        vy: -Math.cos(ang) * sp,
        w: 3 + Math.random() * 4,
        h: 7 + Math.random() * 10,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 11,
        c: pal[(Math.random() * pal.length) | 0],
      });
    }

    var t0 = 0, last = 0, LIFE = 1.5, G = H * 2.2;
    function frame(now) {
      if (!t0) t0 = now;
      var t = (now - t0) / 1000;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      // 先亮着冲上来，0.85s 后整体渐隐，1.5s 归零
      var fade = t < 0.85 ? 1 : Math.max(0, 1 - (t - 0.85) / 0.65);
      ctx.clearRect(0, 0, W, H);
      if (fade > 0) {
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          p.vy += G * dt;
          p.vx *= (1 - 1.2 * dt);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          if (p.y > H + 80) continue;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.5 + 0.5 * Math.abs(Math.cos(p.rot))));
          ctx.restore();
        }
      }
      if (t < LIFE) confRaf = requestAnimationFrame(frame);
      else confStop();
    }
    confRaf = requestAnimationFrame(frame);
  }

  /* ── 结果气泡 ─────────────────────────────── */
  function showToast(ok, perfect, pick, giveUp) {
    var t = ui.capToast;
    if (!t) return;
    t.className = 'cap-toast ' + (ok ? (perfect ? 'perfect' : 'win') : 'lose');
    void t.offsetWidth;
    t.classList.add('on');
    if (ok) {
      ui.capToastT.textContent = perfect ? '完美收服' : '收入图鉴';
      ui.capToastS.textContent = perfect
        ? pick.w.w.toUpperCase() + ' · 零失误收录'
        : pick.w.w.toUpperCase() + ' · 已加入你的词册';
    } else {
      ui.capToastT.textContent = giveUp ? '已放弃' : '词灵逃走了';
      ui.capToastS.textContent = giveUp
        ? pick.w.w.toUpperCase() + ' · 这张卡没了'
        : pick.w.w.toUpperCase() + ' · 留下了一片残页';
    }
    setTimeout(function () {
      if (ui.capToast) ui.capToast.classList.remove('on');
    }, ok ? 1500 : giveUp ? 850 : 1150);
  }

  /* ── 逃脱：卡片向上飞走 ─────────────────────── */
  function escape(giveUp) {
    if (!S || S.done) return;
    var cur = S;
    S.done = true;
    cancelAnimationFrame(raf);
    bumpSkill(1.05);
    clearTimeout(cur.teaseT);
    ui.capCard.classList.remove('rv-tease', 'tz-ping', 'rv-charge');
    ui.capCard.removeAttribute('data-tz');
    ui.capWob.className = 'cap-wob flee';
    ui.capSlots.className = 'cap-slots bad';
    ui.capFill.className = 'crit';
    ui.capPrompt.className = 'cap-prompt gone';
    ui.capPromptT.textContent = giveUp ? '已放弃' : '词灵挣脱了';
    ui.capPromptS.textContent = giveUp ? '这张卡飞走了' : '卡牌飞走了 · 只留下一片残页';

    ui.capFoot.className = 'cap-foot';
    ui.capFoot.textContent = '';
    sfx(giveUp ? 'abandon' : 'fail');
    buzz([26, 60, 26]);
    // 拼写面板和关闭钮立刻收走，舞台只留飞走的卡和结果告示
    root.classList.add('fleeing');
    root.classList.remove('tease-cap');
    showToast(false, false, cur.pick, giveUp);
    var result = { ok: false, quality: giveUp ? 'abandoned' : 'escaped', pick: cur.pick };
    // 告示播完才收场：先把下层卡位换成残页（残页燃散入场与背景淡出同步），再淡出背景回到上一页
    var hold = giveUp ? 950 : 1250;
    setTimeout(function () {
      if (S !== cur) return;
      settle(result);
      root.classList.add('dim');
      hide(function () {
        var cb = cur.onDone;
        S = null;
        if (cb) cb(result);
      }, 460);
    }, hold);
  }

  // 结算立即回调：让上一页的卡位马上换成正面 / 残页，不等动画
  function settle(result) {
    if (!S || S.settled) return;
    S.settled = true;
    if (S.onSettle) { try { S.onSettle(result); } catch (e) {} }
  }

  // 收服后向卡位收缩淡出（卡位已经先一步换成正面，不会重复显示）
  function backToSlot(result) {
    var cur = S;
    var r = cur.from;
    ui.capWob.className = 'cap-wob';
    root.classList.add('leave');   // HUD / 键盘 / 气泡一起快速退场
    // 背景立刻同步退场（且比卡片更快），卡片落回原位的全过程都看得见
    ui.capBg.style.transition = 'opacity .22s cubic-bezier(.4,0,.6,1)';
    ui.capBg.style.opacity = '0';
    ui.capCard.style.transition =
      'left .36s cubic-bezier(.4,.05,.6,.95), top .36s cubic-bezier(.4,.05,.6,.95), ' +
      'transform .36s cubic-bezier(.4,.05,.6,.95), opacity .12s ease-in .24s';
    if (r && r.width) setCard(r.left + r.width / 2, r.top + r.height / 2, r.width / Card.CARD_W);
    ui.capCard.style.opacity = '0';
    setTimeout(function () {
      hide(function () {
        var cb = cur.onDone;
        S = null;
        if (cb) cb(result);
      }, 120);
    }, r && r.width ? 380 : 0);
  }

  function hide(done, wait) {
    confStop();
    sfx('sheetClose');
    root.classList.add('closing');
    setTimeout(function () {
      root.classList.remove('open');
      root.classList.remove('closing');
      root.classList.remove('dim', 'leave', 'fleeing', 'lit', 'teasing', 'tease-cap', 'recall');
      ui.capBg.style.transition = '';
      ui.capBg.style.opacity = '';
      if (done) done();
    }, wait || 320);
  }

  // 点左上角关闭：先问一句，确认后按逃逸处理（卡真的飞走）
  function askQuit() {
    if (!S || S.done) return;
    S.paused = true;
    ui.capConfirm.classList.add('on');
    ui.capVeil.classList.add('on');
  }
  function closeQuit() {
    ui.capConfirm.classList.remove('on');
    ui.capVeil.classList.remove('on');
  }

  function abandon() {
    if (!S || S.done) return;
    S.paused = false;
    closeQuit();
    // 确认放弃：卡片顺着当前状态飞走，卡位留空
    escape(true);
  }

  function buzz(p) {
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {}
  }

  global.Capture = {
    run: run,
    skill: skill,
    roundsFor: roundsFor,
    DUR: DUR,
    isBusy: function () { return !!S; },
  };
})(window);
