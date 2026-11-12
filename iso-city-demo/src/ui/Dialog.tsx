import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { walker } from '../game/walker'
import { askPrompt } from './Ask'

function sinceText(iso: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}月${date.getDate()}日领养`
}

export function Dialog() {
  const dialog = useApp((state) => state.dialog)
  const next = useApp((state) => state.nextDialog)
  const close = useApp((state) => state.closeDialog)
  const rations = useApp((state) => state.rations)
  const renamePet = useApp((state) => state.renamePet)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const choose = async (index: number, onClick: () => void | Promise<void>) => {
    if (busy) return
    setBusy(String(index))
    setError(null)
    try {
      await onClick()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败，请稍后再试')
    } finally {
      setBusy(null)
    }
  }

  // 走开了就结束对话。
  // 原来这里是看 nearby 的 id：站在 NPC 旁边时，离得更近的楼门、地点标记
  // 会把 nearby 抢走，于是对话刚打开就立刻被关掉，看起来"按 E 没反应"。
  // 现在按说话人的实际距离判断。
  useEffect(() => {
    if (!dialog) return
    if (dialog.x === undefined || dialog.z === undefined) return
    const timer = setInterval(() => {
      const d = Math.hypot(walker.position.x - dialog.x!, walker.position.z - dialog.z!)
      if (d > 9) close()
    }, 400)
    return () => clearInterval(timer)
  }, [dialog, close])

  // 换一句 / 换一个对话时清掉上一次的按钮状态
  useEffect(() => {
    setBusy(null)
    setError(null)
  }, [dialog])

  // 城市里鼠标处于指针锁定状态，选项按钮点不到；这里补一套纯键盘操作：
  // E 执行首选（领养），1/2 直接选对应项。
  useEffect(() => {
    if (!dialog || busy) return
    const last = dialog.index + 1 >= dialog.lines.length
    const list = last ? dialog.choices : undefined
    const canRename = !!dialog.pet?.own
    if (!list?.length && !canRename) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const key = event.key.toLowerCase()
      // 指针被锁定在canvas上，按钮点不到，所以改名也只能走键盘：R 弹一个输入框
      if (key === 'r' && dialog.pet?.own) {
        event.preventDefault()
        const petId = dialog.pet.id
        const current = dialog.name
        void askPrompt('给它取个新名字', current, {
          title: '给宠物改名',
          confirmLabel: '改名',
          placeholder: '最多 24 个字',
        }).then((next) => {
          const name = next?.trim()
          if (name && name !== current) void choose(-1, async () => void (await renamePet(petId, name)))
        })
        return
      }
      if (!list?.length) return
      let index = -1
      if (key === 'e') {
        index = Math.max(0, list.findIndex((choice) => choice.primary))
      } else if (/^[1-9]$/.test(key)) {
        index = Number(key) - 1
      }
      if (index < 0 || index >= list.length) return
      event.preventDefault()
      void choose(index, list[index].onClick)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialog, busy, renamePet])

  if (!dialog) return null
  const last = dialog.index + 1 >= dialog.lines.length
  const choices = last ? dialog.choices ?? [] : []
  const owner = dialog.owner

  return (
    <div className="npc-dialog" onClick={next}>
      <div className="npc-dialog-head">
        <strong>{dialog.name}</strong>
        <span>{dialog.role}</span>
      </div>
      <p key={dialog.index}>{dialog.lines[dialog.index]}</p>

      {owner && (
        <div className="npc-dialog-owner" onClick={(event) => event.stopPropagation()}>
          <span className="avatar" style={{ background: owner.color }}>
            {owner.name.slice(0, 1)}
          </span>
          <span>
            主人 <b>@{owner.name}</b>
          </span>
          {sinceText(owner.since) && <em>{sinceText(owner.since)}</em>}
        </div>
      )}

      {dialog.pet && (
        <div className="npc-dialog-pet" onClick={(event) => event.stopPropagation()}>
          <span>口粮 <b>{rations}</b> 份</span>
          {dialog.pet.own && (
            <span className="npc-dialog-pet-hint">
              <kbd>R</kbd> 给它改名
            </span>
          )}
        </div>
      )}

      {choices.length > 0 && (
        <div className="npc-dialog-choices" onClick={(event) => event.stopPropagation()}>
          {choices.map((choice, index) => (
            <button
              key={choice.label}
              className={choice.primary ? 'primary' : ''}
              disabled={busy !== null}
              onClick={() => void choose(index, choice.onClick)}
            >
              {busy === String(index) ? '……' : choice.label}
              {choice.note && <em>{choice.note}</em>}
            </button>
          ))}
          {error && <span className="npc-dialog-error">{error}</span>}
        </div>
      )}

      <div className="npc-dialog-foot">
        <span className="npc-dialog-dots" aria-hidden="true">
          {dialog.lines.map((_, index) => (
            <i key={index} className={index === dialog.index ? 'on' : ''} />
          ))}
        </span>
        <span className="npc-dialog-hint">
          {choices.length > 0 ? (
            <>
              <kbd>E</kbd> 确认首选 · <kbd>1</kbd>/<kbd>2</kbd> 选择 · <kbd>Esc</kbd> 离开
            </>
          ) : dialog.pet ? (
            <>
              <kbd>E</kbd> 结束 · <kbd>Esc</kbd> 离开
            </>
          ) : (
            <>
              <kbd>E</kbd> {last ? '结束' : '继续'} · <kbd>Esc</kbd> 离开
            </>
          )}
        </span>
      </div>
    </div>
  )
}
