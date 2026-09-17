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
    mode: 'classic',          // classic | bloom
    flower: 'peony',
    palette: 'original',
    shape: 'square',          // square | dot | round
    finder: 'square',         // square | round | dot
    fg: '#111827',
    bg: '#ffffff',
    veil: 0.78,               // 背景图白色罩强度 0~1
    logo: null,               // HTMLImageElement
    bgImg: null,              // HTMLImageElement
    bgImageMode: false,
    titles: { url: '', text: '', wifi: '', card: '' }
  };
  var bloomEng = null;
  var LOGO_MAX = 0.24;
  var MARGIN = 4;

  // 数量控制在单行放得下（含自定义取色按钮），不再换行
  var FG_PRESETS = ['#111827', '#1d4ed8', '#15803d', '#c2410c', '#7c3aed', '#be123c'];
  var BG_PRESETS = ['#ffffff', '#fef9c3', '#dcfce7', '#dbeafe', '#ede9fe', '#fff1f2'];

  // ---------------- 颜色换算 ----------------
  function clamp255(n) { return Math.max(0, Math.min(255, Math.round(n))); }
  function rgb2hex(r, g, b) {
    return '#' + [r, g, b].map(function (x) {
      var s = clamp255(x).toString(16);
      return s.length < 2 ? '0' + s : s;
    }).join('');
  }
  function hex2rgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim());
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
  }
  function hsv2hex(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return rgb2hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  function hex2hsv(hex) {
    var c = hex2rgb(hex);
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: h, s: max === 0 ? 0 : d / max, v: max };
  }
  function normHex(v) {
    var s = String(v || '').trim();
    if (s && s.charAt(0) !== '#') s = '#' + s;
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
  }

  /** 沿一条水平轨道拖动，回调收到 0~1 的位置 */
  function dragTrack(el, onMove) {
    var W = function () { return el.getBoundingClientRect(); };
    var pos = function (clientX) {
      var r = W();
      return r.width ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0;
    };
    el.addEventListener('pointerdown', function (e) {
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      onMove(pos(e.clientX));
      var mv = function (ev) { onMove(pos(ev.clientX)); };
      var up = function () {
        el.removeEventListener('pointermove', mv);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', mv);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      e.preventDefault();
    });
  }

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

  /** 等比缩放并居中绘制（contain），不拉伸原图 */
  function containDraw(ctx, img, x, y, w, h) {
    var ir = img.width / img.height;
    var dw, dh;
    if (ir > w / h) { dw = w; dh = w / ir; }
    else { dh = h; dw = h * ir; }
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
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
      containDraw(ctx, opts.logo, left + pad, left + pad, logoSize, logoSize);
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
    if (bloomEng) bloomEng.setQR(null);
    var hint = $('bloom-hint');
    if (hint) hint.hidden = true;
  }

  function ensureBloom() {
    if (bloomEng) return bloomEng;
    if (!window.ColorQRBloom || !window.THREE) {
      toast('当前环境不支持花束 3D');
      return null;
    }
    var host = $('bloom-host');
    bloomEng = window.ColorQRBloom.create();
    var ok = bloomEng.mount(host, $('bloom-hint'));
    if (!ok) {
      bloomEng = null;
      toast('WebGL 不可用，已退回经典模式');
      return null;
    }
    bloomEng.setFlower(state.flower);
    bloomEng.setPalette(state.palette);
    return bloomEng;
  }

  function setStyleMode(mode) {
    if (mode !== 'bloom' && mode !== 'classic') return;
    if (mode === 'bloom') {
      var eng = ensureBloom();
      if (!eng) mode = 'classic';
    }
    state.mode = mode;
    var classic = $('classic-style-opts');
    var bloom = $('bloom-style-opts');
    var host = $('bloom-host');
    var stage = $('stage');
    var hint = $('bloom-hint');
    if (classic) classic.hidden = mode === 'bloom';
    if (bloom) bloom.hidden = mode !== 'bloom';
    if (host) host.hidden = mode !== 'bloom';
    if (stage) {
      if (mode === 'bloom') stage.classList.add('bloom-on');
      else stage.classList.remove('bloom-on');
    }
    if (hint) hint.hidden = mode !== 'bloom';
    if (mode !== 'bloom' && bloomEng) bloomEng.stop();
    var chips = document.querySelectorAll('#mode-chips .chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].className = 'chip' + (chips[i].getAttribute('data-mode') === mode ? ' on' : '');
    }
    persist();
    scheduleRender();
  }

  function showHint(msg) {
    if (msg) console.log('[hint]', msg); // 提示已迁出，预览改用标题
  }

  function doRender() {
    renderTimer = null;
    var payload = getPayload();
    if (!payload) {
      showHint(payload && typeof payload === 'object' ? payload.error : '');
      clearCanvas();
      renderPreviewTitle();
      return;
    }
    if (typeof payload === 'object' && payload.error) {
      showHint(payload.error);
      clearCanvas();
      renderPreviewTitle();
      return;
    }
    var qr;
    try { qr = makeQR(payload, state.mode === 'bloom' ? 'M' : currentEC()); }
    catch (e) {
      showHint('内容过长放不下了，请精简');
      clearCanvas();
      renderPreviewTitle();
      return;
    }
    var n = qr.getModuleCount();
    $('stage').classList.remove('empty');

    if (state.mode === 'bloom') {
      var eng = ensureBloom();
      if (!eng) {
        setStyleMode('classic');
        return;
      }
      eng.setFlower(state.flower);
      eng.setPalette(state.palette);
      eng.setQR(qr);
      eng.resize();
      eng.start();
      renderPreviewTitle();
      return;
    }

    if (bloomEng) bloomEng.stop();
    var cv = $('cv');
    var hostW = $('stage').clientWidth || 280;
    var dpr = window.devicePixelRatio || 1;
    var cell = Math.max(8, Math.round((hostW * dpr) / (n + MARGIN * 2)));
    renderCode(qr, {
      canvas: cv, cell: cell,
      shape: state.shape, finder: state.finder,
      fg: state.fg, bg: state.bg,
      bgImg: state.bgImg, veil: state.veil, logo: state.logo
    });
    renderPreviewTitle();
  }

  function makeHint(n, len) {
    // 旧版预览底部"码型偏大 · 116 字符"类提示，已被标题预览替换（#qr-title），保留以防外部脚本残留引用
    var t = n + MARGIN * 2;
    var size = t <= 33 ? '小巧' : t <= 49 ? '适中' : '偏大';
    var s = '码型' + size + ' · ' + len + ' 字符';
    if (state.logo) s += ' · 已加强容错';
    if (state.bgImg) s += ' · 已开背景图';
    return s;
  }
  function renderPreviewTitle() {
    var el = $('qr-title');
    if (!el) return;
    // 用「内容字段是否非空」做显示条件，比 QR payload 宽松 —
    // 用户刚开始填、WiFi 没填密码、卡片只填了姓名等情况也能看到标题预览
    var hasContent = false;
    switch (state.type) {
      case 'url':  hasContent = !!($('in-url').value || '').trim(); break;
      case 'text': hasContent = !!($('in-text').value || '').trim(); break;
      case 'wifi': hasContent = !!($('in-ssid').value || '').trim(); break;
      case 'card': hasContent = !!($('in-cname').value || '').trim(); break;
    }
    var custom = (state.titles && state.titles[state.type] ? state.titles[state.type] : '').trim();
    if (!hasContent && !custom) { el.hidden = true; return; }
    var c = captionText();
    el.querySelector('.qt-type').textContent = c.type || '';
    el.querySelector('.qt-text').textContent = c.text || '';
    el.hidden = !(c.type || c.text);
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
    renderPreviewTitle();
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
          } else {
            state.bg = col;
            if (state.bgImageMode) {
              state.bgImageMode = false;
              setBgSubmode(false);
            }
          }
          buildDots(kind);
          updateColorEntry();
          persist();
          scheduleRender();
        });
        box.appendChild(b);
      })(list[i]);
    }
    // 当前颜色若不在预选里（自定义色），则高亮自定义取色按钮
    var c = String(cur).toLowerCase();
    var isCustom = true;
    for (var j = 0; j < list.length; j++) {
      if (list[j].toLowerCase() === c) { isCustom = false; break; }
    }
    var customBtn = $(kind === 'fg' ? 'sheet-fg' : 'sheet-bg');
    if (customBtn) customBtn.className = 'sw-btn' + (isCustom ? ' on' : '');
  }

  var swapTimers = {};
  /**
   * 展开/收起容器并带高度过渡。
   * animate=false 用于打开面板时直接落到初始状态，不放动画。
   */
  function swapHeight(el, show, animate) {
    if (!el) return;
    if (swapTimers[el.id]) { clearTimeout(swapTimers[el.id]); delete swapTimers[el.id]; }
    if (!animate) {
      el.hidden = !show;
      el.style.maxHeight = '';
      el.style.opacity = '';
      return;
    }
    if (show) {
      var wasHidden = el.hidden;
      el.hidden = false;
      var target = el.scrollHeight;
      if (wasHidden) {
        el.style.maxHeight = '0px';
        el.style.opacity = '0';
        void el.offsetHeight;
      }
      el.style.maxHeight = target + 'px';
      el.style.opacity = '1';
      swapTimers[el.id] = setTimeout(function () {
        el.style.maxHeight = '';
        delete swapTimers[el.id];
      }, 360);
    } else {
      if (el.hidden) return;
      el.style.maxHeight = el.scrollHeight + 'px';
      el.style.opacity = '1';
      void el.offsetHeight;
      el.style.maxHeight = '0px';
      el.style.opacity = '0';
      swapTimers[el.id] = setTimeout(function () {
        el.hidden = true;
        el.style.maxHeight = '';
        el.style.opacity = '';
        delete swapTimers[el.id];
      }, 360);
    }
  }

  function setBgSubmode(image, animate) {
    state.bgImageMode = image;
    var segs = document.querySelectorAll('#bgmode-seg .seg-btn');
    for (var i = 0; i < segs.length; i++) {
      var im = segs[i].getAttribute('data-bgmode') === 'image';
      segs[i].className = 'seg-btn' + (im === image ? ' on' : '');
    }
    swapHeight($('dots-bg-swap'), !image, animate);
    swapHeight($('bg-wrap-swap'), image, animate);
    if (image) {
      setVeilSlider(state.veil);
      updateBgPreview();
    }
    updateColorEntry();
  }

  /** 自绘滑块：写入 0~1 的值并同步视觉（轨道按 40%~95% 归一） */
  var VEIL_MIN = 0.4, VEIL_MAX = 0.95;
  function setVeilSlider(v) {
    v = Math.max(VEIL_MIN, Math.min(VEIL_MAX, v));
    state.veil = v;
    var pos = (v - VEIL_MIN) / (VEIL_MAX - VEIL_MIN) * 100;
    $('veil-fill').style.width = pos + '%';
    $('veil-thumb').style.left = pos + '%';
    $('veil-val').textContent = Math.round(v * 100) + '%';
    $('veil').setAttribute('aria-valuenow', String(Math.round(v * 100)));
    if (state.bgImg) $('bg-veil').style.opacity = v;
  }

  function updateBgPreview() {
    var has = !!(state.bgImg && state.bgImg.complete);
    var box = $('bg-thumbbox');
    box.className = 'add-box' + (has ? ' has' : '');
    $('bg-thumb').src = has ? state.bgImg.src : '';
    $('bg-veil').style.opacity = has ? state.veil : 0;
    $('bg-empty').style.display = has ? 'none' : '';
    $('btn-bgimg-clear').hidden = !has;
  }

  function setSheetOpen(open) {
    document.body.classList.toggle('sheet-open', open);
  }

  function openColors() {
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

  // ---------------- 自定义取色器（替掉 input[type=color]） ----------------
  var picker = { kind: 'fg', h: 210, s: 0.8, v: 0.4, before: null };

  function paintPicker() {
    var col = hsv2hex(picker.h, picker.s, picker.v);
    $('picker-sv').style.background =
      'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(' + picker.h + ',100%,50%))';
    $('picker-ring').style.left = (picker.s * 100) + '%';
    $('picker-ring').style.top = ((1 - picker.v) * 100) + '%';
    $('picker-hue-thumb').style.left = (picker.h / 360 * 100) + '%';
    $('picker-hue-in').style.background = 'hsl(' + picker.h + ',100%,50%)';
    $('picker-swatch').style.background = col;
    if (document.activeElement !== $('picker-hex')) $('picker-hex').value = col.toUpperCase();
    applyPickerColor(col);
  }

  function applyPickerColor(col) {
    if (picker.kind === 'fg') {
      state.fg = col;
    } else {
      state.bg = col;
      if (state.bgImageMode) { state.bgImageMode = false; setBgSubmode(false); }
    }
    buildDots(picker.kind);
    updateColorEntry();
    scheduleRender();
  }

  function openPicker(kind) {
    picker.kind = kind;
    picker.before = kind === 'fg' ? state.fg : state.bg;
    var h = hex2hsv(picker.before);
    picker.h = h.h; picker.s = h.s; picker.v = h.v;
    $('picker-title').textContent = kind === 'fg' ? '码点颜色' : '背景颜色';
    $('picker').className = 'picker on';
    $('picker').setAttribute('aria-hidden', 'false');
    paintPicker();
  }

  function closePicker(restore) {
    if (restore && picker.before !== null) {
      if (picker.kind === 'fg') state.fg = picker.before;
      else state.bg = picker.before;
      buildDots(picker.kind);
      updateColorEntry();
      persist();
      scheduleRender();
    }
    picker.before = null;
    $('picker').className = 'picker';
    $('picker').setAttribute('aria-hidden', 'true');
  }

  function initPicker() {
    // SV 面板拖动
    var sv = $('picker-sv');
    var dragging = false;
    var svUpd = function (e) {
      var r = sv.getBoundingClientRect();
      picker.s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      picker.v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
      paintPicker();
    };
    sv.addEventListener('pointerdown', function (e) {
      dragging = true;
      if (sv.setPointerCapture) { try { sv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      svUpd(e);
      e.preventDefault();
    });
    sv.addEventListener('pointermove', function (e) { if (dragging) svUpd(e); });
    sv.addEventListener('pointerup', function () { dragging = false; });
    sv.addEventListener('pointercancel', function () { dragging = false; });

    // 色相条
    dragTrack($('picker-hue'), function (p) {
      picker.h = Math.round(p * 360) % 360;
      paintPicker();
    });

    // 手输 hex
    $('picker-hex').addEventListener('input', function () {
      var c = normHex(this.value);
      if (!c) return;
      var h = hex2hsv(c);
      picker.h = h.h; picker.s = h.s; picker.v = h.v;
      paintPicker();
    });

    $('picker-ok').addEventListener('click', function () {
      persist();
      closePicker(false);
    });
    $('picker-cancel').addEventListener('click', function () { closePicker(true); });
    $('picker-bd').addEventListener('click', function () { closePicker(true); });
  }

  function initColorSheet() {
    $('btn-colors').addEventListener('click', openColors);

    $('sheet-fg').addEventListener('click', function () { openPicker('fg'); });
    $('sheet-bg').addEventListener('click', function () { openPicker('bg'); });

    var segs = document.querySelectorAll('#bgmode-seg .seg-btn');
    for (var i = 0; i < segs.length; i++) {
      segs[i].addEventListener('click', function () {
        setBgSubmode(this.getAttribute('data-bgmode') === 'image', true);
      });
    }

    $('color-cancel').addEventListener('click', closeColors);
    $('color-backdrop').addEventListener('click', closeColors);
    $('color-mask').addEventListener('click', function (e) {
      if (e.target === this) closeColors();
    });

    // 背景图：点方格本身即可选择
    function pickBg() { $('in-bgimg').click(); }
    $('bg-thumbbox').addEventListener('click', pickBg);
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
    $('btn-bgimg-clear').addEventListener('click', function (e) {
      e.stopPropagation();
      state.bgImg = null;
      $('in-bgimg').value = '';
      updateBgPreview();
      scheduleRender();
    });
    // 浅色罩：自绘滑块
    var veil = $('veil');
    dragTrack(veil, function (p) {
      setVeilSlider(Math.round((VEIL_MIN + p * (VEIL_MAX - VEIL_MIN)) * 100) / 100);
      scheduleRender();
    });
    veil.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0.05 : 0.01, d = 0;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -step;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = step;
      else return;
      setVeilSlider(state.veil + d);
      scheduleRender();
      e.preventDefault();
    });
  }

  // ---------------- logo ----------------
  function updateLogoUI() {
    var has = !!state.logo;
    $('logo-thumb').hidden = !has;
    $('logo-thumb-img').src = has ? state.logo.src : '';
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
        type: state.type, mode: state.mode, flower: state.flower, palette: state.palette,
        shape: state.shape, finder: state.finder,
        fg: state.fg, bg: state.bg, veil: Math.round(state.veil * 100) / 100,
        titles: state.titles
      }));
    } catch (e) { /* ignore */ }
  }
  function loadPref() {
    try {
      var raw = localStorage.getItem(PREFIX + 'pref');
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d.type) state.type = d.type;
      if (d.mode === 'classic' || d.mode === 'bloom') state.mode = d.mode;
      if (d.flower) state.flower = d.flower === 'lotus' ? 'tulip' : d.flower;
      if (d.palette) state.palette = d.palette;
      if (d.shape) state.shape = d.shape;
      if (d.finder) state.finder = d.finder;
      if (d.fg) state.fg = d.fg;
      if (d.bg) state.bg = d.bg;
      if (typeof d.veil === 'number') state.veil = d.veil;
      if (d.titles && typeof d.titles === 'object') {
        for (var k in state.titles) {
          if (typeof d.titles[k] === 'string') state.titles[k] = d.titles[k];
        }
      }
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
        text = ($('in-ssid').value || '').trim();
        break;
      case 'card':
        text = ($('in-cname').value || '').trim();
        var org = ($('in-corg').value || '').trim();
        if (org) text += ' · ' + org;
        break;
    }
    var custom = (state.titles && state.titles[state.type] ? state.titles[state.type] : '').trim();
    return { type: t, text: custom || text };
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
    try { qr = makeQR(payload, state.mode === 'bloom' ? 'M' : currentEC()); }
    catch (e) { toast('内容过长放不下了'); return; }

    var url;
    var px;
    if (state.mode === 'bloom') {
      var eng = ensureBloom();
      if (!eng) { toast('花束模式不可用'); return; }
      eng.setQR(qr);
      url = eng.captureDataURL(1024);
      if (!url) { toast('导出失败'); return; }
      px = 1024;
    } else {
      var cv = document.createElement('canvas');
      px = renderCode(qr, {
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

      var c0 = captionText();
      var padL = Math.round(px * 0.06);
      var maxW = px - padL * 2;
      var fs = Math.round(cap * 0.34);
      octx.font = '600 ' + fs + 'px -apple-system, "PingFang SC", sans-serif';
      octx.textBaseline = 'middle';
      var prefix = c0.type ? c0.type + '　' : '';
      var body = fitText(octx, (c0.text || '').replace(/[\r\n]/g, ' '), maxW - octx.measureText(prefix).width);
      var y = px + cap / 2;
      octx.fillStyle = '#7c5cff';
      octx.fillText(prefix, padL, y);
      octx.fillStyle = '#1b1e28';
      octx.fillText(body, padL + octx.measureText(prefix).width, y);
      url = out.toDataURL('image/png');
    }

    // 花束导出：白底 + 可选标题条
    if (state.mode === 'bloom') {
      var imgBloom = new Image();
      imgBloom.onload = function () {
        var capB = Math.max(64, Math.round(px * 0.1));
        var outB = document.createElement('canvas');
        outB.width = px;
        outB.height = px + capB;
        var bx = outB.getContext('2d');
        bx.fillStyle = '#f7f5f2';
        bx.fillRect(0, 0, px, px + capB);
        bx.drawImage(imgBloom, 0, 0, px, px);
        var c1 = captionText();
        var pad1 = Math.round(px * 0.06);
        var max1 = px - pad1 * 2;
        var fs1 = Math.round(capB * 0.34);
        bx.font = '600 ' + fs1 + 'px -apple-system, "PingFang SC", sans-serif';
        bx.textBaseline = 'middle';
        var pre1 = c1.type ? c1.type + '　' : '';
        var body1 = fitText(bx, (c1.text || '').replace(/[\r\n]/g, ' '), max1 - bx.measureText(pre1).width);
        var y1 = px + capB / 2;
        bx.fillStyle = '#7c5cff';
        bx.fillText(pre1, pad1, y1);
        bx.fillStyle = '#1b1e28';
        bx.fillText(body1, pad1 + bx.measureText(pre1).width, y1);
        finishExport(outB.toDataURL('image/png'), c1);
      };
      imgBloom.src = url;
      return;
    }

    finishExport(url, captionText());
  }

  function finishExport(url, c) {
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
    apply('mode-chips', 'data-mode', state.mode);
    apply('shape-chips', 'data-shape', state.shape);
    apply('finder-chips', 'data-finder', state.finder);
    apply('flower-chips', 'data-flower', state.flower);
    var pals = document.querySelectorAll('#palette-chips .pal-swatch');
    for (var pi = 0; pi < pals.length; pi++) {
      pals[pi].classList.toggle('on', pals[pi].getAttribute('data-palette') === state.palette);
    }
  }

  function closeAllSelects(except) {
    var all = document.querySelectorAll('.select.open');
    for (var i = 0; i < all.length; i++) {
      if (all[i] === except) continue;
      all[i].classList.remove('open');
      var p = all[i].querySelector('.select-pop');
      if (p) p.hidden = true;
    }
  }

  function initSelect(selId, hiddenId) {
    var root = $(selId);
    if (!root) return;
    var trig = root.querySelector('.select-trigger');
    var pop = root.querySelector('.select-pop');
    var hidden = $(hiddenId);
    var opts = pop.querySelectorAll('.select-opt');

    trig.addEventListener('click', function (e) {
      e.stopPropagation();
      if (root.classList.contains('open')) {
        root.classList.remove('open');
        pop.hidden = true;
      } else {
        closeAllSelects(root);
        root.classList.add('open');
        pop.hidden = false;
      }
    });

    for (var i = 0; i < opts.length; i++) {
      opts[i].addEventListener('click', function () {
        var val = this.getAttribute('data-value');
        hidden.value = val;
        trig.querySelector('.select-val').textContent = this.textContent;
        for (var n = 0; n < opts.length; n++) opts[n].classList.toggle('on', opts[n] === this);
        root.classList.remove('open');
        pop.hidden = true;
        scheduleRender();
      });
    }
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
    bindChips('flower-chips', 'data-flower', 'flower', function () {
      if (bloomEng) bloomEng.setFlower(state.flower);
    });
    (function bindPalettes() {
      var chips = document.querySelectorAll('#palette-chips .pal-swatch');
      for (var i = 0; i < chips.length; i++) {
        chips[i].addEventListener('click', function () {
          var val = this.getAttribute('data-palette');
          state.palette = val;
          for (var j = 0; j < chips.length; j++) {
            chips[j].classList.toggle('on', chips[j].getAttribute('data-palette') === val);
          }
          persist();
          if (bloomEng) bloomEng.setPalette(state.palette);
          scheduleRender();
        });
      }
    })();
    var modeChips = document.querySelectorAll('#mode-chips .chip');
    for (var mi = 0; mi < modeChips.length; mi++) {
      modeChips[mi].addEventListener('click', function () {
        setStyleMode(this.getAttribute('data-mode'));
      });
    }
    applyInitChips();
    setStyleMode(state.mode);

    initColorSheet();
    initPicker();
    initLogo();
    initSelect('sel-sec', 'in-sec');
    initSelect('sel-cardfmt', 'in-cardfmt');
    document.addEventListener('click', function (e) {
      var el = e.target;
      while (el && el !== document.body) {
        if (el.classList && el.classList.contains('select')) return;
        el = el.parentNode;
      }
      closeAllSelects(null);
    });
    setVeilSlider(state.veil);
    updateColorEntry();

    // ---- 标题输入 ----
    var titleMap = [
      { type: 'url',  id: 'in-title-url' },
      { type: 'text', id: 'in-title-text' },
      { type: 'wifi', id: 'in-title-wifi' },
      { type: 'card', id: 'in-title-card' }
    ];
    for (var ti = 0; ti < titleMap.length; ti++) {
      (function (m) {
        var inp = $(m.id);
        if (!inp) return;
        inp.value = state.titles[m.type] || '';
        inp.addEventListener('input', function () {
          state.titles[m.type] = inp.value;
          persist();
          renderPreviewTitle();
        });
      })(titleMap[ti]);
    }

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
