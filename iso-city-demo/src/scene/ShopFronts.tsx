// 沿街店铺的门头装饰。
//
// 店里是一套陈列，街上也要能一眼分出"这是哪家店"：雨棚、竖招牌、门口那堆
// 东西（面包筐 / 花桶 / 冰柜 / 唱片箱 / 杂志架 / 红灯笼 / 竹帘）都按业态分别做，
// 而不是给每家挂同一块招牌。
//
// 坐标系来自 data/shops.ts 的 shopFacade()：原点在店面外墙中心，
// 局部 +Z 朝街外、+X 沿墙、y=0 是地面。换楼、换朝哪一面都不用改。

import * as THREE from 'three'
import { useMemo } from 'react'
import { shopFacade, shops, type ShopDef, type ShopKind } from '../data/shops'

/** 各业态的竖招牌用字（竖排）。 */
const BLADE_TEXT: Record<ShopKind, string> = {
  bakery: '面包',
  florist: '花',
  konbini: '便利店',
  record: '唱片',
  zine: '纸品',
  noodle: '面',
  tea: '茶',
}

const bladeCache = new Map<string, THREE.CanvasTexture>()

/** 竖招牌贴图：底色用店铺雨棚色，字竖排。 */
function bladeTexture(shop: ShopDef) {
  const hit = bladeCache.get(shop.id)
  if (hit) return hit
  const text = [...BLADE_TEXT[shop.kind]]
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  // 竖招是"一块布 + 两个字"：底色纯、字大、边框硬。
  // 之前字只有 40~62px，在 0.44m 宽的牌子上糊成一小团。
  ctx.fillStyle = shop.palette.awning
  ctx.fillRect(0, 0, 128, 256)
  ctx.strokeStyle = 'rgba(255,255,255,.4)'
  ctx.lineWidth = 5
  ctx.strokeRect(8, 8, 112, 240)
  ctx.fillStyle = '#fff8ea'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const step = 196 / text.length
  const size = Math.min(84, step * 0.74)
  ctx.font = `700 ${size}px "PingFang SC", "Helvetica Neue", Arial, sans-serif`
  text.forEach((ch, i) => ctx.fillText(ch, 64, 30 + step * (i + 0.5)))
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  bladeCache.set(shop.id, tex)
  return tex
}

const stripeCache = new Map<string, THREE.CanvasTexture>()

/** 条纹布：面包房 / 花店 / 面馆的雨棚用条纹，其他用纯色。 */
function stripeTexture(a: string, b: string) {
  const key = a + b
  const hit = stripeCache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = a
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = b
  for (let i = 0; i < 4; i++) ctx.fillRect(i * 32, 0, 16, 128)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  stripeCache.set(key, tex)
  return tex
}

const STRIPED: ShopKind[] = ['bakery', 'florist', 'noodle']

/** 门口那块 A 字黑板。 */
function Chalkboard({ x, z, yaw }: { x: number; z: number; yaw: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.42, 0.09]} rotation={[0.2, 0, 0]} castShadow>
        <boxGeometry args={[0.52, 0.78, 0.035]} />
        <meshStandardMaterial color="#8a6a45" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.42, -0.09]} rotation={[-0.2, 0, 0]} castShadow>
        <boxGeometry args={[0.52, 0.78, 0.035]} />
        <meshStandardMaterial color="#8a6a45" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.45, 0.112]} rotation={[0.2, 0, 0]}>
        <planeGeometry args={[0.42, 0.6]} />
        <meshStandardMaterial color="#2f2b27" roughness={0.98} />
      </mesh>
      {[0.52, 0.42, 0.33].map((y, i) => (
        <mesh key={y} position={[0, y, 0.115]} rotation={[0.2, 0, 0]}>
          <planeGeometry args={[[0.28, 0.34, 0.22][i], 0.028]} />
          <meshBasicMaterial color={i ? '#cfc7b5' : '#e8e2d2'} />
        </mesh>
      ))}
    </group>
  )
}

/** 小木箱。 */
function Crate({ x, z, yaw = 0, w = 0.5, h = 0.32, color = '#9a7a52' }: { x: number; z: number; yaw?: number; w?: number; h?: number; color?: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, w * 0.72]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, h * 0.72, (s * w * 0.72) / 2 + 0.005]}>
          <planeGeometry args={[w * 0.86, h * 0.16]} />
          <meshStandardMaterial color="#6d5334" roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

/** 花球。 */
function Bloom({ x, y, z, color, r = 0.1 }: { x: number; y: number; z: number; color: string; r?: number }) {
  return (
    <mesh position={[x, y, z]}>
      <sphereGeometry args={[r, 7, 6]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  )
}

/** 铁皮桶。 */
function Bucket({ x, z, h = 0.4, r = 0.16, color = '#9aa3a6' }: { x: number; z: number; h?: number; r?: number; color?: string }) {
  return (
    <mesh position={[x, h / 2, z]} castShadow>
      <cylinderGeometry args={[r, r * 0.86, h, 10]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.35} />
    </mesh>
  )
}

/** 暖色灯串。 */
function BulbString({ w, z, y, n = 7 }: { w: number; z: number; y: number; n?: number }) {
  return (
    <group>
      {Array.from({ length: n }).map((_, i) => {
        const t = (i + 0.5) / n
        return (
          <mesh key={i} position={[-w / 2 + t * w, y - 0.06 - Math.sin(t * Math.PI) * 0.05, z]}>
            <sphereGeometry args={[0.045, 6, 5]} />
            <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* 各家店门口的"地堆"                                                          */
/* -------------------------------------------------------------------------- */

function Bakery({ w, doorX }: { w: number; doorX: number }) {
  const side = doorX < 0 ? 1 : -1
  const bx = doorX + side * (w / 2 - 1.0)
  return (
    <>
      <Chalkboard x={bx} z={1.35} yaw={side * 0.5} />
      <Crate x={bx - side * 0.9} z={1.0} w={0.56} h={0.34} color="#a8855a" />
      <Crate x={bx - side * 0.9} z={1.0} yaw={0.1} w={0.44} h={0.18} color="#b89262" />
      {[-0.1, 0.06, 0.18].map((dx, i) => (
        <Bloom key={i} x={bx - side * 0.9 + dx} y={0.58} z={1.0} color={i % 2 ? '#c98f4e' : '#d8a15f'} r={0.075} />
      ))}
      {/* 靠墙的面粉袋 */}
      <mesh position={[doorX - side * 1.5, 0.3, 0.55]} rotation={[0, 0.2, 0.06]} castShadow>
        <cylinderGeometry args={[0.17, 0.2, 0.6, 9]} />
        <meshStandardMaterial color="#e6dcc4" roughness={0.98} />
      </mesh>
      <BulbString w={Math.min(w - 0.8, 4.4)} z={0.72} y={2.72} />
      {/* 门边挂的一束干麦穗 */}
      {[-0.2, 0, 0.2].map((dx) => (
        <mesh key={dx} position={[doorX + side * 1.05 + dx, 2.55, 0.34]} rotation={[0, 0, dx * 2]}>
          <coneGeometry args={[0.03, 0.22, 4]} />
          <meshStandardMaterial color="#c9a35a" roughness={0.9} />
        </mesh>
      ))}
    </>
  )
}

function Florist({ w, doorX }: { w: number; doorX: number }) {
  const side = doorX < 0 ? 1 : -1
  const bx = doorX + side * (w / 2 - 0.8)
  const warm = ['#d98a9a', '#e4c368', '#e9e3d6', '#b46f8f', '#d8a05a']
  return (
    <>
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <Bucket x={bx - side * i * 0.36} z={0.95 + i * 0.12} h={0.42} color={i === 1 ? '#8f9a95' : '#a8b0ad'} />
          {[0, 1, 2].map((k) => (
            <group key={k}>
              <mesh position={[bx - side * i * 0.36, 0.6, 0.95 + i * 0.12]} rotation={[0, k, k * 0.2]}>
                <cylinderGeometry args={[0.008, 0.008, 0.34, 4]} />
                <meshStandardMaterial color="#5d7a52" roughness={0.9} />
              </mesh>
              <Bloom
                x={bx - side * i * 0.36 + Math.cos(k * 2) * 0.06}
                y={0.78 + k * 0.04}
                z={0.95 + i * 0.12 + Math.sin(k * 2) * 0.06}
                color={warm[(i + k) % warm.length]}
                r={0.085}
              />
            </group>
          ))}
        </group>
      ))}
      {/* 靠墙一排小盆 */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[doorX - side * (1.35 + i * 0.32), 0.16, 0.4]} castShadow>
          <cylinderGeometry args={[0.15, 0.12, 0.28, 9]} />
          <meshStandardMaterial color="#c8b49a" roughness={0.95} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <Bloom key={`b${i}`} x={doorX - side * (1.35 + i * 0.32)} y={0.38} z={0.4} color={warm[i]} r={0.12} />
      ))}
      {/* 挂起来的一束干花 */}
      <mesh position={[doorX + side * 1.25, 2.5, 0.2]}>
        <cylinderGeometry args={[0.02, 0.11, 0.38, 6]} />
        <meshStandardMaterial color="#b79a63" roughness={0.95} />
      </mesh>
    </>
  )
}

function Konbini({ w, doorX }: { w: number; doorX: number }) {
  const side = doorX < 0 ? 1 : -1
  const bx = doorX + side * (w / 2 - 1.15)
  return (
    <>
      {/* 门口冰柜 */}
      <mesh position={[bx, 0.42, 0.72]} castShadow>
        <boxGeometry args={[0.78, 0.84, 0.56]} />
        <meshStandardMaterial color="#eef1f2" roughness={0.6} />
      </mesh>
      <mesh position={[bx, 0.87, 0.72]}>
        <boxGeometry args={[0.8, 0.06, 0.58]} />
        <meshStandardMaterial color="#3f7f9a" roughness={0.5} />
      </mesh>
      <mesh position={[bx, 0.5, 1.005]}>
        <planeGeometry args={[0.56, 0.4]} />
        <meshStandardMaterial color="#cfe4ec" roughness={0.3} metalness={0.1} />
      </mesh>
      <Crate x={bx + side * 0.95} z={0.95} w={0.5} h={0.3} color="#8fa2ab" />
      <Crate x={bx + side * 0.95} z={0.95} yaw={0.14} w={0.4} h={0.2} color="#9db0b8" />
      {/* 门边的营业立牌 */}
      <group position={[doorX - side * 1.25, 0, 0.85]} rotation={[0, -side * 0.25, 0]}>
        <mesh position={[0, 0.44, 0]} castShadow>
          <boxGeometry args={[0.36, 0.88, 0.04]} />
          <meshStandardMaterial color="#f3f5f4" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.62, 0.028]}>
          <planeGeometry args={[0.28, 0.2]} />
          <meshBasicMaterial color="#2f6d86" toneMapped={false} />
        </mesh>
      </group>
      {/* 窗上的海报 */}
      {[-0.55, 0, 0.55].map((dx, i) => (
        <mesh key={dx} position={[doorX + side * (1.9 + dx), 1.7, 0.16]}>
          <planeGeometry args={[0.32, 0.44]} />
          <meshStandardMaterial color={['#e2d6b8', '#c9dbe4', '#e6c9c2'][i]} roughness={0.9} />
        </mesh>
      ))}
      <BulbString w={Math.min(w - 0.8, 4.4)} z={0.72} y={2.72} n={8} />
    </>
  )
}

function RecordShop({ w, doorX }: { w: number; doorX: number }) {
  const side = doorX < 0 ? 1 : -1
  const bx = doorX + side * (w / 2 - 0.9)
  return (
    <>
      <Crate x={bx} z={1.0} w={0.56} h={0.36} color="#4a4038" />
      {[-0.18, -0.06, 0.06, 0.18].map((dx, i) => (
        <mesh key={dx} position={[bx + dx, 0.52, 1.0]} rotation={[0, 0, -0.06 + i * 0.04]}>
          <boxGeometry args={[0.03, 0.34, 0.34]} />
          <meshStandardMaterial color={['#c08a4f', '#8f3f2c', '#d9cfbb', '#5d7264'][i]} roughness={0.9} />
        </mesh>
      ))}
      <Crate x={bx - side * 0.85} z={0.9} w={0.44} h={0.24} color="#4a4038" />
      {/* 墙边音箱 */}
      <mesh position={[doorX - side * 1.4, 0.36, 0.55]} castShadow>
        <boxGeometry args={[0.42, 0.72, 0.34]} />
        <meshStandardMaterial color="#2b2b2e" roughness={0.7} />
      </mesh>
      <mesh position={[doorX - side * 1.4, 0.5, 0.725]}>
        <circleGeometry args={[0.11, 12]} />
        <meshStandardMaterial color="#57534d" roughness={0.65} />
      </mesh>
      {/* 招牌下沿的灯带 */}
      <mesh position={[0, 2.62, 0.2]}>
        <boxGeometry args={[Math.min(w - 1, 4), 0.05, 0.04]} />
        <meshBasicMaterial color="#c08a4f" toneMapped={false} />
      </mesh>
    </>
  )
}

function ZineShop({ w, doorX }: { w: number; doorX: number }) {
  const side = doorX < 0 ? 1 : -1
  const bx = doorX + side * (w / 2 - 0.85)
  return (
    <>
      {/* 杂志架 */}
      <group position={[bx, 0, 0.9]} rotation={[0, side * 0.3, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.72, 0.06, 0.34]} />
          <meshStandardMaterial color="#8c8375" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.88, 0]} castShadow>
          <boxGeometry args={[0.72, 0.06, 0.3]} />
          <meshStandardMaterial color="#8c8375" roughness={0.9} />
        </mesh>
        {[-0.28, 0, 0.28].map((dx) => (
          <mesh key={dx} position={[dx, 0.36, 0]}>
            <boxGeometry args={[0.04, 0.92, 0.04]} />
            <meshStandardMaterial color="#6f6658" roughness={0.9} />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={`p${i}`} position={[-0.27 + i * 0.18, 0.6, 0.02]} rotation={[0, 0, 0.04]}>
            <boxGeometry args={[0.15, 0.16, 0.02]} />
            <meshStandardMaterial color={['#d8cdb6', '#c9a9a0', '#a9bcc4', '#e0d29e'][i]} roughness={0.92} />
          </mesh>
        ))}
      </group>
      {/* 墙上的拼贴海报 */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[doorX - side * (1.3 + i * 0.5), 1.55 + (i % 2) * 0.22, 0.13]} rotation={[0, 0, i % 2 ? 0.04 : -0.03]}>
          <planeGeometry args={[0.34, 0.46]} />
          <meshStandardMaterial color={['#d9cdb4', '#b9c7c2', '#cabfae'][i]} roughness={0.95} />
        </mesh>
      ))}
      <Chalkboard x={doorX + side * 1.55} z={1.15} yaw={side * 0.35} />
    </>
  )
}

function NoodleShop({ shop, w, doorX }: { shop: ShopDef; w: number; doorX: number }) {
  const side = doorX < 0 ? 1 : -1
  return (
    <>
      {/* 门上的暖帘 */}
      {[-0.5, 0, 0.5].map((dx) => (
        <mesh key={dx} position={[doorX + dx, 2.2, 0.22]}>
          <planeGeometry args={[0.45, 0.62]} />
          <meshStandardMaterial color={shop.palette.awning} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* 两只红灯笼 */}
      {[-1.05, 1.05].map((dx) => (
        <group key={dx} position={[doorX + dx, 2.5, 0.55]}>
          <mesh>
            <cylinderGeometry args={[0.06, 0.06, 0.1, 8]} />
            <meshStandardMaterial color="#3b322c" roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.24, 0]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshBasicMaterial color="#d8543c" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* 塑料凳 */}
      {[0, 0.42].map((dx, i) => (
        <group key={i} position={[doorX - side * (1.5 + dx), 0, 0.8]}>
          <mesh position={[0, 0.24, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.13, 0.06, 10]} />
            <meshStandardMaterial color={i ? '#9c5a44' : '#b8634a'} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 0.24, 8]} />
            <meshStandardMaterial color="#5e5248" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* 汤桶 */}
      <mesh position={[doorX + side * 1.6, 0.3, 0.85]} castShadow>
        <cylinderGeometry args={[0.19, 0.17, 0.6, 10]} />
        <meshStandardMaterial color="#8c9092" roughness={0.5} metalness={0.4} />
      </mesh>
      <BulbString w={Math.min(w - 0.8, 4.4)} z={0.72} y={2.72} n={6} />
    </>
  )
}

function TeaShop({ shop, w, doorX }: { shop: ShopDef; w: number; doorX: number }) {
  const side = doorX < 0 ? 1 : -1
  return (
    <>
      {/* 侧边竹帘 */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[doorX - side * (1.15 + i * 0.075), 1.15, 0.14]}>
          <cylinderGeometry args={[0.024, 0.024, 1.9, 5]} />
          <meshStandardMaterial color={['#b39a6a', '#a68d5f', '#bda578'][i % 3]} roughness={0.95} />
        </mesh>
      ))}
      {/* 茶旗 */}
      <group position={[doorX + side * 2.0, 0, 0.5]}>
        <mesh position={[0.16, 1.5, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 2.6, 6]} />
          <meshStandardMaterial color="#6f6350" roughness={0.9} />
        </mesh>
        <mesh position={[0.3, 1.85, 0]}>
          <planeGeometry args={[0.34, 1.0]} />
          <meshStandardMaterial color={shop.palette.awning} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 矮凳 */}
      <mesh position={[doorX + side * 1.15, 0.18, 1.05]} castShadow>
        <boxGeometry args={[0.7, 0.12, 0.32]} />
        <meshStandardMaterial color="#8a6d4a" roughness={0.92} />
      </mesh>
      <mesh position={[doorX + side * 1.15, 0.09, 1.05]}>
        <boxGeometry args={[0.62, 0.18, 0.24]} />
        <meshStandardMaterial color="#6f5638" roughness={0.92} />
      </mesh>
      {/* 石盆 */}
      <mesh position={[doorX - side * 1.9, 0.16, 1.0]} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 0.32, 12]} />
        <meshStandardMaterial color="#7e8378" roughness={0.95} />
      </mesh>
      <mesh position={[doorX - side * 1.9, 0.3, 1.0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.03, 12]} />
        <meshStandardMaterial color="#9fb6ae" roughness={0.25} metalness={0.1} />
      </mesh>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* 门头                                                                        */
/* -------------------------------------------------------------------------- */

/** 雨棚：所有店铺共用，颜色 / 条纹跟着业态走。 */
function Awning({ shop, w }: { shop: ShopDef; w: number }) {
  const aw = Math.min(w - 0.7, 4.8)
  const tex = useMemo(() => {
    if (!STRIPED.includes(shop.kind)) return null
    const t = stripeTexture(shop.palette.awning, '#f2ead8')
    t.repeat.set(Math.max(2, Math.round(aw / 0.9)), 1)
    return t
  }, [shop.kind, shop.palette.awning, aw])
  return (
    <group>
      <mesh position={[0, 2.86, 0.54]} rotation={[0.24, 0, 0]} castShadow>
        <boxGeometry args={[aw, 0.05, 1.1]} />
        <meshStandardMaterial
          map={tex ?? undefined}
          color={tex ? '#ffffff' : shop.palette.awning}
          roughness={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 2.68, 1.06]} rotation={[0.24, 0, 0]}>
        <boxGeometry args={[aw, 0.2, 0.03]} />
        <meshStandardMaterial
          map={tex ?? undefined}
          color={tex ? '#ffffff' : shop.palette.awning}
          roughness={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * aw) / 2 - s * 0.08, 2.5, 0.95]} rotation={[0.9, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.9, 5]} />
          <meshStandardMaterial color="#5d564c" roughness={0.8} metalness={0.2} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * 竖招牌：垂着挂在雨棚前沿下方，垂直于墙面。
 * 一层净高只有 3.3m，雨棚占了 2.7~3.0，立着的招牌没地方放；挂在雨棚下面
 * 反而更像老街上的店，走过去的时候能看见侧面的字。
 */
function BladeSign({ shop, w, doorX }: { shop: ShopDef; w: number; doorX: number }) {
  const tex = useMemo(() => bladeTexture(shop), [shop])
  const side = doorX < 0 ? 1 : -1
  const x = side * (w / 2 - 0.85)
  return (
    <group position={[x, 2.16, 0.92]}>
      <mesh castShadow>
        <boxGeometry args={[0.05, 0.72, 0.5]} />
        <meshStandardMaterial color="#4a4238" roughness={0.85} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.03, 0, 0]} rotation={[0, s * (Math.PI / 2), 0]}>
          <planeGeometry args={[0.44, 0.66]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      ))}
      {/* 两根细杆把招牌吊在雨棚上 */}
      {[-0.16, 0.16].map((dz) => (
        <mesh key={dz} position={[0, 0.44, dz]}>
          <cylinderGeometry args={[0.01, 0.01, 0.2, 4]} />
          <meshStandardMaterial color="#4a4238" roughness={0.8} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function ShopFront({ shop }: { shop: ShopDef }) {
  const f = useMemo(() => shopFacade(shop), [shop])
  const w = f.width
  const props = (() => {
    switch (shop.kind) {
      case 'bakery':
        return <Bakery w={w} doorX={f.doorX} />
      case 'florist':
        return <Florist w={w} doorX={f.doorX} />
      case 'konbini':
        return <Konbini w={w} doorX={f.doorX} />
      case 'record':
        return <RecordShop w={w} doorX={f.doorX} />
      case 'zine':
        return <ZineShop w={w} doorX={f.doorX} />
      case 'noodle':
        return <NoodleShop shop={shop} w={w} doorX={f.doorX} />
      default:
        return <TeaShop shop={shop} w={w} doorX={f.doorX} />
    }
  })()
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, f.yaw, 0]}>
      <Awning shop={shop} w={w} />
      <BladeSign shop={shop} w={w} doorX={f.doorX} />
      {props}
      {/* 门口一小片暖光，夜里和橱窗连成一片 */}
      <mesh position={[0, 0.044, 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[Math.min(w, 5), 3.4]} />
        <meshBasicMaterial color="#ffc98e" transparent opacity={0.1} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function ShopFronts() {
  return (
    <group>
      {shops.map((shop) => (
        <ShopFront key={shop.id} shop={shop} />
      ))}
    </group>
  )
}
