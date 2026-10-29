import { useId, type ReactNode } from 'react'

const useGid = (prefix: string) => `${prefix}${useId().replace(/:/g, '')}`

export function DiecutDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="diecut" x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius="5" result="grow" />
          <feFlood floodColor="#fbf3df" />
          <feComposite in2="grow" operator="in" result="edge" />
          <feMerge result="cut">
            <feMergeNode in="edge" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="noise" />
          <feColorMatrix in="noise" type="saturate" values="0" result="gray" />
          <feComponentTransfer in="gray" result="paper">
            <feFuncR type="linear" slope=".32" intercept=".8" />
            <feFuncG type="linear" slope=".32" intercept=".8" />
            <feFuncB type="linear" slope=".32" intercept=".8" />
            <feFuncA type="linear" slope="0" intercept="1" />
          </feComponentTransfer>
          <feBlend in="cut" in2="paper" mode="multiply" result="tex" />
          <feComposite in="tex" in2="cut" operator="in" />
        </filter>
      </defs>
    </svg>
  )
}

/** live 里的内容画在滤镜外：会动的小元素不必每帧重算整张纸的描边和纸纹。 */
function Cut({ w, h, children, live }: { w: number; h: number; children: ReactNode; live?: ReactNode }) {
  const pad = 8
  return (
    <svg className="cut" viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad}`}>
      <g filter="url(#diecut)">{children}</g>
      {live}
    </svg>
  )
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function starPath(x: number, y: number, r: number) {
  const k = r * 0.28
  return `M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z`
}

function polyStar(cx: number, cy: number, R: number, r: number, n = 5) {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 ? r : R
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}

/* ================= 背景墙 ================= */

type Edge = 'arc' | 'waves' | 'clouds' | 'pines'

function edgePath(edge: Edge, side: 'left' | 'right', seed: number) {
  const r = rng(seed)
  if (edge === 'arc') return side === 'left' ? 'M0 330L0 56Q300 2 480 16L480 330Z' : 'M0 330L0 16Q180 2 480 56L480 330Z'
  if (edge === 'waves') {
    let d = 'M0 330L0 32'
    for (let x = 0, i = 0; x < 480; x += 40, i++) d += `Q${x + 20} ${i % 2 ? 50 : 12} ${x + 40} 32`
    return `${d}L480 330Z`
  }
  if (edge === 'clouds') {
    let d = 'M0 330L0 58'
    let x = 0
    while (x < 480) {
      const w = Math.min(480 - x, 52 + r() * 38)
      d += `A${w / 2} ${w * 0.42} 0 0 1 ${x + w} 58`
      x += w
    }
    return `${d}L480 330Z`
  }
  let d = 'M0 330L0 74'
  let x = 0
  while (x < 480) {
    const w = Math.min(480 - x, 22 + r() * 26)
    d += `L${x + w / 2} ${4 + r() * 40}L${x + w} 74`
    x += w
  }
  return `${d}L480 330Z`
}

export function Wall({ edge, side, from, to, seed = 1, children, live }: {
  edge: Edge
  side: 'left' | 'right'
  from: string
  to: string
  seed?: number
  children?: ReactNode
  live?: ReactNode
}) {
  const gid = useGid('wall')
  const cid = useGid('clip')
  const d = edgePath(edge, side, seed)
  return (
    <svg className="cut" viewBox={side === 'left' ? '-8 -8 488 338' : '0 -8 488 338'}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <clipPath id={cid}><path d={d} /></clipPath>
      </defs>
      <g filter="url(#diecut)">
        <path d={d} fill={`url(#${gid})`} />
        <g clipPath={`url(#${cid})`}>{children}</g>
      </g>
      <g clipPath={`url(#${cid})`}>{live}</g>
    </svg>
  )
}

export const Twinkle = ({ x, y, r = 10, color = '#f6dc96' }: { x: number; y: number; r?: number; color?: string }) => (
  <path d={starPath(x, y, r)} fill={color} />
)

export function Stars({ seed, count = 30, color = '#fff3cf', maxY = 230 }: { seed: number; count?: number; color?: string; maxY?: number }) {
  const r = rng(seed)
  return (
    <g fill={color}>
      {Array.from({ length: count }, (_, i) => <circle key={i} cx={r() * 480} cy={20 + r() * maxY} r={0.8 + r() * 1.6} opacity={0.5 + r() * 0.5} />)}
    </g>
  )
}

export const Moon = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g>
    <circle cx={x} cy={y} r={r * 1.35} fill="#f8e7ae" opacity=".12" />
    <circle cx={x} cy={y} r={r} fill="#f8e7ae" />
    <circle cx={x - r * 0.3} cy={y - r * 0.2} r={r * 0.18} fill="#ead395" />
    <circle cx={x + r * 0.35} cy={y + r * 0.25} r={r * 0.24} fill="#ead395" />
    <circle cx={x + r * 0.1} cy={y - r * 0.5} r={r * 0.1} fill="#ead395" />
  </g>
)

export const Crescent = ({ x, y, r, color = '#f6e2a2' }: { x: number; y: number; r: number; color?: string }) => (
  <path d={`M${x} ${y - r}A${r} ${r} 0 1 0 ${x} ${y + r}A${r * 0.78} ${r * 0.82} 0 1 1 ${x} ${y - r}Z`} fill={color} />
)

export const Sun = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g>
    <circle cx={x} cy={y} r={r * 1.5} fill="#fff6d8" opacity=".35" />
    <circle cx={x} cy={y} r={r} fill="#ffd36b" />
    <circle cx={x} cy={y} r={r * 0.74} fill="#ffe08f" />
  </g>
)

export const Rainbow = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <g fill="none" strokeWidth="10">
    {['#f28b82', '#f7b267', '#f9e07f', '#9ed8a6', '#8ec5ea', '#b9a5e6'].map((c, i) => (
      <path key={c} d={`M${cx - (r - i * 10)} ${cy}A${r - i * 10} ${r - i * 10} 0 0 1 ${cx + (r - i * 10)} ${cy}`} stroke={c} />
    ))}
  </g>
)

export const PuffCloud = ({ x, y, s = 1, color = '#fdfbf6' }: { x: number; y: number; s?: number; color?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill={color}>
    <ellipse cx="0" cy="8" rx="50" ry="14" />
    <circle cx="-20" cy="-2" r="18" />
    <circle cx="6" cy="-12" r="24" />
    <circle cx="30" cy="0" r="15" />
  </g>
)

export const Birds = ({ x, y, color = '#5a5f8a' }: { x: number; y: number; color?: string }) => (
  <g stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round">
    <path d={`M${x} ${y}q7 -7 14 0q7 -7 14 0`} />
    <path d={`M${x + 34} ${y - 16}q5 -5 10 0q5 -5 10 0`} />
    <path d={`M${x + 18} ${y + 18}q5 -5 10 0q5 -5 10 0`} />
  </g>
)

export function Skyline({ seed, y = 250, color = '#262c5e', lit = '#f6c76a' }: { seed: number; y?: number; color?: string; lit?: string }) {
  const r = rng(seed)
  let d = `M0 330L0 ${y}`
  const wins: [number, number][] = []
  let x = 0
  while (x < 480) {
    const w = Math.min(480 - x, 26 + r() * 34)
    const top = y - 10 - r() * 60
    const t = r()
    if (t < 0.4) d += `L${x} ${top + 14}L${x + w / 2} ${top}L${x + w} ${top + 14}`
    else if (t < 0.7) d += `L${x} ${top}L${x + w * 0.25} ${top}L${x + w * 0.25} ${top - 12}L${x + w * 0.4} ${top - 12}L${x + w * 0.4} ${top}L${x + w} ${top}`
    else d += `L${x} ${top + 8}Q${x + w / 2} ${top - 18} ${x + w} ${top + 8}`
    for (let wy = top + 24; wy < 318; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 11) if (r() < 0.3) wins.push([wx, wy])
    x += w
  }
  return (
    <g>
      <path d={`${d}L480 330Z`} fill={color} />
      {wins.map(([a, b], i) => <rect key={i} x={a} y={b} width="5" height="7" fill={lit} opacity=".85" />)}
    </g>
  )
}

export function Hills({ y, color, seed, amp = 30 }: { y: number; color: string; seed: number; amp?: number }) {
  const r = rng(seed)
  let d = `M0 330L0 ${y}`
  let x = 0
  while (x < 480) {
    const w = Math.min(480 - x, 60 + r() * 70)
    d += `Q${x + w / 2} ${y - amp * (0.4 + r() * 0.8)} ${x + w} ${y}`
    x += w
  }
  return <path d={`${d}L480 330Z`} fill={color} />
}

export const LightRays = () => (
  <g fill="#ffffff" opacity=".09">
    <path d="M40 0L90 0L200 330L120 330Z" />
    <path d="M190 0L220 0L300 330L250 330Z" />
    <path d="M330 0L390 0L470 330L380 330Z" />
  </g>
)

export function Bubbles({ seed, count = 10 }: { seed: number; count?: number }) {
  const r = rng(seed)
  return (
    <g fill="none" stroke="#e6f8ff" strokeWidth="2">
      {Array.from({ length: count }, (_, i) => (
        <circle key={i} className="rise" cx={30 + r() * 420} cy={120 + r() * 200} r={3 + r() * 7} style={{ animationDelay: `${-r() * 6}s` }} />
      ))}
    </g>
  )
}

export function Fireflies({ seed, count = 14, y0 = 90, y1 = 300 }: { seed: number; count?: number; y0?: number; y1?: number }) {
  const r = rng(seed)
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const x = 20 + r() * 440
        const y = y0 + r() * (y1 - y0)
        return (
          <g key={i} className="blink" style={{ animationDelay: `${-r() * 3}s`, animationDuration: `${2 + r() * 2}s` }}>
            <circle cx={x} cy={y} r="7" fill="#fff3a0" opacity=".25" />
            <circle cx={x} cy={y} r="2.6" fill="#fff6b8" />
          </g>
        )
      })}
    </g>
  )
}

export const MusicNotes = () => (
  <g fill="#f6dc96">
    <circle cx="300" cy="150" r="6" />
    <rect x="304" y="120" width="3" height="30" />
    <path d="M304 120Q318 126 318 138Q312 130 307 130Z" />
    <circle cx="350" cy="110" r="6" />
    <circle cx="372" cy="104" r="6" />
    <rect x="354" y="80" width="3" height="30" />
    <rect x="376" y="74" width="3" height="30" />
    <path d="M354 80L379 74L379 80L357 86Z" />
  </g>
)

/* ================= 主角：阿柚与黑猫墨墨 ================= */

function GirlHead({ x, y, s = 1, happy = false }: { x: number; y: number; s?: number; happy?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-26 -6Q-30 18 -18 28L-12 24Q-20 10 -18 -6Z" fill="#2b2433" />
      <path d="M26 -6Q30 18 18 28L12 24Q20 10 18 -6Z" fill="#2b2433" />
      <circle cx="0" cy="0" r="24" fill="#f6d2b0" />
      <path d="M-26 2C-28 -26 -10 -32 0 -32S28 -26 26 2C22 -8 16 -14 12 -16C6 -8 -10 -6 -20 -8C-22 -4 -24 0 -26 2Z" fill="#2b2433" />
      <circle cx="17" cy="-18" r="4.5" fill="#e85d5d" />
      {happy ? (
        <path d="M-12 4Q-8 0 -4 4M4 4Q8 0 12 4" stroke="#2b2433" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <ellipse cx="-8" cy="4" rx="2.6" ry="3.3" fill="#2b2433" />
          <ellipse cx="8" cy="4" rx="2.6" ry="3.3" fill="#2b2433" />
        </>
      )}
      <circle cx="-14" cy="11" r="4.5" fill="#f09a86" opacity=".6" />
      <circle cx="14" cy="11" r="4.5" fill="#f09a86" opacity=".6" />
      <path d="M-4 14Q0 17 4 14" stroke="#b8735a" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  )
}

function Lantern({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x} ${y - 10}V${y}`} stroke="#5a3d2b" strokeWidth="2" />
      <rect x={x - 11} y={y} width="22" height="5" rx="2" fill="#5a3d2b" />
      <rect x={x - 9} y={y + 4} width="18" height="24" rx="5" fill="#ffd36b" />
      <circle cx={x} cy={y + 16} r="6" fill="#fff6d0" />
      <rect x={x - 11} y={y + 26} width="22" height="5" rx="2" fill="#5a3d2b" />
    </g>
  )
}

export const GirlLantern = () => (
  <Cut w={120} h={200}>
    <rect x="46" y="156" width="10" height="30" fill="#f1c9a5" />
    <rect x="64" y="156" width="10" height="30" fill="#f1c9a5" />
    <path d="M42 180H58V200H36Q36 188 42 180Z" fill="#d9483b" />
    <path d="M62 180H78Q84 188 84 200H62Z" fill="#d9483b" />
    <path d="M36 96Q20 108 18 126" stroke="#f2b632" strokeWidth="11" strokeLinecap="round" fill="none" />
    <g transform="rotate(-10 20 132)">
      <rect x="6" y="122" width="30" height="20" rx="2" fill="#fbf3df" />
      <path d="M6 123L21 134L36 123" stroke="#b98d5a" strokeWidth="1.8" fill="none" />
      <circle cx="21" cy="134" r="3" fill="#d9483b" />
    </g>
    <path d="M60 74C38 76 30 116 26 164H94C90 116 82 76 60 74Z" fill="#f2b632" />
    <path d="M60 82V160" stroke="#d99a1f" strokeWidth="3" />
    <circle cx="67" cy="104" r="3" fill="#fff4cc" />
    <circle cx="67" cy="124" r="3" fill="#fff4cc" />
    <path d="M44 76Q60 88 76 76L72 70Q60 78 48 70Z" fill="#d99a1f" />
    <path d="M84 96Q98 112 100 128" stroke="#f2b632" strokeWidth="11" strokeLinecap="round" fill="none" />
    <Lantern x={100} y={138} />
    <GirlHead x={60} y={48} />
  </Cut>
)

export const GirlDiver = () => (
  <Cut
    w={180}
    h={160}
    live={
      <g fill="none" stroke="#eaf8ff" strokeWidth="2">
        <circle className="rise" cx="160" cy="40" r="4" />
        <circle className="rise" cx="168" cy="26" r="3" style={{ animationDelay: '-1.5s' }} />
      </g>
    }
  >
    {[[90, 151, 9], [97, 133, 7], [89, 117, 6], [95, 103, 5]].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill="#dff6ff" fillOpacity=".45" stroke="#eaf8ff" strokeWidth="2" />
    ))}
    <path d="M50 70L18 58L14 68L48 80Z" fill="#f1c9a5" />
    <path d="M50 76L22 80L22 90L52 86Z" fill="#f1c9a5" />
    <path d="M18 56L2 46L4 70L16 68Z" fill="#d9483b" />
    <path d="M22 78L4 82L10 98L24 90Z" fill="#d9483b" />
    <path d="M46 64C70 50 112 50 128 62L126 84C108 96 70 94 46 84Z" fill="#f2b632" />
    <path d="M62 58L64 90" stroke="#d99a1f" strokeWidth="3" />
    <path d="M118 66Q140 50 160 44" stroke="#f2b632" strokeWidth="11" strokeLinecap="round" fill="none" />
    <circle cx="162" cy="43" r="6" fill="#f6d2b0" />
    <GirlHead x={140} y={78} s={0.8} />
    <circle cx="140" cy="74" r="31" fill="#dff6ff" fillOpacity=".22" stroke="#f1fbff" strokeWidth="3" />
    <path d="M120 60Q126 49 138 46" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
  </Cut>
)

export const GirlSit = () => (
  <Cut w={130} h={160}>
    <path d="M48 128L44 150H56L60 128Z" fill="#f1c9a5" />
    <path d="M66 128L66 150H78L76 128Z" fill="#f1c9a5" />
    <path d="M40 148H58V160H36Q36 152 40 148Z" fill="#d9483b" />
    <path d="M64 148H80Q84 152 84 160H64Z" fill="#d9483b" />
    <rect x="14" y="126" width="104" height="24" rx="12" fill="#8a5a3c" />
    <ellipse cx="111" cy="138" rx="7" ry="12" fill="#c9a06a" />
    <path d="M62 60C42 62 36 96 34 132H90C88 96 82 62 62 60Z" fill="#f2b632" />
    <path d="M84 80Q100 70 104 52" stroke="#f2b632" strokeWidth="10" strokeLinecap="round" fill="none" />
    <Lantern x={104} y={22} />
    <GirlHead x={62} y={40} s={0.9} happy />
  </Cut>
)

function CatShape({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M14 30Q38 30 32 4" stroke="#26222e" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M-16 40C-20 12 -10 2 0 2S20 12 16 40Z" fill="#26222e" />
      <path d="M-12 -14L-10 -30L0 -20Z" fill="#26222e" />
      <path d="M12 -14L10 -30L0 -20Z" fill="#26222e" />
      <circle cx="0" cy="-10" r="14" fill="#26222e" />
      <ellipse cx="-5.5" cy="-11" rx="3.4" ry="4" fill="#f6d04a" />
      <ellipse cx="5.5" cy="-11" rx="3.4" ry="4" fill="#f6d04a" />
      <ellipse cx="-5.5" cy="-11" rx="1.2" ry="3" fill="#26222e" />
      <ellipse cx="5.5" cy="-11" rx="1.2" ry="3" fill="#26222e" />
      <path d="M-12 4Q0 10 12 4V10Q0 16 -12 10Z" fill="#4fa3a0" />
      <path d="M8 10L14 20L6 18Z" fill="#4fa3a0" />
    </g>
  )
}

export const MailboxCat = () => (
  <Cut w={100} h={170}>
    <rect x="44" y="110" width="12" height="60" fill="#5a3d2b" />
    <rect x="36" y="164" width="28" height="6" rx="2" fill="#5a3d2b" />
    <path d="M18 74H82V116H18Z" fill="#d9483b" />
    <path d="M18 76Q50 44 82 76Z" fill="#e8584a" />
    <rect x="18" y="98" width="64" height="4" fill="#b8323c" />
    <rect x="34" y="84" width="32" height="5" rx="2" fill="#7a2420" />
    <rect x="40" y="76" width="22" height="12" fill="#fbf3df" transform="rotate(-8 51 82)" />
    <text x="50" y="113" fontSize="9" textAnchor="middle" fill="#fbe7c4" fontWeight="700">POST</text>
    <CatShape x={50} y={22} />
  </Cut>
)

export const CampfireCat = () => (
  <Cut
    w={150}
    h={120}
    live={
      <g className="flicker">
        <path d="M52 106C34 88 44 66 52 50C56 66 66 70 62 84C70 78 72 70 70 60C84 74 82 98 66 106Z" fill="#f2a65a" />
        <path d="M55 106C47 96 52 86 57 76C61 86 67 92 63 106Z" fill="#ffe08a" />
      </g>
    }
  >
    {[[24, 114], [40, 117], [58, 118], [76, 117], [92, 114]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="9" ry="5" fill="#7d7f96" />)}
    <rect x="22" y="100" width="66" height="10" rx="5" fill="#7a4e33" transform="rotate(-12 55 105)" />
    <rect x="22" y="100" width="66" height="10" rx="5" fill="#8a5a3c" transform="rotate(14 55 105)" />
    <path d="M100 96L74 80" stroke="#8a5a3c" strokeWidth="3" />
    <rect x="66" y="74" width="10" height="8" rx="2" fill="#fbf3df" />
    <CatShape x={116} y={78} s={0.95} />
  </Cut>
)

/* ================= 第一页：屋顶邮局 ================= */

export function HouseRow() {
  const houses = [
    { x: 0, w: 100, top: 92, body: '#d97a5a', roof: '#6b3c4f', kind: 'gable' },
    { x: 96, w: 104, top: 48, body: '#4f6fa8', roof: '#2f3f6e', kind: 'step' },
    { x: 196, w: 120, top: 104, body: '#e8b75a', roof: '#a24d45', kind: 'round' },
    { x: 312, w: 128, top: 70, body: '#6f9b7a', roof: '#33504a', kind: 'mansard' },
  ]
  const r = rng(12)
  return (
    <Cut w={440} h={200}>
      {houses.map((h, i) => {
        let roof = ''
        if (h.kind === 'gable') roof = `M${h.x - 6} ${h.top}L${h.x + h.w / 2} ${h.top - 44}L${h.x + h.w + 6} ${h.top}Z`
        if (h.kind === 'step') {
          const s = h.w / 5
          roof = `M${h.x} ${h.top}L${h.x} ${h.top - 12}L${h.x + s} ${h.top - 12}L${h.x + s} ${h.top - 24}L${h.x + 2 * s} ${h.top - 24}L${h.x + 2 * s} ${h.top - 36}L${h.x + 3 * s} ${h.top - 36}L${h.x + 3 * s} ${h.top - 24}L${h.x + 4 * s} ${h.top - 24}L${h.x + 4 * s} ${h.top - 12}L${h.x + h.w} ${h.top - 12}L${h.x + h.w} ${h.top}Z`
        }
        if (h.kind === 'round') roof = `M${h.x - 4} ${h.top}Q${h.x + h.w / 2} ${h.top - 70} ${h.x + h.w + 4} ${h.top}Z`
        if (h.kind === 'mansard') roof = `M${h.x - 6} ${h.top}L${h.x + 14} ${h.top - 30}L${h.x + h.w - 14} ${h.top - 30}L${h.x + h.w + 6} ${h.top}Z`
        const wins: [number, number, boolean][] = []
        for (let wy = h.top + 16; wy < 150; wy += 30) for (let wx = h.x + 14; wx < h.x + h.w - 24; wx += 28) wins.push([wx, wy, r() < 0.7])
        return (
          <g key={i}>
            {h.kind === 'round' && <rect x={h.x + h.w - 36} y={h.top - 58} width="14" height="34" fill={h.roof} />}
            <rect x={h.x} y={h.top} width={h.w} height={200 - h.top} fill={h.body} />
            <path d={roof} fill={h.roof} />
            <rect x={h.x} y={h.top} width={h.w} height="5" fill="#00000022" />
            {wins.map(([wx, wy, lit], j) => (
              <g key={j}>
                <rect x={wx} y={wy} width="16" height="20" rx="2" fill={lit ? '#ffd36b' : '#2c2a50'} />
                <path d={`M${wx + 8} ${wy}V${wy + 20}M${wx} ${wy + 10}H${wx + 16}`} stroke={h.roof} strokeWidth="2" />
              </g>
            ))}
            <path d={`M${h.x + h.w / 2 - 12} 200V176Q${h.x + h.w / 2} 164 ${h.x + h.w / 2 + 12} 176V200Z`} fill={h.roof} />
          </g>
        )
      })}
    </Cut>
  )
}

export const PostOffice = () => (
  <Cut w={260} h={270}>
    <rect x="36" y="252" width="188" height="18" fill="#b9a284" />
    <rect x="44" y="110" width="172" height="142" fill="#ece0c6" />
    <path d="M130 40V12" stroke="#2c2a3a" strokeWidth="3" />
    <rect x="118" y="2" width="24" height="15" rx="1" fill="#fbf3df" />
    <path d="M118 3L130 11L142 3" stroke="#c7a76a" strokeWidth="2" fill="none" />
    <path d="M26 116L130 40L234 116Z" fill="#3f5a8a" />
    <path d="M60 92L130 52L200 92" stroke="#2c3f66" strokeWidth="4" fill="none" />
    <rect x="28" y="110" width="204" height="8" fill="#2c3f66" />
    <circle cx="130" cy="84" r="17" fill="#ffd36b" />
    <path d="M130 67V101M113 84H147" stroke="#2c3f66" strokeWidth="3" />
    <rect x="68" y="126" width="124" height="28" rx="5" fill="#d9483b" />
    <text x="130" y="146" fontSize="17" textAnchor="middle" fill="#fff4dc" fontWeight="700" letterSpacing="3">月光邮局</text>
    <path d="M108 252V196Q130 170 152 196V252Z" fill="#ffcf5a" />
    <path d="M130 186V252" stroke="#d9a23a" strokeWidth="3" />
    <path d="M104 252V196Q130 164 156 196V252" stroke="#7a4e33" strokeWidth="5" fill="none" />
    {[60, 172].map((x) => (
      <g key={x}>
        <path d={`M${x} 226V184Q${x + 14} 168 ${x + 28} 184V226Z`} fill="#ffd36b" />
        <path d={`M${x + 14} 176V226M${x} 202H${x + 28}`} stroke="#7a4e33" strokeWidth="2.5" />
        <rect x={x - 4} y="226" width="36" height="9" rx="2" fill="#7a4e33" />
        <circle cx={x + 4} cy="222" r="5" fill="#f28b82" />
        <circle cx={x + 14} cy="220" r="5" fill="#f9e07f" />
        <circle cx={x + 24} cy="222" r="5" fill="#f28b82" />
      </g>
    ))}
    <path d="M96 182H90V200" stroke="#2c2a3a" strokeWidth="2" fill="none" />
    <circle cx="90" cy="204" r="5" fill="#ffd36b" />
    <path d="M164 182H170V200" stroke="#2c2a3a" strokeWidth="2" fill="none" />
    <circle cx="170" cy="204" r="5" fill="#ffd36b" />
  </Cut>
)

export function LetterGarland() {
  const colors = ['#fbf3df', '#f6c5b4', '#cfe3f2', '#f9e3a0', '#d8c9ef', '#fbf3df', '#bfe3cf', '#f6c5b4']
  const items = colors.map((c, i) => {
    const t = (i + 1) / 9
    return { x: 10 + 400 * t, y: (1 - t) ** 2 * 20 + 2 * (1 - t) * t * 100 + t * t * 20, c, rot: i % 2 ? 9 : -9 }
  })
  return (
    <Cut w={420} h={150}>
      <rect x="4" y="14" width="10" height="136" rx="3" fill="#5a3d2b" />
      <rect x="406" y="14" width="10" height="136" rx="3" fill="#5a3d2b" />
      <circle cx="9" cy="12" r="7" fill="#e3b45f" />
      <circle cx="411" cy="12" r="7" fill="#e3b45f" />
      <path d="M10 20Q210 100 410 20" stroke="#efe0c0" strokeWidth="2.5" fill="none" />
      {items.map((it, i) => (
        <g key={i} transform={`rotate(${it.rot} ${it.x} ${it.y})`}>
          <path d={`M${it.x} ${it.y}V${it.y + 6}`} stroke="#efe0c0" strokeWidth="2" />
          <rect x={it.x - 14} y={it.y + 6} width="28" height="19" rx="2" fill={it.c} />
          <path d={`M${it.x - 14} ${it.y + 7}L${it.x} ${it.y + 18}L${it.x + 14} ${it.y + 7}`} stroke="#b98d5a" strokeWidth="1.6" fill="none" />
          <circle cx={it.x} cy={it.y + 18} r="2.6" fill="#d9483b" />
        </g>
      ))}
    </Cut>
  )
}

export function FlowerStrip({ seed = 3, grass = '#4f8f5f' }: { seed?: number; grass?: string }) {
  const r = rng(seed)
  let d = 'M0 60L0 44'
  for (let x = 0; x < 440; x += 10) d += `L${x + 5} ${30 + r() * 10}L${x + 10} 44`
  d += 'L440 60Z'
  const flowers = Array.from({ length: 16 }, (_, i) => ({ x: 14 + i * 27 + r() * 8, y: 14 + r() * 14, c: ['#f28b82', '#f9e07f', '#fbf3df', '#b9a5e6'][i % 4] }))
  return (
    <Cut w={440} h={60}>
      {flowers.map((f, i) => <path key={`s${i}`} d={`M${f.x} ${f.y}V50`} stroke="#3e7a52" strokeWidth="2.5" />)}
      <path d={d} fill={grass} />
      {flowers.map((f, i) => (
        <g key={i}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={f.x + Math.cos((a * Math.PI) / 180) * 5} cy={f.y + Math.sin((a * Math.PI) / 180) * 5} r="4" fill={f.c} />
          ))}
          <circle cx={f.x} cy={f.y} r="3" fill="#e3a13a" />
        </g>
      ))}
    </Cut>
  )
}

export const StreetLamp = () => (
  <Cut w={70} h={230}>
    <rect x="31" y="56" width="8" height="170" fill="#3a3550" />
    <path d="M20 230H50L44 214H26Z" fill="#3a3550" />
    <path d="M35 60Q35 40 56 40" stroke="#3a3550" strokeWidth="5" fill="none" />
    <path d="M16 56H54L48 26H22Z" fill="#3a3550" />
    <rect x="23" y="30" width="24" height="23" fill="#ffd36b" />
    <path d="M18 26L35 10L52 26Z" fill="#3a3550" />
    <circle cx="35" cy="8" r="4" fill="#e3b45f" />
  </Cut>
)

export function Cobbles() {
  const r = rng(21)
  return (
    <Cut w={330} h={100}>
      {Array.from({ length: 34 }, (_, i) => {
        const t = i / 34
        return (
          <ellipse
            key={i}
            cx={16 + t * 298 + (r() - 0.5) * 10}
            cy={50 + Math.sin(t * Math.PI * 1.6) * 22 + (r() - 0.5) * 34}
            rx={11 + r() * 5}
            ry={7 + r() * 2}
            fill={i % 3 ? '#4d5288' : '#5e6499'}
          />
        )
      })}
    </Cut>
  )
}

/* ================= 第二页：海底图书馆 ================= */

export function Kelp({ tones = ['#2f8f72', '#3ea381', '#5bb98f', '#277a63'] }: { tones?: string[] }) {
  const fronds: [number, number, number][] = [[30, 40, 0], [60, 0, 1], [92, 30, 2], [112, 70, 3]]
  return (
    <Cut w={130} h={240}>
      {fronds.map(([x, top, t], i) => (
        <path key={i} d={`M${x - 7} 240C${x - 26} ${top + 150} ${x + 18} ${top + 90} ${x - 4} ${top}C${x + 22} ${top + 70} ${x - 6} ${top + 150} ${x + 9} 240Z`} fill={tones[t]} />
      ))}
      {fronds.map(([x, top], i) => (
        <path key={`v${i}`} d={`M${x} 236C${x - 12} ${top + 150} ${x + 8} ${top + 90} ${x - 3} ${top + 16}`} stroke="#00000022" strokeWidth="2" fill="none" />
      ))}
    </Cut>
  )
}

export const CoralReef = () => (
  <Cut w={280} h={150}>
    <g stroke="#ef7d8a" strokeWidth="9" strokeLinecap="round" fill="none">
      <path d="M60 120V70M60 92L40 66M60 84L80 56M40 66L34 46M80 56L88 38" />
    </g>
    <g stroke="#f2a65a" strokeWidth="8" strokeLinecap="round" fill="none">
      <path d="M204 116V74M204 96L226 70M204 86L186 60M226 70L230 50M186 60L180 42" />
    </g>
    <path d="M140 118L102 62Q140 24 178 62Z" fill="#b48ee0" />
    <path d="M140 118L118 50M140 118L140 40M140 118L162 50M140 118L106 70M140 118L174 70" stroke="#8c66c2" strokeWidth="2.5" />
    <path d="M0 150C10 120 40 112 70 118C100 100 150 104 180 116C210 106 260 112 280 150Z" fill="#5a5d8f" />
    <ellipse cx="248" cy="124" rx="24" ry="16" fill="#f3c66e" />
    <path d="M230 122Q238 112 246 122T262 122M234 130Q242 122 250 130T264 128" stroke="#d9a13a" strokeWidth="2.5" fill="none" />
    <g fill="#f78fb3">
      {Array.from({ length: 9 }, (_, i) => <ellipse key={i} cx="26" cy="108" rx="4" ry="15" transform={`rotate(${-60 + i * 15} 26 124)`} />)}
    </g>
    <path d={polyStar(110, 136, 11, 5)} fill="#f2a65a" />
    <ellipse cx="170" cy="138" rx="8" ry="5" fill="#fbf3df" />
  </Cut>
)

export function Jelly({ color = '#f3a6c8', glow = '#fde1ee' }: { color?: string; glow?: string }) {
  return (
    <Cut w={90} h={190}>
      {[18, 32, 46, 60, 72].map((x, i) => (
        <path key={i} d={`M${x} 60C${x - 10} 90 ${x + 10} 120 ${x - 4} 150S${x + 6} 180 ${x} 190`} stroke={i % 2 ? color : glow} strokeWidth="4" fill="none" strokeLinecap="round" />
      ))}
      <path d="M6 62Q8 4 45 4T84 62Q74 70 64 62Q54 72 45 62Q36 72 26 62Q16 70 6 62Z" fill={color} />
      <path d="M20 40Q26 18 45 16" stroke={glow} strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="58" cy="30" r="4" fill={glow} />
      <circle cx="34" cy="46" r="3" fill={glow} />
    </Cut>
  )
}

export function WhaleLibrary() {
  const g = useGid('whale')
  const r = rng(31)
  const bookColors = ['#d9483b', '#f2b632', '#4fa3a0', '#b48ee0', '#fbf3df', '#6f9b7a', '#f28b82']
  const row = (y: number, h: number) => {
    const out: ReactNode[] = []
    let x = 128
    let i = 0
    while (x < 230) {
      const w = 7 + r() * 5
      const bh = h - r() * 6
      out.push(<rect key={`${y}-${i}`} x={x} y={y + h - bh} width={w - 1.5} height={bh} fill={bookColors[i % bookColors.length]} />)
      x += w
      i++
    }
    return out
  }
  return (
    <Cut w={340} h={220}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a8acb" />
          <stop offset="1" stopColor="#355f9e" />
        </linearGradient>
      </defs>
      <path d="M0 220L0 202Q20 188 40 202T80 202T120 202T160 202T200 202T240 202T280 202T320 202T340 198L340 220Z" fill="#8fd3e8" />
      <path d="M30 130C30 80 90 62 170 66C240 70 270 100 282 120L318 92C326 88 334 92 330 102L312 134L332 160C336 170 326 174 318 168L284 146C270 176 220 196 150 194C80 192 30 172 30 130Z" fill={`url(#${g})`} />
      <path d="M44 150C70 180 140 188 200 180C240 174 266 160 276 146C240 160 160 166 100 160C76 158 56 154 44 150Z" fill="#a9d2ec" />
      <path d="M80 168Q130 178 190 172M92 176Q140 184 186 180" stroke="#7fb0d6" strokeWidth="2" fill="none" />
      <path d="M140 160Q150 188 178 188Q168 168 156 158Z" fill="#2f568f" />
      <circle cx="80" cy="128" r="6" fill="#1d2a44" />
      <circle cx="82" cy="126" r="2" fill="#fff" />
      <path d="M48 146Q70 156 96 150" stroke="#1d2a44" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="98" cy="140" r="7" fill="#f3a6c8" opacity=".75" />
      <path d="M114 18L180 2L246 18Z" fill="#d9483b" />
      <rect x="120" y="16" width="120" height="58" rx="3" fill="#8a5a3c" />
      <rect x="126" y="22" width="108" height="22" fill="#4a2e20" />
      <rect x="126" y="48" width="108" height="20" fill="#4a2e20" />
      {row(22, 22)}
      {row(48, 20)}
      <rect x="170" y="74" width="20" height="8" fill="#8a5a3c" />
    </Cut>
  )
}

export function FishSchool() {
  const fish: [number, number, number, string][] = [
    [40, 30, 1, '#f2a65a'], [92, 16, 0.8, '#f9e07f'], [142, 36, 1.1, '#f2a65a'],
    [192, 20, 0.85, '#ef7d8a'], [70, 62, 0.9, '#f9e07f'], [164, 66, 0.8, '#f2a65a'],
  ]
  return (
    <Cut w={230} h={110}>
      {fish.map(([x, y], i) => (
        <path key={`s${i}`} d={`M${x + (i % 2 ? 6 : -6)} 104Q${x + 8} ${(y + 104) / 2} ${x} ${y + 6}`} stroke="#3ea381" strokeWidth="3" fill="none" />
      ))}
      <path d="M0 110C20 92 60 88 115 92C170 88 210 92 230 110Z" fill="#e4c98f" />
      {fish.map(([x, y, s, c], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M-16 0L-28 -10L-28 10Z" fill={c} />
          <path d="M-18 0Q0 -15 20 0Q0 15 -18 0Z" fill={c} />
          <path d="M-4 -10V10" stroke="#fff6e0" strokeWidth="3" />
          <circle cx="11" cy="-2" r="2.2" fill="#2b2433" />
        </g>
      ))}
    </Cut>
  )
}

export const Seashells = () => (
  <Cut w={190} h={80}>
    <path d={polyStar(36, 44, 26, 11)} fill="#f2a65a" />
    <path d={polyStar(36, 44, 14, 6)} fill="#f7c27d" />
    <path d="M86 64L110 20L134 64Q110 74 86 64Z" fill="#f6c5b4" />
    <path d="M110 22L96 64M110 22L110 68M110 22L124 64" stroke="#e39a86" strokeWidth="2.5" />
    <path d="M150 56C150 36 186 36 186 56C186 66 150 66 150 56Z" fill="#cfe3f2" />
    <path d="M156 52Q168 44 180 52" stroke="#9fc0db" strokeWidth="2.5" fill="none" />
  </Cut>
)

/* ================= 第三页：云上果园 ================= */

export const FloatIsland = () => (
  <Cut w={260} h={280}>
    <g fill="#fdfbf6">
      <circle cx="100" cy="252" r="28" />
      <circle cx="140" cy="244" r="34" />
      <circle cx="176" cy="256" r="24" />
      <circle cx="128" cy="214" r="22" />
      <rect x="76" y="252" width="124" height="28" />
    </g>
    <path d="M30 150H230L192 186L160 214L122 224L90 202L60 180Z" fill="#a7745a" />
    <path d="M46 162H214L196 178H64Z" fill="#8f5f48" />
    <path d="M88 188H172L156 204H104Z" fill="#8f5f48" />
    <path d="M22 152C40 128 220 128 238 152C220 164 40 164 22 152Z" fill="#7fbf6a" />
    <path d="M124 148L128 92H136L140 148Z" fill="#7a4e33" />
    <path d="M156 100V134M176 100V134" stroke="#5a3d2b" strokeWidth="2" />
    <rect x="150" y="132" width="32" height="5" rx="2" fill="#8a5a3c" />
    <circle cx="132" cy="72" r="46" fill="#5fa65a" />
    <circle cx="98" cy="90" r="28" fill="#6fb866" />
    <circle cx="166" cy="88" r="30" fill="#6fb866" />
    <circle cx="132" cy="42" r="28" fill="#7fc874" />
    {[[110, 66], [150, 54], [168, 92], [96, 96], [134, 96], [124, 34]].map(([x, y], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r="7" fill="#f6a33a" />
        <circle cx={x - 2} cy={y - 2} r="2" fill="#ffe0a0" />
      </g>
    ))}
    {[50, 70, 196, 214].map((x, i) => <circle key={i} cx={x} cy={148 - (i % 2) * 3} r="3.5" fill={i % 2 ? '#f9e07f' : '#f28b82'} />)}
  </Cut>
)

export const Balloon = () => (
  <Cut w={140} h={240}>
    <path d="M70 172Q58 202 70 232" stroke="#8a5a3c" strokeWidth="2" fill="none" />
    <rect x="62" y="228" width="16" height="12" rx="2" fill="#8a5a3c" />
    <path d="M32 104L56 150M108 104L84 150" stroke="#8a5a3c" strokeWidth="2" />
    <path d="M70 2C30 2 8 34 10 66C12 96 40 112 56 132H84C100 112 128 96 130 66C132 34 110 2 70 2Z" fill="#ef7d6a" />
    <path d="M70 2C52 2 40 40 46 80C50 104 58 120 62 132H78C82 120 90 104 94 80C100 40 88 2 70 2Z" fill="#fbf3df" />
    <path d="M70 2C64 2 60 40 62 80C63 104 66 120 68 132H72C74 120 77 104 78 80C80 40 76 2 70 2Z" fill="#f6c35f" />
    <path d="M28 40Q36 18 56 10" stroke="#fff" strokeOpacity=".55" strokeWidth="5" fill="none" strokeLinecap="round" />
    <path d="M50 124H90L86 134H54Z" fill="#c9533f" />
    <path d="M78 150L92 128" stroke="#f2b632" strokeWidth="5" strokeLinecap="round" />
    <GirlHead x={70} y={142} s={0.42} happy />
    <path d="M52 152H88L84 174H56Z" fill="#b8854a" />
    <path d="M54 160H86M55 167H85M64 152L62 174M76 152L78 174" stroke="#8a5a3c" strokeWidth="1.5" />
  </Cut>
)

export const Windmill = () => (
  <Cut
    w={150}
    h={240}
    live={
      <g className="spin" style={{ animationDuration: '9s' }}>
        {[0, 90, 180, 270].map((a) => (
          <g key={a} transform={`rotate(${a} 75 92)`}>
            <rect x="72" y="22" width="6" height="70" fill="#8a5a3c" />
            <rect x="78" y="26" width="20" height="60" fill="#fbf3df" stroke="#e9dcc0" strokeWidth="1" />
            <path d="M78 38H98M78 50H98M78 62H98M78 74H98" stroke="#c9b48a" strokeWidth="1.5" />
          </g>
        ))}
        <circle cx="75" cy="92" r="7" fill="#5a3d2b" />
      </g>
    }
  >
    <path d="M50 240L60 96H90L100 240Z" fill="#f4ead2" />
    <path d="M80 96H90L100 240H86Z" fill="#e2d4b4" />
    <path d="M66 240V214Q75 204 84 214V240Z" fill="#4f78a8" />
    <circle cx="75" cy="152" r="7" fill="#ffd36b" />
    <path d="M52 100L75 62L98 100Z" fill="#d9584a" />
  </Cut>
)

export const FruitCart = () => (
  <Cut w={150} h={120}>
    <path d="M120 70L148 48" stroke="#8a5a3c" strokeWidth="5" strokeLinecap="round" />
    {[[30, 50, '#f6a33a'], [48, 46, '#e2574c'], [66, 48, '#f6a33a'], [84, 44, '#f6a33a'], [102, 50, '#e2574c'], [40, 34, '#f6a33a'], [58, 32, '#9ccf6a'], [76, 30, '#f6a33a'], [94, 34, '#e2574c'], [66, 18, '#f6a33a']].map(([x, y, c], i) => (
      <g key={i}>
        <circle cx={x as number} cy={y as number} r="10" fill={c as string} />
        <circle cx={(x as number) - 3} cy={(y as number) - 3} r="2.5" fill="#fff2c8" />
      </g>
    ))}
    <path d="M14 58H126L118 96H22Z" fill="#b8854a" />
    <path d="M18 70H122M20 82H120" stroke="#8a5a3c" strokeWidth="2" />
    {[40, 104].map((x) => (
      <g key={x}>
        <circle cx={x} cy="104" r="16" fill="#6b4a32" />
        <path d={`M${x - 14} 104H${x + 14}M${x} 90V118M${x - 10} 94L${x + 10} 114M${x + 10} 94L${x - 10} 114`} stroke="#d9b27a" strokeWidth="2" />
        <circle cx={x} cy="104" r="5" fill="#d9b27a" />
      </g>
    ))}
  </Cut>
)

export function CloudBank({ seed = 5 }: { seed?: number }) {
  const r = rng(seed)
  return (
    <Cut w={460} h={90}>
      <g fill="#f7dfe6">
        {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={36 + i * 48.5} cy={46 + r() * 8} r={26 + r() * 8} />)}
      </g>
      <g fill="#fdfbf6">
        {Array.from({ length: 11 }, (_, i) => <circle key={i} cx={28 + i * 40.4} cy={64 + r() * 6} r={20 + r() * 6} />)}
        <rect x="0" y="66" width="460" height="24" />
      </g>
    </Cut>
  )
}

export const OrchardTree = () => (
  <Cut w={170} h={240}>
    <path d="M78 240L80 150H92L96 240Z" fill="#7a4e33" />
    <path d="M86 170L60 140M88 160L114 132" stroke="#7a4e33" strokeWidth="7" strokeLinecap="round" />
    <ellipse cx="86" cy="96" rx="78" ry="66" fill="#8cc76c" />
    <ellipse cx="60" cy="110" rx="40" ry="34" fill="#9ed47a" />
    <ellipse cx="118" cy="80" rx="42" ry="36" fill="#7dbb62" />
    {[[50, 90], [80, 60], [120, 70], [140, 104], [96, 116], [64, 128], [110, 140], [32, 116]].map(([x, y], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r="8" fill="#f6a33a" />
        <path d={`M${x} ${y - 8}l3 -4`} stroke="#4f7a45" strokeWidth="2" />
      </g>
    ))}
    <path d="M118 240L132 160M142 240L132 160M122 210H138M126 186H136" stroke="#c9a06a" strokeWidth="4" strokeLinecap="round" />
  </Cut>
)

export const Picnic = () => (
  <Cut w={170} h={100}>
    <path d="M24 20H160L146 96H10Z" fill="#fbf3df" />
    {[0, 1, 2, 3, 4].map((i) => <path key={`v${i}`} d={`M${36 + i * 27} 20L${22 + i * 27} 96`} stroke="#f28b82" strokeOpacity=".6" strokeWidth="10" />)}
    {[0, 1, 2].map((i) => <path key={`h${i}`} d={`M${21 - i * 2} ${34 + i * 25}H${157 - i * 2}`} stroke="#f28b82" strokeOpacity=".5" strokeWidth="10" />)}
    <path d="M72 50H114L108 76H78Z" fill="#b8854a" />
    <path d="M78 50Q93 26 108 50" stroke="#8a5a3c" strokeWidth="4" fill="none" />
    <circle cx="84" cy="48" r="6" fill="#f6a33a" />
    <circle cx="96" cy="46" r="6" fill="#e2574c" />
    <circle cx="106" cy="48" r="6" fill="#f6a33a" />
  </Cut>
)

/* ================= 第四页：萤火虫森林 ================= */

export function Pines({ fireflies = true }: { fireflies?: boolean }) {
  const trees: [number, number, number, string, string][] = [
    [56, 210, 90, '#2f5d4a', '#3f7a5c'],
    [130, 250, 106, '#264f40', '#356b52'],
    [94, 160, 80, '#3f7a5c', '#4f8f68'],
  ]
  return (
    <Cut w={190} h={260} live={fireflies ? <Fireflies seed={17} count={6} y0={40} y1={220} /> : undefined}>
      {trees.map(([x, h, w, c1, c2], i) => (
        <g key={i}>
          <rect x={x - 5} y={236} width="10" height="24" fill="#5a3d2b" />
          {[0, 1, 2].map((k) => {
            const top = 260 - h + k * h * 0.26
            const bot = top + h * 0.42
            const ww = w * (0.6 + k * 0.2)
            return (
              <g key={k}>
                <path d={`M${x} ${top}L${x + ww / 2} ${bot}L${x - ww / 2} ${bot}Z`} fill={c1} />
                <path d={`M${x} ${top}L${x + ww / 2} ${bot}H${x}Z`} fill={c2} />
              </g>
            )
          })}
        </g>
      ))}
    </Cut>
  )
}

export const MushroomHouse = () => (
  <Cut w={170} h={180}>
    <rect x="120" y="16" width="12" height="26" fill="#8a5a3c" />
    <path d="M50 180C46 140 52 100 60 86H110C118 100 124 140 120 180Z" fill="#f4ead2" />
    <path d="M74 180V150Q85 136 96 150V180Z" fill="#8a5a3c" />
    <circle cx="92" cy="164" r="2" fill="#f2b632" />
    <circle cx="102" cy="116" r="9" fill="#ffd36b" />
    <path d="M102 107V125M93 116H111" stroke="#8a5a3c" strokeWidth="2" />
    <path d="M6 92C10 30 60 6 85 6S160 30 164 92C130 104 40 104 6 92Z" fill="#d9483b" />
    <path d="M20 94C60 104 110 104 150 94L146 100C110 108 60 108 24 100Z" fill="#b8323c" />
    {[[40, 50, 10], [80, 30, 8], [120, 52, 11], [60, 76, 6], [104, 78, 7], [146, 76, 5], [24, 76, 5]].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill="#fbf3df" />
    ))}
    <path d="M40 100V114" stroke="#5a3d2b" strokeWidth="2" />
    <circle cx="40" cy="120" r="7" fill="#ffd36b" />
    <path d="M140 180V164" stroke="#f4ead2" strokeWidth="6" />
    <path d="M128 166Q140 146 152 166Z" fill="#f28b5a" />
    <path d="M30 180V168" stroke="#f4ead2" strokeWidth="5" />
    <path d="M21 170Q30 154 39 170Z" fill="#e9b85a" />
  </Cut>
)

export const OwlConductor = () => (
  <Cut w={140} h={180}>
    <path d="M30 180L36 120H104L110 180Z" fill="#8a5a3c" />
    <path d="M24 180Q30 170 38 172M116 180Q110 170 102 172" stroke="#7a4e33" strokeWidth="6" strokeLinecap="round" fill="none" />
    <ellipse cx="70" cy="120" rx="34" ry="9" fill="#c9a06a" />
    <ellipse cx="70" cy="120" rx="20" ry="5" fill="none" stroke="#a87d4a" strokeWidth="2" />
    <path d="M98 84Q118 74 122 60" stroke="#7a5c40" strokeWidth="10" strokeLinecap="round" fill="none" />
    <path d="M122 60L134 32" stroke="#fbf3df" strokeWidth="3" strokeLinecap="round" />
    <path d="M44 56L40 32L58 50Z" fill="#9a7a5a" />
    <path d="M96 56L100 32L82 50Z" fill="#9a7a5a" />
    <ellipse cx="70" cy="86" rx="30" ry="36" fill="#9a7a5a" />
    <ellipse cx="70" cy="96" rx="19" ry="24" fill="#e9d8b8" />
    <path d="M62 92l4 4 4-4 4 4 4-4M62 102l4 4 4-4 4 4 4-4" stroke="#b89a70" strokeWidth="1.8" fill="none" />
    <circle cx="58" cy="70" r="12" fill="#fbf3df" />
    <circle cx="82" cy="70" r="12" fill="#fbf3df" />
    <circle cx="58" cy="71" r="6" fill="#2b2433" />
    <circle cx="82" cy="71" r="6" fill="#2b2433" />
    <circle cx="60" cy="69" r="2" fill="#fff" />
    <circle cx="84" cy="69" r="2" fill="#fff" />
    <path d="M66 80H74L70 90Z" fill="#f2a65a" />
    <path d="M60 108L70 112L60 116ZM80 108L70 112L80 116Z" fill="#d9483b" />
  </Cut>
)

export const Deer = () => (
  <Cut w={170} h={200}>
    {[[56, 140], [72, 142], [108, 142], [122, 140]].map(([x, y], i) => (
      <g key={i}>
        <rect x={x} y={y} width="9" height={194 - y} rx="3" fill="#b9764a" />
        <rect x={x} y="192" width="9" height="8" rx="2" fill="#4a3428" />
      </g>
    ))}
    <path d="M132 104Q146 98 142 114Z" fill="#fbf3df" />
    <path d="M40 112C40 92 60 86 90 88C116 88 134 96 134 116C134 136 116 146 86 146C56 146 40 134 40 112Z" fill="#c98250" />
    {[[86, 98], [102, 96], [114, 104], [94, 108]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#fbf3df" />)}
    <path d="M46 114L40 70L60 66L68 104Z" fill="#c98250" />
    <path d="M44 98Q52 112 64 106L60 92Z" fill="#fbf3df" />
    <path d="M58 50L78 40L64 62Z" fill="#c98250" />
    <path d="M62 50L74 44L66 56Z" fill="#f3a6a0" />
    <g stroke="#e9d8b8" strokeWidth="4" strokeLinecap="round" fill="none">
      <path d="M44 46L40 20M40 30L30 18M40 24L48 10" />
      <path d="M54 46L62 22M60 30L72 20M62 22L58 8" />
    </g>
    {[[30, 18, '#f28b82'], [48, 10, '#f9e07f'], [72, 20, '#f9e07f'], [58, 8, '#f28b82'], [40, 20, '#fbf3df']].map(([x, y, c], i) => (
      <g key={i}>
        {[0, 90, 180, 270].map((a) => <circle key={a} cx={(x as number) + Math.cos((a * Math.PI) / 180) * 3.5} cy={(y as number) + Math.sin((a * Math.PI) / 180) * 3.5} r="3" fill={c as string} />)}
        <circle cx={x as number} cy={y as number} r="2" fill="#e3a13a" />
      </g>
    ))}
    <ellipse cx="46" cy="60" rx="18" ry="15" fill="#c98250" />
    <ellipse cx="32" cy="66" rx="9" ry="7" fill="#e9b88a" />
    <circle cx="26" cy="64" r="3" fill="#2b2433" />
    <circle cx="46" cy="56" r="2.6" fill="#2b2433" />
  </Cut>
)

export const Stream = () => (
  <Cut w={420} h={90}>
    <path d="M0 40C60 10 120 70 200 46C280 22 340 60 420 34V64C340 88 280 50 200 74C120 98 60 38 0 70Z" fill="#4f8fb8" />
    <path d="M30 50C70 36 110 64 160 56M230 50C280 40 320 56 380 46" stroke="#a9d6ef" strokeWidth="3" fill="none" strokeLinecap="round" />
    {[[60, 80], [150, 30], [270, 84], [350, 26]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="12" ry="7" fill="#7d7f96" />)}
  </Cut>
)
