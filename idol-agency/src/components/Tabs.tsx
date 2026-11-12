import { COMPANY, FACILITIES, PHASE_NAMES, RANKS, ROOMS, SKILL_NAMES, TEMPERS, fmtFans, fmtMoney } from '../game/data/base'
import { CONTACTS, stageOf } from '../game/data/contacts'
import { bubble, statusWord, visitContact } from '../game/engine'
import { act, ask, openSheet, pushDialogs, setGame, setUI, toast } from '../game/store'
import type { Artist, GameState, RoomId } from '../game/types'
import { capacity } from '../game/util'
import { Avatar, BubbleTag, Chip, Empty, Face, RankTag, Seg } from './common'

const ROOM_ORDER: RoomId[] = ['vocal', 'dance', 'acting', 'variety', 'live', 'rest']

function openBubble(id: string) {
  act((g) => {
    const x = g.artists.find((y) => y.id === id)
    const d = x && bubble(g, x)
    if (d) pushDialogs(d)
  })
}

const openArtist = (id: string) => openSheet({ type: 'artist', id })

export function HomeTab({ g }: { g: GameState }) {
  if (g.phase === 2) return <GigsView g={g} />
  if (g.phase === 3) return <NightView g={g} />
  const alerts = g.artists.filter((x) => x.bubble)
  return (
    <div className="page">
      <div className="quick">
        <button className="quick-btn q-scout" onClick={() => openSheet({ type: 'scout' })}>
          <span>🔍</span>星探
        </button>
        <button className="quick-btn q-fac" onClick={() => openSheet({ type: 'facility' })}>
          <span>🏢</span>设施
        </button>
        <button className="quick-btn q-net" onClick={() => setUI((u) => (u.tab = 'me'))}>
          <span>💌</span>人脉
        </button>
        <button className="quick-btn q-feed" onClick={() => setUI((u) => (u.tab = 'feed'))}>
          <span>📰</span>动态
        </button>
      </div>

      {alerts.length > 0 && (
        <section>
          <h3 className="sec-title">
            公司里有点动静 <small>点一下处理，不管也会有后果</small>
          </h3>
          <div className="alerts">
            {alerts.map((x) => (
              <button key={x.id} className="alert" onClick={() => openBubble(x.id)}>
                <Avatar a={x} size={40} />
                <div>
                  <b>{x.name}</b>
                  <small>{ROOMS[x.room].name}</small>
                </div>
                <BubbleTag a={x} />
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="sec-title">
          {g.phase === 0 ? '今日安排' : '下午巡视'} <small>点“＋”把人安排进来，点头像看详情</small>
        </h3>
        <div className="rooms">
          {ROOM_ORDER.map((r) => {
            const room = ROOMS[r]
            const list = g.artists.filter((x) => x.room === r)
            const lv = g.facilities[r] ?? 0
            return (
              <div key={r} className={`room room-${r}`}>
                <div className="room-head">
                  <span className="room-emoji">{room.emoji}</span>
                  <div className="room-name">
                    <b>{room.name}{lv > 0 && <i>Lv{lv + 1}</i>}</b>
                    <small>{room.skills.length ? room.skills.map((k) => SKILL_NAMES[k]).join(' · ') : room.desc}</small>
                  </div>
                  {r === 'vocal' && (g.flags.leak ?? 0) > g.day && <span className="warn-tag">漏水</span>}
                </div>
                <div className="room-people">
                  {list.map((x) => (
                    <Chip
                      key={x.id}
                      a={x}
                      size={40}
                      onClick={() => (x.bubble ? openBubble(x.id) : openArtist(x.id))}
                      extra={<BubbleTag a={x} />}
                    />
                  ))}
                  <button className="add" onClick={() => openSheet({ type: 'pickRoom', room: r })}>＋</button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

const LIKE: Record<string, string> = { vocal: '唱功', dance: '舞蹈', acting: '演技', variety: '综艺感', image: '形象' }

function GigsView({ g }: { g: GameState }) {
  const takers = g.artists.filter((x) => x.status === 'ok' && x.stamina >= 10)
  if (!g.gigs.length) {
    return (
      <div className="page">
        <Empty icon={g.flags.closedTonight ? '🎉' : '🌙'} text={g.flags.closedTonight ? '今晚不接通告，大家都去玩了。' : '今晚一个通告都没有……口碑还得再涨涨。'} />
      </div>
    )
  }
  return (
    <div className="page">
      <h3 className="sec-title">
        今晚的通告{' '}
        <small>
          {takers.length
            ? '点通告安排艺人；等级不够或体力不足会标出原因'
            : '全员体力不足或无法工作，先安排休息'}
        </small>
      </h3>
      <div className="gigs">
        {g.gigs.map((q) => {
          const x = g.artists.find((y) => y.id === q.artistId)
          return (
            <div key={q.id} className={`gig ${x ? 'done' : ''}`}>
              <div className="gig-top">
                <span className="gig-kind">{q.kind}</span>
                <span className="gig-pay">{fmtMoney(q.budget)}</span>
              </div>
              <b className="gig-title">{q.title}</b>
              <div className="gig-tags">
                <span>看重{LIKE[q.likes]}</span>
                <span>{q.quirk}</span>
                <span>需{RANKS[q.minRank]}+</span>
              </div>
              {x ? (
                <button className="gig-who" onClick={() => openSheet({ type: 'pickGig', gigId: q.id })}>
                  <Avatar a={x} size={32} />
                  <span>{x.name}</span>
                  <small>换人</small>
                </button>
              ) : (
                <button className="gig-assign" onClick={() => openSheet({ type: 'pickGig', gigId: q.id })}>
                  安排艺人
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NightView({ g }: { g: GameState }) {
  const present = g.contacts.filter((c) => c.presentTonight)
  return (
    <div className="page">
      <h3 className="sec-title">
        私人时间 <small>今晚只能见一个人。也可以去「艺人」找人谈谈心</small>
      </h3>
      {present.length === 0 && <Empty icon="🌃" text="今晚没人约你。城市的灯一盏一盏地灭了。" />}
      <div className="night-cards">
        {present.map((c) => {
          const d = CONTACTS.find((x) => x.id === c.id)!
          return (
            <div key={c.id} className="night-card" style={{ ['--c' as string]: d.color }}>
              <Face char={c.met ? d.name.slice(1, 2) : '?'} color={d.color} color2={d.color2} seed={d.id + d.name} gender="m" size={56} />
              <div className="night-info">
                <b>{c.met ? d.name : '一个陌生人'}</b>
                <small>{d.title}{c.met ? ` · ${stageOf(c.favor)}` : ''}</small>
                <p>{c.met ? d.hint : d.desc}</p>
              </div>
              <button
                className={`btn-main sm ${g.nightDone ? 'is-off' : ''}`}
                onClick={() => {
                  if (g.nightDone) return toast('今晚已经见过人了，明晚再来')
                  act((g) => {
                    const dl = visitContact(g, c.id)
                    if (dl) pushDialogs(dl)
                  })
                }}
              >
                去见
              </button>
            </div>
          )
        })}
      </div>
      {g.nightDone && <p className="hint-center">今晚已经见过人了</p>}
    </div>
  )
}

export function ArtistsTab({ g }: { g: GameState }) {
  const list = [...g.artists].sort((a, b) => b.rank - a.rank || b.fans - a.fans)
  return (
    <div className="page">
      <div className="row-between">
        <h3 className="sec-title">艺人 <small>{g.artists.length}/{capacity(g)}</small></h3>
        <button className="btn-soft" onClick={() => openSheet({ type: 'scout' })}>＋ 星探签约</button>
      </div>
      <div className="list">
        {list.map((x) => (
          <ArtistRow key={x.id} a={x} g={g} />
        ))}
      </div>
    </div>
  )
}

function ArtistRow({ a, g }: { a: Artist; g: GameState }) {
  const t = TEMPERS[a.temper]
  return (
    <button className="arow" onClick={() => openArtist(a.id)}>
      <Avatar a={a} size={52} />
      <div className="arow-main">
        <div className="arow-top">
          <b>{a.name}</b>
          <RankTag rank={a.rank} />
          {g.topStar === a.id && <span className="rank r5">TOP</span>}
        </div>
        <div className="arow-sub">
          <span style={{ color: t.color2 }}>{t.name}</span>
          <span>粉丝 {fmtFans(a.fans)}</span>
          <span>{statusWord(a)}</span>
        </div>
      </div>
      <BubbleTag a={a} />
      {a.interactedDay === g.day && <span className="talked">已聊</span>}
      <span className="chev">›</span>
    </button>
  )
}

export function FeedTab({ g }: { g: GameState }) {
  return (
    <div className="page feed-page">
      <h3 className="sec-title feed-title">公司动态</h3>
      <div className="feed">
        {g.log.slice(0, 80).map((l, i) => (
          <div key={i} className={`feed-item ${l.tone ?? ''}`}>
            <span className="feed-dot" />
            <div>
              <small>Day {l.day} · {PHASE_NAMES[l.phase]}</small>
              <p>{l.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MeTab({ g }: { g: GameState }) {
  return (
    <div className="page">
      <div className="me-card">
        <div className="me-avatar">{g.owner.name.slice(0, 1)}</div>
        <div>
          <b>{g.owner.name}</b>
          <small>{COMPANY} 老板 · {g.owner.age}岁</small>
          <small>{g.owner.look} · {g.owner.style} · {g.owner.origin}</small>
        </div>
      </div>

      <section className="card">
        <h3 className="sec-title">接单策略</h3>
        <Seg
          value={g.strategy}
          options={[
            { v: 1, label: '来者不拒' },
            { v: 2, label: '正常接单' },
            { v: 3, label: '只接大单' },
          ]}
          onChange={(v) => act((g) => (g.strategy = v))}
        />
        <p className="note">{g.strategy === 1 ? '通告更多，单价打八折' : g.strategy === 3 ? '通告变少，单价上浮三成' : '通告数量与价格都正常'}</p>
      </section>

      <section className="card">
        <h3 className="sec-title">人脉</h3>
        <div className="contacts">
          {g.contacts.map((c) => {
            const d = CONTACTS.find((x) => x.id === c.id)!
            return (
              <button key={c.id} className="contact" onClick={() => (c.met ? openSheet({ type: 'contact', id: c.id }) : toast('还没结识，深夜时间也许会遇见'))}>
                <Face char={c.met ? d.name.slice(1, 2) : '?'} color={c.met ? d.color : '#c9c4d6'} color2={c.met ? d.color2 : '#a9a3b8'} seed={d.id + d.name} gender="m" size={44} />
                <div className="contact-main">
                  <b>{c.met ? d.name : '尚未结识'}</b>
                  <small>{d.title}</small>
                </div>
                {c.met ? (
                  <div className="heart">
                    <span>{stageOf(c.favor)}</span>
                    <div className="heart-bar"><i style={{ width: `${c.favor}%`, background: d.color }} /></div>
                  </div>
                ) : (
                  <small className="muted">也许某个深夜会遇见</small>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="card">
        <h3 className="sec-title">公司设施</h3>
        <div className="fac-mini">
          {Object.entries(FACILITIES).map(([k, f]) => (
            <span key={k}>{f.name} <b>Lv{(g.facilities[k] ?? 0) + 1}</b></span>
          ))}
        </div>
        <button className="btn-soft block" onClick={() => openSheet({ type: 'facility' })}>去升级</button>
      </section>

      <div className="me-actions">
        <button
          className="btn-danger-ghost block"
          onClick={() =>
            ask({
              title: '重新开始？',
              text: '当前存档会清空，无法恢复。',
              ok: '重新开始',
              danger: true,
              onOk: () => {
                setGame(null)
                setUI((u) => (u.screen = 'title'))
              },
            })
          }
        >
          重新开始
        </button>
      </div>
    </div>
  )
}
