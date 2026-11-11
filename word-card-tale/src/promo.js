(function () {
  var N = +((location.search.match(/[?&]n=(\d+)/) || [])[1] || 2);
  var root = document.getElementById('slide');
  Object.defineProperty(window, 'devicePixelRatio', { get: function () { return 2; } });

  function find(w) { return WORDS.filter(function (x) { return x.w === w; })[0]; }
  function levels(w, lv) { return w.w.split('').map(function () { return lv; }); }
  function el(tag, cls, html, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    (parent || root).appendChild(e);
    return e;
  }
  function at(e, x, y, tf) {
    e.style.left = x + 'px'; e.style.top = y + 'px';
    if (tf) e.style.transform = tf;
    return e;
  }
  function staticSVG(s) {
    return s.replace(/<animate(?:Transform|Motion)?\b[^>]*\/>/g, '')
      .replace(/<g\s+filter="url\([^"]+\)"[^>]*>[\s\S]*?<\/g>/g, '')
      .replace(/\sfilter="url\([^"]+\)"/g, '');
  }
  // fx=true：保留射线 / 全息 / 隐藏款光晕（宣传图必须开）
  function card(word, lvOverride, x, y, tf, hid, fx) {
    var w = Object.assign({}, find(word));
    w.hid = !!hid;
    var lv = lvOverride || (hid ? 5 : Math.min(5, w.tier));
    w.lvl = lv;
    var box = at(el('div', 'pm-cw'), x, y, tf);
    box.appendChild(Card.render(w, { mastery: 3, levels: levels(w, lv), lite: !fx }));
    return w;
  }
  function sprite(parent, id, x, y, size, rot) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    c.className = 'pm-mon';
    at(c, x, y, rot ? 'rotate(' + rot + 'deg)' : '');
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    StageArt.draw(g, id, size / 2, size / 2, size, false);
    parent.appendChild(c);
    return c;
  }
  function header(t, s, top) {
    var h = el('div', 'pm-hd', '<div class="pm-t">' + t + '</div><div class="pm-s">' + s + '</div>');
    if (top != null) h.style.top = top + 'px';
    return h;
  }
  // 8 种武器里挑出来的 4 种，全部隐藏款 + Lv6 满级 + 觉醒态
  var KIND_ALL = ['pierce', 'thunder', 'blade', 'swift', 'blast', 'frost', 'tide', 'shield'];
  function weaponWord(k) {
    var pool = WORDS.filter(function (w) { return w.tier === 5 && w.w.length <= 10; });
    for (var i = 0; i < pool.length; i++) {
      var w = Object.assign({}, pool[i], { lvl: 6, hid: true });
      if (Card.weaponKinds(w, levels(w, 6)).main === k) return w;
    }
    return null;
  }
  function weaponPanel(k, x, y, W, H, foes) {
    var w = weaponWord(k);
    if (!w) return null;
    var K = Card.KINDS[k];
    var box = at(el('div', 'pm-wp'), x, y);
    box.style.width = W + 'px'; box.style.height = H + 'px';
    if (foes) {
      sprite(box, foes[0], W / 2 - 70, 60, 140);
      sprite(box, foes[1], 30, 140, 84, -8);
      sprite(box, foes[2], W - 114, 130, 84, 8);
    }
    var cv = el('canvas', 'pm-fx', null, box);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.getBoundingClientRect = function () { return { width: W, height: H }; };
    Battle.preview(cv, w, levels(w, 6), { bottom: 80 });
    el('div', 'pm-wnm', '<b style="color:' + K.c + '">' + K.nm + '</b><span>' + K.shot + '</span>', box);
    el('div', 'pm-wd', w.w + ' <small>EX</small>', box);
    return box;
  }
  function footer() {
    el('div', 'pm-ft', staticSVG(Card.typeTileSVG('T', 5, 64, { mythic: true })) +
      '<div class="pm-tx"><b>词卡物语</b><i>WORD CARD TALE</i></div>');
  }

  var S = {};

  // 抽卡：中大奖感 —— 隐藏款居中 + 放射光 + 冲击环
  S[2] = function () {
    el('div', 'pm-rays');
    header('每天抽新词', '做任务、去漫游 · <em>还能多抽几组</em>', 90);
    card('willow', 0, 70, 500, 'scale(1.05) rotate(-16deg)', false, false);
    card('apricity', 0, 680, 490, 'scale(1.05) rotate(14deg)', false, true);
    card('hiraeth', 0, 330, 400, 'scale(1.55) rotate(-2deg)', true, true);
    // 光只贴卡边：外圈光晕 + 四角星，卡面中间保持干净
    var hero = root.lastChild;
    hero.classList.add('pm-hero');
    el('i', 'pm-aura', null, hero);
    var stars = [[-22, 30, 30], [-30, 150, 16], [-18, 300, 22], [352, 60, 18], [360, 210, 32], [346, 360, 16],
      [60, -26, 20], [250, -22, 14], [120, 432, 18], [290, 428, 26], [-14, 410, 14], [344, -12, 24]];
    stars.forEach(function (s) {
      var st = el('i', 'pm-spark', null, hero);
      st.style.left = s[0] + 'px'; st.style.top = s[1] + 'px';
      st.style.width = st.style.height = s[2] + 'px';
    });
    at(el('div', 'pm-jack', '<b>0.3%</b><span>隐藏款</span>'), 720, 280, 'rotate(12deg)');
    at(el('div', 'pm-q', '<div class="pm-chip">抽到旧词 = 顺手复习</div>'), 60, 980, 'rotate(-6deg)');

    var tiers = [['N', '48%', 48, '#9a9083'], ['R', '28%', 28, '#c9ae87'], ['SR', '16%', 16, '#7fc27a'],
      ['SSR', '6.6%', 6.6, '#6fa8ff'], ['UR', '1.6%', 1.6, '#ff6b6b'], ['EX', '0.3%', 1.2, 'linear-gradient(90deg,#ff6b9a,#ffe066,#5fe0a0,#6fb6ff)']];
    var odds = el('div', 'pm-odds', '<div class="pm-odds-cap">— 出卡概率 —</div>');
    var bar = el('div', 'pm-odds-bar', null, odds), lb = el('div', 'pm-odds-lb', null, odds);
    tiers.forEach(function (t) {
      var seg = el('i', null, null, bar);
      seg.style.flex = t[2]; seg.style.background = t[3];
      var s = el('span', null, t[0] + '<small>' + t[1] + '</small>', lb);
      s.style.color = t[0] === 'EX' ? '#ffe066' : t[3];
    });
  };

  // 稀有度：每档开特效（SR 射线 / SSR 全息 / UR 脉冲 / EX 彩虹光晕）
  S[3] = function () {
    header('6 档稀有度', '越稀有属性越强 · <em>UR 词有 0.3% 概率出隐藏款</em>', 70);
    var codes = [['moss', 'N', '常本'], ['thicket', 'R', '藏本'], ['heath', 'SR', '稀见'],
      ['petrichor', 'SSR', '秘典'], ['lambent', 'UR', '孤本'], ['hiraeth', 'EX', '隐藏款']];
    var cols = [30, 375, 720], rows = [310, 820];
    codes.forEach(function (c, i) {
      var x = cols[i % 3], y = rows[Math.floor(i / 3)];
      var scale = c[1] === 'EX' ? 'scale(1.05)' : 'scale(.98)';
      card(c[0], 0, x, y, scale, c[1] === 'EX', true);
      var l = at(el('div', 'pm-tl', c[1] + '<small>' + c[2] + '</small>'), x, y + (c[1] === 'EX' ? 420 : 410));
      l.style.color = c[1] === 'EX' ? '#ffe066' : (i >= 3 ? '#ffd77a' : '#e8dcc0');
    });
  };

  // 武器：?k= 指定 4 种（调试时可换成其他武器对比）
  S[4] = function () {
    var ks = ((location.search.match(/[?&]k=([\w,]+)/) || [])[1] || 'pierce,blast,frost,swift').split(',');
    header('背过的词 · 变成弹幕', '字母构成决定武器 · <em>8 种武器 8 种大招</em>', 80);
    var foes = [['bigben', 'bus', 'scone'], ['fuji', 'sushi', 'onigiri'], ['eiffel', 'macaron', 'croissant'], ['liberty', 'pizza', 'hotdog']];
    var pos = [[50, 320], [560, 320], [50, 830], [560, 830]];
    ks.slice(0, 4).forEach(function (k, i) { weaponPanel(k, pos[i][0], pos[i][1], 470, 480, foes[i]); });
  };

  // 学习闭环：拼写面板用游戏里的 cap-panel 金箔字母格，不是哥特体瓦片
  S[5] = function () {
    header('拼对一次 · 变强一分', '玩着就把单词背了 · <em>每次拼写都在涨熟练度</em>', 48);
    var w = card('hiraeth', 0, 375, 225, 'scale(1.5)', true, true);
    root.querySelector('.pm-cw').style.transformOrigin = 'top center';
    var letters = w.w.toUpperCase().split('');
    var filled = 5; // 已填 H I R A E，光标在第 6 格
    var slots = letters.map(function (ch, i) {
      var cls = 'cap-slot' + (i < filled ? ' on' : '') + (i === filled ? ' cur' : '');
      return '<span class="' + cls + '">' + (i < filled ? ch : '') + '</span>';
    }).join('');
    var used = {};
    for (var i = 0; i < filled; i++) used[letters[i]] = (used[letters[i]] || 0) + 1;
    var bank = letters.slice().sort().map(function (ch) {
      var u = used[ch] > 0;
      if (u) used[ch]--;
      return '<button class="cap-key' + (u ? ' used' : '') + '" type="button">' + ch + '</button>';
    }).join('');
    el('div', 'pm-cap',
      '<div class="cap-panel">' +
        '<div class="cap-slots">' + slots + '</div>' +
        '<div class="cap-bank">' + bank + '</div>' +
      '</div>');
    el('div', 'pm-xp', '<div class="pm-gain">+22 XP</div><div class="pm-xp-bar"><i></i></div>' +
      '<div class="pm-xp-lb"><span>熟练 1 阶</span><span>熟练 2 阶</span><span>熟练 3 阶 · 可升阶</span></div>');
    var steps = [['抽词', '每天新词', '#ffd77a'], ['拼写', '默写涨 XP', '#5fe0b8'], ['升阶', '火力上限↑', '#c49bff'], ['出战', '漫游打首领', '#ff8a5c']];
    var fl = el('div', 'pm-flow');
    steps.forEach(function (s, i) {
      var st = el('div', 'pm-step', '<b>' + s[0] + '</b><small>' + s[1] + '</small>', fl);
      st.style.setProperty('--c', s[2]);
      if (i < steps.length - 1) el('div', 'pm-ar', '›', fl);
    });
  };

  // 城市漫游
  S[6] = function () {
    header('环游世界 · 挑战首领', '30 座城市 · 每城 5 关 · <em>地标就是 Boss</em>', 90);
    var cities = [
      ['london', '伦敦', 'LONDON', '#c8343c', '#6e1430'],
      ['tokyo', '东京', 'TOKYO', '#ff7f9f', '#8a2a5a'],
      ['paris', '巴黎', 'PARIS', '#4f7fe0', '#22306e'],
      ['nyc', '纽约', 'NEW YORK', '#f0a830', '#7a4a10'],
      ['singapore', '新加坡', 'SINGAPORE', '#2fbfa0', '#0f5a52'],
      ['istanbul', '伊斯坦布尔', 'ISTANBUL', '#9a6ae0', '#3e2370']
    ];
    cities.forEach(function (c, i) {
      var R = StageArt.REGIONS[c[0]];
      var box = at(el('div', 'pm-city'), i % 2 ? 565 : 50, 320 + Math.floor(i / 2) * 330);
      box.style.background = 'radial-gradient(circle at 76% 58%, rgba(255,255,255,.3) 0, transparent 52%), linear-gradient(135deg,' + c[3] + ',' + c[4] + ')';
      el('div', 'pm-ccn', c[1], box);
      el('div', 'pm-cen', c[2], box);
      el('div', 'pm-boss', 'BOSS', box);
      sprite(box, R.landmark, 225, 50, 230);
      R.items.slice(0, 3).forEach(function (id, j) { sprite(box, id, 18 + j * 70, 196, 76, (j - 1) * 8); });
    });
  };

  // 图鉴墙
  S[7] = function () {
    var words = ['sylvan', 'petrichor', 'apricity', 'penumbra', 'lambent', 'opalescent', 'susurrus', 'sonder',
      'sojourner', 'vellichor', 'serendipity', 'epiphany', 'halcyon', 'nebula', 'zenith', 'welkin',
      'numinous', 'liminal', 'solstice', 'zephyr', 'ambrosia', 'nefelibata', 'equinox', 'saffron',
      'crepuscular', 'mellifluous', 'quiescent', 'scintilla', 'elegy', 'languor'];
    var wall = el('div', 'pm-wall');
    var save = root; root = wall;
    words.forEach(function (w, i) {
      var c = i % 5, r = Math.floor(i / 5);
      card(w, 0, c * 280 + (r % 2 ? 140 : 0) - 70, r * 345 - 40, 'scale(.8)', false, false);
    });
    root = save;
    el('div', 'pm-fade');
    el('div', 'pm-glow');
    card('hiraeth', 0, 375, 660, 'scale(1.3) rotate(-3deg)', true, true);
    root.lastChild.style.zIndex = 6;
    header('冷门美词图鉴', '1900+ 单词 · <em>收集你的私人词典</em>', 150);
  };

  root.setAttribute('data-n', N);
  (S[N] || S[2])();
  footer();
})();
