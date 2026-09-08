/* 寻味 · 逻辑层 v2
 * 点阵渲染(陆地/海洋均以点阵呈现) / 地球仪-平面双模式 / 手势缩放动画 / 详情展开 / 名录收藏
 */
(function () {
  'use strict';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const $ = s => document.querySelector(s);
  const rad = d => d * Math.PI / 180;
  const K = 180 / Math.PI;                 // deg-per-radian
  const TAU = Math.PI * 2;
  const wrapLon = d => d - 360 * Math.round(d / 360);

  const canvas = $('#map');
  const ctx = canvas.getContext('2d');
  const wrap = canvas.parentElement;
  const sheet = $('#sheet');
  const toastEl = $('#toast');
  let CW = 0, CH = 0, DPR = 1;

  /* ================= 数据 ================= */
  const PLACES = window.DATA;
  const FAV_KEY = 'xunwei-favs';
  const groups = [];
  PLACES.forEach(p => { if (!groups.includes(p.sec)) groups.push(p.sec); });
  let favSet = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
  const saveFavs = () => localStorage.setItem(FAV_KEY, JSON.stringify([...favSet]));
  const isFav = i => favSet.has(i);

  /* ================= 点阵位图解码 ================= */
  const CELL = 0.25, COLS = 1440, ROWS = 720;   // 0.25° 一格（加强岸线采样）
  const land = new Uint8Array(COLS * ROWS);
  (function decode() {
    const b64 = window.LAND_DATA.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const by = Math.ceil(COLS / 8);
    for (let r = 0; r < ROWS; r++) {
      const rr = r * COLS;
      for (let c = 0; c < COLS; c++) {
        if ((raw.charCodeAt(r * by + (c >> 3)) >> (7 - (c & 7))) & 1) land[rr + c] = 1;
      }
    }
  })();
  // 每格中心对应的三角函数表（球面投影用）
  const rowSin = new Float64Array(ROWS), rowCos = new Float64Array(ROWS);
  const colSin = new Float64Array(COLS), colCos = new Float64Array(COLS);
  for (let r = 0; r < ROWS; r++) { const a = rad(90 - (r + 0.5) * CELL); rowSin[r] = Math.sin(a); rowCos[r] = Math.cos(a); }
  for (let c = 0; c < COLS; c++) { const a = rad(-180 + (c + 0.5) * CELL); colSin[c] = Math.sin(a); colCos[c] = Math.cos(a); }

  /* ================= 相机（zoom = 赤道每度像素） ================= */
  const cam = { lon: 95, lat: 14, zoom: 1 };
  let minZoom = 1, MAXZ = 340;
  const minDim = () => Math.min(CW, CH);
  const worldZ = () => Math.max(0.5, minDim() * 0.46 / K);       // 地球仪完整入画
  const globeMaxZ = () => Math.max(worldZ(), minDim() / K);      // 超过此缩放转为平面
  const clampZoom = z => clamp(z, minZoom, MAXZ);
  const isFlat = () => cam.zoom >= globeMaxZ();

  function resize() {
    const r = wrap.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    CW = r.width; CH = r.height;
    DPR = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(CW * DPR);
    canvas.height = Math.round(CH * DPR);
    canvas.style.width = CW + 'px';
    canvas.style.height = CH + 'px';
    minZoom = worldZ() * 0.9;
    cam.zoom = clampZoom(cam.zoom);
    scheduleDraw();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));

  /* ================= 坐标换算 ================= */
  const lonOf = c => (c + 0.5) * CELL - 180;
  const latOf = r => 90 - (r + 0.5) * CELL;
  function flatXY(lon, lat) {
    return [(wrapLon(lon - cam.lon)) * cam.zoom + CW / 2, (cam.lat - lat) * cam.zoom + CH / 2];
  }
  // 平面：把可视经度区间切成 [0,720) 内的列区间（支持跨 180°）
  function lonSegments(aDeg, bDeg) {
    let s = (aDeg + 180) / CELL, e = (bDeg + 180) / CELL;
    const out = [];
    while (s >= COLS) { s -= COLS; e -= COLS; }
    while (s < 0) { s += COLS; e += COLS; }
    if (e > COLS) { out.push([s, COLS]); out.push([0, e - COLS]); }
    else out.push([s, e]);
    return out;
  }
  // 屏幕坐标 -> 地理坐标（球面用正射投影反解）
  function geoAtScreen(sx, sy) {
    if (isFlat()) {
      return { lon: wrapLon(cam.lon + (sx - CW / 2) / cam.zoom), lat: clamp(cam.lat - (sy - CH / 2) / cam.zoom, -89.5, 89.5) };
    }
    const R = cam.zoom * K;
    const dx = (sx - CW / 2) / R, dy = (sy - CH / 2) / R;
    const r2 = dx * dx + dy * dy;
    if (r2 > 1) return null;
    const z = Math.sqrt(1 - r2);
    const v = -dy;                          // 屏幕向上为正北
    const sp = Math.sin(rad(cam.lat)), cp = Math.cos(rad(cam.lat));
    return {
      lat: Math.asin(clamp(v * cp + z * sp, -1, 1)) * K,
      lon: wrapLon(cam.lon + Math.atan2(dx, z * cp - v * sp) * K)
    };
  }
  function clampCam() {
    if (isFlat()) {
      const h = CH / 2 / cam.zoom;
      if (h >= 90) cam.lat = 0;
      else cam.lat = clamp(cam.lat, -90 + h, 90 - h);
    } else cam.lat = clamp(cam.lat, -82, 82);
  }

  /* ================= 点阵绘制 ================= */
  let raf = false, dragging = false;
  function scheduleDraw() {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => {
      raf = false;
      draw();
    });
  }

  function draw() {
    if (!CW) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#f5f7f9';
    ctx.fillRect(0, 0, CW, CH);
    const gz = globeMaxZ();
    const d = gz - cam.zoom;
    // 过渡区只画与美食点同一套投影，避免陆地点与美食锚点错位
    if (d > 0) paintGlobe(1);
    else paintFlat(1);
    paintFoods();
  }

  // 陆地点阵：规则方格；中国陆地按省着色
  const PROV_ORDER = [
    '北京', '天津', '河北', '山西', '内蒙古',
    '辽宁', '吉林', '黑龙江',
    '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东',
    '河南', '湖北', '湖南',
    '广东', '广西', '海南',
    '重庆', '四川', '贵州', '云南', '西藏',
    '陕西', '甘肃', '青海', '宁夏', '新疆',
    '香港', '澳门', '台湾'
  ];
  // 境外灰；国内四色（饱和度拉开，相邻易辨）
  const LAND_COLOR0 = '#c5ced4';
  const MAP_PALETTE = ['#5f9e68', '#e0b83d', '#d4725a', '#4f8fc4'];
  const provColors = [LAND_COLOR0];
  // 省界栅格（DataV 省级边界），境外为 0
  const provGrid = new Uint8Array(COLS * ROWS);
  (function decodeProv() {
    const raw = window.PROV_LAND_DATA;
    if (!raw) return;
    const bin = atob(raw);
    const n = Math.min(bin.length, provGrid.length);
    for (let i = 0; i < n; i++) provGrid[i] = bin.charCodeAt(i);

    // 只在中国范围做扩边/净化（全球扫一遍太重）
    const pr0 = Math.max(1, Math.floor((90 - 54.5) / CELL));
    const pr1 = Math.min(ROWS - 2, Math.floor((90 - 15.5) / CELL));
    const pc0 = Math.max(1, Math.floor((72.5 + 180) / CELL));
    const pc1 = Math.min(COLS - 2, Math.floor((135.5 + 180) / CELL));

    for (let pass = 0; pass < 2; pass++) {
      const next = new Uint8Array(provGrid);
      for (let r = pr0; r <= pr1; r++) {
        const base = r * COLS;
        for (let c = pc0; c <= pc1; c++) {
          const i = base + c;
          if (provGrid[i] || !land[i]) continue;
          let id = 0, conflict = false;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              const p = provGrid[(r + dr) * COLS + c + dc];
              if (!p) continue;
              if (!id) id = p;
              else if (p !== id) { conflict = true; break; }
            }
            if (conflict) break;
          }
          if (id && !conflict) next[i] = id;
        }
      }
      provGrid.set(next);
    }

    for (let pass = 0; pass < 2; pass++) {
      const next = new Uint8Array(provGrid);
      for (let r = pr0; r <= pr1; r++) {
        const base = r * COLS;
        for (let c = pc0; c <= pc1; c++) {
          const i = base + c;
          const cur = provGrid[i];
          if (!cur) continue;
          const counts = new Uint8Array(40);
          let nn = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              const p = provGrid[(r + dr) * COLS + c + dc];
              if (!p) continue;
              counts[p]++;
              nn++;
            }
          }
          if (nn < 4) continue;
          let best = 0, bc = 0;
          for (let p = 1; p < 40; p++) if (counts[p] > bc) { bc = counts[p]; best = p; }
          if (best && best !== cur && bc >= 5) next[i] = best;
        }
      }
      provGrid.set(next);
    }

    // 邻接图 + 贪心四色
    const nProv = PROV_ORDER.length;
    const adj = Array.from({ length: nProv + 1 }, () => new Set());
    for (let r = pr0; r <= pr1; r++) {
      const base = r * COLS;
      for (let c = pc0; c <= pc1; c++) {
        const a = provGrid[base + c];
        if (!a) continue;
        const right = provGrid[base + c + 1];
        const down = provGrid[base + COLS + c];
        if (right && right !== a) { adj[a].add(right); adj[right].add(a); }
        if (down && down !== a) { adj[a].add(down); adj[down].add(a); }
      }
    }
    const colorIdx = new Uint8Array(nProv + 1);
    for (let id = 1; id <= nProv; id++) {
      const used = [false, false, false, false, false];
      adj[id].forEach(nb => { if (colorIdx[nb]) used[colorIdx[nb]] = true; });
      let ci = 1;
      while (ci <= MAP_PALETTE.length && used[ci]) ci++;
      if (ci > MAP_PALETTE.length) ci = 1 + ((id - 1) % MAP_PALETTE.length);
      colorIdx[id] = ci;
      provColors[id] = MAP_PALETTE[ci - 1];
    }
  })();

  function landGapPx(globe) {
    if (globe) return 7.5;
    const gz = globeMaxZ();
    const t = clamp((cam.zoom - gz) / Math.max(28, gz * 5), 0, 1);
    return 10.5 - t * 2.5;
  }
  function landDotR(spacingPx) {
    return Math.min(2.4, Math.max(1.05, spacingPx * 0.3));
  }
  function landAt(r, c) {
    if (r < 0 || r >= ROWS) return false;
    return !!land[r * COLS + ((c % COLS) + COLS) % COLS];
  }
  function landAtLatLon(lat, lon) {
    const r = Math.floor((90 - lat) / CELL);
    const c = Math.floor((lon + 180) / CELL);
    return landAt(r, c) ? [r, ((c % COLS) + COLS) % COLS] : null;
  }
  function provAt(r, c) {
    if (r < 0 || r >= ROWS) return 0;
    return provGrid[r * COLS + ((c % COLS) + COLS) % COLS] || 0;
  }
  function paintProvId(r, c) {
    return provAt(r, c) || 0;
  }
  // 分批 + 小点用 rect：避免超大 path / arc 在部分 WebView 静默失败
  function fillProvBuckets(buckets) {
    const BATCH = 400;
    for (let pid = 0; pid < buckets.length; pid++) {
      const pts = buckets[pid];
      if (!pts.length) continue;
      ctx.fillStyle = provColors[pid] || LAND_COLOR0;
      for (let i = 0; i < pts.length; ) {
        ctx.beginPath();
        const end = Math.min(pts.length, i + BATCH * 3);
        for (; i < end; i += 3) {
          const x = pts[i], y = pts[i + 1], rr = pts[i + 2];
          if (rr <= 1.6) {
            const s = rr * 1.7;
            ctx.rect(x - s * 0.5, y - s * 0.5, s, s);
          } else {
            ctx.moveTo(x + rr, y);
            ctx.arc(x, y, rr, 0, TAU);
          }
        }
        ctx.fill();
      }
    }
  }

  // 平面：按屏幕等距布点，高低纬密度一致
  function paintFlat(a) {
    if (a <= 0.01) return;
    const zoom = cam.zoom;
    const gap = landGapPx(false);
    const rr = landDotR(gap);
    const buckets = Array.from({ length: PROV_ORDER.length + 1 }, () => []);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#f5f7f9';
    ctx.fillRect(0, 0, CW, CH);

    const x0 = (gap * 0.5) % gap;
    const y0 = (gap * 0.5) % gap;
    for (let y = y0; y < CH + gap; y += gap) {
      for (let x = x0; x < CW + gap; x += gap) {
        const lon = wrapLon(cam.lon + (x - CW / 2) / zoom);
        const lat = cam.lat - (y - CH / 2) / zoom;
        if (lat > 89.9 || lat < -89.9) continue;
        const cell = landAtLatLon(lat, lon);
        if (!cell) continue;
        const pid = paintProvId(cell[0], cell[1]);
        buckets[pid].push(x, y, rr);
      }
    }
    fillProvBuckets(buckets);
    ctx.globalAlpha = 1;
  }

  // 球面：同样按屏幕等距采样再反投影
  function paintGlobe(a) {
    if (a <= 0.01) return;
    const zoom = cam.zoom, R = zoom * K;
    const cx = CW / 2, cy = CH / 2;
    if (R < 2) return;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();

    ctx.fillStyle = '#f5f7f9';
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    const hi = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.5, R * 0.1, cx, cy, R);
    hi.addColorStop(0, 'rgba(255,255,255,.75)');
    hi.addColorStop(0.45, 'rgba(245,247,249,.2)');
    hi.addColorStop(1, 'rgba(210,218,226,0)');
    ctx.fillStyle = hi;
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);

    const gap = landGapPx(true);
    const rDot = landDotR(gap);
    const buckets = Array.from({ length: PROV_ORDER.length + 1 }, () => []);
    const x0 = (gap * 0.5) % gap;
    const y0 = (gap * 0.5) % gap;
    for (let y = y0; y < CH + gap; y += gap) {
      for (let x = x0; x < CW + gap; x += gap) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > R * R) continue;
        const g = geoAtScreen(x, y);
        if (!g) continue;
        const cell = landAtLatLon(g.lat, g.lon);
        if (!cell) continue;
        const pid = paintProvId(cell[0], cell[1]);
        // 边缘略小，保持球体感
        const t = Math.sqrt(dx * dx + dy * dy) / R;
        const rad = rDot * (1 - t * 0.18);
        buckets[pid].push(x, y, rad);
      }
    }
    fillProvBuckets(buckets);

    const sh = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.1, cx, cy, R);
    sh.addColorStop(0, 'rgba(40,40,50,0)');
    sh.addColorStop(0.8, 'rgba(40,40,50,.04)');
    sh.addColorStop(0.95, 'rgba(40,40,50,.12)');
    sh.addColorStop(1, 'rgba(40,40,50,.28)');
    ctx.fillStyle = sh;
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.restore();

    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(150,162,176,.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ================= 美食标记（canvas，避免上千 DOM） ================= */
  const markersEl = document.createElement('div');
  markersEl.id = 'markers';
  wrap.appendChild(markersEl);
  const selDot = document.createElement('button');
  selDot.className = 'dot on';
  selDot.hidden = true;
  const selLab = document.createElement('span');
  selLab.className = 'mlabel';
  selDot.appendChild(selLab);
  selDot.addEventListener('click', e => {
    e.stopPropagation();
    if (movedPx > 8 || sel < 0) return;
    openPlace(sel);
  });
  markersEl.appendChild(selDot);
  let sel = -1;
  let selClusterKey = null; // 打开聚合 dialog 时高亮对应聚合点
  // 本帧可见点缓存，供点击命中 {kind,x,y,r,i?,lon?,lat?,n?}
  let hitList = [];

  // 地点球面投影（正射）
  function projPlace(lat, lon) {
    const R = cam.zoom * K;
    const s0 = Math.sin(rad(cam.lat)), c0 = Math.cos(rad(cam.lat));
    const sl0 = Math.sin(rad(cam.lon)), cl0 = Math.cos(rad(cam.lon));
    const p = rad(lat), dl = rad(wrapLon(lon - cam.lon));
    const sf = Math.sin(p), cf = Math.cos(p);
    const zz = s0 * sf + c0 * cf * Math.cos(dl);
    if (zz < 0.03) return null;
    return {
      x: CW / 2 + cf * Math.sin(dl) * R,
      y: CH / 2 - (c0 * sf - s0 * cf * Math.cos(dl)) * R,
      z: zz
    };
  }

  // 聚合格网：屏幕最小间距偏大，全国/省域视野强制粗格 + 屏幕二次合并
  let aggDegHeld = 8;
  function foodMinSepPx() {
    return 58;
  }
  function foodAggDeg() {
    const minSepPx = foodMinSepPx();
    const raw = minSepPx / Math.max(cam.zoom, 0.01);
    // 更粗：全国约 8–12°，省域约 2–4°，最细 0.35°
    const steps = [12, 8, 5, 3, 2, 1, 0.5, 0.35];
    let desired = steps[0];
    for (let i = 0; i < steps.length; i++) {
      if (raw <= steps[i]) desired = steps[i];
    }
    if (raw < steps[steps.length - 1]) desired = steps[steps.length - 1];

    const rank = d => steps.indexOf(d);
    const di = rank(desired), hi = rank(aggDegHeld);
    if (di < 0) aggDegHeld = desired;
    else if (di > hi) {
      const edge = steps[hi] * 0.9;
      if (raw <= edge) aggDegHeld = desired;
    } else if (di < hi) {
      if (raw >= desired * 1.15) aggDegHeld = desired;
    }
    return aggDegHeld;
  }

  // 屏幕距离过近的聚合再合并，避免相邻格网仍挤在一起
  function mergeByScreen(items, minPx) {
    if (items.length < 2) return items;
    const used = new Uint8Array(items.length);
    const out = [];
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      let cur = {
        n: items[i].n,
        lat: items[i].lat,
        lon: items[i].lon,
        x: items[i].x,
        y: items[i].y,
        z: items[i].z,
        i: items[i].i,
        ids: items[i].ids.slice(),
        hasSel: items[i].hasSel,
        key: items[i].key
      };
      used[i] = 1;
      let grew = true;
      while (grew) {
        grew = false;
        for (let j = 0; j < items.length; j++) {
          if (used[j]) continue;
          if (Math.hypot(cur.x - items[j].x, cur.y - items[j].y) > minPx) continue;
          const tn = cur.n + items[j].n;
          cur.lat = (cur.lat * cur.n + items[j].lat * items[j].n) / tn;
          cur.lon = (cur.lon * cur.n + items[j].lon * items[j].n) / tn;
          cur.n = tn;
          cur.ids.push(...items[j].ids);
          if (items[j].hasSel) { cur.hasSel = true; cur.i = items[j].i; }
          const g = screenPos(cur.lat, cur.lon);
          if (g) { cur.x = g.x; cur.y = g.y; cur.z = g.z; }
          used[j] = 1;
          grew = true;
        }
      }
      out.push(cur);
    }
    return out;
  }

  function foodDotRadius(count) {
    const zoom = cam.zoom, flat = isFlat(), gz = globeMaxZ();
    const cluster = count > 1;
    if (!flat) {
      const t = clamp((zoom - minZoom) / Math.max(0.01, gz - minZoom), 0, 1);
      return cluster ? (12 + t * 2) : (5.5 + t * 3.5);
    }
    const t = clamp((zoom - gz) / Math.max(8, gz * 3), 0, 1);
    return cluster ? (14 + t * 2) : (9.5 + t * 5);
  }

  function screenPos(lat, lon) {
    if (isFlat()) {
      const [x, y] = flatXY(lon, lat);
      return { x, y, z: 1 };
    }
    return projPlace(lat, lon);
  }

  // 高亮：同色放大 + 暖金描边（无箭头、不变色）
  function drawFoodMarker(x, y, baseR, fill, label, highlighted) {
    const rr = highlighted ? Math.max(baseR * 1.7, baseR + 6) : baseR;
    if (highlighted) {
      // 外圈柔光
      ctx.beginPath();
      ctx.arc(x, y, rr + 3.5, 0, TAU);
      ctx.strokeStyle = 'rgba(201, 162, 39, .35)';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = highlighted ? 3.2 : 1.6;
    ctx.strokeStyle = highlighted ? '#e8c86a' : 'rgba(255,248,240,.95)';
    ctx.stroke();
    if (label != null && label !== '') {
      ctx.fillStyle = '#fffaf5';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.max(10, Math.round(rr * (String(label).length > 1 ? 0.9 : 1.05)))}px "PingFang SC",-apple-system,sans-serif`;
      ctx.fillText(String(label), x, y + 0.5);
    }
    return rr;
  }

  function paintFoods() {
    if (!CW) return;
    const flat = isFlat();
    const agg = foodAggDeg();
    const m = 36;
    const buckets = new Map();
    hitList = [];

    for (let i = 0; i < PLACES.length; i++) {
      const p = PLACES[i];
      const gi = Math.floor((p.lat + 90) / agg);
      const gj = Math.floor((p.lon + 180) / agg);
      const key = gi + ':' + gj;
      let b = buckets.get(key);
      if (!b) {
        b = { n: 0, lat: 0, lon: 0, i: i, hasSel: false, ids: [], key };
        buckets.set(key, b);
      }
      b.n += 1;
      b.lat += p.lat;
      b.lon += p.lon;
      b.ids.push(i);
      if (i === sel) { b.hasSel = true; b.i = i; }
      else if (!b.hasSel && b.n === 1) b.i = i;
    }

    // 地理格 → 屏幕点，再按像素距离二次合并
    const projected = [];
    for (const b of buckets.values()) {
      const count = b.n;
      const useLat = (b.hasSel && count === 1) ? PLACES[sel].lat : (b.lat / count);
      const useLon = (b.hasSel && count === 1) ? PLACES[sel].lon : (b.lon / count);
      const g = screenPos(useLat, useLon);
      if (!g) continue;
      if (g.x < -m || g.x > CW + m || g.y < -m || g.y > CH + m) continue;
      projected.push({
        n: count,
        lat: useLat,
        lon: useLon,
        x: g.x,
        y: g.y,
        z: g.z || 1,
        i: b.i,
        ids: b.ids.slice(),
        hasSel: b.hasSel,
        key: b.key
      });
    }
    const merged = mergeByScreen(projected, foodMinSepPx());

    let selDrawn = false;
    for (const b of merged) {
      const count = b.n;
      let hi = (b.hasSel && count === 1);
      if (selClusterKey) {
        hi = hi || b.key === selClusterKey || b.ids.some(id => {
          const p = PLACES[id];
          const gi = Math.floor((p.lat + 90) / agg);
          const gj = Math.floor((p.lon + 180) / agg);
          return (gi + ':' + gj) === selClusterKey;
        });
      }

      const baseR = foodDotRadius(count) * (flat ? 1 : (0.72 + 0.28 * b.z));
      const fill = count > 1 ? '#c44532' : '#d85a42';
      const label = count > 1
        ? Math.min(99, count)
        : (PLACES[b.i].n || '?').charAt(0);

      const rr = drawFoodMarker(b.x, b.y, baseR, fill, label, hi);

      hitList.push({
        kind: count > 1 ? 'cluster' : 'place',
        i: b.i,
        ids: b.ids.slice(),
        key: b.key,
        n: count,
        x: b.x, y: b.y,
        r: rr + (flat ? 14 : 10),
        lon: b.lon, lat: b.lat
      });

      if (hi && count === 1) {
        selDrawn = true;
        selDot.hidden = false;
        selDot.style.opacity = '1';
        selDot.style.setProperty('--x', (Math.round(b.x * 10) / 10) + 'px');
        selDot.style.setProperty('--y', (Math.round((b.y - rr - 10) * 10) / 10) + 'px');
        selDot.style.setProperty('--sc', '1');
        selLab.textContent = PLACES[sel].n;
      }
    }

    if (!selDrawn) selDot.hidden = true;
  }

  function hitFood(sx, sy) {
    let best = null, bestD = 1e9;
    for (const h of hitList) {
      const d = Math.hypot(sx - h.x, sy - h.y);
      if (d <= h.r && d < bestD) { bestD = d; best = h; }
    }
    return best;
  }

  /* ================= 手势 ================= */
  const ptrs = new Map();
  let pinchD = 0, pinchZ = 1, moved = false, movedPx = 0, animId = 0;
  const local = e => { const r = wrap.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function cancelAnim() { cancelAnimationFrame(animId); }

  wrap.addEventListener('pointerdown', e => {
    try { (e.target || canvas).setPointerCapture(e.pointerId); } catch (err) {}
    ptrs.set(e.pointerId, local(e));
    pinchD = 0; moved = false; movedPx = 0;
    dragging = true;
    cancelAnim();
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinchD = Math.hypot(a[0] - b[0], a[1] - b[1]);
      pinchZ = cam.zoom;
    }
  });
  wrap.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const p0 = ptrs.get(e.pointerId);
    const p1 = local(e);
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    ptrs.set(e.pointerId, p1);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinchD > 0 && d > 0) {
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        zoomTo(clampZoom(pinchZ * (d / pinchD)), mx, my);
      }
      moved = true; movedPx += Math.abs(dx) + Math.abs(dy);
    } else if (ptrs.size === 1) {
      movedPx += Math.abs(dx) + Math.abs(dy);
      if (movedPx > 1.5) moved = true;
      if (moved) {
        cam.lon = wrapLon(cam.lon - dx / cam.zoom);
        cam.lat += dy / cam.zoom;
        clampCam();
        scheduleDraw();
      }
    }
  });
  function endPtr(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size === 0) {
      moved = false;
      dragging = false;
      scheduleDraw(); // 松手精绘
    }
  }
  wrap.addEventListener('pointerup', endPtr);
  wrap.addEventListener('pointercancel', endPtr);

  // 以屏幕锚点缩放（拖动/捏合/滚轮共用）
  function zoomTo(nz, ax, ay) {
    nz = clampZoom(nz);
    if (nz === cam.zoom) return;
    // 平面（或即将进入平面）：用平面公式保持锚点地理坐标
    if (isFlat() || nz >= globeMaxZ()) {
      const gx = wrapLon(cam.lon + (ax - CW / 2) / cam.zoom);
      const gy = cam.lat - (ay - CH / 2) / cam.zoom;
      cam.zoom = nz;
      cam.lon = gx - (ax - CW / 2) / nz;
      cam.lat = gy + (ay - CH / 2) / nz;
    } else {
      // 地球仪：先记下锚点地理坐标，改缩放后把相机微调回去，
      // 绝不能直接 cam = 锚点（那会每帧把中心吸到指针上 → 触控板捏合狂抖）
      const g = geoAtScreen(ax, ay);
      cam.zoom = nz;
      if (g) {
        for (let i = 0; i < 5; i++) {
          const cur = geoAtScreen(ax, ay);
          if (!cur) break;
          const dLon = wrapLon(g.lon - cur.lon);
          const dLat = g.lat - cur.lat;
          if (Math.abs(dLon) < 1e-4 && Math.abs(dLat) < 1e-4) break;
          cam.lon = wrapLon(cam.lon + dLon);
          cam.lat += dLat;
          clampCam();
        }
      }
    }
    clampCam();
    scheduleDraw();
  }

  let lastTap = { t: 0, x: 0, y: 0 };
  canvas.addEventListener('click', e => {
    if (movedPx > 8) return;
    const r = wrap.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const now = Date.now();
    if (now - lastTap.t < 300 && Math.hypot(x - lastTap.x, y - lastTap.y) < 42) {
      lastTap.t = 0;
      const g = geoAtScreen(x, y) || { lon: cam.lon, lat: cam.lat };
      flyTo(g.lon, g.lat, clampZoom(cam.zoom * 1.9), false, 360);
      return;
    }
    lastTap = { t: now, x, y };
    const h = hitFood(x, y);
    if (h) {
      if (h.kind === 'cluster') {
        openCluster(h.ids, h.lon, h.lat, h.key);
        return;
      }
      openPlace(h.i);
      return;
    }
    hideCluster();
    hideSheet();
    setSel(-1);
  });

  // 触控板捏合事件极密，合并到每帧处理一次，避免连续抖
  let wheelAcc = 0, wheelAx = 0, wheelAy = 0, wheelRaf = 0, wheelIdleTimer = 0;
  function flushWheelZoom() {
    wheelRaf = 0;
    if (wheelAcc === 0) return;
    const acc = wheelAcc;
    wheelAcc = 0;
    zoomTo(clampZoom(cam.zoom * Math.pow(1.0018, -acc)), wheelAx, wheelAy);
  }
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    cancelAnim();
    const r = wrap.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    let dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 16; dy *= 16; }
    else if (e.deltaMode === 2) { dx *= CW; dy *= CH; }
    if (e.ctrlKey) {
      wheelAcc += dy;
      wheelAx = px; wheelAy = py;
      dragging = true;
      if (!wheelRaf) wheelRaf = requestAnimationFrame(flushWheelZoom);
      clearTimeout(wheelIdleTimer);
      wheelIdleTimer = setTimeout(() => {
        if (!ptrs.size) { dragging = false; scheduleDraw(); }
      }, 120);
    } else {
      cam.lon = wrapLon(cam.lon + dx / cam.zoom);
      cam.lat -= dy / cam.zoom;
      clampCam();
      scheduleDraw();
    }
  }, { passive: false });
  wrap.addEventListener('wheel', e => e.preventDefault(), { passive: false });

  function pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  $('#zin').addEventListener('click', () => { pop($('#zin')); animZoomBy(1.75); });
  $('#zout').addEventListener('click', () => { pop($('#zout')); animZoomBy(1 / 1.75); });
  $('#zreset').addEventListener('click', () => { pop($('#zreset')); flyTo(95, 14, worldZ(), false, 520); });

  // 缩放按钮带动画的平滑缩放
  function animZoomBy(f) {
    const g = geoAtScreen(CW / 2, CH / 2) || { lon: cam.lon, lat: cam.lat };
    flyTo(g.lon, g.lat, clampZoom(cam.zoom * f), false, 380);
  }

  // 平滑飞行（缓动 + 就近绕转）
  function flyTo(lon, lat, zoom, instant, dur) {
    zoom = clampZoom(zoom);
    lon = cam.lon + wrapLon(lon - cam.lon);
    const s0 = { lon: cam.lon, lat: cam.lat, zoom: cam.zoom };
    const t0 = performance.now();
    const total = instant ? 1 : (dur || 700);
    cancelAnim();
    (function step(t) {
      const k = Math.min(1, (t - t0) / total);
      const e = 1 - Math.pow(1 - k, 3);
      cam.lon = s0.lon + (lon - s0.lon) * e;
      cam.lat = s0.lat + (lat - s0.lat) * e;
      cam.zoom = s0.zoom + (zoom - s0.zoom) * e;
      clampCam();
      scheduleDraw();
      if (k < 1) animId = requestAnimationFrame(step);
    })(performance.now());
  }
  function setSel(i) {
    sel = i;
    if (i >= 0) selClusterKey = null;
    scheduleDraw();
  }

  /* ================= 单点详情 ================= */
  const sName = $('#sName'), sSub = $('#sSub'), placeDesc = $('#placeDesc'), sHeart = $('#sHeart');
  let openIdx = -1;

  function openPlace(i, opts = {}) {
    hideCluster();
    const p = PLACES[i];
    openIdx = i;
    sName.textContent = p.n;
    const where = [p.prov, p.city].filter(Boolean).filter((v, idx, a) => a.indexOf(v) === idx).join(' · ');
    sSub.textContent = where || p.sec || '';
    const f = (p.foods && p.foods[0]) || {};
    placeDesc.textContent = f.d || '暂无简介';
    sHeart.classList.toggle('on', isFav(i));
    openSheet();
    const focusZ = () => Math.max(globeMaxZ() * 1.5, 15);
    if (opts.fly) {
      switchTab('map');
      flyTo(p.lon, p.lat, opts.zoom || focusZ(), false, 760);
      setTimeout(() => setSel(i), 400);
    } else {
      setSel(i);
    }
  }
  function openSheet() {
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
  }
  function hideSheet() {
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    openIdx = -1;
  }
  $('#sheetClose').addEventListener('click', () => {
    hideSheet();
    setSel(-1);
  });

  /* ================= 聚合 dialog ================= */
  const clusterDlg = $('#clusterDlg');
  const clusterList = $('#clusterList');
  const cTitle = $('#cTitle');
  const cSub = $('#cSub');

  function openCluster(ids, lon, lat, key) {
    hideSheet();
    sel = -1;
    selClusterKey = key || null;
    scheduleDraw();
    const list = (ids || []).slice();
    cTitle.textContent = '附近美食';
    cSub.textContent = `共 ${list.length} 道 · 点击展开简介`;
    clusterList.innerHTML = '';
    list.forEach((idx) => {
      const p = PLACES[idx];
      if (!p) return;
      const btn = document.createElement('button');
      btn.className = 'cluster-item';
      const where = [p.city, p.prov].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ');
      const desc = (p.foods[0] && p.foods[0].d) || '暂无简介';
      btn.innerHTML =
        `<span class="pin">${(p.n || '?').charAt(0)}</span>` +
        `<span class="cinfo">` +
          `<span class="cname">${p.n}</span>` +
          (where ? `<div class="cmeta">${where}</div>` : '') +
          `<div class="csub">${desc}</div>` +
        `</span>` +
        `<span class="chev">›</span>`;
      btn.addEventListener('click', () => {
        const on = btn.classList.contains('open');
        clusterList.querySelectorAll('.cluster-item.open').forEach(el => el.classList.remove('open'));
        if (!on) btn.classList.add('open');
      });
      clusterList.appendChild(btn);
    });
    clusterDlg.classList.add('open');
    clusterDlg.setAttribute('aria-hidden', 'false');
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      flyTo(lon, lat, cam.zoom, false, 320);
    }
  }
  function hideCluster() {
    clusterDlg.classList.remove('open');
    clusterDlg.setAttribute('aria-hidden', 'true');
    if (selClusterKey) {
      selClusterKey = null;
      scheduleDraw();
    }
  }
  $('#clusterClose').addEventListener('click', hideCluster);
  sHeart.addEventListener('click', () => {
    const i = openIdx;
    if (i < 0) return;
    if (isFav(i)) { favSet.delete(i); toast('已移除收藏'); }
    else { favSet.add(i); toast('已收藏 ♥'); }
    saveFavs();
    sHeart.classList.toggle('on', isFav(i));
    if (state.tab === 'list') renderList();
  });
  let toastTimer;
  function toast(m) {
    toastEl.textContent = m;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1500);
  }

  /* ================= 名录页（按省折叠） ================= */
  const state = { tab: 'map' };
  const listEl = $('#list');
  let q = '', onlyFav = false;
  const expandedProv = new Set(); // 展开的省

  function switchTab(t) {
    state.tab = t;
    hideSheet();
    hideCluster();
    setSel(-1);
    $('#mapScreen').classList.toggle('active', t === 'map');
    $('#listScreen').classList.toggle('active', t === 'list');
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    if (t === 'list') renderList();
    else {
      requestAnimationFrame(resize);
      scheduleDraw();
    }
  }
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('#searchInput').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); renderList(); });
  $('#favFilter').addEventListener('click', () => { onlyFav = !onlyFav; $('#favFilter').classList.toggle('on', onlyFav); renderList(); });

  function passFilter(p, i) {
    if (onlyFav && !isFav(i)) return false;
    if (!q) return true;
    // 只匹配地点相关：菜名 / 省 / 市 / 大区（不匹配简介）
    if (p.n.toLowerCase().includes(q)) return true;
    if (p.prov && p.prov.toLowerCase().includes(q)) return true;
    if (p.city && p.city.toLowerCase().includes(q)) return true;
    if (p.sec && p.sec.toLowerCase().includes(q)) return true;
    return p.foods.some(f => f.n.toLowerCase().includes(q));
  }

  function appendPlaceRow(card, idx) {
    const p = PLACES[idx];
    const row = document.createElement('div');
    row.className = 'row';
    const prov = p.prov || '';
    const sub = (p.city && p.city !== prov ? p.city + (q ? ' · ' + prov : '') : prov) || p.sec || '';
    const sub2 = q
      ? sub
      : ((p.city && p.city !== prov ? p.city + ' · ' : '') +
        ((p.foods[0] && p.foods[0].d) || '').slice(0, 28) +
        ((p.foods[0] && p.foods[0].d && p.foods[0].d.length > 28) ? '…' : ''));
    row.innerHTML =
      `<span class="pin">${p.n.charAt(0)}</span>` +
      `<button type="button" class="chead">` +
        `<span class="cname">${p.n}${isFav(idx) ? ' ♥' : ''}</span>` +
        `<div class="csub">${sub2}</div>` +
      `</button>` +
      `<button type="button" class="locate" aria-label="在地图查看" title="定位">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c-3.6 0-6.5 2.8-6.5 6.3 0 4.7 6.5 13.2 6.5 13.2S18.5 13 18.5 8.3C18.5 4.8 15.6 2 12 2zm0 8.6a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6z"/></svg>` +
      `</button>`;
    row.querySelector('.chead').addEventListener('click', () => openPlace(idx));
    row.querySelector('.locate').addEventListener('click', e => {
      e.stopPropagation();
      openPlace(idx, { fly: true });
    });
    card.appendChild(row);
  }

  function renderList() {
    listEl.innerHTML = '';
    const matched = [];
    PLACES.forEach((p, i) => { if (passFilter(p, i)) matched.push(i); });

    if (!matched.length) {
      const tip = document.createElement('div');
      tip.className = 'sheet-emptytip';
      tip.textContent = onlyFav ? '还没有收藏，点卡片 ♡ 收藏' : '没有匹配的结果';
      listEl.appendChild(tip);
      return;
    }

    // 搜索：不分组，直接列表
    if (q) {
      const card = document.createElement('div');
      card.className = 'card';
      matched.forEach(idx => appendPlaceRow(card, idx));
      listEl.appendChild(card);
      return;
    }

    const byProv = new Map();
    matched.forEach(i => {
      const p = PLACES[i];
      const prov = p.prov || p.city || p.sec || '其他';
      if (!byProv.has(prov)) byProv.set(prov, []);
      byProv.get(prov).push(i);
    });

    const order = PROV_ORDER.filter(p => byProv.has(p));
    byProv.forEach((_, k) => { if (!order.includes(k)) order.push(k); });

    if (onlyFav) order.forEach(p => expandedProv.add(p));

    order.forEach(prov => {
      const list = byProv.get(prov);
      if (!list || !list.length) return;
      const open = expandedProv.has(prov);

      const block = document.createElement('div');
      block.className = 'prov-block' + (open ? ' open' : '');

      const head = document.createElement('button');
      head.className = 'prov-head';
      head.type = 'button';
      head.innerHTML =
        `<span class="prov-name">${prov}</span>` +
        `<span class="prov-count">${list.length}</span>` +
        `<span class="prov-chev">${open ? '∨' : '›'}</span>`;
      head.addEventListener('click', () => {
        if (expandedProv.has(prov)) expandedProv.delete(prov);
        else expandedProv.add(prov);
        renderList();
      });
      block.appendChild(head);

      if (open) {
        const card = document.createElement('div');
        card.className = 'card';
        list.forEach(idx => appendPlaceRow(card, idx));
        block.appendChild(card);
      }
      listEl.appendChild(block);
    });
  }

  /* ================= 启动 ================= */
  resize();
  cam.lon = 105; cam.lat = 35; // 开局对准中国
  // 直接进入平面国视，避免球面上中国省色异常时“看不见”
  cam.zoom = clampZoom(Math.max(globeMaxZ() * 1.15, 12));
  scheduleDraw();
  requestAnimationFrame(() => { scheduleDraw(); });
  setTimeout(() => {
    resize();
    scheduleDraw();
  }, 120);
  setTimeout(() => {
    const h = $('#mapHint');
    h.classList.add('show');
    setTimeout(() => h.classList.remove('show'), 2400);
  }, 500);
})();
