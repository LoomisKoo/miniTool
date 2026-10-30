import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type Ref, type WheelEvent } from 'react'
import { DiecutDefs } from './art'
import { BOOK_TITLE, spreads, type Layer, type Spread } from './spreads'

const PW = 500
const PH = 560
const WALL_Y = 92
// 书页的基准平面。翻页纸纸心也钉在这里；它的正反面各离纸心 ±1（见 .pb-face）。
const PAGE_Z = 4.6
// 不同页翻平后会共面，深度排序会穿模。被翻页纸盖住的那一页最多往下沉这么多，
// 沉量随贴合度 |cos θ| 动态变化：贴得越平沉得越多，竖直时为 0。
const PAGE_GAP = 1
// 默认正对书本，左右书页保持同一水平线；旋转只在用户拖动空白处后发生。
const DEFAULT_VIEW = { rx: 50, rz: 0, zoom: 1 }
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2)
const easeOutBack = (k: number) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2
/** 越拉阻力越大，最多掀起约 50° */
const rubber = (x: number) => (x * 0.45) / (1 + x * 1.6)
const DEG = Math.PI / 180
/** 背景墙靠书脊的三角折翼宽度（墙顶处），斜折痕从书脊底端连到这里 */
const WALL_TAPER = 120

/**
 * 实体立体书不碰撞的几何条件：
 * 1. 同一页纸片都向前倒，且前排不比后排更立 → 截面上互不相交；
 * 2. 纸片最高点不越过两张书页夹角的角平分面 → 左右两页的纸片被平分面隔开；
 * 3. 翻页的那张纸本身把旧跨页和新跨页隔开。
 * 于是 sin(立起角) ≤ (离书脊距离 / 纸片高度) · tan(书页夹角 / 2)。
 */
function standAngle(wedge: number, cMin: number) {
  if (wedge >= 179.999) return 90
  return Math.asin(clamp(cMin * Math.tan((wedge / 2) * DEG), 0, 1)) / DEG
}

type Poly = [number, string][]
const polygon = (p: Poly, w: number, mirror: boolean) =>
  `polygon(${p.map(([x, y]) => `${mirror ? w - x : x}px ${y}`).join(', ')})`

/** 一块纸：正面 + 素色纸背；poly 为正面坐标下的裁剪多边形（x 用像素，y 用 0 / 100%） */
function Sheet({ art, poly, w = 0, measureRef }: { art: ReactNode; poly?: Poly; w?: number; measureRef?: Ref<HTMLDivElement> }) {
  return (
    <>
      <div ref={measureRef} className="pb-front" style={poly && { clipPath: polygon(poly, w, false) }}>{art}</div>
      <div className="pb-backside" style={poly && { clipPath: polygon(poly, w, true) }}><div className="pb-mirror">{art}</div></div>
    </>
  )
}

/**
 * 左右两面墙在书脊处本是一张纸：三角折翼的书脊边必须始终落在两页夹角的平分面上，
 * 这样左右两片三角互为镜像、书脊边重合，既不分开也不重叠。
 * 在墙面坐标里把书脊边绕斜折痕（书脊底 → 离书脊 T 的墙顶）旋转 γ，
 * 令它在垂直于平分面方向上的分量为 0，解 A·cosγ + B·sinγ = C。
 * 取向墙正面（往内）折的那个解：左右两片三角绕共用的书脊边互相折向对方。
 * 墙顶贴到平分面后，三角整片落在平分面里，与对面那片正面相贴、平行叠在一起。
 */
function flapAngle(wedge: number, standDeg: number, T: number, H: number) {
  if (wedge >= 179.9) return 0
  const h = (wedge / 2) * DEG
  const b = standDeg * DEG
  const L = Math.hypot(T, H)
  const sh = Math.sin(h)
  const ch = Math.cos(h)
  const sb = Math.sin(b)
  const cb = Math.cos(b)
  const A = T * (H * sh + T * sb * ch)
  const B = -T * L * cb * ch
  const C = T * H * sh - H * H * sb * ch
  const g = Math.atan2(B, A) + Math.acos(clamp(C / Math.hypot(A, B), -1, 1))
  return clamp(g / DEG, 0, 180)
}

function Pop({ layer, beta, rank, wall, side, flapDeg = 0, wallH = 340, slotId, picked, onMeasure }: {
  layer: Layer
  beta: number
  rank: number
  wall?: boolean
  side?: 'left' | 'right'
  /** 背景墙靠书脊的三角折翼向内折的角度 */
  flapDeg?: number
  wallH?: number
  /** 这个纸片对应的模板槽位 id；点它时高亮并定位到右侧菜单 */
  slotId?: string
  picked?: boolean
  onMeasure: (h: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // 只在尺寸真的变了时重量一次。之前没有依赖数组，翻页时每一帧都会对每个纸片
  // 读一次 offsetHeight，几十个纸片就是几十次强制同步布局，翻页直接掉帧。
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const report = () => {
      const h = el.offsetHeight
      if (h > 0) onMeasure(h)
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const left = layer.x - layer.w / 2
  // 命中靠 data-slot：指针捕获后 click 会落到 stage 上，所以选中由 stage 在 pointerup 里判断
  if (layer.flat) {
    return (
      <div
        className={`pb-flat ${picked ? 'is-picked' : ''}`}
        data-slot={slotId}
        style={{ left, top: layer.y, width: layer.w, transform: `translateZ(0.3px) translateY(-50%) rotate(${layer.rot ?? 0}deg)` }}
      >
        {layer.art}
        {picked && <i className="pb-pickdot" />}
      </div>
    )
  }

  // 全部向读者一侧折；墙在最后面，始终不比前面的纸片平。
  const stand = beta
  // 纸片绕底边向后倒（-stand）：顶端始终落在自己的底边以内、且始终在纸面之前，
  // 所以折叠过程中不会甩到书页外面，也不会翻成镜像。
  // 墙要沿用 -180 + stand，它的三角折翼角度是按这个姿态解出来的。
  const angle = wall ? -180 + stand : -stand
  const k = Math.sin(beta * DEG)
  // 越靠后的纸片折平后压在越上面，各留一层纸的厚度。
  // 这些偏移必须远小于翻页纸两面离纸心的 1px：
  // 否则翻页纸盖过来时，折平/压扁的剪纸会从翻页纸上透出来。
  const z = wall ? 0.04 : 0.05 + rank * 0.05
  const bottom = PH - layer.y

  return (
    <>
      {!wall && (
        <div
          className="pb-cast"
          style={{ left: left + layer.w * 0.08, width: layer.w * 0.84, bottom, height: layer.w * 0.4, opacity: k * 0.8, transform: `translateZ(0.03px) scaleY(${k})` }}
        />
      )}
      {!wall && <div className="pb-tab" style={{ left: layer.x - layer.w * 0.32, width: layer.w * 0.64, top: layer.y - 5, transform: `translateZ(${z - 0.15}px)` }} />}
      <div
        className={`pb-pop ${wall ? 'pb-wall' : ''} ${picked ? 'is-picked' : ''}`}
        data-slot={slotId}
        style={{ left, width: layer.w, bottom, transform: `translateZ(${z}px) rotateX(${angle}deg)` }}
      >
        {wall && flapDeg < 0.3 ? (
          // 未折时整张渲染，避免两块裁剪拼接处露出斜线
          <Sheet art={layer.art} measureRef={ref} />
        ) : wall ? (() => {
          const w = layer.w
          const T = WALL_TAPER
          const L = side === 'left'
          // 斜折痕：书脊底 → 离书脊 T 的墙顶
          const main: Poly = L
            ? [[0, '0'], [w - T, '0'], [w, '100%'], [0, '100%']]
            : [[T, '0'], [w, '0'], [w, '100%'], [0, '100%']]
          // 折下去的三角和主体共用折痕这条边，再往主体方向多留 3px；
          // 这 3px 落在主体背后（见 translateZ），接缝被主体挡住，既不漏缝也不会错位成台阶
          const tri: Poly = L
            ? [[w - T - 3, '0'], [w, '0'], [w, '100%']]
            : [[0, '0'], [T + 3, '0'], [0, '100%']]
          return (
            <>
              <Sheet art={layer.art} measureRef={ref} poly={main} w={w} />
              {/* 靠书脊的三角沿斜折痕向内（朝墙正面）折进来，合书时不越过书脊 */}
              <div
                className="pb-flap"
                style={{
                  transformOrigin: L ? '100% 100%' : '0 100%',
                  transform: `translateZ(-0.15px) rotate3d(${L ? T : -T}, ${wallH}, 0, ${(L ? -1 : 1) * flapDeg}deg)`,
                }}
              >
                <Sheet art={layer.art} poly={tri} w={w} />
              </div>
            </>
          )
        })() : (
          <Sheet art={layer.art} measureRef={ref} />
        )}
        {/* 0×0 角标：选中时用来量纸片真正的右上角（屏幕坐标） */}
        {picked && <i className="pb-pickdot" />}
      </div>
    </>
  )
}

/** wedge：这一页和与它构成跨页的另一页之间的夹角（完全摊开 180°，合上 0°） */
function Page({ spread, side, wedge, capTan, pickedSlot, style }: {
  spread: Spread
  side: 'left' | 'right'
  wedge: number
  /** 翻页纸此刻压在**本页**上方时的倾角正切（0 = 完全贴住，页上纸片必须压平）；
   *  翻页纸没压在本页上时传 undefined 表示不限制 */
  capTan?: number
  /** 当前选中的槽位 id，用来给对应的纸片描边 */
  pickedSlot?: string | null
  style?: CSSProperties
}) {
  const layers = side === 'left' ? spread.left : spread.right
  const [heights, setHeights] = useState<Record<string, number>>({})
  const measure = (key: string) => (h: number) => setHeights((m) => (m[key] === h ? m : { ...m, [key]: h }))

  // 越靠后（y 越小）的纸片折平后越在上面
  const order = layers
    .map((l, i) => ({ l, i }))
    .filter((o) => !o.l.flat)
    .sort((a, b) => b.l.y - a.l.y)
  const rank = new Map(order.map((o, r) => [o.i, r]))

  // 每张纸片按自己离书脊的距离算上限角；再保证前排不比后排更立（x 范围重叠时），
  // 前后两张纸都向前倒、前排更平，截面上两条线永不相交。
  const cap = (dist: number, h: number, b: number) =>
    capTan === undefined
      ? b
      : Math.min(b, Math.asin(clamp((Math.max(dist, 0) / Math.max(h, 1)) * capTan, 0, 1)) / DEG)

  const wallH = heights.wall ?? 340
  // 墙顶（离书脊 T 处）刚好落在翻页纸和本页的平分面上：三角折翼正好折到平分面，
  // 不会折过头越过书脊穿进对面页
  const betaWall = cap(WALL_TAPER, wallH, standAngle(wedge, WALL_TAPER / wallH))
  const wallStandDeg = betaWall
  const flapDeg = flapAngle(wedge, wallStandDeg, WALL_TAPER, wallH)
  // 折到平分面，再多压一点点（0.6°）：翻页纸那一面比纸页高半像素，
  // 两片三角如果严格停在平分面上，书脊处会留一条发丝宽的白缝。
  // 稍微折过头，两片三角变成轻微互相压盖，缝就被自己盖掉了（0.6° 肉眼看不出）。
  const flapFold = wedge >= 179.9 || flapDeg < 0.3 ? Math.min(flapDeg, 180) : Math.min(180, flapDeg + 0.6)
  const span = (l: Layer) => [l.x - l.w / 2, l.x + l.w / 2]
  const back = [...order].reverse()
  const beta = new Map<number, number>()
  back.forEach(({ l, i }, k) => {
    const s = side === 'left' ? PW - (l.x + l.w / 2) : l.x - l.w / 2
    let b = Math.min(betaWall, standAngle(wedge, Math.max(0, s) / (heights[i] ?? l.w)))
    b = cap(s, heights[i] ?? l.w, b)
    const [x0, x1] = span(l)
    for (const o of back.slice(0, k)) {
      const [y0, y1] = span(o.l)
      if (o.l.y < l.y && y0 < x1 && x0 < y1) b = Math.min(b, beta.get(o.i)!)
    }
    beta.set(i, b)
  })

  return (
    <div className={`pb-page pb-${side}`} style={style}>
      <div className="pb-paper" style={{ backgroundColor: spread.page }}>
        {spread.dots && <div className="pb-dots" style={{ '--dot': spread.dots } as CSSProperties} />}
      </div>
      {side === 'left' && spread.text && (
        <div className="pb-flat pb-card" style={{ left: 34, top: 418, width: 310, transform: 'translateZ(0.3px) rotate(-2deg)' }}>
          <b>{spread.sub}</b>
          {spread.text}
        </div>
      )}
      {layers.map((l, i) => (
        <Pop
          key={i}
          layer={l}
          beta={beta.get(i) ?? 0}
          rank={rank.get(i) ?? 0}
          slotId={l.id}
          picked={!!l.id && l.id === pickedSlot}
          onMeasure={measure(String(i))}
        />
      ))}
      {/* 墙向书脊多伸 1px 与对面墙重叠，消除接壤处的抗锯齿细线；
          两面墙始终共面，这 1px 只在同一平面内重叠，不会越出书脊 */}
      <Pop
        wall
        layer={{ art: side === 'left' ? spread.wallLeft : spread.wallRight, x: PW / 2 + (side === 'left' ? 0.5 : -0.5), y: WALL_Y, w: PW + 1 }}
        beta={betaWall}
        side={side}
        wallH={wallH}
        flapDeg={flapFold}
        rank={order.length}
        slotId={side === 'left' ? spread.wallLeftId : spread.wallRightId}
        picked={(side === 'left' ? spread.wallLeftId : spread.wallRightId) === pickedSlot}
        onMeasure={measure('wall')}
      />
    </div>
  )
}

type Gesture = {
  mode: 'flip' | 'turn'
  x: number
  y: number
  start: number
  rx: number
  rz: number
  moved: boolean
  lp: number
  lt: number
  v: number
  /** 按下时落在哪个槽位的纸片上；抬手没拖动就当成点选 */
  pick: string | null
}

export default function PopupBook({ book = spreads, title = BOOK_TITLE, overlay, reserve = 0, pageIndex, onPageIndex, locked = false, pickedSlot, onPickSlot, onSlotAction }: {
  book?: Spread[]
  title?: string
  /** 画在书上面的 UI（制作面板、裁剪弹层），不参与书本手势 */
  overlay?: ReactNode
  /** 右侧要给面板让出的宽度，书本会缩一点并往左挪，避免被面板压住 */
  reserve?: number
  /** 外部指定翻到第几个跨页；编辑器点某一页时用 */
  pageIndex?: number
  /** 翻到哪一页了，用来让编辑器跟着书走 */
  onPageIndex?: (i: number) => void
  /** 制作模式：锁死翻页，拖书页只转视角，页数靠右侧的页签切换 */
  locked?: boolean
  /** 当前选中的槽位 id：对应的纸片会被描边 */
  pickedSlot?: string | null
  /** 点书页上的纸片：回传它对应的槽位 id（再点一次传回同一个 id，由父组件取消选中） */
  onPickSlot?: (id: string) => void
  /** 选中纸片右上角那两个按钮：换素材 / 移除（背景和地面不给移除） */
  onSlotAction?: (id: string, action: 'switch' | 'clear') => void
}) {
  const n = book.length
  const [pos, setPos] = useState(0)
  const posRef = useRef(0)
  const targetRef = useRef(0)
  const raf = useRef(0)
  const [scale, setScale] = useState(1)
  const [view, setView] = useState(DEFAULT_VIEW)
  const [mode, setMode] = useState<Gesture['mode'] | null>(null)
  // 窄屏时面板压在下面，书本要整体往上抬，否则会被面板盖住
  const [lift, setLift] = useState(0)
  // 视角模式：打开后在书页上拖动也是转视角，不用去点书外那一圈空白
  const [spin, setSpin] = useState(false)
  // 边缘拉动独立于翻页进度，回弹时不会让另一页重新渲染/移动。
  const [edgePull, setEdgePull] = useState(0)
  const gesture = useRef<Gesture | null>(null)
  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // 测按钮位置用的 rAF 句柄，必须和翻页动画的 raf 分开，否则会互相取消
  const pickRaf = useRef(0)
  // 选中纸片右上角内侧的屏幕锚点（纸片在 3D 里是斜的，按钮不能挂在纸片里）
  const [pickBox, setPickBox] = useState<{ x: number; y: number } | null>(null)
  // 回调放进 ref，翻页过程中不会因为父组件重渲染而反复触发
  const report = useRef(onPageIndex)
  report.current = onPageIndex

  const apply = (p: number) => {
    posRef.current = p
    setPos(p)
  }

  const animateTo = useCallback((target: number) => {
    cancelAnimationFrame(raf.current)
    targetRef.current = target
    const from = posRef.current
    const dist = Math.abs(target - from)
    if (dist < 1e-4) return apply(target)
    // 从书外拉回来用回弹曲线，正常翻页用缓入缓出
    const rebound = from < 0 || from > n - 1
    // 一页 800ms 左右最跟手；之前一页要 1.6s，松手后半天不动，感觉像卡住
    const dur = rebound ? 560 : 420 + 380 * Math.min(dist, 1.5)
    const t0 = performance.now()
    const step = (now: number) => {
      // rAF 的时间戳是帧开始时刻，可能早于 t0
      const k = clamp((now - t0) / dur, 0, 1)
      apply(from + (target - from) * (rebound ? easeOutBack(k) : ease(k)))
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }, [n])

  const go = useCallback((dir: number) => animateTo(clamp(targetRef.current + dir, 0, n - 1)), [animateTo, n])

  // 删页后页数变少，把翻页进度收回到范围内
  useEffect(() => {
    if (posRef.current > n - 1) {
      const p = clamp(posRef.current, 0, n - 1)
      posRef.current = p
      targetRef.current = p
      setPos(p)
    }
  }, [n])

  // 报告当前落在哪一页，父组件据此高亮页签
  const lastIdx = useRef(0)
  useEffect(() => {
    const idx = clamp(Math.round(pos), 0, n - 1)
    if (idx === lastIdx.current) return
    lastIdx.current = idx
    report.current?.(idx)
  }, [pos, n])

  // 外部切换页签：把书滚到那一页。
  // 这里必须排除「自己回传出去的那个页号」：翻到一半时 pos 从 x.49 跨到 x.51，
  // round 出来的页号变了、我们回调父组件，父组件又把 pageIndex 写回来，
  // 这个 effect 就会以为外面要求换页，把正在跑的动画取消掉重新计时 ——
  // 表现就是翻页到中间突然顿一下。
  useEffect(() => {
    if (pageIndex === undefined) return
    const i = clamp(pageIndex, 0, n - 1)
    if (i === lastIdx.current) return
    if (Math.abs(posRef.current - i) < 1e-3) {
      lastIdx.current = i
      return
    }
    animateTo(i)
  }, [pageIndex, n, animateTo])

  // 选中纸片的屏幕锚点：书转视角、缩放、翻页、面板开合都会变，
  // 所以选中期间逐帧量一次（只查一个选择器，代价很小），按钮永远贴在纸片里。
  // 同一个槽位在翻页纸的两面各有一份，只取当前真正可见、面积最大的那个。
  useEffect(() => {
    if (!pickedSlot) return
    let alive = true
    let last = ''
    let kept: Element | null = null
    const measure = () => {
      if (!alive) return
      const nodes = stageRef.current
        ? [...stageRef.current.querySelectorAll(`[data-slot="${pickedSlot}"]`)]
        : []
      const usable = (el: Element) => {
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return null
        const r = el.getBoundingClientRect()
        return r.width < 2 || r.height < 2 ? null : r
      }
      // 翻页纸那两面是镜像的，两面同时可见时来回挑会让按钮跳。
      // 优先沿用上一帧的那个节点，只要它还看得见。
      let target: Element | null = kept && nodes.includes(kept) && usable(kept) ? kept : null
      let best = target ? usable(target) : null
      if (!target) {
        for (const el of nodes) {
          const r = usable(el)
          if (!r) continue
          if (best && r.width * r.height <= best.width * best.height) continue
          best = r
          target = el
        }
      }
      kept = target
      let anchor: { x: number; y: number } | null = null
      if (target && best) {
        // 纸片在 3D 里是斜的，AABB 的右上角会跑到纸片外面。
        // 选中时纸片里会渲染一个 0×0 的角标，它的屏幕位置就是真正的右上角。
        const dot = (target.querySelector('.pb-pickdot') as HTMLElement | null)?.getBoundingClientRect()
        const corner = dot && dot.width < 2 ? { x: dot.x, y: dot.y } : { x: best.right, y: best.top }
        // 按钮组以「两者的中心」落在锚点上，所以锚点从角上往里让半个按钮组的尺寸，
        // 这样它既在虚线框里，转视角时也只会跟着平移，不会绕着边角甩出去
        anchor = { x: corner.x - 32, y: corner.y + 17 }
      }
      const key = anchor ? `${Math.round(anchor.x)},${Math.round(anchor.y)}` : ''
      if (key !== last) {
        last = key
        setPickBox(anchor)
      }
      pickRaf.current = requestAnimationFrame(measure)
    }
    measure()
    return () => {
      alive = false
      cancelAnimationFrame(pickRaf.current)
    }
  }, [pickedSlot])

  const reboundEdge = useCallback((from: number) => {
    cancelAnimationFrame(raf.current)
    const t0 = performance.now()
    const step = (now: number) => {
      const k = clamp((now - t0) / 560, 0, 1)
      // overshoot 会让纸边轻轻超过原位，再回到 0。
      const v = from * (1 - easeOutBack(k))
      setEdgePull(v)
      if (k < 1) raf.current = requestAnimationFrame(step)
      else setEdgePull(0)
    }
    raf.current = requestAnimationFrame(step)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    const fit = () => {
      const wide = window.innerWidth > 900
      // 宽屏：面板在右边，让出横向空间；窄屏：面板在下面，让出竖向空间
      const padX = wide ? Math.min(reserve, window.innerWidth * 0.42) : 0
      const padY = wide || !reserve ? 0 : Math.min(window.innerHeight * 0.44, 420)
      root?.style.setProperty('--pb-shift', `${-padX / 2}px`)
      // 窄屏且有面板时，底部控制条要抬到面板上方
      root?.style.setProperty('--pb-foot', wide || !reserve ? '22px' : 'calc(min(42vh, 400px) + 24px)')
      setLift(padY / 2)
      setScale(clamp(
        Math.min((window.innerWidth - padX) / 1150, (window.innerHeight - 190 - padY) / 790),
        0.28,
        1.25,
      ))
    }
    const key = (e: KeyboardEvent) => {
      // 制作模式锁了翻页：方向键交给编辑器，不再翻书
      if (locked) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    fit()
    window.addEventListener('resize', fit)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('keydown', key)
    }
  }, [go, reserve, locked])

  /** 把屏幕上的拖动投影到书本自身的左右方向，书转了任意角度都能顺着书页拖。 */
  const alongBook = (dx: number, dy: number) => {
    const r = (view.rz * Math.PI) / 180
    return dx * Math.cos(r) + dy * Math.sin(r)
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const onBook = !!(e.target as Element).closest('.pb-book')
    if (onBook) cancelAnimationFrame(raf.current)
    setEdgePull(0)
    gesture.current = {
      // 视角模式下（或制作模式锁了翻页），在书页上拖也是转视角；否则书内翻页、书外转视角
      mode: onBook && !spin && !locked ? 'flip' : 'turn',
      x: e.clientX,
      y: e.clientY,
      start: posRef.current,
      rx: view.rx,
      rz: view.rz,
      moved: false,
      lp: 0,
      lt: performance.now(),
      v: 0,
      // 指针捕获后 click 会派发到 stage 上，所以在这里记下降落点对应的槽位
      pick: onPickSlot
        ? ((e.target as Element).closest('[data-slot]')?.getAttribute('data-slot') ?? null)
        : null,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setMode(gesture.current.mode)
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.hypot(dx, dy) > 5) g.moved = true
    if (!g.moved) return
    if (g.mode === 'turn') {
      // 系数调小一点，触摸拖动 100px 大约转 20°，不至于一碰就飞
      setView((v) => ({ ...v, rz: g.rz - dx * 0.22, rx: clamp(g.rx - dy * 0.18, 4, 82) }))
      return
    }
    const p = alongBook(dx, dy)
    const now = performance.now()
    g.v = g.v * 0.5 + ((p - g.lp) / Math.max(1, now - g.lt)) * 0.5
    g.lp = p
    g.lt = now
    const raw = g.start - p / (PW * scale * view.zoom * 1.15)
    if (g.start === 0 && raw < 0) {
      // 第一页只掀左页，pos 仍然保持 0，右页完全不参与。
      setEdgePull(rubber(-raw))
      return
    }
    if (g.start === n - 1 && raw > n - 1) {
      // 最后一页只掀右页，pos 仍然保持 n - 1。
      setEdgePull(-rubber(raw - (n - 1)))
      return
    }
    setEdgePull(0)
    apply(clamp(raw, 0, n - 1))
  }

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    setMode(null)
    if (!g) return
    if (g.mode === 'turn') {
      // 只点了一下（没拖动）且落在纸片上时，选中它并定位到右侧菜单
      if (!g.moved && g.pick) onPickSlot?.(g.pick)
      return
    }
    if (edgePull !== 0) {
      reboundEdge(edgePull)
      return
    }
    if (!g.moved) {
      targetRef.current = Math.round(posRef.current)
      return go(alongBook(e.clientX - window.innerWidth / 2, e.clientY - window.innerHeight / 2) > 0 ? 1 : -1)
    }
    const p = posRef.current
    const target = g.v < -0.2 ? Math.ceil(p) : g.v > 0.2 ? Math.floor(p) : Math.round(p)
    animateTo(clamp(target, 0, n - 1))
  }

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    setView((v) => ({ ...v, zoom: clamp(v.zoom * Math.exp(-e.deltaY * 0.0012), 0.55, 1.9) }))
  }

  // 翻页进度：a→a+1，t∈[0,1)。
  // 关键：pos 落在最后一页时，旧算法把 a 钳在 n-2、t=1，左页夹角变成 0° ——
  // 左半整页趴平、右半立着，就是截图里「翻完有一页没立起来」。
  // 解决：t 走到 1 就进位成下一页的摊开态（t=0），最后一页也能左右都立着。
  let a = n < 2 ? 0 : clamp(Math.floor(pos), 0, n - 2)
  let t = n < 2 ? 0 : clamp(pos - a, 0, 1)
  if (t >= 1 - 1e-6) {
    a = clamp(a + 1, 0, n - 1)
    t = 0
  }
  const A = book[a]
  const B = book[Math.min(a + 1, n - 1)] ?? A
  const s = scale * view.zoom
  const overL = Math.max(0, edgePull) * 180
  const overR = Math.max(0, -edgePull) * 180
  // 同一跨页的两页共用同一个夹角，两面墙的折翼才能镜像对齐。
  const wedgeFront = edgePull > 0 ? 180 - overL : 180 * (1 - t)
  const wedgeBack = edgePull < 0 ? overR : 180 * t
  // 翻页纸的转动：正常翻页量 + 往前翻时的掀角
  const sheetDeg = 180 * t + (edgePull < 0 ? overR : 0)
  // 贴合度：θ=0°/180° 时为 1（与书页共面），θ=90° 时为 0（竖直，不穿模）。
  // 被盖住的那一页按贴合度下沉最多 PAGE_GAP，翻页纸仍停在 PAGE_Z —— 共面时刚好错开一层纸。
  const adhere = Math.abs(Math.cos(sheetDeg * DEG))
  const zL = PAGE_Z - (sheetDeg > 90 ? adhere : 0) * PAGE_GAP
  const zR = PAGE_Z - (sheetDeg < 90 ? adhere : 0) * PAGE_GAP
  const leafZ = PAGE_Z
  // 书脊的纸厚（纯视觉）：页数越多越厚，纸页平面本身不动
  const THICK = clamp(18 + n * 6, 20, 54)
  // 翻页纸压着哪一侧，那一侧的剪纸就不能高过纸面。
  const sheetTan = Math.min(Math.abs(Math.tan(sheetDeg * DEG)), 40)
  const capL: number | undefined = t > 0.5 ? sheetTan : undefined
  const capR: number | undefined = t < 0.5 ? sheetTan : undefined
  const index = clamp(Math.round(pos), 0, n - 1)
  const current = book[index]
  const page = index + 1

  return (
    <main className="pb-root" ref={rootRef}>
      <DiecutDefs />
      <header className="pb-head">
        <span>{title} · {current.sub}</span>
        <h1>{current.title}</h1>
      </header>

      <div
        ref={stageRef}
        className={`pb-stage ${mode ? `is-${mode}` : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        onDoubleClick={(e) => !(e.target as Element).closest('.pb-book') && setView(DEFAULT_VIEW)}
      >
        <div
          className={`pb-book ${onPickSlot ? 'is-pickable' : ''} ${locked ? 'is-editing' : ''}`}
          style={{ transform: `translate3d(0, ${80 * scale - lift}px, 0) scale3d(${s}, ${s}, ${s}) rotateX(${view.rx}deg) rotateZ(${view.rz}deg)` }}
        >
          <div className="pb-floor-shadow" />
          {/* 书的厚度：只是纸页平面下方的一圈纸边，不参与翻页 */}
          <div
            className="pb-slab"
            style={{ transform: `translateZ(${PAGE_Z}px)`, '--t': `${THICK}px` } as CSSProperties}
          >
            <i className="pb-slab-face edge-bottom" />
            <i className="pb-slab-face edge-left" />
            <i className="pb-slab-face edge-right" />
          </div>
          <div className="pb-cover" style={{ transform: `translateZ(${PAGE_Z - THICK - 3}px)` }} />
          {/* 左页 = 当前跨页左半；右页 = 下一跨页右半（t>0 就露）。
              翻完进位后 t=0，左右都按 180° 立着。 */}
          <Page
            key={`bl${a}`}
            spread={A}
            side="left"
            wedge={wedgeFront}
            capTan={capL}
            pickedSlot={pickedSlot}
            style={{ transformOrigin: '100% 50%', transform: overL ? `translateZ(${PAGE_Z}px) rotateY(${overL}deg)` : `translateZ(${zL}px)` }}
          />
          <Page
            key={`br${a}`}
            spread={B}
            side="right"
            wedge={wedgeBack}
            capTan={capR}
            pickedSlot={pickedSlot}
            style={{ visibility: (t < 0.0005 && edgePull >= 0) || a >= n - 1 ? 'hidden' : undefined, transformOrigin: '0 50%', transform: `translateZ(${zR}px)` }}
          />

          <div className="pb-leaf" style={{ transform: `translateZ(${leafZ}px) rotateY(${-sheetDeg}deg)` }}>
            {/* 正面 = 当前右半；背面 = 下一跨页左半。
                翻到位时背面正好就是新跨页的左半，和进位后的摊开态接得上；
                若背面仍画当前页，最后一页会停在「左趴右立」。 */}
            <div className={`pb-face ${t < 0.999 ? '' : 'pb-nopops'}`}>
              <Page key={`lf${a}`} spread={A} side="right" wedge={wedgeFront} pickedSlot={pickedSlot} style={{ left: 0 }} />
            </div>
            <div className={`pb-face back ${t > 0.001 ? '' : 'pb-nopops'}`}>
              <Page key={`lb${a}`} spread={B} side="left" wedge={wedgeBack} pickedSlot={pickedSlot} style={{ left: 0 }} />
            </div>
          </div>
        </div>
      </div>

      {/* 选中纸片右上角的浮动按钮。放在 stage 外面：stage 会捕获指针，里面的按钮点不到 */}
      {pickedSlot && pickBox && (
        <div className="pb-pickbar" style={{ left: pickBox.x, top: pickBox.y }}>
          <button
            type="button"
            className="pb-pickbtn is-switch"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onSlotAction?.(pickedSlot, 'switch')}
            title="更换素材"
            aria-label="更换素材"
          >⇄</button>
          {!current.locked?.includes(pickedSlot) && (
            <button
              type="button"
              className="pb-pickbtn is-clear"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSlotAction?.(pickedSlot, 'clear')}
              title="移除这个模块"
              aria-label="移除这个模块"
            >×</button>
          )}
        </div>
      )}

      {overlay}

      <footer className="pb-foot">
        <div className="pb-tip">
          {locked
            ? '右侧面板编辑 · 拖动书页转视角 · 滚轮缩放 · 点纸片定位到对应素材'
            : spin ? '拖动任意位置旋转视角 · 再点一次「视角」回到翻页' : '拖动书页翻页 · 拖动空白处旋转 · 滚轮缩放'}
        </div>
        <nav>
          <button onClick={() => setSpin((v) => !v)} className={`pb-tool ${spin ? 'is-on' : ''}`} aria-pressed={spin}>视角</button>
          <button onClick={() => go(-1)} disabled={locked || page === 1} aria-label="上一页">‹</button>
          <span>第 {page} / {n} 页</span>
          <button onClick={() => go(1)} disabled={locked || page === n} aria-label="下一页">›</button>
          <button onClick={() => setView(DEFAULT_VIEW)} className="pb-tool" aria-label="复位视角">复位</button>
        </nav>
      </footer>
    </main>
  )
}
