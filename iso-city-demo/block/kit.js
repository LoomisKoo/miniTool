import * as THREE from 'three'

export const GROUND = 0.16
export const CN = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif'

const geos = new Map()
const glows = []
const lights = []

function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`
  let g = geos.get(k)
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d)
    geos.set(k, g)
  }
  return g
}

/**
 * 真实材料的反照率没有纯白：清水混凝土 sRGB 反照率约 0.45~0.62，浅色石材
 * 0.62~0.78，最白的外墙涂料在正午直射下也就 0.8 出头。原来的调色板里一半
 * 立面颜色落在 0.85~0.95，一起推到太阳底下就被 ACES 压成一整片白纸，城市
 * 也就没了材质差异。这里对每个无贴图的不透明材质做一次软拐点压缩：只砍高光
 * 段，色相和中低调整体不动，暖石/冷石/砖红的层次都还在。
 */
const KNEE = 0.58
const SLOPE = 0.58
const albedoCh = (c) => (c <= KNEE ? c : KNEE + (c - KNEE) * SLOPE)

function albedoOf(color) {
  const c = new THREE.Color(color)
  c.convertLinearToSRGB()
  c.setRGB(albedoCh(c.r), albedoCh(c.g), albedoCh(c.b))
  c.convertSRGBToLinear()
  return c
}

/** 传 map 时颜色只当乘数用（白 = 完全走贴图），不能再压，否则贴图整片变暗 */
export function std(color, opts = {}) {
  const c = opts.map || opts.raw ? color : albedoOf(color)
  return new THREE.MeshStandardMaterial({ color: c, roughness: 0.74, metalness: 0, ...opts })
}

/** 夜晚靠 emissiveIntensity 亮起来。day / night 是两端强度。 */
export function glowMat(color, day, night, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: opts.emissive ?? color,
    emissiveIntensity: day,
    roughness: 0.45,
    metalness: 0,
    ...opts,
  })
  glows.push({ mat, day, night })
  return mat
}

export function trackGlow(mat, day, night) {
  glows.push({ mat, day, night })
  return mat
}

export function trackLight(light, day, night) {
  light.intensity = day
  lights.push({ light, day, night })
}

const envs = []
/** 环境反射强度也随昼夜走：白天玻璃反光，入夜压下去，不然整面幕墙像镜子 */
export function trackEnv(mat, day, night) {
  mat.envMapIntensity = day
  envs.push({ mat, day, night })
  return mat
}

const fades = []
/**
 * 透明度也跟着昼夜走。贴地的光斑 / 光带是"纯黑底 + 自发光"的贴片，
 * 白天自发光为 0 就只剩下一块半透明黑斑糊在路面上，所以白天必须整片透明掉。
 */
export function trackFade(mat, day, night) {
  mat.transparent = true
  mat.opacity = day
  fades.push({ mat, day, night })
  return mat
}

/**
 * 消除共面闪烁：找出朝向相同、又几乎完全重合的两个面，把其中较小的一件
 * 沿面法线往外推开。建筑立面里有大量"贴面"构件（招牌、窗框、玻璃、腰线、
 * 灯池），手工逐个错开容易漏，这里统一扫一遍兜底。
 *
 * 两个曾经的漏网之鱼，正是"楼底部一直闪"的原因：
 *  1. 只比 max 面。整栋楼旋转 180° 之后，正面变成了 min 面，于是这类
 *     壁柱 / 腰线 / 裙楼贴面与主体齐平的情况永远检测不到。
 *  2. 厚度为 0 的平面被直接跳过（玻璃、招牌、地面光斑全是 PlaneGeometry），
 *     它们贴着别的面 1~5cm 悬着，恰恰是最容易打架的一批。
 */
export function fixZfight(root, passes = 4) {
  const AX = ['x', 'y', 'z']
  root.updateMatrixWorld(true)
  const items = []
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return
    const e = o.matrixWorld.elements
    const q = Math.atan2(e[2], e[0]) / (Math.PI / 2)
    // 只处理轴向对齐的盒体/平面，AABB 才和真实面重合
    if (Math.abs(q - Math.round(q)) > 0.02) return
    const bb = new THREE.Box3().setFromObject(o)
    const s = bb.getSize(new THREE.Vector3())
    const zeros = (s.x < 1e-3 ? 1 : 0) + (s.y < 1e-3 ? 1 : 0) + (s.z < 1e-3 ? 1 : 0)
    if (zeros >= 2) return
    items.push({ o, bb, s, flat: zeros === 1, vol: s.x * s.y * s.z, drift: 0 })
  })
  const q = new THREE.Quaternion()
  const dir = new THREE.Vector3()
  let total = 0
  for (let pass = 0; pass < passes; pass++) {
    let fixed = 0
    for (let i = 0; i < items.length; i++) {
      const A = items[i]
      for (let j = i + 1; j < items.length; j++) {
        const B = items[j]
        // 包围盒在任一轴完全分开就不可能有共面（留 6mm 容差）
        if (
          A.bb.min.x > B.bb.max.x + 0.006 || B.bb.min.x > A.bb.max.x + 0.006 ||
          A.bb.min.y > B.bb.max.y + 0.006 || B.bb.min.y > A.bb.max.y + 0.006 ||
          A.bb.min.z > B.bb.max.z + 0.006 || B.bb.min.z > A.bb.max.z + 0.006
        ) continue
        let done = false
        for (let a = 0; a < 3 && !done; a++) {
          const ax = AX[a]
          const o1 = AX[(a + 1) % 3]
          const o2 = AX[(a + 2) % 3]
          // max 面对 max 面（+1）、min 面对 min 面（-1）都算共面
          for (const side of [1, -1]) {
            const key = side > 0 ? 'max' : 'min'
            if (Math.abs(A.bb[key][ax] - B.bb[key][ax]) > 0.006) continue
            const ov1 = Math.min(A.bb.max[o1], B.bb.max[o1]) - Math.max(A.bb.min[o1], B.bb.min[o1])
            const ov2 = Math.min(A.bb.max[o2], B.bb.max[o2]) - Math.max(A.bb.min[o2], B.bb.min[o2])
            if (ov1 < 0.06 || ov2 < 0.06) continue
            const M = A.vol <= B.vol ? A : B
            const p = M.o.parent
            if (!p) continue
            const step = M.flat ? 0.0092 : 0.0137
            // 累计挪动封顶，免得把细构件推歪（平面只许挪 1.3cm，实体 3.2cm）
            if (M.drift + step > (M.flat ? 0.013 : 0.032)) continue
            M.drift += step
            p.getWorldQuaternion(q).invert()
            dir.set(0, 0, 0)
            dir[ax] = step * side
            dir.applyQuaternion(q)
            M.o.position.add(dir)
            M.o.updateWorldMatrix(true, false)
            M.bb.setFromObject(M.o)
            fixed++
            done = true
            break
          }
        }
      }
    }
    total += fixed
    if (!fixed) break
  }
  return total
}

export function applyNight(t) {
  for (const g of glows) g.mat.emissiveIntensity = g.day + (g.night - g.day) * t
  for (const L of lights) L.light.intensity = L.day + (L.night - L.day) * t
  for (const e of envs) e.mat.envMapIntensity = e.day + (e.night - e.day) * t
  for (const f of fades) {
    f.mat.opacity = f.day + (f.night - f.day) * t
    f.mat.visible = f.mat.opacity > 0.004
  }
}

/**
 * 单栋楼的色板归纳。
 *
 * 立面上每块墙、腰线、柱、窗台、压顶、栏杆当初都是各自 std() 一个颜色，一栋
 * 楼能攒出四五十个"差不多的灰"：有的是冷灰、有的是暖白、有的偏绿，单独看都
 * 还行，放在一起就是一栋楼自己花掉。真实建筑不会这样 —— 一栋楼通常只有一种
 * 主材色，靠同色系的明度分级（墙面 / 线脚 / 勒脚 / 深色金属）拉开层次。
 *
 * 这里按楼分组：取面积最大的中性材质当主色，把该楼其余中性材质统一到它的色
 * 相与饱和度上，明度吸附到五级阶梯。彩色构件（招牌、砖红、绿植）和带贴图的
 * 材质不动；多栋楼共用的材质也不动（否则会互相串色）。
 */
export function harmonizePalette(root) {
  const SRGB = THREE.SRGBColorSpace
  const hs = { h: 0, s: 0, l: 0 }
  const groups = root.children.filter((c) => c.isGroup)

  // 玻璃、招牌、贴图材质不参与；金属面板要参与 —— 幕墙塔一大半面积是铝板，
  // 之前把它们排除在外，怎么调墙面都还是冷灰。
  const isCand = (m) =>
    m && m.isMeshStandardMaterial && !m.transparent && !m.map && !m.userData.glass &&
    m.opacity >= 0.99 && m.emissive.r + m.emissive.g + m.emissive.b < 0.01

  /** 金属度太高时颜色根本不起作用，全靠环境反射，必然发灰 */
  const tameMetal = (m) => {
    if (m.metalness > 0.45) m.metalness = 0.45
    if (m.roughness < 0.34) m.roughness = 0.34
  }

  // InstancedMesh 不乘实例数：栏杆/空调/窗棂成百上千个实例，一乘就会把主色
  // 从墙面抢到一根栏杆上，整栋楼跟着它变深
  const faceArea = (o) => {
    if (o.isInstancedMesh) {
      const bb = o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox)
      const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z
      return 2 * (sx * sy + sy * sz + sx * sz)
    }
    const pa = o.geometry.parameters
    if (!pa) return 1
    const w = pa.width || 1, h = pa.height || 1, d = pa.depth || 1
    return 2 * (w * h + h * d + w * d)
  }

  // ── 1. 收集每栋楼的中性材质与该材质在这栋楼里的面积 ──
  const info = groups.map((g) => {
    const area = new Map()
    const meshes = new Map()
    g.traverse((o) => {
      if (!o.isMesh) return
      const m = o.material
      if (!isCand(m)) return
      m.color.getHSL(hs, SRGB)
      if (hs.s > 0.2) return
      const a = faceArea(o)
      area.set(m, (area.get(m) || 0) + a)
      let list = meshes.get(m)
      if (!list) meshes.set(m, (list = []))
      list.push(o)
    })
    let total = 0
    for (const a of area.values()) total += a
    return { g, area, meshes, total }
  })

  const owners = new Map()
  for (const it of info) {
    for (const m of it.area.keys()) {
      let set = owners.get(m)
      if (!set) owners.set(m, (set = new Set()))
      set.add(it.g)
    }
  }

  // ── 2. 大面积的共用材质按楼克隆 ──
  // 铝板、石材这类被多栋塔共用，共用一个颜色就必然"满城一片灰"。占该楼立面
  // 8% 以上的才克隆，分缝、窗棂这类小件继续共用，不会炸材质数量。
  for (const it of info) {
    for (const [m, a] of [...it.area]) {
      if (owners.get(m).size < 2) continue
      if (a < it.total * 0.08) continue
      const clone = m.clone()
      clone.userData = { ...m.userData }
      for (const o of it.meshes.get(m)) o.material = clone
      it.area.delete(m)
      it.area.set(clone, a)
      it.meshes.set(clone, it.meshes.get(m))
      it.meshes.delete(m)
    }
  }

  // 剩下的共用件（分缝、配件）没法按楼调色，统一成暖浅灰：
  // 冷一把暖一把挂在楼面上，正是"一栋楼花掉"的主要来源
  const still = new Map()
  for (const it of info) for (const m of it.area.keys()) still.set(m, (still.get(m) || 0) + 1)
  for (const [m, n] of still) {
    if (n < 2) continue
    m.color.getHSL(hs, SRGB)
    if (hs.s > 0.2) continue
    m.color.setHSL(0.105, 0.07, Math.min(0.82, Math.max(0.3, hs.l)), SRGB)
    tameMetal(m)
  }

  // ── 3. 真实城市立面的材料色：暖石材 / 涂料 / 面砖为主，冷色只给玻璃幕墙 ──
  const WARM_SKIN = [
    [0.101, 0.2], // 米黄石材
    [0.082, 0.17], // 浅砂
    [0.123, 0.19], // 奶油
    [0.062, 0.22], // 赭石面砖
    [0.138, 0.15], // 灰米
    [0.046, 0.2], // 陶土
    [0.115, 0.16], // 暖白
    [0.093, 0.18], // 沙岩
  ]
  const ladder = [-0.4, -0.28, -0.17, -0.085, 0, 0.06]

  for (let gi = 0; gi < info.length; gi++) {
    const { g, area } = info[gi]
    if (area.size < 1) continue

    // 主色 = 面积最大的一簇，但排除过暗的（核心筒、窗套）和过亮的（反光金属）
    const buckets = new Map()
    let usable = 0
    for (const [m, a] of area) {
      m.color.getHSL(hs, SRGB)
      if (hs.l < 0.5 || hs.l > 0.9) continue
      usable += a
      const k = Math.round(hs.h * 24) % 24
      let b = buckets.get(k)
      if (!b) buckets.set(k, (b = { w: 0, s: 0, l: 0, hx: 0, hy: 0 }))
      b.w += a
      b.s += hs.s * a
      b.l += hs.l * a
      const ang = hs.h * Math.PI * 2
      b.hx += Math.cos(ang) * a
      b.hy += Math.sin(ang) * a
    }
    if (!usable) continue
    let main = null
    for (const b of buckets.values()) if (!main || b.w > main.w) main = b
    if (!main || main.w <= 0) continue

    const H0 = ((Math.atan2(main.hy, main.hx) / (Math.PI * 2)) + 1) % 1
    const mainSat = main.s / main.w
    // 立面主色的明度落在 0.62~0.85 之间：再暗就像一整栋深色石材，再亮就过曝
    const A = Math.min(0.85, Math.max(0.62, main.l / main.w))
    // 主色本身明确偏蓝（玻璃幕墙）就保留冷色，只把色度提到能看出玻璃
    let H, S
    if (mainSat > 0.06 && H0 > 0.48 && H0 < 0.7) {
      H = H0
      S = Math.min(0.17, Math.max(0.12, mainSat * 1.6))
    } else {
      const key = Math.abs(Math.round(g.position.x * 2) * 37 + Math.round(g.position.z * 2) * 91 + gi * 13)
      const skin = WARM_SKIN[key % WARM_SKIN.length]
      H = skin[0]
      S = skin[1]
    }

    for (const m of area.keys()) {
      m.color.getHSL(hs, SRGB)
      // 明显是别家的彩色构件（绿植、砖红、木作）留着；中性灰白一律归主色
      let dh = Math.abs(hs.h - H)
      if (dh > 0.5) dh = 1 - dh
      if (dh > 0.166 && hs.s > 0.17) continue
      // 深色件（核心筒、窗套）只改色相不动明度，免得整栋被压成一块深色板
      let nl = hs.l
      if (hs.l >= 0.45) {
        let gap = 9
        for (const d of ladder) {
          const v = Math.min(0.9, Math.max(0.5, A + d))
          const g2 = Math.abs(v - hs.l)
          if (g2 < gap) { gap = g2; nl = v }
        }
      }
      m.color.setHSL(H, S, nl, SRGB)
      tameMetal(m)
    }
  }
}

/**
 * 把一个水平矩形裁到建筑轮廓之外，返回裁后的矩形；完全没被裁到返回 null。
 * 只跟"楼"做裁切：轿车、灯杆、花池这些矮件挡不住地面光斑。
 */
export function clipRect(cx, cz, hx, hz) {
  let x0 = cx - hx
  let x1 = cx + hx
  let z0 = cz - hz
  let z1 = cz + hz
  let cut = false
  for (const s of solids) {
    if (s.base > 1.4 || s.y - s.base < 4) continue
    const sx0 = s.x - s.w / 2
    const sx1 = s.x + s.w / 2
    const sz0 = s.z - s.d / 2
    const sz1 = s.z + s.d / 2
    if (sx1 < x0 || sx0 > x1 || sz1 < z0 || sz0 > z1) continue
    const covX = (sx1 - sx0) / Math.max(0.001, x1 - x0)
    if (covX > 0.5) {
      if (sz0 > z0 + 0.2) { z1 = Math.min(z1, sz0 - 0.3); cut = true }
      else if (sz1 < z1 - 0.2) { z0 = Math.max(z0, sz1 + 0.3); cut = true }
    } else {
      if (sx0 > x0 + 0.2) { x1 = Math.min(x1, sx0 - 0.3); cut = true }
      else if (sx1 < x1 - 0.2) { x0 = Math.max(x0, sx1 + 0.3); cut = true }
    }
  }
  if (!cut) return null
  return { x0, x1, z0, z1, w: x1 - x0, h: z1 - z0 }
}

/**
 * 贴地贴片（光斑、光带）是平面，会横穿到楼体里。楼脚处平面和墙面几乎平行，
 * 深度值每像素都在翻转，于是出现"楼底部一条毛边在闪"。这里把贴片裁到
 * 建筑轮廓之外，裁完太小就整片丢掉。
 */
export function clipDecals(root) {
  const decals = []
  root.traverse((o) => {
    if (o.isMesh && o.userData.decal) decals.push(o)
  })
  let clipped = 0
  for (const m of decals) {
    const d = m.userData.decal
    let x0 = d.cx - d.hx
    let x1 = d.cx + d.hx
    let z0 = d.cz - d.hz
    let z1 = d.cz + d.hz
    let cut = false
    for (const s of solids) {
      // 只裁"楼"：轿车、灯杆、花池这些矮件挡不住地面光斑，裁了反而把光带切碎
      if (s.base > 1.4 || s.y - s.base < 4) continue
      const sx0 = s.x - s.w / 2
      const sx1 = s.x + s.w / 2
      const sz0 = s.z - s.d / 2
      const sz1 = s.z + s.d / 2
      if (sx1 < x0 || sx0 > x1 || sz1 < z0 || sz0 > z1) continue
      const covX = (sx1 - sx0) / Math.max(0.001, x1 - x0)
      if (covX > 0.5) {
        if (sz0 > z0 + 0.2) { z1 = Math.min(z1, sz0 - 0.3); cut = true }
        else if (sz1 < z1 - 0.2) { z0 = Math.max(z0, sz1 + 0.3); cut = true }
      } else {
        if (sx0 > x0 + 0.2) { x1 = Math.min(x1, sx0 - 0.3); cut = true }
        else if (sx1 < x1 - 0.2) { x0 = Math.max(x0, sx1 + 0.3); cut = true }
      }
    }
    if (!cut) continue
    const w = x1 - x0
    const h = z1 - z0
    if (w < 0.8 || h < 0.8) {
      m.visible = false
      clipped++
      continue
    }
    m.scale.set(w, h, 1)
    m.position.x = (x0 + x1) / 2
    m.position.z = (z0 + z1) / 2
    clipped++
  }
  return clipped
}

export function paint(w, h, draw, opts = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(opts.repeat[0], opts.repeat[1])
  }
  return t
}

export function add(parent, w, h, d, material, x, y, z, ry = 0, shadow = true) {
  const m = new THREE.Mesh(boxGeo(w, h, d), material)
  m.position.set(x, y, z)
  if (ry) m.rotation.y = ry
  m.castShadow = shadow
  m.receiveShadow = shadow
  parent.add(m)
  return m
}

export function plane(parent, w, h, material, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
  m.position.set(x, y, z)
  if (ry) m.rotation.y = ry
  m.castShadow = false
  m.receiveShadow = false
  parent.add(m)
  return m
}

export function cyl(parent, r, h, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18), material)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

export function scatter(parent, geo, material, items, shadow = false) {
  if (!items.length) return null
  const mesh = new THREE.InstancedMesh(geo, material, items.length)
  const d = new THREE.Object3D()
  const col = new THREE.Color()
  let tinted = false
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    d.position.set(it[0], it[1], it[2])
    d.rotation.set(0, it[3] || 0, 0)
    d.scale.set(it[4] ?? 1, it[5] ?? 1, it[6] ?? 1)
    d.updateMatrix()
    mesh.setMatrixAt(i, d.matrix)
    if (typeof it[7] === 'string') {
      tinted = true
      mesh.setColorAt(i, col.set(it[7]))
    }
  }
  if (tinted && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.castShadow = shadow
  mesh.receiveShadow = shadow
  mesh.computeBoundingSphere()
  parent.add(mesh)
  return mesh
}

/** 行走碰撞：x/z 为底面中心，y 为顶面高度，base 以下不挡人（骑楼挑空）。 */
export const solids = []
export function solid(x, z, w, d, y, base = 0) {
  solids.push({ x, z, w, d, y, base })
}

export function mulberry32(a) {
  return function rand() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function starPath(g, x, y, r) {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.4 : r
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
}

/**
 * 全场统一窗色。三种窗都是同一块浅蓝玻璃，只在反射与光泽上略有差别：
 * 白天的亮窗与普通玻璃是同一色，只有入夜才泛暖光。
 */
// 同一面幕墙上的窗，白天必须是同一种玻璃 —— 只有入夜才分出亮灯/没亮灯。
// 之前三套窗（普通 / 帘子 / 亮灯）各自写死了颜色、金属度和粗糙度，白天看过去
// 一栋楼里深浅蓝、哑光灰、反光白随机交错，像贴了一张杂色贴图。
// 玻璃的漫反射本体要比墙暗一大截，窗洞才立得起来。原来玻璃跟墙面一个亮度
// （0.69 vs 0.72），只剩一圈窗台线在区分墙和窗，整面幕墙就糊成一片浅灰。
const WIN_TINT = '#7d8f9c'
const WIN_SKIN = { metalness: 0.26, roughness: 0.22 }
// 三个窗材质必须拿到同一个"压缩后"的颜色值，否则亮灯窗会白出一档
const winTint = std(WIN_TINT, WIN_SKIN).color.clone()
export const winGlass = trackEnv(std(WIN_TINT, WIN_SKIN), 0.7, 0.24)
export const winShade = trackEnv(std(WIN_TINT, WIN_SKIN), 0.7, 0.24)
export const winWarm = glowMat(winTint, 0, 0.55, { emissive: '#ffd6a6', ...WIN_SKIN })
trackEnv(winWarm, 0.7, 0.24)
/** 底层店面 / 大堂玻璃，也统一到同一个色系 */
export const winStore = trackEnv(std('#6f8279', { metalness: 0.2, roughness: 0.26 }), 0.6, 0.22)
export const WIN = { glass: winGlass, warm: winWarm, shade: winShade }
// 全场窗色共用一套，不跟着单栋楼的色板走
for (const m of [winGlass, winShade, winWarm, winStore]) m.userData.glass = true

const shopCell = new THREE.BoxGeometry(1, 1, 1)
const shopLightMat = glowMat('#fff0d8', 0.16, 1.0, { emissive: '#ffe4bb', roughness: 0.4 })
const shopPanelMat = glowMat('#f4ead4', 0.05, 0.5, { emissive: '#fff2da', roughness: 0.7 })
/** 店内没有真实光源，靠自发光把货架和商品托出来，入夜店里才不会一片黑 */
const shopSurface = (color, day, night, opts = {}) =>
  glowMat(color, day, night, { emissive: opts.emissive ?? color, roughness: 0.68, ...opts })
const shopGoodsMat = glowMat('#ffffff', 0.03, 0.34, { emissive: '#ffe4c0', roughness: 0.55 })
const bookSpineMat = glowMat('#ffffff', 0.03, 0.36, { emissive: '#ffdcae', roughness: 0.7 })
const shopTagMat = glowMat('#ffffff', 0.04, 0.46, { emissive: '#ffffff', roughness: 0.6 })

/** 商品体型的几档，按层轮换，一排货架才会分出层次 */
const PACKS = [
  { w: 0.15, h: 0.27, d: 0.14 },
  { w: 0.11, h: 0.33, d: 0.11 },
  { w: 0.18, h: 0.17, d: 0.16 },
  { w: 0.1, h: 0.23, d: 0.1 },
  { w: 0.2, h: 0.13, d: 0.15 },
]

/**
 * 店内实景：地砖、墙面、吊顶灯带、满铺的货架、柜台、地堆、吊牌。
 * 局部坐标：玻璃面在 zFront，往里是 -z。
 * kind: 'shop' | 'books' | 'pharmacy'。所有小件都进 InstancedMesh。
 */
export function shopInterior(g, o) {
  const {
    w, zFront, depth = 3.8, h = 2.8,
    floor = '#cbc3b2', back = '#efe6d3', side = null,
    counter = false, island = 0, sides = true,
    goods = ['#e15a72', '#f2c14e', '#54b3a6', '#6aa6d8', '#f0f2f4', '#c9744a'],
    seed = 7, kind = 'shop', display = true,
  } = o
  const books = kind === 'books'
  const pharm = kind === 'pharmacy'
  const zc = zFront - depth / 2
  const zb = zFront - depth + 0.06
  const rnd = mulberry32(seed)

  // ── 地面、墙面、天花 ──
  const flTex = paint(128, 128, (c, w2, h2) => {
    c.fillStyle = floor
    c.fillRect(0, 0, w2, h2)
    c.strokeStyle = 'rgba(60,50,40,.16)'
    c.lineWidth = 3
    c.strokeRect(1.5, 1.5, w2 - 3, h2 - 3)
  }, { repeat: [Math.max(2, Math.round(w * 1.3)), Math.max(2, Math.round(depth * 1.3))] })
  add(g, w - 0.5, 0.06, depth - 0.12,
    shopSurface('#ffffff', 0.06, 0.5, { map: flTex, roughness: 0.6 }), 0, 0.2, zc, 0, false)
  add(g, w - 0.4, h, 0.08, shopSurface(back, 0.04, 0.4), 0, h / 2 + 0.02, zb, 0, false)
  add(g, w - 0.4, 0.1, depth - 0.1, shopSurface('#eae2d2', 0.05, 0.44), 0, h + 0.02, zc, 0, false)
  // 侧墙：挡住两侧看穿的缝，顺便把光兜住
  if (side) {
    for (const s of [-1, 1]) {
      add(g, 0.1, h, depth - 0.1, shopSurface(side, 0.04, 0.36), s * (w / 2 - 0.28), h / 2 + 0.02, zc, 0, false)
    }
  }
  add(g, w - 1.1, 0.04, depth - 1.1, shopPanelMat, 0, h - 0.03, zc, 0, false)
  for (const t of [0.32, 0.64]) {
    add(g, w - 1.6, 0.05, 0.16, shopLightMat, 0, h - 0.09, zFront - depth * t, 0, false)
  }

  // ── 货架 ──
  const rackMat = shopSurface('#efe9dc', 0.05, 0.42)
  const boards = []
  const posts = []
  const packs = []
  const tags = []
  // 书架从地面码到吊顶，书店才显得大
  const levelH = books ? (h - 0.42) / 6 : (h - 0.5) / 5
  const levels = books ? 6 : 5
  const rackDepth = books ? 0.56 : 0.5

  // 所有货架共用一套格点，同一列的货从下到上对齐，行与行才不会错成斜线
  const ROW = books ? 0.078 : 0.21
  const rack = (cx, cz, len, alongZ, lv = levels, face = 1) => {
    const n = Math.max(2, Math.floor((len - 0.16) / ROW))
    const span = n * ROW
    for (let l = 0; l <= lv; l++) {
      const y = 0.24 + l * levelH
      if (alongZ) boards.push([cx, y, cz, 0, rackDepth, 0.05, len])
      else boards.push([cx, y, cz, 0, len, 0.05, rackDepth])
      // 价签条：贴在朝向通道那一侧的外沿，正好压在货板边上
      if (l < lv) {
        const edge = rackDepth / 2 - 0.012
        if (alongZ) tags.push([cx + face * edge, y + 0.055, cz, 0, 0.018, 0.07, span])
        else tags.push([cx, y + 0.055, cz + face * edge, 0, span, 0.07, 0.018])
      }
    }
    for (let l = 0; l < lv; l++) {
      const y = 0.24 + l * levelH + 0.03
      const p = books ? null : PACKS[(l * 2 + (pharm ? 1 : 0)) % PACKS.length]
      for (let i = 0; i < n; i++) {
        const t = -span / 2 + (i + 0.5) * ROW
        const px = alongZ ? cx + face * 0.06 : cx + t
        const pz = alongZ ? cz + t : cz + face * 0.06
        const col = goods[(i * 3 + l * 2 + (alongZ ? 1 : 0)) % goods.length]
        if (books) {
          // 书脊同一层等高，只偶尔一本略矮；厚度按格点，书列齐平
          const bh = levelH * ((i + l) % 7 === 0 ? 0.62 : 0.8)
          packs.push([px, y + bh / 2, pz, 0, alongZ ? 0.2 : 0.058, bh, alongZ ? 0.058 : 0.2, col])
        } else {
          // 同一层同一个俯视尺寸，底面齐平、正面齐平
          const bh = p.h * (0.94 + 0.05 * (l % 2))
          const dw2 = Math.min(p.w, ROW - 0.045)
          const dd2 = Math.min(p.d, rackDepth - 0.1)
          packs.push([px, y + bh / 2, pz, 0, alongZ ? dd2 : dw2, bh, alongZ ? dw2 : dd2, col])
        }
      }
    }
    for (const sd of [-1, 1]) {
      const px = alongZ ? cx : cx + sd * len / 2
      const pz = alongZ ? cz : cz + sd * len / 2
      posts.push([px, (levelH * lv + 0.3) / 2 + 0.22, pz, 0, 0.05, levelH * lv + 0.3, 0.05])
    }
  }

  // 后墙整面 + 两侧墙整面
  rack(0, zb + 0.42, w - 1.1, false)
  if (sides) {
    for (const s of [-1, 1]) rack(s * (w / 2 - 0.5), zc + 0.2, depth - 1.7, true, levels, -s)
  }
  // 中岛：两排平行货架，中间留出通道
  if (island) {
    const n = island > 1 ? 2 : 1
    const isl = Math.min(w - 3.2, n > 1 ? 5.2 : 3.2)
    const lv = books ? 3 : 4
    for (let i = 0; i < n; i++) {
      // 两排中岛背靠背：靠里的朝后，靠前的朝前
      const off = (i - (n - 1) / 2) * 1.05
      rack(0, zc + 0.68 + off, isl, false, lv, off < 0 ? -1 : 1)
    }
  }

  // ── 柜台 ──
  // 柜台放在后柜前，留出一条店员通道，不和后墙货架叠在一起
  const counterZ = zb + 1.28
  if (counter) {
    const cm = shopSurface(books ? '#7d5334' : '#b9a184', 0.05, 0.42)
    const cw = Math.min(w - 2.0, 3.2)
    const cx = w / 2 - cw / 2 - 0.7
    add(g, cw, 0.9, 0.56, cm, cx, 0.64, counterZ, 0, false)
    add(g, cw - 0.16, 0.07, 0.72, shopSurface('#3a3f45', 0.04, 0.3), cx, 1.12, counterZ, 0, false)
    add(g, 0.36, 0.26, 0.3, std('#d7dde2', { metalness: 0.4, roughness: 0.3 }), cx + cw * 0.28, 1.3, counterZ + 0.06, 0, false)
    add(g, 0.4, 0.06, 0.28, std('#8d959c', { roughness: 0.4 }), cx + cw * 0.28, 1.44, counterZ + 0.18, 0, false)
    for (let i = 0; i < 4; i++) {
      packs.push([cx - cw * 0.3 + i * 0.22, 1.24, counterZ, 0, 0.16, 0.16, 0.14, goods[i % goods.length]])
    }
  }

  // ── 前场：展示台 / 地堆 / 购物篮 ──
  const frontZ = zFront - 0.62
  if (display && !island) {
    const dw = Math.min(w - 2.6, books ? 2.4 : 2.2)
    const dx = -w / 2 + dw / 2 + 0.9
    add(g, dw, 0.34, 0.66, shopSurface(books ? '#6f4b31' : '#8a8f93', 0.05, 0.4), dx, 0.35, frontZ, 0, false)
    add(g, dw + 0.1, 0.06, 0.74, shopSurface(pharm ? '#e7f3ee' : '#ddd3c0', 0.06, 0.5), dx, 0.55, frontZ, 0, false)
    const n = Math.max(3, Math.round(dw / 0.26))
    for (let i = 0; i < n; i++) {
      const px = dx - dw / 2 + 0.16 + i * ((dw - 0.3) / Math.max(1, n - 1))
      if (books) {
        // 展台上的书一律与台边平行，两本一摞，别斜着摆
        packs.push([px, 0.6, frontZ, 0, 0.24, 0.05, 0.18, goods[(i * 2) % goods.length]])
        packs.push([px, 0.65, frontZ, 0, 0.22, 0.045, 0.17, goods[(i * 2 + 1) % goods.length]])
      } else {
        packs.push([px, 0.66, frontZ, 0, 0.16, 0.18, 0.15, goods[(i * 3) % goods.length]])
      }
    }
  }
  // 地堆：靠两侧墙脚码成小垛，避开展台与中岛
  for (const s of [-1, 1]) {
    const bx = s * (w / 2 - 0.95)
    for (let k = 0; k < 4; k++) {
      packs.push([bx, 0.27 + k * 0.12, zFront - 1.05, 0, 0.32, 0.11, 0.26,
        goods[(k + (s > 0 ? 2 : 0)) % goods.length]])
    }
  }
  // 购物篮叠放
  const basketMat = shopSurface(pharm ? '#c0392b' : '#c9a227', 0.05, 0.36)
  for (let i = 0; i < 3; i++) {
    add(g, 0.46, 0.16, 0.34, basketMat, -w / 2 + 1.5, 0.26 + i * 0.17, zFront - 0.5, 0, false)
  }

  // ── 吊牌 ──
  const tagsY = h - 0.55
  const catCount = pharm ? 3 : 2
  for (let i = 0; i < catCount; i++) {
    const px = -w / 4 + (i * w) / (catCount * 2)
    add(g, 0.9, 0.3, 0.03, shopTagMat, px, tagsY, zFront - depth * 0.45, 0, false)
    add(g, 0.9, 0.05, 0.035, std('#e0563f', { roughness: 0.7 }), px, tagsY + 0.16, zFront - depth * 0.45, 0, false)
    for (const s of [-1, 1]) {
      add(g, 0.012, 0.34, 0.012, std('#9aa4ae', { metalness: 0.5, roughness: 0.4 }), px + s * 0.32, tagsY + 0.32, zFront - depth * 0.45, 0, false)
    }
  }

  // ── 书店专属：阅读角、书梯、地堆 ──
  if (books) {
    const tableM = shopSurface('#7d5334', 0.05, 0.42)
    const tx = 0.15
    const tz = zc - 0.5
    add(g, 1.6, 0.09, 0.9, tableM, tx, 0.86, tz, 0, false)
    for (const [dx, dz] of [[-0.68, -0.32], [0.68, -0.32], [-0.68, 0.32], [0.68, 0.32]]) {
      add(g, 0.08, 0.82, 0.08, tableM, tx + dx, 0.43, tz + dz, 0, false)
    }
    for (let i = 0; i < 4; i++) {
      packs.push([tx - 0.34, 0.95 + i * 0.055, tz, 0, 0.3, 0.05, 0.22, goods[(i * 2) % goods.length]])
    }
    // 摊开的书：左右两页平铺，不旋转
    for (const s2 of [-1, 1]) {
      add(g, 0.2, 0.03, 0.3, shopSurface('#f0e6d0', 0.05, 0.4), tx + 0.42 + s2 * 0.105, 0.95, tz, 0, false)
    }
    const chairM = shopSurface('#5d4433', 0.05, 0.4)
    for (const s of [-1, 1]) {
      add(g, 0.42, 0.06, 0.4, chairM, tx, 0.48, tz + s * 0.78, 0, false)
      add(g, 0.42, 0.5, 0.06, chairM, tx, 0.75, tz + s * 0.97, 0, false)
      for (const c2 of [-0.16, 0.16]) {
        for (const c3 of [-0.16, 0.16]) add(g, 0.05, 0.46, 0.05, chairM, tx + c2, 0.24, tz + s * 0.78 + c3, 0, false)
      }
    }
    // 书梯
    const ladderM = std('#8a6a45', { roughness: 0.7 })
    const lx = w / 2 - 1.05
    const lz = zc + Math.min(1.6, depth * 0.35)
    for (const s of [-1, 1]) add(g, 0.05, h - 0.5, 0.05, ladderM, lx + s * 0.17, (h - 0.5) / 2 + 0.2, lz, 0, false)
    for (let i = 0; i < 6; i++) add(g, 0.36, 0.045, 0.05, ladderM, lx, 0.35 + i * 0.42, lz, 0, false)
  }

  // 墙上海报 / 挂画，落在货架之上
  const posterY = Math.min(h - 0.34, 0.24 + levels * levelH + 0.35)
  for (let i = 0; i < 3; i++) {
    add(g, 0.48, 0.5, 0.03, shopSurface(goods[i % goods.length], 0.04, 0.32), -0.75 + i * 0.75, posterY, zb + 0.06, 0, false)
  }

  scatter(g, shopCell, rackMat, boards)
  scatter(g, shopCell, rackMat, posts)
  scatter(g, shopCell, pharm ? shopSurface('#f2f7f4', 0.05, 0.44) : rackMat, tags)
  scatter(g, shopCell, books ? bookSpineMat : shopGoodsMat, packs)
  void rnd
}

/**
 * 把一层临街面挖空：只留后部实体、两侧墙墩和门楣。
 * 之前店面是一整块实体，店内所有道具都关在盒子里，所以只能看到玻璃后一片平光。
 */
export function cutFront(g, W, D, h, mat, depth, openW, cx = 0, zFront = D / 2) {
  const backD = D - depth
  add(g, W, h, backD, mat, 0, h / 2, zFront - depth - backD / 2)
  const left = cx - openW / 2 + W / 2
  const right = W - (cx + openW / 2 + W / 2)
  if (left > 0.08) add(g, left, h, depth, mat, -W / 2 + left / 2, h / 2, zFront - depth / 2)
  if (right > 0.08) add(g, right, h, depth, mat, W / 2 - right / 2, h / 2, zFront - depth / 2)
  // 门楣：从店内看是天花，从外面看是招牌的背板
  add(g, openW, 0.55, depth, mat, cx, h - 0.275, zFront - depth / 2)
}

const frameAlu = std('#c9d2d8', { metalness: 0.6, roughness: 0.3 })
const plantMat = std('#54764a', { roughness: 1, flatShading: true })
const potMat = std('#8b8276', { roughness: 0.85 })
const doorGlass = std('#c4d6d8', { metalness: 0.4, roughness: 0.12, transparent: true, opacity: 0.42 })
const spotMat = glowMat('#ffe6bc', 0.1, 1.1, { emissive: '#ffdca8', roughness: 0.4 })

/**
 * 门脸的一套标准件：门槛、门框、玻璃门与拉手、门头射灯、两侧花池、立式菜单。
 * 每个店铺都共用，省得每家都手搓一遍。
 */
export function shopFront(g, o) {
  const {
    w, z, h = 2.4, doorX = 0, doorW = 1.1,
    potX = null, menu = true, canopy = 0,
  } = o
  // 门槛石与两级踏步
  add(g, w + 0.36, 0.12, 0.6, std('#cfc7b8', { roughness: 0.88 }), 0, 0.06, z + 0.26, 0, false)
  add(g, w + 0.6, 0.08, 0.94, std('#c3bbac', { roughness: 0.9 }), 0, 0.02, z + 0.44, 0, false)
  // 门框
  for (const s of [-1, 1]) {
    add(g, 0.12, h, 0.2, frameAlu, doorX + s * (doorW / 2 + 0.06), h / 2, z + 0.03, 0, false)
  }
  add(g, doorW + 0.3, 0.14, 0.2, frameAlu, doorX, h - 0.02, z + 0.03, 0, false)
  // 玻璃门扇 + 竖拉手
  add(g, doorW, h - 0.22, 0.05, doorGlass, doorX, (h - 0.22) / 2 + 0.08, z + 0.05, 0, false)
  add(g, 0.05, h - 0.3, 0.09, frameAlu, doorX + doorW / 2 - 0.1, (h - 0.3) / 2 + 0.1, z + 0.1, 0, false)
  cyl(g, 0.025, 0.75, frameAlu, doorX - doorW / 2 + 0.16, 1.1, z + 0.12)
  // 门头射灯
  for (const s of [-1, 1]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 10), frameAlu)
    can.position.set(doorX + s * (doorW / 2 + 0.5), h + 0.12, z + 0.28)
    g.add(can)
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 10), spotMat)
    lens.position.set(doorX + s * (doorW / 2 + 0.5), h + 0.04, z + 0.28)
    g.add(lens)
  }
  if (canopy) {
    add(g, w * canopy, 0.1, 1.0, std('#4a5259', { roughness: 0.6 }), 0, h + 0.3, z + 0.5, 0, false)
  }
  // 两侧花池
  const px = potX === null ? w / 2 - 0.5 : potX
  for (const s of [-1, 1]) {
    add(g, 0.52, 0.46, 0.52, potMat, s * px, 0.35, z + 0.34, 0, false)
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), plantMat)
    bush.position.set(s * px, 0.78, z + 0.34)
    bush.scale.set(1, 0.8, 1)
    g.add(bush)
  }
  // 立式菜单牌
  if (menu) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.04), std('#2f3a3f', { roughness: 0.7 }))
    board.position.set(doorX + doorW / 2 + 0.62, 0.52, z + 0.42)
    board.rotation.x = -0.12
    g.add(board)
    for (const s of [-1, 1]) {
      add(g, 0.04, 0.62, 0.04, frameAlu, doorX + doorW / 2 + 0.62 + s * 0.22, 0.34, z + 0.56, 0, false)
    }
  }
}
