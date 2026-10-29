import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type Ref, type WheelEvent } from 'react'
import { DiecutDefs } from './art'
import { BOOK_TITLE, spreads, type Layer, type Spread } from './spreads'

const PW = 500
const PH = 560
const WALL_Y = 92
const LEAF_Z = 3.6
// 翻页纸正面比纸心高 1px（见 .pb-face），两侧书页静止时与它齐平
const REST_Z = LEAF_Z + 1
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

function Pop({ layer, beta, rank, wall, side, flapDeg = 0, wallH = 340, onMeasure }: {
  layer: Layer
  beta: number
  rank: number
  wall?: boolean
  side?: 'left' | 'right'
  /** 背景墙靠书脊的三角折翼向内折的角度 */
  flapDeg?: number
  wallH?: number
  onMeasure: (h: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0
    if (h > 0) onMeasure(h)
  })

  const left = layer.x - layer.w / 2
  if (layer.flat) {
    return (
      <div className="pb-flat" style={{ left, top: layer.y, width: layer.w, transform: `translateZ(0.3px) translateY(-50%) rotate(${layer.rot ?? 0}deg)` }}>
        {layer.art}
      </div>
    )
  }

  // 全部向读者一侧折；墙在最后面，始终不比前面的纸片平。
  const stand = beta
  const angle = -180 + stand
  const k = Math.sin(beta * DEG)
  // 越靠后的纸片折平后压在越上面，各留一层纸的厚度。
  // 墙用统一高度，左右两面墙在书脊处严丝合缝
  const z = wall ? 3 : 0.6 + rank * 0.3
  const bottom = PH - layer.y

  return (
    <>
      {!wall && (
        <div
          className="pb-cast"
          style={{ left: left + layer.w * 0.08, width: layer.w * 0.84, bottom, height: layer.w * 0.4, opacity: k * 0.8, transform: `translateZ(0.2px) scaleY(${k})` }}
        />
      )}
      {!wall && <div className="pb-tab" style={{ left: layer.x - layer.w * 0.32, width: layer.w * 0.64, top: layer.y - 5, transform: `translateZ(${z - 0.15}px)` }} />}
      <div className={`pb-pop ${wall ? 'pb-wall' : ''}`} style={{ left, width: layer.w, bottom, transform: `translateZ(${z}px) rotateX(${angle}deg)` }}>
        {wall && flapDeg < 0.3 ? (
          // 未折时整张渲染，避免两块裁剪拼接处露出斜线
          <Sheet art={layer.art} measureRef={ref} />
        ) : wall ? (() => {
          const w = layer.w
          const T = WALL_TAPER
          const L = side === 'left'
          // 斜折痕：书脊处的折痕底端 → 离书脊 T 的墙顶
          const main: Poly = L
            ? [[0, '0'], [w - T, '0'], [w, '100%'], [0, '100%']]
            : [[T, '0'], [w, '0'], [w, '100%'], [0, '100%']]
          // 三角跨过折痕 1px 压住主体，折痕处不露底色细线
          const tri: Poly = L
            ? [[w - T - 1, '0'], [w, '0'], [w, '100%'], [w - 1, '100%']]
            : [[0, '0'], [T + 1, '0'], [1, '100%'], [0, '100%']]
          return (
            <>
              <Sheet art={layer.art} measureRef={ref} poly={main} w={w} />
              {/* 靠书脊的三角沿斜折痕向内（朝墙正面）折进来，合书时不越过书脊 */}
              <div
                className="pb-flap"
                style={{
                  transformOrigin: L ? '100% 100%' : '0 100%',
                  transform: `translateZ(${(0.3 * flapDeg) / 180}px) rotate3d(${L ? T : -T}, ${wallH}, 0, ${(L ? -1 : 1) * flapDeg}deg)`,
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
function Page({ spread, side, wedge, style }: { spread: Spread; side: 'left' | 'right'; wedge: number; style?: CSSProperties }) {
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
  const wallH = heights.wall ?? 340
  // 墙顶（离书脊 T 处）不越过平分面；墙不后仰，否则会越界逼三角多折
  const betaWall = standAngle(wedge, WALL_TAPER / wallH)
  const wallStandDeg = betaWall
  const flapDeg = flapAngle(wedge, wallStandDeg, WALL_TAPER, wallH)
  // 对面那片三角在书脊处比这片高 3px（书页纸面 + 墙层），两片按理想角折会交错；
  // 少折 1.2° 让两片的书脊边刚好碰上，既不留缝也不互相穿过
  const flapFold = wedge >= 179.9 ? 0 : clamp(flapDeg - 1.2, 0, 180)
  const span = (l: Layer) => [l.x - l.w / 2, l.x + l.w / 2]
  const back = [...order].reverse()
  const beta = new Map<number, number>()
  back.forEach(({ l, i }, k) => {
    const s = side === 'left' ? PW - (l.x + l.w / 2) : l.x - l.w / 2
    let b = Math.min(betaWall, standAngle(wedge, Math.max(0, s) / (heights[i] ?? l.w)))
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
      {side === 'left' && (
        <div className="pb-flat pb-card" style={{ left: 34, top: 418, width: 310, transform: 'translateZ(0.3px) rotate(-2deg)' }}>
          <b>{spread.sub}</b>
          {spread.text}
        </div>
      )}
      {layers.map((l, i) => <Pop key={i} layer={l} beta={beta.get(i) ?? 0} rank={rank.get(i) ?? 0} onMeasure={measure(String(i))} />)}
      {/* 墙向书脊多伸 1px，与对面墙重叠，消除接缝处的抗锯齿细线 */}
      <Pop
        wall
        layer={{ art: side === 'left' ? spread.wallLeft : spread.wallRight, x: PW / 2 + (side === 'left' ? 0.5 : -0.5), y: WALL_Y, w: PW + 1 }}
        beta={betaWall}
        side={side}
        wallH={wallH}
        flapDeg={flapFold}
        rank={order.length}
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
}

export default function PopupBook() {
  const n = spreads.length
  const [pos, setPos] = useState(0)
  const posRef = useRef(0)
  const targetRef = useRef(0)
  const raf = useRef(0)
  const [scale, setScale] = useState(1)
  const [view, setView] = useState(DEFAULT_VIEW)
  const [mode, setMode] = useState<Gesture['mode'] | null>(null)
  // 边缘拉动独立于翻页进度，回弹时不会让另一页重新渲染/移动。
  const [edgePull, setEdgePull] = useState(0)
  const gesture = useRef<Gesture | null>(null)

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
    const dur = rebound ? 650 : 600 + 1000 * Math.min(dist, 1.6)
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
    const fit = () => setScale(clamp(Math.min(window.innerWidth / 1150, (window.innerHeight - 190) / 790), 0.32, 1.25))
    const key = (e: KeyboardEvent) => {
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
  }, [go])

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
      mode: onBook ? 'flip' : 'turn',
      x: e.clientX,
      y: e.clientY,
      start: posRef.current,
      rx: view.rx,
      rz: view.rz,
      moved: false,
      lp: 0,
      lt: performance.now(),
      v: 0,
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
      setView((v) => ({ ...v, rz: g.rz - dx * 0.35, rx: clamp(g.rx - dy * 0.3, 4, 82) }))
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
    if (!g || g.mode === 'turn') return
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

  const a = clamp(Math.floor(pos), 0, n - 2)
  const t = clamp(pos - a, 0, 1)
  const A = spreads[a]
  const B = spreads[a + 1]
  const s = scale * view.zoom
  const overL = Math.max(0, edgePull) * 180
  const overR = Math.max(0, -edgePull) * 180
  // 与翻页纸构成跨页的那一侧保持和它同高，左右两面墙才能在书脊处接上；
  // 被翻页纸盖着、且翻页纸已靠近时才沉下 SINK，避免折平的剪纸被深度排序闪穿。
  const SINK = -12
  const zL = REST_Z + (SINK - REST_Z) * clamp((t - 0.75) / 0.15, 0, 1)
  const zR = REST_Z + (SINK - REST_Z) * clamp((0.25 - t) / 0.15, 0, 1)
  // 同一跨页的两页共用同一个夹角，两面墙的折翼才能镜像对齐
  const wedgeFront = edgePull > 0 ? 180 - overL : 180 * (1 - t)
  const wedgeBack = edgePull < 0 ? 180 - overR : 180 * t
  const index = clamp(Math.round(pos), 0, n - 1)
  const current = spreads[index]
  const page = index + 1

  return (
    <main className="pb-root">
      <DiecutDefs />
      <header className="pb-head">
        <span>{BOOK_TITLE} · {current.sub}</span>
        <h1>{current.title}</h1>
      </header>

      <div
        className={`pb-stage ${mode ? `is-${mode}` : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        onDoubleClick={(e) => !(e.target as Element).closest('.pb-book') && setView(DEFAULT_VIEW)}
      >
        <div
          className="pb-book"
          style={{ transform: `translate3d(0, ${80 * scale}px, 0) scale3d(${s}, ${s}, ${s}) rotateX(${view.rx}deg) rotateZ(${view.rz}deg)` }}
        >
          <div className="pb-floor-shadow" />
          <div className="pb-cover" />
          <Page
            key={`bl${a}`}
            spread={A}
            side="left"
            wedge={wedgeFront}
            style={{ visibility: t > 0.999 ? 'hidden' : undefined, transformOrigin: '100% 50%', transform: overL ? `translateZ(${REST_Z}px) rotateY(${overL}deg)` : `translateZ(${zL}px)` }}
          />
          <Page
            key={`br${a}`}
            spread={B}
            side="right"
            wedge={wedgeBack}
            style={{ visibility: t < 0.001 ? 'hidden' : undefined, transformOrigin: '0 50%', transform: overR ? `translateZ(${REST_Z}px) rotateY(${-overR}deg)` : `translateZ(${zR}px)` }}
          />

          <div className="pb-leaf" style={{ transform: `translateZ(${LEAF_Z}px) rotateY(${-180 * t}deg)` }}>
            {/* 纸面由浏览器背面剔除；剪纸只在所在跨页完全合上时隐藏 */}
            <div className={`pb-face ${t < 0.999 ? '' : 'pb-nopops'}`}>
              <Page key={`lf${a}`} spread={A} side="right" wedge={wedgeFront} style={{ left: 0 }} />
            </div>
            <div className={`pb-face back ${t > 0.001 ? '' : 'pb-nopops'}`}>
              <Page key={`lb${a}`} spread={B} side="left" wedge={wedgeBack} style={{ left: 0 }} />
            </div>
          </div>
        </div>
      </div>

      <footer className="pb-foot">
        <div className="pb-tip">拖动书页翻页 · 拖动空白处旋转书本 · 滚轮缩放 · 双击空白复位</div>
        <nav>
          <button onClick={() => go(-1)} disabled={page === 1} aria-label="上一页">‹</button>
          <span>第 {page} / {n} 页</span>
          <button onClick={() => go(1)} disabled={page === n} aria-label="下一页">›</button>
        </nav>
      </footer>
    </main>
  )
}
