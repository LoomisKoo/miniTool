import * as THREE from 'three'
import { W, SURFACE } from './spec.js'
import { mulberry, range, pick } from './rng.js'
import { heightFor } from './plan.js'
import * as Mat from './mat.js'
import * as Signs from './signs.js'

/**
 * 立面规范对齐 docs/08-building-style.md（城市合批尺度适配版）：
 * - curtain  CBD 幕墙：层高 3.6、层间板 ~28%、玻璃偏暗、punch≥0.85
 * - punch    住宅开洞：层高 3.0、窗洞约开间 60%×层高 56%、洞口暗边
 * - ribbon   板式带窗：通长带窗 + 厚实墙带
 * - podium   裙房：落地玻璃 + 柱墩 + 檐口
 *
 * 铁律 B：塔楼底层用 dressLobby（挑高 5.4、雨棚 2.5~4、自动门 1.6）
 * 铁律 C：沿街店面用 dressShopfront（橱窗 2.8、门 1.3×2.1、雨棚≤1.2）
 * 近中距再叠几何窗框/层间板（dressFacade）。合批城段不做店内几何货架。
 */

// 整城以暖石材为主；幕墙也走香槟/暖砂玻璃，禁止大面积冷灰墙
const WALL = [
  '#d2c4b0', '#c8b59a', '#d6c8b4', '#c0aa92', '#d8d0bc', '#cbbba4',
  '#cfc0a8', '#bda88e', '#d0bba8', '#b8987c', '#d4c8b4', '#e0d6c6',
]
const WALL_WARM = ['#c4a090', '#b88870', '#c09888', '#b07a66', '#b09070', '#c0a888']
// 幕墙框/裙色：香槟银、暖砂、米白铝——不再用冷灰蓝
const WALL_GLASS = ['#c8b8a4', '#d0c4b0', '#b8a890', '#c4b49c', '#d8ccb8', '#bca890', '#cfc2ae']
const WALL_ACCENT = ['#a87860', '#9a7060'] // 极少暖褐点缀，替代近黑灰
const ROOF = ['#6a665e', '#5c5852', '#77716a', '#545250', '#6e6860', '#625e58', '#807a70', '#58544e']
const ROOF_GREEN = ['#3a5a40', '#455e3e', '#2e4a36', '#4a6244', '#5a7048']
const ROOF_TERRACE = ['#c4b8a4', '#b8a098', '#d0c4b0', '#a89888', '#e0d4c0']
const HOTEL = ['#e6dfd2', '#d8ccb8', '#9a7a62', '#bfb3a3', '#7d6a5c']
const PODIUM = ['#d8d0bc', '#d2c4b0', '#d4c8b4', '#d6c8b4']

/** @typedef {'curtain'|'punch'|'ribbon'|'podium'} FacadeStyle */

/** 共用：三段（底/身/顶）+ 整数开间贴边（墙角实柱，窗不截断）+ 统一窗色 */

/** 只发正面 + 四个侧面的盒子（背面贴在墙上，永远看不到），比整盒省 1/6 三角 */
function mergeSlabs(parts) {
  const src = mergeBoxes(parts)
  const p = src.attributes.position.array
  const n = src.attributes.normal.array
  const pos = []
  const nor = []
  // 每块盒子非索引化后 36 顶点（108 float），面序 px, nx, py, ny, pz, nz
  const boxes = p.length / 108
  for (let b = 0; b < boxes; b++) {
    for (let f = 0; f < 5; f++) {
      if (f === 5) continue // 跳过 -z 背面（贴墙，永远看不到）
      const off = b * 108 + f * 18
      for (let k = 0; k < 18; k++) {
        pos.push(p[off + k])
        nor.push(n[off + k])
      }
    }
  }
  src.dispose()
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return out
}

/** 把几块盒子合并成一个几何（不引 BufferGeometryUtils，避免额外依赖） */
function mergeBoxes(parts) {
  const pos = []
  const nor = []
  for (const [sx, sy, sz, px, py, pz] of parts) {
    const g = new THREE.BoxGeometry(sx, sy, sz).translate(px, py, pz)
    const ng = g.toNonIndexed()
    pos.push(...ng.attributes.position.array)
    nor.push(...ng.attributes.normal.array)
    g.dispose()
    ng.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return out
}

/**
 * 一个「窗套」实例 = 左右框 + 上下框 + 中竖梃。
 * 局部坐标：x/y ∈ [-0.5, 0.5]，z ∈ [0, 1]（0 贴墙，1 外挑一个窗套进深）。
 * 以前一圈窗套要 4~5 个实例，整城因此涨到 500 万实例；现在 1 个。
 */
function makeWinFrameGeo(t = 0.075) {
  // 画框：正面一圈 4 块 + 内壁 4 块 = 8 个三角面片的四边形（16 三角）。
  // 旧版 5 个实心盒子 = 60 三角，整城 45 万扇窗就吃掉 2700 万三角。
  const pos = []
  const nor = []
  // 四边形：按目标法线自动纠正绕序，否则一半面片会被背面剔除 → 窗套「消失」
  const quad = (a, b, c, d, n) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    const cx = uy * vz - uz * vy
    const cy = uz * vx - ux * vz
    const cz = ux * vy - uy * vx
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) {
      pos.push(...a, ...d, ...c, ...a, ...c, ...b)
    } else {
      pos.push(...a, ...b, ...c, ...a, ...c, ...d)
    }
    for (let k = 0; k < 6; k++) nor.push(...n)
  }
  const i = 0.5 - t // 内圈
  const o = 0.5
  const Z = 1
  // 正面（朝外 +z）
  quad([-o, i, Z], [-o, o, Z], [o, o, Z], [o, i, Z], [0, 0, 1])
  quad([-o, -o, Z], [-o, -i, Z], [o, -i, Z], [o, -o, Z], [0, 0, 1])
  quad([-o, -i, Z], [-i, -i, Z], [-i, i, Z], [-o, i, Z], [0, 0, 1])
  quad([i, -i, Z], [o, -i, Z], [o, i, Z], [i, i, Z], [0, 0, 1])
  // 内壁（从压出来的框边往里收，形成洞口侧壁）
  quad([-i, i, Z], [-i, i, 0], [i, i, 0], [i, i, Z], [0, -1, 0])
  quad([-i, -i, Z], [i, -i, Z], [i, -i, 0], [-i, -i, 0], [0, 1, 0])
  quad([-i, -i, Z], [-i, i, Z], [-i, i, 0], [-i, -i, 0], [1, 0, 0])
  quad([i, i, Z], [i, -i, Z], [i, -i, 0], [i, i, 0], [-1, 0, 0])
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return out
}


/** 平面窗的「凹进」着色：视差侧壁 + 顶部内阴影，让远处窗也有洞的深度 */
function recessSnippet() {
  return `
      vec3 _cd = camDirV();
      #ifdef FLAT_SHADED
        vec3 _nrmV = vec3(0.0, 0.0, 1.0);
      #else
        vec3 _nrmV = normalize(vNormal);
      #endif
      vec3 _tn0 = cross(_nrmV, uUpView);
      // 法线平行 up（顶面）时 cross 为 0，normalize 会变 NaN 污染整个颜色
      vec3 _tanV = dot(_tn0, _tn0) > 1e-6 ? normalize(_tn0) : vec3(1.0, 0.0, 0.0);
      float _tan = dot(_cd, _tanV);
      float _sl = clamp(abs(_tan) * 0.5, 0.02, 0.34);
      float _su = clamp(dot(_cd, uUpView) * 0.55, 0.0, 0.28);
  `
}

/**
 * 店面框料整体合成一份几何：壁柱 / 踢脚 / 压檐 / 门套 / 橱窗框 / 中梃，一共 12 个盒子。
 * 局部坐标 x 居中、y 从 -H/2 起、z 从 0（墙面）向外；实例只做 x 向缩放适配开间。
 * 以前每间店要 18 个实例，现在 1 个 —— 5 万间店 = 少掉 90 万个实例。
 */
const SHOP_REF = { W: 5.5, H: 4.2 }
// 店门居中（双开玻璃门 + 门套），两侧对称橱窗；招牌带加高到 1.6m
const SHOP_DOOR_W = 1.6
const SHOP_GLASS_TOP = 2.6
const SHOP_WIN_W = (SHOP_REF.W - 0.56 - SHOP_DOOR_W - 0.34) / 2
const SHOP_WIN_AT = SHOP_DOOR_W / 2 + 0.17 + SHOP_WIN_W / 2
function makeShopFrameGeo(doorLeft, front = 1.02) {
  void doorLeft
  const { W, H } = SHOP_REF
  const doorW = SHOP_DOOR_W
  const doorH = 2.2
  const winW = SHOP_WIN_W
  const kickTop = 0.3
  const glassTop = SHOP_GLASS_TOP
  const y0 = -H / 2
  const B = []
  const add = (cx, cy, w, h, depth, zFront = front) => {
    B.push([w, h, depth, cx, y0 + cy, zFront - depth / 2])
  }
  // 只留两侧立框 + 玻璃顶横梁。踢脚板、门套、橱窗内框全部去掉：
  // 整个框按店宽缩放，宽店里踢脚被拉成贴地一整条「矮墙」、门楣成一根长杆（看上去像店门口一道围栏）
  void doorW; void doorH; void winW; void kickTop
  add(-W / 2 + 0.06, H / 2, 0.12, H, 0.22)
  add(W / 2 - 0.06, H / 2, 0.12, H, 0.22)
  add(0, glassTop + 0.06, W * 0.98, 0.12, 0.16)
  return mergeSlabs(B)
}

function facadeCommonPrelude() {
  return `
      float yFromBot = vP0.z;
      float vH = vP0.w;
      #ifdef UPPER
        // 一层被挖成真店厢：上段楼体从 4.2m 起，立面网格按整楼高度续上
        yFromBot += 4.2;
        vH += 4.2;
      #endif
      float vSeed = vP1.z;
      float vBaseY = vP1.w;
      // 世界高度：叠起来的几段楼体各自从 0 数层会让每段亮灯图案一模一样 → 用世界层号
      float baseW = vP1.w - vP0.w * 0.5;
      float wY = baseW + vP0.z;
      // 架空/叠放的楼段（塔楼上段、裙房上的塔、塔冠）：层网格按世界高度对齐，
      // 上下两段的窗行连续，接缝处不再出现半截窗/亮条；也不再每段底部留空白层
      if (baseW > 0.6) { yFromBot = wY; vH = baseW + vP0.w; }
      float vCamDist = length(vViewPosition);
      float axis = abs(vP2.x) > abs(vP2.z) ? vP0.y : vP0.x;
      float faceHalf = abs(vP2.x) > abs(vP2.z) ? vP1.y : vP1.x;
      #ifdef CYL
        // 圆柱：沿周长展开（弧长），否则按 x/z 分面会在 45° 处出接缝
        axis = atan(vP0.y, vP0.x) * vP1.x;
        faceHalf = 3.14159265 * vP1.x;
      #endif
      // lod 更早更狠：中远距掐掉高频窗格，专治摩尔纹 / 走动闪烁虚线
      float lod = smoothstep(55.0, 240.0, vCamDist);
      float far = smoothstep(160.0, 480.0, vCamDist);
      float near = 1.0 - lod;
      float baseH = min(5.8, vH * 0.12);
      float crownH = min(10.0, vH * 0.08);
      float inBase = 1.0 - smoothstep(baseH - 0.6, baseH + 0.4, yFromBot);
      float inCrown = smoothstep(vH - crownH - 0.8, vH - crownH * 0.35, yFromBot);
      // 08 §6 窗玻璃全场一套 #7d8f9c
      vec3 G = vec3(0.49, 0.56, 0.61);
      // 近距交给几何窗；中距保留粗层带；远距几乎纯墙
      // 几何窗只在下面几层，上层近看仍要有窗，所以近距不能把 shader 窗掐光
      float geoFade = 1.0 - near * 0.25;
      // 底层污渍/压暗：贴地不要像刚出厂的塑料（只作用于真正临街的一段）
      float streetBase = 1.0 - smoothstep(0.8, 5.0, abs(vBaseY));
      // 每栋墙色轻微错开，避免连排楼像同一张贴图平铺
      float wallTint = 0.95 + 0.10 * hash21(vec2(vSeed * 9.7, 5.3));
      float grime = (1.0 - smoothstep(0.0, 8.0, yFromBot)) * 0.16 * streetBase;
      float soot = (1.0 - smoothstep(vH * 0.62, vH, yFromBot)) * 0.06;
  `
}

/** 亮窗内框：l/r/b/t 是窗在开间/层高里的比例，ins 是往里收的比例 */
function litRectSnippet(l, r, b, t, ins) {
  // 传进来的可能是字符串，必须先转成数字，否则 '0.20' + 0.055 会拼成 '0.200.055'（GLSL 直接编译失败）
  const L = Number(l), R = Number(r), B = Number(b), T = Number(t), N = Number(ins)
  const f = (v) => v.toFixed(4)
  return `(
          smoothstep(${f(L + N)}, ${f(L + N + 0.035)}, fx) * (1.0 - smoothstep(${f(R - N - 0.035)}, ${f(R - N)}, fx)) *
          smoothstep(${f(B + N)}, ${f(B + N + 0.045)}, fy) * (1.0 - smoothstep(${f(T - N - 0.045)}, ${f(T - N)}, fy))
        )`
}

/** 把开间网格收进墙角实柱内：span 取 floor((面宽-边柱*2)/bay)*bay，窗外一律墙 */
function facadeGridSnippet(bayExpr) {
  return `
      float _bay = ${bayExpr};
      float _pier = 0.55;
      float _usable = max(_bay, faceHalf * 2.0 - _pier * 2.0);
      float _nBay = max(1.0, floor(_usable / _bay + 1e-4));
      float _grid = _nBay * _bay;
      float _local = axis + _grid * 0.5;
      float inGrid = step(0.0, _local) * step(_local, _grid);
      #ifdef CYL
        _nBay = max(3.0, floor(2.0 * faceHalf / _bay + 0.5));
        _bay = 2.0 * faceHalf / _nBay;
        _grid = 2.0 * faceHalf;
        _local = axis + faceHalf;
        inGrid = 1.0;
      #endif
      float fx = fract(_local / _bay);
      float aw = fwidth(fx) * 1.3;
      // 斜视/远距：竖向开间一旦接近亚像素就整段关掉 —— 街上那排闪烁虚线就是它
      float vertOk = 1.0 - smoothstep(0.07, 0.2, aw);
  `
}

/** 窗参数：curtain 办公幕墙 / ribbon 板楼带窗 / podium 裙房 / punch 住宅凹窗。l/r/b/t 为窗在开间/层高里的比例，rd 凹进深度(m) */
const WIN = {
  curtain: { fh: 3.9, bay: 3.2, l: 0.03, r: 0.97, b: 0.08, t: 0.84, rd: 0.06, nm: 2, tr: -1, fw: 0.05, curtain: 1, cont: 0, office: 0.75 },
  ribbon: { fh: 3.9, bay: 4.8, l: 0.0, r: 1.0, b: 0.28, t: 0.78, rd: 0.16, nm: 4, tr: -1, fw: 0.06, curtain: 0, cont: 1, office: 0.45 },
  podium: { fh: 4.5, bay: 5.5, l: 0.2, r: 0.8, b: 0.28, t: 0.86, rd: 0.14, nm: 3, tr: 0.78, fw: 0.07, curtain: 0, cont: 0, office: 0.35 },
  punch: { fh: 3.0, bay: 4.2, l: 0.2, r: 0.8, b: 0.28, t: 0.86, rd: 0.24, nm: 2, tr: 0.72, fw: 0.06, curtain: 0, cont: 0, office: 0.1 },
  // 酒店：层高略高、开间窄、深凹窗、无中梃 —— 一眼和住宅/办公区分开
  hotel: { fh: 3.3, bay: 3.6, l: 0.2, r: 0.8, b: 0.28, t: 0.86, rd: 0.34, nm: 1, tr: -1, fw: 0.05, curtain: 0, cont: 0, office: 0.15 },
}

/**
 * 立面窗 v33：凹窗视差（窗洞侧壁/窗台/过梁）+ 室内映射（后墙/侧墙/地板/天花 + 吸顶灯衰减 + 家具/人影/窗帘）
 * + 暗玻璃菲涅尔反射天空，窗框中梃用 fwidth 解析抗锯齿；按屏幕像素大小 LOD 到整片平均，远处不闪。
 */
function facadeFragment(style) {
  const P = WIN[style] || WIN.punch
  const mode = style === 'curtain' || style === 'ribbon' || style === 'podium' ? 'office' : style === 'hotel' ? 'hotel' : 'res'
  const f = (v) => Number(v).toFixed(4)
  const shop = `
      float groundCut = smoothstep(4.2, 4.5, yFromBot);
      // 一层全部交给几何店厢（dressShopfront）。这里只做石材基座 + 上口线脚 + 污渍，
      // 绝不再往墙上画假橱窗/彩条雨棚 —— 那正是近看最像「贴图」的一层
      vec3 base = col * 0.95;
      base = mix(base, col * 0.78, 1.0 - smoothstep(0.0, 0.34, yFromBot));
      base = mix(base, col * 1.06, smoothstep(4.04, 4.24, yFromBot) * (1.0 - groundCut));
      col = mix(base, col, groundCut);
      // 夜里沿街一层透出的暖光（真正落地的一段）
      gShopLit = (1.0 - groundCut) * streetBase * (0.25 + 0.35 * hash21(vec2(floor(axis / 7.0), 1.0)));
      col *= 1.0 - grime - soot;
  `
  return facadeCommonPrelude() + `
      float FH = ${f(P.fh)};
      float fy = fract(yFromBot / FH);
      float floorI = floor(yFromBot / FH);
      // 亮灯用"和窗洞同一套"层号：以前用世界高度另算一套层号，楼段底不在层高整数倍时
      // 层界线落在窗中间 → 一扇窗上半亮下半暗，层间出现一条条细亮线，随视差闪烁
      float floorW = floorI + floor(vSeed * 97.0);
      ${facadeGridSnippet(f(P.bay))}
      float cellI = floor(_local / _bay);
      float fwA = max(fwidth(_local), 1e-4);
      float _dAx = dFdx(axis);
      float _dAy = dFdy(axis);
      #ifdef CYL
        float _alt = mod(_local + faceHalf, 2.0 * faceHalf);
        float _dBx = dFdx(_alt);
        float _dBy = dFdy(_alt);
        float _dLx = dFdx(_local);
        float _dLy = dFdy(_local);
        if (abs(_dBx) + abs(_dBy) < abs(_dLx) + abs(_dLy)) { _dAx = _dBx; _dAy = _dBy; } else { _dAx = _dLx; _dAy = _dLy; }
        fwA = max(abs(_dAx) + abs(_dAy), 1e-4);
      #endif
      float fwY = max(fwidth(yFromBot), 1e-4);
      float cellPx = min(_bay / fwA, FH / fwY);
      float dK = smoothstep(5.0, 16.0, cellPx);
      float farK = 1.0 - smoothstep(1.2, 3.5, cellPx);
      float bH = hash21(vec2(vSeed * 13.1, 7.7));
      float bH2 = hash21(vec2(vSeed * 5.3, 2.1));
      vec3 wall = diffuseColor.rgb * wallTint;
      // 视线切空间：T 沿 axis 增大方向，B 沿世界上方，N 朝外
      vec3 _p = -vViewPosition;
      vec3 Nv = normalize(vNormal);
      vec3 T0 = cross(uUpView, Nv);
      T0 = dot(T0, T0) > 1e-6 ? normalize(T0) : vec3(1.0, 0.0, 0.0);
      float _sg = dot(T0, dFdx(_p) * _dAx + dFdy(_p) * _dAy);
      vec3 Tv = _sg < 0.0 ? -T0 : T0;
      vec3 Bv = uUpView - Nv * dot(uUpView, Nv);
      Bv = dot(Bv, Bv) > 1e-6 ? normalize(Bv) : vec3(0.0, 1.0, 0.0);
      vec3 Vd = normalize(_p);
      vec3 vt = vec3(dot(Vd, Tv), dot(Vd, Bv), min(dot(Vd, Nv), -0.06));
      float cw = _bay;
      float lx = fract(_local / _bay) * cw;
      float ly = fy * FH;
      float wl = ${f(P.l)} * cw;
      float wr = ${f(P.r)} * cw;
      float wb = ${f(P.b)} * FH;
      float wt = ${f(P.t)} * FH;
      float ww = wr - wl;
      float wh = wt - wb;
      float floorOk = smoothstep(4.2, 4.6, yFromBot) * step(floorI * FH + wt, vH - 0.8);
      float openM = aaBox(lx, wl, wr, fwA) * aaBox(ly, wb, wt, fwY) * inGrid * floorOk;
      // 凹窗：从立面开口沿视线进到 rd 深处的玻璃面；没落在玻璃上的就是侧壁/窗台/过梁
      float RDp = ${f(P.rd)};
      vec2 off = clamp(vt.xy * (RDp / -vt.z), vec2(-ww, -wh) * 0.7, vec2(ww, wh) * 0.7);
      vec2 gp = vec2(lx, ly) + off;
      float gX = ${P.cont ? '1.0' : 'aaBox(gp.x, wl, wr, fwA)'};
      float onGlass = gX * aaBox(gp.y, wb, wt, fwY);
      vec3 revealCol = wall * (gp.y < wb ? 0.92 : (gp.y > wt ? 0.34 : 0.6));
      vec2 gu = vec2((gp.x - wl) / ww, (gp.y - wb) / wh);
      float FW = ${f(P.fw)};
      float inner = aaBox(gp.x, wl + FW, wr - FW, fwA) * aaBox(gp.y, wb + FW, wt - FW, fwY);
      float mPitch = ww / ${f(P.nm)};
      float mD = abs(fract((gp.x - wl) / mPitch + 0.5) - 0.5) * mPitch;
      float mull = lineAA(mD, FW * 0.5, fwA);
      float trans = ${P.tr > 0 ? `lineAA(abs(gp.y - (wb + ${f(P.tr)} * wh)), FW * 0.4, fwY)` : '0.0'};
      float frameAll = clamp(max(1.0 - inner, max(mull, trans)), 0.0, 1.0) * mix(0.6, 1.0, dK);
      vec3 frameCol = mix(vec3(0.09, 0.095, 0.105), wall * 0.85, step(0.55, bH2));
      // 房间按真实平面划分：住宅 2~4 开间一户（客厅通窗 + 端头卧室），办公 6 开间一个照明分区的大平层，
      // 酒店 1 开间一间；同户/同区共用亮灯状态。进深 5~9m，再往里是看不见的核心筒
      float nB = ${mode === 'office' ? '(2.0 + floor(bH2 * 4.99))' : mode === 'hotel' ? '1.0' : '(2.0 + floor(bH * 2.99))'};
      float aptI = floor(cellI / nB);
      float inApt = cellI - aptI * nB;
      float bedR = ${mode === 'res' ? 'step(2.5, nB) * step(nB - 1.5, inApt)' : '0.0'};
      float r0 = mix(0.0, nB - 1.0, bedR);
      float r1 = mix(nB - ${mode === 'res' ? 'step(2.5, nB)' : '0.0'}, nB, bedR);
      float roomId = aptI * 2.0 + bedR;
      float rH = hash21(vec2(roomId + vSeed * 53.0, floorW));
      float rB = hash21(vec2(aptI + vSeed * 31.0, floorW + 7.0));
      float rC = hash21(vec2(aptI * 1.7 + vSeed * 11.0, floorW * 1.3 + 2.0));
      float fl = hash21(vec2(floorW, vSeed * 13.0));
      float litV = litOn(rH, fl, rB, (aptI * nB + 0.5) * _bay, (floorI + 0.5) * FH, _bay, FH, vSeed) * floorOk * inGrid;
      float isCool = step(rC, ${f(P.office)} * (0.5 + bH));
      vec3 lTint = mix(mix(vec3(1.0, 0.76, 0.54), vec3(1.0, 0.86, 0.70), rB), vec3(0.88, 0.94, 1.0), isCool);
      float RDr = ${mode === 'office' ? 'mix(7.0, 9.0, rB)' : mode === 'hotel' ? 'mix(5.5, 7.0, rB)' : 'mix(5.0, 7.0, rB)'};
      float xmin = (r0 - inApt) * cw + 0.12;
      float xmax = (r1 - inApt) * cw - 0.12;
      float ymax = FH - 0.35;
      vec3 rdv = vec3(vt.x, vt.y, -vt.z);
      vec3 inv = 1.0 / max(abs(rdv), vec3(1e-4));
      float tX = (rdv.x > 0.0 ? xmax - gp.x : gp.x - xmin) * inv.x;
      float tY = (rdv.y > 0.0 ? ymax - gp.y : gp.y) * inv.y;
      float tZ = RDr * inv.z;
      float tm = max(min(tX, min(tY, tZ)), 0.0);
      vec3 hp = vec3(gp, 0.0) + rdv * tm;
      vec3 roomCol = rC < 0.3 ? vec3(0.86, 0.83, 0.77) : (rC < 0.55 ? vec3(0.80, 0.74, 0.64) : (rC < 0.8 ? vec3(0.72, 0.77, 0.80) : vec3(0.78, 0.70, 0.66)));
      // 室内面分界做解析抗锯齿（以前 step 硬切 → 锯齿 + 走动闪烁）
      float _db = min(tX, tY) - tZ;
      float _eb = fwidth(_db) + 1e-3;
      float isBack = smoothstep(-_eb, _eb, _db);
      float _ds = tY - tX;
      float _es = fwidth(_ds) + 1e-3;
      float isSide = (1.0 - isBack) * smoothstep(-_es, _es, _ds);
      float _up = smoothstep(-0.03, 0.03, rdv.y);
      float isCeil = (1.0 - isBack) * (1.0 - isSide) * _up;
      float isFloor = (1.0 - isBack) * (1.0 - isSide) * (1.0 - _up);
      vec3 floorCol = mix(vec3(0.42, 0.33, 0.25), vec3(0.45, 0.45, 0.46), step(0.5, rH));
      // 空房间：只有墙/地/顶，不放家具与人影；办公深处是核心筒墙（更暗）
      // 同一房间同一色相：墙/顶/地只差明度，不再白/灰/米黄混在一个单元里
      vec3 surf = roomCol * (isBack * ${mode === 'office' ? '0.62' : '0.92'} + isSide * 0.84 + isCeil * 1.06 + isFloor * 0.66);
      // 整顶均匀照明，按进深轻微衰减（以前 3.2m 一盏灯 → 竖向亮暗条纹）
      float _lk = mix(1.05, 0.72, clamp(hp.z / RDr, 0.0, 1.0));
      vec3 interior = min(surf * lTint * _lk, vec3(1.0));
      float cType = hash21(vec2(rC * 9.1, rH * 3.7));
      float cl = mix(0.15, 0.38, rB);
      float curtainM = cType < 0.22 ? max(step(gu.x, cl), step(1.0 - cl * 0.8, gu.x))
        : (cType < 0.34 ? step(1.0 - mix(0.3, 0.7, rH), gu.y) * mix(1.0, 0.75 + 0.25 * step(0.5, fract(gp.y * 10.0)), dK) : 0.0);
      vec3 curtCol = vec3(0.84, 0.78, 0.68);
      vec3 litInt = mix(interior, curtCol * lTint * 0.7, curtainM);
      vec3 roomE = litInt * litV;
      // 玻璃：暗色 + 菲涅尔反射天空（白天亮、夜里深），幕墙玻璃允许冷色调
      vec3 gTint = ${P.curtain ? 'bH < 0.3 ? vec3(0.50, 0.62, 0.74) : (bH < 0.55 ? vec3(0.52, 0.66, 0.64) : (bH < 0.78 ? vec3(0.64, 0.57, 0.48) : vec3(0.58, 0.60, 0.63)))' : 'G'};
      float cosV = clamp(-vt.z, 0.0, 1.0);
      float F = 0.04 + 0.96 * pow(1.0 - cosV, 5.0);
      vec3 Rv = reflect(Vd, Nv);
      vec3 Rw = normalize((vec4(Rv, 0.0) * viewMatrix).xyz);
      float ru = Rw.y;
      vec3 skyD = mix(vec3(0.70, 0.78, 0.86), vec3(0.32, 0.52, 0.80), smoothstep(0.0, 0.7, ru));
      vec3 skyN = mix(vec3(0.20, 0.15, 0.12), vec3(0.03, 0.05, 0.10), smoothstep(0.0, 0.45, ru));
      vec3 gndR = mix(skyD * 0.35, vec3(0.09, 0.065, 0.04), uNight);
      vec3 sky = mix(gndR, mix(skyD, skyN, uNight), smoothstep(-0.2, 0.05, ru));
      // 白天同一栋楼玻璃统一，只留随高度的轻微反射渐变；逐片差异只在夜里
      float paneVar = 1.0 + (hash21(vec2(cellI + vSeed * 3.0, floorI * 3.1)) - 0.5) * 0.3 * uNight;
      float hGrad = 0.92 + 0.16 * clamp(yFromBot / max(vH, 1.0), 0.0, 1.0);
      vec3 cityGlow = vec3(0.012, 0.010, 0.009) * uNight;
      vec3 reflE = sky * gTint * 1.4 * (F + 0.22 * (1.0 - uNight) + 0.16 * uNight + ${f(P.curtain ? 0.06 : 0)}) * paneVar * hGrad + cityGlow;
      vec3 moonV = normalize(vec3(0.53, 0.71, -0.47));
      reflE += vec3(0.75, 0.82, 1.0) * pow(max(dot(Rw, moonV), 0.0), 400.0) * 1.5 * uNight;
      reflE += vec3(0.10, 0.07, 0.035) * exp(-max(yFromBot, 0.0) / 12.0) * uNight;
      vec3 glassAlb = gTint * 0.08;
      vec3 unlitHint = mix(surf, curtCol, curtainM) * vec3(0.007, 0.0065, 0.006) * (1.0 - step(0.001, litV)) * dK;
      vec3 glassE = reflE + (roomE + unlitHint) * (1.0 - F) * 0.9 * uNight;
      vec3 winAlb = mix(revealCol, mix(glassAlb, frameCol, frameAll), onGlass);
      vec3 winE = glassE * (1.0 - frameAll) * onGlass + revealCol * lTint * litV * 0.05 * uNight * (1.0 - onGlass);
      vec3 winEF = (reflE + lTint * litV * 0.75 * uNight) * (1.0 - 0.25 * frameAll);
      winE = mix(winEF, winE, dK);
      winAlb = mix(mix(glassAlb, frameCol, 0.2), winAlb, dK);
      float winGlass = mix(0.8, onGlass * (1.0 - frameAll), dK);
      // 窗外墙面：层间线 + 窗台；幕墙的层间是不透明 spandrel 玻璃
      vec3 outAlb = wall;
      float slabL = lineAA(min(fy, 1.0 - fy) * FH, 0.09, fwY) * inGrid;
      outAlb *= 1.0 - 0.2 * slabL;
      float sillL = lineAA(abs(ly - (wb - 0.05)), 0.05, fwY) * aaBox(lx, wl - 0.1, wr + 0.1, fwA) * inGrid * floorOk;
      outAlb = mix(outAlb, wall * 1.15, sillL);
      float spandG = ${f(P.curtain)} * inGrid;
      outAlb = mix(outAlb, gTint * 0.1, spandG * 0.92);
      vec3 outE = reflE * 0.75 * spandG;
      vec3 colD = mix(outAlb, winAlb, openM);
      vec3 emD = mix(outE, winE, openM);
      float glassD = mix(spandG, winGlass, openM);
      // 亚像素：整片平均（亮灯率 × 窗面积），不再逐窗闪烁
      float area = (ww * wh) / (cw * FH) * inGrid * smoothstep(4.2, 4.6, yFromBot);
      float bRatio = (0.30 + 0.25 * hash21(vec2(vSeed * 7.13, 2.9))) * 0.8;
      vec3 avgLitT = mix(vec3(1.0, 0.85, 0.68), vec3(0.92, 0.95, 1.0), ${f(P.office)} * 0.6);
      vec3 reflAvg = sky * gTint * 1.4 * (0.08 + 0.22 * (1.0 - uNight) + 0.16 * uNight) + cityGlow;
      vec3 avgAlb = mix(mix(wall, gTint * 0.1, spandG * 0.92), glassAlb, area);
      vec3 avgE = area * (reflAvg + avgLitT * bRatio * 0.6 * uNight) + (1.0 - area) * spandG * reflAvg * 0.75;
      vec3 col = mix(colD, avgAlb, farK);
      gWinEmis = mix(emD, avgE, farK);
      gGlass = mix(glassD, area + (1.0 - area) * spandG, farK);
      col = mix(col, wall * 1.04, inCrown * 0.35 * (1.0 - spandG));
  ` + shop
}

/** 给城墙内侧立面用：同一套立面 shader（凹窗 / 室内 / 夜灯） */
export function facadeMaterial(hex, style) {
  const m = makeWallMat(hex, style, false, false)
  Mat.registerMaterial(m)
  return m
}
function makeWallMat(hex, style, cyl = false, upper = false) {
  // 金属度压低：蓝天反射会把窗染成多色「贴纸」
  const glassLike = style === 'curtain' || style === 'podium'
  const mat = new THREE.MeshStandardMaterial({
    color: hex,
    roughness: glassLike ? 0.62 : 0.9,
    metalness: glassLike ? 0.1 : 0.03,
    // IBL 略抬：背光面靠环境光补一层，不只靠硬方向光
    envMapIntensity: glassLike ? 0.42 : 0.38,
    // 贴墙细件（玻璃/窗套）外挑不够时，靠深度偏移压住 z-fight 虚线
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })
  const frag = facadeFragment(style)
  if (cyl) mat.defines = { CYL: '' }
  if (upper) mat.defines = { ...(mat.defines || {}), UPPER: '' }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = Mat.nightU
    shader.uniforms.uUpView = Mat.upViewU
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        // 打包：varying 数量有硬上限（16 个 vec4），拆开写会把整条管线挤爆
        varying vec4 vP0; // meters.x, meters.z, yFromBot, H
        flat varying vec4 vP1; // halfX, halfZ, seed, baseY（逐实例常量，flat 防插值误差被 hash 放大成噪点）
        varying vec4 vP2; // 世界法线 + w=该面做实墙（山墙）
        float zzH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 _localPos = position;
        #include <begin_vertex>`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          float sx = length(instanceMatrix[0].xyz);
          float sy = length(instanceMatrix[1].xyz);
          float sz = length(instanceMatrix[2].xyz);
          vec3 _m = _localPos * vec3(sx, sy, sz);
          vP0 = vec4(_m.x, _m.z, _m.y + sy * 0.5, sy);
          vP1 = vec4(sx * 0.5, sz * 0.5,
                     zzH(instanceMatrix[3].xz), 0.0);
          float _blank = 0.0;
          #ifdef USE_INSTANCING_COLOR
            if (instanceColor.g < 0.5) {
              float _bits = floor(instanceColor.r * 15.0 + 0.5);
              float _fb = objectNormal.x > 0.5 ? 1.0 : (objectNormal.x < -0.5 ? 2.0 : (objectNormal.z > 0.5 ? 4.0 : (objectNormal.z < -0.5 ? 8.0 : 0.0)));
              if (_fb > 0.0) _blank = mod(floor(_bits / _fb), 2.0);
            }
          #endif
          vP2 = vec4(normalize(mat3(instanceMatrix) * objectNormal), _blank);
          vec4 wp = modelMatrix * instanceMatrix * vec4(_localPos, 1.0);
          vP1.w = wp.y - _m.y;
        #else
          vP0 = vec4(_localPos.x, _localPos.z, _localPos.y + 0.5, 1.0);
          vP1 = vec4(abs(_localPos.x), abs(_localPos.z), 0.0, 0.0);
          vP2 = vec4(objectNormal, 0.0);
        #endif`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec4 vP0;
        flat varying vec4 vP1;
        varying vec4 vP2;
        uniform float uNight;
        uniform vec3 uUpView;
        // 视角方向用 three 自带的 vViewPosition 反推（view 空间），不再多占 varying
        vec3 camDirV() { return normalize(vViewPosition); }
        float gLitWin = 0.0;
        float gShopLit = 0.0;
        vec3 gLitTint = vec3(1.0, 0.8, 0.55);
        vec3 gWallCol = vec3(0.0);
        float gYB = 0.0;
        float gVH = 1.0;
        float gSeedG = 0.0;
        float hash21(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        // 夜窗：每栋楼亮灯率 30~55%，整层/整户成片暗，暖(2700~3500K)/冷(办公)混合，亮度有高有低
        float litPick(float c, float fl, float b, float ax, float y, float bay, float fh, float seed, float office, float fy) {
          float ratio = 0.30 + 0.25 * hash21(vec2(seed * 7.13, 2.9));
          float fi = floor(y / fh);
          float floorOn = step(0.16, fl);
          float unit = hash21(vec2(floor(ax / (bay * 3.0)) + seed * 41.0, floor(fi / 2.0) + 3.0));
          float th = ratio + (unit - 0.5) * 0.45 + (fl - 0.5) * 0.25;
          float on = step(c, th) * floorOn;
          float t = hash21(vec2(c * 17.3 + seed, b * 9.1 + fi));
          float isCool = step(t, office * (0.55 + 0.9 * hash21(vec2(seed * 3.7, 8.1))));
          float k = hash21(vec2(b * 5.7, c * 3.1));
          vec3 warm = mix(vec3(1.0, 0.64, 0.34), vec3(1.0, 0.82, 0.60), k);
          vec3 cool = mix(vec3(0.84, 0.91, 1.0), vec3(0.96, 0.97, 1.0), k);
          gLitTint = mix(warm, cool, isCool);
          float bright = mix(0.26, 1.0, b * b);
          // 吸顶灯：窗上沿更亮；部分窗拉了半帘
          float grad = 0.7 + 0.4 * smoothstep(0.15, 0.85, fy);
          float blind = step(0.74, hash21(vec2(c * 3.3, b * 7.7))) * smoothstep(0.55, 0.6, fy);
          return on * bright * grad * (1.0 - 0.6 * blind);
        }
        vec3 gWinEmis = vec3(0.0);
        float gGlass = 0.0;
        float aaBox(float x, float a, float b, float fw) {
          return clamp((x - a) / fw + 0.5, 0.0, 1.0) * clamp((b - x) / fw + 0.5, 0.0, 1.0);
        }
        float lineAA(float d, float hw, float fw) {
          return clamp((hw - d) / fw + 0.5, 0.0, 1.0) * clamp(2.0 * hw / fw, 0.0, 1.0);
        }
        float litOn(float c, float fl, float b, float ax, float y, float bay, float fh, float seed) {
          float ratio = 0.30 + 0.25 * hash21(vec2(seed * 7.13, 2.9));
          float fi = floor(y / fh);
          float floorOn = step(0.1, fl);
          float unit = hash21(vec2(floor(ax / (bay * 3.0)) + seed * 41.0, floor(fi / 2.0) + 3.0));
          float th = ratio + (unit - 0.5) * 0.45 + (fl - 0.5) * 0.25;
          // 偶尔整层全亮（加班层/公区），其余逐户随机
          return max(step(c, th) * floorOn, step(0.955, fl)) * mix(0.35, 1.0, b);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `
        {
          float vert = (1.0 - smoothstep(0.28, 0.72, abs(vP2.y))) * (1.0 - vP2.w);
          vec3 wallCol = diffuseColor.rgb;
          ${frag}
          diffuseColor.rgb = mix(wallCol, col, vert);
          gWinEmis *= vert;
          gGlass *= vert;
          gWallCol = diffuseColor.rgb * vert * (1.0 - gGlass);
          gYB = yFromBot;
          gVH = vH;
          gSeedG = vSeed;
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.12, gGlass * 0.85);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          // 灯色逐窗由 litPick 给出（暖/冷混合），这里只给整体强度
          float farAtten = mix(1.0, 0.8, smoothstep(220.0, 900.0, length(vViewPosition)));
          totalEmissiveRadiance += gWinEmis * farAtten;
          totalEmissiveRadiance += gShopLit * vec3(1.0, 0.78, 0.5) * (1.15 * uNight);
          // 夜间立面补光：低层街灯暖反射 + 天光冷底 + 部分高楼冠部泛光，立面不再死黑
          float _street = exp(-max(gYB, 0.0) / 16.0) * 0.12;
          float _crownOn = step(0.6, hash21(vec2(gSeedG * 3.3, 1.7))) * step(60.0, gVH);
          float _crown = smoothstep(gVH - 16.0, gVH - 1.0, gYB) * _crownOn;
          vec3 _crownCol = mix(vec3(1.0, 0.86, 0.66), vec3(0.75, 0.85, 1.0), step(0.8, hash21(vec2(gSeedG, 4.4))));
          vec3 _lift = vec3(1.0, 0.74, 0.48) * _street + vec3(0.50, 0.60, 0.85) * 0.03 + _crownCol * _crown * 0.22;
          totalEmissiveRadiance += gWallCol * _lift * uNight;
        }`,
      )
  }
  mat.customProgramCacheKey = () => `facade-${style}${cyl ? '-cyl' : ''}${upper ? '-up' : ''}-v38`
  return mat
}

/** 坡屋顶三棱柱：x∈[-.5,.5] y∈[-.5,.5] z∈[-.5,.5]，屋脊沿 z */
function makeGableGeo() {
  const sh = new THREE.Shape()
  sh.moveTo(-0.5, -0.5)
  sh.lineTo(0.5, -0.5)
  sh.lineTo(0, 0.5)
  sh.lineTo(-0.5, -0.5)
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false })
  geo.translate(0, 0, -0.5)
  return geo
}

function makeRoofMat(hex) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.92,
    metalness: 0.08,
    envMapIntensity: 0.35,
  })
}

export function buildBuildings(plan, seed = 77) {
  // 调试：globalThis.__ZZ_OVL=true 时记录每个实例所属的「宗地组」，供重叠检查脚本用（正常运行零开销）
  const DBG_OVL = !!globalThis.__ZZ_OVL
  const g = new THREE.Group()
  g.name = 'buildings'
  const rng = mulberry(seed)
  const boxGeo = new THREE.BoxGeometry(1, 1, 1)
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 40)
  const dummy = new THREE.Object3D()

  const wallMats = new Map()
  const roofMats = new Map()
  const wallPools = new Map()
  const roofPools = new Map()
  const cylPools = new Map()

  // ── 分块实例池 ──────────────────────────────────────────────────────────
  // 整城一份 InstancedMesh 的代价是：不管镜头对着哪，几百万个实例都要过一遍顶点
  // 着色器（60M 三角 = 每秒十几亿次顶点运算，这就是「好卡」的根因）。
  // 现在按 250m 分块记录，建完再逐块生成 InstancedMesh：
  //   · 结构（墙/屋顶）分块后吃 frustum culling；
  //   · 细节（窗套/玻璃/店厢…）额外按视距裁剪，远处由立面 shader 的窗接管。
  // 细节池分块 + 视距裁剪；结构池（墙/屋顶）保持整城一份，靠 frustum culling
  const CHUNK = 600
  const DETAIL_DIST = 260
  const chunkOf = (x, z) => `${Math.floor(x / CHUNK)}|${Math.floor(z / CHUNK)}`
  const chunkCenter = (key) => {
    const i = key.indexOf('|')
    return [(Number(key.slice(0, i)) + 0.5) * CHUNK, (Number(key.slice(i + 1)) + 0.5) * CHUNK]
  }
  const paneCols = [
    new THREE.Color(0.72, 0.76, 0.8),
    new THREE.Color(1.12, 1.14, 1.16),
    new THREE.Color(0.84, 0.78, 0.7),
    new THREE.Color(0.95, 0.97, 1.0),
    new THREE.Color(1, 1, 1),
  ]

  /** 记录型实例池；lod=0 表示不按距离裁（结构体）。每个槽 8 个 float：pos/scale/yaw/colorIdx */
  function newPool(geo, mat, lod = DETAIL_DIST) {
    return { geo, mat, material: mat, lod, recs: new Map(), n: 0 }
  }

  function wallPool(hex, style, upper = false) {
    const key = `${hex}:${style}${upper ? ':up' : ''}`
    let inst = wallPools.get(key)
    if (!inst) {
      let mat = wallMats.get(key)
      if (!mat) {
        mat = makeWallMat(hex, style, false, upper)
        wallMats.set(key, mat)
        Mat.registerMaterial(mat)
      }
      inst = newPool(boxGeo, mat, 0)
      inst.trackG = 'wall'
      inst.struct = true
      wallPools.set(key, inst)
    }
    return inst
  }

  function roofPool(hex) {
    let inst = roofPools.get(hex)
    if (!inst) {
      let mat = roofMats.get(hex)
      if (!mat) {
        mat = makeRoofMat(hex)
        roofMats.set(hex, mat)
        Mat.registerMaterial(mat)
      }
      inst = newPool(boxGeo, mat, 0)
      inst.trackG = 'decor'
      inst.struct = true
      roofPools.set(hex, inst)
    }
    return inst
  }

  // 圆柱楼的屋顶也要是圆的（以前是方盒子扣在圆柱上，边缘对不上）
  function roofCylPool(hex) {
    const key = `${hex}:roof`
    let inst = cylPools.get(key)
    if (!inst) {
      const mat = makeRoofMat(hex)
      Mat.registerMaterial(mat)
      inst = newPool(cylGeo, mat, 0)
      inst.trackG = 'decor'
      inst.struct = true
      cylPools.set(key, inst)
    }
    return inst
  }
  const cylList = []
  function cylPool(hex) {
    const key = `${hex}:curtain`
    let inst = cylPools.get(key)
    if (!inst) {
      const mat = makeWallMat(hex, 'curtain', true)
      Mat.registerMaterial(mat)
      inst = newPool(cylGeo, mat, 0)
      inst.trackG = 'wall'
      inst.struct = true
      cylPools.set(key, inst)
    }
    return inst
  }

  function makePool(color, metal, rough, cap, env = 0.7, opts = {}) {
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: rough, metalness: metal, envMapIntensity: env,
      transparent: !!opts.transparent,
      opacity: opts.opacity ?? 1,
      depthWrite: opts.transparent ? false : true,
      emissive: opts.emissive || '#000000',
      emissiveIntensity: opts.emissiveIntensity || 0,
    })
    Mat.registerMaterial(mat)
    return newPool(opts.geo || boxGeo, mat, opts.lod ?? DETAIL_DIST)
  }

  const balcony = makePool('#b0aaa0', 0.08, 0.86, 30_000, 0.45)
  const rail = makePool('#5a6570', 0.7, 0.35, 30_000, 0.9)
  const canopy = makePool('#2e343c', 0.5, 0.45, 12_000, 0.7)
  const mech = makePool('#5a626a', 0.28, 0.62, 40_000, 0.55, { lod: 0 })
  const accent = makePool('#8a949e', 0.4, 0.45, 12_000, 0.7, { lod: 0 })
  // 几何立面：层间板 / 窗台 / 竖挺 / 暗玻璃凸片
  const band = makePool('#a89e90', 0.05, 0.88, 380_000, 0.35)
  const sill = makePool('#b8aea0', 0.08, 0.82, 1_100_000, 0.4)
  const mull = makePool('#5a6068', 0.45, 0.4, 900_000, 0.85)
  const pane = makePool('#7d8f9c', 0.22, 0.32, 620_000, 0.75, { transparent: true, opacity: 0.16 })
  // 夜间亮窗：近处几何窗三态（暗 / 暖亮 / 冷亮），白天同色
  const paneWarm = makePool('#7d8f9c', 0.22, 0.32, 200_000, 0.75, { transparent: true, opacity: 0.16 })
  const paneWarmDim = makePool('#7d8f9c', 0.22, 0.32, 120_000, 0.75, { transparent: true, opacity: 0.16 })
  const paneCool = makePool('#7d8f9c', 0.22, 0.32, 130_000, 0.75, { transparent: true, opacity: 0.16 })
  Mat.registerNight(paneWarm.material, 0, 0)
  Mat.registerNight(paneWarmDim.material, 0, 0)
  Mat.registerNight(paneCool.material, 0, 0)
  // 航空障碍灯：高楼屋顶/天线顶的小红灯
  const beacon = makePool('#5a1410', 0.1, 0.6, 20_000, 0.2, { emissive: '#ff2a18', emissiveIntensity: 0.2, lod: 0 })
  Mat.registerNight(beacon.material, 0.2, 3.2)
  // 窗洞侧壁（退进阴影），近看才不像贴纸
  const jamb = makePool('#6a6058', 0.12, 0.78, 400_000, 0.4)
  // 整套窗套（框 + 中梃）一个实例；分几色，避免整城窗框一个颜色
  const winFrameGeo = makeWinFrameGeo(0.075)
  const FRAME_COLS = ['#6a6058', '#4a4a4c', '#8a8074', '#d8d0c2', '#3c3a38']
  const winFramePools = FRAME_COLS.map((c) => {
    const mat = new THREE.MeshStandardMaterial({
      color: c, roughness: 0.72, metalness: 0.18, envMapIntensity: 0.45,
    })
    Mat.registerMaterial(mat)
    return newPool(winFrameGeo, mat, DETAIL_DIST)
  })
  // 檐口 / 女儿墙压顶 / 落水管 / 空调机：把盒子楼拉出真实轮廓
  const cornice = makePool('#cfc4b0', 0.05, 0.86, 90_000, 0.32, { lod: 0 })
  const pipe = makePool('#6a7078', 0.5, 0.42, 60_000, 0.7)
  const acUnit = makePool('#c4ccd4', 0.28, 0.5, 80_000, 0.55)
  const acGrill = makePool('#78828c', 0.4, 0.5, 80_000, 0.6)
  // 沿街店面：彩棚 / 招牌 / 门框 / 暖橱窗
  const AWNING_COLS = ['#8a2a28', '#2a4a6a', '#3a6a48', '#c09030', '#5a3a68', '#2e343c', '#a84828']
  const SIGN_COLS = ['#1a1e24', '#2a3038', '#8a1a18', '#1a3a5a', '#d8d0c0']
  const awningPools = AWNING_COLS.map((c) => makePool(c, 0.15, 0.82, 40_000, 0.4))
  // 招牌是夜间最亮的一层：灯箱面在夜里自己发光
  const signPools = SIGN_COLS.map((c) => {
    const inst = makePool(c, 0.2, 0.7, 30_000, 0.5, { emissive: c, emissiveIntensity: 0.04 })
    Mat.registerNight(inst.material, 0.04, 1.35)
    return inst
  })
  const door = makePool('#3a2e28', 0.1, 0.75, 120_000, 0.4)
  // 半透明玻璃：能看见店厢进深，不再是一块实心蓝贴片
  const doorGlass = makePool('#7d8f9c', 0.2, 0.18, 140_000, 0.9, { transparent: true, opacity: 0.35 })
  const shopGlass = makePool('#7d8f9c', 0.2, 0.18, 200_000, 0.9, { transparent: true, opacity: 0.12 })
  // 橱窗玻璃三色：一条街的橱窗不要全是同一种灰（那正是「贴图」的来源）
  const shopGlassPools = [shopGlass]
  for (const c of ['#87979e', '#6f828a']) {
    const inst = makePool(c, 0.2, 0.18, 90_000, 0.9, { transparent: true, opacity: 0.14 })
    shopGlassPools.push(inst)
  }
  // 店内背景板：玻璃后面能看到不同的墙色 / 陈列，而不是一块均匀灰面
  const BACK_COLS = ['#c9a882', '#8f7f6d', '#b7c2c0', '#a88f8a', '#d6ccb4', '#b5887a']
  const backPools = BACK_COLS.map((c) => makePool(c, 0.03, 0.85, 50_000, 0.35))
  const matPool = makePool('#2c2824', 0.05, 0.9, 140_000, 0.3)
  // 店面框料（门左 / 门右 两套几何），整间店一个实例
  // [门左/门右] × [外挂店厢 / 内嵌店厢]
  const shopFrameMat = new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.6, metalness: 0.25, envMapIntensity: 0.5 })
  Mat.registerMaterial(shopFrameMat)
  const shopFramePools = [true, false].map((doorLeft) => [1.02, 0.06].map((fr) => newPool(makeShopFrameGeo(doorLeft, fr), shopFrameMat, DETAIL_DIST)))
  // 金属檐口雨棚（与布棚区分）
  const canopyPools = ['#4a4e52', '#3a3c40', '#6a6e72', '#5a4a40'].map((c) => makePool(c, 0.4, 0.5, 30_000, 0.7))
  const pillar = makePool('#9a8e7e', 0.04, 0.9, 340_000, 0.3)
  // 一层专用框料（与上层 dressFacade 的 sill/mull/band/pane 隔离，防抢配额）
  const stMull = makePool('#6a7078', 0.45, 0.4, 460_000, 0.7)
  const stHandle = makePool('#c0c8d0', 0.7, 0.28, 120_000, 0.9)
  // 店面框料/壁柱也要分色：整条街清一色白框，是另一种「贴图感」
  const stFramePools = ['#e8e2d8', '#d6c9b2', '#6a6e74', '#8a6a4a', '#c8b8a0']
    .map((c) => makePool(c, 0.06, 0.8, 220_000, 0.35))
  const pilPools = ['#9a8e7e', '#bcb09e', '#6c645a', '#8e7a66', '#a89880']
    .map((c) => makePool(c, 0.05, 0.88, 120_000, 0.3))
  const kickPools = ['#6a6054', '#4a4640', '#8a7a66', '#5c5248']
    .map((c) => makePool(c, 0.08, 0.86, 120_000, 0.3))
  // 店厢内景（外挂在立面外，不被实心楼体吞掉）
  // 店内件：夜里按店内灯光自发光（不靠场景光，否则夜里店里一片黑）
  const litPool = (c, k = 0.38, rough = 0.8, lod = DETAIL_DIST) => {
    const p = makePool(c, 0.05, rough, 0, 0.3, { emissive: c, lod })
    Mat.registerNight(p.material, 0.0, k)
    return p
  }
  const roomFloor = litPool('#c8bda8', 0.3)
  const roomWall = litPool('#e8e0d4', 0.34)
  const roomCeil = litPool('#f0ebe2', 0.4)
  const shelfP = litPool('#efece6', 0.36)
  const woodP = litPool('#9a7452', 0.34)
  const darkP = litPool('#3a3632', 0.2)
  // 货品：低饱和的柔和色 + 只在 45m 内绘制（远看是一地五颜六色的碎屑，像地面很脏）
  const SMALL_DIST = 45
  const goodsP = ['#a8867e', '#b8a887', '#8c9c95', '#8e9aa8', '#a08672', '#9aa38c', '#a8909c', '#d8d2c6'].map((c) => litPool(c, 0.2, 0.75, SMALL_DIST))
  const caseGlass = makePool('#c8dce4', 0.1, 0.1, 0, 0.9, { transparent: true, opacity: 0.22 })
  const shelf = makePool('#8a7a68', 0.05, 0.85, 200_000, 0.3)
  const goods = makePool('#d8c8a8', 0.04, 0.7, 120_000, 0.35, { emissive: '#ffe4c0', emissiveIntensity: 0.12 })
  const counter = makePool('#6a5a48', 0.08, 0.8, 40_000, 0.3)
  const roomLight = makePool('#fff4e0', 0.0, 0.4, 120_000, 0.2, { emissive: '#ffe8c0', emissiveIntensity: 1.1 })
  Mat.registerNight(roomLight.material, 0.55, 2.4)
  const GOODS_COLS = ['#e15a72', '#f2c14e', '#54b3a6', '#6aa6d8', '#c9744a', '#f0f2f4', '#9ac47a', '#d68fb5']
  const goodsPools = GOODS_COLS.map((c) => {
    const inst = makePool(c, 0.04, 0.65, 60_000, 0.3, { emissive: c, emissiveIntensity: 0.15 })
    Mat.registerNight(inst.material, 0.06, 0.34)
    return inst
  })
  // 夜间橱窗内的重点陈列 / 海报灯片
  const displayGlow = makePool('#ffe8c0', 0.0, 0.55, 120_000, 0.2, { emissive: '#ffdba6', emissiveIntensity: 0.2 })
  Mat.registerNight(displayGlow.material, 0.08, 1.5)
  // 俯瞰屋顶色块（多色池，避免整城同一绿）
  const roofGreenPools = ROOF_GREEN.map((c) => makePool(c, 0.02, 0.95, 8_000, 0.25, { lod: 0 }))
  const roofDeckPools = ROOF_TERRACE.map((c) => makePool(c, 0.04, 0.9, 8_000, 0.35, { lod: 0 }))
  const parapet = makePool('#6a6560', 0.08, 0.88, 40_000, 0.4, { lod: 0 })
  // ── 店铺类型：招牌 / 挑灯箱 / 店内背景画 / 雨棚 各一套（一种店一个池） ──
  const planeGeo = new THREE.PlaneGeometry(1, 1)
  const shopTypes = Signs.SHOP_TYPES.map((t, i) => ({
    t,
    sign: newPool(t.style === 'letters' ? planeGeo : boxGeo, Signs.signMaterial(t), 220),
    // 挑灯箱 / 店内背景画只在近处看得清：视距收短（少几十个 draw）
    blade: newPool(boxGeo, Signs.bladeMaterial(t), 190),
    back: newPool(boxGeo, Signs.backdropMaterial(t, i), 140),
    awn: makePool(t.awning, 0.12, 0.8, 40_000, 0.4),
  }))
  const plates = [0, 1, 2, 3].map((i) => newPool(boxGeo, Signs.plateMaterial(i), DETAIL_DIST))
  // 跑马灯字幕条（贴图横向滚动）
  const ledMats = Array.from({ length: Signs.LED_COUNT }, (_, i) => Signs.ledMaterial(i))
  const ledPools = ledMats.map((m) => newPool(boxGeo, m.mat, DETAIL_DIST))
  // 巨型广告牌（远处也可见：lod 0）
  const adPools = Array.from({ length: Signs.AD_COUNT }, (_, i) => newPool(boxGeo, Signs.adMaterial(i), 0))
  const billFrame = makePool('#3a3e44', 0.6, 0.5, 0, 0.6, { lod: 0 })
  const billLamp = makePool('#fff4e0', 0.0, 0.4, 0, 0.2, { emissive: '#ffe8c0', lod: 0 })
  Mat.registerNight(billLamp.material, 0.1, 2.6)
  // 门外设施 / 店内补充材质
  const outWood = makePool('#8a6a48', 0.02, 0.85, 0, 0.3, { lod: 90 })
  const outDark = makePool('#2e2e30', 0.3, 0.6, 0, 0.5, { lod: 90 })
  const outWhite = makePool('#f2f0ea', 0.05, 0.6, 0, 0.4, { lod: 90 })
  const bikeY = makePool('#c9a640', 0.4, 0.4, 0, 0.5, { lod: 70 })
  const bikeB = makePool('#3f7fb8', 0.4, 0.4, 0, 0.5, { lod: 70 })
  const whiteCtr = litPool('#f4f2ee', 0.3, 0.5)
  const steelP = litPool('#a8b0b8', 0.25, 0.35)
  // 坡屋顶 / 水箱
  const gableGeo = makeGableGeo()
  const gablePools = ['#8a3b2c', '#5a5450', '#6b4a3a', '#3f4a52', '#9a5a3a'].map((c) => makePool(c, 0.05, 0.82, 20_000, 0.3, { geo: gableGeo, lod: 0 }))
  // 水箱用 10 段低模圆柱（以前和圆柱楼共用 40 段几何，几千个水箱就是几十万三角）
  const tank = makePool('#8a7560', 0.1, 0.8, 8_000, 0.3, { geo: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), lod: 0 })
  const lawn = makePool('#6f9a57', 0.0, 0.95, 0, 0.3, { lod: 0 })
  const hedge = makePool('#3d6935', 0.0, 0.95, 0, 0.3)
  const fence = makePool('#ebe7de', 0.05, 0.7, 0, 0.5)
  const pave = makePool('#bdb6aa', 0.02, 0.9, 0, 0.4, { lod: 0 })
  const barPave = makePool('#6e6660', 0.02, 0.85, 0, 0.4, { lod: 0 })
  const bollardP = makePool('#8a9098', 0.7, 0.35, 0, 0.8)
  const tarmac = makePool('#3d3f42', 0.02, 0.92, 0, 0.3, { lod: 0 })
  const pitchG = makePool('#3f8a46', 0.0, 0.95, 0, 0.3, { lod: 0 })
  const trackR = makePool('#b5523b', 0.0, 0.92, 0, 0.3, { lod: 0 })
  const courtB = makePool('#3a6ea5', 0.0, 0.9, 0, 0.3, { lod: 0 })
  const lineW = makePool('#f2f2ee', 0.0, 0.8, 0, 0.4, { lod: 0 })
  const ringGeo = new THREE.RingGeometry(0.93, 1, 48)
  ringGeo.rotateX(-Math.PI / 2)
  const lineRing = makePool('#f2f2ee', 0.0, 0.8, 0, 0.4, { lod: 0, geo: ringGeo })
  const redP = makePool('#d0202a', 0.1, 0.6, 0, 0.5, { emissive: '#ff2a30' })
  Mat.registerNight(redP.material, 0, 0.9)
  const whiteP = makePool('#f2f2f0', 0.1, 0.5, 0, 0.5)
  const villaWin = makePool('#27313b', 0.3, 0.25, 0, 0.9)
  const villaWinLit = makePool('#3b3326', 0.1, 0.4, 0, 0.5, { emissive: '#ffcf96' })
  Mat.registerNight(villaWinLit.material, 0, 0.85)
  const villaWater = makePool('#2f9cc4', 0.1, 0.08, 0, 1.2, { emissive: '#1d7fa8' })
  Mat.registerNight(villaWater.material, 0.05, 0.7)
  const villaWood = makePool('#8a6a48', 0.02, 0.85, 0, 0.3)
  const timber = makePool('#3a2a20', 0.02, 0.85, 0, 0.3)
  const brickP = makePool('#8a4a3a', 0.02, 0.9, 0, 0.3)
  const wallGrey = makePool('#8e8c88', 0.02, 0.9, 0, 0.3)
  const soilP = makePool('#5a4636', 0.0, 0.98, 0, 0.2, { lod: 0 })
  // 花：颜色收一点，只近处画（远处是彩色噪点）
  const flowerPools = ['#c86a80', '#d8b860', '#ece8e0', '#9a78b8', '#d8875a'].map((c) => makePool(c, 0.0, 0.8, 0, 0.3, { lod: 70 }))
  const carPools = ['#c9ccd1', '#1f2328', '#8a1c1c', '#2a4f8a', '#e8e8e6', '#5b6066'].map((c) => makePool(c, 0.5, 0.35, 0, 0.8))
  const crossP = newPool(boxGeo, Signs.crossMaterial(), 0)
  const boards = {}
  for (const k of ['hospital', 'emergency', 'school', 'gas', 'parking', 'gym', 'stadium', 'library', 'arena', 'museum', 'cinema', 'busterm', 'police', 'fire', 'post', 'hotel', 'market', 'temple', 'church', 'office', 'walkst', 'barst', 'anime', 'oldtown', 'bike', 'mall', 'metro', 'gov', 'farmers', 'garage']) boards[k] = newPool(boxGeo, Signs.facilityMaterial(k === 'busterm' ? 'bus' : k), 0)
  const cylLed = makePool('#ff3fa4', 0.2, 0.5, 0, 0.5, { emissive: '#ff3fa4', geo: cylGeo, lod: 0 })
  const neonC = makePool('#38e8ff', 0.2, 0.5, 0, 0.5, { emissive: '#38e8ff', lod: 0 })
  Mat.registerNight(neonC.material, 0.3, 2.4)
  Mat.registerNight(cylLed.material, 0.3, 2.4)
  const extraPools = [cylLed, neonC, villaWater, villaWood, timber, brickP, wallGrey, soilP, ...flowerPools, lawn, hedge, fence, pave, barPave, bollardP, tarmac, pitchG, trackR, courtB, lineW, lineRing, redP, whiteP, villaWin, villaWinLit, ...carPools, crossP, ...Object.values(boards)]
  const shopTypePools = [...shopTypes.flatMap((s) => [s.sign, s.blade, s.back, s.awn]), ...plates, ...ledPools, ...adPools, billFrame, billLamp, outWood, outDark, outWhite, bikeY, bikeB, whiteCtr, steelP, ...gablePools, tank]
  // 外挑件：记录所属宗地组，最后统一与「别家的楼体」做 3D 相交裁剪（屋面板/檐口/女儿墙/阳台/雨棚/空调…）
  const DECOR_POOLS = [balcony, rail, canopy, mech, accent, beacon, cornice, pipe, acUnit, acGrill, parapet, tank, pillar,
    ...awningPools, ...canopyPools, ...gablePools, ...signPools, ...roofGreenPools, ...roofDeckPools, ...shopTypes.flatMap((s) => [s.blade, s.awn, s.sign])]
  for (const p of DECOR_POOLS) p.trackG = 'decor'
  const shopSpots = []
  let forceGable = false
  let curDistrict = null
  let curBlockB = null // 当前地块（判断某个立面是否真的临街）
  let gableIdx = -1
  let gableK = 0
  // ── 防穿插：每次「落一宗地」是一个组；不同组的体量在平面上部分相交（非包含）且高度重叠 → 后来者不建 ──
  // ── 城市设计件：异形塔冠 / 天桥 / 地铁口 / 商场中庭 ──
  const spireP = makePool('#c8ccd2', 0.85, 0.28, 0, 1.0, { geo: cylGeo, lod: 0 })
  const crownGlow = makePool('#d6e2ec', 0.3, 0.2, 0, 0.9, { emissive: '#d8ecff', lod: 0 })
  Mat.registerNight(crownGlow.mat, 0.0, 1.3)
  const glassPortal = makePool('#8fa6b4', 0.45, 0.14, 0, 1.1, { emissive: '#ffe0b0', lod: 0 })
  Mat.registerNight(glassPortal.mat, 0.0, 0.85)
  const treadP = makePool('#3c4046', 0.5, 0.4, 0, 0.6)
  const stoneStep = makePool('#cfc6b6', 0.03, 0.88, 0, 0.4, { lod: 0 })
  // ── Round 9：新设施用的池（加入 allPools）──
  const latePools = []
  const LP = (c, m, r, env = 0.6, o = {}) => { const p = makePool(c, m, r, 0, env, o); latePools.push(p); return p }
  const redWall = LP('#a8402e', 0.03, 0.85, 0.3, { lod: 0 })
  const tileGrey = LP('#4a4a4c', 0.1, 0.7, 0.4, { lod: 0 })
  const goldP = LP('#c8a048', 0.6, 0.35, 0.8, { lod: 0 })
  const tennisG = LP('#4f7f5e', 0, 0.9, 0.3)
  const tennisB = LP('#3a6a9a', 0, 0.9, 0.3)
  const fenceMesh = LP('#4a5a50', 0.3, 0.6, 0.5, { transparent: true, opacity: 0.32 })
  const stallP = LP('#b89a6a', 0.02, 0.8, 0.3)
  const crateP = ['#9a7a4a', '#7a8a4a', '#a86a4a', '#8a8a6a', '#a89a5a'].map((c) => LP(c, 0, 0.85, 0.3, { lod: 70 }))
  const louvre = LP('#a8b0b6', 0.6, 0.4, 0.8)
  const truckRed = LP('#c8202a', 0.4, 0.4, 0.7)
  const truckWhite = LP('#eceae6', 0.3, 0.45, 0.6)
  const pitDark = LP('#1c1d20', 0.1, 0.9, 0.2, { lod: 0 })
  const glassDrum = LP('#8fa6b4', 0.45, 0.14, 1.1, { geo: cylGeo, emissive: '#ffe0b0', lod: 0 })
  Mat.registerNight(glassDrum.mat, 0.0, 0.8)
  const bridgeDeck = stoneStep
  const designPools = [spireP, crownGlow, glassPortal, treadP, stoneStep]
  let curGrp = 0
  const claimGrid = new Map()
  const CLAIM = 40
  const skippedAt = new Set()
  const kxz = (x, z) => Math.round(x * 10) + ',' + Math.round(z * 10)
  const adjusted = new Map()
  const wallAt = new Map()
  function claimHit(a) {
    const i0 = Math.floor(a.x0 / CLAIM), i1 = Math.floor(a.x1 / CLAIM)
    const j0 = Math.floor(a.z0 / CLAIM), j1 = Math.floor(a.z1 / CLAIM)
    const e = 0.05
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const arr = claimGrid.get(i * 100003 + j)
      if (!arr) continue
      for (const o of arr) {
        // 同组比较墙体本身（core），不同组比较含屋面板/檐口外挑的扩展盒
        const sg = o.g === a.g
        // 楼间距（采光）：两栋都是高层时，不同组之间至少留 max(sp) 的间距
        const gp = !sg && a.sp > 0 && o.sp > 0 ? Math.max(a.sp, o.sp) : 0
        const am = sg ? a.mx : -gp
        const an = sg ? a.mz : -gp
        const om = sg ? o.mx : 0
        const on = sg ? o.mz : 0
        const ax0 = a.x0 + am, ax1 = a.x1 - am, az0 = a.z0 + an, az1 = a.z1 - an
        const bx0 = o.x0 + om, bx1 = o.x1 - om, bz0 = o.z0 + on, bz1 = o.z1 - on
        const ox = Math.min(ax1, bx1) - Math.max(ax0, bx0)
        const oz = Math.min(az1, bz1) - Math.max(az0, bz0)
        const oy = Math.min(sg ? a.cy1 : a.y1, sg ? o.cy1 : o.y1) - Math.max(a.y0, o.y0)
        if (ox < (sg ? 0.05 : 0.02) || oz < (sg ? 0.05 : 0.02) || oy < (sg ? 0.3 : 0.05)) continue
        const aIn = ax0 >= bx0 - e && ax1 <= bx1 + e && az0 >= bz0 - e && az1 <= bz1 + e
        const oIn = bx0 >= ax0 - e && bx1 <= ax1 + e && bz0 >= az0 - e && bz1 <= az1 + e
        // 同组允许「包含」（裙房上的塔楼）；不同组连包含也不行
        if (o.g === a.g && (aIn || oIn)) continue
        return o
      }
    }
    return null
  }
  /** 不同组的体量部分相交 → 先尝试沿相交较浅的一边退让收缩（保留 ≥55% 面积、短边 ≥8m），不行才放弃 */
  function claimBox(x, z, w, d, y0, y1, mx = 0, mz = 0, cy1 = y1, sp = 0) {
    const a = { g: curGrp, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0, y1, mx, mz, cy1, sp }
    for (let it = 0; it < 4; it++) {
      const o = claimHit(a)
      if (!o) break
      const sg = o.g === a.g
      const gap = sg ? 0 : 0.3 + (a.sp > 0 && o.sp > 0 ? Math.max(a.sp, o.sp) : 0)
      // 同组：两者墙体贴齐（core 对 core）；不同组：扩展盒之间留缝
      const ox0 = sg ? o.x0 + o.mx - a.mx : o.x0
      const ox1 = sg ? o.x1 - o.mx + a.mx : o.x1
      const oz0 = sg ? o.z0 + o.mz - a.mz : o.z0
      const oz1 = sg ? o.z1 - o.mz + a.mz : o.z1
      const opts = []
      if (ox1 < a.x1 && ox1 > a.x0) opts.push({ ...a, x0: ox1 + gap })
      if (ox0 > a.x0 && ox0 < a.x1) opts.push({ ...a, x1: ox0 - gap })
      if (oz1 < a.z1 && oz1 > a.z0) opts.push({ ...a, z0: oz1 + gap })
      if (oz0 > a.z0 && oz0 < a.z1) opts.push({ ...a, z1: oz0 - gap })
      let best = null
      let bestA = 0
      for (const c of opts) {
        const cw = c.x1 - c.x0 - 2 * a.mx
        const cd = c.z1 - c.z0 - 2 * a.mz
        if (cw < 8 || cd < 8) continue
        if (cw * cd > bestA) { bestA = cw * cd; best = c }
      }
      if (!best || bestA < (w - 2 * mx) * (d - 2 * mz) * 0.55) return null
      Object.assign(a, best)
    }
    if (claimHit(a)) return null
    const i0 = Math.floor(a.x0 / CLAIM), i1 = Math.floor(a.x1 / CLAIM)
    const j0 = Math.floor(a.z0 / CLAIM), j1 = Math.floor(a.z1 / CLAIM)
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = i * 100003 + j
      let arr = claimGrid.get(k)
      if (!arr) claimGrid.set(k, (arr = []))
      arr.push(a)
    }
    return { x: (a.x0 + a.x1) / 2, z: (a.z0 + a.z1) / 2, w: a.x1 - a.x0 - 2 * mx, d: a.z1 - a.z0 - 2 * mz }
  }
  const pickPool = (pools) => pools[(rng() * pools.length) | 0]
  // 近距几何窗按概率分到暗/暖亮/冷亮三个池，夜里同一面墙有明有暗
  const panePick = () => {
    const r = rng()
    // 玻璃交给立面 shader（凹窗+室内）；几何玻璃片半透明排序会闪、白天色块不一
    return r < 0 ? pane : null
  }
  // 窗套按楼选色，同一栋楼内再留一点随机
  const framePick = () => {
    const r = rng()
    return r < 0.5 ? winFramePools[0] : r < 0.74 ? winFramePools[1]
      : r < 0.88 ? winFramePools[2] : r < 0.96 ? winFramePools[3] : winFramePools[4]
  }
  // 窗套几何是「局部 z 向墙外」的，用 yaw 转到对应立面
  function pushFrame(inst, x, y, z, w, h, depth, yaw) {
    return push(inst, x, y, z, w, h, depth, yaw)
  }
  /** 往分块记录里塞一个实例；返回记录（真值），池满时返回 null */
  function push(pool, x, y, z, sx, sy, sz, yaw = 0) {
    if (!pool) return null
    const key = chunkOf(x, z)
    let r = pool.recs.get(key)
    if (!r) {
      r = { buf: new Float32Array(8 * 128), n: 0, col: null, gs: pool.trackG ? [] : null }
      pool.recs.set(key, r)
    }
    if (r.gs) r.gs.push(curGrp)
    if ((r.n + 1) * 8 > r.buf.length) {
      const nb = new Float32Array(r.buf.length * 2)
      nb.set(r.buf)
      r.buf = nb
      if (r.col) {
        const nc = new Uint8Array(nb.length / 8).fill(255)
        nc.set(r.col)
        r.col = nc
      }
    }
    const o = r.n * 8
    const b = r.buf
    b[o] = x; b[o + 1] = y; b[o + 2] = z
    b[o + 3] = sx; b[o + 4] = sy; b[o + 5] = sz; b[o + 6] = yaw; b[o + 7] = -1
    r.n++
    pool.n++
    return r
  }

  // 白天也不能整墙同色：每块玻璃再叠一层逐实例色差（玻璃深浅、窗帘、反光）
  function pushPane(pool, x, y, z, sx, sy, sz, yaw = 0) {
    const r = push(pool, x, y, z, sx, sy, sz, yaw)
    if (!r) return
    if (!r.col) r.col = new Uint8Array(r.buf.length / 8).fill(255)
    const v = rng()
    r.col[r.n - 1] = v < 0.14 ? 0 : v < 0.3 ? 1 : v < 0.44 ? 2 : v < 0.56 ? 3 : 4
  }

  // ── 刚体（碰撞体）：与 block/kit.solid 同语义 ──
  // { x,z,w,d,y,base }；按 100m 分块查询，5km 城也能走路撞墙
  const SOLID_CELL = 100
  const solidChunks = new Map()
  function addSolid(x, z, w, d, yTop, yBase = SURFACE, yaw = 0) {
    let aw = w
    let ad = d
    if (yaw) {
      const c = Math.abs(Math.cos(yaw))
      const s = Math.abs(Math.sin(yaw))
      aw = w * c + d * s
      ad = w * s + d * c
    }
    const s = { x, z, w: aw, d: ad, y: yTop, base: yBase }
    const i0 = Math.floor((x - aw / 2) / SOLID_CELL)
    const i1 = Math.floor((x + aw / 2) / SOLID_CELL)
    const j0 = Math.floor((z - ad / 2) / SOLID_CELL)
    const j1 = Math.floor((z + ad / 2) / SOLID_CELL)
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const key = (i + 32768) * 65536 + (j + 32768)
        let arr = solidChunks.get(key)
        if (!arr) { arr = []; solidChunks.set(key, arr) }
        arr.push(s)
      }
    }
  }
  // 每帧会被物理调用多次：不再分配数组/Set/字符串（GC 卡顿源），用盖章去重 + 复用输出数组
  let qStamp = 0
  const qOut = []
  function querySolids(x, z) {
    const cx = Math.floor(x / SOLID_CELL)
    const cz = Math.floor(z / SOLID_CELL)
    qOut.length = 0
    qStamp++
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cz - 1; j <= cz + 1; j++) {
        const arr = solidChunks.get((i + 32768) * 65536 + (j + 32768))
        if (!arr) continue
        for (let k = 0; k < arr.length; k++) {
          const s = arr[k]
          if (s._q === qStamp) continue
          s._q = qStamp
          qOut.push(s)
        }
      }
    }
    return qOut
  }

  // 一层占地：用来判断哪面贴着邻楼（分户墙不开店）
  const groundPrints = []
  function regPrint(x, z, w, d) {
    groundPrints.push({ x, z, w, d })
  }
  /** 该法线方向外侧间隙 < minGap 则视为贴邻楼 */
  function faceBlocked(cx, cz, w, d, nx, nz, minGap = 3.2) {
    const hw = w / 2
    const hd = d / 2
    for (const o of groundPrints) {
      if (Math.abs(o.x - cx) < 0.4 && Math.abs(o.z - cz) < 0.4) continue
      if (nx !== 0) {
        if (Math.abs(o.z - cz) * 2 >= (o.d + d) * 0.82) continue
        const gap = nx > 0 ? (o.x - o.w / 2) - (cx + hw) : (cx - hw) - (o.x + o.w / 2)
        if (gap < minGap && gap > -Math.min(hw, o.w / 2)) return true
      } else if (nz !== 0) {
        if (Math.abs(o.x - cx) * 2 >= (o.w + w) * 0.82) continue
        const gap = nz > 0 ? (o.z - o.d / 2) - (cz + hd) : (cz - hd) - (o.z + o.d / 2)
        if (gap < minGap && gap > -Math.min(hd, o.d / 2)) return true
      }
    }
    return false
  }

  /** 墙体盒子 + 俯瞰可读屋顶；yaw 打散朝向 */
  let roofJit = 0
  function pushBuilding(hex, style, x, y, z, w, h, d, yaw = 0) {
    // 旋转过的楼体，其檐口/女儿墙/店面/上段都不跟着转 → 看起来歪了。统一正交
    yaw = 0
    // 相邻/相交楼块的屋顶同高会共面闪烁：每栋错开几厘米
    roofJit = (roofJit + 1) % 5
    // 兜底：退台/裙房计算出的退化体量不再生成（否则墙薄到看不见，
    // 只剩同一材质的深色屋顶板浮在空中，看起来就是「这栋楼没有墙」）
    if (!(Math.min(w, h, d) > 1.5)) return
    const _k0 = kxz(x, z)
    const _w0 = w
    const _d0 = d
    // 屋面板 ×1.06、檐口 +0.37、女儿墙外挑：一并占位，邻楼的屋檐不再互相穿插
    const ovx = Math.max(0.03 * w + 0.14, 0.4)
    const ovz = Math.max(0.03 * d + 0.14, 0.4)
    // 高层住宅之间留足采光间距（约 0.3 倍楼高，12~30m）；写字楼 6m；多层/裙房不限
    const sp = h > 58 && style !== 'podium' ? (style === 'curtain' ? 6 : Math.min(30, Math.max(12, h * 0.3))) : 0
    const cb = claimBox(x, z, w + 2 * ovx, d + 2 * ovz, y - h / 2, y + h / 2 + 4, ovx, ovz, y + h / 2, sp)
    if (!cb) { skippedAt.add(_k0); return }
    if (cb.x !== x || cb.z !== z || cb.w !== w || cb.d !== d) {
      adjusted.set(_k0, { x: cb.x, z: cb.z, sw: cb.w / _w0, sd: cb.d / _d0 })
      x = cb.x; z = cb.z; w = cb.w; d = cb.d
    }
    const _r = push(wallPool(hex, style), x, y, z, w, h, d, yaw)
    if (y - h / 2 <= SURFACE + 0.6 && !wallAt.has(_k0)) wallAt.set(_k0, { r: _r, i: _r.n - 1, hex, style, x, z, w, d, h, base: y - h / 2 })
    if (y - h / 2 <= SURFACE + 0.6) regPrint(x, z, w, d)
    const top = y + h / 2
    const roofC = pick(rng, ROOF)
    const roofT = Math.max(1.6, Math.min(3.2, Math.min(w, d) * 0.04)) + roofJit * 0.045
    // 刚体顶 = 屋面板顶（以前只到墙盒顶，人落在屋顶上会陷进 1.6~3.2m 厚的屋面板里看不见）
    const solidRef = { x, z, w, d, y, h, yaw }
    push(roofPool(roofC), x, top + roofT / 2, z, w * 1.06, roofT, d * 1.06, yaw)
    // 檐口 + 女儿墙：远处天际线不再是一刀切的方块
    const capH = Math.max(0.6, Math.min(1.4, h * 0.012))
    const capY = top - capH * 0.5
    push(cornice, x, capY, z + d / 2 + 0.16, w + 0.55, capH, 0.42, yaw)
    push(cornice, x, capY, z - d / 2 - 0.16, w + 0.55, capH, 0.42, yaw)
    push(cornice, x + w / 2 + 0.16, capY, z, 0.42, capH, d + 0.55, yaw)
    push(cornice, x - w / 2 - 0.16, capY, z, 0.42, capH, d + 0.55, yaw)
    const hz2 = Math.abs(Math.sin(x * 7.13 + z * 3.71) * 9631.7) % 1
    // 低层住宅/酒店：坡屋顶（不再做女儿墙/屋面设备）
    if (forceGable || curDistrict === 'old' && h < 42 && h > 6 && (style === 'punch' || style === 'hotel' || style === 'ribbon') && y - h / 2 <= SURFACE + 0.6 || (h < 30 && h > 8 && hz2 < 0.55 || h >= 30 && h < 48 && hz2 < 0.3) && Math.max(w, d) < 46 && (style === 'punch' || style === 'hotel') && y - h / 2 <= SURFACE + 0.6) {
      const ridgeH = gableK > 0 ? Math.min(w, d) * gableK : Math.min(h < 30 || forceGable ? 99 : 5.5, Math.min(w, d) * (0.26 + 0.16 * (Math.min(hz2, 0.55) / 0.55)))
      const along = w >= d
      const gp = gableIdx >= 0 ? gablePools[gableIdx] : gablePools[Math.floor(hz2 * 97) % gablePools.length]
      push(gp, x, top + roofT + ridgeH / 2 - 0.05, z, along ? d * 1.08 : w * 1.08, ridgeH, along ? w * 1.08 : d * 1.08, along ? Math.PI / 2 : 0)
      // 坡屋顶：站在屋脊高度（宁可略浮，不陷进瓦面）
      addSolid(solidRef.x, solidRef.z, solidRef.w, solidRef.d, top + roofT + ridgeH * 0.85, solidRef.y - solidRef.h / 2, solidRef.yaw)
      return
    }
    addSolid(solidRef.x, solidRef.z, solidRef.w, solidRef.d, top + roofT, solidRef.y - solidRef.h / 2, solidRef.yaw)
    const parY = top + roofT + 0.35
    const parH = 0.9
    push(parapet, x, parY, z + d * 0.53, w * 1.06, parH, 0.26, yaw)
    push(parapet, x, parY, z - d * 0.53, w * 1.06, parH, 0.26, yaw)
    push(parapet, x + w * 0.53, parY, z, 0.26, parH, d * 1.06, yaw)
    push(parapet, x - w * 0.53, parY, z, 0.26, parH, d * 1.06, yaw)
    const pad = top + roofT + 0.15
    const innerW = w * 0.72
    const innerD = d * 0.72
    const roofRoll = rng()
    if (h < 140 && roofRoll < 0.42 && innerW > 14 && innerD > 14) {
      push(pickPool(roofGreenPools), x, pad + 0.2, z, innerW, 0.4, innerD, yaw)
      addSolid(x, z, innerW, innerD, pad + 0.4, top)
    } else if (roofRoll < 0.72 && innerW > 12 && innerD > 12) {
      push(pickPool(roofDeckPools), x, pad + 0.15, z, innerW * 0.85, 0.3, innerD * 0.85, yaw)
      addSolid(x, z, innerW * 0.85, innerD * 0.85, pad + 0.3, top)
    }
    if (h > 28 && rng() < 0.9 && innerW > 10) {
      const n = 1 + ((rng() * 3) | 0)
      for (let i = 0; i < n; i++) {
        const mw = range(rng, innerW * 0.18, innerW * 0.42)
        const md = range(rng, innerD * 0.16, innerD * 0.38)
        const mh = range(rng, 2.5, Math.min(12, 3 + h * 0.025))
        const mx = x + range(rng, -innerW * 0.28, innerW * 0.28)
        const mz = z + range(rng, -innerD * 0.28, innerD * 0.28)
        push(mech, mx, pad + mh / 2, mz, mw, mh, md, yaw)
        addSolid(mx, mz, mw, md, pad + mh, pad)
      }
    }
    // 中层楼屋顶水箱（四脚架 + 圆罐）
    if (h > 18 && h < 110 && innerW > 10 && innerD > 10 && hz2 > 0.62) {
      const tr = 1.3 + (hz2 - 0.62) * 3
      const tx = x + innerW * 0.25
      const tz = z - innerD * 0.2
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) push(mech, tx + lx * tr * 0.6, pad + 1.2, tz + lz * tr * 0.6, 0.18, 2.4, 0.18)
      push(tank, tx, pad + 2.4 + 1.6, tz, tr * 2, 3.2, tr * 2)
    }
    // 地标塔冠：两级收分玻璃冠
    if (h > 250 && hz2 < 0.6 && style === 'curtain' && w > 18 && d > 18) {
      const c1 = 14 + hz2 * 20
      pushBuilding(hex, 'curtain', x, top + roofT + c1 / 2, z, w * 0.72, c1, d * 0.72)
      return
    }
    // 超高层冠部尖刺 / 天线
    if (h > 180 && rng() < 0.55) {
      const ay = pad + range(rng, 12, 28)
      const ah = range(rng, 18, 40)
      push(accent, x, ay, z, 0.4, ah, 0.4, yaw)
      push(beacon, x, ay + ah / 2 + 0.4, z, 0.8, 0.8, 0.8)
    } else if (h > 110) {
      const hz = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1
      if (hz < 0.7) {
        const mh = 4 + hz * 8
        push(accent, x, pad + mh / 2, z, 0.3, mh, 0.3, yaw)
        push(beacon, x, pad + mh + 0.35, z, 0.7, 0.7, 0.7)
      }
    }
  }

  function pushCylBuilding(hex, x, y, z, r, h) {
    { const cb = claimBox(x, z, r * 2 + 0.2, r * 2 + 0.2, y - h / 2, y + h / 2 + 3, 0.1, 0.1, y + h / 2); if (!cb || cb.w < r * 2 - 0.01 || cb.d < r * 2 - 0.01) return }
    push(cylPool(hex), x, y, z, r * 2, h, r * 2)
    addSolid(x, z, r * 2, r * 2, y + h / 2 + 0.7, y - h / 2)
    const top = y + h / 2
    cylList.push({ x, z, r, h, y })
    push(roofCylPool(pick(rng, ROOF)), x, top + 0.35, z, r * 2.05, 0.7, r * 2.05)
    if (rng() < 0.7) {
      push(mech, x, top + 2, z, r * 0.8, 2.5, r * 0.8)
    }
  }

  /**
   * 近中距几何立面：层间板 + 窗台/竖挺/玻璃片凸出墙面。
   * 开间模数与 shader 对齐，避免近距「双影窗」。
   * 只做中低层（远楼靠 shader），避免 5km 城段实例爆炸。
   */
  function dressFacade(cx, baseY, cz, w, h, d, style) {
    // 近人尺度：底部楼层必须是真窗洞几何，不能只靠 shader 贴纸
    if (h < 14 || w < 9 || d < 9) return

    const floorH = style === 'curtain' ? 3.9 : style === 'ribbon' ? 3.9 : style === 'podium' ? 4.5 : style === 'hotel' ? 3.3 : 3.0
    const bay = style === 'curtain' ? 3.2 : style === 'ribbon' ? 4.8 : style === 'podium' ? 5.5 : style === 'hotel' ? 3.6 : 4.2
    const out = 0.06
    const dense = style === 'curtain' || style === 'ribbon'
    const podium = style === 'podium'
    // 玻璃/窗套外挑加大，避免与墙盒几乎共面 → 走动时竖线闪烁（z-fight）
    const fd = dense ? 0.22 : podium ? 0.26 : 0.24
    // 只做街上看得到的下段楼层（再高远了看不出深度）
    // 窗套已经合成单实例，可以多做几层：街道视线高度内几乎全是真窗洞
    const maxFloors = Math.min(Math.floor((h - 2.5) / floorH), 3)
    const y0 = baseY

    const faces = [
      [0, 1, cx, cz + d / 2 + out, true],
      [0, -1, cx, cz - d / 2 - out, true],
      [1, 0, cx + w / 2 + out, cz, false],
      [-1, 0, cx - w / 2 - out, cz, false],
    ]
    const longZ = w >= d
    const halfSpan = (alongX) => (alongX ? w : d) * 0.5

    for (let fi = 0; fi < 4; fi++) {
      const isLong = longZ ? fi < 2 : fi >= 2
      const [nx, nz, ox, oz, alongX] = faces[fi]
      const hs = halfSpan(alongX)
      if (hs < bay * 0.55) continue
      const pier = 0.55
      const ribbon = style === 'ribbon'
      // 与 shader 同一套开间网格（pier=0.55，整面居中）：几何窗必须和贴图窗严格对齐
      const nBayShader = Math.max(1, Math.floor((hs * 2 - pier * 2) / bay + 1e-4))
      const gridFull = nBayShader * bay
      // 必须和 shader 一样铺满整面：以前只做中间几跨，两侧剩下的窗就是贴在墙上的平面窗，
      // 于是同一栋楼出现「一半 3D 窗、一半贴图窗」的割裂感
      const nBay = nBayShader
      const grid = nBay * bay
      // 侧立面只做下面几层：街角转身看过去也得是真窗
      const floors = isLong ? maxFloors : Math.min(maxFloors, 3)

      // 不再做外凸勒脚：那条 0.84m 高的石材带凸出立面 15cm，正好挡在内嵌店面的玻璃/ATM 前，
      // 看起来就是一圈「围栏」。勒脚的深色只留在 shader 里（贴墙、零厚度），人行道直接接店门

      // 一层是店面（4.2 高），几何窗从店面以上开始，别把层间板穿进橱窗
      const jStart = Math.max(1, Math.ceil(4.5 / floorH))
      for (let j = jStart; j <= floors; j++) {
        const fy = y0 + j * floorH
        if (fy + floorH > baseY + h - 2.5) break

        // 层间板外挑
        const bandH = dense ? 0.28 : 0.16
        const bandSpan = gridFull * 0.98
        const bandD = 0.22
        if (alongX) push(band, ox, fy + 0.02, oz + nz * (bandD * 0.2), bandSpan, bandH, bandD)
        else push(band, ox + nx * (bandD * 0.2), fy + 0.02, oz, bandD, bandH, bandSpan)
        const dz = (v) => oz + nz * v
        const dx = (v) => ox + nx * v

        if (style === 'ribbon') {
          const glassH = floorH * 0.5
          const gy = fy + floorH * 0.53
          const gw = grid * 0.96
          if (alongX) {
            pushPane(panePick(), ox, gy, dz(0.08), gw, glassH, 0.06)
            push(jamb, ox, gy + glassH / 2 + 0.06, dz(fd * 0.5), gw + fd * 2, 0.12, fd)
            push(jamb, ox, gy - glassH / 2 - 0.06, dz(fd * 0.5), gw + fd * 2, 0.12, fd)
            push(sill, ox, gy - glassH / 2 - 0.16, dz(fd + 0.08), gw + 0.3, 0.1, fd + 0.3)
            for (let i = 0; i <= nBay; i++) {
              push(mull, ox - grid / 2 + i * bay, gy, dz(fd * 0.55), 0.12, glassH, fd * 0.8)
            }
          } else {
            pushPane(panePick(), dx(0.08), gy, oz, 0.06, glassH, gw)
            push(jamb, dx(fd * 0.5), gy + glassH / 2 + 0.06, oz, fd, 0.12, gw + fd * 2)
            push(jamb, dx(fd * 0.5), gy - glassH / 2 - 0.06, oz, fd, 0.12, gw + fd * 2)
            push(sill, dx(fd + 0.08), gy - glassH / 2 - 0.16, oz, fd + 0.3, 0.1, gw + 0.3)
            for (let i = 0; i <= nBay; i++) {
              push(mull, dx(fd * 0.55), gy, oz - grid / 2 + i * bay, fd * 0.8, glassH, 0.12)
            }
          }
          continue
        }

        for (let i = 0; i < nBay; i++) {
          const along = -grid / 2 + bay * (i + 0.5)
          const winW = bay * (dense ? 0.88 : 0.6)
          const winH = dense ? floorH * 0.74 : floorH * 0.58
          const wy = fy + floorH * (dense ? 0.45 : 0.57)
          const jw = dense ? 0.07 : podium ? 0.12 : 0.09

          if (alongX) {
            const x = ox + along
            // 玻璃外挑 ≥8cm，避免与墙共面闪烁
            pushPane(panePick(), x, wy, dz(0.08), winW, winH, 0.06)
            pushFrame(framePick(), x, wy, oz, winW + jw * 2.4, winH + jw * 2, fd * 1.15, nz > 0 ? 0 : Math.PI)
          } else {
            const z = oz + along
            pushPane(panePick(), dx(0.08), wy, z, 0.06, winH, winW)
            pushFrame(framePick(), ox, wy, z, winW + jw * 2.4, winH + jw * 2, fd * 1.15, nx > 0 ? Math.PI / 2 : -Math.PI / 2)
          }
        }
      }
    }

    // 角部壁柱：把转角的直角拉出竖向阴影，街角不再是一块平板
    if (h < 220) {
      const px = w / 2 - 0.18
      const pz = d / 2 - 0.18
      const pilH = Math.min(h, 120)
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          push(band, cx + sx * px, baseY + pilH / 2, cz + sz * pz, 0.62, pilH, 0.62)
        }
      }
      // 落水管：两个临街角各一根，把墙和地面接住
      for (const sx of [-1, 1]) {
        push(pipe, cx + sx * (w / 2 + 0.1), baseY + h * 0.46, cz + d / 2 + 0.1, 0.16, h * 0.9, 0.16)
        push(pipe, cx + sx * (w / 2 + 0.1), baseY + h * 0.46, cz - d / 2 - 0.1, 0.16, h * 0.9, 0.16)
      }
    }

    // 住宅外挂空调机：挂在两窗之间的墙垛上、窗台高度，按网格对齐
    if (style === 'punch' && h > 20) {
      const n = Math.min(8, 2 + Math.floor(h / 22))
      for (let i = 0; i < n; i++) {
        const onZ = rng() < 0.5
        const span = onZ ? w : d
        const nBay = Math.max(1, Math.floor((span - 1.1) / bay + 1e-4))
        if (nBay < 2) continue
        const along = -nBay * bay / 2 + (1 + ((rng() * (nBay - 1)) | 0)) * bay
        const j = 2 + ((rng() * Math.max(1, Math.floor(Math.min(h - 4, 46) / 3.0) - 2)) | 0)
        const yy = baseY + j * 3.0 + 0.55
        if (onZ) {
          push(acUnit, cx + along, yy, cz + d / 2 + 0.36, 0.95, 0.6, 0.46)
          push(acGrill, cx + along, yy, cz + d / 2 + 0.6, 0.72, 0.4, 0.03)
        } else {
          push(acUnit, cx + w / 2 + 0.36, yy, cz + along, 0.46, 0.6, 0.95)
          push(acGrill, cx + w / 2 + 0.6, yy, cz + along, 0.03, 0.4, 0.72)
        }
      }
    }
  }

  /**
   * 塔楼 1 楼大堂：外挂挑高门厅（同店厢逻辑，不被实心楼体吞）。
   * 挑高 5.4、进深 5m、自动门、前台、候梯墙、灯槽。
   */
  function dressLobby(cx, baseY, cz, w, d) {
    const lobbyH = 5.4
    const roomD = 1.8 // 门厅只做 1.8m 深的玻璃前室，不再整间盖到人行道上
    const out = 0.05
    const allFaces = [
      [0, 1, cx, cz + d / 2 + out, true, w],
      [0, -1, cx, cz - d / 2 - out, true, w],
      [1, 0, cx + w / 2 + out, cz, false, d],
      [-1, 0, cx - w / 2 - out, cz, false, d],
    ]
    const longSpan = Math.max(w, d)
    let lobbyFaces = 0
    for (let fi = 0; fi < 4; fi++) {
      const [nx, nz, fox, foz, alongX, span] = allFaces[fi]
      if (span < longSpan - 0.5 || span < 14) continue
      if (++lobbyFaces > 1) break

      const mid = roomD / 2 + 0.2
      let rx, rz
      if (alongX) { rx = fox; rz = foz + nz * mid }
      else { rx = fox + nx * mid; rz = foz }
      const iw = Math.min(span * 0.72, 22)
      const id = roomD
      const ih = lobbyH - 0.1

      // 壳
      push(roomFloor, rx, baseY + 0.08, rz, alongX ? iw : id, 0.14, alongX ? id : iw)
      push(roomCeil, rx, baseY + ih - 0.08, rz, alongX ? iw : id, 0.12, alongX ? id : iw)
      if (alongX) {
        push(roomWall, rx, baseY + ih / 2, foz + nz * 0.1, iw, ih, 0.2)
        push(roomWall, rx - iw / 2 + 0.08, baseY + ih / 2, rz, 0.16, ih, id)
        push(roomWall, rx + iw / 2 - 0.08, baseY + ih / 2, rz, 0.16, ih, id)
      } else {
        push(roomWall, fox + nx * 0.1, baseY + ih / 2, rz, 0.2, ih, iw)
        push(roomWall, rx, baseY + ih / 2, rz - iw / 2 + 0.08, id, ih, 0.16)
        push(roomWall, rx, baseY + ih / 2, rz + iw / 2 - 0.08, id, ih, 0.16)
      }

      // 临街：柱列 + 半透明幕 + 自动门
      const front = roomD + 0.15
      const bays = Math.max(3, Math.min(5, Math.round(iw / 5.5)))
      const uw = iw / bays
      const doorB = (bays / 2) | 0
      for (let u = 0; u <= bays; u++) {
        const along = -iw / 2 + u * uw
        if (alongX) push(pillar, rx + along, baseY + lobbyH / 2, foz + nz * front, 0.4, lobbyH, 0.45)
        else push(pillar, fox + nx * front, baseY + lobbyH / 2, rz + along, 0.45, lobbyH, 0.4)
      }
      for (let u = 0; u < bays; u++) {
        const along = -iw / 2 + uw * (u + 0.5)
        const isDoor = u === doorB
        const gy = baseY + lobbyH * 0.48
        const gh = lobbyH * 0.78
        if (alongX) {
          const x = rx + along
          const z = foz + nz * front
          if (isDoor) {
            push(door, x, baseY + 1.15, z, 1.6, 2.2, 0.12)
            push(doorGlass, x, baseY + 1.35, z + nz * 0.05, 1.35, 1.6, 0.05)
            push(shopGlass, x - uw * 0.35, gy, z, uw * 0.35, gh, 0.08)
            push(shopGlass, x + uw * 0.35, gy, z, uw * 0.35, gh, 0.08)
          } else {
            push(shopGlass, x, gy, z, uw * 0.88, gh, 0.08)
          }
        } else {
          const x = fox + nx * front
          const z = rz + along
          if (isDoor) {
            push(door, x, baseY + 1.15, z, 0.12, 2.2, 1.6)
            push(doorGlass, x + nx * 0.05, baseY + 1.35, z, 0.05, 1.6, 1.35)
            push(shopGlass, x, gy, z - uw * 0.35, 0.08, gh, uw * 0.35)
            push(shopGlass, x, gy, z + uw * 0.35, 0.08, gh, uw * 0.35)
          } else {
            push(shopGlass, x, gy, z, 0.08, gh, uw * 0.88)
          }
        }
      }

      // 雨棚 + 楼名牌
      const canopyD = range(rng, 1.6, 2.4)
      if (alongX) {
        push(canopy, rx, baseY + lobbyH + 0.12, foz + nz * (front + canopyD / 2), iw * 0.9, 0.28, canopyD)
        const PL = plates[(rng() * plates.length) | 0]
        const pw = Math.min(6, iw * 0.35)
        const py = nz > 0 ? 0 : Math.PI
        push(PL, rx, baseY + lobbyH + 0.95, foz + nz * (front + 0.25), pw, pw / 4, 0.12, py)
        push(PL, rx + (-iw / 2 + uw * (doorB + 0.5)) + uw * 0.3, baseY + 2.1, foz + nz * (front + 0.07), 0.9, 0.225, 0.03, py)
      } else {
        push(canopy, fox + nx * (front + canopyD / 2), baseY + lobbyH + 0.12, rz, canopyD, 0.28, iw * 0.9)
        const PL = plates[(rng() * plates.length) | 0]
        const pw = Math.min(6, iw * 0.35)
        const py = nx > 0 ? Math.PI / 2 : -Math.PI / 2
        push(PL, fox + nx * (front + 0.25), baseY + lobbyH + 0.95, rz, pw, pw / 4, 0.12, py)
        push(PL, fox + nx * (front + 0.07), baseY + 2.1, rz + (-iw / 2 + uw * (doorB + 0.5)) + uw * 0.3, 0.9, 0.225, 0.03, py)
      }

      // 内景：前台 + 候梯墙 + 沙发 + 灯
      for (const t of [-0.85, 0, 0.85]) {
        if (alongX) push(roomLight, rx + t * iw * 0.3, baseY + ih - 0.2, rz, 0.5, 0.1, 0.5)
        else push(roomLight, rx, baseY + ih - 0.2, rz + t * iw * 0.3, 0.5, 0.1, 0.5)
      }
      if (alongX) {
        push(counter, rx, baseY + 0.6, foz + nz * 0.8, Math.min(4.5, iw * 0.35), 1.15, 0.8)
        // 后墙候梯暗示
        push(mull, rx - 1.4, baseY + 1.2, foz + nz * 0.35, 1.1, 2.2, 0.08)
        push(mull, rx + 1.4, baseY + 1.2, foz + nz * 0.35, 1.1, 2.2, 0.08)
        push(roomWall, rx - iw * 0.28, baseY + 0.35, foz + nz * (roomD - 1.2), 1.4, 0.45, 0.55)
        push(roomWall, rx + iw * 0.28, baseY + 0.35, foz + nz * (roomD - 1.2), 1.4, 0.45, 0.55)
      } else {
        push(counter, fox + nx * 0.8, baseY + 0.6, rz, 0.8, 1.15, Math.min(4.5, iw * 0.35))
        push(mull, fox + nx * 0.35, baseY + 1.2, rz - 1.4, 0.08, 2.2, 1.1)
        push(mull, fox + nx * 0.35, baseY + 1.2, rz + 1.4, 0.08, 2.2, 1.1)
        push(roomWall, fox + nx * (roomD - 1.2), baseY + 0.35, rz - iw * 0.28, 0.55, 0.45, 1.4)
        push(roomWall, fox + nx * (roomD - 1.2), baseY + 0.35, rz + iw * 0.28, 0.55, 0.45, 1.4)
      }
    }
  }

  /** 一个实例放下整间店的框料；x 向按开间宽度缩放 */
  function pushShopFrame(x, baseY, z, iw, alongX, nx, nz, doorLeft, split = false) {
    const inst = shopFramePools[doorLeft ? 0 : 1][split ? 1 : 0]
    const yaw = alongX ? (nz > 0 ? 0 : Math.PI) : (nx > 0 ? Math.PI / 2 : -Math.PI / 2)
    return push(inst, x, baseY + SHOP_REF.H / 2, z, iw / SHOP_REF.W, 1, 1, yaw)
  }

  /** 内嵌店厢的 3D 陈设（全部实例化小盒子），按店种摆；depth 为负 = 往店里 */
  function furnish(kind, P, PS, ST, iw, id, baseY, ih, u) {
    const F = baseY + 0.2
    const dW = iw - 0.6
    const G = (i) => goodsP[(i + u * 3) % goodsP.length]
    // 背墙：店种背景画（比例 2:1）+ 两条灯带
    const bw = Math.min(dW, 4.4)
    PS(ST.back, 0, F + 1.25 + bw / 4 - 0.4, bw, bw / 2, 0.04, -id + 0.06)
    P(roomLight, 0, baseY + ih - 0.1, iw * 0.72, 0.05, 0.22, -id * 0.3)
    P(roomLight, 0, baseY + ih - 0.1, iw * 0.72, 0.05, 0.22, -id * 0.75)
    if (kind === 'shelves' || kind === 'books') {
      // 背墙通长货架 + 两排纵向货架（看得出过道和进深）
      const tall = kind === 'books' ? 2.4 : 1.9
      P(shelfP, 0, F + tall / 2, dW, tall, 0.42, -id + 0.25)
      for (let l = 0; l < 4; l++) P(G(l), 0, F + 0.35 + l * (tall / 4.4), dW * 0.96, 0.26, 0.06, -id + 0.48)
      for (const s of [-1, 1]) {
        const a = s * dW * 0.22
        P(kind === 'books' ? woodP : shelfP, a, F + 0.7, 0.55, 1.4, id * 0.5, -id * 0.45)
        for (let l = 0; l < 3; l++) {
          P(G(l + 2 + s), a - 0.3, F + 0.3 + l * 0.42, 0.06, 0.26, id * 0.46, -id * 0.45)
          P(G(l + 4 + s), a + 0.3, F + 0.3 + l * 0.42, 0.06, 0.26, id * 0.46, -id * 0.45)
        }
      }
      P(counter, dW * 0.38, F + 0.5, 0.8, 1.0, 0.6, -0.9)
    } else if (kind === 'racks') {
      for (const dep of [-1.4, -2.7]) {
        P(stMull, 0, F + 1.5, dW * 0.74, 0.04, 0.04, dep)
        P(stMull, -dW * 0.37, F + 0.75, 0.04, 1.5, 0.04, dep)
        P(stMull, dW * 0.37, F + 0.75, 0.04, 1.5, 0.04, dep)
        const n = Math.max(3, Math.floor(dW * 0.74 / 0.42))
        for (let i = 0; i < n; i++) P(G(i), -dW * 0.37 + (i + 0.5) * (dW * 0.74 / n), F + 1.05, 0.08, 0.85, 0.42, dep)
      }
      P(darkP, dW * 0.3, F + 0.85, 0.36, 1.7, 0.24, -0.7)
      P(darkP, dW * 0.3, F + 1.82, 0.2, 0.24, 0.2, -0.7)
    } else if (kind === 'tables') {
      for (const dep of [-1.2, -2.6]) {
        for (const s of [-1, 1]) {
          const a = s * dW * 0.24
          P(woodP, a, F + 0.74, 0.8, 0.05, 0.8, dep)
          P(darkP, a, F + 0.37, 0.08, 0.72, 0.08, dep)
          for (const t of [-1, 1]) {
            P(darkP, a + t * 0.62, F + 0.23, 0.4, 0.46, 0.4, dep)
            P(darkP, a + t * 0.8, F + 0.7, 0.05, 0.5, 0.4, dep)
          }
        }
      }
      P(counter, 0, F + 0.5, dW * 0.6, 1.0, 0.55, -id + 0.6)
    } else if (kind === 'counter') {
      P(counter, 0, F + 0.55, dW * 0.82, 1.1, 0.6, -id * 0.6)
      P(caseGlass, 0, F + 1.6, dW * 0.82, 1.0, 0.04, -id * 0.6 + 0.28)
      for (const s of [-1, 1]) P(darkP, s * dW * 0.2, F + 0.24, 0.45, 0.48, 0.45, -id * 0.6 + 0.9)
      P(woodP, -dW * 0.36, F + 0.4, 0.9, 0.8, 0.5, -0.9)
    } else if (kind === 'menu' || kind === 'bread') {
      P(counter, 0, F + 0.52, dW * 0.7, 1.04, 0.6, -id * 0.62)
      P(darkP, dW * 0.18, F + 1.25, 0.5, 0.42, 0.4, -id * 0.62)
      if (kind === 'bread') {
        P(caseGlass, -dW * 0.15, F + 1.2, dW * 0.4, 0.36, 0.55, -id * 0.62)
        for (let i = 0; i < 5; i++) P(goodsP[4], -dW * 0.32 + i * dW * 0.085, F + 1.1, 0.22, 0.12, 0.3, -id * 0.62)
        P(woodP, 0, F + 1.0, dW * 0.9, 2.0, 0.4, -id + 0.25)
        for (let l = 0; l < 3; l++) for (let i = 0; i < 6; i++) P(goodsP[4], -dW * 0.4 + i * dW * 0.16, F + 0.45 + l * 0.6, 0.28, 0.14, 0.26, -id + 0.4)
      }
      for (const s of [-1, 1]) {
        P(woodP, s * dW * 0.28, F + 0.74, 0.6, 0.04, 0.6, -0.9)
        P(darkP, s * dW * 0.28, F + 0.37, 0.06, 0.72, 0.06, -0.9)
        P(darkP, s * dW * 0.28 + 0.5, F + 0.23, 0.36, 0.46, 0.36, -0.9)
      }
    } else if (kind === 'bar') {
      const bx = dW * 0.3
      P(counter, bx, F + 0.55, 0.6, 1.1, id * 0.78, -id * 0.5)
      for (let i = 0; i < 4; i++) P(darkP, bx - 0.6, F + 0.38, 0.36, 0.76, 0.36, -0.6 - i * 0.75)
      P(darkP, 0, F + 1.1, dW, 2.2, 0.32, -id + 0.2)
      for (let l = 0; l < 3; l++) for (let i = 0; i < 8; i++) P(G(i + l), -dW * 0.44 + i * dW * 0.12, F + 0.75 + l * 0.5, 0.08, 0.3, 0.08, -id + 0.38)
      P(woodP, -dW * 0.25, F + 0.74, 0.7, 0.04, 0.7, -1.6)
    } else if (kind === 'pharmacy') {
      // 药房：两侧 + 背墙白色药柜（一格格药盒），中间收银柜台 + 背墙绿十字
      const tall = 2.2
      P(shelfP, 0, F + tall / 2, dW, tall, 0.4, -id + 0.24)
      for (let l = 0; l < 5; l++) for (let i = 0; i < 10; i++) {
        P(G(i * 3 + l), -dW * 0.45 + i * dW * 0.1, F + 0.3 + l * 0.42, dW * 0.07, 0.2, 0.12, -id + 0.46)
      }
      for (const s of [-1, 1]) {
        P(shelfP, s * (dW / 2 - 0.2), F + 1.0, 0.36, 2.0, id * 0.6, -id * 0.45)
        for (let l = 0; l < 4; l++) P(G(l + (s > 0 ? 2 : 5)), s * (dW / 2 - 0.42), F + 0.3 + l * 0.45, 0.06, 0.18, id * 0.56, -id * 0.45)
      }
      P(whiteCtr, 0, F + 0.5, dW * 0.5, 1.0, 0.55, -id * 0.55)
      P(caseGlass, 0, F + 1.15, dW * 0.5, 0.3, 0.5, -id * 0.55)
      PS(crossP, dW * 0.3, F + 2.55, 0.62, 0.62, 0.05, -id + 0.5)
      P(darkP, -dW * 0.12, F + 1.1, 0.35, 0.22, 0.3, -id * 0.55)
    } else if (kind === 'mart') {
      // 便利店：两排双面货架形成过道 + 侧墙一排冷柜（发光玻璃门）+ 门口收银台
      for (const a of [-0.12, 0.2]) {
        const ax = a * dW
        P(shelfP, ax, F + 0.75, 0.6, 1.5, id * 0.62, -id * 0.5)
        for (let l = 0; l < 4; l++) for (const t of [-1, 1]) P(G(l * 2 + (t > 0 ? 1 : 0)), ax + t * 0.32, F + 0.25 + l * 0.36, 0.05, 0.22, id * 0.58, -id * 0.5)
      }
      const fx = dW / 2 - 0.35
      P(darkP, fx, F + 1.0, 0.7, 2.0, id * 0.8, -id * 0.5)
      P(roomLight, fx - 0.36, F + 1.0, 0.02, 1.8, id * 0.76, -id * 0.5)
      for (let l = 0; l < 5; l++) P(G(l + 3), fx - 0.2, F + 0.25 + l * 0.38, 0.3, 0.2, id * 0.72, -id * 0.5)
      P(caseGlass, fx - 0.4, F + 1.0, 0.03, 1.9, id * 0.78, -id * 0.5)
      P(counter, -dW * 0.36, F + 0.5, 0.9, 1.0, 1.4, -1.0)
      P(darkP, -dW * 0.36, F + 1.15, 0.35, 0.3, 0.3, -1.0)
      P(shelfP, -dW * 0.36, F + 1.1, 0.5, 2.2, 0.3, -id + 0.3)
    } else if (kind === 'cafe' || kind === 'tea') {
      // 咖啡：吧台 + 意式咖啡机 + 糕点柜 + 背墙菜单板 + 杯架；奶茶：前台 + 灯箱菜单 + 封口机/杯子 + 高脚凳
      const tea = kind === 'tea'
      P(tea ? whiteCtr : counter, 0, F + 0.53, dW * 0.74, 1.06, 0.62, -id * 0.62)
      P(tea ? whiteCtr : woodP, 0, F + 1.08, dW * 0.78, 0.05, 0.7, -id * 0.62)
      if (!tea) {
        P(steelP, -dW * 0.18, F + 1.33, 0.7, 0.45, 0.45, -id * 0.66)
        P(darkP, -dW * 0.18, F + 1.6, 0.74, 0.08, 0.48, -id * 0.66)
        for (const s of [-1, 1]) P(darkP, -dW * 0.18 + s * 0.18, F + 1.18, 0.07, 0.12, 0.07, -id * 0.62 + 0.1)
        P(caseGlass, dW * 0.18, F + 1.3, dW * 0.28, 0.4, 0.5, -id * 0.62)
        for (let i = 0; i < 4; i++) P(goodsP[4 + (i & 1)], dW * 0.08 + i * dW * 0.07, F + 1.16, 0.18, 0.1, 0.18, -id * 0.62)
        P(darkP, 0, F + 2.3, dW * 0.6, 0.7, 0.04, -id + 0.08)
        P(goodsP[7], 0, F + 2.3, dW * 0.56, 0.02, 0.05, -id + 0.1)
        for (let l = 0; l < 2; l++) P(woodP, 0, F + 1.5 + l * 0.32, dW * 0.6, 0.04, 0.24, -id + 0.2)
        for (let i = 0; i < 10; i++) P(goodsP[7], -dW * 0.27 + i * dW * 0.06, F + 1.58, 0.08, 0.1, 0.08, -id + 0.2)
      } else {
        P(displayGlow, 0, F + 2.25, dW * 0.7, 0.75, 0.04, -id + 0.08)
        for (let i = 0; i < 3; i++) P(steelP, -dW * 0.25 + i * dW * 0.12, F + 1.3, 0.32, 0.42, 0.32, -id * 0.62)
        for (let i = 0; i < 8; i++) P(goodsP[i % 2 ? 6 : 7], dW * 0.05 + i * dW * 0.04, F + 1.2, 0.08, 0.16, 0.08, -id * 0.62 + 0.15)
        P(shelfP, 0, F + 0.9, dW * 0.8, 1.8, 0.35, -id + 0.2)
      }
      for (const s of [-1, 1]) {
        const tx = s * dW * 0.3
        P(woodP, tx, F + 0.74, 0.65, 0.04, 0.65, -0.95)
        P(darkP, tx, F + 0.37, 0.06, 0.72, 0.06, -0.95)
        for (const t of [-1, 1]) {
          P(darkP, tx + t * 0.55, F + 0.45, 0.38, 0.05, 0.38, -0.95)
          P(darkP, tx + t * 0.55, F + 0.22, 0.04, 0.44, 0.04, -0.95)
        }
      }
    } else if (kind === 'bank') {
      // 银行：柜台 + 玻璃隔断（三个窗口）+ 等候椅 + 门边两台 ATM + 一米线
      P(whiteCtr, 0, F + 0.55, dW * 0.86, 1.1, 0.7, -id * 0.62)
      P(caseGlass, 0, F + 1.6, dW * 0.86, 1.0, 0.04, -id * 0.62 + 0.3)
      for (let i = 0; i < 4; i++) P(stMull, -dW * 0.43 + i * dW * 0.2867, F + 1.6, 0.05, 1.0, 0.06, -id * 0.62 + 0.3)
      for (let i = 0; i < 3; i++) P(roomLight, -dW * 0.287 + i * dW * 0.287, F + 2.2, 0.5, 0.12, 0.05, -id * 0.62 + 0.32)
      for (let i = 0; i < 4; i++) P(darkP, -dW * 0.2 + i * 0.6, F + 0.24, 0.48, 0.48, 0.48, -id * 0.62 + 1.1)
      for (const s of [-1, 1]) {
        const ax = s * (dW / 2 - 0.45)
        P(steelP, ax, F + 0.85, 0.75, 1.7, 0.6, -0.55)
        P(roomLight, ax, F + 1.25, 0.4, 0.3, 0.02, -0.24)
        P(darkP, ax, F + 1.0, 0.5, 0.06, 0.2, -0.22)
      }
      for (let i = 0; i < 3; i++) P(stMull, -dW * 0.1 + i * 0.8, F + 0.5, 0.05, 1.0, 0.05, -1.4)
      P(stMull, -dW * 0.1 + 0.8, F + 0.95, 1.6, 0.04, 0.04, -1.4)
    } else if (kind === 'flowers') {
      for (let t = 0; t < 3; t++) {
        P(woodP, 0, F + 0.25 + t * 0.35, dW * 0.8, 0.06, 0.5, -0.8 - t * 0.55)
        for (let i = 0; i < 7; i++) P(G(i + t), -dW * 0.36 + i * dW * 0.12, F + 0.42 + t * 0.35, 0.3, 0.3, 0.3, -0.8 - t * 0.55)
      }
      // 地上一排花桶
      for (let i = 0; i < 6; i++) {
        const bx = -dW * 0.4 + i * dW * 0.16
        P(steelP, bx, F + 0.22, 0.36, 0.44, 0.36, -id + 0.6)
        P(G(i + 1), bx, F + 0.6, 0.42, 0.36, 0.42, -id + 0.6)
      }
      P(counter, dW * 0.3, F + 0.5, 0.9, 1.0, 0.6, -id + 1.4)
    }
  }

  const SHOP_BY_ID = Object.fromEntries(shopTypes.map((s) => [s.t.id, s]))
  const SHOP_NORMAL = shopTypes.filter((s) => !s.t.only)
  function pickShopType() {
    const ids = curDistrict === 'bar' ? ['bar', 'bar', 'bar', 'ramen', 'restaurant']
      : curDistrict === 'walk' ? ['tea', 'cafe', 'bakery', 'fashion', 'restaurant', 'flower', 'books', 'tea']
        : curDistrict === 'anime' ? ['anime', 'toys', 'anime', 'tea', 'toys']
          : curDistrict === 'old' ? ['restaurant', 'ramen', 'tea', 'books', 'bakery']
            : null
    if (ids) return SHOP_BY_ID[ids[(rng() * ids.length) | 0]] || SHOP_NORMAL[0]
    return SHOP_NORMAL[(rng() * SHOP_NORMAL.length) | 0]
  }
  /** 门外设施（在店门前人行道上，depth 为离门面外距离） */
  function outdoorKit(ST, P, PS, iw, front, baseY, u, alongX, nx, nz, fox, foz, rx, rz) {
    const kind = ST.t.outdoor
    const W2 = (uOff, depth) => alongX ? [rx + uOff, foz + nz * (front + depth)] : [fox + nx * (front + depth), rz + uOff]
    const y = baseY
    if (kind === 'cafe') {
      const n = iw > 5.6 ? 2 : 1
      for (let i = 0; i < n; i++) {
        const uo = n === 1 ? -iw * 0.28 : (i === 0 ? -iw * 0.3 : iw * 0.3)
        const dep = 1.8
        P(stMull, uo, y + 1.25, 0.06, 2.5, 0.06, dep)
        P(ST.awn, uo, y + 2.42, 2.4, 0.07, 2.4, dep)
        P(ST.awn, uo, y + 2.52, 1.6, 0.08, 1.6, dep)
        P(ST.awn, uo, y + 2.62, 0.8, 0.08, 0.8, dep)
        P(outWhite, uo, y + 0.74, 0.8, 0.04, 0.8, dep)
        P(outDark, uo, y + 0.37, 0.06, 0.72, 0.06, dep)
        for (const s of [-1, 1]) {
          P(outDark, uo + s * 0.72, y + 0.45, 0.42, 0.04, 0.42, dep)
          P(outDark, uo + s * 0.72, y + 0.22, 0.04, 0.44, 0.04, dep)
          P(outDark, uo + s * 0.93, y + 0.68, 0.04, 0.46, 0.42, dep)
        }
        const [sx, sz] = W2(uo, dep)
        addSolid(sx, sz, 0.9, 0.9, y + 0.76, y)
      }
      // 门边立牌（A 字板，正面画店里的菜单海报）
      P(outDark, iw * 0.5 - 0.4, y + 0.5, 0.6, 1.0, 0.08, 0.6)
      PS(ST.back, iw * 0.5 - 0.4, y + 0.55, 0.52, 0.5, 0.01, 0.65)
    } else if (kind === 'board') {
      P(outDark, -iw * 0.5 + 0.5, y + 0.5, 0.6, 1.0, 0.08, 0.6)
      PS(ST.back, -iw * 0.5 + 0.5, y + 0.55, 0.52, 0.5, 0.01, 0.65)
    } else if (kind === 'flowers') {
      // 三层木花架，摆满一盆盆花
      for (let t = 0; t < 3; t++) {
        P(outWood, -iw * 0.28, y + 0.3 + t * 0.32, iw * 0.34, 0.05, 0.42, 0.5 + (2 - t) * 0.42)
        for (let i = 0; i < 5; i++) P(pickPool(flowerPools), -iw * 0.28 - iw * 0.14 + i * iw * 0.07, y + 0.45 + t * 0.32, 0.24, 0.24, 0.24, 0.5 + (2 - t) * 0.42)
      }
      for (let i = 0; i < 4; i++) {
        P(outDark, iw * 0.3 + (i - 1.5) * 0.45, y + 0.2, 0.34, 0.4, 0.34, 0.6)
        P(pickPool(flowerPools), iw * 0.3 + (i - 1.5) * 0.45, y + 0.55, 0.4, 0.36, 0.4, 0.6)
      }
    } else if (kind === 'bikes' && u % 2 === 0) {
      // 单车架 + 几辆共享单车
      const n = 4
      for (let i = 0; i < n; i++) {
        const uo = -iw * 0.35 + i * 0.75
        P(stMull, uo, y + 0.4, 0.05, 0.8, 0.6, 2.2)
        const bc = (i + u) % 3 === 0 ? bikeB : bikeY
        P(bc, uo + 0.25, y + 0.75, 0.06, 0.06, 1.6, 2.2)
        P(bc, uo + 0.25, y + 0.55, 0.06, 0.45, 0.06, 2.2)
        for (const t of [-0.6, 0.6]) P(outDark, uo + 0.25, y + 0.33, 0.05, 0.62, 0.62, 2.2 + t)
      }
    }
  }

  function dressShopfront(cx, baseY, cz, w, d, opts = {}) {
    // 每栋楼开间模数不同 —— 整条街所有店一样宽，是「贴图感」最大的来源
    const bay = range(rng, 4.4, 6.6)
    const shopH = 4.2
    const roomD = 0.9
    const out = 0.04
    const faces = [
      [0, 1, cx, cz + d / 2 + out, true, w],
      [0, -1, cx, cz - d / 2 - out, true, w],
      [1, 0, cx + w / 2 + out, cz, false, d],
      [-1, 0, cx - w / 2 - out, cz, false, d],
    ]
    // 贴邻墙（分户墙）绝不开店：opts.open = { xn, xp, zn, zp }；缺省再用占地间隙判断
    const open = opts.open
    // 店面只开在真正临街（或临广场）的立面：离地块边缘 ≤16m；楼与楼之间的窄缝（<6.5m）一律不开店、不挂招牌
    const faceOk = (nx, nz) => {
      if (open) {
        if (nx < 0 && !open.xn) return false
        if (nx > 0 && !open.xp) return false
        if (nz < 0 && !open.zn) return false
        if (nz > 0 && !open.zp) return false
      }
      if (faceBlocked(cx, cz, w, d, nx, nz, 6.5)) return false
      const B = curBlockB
      if (B && B.x1 > B.x0) {
        const edge = nx > 0 ? B.x1 - (cx + w / 2) : nx < 0 ? (cx - w / 2) - B.x0 : nz > 0 ? B.z1 - (cz + d / 2) : (cz - d / 2) - B.z0
        if (edge > 16) return false
      }
      return true
    }
    const candidates = faces.filter((f) => faceOk(f[0], f[1]))
    if (!candidates.length) return

    // 长边优先；小体量选一对相邻面做转角店（必须都在开放面里）
    const longSpan = Math.max(w, d)
    let useFaces
    if (opts.row) {
      // 排屋：只做临街主面
      useFaces = candidates.slice().sort((a, b) => b[5] - a[5]).slice(0, 1)
    } else if (longSpan <= 34) {
      const corner = candidates.filter((f) => {
        // 转角：同时有 +X/Z 开放才做两面
        return true
      })
      {
        const byN = (nx, nz) => candidates.find((f) => f[0] === nx && f[1] === nz)
        const picks = []
        if (open?.zp && open?.xp) picks.push(byN(0, 1), byN(1, 0))
        else if (open?.zp && open?.xn) picks.push(byN(0, 1), byN(-1, 0))
        else if (open?.zn && open?.xp) picks.push(byN(0, -1), byN(1, 0))
        else if (open?.zn && open?.xn) picks.push(byN(0, -1), byN(-1, 0))
        useFaces = picks.filter(Boolean)
        if (!useFaces.length) useFaces = candidates.slice(0, 1)
      }
    } else {
      const sorted = candidates.slice().sort((a, b) => b[5] - a[5])
      useFaces = sorted.slice(0, Math.min(2, sorted.length))
    }

    // 一层挖空：上段楼体从 4.2m 起，一层只留核心筒（店面退进 4m），店厢是真的 3D 房间
    const WH = wallAt.get(opts.wallKey)
    const SPLIT_D = 4.0
    const split = !!(WH && !WH.done && WH.h > 7 &&
      Math.abs(WH.w - w) < 1.6 && Math.abs(WH.d - d) < 1.6 && Math.min(WH.w, WH.d) > SPLIT_D * 2 + 3)
    if (split) {
      WH.done = true
      const ob = WH.r.buf
      const oo = WH.i * 8
      ob[oo + 3] = 0; ob[oo + 4] = 0; ob[oo + 5] = 0
      const SH = 4.2
      push(wallPool(WH.hex, WH.style, true), WH.x, WH.base + SH + (WH.h - SH) / 2, WH.z, WH.w, WH.h - SH, WH.d)
      let x0 = WH.x - WH.w / 2, x1 = WH.x + WH.w / 2, z0 = WH.z - WH.d / 2, z1 = WH.z + WH.d / 2
      for (const f of useFaces) {
        if (f[5] < 6.6) continue
        if (f[0] > 0) x1 -= SPLIT_D
        if (f[0] < 0) x0 += SPLIT_D
        if (f[1] > 0) z1 -= SPLIT_D
        if (f[1] < 0) z0 += SPLIT_D
      }
      push(wallPool(WH.hex, WH.style), (x0 + x1) / 2, WH.base + SH / 2, (z0 + z1) / 2, x1 - x0, SH, z1 - z0)
    }
    for (const [nx, nz, fox0, foz0, alongX, span] of useFaces) {
      if (span < 6.6) continue
      // 内嵌模式：店面玻璃落在原立面线上，房间向楼内退 4m
      const fox = split ? fox0 - nx * 0.04 : fox0
      const foz = split ? foz0 - nz * 0.04 : foz0
      const isLongFace = span >= longSpan - 1
      // 排屋只做临街一面；街角小地块才做两面，省掉一半店厢实例
      // 开间不超过 ~9m（以前上限 6 间，长立面一间能到 30m+，门窗被拉成怪比例）
      const cap = opts.row ? (isLongFace ? 6 : 2) : (isLongFace ? 10 : 3)
      const units = Math.max(1, Math.min(cap, Math.round(span / bay), Math.max(1, Math.ceil(span / 9.5))))
      // 宽度随机拆分：一条街不会出现一排等宽店面
      const weights = []
      let wsum = 0
      for (let i = 0; i < units; i++) {
        const wv = range(rng, 0.78, 1.26)
        weights.push(wv)
        wsum += wv
      }
      let cursor = 0
      const glass = pickPool(shopGlassPools)
      const frameCol = pickPool(stFramePools)
      const pilCol = pickPool(pilPools)
      const kickCol = pickPool(kickPools)
      const back = pickPool(backPools)
      const awnCol = pickPool(awningPools)
      const canopyCol = pickPool(canopyPools)
      const sign = pickPool(signPools)

      for (let u = 0; u < units; u++) {
        const unitSpan = (weights[u] / wsum) * span
        const along = -span / 2 + cursor + unitSpan / 2
        cursor += unitSpan
        const iw = unitSpan * 0.94
        if (iw < 2.9) {
          if (split) {
            const px = alongX ? fox + along : fox - nx * SPLIT_D / 2
            const pz = alongX ? foz - nz * SPLIT_D / 2 : foz + along
            push(wallPool(WH.hex, WH.style), px, baseY + 2.1, pz, alongX ? unitSpan : SPLIT_D, 4.2, alongX ? SPLIT_D : unitSpan)
          }
          continue
        }
        const ST = pickShopType()

        const kind = (u + Math.abs((cx * 3) | 0) + Math.abs((cz * 5) | 0)) % 3
        const mid = split ? -SPLIT_D / 2 : roomD / 2 + 0.12
        const rx = alongX ? fox + along : fox + nx * mid
        const rz = alongX ? foz + nz * mid : foz + along
        const id = split ? SPLIT_D - 0.1 : roomD
        const ih = shopH - 0.12

        // ── 店厢壳 ──
        push(roomFloor, rx, baseY + 0.07, rz, alongX ? iw : id, 0.14, alongX ? id : iw)
        push(roomCeil, rx, baseY + ih - 0.07, rz, alongX ? iw : id, 0.12, alongX ? id : iw)
        // 分户墙：内嵌模式下把相邻店之间的缝也封住（否则能看进楼体空腔）
        const pt = split ? unitSpan - iw + 0.14 : 0.14
        const ph = split ? 4.2 : ih
        const pOff = split ? unitSpan / 2 : iw / 2 - 0.07
        if (alongX) {
          push(roomWall, rx - pOff, baseY + ph / 2, rz, pt, ph, id)
          push(roomWall, rx + pOff, baseY + ph / 2, rz, pt, ph, id)
        } else {
          push(roomWall, rx, baseY + ph / 2, rz - pOff, id, ph, pt)
          push(roomWall, rx, baseY + ph / 2, rz + pOff, id, ph, pt)
        }

        // ── 临街立面 ──
        const front = split ? 0.06 : roomD + 0.12
        if (shopSpots.length < 4000) shopSpots.push({ x: alongX ? rx : fox, z: alongX ? foz : rz, nx, nz })
        // 带朝向的贴图件（招牌/背景画）：本地 +z 朝街
        const faceYaw = Math.atan2(nx, nz)
        const putSign = (pool, uOff, y, su, sy, sd, depth = 0, yawAdd = 0) => {
          const fr = front + depth
          if (alongX) push(pool, rx + uOff, y, foz + nz * fr, su, sy, sd, faceYaw + yawAdd)
          else push(pool, fox + nx * fr, y, rz + uOff, su, sy, sd, faceYaw + yawAdd)
        }
        const putFront = (pool, uOff, y, su, sy, sd, depth = 0) => {
          if (alongX) push(pool, rx + uOff, y, foz + nz * (front + depth), su, sy, sd)
          else push(pool, fox + nx * (front + depth), y, rz + uOff, sd, sy, su)
        }

        // 框料整体缩放到开间宽：门居中（双开），两侧对称橱窗
        // 门保持真实尺寸（1.6~2.2m），两侧橱窗填满剩余宽度
        const doorW = Math.min(2.2, Math.max(1.4, SHOP_DOOR_W * iw / SHOP_REF.W))
        const doorH = 2.2
        const winW = Math.max(0.6, (iw - 0.3 - doorW - 0.3) / 2)
        const winAt = doorW / 2 + 0.15 + winW / 2
        const doorAt = 0
        const doorLeft = false

        const kickTop = 0.03
        const glassTop = SHOP_GLASS_TOP
        const glassH = glassTop - kickTop
        const glassY = baseY + kickTop + glassH / 2
        // 跑马灯店：不用雨棚，招牌下挂一条 LED 字幕
        const led = ST.t.style === 'neon' || rng() < 0.22
        const awnType = led ? 2 : rng() < 0.55 ? 0 : rng() < 0.82 ? 1 : 2

        pushShopFrame(fox, baseY, foz, iw, alongX, nx, nz, doorLeft, split)
        // 双开玻璃门：外框 + 中缝 + 两扇玻璃 + 两根竖拉手
        putFront(stMull, doorAt - doorW / 2 + 0.05, baseY + doorH / 2, 0.1, doorH, 0.1, -0.16)
        putFront(stMull, doorAt + doorW / 2 - 0.05, baseY + doorH / 2, 0.1, doorH, 0.1, -0.16)
        putFront(stMull, doorAt, baseY + doorH / 2, 0.06, doorH, 0.1, -0.16)
        putFront(stMull, doorAt, baseY + doorH - 0.05, doorW, 0.1, 0.1, -0.16)
        putFront(stMull, doorAt, baseY + 0.08, doorW, 0.16, 0.1, -0.16)
        for (const s of [-1, 1]) {
          putFront(doorGlass, doorAt + s * doorW / 4, baseY + doorH / 2, doorW / 2 - 0.1, doorH - 0.2, 0.04, -0.16)
          putFront(stHandle, doorAt + s * 0.12, baseY + 1.1, 0.05, 0.7, 0.05, -0.08)
        }
        // 门上亮子玻璃
        putFront(doorGlass, doorAt, baseY + (doorH + glassTop) / 2 + 0.05, doorW - 0.1, glassTop - doorH - 0.12, 0.04, -0.12)
        // 门口台阶 + 地垫（店门在哪一眼看得出）
        // 门槛：贴地浅色石条（3cm），不再是一条挡在门口的深色台阶/地垫
        putFront(kickCol, doorAt, baseY + 0.015, doorW + 0.2, 0.03, 0.42, 0.2)
        // 入口灯：门楣下一条暖光 + 门头筒灯
        putFront(displayGlow, doorAt, baseY + doorH + 0.22, doorW + 0.1, 0.08, 0.12, 0.06)
        putFront(roomLight, doorAt, baseY + glassTop - 0.05, 0.3, 0.06, 0.3, 0.32)
        // 橱窗玻璃（两扇）
        for (const s of [-1, 1]) putFront(glass, s * winAt, glassY, winW, glassH, 0.05, 0.0)

        // ── 雨棚：布棚 / 金属檐 / 无（只留招牌）——门洞中间留出，门头更醒目 ──
        const ad = range(rng, 0.85, 1.35)
        if (awnType === 0) {
          for (const s of [-1, 1]) {
            const aw = winW * 1.02
            putFront(ST.awn, s * winAt, baseY + glassTop + 0.18, aw, 0.1, ad, ad * 0.45)
            putFront(ST.awn, s * winAt, baseY + glassTop + 0.02, aw, 0.26, 0.09, ad * 0.9)
            putFront(stMull, s * winAt, baseY + glassTop + 0.18, aw, 0.06, 0.06, ad * 0.9)
          }
          // 门头小雨棚（金属）
          putFront(canopyCol, doorAt, baseY + glassTop + 0.12, doorW + 0.5, 0.08, 1.1, 0.55)
        } else if (awnType === 1) {
          const aw = iw * range(rng, 0.8, 0.94)
          putFront(canopyCol, 0, baseY + glassTop + 0.16, aw, 0.09, ad * 0.8, ad * 0.4)
          putFront(frameCol, 0, baseY + glassTop + 0.1, aw, 0.07, 0.1, ad * 0.8)
        } else {
          putFront(frameCol, 0, baseY + glassTop + 0.16, iw * 0.9, 0.08, 0.1, 0.04)
        }

        // ── 招牌：横跨整个店面的大灯箱（6:1），夜里发光 ──
        const bandBot = baseY + glassTop + (awnType === 0 ? 0.3 : 0.26) + (led ? 0 : 0)
        const bandTop = baseY + shopH - 0.04
        let bw = iw * 0.96
        let bh = bw / 6
        const ledH = led ? Math.max(0.24, Math.min(0.4, iw * 0.96 / 16)) : 0
        const maxH = bandTop - bandBot - (led ? ledH + 0.06 : 0)
        if (bh > maxH) { bh = maxH; bw = bh * 6 }
        const signY = bandTop - bh / 2
        if (ST.t.style === 'letters') {
          putFront(frameCol, 0, signY, iw * 0.98, bh + 0.12, 0.06, 0.03)
          putSign(ST.sign, 0, signY, bw, bh, 1, 0.08)
        } else {
          // 门头：背板 + 四边金属框 + 一排鹅颈射灯（夜里从上往下洗亮招牌）
          putSign(ST.sign, 0, signY, bw, bh, 0.16, 0.1)
          putFront(frameCol, 0, signY, iw * 0.99, bh + 0.24, 0.05, 0.02)
          putFront(frameCol, 0, signY - bh / 2 - 0.03, bw + 0.08, 0.05, 0.22, 0.1)
          putFront(frameCol, 0, signY + bh / 2 + 0.03, bw + 0.08, 0.05, 0.22, 0.1)
          for (const s2 of [-1, 1]) putFront(frameCol, s2 * (bw / 2 + 0.04), signY, 0.05, bh + 0.1, 0.22, 0.1)
          if (ST.t.style !== 'neon') {
            const nL = Math.max(2, Math.min(4, Math.round(bw / 2.4)))
            for (let i = 0; i < nL; i++) {
              const u0 = -bw / 2 + (i + 0.5) * bw / nL
              putFront(stMull, u0, signY + bh / 2 + 0.12, 0.035, 0.035, 0.5, 0.36)
              putFront(roomLight, u0, signY + bh / 2 + 0.08, 0.12, 0.05, 0.1, 0.6)
            }
          }
        }
        if (led) {
          const lw = Math.min(iw * 0.96, ledH * 16)
          putSign(ledPools[(u + ((cx * 7) | 0)) & 3 & (ledPools.length - 1)] || ledPools[0], 0, signY - bh / 2 - 0.06 - ledH / 2, lw, ledH, 0.08, 0.1)
          putFront(stMull, 0, signY - bh / 2 - 0.06 - ledH - 0.02, lw + 0.06, 0.04, 0.1, 0.1)
        }

        // 侧挑灯箱：隔一间挂一个
        if (isLongFace && u % 2 === 0) {
          const bx = iw / 2
          putSign(ST.blade, bx, baseY + glassTop + 0.85, 0.62, 1.24, 0.1, 0.48, Math.PI / 2)
          putFront(stMull, bx, baseY + glassTop + 0.75, 0.09, 0.06, 1.0, 0.5)
        }

        // ── 内景：背景板 + 灯板 + 货架/吧台 ──
        // ── 内景：按店种画的背景（货架/菜单吧台/面包柜/书架/衣架/吧台…）+ 顶灯 ──
        if (!split) {
          for (const s of [-1, 1]) {
            const bw = Math.min(winW * 0.98, 5.0)
            putSign(ST.back, s * winAt, baseY + 0.6 + bw / 4, bw, bw / 2, 0.05, -roomD + 0.14)
            putFront(roomLight, s * winAt, baseY + ih - 0.2, winW * 0.7, 0.08, id * 0.5, -roomD * 0.22)
          }
        } else furnish(ST.t.interior, putFront, putSign, ST, iw, id, baseY, ih, u)
        // ── 门外设施：咖啡/奶茶外摆遮阳伞座位、花店花架、面包/拉面立牌、便利店/书店单车架 ──
        if (ST.t.outdoor && (opts.outdoor !== false) && baseY < SURFACE + 2 && rng() < 0.6) outdoorKit(ST, putFront, putSign, iw, front, baseY, u, alongX, nx, nz, fox, foz, rx, rz)
      }
    }
  }

  function dressNear(cx, baseY, cz, w, h, d, style, opts = {}) {
    const _key = kxz(cx, cz)
    if (skippedAt.has(_key)) return
    const _adj = adjusted.get(_key)
    if (_adj) { cx = _adj.x; cz = _adj.z; w *= _adj.sw; d *= _adj.sd; opts = { ...opts, wallKey: _key } }
    else opts = { ...opts, wallKey: _key }
    if (w < 6 || d < 6) return
    // 一层优先：门窗/店厢用独立实例池，绝不能被上层 dressFacade 抢光
    if (baseY <= SURFACE + 0.5 && h > 6) {
      // 只有真正的高塔才走大堂，其余沿街一律店铺（避免中层楼只剩空大堂）
      const wantLobby = (h >= 100 && (style === 'curtain' || style === 'ribbon')) ||
        (h >= 60 && (style === 'punch' || style === 'hotel') && !opts.row) ||
        (style === 'podium' && Math.min(w, d) > 28 && h >= 40 && !opts.shop)
      if (wantLobby) dressLobby(cx, baseY, cz, w, d)
      else dressShopfront(cx, baseY, cz, w, d, opts)
    } else if (baseY <= SURFACE + 0.5 && rng() < 0.7) {
      const side = (rng() * 4) | 0
      const depth = range(rng, 2.5, 3.8)
      const y = baseY + 5.2
      if (side === 0) push(canopy, cx, y, cz + d / 2 + depth / 2, w * 0.7, 0.25, depth)
      else if (side === 1) push(canopy, cx, y, cz - d / 2 - depth / 2, w * 0.7, 0.25, depth)
      else if (side === 2) push(canopy, cx + w / 2 + depth / 2, y, cz, depth, 0.25, d * 0.7)
      else push(canopy, cx - w / 2 - depth / 2, y, cz, depth, 0.25, d * 0.7)
    }
    // 上层立面：底部楼层真窗洞（再高的楼也只做下段，防贴纸）
    if (h >= 14) dressFacade(cx, baseY, cz, w, h, d, style)
    // 阳台：严格按 shader 窗网格（开间 4.2 / 层高 3.0 / 边柱 0.55）对齐到窗下，不再随手摆
    if (style === 'punch' && h > 14 && h < 170 && rng() < 0.7) {
      const FHb = 3.0
      const bayB = 4.2
      const face = (rng() * 4) | 0
      const alongX = face < 2
      const sgn = face === 0 || face === 2 ? 1 : -1
      const nx = alongX ? 0 : sgn
      const nz = alongX ? sgn : 0
      const span = alongX ? w : d
      const nBay = Math.max(1, Math.floor((span - 1.1) / bayB + 1e-4))
      const grid = nBay * bayB
      const nb = nBay >= 4 && rng() < 0.5 ? 2 : 1
      const depth = 1.35
      if (!faceBlocked(cx, cz, w, d, nx, nz, depth + 0.8)) {
        const cols = []
        for (let k = (rng() * 2) | 0; k + nb <= nBay; k += nb + 1 + ((rng() * 2) | 0)) cols.push(k)
        const enclosed = rng() < 0.35
        const fo = (alongX ? d : w) / 2
        for (let j = 2; j < 60; j++) {
          const sy = j * FHb
          if (sy + 0.86 * FHb > h - 0.8) break
          if (rng() < 0.12) continue
          const y = baseY + sy
          for (const k of cols) {
            const a = -grid / 2 + (k + nb / 2) * bayB
            const bw = nb * bayB - 0.6
            const P = (pool, along, yy, su, syy, dep, off) => {
              if (alongX) push(pool, cx + along, yy, cz + nz * (fo + off), su, syy, dep)
              else push(pool, cx + nx * (fo + off), yy, cz + along, dep, syy, su)
            }
            P(balcony, a, y + 0.04, bw, 0.16, depth, depth / 2)
            P(rail, a, y + 0.6, bw, 1.0, 0.06, depth - 0.04)
            P(rail, a - bw / 2 + 0.03, y + 0.6, 0.06, 1.0, depth, depth / 2)
            P(rail, a + bw / 2 - 0.03, y + 0.6, 0.06, 1.0, depth, depth / 2)
            if (enclosed) P(shopGlass, a, y + 1.65, bw - 0.02, 1.3, 0.05, depth - 0.06)
          }
        }
      }
    }
  }

  /** 按用途定立面：办公=幕墙/带窗，住宅=开窗+阳台，酒店=竖向密窗，商业裙房=podium（只给矮楼） */
  function pickStyle(kind, h, preferFlat) {
    const r = rng()
    if (kind === 'mall') return r < 0.12 ? 'curtain' : 'podium'
    if (kind === 'shop') return h < 26 && r < 0.4 ? 'podium' : 'punch'
    if (kind === 'core' || h > 220) {
      if (r < (h > 120 ? 0.62 : 0.35)) return 'curtain'
      if (r < 0.82) return 'ribbon'
      return r < 0.92 ? 'hotel' : 'punch'
    }
    if (kind === 'high' || kind === 'waterfront' || kind === 'wallside') {
      if (h > 120 && r < 0.18) return 'curtain'
      if (r < 0.34) return 'ribbon'
      if (r < 0.5) return 'hotel'
      return 'punch'
    }
    if (kind === 'low') return preferFlat ? 'ribbon' : 'punch'
    if (preferFlat) return r < 0.5 ? 'ribbon' : 'punch'
    if (r < 0.28) return 'ribbon'
    if (r < 0.38) return 'hotel'
    return 'punch'
  }

  const ANIME_COLS = ['#ff8fc1', '#7fd8ff', '#ffe066', '#b49bff', '#7ff0b4', '#ffb27f']
  const OLD_COLS = ['#9a5a44', '#8a4a3a', '#a8705a', '#b08060', '#7a4a3a']
  function pickColor(style) {
    if (curDistrict === 'anime' && style !== 'curtain') return pick(rng, ANIME_COLS)
    if (curDistrict === 'old') return pick(rng, OLD_COLS)
    // 幕墙也用暖香槟/暖砂，极少数暖褐点缀
    if (style === 'hotel') return pick(rng, HOTEL)
    if (style === 'curtain') return rng() < 0.08 ? pick(rng, WALL_ACCENT) : pick(rng, WALL_GLASS)
    if (style === 'punch' || style === 'ribbon') {
      return rng() < 0.62 ? pick(rng, WALL) : pick(rng, WALL_WARM)
    }
    return pick(rng, PODIUM)
  }

  /**
   * 摩天楼造型。opts.skipPodium — 纽约式已有贴线街墙时不再叠裙房
   * opts.nyc — 优先婚礼蛋糕退台
   * 体量：板楼 / 同轴退台 / 错位退台 / L / T / 双塔 / 圆柱 —— 全锁在 footprint 内
   */
  function placeTower(kind, bx, bz, footprintW, footprintD, block, opts = {}) {
    if (!(Math.min(footprintW, footprintD) >= 10)) return
    let h = opts.height ?? heightFor(kind, rng, block)
    const mega = !!(block?.mega || (block?.span ?? 1) > 1 || Math.max(footprintW, footprintD) > 90)
    if (opts.height == null) {
      if (kind === 'core') h += 40 + rng() * (mega ? 160 : 100)
      else if (kind === 'high') h += 20 + rng() * (mega ? 100 : 60)
      else if (kind === 'wallside' || kind === 'waterfront') h += rng() * 40
    }

    let w0 = Math.min(footprintW, footprintW * range(rng, 0.82, 0.98))
    let d0 = Math.min(footprintD, footprintD * range(rng, 0.82, 0.98))
    if (h > Math.min(w0, d0) * 10) h = Math.min(w0, d0) * range(rng, 8, 10)

    const preferFlat = !opts.nyc && rng() < 0.22
    if (preferFlat) {
      if (rng() < 0.5) {
        w0 = footprintW * range(rng, 0.9, 0.98)
        d0 = footprintD * range(rng, 0.48, 0.68)
      } else {
        d0 = footprintD * range(rng, 0.9, 0.98)
        w0 = footprintW * range(rng, 0.48, 0.68)
      }
    }

    const style = opts.style ?? pickStyle(kind, h, preferFlat)
    // 同一栋楼的所有体块（各段退台 / 双塔 / L/T 两翼 / 冠部）同色同立面，夜里窗光一致
    const col = opts.col ?? pickColor(style)
    const ground = opts.baseY ?? SURFACE
    const yaw0 = 0

    // 体量原型：按片区分配（CBD 偏双塔/收分/切角；住宅偏板楼/H/L/退台；多层偏弧面/架空/L）
    const minFoot = Math.min(w0, d0)
    let form = 'stack'
    {
      const r = rng()
      const W8 = kind === 'core'
        ? [['cyl', 0.08, 22], ['twin', 0.12, 26], ['taper', 0.14, 18], ['chamfer', 0.14, 20], ['zigg', 0.06, 26], ['offset', 0.14, 0], ['L', 0.06, 20], ['stilts', 0.04, 20], ['podgreen', 0.08, 24], ['stack', 0.14, 0]]
        : kind === 'high' || kind === 'wallside' || kind === 'waterfront'
          ? [['slab', 0.14, 0], ['H', 0.1, 26], ['L', 0.1, 20], ['T', 0.08, 18], ['zigg', 0.1, 24], ['chamfer', 0.1, 20], ['podgreen', 0.08, 24], ['twin', 0.06, 26], ['taper', 0.06, 18], ['cyl', 0.04, 22], ['offset', 0.08, 0], ['stack', 0.06, 0]]
          : [['L', 0.14, 20], ['arc', 0.14, 22], ['stilts', 0.1, 18], ['zigg', 0.12, 20], ['chamfer', 0.1, 18], ['H', 0.08, 26], ['T', 0.08, 18], ['slab', 0.08, 0], ['offset', 0.08, 0], ['stack', 0.08, 0]]
      let acc = 0
      const tot = W8.reduce((s, x) => s + x[1], 0)
      for (const [f, wgt, need] of W8) {
        acc += wgt / tot
        if (r < acc) { form = minFoot > need ? f : 'stack'; break }
      }
      if (preferFlat && form !== 'slab' && rng() < 0.5) form = 'slab'
      if (opts.forms && !opts.forms.includes(form)) form = opts.forms[(rng() * opts.forms.length) | 0]
    }

    if (!opts.skipPodium && h > 70 && form !== 'cyl' && form !== 'stilts' && form !== 'podgreen' && rng() < 0.7) {
      const sh = range(rng, 12, 24)
      const pw = Math.min(footprintW, w0 * 1.15)
      const pd = Math.min(footprintD, d0 * 1.15)
      pushBuilding(style === 'curtain' ? col : pick(rng, PODIUM), 'podium', bx, ground + sh / 2, bz, pw, sh, pd, 0)
      dressNear(bx, ground, bz, pw, sh, pd, 'podium')
    }

    const dressBase = (x, z, w, d, segH, st = style) => {
      if (!opts.skipPodium) dressNear(x, ground, z, w, Math.min(segH, 80), d, st)
    }
    const B = (x, y0, z, w, hh, d) => pushBuilding(col, style, x, y0 + hh / 2, z, w, hh, d, 0)

    if (form === 'cyl') {
      const r = Math.min(w0, d0) * range(rng, 0.42, 0.48)
      pushCylBuilding(col, bx, ground + h / 2, bz, r, h)
      dressBase(bx, bz, r * 2, r * 2, h, 'curtain')
      return
    }

    if (form === 'twin') {
      const gap = range(rng, 6, 10)
      const alongX = w0 >= d0
      const shaftW = alongX ? (w0 - gap) / 2 : w0 * range(rng, 0.7, 0.88)
      const shaftD = alongX ? d0 * range(rng, 0.7, 0.88) : (d0 - gap) / 2
      const ox = alongX ? (shaftW + gap) / 2 : 0
      const oz = alongX ? 0 : (shaftD + gap) / 2
      const hA = h * range(rng, 0.92, 1)
      const hB = hA * range(rng, 0.94, 1)
      B(bx - ox, ground, bz - oz, shaftW, hA, shaftD)
      B(bx + ox, ground, bz + oz, shaftW, hB, shaftD)
      dressBase(bx - ox, bz - oz, shaftW, shaftD, hA)
      dressBase(bx + ox, bz + oz, shaftW, shaftD, hB)
      // 空中连廊（双塔标配；高塔再加一道）
      const nb = h > 200 ? 2 : 1
      for (let i = 0; i < nb; i++) {
        const bridgeY = ground + Math.min(hA, hB) * (nb === 1 ? range(rng, 0.45, 0.62) : i === 0 ? 0.38 : 0.7)
        const bh = range(rng, 6, 9)
        const bcol = style === 'curtain' ? col : pick(rng, WALL_GLASS)
        if (alongX) pushBuilding(bcol, 'curtain', bx, bridgeY, bz, gap + 1.2, bh, Math.min(shaftD, d0) * 0.4, 0)
        else pushBuilding(bcol, 'curtain', bx, bridgeY, bz, Math.min(shaftW, w0) * 0.4, bh, gap + 1.2, 0)
      }
      return
    }

    if (form === 'L') {
      const wing = range(rng, 0.32, 0.42)
      const barW = w0
      const barD = d0 * wing
      const stemW = w0 * wing
      const stemD = d0
      const sx = (rng() < 0.5 ? -1 : 1) * (w0 / 2 - stemW / 2)
      const sz = (rng() < 0.5 ? -1 : 1) * (d0 / 2 - barD / 2)
      const hBar = h * range(rng, 0.55, 0.85)
      const hStem = h * range(rng, 0.7, 1)
      B(bx, ground, bz + sz, barW, hBar, barD)
      B(bx + sx, ground, bz, stemW, hStem, stemD)
      dressBase(bx, bz + sz, barW, barD, hBar)
      return
    }

    if (form === 'T') {
      const headD = d0 * range(rng, 0.28, 0.4)
      const stemW = w0 * range(rng, 0.35, 0.5)
      const headH = h * range(rng, 0.35, 0.55)
      const side = rng() < 0.5 ? 1 : -1
      B(bx, ground, bz + side * (d0 / 2 - headD / 2), w0, headH, headD)
      B(bx, ground, bz, stemW, h, d0 * range(rng, 0.7, 0.92))
      dressBase(bx, bz + side * (d0 / 2 - headD / 2), w0, headD, headH)
      return
    }

    if (form === 'H') {
      // 两条平行板楼 + 中间连接体（工字形平面）
      const alongX = w0 >= d0
      const barT = (alongX ? w0 : d0) * range(rng, 0.26, 0.32)
      const hBar = h * range(rng, 0.9, 1)
      const hMid = h * range(rng, 0.55, 0.8)
      if (alongX) {
        B(bx - w0 / 2 + barT / 2, ground, bz, barT, hBar, d0)
        B(bx + w0 / 2 - barT / 2, ground, bz, barT, hBar, d0)
        B(bx, ground, bz, w0 - barT * 2, hMid, d0 * range(rng, 0.3, 0.42))
        dressBase(bx - w0 / 2 + barT / 2, bz, barT, d0, hBar)
        dressBase(bx + w0 / 2 - barT / 2, bz, barT, d0, hBar)
      } else {
        B(bx, ground, bz - d0 / 2 + barT / 2, w0, hBar, barT)
        B(bx, ground, bz + d0 / 2 - barT / 2, w0, hBar, barT)
        B(bx, ground, bz, w0 * range(rng, 0.3, 0.42), hMid, d0 - barT * 2)
        dressBase(bx, bz - d0 / 2 + barT / 2, w0, barT, hBar)
        dressBase(bx, bz + d0 / 2 - barT / 2, w0, barT, hBar)
      }
      return
    }

    if (form === 'chamfer') {
      // 切角：中间整块 + 两侧缩进条（转角凹进一格），分 2~3 段退台
      let y = ground
      let cw = w0
      let cd = d0
      let rem = h
      const stages = 2 + ((rng() * 2) | 0)
      for (let s = 0; s < stages; s++) {
        const seg = s === stages - 1 ? rem : rem * range(rng, 0.45, 0.65)
        const c = Math.max(2.5, Math.min(cw, cd) * range(rng, 0.14, 0.2))
        B(bx, y, bz, cw - 2 * c, seg, cd)
        B(bx - cw / 2 + c / 2, y, bz, c, seg, cd - 2 * c)
        B(bx + cw / 2 - c / 2, y, bz, c, seg, cd - 2 * c)
        if (s === 0) dressBase(bx, bz, cw - 2 * c, cd, seg)
        y += seg
        rem -= seg
        cw *= 0.88
        cd *= 0.88
      }
      return
    }

    if (form === 'zigg' || form === 'taper') {
      // 金字塔式阶梯退台 / 连续收分：每段等高，逐段内收
      const n = form === 'zigg' ? 5 + ((rng() * 4) | 0) : 10 + ((rng() * 7) | 0)
      const minK = form === 'zigg' ? range(rng, 0.35, 0.55) : range(rng, 0.55, 0.7)
      let y = ground
      for (let s = 0; s < n; s++) {
        const k = 1 - (1 - minK) * (s / Math.max(1, n - 1))
        const seg = h / n
        const cw = w0 * k
        const cd = d0 * k
        if (Math.min(cw, cd) < 6) break
        B(bx, y, bz, cw, seg + (s < n - 1 ? 0 : 0), cd)
        if (s === 0) dressBase(bx, bz, cw, cd, seg)
        y += seg
      }
      return
    }

    if (form === 'arc') {
      // 弧形立面：沿长边切 7~11 片，进深按余弦变化（背面对齐）→ 折线弧面
      const alongX = w0 >= d0
      const n = 7 + ((rng() * 5) | 0)
      const L = alongX ? w0 : d0
      const D = alongX ? d0 : w0
      const dir = rng() < 0.5 ? 1 : -1
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n - 0.5
        const dep = D * (0.58 + 0.42 * Math.cos(u * Math.PI * 0.95))
        const sl = L / n
        const hh = h * (0.86 + 0.14 * Math.cos(u * Math.PI))
        const off = dir * (D - dep) / 2
        if (alongX) B(bx - L / 2 + sl * (i + 0.5), ground, bz - off, sl + 0.02, hh, dep)
        else B(bx - off, ground, bz - L / 2 + sl * (i + 0.5), dep, hh, sl + 0.02)
      }
      return
    }

    if (form === 'stilts') {
      // 底层架空：一圈柱子托起楼身，中间一个玻璃门厅
      const lift = range(rng, 6, 8)
      const nx = Math.max(2, Math.round(w0 / 8))
      const nz = Math.max(2, Math.round(d0 / 8))
      for (let i = 0; i <= nx; i++) {
        for (let j = 0; j <= nz; j++) {
          if (i !== 0 && i !== nx && j !== 0 && j !== nz) continue
          const px = bx - w0 / 2 + 0.6 + (w0 - 1.2) * (i / nx)
          const pz = bz - d0 / 2 + 0.6 + (d0 - 1.2) * (j / nz)
          push(pillar, px, ground + lift / 2, pz, 0.9, lift, 0.9)
          addSolid(px, pz, 0.9, 0.9, ground + lift, ground)
        }
      }
      const lw = w0 * 0.34
      const ld = d0 * 0.34
      pushBuilding(pick(rng, WALL_GLASS), 'curtain', bx, ground + lift / 2, bz, lw, lift, ld, 0)
      B(bx, ground + lift, bz, w0, h - lift, d0)
      return
    }

    if (form === 'podgreen') {
      // 裙房 + 屋顶花园 + 退进的塔楼
      const ph = range(rng, 10, 16)
      pushBuilding(col, style === 'curtain' ? 'podium' : style, bx, ground + ph / 2, bz, w0, ph, d0, 0)
      dressBase(bx, bz, w0, d0, ph)
      const gw = w0 * 0.94
      const gd = d0 * 0.94
      push(pickPool(roofGreenPools), bx, ground + ph + 3.0, bz, gw, 0.5, gd)
      // 花园里的几排矮灌木
      for (let i = 0; i < 6; i++) {
        const gx = bx + range(rng, -gw * 0.42, gw * 0.42)
        const gz = bz + range(rng, -gd * 0.42, gd * 0.42)
        push(hedge, gx, ground + ph + 3.6, gz, range(rng, 2, 5), 0.8, range(rng, 1, 2))
      }
      const tw = w0 * range(rng, 0.45, 0.6)
      const td = d0 * range(rng, 0.45, 0.6)
      const ox = (rng() - 0.5) * (w0 - tw) * 0.6
      const oz = (rng() - 0.5) * (d0 - td) * 0.6
      B(bx + ox, ground + ph, bz + oz, tw, h - ph, td)
      return
    }

    // stack / offset / slab：分段退台，offset 每段错位（所有段同色同立面）
    {
      let y = ground
      let cw = w0
      let cd = d0
      let cx = bx
      let cz = bz
      let rem = h
      const stages = form === 'slab' ? 1 + ((rng() * 2) | 0) : 2 + ((rng() * 3) | 0)
      for (let s = 0; s < stages; s++) {
        const seg = rem * (s === stages - 1 ? 1 : range(rng, 0.18, 0.38))
        pushBuilding(col, style, cx, y + seg / 2, cz, cw, seg, cd, 0)
        if (s === 0) dressBase(cx, cz, cw, cd, seg)
        y += seg
        rem -= seg
        const shrink = form === 'slab' ? range(rng, 0.92, 0.98) : range(rng, 0.82, 0.94)
        const nw = cw * shrink
        const nd = cd * shrink
        if (form === 'offset' && s < stages - 1) {
          const maxOx = (cw - nw) * 0.5
          const maxOz = (cd - nd) * 0.5
          cx += range(rng, -maxOx, maxOx)
          cz += range(rng, -maxOz, maxOz)
          cx = Math.max(bx - footprintW / 2 + nw / 2, Math.min(bx + footprintW / 2 - nw / 2, cx))
          cz = Math.max(bz - footprintD / 2 + nd / 2, Math.min(bz + footprintD / 2 - nd / 2, cz))
        }
        cw = nw
        cd = nd
      }
      if (h > 240 && rng() < 0.4) {
        const tip = range(rng, 14, 36)
        pushBuilding(col, style, cx, y + tip / 2, cz, cw * 0.7, tip, cd * 0.7, 0)
      }
    }
  }

  /**
   * 沿一边排屋。
   * opts.sparse — 大缝、不铺满；opts.fill — 0~1 只铺这段比例；opts.setback — 退道路
   */
  function placeRow(alongX, x0, z0, length, depth, towardPositive, kind, opts = {}) {
    curGrp++
    const sparse = !!opts.sparse
    const fill = opts.fill ?? 1
    const setback = opts.setback ?? 0
    const start = sparse ? range(rng, 0, length * 0.2) : 0
    const end = start + length * fill * (sparse ? range(rng, 0.45, 0.85) : 1)
    let cursor = start
    while (cursor < end - 6) {
      const seg = Math.min(end - cursor, range(rng, 9, 18))
      // 楼间距要么贴邻（<0.6m），要么是真正能走人的巷子（≥7m）；不再出现 2~6m 的窄缝
      const gap = sparse
        ? (rng() < 0.35 ? range(rng, 12, 24) : range(rng, 0.2, 0.6))
        : (rng() < 0.14 ? range(rng, 12, 16) : range(rng, 0.2, 0.5))
      let h =
        kind === 'shop' ? range(rng, 12, 24) :
        kind === 'low' ? range(rng, 28, 55) :
        kind === 'waterfront' ? range(rng, 40, 90) :
        kind === 'mid' ? range(rng, 45, 100) :
        kind === 'high' || kind === 'core' || kind === 'wallside' ? range(rng, 70, 160) :
        range(rng, 40, 90)
      // 排屋里也掺真高楼，打断一排矮盒子
      if (kind !== 'shop' && rng() < 0.16) h = range(rng, 140, 280)
      // 每栋单独成组：高楼之间按采光间距退让（以前整排一组，塔楼可以贴着建）
      if (h > 58) curGrp++
      // 整排高楼不再用 podium（大玻璃=像落地窗住宅）；podium 只给 26m 以下的商业排屋
      const style = h < 26 && (kind === 'shop' || rng() < 0.35) ? 'podium' : pickStyle(kind, h, false)
      const col = pickColor(style === 'podium' ? 'punch' : style)
      const dUse = depth * range(rng, 0.85, 1.05)
      // 排屋只做朝街那一面；侧墙贴邻屋，绝不开门脸
      const open = alongX
        ? { xn: false, xp: false, zn: !towardPositive, zp: !!towardPositive }
        : { xn: !towardPositive, xp: !!towardPositive, zn: false, zp: false }
      if (alongX) {
        const cx = x0 + cursor + seg / 2
        const cz = towardPositive ? z0 + setback + dUse / 2 : z0 - setback - dUse / 2
        pushBuilding(col, style, cx, SURFACE + h / 2, cz, seg * 0.98, h, dUse * 0.92)
        dressNear(cx, SURFACE, cz, seg * 0.98, h, dUse * 0.92, style, { shop: true, row: true, open })
      } else {
        const cz = z0 + cursor + seg / 2
        const cx = towardPositive ? x0 + setback + dUse / 2 : x0 - setback - dUse / 2
        pushBuilding(col, style, cx, SURFACE + h / 2, cz, dUse * 0.92, h, seg * 0.98)
        dressNear(cx, SURFACE, cz, dUse * 0.92, h, seg * 0.98, style, { shop: true, row: true, open })
      }
      cursor += seg + gap
    }
  }

  /** 已落塔 AABB，硬防重叠 */
  const towerSites = []

  function rectsOverlap(ax, az, aw, ad, bx, bz, bw, bd, gap = 10) {
    return (
      Math.abs(ax - bx) * 2 < aw + bw + gap * 2 &&
      Math.abs(az - bz) * 2 < ad + bd + gap * 2
    )
  }

  function canPlaceRect(x, z, w, d, gap = 12) {
    for (const t of towerSites) {
      if (rectsOverlap(x, z, w, d, t.x, t.z, t.w, t.d, gap)) return false
    }
    return true
  }

  function registerTower(x, z, w, d) {
    towerSites.push({ x, z, w, d })
  }

  /**
   * 纽约式一宗地皮：街墙贴线；塔居中对齐路网，邻塔保距
   */
  function placeNYCLot(x0, x1, z0, z1, kind, block, opts = {}) {
    curGrp++
    const w = x1 - x0
    const d = z1 - z0
    if (w < 6 || d < 6) return
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2

    let streetH =
      kind === 'shop' ? range(rng, 16, 28) :
      kind === 'low' ? range(rng, 22, 40) :
      kind === 'mid' ? range(rng, 28, 55) :
      kind === 'core' || kind === 'high' ? range(rng, 24, 42) :
      range(rng, 22, 48)

    // 沿街基座几乎全暖石材；幕墙只当偶发点缀
    const baseStyle =
      kind === 'shop' || kind === 'core' || kind === 'high'
        ? (rng() < 0.08 ? 'curtain' : rng() < 0.55 ? 'podium' : 'punch')
        : rng() < 0.4 ? 'ribbon' : 'punch'
    const baseCol = pickColor(baseStyle)

    // 默认四面临街；fillBlock 会传入分户墙关闭标志
    const open = opts.open || { xn: true, xp: true, zn: true, zp: true }

    // 街墙：偶发 U/L 院落，打断满铺方盒子
    const streetRoll = rng()
    if (streetRoll < 0.35 && Math.min(w, d) > 28 && kind !== 'shop') {
      const wing = range(rng, 0.28, 0.4)
      const court = range(rng, 0.2, 0.35)
      // 三面围合：只给真正朝外的翼做店面
      if (w >= d) {
        pushBuilding(baseCol, baseStyle, cx, SURFACE + streetH / 2, cz - d * (0.5 - wing / 2), w * 0.99, streetH, d * wing, 0)
        pushBuilding(baseCol, baseStyle, cx - w * (0.5 - wing / 2), SURFACE + streetH / 2, cz, w * wing, streetH, d * (1 - court), 0)
        pushBuilding(baseCol, baseStyle, cx + w * (0.5 - wing / 2), SURFACE + streetH / 2, cz, w * wing, streetH, d * (1 - court), 0)
        dressNear(cx, SURFACE, cz - d * (0.5 - wing / 2), w * 0.99, streetH, d * wing, baseStyle, {
          shop: true, open: { xn: open.xn, xp: open.xp, zn: true, zp: false },
        })
        if (open.xn) {
          dressNear(cx - w * (0.5 - wing / 2), SURFACE, cz, w * wing, streetH, d * (1 - court), baseStyle, {
            shop: true, open: { xn: true, xp: false, zn: false, zp: false },
          })
        }
        if (open.xp) {
          dressNear(cx + w * (0.5 - wing / 2), SURFACE, cz, w * wing, streetH, d * (1 - court), baseStyle, {
            shop: true, open: { xn: false, xp: true, zn: false, zp: false },
          })
        }
      } else {
        pushBuilding(baseCol, baseStyle, cx - w * (0.5 - wing / 2), SURFACE + streetH / 2, cz, w * wing, streetH, d * 0.99, 0)
        pushBuilding(baseCol, baseStyle, cx, SURFACE + streetH / 2, cz - d * (0.5 - wing / 2), w * (1 - court), streetH, d * wing, 0)
        pushBuilding(baseCol, baseStyle, cx, SURFACE + streetH / 2, cz + d * (0.5 - wing / 2), w * (1 - court), streetH, d * wing, 0)
        dressNear(cx - w * (0.5 - wing / 2), SURFACE, cz, w * wing, streetH, d * 0.99, baseStyle, {
          shop: true, open: { xn: true, xp: false, zn: open.zn, zp: open.zp },
        })
        if (open.zn) {
          dressNear(cx, SURFACE, cz - d * (0.5 - wing / 2), w * (1 - court), streetH, d * wing, baseStyle, {
            shop: true, open: { xn: false, xp: false, zn: true, zp: false },
          })
        }
        if (open.zp) {
          dressNear(cx, SURFACE, cz + d * (0.5 - wing / 2), w * (1 - court), streetH, d * wing, baseStyle, {
            shop: true, open: { xn: false, xp: false, zn: false, zp: true },
          })
        }
      }
    } else {
      const yaw = rng() < 0.08 ? range(rng, -0.12, 0.12) : 0
      pushBuilding(baseCol, baseStyle, cx, SURFACE + streetH / 2, cz, w * 0.99, streetH, d * 0.97, yaw)
      dressNear(cx, SURFACE, cz, w * 0.99, streetH, d * 0.97, baseStyle, { shop: true, open })
    }

    // 不是每宗都上塔：隔一栋，避免塔挤成一丛
    const wantTower = opts.forceTower || (
      kind === 'core' || kind === 'high' ? rng() < 0.42 :
      kind === 'wallside' || kind === 'waterfront' ? rng() < 0.28 :
      kind === 'mid' ? rng() < 0.18 :
      kind === 'shop' ? rng() < 0.08 :
      rng() < 0.1
    )

    if (!wantTower) {
      if (kind !== 'shop' && rng() < 0.55) {
        // 矮加建也走体量原型，不再叠一个同轴方块
        placeTower(kind === 'low' ? 'low' : 'mid', cx, cz, w * 0.85, d * 0.85, block, {
          skipPodium: true,
          ...(baseStyle !== 'podium' ? { style: baseStyle, col: baseCol } : {}),
          baseY: SURFACE + streetH,
          height: range(rng, 20, kind === 'low' ? 55 : 100),
        })
      }
      return
    }

    // 塔严格缩进地皮，AABB 与已有塔不相交
    // 注意：窄地皮（约 16m）减掉 2*margin 会得到接近 0 的宽度，
    // 以前会生成 0.02m 宽的「纸片塔」——墙看不见，只剩一片深色屋顶浮在空中。
    const margin = Math.min(8, Math.min(w, d) * 0.2)
    const availW = w - margin * 2
    const availD = d - margin * 2
    if (availW < 12 || availD < 12) return
    const tw = Math.min(availW, w * range(rng, 0.5, 0.68))
    const td = Math.min(availD, d * range(rng, 0.48, 0.65))
    if (Math.min(tw, td) < 12) return
    const tx = cx
    const tz = cz
    if (!canPlaceRect(tx, tz, tw, td, 14)) return

    const towerKind = kind === 'shop' || kind === 'low' || kind === 'mid' ? 'high' : kind
    const baseH = heightFor(towerKind, rng, block)
    const inSpike = nearSpike(cx, cz)
    let shaftH = inSpike
      ? baseH * range(rng, 0.95, 1.2)
      : Math.min(baseH, range(rng, 120, 260)) * range(rng, 0.85, 1.05)
    if (inSpike && kind === 'core' && rng() < 0.55) shaftH = Math.max(shaftH, range(rng, 520, 700))
    else if (inSpike && kind === 'high' && rng() < 0.35) shaftH = Math.max(shaftH, range(rng, 420, 580))
    // 超高只压高度，不再加宽越界
    if (shaftH > Math.min(tw, td) * 10) shaftH = Math.min(tw, td) * range(rng, 8, 10)

    registerTower(tx, tz, tw, td)
    placeTower(towerKind, tx, tz, tw, td, block, {
      skipPodium: true,
      nyc: true,
      ...(baseStyle !== 'podium' ? { style: baseStyle, col: baseCol } : {}),
      baseY: SURFACE + streetH,
      height: Math.max(70, shaftH),
    })
  }

  /** 曼哈顿式：街块切成连续地皮，贴线密建 */
  // ───────── 功能地块：超高 / 别墅区 / 医院 / 学校 / 体育 / 停车 / 加油站 ─────────
  /**
   * 异形塔：扭转 / 收分 / 悬挑 / 双塔+空中连廊 / 曲面（子弹头），坐在可上人的裙房平台上，
   * 平台前面一道大台阶（+扶梯）从街面上来；塔顶冠：灯笼玻璃冠 + 尖塔 + 航空灯
   */
  function placeIconic(b, opts = {}) {
    const lotW = b.w - 6
    const lotD = b.d - 6
    if (Math.min(lotW, lotD) < 56) return false
    curGrp++
    const mega = !!opts.mega
    const podH = range(rng, 9, 14)
    const stairL = 26
    const podW = Math.min(lotW - 4, 110)
    const podD = Math.min(lotD - stairL - 4, 100)
    if (podD < 40) return false
    const pz = b.cz + stairL / 2
    pushBuilding(pick(rng, PODIUM), 'podium', b.cx, SURFACE + podH / 2, pz, podW, podH, podD, 0)
    dressNear(b.cx, SURFACE, pz, podW, podH, podD, 'podium', { shop: true })
    const roofTop = SURFACE + podH + Math.max(1.6, Math.min(3.2, Math.min(podW, podD) * 0.04)) + roofJit * 0.045
    // 大台阶：街面 → 裙房屋顶平台（每级 0.5m，可走上去），一侧并排一部扶梯
    {
      const n = Math.max(6, Math.round((roofTop - SURFACE) / 0.5))
      const rise = (roofTop - SURFACE) / n
      const dep = stairL / n
      const faceZ = pz - podD / 2
      const sw = Math.min(26, podW * 0.34)
      for (let i = 0; i < n; i++) {
        const top = SURFACE + (i + 1) * rise
        const zc = faceZ - (n - i - 0.5) * dep
        push(stoneStep, b.cx, (SURFACE + top) / 2, zc, sw, top - SURFACE, dep + 0.02)
        addSolid(b.cx, zc, sw, dep, top)
      }
      // 扶梯：细密踏步 + 玻璃栏板 + 不锈钢扶手
      const ex = b.cx + sw / 2 + 2.2
      const ne = Math.round((roofTop - SURFACE) / 0.22)
      for (let i = 0; i < ne; i++) {
        const top = SURFACE + (i + 1) * (roofTop - SURFACE) / ne
        push(treadP, ex, top - 0.15, faceZ - stairL + (i + 0.5) * stairL / ne, 1.4, 0.3, stairL / ne + 0.02)
      }
      for (const s of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const t = (i + 0.5) / 6
          push(caseGlass, ex + s * 0.8, SURFACE + t * (roofTop - SURFACE) + 0.6, faceZ - stairL + t * stairL, 0.05, 1.1, stairL / 6 + 0.05)
          push(steelP, ex + s * 0.8, SURFACE + t * (roofTop - SURFACE) + 1.2, faceZ - stairL + t * stairL, 0.1, 0.08, stairL / 6 + 0.05)
        }
      }
      // 平台：屋顶花园（树池 + 绿篱）
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const tx = b.cx + s * (podW / 2 - 6)
          const tz = pz - podD / 2 + 8 + i * (podD - 16) / 2
          push(soilP, tx, roofTop + 0.3, tz, 3.2, 0.6, 3.2)
          push(woodP, tx, roofTop + 2.0, tz, 0.35, 3.2, 0.35)
          push(hedge, tx, roofTop + 4.4, tz, 4.2, 3.0, 4.2)
          push(hedge, tx, roofTop + 5.8, tz, 2.6, 1.6, 2.6)
        }
      }
    }
    const F = Math.min(mega ? 58 : 46, Math.min(podW, podD) * 0.55)
    const H = opts.height ?? (mega ? range(rng, 420, 600) : range(rng, 170, 320))
    const forms = ['twist', 'taper', 'cantilever', 'twin', 'curved']
    const form = opts.form || forms[(rng() * forms.length) | 0]
    const y0 = roofTop - 0.5
    const hex = pick(rng, WALL_GLASS)
    const hex2 = pick(rng, WALL_GLASS)
    const cx = b.cx
    const cz = pz
    registerTower(cx, cz, F * 1.6, F * 1.6)
    const seg = (hx, style, x, y, z, w, h, d, yaw = 0) => {
      push(wallPool(hx, style), x, y, z, w, h, d, yaw)
      addSolid(x, z, w, d, y + h / 2, y - h / 2, yaw)
    }
    const plate = (x, y, z, w, d, yaw = 0) => push(accent, x, y, z, w, 0.7, d, yaw)
    const crown = (x, top, z, w, d, yaw = 0) => {
      push(roofPool(pick(rng, ROOF)), x, top + 0.6, z, w, 1.2, d, yaw)
      push(crownGlow, x, top + 1.2 + 3.5, z, w * 0.62, 7, d * 0.62, yaw)
      push(accent, x, top + 1.2 + 7.4, z, w * 0.7, 0.8, d * 0.7, yaw)
      const sh = range(rng, 18, mega ? 70 : 40)
      push(spireP, x, top + 9 + sh / 2, z, 1.4, sh, 1.4)
      push(beacon, x, top + 9 + sh + 0.6, z, 1.2, 1.2, 1.2)
    }
    if (form === 'twist') {
      const n = Math.max(10, Math.round(H / 14))
      const h = H / n
      const tw = range(rng, Math.PI / 3, Math.PI / 2) * (rng() < 0.5 ? -1 : 1)
      for (let i = 0; i < n; i++) {
        const yaw = tw * i / n
        seg(hex, 'curtain', cx, y0 + h * (i + 0.5), cz, F, h, F * 0.82, yaw)
        plate(cx, y0 + h * (i + 1), cz, F + 1.4, F * 0.82 + 1.4, yaw)
      }
      crown(cx, y0 + H, cz, F, F * 0.82, tw)
    } else if (form === 'taper') {
      const n = Math.max(8, Math.round(H / 16))
      const h = H / n
      let s = 1
      for (let i = 0; i < n; i++) {
        s = 1 - 0.52 * Math.pow(i / n, 1.25)
        seg(hex, i < n * 0.3 ? 'ribbon' : 'curtain', cx, y0 + h * (i + 0.5), cz, F * s, h, F * s * 0.9)
        plate(cx, y0 + h * (i + 1), cz, F * s + 1.2, F * s * 0.9 + 1.2)
      }
      crown(cx, y0 + H, cz, F * s, F * s * 0.9)
    } else if (form === 'cantilever') {
      const hl = H * 0.58
      seg(hex, 'ribbon', cx - F * 0.18, y0 + hl / 2, cz, F, hl, F)
      plate(cx - F * 0.18, y0 + hl, cz, F + 1.2, F + 1.2)
      const uw = F * 1.25
      const ux = cx + F * 0.22
      seg(hex2, 'curtain', ux, y0 + hl + (H - hl) / 2, cz, uw, H - hl, F * 0.78)
      // 悬挑底面一圈厚檐 + 斜撑
      push(accent, ux, y0 + hl + 0.6, cz, uw + 1.2, 1.2, F * 0.78 + 1.2)
      for (const s of [-1, 1]) {
        for (let k = 0; k < 5; k++) {
          const t = (k + 0.5) / 5
          push(accent, cx - F * 0.18 + F / 2 + t * (F * 0.47), y0 + hl - 14 + t * 14, cz + s * F * 0.36, F * 0.47 / 5 + 0.3, 1.0, 1.0)
        }
      }
      crown(ux, y0 + H, cz, uw, F * 0.78)
    } else if (form === 'twin') {
      const tw = F * 0.55
      const gap = F * 0.6
      const hs = [H, H * range(rng, 0.78, 0.9)]
      for (let k = 0; k < 2; k++) {
        const x = cx + (k ? 1 : -1) * (gap / 2 + tw / 2)
        const n = Math.max(6, Math.round(hs[k] / 18))
        const h = hs[k] / n
        for (let i = 0; i < n; i++) {
          const s = i > n * 0.82 ? 0.86 : 1
          seg(k ? hex2 : hex, 'curtain', x, y0 + h * (i + 0.5), cz, tw * s, h, tw * s)
          if (i % 2 === 1) plate(x, y0 + h * (i + 1), cz, tw * s + 1.0, tw * s + 1.0)
        }
        crown(x, y0 + hs[k], cz, tw * 0.86, tw * 0.86)
      }
      // 空中连廊（两道，玻璃廊 + 结构梁）
      for (const f of [0.42, 0.68]) {
        const y = y0 + hs[1] * f
        push(glassPortal, cx, y, cz, gap + 1.0, 7, tw * 0.42)
        push(accent, cx, y - 4.0, cz, gap + 1.0, 1.0, tw * 0.48)
        push(accent, cx, y + 4.0, cz, gap + 1.0, 1.0, tw * 0.48)
      }
    } else {
      // 曲面子弹头：圆柱逐段收半径
      const n = Math.max(10, Math.round(H / 15))
      const h = H / n
      const R = F * 0.55
      let r = R
      for (let i = 0; i < n; i++) {
        const t = i / n
        r = R * (1 - 0.42 * t * t)
        push(cylPool(hex), cx, y0 + h * (i + 0.5), cz, r * 2, h, r * 2)
        addSolid(cx, cz, r * 1.6, r * 1.6, y0 + h * (i + 1), y0 + h * i)
      }
      cylList.push({ x: cx, z: cz, r: R, h: H, y: y0 + H / 2 })
      push(roofCylPool(pick(rng, ROOF)), cx, y0 + H + 0.4, cz, r * 2.05, 0.8, r * 2.05)
      const sh = range(rng, 24, mega ? 80 : 46)
      push(crownGlow, cx, y0 + H + 4, cz, r * 1.1, 7, r * 1.1)
      push(spireP, cx, y0 + H + 8 + sh / 2, cz, 1.6, sh, 1.6)
      push(beacon, cx, y0 + H + 8 + sh + 0.6, cz, 1.2, 1.2, 1.2)
    }
    return true
  }

  function placeSpike(b) {
    if (rng() < 0.55) {
      const hT = Math.min(range(rng, 480, 660), Math.min(b.w, b.d) * 8)
      if (placeIconic(b, { mega: true, height: hT, form: pick(rng, ['twist', 'taper', 'curved', 'twin']) }) !== false) return
    }
    curGrp++
    const podD = Math.min(b.d - 4, 100)
    const podW = Math.min(b.w - 4, podD * 1.4)
    const foot = Math.min(podW, podD) / 1.12
    const podH = range(rng, 28, 40)
    const hTarget = Math.min(range(rng, 520, 700), foot * 10)
    pushBuilding(pick(rng, PODIUM), 'podium', b.cx, SURFACE + podH / 2, b.cz, podW, podH, podD, 0)
    dressNear(b.cx, SURFACE, b.cz, podW, podH, podD, 'podium', { shop: true })
    registerTower(b.cx, b.cz, podW, podD)
    placeTower('core', b.cx, b.cz, foot * 0.95, foot * 0.9, { mega: true, span: 2 }, {
      skipPodium: true, nyc: true, baseY: SURFACE + podH, height: hTarget,
    })
  }
  const sideFace = (nz) => (nz > 0 ? 0 : Math.PI)
  /** 平铺场地（盒子顶面 = SURFACE + top） */
  const walks = []
  const pad = (pool, x, z, w, d, top, th = 0.2) => {
    if (w > 1.5 && d > 1.5) walks.push({ x, z, w, d, y: SURFACE + top })
    return push(pool, x, SURFACE + top - th / 2, z, w, th, d)
  }
  const VILLA = ['#efe8dc', '#e6d8c3', '#d9c9b0', '#f3f0ea', '#cdb79c', '#e9dfd0']
  const VILLA_MOD = ['#f3f0ea', '#ebe8e2', '#dcd8d0', '#d2cdc4']
  const VILLA_MED = ['#f0dcc0', '#ead0aa', '#f2e4cc', '#e6c8a0']
  const VILLA_TUD = ['#efe6d2', '#e8dcc4', '#f2ead8']
  const VILLA_CN = ['#a8a8a2', '#9c9a94', '#b4b0a8']
  /**
   * 地块内停的车：登记到 plan.lotCars，由街道层用真车型（车身轮廓/玻璃/车灯）实例化（以前是方块车）。
   * yaw：车长轴默认沿 x；沿 z 停放传 ±π/2。t 可指定车型（'bus' 等）
   */
  const lotCars = (plan.lotCars = [])
  function lotCar(x, y, z, yaw, t = null, solid = true) {
    lotCars.push({ x, y, z, yaw: yaw + (rng() < 0.5 ? 0 : Math.PI), t })
    if (solid) {
      const along = Math.abs(Math.sin(yaw)) > 0.7
      const L = t === 'bus' ? 12 : 4.6
      addSolid(x, z, along ? 2 : L, along ? L : 2, y + (t === 'bus' ? 3.2 : 1.55), y)
    }
  }
  function villaCar(x, z, alongZ) {
    lotCar(x, SURFACE + 0.02, z, alongZ ? Math.PI / 2 : 0)
  }
  /** 泳池：池岸 + 水面 + 躺椅 + 遮阳伞 */
  function villaPool(cx, cz, pw, pd, nz) {
    pad(pave, cx, cz, pw + 3.2, pd + 3.2, 0.36, 0.12)
    push(villaWater, cx, SURFACE + 0.37, cz, pw, 0.04, pd)
    push(whiteP, cx, SURFACE + 0.4, cz - nz * (pd / 2 + 0.2), pw + 0.4, 0.06, 0.3)
    const n = Math.max(2, Math.floor(pw / 2.4))
    for (let i = 0; i < n; i++) {
      const lx = cx - pw / 2 + (i + 0.5) * (pw / n)
      push(whiteP, lx, SURFACE + 0.62, cz + nz * (pd / 2 + 1.0), 0.7, 0.12, 1.8)
      push(whiteP, lx, SURFACE + 0.8, cz + nz * (pd / 2 + 1.7), 0.7, 0.4, 0.12)
    }
    if (pw > 6) {
      const ux = cx + pw / 2 + 0.6
      const uz = cz + nz * (pd / 2 + 1.2)
      push(rail, ux, SURFACE + 1.5, uz, 0.06, 2.4, 0.06)
      push(pickPool(awningPools), ux, SURFACE + 2.7, uz, 2.6, 0.12, 2.6)
    }
  }
  /** 花境：几簇低矮花丛 + 绿篱球 */
  function flowerBed(x, z, w, d) {
    pad(soilP, x, z, w, d, 0.36, 0.1)
    const n = Math.max(3, Math.floor((w * d) / 1.6))
    for (let i = 0; i < n; i++) {
      push(pickPool(flowerPools), x + range(rng, -w * 0.42, w * 0.42), SURFACE + 0.5, z + range(rng, -d * 0.42, d * 0.42), 0.35, 0.28, 0.35)
    }
  }
  function villaTree(x, z, s = 1) {
    push(tank, x, SURFACE + 1.4 * s, z, 0.32 * s, 2.8 * s, 0.32 * s)
    push(hedge, x, SURFACE + 3.6 * s, z, 3.0 * s, 2.6 * s, 3.0 * s)
    push(hedge, x, SURFACE + 4.8 * s, z, 2.0 * s, 1.6 * s, 2.0 * s)
  }
  function withGable(idx, k, fn) {
    forceGable = true
    gableIdx = idx
    gableK = k
    fn()
    forceGable = false
    gableIdx = -1
    gableK = 0
  }
  /** 一宗别墅地：cls = 0 小(120~200㎡) / 1 中 / 2 大 / 3 庄园（跨两排） */
  function villaLot(x0, lw, edge, nz, lotD, cls) {
    curGrp++
    const lx = x0 + lw / 2
    const lz = edge - nz * lotD / 2
    pad(lawn, lx, lz, lw - 0.4, lotD - 0.4, 0.3, 0.3)
    const r = rng()
    const canCN = lw >= 34 && lotD >= 34 && cls >= 1
    const style = canCN && r < 0.22 ? 'cn' : r < 0.5 ? 'mod' : r < 0.76 ? 'med' : 'tud'
    const S = [[8, 10, 8, 10, 2], [11, 15, 11, 14, 2], [15, 21, 13, 17, 3], [22, 30, 16, 22, 3]][cls]
    const setback = [5, 7, 9.5, 14][cls]
    const bays = [1, 1, 2, 3][cls]
    const garW = bays * 3.3 + 0.6
    let hw = Math.min(lw - garW - 6, range(rng, S[0], S[1]))
    let hd = Math.min(lotD - setback - 8, range(rng, S[2], S[3]))
    if (hw < 7 || hd < 7) return
    const floors = cls === 0 ? 2 : rng() < 0.4 ? 3 : S[4]
    const garL = rng() < 0.5
    const hx = lx + (garL ? 1 : -1) * (garW / 2 + 0.5)
    const hz = edge - nz * (setback + hd / 2)
    const fz = hz + nz * hd / 2
    const doorX = hx + (garL ? 1 : -1) * hw * 0.12

    if (style === 'cn') {
      // 中式合院：正房 + 东西厢房 + 倒座/院门，灰墙黛瓦红柱，院中一棵树
      const col = pick(rng, VILLA_CN)
      const cw = Math.min(lw - 4, hw + 10)
      const cd = Math.min(lotD - setback - 2, hd + 12)
      const ccx = lx
      const ccz = edge - nz * (setback + cd / 2)
      const hallD = Math.min(9, cd * 0.3)
      const wingW = Math.min(7, cw * 0.24)
      const hh = 4.4
      withGable(3, 0.36, () => {
        pushBuilding(col, 'punch', ccx, SURFACE + hh / 2, ccz - nz * (cd / 2 - hallD / 2), cw, hh, hallD)
        pushBuilding(col, 'punch', ccx - cw / 2 + wingW / 2, SURFACE + 3.8 / 2, ccz, wingW, 3.8, cd - hallD * 2 - 0.4)
        pushBuilding(col, 'punch', ccx + cw / 2 - wingW / 2, SURFACE + 3.8 / 2, ccz, wingW, 3.8, cd - hallD * 2 - 0.4)
        pushBuilding(col, 'punch', ccx + cw * 0.18, SURFACE + 3.6 / 2, ccz + nz * (cd / 2 - 3), cw * 0.6, 3.6, 6)
      })
      // 院门（红门 + 门楼）+ 院墙
      const gx = ccx - cw * 0.33
      const gz = ccz + nz * (cd / 2)
      push(wallGrey, gx, SURFACE + 1.6, gz - nz * 0.2, cw * 0.36, 3.2, 0.5)
      push(redP, gx, SURFACE + 1.3, gz + nz * 0.08, 1.8, 2.6, 0.1)
      push(gablePools[3], gx, SURFACE + 3.6, gz, 3.6, 1.0, 1.6)
      // 院子
      const yardD = cd - hallD * 2 - 0.6
      const yardW = cw - wingW * 2 - 0.6
      pad(pave, ccx, ccz, yardW, yardD, 0.36, 0.1)
      villaTree(ccx + yardW * 0.2, ccz, 0.9)
      flowerBed(ccx - yardW * 0.22, ccz - yardD * 0.2, 2.4, 1.6)
      // 正房檐下红柱一排
      const pz = ccz - nz * (cd / 2 - hallD - 0.7)
      for (let i = 0; i < 6; i++) push(redP, ccx - cw * 0.35 + i * (cw * 0.7 / 5), SURFACE + 1.9, pz, 0.32, 3.2, 0.32)
      push(wallGrey, ccx, SURFACE + 3.6, pz, cw * 0.74, 0.25, 1.6)
      for (const s of [-1, 1]) push(redP, gx + s * 1.1, SURFACE + 3.6, gz + nz * 0.3, 0.6, 0.6, 0.2) // 灯笼
      // 外围院墙
      push(wallGrey, lx, SURFACE + 1.3, edge - nz * 0.5, lw - 1, 2.0, 0.4)
      pad(pave, gx, edge - nz * (setback / 2), 2.2, setback, 0.34, 0.1)
      if (cls >= 2 && rng() < 0.6) {
        // 后院鱼池
        const ppz = ccz - nz * (cd / 2 + 4)
        if (Math.abs(ppz - lz) < lotD / 2 - 3) push(villaWater, lx, SURFACE + 0.37, ppz, Math.min(10, lw * 0.4), 0.04, 3.5)
      }
      return
    }

    // 主屋
    const flH = 3.3
    const hh = floors * flH + 0.4
    if (style === 'mod') {
      // 现代平顶：底层 + 错位悬挑的上层（玻璃/白墙），屋顶露台
      const col = pick(rng, VILLA_MOD)
      pushBuilding(col, 'ribbon', hx, SURFACE + flH / 2, hz, hw, flH, hd)
      const ux = hx + (garL ? -1 : 1) * hw * 0.12
      const uw = hw * range(rng, 0.85, 1.05)
      const ud = hd * range(rng, 0.7, 0.85)
      const uz = hz + nz * (hd - ud) / 2 + nz * 1.8
      pushBuilding(rng() < 0.4 ? pick(rng, WALL_GLASS) : col, rng() < 0.4 ? 'curtain' : 'ribbon', ux, SURFACE + flH + (flH * (floors - 1)) / 2, uz, uw, flH * (floors - 1), ud)
      // 悬挑下的木格栅、整面落地窗
      push(villaWinLit, hx, SURFACE + 1.55, fz + nz * 0.06, hw * 0.62, 2.5, 0.08)
      push(villaWood, hx - nz * 0, SURFACE + flH - 0.1, uz + nz * (ud / 2 - 0.3), uw * 0.98, 0.2, 0.6)
      // 屋顶露台栏杆
      const ry = SURFACE + flH * floors + 1.6
      push(rail, ux, ry, uz + nz * ud / 2, uw, 0.06, 0.06)
      push(villaWater, hx, SURFACE + flH + 2.05, hz - nz * hd * 0.32, hw * 0.4, 0.05, 2.2)
    } else if (style === 'med') {
      // 地中海：暖色抹灰 + 陶红缓坡顶 + 拱廊 + 二层露台
      const col = pick(rng, VILLA_MED)
      withGable(0, 0.2, () => pushBuilding(col, 'punch', hx, SURFACE + hh / 2, hz, hw, hh, hd))
      const lw2 = hw * 0.7
      const lzz = fz + nz * 1.6
      for (let i = 0; i <= 4; i++) push(whiteP, hx - lw2 / 2 + i * (lw2 / 4), SURFACE + 1.65, lzz, 0.45, 3.0, 0.45)
      push(balcony, hx, SURFACE + 3.3, lzz - nz * 0.75, lw2 + 0.6, 0.3, 2.1)
      push(rail, hx, SURFACE + 3.95, lzz + nz * 0.3, lw2 + 0.6, 0.06, 0.06)
      push(rail, hx, SURFACE + 3.65, lzz + nz * 0.3, lw2 + 0.6, 0.6, 0.03)
      push(pickPool(flowerPools), hx, SURFACE + 3.55, lzz + nz * 0.15, lw2 * 0.9, 0.25, 0.3)
    } else {
      // 都铎：奶白墙 + 深色木构架 + 陡坡顶 + 砖烟囱
      const col = pick(rng, VILLA_TUD)
      withGable(1, 0.52, () => pushBuilding(col, 'punch', hx, SURFACE + hh / 2, hz, hw, hh, hd))
      for (let i = 0; i <= Math.floor(hw / 1.7); i++) push(timber, hx - hw / 2 + 0.1 + i * ((hw - 0.2) / Math.floor(hw / 1.7)), SURFACE + flH + (hh - flH) / 2, fz + nz * 0.05, 0.18, hh - flH, 0.08)
      for (let f = 1; f < floors + 1; f++) push(timber, hx, SURFACE + f * flH, fz + nz * 0.06, hw, 0.22, 0.09)
      for (let i = 0; i < Math.floor(hw / 3.4); i++) {
        const x1 = hx - hw / 2 + 1.7 + i * 3.4
        push(timber, x1, SURFACE + flH * 0.5, fz + nz * 0.06, 0.16, flH * 0.9, 0.08)
      }
      const chx = hx + (garL ? -1 : 1) * hw * 0.38
      push(brickP, chx, SURFACE + hh + Math.min(hw, hd) * 0.3, hz - nz * hd * 0.2, 1.2, Math.min(hw, hd) * 0.6 + 2, 1.2)
      push(villaWin, doorX - 2.6, SURFACE + flH + 1.6, fz + nz * 0.5, 2.0, 1.6, 0.9) // 凸窗
    }
    // 入户：门 + 门廊 + 台阶 + 门灯
    push(door, doorX, SURFACE + 1.25, fz + nz * 0.06, 1.3, 2.4, 0.12)
    push(canopy, doorX, SURFACE + 2.75, fz + nz * 0.9, 2.8, 0.15, 1.8)
    for (const s of [-1, 1]) push(whiteP, doorX + s * 1.25, SURFACE + 1.4, fz + nz * 1.6, 0.22, 2.7, 0.22)
    push(pave, doorX, SURFACE + 0.45, fz + nz * 2.1, 2.4, 0.3, 1.2)
    push(villaWinLit, doorX + 0.9, SURFACE + 2.1, fz + nz * 0.15, 0.2, 0.3, 0.15)
    for (const k of [-0.36, -0.12, 0.14, 0.36]) {
      const wx = hx + k * hw
      if (Math.abs(wx - doorX) < 1.9) continue
      push(rng() < 0.45 ? villaWinLit : villaWin, wx, SURFACE + 1.7, fz + nz * 0.05, Math.min(2.2, hw * 0.16), 1.7, 0.1)
      push(whiteP, wx, SURFACE + 0.82, fz + nz * 0.12, Math.min(2.4, hw * 0.18), 0.1, 0.25)
    }
    // 二层阳台
    if (floors >= 2 && style !== 'mod') {
      const bx2 = hx + (garL ? -1 : 1) * hw * 0.22
      push(balcony, bx2, SURFACE + flH + 0.1, fz + nz * 0.8, hw * 0.34, 0.2, 1.6)
      push(rail, bx2, SURFACE + flH + 1.1, fz + nz * 1.55, hw * 0.34, 0.06, 0.06)
      push(rail, bx2, SURFACE + flH + 0.65, fz + nz * 1.57, hw * 0.34, 0.9, 0.02)
    }
    // 大宅：侧翼
    if (cls >= 2) {
      const wwid = hw * 0.45
      const wdep = hd * 0.55
      const wx = hx + (garL ? -1 : 1) * 0 + (rng() < 0.5 ? -1 : 1) * (hw / 2 - wwid / 2)
      const wz = hz - nz * (hd / 2 + wdep / 2 - 0.2)
      if (Math.abs(wz - lz) + wdep / 2 < lotD / 2 - 3) {
        const col = style === 'mod' ? pick(rng, VILLA_MOD) : style === 'med' ? pick(rng, VILLA_MED) : pick(rng, VILLA_TUD)
        const fn = () => pushBuilding(col, style === 'mod' ? 'ribbon' : 'punch', wx, SURFACE + flH, wz, wwid, flH * 2, wdep)
        if (style === 'mod') fn()
        else withGable(style === 'med' ? 0 : 1, style === 'med' ? 0.2 : 0.5, fn)
      }
    }
    // 车库：贴主屋侧面，平顶，卷帘门朝街（大宅 2~3 车位）
    const gx = hx + (garL ? -1 : 1) * (hw / 2 + garW / 2 + 0.1)
    const gz = edge - nz * (setback + 3.5)
    pushBuilding(style === 'mod' ? pick(rng, VILLA_MOD) : pick(rng, VILLA), 'podium', gx, SURFACE + 1.7, gz, garW, 3.4, 7)
    for (let i = 0; i < bays; i++) {
      const bx2 = gx - garW / 2 + 0.3 + 1.65 + i * 3.3
      push(fence, bx2, SURFACE + 1.25, gz + nz * 3.53, 2.8, 2.3, 0.08)
      for (let k = 0; k < 5; k++) push(rail, bx2, SURFACE + 0.35 + k * 0.45, gz + nz * 3.58, 2.8, 0.03, 0.03)
    }
    const dLen = setback
    pad(pave, gx, edge - nz * dLen / 2, garW, dLen, 0.34, 0.1)
    pad(pave, doorX, edge - nz * (setback / 2), 1.4, setback - 2.5, 0.34, 0.1)
    const nCars = Math.min(bays, 1 + ((rng() * bays) | 0))
    for (let i = 0; i < nCars; i++) if (rng() < 0.7 && setback > 5.2) villaCar(gx - garW / 2 + 0.3 + 1.65 + i * 3.3, edge - nz * Math.min(setback - 2.6, 3.0), true)
    // 临街围栏 / 绿篱 + 门柱（车道、步道留口）
    const useHedge = cls >= 2 ? rng() < 0.6 : rng() < 0.35
    const fp = useHedge ? hedge : fence
    const fh = useHedge ? 1.4 : 1.1
    const ft = useHedge ? 0.8 : 0.1
    const gaps = [[gx - garW / 2 - 0.2, gx + garW / 2 + 0.2], [doorX - 1.0, doorX + 1.0]].sort((a, c) => a[0] - c[0])
    let s0 = x0 + 0.3
    for (const [g0, g1] of [...gaps, [x0 + lw - 0.3, x0 + lw]]) {
      if (g0 - s0 > 0.4) push(fp, (s0 + g0) / 2, SURFACE + 0.3 + fh / 2, edge - nz * 0.4, g0 - s0, fh, ft)
      s0 = Math.max(s0, g1)
    }
    for (const [g0, g1] of gaps) for (const gxx of [g0, g1]) push(brickP, gxx, SURFACE + 1.0, edge - nz * 0.4, 0.5, 1.5, 0.5)
    push(fp, x0 + 0.3, SURFACE + 0.3 + fh / 2, lz, ft, fh, lotD - 1)
    // 前院花境 + 树
    flowerBed(lx + (garL ? 1 : -1) * lw * 0.28, edge - nz * Math.min(setback * 0.5, 3), Math.min(5, lw * 0.18), 1.4)
    if (cls >= 1) villaTree(lx + (garL ? 1 : -1) * lw * 0.38, edge - nz * Math.max(2.5, setback * 0.55), 0.9 + cls * 0.1)
    // 后院：露台 + 花架 + 泳池（中 30% / 大 70% / 庄园必有）
    const backZ = hz - nz * (hd / 2 + 2.2)
    pad(pave, hx, backZ, hw * 0.7, 3.6, 0.34, 0.1)
    for (const s of [-1, 1]) push(villaWood, hx + s * hw * 0.32, SURFACE + 1.6, backZ - nz * 1.4, 0.18, 2.6, 0.18)
    push(villaWood, hx, SURFACE + 2.9, backZ - nz * 1.4, hw * 0.66, 0.15, 0.15)
    for (let i = 0; i < 6; i++) push(villaWood, hx - hw * 0.3 + i * hw * 0.12, SURFACE + 3.0, backZ, 0.12, 0.12, 3.2)
    const room = lotD / 2 - Math.abs(backZ - lz) - 2
    if (room > 5 && rng() < [0, 0.3, 0.7, 1][cls]) {
      const pd = Math.min(room - 1.5, cls === 3 ? 7 : 4.5)
      const pw = Math.min(lw * 0.55, cls === 3 ? 16 : cls === 2 ? 11 : 7)
      if (pd > 2.5) villaPool(hx + (rng() - 0.5) * 2, backZ - nz * (pd / 2 + 3.6), pw, pd, nz)
    } else {
      flowerBed(hx - hw * 0.25, backZ - nz * 4, 3, 1.5)
      for (let i = 0; i < 3; i++) push(hedge, lx + range(rng, -lw * 0.42, lw * 0.42), SURFACE + 0.9, lz - nz * range(rng, 0, lotD * 0.4), 1.3, 1.3, 1.3)
    }
    if (cls === 3) {
      // 庄园：林荫车道两侧树 + 喷泉
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) villaTree(doorX + s * 3.2, edge - nz * (2 + i * (setback - 3) / 3), 0.8)
      push(villaWater, doorX + (garL ? 1 : -1) * 6, SURFACE + 0.4, edge - nz * setback * 0.55, 3.2, 0.12, 3.2)
      push(whiteP, doorX + (garL ? 1 : -1) * 6, SURFACE + 0.9, edge - nz * setback * 0.55, 0.5, 1.2, 0.5)
    }
  }
  function fillVilla(b) {
    // 别墅区：大小不一（120㎡ 小独栋 → 600㎡+ 跨两排的庄园），四种风格（现代 / 地中海 / 都铎 / 中式合院）
    const rowD = (b.d - 2) / 2
    let x = b.x0 + 1
    while (x < b.x1 - 18) {
      const r = rng()
      let cls = r < 0.28 ? 0 : r < 0.62 ? 1 : r < 0.88 ? 2 : 3
      let lw = [range(rng, 18, 22), range(rng, 26, 34), range(rng, 38, 50), range(rng, 56, 80)][cls]
      if (b.x1 - 1 - (x + lw) < 18) lw = b.x1 - 1 - x
      if (cls === 3 && b.d < 80) cls = 2
      if (cls === 3) {
        villaLot(x, lw, b.z0 + 1, -1, b.d - 2, 3)
      } else {
        villaLot(x, lw, b.z0 + 1, -1, rowD, cls)
        // 另一排独立选尺寸（同列宽，户型不同）
        const cls2 = Math.max(0, Math.min(2, cls + (rng() < 0.5 ? -1 : rng() < 0.5 ? 1 : 0)))
        villaLot(x, lw, b.z1 - 1, 1, rowD, lw < 24 ? 0 : cls2)
      }
      x += lw
    }
  }
  // 立面招牌登记：同一立面平面上的招牌/海报/灯带互不重叠（后放的先查 signFree）
  const signRects = []
  function regSign(x, y, z, w, h, nx, nz) {
    signRects.push({ nx, nz, p: nz ? z : x, u: nz ? x : z, w, y, h })
  }
  function signFree(x, y, z, w, h, nx, nz, gap = 1.2) {
    const p = nz ? z : x
    const u = nz ? x : z
    for (const r of signRects) {
      if (Math.abs(r.p - p) > 3) continue
      if ((r.nx !== 0) !== (nx !== 0)) continue
      if (Math.abs(r.u - u) * 2 < r.w + w + gap * 2 && Math.abs(r.y - y) * 2 < r.h + h + gap * 2) return false
    }
    return true
  }
  function board(k, x, y, z, w, nz) {
    // 招牌离墙 0.75m 立在钢架上：立面上的窗台/层间板/竖梃（外挑 ≤0.6m）都在它后面，不会横穿招牌
    const zz = z + nz * 0.75
    push(boards[k], x, y, zz, w, w / 4, 0.25, sideFace(nz))
    push(billFrame, x, y, zz - nz * 0.2, w + 0.3, w / 4 + 0.3, 0.12)
    for (const s of [-1, 1]) push(billFrame, x + s * w * 0.3, y, z + nz * 0.35, 0.12, 0.12, 0.8)
    regSign(x, y, zz, w, w / 4, 0, nz)
  }
  function fillHospital(b) {
    curGrp++
    const nz = -1
    const w = Math.min(b.w - 40, 120)
    const d = Math.min(b.d - 22, 30)
    const h = range(rng, 34, 46)
    const cx = b.cx + 8
    const cz = b.cz + 4
    const hex = pick(rng, ['#eef0ee', '#e4ebef', '#f1eee8'])
    pushBuilding(hex, 'ribbon', cx, SURFACE + h / 2, cz, w, h, d)
    dressFacade(cx, SURFACE, cz, w, h, d, 'ribbon')
    const fz = cz + nz * d / 2
    // 主入口：雨棚 + 玻璃门 + 院名大字 + 红十字（楼顶）
    // 雨棚压低到 4.6m，院名牌整块在雨棚之上（以前牌底 4.7m 被 5.2m 的雨棚挡住一截）
    push(canopy, cx, SURFACE + 4.6, fz + nz * 4, 18, 0.4, 8)
    for (const s of [-1, 1]) push(whiteP, cx + s * 8.5, SURFACE + 2.3, fz + nz * 7.6, 0.5, 4.6, 0.5)
    push(doorGlass, cx, SURFACE + 1.6, fz + nz * 0.08, 10, 3.2, 0.12)
    {
      const sw = Math.min(28, w * 0.4)
      board('hospital', cx, SURFACE + 5.6 + sw / 8, fz + nz * 0.2, sw, nz)
    }
    push(crossP, cx + w * 0.32, SURFACE + h + 5.5, fz + nz * 0.4, 8, 8, 0.4, sideFace(nz))
    push(crossP, cx - w / 2 - 0.3, SURFACE + h - 6, cz, 7, 7, 0.4, -Math.PI / 2)
    // 急诊楼 + 救护车位
    const ew = Math.max(14, (b.x1 - b.x0 - w) / 2 - 6)
    const ex = b.x0 + 3 + ew / 2
    if (ew > 12) {
      curGrp++
      pushBuilding(hex, 'punch', ex, SURFACE + 4.5, cz, ew, 9, d)
      const efz = cz + nz * d / 2
      push(redP, ex, SURFACE + 9.2, efz + nz * 0.2, ew, 0.5, 0.3)
      board('emergency', ex, SURFACE + 7.3, efz + nz * 0.25, Math.min(10, ew * 0.6), nz)
      push(canopy, ex, SURFACE + 4.4, efz + nz * 5, ew * 0.9, 0.4, 10)
      push(doorGlass, ex, SURFACE + 1.5, efz + nz * 0.08, 5, 3, 0.12)
      for (let i = 0; i < 2; i++) {
        const ax = ex + (i - 0.5) * 4.2
        const az = efz + nz * 6
        push(whiteP, ax, SURFACE + 1.4, az, 2.3, 2.2, 6)
        push(redP, ax, SURFACE + 1.3, az, 2.32, 0.3, 6.02)
        push(redP, ax, SURFACE + 2.6, az + nz * 1.8, 1.4, 0.18, 0.4)
        addSolid(ax, az, 2.3, 6, SURFACE + 2.6)
      }
    }
    pad(pave, cx, b.z0 + 6, w + 10, 10, 0.3)
  }
  function lines(x, z, w, d, t = 0.12, top = 0.36) {
    pad(lineW, x, z - d / 2, w, t, top, 0.06)
    pad(lineW, x, z + d / 2, w, t, top, 0.06)
    pad(lineW, x - w / 2, z, t, d, top, 0.06)
    pad(lineW, x + w / 2, z, t, d, top, 0.06)
  }
  function footballPitch(x, z, len, wid) {
    // 沿 x 方向的标准足球场：边线/中线/中圈/禁区
    pad(pitchG, x, z, len + 6, wid + 6, 0.3, 0.3)
    lines(x, z, len, wid)
    pad(lineW, x, z, 0.12, wid, 0.36, 0.06)
    push(lineRing, x, SURFACE + 0.35, z, 9.15, 1, 9.15)
    for (const s of [-1, 1]) {
      lines(x + s * (len / 2 - 8.25), z, 16.5, Math.min(40.3, wid * 0.6))
      lines(x + s * (len / 2 - 2.75), z, 5.5, Math.min(18.3, wid * 0.3))
      // 球门
      push(whiteP, x + s * (len / 2 + 0.8), SURFACE + 2.44, z, 1.6, 0.12, 7.32)
      push(whiteP, x + s * (len / 2), SURFACE + 1.22, z - 3.66, 0.12, 2.44, 0.12)
      push(whiteP, x + s * (len / 2), SURFACE + 1.22, z + 3.66, 0.12, 2.44, 0.12)
    }
  }
  function basketball(x, z) {
    pad(courtB, x, z, 30, 17, 0.3, 0.3)
    lines(x, z, 28, 15)
    pad(lineW, x, z, 0.1, 15, 0.36, 0.06)
    push(lineRing, x, SURFACE + 0.35, z, 1.8, 1, 1.8)
    for (const s of [-1, 1]) {
      push(rail, x + s * 14.6, SURFACE + 1.7, z, 0.15, 3.4, 0.15)
      push(whiteP, x + s * 14.2, SURFACE + 3.4, z, 0.08, 1.05, 1.8)
      push(redP, x + s * 13.9, SURFACE + 3.05, z, 0.45, 0.05, 0.45)
      addSolid(x + s * 14.6, z, 0.3, 0.3, SURFACE + 3.9)
    }
    // 球场围网
    for (const [fx, fz, fw, fd] of [[x, z - 9, 32, 0.06], [x, z + 9, 32, 0.06], [x - 16, z, 0.06, 18], [x + 16, z, 0.06, 18]]) {
      push(rail, fx, SURFACE + 3.6, fz, fw, 0.08, fd)
      push(rail, fx, SURFACE + 0.35, fz, fw, 0.08, fd)
    }
    for (const s of [-1, 1]) for (const t of [-1, 1]) push(rail, x + s * 16, SURFACE + 1.8, z + t * 9, 0.1, 3.6, 0.1)
  }
  function fillSchool(b) {
    curGrp++
    // 校园：整圈围栏 + 校门（门楣挂校名）+ 教学楼群 + 风雨操场/体育馆 + 篮球场 + 环形跑道包足球场 + 升旗台 + 树
    const x0 = b.x0 + 2, x1 = b.x1 - 2, z0 = b.z0 + 2, z1 = b.z1 - 2
    const gx = b.cx
    if (b.big) pad(pave, b.cx, b.cz, b.w, b.d, 0.16, 0.16)
    enclose(x0, x1, z0, z1, 'fence', gx, 12)
    gateArch(gx, z0, 12, 5.2, 'school')
    const hex = pick(rng, ['#e8d6b4', '#d9a27c', '#efe6d6', '#c98f6c'])
    if (b.big || b.d > 120) {
      // 后半：400m 跑道（直道 + 两端半圆近似）+ 足球场 + 看台
      const tw = Math.min(x1 - x0 - 10, 168)
      const td = Math.min((z1 - z0) * 0.5, 90)
      const tz = z1 - 3 - td / 2
      const tcx = (x0 + x1) / 2
      pad(trackR, tcx, tz, tw, td, 0.26, 0.26)
      for (let i = 1; i <= 6; i++) lines(tcx, tz, tw - i * 2.4, td - i * 2.4, 0.08, 0.3)
      pad(pitchG, tcx, tz, tw - 32, td - 32, 0.31, 0.06)
      footballPitch(tcx, tz, Math.min(tw - 40, 100), Math.min(td - 36, 60))
      for (let i = 0; i < 4; i++) push(stoneStep, tcx, SURFACE + 0.35 + i * 0.4, tz - td / 2 - 1.2 - i * 0.9, tw * 0.5, 0.7 + i * 0.8, 0.9)
      // 前半：两栋平行教学楼（东）+ 行政楼 + 体育馆（西）+ 篮球场 + 升旗台
      const fz0 = z0 + 10
      const fz1 = tz - td / 2 - 8
      const fd = fz1 - fz0
      const tbw = Math.min(70, (x1 - x0) * 0.42)
      const tbx = x1 - 4 - tbw / 2
      const bd = Math.min(16, fd * 0.3)
      facBuilding(hex, 'ribbon', tbx, fz0 + bd / 2 + 2, tbw, 20, bd)
      facBuilding(hex, 'ribbon', tbx, fz1 - bd / 2, tbw, 20, bd)
      facBuilding(hex, 'ribbon', x1 - 4 - 6, (fz0 + fz1) / 2, 12, 16, fd - bd * 2 - 6)
      const gyw = Math.min(44, (x1 - x0) * 0.26)
      const gyx = x0 + 4 + gyw / 2
      facBuilding('#dfe3e6', 'podium', gyx, fz1 - 15, gyw, 13, 28)
      push(gablePools[3], gyx, SURFACE + 15, fz1 - 15, gyw + 1, 4, 29)
      const bcx = gyx + gyw / 2 + 20
      if (bcx + 16 < tbx - tbw / 2 - 4) basketball(bcx, fz0 + 12)
      if (bcx + 52 < tbx - tbw / 2 - 4) basketball(bcx + 36, fz0 + 12)
      push(stoneStep, gx, SURFACE + 0.4, z0 + 12, 8, 0.8, 6)
      push(whiteP, gx, SURFACE + 7, z0 + 12, 0.2, 13, 0.2)
      push(redP, gx + 1.3, SURFACE + 12.4, z0 + 12, 2.4, 1.6, 0.05)
      treeRow(x0 + 4, z0 + 4, x0 + 4, z1 - 4, 10)
      treeRow(x1 - 2, tz - td / 2, x1 - 2, z1 - 4, 10, 0.9)
      treeRow(gx + 10, z0 + 6, tbx - tbw / 2 - 4, z0 + 6, 9)
    } else {
      // 单格校园：教学楼 + 篮球场 + 小足球场 + 树
      const bw = Math.min((x1 - x0) * 0.4, 70)
      const bx = x0 + 3 + bw / 2
      const d = Math.min(18, z1 - z0 - 18)
      facBuilding(hex, 'ribbon', bx, z1 - 3 - d / 2, bw, 18, d)
      let x = bx + bw / 2 + 6
      if (x1 - x > 70) { footballPitch(x + 30, b.cz + 2, 50, Math.min(32, z1 - z0 - 18)); x += 64 }
      while (x1 - x > 34) { basketball(x + 17, b.cz + 4); x += 36 }
      treeRow(x0 + 4, z0 + 6, bx + bw / 2, z0 + 6, 9)
    }
  }
  function fillSports(b) {
    curGrp++
    // 全民健身中心：大跨体育馆（双坡金属屋面 + 玻璃门厅）+ 室外泳池 + 网球场（围网）+ 篮球场；不再用气膜罩
    const hallW = Math.min(66, b.w * 0.36)
    const hallD = Math.min(b.d - 12, 54)
    const hx = b.x0 + 3 + hallW / 2
    const hz = b.z1 - 3 - hallD / 2
    facBuilding('#d8dde2', 'podium', hx, hz, hallW, 14, hallD)
    push(gablePools[3], hx, SURFACE + 16, hz, hallW + 1.5, 4, hallD + 1.5)
    const front = hz - hallD / 2
    push(glassPortal, hx, SURFACE + 3, front - 3, hallW * 0.6, 6, 6)
    addSolid(hx, front - 3, hallW * 0.6, 6, SURFACE + 6)
    board('gym', hx, SURFACE + 10, front - 0.4, 22, -1)
    let x = hx + hallW / 2 + 6
    // 室外泳池（50m×21m 或缩小）+ 泳道线 + 池岸 + 救生椅
    const pw = Math.min(50, b.x1 - x - 50)
    if (pw > 22 && b.d > 40) {
      const pd = Math.min(21, b.d - 22)
      const pcx = x + pw / 2 + 2
      pad(pave, pcx, b.cz, pw + 8, pd + 8, 0.34, 0.12)
      push(villaWater, pcx, SURFACE + 0.3, b.cz, pw, 0.35, pd)
      for (let i = 1; i < Math.floor(pd / 2.5); i++) push(lineW, pcx, SURFACE + 0.5, b.cz - pd / 2 + i * 2.5, pw, 0.05, 0.08)
      push(whiteP, pcx - pw / 2 - 2, SURFACE + 1.2, b.cz, 0.8, 2.4, 0.8)
      x += pw + 12
    }
    while (b.x1 - 2 - x > 37) {
      if (b.d > 44) { tennis(x + 18, b.cz - b.d / 4); tennis(x + 18, b.cz + b.d / 4) } else tennis(x + 18, b.cz)
      x += 38
      if (b.x1 - 2 - x > 33) {
        basketball(x + 16, b.cz - (b.d > 44 ? b.d / 4 : 0))
        if (b.d > 44) basketball(x + 16, b.cz + b.d / 4)
        x += 34
      }
    }
  }
  function fillParking(b, x0, x1, z0, z1) {
    curGrp++
    const w = x1 - x0
    const d = z1 - z0
    if (w < 20 || d < 20) return
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    pad(tarmac, cx, cz, w - 1, d - 1, 0.25, 0.2)
    // 两排车位一条车道：5.2m 深 x 2.6m 宽
    const rows = Math.floor((d - 4) / 17)
    for (let r = 0; r < rows; r++) {
      const zc = z0 + 2 + 8.5 + r * 17
      for (const s of [-1, 1]) {
        const zs = zc + s * 5.6
        for (let x = x0 + 4; x < x1 - 4; x += 2.6) {
          pad(lineW, x, zs, 0.12, 5.2, 0.29, 0.06)
          if (rng() < 0.62) lotCar(x + 1.3, SURFACE + 0.25, zs, Math.PI / 2)
        }
      }
    }
    push(rail, x0 + 3, SURFACE + 2.2, z0 + 3, 0.15, 4.4, 0.15)
    push(boards.parking, x0 + 3, SURFACE + 4.6, z0 + 2.85, 4, 1, 0.15, Math.PI)
  }
  function fillGas(b) {
    curGrp++
    const gw = Math.min(56, b.w * 0.5)
    const gx = b.x0 + gw / 2 + 1
    const gz = b.cz
    pad(tarmac, gx, gz, gw, b.d - 2, 0.25, 0.2)
    // 罩棚：白顶 + 红色檐带，四柱，两岛四机
    const cw = 26
    const cd = 16
    push(whiteP, gx, SURFACE + 6.2, gz, cw, 0.8, cd)
    push(redP, gx, SURFACE + 6.2, gz - cd / 2 - 0.05, cw + 0.1, 0.9, 0.12)
    push(redP, gx, SURFACE + 6.2, gz + cd / 2 + 0.05, cw + 0.1, 0.9, 0.12)
    push(redP, gx - cw / 2 - 0.05, SURFACE + 6.2, gz, 0.12, 0.9, cd)
    push(redP, gx + cw / 2 + 0.05, SURFACE + 6.2, gz, 0.12, 0.9, cd)
    push(boards.gas, gx, SURFACE + 6.2, gz - cd / 2 - 0.15, 3.2, 0.8, 0.06, Math.PI)
    for (const s of [-1, 1]) {
      const ix = gx + s * 6
      push(pave, ix, SURFACE + 0.35, gz, 2.2, 0.2, 9)
      for (const t of [-1, 1]) {
        push(whiteP, ix, SURFACE + 1.3, gz + t * 2.6, 0.9, 1.8, 0.6)
        push(redP, ix, SURFACE + 2.35, gz + t * 2.6, 0.92, 0.3, 0.62)
        addSolid(ix, gz + t * 2.6, 1.0, 0.7, SURFACE + 2.5)
      }
      push(whiteP, ix, SURFACE + 3.0, gz, 0.6, 5.6, 0.6)
      addSolid(ix, gz, 0.6, 0.6, SURFACE + 6.6)
    }
    // 便利店
    const sx = gx + cw / 2 + 9
    if (sx + 7 < b.x0 + gw) {
      pushBuilding('#e9e6e0', 'podium', sx, SURFACE + 2.4, gz + 4, 12, 4.8, 10)
      push(doorGlass, sx, SURFACE + 1.5, gz - 1.08, 9, 2.6, 0.1)
      push(boards.gas, sx, SURFACE + 3.9, gz - 1.15, 6, 1.5, 0.08, Math.PI)
    }
    // 价格牌
    push(whiteP, b.x0 + 3, SURFACE + 3.5, b.z0 + 3, 0.3, 7, 0.3)
    push(boards.gas, b.x0 + 3, SURFACE + 7.4, b.z0 + 3, 4, 1, 0.3, Math.PI)
    if (b.x1 - (b.x0 + gw + 2) > 24) fillParking(b, b.x0 + gw + 2, b.x1, b.z0, b.z1)
  }

  // ── Round 9 设施公共件 ──
  function facBuilding(hex, style, x, z, w, h, d) {
    pushBuilding(hex, style, x, SURFACE + h / 2, z, w, h, d)
    dressFacade(x, SURFACE, z, w, h, d, style)
  }
  /** 围合：wall = 红墙灰瓦；fence = 砖基座 + 铁艺立柱/横杆；前沿（z0）留门 */
  function enclose(x0, x1, z0, z1, kind, gateX, gateW) {
    const wall = kind === 'wall'
    const H = wall ? 3.8 : 2.0
    const seg = (x, z, w, d, alongX) => {
      if (Math.max(w, d) < 0.5) return
      if (wall) {
        push(redWall, x, SURFACE + H / 2, z, w, H, d)
        push(tileGrey, x, SURFACE + H + 0.22, z, alongX ? w + 0.4 : 1.3, 0.44, alongX ? 1.3 : d + 0.4)
      } else {
        push(brickP, x, SURFACE + 0.3, z, w, 0.6, d)
        push(rail, x, SURFACE + H, z, alongX ? w : 0.07, 0.07, alongX ? 0.07 : d)
        push(rail, x, SURFACE + 1.25, z, alongX ? w : 0.05, 0.05, alongX ? 0.05 : d)
        push(fenceMesh, x, SURFACE + 1.3, z, alongX ? w : 0.03, H - 0.6, alongX ? 0.03 : d)
        const L = alongX ? w : d
        const n = Math.max(1, Math.round(L / 3))
        for (let i = 0; i <= n; i++) {
          const t = -L / 2 + (L * i) / n
          push(rail, alongX ? x + t : x, SURFACE + H / 2, alongX ? z : z + t, 0.1, H, 0.1)
        }
      }
      addSolid(x, z, Math.max(w, 0.4), Math.max(d, 0.4), SURFACE + H)
    }
    const T = wall ? 0.8 : 0.3
    const gl = gateX - gateW / 2
    const gr = gateX + gateW / 2
    seg((x0 + gl) / 2, z0, gl - x0, T, true)
    seg((gr + x1) / 2, z0, x1 - gr, T, true)
    seg((x0 + x1) / 2, z1, x1 - x0, T, true)
    seg(x0, (z0 + z1) / 2, T, z1 - z0, false)
    seg(x1, (z0 + z1) / 2, T, z1 - z0, false)
  }
  /** 门：两根门柱 + 横楣（招牌挂横楣上，前面不遮） */
  function gateArch(x, z, w, h, signK) {
    for (const s of [-1, 1]) {
      push(stoneStep, x + s * (w / 2 + 0.8), SURFACE + h / 2, z, 1.6, h, 1.6)
      addSolid(x + s * (w / 2 + 0.8), z, 1.6, 1.6, SURFACE + h)
    }
    push(stoneStep, x, SURFACE + h + 0.6, z, w + 3.2, 1.2, 1.6)
    if (signK) board(signK, x, SURFACE + h + 0.6, z - 0.8, Math.min(w * 0.8, 12), -1)
  }
  function treeRow(x0, z0, x1, z1, step, s = 1) {
    const L = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.floor(L / step))
    for (let i = 0; i <= n; i++) villaTree(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, s * range(rng, 0.85, 1.15))
  }
  /** 胶囊（跑道形）平面挤出几何：直段 L，半径 R，高 H（中心在原点） */
  function capsuleGeo(L, R, H) {
    const sh = new THREE.Shape()
    sh.moveTo(-L / 2, -R)
    sh.lineTo(L / 2, -R)
    sh.absarc(L / 2, 0, R, -Math.PI / 2, Math.PI / 2, false)
    sh.lineTo(-L / 2, R)
    sh.absarc(-L / 2, 0, R, Math.PI / 2, Math.PI * 1.5, false)
    const g = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: false, curveSegments: 32 })
    g.rotateX(-Math.PI / 2)
    g.translate(0, -H / 2, 0)
    g.computeVertexNormals()
    return g
  }
  function capsuleSolid(x, z, L, R, yTop) {
    addSolid(x, z, L, R * 2, yTop)
    for (const s of [-1, 1]) for (let j = 0; j < 5; j++) {
      const u0 = (j / 5) * R
      const u1 = ((j + 1) / 5) * R
      const half = Math.sqrt(Math.max(0, R * R - ((u0 + u1) / 2) ** 2))
      addSolid(x + s * (L / 2 + (u0 + u1) / 2), z, u1 - u0, half * 2, yTop)
    }
  }
  function tennis(x, z) {
    pad(tennisG, x, z, 36, 18, 0.3, 0.3)
    pad(tennisB, x, z, 23.8, 11, 0.32, 0.04)
    lines(x, z, 23.77, 10.97, 0.07, 0.34)
    lines(x, z, 23.77, 8.23, 0.06, 0.34)
    pad(lineW, x, z, 12.8, 0.06, 0.34, 0.04)
    push(whiteP, x, SURFACE + 0.75, z, 0.05, 0.9, 12.8)
    for (const s of [-1, 1]) push(rail, x, SURFACE + 0.75, z + s * 6.4, 0.1, 1.1, 0.1)
    for (const [fx, fz, fw, fd] of [[x, z - 9, 36, 0.04], [x, z + 9, 36, 0.04], [x - 18, z, 0.04, 18], [x + 18, z, 0.04, 18]]) {
      push(fenceMesh, fx, SURFACE + 2.1, fz, fw, 3.6, fd)
      push(rail, fx, SURFACE + 3.9, fz, fw || 0.06, 0.07, fd || 0.06)
      addSolid(fx, fz, Math.max(fw, 0.3), Math.max(fd, 0.3), SURFACE + 3.9)
    }
    for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) push(rail, x - 18 + i * 6, SURFACE + 2, z + s * 9, 0.1, 4, 0.1)
    for (let i = 1; i < 3; i++) for (const s of [-1, 1]) push(rail, x + s * 18, SURFACE + 2, z - 9 + i * 6, 0.1, 4, 0.1)
  }
  /** 消防车：驾驶室 + 车厢 + 云梯 */
  function fireEngine(x, z) {
    push(truckRed, x, SURFACE + 1.6, z + 2.9, 2.5, 2.6, 2.2)
    push(villaWin, x, SURFACE + 2.3, z + 1.78, 2.3, 0.9, 0.05)
    push(truckRed, x, SURFACE + 1.5, z - 1.2, 2.5, 2.4, 6.2)
    push(whiteP, x, SURFACE + 1.6, z - 1.2, 2.52, 0.18, 6.22)
    push(steelP, x, SURFACE + 2.95, z - 1.0, 1.4, 0.3, 7.2)
    for (const a of [-1, 1]) for (const c of [-1.8, 0.6, 3.0]) push(tarmac, x + a * 1.15, SURFACE + 0.5, z + c, 0.35, 1.0, 1.0)
    addSolid(x, z + 0.4, 2.6, 8.6, SURFACE + 3.1)
  }
  /** 厢式货车（超市卸货/邮政） */
  function boxTruck(x, z, alongZ, stripe = redP) {
    const s = (w, d) => alongZ ? [w, d] : [d, w]
    const [cw, cd] = s(2.4, 2.2)
    const [bw, bd] = s(2.5, 6.4)
    const off = (v) => alongZ ? [x, z + v] : [x + v, z]
    const [ax, az] = off(3.6)
    const [bx2, bz2] = off(-0.8)
    push(truckWhite, ax, SURFACE + 1.4, az, cw, 2.2, cd)
    push(truckWhite, bx2, SURFACE + 2.0, bz2, bw, 3.2, bd)
    push(stripe, bx2, SURFACE + 1.6, bz2, bw + 0.04, 0.4, bd + 0.04)
    addSolid(x, z, alongZ ? 2.6 : 9, alongZ ? 9 : 2.6, SURFACE + 3.6)
  }

  /** 城市设施地块：体育场 / 图书馆 / 演艺中心 / 博物馆 / 影城 / 公交总站 / 公安 / 消防 / 邮局 / 酒店 / 超市 / 寺庙 / 教堂 / 立体车库 / 写字楼广场 */
  const FACILITY_KINDS = new Set(['stadium', 'library', 'arena', 'museum', 'cinema', 'busterm', 'police', 'fire', 'post', 'hotel', 'market', 'temple', 'church', 'garage', 'office', 'gov', 'farmers'])
  function frontPlaza(b, depth) {
    pad(pave, b.cx, b.z0 + depth / 2 + 1, b.w - 4, depth, 0.22, 0.1)
  }
  function fillFacility(b) {
    curGrp++
    const k = b.kind
    const W0 = b.w - 6
    const D0 = b.d - 6
    const cx = b.cx
    const fz = b.z0 + 3 // 前沿（朝 -z 街道）
    const signAt = (h, w, z = fz) => board(k, cx, SURFACE + h, z - 0.4, Math.min(w, 26), -1)
    // 跨多格的大设施：先把整块（含被并掉的内部道路）铺成广场
    if (b.big) pad(pave, cx, b.cz, b.w, b.d, 0.16, 0.16)
    if (k === 'stadium') {
      // 体育场：约 250×200m 椭圆碗 —— 8 级阶梯看台 + 外立面 + 环形挑篷 + 400m 跑道/足球场 + 四座灯塔
      const RX = Math.min(W0 / 2 - 6, 125)
      const RZ = Math.min(D0 / 2 - 6, 100)
      const ix = RX * 0.74
      const iz = RZ * 0.6
      // 跑道 + 球场
      pad(trackR, cx, b.cz, ix * 2 - 6, iz * 2 - 6, 0.26, 0.26)
      for (let i = 1; i <= 4; i++) lines(cx, b.cz, ix * 2 - 6 - i * 2.4, iz * 2 - 6 - i * 2.4, 0.08, 0.3)
      footballPitch(cx, b.cz, Math.min(105, ix * 2 - 40), Math.min(68, iz * 2 - 30))
      const n = 64
      const T = 8
      const ell = (a, rx, rz) => [cx + Math.cos(a) * rx, b.cz + Math.sin(a) * rz]
      const segAt = (a, rx, rz) => {
        // 切向（盒子 x 轴对齐切线）+ 弧长
        const tx = -Math.sin(a) * rx
        const tz = Math.cos(a) * rz
        const L = Math.hypot(tx, tz) * (Math.PI * 2 / n) * 1.06
        return [Math.atan2(-tz, tx), L]
      }
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        for (let t = 0; t < T; t++) {
          const u = (t + 0.5) / T
          const rx = ix + (RX - 5 - ix) * u
          const rz = iz + (RZ - 5 - iz) * u
          const [x, z] = ell(a, rx, rz)
          const [yaw, L] = segAt(a, rx, rz)
          const dep = Math.hypot(Math.cos(a) * (RX - 5 - ix), Math.sin(a) * (RZ - 5 - iz)) / T * 1.12
          const top = SURFACE + 1.6 + (t + 1) * 3.3
          push(t % 2 ? courtB : stoneStep, x, (SURFACE + top) / 2, z, L, top - SURFACE, dep, yaw)
          addSolid(x, z, L * 0.92, dep * 0.92, top, SURFACE, yaw)
        }
        // 外立面（夜里透暖光的玻璃幕）+ 顶上一圈挑篷
        {
          const [x, z] = ell(a, RX - 2.5, RZ - 2.5)
          const [yaw, L] = segAt(a, RX - 2.5, RZ - 2.5)
          push(glassPortal, x, SURFACE + 17, z, L, 34, 2.4, yaw)
          addSolid(x, z, L, 2.4, SURFACE + 34, SURFACE, yaw)
          if (i % 2 === 0) push(mech, x, SURFACE + 18, z, 1.4, 36, 3.2, yaw)
          const [rx2, rz2] = [RX - 16, RZ - 16]
          const [x2, z2] = ell(a, rx2, rz2)
          const [yaw2, L2] = segAt(a, rx2, rz2)
          push(stoneStep, x2, SURFACE + 36.5, z2, L2, 1.0, 30, yaw2)
        }
      }
      // 四座灯塔 + 入口大台阶广场 + 大屏
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const [lx, lz] = ell(Math.atan2(sz * RZ, sx * RX), RX + 6, RZ + 6)
        push(mech, lx, SURFACE + 26, lz, 1.6, 52, 1.6)
        push(billLamp, lx, SURFACE + 53, lz, 8, 4, 1.4, Math.atan2(-(b.cz - lz), cx - lx))
        addSolid(lx, lz, 1.6, 1.6, SURFACE + 54)
      }
      for (const s2 of [-1, 1]) push(adPools[(rng() * adPools.length) | 0], cx + s2 * ix * 0.55, SURFACE + 30, b.cz - iz - 3, 22, 10, 0.4)
      for (let i = 0; i < 4; i++) push(stoneStep, cx, SURFACE + 0.25 + i * 0.25, b.z0 + 6 + i * 1.2, 70, 0.5 + i * 0.5, 1.3)
      board('stadium', cx, SURFACE + 28, b.cz - RZ - 0.5, 40, -1)
      return
    }
    if (k === 'arena') {
      // 演艺中心：胶囊形（跑道形）大场馆占满地块中部；原两侧停车场改成地下车库坡道口 + 下沉绿地 + 林荫
      const R = b.big ? Math.min(D0 / 2 - 22, 62) : Math.min(D0 / 2 - 6, 26)
      const L = Math.max(20, Math.min(W0 - 2 * R - (b.big ? 84 : 20), 220))
      const H = b.big ? 34 : 22
      const az = b.cz + 4
      const body = LP('#2b2540', 0.55, 0.28, 0.9, { geo: capsuleGeo(L, R, H - 6), lod: 0 })
      const lobby = LP('#8fa6b4', 0.45, 0.14, 1.1, { geo: capsuleGeo(L, R + 0.2, 6), emissive: '#ffe0b0', lod: 0 })
      Mat.registerNight(lobby.mat, 0.0, 0.9)
      const ledA = LP('#ff3fa4', 0.2, 0.5, 0.5, { geo: capsuleGeo(L, R + 0.45, 0.7), emissive: '#ff3fa4', lod: 0 })
      const ledB = LP('#38e8ff', 0.2, 0.5, 0.5, { geo: capsuleGeo(L, R + 0.45, 0.5), emissive: '#38e8ff', lod: 0 })
      Mat.registerNight(ledA.mat, 0.3, 2.4)
      Mat.registerNight(ledB.mat, 0.3, 2.4)
      const roof = LP('#d8d4dc', 0.3, 0.5, 0.7, { geo: capsuleGeo(L + 2, R + 1.5, 1.0), lod: 0 })
      const crown = LP('#3a3150', 0.4, 0.4, 0.7, { geo: capsuleGeo(L * 0.62, R * 0.55, 5), lod: 0 })
      push(lobby, cx, SURFACE + 3, az, 1, 1, 1)
      push(body, cx, SURFACE + 6 + (H - 6) / 2, az, 1, 1, 1)
      push(ledA, cx, SURFACE + 6.4, az, 1, 1, 1)
      push(ledB, cx, SURFACE + H * 0.62, az, 1, 1, 1)
      push(ledA, cx, SURFACE + H - 0.5, az, 1, 1, 1)
      push(roof, cx, SURFACE + H + 0.5, az, 1, 1, 1)
      push(crown, cx, SURFACE + H + 3.5, az, 1, 1, 1)
      capsuleSolid(cx, az, L, R, SURFACE + H + 1)
      // 正立面（直边）入口：玻璃雨棚 + 立柱 + 大台阶；院名大字在 LED 带之间
      const fzA = az - R
      push(glassPortal, cx, SURFACE + 7.6, fzA - 7, 64, 0.5, 14)
      for (let i = 0; i < 6; i++) push(accent, cx - 30 + i * 12, SURFACE + 3.8, fzA - 13.2, 0.7, 7.6, 0.7)
      for (let i = 0; i < 3; i++) push(stoneStep, cx, SURFACE + 0.2 + i * 0.2, fzA - 16 - i * 1.4, 80, 0.4 + i * 0.4, 1.5)
      board('arena', cx, SURFACE + H * 0.62 + 6.5, fzA - 0.4, 40, -1)
      if (b.big) {
        // 两侧：地下车库坡道口（矮墙围合的深色坡道 + 顶棚 + P 牌）+ 草坪 + 行道树
        for (const s of [-1, 1]) {
          const ex0 = s < 0 ? b.x0 + 4 : cx + L / 2 + R + 10
          const ex1 = s < 0 ? cx - L / 2 - R - 10 : b.x1 - 4
          const ew = ex1 - ex0
          if (ew < 14) continue
          const ex = (ex0 + ex1) / 2
          const rw = Math.min(9, ew * 0.4)
          const rx = ex - s * (ew / 2 - rw / 2 - 2)
          const rz0 = b.z0 + 14
          const rLen = Math.min(46, D0 * 0.42)
          pad(pitDark, rx, rz0 + rLen / 2, rw, rLen, 0.2, 0.06)
          for (const t of [-1, 1]) {
            push(wallGrey, rx + t * (rw / 2 + 0.2), SURFACE + 0.6, rz0 + rLen / 2, 0.4, 1.2, rLen)
            addSolid(rx + t * (rw / 2 + 0.2), rz0 + rLen / 2, 0.4, rLen, SURFACE + 1.2)
          }
          push(wallGrey, rx, SURFACE + 0.6, rz0 + rLen, rw + 0.8, 1.2, 0.4)
          push(canopy, rx, SURFACE + 4.2, rz0 + rLen - 6, rw + 1.6, 0.35, 12)
          board('parking', rx, SURFACE + 5.6, rz0 - 0.4, 6, -1)
          // 草坪 + 两排树 + 坐凳
          const gx = ex + s * (rw / 2 + 1)
          const gw = ew - rw - 6
          if (gw > 6) {
            pad(lawn, gx, b.cz + 6, gw, D0 - 30, 0.3, 0.3)
            treeRow(gx - gw * 0.3, b.z0 + 18, gx - gw * 0.3, b.z1 - 12, 11)
            if (gw > 16) treeRow(gx + gw * 0.3, b.z0 + 18, gx + gw * 0.3, b.z1 - 12, 11)
          }
        }
        // 前广场：两排行道树 + 后场货车
        treeRow(b.x0 + 12, b.z0 + 6, cx - 44, b.z0 + 6, 12)
        treeRow(cx + 44, b.z0 + 6, b.x1 - 12, b.z0 + 6, 12)
        for (let i = 0; i < 3; i++) boxTruck(cx - 20 + i * 20, b.z1 - 9, false, accent)
      }
      return
    }
    if (k === 'garage') {
      // 立体停车楼：占满地块的 6 层开敞车库 + 竖向铝格栅立面 + 两端交通核 + 出入口道闸
      const lv = 6
      const FH = 3.2
      const w = Math.min(W0 - 22, 150)
      const d = Math.min(D0 - 8, 56)
      const gz = b.z1 - 3 - d / 2
      for (let i = 0; i <= lv; i++) {
        const y = SURFACE + i * FH
        push(pave, cx, y + 0.15, gz, w, 0.3, d)
        if (i > 0) {
          for (const s of [-1, 1]) push(wallGrey, cx, y + 0.65, gz + s * d / 2, w, 1.0, 0.25)
          for (const s of [-1, 1]) push(wallGrey, cx + s * w / 2, y + 0.65, gz, 0.25, 1.0, d)
        }
        if (i < lv) {
          for (let px = -w / 2 + 2; px <= w / 2 - 2; px += 8.4) for (const pz of [-d / 2 + 1, 0, d / 2 - 1]) push(wallGrey, cx + px, y + 1.75, gz + pz, 0.6, 2.9, 0.6)
          for (let j = 0; j < 12; j++) if (rng() < 0.6) lotCar(cx - w / 2 + 5 + j * (w - 10) / 11, y + 0.3, gz + (j % 2 ? 1 : -1) * d * 0.3, Math.PI / 2, null, false)
        }
      }
      for (let x = -w / 2 + 1; x <= w / 2 - 1; x += 1.8) push(louvre, cx + x, SURFACE + FH + (lv * FH - FH) / 2 + 0.8, gz - d / 2 - 0.45, 0.14, lv * FH - FH + 0.6, 0.55)
      for (const s of [-1, 1]) pushBuilding('#c8ccd0', 'podium', cx + s * (w / 2 + 4.5), SURFACE + (lv * FH + 4) / 2, gz, 8, lv * FH + 4, 10)
      addSolid(cx, gz, w, d, SURFACE + lv * FH + 0.3)
      // 出入口：两条车道 + 岗亭 + 道闸 + 地面导流线
      const lz = (b.z0 + gz - d / 2) / 2
      pad(tarmac, cx, lz, w, gz - d / 2 - b.z0 - 1, 0.24, 0.2)
      for (const s of [-1, 1]) {
        const lx = cx + s * 9
        push(whiteP, lx, SURFACE + 1.4, lz, 2, 2.6, 2.4)
        push(villaWin, lx, SURFACE + 1.8, lz - 1.22, 1.6, 1.0, 0.05)
        push(redP, lx + s * 3.4, SURFACE + 1.1, lz - 1.6, 4.6, 0.12, 0.12)
        addSolid(lx, lz, 2, 2.4, SURFACE + 2.8)
      }
      board('garage', cx, SURFACE + lv * FH + 3.4, gz - d / 2 - 0.6, 22, -1)
      return
    }
    if (k === 'temple') {
      // 寺院：整圈红墙灰瓦 + 山门（可穿行）+ 钟鼓楼 + 天王殿 + 香炉 + 大雄宝殿（重檐、月台）+ 两厢配殿 + 藏经阁 + 七层塔 + 古树
      const x0 = b.x0 + 3, x1 = b.x1 - 3, z0 = b.z0 + 3, z1 = b.z1 - 3
      const D = z1 - z0
      const sd = Math.min(1, D / 160)
      const zf = (f) => z0 + f * D
      enclose(x0, x1, z0, z1, 'wall', cx, 10)
      // 山门：两侧门房 + 门洞上屋顶
      for (const s of [-1, 1]) withGable(0, 0.4, () => pushBuilding('#b8402e', 'punch', cx + s * 9, SURFACE + 3.5, z0 + 3, 8, 7, 7))
      push(gablePools[0], cx, SURFACE + 8.4, z0 + 3, 28, 3.2, 9)
      push(redWall, cx, SURFACE + 6.6, z0 + 3, 10, 1.0, 7)
      board('temple', cx, SURFACE + 5.6, z0 - 0.6, 7, -1)
      pad(pave, cx, (z0 + z1) / 2, 9, D - 4, 0.24, 0.1)
      // 钟楼 / 鼓楼
      for (const s of [-1, 1]) {
        const tx = cx + s * Math.min(40, (x1 - x0) * 0.24)
        const tz = zf(0.17)
        pushBuilding('#c8b8a0', 'punch', tx, SURFACE + 3, tz, 9, 6, 9)
        withGable(0, 0.55, () => pushBuilding('#b8402e', 'punch', tx, SURFACE + 8.5, tz, 7, 5, 7))
      }
      // 天王殿
      withGable(0, 0.36, () => pushBuilding('#b8402e', 'punch', cx, SURFACE + 5, zf(0.3), 34, 10, 14 * sd + 4))
      // 香炉（铜鼎 + 小顶）+ 两侧古树
      push(goldP, cx, SURFACE + 1.0, zf(0.42), 2.4, 2.0, 2.4)
      push(tileGrey, cx, SURFACE + 2.4, zf(0.42), 3.2, 0.3, 3.2)
      push(goldP, cx, SURFACE + 3.0, zf(0.42), 0.4, 1.0, 0.4)
      addSolid(cx, zf(0.42), 2.6, 2.6, SURFACE + 2.6)
      for (const s of [-1, 1]) for (const f of [0.22, 0.42, 0.78]) villaTree(cx + s * 16, zf(f), 1.6)
      // 大雄宝殿：月台 + 重檐 + 檐柱
      const mz = zf(0.6)
      const md = 24 * sd + 4
      pad(stoneStep, cx, mz, 62, md + 10, 1.2, 1.2)
      withGable(0, 0.34, () => pushBuilding('#b8402e', 'punch', cx, SURFACE + 1.2 + 7, mz, 52, 14, md))
      withGable(0, 0.36, () => pushBuilding('#b8402e', 'punch', cx, SURFACE + 1.2 + 17.5, mz, 32, 6, md * 0.62))
      for (let i = 0; i < 10; i++) push(redP, cx - 24 + i * (48 / 9), SURFACE + 1.2 + 3.6, mz - md / 2 - 1.6, 0.8, 7.2, 0.8)
      push(stoneStep, cx, SURFACE + 0.6, mz - md / 2 - 6, 16, 1.2, 2)
      // 两厢配殿
      for (const s of [-1, 1]) withGable(3, 0.36, () => pushBuilding('#c8b8a0', 'punch', cx + s * ((x1 - x0) / 2 - 13), SURFACE + 4, zf(0.52), 14, 8, D * 0.42))
      // 藏经阁（两层）
      withGable(0, 0.36, () => pushBuilding('#b8402e', 'punch', cx, SURFACE + 6, zf(0.9), 54, 12, 12 * sd + 4))
      // 七层塔（后院一角）
      {
        const px = x0 + 16
        const pz = zf(0.86)
        push(stoneStep, px, SURFACE + 0.8, pz, 13, 1.6, 13)
        let y = SURFACE + 1.6
        for (let i = 0; i < 7; i++) {
          const s = 9.5 - i * 1.0
          push(redWall, px, y + 1.8, pz, s, 3.6, s)
          push(tileGrey, px, y + 3.85, pz, s + 3, 0.5, s + 3)
          y += 4.1
        }
        push(goldP, px, y + 1.6, pz, 0.6, 3.2, 0.6)
        addSolid(px, pz, 10, 10, y)
      }
      // 沿墙一圈树 + 草地
      treeRow(x0 + 6, z0 + 14, x0 + 6, z1 - 30, 12, 1.2)
      treeRow(x1 - 6, z0 + 14, x1 - 6, z1 - 8, 12, 1.2)
      for (const s of [-1, 1]) pad(lawn, cx + s * 30, zf(0.42), 22, D * 0.14, 0.3, 0.3)
      return
    }
    if (k === 'church') {
      // 教堂：中殿 + 前钟楼尖塔 + 玫瑰窗；左侧回廊花园（拱廊围合草坪 + 喷泉），右侧堂区活动楼 + 花园；临街矮篱 + 门柱
      const z0 = b.z0 + 3, z1 = b.z1 - 3
      const dd = z1 - z0
      const nw = 26
      const nd = Math.min(dd - 16, 60)
      const nz = z1 - nd / 2 - 1
      withGable(1, 0.55, () => pushBuilding('#d8d0c0', 'punch', cx, SURFACE + 9, nz, nw, 18, nd))
      const tz = nz - nd / 2 - 5
      pushBuilding('#d8d0c0', 'punch', cx, SURFACE + 19, tz, 10, 38, 9)
      push(gablePools[1], cx, SURFACE + 38 + 7, tz, 10, 14, 9)
      push(goldP, cx, SURFACE + 38 + 15, tz, 0.3, 4, 0.3)
      push(villaWinLit, cx, SURFACE + 24, tz - 4.55, 4.4, 4.4, 0.1)
      push(doorGlass, cx, SURFACE + 2.2, tz - 4.6, 3.2, 4.4, 0.1)
      // 左：回廊花园
      const cx0 = b.x0 + 6
      const cx1 = cx - nw / 2 - 6
      const cw = cx1 - cx0
      if (cw > 20) {
        const gx = (cx0 + cx1) / 2
        const gz = z0 + dd / 2 + 2
        const gd = dd - 10
        pad(lawn, gx, gz, cw - 10, gd - 10, 0.3, 0.3)
        push(villaWater, gx, SURFACE + 0.6, gz, 4, 0.5, 4)
        push(stoneStep, gx, SURFACE + 0.35, gz, 5.4, 0.7, 5.4)
        for (const [ax, az, aw, ad2] of [[gx, gz - gd / 2 + 2, cw, 4], [gx, gz + gd / 2 - 2, cw, 4], [cx0 + 2, gz, 4, gd], [cx1 - 2, gz, 4, gd]]) {
          push(tileGrey, ax, SURFACE + 4.2, az, aw, 0.4, ad2)
          const along = aw > ad2
          const L = along ? aw : ad2
          const n = Math.max(2, Math.round(L / 4))
          for (let i = 0; i <= n; i++) {
            const t = -L / 2 + (L * i) / n
            for (const off of [-1.6, 1.6]) push(whiteP, along ? ax + t : ax + off, SURFACE + 2.1, along ? az + off : az + t, 0.45, 4.0, 0.45)
          }
        }
        villaTree(gx - cw * 0.25, gz, 1.1)
        villaTree(gx + cw * 0.25, gz, 1.1)
      }
      // 右：堂区活动楼 + 花园
      const hx0 = cx + nw / 2 + 6
      const hx1 = b.x1 - 6
      const hw = hx1 - hx0
      if (hw > 24) {
        const pw = Math.min(56, hw - 10)
        const phx = hx1 - pw / 2
        withGable(4, 0.4, () => pushBuilding('#e2d6c2', 'punch', phx, SURFACE + 5, z1 - 17, pw, 10, 30))
        pad(lawn, (hx0 + hx1) / 2, z0 + 10, hw - 4, 14, 0.3, 0.3)
        treeRow(hx0 + 4, z0 + 10, hx1 - 4, z0 + 10, 10)
        if (hw - pw > 12) treeRow(hx0 + 4, z0 + 22, hx0 + 4, z1 - 4, 9)
      }
      // 临街矮篱 + 门柱 + 石碑招牌
      for (const s of [-1, 1]) push(hedge, cx + s * (b.w / 4 + 5), SURFACE + 0.6, b.z0 + 1.5, b.w / 2 - 14, 1.2, 1.2)
      pad(pave, cx, (b.z0 + tz - 4.5) / 2, 10, tz - 4.5 - b.z0, 0.24, 0.1)
      push(stoneStep, cx + 16, SURFACE + 0.9, b.z0 + 4, 11, 1.8, 1.2)
      board('church', cx + 16, SURFACE + 3.4, b.z0 + 3.4, 10, -1)
      return
    }
    if (k === 'library' || k === 'museum') {
      const lib = k === 'library'
      const W1 = Math.min(W0 * (lib ? 0.82 : 0.88), 152)
      const D1 = Math.min(D0 * 0.74, b.big ? 120 : D0 - 14)
      const bz = b.z1 - 6 - D1 / 2
      const front = bz - D1 / 2
      if (lib) {
        // 图书馆：「错动书架」—— 四层体块左右交替悬挑 10m + 前角一座通高弧形玻璃中庭 + 屋顶阅读花园
        const nL = 4
        const LH = Math.max(6, Math.min(8, (b.big ? 32 : 24) / nL))
        for (let i = 0; i < nL; i++) {
          const off = i === 0 ? 0 : (i % 2 ? 10 : -10)
          const zo = i === 0 ? 0 : (i % 2 ? -5 : 4)
          pushBuilding(i % 2 ? '#e4ddd0' : '#cfc7b8', 'ribbon', cx + off, SURFACE + LH * i + LH / 2, bz + zo, W1 - 22, LH, D1 - 10)
          dressFacade(cx + off, SURFACE + LH * i, bz + zo, W1 - 22, LH, D1 - 10, 'ribbon')
        }
        const rD = Math.min(22, D1 * 0.3)
        const gx = cx - W1 / 2 + rD
        const gz = front + rD * 0.6
        push(glassDrum, gx, SURFACE + (LH * nL + 4) / 2, gz, rD * 2, LH * nL + 4, rD * 2)
        push(roofCylPool('#d8d4cc'), gx, SURFACE + LH * nL + 4.3, gz, rD * 2.1, 0.6, rD * 2.1)
        addSolid(gx, gz, rD * 1.5, rD * 1.5, SURFACE + LH * nL + 4.6)
        pad(lawn, cx - 10, bz - 4, (W1 - 22) * 0.6, (D1 - 10) * 0.6, LH * nL + 0.45, 0.3)
        board('library', cx + 10, SURFACE + LH * 1.5, bz - 5 - (D1 - 10) / 2 - 0.3, 24, -1)
        push(glassPortal, cx + 14, SURFACE + 4.4, front - 6, 26, 0.4, 10)
      } else {
        // 博物馆：宽体石材主馆 + 中央柱廊（14m 柱 + 檐部）+ 穹顶 + 两翼
        const h = 24
        facBuilding('#e8e2d4', 'punch', cx, bz, W1, h, D1)
        pushCylBuilding('#c8c0b0', cx, SURFACE + h + 6, bz, Math.min(20, D1 * 0.2), 12)
        const n = 12
        for (let i = 0; i < n; i++) push(whiteP, cx - 32 + i * (64 / (n - 1)), SURFACE + 7, front - 4, 1.4, 14, 1.4)
        push(whiteP, cx, SURFACE + 14.7, front - 4, 70, 1.4, 6)
        push(whiteP, cx, SURFACE + 0.15, front - 4, 72, 0.3, 7)
        addSolid(cx, front - 4, 70, 6, SURFACE + 15.4, SURFACE + 14)
        board('museum', cx, SURFACE + 18.4, front - 7.1, 26, -1)
      }
      for (let i = 0; i < 4; i++) push(stoneStep, cx, SURFACE + 0.2 + i * 0.2, front - 9 - i * 1.4, Math.min(W1 * 0.6, 80), 0.4 + i * 0.4, 1.5)
      // 前广场（已收窄）：水景 + 两排树 + 草坪
      const pd = front - 14 - b.z0
      if (pd > 10) {
        push(villaWater, cx, SURFACE + 0.5, b.z0 + pd / 2 + 2, Math.min(40, W1 * 0.3), 0.4, Math.min(12, pd * 0.4))
        for (const s of [-1, 1]) {
          pad(lawn, cx + s * W1 * 0.36, b.z0 + pd / 2 + 2, W1 * 0.22, pd - 6, 0.3, 0.3)
          treeRow(cx + s * W1 * 0.25, b.z0 + 6, cx + s * W1 * 0.25, front - 12, 10)
        }
      }
      return
    }
    if (k === 'police' || k === 'fire' || k === 'post') {
      // 公安局 / 消防站 / 邮政局：主楼占地块大半 + 附属楼补满 + 前场有实物（警车 / 消防车车库门 / 邮车），不再是空地
      const SP = { police: ['#e8ecf0', 'punch', 24, courtB], fire: ['#e9e3da', 'podium', 15, redP], post: ['#eef2ee', 'punch', 16, pitchG] }[k]
      const [hex, st, h, bandP] = SP
      const w = Math.min(W0 * 0.6, 108)
      const d = Math.min(D0 - 18, 46)
      const bx = b.x0 + 3 + w / 2
      const bz = b.z1 - 3 - d / 2
      const front = bz - d / 2
      facBuilding(hex, st, bx, bz, w, h, d)
      push(bandP, bx, SURFACE + h - 1.0, front - 0.18, w, 1.0, 0.2)
      const ax0 = bx + w / 2 + 5
      const aw = b.x1 - 3 - ax0
      const axc = ax0 + aw / 2
      if (k === 'fire') {
        // 4 个车库门（红色卷帘）+ 门前停消防车 + 训练塔 + 操练场
        const nB = 4
        for (let i = 0; i < nB; i++) {
          const dx = bx - w * 0.36 + i * (w * 0.72 / (nB - 1))
          push(redP, dx, SURFACE + 2.6, front - 0.12, 5.2, 5.2, 0.15)
          for (let r = 0; r < 6; r++) push(darkP, dx, SURFACE + 0.6 + r * 0.8, front - 0.22, 5.0, 0.05, 0.05)
          fireEngine(dx, front - 7)
        }
        board('fire', bx, SURFACE + h - 4.2, front - 0.5, 22, -1)
        if (aw > 16) {
          pad(tarmac, axc, b.cz, aw, D0 - 4, 0.25, 0.2)
          pushBuilding('#b8302a', 'punch', axc + aw * 0.25, SURFACE + 13, b.z1 - 10, 7, 26, 7)
          for (let i = 0; i < 4; i++) push(rail, axc - aw * 0.2, SURFACE + 1.5, b.z0 + 10 + i * 4, aw * 0.4, 0.08, 0.08)
          for (let i = 0; i < 3; i++) push(redP, axc - aw * 0.2 + i * 3, SURFACE + 0.7, b.z0 + 24, 0.8, 1.4, 0.8)
        }
      } else if (k === 'police') {
        push(canopy, bx, SURFACE + 4.4, front - 4, 16, 0.4, 8)
        board('police', bx, SURFACE + Math.min(h - 3.5, 11), front - 0.5, 22, -1)
        push(whiteP, bx - w * 0.38, SURFACE + 9, b.z0 + 5, 0.25, 18, 0.25)
        push(redP, bx - w * 0.38 + 1.6, SURFACE + 16.8, b.z0 + 5, 3.0, 2.0, 0.05)
        for (let i = 0; i < 8; i++) lotCar(bx - w * 0.28 + i * (w * 0.56 / 7), SURFACE + 0.25, front - 9, Math.PI / 2, 'sedan')
        pad(tarmac, bx, front - 9, w * 0.66, 7, 0.25, 0.2)
        if (aw > 16) {
          facBuilding('#dfe4ea', 'podium', axc, b.z1 - 16, aw - 4, 8, 26)
          for (let i = 0; i < 4; i++) lotCar(ax0 + 4 + i * (aw - 8) / 3, SURFACE + 0.25, b.z0 + 12, Math.PI / 2, 'suv')
          push(whiteP, axc, SURFACE + 1.4, b.z0 + 4, 2.4, 2.8, 2.4)
          push(courtB, axc + 3.8, SURFACE + 1.1, b.z0 + 2.5, 5, 0.12, 0.12)
        }
        for (const s of [-1, 1]) push(hedge, bx + s * (w * 0.4), SURFACE + 0.5, b.z0 + 1.5, w * 0.16, 1.0, 1.0)
      } else {
        push(canopy, bx, SURFACE + 4.4, front - 4, 14, 0.4, 7)
        board('post', bx, SURFACE + Math.min(h - 3.5, 10), front - 0.5, 20, -1)
        push(pitchG, bx + 10, SURFACE + 0.7, front - 6, 0.7, 1.4, 0.6)
        if (aw > 16) {
          // 邮件分拣中心 + 装卸月台 + 邮车
          facBuilding('#e2e8e2', 'podium', axc, b.z1 - 18, aw - 4, 9, 30)
          const dz = b.z1 - 33
          push(wallGrey, axc, SURFACE + 0.6, dz - 1.5, aw - 6, 1.2, 3)
          for (let i = 0; i < 4; i++) push(darkP, ax0 + 6 + i * (aw - 12) / 3, SURFACE + 2.2, dz + 0.1, 3.6, 3.6, 0.1)
          for (let i = 0; i < 3; i++) boxTruck(ax0 + 6 + i * (aw - 12) / 2.2, dz - 8, true, pitchG)
        }
        for (let i = 0; i < 4; i++) lotCar(bx - 20 + i * 6, SURFACE + 0.25, front - 12, Math.PI / 2, 'van')
      }
      return
    }
    if (k === 'gov') {
      // 政务服务中心：对称主楼 + 两翼 + 柱廊 + 国徽 + 旗杆 + 前广场喷泉、树阵
      const W1 = Math.min(W0 * 0.56, 96)
      const D1 = Math.min(D0 - 20, 46)
      const h = 34
      const bz = b.z1 - 4 - D1 / 2
      const front = bz - D1 / 2
      facBuilding('#ece6da', 'punch', cx, bz, W1, h, D1)
      for (const s of [-1, 1]) facBuilding('#e6dfd2', 'punch', cx + s * (W1 / 2 + 15), bz + 4, 28, 18, D1 - 8)
      for (let i = 0; i < 8; i++) push(whiteP, cx - 21 + i * 6, SURFACE + 6, front - 3.5, 1.2, 12, 1.2)
      push(whiteP, cx, SURFACE + 12.6, front - 3.5, 48, 1.2, 5)
      addSolid(cx, front - 3.5, 48, 5, SURFACE + 13.2, SURFACE + 12)
      push(redP, cx, SURFACE + h - 4, front - 0.3, 5, 5, 0.3)
      push(goldP, cx, SURFACE + h - 4, front - 0.5, 3.4, 3.4, 0.1)
      board('gov', cx, SURFACE + 17, front - 0.6, 30, -1)
      for (let i = 0; i < 4; i++) push(stoneStep, cx, SURFACE + 0.2 + i * 0.2, front - 7 - i * 1.4, 56, 0.4 + i * 0.4, 1.5)
      const pz = (b.z0 + front - 12) / 2
      push(whiteP, cx, SURFACE + 11, pz, 0.3, 22, 0.3)
      push(redP, cx + 2.2, SURFACE + 20.5, pz, 4.2, 2.8, 0.05)
      push(villaWater, cx, SURFACE + 0.5, pz, 14, 0.4, Math.max(3, (front - 12 - b.z0) * 0.5))
      for (const s of [-1, 1]) treeRow(cx + s * 24, b.z0 + 4, cx + s * (W0 / 2 - 6), b.z0 + 4, 9)
      return
    }
    if (k === 'farmers') {
      // 农贸市场：钢构大棚（四面敞开）+ 天窗带 + 一排排摊位（台面 + 遮阳布 + 筐里的菜）+ 门头 + 前面装卸位
      const W1 = W0 - 8
      const D1 = D0 - 16
      const bz = b.z1 - 3 - D1 / 2
      const front = bz - D1 / 2
      const RH = 7.5
      for (let x = -W1 / 2; x <= W1 / 2 + 0.1; x += 8) for (const s of [-1, 1]) {
        push(mech, cx + x, SURFACE + RH / 2, bz + s * D1 / 2, 0.5, RH, 0.5)
        addSolid(cx + x, bz + s * D1 / 2, 0.5, 0.5, SURFACE + RH)
      }
      push(gablePools[3], cx, SURFACE + RH + 2.2, bz, W1 + 3, 4.4, D1 + 3)
      push(glassPortal, cx, SURFACE + RH + 4.5, bz, W1 - 6, 0.6, 3)
      pad(pave, cx, bz, W1, D1, 0.24, 0.1)
      const rows = Math.max(2, Math.floor((D1 - 6) / 7))
      for (let r = 0; r < rows; r++) {
        const sz = bz - D1 / 2 + 5 + r * ((D1 - 8) / Math.max(1, rows - 1))
        for (let x = -W1 / 2 + 5; x < W1 / 2 - 5; x += 3.6) {
          if (Math.abs(x) < 4) continue
          push(stallP, cx + x, SURFACE + 0.45, sz, 3.0, 0.9, 1.6)
          for (let c2 = 0; c2 < 3; c2++) push(crateP[Math.abs(r + c2 + ((x * 7) | 0)) % crateP.length], cx + x - 1 + c2, SURFACE + 1.05, sz, 0.8, 0.3, 1.1)
          push(awningPools[Math.abs(r + ((x * 3) | 0)) % awningPools.length], cx + x, SURFACE + 2.4, sz - 0.6, 3.2, 0.06, 2.2)
          addSolid(cx + x, sz, 3.0, 1.6, SURFACE + 1.2)
        }
      }
      board('farmers', cx, SURFACE + RH + 1.6, front - 1.6, 24, -1)
      for (let i = 0; i < 8; i++) lotCar(b.x0 + 12 + i * ((W0 - 20) / 7), SURFACE + 0.25, b.z0 + 6, Math.PI / 2, i % 3 ? 'van' : null)
      pad(tarmac, cx, b.z0 + 6, W0 - 4, 8, 0.25, 0.2)
      return
    }
    if (k === 'market') {
      // 惠民超市：大玻璃门脸 + 红色品牌带 + 屋顶大字 + 入口雨棚/自动门 + 购物车棚 + 侧面卸货月台和货车；旁边停车场（真车型）
      const W1 = Math.min(W0 * 0.5, 88)
      const D1 = D0 - 10
      const h = 11
      const bx = b.x1 - 3 - W1 / 2
      const bz = b.z1 - 3 - D1 / 2
      const front = bz - D1 / 2
      facBuilding('#f4f2ee', 'podium', bx, bz, W1, h, D1)
      push(redP, bx, SURFACE + h - 1.2, front - 0.25, W1 + 0.4, 1.8, 0.3)
      push(doorGlass, bx, SURFACE + 3.2, front - 0.15, W1 * 0.74, 5.4, 0.1)
      for (let x = -W1 * 0.37; x <= W1 * 0.37 + 0.1; x += 2.4) push(stMull, bx + x, SURFACE + 3.2, front - 0.22, 0.12, 5.4, 0.12)
      push(stMull, bx, SURFACE + 5.95, front - 0.22, W1 * 0.74, 0.12, 0.12)
      const ex = bx - W1 * 0.2
      push(canopy, ex, SURFACE + 4.4, front - 3.5, 14, 0.35, 7)
      for (const s of [-1, 1]) push(stMull, ex + s * 6.6, SURFACE + 2.2, front - 6.6, 0.2, 4.4, 0.2)
      push(displayGlow, ex, SURFACE + 4.2, front - 0.3, 6, 0.2, 0.2)
      board('market', bx, SURFACE + h + 3.6, front - 0.3, 24, -1)
      // 购物车棚：顶棚 + 三排车
      const tx = bx + W1 * 0.28
      push(canopy, tx, SURFACE + 2.6, front - 5, 8, 0.15, 3.6)
      for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) push(steelP, tx - 3.4 + i * 0.85, SURFACE + 0.55, front - 6.2 + r * 1.2, 0.6, 1.0, 1.0)
      // 卸货月台（侧面）+ 货车
      const dx = bx - W1 / 2
      push(wallGrey, dx - 1.5, SURFACE + 0.6, bz + D1 * 0.2, 3, 1.2, D1 * 0.5)
      for (let i = 0; i < 3; i++) push(darkP, dx - 0.1, SURFACE + 2.4, bz + D1 * 0.02 + i * D1 * 0.16, 0.1, 3.6, 3.4)
      for (let i = 0; i < 2; i++) boxTruck(dx - 8, bz + D1 * 0.1 + i * D1 * 0.22, false)
      pad(tarmac, dx - 8, bz + D1 * 0.15, 14, D1 * 0.6, 0.25, 0.2)
      // 旁边整块停车场：真车型
      fillParking(b, b.x0 + 3, dx - 16, b.z0 + 2, b.z1 - 2)
      return
    }
    if (k === 'busterm') {
      // 公交总站：站房 + 长雨棚站台 + 停着的公交
      pushBuilding('#e4e8ea', 'podium', cx - W0 / 2 + 16, SURFACE + 5, b.cz, 28, 10, Math.min(D0, 30))
      signAt(10.5, 24)
      for (let i = 0; i < 3; i++) {
        const pz = b.z0 + 12 + i * Math.max(10, (D0 - 10) / 3)
        push(pave, cx + 14, SURFACE + 0.3, pz, W0 - 40, 0.3, 3)
        push(canopy, cx + 14, SURFACE + 4, pz, W0 - 40, 0.2, 5)
        for (let x = cx - W0 / 2 + 36; x < cx + W0 / 2 - 6; x += 12) push(stMull, x, SURFACE + 2, pz, 0.15, 4, 0.15)
        for (let j = 0; j < 3; j++) {
          const bx = cx - W0 / 2 + 40 + j * 16
          if (bx > cx + W0 / 2 - 10) break
          lotCar(bx, SURFACE + 0.02, pz + 3.6, 0, 'bus')
        }
      }
      return
    }
    if (k === 'office') {
      // 写字楼广场：两栋幕墙塔 + 中央广场喷泉
      const tw = Math.min(W0 * 0.3, 40)
      const td = Math.min(D0 * 0.55, 40)
      curGrp++
      placeTower('core', cx - W0 / 2 + tw / 2 + 2, b.cz + D0 * 0.15, tw, td, b, { height: range(rng, 160, 240), style: 'curtain', col: pick(rng, WALL_GLASS) })
      curGrp++
      placeTower('core', cx + W0 / 2 - tw / 2 - 2, b.cz + D0 * 0.15, tw, td, b, { height: range(rng, 130, 200), style: 'curtain', col: pick(rng, WALL_GLASS) })
      pad(pave, cx, b.cz - D0 * 0.2, W0 - tw * 2 - 8, D0 * 0.5, 0.24, 0.1)
      push(villaWater, cx, SURFACE + 0.5, b.cz - D0 * 0.2, 12, 0.4, 8)
      push(whiteP, cx, SURFACE + 1.4, b.cz - D0 * 0.2, 0.8, 2.2, 0.8)
      board('office', cx, SURFACE + 3, fz + 2, 16, -1)
      return
    }
    // 其余：一栋带标识的主楼 + 前广场（各自造型）
    const S = {
      library: { h: 22, st: 'ribbon', col: '#d8cfc0', w: 0.7, d: 0.6 },
      museum: { h: 20, st: 'punch', col: '#e8e2d4', w: 0.7, d: 0.55 },
      cinema: { h: 24, st: 'podium', col: '#3a3a44', w: 0.65, d: 0.6 },
      police: { h: 18, st: 'punch', col: '#e8ecf0', w: 0.6, d: 0.5 },
      fire: { h: 12, st: 'podium', col: '#b8302a', w: 0.6, d: 0.5 },
      post: { h: 14, st: 'punch', col: '#e9efe9', w: 0.6, d: 0.5 },
      hotel: { h: range(rng, 80, 140), st: 'hotel', col: pick(rng, HOTEL), w: 0.45, d: 0.45 },
      market: { h: 9, st: 'podium', col: '#f4f2ee', w: 0.75, d: 0.55 },
    }[k]
    const bigLib = b.big && (k === 'library' || k === 'museum')
    if (bigLib) S.h = k === 'library' ? 30 : 26
    const w = Math.min(W0 * (bigLib ? 0.78 : S.w), bigLib ? 140 : 90)
    const d = Math.min(D0 * (bigLib ? 0.5 : S.d), bigLib ? 84 : 60)
    const bz = bigLib ? b.z1 - 24 - d / 2 : b.z1 - 3 - d / 2
    if (k === 'hotel') {
      placeTower('high', cx, bz, w, d, b, { height: S.h, style: 'hotel', col: S.col, skipPodium: true, forms: ['slab', 'chamfer', 'twin', 'stack'] })
      // 门廊雨棚（落客区）
      push(canopy, cx, SURFACE + 5, bz - d / 2 - 5, 18, 0.5, 10)
      for (const s of [-1, 1]) push(whiteP, cx + s * 8, SURFACE + 2.5, bz - d / 2 - 9.5, 0.6, 5, 0.6)
    } else {
      pushBuilding(S.col, S.st, cx, SURFACE + S.h / 2, bz, w, S.h, d)
    }
    const front = bz - d / 2
    if (k === 'museum' || k === 'library') {
      // 古典柱廊 + 台阶（博物馆再加穹顶）
      const n = Math.max(6, Math.floor(w / 4))
      for (let i = 0; i < n; i++) push(whiteP, cx - w * 0.4 + i * (w * 0.8 / (n - 1)), SURFACE + 0.6 + 4.5, front - 3, 1.0, 9, 1.0)
      push(whiteP, cx, SURFACE + 10.2, front - 3, w * 0.86, 1.2, 4)
      for (let i = 0; i < 3; i++) push(pave, cx, SURFACE + 0.2 + i * 0.2, front - 6 + i * 0.8, w * 0.8, 0.2, 2.6)
      if (k === 'museum') pushCylBuilding('#c8c0b0', cx, SURFACE + S.h + 5, bz, Math.min(w, d) * 0.22, 10)
      if (bigLib) {
        // 大馆：两翼 + 中庭玻璃天窗 + 后花园阅读草坪 + 前广场水景
        for (const s2 of [-1, 1]) pushBuilding(S.col, S.st, cx + s2 * (w / 2 + 14), SURFACE + S.h * 0.35, bz + d * 0.1, 26, S.h * 0.7, d * 0.7)
        push(glassPortal, cx, SURFACE + S.h + 2.2, bz, w * 0.4, 3.6, d * 0.4)
        pad(lawn, cx, b.z1 - 11, b.w - 16, 16, 0.3, 0.3)
        push(villaWater, cx, SURFACE + 0.5, front - 22, 34, 0.4, 10)
      }
    }
    if (k === 'cinema') {
      // 影城立面分区：顶部居中院名大字（下方 board）｜中段左右两块电影海报（各自独立、不与院名同排）｜底部一条 LED 字幕在海报下沿以下
      const pw = Math.min(16, w * 0.26)
      const ph = pw * 0.56
      const py = SURFACE + 6.6 + ph / 2
      for (const s2 of [-1, 1]) {
        const px = cx + s2 * (w / 2 - pw / 2 - 3)
        push(adPools[(rng() * adPools.length) | 0], px, py, front - 0.4, pw, ph, 0.3)
        regSign(px, py, front - 0.4, pw, ph, 0, -1)
      }
      push(cylLed, cx, SURFACE + 5.0, front - 0.6, w * 0.9, 0.5, 0.3)
      regSign(cx, SURFACE + 5.0, front - 0.6, w * 0.9, 0.5, 0, -1)
    }
    if (k === 'fire') {
      for (let i = 0; i < 3; i++) push(redP, cx - w * 0.3 + i * w * 0.3, SURFACE + 2.4, front - 0.1, w * 0.24, 4.6, 0.12)
      pushBuilding('#b8302a', 'punch', cx + w / 2 + 3, SURFACE + 12, bz, 5, 24, 5)
      for (let i = 0; i < 2; i++) push(redP, cx - w * 0.15 + i * w * 0.3, SURFACE + 1.4, front - 6, 2.5, 2.6, 8)
    }
    if (k === 'police') {
      push(courtB, cx, SURFACE + S.h - 2, front - 0.1, w, 0.8, 0.15)
      for (let i = 0; i < 3; i++) villaCarAt(cx - 12 + i * 6, SURFACE, front - 8)
    }
    if (k === 'post') push(pitchG, cx, SURFACE + S.h - 2, front - 0.1, w, 0.8, 0.15)
    if (k === 'market') {
      fillParking(b, b.x0 + 4, b.x1 - 4, b.z0 + 2, Math.max(b.z0 + 20, front - 4))
      push(redP, cx, SURFACE + S.h - 1, front - 0.12, w * 0.98, 1.2, 0.15)
    } else frontPlaza(b, Math.max(4, front - b.z0 - 4))
    {
      // 院名招牌：影城放在顶部居中（海报在下面两侧）；其余放在门头上方
      const bw = Math.min(w * 0.6, 24)
      const by = k === 'cinema' ? SURFACE + S.h - 1.5 - bw / 8 : SURFACE + Math.min(S.h - 2.5, 12)
      board(k, cx, by, front - 0.45, bw, -1)
    }
  }
  /** 任意高度停一辆车（车库各层/警局门口） */
  function villaCarAt(x, y, z) {
    return lotCar(x, y, z, Math.PI / 2)
    // eslint-disable-next-line no-unreachable
    const body = pick(rng, carPools)
    push(body, x, y + 0.68, z, 1.85, 0.62, 4.5)
    push(villaWin, x, y + 1.22, z, 1.7, 0.5, 2.4)
    for (const a of [-1, 1]) for (const c of [-1, 1]) push(tarmac, x + a * 0.8, y + 0.32, z + c * 1.45, 0.26, 0.64, 0.64)
  }
  function fillBlock(b) {
    curDistrict = b.district || null
    curBlockB = b
    if (FACILITY_KINDS.has(b.kind)) return fillFacility(b)
    if (b.kind === 'plaza' && b.w > 90 && b.d > 80) return placePlaza(b)
    if (b.kind === 'park' || b.kind === 'riverbank' || b.kind === 'plaza') return
    if (b.spike) return placeSpike(b)
    if (b.kind === 'villa') return fillVilla(b)
    if (b.kind === 'hospital') return fillHospital(b)
    if (b.kind === 'school') return fillSchool(b)
    if (b.kind === 'sports' || b.kind === 'gym') return fillSports(b)
    if (b.kind === 'parking') return fillParking(b, b.x0, b.x1, b.z0, b.z1)
    if (b.kind === 'gas') return fillGas(b)
    if (b.kind === 'mall') {
      placeMall(b)
      return
    }

    const pad = 1.2
    const usableW = b.w - pad * 2
    const usableD = b.d - pad * 2
    if (usableW < 16 || usableD < 16) return

    // 异形地标塔：核心/高层街块偶发
    if ((b.kind === 'core' || b.kind === 'high') && Math.min(usableW, usableD) > 62 && rng() < 0.2) {
      if (placeIconic(b) !== false) return
    }

    // 核心大地块偶发「一整块一栋超高」，底座够宽才压得住高度
    if ((b.kind === 'core' || b.kind === 'high') && Math.min(usableW, usableD) > 70 && rng() < 0.22) {
      placeNYCLot(b.x0 + pad, b.x1 - pad, b.z0 + pad, b.z1 - pad, 'core', b)
      return
    }

    const alongStreet = usableW >= usableD
    let cursor = 0
    const front = alongStreet ? usableW : usableD
    const depth = alongStreet ? usableD : usableW

    // 先切完所有地皮，再按邻接关系关掉分户墙店面
    const lots = []
    while (cursor < front - 8) {
      let lotFront =
        b.kind === 'core' || b.kind === 'high' ? range(rng, 32, 64) :
        range(rng, 22, 48)
      if (rng() < 0.14) lotFront = range(rng, 60, Math.min(120, front - cursor))
      lotFront = Math.min(lotFront, front - cursor)
      if (front - cursor - lotFront < 16) lotFront = front - cursor
      lots.push({ cursor, lotFront })
      cursor += lotFront
    }

    for (let i = 0; i < lots.length; i++) {
      const { cursor: c0, lotFront } = lots[i]
      // 沿排方向的两侧贴邻地皮 → 不开店；街块外缘（首尾）才开侧门脸
      const open = alongStreet
        ? { xn: i === 0, xp: i === lots.length - 1, zn: true, zp: true }
        : { xn: true, xp: true, zn: i === 0, zp: i === lots.length - 1 }
      if (alongStreet) {
        placeNYCLot(
          b.x0 + pad + c0,
          b.x0 + pad + c0 + lotFront,
          b.z0 + pad,
          b.z0 + pad + depth,
          b.kind,
          b,
          { open },
        )
      } else {
        placeNYCLot(
          b.x0 + pad,
          b.x0 + pad + depth,
          b.z0 + pad + c0,
          b.z0 + pad + c0 + lotFront,
          b.kind,
          b,
          { open },
        )
      }
    }
  }

  /**
   * 市民广场：四周抬起 4.2m 的平台（可上人，种树、遮阳棚），中间围出下沉庭院（阶梯看台 + 喷泉 + 地下商场入口），
   * 南北两侧大台阶 + 扶梯从街面上平台
   */
  function placePlaza(b) {
    curGrp++
    const Hd = 4.2
    const ox0 = b.x0 + 6, ox1 = b.x1 - 6
    const oz0 = b.z0 + 15, oz1 = b.z1 - 15
    const cw = (ox1 - ox0) * 0.5
    const cd = (oz1 - oz0) * 0.5
    const cx = b.cx, cz = b.cz
    const ix0 = cx - cw / 2, ix1 = cx + cw / 2, iz0 = cz - cd / 2, iz1 = cz + cd / 2
    const deck = (x0, x1, z0, z1) => {
      push(bridgeDeck, (x0 + x1) / 2, SURFACE + Hd / 2, (z0 + z1) / 2, x1 - x0, Hd, z1 - z0)
      addSolid((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, SURFACE + Hd)
    }
    deck(ox0, ix0, oz0, oz1)
    deck(ix1, ox1, oz0, oz1)
    deck(ix0, ix1, oz0, iz0)
    deck(ix0, ix1, iz1, oz1)
    // 平台压顶 + 外立面绿篱
    for (const z of [oz0, oz1]) push(stoneStep, cx, SURFACE + Hd + 0.1, z, ox1 - ox0 + 0.4, 0.2, 0.6)
    for (const x of [ox0, ox1]) push(stoneStep, x, SURFACE + Hd + 0.1, cz, 0.6, 0.2, oz1 - oz0 + 0.4)
    for (const x of [ox0 - 0.7, ox1 + 0.7]) push(hedge, x, SURFACE + 0.7, cz, 1.2, 1.4, oz1 - oz0 - 4)
    // 下沉庭院：南北两侧阶梯看台（每级 0.6m，可坐可走）
    const nA = 7
    for (const [ez, dz] of [[iz0, 1], [iz1, -1]]) {
      for (let i = 0; i < nA; i++) {
        const top = SURFACE + Hd - (i + 1) * (Hd / nA)
        if (top <= SURFACE + 0.05) break
        const zc = ez + dz * (i + 0.5) * 1.1
        push(stoneStep, cx, (SURFACE + top) / 2, zc, cw - 0.2, top - SURFACE, 1.12)
        addSolid(cx, zc, cw - 0.2, 1.1, top)
      }
    }
    // 东西两侧：玻璃栏板 + 地下商场入口（玻璃门厅 + 招牌）
    for (const [ex, dx] of [[ix0, 1], [ix1, -1]]) {
      push(caseGlass, ex, SURFACE + Hd + 0.6, cz, 0.06, 1.1, cd)
      push(steelP, ex, SURFACE + Hd + 1.2, cz, 0.1, 0.08, cd)
    }
    push(glassPortal, ix0 + 1.2, SURFACE + 1.8, cz, 2.4, 3.6, Math.min(16, cd * 0.4))
    push(boards.mall, ix0 + 0.35, SURFACE + 3.4 + 0.1, cz, 0.3, 1.1, Math.min(9, cd * 0.3), 0)
    // 庭院：铺地 + 喷泉 + 四棵大树
    push(stoneStep, cx, SURFACE + 0.14, cz, cw - 0.4, 0.28, cd - 15)
    const fr = Math.min(7, cw * 0.12)
    push(stoneStep, cx, SURFACE + 0.5, cz, fr * 2 + 1.4, 0.5, fr * 2 + 1.4)
    push(villaWater, cx, SURFACE + 0.72, cz, fr * 2, 0.1, fr * 2)
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = cx + sx * cw * 0.32
      const tz = cz + sz * (cd / 2 - 9.5)
      push(soilP, tx, SURFACE + 0.5, tz, 3.4, 0.5, 3.4)
      push(woodP, tx, SURFACE + 3.0, tz, 0.5, 5, 0.5)
      push(hedge, tx, SURFACE + 7.2, tz, 7, 4.6, 7)
      push(hedge, tx, SURFACE + 9.4, tz, 4.4, 2.4, 4.4)
    }
    // 平台上：树阵 + 两座遮阳棚
    for (const x of [(ox0 + ix0) / 2, (ix1 + ox1) / 2]) {
      for (let i = 0; i < 4; i++) {
        const tz = oz0 + 8 + i * (oz1 - oz0 - 16) / 3
        push(soilP, x, SURFACE + Hd + 0.4, tz, 3, 0.6, 3)
        push(woodP, x, SURFACE + Hd + 2.6, tz, 0.4, 4, 0.4)
        push(hedge, x, SURFACE + Hd + 5.8, tz, 5.6, 3.8, 5.6)
      }
      push(canopy, x, SURFACE + Hd + 4.2, cz, Math.min(10, ix0 - ox0 - 2), 0.25, 16)
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) push(steelP, x + a * 3.5, SURFACE + Hd + 2.1, cz + c * 7, 0.18, 4.2, 0.18)
    }
    // 南北大台阶 + 扶梯：街面 → 平台
    for (const [ez, dz] of [[oz0, -1], [oz1, 1]]) {
      const n = 14
      for (let i = 0; i < n; i++) {
        const top = SURFACE + Hd - i * (Hd / n)
        const zc = ez + dz * (i + 0.5) * 0.85
        push(stoneStep, cx, (SURFACE + top) / 2, zc, 22, top - SURFACE, 0.87)
        addSolid(cx, zc, 22, 0.85, top)
      }
      for (const s of [-1, 1]) {
        const ex = cx + s * 13.4
        const ne = 20
        for (let i = 0; i < ne; i++) {
          const top = SURFACE + Hd - i * (Hd / ne)
          push(treadP, ex, top - 0.15, ez + dz * (i + 0.5) * (12 / ne), 1.3, 0.3, 12 / ne + 0.02)
        }
        for (const k of [-1, 1]) push(caseGlass, ex + k * 0.75, SURFACE + Hd / 2 + 0.5, ez + dz * 6, 0.05, 1.1, 12)
      }
    }
  }

  function placeMall(b) {
    const depth = 12
    const frontN = b.mega ? 2 : 1 + ((rng() * 2) | 0)
    const sides = [
      { alongX: true, x0: b.x0 + 1, z0: b.z0, len: b.w - 2, toward: true },
      { alongX: true, x0: b.x0 + 1, z0: b.z1, len: b.w - 2, toward: false },
      { alongX: false, x0: b.x0, z0: b.z0 + 8, len: b.d - 16, toward: true },
      { alongX: false, x0: b.x1, z0: b.z0 + 8, len: b.d - 16, toward: false },
    ].sort(() => rng() - 0.5)
    for (let i = 0; i < frontN; i++) {
      const s = sides[i]
      placeRow(s.alongX, s.x0, s.z0, s.len, depth, s.toward, 'shop', {
        fill: range(rng, 0.45, 0.8),
        sparse: rng() < 0.4,
      })
    }

    const pad = b.mega ? range(rng, 28, 48) : range(rng, 22, 36)
    const w = b.w - pad * 2
    const d = b.d - pad * 2
    if (w < 36 || d < 36) return
    curGrp++
    const h = heightFor('mall', rng, b)
    const cx = b.cx + range(rng, -8, 8)
    const cz = b.cz + range(rng, -8, 8)
    // 多层商场：两级退台裙楼 + 屋顶玻璃中庭天窗 + 双层高玻璃主入口（门廊 + 招牌）+ 门前广场
    const h1 = Math.max(16, h * 0.42)
    const h2 = Math.max(10, h * 0.3)
    pushBuilding(pick(rng, PODIUM), 'podium', cx, SURFACE + h1 / 2, cz, w, h1, d)
    pushBuilding(pick(rng, PODIUM), 'podium', cx, SURFACE + h1 + h2 / 2, cz + d * 0.04, w * 0.84, h2, d * 0.8)
    if (h > 40) {
      pushBuilding(pick(rng, WALL_GLASS), 'curtain', cx + w * 0.18, SURFACE + h1 + h2 + h * 0.2, cz + d * 0.12, w * 0.36, h * 0.4, d * 0.36)
    }
    const topY = SURFACE + h1 + h2
    // 中庭天窗：玻璃采光顶 + 钢肋
    const aw = w * 0.34
    const ad = d * 0.3
    push(glassPortal, cx - w * 0.12, topY + 3.6, cz - d * 0.04, aw, 1.6, ad)
    for (let i = -2; i <= 2; i++) push(accent, cx - w * 0.12 + i * aw / 5, topY + 4.5, cz - d * 0.04, 0.4, 0.4, ad + 0.6)
    // 主入口：外凸玻璃门厅（两层高）+ 门廊雨棚 + 招牌
    const ew = Math.min(34, w * 0.32)
    const fz = cz - d / 2
    push(glassPortal, cx, SURFACE + 7.2, fz - 2.2, ew, 14.4, 4.4)
    push(accent, cx, SURFACE + 14.8, fz - 2.2, ew + 1.2, 0.8, 4.8)
    for (let i = 0; i <= 4; i++) push(accent, cx - ew / 2 + i * ew / 4, SURFACE + 7.2, fz - 4.45, 0.35, 14.4, 0.35)
    push(canopy, cx, SURFACE + 5.6, fz - 8, ew + 6, 0.45, 8)
    for (const s of [-1, 1]) push(steelP, cx + s * (ew / 2 + 2), SURFACE + 2.8, fz - 11.4, 0.3, 5.6, 0.3)
    push(boards.mall, cx, SURFACE + 17.6, fz - 0.4, Math.min(24, ew * 0.8), 4.2, 0.35)
    // 门前广场（铺装 + 一排树池）
    if (pad > 18) {
      push(stoneStep, cx, SURFACE + 0.16, fz - pad / 2, Math.min(w, ew * 2.4), 0.32, pad - 6)
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const tx = cx + s * (ew * 0.7 + i * 7)
        push(soilP, tx, SURFACE + 0.45, fz - pad / 2, 2.6, 0.3, 2.6)
        push(woodP, tx, SURFACE + 2.2, fz - pad / 2, 0.35, 3.6, 0.35)
        push(hedge, tx, SURFACE + 5.0, fz - pad / 2, 4.6, 3.4, 4.6)
      }
    }
    dressNear(cx, SURFACE, cz, w, Math.min(h1, 40), d, 'podium', { shop: true })
  }

  /** 超高只集中在两三个簇 */
  const SPIKE_ZONES = [
    { x: 0.14 * W.cityWidth, z: 0.02 * W.segmentLength, r: 420 },
    { x: -0.18 * W.cityWidth, z: -0.12 * W.segmentLength, r: 360 },
    { x: 0.08 * W.cityWidth, z: 0.2 * W.segmentLength, r: 300 },
  ]
  function nearSpike(x, z) {
    return SPIKE_ZONES.some((z0) => Math.hypot(x - z0.x, z - z0.z) < z0.r)
  }

  // 地标超高：在簇内预留整块地皮（不跨路、不压别的楼），fillBlock 遇到就建超高
  for (const zone of SPIKE_ZONES) {
    const cands = plan.blocks.filter((b) => (b.kind === 'core' || b.kind === 'high') && !b.spike &&
      Math.hypot(b.cx - zone.x, b.cz - zone.z) < zone.r && Math.abs(b.cx) > W.riverWidth / 2 + 140 && Math.min(b.w, b.d) >= 56)
    for (let i = cands.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0
      ;[cands[i], cands[j]] = [cands[j], cands[i]]
    }
    const n = Math.min(cands.length, 3 + ((rng() * 2) | 0))
    for (let i = 0; i < n; i++) cands[i].spike = true
  }
  for (const b of plan.blocks) fillBlock(b)
  curDistrict = null
  curBlockB = null

  // ── 特色片区装点：步行街（铺地/灯笼/摊位/牌坊）、酒吧街（霓虹灯串）、动漫区（巨型手办雕像）、老城（灯笼/牌坊）──
  {
    const clearAt = (x, z, w, d) => {
      const list = querySolids(x, z)
      for (const c of list) if (c.base < SURFACE + 12 && Math.abs(c.x - x) < (c.w + w) / 2 && Math.abs(c.z - z) < (c.d + d) / 2) return false
      return true
    }
    const gate = (x, z, key, chinese) => {
      for (const s of [-1, 1]) {
        push(chinese ? redP : billFrame, x, SURFACE + 3.6, z + s * 8.6, 0.9, 7.2, 0.9)
        addSolid(x, z + s * 8.6, 0.9, 0.9, SURFACE + 7.2)
      }
      push(chinese ? redP : billFrame, x, SURFACE + 7.4, z, 1.0, 0.9, 19)
      if (chinese) push(gablePools[3], x, SURFACE + 8.4, z, 2.4, 1.2, 20)
      push(boards[key], x, SURFACE + 6.2, z, 12, 3, 0.3, Math.PI / 2)
    }
    const segs = (x0, x1) => {
      const cuts = plan.avenues.filter((a) => a > x0 && a < x1).sort((a, b) => a - b)
      const out = []
      let c = x0
      for (const a of cuts) { if (a - W.avenueW / 2 - 1 > c + 4) out.push([c, a - W.avenueW / 2 - 1]); c = a + W.avenueW / 2 + 1 }
      if (x1 > c + 4) out.push([c, x1])
      return out
    }
    for (const D of plan.districts || []) {
      curGrp++
      if (D.id === 'walk' || D.id === 'bar') {
        const z = D.street
        const walkSt = D.id === 'walk'
        for (const [a0, a1] of segs(D.x0, D.x1)) {
          // 整条街铺石材地面（车道变步行；酒吧街同样禁车）
          push(walkSt ? pave : barPave, (a0 + a1) / 2, SURFACE + 0.115, z, a1 - a0, 0.03, W.streetW)
          walks.push({ x: (a0 + a1) / 2, z, w: a1 - a0, d: W.streetW, y: SURFACE + 0.13 })
          // 入口挡车柱：每段两端一排不锈钢柱（1.6m 间距，人能过车不能过），柱头一圈反光带
          for (const ex of [a0 + 1.2, a1 - 1.2]) {
            for (let bz = z - W.streetW / 2 + 1.2; bz <= z + W.streetW / 2 - 1.1; bz += 1.6) {
              push(bollardP, ex, SURFACE + 0.13 + 0.45, bz, 0.22, 0.9, 0.22)
              push(whiteP, ex, SURFACE + 0.13 + 0.78, bz, 0.24, 0.08, 0.24)
            }
          }
          for (let x = a0 + 6; x < a1 - 4; x += walkSt ? 10 : 12) {
            // 跨街灯串
            push(rail, x, SURFACE + 6.6, z, 0.04, 0.04, W.streetW + 4)
            const n = 5
            for (let i = 0; i < n; i++) {
              const lz = z - W.streetW / 2 + (i + 0.5) * (W.streetW / n)
              if (walkSt) push(redP, x, SURFACE + 6.1 - Math.sin(((i + 0.5) / n) * Math.PI) * 0.6, lz, 0.55, 0.75, 0.55)
              else push(i % 2 ? cylLed : neonC, x, SURFACE + 6.2 - Math.sin(((i + 0.5) / n) * Math.PI) * 0.5, lz, 0.25, 0.25, W.streetW / n * 0.9)
            }
            // 步行街中线摊位
            if (walkSt && ((x - a0) / 10 | 0) % 2 === 0) {
              const sx = x + 5
              if (sx < a1 - 4 && clearAt(sx, z, 3, 2)) {
                push(outWood, sx, SURFACE + 0.55, z, 2.2, 0.9, 1.2)
                for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) push(stMull, sx + dx * 1.1, SURFACE + 1.2, z + dz * 0.8, 0.06, 2.4, 0.06)
                push(pickPool(awningPools), sx, SURFACE + 2.45, z, 2.6, 0.08, 1.9)
                for (let i = 0; i < 4; i++) push(pickPool(flowerPools), sx - 0.8 + i * 0.55, SURFACE + 1.1, z + (i % 2 ? 0.25 : -0.25), 0.4, 0.2, 0.35)
                push(villaWinLit, sx, SURFACE + 2.3, z, 0.3, 0.12, 0.3)
                addSolid(sx, z, 2.3, 1.3, SURFACE + 1.0)
              }
            }
          }
        }
        gate(D.x0 + 2, z, walkSt ? 'walkst' : 'barst', walkSt)
        gate(D.x1 - 2, z, walkSt ? 'walkst' : 'barst', walkSt)
      } else if (D.id === 'anime') {
        // 巨型手办雕像：放在片区里的空地/路口转角
        let placed = 0
        for (const b of plan.blocks) {
          if (placed >= 8) break
          if (b.cx < D.x0 || b.cx > D.x1 || b.cz < D.z0 || b.cz > D.z1) continue
          for (const [sx, sz] of [[-1, -1], [1, 1]]) {
            const x = b.cx + sx * (b.w / 2 - 5)
            const z = b.cz + sz * (b.d / 2 - 5)
            if (!clearAt(x, z, 6, 6)) continue
            const s = range(rng, 0.8, 1.3)
            const c1 = pickPool(flowerPools)
            const c2 = pickPool(flowerPools)
            push(pave, x, SURFACE + 0.6, z, 5, 1.2, 5)
            for (const l of [-1, 1]) push(outDark, x + l * 0.7 * s, SURFACE + 1.2 + 2.2 * s, z, 0.8 * s, 4.4 * s, 0.9 * s)
            push(c1, x, SURFACE + 1.2 + 6.0 * s, z, 2.6 * s, 3.4 * s, 1.5 * s)
            for (const l of [-1, 1]) push(c1, x + l * 1.75 * s, SURFACE + 1.2 + 6.4 * s, z, 0.7 * s, 3.0 * s, 0.7 * s)
            push(whiteP, x, SURFACE + 1.2 + 9.2 * s, z, 2.6 * s, 2.6 * s, 2.4 * s)
            push(c2, x, SURFACE + 1.2 + 10.8 * s, z, 3.0 * s, 1.0 * s, 2.8 * s)
            for (let i = 0; i < 4; i++) push(c2, x - 1.2 * s + i * 0.8 * s, SURFACE + 1.2 + 11.7 * s, z, 0.5 * s, 1.2 * s, 0.5 * s)
            for (const l of [-1, 1]) push(outDark, x + l * 0.6 * s, SURFACE + 1.2 + 9.4 * s, z - 1.25 * s, 0.5 * s, 0.7 * s, 0.05)
            addSolid(x, z, 5, 5, SURFACE + 1.2 + 12 * s)
            placed++
            break
          }
        }
        gate(D.x0 + 2, (D.z0 + D.z1) / 2, 'anime', false)
      } else if (D.id === 'old') {
        // 老城：沿街红灯笼 + 牌坊
        for (const z of plan.streets) {
          if (z < D.z0 || z > D.z1) continue
          for (const [a0, a1] of segs(D.x0, D.x1)) {
            for (let x = a0 + 5; x < a1 - 3; x += 9) {
              for (const s of [-1, 1]) {
                push(rail, x, SURFACE + 3.2, z + s * (W.streetW / 2 + 5.2), 0.04, 0.6, 0.04)
                push(redP, x, SURFACE + 2.7, z + s * (W.streetW / 2 + 5.2), 0.5, 0.7, 0.5)
              }
            }
          }
          gate(D.x1 - 2, z, 'oldtown', true)
        }
      }
    }
  }


  // ── 过街天桥（楼梯 + 扶梯，玻璃栏板 + 顶棚）与地铁出入口：CBD / 商业街路口按步行圈布点 ──
  {
    const aw = W.avenueW
    const sw = W.streetW
    const commerce = new Set(plan.commerceStreets || [])
    const cbd = (plan.districts || []).find((d) => d.id === 'cbd')
    const ops = []
    const metros = []
    for (const ax of plan.avenues) for (const sz of plan.streets) {
      if (Math.abs(ax) < W.riverWidth / 2 + 120 || Math.abs(ax) > W.cityWidth / 2 - 120) continue
      if (Math.abs(sz) > W.segmentLength / 2 - 120) continue
      const inC = !!cbd && ax > cbd.x0 && ax < cbd.x1 && sz > cbd.z0 && sz < cbd.z1
      const hh = Math.abs(Math.sin(ax * 12.9898 + sz * 78.233) * 43758.5453) % 1
      const s = hh * 7 % 1 < 0.5 ? -1 : 1
      if (plan.isClosed?.(ax, sz, -40)) continue
      if ((inC && hh < 0.5) || (commerce.has(sz) && hh < 0.3)) ops.push({ x: ax, z: sz + s * (sw / 2 + 9), s })
      // 地铁口：约每 600~800m 一个（路口一角）
      if (hh > 0.55 && hh < (inC ? 0.95 : 0.8)) {
        const sx = hh * 13 % 1 < 0.5 ? -1 : 1
        metros.push({ x: ax + sx * (aw / 2 + 3.6), z: sz - s * (sw / 2 + 13), s: -s })
      }
    }
    plan.overpasses = ops
    plan.metros = metros
    const H = 6.4 // 桥面底净空
    for (const o of ops) {
      curGrp++
      const L = aw + 11
      const z = o.z
      // 桥面 + 边梁 + 玻璃栏板 + 不锈钢扶手 + 弧形顶棚（分段）+ 桥下灯带
      push(bridgeDeck, o.x, SURFACE + H + 0.4, z, L, 0.8, 4.2)
      addSolid(o.x, z, L, 4.2, SURFACE + H + 0.8, SURFACE + H)
      for (const k of [-1, 1]) {
        push(accent, o.x, SURFACE + H + 0.1, z + k * 2.15, L, 1.0, 0.3)
        push(caseGlass, o.x, SURFACE + H + 1.4, z + k * 2.0, L, 1.2, 0.05)
        push(steelP, o.x, SURFACE + H + 2.05, z + k * 2.0, L, 0.08, 0.1)
      }
      for (let i = 0; i <= 6; i++) {
        const px = o.x - L / 2 + i * L / 6
        for (const k of [-1, 1]) push(accent, px, SURFACE + H + 2.4, z + k * 2.0, 0.18, 3.2, 0.18)
      }
      push(glassPortal, o.x, SURFACE + H + 4.1, z, L + 0.6, 0.15, 4.8)
      push(roomLight, o.x, SURFACE + H - 0.02, z, L * 0.9, 0.04, 0.3)
      // 两端：一端楼梯，一端扶梯；落在人行道上，沿大道方向背离路口
      for (const side of [-1, 1]) {
        const ex = o.x + side * (aw / 2 + 4.0)
        push(accent, o.x + side * (L / 2 - 0.6), SURFACE + H / 2, z, 1.2, H, 1.2)
        const run = 12.5
        const dir = o.s
        const n = side < 0 ? 20 : 30
        for (let i = 0; i < n; i++) {
          const top = SURFACE + 0.26 + (i + 1) * (H + 0.54) / n
          const zc = z + dir * (2.1 + run - (i + 0.5) * run / n)
          push(side < 0 ? stoneStep : treadP, ex, top - 0.15, zc, 2.6, 0.3, run / n + 0.03)
          addSolid(ex, zc, 2.6, run / n, top, top - 0.3)
        }
        // 斜梁 + 栏板（分段折线）
        for (let i = 0; i < 5; i++) {
          const t = (i + 0.5) / 5
          const yy = SURFACE + 0.26 + (1 - t) * (H + 0.54)
          const zc = z + dir * (2.1 + t * run)
          for (const k of [-1, 1]) {
            push(side < 0 ? accent : caseGlass, ex + k * 1.35, yy + 0.5, zc, 0.12, side < 0 ? 0.6 : 1.1, run / 5 + 0.05)
            push(steelP, ex + k * 1.35, yy + 1.05, zc, 0.1, 0.08, run / 5 + 0.05)
          }
          push(accent, ex, yy - 0.5, zc, 2.2, 0.5, run / 5 + 0.05)
        }
        if (side > 0) push(canopy, ex, SURFACE + H + 3.6, z + dir * (2.1 + run / 2), 3.4, 0.2, run + 1)
        // 平台立柱
        push(accent, ex, SURFACE + H / 2, z + dir * 1.2, 0.8, H, 0.8)
      }
    }
    // 地铁出入口：玻璃顶亭 + 下沉楼梯口（深色坑）+ 红色立柱标识
    for (const m of metros) {
      curGrp++
      const zc = m.z + m.s * 3.6
      push(darkP, m.x, SURFACE + 0.27, zc, 2.6, 0.04, 6.4)
      for (const k of [-1, 1]) {
        push(caseGlass, m.x + k * 1.55, SURFACE + 1.4, zc, 0.06, 2.3, 7.0)
        push(steelP, m.x + k * 1.55, SURFACE + 1.4, zc - m.s * 3.5, 0.12, 2.6, 0.12)
        push(steelP, m.x + k * 1.55, SURFACE + 1.4, zc + m.s * 3.5, 0.12, 2.6, 0.12)
      }
      push(caseGlass, m.x, SURFACE + 1.4, zc + m.s * 3.5, 3.1, 2.3, 0.06)
      push(glassPortal, m.x, SURFACE + 2.8, zc, 3.4, 0.14, 7.4)
      push(boards.metro, m.x, SURFACE + 2.1, zc - m.s * 3.56, 2.4, 0.7, 0.1)
      // 立柱标识
      const tz = zc - m.s * 5.2
      push(redP, m.x, SURFACE + 1.8, tz, 0.36, 3.1, 0.36)
      push(boards.metro, m.x, SURFACE + 3.6, tz, 0.9, 0.9, 0.9)
      addSolid(m.x, zc, 3.2, 7.2, SURFACE + 2.9)
    }
  }

  // ── 城墙内侧贴墙楼：落地、有立面/夜灯/碰撞，避开街口；墙顶观景楼坐在平台上 ──
  // 城门：每侧 4 处，地面是深门洞 + 门楼，配直通墙顶的观光电梯；墙顶对应位置是城门广场 + 角楼
  const gatesZ = (() => {
    const sts = plan.streets.slice().sort((a, b) => a - b)
    const mids = []
    for (let i = 0; i + 1 < sts.length; i++) if (sts[i + 1] - sts[i] > 110) mids.push((sts[i] + sts[i + 1]) / 2)
    const out = []
    for (const t of [-0.36, -0.12, 0.12, 0.36]) {
      let best = null
      for (const m of mids) if (best === null || Math.abs(m - t * W.segmentLength) < Math.abs(best - t * W.segmentLength)) best = m
      if (best !== null && !out.includes(best)) out.push(best)
    }
    return out
  })()
  {
    const half = W.cityWidth / 2
    const deckTop = W.wallHeight + 12
    for (const side of [-1, 1]) for (const gz of gatesZ) {
      curGrp++
      const fx = side * half
      // 门楼：两座门墩 + 过梁 + 深门洞（侧壁 + 顶 + 深色后壁）+ 门前台阶广场
      for (const k of [-1, 1]) {
        push(accent, fx - side * 4.5, SURFACE + 21, gz + k * 22, 9, 42, 8)
        addSolid(fx - side * 4.5, gz + k * 22, 9, 8, SURFACE + 42)
        push(accent, fx - side * 4.0, SURFACE + 15, gz + k * 17.4, 8, 30, 1.2)
      }
      push(accent, fx - side * 4.5, SURFACE + 46, gz, 9, 8, 52)
      push(crownGlow, fx - side * 9.1, SURFACE + 44, gz, 0.3, 1.2, 40)
      push(darkP, fx - side * 0.9, SURFACE + 15, gz, 1.0, 30, 34)
      push(accent, fx - side * 4.0, SURFACE + 30.5, gz, 8, 1.2, 36)
      for (let i = 0; i < 4; i++) push(stoneStep, fx - side * (10 + i * 1.4), SURFACE + 0.15 + (3 - i) * 0.12, gz, 1.4, 0.3 + (3 - i) * 0.24, 30 - i * 0.5)
      push(stoneStep, fx - side * 26, SURFACE + 0.14, gz, 22, 0.28, 64)
      // 观光电梯：玻璃井道 + 四角钢柱，直通墙顶平台
      for (const k of [-1, 1]) {
        const ez = gz + k * 34
        const ex = fx - side * 7
        push(glassPortal, ex, SURFACE + deckTop / 2, ez, 6, deckTop, 6)
        for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) push(accent, ex + a * 3.1, SURFACE + deckTop / 2, ez + c * 3.1, 0.5, deckTop, 0.5)
        addSolid(ex, ez, 6.4, 6.4, SURFACE + deckTop + 4)
        push(accent, ex, SURFACE + deckTop + 2, ez, 7, 4, 7)
      }
      // 墙顶：城门广场（铺装 + 树阵）+ 一对角楼 + 临水门坊
      const xIn = side * (half + 76)
      const zone = 150
      const pxc = xIn + side * zone / 2
      push(stoneStep, pxc, deckTop + 0.15, gz, zone, 0.3, 84)
      for (let i = 0; i < 4; i++) for (const k of [-1, 1]) {
        const tx = xIn + side * (18 + i * 32)
        const tz = gz + k * 26
        push(soilP, tx, deckTop + 0.55, tz, 3, 0.5, 3)
        push(woodP, tx, deckTop + 2.6, tz, 0.4, 4, 0.4)
        push(hedge, tx, deckTop + 5.8, tz, 5.4, 3.8, 5.4)
      }
      for (const k of [-1, 1]) pushCylBuilding(pick(rng, PODIUM), pxc + side * 30, deckTop + 26, gz + k * 34, 7.5, 52)
      for (const k of [-1, 1]) push(accent, side * (half + 74), deckTop + 14, gz + k * 14, 5, 28, 5)
      push(accent, side * (half + 74), deckTop + 29, gz, 6, 4, 34)
      push(crownGlow, side * (half + 74) - side * 3.1, deckTop + 29, gz, 0.3, 1.2, 26)
    }
  }
  {
    const half = W.cityWidth / 2
    const holes = plan.streets.map((sz) => [sz - W.streetW / 2 - 7, sz + W.streetW / 2 + 7])
    for (const gz of gatesZ) holes.push([gz - 48, gz + 48])
    for (const side of [-1, 1]) {
      let z = -W.segmentLength / 2 + 60
      while (z < W.segmentLength / 2 - 60) {
        const len = range(rng, 22, 46)
        const hit = holes.filter(([a, b2]) => b2 > z && a < z + len)
        if (hit.length) { z = Math.max(...hit.map((hh) => hh[1])) + 1; continue }
        const dep = range(rng, 14, 22)
        const h = range(rng, 36, 180)
        const r = rng()
        const style = r < 0.5 ? 'punch' : r < 0.78 ? 'ribbon' : 'hotel'
        const cx = side * (half - dep / 2 - 1.4) // 屋檐外挑不再顶进城墙
        const cz = z + len / 2
        curGrp++
        pushBuilding(pickColor(style), style, cx, SURFACE + h / 2, cz, dep, h, len * 0.96)
        const open = side < 0 ? { xn: false, xp: true, zn: false, zp: false } : { xn: true, xp: false, zn: false, zp: false }
        dressNear(cx, SURFACE, cz, dep, h, len * 0.96, style, { shop: true, row: true, open })
        z += len + range(rng, 2, 12)
        // 口袋广场：隔几栋留一块 30~50m 的小广场（铺装 + 树池），贴墙楼不再一栋挨一栋
        if (rng() < 0.22) {
          const pl = range(rng, 30, 50)
          if (!holes.some(([a, b2]) => b2 > z && a < z + pl)) {
            const px = side * (half - 12)
            push(stoneStep, px, SURFACE + 0.14, z + pl / 2, 22, 0.28, pl - 2)
            for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) {
              const tx = px + (i - 0.5) * 10
              const tz = z + pl * (0.28 + k * 0.44)
              push(soilP, tx, SURFACE + 0.45, tz, 2.6, 0.3, 2.6)
              push(woodP, tx, SURFACE + 2.4, tz, 0.35, 4, 0.35)
              push(hedge, tx, SURFACE + 5.6, tz, 5.2, 3.6, 5.2)
            }
            z += pl
          }
        }
      }
      const deckTop = W.wallHeight + 12
      const wcx = side * (half + W.wallThick / 2)
      // 墙顶一排建筑带：外侧（临海）是车道，内侧（临城）是水渠，楼排在两者之间
      // x 范围：水渠外沿 (xInner - side*76) → 车道内侧人行道 (xOuter + side*... 留 74m)
      const xIn = side * (half + 76)
      const xOut = side * (half + W.wallThick - 74)
      const zoneC = (xIn + xOut) / 2
      const zoneW = Math.abs(xOut - xIn)
      let z2 = -W.segmentLength / 2 + 80
      while (z2 < W.segmentLength / 2 - 80) {
        const gHit = gatesZ.find((gz) => gz + 46 > z2 && gz - 46 < z2 + 60)
        if (gHit !== undefined) { z2 = gHit + 46; continue }
        const len = range(rng, 24, 58)
        const dep = Math.min(zoneW - 4, range(rng, 28, 70))
        const r = rng()
        const h = r < 0.12 ? range(rng, 90, 150) : range(rng, 16, 70)
        const st = r < 0.3 ? 'curtain' : r < 0.6 ? 'ribbon' : r < 0.8 ? 'punch' : 'hotel'
        // 靠水渠一侧对齐（沿河立面成一条街墙），偶尔退后
        const cx = xIn + side * (dep / 2 + (rng() < 0.75 ? 2 : range(rng, 6, 16)))
        const cz = z2 + len / 2
        curGrp++
        if (len > 40 && dep > 44 && rng() < 0.3) {
          // 合院：后排一条 + 两翼，中间院子种树
          const bd = dep * 0.32
          const wl = len * 0.26
          const hh = Math.min(h, 46)
          pushBuilding(pickColor(st), st, cx + side * (dep / 2 - bd / 2), deckTop + hh / 2, cz, bd, hh, len)
          for (const k of [-1, 1]) pushBuilding(pickColor(st), st, cx - side * (bd / 2), deckTop + hh * 0.4, cz + k * (len / 2 - wl / 2), dep - bd, hh * 0.8, wl)
          const yx = cx - side * (bd / 2)
          push(lawn, yx, deckTop + 0.2, cz, dep - bd - 2, 0.4, len - wl * 2 - 2)
          for (const k of [-1, 1]) {
            push(woodP, yx + k * 4, deckTop + 2.4, cz, 0.4, 4, 0.4)
            push(hedge, yx + k * 4, deckTop + 5.6, cz, 5, 3.6, 5)
          }
        } else if (len > 30 && dep > 34 && rng() < 0.45) {
          placeTower(h > 60 ? 'high' : 'mid', cx, cz, dep, len, null, { baseY: deckTop, height: h, skipPodium: true })
        } else {
          pushBuilding(pickColor(st), st, cx, deckTop + h / 2, cz, dep, h, len)
        }
        // 面向水渠的一层店面
        const open = side > 0 ? { xn: true, xp: false, zn: false, zp: false } : { xn: false, xp: true, zn: false, zp: false }
        dressNear(cx, deckTop, cz, dep, h, len, st, { shop: true, row: true, open })
        z2 += len + (rng() < 0.3 ? range(rng, 24, 48) : range(rng, 10, 16))
      }
      void zoneC
    }
  }

  // ── 巨型广告牌：部分楼顶立大牌、部分侧山墙挂整面海报，夜里灯箱 + 射灯 ──
  {
    const hitOther = (x0, x1, z0, z1, y0, y1, host) => {
      for (const sx of [x0, x1, (x0 + x1) / 2]) for (const sz of [z0, z1, (z0 + z1) / 2]) {
        const list = querySolids(sx, sz)
        for (let k = 0; k < list.length; k++) {
          const c = list[k]
          if (c === host) continue
          if (c.base >= y1 || c.y <= y0) continue
          if (c.x + c.w / 2 > x0 && c.x - c.w / 2 < x1 && c.z + c.d / 2 > z0 && c.z - c.d / 2 < z1) return true
        }
      }
      return false
    }
    const hostOf = (W0) => {
      const list = querySolids(W0.x, W0.z)
      for (const c of list) if (Math.abs(c.x - W0.x) < 0.05 && Math.abs(c.z - W0.z) < 0.05 && Math.abs(c.base - W0.base) < 0.05) return c
      return null
    }
    let nRoof = 0
    let nWall = 0
    const AZ = (plan.districts || []).find((d) => d.id === 'anime')
    const inAnime = (x, z) => !!AZ && x > AZ.x0 && x < AZ.x1 && z > AZ.z0 && z < AZ.z1
    for (const W0 of wallAt.values()) {
      if (!(W0.w > 0 && W0.d > 0)) continue
      const hz = Math.abs(Math.sin(W0.x * 3.17 + W0.z * 7.31) * 4375.85) % 1
      const host = hostOf(W0)
      if (!host) continue
      const top = host.y
      const ad = adPools[Math.floor(hz * 997) % adPools.length]
      if (hz < 0.07 && W0.h > 18 && W0.h < 160 && Math.max(W0.w, W0.d) > 14) {
        // 楼顶大牌：沿长边，面朝外（随机正反），立在钢架上
        const alongX = W0.w >= W0.d
        const bw = Math.min((alongX ? W0.w : W0.d) * 0.82, 26)
        const bh = bw / 2
        const y0 = top + 4.6
        const s = hz < 0.035 ? 1 : -1
        const fx = alongX ? W0.x : W0.x + s * (W0.w * 0.3)
        const fz = alongX ? W0.z + s * (W0.d * 0.3) : W0.z
        const bx0 = fx - (alongX ? bw / 2 : 1), bx1 = fx + (alongX ? bw / 2 : 1)
        const bz0 = fz - (alongX ? 1 : bw / 2), bz1 = fz + (alongX ? 1 : bw / 2)
        if (!hitOther(bx0, bx1, bz0, bz1, top, y0 + bh + 2, host) && signFree(fx, y0 + bh / 2, fz, bw + 0.4, bh + 0.4, alongX ? 0 : s, alongX ? s : 0)) {
          const yaw = alongX ? (s > 0 ? 0 : Math.PI) : (s > 0 ? Math.PI / 2 : -Math.PI / 2)
          const nx = alongX ? 0 : s
          const nz = alongX ? s : 0
          regSign(fx, y0 + bh / 2, fz, bw + 0.4, bh + 0.4, nx, nz)
          push(ad, fx, y0 + bh / 2, fz, bw, bh, 0.3, yaw)
          push(billFrame, fx - nx * 0.3, y0 + bh / 2, fz - nz * 0.3, alongX ? bw + 0.4 : 0.25, bh + 0.4, alongX ? 0.25 : bw + 0.4)
          // 立柱 + 斜撑 + 底部检修走道
          const nP = Math.max(2, Math.round(bw / 6))
          for (let i = 0; i <= nP; i++) {
            const t = -bw / 2 + (bw * i) / nP
            const px = alongX ? fx + t : fx - nx * 0.6
            const pz = alongX ? fz - nz * 0.6 : fz + t
            push(billFrame, px, top + 2.3 + (y0 - top - 2.3) / 2 + bh / 4, pz, 0.3, y0 - top - 2.3 + bh / 2, 0.3)
          }
          push(billFrame, fx + nx * 0.5, y0 - 0.15, fz + nz * 0.5, alongX ? bw : 1.2, 0.12, alongX ? 1.2 : bw)
          // 射灯：前沿顶上一排挑臂灯
          const nL = Math.max(3, Math.round(bw / 5))
          for (let i = 0; i < nL; i++) {
            const t = -bw / 2 + (bw * (i + 0.5)) / nL
            const lx = alongX ? fx + t : fx + nx * 1.1
            const lz = alongX ? fz + nz * 1.1 : fz + t
            push(billLamp, lx, y0 + bh + 0.35, lz, 0.5, 0.18, 0.5)
            push(billFrame, alongX ? lx : fx + nx * 0.55, y0 + bh + 0.3, alongX ? fz + nz * 0.55 : lz, alongX ? 0.06 : 1.1, 0.06, alongX ? 1.1 : 0.06)
          }
          nRoof++
        }
      } else if ((hz > 0.92 || inAnime(W0.x, W0.z) && hz > 0.55) && W0.h >= (inAnime(W0.x, W0.z) ? 12 : 30)) {
        // 侧山墙整面海报（选窄边），离墙 0.35m
        const onX = W0.w < W0.d
        const span = onX ? W0.d : W0.w
        const bw = Math.min(span * 0.72, 30)
        const bh = bw / 2
        const yc = Math.min(W0.base + W0.h - 3 - bh / 2, W0.base + Math.max(12 + bh / 2, W0.h * 0.55))
        if (yc - bh / 2 < W0.base + 8) continue
        const s = hz > 0.96 || (hz > 0.55 && hz < 0.74) ? 1 : -1
        const fx = onX ? W0.x + s * (W0.w / 2 + 0.35) : W0.x
        const fz = onX ? W0.z : W0.z + s * (W0.d / 2 + 0.35)
        const bx0 = onX ? Math.min(fx, fx + s * 14) : fx - bw / 2
        const bx1 = onX ? Math.max(fx, fx + s * 14) : fx + bw / 2
        const bz0 = onX ? fz - bw / 2 : Math.min(fz, fz + s * 14)
        const bz1 = onX ? fz + bw / 2 : Math.max(fz, fz + s * 14)
        if (hitOther(bx0, bx1, bz0, bz1, yc - bh / 2, yc + bh / 2, host)) continue
        if (!signFree(fx, yc, fz, bw + 0.5, bh + 0.5, onX ? s : 0, onX ? 0 : s)) continue
        regSign(fx, yc, fz, bw + 0.5, bh + 0.5, onX ? s : 0, onX ? 0 : s)
        const yaw = onX ? (s > 0 ? Math.PI / 2 : -Math.PI / 2) : (s > 0 ? 0 : Math.PI)
        push(inAnime(W0.x, W0.z) ? adPools[hz < 0.75 ? 5 : 4] : ad, fx, yc, fz, bw, bh, 0.2, yaw)
        push(billFrame, onX ? fx - s * 0.18 : fx, yc, onX ? fz : fz - s * 0.18, onX ? 0.12 : bw + 0.5, bh + 0.5, onX ? bw + 0.5 : 0.12)
        const nL = Math.max(3, Math.round(bw / 6))
        for (let i = 0; i < nL; i++) {
          const t = -bw / 2 + (bw * (i + 0.5)) / nL
          push(billLamp, onX ? fx + s * 1.0 : fx + t, yc + bh / 2 + 0.4, onX ? fz + t : fz + s * 1.0, 0.45, 0.16, 0.45)
        }
        nWall++
      }
    }
    g.userData.billboards = { roof: nRoof, wall: nWall }
  }

  // ── 外挑件 × 别家楼体：3D 相交就裁到对方墙面外（留 2cm），裁完剩不到一半的整件去掉 ──
  {
    const CELL = 25
    const wg = new Map()
    const walls = []
    for (const pool of [...wallPools.values(), ...cylPools.values()]) {
      if (pool.trackG !== 'wall') continue
      for (const r of pool.recs.values()) {
        const b = r.buf
        for (let k = 0; k < r.n; k++) {
          const o = k * 8
          if (!(b[o + 3] > 1e-3 && b[o + 4] > 1e-3 && b[o + 5] > 1e-3)) continue
          const w = { g: r.gs[k], x0: b[o] - b[o + 3] / 2, x1: b[o] + b[o + 3] / 2, z0: b[o + 2] - b[o + 5] / 2, z1: b[o + 2] + b[o + 5] / 2, y0: b[o + 1] - b[o + 4] / 2, y1: b[o + 1] + b[o + 4] / 2 }
          walls.push(w)
          for (let i = Math.floor(w.x0 / CELL); i <= Math.floor(w.x1 / CELL); i++) for (let j = Math.floor(w.z0 / CELL); j <= Math.floor(w.z1 / CELL); j++) {
            const kk = i * 100003 + j
            let a = wg.get(kk)
            if (!a) wg.set(kk, (a = []))
            a.push(w)
          }
        }
      }
    }
    const E = 0.03
    const ins = (w) => {
      for (let i = Math.floor(w.x0 / CELL); i <= Math.floor(w.x1 / CELL); i++) for (let j = Math.floor(w.z0 / CELL); j <= Math.floor(w.z1 / CELL); j++) {
        const kk = i * 100003 + j
        let a = wg.get(kk)
        if (!a) wg.set(kk, (a = []))
        a.push(w)
      }
    }
    const hitWall = (a, g) => {
      for (let i = Math.floor(a.x0 / CELL); i <= Math.floor(a.x1 / CELL); i++) for (let j = Math.floor(a.z0 / CELL); j <= Math.floor(a.z1 / CELL); j++) {
        const arr = wg.get(i * 100003 + j)
        if (!arr) continue
        for (const w of arr) {
          if (w.g === g) continue
          if (Math.min(a.x1, w.x1) - Math.max(a.x0, w.x0) > E && Math.min(a.z1, w.z1) - Math.max(a.z0, w.z0) > E && Math.min(a.y1, w.y1) - Math.max(a.y0, w.y0) > E) return w
        }
      }
      return null
    }
    let clipped = 0
    let removed = 0
    // 先屋面板/檐口/女儿墙/坡顶（大件），再阳台/雨棚/空调等；处理完的件也加入障碍网格，件与件之间同样不穿插
    const allDecor = [...new Set([...roofPools.values(), ...[...cylPools.values()].filter((p) => p.trackG === 'decor'), cornice, parapet, ...gablePools, ...DECOR_POOLS])]
    for (const pool of allDecor) {
      for (const r of pool.recs.values()) {
        const b = r.buf
        for (let k = 0; k < r.n; k++) {
          const o = k * 8
          if (!(b[o + 3] > 1e-3 && b[o + 4] > 1e-3 && b[o + 5] > 1e-3)) continue
          const yaw = b[o + 6]
          const rot = Math.abs(Math.sin(yaw)) > 0.7
          const off = Math.abs(Math.sin(yaw)) > 0.05 && Math.abs(Math.cos(yaw)) > 0.05
          const hx = (rot ? b[o + 5] : b[o + 3]) / 2
          const hz = (rot ? b[o + 3] : b[o + 5]) / 2
          const a = { x0: b[o] - hx, x1: b[o] + hx, z0: b[o + 2] - hz, z1: b[o + 2] + hz, y0: b[o + 1] - b[o + 4] / 2, y1: b[o + 1] + b[o + 4] / 2 }
          const vol0 = (a.x1 - a.x0) * (a.z1 - a.z0) * (a.y1 - a.y0)
          const g = r.gs[k]
          let ok = true
          let changed = false
          for (let it = 0; it < 6; it++) {
            const w = hitWall(a, g)
            if (!w) break
            if (off) { ok = false; break }
            const gp = 0.02
            const opts = [
              { ...a, x1: Math.min(a.x1, w.x0 - gp) }, { ...a, x0: Math.max(a.x0, w.x1 + gp) },
              { ...a, z1: Math.min(a.z1, w.z0 - gp) }, { ...a, z0: Math.max(a.z0, w.z1 + gp) },
              { ...a, y1: Math.min(a.y1, w.y0 - gp) },
            ]
            let best = null
            let bv = 0
            for (const c of opts) {
              const v = Math.max(0, c.x1 - c.x0) * Math.max(0, c.z1 - c.z0) * Math.max(0, c.y1 - c.y0)
              if (v > bv) { bv = v; best = c }
            }
            if (!best || bv < vol0 * 0.45) { ok = false; break }
            Object.assign(a, best)
            changed = true
          }
          if (ok && hitWall(a, g)) ok = false
          if (!ok) { b[o + 3] = b[o + 4] = b[o + 5] = 0; removed++; continue }
          a.g = g
          ins(a)
          if (changed) {
            b[o] = (a.x0 + a.x1) / 2
            b[o + 1] = (a.y0 + a.y1) / 2
            b[o + 2] = (a.z0 + a.z1) / 2
            b[o + 3] = rot ? a.z1 - a.z0 : a.x1 - a.x0
            b[o + 4] = a.y1 - a.y0
            b[o + 5] = rot ? a.x1 - a.x0 : a.z1 - a.z0
            clipped++
          }
        }
      }
    }
    g.userData.decorClip = { clipped, removed }
  }
  if (DBG_OVL) {
    g.userData.__dbg = {
      wall: [...wallPools.values()], cyl: [...cylPools.values()], roof: [...roofPools.values()], cornice: [cornice], parapet: [parapet],
      mech: [mech, tank], accent: [accent], gable: gablePools, balcony: [balcony, rail], canopy: [canopy, ...canopyPools, ...awningPools, ...shopTypes.map((s) => s.awn)],
      ac: [acUnit], pillar: [pillar],
    }
  }
  const allPools = [
    ...wallPools.values(), ...roofPools.values(), ...cylPools.values(),
    balcony, rail, canopy, mech, accent, band, sill, mull, pane, paneWarm, paneWarmDim, paneCool, jamb, beacon,
    cornice, pipe, acUnit, acGrill,
    door, doorGlass, pillar, stMull, stHandle,
    ...shopGlassPools, ...stFramePools, ...pilPools, ...kickPools, ...winFramePools, ...shopFramePools.flat(),
    roomFloor, roomWall, roomCeil, shelf, goods, counter, roomLight, displayGlow,
    ...goodsPools, ...awningPools, ...canopyPools, ...backPools, matPool, ...signPools,
    parapet, ...designPools, ...roofGreenPools, ...roofDeckPools, ...shopTypePools, ...extraPools, shelfP, woodP, darkP, ...goodsP, caseGlass, ...latePools,
  ]

  // ── 落地：结构池一整份（少 draw call），细节池逐块（好吃视距裁剪）──
  const mArr = dummy.matrix.elements
  const flagCol = new THREE.Color()
  const lodMeshes = []
  function emitPool(pool, recs, count, center, lod = pool.lod) {
    const inst = new THREE.InstancedMesh(pool.geo, pool.mat, count)
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    inst.matrixAutoUpdate = false
    const arr = inst.instanceMatrix.array
    let i = 0
    let hasCol = false
    for (const r of recs) {
      const b = r.buf
      for (let k = 0; k < r.n; k++) {
        const o = k * 8
        dummy.position.set(b[o], b[o + 1], b[o + 2])
        dummy.scale.set(b[o + 3] || 1e-3, b[o + 4] || 1e-3, b[o + 5] || 1e-3)
        dummy.rotation.set(0, b[o + 6], 0)
        dummy.updateMatrix()
        arr.set(mArr, i * 16)
        i++
      }
      if (r.col) {
        hasCol = true
        let base = i - r.n
        for (let k = 0; k < r.n; k++) {
          const ci = r.col[k]
          inst.setColorAt(base++, ci === 255 ? paneCols[4] : ci >= 100 ? flagCol.setRGB((ci - 100) / 15, 0, 0) : paneCols[ci])
        }
      }
    }
    if (hasCol && inst.instanceColor) inst.instanceColor.needsUpdate = true
    inst.computeBoundingSphere()
    if (center) {
      inst.userData.chunkX = center[0]
      inst.userData.chunkZ = center[1]
      inst.userData.lod = lod
      lodMeshes.push(inst)
    }
    g.add(inst)
    return inst
  }

  // 性能：以前所有 lod=0 的装饰池（檐口/女儿墙/设备/水箱/山墙/广告牌…）整城一个 InstancedMesh，
  // 包围球覆盖全城 → 永远不被视锥剔除，几十万实例每帧全量走顶点着色。
  // 现在：结构（墙体/屋顶）仍整城一份；装饰按实例大小拆开 —— 大件（看台、大牌、草坪等次长边 >4m）整城一份保证远看轮廓，
  // 小件按 1250m 粗分块 + 1100m 视距裁剪（俯瞰全景时全部隐藏，也消掉远处亚像素小件的闪烁）
  const MID_CHUNK = 1250
  const MID_DIST = 1100
  const GABLE_DIST = 1800
  const splitRec = () => ({ buf: new Float32Array(8 * 64), n: 0, col: null })
  const recPush = (r, src, k, ci) => {
    if ((r.n + 1) * 8 > r.buf.length) {
      const nb = new Float32Array(r.buf.length * 2)
      nb.set(r.buf)
      r.buf = nb
    }
    for (let q = 0; q < 8; q++) r.buf[r.n * 8 + q] = src[k * 8 + q]
    if (ci !== undefined) {
      if (!r.col) r.col = new Uint8Array(r.buf.length / 8).fill(255)
      if (r.col.length < r.buf.length / 8) { const nc = new Uint8Array(r.buf.length / 8).fill(255); nc.set(r.col); r.col = nc }
      r.col[r.n] = ci
    }
    r.n++
  }
  // ── 楼间距：窗面正前方 12m 内有别的楼体挡着 → 该面做实墙（山墙，不开窗不亮灯）──
  {
    const L = []
    const GC = 40
    const grid = new Map()
    for (const pool of wallPools.values()) for (const r of pool.recs.values()) {
      const b = r.buf
      for (let k = 0; k < r.n; k++) {
        const o = k * 8
        const e = { r, k, x: b[o], y: b[o + 1], z: b[o + 2], sx: b[o + 3], sy: b[o + 4], sz: b[o + 5], yaw: b[o + 6] }
        if (!(e.sx > 0.5 && e.sy > 2 && e.sz > 0.5)) continue
        const c = Math.abs(Math.cos(e.yaw)), s = Math.abs(Math.sin(e.yaw))
        e.hx = (e.sx * c + e.sz * s) / 2
        e.hz = (e.sx * s + e.sz * c) / 2
        e.y0 = e.y - e.sy / 2
        e.y1 = e.y + e.sy / 2
        const id = L.length
        L.push(e)
        for (let i = Math.floor((e.x - e.hx) / GC); i <= Math.floor((e.x + e.hx) / GC); i++) for (let j = Math.floor((e.z - e.hz) / GC); j <= Math.floor((e.z + e.hz) / GC); j++) {
          const kk = i * 65536 + j
          let a = grid.get(kk)
          if (!a) grid.set(kk, (a = []))
          a.push(id)
        }
      }
    }
    const GAP = 12
    const seen = new Set()
    let nBlank = 0
    for (let id = 0; id < L.length; id++) {
      const e = L[id]
      if (e.sy < 6) continue
      let bits = 0
      const cy = Math.cos(e.yaw), sy = Math.sin(e.yaw)
      for (let f = 0; f < 4; f++) {
        const lx = f === 0 ? 1 : f === 1 ? -1 : 0
        const lz = f === 2 ? 1 : f === 3 ? -1 : 0
        const nx = lx * cy + lz * sy
        const nz = -lx * sy + lz * cy
        const hn = lx ? e.sx / 2 : e.sz / 2
        const hl = lx ? e.sz / 2 : e.sx / 2
        if (hl < 2) continue
        const fx = e.x + nx * hn, fz = e.z + nz * hn
        const tx = -nz, tz = nx
        // 探测框（世界 AABB）
        const px0 = Math.min(fx - tx * hl, fx + tx * hl, fx - tx * hl + nx * GAP, fx + tx * hl + nx * GAP)
        const px1 = Math.max(fx - tx * hl, fx + tx * hl, fx - tx * hl + nx * GAP, fx + tx * hl + nx * GAP)
        const pz0 = Math.min(fz - tz * hl, fz + tz * hl, fz - tz * hl + nz * GAP, fz + tz * hl + nz * GAP)
        const pz1 = Math.max(fz - tz * hl, fz + tz * hl, fz - tz * hl + nz * GAP, fz + tz * hl + nz * GAP)
        seen.clear()
        let hit = false
        for (let i = Math.floor(px0 / GC); i <= Math.floor(px1 / GC) && !hit; i++) for (let j = Math.floor(pz0 / GC); j <= Math.floor(pz1 / GC) && !hit; j++) {
          const a = grid.get(i * 65536 + j)
          if (!a) continue
          for (const q of a) {
            if (q === id || seen.has(q)) continue
            seen.add(q)
            const o = L[q]
            const vo = Math.min(o.y1, e.y1) - Math.max(o.y0, e.y0)
            if (vo < Math.min(6, e.sy * 0.5)) continue
            if (o.x + o.hx < px0 || o.x - o.hx > px1 || o.z + o.hz < pz0 || o.z - o.hz > pz1) continue
            const ext = o.hx * Math.abs(nx) + o.hz * Math.abs(nz)
            const near = (o.x - fx) * nx + (o.z - fz) * nz - ext
            if (near < -0.8 || near > GAP) continue
            const oc = (o.x - fx) * tx + (o.z - fz) * tz
            const ow = o.hx * Math.abs(tx) + o.hz * Math.abs(tz)
            const lo = Math.min(hl, oc + ow) - Math.max(-hl, oc - ow)
            if (lo < Math.min(hl * 2 * 0.35, 8)) continue
            hit = true
            break
          }
        }
        if (hit) bits |= 1 << f
      }
      if (bits) {
        const r = e.r
        if (!r.col) r.col = new Uint8Array(r.buf.length / 8).fill(255)
        r.col[e.k] = 100 + bits
        nBlank++
      }
    }
    g.userData.partyWalls = nBlank
  }
  for (const pool of allPools) {
    if (!pool || !pool.recs) continue
    const recs = []
    let total = 0
    for (const r of pool.recs.values()) if (r.n) { recs.push(r); total += r.n }
    if (!total) continue
    if (!pool.lod && pool.struct) {
      emitPool(pool, recs, total, null)
      continue
    }
    if (!pool.lod) {
      const isGable = gablePools.includes(pool)
      const big = splitRec()
      const small = new Map()
      for (const r of recs) {
        for (let k = 0; k < r.n; k++) {
          const o = k * 8
          const d = [Math.abs(r.buf[o + 3]), Math.abs(r.buf[o + 4]), Math.abs(r.buf[o + 5])].sort((p, q) => q - p)
          const ci = r.col ? r.col[k] : undefined
          if (!isGable && d[1] > 4) { recPush(big, r.buf, k, ci); continue }
          const key = Math.floor(r.buf[o] / MID_CHUNK) * 4096 + Math.floor(r.buf[o + 2] / MID_CHUNK)
          let sr = small.get(key)
          if (!sr) small.set(key, (sr = splitRec()))
          recPush(sr, r.buf, k, ci)
        }
      }
      if (big.n) emitPool(pool, [big], big.n, null)
      for (const sr of small.values()) {
        // 分块中心取实例均值（实际裁剪用包围球）
        let sx = 0
        let sz = 0
        for (let k = 0; k < sr.n; k++) { sx += sr.buf[k * 8]; sz += sr.buf[k * 8 + 2] }
        emitPool(pool, [sr], sr.n, [sx / sr.n, sz / sr.n], isGable ? GABLE_DIST : MID_DIST)
      }
      continue
    }
    for (const [key, r] of pool.recs) {
      if (!r.n) continue
      emitPool(pool, [r], r.n, chunkCenter(key))
    }
  }

  /** 按镜头位置（含高度）裁细节：每个分块网格按自己的包围球 + 自己的视距判断 */
  g.userData.updateLOD = (px, pz, py = 0) => {
    for (const mesh of lodMeshes) {
      const bs = mesh.boundingSphere
      const dx = bs.center.x - px
      const dz = bs.center.z - pz
      const dy = Math.max(0, py - 60)
      const r = mesh.userData.lod + bs.radius
      mesh.visible = dx * dx + dz * dz + dy * dy < r * r
    }
  }
  g.userData.querySolids = querySolids
  g.userData.tick = (dt) => {
    for (let i = 0; i < ledMats.length; i++) {
      const t = ledMats[i].tex
      t.offset.x = (t.offset.x + dt * (0.05 + i * 0.012)) % 1
    }
  }
  g.userData.addSolid = addSolid
  g.userData.shops = shopSpots
  g.userData.walks = walks
  g.userData.cylinders = cylList
  return g
}
