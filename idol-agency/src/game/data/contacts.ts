import type { Dialog, DialogOption } from '../dialog'
import type { Contact, GameState } from '../types'
import { addLog, change, clamp, pick } from '../util'
import { RIVAL } from './base'

type Attitude = 'kind' | 'firm' | 'scheme'

export interface ContactDef {
  id: string
  name: string
  title: string
  desc: string
  likes: string
  color: string
  color2: string
  appear: (g: GameState) => number
  pref: Record<Attitude, number>
  hint: string
  beats: Beat[]
}

interface Beat {
  min: number
  build: (g: GameState, c: Contact, d: ContactDef) => Dialog
}

const fav = (c: Contact, v: number) => {
  c.favor = clamp(c.favor + v)
  return v
}
const tag = (d: ContactDef, v: number) => (v > 0 ? `【${d.name} 好感 +${v}】` : v < 0 ? `【${d.name} 好感 ${v}】` : '')
const best = (g: GameState) => [...g.artists].sort((a, b) => b.rank - a.rank || b.fans - a.fans)[0]

export const CONTACTS: ContactDef[] = [
  {
    id: 'xu',
    name: '许知行',
    title: '独立音乐制作人',
    desc: '圈内口碑极好的制作人，只给喜欢的人写歌，常年住在录音棚里。',
    likes: '欣赏真诚和对艺人的爱护；讨厌压榨和流量至上',
    color: '#5cc9a7',
    color2: '#2f8f7a',
    appear: () => 0.45,
    pref: { kind: 7, firm: 2, scheme: -5 },
    hint: '录音棚的灯还亮着，他在等最后一轨人声。',
    beats: [
      {
        min: 0,
        build: (g, c, d) => ({
          text: '深夜，公司借来的录音棚里坐着一个穿旧卫衣的男人，正戴着耳机反复听一段练习生的清唱。\n\n见你进来，他摘下耳机：“你就是老板？这段人声，谁唱的？……挺干净的。我叫许知行，来蹭个棚。”',
          options: [
            { label: '坐下来陪他一起听', run: () => `你们从这段人声聊到了编曲，聊到了凌晨两点。他走的时候说：“你这公司，有点意思。”${tag(d, fav(c, 8))}` },
            { label: '“许老师，能给我们写首歌吗？”', run: () => `他笑了笑：“先让我多听几次吧。”${tag(d, fav(c, 2))}` },
            {
              label: '“棚费按小时算，许老师。”',
              run: (g) => {
                g.money += 2
                g.stats.scheme += 1
                return `他愣了一下，扫码付了钱。“行，规矩我懂。”【资金 +2千】${tag(d, fav(c, -6))}`
              },
            },
          ],
        }),
      },
      {
        min: 20,
        build: (g, c, d) => ({
          text: '他发来一段 demo：“写了个小样，还没填词。你觉得公司里谁适合唱？”\n\n旋律很温柔，像深夜里的一盏灯。',
          options: [
            {
              label: `推荐${best(g)?.name ?? '新人'}`,
              run: (g) => {
                const a = best(g)
                if (a) {
                  a.skills.vocal = clamp(a.skills.vocal + 5)
                  a.fans += 0.5
                  change(a, { mood: 12, favor: 5 })
                }
                g.fame = clamp(g.fame + 3)
                return `${a?.name ?? '新人'}录完那天，许知行在棚里站了好久，说：“就是这个感觉。”【口碑 +3】${tag(d, fav(c, 10))}`
              },
            },
            { label: '认真听完，写了一段很长的反馈', run: () => `他回了一句：“你是第一个听出我第二段转调用意的人。”${tag(d, fav(c, 9))}` },
            { label: '“能不能改得更抖音一点？”', run: () => `他沉默了很久，回了个“……好”。之后好几天没再联系。${tag(d, fav(c, -5))}` },
          ],
        }),
      },
      {
        min: 40,
        build: (g, c, d) => {
          if (g.stats.harsh > g.stats.kind + 2) {
            return {
              text: '他来公司拿东西，路过练习室，看见一个练习生红着眼在罚练。\n\n他站了很久，最后对你说：“……我当年就是从这样的公司逃出来的。”',
              options: [
                { label: '“行业就是这样，不狠不行。”', run: () => `他点点头，没再说话。之后很久没来过公司。${tag(d, fav(c, -8))}` },
                {
                  label: '“是我最近太急了。”',
                  run: (g) => {
                    g.stats.harsh = Math.max(0, g.stats.harsh - 2)
                    return `他神色缓和下来：“你肯这么说，就还来得及。”${tag(d, fav(c, 5))}`
                  },
                },
              ],
            }
          }
          return {
            text: '凌晨的便利店，他捧着一杯关东煮跟你说起自己：做独立音乐十年，房租交不起的时候睡过录音棚的地板。\n\n“最近有个比赛，奖金够我做一张专辑。就是报名费……算了，跟你说这些干嘛。”',
            options: [
              {
                label: '“报名费我出。”（-1万）',
                disabled: g.money < 10,
                run: (g) => {
                  g.money -= 10
                  g.flags.xuFunded = 1
                  g.stats.kind += 1
                  return `他愣住了，半天才说：“……我会还你的。不只是钱。”${tag(d, fav(c, 15))}`
                },
              },
              { label: '安静地陪他吃完', run: () => `你没多说什么，又给他加了两串鱼丸。他笑了：“谢谢你今晚在。”${tag(d, fav(c, 6))}` },
              { label: '“做音乐不如接商单。”', run: () => `他的笑容淡了：“你说得对。”${tag(d, fav(c, -4))}` },
            ],
          }
        },
      },
      {
        min: 60,
        build: (g, c, d) => ({
          text: '下雨了。你走出公司时，看见他站在门口，没带伞，手里拿着一个 U 盘。\n\n“写了首歌。”他把 U 盘递给你，“不是给艺人的。是给你的。”\n\n雨声很大，他的耳朵很红。',
          options: [
            { label: '把伞撑过去，一起走', run: () => `你们走了很长一段路，谁也没说话，但谁也没觉得尴尬。${tag(d, fav(c, 10))}` },
            { label: '当场插上耳机听', run: () => `歌很短，只有两分钟。听完你抬头，他正紧张地看着你。“……怎么样？”${tag(d, fav(c, 12))}` },
            { label: '“许老师，我们是合作关系。”', run: () => `他点点头：“我明白。”可第二天，他照常来棚里，像什么都没发生。${tag(d, fav(c, 3))}` },
          ],
        }),
      },
      {
        min: 80,
        build: (g, c, d) => {
          if (g.flags.xuFunded && !g.flags.xuWon) {
            g.flags.xuWon = 1
            g.fame = clamp(g.fame + 10)
            addLog(g, '许知行拿下年度音乐大奖，致谢里提到了微光娱乐。', 'good')
            return {
              text: '颁奖礼直播。许知行拿下了年度最佳制作人。\n\n他站在台上，看着镜头：“谢谢一个人。在我最难的时候，是这个人替我交了报名费。”\n\n第二天，微光娱乐上了热搜。【口碑 +10】',
              options: [{ label: '给他发一条消息', run: () => `“恭喜。” 他秒回：“今晚有空吗？我想当面说。”${tag(d, fav(c, 10))}` }],
            }
          }
          return chat(g, c, d)
        },
      },
    ],
  },
  {
    id: 'cheng',
    name: '程野',
    title: '动作指导',
    desc: '武行出身，拍过上百部戏的打戏。话少，脾气硬，最看不惯欺负人。',
    likes: '欣赏干脆利落、护着自己人；讨厌耍心眼',
    color: '#5a6170',
    color2: '#30343d',
    appear: () => 0.28,
    pref: { firm: 7, kind: 3, scheme: -6 },
    hint: '天台上有人在抽烟，火星一明一灭。',
    beats: [
      {
        min: 0,
        build: (g, c, d) => ({
          text: '剧组探班。片场一角，一个副导演正指着你家新人的鼻子骂：“小公司的人就是不懂规矩！”\n\n旁边一个穿黑色T恤的男人放下手里的护具，皱了皱眉，看向你。',
          options: [
            {
              label: '走过去，挡在新人前面',
              run: (g) => {
                g.stats.firm += 1
                return `“有问题跟我说，别冲孩子。”副导演讪讪走了。黑T男人挑了挑眉：“有点意思。程野，动作指导。”${tag(d, fav(c, 10))}`
              },
            },
            { label: '赔笑道歉，息事宁人', run: () => `副导演哼了一声走了。黑T男人看了你一眼，转身继续干活。${tag(d, fav(c, 2))}` },
            { label: '拉着新人先走', run: () => `你们离开时，听见身后有人嗤笑了一声。${tag(d, fav(c, -3))}` },
          ],
        }),
      },
      {
        min: 20,
        build: (g, c, d) => ({
          text: '凌晨一点，他给你打电话，声音很低：“你家有个孩子，在片场吊威亚的时候，安全扣没扣好。我发现了，没出事。”\n\n“剧组想压下来。你打算怎么办？”',
          options: [
            {
              label: '“我明天就去找制片方。”',
              run: (g) => {
                g.stats.firm += 1
                g.risk = clamp(g.risk + 5)
                return `你在会议室拍了桌子，制片方当场换了安全组。程野在门外听着，嘴角动了一下。【舆情风险 +5】${tag(d, fav(c, 14))}`
              },
            },
            { label: '“谢谢你。我会私下处理。”', run: () => `“嗯。”他顿了顿，“下次进组，我盯着。”${tag(d, fav(c, 8))}` },
            {
              label: '“别声张，影响合作。”',
              run: () => `电话那头沉默了很久，然后挂了。${tag(d, fav(c, -15))}`,
            },
          ],
        }),
      },
      {
        min: 45,
        build: (g, c, d) => ({
          text: '天台。他递给你一罐啤酒，看着城市的灯：\n\n“我十六岁进武行，摔断过三根肋骨。没人记得替身叫什么。”他转过头，“你为什么做经纪人？”',
          options: [
            { label: '说实话', run: () => `你讲了很久。他一直没打断，最后说：“你比我见过的大多数老板都像个人。”${tag(d, fav(c, 10))}` },
            { label: '“为了赚钱呗。”', run: () => `他笑出声：“倒是实在。”${tag(d, fav(c, 4))}` },
            { label: '“那你又为什么还在做？”', run: () => `他沉默了很久：“……因为总得有人教那些小孩怎么摔才不疼。”${tag(d, fav(c, 7))}` },
          ],
        }),
      },
      {
        min: 65,
        build: (g, c, d) => {
          const a = pick(g.artists)
          return {
            text: `活动后台，一个喝多了的投资方拉着${a?.name ?? '你家艺人'}不让走，非要“再喝一杯”。\n\n程野已经站了起来，看着你：“你的人，你说了算。”`,
            options: [
              {
                label: '“交给你。”',
                run: (g) => {
                  g.risk = clamp(g.risk + 6)
                  if (a) change(a, { favor: 8 })
                  return `那人被程野“扶”出了门，连声道歉。${a?.name ?? '艺人'}躲在你身后，小声说了句“谢谢”。【舆情风险 +6】${tag(d, fav(c, 8))}`
                },
              },
              {
                label: '自己上去，把人拉开',
                run: (g) => {
                  g.stats.firm += 1
                  if (a) change(a, { favor: 12 })
                  return `全场安静了。那人酒醒了一半，悻悻地走了。程野慢慢坐回去，低声说：“好。”${tag(d, fav(c, 12))}`
                },
              },
            ],
          }
        },
      },
    ],
  },
  {
    id: 'tan',
    name: '谭以舟',
    title: '资本少东家',
    desc: '星河资本的继承人，投过半个娱乐圈。笑起来很温和，算盘打得比谁都精。',
    likes: '欣赏手腕和野心；讨厌优柔寡断',
    color: '#9a7bff',
    color2: '#5b45c7',
    appear: (g) => 0.15 + g.fame / 250,
    pref: { scheme: 7, firm: 4, kind: -2 },
    hint: '楼下停着一辆黑色迈巴赫，他的助理在等你。',
    beats: [
      {
        min: 0,
        build: (g, c, d) => {
          const a = best(g)
          return {
            text: '慈善晚宴。一个西装笔挺的年轻男人端着香槟走过来：\n\n“微光娱乐？我看过你们的财报——不太好看。”他笑得很温和，“谭以舟。我好奇，你打算怎么翻盘？”',
            options: [
              {
                label: `“让我们的${a?.name ?? '艺人'}说话。”`,
                run: () =>
                  (a?.rank ?? 0) >= 2
                    ? `他看完那段舞台视频，挑了挑眉：“有点东西。”${tag(d, fav(c, 8))}`
                    : `他扫了一眼，笑了：“练习生水平？”笑意温和，眼神却冷。${tag(d, fav(c, -3))}`,
              },
              { label: '“说出来就不灵了。”', run: () => `他愣了一下，然后笑出了声：“好，我等着看。”${tag(d, fav(c, 10))}` },
              {
                label: '“谭总要投资吗？先付诚意金。”',
                run: (g) => {
                  g.money += 12
                  g.stats.scheme += 1
                  return `他大笑，随手签了一张支票：“就当买张门票。”【资金 +1.2万】${tag(d, fav(c, 6))}`
                },
              },
            ],
          }
        },
      },
      {
        min: 25,
        build: (g, c, d) => ({
          text: '“我有个品牌，想找你们的艺人做三个月的推广，”他把合同推过来，“价格，你开。”',
          options: [
            {
              label: '开一个天价',
              run: (g) => {
                g.money += 40
                g.stats.scheme += 1
                return `他眼都没眨就签了：“你是个明白人。”【资金 +4万】${tag(d, fav(c, 5))}`
              },
            },
            {
              label: '给友情价，换他的资源扶持',
              run: (g) => {
                g.money += 15
                g.fame = clamp(g.fame + 6)
                return `一个月后，三个大品牌主动找上门。【资金 +1.5万，口碑 +6】${tag(d, fav(c, 10))}`
              },
            },
            { label: '婉拒：“我们挑合作方。”', run: () => `他挑眉，反而笑了：“你越来越有意思了。”${tag(d, fav(c, 7))}` },
          ],
        }),
      },
      {
        min: 45,
        build: (g, c, d) => ({
          text: `他约你在私人会所见面，屏退了所有人：\n\n“${RIVAL}的老板，最近在做一些……不太干净的事。我需要有人帮我拿到证据。你在圈子里，消息比我灵通。”`,
          options: [
            {
              label: '答应帮他',
              run: (g) => {
                g.flags.tanDeal = 1
                g.risk = clamp(g.risk + 6)
                g.stats.scheme += 1
                return `他举杯：“我就知道没看错人。”【舆情风险 +6】${tag(d, fav(c, 12))}`
              },
            },
            { label: '“我只做艺人，不掺和这些。”', run: () => `他也不恼：“也好。干净的人，在这个圈子里不多了。”${tag(d, fav(c, 4))}` },
          ],
        }),
      },
      {
        min: 65,
        build: (g, c, d) => ({
          text: '宴会散场，他靠在露台的栏杆上，难得没有笑：\n\n“我身边的人，要么怕我，要么想从我这里拿点什么。”他转过头，“你呢？你想要什么？”',
          options: [
            { label: '“我想让全网都知道微光娱乐。”', run: () => `他看了你很久，忽然笑了，这次是真的：“好。我帮你。”${tag(d, fav(c, 12))}` },
            { label: '“我什么都不要。”', run: () => `“骗人。”他轻声说，却没有拆穿下去。${tag(d, fav(c, 5))}` },
            { label: '“想要谭总一句真话。”', run: () => `他沉默了。良久：“……那你得等等。我还没学会。”${tag(d, fav(c, 9))}` },
          ],
        }),
      },
    ],
  },
  {
    id: 'ji',
    name: '季闻',
    title: '调查记者',
    desc: '专挖娱乐圈黑幕的深度记者，曝光过三家公司的压榨丑闻。笔很锋利，人很固执。',
    likes: '欣赏干净透明的公司；讨厌压榨艺人和公关操控',
    color: '#4a90c2',
    color2: '#2c5f8a',
    appear: (g) => 0.12 + g.risk / 150,
    pref: { firm: 5, kind: 4, scheme: -7 },
    hint: '公司楼下的咖啡馆里，有人在等你，桌上放着一支录音笔。',
    beats: [
      {
        min: 0,
        build: (g, c, d) => {
          const good = g.morale >= 50
          return {
            text: `一个背着帆布包的男人堵在公司门口，亮出记者证：“季闻，深度报道。有人匿名爆料，说微光娱乐压榨练习生。我想进去看看。”\n\n${good ? '他扫了一眼练习室里的笑闹声，神色稍缓。' : '他注意到一个练习生红肿的眼睛，眉头皱了起来。'}`,
            options: [
              {
                label: '“请进，随便看，随便问。”',
                run: (g) => {
                  if (!good) g.risk = clamp(g.risk + 5)
                  return `他待了整整一下午，最后合上笔记本：“${good ? '暂时没发现问题。' : '我还会再来。'}”${good ? '' : '【舆情风险 +5】'}${tag(d, fav(c, good ? 10 : 3))}`
                },
              },
              {
                label: '塞一个红包，请他高抬贵手',
                run: (g) => {
                  g.risk = clamp(g.risk + 12)
                  g.stats.scheme += 1
                  return `他把红包推回来，打开了录音笔：“谢谢，这一段我会写进稿子里。”【舆情风险 +12】${tag(d, fav(c, -12))}`
                },
              },
            ],
          }
        },
      },
      {
        min: 20,
        build: (g, c, d) => ({
          text: '“我在查一家黑中介，专门用假合同骗想当艺人的孩子。”他推过来一张照片，“这个人，有没有来过你们公司？”',
          options: [
            {
              label: '把所有合同都拿给他看',
              run: (g) => {
                g.risk = clamp(g.risk - 8)
                g.morale = clamp(g.morale + 3)
                return `他一份一份看完，起身说：“谢谢配合。”这是他第一次对你点头。【舆情风险 -8】${tag(d, fav(c, 12))}`
              },
            },
            { label: '“我们公司很干净，请回吧。”', run: () => `他看了你一眼：“但愿如此。”${tag(d, fav(c, -3))}` },
          ],
        }),
      },
      {
        min: 45,
        build: (g, c, d) => ({
          text: '他第一次不是来采访的。深夜的咖啡馆，他盯着冷掉的咖啡：\n\n“今天那篇稿子发了。那个被骗的孩子才十七岁。”他沉默了很久，“你说，写这些到底有没有用？”',
          options: [
            { label: '静静听他说', run: () => `他说了很多，说完自己都有些意外：“……打扰了。”${tag(d, fav(c, 10))}` },
            { label: '“有用。至少我会看。”', run: (g) => { g.stats.firm += 1; return `他抬起头看你，眼神第一次有了温度。${tag(d, fav(c, 12))}` } },
            { label: '“何必那么较真。”', run: () => `他放下杯子：“也是。”起身走了。${tag(d, fav(c, -3))}` },
          ],
        }),
      },
    ],
  },
]

const TOPICS: { q: string; opts: { label: string; att: Attitude }[] }[] = [
  {
    q: '“你公司的艺人，在你眼里是什么？”',
    opts: [
      { label: '“家人。”', att: 'kind' },
      { label: '“各凭本事吃饭的伙伴。”', att: 'firm' },
      { label: '“公司最值钱的资产。”', att: 'scheme' },
    ],
  },
  {
    q: '“要是艺人塌房了，你会怎么处理？”',
    opts: [
      { label: '“先问清楚，再决定怎么帮。”', att: 'kind' },
      { label: '“错了就认，该罚就罚。”', att: 'firm' },
      { label: '“看他还有没有商业价值。”', att: 'scheme' },
    ],
  },
  {
    q: `“${RIVAL}最近抢了你不少资源，不生气？”`,
    opts: [
      { label: '“做好自己就行。”', att: 'kind' },
      { label: '“下个季度，我把他们的资源抢回来。”', att: 'firm' },
      { label: '“我手里有他们的黑料，不急。”', att: 'scheme' },
    ],
  },
  {
    q: '“你打算一直做这家小公司？”',
    opts: [
      { label: '“守着这群孩子就挺好。”', att: 'kind' },
      { label: '“做到我不想做为止。”', att: 'firm' },
      { label: '“这只是开始。”', att: 'scheme' },
    ],
  },
]

const REACT: Record<string, { pos: string[]; neg: string[] }> = {
  xu: { pos: ['他眼里有光：“你真的很好。”', '他笑了，像是放下了什么心事。'], neg: ['他沉默了一会儿：“……也是一种活法。”', '他低头喝了口水，没接话。'] },
  cheng: { pos: ['他碰了一下你的啤酒罐：“痛快。”', '他挑眉：“对我胃口。”'], neg: ['他嗤了一声：“弯弯绕绕，没意思。”', '他别过脸去，没说话。'] },
  tan: { pos: ['他轻轻鼓掌：“漂亮。”', '他眼底浮起兴味：“你果然不一般。”'], neg: ['他笑得很温和：“心太软，在这个圈子活不长。”', '他晃了晃酒杯，不置可否。'] },
  ji: { pos: ['他点了点头，神色缓和了些。', '“嗯。”他难得多看了你一眼。'], neg: ['他皱眉：“这句话，别让我写进稿子里。”', '他合上了笔记本，没再问。'] },
}

export function chat(g: GameState, c: Contact, d: ContactDef): Dialog {
  const t = pick(TOPICS)
  const opts: DialogOption[] = t.opts.map((o) => ({
    label: o.label,
    run: (g) => {
      const v = d.pref[o.att]
      fav(c, v)
      g.stats[o.att] += 0.5
      return `${pick(v >= 0 ? REACT[d.id].pos : REACT[d.id].neg)}${tag(d, v)}`
    },
  }))
  return { text: `聊着聊着，${d.name}忽然问：\n\n${t.q}`, options: opts }
}

export function contactDialog(g: GameState, c: Contact): Dialog {
  const d = CONTACTS.find((x) => x.id === c.id)!
  c.met = true
  c.lastSeen = g.day
  const beat = d.beats[c.beat]
  let dl: Dialog
  if (beat && c.favor >= beat.min) {
    c.beat += 1
    dl = beat.build(g, c, d)
  } else dl = chat(g, c, d)
  return {
    ...dl,
    speaker: d.name,
    sub: d.title,
    portrait: { char: d.name.slice(1, 2), color: d.color, color2: d.color2, seed: d.id + d.name, gender: 'm' },
  }
}

export function stageOf(f: number) {
  if (f >= 80) return '心动'
  if (f >= 60) return '暧昧'
  if (f >= 40) return '朋友'
  if (f >= 20) return '熟人'
  if (f > 0) return '初识'
  return '陌生'
}
