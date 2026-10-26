import { useEffect } from 'react'
import { useApp } from '../store'
import { walker } from '../game/walker'

export function Dialog() {
  const dialog = useApp((state) => state.dialog)
  const next = useApp((state) => state.nextDialog)
  const close = useApp((state) => state.closeDialog)

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

  if (!dialog) return null
  const last = dialog.index + 1 >= dialog.lines.length
  return (
    <div className="npc-dialog" onClick={next}>
      <div className="npc-dialog-head">
        <strong>{dialog.name}</strong>
        <span>{dialog.role}</span>
      </div>
      <p key={dialog.index}>{dialog.lines[dialog.index]}</p>
      <div className="npc-dialog-foot">
        <span className="npc-dialog-dots" aria-hidden="true">
          {dialog.lines.map((_, index) => (
            <i key={index} className={index === dialog.index ? 'on' : ''} />
          ))}
        </span>
        <span className="npc-dialog-hint">
          <kbd>E</kbd> {last ? '结束' : '继续'} · <kbd>Esc</kbd> 离开
        </span>
      </div>
    </div>
  )
}
