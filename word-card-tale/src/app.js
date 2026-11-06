/* 词卡物语 · 交互 */
(function () {
  'use strict';

  var WORDS = window.WORDS;
  var TAGS = window.TAGS;
  var TIERS = window.TIERS;
  var Card = window.Card;
  var FX = window.FX;
  var Capture = window.Capture;
  var Sfx = window.Sfx || { play: function () {}, recent: function () { return false; } };
  function sfx(n, a) { try { Sfx.play(n, a); } catch (e) {} }

  var BY_WORD = {};
  for (var i = 0; i < WORDS.length; i++) BY_WORD[WORDS[i].w] = WORDS[i];

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage');
  var KEY = 'wordcodex.v3';
  var DEV_MODE = false;
  // 演示数据：网址带 ?demo 时注入一批满级顶级卡，只存在内存里，不写存档
  var DEMO = typeof location !== 'undefined' && /[?&#]demo\b/.test(location.search + location.hash);
  var FREE_PER_DAY = 3;   // 每日免费 3 组（每组 3 张 = 9 个新词）
  var BATTLE_PER_DAY = 3; // 已废弃：漫游改为精力制，保留常量兼容旧存档
  var BONUS_CAP = 10;     // 任务 / 漫游掉落 / 成长点兑换额外抽卡的每日上限
  var INK_PER_DRAW = 60;  // 成长点兑换一组抽卡
  var INK_SWAP_CAP = 3;   // 每日成长点兑换上限
  /* ── 漫游精力（消消乐式体力）─────────────────────────
     上限 5 点，每 10 分钟恢复 1 点（满槽约 50 分钟）。
     目的是防止一次坐下连刷十几局，而不是卡住正常游玩。 */
  var MAX_ENERGY = 5;
  var ENERGY_REGEN_MS = 10 * 60 * 1000;
  var ENERGY_BUY_COST = 40;   // 花成长点买 1 点精力
  var ENERGY_BUY_CAP = 3;     // 每日最多买 3 次
  function energyRegenMin() { return Math.round(ENERGY_REGEN_MS / 60000); }
  var CHECKIN_REWARD = 5; // 每日首次签到奖励
  var DROP_RATE = 0.35;   // 漫游胜利掉落抽卡券的几率（Boss 关必掉）
  var DUP_INK = { 1: 6, 2: 10, 3: 20, 4: 40, 5: 80, 6: 150 }; // 重复卡转成长点
  var WRITE_INK = 6;                                  // 每次默写正确（基础）
  var WRITE_INK_NEW = 12;                             // 该词第一次默写正确
  var WRITE_INK_REVIEW = 3;                           // 已经 3 星后的复习
  var WRITE_INK_CAP = 60;                             // 默写成长点每日上限

  /* ── 世界漫游地区：真实地点 + 当地食物作为关卡敌人 ─────
     bg: 战场底色；bosses: 5 关的首领（食物/地标）；
     need: 解锁需要的已通晓词数（0 = 一开始就能去）。 */
  var REGIONS = [
    { id: 'london', nm: '雾港', place: '伦敦', sub: '晨雾里的早餐铺', need: 0,
      bg: ['#2b333f', '#161c24', '#080a0d'], c1: '#e3bb78',
      bosses: ['焦糖贝果', '炸鱼薯条', '黄油司康', '伯爵茶壶', '黑布丁'], foods: ['贝果', '炸鱼薯条', '司康'] },
    { id: 'nyc', nm: '霓虹城', place: '纽约', sub: '深夜的街角餐车', need: 4,
      bg: ['#2a1d3e', '#161025', '#07050c'], c1: '#ff7ab8',
      bosses: ['芝士热狗', '纽约贝果', '厚切披萨', '椒盐脆饼', '芝士蛋糕'], foods: ['热狗', '贝果', '披萨'] },
    { id: 'tokyo', nm: '樱汀', place: '东京', sub: '电车旁的小食堂', need: 10,
      bg: ['#2f2436', '#191322', '#090610'], c1: '#ffb3c8',
      bosses: ['酱油饭团', '豚骨拉面', '玉子烧', '章鱼烧', '抹茶大福'], foods: ['饭团', '拉面', '章鱼烧'] },
    { id: 'paris', nm: '酒红巷', place: '巴黎', sub: '塞纳河左岸的面包房', need: 18,
      bg: ['#32201f', '#1d1113', '#0a0506'], c1: '#e6a86a',
      bosses: ['可颂', '法棍', '马卡龙', '洋葱汤', '焦糖布丁'], foods: ['可颂', '法棍', '马卡龙'] },
    { id: 'singapore', nm: '香料港', place: '新加坡', sub: '熟食中心的烟火气', need: 28,
      bg: ['#1e2f2b', '#101c1a', '#050a09'], c1: '#e8be6a',
      bosses: ['咖椰吐司', '海南鸡饭', '辣椒螃蟹', '沙爹串', '叻沙'], foods: ['吐司', '鸡饭', '叻沙'] },
    { id: 'istanbul', nm: '金角湾', place: '伊斯坦布尔', sub: '香料市集的清晨', need: 40,
      bg: ['#2d2620', '#1a1512', '#080605'], c1: '#e2b25f',
      bosses: ['芝麻圆面包', '土耳其软糖', '烤肉卷', '石榴汁', '果仁蜜饼'], foods: ['圆面包', '软糖', '蜜饼'] },
    { id: 'seoul', nm: '夜灯街', place: '首尔', sub: '帐篷摊的深夜热气', need: 54,
      bg: ['#262b3d', '#141827', '#06080e'], c1: '#ff9ec4',
      bosses: ['辣炒年糕', '紫菜包饭', '糖饼', '炸鸡啤酒', '南山塔'], foods: ['年糕', '包饭', '炸鸡'] },
    { id: 'bangkok', nm: '河岸市', place: '曼谷', sub: '湄南河上的长尾船', need: 70,
      bg: ['#2f2a1c', '#1a150d', '#080604'], c1: '#f0c860',
      bosses: ['泰式炒面', '冬阴功', '嘟嘟车', '芒果糯米饭', '郑王庙'], foods: ['炒面', '冬阴功', '芒果饭'] },
    { id: 'mexico', nm: '万灵城', place: '墨西哥城', sub: '亡灵节的烛光市集', need: 88,
      bg: ['#33202c', '#1c1018', '#08040a'], c1: '#ff9a4d',
      bosses: ['塔可', '吉事果', '仙人掌', '糖骷髅', '独立天使'], foods: ['塔可', '吉事果', '糖骷髅'] },
    { id: 'cairo', nm: '沙金市', place: '开罗', sub: '金字塔下的香料摊', need: 108,
      bg: ['#33291c', '#1c1610', '#0a0806'], c1: '#e8c880',
      bosses: ['炸豆丸', '库莎丽', '椰枣', '神灯', '金字塔'], foods: ['豆丸', '库莎丽', '椰枣'] },
    { id: 'lisbon', nm: '瓷砖巷', place: '里斯本', sub: '升降机旁的老蛋挞店', need: 120,
      bg: ['#1f2a33', '#111a20', '#060a0d'], c1: '#f0b968',
      bosses: ['葡式蛋挞', '沙丁鱼罐头', '樱桃酒', '28 路电车', '贝伦塔'], foods: ['蛋挞', '沙丁鱼', '樱桃酒'] },
    { id: 'rome', nm: '石板城', place: '罗马', sub: '喷泉边的冰淇淋车', need: 132,
      bg: ['#33261e', '#1c1410', '#090605'], c1: '#e8c07a',
      bosses: ['意式冰淇淋', '浓缩咖啡', '帕尼尼', '小摩托', '斗兽场'], foods: ['冰淇淋', '咖啡', '帕尼尼'] },
    { id: 'hongkong', nm: '霓虹巷', place: '香港', sub: '茶餐厅的午市人潮', need: 144,
      bg: ['#2a1f2e', '#17101c', '#07050a'], c1: '#ffb066',
      bosses: ['菠萝包', '云吞面', '丝袜奶茶', '叮叮车', '天坛大佛'], foods: ['菠萝包', '云吞面', '奶茶'] },
    { id: 'rio', nm: '海风城', place: '里约', sub: '海滩边的果摊与球场', need: 156,
      bg: ['#1e2f2a', '#101c18', '#050a08'], c1: '#7edc9a',
      bosses: ['巴西莓碗', '巴西烤肉', '椰子', '足球', '基督像'], foods: ['莓碗', '烤肉', '椰子'] },
    { id: 'mumbai', nm: '香料城', place: '孟买', sub: '突突车流里的茶摊', need: 168,
      bg: ['#33291c', '#1c1610', '#0a0806'], c1: '#f0b050',
      bosses: ['咖喱角', '印度烤饼', '玛莎拉茶', '三轮车', '印度门'], foods: ['咖喱角', '烤饼', '奶茶'] },
    { id: 'moscow', nm: '雪原城', place: '莫斯科', sub: '红场边的热汤摊', need: 180,
      bg: ['#242c3a', '#131a24', '#05080d'], c1: '#9fc4ff',
      bosses: ['罗宋汤', '布林薄饼', '俄式饺子', '套娃', '圣瓦西里'], foods: ['罗宋汤', '薄饼', '饺子'] },
    { id: 'sydney', nm: '帆港', place: '悉尼', sub: '海港边的肉派小店', need: 192,
      bg: ['#1c2a36', '#0f1822', '#05090d'], c1: '#8fd0ff',
      bosses: ['澳式肉派', '拉明顿蛋糕', '回旋镖', '袋鼠', '悉尼歌剧院'], foods: ['肉派', '蛋糕', '回旋镖'] },
    { id: 'barcelona', nm: '彩瓷城', place: '巴塞罗那', sub: '兰布拉大道的夜市', need: 204,
      bg: ['#33221a', '#1c120e', '#0a0605'], c1: '#ffb35c',
      bosses: ['海鲜饭', '西班牙火腿', '折扇', '吉他', '圣家堂'], foods: ['海鲜饭', '火腿', '折扇'] },
    { id: 'amsterdam', nm: '运河镇', place: '阿姆斯特丹', sub: '单车穿过的运河桥', need: 216,
      bg: ['#1f2a30', '#10181c', '#05080a'], c1: '#ffcf6a',
      bosses: ['焦糖华夫饼', '奶酪', '木鞋', '自行车', '风车'], foods: ['华夫饼', '奶酪', '木鞋'] },
    { id: 'berlin', nm: '灰墙城', place: '柏林', sub: '啤酒花园的周末', need: 228,
      bg: ['#24262c', '#141519', '#06070a'], c1: '#ffd36b',
      bosses: ['椒盐卷饼', '咖喱香肠', '啤酒杯', '红绿灯小人', '勃兰登堡门'], foods: ['卷饼', '香肠', '啤酒'] },
    { id: 'athens', nm: '白石城', place: '雅典', sub: '卫城脚下的橄榄园', need: 240,
      bg: ['#2a2a24', '#171712', '#080806'], c1: '#9fd0ff',
      bosses: ['希腊卷饼', '橄榄', '猫头鹰', '双耳陶罐', '帕特农神庙'], foods: ['卷饼', '橄榄', '陶罐'] },
    { id: 'marrakech', nm: '赤红城', place: '马拉喀什', sub: '香料集市的薄荷茶', need: 252,
      bg: ['#3a2218', '#20120c', '#0c0604'], c1: '#ff9a5c',
      bosses: ['塔吉锅', '薄荷茶', '古斯米', '摩洛哥灯', '库图比亚清真寺'], foods: ['塔吉锅', '薄荷茶', '古斯米'] },
    { id: 'hanoi', nm: '湖心城', place: '河内', sub: '还剑湖畔的河粉摊', need: 264,
      bg: ['#1e2a22', '#101812', '#050a06'], c1: '#f2c94c',
      bosses: ['越南河粉', '越南法包', '滴滤咖啡', '越南斗笠', '龟塔'], foods: ['河粉', '法包', '咖啡'] },
    { id: 'beijing', nm: '红墙城', place: '北京', sub: '胡同口的糖葫芦', need: 276,
      bg: ['#2e1c1c', '#1a0f10', '#0a0506'], c1: '#ffcc55',
      bosses: ['北京烤鸭', '糖葫芦', '包子', '风筝', '天坛'], foods: ['烤鸭', '糖葫芦', '包子'] },
    { id: 'toronto', nm: '枫叶城', place: '多伦多', sub: '湖边的枫糖早餐', need: 288,
      bg: ['#2a1e1e', '#171010', '#080505'], c1: '#ff6b5c',
      bosses: ['枫糖松饼', '肉汁奶酪薯条', '甜甜圈', '枫叶', '加拿大国家电视塔'], foods: ['松饼', '薯条', '甜甜圈'] },
    { id: 'capetown', nm: '岬角城', place: '开普敦', sub: '桌山下的企鹅海滩', need: 300,
      bg: ['#1c2a2a', '#0f1818', '#050a0a'], c1: '#7edcc8',
      bosses: ['南非肉干', '南非博士茶', '帝王花', '企鹅', '桌山'], foods: ['肉干', '红茶', '帝王花'] },
    { id: 'buenosaires', nm: '探戈港', place: '布宜诺斯艾利斯', sub: '街角的探戈与马黛茶', need: 312,
      bg: ['#26203a', '#141024', '#07050e'], c1: '#9fc4ff',
      bosses: ['阿根廷馅饼', '阿法乔饼', '马黛茶', '班多钮手风琴', '方尖碑'], foods: ['馅饼', '甜饼', '马黛茶'] },
    { id: 'cusco', nm: '云巅城', place: '库斯科', sub: '安第斯山的玉米集市', need: 324,
      bg: ['#25301f', '#141c10', '#070a05'], c1: '#b9e28c',
      bosses: ['酸橘汁腌鱼', '玉米', '排箫', '羊驼', '马丘比丘'], foods: ['腌鱼', '玉米', '排箫'] },
    { id: 'sanfrancisco', nm: '雾湾城', place: '旧金山', sub: '码头边的酸面包', need: 336,
      bg: ['#26262e', '#15151a', '#07070a'], c1: '#ff8a5c',
      bosses: ['酸面包', '幸运饼干', '面包碗浓汤', '叮当车', '金门大桥'], foods: ['酸面包', '饼干', '浓汤'] },
    { id: 'honolulu', nm: '浪花岛', place: '檀香山', sub: '海滩边的彩虹刨冰', need: 348,
      bg: ['#16302e', '#0c1c1a', '#040a09'], c1: '#5fe6d0',
      bosses: ['波奇饭', '彩虹刨冰', '菠萝', '冲浪板', '钻石头山'], foods: ['波奇饭', '刨冰', '菠萝'] },
  ];
  function regionById(id) {
    for (var i = 0; i < REGIONS.length; i++) if (REGIONS[i].id === id) return REGIONS[i];
    return REGIONS[0];
  }
  // 地区解锁：通关上一个地区的第 5 关
  function regionUnlocked(r) {
    var i = REGIONS.indexOf(r);
    if (i <= 0) return true;
    var prev = state.stages && state.stages[REGIONS[i - 1].id];
    return !!prev && prev.c >= 5;
  }
  var state = {
    owned: {}, draws: 0, recent: [], ink: DEV_MODE ? 300 : 0,
    drawTheme: 'all',
    day: null, streak: 0, lastDay: '', records: [], shards: {}, achSeen: {},
    stats: { battles: 0, wins: 0, kills: 0, stars: 0 }, achInit: false,
    region: '', inkDay: { d: '', wr: 0 },
    energy: { n: MAX_ENERGY, t: 0 },
    quota: { d: '', used: 0, bonus: 0, battleUsed: 0, battleBonus: 0 },
  };
  var busy = false;
  var bookFilter = 'got';
  var bookSort = 'tier';
  var bookTag = '';          // 图鉴分类，'' = 全部分类
  var bookQuery = '';        // 图鉴关键字搜索
  var CODEX_PAGE = 40;       // 每次渲染的卡片数
  var codexShown = CODEX_PAGE;
  var codexRendered = 0;     // 已经塞进 DOM 的卡片数，用于增量追加
  var codexTotal = 0;        // 当前筛选下的总卡数
  var GRID_GAP = 12;         // 与 CSS 的 column-gap 保持一致
  var codexObs = null;       // 底部哨兵的 IntersectionObserver
  var deckEl = null;
  var deckWords = [];
  var activeIdx = 0;

  /* ── 存储 ─────────────────────────────────────── */
  // 地址带 ?reset 时从零开始（开发调试用）
  // 小红书原生存储是异步的：getStorage({key}) → Promise<{data}>；本地 localStorage 同步兜底，两边都写
  function nativeStore() {
    var m = window.xhs && window.xhs.miniTool;
    return m && typeof m.getStorage === 'function' && typeof m.setStorage === 'function' ? m : null;
  }
  function sget() {
    if (/[?&]reset\b/.test(location.search)) return null;
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function sgetNative() {
    var m = nativeStore();
    if (!m || /[?&]reset\b/.test(location.search)) return Promise.resolve(null);
    try {
      return Promise.resolve(m.getStorage({ key: KEY })).then(function (res) {
        var d = res && res.data !== undefined ? res.data : res;
        return typeof d === 'string' ? d : d ? JSON.stringify(d) : null;
      }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function sset(str) {
    try { localStorage.setItem(KEY, str); } catch (e) {}
    var m = nativeStore();
    if (!m) return;
    try {
      var p = m.setStorage({ key: KEY, data: str });
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function load(raw) {
    if (raw === undefined) raw = sget();
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      if (!o) return;
      state.owned = o.owned || {};
      for (var ok in state.owned) {
        var oe = state.owned[ok];
        if (oe && !oe.cl && !oe.lv && !oe.wr) delete state.owned[ok];
      }
      state.draws = o.draws || 0;
      state.recent = o.recent || [];
      state.day = o.day || null;
      state.streak = o.streak || 0;
      state.lastDay = o.lastDay || '';
      state.quota = o.quota || state.quota;
      state.ink = o.ink || 0;
      state.inkDay = o.inkDay && typeof o.inkDay === 'object' ? o.inkDay : { d: '', wr: 0 };
      state.energy = o.energy && typeof o.energy.n === 'number' ? o.energy : { n: MAX_ENERGY, t: Date.now() };
      state.drawTheme = o.drawTheme || 'all';
      state.records = o.records || [];
      state.shards = o.shards || {};
      state.achSeen = o.achSeen && typeof o.achSeen === 'object' ? o.achSeen : {};
      state.achInit = !!o.achInit;
      state.stats = o.stats || state.stats;
      if (!o.stats && state.records.length) {
        state.records.forEach(function (r) {
          state.stats.battles++;
          state.stats.kills += r.kills || 0;
          if (r.win) { state.stats.wins++; state.stats.stars += r.stars || 0; }
        });
      }
      state.region = o.region || '';
      state.stages = o.stages || {};
      state.codex = o.codex || {};
    } catch (e) {}
  }
  function save() {
    if (DEMO) return;
    sset(JSON.stringify({
      owned: state.owned, draws: state.draws, recent: state.recent,
      day: state.day, streak: state.streak, lastDay: state.lastDay,
      quota: state.quota, ink: state.ink, inkDay: state.inkDay, energy: state.energy,
      records: state.records,
      drawTheme: state.drawTheme,
      shards: state.shards, achSeen: state.achSeen, achInit: state.achInit, stats: state.stats,
      region: state.region, stages: state.stages, codex: state.codex,
    }));
  }

  /* ── 日期 ─────────────────────────────────────── */
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function yesterdayStr() {
    var d = new Date(Date.now() - 86400000);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /* ── 每日额度 ─────────────────────────────────── */
  function quotaLeft() {
    if (DEV_MODE) return 999;
    var t = todayStr();
    if (state.quota.d !== t) state.quota = { d: t, used: 0, bonus: 0, battleUsed: 0, battleBonus: 0 };
    return Math.max(0, FREE_PER_DAY + state.quota.bonus - state.quota.used);
  }
  function battleQuotaLeft() {
    return DEV_MODE ? 999 : energyNow();
  }
  function battleQuotaUse() {
    if (DEV_MODE) return true;
    return energySpend();
  }
  /* ── 精力 ─────────────────────────────────────── */
  function energyOf() {
    if (!state.energy || typeof state.energy.n !== 'number') {
      state.energy = { n: MAX_ENERGY, t: Date.now() };
    }
    return state.energy;
  }
  // 结算随时间恢复：不用定时器写存档，读的时候按时间差补
  function energyNow() {
    var e = energyOf();
    if (e.n >= MAX_ENERGY) { e.t = Date.now(); return MAX_ENERGY; }
    var gain = Math.floor((Date.now() - e.t) / ENERGY_REGEN_MS);
    if (gain > 0) {
      var before = e.n;
      e.n = Math.min(MAX_ENERGY, e.n + gain);
      e.t = e.n >= MAX_ENERGY ? Date.now() : e.t + gain * ENERGY_REGEN_MS;
      if (e.n !== before) save();
    }
    if (e.n >= MAX_ENERGY) e.t = Date.now();
    return e.n;
  }
  // 距离下一点精力的毫秒数；已满返回 0
  function energyNextMs() {
    var e = energyOf();
    if (energyNow() >= MAX_ENERGY) return 0;
    return Math.max(0, ENERGY_REGEN_MS - (Date.now() - e.t));
  }
  function energySpend() {
    if (energyNow() <= 0) return false;
    var e = energyOf();
    if (e.n >= MAX_ENERGY) e.t = Date.now();   // 从满槽开始掉，重新计时
    e.n = Math.max(0, e.n - 1);
    save();
    renderEnergy();
    return true;
  }
  function energyBuyLeft() {
    var t = todayStr();
    if (!state.quota.energyDay || state.quota.energyDay.d !== t) {
      state.quota.energyDay = { d: t, bought: 0 };
    }
    return Math.max(0, ENERGY_BUY_CAP - (state.quota.energyDay.bought || 0));
  }
  var energyBuyDialog = false;
  function askEnergyBuy() {
    if (energyBuyDialog) return;
    if (energyNow() >= MAX_ENERGY) { toast('精力已满'); sfx('deny'); return; }
    if (energyBuyLeft() <= 0) { toast('今日兑换次数已用完'); sfx('deny'); return; }
    if (!DEV_MODE && state.ink < ENERGY_BUY_COST) { toast('成长点不足 ' + ENERGY_BUY_COST); sfx('deny'); return; }
    energyBuyDialog = true;
    sfx('tap');
    var ov = mk('div', 'stat-dialog');
    ov.innerHTML = '<div class="stat-dialog-card">' +
      '<div class="stat-dialog-mark">⚡</div><h3>补给精力</h3>' +
      '<section class="stat-dialog-explain"><p>花费 <b>' + ENERGY_BUY_COST + '</b> 成长点兑换 <b>1</b> 点精力。<br>今日还可兑换 <b>' + energyBuyLeft() + '</b> 次。</p></section>' +
      '<div class="draw-confirm-actions"><button class="btn draw-confirm-no">取消</button><button class="btn primary draw-confirm-yes">确定</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    function close() {
      energyBuyDialog = false;
      ov.classList.add('out');
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 190);
    }
    ov.querySelector('.draw-confirm-no').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };
    ov.querySelector('.draw-confirm-yes').onclick = function () {
      close();
      energyBuy();
    };
  }
  function energyBuy() {
    if (energyNow() >= MAX_ENERGY) { toast('精力已满'); sfx('deny'); return; }
    if (energyBuyLeft() <= 0) { toast('今日兑换次数已用完'); sfx('deny'); return; }
    if (!DEV_MODE && state.ink < ENERGY_BUY_COST) { toast('成长点不足 ' + ENERGY_BUY_COST); sfx('deny'); return; }
    if (!DEV_MODE) state.ink -= ENERGY_BUY_COST;
    state.quota.energyDay.bought = (state.quota.energyDay.bought || 0) + 1;
    var e = energyOf();
    var before = e.n;
    e.n = Math.min(MAX_ENERGY, e.n + 1);
    save();
    refreshCounts();
    renderEnergy();
    playEnergyGain(before);
    sfx('claim');
  }
  function playEnergyGain(from) {
    var bar = $('energyBar'), pips = $('energyPips');
    if (!bar || !pips) return;
    bar.classList.remove('en-gain');
    void bar.offsetWidth;
    bar.classList.add('en-gain');
    var slot = pips.children[from];
    if (slot) {
      slot.classList.add('pop');
      setTimeout(function () { slot.classList.remove('pop'); }, 520);
    }
    var fx = mk('span', 'en-fx');
    fx.textContent = '+1';
    bar.appendChild(fx);
    setTimeout(function () { if (fx.parentNode) fx.parentNode.removeChild(fx); }, 700);
    setTimeout(function () { bar.classList.remove('en-gain'); }, 600);
  }
  var energyTimer = null;
  var energyPipN = -1;
  function renderEnergy() {
    var bar = $('energyBar');
    if (!bar) return;
    var n = energyNow(), timer = $('energyTimer'), buy = $('energyBuy');
    var pips = $('energyPips');
    var ms = energyNextMs();
    var pct = ms > 0 ? Math.max(0, Math.min(100, (1 - ms / ENERGY_REGEN_MS) * 100)) : 0;
    if (pips) {
      if (energyPipN !== n || pips.children.length !== MAX_ENERGY) {
        energyPipN = n;
        var html = '';
        for (var i = 0; i < MAX_ENERGY; i++) {
          if (i < n) html += '<i class="on"></i>';
          else if (i === n && ms > 0) html += '<i class="regen"><b></b></i>';
          else html += '<i></i>';
        }
        pips.innerHTML = html;
      }
      var regen = pips.querySelector('.regen b');
      if (ms > 0 && regen) regen.style.width = pct.toFixed(1) + '%';
    }
    bar.classList.toggle('low', n <= 0);
    bar.classList.toggle('full', n >= MAX_ENERGY);
    if (timer) {
      if (ms <= 0) {
        timer.hidden = true;
        timer.textContent = '';
      } else {
        var s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
        timer.hidden = false;
        timer.textContent = m + ':' + ('0' + (s % 60)).slice(-2);
      }
    }
    if (buy) {
      var left = energyBuyLeft();
      var can = n < MAX_ENERGY && left > 0;
      buy.hidden = n >= MAX_ENERGY;
      buy.disabled = !can;
      buy.textContent = '+';
      buy.title = can
        ? ('花费 ' + ENERGY_BUY_COST + ' 成长点兑换 1 点精力（今日剩 ' + left + ' 次）')
        : (n >= MAX_ENERGY ? '精力已满' : '今日补给已用完');
    }
    // 精力变化时同步出发钮与「精力不足」提示（避免每秒重绘整块）
    if (!expPick || !BY_WORD[expPick]) return;
    var btn = $('expStart'), info = $('expPickInfo');
    if (!btn || !info) return;
    var lack = n <= 0, hasWarn = !!info.querySelector('.ep-warn');
    if (lack !== hasWarn) syncExpDock(BY_WORD[expPick]);
    else {
      btn.disabled = lack;
      btn.classList.toggle('ready', !lack);
    }
  }
  function startEnergyTimer() {
    if (energyTimer) return;
    energyTimer = setInterval(function () {
      var v = $('screenExpedition');
      if (v && v.classList.contains('on')) renderEnergy();
    }, 1000);
  }
  // 默写第 3 次换 1 点精力（满槽时不累计，避免浪费）
  function grantBattleBonus() {
    var t = todayStr();
    if (state.quota.d !== t) state.quota = { d: t, used: 0, bonus: 0, battleUsed: 0, battleBonus: 0 };
    if ((state.quota.battleBonus || 0) >= BONUS_CAP) return false;
    var e = energyOf();
    if (energyNow() >= MAX_ENERGY) return false;
    state.quota.battleBonus = (state.quota.battleBonus || 0) + 1;
    e.n = Math.min(MAX_ENERGY, e.n + 1);
    save();
    renderBattleQuota();
    return true;
  }
  function quotaUse() {
    quotaLeft();
    state.quota.used++;
    // 当天配额抽到见底：只按「天」计一次
    if (quotaLeft() === 0) {
      var s = state.stats = state.stats || {}, t = todayStr();
      if (s.quotaD !== t) { s.quotaD = t; s.quotaFull = (s.quotaFull || 0) + 1; }
    }
    save();
    renderQuota();
  }
  function grantBonus() {
    var t = todayStr();
    if (state.quota.d !== t) state.quota = { d: t, used: 0, bonus: 0, battleUsed: 0, battleBonus: 0 };
    if (state.quota.bonus >= BONUS_CAP) return false;
    state.quota.bonus++;
    save();
    renderQuota();
    return true;
  }
  function renderQuota() {
    var n = quotaLeft();
    var el = $('drawQuota');
    if (el) el.textContent = DEV_MODE ? '∞' : n;
    renderDrawBtn();
    updateDailyBrief();
  }
  // 今日次数用完时隐藏「再来一组」按钮
  function renderDrawBtn() {
    var btn = $('btnDraw');
    if (!btn || busy) return;
    var total = FREE_PER_DAY + (state.quota.bonus || 0);
    var used = Math.min(state.quota.used || 0, total);
    var ok = quotaLeft() > 0;
    btn.style.display = '';
    btn.textContent = ok ? '再 来 一 组（' + used + '/' + total + '）' : '今天抽完了（' + total + '/' + total + '）';
    btn.disabled = !ok;
  }
  function renderBattleQuota() {
    renderEnergy();
  }
  /* 每日漫游成长点收益递减：前 3 局全额，4~6 局 60%，7~10 局 30%，之后只留一成。
     和默写的递减规则一致 —— 精力负责「一次别刷太久」，
     递减负责「一天别刷太多」，两层一起才锁得住养成节奏。 */
  function battleInkMul() {
    var t = todayStr();
    if (state.quota.d !== t) return 1;
    var n = state.quota.battleUsed || 0;
    if (n < 3) return 1;
    if (n < 6) return 0.6;
    if (n < 10) return 0.3;
    return 0.1;
  }
  function updateDailyBrief() {
    var el = $('dailyBrief');
    if (!el) return;
    var g = (state.day && state.day.g) || { spell: 0, review: 0, battle: 0 };
    var claimed = (state.day && state.day.claimed) || {};
    var done = 0, ready = 0, pills = '';
    for (var i = 0; i < DAILY_TASKS.length; i++) {
      var t = DAILY_TASKS[i];
      var cur = Math.min(g[t.id] || 0, t.need);
      var ok = cur >= t.need;
      var rd = ok && !claimed[t.id];
      if (ok) done++;
      if (rd) ready++;
      pills += '<span class="tc-pill' + (ok ? ' ok' : '') + (rd ? ' ready' : '') + '">' +
        '<span class="tc-ico" style="--p:' + Math.round(cur / t.need * 100) + '">' + taskIco(t.ico) + '</span>' +
        '<span class="tc-lab">' + t.short + '<b>' + (ok ? '✓' : cur + '/' + t.need) + '</b></span></span>';
    }
    el.textContent = done + '/' + DAILY_TASKS.length;
    var list = $('dailyPills');
    if (list) list.innerHTML = pills;
    var all = done >= DAILY_TASKS.length && !ready;
    var row = $('btnDaily');
    if (row) {
      row.classList.toggle('done', all);
      row.classList.toggle('has-ready', ready > 0);
    }
    var r = row && row.querySelector('.tc-go');
    if (r) r.textContent = ready ? '领取 ' + ready + ' ›' : all ? '已完成' : '去完成 ›';
  }

  /* ── 抽卡 ─────────────────────────────────────── */
  var HIDDEN_RATE = 0.003; // 隐藏款：只能抽到，等级上限 6
  if (DEV_MODE && /[?&]hid\b/.test(location.search)) HIDDEN_RATE = 1;

  /* 出卡时的初始字母等级：低等级为主，高等级只是小概率惊喜。
     再用稀有度封顶，避免开出一张 UR 就直接接近满级。 */
  var START_LV_W = [55, 27, 12, 5, 0.9, 0.1]; // Lv1~Lv6 的权重（合计 100）
  var START_LV_CAP = { 1: 2, 2: 3, 3: 4, 4: 4, 5: 5, 6: 6 }; // 稀有度 → 最高初始等级
  function rollStartLv(tier) {
    var r = Math.random() * 100, acc = 0, lv = 1;
    for (var i = 0; i < START_LV_W.length; i++) {
      acc += START_LV_W[i];
      if (r < acc) { lv = i + 1; break; }
    }
    return Math.min(lv, START_LV_CAP[tier] || 2);
  }

  // 单词等概率抽取；超长单词（10 个字母以上）不进卡池，卡面放不下也难记
  var MAX_WORD_LEN = 10;
  var DRAW_THEMES = {
    all: { nm: '万象', short: '万象', sub: '全部词卡', tags: null },
    wild: { nm: '自然奇境', short: '自然', sub: '草木 · 天象 · 生灵', tags: ['nature', 'sky', 'beast'] },
    life: { nm: '人间烟火', short: '烟火', sub: '居所 · 人物 · 饮馔', tags: ['place', 'people', 'food', 'object'] },
    mind: { nm: '心智工坊', short: '心智', sub: '学术 · 机巧 · 动静', tags: ['study', 'tech', 'motion'] },
    mood: { nm: '光影心绪', short: '光影', sub: '光影 · 声籁 · 时序', tags: ['light', 'feeling', 'sound', 'time'] }
  };

  /* ── 词池进度门控 ─────────────────────────────────────
     不再一次性开放 1900 词：那样 30 天只能收集到 7%，图鉴永远填不满，
     而且「新词」被稀释得毫无存在感。现在两层门一起控：
       1) 稀有度门：通晓 0 / 60 / 150 词时依次放开 SSR / UR
       2) 章节门：词库按 150 词一节，开局 4 节（约 600 词），每通晓 50 词再开 1 节
     开局可抽约 510 词，30 天约收集 150 个新词（30%），
     剩下的词留作长期目标；重复主要来自主动设计的 30% 复习池。 */
  var CHAPTER_SIZE = 150;
  var CHAPTER_START = 4;
  var CHAPTER_PER = 50;
  var POOL_GATES = [
    { need: 0, max: 3 },    // 常本 + 藏本 + 稀见
    { need: 60, max: 4 },   // + 秘典
    { need: 150, max: 5 }   // + 孤本 / 隐藏
  ];
  function masteredTotal() {
    var n = 0;
    for (var k in state.owned) {
      if (BY_WORD[k] && starsOf(BY_WORD[k]) >= 3) n++;
    }
    return n;
  }
  function poolMaxTier() {
    var m = masteredTotal(), t = 1;
    for (var i = 0; i < POOL_GATES.length; i++) if (m >= POOL_GATES[i].need) t = POOL_GATES[i].max;
    return t;
  }
  function poolCount() {
    var ch = CHAPTER_START + Math.floor(masteredTotal() / CHAPTER_PER);
    return Math.min(WORDS.length, ch * CHAPTER_SIZE);
  }
  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function drawThemeWords() {
    var theme = DRAW_THEMES[state.drawTheme] || DRAW_THEMES.all;
    var maxT = poolMaxTier(), range = poolCount();
    return WORDS.slice(0, range).filter(function (w) {
      if (w.w.length > MAX_WORD_LEN) return false;
      if ((w.tier || 1) > maxT) return false;
      if (!theme.tags) return true;
      if (theme.tags.indexOf(w.tag) >= 0) return true;
      // basic / rare 不属于任何主题，固定混入三分之一，
      // 避免选主题后池子只剩一百多词、重复率暴涨
      return (w.tag === 'basic' || w.tag === 'rare') && hashStr(w.w) % 3 === 0;
    });
  }
  function poolWords() {
    return drawThemeWords();
  }
  // 抽词稀有度权重：档位总权重固定，档位内均分，
  // 这样词多的档位不会被稀释，UR 依然真的是孤本。
  var WORD_TIER_W = { 1: 480, 2: 280, 3: 160, 4: 66, 5: 16 };
  /* 新手好运：前 18 抽（约 6 组）把高稀有度权重逐步放大，之后回到正常概率。
     新用户开局连抽 N 卡第一眼就没有惊喜，这里让他先吃到几张好卡。 */
  var LUCK_DRAWS = 18;
  function luckMul(t) {
    if (t <= 1) return 1;
    var n = state.draws || 0;
    if (n >= LUCK_DRAWS) return 1;
    var k = 1 - n / LUCK_DRAWS;                                  // 1 → 0
    var extra = { 2: 1.6, 3: 1.2, 4: 0.8, 5: 0.6 }[t] || 0;
    return 1 + extra * k;
  }
  function pickWeighted(pool) {
    var cnt = {}, tot = 0, i;
    for (i = 0; i < pool.length; i++) { var t = pool[i].tier || 1; cnt[t] = (cnt[t] || 0) + 1; }
    var per = {};
    for (var k in cnt) per[k] = (WORD_TIER_W[k] || 1) * luckMul(+k) / cnt[k];
    for (i = 0; i < pool.length; i++) tot += per[pool[i].tier || 1];
    var r = Math.random() * tot;
    for (i = 0; i < pool.length; i++) {
      r -= per[pool[i].tier || 1];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
  // 新词池：优先从「还没拥有」的词里抽，抽不到才退回全池
  function drawWord(exclude, minTier) {
    var all = drawThemeWords();
    function ok(w) {
      return state.recent.indexOf(w.w) < 0 && (!exclude || exclude.indexOf(w.w) < 0);
    }
    var pool = all.filter(function (w) { return ok(w) && !state.owned[w.w]; });
    if (minTier) {
      var hi = pool.filter(function (w) { return (w.tier || 1) >= minTier; });
      if (hi.length) pool = hi;
    }
    if (!pool.length) pool = all.filter(ok);
    if (!pool.length) pool = poolWords();
    return pickWeighted(pool);
  }
  // 隐藏款独立判定，命中后从最高稀有度的词里出，不受稀有度解锁门限制
  function drawHiddenWord(exclude) {
    var maxT = 1;
    WORDS.forEach(function (w) { maxT = Math.max(maxT, w.tier || 1); });
    var pool = WORDS.filter(function (w) {
      return (w.tier || 1) === maxT && w.w.length <= MAX_WORD_LEN && (!exclude || exclude.indexOf(w.w) < 0);
    });
    var fresh = pool.filter(function (w) { return !(state.owned[w.w] && state.owned[w.w].hid); });
    if (fresh.length) pool = fresh;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }
  /* 复习池：已拥有、最近没抽过、且「到期未复习」或「还没 3 星」的词。
     抽到复习卡会给额外熟练度，让「再见到熟悉的词」变成复习收益而不是浪费名额。 */
  function drawReviewWord(exclude) {
    var cand = [];
    for (var k in state.owned) {
      var w = BY_WORD[k];
      if (!w || w.w.length > MAX_WORD_LEN) continue;
      if (state.recent.indexOf(k) >= 0) continue;
      if (exclude && exclude.indexOf(k) >= 0) continue;
      if ((w.tier || 1) > poolMaxTier()) continue;
      cand.push(w);
    }
    if (!cand.length) return null;
    // 到期的排前面，其次是星级低的
    cand.sort(function (a, b) {
      var da = reviewDue(a) ? 0 : 1, db = reviewDue(b) ? 0 : 1;
      if (da !== db) return da - db;
      return starsOf(a) - starsOf(b);
    });
    var top = cand.slice(0, Math.max(1, Math.ceil(cand.length * 0.35)));
    return top[(Math.random() * top.length) | 0];
  }
  function renderDrawThemes() {
    var box = $('drawThemes');
    if (!box) return;
    var html = '';
    Object.keys(DRAW_THEMES).forEach(function (id) {
      var t = DRAW_THEMES[id], B = Card.BACK_THEMES[id] || Card.BACK_THEMES.all;
      html += '<button type="button" class="draw-theme' + (state.drawTheme === id ? ' on' : '') +
        '" data-theme="' + id + '" aria-label="' + t.nm + '" style="--th:' + B.foil + ';--th-rgb:' + B.rgb + '">' +
        Card.sigilIcon(id) + '<b>' + t.short + '</b></button>';
    });
    box.innerHTML = html;
    var desc = $('drawThemeDesc');
    if (desc) {
      var active = DRAW_THEMES[state.drawTheme] || DRAW_THEMES.all;
      desc.innerHTML = '<b>' + active.nm + '</b><span>' + active.sub + ' · 本阶段可抽 ' + drawThemeWords().length + ' 词</span>';
    }
    box.querySelectorAll('[data-theme]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-theme');
        if (id === state.drawTheme || (busy && !reskinTimers.length)) return;
        state.drawTheme = id;
        save();
        renderDrawThemes();
        sfx('theme', id);
        reskinPile();
      };
    });
  }

  // 切换卡池：还没翻开的牌按新主题重抽单词（稀有度不变），并翻面换上新牌背
  // 换背动画可被下一次切换打断，其余动画期间仍锁定
  var reskinTimers = [];
  function reskinPile() {
    if (!pileWrap) return;
    var interrupted = reskinTimers.length > 0;
    reskinTimers.forEach(clearTimeout);
    reskinTimers = [];
    var pile = stage.querySelector('.pile');
    var items = pile ? pile.querySelectorAll('.pile-card') : [];
    var idx = [];
    pileWrap.states.forEach(function (s, i) { if (s === 'back' && items[i]) idx.push(i); });
    if (!idx.length) {
      if (interrupted) { if (pile) pile.classList.remove('reskin'); busy = false; }
      return;
    }
    var keep = pileWrap.picks.map(function (p, i) { return idx.indexOf(i) < 0 ? p.w.w : null; }).filter(Boolean);
    idx.forEach(function (i) {
      var w = drawWord(keep);
      keep.push(w.w);
      pileWrap.picks[i].w = w;
      pileWrap.picks[i].th = state.drawTheme;
      pileWrap.picks[i].lv = rollStartLv(w.tier || 1);
      pileWrap.picks[i].rev = false;
    });
    busy = true;
    pile.classList.add('reskin');
    var B = Card.BACK_THEMES[state.drawTheme] || Card.BACK_THEMES.all;
    idx.forEach(function (i, k) {
      var item = items[i];
      item.style.setProperty('--i', k);
      var stale = item.querySelector('.rev-tag');
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      item.style.setProperty('--bk-glow', B.foil);
      item.classList.remove('rs-in', 'rs-out');
      void item.offsetWidth;
      item.classList.add('rs-out');
      reskinTimers.push(setTimeout(function () {
        var old = item.querySelector('.card');
        var node = Card.renderBack(pileWrap.picks[i].lv, state.drawTheme);
        node.style.transform = old ? old.style.transform : '';
        if (old) item.replaceChild(node, old); else item.appendChild(node);
        item.classList.remove('rs-out');
        item.classList.add('rs-in');
        sfx('flick', k);
      }, 200 + k * 60));
    });
    reskinTimers.push(setTimeout(function () {
      pile.classList.remove('reskin');
      for (var j = 0; j < items.length; j++) items[j].classList.remove('rs-in');
      reskinTimers = [];
      busy = false;
    }, 200 + idx.length * 60 + 440));
  }

  /* 每批抽卡：70% 新词 + 30% 复习。
     复习只会落在「已拥有」的词上，并额外给熟练度，
     这样重复卡不是浪费名额，而是把复习安排进抽卡流程。
     同时保证每组至少 1 张新词（新词池抽空后自动取消保底）。 */
  var REVIEW_RATE = 0.3;
  function rollBatch(n) {
    var picks = [], names = [];
    for (var i = 0; i < n; i++) {
      var hw = Math.random() < HIDDEN_RATE ? drawHiddenWord(names) : null;
      var rv = !hw && Math.random() < REVIEW_RATE ? drawReviewWord(names) : null;
      var w = hw || rv || drawWord(names);
      var hid = !!hw;
      // 复习卡按卡片当前等级展示；新词走初始等级随机
      var startLv = rv ? ((state.owned[w.w] && state.owned[w.w].cl) || 1) : rollStartLv(w.tier || 1);
      picks.push({
        w: w, lv: hid ? 5 : startLv, hid: hid,
        rev: !!rv, th: state.drawTheme,
      });
      names.push(w.w);
    }
    // 新词保底：整组全是复习卡时，换一张新词进来
    var hasNew = picks.some(function (p) { return !p.rev; });
    if (!hasNew) {
      var fresh = drawWord(names);
      if (fresh && !state.owned[fresh.w]) {
        var p0 = picks[0];
        picks[0] = { w: fresh, lv: rollStartLv(fresh.tier || 1), hid: false, rev: false, th: p0.th };
        names[0] = fresh.w;
      }
    }
    // 新手保底：前两组里至少出现一张 SR 及以上，别让开局的六张全是 N 卡
    if (state.draws < n * 2) {
      var best = 0;
      for (var j = 0; j < picks.length; j++) best = Math.max(best, picks[j].w.tier || 1);
      if (best < 3) {
        var top = drawWord(names, 3), last = picks[n - 1];
        picks[n - 1] = { w: top, lv: Math.max(last.lv, 3), hid: last.hid, rev: false, th: last.th };
        names[n - 1] = top.w;
      }
    }
    return picks;
  }

  // 返回本次重复转化的成长点数
  function collect(p) {
    var w = p.w, o = state.owned[w.w];
    state.draws++;
    if (!p.rev) noteDrawTier(w, p.hid);   // 复习卡不算新抽，不参与「非酋」连击
    // 「念念不忘」：放弃后 60 秒内又抽回同一张
    var s = state.stats = state.stats || {};
    if (s.abW === w.w && Date.now() - (s.abAt || 0) < 60000) { s.abBack = (s.abBack || 0) + 1; s.abW = ''; }
    state.recent.push(w.w);
    if (state.recent.length > 10) state.recent.shift();
    if (!o) {
      state.owned[w.w] = {
        m: 0, at: Date.now(), cl: p.lv, hid: p.hid,
        lv: w.w.split('').map(function () { return p.lv; }),
      };
      return 0;
    }
    // 隐藏款：重复抽到可以点亮 EX，但等级不再被顶上去
    if (p.hid && !o.hid) { o.hid = true; return 0; }
    // 重复卡只转化为成长点，等级一律靠养成；
    // 复习池抽到自己练过的卡时，按卡片当前等级给，练得越多回收越多
    var got = DUP_INK[p.rev ? (o.cl || 1) : p.lv] || 6;
    state.ink += got;
    state.stats = state.stats || {};
    state.stats.dup = (state.stats.dup || 0) + 1;
    return got;
  }
  // 抽卡时的「非酋 / 欧皇」连击：高品阶（SSR+ 或隐藏）就清零
  function noteDrawTier(w, hid) {
    var s = state.stats = state.stats || {};
    if (hid || (w && w.tier >= 4)) {
      s.dry = 0;
      if (hid) s.gotHid = (s.gotHid || 0) + 1;
    } else {
      s.dry = (s.dry || 0) + 1;
      if (s.dry > (s.dryBest || 0)) s.dryBest = s.dry;
    }
  }
  // 漫游结算：无伤 / 不放大招 / 用时 / 连续胜负等统计
  function noteRun(info) {
    if (!info) return;
    var s = state.stats = state.stats || {};
    if (info.win) {
      s.cw = (s.cw || 0) + 1;
      s.cl = 0;
      if (s.cw > (s.cwBest || 0)) s.cwBest = s.cw;
      if (info.nohit) s.nohit = (s.nohit || 0) + 1;
      if (info.noUlt) s.noult = (s.noult || 0) + 1;
      if (info.bossT > 0 && (!s.bossTS || info.bossT < s.bossTS)) s.bossTS = info.bossT;
      if (info.time > 0 && (!s.runTS || info.time < s.runTS)) s.runTS = info.time;
    } else {
      s.cl = (s.cl || 0) + 1;
      s.cw = 0;
      if (s.cl > (s.clBest || 0)) s.clBest = s.cl;
    }
    if ((info.kills || 0) > (s.killBest || 0)) s.killBest = info.kills;
    if ((info.words || 0) > (s.wordsBest || 0)) s.wordsBest = info.words;
  }
  function rec(w) { return state.owned[w.w] || { m: 0, at: 0 }; }

  /* ── 卡片等级 / 字母等级 / 成长点 ───────────────── */
  function cardLvOf(w) { var o = state.owned[w.w]; return o ? (o.cl || 1) : 0; }
  function capOf(w) { var o = state.owned[w.w]; return o && o.hid ? 6 : 5; }
  // 带卡片等级的展示对象，供渲染 / 战斗使用
  function viewOf(w) {
    var o = state.owned[w.w];
    if (!o) return w;
    return Object.assign({}, w, { lvl: o.cl || 1, cardLv: o.cl || 1, hid: !!o.hid });
  }
  function levelsOf(w) {
    var o = state.owned[w.w];
    if (!o) return null;
    if (!o.lv || o.lv.length !== w.w.length) o.lv = w.w.split('').map(function () { return o.cl || 1; });
    return o.lv;
  }
  /* 养成只有一个动作：花成长点升级字母。
     卡片等级 = 所有字母的最低等级（自动提升）；
     成本按等级指数增长（8 / 26 / 52 / 84 / 123 / 168），避免一张卡两三天就满级；
     熟练度只卡高等级：Lv3 起需 2 阶，Lv5 起需 3 阶 */
  function upgradeCost(lv) { return Math.round(8 * Math.pow(lv, 1.7)); }
  function stageNeedFor(lv) { return lv >= 5 ? 2 : lv >= 3 ? 1 : 0; }
  function upgradeLetter(w, i) {
    var lv = levelsOf(w), o = state.owned[w.w];
    if (!lv) return false;
    if (lv[i] >= capOf(w)) { toast('已满级'); sfx('deny'); return false; }
    var sn = stageNeedFor(lv[i] + 1);
    if (stageOf(w) < sn) {
      toast('升到 Lv' + (lv[i] + 1) + ' 需要熟练度 ' + (sn + 1) + ' 阶（还差 ' + (XP_STAGE_GATE[sn] - xpOf(w)) + ' XP）');
      sfx('deny');
      return false;
    }
    var cost = upgradeCost(lv[i]);
    if (!DEV_MODE && state.ink < cost) { toast('成长点不足，需要 ' + cost); sfx('deny'); return false; }
    if (!DEV_MODE) state.ink -= cost;
    lv[i]++;
    sfx('upgrade', lv[i]);
    // 字母覆盖：记录升级过的字母（26 个全练过的成就用）
    var st1 = state.stats = state.stats || {};
    st1.ltr = st1.ltr || {};
    var ch1 = w.w.charAt(i).toUpperCase();
    if (ch1) st1.ltr[ch1] = 1;
    var minLv = Math.min.apply(null, lv);
    var cardUp = minLv > (o.cl || 1);
    if (cardUp) o.cl = minLv;
    save();
    checkAchievementUnlocks();
    refreshCounts();
    if (cardUp) {
      toast('卡片升至 ' + (o.hid ? 'EX' : TIERS[Math.min(5, o.cl)].code) + ' · Lv ' + o.cl + '！');
      if (window.FX && FX.sprinkle) FX.sprinkle(30, Math.min(5, o.cl));
    } else {
      toast(w.w.charAt(i).toUpperCase() + ' 升至 Lv ' + lv[i] + '　·　卡片升级还差 ' +
        lv.filter(function (x) { return x <= minLv; }).length + ' 个字母');
    }
    return true;
  }

  function refreshCounts() {
    var owned = 0, mastered = 0;
    for (var k in state.owned) {
      owned++;
      if (BY_WORD[k] && starsOf(BY_WORD[k]) >= 3) mastered++;
    }
    var map = { mineOwned: owned,
      mineMastered: mastered, mineInk: state.ink,
      mineStreak: state.streak || 1 };
    // 成长点峰值：成就用「曾经攒到多少」，花掉不会清零
    state.stats = state.stats || {};
    if ((state.ink || 0) > (state.stats.inkMax || 0)) state.stats.inkMax = state.ink || 0;
    for (var id in map) {
      var el = $(id);
      if (el) el.textContent = DEV_MODE && id === 'mineInk' ? '∞' : map[id];
    }
    if (typeof renderCheckin === 'function') renderCheckin();
    if (typeof renderTitle === 'function') renderTitle();
  }

  /* ── 基础 UI ──────────────────────────────────── */
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('show'); }, 1700);
  }
  var replaceDrawDialog = false;
  function askReplaceDraw() {
    if (replaceDrawDialog) return;
    replaceDrawDialog = true;
    var left = 0;
    if (pileWrap) left = pileWrap.states.filter(function (s) { return s === 'back'; }).length;
    var ov = mk('div', 'stat-dialog');
    ov.innerHTML = '<div class="stat-dialog-card">' +
      '<h3>换一组会失去当前组</h3>' +
      '<section class="stat-dialog-explain"><p>' +
        (left ? '这一组还有 <b>' + left + '</b> 张卡没翻开。' : '这一组还没抽完。') +
        '换一组等于直接放弃它们。' +
      '</p></section>' +
      '<div class="draw-confirm-actions"><button class="btn draw-confirm-no">取消</button><button class="btn danger draw-confirm-yes">确定</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    function close() {
      replaceDrawDialog = false;
      ov.classList.add('out');
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 190);
    }
    ov.querySelector('.draw-confirm-no').onclick = close;
    ov.querySelector('.draw-confirm-yes').onclick = function () {
      close();
      draw(false, true);
    };
  }
  function buzz(p) {
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {}
  }
  function mk(tag, cls) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  /* ── 抽卡流程 ─────────────────────────────────── */
  // 进入抽卡页直接翻出 3 张，不再有"卡包 → 拆封"这一步
  // silent = true 时（首次进入/刷新）不播光效，直接摆牌
  function draw(silent, replace) {
    if (busy) return;
    if (!replace && pileWrap && pileWrap.states.some(function (s) { return s === 'back'; })) {
      askReplaceDraw();
      return;
    }
    // 抽新卡前清理可能残留的拼写层，避免旧模块在换牌时短暂闪现。
    var quiz = $('quiz');
    if (quiz) quiz.classList.remove('open');
    curWrite = null;
    var cap = document.querySelector('.capw');
    if (cap && !(window.Capture && Capture.isBusy())) {
      cap.classList.remove('open', 'closing', 'dim', 'leave', 'fleeing', 'lit', 'tease-cap');
    }
    if (quotaLeft() <= 0) {
      toast('今日抽卡已用完 · 完成每日任务或漫游胜利可获得更多');
      return;
    }
    quotaUse();
    busy = true;
    if (!silent) sfx('shuffle');
    var btn = $('btnDraw');
    btn.disabled = true;
    btn.textContent = '翻 开 中';

    var picks = rollBatch(3);
    save();
    refreshCounts();

    var best = picks.reduce(function (a, b) {
      return ((b.hid ? 6 : b.lv) > (a.hid ? 6 : a.lv)) ? b : a;
    }, picks[0]);
    var bLv = best.hid ? 6 : best.lv;

    if (silent) {
      showPile(picks, bLv, false);
      return;
    }
    // 旧牌先整组收走，看起来是"把这副牌甩掉、再发一副新的"
    sweepPile(function () {
      // 再来一组不提前用特效暴露本组卡片等级，等级只在翻卡时展示。
      showPile(picks, bLv, true);
    });
  }

  // 旧牌收走：逐张向外甩出去并淡掉
  function sweepPile(done) {
    var pile = stage.querySelector('.pile');
    if (!pile) { pileWrap = null; done(); return; }
    pileWrap = null;
    pile.classList.add('sweep');
    var cards = pile.querySelectorAll('.pile-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.setProperty('--i', i);
      cards[i].classList.add('sweeping');
    }
    setTimeout(function () {
      stage.innerHTML = '';
      done();
    }, 340);
  }

  function autoDraw() {
    if (busy || pileWrap) return;
    if (quotaLeft() <= 0) {
      $('hint').textContent = '今日次数已用完 · 做每日任务换次数';
      return;
    }
    draw(true);
  }

  // 拆封后：三张卡并排，点一张就放大翻面去拼
  var pileWrap = null;

  function showPile(picks, bLv, deal) {
    pileWrap = { picks: picks, bLv: bLv, states: picks.map(function () { return 'back'; }) };
    renderPile(deal);
    busy = false;
    renderDrawBtn();
  }

  function pileScale() {
    var vw = Math.min(430, window.innerWidth || 390);
    // 三张略微叠压：单张能大一圈
    return Math.max(0.26, Math.min(0.46, (vw - 40) / (2.56 * Card.CARD_W)));
  }

  function renderPile(deal) {
    if (!pileWrap) return;
    stage.innerHTML = '';
    var kh = pileScale();
    var pile = mk('div', 'pile' + (deal ? ' dealing' : ''));
    pileWrap.picks.forEach(function (p, i) {
      var st = pileWrap.states[i];
      var item = mk('div', 'pile-card ' + (st === 'blank' ? 'blank' : st) + (deal ? ' deal' : ''));
      item.style.setProperty('--i', i);
      var cw = Math.round(Card.CARD_W * kh);
      item.style.width = cw + 'px';
      item.style.height = Math.round(Card.CARD_H * kh) + 'px';
      item.style.marginLeft = i ? -Math.round(cw * 0.22) + 'px' : '0';
      if (st === 'blank') {
        var BT = Card.BACK_THEMES[p.th] || Card.BACK_THEMES.all;
        var sn = (state.shards && state.shards[p.w.w]) || 1;
        item.style.setProperty('--th', BT.foil);
        item.style.setProperty('--th-rgb', BT.rgb);
        if (pileWrap.fresh === i) { item.classList.add('burn'); pileWrap.fresh = -1; }
        item.innerHTML =
          '<span class="bk-glyph">' + p.w.w.charAt(0).toUpperCase() + '</span>' +
          '<span class="bk-tag">FRAGMENT</span>' +
          '<span class="bk-seal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 14 9.2l7 .8-5.4 4.4 1.8 6.9L12 17.5l-5.4 3.8 1.8-6.9L3 10l7-.8z"/></svg></span>' +
          '<em>' + p.w.w + '</em>' +
          '<span class="bk-rule"></span>' +
          '<i>遗落残页' + (sn > 1 ? ' · ×' + sn : '') + '</i>' +
          '<span class="bk-ember"></span>';
      } else {
        var node;
        if (st === 'front') {
          node = Card.render(Object.assign({}, p.w, { lvl: p.lv, hid: !!p.hid }),
            { mastery: 0, levels: p.w.w.split('').map(function () { return p.lv; }) });
        } else {
          node = Card.renderBack(p.lv, p.th);
        }
        node.style.transform = 'scale(' + kh.toFixed(3) + ')';
        item.appendChild(node);
        if (p.rev) {
          var tag = mk('span', 'rev-tag');
          tag.textContent = '复习';
          item.appendChild(tag);
        }
        if (st === 'back') item.onclick = function () { openPile(i); };
      }
      pile.appendChild(item);
    });
    stage.appendChild(pile);
    if (deal) {
      pileWrap.picks.forEach(function (_, di) { setTimeout(function () { sfx('deal', di); }, 40 + di * 90); });
      setTimeout(function () {
        if (!pile.parentNode) return;
        pile.classList.remove('dealing');
        var cs = pile.querySelectorAll('.deal');
        for (var i = 0; i < cs.length; i++) cs[i].classList.remove('deal');
      }, 760);
    }
    var left = pileWrap.states.filter(function (s) { return s === 'back'; }).length;
    var noQuota = quotaLeft() <= 0;
    $('hint').textContent = left
      ? '还剩 ' + left + ' 张 · 点一张直接翻开'
      : (noQuota ? '今日抽卡次数已用完 · 去漫游继续攒词灵' : '');
    renderDrawBtn();
  }

  function openPile(i) {
    if (!pileWrap || pileWrap.states[i] !== 'back') return;
    // 上一张的弹层还在退场时不能再开，否则旧的关闭回调会把新弹层一起关掉
    if (busy || (window.Capture && Capture.isBusy())) return;
    var nodes = stage.querySelectorAll('.pile-card');
    var item = nodes[i];
    // 用未旋转的真实尺寸做共享元素基准，旋转只作为初始角度带上
    var rect = null;
    if (item) {
      var b = item.getBoundingClientRect();
      var w = item.offsetWidth, h = item.offsetHeight;
      rect = { left: b.left + b.width / 2 - w / 2, top: b.top + b.height / 2 - h / 2, width: w, height: h };
    }
    // 共享元素：带上这张卡在扇形里的旋转角，飞出去时不会突然摆正
    var deg = i === 0 ? -4 : i === 2 ? 4 : 0;
    var pick = pileWrap.picks[i];
    var bLv = pileWrap.bLv;
    busy = true;
    $('hint').textContent = pick && pick.rev ? '复习单词…' : '收服词灵…';
    // 原卡先隐形，避免"两张卡同时在"的穿帮
    if (item) item.classList.add('lifted');

    // 结算瞬间就把这一格换成正面/残页，不等动画
    function applyResult(res) {
      if (!pileWrap) return;
      var dupInk = 0, gainXp = 0;
      var st0 = state.stats = state.stats || {};
      if (res.ok) {
        dupInk = collect(res.pick);
        pileWrap.states[i] = 'front';
        if (res.quality === 'perfect') { state.ink += 5; st0.pf = (st0.pf || 0) + 1; }
        st0.fail = 0;   // 成功即中断失败连击
        // 熟练度：拼写成功才推动成长，收益受每日递减限制；复习卡额外 +8
        gainXp = addXp(pick.w, (res.quality === 'perfect' ? XP_PER_PERFECT : XP_PER_COPY) + (pick.rev ? 8 : 0));
        addDaily('spell');
        if (reviewDue(pick.w)) addDaily('review');
      } else {
        // 主动放弃不产出残页，直接放回卡池；超时/失败才留下残页线索
        if (res.quality !== 'abandoned') addShard(res.pick.w);
        else noteAbandon(pick.w, !!pick.hid);   // 主动放弃：记录次数与品阶，供成就使用
        if (res.quality === 'escaped') st0.esc = (st0.esc || 0) + 1;   // 词灵挣脱（超时）
        st0.fail = (st0.fail || 0) + 1;
        if (st0.fail > (st0.failBest || 0)) st0.failBest = st0.fail;
        pileWrap.states[i] = 'blank';
        pileWrap.fresh = i;
      }
      save();
      checkAchievementUnlocks();
      refreshCounts();
      renderQuota();
      renderPile();
      if (dupInk) toast('重复卡已转化 · 成长点 +' + dupInk);
      else if (res.ok) {
        var msg = [];
        if (res.quality === 'perfect') msg.push(pick.rev ? '完美复习' : '完美收服');
        if (gainXp > 0) msg.push('熟练度 +' + gainXp);
        else msg.push('今日收益已满 · 练习照常记录');
        toast(msg.join(' · '));
      }
    }

    try {
      Capture.run(pick, {
        rect: rect,
        rot: deg,
        onSettle: applyResult,
        onDone: function (res) {
          busy = false;
          renderQuota();
          if (item) item.classList.remove('lifted');
          buzz(bLv >= 4 ? [16, 40, 16, 40, 30] : 12);
        }
      });
    } catch (e) {
      busy = false;
      if (item) item.classList.remove('lifted');
      renderPile();
    }
  }

  function hintText(t) { var h = $('hint'); if (h) h.textContent = t; }
  function hintMsg(t) { hintText(t); }

  // 残页：逃走的词灵留下的线索
  function addShard(w) {
    state.shards = state.shards || {};
    state.shards[w.w] = (state.shards[w.w] || 0) + 1;
  }
  // 主动放弃：累计次数 + 按品阶分档，用于「首次放弃 / 放弃 N 次 / 放弃过 N 个品阶」
  function noteAbandon(w, hid) {
    var s = state.stats = state.stats || {};
    s.ab = (s.ab || 0) + 1;
    s.abT = s.abT || {};
    var t = hid ? 6 : ((w && w.tier) || 1);
    s.abT[t] = (s.abT[t] || 0) + 1;
    s.abW = w && w.w;
    s.abAt = Date.now();
  }

  function packFlash(tier, hid) {
    var lv = hid ? 6 : tier;
    sfx('reveal', lv);
    var col = hid ? '#ffb3d0' : TIERS[tier].color;
    // 暗场：等级越高压得越沉，让光效跳出来
    var veil = mk('div', 'fx-veil');
    document.body.appendChild(veil);
    setTimeout(function () {
      veil.classList.add('out');
      setTimeout(function () { veil.parentNode && veil.parentNode.removeChild(veil); }, 760);
    }, lv >= 4 ? 900 : lv >= 3 ? 620 : 380);

    var beam = mk('div', 'beam');
    document.body.appendChild(beam);
    requestAnimationFrame(function () { beam.classList.add('go'); });
    setTimeout(function () { beam.parentNode && beam.parentNode.removeChild(beam); }, 720);

    // 冲击波：等级越高层数越多，C/SR 甚至没有
    var rings = lv >= 5 ? 3 : lv >= 4 ? 2 : lv >= 3 ? 1 : 0;
    for (var i = 0; i < rings; i++) (function (i) {
      setTimeout(function () {
        var r = mk('div', 'shock' + (hid ? ' ex' : ''));
        r.style.borderColor = hid ? 'rgba(255,226,160,.9)' : TIERS[tier].foil;
        document.body.appendChild(r);
        requestAnimationFrame(function () { r.classList.add('go'); });
        setTimeout(function () { r.parentNode && r.parentNode.removeChild(r); }, 780 + i * 120);
      }, i * 150);
    })(i);

    if (lv >= 3) {
      var rays = mk('div', 'rays');
      rays.style.background =
        'repeating-conic-gradient(from 0deg, ' + col + '00 0deg 6deg, ' + col + '99 6deg 7.6deg)';
      document.body.appendChild(rays);
      requestAnimationFrame(function () { rays.classList.add('go'); });
      setTimeout(function () { rays.parentNode && rays.parentNode.removeChild(rays); }, lv >= 5 ? 2600 : 1700);
    }
    // EX：反方向再叠一层彩虹放射
    if (lv >= 6) {
      var ex = mk('div', 'rays ex');
      document.body.appendChild(ex);
      requestAnimationFrame(function () { ex.classList.add('go'); });
      setTimeout(function () { ex.parentNode && ex.parentNode.removeChild(ex); }, 3000);
    }
    if (lv >= 4) {
      var b = mk('div', 'banner' + (hid ? ' ex' : ''));
      b.style.color = hid ? '#ffe6a8' : TIERS[tier].foil;
      b.textContent = hid ? 'EX · 隐藏款' : TIERS[tier].code + ' · ' + TIERS[tier].name;
      document.body.appendChild(b);
      setTimeout(function () { b.parentNode && b.parentNode.removeChild(b); }, 1900);
    }
    // LR / EX：全场扫光
    if (lv >= 5) {
      var fl = mk('div', 'screenflash');
      document.body.appendChild(fl);
      setTimeout(function () { fl.parentNode && fl.parentNode.removeChild(fl); }, 900);
    }
  }

  /* 一张可翻面的卡：背面先出，点击翻正面 */
  function makeFlipper(w) {
    var flip = mk('div', 'flipper');
    flip.style.width = Card.CARD_W + 'px';
    flip.style.height = Card.CARD_H + 'px';

    var backFace = mk('div', 'face back');
    backFace.appendChild(Card.renderBack(w.tier));

    var frontFace = mk('div', 'face front');
    var card = Card.render(w, { mastery: starsOf(w), levels: levelsOf(w) });
    frontFace.appendChild(card);

    flip.appendChild(backFace);
    flip.appendChild(frontFace);
    flip._word = w;
    flip._flipped = false;
    flip.onclick = function () { flipCard(flip); };
    return flip;
  }

  function flipCard(flip) {
    if (flip._flipped) {
      openDetail(flip._word);
      return;
    }
    flip._flipped = true;
    flip.classList.add('flipped');
    var w = flip._word;
    var lv = w.hid ? 6 : w.tier;
    sfx('flip', 420);
    if (lv < 5) sfx('reveal', lv);
    var r = flip.getBoundingClientRect();
    FX.burst(lv, {
      x: r.left + r.width / 2, y: r.top + r.height * 0.4,
      count: lv >= 6 ? 150 : lv >= 5 ? 100 : lv >= 4 ? 64 : lv >= 3 ? 40 : 22,
    });
    if (lv >= 4) {
      var sh = mk('div', 'shock' + (w.hid ? ' ex' : ''));
      sh.style.borderColor = w.hid ? 'rgba(255,226,160,.9)' : TIERS[w.tier].foil;
      document.body.appendChild(sh);
      requestAnimationFrame(function () { sh.classList.add('go'); });
      setTimeout(function () { sh.parentNode && sh.parentNode.removeChild(sh); }, 800);
    }
    if (lv >= 5) packFlash(w.tier, w.hid);
    buzz(lv >= 4 ? [12, 30, 12] : 8);
    updateHint();
  }

  function showDeck(picks) {
    deckWords = picks;
    stage.innerHTML = '';
    deckEl = mk('div', 'deck');
    picks.forEach(function (w, i) {
      var slide = mk('div', 'slide' + (i === 0 ? ' on' : ''));
      slide.appendChild(makeFlipper(w));
      var tl = mk('div', 'tagline');
      tl.textContent = '· · ·';
      slide.appendChild(tl);
      deckEl.appendChild(slide);
    });
    stage.appendChild(deckEl);
    deckEl.addEventListener('scroll', onDeckScroll, { passive: true });

    activeIdx = 0;
    setTimeout(function () { syncDeckIndex(); }, 70);
  }

  function onDeckScroll() {
    if (!deckEl) return;
    var center = deckEl.scrollLeft + deckEl.clientWidth / 2;
    var slides = deckEl.children, idx = 0, best = Infinity;
    for (var i = 0; i < slides.length; i++) {
      var d = Math.abs(slides[i].offsetLeft + slides[i].offsetWidth / 2 - center);
      if (d < best) { best = d; idx = i; }
    }
    if (idx !== activeIdx) {
      activeIdx = idx;
      syncDeckIndex();
    }
  }

  function syncDeckIndex() {
    if (!deckEl) return;
    var slides = deckEl.children;
    for (var i = 0; i < slides.length; i++) slides[i].classList.toggle('on', i === activeIdx);
    updateHint();
  }

  function updateHint() {
    if (!deckEl) return;
    var slide = deckEl.children[activeIdx];
    if (!slide) return;
    var flip = slide.querySelector('.flipper');
    var w = flip && flip._word;
    if (!w) return;
    var tl = slide.querySelector('.tagline');
    if (flip._flipped) {
      if (tl) tl.textContent = TIERS[w.tier].code + ' · ' + TIERS[w.tier].name + ' · ' + (TAGS[w.tag] || '');
    }
    $('hint').textContent = (activeIdx + 1) + ' / ' + deckWords.length + ' · ' +
      (TAGS[w.tag] || '') + ' · 默写 ' + recRead(w).wr + '/' + needOf(w) +
      (flip._flipped ? ' · 点卡片看详情' : ' · 点卡片翻面');
  }

  /* ── 主界面 Tab ───────────────────────────────── */
  var SCREENS = { draw: 'screenDraw', expedition: 'screenExpedition', mine: 'screenMine' };
  var curTab = 'draw';

  function switchTab(name) {
    if (!SCREENS[name]) return;
    if (curTab !== name) sfx('tab');
    curTab = name;
    for (var k in SCREENS) {
      var s = $(SCREENS[k]);
      if (s) s.classList.toggle('on', k === name);
    }
    var tabs = document.querySelectorAll('#tabbar .tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === name);
    }
    if (name === 'expedition') renderExpedition();
    else pauseHangarPreview();
    if (name === 'mine') renderMine();
    if (name === 'draw') { refreshCounts(); renderQuota(); updateDailyBrief(); autoDraw(); }
  }

  /* ── 漫游页 ───────────────────────────────────── */
  var expPick = null;
  var expRenderToken = 0;
  var expKinds = [];   // 出战选卡的属性筛选，最多 2 个

  // 等级优先，同级按最近获得
  function expPool() {
    var list = [];
    for (var i = 0; i < WORDS.length; i++) {
      if (state.owned[WORDS[i].w]) list.push(viewOf(WORDS[i]));
    }
    list.sort(function (a, b) {
      return (b.hid ? 1 : 0) - (a.hid ? 1 : 0) || (b.lvl || 1) - (a.lvl || 1) || (rec(b).at || 0) - (rec(a).at || 0);
    });
    return list;
  }

  // 真实卡面缩略图：整张卡等比缩小
  function cardThumb(w, width) {
    var scale = width / Card.CARD_W;
    var box = mk('div', 'cthumb');
    box.style.width = width + 'px';
    box.style.height = Math.round(Card.CARD_H * scale) + 'px';
    // 圆角跟着缩放走，否则和外框对不上会被切掉
    box.style.borderRadius = Math.max(3, Math.round(16 * scale)) + 'px';
    // 缩到 220 以下用紧凑版：关键数据（等级 / 稀有度 / 武器 / 单词）放大
    var inner = Card.render(w, { mastery: starsOf(w), levels: levelsOf(w), compact: width < 220, lite: true });
    inner.classList.add('cthumb-in');
    inner.style.transform = 'scale(' + scale + ')';
    box.appendChild(inner);
    return box;
  }

  function syncExpDock(w) {
    var btn = $('expStart');
    var info = $('expPickInfo');
    var pick = $('expPickBtn');
    if (!btn || !info) return;
    var lack = battleQuotaLeft() <= 0;
    if (!w) {
      btn.disabled = true;
      btn.classList.remove('ready');
      if (pick) pick.classList.add('empty');
      info.innerHTML = '<span class="ep-empty">选择出战词卡</span>';
      return;
    }
    if (pick) pick.classList.remove('empty');
    btn.disabled = lack;
    btn.classList.toggle('ready', !lack);
    var lv = levelsOf(w);
    var wk = Card.weaponKinds ? Card.weaponKinds(w, lv) : null;
    var pp = Card.powerParts ? Card.powerParts(w, lv) : null;
    var cn = String(w.cn || '').split(/[；;]/)[0].trim();
    if (cn.length > 14) cn = cn.slice(0, 14) + '…';
    var chip = function (tag, k) {
      return '<i class="ep-chip" style="--c:' + Card.KINDS[k].c + '"><em>' + tag + '</em>' + Card.KINDS[k].nm + '</i>';
    };
    info.innerHTML =
      '<b class="ep-word">' + w.w + '</b>' +
      (cn ? '<span class="ep-cn">' + cn + '</span>' : '') +
      '<span class="ep-foot">' +
        (wk ? '<span class="ep-chips">' + chip('主', wk.main) + (wk.sub ? chip('副', wk.sub) : '') + '</span>' : '<span class="ep-chips"></span>') +
        (pp ? '<i class="ep-pow"><em>战力</em>' + pp.total + '</i>' : '') +
      '</span>' +
      (lack ? '<span class="ep-warn">精力不足</span>' : '');
  }

  function renderRegionStrip() {
    var strip = $('regionStrip');
    if (!strip) {
      strip = mk('div', 'region-strip');
      strip.id = 'regionStrip';
      var map = $('expMap');
      if (!map) return;
      map.insertBefore(strip, map.firstChild);
    }
    if (!state.region) state.region = REGIONS[0].id;
    strip.innerHTML = '';
    REGIONS.forEach(function (r) {
      var open = regionUnlocked(r);
      var on = state.region === r.id;
      var b = mk('button', 'region' + (on ? ' on' : '') + (open ? '' : ' lock'));
      b.innerHTML = '<b>' + r.nm + '</b><span>' + (open ? r.place : '🔒 未解锁') + '</span>';
      b.onclick = function () {
        if (!open) {
          var prev = REGIONS[REGIONS.indexOf(r) - 1];
          toast('先通关「' + prev.place + '」的第 5 关，才能前往 ' + r.place);
          sfx('deny');
          return;
        }
        if (state.region !== r.id) { expStage = Math.min(4, stageProg(r.id).c); sfx('unlock'); }
        state.region = r.id;
        save();
        renderRegionStrip();
        renderExpedition();
      };
      strip.appendChild(b);
    });
    // 地区变多后，自动把当前地区滚进可视区
    var cur = strip.querySelector('.region.on');
    if (cur && strip.scrollTo) {
      try {
        strip.scrollTo({
          left: Math.max(0, cur.offsetLeft - strip.clientWidth / 2 + cur.offsetWidth / 2),
          behavior: 'smooth',
        });
      } catch (e) { strip.scrollLeft = Math.max(0, cur.offsetLeft - 80); }
    }
  }

  /* ── 关卡路线：每个地区 5 关，通关解锁下一关 ─────── */
  var expStage = -1;
  var STAGE_REC = ['N', 'R', 'SR', 'SSR', 'UR'];
  function stageProg(rid) {
    state.stages = state.stages || {};
    return state.stages[rid] || (state.stages[rid] = { c: 0, s: [0, 0, 0, 0, 0] });
  }
  function starStr(n) {
    var s = '';
    for (var i = 0; i < 3; i++) s += i < n ? '★' : '☆';
    return s;
  }
  function renderStageMap() {
    var strip = $('regionStrip');
    if (!strip || !window.StageArt) return;
    var wrap = $('stageMap');
    if (!wrap) {
      wrap = mk('div', 'stage-map');
      wrap.id = 'stageMap';
      strip.parentNode.insertBefore(wrap, strip.nextSibling);
    }
    var here = regionById(state.region || REGIONS[0].id);
    var pg = stageProg(here.id);
    if (expStage < 0 || expStage > pg.c) expStage = Math.min(4, pg.c);
    var html = '<div class="sm-path">';
    for (var i = 0; i < 5; i++) {
      var open = i <= pg.c, done = i < pg.c;
      html += '<button class="sm-node' + (i === expStage ? ' on' : '') + (open ? '' : ' lock') +
        (done ? ' done' : '') + (i === 4 ? ' boss' : '') + '" data-i="' + i + '">' +
        '<b>' + (open ? (i + 1) : '🔒') + '</b><em>' + (done ? starStr(pg.s[i] || 0) : '') + '</em></button>';
      if (i < 4) html += '<i class="sm-line' + (done ? ' done' : '') + '"></i>';
    }
    html += '</div><div class="sm-info"></div>';
    wrap.innerHTML = html;
    var nodes = wrap.querySelectorAll('.sm-node');
    for (var k = 0; k < nodes.length; k++) {
      nodes[k].onclick = function () {
        var n = +this.getAttribute('data-i');
        if (n > pg.c) { toast('先通关第 ' + pg.c + ' 关'); return; }
        expStage = n;
        renderStageMap();
      };
    }
    // 关卡卡片只留三样：关名、推荐品阶 + 图鉴进度、四个敌人头像（点头像看名字）
    var th = StageArt.theme(here.id, expStage);
    var info = wrap.querySelector('.sm-info');
    var list = [[th.drone, '小怪'], [th.shooter, '射手'], [th.elite, '精英'], [th.boss, '首领']];
    var cx = state.codex || {};
    var gotN = list.filter(function (f) { return cx[f[0]]; }).length;
    info.innerHTML = '<div class="si-head"><b>' + th.title + '</b>' +
      '<span class="si-rec">' + STAGE_REC[expStage] + '+</span>' +
      '<span class="si-codex">图鉴 ' + gotN + '/4</span></div><div class="si-foes"></div>';
    var foes = info.querySelector('.si-foes');
    list.forEach(function (f) {
      var got = !!cx[f[0]];
      var d = mk('button', 'si-foe' + (f[1] === '首领' ? ' boss' : '') + (got ? ' got' : ' miss'));
      d.type = 'button';
      var c = document.createElement('canvas');
      c.width = c.height = 32;
      var g2 = c.getContext('2d');
      g2.imageSmoothingEnabled = false;
      StageArt.draw(g2, f[0], 16, 16, 32);
      d.appendChild(c);
      var role = mk('i', '');
      role.textContent = f[1];
      d.appendChild(role);
      d.onclick = function () { openMonsterDetail(f[0], true); };
      foes.appendChild(d);
    });
  }

  // 漫游页只放地图 + 当前出战卡；换卡在弹出的列表里选
  function renderExpedition() {
    if (!$('expMap')) return;
    renderRegionStrip();
    renderStageMap();
    renderBattleQuota();
    renderExpPick();
    requestAnimationFrame(layoutStage);
  }

  function renderExpPick() {
    var pool = expPool();
    var slot = $('expPickCard');
    var btn = $('expPickBtn');
    slot.innerHTML = '';
    if (!pool.length) {
      expPick = null;
      slot.innerHTML = '<span class="exp-pick-empty">?</span>';
      btn.onclick = function () { switchTab('draw'); };
      syncExpDock(null);
      $('expPickInfo').textContent = '还没有词卡，先去抽卡';
      renderShipPreview(null);
      return;
    }
    var found = null;
    for (var i = 0; i < pool.length; i++) if (pool[i].w === expPick) found = pool[i];
    if (!found) { found = pool[0]; expPick = found.w; }
    slot.appendChild(cardThumb(found, 64));
    btn.onclick = openExpSheet;
    syncExpDock(found);
    renderShipPreview(found);
  }

  // 离开漫游页：停止预览并隐藏整屏图层，避免和其它页面叠在一起
  function pauseHangarPreview() {
    var bg = $('expBg');
    if (bg) bg.classList.remove('on');
    var cv = $('expShip');
    if (cv && cv._raf) { cancelAnimationFrame(cv._raf); cv._raf = null; }
  }

  // 漫游页中间的机库：展示当前卡满火力形态并持续开火
  function renderShipPreview(card) {
    var cv = $('expShip');
    if (!cv || !window.Battle || !Battle.preview) return;
    var bg = $('expBg');
    if (bg) bg.classList.add('on');
    var tag = $('expShipTag');
    if (!card) {
      if (cv._raf) { cancelAnimationFrame(cv._raf); cv._raf = null; }
      cv._lastCard = null;
      var g = cv.getContext('2d');
      if (g) g.clearRect(0, 0, cv.width, cv.height);
      if (tag) tag.innerHTML = '';
      return;
    }
    var lv = levelsOf(card);
    var pv = Battle.preview(cv, card, lv, { bottom: stageGap() });
    // 战斗是覆盖层，进战斗时会暂停这台预览；退出时按这份参数接回去
    cv._lastCard = card; cv._lastLv = lv; cv._lastOpts = { bottom: stageGap() };
    layoutStage();
    // dock 高度在字体/布局稳定后才准，下一帧补测一次
    requestAnimationFrame(layoutStage);
    if (tag) tag.innerHTML = '<span>满火力</span><b>' + powerPips(pv) + '</b><span>觉醒</span><span>双层护盾</span>';
    if (tag) tag.style.display = '';
  }

  // 火力格：卡片等级决定格数
  function powerPips(pv) {    return pv && pv.maxP ? new Array(pv.maxP + 1).join('▮') : '';
  }

  // 按底部 dock 实际高度给飞机留出舞台：不算布局高度，只加滚动内边距
  function dockH() {
    var d = document.querySelector('#screenExpedition .exp-dock');
    return d ? d.offsetHeight : 150;
  }
  // dock 顶到屏幕底的距离（含底部导航栏）；飞机和标签都在全屏 fixed 图层里，按视口底部定位
  function dockTopGap() {
    var d = document.querySelector('#screenExpedition .exp-dock');
    if (!d) return dockH();
    var r = d.getBoundingClientRect();
    return r.height ? Math.max(0, window.innerHeight - r.top) : dockH();
  }
  // 飞机中心距 dock 顶 140px（矮屏 112px）：护盾下沿约留 70px；标签在 dock 上方 14px
  function shipLift() { return (window.innerHeight || 800) < 720 ? 112 : 140; }
  function stageGap() { return dockTopGap() + shipLift(); }
  function layoutStage() {
    if (curTab !== 'expedition') return;
    var h = dockH(), gap = dockTopGap(), lift = shipLift();
    var map = $('expMap');
    if (map) map.style.paddingBottom = (h + lift + 80) + 'px';   // 内容卷到飞机上方，不挤压地图高度
    var tag = $('expShipTag');
    if (tag) tag.style.bottom = (gap + 14) + 'px';
    var cv = $('expShip');
    if (cv && cv._setBottom) cv._setBottom(gap + lift);
  }

  window.addEventListener('resize', function () { layoutStage(); });

  function expKindsOf(w) {
    var wk = Card.weaponKinds ? Card.weaponKinds(w, levelsOf(w)) : { main: Card.dominantKind(w), sub: null };
    return [wk.main, wk.sub].filter(Boolean);
  }
  // 顶部属性筛选：选 1 个 = 主/副武器含该属性；选 2 个 = 主副正好是这对组合
  function renderExpFilter() {
    var box = $('expFilter');
    if (!box) return;
    box.innerHTML = '';
    var all = mk('button', 'chip' + (expKinds.length ? '' : ' on'));
    all.textContent = '全部';
    all.onclick = function () { sfx('tap'); expKinds = []; openExpSheet(true); };
    box.appendChild(all);
    Object.keys(Card.KINDS).forEach(function (k) {
      var K = Card.KINDS[k], on = expKinds.indexOf(k) >= 0;
      var b = mk('button', 'chip ek' + (on ? ' on' : ''));
      b.style.setProperty('--k', K.c);
      b.innerHTML = '<i></i>' + K.nm;
      b.onclick = function () {
        sfx('tap');
        var i = expKinds.indexOf(k);
        if (i >= 0) expKinds.splice(i, 1);
        else {
          if (expKinds.length >= 2) { expKinds.shift(); toast('最多同时筛选 2 种属性'); }
          expKinds.push(k);
        }
        openExpSheet(true);
      };
      box.appendChild(b);
    });
  }
  function openExpSheet(refilter) {
    var pool = expPool().filter(function (w) {
      if (!expKinds.length) return true;
      var ks = expKindsOf(w);
      return expKinds.every(function (k) { return ks.indexOf(k) >= 0; });
    });
    var box = $('expList');
    var token = ++expRenderToken;
    box.innerHTML = '';
    renderExpFilter();
    $('expCount').textContent = pool.length + ' 张';
    if (!pool.length) box.innerHTML = '<div class="exp-empty">没有符合这个组合的词卡</div>';
    var width = Math.floor((Math.min(430, window.innerWidth) - 36 - 10) / 2);
    var idx = 0;
    (function chunk() {
      if (token !== expRenderToken) return;
      var end = Math.min(pool.length, idx + 12);
      for (; idx < end; idx++) {
        try { box.appendChild(buildExpCard(pool[idx], width)); } catch (e) { if (window.console) console.error(e); }
      }
      if (idx < pool.length) requestAnimationFrame(chunk);
    })();
    if (refilter === true) return;
    $('expSheet').classList.add('open');
    sfx('sheet');
  }
  function closeExpSheet() {
    expRenderToken++;
    $('expSheet').classList.remove('open');
    sfx('sheetClose');
  }

  function buildExpCard(w, width) {
    var item = mk('button', 'exp-card' + (w.w === expPick ? ' on' : ''));
    item.type = 'button';
    item.appendChild(cardThumb(w, width));
    var tag = mk('div', 'exp-kinds');
    tag.innerHTML = expKindsOf(w).map(function (k, i) {
      return '<span class="ek-tag' + (i ? ' sub' : '') + '" style="--c:' + Card.KINDS[k].c + '">' +
        Card.weaponIcon(k, i ? 'sub' : '') + '<b>' + Card.KINDS[k].nm + '</b><em>' + (i ? '副' : '主') + '</em></span>';
    }).join('');
    item.appendChild(tag);
    item.onclick = function () {
      expPick = w.w;
      closeExpSheet();
      renderExpPick();
    };
    return item;
  }

  function battleApi() {
    return {
      region: regionById(state.region || REGIONS[0].id),
      stage: Math.max(0, expStage),
      codexHas: function (id) { return !!(state.codex && state.codex[id]); },
      getOwned: function () { return state.owned; },
      // 战斗中拼满单词：每日最多 10 次计入熟练度
      onWordSpelled: function (w) {
        var t = todayStr();
        if (state.quota.d !== t) state.quota = { d: t, used: 0, bonus: 0, battleUsed: 0, battleBonus: 0 };
        var q = state.quota.bsp || 0;
        if (q >= 10) return 0;
        var card = BY_WORD[w && w.w ? w.w : w];
        if (!card) return 0;
        state.quota.bsp = q + 1;
        var g = addXp(card, 8);
        save();
        return g;
      },
      levelsOf: levelsOf,
      viewOf: viewOf,
      starsOf: starsOf,
      inkMul: battleInkMul,
      onStrongWrite: function (w) {
        // 强射写对也计入默写成长
        var o = recWrite(w);
        o.wr++;
        o.m = starsOf(w);
        addXp(w, XP_PER_WRITE);
        save();
        refreshCounts();
        rewardWrite(w, XP_PER_WRITE);
        addDaily('spell');
        if (reviewDue(w)) addDaily('review');
      },
      onStart: function () {
        if (battleQuotaLeft() <= 0) {
          toast('精力不足 · 每 ' + energyRegenMin() + ' 分钟恢复 1 点');
          return false;
        }
        battleQuotaUse();
        return true;
      },
      onExit: function () {
        renderExpedition();
        refreshCounts();
      },
      onReward: function (n, info) {
        var t = todayStr();
        if (state.quota.d !== t) state.quota = { d: t, used: 0, bonus: 0, battleUsed: 0, battleBonus: 0 };
        state.quota.battleBonus = (state.quota.battleBonus || 0) + n;
        state.quota.battleUsed = (state.quota.battleUsed || 0) + 1;
        var ink = (info && info.ink) || 0;
        state.ink += ink;
        if (info && info.win && info.region != null) {
          var pg0 = stageProg(info.region), before = pg0.s[4] || 0;
          var pg = pg0, si = info.stage || 0;
          pg.s[si] = Math.max(pg.s[si] || 0, info.stars || 1);
          if (pg.c <= si) { pg.c = Math.min(5, si + 1); expStage = Math.min(4, pg.c); }
          if (!before && (pg.s[4] || 0) > 0) Sfx.play('unlock');
        }
        // 怪物图鉴：新收录每种 +10 成长点
        var codexNew = 0;
        state.codex = state.codex || {};
        ((info && info.codex) || []).forEach(function (id) {
          if (!state.codex[id]) { codexNew++; ink += 10; state.ink += 10; }
          state.codex[id] = (state.codex[id] || 0) + 1;
        });
        var winXp = 0;
        if (info && info.win && BY_WORD[info.word]) winXp = addXp(BY_WORD[info.word], 12);
        state.stats = state.stats || { battles: 0, wins: 0, kills: 0, stars: 0 };
        state.stats.battles++;
        state.stats.kills += (info && info.kills) || 0;
        if (info && info.win) {
          state.stats.wins++;
          state.stats.stars += info.stars || 0;
        }
        noteRun(info);
        if (info) pushRecord(info);
        addDaily('battle');
        var drop = false;
        if (info && info.win) {
          addDaily('win');
          if ((info.stage === 4 || Math.random() < DROP_RATE) && grantBonus()) drop = true;
        }
        save();
        checkAchievementUnlocks();
        renderBattleQuota();
        refreshCounts();
        if (curTab === 'mine') renderMine();
        toast('漫游奖励 · 成长点 +' + ink + (drop ? ' · 抽卡券 +1' : '') + (codexNew ? ' · 新图鉴 ×' + codexNew : '') + (winXp ? ' · 熟练度 +' + winXp : '') + (n ? ' · 漫游 +' + n : ''));
      },
    };
  }

  function startExpedition() {
    if (!expPick) { toast('先选择一张词卡'); return; }
    var w = BY_WORD[expPick];
    if (!w) { toast('词卡不存在'); return; }
    if (battleQuotaLeft() <= 0) { toast('精力不足 · 每 ' + energyRegenMin() + ' 分钟恢复 1 点'); return; }
    if (!window.Battle || !window.Battle.start) { toast('漫游模块未加载'); return; }
    sfx('start');
    window.Battle.start([viewOf(w)], battleApi());
  }

  function pushRecord(info) {
    state.records = state.records || [];
    state.records.unshift({
      at: Date.now(),
      win: !!info.win,
      word: info.word || (expPick || ''),
      waves: info.waves || 0,
      kills: info.kills || 0,
      strong: info.strong || 0,
      ink: info.ink || 0,
      grade: info.grade || '',
      stageName: info.stageName || '',
      stars: info.stars || 0,
    });
    if (state.records.length > 30) state.records.length = 30;
  }

  /* ── 我的：图鉴 / 战绩 / 成就 ─────────────────── */
  var curPane = 'book';

  /* ── 个人称号：综合掌握数、连续天数 ─────────────────
     词库约 1900 词，阶梯拉到掌握 1000 才封顶；徽记材质仍只有 t0~t7，
     更高称号复用最高两档视觉，但名字与等级继续往上走。 */
  var TITLES = [
    { nm: '未开卷', owned: 0 },
    { nm: '初读词册', owned: 1 },
    { nm: '行脚书吏', mastered: 8 },
    { nm: '街区采词人', mastered: 20, streak: 3 },
    { nm: '城镇词匠', mastered: 45, streak: 5 },
    { nm: '港口藏书家', mastered: 80, streak: 7 },
    { nm: '跨洲词使', mastered: 140, streak: 10 },
    { nm: '世界词志编修', mastered: 220, streak: 14 },
    { nm: '词海巡使者', mastered: 350, streak: 21 },
    { nm: '典籍守门人', mastered: 500, streak: 30 },
    { nm: '万词总纂', mastered: 750, streak: 45 },
    { nm: '词宙造物主', mastered: 1000, streak: 60 },
  ];
  function titleVisual(i) { return Math.min(i, 7); }
  function titleStat() {
    var owned = 0, mastered = 0;
    for (var k in state.owned) {
      owned++;
      if (BY_WORD[k] && starsOf(BY_WORD[k]) >= 3) mastered++;
    }
    return { owned: owned, mastered: mastered, streak: state.streak || 1 };
  }
  function titleInfo() {
    var s = titleStat();
    var cur = TITLES[0], idx = 0;
    for (var i = 0; i < TITLES.length; i++) {
      var t = TITLES[i];
      if ((t.owned || 0) <= s.owned && (t.mastered || 0) <= s.mastered && (t.streak || 0) <= s.streak) {
        cur = t; idx = i;
      }
    }
    return { cur: cur.nm, idx: idx, stat: s };
  }
  // 称号徽记：图标随称号变化，边框材质由 CSS .t0~.t7 逐级升级
  var TITLE_ICONS = [
    '<path d="M6.5 4H18v14H7.5A2 2 0 0 0 5.5 20V5a1 1 0 0 1 1-1Z"/><path d="M5.5 20a2 2 0 0 1 2-2H18v3H7.5a2 2 0 0 1-2-1Z"/>',
    '<path d="M3 5.5c3-1 6-.8 9 1.2 3-2 6-2.2 9-1.2V19c-3-1-6-.8-9 1.2-3-2-6-2.2-9-1.2Z"/><path d="M12 6.7v13.5"/>',
    '<path d="M19.5 3.5C13 4.5 8.6 8.8 7 15.5L5 20l4.3-2.2c6.6-1.8 10.6-6.2 10.2-14.3Z"/><path d="M7.5 16.5l6-6"/>',
    '<path d="M9 4h6M12 2v2"/><path d="M8 7h8l-1.2 11H9.2Z"/><path d="M10 21h4M12 10.5v4"/>',
    '<path d="M10.5 3.5h7l2.5 3-2.5 1.5h-7Z"/><path d="M13 8l-8.5 10.5 2 2L15 10"/>',
    '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 10.5h8"/><path d="M4 13.5c0 4.2 3.6 7.5 8 7.5s8-3.3 8-7.5"/>',
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/>',
    '<path d="M4 17.5 3 7l5 4 4-6.5 4 6.5 5-4-1 10.5Z"/><path d="M4.5 20.5h15"/>',
  ];
  function titleEmblem(i, extra) {
    var v = titleVisual(i);
    return '<span class="tm t' + v + (extra ? ' ' + extra : '') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      TITLE_ICONS[v] + '</svg></span>';
  }
  function renderTitle() {
    var n = document.querySelector('.pf-name');
    if (!n) return;
    var t = titleInfo(), v = titleVisual(t.idx);
    n.textContent = t.cur;
    n.className = 'pf-name t' + v;
    var rk = $('pfRank');
    if (rk) rk.textContent = t.idx + 1;
    var em = $('pfEmblem');
    if (em) em.outerHTML = titleEmblem(t.idx).replace('<span class="tm', '<span id="pfEmblem" class="tm');
    var av = $('pfAvatar');
    if (av) av.className = 'pf-avatar t' + v;
    renderMineActs();
  }
  function renderMineActs() {
    var rs = $('mineRecSub'), as = $('mineAchSub');
    if (rs) {
      var list = state.records || [], wins = list.filter(function (r) { return r.win; }).length;
      rs.textContent = list.length ? list.length + '场 ' + Math.round(wins / list.length * 100) + '%' : '暂无';
    }
    if (as) {
      var al = achievementList(), got = al.filter(function (a) { return a.cur >= a.max; }).length;
      as.textContent = got + '/' + al.length;
    }
  }
  function renderTitleSheet(box) {
    var t = titleInfo(), s = t.stat, hv = titleVisual(t.idx);
    var html = '<div class="tt-hero t' + hv + '">' + titleEmblem(t.idx, 'lg') +
      '<div class="tt-hero-t"><b class="tn t' + hv + '">' + t.cur + '</b><span>已解锁 ' + (t.idx + 1) + ' / ' + TITLES.length + ' 个称号</span></div></div>' +
      '<div class="tt-list">';
    TITLES.forEach(function (ti, i) {
      var on = i <= t.idx, conds = [], v = titleVisual(i);
      if (ti.owned) conds.push(['收录', s.owned, ti.owned, '张']);
      if (ti.mastered) conds.push(['掌握', s.mastered, ti.mastered, '词']);
      if (ti.streak) conds.push(['连续', s.streak, ti.streak, '天']);
      var ch = conds.length ? conds.map(function (c) {
        var ok = c[1] >= c[2];
        return '<span class="' + (ok ? 'ok' : '') + '">' + c[0] + ' ' + (on ? c[2] : Math.min(c[1], c[2]) + '/' + c[2]) + ' ' + c[3] + '</span>';
      }).join('') : '<span class="ok">初始称号</span>';
      html += '<div class="tt t' + v + (on ? ' on' : '') + (i === t.idx ? ' cur' : '') + '">' + titleEmblem(i) +
        '<div class="tt-main"><div class="tt-top"><b class="tn t' + v + '">' + ti.nm + '</b><i>Lv.' + (i + 1) + '</i>' +
        (i === t.idx ? '<em>当前</em>' : '') + '</div><div class="tt-cond">' + ch + '</div></div>' +
        '<span class="tt-st">' + (on ? '✓' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>') + '</span></div>';
    });
    box.innerHTML = html + '</div><p class="tt-foot">收录 / 掌握 / 连续打卡同时达标即可晋升 · 顶级需掌握 1000 词</p>';
  }

  function renderMine() {
    refreshCounts();
    renderTitle();
    showMinePane(curPane);
  }

  function showMinePane(name) {
    curPane = name || 'book';
    renderBookTabs(); renderCats(); renderChips(); renderGrid(true);
  }

  /* ── 我的：筛选 / 战绩 / 成就 / 玩法说明 共用底部弹层 ── */
  function openMineSheet(mode) {
    var sh = $('mineSheet');
    if (!sh) return;
    var body = $('mineSheetBody');
    $('mineSheetTitle').textContent =
      mode === 'record' ? '战绩' :
      mode === 'ach' ? '成就' :
      mode === 'title' ? '称号' :
      mode === 'help' ? '怎么玩' : '筛选';
    if (mode === 'record') renderRecords(body);
    else if (mode === 'ach') renderAchievements(body);
    else if (mode === 'title') renderTitleSheet(body);
    else if (mode === 'help') renderHelpSheet(body);
    else renderFilterSheet(body);
    var m = $('mask');
    if (m) m.classList.add('on');
    sh.classList.remove('monster-detail');
    setMineSheetPage(sh, mode === 'ach' || mode === 'record');
    sh.classList.add('open');
    sfx('sheet');
  }

  function renderHelpSheet(body) {
    body.innerHTML =
      '<div class="help-guide">' +
        '<section><h4>主线</h4>' +
          '<p>抽卡收集词卡 → 默写练熟 → 漫游出战。成长点用来升级字母、补给精力、兑换抽卡。</p></section>' +
        '<section><h4>抽卡</h4>' +
          '<p>每组 3 张，约三成是复习卡。<b>通晓满 3 星</b>达 60 / 150 词后，才开放 SSR / UR。隐藏款 EX 只在<strong>新词</strong>上出现，约 0.3%，复习卡不出。</p></section>' +
        '<section><h4>词卡 = 战机</h4>' +
          '<p>每张卡对应一架飞机；字母等级决定火力。主 / 副武器随单词属性变化（火、冰等），详情页可升级字母。</p></section>' +
        '<section><h4>漫游</h4>' +
          '<p>每次出战消耗 1 点精力，约每 <b>' + energyRegenMin() + '</b> 分钟恢复 1 点；也可用 <b>' + ENERGY_BUY_COST + '</b> 成长点补给（每日有限次）。</p></section>' +
      '</div>';
  }
  // 整页（战绩/成就）从右侧滑入滑出，配返回按钮；其余为底部弹层，配 ✕
  function setMineSheetPage(sh, full) {
    if (sh.classList.contains('achievement-page') !== full) {
      sh.style.transition = 'none';
      sh.classList.toggle('achievement-page', full);
      void sh.offsetWidth;
      sh.style.transition = '';
      void sh.offsetWidth;
    }
    var x = $('mineSheetClose');
    if (x) {
      x.classList.toggle('sheet-x', !full);
      x.textContent = full ? '‹ 返回' : '✕';
      x.setAttribute('aria-label', full ? '返回' : '关闭');
    }
  }
  function closeMineSheet() {
    var sh = $('mineSheet');
    if (sh) { sh.classList.remove('open', 'monster-detail'); sfx('sheetClose'); }
    var m = $('mask');
    if (m) m.classList.remove('on');
  }
  function renderFilterSheet(body) {
    body.innerHTML =
      '<div class="mf"><p class="mf-lab">分类</p><div class="chips tags" id="tags"></div></div>' +
      '<div class="mf"><p class="mf-lab">获得状态</p><div class="chips" id="chips"></div></div>' +
      '<div class="mf"><p class="mf-lab">稀有度</p><div class="chips" id="tiers"></div></div>' +
      '<div class="mf"><p class="mf-lab">排序</p><div class="chips" id="sorts"></div></div>' +
      '<div class="wacts" style="margin-top:20px"><button class="btn" id="filterReset">重置</button>' +
      '<button class="btn primary" id="filterDone">完成</button></div>';
    renderChips(); renderSort();
    $('filterReset').onclick = function () {
      bookFilter = 'got'; bookTier = []; bookSort = 'tier'; bookTag = '';
      renderCats(); renderChips(); renderSort(); renderGrid(true);
    };
    $('filterDone').onclick = closeMineSheet;
  }

  function filterSummary() {
    var f = bookFilter === 'got' ? '已获得' : bookFilter === 'locked' ? '未获得' : bookFilter === 'hidden' ? '隐藏款' : '全部';
    var t = bookTier.map(function (v) { return v === 'hidden' ? '隐藏款' : TIERS[v].code; }).join(' / ');
    var s = '';
    for (var i = 0; i < SORTS.length; i++) if (SORTS[i].k === bookSort) s = SORTS[i].nm;
    var tag = bookTag && window.TAGS[bookTag] ? ' · ' + window.TAGS[bookTag] : '';
    return f + tag + (t ? ' · ' + t : '') + (s ? ' · ' + s : '');
  }

  function renderRecords(box) {
    box = box || $('mineSheetBody');
    if (!box) return;
    var list = state.records || [];
    var wins = 0, best = 0, ink = 0, kills = 0;
    list.forEach(function (r) {
      if (r.win) wins++;
      if ((r.waves || 0) > best) best = r.waves;
      ink += r.ink || 0;
      kills += r.kills || 0;
    });
    var rate = list.length ? Math.round(wins / list.length * 100) : 0;

    var html =
      '<div class="rv-hero">' +
        '<div class="rv-ring" style="--p:' + rate + '"><b>' + rate + '<i>%</i></b><span>胜率</span></div>' +
        '<div class="rv-hstats">' +
          '<div><b>' + list.length + '</b><span>漫游</span></div>' +
          '<div><b>' + wins + '</b><span>胜利</span></div>' +
          '<div><b>' + best + '</b><span>最高关</span></div>' +
          '<div><b>' + kills + '</b><span>击杀</span></div>' +
        '</div>' +
      '</div>';

    if (!list.length) {
      box.innerHTML = html +
        '<div class="rv-empty"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V4"/><path d="M6 4.5h11l-2.4 3.8L17 12H6"/></svg></i>' +
        '<p>还没有战绩</p><span>走一趟漫游，记录会出现在这里</span>' +
        '<button class="btn primary" id="recGoExp">去漫游</button></div>';
      var go = $('recGoExp');
      if (go) go.onclick = function () { closeMineSheet(); switchTab('expedition'); };
      return;
    }

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var lastDay = '', rows = '';
    list.forEach(function (r) {
      var d = new Date(r.at), d0 = new Date(r.at); d0.setHours(0, 0, 0, 0);
      var diff = Math.round((today - d0) / 864e5);
      var day = diff === 0 ? '今天' : diff === 1 ? '昨天' : (d.getMonth() + 1) + '月' + d.getDate() + '日';
      if (day !== lastDay) { rows += '<p class="rv-day">' + day + '</p>'; lastDay = day; }
      var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      var stars = '';
      if (r.stageName && r.win) for (var i = 0; i < 3; i++) stars += '<i class="' + (i < (r.stars || 0) ? 'on' : '') + '">★</i>';
      rows += '<div class="rv ' + (r.win ? 'win' : 'lose') + '">' +
        '<span class="rv-badge">' + (r.win ? '胜' : '败') + '</span>' +
        '<div class="rv-main">' +
          '<div class="rv-top"><b class="rv-w">' + (r.word || '—') + '</b>' + (stars ? '<span class="rv-stars">' + stars + '</span>' : '') + '</div>' +
          '<p class="rv-stage">' + (r.stageName || (r.waves || 0) + ' / 5 关') + ' · 击杀 ' + (r.kills || 0) + ' · 拼词 ' + (r.strong || 0) + '</p>' +
        '</div>' +
        '<div class="rv-ink"><b>+' + (r.ink || 0) + '<small>成长点</small></b><em>' + hm + '</em></div>' +
      '</div>';
    });
    box.innerHTML = html + '<div class="rv-list">' + rows + '</div>' +
      '<p class="rv-total">最近 ' + list.length + ' 场 · 共获得 ' + ink + ' 成长点</p>';
  }

  function openBook() {
    switchTab('mine');
    showMinePane('book');
  }

  var bookTab = 'cards';
  var bookTier = [];   // 稀有度多选；空数组 = 全部，可同时包含 1-5 与 'hidden'

  function tierOn(t) { return bookTier.indexOf(t) >= 0; }

  function renderBookTabs() {
    var box = $('bookTabs');
    box.innerHTML = '';
    [['cards', '单词图鉴'], ['atlas', '字母图鉴'], ['monsters', '怪物图鉴']].forEach(function (t) {
      var b = mk('button', 'btab' + (bookTab === t[0] ? ' on' : ''));
      b.textContent = t[1];
      b.onclick = function () { sfx('page'); bookTab = t[0]; renderBookTabs(); };
      box.appendChild(b);
    });
    $('bookCards').style.display = bookTab === 'cards' ? '' : 'none';
    $('atlas').style.display = bookTab === 'atlas' ? '' : 'none';
    if (bookTab !== 'cards') {
      var tb = $('codexTop');
      if (tb) tb.classList.remove('on');
    }
    if (bookTab === 'atlas' && !$('atlas').innerHTML) $('atlas').innerHTML = atlasHTML();
    var mc = $('mcodex');
    if (!mc) {
      mc = mk('div', 'mcodex');
      mc.id = 'mcodex';
      $('atlas').parentNode.insertBefore(mc, $('atlas').nextSibling);
    }
    mc.style.display = bookTab === 'monsters' ? '' : 'none';
    if (bookTab === 'monsters') renderMonsterCodex(mc);
  }

  /* ── 怪物图鉴：漫游中击败怪物有几率掉落，按地区分组 ── */
  function renderMonsterCodex(box) {
    var A = window.StageArt;
    if (!A) { box.innerHTML = ''; return; }
    var cx = state.codex || {}, total = 0, got = 0, html = '';
    REGIONS.forEach(function (r) {
      var R = A.REGIONS[r.id];
      if (!R) return;
      var ids = R.items.concat([R.elite, R.landmark]);
      var n = ids.filter(function (id) { return cx[id]; }).length;
      total += ids.length; got += n;
      html += '<div class="mc-reg"><div class="mc-head"><b>' + r.place + '</b><span>' + n + ' / ' + ids.length + '</span></div><div class="mc-grid">';
      ids.forEach(function (id, i) {
        var role = i === ids.length - 1 ? '地标' : i === ids.length - 2 ? '精英' : '';
        var nm = A.info(id), has = !!cx[id];
        html += '<div class="mc-cell' + (has ? ' got' : '') + (role ? ' rare' : '') + '" data-id="' + id + '">' +
          '<canvas width="32" height="32"></canvas>' +
          (role ? '<em>' + role + '</em>' : '') +
          (has ? '<i>×' + cx[id] + '</i>' : '') +
          '<b>' + (has ? nm.cn : '???') + '</b><span>' + (has ? nm.en : '漫游中掉落') + '</span></div>';
      });
      html += '</div></div>';
    });
    box.innerHTML = '<p class="mc-tip">击败怪物有几率掉落图鉴卡，飞机吃到即收录 · 精英 / 首领掉率更高 · 新收录 +10 成长点' +
      '<b>' + got + ' / ' + total + '</b></p>' + html;
    var cells = box.querySelectorAll('.mc-cell');
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i].querySelector('canvas'), g = c.getContext('2d'), id = cells[i].getAttribute('data-id');
      g.imageSmoothingEnabled = false;
      if (cx[id]) A.draw(g, id, 16, 16, 32, false);
      else { g.globalAlpha = 0.16; A.draw(g, id, 16, 16, 32, true); }
      cells[i].onclick = function () {
        var id = this.getAttribute('data-id');
        if (cx[id]) openMonsterDetail(id);
        else toast('尚未收录，击败漫游中的怪物有概率获得图鉴');
      };
    }
  }

  // full：漫游页查看时无论是否收录都展示完整资料
  function openMonsterDetail(id, full) {
    var A = window.StageArt, sh = $('mineSheet'), body = $('mineSheetBody');
    if (!A || !sh || !body) return;
    var info = A.info(id), cnt = (state.codex || {})[id] || 0, n = cnt || full;
    body.innerHTML =
      '<div class="monster-detail-hero">' +
        '<canvas class="monster-detail-icon" width="96" height="96"></canvas>' +
        '<div><h2>' + info.cn + '</h2><p>' + info.en + '</p></div>' +
      '</div>' +
      '<p class="monster-detail-desc">' + (n ? (info.desc || '关于它的文化与历史资料仍在整理中。') : '尚未收录。漫游中击败它有概率掉落图鉴卡，收录后解锁完整资料。') + '</p>' +
      '<p class="monster-detail-meta">' + (cnt ? '收录次数 ×' + cnt : '未收录') + '</p>';
    $('mineSheetTitle').textContent = '怪物图鉴';
    setMineSheetPage(sh, false);
    sh.classList.add('monster-detail', 'open');
    var cv = body.querySelector('.monster-detail-icon'), g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (n) A.draw(g, id, 48, 48, 88, false);
    else { g.globalAlpha = 0.3; A.draw(g, id, 48, 48, 88, true); }
    var m = $('mask');
    if (m) m.classList.add('on');
    sfx('sheet');
  }

  var SORTS = [
    { k: 'tier', nm: '稀有度' },
    { k: 'kind', nm: '主武器' },
    { k: 'ammo', nm: '弹药' },
    { k: 'new', nm: '最新' },
  ];

  function renderSort() {
    var sum = $('filterSum');
    if (sum) sum.textContent = filterSummary();
    var box = $('sorts');
    if (!box) return;
    box.innerHTML = '';
    SORTS.forEach(function (o) {
      var b = mk('button', 'chip' + (bookSort === o.k ? ' on' : ''));
      b.textContent = o.nm;
      b.onclick = function () { sfx('tap'); bookSort = o.k; renderSort(); renderGrid(true); };
      box.appendChild(b);
    });
  }

  function sortWords(list) {
    var arr = list.slice();
    if (bookSort === 'new') {
      arr.sort(function (a, b2) { return (rec(b2).at || 0) - (rec(a).at || 0); });
    } else if (bookSort === 'tier') {
      arr.sort(function (a, b2) { return cardLvOf(b2) - cardLvOf(a) || (state.owned[b2.w] && state.owned[b2.w].hid ? 1 : 0) - (state.owned[a.w] && state.owned[a.w].hid ? 1 : 0) || a.w.length - b2.w.length; });
    } else if (bookSort === 'kind') {
      var order = Object.keys(Card.KINDS);
      var mainOf = function (w) { return order.indexOf(Card.weaponKinds(w, levelsOf(w)).main); };
      arr.sort(function (a, b2) { return mainOf(a) - mainOf(b2) || cardLvOf(b2) - cardLvOf(a); });
    } else {
      arr.sort(function (a, b2) { return b2.w.length - a.w.length || cardLvOf(b2) - cardLvOf(a); });
    }
    return arr;
  }

  function renderChips() {
    var sum = $('filterSum');
    if (sum) sum.textContent = filterSummary();
    var opts = [['got', '已获得'], ['locked', '未获得'], ['all', '全部']];
    var box = $('chips');
    if (box) {
      box.innerHTML = '';
      opts.forEach(function (o) {
        var b = mk('button', 'chip' + (bookFilter === o[0] ? ' on' : ''));
        b.textContent = o[1];
        b.onclick = function () { sfx('tap'); bookFilter = o[0]; renderChips(); renderGrid(true); };
        box.appendChild(b);
      });
    }
    // 分类（含各自收录进度）
    var tb2 = $('tags');
    if (tb2) {
      tb2.innerHTML = '';
      var st = tagStats();
      var list = [['', '全部', st.all]].concat(
        Object.keys(window.TAGS).filter(function (k) { return st[k]; }).map(function (k) {
          return [k, window.TAGS[k], st[k]];
        })
      );
      list.forEach(function (o) {
        var b = mk('button', 'cchip' + (bookTag === o[0] ? ' on' : '') + (o[2] && o[2].got >= o[2].total ? ' full' : ''));
        b.innerHTML = '<span class="cc-n">' + o[1] + '</span>';
        b.onclick = function () {
          if (bookTag === o[0]) return;
          sfx('tap'); bookTag = o[0]; renderChips(); renderGrid(true);
        };
        tb2.appendChild(b);
      });
    }
    var tb = $('tiers');
    if (tb) {
      tb.innerHTML = '';
      var all = mk('button', 'chip' + (bookTier.length === 0 ? ' on' : ''));
      all.textContent = '全部';
      all.onclick = function () { sfx('tap'); bookTier = []; renderChips(); renderGrid(true); };
      tb.appendChild(all);
      [1, 2, 3, 4, 5, 'hidden'].forEach(function (t) {
        var b = mk('button', 'chip' + (tierOn(t) ? ' on' : ''));
        b.textContent = t === 'hidden' ? '隐藏款' : TIERS[t].code;
        b.onclick = function () {
          sfx('tap');
          var i = bookTier.indexOf(t);
          if (i >= 0) bookTier.splice(i, 1); else bookTier.push(t);
          renderChips(); renderGrid(true);
        };
        tb.appendChild(b);
      });
    }
  }

  /* ── 单词图鉴：分类导航 + 进度 ─────────────────── */
  // 图鉴分母 = 图鉴实际能列出的词（全量词库，只排除超长词），
  // 不能用 poolWords()：抽卡池受章节解锁、品阶上限和主题影响，会随进度变化，和列表对不上
  function codexPool() {
    return WORDS.filter(function (w) { return w.w.length <= MAX_WORD_LEN; });
  }
  // 每个分类的收录数与总数
  function tagStats() {
    var out = { all: { got: 0, total: 0 } };
    codexPool().forEach(function (w) {
      var got = !!state.owned[w.w];
      if (!out[w.tag]) out[w.tag] = { got: 0, total: 0 };
      out[w.tag].total++;
      out.all.total++;
      if (got) { out[w.tag].got++; out.all.got++; }
    });
    return out;
  }

  function renderCats() {
    var st = tagStats(), all = st.all;
    var got = $('codexGot'), tot = $('codexTotal');
    if (got) got.textContent = all.got;
    if (tot) tot.textContent = all.total;
  }

  function codexCardNode(w, cardW) {
    var got = !!state.owned[w.w];
    // 图鉴完整显示所有卡：未收录的只是压暗，仍然能看全词形、释义与卡面
    var shown = viewOf(w);
    var th = cardThumb(shown, cardW);
    th.classList.add('book-card');
    if (!got) {
      th.classList.add('codex-locked');
    }
    th.onclick = function () { openDetail(w); };
    return th;
  }

  // 图鉴列表：mode = true/『reset』重建并回到第一页；『rebuild』重建但保留已加载数量；其余 = 仅追加新一页
  function renderGrid(mode) {
    var rebuild = mode === true || mode === 'reset' || mode === 'rebuild';
    if (mode === true || mode === 'reset') codexShown = CODEX_PAGE;
    var grid = $('grid');
    var scroller = $('screenMine');
    var keepTop = rebuild && !(mode === true || mode === 'reset') ? scroller.scrollTop : 0;
    var q = bookQuery.trim().toLowerCase();
    var list = sortWords(WORDS.filter(function (w) {
      if (w.w.length > MAX_WORD_LEN) return false;
      if (bookTag && w.tag !== bookTag) return false;
      var got = !!state.owned[w.w];
      var ownedHid = got && !!state.owned[w.w].hid;
      // 「全部」时不排除隐藏款；只有勾了具体品阶却没勾隐藏款时，才把已拥有的隐藏卡滤掉，
      // 避免筛 UR 时混进 EX 隐藏卡
      if (bookTier.length && !tierOn('hidden') && ownedHid) return false;
      if (bookFilter === 'got' && !got) return false;
      if (bookFilter === 'locked' && got) return false;
      if (bookTier.length) {
        var hit = !!w.tier && tierOn(w.tier);
        // 勾选隐藏款时，拥有隐藏版本的词卡也命中（不论其基础品阶）
        if (!hit && ownedHid && tierOn('hidden')) hit = true;
        if (!hit) return false;
      }
      if (q) {
        // 图鉴对未收录也完整展示，所以释义同样参与搜索
        var hay = w.w + ' ' + (w.cn || '');
        if (hay.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    }));
    codexTotal = list.length;
    if (rebuild || codexRendered > list.length) {
      grid.innerHTML = '';
      codexRendered = 0;
      if (!list.length) {
        grid.innerHTML = '<div class="grid-empty"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">' +
          '<rect x="10" y="8" width="22" height="30" rx="4"/><path d="M18 12h16a4 4 0 0 1 4 4v22" opacity=".5"/></svg>' +
          '<p>' + (q ? '没有找到相关单词' : '暂无卡片') + '</p></div>';
      }
    }
    // 卡宽按实际可用宽度分配：容器宽 - 中间间距，再对半；比例由 aspect-ratio 维持
    var gw = grid.clientWidth;
    if (!gw) gw = Math.min(430, window.innerWidth || 430) - 36;
    var cardW = Math.max(60, Math.floor((gw - GRID_GAP) / 2));
    // 只追加增量：清空 grid 会把滚动容器的可滚动高度瞬间压到 0，列表就会弹回顶部
    var upto = Math.min(list.length, codexShown);
    var frag = document.createDocumentFragment();
    for (var i = codexRendered; i < upto; i++) frag.appendChild(codexCardNode(list[i], cardW));
    grid.appendChild(frag);
    codexRendered = upto;
    renderMore(list.length);
    if (keepTop) {
      scroller.scrollTop = keepTop;
      requestAnimationFrame(function () { scroller.scrollTop = keepTop; });
    }
    var stat = $('bookStat');
    if (stat) {
      stat.textContent = !list.length ? ''
        : list.length > codexShown ? '显示 ' + codexShown + ' / ' + list.length + ' · 继续下滑加载更多'
        : '共 ' + list.length + ' 张';
    }
  }

  // 分页加载：底部按钮 + 自动续页（滚到底部附近就补一页，一屏不够高也补）
  function renderMore(total) {
    var box = $('codexMore');
    if (!box) return;
    if (total <= codexShown) {
      box.innerHTML = '';
      if (codexObs) { codexObs.disconnect(); codexObs = null; }
      return;
    }
    var exist = $('codexLoad');
    if (exist) exist.textContent = '加载更多 ' + (total - codexShown) + ' 张';
    else {
      box.innerHTML = '<button class="codex-load" id="codexLoad">加载更多 ' +
        (total - codexShown) + ' 张</button>';
      var b = $('codexLoad');
      if (b) b.onclick = function () { codexShown += CODEX_PAGE; renderGrid(); };
    }
    watchMore(box);
  }

  // 自动续页：以滚动容器 #screenMine 自身的滚动位置判断（容器内 WebView 的 innerHeight / 视口 IO 不可靠），
  // 滚到底部附近（或整页还没填满一屏）就继续补，一次可以连补多页。
  function codexNearBottom() {
    var s = $('screenMine');
    if (!s || !s.clientHeight) return false;
    return s.scrollTop + s.clientHeight >= s.scrollHeight - 600;
  }

  function codexFill() {
    if (curTab !== 'mine' || curPane !== 'book' || bookTab !== 'cards') return;
    var s = $('screenMine');
    var guard = 0;
    while (guard++ < 24 && codexShown < codexTotal) {
      if (!codexNearBottom()) break;
      codexShown += CODEX_PAGE;
      renderGrid();
    }
    // 内容还不够撑满一屏时也继续补，否则页面根本没法滚
    if (s) {
      guard = 0;
      while (guard++ < 24 && codexShown < codexTotal && s.scrollHeight <= s.clientHeight + 80) {
        codexShown += CODEX_PAGE;
        renderGrid();
        s = $('screenMine');
      }
    }
  }

  // 用 IntersectionObserver 当触发器；真正的续页判断交给 codexFill
  function watchMore(sentinel) {
    if (!sentinel || !window.IntersectionObserver) return;
    if (codexObs) { codexObs.disconnect(); codexObs = null; }
    codexObs = new IntersectionObserver(function (ents) {
      for (var i = 0; i < ents.length; i++) {
        if (!ents[i].isIntersecting) continue;
        codexFill();
        return;
      }
    }, { root: $('screenMine'), rootMargin: '0px 0px 600px 0px' });
    codexObs.observe(sentinel);
  }

  // 兜底：捕获任意层级滚动 / 触摸 / 滚轮，再加低频定时检查
  window.addEventListener('scroll', function () { codexFill(); }, true);
  window.addEventListener('touchmove', function () { codexFill(); }, { passive: true });
  window.addEventListener('wheel', function () { codexFill(); }, { passive: true });
  window.addEventListener('touchend', function () { setTimeout(codexFill, 60); }, { passive: true });
  if ($('screenMine')) $('screenMine').addEventListener('scroll', function () { codexFill(); }, { passive: true });
  setInterval(codexFill, 700);

  /* ── 字母图鉴 ─────────────────────────────────── */
  function atlasHTML() {
    var out = '<p class="at-intro">字母决定攻击效果；等级越高，背景越华丽、效果越强。隐藏款只能抽到，字母使用哥特体和彩虹描边，最高可升到 Lv6。</p>';
    [['护盾', 'A E I O U', '获得护盾', 'A'], ['散射', 'B P R G', '三向散射', 'B'],
     ['减速', 'C F S T', '冰缓敌人', 'S'], ['激光', 'D K M N V W X Z', '贯穿激光', 'K'],
     ['追踪', 'H J L Q Y', '自动追敌', 'L']].forEach(function (t) {
      var h = '<div class="at-tiles">';
      for (var lv = 1; lv <= 5; lv++) h += '<div class="at-cell">' + Card.typeTileSVG(t[3], lv, 46) + 'Lv' + lv + '</div>';
      h += '<div class="at-cell mythic">' + Card.typeTileSVG(t[3], 5, 46, { mythic: true }) + '隐藏款</div>';
      out += '<div class="at-row"><div class="at-lab"><b>' + t[0] + '</b><span>' + t[1] + ' · ' + t[2] + '</span></div>' + h + '</div></div>';
    });
    return out;
  }

  function countMastered() {
    var n = 0;
    for (var k in state.owned) if (BY_WORD[k] && starsOf(BY_WORD[k]) >= 3) n++;
    return n;
  }

  function tierLabel(w) {
    var v = viewOf(w);
    if (v.hid) return '隐藏款 · EX';
    return TIERS[v.tier].name + ' · ' + TIERS[v.tier].code + (stageOf(w) + 1);
  }

  // 详情卡：点击翻面，背面是该卡飞机吃满火力的实时预览（翻到背面才启动，翻回即停）
  function buildDetailFlip(w) {
    var lv = levelsOf(w);
    var flip = mk('div', 'dflip');
    var inner = mk('div', 'dflip-in');
    inner.appendChild(Card.render(w, { mastery: starsOf(w), levels: lv }));
    var back = mk('div', 'dflip-back');
    var cv = document.createElement('canvas');
    var tag = mk('div', 'dflip-tag');
    tag.textContent = '满火力预览';
    back.appendChild(cv);
    back.appendChild(tag);
    inner.appendChild(back);
    flip.appendChild(inner);
    flip.onclick = function () {
      var on = flip.classList.toggle('flipped');
      sfx('page');
      if (on) {
        if (!window.Battle || !Battle.preview) return;
        var pv = Battle.preview(cv, w, lv, { bottom: Math.round(back.offsetHeight * 0.22) });
        if (pv) tag.innerHTML = '满火力 <b>' + powerPips(pv) + '</b> + 觉醒';
      } else if (cv._raf) {
        cancelAnimationFrame(cv._raf);
        cv._raf = null;
      }
    };
    return flip;
  }

  function openDetail(w0) {
    var w = viewOf(w0);
    var owned = !!state.owned[w0.w];
    $('detail').classList.toggle('unowned', !owned);
    var box = $('detailCard');
    var oldCv = box.querySelector('canvas');
    if (oldCv && oldCv._raf) { cancelAnimationFrame(oldCv._raf); oldCv._raf = null; }
    box.innerHTML = '';
    box.appendChild(buildDetailFlip(w));
    $('detailTier').textContent = tierLabel(w);
    var acts = $('detailActions');
    acts.innerHTML = '';
    if (owned) {
      var b1 = mk('button', 'btn primary');
      b1.textContent = '默写 ' + recWrite(w).wr + '/' + needOf(w);
      b1.onclick = function () { startWrite(w0); };
      var b2 = mk('button', 'btn');
      b2.textContent = '存为图片';
      b2.onclick = function () { exportImage(w); };
      acts.appendChild(b1);
      acts.appendChild(b2);
    }
    sfx('page');

    var at = rec(w).at ? new Date(rec(w).at) : null;
    var foot = '<p class="dfoot">' + (TAGS[w.tag] ? TAGS[w.tag] + ' · ' : '') + (at ? '收于 ' + at.getFullYear() + '.' + (at.getMonth() + 1) + '.' + at.getDate() + ' · ' : '') +
      (owned ? '看过答案 ' + (rec(w).pk || 0) + ' 次' : '尚未收录') + '</p>';
    $('detailEntry').innerHTML = entryHTML(w) + foot;
    $('detailMeta').classList.add('detail-build');
    $('detailMeta').innerHTML = powerInfo(w) + xpMini(w0);
    var helpBtn = $('detailMeta').querySelector('[data-pow-help]');
    if (helpBtn) helpBtn.onclick = function () { powerHelp(w); };
    var stageBtn = $('detailMeta').querySelector('[data-stage-help]');
    if (stageBtn) stageBtn.onclick = function (e) { e.stopPropagation(); stageHelp(); };
    if (owned) renderUpgrade(w0);
    else {
      var oldLv = $('detailLv');
      var oldTraits = $('detailTraits');
      if (oldLv) oldLv.parentNode.removeChild(oldLv);
      if (oldTraits) oldTraits.parentNode.removeChild(oldTraits);
    }
    var traitBtn = $('detailMeta').querySelector('[data-trait-help]');
    if (traitBtn) traitBtn.onclick = function () { traitHelp(w); };
    $('detail').classList.add('open');
  }

  // 卡面只放图标和战力数字，详情页给出武器名称和战力构成
  function powerInfo(w) {
    var lv = levelsOf(w), pp = Card.powerParts(w, lv), wk = Card.weaponKinds(w, lv);
    var wpn = function (k, lab) {
      return '<span class="dp-w">' + Card.weaponIcon(k, '') + '<em>' + lab + '</em>' + Card.KINDS[k].nm + '</span>';
    };
    return '<div class="dpow">' +
      '<div class="dp-top"><b>战力 <strong>' + pp.total + '</strong><button class="dp-q" data-pow-help>?</button></b>' +
        '<span class="dp-ws">' + wpn(wk.main, '主') + (wk.sub ? wpn(wk.sub, '副') : '') + '</span></div>' +
      (w.hid ? '<p class="dp-passive">隐藏被动：完整记忆 · 整词默写成功后，本场所有武器词条效果 +10%</p>' : '') +
    '</div>';
  }

  function powerHelp(w) {
    var dlg = mk('div', 'pw-dlg');
    dlg.innerHTML = '<div class="pw-box">' +
      '<h3>什么是战力？</h3>' +
      '<p>战力：这张卡当前的综合战斗能力。</p>' +
      '<ul>' +
        '<li><b>输出</b>：伤害和发射频率。</li>' +
        '<li><b>稳定性</b>：命中和持续输出能力。</li>' +
        '<li><b>覆盖</b>：范围、穿透和多目标能力。</li>' +
        '<li><b>控制 / 防御</b>：减速、连锁、卫星挡弹等效果。</li>' +
      '</ul>' +
      '<p class="pw-note">每个字母先增强自己的武器词条，再汇总成一个综合比较值。</p>' +
      '<button class="pw-ok">知道了</button></div>';
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.classList.contains('pw-ok')) dlg.remove();
    });
    document.body.appendChild(dlg);
  }

  function traitHelp(w) {
    var traits = Card.letterTraits(w, levelsOf(w)) || [];
    var rows = traits.map(function (t, i) {
      return '<div><b>' + w.w.charAt(i).toUpperCase() + ' · ' + t.name + '</b>' +
        '<span>基础 ' + t.base + '，每级幅度 ' + t.step + ' × 成长率 ' + t.grow +
        ' → 当前 ' + t.text.replace(t.unit + ' ', '') + '</span></div>';
    }).join('');
    var dlg = mk('div', 'pw-dlg');
    dlg.innerHTML = '<div class="pw-box trait-help-box">' +
      '<h3>字母词条怎么算？</h3>' +
      '<p>每个字母有自己的基础值和升级幅度，成长率只作用于升级部分。</p>' +
      '<p class="pw-note">当前值 = 基础值 + 四舍五入（(Lv − 1) × 每级增量 × 成长率）</p>' +
      '<div class="trait-calc">' + rows + '</div>' +
      '<button class="pw-ok">知道了</button></div>';
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.classList.contains('pw-ok')) dlg.remove();
    });
    document.body.appendChild(dlg);
  }

  function renderUpgrade(w) {
    var box = $('detailLv');
    var oldTraits = $('detailTraits');
    if (oldTraits) oldTraits.parentNode.removeChild(oldTraits);
    if (!box) {
      box = mk('div', 'lv-panel');
      box.id = 'detailLv';
      $('detailMeta').appendChild(box);
    }
    var lv = levelsOf(w);
    if (!lv) { box.innerHTML = ''; return; }
    var cl = cardLvOf(w), cap = capOf(w);
    box.innerHTML = '<div class="lg-head"><div><b>字母成长</b><button class="lg-help" data-trait-help>?</button></div><div class="lg-tags"><em>成长点 ' +
      (DEV_MODE ? '∞' : state.ink) + '</em></div></div>';

    var row = mk('div', 'lg-grid');
    var traits = Card.letterTraits ? Card.letterTraits(w, lv) : [];
    var hid = !!(state.owned[w.w] && state.owned[w.w].hid);
    w.w.toUpperCase().split('').forEach(function (ch, i) {
      var k = Card.letterKind(ch);
      var trait = traits[i];
      var full = lv[i] >= cap;
      var locked = !full && stageOf(w) < stageNeedFor(lv[i] + 1);
      var item = mk('div', 'lg-card lv' + Math.min(lv[i], 6) + (full ? ' full' : '') + (locked ? ' locked' : '') +
        (!full && lv[i] <= cl ? ' next' : ''));
      item.style.setProperty('--k', Card.KINDS[k].c);
      item.innerHTML = '<i class="lg-lv">' + (full ? 'MAX' : 'Lv' + lv[i]) + '</i>' +
        '<div class="lg-tile">' + Card.typeTileSVG(ch, Math.min(lv[i], 5), 34, { mythic: hid }) + '</div>' +
        '<div class="lg-info"><b>' + trait.name + '</b><span>' + trait.text + '</span>' +
        (full ? '' : '<em>' + trait.next + '</em>') + '</div>';
      if (!full) {
        var b = mk('button', 'lg-up');
        b.type = 'button';
        b.innerHTML = locked ? '🔒<small>' + (stageNeedFor(lv[i] + 1) + 1) + '阶</small>' :
          '升级<small>' + upgradeCost(lv[i]) + '</small>';
        b.disabled = locked;
        b.onclick = function () { if (upgradeLetter(w, i)) openDetail(w); };
        item.appendChild(b);
      }
      row.appendChild(item);
    });
    box.appendChild(row);
  }

  /* ── 词条（详情页完整释义）───────────────────── */
  function entryHTML(w) {
    var poses = { n: 'n.', v: 'v.', adj: 'adj.', adv: 'adv.' };
    var rows = '';
    if (w.senses && w.senses.length) {
      w.senses.forEach(function (x, i) {
        rows += '<div class="ei"><span class="no">' + (i + 1) + '</span>' +
          '<span class="pos">' + (poses[x.pos] || poses[w.pos] || '') + '</span>' +
          '<span class="txt">' + x.cn + '</span></div>';
      });
    } else {
      rows = '<div class="ei"><span class="no">1</span>' +
        '<span class="pos">' + (poses[w.pos] || '') + '</span>' +
        '<span class="txt">' + (w.cn || '') + '</span></div>';
    }
    var exs = (w.exs && w.exs.length) ? w.exs : (w.ex ? [{ en: w.ex, cn: w.exCn }] : []);
    var exHtml = exs.map(function (e) {
      return '<div class="ee"><p class="en">' + e.en + '</p><p class="cn">' + e.cn + '</p></div>';
    }).join('');
    return '<div class="entry">' + rows + '</div>' +
      (exHtml ? '<div class="exlist">' + exHtml + '</div>' : '');
  }

  /* ── 导出图片 ─────────────────────────────────── */
  function exportImage(w) {
    var scale = 3;
    var cv = document.createElement('canvas');
    cv.width = Card.CARD_W * scale;
    cv.height = Card.CARD_H * scale;
    var ctx = cv.getContext('2d');
    Card.drawToCanvas(ctx, cv.width, cv.height, w, { mastery: starsOf(w), levels: levelsOf(w) });
    var url = cv.toDataURL('image/png');
    sfx('shutter');

    var ov = mk('div');
    ov.style.cssText =
      'position:fixed;inset:0;z-index:96;background:rgba(12,9,6,.97);display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:16px;padding:26px;';
    ov.innerHTML =
      '<img src="' + url + '" style="max-width:100%;max-height:70vh;box-shadow:0 24px 60px -24px #000">' +
      '<div style="font-size:11px;letter-spacing:.22em;color:rgba(242,233,216,.45)">长按图片保存</div>';
    var close = mk('button', 'btn');
    close.textContent = '关 闭';
    close.style.cssText = 'padding:0 34px;height:42px;flex:0 0 auto';
    close.onclick = function () { ov.parentNode.removeChild(ov); };
    ov.appendChild(close);
    document.body.appendChild(ov);
  }

  /* ── 今日词历 ─────────────────────────────────── */
  /* ── 今日词历 / 每日任务 ───────────────────────────
     每日任务不再直接发新词（那是抽卡的事），而是推动复习与持续学习。 */
  var DAILY_TASKS = [
    { id: 'spell', need: 3, short: '拼写', nm: '拼写 3 个词', sub: '抽卡拼写或默写都算', rw: '抽卡 +1', reward: 'draw', amount: 1, ico: 'pen' },
    { id: 'review', need: 2, short: '复习', nm: '复习 2 个到期词', sub: '下方复习列表，隔 2 天到期', rw: '抽卡 +1', reward: 'draw', amount: 1, ico: 'loop' },
    { id: 'battle', need: 1, short: '漫游', nm: '完成 1 次漫游', sub: '胜负都算完成', rw: '成长点 +15', reward: 'ink', amount: 15, ico: 'sword' },
    { id: 'win', need: 2, short: '通关', nm: '漫游通关 2 关', sub: '通关还有几率掉落抽卡券', rw: '抽卡 +1', reward: 'draw', amount: 1, ico: 'cup' },
  ];
  var TASK_ICO = {
    pen: '<path d="M5 19l1-4L16 5l3 3L9 18z"/><path d="M14 7l3 3"/>',
    loop: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
    sword: '<path d="M5 4l9 9M4 9l5-5M19 20l-6-6M14 19l5-5"/>',
    cup: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.6M16 6h2.5a2.5 2.5 0 0 1-2.6 3.6M12 13v4M8.5 20h7"/>',
  };
  function taskIco(k) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + TASK_ICO[k] + '</svg>';
  }
  function swapLeft() {
    quotaLeft();
    return Math.max(0, INK_SWAP_CAP - (state.quota.swap || 0));
  }
  function inkSwap() {
    if (swapLeft() <= 0) { toast('今日兑换次数已用完'); sfx('deny'); return; }
    if (!DEV_MODE && state.ink < INK_PER_DRAW) { toast('成长点不足 ' + INK_PER_DRAW); sfx('deny'); return; }
    if (!grantBonus()) { toast('今日额外抽卡已达上限'); sfx('deny'); return; }
    if (!DEV_MODE) state.ink -= INK_PER_DRAW;
    state.quota.swap = (state.quota.swap || 0) + 1;
    save();
    sfx('claim');
    refreshCounts();
    renderDaily();
    toast('兑换成功 · 抽卡 +1 组');
  }

  function ensureDay() {
    var t = todayStr();
    if (state.day && state.day.d === t) return;
    // 仅初始化当天数据；连续打卡必须由用户点击个人页的打卡模块完成。
    state.day = { d: t, g: { spell: 0, review: 0, battle: 0, win: 0 }, claimed: {}, checkedIn: false };
    save();
  }
  function checkInToday() {
    ensureDay();
    if (state.day.checkedIn) return false;
    var t = todayStr();
    if (state.lastDay === yesterdayStr()) state.streak = (state.streak || 0) + 1;
    else state.streak = 1;
    state.lastDay = t;
    state.day.checkedIn = true;
    state.ink += CHECKIN_REWARD;
    state.stats = state.stats || {};
    state.stats.ci = (state.stats.ci || 0) + 1;   // 累计打卡天数
    save();
    refreshCounts();
    checkAchievementUnlocks();
    return true;
  }
  function renderCheckin() {
    ensureDay();
    var btn = $('pfCheckin'), lab = $('pfCheckinLab');
    if (!btn || !lab) return;
    var on = !!(state.day && state.day.checkedIn);
    btn.classList.toggle('done', on);
    lab.textContent = on ? ('连续 ' + (state.streak || 1) + ' 天') : '签到';
  }
  function ensureDayG() {
    ensureDay();
    if (!state.day.g) state.day.g = {};
    DAILY_TASKS.forEach(function (t) { if (!(t.id in state.day.g)) state.day.g[t.id] = 0; });
    if (!state.day.claimed) state.day.claimed = {};
    return state.day;
  }
  function dayNum(s) {
    var p = String(s || '').split('-');
    return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]).getTime() : 0;
  }
  function daysSince(s) {
    if (!s) return 999;
    return Math.floor((new Date(todayStr()).getTime() - dayNum(s)) / 86400000);
  }
  // 到期复习：已收录且超过 2 天没拼过
  function reviewDue(w) {
    var o = state.owned[w.w];
    if (!o) return false;
    return daysSince(o.ls) >= 2;
  }
  function reviewPool(n) {
    var arr = [];
    for (var k in state.owned) {
      var w = BY_WORD[k];
      if (!w) continue;
      if (!reviewDue(w)) continue;
      arr.push(w);
    }
    arr.sort(function (a, b) {
      return daysSince(state.owned[b.w].ls) - daysSince(state.owned[a.w].ls);
    });
    return n ? arr.slice(0, n) : arr;
  }
  function addDaily(key) {
    var d = ensureDayG();
    if (!(key in d.g)) return;
    d.g[key]++;
    // 单日三合一：打卡 + 拼写 + 漫游都在同一天完成
    var s = state.stats = state.stats || {};
    if (state.day && state.day.checkedIn && (d.g.spell || 0) >= 1 && (d.g.battle || 0) >= 1 && s.trioD !== d.d) {
      s.trioD = d.d;
      s.trio = (s.trio || 0) + 1;
    }
    save();
    updateDailyBrief();
  }

  function openDaily() {
    sfx('sheet');
    ensureDayG();
    renderDaily();
    $('daily').classList.add('open');
  }

  function renderDaily() {
    var d = ensureDayG();
    var doneN = DAILY_TASKS.filter(function (t) { return (d.g[t.id] || 0) >= t.need; }).length;
    $('dailyStreak').textContent = '连续 ' + (state.streak || 1) + ' 天';
    var left = quotaLeft();
    $('dailyNote').innerHTML =
      '<div class="dh-ring" style="--p:' + (doneN / DAILY_TASKS.length * 100).toFixed(1) + '"><b>' + doneN +
      '<i>/' + DAILY_TASKS.length + '</i></b><span>已完成</span></div>' +
      '<div class="dh-main"><p class="dh-k">今日剩余抽卡</p><p class="dh-v"><b>' + (DEV_MODE ? '∞' : left) +
      '</b> 组<em>每组 3 张</em></p><p class="dh-s">免费 ' + FREE_PER_DAY + ' 组 · 已获额外 ' +
      (state.quota.bonus || 0) + ' / ' + BONUS_CAP + '</p></div>';
    updateDailyBrief();

    var grid = $('dailyGrid');
    grid.innerHTML = '';
    var sec = mk('div', 'dsec');
    sec.innerHTML = '<b>每日任务</b><span>完成后领取对应奖励</span>';
    grid.appendChild(sec);
    DAILY_TASKS.forEach(function (t) {
      var cur = Math.min(d.g[t.id] || 0, t.need);
      var ok = cur >= t.need;
      var claimed = !!d.claimed[t.id];
      var row = mk('div', 'dtask' + (ok ? ' ok' : '') + (claimed ? ' claimed' : ''));
      row.innerHTML =
        '<span class="dt-ico">' + taskIco(t.ico) + '</span>' +
        '<div class="dt-main"><b>' + t.nm + '<em>' + cur + '/' + t.need + '</em></b><span>' + t.sub + '</span>' +
        '<div class="dt-bar"><i style="width:' + Math.round(cur / t.need * 100) + '%"></i></div></div>' +
        '<div class="dt-right"></div>';
      var btn = mk('button', 'dt-claim');
      btn.innerHTML = claimed ? '已领取' : '<i>' + t.rw + '</i>' + (ok ? '领取' : '未完成');
      btn.disabled = claimed || !ok;
      if (ok && !claimed) btn.classList.add('ready');
      btn.onclick = function () {
        if (d.claimed[t.id]) return;
        d.claimed[t.id] = true;
        sfx('claim');
        claimDaily(t);
        save();
        renderDaily();
        refreshCounts();
        toast('任务完成 · ' + t.rw);
      };
      row.querySelector('.dt-right').appendChild(btn);
      grid.appendChild(row);
    });

    var sw = swapLeft();
    var swap = mk('div', 'dswap');
    swap.innerHTML = '<span class="dt-ico ink"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5Z"/></svg></span><div class="dt-main"><b>成长点兑换</b><span>' +
      INK_PER_DRAW + ' 成长点换 1 组抽卡 · 今日还可兑换 ' + sw + ' 次</span></div>';
    var sb = mk('button', 'dt-claim' + (sw ? ' ready' : ''));
    sb.innerHTML = '<i>−' + INK_PER_DRAW + ' 成长点</i>兑换';
    sb.disabled = !sw;
    sb.onclick = inkSwap;
    swap.appendChild(sb);
    grid.appendChild(swap);

    // 到期复习入口
    var due = reviewPool(8);
    var head = mk('div', 'dsec');
    head.innerHTML = '<b>到期复习</b><span>' + (due.length ? due.length + ' 个待巩固' : '暂无到期，明天再来') + '</span>';
    grid.appendChild(head);
    if (due.length) {
      var list = mk('div', 'dreview');
      due.forEach(function (w) {
        var it = mk('button', 'drev-item');
        it.innerHTML = '<span class="kl">' + Card.lvGem(cardLvOf(w)) + '</span>' + Card.elemGems(w, levelsOf(w)) +
          '<b>' + w.w + '</b><em>' + w.cn + '</em><i>' + daysSince(state.owned[w.w].ls) + ' 天未复习</i>';
        it.onclick = function () {
          $('daily').classList.remove('open');
          startWrite(w);
        };
        list.appendChild(it);
      });
      grid.appendChild(list);
    }
  }

  function claimDaily(t) {
    if (t.reward === 'ink') {
      state.ink += t.amount || 0;
      refreshCounts();
      return;
    }
    grantBonus();
  }

  var achievementQueue = [], achievementBusy = false;
  var ACH_KIND_NM = { gacha: '抽卡', study: '学习', battle: '漫游', upgrade: '养成', power: '战力', codex: '图鉴', collection: '收藏' };
  var MEDAL_NM = { bronze: '铜章', silver: '银章', gold: '金章', max: '满阶' };
  // 系列内阶段决定奖牌材质：前 1/3 铜、中段银、后段金、最后一阶满阶
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
  function achName(a) { return a.sname + ' ' + (ROMAN[a.sidx] || a.sidx + 1); }
  function medalTier(idx, len) {
    if (idx < 0) return 'none';
    if (idx >= len - 1) return 'max';
    var r = (idx + 1) / len;
    return r >= 0.67 ? 'gold' : r >= 0.34 ? 'silver' : 'bronze';
  }
  var TIER_LV = { bronze: 1, silver: 2, gold: 3, max: 4 };
  function buildAchPop() {
    if (buildAchPop.done) return;
    buildAchPop.done = true;
    $('achievementPop').addEventListener('click', closeAchievement);
  }
  function closeAchievement() {
    var pop = $('achievementPop');
    if (!pop || !pop.classList.contains('show') || pop.classList.contains('out')) return;
    clearTimeout(closeAchievement.tm);
    pop.classList.add('out');
    setTimeout(function () {
      pop.className = 'achievement-pop';
      pop.setAttribute('aria-hidden', 'true');
      achievementBusy = false;
      showNextAchievement();
    }, 200);
  }
  function showAchievement(a) {
    var pop = $('achievementPop');
    if (!pop) return;
    buildAchPop();
    var tier = medalTier(a.sidx, a.slen);
    pop.className = 'achievement-pop';
    void pop.offsetWidth;
    pop.className = 'achievement-pop show k-' + a.kind + ' m-' + tier;
    pop.setAttribute('aria-hidden', 'false');
    $('apIcon').textContent = a.icon;
    $('apLv').textContent = ROMAN[a.sidx] || a.sidx + 1;
    $('apKicker').textContent = (ACH_KIND_NM[a.kind] || '收藏') + '成就达成';
    $('apName').textContent = achName(a);
    $('apLevel').textContent = MEDAL_NM[tier];
    $('apDesc').textContent = a.d;
    var burst = $('apBurst'), n = tier === 'max' ? 36 : tier === 'gold' ? 30 : 22, html = '';
    for (var i = 0; i < n; i++) {
      html += '<i style="--a:' + Math.round(i * 360 / n + Math.random() * 14) + 'deg;--r:' +
        Math.round(90 + Math.random() * 90) + 'px;--d:' + Math.round(140 + Math.random() * 120) + 'ms;--s:' +
        (5 + Math.random() * 6).toFixed(1) + 'px"></i>';
    }
    burst.innerHTML = html;
    var motes = '';
    for (var j = 0; j < (tier === 'max' ? 18 : 12); j++) {
      motes += '<i style="--x:' + Math.round(Math.random() * 260 - 130) + 'px;--d:' + Math.round(300 + Math.random() * 1300) +
        'ms;--t:' + (1.6 + Math.random() * 0.9).toFixed(2) + 's;--s:' + (2 + Math.random() * 2.5).toFixed(1) + 'px"></i>';
    }
    $('apMotes').innerHTML = motes;
    sfx('jackpot', TIER_LV[tier] || 1);
    buzz(tier === 'max' ? [20, 40, 30] : [18, 30, 12]);
    clearTimeout(closeAchievement.tm);
    closeAchievement.tm = setTimeout(closeAchievement, 2600);
  }
  function showNextAchievement() {
    if (achievementBusy || !achievementQueue.length) return;
    achievementBusy = true;
    showAchievement(achievementQueue.shift());
  }
  function queueAchievements(list) {
    if (!list || !list.length) return;
    achievementQueue = achievementQueue.concat(list);
    showNextAchievement();
  }

  var achievementFilter = 'all';
  // 战力缓存：成就检查很频繁，避免每次都重算整张卡
  var pwCache = {};
  function powerCached(w, lv) {
    if (!Card.powerParts) return 0;
    var sig = lv ? lv.join(':') : '';
    var c = pwCache[w.w];
    if (!c || c.sig !== sig) {
      var pp = Card.powerParts(w, lv);
      c = pwCache[w.w] = { sig: sig, total: (pp && pp.total) || 0 };
    }
    return c.total;
  }
  function achievementList() {
    var owned = Object.keys(state.owned).length, mastered = countMastered();
    var t2 = 0, t5 = 0, nTier = 0, rTier = 0, sr = 0, ssr = 0, ur = 0, ex = 0;
    var maxLetter = 0, letterUp = 0, totalWrites = 0, practiced = 0, stage3 = 0;
    // 分品阶满级数：让低阶卡也有明确的养成目标（N/R 满级同样计数）
    var nMax = 0, rMax = 0, srMax = 0, ssrMax = 0, urMax = 0, lvSum = 0;
    var pwMax = 0, pwSum = 0;
    for (var k in state.owned) {
      var w = BY_WORD[k], rec = state.owned[k];
      if (!w) continue;
      var cl = cardLvOf(w), lv = levelsOf(w) || [];
      totalWrites += rec.wr || 0;
      lvSum += cl;
      var pw = powerCached(w, lv);
      pwMax = Math.max(pwMax, pw); pwSum += pw;
      if ((rec.wr || 0) > 0) practiced++;
      if ((rec.stage || 0) >= 3) stage3++;
      if (cl >= 2) t2++;
      if (cl >= 5) t5++;
      if (w.hid || rec.hid) ex++;
      else {
        if (w.tier <= 1) nTier++;
        else if (w.tier === 2) rTier++;
        else if (w.tier >= 5) ur++;
        else if (w.tier >= 4) ssr++;
        else if (w.tier >= 3) sr++;
        if (cl >= 5) {
          if (w.tier <= 1) nMax++;
          else if (w.tier === 2) rMax++;
          else if (w.tier >= 5) urMax++;
          else if (w.tier >= 4) ssrMax++;
          else if (w.tier >= 3) srMax++;
        }
      }
      lv.forEach(function (n) { maxLetter = Math.max(maxLetter, n); letterUp += Math.max(0, n - 1); });
    }
    // 分类收录 / 主武器覆盖 / 长词满级：都按「已拥有 + 已满级」统计
    var tagOwn = {}, tagAll = {}, mainSet = {}, longN = 0;
    var drawableN = 0;
    WORDS.forEach(function (x) {
      if (x.w.length > MAX_WORD_LEN) return;
      drawableN++;
      if (x.tag) tagAll[x.tag] = (tagAll[x.tag] || 0) + 1;
    });
    var kindSet = {};
    for (var k2 in state.owned) {
      var w2 = BY_WORD[k2];
      if (!w2) continue;
      if (w2.tag) tagOwn[w2.tag] = (tagOwn[w2.tag] || 0) + 1;
      if (cardLvOf(w2) < 5) continue;
      var lv2 = levelsOf(w2) || [];
      if (w2.w.length >= 8) longN++;
      var wk2 = Card.weaponKinds ? Card.weaponKinds(w2, lv2) : null;
      if (wk2 && wk2.main) { mainSet[wk2.main] = 1; kindSet[wk2.main] = 1; if (wk2.sub) kindSet[wk2.sub] = 1; }
    }
    var tagFullN = 0;
    for (var tg in tagAll) if (tagAll[tg] && (tagOwn[tg] || 0) >= tagAll[tg]) tagFullN++;
    var mainN = 0; for (var mk in mainSet) mainN++;
    var kindN = 0; for (var kk in kindSet) kindN++;
    var ltrN = 0; var ltrMap = (state.stats && state.stats.ltr) || {};
    for (var lk in ltrMap) if (ltrMap[lk]) ltrN++;
    var allWords = drawableN || 1;
    var collPct = Math.floor(owned * 100 / allWords);
    // 每个品阶里最少的那个满级数：用来要求「全品阶都养到」
    var tierFloor = Math.min(nMax, rMax, srMax, ssrMax, urMax);
    var fullTierN = [nMax, rMax, srMax, ssrMax, urMax].filter(function (n) { return n > 0; }).length;
    var stats = state.stats || {}, wins = stats.wins || 0;
    var battles = stats.battles || 0, kills = stats.kills || 0, stars = stats.stars || 0;
    // 打卡 / 放弃 / 成长点积蓄：由存档里的累计字段提供
    var ci = stats.ci || 0, inkMax = Math.max(stats.inkMax || 0, state.ink || 0);
    var abT = stats.abT || {}, abTotal = stats.ab || 0;
    var abTierN = 0;
    for (var ak in abT) if (abT[ak] > 0) abTierN++;
    var abUR = abT[5] || 0, abHid = abT[6] || 0;
    // 战斗过程类：无伤 / 无大招 / 竞速 / 连续胜负 / 单局记录
    var nohit = stats.nohit || 0, noult = stats.noult || 0;
    var bossTS = Math.round(stats.bossTS || 0), runTS = Math.round(stats.runTS || 0);
    var killBest = stats.killBest || 0, wordsBest = stats.wordsBest || 0;
    var cwBest = stats.cwBest || 0, clBest = stats.clBest || 0;
    // 学习过程类：完美收服 / 词灵挣脱 / 失败连击 / 重复卡 / 非酋 / 单日三合一 / 抽满配额
    var pf = stats.pf || 0, esc = stats.esc || 0, failBest = stats.failBest || 0;
    var dup = stats.dup || 0, dryBest = stats.dryBest || 0;
    var trio = stats.trio || 0, quotaFull = stats.quotaFull || 0, abBack = stats.abBack || 0;
    var codex = Object.keys(state.codex || {}).length, regions = 0;
    for (var ri = 0; ri < REGIONS.length; ri++) {
      var rg = state.stages && state.stages[REGIONS[ri].id];
      if (rg && rg.c >= 5) regions++;
    }
    var out = [], add = function (cat, kind, key, title, desc, cur, targets, icon) {
      targets.forEach(function (n, i) {
        out.push({ id: key + '_' + n, cat: cat, kind: kind, icon: icon || '✦',
          nm: title + ' · ' + n, d: desc.replace('{n}', n), cur: cur, max: n,
          series: key, sname: title, sidx: i, slen: targets.length, targets: targets, desc: desc });
      });
    };
    // 越小越好（用时类）：val <= 目标即达成，进度按目标/实际折算
    var addLow = function (cat, kind, key, title, desc, val, targets, icon) {
      targets.forEach(function (n, i) {
        var cur = val > 0 ? Math.min(n, Math.round(n * n / val)) : 0;
        out.push({ id: key + '_' + n, cat: cat, kind: kind, icon: icon || '✦',
          nm: title + ' · ' + n, d: desc.replace('{n}', n), cur: cur, max: n,
          series: key, sname: title, sidx: i, slen: targets.length, targets: targets, desc: desc });
      });
    };
    add('gacha', 'gacha', 'draw', '抽卡记录', '累计抽到 {n} 张卡', state.draws, [1, 3, 5, 10, 20, 30, 50, 80, 100, 200, 300, 500, 800, 1000, 2000], '✦');
    add('gacha', 'gacha', 'sr', '稀见入手', '累计获得 {n} 张 SR 卡', sr, [1, 3, 5, 10, 20, 30, 50, 80, 100, 200], '◇');
    add('gacha', 'gacha', 'ssr', '秘典入藏', '累计获得 {n} 张 SSR 卡', ssr, [1, 2, 3, 5, 10, 20, 30, 50, 80, 100], '◆');
    add('gacha', 'gacha', 'ur', '孤本现世', '累计获得 {n} 张 UR 卡', ur, [1, 2, 3, 5, 8, 10, 20, 50], '★');
    add('gacha', 'gacha', 'ex', '隐藏现世', '累计获得 {n} 张 EX 隐藏卡', ex, [1, 2, 3, 5, 8, 10], '☼');
    add('collection', 'collection', 'owned', '词册收藏', '收集 {n} 张词卡', owned, [1, 3, 5, 10, 20, 30, 50, 80, 100, 150, 200, 300, 500, 800, 1000, 1500, 2000], '▦');
    add('collection', 'collection', 'mastered', '通晓词义', '{n} 个单词默写满星', mastered, [1, 3, 5, 10, 20, 30, 50, 80, 100, 150, 200, 300, 500, 800, 1000], '✎');
    add('collection', 'collection', 'tier', '全品阶收藏', '至少拥有 {n} 个不同品阶', [nTier, rTier, sr, ssr, ur, ex].filter(function (n) { return n > 0; }).length, [1, 2, 3, 4, 5, 6], '◎');
    add('study', 'study', 'write', '默写练习', '累计正确默写 {n} 次', totalWrites, [1, 3, 5, 10, 20, 30, 50, 80, 100, 200, 300, 500, 800, 1000, 2000], '✎');
    add('study', 'study', 'practice', '广泛涉猎', '练习 {n} 个不同单词', practiced, [1, 3, 5, 10, 20, 30, 50, 80, 100, 200, 300, 500], '☰');
    add('study', 'study', 'stage', '熟练进阶', '{n} 个单词达到熟练度第 3 阶', stage3, [1, 3, 5, 10, 20, 30, 50, 80, 100, 200], '↗');
    add('study', 'study', 'streak', '连续学习', '连续学习 {n} 天', state.streak || 1, [3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 365], '♨');
    add('upgrade', 'upgrade', 'cardlv', '卡牌培养', '{n} 张词卡达到 Lv5', t5, [1, 2, 3, 5, 10, 20, 30, 50, 80, 100, 200], '⬆');
    add('upgrade', 'upgrade', 'cardlv2', '初次升级', '{n} 张词卡达到 Lv2', t2, [1, 3, 5, 10, 20, 30, 50, 80, 100], '◆');
    add('upgrade', 'upgrade', 'nmax', '常本满级', '{n} 张 N 卡练到 Lv5', nMax, [1, 3, 5, 10, 20, 30, 50, 80, 120, 200], 'N');
    add('upgrade', 'upgrade', 'rmax', '藏本满级', '{n} 张 R 卡练到 Lv5', rMax, [1, 3, 5, 10, 20, 30, 50], 'R');
    add('upgrade', 'upgrade', 'srmax', '稀见满级', '{n} 张 SR 卡练到 Lv5', srMax, [1, 2, 3, 5, 10, 20], '◇');
    add('upgrade', 'upgrade', 'ssrmax', '秘典满级', '{n} 张 SSR 卡练到 Lv5', ssrMax, [1, 2, 3, 5, 10], '◆');
    add('upgrade', 'upgrade', 'urmax', '孤本满级', '{n} 张 UR 卡练到 Lv5', urMax, [1, 2, 3, 5, 8], '★');
    add('upgrade', 'upgrade', 'tierfull', '品阶无短板', '五个品阶各有 {n} 张满级卡', tierFloor, [1, 2, 3, 5], '◎');
    add('upgrade', 'upgrade', 'tierreach', '品阶全覆盖', '{n} 个品阶都有满级卡', fullTierN, [1, 2, 3, 4, 5], '⚑');
    add('upgrade', 'upgrade', 'lvsum', '卡册总等级', '所有词卡等级合计达到 {n}', lvSum, [10, 30, 60, 100, 160, 240, 350, 500, 800, 1200], 'Σ');
    // 战力：单卡峰值 / 卡册总和 / 越线首卡
    add('power', 'power', 'pwmax', '单卡战力', '单张最高的卡战力达到 {n}', pwMax, [200, 400, 700, 1000, 1500, 2200, 3000, 4500, 6500, 9000, 13000, 20000], '⚔');
    add('power', 'power', 'pwsum', '卡册战力', '所有词卡战力合计达到 {n}', pwSum, [1000, 2000, 4000, 7000, 12000, 20000, 35000, 60000, 100000, 160000, 260000], '⛨');
    add('power', 'power', 'pwfirst', '越线首卡', '首次拥有一张战力超过 {n} 的卡', pwMax, [1000, 2200, 4500, 9000, 20000], '✦');
    // 放弃：割舍本身也是一种记录
    add('power', 'power', 'abandon', '割舍之道', '累计放弃 {n} 张词卡', abTotal, [1, 3, 5, 10, 20, 40, 80, 150], '✕');
    add('power', 'power', 'abtier', '割舍广度', '放弃过 {n} 个不同品阶的卡', abTierN, [1, 2, 3, 4, 5, 6], '⋮');
    add('power', 'power', 'abur', '弃孤本', '放弃 {n} 张 UR 卡', abUR, [1, 3, 5, 10], '★');
    add('power', 'power', 'abhid', '弃隐藏', '放弃 {n} 张隐藏款', abHid, [1, 3, 5], '☼');
    // 打卡与积蓄
    add('study', 'study', 'checkin', '每日一记', '累计打卡 {n} 天', ci, [1, 3, 7, 15, 30, 60, 100, 180, 365], '☑');
    add('study', 'study', 'inkmax', '成长点积蓄', '成长点存量曾达到 {n}', inkMax, [10, 50, 100, 300, 500, 1000, 2000, 5000, 10000, 20000], '◆');
    // 收藏广度
    add('collection', 'collection', 'tagfull', '分类全通', '{n} 个分类全部收录', tagFullN, [1, 2, 3, 5, 8, 12], '▤');
    add('collection', 'collection', 'mainkind', '兵器谱', '{n} 种主武器都有满级卡', mainN, [1, 2, 3, 4, 5, 6, 7, 8], '⚒');
    add('collection', 'collection', 'kindall', '全兵种满级', '{n} 种武器词条（含副）都有满级卡', kindN, [2, 4, 6, 8, 10, 12, 14, 16], '⚙');
    add('collection', 'collection', 'longword', '长词攻坚', '{n} 张 8 字母以上的词卡练到 Lv5', longN, [1, 3, 5, 10, 20, 30, 50], '≡');
    add('collection', 'collection', 'letters', '字母全通', '升级过 {n} 个不同字母', ltrN, [5, 10, 15, 20, 26], 'A');
    add('collection', 'collection', 'collpct', '图鉴进度', '词册收录率达到 {n}%', collPct, [5, 10, 25, 50, 75, 100], '◐');
    add('collection', 'collection', 'dupcard', '旧识重逢', '重复获得 {n} 张已拥有的词卡', dup, [1, 5, 10, 30, 60, 100, 200, 400], '↻');
    // 学习过程
    add('study', 'study', 'perfect', '完美收服', '{n} 次完美拼写收服', pf, [1, 5, 10, 30, 60, 100, 200, 500], '✧');
    add('study', 'study', 'escape', '失手记录', '累计让 {n} 个词灵挣脱（超时）', esc, [1, 5, 10, 30, 60, 120], '✕');
    add('study', 'study', 'failbest', '屡败屡战', '连续拼写失败 {n} 次', failBest, [2, 5, 10, 20], '↺');
    add('study', 'study', 'trio', '一日三事', '{n} 天同时完成打卡、拼写与漫游', trio, [1, 3, 7, 15, 30, 60, 100], '☰');
    // 抽卡过程
    add('gacha', 'gacha', 'quota', '抽空配额', '{n} 天把当日抽卡配额用尽', quotaFull, [1, 3, 7, 15, 30], '◍');
    add('gacha', 'gacha', 'dry', '非酋之路', '连续 {n} 抽没有 SSR 及以上', dryBest, [10, 30, 50, 80, 120, 200], '☂');
    add('gacha', 'gacha', 'abback', '念念不忘', '{n} 次放弃后 1 分钟内又抽回同一张', abBack, [1, 3, 5, 10], '↩');
    // 漫游过程
    add('power', 'power', 'nohit', '毫发无伤', '{n} 次全程不受任何伤害通关', nohit, [1, 3, 5, 10, 25, 50], '⛨');
    add('power', 'power', 'noult', '不放大招', '{n} 次不用大招通关', noult, [1, 3, 5, 10, 25, 50], '⊘');
    addLow('power', 'power', 'bossfast', '速斩首领', '最快 {n} 秒内击败首领', bossTS, [120, 100, 80, 60, 45, 30], '⏱');
    addLow('power', 'power', 'runspeed', '闪电通关', '最快 {n} 秒通关', runTS, [180, 150, 120, 100, 80, 60], '⚡');
    add('power', 'power', 'killrun', '单局屠戮', '单局击杀 {n} 个敌人', killBest, [20, 40, 60, 80, 120, 200], '☄');
    add('power', 'power', 'wordrun', '单局拼词', '单局拼满 {n} 个单词', wordsBest, [3, 6, 10, 15, 20, 30], '✍');
    add('power', 'power', 'consec', '连胜之路', '连续通关 {n} 次', cwBest, [2, 3, 5, 10, 20, 50], '⌁');
    add('power', 'power', 'conseclose', '屡战屡败', '连续失利 {n} 次', clBest, [3, 5, 10, 20], '☓');
    add('upgrade', 'upgrade', 'letter', '字母工坊', '累计升级字母 {n} 次', letterUp, [1, 3, 5, 10, 20, 30, 50, 80, 100, 200, 300, 500, 800, 1000], 'A');
    add('upgrade', 'upgrade', 'lettermax', '字母登顶', '最高字母等级达到 Lv{n}', maxLetter, [2, 3, 4, 5, 6], 'Λ');
    add('codex', 'codex', 'monster', '怪物图鉴', '收录 {n} 个怪物', codex, [1, 3, 5, 10, 20, 30, 50, 80, 100, 150, 200, 300, 500, 800, 1000], '♞');
    add('expedition', 'battle', 'battle', '漫游足迹', '完成 {n} 次漫游', battles, [1, 3, 5, 10, 20, 30, 50, 80, 100, 200, 300, 500], '⌁');
    add('expedition', 'battle', 'win', '漫游胜利', '累计通关 {n} 次', wins, [1, 3, 5, 10, 20, 30, 50, 80, 100, 200], '⚔');
    add('expedition', 'battle', 'star', '星光之路', '累计获得 {n} 颗关卡星', stars, [1, 3, 5, 10, 20, 30, 50, 80, 100, 200, 300, 500], '✦');
    add('expedition', 'battle', 'kill', '百怪斩', '累计击杀 {n} 个敌人', kills, [1, 10, 30, 50, 100, 200, 300, 500, 800, 1000, 2000, 3000], '☄');
    add('expedition', 'battle', 'region', '远行者', '完成 {n} 个地区', regions, [1, 2, 3, 5, 8, 13, 20, 30, 50, 80, 100], '⌖');
    return out;
  }
  function checkAchievementUnlocks(silentInit) {
    var all = achievementList();
    if (silentInit && !state.achInit) {
      all.forEach(function (a) { if (a.cur >= a.max) state.achSeen[a.id] = true; });
      state.achInit = true;
      save();
      return;
    }
    var fresh = [];
    all.forEach(function (a) {
      if (a.cur >= a.max && !state.achSeen[a.id]) {
        state.achSeen[a.id] = true;
        fresh.push(a);
      }
    });
    if (fresh.length) {
      state.achInit = true;
      save();
      queueAchievements(fresh.slice(0, 3));
    }
  }

  function renderAchievements(box) {
    box = box || $('mineSheetBody');
    var list = achievementList();
    var cats = [
      ['all', '全部'], ['gacha', '抽卡'], ['collection', '收藏'],
      ['study', '学习'], ['upgrade', '养成'], ['power', '战力'], ['codex', '图鉴'], ['expedition', '漫游']
    ];
    var unlocked = list.filter(function (a) { return a.cur >= a.max; }).length;
    checkAchievementUnlocks(true);

    if (!box) return;
    var pct = list.length ? Math.round(unlocked / list.length * 100) : 0;
    var tally = { bronze: 0, silver: 0, gold: 0, max: 0 };
    list.forEach(function (a) { if (a.cur >= a.max) tally[medalTier(a.sidx, a.slen)]++; });
    var html = '<div class="ach-fixed-head"><div class="ach-hero">' +
      '<div class="ach-ring" style="--p:' + pct + '"><b>' + pct + '<i>%</i></b></div>' +
      '<div class="ach-hero-t"><p>成就收藏</p><b>' + unlocked + '<i> / ' + list.length + '</i></b>' +
      '<div class="ach-tally">' + ['bronze', 'silver', 'gold', 'max'].map(function (k) {
        return '<span class="m-' + k + '"><i></i>' + MEDAL_NM[k] + ' ' + tally[k] + '</span>';
      }).join('') + '</div></div></div><div class="ach-tabs">';
    cats.forEach(function (c) {
      html += '<button class="ach-tab' + (achievementFilter === c[0] ? ' on' : '') + '" data-ach-cat="' + c[0] + '">' + c[1] + '</button>';
    });
    html += '</div></div><div class="as-list">';

    // 每一档都是独立成就：奖牌材质由该档在系列中的位置决定，未达成置灰
    list.forEach(function (a) {
      if (achievementFilter !== 'all' && a.cat !== achievementFilter) return;
      var on = a.cur >= a.max, tier = medalTier(a.sidx, a.slen);
      var p = Math.max(0, Math.min(100, a.cur / a.max * 100));
      html += '<div class="as k-' + a.kind + ' m-' + tier + (on ? ' done' : ' none') + '">' +
        '<div class="as-medal"><span>' + a.icon + '</span><b>' + (ROMAN[a.sidx] || a.sidx + 1) + '</b></div>' +
        '<div class="as-main">' +
          '<div class="as-top"><b>' + achName(a) + '</b><span class="as-tier">' + MEDAL_NM[tier] + '</span></div>' +
          '<p class="as-d">' + a.d + '</p>' +
          (on ? '' : '<div class="as-prog"><div class="achs-bar"><i style="width:' + p.toFixed(1) + '%"></i></div>' +
            '<em>' + Math.min(a.cur, a.max) + '/' + a.max + '</em></div>') +
        '</div>' + (on ? '<em class="as-ok">✓</em>' : '') + '</div>';
    });
    box.innerHTML = html + '</div>';
    var tabs = box.querySelectorAll('[data-ach-cat]');
    for (var ti = 0; ti < tabs.length; ti++) tabs[ti].onclick = function () {
      achievementFilter = this.getAttribute('data-ach-cat');
      sfx('tap');
      renderAchievements(box);
    };
  }

  /* ── 默写 ─────────────────────────────────────── */
  // 规则：每词需默写 3 次满星；看一次答案，需求 +1，已写次数不变 → 必须多写
  var WRITE_BASE = 3;
  var PEEK_PENALTY = 1;
  var curWrite = null;

  function recWrite(w) {
    var o = state.owned[w.w] || (state.owned[w.w] = { m: 0, at: Date.now(), wr: 0, pk: 0 });
    if (o.wr === undefined) o.wr = 0;
    if (o.pk === undefined) o.pk = 0;
    return o;
  }
  function recRead(w) {
    var o = state.owned[w.w];
    return o ? recWrite(w) : { wr: 0, pk: 0 };
  }
  function needOf(w) {
    var o = recRead(w);
    return Math.min(8, WRITE_BASE + o.pk * PEEK_PENALTY);
  }
  function starsOf(w) {
    var o = recRead(w);
    var need = needOf(w);
    if (!need) return 0;
    return Math.max(0, Math.min(3, Math.floor((o.wr * 3) / need)));
  }

  /* ── 熟练度 XP 与段内阶段（N1 → N2 → N3）─────────────
     每天每词前 5 次完整收益，6~10 次少量，超过 10 次不产出，
     但仍然允许一直练习，不硬锁玩家。 */
  var XP_STAGE_GATE = [0, 45, 100, 170]; // 阶段 1/2/3 的累计 XP 门槛
  var XP_FULL_TIMES = 5;                  // 每日完整收益次数
  var XP_HALF_TIMES = 10;                 // 每日半收益截止
  var XP_PER_COPY = 15;                   // 照卡拼对
  var XP_PER_PERFECT = 22;                 // 零失误
  var XP_PER_WRITE = 10;                  // 默写正确

  function progOf(w) {
    var o = state.owned[w.w];
    if (!o) return null;
    if (typeof o.xp !== 'number') o.xp = 0;
    if (typeof o.stage !== 'number') o.stage = 0;
    if (!o.pd) { o.pd = ''; o.pn = 0; }
    return o;
  }
  function stageOf(w) { var o = progOf(w); return o ? Math.min(2, o.stage || 0) : 0; }
  function addXp(w, base) {
    var o = progOf(w);
    if (!o || base <= 0) return 0;
    var t = todayStr();
    if (o.pd !== t) { o.pd = t; o.pn = 0; }
    o.pn++;
    o.ls = todayStr();   // 最近一次拼写日期，用于「到期复习」
    var gain = o.pn <= XP_FULL_TIMES ? base : o.pn <= XP_HALF_TIMES ? Math.round(base * 0.4) : 0;
    if (gain <= 0) { save(); return 0; }
    o.xp += gain;
    var st = o.stage || 0;
    while (st < 2 && o.xp >= XP_STAGE_GATE[st + 1]) st++;
    o.stage = st;
    save();
    return gain;
  }
  function xpOf(w) { var o = progOf(w); return o ? o.xp : 0; }

  /* 熟练度组件：三阶刻度 + 进度条 + 获取途径（详情页 / 默写页共用） */
  var XP_SRC = '抽卡拼对 +15（零失误 +22）· 默写 +10 · 漫游拼满单词 +8 · 漫游通关 +12';
  function xpWidget(w, opts) {
    opts = opts || {};
    var xp = xpOf(w), st = stageOf(w), top = XP_STAGE_GATE[2];
    var pct = Math.min(100, xp / top * 100);
    var mark = XP_STAGE_GATE[1] / top * 100;
    var full = st >= 2;
    var steps = ['1 阶', '2 阶 · 解锁 Lv4', '3 阶 · 解锁 Lv5'].map(function (t, i) {
      return '<span class="' + (st >= i ? 'on' : '') + '">' + t + '</span>';
    }).join('');
    return '<div class="xpw' + (full ? ' full' : '') + '">' +
      '<div class="xpw-top"><b>熟练度<button class="dp-q" data-stage-help type="button" aria-label="熟练阶说明">?</button></b><span class="xpw-num">' +
        (full ? '已满 · 字母可升到满级' : xp + ' / ' + (xpNeedOf(w) || top) + ' XP') + '</span></div>' +
      '<div class="xpw-bar"><i style="width:' + pct.toFixed(1) + '%"></i><em style="left:' + mark.toFixed(1) + '%"></em></div>' +
      '<div class="xpw-steps">' + steps + '</div>' +
      (opts.src === false ? '' : '<p class="xpw-src">获取：' + XP_SRC + '</p>') +
    '</div>';
  }
  // 详情页用的单行熟练度条
  function xpMini(w) {
    var xp = xpOf(w), st = stageOf(w), top = XP_STAGE_GATE[2], full = st >= 2;
    var pct = Math.min(100, xp / top * 100), mark = XP_STAGE_GATE[1] / top * 100;
    return '<div class="dxp' + (full ? ' full' : '') + '"><b>熟练 ' + (st + 1) + ' 阶<button class="dp-q" data-stage-help type="button" aria-label="熟练阶说明">?</button></b>' +
      '<div class="xpw-bar"><i style="width:' + pct.toFixed(1) + '%"></i><em style="left:' + mark.toFixed(1) + '%"></em></div>' +
      '<span>' + (full ? '已满' : xp + '/' + (xpNeedOf(w) || top)) + '</span></div>';
  }
  function stageHelp() {
    var dlg = mk('div', 'pw-dlg');
    dlg.innerHTML = '<div class="pw-box">' +
      '<h3>熟练阶是什么？</h3>' +
      '<p>练这个词会攒熟练度 XP，攒够就升阶。升阶后才能把字母升到更高等级。</p>' +
      '<ul>' +
        '<li><b>1 阶</b>：起步，字母最高升到 Lv3</li>' +
        '<li><b>2 阶</b>：解锁字母升到 Lv4（需 45 XP）</li>' +
        '<li><b>3 阶</b>：解锁字母升到 Lv5 / 满级（需 100 XP）</li>' +
      '</ul>' +
      '<p><b>怎么获得</b></p>' +
      '<ul>' +
        '<li>抽卡拼对 <b>+15</b>（零失误 <b>+22</b>）</li>' +
        '<li>默写正确 <b>+10</b></li>' +
        '<li>漫游拼满单词 <b>+8</b> · 通关 <b>+12</b></li>' +
      '</ul>' +
      '<p class="pw-note">每个词每天前 5 次全额，第 6～10 次减半，超过不再涨。</p>' +
      '<button class="pw-ok">知道了</button></div>';
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.classList.contains('pw-ok')) dlg.remove();
    });
    document.body.appendChild(dlg);
  }
  // 熟练度增长动画：进度条推进 + 浮出 +N
  function bumpXp(box, w, gain) {
    if (!box) return;
    var old = box.querySelector('.xpw-bar i');
    var from = old ? old.style.width : '0%';
    box.innerHTML = xpWidget(w, { src: false });
    var bar = box.querySelector('.xpw-bar i');
    if (bar) {
      var to = bar.style.width;
      bar.style.transition = 'none';
      bar.style.width = from;
      void bar.offsetWidth;
      bar.style.transition = '';
      bar.style.width = to;
    }
    var f = mk('span', 'xpw-float');
    f.textContent = gain > 0 ? '+' + gain + ' XP' : '今日收益已满';
    if (gain <= 0) f.classList.add('dim');
    box.querySelector('.xpw').appendChild(f);
    var num = box.querySelector('.xpw-num');
    if (num && gain > 0) num.classList.add('bump');
  }
  function xpNeedOf(w) {
    var o = progOf(w);
    if (!o) return 0;
    var st = o.stage || 0;
    return st >= 2 ? 0 : XP_STAGE_GATE[st + 1];
  }

  function startWrite(w) {
    curWrite = { w: w, tries: 0, revealed: false, mode: 'pick', picks: [], bank: buildBank(w) };
    $('quiz').classList.add('open');
    sfx('sheet');
    renderWrite();
  }

  // 字母池：正确字母打乱 + 1~2 个干扰字母
  function buildBank(w) {
    var letters = w.w.toLowerCase().split('');
    var pool = letters.slice();
    var extra = Math.min(2, Math.max(1, 6 - letters.length + 1));
    var used = {};
    for (var i = 0; i < letters.length; i++) used[letters[i]] = 1;
    var alpha = 'abcdefghijklmnopqrstuvwxyz';
    var guard = 0;
    while (extra > 0 && guard++ < 200) {
      var ch = alpha[(Math.random() * 26) | 0];
      if (used[ch]) continue;
      used[ch] = 1;
      pool.push(ch);
      extra--;
    }
    for (var j = pool.length - 1; j > 0; j--) {
      var k = (Math.random() * (j + 1)) | 0, t = pool[j];
      pool[j] = pool[k]; pool[k] = t;
    }
    return pool;
  }

  function renderWrite() {
    var w = curWrite.w;
    var o = recWrite(w);
    var need = needOf(w);
    var poses = { n: 'n.', v: 'v.', adj: 'adj.', adv: 'adv.' };

    $('qKind').textContent = '默 写';
    $('qProg').textContent = (TAGS[w.tag] || '') + '　·　' + o.wr + ' / ' + need + ' 次';

    var senses = (w.senses && w.senses.length) ? w.senses : [{ pos: w.pos, cn: w.cn }];
    var cnHtml = senses.map(function (x, i) {
      return '<div class="wcn-item"><span class="pos">' + (poses[x.pos] || '') + '</span>' + x.cn + '</div>';
    }).join('');

    var mode = curWrite.mode || 'pick';
    var body = $('qBody');
    body.innerHTML =
      '<div class="wxp" id="wXp">' + xpWidget(w, { src: false }) + '</div>' +
      '<div class="wquest"><span class="wq-k">释 义</span>' +
      '<div class="wcn">' + cnHtml + '</div>' +
      '<div class="wmeta"><b>' + (w.w.length) + '</b> 个字母' +
      (curWrite.revealed ? '　·　' + (w.ph || '') : '') + '</div></div>' +
      '<div id="wMain"></div>' +
      '<div class="wbar" style="--n:' + need + '"><span id="wBarFill" style="width:' +
      Math.min(100, (o.wr / need) * 100).toFixed(1) + '%"></span></div>' +
      '<div class="wacts">' +
      '<button class="btn" id="wMode">' + (mode === 'pick' ? '⌨ 手写' : '◈ 点选') + '</button>' +
      '<button class="btn" id="wPeek">看答案</button>' +
      (mode === 'type' ? '<button class="btn primary" id="wSubmit">提 交</button>' : '') +
      '</div>' +
      '<div class="wfoot" id="wFoot"></div>';

    renderMain();
    $('wMode').onclick = function () {
      curWrite.mode = mode === 'pick' ? 'type' : 'pick';
      renderWrite();
    };
    $('wPeek').onclick = peekAnswer;
    var stHelp = body.querySelector('[data-stage-help]');
    if (stHelp) stHelp.onclick = function (e) { e.stopPropagation(); stageHelp(); };
    renderPeekState();
  }

  function renderMain() {
    var box = $('wMain');
    if (!box) return;
    var w = curWrite.w;
    if (curWrite.mode === 'type') {
      box.innerHTML = '<input id="wInput" class="winput" type="text" autocomplete="off" autocorrect="off" ' +
        'autocapitalize="off" spellcheck="false" placeholder="默写这个单词">';
      var inp = $('wInput');
      inp.onkeydown = function (e) { if (e.key === 'Enter') submitTyped(); };
      inp.oninput = function () { $('wFoot').innerHTML = ''; };
      $('wSubmit').onclick = submitTyped;
      setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
      return;
    }
    box.innerHTML =
      '<div class="wslots" id="wSlots"></div>' +
      '<div class="wbank" id="wBank"></div>' +
      '<div class="wtips"><span>按顺序点字母</span>' +
      '<button id="wUndo" type="button" aria-label="退格"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>退格</button>' +
      '<button id="wClear" type="button" aria-label="清空"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>清空</button></div>';
    renderSlots();
    var bank = $('wBank');
    curWrite.bank.forEach(function (ch, i) {
      var b = mk('button', 'wkey');
      b.type = 'button';
      b.textContent = ch;
      b.setAttribute('data-i', i);
      b.onclick = function () { pickLetter(i); };
      bank.appendChild(b);
    });
    syncBank();
    $('wUndo').onclick = undoPick;
    $('wClear').onclick = clearPicks;
    $('wFoot').innerHTML = '';
  }

  function renderSlots() {
    var box = $('wSlots');
    if (!box) return;
    var n = curWrite.w.w.length;
    var html = '';
    for (var i = 0; i < n; i++) {
      var idx = curWrite.picks[i];
      var ch = idx != null ? curWrite.bank[idx] : '';
      html += '<span class="wslot' + (ch ? ' on' : '') + '" data-i="' + i + '">' + (ch || '') + '</span>';
    }
    box.innerHTML = html;
  }

  function syncBank() {
    var bank = $('wBank');
    if (!bank) return;
    var used = {};
    curWrite.picks.forEach(function (i) { used[i] = 1; });
    for (var i = 0; i < bank.children.length; i++) {
      var b = bank.children[i];
      b.classList.toggle('used', !!used[b.getAttribute('data-i')]);
    }
  }

  function pickLetter(i) {
    if (curWrite.lock) return;
    var n = curWrite.w.w.length;
    if (curWrite.picks.length >= n) return;
    curWrite.picks.push(i);
    renderSlots();
    syncBank();
    if (curWrite.picks.length === n) setTimeout(checkPick, 140);
  }

  function undoPick() {
    if (curWrite.lock) return;
    curWrite.picks.pop();
    renderSlots();
    syncBank();
  }
  function clearPicks() {
    curWrite.picks = [];
    renderSlots();
    syncBank();
  }
  function resetPicks() {
    curWrite.picks = [];
    curWrite.lock = false;
    var slots = $('wSlots');
    if (slots) { slots.classList.remove('bad', 'good'); }
    renderSlots();
    syncBank();
  }

  function checkPick() {
    var w = curWrite.w;
    var got = curWrite.picks.map(function (i) { return curWrite.bank[i]; }).join('');
    if (got === w.w.toLowerCase()) {
      var slots = $('wSlots');
      if (slots) slots.classList.add('good');
      sfx('good');
      writeCorrect();
      setTimeout(resetPicks, 720);
    } else {
      curWrite.lock = true;
      var s2 = $('wSlots');
      if (s2) s2.classList.add('bad');
      sfx('wrong');
      buzz([8, 40, 8]);
      writeWrong();
      setTimeout(resetPicks, 620);
    }
  }

  function renderPeekState() {
    var w = curWrite.w;
    var o = recWrite(w);
    var peek = $('wPeek');
    if (!peek) return;
    if (curWrite.revealed) {
      peek.textContent = '再显示';
      peek.style.opacity = '.55';
    }
    $('qProg').textContent = (TAGS[w.tag] || '') + '　·　' + o.wr + ' / ' + needOf(w) + ' 次';
  }

  function peekAnswer() {
    var w = curWrite.w;
    var o = recWrite(w);
    if (!curWrite.revealed) {
      curWrite.revealed = true;
      o.pk++;
      save();
      renderPeekState();
      var body = $('qBody');
      var old = body.querySelector('.wreveal');
      if (old) old.parentNode.removeChild(old);
      var rv = mk('div', 'wreveal');
      rv.innerHTML = '<span class="rw">' + w.w + '</span><span class="rp">' + (w.ph || '') + '</span>';
      body.insertBefore(rv, body.querySelector('#wMain') || body.querySelector('.winput'));
      $('wFoot').innerHTML = '<span class="wnote">看了答案，需多默写 ' + PEEK_PENALTY +
        ' 次（共 ' + o.wr + ' / ' + needOf(w) + '）</span>';
      var bar = $('wBarFill');
      if (bar) bar.style.width = Math.min(100, (o.wr / needOf(w)) * 100).toFixed(1) + '%';
      var inp = $('wInput');
      if (inp) { try { inp.focus(); } catch (e) {} }
    }
  }

  function writeCorrect() {
    var w = curWrite.w;
    var o = recWrite(w);
    o.wr++;
    o.at = o.at || Date.now();
    o.m = starsOf(w);
    var gain = addXp(w, XP_PER_WRITE);
    save();
    refreshCounts();
    rewardWrite(w, gain);
    bumpXp($('wXp'), w, gain);
    addDaily('spell');
    if (reviewDue(w)) addDaily('review');
    var bar = $('wBarFill');
    if (bar) bar.style.width = Math.min(100, (o.wr / needOf(w)) * 100).toFixed(1) + '%';
    renderPeekState();
    sfx('claim');
    buzz(12);
    FX.sprinkle(14, w.tier);
    var left = Math.max(0, needOf(w) - o.wr);
    $('wFoot').innerHTML = left > 0
      ? '<span class="wok">对了　·　再默 ' + left + ' 次满星</span>'
      : '<span class="wok">' + (o.m >= 3 ? '已掌握' : '完成本轮') + '　·　' + w.w + '</span>' +
        '<button class="btn" id="wDone" style="margin-top:10px;height:40px">返 回</button>';
    if (left === 0) {
      var dn = $('wDone');
      if (dn) dn.onclick = closeQuiz;
    }
  }

  function writeWrong() {
    curWrite.tries++;
    $('wFoot').innerHTML = '<span class="wbad">顺序不对　·　错 ' + curWrite.tries +
      ' 次　·　可再试，或看答案（会多加 1 次）</span>';
  }

  function submitTyped() {
    var inp = $('wInput');
    if (!inp) return;
    var w = curWrite.w;
    var val = inp.value.trim().toLowerCase().replace(/\s+/g, '');
    if (!val) return;

    if (val === w.w.toLowerCase()) {
      inp.value = '';
      inp.classList.remove('bad');
      inp.classList.add('good');
      setTimeout(function () { inp.classList.remove('good'); }, 420);
      sfx('good');
      writeCorrect();
      try { inp.focus(); } catch (e) {}
    } else {
      inp.classList.remove('good');
      inp.classList.add('bad');
      sfx('wrong');
      buzz([8, 40, 8]);
      setTimeout(function () { inp.classList.remove('bad'); }, 420);
      writeWrong();
      inp.select();
    }
  }

  function closeQuiz() {
    sfx('sheetClose');
    $('quiz').classList.remove('open');
    curWrite = null;
    if ($('daily').classList.contains('open')) renderDaily();
    if (curTab === 'mine' && curPane === 'book') {
      renderCats();
      renderGrid('rebuild');
      if ($('detail').classList.contains('open')) {
        var dc = $('detailCard').querySelector('.card');
        var dw = dc && dc.getAttribute('data-word');
        if (dw && BY_WORD[dw]) openDetail(BY_WORD[dw]);
      }
    }
    if (curTab === 'expedition') renderExpedition();
    if (deckEl) {
      var slide = deckEl.children[activeIdx];
      var flip = slide && slide.querySelector('.flipper');
      if (flip && flip._flipped) {
        var front = flip.querySelector('.face.front');
        if (front) {
          front.innerHTML = '';
          var nc = Card.render(flip._word, { mastery: starsOf(flip._word), levels: levelsOf(flip._word) });
          nc.onclick = function () { openDetail(flip._word); };
          front.appendChild(nc);
        }
      }
      updateHint();
    }
  }

  /* ── 默写奖励额度 ─────────────────────────────── */
  var WRITES_PER_BONUS = 3;
  var writeTally = 0;

  // 单次默写的成长点：新词首默 > 常规 > 已 3 星复习（收益导向没掌握的词）
  function writeInkAmount(w) {
    var o = w ? recWrite(w) : null;
    if (!o) return WRITE_INK;
    if (o.wr <= 1) return WRITE_INK_NEW;
    if (starsOf(w) >= 3) return WRITE_INK_REVIEW;
    return WRITE_INK;
  }
  function rewardWrite(w, xpGain) {
    var t = todayStr();
    if (!state.inkDay || state.inkDay.d !== t) state.inkDay = { d: t, wr: 0 };
    var room = Math.max(0, WRITE_INK_CAP - (state.inkDay.wr || 0));
    var got = Math.min(writeInkAmount(w), room);
    if (got > 0) { state.ink += got; state.inkDay.wr = (state.inkDay.wr || 0) + got; }
    refreshCounts();
    writeTally++;
    var bonusShown = false;
    if (writeTally % WRITES_PER_BONUS === 0) {
      if (grantBattleBonus()) { toast('默写 ' + WRITES_PER_BONUS + ' 次 · 精力 +1'); bonusShown = true; }
      else if (energyNow() >= MAX_ENERGY) { /* 精力已满，不提示浪费 */ }
    }
    if (!bonusShown && xpGain) {
      toast('熟练度 +' + xpGain + (got > 0 ? ' · 成长点 +' + got : ' · 今日默写成长点已满'));
    }
  }

  /* ── 绑定 ─────────────────────────────────────── */
  // 先等原生存档读完再开局，否则 autoDraw 会把空状态写回去覆盖旧存档
  load();
  var booted = false;
  function seedDemo() {
    var maxT = 1;
    WORDS.forEach(function (w) { maxT = Math.max(maxT, w.tier || 1); });
    var top = WORDS.filter(function (w) { return (w.tier || 1) === maxT; }).slice(0, 12);
    var sub = WORDS.filter(function (w) { return (w.tier || 1) === maxT - 1; }).slice(0, 6);
    var list = top.concat(sub), hidSet = {};
    // 每种「主武器 + 副武器」组合（含无副武器）各取一张隐藏卡，同组合优先高品阶
    var full = function (w) { return w.w.split('').map(function () { return 6; }); };
    var combo = {};
    WORDS.forEach(function (w) {
      if ((w.tier || 1) < maxT) return;
      var wk = Card.weaponKinds(w, full(w)), key = wk.main + '|' + (wk.sub || '');
      if (!combo[key]) combo[key] = w;
    });
    for (var ck in combo) {
      hidSet[combo[ck].w] = 1;
      if (list.indexOf(combo[ck]) < 0) list.push(combo[ck]);
    }
    var now = Date.now();
    list.forEach(function (w, i) {
      var hid = !!hidSet[w.w] || i < 4;
      var lv = hid ? 6 : 5;
      state.owned[w.w] = {
        m: 3, wr: 3, pk: 0, at: now - i * 60000, cl: lv, hid: hid,
        lv: w.w.split('').map(function () { return lv; }),
        xp: XP_STAGE_GATE[3], stage: 2, pd: '', pn: 0,
      };
    });
    state.draws = Math.max(state.draws || 0, 520);
    state.ink = Math.max(state.ink || 0, 9999);
    state.streak = Math.max(state.streak || 0, 60);
    state.lastDay = todayStr();
    // 注入的数据视为早已达成，否则首次检查（通常是漫游结算）会一口气弹出一堆成就
    achievementList().forEach(function (a) { if (a.cur >= a.max) state.achSeen[a.id] = true; });
    state.achInit = true;
  }
  function boot() {
    if (booted) return;
    booted = true;
    if (DEMO) seedDemo();
    ensureDay();
    refreshCounts();
    renderQuota();
    renderBattleQuota();
    updateDailyBrief();
    renderDrawThemes();
    autoDraw();
  }
  sgetNative().then(function (raw) {
    if (booted) return;
    var local = state.draws || 0;
    if (raw) {
      try {
        var o = JSON.parse(raw);
        if (o && o.owned && (o.draws || 0) >= local) load(raw);
      } catch (e) {}
    }
    boot();
  });
  setTimeout(boot, 1500);

  $('btnDraw').onclick = function () {
    if (busy) return;
    if (quotaLeft() <= 0) { switchTab('expedition'); return; }
    // 交给 draw() 判断：当前组还有没开的卡就先弹确认，不在这里直接丢弃
    draw();
  };
  if ($('btnHelp')) $('btnHelp').onclick = function () { openMineSheet('help'); };
  $('btnDaily').onclick = openDaily;
  $('expStart').onclick = startExpedition;
  $('energyBuy').onclick = function (e) { e.stopPropagation(); askEnergyBuy(); };
  startEnergyTimer();
  $('dailyClose').onclick = function () { sfx('sheetClose'); $('daily').classList.remove('open'); updateDailyBrief(); };
  $('detailClose').onclick = function () { sfx('sheetClose'); $('detail').classList.remove('open'); };
  $('expSheetClose').onclick = closeExpSheet;
  $('qBack').onclick = closeQuiz;

  var tabBtns = document.querySelectorAll('#tabbar .tab');
  for (var ti = 0; ti < tabBtns.length; ti++) {
    tabBtns[ti].onclick = function () { switchTab(this.getAttribute('data-tab')); };
  }
  if ($('mineRecordBtn')) $('mineRecordBtn').onclick = function () { openMineSheet('record'); };
  if ($('mineAchBtn')) $('mineAchBtn').onclick = function () { openMineSheet('ach'); };
  if ($('pfTitleBtn')) $('pfTitleBtn').onclick = function () { openMineSheet('title'); };
  if ($('pfAvatar')) $('pfAvatar').onclick = function () { openMineSheet('title'); };
  if ($('filterBtn')) $('filterBtn').onclick = function () { openMineSheet('filter'); };

  // 点击遮罩关掉底部弹层，避免穿透到下面的图鉴
  var maskEl = $('mask');
  if (maskEl) maskEl.onclick = function () { closeMineSheet(); };
  var sheetCloseEl = $('mineSheetClose');
  if (sheetCloseEl) sheetCloseEl.onclick = function () { closeMineSheet(); };

  // 图鉴搜索：输入即筛，输入时自动切到「全部」以免锁卡搜不到
  var searchEl = $('codexSearch');
  if (searchEl) {
    var searchTm = 0;
    searchEl.addEventListener('input', function () {
      var v = this.value || '';
      var clr = $('codexClear');
      if (clr) clr.style.display = v ? '' : 'none';
      clearTimeout(searchTm);
      searchTm = setTimeout(function () {
        bookQuery = v;
        if (v && (bookFilter === 'got' || bookTag || bookTier.length)) {
          bookFilter = 'all'; bookTag = ''; bookTier = [];
          renderCats(); renderChips(); renderSort();
        }
        renderGrid(true);
      }, 140);
    });
    searchEl.addEventListener('search', function () { searchEl.dispatchEvent(new Event('input')); });
  }
  if ($('codexClear')) {
    $('codexClear').onclick = function () {
      if (searchEl) searchEl.value = '';
      this.style.display = 'none';
      bookQuery = '';
      renderGrid(true);
      if (searchEl) searchEl.blur();
    };
  }

  // 图鉴分页交给 IntersectionObserver，不再依赖具体滚动容器

  function openStatDialog(title, text, rewardTitle, rewardText) {
    var old = $('statDialog');
    if (old) old.parentNode.removeChild(old);
    var ov = mk('div', 'stat-dialog');
    ov.id = 'statDialog';
    var reward = rewardTitle ? '<section class="stat-dialog-reward"><small>今日签到奖励</small><b>' + rewardTitle + '</b><span>' + rewardText + '</span></section>' : '';
    ov.innerHTML = '<div class="stat-dialog-card">' +
      '<div class="stat-dialog-mark">✦</div><h3>' + title + '</h3>' + reward +
      '<section class="stat-dialog-explain"><small>' + (rewardTitle ? '签到说明' : '说明') + '</small><p>' + text + '</p></section>' +
      '<button class="btn primary stat-dialog-ok">知道了</button></div>';
    document.body.appendChild(ov);
    function close() { ov.classList.add('out'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 180); }
    ov.onclick = function (e) { if (e.target === ov || e.target.closest('.stat-dialog-x, .stat-dialog-ok')) close(); };
    sfx('sheet');
  }
  [].forEach.call(document.querySelectorAll('.pf-meta[data-stat-title]'), function (b) {
    b.onclick = function () {
      openStatDialog(b.getAttribute('data-stat-title'), b.getAttribute('data-stat-text'));
    };
  });
  if ($('pfCheckin')) $('pfCheckin').onclick = function () {
    var b = $('pfCheckin');
    var fresh = checkInToday();
    openStatDialog(
      b.getAttribute('data-stat-title') || '连续打卡',
      '每天点击一次完成签到，连续天数会影响称号成长；中断一天后会从 1 天重新计算。',
      fresh ? '成长点 +' + CHECKIN_REWARD : '今日已签到',
      fresh ? '首次签到领取，连续 ' + state.streak + ' 天' : '今天不重复发放奖励，当前连续 ' + state.streak + ' 天'
    );
  };
  renderCheckin();

  // 返回顶部：滚动一段后出现，点击平滑回到列表顶部
  var codexTopBtn = $('codexTop');
  var mineScrollEl = $('screenMine');
  if (codexTopBtn) {
    codexTopBtn.onclick = function () {
      sfx('tap');
      if (mineScrollEl) {
        if (mineScrollEl.scrollTo) mineScrollEl.scrollTo({ top: 0, behavior: 'smooth' });
        else mineScrollEl.scrollTop = 0;
      }
    };
  }
  if (mineScrollEl) {
    var topRaf = 0;
    mineScrollEl.addEventListener('scroll', function () {
      if (topRaf || !codexTopBtn) return;
      topRaf = requestAnimationFrame(function () {
        topRaf = 0;
        var show = curTab === 'mine' && curPane === 'book' && (bookTab === 'cards' || bookTab === 'monsters') &&
          mineScrollEl.scrollTop > 360;
        codexTopBtn.classList.toggle('on', show);
      });
    }, { passive: true });
  }

  // 屏幕尺寸变化时重算卡宽（横向空间按容器宽度分配）
  var codexRsTm = 0;
  window.addEventListener('resize', function () {
    if (curTab !== 'mine' || curPane !== 'book') return;
    clearTimeout(codexRsTm);
    codexRsTm = setTimeout(function () { renderGrid('rebuild'); }, 120);
  });

  // 兜底的按钮点按声：专门音效刚响过就不再叠一层
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (!t.closest('button, .tab, .region, .btab, .chip, .dt-claim')) return;
    if (Sfx.recent && Sfx.recent(60)) return;
    sfx('tap');
  });

  if (window.xhs && window.xhs.miniTool && window.xhs.miniTool.setNavigationBar) {
    try {
      window.xhs.miniTool.setNavigationBar({ title: '词卡物语', backgroundColor: '#13100d', frontColor: '#ffffff' });
    } catch (e) {}
  }
})();
