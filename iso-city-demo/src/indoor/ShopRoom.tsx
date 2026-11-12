// 1 楼店铺的室内。
//
// 店铺的矩形是从楼栋首层平面切出来的（data/shops.ts），所以这里的房间不是
// 凭空摆的盒子：它的门面就是街上看到的那一排橱窗中的一扇，店的进深就是楼体
// 的进深，往窗外看还是同一条街（CityBackdrop 复用街上的 UnitShell）。
//
// 渲染时把"沿街向 = X、朝街向 = +Z"的一套陈列整体转过去，所以 ShopFit 里
// 每种业态只写一次，东南西北四面都能用。

import { useMemo } from 'react'
import { useApp, type DialogChoice } from '../store'
import { openNow, shopById, type ShopDef } from '../data/shops'
import { FLOOR_HEIGHT, type Side } from '../data/units'
import { PlayerRig, type Interactable } from '../scene/PlayerRig'
import { Marker } from '../scene/Markers'
import { NpcFigure } from '../scene/Npcs'
import { randomLook } from '../scene/people'
import { seeded } from '../scene/theme'
import { CityBackdrop } from './CityBackdrop'
import { RoomWalls, localAlong, roomBounds, roomBox, roomColliders, wallPoint, yawToward, type RoomBox } from './RoomKit'
import { ShopFit, shopCounter } from './ShopFit'
import { floorTone, wallTone } from './style'

/** 店内的净高：比住宅略高一点，货架能到 2m 而不顶到板 */
const HEIGHT = FLOOR_HEIGHT - 0.2

const INWARD: Record<Side, [number, number]> = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }

/** 沿街方向映射到局部 X 时，陈列需要整体转的角度。 */
const FRONT_YAW: Record<Side, number> = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }

function planOf(shop: ShopDef) {
  const box: RoomBox = roomBox(shop.rect, HEIGHT)
  const doorL = localAlong(box, shop.side, shop.doorA)
  // 沿街长 / 进深：外墙在左右两侧时，房间的长宽要互换
  const along = shop.side === 'n' || shop.side === 's' ? box.W : box.D
  const depth = shop.side === 'n' || shop.side === 's' ? box.D : box.W
  // 门面的玻璃宽度：最多 6.8m，两侧各留 0.55m 墙垛
  const half = Math.min(3.4, along / 2 - 0.55)
  const openings = [
    {
      side: shop.side,
      l0: doorL - half,
      l1: doorL + half,
      // 橱窗离地 6cm：底下一圈踢脚，和街上那排店面的窗台对得上
      y0: 0.06,
      y1: 2.72,
      kind: 'entry' as const,
    },
  ]
  const [sx, sz] = wallPoint(box, shop.side, doorL, 1.5)
  const inward = INWARD[shop.side]
  const [ex, ez] = wallPoint(box, shop.side, doorL, 0.55)
  return {
    box,
    doorL,
    openings,
    start: [sx, sz] as [number, number],
    startYaw: yawToward(inward[0], inward[1]),
    exitAt: [ex, ez] as [number, number],
    along,
    depth,
    gYaw: FRONT_YAW[shop.side],
  }
}

/** 陈列坐标（沿街 X、朝街 +Z）→ 房间局部坐标。 */
function place(plan: ReturnType<typeof planOf>, cx: number, cz: number): [number, number] {
  const y = plan.gYaw
  return [cx * Math.cos(y) + cz * Math.sin(y), -cx * Math.sin(y) + cz * Math.cos(y)]
}

/** 柜台的碰撞盒：位置来自 ShopFit 的那张表，转 90° 之后 AABB 仍然是准的。 */
function counterCollider(shop: ShopDef, plan: ReturnType<typeof planOf>) {
  const c = shopCounter(shop.kind, plan.along)
  const pts = [
    [c.x - c.len / 2, c.z - 0.32],
    [c.x + c.len / 2, c.z - 0.32],
    [c.x - c.len / 2, c.z + 0.32],
    [c.x + c.len / 2, c.z + 0.32],
  ].map(([x, z]) => place(plan, x, z))
  return [
    {
      minX: Math.min(...pts.map((p) => p[0])),
      maxX: Math.max(...pts.map((p) => p[0])),
      minZ: Math.min(...pts.map((p) => p[1])),
      maxZ: Math.max(...pts.map((p) => p[1])),
      minY: 0,
      maxY: 1.1,
    },
  ]
}

export function ShopRoom({ id }: { id: string }) {
  const shop = shopById[id]
  const exitCity = useApp((state) => state.exitCity)
  const openDialog = useApp((state) => state.openDialog)
  const indoorCam = useApp((state) => state.indoorCam)
  const plan = useMemo(() => (shop ? planOf(shop) : null), [shop?.id])
  const itemLines = useMemo(
    () =>
      shop
        ? shop.items.map((item) => `${item.name} · ${item.price}：${item.note}`)
        : [],
    [shop],
  )
  // 店员：站在柜台后面，面朝街。look 用店名做种子，每次进来都是同一个人
  const clerk = useMemo(() => {
    if (!shop || !plan) return null
    const c = shopCounter(shop.kind, plan.along)
    const [x, z] = place(plan, c.x, c.z - 0.62)
    return {
      def: {
        id: `clerk-${shop.id}`,
        name: shop.vendor.name,
        role: shop.vendor.role,
        lines: shop.vendor.lines,
        x,
        z,
        yaw: plan.gYaw,
        look: randomLook(seeded(`clerk-${shop.id}`)),
      },
    }
  }, [shop?.id, plan])

  const interactables = useMemo<Interactable[]>(() => {
    if (!shop || !plan) return []
    const c = shopCounter(shop.kind, plan.along)
    // 交互点放在柜台前 0.95m：站在台前说话，不是站在店中间
    const [vx, vz] = place(plan, c.x, c.z + 0.95)
    const browseItems = () =>
      openDialog({
        name: shop.name,
        role: '今日商品',
        lines: itemLines.length > 0 ? itemLines : ['今天还没有商品信息。'],
        x: vx,
        z: vz,
      })
    const choices: DialogChoice[] = [
      {
        label: '看今日商品',
        note: `${shop.items.length} 项 · ${openNow(shop) ? '营业中' : '现在打烊'}`,
        primary: true,
        onClick: browseItems,
      },
      {
        label: '和店主聊聊',
        onClick: () =>
          openDialog({
            name: shop.vendor.name,
            role: shop.vendor.role,
            lines: shop.vendor.lines,
            x: vx,
            z: vz,
          }),
      },
    ]
    return [
      {
        id: 'shop-counter',
        label: `${shop.vendor.name} · ${shop.vendor.role.split(' · ').pop()}`,
        hint: `${openNow(shop) ? '营业中' : '已打烊'} · 按 E 查看商品`,
        x: vx,
        z: vz,
        radius: 2.0,
        action: () =>
          openDialog({
            name: shop.name,
            role: `${shop.vendor.name} · ${openNow(shop) ? '营业中' : '已打烊'}`,
            lines: [shop.blurb, `营业时间：${shop.hours}`],
            x: vx,
            z: vz,
            choices,
          }),
      },
      {
        id: 'shop-exit',
        label: '离开店铺',
        hint: `回到 ${shop.side === 'n' ? '河岸' : '街道'}`,
        x: plan.exitAt[0],
        z: plan.exitAt[1],
        radius: 1.5,
        action: exitCity,
      },
    ]
  }, [shop?.id, plan, exitCity, openDialog])

  if (!shop || !plan) return null
  const { box } = plan
  const counter = shopCounter(shop.kind, plan.along)
  const [mx, mz] = place(plan, counter.x, counter.z)
  // 陈列组的朝向：把"朝街 +Z"转到房间的街面方向
  const fitYaw = plan.gYaw

  return (
    <group>
      <RoomWalls
        box={box}
        openings={plan.openings}
        wallColor={wallTone(shop.palette.wall, shop.id)}
        floorColor={floorTone(shop.palette.floor, shop.id)}
        hideCeiling={indoorCam === 'top'}
      />
      <CityBackdrop
        buildingId={shop.buildingId}
        floor={1}
        origin={[box.cx, box.cz]}
        // 首层的橱窗玻璃留给室内自己画：街面那排橱窗已经由 ShopFit 的门面
        // 玻璃补上。这里剪掉的是整个门厅的首层玻璃（楼壳按 h:core 归属），
        // 不剪的话两层玻璃会叠在同一个窗洞里。
        cut={{ floor: 1, owner: `h:${shop.core}` }}
      />

      <group rotation={[0, fitYaw, 0]}>
        <ShopFit shop={shop} L={plan.along} D={plan.depth} />
      </group>

      {clerk && <NpcFigure def={clerk.def} />}

      {/* 店里的主光：一盏暖色的吊灯，位置在柜台和货架之间的走道上方 */}
      <pointLight
        position={[0, HEIGHT - 0.45, 0]}
        color="#ffe0b4"
        intensity={3.4}
        distance={Math.max(box.W, box.D) + 3}
        decay={1.7}
      />
      {/* 橱窗那一侧补一点天光，不然背光的货架会全黑 */}
      <pointLight
        position={[plan.exitAt[0], 2.1, plan.exitAt[1]]}
        color="#dfe8f2"
        intensity={1.6}
        distance={6}
        decay={2}
      />

      <Marker
        x={mx}
        z={mz}
        y={2.2}
        title={shop.name}
        subtitle={`${shop.vendor.name} · ${shop.hours}`}
        tone="space"
        actionId="shop-counter"
        onOpen={() => {
          const c = shopCounter(shop.kind, plan.along)
          const [ax, az] = place(plan, c.x, c.z + 0.95)
          openDialog({
            name: shop.name,
            role: `${shop.vendor.name} · ${openNow(shop) ? '营业中' : '已打烊'}`,
            lines: [shop.blurb, `营业时间：${shop.hours}`],
            x: ax,
            z: az,
            choices: [
              {
                label: '看今日商品',
                note: `${shop.items.length} 项`,
                primary: true,
                onClick: () =>
                  openDialog({
                    name: shop.name,
                    role: '今日商品',
                    lines: itemLines,
                    x: ax,
                    z: az,
                  }),
              },
              {
                label: '和店主聊聊',
                onClick: () =>
                  openDialog({
                    name: shop.vendor.name,
                    role: shop.vendor.role,
                    lines: shop.vendor.lines,
                    x: ax,
                    z: az,
                  }),
              },
            ],
          })
        }}
      />
      <Marker
        x={plan.exitAt[0]}
        z={plan.exitAt[1]}
        y={2.05}
        title="回到街道"
        tone="entrance"
        actionId="shop-exit"
        onOpen={exitCity}
      />

      <PlayerRig
        start={plan.start}
        startYaw={plan.startYaw}
        bounds={roomBounds(box, null)}
        colliders={[
          ...roomColliders(box, plan.openings, null),
          // 柜台挡人：不然会直接穿过台面走到货架前
          ...counterCollider(shop, plan),
        ]}
        interactables={interactables}
        cameraDistance={Math.min(13, Math.max(8, Math.max(box.W, box.D) * 1.15))}
        interior
      />
    </group>
  )
}
