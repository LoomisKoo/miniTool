import { COMPANY, PHASE_NAMES, fmtMoney } from './game/data/base'
import { advance } from './game/engine'
import { act, pushDialogs, setUI, useStore, type Tab } from './game/store'
import type { GameState } from './game/types'
import { capacity } from './game/util'
import { Start } from './components/Start'
import { ArtistsTab, FeedTab, HomeTab, MeTab } from './components/Tabs'
import { Sheets } from './components/Sheets'
import { ConfirmSheet, DialogSheet, ReviewSheet, Toast } from './components/Overlays'

const NEXT = ['进入下午', '晚上跑通告', '收工回家', '睡觉，迎接新的一天']
const PHASE_ICON = ['☀️', '🌤️', '🌆', '🌙']
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: '公司', icon: '🏢' },
  { id: 'artists', label: '艺人', icon: '⭐' },
  { id: 'feed', label: '动态', icon: '📰' },
  { id: 'me', label: '我的', icon: '👤' },
]

const TAB_TITLE: Record<Tab, string> = { home: '', artists: '旗下艺人', feed: '公司动态', me: '我的' }

export default function App() {
  const { g, ui } = useStore()
  const hostClass = import.meta.env.VITE_HOST === 'xhs' || /xhs|xiaohongshu|discover/i.test(navigator.userAgent) ? 'host-xhs' : ''

  if (!g || ui.screen === 'title') {
    return (
      <div className={`phone ${hostClass}`}>
        <Start hasSave={!!g} />
        <ConfirmSheet />
      </div>
    )
  }

  const next = () => {
    if (ui.dialogs.length) return
    act((g) => {
      const r = advance(g)
      if (r.dialogs.length) pushDialogs(...r.dialogs)
      if (r.review) setUI((u) => (u.review = r.review!))
    })
    setUI((u) => (u.tab = 'home'))
  }

  const alerts = g.artists.filter((x) => x.bubble).length

  return (
    <div className={`phone ph-${g.phase} ${hostClass}`}>
      <Header g={g} tab={ui.tab} />
      {hostClass && ui.tab !== 'home' && <div className="xhs-title">{TAB_TITLE[ui.tab]}</div>}
      <main className="content">
        {ui.tab === 'home' && <HomeTab g={g} />}
        {ui.tab === 'artists' && <ArtistsTab g={g} />}
        {ui.tab === 'feed' && <FeedTab g={g} />}
        {ui.tab === 'me' && <MeTab g={g} />}
      </main>
      <button className="cta" onClick={next}>
        <span className="cta-icon">{PHASE_ICON[(g.phase + 1) % 4]}</span>
        <span>{NEXT[g.phase]}</span>
        <span className="cta-arrow">→</span>
      </button>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={ui.tab === t.id ? 'on' : ''} onClick={() => setUI((u) => (u.tab = t.id))}>
            <span className="tab-icon">
              {t.icon}
              {t.id === 'artists' && alerts > 0 && <i className="dot">{alerts}</i>}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
      <Sheets g={g} sheet={ui.sheet} />
      <DialogSheet />
      <ReviewSheet />
      <ConfirmSheet />
      <Toast />
    </div>
  )
}

function Header({ g, tab }: { g: GameState; tab: Tab }) {
  if (tab !== 'home') return null
  const left = 10 - ((g.day - 1) % 10)
  return (
    <header className={`hdr ${tab === 'home' ? '' : 'hdr-compact'}`}>
      <div className="hdr-top">
        <div className="hdr-center-meta" aria-label={`${COMPANY} Day ${g.day} ${PHASE_NAMES[g.phase]} 距评级${left === 1 ? '今晚' : `${left}天`}`}>
          <b className="day-meta">Day {g.day}</b>
          <span className="phase-pill">{PHASE_ICON[g.phase]} {PHASE_NAMES[g.phase]}</span>
          <span className="countdown">
            <small>距评级</small>
            <b>{left === 1 ? '今晚' : `${left}天`}</b>
          </span>
        </div>
      </div>
      {tab === 'home' && (
        <div className="hdr-stats">
          <Stat kind="money" label="资金" value={fmtMoney(g.money)} warn={g.money < 0} />
          {g.debt > 0 && <Stat kind="debt" label="负债" value={fmtMoney(g.debt)} warn />}
          <Stat kind="fame" label="口碑" value={Math.round(g.fame)} />
          <Stat kind="morale" label="氛围" value={Math.round(g.morale)} warn={g.morale < 30} />
          <Stat kind="risk" label="舆情" value={Math.round(g.risk)} warn={g.risk > 50} />
          <Stat kind="crew" label="艺人" value={`${g.artists.length}/${capacity(g)}`} />
        </div>
      )}
    </header>
  )
}

const STAT_META: Record<string, { icon: string; mark: string }> = {
  money: { icon: '¥', mark: '金' },
  debt: { icon: '−', mark: '债' },
  fame: { icon: '★', mark: '名' },
  morale: { icon: '♥', mark: '氛' },
  risk: { icon: '!', mark: '舆情' },
  crew: { icon: '人', mark: '员' },
}

function Stat({ kind, label, value, warn }: { kind: string; label: string; value: string | number; warn?: boolean }) {
  const m = STAT_META[kind]
  return (
    <div className={`hs hs-${kind} ${warn ? 'warn' : ''}`}>
      <span className="hs-ico">{m.icon}</span>
      <div>
        <b>{value}</b>
        <small>{label}</small>
      </div>
    </div>
  )
}
