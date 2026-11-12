import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * 应用内的确认框 / 输入框。
 *
 * 原来这里用的是 window.confirm / window.prompt：那是浏览器原生弹窗，
 * 样式完全跟着系统走，和整套玻璃界面不是一回事。这里换成同一套材质的
 * 自绘卡片，调用方式仍然是「等一个 Promise」：
 *
 *   if (await askConfirm('删除这条留言？')) ...
 *   const name = await askPrompt('给它取个新名字', 旧名字)
 */

type AskKind = 'confirm' | 'prompt'

type AskOptions = {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  /** 破坏性操作：确认按钮走红色。 */
  danger?: boolean
  placeholder?: string
}

type AskRequest = Required<Omit<AskOptions, 'placeholder'>> & {
  id: number
  kind: AskKind
  message: string
  placeholder?: string
  value: string
  resolve: (value: string | boolean | null) => void
}

const queue: AskRequest[] = []
const listeners = new Set<() => void>()
let current: AskRequest | null = null
let seq = 0

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 同一时间只显示一个，其余的排在后面。 */
function pump() {
  if (current || queue.length === 0) return
  current = queue.shift() ?? null
  emit()
}

function settle(value: string | boolean | null) {
  const ask = current
  if (!ask) return
  current = null
  ask.resolve(value)
  pump()
  emit()
}

function ask(
  kind: AskKind,
  message: string,
  value: string,
  options: AskOptions | undefined,
  resolve: AskRequest['resolve'],
) {
  queue.push({
    id: ++seq,
    kind,
    title: options?.title ?? (kind === 'confirm' ? '请确认' : '输入'),
    message,
    value,
    placeholder: options?.placeholder,
    confirmLabel: options?.confirmLabel ?? (kind === 'confirm' ? '确认' : '保存'),
    cancelLabel: options?.cancelLabel ?? '取消',
    danger: options?.danger ?? false,
    resolve,
  })
  pump()
}

export function askConfirm(message: string, options?: AskOptions) {
  return new Promise<boolean>((resolve) => {
    ask('confirm', message, '', options, (value) => resolve(value === true))
  })
}

export function askPrompt(message: string, defaultValue = '', options?: AskOptions) {
  return new Promise<string | null>((resolve) => {
    ask('prompt', message, defaultValue, options, (value) =>
      resolve(typeof value === 'string' ? value : null),
    )
  })
}

export function Asker() {
  const request = useSyncExternalStore(subscribe, () => current)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!request) return
    setValue(request.value)
    // 等这一帧画完再聚焦：输入框刚挂载时焦点会被面板的自动聚焦抢走。
    const id = requestAnimationFrame(() => {
      if (request.kind === 'prompt') {
        inputRef.current?.focus()
        inputRef.current?.select()
      } else {
        okRef.current?.focus()
      }
    })
    return () => cancelAnimationFrame(id)
  }, [request])

  if (!request) return null

  const confirm = () => settle(request.kind === 'prompt' ? value : true)
  const cancel = () => settle(request.kind === 'prompt' ? null : false)

  const onKeyDown = (event: ReactKeyboardEvent) => {
    // 别让按键漏到游戏输入里：这里按 Esc 只该关掉这个卡片。
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    } else if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      confirm()
    }
  }

  return (
    <div className="ask-backdrop" onClick={cancel}>
      <div
        className="ask-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-title"
        aria-describedby="ask-message"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <h3 id="ask-title">{request.title}</h3>
        <p id="ask-message">{request.message}</p>
        {request.kind === 'prompt' && (
          <input
            ref={inputRef}
            className="ask-input"
            value={value}
            placeholder={request.placeholder}
            maxLength={24}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
        <div className="ask-actions">
          <button className="ask-btn" onClick={cancel}>
            {request.cancelLabel}
          </button>
          <button
            ref={okRef}
            className={`ask-btn primary ${request.danger ? 'danger' : ''}`}
            onClick={confirm}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

