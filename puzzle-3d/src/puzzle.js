/** 真实拼图：正方形主体 + 参考图同款窄颈圆头蘑菇扣 */

const MAX_DIM = 50;
const MAX_TOTAL = 1600;
const SOFT_TOTAL = 400;
const TAB_RATIO = 0.28;

export { MAX_DIM, MAX_TOTAL, SOFT_TOTAL, TAB_RATIO };

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function buildTabMap(cols, rows) {
  const h = [];
  const v = [];
  const rand = seededRand(cols * 997 + rows * 131 + 42);
  for (let r = 0; r < rows; r++) {
    h[r] = [];
    for (let c = 0; c < cols - 1; c++) h[r][c] = rand() > 0.5 ? 1 : -1;
  }
  for (let r = 0; r < rows - 1; r++) {
    v[r] = [];
    for (let c = 0; c < cols; c++) v[r][c] = rand() > 0.5 ? 1 : -1;
  }
  return { h, v };
}

export function tabsFor(r, c, cols, rows, map) {
  return {
    top: r === 0 ? 0 : -map.v[r - 1][c],
    right: c === cols - 1 ? 0 : map.h[r][c],
    bottom: r === rows - 1 ? 0 : map.v[r][c],
    left: c === 0 ? 0 : -map.h[r][c - 1],
  };
}

export function shapeKey(tabs) {
  return `${tabs.top},${tabs.right},${tabs.bottom},${tabs.left}`;
}

/** 按图片比例推荐行列，块尽量接近正方形 */
export function suggestGrid(iw, ih, preferTotal = 24) {
  const a = iw / Math.max(1, ih);
  let best = { cols: a >= 1 ? 6 : 4, rows: a >= 1 ? 4 : 6, score: Infinity };
  for (let rows = 2; rows <= 24; rows++) {
    const cols = Math.max(2, Math.min(MAX_DIM, Math.round(rows * a)));
    const total = cols * rows;
    if (total < 8 || total > Math.min(SOFT_TOTAL, preferTotal * 3)) continue;
    const aspectErr = Math.abs(cols / rows - a);
    const totalErr = Math.abs(total - preferTotal) / preferTotal;
    const score = aspectErr * 3 + totalErr;
    if (score < best.score) best = { cols, rows, score };
  }
  return { cols: best.cols, rows: best.rows };
}

/**
 * 经典拼图扣：窄颈 + 更圆的蘑菇头（贝塞尔近似圆弧）。
 * sign=+1 向外凸，-1 向内凹。
 *
 * 各段端点与原始设计一致；段与段交界处做 C1 修正：
 * 原设计相邻两段的切向相差 12°~16°，放大后颈肩处会出现明显折角，
 * 这里把交界两侧的控制点方向拉成同向（保留各自长度），形状几乎不变但切向连续。
 */
function appendClassicKnob(api, x0, y0, x1, y1, sign) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * sign;
  const ny = ux * sign;

  const P = (u, n) => ({
    x: x0 + ux * len * u + nx * len * n,
    y: y0 + uy * len * u + ny * len * n,
  });

  // 肩更靠外，头更圆鼓
  const a = P(0.355, 0);
  api.lineTo(a.x, a.y);

  const segs = [
    { c1: P(0.375, 0), c2: P(0.395, 0.03), p: P(0.415, 0.055) }, // 入颈（收腰）
    { c1: P(0.43, 0.09), c2: P(0.4, 0.125), p: P(0.385, 0.145) }, // 颈 → 圆头左下
    { c1: P(0.35, 0.175), c2: P(0.4, 0.245), p: P(0.5, 0.245) }, // 左弧 → 顶端
    { c1: P(0.6, 0.245), c2: P(0.65, 0.175), p: P(0.615, 0.145) }, // 顶端 → 右弧
    { c1: P(0.6, 0.125), c2: P(0.57, 0.09), p: P(0.585, 0.055) }, // 右下 → 出颈
    { c1: P(0.605, 0.03), c2: P(0.625, 0), p: P(0.645, 0) }, // 出颈回肩
  ];

  for (let i = 1; i < segs.length; i++) {
    const join = segs[i - 1].p;
    const tp = { x: join.x - segs[i - 1].c2.x, y: join.y - segs[i - 1].c2.y };
    const tn = { x: segs[i].c1.x - join.x, y: segs[i].c1.y - join.y };
    const lp = Math.hypot(tp.x, tp.y) || 1e-9;
    const ln = Math.hypot(tn.x, tn.y) || 1e-9;
    let bx = tp.x / lp + tn.x / ln;
    let by = tp.y / lp + tn.y / ln;
    const bl = Math.hypot(bx, by);
    if (bl < 1e-9) continue;
    bx /= bl;
    by /= bl;
    segs[i - 1].c2 = { x: join.x - bx * lp, y: join.y - by * lp };
    segs[i].c1 = { x: join.x + bx * ln, y: join.y + by * ln };
  }

  for (const s of segs) api.bezierCurveTo(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.p.x, s.p.y);
  api.lineTo(x1, y1);
}

function edgeWithTab(api, x0, y0, x1, y1, dir, first) {
  if (first) api.moveTo(x0, y0);
  if (dir === 0) api.lineTo(x1, y1);
  else appendClassicKnob(api, x0, y0, x1, y1, dir);
}

/** 与 3D 一致：中心原点、y 向上，半边长 hw */
function tracePieceEdges(api, hw, tabs) {
  const { top, right, bottom, left } = tabs;
  edgeWithTab(api, -hw, hw, hw, hw, top, true);
  edgeWithTab(api, hw, hw, hw, -hw, right, false);
  edgeWithTab(api, hw, -hw, -hw, -hw, bottom, false);
  edgeWithTab(api, -hw, -hw, -hw, hw, left, false);
}

/**
 * 把贝塞尔按固定份数离散成折线。
 * 3D 挤出与顶面缝线因此共用完全相同的多边形，缝宽处处一致，
 * 不会出现某段弧上缝线偏到块面上的情况。
 */
function flattenApi(shape, samples) {
  return {
    moveTo: (x, y) => shape.moveTo(x, y),
    lineTo: (x, y) => shape.lineTo(x, y),
    bezierCurveTo: (c1x, c1y, c2x, c2y, x, y) => {
      const p0 = shape.currentPoint;
      const x0 = p0.x;
      const y0 = p0.y;
      for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        const m = 1 - t;
        const a = m * m * m;
        const b = 3 * m * m * t;
        const c = 3 * m * t * t;
        const d = t * t * t;
        shape.lineTo(a * x0 + b * c1x + c * c2x + d * x, a * y0 + b * c1y + c * c2y + d * y);
      }
    },
  };
}

/** canvas 路径：与 3D 同一坐标系（中心原点、y 向上），落在 canvas 上时 y 取反 */
function piecePathCentered(ctx, hw, tabs) {
  const api = {
    moveTo: (x, y) => ctx.moveTo(x, -y),
    lineTo: (x, y) => ctx.lineTo(x, -y),
    bezierCurveTo: (a, b, c, d, e, f) => ctx.bezierCurveTo(a, -b, c, -d, e, -f),
  };
  ctx.beginPath();
  tracePieceEdges(api, hw, tabs);
  ctx.closePath();
}

export function buildJigsawShape(cell, tabs, knobSamples = 10) {
  const hw = cell / 2;
  const s = new window.THREE.Shape();
  tracePieceEdges(flattenApi(s, knobSamples), hw, tabs);
  s.closePath();

  const pad = cell * TAB_RATIO + cell * 0.03;
  return { shape: s, half: hw, pad, texHalf: hw + pad };
}

/**
 * 裁切取景：center 是裁切框中心在原图上的比例坐标（0..1），zoom ≥ 1 是相对"刚好铺满"的放大倍数。
 * 返回原图像素坐标下的裁切矩形，比例恒等于 cols:rows（拼块是正方形）。
 * 用"中心 + 倍数"而不是像素矩形来记，改行列数时取景能自然延续，不会跳。
 */
export function cropRect(iw, ih, cols, rows, view = {}) {
  const a = cols / rows;
  const zoom = Math.max(1, view.zoom || 1);
  let w = iw / ih > a ? ih * a : iw;
  let h = w / a;
  w /= zoom;
  h /= zoom;
  const cx = Math.min(Math.max((view.cx ?? 0.5) * iw, w / 2), iw - w / 2);
  const cy = Math.min(Math.max((view.cy ?? 0.5) * ih, h / 2), ih - h / 2);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export async function cutPuzzle(image, cols, rows, view) {
  const total = cols * rows;
  if (cols < 2 || rows < 2) throw new Error('行列至少为 2');
  if (cols > MAX_DIM || rows > MAX_DIM) throw new Error(`单边不超过 ${MAX_DIM}`);
  if (total > MAX_TOTAL) throw new Error(`总块数不超过 ${MAX_TOTAL}`);

  const map = buildTabMap(cols, rows);
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;

  const imgAspect = iw / ih;
  const maxTex = total > 600 ? 64 : total > 200 ? 96 : total > 80 ? 128 : 180;
  const cellPx = Math.max(24, Math.round(maxTex));
  const src = document.createElement('canvas');
  src.width = cellPx * cols;
  src.height = cellPx * rows;
  const sctx = src.getContext('2d', { alpha: false });
  sctx.fillStyle = '#000000';
  sctx.fillRect(0, 0, src.width, src.height);
  // 按玩家在裁切预览里选定的取景截取（未指定时居中铺满）
  const crop = cropRect(iw, ih, cols, rows, view);
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, src.width, src.height);

  const s = cellPx;
  const tabPx = Math.max(5, Math.round(s * TAB_RATIO));
  const pPad = tabPx + 3;
  const tw = s + pPad * 2;

  const pieces = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tabs = tabsFor(r, c, cols, rows, map);
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = tw;
      const ctx = canvas.getContext('2d', { alpha: false });
      // 主体区域精确对应原图；四周只延展主体边缘，避免凸起取到邻块颜色。
      ctx.drawImage(src, c * s, r * s, s, s, pPad, pPad, s, s);
      ctx.drawImage(src, c * s, r * s, s, 1, pPad, 0, s, pPad);
      ctx.drawImage(src, c * s, r * s + s - 1, s, 1, pPad, pPad + s, s, pPad);
      ctx.drawImage(src, c * s, r * s, 1, s, 0, pPad, pPad, s);
      ctx.drawImage(src, c * s + s - 1, r * s, 1, s, pPad + s, pPad, pPad, s);
      ctx.drawImage(src, c * s, r * s, 1, 1, 0, 0, pPad, pPad);
      ctx.drawImage(src, c * s + s - 1, r * s, 1, 1, pPad + s, 0, pPad, pPad);
      ctx.drawImage(src, c * s, r * s + s - 1, 1, 1, 0, pPad + s, pPad, pPad);
      ctx.drawImage(src, c * s + s - 1, r * s + s - 1, 1, 1, pPad + s, pPad + s, pPad, pPad);

      pieces.push({
        id: r * cols + c,
        r,
        c,
        tabs,
        shapeKey: shapeKey(tabs),
        canvas,
        thumb: null, // 懒生成小缩略图，避免 toDataURL 卡顿
        frame: null, // 懒生成选中边框（与缩略图同尺寸、同取景）
        hitPath: null, // 懒生成命中判定用的轮廓路径
        cellPx: s,
        pPad,
        placed: false,
        slotIndex: -1,
        rot: 0, // 0..3，每次 +90°
      });
    }
  }

  return {
    pieces,
    cols,
    rows,
    aspect: cols / rows,
    imageAspect: imgAspect,
    image,
    sourceCanvas: src,
    tabRatio: TAB_RATIO,
    map,
  };
}

/**
 * 缩略图四周留白（CSS 像素）：这是拼块看起来"稀疏"的主因 —— 托盘里两块之间的
 * 实际空隙 = 2×留白 + 按钮自身的 4px，留白给多了拼块就显得又小又散。
 * 下限由两样东西决定，取大者：
 *   · 选中边框：轮廓外 1px 空隙 + 2px 线宽 = 3px
 *   · 烘焙的柔和阴影：模糊 7px（半径）铺开约 5px，加向下偏移 1.6px ≈ 6px
 * 所以留 7px 刚好够，再多就是白给的空隙。
 */
const THUMB_MARGIN = 7;

/**
 * 按钮外框到内容区的固定开销：左右各 1px 边框 + 各 1px 内边距 = 4px。
 * 内容区边长 = 按钮边长 − 4，所以换算不写死数字，改 style.css 的 --thumb 即可。
 */
const THUMB_CHROME = 4;

/** 读 :root 上的 CSS 变量（px 值），读不到就用兜底值 */
function readCssVar(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 缩略图向按钮外溢出的量（CSS 像素），与 style.css 的 --thumb-bleed 一致。
 * 缩略图里必须留一圈透明边（放选中描边和烘焙的阴影）。如果老实把整张图塞进
 * 按钮的内容区，这圈留白就成了相邻拼块之间的大空隙——拼块看着又小又散。
 * 让图片比内容区大 2×bleed、再用负 margin 居中，留白就压到邻居的透明区上，
 * 拼块本体之间只剩窄窄一条缝。
 */
const THUMB_BLEED = readCssVar('--thumb-bleed', 0);

/**
 * 画布与屏幕设备像素 1:1：缩略图显示时不经过任何缩放重采样。
 * 画布比显示尺寸大或小都会被浏览器双线性缩放，1px 左右的细描边和抗锯齿边缘
 * 在缩放后会粗细不匀、出现台阶——这就是托盘里锯齿的来源。
 */
const THUMB_DPR = Math.max(1, Math.min(4, globalThis.devicePixelRatio || 1));

/** 按钮边长 → 缩略图在页面上实际渲染的 CSS 边长（扣掉边框内边距，再加外溢） */
function thumbDisplayCss(size) {
  return Math.max(1, size - THUMB_CHROME + THUMB_BLEED * 2);
}

function thumbCanvasPx(size) {
  return Math.round(thumbDisplayCss(size) * THUMB_DPR);
}

/** 画布边长 → 显示的 CSS 边长 */
function thumbContentPx(px) {
  return px / THUMB_DPR;
}

/** CSS 像素 → 画布像素的换算系数 */
function thumbPxPerCss(size) {
  const px = thumbCanvasPx(size);
  return px / thumbContentPx(px);
}

/**
 * 缩略图共用的取景框：取"四边都凸"时的半宽。
 * 每块都按这一条标尺缩放，所以**主体正方格在托盘里大小完全一致**
 * （扣子多的块只是往外多伸一点），这才是真实拼图的样子；
 * 若改成按各自包围盒填满，角块会被放得比中间块大一圈。
 */
let thumbFrame = null;
function thumbFrameFor(body) {
  if (thumbFrame && thumbFrame.body === body) return thumbFrame;
  const { shape } = buildJigsawShape(body, { top: 1, right: 1, bottom: 1, left: 1 }, 12);
  let r = 0;
  for (const p of shape.getPoints(12)) r = Math.max(r, Math.abs(p.x), Math.abs(p.y));
  thumbFrame = { body, r };
  return thumbFrame;
}

/** 缩略图的取景换算：共用标尺定缩放，按自身包围盒居中 */
function thumbLayout(piece, px) {
  const body = piece.cellPx;
  const frame = thumbFrameFor(body);
  const pxPerCss = px / thumbContentPx(px);
  const avail = Math.max(1, px - THUMB_MARGIN * 2 * pxPerCss);
  const scale = avail / (frame.r * 2);
  // 每块按自己的包围盒（含蘑菇扣）居中，凸起只在一侧的块才不会看起来偏一边
  const { shape } = buildJigsawShape(body, piece.tabs, 12);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of shape.getPoints(12)) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    const cy = -p.y; // 形状是 y↑，画布是 y↓
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;
  }
  return {
    // 共用标尺：主体大小一致，扣子按实际情况向外伸
    scale,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    hw: body / 2,
    // 贴图里主体区域位于 [pPad, pPad+body]，对应中心坐标 [-hw, hw]
    side: body + piece.pPad * 2,
  };
}

/**
 * 缩略图里主体正方格的 CSS 边长，以及它的中心相对图片中心的偏移（未旋转时）。
 * 放置飞行动画靠它把缩略图和 3D 槽位的大小、位置对齐。
 */
export function thumbBodyMetrics(piece, size = 72) {
  const px = thumbCanvasPx(size);
  const layout = thumbLayout(piece, px);
  const perCss = thumbPxPerCss(size);
  const s = layout.scale / perCss;
  return { body: piece.cellPx * s, offX: -layout.cx * s, offY: -layout.cy * s };
}

/** 把画布原点挪到拼块中心并按取景换算缩放，之后即可直接用形状坐标绘制 */
function applyThumbLayout(ctx, px, layout) {
  ctx.translate(px / 2, px / 2);
  ctx.scale(layout.scale, layout.scale);
  ctx.translate(-layout.cx, -layout.cy);
}

/**
 * 懒生成托盘缩略图（小尺寸，快）。
 * 贴图里拼块主体只占中间 body/(body+2*pPad)，缩略图必须按同一比例绘制，
 * 否则凸出的蘑菇扣会落到画布之外被裁掉，只剩一个带缺口的方块。
 * 投影直接烘焙进这张图：滚动时不用给每块跑 filter，滑动才顺。
 */
export function getPieceThumb(piece, size = 72) {
  if (piece.thumb) return piece.thumb;
  const px = thumbCanvasPx(size);
  const t = document.createElement('canvas');
  t.width = px;
  t.height = px;
  const ctx = t.getContext('2d', { alpha: true });
  ctx.clearRect(0, 0, px, px);
  const layout = thumbLayout(piece, px);
  const k = thumbPxPerCss(size);

  // 阴影只投一层：两遍阴影会在拼块边缘叠出一圈很硬的深色描边。
  // 关键：shadowBlur 走的是画布像素，不受 CTM 缩放影响；而托盘里的拼块本体只有
  // 30 多个 CSS 像素，模糊一旦铺到 12px 以上，阴影就被摊成一层看不见的灰雾
  // （实测边缘只剩 4% 不透明度）。所以这里改成"收紧的接触投影"：
  // 模糊 ~7px 让边化开，偏移压到 2px 以内，阴影只贴在拼块底下，不往外糊。
  // 托盘底接近纯白，投影浓度要够：实测峰值 20% 不透明度（51/255），
  // 往下 9px 内衰减到 4%，既看得见、又不会像原来那样围一圈深色。
  // 拼块本体先画到离屏画布，再整张带阴影贴上来：
  // · 不用 clip()：clip 的边缘是硬的（逐像素要么留要么丢），就是锯齿来源；
  //   改成先铺贴图、再用 destination-in 填轮廓当蒙版，填充边缘是抗锯齿的。
  // · 不再在底下垫一块黑色填充来"投"阴影：两层半透明边缘叠在一起，
  //   黑色会从贴图的抗锯齿边里透出来，形成一圈发暗的毛边。
  //   现在阴影直接由拼块自身的 alpha 投出，边缘干净。
  const art = document.createElement('canvas');
  art.width = px;
  art.height = px;
  const actx = art.getContext('2d', { alpha: true });
  actx.save();
  applyThumbLayout(actx, px, layout);
  actx.imageSmoothingEnabled = true;
  actx.imageSmoothingQuality = 'high';
  actx.drawImage(
    piece.canvas,
    -layout.hw - piece.pPad,
    -layout.hw - piece.pPad,
    layout.side,
    layout.side
  );
  actx.globalCompositeOperation = 'destination-in';
  actx.fillStyle = '#000';
  piecePathCentered(actx, layout.hw, piece.tabs);
  actx.fill();
  // 纸片边缘一圈极淡的暗边：source-atop 只画在拼块内部，不会描到外面
  actx.globalCompositeOperation = 'source-atop';
  actx.lineJoin = 'round';
  actx.strokeStyle = 'rgba(30, 20, 40, 0.14)';
  actx.lineWidth = (1.6 * k) / layout.scale;
  piecePathCentered(actx, layout.hw, piece.tabs);
  actx.stroke();
  actx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 7 * k;
  ctx.shadowOffsetY = 1.6 * k;
  ctx.drawImage(art, 0, 0);
  ctx.restore();
  piece.thumb = t.toDataURL('image/png');
  return piece.thumb;
}

/**
 * 选中边框：沿拼块真实轮廓（含蘑菇扣）**外侧**的一圈 2px 实线，
 * 与拼块之间留 1px 空隙，只有一条线。
 * 画法：先描一条够宽的带子（覆盖轮廓 ±(空隙+线宽)），再把形状内部和空隙那一条挖掉，
 * 剩下的就是纯外侧的边线。
 */
export function getPieceFrame(piece, size = 72) {
  if (piece.frame) return piece.frame;
  const px = thumbCanvasPx(size);
  const t = document.createElement('canvas');
  t.width = px;
  t.height = px;
  const ctx = t.getContext('2d', { alpha: true });
  ctx.clearRect(0, 0, px, px);
  const layout = thumbLayout(piece, px);
  // 形状坐标 → 画布像素要再乘 layout.scale，所以线宽必须除以它才是真正的 CSS 像素
  const perCss = thumbPxPerCss(size) / layout.scale;
  const GAP = 1;
  const THICK = 1.25;

  ctx.save();
  applyThumbLayout(ctx, px, layout);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 181, 71, 1)';
  ctx.lineWidth = (GAP + THICK) * 2 * perCss;
  piecePathCentered(ctx, layout.hw, piece.tabs);
  ctx.stroke();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(); // 挖掉形状内部
  ctx.lineWidth = GAP * 2 * perCss;
  ctx.stroke(); // 再挖掉紧贴轮廓的 1px 空隙
  ctx.restore();

  piece.frame = t.toDataURL('image/png');
  return piece.frame;
}

/**
 * 点选命中判定：(x, y) 是缩略图内容区内的 CSS 像素。
 * 叠放时每块的矩形盒互相压住，浏览器按矩形判定会点错块，
 * 这里按拼块真实轮廓判定，再由调用方取压在最上面的那块。
 */
export function hitTestPiece(piece, x, y, size = 72) {
  const px = thumbCanvasPx(size);
  if (!hitCtx) hitCtx = document.createElement('canvas').getContext('2d');
  return hitCtx.isPointInPath(pieceHitPath(piece, px), x * thumbPxPerCss(size), y * thumbPxPerCss(size));
}

let hitCtx = null;

/** 缩略图内部坐标下、未旋转的拼块轮廓（缓存，与绘制共用同一套取景） */
function pieceHitPath(piece, px) {
  if (piece.hitPath && piece.hitPathPx === px) return piece.hitPath;
  const layout = thumbLayout(piece, px);
  const half = px / 2;
  const { scale: s, cx, cy } = layout;
  const tx = (x) => half + s * (x - cx);
  const ty = (y) => half + s * (-y - cy);
  const p = new Path2D();
  tracePieceEdges(
    {
      moveTo: (x, y) => p.moveTo(tx(x), ty(y)),
      lineTo: (x, y) => p.lineTo(tx(x), ty(y)),
      bezierCurveTo: (a, b, c, d, e, f) => p.bezierCurveTo(tx(a), ty(b), tx(c), ty(d), tx(e), ty(f)),
    },
    layout.hw,
    piece.tabs
  );
  p.closePath();
  piece.hitPath = p;
  piece.hitPathPx = px;
  return p;
}

/** 顺时针转 90° × turns 后的边沿凹凸 */
export function rotateTabs(tabs, turns) {
  let { top, right, bottom, left } = tabs;
  const n = ((turns % 4) + 4) % 4;
  for (let i = 0; i < n; i++) {
    // CW：原 top → right
    [top, right, bottom, left] = [left, top, right, bottom];
  }
  return { top, right, bottom, left };
}

export function rotatedShapeKey(tabs, turns) {
  return shapeKey(rotateTabs(tabs, turns));
}

export function loadImage(fileOrUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    if (fileOrUrl instanceof Blob) img.src = URL.createObjectURL(fileOrUrl);
    else {
      img.crossOrigin = 'anonymous';
      img.src = fileOrUrl;
    }
  });
}
