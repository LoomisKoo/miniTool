import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RANKS } from '../game/data/base'
import { BUBBLE } from '../game/behaviors'
import type { Artist } from '../game/types'
import { ArtistAvatar, AvatarFace } from './Portrait'

export const Avatar = ArtistAvatar

export function Face({ char, color, color2, size = 52, seed, gender }: { char: string; color: string; color2?: string; size?: number; seed?: string; gender?: 'm' | 'f' }) {
  return <AvatarFace seed={{ seed: seed ?? char, color, color2, gender }} size={size} />
}

export function Chip({ a, onClick, extra, size = 44 }: { a: Artist; onClick?: () => void; extra?: ReactNode; size?: number }) {
  return (
    <button className="person" onClick={onClick}>
      <ArtistAvatar a={a} size={size} />
      <span className="person-name">{a.name}</span>
      {extra}
    </button>
  )
}

export function BubbleTag({ a }: { a: Artist }) {
  if (!a.bubble) return null
  const b = BUBBLE[a.bubble.kind]
  return (
    <span className="btag" style={{ background: b.color }}>
      {b.label}
    </span>
  )
}

export function RankTag({ rank }: { rank: number }) {
  return <span className={`rank r${rank}`}>{RANKS[rank]}</span>
}

export function Bar({ label, value, color, right }: { label: string; value: number; color: string; right?: ReactNode }) {
  return (
    <div className="bar">
      <span className="bar-l">{label}</span>
      <div className="bar-t">
        <div className="bar-f" style={{ width: `${Math.max(0, Math.min(1, value / 100)) * 100}%`, background: color }} />
      </div>
      <span className="bar-v">{Math.round(value)}</span>
      {right !== undefined && <span className="bar-r">{right}</span>}
    </div>
  )
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  const idx = Math.max(0, options.findIndex((o) => o.v === value))
  return (
    <div className="seg" style={{ ['--n' as string]: options.length }}>
      <span className="seg-thumb" style={{ transform: `translateX(${idx * 100}%)` }} />
      {options.map((o) => (
        <button key={String(o.v)} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Check({ on }: { on: boolean }) {
  return <span className={`check ${on ? 'on' : ''}`}>{on ? '✓' : ''}</span>
}

export function Sheet({
  onClose,
  children,
  title,
  tall,
  locked,
  footer,
}: {
  onClose?: () => void
  children: ReactNode
  title?: ReactNode
  tall?: boolean
  locked?: boolean
  footer?: ReactNode
}) {
  const [closing, setClosing] = useState(false)
  const [dy, setDy] = useState(0)
  const start = useRef<number | null>(null)
  const closingRef = useRef(false)

  const requestClose = () => {
    if (locked || closingRef.current) return
    closingRef.current = true
    setClosing(true)
  }

  useEffect(() => {
    if (!closing) return
    const t = window.setTimeout(() => onClose?.(), 280)
    return () => clearTimeout(t)
  }, [closing, onClose])

  const down = (e: React.PointerEvent) => {
    if (locked || closing) return
    start.current = e.clientY
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    if (start.current === null) return
    setDy(Math.max(0, e.clientY - start.current))
  }
  const up = () => {
    if (start.current === null) return
    start.current = null
    if (dy > 90) {
      setDy(0)
      requestClose()
      return
    }
    setDy(0)
  }

  return (
    <div className={`scrim ${closing ? 'out' : ''}`} onClick={() => !locked && requestClose()}>
      <div
        className={`sheet ${tall ? 'tall' : ''} ${closing ? 'out' : ''}`}
        style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: dy ? 'none' : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && <button className="sheet-close" aria-label="关闭" onClick={requestClose}>×</button>}
        <div className="sheet-grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span />
          {title && <div className="sheet-title">{title}</div>}
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Stepper({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="stepper">
      <button disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <b>{value}{suffix}</b>
      <button disabled={value >= max} onClick={() => onChange(value + 1)}>＋</button>
    </div>
  )
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="empty">
      <span>{icon}</span>
      <p>{text}</p>
    </div>
  )
}
