// 饱腹度：完全由「最后一次吃饱的时间」算出来，没有定时任务、没有网络同步。
//
// 服务端只存 hunger_at（喂食时刷新），客户端拿时间差推导 0~100。这样
// 两个人看到同一只宠物时的饥饿程度一致，宠物也不必自己上报状态。
//
// 曲线选得很慢：从吃饱到见底是 36 小时。太快的后果是「一天没上线宠物就
// 奄奄一息」，玩家会觉得被惩罚；太慢则这条社交压力完全不成立。

/** 吃饱（100）到见底（0）要多久。 */
export const HUNGER_HOURS = 36
/** 低于这个值算「饿」：缩在常驻点附近、毛色变暗、走路变慢。 */
export const HUNGRY_AT = 30

type HungerSource = {
  /** 最后一次喂食时间；从没喂过是 null */
  hungerAt?: string | null
  /** 领养时间：没有喂食记录时，从领养那一刻开始算 */
  adoptedAt?: string | null
}

function hoursSince(iso: string | null | undefined, now: number) {
  if (!iso) return 0
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, (now - t) / 3_600_000)
}

/**
 * 0~100。没有领养时间（刚被领养、服务端还没回写）时按刚吃饱处理，
 * 不能因为字段缺失就把宠物显示成饿的。
 */
export function hungerOf(pet: HungerSource, now = Date.now()) {
  const since = pet.hungerAt ?? pet.adoptedAt ?? null
  if (!since) return 100
  const hours = hoursSince(since, now)
  return Math.max(0, Math.min(100, 100 - (hours / HUNGER_HOURS) * 100))
}

export function isHungry(pet: HungerSource, now = Date.now()) {
  return Boolean(pet.adoptedAt) && hungerOf(pet, now) < HUNGRY_AT
}

/** 面板上的三档文案。分档只影响说法，行为判定统一用 HUNGRY_AT。 */
export function hungerLabel(value: number) {
  if (value < HUNGRY_AT) return '饿了'
  if (value < 70) return '还不太饿'
  return '吃得很好'
}

/** 0~1 的「饿」程度，用来驱动毛色变暗、脚步变慢这类连续表现。 */
export function hungerMood(value: number) {
  return Math.max(0, Math.min(1, 1 - value / 100))
}
