import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type Ref, type WheelEvent } from 'react'
import { DiecutDefs } from './art'
import FxLayer from './fx'
import type { Fx } from './effects'
import observeSize from './observeSize'
import { spreads, type Layer, type Spread } from './spreads'

const PW = 500
const PH = 560
const WALL_Y = 92
// 书页的基准平面。翻页纸纸心也钉在这里；它的正反面各离纸心 ±1（见 .pb-face）。
const PAGE_Z = 4.6
// 不同页翻平后会共面，深度排序会穿模。被翻页纸盖住的那一页最多往下沉这么多，
// 沉量随贴合度 |cos θ| 动态变化：贴得越平沉得越多，竖直时为 0。
const PAGE_GAP = 1
// 默认正对书本，左右书页保持同一水平线；旋转只在用户拖动空白处后发生。
const qv = (k: string, d: number) => {
  const raw = new URLSearchParams(location.search).get(k)
  if (raw === null) return d
  const v = Number(raw)
  return Number.isFinite(v) ? v : d
}
// rx 可以用 ?rx=12 覆盖，用来给宣传片挑机位；不传就是产品里的默认视角
const DEFAULT_VIEW = { rx: qv('rx', 50), rz: qv('rz', 0), zoom: qv('zoom', 1) }
/** 打开制作面板时的镜头：正对书本（和默认视角同一个 rx，不侧转），只略微缩小让出面板 */
const STUDIO_VIEW = { ...DEFAULT_VIEW, zoom: 0.94 }
/** 横屏显示：整本书顺时针转 90°，镜头本身不变，所以观感和竖屏一致 */
const LANDSCAPE_DEG = 90
/** 横屏状态下「复位」回到的视角：保留横屏方向，只把拖动过的角度收回来 */
const LANDSCAPE_VIEW = DEFAULT_VIEW
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
    return observeSize(el, () => {
      const h = el.offsetHeight
      if (h > 0) onMeasure(h)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const left = layer.x - layer.w / 2
  // 命中靠 data-slot：指针捕获后 click 会落到 stage 上，所以选中由 stage 在 pointerup 里判断
  if (layer.flat) {
    return (
      <div
        className={`pb-flat ${picked ? 'is-picked' : ''}`}
        data-slot={slotId}
        style={{ left, top: layer.y, width: layer.w, height: layer.h, transform: `translateZ(0.3px) translateY(-50%) rotate(${layer.rot ?? 0}deg)` }}
      >
        {layer.art}
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
      {/* 空槽位只剩一个虚线框，没有纸片就没有投影和折痕 */}
      {!wall && !layer.empty && (
        <div
          className="pb-cast"
          style={{ left: left + layer.w * 0.08, width: layer.w * 0.84, bottom, height: layer.w * 0.4, opacity: k * 0.8, transform: `translateZ(0.03px) scaleY(${k})` }}
        />
      )}
      {!wall && !layer.empty && <div className="pb-tab" style={{ left: layer.x - layer.w * 0.32, width: layer.w * 0.64, top: layer.y - 5, transform: `translateZ(${z - 0.15}px)` }} />}
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
      </div>
    </>
  )
}

/** wedge：这一页和与它构成跨页的另一页之间的夹角（完全摊开 180°，合上 0°） */
function PageBase({ spread, side, wedge, capTan, pickedSlot, style }: {
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
      {spread.draft && (
        <div className="pb-draft">
          <b>空白页</b>
          <span>在右侧挑一个主题，或者直接放贴纸</span>
        </div>
      )}
    </div>
  )
}

/**
 * 纸页是纯展示：只有跨页内容/夹角/压角变了才需要重画。
 * 没有 memo 的话，父组件任何一次重渲染（点按钮、切横屏、翻页动画）都会把
 * 几页 SVG 贴图连同纸片重新 diff 一遍，手机上这部分开销肉眼可见。
 */
const Page = memo(PageBase)

// 翻页纸两面共用：写对象字面量的话每次父渲染都是新引用，memo 直接失效
const FACE_POS: CSSProperties = { left: 0 }

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

export default function PopupBook({ book = spreads, overlay, reserve = 0, pageIndex, onPageIndex, locked = false, pickedSlot, onPickSlot, jumpNonce, pageFx = [], onEdit }: {
  book?: Spread[]
  /** 画在书上面的 UI（制作面板、裁剪弹层），不参与书本手势 */
  overlay?: ReactNode
  /** 右侧要给面板让出的宽度，书本会缩一点并往左挪，避免被面板压住 */
  reserve?: number
  /** 外部指定翻到第几个跨页；编辑器点某一页时用 */
  pageIndex?: number
  /** 翻到哪一页了，用来让编辑器跟着书走 */
  onPageIndex?: (i: number) => void
  /** 制作模式：锁死手势翻页（底部按键仍可翻），拖书页只转视角 */
  locked?: boolean
  /** 当前选中的槽位 id：对应的纸片会被描边 */
  pickedSlot?: string | null
  /** 点书页上的纸片：回传它对应的槽位 id（再点一次传回同一个 id，由父组件取消选中） */
  onPickSlot?: (id: string) => void
  /** 加一表示「立刻跳到 pageIndex，不要动画」：边缘空白页转正时下标会错位一格 */
  jumpNonce?: number
  /** 每一页自己的场景特效，下标和 book 一一对应 */
  pageFx?: Fx[][]
  /** 底部「制作」按钮：交给父组件开面板 */
  onEdit?: () => void
}) {
  const n = book.length
  const [pos, setPos] = useState(0)
  const posRef = useRef(0)
  const targetRef = useRef(0)
  const raf = useRef(0)
  const [scale, setScale] = useState(1)
  // 制作模式锁了手势翻页；阅读模式在书页上拖就能翻
  const [view, setView] = useState(DEFAULT_VIEW)
  // 拖拽转视角时绕开 React：直接写 CSS 变量，松手才回写 state。
  // 之前每次 pointermove 都 setView，整本书（连同上百个特效节点）每帧重渲染，
  // 手机上就是「手指跟丢 + 点击迟半拍」。
  const viewLive = useRef(DEFAULT_VIEW)
  const bookRef = useRef<HTMLDivElement>(null)
  const fxRef = useRef<HTMLDivElement>(null)
  // 每次渲染更新一份「书在屏幕上的摆放」，拖拽时不用等重渲染就能拼出 transform
  const tfRef = useRef({ s: 1, y: 0 })
  /**
   * 注意别用 CSS 变量传视角：自定义属性是继承的，写在 .pb-book 上会让整本书
   * （几页 SVG + 所有纸片）每帧重算样式，比 React 重渲染还慢。这里直接拼
   * transform 字符串写到一个元素上，只失效这一个节点。
   */
  const bookTf = useCallback((rx: number, rz: number) => {
    const { s, y } = tfRef.current
    return `translate3d(var(--pb-shift, 0px), ${y}px, 0) scale3d(${s}, ${s}, ${s}) rotateX(${rx}deg) rotateZ(${rz}deg)`
  }, [])
  /**
   * 粒子的朝向变量是「继承属性」：改一次，上百颗粒子全都要重算样式
   * （实测 6x 降频下 40 次写入 ≈ 900ms 主线程，这就是手机上拖不动的原因）。
   * 但旋转过程中朝向差个几度肉眼根本看不出来，所以按角度量化：转过 8° 才写一次，
   * 松手时再补一次精确值。
   */
  const bbApplied = useRef({ rx: 999, rz: 999 })
  const paintView = useCallback((rx: number, rz: number, force = false) => {
    const el = bookRef.current
    if (el) el.style.transform = bookTf(rx, rz)
    const last = bbApplied.current
    if (!force && Math.abs(rx - last.rx) + Math.abs(rz - last.rz) < 8) return
    bbApplied.current = { rx, rz }
    // 变量只挂在特效容器上，失效范围就是那几十上百颗粒子，别提升到书本根节点
    fxRef.current?.style.setProperty('--bb', `rotateZ(${-rz}deg) rotateX(${-rx}deg)`)
  }, [bookTf])
  // state 是唯一真相：复位、URL 机位、进退制作模式都会走这里，DOM 变量跟着同步
  useEffect(() => {
    viewLive.current = view
    paintView(view.rx, view.rz, true)
  }, [view, paintView])
  // 横屏显示：把整本书在屏幕平面上转 90°，只是方向变了，书本本身、翻页几何都不动
  const [landscape, setLandscape] = useState(false)
  const [mode, setMode] = useState<Gesture['mode'] | null>(null)
  // 打开制作面板时镜头微微侧一点、缩一点，让出右侧空间；收起时回到默认视角
  useEffect(() => {
    setView(locked ? STUDIO_VIEW : DEFAULT_VIEW)
  }, [locked])
  // 制作模式要竖着看书：进去时先收起横屏，退出后再还原成进来前的状态
  const wasLandscape = useRef(false)
  useEffect(() => {
    if (locked) {
      wasLandscape.current = landscape
      if (landscape) setLandscape(false)
    } else if (wasLandscape.current) {
      wasLandscape.current = false
      setLandscape(true)
    }
    // 只在进出制作模式时跑；编辑过程中点横屏不该改「退出后是否恢复」的记录
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked])
  // 窄屏时面板压在下面，书本要整体往上抬，否则会被面板盖住
  const [lift, setLift] = useState(0)
  // 横屏时书本在「深度轴」上要横向归中，挪的是内部 Y（转 90° 后是屏幕横向）
  const [landY, setLandY] = useState(0)
  // 边缘拉动独立于翻页进度，回弹时不会让另一页重新渲染/移动。
  const [edgePull, setEdgePull] = useState(0)
  const gesture = useRef<Gesture | null>(null)
  // 操作说明弹层：右下角问号按钮打开，点遮罩/「知道了」/Esc 关掉
  const [help, setHelp] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
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

  // 边缘空白页转正时，前面会补一张新的空白页，当前下标整体 +1；
  // 直接跳过去（不动画），视觉上仍停在刚刚那一页。
  const jumpRef = useRef(jumpNonce)
  useEffect(() => {
    if (jumpNonce === undefined || jumpNonce === jumpRef.current) return
    jumpRef.current = jumpNonce
    if (pageIndex === undefined) return
    const i = clamp(pageIndex, 0, n - 1)
    cancelAnimationFrame(raf.current)
    posRef.current = i
    targetRef.current = i
    lastIdx.current = i
    setPos(i)
  }, [jumpNonce, pageIndex, n])

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
      const W = window.innerWidth
      const H = window.innerHeight
      if (landscape) {
        // 横屏：整幅已顺时针转 90°，所以屏幕横轴 = 书本的深度轴（560），
        // 屏幕竖轴 = 书本的宽度轴（1000）。
        // 但书本框只有 1000×560，立起来的贴纸、书脊、封面都在框外还伸出一圈，
        // 实测屏幕上的真实占地是 ≈ 665·s 宽 × 1090·s 高：
        // 只按 560/1000 算，窄屏（如 390 宽）会横向溢出几十 px。
        const LAND_W = 672
        const LAND_H = 1096
        const side = 12            // 屏幕左右安全边
        const top = 48             // 屏幕顶部留白
        const bottom = 92          // 底部控制条 + 安全距离
        const s = clamp(
          Math.min((W - side * 2) / LAND_W, (H - top - bottom) / LAND_H),
          0.14,
          1.1,
        )
        // 竖轴（内部 X，正方向 = 屏幕向下）：把占地摆在「去掉上下留白后」的正中
        root?.style.setProperty('--pb-shift', `${(top - bottom) / 2}px`)
        // 横轴：贴纸在深度轴上偏一侧，实测占地中心比屏幕中心偏右 ≈ 64·s，
        // 内部 Y 正方向 = 屏幕向左，所以往左推回 64·s 就正中了。
        setLandY(64 * s)
        setLift(0)
        setScale(s)
        return
      }
      const wide = W > 900
      // 宽屏：面板在右边，让出横向空间；窄屏：面板在下面，让出竖向空间
      const padX = wide ? Math.min(reserve, W * 0.42) : 0
      const padY = wide || !reserve ? 0 : Math.min(H * 0.44, 420)
      const availW = W - padX
      const availH = H - padY
      root?.style.setProperty('--pb-shift', `${-padX / 2}px`)
      setLandY(0)
      // 底部控制条的位置固定不动：进出制作模式只挪书本，按键不跳位
      setLift(padY / 2)
      setScale(clamp(
        Math.min(availW / 1150, (availH - 190) / 790),
        0.28,
        1.25,
      ))
    }
    const key = (e: KeyboardEvent) => {
      // 制作模式锁了翻页：方向键交给编辑器，不再翻书
      if (locked) return
      if (help) return
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
  }, [go, reserve, locked, landscape, help])

  // 说明弹层开着时，Esc 只负责关掉它
  useEffect(() => {
    if (!help) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setHelp(false) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [help])

  /** 把屏幕上的拖动投影到书本自身的左右方向，书转了任意角度都能顺着书页拖。 */
  const alongBook = (dx: number, dy: number) => {
    const r = ((viewLive.current.rz + (landscape ? LANDSCAPE_DEG : 0)) * Math.PI) / 180
    return dx * Math.cos(r) + dy * Math.sin(r)
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const onBook = !!(e.target as Element).closest('.pb-book')
    if (onBook) cancelAnimationFrame(raf.current)
    setEdgePull(0)
    gesture.current = {
      // 制作模式锁了手势翻页（底部按键仍可翻），其余情况在书页上拖就是翻页
      mode: onBook && !locked ? 'flip' : 'turn',
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
      // 系数调小一点，触摸拖动 100px 大约转 20°，不至于一碰就飞。
      // 只写 DOM，不动 state：这个分支每个 pointermove 都会走，重建整棵树太贵。
      const rx = clamp(g.rx - dy * 0.18, 4, 82)
      const rz = g.rz - dx * 0.22
      viewLive.current = { ...viewLive.current, rx, rz }
      paintView(rx, rz)
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
      // 松手才把拖出来的角度回写给 state：中间过程只写 DOM，松手一次重渲染
      const lv = viewLive.current
      // 松手补齐粒子的朝向（拖拽中间是限流的）
      paintView(lv.rx, lv.rz, true)
      if (lv.rx !== view.rx || lv.rz !== view.rz) setView((v) => ({ ...v, rx: lv.rx, rz: lv.rz }))
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
  // 翻页这 600ms 里把粒子动画暂停：一页上百颗粒子在 3D 树里跑动画，
  // 每帧都要主线程重算样式（实测占翻页耗时的 50%+），而冻结半秒肉眼看不出来。
  // 首尾各留 6% 不摘：这时候淡入淡出本来就没多少不透明度，省得粒子「啪」一下消失。
  // 边缘掀角（edgePull）全程都要摘。
  const busy = (t > 0.06 && t < 0.94) || edgePull !== 0
  // 淡入淡出量化成 10 档：--fade 是继承属性，写一次要让所有粒子重算样式
  const fadeA = Math.round((1 - t) * 10) / 10
  const fadeB = Math.round(t * 10) / 10
  const s = scale * view.zoom
  tfRef.current = { s, y: landscape ? landY : 80 * scale - lift }
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
  const page = index + 1

  return (
    <main className="pb-root" ref={rootRef}>
      <DiecutDefs />
      {/* 横屏只在这一层做 2D 转向，3D 全部留在里面 */}
      <div className={`pb-turn ${landscape ? 'is-landscape' : ''}`}>
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
            ref={bookRef}
            className={`pb-book ${onPickSlot ? 'is-pickable' : ''} ${locked ? 'is-editing' : ''}`}
            style={{ transform: bookTf(view.rx, view.rz) }}
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
              <Page key={`lf${a}`} spread={A} side="right" wedge={wedgeFront} pickedSlot={pickedSlot} style={FACE_POS} />
            </div>
            <div className={`pb-face back ${t > 0.001 ? '' : 'pb-nopops'}`}>
              <Page key={`lb${a}`} spread={B} side="left" wedge={wedgeBack} pickedSlot={pickedSlot} style={FACE_POS} />
            </div>
          </div>

          {/* 场景特效：书盒子里的三维粒子，运动走书本坐标（+Y 朝地板） */}
          {/* 特效跟着页走：翻页时当前页淡出、下一页淡入 */}
          {/* --bb 只挂在这一层：粒子朝向镜头，但不用污染书本根节点 */}
          <div className="pb-fxwrap" ref={fxRef}>
            <FxLayer key={`fx${a}`} fx={pageFx[a] ?? []} fade={fadeA} busy={busy} />
            {t > 0.001 && <FxLayer key={`fx${a + 1}`} fx={pageFx[a + 1] ?? []} fade={fadeB} busy={busy} />}
          </div>
          </div>
        </div>
      </div>

      {overlay}

      <footer className="pb-foot">
        <nav>
          {/* 翻页是一个整体模块：左右箭头和页码共用一层底，页码只留数字 */}
          <div className="pb-pager">
            {/* 编辑态也允许翻页：只是手势不翻，这两个键照样能翻 */}
            <button onClick={() => go(-1)} disabled={page === 1} aria-label="上一页">‹</button>
            <span>
              <b>{page}</b>/{n}
            </span>
            <button onClick={() => go(1)} disabled={page === n} aria-label="下一页">›</button>
          </div>
          <button onClick={() => setView(landscape ? LANDSCAPE_VIEW : DEFAULT_VIEW)} className="pb-tool" aria-label="复位视角">复位</button>
          {/* 横屏显示：整本书转 90°，再点一次回到竖屏；开着的时候按钮自己亮着 */}
          <button
            onClick={() => { setLandscape((v) => !v); setView(DEFAULT_VIEW) }}
            className={`pb-tool ${landscape ? 'is-on' : ''}`}
            aria-label="横屏显示"
            aria-pressed={landscape}
          >横屏</button>
          {onEdit && (
            <button onClick={onEdit} className="pb-tool pb-edit">制作</button>
          )}
        </nav>
      </footer>

      {/* 右下角操作说明入口：制作模式下让位给面板，不显示 */}
      {!locked && (
        <button className="pb-help-btn" onClick={() => setHelp(true)} aria-label="操作说明">?</button>
      )}

      {help && (
        <div className="pb-help" role="presentation" onClick={() => setHelp(false)}>
          <div
            className="pb-help-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pb-help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pb-help-title">怎么玩这本立体书</h3>
            <ul>
              <li><b>拖空白处</b><span>从四周的空白处按住拖动，换个角度看立体书</span></li>
              <li><b>拖着书页翻</b><span>按住纸页往左右拖，松手自动吸附到下一页</span></li>
              <li><b>点一下书页</b><span>点右半边翻下一页，点左半边回上一页</span></li>
              <li><b>双击空白处</b><span>视角跑偏了，双击空白就回到默认角度</span></li>
              <li><b>滚轮缩放</b><span>滚轮或触控板上下滑，放大看纸片上的细节</span></li>
              <li><b>底部按键</b><span>翻页、复位、横屏；「制作」可以自己改内容和特效</span></li>
            </ul>
            <button className="pb-help-ok" onClick={() => setHelp(false)}>知道了</button>
          </div>
        </div>
      )}
    </main>
  )
}
