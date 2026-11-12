/**
 * 卡造 · 交互与导出
 */
(function () {
  'use strict';

  var CT = window.CardTemplates;
  var PXMM = CT.PXMM;

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage');
  var zoom = $('zoom');
  var flip = $('flip');
  var faceFront = $('faceFront');
  var faceBack = $('faceBack');
  var tplName = $('tplName');
  var tplSize = $('tplSize');
  var sizeHint = $('sizeHint');
  var flipBtn = $('flipBtn');
  var flipTxt = $('flipTxt');
  var toastEl = $('toast');

  var FIELD_DEFS = {
    name: ['姓名 / 名称', '林知远'],
    nameEn: ['英文名', 'LIN ZHIYUAN'],
    role: ['职位 / 专业', '产品设计师'],
    org: ['公司 / 学校', 'LUMEN STUDIO'],
    id: ['编号 / 学号', 'NO.00823'],
    phone: ['联系电话', '138 0013 8000'],
    email: ['邮箱', 'hi@lumen.studio'],
    site: ['网址 / 账号', 'lumen.studio'],
    addr: ['地址', '上海 · 徐汇区永嘉路 42 号'],
    tier: ['会员等级', 'GOLD MEMBER'],
    handle: ['社交账号', '@lumen.design'],
    breed: ['品种 / 年龄', '英短 · 3 岁'],
    emergency: ['紧急联系人', '妈妈 139 0013 9000'],
    validity: ['有效期', '2026 — 2028'],
    table: ['桌号', '07'],
    date: ['日期', '2027.05.20'],
    batch: ['批次 / 编号', 'NO.024'],
    size: ['尺码', 'M / 38'],
    price: ['价格', '¥ 428'],
    tagline: ['一句话', '把复杂的事做简单'],
    dept: ['部门', '市场部'],
    level: ['等级 / 称号', '资深摸鱼师 · Lv.8'],
    mbti: ['MBTI 类型', 'INFP'],
    alias: ['人格别名', '调停者 · 白日梦想家'],
    traits: ['性格标签', '共情力强 · 内心戏多 · 拖延但善良'],
    tags: ['标签（逗号分隔）', '饭搭子, 旅行搭子, 演唱会'],
    group: ['团体 / 品牌', 'LUMEN'],
    era: ['版本 / 时期', '2026 · 巡演限定'],
    game: ['游戏名', 'VALORANT'],
    rank: ['段位 / 职务', '不朽 · IMMORTAL 2'],
    time: ['时间', '03:47'],
    note: ['备注', '再刷五分钟，结果天亮了'],
    age: ['年龄 / 班级', '5 岁 · 中班'],
    hobby: ['爱好', '画画、抠墙皮'],
    quote: ['口头禅', '我不要！'],
    guardian: ['监护人', '妈妈 139 0013 9000'],
    human: ['铲屎官', '林知远'],
    position: ['担当 / 定位', '主舞 / 门面'],
    debut: ['出道日 / 场次', 'DEBUT 2026.10'],
    mood: ['状态大字', '勿 扰'],
    character: ['角色名', '沉默的钟表匠'],
    secret: ['秘密任务', '你其实见过凶手。'],
    fortune: ['今日运势', '大 吉'],
    room: ['宿舍号', '302'],
    bed: ['床位', '下铺 · 靠窗'],
    slogan: ['应援口号', '你只管发光'],
    pet: ['宠物名字', '团子 / 英短'],
    since: ['开始养的日子', '2023.05'],
    duty: ['岗位职责', '铲屎 · 投喂 · 挨打'],
    fest: ['活动 / 音乐节', '草莓音乐节'],
    stack: ['技术栈（逗号分隔）', 'TypeScript, React, Node'],
    hours: ['在线时间', '晚 8 点后在线'],
    specialty: ['拍摄方向', '人像 / 胶片 / 婚礼跟拍'],
    genre: ['音乐风格', '独立 / 后摇 / 电子'],
    a: ['甲方 / 我', '林知远'],
    b: ['乙方 / TA', '小林'],
    promise: ['约定内容', '吵架不过夜，生气要说出来。'],
    since: ['在一起的日期', '2023.05.20'],
    to: ['发给谁', '你'],
    from: ['署名 / 欠款人', '林知远'],
    reason: ['拒绝理由', '你人真的很好，但我还不想谈恋爱。'],
    item: ['欠的是什么', '一顿火锅'],
    count: ['数量', '×1'],
    state: ['诊断结果', '间歇性想开了，持续性想不开'],
    level: ['严重程度', '中度 · 建议多睡觉'],
    job: ['岗位', '家庭氛围组组长'],
    salary: ['薪资', '罐头 ×2 / 天'],
    cityA: ['城市 A', '上海'],
    cityB: ['城市 B', '伦敦'],
    next: ['下次见面', '12.24'],
    movie: ['片名', '爱在黎明破晓前'],
    seat: ['座位', '7 排 8 座'],
    cinema: ['影院 / 厅', 'LUMEN CINEMA · 3 号厅'],
    academy: ['学院 / 组织', 'LUMEN 魔法学院'],
    house: ['分院 / 阵营', '星语学院'],
    course: ['主修课程', '变形术 · 星象占卜'],
    codename: ['代号 / 英雄名', '夜航者'],
    power: ['能力 / 招式', '城市上空短距飞行'],
    weakness: ['弱点', '非常怕冷'],
    division: ['所属部门', '情报处 · 第七科'],
    clearance: ['权限等级', 'L-4'],
    mission: ['当前任务', '盯住那个人'],
    starship: ['舰船 / 单位', '夜莺号 · NCC-0823'],
    sector: ['星区 / 辖区', '第 7 星区'],
    origin: ['来自宇宙', '地球 · 2026'],
    destination: ['前往宇宙', '宇宙 B-07 · 无冬城'],
    title: ['称号', '城市的守夜人'],
    atk: ['攻击力', '7'],
    def: ['防御力', '4'],
    skill: ['技能说明', '夜幕降临时，攻击力 +2。'],
    rarity: ['稀有度', 'SR'],
    bio: ['一句话简介', '白天写代码，晚上写自己。'],
    location: ['所在地 / 属地', '上海 · 徐汇'],
    joined: ['加入时间', '2019 年 3 月加入'],
    following: ['关注数', '717'],
    followers: ['粉丝数', '5,336'],
    likes: ['获赞 / 收藏', '5.0 万'],
    contributions: ['贡献数', '2,321'],
    period: ['统计区间', '2024.06 — 2025.01'],
    motto: ['座右铭', 'Make Something Wonderful'],
    now: ['正在做', 'building in public']
  };

  var ACCENTS = [
    { id: 'default', name: '原色', color: '', color2: '' },
    { id: 'lime', name: '荧光绿', color: '#ccff3f', color2: '#eaffab' },
    { id: 'pink', name: '莓果粉', color: '#ff5c9e', color2: '#ffc2d9' },
    { id: 'violet', name: '电紫', color: '#8b5cf6', color2: '#cfc0ff' },
    { id: 'orange', name: '橘子汽水', color: '#ff8a3d', color2: '#ffd0ac' },
    { id: 'blue', name: '泳池蓝', color: '#2fa8ff', color2: '#b3e2ff' },
    { id: 'ink', name: '墨黑', color: '#17140f', color2: '#a09a90' }
  ];


  var state = {
    tplId: 'id-lanyard',
    values: {},
    edited: {},
    photo: '',
    logo: '',
    accent: ACCENTS[0],
    side: 'front',
    qrMode: 'vcard',
    qrText: '',
    quality: 1.5,
    cat: 'all'
  };

  function tpl() { return CT.get(state.tplId); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------------- 数据 ---------------- */
  function seed() {
    var demo = tpl().demo || {};
    for (var k in demo) {
      if (!state.edited[k]) state.values[k] = demo[k];
    }
  }

  function qrPayload(d) {
    if (state.qrMode === 'text') {
      return state.qrText || d.name || '';
    }
    if (state.qrMode === 'url') {
      var u = d.site || '';
      if (!u) return '';
      return /^https?:\/\//i.test(u) ? u : 'https://' + u;
    }
    var rows = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:' + (d.name || ''),
      'FN:' + (d.name || ''),
      d.org ? 'ORG:' + d.org : '',
      d.role ? 'TITLE:' + d.role : '',
      d.phone ? 'TEL;TYPE=CELL:' + d.phone : '',
      d.email ? 'EMAIL:' + d.email : '',
      d.site ? 'URL:' + d.site : '',
      'END:VCARD'
    ];
    return rows.filter(function (x) { return !!x; }).join('\n');
  }

  var qrCache = {};
  function qrDataUrl(payload) {
    if (!payload) return '';
    if (qrCache[payload]) return qrCache[payload];
    try {
      var qr = window.qrcode(0, 'M');
      qr.addData(payload);
      qr.make();
      var url = qr.createDataURL(6, 3);
      qrCache[payload] = url;
      return url;
    } catch (e) {
      return '';
    }
  }

  /** 2023.05.20 / 2023-5-20 / 2023年5月20日 → 天数 */
  function daysSince(v) {
    if (!v) return null;
    var s = String(v).trim()
      .replace(/[年月]/g, '-')
      .replace(/日/g, '')
      .replace(/[.\/]/g, '-')
      .replace(/-+$/, '');
    var t = new Date(s);
    if (isNaN(t.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - t.getTime()) / 86400000));
  }

  function buildData(T) {
    var d = {};
    var demo = T.demo || {};
    for (var k in demo) d[k] = demo[k];
    for (var key in state.values) d[key] = state.values[key];
    d.__photo = state.photo || '';
    d.__logo = state.logo || '';
    d.__initial = d.name ? String(d.name).slice(0, 1) : '·';
    if (T.countFrom) d.__days = daysSince(d[T.countFrom]);
    d.__qr = qrDataUrl(qrPayload(d));
    return d;
  }

  /** 缩略图用：模板自带示例值 + 用户已上传的图片，不串用其它模板的字段 */
  function demoData(T) {
    var d = {};
    var demo = T.demo || {};
    for (var k in demo) d[k] = demo[k];
    d.__photo = state.photo || '';
    d.__logo = state.logo || '';
    d.__initial = d.name ? String(d.name).slice(0, 1) : '·';
    if (T.countFrom) d.__days = daysSince(d[T.countFrom]);
    d.__qr = qrDataUrl(qrPayload(d));
    return d;
  }

  /* ---------------- 渲染 ---------------- */
  function radiusOf(T) {
    return T.shape === 'circle' ? '50%' : (T.radius * PXMM) + 'px';
  }

  function paintFace(el, side, T, d) {
    var w = T.w * PXMM;
    var h = T.h * PXMM;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.borderRadius = radiusOf(T);
    el.style.setProperty('--mm', PXMM + 'px');
    el.innerHTML = CT.render(T, side, d);
    var card = el.firstChild;
    if (card) {
      card.style.setProperty('--mm', PXMM + 'px');
      if (state.accent && state.accent.color) {
        card.style.setProperty('--accent', state.accent.color);
        card.style.setProperty('--accent-2', state.accent.color2);
      }
    }
  }

  function renderStage() {
    var T = tpl();
    var d = buildData(T);
    paintFace(faceFront, 'front', T, d);
    if (T.back) {
      paintFace(faceBack, 'back', T, d);
      faceBack.classList.remove('is-blank');
    } else {
      faceBack.innerHTML = '';
      faceBack.classList.add('is-blank');
      resetFlip();
    }
    flipBtn.style.display = T.back ? '' : 'none';
    $('photoBtn').style.display = (T.fields.indexOf('photo') >= 0 || T.fields.indexOf('logo') >= 0) ? '' : 'none';
    var tools = document.querySelector('.stage-tools');
    if (tools) tools.style.justifyContent = 'center';
    tplName.textContent = T.name;
    tplSize.textContent = T.w + ' × ' + T.h + ' mm';
    var hint = T.w + ' × ' + T.h + ' mm';
    if (T.shape === 'circle') hint += ' · 圆形';
    else if (T.radius) hint += ' · 圆角 ' + T.radius + 'mm';
    sizeHint.textContent = hint;
    fit();
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  function fit() {
    var T = tpl();
    var w = T.w * PXMM;
    var h = T.h * PXMM;
    var inner = $('stageInner');
    var boxW = inner ? inner.clientWidth : stage.clientWidth;
    var boxH = inner ? inner.clientHeight : stage.clientHeight;
    var availW = (boxW || window.innerWidth) - 32;
    var availH = (boxH || window.innerHeight * 0.52) - 32;
    if (availH < 120) availH = window.innerHeight * 0.44;
    var s = Math.min(availW / w, availH / h, 1.1);
    if (!(s > 0.05)) s = 0.45;
    zoom.style.width = Math.round(w * s) + 'px';
    zoom.style.height = Math.round(h * s) + 'px';
    flip.style.width = w + 'px';
    flip.style.height = h + 'px';
    flip.style.transform = 'scale(' + s + ')';
  }

  function resetFlip() {
    flip.classList.remove('is-flipped');
    state.side = 'front';
    flipTxt.textContent = '翻到背面';
    if ($('sideSeg')) setSeg($('sideSeg'), 'data-side', 'front');
  }

  function toggleFlip() {
    if (!tpl().back) return;
    state.side = state.side === 'front' ? 'back' : 'front';
    flip.classList.toggle('is-flipped', state.side === 'back');
    flipTxt.textContent = state.side === 'front' ? '翻到背面' : '翻回正面';
  }

  /* ---------------- 模板面板 ---------------- */
  var catRow = $('catRow');
  var tplGrid = $('tplGrid');

  function renderCats() {
    var html = '<button type="button" class="cat-chip' + (state.cat === 'all' ? ' on' : '') + '" data-cat="all">全部</button>';
    CT.CATS.forEach(function (c) {
      html += '<button type="button" class="cat-chip' + (state.cat === c.id ? ' on' : '') + '" data-cat="' + c.id + '">' + c.name + '</button>';
    });
    catRow.innerHTML = html;
  }

  function renderGrid() {
    var html = '';
    CT.list.forEach(function (T) {
      if (state.cat !== 'all' && T.cat !== state.cat) return;
      var w = T.w * PXMM;
      var h = T.h * PXMM;
      html += '<button type="button" class="tpl-item' + (T.id === state.tplId ? ' on' : '') + '" data-tpl="' + T.id + '">' +
        '<div class="mini" data-w="' + w + '" data-h="' + h + '">' +
        '<span class="tpl-badge">PICKED</span>' +
        '<div class="mini-stage" style="width:' + w + 'px;height:' + h + 'px">' +
        '<div class="artboard" style="width:' + w + 'px;height:' + h + 'px;border-radius:' + radiusOf(T) + ';--mm:' + PXMM + 'px">' +
        CT.render(T, 'front', demoData(T)) +
        '</div></div></div>' +
        '<div class="tpl-name">' + T.name + '<em>' + T.w + '×' + T.h + '</em></div>' +
        '<div class="tpl-desc">' + T.desc + '</div>' +
        '</button>';
    });
    tplGrid.innerHTML = html;
    var items = tplGrid.querySelectorAll('.tpl-item');
    for (var j = 0; j < items.length; j++) {
      var tid = items[j].getAttribute('data-tpl');
      items[j].setAttribute('data-cat', CT.get(tid).cat);
    }
    if (state.accent && state.accent.color) {
      var cards = tplGrid.querySelectorAll('.card');
      for (var i = 0; i < cards.length; i++) {
        cards[i].style.setProperty('--accent', state.accent.color);
        cards[i].style.setProperty('--accent-2', state.accent.color2);
      }
    }
    scaleMinis();
  }

  function scaleMinis() {
    var minis = tplGrid.querySelectorAll('.mini');
    for (var i = 0; i < minis.length; i++) {
      var m = minis[i];
      var st = m.querySelector('.mini-stage');
      var w = parseFloat(m.getAttribute('data-w'));
      var h = parseFloat(m.getAttribute('data-h'));
      var bw = m.clientWidth;
      var bh = m.clientHeight;
      if (!bw || !st) continue;
      var s = Math.min((bw - 22) / w, (bh - 22) / h);
      st.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
    }
  }

  /* ---------------- 信息面板 ---------------- */
  var fieldBody = $('fieldBody');

  function renderFields() {
    var T = tpl();
    var html = '';
    T.fields.forEach(function (key) {
      if (key === 'photo' || key === 'qr' || key === 'logo') return;
      var def = FIELD_DEFS[key] || [key, ''];
      html += '<div class="field"><label>' + def[0] + '</label>' +
        '<input data-key="' + key + '" value="' + esc(state.values[key] || '') + '" placeholder="' + esc(def[1] || '') + '"></div>';
    });
    if (T.fields.indexOf('qr') >= 0) {
      html += '<div class="section-label">二维码内容</div>' +
        '<div class="seg" id="qrSeg">' +
        '<button type="button" data-qr="vcard"' + (state.qrMode === 'vcard' ? ' class="on"' : '') + '>名片</button>' +
        '<button type="button" data-qr="url"' + (state.qrMode === 'url' ? ' class="on"' : '') + '>链接</button>' +
        '<button type="button" data-qr="text"' + (state.qrMode === 'text' ? ' class="on"' : '') + '>文字</button>' +
        '</div>' +
        '<div class="field" id="qrTextWrap"' + (state.qrMode === 'text' ? '' : ' style="display:none"') + '>' +
        '<label>自定义</label><input id="qrText" value="' + esc(state.qrText) + '" placeholder="扫码后想显示的文字"></div>' +
        '<p class="tip">名片码会自动写入姓名、电话、邮箱和网址；链接码适合社交主页。</p>';
    }
    fieldBody.innerHTML = html;
  }

  fieldBody.addEventListener('input', function (e) {
    var key = e.target.getAttribute('data-key');
    if (key) {
      state.values[key] = e.target.value;
      state.edited[key] = true;
      schedule();
      return;
    }
    if (e.target.id === 'qrText') {
      state.qrText = e.target.value;
      schedule();
    }
  });

  fieldBody.addEventListener('click', function (e) {
    var q = e.target.getAttribute('data-qr');
    if (!q) return;
    state.qrMode = q;
    var btns = fieldBody.querySelectorAll('#qrSeg button');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-qr') === q);
    $('qrTextWrap').style.display = q === 'text' ? '' : 'none';
    renderStage();
  });

  /* ---------------- 样式面板 ---------------- */
  var swatches = $('swatches');

  function renderStyle() {
    var html = '';
    ACCENTS.forEach(function (a) {
      var bg = a.color ? 'background:' + a.color : '';
      html += '<button type="button" class="swatch' + (a.id === state.accent.id ? ' on' : '') + (a.color ? '' : ' is-default') +
        '" data-accent="' + a.id + '" style="' + bg + '" title="' + a.name + '" aria-label="' + a.name + '">' + (a.color ? '' : '原') + '</button>';
    });
    swatches.innerHTML = html;

    var pt = $('photoThumb');
    var lt = $('logoThumb');
    pt.innerHTML = state.photo ? '<img src="' + state.photo + '" alt="">' : '<i data-lucide="user-round"></i>';
    lt.innerHTML = state.logo ? '<img src="' + state.logo + '" alt="">' : '<i data-lucide="hexagon"></i>';
    $('photoTile').classList.toggle('has', !!state.photo);
    $('logoTile').classList.toggle('has', !!state.logo);
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  swatches.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-accent]') : null;
    if (!el) return;
    var id = el.getAttribute('data-accent');
    for (var i = 0; i < ACCENTS.length; i++) {
      if (ACCENTS[i].id === id) state.accent = ACCENTS[i];
    }
    renderStyle();
    renderStage();
    if ($('sheetTpl').classList.contains('open')) renderGrid();
  });

  /* ---------------- 图片 ---------------- */
  function readImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var raw = reader.result;
      var img = new Image();
      img.onload = function () {
        var max = 1000;
        var s = Math.min(1, max / Math.max(img.width, img.height));
        if (s >= 1) { cb(raw); return; }
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = function () { cb(raw); };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  }

  $('photoTile').addEventListener('click', function () { $('photoInput').click(); });
  $('logoTile').addEventListener('click', function () { $('logoInput').click(); });
  $('photoInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    readImage(f, function (url) {
      state.photo = url;
      renderStyle();
      renderStage();
      toast('图片已换上');
    });
    e.target.value = '';
  });
  $('logoInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    readImage(f, function (url) {
      state.logo = url;
      renderStyle();
      renderStage();
      toast('Logo 已放上');
    });
    e.target.value = '';
  });
  $('clearImg').addEventListener('click', function () {
    state.photo = '';
    state.logo = '';
    renderStyle();
    renderStage();
    toast('已清除图片');
  });

  /* ---------------- 面板开关 ---------------- */
  function openSheet(id) {
    var el = $(id);
    if (!el) return;
    var others = document.querySelectorAll('.sheet.open');
    for (var i = 0; i < others.length; i++) others[i].classList.remove('open');
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (id === 'sheetTpl') {
      renderCats();
      renderGrid();
      var m = $('tplBody');
      if (m) m.scrollTop = 0;
      window.requestAnimationFrame(scaleMinis);
    }
    if (id === 'sheetStyle') {
      window.requestAnimationFrame(function () {
          });
    }
  }
  function closeSheet(id) {
    var el = $(id);
    if (!el) return;
    el.classList.remove('open');
    if (!document.querySelector('.sheet.open')) document.body.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var closest = function (sel) { return t.closest ? t.closest(sel) : null; };
    var closeEl = closest('[data-close]');
    if (closeEl) { closeSheet(closeEl.getAttribute('data-close')); return; }
    var tplEl = closest('[data-tpl]');
    if (tplEl) {
      state.tplId = tplEl.getAttribute('data-tpl');
      seed();
      resetFlip();
      renderStage();
      renderFields();
      renderGrid();
      closeSheet('sheetTpl');
      return;
    }
    var catEl = closest('[data-cat]');
    if (catEl) {
      state.cat = catEl.getAttribute('data-cat');
      renderCats();
      renderGrid();
    }
  });

  $('btnTpl').addEventListener('click', function () { openSheet('sheetTpl'); });
  $('btnInfo').addEventListener('click', function () {
    renderFields();
    openSheet('sheetInfo');
  });
  $('btnStyle').addEventListener('click', function () {
    renderStyle();
    openSheet('sheetStyle');
  });
  $('btnExport').addEventListener('click', function () {
    setSeg($('sideSeg'), 'data-side', state.side);
    setSeg($('qualitySeg'), 'data-q', String(state.quality));
    openSheet('sheetExport');
  });
  $('photoBtn').addEventListener('click', function () {
    renderStyle();
    openSheet('sheetStyle');
    setTimeout(function () { $('photoInput').click(); }, 220);
  });
  flipBtn.addEventListener('click', toggleFlip);

  /* ---------------- 导出 ---------------- */
  var exportTip = $('exportTip');

  function setSeg(container, attr, value) {
    if (!container) return;
    var btns = container.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute(attr) === String(value));
    }
  }

  $('sideSeg').addEventListener('click', function (e) {
    var s = e.target.getAttribute('data-side');
    if (!s) return;
    state.side = s;
    setSeg($('sideSeg'), 'data-side', s);
  });
  $('qualitySeg').addEventListener('click', function (e) {
    var q = e.target.getAttribute('data-q');
    if (!q) return;
    state.quality = parseFloat(q);
    setSeg($('qualitySeg'), 'data-q', q);
  });

  function whenFonts() {
    if (document.fonts && document.fonts.ready) return document.fonts.ready;
    return Promise.resolve();
  }

  function cardDataUrl(node, ratio) {
    return whenFonts().then(function () {
      var opts = {
        pixelRatio: ratio,
        width: node.offsetWidth,
        height: node.offsetHeight,
        cacheBust: true,
        style: {
          transform: 'none',
          boxShadow: 'none',
          backfaceVisibility: 'visible',
          webkitBackfaceVisibility: 'visible'
        }
      };
      if (window.__FONT_EMBED_CSS) opts.fontEmbedCSS = window.__FONT_EMBED_CSS;
      return window.htmlToImage.toCanvas(node, opts);
    }).then(function (canvas) {
      return canvas.toDataURL('image/png');
    });
  }

  function download(url, name) {
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function exportOne(side) {
    var T = tpl();
    if (side === 'back' && !T.back) { toast('这个模板只有正面'); return Promise.resolve(); }
    if (!window.htmlToImage) { toast('导出组件未加载'); return Promise.resolve(); }
    var node = side === 'back' ? faceBack : faceFront;
    toast('正在生成高清图…');
    var run = cardDataUrl(node, state.quality);
    return run.then(function (url) {
      download(url, '卡造-' + T.name + '-' + (side === 'back' ? '背面' : '正面') + '.png');
      toast('已保存到相册或下载目录');
    }).catch(function () {
      toast('生成失败，请重试');
    });
  }

  $('doExport').addEventListener('click', function () {
    exportOne(state.side);
  });
  $('doBoth').addEventListener('click', function () {
    exportOne('front').then(function () {
      if (!tpl().back) return;
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(exportOne('back')); }, 700);
      });
    });
  });
  $('doReset').addEventListener('click', function () {
    state.values = {};
    state.edited = {};
    state.photo = '';
    state.logo = '';
    state.accent = ACCENTS[0];
    state.qrMode = 'vcard';
    state.qrText = '';
    seed();
    renderStage();
    renderStyle();
    renderFields();
    closeSheet('sheetExport');
    toast('已清空，回到示例内容');
  });

  /* ---------------- toast / 节流 ---------------- */
  var toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2000);
  }

  var pending = 0;
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () {
      pending = 0;
      renderStage();
    }, 90);
  }

  /* ---------------- 启动 ---------------- */
  document.addEventListener('click', function (e) {
    var target = e.target;
    while (target && target !== document.body) {
      if (target.classList && (target.classList.contains('chip-btn') || target.classList.contains('dock-btn'))) {
        var active = document.querySelector('.dock-btn.active');
        if (active) active.classList.remove('active');
        if (target.classList.contains('dock-btn') && target.id !== 'btnExport') target.classList.add('active');
        break;
      }
      target = target.parentNode;
    }
  });

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () {
    setTimeout(fit, 260);
  });

  seed();
  renderStage();
  renderStyle();
  renderFields();
  window.requestAnimationFrame(fit);

  // 供后续扩展/调试使用
  window.CardStudio = {
    state: state,
    render: renderStage,
    export: exportOne
  };
})();
