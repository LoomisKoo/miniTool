import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * 自绘下拉。
 *
 * 原生 <select> 点开之后的列表完全由系统渲染：不同的系统、不同的字号、
 * 甚至白色的列表背景，和这套玻璃面板拼不到一起。这里用按钮 + 浮层替掉，
 * 触发器和输入框共用一套尺寸与描边。
 */

export type SelectOption = { value: string; label: string }

type Props = {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
}

const MENU_GAP = 8
const MENU_MAX = 264

export function Select({ value, options, onChange, placeholder, ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<{ left: number; top: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = options.find((option) => option.value === value)

  // 浮层用 fixed 贴在触发按钮上：面板本身是可滚动的，absolute 会被裁掉。
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom - MENU_GAP - 12
      const above = rect.top - MENU_GAP - 12
      const menuHeight = Math.min(options.length * 40 + 12, MENU_MAX)
      const upward = below < menuHeight && above > below
      setStyle({
        left: Math.round(rect.left),
        top: Math.round(upward ? rect.top - MENU_GAP - menuHeight : rect.bottom + MENU_GAP),
        width: Math.round(rect.width),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // 只关下拉，不要让 Esc 顺手把整个面板也关了。
      event.stopPropagation()
      setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`ui-select-trigger ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{current?.label ?? placeholder ?? '请选择'}</span>
        <svg viewBox="0 0 12 8" aria-hidden="true">
          <path
            d="M1.5 2.2 6 6.4l4.5-4.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open &&
        style &&
        createPortal(
          <div
            ref={menuRef}
            className="ui-select-menu"
            role="listbox"
            aria-label={ariaLabel}
            style={{ left: style.left, top: style.top, width: style.width }}
          >
            {options.map((option) => {
              const selected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? 'on' : ''}
                  onClick={() => {
                    setOpen(false)
                    if (!selected) onChange(option.value)
                  }}
                >
                  <span>{option.label}</span>
                  <svg className="ui-select-check" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="m3.4 8.4 3 3L12.6 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
