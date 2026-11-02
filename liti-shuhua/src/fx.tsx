import { memo, type CSSProperties, type ReactElement } from 'react'
import type { EffectId, Fx } from './effects'

/**
 * 书本坐标（纸面平放时）：
 *   +X 右 · +Y 朝书页下沿（近读者） · +Z 从纸面立起来（贴纸朝向）
 *
 * 雨雪必须沿 −Z 往纸面落，不能沿 Y 从背景滑到近处 —— 那会像「从墙往外射」。
 */

const W = 1000
const H = 560
/** 落点散布在地板深度上：靠墙（偏上）→ 靠读者（偏下） */
const Y0 = -210
const Y1 = 200
/** 飘落行程：从贴纸头顶附近落到贴近纸面 */
const Z_TOP = 260
const Z_BOT = 12

const COUNT: Record<EffectId, [number, number, number]> = {
  snow: [60, 112, 172],
  rain: [70, 124, 186],
  firefly: [18, 32, 50],
  leaf: [14, 26, 40],
  star: [34, 62, 96],
  bubble: [18, 30, 46],
  firework: [1, 2, 3],
  meteor: [5, 10, 16],
  lantern: [8, 16, 26],
  glow: [1, 1, 1],
  lightning: [1, 2, 3],
}

/** 一页里同时开好几个特效时，按总元素数摊薄，避免几百个图层一起动 */
const ELEMENT_BUDGET = 300
/** 手机 WebView 上几百个合成层会把主线程和光栅一起拖垮，窄屏/触摸设备直接砍掉一半 */
const budget = () => {
  if (typeof window === 'undefined') return ELEMENT_BUDGET
  const small = window.innerWidth < 560 || window.matchMedia?.('(pointer: coarse)').matches
  return small ? ELEMENT_BUDGET * 0.55 : ELEMENT_BUDGET
}
/** 每种特效实际会生成多少个 DOM 元素（烟花要算火星 × 残影） */
const ELEMENTS: Record<EffectId, (lv: number) => number> = {
  snow: (lv) => COUNT.snow[lv - 1],
  rain: (lv) => COUNT.rain[lv - 1],
  firefly: (lv) => COUNT.firefly[lv - 1],
  leaf: (lv) => COUNT.leaf[lv - 1],
  star: (lv) => COUNT.star[lv - 1],
  bubble: (lv) => COUNT.bubble[lv - 1],
  lantern: (lv) => COUNT.lantern[lv - 1],
  meteor: (lv) => COUNT.meteor[lv - 1],
  // 每发约 40 颗火星 × 2 层残影
  firework: (lv) => COUNT.firework[lv - 1] * 90,
  glow: () => 1,
  lightning: () => 16,
}

type P = { x: number; y: number; z: number; k: number; t: number }

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
const hash = (id: string) => [...id].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 7)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const vars = (o: Record<string, string | number>) => o as CSSProperties
const px = (v: number) => `${v.toFixed(1)}px`

/** still：悬空散开；飘落：锚在地板附近，高度靠动画走 Z */
function field(id: EffectId, level: number, q: number, still = false): P[] {
  const n = Math.max(1, Math.round((COUNT[id][level - 1] ?? 0) * q))
  const r = rng(hash(id) * 7 + level * 131)
  return Array.from({ length: n }, () => {
    const y = Y0 + r() * (Y1 - Y0)
    // 靠读者的粒子更「近」，视觉上更大更亮
    const k = (y - Y0) / (Y1 - Y0)
    return {
      x: (r() - 0.5) * W * 0.88,
      y,
      z: still ? Z_BOT + r() * (Z_TOP - Z_BOT) * 0.85 : Z_BOT,
      k,
      t: r(),
    }
  })
}

/**
 * 锚点上不能写 opacity：opacity<1 会把 preserve-3d 压平，Z 方向的下落就全贴在地面上了。
 * wob>0 时给这颗粒子一条自己的折线轨迹（两个随机拐点 + 起落高度），
 * 外层再叠一段周期不同的阵风，两者周期错开，每一轮的路线都不一样。
 */
function put(key: string, p: P, op: number, el: ReactElement, wob = 0) {
  const style: Record<string, string | number> = {
    transform: `translate3d(${px(p.x)}, ${px(p.y)}, ${px(p.z)})`,
    '--op0': Number(op.toFixed(2)),
  }
  if (wob > 0) {
    const r = rng(Math.floor((p.x + 600) * 97 + (p.y + 300) * 13 + p.t * 7919))
    const j = () => (r() - 0.5) * 2 * wob
    style['--z0'] = px(240 + r() * 110)
    style['--m1x'] = px(j())
    style['--m1y'] = px(j() * 0.5)
    style['--m2x'] = px(j())
    style['--m2y'] = px(j() * 0.5)
    style['--gx'] = px(j() * 1.2)
    style['--gy'] = px(j() * 0.6)
    style['--gd'] = `${(3 + r() * 5).toFixed(1)}s`
    style['--gdl'] = `${(-r() * 8).toFixed(1)}s`
  }
  return (
    <span key={key} className={`fx-p ${wob > 0 ? 'is-gust' : ''}`} style={vars(style)}>
      {el}
    </span>
  )
}

function falling(id: EffectId, ps: P[]): ReactElement[] {
  return ps.map((p, i) => {
    switch (id) {
      case 'snow': {
        const s = lerp(2, 6, p.k)
        const d = lerp(10, 6, p.k)
        return put(String(i), p, lerp(0.55, 0.95, p.k), (
          <i className="fx-snow" style={vars({
            width: px(s), height: px(s),
            '--dur': `${d}s`, '--delay': `${-p.t * d}s`,
            '--wx': `${((p.t - 0.5) * 28).toFixed(0)}px`,
            '--wy': `${((p.t - 0.5) * 12).toFixed(0)}px`,
          })} />
        ), 34)
      }
      case 'rain': {
        const d = lerp(1.4, 0.8, p.k)
        const len = lerp(22, 44, p.k)
        return put(String(i), p, lerp(0.3, 0.68, p.k), (
          <i className="fx-rain" style={vars({
            width: `${lerp(0.9, 1.7, p.k).toFixed(2)}px`,
            height: `${len.toFixed(0)}px`,
            '--dur': `${d}s`, '--delay': `${-p.t * d}s`,
            '--wx': `${(4 + p.t * 8).toFixed(0)}px`,
          })} />
        ), 5)
      }
      case 'leaf': {
        const s = lerp(9, 16, p.k)
        const d = lerp(12, 8, p.k)
        const tone = i % 3 === 0 ? 'is-red' : i % 3 === 1 ? 'is-gold' : ''
        return put(String(i), p, lerp(0.75, 1, p.k), (
          <i className={`fx-leaf ${tone}`} style={vars({
            width: px(s), height: px(s * 1.25),
            '--dur': `${d}s`, '--delay': `${-p.t * d}s`,
            '--wx': `${((p.t - 0.5) * 60).toFixed(0)}px`,
            '--wy': `${((p.t - 0.5) * 24).toFixed(0)}px`,
          })}>
            <svg viewBox="0 0 10 14" aria-hidden>
              <path d="M5 .4C8.4 3 9.6 6.2 9.6 8.6c0 3-2 4.9-4.6 4.9S.4 11.6.4 8.6C.4 6.2 1.6 3 5 .4Z" fill="currentColor" />
              <path d="M5 2.6v9" stroke="rgba(0,0,0,.22)" strokeWidth=".5" strokeLinecap="round" />
            </svg>
          </i>
        ), 60)
      }
      default:
        return <span key={i} />
    }
  })
}

/**
 * 流星：挂在高空，在「对准镜头」的平面里沿斜线快速划过（0.4–0.8s），
 * 剩下的时间不可见，所以是偶尔一道，而不是慢慢往下掉。
 */
function meteors(level: number, q: number): ReactElement[] {
  const r = rng(7713 + level * 41)
  const n = Math.max(1, Math.round(COUNT.meteor[level - 1] * q))
  return Array.from({ length: n }, (_, i) => {
    const p: P = { x: (r() - 0.5) * W * 0.8, y: Y0 + r() * 160, z: 230 + r() * 90, k: r(), t: r() }
    const dur = 3.5 + r() * 6
    const len = 110 + r() * 90
    return put(`m${i}`, p, 0.75 + p.k * 0.25, (
      <i className="fx-meteor" style={vars({
        width: `${(1.5 + p.k * 1.1).toFixed(1)}px`,
        height: `${len.toFixed(0)}px`,
        '--dur': `${dur.toFixed(1)}s`,
        '--delay': `${(-r() * dur).toFixed(1)}s`,
        '--ang': `${(32 + r() * 26).toFixed(0)}deg`,
        '--run': `${(len * 2.6 + r() * 120).toFixed(0)}px`,
      })} />
    ))
  })
}

function rising(id: EffectId, ps: P[]): ReactElement[] {
  return ps.map((p, i) => {
    if (id === 'bubble') {
      const s = lerp(6, 17, p.k)
      const d = lerp(12, 7.5, p.k)
      return put(String(i), p, lerp(0.5, 0.95, p.k), (
        <i className="fx-bubble" style={vars({
          width: px(s), height: px(s),
          '--dur': `${d}s`, '--delay': `${-p.t * d}s`,
          '--wx': `${((p.t - 0.5) * 36).toFixed(0)}px`,
        })} />
      ), 24)
    }
    // 孔明灯要一眼能看见：尺寸比其它漂浮特效明显大一圈，近处更亮更大
    const s = lerp(28, 46, p.k)
    const d = lerp(17, 12, p.k)
    return put(String(i), p, lerp(0.85, 1, p.k), (
      <i className="fx-lantern" style={vars({
        width: px(s * 0.78), height: px(s),
        '--dur': `${d}s`, '--delay': `${-p.t * d}s`,
        '--wx': `${((p.t - 0.5) * 44).toFixed(0)}px`,
        // 升到书页上方就淡掉：给得太高会撞到画面顶边被裁掉
        '--z0': px(146 + p.k * 62),
      })}>
        <svg viewBox="0 0 20 26" aria-hidden>
          <path d="M2.6 9.4C2.6 5 5.4 2 10 2s7.4 3 7.4 7.4v6.2c0 4.4-2.8 7.4-7.4 7.4S2.6 20 2.6 15.6Z" fill="currentColor" />
          <path d="M5.7 10.4c0-2.9 1.8-4.6 4.3-4.6s4.3 1.7 4.3 4.6v5.6c0 2.9-1.8 4.6-4.3 4.6s-4.3-1.7-4.3-4.6Z" fill="#fff4cf" />
          <path d="M3.9 12.2h12.2M3.9 16.4h12.2" stroke="rgba(178,108,50,.3)" strokeWidth=".7" />
          <rect x="6.4" y="22.4" width="7.2" height="2.2" rx=".9" fill="#c98a4e" />
        </svg>
      </i>
    ), 28)
  })
}

function fireflies(ps: P[]): ReactElement[] {
  return ps.map((p, i) => {
    const s = lerp(3.4, 7, p.k)
    const d = lerp(7, 4.2, p.k)
    return put(String(i), p, 1, (
      <i className="fx-firefly" style={vars({
        width: px(s), height: px(s),
        '--dur': `${d}s`, '--delay': `${-p.t * d}s`,
        '--wx': `${((p.t - 0.5) * 40).toFixed(0)}px`,
        '--wy': `${((p.t - 0.5) * 18).toFixed(0)}px`,
        '--blink': `${lerp(3.2, 1.6, p.k).toFixed(1)}s`,
      })} />
    ), 26)
  })
}

function stillBits(ps: P[]): ReactElement[] {
  return ps.map((p, i) => {
    const s = lerp(3.6, 8.5, p.k)
    return put(String(i), p, lerp(0.5, 1, p.k), (
      <i className={`fx-star ${i % 4 === 0 ? 'is-cool' : ''}`} style={vars({
        width: px(s), height: px(s),
        '--dur': `${lerp(2.8, 1.4, p.k).toFixed(1)}s`, '--delay': `${-p.t * 3}s`,
      })}>
        <svg viewBox="0 0 10 10" aria-hidden>
          <path d="M5 .2c.45 3.35 1.45 4.35 4.8 4.8-3.35.45-4.35 1.45-4.8 4.8-.45-3.35-1.45-4.35-4.8-4.8C3.55 4.55 4.55 3.55 5 .2Z" fill="currentColor" />
        </svg>
      </i>
    ))
  })
}

/**
 * 烟花：按真实烟花的几种型号随机 ——
 *   牡丹（单色球）、菊花（双色、带长拖尾）、柳（金色、重力下垂长）、环（扁平一圈）。
 * 每颗火星是「头 + 3 个延迟的残影」，看起来就是一条尾迹；
 * 位置按 3 个关键帧走：快速炸开 → 减速 → 被重力拉下去，最后闪烁熄灭。
 */
type Shell = { n: number; dur: number; spread: number; fall: number; hues: number[]; trail: number; ring?: boolean; size: number }

function shellOf(r: () => number): Shell {
  const pal = [[42], [8], [350], [205], [130], [285], [42, 205], [350, 48], [285, 190]]
  const kind = r()
  if (kind < 0.3) return { n: 44, dur: 3.6, spread: 118, fall: 46, hues: pal[Math.floor(r() * 6)], trail: 2, size: 2 }
  if (kind < 0.55) return { n: 40, dur: 4, spread: 132, fall: 58, hues: pal[6 + Math.floor(r() * 3)], trail: 3, size: 1.8 }
  if (kind < 0.8) return { n: 36, dur: 5, spread: 108, fall: 120, hues: [40], trail: 3, size: 1.6 }
  return { n: 32, dur: 3.4, spread: 124, fall: 30, hues: pal[Math.floor(r() * 6)], trail: 2, ring: true, size: 2 }
}

function fireworks(level: number, q: number): ReactElement[] {
  const r = rng(9137 + level * 17)
  const out: ReactElement[] = []
  const bursts = Math.max(1, Math.round(COUNT.firework[level - 1] * q))

  for (let c = 0; c < bursts; c++) {
    const sh = shellOf(r)
    const cx = (r() - 0.5) * W * 0.6
    const cy = Y0 + 30 + r() * 150
    const cz = 170 + r() * 90
    const dur = sh.dur + r() * 1.2
    const delay = -r() * dur
    const lean = (r() - 0.5) * 40
    const tilt = r() * Math.PI
    const base = { '--dur': `${dur.toFixed(2)}s` }

    // 升空：一颗亮头 + 一串越来越暗的尾迹点
    for (let j = 0; j < 6; j++) {
      out.push(put(`${c}-up${j}`, { x: cx - lean, y: cy, z: Z_BOT, k: 0, t: 0 }, 1 - j * 0.15, (
        <i className={`fx-rocket ${j ? 'is-tail' : ''}`} style={vars({
          ...base,
          '--delay': `${(delay - j * 0.035).toFixed(3)}s`,
          '--lift': `${cz.toFixed(0)}px`,
          '--lean': `${lean.toFixed(0)}px`,
        })} />
      )))
    }

    // 炸点中心一个很小很亮的闪光核，不是大光斑
    out.push(put(`${c}-core`, { x: cx, y: cy, z: cz, k: 0, t: 0 }, 1, (
      <i className="fx-core" style={vars({ ...base, '--delay': `${delay.toFixed(3)}s`, '--hue': String(sh.hues[0]) })} />
    )))

    // 火星和残影是大头：密的时候也压一压
    const sparks = Math.max(12, Math.round(sh.n * (0.55 + q * 0.45)))
    const trail = q < 0.7 ? Math.min(1, sh.trail) : sh.trail
    for (let s = 0; s < sparks; s++) {
      // 球面均匀分布；环形则压在一个倾斜的平面上
      let dx: number, dy: number, dz: number
      if (sh.ring) {
        const a = (s / sparks) * Math.PI * 2
        dx = Math.cos(a)
        dy = Math.sin(a) * Math.cos(tilt)
        dz = Math.sin(a) * Math.sin(tilt)
      } else {
        const u = r() * 2 - 1
        const a = r() * Math.PI * 2
        const cir = Math.sqrt(1 - u * u)
        dx = cir * Math.cos(a)
        dy = cir * Math.sin(a)
        dz = u
      }
      const d = sh.spread * (sh.ring ? 1 : 0.82 + r() * 0.28)
      const hue = sh.hues[s % sh.hues.length]
      const at = (f: number, g: number) => ({
        x: px(dx * d * f), y: px(dy * d * f), z: px(dz * d * f - sh.fall * g),
      })
      const p1 = at(0.62, 0.04)
      const p2 = at(0.88, 0.28)
      const p3 = at(1, 1)
      for (let j = 0; j <= trail; j++) {
        out.push(put(`${c}-${s}-${j}`, { x: cx, y: cy, z: cz, k: 0, t: 0 }, 1 - j / (trail + 1.4), (
          <i className={`fx-spark ${j ? 'is-tail' : ''}`} style={vars({
            ...base,
            '--delay': `${(delay - j * 0.05).toFixed(3)}s`,
            '--x1': p1.x, '--y1': p1.y, '--z1': p1.z,
            '--x2': p2.x, '--y2': p2.y, '--z2': p2.z,
            '--x3': p3.x, '--y3': p3.y, '--z3': p3.z,
            '--s': (sh.size * (1 - j * 0.18)).toFixed(2),
            '--hue': String(hue),
          })} />
        )))
      }
    }
  }
  return out
}

/**
 * 生成一道有分叉的闪电：主通道左右乱窜往下走，再从中间几处甩出短枝。
 * 坐标直接用像素（viewBox 和显示尺寸 1:1），所以描边不会被拉扁。
 */
function makeBolt(r: () => number, w: number, h: number) {
  const steps = 10 + Math.floor(r() * 4)
  const cx = w / 2
  const drift = (r() - 0.5) * w * 0.5
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    // 越往下摆幅越小，整体带一点横向漂移，看起来才像劈下来的
    const amp = w * 0.42 * (1 - f * 0.55)
    const jitter = (r() - 0.5) * amp
    const x = Math.min(w - 2, Math.max(2, cx + drift * f + jitter))
    pts.push([x, f * h])
  }
  const d = (ps: [number, number][]) => `M${ps.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')}`

  // 分支只朝下甩（现实里也是从主通道往下分叉），越靠下越短
  const branches: { d: string; k: number }[] = []
  const n = 2 + Math.floor(r() * 3)
  for (let i = 0; i < n; i++) {
    const idx = 2 + Math.floor(r() * (pts.length - 4))
    const start = pts[idx]
    const dir = r() < 0.5 ? -1 : 1
    const segs = 2 + Math.floor(r() * 3)
    let bx = start[0]
    let by = start[1]
    const bp: [number, number][] = [[bx, by]]
    const reach = 1 - idx / pts.length
    for (let k = 0; k < segs; k++) {
      bx = Math.min(w, Math.max(0, bx + dir * (3 + r() * w * 0.3)))
      by = Math.min(h, by + (h / steps) * (0.6 + r() * 1.1) * reach + 4)
      bp.push([bx, by])
    }
    branches.push({ d: d(bp), k: 0.3 + r() * 0.4 })
  }
  return { main: d(pts), branches }
}

/** 背景墙的基线（以书页中心为原点）；闪电要贴在它前面一点的天空里 */
const SKY_Y = -188

function lightning(level: number): ReactElement[] {
  const r = rng(4401 + level * 29)
  // 只闪一道：多道同时在书中间反而像贴纸。密度靠频率
  const x = (r() - 0.5) * W * 0.62
  const y = SKY_Y + 8 + r() * 14
  const h = 300 + r() * 70
  const w = 110 + r() * 60
  const bolt = makeBolt(r, w, h)
  const tilt = (r() - 0.5) * 0.16
  const gap = [5.4, 3.5, 2.4][level - 1] + r() * 1.3
  const delay = -r() * gap
  const out: ReactElement[] = []

  // 天光：和闪电同心的整片天空，贴在背景墙前面
  out.push(
    <span
      key="sky"
      className="fx-p"
      style={{ transform: `translate3d(${px(x)}, ${px(y)}, ${px(h * 0.62)}px)` }}
    >
      <i className="fx-skyflash" style={vars({
        '--dur': `${gap.toFixed(2)}s`,
        '--delay': `${delay.toFixed(2)}s`,
        '--lv': String(0.35 + level * 0.18),
      })} />
    </span>,
  )

  const common = {
    '--dur': `${gap.toFixed(2)}s`,
    '--delay': `${delay.toFixed(2)}s`,
  }

  // 空气被电离后整片天空会被照亮：一团大而软的散射光，跟着同时闪
  out.push(put('halo', { x, y: y + h * 0.45, z: h * 0.42, k: 1, t: 0 }, 1, (
    <i className="fx-lighthalo" style={vars({
      ...common,
      '--w': `${(w * 4.6).toFixed(0)}px`,
      '--h': `${(h * 1.7).toFixed(0)}px`,
      '--lv': String(0.22 + level * 0.1),
    })} />
  )))

  // 落点附近的地面被电光照亮：光是从上方打到纸面上的，所以是一摊贴地的亮斑
  out.push(put('pool', { x, y: SKY_Y + 132, z: 6, k: 1, t: 0 }, 1, (
    <i className="fx-lightpool" style={vars({
      ...common,
      '--w': `${(w * 2.8).toFixed(0)}px`,
      '--lv': String(0.2 + level * 0.08),
    })} />
  )))

  out.push(put('bolt', { x, y, z: h / 2 + 6, k: 1, t: 0 }, 1, (
    <i className="fx-bolt" style={vars({
      ...common,
      width: `${w.toFixed(0)}px`,
      height: `${h.toFixed(0)}px`,
      // 在天空平面里再斜一点：现实里的闪电很少笔直
      '--face': `var(--bbv, rotateX(-90deg)) rotate(${(tilt * 100).toFixed(1)}deg)`,
    })}>
      <svg viewBox={`0 0 ${w.toFixed(0)} ${h.toFixed(0)}`} aria-hidden>
        {/* 外层：被照亮的空气。很宽、很虚，模拟光在空气里的散射 */}
        <g className="fx-bolt-scatter">
          <path d={bolt.main} pathLength={1} strokeWidth={64} />
          {bolt.branches.map((b, j) => (
            <path key={`s${j}`} d={b.d} pathLength={1} strokeWidth={64 * b.k} />
          ))}
        </g>
        {/* 光晕层：宽、虚、偏蓝紫 */}
        <g className="fx-bolt-aura">
          <path d={bolt.main} pathLength={1} strokeWidth={30} />
          {bolt.branches.map((b, j) => (
            <path key={`a${j}`} d={b.d} pathLength={1} strokeWidth={30 * b.k} />
          ))}
        </g>
        {/* 中层：真实的电光其实是蓝白的，不是纯白 */}
        <g className="fx-bolt-glow">
          <path d={bolt.main} pathLength={1} strokeWidth={10} />
          {bolt.branches.map((b, j) => (
            <path key={`g${j}`} d={b.d} pathLength={1} strokeWidth={10 * b.k} />
          ))}
        </g>
        {/* 白热芯：非常细，越往下越细 */}
        <g className="fx-bolt-core">
          <path d={bolt.main} pathLength={1} strokeWidth={2.4} />
          {bolt.branches.map((b, j) => (
            <path key={`c${j}`} d={b.d} pathLength={1} strokeWidth={2.4 * b.k} />
          ))}
        </g>
      </svg>
    </i>
  )))
  return out
}

function glow(level: number): ReactElement {
  return (
    <span key="glow" className="fx-p" style={{ transform: `translate3d(0px, 40px, ${Z_BOT + 8}px)` }}>
      <i className="fx-glowplane" style={vars({ '--lv': String(0.25 + level * 0.18) })} />
    </span>
  )
}

const RISING = new Set<EffectId>(['bubble', 'lantern'])

/**
 * 粒子本身只跟「放什么特效」有关，和视角/淡入淡出无关。
 * 单独 memo 掉：翻页时 fade 每帧都在变，若整个特效树跟着重渲染，
 * 一页几百个节点每帧重新 diff，就是手机上「翻页手感发涩」的主因。
 * 视角（--bb）、淡入（--fade）都走 CSS 变量，由外层容器继承下来，不必重建节点。
 */
const Particles = memo(function Particles({ fx }: { fx: Fx[] }) {
  // 只有会产元素的特效才占预算
  const heavy = fx.filter((f) => f.id !== 'glow' && f.id !== 'lightning')
  const want = heavy.reduce((sum, f) => sum + ELEMENTS[f.id](f.level), 0)
  const q = heavy.length > 1 ? Math.min(1, budget() / Math.max(want, 1)) : 1
  return (
    <>
      {fx.map((f) => (
        <div key={f.id} className="fx-set">
          {f.id === 'firework'
            ? fireworks(f.level, q)
            : f.id === 'meteor'
              ? meteors(f.level, q)
              : f.id === 'lightning'
              ? lightning(f.level)
              : f.id === 'glow'
                ? glow(f.level)
                : f.id === 'star'
                  ? stillBits(field(f.id, f.level, q, true))
                  : f.id === 'firefly'
                    ? fireflies(field(f.id, f.level, q, true))
                    : RISING.has(f.id)
                      ? rising(f.id, field(f.id, f.level, q))
                      : falling(f.id, field(f.id, f.level, q))}
        </div>
      ))}
    </>
  )
})

export default function FxLayer({ fx, fade = 1, busy = false }: { fx: Fx[]; fade?: number; busy?: boolean }) {
  if (!fx.length || fade <= 0.001) return null
  // 不能用容器 opacity 做淡入淡出（会压平 3D），只能乘到每颗粒子的透明度上
  const face = { '--fade': Number(fade.toFixed(3)) }
  return (
    <div className={`pb-fx3d ${busy ? 'is-busy' : ''}`} aria-hidden="true" style={vars(face)}>
      <Particles fx={fx} />
    </div>
  )
}
