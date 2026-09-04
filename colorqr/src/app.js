'use strict';
/**
 * 彩码 — 二维码生成与美化
 * 依赖 window.qrcode（qrcode-generator MIT）
 */
(function () {
  var P = window.PLATFORM || {};
  var PREFIX = P.storagePrefix || 'colorqr_';
  var $ = function (id) { return document.getElementById(id); };

  if (window.qrcode && qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }

  var state = {
    type: 'url',
    shape: 'square',          // square | dot | round
    finder: 'square',         // square | round | dot
    fg: '#111827',
    bg: '#ffffff',
    veil: 0.78,               // 背景图白色罩强度 0~1
    logo: null,               // HTMLImageElement
    bgImg: null,              // HTMLImageElement
    bgImageMode: false
  };
  var LOGO_MAX = 0.24;
  var MARGIN = 4;

  var FG_PRESETS = ['#111827', '#1d4ed8', '#0e7490', '#15803d', '#7c3aed', '#c2410c', '#be123c', '#4c1d95'];
  var BG_PRESETS = ['#ffffff', '#fef9c3', '#dcfce7', '#dbeafe', '#ede9fe', '#fff1f2', '#f1f5f9'];

  // ---------------- payload ----------------
  function vEsc(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;')
      .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  function vEscFull(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  function buildUrlPayload() {
    var v = ($('in-url').value || '').trim();
    if (!v) return null;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) v = 'https://' + v;
    return v;
  }
  function buildTextPayload() {
    var v = $('in-text').value;
    return v ? v : null;
  }
  function buildWifiPayload() {
    var ssid = ($('in-ssid').value || '').trim();
    if (!ssid) return null;
    var pass = $('in-pass').value;
    var sec = $('in-sec').value;
    var hidden = $('in-hidden').checked;
    var p = 'WIFI:T:' + sec + ';S:' + vEsc(ssid) + ';';
    if (sec !== 'nopass') {
      if (!pass) return { error: '请填写密码，或把加密方式改为「无密码」' };
      p += 'P:' + vEsc(pass) + ';';
    }
    if (hidden) p += 'H:true;';
    p += ';';
    return p;
  }
  function buildCardPayload() {
    var name = ($('in-cname').value || '').trim();
    if (!name) return null;
    var tel = ($('in-ctel').value || '').trim();
    var org = ($('in-corg').value || '').trim();
    var title = ($('in-ctitle').value || '').trim();
    var email = ($('in-cemail').value || '').trim();
    var note = ($('in-cnote').value || '').trim();
    var isUrl = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(note);
    var fmt = $('in-cardfmt').value;

    if (fmt === 'mecard') {
      var m = 'MECARD:N:' + vEsc(name) + ';';
      if (org) m += 'ORG:' + vEsc(org) + ';';
      if (title) m += 'TITLE:' + vEsc(title) + ';';
      if (tel) m += 'TEL:' + vEsc(tel) + ';';
      if (email) m += 'EMAIL:' + vEsc(email) + ';';
      if (note) m += (isUrl ? 'URL:' : 'NOTE:') + vEsc(note) + ';';
      return m + ';';
    }
    var lines = ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + vEscFull(name) + ';;;;', 'FN:' + vEscFull(name)];
    if (org) lines.push('ORG:' + vEscFull(org));
    if (title) lines.push('TITLE:' + vEscFull(title));
    if (tel) lines.push('TEL;TYPE=CELL:' + vEscFull(tel));
    if (email) lines.push('EMAIL:' + vEscFull(email));
    if (note) lines.push((isUrl ? 'URL:' : 'NOTE:') + vEscFull(note));
    lines.push('END:VCARD');
    return lines.join('\n');
  }

  function getPayload() {
    switch (state.type) {
      case 'url': return buildUrlPayload();
      case 'text': return buildTextPayload();
      case 'wifi': return buildWifiPayload();
      case 'card': return buildCardPayload();
    }
    return null;
  }

  // ---------------- qr ----------------
  function makeQR(payload, ec) {
    var qr = qrcode(0, ec);
    qr.addData(payload);
    qr.make();
    return qr;
  }
  function currentEC() {
    return state.logo ? 'H' : 'M';   // 有 logo 自动最高容错，其余统一 M，不暴露给用户
  }

  // ---------------- drawing ----------------
  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function isInFinder(n, r, c) {
    if (r < 8 && c < 8) return true;
    if (r < 8 && c >= n - 8) return true;
    if (r >= n - 8 && c < 8) return true;
    return false;
  }
  function drawModule(ctx, x, y, cell, style) {
    if (style === 'dot') {
      ctx.beginPath();
      ctx.arc(x + cell / 2, y + cell / 2, cell * 0.46, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === 'round') {
      roundRectPath(ctx, x, y, cell, cell, cell * 0.36);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, cell, cell);
    }
  }
  function coverDraw(ctx, img, w, h) {
    var ir = img.width / img.height;
    var cr = w / h;
    var sw, sh, sx, sy;
    if (ir > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  }

  /**
   * 画一张码。返回渲染像素边长。
   * opts: canvas cell shape finder fg bg bgImg veil logo
   */
  function renderCode(qr, opts) {
    var cell = opts.cell;
    var shape = opts.shape;
    var finder = opts.finder;
    var fg = opts.fg;
    var bg = opts.bg;
    var bgImg = opts.bgImg;
    var veil = opts.veil;
    var withLogo = !!(opts.logo && opts.logo.complete);

    var n = qr.getModuleCount();
    var total = n + MARGIN * 2;
    var px = total * cell;
    var cv = opts.canvas;
    cv.width = px;
    cv.height = px;
    var ctx = cv.getContext('2d');

    if (bgImg && bgImg.complete) {
      coverDraw(ctx, bgImg, px, px);
      ctx.fillStyle = 'rgba(255,255,255,' + veil + ')';
      ctx.fillRect(0, 0, px, px);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, px, px);
    }

    ctx.fillStyle = fg;
    var x0 = MARGIN * cell;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        var x = x0 + c * cell;
        var y = x0 + r * cell;
        if (isInFinder(n, r, c)) drawModule(ctx, x, y, cell, finder);
        else drawModule(ctx, x, y, cell, shape);
      }
    }

    if (withLogo) {
      var center = px / 2;
      var k = Math.round(n * LOGO_MAX);
      var pad = cell * 1.6;
      var logoSize = k * cell;
      var totalSize = logoSize + pad * 2;
      var left = center - totalSize / 2;
      ctx.fillStyle = bgImg && bgImg.complete ? '#ffffff' : bg;
      roundRectPath(ctx, left, left, totalSize, totalSize, cell * 1.4);
      ctx.fill();
      ctx.save();
      roundRectPath(ctx, left + pad, left + pad, logoSize, logoSize, cell * 0.6);
      ctx.clip();
      ctx.drawImage(opts.logo, left + pad, left + pad, logoSize, logoSize);
      ctx.restore();
    }
    return px;
  }

  // ---------------- preview loop ----------------
  var renderTimer = null;
  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(doRender, 40);
  }

  function clearCanvas() {
    $('stage').classList.add('empty');
    var cv = $('cv');
    cv.width = 1; cv.height = 1;
    cv.getContext('2d').clearRect(0, 0, 1, 1);
  }

  function showHint(msg) {
    $('hint').textContent = msg || '';
  }

  function doRender() {
    renderTimer = null;
    var payload = getPayload();
    if (!payload) {
      if (typeof payload === 'object') showHint(payload.error);
      else showHint('');
      clearCanvas();
      return;
    }
    var qr;
    try { qr = makeQR(payload, currentEC()); }
    catch (e) {
      showHint('内容过长放不下了，请精简');
      clearCanvas();
      return;
    }
    var n = qr.getModuleCount();
    var cv = $('cv');
    $('stage').classList.remove('empty');
    var hostW = $('stage').clientWidth || 280;
    var dpr = window.devicePixelRatio || 1;
    var cell = Math.max(8, Math.round((hostW * dpr) / (n + MARGIN * 2)));
    renderCode(qr, {
      canvas: cv, cell: cell,
      shape: state.shape, finder: state.finder,
      fg: state.fg, bg: state.bg,
      bgImg: state.bgImg, veil: state.veil, logo: state.logo
    });
    showHint(makeHint(n, payload.length));
  }

  function makeHint(n, len) {
    var t = n + MARGIN * 2;
    var size = t <= 33 ? '小巧' : t <= 49 ? '适中' : '偏大';
    var s = '码型' + size + ' · ' + len + ' 字符';
    if (state.logo) s += ' · 已加强容错';
    if (state.bgImg) s += ' · 已开背景图';
    return s;
  }

  // ---------------- tabs（带滑动条） ----------------
  function moveSlider(tab) {
    var tabs = $('tabs');
    var slider = $('tab-slider');
    var tb = tabs.getBoundingClientRect();
    var eb = tab.getBoundingClientRect();
    slider.style.width = eb.width + 'px';
    slider.style.transform = 'translateX(' + (eb.left - tb.left) + 'px)';
  }

  function switchTab(type) {
    state.type = type;
    var tabs = document.querySelectorAll('#tabs .tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].className = 'tab' + (tabs[i].getAttribute('data-type') === type ? ' on' : '');
    }
    var panels = document.querySelectorAll('.panels .panel[data-panel]');
    for (var j = 0; j < panels.length; j++) {
      panels[j].className = 'panel' + (panels[j].getAttribute('data-panel') === type ? ' on' : '');
    }
    persist();
    scheduleRender();
  }

  function bindChips(id, attr, key, after) {
    var chips = document.querySelectorAll('#' + id + ' .chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', function () {
        var val = this.getAttribute(attr);
        state[key] = val;
        for (var j = 0; j < chips.length; j++) {
          chips[j].className = 'chip' + (chips[j].getAttribute(attr) === val ? ' on' : '');
        }
        persist();
        if (after) after();
        scheduleRender();
      });
    }
  }

  // ---------------- 配色面板 ----------------
  function updateColorEntry() {
    $('dot-fg').style.background = state.fg;
    $('dot-bg').style.background = state.bg;
    $('ce-sub').textContent = state.bgImageMode ? '码点颜色 · 图片背景' : '码点颜色 · 背景';
  }

  function buildDots(kind) {
    var list = kind === 'fg' ? FG_PRESETS : BG_PRESETS;
    var cur = kind === 'fg' ? state.fg : state.bg;
    var box = $(kind === 'fg' ? 'dots-fg' : 'dots-bg');
    box.innerHTML = '';
    for (var i = 0; i < list.length; i++) {
      (function (col) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sw' + (String(cur).toLowerCase() === col.toLowerCase() ? ' on' : '');
        b.style.background = col;
        b.setAttribute('aria-label', '颜色 ' + col);
        b.addEventListener('click', function () {
          if (kind === 'fg') {
            state.fg = col;
            $('sheet-fg').value = col;
          } else {
            state.bg = col;
            if (state.bgImageMode) {
              state.bgImageMode = false;
              setBgSubmode(false);
            }
            $('sheet-bg').value = col;
          }
          buildDots(kind);
          updateColorEntry();
          persist();
          scheduleRender();
        });
        box.appendChild(b);
      })(list[i]);
    }
  }

  function setBgSubmode(image) {
    state.bgImageMode = image;
    var segs = document.querySelectorAll('#bgmode-seg .seg-btn');
    for (var i = 0; i < segs.length; i++) {
      var im = segs[i].getAttribute('data-bgmode') === 'image';
      segs[i].className = 'seg-btn' + (im === image ? ' on' : '');
    }
    $('sheet-bg').hidden = image;
    $('dots-bg').hidden = image;
    $('bg-wrap').hidden = !image;
    if (image) {
      $('veil').value = Math.round(state.veil * 100);
      $('veil-val').textContent = Math.round(state.veil * 100) + '%';
      updateBgPreview();
    }
    updateColorEntry();
  }

  function updateBgPreview() {
    var has = !!(state.bgImg && state.bgImg.complete);
    var box = $('bg-thumbbox');
    box.className = 'bg-thumbbox' + (has ? ' has' : '');
    $('bg-thumb').src = has ? state.bgImg.src : '';
    $('bg-veil').style.opacity = has ? state.veil : 0;
    $('bg-empty').style.display = has ? 'none' : '';
    $('btn-bgimg-clear').hidden = !has;
    $('btn-bgimg').textContent = has ? '更换' : '选择图片';
  }

  function setSheetOpen(open) {
    document.body.classList.toggle('sheet-open', open);
  }

  function openColors() {
    $('sheet-fg').value = state.fg;
    $('sheet-bg').value = state.bg;
    setBgSubmode(state.bgImageMode);
    buildDots('fg');
    buildDots('bg');
    $('color-mask').className = 'mask on';
    setSheetOpen(true);
  }

  function closeColors() {
    $('color-mask').className = 'mask';
    setSheetOpen(false);
  }

  function initColorSheet() {
    $('btn-colors').addEventListener('click', openColors);

    $('sheet-fg').addEventListener('input', function () {
      state.fg = this.value;
      buildDots('fg');
      updateColorEntry();
      persist();
      scheduleRender();
    });
    $('sheet-bg').addEventListener('input', function () {
      state.bg = this.value;
      buildDots('bg');
      updateColorEntry();
      persist();
      scheduleRender();
    });

    var segs = document.querySelectorAll('#bgmode-seg .seg-btn');
    for (var i = 0; i < segs.length; i++) {
      segs[i].addEventListener('click', function () {
        setBgSubmode(this.getAttribute('data-bgmode') === 'image');
      });
    }

    $('color-cancel').addEventListener('click', closeColors);
    $('color-backdrop').addEventListener('click', closeColors);
    $('color-mask').addEventListener('click', function (e) {
      if (e.target === this) closeColors();
    });

    // 背景图：点击小方块或按钮均可选择
    function pickBg() { $('in-bgimg').click(); }
    $('bg-thumbbox').addEventListener('click', pickBg);
    $('btn-bgimg').addEventListener('click', pickBg);
    $('in-bgimg').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file || !/^image\//.test(file.type)) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          state.bgImg = img;
          updateBgPreview();
          persist();
          scheduleRender();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
    $('btn-bgimg-clear').addEventListener('click', function () {
      state.bgImg = null;
      $('in-bgimg').value = '';
      updateBgPreview();
      scheduleRender();
    });
    $('veil').addEventListener('input', function () {
      state.veil = Number(this.value) / 100;
      $('veil-val').textContent = this.value + '%';
      if (state.bgImg) $('bg-veil').style.opacity = state.veil;  // 缩略图同步浅色罩
      scheduleRender();
    });
  }

  // ---------------- logo ----------------
  function updateLogoUI() {
    var has = !!state.logo;
    $('logo-thumb').hidden = !has;
    $('logo-thumb-img').src = has ? state.logo.src : '';
    $('btn-logo-clear').hidden = !has;
    $('btn-logo').style.display = has ? 'none' : '';
  }

  function initLogo() {
    $('btn-logo').addEventListener('click', function () { $('in-logo').click(); });
    $('in-logo').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file || !/^image\//.test(file.type)) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          state.logo = img;
          updateLogoUI();
          persist();
          scheduleRender();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
    $('btn-logo-clear').addEventListener('click', function () {
      state.logo = null;
      $('in-logo').value = '';
      updateLogoUI();
      scheduleRender();
    });
  }

  // ---------------- persist ----------------
  function persist() {
    try {
      localStorage.setItem(PREFIX + 'pref', JSON.stringify({
        type: state.type, shape: state.shape, finder: state.finder,
        fg: state.fg, bg: state.bg, veil: Math.round(state.veil * 100) / 100
      }));
    } catch (e) { /* ignore */ }
  }
  function loadPref() {
    try {
      var raw = localStorage.getItem(PREFIX + 'pref');
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d.type) state.type = d.type;
      if (d.shape) state.shape = d.shape;
      if (d.finder) state.finder = d.finder;
      if (d.fg) state.fg = d.fg;
      if (d.bg) state.bg = d.bg;
      if (typeof d.veil === 'number') state.veil = d.veil;
    } catch (e) { /* ignore */ }
  }

  // ---------------- export ----------------
  function typeLabel() {
    switch (state.type) {
      case 'url': return '链接';
      case 'text': return '文字';
      case 'wifi': return 'WiFi';
      case 'card': return '名片';
    }
    return '';
  }

  function captionText() {
    var t = typeLabel();
    var text = '';
    switch (state.type) {
      case 'url': text = ($('in-url').value || '').trim(); break;
      case 'text': text = ($('in-text').value || '').replace(/\s+/g, ' '); break;
      case 'wifi':
        text = '名称：' + ($('in-ssid').value || '').trim();
        if ($('in-sec').value !== 'nopass' && $('in-pass').value) text += ' · 有密码';
        break;
      case 'card':
        text = ($('in-cname').value || '').trim();
        var org = ($('in-corg').value || '').trim();
        if (org) text += ' · ' + org;
        break;
    }
    return { type: t, text: text };
  }

  function fitText(ctx, s, maxW) {
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  function exportPNG() {
    var payload = getPayload();
    if (!payload || typeof payload === 'object') {
      toast(payload && payload.error ? payload.error : '请先填写内容');
      return;
    }
    var qr;
    try { qr = makeQR(payload, currentEC()); }
    catch (e) { toast('内容过长放不下了'); return; }

    var cv = document.createElement('canvas');
    var px = renderCode(qr, {
      canvas: cv, cell: 20,
      shape: state.shape, finder: state.finder,
      fg: state.fg, bg: state.bg,
      bgImg: state.bgImg, veil: state.veil, logo: state.logo
    });

    // 底部标题栏
    var cap = Math.max(64, Math.round(px * 0.1));
    var out = document.createElement('canvas');
    out.width = px;
    out.height = px + cap;
    var octx = out.getContext('2d');
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, px, px + cap);
    octx.drawImage(cv, 0, 0);

    var c = captionText();
    var padL = Math.round(px * 0.06);
    var maxW = px - padL * 2;
    var fs = Math.round(cap * 0.34);
    octx.font = '600 ' + fs + 'px -apple-system, "PingFang SC", sans-serif';
    octx.textBaseline = 'middle';
    var prefix = c.type ? c.type + '　' : '';
    var body = fitText(octx, (c.text || '').replace(/[\r\n]/g, ' '), maxW - octx.measureText(prefix).width);
    var y = px + cap / 2;
    octx.fillStyle = '#7c5cff';
    octx.fillText(prefix, padL, y);
    octx.fillStyle = '#1b1e28';
    octx.fillText(body, padL + octx.measureText(prefix).width, y);

    var url = out.toDataURL('image/png');
    var img = $('save-img');
    img.src = url;
    $('btn-download').href = url;
    $('btn-download').download = '彩码-' + (c.type || 'QR') + '-' + Date.now() + '.png';
    $('save-mask').className = 'mask on';
    setSheetOpen(true);
  }

  function closeSave() {
    $('save-mask').className = 'mask';
    setSheetOpen(false);
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast on';
    setTimeout(function () { t.className = 'toast'; }, 2200);
  }

  // ---------------- init ----------------
  function applyInitChips() {
    function apply(id, attr, val) {
      var cs = document.querySelectorAll('#' + id + ' .chip');
      for (var i = 0; i < cs.length; i++) {
        cs[i].className = 'chip' + (cs[i].getAttribute(attr) === val ? ' on' : '');
      }
    }
    apply('shape-chips', 'data-shape', state.shape);
    apply('finder-chips', 'data-finder', state.finder);
  }

  function init() {
    loadPref();

    // tabs
    var tabs = document.querySelectorAll('#tabs .tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        switchTab(this.getAttribute('data-type'));
        moveSlider(this);
      });
    }
    var activeTab = null;
    for (var j = 0; j < tabs.length; j++) {
      if (tabs[j].getAttribute('data-type') === state.type) activeTab = tabs[j];
      tabs[j].className = 'tab' + (tabs[j].getAttribute('data-type') === state.type ? ' on' : '');
    }
    var panels = document.querySelectorAll('.panels .panel[data-panel]');
    for (var k = 0; k < panels.length; k++) {
      panels[k].className = 'panel' + (panels[k].getAttribute('data-panel') === state.type ? ' on' : '');
    }

    // 输入
    var inputs = document.querySelectorAll('.panels input, .panels textarea, .panels select');
    for (var m = 0; m < inputs.length; m++) {
      inputs[m].addEventListener('input', scheduleRender);
      inputs[m].addEventListener('change', scheduleRender);
    }
    $('in-text').addEventListener('input', function () {
      $('text-count').textContent = this.value.length + ' / 2000';
    });
    $('text-count').textContent = $('in-text').value.length + ' / 2000';

    bindChips('shape-chips', 'data-shape', 'shape');
    bindChips('finder-chips', 'data-finder', 'finder');
    applyInitChips();

    initColorSheet();
    initLogo();
    updateColorEntry();

    $('btn-save').addEventListener('click', exportPNG);
    $('btn-close').addEventListener('click', closeSave);
    $('save-backdrop').addEventListener('click', closeSave);
    $('save-mask').addEventListener('click', function (e) {
      if (e.target === this) closeSave();
    });

    // 首次渲染 + 滑动条定位
    scheduleRender();
    setTimeout(function () {
      var t2 = null;
      for (var q = 0; q < tabs.length; q++) {
        if (tabs[q].getAttribute('data-type') === state.type) t2 = tabs[q];
      }
      if (t2) moveSlider(t2);
    }, 30);
    // 尺寸变化（旋转/字体）时重绘，避免模糊
    var rz = null;
    window.addEventListener('resize', function () {
      if (rz) clearTimeout(rz);
      rz = setTimeout(function () {
        var cur = null;
        var ts = document.querySelectorAll('#tabs .tab');
        for (var w = 0; w < ts.length; w++) {
          if (ts[w].getAttribute('data-type') === state.type) cur = ts[w];
        }
        if (cur) moveSlider(cur);
        scheduleRender();
      }, 120);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
