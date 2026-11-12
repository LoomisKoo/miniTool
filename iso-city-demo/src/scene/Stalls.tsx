// 街边小摊的 3D 表现。
//
// 数据在 data/stalls.ts（位置、摊主、卖什么），这里只管画。
//
// 造型按"真的市集摊"来搭：
// - 米白帆布顶棚，前低后高，雨天水往街面走；
// - 前沿一圈布幡（用摊位自己的颜色），布幡底下挂招牌；
// - 木头柜台前面围一块布裙，台面是浅色木板；
// - 柜台后面有一副小货架，摊主坐在那儿，身后堆着货；
// - 台面上按品类摆东西（小吃是托盘和碗，花是桶，小游戏是道具）；
// - 地上两只木箱，夜里顶棚里拉一串小灯。
//
// 以前的问题：顶棚前高后低、颜色大面积用高饱和色、招牌和背板贴在一个平面上，
// 加上柜台只有 0.88m 高的一个木墩子，看起来像路边摆了个盒子。
//
// 这些 mesh 全是静态的，交给 StaticMerge 合批。招牌每摊一张独立贴图，
// 所以刻意做小（256×64）——几十个摊位加起来也就几 MB 显存。
//
// 摊位不参与相机避让：第三人称镜头从后面推过来时，摊子的碰撞盒会把镜头
// 一下顶到角色后背（相机以为撞墙了）。摊位只有 2m 高、又不是墙，所以
// 碰撞盒标 camera:false，只挡人不挡镜头。

import { useMemo } from 'react'
import * as THREE from 'three'
import { STALL_D, STALL_W, ZONE_BLURB, ZONE_LABEL, signColor, stalls, zoneAnchors, type Stall, type StallZone } from '../data/stalls'
import { useApp } from '../store'

const SIGN_W = 256
const SIGN_H = 64

/** 帆布顶棚的米白：比纯白暖一点，黄昏光下不发灰。 */
const CANVAS = '#e7dfcd'
const CANVAS_DARK = '#d6cbb5'

/** 招牌贴图缓存：每个摊位一张，重复挂载不会重复生成 canvas。 */
const signCache = new Map<string, THREE.CanvasTexture>()

function signTexture(stall: Stall) {
  const hit = signCache.get(stall.id)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = SIGN_W
  canvas.height = SIGN_H
  const ctx = canvas.getContext('2d')!
  // 米白底 + 深色字：夜里街灯照上去也能读，而且不像一块发光的塑料牌
  ctx.fillStyle = '#f2e9d6'
  ctx.fillRect(0, 0, SIGN_W, SIGN_H)
  ctx.strokeStyle = 'rgba(60,52,40,.5)'
  ctx.lineWidth = 3
  ctx.strokeRect(6, 6, SIGN_W - 12, SIGN_H - 12)
  // 底部一条街区的颜色：一眼分得出是广场、夜市还是河岸
  ctx.fillStyle = signColor(stall.zone)
  ctx.fillRect(6, SIGN_H - 16, SIGN_W - 12, 10)
  ctx.fillStyle = '#3a332a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 33px "PingFang SC", "Helvetica Neue", Arial, sans-serif'
  ctx.fillText(stall.title, SIGN_W / 2, SIGN_H / 2 - 4, SIGN_W - 34)
  ctx.font = '500 15px "PingFang SC", "Helvetica Neue", Arial, sans-serif'
  ctx.fillStyle = 'rgba(58,51,42,.62)'
  ctx.textAlign = 'right'
  ctx.fillText(stall.category, SIGN_W - 16, 18)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  signCache.set(stall.id, tex)
  return tex
}

/** 台面上的货：形状和配色按品类走，保证每个摊的台面都不太一样。 */
function goodsOf(stall: Stall) {
  const seed = stall.id.length * 7 + stall.title.charCodeAt(0)
  const palette =
    stall.category === '小吃'
      ? ['#c9843f', '#d8a35a', '#8a4a32', '#e0c48a']
      : stall.category === '花'
        ? ['#d98a9a', '#e8cf6a', '#9d8fd0', '#8fbf8a']
        : stall.category === '小游戏'
          ? ['#c05a3c', '#3f7f9a', '#d8c173', '#7f5ea8']
          : ['#b8a88a', '#8f7a5e', '#7f9a8c', '#c9a06a']
  const list: Array<{ x: number; z: number; w: number; h: number; color: string; shape: 'box' | 'jar' | 'bowl' }> = []
  const count = 4 + (seed % 3)
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const kind = (seed + i) % 5
    list.push({
      x: (t - 0.5) * (STALL_W - 1.05),
      z: -0.06 + ((seed + i) % 3) * 0.07,
      w: 0.14 + ((seed + i * 3) % 4) * 0.026,
      h: 0.1 + ((seed + i * 5) % 5) * 0.035,
      color: palette[(seed + i) % palette.length],
      shape: kind === 0 ? 'jar' : kind === 2 ? 'bowl' : 'box',
    })
  }
  return list
}

/** 木箱：四面木板 + 顶面两道缝。 */
function Crate({ x, z, y = 0, w = 0.46, h = 0.34, rot = 0 }: { x: number; z: number; y?: number; w?: number; h?: number; rot?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, w * 0.76]} />
        <meshStandardMaterial color="#9c7f56" roughness={0.95} />
      </mesh>
      {/* 顶面两块板之间的一道缝 + 一圈包边 */}
      <mesh position={[0, h + 0.004, 0]}>
        <boxGeometry args={[w * 0.98, 0.008, 0.012]} />
        <meshStandardMaterial color="#6d5636" roughness={1} />
      </mesh>
      {[0.03, h - 0.03].map((yy) => (
        <mesh key={yy} position={[0, yy, w * 0.38 + 0.002]}>
          <boxGeometry args={[w * 0.96, 0.03, 0.008]} />
          <meshStandardMaterial color="#836a45" roughness={0.96} />
        </mesh>
      ))}
    </group>
  )
}

/** 篮子：敞口木/藤篮，里面堆几个圆的。 */
function Basket({ x, z, color, y = 0 }: { x: number; z: number; color: string; y?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.22, 14, 1, true]} />
        <meshStandardMaterial color="#a98a5e" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <torusGeometry args={[0.2, 0.018, 6, 18]} />
        <meshStandardMaterial color="#8d6f48" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.08, 0.235 + (i % 2) * 0.03, Math.sin(a) * 0.08]} castShadow>
            <sphereGeometry args={[0.062, 10, 8]} />
            <meshStandardMaterial color={color} roughness={0.75} />
          </mesh>
        )
      })}
    </group>
  )
}

/** 摊位内部的小货架：摊主身后的两三块板，上面摆罐子和盒子。 */
function BackRack({ z, colors }: { z: number; colors: string[] }) {
  return (
    <group position={[0, 0, z]}>
      {[-0.92, 0.92].map((x) => (
        <mesh key={x} position={[x, 0.85, 0]} castShadow>
          <boxGeometry args={[0.07, 1.7, 0.3]} />
          <meshStandardMaterial color="#7d6544" roughness={0.9} />
        </mesh>
      ))}
      {[0.62, 1.16].map((y, ti) => (
        <group key={y}>
          <mesh position={[0, y, 0]} receiveShadow>
            <boxGeometry args={[1.9, 0.045, 0.32]} />
            <meshStandardMaterial color="#8e7350" roughness={0.9} />
          </mesh>
          {[-0.72, -0.4, -0.08, 0.24, 0.56].map((x, i) => (
            <mesh key={x} position={[x, y + 0.1, 0]} castShadow>
              <cylinderGeometry args={[0.055, 0.05, 0.17 + ((ti + i) % 3) * 0.04, 10]} />
              <meshStandardMaterial color={colors[(i + ti) % colors.length]} roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function StallModel({ stall }: { stall: Stall }) {
  const night = useApp((state) => state.night)
  const sign = useMemo(() => signTexture(stall), [stall.id, stall.title, stall.category, stall.zone])
  const goods = useMemo(() => goodsOf(stall), [stall.id])
  const seed = stall.id.length + stall.title.length

  // 顶棚前低后高：后沿 2.72m，前沿 2.42m，落差 0.3m 摊在 1.9m 进深上。
  // 净高必须让 1.75m 的人能站在柜台前抬头看招牌（招牌底 2.02m），
  // 早期版本顶棚只有 2.34m、招牌吊在 1.63m，走过摊前正好撞一脸。
  const TILT = 0.15
  const canopyY = 2.57
  const wood = stall.wood
  const cloth = stall.color

  return (
    <group position={[stall.x, 0, stall.z]} rotation={[0, stall.yaw, 0]}>
      {/* 地面：一块旧油布，把摊位从铺装上"落"下来 */}
      <mesh position={[0, 0.011, -0.12]} receiveShadow>
        <boxGeometry args={[STALL_W - 0.14, 0.018, STALL_D + 0.24]} />
        <meshStandardMaterial color="#6f665a" roughness={0.98} />
      </mesh>

      {/* 柜台：木柜体 + 浅色台面 + 布裙（布裙才是这条街的颜色） */}
      <mesh position={[0, 0.44, 0.12]} castShadow receiveShadow>
        <boxGeometry args={[STALL_W - 0.65, 0.8, 0.62]} />
        <meshStandardMaterial color={wood} roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.865, 0.12]} castShadow receiveShadow>
        <boxGeometry args={[STALL_W - 0.55, 0.05, 0.72]} />
        <meshStandardMaterial color="#dccdb0" roughness={0.72} />
      </mesh>
      {/* 布裙：前面一层，底下一道米白边 */}
      <mesh position={[0, 0.44, 0.44]}>
        <boxGeometry args={[STALL_W - 0.67, 0.7, 0.02]} />
        <meshStandardMaterial color={cloth} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.13, 0.452]}>
        <boxGeometry args={[STALL_W - 0.67, 0.08, 0.02]} />
        <meshStandardMaterial color={CANVAS} roughness={0.96} />
      </mesh>
      {/* 柜台上的一圈挡板，防止货往后滑（也让台面看起来不是一块板） */}
      <mesh position={[0, 0.92, -0.2]}>
        <boxGeometry args={[STALL_W - 0.6, 0.07, 0.03]} />
        <meshStandardMaterial color={wood} roughness={0.9} />
      </mesh>

      {/* 四根立杆：后两根高，前两根低 */}
      {[
        [-STALL_W / 2 + 0.1, 0.72, 2.42],
        [STALL_W / 2 - 0.1, 0.72, 2.42],
        [-STALL_W / 2 + 0.1, -1.0, 2.72],
        [STALL_W / 2 - 0.1, -1.0, 2.72],
      ].map(([x, z, h], i) => (
        <mesh key={i} position={[x, h / 2, z]} castShadow>
          <cylinderGeometry args={[0.028, 0.034, h, 7]} />
          <meshStandardMaterial color="#8b8172" metalness={0.25} roughness={0.6} />
        </mesh>
      ))}

      {/* 帆布顶棚：两块薄板叠出布的厚度，整体前倾 */}
      <mesh position={[0, canopyY, -0.12]} rotation={[TILT, 0, 0]} castShadow>
        <boxGeometry args={[STALL_W + 0.06, 0.035, 2.0]} />
        <meshStandardMaterial color={CANVAS} roughness={0.97} />
      </mesh>
      <mesh position={[0, canopyY - 0.028, -0.12]} rotation={[TILT, 0, 0]}>
        <boxGeometry args={[STALL_W - 0.1, 0.02, 1.9]} />
        <meshStandardMaterial color={CANVAS_DARK} roughness={1} />
      </mesh>

      {/* 前沿布幡：薄薄一条挂在棚檐下，只做收边，不挡招牌 */}
      <group position={[0, 2.46, 0.86]} rotation={[TILT, 0, 0]}>
        <mesh position={[0, -0.06, 0]} castShadow>
          <boxGeometry args={[STALL_W + 0.04, 0.12, 0.02]} />
          <meshStandardMaterial color={cloth} roughness={0.97} />
        </mesh>
        <mesh position={[0, -0.125, 0.001]}>
          <boxGeometry args={[STALL_W + 0.04, 0.025, 0.022]} />
          <meshStandardMaterial color={CANVAS} roughness={0.97} />
        </mesh>
      </group>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * (STALL_W / 2 + 0.005), 2.55, -0.14]} rotation={[TILT, 0, 0]}>
          <mesh position={[0, -0.11, 0]} castShadow>
            <boxGeometry args={[0.018, 0.22, 1.98]} />
            <meshStandardMaterial color={cloth} roughness={0.97} />
          </mesh>
        </group>
      ))}

      {/* 招牌：钉在棚檐下沿，底边 2.02m。走过摊前不会撞头，
          街灯照在米白底上，字是深色的，夜里也不糊。 */}
      <group position={[0, 2.22, 0.9]} rotation={[-0.06, 0, 0]}>
        <mesh position={[0, 0, -0.016]} castShadow>
          <boxGeometry args={[1.7, 0.42, 0.026]} />
          <meshStandardMaterial color="#4a4238" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[1.6, 0.37]} />
          <meshBasicMaterial map={sign} toneMapped={false} />
        </mesh>
      </group>
      {/* 两根吊绳：从棚檐垂下来 */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 2.44, 0.89]}>
          <cylinderGeometry args={[0.006, 0.006, 0.1, 4]} />
          <meshBasicMaterial color="#3d3931" />
        </mesh>
      ))}

      {/* 台面上的货：按品类给形状 */}
      {goods.map((g, i) => {
        const y = 0.89
        if (g.shape === 'jar')
          return (
            <mesh key={i} position={[g.x, y + g.h / 2, g.z + 0.06]} castShadow>
              <cylinderGeometry args={[g.w * 0.36, g.w * 0.32, g.h, 10]} />
              <meshStandardMaterial color={g.color} roughness={0.6} metalness={0.1} />
            </mesh>
          )
        if (g.shape === 'bowl')
          return (
            <mesh key={i} position={[g.x, y + g.h * 0.3, g.z + 0.06]} castShadow>
              <cylinderGeometry args={[g.w * 0.5, g.w * 0.3, g.h * 0.6, 12, 1, true]} />
              <meshStandardMaterial color={g.color} roughness={0.85} side={THREE.DoubleSide} />
            </mesh>
          )
        return (
          <mesh key={i} position={[g.x, y + g.h / 2, g.z + 0.06]} rotation={[0, ((seed + i) % 5) * 0.12, 0]} castShadow>
            <boxGeometry args={[g.w, g.h, g.w * 0.78]} />
            <meshStandardMaterial color={g.color} roughness={0.88} />
          </mesh>
        )
      })}

      {/* 篮子摆在摊子侧面的地上（柜台前面要留给人站） */}
      {(stall.category === '小吃' || stall.category === '花') && (
        <Basket
          x={-1.12}
          z={0.42}
          color={stall.category === '花' ? '#c9c072' : '#c06a3a'}
        />
      )}

      {/* 摊主身后的货架 */}
      <BackRack z={-0.98} colors={[stall.color, '#c9a06a', '#7f9a8c', '#b4763f']} />

      {/* 地上的木箱：两三个叠在侧面，被柜台挡掉一半 */}
      <Crate x={-1.15} z={0.3} w={0.32} h={0.3} rot={0.22} />
      <Crate x={-1.14} z={0.26} y={0.3} w={0.28} h={0.24} rot={-0.14} />
      <Crate x={1.16} z={0.31} w={0.3} h={0.26} rot={-0.32} />
      <Basket x={1.12} z={-0.5} color="#b8a073" />

      {/* 摊主坐的板凳：让开中间给摊主站，板凳挪到一侧 */}
      <group position={[0.68, 0, -0.55]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.16, 0.05, 12]} />
          <meshStandardMaterial color="#6d5a44" roughness={0.9} />
        </mesh>
        {[
          [-0.1, -0.1],
          [0.1, -0.1],
          [-0.1, 0.1],
          [0.1, 0.1],
        ].map(([lx, lz], i) => (
          <mesh key={i} position={[lx, 0.21, lz]}>
            <cylinderGeometry args={[0.016, 0.016, 0.42, 5]} />
            <meshStandardMaterial color="#5a4a38" roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* 夜里：布幡下一串小球灯，只发光不点灯（几十个摊位不能每个都加光源） */}
      {night && (
        <>
          {[-0.9, -0.3, 0.3, 0.9].map((x) => (
            <mesh key={x} position={[x, 2.34, 0.55]}>
              <sphereGeometry args={[0.042, 8, 8]} />
              <meshStandardMaterial color="#ffe7bd" emissive="#ffbc66" emissiveIntensity={2.6} toneMapped={false} />
            </mesh>
          ))}
          <mesh position={[0, 2.385, 0.55]} rotation={[0.1, 0, 0]}>
            <boxGeometry args={[2.1, 0.01, 0.01]} />
            <meshBasicMaterial color="#4a443c" />
          </mesh>
        </>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 区牌与彩旗
// ---------------------------------------------------------------------------

const zoneSignCache = new Map<string, THREE.CanvasTexture>()

/** 区牌：市集名 + 一句介绍。和摊位招牌同一套米白底 + 深字。 */
function zoneSignTexture(zone: keyof typeof ZONE_LABEL) {
  const hit = zoneSignCache.get(zone)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f2e9d6'
  ctx.fillRect(0, 0, 512, 160)
  ctx.strokeStyle = 'rgba(60,52,40,.55)'
  ctx.lineWidth = 5
  ctx.strokeRect(8, 8, 496, 144)
  ctx.fillStyle = signColor(zone)
  ctx.fillRect(8, 8, 496, 14)
  ctx.fillRect(8, 138, 496, 14)
  ctx.fillStyle = '#37302a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 52px "PingFang SC", "Helvetica Neue", Arial, sans-serif'
  ctx.fillText(ZONE_LABEL[zone], 256, 68)
  ctx.font = '400 20px "PingFang SC", "Helvetica Neue", Arial, sans-serif'
  ctx.fillStyle = 'rgba(55,48,42,.66)'
  ctx.fillText(ZONE_BLURB[zone], 256, 112)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  zoneSignCache.set(zone, tex)
  return tex
}

/** 区牌：两根木柱 + 一块牌，立在市集入口，抬头就能看见这条街卖什么。 */
function ZoneSign({ zone, x, z, yaw }: { zone: keyof typeof ZONE_LABEL; x: number; z: number; yaw: number }) {
  const tex = useMemo(() => zoneSignTexture(zone), [zone])
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {[-0.62, 0.62].map((px) => (
        <mesh key={px} position={[px, 1.05, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.055, 2.1, 8]} />
          <meshStandardMaterial color="#6d5942" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 1.72, 0]} castShadow>
        <boxGeometry args={[1.68, 0.56, 0.05]} />
        <meshStandardMaterial color="#4a4238" roughness={0.86} />
      </mesh>
      <mesh position={[0, 1.72, 0.028]}>
        <planeGeometry args={[1.6, 0.5]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* 牌顶的一道小屋檐：下雨时不至于把字泡花 */}
      <mesh position={[0, 2.04, 0.04]} rotation={[0.18, 0, 0]} castShadow>
        <boxGeometry args={[1.8, 0.04, 0.3]} />
        <meshStandardMaterial color={signColor(zone)} roughness={0.9} />
      </mesh>
      {/* 地上两只石墩，把柱子"落"在地上 */}
      {[-0.62, 0.62].map((px) => (
        <mesh key={`b${px}`} position={[px, 0.09, 0]}>
          <cylinderGeometry args={[0.16, 0.19, 0.18, 10]} />
          <meshStandardMaterial color="#8b8579" roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

/** 彩旗：一串小三角挂绳，把相邻两个摊连起来，市集感全靠它。 */
function Bunting({ from, to, color }: { from: Stall; to: Stall; color: string }) {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const len = Math.hypot(dx, dz)
  if (len < 2 || len > 9) return null
  const yaw = Math.atan2(dx, dz)
  const mx = (from.x + to.x) / 2
  const mz = (from.z + to.z) / 2
  // 绳子在两端 3.05m、中段下垂 0.22m：用三段直线近似
  const segs = 3
  const ys = [3.05, 3.02, 3.02, 3.05]
  const flags = Math.max(3, Math.round(len / 0.85))
  return (
    <group>
      {Array.from({ length: segs }).map((_, i) => {
        const t0 = i / segs - 0.5
        const t1 = (i + 1) / segs - 0.5
        const p0x = mx + Math.sin(yaw) * t0 * len
        const p0z = mz + Math.cos(yaw) * t0 * len
        const p1x = mx + Math.sin(yaw) * t1 * len
        const p1z = mz + Math.cos(yaw) * t1 * len
        const y0 = ys[i]
        const y1 = ys[i + 1]
        const sl = Math.hypot(p1x - p0x, p1z - p0z, y1 - y0)
        const midY = (y0 + y1) / 2
        const tilt = Math.atan2(y1 - y0, Math.hypot(p1x - p0x, p1z - p0z))
        return (
          <mesh
            key={i}
            position={[(p0x + p1x) / 2, midY - 0.1, (p0z + p1z) / 2]}
            rotation={[Math.PI / 2 - tilt, yaw, 0]}
          >
            <cylinderGeometry args={[0.008, 0.008, sl, 4]} />
            <meshBasicMaterial color="#4a443c" />
          </mesh>
        )
      })}
      {Array.from({ length: flags }).map((_, i) => {
        const t = (i + 0.5) / flags - 0.5
        const x = mx + Math.sin(yaw) * t * len
        const z = mz + Math.cos(yaw) * t * len
        // 悬链：中点最低
        const sag = 0.22 * (1 - (2 * t) ** 2)
        return (
          <mesh key={`f${i}`} position={[x, 3.0 - sag - 0.1, z]} rotation={[Math.PI, yaw, 0]}>
            <coneGeometry args={[0.11, 0.24, 3, 1]} />
            <meshStandardMaterial
              color={i % 2 ? color : '#e7dfcd'}
              roughness={0.95}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
    </group>
  )
}

/** 每个区里相邻的两个摊（按距离串起来），彩旗只挂在同一区内部。 */
function buntingPairs() {
  const out: Array<{ from: Stall; to: Stall; color: string }> = []
  const byZone = new Map<string, Stall[]>()
  for (const stall of stalls) {
    const list = byZone.get(stall.zone) || []
    list.push(stall)
    byZone.set(stall.zone, list)
  }
  for (const list of byZone.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const d = Math.hypot(list[i].x - list[j].x, list[i].z - list[j].z)
        // 相邻两个摊（5~7.5m）之间挂一串彩旗；再远就不是"同一排"了。
        if (d <= 7.8) out.push({ from: list[i], to: list[j], color: list[i].color })
      }
    }
  }
  return out
}

const marketTexCache = new Map<string, THREE.CanvasTexture>()

/** 市集铺装：暖灰石板 + 一圈压边，说明"这一片是摆摊的地方"。 */
function marketTexture() {
  const hit = marketTexCache.get('paving')
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#b8a68c'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(96,82,64,.28)'
  ctx.lineWidth = 2
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 256)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(256, i)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  marketTexCache.set('paving', tex)
  return tex
}

/** 雪松巷和中巷本来就有铺装（Ground.tsx 里铺的），不再盖一层。 */
const PRE_PAVED: StallZone[] = ['cedar', 'alley']

/** 外围市集脚下的一块铺装，把"摊子"和"人行道"分开。 */
function ZoneGround({ zone }: { zone: StallZone }) {
  const tex = useMemo(() => marketTexture(), [])
  const box = useMemo(() => {
    const list = stalls.filter((s) => s.zone === zone)
    if (!list.length) return null
    const xs = list.map((s) => s.x)
    const zs = list.map((s) => s.z)
    // 一条街排开的市集（西岸、东岸）：横向多留一点，让人能站在摊前看货。
    const pad = 2.6
    const minX = Math.min(...xs) - pad
    const maxX = Math.max(...xs) + pad
    const minZ = Math.min(...zs) - pad
    const maxZ = Math.max(...zs) + pad
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ }
  }, [zone])
  if (!box || PRE_PAVED.includes(zone)) return null
  return (
    <group>
      <mesh position={[box.x, 0.048, box.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[box.w, box.d]} />
        <meshStandardMaterial map={tex} color="#e6d8c2" roughness={0.96} />
      </mesh>
      {/* 四边的压条：铺装边缘收一下口，不然像一张贴纸 */}
      {[
        { pos: [box.x, 0.054, box.z - box.d / 2] as [number, number, number], size: [box.w, 0.09] },
        { pos: [box.x, 0.054, box.z + box.d / 2] as [number, number, number], size: [box.w, 0.09] },
      ].map((edge, i) => (
        <mesh key={`h${i}`} position={edge.pos} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[edge.size[0], edge.size[1]]} />
          <meshStandardMaterial color="#8d7a60" roughness={0.98} />
        </mesh>
      ))}
      {[
        { pos: [box.x - box.w / 2, 0.054, box.z] as [number, number, number] },
        { pos: [box.x + box.w / 2, 0.054, box.z] as [number, number, number] },
      ].map((edge, i) => (
        <mesh key={`v${i}`} position={edge.pos} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.09, box.d]} />
          <meshStandardMaterial color="#8d7a60" roughness={0.98} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * 外围市集的"街具"：一盏市集灯、一张长椅、两个花池。
 *
 * 中心那三个区周围本来就有路灯和长椅，外围的市集（西岸大道、东岸广场）是
 * 空地，只有摊子会显得像"临时摆的"。补上这几件，市集才像规划出来的。
 */
const EDGE_ZONES: StallZone[] = ['riverwalk', 'dock', 'west', 'east']

function MarketEdge({ zone }: { zone: StallZone }) {
  const night = useApp((state) => state.night)
  const layout = useMemo(() => {
    const list = stalls.filter((s) => s.zone === zone)
    if (list.length < 2) return null
    const yaw = list[0].yaw
    const back = { x: -Math.sin(yaw), z: -Math.cos(yaw) }
    const along = { x: Math.cos(yaw), z: -Math.sin(yaw) }
    const proj = list.map((s) => s.x * along.x + s.z * along.z)
    const lo = list[proj.indexOf(Math.min(...proj))]
    const hi = list[proj.indexOf(Math.max(...proj))]
    const mid = list[Math.floor(list.length / 2)]
    const at = (stall: Stall, backOff: number, alongOff = 0) => ({
      x: stall.x + back.x * backOff + along.x * alongOff,
      z: stall.z + back.z * backOff + along.z * alongOff,
    })
    return {
      yaw,
      lamps: [at(lo, 2.1, -1.4), at(hi, 2.1, 1.4)],
      bench: at(mid, 2.4),
      planters: [at(lo, 3.2, -2.6), at(hi, 3.2, 2.6)],
    }
  }, [zone])
  if (!layout) return null
  return (
    <group>
      {layout.lamps.map((p, i) => (
        <group key={`l${i}`} position={[p.x, 0, p.z]}>
          <mesh position={[0, 1.55, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.075, 3.1, 8]} />
            <meshStandardMaterial color="#4d4a44" roughness={0.7} metalness={0.35} />
          </mesh>
          <mesh position={[0, 3.16, 0]}>
            <cylinderGeometry args={[0.26, 0.14, 0.2, 10]} />
            <meshStandardMaterial color="#3f3c37" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[0, 3.05, 0]}>
            <sphereGeometry args={[0.11, 8, 6]} />
            {night ? (
              <meshBasicMaterial color="#ffe2b0" toneMapped={false} />
            ) : (
              <meshStandardMaterial color="#d9d3c4" roughness={0.5} />
            )}
          </mesh>
        </group>
      ))}
      {/* 长椅：木板 + 两条铸铁腿，朝摊位那一面 */}
      <group position={[layout.bench.x, 0, layout.bench.z]} rotation={[0, layout.yaw + Math.PI, 0]}>
        {[-0.6, 0.6].map((dx) => (
          <mesh key={dx} position={[dx, 0.2, 0]}>
            <boxGeometry args={[0.08, 0.4, 0.42]} />
            <meshStandardMaterial color="#4a4741" roughness={0.7} metalness={0.3} />
          </mesh>
        ))}
        {[0, 0.06, 0.12].map((dy) => (
          <mesh key={dy} position={[0, 0.4 + dy, 0]} castShadow>
            <boxGeometry args={[1.5, 0.04, 0.13]} />
            <meshStandardMaterial color="#8a6a48" roughness={0.92} />
          </mesh>
        ))}
      </group>
      {layout.planters.map((p, i) => (
        <group key={`p${i}`} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.24, 0]} castShadow>
            <boxGeometry args={[0.9, 0.48, 0.5]} />
            <meshStandardMaterial color="#8d8579" roughness={0.96} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.78, 0.1, 0.38]} />
            <meshStandardMaterial color="#4a3f2f" roughness={1} />
          </mesh>
          {[-0.24, 0, 0.24].map((dx) => (
            <mesh key={dx} position={[dx, 0.66, 0]}>
              <sphereGeometry args={[0.17, 7, 6]} />
              <meshStandardMaterial color={i ? '#6f8a52' : '#7f9a5c'} roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** 全部市集区：从摊位数据里摘，加一个区就不用改这里。 */
const ZONES = [...new Set(stalls.map((s) => s.zone))]

export function Stalls() {
  // 招牌贴图是模块级缓存：卸载时不 dispose，避免反复进出场景重复生成 canvas。
  const flags = useMemo(() => buntingPairs(), [])
  return (
    <group>
      {ZONES.map((zone) => (
        <ZoneGround key={zone} zone={zone} />
      ))}
      {EDGE_ZONES.map((zone) => (
        <MarketEdge key={`edge-${zone}`} zone={zone} />
      ))}
      {stalls.map((stall) => (
        <StallModel key={stall.id} stall={stall} />
      ))}
      {zoneAnchors.map((a) => (
        <ZoneSign key={a.zone} zone={a.zone} x={a.x} z={a.z} yaw={a.yaw} />
      ))}
      {flags.map((f, i) => (
        <Bunting key={i} from={f.from} to={f.to} color={f.color} />
      ))}
    </group>
  )
}

/** 摊位占地的碰撞盒：柜台 + 货箱那一圈，客人一侧留空。 */
export function stallColliders() {
  return stalls.map((stall) => {
    const c = Math.cos(stall.yaw)
    const s = Math.sin(stall.yaw)
    // 局部矩形：x ±(STALL_W/2)，z 从后货架到柜台前沿
    const halfW = STALL_W / 2
    const z0 = -STALL_D / 2 - 0.55
    const z1 = 0.5
    const pts = [
      [-halfW, z0],
      [halfW, z0],
      [-halfW, z1],
      [halfW, z1],
    ].map(([lx, lz]) => ({ x: stall.x + lx * c + lz * s, z: stall.z - lx * s + lz * c }))
    return {
      minX: Math.min(...pts.map((p) => p.x)),
      maxX: Math.max(...pts.map((p) => p.x)),
      minZ: Math.min(...pts.map((p) => p.z)),
      maxZ: Math.max(...pts.map((p) => p.z)),
      minY: 0,
      maxY: 2.2,
      // 摊位只有两米多高、又不是墙：镜头从后面推过来时不该被它挡住拉近。
      camera: false,
    }
  })
}

/** 摊位正面的交互点：离柜台 1.1m，站在客人那一侧。 */
export function stallFront(stall: Stall) {
  return {
    x: stall.x + Math.sin(stall.yaw) * 1.25,
    z: stall.z + Math.cos(stall.yaw) * 1.25,
  }
}
