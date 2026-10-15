import type { Dialog, DialogOption } from '../game/dialog'
import { RANKS } from '../game/data/base'
import { bustUrl, resolveFaceId, VN_BG } from '../game/portraits'
import { actSilent, flush, setUI, setUISilent, useStore } from '../game/store'
import { Sheet } from './common'
import { AvatarFace } from './Portrait'

function rich(text: string) {
  return text.split(/(【[^】]*】)/g).map((p, i) =>
    p.startsWith('【') ? (
      <span key={i} className="delta">{p.slice(1, -1)}</span>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

export function DialogSheet() {
  const { g, ui } = useStore()
  const d = ui.dialogs[0]
  if (!d) return null

  const choose = (o?: DialogOption) => {
    // 一次 flush，避免 act + setUI 双刷新导致主页闪一下
    let next: Dialog | string | void
    if (o?.run) actSilent((g) => (next = o.run!(g)))
    setUISilent((u) => {
      u.dialogs.shift()
      if (typeof next === 'string' && next) {
        u.dialogs.unshift({
          speaker: d.speaker,
          sub: d.sub,
          portrait: d.portrait,
          narrate: d.narrate && !d.portrait,
          text: next,
          options: [{ label: '继续' }],
        })
      } else if (next && typeof next === 'object') {
        u.dialogs.unshift({ speaker: d.speaker, sub: d.sub, portrait: d.portrait, ...next })
      }
    })
    flush()
  }

  const opts = d.options?.length ? d.options : [{ label: '继续' }]
  const hasPortrait = !d.narrate && !!d.portrait
  const seed = d.portrait
    ? {
        seed: d.portrait.seed ?? d.portrait.char + (d.speaker ?? ''),
        gender: d.portrait.gender,
        temper: d.portrait.temper,
        color: d.portrait.color,
        color2: d.portrait.color2,
        faceId: d.portrait.faceId,
      }
    : null
  const night = (g?.phase ?? 0) >= 2
  // 有角色时：整屏背景就是人物半身照；旁白才用场景图
  const bg = hasPortrait && seed ? bustUrl(resolveFaceId(seed)) : night ? VN_BG.night : VN_BG.day

  return (
    <div className={`vn ${hasPortrait ? 'has-face' : 'narrate'}`}>
      <div className="vn-bg" style={{ backgroundImage: `url(${bg})` }} />
      <div className="vn-veil" />
      <div className="vn-dock">
        <div className="vn-panel" key={d.text.slice(0, 48)}>
          {d.title && <div className="vn-title">{d.title}</div>}
          {d.speaker && (
            <div className="vn-nameplate">
              {seed && <AvatarFace seed={seed} size={34} />}
              <div>
                <b>{d.speaker}</b>
                {d.sub && <small>{d.sub}</small>}
              </div>
            </div>
          )}
          <div className="vn-text">{rich(d.text)}</div>
        </div>
        <div className="vn-opts" key={'o-' + d.text.slice(0, 24)}>
          {opts.map((o, i) => (
            <button
              key={i}
              className={`vn-opt ${opts.length === 1 ? 'single' : ''}`}
              disabled={o.disabled}
              onClick={() => choose(o)}
            >
              <i>{String.fromCharCode(65 + i)}</i>
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ReviewSheet() {
  const { ui } = useStore()
  const rows = ui.review
  if (!rows || ui.dialogs.length) return null
  const close = () => setUI((u) => (u.review = null))
  return (
    <Sheet onClose={close} locked tall title="📊 本期评级结果" footer={<button className="btn-main block" onClick={close}>知道了</button>}>
      <div className="review">
        {rows.length === 0 && <p className="sheet-note">新人入职不满 3 天，本期不参与评级。</p>}
        {rows.map((r, i) => (
          <div key={r.id} className={`rv ${r.to > r.from ? 'up' : r.to < r.from ? 'down' : ''}`} style={{ animationDelay: `${i * 0.06}s` }}>
            <span className={`rv-no n${i}`}>{i + 1}</span>
            <AvatarFace seed={{ seed: r.id + r.name, gender: r.gender, faceId: r.faceId, color: r.color, color2: r.color2 }} size={40} />
            <div className="rv-main">
              <div className="rv-top">
                <b>{r.name}</b>
                <span className="rv-score">{r.score}</span>
              </div>
              <div className="rv-bar"><i style={{ width: `${r.score}%` }} /></div>
              <div className="rv-rank">
                {r.to === r.from ? RANKS[r.to] : <>{RANKS[r.from]} <em>{r.to > r.from ? '↑' : '↓'}</em> {RANKS[r.to]}</>}
              </div>
              {r.line && <p className="rv-line">{r.line}</p>}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

export function ConfirmSheet() {
  const { ui } = useStore()
  const c = ui.confirm
  if (!c) return null
  const close = () => setUI((u) => (u.confirm = null))
  return (
    <div className="scrim center" onClick={close}>
      <div className="confirm" onClick={(e) => e.stopPropagation()}>
        <b>{c.title}</b>
        {c.text && <p>{c.text}</p>}
        <div className="confirm-btns">
          <button onClick={close}>取消</button>
          <button
            className={c.danger ? 'danger' : 'ok'}
            onClick={() => {
              close()
              c.onOk()
            }}
          >
            {c.ok}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Toast() {
  const { ui } = useStore()
  if (!ui.toast) return null
  return <div className="toast" key={ui.toast.id}>{ui.toast.text}</div>
}
