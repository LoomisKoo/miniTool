// 会移动的刚体：车流和行人。
//
// 城市里所有实体都要能挡住玩家，但车的碰撞盒每帧都在变。
// 如果把它们塞进 React 的 colliders 数组，就是每帧一次全量重渲染；
// 所以这里用一个可变单例：组件挂载时登记，每帧只改字段，玩家移动时直接读取。

export type DynamicBody = {
  /** 世界坐标包围盒 */
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  /** 底面高度：飞在空中的车不会挡住站在地面上的人 */
  minY: number
  /** 顶面高度：玩家飞得比它高就可以越过 */
  maxY: number
  /** 登记它的组件卸载时置 false，避免残留幽灵碰撞 */
  active: boolean
}

export const dynamicBodies: DynamicBody[] = []

export function addBody(maxY: number): DynamicBody {
  const body: DynamicBody = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY, active: true }
  dynamicBodies.push(body)
  return body
}

/** 用中心点 + 半宽半深更新包围盒。 */
export function placeBody(body: DynamicBody, x: number, z: number, halfW: number, halfD: number) {
  body.minX = x - halfW
  body.maxX = x + halfW
  body.minZ = z - halfD
  body.maxZ = z + halfD
}

/** 清理已被回收的登记项（组件卸载后留空位即可，这里顺手压缩数组）。 */
export function pruneBodies() {
  let write = 0
  for (let read = 0; read < dynamicBodies.length; read++) {
    const body = dynamicBodies[read]
    if (!body.active) continue
    dynamicBodies[write++] = body
  }
  dynamicBodies.length = write
}

/** 给玩家一个统一的水平碰撞查询：静态碰撞盒 + 移动刚体。 */
export function hitsDynamic(x: number, z: number, radius: number, y: number) {
  for (const body of dynamicBodies) {
    if (!body.active) continue
    if (y > body.maxY - 0.35) continue
    // 从悬空的车底下走过
    if (y + 0.9 < body.minY) continue
    if (x + radius > body.minX && x - radius < body.maxX && z + radius > body.minZ && z - radius < body.maxZ) {
      return true
    }
  }
  return false
}

/**
 * 被移动刚体压住时的脱困：把玩家沿最近的边推出去。
 * 车是主动方（它不会停），所以"撞人"必须由玩家让位，否则会被车穿过。
 */
export function pushOut(x: number, z: number, radius: number, y: number) {
  for (const body of dynamicBodies) {
    if (!body.active) continue
    if (y > body.maxY - 0.35) continue
    if (y + 0.9 < body.minY) continue
    const hit =
      x + radius > body.minX && x - radius < body.maxX && z + radius > body.minZ && z - radius < body.maxZ
    if (!hit) continue
    const left = x + radius - body.minX
    const right = body.maxX - (x - radius)
    const back = z + radius - body.minZ
    const front = body.maxZ - (z - radius)
    const nearest = Math.min(left, right, back, front)
    if (nearest === left) x = body.minX - radius - 0.002
    else if (nearest === right) x = body.maxX + radius + 0.002
    else if (nearest === back) z = body.minZ - radius - 0.002
    else z = body.maxZ + radius + 0.002
  }
  return { x, z }
}
