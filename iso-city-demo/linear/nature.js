import * as THREE from 'three'
import { W, SURFACE, islandHalf, natureWidth, wallBounds } from './spec.js'
import { mulberry, range } from './rng.js'
import * as Mat from './mat.js'

/** 外海 + 墙外自然带。底板刻意低于可走面，避免与地表共面闪烁。 */
export function buildNature(zLen = W.segmentLength) {
  const root = new THREE.Group()
  root.name = 'nature'
  const half = islandHalf()
  const pad = 10_000

  const ocean = new THREE.Mesh(
    new THREE.BoxGeometry(half * 2 + pad * 2, 8, zLen + pad * 2),
    Mat.water(true),
  )
  ocean.position.set(0, SURFACE - 10.4, 0) // 顶面 -6.4：不与河面(-6)共面
  ocean.renderOrder = -2
  root.add(ocean)

  // 结构底板：顶面低于 SURFACE，只当填芯，不参与地表着色竞争
  const plateMat = Mat.concrete('#4a525a')
  plateMat.polygonOffset = true
  plateMat.polygonOffsetFactor = 2
  plateMat.polygonOffsetUnits = 2
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(half * 2 + 80, 10, zLen + 120),
    plateMat,
  )
  plate.position.set(0, SURFACE - 6.5, 0) // 顶面 = SURFACE - 1.5
  plate.receiveShadow = true
  plate.renderOrder = -1
  root.add(plate)

  root.add(buildBelt('left', zLen))
  root.add(buildBelt('right', zLen))

  // 岛端：顶面略低于城内地面，避免与 plate/城地共面
  for (const s of [-1, 1]) {
    const end = new THREE.Mesh(
      new THREE.BoxGeometry(half * 2 + 160, 1.6, 80),
      Mat.sand(),
    )
    end.position.set(0, SURFACE - 1.2, s * (zLen / 2 + 50))
    root.add(end)
  }

  return root
}

function buildBelt(sideName, zLen) {
  const g = new THREE.Group()
  const b = wallBounds(sideName)
  const side = b.side
  const rng = mulberry(sideName === 'left' ? 101 : 202)
  const slices = 28

  for (let i = 0; i < slices; i++) {
    const z0 = -zLen / 2 + (i / slices) * zLen
    const z1 = -zLen / 2 + ((i + 1) / slices) * zLen
    const zm = (z0 + z1) / 2
    // 切片之间留缝，避免侧壁共面闪烁
    const depth = Math.max(4, z1 - z0 - 1.5)
    const w = natureWidth(zm, side)

    // 顶面 SURFACE；与墙外缘留 6m 空隙，不钻进墙脚
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(w, 3, depth),
      i % 5 === 0 ? Mat.sand() : Mat.grass(i % 3 === 0 ? '#4a6a42' : '#557848'),
    )
    ground.position.set(b.xOuter + side * (w / 2 + 8), SURFACE - 1.5, zm)
    ground.receiveShadow = true
    g.add(ground)

    // 沙滩低于草地，再往海倾一点
    const beachW = Math.min(64, w * 0.2)
    const beach = new THREE.Mesh(
      new THREE.BoxGeometry(beachW, 1.4, depth * 0.96),
      Mat.sand(),
    )
    beach.position.set(
      b.xOuter + side * (w - beachW / 2 + 8),
      SURFACE - 1.55,
      zm,
    )
    g.add(beach)
  }

  const hillGeo = new THREE.ConeGeometry(1, 1, 5)
  const hills = new THREE.InstancedMesh(hillGeo, Mat.grass('#3d5c38'), 60)
  const d = new THREE.Object3D()
  let hn = 0
  for (let i = 0; i < 60; i++) {
    const z = (rng() - 0.5) * zLen * 0.9
    const w = natureWidth(z, side)
    if (w < 320) continue
    const x = b.xOuter + side * range(rng, w * 0.3, w * 0.8)
    const h = range(rng, 18, 70)
    const r = range(rng, 40, 110)
    d.position.set(x, SURFACE + h / 2, z)
    d.scale.set(r, h, r * range(rng, 0.7, 1.2))
    d.updateMatrix()
    hills.setMatrixAt(hn++, d.matrix)
  }
  hills.count = hn
  g.add(hills)

  const trunkGeo = new THREE.CylinderGeometry(1, 1.6, 1, 5)
  const canopyGeo = new THREE.SphereGeometry(1, 5, 4)
  const trunks = new THREE.InstancedMesh(trunkGeo, Mat.concrete('#4a3428'), 500)
  const canopies = new THREE.InstancedMesh(canopyGeo, Mat.grass('#2f5a32'), 500)
  let tn = 0
  for (let i = 0; i < 500; i++) {
    const z = (rng() - 0.5) * zLen * 0.95
    const w = natureWidth(z, side)
    const x = b.xOuter + side * range(rng, 40, Math.max(50, w * 0.85))
    const h = range(rng, 7, 16)
    d.position.set(x, SURFACE + h * 0.35, z)
    d.scale.set(1.2, h, 1.2)
    d.updateMatrix()
    trunks.setMatrixAt(tn, d.matrix)
    d.position.y = SURFACE + h * 0.8
    d.scale.set(h * 0.5, h * 0.4, h * 0.5)
    d.updateMatrix()
    canopies.setMatrixAt(tn, d.matrix)
    tn++
  }
  trunks.count = tn
  canopies.count = tn
  g.add(trunks, canopies)

  return g
}
