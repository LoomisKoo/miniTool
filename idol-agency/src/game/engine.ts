import type { Dialog } from './dialog'
import type { Artist, GameState, Gig, Owner, RoomId, SkillKey } from './types'
import { COMPANY, FACILITIES, RANKS, RANK_WAGE, RIVAL, ROOMS, SKILL_NAMES, TEMPERS, fmtMoney } from './data/base'
import { AMBIENT, pickLine } from './data/lines'
import { pickEvent } from './data/events'
import { CONTACTS, contactDialog } from './data/contacts'
import { bubbleDialog, checkRivals, dailyLife, resolveBubbles, spawnBubbles } from './behaviors'
import { generateArtist, signCost, speak } from './gen'
import { addLog, avgSkill, capacity, chance, change, clamp, has, isGood, pick, rand, randInt, recent, remember, ta } from './util'

export const ORIGIN_OPTIONS = [
  { id: 'heir', name: '星二代接班', desc: '爸妈是老牌经纪人，公司是家里给的。', money: 300, fame: 30, artists: 4, debt: 0, perk: '起步资源多' },
  { id: 'ruin', name: '濒临破产', desc: '接手一家欠着债的小公司，只剩几个不肯走的孩子。', money: 120, fame: 12, artists: 3, debt: 200, perk: '老员工忠心' },
  { id: 'quit', name: '大厂出走', desc: '在头部公司干了五年，带着人脉出来单干。', money: 220, fame: 18, artists: 3, debt: 0, perk: '人脉自带好感' },
  { id: 'indie', name: '素人创业', desc: '从助理做起，攒了点钱，赌一把。', money: 180, fame: 15, artists: 4, debt: 0, perk: '签约八折' },
]
export const LOOKS = ['干练飒爽', '温柔知性', '明艳张扬', '清冷疏离', '亲和元气']
export const STYLES = ['雷厉风行', '护犊子', '精打细算', '温柔有度', '严慈并济', '佛系躺平']

export function newGame(owner: Owner): GameState {
  const o = ORIGIN_OPTIONS.find((x) => x.name === owner.origin) ?? ORIGIN_OPTIONS[0]
  const g: GameState = {
    version: 2,
    owner,
    day: 1,
    phase: 0,
    money: o.money,
    debt: o.debt,
    fame: o.fame,
    morale: 50,
    risk: 10,
    strategy: 2,
    artists: [],
    contacts: CONTACTS.map((c) => ({ id: c.id, favor: o.id === 'quit' ? 8 : 0, met: false, beat: 0, lastSeen: -1, presentTonight: false })),
    gigs: [],
    candidates: [],
    candidatesDay: 0,
    facilities: { vocal: 0, dance: 0, acting: 0, variety: 0, dorm: 0, pr: 0 },
    log: [],
    stats: { harsh: 0, kind: 0, firm: 0, scheme: 0 },
    flags: {},
    topStar: null,
    nightDone: false,
    idSeq: 0,
  }
  const rooms: RoomId[] = ['vocal', 'dance', 'acting', 'variety']
  for (let i = 0; i < o.artists; i++) {
    // 开局男女交替，避免全是女生
    const x = generateArtist(g, {
      quality: o.id === 'indie' ? 0.92 : 1,
      gender: i % 2 === 0 ? 'f' : 'm',
    })
    if (o.id === 'ruin') x.favor += 15
    if (i === 0) {
      x.rank = 1
      x.fans = 0.8
      for (const k of Object.keys(x.skills) as SkillKey[]) x.skills[k] = clamp(x.skills[k] + 18)
    }
    x.room = rooms[i % 4]
    g.artists.push(x)
  }
  refreshCandidates(g)
  addLog(g, `${COMPANY}正式挂牌。楼下的招牌还是歪的。`, 'info')
  return g
}

export function openingDialog(g: GameState): Dialog {
  return {
    title: 'Day 1',
    text: `城市边缘一栋老写字楼的六层，挂着一块不太起眼的牌子——「${COMPANY}」。\n\n公司现在有 ${g.artists.length} 个艺人，账上 ${fmtMoney(g.money)}${g.debt ? `，外加 ${fmtMoney(g.debt)} 负债` : ''}。对面那栋玻璃大楼，是行业巨头${RIVAL}的总部。\n\n${g.owner.name}，从今天起，你是这里的老板了。`,
    options: [{ label: '推开公司的门' }],
  }
}

export function refreshCandidates(g: GameState) {
  const freeId = g.flags.freeId ? 'a' + g.flags.freeId : ''
  g.candidates = g.candidates.filter((c) => c.id === freeId)
  // 候选人保证有男有女
  const genders: ('f' | 'm')[] = ['f', 'm', chance(0.5) ? 'f' : 'm']
  for (let i = 0; i < 3; i++) {
    g.candidates.push(generateArtist(g, { quality: 0.9 + g.fame / 200, gender: genders[i] }))
  }
  g.candidatesDay = g.day
}

export function costOf(g: GameState, c: Artist) {
  if (g.flags.freeId && c.id === 'a' + g.flags.freeId) return 0
  const base = signCost(c)
  return g.owner.origin === '素人创业' ? Math.round(base * 0.8) : base
}

export function sign(g: GameState, id: string): string | null {
  const c = g.candidates.find((x) => x.id === id)
  if (!c) return null
  if (g.artists.length >= capacity(g)) return '宿舍住满了，先升级宿舍吧'
  const cost = costOf(g, c)
  if (g.money < cost) return '资金不够'
  g.money -= cost
  g.candidates = g.candidates.filter((x) => x.id !== id)
  c.joinedDay = g.day
  g.artists.push(c)
  addLog(g, `${c.name}签约了${COMPANY}。`, 'good')
  return null
}

export function terminate(g: GameState, id: string) {
  const x = g.artists.find((y) => y.id === id)
  if (!x) return
  g.artists = g.artists.filter((y) => y.id !== id)
  if (g.topStar === id) g.topStar = null
  g.artists.forEach((y) => {
    if (y.rival === id) y.rival = null
    change(y, { mood: -4, stress: 3 })
  })
  addLog(g, `${x.name}和公司解约了。其他人这几天都格外小心。`, 'bad')
}

export function upgrade(g: GameState, key: string): string | null {
  const lv = g.facilities[key] ?? 0
  const cost = FACILITIES[key].cost[lv]
  if (cost === undefined) return '已经满级了'
  if (g.money < cost) return '资金不够'
  g.money -= cost
  g.facilities[key] = lv + 1
  if (key === 'pr') g.fame = clamp(g.fame + 5)
  addLog(g, `${FACILITIES[key].name}升级完成。`, 'good')
  return null
}

export function setRoom(g: GameState, id: string, room: RoomId) {
  const x = g.artists.find((y) => y.id === id)
  if (!x || x.status === 'suspended') return
  x.room = room
}

/* ---------- 训练 ---------- */

function train(g: GameState) {
  for (const x of g.artists) {
    if (x.status === 'suspended') {
      change(x, { stamina: 8, mood: -6 })
      continue
    }
    if (x.status === 'sick' || x.room === 'rest') {
      change(x, { stamina: 22, mood: 6 })
      continue
    }
    if (x.room === 'live') {
      const earn = 0.4 + x.skills.variety / 80 + x.fans * 0.08
      g.flags.liveEarn = (g.flags.liveEarn ?? 0) + earn
      x.fans += 0.02 + x.skills.variety / 2500
      x.skills.variety = clamp(x.skills.variety + 0.8)
      change(x, { stamina: -7, mood: has(x, 'shy') ? -6 : 1 })
      continue
    }
    if (x.bubble?.kind === 'lazy') continue
    const room = ROOMS[x.room]
    const lv = g.facilities[x.room] ?? 0
    let mult = (1 + lv * 0.3) * (0.5 + x.mood / 100) * (x.stamina < 25 ? 0.5 : 1)
    if (has(x, 'grind')) mult *= 1.2
    if (has(x, 'slacker')) mult *= 0.8
    if (x.bubble?.kind === 'practice') mult *= 1.4
    if (x.room === 'vocal' && (g.flags.leak ?? 0) > g.day) mult *= 0.5
    room.skills.forEach((k, i) => {
      const gain = 3.2 * x.talent[k] * mult * (1 - x.skills[k] / 125)
      x.skills[k] = clamp(x.skills[k] + gain * (i === 0 ? 1 : 0.5))
    })
    change(x, { stamina: has(x, 'nightowl') ? -14 : -10, mood: -2 })
  }
}

/* ---------- 通告 ---------- */

const GIG_KINDS: { kind: string; minRank: number; budget: [number, number]; likes: SkillKey[]; fans: number; w: number; titles: string[] }[] = [
  { kind: '练习生通告', minRank: 0, budget: [1, 3], likes: ['variety', 'dance', 'vocal'], fans: 0.03, w: 6, titles: ['校园路演暖场', '短视频平台试镜', '商场地推打卡', '公司内部试镜'] },
  { kind: '直播连麦', minRank: 0, budget: [2, 5], likes: ['variety'], fans: 0.08, w: 5, titles: ['大主播连麦PK', '平台新人夜', '深夜聊天直播'] },
  { kind: '商场商演', minRank: 1, budget: [3, 8], likes: ['dance', 'vocal'], fans: 0.06, w: 4, titles: ['购物中心周年庆', '新店开业暖场', '城市夜市演出'] },
  { kind: '品牌活动', minRank: 2, budget: [10, 20], likes: ['image'], fans: 0.15, w: 3, titles: ['国货美妆快闪', '潮牌新品发布', '奶茶联名活动'] },
  { kind: '综艺嘉宾', minRank: 2, budget: [8, 18], likes: ['variety'], fans: 0.3, w: 2.5, titles: ['《周末去哪儿》', '《密室大逃脱》', '《一起来做饭》'] },
  { kind: '网剧客串', minRank: 3, budget: [25, 45], likes: ['acting'], fans: 0.5, w: 1.5, titles: ['甜宠剧男二', '悬疑剧关键配角', '古装剧特别出演'] },
  { kind: '音乐节', minRank: 3, budget: [30, 50], likes: ['vocal'], fans: 0.6, w: 1.2, titles: ['草莓音乐节', '海边星空音乐节', '城市草地音乐会'] },
  { kind: '晚会表演', minRank: 4, budget: [60, 110], likes: ['vocal', 'dance'], fans: 1.2, w: 0.8, titles: ['卫视跨年晚会', '年度盛典开场', '颁奖礼表演嘉宾'] },
  { kind: '大牌代言', minRank: 4, budget: [90, 160], likes: ['image'], fans: 1.5, w: 0.6, titles: ['国际美妆代言', '奢侈品品牌大使', '运动品牌全球代言'] },
]
const QUIRKS = ['甲方很挑剔', '预算充足', '全程直播', '档期很赶', '现场有黑粉', '合作方很友好', '要求高颜值']

function pickGigKind(pool: typeof GIG_KINDS, fame: number) {
  const weight = (k: (typeof GIG_KINDS)[0]) => k.w * (k.minRank >= 3 ? (fame / 100) * 2 + 0.2 : 1)
  const total = pool.reduce((s, k) => s + weight(k), 0)
  let r = Math.random() * total
  for (const k of pool) {
    r -= weight(k)
    if (r <= 0) return k
  }
  return pool[0]
}

function genGigs(g: GameState) {
  g.gigs = []
  if (g.flags.closedTonight) return
  const available = g.artists.filter((x) => x.status === 'ok' && x.stamina >= 10)
  const top = Math.max(0, ...g.artists.map((x) => x.rank), 0)
  const canRank = Math.max(0, ...available.map((x) => x.rank), 0)
  let n = 2 + Math.floor(g.fame / 18) + (g.facilities.pr ?? 0) + (g.flags.boost ? 3 : 0)
  n += g.strategy === 1 ? 2 : g.strategy === 3 ? -1 : 0
  if (g.topStar) n += 2
  n = Math.max(1, Math.min(8, n))
  // 只生成有人能接的通告，再掺少量“冲一冲”的高阶通告
  const fit = GIG_KINDS.filter((k) => k.minRank <= canRank)
  const stretch = GIG_KINDS.filter((k) => k.minRank > canRank && k.minRank <= top + 1)
  const pool = fit.length ? fit : GIG_KINDS.filter((k) => k.minRank === 0)
  for (let i = 0; i < n; i++) {
    const useStretch = stretch.length > 0 && i > 0 && chance(0.22)
    const kd = pickGigKind(useStretch ? stretch : pool, g.fame)
    g.gigs.push({
      id: `q${g.day}_${i}`,
      title: pick(kd.titles),
      kind: kd.kind,
      budget: randInt(kd.budget[0], kd.budget[1]),
      minRank: kd.minRank,
      likes: pick(kd.likes),
      quirk: pick(QUIRKS),
      fansBase: kd.fans,
      artistId: null,
    })
  }
}

export function canTake(x: Artist, q: Gig) {
  return x.status === 'ok' && x.rank >= q.minRank && x.stamina >= 10
}

export function whyCantTake(x: Artist, q: Gig): string {
  if (x.status === 'sick') return '养病中，不能接'
  if (x.status === 'suspended') return '停工中，不能接'
  if (x.rank < q.minRank) return `需${RANKS[q.minRank]}以上`
  if (x.stamina < 10) return `体力不足（还需 ${Math.ceil(10 - x.stamina)}）`
  return ''
}

export function matchOf(x: Artist, q: Gig, isTop = false) {
  const score = x.skills[q.likes] * 0.4 + avgSkill(x) * 0.3 + x.looks * 0.2 + x.mood * 0.1 + (isTop ? 15 : 0)
  const need = 22 + q.minRank * 10 + (q.quirk === '甲方很挑剔' ? 8 : 0) + (q.quirk === '要求高颜值' && x.looks < 70 ? 10 : 0)
  return clamp(score / need, 0.4, 1.7)
}

export function assignGig(g: GameState, gigId: string, artistId: string | null): string | null {
  const q = g.gigs.find((y) => y.id === gigId)
  if (!q) return null
  if (artistId) {
    const x = g.artists.find((y) => y.id === artistId)
    if (!x) return null
    const why = whyCantTake(x, q)
    if (why) return `${x.name}：${why}`
    g.gigs.forEach((y) => y.artistId === artistId && (y.artistId = null))
  }
  q.artistId = artistId
  return null
}

const PAY_MULT = { 1: 0.8, 2: 1, 3: 1.3 }

function settleGigs(g: GameState): string[] {
  const lines: string[] = []
  let income = 0
  let missed = 0
  for (const q of g.gigs) {
    const x = g.artists.find((y) => y.id === q.artistId)
    if (!x) {
      missed++
      continue
    }
    const sat = matchOf(x, q, g.topStar === x.id)
    const pay = Math.round(q.budget * PAY_MULT[g.strategy] * sat * (q.quirk === '预算充足' ? 1.3 : 1) * 10) / 10
    income += pay
    const fans = q.fansBase * sat * (q.quirk === '全程直播' ? 1.5 : 1)
    x.fans += fans
    x.skills.variety = clamp(x.skills.variety + 0.6)
    change(x, { stamina: q.quirk === '档期很赶' ? -25 : -18 })
    if (sat >= 1.15) {
      g.fame = clamp(g.fame + 0.4 * (1 + (g.facilities.pr ?? 0) * 0.3))
      change(x, { mood: has(x, 'money') ? 10 : 4 })
      lines.push(`✨ ${x.name} · ${q.title}：表现亮眼，甲方追加合作意向。+${fmtMoney(pay)}`)
    } else if (sat < 0.75) {
      g.fame = clamp(g.fame - 0.5)
      change(x, { mood: -8, stress: q.quirk === '现场有黑粉' ? 8 : 3 })
      lines.push(`💧 ${x.name} · ${q.title}：状态不佳，被甲方吐槽了。+${fmtMoney(pay)}`)
    } else {
      lines.push(`· ${x.name} · ${q.title}：中规中矩完成。+${fmtMoney(pay)}`)
    }
  }
  if (missed) {
    lines.push(`${missed} 个通告没人接，被推掉了。`)
    if (missed > 2) g.fame = clamp(g.fame - 0.5 * (missed - 2))
  }
  g.money += income
  if (g.gigs.length) addLog(g, `今晚通告收入 ${fmtMoney(income)}。`, income > 0 ? 'good' : 'info')
  g.gigs = []
  return lines
}

/* ---------- 推进 ---------- */

export interface AdvanceResult {
  dialogs: Dialog[]
  review?: ReviewRow[]
}

const PHASE_BLURBS: Record<number, string[]> = {
  1: [
    '下午的阳光斜斜打进练习室。有人还在练，有人已经瘫在沙发上刷手机。',
    '你路过茶水间，听见两个练习生在小声讨论今晚的通告。',
    '走廊尽头传来钢琴声——不知道是谁在偷偷加练。',
  ],
  2: [
    '华灯初上，公司门口已经有站姐蹲守。今晚，该派谁出场了。',
    '通告单一封接一封弹进来。你深吸一口气，开始排兵布阵。',
    '化妆间的灯亮了。今晚的战场，不在练习室，在镜头前。',
  ],
  3: [
    '夜深了。整栋楼只剩练习室和你办公室还亮着灯。',
    '城市的霓虹在窗外闪烁。你还有一点私人时间。',
    '电梯里空荡荡的。这一天，终于要收尾了。',
  ],
  0: [
    '新的一天。前台的咖啡机开始嗡嗡作响，练习生陆陆续续到了。',
    '晨会刚散。白板上写着今天的训练安排——你得挨个确认。',
    '阳光很好。有人已经在舞蹈室压腿，有人还在宿舍睡懒觉。',
  ],
}

export function advance(g: GameState): AdvanceResult {
  const out: AdvanceResult = { dialogs: [] }
  const from = g.phase
  if (from <= 1) {
    train(g)
    resolveBubbles(g)
  }
  if (from === 2) {
    const lines = settleGigs(g)
    if (lines.length) out.dialogs.push({ title: '今晚收工', narrate: true, text: lines.join('\n'), options: [{ label: '收到' }] })
    g.flags.closedTonight = 0
    g.flags.boost = 0
    for (const c of g.contacts) {
      const d = CONTACTS.find((x) => x.id === c.id)!
      c.presentTonight = chance(d.appear(g)) || (!c.met && g.day <= 2 && c.id === 'xu')
    }
    g.nightDone = false
  }
  if (from === 3) {
    const r = endDay(g)
    out.dialogs.push(...r.dialogs)
    out.review = r.review
    g.phase = 0
    spawnBubbles(g)
  } else {
    g.phase = (from + 1) as 0 | 1 | 2 | 3
    if (g.phase === 1) spawnBubbles(g)
    if (g.phase === 2) genGigs(g)
  }
  // 时段旁白
  if (chance(0.55) || from === 1 || from === 2) {
    const blurb = pick(PHASE_BLURBS[g.phase] ?? PHASE_BLURBS[0])
    const someone = pick(g.artists.filter((x) => x.status === 'ok'))
    if (someone && chance(0.45) && g.phase <= 1) {
      out.dialogs.push(
        speak(someone, `${blurb}\n\n${someone.name}看见你，${someone.temper === 'cool' ? '轻轻点了下头。' : someone.temper === 'sunny' ? '开心地挥了挥手：“老板早！”' : someone.temper === 'drama' ? '立刻凑过来：“老板你听我说——”' : '朝你笑了笑。'}`, [
          {
            label: '停下来聊两句',
            run: (g) => {
              change(someone, { favor: 3, mood: 4 })
              return pick([
                `${someone.name}跟你扯了几句训练的事，气氛轻松了些。【${someone.name} 好感 +3】`,
                `“最近……还好。”${ta(someone)}顿了顿，“有你在就安心点。”【${someone.name} 好感 +3】`,
                `${someone.name}说了件练习室的趣事，你被逗笑了。【${someone.name} 好感 +3】`,
              ])
            },
          },
          {
            label: '点点头，继续忙',
            run: () => `${someone.name}没再打扰你，转身回了${ROOMS[someone.room].name}。`,
          },
          ...(someone.mood < 40
            ? [
                {
                  label: '“看着不太开心，怎么了？”',
                  run: (g: GameState) => {
                    change(someone, { favor: 6, mood: 8 })
                    return `${ta(someone)}愣了一下，眼眶有点红：“……没什么，就是有点累。谢谢你问。”【${someone.name} 好感 +6】`
                  },
                },
              ]
            : []),
        ]),
      )
    } else {
      out.dialogs.push({ narrate: true, text: blurb, options: [{ label: '继续' }] })
    }
  }
  if (chance(0.48)) {
    const ev = pickEvent(g)
    if (ev) out.dialogs.push(ev)
  }
  return out
}

function endDay(g: GameState): AdvanceResult {
  const out: AdvanceResult = { dialogs: [] }
  const live = Math.round((g.flags.liveEarn ?? 0) * 10) / 10
  if (live) {
    g.money += live
    g.flags.liveEarn = 0
    addLog(g, `今天直播打赏收入 ${fmtMoney(live)}。`)
  }
  for (const x of g.artists) {
    change(x, { stamina: 12, discontent: -0.8, stress: -1 })
    x.mood += (55 - x.mood) * 0.08
    if (x.status !== 'ok' && g.day >= x.statusUntil) {
      if (x.status === 'suspended') addLog(g, `${x.name}恢复工作了。`)
      x.status = 'ok'
    }
    if (x.rival && !g.artists.some((y) => y.id === x.rival)) x.rival = null
  }
  const n = Math.max(1, g.artists.length)
  const avgF = g.artists.reduce((s, x) => s + x.favor, 0) / n
  const avgD = g.artists.reduce((s, x) => s + x.discontent, 0) / n
  g.morale = clamp(g.morale + (50 + (avgF - avgD) / 3 - g.morale) * 0.05)
  g.risk = clamp(g.risk - 1 + (avgD > 50 ? 1.5 : 0) + (g.morale < 30 ? 1 : 0))
  if (g.fame > 35) g.fame = clamp(g.fame - 0.25)
  if (g.topStar) g.fame = clamp(g.fame + 0.5)
  dailyLife(g)
  if (chance(0.4)) addLog(g, pick(AMBIENT))

  if (g.day % 10 === 0) {
    const wage = g.artists.reduce((s, x) => s + RANK_WAGE[x.rank], 0)
    const upkeep = 20 + Object.values(g.facilities).reduce((s, v) => s + v * 5, 0)
    const interest = Math.round(g.debt * 0.1)
    g.money -= wage + upkeep + interest
    out.dialogs.push({
      title: `第 ${g.day / 10} 期 · 结算`,
      text: `艺人薪资 ${fmtMoney(wage)}\n房租水电 ${fmtMoney(upkeep)}${interest ? `\n借款利息 ${fmtMoney(interest)}` : ''}\n\n账上余额 ${fmtMoney(g.money)}`,
      options: [
        { label: '知道了' },
        ...(g.debt > 0
          ? [
              {
                label: `还清借款（-${fmtMoney(g.debt)}）`,
                disabled: g.money < g.debt,
                run: (g: GameState) => {
                  g.money -= g.debt
                  g.debt = 0
                  addLog(g, '公司的借款全部还清了。', 'good')
                  return '财务长出了一口气：“老板，我们终于不欠谁的了。”'
                },
              },
            ]
          : []),
      ],
    })
    out.review = review(g)
  }
  g.day += 1
  if (g.day - g.candidatesDay >= 3) refreshCandidates(g)
  return out
}

/* ---------- 评级 ---------- */

export interface ReviewRow {
  id: string
  name: string
  gender: 'm' | 'f'
  faceId?: string
  temper: string
  color: string
  color2: string
  score: number
  from: number
  to: number
  line: string
}

const THRESH = [0, 20, 36, 52, 68, 82]

function review(g: GameState): ReviewRow[] {
  const rows: ReviewRow[] = []
  for (const x of g.artists) {
    if (g.day - x.joinedDay < 3) continue
    const fansPts = Math.min(15, Math.log10(1 + x.fans * 10) * 6)
    const raw = avgSkill(x) * 0.6 + x.skills.image * 0.08 + fansPts + x.mood * 0.06 + x.looks * 0.1 + rand(-4, 4)
    const score = Math.round(clamp(raw * 1.15))
    const from = x.rank
    let to = from
    if (from < 4 && score >= THRESH[from + 1]) to = from + 1
    else if (from === 4 && score >= THRESH[5] && x.topStreak >= 2 && g.fame >= 55 && !g.topStar) to = 5
    else if (from > 0 && from < 5 && score < THRESH[from] - 8) to = from - 1
    x.topStreak = score >= THRESH[5] ? x.topStreak + 1 : 0
    x.lastScore = score
    const good = isGood(x)
    let line = ''
    if (to > from) {
      x.rank = to
      change(x, { mood: 20, favor: 5 })
      line = pickLine('up', x.temper, good)
      if (to === 5) {
        g.topStar = x.id
        g.fame = clamp(g.fame + 15)
        addLog(g, `${x.name}成为了公司唯一的顶流，热搜挂了三天。`, 'good')
        g.artists.forEach((y) => y !== x && change(y, { mood: -3 }))
      } else addLog(g, `${x.name}晋升为${RANKS[to]}。`, 'good')
      checkRivals(g, x)
    } else if (to < from) {
      x.rank = to
      change(x, { mood: -20, discontent: x.temper === 'cool' || x.temper === 'ambitious' ? 10 : 4 })
      line = pickLine('down', x.temper, good)
      addLog(g, `${x.name}降为${RANKS[to]}。`, 'bad')
    }
    const t = TEMPERS[x.temper]
    rows.push({
      id: x.id,
      name: x.name,
      gender: x.gender,
      faceId: x.faceId,
      temper: t.name,
      color: t.color,
      color2: t.color2,
      score,
      from,
      to,
      line,
    })
  }
  return rows.sort((a, b) => b.score - a.score)
}

/* ---------- 奖惩 / 谈心 ---------- */

function hadReason(g: GameState, x: Artist) {
  return recent(x, 'slacked', g.day, 2) || (x.lastScore > 0 && x.lastScore < (THRESH[x.rank] ?? 0) + 3)
}

function mark(g: GameState, x: Artist, kind: 'kind' | 'firm' | 'harsh') {
  x.interactedDay = g.day
  g.stats[kind] += 0.5
}

function envy(g: GameState, x: Artist) {
  for (const y of g.artists) {
    if (y === x) continue
    if (y.rival === x.id || has(y, 'competitive') || y.temper === 'ambitious') {
      change(y, { mood: -4, discontent: 2 })
      if (!y.rival && chance(0.25)) {
        y.rival = x.id
        addLog(g, `${y.name}看到你对${x.name}格外好，脸色不太好看。`)
      }
    }
  }
}

export function rewardDialog(g: GameState, x: Artist): Dialog {
  return speak(x, `给${x.name}点什么？`, [
    {
      label: '发个红包（-1千）',
      disabled: g.money < 1,
      run: (g) => {
        const good = isGood(x)
        g.money -= 1
        change(x, { favor: has(x, 'money') ? 10 : 5, mood: has(x, 'money') ? 12 : 5, discontent: -3 })
        mark(g, x, 'kind')
        return pickLine('bonus', x.temper, good)
      },
    },
    {
      label: '送一份礼物（-3千）',
      disabled: g.money < 3,
      run: (g) => {
        const good = isGood(x)
        g.money -= 3
        change(x, { favor: has(x, 'vain') ? 15 : 9, mood: has(x, 'vain') ? 18 : 10, discontent: -5 })
        envy(g, x)
        mark(g, x, 'kind')
        return pickLine('gift', x.temper, good)
      },
    },
    {
      label: '放一天假',
      run: (g) => {
        const good = isGood(x)
        x.room = 'rest'
        change(x, { stamina: 25, mood: 10, favor: good ? 4 : 0 })
        mark(g, x, 'kind')
        return pickLine('dayoff', x.temper, good)
      },
    },
    {
      label: '在群里公开表扬',
      run: (g) => {
        const good = isGood(x)
        change(x, { favor: good ? 5 : 2, mood: 8 })
        envy(g, x)
        mark(g, x, 'kind')
        return pickLine('praise', x.temper, good)
      },
    },
    { label: '算了' },
  ])
}

export function disciplineDialog(g: GameState, x: Artist): Dialog {
  const reason = hadReason(g, x)
  const unjust = (g: GameState) => {
    if (reason) return
    change(x, { discontent: 8 })
    g.stats.harsh += 1
    g.artists.forEach((y) => y !== x && change(y, { stress: 2, favor: -1 }))
  }
  return speak(x, `怎么处理${x.name}？${reason ? '' : `\n\n（${ta(x)}最近没犯什么错。无缘无故挨罚，其他人也会看在眼里。）`}`, [
    {
      label: '批评几句',
      run: (g) => {
        const good = isGood(x)
        change(x, { stress: 8, discontent: x.temper === 'cool' ? 9 : 5, favor: -3, mood: x.temper === 'fragile' ? -15 : -8 })
        if (reason) g.morale = clamp(g.morale + 2)
        unjust(g)
        mark(g, x, 'firm')
        return pickLine('scold', x.temper, good)
      },
    },
    {
      label: '罚加练',
      run: (g) => {
        const good = isGood(x)
        change(x, { stress: 10, discontent: 8, stamina: -12 })
        const k = (Object.keys(x.skills) as SkillKey[]).sort((a, b) => x.skills[a] - x.skills[b])[0]
        x.skills[k] = clamp(x.skills[k] + 1.5)
        if (reason) g.morale = clamp(g.morale + 3)
        unjust(g)
        mark(g, x, 'firm')
        return `${pickLine('punish', x.temper, good)}【${SKILL_NAMES[k]} +1.5】`
      },
    },
    {
      label: `扣绩效（+${fmtMoney(RANK_WAGE[x.rank] / 2)}）`,
      run: (g) => {
        const good = isGood(x)
        g.money += RANK_WAGE[x.rank] / 2
        change(x, { discontent: has(x, 'money') ? 18 : 10, stress: 6, mood: -10 })
        if (reason) g.morale = clamp(g.morale + 2)
        unjust(g)
        mark(g, x, 'firm')
        return pickLine('punish', x.temper, good)
      },
    },
    {
      label: '停工三天',
      run: (g) => {
        const good = isGood(x)
        x.status = 'suspended'
        x.statusUntil = g.day + 3
        x.room = 'rest'
        change(x, { stress: 18, discontent: 15, mood: -20 })
        g.stats.harsh += 1
        g.risk = clamp(g.risk + 3)
        if (reason) g.morale = clamp(g.morale + 4)
        unjust(g)
        remember(x, 'suspended', g.day)
        mark(g, x, 'harsh')
        return `${pickLine('punish', x.temper, good)}【舆情风险 +3】`
      },
    },
    { label: '算了' },
  ])
}

export function talkDialog(g: GameState, x: Artist): Dialog {
  const good = isGood(x)
  return speak(x, pickLine('talk', x.temper, good), [
    {
      label: '问问最近怎么样',
      run: (g) => {
        mark(g, x, 'kind')
        change(x, { favor: good ? 5 : 3, mood: 8 })
        const rival = g.artists.find((y) => y.id === x.rival)
        const w =
          x.stamina < 35
            ? '“就是……有点累。”'
            : rival
              ? `“没什么……就是${rival.name}老跟我过不去。”`
              : x.discontent > 40
                ? '“想听实话？公司有些规定真的太压人了。”'
                : x.mood > 60
                  ? '“挺好的！比刚来的时候好多了。”'
                  : '“还行吧。偶尔会想家。”'
        return `${w}【${x.name} 心情 +8】`
      },
    },
    {
      label: '聊聊想往哪个方向发展',
      run: (g) => {
        mark(g, x, 'kind')
        const best = (Object.keys(x.talent) as SkillKey[]).sort((a, b) => x.talent[b] - x.talent[a])[0]
        const room = (Object.keys(ROOMS) as RoomId[]).find((r) => ROOMS[r].skills[0] === best) ?? 'variety'
        change(x, { favor: 4 })
        return `“其实我最想在${SKILL_NAMES[best]}上多下功夫。”${ta(x)}眼睛亮了一下。\n\n（${ta(x)}在「${ROOMS[room].name}」进步最快）`
      },
    },
    {
      label: x.secret && !x.secretKnown ? '聊聊以前的事' : '聊聊入行前的生活',
      run: (g) => {
        mark(g, x, 'kind')
        if (x.secret && !x.secretKnown && x.favor >= 45) {
          x.secretKnown = true
          change(x, { favor: 10 })
          return `${ta(x)}沉默了很久，终于开口——原来${ta(x)}${x.secret}。\n\n“你是第一个知道的人。”【${x.name} 好感 +10】`
        }
        change(x, { favor: 2 })
        return `“我以前啊……${x.origin.split('，')[0]}。”${ta(x)}说了几句，就不太想继续了。${x.secret && !x.secretKnown ? `\n\n（${ta(x)}好像藏着什么心事，等关系再近一点吧）` : ''}`
      },
    },
    {
      label: '鼓励一下',
      run: (g) => {
        mark(g, x, 'kind')
        change(x, { favor: 5, mood: 10, stress: -5 })
        return `${pickLine('praise', x.temper, good)}\n\n${ta(x)}听完，练功的劲头又足了些。【${x.name} 心情 +10】`
      },
    },
    {
      label: '八卦一下公司里的事',
      run: (g) => {
        mark(g, x, 'kind')
        const other = pick(g.artists.filter((y) => y !== x))
        change(x, { favor: 3 })
        if (has(x, 'gossip') || x.temper === 'drama') {
          return other
            ? `${x.name}压低声音：“你知道吗，${other.name}昨天偷偷练到两点……还有啊……”\n\n听完你对楼里的事又清楚了一点。【${x.name} 好感 +3】`
            : `${x.name}倒是知道不少八卦，说得眉飞色舞。【${x.name} 好感 +3】`
        }
        return `“我不太会八卦啦……”${ta(x)}笑了笑，还是跟你聊了几句近况。【${x.name} 好感 +3】`
      },
    },
    {
      label: '强调一下公司规定',
      run: (g) => {
        mark(g, x, 'firm')
        change(x, { stress: 4, favor: x.temper === 'sunny' || x.temper === 'chill' ? 2 : -2 })
        g.morale = clamp(g.morale + 1)
        return `${x.temper === 'cool' ? `${ta(x)}听着，一言不发。` : x.temper === 'drama' ? `${ta(x)}听得直撇嘴，倒也没顶嘴。` : `${ta(x)}认真地点头，还掏出手机记了备忘录。`}【氛围 +1】`
      },
    },
    {
      label: '随口考一题业务知识',
      run: (g) => {
        mark(g, x, 'firm')
        const ok = chance(0.55 + x.skills.variety / 200)
        if (ok) {
          change(x, { favor: 4, mood: 6 })
          x.skills.variety = clamp(x.skills.variety + 0.8)
          return `${ta(x)}想了想，答得还挺像样。你点点头：“不错，记得住就好。”【综艺感 +0.8 · 好感 +4】`
        }
        change(x, { stress: 3, mood: -2 })
        return `${ta(x)}卡住了，耳朵有点红：“……这个我回去再补。”你没为难${ta(x)}。【压力 +3】`
      },
    },
  ])
}

export function bubble(g: GameState, x: Artist) {
  return bubbleDialog(g, x)
}

export function visitContact(g: GameState, id: string): Dialog | null {
  const c = g.contacts.find((x) => x.id === id)
  if (!c || g.nightDone) return null
  g.nightDone = true
  c.presentTonight = false
  return contactDialog(g, c)
}

export function statusWord(x: Artist) {
  if (x.status === 'suspended') return '停工中'
  if (x.status === 'sick') return '养病中'
  if (x.discontent >= 65) return '满腹怨气'
  if (x.stress >= 65) return '压力山大'
  if (x.mood < 25) return 'emo中'
  if (x.stamina < 25) return '累瘫了'
  if (x.favor >= 70) return '超信任你'
  if (x.mood > 75) return '状态超好'
  return '状态平稳'
}
