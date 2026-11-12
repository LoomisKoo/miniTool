// 门厅里"店铺的背面"。
//
// 店铺是从首层门厅贴外墙切出去的一条（见 data/shops.ts），进门走的是街面那
// 扇橱窗。既然门厅和大堂是另一个 Canvas，从大堂看过去，那一块不能是空的：
// 这里给它补一道背墙 + 一块小牌子，写着"从街面进"，顺便把这块地挡起来。
//
// 只在首层画，二层以上没有店铺。

import { useMemo } from 'react'
import * as THREE from 'three'
import { shopsInBuilding, type ShopDef } from '../data/shops'
import type { Rect } from '../data/units'
import type { RoomBox } from './RoomKit'

const labelCache = new Map<string, THREE.CanvasTexture>()

/** 背墙上的小牌子：店名 + 一句"从街面进"。比纯色板好认。 */
function labelTexture(shop: ShopDef) {
  const hit = labelCache.get(shop.id)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#2f3338'
  ctx.fillRect(0, 0, 512, 128)
  ctx.strokeStyle = 'rgba(248,240,223,.32)'
  ctx.lineWidth = 4
  ctx.strokeRect(10, 10, 492, 108)
  ctx.fillStyle = '#f8f0df'
  ctx.textBaseline = 'middle'
  ctx.font = '600 46px "PingFang SC", "Helvetica Neue", Arial, sans-serif'
  ctx.fillText(shop.name, 34, 52, 300)
  ctx.font = '400 24px "PingFang SC", "Helvetica Neue", Arial, sans-serif'
  ctx.fillStyle = 'rgba(248,240,223,.66)'
  ctx.fillText('沿街进门', 34, 94, 300)
  // 右侧一个简化的门箭头，指向街面那一侧
  ctx.strokeStyle = 'rgba(255,206,154,.85)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(400, 64)
  ctx.lineTo(462, 64)
  ctx.moveTo(444, 46)
  ctx.lineTo(462, 64)
  ctx.lineTo(444, 82)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  labelCache.set(shop.id, tex)
  return tex
}

/** 店铺占地在门厅局部坐标里的那一块：挡人用。 */
export function shopBlockers(buildingId: string, hall: Rect, box: RoomBox) {
  return shopsInBuilding(buildingId).map((shop) => {
    // 只在和当前门厅重叠时才处理：板楼有多个单元，一间店只属于其中一个
    const r = shop.rect
    const inside = r.x0 >= hall.x0 - 0.01 && r.x1 <= hall.x1 + 0.01 && r.z0 >= hall.z0 - 0.01 && r.z1 <= hall.z1 + 0.01
    if (!inside) return null
    return {
      minX: r.x0 - box.cx,
      maxX: r.x1 - box.cx,
      minZ: r.z0 - box.cz,
      maxZ: r.z1 - box.cz,
      minY: 0,
      maxY: 3,
    }
  }).filter((v): v is NonNullable<typeof v> => Boolean(v))
}

/**
 * 背墙 + 牌子。box 是门厅的 RoomBox，shop.rect 是楼栋局部坐标，
 * 两者相减就得到门厅局部坐标（RoomBox 的原点在门厅中心）。
 */
export function ShopBacks({ buildingId, box }: { buildingId: string; box: RoomBox }) {
  const list = useMemo(() => {
    // 板楼一栋两个单元：只画落在当前这个门厅里的店，不然会在大堂里
    // 凭空出现一面属于隔壁单元的背墙。
    return shopsInBuilding(buildingId).filter((shop) => {
      const cx = (shop.rect.x0 + shop.rect.x1) / 2 - box.cx
      const cz = (shop.rect.z0 + shop.rect.z1) / 2 - box.cz
      return Math.abs(cx) <= box.W / 2 && Math.abs(cz) <= box.D / 2
    })
  }, [buildingId, box])
  if (!list.length) return null
  const H = 2.95

  return (
    <group>
      {list.map((shop) => {
        const r = shop.rect
        const x0 = r.x0 - box.cx
        const x1 = r.x1 - box.cx
        const z0 = r.z0 - box.cz
        const z1 = r.z1 - box.cz
        // 背墙贴着店铺靠门厅的那条边
        const horizontal = shop.side === 's' || shop.side === 'n'
        const wallZ = shop.side === 's' ? z0 : z1
        const wallX = shop.side === 'e' ? x0 : x1
        const tex = labelTexture(shop)

        return (
          <group key={shop.id}>
            {horizontal ? (
              <mesh position={[(x0 + x1) / 2, H / 2, wallZ]} castShadow receiveShadow>
                <boxGeometry args={[x1 - x0, H, 0.12]} />
                <meshStandardMaterial color="#d5cfc2" roughness={0.9} />
              </mesh>
            ) : (
              <mesh position={[wallX, H / 2, (z0 + z1) / 2]} castShadow receiveShadow>
                <boxGeometry args={[0.12, H, z1 - z0]} />
                <meshStandardMaterial color="#d5cfc2" roughness={0.9} />
              </mesh>
            )}
            {/* 牌子的朝向：朝着门厅里面（背墙的法线指向门厅中心） */}
            {horizontal ? (
              <mesh
                position={[(x0 + x1) / 2, 1.72, wallZ + (shop.side === 's' ? -0.075 : 0.075)]}
                rotation={[0, shop.side === 's' ? Math.PI : 0, 0]}
              >
                <planeGeometry args={[1.6, 0.4]} />
                <meshBasicMaterial map={tex} toneMapped={false} />
              </mesh>
            ) : (
              <mesh
                position={[wallX + (shop.side === 'e' ? -0.075 : 0.075), 1.72, (z0 + z1) / 2]}
                rotation={[0, shop.side === 'e' ? -Math.PI / 2 : Math.PI / 2, 0]}
              >
                <planeGeometry args={[1.6, 0.4]} />
                <meshBasicMaterial map={tex} toneMapped={false} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}
