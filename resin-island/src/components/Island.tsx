import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { TERRAIN_SEG, TERRAIN_SIZE, WATER_Y } from '../config/scene'
import { islandColor, islandHeight, islandSlope } from '../utils/island'
import { rand2 } from '../utils/noise'
import { useQuality } from '../hooks/useQuality'

interface Sprout {
  x: number
  y: number
  z: number
  s: number
  rot: number
  type: 0 | 1
}

/** 由高度场直接生成地形网格：顶点高度 + 按高度/坡度分层顶点色 */
function buildTerrain(seg: number) {
  const g = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, seg, seg)
  g.rotateX(-Math.PI / 2)
  g.translate(TERRAIN_SIZE / 2, 0, TERRAIN_SIZE / 2)

  const pos = g.attributes.position as THREE.BufferAttribute
  const count = pos.count

  for (let i = 0; i < count; i++) {
    pos.setY(i, islandHeight(pos.getX(i), pos.getZ(i)))
  }
  pos.needsUpdate = true
  g.computeVertexNormals()

  const colors = new Float32Array(count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    islandColor(x, z, pos.getY(i), islandSlope(x, z), c)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeBoundingSphere()
  return g
}

/** 在缓坡、出水的高度带上撒点 */
function collectSprouts(): Sprout[] {
  const out: Sprout[] = []
  const step = 0.017
  for (let gx = 0.03; gx < TERRAIN_SIZE; gx += step) {
    for (let gz = 0.03; gz < TERRAIN_SIZE; gz += step) {
      const jx = gx + (rand2(gx, gz, 7) - 0.5) * step * 1.5
      const jz = gz + (rand2(gx, gz, 11) - 0.5) * step * 1.5
      const y = islandHeight(jx, jz)
      // 只在「草坡」台地上生长（与水线隔开一段，避免长在沙滩/岩壁上）
      if (y < WATER_Y + 0.16 || y > 0.6) continue
      const slope = islandSlope(jx, jz)
      if (slope > 0.6) continue
      if (rand2(jx, jz, 3) > 0.72 - slope * 0.35) continue
      out.push({
        x: jx,
        y,
        z: jz,
        s: 0.7 + rand2(jx, jz, 13) * 0.85,
        rot: rand2(jx, jz, 17) * Math.PI * 2,
        type: rand2(jx, jz, 23) > 0.42 ? 0 : 1,
      })
    }
  }
  return out.slice(0, 460)
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()

function buildSprouts(
  sprouts: Sprout[],
  type: 0 | 1,
  geometry: THREE.BufferGeometry,
  baseColor: string,
  vary: number,
) {
  const list = sprouts.filter((s) => s.type === type)
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0 })
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length))
  mesh.castShadow = true

  list.forEach((s, i) => {
    _e.set(0, s.rot, 0)
    _q.setFromEuler(_e)
    _p.set(s.x, s.y - 0.012, s.z)
    _s.set(s.s, s.s * (0.85 + rand2(s.x, s.z, 29) * 0.45), s.s)
    _m.compose(_p, _q, _s)
    mesh.setMatrixAt(i, _m)
    _c.set(baseColor).offsetHSL(0, 0, (rand2(s.x, s.z, 31) - 0.5) * vary)
    mesh.setColorAt(i, _c)
  })

  mesh.count = list.length
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
  return mesh
}

/** 角部的程序化岛屿：噪声地形 + 实例化植被 */
export default function Island() {
  const { settings } = useQuality()
  const seg = settings.level === 'high' ? TERRAIN_SEG : 76

  const { terrain, trees, bushes } = useMemo(() => {
    const terrain = buildTerrain(seg)
    const sprouts = collectSprouts()

    const treeGeo = new THREE.ConeGeometry(0.024, 0.085, 5, 1)
    treeGeo.translate(0, 0.0425, 0)
    const bushGeo = new THREE.IcosahedronGeometry(0.03, 0)
    bushGeo.scale(1, 0.72, 1)
    bushGeo.translate(0, 0.02, 0)

    return {
      terrain,
      trees: buildSprouts(sprouts, 0, treeGeo, '#3d5426', 0.14),
      bushes: buildSprouts(sprouts, 1, bushGeo, '#586e2f', 0.16),
    }
  }, [seg])

  const terrainMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 }),
    [],
  )

  useEffect(
    () => () => {
      terrain.dispose()
      terrainMat.dispose()
      trees.geometry.dispose()
      ;(trees.material as THREE.Material).dispose()
      trees.dispose()
      bushes.geometry.dispose()
      ;(bushes.material as THREE.Material).dispose()
      bushes.dispose()
    },
    [terrain, terrainMat, trees, bushes],
  )

  return (
    <group>
      <mesh geometry={terrain} material={terrainMat} castShadow receiveShadow />
      <primitive object={trees} />
      <primitive object={bushes} />
    </group>
  )
}
