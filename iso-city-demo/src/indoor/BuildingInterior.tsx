import { useEffect, useMemo } from 'react'
import { useApp } from '../store'
import { PlayerRig, type Interactable } from '../scene/PlayerRig'
import { Marker, PromptTag } from '../scene/Markers'
import { makeSignTexture } from '../scene/textures'
import {
  floorLabel,
  layoutOf,
  unitBuilding,
  unitsOnFloorOf,
  type Side,
  type UnitBuilding,
  type UnitInfo,
} from '../data/units'
import { CityBackdrop } from './CityBackdrop'
import { Lounge, loungeInteractable } from './Lounge'
import { ShopBacks, shopBlockers } from './ShopBack'
import {
  ClosedDoor,
  RoomWalls,
  doorOpening,
  freeWallRuns,
  inwardYaw,
  localAlong,
  roomBounds,
  roomBox,
  roomColliders,
  toLocalOpening,
  useWallCut,
  wallPoint,
  yawToward,
  type RoomBox,
} from './RoomKit'
import { wallDecor, type WallSpan } from './WallDecor'
import { floorTone, wallTone } from './style'

/**
 * 门厅 / 电梯厅 / 走廊：就是楼层平面里 halls[core] 那个矩形。
 * 板楼是一梯两户的楼梯间，塔楼是中央核心筒的电梯厅，酒店和青年公寓才是内廊。
 * 首层是门厅：整圈橱窗、玻璃门，没有户门。
 */
const HEIGHT = 3.1
const INWARD: Record<Side, [number, number]> = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }

function colorFor(seedText: string) {
  let h = 0
  for (let i = 0; i < seedText.length; i++) h = (h * 31 + seedText.charCodeAt(i)) >>> 0
  const colors = ['#5c6b63', '#7a6250', '#4f5f70', '#6f5c72', '#6b6a54', '#8a6a4b']
  return colors[h % colors.length]
}

function Plaque({
  box,
  side,
  l,
  y,
  text,
  w = 0.64,
  out = 0.035,
}: {
  box: RoomBox
  side: Side
  l: number
  y: number
  text: string
  w?: number
  /** 离墙面的距离：门牌要压在门套外面，否则会被门套的横梁挡住半截。 */
  out?: number
}) {
  const tex = useMemo(() => makeSignTexture(text, '#242b31'), [text])
  useEffect(() => () => tex.dispose(), [tex])
  const [x, z] = wallPoint(box, side, l, out)
  // 门牌挂在这面墙上，墙被剖掉时它也得跟着走，否则会浮在空气里挡视线
  const cut = useWallCut(side, box)
  return (
    <group ref={cut}>
      <mesh position={[x, y, z]} rotation={[0, inwardYaw(side), 0]}>
        <planeGeometry args={[w, w * 0.375]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function BuildingInterior({
  id,
  floor = 1,
  core = 0,
  from,
}: {
  id: string
  floor?: number
  core?: number
  from?: string
}) {
  const building = unitBuilding(id) as UnitBuilding | null
  const world = useApp((state) => state.world)
  const enterTarget = useApp((state) => state.enterTarget)
  const openElevator = useApp((state) => state.openElevator)
  const exitCity = useApp((state) => state.exitCity)
  const indoorCam = useApp((state) => state.indoorCam)

  const plan = useMemo(() => {
    if (!building) return null
    const layout = layoutOf(building, floor)
    const hall = layout.halls[Math.min(core, layout.halls.length - 1)]
    const box = roomBox(hall.rect, HEIGHT)
    const units = unitsOnFloorOf(building, floor)
    const doors = hall.doors
      .map((d) => ({ ...d, l: localAlong(box, d.side, d.at), info: units.find((u) => u.index === d.unit) }))
      .filter((d): d is typeof d & { info: UnitInfo } => Boolean(d.info))
    const elevator = { side: hall.elevator.side, l: localAlong(box, hall.elevator.side, hall.elevator.at) }
    const exit = hall.exit ? { side: hall.exit.side, l: localAlong(box, hall.exit.side, hall.exit.at) } : null
    const openings = [
      ...hall.openings.map((o) => toLocalOpening(box, o)),
      ...hall.doors.map((d) => doorOpening(box, d.side, d.at)),
      doorOpening(box, hall.elevator.side, hall.elevator.at, 'elevator'),
    ]

    const spot = (side: Side, l: number, inward: number) => {
      const [x, z] = wallPoint(box, side, l, inward)
      const [dx, dz] = INWARD[side]
      return { x, z, yaw: yawToward(dx, dz) }
    }
    const fromDoor = from ? doors.find((d) => d.info.spaceId === from) : null
    const start = fromDoor
      ? spot(fromDoor.side, fromDoor.l, 1.0)
      : exit
        ? spot(exit.side, exit.l, 1.6)
        : spot(elevator.side, elevator.l, 1.6)

    return {
      box,
      doors,
      elevator,
      exit,
      openings,
      start,
      bounds: roomBounds(box, null),
      colliders: [...roomColliders(box, openings, null), ...(floor === 1 ? shopBlockers(id, hall.rect, box) : [])],
      elevatorSpot: spot(elevator.side, elevator.l, 0.8),
      exitSpot: exit ? spot(exit.side, exit.l, 0.8) : null,
    }
  }, [building, floor, core, from])

  const interactables = useMemo<Interactable[]>(() => {    if (!plan) return []
    // 青年公寓一楼大堂里的公共客厅：整栋楼共用，摆在大堂另一头
    const lounge = floor === 1 && id === 'south-east' ? loungeInteractable(plan.box, plan.elevatorSpot) : null
    return [
      ...plan.doors.map((d) => {
        const p = wallPoint(plan.box, d.side, d.l, 0.6)
        return {
          id: `door-${d.info.spaceId}`,
          label: d.info.label,
          hint: '进入这户',
          x: p[0],
          z: p[1],
          radius: 1.6,
          action: () => enterTarget({ kind: 'space', id: d.info.spaceId }, d.info.name),
        }
      }),
      {
        id: 'elevator',
        label: '电梯',
        hint: '选择楼层',
        x: plan.elevatorSpot.x,
        z: plan.elevatorSpot.z,
        radius: 2.2,
        action: () => openElevator(id),
      },
      ...(lounge ? [lounge] : []),
      ...(plan.exitSpot
        ? [
            {
              id: 'building-exit',
              label: '返回街道',
              hint: '离开这栋楼',
              x: plan.exitSpot.x,
              z: plan.exitSpot.z,
              radius: 2.2,
              action: exitCity,
            },
          ]
        : []),
    ]
  }, [plan, enterTarget, openElevator, exitCity, id, floor])

  // 门厅 / 走廊的墙面软装：门、电梯、出口都占着墙，扣掉之后再铺。
  // 走廊本来就窄，所以这里只贴墙、不落地，不会让通道更难走。
  const decor = useMemo(() => {
    if (!plan) return null
    const walls = freeWallRuns(plan.box, plan.openings)
    const used: WallSpan[] = [
      ...plan.doors.map((d) => ({ side: d.side, a0: d.l - 0.95, a1: d.l + 0.95 })),
      { side: plan.elevator.side, a0: plan.elevator.l - 1.0, a1: plan.elevator.l + 1.0 },
      ...(plan.exit ? [{ side: plan.exit.side, a0: plan.exit.l - 1.1, a1: plan.exit.l + 1.1 }] : []),
    ]
    return wallDecor(plan.box, walls, used, `hall-${id}-${floor}-${core}`)
  }, [plan, id, floor, core])

  if (!building || !plan) return null
  const { box } = plan
  const lobby = floor === 1
  const long = Math.max(box.W, box.D)
  const lights = Math.max(1, Math.round(long / 6))

  return (
    <group>
      <RoomWalls
        box={box}
        openings={plan.openings}
        wallColor={wallTone(lobby ? '#e4ddd0' : '#ded8cd', `${id}-${floor}`)}
        floorColor={floorTone(lobby ? '#c9c1b2' : '#b3a58f', `${id}-${floor}`)}
        hideCeiling={indoorCam === 'top'}
      />

      {plan.doors.map((d) => {
        const [mx, mz] = wallPoint(box, d.side, d.l, 0.15)
        return (
          <group key={d.info.spaceId}>
            <ClosedDoor box={box} side={d.side} l={d.l} color={colorFor(d.info.spaceId)} />
            {/* 门牌挂在门扇的中上部（门高 2.35m，牌心 1.72 正好是"中上"）。
                离墙 0.10m 才落在门扇表面（≈0.075m）之外，不会被门板/门套挡住。 */}
            <Plaque box={box} side={d.side} l={d.l} y={1.72} w={0.82} out={0.1} text={d.info.label} />
            {/* 气泡只留一个 E：编号已经写在门上，再写一遍是重复信息。
                位置抬到门牌之上，仍在门洞范围内，不会和牌子叠在一起。 */}
            <PromptTag x={mx} z={mz} y={2.15} actionId={`door-${d.info.spaceId}`} />
          </group>
        )
      })}

      <ClosedDoor box={box} side={plan.elevator.side} l={plan.elevator.l} elevator />
      <Plaque
        box={box}
        side={plan.elevator.side}
        l={plan.elevator.l}
        y={2.72}
        w={1.4}
        out={0.14}
        text={`${building.name} ${floorLabel(floor)}`}
      />
      <Marker
        x={plan.elevatorSpot.x}
        z={plan.elevatorSpot.z}
        y={2.45}
        title="电梯"
        tone="kiosk"
        actionId="elevator"
        onOpen={() => openElevator(id)}
      />

      {plan.exitSpot && (
        <Marker
          x={plan.exitSpot.x}
          z={plan.exitSpot.z}
          y={2.05}
          title="返回街道"
          tone="entrance"
          actionId="building-exit"
          onOpen={exitCity}
        />
      )}

      {/* 青年公寓的大堂里有一间公共客厅；住户照片挂在墙上 */}
      {lobby && id === 'south-east' && <Lounge box={box} lift={plan.elevatorSpot} floor={floor} />}
      {floor === 1 && <ShopBacks buildingId={id} box={box} />}
      {decor}

      {/* 吸顶灯：沿长向均匀排 */}
      {Array.from({ length: lights }).map((_, i) => {
        const t = (i + 0.5) / lights - 0.5
        const x = box.W >= box.D ? t * box.W : 0
        const z = box.W >= box.D ? 0 : t * box.D
        return (
          <group key={i} position={[x, HEIGHT - 0.02, z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.28, 20]} />
              <meshBasicMaterial color="#fff0cf" toneMapped={false} />
            </mesh>
            <pointLight position={[0, -0.4, 0]} color="#ffdcae" intensity={lobby ? 5 : 4} distance={9} decay={2} />
          </group>
        )
      })}

      {floor >= 1 && (
        <CityBackdrop
          buildingId={id}
          floor={floor}
          origin={[box.cx, box.cz]}
          cut={{ floor, owner: `h:${Math.min(core, layoutOf(building, floor).halls.length - 1)}` }}
          interior
        />
      )}

      <PlayerRig
        start={[plan.start.x, plan.start.z]}
        startYaw={plan.start.yaw}
        bounds={plan.bounds}
        colliders={plan.colliders}
        interactables={interactables}
        cameraDistance={Math.max(6, Math.min(12, Math.max(box.W, box.D) * 1.05))}
        interior
      />
    </group>
  )
}
