(function () {
  var N = +((location.search.match(/[?&]n=(\d+)/) || [])[1] || 1);
  var root = document.getElementById('slide');
  root.setAttribute('data-n', N);

  var COVER = [
    'maneki', 'sushi', 'croissant', 'pizza', 'taco', 'hotdog',
    'llama', 'elephant', 'camel', 'kangaroo', 'penguin', 'owl',
    'bus', 'tuktuk', 'vespa', 'dingding', 'cablecar', 'tram28',
    'skull', 'nazar', 'daruma', 'cactus', 'lamp', 'surfboard',
    'scone', 'macaron', 'onigiri', 'gelato', 'churro', 'durian',
    'bigben', 'fuji', 'eiffel', 'liberty', 'pyramid', 'goldengate'
  ];
  var LANDMARKS = {
    bigben: 1, fuji: 1, eiffel: 1, liberty: 1, pyramid: 1, goldengate: 1
  };

  // 封面 1 + 内页 17 = 18（小红书上限）
  var PAGES = {
    2:  { t: '世界早餐', ids: ['scone', 'croissant', 'kaya', 'pinebun'] },
    3:  { t: '街边小吃', ids: ['hotdog', 'tteokbokki', 'taco', 'padthai'] },
    4:  { t: '城市萌物', ids: ['maneki', 'llama', 'elephant', 'nazar'] },
    5:  { t: '街头载具', ids: ['bus', 'tuktuk', 'vespa', 'dingding'] },
    6:  { t: '城市地标', ids: ['bigben', 'fuji', 'pyramid', 'colosseum'] },
    7:  { t: '甜品时刻', ids: ['macaron', 'gelato', 'custard', 'alfajor'] },
    8:  { t: '亚洲面食', ids: ['wonton', 'pho', 'kimbap', 'onigiri'] },
    9:  { t: '咖啡茶饮', ids: ['coffee', 'espresso', 'milktea', 'minttea'] },
    10: { t: '地标巡礼', ids: ['liberty', 'eiffel', 'goldengate', 'christ'] },
    11: { t: '城市交通', ids: ['cablecar', 'tram28', 'rickshaw', 'bicycle'] },
    12: { t: '动物伙伴', ids: ['penguin', 'kangaroo', 'owl', 'camel'] },
    13: { t: '祭典符号', ids: ['skull', 'daruma', 'lamp', 'maraca'] },
    14: { t: '水果甜食', ids: ['durian', 'mango', 'pineapple', 'tanghulu'] },
    15: { t: '欧陆风味', ids: ['pretzel', 'stroopwafel', 'paella', 'jamon'] },
    16: { t: '市集香料', ids: ['falafel', 'tagine', 'couscous', 'dates'] },
    17: { t: '海港风光', ids: ['surfboard', 'merlion', 'opera', 'diamondhead'] },
    18: { t: '世界奇观', ids: ['sagrada', 'parthenon', 'templeofheaven', 'machupicchu'] }
  };

  function el(tag, cls, html, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    (parent || root).appendChild(e);
    return e;
  }

  function header(t, s, top) {
    var html = '<div class="mp-t">' + t + '</div>';
    if (s) html += '<div class="mp-s">' + s + '</div>';
    var h = el('div', 'mp-hd' + (s ? '' : ' solo'), html);
    if (top != null) h.style.top = top + 'px';
    return h;
  }

  function footer() {
    el('div', 'mp-ft',
      '<div class="mark">T</div><div><b>词卡物语</b><i>WORD CARD TALE</i></div>');
  }

  function regionOf(id) {
    var name = '';
    Object.keys(StageArt.REGIONS).some(function (rid) {
      var r = StageArt.REGIONS[rid];
      if (r.items.indexOf(id) >= 0 || r.elite === id || r.landmark === id) {
        name = ({
          london: '伦敦', nyc: '纽约', tokyo: '东京', paris: '巴黎', singapore: '新加坡',
          istanbul: '伊斯坦布尔', seoul: '首尔', bangkok: '曼谷', mexico: '墨西哥城', cairo: '开罗',
          lisbon: '里斯本', rome: '罗马', hongkong: '香港', rio: '里约', mumbai: '孟买',
          moscow: '莫斯科', sydney: '悉尼', barcelona: '巴塞罗那', amsterdam: '阿姆斯特丹',
          berlin: '柏林', athens: '雅典', marrakech: '马拉喀什', hanoi: '河内', beijing: '北京',
          toronto: '多伦多', capetown: '开普敦', buenosaires: '布宜诺斯艾利斯', cusco: '库斯科',
          sanfrancisco: '旧金山', honolulu: '檀香山'
        })[rid] || rid;
        return true;
      }
      return false;
    });
    return name;
  }

  function drawSprite(parent, id, size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    StageArt.draw(g, id, size / 2, size / 2, size, false);
    parent.appendChild(c);
    return c;
  }

  function cover() {
    header('怪物图鉴', '环游世界的像素小怪们', 56);
    var wall = el('div', 'mp-wall');
    COVER.forEach(function (id) {
      var cell = el('div', 'mp-cell' + (LANDMARKS[id] ? ' landmark' : ''), null, wall);
      drawSprite(cell, id, LANDMARKS[id] ? 100 : 90);
    });
  }

  function quad(page) {
    header(page.t, null, 56);
    var grid = el('div', 'mp-grid4');
    page.ids.forEach(function (id) {
      var info = StageArt.info(id);
      var card = el('div', 'mp-card', null, grid);
      var art = el('div', 'mp-art', null, card);
      drawSprite(art, id, 380);
      el('div', 'mp-cn', info.cn, card);
      el('div', 'mp-en', info.en, card);
      el('div', 'mp-meta', regionOf(id), card);
    });
  }

  if (N === 1) cover();
  else if (PAGES[N]) quad(PAGES[N]);
  else cover();
  footer();
})();
