(function () {
  'use strict';

  var BOARD = 29;
  var CELL = 16;
  var EXPORT_CELL = 28;

  var GRID_COLOR = '#c7c7cc';
  var SEAM_COLOR = '#ff3b30';

  // 2D 预览视图：内容像素里每格 = PRE_CS，格线 = PRE_GAP
  var PRE_CS = 16;
  var PRE_GAP = 1;
  var CODE_SHOW_CELL = 30; // 屏幕像素每格 ≥ 该值时在格内绘制色号
  var CODE_SHOW_FONT = 0.36;
  var MAX_ZOOM = 6.5; // 相对内容像素的最大放大倍数（格宽最大约 104px）

  var state = {
    image: null,
    paletteId: 'mard',
    width: 29,
    maxColors: 48,
    mode: 'dominant',
    dither: false,
    merge: true,
    mergeThreshold: 48,
    showGrid: true,
    gridData: null,
    counts: null,
    height: 0,
    boardIndex: -1,
    boardsX: 1,
    boardsY: 1,
    highlightCode: null,
    busy: false,
    view: { mode: '2d', s: 1, tx: 0, ty: 0, fitS: 1 },
    view3d: { yaw: 0, pitch: 0.5, zoom: 1, init: false, baseF: 0, hFactor: 1, roundness: 1 },
    exp: { axes: false, codes: true, legend: true, meta: true }
  };

  var els = {
    screenHome: document.getElementById('screen-home'),
    screenEdit: document.getElementById('screen-edit'),
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
    btnBoardPrev: document.getElementById('btn-board-prev'),
    btnBoardNext: document.getElementById('btn-board-next'),
    btnReselect: document.getElementById('btn-reselect'),
    btnSave: document.getElementById('btn-save'),
    toast: document.getElementById('toast'),
    btnPalette: document.getElementById('btn-palette'),
    btnGrid: document.getElementById('btn-grid'),
    btnDither: document.getElementById('btn-dither'),
    btnMerge: document.getElementById('btn-merge'),
    btnAvg: document.getElementById('btn-avg'),
    btnColors: document.getElementById('btn-colors'),
    colorsPreview: document.getElementById('colors-preview'),
    colorsList: document.getElementById('colors-list'),
    paletteSheet: document.getElementById('palette-sheet'),
    paletteSheetBackdrop: document.getElementById('palette-sheet-backdrop'),
    paletteSheetCancel: document.getElementById('palette-sheet-cancel'),
    colorsSheet: document.getElementById('colors-sheet'),
    colorsSheetBackdrop: document.getElementById('colors-sheet-backdrop'),
    colorsSheetCancel: document.getElementById('colors-sheet-cancel'),
    btnFit: document.getElementById('btn-fit'),
    btn3dReset: document.getElementById('btn-3d-reset'),
    btn3d: document.getElementById('btn-3d'),
    viewHint: document.getElementById('view-hint'),
    exportSheet: document.getElementById('export-sheet'),
    exportSheetBackdrop: document.getElementById('export-sheet-backdrop'),
    exportSheetCancel: document.getElementById('export-sheet-cancel'),
    exportGo: document.getElementById('export-go'),
    exportScope: document.getElementById('export-scope'),
    expAxes: document.getElementById('exp-axes'),
    expCodes: document.getElementById('exp-codes'),
    expLegend: document.getElementById('exp-legend'),
    expMeta: document.getElementById('exp-meta')
  };

  var ctx = els.canvas.getContext('2d');
  var work = document.createElement('canvas');
  var workCtx = work.getContext('2d');
  var toastTimer = null;
  var regenTimer = null;
  var flatCache = { key: '', cv: null }; // 3D 大图平面模式纹理缓存
  var freshImage = false; // 新图刚载入时展示一次操作提示

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove('show');
    }, 1800);
  }

  function showScreen(name) {
    els.screenHome.classList.toggle('active', name === 'home');
    els.screenEdit.classList.toggle('active', name === 'edit');
  }

  function getPalette() {
    var p = window.BEAD_PALETTES[state.paletteId];
    if (!p) p = window.BEAD_PALETTES.mard;
    return p;
  }

  function buildPaletteCache(palette) {
    var list = [];
    var i;
    for (i = 0; i < palette.colors.length; i++) {
      var c = palette.colors[i];
      list.push({
        code: c[0],
        r: c[1],
        g: c[2],
        b: c[3],
        hex: rgbToHex(c[1], c[2], c[3])
      });
    }
    return list;
  }

  function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  }

  function rgbDist2(r1, g1, b1, r2, g2, b2) {
    var dr = r1 - r2;
    var dg = g1 - g2;
    var db = b1 - b2;
    return dr * dr + dg * dg + db * db;
  }

  function nearestColor(cache, r, g, b) {
    var best = cache[0];
    var bestD = Infinity;
    var i;
    for (i = 0; i < cache.length; i++) {
      var c = cache[i];
      var d = rgbDist2(r, g, b, c.r, c.g, c.b);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
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
    workCtx.imageSmoothingEnabled = true;
    workCtx.imageSmoothingQuality = 'high';
    workCtx.drawImage(img, 0, 0, tw, th);
    return workCtx.getImageData(0, 0, tw, th);
  }

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
        if (pixels[o + 3] < 128) continue;
        var r = pixels[o];
        var g = pixels[o + 1];
        var b = pixels[o + 2];
        n += 1;
        rSum += r;
        gSum += g;
        bSum += b;
        if (mode === 'dominant') {
          var key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
          var bucket = freq[key];
          if (!bucket) {
            bucket = { n: 0, r: 0, g: 0, b: 0 };
            freq[key] = bucket;
          }
          bucket.n += 1;
          bucket.r += r;
          bucket.g += g;
          bucket.b += b;
          if (bucket.n > bestN) {
            bestN = bucket.n;
            bestKey = key;
          }
        }
      }
    }
    if (n === 0) return { r: 255, g: 255, b: 255 };
    if (mode === 'dominant' && bestKey != null) {
      var win = freq[bestKey];
      return {
        r: Math.round(win.r / win.n),
        g: Math.round(win.g / win.n),
        b: Math.round(win.b / win.n)
      };
    }
    return {
      r: Math.round(rSum / n),
      g: Math.round(gSum / n),
      b: Math.round(bSum / n)
    };
  }

  function sampleCells(img, w, h, mode) {
    var src = readSourcePixels(img);
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

  function limitColors(mapped, samples, maxColors) {
    var counts = {};
    var i;
    for (i = 0; i < mapped.length; i++) {
      var code = mapped[i].code;
      counts[code] = (counts[code] || 0) + 1;
    }
    var codes = Object.keys(counts);
    if (codes.length <= maxColors) return mapped;

    codes.sort(function (a, b) { return counts[b] - counts[a]; });
    var keep = {};
    var keepList = [];
    var byCode = {};
    for (i = 0; i < mapped.length; i++) {
      byCode[mapped[i].code] = mapped[i];
    }
    for (i = 0; i < maxColors; i++) {
      keep[codes[i]] = true;
      keepList.push(byCode[codes[i]]);
    }

    for (i = 0; i < mapped.length; i++) {
      if (!keep[mapped[i].code]) {
        var s = samples[i];
        mapped[i] = nearestColor(keepList, s.r, s.g, s.b);
      }
    }
    return mapped;
  }

  function mergeSimilarRegions(mapped, w, h, threshold) {
    var total = w * h;
    var visited = new Uint8Array(total);
    var thr2 = threshold * threshold;
    var out = mapped.slice();
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var i;
    for (i = 0; i < total; i++) {
      if (visited[i]) continue;
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
          if (rgbDist2(c0.r, c0.g, c0.b, c1.r, c1.g, c1.b) > thr2) continue;
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

  function mapImage() {
    if (!state.image) return;
    var img = state.image;
    var w = state.width;
    var h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth));
    state.height = h;
    state.boardsX = Math.ceil(w / BOARD);
    state.boardsY = Math.ceil(h / BOARD);

    // 几何（图/宽）变化才复位视图；调色/限色/合并/抖动保持当前缩放位置
    var geomKey = w + 'x' + img.naturalWidth + 'x' + img.naturalHeight;
    var geomChanged = geomKey !== state.geomKey;
    state.geomKey = geomKey;

    var cache = buildPaletteCache(getPalette());
    var samples = sampleCells(img, w, h, state.mode);
    var mapped;
    var i;

    if (state.dither) {
      mapped = applyDither(samples, w, h, cache);
    } else {
      mapped = new Array(w * h);
      for (i = 0; i < w * h; i++) {
        mapped[i] = nearestColor(cache, samples[i].r, samples[i].g, samples[i].b);
      }
    }

    if (state.merge) {
      mapped = mergeSimilarRegions(mapped, w, h, state.mergeThreshold);
    }
    mapped = limitColors(mapped, samples, state.maxColors);

    var counts = {};
    for (i = 0; i < mapped.length; i++) {
      var code = mapped[i].code;
      if (!counts[code]) {
        counts[code] = { code: code, hex: mapped[i].hex, r: mapped[i].r, g: mapped[i].g, b: mapped[i].b, n: 0 };
      }
      counts[code].n += 1;
    }

    state.gridData = mapped;
    state.counts = counts;
    if (!state.gen) state.gen = 0;
    state.gen += 1; // 色板/参数变更时让 3D 贴图缓存失效
    ensureDefaultHighlight(sortedCounts());
    if (state.boardIndex >= state.boardsX * state.boardsY) state.boardIndex = -1;
    renderLegend();
    updateMeta();
    if (geomChanged) {
      fitView();
    } else {
      renderPreview();
    }
    if (freshImage) {
      freshImage = false;
      showPreviewHint(state.view.mode === '3d'
        ? '单指拖动旋转视角 · 双指/滚轮缩放'
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
    var x0 = bx * BOARD;
    var y0 = by * BOARD;
    return {
      x0: x0,
      y0: y0,
      x1: Math.min(state.width, x0 + BOARD),
      y1: Math.min(state.height, y0 + BOARD)
    };
  }

  function isBoardSeam(globalCoord) {
    return globalCoord > 0 && globalCoord % BOARD === 0;
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
    var gap = showGrid ? 1 : 0;
    var canvasW = pw * cell + gap;
    var canvasH = ph * cell + gap;
    targetCtx.canvas.width = canvasW;
    targetCtx.canvas.height = canvasH;

    if (showGrid) {
      targetCtx.fillStyle = GRID_COLOR;
      targetCtx.fillRect(0, 0, canvasW, canvasH);
    }

    var y;
    var x;
    for (y = y0; y < y1; y++) {
      for (x = x0; x < x1; x++) {
        var c = mapped[y * w + x];
        // 选中色号定位：仅淡化其它格子，选中色号保持原色
        var dim = state.highlightCode && state.highlightCode !== c.code;
        targetCtx.fillStyle = dim ? mixHex(c.hex, '#FFFFFF', 0.72) : c.hex;
        var px = (x - x0) * cell + gap;
        var py = (y - y0) * cell + gap;
        targetCtx.fillRect(px, py, cell - gap, cell - gap);
      }
    }

    // 分板缝：盖住对应 gap 线，整条只画一次
    if (state.boardsX * state.boardsY > 1) {
      var seamW = Math.max(2, Math.round(cell / 10));
      targetCtx.fillStyle = SEAM_COLOR;
      for (x = x0 + 1; x < x1; x++) {
        if (isBoardSeam(x)) {
          targetCtx.fillRect((x - x0) * cell + gap - Math.floor(seamW / 2), 0, seamW, canvasH);
        }
      }
      for (y = y0 + 1; y < y1; y++) {
        if (isBoardSeam(y)) {
          targetCtx.fillRect(0, (y - y0) * cell + gap - Math.floor(seamW / 2), canvasW, seamW);
        }
      }
    }

    if (forExport && cell >= 22 && state.exp.codes) {
      targetCtx.font = Math.max(8, (cell * 0.32) | 0) + 'px sans-serif';
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';
      for (y = y0; y < y1; y++) {
        for (x = x0; x < x1; x++) {
          var bead = mapped[y * w + x];
          var lum = bead.r * 0.299 + bead.g * 0.587 + bead.b * 0.114;
          targetCtx.fillStyle = lum > 160 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)';
          targetCtx.fillText(
            bead.code,
            (x - x0) * cell + gap + (cell - gap) / 2,
            (y - y0) * cell + gap + (cell - gap) / 2
          );
        }
      }
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
    var gap = state.showGrid ? PRE_GAP : 0;
    return {
      rect: rect,
      pw: Math.max(0, pw),
      ph: Math.max(0, ph),
      gap: gap,
      cw: pw * PRE_CS + gap,
      ch: ph * PRE_CS + gap
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

  function clampView2d() {
    var m = previewMetrics();
    var v = viewportSize();
    if (!m.pw || !m.ph) return;
    var s = state.view.s;
    if (!isFinite(s) || s <= 0) s = state.view.fitS || 1;
    var fitS = state.view.fitS || 1;
    // 最远只能回落到「铺满视口」，最近放大到 MAX_ZOOM 倍
    s = Math.max(fitS, Math.min(MAX_ZOOM, s));
    state.view.s = s;
    var edge = 44;
    var cw = m.cw * s;
    var ch = m.ch * s;
    if (cw <= v.vw) {
      state.view.tx = (v.vw - cw) / 2;
    } else {
      state.view.tx = Math.max(v.vw - cw - edge, Math.min(edge, state.view.tx));
    }
    if (ch <= v.vh) {
      state.view.ty = (v.vh - ch) / 2;
    } else {
      state.view.ty = Math.max(v.vh - ch - edge, Math.min(edge, state.view.ty));
    }
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
    if (!c) return { code: '', hex: '#ffffff' };
    var hex = c.hex;
    if (state.highlightCode && state.highlightCode !== c.code) {
      hex = mixHex(hex, '#FFFFFF', 0.72);
    }
    return { code: c.code, hex: hex };
  }

  function luma(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return r * 0.299 + g * 0.587 + b * 0.114;
  }

  function render2d() {
    var m = previewMetrics();
    var v = viewportSize();
    if (!state.gridData || !m.pw || !m.ph) return;
    clampView2d();
    var vw = v.vw;
    var vh = v.vh;
    var dpr = syncCanvasSize(vw, vh);
    var s = state.view.s;
    var tx = state.view.tx;
    var ty = state.view.ty;
    var rect = m.rect;
    var gap = m.gap;
    var i;
    var j;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * tx, dpr * ty);

    // 可视内容范围（content px）
    var xmin = (0 - tx) / s;
    var ymin = (0 - ty) / s;
    var xmax = (vw - tx) / s;
    var ymax = (vh - ty) / s;
    var i0 = Math.max(0, Math.floor((xmin - gap) / PRE_CS));
    var j0 = Math.max(0, Math.floor((ymin - gap) / PRE_CS));
    var i1 = Math.min(m.pw, Math.ceil((xmax - gap) / PRE_CS));
    var j1 = Math.min(m.ph, Math.ceil((ymax - gap) / PRE_CS));
    if (i1 <= i0) i1 = i0 + 1;
    if (j1 <= j0) j1 = j0 + 1;

    if (gap) {
      ctx.fillStyle = GRID_COLOR;
      ctx.fillRect(0, 0, m.cw, m.ch);
    }

    var mapped = state.gridData;
    var wAll = state.width;
    for (j = j0; j < j1; j++) {
      var gr = rect.y0 + j;
      for (i = i0; i < i1; i++) {
        var gcol = rect.x0 + i;
        var c = mapped[gr * wAll + gcol];
        var col = c.hex;
        if (state.highlightCode && state.highlightCode !== c.code) {
          col = mixHex(col, '#FFFFFF', 0.72);
        }
        ctx.fillStyle = col;
        ctx.fillRect(i * PRE_CS + gap, j * PRE_CS + gap, PRE_CS - gap, PRE_CS - gap);
      }
    }

    // 分板红线（整图模式且多板时）
    if (state.boardIndex < 0 && state.boardsX * state.boardsY > 1) {
      var seamW = Math.max(2, Math.round(PRE_CS / 8));
      ctx.fillStyle = SEAM_COLOR;
      for (i = 1; i < m.pw; i++) {
        if (isBoardSeam(rect.x0 + i)) {
          ctx.fillRect(i * PRE_CS + gap - Math.floor(seamW / 2), 0, seamW, m.ch);
        }
      }
      for (j = 1; j < m.ph; j++) {
        if (isBoardSeam(rect.y0 + j)) {
          ctx.fillRect(0, j * PRE_CS + gap - Math.floor(seamW / 2), m.cw, seamW);
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
          var hex = bead.hex;
          if (state.highlightCode && state.highlightCode !== bead.code) {
            hex = mixHex(hex, '#FFFFFF', 0.72);
          }
          ctx.fillStyle = luma(hex) > 160 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)';
          ctx.fillText(bead.code, i * PRE_CS + (PRE_CS + gap) / 2, j * PRE_CS + (PRE_CS + gap) / 2);
        }
      }
    }
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
  var BEAD3D_LIMIT = 2200; // 逐豆空心圆柱上限，超过用平面贴图近似
  var BEAD_SEGS = 16;      // 圆周分段（越多越圆）

  function shadeHex(hex, f) {
    // f<0 加深、f>0 提亮（相对黑白）
    if (f < 0) return mixHex(hex, '#000000', Math.min(1, -f));
    return mixHex(hex, '#FFFFFF', Math.min(1, f));
  }

  function flatTexture3d(m) {
    var key = (state.gen || 0) + '|' + state.boardIndex + '|' + m.pw + 'x' + m.ph + '|' + (state.showGrid ? 1 : 0) + '|' + state.width + 'x' + state.height;
    if (flatCache.key === key && flatCache.cv) return flatCache.cv;
    var maxSide = 1560;
    var cell = Math.max(2, Math.floor(maxSide / Math.max(m.pw, m.ph)));
    var cv = document.createElement('canvas');
    drawPattern(cv.getContext('2d'), cell, state.showGrid, boardRect(state.boardIndex), false);
    flatCache.key = key;
    flatCache.cv = cv;
    return cv;
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  var morphAnim = null;

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

  function render3d() {
    var m = previewMetrics();
    var v = viewportSize();
    if (!state.gridData || !m.pw || !m.ph) return;
    var vw = v.vw;
    var vh = v.vh;
    var dpr = syncCanvasSize(vw, vh);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

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
    // 圆外半径 / 方半宽：有格线时与 2D 格缝比例一致，全程保留缝以便颜色可插值
    var ro = 0.46;
    var sq = state.showGrid ? (0.5 * (PRE_CS - PRE_GAP) / PRE_CS) : 0.5;
    var ri = 0.17;
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
    }

    // 底板与格缝底色随 t3d 插值：2D 灰格线 ↔ 3D 黑底板，避免突变
    var viewBg = '#e5e5ea';
    var plateDark = '#232329';
    var seam2d = state.showGrid ? GRID_COLOR : viewBg;
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
    var segs = totalCells > 1400 ? 10 : BEAD_SEGS;
    var cosT = new Array(segs);
    var sinT = new Array(segs);
    var si;
    for (si = 0; si < segs; si++) {
      var ang = (si / segs) * Math.PI * 2;
      cosT[si] = Math.cos(ang);
      sinT[si] = Math.sin(ang);
    }

    function outlineOffset(i) {
      var c = cosT[i];
      var s = sinT[i];
      var circX = c * ro;
      var circZ = s * ro;
      var ax = Math.abs(c);
      var az = Math.abs(s);
      var k = sq / Math.max(ax, az, 1e-6);
      return [circX * roundness + c * k * (1 - roundness), circZ * roundness + s * k * (1 - roundness)];
    }

    function ringAt(cx, y, cz, useInner) {
      var pts = [];
      var i;
      for (i = 0; i < segs; i++) {
        var o = outlineOffset(i);
        var ox = o[0];
        var oz = o[1];
        if (useInner) {
          var ir = ri * roundness;
          var len = Math.sqrt(ox * ox + oz * oz) || 1;
          ox = ox / len * ir;
          oz = oz / len * ir;
        }
        var u = toU(cx + ox, y, cz + oz);
        if (!u) return null;
        pts.push(u);
      }
      return pts;
    }

    // 圆↔方 1:1 变形；空心仅顶面暗孔
    function drawBead(cx, cz, hex) {
      var topO = ringAt(cx, hB, cz, false);
      if (!topO) return;
      var topI = roundness > 0.2 ? ringAt(cx, hB, cz, true) : null;
      var botO = hFactor > 0.06 ? ringAt(cx, 0, cz, false) : null;
      var wall = shadeHex(hex, -0.36);
      var wallDark = shadeHex(hex, -0.58);
      var rim = roundness > 0.5 ? shadeHex(hex, 0.08) : hex;
      var hole = mixHex(hex, '#0c0c10', 0.78);
      var i;
      var n1 = segs - 1;
      if (botO) {
        for (i = 0; i < segs; i++) {
          var j = i === n1 ? 0 : i + 1;
          var o0 = outlineOffset(i);
          var o1 = outlineOffset(j);
          var mx = (o0[0] + o1[0]) * 0.5;
          var mz = (o0[1] + o1[1]) * 0.5;
          var facing = mx * (eyex - cx) + mz * (eyez - cz);
          if (facing < 0) continue;
          fillPolyPts([topO[i], topO[j], botO[j], botO[i]], facing > 0.35 ? wall : wallDark);
        }
      }
      fillPolyPts(topO, rim);
      if (topI && roundness > 0.25) fillPolyPts(topI, hole);
    }

    if (totalCells <= BEAD3D_LIMIT) {
      var order = [];
      var jj, ii;
      for (jj = 0; jj < ph; jj++) {
        for (ii = 0; ii < pw; ii++) {
          var cu = toU(ii - halfX, hB * 0.5, jj - halfZ);
          if (!cu) continue;
          order.push([ii, jj, cu[2]]);
        }
      }
      order.sort(function (a, b) { return b[2] - a[2]; });

      var oi;
      for (oi = 0; oi < order.length; oi++) {
        var oc = order[oi];
        ii = oc[0];
        jj = oc[1];
        var bead = baseCellAt(rect.x0 + ii, rect.y0 + jj);
        drawBead(ii - halfX, jj - halfZ, bead.hex);
      }

      // 接近俯视扁平且够大时画出色号，与 2D 放大态衔接（随 t3d 淡出）
      var cellPx = F / Math.max(0.2, eyeR - lookY);
      var codeFade = Math.max(0, Math.min(1, (1 - t3d) * 1.35)) *
        Math.max(0, Math.min(1, (pitch - 0.95) / 0.4));
      if (codeFade > 0.05 && cellPx >= CODE_SHOW_CELL * 0.92) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = codeFade;
        ctx.font = Math.round(cellPx * CODE_SHOW_FONT) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (oi = 0; oi < order.length; oi++) {
          oc = order[oi];
          ii = oc[0];
          jj = oc[1];
          var bead2 = baseCellAt(rect.x0 + ii, rect.y0 + jj);
          var hex2 = bead2.hex;
          if (state.highlightCode && state.highlightCode !== bead2.code) {
            hex2 = mixHex(hex2, '#FFFFFF', 0.72);
          }
          var cu2 = toU(ii - halfX, hB, jj - halfZ);
          if (!cu2) continue;
          ctx.fillStyle = luma(hex2) > 160 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)';
          ctx.fillText(bead2.code, SX(cu2), SY(cu2));
        }
        ctx.globalAlpha = 1;
      }
    } else {
      var tex = flatTexture3d(m);
      var texW = tex.width;
      var texH = tex.height;
      var zA = -maxZ;
      var zB = maxZ;
      var S = Math.max(6, Math.min(48, Math.ceil(Math.max(pw, ph) * 0.7)));
      var pTl, pTr, pBl;
      for (si = 0; si < S; si++) {
        var zz0 = zA + (zB - zA) * si / S;
        var zz1 = zA + (zB - zA) * (si + 1) / S;
        var sy0 = Math.floor(texH * si / S);
        var sy1 = Math.floor(texH * (si + 1) / S);
        var sh = Math.max(1, sy1 - sy0);
        pTl = toU(-maxX, hB, zz0);
        pTr = toU(maxX, hB, zz0);
        pBl = toU(-maxX, hB, zz1);
        if (!pTl || !pTr || !pBl) continue;
        var wTex = texW;
        var a3 = (SX(pTr) - SX(pTl)) / wTex;
        var b3 = (SY(pTr) - SY(pTl)) / wTex;
        var c3 = (SX(pBl) - SX(pTl)) / sh;
        var d3 = (SY(pBl) - SY(pTl)) / sh;
        ctx.setTransform(
          a3 * dpr, b3 * dpr, c3 * dpr, d3 * dpr,
          (SX(pTl) - c3 * sy0) * dpr, (SY(pTl) - d3 * sy0) * dpr
        );
        ctx.drawImage(tex, 0, sy0, wTex, sh, 0, sy0, wTex, sh);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function updateBoardLabel() {
    var total = state.boardsX * state.boardsY;
    if (state.boardIndex < 0) {
      els.boardLabel.textContent = '全图 · ' + state.boardsX + '×' + state.boardsY + ' 板';
    } else {
      els.boardLabel.textContent = '第 ' + (state.boardIndex + 1) + '/' + total + ' 板';
    }
  }

  function updateMeta() {
    var total = state.width * state.height;
    var colors = Object.keys(state.counts || {}).length;
    var cmW = (state.width * 0.5).toFixed(1);
    var cmH = (state.height * 0.5).toFixed(1);
    els.metaLine.textContent =
      state.width + '×' + state.height + ' · ' +
      colors + '色 · ' + total + '颗 · ' +
      cmW + '×' + cmH + 'cm · ' +
      state.boardsX + '×' + state.boardsY + '板';
    els.headerSub.textContent = getPalette().name + ' · ' + state.width + ' 豆宽';
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
      '<span class="colors-clear" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="currentColor">' +
      '<rect x="3.5" y="3.5" width="7.6" height="7.6" rx="1.8"></rect>' +
      '<rect x="12.9" y="3.5" width="7.6" height="7.6" rx="1.8"></rect>' +
      '<rect x="3.5" y="12.9" width="7.6" height="7.6" rx="1.8"></rect>' +
      '<rect x="12.9" y="12.9" width="7.6" height="7.6" rx="1.8"></rect>' +
      '</svg></span>' +
      '<span class="colors-item-code">全选</span>';
    els.colorsList.appendChild(clearBtn);

    var i;
    for (i = 0; i < list.length; i++) {
      var item = list[i];
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'colors-item' + (state.highlightCode === item.code ? ' is-on' : '');
      el.setAttribute('data-code', item.code);
      el.innerHTML =
        '<span class="colors-swatch" style="background:' + item.hex + '"></span>' +
        '<span class="colors-item-code">' + item.code + '</span>' +
        '<span class="colors-item-count">' + item.n + '</span>';
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

  function openColorsSheet() {
    renderColorsList();
    openSheet(els.colorsSheet);
  }

  function closeColorsSheet() {
    closeSheet(els.colorsSheet);
  }

  function loadFile(file) {
    if (!file) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      state.image = img;
      state.boardIndex = -1;
      state.highlightCode = null;
      showScreen('edit');
      freshImage = true;
      mapImage();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      toast('图片读取失败');
    };
    img.src = url;
  }

  function exportDataUrl() {
    var exp = state.exp;
    var axes = !!exp.axes;
    var showLegend = !!exp.legend;
    var showMeta = !!exp.meta;

    var rect = boardRect(state.boardIndex);
    var pw = rect.x1 - rect.x0;
    var ph = rect.y1 - rect.y0;

    // 图案画布（含格线/分板线/格内色号开关）
    var pattern = document.createElement('canvas');
    var pctx = pattern.getContext('2d');
    drawPattern(pctx, EXPORT_CELL, state.showGrid, rect, true);

    // 本板色号用量列表（按用量降序）
    var counts = state.counts || {};
    var list = Object.keys(counts).map(function (k) { return counts[k]; });
    list.sort(function (a, b) { return b.n - a.n; });
    if (state.boardIndex >= 0) {
      var local = {};
      var yy;
      var xx;
      for (yy = rect.y0; yy < rect.y1; yy++) {
        for (xx = rect.x0; xx < rect.x1; xx++) {
          var cc = state.gridData[yy * state.width + xx];
          local[cc.code] = (local[cc.code] || 0) + 1;
        }
      }
      list = list.filter(function (it) { return local[it.code]; }).map(function (it) {
        return { code: it.code, hex: it.hex, n: local[it.code] };
      });
    }

    var pad = 16;
    var cell = EXPORT_CELL;
    var gap = state.showGrid ? 1 : 0;
    var axisTop = axes ? Math.round(cell * 0.75) : 0;
    var axisLeft = axes ? Math.max(20, Math.round(cell * 0.9)) : 0;
    var metaH = showMeta ? 50 : 0;
    var x0 = pad + axisLeft;
    var y0 = pad + metaH + axisTop;

    var outW = x0 + pattern.width + pad;
    var legendCols = Math.max(1, Math.min(6, Math.floor((outW - pad * 2 - 6) / 96)));
    var legendRows = showLegend && list.length ? Math.ceil(list.length / legendCols) : 0;
    var legendTop = y0 + pattern.height + (legendRows ? 18 : 0);
    var legendH = legendRows ? legendRows * 24 + 6 : 0;
    var outH = (showLegend && list.length)
      ? legendTop + legendH + pad
      : y0 + pattern.height + pad;

    var out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    var octx = out.getContext('2d');
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, outW, outH);

    if (showMeta) {
      octx.fillStyle = '#1a1a1a';
      octx.font = 'bold 16px sans-serif';
      octx.fillText('兔格拼豆 · ' + getPalette().name, pad, pad + 16);
      octx.font = '12px sans-serif';
      octx.fillStyle = '#666';
      var title = state.width + '×' + state.height + ' · ' +
        (state.boardIndex < 0 ? '全图' : '第' + (state.boardIndex + 1) + '板');
      if (axes) title += ' · 坐标版';
      octx.fillText(title, pad, pad + 36);
    }

    octx.drawImage(pattern, x0, y0);

    // 行列坐标
    if (axes && pw > 0 && ph > 0) {
      var axFont = Math.max(10, Math.round(cell * 0.42));
      octx.font = axFont + 'px sans-serif';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillStyle = '#333';
      var i;
      var j;
      for (i = 0; i < pw; i++) {
        // drawPattern 中每列左缘 = i*cell+gap、宽 cell-gap，故中心 = i*cell+(cell+gap)/2
        var colCx = x0 + i * cell + (cell + gap) / 2;
        octx.fillText(String(rect.x0 + i + 1), colCx, y0 - axisTop / 2 - 1);
        octx.fillStyle = 'rgba(0,0,0,0.08)';
        octx.fillRect(colCx - 0.5, y0 - 2, 1, 4);
        octx.fillStyle = '#333';
      }
      octx.textAlign = 'right';
      for (j = 0; j < ph; j++) {
        var rowCy = y0 + j * cell + (cell + gap) / 2;
        octx.fillText(String(rect.y0 + j + 1), x0 - 6, rowCy);
        octx.fillStyle = 'rgba(0,0,0,0.08)';
        octx.fillRect(x0 - 2, rowCy - 0.5, 4, 1);
        octx.fillStyle = '#333';
      }
      octx.textAlign = 'start';
      octx.textBaseline = 'alphabetic';
    }

    // 用量图例
    if (showLegend && list.length) {
      var colW = (outW - pad * 2) / legendCols;
      octx.font = '12px sans-serif';
      for (var k = 0; k < list.length; k++) {
        var item = list[k];
        var lx = pad + (k % legendCols) * colW;
        var lyy = legendTop + ((k / legendCols) | 0) * 24;
        octx.fillStyle = item.hex;
        octx.fillRect(lx, lyy, 12, 12);
        octx.strokeStyle = 'rgba(0,0,0,0.15)';
        octx.strokeRect(lx + 0.5, lyy + 0.5, 11, 11);
        octx.fillStyle = '#333';
        octx.fillText(item.code + ' ' + item.n, lx + 16, lyy + 11);
      }
    }
    return out.toDataURL('image/png');
  }

  function saveToAlbum() {
    if (!state.gridData || state.busy) return;
    state.busy = true;
    els.btnSave.disabled = true;
    els.exportGo.disabled = true;
    var dataUrl = exportDataUrl();

    function done(ok, msg) {
      state.busy = false;
      els.btnSave.disabled = false;
      els.exportGo.disabled = false;
      toast(ok ? (msg || '已保存到相册') : (msg || '保存失败'));
    }

    if (window.xhs && window.xhs.miniTool && window.xhs.miniTool.writeTempFile) {
      window.xhs.miniTool.writeTempFile({ data: dataUrl }).then(function (res) {
        return window.xhs.miniTool.saveImageToPhotosAlbum({ filePath: res.filePath });
      }).then(function () {
        done(true);
      }).catch(function (err) {
        done(false, (err && err.errMsg) || '保存失败');
      });
      return;
    }

    // local fallback for browser preview
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'bead-pattern.png';
    a.click();
    done(true, '已下载图纸');
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
    if (!state.gridData || state.view.mode !== '2d') return;
    var minS = state.view.fitS || 1;
    var s0 = state.view.s || minS;
    var s1;
    if (factor) {
      s1 = s0 * factor;
    } else {
      // 双击：已放大则回落到铺满，否则放大两档
      s1 = s0 > minS * 1.35 ? minS : Math.max(minS * 1.01, s0 * 2.3);
    }
    s1 = Math.max(minS, Math.min(MAX_ZOOM, s1));
    var wx = (cx - state.view.tx) / s0;
    var wy = (cy - state.view.ty) / s0;
    state.view.s = s1;
    state.view.tx = cx - wx * s1;
    state.view.ty = cy - wy * s1;
    clampView2d();
    renderPreview();
  }

  function zoomAt3d(factor) {
    if (!state.gridData || state.view.mode !== '3d' || morphAnim) return;
    var s3 = state.view3d;
    var z0 = s3.zoom == null ? 1 : s3.zoom;
    s3.zoom = Math.max(0.45, Math.min(3.5, z0 * factor));
    renderPreview();
  }

  function syncModeUI() {
    var is3 = state.view.mode === '3d';
    els.btn3d.textContent = is3 ? '2D' : '3D';
    els.btn3d.classList.toggle('vt-on', is3);
    els.btn3d.setAttribute('aria-pressed', is3 ? 'true' : 'false');
    els.btnFit.hidden = is3;
    els.btn3dReset.hidden = !is3;
  }

  function setViewMode3d(on) {
    if (!state.gridData) return;
    if (morphAnim) {
      if ((on && morphAnim.dir === 'to3d') || (!on && morphAnim.dir === 'to2d')) return;
    } else if (on === (state.view.mode === '3d')) {
      return;
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
    var dur = 780;

    if (on) {
      // 2D→3D：F/pan 与当前 2D 格心严格对齐，再同时回中升起
      state.view.mode = '3d';
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
        fromYaw = topYaw;
        fromPitch = topPitch;
        fromH = flatH;
        fromR = 0;
        fromF = fr.F;
        fromPanX = fr.panX;
        fromPanY = fr.panY;
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
        panY0: fromPanY, panY1: 0
      };
      syncModeUI();
      showPreviewHint('单指拖动旋转视角 · 双指/滚轮缩放');
      tickMorph();
    } else {
      // 3D→2D：压扁俯视并对齐铺满取景，再切 2D
      state.view.mode = '3d';
      if (!s3.baseF) s3.baseF = orbitF;
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
        panY0: fromPanY, panY1: 0
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

    s3.yaw = ma.yaw0 + (ma.yaw1 - ma.yaw0) * e;
    s3.pitch = ma.pitch0 + (ma.pitch1 - ma.pitch0) * e;
    s3.hFactor = ma.h0 + (ma.h1 - ma.h0) * e;
    s3.roundness = ma.r0 + (ma.r1 - ma.r0) * e;
    s3.morphF = ma.f0 + (ma.f1 - ma.f0) * e;
    s3.panX = (ma.panX0 || 0) + ((ma.panX1 || 0) - (ma.panX0 || 0)) * e;
    s3.panY = (ma.panY0 || 0) + ((ma.panY1 || 0) - (ma.panY0 || 0)) * e;
    render3d();
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
    pinch: null
  };

  function vpPos(e) {
    return { x: e.clientX - gd.rect.left, y: e.clientY - gd.rect.top };
  }

  function isToolBtn(target) {
    return !!findEl(target, '.vt-btn', els.viewport);
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

    if (gd.count === 1) {
      gd.prevX = p.x;
      gd.prevY = p.y;
      gd.travX = 0;
      gd.travY = 0;
      var now = Date.now();
      if (state.view.mode === '2d' && now - gd.lastTapT < 340 &&
        Math.abs(p.x - gd.lastTapX) < 46 && Math.abs(p.y - gd.lastTapY) < 46) {
        gd.lastTapT = 0;
        gd.tapBlock = true;
        zoomAt2d(p.x, p.y, 0);
      } else {
        gd.lastTapT = now;
        gd.lastTapX = p.x;
        gd.lastTapY = p.y;
        gd.tapBlock = false;
      }
    } else if (gd.count === 2) {
      var q = twoPtList();
      if (q) {
        var s3 = state.view3d;
        gd.pinch = {
          d0: q.d, ax: q.mx, ay: q.my,
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
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      if (state.view.mode === '2d') {
        state.view.tx += dx;
        state.view.ty += dy;
        requestRender();
      } else {
        if (morphAnim) return;
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
        var minS = state.view.fitS || 1;
        var s1 = Math.max(minS, Math.min(MAX_ZOOM, gd.pinch.s0 * k));
        var wxx = (gd.pinch.ax - gd.pinch.tx0) / gd.pinch.s0;
        var wyy = (gd.pinch.ay - gd.pinch.ty0) / gd.pinch.s0;
        state.view.s = s1;
        state.view.tx = q.mx - wxx * s1;
        state.view.ty = q.my - wyy * s1;
        requestRender();
      } else {
        if (morphAnim) return;
        // 双指只缩放，不附带旋转，避免挪动时误缩放感
        var s32 = state.view3d;
        s32.zoom = Math.max(0.45, Math.min(3.5, gd.pinch.zoom0 * k));
        requestRender();
      }
    }
  }

  function onVpUp(e) {
    if (!gd.pointers[e.pointerId]) return;
    delete gd.pointers[e.pointerId];
    gd.count = Object.keys(gd.pointers).length;
    if (gd.count === 1) {
      // 回到单指：以剩余触点续拖
      var ids = Object.keys(gd.pointers);
      var rem = gd.pointers[ids[0]];
      gd.prevX = rem.x;
      gd.prevY = rem.y;
      gd.pinch = null;
      gd.tapBlock = false;
    } else if (gd.count === 0) {
      gd.pinch = null;
      gd.tapBlock = false;
      if (state.view.mode === '2d') {
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
  }

  function openExportSheet() {
    if (!state.gridData || state.busy) return;
    syncExpBoxes();
    if (els.exportScope) {
      var total = state.boardsX * state.boardsY;
      if (total <= 1) {
        els.exportScope.textContent = '将导出整幅图纸（单板）';
      } else if (state.boardIndex < 0) {
        els.exportScope.textContent = '当前为全图预览 → 导出整幅拼图（含分板线）。拼豆时一般按板制作，可先切到单板再导出。';
      } else {
        els.exportScope.textContent = '当前为第 ' + (state.boardIndex + 1) + '/' + total + ' 板 → 只导出这一板（含本板用量），适合按板拼豆。';
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

  // events
  els.fileInput.addEventListener('change', function () {
    var f = els.fileInput.files && els.fileInput.files[0];
    loadFile(f);
    els.fileInput.value = '';
  });

  els.btnReselect.addEventListener('click', function () {
    els.fileInput.click();
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
  setChip(els.btnDither, state.dither);
  setChip(els.btnMerge, state.merge);
  setChip(els.btnAvg, state.mode === 'average');

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
    fitView();
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
    fitView();
  });

  // 预览手势 + 视图工具栏
  els.viewport.addEventListener('pointerdown', onVpDown);
  els.viewport.addEventListener('pointermove', onVpMove);
  els.viewport.addEventListener('pointerup', onVpUp);
  els.viewport.addEventListener('pointercancel', onVpUp);
  els.viewport.addEventListener('wheel', function (e) {
    if (!state.gridData || morphAnim) return;
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
  els.btnFit.addEventListener('click', function () {
    if (!state.gridData) return;
    fitView();
  });
  els.btn3dReset.addEventListener('click', function () {
    if (!state.gridData) return;
    reset3dView();
  });

  // 导出图纸选项
  els.exportSheetBackdrop.addEventListener('click', closeExportSheet);
  els.exportSheetCancel.addEventListener('click', closeExportSheet);
  els.exportGo.addEventListener('click', doExport);
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

  syncModeUI();
  showPreviewHint(null);

  window.addEventListener('resize', function () {
    if (state.gridData) fitView();
  });

  showScreen('home');
})();
