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

/* ================= 主角：阿笺与黑猫墨点 ================= */

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
      <g className="sway" style={{ transformOrigin: '65px 240px' }}>
        {fronds.map(([x, top, t], i) => (
          <path key={i} d={`M${x - 7} 240C${x - 26} ${top + 150} ${x + 18} ${top + 90} ${x - 4} ${top}C${x + 22} ${top + 70} ${x - 6} ${top + 150} ${x + 9} 240Z`} fill={tones[t]} />
        ))}
        {fronds.map(([x, top], i) => (
          <path key={`v${i}`} d={`M${x} 236C${x - 12} ${top + 150} ${x + 8} ${top + 90} ${x - 3} ${top + 16}`} stroke="#00000022" strokeWidth="2" fill="none" />
        ))}
      </g>
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
    <g className="bob">
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
    </g>
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

/* ================= 主题贴纸：万圣夜 ================= */

/** 南瓜灯 */
export const Pumpkin = () => (
  <Cut w={150} h={142}>
    <path d="M74 24c3-12 12-16 19-10" stroke="#5f8a4a" strokeWidth="7" strokeLinecap="round" fill="none" />
    <path d="M62 32h26l-4 15H66Z" fill="#6b8f4e" />
    <ellipse cx="75" cy="90" rx="62" ry="48" fill="#e8803a" />
    <path d="M75 44c14 8 20 26 20 46s-6 38-20 46" stroke="#c9702c" strokeWidth="5" fill="none" />
    <path d="M75 44c-14 8-20 26-20 46s6 38 20 46" stroke="#c9702c" strokeWidth="5" fill="none" />
    <path d="M46 78l17 9-17 6Z" fill="#3d2317" />
    <path d="M104 78l-17 9 17 6Z" fill="#3d2317" />
    <path d="M52 108c9 11 37 11 46 0-3 13-43 13-46 0Z" fill="#3d2317" />
  </Cut>
)

/** 小幽灵 */
export const Ghost = () => (
  <Cut w={120} h={150}>
    <path d="M22 140V72a38 38 0 0 1 76 0v68l-13-11-12 11-13-11-13 11-12-11Z" fill="#f8f3ea" />
    <ellipse cx="46" cy="70" rx="7" ry="10" fill="#43394f" />
    <ellipse cx="76" cy="70" rx="7" ry="10" fill="#43394f" />
    <ellipse cx="61" cy="96" rx="9" ry="7" fill="#43394f" opacity=".7" />
    <circle cx="29" cy="88" r="7" fill="#f7c6cf" opacity=".65" />
    <circle cx="93" cy="88" r="7" fill="#f7c6cf" opacity=".65" />
  </Cut>
)

/** 蝙蝠 */
export const Bat = () => (
  <Cut w={160} h={90}>
    <path d="M56 40C42 22 22 16 4 24c9 7 9 17 5 23 14-4 24 3 31 7 5 3 11 9 16 12Z" fill="#3b3155" />
    <path d="M104 40c14-18 34-24 52-16-9 7-9 17-5 23-14-4-24 3-31 7-5 3-11 9-16 12Z" fill="#3b3155" />
    <path d="M80 34c9 0 13 6 13 15v26H67V49c0-9 4-15 13-15Z" fill="#2f2740" />
    <path d="M70 30l4-13 7 13M90 30l-4-13-7 13" fill="#2f2740" />
    <circle cx="73" cy="50" r="3.2" fill="#ffd76a" />
    <circle cx="87" cy="50" r="3.2" fill="#ffd76a" />
  </Cut>
)

/** 墓碑 */
export const Tombstone = () => (
  <Cut w={132} h={142}>
    <path d="M20 138V60a46 46 0 0 1 92 0v78Z" fill="#9aa0b4" />
    <path d="M66 16v122" stroke="#7d849c" strokeWidth="5" opacity=".45" />
    <path d="M20 96h92" stroke="#7d849c" strokeWidth="5" opacity=".35" />
    <text x="66" y="78" textAnchor="middle" fill="#5c637a" fontSize="24" fontFamily="Georgia, serif">RIP</text>
    <path d="M0 138h132" stroke="#6b7284" strokeWidth="7" strokeLinecap="round" />
    <path d="M28 138c1-13 8-17 8-17M104 138c-1-13-8-17-8-17" stroke="#5f7a4e" strokeWidth="5" fill="none" strokeLinecap="round" />
  </Cut>
)

/** 小女巫 */
export const Witch = () => (
  <Cut w={140} h={220}>
    <path d="M20 220c4-52 18-84 26-96h48c8 12 22 44 26 96Z" fill="#5b3f86" />
    <path d="M70 124v96" stroke="#4a326f" strokeWidth="4" opacity=".6" />
    <path d="M44 124c0-26 10-40 26-40s26 14 26 40Z" fill="#6b4b9a" />
    <circle cx="70" cy="80" r="22" fill="#f6d9bd" />
    <circle cx="62" cy="78" r="2.6" fill="#40304f" />
    <circle cx="78" cy="78" r="2.6" fill="#40304f" />
    <path d="M64 90q6 6 12 0" stroke="#c8777a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    <path d="M32 56c8-6 30-10 76-10L70 6Z" fill="#3a2a55" />
    <path d="M30 54c22-8 58-8 78 0-8 8-24 10-39 10s-31-2-39-10Z" fill="#4a3568" />
    <path d="M44 54c10 5 42 5 52 0" stroke="#c9a05a" strokeWidth="4" fill="none" />
  </Cut>
)

/** 糖果篮 */
export const CandyBasket = () => (
  <Cut w={140} h={122}>
    <path d="M22 58h96l-11 58H33Z" fill="#8a5a3c" />
    <path d="M28 74h84M33 94h74" stroke="#a97347" strokeWidth="4" />
    <path d="M34 58c8-24 64-24 72 0" stroke="#b8854a" strokeWidth="6" fill="none" />
    <circle cx="52" cy="46" r="12" fill="#f27b8a" />
    <circle cx="74" cy="40" r="13" fill="#f6c453" />
    <circle cx="94" cy="48" r="11" fill="#8fd0a8" />
    <path d="M52 34v-8M74 27v-8M94 37v-8" stroke="#6b8f6a" strokeWidth="3" strokeLinecap="round" />
  </Cut>
)

/* ================= 主题贴纸：午后生活 ================= */

/** 咖啡杯 */
export const CoffeeCup = () => (
  <Cut w={124} h={130}>
    <ellipse cx="60" cy="116" rx="44" ry="10" fill="#e6d8bd" />
    <path d="M26 52h64l-9 58H35Z" fill="#f8f3e7" />
    <path d="M26 52h64" stroke="#dbcaab" strokeWidth="4" />
    <path d="M24 52c14 6 48 6 62 0-14 5-48 5-62 0Z" fill="#c98f5a" />
    <path d="M90 62c15 0 18 28 0 32" stroke="#f8f3e7" strokeWidth="8" fill="none" />
    <path d="M46 42c-6-8 5-12 0-20M62 42c-6-8 5-12 0-20M78 42c-6-8 5-12 0-20" stroke="#d8cbb3" strokeWidth="3" fill="none" strokeLinecap="round" />
    <circle cx="60" cy="52" r="3" fill="#c98f5a" opacity=".5" />
  </Cut>
)

/** 书堆 */
export const BookStack = () => (
  <Cut w={150} h={124}>
    <rect x="16" y="92" width="118" height="18" rx="3" fill="#c96a5a" />
    <rect x="24" y="74" width="104" height="18" rx="3" fill="#5f8fb8" />
    <rect x="20" y="56" width="112" height="18" rx="3" fill="#e3b453" />
    <rect x="30" y="38" width="92" height="18" rx="3" fill="#7fa87a" />
    <path d="M36 92v18M40 74v18M36 56v18M46 38v18" stroke="#f8f0dc" strokeWidth="3" />
    <path d="M110 20c0-8 16-8 16 0v18h-16Z" fill="#8a5a3c" />
    <path d="M62 20c14-10 30-6 30 10H62Z" fill="#f2c9a0" />
  </Cut>
)

/** 盆栽 */
export const PlantPot = () => (
  <Cut w={120} h={160}>
    <path d="M34 108h52l-7 50H41Z" fill="#c97f5c" />
    <path d="M30 100h60v12H30Z" fill="#d9926c" />
    <path d="M60 100V40" stroke="#5f8a4a" strokeWidth="6" strokeLinecap="round" />
    <path d="M60 68c-20 0-30-14-30-30 18-2 30 10 30 30Z" fill="#6fa45a" />
    <path d="M60 78c20 0 30-14 30-30-18-2-30 10-30 30Z" fill="#82b768" />
    <path d="M60 44c-12-6-14-20-8-32 14 4 18 16 8 32Z" fill="#8cc276" />
  </Cut>
)

/** 打盹的猫 */
export const CatNap = () => (  <Cut w={160} h={110}>
    <path d="M18 92c-2-26 18-44 44-44h36c26 0 44 18 44 44Z" fill="#6a5a7e" />
    <path d="M112 74c10 2 18 8 22 18h-26Z" fill="#7b6a91" />
    <path d="M126 92c8 0 12 8 12 14h-24c0-8 4-14 12-14Z" fill="#8a7aa0" />
    <path d="M30 52l-8-22 24 8M72 40l6-22 14 20" fill="#6a5a7e" />
    <path d="M34 88c6-6 10-6 16 0M58 88c6-6 10-6 16 0" stroke="#3a2f47" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M44 96h16" stroke="#f2b8c6" strokeWidth="4" strokeLinecap="round" />
    <path d="M8 104h144" stroke="#4a3d5c" strokeWidth="4" strokeLinecap="round" opacity=".35" />
  </Cut>
)

/** 露营帐篷 */
export const Tent = () => (
  <Cut w={180} h={132}>
    <path d="M90 10L172 126H8Z" fill="#d9a05a" />
    <path d="M90 10L172 126H96Z" fill="#c48b46" />
    <path d="M90 48L127 126H53Z" fill="#3b3048" />
    <path d="M90 10V0" stroke="#7a4e33" strokeWidth="4" strokeLinecap="round" />
    <path d="M0 126h180" stroke="#7a5a3a" strokeWidth="6" strokeLinecap="round" />
    <circle cx="62" cy="112" r="5" fill="#ffd36b" />
    <circle cx="118" cy="112" r="5" fill="#ffd36b" />
  </Cut>
)

/* ================= 主题地面 ================= */
/** 客厅地毯 */
export const Rug = () => (
  <Cut w={460} h={112}>
    <ellipse cx="230" cy="60" rx="214" ry="48" fill="#d98a7a" />
    <ellipse cx="230" cy="60" rx="184" ry="36" fill="none" stroke="#f2e4cf" strokeWidth="5" />
    <ellipse cx="230" cy="60" rx="140" ry="22" fill="none" stroke="#f2e4cf" strokeWidth="4" />
    <path d="M155 42h150M170 78h120" stroke="#f2e4cf" strokeWidth="3" opacity=".7" />
    {Array.from({ length: 22 }, (_, i) => (
      <path key={`l${i}`} d={`M${14 + i * 20} 12v-9`} stroke="#d98a7a" strokeWidth="4" strokeLinecap="round" />
    ))}
    {Array.from({ length: 22 }, (_, i) => (
      <path key={`r${i}`} d={`M${14 + i * 20} 100v11`} stroke="#d98a7a" strokeWidth="4" strokeLinecap="round" />
    ))}
  </Cut>
)

/** 木地板 */
export const WoodFloor = () => (
  <Cut w={460} h={104}>
    <rect x="0" y="12" width="460" height="92" fill="#c89a68" />
    <path d="M0 40h460M0 68h460M0 94h460" stroke="#ad7f52" strokeWidth="4" />
    <path d="M96 12v28M240 12v28M380 12v28M50 40v28M190 40v28M330 40v28M120 68v26M280 68v26M410 68v26" stroke="#ad7f52" strokeWidth="3" opacity=".8" />
    <path d="M0 12h460" stroke="#d8b183" strokeWidth="4" />
  </Cut>
)

/* ================= 会动的贴纸 =================
   需要动的那几笔单独放进 live（滤镜外），只有它们每帧重画；
   纸的描边和纸纹仍然只算一次。 */

/** 蜡烛：火苗一直抖 */
export const Candle = () => (
  <Cut
    w={90}
    h={150}
    live={
      <g className="flicker">
        <ellipse cx="45" cy="48" rx="7" ry="15" fill="#ffd27a" opacity=".95" />
        <ellipse cx="45" cy="52" rx="4" ry="9" fill="#fff6d8" />
      </g>
    }
  >
    <path d="M28 74h34l-3 66H31Z" fill="#f7e9d1" />
    <path d="M28 74c6 6 9 14 8 22-6-4-8-12-8-22Z" fill="#f2dcbb" />
    <path d="M45 70v-8" stroke="#6b5a48" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="45" cy="142" rx="30" ry="8" fill="#c9a06a" />
    <ellipse cx="45" cy="139" rx="30" ry="7" fill="#e0bb85" />
    <path d="M33 96h24" stroke="#e3c9a4" strokeWidth="3" />
  </Cut>
)

/** 吊蛛：一根丝，蜘蛛在下面晃 */
export const Spider = () => (
  <Cut
    w={110}
    h={160}
    live={
      <g className="sway" style={{ transformOrigin: '55px 6px' }}>
        <path d="M55 6v94" stroke="#e8e2d4" strokeWidth="2" />
        <ellipse cx="55" cy="112" rx="17" ry="20" fill="#3a3048" />
        <ellipse cx="55" cy="104" rx="9" ry="8" fill="#514563" />
        <circle cx="50" cy="102" r="2.6" fill="#ffe9a8" />
        <circle cx="60" cy="102" r="2.6" fill="#ffe9a8" />
        <path d="M38 108l-12-8M38 116l-13 2M38 124l-11 9M72 108l12-8M72 116l13 2M72 124l11 9" stroke="#3a3048" strokeWidth="3" strokeLinecap="round" />
      </g>
    }
  >
    <path d="M55 0v8" stroke="#cfc6b4" strokeWidth="2" />
    <circle cx="55" cy="8" r="3" fill="#cfc6b4" />
  </Cut>
)

/** 台灯：灯罩下的光在呼吸 */
export const DeskLamp = () => (
  <Cut
    w={130}
    h={170}
    live={
      <g>
        <path d="M64 78L96 168H32Z" fill="#ffe6ac" opacity=".55" className="glowpulse" />
        <ellipse cx="64" cy="80" rx="26" ry="7" fill="#fff2c8" className="glowpulse" />
      </g>
    }
  >
    <ellipse cx="64" cy="166" rx="30" ry="8" fill="#8a6a44" />
    <ellipse cx="64" cy="163" rx="30" ry="7" fill="#a8865a" />
    <path d="M64 160V92" stroke="#a8865a" strokeWidth="6" strokeLinecap="round" />
    <path d="M30 78h68l-10-34H40Z" fill="#e8b86a" />
    <path d="M40 44h48l-6-8H46Z" fill="#f0c87c" />
    <path d="M46 78h36" stroke="#c99a52" strokeWidth="3" />
  </Cut>
)

/** 蝴蝶：翅膀从身体边缘往外扇 */
export const Butterfly = () => (
  <Cut
    w={150}
    h={120}
    live={
      <>
        <g className="wingL">
          <path d="M74 62C54 30 22 22 14 44c-8 22 18 34 40 30 8-1 14-3 20-4Z" fill="#f0a6c6" />
          <path d="M74 66c-16 4-34 16-30 30 4 14 26 6 32-6 4-8 2-16-2-24Z" fill="#e98ab4" />
        </g>
        <g className="wingR">
          <path d="M76 62c20-32 52-40 60-18 8 22-18 34-40 30-8-1-14-3-20-4Z" fill="#f0a6c6" />
          <path d="M76 66c16 4 34 16 30 30-4 14-26 6-32-6-4-8-2-16 2-24Z" fill="#e98ab4" />
        </g>
      </>
    }
  >
    <ellipse cx="75" cy="72" rx="5" ry="26" fill="#5a4460" />
    <path d="M72 46c-6-12-14-16-20-16M78 46c6-12 14-16 20-16" stroke="#5a4460" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <circle cx="52" cy="30" r="2.4" fill="#5a4460" />
    <circle cx="98" cy="30" r="2.4" fill="#5a4460" />
  </Cut>
)

/** 松鼠：尾巴慢慢摆 */
export const Squirrel = () => (
  <Cut
    w={150}
    h={160}
    live={
      <g className="sway" style={{ transformOrigin: '112px 150px' }}>
        <path d="M104 148c22-6 34-28 28-52-6-24-26-34-34-22 10 10 12 26 6 40-4 10-10 18-14 24Z" fill="#c98a58" />
        <path d="M108 142c16-8 24-24 20-42" stroke="#e0a878" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
    }
  >
    <ellipse cx="62" cy="138" rx="34" ry="20" fill="#c98a58" />
    <path d="M36 122c0-26 22-40 38-30 14 8 14 30 6 44Z" fill="#d99a68" />
    <path d="M74 92c0-18 10-26 20-26 12 0 18 10 18 24 0 10-8 16-20 16-10 0-18-4-18-14Z" fill="#d99a68" />
    <path d="M80 68l-4-14 12 8M104 66l6-14 4 16" fill="#c98a58" />
    <circle cx="92" cy="90" r="3" fill="#3a2c22" />
    <circle cx="110" cy="90" r="3" fill="#3a2c22" />
    <circle cx="101" cy="99" r="3.4" fill="#6b4a34" />
    <path d="M60 156h20" stroke="#a8714a" strokeWidth="6" strokeLinecap="round" />
  </Cut>
)

/** 蒲公英：种子一直往上飘 */
export const Dandelion = () => {
  const r = rng(53)
  return (
    <Cut
      w={120}
      h={180}
      live={
        <g>
          {Array.from({ length: 7 }, (_, i) => {
            const cx = 54 + r() * 44
            const cy = 44 + r() * 20
            return (
              <g key={i} className="rise" style={{ animationDelay: `${-r() * 6}s`, animationDuration: `${5 + r() * 4}s` }}>
                <circle cx={cx} cy={cy} r="2.4" fill="#fffaf0" />
                <path d={`M${cx} ${cy}l3 -6`} stroke="#efe6d4" strokeWidth="1.4" />
              </g>
            )
          })}
        </g>
      }
    >
      <path d="M58 172c-4-40-2-70 4-96" stroke="#7fa070" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M60 120c-10-8-18-8-24-4M60 140c10-6 16-14 18-22" stroke="#8fb17f" strokeWidth="4" fill="none" strokeLinecap="round" />
      <g fill="#fffaf0" stroke="#eee4d2" strokeWidth="1.2">
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * 360
          const rad = (a * Math.PI) / 180
          return <circle key={i} cx={62 + Math.cos(rad) * 26} cy={66 + Math.sin(rad) * 22} r="3.6" />
        })}
        <circle cx="62" cy="66" r="10" fill="#c8d8b4" />
      </g>
    </Cut>
  )
}

/** 萤火罐：罐子里的光点一直闪 */
export const FireflyJar = () => {
  const r = rng(71)
  return (
    <Cut
      w={120}
      h={160}
      live={
        <g>
          {Array.from({ length: 9 }, (_, i) => (
            <circle
              key={i}
              className="blink"
              cx={36 + r() * 48}
              cy={72 + r() * 56}
              r={2.6 + r() * 2.4}
              fill="#ffe08a"
              style={{ animationDelay: `${-r() * 3}s`, animationDuration: `${1.8 + r() * 2.4}s` }}
            />
          ))}
        </g>
      }
    >
      <path d="M32 58h56l-4 84c-1 8-8 12-24 12s-23-4-24-12Z" fill="#e8f4f0" opacity=".9" />
      <path d="M32 58h56l-1 12H33Z" fill="#c8ded8" />
      <rect x="34" y="46" width="52" height="12" rx="4" fill="#b8854a" />
      <path d="M40 74v60M80 74v60" stroke="#fff" strokeWidth="4" opacity=".55" />
      <path d="M36 132c10 6 38 6 48 0" stroke="#a8c8c0" strokeWidth="3" fill="none" />
    </Cut>
  )
}

/** 帆船：整条船在水上轻轻起伏 */
export const SailBoat = () => (
  <Cut w={190} h={140}>
    <g className="bob">
      <path d="M40 104h116l-14 26H52Z" fill="#c96a5a" />
      <path d="M46 104h106" stroke="#a04f42" strokeWidth="4" />
      <path d="M96 96V18" stroke="#8a5a3c" strokeWidth="5" strokeLinecap="round" />
      <path d="M100 24c26 10 38 34 34 62h-34Z" fill="#fbf3df" />
      <path d="M92 30c-22 12-30 34-28 56h28Z" fill="#f4e4c6" />
      <path d="M100 12l20 8-20 8Z" fill="#d9483b" className="sway" style={{ transformOrigin: '100px 12px' }} />
    </g>
    <path d="M20 134q20-8 40 0t40 0 40 0 30-4" stroke="#8fd0e0" strokeWidth="5" fill="none" strokeLinecap="round" />
  </Cut>
)

/** 风筝：线钉在下面，风筝在上面飘 */
export const Kite = () => (
  <Cut
    w={140}
    h={180}
    live={
      <g className="sway" style={{ transformOrigin: '70px 156px' }}>
        <path d="M70 156C74 120 66 96 70 66" stroke="#cfc6b4" strokeWidth="2" fill="none" />
        <path d="M70 16L108 62L70 112L32 62Z" fill="#f2c14a" />
        <path d="M70 16L70 112M32 62h76" stroke="#d9a132" strokeWidth="2.5" />
        <path d="M70 16L108 62L70 62Z" fill="#f6d87a" />
        <path d="M70 112c-6 10 4 14-2 22s6 12 0 20" stroke="#e8899b" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    }
  >
    <circle cx="70" cy="162" r="4" fill="#8a6a44" />
  </Cut>
)

/** 纸飞机：斜着飞一小段再回来 */
export const PaperPlane = () => (
  <Cut w={160} h={110}>
    <g className="glide">
      <path d="M10 64L150 18L74 96L64 68Z" fill="#fbf3df" />
      <path d="M64 68L150 18L74 96Z" fill="#e8dcc0" />
      <path d="M64 68L58 96L74 96Z" fill="#d4c6a6" />
      <path d="M10 64L64 68L150 18Z" fill="#fffaf0" />
      <path d="M64 68L54 90" stroke="#cfc2a4" strokeWidth="2" />
    </g>
  </Cut>
)

/** 火箭：尾焰在抖 */
export const Rocket = () => (
  <Cut
    w={130}
    h={230}
    live={
      <g className="flicker">
        <path d="M45 186c8 12 12 22 20 34 8-12 12-22 20-34Z" fill="#ffb04a" />
        <path d="M54 186c4 10 6 16 11 24 5-8 7-14 11-24Z" fill="#ffe9a8" />
      </g>
    }
  >
    <path d="M65 8c16 14 26 38 26 64v104H39V72c0-26 10-50 26-64Z" fill="#f4efe4" />
    <path d="M65 8c10 9 18 24 22 42H43c4-18 12-33 22-42Z" fill="#e2564a" />
    <circle cx="65" cy="92" r="16" fill="#9ad3e8" />
    <circle cx="65" cy="92" r="16" fill="none" stroke="#c8d8dc" strokeWidth="4" />
    <circle cx="60" cy="86" r="5" fill="#e6f6ff" opacity=".8" />
    <path d="M39 132L14 176h25ZM91 132l25 44H91Z" fill="#e2564a" />
    <path d="M39 172h52" stroke="#cfc6b4" strokeWidth="4" />
    <path d="M52 160h26" stroke="#dcd2c0" strokeWidth="3" />
  </Cut>
)

/** 行星：光环在转 */
export const Planet = () => (
  <Cut
    w={170}
    h={150}
    live={
      <ellipse
        className="orbit"
        cx="85"
        cy="82"
        rx="78"
        ry="20"
        fill="none"
        stroke="#f0d8a8"
        strokeWidth="6"
        strokeDasharray="16 14"
        opacity=".8"
      />
    }
  >
    <circle cx="85" cy="76" r="52" fill="#8f7ad0" />
    <path d="M36 62c22 8 72 8 96-2" stroke="#b3a2e8" strokeWidth="9" fill="none" />
    <path d="M34 90c20 10 74 10 100-2" stroke="#7a63bd" strokeWidth="11" fill="none" />
    <circle cx="66" cy="56" r="8" fill="#a493de" opacity=".8" />
    <circle cx="104" cy="100" r="11" fill="#7a63bd" opacity=".7" />
    <circle cx="58" cy="96" r="6" fill="#a493de" opacity=".7" />
  </Cut>
)

/** 飞碟：一盏盏灯轮流亮 */
export const Ufo = () => {
  const r = rng(97)
  return (
    <Cut
      w={180}
      h={110}
      live={
        <g>
          {Array.from({ length: 7 }, (_, i) => (
            <circle
              key={i}
              className="blink"
              cx={42 + i * 16}
              cy={78}
              r="4.4"
              fill={['#ffe08a', '#9ae8ff', '#ffb0c8'][i % 3]}
              style={{ animationDelay: `${-i * 0.3}s`, animationDuration: '1.6s' }}
            />
          ))}
        </g>
      }
    >
      <g className="bob">
        <path d="M52 62c0-22 16-34 38-34s38 12 38 34Z" fill="#bfe8f4" opacity=".92" />
        <ellipse cx="90" cy="66" rx="82" ry="22" fill="#9fb4c8" />
        <ellipse cx="90" cy="60" rx="82" ry="20" fill="#c8d8e4" />
        <ellipse cx="90" cy="58" rx="56" ry="12" fill="#e8f2f8" opacity=".7" />
        <circle cx="74" cy="48" r="4" fill="#7fa0b8" />
        <circle cx="102" cy="48" r="4" fill="#7fa0b8" />
      </g>
    </Cut>
  )
}

/** 雪人：围巾在飘 */
export const Snowman = () => (
  <Cut
    w={150}
    h={190}
    live={
      <g className="sway" style={{ transformOrigin: '96px 96px' }}>
        <path d="M92 92c14 2 20 10 26 8 4-1 6 2 4 5-8 6-24 6-32-2Z" fill="#e2564a" />
      </g>
    }
  >
    <ellipse cx="75" cy="176" rx="42" ry="12" fill="#dbe8f0" />
    <circle cx="75" cy="132" r="42" fill="#fbfdff" />
    <circle cx="75" cy="80" r="30" fill="#fbfdff" />
    <path d="M48 62h54l-4-8H52Z" fill="#3a3048" />
    <rect x="56" y="40" width="38" height="16" rx="3" fill="#3a3048" />
    <rect x="50" y="54" width="52" height="6" rx="3" fill="#514563" />
    <circle cx="64" cy="78" r="3.4" fill="#3a3048" />
    <circle cx="86" cy="78" r="3.4" fill="#3a3048" />
    <path d="M75 84l16 6-16 4Z" fill="#f2a24a" />
    <circle cx="75" cy="124" r="4" fill="#3a3048" />
    <circle cx="75" cy="142" r="4.6" fill="#3a3048" />
    <path d="M34 106c10 8 24 10 34 4" stroke="#9ad3e8" strokeWidth="4" fill="none" opacity=".6" />
  </Cut>
)

/** 兔子：长耳朵慢慢晃 */
export const Rabbit = () => (
  <Cut
    w={140}
    h={160}
    live={
      <g className="sway" style={{ transformOrigin: '74px 108px' }}>
        <ellipse cx="66" cy="52" rx="11" ry="34" fill="#f6efe4" transform="rotate(-10 66 52)" />
        <ellipse cx="66" cy="54" rx="5" ry="24" fill="#f6c6cf" transform="rotate(-10 66 54)" />
      </g>
    }
  >
    <ellipse cx="86" cy="126" rx="34" ry="30" fill="#f6efe4" />
    <circle cx="86" cy="88" r="26" fill="#fdfaf4" />
    <ellipse cx="104" cy="44" rx="12" ry="34" fill="#f6efe4" transform="rotate(12 104 44)" />
    <ellipse cx="104" cy="46" rx="5.6" ry="24" fill="#f6c6cf" transform="rotate(12 104 46)" />
    <circle cx="78" cy="86" r="3.4" fill="#3a3048" />
    <circle cx="94" cy="86" r="3.4" fill="#3a3048" />
    <path d="M86 94l4 4-4 3Z" fill="#e8899b" />
    <path d="M86 101c-3 4-8 4-10 0M86 101c3 4 8 4 10 0" stroke="#d8a6ae" strokeWidth="2" fill="none" strokeLinecap="round" />
    <circle cx="60" cy="146" r="14" fill="#f2e8d8" />
  </Cut>
)

/** 蛋糕：蜡烛上的火苗在抖 */
export const Cake = () => (
  <Cut
    w={150}
    h={150}
    live={
      <g className="flicker">
        <ellipse cx="75" cy="34" rx="5" ry="11" fill="#ffd27a" />
        <ellipse cx="75" cy="36" rx="2.6" ry="6" fill="#fff6d8" />
        <ellipse cx="99" cy="40" rx="4" ry="9" fill="#ffd27a" style={{ animationDelay: '-.4s' }} />
        <ellipse cx="51" cy="40" rx="4" ry="9" fill="#ffd27a" style={{ animationDelay: '-.7s' }} />
      </g>
    }
  >
    <path d="M18 88h114l-8 56H26Z" fill="#f6e7d0" />
    <path d="M18 88h114v14H18Z" fill="#f2c9d8" />
    <path d="M28 112c10 8 22-6 34 2s22 6 32-2 18 2 24 0" stroke="#e8b0c4" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M46 88V58M75 88V40M99 88V62" stroke="#e8b0c4" strokeWidth="5" strokeLinecap="round" />
    <path d="M42 58h8M71 40h8M95 62h8" stroke="#c88a4a" strokeWidth="3" />
  </Cut>
)

/* ================= 新场景：沙漠 / 春日 / 夜市 / 洞窟 / 海港 ================= */

/** 仙人掌：整棵轻轻晃，顶上开一朵花 */
export const Cactus = () => (
  <Cut w={130} h={200}>
    <ellipse cx="65" cy="196" rx="30" ry="7" fill="#c9a473" />
    <g className="sway" style={{ transformOrigin: '65px 200px' }}>
      <path d="M56 74h20v126H56Z" fill="#6f9b6a" />
      <path d="M64 74h12v126H64Z" fill="#7fae78" />
      <path d="M56 132H40q-8 0-8-8V96q0-7 7-7t7 7v20h10Z" fill="#5f8c5c" />
      <path d="M76 116h16q8 0 8-8V88q0-7-7-7t-7 7v12H76Z" fill="#5f8c5c" />
      <path d="M46 96v26M84 88v20" stroke="#4d7450" strokeWidth="2.4" strokeLinecap="round" />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${i % 2 ? 57 : 74} ${92 + i * 14}l${i % 2 ? -5 : 5} -3`} stroke="#4d7450" strokeWidth="1.8" strokeLinecap="round" />
      ))}
      <g className="glowpulse">
        <circle cx="66" cy="70" r="9" fill="#f4a0b8" />
        <circle cx="59" cy="74" r="6" fill="#f7bccd" />
        <circle cx="73" cy="74" r="6" fill="#f7bccd" />
        <circle cx="66" cy="76" r="4" fill="#fff2c4" />
      </g>
    </g>
  </Cut>
)

/** 樱花树：花瓣一直在落 */
export const CherryTree = () => {
  const r = rng(83)
  const petals = Array.from({ length: 9 }, (_, i) => ({
    x: 30 + r() * 160,
    y: 40 + r() * 120,
    d: 4 + r() * 4,
    delay: -r() * 8,
  }))
  return (
    <Cut
      w={220}
      h={270}
      live={
        <g fill="#f8c4d8">
          {petals.map((p, i) => (
            <ellipse
              key={i}
              className="petal"
              cx={p.x}
              cy={p.y}
              rx="3.2"
              ry="2"
              style={{ animationDuration: `${p.d}s`, animationDelay: `${p.delay}s` }}
            />
          ))}
        </g>
      }
    >
      <path d="M104 268c2-40 0-70-4-96 10 6 16 6 24-2-6 12-8 24-6 36 4-18 14-30 28-38-12 14-18 30-18 46 8-14 20-24 36-28-14 10-22 24-24 40 6-8 14-14 24-16-10 8-16 18-18 30l-6 28Z" fill="#8a5c48" />
      <g fill="#f6b6ce">
        <ellipse cx="112" cy="96" rx="62" ry="44" />
        <ellipse cx="62" cy="122" rx="44" ry="32" />
        <ellipse cx="164" cy="126" rx="42" ry="30" />
        <ellipse cx="112" cy="60" rx="38" ry="26" />
      </g>
      <g fill="#fbd0e0">
        <ellipse cx="92" cy="86" rx="40" ry="26" />
        <ellipse cx="142" cy="104" rx="30" ry="20" />
        <ellipse cx="70" cy="112" rx="24" ry="16" />
      </g>
      <g fill="#fff3f7" opacity=".9">
        {Array.from({ length: 14 }, (_, i) => (
          <circle key={i} cx={50 + (i * 37) % 150} cy={58 + (i * 29) % 88} r={2 + (i % 3)} />
        ))}
      </g>
      <ellipse cx="112" cy="264" rx="42" ry="8" fill="#c9a9a0" />
    </Cut>
  )
}

/** 鸟居：柱子立着，中间的铃轻轻摆 */
export const Torii = () => (
  <Cut
    w={230}
    h={200}
    live={
      <g className="sway" style={{ transformOrigin: '115px 78px' }}>
        <path d="M115 78v18" stroke="#8a5c48" strokeWidth="2.5" />
        <circle cx="115" cy="104" r="8" fill="#f2d06a" />
        <path d="M115 112v10" stroke="#e8b84a" strokeWidth="2" />
      </g>
    }
  >
    <path d="M8 34q107-22 214 0" stroke="#c9453a" strokeWidth="13" fill="none" strokeLinecap="round" />
    <path d="M18 56h194" stroke="#c9453a" strokeWidth="9" strokeLinecap="round" />
    <path d="M52 56V196M178 56V196" stroke="#c9453a" strokeWidth="15" strokeLinecap="round" />
    <path d="M46 78h12M172 78h12M46 120h12M172 120h12" stroke="#a8382f" strokeWidth="4" />
    <rect x="96" y="58" width="38" height="30" rx="3" fill="#f2d06a" />
    <path d="M104 68h22M104 76h22" stroke="#c9453a" strokeWidth="3" />
    <ellipse cx="52" cy="196" rx="16" ry="5" fill="#9a8570" />
    <ellipse cx="178" cy="196" rx="16" ry="5" fill="#9a8570" />
  </Cut>
)

/** 水晶簇：里面的光一直在呼吸 */
export const CrystalCluster = () => {
  const spikes = [
    { x: 46, h: 96, w: 20, t: '#7fd8e8' },
    { x: 78, h: 140, w: 26, t: '#9fe6f2' },
    { x: 112, h: 108, w: 22, t: '#78cde0' },
    { x: 138, h: 74, w: 18, t: '#a9ecf6' },
  ]
  return (
    <Cut
      w={190}
      h={180}
      live={
        <g className="glowpulse">
          {spikes.map((s, i) => (
            <path key={i} d={`M${s.x} ${180 - s.h}l${s.w / 2} -14l${s.w / 2} 14l-${s.w / 2} ${s.h}Z`} fill="#e8fcff" opacity=".55" />
          ))}
        </g>
      }
    >
      <path d="M6 180q10-26 34-30t40 8 30-14 34-6 34 20 18 22Z" fill="#3c4460" />
      <path d="M14 180q14-16 34-18t28 6" stroke="#4c5574" strokeWidth="4" fill="none" />
      {spikes.map((s, i) => (
        <path
          key={i}
          d={`M${s.x} ${180 - s.h}l${s.w / 2} -14l${s.w / 2} 14l-${s.w / 2} ${s.h}Z`}
          fill={s.t}
          opacity=".92"
        />
      ))}
      <path d="M84 40l9 -8l9 8l-9 132Z" fill="#fff" opacity=".38" />
      <path d="M50 84l6 -6l6 6l-6 90Z" fill="#fff" opacity=".3" />
    </Cut>
  )
}

/** 灯塔：灯一直在转，光扫过海面 */
export const Lighthouse = () => (
  <Cut
    w={160}
    h={280}
    live={
      <g className="beam" style={{ transformOrigin: '80px 96px' }}>
        <path d="M80 96L-70 44L-70 128Z" fill="#fff6c8" opacity=".3" />
        <path d="M80 96L230 44L230 128Z" fill="#fff6c8" opacity=".3" />
      </g>
    }
  >
    <path d="M62 96L50 236h60L98 96Z" fill="#f6efe2" />
    <path d="M66 118h28l-3 34H69ZM71 164h20l-2 34H73Z" fill="#d9584a" />
    <path d="M56 236h48l4 20H52Z" fill="#7d8a9a" />
    <path d="M64 88h32v10H64Z" fill="#3f4a5c" />
    <circle cx="80" cy="96" r="13" fill="#ffe9a0" />
    <path d="M68 84h24l-4-10H72Z" fill="#d9584a" />
    <path d="M80 70v-8" stroke="#8a5c48" strokeWidth="3" strokeLinecap="round" />
    <path d="M46 256q14-10 34-10t34 10" stroke="#8fb8d6" strokeWidth="6" fill="none" strokeLinecap="round" />
    <ellipse cx="80" cy="262" rx="34" ry="9" fill="#a9b4c2" />
  </Cut>
)

/** 沙地：暖色沙丘 + 风纹 */
export const SandFloor = () => (
  <Cut w={460} h={104}>
    <rect x="0" y="12" width="460" height="92" fill="#e3c08a" />
    <path d="M0 12q60 18 120 8t120 6 120-10 100 4v92H0Z" fill="#eccd9b" />
    <path d="M0 44q70 14 140 2t140 6 180-8" stroke="#d6b079" strokeWidth="4" fill="none" />
    <path d="M0 68q80 12 160 0t160 8 140-6" stroke="#d6b079" strokeWidth="3" fill="none" opacity=".8" />
    <path d="M0 88q90 10 180-2t280 4" stroke="#cfa771" strokeWidth="3" fill="none" opacity=".7" />
    {Array.from({ length: 16 }, (_, i) => (
      <circle key={i} cx={(i * 31 + 12) % 456} cy={26 + (i * 17) % 70} r={1.4 + (i % 3) * .7} fill="#bf9a66" opacity=".7" />
    ))}
  </Cut>
)

/** 花瓣地：石板上落满花瓣 */
export const PetalFloor = () => (
  <Cut w={460} h={104}>
    <rect x="0" y="14" width="460" height="90" fill="#cdbfc0" />
    <path d="M0 14q80 10 160 0t160 6 140-4v88H0Z" fill="#dccfd0" />
    <path d="M0 46h460M0 76h460" stroke="#b9a9ab" strokeWidth="3" opacity=".55" />
    {Array.from({ length: 22 }, (_, i) => (
      <ellipse
        key={i}
        cx={(i * 43 + 9) % 452}
        cy={24 + (i * 27) % 66}
        rx={4 + (i % 3)}
        ry={2.4 + (i % 2) * .8}
        fill={i % 3 === 0 ? '#fff2f6' : i % 3 === 1 ? '#f7c3d6' : '#f2a9c4'}
        transform={`rotate(${(i * 37) % 180} ${(i * 43 + 9) % 452} ${24 + (i * 27) % 66})`}
      />
    ))}
    <path d="M40 100q6-14 14-4M300 96q8-12 16-2" stroke="#8a9a72" strokeWidth="3" fill="none" strokeLinecap="round" />
  </Cut>
)

/** 地砖：夜市街道的方砖 */
export const TileFloor = () => (
  <Cut w={460} h={104}>
    <rect x="0" y="12" width="460" height="92" fill="#5a5a72" />
    <g fill="#6a6a84">
      {Array.from({ length: 3 }, (_, row) =>
        Array.from({ length: 9 }, (_, col) => (
          <rect key={`${row}-${col}`} x={col * 52 + (row % 2 ? 26 : 0)} y={16 + row * 30} width="50" height="28" rx="2" />
        )),
      )}
    </g>
    <path d="M0 12h460" stroke="#8a8aa4" strokeWidth="4" />
    <path d="M60 20v76M180 20v76M300 20v76M420 20v76" stroke="#4a4a60" strokeWidth="2" opacity=".5" />
  </Cut>
)
