import type { Dialog } from './dialog'
import type { Artist, BubbleKind, GameState } from './types'
import { RANKS, RIVAL, ROOMS } from './data/base'
import { pickLine } from './data/lines'
import { speak } from './gen'
import { addLog, byId, change, chance, clamp, has, isGood, pick, remember, ta } from './util'

export const BUBBLE: Record<BubbleKind, { label: string; color: string }> = {
  lazy: { label: '摸鱼', color: '#ff9f43' },
  emo: { label: 'emo', color: '#8e7cff' },
  quarrel: { label: '吵架', color: '#ff5c7a' },
  ask: { label: '有事', color: '#3fb8af' },
  gossip: { label: '八卦', color: '#f7b731' },
  practice: { label: '加练', color: '#26de81' },
}

const canAct = (x: Artist) => x.status === 'ok'

export function spawnBubbles(g: GameState) {
  let n = 0
  for (const x of g.artists) {
    if (!canAct(x) || x.bubble) continue
    if (n >= 3) break
    const training = x.room !== 'rest' && x.room !== 'live'
    const lazyP =
      (training ? 0.05 : 0) +
      (has(x, 'slacker') ? 0.15 : 0) +
      (x.temper === 'chill' ? 0.06 : 0) +
      (x.stamina < 35 ? 0.15 : 0) +
      (x.discontent > 50 ? 0.1 : 0) -
      (has(x, 'grind') ? 0.08 : 0) -
      x.stress / 600
    let kind: BubbleKind | null = null
    let other: string | undefined
    if (training && Math.random() < lazyP) kind = 'lazy'
    else if ((x.temper === 'fragile' && x.mood < 40 && chance(0.3)) || (x.mood < 20 && chance(0.25))) kind = 'emo'
    else if (x.rival && byId(g, x.rival) && chance(0.15)) {
      kind = 'quarrel'
      other = x.rival
    } else if (x.favor >= 55 && chance(0.06)) kind = 'ask'
    else if ((has(x, 'gossip') && chance(0.15)) || (x.temper === 'drama' && chance(0.06))) kind = 'gossip'
    else if ((has(x, 'grind') || has(x, 'competitive') || x.temper === 'ambitious') && training && chance(0.1)) kind = 'practice'
    if (kind) {
      x.bubble = { kind, other }
      n++
    }
  }
}

export function resolveBubbles(g: GameState) {
  for (const x of g.artists) {
    const b = x.bubble
    if (!b) continue
    if (b.kind === 'lazy') {
      g.morale = clamp(g.morale - 1.5)
      remember(x, 'slacked', g.day)
      if (chance(0.3)) addLog(g, `${x.name}在练习室角落刷了一下午短视频，没人管。`)
    } else if (b.kind === 'emo') {
      change(x, { mood: -6 })
      addLog(g, `${x.name}一个人在楼梯间坐了很久，没人去问。`, 'bad')
    } else if (b.kind === 'quarrel') {
      g.morale = clamp(g.morale - 2)
      const o = byId(g, b.other)
      change(x, { mood: -5 })
      if (o) change(o, { mood: -5 })
      addLog(g, `${x.name}和${o?.name ?? '别人'}吵了一架，半层楼都听见了。`, 'bad')
    } else if (b.kind === 'ask') {
      change(x, { favor: -2 })
    }
    x.bubble = null
  }
}

const DAILY: ((g: GameState) => string | null)[] = [
  (g) => {
    const [a, b] = [pick(g.artists), pick(g.artists)]
    if (!a || !b || a === b) return null
    if (a.rival === b.id) return `${a.name}和${b.name}在电梯里遇见，全程盯着楼层数字，谁都没说话。`
    change(a, { mood: 2 })
    change(b, { mood: 2 })
    return pick([
      `${a.name}把自己的鸡腿夹给了${b.name}。`,
      `${a.name}和${b.name}在宿舍连麦打游戏，吵到凌晨。`,
      `${a.name}偷偷帮${b.name}改了一段舞蹈动作。`,
      `${a.name}和${b.name}拍了一条搞笑合拍视频，播放量还不错。`,
    ])
  },
  (g) => {
    const top = [...g.artists].sort((a, b) => b.rank - a.rank)[0]
    const low = g.artists.find((x) => x.rank < (top?.rank ?? 0) && (x.temper === 'ambitious' || has(x, 'competitive')))
    if (!top || !low) return null
    change(low, { mood: -3 })
    return `${low.name}刷到了${top.name}的${RANKS[top.rank]}物料，盯着看了很久，默默关掉了手机。`
  },
  (g) => {
    const x = g.artists.find((x) => has(x, 'vain'))
    return x ? `${x.name}在化妆间对着镜子试了二十分钟的发型。` : null
  },
  (g) => {
    const x = g.artists.find((x) => has(x, 'grind'))
    return x ? `凌晨两点，练习室的灯还亮着——是${x.name}。` : null
  },
  (g) => {
    const x = g.artists.find((x) => x.discontent > 45)
    return x ? `有人听见${x.name}在小群里吐槽：“这公司真的会谢。”` : null
  },
  (g) => {
    const x = g.artists.find((x) => x.favor > 65)
    return x ? `${x.name}在你办公桌上放了一杯热美式，便利贴上画了个笑脸。` : null
  },
  (g) => {
    const x = g.artists.find((x) => has(x, 'romantic'))
    return x ? `${x.name}一下午都在对着手机傻笑。` : null
  },
  (g) => {
    const x = g.artists.find((x) => x.stress > 60)
    return x ? `${x.name}远远看见你，下意识地站直了身子。` : null
  },
  (g) => {
    const x = g.artists.find((x) => has(x, 'meme'))
    return x ? `${x.name}在群里发了一个表情包，所有人笑了五分钟。` : null
  },
  (g) => {
    const x = g.artists.find((x) => has(x, 'money'))
    return x ? `${x.name}算了一晚上：再接多少个商演才能给家里换套房。` : null
  },
]

export function dailyLife(g: GameState) {
  for (let i = 0; i < 2; i++) {
    const t = pick(DAILY)(g)
    if (t) addLog(g, t)
  }
}

export function checkRivals(g: GameState, up: Artist) {
  for (const x of g.artists) {
    if (x === up || x.rival) continue
    if ((x.temper === 'ambitious' || x.temper === 'cool' || has(x, 'competitive')) && Math.abs(x.rank - up.rank) <= 1) {
      x.rival = up.id
      if (!up.rival) up.rival = x.id
      change(x, { mood: -6, discontent: 3 })
      addLog(g, `从这一天起，${x.name}看${up.name}的眼神变了。`, 'bad')
      break
    }
  }
}

export function bubbleDialog(g: GameState, x: Artist): Dialog | null {
  const b = x.bubble
  if (!b) return null
  x.bubble = null
  const good = isGood(x)
  if (b.kind === 'lazy') {
    remember(x, 'slacked', g.day)
    return speak(x, `${x.name}本该在${ROOMS[x.room].name}练习，却缩在角落刷手机，${x.stamina < 35 ? '眼下一片乌青。' : '刷到好笑的还偷偷笑出了声。'}`, [
      {
        label: '问问怎么了',
        run: (g) => {
          if (x.stamina < 35) {
            x.room = 'rest'
            change(x, { favor: 6, stamina: 15 })
            g.stats.kind += 0.5
            return `“最近……总是睡不着。”${ta(x)}揉了揉眼睛。你让${ta(x)}回宿舍补个觉。【${x.name} 好感 +6】`
          }
          change(x, { favor: 2, stress: 3 })
          return `${ta(x)}支支吾吾答不上来，红着脸回去练了。`
        },
      },
      {
        label: '当场批评',
        run: (g) => {
          change(x, { stress: 8, discontent: 4, favor: -2 })
          g.morale = clamp(g.morale + 2)
          g.stats.firm += 0.5
          return `${pickLine('scold', x.temper, good)}【氛围 +2，${x.name} 压力 +8】`
        },
      },
      {
        label: '罚加练两小时',
        run: (g) => {
          change(x, { stress: 12, discontent: 10, stamina: -15 })
          g.morale = clamp(g.morale + 3)
          g.stats.harsh += 1
          return `${pickLine('punish', x.temper, good)}【氛围 +3，${x.name} 不满 +10】`
        },
      },
      { label: '假装没看见', run: (g) => { g.morale = clamp(g.morale - 1); return '你转身走了。不远处，另一个练习生也悄悄掏出了手机。【氛围 -1】' } },
    ])
  }
  if (b.kind === 'emo') {
    return speak(x, `楼梯间里，${x.name}抱着膝盖坐在台阶上，耳机里放着歌，肩膀一抽一抽的。听见脚步声，${ta(x)}慌忙抹了一把脸。`, [
      {
        label: '坐下来陪着',
        run: (g) => {
          change(x, { favor: 9, mood: 18, discontent: -4 })
          g.stats.kind += 0.5
          return `${x.temper === 'cool' ? `${ta(x)}别过脸：“我没哭。”但也没赶你走。` : `${ta(x)}分了一只耳机给你。你们就这样听完了一整张专辑。`}【${x.name} 好感 +9，心情 +18】`
        },
      },
      {
        label: '“明天放你一天假。”',
        run: () => {
          x.room = 'rest'
          change(x, { favor: 5, mood: 10, stamina: 10 })
          return `${pickLine('dayoff', x.temper, good)}【${x.name} 心情 +10】`
        },
      },
      {
        label: '“哭完了就回去练。”',
        run: (g) => {
          change(x, { mood: -10, discontent: 6, stress: 5 })
          g.stats.harsh += 0.5
          return `${x.name}站起来，低着头走了。【${x.name} 心情 -10】`
        },
      },
    ])
  }
  if (b.kind === 'quarrel') {
    const o = byId(g, b.other)
    if (o) o.bubble = null
    return speak(x, `${x.name}和${o?.name ?? '别人'}在走廊吵起来了。\n\n${x.name}：“${x.temper === 'ambitious' ? '你有本事别抢我站位啊！' : '我到底哪里惹你了？'}”\n${o?.name ?? '对方'}：“${o?.temper === 'cool' ? '跟你说话，浪费时间。' : '你自己心里清楚！'}”`, [
      {
        label: '把两个人叫进办公室说开',
        run: (g) => {
          if (chance(0.5 + (x.favor + (o?.favor ?? 0)) / 400)) {
            x.rival = null
            if (o) {
              o.rival = null
              change(o, { favor: 4 })
            }
            change(x, { favor: 4 })
            g.morale = clamp(g.morale + 2)
            return '两人一开始谁都不说话，后来不知道谁先红了眼，抱在一起哭了一场。心结解开了。【嫌隙消除】'
          }
          return '两人当着你的面忍住了，出了门又互相翻了个白眼。这梁子一时半会儿解不开。'
        },
      },
      {
        label: '各扣一笔绩效',
        run: (g) => {
          change(x, { discontent: 5, stress: 5 })
          if (o) change(o, { discontent: 5, stress: 5 })
          g.morale = clamp(g.morale + 3)
          g.stats.firm += 0.5
          return '两人都不敢再吵，只是私下里更不对付了。【氛围 +3】'
        },
      },
      { label: '让他们吵', run: (g) => { g.morale = clamp(g.morale - 2); return '吵了半个小时，整层楼都听见了。【氛围 -2】' } },
    ])
  }
  if (b.kind === 'ask') {
    const asks = [
      { t: '能预支 2千 吗？家里说奶奶住院了。', cost: 2 },
      { t: '明天能请个假吗？我想回学校看看老师。', cost: 0 },
      { t: '能不能给我换一双新的舞鞋？旧的已经开胶了。', cost: 1 },
    ]
    const a = pick(asks)
    return speak(x, `${x.name}在你办公室门口转了好几圈，终于敲门进来：\n\n“老板……${a.t}”`, [
      {
        label: a.cost ? `批了（-${a.cost}千）` : '批了',
        disabled: g.money < a.cost,
        run: (g) => {
          g.money -= a.cost
          if (!a.cost) x.room = 'rest'
          change(x, { favor: 10, mood: 12 })
          remember(x, 'granted', g.day)
          return `${x.name}眼睛一亮，连声道谢。【${x.name} 好感 +10】`
        },
      },
      {
        label: '不批',
        run: () => {
          change(x, { favor: -5, mood: -8, discontent: 3 })
          return `“……好，是我想多了。”${ta(x)}低着头出去了。【${x.name} 好感 -5】`
        },
      },
    ])
  }
  if (b.kind === 'gossip') {
    const others = g.artists.filter((y) => y !== x)
    const t = pick(others.filter((y) => y.discontent > 40 || (y.secret && !y.secretKnown)).concat(others))
    let reveal = `“听说${RIVAL}新签了个练习生，长得跟明星似的。”`
    if (t) {
      if (t.secret && !t.secretKnown && chance(0.5)) {
        t.secretKnown = true
        reveal = `“${t.name}啊，${t.secret}。”`
      } else if (t.discontent > 40) reveal = `“${t.name}最近没少在背后吐槽公司。”`
      else reveal = `“${t.name}昨天偷偷哭了，好像是想家了。”`
    }
    return speak(x, `${x.name}凑过来，压低声音：“老板，你知道吗……”\n\n${reveal}`, [
      { label: '“知道了。”', run: () => { change(x, { favor: 4 }); return `${x.name}心满意足地走了。` } },
      {
        label: '“背后议论人可不好。”',
        run: (g) => {
          change(x, { favor: -3, stress: 4 })
          g.morale = clamp(g.morale + 1)
          return `${x.name}讪讪地闭了嘴。【氛围 +1】`
        },
      },
    ])
  }
  return speak(x, `晚上十一点，${ROOMS[x.room].name}的灯还亮着。${x.name}一个人一遍遍地练同一段，衣服都湿透了。`, [
    {
      label: '夸一句',
      run: () => {
        change(x, { favor: 6, mood: 10 })
        return `${pickLine('praise', x.temper, good)}【${x.name} 好感 +6】`
      },
    },
    {
      label: `给${ta(x)}点份夜宵`,
      run: () => {
        change(x, { favor: 8, stamina: 8 })
        return `${x.name}捧着热乎乎的馄饨，小声说了句：“好好吃。”【${x.name} 好感 +8】`
      },
    },
    {
      label: `催${ta(x)}早点睡`,
      run: () => {
        change(x, { stamina: 15, favor: 3 })
        return `${ta(x)}应了一声，关了灯。【体力 +15】`
      },
    },
  ])
}
