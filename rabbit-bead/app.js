(function () {
  'use strict';

  var CELL = 16;
  // 真实豆距约 5mm；按 300DPI 导出，打印「实际大小」时每格≈5mm
  var BEAD_MM = 5;
  var PRINT_DPI = 300;
  var EXPORT_CELL = Math.round(BEAD_MM / 25.4 * PRINT_DPI); // ≈59
  // iOS WKWebView 画布约 4096 边长 / 16M 像素；超出会 toDataURL 失败或 native 英文报错
  var MAX_EXPORT_SIDE = 4096;
  var MAX_EXPORT_AREA = 16777216;

  // 导出图纸恒为白底，格线用固定浅灰（不跟系统外观走，对齐 iOS BeadArtworkRenderer 不读主题）
  var EXPORT_GRID_COLOR = '#c7c7cc';
  var SEAM_COLOR = '#ff3b30';

  // 预览配色固定明亮，不跟系统外观
  function viewBgColor() {
    return '#e5e5ea';
  }

  // 3D 底板（豆插在上面的塑料板）。名字不能叫 plateColor —— render3d 里有个同名局部变量会把它遮住
  function plateBaseColor() {
    return '#FFFFFF';
  }

  function gridLineColor() {
    return '#c7c7cc';
  }

  // 高亮某个色号时其余豆「退到背景里」的目标色
  function dimTargetHex() {
    return '#FFFFFF';
  }

  var EMPTY_CELL = { empty: true, code: '', hex: '', r: 0, g: 0, b: 0 };
  var ALPHA_CUTOFF = 128;
  var OPAQUE_RATIO = 0.4;

  function isEmptyCell(c) {
    return !c || c.empty;
  }

  // 2D 预览视图：内容像素里每格 = PRE_CS；格线叠画在格子上，不占空间
  var PRE_CS = 16;
  var CODE_SHOW_CELL = 30; // 屏幕像素每格 ≥ 该值时在格内绘制色号
  var CODE_SHOW_FONT = 0.36;
  var MAX_ZOOM = 6.5; // 相对内容像素的最大放大倍数（格宽最大约 104px）

  // 展开/收起动画时长，必须与 style.css 的 --dur-soft 保持一致
  var SOFT_MS = 500;

  var state = {
    image: null,
    sourceImage: null, // 未裁切的源图，裁切始终基于它
    cropRect: null,    // 累积裁切区域（相对源图归一化 {x,y,w,h}），null 表示未裁切
    paletteId: 'mard',
    width: 29,
    boardSize: 29,
    maxColors: 60,
    mode: 'dominant',
    dither: false,
    merge: false,
    mergeThreshold: 0.10,
    showGrid: true,
    showSeam: false,
    gridData: null,
    counts: null,
    autoGrid: null,
    gridW: 0,
    editOn: false,
    tool: 'brush',
    brush: null,
    height: 0,
    boardIndex: -1,
    boardsX: 1,
    boardsY: 1,
    highlightCode: null,
    busy: false,
    view: { mode: '2d', s: 1, tx: 0, ty: 0, fitS: 1 },
    view3d: { yaw: 0, pitch: 0.5, zoom: 1, init: false, baseF: 0, hFactor: 1, roundness: 1 },
    exp: { axes: false, codes: true, legend: true, meta: true, boardMode: 'full' }
  };

  var els = {
    screenHome: document.getElementById('screen-home'),
    screenEdit: document.getElementById('screen-edit'),
    screenHand: document.getElementById('screen-hand-edit'),
    screenCrop: document.getElementById('screen-crop'),
    previewShell: document.getElementById('preview-shell'),
    headerTitle: document.getElementById('header-title'),
    headerSub: document.getElementById('header-sub'),
    fileInput: document.getElementById('file-input'),
    viewport: document.getElementById('viewport'),
    canvas: document.getElementById('preview-canvas'),
    widthSlider: document.getElementById('width-slider'),
    widthVal: document.getElementById('width-val'),
    colorSlider: document.getElementById('color-slider'),
    colorVal: document.getElementById('color-val'),
    metaLine: document.getElementById('meta-line'),
    boardLabel: document.getElementById('board-label'),
    boardGroup: document.getElementById('board-group'),
    boardAllSep: document.getElementById('board-all-sep'),
    btnBoardPrev: document.getElementById('btn-board-prev'),
    btnBoardNext: document.getElementById('btn-board-next'),
    btnReselect: document.getElementById('btn-reselect'),
    btnSave: document.getElementById('btn-export') || document.getElementById('btn-save'),
    btnSaveWork: document.getElementById('btn-save'),
    saveTip: document.getElementById('save-tip'),
    saveTipText: document.getElementById('save-tip-text'),
    saveTipList: document.getElementById('save-tip-list'),
    saveTipClose: document.getElementById('save-tip-close'),
    saveTipShare: document.getElementById('save-tip-share'),
    toast: document.getElementById('toast'),
    footerBar: document.getElementById('footer-bar'),
    btnPalette: document.getElementById('btn-palette'),
    btnGrid: document.getElementById('btn-grid'),
    btnSeam: document.getElementById('btn-seam'),
    btnDither: document.getElementById('btn-dither'),
    btnMerge: document.getElementById('btn-merge'),
    btnAvg: document.getElementById('btn-avg'),
    btnColors: document.getElementById('btn-colors'),
    btnCrop: document.getElementById('btn-crop'),
    cropScreen: document.getElementById('screen-crop'),
    cropViewport: document.getElementById('crop-viewport'),
    cropCanvas: document.getElementById('crop-canvas'),
    cropRatioChips: document.getElementById('crop-ratio-chips'),
    cropZoom: document.getElementById('crop-zoom'),
    cropRotate: document.getElementById('crop-rotate'),
    cropFlip: document.getElementById('crop-flip'),
    cropCancel: document.getElementById('crop-cancel'),
    cropConfirm: document.getElementById('crop-confirm'),
    colorsPreview: document.getElementById('colors-preview'),
    colorsList: document.getElementById('colors-list'),
    paletteSheet: document.getElementById('palette-sheet'),
    paletteSheetBackdrop: document.getElementById('palette-sheet-backdrop'),
    paletteSheetCancel: document.getElementById('palette-sheet-cancel'),
    boardSizeSheet: document.getElementById('board-size-sheet'),
    boardSizeSheetBackdrop: document.getElementById('board-size-sheet-backdrop'),
    boardSizeSheetCancel: document.getElementById('board-size-sheet-cancel'),
    btnBoardSize: document.getElementById('btn-board-size'),
    colorsSheet: document.getElementById('colors-sheet'),
    colorsSheetBackdrop: document.getElementById('colors-sheet-backdrop'),
    colorsSheetCancel: document.getElementById('colors-sheet-cancel'),
    btnFit: document.getElementById('btn-fit'),
    btnZoomIn: document.getElementById('btn-zoom-in'),
    btnZoomOut: document.getElementById('btn-zoom-out'),
    btn3d: document.getElementById('btn-3d'),
    btnBoardAll: document.getElementById('btn-board-all'),
    viewHint: document.getElementById('view-hint'),
    exportSheet: document.getElementById('export-sheet'),
    exportSheetBackdrop: document.getElementById('export-sheet-backdrop'),
    exportSheetCancel: document.getElementById('export-sheet-cancel'),
    exportGo: document.getElementById('export-go'),
    exportShare: document.getElementById('export-share'),
    exportScope: document.getElementById('export-scope'),
    exportBusy: document.getElementById('export-busy'),
    exportBusyText: document.getElementById('export-busy-text'),
    expAxes: document.getElementById('exp-axes'),
    expCodes: document.getElementById('exp-codes'),
    expLegend: document.getElementById('exp-legend'),
    expMeta: document.getElementById('exp-meta'),
    expBoardMode: document.getElementById('exp-board-mode'),
    expModeFull: document.getElementById('exp-mode-full'),
    expModeEach: document.getElementById('exp-mode-each'),
    btnEdit: document.getElementById('btn-edit'),
    btnEditDone: document.getElementById('btn-edit-done'),
    btnEditCancel: document.getElementById('btn-edit-cancel'),
    btnMore: document.getElementById('btn-more'),
    btnPanelCollapse: document.getElementById('btn-panel-collapse'),
    panelWrap: document.getElementById('panel-wrap'),
    panel: document.getElementById('panel'),
    etGroup: document.getElementById('et-group'),
    etPaint: document.getElementById('et-paint'),
    etUndo: document.getElementById('et-undo'),
    etRedo: document.getElementById('et-redo'),
    etClear: document.getElementById('et-clear'),
    etFit: document.getElementById('et-fit'),
    etZoomIn: document.getElementById('et-zoom-in'),
    etZoomOut: document.getElementById('et-zoom-out'),
    paintLoupe: document.getElementById('paint-loupe'),
    paintLoupeCanvas: document.getElementById('paint-loupe-canvas'),
    paintLoupeCoord: document.getElementById('paint-loupe-coord'),
    paintLoupeReadout: document.getElementById('paint-loupe-readout'),
    pickSheet: document.getElementById('pick-sheet'),
    pickSheetBackdrop: document.getElementById('pick-sheet-backdrop'),
    pickSheetCancel: document.getElementById('pick-sheet-cancel'),
    pickList: document.getElementById('pick-list')
  };

  // 强制 sRGB：宽色域屏（P3）默认 display-p3 会让 getImageData 偏色，和色卡对不上
  var CTX_OPTS = { colorSpace: 'srgb', willReadFrequently: true };
  var ctx = els.canvas.getContext('2d', { colorSpace: 'srgb' }) || els.canvas.getContext('2d');
  var work = document.createElement('canvas');
  var workCtx = work.getContext('2d', CTX_OPTS) || work.getContext('2d');
  var toastTimer = null;
  var regenTimer = null;
  var freshImage = false; // 新图刚载入时展示一次操作提示
  var undoStack = [];
  var redoStack = [];

  // 提示条是固定定位的，写死的 bottom 一定会压住编辑页底部那一摞东西
  // （手绘工具条 / 参数面板 / 操作栏），而且它们的高度还在变。
  // 弹之前按「展开后的目标位置」让开：不能按当前高度算 —— 工具条刚点开时高度还是 0，
  // 算出来的位置一两百毫秒后就又被盖住了。
  function openTargetH(el) {
    if (!el || !el.classList.contains('is-open')) return 0;
    var v = parseFloat(el.style.maxHeight);
    return isNaN(v) ? 0 : v;
  }

  function toastBottom() {
    var route = currentRoute();
    if (route === 'hand') {
      var acts = document.getElementById('edit-actions');
      if (acts) {
        var ar = acts.getBoundingClientRect();
        if (ar.height > 0.5) return Math.round(window.innerHeight - ar.top + 8);
      }
    }
    if (route === 'crop' && els.cropScreen) {
      var ca = els.cropScreen.querySelector('.crop-actions');
      if (ca) {
        var cr = ca.getBoundingClientRect();
        if (cr.height > 0.5) return Math.round(window.innerHeight - cr.top + 8);
      }
    }
    var f = els.footerBar ? els.footerBar.getBoundingClientRect() : null;
    if (!f || f.height < 0.5) return 0;
    var up = openTargetH(els.panelWrap);
    return Math.round(window.innerHeight - f.top + up + 8);
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove('show');
    }, 1800);
  }

  // 部分小红书容器不触发可靠的 `:active`，用触摸态补上系统按钮反馈。
  function pressButton(target, pressed) {
    var button = target && target.closest ? target.closest('button') : null;
    if (button) button.classList.toggle('is-pressed', pressed);
  }

  document.addEventListener('touchstart', function (e) {
    pressButton(e.target, true);
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    pressButton(e.target, false);
  }, { passive: true });
  document.addEventListener('touchcancel', function (e) {
    pressButton(e.target, false);
  }, { passive: true });

  // ---------- 页面栈：右进右出 ----------
  var NAV_MS = 340;
  var routeStack = ['home'];
  var navBusy = false;
  var ROUTE_EL = {
    home: function () { return els.screenHome; },
    edit: function () { return els.screenEdit; },
    hand: function () { return els.screenHand; },
    crop: function () { return els.screenCrop || els.cropScreen; }
  };
  var ROUTE_TITLE = {
    home: '兔格拼豆',
    edit: '兔格拼豆',
    hand: '编辑',
    crop: '裁切图片'
  };

  function currentRoute() {
    return routeStack[routeStack.length - 1] || 'home';
  }

  function routeEl(name) {
    var fn = ROUTE_EL[name];
    return fn ? fn() : null;
  }

  function syncHeader() {
    // 标题已内嵌在各页面；这里只刷新生成页副标题
    if (!els.headerSub) return;
    if (state.gridData) {
      els.headerSub.textContent = getPalette().name + ' · ' + state.width + ' 豆宽';
    } else {
      els.headerSub.textContent = '照片转拼豆色号图纸';
    }
  }

  function clearScreenFlags(el) {
    if (!el) return;
    el.classList.remove('is-active', 'is-behind', 'is-exit', 'no-anim');
  }

  function showScreen(name, opts) {
    opts = opts || {};
    var replace = !!opts.replace;
    var instant = !!opts.instant;
    var next = name;
    var cur = currentRoute();
    if (next === cur && !replace) {
      syncHeader();
      return;
    }

    var fromEl = routeEl(cur);
    var toEl = routeEl(next);
    if (!toEl) return;

    if (replace) {
      routeStack[routeStack.length - 1] = next;
    } else {
      routeStack.push(next);
    }

    if (instant || !fromEl) {
      Object.keys(ROUTE_EL).forEach(function (k) { clearScreenFlags(routeEl(k)); });
      toEl.classList.add('no-anim', 'is-active');
      void toEl.offsetHeight;
      toEl.classList.remove('no-anim');
      if (next === 'crop' && toEl) toEl.setAttribute('aria-hidden', 'false');
      if (cur === 'crop' && fromEl) fromEl.setAttribute('aria-hidden', 'true');
      syncHeader();
      return;
    }

    if (navBusy) {
      Object.keys(ROUTE_EL).forEach(function (k) { clearScreenFlags(routeEl(k)); });
      toEl.classList.add('is-active');
      syncHeader();
      return;
    }
    navBusy = true;

    clearScreenFlags(toEl);
    toEl.classList.add('no-anim');
    toEl.style.transform = 'translateX(100%)';
    void toEl.offsetHeight;
    toEl.classList.remove('no-anim');

    fromEl.classList.remove('is-active');
    fromEl.classList.add('is-behind');
    toEl.classList.add('is-active');
    toEl.style.transform = '';
    if (next === 'crop') toEl.setAttribute('aria-hidden', 'false');

    syncHeader();
    setTimeout(function () {
      navBusy = false;
    }, NAV_MS + 20);
  }

  function goBack(opts) {
    opts = opts || {};
    if (routeStack.length <= 1) return;
    var instant = !!opts.instant;
    var leaving = routeStack.pop();
    var next = currentRoute();
    var fromEl = routeEl(leaving);
    var toEl = routeEl(next);
    if (!fromEl || !toEl) {
      syncHeader();
      return;
    }

    if (instant) {
      clearScreenFlags(fromEl);
      clearScreenFlags(toEl);
      toEl.classList.add('no-anim', 'is-active');
      void toEl.offsetHeight;
      toEl.classList.remove('no-anim');
      if (leaving === 'crop') fromEl.setAttribute('aria-hidden', 'true');
      syncHeader();
      return;
    }

    if (navBusy) {
      clearScreenFlags(fromEl);
      toEl.classList.add('is-active');
      syncHeader();
      return;
    }
    navBusy = true;

    toEl.classList.add('is-behind');
    toEl.classList.remove('is-active');
    // 强制重绘后：当前页右滑退出，下层变 active
    fromEl.classList.remove('is-behind');
    fromEl.classList.add('is-active', 'is-exit');
    // 下一帧把下层抬成 active，当前继续 exit
    requestAnimationFrame(function () {
      toEl.classList.remove('is-behind');
      toEl.classList.add('is-active');
      fromEl.classList.remove('is-active');
      fromEl.classList.add('is-exit');
    });

    syncHeader();
    setTimeout(function () {
      fromEl.classList.remove('is-exit', 'is-active', 'is-behind');
      if (leaving === 'crop') fromEl.setAttribute('aria-hidden', 'true');
      navBusy = false;
    }, NAV_MS + 20);
  }

  function ensurePreviewPlaceholder() {
    var ph = document.getElementById('preview-placeholder');
    if (!ph) {
      ph = document.createElement('div');
      ph.id = 'preview-placeholder';
      ph.className = 'preview-shell preview-placeholder';
      ph.setAttribute('aria-hidden', 'true');
    }
    var view = ph.querySelector('.preview-placeholder-view');
    if (!view) {
      view = document.createElement('div');
      view.className = 'preview-placeholder-view';
      ph.insertBefore(view, ph.firstChild);
    }
    // 占住 meta / 预览条高度，冻帧才不会比真预览「往下沉」
    if (!ph.querySelector('.preview-placeholder-meta')) {
      var meta = document.createElement('p');
      meta.className = 'meta preview-placeholder-meta';
      meta.innerHTML = '&nbsp;';
      ph.appendChild(meta);
    }
    if (!ph.querySelector('.preview-placeholder-bar')) {
      var bar = document.createElement('div');
      bar.className = 'preview-bar preview-placeholder-bar';
      ph.appendChild(bar);
    }
    return ph;
  }

  // 挪走 canvas 前先拍一帧，避免底层生成页在转场里露出空白
  function fillPreviewPlaceholder(ph) {
    if (!ph || !els.canvas) return;
    var view = ph.querySelector('.preview-placeholder-view');
    if (!view) return;
    var img = view.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.alt = '';
      view.appendChild(img);
    }
    try {
      if (els.canvas.width > 0 && els.canvas.height > 0) {
        img.src = els.canvas.toDataURL('image/png');
      }
    } catch (e) { /* ignore */ }
    var liveMeta = els.metaLine;
    var liveBar = document.getElementById('preview-bar');
    var metaPh = ph.querySelector('.preview-placeholder-meta');
    var barPh = ph.querySelector('.preview-placeholder-bar');
    if (metaPh && liveMeta) {
      metaPh.textContent = liveMeta.textContent || '\u00a0';
      metaPh.style.height = Math.max(1, Math.round(liveMeta.getBoundingClientRect().height)) + 'px';
    }
    if (barPh && liveBar) {
      barPh.style.height = Math.max(1, Math.round(liveBar.getBoundingClientRect().height)) + 'px';
    }
  }

  function mountPreviewOn(host) {
    if (!els.previewShell || !host) return;
    var edit = els.screenEdit;
    var ph = ensurePreviewPlaceholder();

    function pageHeader(el) {
      return el.querySelector(':scope > .header') || el.querySelector('.header');
    }

    // 去手绘页：先在生成页落冻结帧，再挪走真预览（canvas 一挪就可能被清空）
    if (edit && host !== edit) {
      fillPreviewPlaceholder(ph);
      var editHeader = pageHeader(edit);
      if (els.previewShell.parentNode === edit) {
        edit.insertBefore(ph, els.previewShell);
      } else {
        var anchor = editHeader ? editHeader.nextSibling : edit.firstChild;
        if (ph.parentNode !== edit) {
          edit.insertBefore(ph, anchor);
        } else if (editHeader && ph.previousElementSibling !== editHeader) {
          edit.insertBefore(ph, editHeader.nextSibling);
        }
      }
    }

    var header = pageHeader(host);
    if (!header) {
      if (els.previewShell.parentNode !== host) {
        host.insertBefore(els.previewShell, host.firstChild);
      }
    } else {
      var after = header.nextElementSibling;
      if (!(els.previewShell.parentNode === host && after === els.previewShell)) {
        host.insertBefore(els.previewShell, header.nextSibling);
      }
    }

    // 回到生成页：撤掉占位
    if (host === edit && ph.parentNode) {
      ph.parentNode.removeChild(ph);
    }
  }

  function getPalette() {
    var p = window.BEAD_PALETTES[state.paletteId];
    if (!p) p = window.BEAD_PALETTES.mard;
    return p;
  }

  function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  }

  function srgbToLinear(c) {
    c /= 255;
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  }

  function linearToSrgb(c) {
    c = c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;
    return clampByte(Math.round(c * 255));
  }

  // sRGB → Oklab（对齐 perlerbeads.zippland.com 感知距离）
  function rgbToOklab(r, g, b) {
    r = srgbToLinear(r);
    g = srgbToLinear(g);
    b = srgbToLinear(b);
    var l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    var m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    var s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    var l_ = Math.pow(l, 1 / 3);
    var m_ = Math.pow(m, 1 / 3);
    var s_ = Math.pow(s, 1 / 3);
    return {
      L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      A: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      B: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    };
  }

  function oklabDist2(a, b) {
    var dL = a.L - b.L;
    var dA = a.A - b.A;
    var dB = a.B - b.B;
    return dL * dL + dA * dA + dB * dB;
  }

  function buildPaletteCache(palette) {
    var list = [];
    var i;
    for (i = 0; i < palette.colors.length; i++) {
      var c = palette.colors[i];
      var ok = rgbToOklab(c[1], c[2], c[3]);
      list.push({
        code: c[0],
        r: c[1],
        g: c[2],
        b: c[3],
        hex: rgbToHex(c[1], c[2], c[3]),
        L: ok.L,
        A: ok.A,
        B: ok.B
      });
    }
    return list;
  }

  function nearestColor(cache, r, g, b) {
    var ok = rgbToOklab(r, g, b);
    var best = cache[0];
    var bestD = Infinity;
    var i;
    for (i = 0; i < cache.length; i++) {
      var c = cache[i];
      var d = oklabDist2(ok, c);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  function rgbDist2(r1, g1, b1, r2, g2, b2) {
    var dr = r1 - r2;
    var dg = g1 - g2;
    var db = b1 - b2;
    return dr * dr + dg * dg + db * db;
  }

  // 色相分桶：8 个色相段 + 1 个灰阶段，用于限色时保证色相覆盖
  function colorHueBucket(r, g, b) {
    var ok = rgbToOklab(r, g, b);
    var chroma = Math.sqrt(ok.A * ok.A + ok.B * ok.B);
    if (chroma < 0.02) return 8; // 低彩度归灰阶桶
    var hue = Math.atan2(ok.B, ok.A); // -PI..PI
    var bucket = Math.floor((hue + Math.PI) / (Math.PI / 4)); // 0..7
    if (bucket > 7) bucket = 7;
    return bucket;
  }

  function clampByte(v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return v | 0;
  }

  function readSourcePixels(img) {
    var maxSide = 1400;
    var sw = img.naturalWidth;
    var sh = img.naturalHeight;
    var scale = 1;
    var side = Math.max(sw, sh);
    if (side > maxSide) scale = maxSide / side;
    var tw = Math.max(1, Math.round(sw * scale));
    var th = Math.max(1, Math.round(sh * scale));
    work.width = tw;
    work.height = th;
    workCtx.clearRect(0, 0, tw, th);
    // 不平滑缩放，避免边界糊成灰边（对齐 perler-beads）
    workCtx.imageSmoothingEnabled = false;
    workCtx.drawImage(img, 0, 0, tw, th);
    var data;
    try {
      data = workCtx.getImageData(0, 0, tw, th, { colorSpace: 'srgb' });
    } catch (e) {
      data = workCtx.getImageData(0, 0, tw, th);
    }
    // 顺便统计 5bit 桶颜色数，用于自动判断图片类型（卡通/照片）
    // 卡通图颜色数少（描边+大色块），照片颜色数多（渐变+噪声）
    var px = data.data;
    var seen = new Uint8Array(32768);
    var count = 0;
    for (var i = 0; i < px.length; i += 4) {
      if (px[i + 3] < ALPHA_CUTOFF) continue;
      var key = ((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3);
      if (!seen[key]) { seen[key] = 1; count++; }
    }
    data._colorCount = count;
    return data;
  }

  // 格内采样：average 用线性光均值；dominant 用众数，但边缘格（众数占比低）
  // 自动回退均值——既保描边锐利（纯色区众数），又让边缘平滑去杂色（边缘格均值）。
  function regionStats(data, x0, y0, x1, y1, mode) {
    var pixels = data.data;
    var sw = data.width;
    var freq = {};
    var bestKey = null;
    var bestN = 0;
    var rSum = 0;
    var gSum = 0;
    var bSum = 0;
    var n = 0;
    var y;
    var x;
    for (y = y0; y < y1; y++) {
      for (x = x0; x < x1; x++) {
        var o = (y * sw + x) * 4;
        if (pixels[o + 3] < ALPHA_CUTOFF) continue;
        var r = pixels[o];
        var g = pixels[o + 1];
        var b = pixels[o + 2];
        n += 1;
        // 始终累加线性均值，供边缘格回退
        rSum += srgbToLinear(r);
        gSum += srgbToLinear(g);
        bSum += srgbToLinear(b);
        if (mode === 'average') continue;
        var key = (r << 16) | (g << 8) | b;
        var bucket = freq[key];
        if (!bucket) {
          bucket = { n: 0, r: r, g: g, b: b };
          freq[key] = bucket;
        }
        bucket.n += 1;
        if (bucket.n > bestN) {
          bestN = bucket.n;
          bestKey = key;
        }
      }
    }
    var area = Math.max(1, (x1 - x0) * (y1 - y0));
    if (n === 0 || n < area * OPAQUE_RATIO) return EMPTY_CELL;
    var avg = {
      r: linearToSrgb(rSum / n),
      g: linearToSrgb(gSum / n),
      b: linearToSrgb(bSum / n)
    };
    if (mode === 'average') return avg;
    // 自适应 dominant：众数占比 ≥ DOMINANT_RATIO（纯色区）用众数，描边锐利；
    // 占比低（边缘格/JPEG 过渡）用均值，边缘平滑去杂色。
    var DOMINANT_RATIO = 0.55;
    // 精确色过于分散（JPEG）→ 5bit 桶主导色
    if (bestN < 2 || (n > 40 && bestN * 12 < n)) {
      freq = {};
      bestKey = null;
      bestN = 0;
      for (y = y0; y < y1; y++) {
        for (x = x0; x < x1; x++) {
          var o2 = (y * sw + x) * 4;
          if (pixels[o2 + 3] < ALPHA_CUTOFF) continue;
          var r2 = pixels[o2];
          var g2 = pixels[o2 + 1];
          var b2 = pixels[o2 + 2];
          var k2 = ((r2 >> 3) << 10) | ((g2 >> 3) << 5) | (b2 >> 3);
          var bk = freq[k2];
          if (!bk) {
            bk = { n: 0, r: 0, g: 0, b: 0 };
            freq[k2] = bk;
          }
          bk.n += 1;
          bk.r += r2;
          bk.g += g2;
          bk.b += b2;
          if (bk.n > bestN) {
            bestN = bk.n;
            bestKey = k2;
          }
        }
      }
      if (bestKey != null) {
        var win = freq[bestKey];
        if (win.n / n < DOMINANT_RATIO) return avg;
        return {
          r: Math.round(win.r / win.n),
          g: Math.round(win.g / win.n),
          b: Math.round(win.b / win.n)
        };
      }
    }
    if (bestN / n < DOMINANT_RATIO) return avg;
    var top = freq[bestKey];
    return { r: top.r, g: top.g, b: top.b };
  }

  function sampleCells(img, w, h, mode, preSrc) {
    var src = preSrc || readSourcePixels(img);
    var samples = new Array(w * h);
    var sx = src.width / w;
    var sy = src.height / h;
    var y;
    var x;
    for (y = 0; y < h; y++) {
      var y0 = Math.floor(y * sy);
      var y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      if (y1 > src.height) y1 = src.height;
      for (x = 0; x < w; x++) {
        var x0 = Math.floor(x * sx);
        var x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
        if (x1 > src.width) x1 = src.width;
        samples[y * w + x] = regionStats(src, x0, y0, x1, y1, mode);
      }
    }
    return samples;
  }

  // 限色：先按颗数取基础集，再保证每个色相桶至少留 1 颗，避免小面积关键色
  // （嘴唇红、高光、眼白等）被砍后跨色相重映射
  function limitColors(mapped, samples, maxColors) {
    var counts = {};
    var byCode = {};
    var i;
    for (i = 0; i < mapped.length; i++) {
      var c = mapped[i];
      if (isEmptyCell(c)) continue;
      counts[c.code] = (counts[c.code] || 0) + 1;
      byCode[c.code] = c;
    }
    var codes = Object.keys(counts);
    if (codes.length <= maxColors) return mapped;

    codes.sort(function (a, b) { return counts[b] - counts[a]; });

    var HUE_BUCKETS = 9; // 8 色相 + 1 灰阶
    var reserve = HUE_BUCKETS;
    var baseKeep = Math.max(1, maxColors - reserve);

    var keep = {};
    var keepList = [];
    // 1) 按颗数取前 baseKeep 作为基础保留集
    for (i = 0; i < baseKeep && i < codes.length; i++) {
      keep[codes[i]] = true;
      keepList.push(byCode[codes[i]]);
    }

    // 2) 色相覆盖：每个未覆盖桶强制纳入该桶内颗数最多的 code
    var keptBuckets = {};
    for (i = 0; i < keepList.length; i++) {
      var kc = keepList[i];
      keptBuckets[colorHueBucket(kc.r, kc.g, kc.b)] = true;
    }
    for (var b = 0; b < HUE_BUCKETS && keepList.length < maxColors; b++) {
      if (keptBuckets[b]) continue;
      var bestCode = null;
      for (i = 0; i < codes.length; i++) {
        if (keep[codes[i]]) continue;
        var cc = byCode[codes[i]];
        if (colorHueBucket(cc.r, cc.g, cc.b) !== b) continue;
        if (!bestCode || counts[codes[i]] > counts[bestCode]) bestCode = codes[i];
      }
      if (bestCode) {
        keep[bestCode] = true;
        keepList.push(byCode[bestCode]);
        keptBuckets[b] = true;
      }
    }

    // 3) 剩余名额按颗数从高到低补
    for (i = 0; i < codes.length && keepList.length < maxColors; i++) {
      if (keep[codes[i]]) continue;
      keep[codes[i]] = true;
      keepList.push(byCode[codes[i]]);
    }

    // 4) 被砍掉的色号用原始采样色重新匹配到保留集
    for (i = 0; i < mapped.length; i++) {
      if (isEmptyCell(mapped[i])) continue;
      if (!keep[mapped[i].code]) {
        var s = samples[i];
        mapped[i] = nearestColor(keepList, s.r, s.g, s.b);
      }
    }
    return mapped;
  }

  // BFS 相似色连通域合并：用 Oklab 感知距离（与 nearestColor 一致），阈值 ~0.10
  function mergeSimilarRegions(mapped, w, h, threshold) {
    var total = w * h;
    var visited = new Uint8Array(total);
    var thr2 = threshold * threshold;
    var out = mapped.slice();
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // 预算每格 Oklab，BFS 内只查表，避免重复转换
    var okCache = new Array(total);
    var i;
    for (i = 0; i < total; i++) {
      var cc = mapped[i];
      okCache[i] = isEmptyCell(cc) ? null : rgbToOklab(cc.r, cc.g, cc.b);
    }
    for (i = 0; i < total; i++) {
      if (visited[i]) continue;
      if (isEmptyCell(mapped[i])) {
        visited[i] = 1;
        continue;
      }
      var queue = [i];
      var region = [];
      var codeCount = {};
      visited[i] = 1;
      while (queue.length) {
        var cur = queue.pop();
        region.push(cur);
        var c0 = mapped[cur];
        codeCount[c0.code] = (codeCount[c0.code] || 0) + 1;
        var cx = cur % w;
        var cy = (cur / w) | 0;
        var d;
        for (d = 0; d < 4; d++) {
          var nx = cx + dirs[d][0];
          var ny = cy + dirs[d][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          var ni = ny * w + nx;
          if (visited[ni]) continue;
          var c1 = mapped[ni];
          if (isEmptyCell(c1)) continue;
          if (oklabDist2(okCache[cur], okCache[ni]) > thr2) continue;
          visited[ni] = 1;
          queue.push(ni);
        }
      }
      var bestCode = mapped[region[0]].code;
      var bestN = 0;
      var k;
      for (k in codeCount) {
        if (codeCount[k] > bestN) {
          bestN = codeCount[k];
          bestCode = k;
        }
      }
      var bead = mapped[region[0]];
      var r;
      for (r = 0; r < region.length; r++) {
        if (mapped[region[r]].code === bestCode) {
          bead = mapped[region[r]];
          break;
        }
      }
      for (r = 0; r < region.length; r++) out[region[r]] = bead;
    }
    return out;
  }

  function applyDither(samples, w, h, cache) {
    var buf = new Float32Array(w * h * 3);
    var i;
    for (i = 0; i < w * h; i++) {
      buf[i * 3] = samples[i].r;
      buf[i * 3 + 1] = samples[i].g;
      buf[i * 3 + 2] = samples[i].b;
    }
    var mapped = new Array(w * h);
    var y;
    var x;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var idx = y * w + x;
        if (samples[idx] && samples[idx].empty) {
          mapped[idx] = EMPTY_CELL;
          continue;
        }
        var r = clampByte(buf[idx * 3]);
        var g = clampByte(buf[idx * 3 + 1]);
        var b = clampByte(buf[idx * 3 + 2]);
        var c = nearestColor(cache, r, g, b);
        mapped[idx] = c;
        var er = r - c.r;
        var eg = g - c.g;
        var eb = b - c.b;
        distribute(buf, w, h, x + 1, y, er, eg, eb, 7 / 16);
        distribute(buf, w, h, x - 1, y + 1, er, eg, eb, 3 / 16);
        distribute(buf, w, h, x, y + 1, er, eg, eb, 5 / 16);
        distribute(buf, w, h, x + 1, y + 1, er, eg, eb, 1 / 16);
      }
    }
    return mapped;
  }

  function distribute(buf, w, h, x, y, er, eg, eb, factor) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    var idx = (y * w + x) * 3;
    buf[idx] += er * factor;
    buf[idx + 1] += eg * factor;
    buf[idx + 2] += eb * factor;
  }

  // 抗锯齿灰边：仅钳位接近纯黑/纯白的低彩度像素，避免描边变毛
  // 阈值放宽（luma<20、>248），保留深棕/米白等暗部/亮部豆色
  function cleanSampleRgb(r, g, b) {
    var max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    var chroma = max - min;
    var luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luma < 20 && chroma < 25) return { r: 0, g: 0, b: 0 };
    if (luma > 248 && chroma < 18) return { r: 255, g: 255, b: 255 };
    return { r: r, g: g, b: b };
  }

  function mapImage() {
    if (!state.image) return;
    var img = state.image;
    var w = state.width;
    var h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth));
    state.height = h;
    state.boardsX = Math.ceil(w / state.boardSize);
    state.boardsY = Math.ceil(h / state.boardSize);

    var geomKey = w + 'x' + img.naturalWidth + 'x' + img.naturalHeight;
    var geomChanged = geomKey !== state.geomKey;
    state.geomKey = geomKey;

    var cache = buildPaletteCache(getPalette());
    var samples;
    var mapped;
    var i;

    // 预读源像素，顺便拿到颜色数；新图载入时按颜色数自动选采样模式：
    // 卡通/插画（颜色数少，描边+大色块）→ dominant，保留锐利描边与纯色；
    // 照片（颜色数多，渐变+噪声）→ average，渐变区色差更小。
    // 用户手动切换后保持，直到下次载入新图再自动选。
    var src = readSourcePixels(img);
    state.imgColorCount = src._colorCount || 0;
    if (freshImage) {
      var autoMode = state.imgColorCount < 3000 ? 'dominant' : 'average';
      if (state.mode !== autoMode) {
        state.mode = autoMode;
        setChip(els.btnAvg, state.mode === 'average');
      }
    }

    // 主色/均值：格内采样（对齐 zippland）；抖动同路径
    samples = sampleCells(img, w, h, state.mode === 'average' ? 'average' : 'dominant', src);
    for (i = 0; i < samples.length; i++) {
      if (isEmptyCell(samples[i])) continue;
      samples[i] = cleanSampleRgb(samples[i].r, samples[i].g, samples[i].b);
    }
    if (state.dither) {
      mapped = applyDither(samples, w, h, cache);
    } else {
      mapped = new Array(w * h);
      for (i = 0; i < w * h; i++) {
        mapped[i] = isEmptyCell(samples[i])
          ? EMPTY_CELL
          : nearestColor(cache, samples[i].r, samples[i].g, samples[i].b);
      }
    }

    if (state.merge) {
      mapped = mergeSimilarRegions(mapped, w, h, state.mergeThreshold);
    }
    mapped = limitColors(mapped, samples, state.maxColors);

    // 保留仍有效的手绘：按格位搬运，色号不存在于当前色卡则丢弃（格子在则保留）
    var oldData = state.gridData;
    var oldAuto = state.autoGrid;
    var oldW = state.gridW;
    var entryByCode = {};
    for (i = 0; i < cache.length; i++) {
      entryByCode[cache[i].code] = cache[i];
    }
    var carry = [];
    if (oldData && oldAuto && oldW > 0) {
      var cap = Math.min(oldData.length, oldAuto.length);
      var ci;
      for (ci = 0; ci < cap; ci++) {
        if (!sameEntry(oldData[ci], oldAuto[ci])) {
          var col = ci % oldW;
          var row = (ci / oldW) | 0;
          if (row < h && col < w) {
            var ne = entryByCode[oldData[ci].code];
            if (ne) carry.push([row * w + col, ne]);
          }
        }
      }
    }
    var grid = mapped.slice();
    for (i = 0; i < carry.length; i++) {
      grid[carry[i][0]] = carry[i][1];
    }

    state.gridData = grid;
    state.autoGrid = mapped;
    state.gridW = w;
    if (!state.gen) state.gen = 0;
    state.gen += 1; // 色板/参数变更时让 3D 贴图缓存失效

    // 图被整体重排/换色卡时，历史格位可能对不上，清空撤销栈
    if (!oldData || (oldW > 0 && oldW !== w) || state.paletteId !== state._lastPalette) {
      flushEdits();
    }
    state._lastPalette = state.paletteId;

    recount();
    // 画笔色跟随当前色卡；色号已不存在时回落到图上最常用色
    if (!state.brush || !entryByCode[state.brush.code]) {
      var top = sortedCounts()[0];
      if (top) {
        state.brush = { code: top.code, hex: top.hex, r: top.r, g: top.g, b: top.b };
      } else {
        state.brush = null;
      }
    } else {
      var bc = entryByCode[state.brush.code];
      state.brush = { code: bc.code, hex: bc.hex, r: bc.r, g: bc.g, b: bc.b };
    }
    refreshEditUI(true);
    if (state.boardIndex >= state.boardsX * state.boardsY) state.boardIndex = -1;
    // 分板数可能变：先刷新翻板条，再适配预览（避免首帧不显示）
    updateBoardLabel();
    if (geomChanged) {
      fitView();
    } else {
      renderPreview();
    }
    if (freshImage) {
      freshImage = false;
      showPreviewHint(state.view.mode === '3d'
        ? '单指拖动旋转视角 · 双指/滚轮缩放 · 双击放大/复位'
        : '单指拖动平移 · 双指缩放 · 双击放大/复位');
    }
  }

  function scheduleRegen() {
    if (regenTimer) clearTimeout(regenTimer);
    regenTimer = setTimeout(function () {
      mapImage();
    }, 80);
  }

  function boardRect(index) {
    if (index < 0) {
      return { x0: 0, y0: 0, x1: state.width, y1: state.height };
    }
    var bx = index % state.boardsX;
    var by = (index / state.boardsX) | 0;
    var bs = state.boardSize;
    var x0 = bx * bs;
    var y0 = by * bs;
    return {
      x0: x0,
      y0: y0,
      x1: Math.min(state.width, x0 + bs),
      y1: Math.min(state.height, y0 + bs)
    };
  }

  function isBoardSeam(globalCoord) {
    return globalCoord > 0 && globalCoord % state.boardSize === 0;
  }

  function drawPattern(targetCtx, cell, showGrid, rect, forExport) {
    var mapped = state.gridData;
    if (!mapped) return;
    var w = state.width;
    var x0 = rect.x0;
    var y0 = rect.y0;
    var x1 = rect.x1;
    var y1 = rect.y1;
    var pw = x1 - x0;
    var ph = y1 - y0;
    var canvasW = pw * cell;
    var canvasH = ph * cell;
    targetCtx.canvas.width = canvasW;
    targetCtx.canvas.height = canvasH;

    var y;
    var x;
    for (y = y0; y < y1; y++) {
      for (x = x0; x < x1; x++) {
        var c = mapped[y * w + x];
        if (isEmptyCell(c)) continue;
        // 选中色号定位：仅淡化其它格子，选中色号保持原色
        var dim = state.highlightCode && state.highlightCode !== c.code;
        targetCtx.fillStyle = dim ? mixHex(c.hex, '#FFFFFF', 0.72) : c.hex;
        var px = (x - x0) * cell;
        var py = (y - y0) * cell;
        targetCtx.fillRect(px, py, cell, cell);
      }
    }

    // 格线叠画（细线，不挤占格面）
    if (showGrid) {
      targetCtx.strokeStyle = EXPORT_GRID_COLOR;
      targetCtx.lineWidth = 1;
      targetCtx.beginPath();
      for (x = 0; x <= pw; x++) {
        var gx = x * cell + 0.5;
        targetCtx.moveTo(gx, 0);
        targetCtx.lineTo(gx, canvasH);
      }
      for (y = 0; y <= ph; y++) {
        var gy = y * cell + 0.5;
        targetCtx.moveTo(0, gy);
        targetCtx.lineTo(canvasW, gy);
      }
      targetCtx.stroke();
    }

    // 分板缝：叠在图案之上
    if (state.showSeam && state.boardsX * state.boardsY > 1) {
      var seamW = Math.max(2, Math.round(cell / 10));
      targetCtx.fillStyle = SEAM_COLOR;
      for (x = x0 + 1; x < x1; x++) {
        if (isBoardSeam(x)) {
          targetCtx.fillRect((x - x0) * cell - Math.floor(seamW / 2), 0, seamW, canvasH);
        }
      }
      for (y = y0 + 1; y < y1; y++) {
        if (isBoardSeam(y)) {
          targetCtx.fillRect(0, (y - y0) * cell - Math.floor(seamW / 2), canvasW, seamW);
        }
      }
    }

    if (forExport && state.exp.codes) {
      targetCtx.font = Math.max(6, (cell * 0.32) | 0) + 'px sans-serif';
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';
      for (y = y0; y < y1; y++) {
        for (x = x0; x < x1; x++) {
          var bead = mapped[y * w + x];
          if (isEmptyCell(bead)) continue;
          var lum = bead.r * 0.299 + bead.g * 0.587 + bead.b * 0.114;
          targetCtx.fillStyle = lum > 160 ? 'rgba(0,0,0,0.88)' : 'rgba(255,255,255,0.95)';
          targetCtx.fillText(
            bead.code,
            (x - x0) * cell + cell / 2,
            (y - y0) * cell + cell / 2
          );
        }
      }
    }

    if (forExport) {
      targetCtx.strokeStyle = EXPORT_GRID_COLOR;
      targetCtx.lineWidth = Math.max(1, Math.round(cell / 18));
      targetCtx.strokeRect(
        targetCtx.lineWidth / 2,
        targetCtx.lineWidth / 2,
        canvasW - targetCtx.lineWidth,
        canvasH - targetCtx.lineWidth
      );
    }
  }

  function mixHex(a, b, t) {
    var ar = parseInt(a.slice(1, 3), 16);
    var ag = parseInt(a.slice(3, 5), 16);
    var ab = parseInt(a.slice(5, 7), 16);
    var br = parseInt(b.slice(1, 3), 16);
    var bg = parseInt(b.slice(3, 5), 16);
    var bb = parseInt(b.slice(5, 7), 16);
    return rgbToHex(
      Math.round(ar + (br - ar) * t),
      Math.round(ag + (bg - ag) * t),
      Math.round(ab + (bb - ab) * t)
    );
  }

  function viewportSize() {
    return {
      vw: els.viewport.clientWidth || 300,
      vh: els.viewport.clientHeight || 300
    };
  }

  function previewMetrics() {
    var rect = boardRect(state.boardIndex);
    var pw = rect.x1 - rect.x0;
    var ph = rect.y1 - rect.y0;
    return {
      rect: rect,
      pw: Math.max(0, pw),
      ph: Math.max(0, ph),
      cw: pw * PRE_CS,
      ch: ph * PRE_CS
    };
  }

  // 视图坐标：content px = 格子在内容坐标系里的位置；s 为 css px / content px
  function fitView2d() {
    var m = previewMetrics();
    var v = viewportSize();
    if (!m.pw || !m.ph) return;
    var fitS = Math.min(v.vw / m.cw, v.vh / m.ch);
    state.view.fitS = fitS;
    state.view.s = fitS;
    state.view.tx = (v.vw - m.cw * fitS) / 2;
    state.view.ty = (v.vh - m.ch * fitS) / 2;
  }

  // 纯函数版夹紧：给定缩放算平移的合法范围，不改 state。
  // 图片查看器口径（对齐 iOS BeadPreviewPane.clampedOffset）：
  // 内容的边不能缩进容器内 —— 放大后拖不出去，内容小于容器时居中。
  function clampOffset2d(tx, ty, s) {
    var m = previewMetrics();
    var v = viewportSize();
    var cw = m.cw * s;
    var ch = m.ch * s;
    return {
      tx: cw <= v.vw ? (v.vw - cw) / 2 : Math.max(v.vw - cw, Math.min(0, tx)),
      ty: ch <= v.vh ? (v.vh - ch) / 2 : Math.max(v.vh - ch, Math.min(0, ty))
    };
  }

  function clampView2d() {
    var m = previewMetrics();
    if (!m.pw || !m.ph) return;
    var s = state.view.s;
    if (!isFinite(s) || s <= 0) s = state.view.fitS || 1;
    // 最远只能回落到「铺满视口」，最近放大到 MAX_ZOOM 倍
    s = Math.max(state.view.fitS || 1, Math.min(MAX_ZOOM, s));
    state.view.s = s;
    var o = clampOffset2d(state.view.tx, state.view.ty, s);
    state.view.tx = o.tx;
    state.view.ty = o.ty;
  }

  // 容器尺寸变了（「更多」面板展开/收起、编辑条出现、切 3D、转屏）就重新适配：
  // - 未放大：重新铺满并居中（图片中心 = 容器中心）；
  // - 已放大：保持缩放，按「内容中心在容器里的比例」延续视口，再严格夹紧。
  // - keepTransform：只更新 fitS / 防溢出，不重新居中（进手绘页时用，避免预览下跳）。
  function syncViewportResize(opts) {
    if (!state.gridData) return;
    opts = opts || {};
    var keep = !!(opts.keepTransform || (state.editOn && currentRoute() === 'hand'));
    var m = previewMetrics();
    var v = viewportSize();
    if (!m.pw || !m.ph || !v.vw || !v.vh) return;
    var prevFitS = state.view.fitS || 0;
    var fitS = Math.min(v.vw / m.cw, v.vh / m.ch);
    // 判「用户在放大态」要用变更前的拟合值，否则面板一动就误判成未放大
    var wasFit = !prevFitS || state.view.s <= prevFitS * 1.001;
    state.view.fitS = fitS;
    if (keep) {
      var s = state.view.s;
      if (!isFinite(s) || s <= 0) s = fitS;
      // 视口变矮时允许缩小到新 fit；变高时保持原缩放，避免被重新铺满后下移
      if (s > fitS) s = fitS;
      state.view.s = Math.min(MAX_ZOOM, s);
      var cw = m.cw * state.view.s;
      var ch = m.ch * state.view.s;
      if (cw > v.vw) {
        state.view.tx = Math.max(v.vw - cw, Math.min(0, state.view.tx));
      }
      if (ch > v.vh) {
        state.view.ty = Math.max(v.vh - ch, Math.min(0, state.view.ty));
      }
      renderPreview();
      return;
    }
    if (wasFit) {
      state.view.s = fitS;
      state.view.tx = (v.vw - m.cw * fitS) / 2;
      state.view.ty = (v.vh - m.ch * fitS) / 2;
    } else {
      var s2 = state.view.s;
      var rx = (v.vw / 2 - state.view.tx) / (m.cw * s2);
      var ry = (v.vh / 2 - state.view.ty) / (m.ch * s2);
      state.view.tx = v.vw / 2 - rx * m.cw * s2;
      state.view.ty = v.vh / 2 - ry * m.ch * s2;
      clampView2d();
    }
    renderPreview();
  }

  function syncCanvasSize(vw, vh) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(vw * dpr);
    var h = Math.round(vh * dpr);
    if (els.canvas.width !== w || els.canvas.height !== h) {
      els.canvas.width = w;
      els.canvas.height = h;
    }
    if (els.canvas.style.width !== vw + 'px') els.canvas.style.width = vw + 'px';
    if (els.canvas.style.height !== vh + 'px') els.canvas.style.height = vh + 'px';
    return dpr;
  }

  // 格子实际显示色（未选中高亮时淡化其它格子），与导出逻辑一致
  function baseCellAt(colGlobal, rowGlobal) {
    var c = state.gridData[rowGlobal * state.width + colGlobal];
    if (isEmptyCell(c)) return EMPTY_CELL;
    var hex = c.hex;
    if (state.highlightCode && state.highlightCode !== c.code) {
      hex = mixHex(hex, dimTargetHex(), 0.72);
    }
    return { code: c.code, hex: hex };
  }

  function luma(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return r * 0.299 + g * 0.587 + b * 0.114;
  }

  function render2d(opts) {
    opts = opts || {};
    var m = previewMetrics();
    var v = viewportSize();
    if (!state.gridData || !m.pw || !m.ph) return;
    if (!fit2dAnim && !opts.skipClear) clampView2d();
    var vw = v.vw;
    var vh = v.vh;
    var dpr = syncCanvasSize(vw, vh);
    var s = state.view.s;
    var tx = state.view.tx;
    var ty = state.view.ty;
    var rect = m.rect;
    var i;
    var j;
    var baseA = opts.alpha != null ? opts.alpha : 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!opts.skipClear) ctx.clearRect(0, 0, vw, vh);
    ctx.globalAlpha = baseA;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * tx, dpr * ty);

    // 可视内容范围（content px）
    var xmin = (0 - tx) / s;
    var ymin = (0 - ty) / s;
    var xmax = (vw - tx) / s;
    var ymax = (vh - ty) / s;
    var i0 = Math.max(0, Math.floor(xmin / PRE_CS));
    var j0 = Math.max(0, Math.floor(ymin / PRE_CS));
    var i1 = Math.min(m.pw, Math.ceil(xmax / PRE_CS));
    var j1 = Math.min(m.ph, Math.ceil(ymax / PRE_CS));
    if (i1 <= i0) i1 = i0 + 1;
    if (j1 <= j0) j1 = j0 + 1;

    var mapped = state.gridData;
    var wAll = state.width;
    // 外扩只用来盖住相邻格之间的亚像素缝，上限是格线（屏幕 1px）的半径 0.5/s 内容像素：
    // 固定外扩（旧值 0.75）放大后会从格线外侧露出来，看着就是「格面比格线大、不贴合」
    var cellPad = 0.4 / Math.max(0.001, s);
    var cellDraw = PRE_CS + cellPad;
    for (j = j0; j < j1; j++) {
      var gr = rect.y0 + j;
      for (i = i0; i < i1; i++) {
        var gcol = rect.x0 + i;
        var c = mapped[gr * wAll + gcol];
        if (isEmptyCell(c)) continue;
        var col = c.hex;
        if (state.highlightCode && state.highlightCode !== c.code) {
          col = mixHex(col, dimTargetHex(), 0.72);
        }
        ctx.fillStyle = col;
        ctx.fillRect(i * PRE_CS, j * PRE_CS, cellDraw, cellDraw);
      }
    }

    // 格线叠画：线宽按屏幕约 1px，不挤占格面、开关不偏移
    if (state.showGrid) {
      ctx.strokeStyle = gridLineColor();
      ctx.lineWidth = 1 / Math.max(0.001, s);
      ctx.beginPath();
      var gi0 = Math.max(0, i0);
      var gi1 = Math.min(m.pw, i1);
      var gj0 = Math.max(0, j0);
      var gj1 = Math.min(m.ph, j1);
      for (i = gi0; i <= gi1; i++) {
        var gx = i * PRE_CS;
        ctx.moveTo(gx, gj0 * PRE_CS);
        ctx.lineTo(gx, gj1 * PRE_CS);
      }
      for (j = gj0; j <= gj1; j++) {
        var gy = j * PRE_CS;
        ctx.moveTo(gi0 * PRE_CS, gy);
        ctx.lineTo(gi1 * PRE_CS, gy);
      }
      ctx.stroke();
    }

    // 分板红线（整图模式且多板时）
    if (state.showSeam && state.boardIndex < 0 && state.boardsX * state.boardsY > 1) {
      var seamW = Math.max(2, Math.round(PRE_CS / 8));
      ctx.fillStyle = SEAM_COLOR;
      for (i = 1; i < m.pw; i++) {
        if (isBoardSeam(rect.x0 + i)) {
          ctx.fillRect(i * PRE_CS - Math.floor(seamW / 2), 0, seamW, m.ch);
        }
      }
      for (j = 1; j < m.ph; j++) {
        if (isBoardSeam(rect.y0 + j)) {
          ctx.fillRect(0, j * PRE_CS - Math.floor(seamW / 2), m.cw, seamW);
        }
      }
    }

    // 放大到一定倍数后，格内显示色号（随缩放等比放大、保持清晰）
    if (s * PRE_CS >= CODE_SHOW_CELL) {
      ctx.font = Math.round(PRE_CS * CODE_SHOW_FONT) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (j = j0; j < j1; j++) {
        var gr2 = rect.y0 + j;
        for (i = i0; i < i1; i++) {
          var g2 = rect.x0 + i;
          var bead = mapped[gr2 * wAll + g2];
          if (isEmptyCell(bead)) continue;
          var hex = bead.hex;
          if (state.highlightCode && state.highlightCode !== bead.code) {
            hex = mixHex(hex, dimTargetHex(), 0.72);
          }
          ctx.fillStyle = luma(hex) > 160 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)';
          ctx.fillText(bead.code, i * PRE_CS + PRE_CS / 2, j * PRE_CS + PRE_CS / 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function renderPreview() {
    if (!state.gridData) return;
    if (morphAnim) {
      renderMorphFrame();
    } else if (state.view.mode === '3d') {
      render3d();
    } else {
      render2d();
    }
    updateBoardLabel();
  }

  function fitView() {
    fitView2d();
    renderPreview();
  }

  // ---------- 3D 视图 ----------
  var BEAD_SEGS = 16;      // 圆周分段（越多越圆）

  function shadeHex(hex, f) {
    // f<0 加深、f>0 提亮（相对黑白）
    if (f < 0) return mixHex(hex, '#000000', Math.min(1, -f));
    return mixHex(hex, '#FFFFFF', Math.min(1, f));
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function smoothstep(edge0, edge1, x) {
    var t = (x - edge0) / Math.max(1e-6, edge1 - edge0);
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  }

  // 把总进度 e 映射到 [a,b] 区间内的 0→1
  function stagger(e, a, b) {
    return smoothstep(a, b, e);
  }

  var morphAnim = null;
  var fit2dAnim = null;
  var zoom3dAnim = null;

  // 估算某姿态下铺满视口所需焦距；pad=0 时与 2D fit 对齐
  function viewBasis(yaw, pitch) {
    // pitch=π/2 正俯视时水平前向退化，改用 yaw 定义画面朝向（+x→右，+z→下，对齐 2D）
    var yawC = Math.cos(pitch);
    var fx = -yawC * Math.sin(yaw);
    var fy = -Math.sin(pitch);
    var fz = -yawC * Math.cos(yaw);
    var rl = Math.sqrt(fx * fx + fz * fz);
    var rx;
    var rz;
    var ux;
    var uy;
    var uz;
    if (rl < 1e-5) {
      rx = Math.cos(yaw);
      rz = -Math.sin(yaw);
      ux = -rz;
      uy = 0;
      uz = rx;
    } else {
      rx = -fz / rl;
      rz = fx / rl;
      ux = fy * rz;
      uy = fz * rx - fx * rz;
      uz = -fy * rx;
    }
    return { yawC: yawC, fx: fx, fy: fy, fz: fz, rx: rx, rz: rz, ux: ux, uy: uy, uz: uz };
  }

  function estimateFitF(yaw, pitch, pw, ph, vw, vh, hB, halfExtent, pad) {
    if (pad == null) pad = 0;
    var halfX = (pw - 1) / 2;
    var halfZ = (ph - 1) / 2;
    var maxX = halfX + halfExtent;
    var maxZ = halfZ + halfExtent;
    var eyeR = Math.max(3.2, Math.sqrt(pw * pw + ph * ph) * 1.15);
    var b = viewBasis(yaw, pitch);
    var eyex = eyeR * b.yawC * Math.sin(yaw);
    var eyey = eyeR * Math.sin(pitch);
    var eyez = eyeR * b.yawC * Math.cos(yaw);
    var lookY = hB * 0.5;
    function proj(px, py, pz) {
      var qy = py - lookY;
      var dx = px - eyex, dy = qy - eyey, dz = pz - eyez;
      var vx = dx * b.rx + dz * b.rz;
      var vy = dx * b.ux + dy * b.uy + dz * b.uz;
      var vz = dx * b.fx + dy * b.fy + dz * b.fz;
      if (vz <= 0.06) return null;
      return [vx / vz, vy / vz];
    }
    var cs = [
      [-maxX, hB, -maxZ], [maxX, hB, -maxZ],
      [maxX, hB, maxZ], [-maxX, hB, maxZ]
    ];
    var minUx = 1e9, maxUx = -1e9, minUy = 1e9, maxUy = -1e9;
    var i, u;
    for (i = 0; i < 4; i++) {
      u = proj(cs[i][0], cs[i][1], cs[i][2]);
      if (!u) continue;
      if (u[0] < minUx) minUx = u[0];
      if (u[0] > maxUx) maxUx = u[0];
      if (u[1] < minUy) minUy = u[1];
      if (u[1] > maxUy) maxUy = u[1];
    }
    var spanW = Math.max(1e-3, maxUx - minUx);
    var spanH = Math.max(1e-3, maxUy - minUy);
    var F0 = Math.min((vw - pad) / spanW, (vh - pad) / spanH);
    return (!isFinite(F0) || F0 <= 0) ? 1 : F0;
  }

  // 用当前 2D 的 s/tx/ty 反推正俯视 3D 的 F/pan，保证格心屏幕坐标一致
  function framingMatch2d(s2, tx, ty, pw, ph, cw, ch, vw, vh, hFactor) {
    var eyeR = Math.max(3.2, Math.sqrt(pw * pw + ph * ph) * 1.15);
    var lookY = 0.52 * hFactor * 0.5;
    var vz = Math.max(0.2, eyeR - lookY);
    var F = PRE_CS * s2 * vz;
    return {
      F: F,
      panX: tx + s2 * cw / 2 - vw / 2,
      panY: ty + s2 * ch / 2 - vh / 2,
      eyeR: eyeR,
      vz: vz
    };
  }

  function render3d(opts) {
    opts = opts || {};
    var m = previewMetrics();
    var v = viewportSize();
    if (!state.gridData || !m.pw || !m.ph) return;
    var vw = v.vw;
    var vh = v.vh;
    var dpr = syncCanvasSize(vw, vh);
    var baseA = opts.alpha != null ? opts.alpha : 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!opts.skipClear) ctx.clearRect(0, 0, vw, vh);
    ctx.globalAlpha = baseA;

    var s3 = state.view3d;
    if (!s3.init) {
      s3.init = true;
      s3.yaw = 0;
      s3.pitch = 0.5;
      s3.zoom = 1;
      s3.baseF = 0;
      s3.hFactor = 1;
      s3.roundness = 1;
    }
    var yaw = s3.yaw || 0;
    var pitch = s3.pitch == null ? 0.5 : s3.pitch;
    pitch = Math.max(0.18, Math.min(Math.PI / 2, pitch));
    var zoom = Math.max(0.45, Math.min(3.5, s3.zoom == null ? 1 : s3.zoom));
    var hFactor = s3.hFactor == null ? 1 : Math.max(0.015, Math.min(1, s3.hFactor));
    var roundness = s3.roundness == null ? 1 : Math.max(0, Math.min(1, s3.roundness));

    var pw = m.pw;
    var ph = m.ph;
    var halfX = (pw - 1) / 2;
    var halfZ = (ph - 1) / 2;
    var hB = 0.52 * hFactor;
    // 圆外半径 / 方半宽：方块铺满格，圆柱略收以露底板
    var ro = 0.46;
    var sq = 0.5;
    var ri = 0.20;
    var plateM = 0.55;
    var halfExt = ro * roundness + sq * (1 - roundness);
    // 0=贴近 2D，1=完整 3D；底板/缝色随此连续变化
    var t3d = Math.max(0, Math.min(1, hFactor * 0.62 + roundness * 0.38));

    var rect = m.rect;
    var eyeR = Math.max(3.2, Math.sqrt(pw * pw + ph * ph) * 1.15);
    var b = viewBasis(yaw, pitch);
    var eyex = eyeR * b.yawC * Math.sin(yaw);
    var eyey = eyeR * Math.sin(pitch);
    var eyez = eyeR * b.yawC * Math.cos(yaw);
    var fx = b.fx, fy = b.fy, fz = b.fz;
    var rx = b.rx, rz = b.rz;
    var ux = b.ux, uy = b.uy, uz = b.uz;
    var lookY = hB * 0.5;

    function toU(px, py, pz) {
      var qy = py - lookY;
      var dx = px - eyex, dy = qy - eyey, dz = pz - eyez;
      var vx = dx * rx + dz * rz;
      var vy = dx * ux + dy * uy + dz * uz;
      var vz = dx * fx + dy * fy + dz * fz;
      if (vz <= 0.06) return null;
      return [vx / vz, vy / vz, vz];
    }

    var maxX = halfX + halfExt;
    var maxZ = halfZ + halfExt;
    var refF = estimateFitF(0, 0.5, pw, ph, vw, vh, 0.52, 0.46, 28);
    if (!s3.baseF) s3.baseF = refF;
    var F = (s3.morphF != null ? s3.morphF : s3.baseF * zoom);

    function SX(u) { return vw / 2 + (s3.panX || 0) + u[0] * F; }
    function SY(u) { return vh / 2 + (s3.panY || 0) + u[1] * F; }

    function fillPolyPts(pts, color) {
      if (pts.length < 3) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(SX(pts[0]), SY(pts[0]));
      for (var k2 = 1; k2 < pts.length; k2++) ctx.lineTo(SX(pts[k2]), SY(pts[k2]));
      ctx.closePath();
      ctx.fill();
      // 同色描边，抹掉相邻面片之间的细缝
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.35;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // 底板与格缝底色随 t3d 插值：2D 灰格线 ↔ 3D 黑底板，避免突变
    var viewBg = viewBgColor();
    var plateDark = plateBaseColor();
    var seam2d = state.showGrid ? gridLineColor() : viewBg;
    var seamColor = mixHex(seam2d, plateDark, t3d);
    var plateColor = mixHex(viewBg, plateDark, t3d);
    var platePts = [
      toU(-maxX - plateM, -0.02, -maxZ - plateM),
      toU(maxX + plateM, -0.02, -maxZ - plateM),
      toU(maxX + plateM, -0.02, maxZ + plateM),
      toU(-maxX - plateM, -0.02, maxZ + plateM)
    ];
    if (platePts[0] && platePts[1] && platePts[2] && platePts[3]) {
      fillPolyPts(platePts, plateColor);
    }
    // 板面缝底（与 2D 格线同色起步，保证切 2D 时格线已在）
    var boardPts = [
      toU(-maxX, -0.005, -maxZ), toU(maxX, -0.005, -maxZ),
      toU(maxX, -0.005, maxZ), toU(-maxX, -0.005, maxZ)
    ];
    if (boardPts[0] && boardPts[1] && boardPts[2] && boardPts[3]) {
      fillPolyPts(boardPts, seamColor);
    }

    var totalCells = pw * ph;
    // LOD：极远才退化成小圆点；顶面/侧面整路径一次填充（Canvas 无原生圆柱，用整环代替多片拼接）
    var cellPxEst = F / Math.max(0.2, eyeR - lookY);
    var lod = 3;
    if (cellPxEst < 2.5 || totalCells > 16000) lod = 0;
    else if (cellPxEst < 5 || totalCells > 9000) lod = 1;
    else if (cellPxEst < 9 || totalCells > 5000) lod = 2;
    var segs = lod >= 3
      ? (cellPxEst > 24 ? 28 : cellPxEst > 14 ? 22 : 16)
      : lod === 2 ? 14 : 10;
    var drawWalls = lod >= 1 && hFactor > 0.05 && roundness > 0.35;
    // 低俯仰（偏侧面）不画孔内壁：Canvas 无深度缓冲，内壁很容易从外壁「透出来」
    var drawInner = lod >= 2 && roundness > 0.55 && hFactor > 0.1 && pitch > 0.42;
    var flatSquare = roundness < 0.28;
    var useDotLod = lod === 0 && !flatSquare && roundness > 0.6;
    var cosT = new Array(segs);
    var sinT = new Array(segs);
    var si;
    for (si = 0; si < segs; si++) {
      var ang = (si / segs) * Math.PI * 2;
      cosT[si] = Math.cos(ang);
      sinT[si] = Math.sin(ang);
    }
    var offO = new Array(segs);
    var offI = new Array(segs);
    for (si = 0; si < segs; si++) {
      var c0 = cosT[si];
      var s0 = sinT[si];
      var circX = c0 * ro;
      var circZ = s0 * ro;
      var ax = Math.abs(c0);
      var az = Math.abs(s0);
      var k = sq / Math.max(ax, az, 1e-6);
      var ox = circX * roundness + c0 * k * (1 - roundness);
      var oz = circZ * roundness + s0 * k * (1 - roundness);
      offO[si] = [ox, oz];
      var len = Math.sqrt(ox * ox + oz * oz) || 1;
      var ir = ri * Math.max(0.15, roundness);
      offI[si] = [ox / len * ir, oz / len * ir];
    }

    function ringFrom(cx, y, cz, offs) {
      var pts = [];
      var i;
      for (i = 0; i < segs; i++) {
        var u = toU(cx + offs[i][0], y, cz + offs[i][1]);
        if (!u) return null;
        pts.push(u);
      }
      return pts;
    }

    function pathRing(pts, reverse) {
      var n = pts.length;
      var i;
      if (!reverse) {
        ctx.moveTo(SX(pts[0]), SY(pts[0]));
        for (i = 1; i < n; i++) ctx.lineTo(SX(pts[i]), SY(pts[i]));
      } else {
        ctx.moveTo(SX(pts[n - 1]), SY(pts[n - 1]));
        for (i = n - 2; i >= 0; i--) ctx.lineTo(SX(pts[i]), SY(pts[i]));
      }
      ctx.closePath();
    }

    // 整环一次填充（evenodd 挖孔），无片间拼缝
    function fillRing(outer, inner, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      pathRing(outer, false);
      if (inner) pathRing(inner, true);
      ctx.fill('evenodd');
    }

    function fillPolySolid(pts, color) {
      if (!pts || pts.length < 3) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      pathRing(pts, false);
      ctx.fill();
    }

    var cxWall = 0;
    var czWall = 0;

    // 可见外壁连成一条带，一次填充
    function fillWallBand(top, bot, offs, outward, colorLit, colorDark) {
      var flags = new Array(segs);
      var i;
      var any = false;
      var litSum = 0;
      var litN = 0;
      for (i = 0; i < segs; i++) {
        var j = i === segs - 1 ? 0 : i + 1;
        var mx = (offs[i][0] + offs[j][0]) * 0.5;
        var mz = (offs[i][1] + offs[j][1]) * 0.5;
        var facing = mx * (eyex - cxWall) + mz * (eyez - czWall);
        if (!outward) facing = -facing;
        flags[i] = facing > 0.02;
        if (flags[i]) {
          any = true;
          litSum += facing;
          litN += 1;
        }
      }
      if (!any) return;
      ctx.fillStyle = (litN ? litSum / litN : 0) > 0.28 ? colorLit : colorDark;
      ctx.beginPath();
      var first = -1;
      for (i = 0; i < segs; i++) {
        var prev = i === 0 ? segs - 1 : i - 1;
        if (flags[i] && !flags[prev]) {
          first = i;
          break;
        }
      }
      if (first < 0) first = 0;
      var idx = first;
      var guard = 0;
      var started = false;
      var p;
      while (guard < segs && flags[idx]) {
        p = top[idx];
        if (!started) {
          ctx.moveTo(SX(p), SY(p));
          started = true;
        } else {
          ctx.lineTo(SX(p), SY(p));
        }
        idx = idx === segs - 1 ? 0 : idx + 1;
        guard += 1;
      }
      var last = idx === 0 ? segs - 1 : idx - 1;
      idx = last;
      guard = 0;
      while (guard < segs && flags[idx]) {
        p = bot[idx];
        ctx.lineTo(SX(p), SY(p));
        idx = idx === 0 ? segs - 1 : idx - 1;
        guard += 1;
      }
      ctx.closePath();
      ctx.fill();
    }

    function drawBead(cx, cz, hex) {
      var cu = toU(cx, hB * 0.55, cz);
      if (!cu) return;
      var sx = SX(cu);
      var sy = SY(cu);
      var margin = cellPxEst * 1.3 + 10;
      if (sx < -margin || sy < -margin || sx > vw + margin || sy > vh + margin) return;

      if (flatSquare) {
        var hs = sq * 0.998;
        var sqTop = [
          toU(cx - hs, hB, cz - hs),
          toU(cx + hs, hB, cz - hs),
          toU(cx + hs, hB, cz + hs),
          toU(cx - hs, hB, cz + hs)
        ];
        if (!(sqTop[0] && sqTop[1] && sqTop[2] && sqTop[3])) return;
        if (drawWalls && hFactor > 0.08) {
          var botS = [
            toU(cx - hs, 0, cz - hs),
            toU(cx + hs, 0, cz - hs),
            toU(cx + hs, 0, cz + hs),
            toU(cx - hs, 0, cz + hs)
          ];
          if (botS[0] && botS[1] && botS[2] && botS[3]) {
            var wallSq = shadeHex(hex, -0.4);
            var faces = [
              [sqTop[0], sqTop[1], botS[1], botS[0], 0, -1],
              [sqTop[1], sqTop[2], botS[2], botS[1], 1, 0],
              [sqTop[2], sqTop[3], botS[3], botS[2], 0, 1],
              [sqTop[3], sqTop[0], botS[0], botS[3], -1, 0]
            ];
            var fi;
            for (fi = 0; fi < 4; fi++) {
              var f = faces[fi];
              if (f[4] * (eyex - cx) + f[5] * (eyez - cz) < 0) continue;
              fillPolySolid([f[0], f[1], f[2], f[3]], wallSq);
            }
          }
        }
        fillPolySolid(sqTop, hex);
        return;
      }

      if (useDotLod) {
        var rad = Math.max(0.45, (ro * 0.85 * F) / cu[2]);
        ctx.fillStyle = hex;
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      var topO = ringFrom(cx, hB, cz, offO);
      if (!topO) return;
      var holeAmt = Math.max(0, Math.min(1, (roundness - 0.28) / 0.45));
      var topI = holeAmt > 0.04 ? ringFrom(cx, hB, cz, offI) : null;
      var botO = drawWalls ? ringFrom(cx, 0, cz, offO) : null;
      var botI = drawInner && topI && holeAmt > 0.35 ? ringFrom(cx, 0.015, cz, offI) : null;
      var wall = shadeHex(hex, -0.32);
      var wallDark = shadeHex(hex, -0.52);
      var wallIn = shadeHex(hex, -0.42);
      var wallInLit = shadeHex(hex, -0.22);
      var rim = shadeHex(hex, 0.06);

      cxWall = cx;
      czWall = cz;
      // 先孔内壁、再近侧外壁，最后顶面（与 iOS 一致）。
      // 若先画外壁再画内壁，内壁会盖住侧面，孔圈从外壁「穿出来」。
      if (botI && topI) fillWallBand(topI, botI, offI, false, wallInLit, wallIn);
      if (botO) fillWallBand(topO, botO, offO, true, wall, wallDark);

      if (topI && holeAmt > 0.45) {
        fillRing(topO, topI, rim);
        // 孔心用豆色堵住（略暗，像孔底），不要掺黑，否则侧面/俯视都发脏
        fillPolySolid(topI, wallIn);
      } else if (topI && holeAmt > 0.04) {
        fillRing(topO, null, rim);
        ctx.globalAlpha = holeAmt * baseA;
        fillPolySolid(topI, wallIn);
        ctx.globalAlpha = baseA;
      } else {
        fillRing(topO, null, rim);
      }
    }

    var order = [];
    var jj, ii;
    var needSort = !useDotLod;
    for (jj = 0; jj < ph; jj++) {
      for (ii = 0; ii < pw; ii++) {
        var cu0 = toU(ii - halfX, hB * 0.5, jj - halfZ);
        if (!cu0) continue;
        var sx0 = SX(cu0);
        var sy0 = SY(cu0);
        var m0 = cellPxEst * 1.5 + 12;
        if (sx0 < -m0 || sy0 < -m0 || sx0 > vw + m0 || sy0 > vh + m0) continue;
        if (needSort) order.push([ii, jj, cu0[2]]);
        else order.push([ii, jj, 0]);
      }
    }
    if (needSort) order.sort(function (a, b) { return b[2] - a[2]; });

    var oi;
    for (oi = 0; oi < order.length; oi++) {
      var oc = order[oi];
      ii = oc[0];
      jj = oc[1];
      var bead = baseCellAt(rect.x0 + ii, rect.y0 + jj);
      if (isEmptyCell(bead)) continue;
      drawBead(ii - halfX, jj - halfZ, bead.hex);
    }

    // 接近俯视扁平且够大时画出色号，与 2D 放大态衔接（随 t3d 淡出）
    var cellPx = cellPxEst;
    var codeFade = Math.max(0, Math.min(1, (1 - t3d) * 1.35)) *
      Math.max(0, Math.min(1, (pitch - 0.95) / 0.4));
    if (codeFade > 0.05 && cellPx >= CODE_SHOW_CELL * 0.92) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = codeFade * baseA;
      ctx.font = Math.round(cellPx * CODE_SHOW_FONT) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (oi = 0; oi < order.length; oi++) {
        oc = order[oi];
        ii = oc[0];
        jj = oc[1];
        var bead2 = baseCellAt(rect.x0 + ii, rect.y0 + jj);
        if (isEmptyCell(bead2)) continue;
        var hex2 = bead2.hex;
        if (state.highlightCode && state.highlightCode !== bead2.code) {
          hex2 = mixHex(hex2, dimTargetHex(), 0.72);
        }
        var cu2 = toU(ii - halfX, hB, jj - halfZ);
        if (!cu2) continue;
        ctx.fillStyle = luma(hex2) > 160 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)';
        ctx.fillText(bead2.code, SX(cu2), SY(cu2));
      }
      ctx.globalAlpha = baseA;
    }

    // 2D↔3D 过渡：格线与形态分阶段淡入淡出（由 morph 写入 morphGrid）
    var gridFade = 0;
    if (state.showGrid) {
      if (s3.morphGrid != null) gridFade = s3.morphGrid;
      else if (!morphAnim) gridFade = state.view.mode === '2d' ? 1 : 0;
      else gridFade = Math.max(0, Math.min(1, 1 - t3d * 1.15));
    }
    if (gridFade > 0.02) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = gridFade * baseA;
      ctx.strokeStyle = gridLineColor();
      ctx.lineWidth = 1;
      ctx.beginPath();
      var yGrid = hB + 0.004;
      var xMinG = -halfX - 0.5;
      var xMaxG = halfX + 0.5;
      var zMinG = -halfZ - 0.5;
      var zMaxG = halfZ + 0.5;
      var gi;
      var uA;
      var uB;
      for (gi = 0; gi <= pw; gi++) {
        var xe = gi - halfX - 0.5;
        uA = toU(xe, yGrid, zMinG);
        uB = toU(xe, yGrid, zMaxG);
        if (uA && uB) {
          ctx.moveTo(SX(uA), SY(uA));
          ctx.lineTo(SX(uB), SY(uB));
        }
      }
      for (gi = 0; gi <= ph; gi++) {
        var ze = gi - halfZ - 0.5;
        uA = toU(xMinG, yGrid, ze);
        uB = toU(xMaxG, yGrid, ze);
        if (uA && uB) {
          ctx.moveTo(SX(uA), SY(uA));
          ctx.lineTo(SX(uB), SY(uB));
        }
      }
      ctx.stroke();
      ctx.globalAlpha = baseA;
    }

    // 分板红线（全图多板且开关开启；线宽贴近 2D，过渡期淡入淡出）
    if (state.showSeam && state.boardIndex < 0 && state.boardsX * state.boardsY > 1) {
      var seamFade = 1;
      if (s3.morphSeam != null) seamFade = s3.morphSeam;
      if (seamFade > 0.02) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = seamFade * baseA;
        ctx.strokeStyle = SEAM_COLOR;
        // 过渡用 morphSeamW；稳态 3D 固定细线，避免放大后 disproportionately 变粗
        var seamW = s3.morphSeamW != null ? s3.morphSeamW : 1.5;
        ctx.lineWidth = seamW;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        var ySeam = hB + 0.01;
        var xMinS = -halfX - 0.5;
        var xMaxS = halfX + 0.5;
        var zMinS = -halfZ - 0.5;
        var zMaxS = halfZ + 0.5;
        var si2;
        var uS0;
        var uS1;
        for (si2 = 1; si2 < pw; si2++) {
          if (!isBoardSeam(rect.x0 + si2)) continue;
          var xs = si2 - halfX - 0.5;
          uS0 = toU(xs, ySeam, zMinS);
          uS1 = toU(xs, ySeam, zMaxS);
          if (uS0 && uS1) {
            ctx.moveTo(SX(uS0), SY(uS0));
            ctx.lineTo(SX(uS1), SY(uS1));
          }
        }
        for (si2 = 1; si2 < ph; si2++) {
          if (!isBoardSeam(rect.y0 + si2)) continue;
          var zs = si2 - halfZ - 0.5;
          uS0 = toU(xMinS, ySeam, zs);
          uS1 = toU(xMaxS, ySeam, zs);
          if (uS0 && uS1) {
            ctx.moveTo(SX(uS0), SY(uS0));
            ctx.lineTo(SX(uS1), SY(uS1));
          }
        }
        ctx.stroke();
        ctx.globalAlpha = baseA;
      }
    }
    ctx.globalAlpha = 1;
  }

  function updateBoardLabel() {
    var total = state.boardsX * state.boardsY;
    var multi = total > 1;
    var showAll = multi && state.boardIndex >= 0;
    if (els.boardGroup) {
      if (multi) els.boardGroup.removeAttribute('hidden');
      else els.boardGroup.setAttribute('hidden', '');
    }
    if (els.btnBoardPrev) {
      if (multi) els.btnBoardPrev.removeAttribute('hidden');
      else els.btnBoardPrev.setAttribute('hidden', '');
    }
    if (els.btnBoardNext) {
      if (multi) els.btnBoardNext.removeAttribute('hidden');
      else els.btnBoardNext.setAttribute('hidden', '');
    }
    if (els.btnBoardAll) {
      els.btnBoardAll.classList.toggle('is-collapsed', !showAll);
      els.btnBoardAll.setAttribute('aria-hidden', showAll ? 'false' : 'true');
      els.btnBoardAll.tabIndex = showAll ? 0 : -1;
    }
    if (els.boardAllSep) {
      els.boardAllSep.classList.toggle('is-collapsed', !showAll);
      els.boardAllSep.setAttribute('aria-hidden', showAll ? 'false' : 'true');
    }
    if (!els.boardLabel) return;
    if (!multi) {
      els.boardLabel.setAttribute('hidden', '');
      els.boardLabel.textContent = '';
      return;
    }
    els.boardLabel.removeAttribute('hidden');
    els.boardLabel.textContent = state.boardIndex < 0
      ? '全图'
      : (state.boardIndex + 1) + '/' + total;
  }

  function afterBoardChange() {
    updateBoardLabel();
    // 预览内容瞬时切换；「全图」钮显隐走布局动画
    var in3d = state.view.mode === '3d' || (morphAnim && morphAnim.dir === 'to3d');
    if (in3d) reset3dView();
    else fitView();
  }

  function updateMeta() {
    var total = 0;
    var i;
    var grid = state.gridData;
    if (grid) {
      for (i = 0; i < grid.length; i++) {
        if (!isEmptyCell(grid[i])) total += 1;
      }
    }
    var colors = Object.keys(state.counts || {}).length;
    var cmW = (state.width * 0.5).toFixed(1);
    var cmH = (state.height * 0.5).toFixed(1);
    els.metaLine.textContent =
      state.width + '×' + state.height + ' · ' +
      colors + '色 · ' + total + '颗 · ' +
      cmW + '×' + cmH + 'cm · ' +
      state.boardsX + '×' + state.boardsY + '板';
    syncHeader();
  }

  function sortedCounts() {
    var counts = state.counts || {};
    var list = Object.keys(counts).map(function (k) { return counts[k]; });
    list.sort(function (a, b) { return b.n - a.n; });
    return list;
  }

  function ensureDefaultHighlight(list) {
    if (!list || !list.length) {
      state.highlightCode = null;
      return;
    }
    // 仅在用户点选过的色号仍存在时保留；否则不高亮，避免整图被冲白变淡
    if (!state.highlightCode) return;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].code === state.highlightCode) return;
    }
    state.highlightCode = null;
  }

  function renderLegend() {
    var list = sortedCounts();
    ensureDefaultHighlight(list);
    var html = '';
    var selected = null;
    var i;
    if (state.highlightCode) {
      for (i = 0; i < list.length; i++) {
        if (list[i].code === state.highlightCode) {
          selected = list[i];
          break;
        }
      }
    }
    if (selected) {
      html =
        '<span class="cp">' +
        '<span class="cp-swatch" style="background:' + selected.hex + '"></span>' +
        '<span class="cp-code">' + selected.code + '</span>' +
        '</span>';
    } else {
      html = '<span class="cp"><span class="cp-code cp-muted">豆色</span></span>';
    }
    els.colorsPreview.innerHTML = html;
    if (els.colorsSheet.classList.contains('is-open')) {
      renderColorsList(list);
    }
  }

  function renderColorsList(list) {
    if (!list) list = sortedCounts();
    els.colorsList.innerHTML = '';

    // 首格：全选（取消高亮，显示全部豆色）
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'colors-item' + (state.highlightCode ? '' : ' is-on');
    clearBtn.setAttribute('data-clear', '1');
    clearBtn.setAttribute('aria-label', '全选');
    clearBtn.innerHTML =
      '<span class="colors-clear">' +
      '<span class="colors-item-code">全部</span></span>';
    els.colorsList.appendChild(clearBtn);

    var i;
    for (i = 0; i < list.length; i++) {
      var item = list[i];
      var el = document.createElement('button');
      var ink = luma(item.hex) > 160 ? '#1a1a1a' : '#ffffff';
      el.type = 'button';
      el.className = 'colors-item' + (state.highlightCode === item.code ? ' is-on' : '');
      el.setAttribute('data-code', item.code);
      el.innerHTML =
        '<span class="colors-swatch" style="background:' + item.hex + '"></span>' +
        '<span class="colors-item-code" style="color:' + ink + '">' + item.code + '</span>' +
        '<span class="colors-item-count" style="color:' + ink + '">' + item.n + '</span>';
      els.colorsList.appendChild(el);
    }
  }

  function openSheet(sheet) {
    sheet.setAttribute('aria-hidden', 'false');
    sheet.classList.add('is-open');
  }

  function closeSheet(sheet) {
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
  }

  function syncPaletteButton() {
    var p = getPalette();
    els.btnPalette.textContent = p.name;
    var options = els.paletteSheet.querySelectorAll('[data-palette]');
    var i;
    for (i = 0; i < options.length; i++) {
      var opt = options[i];
      if (opt.getAttribute('data-palette') === state.paletteId) {
        opt.classList.add('is-active');
      } else {
        opt.classList.remove('is-active');
      }
    }
  }

  function openPaletteSheet() {
    syncPaletteButton();
    openSheet(els.paletteSheet);
  }

  function closePaletteSheet() {
    closeSheet(els.paletteSheet);
  }

  function syncBoardSizeButton() {
    if (!els.btnBoardSize || !els.boardSizeSheet) return;
    var bs = state.boardSize;
    els.btnBoardSize.textContent = bs + '×' + bs;
    var options = els.boardSizeSheet.querySelectorAll('[data-board-size]');
    var i;
    for (i = 0; i < options.length; i++) {
      var opt = options[i];
      if (Number(opt.getAttribute('data-board-size')) === bs) {
        opt.classList.add('is-active');
      } else {
        opt.classList.remove('is-active');
      }
    }
  }

  function openBoardSizeSheet() {
    syncBoardSizeButton();
    openSheet(els.boardSizeSheet);
  }

  function closeBoardSizeSheet() {
    closeSheet(els.boardSizeSheet);
  }

  function applyBoardSize(size) {
    size = Number(size);
    if (!size || size === state.boardSize) {
      closeBoardSizeSheet();
      return;
    }
    state.boardSize = size;
    state.boardsX = Math.ceil(state.width / size);
    state.boardsY = Math.ceil(state.height / size);
    if (state.boardIndex >= state.boardsX * state.boardsY) state.boardIndex = -1;
    syncBoardSizeButton();
    closeBoardSizeSheet();
    updateMeta();
    if (state.gridData) fitView();
  }

  function openColorsSheet() {
    renderColorsList();
    openSheet(els.colorsSheet);
  }

  function closeColorsSheet() {
    closeSheet(els.colorsSheet);
  }

  // 载入一张 Image 作为当前工作图（裁切后回填也走这里）
  function adoptImage(img, opts) {
    var keepSource = !!(opts && opts.keepSource);
    state.image = img;
    // 换图：源图与累积裁切区域一起重置；裁切后回填则保留源图
    if (!keepSource) {
      state.sourceImage = img;
      state.cropRect = null;
    }
    state.boardIndex = -1;
    state.highlightCode = null;
    // 新图：清空上张图的手绘/撤销记录，重置编辑状态
    state.gridData = null;
    state.autoGrid = null;
    state.gridW = 0;
    state.editOn = false;
    state.brush = null;
    if (currentRoute() === 'hand' || currentRoute() === 'crop') {
      while (routeStack.length > 1 && currentRoute() !== 'edit' && currentRoute() !== 'home') {
        goBack({ instant: true });
      }
      mountPreviewOn(els.screenEdit);
    }
    setEtGroupOpen(false, true);
    flushEdits();
    if (currentRoute() === 'home') showScreen('edit');
    else if (currentRoute() !== 'edit') showScreen('edit', { replace: true, instant: true });
    else syncHeader();
    setPanelOpen(true, true);
    freshImage = true;
    syncShareBtn();
    mapImage();
  }

  // FileReader 兜底：把文件读成 data: URL
  function readAsDataURL(file, cb) {
    if (typeof FileReader !== 'function') { cb(null); return; }
    var r = new FileReader();
    r.onload = function () { cb(typeof r.result === 'string' ? r.result : null); };
    r.onerror = function () { cb(null); };
    r.onabort = function () { cb(null); };
    try { r.readAsDataURL(file); } catch (e) { cb(null); }
  }

  // 部分容器（快手 webview）里 blob: URL 会被拦或读不出来，所以：
  // 先走 createObjectURL（省内存），失败/超时再用 FileReader 的 data: URL 重试一次，
  // 两条都不通才提示失败——避免「同样的图在小红书能读、在快手提示读取失败」。
  function loadFile(file, opts, done) {
    if (!file) { if (done) done(false); return; }
    var img = new Image();
    var url = null;
    var timer = null;
    var settled = false;
    var viaData = false;

    function cleanup() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (url) { URL.revokeObjectURL(url); url = null; }
    }
    function giveUp() {
      if (settled) return;
      settled = true;
      cleanup();
      if (done) done(false);
      toast('图片读取失败');
    }
    function retryWithData() {
      if (settled) return;
      if (url) { URL.revokeObjectURL(url); url = null; }
      readAsDataURL(file, function (dataUrl) {
        if (settled) return;
        if (!dataUrl) { giveUp(); return; }
        armTimer();
        img.src = dataUrl; // 重新触发 onload / onerror
      });
    }
    function armTimer() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        if (settled) return;
        if (viaData) { giveUp(); return; }
        viaData = true;
        retryWithData();
      }, 12000);
    }

    img.onload = function () {
      if (settled) return;
      settled = true;
      cleanup();
      adoptImage(img, opts);
      if (done) done(true);
    };
    img.onerror = function () {
      if (settled) return;
      if (viaData) { giveUp(); return; }
      viaData = true;
      retryWithData();
    };

    try { url = URL.createObjectURL(file); } catch (e) { url = null; }
    if (!url) { viaData = true; retryWithData(); return; }
    armTimer();
    img.src = url;
  }

  // ================= 图片裁切（搬自 crop-grid，去掉拼图 / 宫格 / 圆角） =================
  var CROP_RATIOS = [
    { id: 'orig', label: '原始' },
    { id: '1:1', label: '1:1', w: 1, h: 1 },
    { id: '3:4', label: '3:4', w: 3, h: 4 },
    { id: '4:3', label: '4:3', w: 4, h: 3 },
    { id: '9:16', label: '9:16', w: 9, h: 16 },
    { id: '16:9', label: '16:9', w: 16, h: 9 },
    { id: 'free', label: '自由' }
  ];
  var CROP_MIN_SIDE = 64;      // 裁切框最小边（屏幕像素）
  var CROP_MAX_OUT = 1600;     // 输出最长边上限（与拼豆处理上限 1400 留一点余量）
  var CROP_ZOOM_MAX = 500;     // 缩放上限（%，相对 minScale）

  var crop = {
    image: null,          // 始终是未裁切的源图
    initRect: null,       // 本次打开时的有效区域（源图坐标，像素）
    initRatioId: 'orig',  // 本次打开时的比例
    initSnapshot: null,   // 本次打开时的视图快照，用于判断"未做修改"
    vw: 0, vh: 0, dpr: 1,
    scale: 1, minScale: 1, zoomExtra: 0,
    offsetX: 0, offsetY: 0,
    rotation: 0,          // 弧度
    flipX: 1,
    cropX: 0, cropY: 0, cropW: 0, cropH: 0,
    targetW: 0, targetH: 0,
    ratioId: 'orig',
    dragging: false, dragMode: 'pan', resizeHandle: null,
    velX: 0, velY: 0, inertiaRaf: 0,
    pinchStartDist: 0, pinchStartScale: 1,
    lastX: 0, lastY: 0, lastMoveT: 0
  };

  function cropCtx() {
    return els.cropCanvas.getContext('2d');
  }

  function cropRatio() {
    var s = crop;
    if (!s.image) return 1;
    if (s.ratioId === 'orig') return s.image.naturalWidth / s.image.naturalHeight;
    if (s.ratioId === 'free') {
      if (s.cropW > 0 && s.cropH > 0) return s.cropW / s.cropH;
      return s.image.naturalWidth / s.image.naturalHeight;
    }
    var r = CROP_RATIOS.filter(function (x) { return x.id === s.ratioId; })[0];
    return r && r.w ? r.w / r.h : 1;
  }

  // 旋转后的图片包围盒；可传入固定角（旋转动画中用终点 90°，避免中间角 AABB 变大把图撑开）
  function cropBoxAt(scale, rotationOverride) {
    var img = crop.image;
    var dw = img.naturalWidth * scale;
    var dh = img.naturalHeight * scale;
    var rot = rotationOverride != null ? rotationOverride : crop.rotation;
    var cos = Math.abs(Math.cos(rot));
    var sin = Math.abs(Math.sin(rot));
    return { w: dw * cos + dh * sin, h: dw * sin + dh * cos };
  }

  function cropSetRect(x, y, w, h) {
    var s = crop;
    w = Math.max(CROP_MIN_SIDE, Math.min(w, s.vw));
    h = Math.max(CROP_MIN_SIDE, Math.min(h, s.vh));
    x = Math.max(0, Math.min(x, s.vw - w));
    y = Math.max(0, Math.min(y, s.vh - h));
    s.cropX = x;
    s.cropY = y;
    s.cropW = w;
    s.cropH = h;
  }

  // 给定比例，算出能放进视口的裁切框尺寸（free 模式留一点边距）
  function cropFrameForRatio(ratio, free) {
    var s = crop;
    var maxW = s.vw * (free ? 0.86 : 1);
    var maxH = s.vh * (free ? 0.86 : 1);
    var w = maxW;
    var h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    return { w: w, h: h };
  }

  function cropComputeTarget() {
    var f = cropFrameForRatio(cropRatio(), crop.ratioId === 'free');
    crop.targetW = f.w;
    crop.targetH = f.h;
  }

  // 某比例是否在预设列表里，命中则返回对应 id，否则 'free'
  function cropMatchRatio(ratio) {
    var ids = CROP_RATIOS;
    for (var i = 0; i < ids.length; i++) {
      var r = ids[i];
      if (r.id === 'free') continue;
      var rr = r.id === 'orig' ? crop.image.naturalWidth / crop.image.naturalHeight : r.w / r.h;
      if (Math.abs(rr - ratio) / ratio < 0.004) return r.id;
    }
    return 'free';
  }

  // 本次打开时的目标视图：初始区域铺满裁切框
  // 前提：rotation 为 0，镜像是开的
  function cropInitViewTarget() {
    var s = crop;
    var img = s.image;
    var nw = img.naturalWidth;
    var nh = img.naturalHeight;
    var ir = s.initRect;
    var free = s.ratioId === 'free';
    var f = cropFrameForRatio(free ? ir.w / ir.h : cropRatio(), free);
    var minScale = Math.max(f.w / nw, f.h / nh);
    var k = Math.max(f.w / ir.w, f.h / ir.h, minScale);
    var zoom = Math.min(CROP_ZOOM_MAX, Math.max(0, (k / minScale - 1) * 100));
    var scale = minScale * (1 + zoom / 100);
    return {
      cropW: f.w,
      cropH: f.h,
      cropX: (s.vw - f.w) / 2,
      cropY: (s.vh - f.h) / 2,
      zoomExtra: zoom,
      // 框恒居中，所以偏移只负责把初始区域中心对到视口中心
      offsetX: (nw / 2 - (ir.x + ir.w / 2)) * scale,
      offsetY: (nh / 2 - (ir.y + ir.h / 2)) * scale,
      rotation: 0,
      flipX: 1
    };
  }

  // 从目标视图对象反推快照（用于判断"打开后未做修改"）
  function cropSnapshotOf(target) {
    var img = crop.image;
    var minScale = Math.max(target.cropW / img.naturalWidth, target.cropH / img.naturalHeight);
    return {
      cropX: target.cropX,
      cropY: target.cropY,
      cropW: target.cropW,
      cropH: target.cropH,
      offsetX: target.offsetX,
      offsetY: target.offsetY,
      scale: minScale * (1 + target.zoomExtra / 100),
      rotation: target.rotation,
      flipX: target.flipX
    };
  }

  function cropSameAsInit() {
    var a = crop;
    var b = crop.initSnapshot;
    if (!b) return false;
    function near(x, y, t) { return Math.abs(x - y) <= t; }
    return near(a.cropX, b.cropX, 1) && near(a.cropY, b.cropY, 1) &&
      near(a.cropW, b.cropW, 1) && near(a.cropH, b.cropH, 1) &&
      near(a.offsetX, b.offsetX, 1) && near(a.offsetY, b.offsetY, 1) &&
      near(a.scale, b.scale, 0.001) && near(a.flipX, b.flipX, 1e-6) &&
      Math.abs(a.rotation - b.rotation) < 1e-4;
  }

  // 屏幕上的一块矩形 → 源图归一化矩形（覆盖 0/90/180/270 旋转与镜像）
  function cropToSourceRect(r) {
    var s = crop;
    var img = s.image;
    var nw = img.naturalWidth;
    var nh = img.naturalHeight;
    var cos = Math.cos(s.rotation);
    var sin = Math.sin(s.rotation);
    if (Math.abs(cos) < 1e-9) cos = 0;
    if (Math.abs(sin) < 1e-9) sin = 0;
    var pts = [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x, r.y + r.h],
      [r.x + r.w, r.y + r.h]
    ];
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    for (var i = 0; i < pts.length; i++) {
      var ux = pts[i][0] - s.vw / 2 - s.offsetX;
      var uy = pts[i][1] - s.vh / 2 - s.offsetY;
      var u2 = ux * cos + uy * sin;
      var v = -ux * sin + uy * cos;
      var u = u2 * s.flipX;
      var px = u / s.scale + nw / 2;
      var py = v / s.scale + nh / 2;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    minX = Math.max(0, Math.min(nw - 1, minX));
    minY = Math.max(0, Math.min(nh - 1, minY));
    maxX = Math.max(minX + 1, Math.min(nw, maxX));
    maxY = Math.max(minY + 1, Math.min(nh, maxY));
    return {
      x: minX / nw,
      y: minY / nh,
      w: (maxX - minX) / nw,
      h: (maxY - minY) / nh
    };
  }

  function cropComputeMinScale(opts) {
    var s = crop;
    if (!s.image) return;
    var cw = s.cropW || s.targetW;
    var ch = s.cropH || s.targetH;
    if (!cw || !ch) { cropComputeTarget(); cw = s.targetW; ch = s.targetH; }
    // 缩放几何一律按最近 90°（或动画指定终点）算，中间角不参与
    var rotForBox = opts && opts.scaleRotation != null
      ? opts.scaleRotation
      : snapCropRotation(s.rotation);
    var box = cropBoxAt(1, rotForBox);
    var minS = Math.max(cw / box.w, ch / box.h);
    s.minScale = minS;
    // 自由拖框 / 旋转：保持绝对缩放，只抬 minScale；其余路径仍按 zoomExtra 相对换算
    if (opts && opts.preserveScale) {
      var kept = s.scale;
      if (kept < minS) {
        s.scale = minS;
        s.zoomExtra = 0;
      } else {
        s.scale = kept;
        s.zoomExtra = Math.min(CROP_ZOOM_MAX, Math.max(0, (kept / minS - 1) * 100));
      }
      return;
    }
    s.scale = minS * (1 + s.zoomExtra / 100);
  }

  function cropClampOffset(rotationOverride) {
    var s = crop;
    if (!s.image) return;
    var rot = rotationOverride != null ? rotationOverride : snapCropRotation(s.rotation);
    var box = cropBoxAt(s.scale, rot);
    var bl = s.vw / 2 - box.w / 2 + s.offsetX;
    var bt = s.vh / 2 - box.h / 2 + s.offsetY;
    if (bl > s.cropX) s.offsetX -= bl - s.cropX;
    if (bt > s.cropY) s.offsetY -= bt - s.cropY;
    if (bl + box.w < s.cropX + s.cropW) s.offsetX += s.cropX + s.cropW - (bl + box.w);
    if (bt + box.h < s.cropY + s.cropH) s.offsetY += s.cropY + s.cropH - (bt + box.h);
  }

  // 把当前视口里的图片按 crop 变换画到 ctx（供预览与导出复用）
  function cropDrawImage(ctx) {
    var s = crop;
    var img = s.image;
    var dw = img.naturalWidth * s.scale;
    var dh = img.naturalHeight * s.scale;
    ctx.translate(s.vw / 2 + s.offsetX, s.vh / 2 + s.offsetY);
    ctx.rotate(s.rotation);
    ctx.scale(s.flipX, 1);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  }

  function drawCrop() {
    var s = crop;
    if (!s.image) return;
    var ctx = cropCtx();
    var w = s.vw;
    var h = s.vh;
    var bg = '#e5eaf2';
    ctx.setTransform(crop.dpr, 0, 0, crop.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 浅色底
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 整图
    ctx.save();
    cropDrawImage(ctx);
    ctx.restore();

    // 框外：浅色底 + 淡化图片（不用整层黑罩，避免把底色染脏）
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(s.cropX, s.cropY, s.cropW, s.cropH);
    ctx.clip('evenodd');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.38;
    cropDrawImage(ctx);
    ctx.globalAlpha = 1;
    ctx.restore();

    // 框内清晰
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.cropX, s.cropY, s.cropW, s.cropH);
    ctx.clip();
    cropDrawImage(ctx);
    ctx.restore();

    // 选边框 + 三分参考线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.cropX + 0.75, s.cropY + 0.75, s.cropW - 1.5, s.cropH - 1.5);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.cropX + s.cropW / 3, s.cropY);
    ctx.lineTo(s.cropX + s.cropW / 3, s.cropY + s.cropH);
    ctx.moveTo(s.cropX + s.cropW * 2 / 3, s.cropY);
    ctx.lineTo(s.cropX + s.cropW * 2 / 3, s.cropY + s.cropH);
    ctx.moveTo(s.cropX, s.cropY + s.cropH / 3);
    ctx.lineTo(s.cropX + s.cropW, s.cropY + s.cropH / 3);
    ctx.moveTo(s.cropX, s.cropY + s.cropH * 2 / 3);
    ctx.lineTo(s.cropX + s.cropW, s.cropY + s.cropH * 2 / 3);
    ctx.stroke();

    // 自由比例：四角把手
    if (s.ratioId === 'free') {
      var hs = 14;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(75, 142, 240, 0.95)';
      ctx.lineWidth = 2;
      var corners = [
        [s.cropX, s.cropY],
        [s.cropX + s.cropW, s.cropY],
        [s.cropX, s.cropY + s.cropH],
        [s.cropX + s.cropW, s.cropY + s.cropH]
      ];
      for (var i = 0; i < corners.length; i++) {
        ctx.beginPath();
        ctx.arc(corners[i][0], corners[i][1], hs / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function cropSyncCanvasSize() {
    var rect = els.cropViewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.floor(rect.width);
    var h = Math.floor(rect.height);
    crop.vw = w;
    crop.vh = h;
    crop.dpr = dpr;
    var cv = els.cropCanvas;
    var bw = Math.floor(w * dpr);
    var bh = Math.floor(h * dpr);
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
    }
    return true;
  }

  function cropLayout() {
    if (currentRoute() !== 'crop') return;
    if (!cropSyncCanvasSize()) return;
    if (!crop.image) return;
    // 视口尺寸变了：按当前比例重算框，保留缩放倍率与偏移
    var f;
    if (crop.ratioId === 'free' && crop.cropW > CROP_MIN_SIDE && crop.cropH > CROP_MIN_SIDE) {
      f = cropFrameForRatio(crop.cropW / crop.cropH, true);
    } else {
      cropComputeTarget();
      f = { w: crop.targetW, h: crop.targetH };
    }
    cropSetRect(crop.cropX, crop.cropY, f.w, f.h);
    cropComputeMinScale();
    cropClampOffset();
    drawCrop();
    syncCropRatioChips();
  }

  function syncCropRatioChips() {
    var box = els.cropRatioChips;
    if (!box || !crop.image) return;
    box.innerHTML = '';
    CROP_RATIOS.forEach(function (r) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crop-chip' + (r.id === crop.ratioId ? ' on' : '');
      btn.textContent = r.label;
      btn.setAttribute('data-ratio', r.id);
      box.appendChild(btn);
    });
  }

  function setCropRatio(id) {
    if (id === 'orig') {
      resetCrop();
      return;
    }
    if (crop.ratioId === id) return;
    crop.ratioId = id;
    syncCropRatioChips();
    stopCropInertia();
    var to;
    if (id === 'free') {
      // 自由：沿用当前框比例，只缩到视口内
      var w = Math.max(CROP_MIN_SIDE, Math.min(crop.cropW || crop.vw * 0.86, crop.vw * 0.86));
      var h = Math.max(CROP_MIN_SIDE, Math.min(crop.cropH || crop.vh * 0.86, crop.vh * 0.86));
      to = {
        cropW: w,
        cropH: h,
        cropX: (crop.vw - w) / 2,
        cropY: (crop.vh - h) / 2
      };
    } else {
      cropComputeTarget();
      to = {
        cropW: crop.targetW,
        cropH: crop.targetH,
        cropX: (crop.vw - crop.targetW) / 2,
        cropY: (crop.vh - crop.targetH) / 2
      };
    }
    cropTween(to, 260);
  }

  function cropToLocal(clientX, clientY) {
    var rect = els.cropViewport.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function cropHitHandle(x, y) {
    if (crop.ratioId !== 'free') return null;
    var c = { left: crop.cropX, top: crop.cropY, width: crop.cropW, height: crop.cropH };
    var t = 22;
    var nearL = Math.abs(x - c.left) <= t;
    var nearR = Math.abs(x - (c.left + c.width)) <= t;
    var nearT = Math.abs(y - c.top) <= t;
    var nearB = Math.abs(y - (c.top + c.height)) <= t;
    if (nearT && nearL) return 'nw';
    if (nearT && nearR) return 'ne';
    if (nearB && nearL) return 'sw';
    if (nearB && nearR) return 'se';
    if (nearT && x >= c.left && x <= c.left + c.width) return 'n';
    if (nearB && x >= c.left && x <= c.left + c.width) return 's';
    if (nearL && y >= c.top && y <= c.top + c.height) return 'w';
    if (nearR && y >= c.top && y <= c.top + c.height) return 'e';
    return null;
  }

  function cropResizeByHandle(handle, x, y) {
    var s = crop;
    // 框限制在当前图的显示范围内（对齐 iOS：改框不改图缩放）
    var box = cropBoxAt(s.scale);
    var imgL = s.vw / 2 - box.w / 2 + s.offsetX;
    var imgT = s.vh / 2 - box.h / 2 + s.offsetY;
    var limL = Math.max(0, imgL);
    var limT = Math.max(0, imgT);
    var limR = Math.min(s.vw, imgL + box.w);
    var limB = Math.min(s.vh, imgT + box.h);

    var left = s.cropX;
    var top = s.cropY;
    var right = left + s.cropW;
    var bottom = top + s.cropH;
    if (handle.indexOf('n') >= 0) top = y;
    if (handle.indexOf('s') >= 0) bottom = y;
    if (handle.indexOf('w') >= 0) left = x;
    if (handle.indexOf('e') >= 0) right = x;
    if (right < left) { var tx = left; left = right; right = tx; }
    if (bottom < top) { var ty = top; top = bottom; bottom = ty; }

    left = Math.max(limL, Math.min(left, limR - CROP_MIN_SIDE));
    top = Math.max(limT, Math.min(top, limB - CROP_MIN_SIDE));
    right = Math.max(left + CROP_MIN_SIDE, Math.min(right, limR));
    bottom = Math.max(top + CROP_MIN_SIDE, Math.min(bottom, limB));

    cropSetRect(left, top, right - left, bottom - top);
    cropComputeMinScale({ preserveScale: true });
    syncCropZoomSlider(s.zoomExtra);
    cropClampOffset();
  }

  function stopCropInertia() {
    if (crop.inertiaRaf) cancelAnimationFrame(crop.inertiaRaf);
    crop.inertiaRaf = 0;
    crop.velX = 0;
    crop.velY = 0;
  }

  function startCropInertia() {
    stopCropInertia();
    var speed = Math.sqrt(crop.velX * crop.velX + crop.velY * crop.velY);
    if (speed < 0.35 || crop.dragMode === 'resize') return;
    var maxV = 42;
    if (speed > maxV) {
      var k = maxV / speed;
      crop.velX *= k;
      crop.velY *= k;
    }
    function tick() {
      crop.offsetX += crop.velX;
      crop.offsetY += crop.velY;
      cropClampOffset();
      drawCrop();
      crop.velX *= 0.95;
      crop.velY *= 0.95;
      if (Math.sqrt(crop.velX * crop.velX + crop.velY * crop.velY) < 0.18) {
        crop.inertiaRaf = 0;
        return;
      }
      crop.inertiaRaf = requestAnimationFrame(tick);
    }
    crop.inertiaRaf = requestAnimationFrame(tick);
  }

  function onCropDown(clientX, clientY) {
    stopCropInertia();
    finishCropAnim();
    var local = cropToLocal(clientX, clientY);
    crop.lastX = clientX;
    crop.lastY = clientY;
    crop.lastMoveT = performance.now();
    crop.velX = 0;
    crop.velY = 0;
    crop.resizeHandle = cropHitHandle(local.x, local.y);
    crop.dragMode = crop.resizeHandle ? 'resize' : 'pan';
    crop.dragging = true;
  }

  function onCropMove(clientX, clientY) {
    if (!crop.dragging) return;
    if (crop.dragMode === 'resize' && crop.resizeHandle) {
      var local = cropToLocal(clientX, clientY);
      cropResizeByHandle(crop.resizeHandle, local.x, local.y);
      crop.lastX = clientX;
      crop.lastY = clientY;
      crop.lastMoveT = performance.now();
      drawCrop();
      return;
    }
    var now = performance.now();
    var dt = Math.max(8, now - (crop.lastMoveT || now));
    var dx = clientX - crop.lastX;
    var dy = clientY - crop.lastY;
    crop.offsetX += dx;
    crop.offsetY += dy;
    var vx = dx / dt * 16;
    var vy = dy / dt * 16;
    crop.velX = crop.velX * 0.6 + vx * 0.4;
    crop.velY = crop.velY * 0.6 + vy * 0.4;
    crop.lastX = clientX;
    crop.lastY = clientY;
    crop.lastMoveT = now;
    cropClampOffset();
    drawCrop();
  }

  // ---- 动画：比例切换 / 重置 / 旋转 / 镜像 都走同一条 tween ----
  var cropAnim = { raf: 0, target: null, done: null, opts: null };

  function cancelCropAnim() {
    if (cropAnim.raf) cancelAnimationFrame(cropAnim.raf);
    cropAnim.raf = 0;
    cropAnim.target = null;
    cropAnim.done = null;
    cropAnim.opts = null;
  }

  /** 旋转角量化到 0/90/180/270（四分之一圈整数，避免浮点漂移） */
  function snapCropRotation(rad) {
    var q = Math.PI / 2;
    var steps = Math.round(Number(rad) / q);
    steps = ((steps % 4) + 4) % 4;
    return steps * q;
  }

  /** 当前已提交的旋转角：有进行中的旋转动画时用其终点，否则 snap 当前值 */
  function cropCommittedRotation() {
    if (cropAnim.target && cropAnim.target.rotation != null) {
      return snapCropRotation(cropAnim.target.rotation);
    }
    return snapCropRotation(crop.rotation);
  }

  function rotateCrop() {
    pulseCropBtn(els.cropRotate, 'is-spin');
    var q = Math.PI / 2;
    // 连点时绝不能从中间帧（如 45°）起算：先落到已承诺的 90° 格
    var base = cropCommittedRotation();
    // 硬取消进行中的补间（不要 finish 到半途再 lerp）
    if (cropAnim.raf) cancelAnimationFrame(cropAnim.raf);
    cropAnim.raf = 0;
    cropAnim.target = null;
    cropAnim.done = null;
    cropAnim.opts = null;
    crop.rotation = base;

    var animTo = base + q;
    var end = snapCropRotation(animTo);
    cropTween(
      { rotation: animTo },
      280,
      function () {
        crop.rotation = end;
      },
      { preserveScale: true, scaleRotation: end }
    );
  }

  function flipCrop() {
    pulseCropBtn(els.cropFlip, 'is-flip');
    cropTween({ flipX: crop.flipX === 1 ? -1 : 1 }, 280, null, { preserveScale: true });
  }

  // 让进行中的动画立刻落到终态（用户中途点了应用/拖动/连点旋转时需要）
  function finishCropAnim() {
    var to = cropAnim.target;
    var cb = cropAnim.done;
    var opts = cropAnim.opts;
    if (cropAnim.raf) cancelAnimationFrame(cropAnim.raf);
    cropAnim.raf = 0;
    cropAnim.target = null;
    cropAnim.done = null;
    cropAnim.opts = null;
    if (!to) {
      // 无目标时也清掉可能残留的中间角
      crop.rotation = snapCropRotation(crop.rotation);
      return;
    }
    Object.keys(to).forEach(function (k) {
      crop[k] = k === 'rotation' ? snapCropRotation(to[k]) : to[k];
    });
    cropAfterChange(cb, opts);
  }

  function cropEaseOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // opts.preserveScale：旋转/镜像时保持绝对缩放
  // opts.scaleRotation：算 minScale / 钳制用的固定角（旋转动画用终点，避免中间角撑图）
  function cropAfterChange(done, opts) {
    cropComputeMinScale(opts);
    var rot = opts && opts.scaleRotation != null ? opts.scaleRotation : undefined;
    cropClampOffset(rot);
    drawCrop();
    if (done) done();
  }

  // 把 crop 上的若干数值属性补间到目标值；每帧后重算 minScale / 钳制 / 重绘
  function cropTween(to, dur, done, opts) {
    finishCropAnim();
    var keys = Object.keys(to);
    var from = {};
    keys.forEach(function (k) {
      // 旋转起点必须落在 90° 格上，避免从 45° 中间态再插值
      from[k] = k === 'rotation' ? snapCropRotation(crop[k]) : crop[k];
      if (k === 'rotation') crop.rotation = from[k];
    });
    if (!dur) {
      keys.forEach(function (k) {
        crop[k] = k === 'rotation' ? snapCropRotation(to[k]) : to[k];
      });
      cropAfterChange(done, opts);
      return;
    }
    cropAnim.target = to;
    cropAnim.done = done;
    cropAnim.opts = opts || null;
    var start = performance.now();
    function frame(now) {
      var t = Math.min(1, (now - start) / dur);
      var e = cropEaseOut(t);
      keys.forEach(function (k) {
        crop[k] = from[k] + (to[k] - from[k]) * e;
      });
      if (t < 1) {
        cropAfterChange(null, opts);
        cropAnim.raf = requestAnimationFrame(frame);
      } else {
        cropAnim.raf = 0;
        cropAnim.target = null;
        cropAnim.done = null;
        cropAnim.opts = null;
        keys.forEach(function (k) {
          crop[k] = k === 'rotation' ? snapCropRotation(to[k]) : to[k];
        });
        cropAfterChange(done, opts);
      }
    }
    cropAnim.raf = requestAnimationFrame(frame);
  }

  function onCropUp() {
    var wasPan = crop.dragging && crop.dragMode === 'pan';
    crop.dragging = false;
    crop.dragMode = 'pan';
    crop.resizeHandle = null;
    if (wasPan) startCropInertia();
  }

  function cropSetZoom(zoomExtra) {
    finishCropAnim();
    crop.zoomExtra = Math.max(0, Math.min(CROP_ZOOM_MAX, zoomExtra));
    crop.scale = crop.minScale * (1 + crop.zoomExtra / 100);
    cropClampOffset();
    drawCrop();
  }

  function pulseCropBtn(btn, cls) {
    if (!btn) return;
    btn.classList.remove(cls);
    void btn.offsetWidth;
    btn.classList.add(cls);
    setTimeout(function () { btn.classList.remove(cls); }, 400);
  }

  function syncCropZoomSlider(zoom) {
    if (els.cropZoom) els.cropZoom.value = String(Math.round(Math.min(CROP_ZOOM_MAX, zoom)));
  }

  function openCrop() {
    // 基准永远是未裁切的源图；已裁切效果由 state.cropRect 累积表达
    var base = state.sourceImage;
    if (!base) return;
    crop.image = base;
    var nw = base.naturalWidth;
    var nh = base.naturalHeight;
    var cr = state.cropRect;
    crop.initRect = cr
      ? { x: cr.x * nw, y: cr.y * nh, w: cr.w * nw, h: cr.h * nh }
      : { x: 0, y: 0, w: nw, h: nh };
    crop.ratioId = (!cr || (cr.x <= 0.002 && cr.y <= 0.002 && cr.w >= 0.996 && cr.h >= 0.996))
      ? 'orig'
      : cropMatchRatio(crop.initRect.w / crop.initRect.h);
    crop.initRatioId = crop.ratioId;
    crop.rotation = 0;
    crop.flipX = 1;
    crop.zoomExtra = 0;
    crop.offsetX = 0;
    crop.offsetY = 0;
    stopCropInertia();
    finishCropAnim();
    showScreen('crop');
    // 等转场布局稳定后再算尺寸
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!cropSyncCanvasSize()) return;
        var to = cropInitViewTarget();
        // 开场：整图铺满裁切框，再动画收到初始区域
        cropSetRect(to.cropX, to.cropY, to.cropW, to.cropH);
        crop.zoomExtra = 0;
        crop.offsetX = 0;
        crop.offsetY = 0;
        cropComputeMinScale();
        cropClampOffset();
        drawCrop();
        syncCropRatioChips();
        syncCropZoomSlider(0);
        crop.initSnapshot = cropSnapshotOf(to);
        cropTween(to, 320, function () {
          syncCropZoomSlider(crop.zoomExtra);
        });
      });
    });
  }

  function closeCrop() {
    stopCropInertia();
    cancelCropAnim();
    if (currentRoute() === 'crop') goBack();
  }

  // 整图回正：裁切框贴合图片比例，图片刚好铺满框（框与图同大）
  function cropFullImageTarget() {
    var s = crop;
    var img = s.image;
    var nw = img.naturalWidth;
    var nh = img.naturalHeight;
    var f = cropFrameForRatio(nw / nh, false);
    return {
      cropW: f.w,
      cropH: f.h,
      cropX: (s.vw - f.w) / 2,
      cropY: (s.vh - f.h) / 2,
      zoomExtra: 0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      flipX: 1
    };
  }

  function resetCrop() {
    if (!crop.image) return;
    stopCropInertia();
    finishCropAnim();
    crop.ratioId = 'orig';
    syncCropRatioChips();
    var to = cropFullImageTarget();
    // 旋转走最短路径回正（始终对齐到 90° 网格）
    var twoPi = Math.PI * 2;
    var cur = snapCropRotation(crop.rotation);
    crop.rotation = cur;
    var d = to.rotation - cur;
    to.rotation = cur + d - twoPi * Math.round(d / twoPi);
    syncCropZoomSlider(0);
    cropTween(to, 280, function () {
      crop.rotation = 0;
      syncCropZoomSlider(crop.zoomExtra);
    }, { scaleRotation: 0 });
  }

  function applyCrop() {
    var s = crop;
    if (!s.image) return;
    stopCropInertia();
    // 动画中途点应用：先落到终态再取结果
    finishCropAnim();
    if (cropSameAsInit()) { closeCrop(); return; }

    var rect = cropToSourceRect({ x: s.cropX, y: s.cropY, w: s.cropW, h: s.cropH });
    // 恰好覆盖全图 → 等价于还原原图，直接回填源图，避免重新编码
    if (rect.x <= 0.002 && rect.y <= 0.002 && rect.w >= 0.996 && rect.h >= 0.996) {
      closeCrop();
      state.cropRect = null;
      if (state.image !== s.image) adoptImage(s.image, { keepSource: true });
      toast('已还原原图');
      return;
    }

    var k = 1 / s.scale; // 屏幕上 1px 对应的源图像素
    var outW = Math.round(s.cropW * k);
    var outH = Math.round(s.cropH * k);
    var cap = CROP_MAX_OUT / Math.max(outW, outH);
    if (cap < 1) { outW = Math.round(outW * cap); outH = Math.round(outH * cap); k *= cap; }
    outW = Math.max(1, outW);
    outH = Math.max(1, outH);

    var c = document.createElement('canvas');
    c.width = outW;
    c.height = outH;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(k, 0, 0, k, -s.cropX * k, -s.cropY * k);
    cropDrawImage(ctx);

    var finish = function (blob) {
      if (!blob) { toast('裁切失败'); return; }
      var file = new File([blob], 'crop.png', { type: 'image/png' });
      closeCrop();
      // 累积记录本次裁切区域，下次打开裁切页就基于它
      state.cropRect = rect;
      loadFile(file, { keepSource: true });
      toast('已应用裁切');
    };
    if (c.toBlob) {
      c.toBlob(finish, 'image/png');
    } else {
      try {
        var dataUrl = c.toDataURL('image/png');
        var bin = atob(dataUrl.split(',')[1]);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        finish(new Blob([arr], { type: 'image/png' }));
      } catch (err) {
        toast('裁切失败');
      }
    }
  }
  function roundRectPath(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function contrastInk(hex) {
    // 相对亮度，保证色块内文字与背景有足够反差
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    var y = (r * 299 + g * 587 + b * 114) / 1000;
    if (y >= 170) return '#1a1a1a';
    if (y <= 90) return '#ffffff';
    return y >= 140 ? '#111111' : '#ffffff';
  }

  // 写入 JPEG JFIF 密度，便于打印按 DPI 还原真实尺寸
  function jpegDataUrlWithDpi(dataUrl, dpi) {
    try {
      var parts = dataUrl.split(',');
      if (parts.length < 2 || dataUrl.indexOf('image/jpeg') < 0) return dataUrl;
      var bin = atob(parts[1]);
      var bytes = new Uint8Array(bin.length);
      var i;
      for (i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      // SOI + APP0 JFIF
      if (bytes.length < 20 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return dataUrl;
      var off = 2;
      if (bytes[off] !== 0xff || bytes[off + 1] !== 0xe0) return dataUrl;
      // APP0: FF E0 | lenHi lenLo | 'J','F','I','F',0 | ver | units | Xdens | Ydens
      var jfif = off + 4;
      if (bytes[jfif] !== 0x4a || bytes[jfif + 1] !== 0x46) return dataUrl;
      var densOff = jfif + 7; // units at +7, X at +8,+9, Y at +10,+11 relative to JFIF start... 
      // jfif+5,6 = version; jfif+7 = units; jfif+8,9 = X; jfif+10,11 = Y
      bytes[jfif + 7] = 1; // 1 = DPI
      bytes[jfif + 8] = (dpi >> 8) & 0xff;
      bytes[jfif + 9] = dpi & 0xff;
      bytes[jfif + 10] = (dpi >> 8) & 0xff;
      bytes[jfif + 11] = dpi & 0xff;
      var chunk = 0x8000;
      var out = '';
      for (i = 0; i < bytes.length; i += chunk) {
        var slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
        out += String.fromCharCode.apply(null, slice);
      }
      return 'data:image/jpeg;base64,' + btoa(out);
    } catch (err) {
      return dataUrl;
    }
  }

  function exportLegendList(useIdx, rect) {
    var counts = state.counts || {};
    var list = Object.keys(counts).map(function (k) { return counts[k]; });
    list.sort(function (a, b) { return b.n - a.n; });
    if (useIdx < 0) return list;
    var local = {};
    var yy;
    var xx;
    for (yy = rect.y0; yy < rect.y1; yy++) {
      for (xx = rect.x0; xx < rect.x1; xx++) {
        var cc = state.gridData[yy * state.width + xx];
        if (isEmptyCell(cc) || !cc.code) continue;
        local[cc.code] = (local[cc.code] || 0) + 1;
      }
    }
    return list.filter(function (it) { return local[it.code]; }).map(function (it) {
      return { code: it.code, hex: it.hex, n: local[it.code] };
    });
  }

  function measureExport(cell, pw, ph, legendCount, axes, showLegend, showMeta) {
    var pad = Math.max(36, Math.round(cell * 0.7));
    var padBottom = Math.max(pad + 24, Math.round(cell * 1.4));
    var axisTop = axes ? Math.max(28, Math.round(cell * 0.85)) : 0;
    var axisLeft = axes ? Math.max(40, Math.round(cell * 1.0)) : 0;
    var axisBottom = axes ? axisTop : 0;
    var axisRight = axes ? axisLeft : 0;
    var titleSize = Math.max(28, Math.round(cell * 0.58));
    var subSize = Math.max(18, Math.round(cell * 0.4));
    var tipSize = Math.max(14, Math.round(cell * 0.3));
    var metaH = showMeta
      ? Math.round(titleSize * 1.05 + subSize * 1.25 + tipSize * 2.1 + 20)
      : 0;
    // 色块边长 = 2×2 格（四个像素格）
    var sw = Math.max(48, cell * 2);
    var itemGapX = Math.max(16, Math.round(sw * 0.22));
    var itemGapY = Math.max(18, Math.round(sw * 0.28));
    var countGap = Math.max(8, Math.round(sw * 0.12));
    var countH = Math.max(22, Math.round(sw * 0.36));
    var itemH = sw + countGap + countH;
    var itemW = sw;
    var patternW = pw * cell;
    var patternH = ph * cell;
    var outW = pad + axisLeft + patternW + axisRight + pad;
    var innerW = outW - pad * 2;
    var maxCols = showLegend && legendCount
      ? Math.max(1, Math.floor((innerW + itemGapX) / (itemW + itemGapX)))
      : 1;
    var legendCols = showLegend && legendCount ? Math.min(maxCols, legendCount) : 1;
    var legendRows = showLegend && legendCount ? Math.ceil(legendCount / legendCols) : 0;
    var legendTop = pad + metaH + axisTop + patternH + axisBottom +
      (legendRows ? Math.round(cell * 0.55) : 0);
    var legendH = legendRows ? legendRows * (itemH + itemGapY) - itemGapY : 0;
    var outH = (showLegend && legendCount)
      ? legendTop + legendH + padBottom
      : pad + metaH + axisTop + patternH + axisBottom + padBottom;
    return {
      pad: pad,
      padBottom: padBottom,
      axisTop: axisTop,
      axisLeft: axisLeft,
      axisBottom: axisBottom,
      axisRight: axisRight,
      metaH: metaH,
      titleSize: titleSize,
      subSize: subSize,
      tipSize: tipSize,
      sw: sw,
      swR: Math.max(8, Math.round(sw * 0.18)),
      itemGapX: itemGapX,
      itemGapY: itemGapY,
      countGap: countGap,
      itemH: itemH,
      legendCols: legendCols,
      legendRows: legendRows,
      legendTop: legendTop,
      outW: outW,
      outH: outH
    };
  }

  function pickExportCell(pw, ph, legendCount, axes, showLegend, showMeta) {
    var cell = EXPORT_CELL;
    var n;
    for (n = 0; n < 8; n++) {
      var sz = measureExport(cell, pw, ph, legendCount, axes, showLegend, showMeta);
      var area = sz.outW * sz.outH;
      if (sz.outW <= MAX_EXPORT_SIDE && sz.outH <= MAX_EXPORT_SIDE && area <= MAX_EXPORT_AREA) {
        return cell;
      }
      var s = Math.min(
        MAX_EXPORT_SIDE / sz.outW,
        MAX_EXPORT_SIDE / sz.outH,
        Math.sqrt(MAX_EXPORT_AREA / Math.max(1, area))
      );
      cell = Math.max(8, Math.floor(cell * Math.min(0.98, s)));
    }
    return cell;
  }

  function exportDataUrl(boardIdx) {
    var exp = state.exp;
    var axes = !!exp.axes;
    var showLegend = !!exp.legend;
    var showMeta = !!exp.meta;
    var useIdx = boardIdx == null ? state.boardIndex : boardIdx;

    var rect = boardRect(useIdx);
    var pw = rect.x1 - rect.x0;
    var ph = rect.y1 - rect.y0;
    var list = exportLegendList(useIdx, rect);
    var cell = pickExportCell(pw, ph, list.length, axes, showLegend, showMeta);
    var m = measureExport(cell, pw, ph, list.length, axes, showLegend, showMeta);

    var pattern = document.createElement('canvas');
    var pctx = pattern.getContext('2d');
    drawPattern(pctx, cell, state.showGrid, rect, true);

    var outW = m.outW;
    var outH = m.outH;
    var out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    if (out.width !== outW || out.height !== outH) {
      throw new Error('export-too-large');
    }
    var octx = out.getContext('2d');
    if (!octx) throw new Error('export-too-large');
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, outW, outH);

    var pad = m.pad;
    var x0 = pad + m.axisLeft;
    var y0 = pad + m.metaH + m.axisTop;

    if (showMeta) {
      var titleSize = m.titleSize;
      var subSize = m.subSize;
      var tipSize = m.tipSize;
      octx.fillStyle = '#1a1a1a';
      octx.font = 'bold ' + titleSize + 'px sans-serif';
      octx.fillText('兔格拼豆 · ' + getPalette().name, pad, pad + Math.round(titleSize * 0.95));
      octx.font = subSize + 'px sans-serif';
      octx.fillStyle = '#444';
      var title = state.width + '×' + state.height + ' · ' +
        (useIdx < 0 ? '全图' : '第' + (useIdx + 1) + '板') +
        ' · 每格' + BEAD_MM + 'mm';
      if (axes) title += ' · 坐标版';
      if (cell < EXPORT_CELL) title += ' · 已缩小导出';
      octx.fillText(title, pad, pad + titleSize + Math.round(subSize * 1.15));
      octx.fillStyle = '#777';
      octx.font = tipSize + 'px sans-serif';
      octx.fillText('打印请选「实际大小 / 100%」，勿勾选适应页面（' + PRINT_DPI + ' DPI）', pad, pad + titleSize + subSize + Math.round(tipSize * 1.9));
    }

    octx.drawImage(pattern, x0, y0);

    if (axes && pw > 0 && ph > 0) {
      // 字号先按格宽的 42% 取（下限 16px，与 H5 原口径一致），再压到「一格装得下」：
      // 格子被缩小导出时（cell 会掉到 20 以下）字号不跟着缩，相邻标号就会叠在一起。
      // 压到看不清（< 11px）就不再缩了 —— 改成跳格标号，刻度短线仍然每格都画。
      var AX_READABLE = 11;
      var axFont = function (size) { return size + 'px sans-serif'; };
      var axWidth = function (text, size) {
        octx.font = axFont(size);
        return octx.measureText(text).width;
      };
      var axLabeling = function (widest) {
        var ideal = Math.max(16, cell * 0.42);
        var fit = Math.min(ideal, cell * 0.72);
        var w0 = axWidth(widest, ideal);
        if (w0 > 0) fit = Math.min(fit, ideal * cell * 0.88 / w0);
        if (fit >= AX_READABLE) return { font: fit, step: 1 };
        return {
          font: AX_READABLE,
          step: Math.max(1,
            Math.ceil(AX_READABLE * 1.25 / Math.max(1, cell)),
            Math.ceil(axWidth(widest, AX_READABLE) / Math.max(1, cell * 0.9)))
        };
      };
      // 列号取位数列（最后一个）、行号取位行号：它们的宽度决定字号能有多大。
      var colLabels = axLabeling(String(rect.x0 + pw));
      var rowLabels = axLabeling(String(rect.y0 + ph));
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillStyle = '#333';
      var i;
      var j;
      octx.font = axFont(colLabels.font);
      for (i = 0; i < pw; i += colLabels.step) {
        octx.fillText(String(rect.x0 + i + 1), x0 + i * cell + cell / 2, y0 - m.axisTop / 2 - 1);
      }
      for (i = 0; i < pw; i++) {
        var colCx = x0 + i * cell + cell / 2;
        octx.fillStyle = 'rgba(0,0,0,0.08)';
        octx.fillRect(colCx - 0.5, y0 - 2, 1, 4);
        octx.fillStyle = '#333';
      }
      octx.textAlign = 'right';
      octx.font = axFont(rowLabels.font);
      for (j = 0; j < ph; j += rowLabels.step) {
        octx.fillText(String(rect.y0 + j + 1), x0 - 8, y0 + j * cell + cell / 2);
      }
      for (j = 0; j < ph; j++) {
        var rowCy = y0 + j * cell + cell / 2;
        octx.fillStyle = 'rgba(0,0,0,0.08)';
        octx.fillRect(x0 - 2, rowCy - 0.5, 4, 1);
        octx.fillStyle = '#333';
      }

      // 下方列号与右侧行号：每个刻度都和对应格子中心对齐。
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.font = axFont(colLabels.font);
      for (i = 0; i < pw; i += colLabels.step) {
        octx.fillText(
          String(rect.x0 + i + 1),
          x0 + i * cell + cell / 2,
          y0 + ph * cell + m.axisBottom / 2
        );
      }
      for (i = 0; i < pw; i++) {
        var bottomCx = x0 + i * cell + cell / 2;
        octx.fillStyle = 'rgba(0,0,0,0.08)';
        octx.fillRect(bottomCx - 0.5, y0 + ph * cell - 2, 1, 4);
        octx.fillStyle = '#333';
      }

      octx.textAlign = 'left';
      octx.font = axFont(rowLabels.font);
      for (j = 0; j < ph; j += rowLabels.step) {
        octx.fillText(
          String(rect.y0 + j + 1),
          x0 + pw * cell + 8,
          y0 + j * cell + cell / 2
        );
      }
      for (j = 0; j < ph; j++) {
        var rightCy = y0 + j * cell + cell / 2;
        octx.fillStyle = 'rgba(0,0,0,0.08)';
        octx.fillRect(x0 + pw * cell - 2, rightCy - 0.5, 4, 1);
        octx.fillStyle = '#333';
      }
      octx.textAlign = 'start';
      octx.textBaseline = 'alphabetic';
    }

    if (showLegend && list.length) {
      var sw = m.sw;
      var swR = m.swR;
      var codeFont = Math.max(20, Math.round(sw * 0.42));
      var countFont = Math.max(16, Math.round(sw * 0.32));
      for (var k = 0; k < list.length; k++) {
        var item = list[k];
        var col = k % m.legendCols;
        var row = (k / m.legendCols) | 0;
        var lx = pad + col * (sw + m.itemGapX);
        var ly = m.legendTop + row * (m.itemH + m.itemGapY);
        octx.fillStyle = item.hex;
        roundRectPath(octx, lx, ly, sw, sw, swR);
        octx.fill();
        octx.strokeStyle = 'rgba(0,0,0,0.14)';
        octx.lineWidth = Math.max(1, Math.round(sw * 0.02));
        roundRectPath(octx, lx + 0.5, ly + 0.5, sw - 1, sw - 1, swR);
        octx.stroke();
        octx.fillStyle = contrastInk(item.hex);
        octx.font = '700 ' + codeFont + 'px sans-serif';
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillText(item.code, lx + sw / 2, ly + sw / 2 + 1);
        octx.fillStyle = '#444';
        octx.font = '600 ' + countFont + 'px sans-serif';
        octx.textBaseline = 'top';
        octx.fillText(String(item.n), lx + sw / 2, ly + sw + m.countGap);
      }
      octx.textAlign = 'start';
      octx.textBaseline = 'alphabetic';
    }

    var area = outW * outH;
    var quality = area > 8000000 ? 0.72 : area > 3500000 ? 0.82 : 0.92;
    var dataUrl = out.toDataURL('image/jpeg', quality);
    if (!dataUrl || dataUrl.length < 64 || dataUrl.indexOf('base64') < 0) {
      throw new Error('export-too-large');
    }
    // 超大图跳过 DPI 改写，避免 atob/btoa 再翻倍内存
    if (dataUrl.length < 1800000) dataUrl = jpegDataUrlWithDpi(dataUrl, PRINT_DPI);
    return dataUrl;
  }

  function friendlySaveError(err, fallback) {
    var raw = '';
    if (err) {
      if (typeof err === 'string') raw = err;
      else raw = err.errMsg || err.message || '';
    }
    var s = String(raw).toLowerCase();
    if (s.indexOf('export-too-large') >= 0 || s.indexOf('too large') >= 0 ||
        s.indexOf('filesize') >= 0 || s.indexOf('file size') >= 0 ||
        s.indexOf('maximum') >= 0 || s.indexOf('memory') >= 0 ||
        s.indexOf('canvas') >= 0 || s.indexOf('length') >= 0 ||
        s.indexOf('oom') >= 0 || s.indexOf('limit') >= 0) {
      return '图纸太大，请改用「分板逐个导出」';
    }
    if (s.indexOf('auth') >= 0 || s.indexOf('permission') >= 0 ||
        s.indexOf('denied') >= 0 || s.indexOf('权限') >= 0) {
      return '需要相册权限才能保存';
    }
    if (s.indexOf('cancel') >= 0) return '已取消';
    return fallback || '保存失败';
  }

  // 本次导出里「只能靠长按保存」的图纸（无原生桥的容器）
  var manualSaves = [];

  // 快手小程序/小游戏环境（若容器注入了 ks，就能真正存相册）。
  // 需要 writeFile 把 base64 落成本地文件——ks.saveImageToPhotosAlbum 不收网络地址，也不收 data:。
  function ksSaveBridge() {
    var ks = window.ks;
    if (!ks) return null;
    if (typeof ks.saveImageToPhotosAlbum !== 'function') return null;
    if (typeof ks.getFileSystemManager !== 'function') return null;
    return ks;
  }

  function hasSaveBridge() {
    var xhs = window.xhs && window.xhs.miniTool;
    if (xhs && typeof xhs.saveImageToPhotosAlbum === 'function') return true;
    return !!ksSaveBridge();
  }

  function ksSaveDataUrl(ks, dataUrl) {
    return new Promise(function (resolve, reject) {
      var base = ks.env && ks.env.USER_DATA_PATH;
      var comma = dataUrl.indexOf(',');
      if (!base) { reject(new Error('ks-no-user-data-path')); return; }
      if (comma < 0) { reject(new Error('bad-data-url')); return; }
      var fs;
      try { fs = ks.getFileSystemManager(); } catch (e) { fs = null; }
      if (!fs || typeof fs.writeFile !== 'function') { reject(new Error('ks-no-fs')); return; }
      var filePath = base + '/rabbit-bead-' + Date.now() + '.jpg';
      fs.writeFile({
        filePath: filePath,
        data: dataUrl.slice(comma + 1),
        encoding: 'base64',
        success: function () {
          ks.saveImageToPhotosAlbum({
            filePath: filePath,
            success: function (res) { resolve(res || {}); },
            fail: function (err) { reject(err || new Error('ks-save-fail')); }
          });
        },
        fail: function (err) { reject(err || new Error('ks-write-fail')); }
      });
    });
  }

  // data: URL → Blob（atob 手撸，不用 fetch —— 打包脚本会对 fetch 关键字告警）
  function dataUrlToBlob(dataUrl) {
    var comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    var head = dataUrl.slice(0, comma);
    var payload = dataUrl.slice(comma + 1);
    if (head.indexOf('base64') < 0) return null;
    var bin = atob(payload);
    var len = bin.length;
    var arr = new Uint8Array(len);
    for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    var mime = (head.slice(5).split(';')[0]) || 'image/jpeg';
    return new Blob([arr], { type: mime });
  }

  // 下载兜底：必须走 blob: URL。直接把 data: URL 挂在 <a download> 上，
  // Safari / 容器 webview 不认 download 属性，点下去就当场导航到这张图。
  function triggerDownload(dataUrl, filename) {
    var href = dataUrl;
    var objectUrl = null;
    try {
      var blob = dataUrlToBlob(dataUrl);
      if (blob) { objectUrl = URL.createObjectURL(blob); href = objectUrl; }
    } catch (e) { objectUrl = null; }
    var a = document.createElement('a');
    a.href = href;
    a.download = filename || 'rabbit-bead.jpg';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (objectUrl) setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 5000);
  }

  function saveOneDataUrl(dataUrl, filename) {
    var xhs = window.xhs && window.xhs.miniTool;
    if (xhs && xhs.saveImageToPhotosAlbum) {
      var save = function (filePath) {
        return xhs.saveImageToPhotosAlbum({ filePath: filePath });
      };
      if (xhs.writeTempFile) {
        return xhs.writeTempFile({ data: dataUrl }).then(function (res) {
          return save(res.filePath);
        });
      }
      return save(dataUrl);
    }
    // 快手若注入了 ks 桥：写临时文件 → 存相册；失败再退到长按，别让用户白点
    var ks = ksSaveBridge();
    if (ks) {
      return ksSaveDataUrl(ks, dataUrl).catch(function () {
        manualSaves.push({ dataUrl: dataUrl, filename: filename || 'rabbit-bead.jpg' });
        return 'manual';
      });
    }
    // 本地预览（localhost / file）走下载，方便调样式
    if (isPreviewHost()) {
      triggerDownload(dataUrl, filename);
      return Promise.resolve('download');
    }
    // 容器里既没有存相册桥、a[download] 又不落地（实测点了没反应）：
    // 收起来交给「长按保存」浮层，绝不在这里假装成功。
    manualSaves.push({ dataUrl: dataUrl, filename: filename || 'rabbit-bead.jpg' });
    return Promise.resolve('manual');
  }

  var saveTipItems = [];
  var saveTipShareIdx = 0;

  function closeSaveTip() {
    if (!els.saveTip) return;
    els.saveTip.classList.remove('is-on');
    els.saveTip.setAttribute('aria-hidden', 'true');
    if (els.saveTipList) els.saveTipList.innerHTML = '';
    saveTipItems = [];
    manualSaves = [];
  }

  // 系统分享（Web Share Level 2）：宿主实现了才显示按钮。
  // 用它能把图丢进系统面板，Android/iOS 面板里通常有「存储到相册 / 保存图片」。
  // 宿主没实现时 canShare 返回 false —— 按钮直接不出现，不给用户「点了没反应」的假按钮。
  function canShareFile(item) {
    if (typeof navigator === 'undefined') return false;
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
    try {
      var blob = dataUrlToBlob(item.dataUrl);
      if (!blob) return false;
      var file = new File([blob], item.filename || 'rabbit-bead.jpg', { type: blob.type || 'image/jpeg' });
      return !!navigator.canShare({ files: [file] });
    } catch (e) {
      return false;
    }
  }

  function syncSaveTipShareBtn() {
    if (!els.saveTipShare) return;
    var useable = saveTipItems.length > 0 && canShareFile(saveTipItems[0]);
    els.saveTipShare.hidden = !useable;
    if (!useable) return;
    els.saveTipShare.textContent = saveTipItems.length > 1
      ? ('系统分享 ' + (Math.min(saveTipShareIdx + 1, saveTipItems.length)) + '/' + saveTipItems.length)
      : '系统分享';
  }

  // 长按保存浮层：把导出的图纸原图摆出来，靠系统菜单保存
  function openSaveTip(items) {
    if (!els.saveTip || !els.saveTipList) return;
    saveTipItems = items;
    saveTipShareIdx = 0;
    els.saveTipList.innerHTML = '';
    var i;
    for (i = 0; i < items.length; i++) {
      var img = document.createElement('img');
      img.alt = items.length > 1 ? ('第 ' + (i + 1) + ' 板图纸') : '拼豆图纸';
      img.src = items[i].dataUrl;
      els.saveTipList.appendChild(img);
    }
    if (els.saveTipText) {
      els.saveTipText.textContent = items.length > 1
        ? ('共 ' + items.length + ' 张，逐张长按 → 选「保存图片」；没有菜单就截图保存')
        : '长按下方图纸 → 选「保存图片」；没有菜单就截图保存';
    }
    syncSaveTipShareBtn();
    els.saveTip.classList.add('is-on');
    els.saveTip.setAttribute('aria-hidden', 'false');
  }

  function setExportBusy(on, text) {
    if (!els.exportBusy) return;
    if (on) {
      if (els.exportBusyText) els.exportBusyText.textContent = text || '正在导出图纸，请勿退出';
      els.exportBusy.classList.add('is-on');
      els.exportBusy.setAttribute('aria-hidden', 'false');
    } else {
      els.exportBusy.classList.remove('is-on');
      els.exportBusy.setAttribute('aria-hidden', 'true');
    }
  }

  function saveToAlbum() {
    if (!state.gridData || state.busy) return;
    manualSaves = [];
    state.busy = true;
    els.btnSave.disabled = true;
    els.exportGo.disabled = true;
    if (els.exportShare) els.exportShare.disabled = true;

    var total = state.boardsX * state.boardsY;
    var boardMode = state.exp.boardMode || 'full';
    var useEach = boardMode === 'each' && total > 1;
    setExportBusy(true, useEach
      ? ('正在导出 1/' + total + '，请勿退出')
      : '正在导出图纸，请勿退出');

    function done(ok, msg) {
      setExportBusy(false);
      state.busy = false;
      els.btnSave.disabled = false;
      els.exportGo.disabled = false;
      if (els.exportShare) els.exportShare.disabled = false;
      // 没有存相册桥：不能说「已保存到相册」——图还在页面里，等用户长按保存
      if (ok && manualSaves.length) {
        var list = manualSaves.slice();
        closeSaveTip();
        openSaveTip(list);
        return;
      }
      toast(ok ? (msg || '已保存到相册') : (msg || '保存失败'));
    }

    function run() {
      if (!useEach) {
        try {
          var dataUrl = exportDataUrl(-1);
          setExportBusy(true, hasSaveBridge() ? '正在保存到相册，请勿退出' : '正在生成图纸，请勿退出');
          saveOneDataUrl(dataUrl, 'rabbit-bead-full.jpg').then(function () {
            done(true);
          }).catch(function (err) {
            done(false, friendlySaveError(err, '保存失败'));
          });
        } catch (err) {
          done(false, friendlySaveError(err, '图纸太大，请改用「分板逐个导出」'));
        }
        return;
      }

      var idx = 0;
      function next() {
        if (idx >= total) {
          done(true, '已导出 ' + total + ' 张分板图纸');
          return;
        }
        var boardNo = idx + 1;
        setExportBusy(true, '正在导出 ' + boardNo + '/' + total + '，请勿退出');
        var url;
        try {
          url = exportDataUrl(idx);
        } catch (err) {
          done(false, friendlySaveError(err, '第' + boardNo + '板过大，导出失败'));
          return;
        }
        var name = 'rabbit-bead-board-' + boardNo + '.jpg';
        saveOneDataUrl(url, name).then(function () {
          idx += 1;
          setTimeout(next, 180);
        }).catch(function (err) {
          done(false, friendlySaveError(err, '第' + boardNo + '板保存失败'));
        });
      }
      next();
    }

    // 先画出遮罩再跑重计算，避免卡死在空白屏
    setTimeout(run, 60);
  }

  function hasPostNote() {
    return !!(window.xhs && window.xhs.miniTool && window.xhs.miniTool.postNote);
  }

  // 本地预览（localhost / file）下也显示按钮，方便调样式；正式环境仅在有桥时显示
  function isPreviewHost() {
    var h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '' || location.protocol === 'file:';
  }

  // 发布笔记按钮仅在小红书等支持 postNote 的环境显示
  function syncShareBtn() {
    if (els.exportShare) els.exportShare.hidden = !(hasPostNote() || isPreviewHost());
  }

  function countBeads() {
    var n = 0;
    var i;
    var grid = state.gridData;
    if (!grid) return 0;
    for (i = 0; i < grid.length; i++) {
      if (!isEmptyCell(grid[i])) n += 1;
    }
    return n;
  }

  function previewShareDataUrl() {
    var rect = { x0: 0, y0: 0, x1: state.width, y1: state.height };
    var side = Math.max(state.width, state.height);
    var cell = Math.max(8, Math.min(32, Math.floor(1600 / Math.max(1, side))));
    var pattern = document.createElement('canvas');
    var pctx = pattern.getContext('2d');
    drawPattern(pctx, cell, !!state.showGrid, rect, false);
    var pad = 20;
    var out = document.createElement('canvas');
    out.width = pattern.width + pad * 2;
    out.height = pattern.height + pad * 2;
    if (!out.width || !out.height) throw new Error('export-too-large');
    var octx = out.getContext('2d');
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(pattern, pad, pad);
    var dataUrl = out.toDataURL('image/jpeg', 0.86);
    if (!dataUrl || dataUrl.indexOf('base64') < 0) throw new Error('export-too-large');
    return dataUrl;
  }

  function shareToNote() {
    if (!state.gridData || state.busy) return;
    if (!hasPostNote()) {
      toast('请在小红书内发布笔记');
      return;
    }
    state.busy = true;
    els.btnSave.disabled = true;
    els.exportGo.disabled = true;
    if (els.exportShare) els.exportShare.disabled = true;

    var total = state.boardsX * state.boardsY;
    var boardMode = state.exp.boardMode || 'full';
    var useEach = boardMode === 'each' && total > 1;
    var maxCharts = 17;
    setExportBusy(true, '正在准备笔记图片，请勿退出');

    function done(ok, msg) {
      setExportBusy(false);
      state.busy = false;
      els.btnSave.disabled = false;
      els.exportGo.disabled = false;
      if (els.exportShare) els.exportShare.disabled = false;
      toast(ok ? (msg || '已打开发笔记') : (msg || '发笔记失败'));
    }

    function run() {
      var images;
      try {
        setExportBusy(true, '正在生成预览图，请勿退出');
        images = [{ url: previewShareDataUrl() }];
        if (useEach) {
          var n = Math.min(total, maxCharts);
          var i;
          for (i = 0; i < n; i++) {
            setExportBusy(true, '正在生成图纸 ' + (i + 1) + '/' + n + '，请勿退出');
            images.push({ url: exportDataUrl(i) });
          }
        } else {
          setExportBusy(true, '正在生成图纸，请勿退出');
          images.push({ url: exportDataUrl(-1) });
        }
      } catch (err) {
        done(false, friendlySaveError(err, '图片过大，请改分板后再发'));
        return;
      }

      var colors = Object.keys(state.counts || {}).length;
      var title = ('兔格拼豆 ' + state.width + '×' + state.height).slice(0, 20);
      var content = getPalette().name + ' · ' + state.width + '×' + state.height +
        ' · ' + colors + '色 · ' + countBeads() + '颗。第1张为效果预览，其后为色号图纸。';
      if (useEach && total > maxCharts) {
        content += '图纸已截取前' + maxCharts + '板（笔记最多18张图）。';
      }

      setExportBusy(true, '正在打开发笔记，请勿退出');
      window.xhs.miniTool.postNote({
        title: title,
        content: content,
        pageType: 'photo_publish',
        mediaInfo: { image_resources: images }
      }).then(function () {
        done(true, '已打开发笔记');
      }).catch(function (err) {
        done(false, friendlySaveError(err, '发笔记失败，可先保存图纸'));
      });
    }

    setTimeout(run, 60);
  }

  function setChip(btn, on) {
    if (!btn) return;
    if (on) {
      btn.classList.add('on');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('on');
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  // ---------- 预览交互：手势 / 2D/3D 切换 / 导出选项 ----------
  var hintTimer = null;
  function showPreviewHint(text) {
    if (!text) {
      els.viewHint.textContent = '';
      els.viewHint.classList.remove('show');
      return;
    }
    els.viewHint.textContent = text;
    els.viewHint.classList.add('show');
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      els.viewHint.classList.remove('show');
    }, 3600);
  }

  var rafId = 0;
  function requestRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      renderPreview();
    });
  }

  function twoPtList() {
    var ids = Object.keys(gd.pointers);
    if (ids.length < 2) return null;
    var a = gd.pointers[ids[0]];
    var b = gd.pointers[ids[1]];
    return {
      ax: a.x, ay: a.y, bx: b.x, by: b.y,
      mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
      d: Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y))
    };
  }

  function zoomAt2d(cx, cy, factor) {
    if (!state.gridData || state.view.mode !== '2d' || fit2dAnim) return;
    var minS = state.view.fitS || 1;
    var s0 = state.view.s || minS;
    var s1;
    if (factor) {
      s1 = Math.max(minS, Math.min(MAX_ZOOM, s0 * factor));
      var wx = (cx - state.view.tx) / s0;
      var wy = (cy - state.view.ty) / s0;
      state.view.s = s1;
      state.view.tx = cx - wx * s1;
      state.view.ty = cy - wy * s1;
      clampView2d();
      renderPreview();
      return;
    }
    // 双击：放大则回落到铺满，否则放大两档（均带动画）
    if (s0 > minS * 1.35) {
      animateFit2d();
      return;
    }
    s1 = Math.max(minS * 1.01, Math.min(MAX_ZOOM, s0 * 2.3));
    animateZoom2d(cx, cy, s1);
  }

  function zoomAt3d(factor) {
    if (!state.gridData || state.view.mode !== '3d' || morphAnim || zoom3dAnim) return;
    var s3 = state.view3d;
    var z0 = s3.zoom == null ? 1 : s3.zoom;
    s3.zoom = Math.max(0.45, Math.min(3.5, z0 * factor));
    renderPreview();
  }

  function animateZoom3d(z1) {
    if (!state.gridData || state.view.mode !== '3d' || morphAnim || zoom3dAnim) return;
    var s3 = state.view3d;
    var z0 = s3.zoom == null ? 1 : s3.zoom;
    z1 = Math.max(0.45, Math.min(3.5, z1));
    if (Math.abs(z0 - z1) < 0.02) return;
    zoom3dAnim = {
      t0: performance.now(),
      dur: 380,
      z0: z0,
      z1: z1
    };
    tickZoom3d();
  }

  function tickZoom3d() {
    if (!zoom3dAnim) return;
    var a = zoom3dAnim;
    var t = (performance.now() - a.t0) / a.dur;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var e = easeInOut(t);
    state.view3d.zoom = a.z0 + (a.z1 - a.z0) * e;
    renderPreview();
    if (t < 1) {
      requestAnimationFrame(tickZoom3d);
      return;
    }
    zoom3dAnim = null;
    state.view3d.zoom = a.z1;
    renderPreview();
  }

  function zoomToggle3d() {
    if (!state.gridData || state.view.mode !== '3d' || morphAnim) return;
    var z0 = state.view3d.zoom == null ? 1 : state.view3d.zoom;
    animateZoom3d(z0 > 1.35 ? 1 : 2.2);
  }

  function syncModeUI() {
    var is3 = state.view.mode === '3d';
    els.btn3d.textContent = is3 ? '2D' : '3D';
    els.btn3d.classList.toggle('vt-on', is3);
    els.btn3d.setAttribute('aria-pressed', is3 ? 'true' : 'false');
    // 手绘条与 3D↔2D 同开同合、走高度动画；不要 immediate，否则会把展开动画掐掉
    refreshEditUI();
  }

  // 锚点插值：插值「视口中心对应的内容坐标」+ 缩放，避免 s/tx/ty 各自线性插值导致跳动
  function startView2dAnim(s1, wx1, wy1, dur) {
    if (morphAnim) return;
    var v = viewportSize();
    var s0 = state.view.s || 1;
    var tx0 = state.view.tx || 0;
    var ty0 = state.view.ty || 0;
    var wx0 = (v.vw / 2 - tx0) / s0;
    var wy0 = (v.vh / 2 - ty0) / s0;
    if (Math.abs(s0 - s1) < 0.002 && Math.abs(wx0 - wx1) < 0.05 && Math.abs(wy0 - wy1) < 0.05) {
      state.view.s = s1;
      state.view.tx = v.vw / 2 - wx1 * s1;
      state.view.ty = v.vh / 2 - wy1 * s1;
      clampView2d();
      renderPreview();
      return;
    }
    fit2dAnim = {
      t0: performance.now(),
      dur: dur || 400,
      s0: s0,
      s1: s1,
      wx0: wx0,
      wy0: wy0,
      wx1: wx1,
      wy1: wy1,
      vw: v.vw,
      vh: v.vh
    };
    tickFit2d();
  }

  function animateFit2d() {
    if (!state.gridData || state.view.mode !== '2d') {
      fitView();
      return;
    }
    var m = previewMetrics();
    var v = viewportSize();
    if (!m.pw || !m.ph) return;
    var fitS = Math.min(v.vw / m.cw, v.vh / m.ch);
    state.view.fitS = fitS;
    // 终点：内容中心对准视口中心
    startView2dAnim(fitS, m.cw / 2, m.ch / 2, 420);
  }

  function animateZoom2d(cx, cy, s1) {
    if (!state.gridData || state.view.mode !== '2d') return;
    var s0 = state.view.s || 1;
    var tx0 = state.view.tx;
    var ty0 = state.view.ty;
    var v = viewportSize();
    // 终点：双击点下的内容坐标尽量保持不动，再把这个终点夹进合法范围。
    // 关键顺序是「先夹紧终点，再动画过去」—— 动画收尾就不会跳一格；
    // 反之（动画停在未夹紧的位置、结束后再夹）在角落会明显弹一下。
    var wx = (cx - tx0) / s0;
    var wy = (cy - ty0) / s0;
    var o = clampOffset2d(cx - wx * s1, cy - wy * s1, s1);
    if (Math.abs(s0 - s1) < 0.002 && Math.abs(tx0 - o.tx) < 0.5 && Math.abs(ty0 - o.ty) < 0.5) {
      state.view.s = s1;
      state.view.tx = o.tx;
      state.view.ty = o.ty;
      renderPreview();
      return;
    }
    fit2dAnim = {
      t0: performance.now(),
      dur: 380,
      s0: s0,
      s1: s1,
      anchor: false,
      tx0: tx0,
      ty0: ty0,
      tx1: o.tx,
      ty1: o.ty,
      vw: v.vw,
      vh: v.vh
    };
    tickFit2d();
  }

  function tickFit2d() {
    if (!fit2dAnim) return;
    var a = fit2dAnim;
    var t = (performance.now() - a.t0) / a.dur;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var e = easeInOut(t);
    var s = a.s0 + (a.s1 - a.s0) * e;
    state.view.s = s;
    if (a.tx1 != null) {
      state.view.tx = a.tx0 + (a.tx1 - a.tx0) * e;
      state.view.ty = a.ty0 + (a.ty1 - a.ty0) * e;
    } else {
      var wx = a.wx0 + (a.wx1 - a.wx0) * e;
      var wy = a.wy0 + (a.wy1 - a.wy0) * e;
      state.view.tx = a.vw / 2 - wx * s;
      state.view.ty = a.vh / 2 - wy * s;
    }
    renderPreview();
    if (t < 1) {
      requestAnimationFrame(tickFit2d);
      return;
    }
    fit2dAnim = null;
    if (a.tx1 != null) {
      // 终点在 animateZoom2d 里已经夹紧过，这里直接落位，不再二次夹紧
      state.view.s = a.s1;
      state.view.tx = a.tx1;
      state.view.ty = a.ty1;
    } else {
      fitView2d();
    }
    renderPreview();
  }

  function doResetView() {
    if (!state.gridData) return;
    var in3d = state.view.mode === '3d' || (morphAnim && morphAnim.dir === 'to3d');
    if (in3d) reset3dView();
    else animateFit2d();
  }

  function stepZoom(dir) {
    if (!state.gridData || fit2dAnim || morphAnim || zoom3dAnim) return;
    var factor = dir > 0 ? 1.28 : (1 / 1.28);
    var in3d = state.view.mode === '3d';
    if (in3d) {
      var z0 = state.view3d.zoom == null ? 1 : state.view3d.zoom;
      animateZoom3d(Math.max(0.45, Math.min(3.5, z0 * factor)));
      return;
    }
    var v = viewportSize();
    var minS = state.view.fitS || 1;
    var s0 = state.view.s || minS;
    var s1 = Math.max(minS, Math.min(MAX_ZOOM, s0 * factor));
    if (Math.abs(s1 - s0) < 0.002) return;
    animateZoom2d(v.vw * 0.5, v.vh * 0.5, s1);
  }

  function setViewMode3d(on) {
    if (!state.gridData) return;
    if (morphAnim) {
      if ((on && morphAnim.dir === 'to3d') || (!on && morphAnim.dir === 'to2d')) return;
    } else if (on === (state.view.mode === '3d')) {
      return;
    }

    // 只能在 2D 编辑：进 3D 时自动退出手绘
    if (on && state.editOn) {
      setEditOn(false);
    }

    var s3 = state.view3d;
    if (!s3.init) {
      s3.init = true;
      s3.yaw = 0;
      s3.pitch = 0.5;
      s3.zoom = 1;
      s3.baseF = 0;
      s3.hFactor = 1;
      s3.roundness = 1;
      s3.panX = 0;
      s3.panY = 0;
    }

    var m = previewMetrics();
    var v = viewportSize();
    if (!m.pw || !m.ph) return;

    var fromYaw = s3.yaw || 0;
    var fromPitch = s3.pitch == null ? 0.5 : s3.pitch;
    var fromH = s3.hFactor == null ? 1 : s3.hFactor;
    var fromR = s3.roundness == null ? 1 : s3.roundness;
    var fromF = s3.morphF != null ? s3.morphF : (s3.baseF || 1) * (s3.zoom == null ? 1 : s3.zoom);
    var fromPanX = s3.panX || 0;
    var fromPanY = s3.panY || 0;
    var topYaw = 0;
    var topPitch = Math.PI / 2;
    var flatH = 0.02;
    var orbitYaw = 0;
    var orbitPitch = 0.5;

    // 只更新 fitS，不立刻改当前 2D 的 s/tx/ty
    var fitS = Math.min(v.vw / m.cw, v.vh / m.ch);
    state.view.fitS = fitS;
    var orbitF = estimateFitF(orbitYaw, orbitPitch, m.pw, m.ph, v.vw, v.vh, 0.52, 0.46, 28);
    var fitFr = framingMatch2d(fitS, (v.vw - m.cw * fitS) / 2, (v.vh - m.ch * fitS) / 2,
      m.pw, m.ph, m.cw, m.ch, v.vw, v.vh, flatH);
    var matchF = fitFr.F;
    var dur = 980;

    if (on) {
      // 2D→3D：先保持俯视方格+格线，再升起变圆、格线淡出
      state.view.mode = '3d';
      var seamWFrom = 1.5;
      var seamWTo = 1.5;
      if (!morphAnim) {
        var s2 = state.view.s || fitS;
        var fr = framingMatch2d(s2, state.view.tx, state.view.ty,
          m.pw, m.ph, m.cw, m.ch, v.vw, v.vh, flatH);
        s3.yaw = topYaw;
        s3.pitch = topPitch;
        s3.hFactor = flatH;
        s3.roundness = 0;
        s3.zoom = 1;
        s3.baseF = orbitF;
        s3.morphF = fr.F;
        s3.panX = fr.panX;
        s3.panY = fr.panY;
        s3.morphGrid = state.showGrid ? 1 : 0;
        s3.morphSeam = (state.showSeam && state.boardIndex < 0 && state.boardsX * state.boardsY > 1) ? 1 : 0;
        // 与当前 2D 屏上线宽对齐（内容 2px × s），避免切入瞬间突然变粗
        seamWFrom = Math.max(1, Math.min(4, 2 * s2));
        seamWTo = 1.5;
        s3.morphSeamW = seamWFrom;
        fromYaw = topYaw;
        fromPitch = topPitch;
        fromH = flatH;
        fromR = 0;
        fromF = fr.F;
        fromPanX = fr.panX;
        fromPanY = fr.panY;
      } else {
        seamWFrom = s3.morphSeamW != null ? s3.morphSeamW : 1.5;
        seamWTo = 1.5;
      }
      morphAnim = {
        dir: 'to3d',
        t0: performance.now(),
        dur: dur,
        yaw0: fromYaw, yaw1: orbitYaw,
        pitch0: fromPitch, pitch1: orbitPitch,
        h0: fromH, h1: 1,
        r0: fromR, r1: 1,
        f0: fromF, f1: orbitF,
        panX0: fromPanX, panX1: 0,
        panY0: fromPanY, panY1: 0,
        seamW0: seamWFrom,
        seamW1: seamWTo
      };
      syncModeUI();
      showPreviewHint('单指拖动旋转视角 · 双指/滚轮缩放 · 双击放大/复位');
      tickMorph();
    } else {
      // 3D→2D：先对齐 2D 取景，再交叉淡入淡出
      state.view.mode = '3d';
      if (!s3.baseF) s3.baseF = orbitF;
      fitView2d();
      var seamW0b = s3.morphSeamW != null ? s3.morphSeamW : 1.5;
      var seamW1b = Math.max(1, Math.min(4, 2 * fitS));
      morphAnim = {
        dir: 'to2d',
        t0: performance.now(),
        dur: dur,
        yaw0: fromYaw, yaw1: topYaw,
        pitch0: fromPitch, pitch1: topPitch,
        h0: fromH, h1: flatH,
        r0: fromR, r1: 0,
        f0: fromF, f1: matchF,
        panX0: fromPanX, panX1: 0,
        panY0: fromPanY, panY1: 0,
        seamW0: seamW0b,
        seamW1: seamW1b
      };
      syncModeUI();
      showPreviewHint('单指拖动平移 · 双指缩放 · 双击放大/复位');
      tickMorph();
    }
  }

  function renderMorphFrame() {
    if (!morphAnim) return;
    var ma = morphAnim;
    var t = (performance.now() - ma.t0) / ma.dur;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var e = easeInOut(t);
    var s3 = state.view3d;
    var to3d = ma.dir === 'to3d';
    var v = viewportSize();
    var dpr = syncCanvasSize(v.vw, v.vh);

    // 2D/3D 整层交叉淡入淡出：格线与分板线跟着图层渐隐渐现，避免硬切
    var eCam;
    var eH;
    var eR;
    var eFrame;
    var eGrid;
    var eSeam;
    var eSeamT;
    var a2d;
    var a3d;
    var hasSeam = state.showSeam && state.boardIndex < 0 && state.boardsX * state.boardsY > 1;
    var w0 = ma.seamW0 != null ? ma.seamW0 : 1.5;
    var w1 = ma.seamW1 != null ? ma.seamW1 : 1.5;
    if (to3d) {
      eCam = stagger(e, 0.22, 0.95);
      eH = stagger(e, 0.18, 0.88);
      eR = stagger(e, 0.38, 1.0);
      eFrame = stagger(e, 0.12, 0.82);
      a2d = 1 - stagger(e, 0.0, 0.42);
      a3d = stagger(e, 0.08, 0.48);
      eGrid = 1 - stagger(e, 0.35, 0.75);
      eSeam = hasSeam ? 1 : 0;
      eSeamT = stagger(e, 0.0, 0.9);
    } else if (ma.dir === 'to2d') {
      eCam = stagger(e, 0.0, 0.55);
      eH = stagger(e, 0.1, 0.68);
      eR = stagger(e, 0.05, 0.58);
      eFrame = stagger(e, 0.12, 0.75);
      a3d = 1 - stagger(e, 0.52, 1.0);
      a2d = stagger(e, 0.48, 1.0);
      eGrid = stagger(e, 0.32, 0.68);
      eSeam = hasSeam ? 1 : 0;
      eSeamT = stagger(e, 0.0, 0.9);
    } else {
      eCam = e;
      eH = e;
      eR = e;
      eFrame = e;
      a2d = 0;
      a3d = 1;
      eGrid = 0;
      eSeam = hasSeam ? 1 : 0;
      eSeamT = e;
    }

    s3.yaw = ma.yaw0 + (ma.yaw1 - ma.yaw0) * eCam;
    s3.pitch = ma.pitch0 + (ma.pitch1 - ma.pitch0) * eCam;
    s3.hFactor = ma.h0 + (ma.h1 - ma.h0) * eH;
    s3.roundness = ma.r0 + (ma.r1 - ma.r0) * eR;
    s3.morphF = ma.f0 + (ma.f1 - ma.f0) * eFrame;
    s3.panX = (ma.panX0 || 0) + ((ma.panX1 || 0) - (ma.panX0 || 0)) * eFrame;
    s3.panY = (ma.panY0 || 0) + ((ma.panY1 || 0) - (ma.panY0 || 0)) * eFrame;
    s3.morphGrid = state.showGrid ? eGrid : 0;
    s3.morphSeam = eSeam;
    s3.morphSeamW = w0 + (w1 - w0) * eSeamT;
    s3.morphProg = e;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, v.vw, v.vh);
    if (a3d > 0.02) render3d({ skipClear: true, alpha: a3d });
    if (a2d > 0.02) render2d({ skipClear: true, alpha: a2d });
  }

  function tickMorph() {
    if (!morphAnim) return;
    var m = morphAnim;
    var t = (performance.now() - m.t0) / m.dur;
    renderPreview();
    if (t < 1) {
      requestAnimationFrame(tickMorph);
      return;
    }
    var s3 = state.view3d;
    morphAnim = null;
    s3.morphGrid = null;
    s3.morphSeam = null;
    s3.morphSeamW = null;
    s3.morphProg = null;
    if (m.dir === 'to2d') {
      state.view.mode = '2d';
      s3.hFactor = 1;
      s3.roundness = 1;
      s3.morphF = null;
      s3.panX = 0;
      s3.panY = 0;
      fitView2d();
      syncModeUI();
      renderPreview();
    } else {
      s3.hFactor = 1;
      s3.roundness = 1;
      s3.yaw = m.yaw1;
      s3.pitch = m.pitch1;
      s3.zoom = 1;
      s3.baseF = m.f1;
      s3.morphF = null;
      s3.panX = 0;
      s3.panY = 0;
      renderPreview();
    }
  }

  function reset3dView() {
    if (!state.gridData || state.view.mode !== '3d') return;
    if (morphAnim && morphAnim.dir === 'reset') return;
    // 切 2D 过程中不打断；其余动画可被复位覆盖
    if (morphAnim && morphAnim.dir === 'to2d') return;

    var s3 = state.view3d;
    s3.init = true;
    var m = previewMetrics();
    var v = viewportSize();
    if (!m.pw || !m.ph) return;

    var orbitYaw = 0;
    var orbitPitch = 0.5;
    var orbitF = estimateFitF(orbitYaw, orbitPitch, m.pw, m.ph, v.vw, v.vh, 0.52, 0.46, 28);
    var fromYaw = s3.yaw || 0;
    var fromPitch = s3.pitch == null ? 0.5 : s3.pitch;
    var fromH = s3.hFactor == null ? 1 : s3.hFactor;
    var fromR = s3.roundness == null ? 1 : s3.roundness;
    var fromF = s3.morphF != null ? s3.morphF : (s3.baseF || orbitF) * (s3.zoom == null ? 1 : s3.zoom);

    morphAnim = {
      dir: 'reset',
      t0: performance.now(),
      dur: 480,
      yaw0: fromYaw, yaw1: orbitYaw,
      pitch0: fromPitch, pitch1: orbitPitch,
      h0: fromH, h1: 1,
      r0: fromR, r1: 1,
      f0: fromF, f1: orbitF,
      panX0: s3.panX || 0, panX1: 0,
      panY0: s3.panY || 0, panY1: 0
    };
    tickMorph();
  }

  var gd = {
    pointers: {},
    count: 0,
    rect: { left: 0, top: 0 },
    prevX: 0, prevY: 0,
    travX: 0, travY: 0,
    tapBlock: false,
    lastTapT: 0, lastTapX: 0, lastTapY: 0,
    pinch: null,
    painting: false,
    picking: false,
    stroke: null,
    downX: 0, downY: 0
  };

  function vpPos(e) {
    return { x: e.clientX - gd.rect.left, y: e.clientY - gd.rect.top };
  }

  function isToolBtn(target) {
    return !!findEl(target, '.bar-btn', document.getElementById('preview-bar'));
  }

  function onVpDown(e) {
    if (!state.gridData || gd.pointers[e.pointerId]) return;
    if (isToolBtn(e.target)) return;
    if (gd.count === 0) {
      var r = els.viewport.getBoundingClientRect();
      gd.rect = { left: r.left, top: r.top };
    }
    var p = vpPos(e);
    gd.pointers[e.pointerId] = p;
    gd.count = Object.keys(gd.pointers).length;
    // 桌面端：按住 Shift / 右键拖动 = 平移而不是落笔
    var panIntent = !!(e.button === 2 || e.shiftKey || (e.ctrlKey && !e.metaKey));
    gd.painting = gd.count === 1 && toolPainting() && !panIntent;
    gd.picking = gd.count === 1 && toolPicking() && !panIntent;

    if (gd.count === 1) {
      gd.prevX = p.x;
      gd.prevY = p.y;
      gd.travX = 0;
      gd.travY = 0;
      gd.downX = p.x;
      gd.downY = p.y;
      var now = Date.now();
      if (gd.painting) {
        // 画笔/橡皮：直接落笔；屏蔽双击缩放，避免连续点涂被误判成双击
        gd.lastTapT = 0;
        strokeStart(p.x, p.y);
        updateLoupe(p.x, p.y, false);
        requestRender();
      } else if (gd.picking) {
        gd.lastTapT = 0;
        updateLoupe(p.x, p.y, true);
      } else if (now - gd.lastTapT < 340 &&
        Math.abs(p.x - gd.lastTapX) < 46 && Math.abs(p.y - gd.lastTapY) < 46) {
        gd.lastTapT = 0;
        gd.tapBlock = true;
        if (state.view.mode === '2d') {
          zoomAt2d(p.x, p.y, 0);
        } else if (state.view.mode === '3d') {
          zoomToggle3d();
        }
      } else {
        gd.lastTapT = now;
        gd.lastTapX = p.x;
        gd.lastTapY = p.y;
        gd.tapBlock = false;
      }
    } else if (gd.count === 2) {
      // 第二指落下：短笔撤销（多半是误触），长笔保留，随后进入捏合
      if (gd.stroke) {
        strokeEnd(gd.stroke.cells.length > 4);
        requestRender();
      }
      gd.painting = false;
      gd.picking = false;
      hideLoupe();
      var q = twoPtList();
      if (q) {
        var s3 = state.view3d;
        gd.pinch = {
          d0: q.d, dPrev: q.d,
          mPrevX: q.mx, mPrevY: q.my,
          ax: q.mx, ay: q.my,
          s0: state.view.s, tx0: state.view.tx, ty0: state.view.ty,
          yaw0: s3.yaw || 0, pitch0: s3.pitch == null ? 0.5 : s3.pitch,
          zoom0: s3.zoom == null ? 1 : s3.zoom
        };
        gd.lastTapT = 0;
        gd.tapBlock = true;
      }
    }
    try { els.viewport.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  function onVpMove(e) {
    if (!gd.pointers[e.pointerId]) return;
    var p = vpPos(e);
    var count = Object.keys(gd.pointers).length;
    gd.pointers[e.pointerId] = p;

    if (count === 1) {
      var dx = p.x - gd.prevX;
      var dy = p.y - gd.prevY;
      gd.prevX = p.x;
      gd.prevY = p.y;
      gd.travX += Math.abs(dx);
      gd.travY += Math.abs(dy);
      if (gd.travX + gd.travY > 14) gd.lastTapT = 0;
      if (gd.tapBlock) return;
      if (gd.painting) {
        if (fit2dAnim) return;
        strokeTo(p.x, p.y);
        updateLoupe(p.x, p.y, false);
        requestRender();
        return;
      }
      if (gd.picking) {
        updateLoupe(p.x, p.y, true);
        return;
      }
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      if (state.view.mode === '2d') {
        if (fit2dAnim) return;
        state.view.tx += dx;
        state.view.ty += dy;
        requestRender();
      } else {
        if (morphAnim || zoom3dAnim) return;
        var s3 = state.view3d;
        // 自然轨道：右拖物体右转 → yaw 取负；上拖抬高视角 → pitch 随 dy 正向
        s3.yaw = (s3.yaw || 0) - dx * 0.012;
        var np2 = (s3.pitch == null ? 0.5 : s3.pitch) + dy * 0.008;
        s3.pitch = Math.max(0.18, Math.min(Math.PI / 2, np2));
        requestRender();
      }
    } else if (count >= 2 && gd.pinch) {
      var q = twoPtList();
      if (!q) return;
      var k = q.d / gd.pinch.d0;
      if (state.view.mode === '2d') {
        // 增量双指：中点移动即平移，张合即缩放，画笔模式下双指导航
        if (fit2dAnim) return;
        var pc = gd.pinch;
        var minS = state.view.fitS || 1;
        var s0 = state.view.s || minS;
        var k = q.d / (pc.dPrev > 0 ? pc.dPrev : 1);
        var s1 = Math.max(minS, Math.min(MAX_ZOOM, s0 * k));
        var wxx = (pc.mPrevX - state.view.tx) / s0;
        var wyy = (pc.mPrevY - state.view.ty) / s0;
        state.view.s = s1;
        state.view.tx = q.mx - wxx * s1;
        state.view.ty = q.my - wyy * s1;
        pc.dPrev = q.d;
        pc.mPrevX = q.mx;
        pc.mPrevY = q.my;
        requestRender();
      } else {
        if (morphAnim || zoom3dAnim) return;
        // 双指只缩放，不附带旋转，避免挪动时误缩放感
        var s32 = state.view3d;
        s32.zoom = Math.max(0.45, Math.min(3.5, gd.pinch.zoom0 * k));
        requestRender();
      }
    }
  }

  function onVpUp(e) {
    if (!gd.pointers[e.pointerId]) return;
    var up = vpPos(e);
    delete gd.pointers[e.pointerId];
    gd.count = Object.keys(gd.pointers).length;
    if (gd.count === 1) {
      // 回到单指：以剩余触点续拖（捏合结束，不再恢复落笔）
      var ids = Object.keys(gd.pointers);
      var rem = gd.pointers[ids[0]];
      gd.prevX = rem.x;
      gd.prevY = rem.y;
      gd.pinch = null;
      gd.tapBlock = false;
      gd.painting = false;
      gd.picking = false;
      hideLoupe();
    } else if (gd.count === 0) {
      gd.pinch = null;
      var wasTapZoom = gd.tapBlock;
      gd.tapBlock = false;
      var wasStroke = !!gd.stroke;
      var wasPicking = !!gd.picking;
      // 取色：松手定色，成功后切回画笔
      if (wasPicking && !wasTapZoom) {
        var pickIdx = cellAtScreen(up.x, up.y);
        if (pickIdx >= 0 && state.gridData[pickIdx] && !isEmptyCell(state.gridData[pickIdx])) {
          var got = state.gridData[pickIdx];
          state.brush = { code: got.code, hex: got.hex, r: got.r, g: got.g, b: got.b };
          syncColorChip();
          setTool('brush');
          toast('已取色 ' + got.code);
        }
      }
      if (wasStroke) {
        strokeEnd(true);
      }
      gd.painting = false;
      gd.picking = false;
      hideLoupe();
      // 双击缩放动画进行中或刚触发时不夹紧，避免抬手瞬间偏移跳动
      if (state.view.mode === '2d' && !fit2dAnim && !wasTapZoom) {
        clampView2d();
      }
      renderPreview();
    }
  }

  function syncExpBoxes() {
    els.expAxes.checked = !!state.exp.axes;
    els.expCodes.checked = !!state.exp.codes;
    els.expLegend.checked = !!state.exp.legend;
    els.expMeta.checked = !!state.exp.meta;
    var mode = state.exp.boardMode === 'each' ? 'each' : 'full';
    if (els.expModeFull) els.expModeFull.checked = mode === 'full';
    if (els.expModeEach) els.expModeEach.checked = mode === 'each';
  }

  function openExportSheet() {
    if (!state.gridData || state.busy) return;
    syncExpBoxes();
    var total = state.boardsX * state.boardsY;
    var multi = total > 1;
    if (els.expBoardMode) {
      els.expBoardMode.hidden = !multi;
    }
    if (els.exportScope) {
      if (!multi) {
        els.exportScope.textContent = '将导出整幅图纸（单板）';
      } else if (state.exp.boardMode === 'each') {
        els.exportScope.textContent = '将依次导出 ' + total + ' 张分板图纸（每板含本板用量）';
      } else {
        els.exportScope.textContent = '将导出整幅拼图（含分板线）';
      }
    }
    openSheet(els.exportSheet);
  }

  function closeExportSheet() {
    closeSheet(els.exportSheet);
  }

  function doExport() {
    closeExportSheet();
    saveToAlbum();
  }

  function doShare() {
    shareToNote();
  }

  // ================= 手绘编辑 =================
  function sameEntry(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.code === b.code && a.hex === b.hex;
  }

  function buildCounts(grid) {
    var counts = {};
    var i;
    var e;
    var code;
    for (i = 0; i < grid.length; i++) {
      e = grid[i];
      if (isEmptyCell(e) || !e.code) continue;
      code = e.code;
      if (!counts[code]) {
        counts[code] = { code: code, hex: e.hex, r: e.r, g: e.g, b: e.b, n: 0 };
      }
      counts[code].n += 1;
    }
    return counts;
  }

  function recount() {
    state.counts = buildCounts(state.gridData);
    ensureDefaultHighlight(sortedCounts());
    updateMeta();
    renderLegend();
  }

  function syncUndoBtns() {
    if (els.etUndo) els.etUndo.disabled = undoStack.length === 0;
    if (els.etRedo) els.etRedo.disabled = redoStack.length === 0;
  }

  function pushUndo(cells) {
    if (!cells || !cells.length) return;
    undoStack.push({ cells: cells, len: state.gridData ? state.gridData.length : 0 });
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
    syncUndoBtns();
  }

  function flushEdits() {
    undoStack.length = 0;
    redoStack.length = 0;
    syncUndoBtns();
  }

  function undoEdit() {
    if (!undoStack.length) return;
    var op = undoStack.pop();
    if (!state.gridData || op.len !== state.gridData.length) {
      flushEdits();
      return;
    }
    var cells = op.cells;
    var i;
    for (i = cells.length - 1; i >= 0; i--) {
      state.gridData[cells[i].idx] = cells[i].prev;
    }
    redoStack.push(op);
    recount();
    renderPreview();
    syncUndoBtns();
  }

  function redoEdit() {
    if (!redoStack.length) return;
    var op = redoStack.pop();
    if (!state.gridData || op.len !== state.gridData.length) {
      flushEdits();
      return;
    }
    var cells = op.cells;
    var i;
    for (i = 0; i < cells.length; i++) {
      state.gridData[cells[i].idx] = cells[i].cur;
    }
    undoStack.push(op);
    recount();
    renderPreview();
    syncUndoBtns();
  }

  function clearEdits() {
    if (!state.gridData || !state.autoGrid) return;
    var cells = [];
    var i;
    var want;
    for (i = 0; i < state.gridData.length; i++) {
      want = state.autoGrid[i];
      if (want && !sameEntry(state.gridData[i], want)) {
        cells.push({ idx: i, prev: state.gridData[i], cur: want });
      }
    }
    if (!cells.length) {
      return;
    }
    for (i = 0; i < cells.length; i++) {
      state.gridData[cells[i].idx] = cells[i].cur;
    }
    pushUndo(cells);
    recount();
    renderPreview();
    toast('已清空手绘（可撤销）');
  }

  function syncToolChips() {
    if (!els.etGroup) return;
    var btns = els.etGroup.querySelectorAll('[data-tool]');
    var i;
    for (i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-tool') === state.tool);
    }
  }

  function syncColorChip() {
    if (!els.etPaint) return;
    var b = state.brush;
    els.etPaint.innerHTML = b
      ? '<span class="cp"><span class="cp-swatch" style="background:' + b.hex + '"></span>' +
        '<span class="cp-code">' + b.code + '</span></span>'
      : '<span class="cp"><span class="cp-code cp-muted">选色</span></span>';
  }

  function refreshEditUI(immediate) {
    var on = !!(state.editOn && state.gridData);
    if (els.etGroup) {
      els.etGroup.classList.toggle('is-open', on);
      els.etGroup.style.maxHeight = on ? '' : '0px';
    }
    if (els.btnEdit) {
      els.btnEdit.classList.toggle('vt-on', on);
      els.btnEdit.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    syncToolChips();
    syncColorChip();
    syncUndoBtns();
  }

  var editSnapshot = null;
  var editUndoMark = 0;

  function captureEditSnapshot() {
    editSnapshot = state.gridData ? state.gridData.slice() : null;
    editUndoMark = undoStack.length;
  }

  function restoreEditSnapshot() {
    if (!editSnapshot || !state.gridData) {
      editSnapshot = null;
      return;
    }
    state.gridData = editSnapshot.slice();
    while (undoStack.length > editUndoMark) undoStack.pop();
    redoStack.length = 0;
    editSnapshot = null;
    recount();
    syncUndoBtns();
    syncColorChip();
    renderLegend();
    renderPreview();
  }

  function setEditOn(on) {
    if (on && !state.gridData) return;
    if (!!on === !!state.editOn && ((on && currentRoute() === 'hand') || (!on && currentRoute() !== 'hand'))) {
      refreshEditUI(true);
      return;
    }
    state.editOn = !!on;
    if (on) {
      captureEditSnapshot();
      if (!state.brush) {
        var top = sortedCounts()[0];
        if (top) {
          state.brush = { code: top.code, hex: top.hex, r: top.r, g: top.g, b: top.b };
        }
      }
      state.highlightCode = null;
      renderLegend();
      var in3d = state.view.mode === '3d' || (morphAnim && morphAnim.dir === 'to3d');
      // 先冻帧占位 + 挂预览到编辑页，再滑入（底层仍显示冻帧，不会露空白）
      mountPreviewOn(els.screenHand);
      showScreen('hand');
      refreshEditUI(true);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (els.viewport) void els.viewport.offsetHeight;
          if (!fit2dAnim && !morphAnim && !zoom3dAnim) {
            syncViewportResize({ keepTransform: true });
          } else {
            renderPreview();
          }
        });
      });
      if (in3d) {
        setViewMode3d(false);
      }
    } else {
      hideLoupe();
      editSnapshot = null;
      // 先把预览挂回生成页，再滑出编辑页
      mountPreviewOn(els.screenEdit);
      if (currentRoute() === 'hand') goBack();
      refreshEditUI(true);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (!fit2dAnim && !morphAnim && !zoom3dAnim) syncViewportResize();
          renderPreview();
        });
      });
    }
    renderPreview();
  }

  function cancelHandEdit() {
    if (!state.editOn) return;
    restoreEditSnapshot();
    setEditOn(false);
  }

  // 手绘工具条的展开/收起 —— 和「更多」面板同一套动画，只是更柔。
  // 关键在于：展开高度按「内容实际高度 + 卡片上下描边」给死，不能留大余量。
  // max-height 给多了，内容在过渡前 1/4 就露完了，剩下的时间全在空转，
  // 观感就是「啪一下弹出来」——这正是之前嫌太快的原因。
  // 整页编辑模式下 CSS 会强制常显，这里仍写 maxHeight 以兼容旧路径。
  var etOpen = false;
  var etAnimToken = 0;
  function setEtGroupOpen(on, immediate) {
    var el = els.etGroup;
    var inner = el && el.firstElementChild;
    if (!el || !inner) return;
    var open = !!on;
    var full = inner.scrollHeight + 2; // +2：卡片上下各 1px 描边
    if (open === etOpen) {
      // 状态没变就别重放动画；即时路径顺手把高度校正一下
      if (immediate) el.style.maxHeight = open ? full + 'px' : '0px';
      return;
    }
    etOpen = open;
    etAnimToken += 1;
    var token = etAnimToken;
    if (immediate || state.editOn) {
      el.classList.add('no-anim');
      el.classList.toggle('is-open', open);
      el.style.maxHeight = open ? full + 'px' : '0px';
      void el.offsetHeight;
      el.classList.remove('no-anim');
      return;
    }
    // 先钉死起点并强制一帧布局，再在下一帧写终点——
    // 同帧里若后面还有 renderPreview / toast 等重活，过渡经常被浏览器吞掉。
    el.classList.add('no-anim');
    el.classList.toggle('is-open', !open);
    el.style.maxHeight = open ? '0px' : full + 'px';
    void el.offsetHeight;
    el.classList.remove('no-anim');
    requestAnimationFrame(function () {
      if (token !== etAnimToken) return;
      el.classList.toggle('is-open', open);
      el.style.maxHeight = open ? full + 'px' : '0px';
    });
  }

  // 瞬时落定工具条占位高度（预览区尺寸立刻到终点），但不加 .no-anim，
  // 好让内部 .et-tools / .et-acts 仍走淡入。用于「3D 点编辑」：先稳视口再开 morph。
  function setEtGroupHeightNow(on) {
    var el = els.etGroup;
    var inner = el && el.firstElementChild;
    if (!el || !inner) return;
    var open = !!on;
    var full = inner.scrollHeight + 2;
    etAnimToken += 1;
    etOpen = open;
    var prev = el.style.transition;
    el.style.transition = 'none';
    el.classList.toggle('is-open', open);
    el.style.maxHeight = open ? full + 'px' : '0px';
    void el.offsetHeight;
    el.style.transition = prev;
  }

  // 「更多」参数面板：默认收起，预览占更高（对齐 iOS showSettings）
  function panelFullH() {
    if (!els.panel) return 0;
    var h = els.panel.scrollHeight;
    var cap = Math.round((window.innerHeight || 0) * 0.48);
    return cap > 0 ? Math.min(h, cap) : h;
  }

  function setPanelOpen(on, immediate) {
    if (!els.panelWrap) return;
    var open = !!on;
    if (immediate) els.panelWrap.classList.add('no-anim');
    // 展开高度同样按内容实际高度给，动画才「整段都在长」
    els.panelWrap.style.maxHeight = open ? panelFullH() + 'px' : '0px';
    els.panelWrap.classList.toggle('is-open', open);
    if (immediate) {
      // 读一次 offsetHeight 强制布局，让新高度立刻生效后再恢复过渡
      void els.panelWrap.offsetHeight;
      els.panelWrap.classList.remove('no-anim');
    }
    if (els.btnMore) {
      els.btnMore.classList.toggle('vt-on', open);
      els.btnMore.setAttribute('aria-pressed', open ? 'true' : 'false');
    }
  }

  function isPanelOpen() {
    return !!(els.panelWrap && els.panelWrap.classList.contains('is-open'));
  }

  // 面板/工具条高度变了 → 预览区尺寸跟着变，要重新适配。
  // 过渡期间容器尺寸一直在变：有 ResizeObserver 时逐帧跟随，
  // 这里再补一次收尾同步，保证过渡结束后图片中心与容器中心仍然对得上。
  function afterPanelToggle() {
    setTimeout(function () {
      if (!fit2dAnim && !morphAnim && !zoom3dAnim) syncViewportResize();
    }, SOFT_MS + 20);
  }

  function setTool(t) {
    if (t !== 'brush' && t !== 'eraser' && t !== 'dropper') return;
    state.tool = t;
    syncToolChips();
    toast(t === 'brush' ? '画笔：单指点涂 · 双指缩放/平移'
      : t === 'eraser' ? '橡皮：擦回自动生成色'
        : '取色：按住拖动吸取 · 松手定色');
  }

  function openPickSheet() {
    if (!state.gridData) return;
    renderPickList();
    openSheet(els.pickSheet);
  }

  function closePickSheet() {
    closeSheet(els.pickSheet);
  }

  function renderPickList() {
    els.pickList.innerHTML = '';
    var cache = buildPaletteCache(getPalette());
    var counts = state.counts || {};
    var i;
    for (i = 0; i < cache.length; i++) {
      var c = cache[i];
      var n = counts[c.code] ? counts[c.code].n : 0;
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'colors-item' + (state.brush && state.brush.code === c.code ? ' is-on' : '');
      el.setAttribute('data-code', c.code);
      el.innerHTML =
        '<span class="colors-swatch" style="background:' + c.hex + '"></span>' +
        '<span class="colors-item-code">' + c.code + '</span>' +
        '<span class="colors-item-count">' + (n ? n + '颗' : '') + '</span>';
      els.pickList.appendChild(el);
    }
  }

  function pickColorByCode(code) {
    var cache = buildPaletteCache(getPalette());
    var i;
    for (i = 0; i < cache.length; i++) {
      if (cache[i].code === code) {
        var c = cache[i];
        state.brush = { code: c.code, hex: c.hex, r: c.r, g: c.g, b: c.b };
        return true;
      }
    }
    return false;
  }

  function toolPainting() {
    return !!(state.editOn && state.view.mode === '2d' &&
      (state.tool === 'brush' || state.tool === 'eraser') && state.gridData);
  }

  function toolPicking() {
    return !!(state.editOn && state.view.mode === '2d' &&
      state.tool === 'dropper' && state.gridData);
  }

  // ---------- 落笔 / 取色 5×5 放大镜（对齐 iOS BeadLoupe） ----------
  var LOUPE_SPAN = 5;
  var LOUPE_DIAM = 150;
  var LOUPE_GAP = 34;
  var LOUPE_EDGE = 8;
  var loupeCtx = els.paintLoupeCanvas
    ? (els.paintLoupeCanvas.getContext('2d', { colorSpace: 'srgb' }) || els.paintLoupeCanvas.getContext('2d'))
    : null;

  function hideLoupe() {
    if (els.paintLoupe) els.paintLoupe.hidden = true;
    if (els.paintLoupeReadout) els.paintLoupeReadout.hidden = true;
  }

  function cellAtColRow(col, row) {
    if (!state.gridData) return null;
    if (col < 0 || row < 0 || col >= state.width || row >= state.height) return null;
    return state.gridData[row * state.width + col];
  }

  function updateLoupe(sx, sy, showReadout) {
    if (!els.paintLoupe || !loupeCtx || !state.gridData) return;
    var idx = cellAtScreen(sx, sy);
    if (idx < 0) {
      hideLoupe();
      return;
    }
    var rect = boardRect(state.boardIndex);
    var col = idx % state.width;
    var row = (idx / state.width) | 0;
    var half = (LOUPE_SPAN / 2) | 0;
    var originCol = Math.min(Math.max(col - half, rect.x0), Math.max(rect.x0, rect.x1 - LOUPE_SPAN));
    var originRow = Math.min(Math.max(row - half, rect.y0), Math.max(rect.y0, rect.y1 - LOUPE_SPAN));
    var cell = LOUPE_DIAM / LOUPE_SPAN;
    var i;
    var j;
    var bead;
    var px;
    var py;
    var lum;

    loupeCtx.setTransform(1, 0, 0, 1, 0, 0);
    loupeCtx.fillStyle = viewBgColor();
    loupeCtx.fillRect(0, 0, LOUPE_DIAM, LOUPE_DIAM);

    for (j = 0; j < LOUPE_SPAN; j++) {
      for (i = 0; i < LOUPE_SPAN; i++) {
        bead = cellAtColRow(originCol + i, originRow + j);
        if (!bead || isEmptyCell(bead)) continue;
        px = i * cell;
        py = j * cell;
        loupeCtx.fillStyle = bead.hex;
        loupeCtx.fillRect(px, py, cell + 0.4, cell + 0.4);
      }
    }

    // 格线
    loupeCtx.strokeStyle = gridLineColor();
    loupeCtx.lineWidth = 1;
    loupeCtx.beginPath();
    for (i = 0; i <= LOUPE_SPAN; i++) {
      px = i * cell + 0.5;
      loupeCtx.moveTo(px, 0);
      loupeCtx.lineTo(px, LOUPE_DIAM);
      loupeCtx.moveTo(0, px);
      loupeCtx.lineTo(LOUPE_DIAM, px);
    }
    loupeCtx.stroke();

    // 格内色号（圆窗一格≈30px，刚好够）
    loupeCtx.font = Math.round(cell * CODE_SHOW_FONT) + 'px sans-serif';
    loupeCtx.textAlign = 'center';
    loupeCtx.textBaseline = 'middle';
    for (j = 0; j < LOUPE_SPAN; j++) {
      for (i = 0; i < LOUPE_SPAN; i++) {
        bead = cellAtColRow(originCol + i, originRow + j);
        if (!bead || isEmptyCell(bead)) continue;
        lum = bead.r * 0.299 + bead.g * 0.587 + bead.b * 0.114;
        loupeCtx.fillStyle = lum > 160 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)';
        loupeCtx.fillText(bead.code, i * cell + cell / 2, j * cell + cell / 2);
      }
    }

    // 焦点格：白圈 + 主题色
    var fx = (col - originCol) * cell;
    var fy = (row - originRow) * cell;
    loupeCtx.strokeStyle = 'rgba(255,255,255,0.92)';
    loupeCtx.lineWidth = 4;
    loupeCtx.strokeRect(fx + 1, fy + 1, cell - 2, cell - 2);
    loupeCtx.strokeStyle = '#3478e0';
    loupeCtx.lineWidth = 2;
    loupeCtx.strokeRect(fx + 2, fy + 2, cell - 4, cell - 4);

    if (els.paintLoupeCoord) {
      // 图纸坐标：1 起算（与导出轴同口径）
      els.paintLoupeCoord.textContent = '列 ' + (col + 1) + ' · 行 ' + (row + 1);
    }

    if (els.paintLoupeReadout) {
      if (showReadout) {
        bead = cellAtColRow(col, row);
        if (bead && !isEmptyCell(bead)) {
          els.paintLoupeReadout.innerHTML =
            '<span class="paint-loupe-swatch" style="background:' + bead.hex + '"></span>' +
            '<span>' + bead.code + '</span>';
        } else {
          els.paintLoupeReadout.innerHTML = '<span>空格</span>';
        }
        els.paintLoupeReadout.hidden = false;
      } else {
        els.paintLoupeReadout.hidden = true;
      }
    }

    // 定位：优先指尖上方，放不下翻下方，再夹回画布
    var vp = els.viewport.getBoundingClientRect();
    var labelH = showReadout ? (26 * 2 + 6) : 26;
    var blockW = LOUPE_DIAM;
    var blockH = LOUPE_DIAM + 6 + labelH;
    var halfW = blockW / 2;
    var halfH = blockH / 2;
    var x;
    var y;
    if (vp.width >= blockW + LOUPE_EDGE * 2) {
      x = Math.min(Math.max(sx, LOUPE_EDGE + halfW), vp.width - LOUPE_EDGE - halfW);
    } else {
      x = vp.width / 2;
    }
    var above = sy - LOUPE_GAP - halfH;
    if (above - halfH >= LOUPE_EDGE) {
      y = above;
    } else {
      var below = sy + LOUPE_GAP + halfH;
      if (below + halfH <= vp.height - LOUPE_EDGE) {
        y = below;
      } else {
        var minY = LOUPE_EDGE + halfH;
        var maxY = Math.max(minY, vp.height - LOUPE_EDGE - halfH);
        y = Math.min(Math.max(above, minY), maxY);
      }
    }
    els.paintLoupe.style.left = x + 'px';
    els.paintLoupe.style.top = y + 'px';
    els.paintLoupe.hidden = false;
  }

  function screenContent(x, y) {
    var s = state.view.s;
    if (!(s > 0)) return null;
    return { x: (x - state.view.tx) / s, y: (y - state.view.ty) / s };
  }

  function contentCell(cx, cy) {
    if (!state.gridData) return -1;
    var rect = boardRect(state.boardIndex);
    var col = rect.x0 + Math.floor(cx / PRE_CS);
    var row = rect.y0 + Math.floor(cy / PRE_CS);
    if (col < rect.x0 || col >= rect.x1 || row < rect.y0 || row >= rect.y1) return -1;
    return row * state.width + col;
  }

  function cellAtScreen(x, y) {
    var c = screenContent(x, y);
    if (!c) return -1;
    return contentCell(c.x, c.y);
  }

  function paintIdx(idx) {
    if (idx < 0 || !gd.stroke) return;
    var cur = state.tool === 'brush' ? state.brush : (state.autoGrid ? state.autoGrid[idx] : null);
    if (!cur) return;
    var old = state.gridData[idx];
    if (sameEntry(old, cur)) return;
    state.gridData[idx] = cur;
    gd.stroke.cells.push({ idx: idx, prev: old, cur: cur });
  }

  // 在屏幕两点间按内容坐标密集采样落笔，快速滑动不断线、越界自动裁掉
  function paintSegmentPx(x0, y0, x1, y1) {
    var c0 = screenContent(x0, y0);
    var c1 = screenContent(x1, y1);
    if (!c0 || !c1) return;
    var dx = c1.x - c0.x;
    var dy = c1.y - c0.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var n = Math.max(1, Math.ceil(d / (PRE_CS * 0.5)));
    var k;
    var t;
    for (k = 0; k <= n; k++) {
      t = k / n;
      paintIdx(contentCell(c0.x + dx * t, c0.y + dy * t));
    }
  }

  function strokeStart(x, y) {
    if (!toolPainting()) return;
    gd.stroke = { cells: [], lastX: x, lastY: y };
    paintSegmentPx(x, y, x, y);
  }

  function strokeTo(x, y) {
    if (!gd.stroke) return;
    paintSegmentPx(gd.stroke.lastX, gd.stroke.lastY, x, y);
    gd.stroke.lastX = x;
    gd.stroke.lastY = y;
  }

  // commit=true 入撤销栈；false 为撤销整笔（双指捏合误触时的短笔）
  function strokeEnd(commit) {
    var st = gd.stroke;
    gd.stroke = null;
    if (!st || !st.cells.length) return;
    if (!commit) {
      var i;
      for (i = 0; i < st.cells.length; i++) {
        state.gridData[st.cells[i].idx] = st.cells[i].prev;
      }
    } else {
      pushUndo(st.cells);
    }
    recount();
    renderPreview();
  }

  // events
  els.fileInput.addEventListener('change', function () {
    var f = els.fileInput.files && els.fileInput.files[0];
    // 关键：不要在选完图立刻 value='' —— 部分 Android WebView 会连文件句柄一起回收，
    // 随后 createObjectURL / FileReader 读到的就是不完整的文件（表现成「图片读取失败」）。
    // 等这一轮读取真正结束（无论成败）再清空，顺带保证还能重选同一张图。
    loadFile(f, null, function () {
      els.fileInput.value = '';
    });
  });

  els.btnReselect.addEventListener('click', function () {
    els.fileInput.click();
  });

  // 裁切（搬自 crop-grid 的交互：图片在固定比例框下平移/缩放）
  if (els.btnCrop) els.btnCrop.addEventListener('click', openCrop);
  if (els.cropCancel) els.cropCancel.addEventListener('click', closeCrop);
  if (els.cropConfirm) els.cropConfirm.addEventListener('click', applyCrop);
  if (els.cropRotate) els.cropRotate.addEventListener('click', rotateCrop);
  if (els.cropFlip) els.cropFlip.addEventListener('click', flipCrop);
  if (els.cropZoom) els.cropZoom.addEventListener('input', function () {
    cropSetZoom(Number(els.cropZoom.value));
  });
  if (els.cropRatioChips) {
    els.cropRatioChips.addEventListener('click', function (e) {
      var btn = findEl(e.target, '[data-ratio]', els.cropRatioChips);
      if (!btn) return;
      setCropRatio(btn.getAttribute('data-ratio'));
    });
  }
  if (els.cropViewport) {
    els.cropViewport.addEventListener('mousedown', function (e) {
      e.preventDefault();
      onCropDown(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', function (e) { onCropMove(e.clientX, e.clientY); });
    window.addEventListener('mouseup', function () { onCropUp(); });

    els.cropViewport.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        onCropDown(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        stopCropInertia();
        crop.dragging = false;
        crop.dragMode = 'pan';
        crop.resizeHandle = null;
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        crop.pinchStartDist = Math.sqrt(dx * dx + dy * dy);
        crop.pinchStartScale = crop.scale;
      }
    }, { passive: true });

    els.cropViewport.addEventListener('touchmove', function (e) {
      if (e.touches.length === 1 && crop.dragging) {
        e.preventDefault();
        onCropMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        e.preventDefault();
        stopCropInertia();
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (crop.pinchStartDist > 0) {
          var ratio = dist / crop.pinchStartDist;
          var maxScale = crop.minScale * (1 + CROP_ZOOM_MAX / 100);
          var next = Math.max(crop.minScale, Math.min(maxScale, crop.pinchStartScale * ratio));
          var z = (next / crop.minScale - 1) * 100;
          cropSetZoom(z);
          syncCropZoomSlider(z);
        }
      }
    }, { passive: false });

    els.cropViewport.addEventListener('touchend', onCropUp);
  }
  if (els.cropViewport) {
    els.cropViewport.addEventListener('wheel', function (e) {
      if (currentRoute() !== 'crop') return;
      e.preventDefault();
      cropSetZoom(crop.zoomExtra + (e.deltaY < 0 ? 12 : -12));
      syncCropZoomSlider(crop.zoomExtra);
    }, { passive: false });
  }
  window.addEventListener('resize', function () {
    if (currentRoute() === 'crop') cropLayout();
  });

  els.btnSave.addEventListener('click', openExportSheet);

  els.widthSlider.addEventListener('input', function () {
    state.width = Number(els.widthSlider.value);
    els.widthVal.textContent = String(state.width);
    scheduleRegen();
  });

  els.colorSlider.addEventListener('input', function () {
    state.maxColors = Number(els.colorSlider.value);
    els.colorVal.textContent = String(state.maxColors);
    scheduleRegen();
  });

  function findEl(start, sel, root) {
    var node = start && start.nodeType === 3 ? start.parentElement : start;
    while (node && node !== root) {
      if (node.matches && node.matches(sel)) return node;
      node = node.parentElement;
    }
    return null;
  }

  els.btnPalette.addEventListener('click', openPaletteSheet);
  els.paletteSheetBackdrop.addEventListener('click', closePaletteSheet);
  els.paletteSheetCancel.addEventListener('click', closePaletteSheet);

  els.paletteSheet.addEventListener('click', function (e) {
    var btn = findEl(e.target, '[data-palette]', els.paletteSheet);
    if (!btn) return;
    state.paletteId = btn.getAttribute('data-palette');
    syncPaletteButton();
    closePaletteSheet();
    scheduleRegen();
  });

  els.btnColors.addEventListener('click', openColorsSheet);
  els.colorsSheetBackdrop.addEventListener('click', closeColorsSheet);
  els.colorsSheetCancel.addEventListener('click', closeColorsSheet);

  els.colorsList.addEventListener('click', function (e) {
    var clear = findEl(e.target, '[data-clear]', els.colorsList);
    if (clear) {
      state.highlightCode = null;
      renderPreview();
      renderLegend();
      closeColorsSheet();
      return;
    }
    var btn = findEl(e.target, '[data-code]', els.colorsList);
    if (!btn) return;
    var code = btn.getAttribute('data-code');
    state.highlightCode = code;
    renderPreview();
    renderColorsList();
    renderLegend();
    closeColorsSheet();
  });

  els.btnGrid.addEventListener('click', function () {
    state.showGrid = !state.showGrid;
    setChip(els.btnGrid, state.showGrid);
    renderPreview();
  });

  if (els.btnSeam) {
    els.btnSeam.addEventListener('click', function () {
      state.showSeam = !state.showSeam;
      setChip(els.btnSeam, state.showSeam);
      renderPreview();
    });
  }

  els.btnDither.addEventListener('click', function () {
    state.dither = !state.dither;
    setChip(els.btnDither, state.dither);
    scheduleRegen();
  });

  els.btnMerge.addEventListener('click', function () {
    state.merge = !state.merge;
    setChip(els.btnMerge, state.merge);
    scheduleRegen();
  });

  els.btnAvg.addEventListener('click', function () {
    state.mode = state.mode === 'average' ? 'dominant' : 'average';
    setChip(els.btnAvg, state.mode === 'average');
    scheduleRegen();
  });

  syncPaletteButton();
  setChip(els.btnGrid, state.showGrid);
  if (els.btnSeam) setChip(els.btnSeam, state.showSeam);
  setChip(els.btnDither, state.dither);
  setChip(els.btnMerge, state.merge);
  setChip(els.btnAvg, state.mode === 'average');
  syncShareBtn();
  // 小程序桥可能注入较晚：前几秒内轮询几次，找到 postNote 即停
  (function watchShareBridge() {
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      syncShareBtn();
      if (hasPostNote() || tries >= 20) clearInterval(timer);
    }, 300);
  })();

  // 预览手势 + 视图工具栏（优先绑定，避免后续可选控件异常阻断）
  els.viewport.addEventListener('pointerdown', onVpDown);
  els.viewport.addEventListener('pointermove', onVpMove);
  els.viewport.addEventListener('pointerup', onVpUp);
  els.viewport.addEventListener('pointercancel', onVpUp);
  els.viewport.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });
  els.viewport.addEventListener('wheel', function (e) {
    if (!state.gridData || morphAnim || fit2dAnim || zoom3dAnim) return;
    e.preventDefault();
    var factor = Math.exp(-e.deltaY * 0.0016);
    if (state.view.mode === '2d') {
      var r = els.viewport.getBoundingClientRect();
      zoomAt2d(e.clientX - r.left, e.clientY - r.top, factor);
    } else {
      zoomAt3d(factor);
    }
  }, { passive: false });

  els.btn3d.addEventListener('click', function () {
    var going3d = morphAnim ? morphAnim.dir === 'to3d' : state.view.mode === '3d';
    setViewMode3d(!going3d);
  });
  els.btnFit.addEventListener('click', doResetView);
  if (els.btnZoomIn) els.btnZoomIn.addEventListener('click', function () { stepZoom(1); });
  if (els.btnZoomOut) els.btnZoomOut.addEventListener('click', function () { stepZoom(-1); });

  if (els.btnMore) {
    els.btnMore.addEventListener('click', function () {
      var willOpen = !isPanelOpen();
      // 展开设置就退出手绘（互斥），对应 iOS 点「更多」时的处理
      if (willOpen && state.editOn) setEditOn(false);
      setPanelOpen(willOpen);
      afterPanelToggle();
    });
  }
  if (els.btnPanelCollapse) {
    els.btnPanelCollapse.addEventListener('click', function () {
      if (!isPanelOpen()) return;
      setPanelOpen(false);
      afterPanelToggle();
    });
  }
  if (els.btnBoardAll) {
    els.btnBoardAll.addEventListener('click', function () {
      if (!state.gridData) return;
      if (state.boardIndex < 0) return;
      state.boardIndex = -1;
      afterBoardChange();
    });
  }

  // 拼板规格（可选，DOM 缺失时不影响预览交互）
  if (els.btnBoardSize && els.boardSizeSheet) {
    els.btnBoardSize.addEventListener('click', openBoardSizeSheet);
    els.boardSizeSheetBackdrop.addEventListener('click', closeBoardSizeSheet);
    els.boardSizeSheetCancel.addEventListener('click', closeBoardSizeSheet);
    els.boardSizeSheet.addEventListener('click', function (e) {
      var btn = findEl(e.target, '[data-board-size]', els.boardSizeSheet);
      if (!btn) return;
      applyBoardSize(btn.getAttribute('data-board-size'));
    });
    syncBoardSizeButton();
  }

  els.btnBoardPrev.addEventListener('click', function () {
    var total = state.boardsX * state.boardsY;
    if (total <= 1) {
      state.boardIndex = -1;
    } else if (state.boardIndex < 0) {
      state.boardIndex = total - 1;
    } else if (state.boardIndex === 0) {
      state.boardIndex = -1;
    } else {
      state.boardIndex -= 1;
    }
    afterBoardChange();
  });

  els.btnBoardNext.addEventListener('click', function () {
    var total = state.boardsX * state.boardsY;
    if (total <= 1) {
      state.boardIndex = -1;
    } else if (state.boardIndex < 0) {
      state.boardIndex = 0;
    } else if (state.boardIndex >= total - 1) {
      state.boardIndex = -1;
    } else {
      state.boardIndex += 1;
    }
    afterBoardChange();
  });

  // 导出图纸选项
  els.exportSheetBackdrop.addEventListener('click', closeExportSheet);
  els.exportSheetCancel.addEventListener('click', closeExportSheet);
  els.exportGo.addEventListener('click', doExport);
  if (els.exportShare) els.exportShare.addEventListener('click', doShare);
  els.expAxes.addEventListener('change', function () {
    state.exp.axes = els.expAxes.checked;
  });
  els.expCodes.addEventListener('change', function () {
    state.exp.codes = els.expCodes.checked;
  });
  els.expLegend.addEventListener('change', function () {
    state.exp.legend = els.expLegend.checked;
  });
  els.expMeta.addEventListener('change', function () {
    state.exp.meta = els.expMeta.checked;
  });
  function onBoardModeChange() {
    if (els.expModeEach && els.expModeEach.checked) state.exp.boardMode = 'each';
    else state.exp.boardMode = 'full';
    if (els.exportScope) {
      var total = state.boardsX * state.boardsY;
      if (total > 1) {
        els.exportScope.textContent = state.exp.boardMode === 'each'
          ? ('将依次导出 ' + total + ' 张分板图纸（每板含本板用量）')
          : '将导出整幅拼图（含分板线）';
      }
    }
  }
  if (els.expModeFull) els.expModeFull.addEventListener('change', onBoardModeChange);
  if (els.expModeEach) els.expModeEach.addEventListener('change', onBoardModeChange);

  // 手绘编辑事件
  if (els.btnEdit) {
    els.btnEdit.addEventListener('click', function () {
      if (!state.editOn) setEditOn(true);
    });
  }
  if (els.btnEditDone) {
    els.btnEditDone.addEventListener('click', function () {
      setEditOn(false);
    });
  }
  if (els.btnEditCancel) {
    els.btnEditCancel.addEventListener('click', cancelHandEdit);
  }
  if (els.etGroup) {
    els.etGroup.addEventListener('click', function (e) {
      var tb = findEl(e.target, '[data-tool]', els.etGroup);
      if (tb) {
        setTool(tb.getAttribute('data-tool'));
      }
    });
  }
  if (els.etPaint) {
    els.etPaint.addEventListener('click', openPickSheet);
  }
  if (els.pickSheetBackdrop) els.pickSheetBackdrop.addEventListener('click', closePickSheet);
  if (els.pickSheetCancel) els.pickSheetCancel.addEventListener('click', closePickSheet);
  if (els.pickList) {
    els.pickList.addEventListener('click', function (e) {
      var btn = findEl(e.target, '[data-code]', els.pickList);
      if (!btn) return;
      var code = btn.getAttribute('data-code');
      if (pickColorByCode(code)) {
        syncColorChip();
        closePickSheet();
      }
    });
  }
  if (els.etUndo) els.etUndo.addEventListener('click', undoEdit);
  if (els.etRedo) els.etRedo.addEventListener('click', redoEdit);
  if (els.etClear) els.etClear.addEventListener('click', clearEdits);
  if (els.etFit) els.etFit.addEventListener('click', doResetView);
  if (els.etZoomIn) els.etZoomIn.addEventListener('click', function () { stepZoom(1); });
  if (els.etZoomOut) els.etZoomOut.addEventListener('click', function () { stepZoom(-1); });

  // 长按保存浮层
  if (els.saveTipClose) els.saveTipClose.addEventListener('click', closeSaveTip);
  if (els.saveTipShare) {
    els.saveTipShare.addEventListener('click', function () {
      if (!saveTipItems.length) return;
      var item = saveTipItems[Math.min(saveTipShareIdx, saveTipItems.length - 1)];
      var blob;
      try { blob = dataUrlToBlob(item.dataUrl); } catch (e) { blob = null; }
      if (!blob) return;
      // 必须在用户手势里直接调 share
      var p = navigator.share({
        files: [new File([blob], item.filename || 'rabbit-bead.jpg', { type: blob.type || 'image/jpeg' })],
        title: '拼豆图纸'
      });
      if (p && p.then) {
        p.then(function () {
          if (saveTipShareIdx < saveTipItems.length - 1) saveTipShareIdx += 1;
          syncSaveTipShareBtn();
        }).catch(function () { /* 用户取消，保持原位 */ });
      }
    });
  }
  if (els.saveTip) {
    els.saveTip.addEventListener('click', function (e) {
      if (e.target === els.saveTip) closeSaveTip();
    });
  }

  syncModeUI();
  showPreviewHint(null);
  // 默认展开「更多」参数面板
  setPanelOpen(true, true);

  window.addEventListener('resize', function () {
    if (!state.gridData) return;
    // 转屏后可视高度变了：展开中的高度上限要重算，否则可能留一截空白或被切掉
    if (isPanelOpen()) els.panelWrap.style.maxHeight = panelFullH() + 'px';
    if (state.editOn) setEtGroupOpen(true, true);
    syncViewportResize();
  });

  // 容器尺寸变化就重新适配（转屏、「更多」面板过渡、编辑条显隐都会触发）。
  // 尺寸连续变化的这几百毫秒里逐帧跟随，收尾即对得上。
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(function () {
      // 动画进行中不插手，避免和动画抢 state.view
      if (fit2dAnim || morphAnim || zoom3dAnim) return;
      syncViewportResize();
    }).observe(els.viewport);
  }

  showScreen('home', { instant: true });
})();
