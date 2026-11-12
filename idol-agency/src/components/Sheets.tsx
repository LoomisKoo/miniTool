import { useState } from 'react'
import { FACILITIES, RANKS, ROOMS, SKILL_NAMES, TEMPERS, TRAITS, fmtFans, fmtMoney } from '../game/data/base'
import { CONTACTS, stageOf } from '../game/data/contacts'
import { canTake, costOf, disciplineDialog, matchOf, rewardDialog, setRoom, sign, statusWord, talkDialog, terminate, upgrade, assignGig, whyCantTake } from '../game/engine'
import { act, actSilent, ask, closeSheet, flush, setUISilent, toast, type Sheet as SheetT } from '../game/store'
import type { Artist, GameState, RoomId, SkillKey } from '../game/types'
import { capacity, hashStr, ta } from '../game/util'
import { Avatar, Bar, Check, Face, RankTag, Sheet } from './common'
import { PortraitBust } from './Portrait'

const stars = (t: number) => (t >= 1.35 ? 'S' : t >= 1.1 ? 'A' : t >= 0.85 ? 'B' : 'C')

function greetLine(a: Artist) {
  const lines = [
    a.mood > 70 ? `“老板！今天状态超好～”` : a.mood < 35 ? `“……嗯，我在。”` : `“找我有事吗，老板？”`,
    a.stamina < 30 ? `“好累……能不能歇一会儿。”` : a.favor > 60 ? `“你来啦，我正好想找你。”` : `现在看起来${statusWord(a)}。`,
    a.temper === 'cool' ? `“……说。”` : a.temper === 'drama' ? `“老板！你可算来了！”` : `“我在${ROOMS[a.room].name}呢。”`,
  ]
  return lines[hashStr(a.id + String(Math.round(a.mood))) % lines.length]
}

export function Sheets({ g, sheet }: { g: GameState; sheet: SheetT }) {
  if (!sheet) return null
  switch (sheet.type) {
    case 'artist': {
      const a = g.artists.find((x) => x.id === sheet.id)
      return a ? <ArtistSheet key={a.id} g={g} a={a} /> : null
    }
    case 'scout':
      return <ScoutSheet g={g} />
    case 'facility':
      return <FacilitySheet g={g} />
    case 'pickRoom':
      return <PickRoomSheet key={sheet.room} g={g} room={sheet.room} />
    case 'pickGig':
      return <PickGigSheet key={sheet.gigId} g={g} gigId={sheet.gigId} />
    case 'contact':
      return <ContactSheet g={g} id={sheet.id} />
  }
}

function ArtistSheet({ g, a }: { g: GameState; a: Artist }) {
  const t = TEMPERS[a.temper]
  const rival = g.artists.find((x) => x.id === a.rival)
  const done = a.interactedDay === g.day
  const open = (fn: typeof talkDialog) => {
    // 关 sheet + 开对话一次刷新，避免主页闪现
    let dlg: ReturnType<typeof talkDialog> | null = null
    actSilent((g) => {
      const x = g.artists.find((y) => y.id === a.id)
      if (x) dlg = fn(g, x)
    })
    setUISilent((u) => {
      u.sheet = null
      if (dlg) u.dialogs.push(dlg)
    })
    flush()
  }
  return (
    <Sheet
      onClose={closeSheet}
      tall
      footer={
        done ? (
          <p className="done-tip">今天已经和{ta(a)}聊过了，明天再来吧</p>
        ) : (
          <div className="ap-actions">
            <button className="act-btn" onClick={() => open(rewardDialog)}><span>🎁</span>奖励</button>
            <button className="act-btn" onClick={() => open(disciplineDialog)}><span>📋</span>管教</button>
            <button className="act-btn main" onClick={() => open(talkDialog)}><span>💬</span>谈心</button>
          </div>
        )
      }
    >
      <div className="ap-hero">
        <PortraitBust seed={{ seed: a.id + a.name, gender: a.gender, temper: a.temper, faceId: a.faceId }} />
        <div className="ap-hero-fade" />
        <div className="ap-hero-meta">
          <div className="ap-name">
            <b>{a.name}</b>
            <RankTag rank={a.rank} />
          </div>
          <small>{a.gender === 'f' ? '女' : '男'} · {a.age}岁 · <span style={{ color: t.color2 }}>{t.name}</span></small>
          <div className="ap-stats">
            <span><b>{fmtFans(a.fans)}</b>粉丝</span>
            <span><b>{a.looks}</b>颜值</span>
            <span><b>{a.lastScore || '-'}</b>上期评分</span>
          </div>
        </div>
      </div>
      <div className="ap-body">
        <p className="ap-greet">{greetLine(a)}</p>
        <p className="ap-origin">“{a.origin}”</p>
        <div className="traits">
          <span className="trait temper" style={{ background: t.color2 }}>{t.name}·{t.desc}</span>
          {a.traits.map((k) => (
            <span key={k} className="trait">
              {TRAITS[k].name}
              <small>{TRAITS[k].desc}</small>
            </span>
          ))}
        </div>
        {a.secretKnown && a.secret && <div className="ap-note gold">🔒 秘密：{ta(a)}{a.secret}</div>}
        {rival && <div className="ap-note red">⚡ 和{rival.name}有矛盾</div>}

        <div className="card-in mood">
          <h4>心情状态 <span className="status-word">{statusWord(a)}</span></h4>
          <Bar label="好感" value={a.favor} color="#ff5f8f" />
          <Bar label="压力" value={a.stress} color="#7a7f99" />
          <Bar label="不满" value={a.discontent} color="#b05a7a" />
          <Bar label="心情" value={a.mood} color="#ffb347" />
          <Bar label="体力" value={a.stamina} color="#3fb8af" />
        </div>

        <div className="card-in skill">
          <h4>能力 <small>字母为天赋</small></h4>
          {(Object.keys(SKILL_NAMES) as SkillKey[]).map((k) => (
            <Bar key={k} label={SKILL_NAMES[k]} value={a.skills[k]} color="#8a5cff" right={<i className={`grade g${stars(a.talent[k])}`}>{stars(a.talent[k])}</i>} />
          ))}
        </div>

        {g.phase <= 1 && (
          <div className="card-in schedule">
            <h4>今天安排在</h4>
            <div className="room-grid">
              {(Object.keys(ROOMS) as RoomId[]).map((r) => (
                <button
                  key={r}
                  className={`room-opt ${a.room === r ? 'on' : ''} ${a.status === 'suspended' ? 'is-off' : ''}`}
                  onClick={() =>
                    a.status === 'suspended' ? toast(`${a.name}停工中，暂时不能安排`) : act((g) => setRoom(g, a.id, r))
                  }
                >
                  <span>{ROOMS[r].emoji}</span>
                  {ROOMS[r].name}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className="btn-terminate"
          onClick={() =>
            ask({
              title: `和${a.name}解约？`,
              text: '其他艺人会看在眼里，心里多少会不安。',
              ok: '确认解约',
              danger: true,
              onOk: () => {
                act((g) => terminate(g, a.id))
                closeSheet()
              },
            })
          }
        >
          解除合约
        </button>
      </div>
    </Sheet>
  )
}

const grade = (t: number) => (t >= 1.35 ? '顶级' : t >= 1.1 ? '优秀' : t >= 0.85 ? '普通' : '欠缺')

function ScoutSheet({ g }: { g: GameState }) {
  const next = Math.max(1, 3 - (g.day - g.candidatesDay))
  return (
    <Sheet onClose={closeSheet} title="星探推荐" tall>
      <p className="sheet-note">宿舍 {g.artists.length}/{capacity(g)} · 每 3 天刷新一批，下一批 {next} 天后</p>
      <div className="cands">
        {g.candidates.length === 0 && <p className="sheet-note">暂时没有合适的人选</p>}
        {g.candidates.map((c) => {
          const t = TEMPERS[c.temper]
          const cost = costOf(g, c)
          const best = (Object.keys(c.talent) as SkillKey[]).sort((a, b) => c.talent[b] - c.talent[a])
          return (
            <div key={c.id} className="cand">
              <div className="cand-head">
                <Avatar a={c} size={52} />
                <div>
                  <b>{c.name}</b>
                  <small>{c.gender === 'f' ? '女' : '男'} · {c.age}岁 · <span style={{ color: t.color2 }}>{t.name}</span> · 颜值 {c.looks}</small>
                </div>
              </div>
              <p className="cand-origin">{c.origin}</p>
              <div className="traits">
                {c.traits.map((k) => (
                  <span key={k} className="trait">{TRAITS[k].name}</span>
                ))}
              </div>
              <div className="cand-talent">
                <span>{SKILL_NAMES[best[0]]}<b>{grade(c.talent[best[0]])}</b></span>
                <span>{SKILL_NAMES[best[1]]}<b>{grade(c.talent[best[1]])}</b></span>
                <span>{SKILL_NAMES[best[4]]}<b>{grade(c.talent[best[4]])}</b></span>
              </div>
              <button
                className="btn-main block"
                onClick={() => {
                  let err: string | null = null
                  act((g) => (err = sign(g, c.id)))
                  toast(err ?? `${c.name} 签约成功 🎉`)
                }}
              >
                {cost === 0 ? '免费签约' : `签约 · ${fmtMoney(cost)}`}
              </button>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

function FacilitySheet({ g }: { g: GameState }) {
  return (
    <Sheet onClose={closeSheet} title="公司设施">
      <p className="sheet-note">余额 {fmtMoney(g.money)}</p>
      <div className="facs">
        {Object.entries(FACILITIES).map(([k, f]) => {
          const lv = g.facilities[k] ?? 0
          const cost = f.cost[lv]
          return (
            <div key={k} className="fac">
              <div>
                <b>{f.name} <i>Lv{lv + 1}</i></b>
                <small>{f.desc}</small>
              </div>
              <button
                className={`btn-soft ${cost === undefined || g.money < cost ? 'is-off' : ''}`}
                onClick={() => {
                  let err: string | null = null
                  act((g) => (err = upgrade(g, k)))
                  toast(err ?? `${f.name}升级完成`)
                }}
              >
                {cost === undefined ? '已满级' : fmtMoney(cost)}
              </button>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

function PickRoomSheet({ g, room }: { g: GameState; room: RoomId }) {
  const r = ROOMS[room]
  const [picked, setPicked] = useState(() => new Set(g.artists.filter((x) => x.room === room).map((x) => x.id)))
  const best = r.skills[0]
  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const confirm = () => {
    act((g) => {
      for (const x of g.artists) {
        if (x.status === 'suspended') continue
        if (picked.has(x.id)) setRoom(g, x.id, room)
        else if (x.room === room) setRoom(g, x.id, 'rest')
      }
    })
    toast(`已更新${r.name}安排`)
    closeSheet()
  }
  return (
    <Sheet
      onClose={closeSheet}
      title={`${r.emoji} 安排到${r.name}`}
      footer={<button className="btn-main block" onClick={confirm}>确定</button>}
    >
      <p className="sheet-note">{r.desc}{r.skills.length ? ` · 提升${r.skills.map((k) => SKILL_NAMES[k]).join('、')}` : ''}</p>
      <div className="pick-list">
        {g.artists.map((x) => {
          const on = picked.has(x.id)
          const disabled = x.status === 'suspended'
          return (
            <button
              key={x.id}
              className={`pick ${on ? 'on' : ''} ${disabled ? 'is-off' : ''}`}
              onClick={() => (disabled ? toast(`${x.name}停工中，暂时不能安排`) : toggle(x.id))}
            >
              <Avatar a={x} size={44} />
              <div className="pick-main">
                <b>{x.name}</b>
                <small>
                  现在：{ROOMS[x.room].name} · 体力 {Math.round(x.stamina)}
                  {best ? ` · ${SKILL_NAMES[best]}天赋 ${stars(x.talent[best])}` : ''}
                </small>
              </div>
              {!disabled && <Check on={on} />}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

const matchWord = (m: number) => (m >= 1.3 ? ['绝配', 'm4'] : m >= 1.1 ? ['合适', 'm3'] : m >= 0.85 ? ['一般', 'm2'] : ['勉强', 'm1'])

function PickGigSheet({ g, gigId }: { g: GameState; gigId: string }) {
  const q = g.gigs.find((x) => x.id === gigId)
  const [picked, setPicked] = useState<string | null>(q?.artistId ?? null)
  if (!q) return null
  const list = [...g.artists].sort((a, b) => {
    const ao = canTake(a, q) ? 1 : 0
    const bo = canTake(b, q) ? 1 : 0
    if (ao !== bo) return bo - ao
    return matchOf(b, q) - matchOf(a, q)
  })
  const okCount = list.filter((x) => canTake(x, q)).length
  const confirm = () => {
    let err: string | null = null
    act((g) => (err = assignGig(g, gigId, picked)))
    if (err) toast(err)
    else {
      toast(picked ? '已安排通告' : '已取消安排')
      closeSheet()
    }
  }
  return (
    <Sheet
      onClose={closeSheet}
      title={q.title}
      footer={<button className="btn-main block" onClick={confirm}>确定</button>}
    >
      <p className="sheet-note">
        {q.kind} · 看重{SKILL_NAMES[q.likes]} · {q.quirk} · 预算 {fmtMoney(q.budget)}
        <br />
        需{RANKS[q.minRank]}以上 · 体力 ≥ 10
        {okCount === 0 ? ' · 当前无人可接' : ` · ${okCount}人可接`}
      </p>
      <div className="pick-list">
        {list.map((x) => {
          const ok = canTake(x, q)
          const on = picked === x.id
          const busy = g.gigs.find((y) => y.artistId === x.id && y.id !== gigId)
          const [w, cls] = matchWord(matchOf(x, q, g.topStar === x.id))
          const reason = whyCantTake(x, q)
          return (
            <button
              key={x.id}
              className={`pick ${on ? 'on' : ''} ${ok ? '' : 'blocked'}`}
              onClick={() => {
                if (!ok) {
                  toast(`${x.name}：${reason}`)
                  return
                }
                setPicked((cur) => (cur === x.id ? null : x.id))
              }}
            >
              <Avatar a={x} size={44} />
              <div className="pick-main">
                <b>{x.name} <RankTag rank={x.rank} /></b>
                <small>
                  {ok ? <span className={`match inline ${cls}`}>{w}</span> : null}
                  {SKILL_NAMES[q.likes]} {Math.round(x.skills[q.likes])} · 体力 {Math.round(x.stamina)}
                  {busy ? ` · 已排「${busy.title}」` : ''}
                </small>
              </div>
              {ok ? <Check on={on} /> : <span className="block-reason">{reason}</span>}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

function ContactSheet({ g, id }: { g: GameState; id: string }) {
  const c = g.contacts.find((x) => x.id === id)
  const d = CONTACTS.find((x) => x.id === id)
  if (!c || !d) return null
  return (
    <Sheet onClose={closeSheet}>
      <div className="contact-hero" style={{ background: `linear-gradient(160deg, ${d.color}33, transparent)` }}>
        <Face char={d.name.slice(1, 2)} color={d.color} color2={d.color2} seed={d.id + d.name} gender="m" size={80} />
        <b>{d.name}</b>
        <small>{d.title} · {stageOf(c.favor)}</small>
      </div>
      <div className="ap-body">
        <p className="ap-origin">{d.desc}</p>
        <div className="ap-note">💡 {d.likes}</div>
        <div className="card-in">
          <Bar label="好感" value={c.favor} color={d.color} />
        </div>
        <p className="sheet-note">深夜时间有机会遇见{d.name}。</p>
      </div>
    </Sheet>
  )
}
