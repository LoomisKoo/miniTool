(function () {
  var HERO = 'hiraeth', LEFT = 'epiphany', RIGHT = 'lambent';

  function find(w) { return WORDS.filter(function (x) { return x.w === w; })[0]; }
  function levels(w, lv) { return w.w.split('').map(function () { return lv; }); }
  function put(id, w, lv, hid) {
    var word = Object.assign({}, w, { lvl: lv, hid: !!hid });
    document.getElementById(id).appendChild(Card.render(word, { mastery: 3, levels: levels(w, lv), lite: true }));
    return word;
  }

  put('cLeft', find(LEFT), 5, false);
  put('cRight', find(RIGHT), 5, false);
  var hero = put('cHero', find(HERO), 5, true);

  // Logo 只要静态的隐藏款 T
  document.getElementById('logoMark').innerHTML = Card.typeTileSVG('T', 5, 150, { mythic: true })
    .replace(/<animate(?:Transform|Motion)?\b[^>]*\/>/g, '')
    .replace(/<g\s+filter="url\([^"]+\)"[^>]*>[\s\S]*?<\/g>/g, '')
    .replace(/\sfilter="url\([^"]+\)"/g, '');

  // 主卡的真实战机：满火力开火，弹幕从卡片后方穿出。
  // 画布被 CSS 放大 2 倍，按 2 倍像素渲染才不糊
  Object.defineProperty(window, 'devicePixelRatio', { get: function () { return 2; } });
  var ship = document.getElementById('ship');
  ship.getBoundingClientRect = function () { return { width: 540, height: 720 }; };
  Battle.preview(ship, hero, levels(hero, 5), { bottom: 110 });

  // 战机两侧的像素怪物
  var mons = [
    ['maneki', 50, 1010, 170, -8], ['bigben', 850, 960, 200, 6],
    ['sushi', 190, 1250, 120, 10], ['durian', 790, 1250, 120, -10]
  ];
  var box = document.getElementById('mons');
  mons.forEach(function (m) {
    var c = document.createElement('canvas');
    c.width = c.height = m[3];
    c.className = 'mon';
    c.style.left = m[1] + 'px'; c.style.top = m[2] + 'px';
    c.style.transform = 'rotate(' + m[4] + 'deg)';
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    StageArt.draw(g, m[0], m[3] / 2, m[3] / 2, m[3], false);
    box.appendChild(c);
  });
})();
