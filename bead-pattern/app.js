(function () {
  'use strict';

  var CELL = 16;
  // 真实豆距约 5mm；按 300DPI 导出，打印「实际大小」时每格≈5mm
  var BEAD_MM = 5;
  var PRINT_DPI = 300;
  var EXPORT_CELL = Math.round(BEAD_MM / 25.4 * PRINT_DPI); // ≈59

  var GRID_COLOR = '#c7c7cc';
  var SEAM_COLOR = '#ff3b30';

  // 2D 预览视图：内容像素里每格 = PRE_CS；格线叠画在格子上，不占空间
  var PRE_CS = 16;
  var CODE_SHOW_CELL = 30; // 屏幕像素每格 ≥ 该值时在格内绘制色号
  var CODE_SHOW_FONT = 0.36;
  var MAX_ZOOM = 6.5; // 相对内容像素的最大放大倍数（格宽最大约 104px）

  var state = {
    image: null,
    paletteId: 'mard',
    width: 29,
    boardSize: 29,
    maxColors: 48,
    mode: 'dominant',
    dither: false,
    merge: false,
    mergeThreshold: 40,
    showGrid: true,
    showSeam: true,
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
    exp: { axes: false, codes: true, legend: true, meta: true, boardMode: 'full' }
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
    btnSeam: document.getElementById('btn-seam'),
    btnDither: document.getElementById('btn-dither'),
    btnMerge: document.getElementById('btn-merge'),
    btnAvg: document.getElementById('btn-avg'),
    btnColors: document.getElementById('btn-colors'),
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
    btn3d: document.getElementById('btn-3d'),
    btnBoardAll: document.getElementById('btn-board-all'),
    viewHint: document.getElementById('view-hint'),
    exportSheet: document.getElementById('export-sheet'),
    exportSheetBackdrop: document.getElementById('export-sheet-backdrop'),
    exportSheetCancel: document.getElementById('export-sheet-cancel'),
    exportGo: document.getElementById('export-go'),
    exportScope: document.getElementById('export-scope'),
    expAxes: document.getElementById('exp-axes'),
    expCodes: document.getElementById('exp-codes'),
    expLegend: document.getElementById('exp-legend'),
    expMeta: document.getElementById('exp-meta'),
    expBoardMode: document.getElementById('exp-board-mode'),
    expModeFull: document.getElementById('exp-mode-full'),
    expModeEach: document.getElementById('exp-mode-each')
  };

  // 强制 sRGB：宽色域屏（P3）默认 display-p3 会让 getImageData 偏色，和色卡对不上
  var CTX_OPTS = { colorSpace: 'srgb', willReadFrequently: true };
  var ctx = els.canvas.getContext('2d', { colorSpace: 'srgb' }) || els.canvas.getContext('2d');
  var work = document.createElement('canvas');
  var workCtx = work.getContext('2d', CTX_OPTS) || work.getContext('2d');
  var toastTimer = null;
  var regenTimer = null;
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
    try {
      return workCtx.getImageData(0, 0, tw, th, { colorSpace: 'srgb' });
    } catch (e) {
      return workCtx.getImageData(0, 0, tw, th);
    }
  }

  // 格内主导色：出现次数最多的像素 RGB（非均值）——对齐 Zippland/perler-beads
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
        if (mode === 'average') {
          rSum += srgbToLinear(r);
          gSum += srgbToLinear(g);
          bSum += srgbToLinear(b);
          continue;
        }
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
    if (n === 0) return { r: 255, g: 255, b: 255 };
    if (mode === 'average') {
      return {
        r: linearToSrgb(rSum / n),
        g: linearToSrgb(gSum / n),
        b: linearToSrgb(bSum / n)
      };
    }
    // 精确色过于分散（JPEG）→ 5bit 主导色
    if (bestN < 2 || (n > 40 && bestN * 12 < n)) {
      freq = {};
      bestKey = null;
      bestN = 0;
      for (y = y0; y < y1; y++) {
        for (x = x0; x < x1; x++) {
          var o2 = (y * sw + x) * 4;
          if (pixels[o2 + 3] < 128) continue;
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
        return {
          r: Math.round(win.r / win.n),
          g: Math.round(win.g / win.n),
          b: Math.round(win.b / win.n)
        };
      }
    }
    var top = freq[bestKey];
    return { r: top.r, g: top.g, b: top.b };
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
    var byCode = {};
    var i;
    for (i = 0; i < mapped.length; i++) {
      var c = mapped[i];
      counts[c.code] = (counts[c.code] || 0) + 1;
      byCode[c.code] = c;
    }
    var codes = Object.keys(counts);
    if (codes.length <= maxColors) return mapped;

    codes.sort(function (a, b) { return counts[b] - counts[a]; });
    var keep = {};
    var keepList = [];
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

  // BFS 相似色连通域合并（对齐 perler-beads：RGB 欧氏距离 < 阈值）
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

  // 抗锯齿灰边：很暗→黑、很亮且灰→白，避免描边变毛
  function cleanSampleRgb(r, g, b) {
    var max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    var chroma = max - min;
    var luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luma < 42 && chroma < 55) return { r: 0, g: 0, b: 0 };
    if (luma > 242 && chroma < 28) return { r: 255, g: 255, b: 255 };
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

    // 主色/均值：格内采样（对齐 zippland）；抖动同路径
    samples = sampleCells(img, w, h, state.mode === 'average' ? 'average' : 'dominant');
    for (i = 0; i < samples.length; i++) {
      samples[i] = cleanSampleRgb(samples[i].r, samples[i].g, samples[i].b);
    }
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
      targetCtx.strokeStyle = GRID_COLOR;
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
            (x - x0) * cell + cell / 2,
            (y - y0) * cell + cell / 2
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
    var cw = m.cw * s;
    var ch = m.ch * s;
    // 允许任意格点落到视口中心，避免双击角落放大后被硬夹紧跳动
    var edgeX = Math.max(44, v.vw * 0.5);
    var edgeY = Math.max(44, v.vh * 0.5);
    if (cw <= v.vw) {
      state.view.tx = (v.vw - cw) / 2;
    } else {
      state.view.tx = Math.max(v.vw - cw - edgeX, Math.min(edgeX, state.view.tx));
    }
    if (ch <= v.vh) {
      state.view.ty = (v.vh - ch) / 2;
    } else {
      state.view.ty = Math.max(v.vh - ch - edgeY, Math.min(edgeY, state.view.ty));
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
    // 略微外扩，避免缩放变换后亚像素缝露底
    var cellDraw = PRE_CS + 0.75;
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
        ctx.fillRect(i * PRE_CS, j * PRE_CS, cellDraw, cellDraw);
      }
    }

    // 格线叠画：线宽按屏幕约 1px，不挤占格面、开关不偏移
    if (state.showGrid) {
      ctx.strokeStyle = GRID_COLOR;
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
          var hex = bead.hex;
          if (state.highlightCode && state.highlightCode !== bead.code) {
            hex = mixHex(hex, '#FFFFFF', 0.72);
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
    var drawInner = lod >= 2 && roundness > 0.55 && hFactor > 0.1;
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
      if (botO) fillWallBand(topO, botO, offO, true, wall, wallDark);
      if (botI && topI) fillWallBand(topI, botI, offI, false, wallInLit, wallIn);

      if (topI && holeAmt > 0.45) {
        fillRing(topO, topI, rim);
      } else if (topI && holeAmt > 0.04) {
        fillRing(topO, null, rim);
        ctx.globalAlpha = holeAmt * baseA;
        fillRing(topI, null, mixHex(hex, '#0a0a0e', 0.75));
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
        var hex2 = bead2.hex;
        if (state.highlightCode && state.highlightCode !== bead2.code) {
          hex2 = mixHex(hex2, '#FFFFFF', 0.72);
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
      ctx.strokeStyle = GRID_COLOR;
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
    els.btnBoardPrev.hidden = !multi;
    els.btnBoardNext.hidden = !multi;
    if (els.btnBoardAll) {
      els.btnBoardAll.hidden = !(multi && state.boardIndex >= 0);
    }
    if (!multi) {
      els.boardLabel.hidden = true;
      els.boardLabel.textContent = '';
      return;
    }
    els.boardLabel.hidden = false;
    // 固定文案长度，避免箭头左右跳动
    if (state.boardIndex < 0) {
      els.boardLabel.textContent = '全图';
    } else {
      els.boardLabel.textContent = (state.boardIndex + 1) + '/' + total;
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
      state.boardSize + '×' + state.boardSize + '拼板 · ' +
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

  function exportDataUrl(boardIdx) {
    var exp = state.exp;
    var axes = !!exp.axes;
    var showLegend = !!exp.legend;
    var showMeta = !!exp.meta;
    var useIdx = boardIdx == null ? state.boardIndex : boardIdx;

    var rect = boardRect(useIdx);
    var pw = rect.x1 - rect.x0;
    var ph = rect.y1 - rect.y0;

    // 固定格宽：300DPI 下 1 格 = 5mm，打印「实际大小」即实物豆距
    var cell = EXPORT_CELL;

    // 图案画布（含格线/分板线/格内色号开关）
    var pattern = document.createElement('canvas');
    var pctx = pattern.getContext('2d');
    drawPattern(pctx, cell, state.showGrid, rect, true);

    // 本板色号用量列表（按用量降序）
    var counts = state.counts || {};
    var list = Object.keys(counts).map(function (k) { return counts[k]; });
    list.sort(function (a, b) { return b.n - a.n; });
    if (useIdx >= 0) {
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

    var pad = Math.max(28, Math.round(cell * 0.5));
    var axisTop = axes ? Math.round(cell * 0.75) : 0;
    var axisLeft = axes ? Math.max(32, Math.round(cell * 0.9)) : 0;
    var metaH = showMeta ? Math.round(cell * 2.2) : 0;
    var x0 = pad + axisLeft;
    var y0 = pad + metaH + axisTop;

    // 图例：圆角正方形 = 图纸格面边长
    var sw = cell;
    var swR = Math.max(8, Math.round(sw * 0.2));
    var itemGapX = Math.max(6, Math.round(sw * 0.12));
    var itemGapY = Math.max(8, Math.round(sw * 0.14));
    var countGap = Math.max(4, Math.round(sw * 0.08));
    var countH = Math.max(16, Math.round(sw * 0.32));
    var itemH = sw + countGap + countH;
    var outW = x0 + pattern.width + pad;
    var legendCols = showLegend && list.length
      ? Math.max(1, Math.floor((outW - pad * 2 + itemGapX) / (sw + itemGapX)))
      : 1;
    var legendRows = showLegend && list.length ? Math.ceil(list.length / legendCols) : 0;
    var legendTop = y0 + pattern.height + (legendRows ? Math.round(cell * 0.35) : 0);
    var legendH = legendRows ? legendRows * (itemH + itemGapY) - itemGapY : 0;
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
      var titleSize = Math.max(34, Math.round(cell * 0.58));
      var subSize = Math.max(22, Math.round(cell * 0.4));
      var tipSize = Math.max(16, Math.round(cell * 0.3));
      octx.fillStyle = '#1a1a1a';
      octx.font = 'bold ' + titleSize + 'px sans-serif';
      octx.fillText('兔格拼豆 · ' + getPalette().name, pad, pad + Math.round(titleSize * 0.95));
      octx.font = subSize + 'px sans-serif';
      octx.fillStyle = '#444';
      var title = state.width + '×' + state.height + ' · ' +
        (useIdx < 0 ? '全图' : '第' + (useIdx + 1) + '板') +
        ' · 每格' + BEAD_MM + 'mm';
      if (axes) title += ' · 坐标版';
      octx.fillText(title, pad, pad + titleSize + Math.round(subSize * 1.15));
      octx.fillStyle = '#777';
      octx.font = tipSize + 'px sans-serif';
      octx.fillText('打印请选「实际大小 / 100%」，勿勾选适应页面（' + PRINT_DPI + ' DPI）', pad, pad + titleSize + subSize + Math.round(tipSize * 1.9));
    }

    octx.drawImage(pattern, x0, y0);

    // 行列坐标
    if (axes && pw > 0 && ph > 0) {
      var axFont = Math.max(16, Math.round(cell * 0.42));
      octx.font = axFont + 'px sans-serif';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillStyle = '#333';
      var i;
      var j;
      for (i = 0; i < pw; i++) {
        var colCx = x0 + i * cell + cell / 2;
        octx.fillText(String(rect.x0 + i + 1), colCx, y0 - axisTop / 2 - 1);
        octx.fillStyle = 'rgba(0,0,0,0.08)';
        octx.fillRect(colCx - 0.5, y0 - 2, 1, 4);
        octx.fillStyle = '#333';
      }
      octx.textAlign = 'right';
      for (j = 0; j < ph; j++) {
        var rowCy = y0 + j * cell + cell / 2;
        octx.fillText(String(rect.y0 + j + 1), x0 - 8, rowCy);
        octx.fillStyle = 'rgba(0,0,0,0.08)';
        octx.fillRect(x0 - 2, rowCy - 0.5, 4, 1);
        octx.fillStyle = '#333';
      }
      octx.textAlign = 'start';
      octx.textBaseline = 'alphabetic';
    }

    // 用量图例（紧凑左起排布，色块边长 = 格面 × 2）
    if (showLegend && list.length) {
      var codeFont = Math.max(18, Math.round(sw * 0.38));
      var countFont = Math.max(15, Math.round(sw * 0.28));
      for (var k = 0; k < list.length; k++) {
        var item = list[k];
        var col = k % legendCols;
        var row = (k / legendCols) | 0;
        var lx = pad + col * (sw + itemGapX);
        var ly = legendTop + row * (itemH + itemGapY);
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
        octx.fillText(String(item.n), lx + sw / 2, ly + sw + countGap);
      }
      octx.textAlign = 'start';
      octx.textBaseline = 'alphabetic';
    }

    return jpegDataUrlWithDpi(out.toDataURL('image/jpeg', 0.92), PRINT_DPI);
  }

  function saveOneDataUrl(dataUrl, filename) {
    if (window.xhs && window.xhs.miniTool && window.xhs.miniTool.writeTempFile) {
      return window.xhs.miniTool.writeTempFile({ data: dataUrl }).then(function (res) {
        return window.xhs.miniTool.saveImageToPhotosAlbum({ filePath: res.filePath });
      });
    }
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename || 'bead-pattern.jpg';
    a.click();
    return Promise.resolve();
  }

  function saveToAlbum() {
    if (!state.gridData || state.busy) return;
    state.busy = true;
    els.btnSave.disabled = true;
    els.exportGo.disabled = true;

    var total = state.boardsX * state.boardsY;
    var boardMode = state.exp.boardMode || 'full';
    var useEach = boardMode === 'each' && total > 1;

    function done(ok, msg) {
      state.busy = false;
      els.btnSave.disabled = false;
      els.exportGo.disabled = false;
      toast(ok ? (msg || '已保存到相册') : (msg || '保存失败'));
    }

    if (!useEach) {
      var dataUrl = exportDataUrl(-1);
      saveOneDataUrl(dataUrl, 'bead-pattern-full.jpg').then(function () {
        done(true);
      }).catch(function (err) {
        done(false, (err && err.errMsg) || '保存失败');
      });
      return;
    }

    // 分板逐个导出
    var idx = 0;
    function next() {
      if (idx >= total) {
        done(true, '已导出 ' + total + ' 张分板图纸');
        return;
      }
      var boardNo = idx + 1;
      var url = exportDataUrl(idx);
      var name = 'bead-pattern-board-' + boardNo + '.jpg';
      saveOneDataUrl(url, name).then(function () {
        idx += 1;
        // 浏览器连下多张时稍作间隔，避免被拦
        setTimeout(next, 180);
      }).catch(function (err) {
        done(false, (err && err.errMsg) || ('第' + boardNo + '板保存失败'));
      });
    }
    next();
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
    // 保持双击点下的内容坐标不变，只改缩放
    var wx = (cx - state.view.tx) / s0;
    var wy = (cy - state.view.ty) / s0;
    var v = viewportSize();
    fit2dAnim = {
      t0: performance.now(),
      dur: 380,
      s0: s0,
      s1: s1,
      anchor: true,
      ax: cx,
      ay: cy,
      awx: wx,
      awy: wy,
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
    if (a.anchor) {
      state.view.tx = a.ax - a.awx * s;
      state.view.ty = a.ay - a.awy * s;
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
    if (a.anchor) {
      state.view.s = a.s1;
      state.view.tx = a.ax - a.awx * a.s1;
      state.view.ty = a.ay - a.awy * a.s1;
      // 锚点缩放结束后用宽松夹紧，保留双击点位置，避免角落跳动
      clampView2d();
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
    pinch: null
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

    if (gd.count === 1) {
      gd.prevX = p.x;
      gd.prevY = p.y;
      gd.travX = 0;
      gd.travY = 0;
      var now = Date.now();
      if (now - gd.lastTapT < 340 &&
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
        if (fit2dAnim) return;
        var minS = state.view.fitS || 1;
        var s1 = Math.max(minS, Math.min(MAX_ZOOM, gd.pinch.s0 * k));
        var wxx = (gd.pinch.ax - gd.pinch.tx0) / gd.pinch.s0;
        var wyy = (gd.pinch.ay - gd.pinch.ty0) / gd.pinch.s0;
        state.view.s = s1;
        state.view.tx = q.mx - wxx * s1;
        state.view.ty = q.my - wyy * s1;
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
      var wasTapZoom = gd.tapBlock;
      gd.tapBlock = false;
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

  // 预览手势 + 视图工具栏（优先绑定，避免后续可选控件异常阻断）
  els.viewport.addEventListener('pointerdown', onVpDown);
  els.viewport.addEventListener('pointermove', onVpMove);
  els.viewport.addEventListener('pointerup', onVpUp);
  els.viewport.addEventListener('pointercancel', onVpUp);
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
  if (els.btnBoardAll) {
    els.btnBoardAll.addEventListener('click', function () {
      if (!state.gridData) return;
      state.boardIndex = -1;
      fitView();
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

  syncModeUI();
  showPreviewHint(null);

  window.addEventListener('resize', function () {
    if (state.gridData) fitView();
  });

  showScreen('home');
})();
