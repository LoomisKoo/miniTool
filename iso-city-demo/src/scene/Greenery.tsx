import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { walker } from '../game/walker'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { alley, cedarLane, ferrisWheel, insideRoad, insideWater, plaza, plazaFountain, trees } from '../data/city'
import { insidePark } from '../data/parks'
import { insideBuilding } from '../data/infill'
import { PED } from '../data/pedestrian'
import { makeContactShadowTexture } from './textures'
import { seeded } from './theme'

/**
 * 楼间绿化：在空地上自动撒圆团树。
 *
 * 地图类风格的城市"不空"，主要靠满地的圆树把楼与楼之间的缝填起来，
 * 楼才像长在街区里，而不是插在一块平板上。这里全部用实例化：
 * 几百棵树只有三次 draw call（树干、树冠、脚下阴影）。
 *
 * 少量开花树（粉色）做点缀，颜色来源是《模拟人生》式的梦幻花园。
 */

const STEP = 12
const RANGE = 396

function inRect(x: number, z: number, r: { x: number; z: number; w: number; d: number }, pad: number) {
  return Math.abs(x - r.x) < r.w / 2 + pad && Math.abs(z - r.z) < r.d / 2 + pad
}

function placements() {
  const rnd = seeded('greenery')
  const out: Array<{ x: number; z: number; s: number; bloom: boolean }> = []
  for (let gx = -RANGE; gx <= RANGE; gx += STEP) {
    for (let gz = -RANGE; gz <= RANGE; gz += STEP) {
      const x = gx + (rnd() - 0.5) * STEP * 0.8
      const z = gz + (rnd() - 0.5) * STEP * 0.8
      // 留一部分空地当草坪，不是每个格子都种。
      // 密度从 8m 网格 / 70% 降到 12m 网格 / 45%，再加上下面的大尺度
      // "林块"判据：城市里要有成片的空地，否则俯视时整座城是一层
      // 均匀的黄绿噪点，楼和树互相吃掉了轮廓。
      if (rnd() < 0.55) continue
      // 大尺度林块：低频起伏低于阈值的区域整片不种，形成草地/广场/空场
      const grove =
        Math.sin(x * 0.026 + 1.3) + Math.sin(z * 0.021 - 0.7) + Math.sin((x + z) * 0.009 + 2.1)
      if (grove < 0.15) continue
      if (insideRoad(x, z, 5)) continue
      if (insideWater(x, z, 3)) continue
      if (insideBuilding(x, z, 5)) continue
      // 广场中心现在是草坪 + 喷泉，树只种在外圈
      if (inRect(x, z, plaza, 2)) {
        const edge = Math.max(
          Math.abs(x - plaza.x) / (plaza.w / 2),
          Math.abs(z - plaza.z) / (plaza.d / 2),
        )
        if (edge < 0.7) continue
      }
      if (inRect(x, z, alley, 2) || inRect(x, z, cedarLane, 2)) continue
      if (x > PED.x0 - 3 && x < PED.x1 + 3 && z > PED.z0 - 3 && z < PED.z1 + 3) continue
      if (Math.hypot(x - ferrisWheel.x, z - ferrisWheel.z) < 14) continue
      if (Math.hypot(x - plazaFountain.x, z - plazaFountain.z) < plazaFountain.r + 4) continue
      // 公园里的树只是点缀：草坪要空出来，树集中到边缘
      if (insidePark(x, z, -4) && rnd() > 0.22) continue
      if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 5)) continue
      // 树要大：小树从高处看像撒了一地药丸，大树冠才能连成一片绿荫
      out.push({ x, z, s: 1.1 + rnd() * 0.55, bloom: rnd() < 0.08 })
    }
  }
  return out
}

/** 三个球团拼成的树冠：轮廓是"一朵云"，不是一颗正球。 */
function crownGeometry(detail = 1) {
  const parts = [
    new THREE.IcosahedronGeometry(1.9, detail).translate(0, 4.4, 0),
    new THREE.IcosahedronGeometry(1.4, detail).translate(1.1, 3.9, 0.5),
    new THREE.IcosahedronGeometry(1.35, detail).translate(-0.9, 4.0, -0.6),
    new THREE.IcosahedronGeometry(1.2, detail).translate(0.2, 5.4, -0.3),
  ]
  const geo = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return geo
}

export function Greenery({ night }: { night: boolean }) {
  const spots = useMemo(placements, [])

  const { trunks, crowns, crownsLo, shadows } = useMemo(() => {
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 8).translate(0, 1.6, 0)
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b5544', roughness: 1 })
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length)

    const crownMat = new THREE.MeshStandardMaterial({ roughness: 0.9 })
    const crowns = new THREE.InstancedMesh(crownGeometry(), crownMat, spots.length)

    const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    const shadowMat = new THREE.MeshBasicMaterial({
      map: makeContactShadowTexture(),
      color: '#000000',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
    const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, spots.length)

    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const rnd = seeded('greenery-tone')
    const c = new THREE.Color()
    spots.forEach((t, i) => {
      q.setFromAxisAngle(up, rnd() * Math.PI * 2)
      m.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.s, t.s, t.s))
      trunks.setMatrixAt(i, m)
      crowns.setMatrixAt(i, m)
      m.compose(new THREE.Vector3(t.x, 0.05, t.z), q, new THREE.Vector3(7 * t.s, 1, 7 * t.s))
      shadows.setMatrixAt(i, m)
      // 饱和度压低：高饱和的嫩绿在夜里是荧光色。
      // 花树（bloom）原来是 L=0.6 的粉色，夜里比楼还亮，
      // 一排粉色云团浮在城市上——那是装饰，不是树。压到 0.42。
      // 饱和度压低：高饱和的嫩绿在夜里是荧光色。
      // 亮度再降一档：树是"暗绿团块"，不该和窗灯抢亮度。
      if (t.bloom) c.setHSL(0.94 + rnd() * 0.03, 0.18, 0.3 + rnd() * 0.04)
      else c.setHSL(0.28 + rnd() * 0.06, 0.2 + rnd() * 0.08, 0.14 + rnd() * 0.06)
      crowns.setColorAt(i, c)
    })
    for (const mesh of [trunks, crowns]) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
    shadows.renderOrder = 1
    // 远景低模：几千棵树每棵 320 面，高空俯视时三角面上百万；
    // 远处换成不细分的二十面体（80 面），共用同一份矩阵和颜色
    const crownsLo = new THREE.InstancedMesh(crownGeometry(0), crownMat, spots.length)
    crownsLo.instanceMatrix.copy(crowns.instanceMatrix)
    if (crowns.instanceColor) {
      crownsLo.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(crowns.instanceColor.array), 3)
    }
    crownsLo.visible = false
    return { trunks, crowns, crownsLo, shadows }
  }, [spots])

  const camera = useThree((state) => state.camera)
  useFrame(() => {
    const far = camera.position.distanceTo(walker.position) > 100
    if (crownsLo.visible === far) return
    crownsLo.visible = far
    crowns.visible = !far
    trunks.visible = !far
  })

  useEffect(() => {
    const mat = crowns.material as THREE.MeshStandardMaterial
    // 夜里树冠吃不到多少直射光：补一点自身的绿，避免整片变成黑团。
    // 补光要极低：给多了整片绿地会自己发光，就是"荧光绿"的来源。
    mat.emissive.set(night ? '#0e1712' : '#000000')
    mat.emissiveIntensity = night ? 1 : 0
    mat.needsUpdate = true
  }, [crowns, night])

  useEffect(
    () => () => {
      crownsLo.geometry.dispose()
      for (const mesh of [trunks, crowns, shadows]) {
        mesh.geometry.dispose()
        const mat = mesh.material as THREE.MeshStandardMaterial
        mat.map?.dispose()
        mat.dispose()
      }
    },
    [trunks, crowns, crownsLo, shadows],
  )

  return (
    <group>
      <primitive object={shadows} />
      <primitive object={trunks} />
      <primitive object={crowns} />
      <primitive object={crownsLo} />
    </group>
  )
}
