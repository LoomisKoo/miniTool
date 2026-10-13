/* 名字实验室 · 性格与审美轴定义
 * 所有名字库（中文 / 英文 / 古风）的标签都基于这 7 条轴。
 * 前 4 条是「人格轴」——决定选什么字义；
 * 后 3 条是「审美轴」——决定名字长什么样。
 * 拆成两套是为了让同一份性格可以映射到不同文化的名字池（跨文化对照玩法的基础）。
 */
var NM = (window.NM = window.NM || {});

NM.AXES = [
  { key: 'warm', group: 'trait', label: '温度', low: '清冷', high: '温暖' },
  { key: 'out',  group: 'trait', label: '社交', low: '内敛', high: '外向' },
  { key: 'rat',  group: 'trait', label: '决策', low: '感性', high: '理性' },
  { key: 'sta',  group: 'trait', label: '节奏', low: '跳脱', high: '稳重' },
  { key: 'cla',  group: 'style', label: '时代', low: '现代', high: '古典' },
  { key: 'sim',  group: 'style', label: '繁简', low: '华丽', high: '简洁' },
  { key: 'exp',  group: 'style', label: '表达', low: '含蓄', high: '直白' }
];

NM.TRAIT_KEYS = ['warm', 'out', 'rat', 'sta'];
NM.STYLE_KEYS = ['cla', 'sim', 'exp'];

/* 题目：每题 4 选 1，每个选项是一包稀疏权重。
 * 前 6 题问人格，后 2 题直接问偏好（纯间接推断容易偏，直球题用来校准）。
 *
 * 权重：w = 7 条轴上的贡献；nov = 额外一条「想要的少见度」（0 常见 ←→ 1 冷门），
 * 因为「想不想撞名」没法用性格轴表达，但对选名字影响极大。
 */
NM.QUESTIONS = [
  {
    id: 'q1',
    text: '一句话介绍自己，你会说——',
    options: [
      { text: '慢热，热闹场合会累', w: { out: -0.9, warm: 0.1, sta: 0.2 } },
      { text: '喜欢热闹，也擅长把场子热起来', w: { out: 0.9, warm: 0.5, exp: 0.4 } },
      { text: '话不多，但熟人面前很疯', w: { out: -0.3, warm: 0.4, sta: -0.3 } },
      { text: '看人下菜，得看是谁', w: { out: 0.1, rat: 0.4, exp: -0.2 } }
    ]
  },
  {
    id: 'q2',
    text: '做一个不太重要的决定时，你会——',
    options: [
      { text: '先看信息，再谈感觉', w: { rat: 0.9, sta: 0.3, exp: 0.2 } },
      { text: '凭直觉，错了再改', w: { rat: -0.8, sta: -0.5, exp: 0.3 } },
      { text: '问问身边人怎么说', w: { warm: 0.6, out: 0.4, rat: -0.2 } },
      { text: '先拖着，等它自己变清楚', w: { sta: -0.4, rat: -0.2, out: -0.3 } }
    ]
  },
  {
    id: 'q3',
    text: '理想的周末是——',
    options: [
      { text: '一个人待着，看点东西', w: { out: -0.9, sta: 0.2, warm: 0 } },
      { text: '约朋友出门，越热闹越好', w: { out: 0.9, warm: 0.5, exp: 0.3 } },
      { text: '收拾房间，把一切归位', w: { sta: 0.9, rat: 0.4, sim: 0.3 } },
      { text: '去没去过的地方转转', w: { out: 0.3, sta: -0.7, exp: 0.4 } }
    ]
  },
  {
    id: 'q4',
    text: '别人最常夸你——',
    options: [
      { text: '温和，好相处', w: { warm: 0.9, sta: 0.3 } },
      { text: '有意思，脑子快', w: { rat: 0.6, sta: -0.4, out: 0.4 } },
      { text: '靠谱，交给你放心', w: { sta: 0.9, warm: 0.3, rat: 0.4 } },
      { text: '有想法，跟别人不太一样', w: { exp: 0.4, cla: -0.4, sta: -0.3, rat: 0.2 } }
    ]
  },
  {
    id: 'q5',
    text: '你的情绪通常——',
    options: [
      { text: '写在脸上，高兴难过都看得出', w: { warm: 0.6, exp: 0.8, out: 0.5 } },
      { text: '收在心里，不太让人看出来', w: { exp: -0.9, out: -0.5, sta: 0.2 } },
      { text: '很稳，很少大起大落', w: { sta: 0.9, rat: 0.4 } },
      { text: '起伏大，来得快去得也快', w: { sta: -0.8, rat: -0.5, warm: 0.4 } }
    ]
  },
  {
    id: 'q6',
    text: '做一件事，你更在意——',
    options: [
      { text: '最后有没有做成', w: { rat: 0.8, sta: 0.5 } },
      { text: '过程里开不开心', w: { rat: -0.6, warm: 0.6 } },
      { text: '有没有自己的风格', w: { cla: -0.2, exp: 0.5, sim: -0.4 } },
      { text: '别人会怎么看', w: { warm: 0.5, out: 0.4, exp: 0.2 } }
    ]
  },
  {
    id: 'q7',
    text: '你希望这个名字给人的第一感觉是——',
    options: [
      { text: '温柔、干净', w: { warm: 0.9, sim: 0.5, cla: 0.3 }, nov: 0.1 },
      { text: '干练、利落', w: { sta: 0.5, sim: 0.4, rat: 0.4, warm: -0.2 }, nov: 0.2 },
      { text: '神秘、有距离感', w: { out: -0.5, cla: 0.5, exp: -0.6, warm: -0.4 }, nov: 0.9 },
      { text: '有趣、记得住', w: { exp: 0.7, sta: -0.4, cla: -0.4 }, nov: 0.6 }
    ]
  },
  {
    id: 'q8',
    text: '你更喜欢哪种名字的样子——',
    options: [
      { text: '一看就懂，大方常见', w: { sim: 0.5, exp: 0.6, cla: -0.3 }, nov: 0.1 },
      { text: '有点古意，像从诗里来的', w: { cla: 0.9, exp: -0.4 }, nov: 0.5 },
      { text: '清冷少见，不太撞名', w: { cla: 0.3, exp: -0.3, warm: -0.4 }, nov: 0.95 },
      { text: '简单两个字，好写好念', w: { sim: 0.9, cla: -0.4, exp: 0.3 }, nov: 0.15 }
    ]
  }
];
