import * as THREE from 'three'
import { GROUND, add, clipRect, cyl, paint, std, glowMat, trackGlow, trackFade, trackLight, solid } from './kit.js'

const canopyGeo = new THREE.IcosahedronGeometry(1, 1)
const leafA = std('#6d9850', { roughness: 1, flatShading: true })
const leafB = std('#587e42', { roughness: 1, flatShading: true })
const bark = std('#6b5344', { roughness: 0.9 })
const metal = std('#c5ccd2', { roughness: 0.35, metalness: 0.7 })
const bulbMat = glowMat('#fff4d4', 0, 2.1, { roughness: 0.3 })

function tree(parent, x, z, s = 1) {
  cyl(parent, 0.14 * s, 1.7 * s, bark, x, GROUND + 0.85 * s, z)
  const pots = [
    [0, 2.15, 0, 1.15, leafA],
    [-0.45, 1.85, 0.2, 0.75, leafB],
    [0.4, 1.95, -0.15, 0.7, leafA],
  ]
  for (const [dx, y, dz, r, mat] of pots) {
    const m = new THREE.Mesh(canopyGeo, mat)
    m.position.set(x + dx * s, GROUND + y * s, z + dz * s)
    m.scale.setScalar(r * s)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
  }
}

/**
 * 路灯的地面光斑：椭圆形的平滑衰减。
 * 用 smoothstep 保证 r=1 处正好为 0，改成正片混合（而不是加色），
 * 光斑只是把地面的暗色替换成暖色，不再叠成过曝的黄色圆盘。
 */
const poolTex = paint(256, 256, (ctx, w, h) => {
  const img = ctx.createImageData(w, h)
  const cx = w / 2
  const cy = h / 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / cx
      const dy = (y - cy) / cy
      const r = Math.sqrt(dx * dx + dy * dy)
      // 轻微的角向扰动，消掉正圆的机械感
      const ang = Math.atan2(dy, dx)
      const wob = 1 + 0.035 * Math.sin(ang * 3.0) + 0.02 * Math.sin(ang * 7.0 + 1.3)
      const t = Math.min(1, r * wob)
      const k = t < 1 ? 1 - t : 0
      // k^1.8 的柔和衰减，中心附近还有一点平缓的亮芯
      const a = Math.pow(k, 1.8) * 0.72
      const warm = 1 - t
      const i = (y * w + x) * 4
      img.data[i] = 255
      img.data[i + 1] = Math.round(246 - 34 * (1 - warm))
      img.data[i + 2] = Math.round(228 - 62 * (1 - warm))
      img.data[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255)))
    }
  }
  ctx.putImageData(img, 0, 0)
})

/** 整条街的路面补光：中间亮、两侧淡，把一串光斑连成一条光带 */
const bandTex = paint(64, 256, (ctx, w, h) => {
  const gr = ctx.createLinearGradient(0, 0, 0, h)
  gr.addColorStop(0, 'rgba(255,240,214,0)')
  gr.addColorStop(0.28, 'rgba(255,240,214,0.5)')
  gr.addColorStop(0.5, 'rgba(255,244,222,0.78)')
  gr.addColorStop(0.72, 'rgba(255,240,214,0.5)')
  gr.addColorStop(1, 'rgba(255,240,214,0)')
  ctx.fillStyle = gr
  ctx.fillRect(0, 0, w, h)
})

const poolSpecs = []
function pool(parent, x, z, sx, sz) {
  poolSpecs.push({ x, z, sx, sz })
}

/**
 * 一盏灯一个光斑贴片会互相重叠（相邻光斑重叠一百多平米），而透明物体每帧
 * 按距离排序，相机一动它们的先后顺序就翻，重叠区的叠色结果跟着跳 —— 看起来
 * 就是楼脚一片在闪。合成一个 InstancedMesh 后只有一次绘制、顺序固定，闪不了。
 */
export function flushPools(parent) {
  if (!poolSpecs.length) return 0
  const mat = new THREE.MeshStandardMaterial({
    color: '#000000', map: poolTex, emissiveMap: poolTex, emissive: '#fff3dc',
    emissiveIntensity: 0, transparent: true, opacity: 0, depthWrite: false,
    roughness: 1, toneMapped: false,
  })
  trackGlow(mat, 0, 0.5)
  // 白天必须整片透明：它只有自发光没有漫反射色，白天就剩一块黑斑
  trackFade(mat, 0, 1)
  const items = []
  for (const p of poolSpecs) {
    const c = clipRect(p.x, p.z, p.sx / 2, p.sz / 2)
    if (!c) {
      items.push([p.x, p.z, p.sx, p.sz])
      continue
    }
    if (c.w < 0.8 || c.h < 0.8) continue
    items.push([(c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, c.w, c.h])
  }
  poolSpecs.length = 0
  if (!items.length) return 0
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, items.length)
  const d = new THREE.Object3D()
  for (let i = 0; i < items.length; i++) {
    d.position.set(items[i][0], 0.212, items[i][1])
    d.rotation.set(-Math.PI / 2, 0, 0)
    d.scale.set(items[i][2], items[i][3], 1)
    d.updateMatrix()
    mesh.setMatrixAt(i, d.matrix)
  }
  mesh.renderOrder = 3
  mesh.frustumCulled = false
  parent.add(mesh)
  return items.length
}

function streetBand(parent) {
  const mat = new THREE.MeshStandardMaterial({
    color: '#000000', map: bandTex, emissiveMap: bandTex, emissive: '#fff1d6',
    emissiveIntensity: 0, transparent: true, opacity: 0, depthWrite: false,
    roughness: 1, toneMapped: false,
  })
  trackGlow(mat, 0, 0.13)
  trackFade(mat, 0, 1)
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
  m.rotation.x = -Math.PI / 2
  m.position.set(-2, 0.204, 16.8)
  m.scale.set(76, 9.4, 1)
  m.renderOrder = 2
  m.userData.decal = { cx: -2, cz: 16.8, hx: 38, hz: 4.7 }
  parent.add(m)
}

/** real=false 的灯只留光斑和灯头，不占动态光源名额 */
function lamp(parent, x, z, ry = 0, real = true) {
  const g = new THREE.Group()
  g.position.set(x, GROUND, z)
  g.rotation.y = ry
  add(g, 0.3, 0.55, 0.3, std('#9aa3ad', { roughness: 0.5, metalness: 0.3 }), 0, 0.28, 0)
  add(g, 0.11, 5.4, 0.11, metal, 0, 2.95, 0)
  for (const y of [1.5, 3.0, 4.4]) add(g, 0.16, 0.06, 0.16, metal, 0, y, 0, 0, false)
  add(g, 0.07, 0.07, 1.0, metal, 0, 5.62, 0.45)
  add(g, 0.26, 0.1, 0.54, metal, 0, 5.55, 0.92, 0, false)
  add(g, 0.2, 0.05, 0.44, bulbMat, 0, 5.47, 0.92, 0, false)
  if (real) {
    const L = new THREE.PointLight('#ffd9a2', 0, 26, 2)
    L.position.set(0, 5.15, 0.9)
    g.add(L)
    trackLight(L, 0, 82)
  }
  parent.add(g)
  const px = x + Math.sin(ry) * 0.9
  const pz = z + Math.cos(ry) * 0.9
  pool(parent, px, pz, 17, 11.5)
}

function car(parent, x, z, body, ry = 0) {
  const g = new THREE.Group()
  g.position.set(x, 0.08, z)
  g.rotation.y = ry
  const paint = std(body, { roughness: 0.35, metalness: 0.45 })
  const glass = std('#1c2836', { roughness: 0.08, metalness: 0.4 })
  const wheel = std('#1a1c20', { roughness: 0.7 })
  add(g, 4.15, 0.85, 1.75, paint, 0, 0.72, 0)
  add(g, 2.15, 0.7, 1.6, glass, -0.15, 1.35, 0)
  for (const [wx, wz] of [[1.25, 0.78], [1.25, -0.78], [-1.25, 0.78], [-1.25, -0.78]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14), wheel)
    m.rotation.z = Math.PI / 2
    m.position.set(wx, 0.32, wz)
    g.add(m)
  }
  parent.add(g)
}

export function buildSite(parent) {
  const grass = std('#6a8f58', { roughness: 1 })
  add(parent, 260, 0.4, 260, grass, 0, -0.2, 0, 0, true)

  const padMat = std('#d4cfc6', { roughness: 0.92 })
  add(parent, 78, GROUND, 35, padMat, -2, GROUND / 2, -8.5)
  // 两侧新地块，让新增的楼型有地方站
  add(parent, 24, GROUND, 30, padMat, -50, GROUND / 2, -4)
  add(parent, 22, GROUND, 30, padMat, 48, GROUND / 2, -6)

  const asphaltMap = paint(256, 256, (g, w, h) => {
    g.fillStyle = '#3c4149'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 1400; i++) {
      const v = 48 + ((i * 37) % 40)
      g.fillStyle = `rgba(${v},${v},${v + 6},0.16)`
      g.fillRect((i * 53) % w, (i * 97) % h, 2, 2)
    }
  }, { repeat: [10, 3] })
  const road = std('#474c56', { map: asphaltMap, roughness: 0.94 })
  add(parent, 78, 0.08, 8.2, road, -2, 0.04, 16.7)

  const walk = std('#d3ccbf', { roughness: 0.9 })
  add(parent, 74, GROUND, 3.6, walk, -2, GROUND / 2, 10.8)
  // 街对面那一排的场地与人行道
  add(parent, 78, GROUND, 18, padMat, -2, GROUND / 2, 33)
  add(parent, 74, GROUND, 3.4, walk, -2, GROUND / 2, 22.6)

  const line = std('#e4e0d4', { roughness: 0.6 })
  for (let x = -24; x < 28; x += 3.2) add(parent, 1.5, 0.02, 0.12, line, x, 0.09, 16.7, 0, false)
  // 斑马线：每道条纹顺车行方向（x），沿马路宽度（z）逐道重复
  for (let i = 0; i < 9; i++) add(parent, 3.8, 0.02, 0.46, line, -2.0, 0.09, 13.05 + i * 0.94, 0, false)

  for (const [x, z, s] of [
    [-28, 10.7, 1],
    [-13.5, 10.85, 0.9],
    [-1.2, 10.7, 1.05],
    [9.2, 10.9, 0.85],
    [23.5, 10.75, 1.1],
    [-30, 1.5, 1.25],
    [26, 1, 1.15],
    [8, -23, 1.3],
    [-35, 22.4, 1.05],
    [33, 22.5, 0.95],
    [-34.5, 5, 1.1],
    [33.5, 2, 1.05],
  ]) tree(parent, x, z, s)

  streetBand(parent)
  for (const x of [-33.5, -26.4, -8, 5, 17, 27]) lamp(parent, x, 10.55, 0, x === -8 || x === 17)
  for (const x of [-19.5, -1.5, 13.5]) lamp(parent, x, 21.9, Math.PI, false)
  lamp(parent, -14.5, 12.3, Math.PI / 2, true)

  car(parent, -16, 15.4, '#f4f1ea')
  car(parent, 6.5, 18.1, '#2c4d73', Math.PI)
  solid(-16, 15.4, 4.3, 1.9, 1.55)
  solid(6.5, 18.1, 4.3, 1.9, 1.55)

  const wood = std('#8d6246', { roughness: 0.8 })
  add(parent, 1.5, 0.08, 0.42, wood, -14.2, GROUND + 0.42, 10.5)
  add(parent, 0.08, 0.42, 0.4, metal, -14.8, GROUND + 0.21, 10.5, 0, false)
  add(parent, 0.08, 0.42, 0.4, metal, -13.6, GROUND + 0.21, 10.5, 0, false)
}
