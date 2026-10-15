import type { Dialog } from '../dialog'
import type { Artist, GameState } from '../types'
import { RIVAL, fmtMoney } from './base'
import { addLog, change, chance, clamp, has, pick, remember, ta } from '../util'
import { generateArtist, portraitOf } from '../gen'

export interface EventDef {
  id: string
  weight: (g: GameState) => number
  build: (g: GameState) => Dialog
  cooldown?: number
}

const who = (a: Artist) => ({ speaker: a.name, portrait: portraitOf(a) })
const leave = (g: GameState, a: Artist) => {
  g.artists = g.artists.filter((x) => x.id !== a.id)
  if (g.topStar === a.id) g.topStar = null
  g.artists.forEach((x) => x.rival === a.id && (x.rival = null))
}

export const EVENTS: EventDef[] = [
  {
    id: 'hot_search',
    cooldown: 6,
    weight: (g) => (g.artists.some((x) => x.fans >= 3) ? 2 : 0),
    build: (g) => {
      const a = pick(g.artists.filter((x) => x.fans >= 3))
      return {
        title: '🔥 黑热搜',
        ...who(a),
        text: `#${a.name} 耍大牌# 突然冲上热搜第七。一段剪辑过的视频里，${a.name}在后台没理一个工作人员。\n\n评论区已经吵翻了。${a.name}给你发消息：“我没有……那天我是在背词。”`,
        options: [
          {
            label: '放出完整视频澄清',
            run: (g) => {
              change(a, { favor: 10, stress: -5 })
              g.fame = clamp(g.fame + 2)
              a.fans += 0.6
              return `完整视频一出，风向反转。#${a.name} 被恶意剪辑# 上了热搜，还涨了一波粉。【${a.name} 好感 +10，粉丝 +0.6万】`
            },
          },
          {
            label: '买热搜压下去（-8千）',
            disabled: g.money < 8,
            run: (g) => {
              g.money -= 8
              g.risk = clamp(g.risk + 6)
              return `热搜撤了，但有人截图了“撤热搜”的记录。【资金 -8千，舆情风险 +6】`
            },
          },
          {
            label: '让艺人发道歉声明',
            run: () => {
              change(a, { favor: -10, discontent: 15, mood: -20 })
              a.fans = Math.max(0, a.fans - 0.4)
              return `道歉声明发出去了。${a.name}一整晚没回消息。粉丝说：“没错为什么要道歉？”【${a.name} 不满 +15】`
            },
          },
        ],
      }
    },
  },
  {
    id: 'sasaeng',
    cooldown: 8,
    weight: (g) => (g.artists.some((x) => x.fans >= 2) ? 1.5 : 0),
    build: (g) => {
      const a = pick(g.artists.filter((x) => x.fans >= 2))
      return {
        title: '私生饭',
        ...who(a),
        text: `${a.name}凌晨给你打电话，声音在抖：“老板，宿舍楼下有人……已经跟了我三天了。今天还往门缝里塞了一封信。”`,
        options: [
          {
            label: '立刻报警，加派安保（-5千）',
            disabled: g.money < 5,
            run: (g) => {
              g.money -= 5
              change(a, { favor: 12, stress: -10 })
              remember(a, 'protected', g.day)
              g.stats.firm += 1
              return `警察来了，人被带走了。${a.name}给你发了一句：“谢谢你，我第一次觉得有人在护着我。”【${a.name} 好感 +12】`
            },
          },
          {
            label: '发声明警告私生行为',
            run: (g) => {
              g.fame = clamp(g.fame + 2)
              change(a, { favor: 5 })
              return '声明被粉丝转发了几万次，私生饭消停了一阵子。【口碑 +2】'
            },
          },
          {
            label: '“红了都这样，习惯就好。”',
            run: () => {
              change(a, { favor: -10, stress: 20, mood: -15 })
              return `电话那头沉默了很久，然后挂了。【${a.name} 压力 +20】`
            },
          },
        ],
      }
    },
  },
  {
    id: 'poach',
    cooldown: 10,
    weight: (g) => (g.artists.some((x) => x.rank >= 2) ? 1.5 : 0),
    build: (g) => {
      const a = pick(g.artists.filter((x) => x.rank >= 2))
      const tempted = a.favor < 50 || a.discontent > 40
      return {
        title: '对家挖人',
        ...who(a),
        text: `${RIVAL}的经纪总监私下约了${a.name}：违约金他们出，资源翻倍，直接进他们的S级企划。\n\n${tempted ? `${a.name}这两天心不在焉，练习时频频看手机。` : `${a.name}自己把聊天记录截图发给了你：“我没答应。就是……想让你知道。”`}`,
        options: [
          {
            label: `给${ta(a)}加分成，挽留（-1.5万）`,
            disabled: g.money < 15,
            run: (g) => {
              g.money -= 15
              change(a, { favor: 10, discontent: -10 })
              return `${a.name}留下了。【资金 -1.5万，${a.name} 好感 +10】`
            },
          },
          {
            label: '约出来好好聊一次',
            run: (g) => {
              if (tempted && a.favor < 30) {
                leave(g, a)
                g.fame = clamp(g.fame - 3)
                addLog(g, `${a.name}跳槽去了${RIVAL}。`, 'bad')
                return `你说了很多，${ta(a)}一直低着头。第二天，${RIVAL}官宣了新成员。【${a.name} 离开了公司】`
              }
              change(a, { favor: 8 })
              return `${ta(a)}听完，轻声说：“我不走。”【${a.name} 好感 +8】`
            },
          },
          {
            label: '“想走就走，我不拦。”',
            run: (g) => {
              if (tempted) {
                leave(g, a)
                addLog(g, `${a.name}去了${RIVAL}。`, 'bad')
                return `${ta(a)}愣了一下，第二天真的走了。【${a.name} 离开了公司】`
              }
              change(a, { favor: -5, mood: -10 })
              return `${a.name}咬着嘴唇：“你就这么不在乎吗？”${ta(a)}没走，但心里有了疙瘩。`
            },
          },
        ],
      }
    },
  },
  {
    id: 'burnout',
    cooldown: 5,
    weight: (g) => (g.artists.some((x) => x.stamina < 30 || has(x, 'nightowl')) ? 2 : 0),
    build: (g) => {
      const a = pick(g.artists.filter((x) => x.stamina < 30 || has(x, 'nightowl')))
      return {
        title: '累倒了',
        ...who(a),
        text: `练习室传来一声闷响——${a.name}练着练着晕倒了。医生说是过度疲劳加低血糖，需要休息。`,
        options: [
          {
            label: '送去好医院，安心养着（-4千）',
            disabled: g.money < 4,
            run: (g) => {
              g.money -= 4
              a.status = 'sick'
              a.statusUntil = g.day + 2
              a.room = 'rest'
              change(a, { favor: 12, stamina: 30 })
              g.stats.kind += 1
              return `${a.name}醒来时，看到床头的果篮和你留的便利贴，把脸埋进了被子里。【${a.name} 好感 +12】`
            },
          },
          {
            label: `让${ta(a)}在宿舍躺几天`,
            run: (g) => {
              a.status = 'sick'
              a.statusUntil = g.day + 3
              a.room = 'rest'
              change(a, { stamina: 15 })
              return `${a.name}在宿舍躺了好几天，恢复得很慢。`
            },
          },
          {
            label: '“小问题，喝点糖水继续练。”',
            run: (g) => {
              change(a, { discontent: 15, stamina: -20, mood: -20 })
              g.stats.harsh += 1
              g.risk = clamp(g.risk + 3)
              return `${a.name}脸色煞白地爬了起来。其他练习生都看在眼里，没人说话。【${a.name} 不满 +15，舆情风险 +3】`
            },
          },
        ],
      }
    },
  },
  {
    id: 'dating',
    cooldown: 12,
    weight: (g) => (g.artists.some((x) => has(x, 'romantic') || (x.secret?.includes('对象') ?? false)) ? 1.3 : 0.2),
    build: (g) => {
      const pool = g.artists.filter((x) => has(x, 'romantic') || (x.secret?.includes('对象') ?? false))
      const a = pick(pool.length ? pool : g.artists)
      return {
        title: '📸 恋情曝光',
        ...who(a),
        text: `狗仔放出了一组照片：${a.name}深夜和一个人在路边吃烧烤，有说有笑。\n\n营销号已经开始写“恋情实锤”。${a.name}站在你办公室门口，眼睛通红：“我们是认真的。”`,
        options: [
          {
            label: `支持${ta(a)}，公开承认`,
            run: (g) => {
              change(a, { favor: 18, discontent: -10, mood: 10 })
              a.fans = Math.max(0, a.fans * 0.8)
              g.stats.kind += 1
              return `声明发出后，掉了一部分女友粉，但也有很多人说“好勇”。${a.name}抱着你哭了。【${a.name} 好感 +18，粉丝 -20%】`
            },
          },
          {
            label: '发声明否认，私下要求分手',
            run: (g) => {
              change(a, { favor: -15, discontent: 20, mood: -25 })
              remember(a, 'humiliated', g.day)
              g.stats.harsh += 1
              return `粉丝稳住了。${a.name}那天之后变得很安静，再也没提过那个人。【${a.name} 不满 +20】`
            },
          },
          {
            label: '冷处理，不回应',
            run: () => {
              a.fans = Math.max(0, a.fans * 0.9)
              change(a, { stress: 10 })
              return '热度过了几天就淡了，只是超话里一直有人在吵。【粉丝 -10%】'
            },
          },
        ],
      }
    },
  },
  {
    id: 'show_invite',
    cooldown: 10,
    weight: (g) => (g.artists.some((x) => x.rank >= 1) ? 1.2 : 0),
    build: (g) => {
      const top = [...g.artists].sort((a, b) => b.skills.variety - a.skills.variety)[0]
      return {
        title: '综艺邀约',
        ...who(top),
        text: `一档热门选秀综艺《星光101》发来邀请，想要一个练习生参加。节目组暗示：“有剧本，会给‘恶魔剪辑’，但热度保证。”\n\n${top.name}眼巴巴地看着你。`,
        options: [
          {
            label: `让${top.name}去，接受恶魔剪辑`,
            run: (g) => {
              top.fans += 2
              g.fame = clamp(g.fame + 4)
              change(top, { stress: 20, mood: -10 })
              return `节目播出，${top.name}成了全网最有争议的选手，涨粉两万，但评论区骂声一片。【粉丝 +2万，压力 +20】`
            },
          },
          {
            label: '去，但要求不接受剧本',
            run: (g) => {
              const ok = top.skills.variety + top.looks / 2 + Math.random() * 30 > 60
              if (ok) {
                top.fans += 1.2
                g.fame = clamp(g.fame + 5)
                change(top, { mood: 15, favor: 6 })
                return `节目组不太高兴，但${top.name}凭真本事出了圈。“真诚才是必杀技”上了热搜。【粉丝 +1.2万，口碑 +5】`
              }
              change(top, { mood: -10 })
              return `${top.name}一轮游，镜头不到一分钟。【心情 -10】`
            },
          },
          { label: '婉拒', run: () => { change(top, { mood: -8 }); return `${top.name}有点失落：“好吧……”` } },
        ],
      }
    },
  },
  {
    id: 'theft',
    cooldown: 10,
    weight: (g) => (g.artists.length >= 3 ? 1 : 0),
    build: (g) => {
      const [v, s] = [pick(g.artists), pick(g.artists)]
      if (v === s) return EVENTS.find((e) => e.id === 'fanmeet')!.build(g)
      return {
        title: '丢东西了',
        ...who(v),
        text: `${v.name}的耳返不见了——那是${ta(v)}用第一笔通告费买的定制款。有人说昨晚看见${s.name}进过${ta(v)}的储物柜。\n\n${s.name}${s.temper === 'cool' || s.temper === 'ambitious' ? '冷冷地说：“调监控啊。”' : '脸都白了，一个劲摇头。'}`,
        options: [
          {
            label: '调监控，查清楚',
            run: (g) => {
              g.stats.firm += 1
              g.morale = clamp(g.morale + 3)
              change(s, { favor: 8 })
              change(v, { favor: 4 })
              return `监控显示，是保洁阿姨收拾时顺手放进了失物箱。${s.name}松了口气，看你的眼神不一样了。【氛围 +3】`
            },
          },
          {
            label: `当众搜${s.name}的柜子`,
            run: (g) => {
              change(s, { discontent: 20, favor: -12, mood: -15 })
              remember(s, 'humiliated', g.day)
              g.stats.harsh += 1
              return `什么都没搜到。后来耳返在失物箱里找到了，可${s.name}再也没主动跟你说过话。【${s.name} 不满 +20】`
            },
          },
          {
            label: '自掏腰包买个新的（-3千）',
            run: (g) => {
              g.money -= 3
              change(v, { favor: 8 })
              g.morale = clamp(g.morale - 2)
              return `${v.name}很感动。只是事情没查清楚，大家私下议论了好几天。【氛围 -2】`
            },
          },
        ],
      }
    },
  },
  {
    id: 'fanmeet',
    cooldown: 12,
    weight: (g) => (g.phase === 0 && g.day % 7 === 0 ? 4 : 0.3),
    build: (g) => ({
      title: '🎉 周年庆',
      text: '今天是公司成立纪念日，楼下来了一群粉丝，举着灯牌和应援物。练习生们扒着窗户往下看，眼睛都亮了。',
      options: [
        {
          label: '放半天假，全员下楼和粉丝互动',
          run: (g) => {
            g.artists.forEach((x) => {
              change(x, { mood: 20, favor: 5, stamina: 10 })
              x.fans += 0.1
            })
            g.flags.closedTonight = 1
            g.stats.kind += 1
            return '那天下午楼下成了大型见面会，所有人嗓子都喊哑了。【全员心情 +20，今晚不接通告】'
          },
        },
        {
          label: '办一场直播见面会（-6千）',
          disabled: g.money < 6,
          run: (g) => {
            g.money -= 6
            g.fame = clamp(g.fame + 8)
            g.flags.boost = 1
            g.artists.forEach((x) => change(x, { mood: 8 }))
            return '直播同时在线人数破了公司纪录，今晚的通告邀约明显多了。【口碑 +8，今晚通告增多】'
          },
        },
        {
          label: '照常工作',
          run: (g) => {
            g.artists.forEach((x) => change(x, { mood: -6 }))
            return '大家没说什么，只是一整天都在往窗外看。'
          },
        },
      ],
    }),
  },
  {
    id: 'parents',
    cooldown: 12,
    weight: (g) => (g.artists.length ? 0.8 : 0),
    build: (g) => {
      const a = pick(g.artists)
      return {
        title: '家长来了',
        ...who(a),
        text: `一对中年夫妇冲进公司，说是${a.name}的爸妈：“读个好好的书不读，跑来当什么戏子！今天必须跟我们回家！”\n\n${a.name}躲在练习室门后，浑身发抖。`,
        options: [
          {
            label: '请他们坐下，好好谈',
            run: (g) => {
              const ok = chance(0.6)
              change(a, { favor: 12 })
              g.stats.kind += 1
              if (ok) return `你给他们看了${a.name}的练习视频和成长记录。妈妈看着看着哭了：“原来这孩子这么拼……”【${a.name} 好感 +12】`
              return `谈了两个小时，他们没被说服，但答应“再给一年时间”。${a.name}偷偷给你发了个“谢谢”。【${a.name} 好感 +12】`
            },
          },
          {
            label: '让保安请他们出去',
            run: (g) => {
              g.risk = clamp(g.risk + 4)
              change(a, { favor: 4, mood: -10 })
              return `他们在楼下骂了半个小时，还被路人拍了视频。${a.name}一整天都没出练习室。【舆情风险 +4】`
            },
          },
          {
            label: '“家事你自己处理。”',
            run: () => {
              change(a, { favor: -10, mood: -20, stress: 15 })
              return `${a.name}被带回家吵了一整晚，第二天顶着黑眼圈回来了。【${a.name} 心情 -20】`
            },
          },
        ],
      }
    },
  },
  {
    id: 'buyout',
    cooldown: 15,
    weight: (g) => (g.phase === 2 && g.artists.some((x) => x.rank >= 3) ? 1.2 : 0),
    build: (g) => {
      const a = pick(g.artists.filter((x) => x.rank >= 3))
      const price = 60 + a.rank * 40 + Math.round(a.fans * 3)
      const wants = a.favor < 40 || has(a, 'money') || a.temper === 'ambitious'
      return {
        title: '天价合约',
        ...who(a),
        text: `一家头部经纪公司开出 ${fmtMoney(price)} 的违约金，要买断${a.name}的合约。\n\n${wants ? `${a.name}看到数字时，眼睛亮了一下，又很快移开了视线。` : `${a.name}私下对你说：“我不想走。”`}`,
        options: [
          {
            label: `收钱放人（+${fmtMoney(price)}）`,
            run: (g) => {
              g.money += price
              leave(g, a)
              g.artists.forEach((x) => change(x, { mood: wants ? 3 : -8 }))
              addLog(g, `${a.name}被高价买断，离开了微光。`, 'info')
              return wants
                ? `${a.name}走的那天，给每个人都买了奶茶，最后抱了你一下。【资金 +${fmtMoney(price)}】`
                : `${a.name}签字的时候手在抖。练习生们好几天都没怎么说话。【资金 +${fmtMoney(price)}，全员心情低落】`
            },
          },
          {
            label: '问艺人自己的意思',
            run: (g) => {
              g.stats.kind += 1
              if (wants) {
                g.money += price
                leave(g, a)
                g.artists.forEach((x) => change(x, { favor: 4 }))
                return `${ta(a)}说想去更大的平台。你签了字。大家都看到了——老板是讲道理的人。【资金 +${fmtMoney(price)}，全员好感 +4】`
              }
              change(a, { favor: 15 })
              return `${ta(a)}说不走，你就回绝了。那天晚上，练习室的灯亮到很晚。【${a.name} 好感 +15】`
            },
          },
          {
            label: '坐地起价，要两倍',
            run: (g) => {
              g.stats.scheme += 1
              if (chance(0.5)) {
                g.money += price * 2
                leave(g, a)
                return `对方咬牙答应了。${a.name}临走时看了你一眼，说不清是什么表情。【资金 +${fmtMoney(price * 2)}】`
              }
              change(a, { discontent: 10 })
              return `对方直接撤了报价，还在圈里放话说微光的老板太贪。【${a.name} 不满 +10】`
            },
          },
        ],
      }
    },
  },
  {
    id: 'fight',
    cooldown: 6,
    weight: (g) => (g.artists.filter((x) => x.rival).length >= 2 ? 2 : 0),
    build: (g) => {
      const a = pick(g.artists.filter((x) => x.rival))
      const b = g.artists.find((x) => x.id === a.rival) ?? pick(g.artists.filter((x) => x !== a))
      return {
        title: '练习室冲突',
        ...who(a),
        text: `舞蹈室吵起来了。${a.name}说${b.name}故意站位挡${ta(a)}的镜头，${b.name}说${a.name}升了级就目中无人。两个人谁也不让谁，周围一圈人在看热闹。`,
        options: [
          {
            label: '两个都罚，一起加练',
            run: (g) => {
              change(a, { discontent: 5, stress: 5 })
              change(b, { discontent: 5, stress: 5 })
              g.morale = clamp(g.morale + 3)
              g.stats.firm += 1
              return '两人一起加练到半夜，最后居然一起点了外卖。【氛围 +3】'
            },
          },
          {
            label: `站${a.name}这边`,
            run: () => {
              change(a, { favor: 8 })
              change(b, { favor: -10, discontent: 15 })
              return `${a.name}得意地扬了扬下巴。${b.name}攥紧了拳头，什么都没说。【${b.name} 不满 +15】`
            },
          },
          {
            label: '让他们自己解决',
            run: (g) => {
              g.morale = clamp(g.morale - 4)
              change(a, { mood: -8 })
              change(b, { mood: -8 })
              return '吵到最后摔了一个水杯。公司的氛围好像变差了一点。【氛围 -4】'
            },
          },
        ],
      }
    },
  },
  {
    id: 'debt',
    cooldown: 6,
    weight: (g) => (g.money < 0 ? 5 : 0),
    build: (g) => ({
      title: '资金告急',
      text: `财务敲开你的门：“老板，账上已经亏了 ${fmtMoney(-g.money)}，房东和供应商都在催款。”`,
      options: [
        {
          label: '找投资方借 5 万（每期利息 5千）',
          run: (g) => {
            g.money += 50
            g.debt += 50
            return '钱到账了。只是利滚利，迟早要还。【资金 +5万，负债 +5万】'
          },
        },
        {
          label: '全员降薪三成',
          run: (g) => {
            g.money += 10
            g.artists.forEach((x) => change(x, { discontent: 8, mood: -10 }))
            return '降薪通知一发，群里一片沉默。有人私下说公司要倒了。【资金 +1万，全员不满 +8】'
          },
        },
      ],
    }),
  },
  {
    id: 'secret',
    cooldown: 6,
    weight: (g) => (g.artists.some((x) => x.secret && !x.secretKnown && x.favor >= 50) ? 1.5 : 0),
    build: (g) => {
      const a = pick(g.artists.filter((x) => x.secret && !x.secretKnown && x.favor >= 50))
      a.secretKnown = true
      return {
        title: '深夜来电',
        ...who(a),
        text: `凌晨一点，${a.name}给你打电话。沉默了很久，才终于开口——\n\n原来${ta(a)}${a.secret}。\n\n“我没跟任何人说过。”${ta(a)}小声说，“你会……觉得我很麻烦吗？”`,
        options: [
          {
            label: '“谢谢你愿意告诉我。”',
            run: (g) => {
              change(a, { favor: 12, mood: 10 })
              remember(a, 'trusted', g.day)
              return `电话那头传来一声很轻的笑，像是卸下了一副很重的担子。【${a.name} 好感 +12】`
            },
          },
          {
            label: '“有什么需要，公司帮你。”',
            run: (g) => {
              g.money -= 3
              change(a, { favor: 18, discontent: -10 })
              g.stats.kind += 1
              return `你帮${ta(a)}处理了一些事。第二天，${a.name}在练习室待到了最晚。【资金 -3千，${a.name} 好感 +18】`
            },
          },
        ],
      }
    },
  },
  {
    id: 'blackout',
    cooldown: 15,
    weight: () => 0.4,
    build: (g) => ({
      title: '设备故障',
      text: '一场暴雨过后，声乐室漏水了，调音台和两支麦克风都泡了水。',
      options: [
        {
          label: '立刻找人修（-1.2万）',
          disabled: g.money < 12,
          run: (g) => {
            g.money -= 12
            return '师傅们忙了三天，声乐室焕然一新。【资金 -1.2万】'
          },
        },
        {
          label: '先凑合用',
          run: (g) => {
            g.flags.leak = g.day + 5
            g.artists.forEach((x) => change(x, { mood: -5 }))
            return '声乐室里摆满了接水的桶，大家练歌时总要分心。（5天内声乐室效率减半）'
          },
        },
      ],
    }),
  },
  {
    id: 'leak',
    cooldown: 8,
    weight: (g) => (g.artists.some((x) => x.discontent >= 60) ? 2 : 0),
    build: (g) => {
      const a = pick(g.artists.filter((x) => x.discontent >= 60))
      return {
        title: '匿名爆料',
        ...who(a),
        text: `匿名论坛出现一个帖子：“扒一扒微光娱乐的压榨日常”，细节很真实。\n\n有人说，发帖 IP 和${a.name}的手机在同一个城区。`,
        options: [
          {
            label: `找${ta(a)}单独谈谈`,
            run: () => {
              change(a, { discontent: -15, favor: 6 })
              return `${ta(a)}一开始梗着脖子不承认，后来哭了：“我就是……太委屈了。”你们聊到了天亮。【${a.name} 不满 -15】`
            },
          },
          {
            label: '停工三天，内部通报',
            run: (g) => {
              a.status = 'suspended'
              a.statusUntil = g.day + 3
              a.room = 'rest'
              change(a, { discontent: 15, stress: 20 })
              g.stats.harsh += 1
              g.risk = clamp(g.risk + 4)
              return `通报一出，帖子反而更火了。【${a.name} 不满 +15，舆情风险 +4】`
            },
          },
          {
            label: '不理会，用口碑说话',
            run: (g) => {
              g.fame = clamp(g.fame - 3)
              return '帖子过几天就沉了，只是有两个品牌方暂停了合作洽谈。【口碑 -3】'
            },
          },
        ],
      }
    },
  },
  {
    id: 'walkin',
    cooldown: 10,
    weight: (g) => (g.phase <= 1 ? 0.6 : 0),
    build: (g) => ({
      title: '自荐',
      text: '前台说，有个背着吉他的孩子在楼下等了一上午，说看过微光练习生的直播，想来试试。\n\n“我什么都能练，就是……没钱交培训费。”',
      options: [
        {
          label: '让人上来试试',
          run: (g) => {
            const c = generateArtist(g, { quality: 0.95 })
            c.favor = 40
            g.candidates.unshift(c)
            g.flags.freeId = g.idSeq
            g.stats.kind += 1
            return `${c.name}在会议室唱了一首自己写的歌，唱完紧张得手都在抖。（${c.name}已出现在星探名单里，可以免费签约）`
          },
        },
        {
          label: '给个联系方式，以后再说',
          run: () => '那孩子鞠了个躬，背着吉他走了。',
        },
      ],
    }),
  },
]

export function pickEvent(g: GameState): Dialog | null {
  if (!g.artists.length) return null
  const cands = EVENTS.filter((e) => {
    const last = g.flags['ev_' + e.id] ?? -99
    return g.day - last >= (e.cooldown ?? 5) && e.weight(g) > 0
  })
  if (!cands.length) return null
  const total = cands.reduce((s, e) => s + e.weight(g), 0)
  let r = Math.random() * total
  for (const e of cands) {
    r -= e.weight(g)
    if (r <= 0) {
      g.flags['ev_' + e.id] = g.day
      return e.build(g)
    }
  }
  return null
}
