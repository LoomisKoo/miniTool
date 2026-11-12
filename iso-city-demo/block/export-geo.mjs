// 把街区几何导出成 AABB 列表，交给 Blender 烘焙地面 AO。
// 之所以用 AABB：这套场景本来就是盒子搭的，用包围盒在 Blender 里重建
// 既快又不会带进倒角/贴图这些对 AO 没有意义的细节。
import fs from 'node:fs'

const noop = () => {}
const gradient = { addColorStop: noop }
const ctx2d = new Proxy(
  {
    measureText: (t) => ({ width: String(t).length * 20 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: noop,
  },
  { get: (t, k) => (k in t ? t[k] : noop), set: () => true },
)
const canvas = {
  width: 0, height: 0, style: {}, getContext: () => ctx2d,
  addEventListener: noop, removeEventListener: noop, requestPointerLock: noop,
}
const el = () => ({
  classList: { toggle: noop, add: noop, remove: noop },
  textContent: '', addEventListener: noop, style: {},
})
globalThis.document = {
  createElement: () => canvas, querySelector: () => el(), getElementById: () => el(),
  addEventListener: noop, exitPointerLock: noop, pointerLockElement: null, body: el(),
}
globalThis.window = { devicePixelRatio: 2, innerWidth: 1280, innerHeight: 720, addEventListener: noop }
globalThis.performance = { now: () => 0 }
globalThis.requestAnimationFrame = noop
globalThis.innerWidth = 1280
globalThis.innerHeight = 720
globalThis.addEventListener = noop
globalThis.location = { search: '' }

const THREE = await import('three')
const K = await import('./kit.js')
const { buildSite, flushPools } = await import('./site.js')
const { buildBuildings } = await import('./buildings.js')

const scene = new THREE.Scene()
buildSite(scene)
buildBuildings(scene)
K.harmonizePalette(scene)
flushPools(scene)
K.clipDecals(scene)

const boxes = []
const world = new THREE.Box3()
scene.traverse((o) => {
  if (!o.isMesh || o.isInstancedMesh) return
  world.setFromObject(o)
  if (!isFinite(world.min.x)) return
  const sx = world.max.x - world.min.x
  const sy = world.max.y - world.min.y
  const sz = world.max.z - world.min.z
  // 厚度只用原始 AABB 判断，不要用下面 clamp 过的 min.y
  if (world.max.y < 0.8) return // 贴地小件（地砖、路缘、贴花）
  if (sy < 0.8) return // 薄板：地面、路面、雨棚、遮阳板
  // 天穹、场地大平面、远景背景片会包住整个场景，留着会把 AO 烘成全黑或全白
  if (sx > 150 || sz > 150) return
  boxes.push({
    min: [world.min.x, Math.max(0, world.min.y), world.min.z],
    max: [world.max.x, world.max.y, world.max.z],
  })
})

// 地面范围取所有楼体的并集，再外扩一点
let gx0 = Infinity, gx1 = -Infinity, gz0 = Infinity, gz1 = -Infinity
for (const b of boxes) {
  gx0 = Math.min(gx0, b.min[0]); gx1 = Math.max(gx1, b.max[0])
  gz0 = Math.min(gz0, b.min[2]); gz1 = Math.max(gz1, b.max[2])
}
const pad = 18
const out = {
  boxes,
  ground: { x0: gx0 - pad, x1: gx1 + pad, z0: gz0 - pad, z1: gz1 + pad },
}
fs.mkdirSync('tools/blender/out', { recursive: true })
fs.writeFileSync('tools/blender/out/city.json', JSON.stringify(out))
// Three.js 端要知道这张 AO 图覆盖的是哪块地面，否则对不上位置
fs.writeFileSync(
  'block/ao-bounds.js',
  `// 由 block/export-geo.mjs 自动生成，勿手改\nexport const AO_BOUNDS = ${JSON.stringify(out.ground)}\n`,
)
console.log(
  `boxes ${boxes.length}  ground ${(out.ground.x1 - out.ground.x0).toFixed(0)} x ${(out.ground.z1 - out.ground.z0).toFixed(0)} m`,
)
