/* 意象域：每个字归属一个「域」，域自带一套基础性格/审美倾向。
 * 好处是标 200 个字就够了——单字的向量 = 域基础向量 + 该字微调。
 * 同时域还负责拼装护栏：跨域太远的两个字不能拼（"澈戈"这种）。
 */
var NM = (window.NM = window.NM || {});

NM.DOMAINS = {
  water:  { label: '水 · 清透', tr: { warm: 0.10, out: -0.20, rat: 0.10, sta: 0.20 }, st: { cla: 0.50, sim: 0.40, exp: 0.00 } },
  wood:   { label: '木 · 草木', tr: { warm: 0.40, out: 0.10, rat: -0.10, sta: 0.30 }, st: { cla: 0.60, sim: 0.20, exp: -0.10 } },
  fire:   { label: '火 · 光明', tr: { warm: 0.70, out: 0.50, rat: 0.00, sta: 0.00 }, st: { cla: 0.20, sim: 0.40, exp: 0.50 } },
  sky:    { label: '天 · 星辰', tr: { warm: 0.10, out: 0.10, rat: 0.20, sta: 0.00 }, st: { cla: 0.40, sim: 0.50, exp: 0.10 } },
  earth:  { label: '山 · 沉厚', tr: { warm: 0.00, out: -0.10, rat: 0.20, sta: 0.80 }, st: { cla: 0.50, sim: 0.60, exp: 0.20 } },
  gift:   { label: '玉 · 珍宝', tr: { warm: 0.40, out: 0.20, rat: 0.00, sta: 0.30 }, st: { cla: 0.70, sim: 0.10, exp: 0.00 } },
  mind:   { label: '心 · 品格', tr: { warm: 0.30, out: 0.00, rat: 0.50, sta: 0.70 }, st: { cla: 0.50, sim: 0.40, exp: 0.30 } },
  quiet:  { label: '静 · 雅致', tr: { warm: 0.30, out: -0.60, rat: 0.10, sta: 0.50 }, st: { cla: 0.60, sim: 0.60, exp: -0.50 } },
  sound:  { label: '音 · 文采', tr: { warm: 0.20, out: 0.00, rat: 0.20, sta: 0.10 }, st: { cla: 0.70, sim: 0.20, exp: -0.20 } },
  beast:  { label: '鸟兽 · 灵动', tr: { warm: 0.10, out: 0.40, rat: -0.10, sta: -0.20 }, st: { cla: 0.40, sim: 0.30, exp: 0.20 } },
  bright: { label: '朗 · 明快', tr: { warm: 0.50, out: 0.60, rat: 0.10, sta: -0.10 }, st: { cla: 0.00, sim: 0.50, exp: 0.80 } },
  com:    { label: '日常 · 通用', tr: { warm: 0.20, out: 0.10, rat: 0.00, sta: 0.10 }, st: { cla: -0.30, sim: 0.40, exp: 0.30 } }
};

/* 拼装护栏：只有同一域或语义相近的域才能组合成名字 */
NM.DOMAIN_COMPAT = {
  water:  ['water', 'wood', 'quiet', 'sky', 'gift', 'com'],
  wood:   ['wood', 'water', 'quiet', 'beast', 'earth', 'com'],
  fire:   ['fire', 'bright', 'sky', 'gift', 'com'],
  sky:    ['sky', 'water', 'fire', 'bright', 'sound', 'com'],
  earth:  ['earth', 'wood', 'mind', 'gift', 'com'],
  gift:   ['gift', 'water', 'wood', 'quiet', 'sound', 'com'],
  mind:   ['mind', 'earth', 'bright', 'gift', 'com'],
  quiet:  ['quiet', 'water', 'wood', 'gift', 'sound', 'com'],
  sound:  ['sound', 'sky', 'gift', 'quiet', 'com'],
  beast:  ['beast', 'wood', 'bright', 'sky', 'com'],
  bright: ['bright', 'fire', 'sky', 'mind', 'beast', 'com'],
  com:    ['water', 'wood', 'fire', 'sky', 'earth', 'gift', 'mind', 'quiet', 'sound', 'beast', 'bright', 'com']
};

NM.domainsCompatible = function (a, b) {
  if (a === b) return true;
  const ca = NM.DOMAIN_COMPAT[a] || [];
  return ca.indexOf(b) !== -1;
};
