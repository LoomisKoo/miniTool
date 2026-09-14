/* 美食图鉴 · 逻辑层 v2
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
  const FAV_KEY = 'meishitujian-favs';
  const groups = [];
  PLACES.forEach(p => { if (!groups.includes(p.sec)) groups.push(p.sec); });
  let favSet = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
  const saveFavs = () => localStorage.setItem(FAV_KEY, JSON.stringify([...favSet]));
  const isFav = i => favSet.has(i);

  /* ================= 筛选（分类 / 口味 / 食材 / 做法） ================= */
  const filters = { cats: new Set(), tastes: new Set(), ings: new Set(), cooks: new Set() };
  const ING_PRIORITY = [
    '猪肉', '牛肉', '羊肉', '鸡肉', '鸭肉', '鱼肉', '虾', '蟹', '鸡蛋',
    '豆腐', '白菜', '萝卜', '土豆', '番茄', '茄子', '青椒',
    '葱', '姜', '蒜', '辣椒', '花椒', '大米', '面粉', '面条', '糯米'
  ];
  const COOK_PRIORITY = ['炒', '炖', '蒸', '炸', '烤', '煮', '卤', '焖', '煎', '涮', '煲', '烧', '凉拌', '生食', '腌'];
  function foodOfPlace(p) { return (p && p.foods && p.foods[0]) || {}; }
  function filterSig() {
    return [
      [...filters.cats].sort().join(','),
      [...filters.tastes].sort().join(','),
      [...filters.ings].sort().join(','),
      [...filters.cooks].sort().join(','),
      q // 将搜索关键字也加入签名
    ].join('|');
  }
  function hasAttrFilter() {
    return filters.cats.size || filters.tastes.size || filters.ings.size || filters.cooks.size;
  }
  function passSearchFilter(p) {
    if (!q) return true;
    if (p.n.toLowerCase().includes(q)) return true;
    if (p.prov && p.prov.toLowerCase().includes(q)) return true;
    if (p.city && p.city.toLowerCase().includes(q)) return true;
    if (p.sec && p.sec.toLowerCase().includes(q)) return true;
    const f = foodOfPlace(p);
    if (f.n && f.n.toLowerCase().includes(q)) return true;
    if ((f.ing || []).some((x) => x.toLowerCase().includes(q))) return true;
    if ((f.tags || []).some((x) => x.toLowerCase().includes(q))) return true;
    if (f.cat && f.cat.toLowerCase().includes(q)) return true;
    if (f.taste && f.taste.toLowerCase().includes(q)) return true;
    if (f.cui && f.cui.toLowerCase().includes(q)) return true;
    return p.foods.some(ff => ff.n.toLowerCase().includes(q));
  }
  function passAttrFilter(p) {
    if (!hasAttrFilter()) return true;
    const f = foodOfPlace(p);
    if (filters.cats.size && !filters.cats.has(f.cat)) return false;
    if (filters.tastes.size && !filters.tastes.has(f.taste)) return false;
    if (filters.ings.size) {
      const ing = f.ing || [];
      if (![...filters.ings].some((x) => ing.includes(x))) return false;
    }
    if (filters.cooks.size) {
      const cook = f.cook || [];
      if (![...filters.cooks].some((x) => cook.includes(x))) return false;
    }
    return true;
  }
  function collectFilterOptions() {
    const cats = new Set(), tastes = new Set(), ings = new Set(), cooks = new Set();
    PLACES.forEach((p) => {
      const f = foodOfPlace(p);
      if (f.cat) cats.add(f.cat);
      if (f.taste) tastes.add(f.taste);
      (f.ing || []).forEach((x) => ings.add(x));
      (f.cook || []).forEach((x) => cooks.add(x));
    });
    const sortZh = (a, b) => a.localeCompare(b, 'zh');
    const prio = (list, priority) => {
      const set = new Set(list);
      const head = priority.filter((x) => set.has(x));
      const rest = [...set].filter((x) => !priority.includes(x)).sort(sortZh);
      return [...head, ...rest];
    };
    return {
      cats: [...cats].sort(sortZh),
      tastes: [...tastes].sort(sortZh),
      ings: prio([...ings], ING_PRIORITY),
      cooks: prio([...cooks], COOK_PRIORITY)
    };
  }
  const FILTER_OPTS = collectFilterOptions();

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
  // 手势/动画期间锁死点阵密度与投影模式，松手后再按最终 zoom 刷新一次
  let densZoom = null;
  let densGap = null;
  let densStep = null;
  let densFlat = null;
  // 松手后旧/新两套点阵交叉淡入；手势中仍冻结密度避免每帧换网格
  let densXfade = null;   // { gap, step, flat, t0, dur, u }
  let densXfadeAnim = 0;
  let foodFade = 1, foodFadeAnim = 0;
  const DENS_XFADE_MS = 320;
  function densityZoom() {
    return densZoom != null ? densZoom : cam.zoom;
  }
  function clusterDensityZoom() {
    return densZoom != null ? densZoom : cam.zoom;
  }
  function viewIsFlat() {
    return densFlat != null ? densFlat : isFlat();
  }
  function computeLandGap(globe, z) {
    if (globe) return 7.5;
    const gz = globeMaxZ();
    const t = clamp((z - gz) / Math.max(28, gz * 5), 0, 1);
    let gap = 10.5 - t * 2.5;
    const zTop3 = MAXZ / (1.75 * 1.75);
    if (z >= zTop3) {
      const u = clamp((z - zTop3) / Math.max(1e-6, MAXZ - zTop3), 0, 1);
      gap = 5.6 - u * 1.8;
    }
    return gap;
  }
  function liveDens() {
    const flat = isFlat();
    const gap = computeLandGap(!flat, cam.zoom);
    return { gap, step: Math.max(0.08, gap / Math.max(cam.zoom, 0.01)), flat };
  }
  function cancelDensXfade() {
    densXfade = null;
    cancelAnimationFrame(densXfadeAnim);
    densXfadeAnim = 0;
  }
  function startFoodFade() {
    foodFade = 0;
    cancelAnimationFrame(foodFadeAnim);
    const t0 = performance.now();
    (function step(t) {
      foodFade = Math.min(1, (t - t0) / DENS_XFADE_MS);
      scheduleDraw();
      if (foodFade < 1) foodFadeAnim = requestAnimationFrame(step);
    })(performance.now());
  }
  function beginZoomGesture(heldZ) {
    if (densZoom != null) return;
    cancelDensXfade();
    const z = heldZ != null ? heldZ : cam.zoom;
    densZoom = z;
    densFlat = z >= globeMaxZ();
    densGap = computeLandGap(!densFlat, z);
    densStep = Math.max(0.08, densGap / Math.max(z, 0.01));
    cancelAnimationFrame(foodFadeAnim);
    foodFade = 1;
  }
  function endZoomGesture() {
    if (densZoom == null) return;
    const from = { gap: densGap, step: densStep, flat: densFlat };
    densZoom = null;
    densGap = null;
    densStep = null;
    densFlat = null;
    const to = liveDens();
    // 密度几乎没变就直接切，省一次双绘
    if (from.flat === to.flat && Math.abs(from.step - to.step) < 0.025) {
      startFoodFade();
      return;
    }
    densXfade = { gap: from.gap, step: from.step, flat: from.flat, t0: performance.now(), dur: DENS_XFADE_MS, u: 0 };
    startFoodFade();
    cancelAnimationFrame(densXfadeAnim);
    (function tick(t) {
      if (!densXfade) return;
      const k = Math.min(1, (t - densXfade.t0) / densXfade.dur);
      densXfade.u = 1 - Math.pow(1 - k, 3);   // ease-out
      scheduleDraw();
      if (k < 1) densXfadeAnim = requestAnimationFrame(tick);
      else densXfade = null;
    })(performance.now());
  }
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
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, CW, CH);
    const xf = densXfade;
    if (xf && xf.flat === viewIsFlat()) {
      const u = xf.u || 0;
      if (viewIsFlat()) {
        paintFlat(1 - u, { gap: xf.gap, step: xf.step, clear: true, labels: false });
        paintFlat(u, { clear: false, labels: u > 0.9 });
      } else {
        // 旧层只铺底+点；描边/暗角留给新层，避免交叉淡入时描边闪两下
        paintGlobe(1 - u, { gap: xf.gap, step: xf.step, clear: true, chrome: false, labels: false });
        paintGlobe(u, { clear: false, chrome: true, labels: u > 0.9 });
      }
    } else if (!viewIsFlat()) {
      paintGlobe(1);
    } else {
      paintFlat(1);
    }
    paintFoods();
    updateMapLoc();
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
    '香港', '澳门', '台湾',
    '南海诸岛'   // 九段线（DataV JD 要素），非行政区，只画线不参与名录
  ];
  // 境外深灰；国内七色（深底上色相+明度都拉开，相邻省之外还避开"隔一个省"的同色）
  const LAND_COLOR0 = '#3a3a42';
  const MAP_PALETTE = ['#7fb45f', '#ecb44e', '#e86f5a', '#5fa8d8', '#a884e0', '#3fc9b8', '#e58bb0'];
  const provColors = [LAND_COLOR0];
  // 省界栅格（DataV 省级边界，0.125°，只覆盖中国范围）：稀疏码流 varint(索引增量)+id
  const PCELL = window.PROV_LAND_CELL || 0.125;
  const PLEFT = window.PROV_LAND_LEFT, PTOP = window.PROV_LAND_TOP;
  const PCOLS = window.PROV_LAND_COLS, PROWS = window.PROV_LAND_ROWS;
  const provGrid = new Uint8Array(PCOLS * PROWS);
  // 省重心（lat,lon 交替）与格数，配色权重和省名标签共用
  const provCent = new Float64Array((PROV_ORDER.length + 1) * 2);
  const provCnt = new Uint32Array(PROV_ORDER.length + 1);
  const provAllCent = new Float64Array((PROV_ORDER.length + 1) * 2);
  const provAllCnt = new Uint32Array(PROV_ORDER.length + 1);
  // 配色软约束的权重：两省重心越近，同色的代价越高（1/d²，近到 120km 就饱和）
  function hopWeight(a, b) {
    const dLat = provCent[a * 2] - provCent[b * 2];
    const dLon = (provCent[a * 2 + 1] - provCent[b * 2 + 1]) *
      Math.cos((provCent[a * 2] + provCent[b * 2]) * 0.5 * Math.PI / 180);
    const d = Math.max(Math.hypot(dLat, dLon) * 111, 120);
    return 1 / (d * d);
  }
  (function decodeProv() {
    const raw = window.PROV_LAND_DATA;
    if (!raw || !PCOLS) return;
    const bin = atob(raw);
    let i = 0, idx = 0;
    while (i < bin.length) {
      let shift = 0, d = 0;
      for (;;) {
        const b = bin.charCodeAt(i++);
        d += (b & 0x7f) * Math.pow(2, shift);
        if (!(b & 0x80)) break;
        shift += 7;
      }
      idx += d;
      if (idx >= provGrid.length) break;
      provGrid[idx] = bin.charCodeAt(i++);
    }

    // 扩边：DataV 省界比 Natural Earth 海岸线简化，留下「底图是陆地、省级无归属」的灰点。
    // 只向 land 格子扩，且要求邻域无归属冲突，避免把国界外染成中国省份色。
    const landAtCell = (lat, lon) => {
      const r = Math.floor((90 - lat) / CELL), c = Math.floor((lon + 180) / CELL);
      return landAt(r, c);
    };
    for (let pass = 0; pass < 2; pass++) {
      const next = new Uint8Array(provGrid);
      for (let r = 1; r < PROWS - 1; r++) {
        const base = r * PCOLS;
        const lat = PTOP - (r + 0.5) * PCELL;
        for (let c = 1; c < PCOLS - 1; c++) {
          const i = base + c;
          if (provGrid[i]) continue;
          if (!landAtCell(lat, PLEFT + (c + 0.5) * PCELL)) continue;
          let id = 0, conflict = false;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              const p = provGrid[(r + dr) * PCOLS + c + dc];
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

    // 净化：把明显被别的省包住的孤立格改判给多数邻省（消除边界毛刺）
    for (let pass = 0; pass < 2; pass++) {
      const next = new Uint8Array(provGrid);
      for (let r = 1; r < PROWS - 1; r++) {
        const base = r * PCOLS;
        for (let c = 1; c < PCOLS - 1; c++) {
          const i = base + c;
          const cur = provGrid[i];
          if (!cur) continue;
          const counts = new Uint8Array(40);
          let nn = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              const p = provGrid[(r + dr) * PCOLS + c + dc];
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

    // 省重心。只用底图认定的陆地格：岛礁格会把海南重心拉到 15.4°N（落进南海），
    // 沿海省也会被拖偏；底图没有陆地的省（港澳由省级栅格独有）退回全部格。
    for (let r = 0; r < PROWS; r++) {
      const base = r * PCOLS;
      const lat = PTOP - (r + 0.5) * PCELL;
      for (let c = 0; c < PCOLS; c++) {
        const id = provGrid[base + c];
        if (!id) continue;
        const lon = PLEFT + (c + 0.5) * PCELL;
        provAllCnt[id]++;
        provAllCent[id * 2] += lat;
        provAllCent[id * 2 + 1] += lon;
        if (!landAtLatLon(lat, lon)) continue;
        provCnt[id]++;
        provCent[id * 2] += lat;
        provCent[id * 2 + 1] += lon;
      }
    }
    for (let id = 1; id <= PROV_ORDER.length; id++) {
      const n = provCnt[id] || provAllCnt[id];
      if (!n) continue;
      const src = provCnt[id] ? provCent : provAllCent;
      provCent[id * 2] = src[id * 2] / n;
      provCent[id * 2 + 1] = src[id * 2 + 1] / n;
      provCnt[id] = n;
    }

    // 邻接图：取 8 邻域（含斜角）。只看上下左右的话，同色省会在角上贴在一起，
    // 缩放到远视野时两个省看着就像连成一片。
    const nProv = PROV_ORDER.length;
    const adj = Array.from({ length: nProv + 1 }, () => new Set());
    for (let r = 0; r < PROWS; r++) {
      const base = r * PCOLS;
      for (let c = 0; c < PCOLS; c++) {
        const a = provGrid[base + c];
        if (!a) continue;
        for (let dr = -1; dr <= 1; dr++) {
          const r2 = r + dr;
          if (r2 < 0 || r2 >= PROWS) continue;
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const c2 = c + dc;
            if (c2 < 0 || c2 >= PCOLS) continue;
            const b = provGrid[r2 * PCOLS + c2];
            if (b && b !== a) { adj[a].add(b); adj[b].add(a); }
          }
        }
      }
    }

    // 配色：1 跳是硬约束（相邻必须异色），2 跳是软约束（隔着一个省也尽量异色，
    // 且两省重心越近权重越高）—— 南方省份挤在一起，正是这里最容易糊成一片。
    const colorIdx = new Uint8Array(nProv + 1);
    const twoHop = Array.from({ length: nProv + 1 }, () => new Map());   // 邻省 → 权重
    for (let id = 1; id <= nProv; id++) {
      if (!adj[id].size) continue;
      adj[id].forEach(nb => {
        adj[nb].forEach(k => {
          if (k === id) return;
          if (twoHop[id].has(k)) return;
          twoHop[id].set(k, hopWeight(id, k));
        });
      });
    }
    const hopCost = idx => {
      let c = 0;
      for (let a = 1; a <= nProv; a++) {
        const ca = idx[a];
        if (!ca) continue;
        for (const [b, w] of twoHop[a]) {
          if (b < a && idx[b] === ca) c += w;
        }
      }
      return c;
    };
    const L = MAP_PALETTE.length;
    for (let id = 1; id <= nProv; id++) {
      const banned = new Set();
      adj[id].forEach(nb => { if (colorIdx[nb]) banned.add(colorIdx[nb]); });
      let best = 0, bestCost = Infinity;
      for (let ci = 1; ci <= L; ci++) {
        if (banned.has(ci)) continue;
        colorIdx[id] = ci;
        let used = 0;
        for (let a = 1; a < id; a++) if (colorIdx[a] === ci) used++;
        const c = hopCost(colorIdx) + used * 1e-4;      // 同分时选用得少的，色相更匀
        colorIdx[id] = 0;
        if (c < bestCost) { bestCost = c; best = ci; }
      }
      colorIdx[id] = best || (1 + ((id - 1) % L));
    }
    // 局部搜索：把个别省换到更"远离邻居"的颜色上，直到没人愿意换
    for (let iter = 0; iter < 40; iter++) {
      let moved = false;
      for (let id = 1; id <= nProv; id++) {
        if (!adj[id].size) continue;
        const banned = new Set();
        adj[id].forEach(nb => { if (colorIdx[nb]) banned.add(colorIdx[nb]); });
        let cur = colorIdx[id], best = cur, bestCost = hopCost(colorIdx);
        for (let ci = 1; ci <= L; ci++) {
          if (ci === cur || banned.has(ci)) continue;
          colorIdx[id] = ci;
          const c = hopCost(colorIdx);
          if (c < bestCost - 1e-9) { bestCost = c; best = ci; }
        }
        colorIdx[id] = best;
        if (best !== cur) moved = true;
      }
      if (!moved) break;
    }
    for (let id = 1; id <= nProv; id++) {
      if (!colorIdx[id]) continue;
      provColors[id] = MAP_PALETTE[colorIdx[id] - 1];
    }
    // 九段线：不属于任何省，用中性灰蓝，读起来像边界线而不是省面
    const dashId = PROV_ORDER.indexOf('南海诸岛') + 1;
    if (dashId > 0) provColors[dashId] = '#9aa3b4';
  })();
  // 地理坐标 → 省 id（栅格外返回 0）
  function provIdAt(lat, lon) {
    if (!PCOLS) return 0;
    const r = Math.floor((PTOP - lat) / PCELL), c = Math.floor((lon - PLEFT) / PCELL);
    if (r < 0 || r >= PROWS || c < 0 || c >= PCOLS) return 0;
    return provGrid[r * PCOLS + c] || 0;
  }

  // 九段线：DataV 的 JD 是细长多边形，栅格化必糊。这里用生成器提好的中线，
  // 按 0.06° 采样成点，和陆地点阵同一套绘制路径（远看是虚线，放大是点串）
  const DASH_ID = PROV_ORDER.indexOf('南海诸岛') + 1;
  const dashDots = [];   // [lat, lon, ...]
  (function buildDashDots() {
    const lines = window.DASH_LINE;
    if (!lines || !DASH_ID) return;
    const STEP = 0.06;
    for (const line of lines) {
      for (let k = 0; k + 3 < line.length; k += 2) {
        const lon0 = line[k], lat0 = line[k + 1], lon1 = line[k + 2], lat1 = line[k + 3];
        const segs = Math.max(1, Math.round(Math.hypot(lon1 - lon0, lat1 - lat0) / STEP));
        for (let s = 0; s <= segs; s++) {
          if (k && !s) continue;                 // 段间衔接点不重复
          const t = s / segs;
          dashDots.push(lat0 + (lat1 - lat0) * t, lon0 + (lon1 - lon0) * t);
        }
      }
    }
  })();

  // 小岛补点表已不再需要：省级栅格直接参与主采样（见 paintFlat/paintGlobe），
  // 岸线与岛礁自动落在同一套网格上，不再出现第二套更密的点阵。


  // 省名简称（一字）；显示名用 PROV_ORDER（广西/广东，非全称）
  const PROV_ABBR = {
    '北京': '京', '天津': '津', '河北': '冀', '山西': '晋', '内蒙古': '蒙',
    '辽宁': '辽', '吉林': '吉', '黑龙江': '黑',
    '上海': '沪', '江苏': '苏', '浙江': '浙', '安徽': '皖', '福建': '闽', '江西': '赣', '山东': '鲁',
    '河南': '豫', '湖北': '鄂', '湖南': '湘',
    '广东': '粤', '广西': '桂', '海南': '琼',
    '重庆': '渝', '四川': '川', '贵州': '贵', '云南': '云', '西藏': '藏',
    '陕西': '陕', '甘肃': '甘', '青海': '青', '宁夏': '宁', '新疆': '新',
    '香港': '港', '澳门': '澳', '台湾': '台', '南海诸岛': '南海'
  };
  // 省重心（格点均值），供标签定位 —— 由 decodeProv 统一算好（见 provCent）
  const provLabel = Array.from({ length: PROV_ORDER.length + 1 }, () => null);
  (function buildProvLabels() {
    for (let id = 1; id <= PROV_ORDER.length; id++) {
      if (!provCnt[id]) continue;
      const name = PROV_ORDER[id - 1];
      if (name === '南海诸岛') continue; // 九段线是散落的线段，单个重心标签没有意义
      provLabel[id] = {
        name,
        abbr: PROV_ABBR[name] || name.charAt(0),
        lat: provCent[id * 2],
        lon: provCent[id * 2 + 1],
        n: provCnt[id]
      };
    }
    // 港澳格点极少，栅格重心偏北，用更贴近视觉中心的坐标
    const tinyFix = { '香港': [22.28, 114.16], '澳门': [22.18, 113.55] };
    for (let id = 1; id <= PROV_ORDER.length; id++) {
      const p = provLabel[id];
      if (!p || !tinyFix[p.name]) continue;
      p.lat = tinyFix[p.name][0];
      p.lon = tinyFix[p.name][1];
    }
  })();

  /* ================= 顶部位置标题（随视野范围自适应） ================= */
  const mapLocEl = $('#mapLoc');
  let lastMapLoc = '';
  const MUNICIPAL = new Set(['北京', '天津', '上海', '重庆']);
  const PROV_FULL = {
    '北京': '北京市', '天津': '天津市', '上海': '上海市', '重庆': '重庆市',
    '内蒙古': '内蒙古自治区', '广西': '广西壮族自治区', '西藏': '西藏自治区',
    '宁夏': '宁夏回族自治区', '新疆': '新疆维吾尔自治区',
    '香港': '香港特别行政区', '澳门': '澳门特别行政区', '台湾': '台湾省',
    '南海诸岛': '南海诸岛'
  };
  function formatProvName(name) {
    if (!name) return '';
    return PROV_FULL[name] || (name + '省');
  }
  function formatCityName(name) {
    if (!name) return '';
    if (/[省市县区州盟旗]$/.test(name) || /地区$|自治/.test(name)) return name;
    return name + '市';
  }
  // 由美食点汇总市重心，作粗粒度反查
  const cityIndex = [];
  (function buildCityIndex() {
    const map = new Map();
    for (let i = 0; i < PLACES.length; i++) {
      const p = PLACES[i];
      if (!p.prov || !p.city) continue;
      const key = p.prov + '|' + p.city;
      let c = map.get(key);
      if (!c) {
        c = { prov: p.prov, city: p.city, lat: 0, lon: 0, n: 0 };
        map.set(key, c);
      }
      c.lat += p.lat;
      c.lon += p.lon;
      c.n += 1;
    }
    map.forEach(c => {
      c.lat /= c.n;
      c.lon /= c.n;
      cityIndex.push(c);
    });
  })();

  function viewSpanDeg() {
    return Math.min(CW, CH) / Math.max(cam.zoom, 0.01);
  }
  function sampleViewProvs() {
    const counts = new Map();
    let land = 0;
    const n = 5;
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const g = geoAtScreen(CW * (ix + 0.5) / n, CH * (iy + 0.5) / n);
        if (!g) continue;
        const id = provIdAt(g.lat, g.lon);
        if (!id) continue;
        land++;
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
    let bestId = 0, bestN = 0;
    counts.forEach((v, id) => { if (v > bestN) { bestN = v; bestId = id; } });
    return { counts, land, bestId, bestN, nProv: counts.size };
  }
  function pickCityNear(g, span, provName) {
    const halfLon = (CW / cam.zoom) * 0.55;
    const halfLat = (CH / cam.zoom) * 0.55;
    let best = null, bestScore = -1;
    for (let i = 0; i < cityIndex.length; i++) {
      const c = cityIndex[i];
      if (provName && c.prov !== provName) continue;
      const dLon = Math.abs(wrapLon(c.lon - g.lon));
      const dLat = Math.abs(c.lat - g.lat);
      if (dLon > halfLon || dLat > halfLat) continue;
      const dist = Math.hypot(dLat, dLon * Math.cos(rad((c.lat + g.lat) * 0.5)));
      if (dist > Math.max(span * 0.65, 0.35)) continue;
      const score = c.n / (1 + dist * 10);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }
  function resolveMapLoc() {
    if (!CW || CW < 2) return '中国';
    const span = viewSpanDeg();
    const g = geoAtScreen(CW / 2, CH / 2) || { lon: cam.lon, lat: cam.lat };
    const inChinaBox = g.lon > 70 && g.lon < 140 && g.lat > 15 && g.lat < 55;

    // 地球仪远景
    if (!isFlat() && cam.zoom < globeMaxZ() * 0.92) {
      if (span > 45 || cam.zoom < worldZ() * 1.35) return '地球';
    }
    if (span > 42) return inChinaBox ? '中国' : '地球';

    const samp = sampleViewProvs();
    if (samp.land < 2) return inChinaBox ? '中国' : '地球';
    if (span > 26 || samp.nProv >= 7) return '中国';

    const provName = samp.bestId ? PROV_ORDER[samp.bestId - 1] : null;
    if (!provName) return inChinaBox ? '中国' : '地球';
    const provText = formatProvName(provName);

    // 省域：跨度仍大或单省占比不够时只显示省
    if (span > 7.5 || (samp.bestN / Math.max(1, samp.land) < 0.45 && span > 4)) {
      return provText;
    }

    const city = pickCityNear(g, span, provName);
    if (!city) return provText;

    // 直辖市：不再叠市名
    if (MUNICIPAL.has(provName) || city.city === provName) {
      if (span > 2.2) return provText;
      // 直辖市近景：若有更细地名（city 与省同名则仍省）
      return provText;
    }

    const cityText = formatCityName(city.city);
    if (span > 2.0) return provText + ' · ' + cityText;

    // 更近：仍无区县边界，保持省市（避免用菜名冒充区县）
    return provText + ' · ' + cityText;
  }
  function updateMapLoc() {
    if (!mapLocEl) return;
    const t = resolveMapLoc();
    if (t === lastMapLoc) return;
    lastMapLoc = t;
    mapLocEl.textContent = t;
  }

  function landGapPx(globe) {
    return computeLandGap(globe, densityZoom());
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
  // 分批绘制陆地点（统一圆形）
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
          ctx.moveTo(x + rr, y);
          ctx.arc(x, y, rr, 0, TAU);
        }
        ctx.fill();
      }
    }
  }

  // 九段线点阵：中线采样点，半径略小，读起来像虚线而不是省面
  function pushDashDots(buckets, gap, projector) {
    if (!DASH_ID) return;
    const rDot = landDotR(gap) * 0.85;
    for (let k = 0; k < dashDots.length; k += 2) {
      const p = projector(dashDots[k], dashDots[k + 1]);
      if (!p) continue;
      buckets[DASH_ID].push(p[0], p[1], rDot);
    }
  }

  // 陆地点阵：按屏幕目标间距换算成经纬度步进（可小于 CELL，高倍时一格内多点）
  // 步进锚定全球网格，拖动不闪烁；手势中用冻结 densStep
  function landStepDeg(gapPx, zoomLike) {
    return Math.max(0.08, gapPx / Math.max(zoomLike, 0.01));
  }
  // 缩出视野变大时只允许 densStep 变粗（不加密），避免每帧换网格闪烁
  function landStepForView(gap, zoom) {
    let step = densStep != null ? densStep : landStepDeg(gap, densityZoom());
    if (densStep == null) return step;
    const spanLon = (CW + gap * 4) / Math.max(zoom, 0.01);
    const spanLat = (CH + gap * 4) / Math.max(zoom, 0.01);
    const cells = (spanLon / step) * (spanLat / step);
    if (cells > 14000) {
      densStep = Math.ceil((step * Math.sqrt(cells / 14000)) / 0.05) * 0.05;
      step = densStep;
    }
    return step;
  }

  // 平面：按陆地格点步进，高低纬密度一致
  // opts: { gap, step, clear=true, labels } —— 交叉淡入时旧层 clear、新层不清屏叠画
  function paintFlat(a, opts) {
    if (a <= 0.01) return;
    opts = opts || {};
    const zoom = cam.zoom;
    const gap = opts.gap != null ? opts.gap : (densGap != null ? densGap : landGapPx(false));
    const rr = landDotR(gap);
    const stepDeg = opts.step != null ? opts.step : landStepForView(gap, zoom);
    const buckets = Array.from({ length: PROV_ORDER.length + 1 }, () => []);
    const doClear = opts.clear !== false;
    const doLabels = opts.labels != null ? opts.labels : (densZoom == null && !densXfade);
    ctx.globalAlpha = doClear ? 1 : a;
    if (doClear) {
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, CW, CH);
    }
    ctx.globalAlpha = a;

    const pad = gap * 2;
    const lonL = cam.lon - (CW / 2 + pad) / zoom;
    const lonR = cam.lon + (CW / 2 + pad) / zoom;
    const latT = cam.lat + (CH / 2 + pad) / zoom;
    const latB = cam.lat - (CH / 2 + pad) / zoom;
    const i0 = Math.floor((90 - latT) / stepDeg);
    const i1 = Math.ceil((90 - latB) / stepDeg);
    const j0 = Math.floor((lonL + 180) / stepDeg);
    const j1 = Math.ceil((lonR + 180) / stepDeg);

    for (let i = i0; i <= i1; i++) {
      const lat = 90 - (i + 0.5) * stepDeg;
      if (lat > 89.9 || lat < -89.9) continue;
      for (let j = j0; j <= j1; j++) {
        const lon = wrapLon(-180 + (j + 0.5) * stepDeg);
        // 陆地的判定取「底图 ∪ 省级栅格」的并集：DataV 岸线比 110m 底图细，
        // 且含底图完全没有的小岛（西沙/东沙/舟山…）。两者都在同一套采样网格上，
        // 所以岸线与岛屿不会比内陆更密，也不会错位成另一套点阵。
        const pid = provIdAt(lat, lon);
        if (!pid && !landAtLatLon(lat, lon)) continue;
        const x = (wrapLon(lon - cam.lon)) * zoom + CW / 2;
        const y = (cam.lat - lat) * zoom + CH / 2;
        if (x < -gap || x > CW + gap || y < -gap || y > CH + gap) continue;
        buckets[pid].push(x, y, rr);
      }
    }
    // 九段线：中线采样点
    pushDashDots(buckets, gap, (lat, lon) => {
      const x = wrapLon(lon - cam.lon) * zoom + CW / 2;
      const y = (cam.lat - lat) * zoom + CH / 2;
      if (x < -gap || x > CW + gap || y < -gap || y > CH + gap) return null;
      return [x, y, rr];
    });
    fillProvBuckets(buckets);
    if (doLabels) paintProvLabels(false);
    ctx.globalAlpha = 1;
  }

  // 球面：同样按目标间距的地理网格采样再投影
  // opts: { gap, step, clear=true, chrome=true, labels } —— 交叉淡入时旧层铺底、新层叠点
  function paintGlobe(a, opts) {
    if (a <= 0.01) return;
    opts = opts || {};
    const zoom = cam.zoom, R = zoom * K;
    const cx = CW / 2, cy = CH / 2;
    if (R < 2) return;
    const doClear = opts.clear !== false;
    const doChrome = opts.chrome !== false;
    const doLabels = opts.labels != null ? opts.labels : (densZoom == null && !densXfade);
    const gap = opts.gap != null ? opts.gap : (densGap != null ? densGap : landGapPx(true));
    const rDot = landDotR(gap);
    const stepDeg = opts.step != null ? opts.step : landStepForView(gap, zoom);

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();

    if (doClear) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
      const hi = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.5, R * 0.1, cx, cy, R);
      hi.addColorStop(0, 'rgba(255,200,140,.18)');
      hi.addColorStop(0.45, 'rgba(40,40,48,.10)');
      hi.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hi;
      ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    }

    ctx.globalAlpha = a;
    const buckets = Array.from({ length: PROV_ORDER.length + 1 }, () => []);
    const s0 = Math.sin(rad(cam.lat)), c0 = Math.cos(rad(cam.lat));
    const iMax = Math.ceil(180 / stepDeg);
    const jMax = Math.ceil(360 / stepDeg);

    for (let i = 0; i < iMax; i++) {
      const lat = 90 - (i + 0.5) * stepDeg;
      if (lat > 89.9 || lat < -89.9) continue;
      const sLat = Math.sin(rad(lat)), cLat = Math.cos(rad(lat));
      for (let j = 0; j < jMax; j++) {
        const lon = -180 + (j + 0.5) * stepDeg;
        const pid = provIdAt(lat, lon);
        if (!pid && !landAtLatLon(lat, lon)) continue;
        const dl = rad(wrapLon(lon - cam.lon));
        const zz = s0 * sLat + c0 * cLat * Math.cos(dl);
        if (zz < 0.03) continue;
        const x = cx + cLat * Math.sin(dl) * R;
        const y = cy - (c0 * sLat - s0 * cLat * Math.cos(dl)) * R;
        if (x < cx - R - gap || x > cx + R + gap || y < cy - R - gap || y > cy + R + gap) continue;
        const t = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / R;
        buckets[pid].push(x, y, rDot * (1 - t * 0.18));
      }
    }
    // 九段线：中线采样点
    pushDashDots(buckets, gap, (lat, lon) => {
      const sLat = Math.sin(rad(lat)), cLat = Math.cos(rad(lat));
      const dl = rad(wrapLon(lon - cam.lon));
      const zz = s0 * sLat + c0 * cLat * Math.cos(dl);
      if (zz < 0.03) return null;
      const x = cx + cLat * Math.sin(dl) * R;
      const y = cy - (c0 * sLat - s0 * cLat * Math.cos(dl)) * R;
      if (x < cx - R - gap || x > cx + R + gap || y < cy - R - gap || y > cy + R + gap) return null;
      const t = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / R;
      return [x, y, rDot * (1 - t * 0.18)];
    });
    fillProvBuckets(buckets);

    if (doChrome) {
      ctx.globalAlpha = 1;
      const sh = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.1, cx, cy, R);
      sh.addColorStop(0, 'rgba(0,0,0,0)');
      sh.addColorStop(0.8, 'rgba(0,0,0,.18)');
      sh.addColorStop(0.95, 'rgba(0,0,0,.30)');
      sh.addColorStop(1, 'rgba(0,0,0,.50)');
      ctx.fillStyle = sh;
      ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    }
    if (doLabels) paintProvLabels(true);
    ctx.restore();

    if (doChrome) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,.10)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintProvLabels(globe) {
    // 全球视野字太挤；放大到能辨省时再标
    if (cam.zoom < (globe ? globeMaxZ() * 0.85 : 8)) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let id = 1; id < provLabel.length; id++) {
      const p = provLabel[id];
      if (!p) continue;
      const g = screenPos(p.lat, p.lon);
      if (!g) continue;
      if (g.x < 8 || g.x > CW - 8 || g.y < 8 || g.y > CH - 8) continue;
      // 省面在屏幕上的大致半径：√格数 × 省格宽 × zoom
      const rPx = Math.sqrt(p.n) * PCELL * cam.zoom * 0.45;
      if (rPx < 11) continue;
      const useAbbr = rPx < 26 || (p.name.length >= 3 && rPx < 34);
      const text = useAbbr ? p.abbr : p.name;
      const fs = Math.round(clamp(useAbbr ? rPx * 0.42 : rPx * 0.28, 9, 15));
      ctx.font = `650 ${fs}px "PingFang SC",-apple-system,sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillText(text, g.x + 0.6, g.y + 0.8);
      ctx.fillStyle = 'rgba(255,255,255,.88)';
      ctx.fillText(text, g.x, g.y);
    }
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

  // 聚合格网：仅随缩放档位变化；拖动/旋转不重算
  let aggDegHeld = 8;
  function foodMinSepPx() {
    return 58;
  }
  function foodAggDeg() {
    const minSepPx = foodMinSepPx();
    const z = clusterDensityZoom();
    const raw = minSepPx / Math.max(z, 0.01);
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

  // 地理距离二次合并（与相机平移无关，缩放不变时结果稳定）
  function mergeByGeo(items, minDeg) {
    if (items.length < 2) return items;
    const used = new Uint8Array(items.length);
    const out = [];
    const dist = (a, b) => {
      const dLat = a.lat - b.lat;
      let dLon = wrapLon(a.lon - b.lon);
      const cos = Math.cos(rad((a.lat + b.lat) * 0.5));
      return Math.hypot(dLat, dLon * cos);
    };
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      let cur = {
        n: items[i].n,
        lat: items[i].lat,
        lon: items[i].lon,
        i: items[i].i,
        ids: items[i].ids.slice(),
        key: items[i].key
      };
      used[i] = 1;
      let grew = true;
      while (grew) {
        grew = false;
        for (let j = 0; j < items.length; j++) {
          if (used[j]) continue;
          if (dist(cur, items[j]) > minDeg) continue;
          const tn = cur.n + items[j].n;
          cur.lat = (cur.lat * cur.n + items[j].lat * items[j].n) / tn;
          cur.lon = wrapLon((cur.lon * cur.n + items[j].lon * items[j].n) / tn);
          // 经度平均在日界线附近可能不准，改用向量和
          cur.n = tn;
          cur.ids.push(...items[j].ids);
          used[j] = 1;
          grew = true;
        }
      }
      out.push(cur);
    }
    return out;
  }

  let foodClusterCache = { key: '', items: [] };
  function foodClusterKey() {
    const agg = foodAggDeg();
    const fk = filterSig();
    if (densZoom != null) return 'hold:' + agg + '|' + fk;
    return agg + '@' + Math.round(cam.zoom * 40) + '|' + fk;
  }
  function ensureFoodClusters() {
    const key = foodClusterKey();
    if (foodClusterCache.key === key) return foodClusterCache.items;
    const agg = foodAggDeg();
    const buckets = new Map();
    for (let i = 0; i < PLACES.length; i++) {
      const p = PLACES[i];
      // 同时应用属性筛选和搜索关键字筛选
      if (!passAttrFilter(p)) continue;
      if (!passSearchFilter(p)) continue;
      const gi = Math.floor((p.lat + 90) / agg);
      const gj = Math.floor((p.lon + 180) / agg);
      const k = gi + ':' + gj;
      let b = buckets.get(k);
      if (!b) {
        b = { n: 0, lat: 0, lon: 0, i: i, ids: [], key: k };
        buckets.set(k, b);
      }
      b.n += 1;
      b.lat += p.lat;
      b.lon += p.lon;
      b.ids.push(i);
      if (b.n === 1) b.i = i;
    }
    const items = [];
    for (const b of buckets.values()) {
      items.push({
        n: b.n,
        lat: b.lat / b.n,
        lon: b.lon / b.n,
        i: b.i,
        ids: b.ids,
        key: b.key
      });
    }
    const minDeg = foodMinSepPx() / Math.max(clusterDensityZoom(), 0.01);
    foodClusterCache = { key, items: mergeByGeo(items, minDeg) };
    return foodClusterCache.items;
  }

  function foodDotRadius(count) {
    const zoom = cam.zoom, flat = viewIsFlat(), gz = globeMaxZ();
    const cluster = count > 1;
    if (!flat) {
      const t = clamp((zoom - minZoom) / Math.max(0.01, gz - minZoom), 0, 1);
      return cluster ? (12 + t * 2) : (5.5 + t * 3.5);
    }
    const t = clamp((zoom - gz) / Math.max(8, gz * 3), 0, 1);
    return cluster ? (14 + t * 2) : (9.5 + t * 5);
  }

  function screenPos(lat, lon) {
    if (viewIsFlat()) {
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
    ctx.strokeStyle = highlighted ? '#e8c86a' : 'rgba(255,240,220,.85)';
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
    const flat = viewIsFlat();
    const agg = foodAggDeg();
    const m = 36;
    const clusters = ensureFoodClusters();
    hitList = [];
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = prevA * (0.35 + 0.65 * foodFade);

    let selDrawn = false;

    function drawOne(lat, lon, count, ids, key, useI, highlighted) {
      const g = screenPos(lat, lon);
      if (!g) return null;
      if (g.x < -m || g.x > CW + m || g.y < -m || g.y > CH + m) return null;
      const baseR = foodDotRadius(count) * (flat ? 1 : (0.72 + 0.28 * (g.z || 1)));
      const fill = count > 1 ? '#ff7a1a' : '#ff9d4d';
      const label = count > 1
        ? Math.min(99, count)
        : (PLACES[useI].n || '?').charAt(0);
      const rr = drawFoodMarker(g.x, g.y, baseR, fill, label, highlighted);
      hitList.push({
        kind: count > 1 ? 'cluster' : 'place',
        i: useI,
        ids: ids.slice(),
        key,
        n: count,
        x: g.x, y: g.y,
        r: rr + (flat ? 14 : 10),
        lon, lat
      });
      return { g, rr };
    }

    for (const b of clusters) {
      const count = b.n;
      const hasSel = sel >= 0 && b.ids.indexOf(sel) >= 0;

      // 选中点若在聚合内：拆出单独高亮，其余仍聚合
      if (hasSel && count > 1) {
        const others = b.ids.filter(id => id !== sel);
        if (others.length === 1) {
          const oi = others[0];
          const op = PLACES[oi];
          drawOne(op.lat, op.lon, 1, [oi], b.key + ':o', oi, false);
        } else if (others.length > 1) {
          let lat = 0, lon = 0;
          others.forEach(id => { lat += PLACES[id].lat; lon += PLACES[id].lon; });
          lat /= others.length; lon /= others.length;
          drawOne(lat, lon, others.length, others, b.key + ':r', others[0], false);
        }
        const sp = PLACES[sel];
        const drawn = drawOne(sp.lat, sp.lon, 1, [sel], b.key + ':s', sel, true);
        if (drawn) {
          selDrawn = true;
          selDot.hidden = false;
          selDot.style.opacity = String(0.35 + 0.65 * foodFade);
          selDot.style.setProperty('--x', (Math.round(drawn.g.x * 10) / 10) + 'px');
          selDot.style.setProperty('--y', (Math.round((drawn.g.y - drawn.rr - 10) * 10) / 10) + 'px');
          selDot.style.setProperty('--sc', '1');
          selLab.textContent = PLACES[sel].n;
        }
        continue;
      }

      let useLat = b.lat, useLon = b.lon, useI = b.i;
      if (hasSel && count === 1) {
        useLat = PLACES[sel].lat;
        useLon = PLACES[sel].lon;
        useI = sel;
      }

      let hi = hasSel && count === 1;
      if (selClusterKey) {
        hi = hi || b.key === selClusterKey || b.ids.some(id => {
          const p = PLACES[id];
          const gi = Math.floor((p.lat + 90) / agg);
          const gj = Math.floor((p.lon + 180) / agg);
          return (gi + ':' + gj) === selClusterKey;
        });
      }

      const drawn = drawOne(useLat, useLon, count, b.ids, b.key, useI, hi);
      if (drawn && hi && count === 1) {
        selDrawn = true;
        selDot.hidden = false;
        selDot.style.opacity = String(0.35 + 0.65 * foodFade);
        selDot.style.setProperty('--x', (Math.round(drawn.g.x * 10) / 10) + 'px');
        selDot.style.setProperty('--y', (Math.round((drawn.g.y - drawn.rr - 10) * 10) / 10) + 'px');
        selDot.style.setProperty('--sc', '1');
        selLab.textContent = PLACES[sel].n;
      }
    }

    ctx.globalAlpha = prevA;
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
  function isUiTarget(t) {
    return !!(t && t.closest && t.closest('#clusterDlg, .zoomctl, #sheet, #filterDlg, #clusterMask, #sheetMask'));
  }

  wrap.addEventListener('pointerdown', e => {
    if (isUiTarget(e.target)) return;
    try { (e.target || canvas).setPointerCapture(e.pointerId); } catch (err) {}
    ptrs.set(e.pointerId, local(e));
    pinchD = 0; moved = false; movedPx = 0;
    dragging = true;
    cancelAnim();
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinchD = Math.hypot(a[0] - b[0], a[1] - b[1]);
      pinchZ = cam.zoom;
      beginZoomGesture();
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
        beginZoomGesture();
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
      endZoomGesture();
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
      beginZoomGesture();
      if (!wheelRaf) wheelRaf = requestAnimationFrame(flushWheelZoom);
      clearTimeout(wheelIdleTimer);
      wheelIdleTimer = setTimeout(() => {
        if (!ptrs.size) { dragging = false; endZoomGesture(); scheduleDraw(); }
      }, 140);
    } else {
      cam.lon = wrapLon(cam.lon + dx / cam.zoom);
      cam.lat -= dy / cam.zoom;
      clampCam();
      scheduleDraw();
    }
  }, { passive: false });
  wrap.addEventListener('wheel', e => {
    if (isUiTarget(e.target)) return;
    e.preventDefault();
  }, { passive: false });

  function pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  // pop 动画结束后移除 class：否则切页时 display:none → flex 会让残留动画重播（按钮莫名缩放）
  document.querySelector('.zoomctl').addEventListener('animationend', e => {
    if (e.animationName === 'btnpop') e.target.classList.remove('pop');
  });
  function chinaZ() {
    // 平面国视：中国大致入画，明显大于地球仪层级
    const byW = CW / 58;
    const byH = CH / 42;
    return clampZoom(Math.max(globeMaxZ() * 1.2, Math.min(byW, byH), 12));
  }
  $('#zin').addEventListener('click', () => { pop($('#zin')); animZoomBy(1.75); });
  $('#zout').addEventListener('click', () => { pop($('#zout')); animZoomBy(1 / 1.75); });
  $('#zreset').addEventListener('click', () => {
    pop($('#zreset'));
    flyTo(105, 35, chinaZ(), false, 560);
  });

  // 缩放按钮带动画的平滑缩放
  function animZoomBy(f) {
    const g = geoAtScreen(CW / 2, CH / 2) || { lon: cam.lon, lat: cam.lat };
    flyTo(g.lon, g.lat, clampZoom(cam.zoom * f), false, 380);
  }

  // 平滑飞行（缓动 + 就近绕转）；缩放变化时冻结点阵/聚合，结束再刷新
  function flyTo(lon, lat, zoom, instant, dur) {
    zoom = clampZoom(zoom);
    lon = cam.lon + wrapLon(lon - cam.lon);
    const s0 = { lon: cam.lon, lat: cam.lat, zoom: cam.zoom };
    const zoomChanging = Math.abs(zoom - s0.zoom) > 1e-4;
    const t0 = performance.now();
    const total = instant ? 1 : (dur || 700);
    cancelAnim();
    if (zoomChanging) {
      densZoom = null;
      densGap = null;
      densStep = null;
      densFlat = null;
      // 冻结在起点密度：放大时稀疏→加密淡入，缩小时密→疏淡出
      beginZoomGesture(s0.zoom);
    }
    (function step(t) {
      const k = Math.min(1, (t - t0) / total);
      const e = 1 - Math.pow(1 - k, 3);
      cam.lon = s0.lon + (lon - s0.lon) * e;
      cam.lat = s0.lat + (lat - s0.lat) * e;
      cam.zoom = s0.zoom + (zoom - s0.zoom) * e;
      clampCam();
      scheduleDraw();
      if (k < 1) animId = requestAnimationFrame(step);
      else if (zoomChanging) endZoomGesture();
    })(performance.now());
  }
  function setSel(i, keepClusterKey) {
    sel = i;
    if (i >= 0 && !keepClusterKey) selClusterKey = null;
    scheduleDraw();
  }

  /* ================= 单点详情 ================= */
  const sName = $('#sName'), sSub = $('#sSub'), placeDesc = $('#placeDesc'), sHeart = $('#sHeart');
  const sMeta = $('#sMeta'), sTags = $('#sTags'), sIng = $('#sIng'), sCook = $('#sCook');
  const sTagsBlock = $('#sTagsBlock'), sIngBlock = $('#sIngBlock'), sCookBlock = $('#sCookBlock');
  let openIdx = -1;

  function foodOf(p) { return foodOfPlace(p); }
  function fillChips(el, list) {
    el.innerHTML = '';
    (list || []).forEach((t) => {
      const span = document.createElement('span');
      span.className = 'chip';
      span.textContent = t;
      el.appendChild(span);
    });
  }
  function fillMeta(f) {
    sMeta.innerHTML = '';
    const items = [];
    if (f.cat) items.push(['cat', f.cat]);
    if (f.taste) items.push(['taste', f.taste]);
    if (f.cui) items.push(['cui', f.cui]);
    items.forEach(([cls, text]) => {
      const span = document.createElement('span');
      span.className = 'meta-pill ' + cls;
      span.textContent = text;
      sMeta.appendChild(span);
    });
  }
  function specialtyTags(f) {
    const skip = new Set([f.cat, f.taste, f.cui].filter(Boolean));
    return (f.tags || []).filter((t) => !skip.has(t));
  }

  function openPlace(i, opts = {}) {
    if (!opts.keepCluster) hideCluster();
    const p = PLACES[i];
    openIdx = i;
    sName.textContent = p.n;
    const where = [p.prov, p.city].filter(Boolean).filter((v, idx, a) => a.indexOf(v) === idx).join(' · ');
    sSub.textContent = where || p.sec || '';
    const f = foodOf(p);
    placeDesc.textContent = f.d || '暂无简介';
    fillMeta(f);
    const tags = specialtyTags(f);
    fillChips(sTags, tags);
    sTagsBlock.hidden = !tags.length;
    fillChips(sIng, f.ing);
    sIngBlock.hidden = !(f.ing && f.ing.length);
    fillChips(sCook, f.cook);
    sCookBlock.hidden = !(f.cook && f.cook.length);
    sHeart.classList.toggle('on', isFav(i));
    if (opts.fly) {
      switchTab('map', { keepPlace: true });
      openSheet();
      setSel(i, opts.keepCluster);
      flyTo(p.lon, p.lat, cam.zoom, false, 520);
    } else {
      openSheet();
      setSel(i, opts.keepCluster);
    }
  }
  function openSheet() {
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    sheetMask.classList.add('open');
  }
  function hideSheet() {
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    sheetMask.classList.remove('open');
    openIdx = -1;
  }
  const sheetMask = $('#sheetMask');
  function closeSheet() {
    hideSheet();
    setSel(-1);
    clusterList.querySelectorAll('.cluster-item.on').forEach((el) => el.classList.remove('on'));
  }
  $('#sheetClose').addEventListener('click', closeSheet);
  sheetMask.addEventListener('click', closeSheet);

  /* ================= 聚合 dialog ================= */
  const clusterDlg = $('#clusterDlg');
  const clusterList = $('#clusterList');
  const clusterMask = $('#clusterMask');
  const cTitle = $('#cTitle');
  const cSub = $('#cSub');

  function openCluster(ids, lon, lat, key) {
    hideSheet();
    sel = -1;
    selClusterKey = key || null;
    scheduleDraw();
    const list = (ids || []).slice();
    cTitle.textContent = '附近美食';
    cSub.textContent = `共 ${list.length} 道 · 点击查看详情`;
    clusterList.innerHTML = '';
    // 用 DocumentFragment 批量构建，避免逐个 appendChild 触发多次重排
    const frag = document.createDocumentFragment();
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
      btn.dataset.idx = String(idx);
      btn.addEventListener('click', () => {
        clusterList.querySelectorAll('.cluster-item.on').forEach((el) => el.classList.remove('on'));
        btn.classList.add('on');
        // 保留附近美食 dialog，详情叠在其上，关闭详情后回到列表
        openPlace(idx, { keepCluster: true });
      });
      frag.appendChild(btn);
    });
    clusterList.appendChild(frag);
    clusterMask.classList.add('open');
    clusterDlg.setAttribute('aria-hidden', 'false');
    // 双 rAF：先让浏览器渲染 dialog 的初始隐藏态（translateY 100%），
    // 下一帧再加 .open 触发过渡，避免 DOM 构建阻塞导致跳过过渡起始帧
    requestAnimationFrame(() => requestAnimationFrame(() => clusterDlg.classList.add('open')));
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      flyTo(lon, lat, cam.zoom, false, 320);
    }
  }
  function hideCluster() {
    clusterDlg.classList.remove('open');
    clusterMask.classList.remove('open');
    clusterDlg.setAttribute('aria-hidden', 'true');
    if (selClusterKey) {
      selClusterKey = null;
      scheduleDraw();
    }
    // 关附近美食时同步关掉详情
    if (sheet.classList.contains('open')) {
      hideSheet();
      setSel(-1);
    }
  }
  $('#clusterClose').addEventListener('click', hideCluster);
  clusterMask.addEventListener('click', hideCluster);
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

  function switchTab(t, opts = {}) {
    state.tab = t;
    hideFilter(); // 切页时关闭筛选面板，避免从名录「在地图查看」后面板仍悬在地图后
    if (!opts.keepPlace) {
      hideSheet();
      hideCluster();
      setSel(-1);
    }
    $('#mapScreen').classList.toggle('active', t === 'map');
    $('#listScreen').classList.toggle('active', t === 'list');
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    if (t === 'list') renderList();
    else {
      // 切回地图页时，屏幕刚从 display:none 变为 flex，需要等布局稳定后再取尺寸重绘
      requestAnimationFrame(() => {
        resize();
        requestAnimationFrame(() => {
          resize();
          scheduleDraw();
        });
      });
    }
  }
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  
  // 搜索功能
  const searchInput = $('#searchInput');
  const mapSearchBtn = $('#mapSearch');
  
  function updateSearchUI() {
    const hasQuery = q.length > 0;
    // 高亮地图搜索按钮
    mapSearchBtn.classList.toggle('on', hasQuery);
    // 地图页也需要重绘以显示搜索结果
    if (state.tab === 'map') {
      scheduleDraw();
    }
  }
  
  searchInput.addEventListener('input', e => { 
    q = e.target.value.trim().toLowerCase(); 
    updateSearchUI();
    renderList(); 
  });
  
  // 监听原生搜索清除按钮（点击 X 或按 ESC）
  searchInput.addEventListener('search', e => {
    if (e.target.value === '') {
      q = '';
      updateSearchUI();
      renderList();
    }
  });
  
  $('#favFilter').addEventListener('click', () => { onlyFav = !onlyFav; $('#favFilter').classList.toggle('on', onlyFav); renderList(); });

  /* ---- 筛选面板 ---- */
  const filterDlg = $('#filterDlg');
  const filterBody = $('#filterBody');
  const filterActive = $('#filterActive');
  const filterBtn = $('#filterBtn');
  const mapFilterBtn = $('#mapFilter');
  let ingQuery = '';

  function toggleSet(set, val) {
    if (set.has(val)) set.delete(val);
    else set.add(val);
  }
  function renderFilterBody() {
    const sections = [
      { key: 'cats', title: '分类', list: FILTER_OPTS.cats, set: filters.cats },
      { key: 'tastes', title: '口味', list: FILTER_OPTS.tastes, set: filters.tastes },
      { key: 'cooks', title: '做法', list: FILTER_OPTS.cooks, set: filters.cooks },
      { key: 'ings', title: '食材', list: FILTER_OPTS.ings, set: filters.ings, search: true }
    ];
    filterBody.innerHTML = '';
    sections.forEach((sec) => {
      const wrap = document.createElement('div');
      wrap.className = 'filter-sec';
      wrap.innerHTML = `<h3>${sec.title}</h3>`;
      if (sec.search) {
        const searchWrap = document.createElement('div');
        searchWrap.className = 'filter-search-wrap';
        
        const input = document.createElement('input');
        input.className = 'filter-search';
        input.type = 'search';
        input.placeholder = '搜索食材…';
        input.value = ingQuery;
        input.addEventListener('input', (e) => {
          ingQuery = e.target.value.trim();
          renderFilterBody();
          const el = filterBody.querySelector('.filter-search');
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        });
        
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'filter-search-clear';
        clearBtn.innerHTML = '×';
        clearBtn.setAttribute('aria-label', '清除');
        clearBtn.style.display = ingQuery ? 'block' : 'none';
        clearBtn.addEventListener('click', () => {
          ingQuery = '';
          renderFilterBody();
          const el = filterBody.querySelector('.filter-search');
          if (el) el.focus();
        });
        
        searchWrap.appendChild(input);
        searchWrap.appendChild(clearBtn);
        wrap.appendChild(searchWrap);
      }
      const row = document.createElement('div');
      row.className = 'chip-row';
      let list = sec.list;
      if (sec.search && ingQuery) {
        const k = ingQuery.toLowerCase();
        list = list.filter((x) => x.toLowerCase().includes(k));
      } else if (sec.search) {
        list = list.slice(0, 48);
      }
      list.forEach((val) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip' + (sec.set.has(val) ? ' on' : '');
        btn.textContent = val;
        btn.addEventListener('click', () => {
          toggleSet(sec.set, val);
          btn.classList.toggle('on', sec.set.has(val));
          syncFilterChrome();
        });
        row.appendChild(btn);
      });
      wrap.appendChild(row);
      filterBody.appendChild(wrap);
    });
  }
  function syncFilterChrome() {
    const on = hasAttrFilter();
    filterBtn.classList.toggle('on', on);
    mapFilterBtn.classList.toggle('on', on);
    filterActive.innerHTML = '';
    if (!on) {
      filterActive.hidden = true;
      return;
    }
    filterActive.hidden = false;
    const add = (label, set) => {
      [...set].forEach((v) => {
        const span = document.createElement('span');
        span.className = 'fchip';
        span.textContent = label + v;
        filterActive.appendChild(span);
      });
    };
    add('', filters.cats);
    add('', filters.tastes);
    add('', filters.cooks);
    add('', filters.ings);
  }
  function applyFilters() {
    foodClusterCache.key = '';
    syncFilterChrome();
    if (state.tab === 'list') {
      renderList();
    } else {
      // 地图页筛选：给出生效反馈（名录页切回时会重新渲染）
      const n = PLACES.filter((p, i) => passFilter(p, i)).length;
      const hasFilter = hasAttrFilter() || q;
      toast(hasFilter ? `已筛选 ${n} 道美食` : '已展示全部美食');
    }
    scheduleDraw();
    hideFilter();
  }
  function openFilter() {
    renderFilterBody();
    filterDlg.classList.add('open');
    filterDlg.setAttribute('aria-hidden', 'false');
  }
  function hideFilter() {
    filterDlg.classList.remove('open');
    filterDlg.setAttribute('aria-hidden', 'true');
  }
  filterBtn.addEventListener('click', openFilter);
  mapFilterBtn.addEventListener('click', openFilter);
  
  // 地图搜索按钮：切换到名录页并聚焦搜索框
  $('#mapSearch').addEventListener('click', () => {
    switchTab('list');
    setTimeout(() => {
      const input = $('#searchInput');
      if (input) input.focus();
    }, 300);
  });
  
  $('#filterClose').addEventListener('click', hideFilter);
  $('#filterMask').addEventListener('click', hideFilter);
  $('#filterApply').addEventListener('click', applyFilters);
  $('#filterReset').addEventListener('click', () => {
    filters.cats.clear();
    filters.tastes.clear();
    filters.ings.clear();
    filters.cooks.clear();
    ingQuery = '';
    renderFilterBody();
    applyFilters();
  });

  function passFilter(p, i) {
    if (onlyFav && !isFav(i)) return false;
    if (!passAttrFilter(p)) return false;
    if (!passSearchFilter(p)) return false;
    return true;
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
      tip.textContent = onlyFav ? '还没有收藏，点卡片 ♡ 收藏' : (hasAttrFilter() ? '没有符合筛选的结果' : '没有匹配的结果');
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
        `<svg class="prov-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>`;
      // 单条也保留展开/折叠箭头，默认折叠
      head.addEventListener('click', () => {
          const wasOpen = expandedProv.has(prov);
          if (wasOpen) {
            expandedProv.delete(prov);
            block.classList.remove('open');
            const wrap = block.querySelector('.card-wrap');
            if (wrap) {
              wrap.classList.remove('open');
              const done = () => { if (wrap.parentNode) wrap.remove(); };
              wrap.addEventListener('transitionend', done, { once: true });
              setTimeout(done, 360);
            }
          } else {
            expandedProv.add(prov);
            block.classList.add('open');
            const wrap = document.createElement('div');
            wrap.className = 'card-wrap';
            const card = document.createElement('div');
            card.className = 'card';
            list.forEach(idx => appendPlaceRow(card, idx));
            wrap.appendChild(card);
            block.appendChild(wrap);
            requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
          }
        });
      block.appendChild(head);

      if (open) {
        const wrap = document.createElement('div');
        wrap.className = 'card-wrap open';
        const card = document.createElement('div');
        card.className = 'card';
        list.forEach(idx => appendPlaceRow(card, idx));
        wrap.appendChild(card);
        block.appendChild(wrap);
      }
      listEl.appendChild(block);
    });
  }

  /* ================= 启动 ================= */
  function bootResize() {
    resize();
    if (!CW) return false;
    cam.lon = 105; cam.lat = 35; // 开局对准中国
    cam.zoom = chinaZ();
    scheduleDraw();
    return true;
  }
  // 首次立即尝试；若布局尚未完成则轮询到拿到尺寸为止
  if (!bootResize()) {
    const t = setInterval(() => { if (bootResize()) clearInterval(t); }, 80);
    // 保险：window load 后再试一次并清理轮询
    window.addEventListener('load', () => { clearInterval(t); bootResize(); }, { once: true });
  }
  // 初始占位缩放，避免 chinaZ 计算前 cam.zoom 为 0
  cam.zoom = clampZoom(Math.max(globeMaxZ() * 1.15, 12));
  setTimeout(() => {
    const h = $('#mapHint');
    h.classList.add('show');
    setTimeout(() => h.classList.remove('show'), 2400);
  }, 500);
})();
