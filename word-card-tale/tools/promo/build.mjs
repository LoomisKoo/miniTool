#!/usr/bin/env node
/**
 * 宣传片专用构建：在正式产物（抖音包，无小红书顶部留白）上打「拍摄补丁」。
 * 只写 dist/promo，不改动 src，不影响上架包。
 *
 *   node tools/promo/build.mjs
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(root, 'dist/promo');

execSync('node build.mjs douyin', { cwd: root, stdio: 'inherit' });

const src = path.join(root, 'dist/douyin');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'style.css']) {
  fs.copyFileSync(path.join(src, f), path.join(out, f));
}
let js = fs.readFileSync(path.join(src, 'app.js'), 'utf8');

let n = 0;
function patch(label, from, to) {
  const i = js.indexOf(from);
  if (i < 0) throw new Error('补丁未命中：' + label);
  if (js.indexOf(from, i + 1) >= 0) throw new Error('补丁不唯一：' + label);
  js = js.slice(0, i) + to + js.slice(i + from.length);
  n++;
}

// 1. 抽卡次数不限（正常每天 2 组，拍摄时不够用）
patch('quota', '    if (DEV_MODE) return 999;', '    if (DEV_MODE || window.__PROMO_FREE) return 999;');

// 1b. 强制隐藏款（故事片开场要翻 EX）
patch(
  'hidRate',
  '  if (DEV_MODE && /[?&]hid\\b/.test(location.search)) HIDDEN_RATE = 1;',
  '  if (DEV_MODE && /[?&]hid\\b/.test(location.search)) HIDDEN_RATE = 1;\n'
  + '  if (window.__PROMO_HID) HIDDEN_RATE = 1;'
);

// 1c. 隐藏款优先短词（≤6 字母），方便只拼一轮
patch(
  'hidShort',
  '  function drawHiddenWord(exclude) {\n    var maxT = 1;\n    WORDS.forEach(function (w) { maxT = Math.max(maxT, w.tier || 1); });\n    var pool = WORDS.filter(function (w) {\n      return (w.tier || 1) === maxT && w.w.length <= MAX_WORD_LEN && (!exclude || exclude.indexOf(w.w) < 0);\n    });',
  `  function drawHiddenWord(exclude) {
    var maxT = 1;
    WORDS.forEach(function (w) { maxT = Math.max(maxT, w.tier || 1); });
    var pool = WORDS.filter(function (w) {
      return (w.tier || 1) === maxT && w.w.length <= MAX_WORD_LEN && (!exclude || exclude.indexOf(w.w) < 0);
    });
    if (window.__PROMO_FORCE_WORD) {
      var fw = null;
      for (var fi = 0; fi < pool.length; fi++) if (pool[fi].w === window.__PROMO_FORCE_WORD) { fw = pool[fi]; break; }
      if (fw) return fw;
    }
    if (window.__PROMO_SHORT_HID) {
      pool = pool.slice().sort(function (a, b) { return a.w.length - b.w.length; });
      var lim = pool[0] ? pool[0].w.length + 1 : 8;
      var short = pool.filter(function (w) { return w.w.length <= lim; });
      if (short.length) pool = short;
    }`
);

// 1d. 拼写强制单轮（宣传片不要多段默写）
patch(
  'oneRound',
  "    return (long || rare) ? ['copy', 'copy'] : ['copy'];",
  "    if (window.__PROMO_ONE_ROUND) return ['copy'];\n    return (long || rare) ? ['copy', 'copy'] : ['copy'];"
);

// 2. ?demo 存档：额外补满怪物图鉴与全地区通关，让结算和图鉴一次拍够
patch(
  'seed',
  '    state.achInit = true;\n  }\n  function boot() {',
  `    state.achInit = true;
    if (window.StageArt) {
      state.codex = {};
      for (var sk in window.StageArt.SPRITES) state.codex[sk] = 1;
      state.stages = {};
      for (var rgi = 0; rgi < REGIONS.length; rgi++) state.stages[REGIONS[rgi].id] = { c: 5, s: [3, 3, 3, 3, 3] };
      state.region = window.__PROMO_REGION || 'cusco';
    }
  }
  function boot() {`
);

// 3. 抽卡稀有度偏好：window.__PROMO_TIER = 5 时优先从 UR 里抽
patch(
  'tierBias',
  '  function pickWeighted(pool) {\n',
  `  function pickWeighted(pool) {
    if (window.__PROMO_TIER) {
      var mt = 1;
      pool.forEach(function (q) { mt = Math.max(mt, q.tier || 1); });
      var need = Math.min(window.__PROMO_TIER, mt);
      var hp = pool.filter(function (q) { return (q.tier || 1) >= need; });
      if (hp.length) pool = hp;
    }
`
);
// 演示存档掌握词少，卡池上限会被锁在低档；录高档镜头时放开，并关掉复习卡
patch(
  'tierGate',
  '    for (var i = 0; i < POOL_GATES.length; i++) if (m >= POOL_GATES[i].need) t = POOL_GATES[i].max;\n    return t;',
  '    for (var i = 0; i < POOL_GATES.length; i++) if (m >= POOL_GATES[i].need) t = POOL_GATES[i].max;\n    return window.__PROMO_TIER ? Math.max(t, window.__PROMO_TIER) : t;'
);
patch('noReview', '  var REVIEW_RATE = 0.3;', '  var REVIEW_RATE = window.__PROMO_TIER ? 0 : 0.3;');

// 4. 临时拼写词透出，录制脚本靠它点字母
patch(
  'capWord',
  '      rot: opts.rot || 0,\n    };\n    lastT = 0;',
  '      rot: opts.rot || 0,\n    };\n    lastT = 0;\n    window.__PROMO_WORD = S.word; window.__PROMO_ROUNDS = S.rounds.length;'
);

// 5. 难度拨到顶（弹幕更密、敌人更硬）
patch(
  'diff',
  '  function diffTier() {\n    return clamp(1 + 0.7 * (state.stage || 0) + progressTier() * 12, 1, 18);',
  '  function diffTier() {\n    if (window.__PROMO_DIFF) return window.__PROMO_DIFF;\n    return clamp(1 + 0.7 * (state.stage || 0) + progressTier() * 12, 1, 18);'
);

// 6. 首领血量缩放，避免一场打太久
patch(
  'bossHp',
  '    e.hp = e.maxHp = 1700 * bossMul() * bigMul() * (e.landmark ? 1.25 : 1);',
  '    e.hp = e.maxHp = 1700 * bossMul() * bigMul() * (e.landmark ? 1.25 : 1) * (window.__PROMO_BOSS_HP || 1);'
);

// 7. 首领提前登场（正常第 60 秒，拍摄压到 30 秒）
patch('bossAt', '  var BOSS_AT = 60;', '  var BOSS_AT = window.__PROMO_BOSS_AT || 60;');

// 8. 开局火力 / 大招次数（满火力展示隐藏款进化弹幕）
patch(
  'bombs',
  '      power: 1, bombs: 0, charge: 0,',
  '      power: (window.__PROMO_MAX_POWER ? 5 : 1), bombs: window.__PROMO_BOMBS || 0, charge: 0,'
);

// 9. 战斗状态透出 + 开局觉醒 / 刷怪潮
patch(
  'bstate',
  "    setPanel('play');",
  "    window.__BSTATE = state;\n"
  + "    if (window.__PROMO_AWAKEN) { state.awaken = state.awakenMax = +window.__PROMO_AWAKEN || 12; }\n"
  + "    if (window.__PROMO_MAX_POWER && state.card && state.card.fx) state.power = state.card.fx.maxP || 5;\n"
  + "    setPanel('play');"
);

// 10. 刷怪潮：编队数量拉满，方便武器展示
patch(
  'swarm',
  '    var i, n = state.level <= 1 ? 3 : state.level === 2 ? 4 : 5;\n'
  + '    // 火力还没升起来 / 开局前 15 秒：编队少一到两只\n'
  + '    if (n > 3 && (powerProg() < 0.34 || state.t < 15)) n--;\n'
  + '    if (n > 3 && powerProg() < 0.34 && state.t < 15) n--;',
  '    var i, n = window.__PROMO_SWARM ? 8 : (state.level <= 1 ? 3 : state.level === 2 ? 4 : 5);\n'
  + '    if (!window.__PROMO_SWARM) {\n'
  + '      if (n > 3 && (powerProg() < 0.34 || state.t < 15)) n--;\n'
  + '      if (n > 3 && powerProg() < 0.34 && state.t < 15) n--;\n'
  + '    }'
);

fs.writeFileSync(path.join(out, 'app.js'), js);
console.log(`✓ promo 产物 → ${path.relative(root, out)}（${n} 个补丁）`);
