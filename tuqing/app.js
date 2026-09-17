'use strict';
/**
 * 图轻 — 图片瘦身（防平台二次压缩）
 * 纯离线：canvas 本地重编码。保存依赖平台容器「存相册」bridge（小红书 xhs.miniTool），
 * 其它容器回退为大图预览 + 长按保存 / 下载。
 */
(function () {
  var SAVE_TIP_XHS = '需要相册权限才能继续，请在系统设置中允许访问相册后重试';

  var SCENARIOS = [
    { id: 'xhs', t: '小红书笔记', d: '≤900KB · 防二次压缩', mode: 'target', targetKB: 900, maxEdge: 1440, fmt: 'auto' },
    { id: 'wx', t: '微信表情头像', d: '≤500KB', mode: 'target', targetKB: 500, maxEdge: 800, fmt: 'auto' },
    { id: 'hd', t: '高清画质', d: '转 WebP · 保留细节', mode: 'manual', quality: 90, maxEdge: 2048, fmt: 'auto' },
    { id: 'custom', t: '自定义', d: '手动调参', mode: 'custom', fmt: 'auto' }
  ];

  var EDGES = [
    { id: 'orig', label: '原尺寸' },
    { id: 2560, label: '2560' },
    { id: 2048, label: '2048' },
    { id: 1440, label: '1440' },
    { id: 1080, label: '1080' },
    { id: 750, label: '750' }
  ];
  var FORMATS = [
    { id: 'auto', label: '自动' },
    { id: 'jpeg', label: 'JPG' },
    { id: 'webp', label: 'WebP' },
    { id: 'png', label: 'PNG' }
  ];

  var QUALITY_MIN = 40;   // 有损压缩允许的最低质量
  var QUALITY_MAX = 95;
  var MIN_EDGE = 480;     // 自动达标最小长边（再小没有意义）
  var PROBE_EDGE = 512;   // 质量二分探测用缩略图长边
  var OVER_BUDGET = 1.05; // 全尺寸复核容差

  // ---------- DOM ----------
  function $(id) { return document.getElementById(id); }
  var el = {
    picker: $('picker-card'), pickBtn: $('btn-pick'), privacy: $('privacy-bar'),
    work: $('work-area'),
    thumb: $('file-thumb'), fname: $('file-name'), fdim: $('file-dim'),
    reselect: $('btn-reselect'), scenarios: $('scenarios'),
    advPanel: $('adv-panel'), fmtSeg: $('fmt-seg'),
    qualitySlider: $('quality-slider'), qualityVal: $('quality-val'),
    edgeChips: $('edge-chips'), targetInput: $('target-input'), autoBtn: $('btn-auto-fit'),
    busy: $('busy-line'),
    resultCard: $('result-card'), holder: $('result-img-holder'),
    cmpOrig: $('cmp-orig'), cmpNew: $('cmp-new'), cmpOrigT: $('cmp-orig-t'), cmpNewT: $('cmp-new-t'), cmpSlider: $('compare-slider'),
    statOrig: $('stat-orig'), statNew: $('stat-new'), statDim: $('stat-dim'), statSave: $('stat-save'),
    saveWrap: $('save-wrap'), saveBtn: $('btn-save'),
    modal: $('preview-modal'), previewImg: $('preview-img'),
    previewCap: $('preview-cap'), dlBtn: $('btn-download'),
    fileInput: $('file-input'), toastEl: $('toast')
  };

  var blobUrls = [];
  var toastTimer = null;
  var jobId = 0; // 任务版本号，防止旧结果覆盖新结果

  // ---------- 状态 ----------
  var state = {
    file: null, img: null,
    origBytes: 0, origW: 0, origH: 0,
    scenarioId: 'xhs',
    customFmt: 'auto', customQuality: 82, customEdge: 'orig',
    autoFit: false, autoFitTargetKB: 900,
    result: null,   // { url, dataUrl, bytes, width, height, format, quality, untouched }
    comparePct: 100, // 100=只看处理后，0=只看原图
    saving: false
  };
  var compareWrap = null, compareOrig = null, compareLine = null;

  var hasAlphaByType = function (f) {
    var t = (f && f.type) || '';
    return t.indexOf('png') >= 0 || t.indexOf('webp') >= 0;
  };
  function canWebp() {
    try {
      var c = document.createElement('canvas');
      return c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch (e) { return false; }
  }
  var SUPPORT_WEBP = canWebp();

  // ---------- 小工具 ----------
  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10 * 1024 ? 1 : 0) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }
  function showToast(msg) {
    el.toastEl.textContent = msg;
    el.toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toastEl.classList.remove('show'); }, 2400);
  }
  function setBusy(on) { el.busy.classList.toggle('hidden', !on); }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      if (typeof canvas.toBlob === 'function') {
        try {
          canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('encode')); }, type, quality);
        } catch (e) { reject(e); }
      } else {
        var url = canvas.toDataURL(type, quality);
        var bin = atob(url.split(',')[1]);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: type }));
      }
    });
  }
  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      blobUrls.push(url);
      var img = new Image();
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        img.onload = img.onerror = null;
        reject(new Error('timeout'));
      }, 12000);
      img.onload = function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error('load'));
      };
      img.src = url;
    });
  }

  // ---------- 参数解析 ----------
  function currentScenario() {
    for (var i = 0; i < SCENARIOS.length; i++) {
      if (SCENARIOS[i].id === state.scenarioId) return SCENARIOS[i];
    }
    return SCENARIOS[0];
  }
  function resolveFmt(pref) {
    var f = pref || 'auto';
    if (f !== 'auto') return f;
    return SUPPORT_WEBP ? 'webp' : (hasAlphaByType(state.file) ? 'png' : 'jpeg');
  }
  function resolveEdge(edgeId) {
    if (!edgeId || edgeId === 'orig') return Math.max(state.origW, state.origH);
    return edgeId;
  }
  function scaledDim(edge) {
    var scale = Math.min(1, edge / Math.max(state.origW, state.origH));
    return {
      w: Math.max(1, Math.round(state.origW * scale)),
      h: Math.max(1, Math.round(state.origH * scale))
    };
  }

  // 把源图等比绘制到最长边 = edge 的 canvas（白底，避免 JPEG 透明变黑）
  function targetCanvas(edge) {
    var d = scaledDim(edge);
    var c = document.createElement('canvas');
    c.width = d.w; c.height = d.h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, d.w, d.h);
    ctx.drawImage(state.img, 0, 0, d.w, d.h);
    return c;
  }
  function encode(canvas, fmt, quality) {
    var type = fmt === 'jpeg' ? 'image/jpeg' : (fmt === 'png' ? 'image/png' : 'image/webp');
    return canvasToBlob(canvas, type, quality).then(function (blob) {
      return { blob: blob, bytes: blob.size };
    });
  }

  // ---------- 目标体积自动达标 ----------
  // 先在小图上二分找「体积不超过预算的最高质量」，再用该质量全尺寸复核。
  // 理由：同一内容质量与体积单调相关，缩略图上的最优质量 ≈ 全尺寸最优质量，
  // 探测仅在 512px 小图上编码，显著快于全尺寸多次编码。
  function probeBestQuality(fmt, edge, targetBytes, fullArea) {
    var probeEdge = Math.min(edge, PROBE_EDGE);
    var probe = targetCanvas(probeEdge);
    var areaRatio = fullArea / (probe.width * probe.height);
    var low = QUALITY_MIN, high = QUALITY_MAX, best = null, guard = 0;
    function step() {
      if (low > high || ++guard > 14) return Promise.resolve(best);
      var q = Math.round((low + high) / 2);
      return encode(probe, fmt, q / 100).then(function (r) {
        if (r.bytes * areaRatio <= targetBytes) { best = q; low = q + 1; }
        else { high = q - 1; }
        return step();
      });
    }
    return step();
  }

  // 目标体积驱动：优先保质量，必要时降尺寸（每档内部先从高质量往下调）
  function compressToTarget(fmt, maxEdge, targetBytes) {
    var lossy = fmt !== 'png';
    function done(canvas, r, quality, over) {
      return { canvas: canvas, blob: r.blob, bytes: r.bytes, quality: quality, over: !!over };
    }
    function tryEdge(edge) {
      var c = targetCanvas(edge);
      var enc = function (q) { return encode(c, fmt, q); };
      if (!lossy) { // PNG 无损：仅能靠降尺寸
        return enc(1).then(function (r) {
          if (r.bytes <= targetBytes) return done(c, r, null, false);
          if (edge <= MIN_EDGE) return done(c, r, null, true);
          return tryEdge(Math.max(MIN_EDGE, Math.round(edge * 0.72)));
        });
      }
      return probeBestQuality(fmt, edge, targetBytes, c.width * c.height).then(function (bestQ) {
        if (bestQ === null) {
          if (edge <= MIN_EDGE) return enc(QUALITY_MIN / 100).then(function (r) {
            return done(c, r, QUALITY_MIN / 100, true);
          });
          return tryEdge(Math.max(MIN_EDGE, Math.round(edge * 0.72)));
        }
        return enc(bestQ / 100).then(function (r) {
          if (r.bytes <= targetBytes * OVER_BUDGET) return done(c, r, bestQ / 100, false);
          return dropQ(c, enc, r, bestQ, edge);
        });
      });
    }
    function dropQ(c, enc, r, q, edge) {
      if (q - 5 < QUALITY_MIN) {
        if (edge <= MIN_EDGE) return done(c, r, q / 100, true);
        return tryEdge(Math.max(MIN_EDGE, Math.round(edge * 0.72)));
      }
      return enc((q - 5) / 100).then(function (r2) {
        if (r2.bytes <= targetBytes * OVER_BUDGET) return done(c, r2, (q - 5) / 100, false);
        return dropQ(c, enc, r2, q - 5, edge);
      });
    }
    return tryEdge(maxEdge);
  }

  // 释放上一个压缩结果的 blob URL（避免反复调参时累积）
  function revokeOldResult() {
    if (state.result && state.result.url) {
      try { URL.revokeObjectURL(state.result.url); } catch (e) { /* ignore */ }
    }
  }

  // ---------- 主流程 ----------
  function runCompress() {
    if (!state.img || state.saving) return;
    revokeOldResult();
    var myJob = ++jobId;
    var sc = currentScenario();

    var fmt, maxEdge, quality, targetBytes;
    if (sc.mode === 'target') {
      fmt = resolveFmt(sc.fmt);
      maxEdge = sc.maxEdge;
      targetBytes = sc.targetKB * 1024;
      quality = null;
    } else if (sc.mode === 'manual') {
      fmt = resolveFmt(sc.fmt);
      maxEdge = sc.maxEdge;
      quality = sc.quality / 100;
      targetBytes = null;
    } else { // custom
      fmt = resolveFmt(state.customFmt);
      maxEdge = resolveEdge(state.customEdge);
      quality = state.customQuality / 100;
      targetBytes = state.autoFit ? state.autoFitTargetKB * 1024 : null;
    }

    var origEdge = Math.max(state.origW, state.origH);
    // 已达标且无需缩尺寸：直接使用原文件（避免多一次转码）
    if (targetBytes && state.origBytes <= targetBytes && maxEdge >= origEdge - 1) {
      finishAsOriginal(myJob, 'under-budget');
      return;
    }

    setBusy(true);
    // 让 loading 上屏后再进重任务
    setTimeout(function () {
      var work = targetBytes
        ? compressToTarget(fmt, maxEdge, targetBytes)
        : (function () {
          var c = targetCanvas(maxEdge);
          return encode(c, fmt, quality).then(function (r) {
            return { canvas: c, blob: r.blob, bytes: r.bytes, quality: quality };
          });
        })();

      work.then(function (r) {
        if (myJob !== jobId) return;
        // 瘦身原则：结果必须比原图小。若压缩反而更大，保留原图最优。
        if (state.origBytes > 0 && r.bytes > state.origBytes * 1.02) {
          return finishAsOriginal(myJob, 'original-smaller');
        }
        return blobToDataUrl(r.blob).then(function (dataUrl) {
          if (myJob !== jobId) return;
          var url = URL.createObjectURL(r.blob);
          blobUrls.push(url);
          state.result = {
            url: url, dataUrl: dataUrl, bytes: r.bytes,
            width: r.canvas.width, height: r.canvas.height,
            format: fmt, quality: r.quality, over: r.over, untouched: false
          };
          renderResult();
          setBusy(false);
        });
      }).catch(function () {
        if (myJob !== jobId) return;
        setBusy(false);
        showToast('压缩失败，请换一张图片重试');
      });
    }, 30);
  }

  // reason: 'under-budget'(原图已达标) | 'original-smaller'(压缩反而变大，保留原图)
  function finishAsOriginal(myJob, reason) {
    var url = URL.createObjectURL(state.file);
    blobUrls.push(url);
    blobToDataUrl(state.file).then(function (dataUrl) {
      if (myJob !== jobId) return;
      var mt = (state.file.type || '').toLowerCase();
      var fmt = mt.indexOf('png') >= 0 ? 'png' : (mt.indexOf('webp') >= 0 ? 'webp' : 'jpeg');
      state.result = {
        url: url, dataUrl: dataUrl, bytes: state.origBytes,
        width: state.origW, height: state.origH,
        format: fmt, quality: null, over: false, untouched: true, reason: reason
      };
      renderResult();
      setBusy(false);
    }).catch(function () {
      if (myJob !== jobId) return;
      setBusy(false);
      showToast('读取图片失败');
    });
  }

  // ---------- 渲染 ----------
  function renderScenarios() {
    var wrap = el.scenarios;
    wrap.innerHTML = '';
    SCENARIOS.forEach(function (sc) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'scenario' + (sc.id === state.scenarioId ? ' active' : '');
      var t = document.createElement('span'); t.className = 't'; t.textContent = sc.t;
      var d = document.createElement('span'); d.className = 'd'; d.textContent = sc.d;
      b.appendChild(t); b.appendChild(d);
      b.addEventListener('click', function () {
        state.scenarioId = sc.id;
        state.autoFit = false;
        refreshPanel();
        runCompress();
      });
      wrap.appendChild(b);
    });
  }

  function renderFmtSeg() {
    var wrap = el.fmtSeg;
    wrap.innerHTML = '';
    FORMATS.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = f.id === state.customFmt ? 'active' : '';
      b.textContent = f.label;
      b.addEventListener('click', function () {
        state.customFmt = f.id;
        renderFmtSeg();
        runCompress();
      });
      wrap.appendChild(b);
    });
  }

  function renderEdgeChips() {
    var wrap = el.edgeChips;
    wrap.innerHTML = '';
    EDGES.forEach(function (e) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = String(e.id) === String(state.customEdge) ? 'active' : '';
      b.textContent = e.label;
      b.addEventListener('click', function () {
        state.customEdge = e.id;
        renderEdgeChips();
        runCompress();
      });
      wrap.appendChild(b);
    });
  }

  function refreshPanel() {
    var sc = currentScenario();
    renderScenarios(); // 刷新高亮
    el.advPanel.classList.toggle('hidden', sc.id !== 'custom');
    if (sc.id === 'custom') {
      renderFmtSeg();
      renderEdgeChips();
      el.qualitySlider.value = String(state.customQuality);
      el.qualityVal.textContent = String(state.customQuality);
      el.autoBtn.classList.toggle('on', !!state.autoFit);
    }
  }

  function updateCompare() {
    if (!compareWrap) return;
    var w = Math.round(compareWrap.clientWidth * (100 - state.comparePct) / 100);
    compareOrig.style.width = w + 'px';
    if (compareLine) compareLine.style.left = w + 'px';
    el.cmpSlider.value = String(state.comparePct);
  }

  function renderResult() {
    var r = state.result;
    if (!r) return;
    el.resultCard.classList.remove('hidden');
    el.saveWrap.classList.remove('hidden');
    el.saveBtn.disabled = false;

    // 文件名
    var label;
    if (r.untouched && r.reason === 'original-smaller') {
      label = (state.file.name || 'image').replace(/\.[^.]+$/, '') + '（压缩反而变大，已保留原图）';
    } else if (r.untouched) {
      label = (state.file.name || 'image').replace(/\.[^.]+$/, '') + '（原图已达标，无需压缩）';
    } else {
      label = (state.file.name || 'image').replace(/\.[^.]+$/, '') + '（已瘦身）';
    }
    el.fname.textContent = label;

    // 对比预览：底 = 处理后；上 = 原图，宽度按滑块裁剪
    el.holder.innerHTML = '';
    var stage = document.createElement('div');
    stage.style.cssText = 'position:relative;width:100%;overflow:hidden;';
    var base = document.createElement('img');
    base.alt = '处理后';
    base.src = r.url;
    base.style.cssText = 'display:block;width:100%;height:auto;';
    stage.appendChild(base);

    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;top:0;bottom:0;left:0;overflow:hidden;';
    var ov = document.createElement('img');
    ov.alt = '原图';
    ov.src = state.img.src;
    ov.style.cssText = 'display:block;max-width:none;width:' + stage.clientWidth + 'px;'; // 占位，下方对齐
    wrap.appendChild(ov);
    stage.appendChild(wrap);

    var line = document.createElement('div');
    line.style.cssText = 'position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,255,0.95);box-shadow:0 0 4px rgba(0,0,0,0.5);pointer-events:none;';
    stage.appendChild(line);

    compareWrap = stage;
    compareOrig = wrap;
    compareLine = line;
    el.holder.appendChild(stage);

    // 图解码后按实际比例对齐覆盖层宽度（原图与处理后为等比缩放，宽高比一致）
    function align() {
      if (!compareWrap) return;
      var W = compareWrap.clientWidth || stage.offsetWidth;
      if (!W) return;
      ov.style.width = W + 'px';
      ov.style.height = 'auto';
      updateCompare();
    }
    base.onload = align;
    if (ov.complete) align();
    else ov.onload = align;
    setTimeout(align, 250); // 兜底

    // 统计：diffPct 以原图为基准的增量（>0 变大，<0 变小）
    var diffPct = state.origBytes > 0 ? Math.round((r.bytes / state.origBytes - 1) * 100) : 0;
    el.cmpOrig.textContent = fmtBytes(state.origBytes);
    el.cmpNew.textContent = fmtBytes(r.bytes);
    el.statOrig.textContent = fmtBytes(state.origBytes) + ' · ' + state.origW + '×' + state.origH;
    el.statNew.textContent = fmtBytes(r.bytes) + ' · ' + r.width + '×' + r.height + ' · ' + r.format.toUpperCase() + (r.quality ? ' q' + Math.round(r.quality * 100) : '');
    el.statDim.textContent = r.width + '×' + r.height;
    var saveEl = el.statSave;
    if (r.untouched && r.reason === 'under-budget') {
      saveEl.textContent = '已达标';
      saveEl.className = 'v neutral';
    } else if (r.untouched) {
      saveEl.textContent = '原图更小';
      saveEl.className = 'v neutral';
    } else if (diffPct <= -2) {
      saveEl.textContent = '-' + (-diffPct) + '%';
      saveEl.className = 'v good';
    } else if (diffPct >= 2) {
      saveEl.textContent = '+' + diffPct + '%';
      saveEl.className = 'v bad';
    } else {
      saveEl.textContent = '相仿';
      saveEl.className = 'v neutral';
    }

    // 结果卡滚动进视野
    setTimeout(function () {
      var top = el.resultCard.getBoundingClientRect().top + window.pageYOffset - 90;
      if (top > 0) window.scrollTo({ top: top, behavior: 'smooth' });
    }, 60);
  }

  // ---------- 选图 ----------
  // 选图入口用 <label for="file-input"> 原生激活（避免 JS .click() 被 iOS Safari 丢弃 / 重复触发）
  function setPicking(on) {
    el.picker.classList.toggle('picking', on);
    el.pickBtn.textContent = on ? '读取中…' : '从相册选择';
  }

  var compressTimer = null;
  function scheduleCompress() {
    if (compressTimer) clearTimeout(compressTimer);
    compressTimer = setTimeout(runCompress, 180);
  }

  function onFiles(files) {
    if (!files || !files.length) return;
    var file = files[0]; // 第一版单张处理，多选取首张
    var t = (file.type || '').toLowerCase();
    if (t && t.indexOf('image/') !== 0) {
      showToast('请选择图片文件');
      return;
    }
    setPicking(true);
    loadImage(file).then(function (img) {
      // 释放旧展示资源，仅保留当前源图 URL
      var keep = img.src;
      for (var i = blobUrls.length - 1; i >= 0; i--) {
        if (blobUrls[i] !== keep) { URL.revokeObjectURL(blobUrls[i]); blobUrls.splice(i, 1); }
      }
      setPicking(false);
      state.file = file;
      state.img = img;
      state.origBytes = file.size || 0;
      state.origW = img.naturalWidth;
      state.origH = img.naturalHeight;
      state.result = null;
      state.autoFit = false;
      state.comparePct = 100;
      compareWrap = compareOrig = compareLine = null;

      el.picker.classList.add('hidden');
      el.privacy.classList.remove('hidden');
      el.work.classList.remove('hidden');
      el.saveWrap.classList.add('hidden');
      el.resultCard.classList.add('hidden');

      el.thumb.src = img.src;
      el.fname.textContent = file.name || 'image';
      el.fdim.textContent = img.naturalWidth + '×' + img.naturalHeight + ' · ' + fmtBytes(state.origBytes);
      refreshPanel();
      runCompress();
    }).catch(function () {
      setPicking(false);
      showToast('无法读取图片，请检查相册权限或换一张图');
      el.fileInput.value = '';
    });
  }

  // ---------- 保存 ----------
  function hasXhs() { return !!(window.xhs && window.xhs.miniTool); }
  function isPermissionError(err) {
    var msg = '';
    if (!err) return false;
    if (typeof err === 'string') msg = err;
    else if (err.errMsg) msg = String(err.errMsg);
    else if (err.message) msg = String(err.message);
    else msg = String(err);
    msg = msg.toLowerCase();
    return msg.indexOf('auth') >= 0 || msg.indexOf('permission') >= 0 ||
      msg.indexOf('denied') >= 0 || msg.indexOf('权限') >= 0 || msg.indexOf('相册') >= 0;
  }

  function saveResult() {
    var r = state.result;
    if (!r || state.saving) return;
    if (hasXhs()) {
      state.saving = true;
      el.saveBtn.disabled = true;
      var old = el.saveBtn.textContent;
      el.saveBtn.textContent = '保存中…';
      window.xhs.miniTool.writeTempFile({ data: r.dataUrl }).then(function (res) {
        return window.xhs.miniTool.saveImageToPhotosAlbum({ filePath: res.filePath });
      }).then(function () {
        state.saving = false;
        el.saveBtn.disabled = false;
        el.saveBtn.textContent = old;
        showToast('已保存到相册');
      }).catch(function (err) {
        state.saving = false;
        el.saveBtn.disabled = false;
        el.saveBtn.textContent = old;
        alert(isPermissionError(err) ? SAVE_TIP_XHS : '保存失败，请检查相册权限后重试');
      });
      return;
    }
    // 非小红书容器：大图预览，长按保存（桌面浏览器附下载）
    var ext = r.format === 'jpeg' ? 'jpg' : r.format;
    el.previewImg.src = r.url;
    el.previewCap.textContent = (r.untouched ? '' : fmtBytes(state.origBytes) + ' → ') +
      fmtBytes(r.bytes) + ' · 长按图片可保存到相册';
    el.dlBtn.classList.toggle('hidden', 'ontouchstart' in window);
    el.dlBtn.href = r.url;
    el.dlBtn.download = '图轻-' + Date.now() + '.' + ext;
    el.modal.classList.remove('hidden');
  }

  // ---------- 事件 ----------
  el.fileInput.addEventListener('click', function () { this.value = ''; }); // 每次打开前清空，保证同一文件也能触发 change
  el.fileInput.addEventListener('change', function () { onFiles(el.fileInput.files); });

  el.qualitySlider.addEventListener('input', function () {
    state.customQuality = parseInt(el.qualitySlider.value, 10);
    state.autoFit = false;
    el.autoBtn.classList.remove('on');
    el.qualityVal.textContent = String(state.customQuality);
    scheduleCompress();
  });

  el.autoBtn.addEventListener('click', function () {
    if (state.autoFit) { // 再点一次退出自动达标，回到手动
      state.autoFit = false;
      el.autoBtn.classList.remove('on');
      runCompress();
      return;
    }
    var v = parseInt(el.targetInput.value, 10);
    if (!v || v <= 0 || v > 10240) { showToast('请输入 1～10240 之间的目标体积'); return; }
    state.autoFitTargetKB = v;
    state.autoFit = true;
    el.autoBtn.classList.add('on');
    runCompress();
  });

  el.cmpSlider.addEventListener('input', function () {
    state.comparePct = parseInt(el.cmpSlider.value, 10);
    updateCompare();
  });
  el.cmpOrigT.addEventListener('click', function () { state.comparePct = 0; updateCompare(); });
  el.cmpNewT.addEventListener('click', function () { state.comparePct = 100; updateCompare(); });

  el.saveBtn.addEventListener('click', saveResult);
  function closePreview() {
    el.modal.classList.add('hidden');
    el.previewImg.src = '';
  }
  el.previewImg.addEventListener('click', closePreview);
  el.modal.addEventListener('click', function (e) {
    if (e.target === el.modal) closePreview();
  });
  el.dlBtn.addEventListener('click', function () { closePreview(); });

  // ---------- 初始化 ----------
  renderScenarios();
  el.qualitySlider.value = String(state.customQuality);
  el.qualityVal.textContent = String(state.customQuality);
})();
