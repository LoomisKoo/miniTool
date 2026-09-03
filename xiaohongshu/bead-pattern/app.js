(function () {
  'use strict';

  var BOARD = 29;
  var CELL = 16;
  var EXPORT_CELL = 28;

  var GRID_COLOR = '#c7c7cc';
  var SEAM_COLOR = '#ff3b30';

  var state = {
    image: null,
    paletteId: 'mard',
    width: 29,
    maxColors: 12,
    mode: 'average',
    dither: false,
    showGrid: true,
    gridData: null,
    counts: null,
    height: 0,
    boardIndex: -1,
    boardsX: 1,
    boardsY: 1,
    highlightCode: null,
    busy: false
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
    btnSharp: document.getElementById('btn-sharp'),
    btnColors: document.getElementById('btn-colors'),
    colorsPreview: document.getElementById('colors-preview'),
    colorsList: document.getElementById('colors-list'),
    paletteSheet: document.getElementById('palette-sheet'),
    paletteSheetBackdrop: document.getElementById('palette-sheet-backdrop'),
    paletteSheetCancel: document.getElementById('palette-sheet-cancel'),
    colorsSheet: document.getElementById('colors-sheet'),
    colorsSheetBackdrop: document.getElementById('colors-sheet-backdrop'),
    colorsSheetCancel: document.getElementById('colors-sheet-cancel')
  };

  var ctx = els.canvas.getContext('2d');
  var work = document.createElement('canvas');
  var workCtx = work.getContext('2d');
  var toastTimer = null;
  var regenTimer = null;

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
      var lab = rgbToLab(c[1], c[2], c[3]);
      list.push({
        code: c[0],
        r: c[1],
        g: c[2],
        b: c[3],
        hex: rgbToHex(c[1], c[2], c[3]),
        L: lab[0],
        a: lab[1],
        bLab: lab[2]
      });
    }
    return list;
  }

  function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  }

  function rgbToLab(r, g, b) {
    var R = r / 255;
    var G = g / 255;
    var B = b / 255;
    R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
    G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
    B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;
    var x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    var y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
    var z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }

  function labDist(a, b) {
    var dL = a.L - b.L;
    var da = a.a - b.a;
    var db = a.bLab - b.bLab;
    return dL * dL + da * da + db * db;
  }

  function nearestColor(cache, r, g, b) {
    var lab = rgbToLab(r, g, b);
    var probe = { L: lab[0], a: lab[1], bLab: lab[2] };
    var best = cache[0];
    var bestD = Infinity;
    var i;
    for (i = 0; i < cache.length; i++) {
      var d = labDist(probe, cache[i]);
      if (d < bestD) {
        bestD = d;
        best = cache[i];
      }
    }
    return best;
  }

  function clampByte(v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return v | 0;
  }

  function sampleImage(img, w, h, mode) {
    work.width = w;
    work.height = h;
    workCtx.clearRect(0, 0, w, h);
    if (mode === 'nearest') {
      workCtx.imageSmoothingEnabled = false;
    } else {
      workCtx.imageSmoothingEnabled = true;
      workCtx.imageSmoothingQuality = 'high';
    }
    workCtx.drawImage(img, 0, 0, w, h);
    return workCtx.getImageData(0, 0, w, h);
  }

  function limitColors(mapped, maxColors) {
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
    for (i = 0; i < maxColors; i++) keep[codes[i]] = true;

    var keepList = [];
    for (i = 0; i < mapped.length; i++) {
      if (keep[mapped[i].code]) {
        var exists = false;
        var j;
        for (j = 0; j < keepList.length; j++) {
          if (keepList[j].code === mapped[i].code) {
            exists = true;
            break;
          }
        }
        if (!exists) keepList.push(mapped[i]);
      }
    }

    for (i = 0; i < mapped.length; i++) {
      if (!keep[mapped[i].code]) {
        mapped[i] = nearestFromList(keepList, mapped[i].r, mapped[i].g, mapped[i].b);
      }
    }
    return mapped;
  }

  function nearestFromList(list, r, g, b) {
    var lab = rgbToLab(r, g, b);
    var probe = { L: lab[0], a: lab[1], bLab: lab[2] };
    var best = list[0];
    var bestD = Infinity;
    var i;
    for (i = 0; i < list.length; i++) {
      var d = labDist(probe, list[i]);
      if (d < bestD) {
        bestD = d;
        best = list[i];
      }
    }
    return best;
  }

  function applyDither(data, cache, maxColors) {
    var w = data.width;
    var h = data.height;
    var buf = new Float32Array(w * h * 3);
    var i;
    for (i = 0; i < w * h; i++) {
      buf[i * 3] = data.data[i * 4];
      buf[i * 3 + 1] = data.data[i * 4 + 1];
      buf[i * 3 + 2] = data.data[i * 4 + 2];
    }

    var mapped = new Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
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
    return limitColors(mapped, maxColors);
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

    var cache = buildPaletteCache(getPalette());
    var data = sampleImage(img, w, h, state.mode);
    var mapped;
    var i;
    var o;

    if (state.dither) {
      mapped = applyDither(data, cache, state.maxColors);
    } else {
      mapped = new Array(w * h);
      for (i = 0; i < w * h; i++) {
        o = i * 4;
        mapped[i] = nearestColor(cache, data.data[o], data.data[o + 1], data.data[o + 2]);
      }
      mapped = limitColors(mapped, state.maxColors);
    }

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
    ensureDefaultHighlight(sortedCounts());
    if (state.boardIndex >= state.boardsX * state.boardsY) state.boardIndex = -1;
    renderPreview();
    renderLegend();
    updateMeta();
    fitView();
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

    if (forExport && cell >= 22) {
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

  function renderPreview() {
    var rect = boardRect(state.boardIndex);
    var pw = Math.max(1, rect.x1 - rect.x0);
    var ph = Math.max(1, rect.y1 - rect.y0);
    var vw = els.viewport.clientWidth || 300;
    var vh = els.viewport.clientHeight || 300;
    var gap = state.showGrid ? 1 : 0;

    // 先按整数格绘制保证清晰，再用 CSS 精确等比撑满视口（贴齐较短边）
    var cell = Math.max(4, Math.floor(Math.min((vw - gap) / pw, (vh - gap) / ph)));
    drawPattern(ctx, cell, state.showGrid, rect, false);

    var scale = Math.min(vw / els.canvas.width, vh / els.canvas.height);
    els.canvas.style.width = (els.canvas.width * scale) + 'px';
    els.canvas.style.height = (els.canvas.height * scale) + 'px';
    updateBoardLabel();
  }

  function fitView() {
    renderPreview();
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
    if (state.highlightCode) {
      var i;
      for (i = 0; i < list.length; i++) {
        if (list[i].code === state.highlightCode) return;
      }
    }
    state.highlightCode = list[0].code;
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
      mapImage();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      toast('图片读取失败');
    };
    img.src = url;
  }

  function exportDataUrl() {
    var exportCanvas = document.createElement('canvas');
    var exportCtx = exportCanvas.getContext('2d');
    var rect = boardRect(state.boardIndex);
    drawPattern(exportCtx, EXPORT_CELL, state.showGrid, rect, true);

    // legend strip
    var counts = state.counts || {};
    var list = Object.keys(counts).map(function (k) { return counts[k]; });
    list.sort(function (a, b) { return b.n - a.n; });
    if (state.boardIndex >= 0) {
      var local = {};
      var r = rect;
      var y;
      var x;
      for (y = r.y0; y < r.y1; y++) {
        for (x = r.x0; x < r.x1; x++) {
          var c = state.gridData[y * state.width + x];
          local[c.code] = (local[c.code] || 0) + 1;
        }
      }
      list = list.filter(function (it) { return local[it.code]; }).map(function (it) {
        return { code: it.code, hex: it.hex, n: local[it.code] };
      });
    }

    var pad = 16;
    var legendH = 28 + Math.ceil(list.length / 4) * 22;
    var out = document.createElement('canvas');
    out.width = exportCanvas.width + pad * 2;
    out.height = exportCanvas.height + pad * 2 + legendH + 36;
    var octx = out.getContext('2d');
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, out.width, out.height);
    octx.fillStyle = '#1a1a1a';
    octx.font = 'bold 16px sans-serif';
    octx.fillText('豆图 · ' + getPalette().name, pad, 24);
    octx.font = '12px sans-serif';
    octx.fillStyle = '#666';
    var title =
      state.width + '×' + state.height + ' · ' +
      (state.boardIndex < 0 ? '全图' : '第' + (state.boardIndex + 1) + '板');
    octx.fillText(title, pad, 42);
    octx.drawImage(exportCanvas, pad, 52);
    var ly = 52 + exportCanvas.height + 16;
    octx.font = '12px sans-serif';
    var colW = (out.width - pad * 2) / 4;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var cx = pad + (i % 4) * colW;
      var cy = ly + ((i / 4) | 0) * 22;
      octx.fillStyle = item.hex;
      octx.fillRect(cx, cy, 12, 12);
      octx.strokeStyle = 'rgba(0,0,0,0.15)';
      octx.strokeRect(cx + 0.5, cy + 0.5, 11, 11);
      octx.fillStyle = '#333';
      octx.fillText(item.code + ' ' + item.n, cx + 16, cy + 11);
    }
    return out.toDataURL('image/png');
  }

  function saveToAlbum() {
    if (!state.gridData || state.busy) return;
    state.busy = true;
    els.btnSave.disabled = true;
    var dataUrl = exportDataUrl();

    function done(ok, msg) {
      state.busy = false;
      els.btnSave.disabled = false;
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

  // events
  els.fileInput.addEventListener('change', function () {
    var f = els.fileInput.files && els.fileInput.files[0];
    loadFile(f);
    els.fileInput.value = '';
  });

  els.btnReselect.addEventListener('click', function () {
    els.fileInput.click();
  });

  els.btnSave.addEventListener('click', saveToAlbum);

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

  els.btnSharp.addEventListener('click', function () {
    state.mode = state.mode === 'nearest' ? 'average' : 'nearest';
    setChip(els.btnSharp, state.mode === 'nearest');
    scheduleRegen();
  });

  syncPaletteButton();
  setChip(els.btnGrid, state.showGrid);
  setChip(els.btnDither, state.dither);
  setChip(els.btnSharp, state.mode === 'nearest');

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

  window.addEventListener('resize', function () {
    if (state.gridData) fitView();
  });

  showScreen('home');
})();
