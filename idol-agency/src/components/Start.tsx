import { useState } from 'react'
import { COMPANY, F_NAMES, M_NAMES, SURNAMES } from '../game/data/base'
import { LOOKS, ORIGIN_OPTIONS, STYLES, newGame, openingDialog } from '../game/engine'
import { ask, pushDialogs, setGame, setUI } from '../game/store'
import { pick } from '../game/util'
import { Stepper } from './common'

const randomName = () => pick(SURNAMES) + pick([...F_NAMES, ...M_NAMES])

export function Start({ hasSave }: { hasSave: boolean }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(randomName)
  const [age, setAge] = useState(26)
  const [look, setLook] = useState(LOOKS[0])
  const [style, setStyle] = useState(STYLES[4])
  const [origin, setOrigin] = useState(ORIGIN_OPTIONS[1].name)

  const start = () => {
    const g = newGame({ name: name.trim() || '老板', age, look, style, origin })
    setGame(g)
    setUI((u) => {
      u.screen = 'game'
      u.tab = 'home'
      u.sheet = null
      u.dialogs = []
      u.review = null
    })
    pushDialogs(openingDialog(g))
  }

  const newRun = () => {
    if (!hasSave) return setStep(1)
    ask({ title: '重新开始？', text: '当前存档会被覆盖，无法恢复。', ok: '重新开始', danger: true, onOk: () => setStep(1) })
  }

  if (step === 0) {
    return (
      <div className="title-screen">
        <div className="title-glow" />
        <div className="title-stars">
          {Array.from({ length: 18 }).map((_, i) => (
            <i key={i} style={{ left: `${(i * 53) % 100}%`, top: `${(i * 37) % 70}%`, animationDelay: `${(i % 6) * 0.4}s` }} />
          ))}
        </div>
        <div className="title-main">
          <p className="title-kicker">IDOL AGENCY SIMULATOR</p>
          <h1>
            从新人
            <br />
            到顶流
          </h1>
          <p className="title-sub">经营偶像公司</p>
        </div>
        <div className="title-actions">
          {hasSave && (
            <button className="btn-main" onClick={() => setUI((u) => (u.screen = 'game'))}>
              继续游戏
            </button>
          )}
          <button className={hasSave ? 'btn-ghost' : 'btn-main'} onClick={newRun}>
            {hasSave ? '重新开始' : '开始游戏'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="create">
      <div className="create-top">
        <button className="nav-back" onClick={() => setStep(0)}>‹</button>
        <h2>创建老板档案</h2>
        <span className="create-top-side" />
      </div>
      <div className="create-body">
        <section className="card">
          <label className="lbl">你的名字</label>
          <div className="name-row">
            <input className="name-input" value={name} maxLength={6} onChange={(e) => setName(e.target.value)} />
            <button className="dice" onClick={() => setName(randomName())}>🎲</button>
          </div>
          <div className="row-between">
            <label className="lbl">年龄</label>
            <Stepper value={age} min={22} max={32} onChange={setAge} suffix="岁" />
          </div>
        </section>

        <section className="card">
          <label className="lbl">气质</label>
          <div className="pills">
            {LOOKS.map((x) => (
              <button key={x} className={`pill ${look === x ? 'on' : ''}`} onClick={() => setLook(x)}>{x}</button>
            ))}
          </div>
          <label className="lbl">管理风格</label>
          <div className="pills">
            {STYLES.map((x) => (
              <button key={x} className={`pill ${style === x ? 'on' : ''}`} onClick={() => setStyle(x)}>{x}</button>
            ))}
          </div>
        </section>

        <section className="card">
          <label className="lbl">开局背景</label>
          <div className="origins">
            {ORIGIN_OPTIONS.map((o) => (
              <button key={o.id} className={`origin ${origin === o.name ? 'on' : ''}`} onClick={() => setOrigin(o.name)}>
                <div className="origin-top">
                  <b>{o.name}</b>
                  <span className="origin-perk">{o.perk}</span>
                </div>
                <p>{o.desc}</p>
                <div className="origin-stats">
                  <span>💰 {o.money / 10}万</span>
                  <span>⭐ 口碑 {o.fame}</span>
                  <span>👥 {o.artists}人</span>
                  {o.debt > 0 && <span className="neg">负债 {o.debt / 10}万</span>}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="create-foot">
        <button className="btn-main block" onClick={start}>入职{COMPANY}</button>
      </div>
    </div>
  )
}
