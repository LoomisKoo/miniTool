/* 本草 — 主逻辑
   循环：采药/买种 → 药圃种 → 收药 → 出诊开方 → 结算 → 钱/声望 → 图鉴 */
(function () {
  'use strict';

  const SAVE = 'bencao.v1';
  const SLOTS = 6;
  const VISITS_PER_DAY = 3;
  const GATHERS_PER_DAY = 3;
  const DISCIPLE_INCOME = 26;          // 每名弟子每日代诊所得
  const DISCIPLE_REQ = [8, 18, 30];    // 雇第 1/2/3 名所需声望
  const DISCIPLE_COST = [240, 420, 680];
  const TIME_SCALE = 1; // 测试时可改 0.02 让一切飞快

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const H = name => HERB_BY_NAME[name];
  const R = id => REGIONS.find(r => r.id === id);
  const S = id => SYNDROMES.find(s => s.id === id);
  const split = s => (s || '').split(',').map(x => x.trim()).filter(Boolean);
  const now = () => Date.now();
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtLeft = ms => {
    if (ms <= 0) return '可收';
    const m = Math.ceil(ms / 60000);
    if (m < 60) return m + ' 分钟';
    const h = Math.floor(m / 60);
    return h + ' 小时' + (m % 60 ? ' ' + (m % 60) + ' 分' : '');
  };

  /* —— 静态索引 —— */
  const HERB_BY_NAME = {};
  HERBS.forEach(h => { h.f = split(h.f); h.m = split(h.m); h.e = split(h.e); h.r = split(h.r); HERB_BY_NAME[h.n] = h; });
  const ALL_HERB_NAMES = HERBS.map(h => h.n);

  /* 合并追加的炮制形态，并给所有形态补上辅料归属 */
  (function mergeForms() {
    Object.keys(EXTRA_FORMS).forEach(n => {
      const h = HERB_BY_NAME[n];
      if (!h) return;
      h.fo = h.fo || [];
      EXTRA_FORMS[n].forEach(f => { if (!h.fo.some(x => x.n === f.n)) h.fo.push(f); });
    });
    HERBS.forEach(h => {
      (h.fo || []).forEach(f => { if (f.mat === undefined) f.mat = matFromPrep(f.pr); });
    });
  })();

  const FORM_BY_KEY = {};
  HERBS.forEach(h => (h.fo || []).forEach(f => { FORM_BY_KEY[h.n + '|' + f.n] = f; }));
  const MAT_BY_ID = {};
  MATERIALS.forEach(m => { MAT_BY_ID[m.id] = m; });

  function effectsOf(name, formName) {
    const h = H(name);
    let e = h.e.slice();
    if (formName && h.fo) {
      const f = h.fo.find(x => x.n === formName);
      if (f) {
        e = e.filter(x => !split(f.del).includes(x));
        split(f.add).forEach(x => { if (!e.includes(x)) e.push(x); });
      }
    }
    return e;
  }

  function expectedEffects(syn) {
    const out = new Set();
    syn.p.forEach(p => (PATHOGEN_MAP[p] || []).forEach(e => out.add(e)));
    return Array.from(out);
  }

  /* —— 舌象：从四诊文本解析参数，程序生成 SVG（无图片资源） —— */
  const TONGUE_BODY = {
    pale: '#e5b3ac', 'pale-red': '#d98d83', red: '#c86457',
    crimson: '#a83b34', purple: '#8d4c64'
  };
  const COAT_COLOR = { white: '#fbf8ef', yellow: '#e4cb80' };

  function tongueParams(txt) {
    const t = txt || '';
    if (!/舌/.test(t)) return null;  // 望诊文本里没有舌象（如跌打肿痛）就不画

    let body = 'pale-red';
    if (/绛/.test(t)) body = 'crimson';
    else if (/淡红/.test(t)) body = 'pale-red';
    else if (/紫/.test(t)) body = 'purple';
    else if (/淡/.test(t)) body = 'pale';
    else if (/红/.test(t)) body = 'red';
    else if (/暗/.test(t)) body = 'purple';

    let coat = 'white', thick = 'normal';
    if (/少苔|无苔|剥/.test(t)) { coat = 'none'; thick = 'none'; }
    else if (/黄/.test(t)) coat = 'yellow';
    if (thick !== 'none') thick = /腻|厚/.test(t) ? 'thick' : /薄/.test(t) ? 'thin' : 'normal';

    return {
      body, coat, thick,
      dry: /燥/.test(t),
      wet: /润|滑/.test(t),
      peel: /剥|少苔/.test(t),
      swollen: /胖|齿痕/.test(t),
      thin: /瘦|薄/.test(t)
    };
  }

  const COAT_OPACITY = { none: 0, thin: 0.42, normal: 0.72, thick: 0.93 };

  function tongueSvg(txt) {
    const p = tongueParams(txt);
    if (!p) return '';
    const body = TONGUE_BODY[p.body];
    const coat = COAT_COLOR[p.coat];
    const op = COAT_OPACITY[p.thick];
    const rx = p.swollen ? 34 : p.thin ? 26 : 31;
    const ry = p.swollen ? 41 : p.thin ? 39 : 40;
    const teeth = p.swollen
      ? `<g fill="${body}" opacity=".8">
          <circle cx="${50 - rx + 2}" cy="42" r="3.4"/><circle cx="${50 - rx + 2}" cy="54" r="3.4"/><circle cx="${50 - rx + 2}" cy="66" r="3.4"/>
          <circle cx="${50 + rx - 2}" cy="42" r="3.4"/><circle cx="${50 + rx - 2}" cy="54" r="3.4"/><circle cx="${50 + rx - 2}" cy="66" r="3.4"/>
        </g>`
      : '';
    const cracks = p.dry
      ? `<path d="M50 26 L48 40 M50 46 L51 60" stroke="${body}" stroke-width="1.1" stroke-linecap="round" opacity=".55" fill="none"/>`
      : '';
    const shine = p.wet ? `<ellipse cx="41" cy="32" rx="7" ry="9" fill="#fff" opacity=".3"/>` : '';
    const peel = p.peel
      ? `<circle cx="40" cy="44" r="6" fill="${body}" opacity=".5"/>
         <circle cx="61" cy="58" r="5" fill="${body}" opacity=".45"/>
         <circle cx="53" cy="30" r="4" fill="${body}" opacity=".4"/>`
      : '';
    return `<svg class="tongue" viewBox="0 0 100 100" aria-label="舌象">
      <ellipse cx="50" cy="52" rx="${rx}" ry="${ry}" fill="${body}"/>
      <ellipse cx="50" cy="54" rx="${rx - 7}" ry="${ry - 7}" fill="${coat}" opacity="${op}"/>
      ${teeth}${peel}${cracks}${shine}
      <ellipse cx="50" cy="93" rx="9" ry="4" fill="${body}" opacity=".35"/>
    </svg>`;
  }

  /* 病机覆盖：逐个病机判断「方中有无一味药能应」，任一对应功效命中即算覆盖 */
  function pathogenCoverage(picks, syn) {
    const have = new Set();
    picks.forEach(p => effectsOf(p.n, p.form).forEach(e => have.add(e)));
    const covered = syn.p.filter(p => (PATHOGEN_MAP[p] || []).some(e => have.has(e))).length;
    return { covered, total: syn.p.length };
  }

  /* —— 存档 —— */
  const START_INV = { 甘草: 3, 黄芪: 2, 白术: 2, 当归: 2, 陈皮: 2, 桔梗: 2, 桂枝: 2, 麻黄: 2, 茯苓: 2, 生姜: 2 };

  let state;
  function fresh() {
    const inv = Object.assign({}, START_INV);
    const atlas = {};
    Object.keys(inv).forEach(n => { atlas[n] = { stage: 1, uses: 0, forms: [], regions: [] }; });
    return {
      money: 200,
      rep: 0,
      seeds: { 甘草: 2, 黄芪: 1, 当归: 1 },
      inv,
      preps: {},
      mats: { 蜜: 2, 酒: 1, 醋: 1, 盐: 1, 姜汁: 1 },
      atlas,
      secrets: [],
      farm: new Array(SLOTS).fill(null),
      day: { date: today(), visits: 0, gathers: 0 },
      exp: null,
      patient: null,
      pending: [],
      disciple: 0,
      passive: 0,
      seen: { intro: false, shop: false, farm: false, land: false, atlas: false },
      stats: { great: 0, ok: 0, none: 0, worse: 0 }
    };
  }
  function load() {
    try { state = JSON.parse(localStorage.getItem(SAVE)) || fresh(); } catch (e) { state = fresh(); }
    const base = fresh();
    ['stats', 'seen', 'disciple', 'passive', 'pending', 'mats', 'preps', 'secrets'].forEach(k => {
      if (state[k] === undefined) state[k] = base[k];
    });
    if (state.day.date !== today()) {
      // 换日：弟子代诊结算
      const inc = (state.disciple || 0) * DISCIPLE_INCOME;
      state.money += inc;
      state.passive = inc;
      state.day = { date: today(), visits: 0, gathers: 0 };
    }
    if (!state.farm || state.farm.length !== SLOTS) {
      const f = new Array(SLOTS).fill(null);
      (state.farm || []).forEach((x, i) => { if (i < SLOTS) f[i] = x; });
      state.farm = f;
    }
  }
  function save() { localStorage.setItem(SAVE, JSON.stringify(state)); }

  function at(name) {
    if (!state.atlas[name]) state.atlas[name] = { stage: 0, uses: 0, forms: [], regions: [] };
    return state.atlas[name];
  }
  function addInv(name, n) {
    state.inv[name] = (state.inv[name] || 0) + n;
    const a = at(name);
    if (a.stage < 1) a.stage = 1;
  }
  function addSeed(name, n) { state.seeds[name] = (state.seeds[name] || 0) + n; }

  /* —— 炮制 —— */
  function prepQty(n, form) {
    const p = state.preps[n];
    return p ? (p[form] || 0) : 0;
  }
  function addPrep(n, form, q) {
    state.preps[n] = state.preps[n] || {};
    state.preps[n][form] = (state.preps[n][form] || 0) + q;
  }
  function usePrep(n, form, q) {
    if (!state.preps[n]) return;
    state.preps[n][form] = Math.max(0, (state.preps[n][form] || 0) - q);
    if (!state.preps[n][form]) delete state.preps[n][form];
    if (!Object.keys(state.preps[n]).length) delete state.preps[n];
  }

  /* 炮制规则：有辅料 → 1 生品 + 1 辅料；无辅料 → 2 生品 */
  function prepCost(f) {
    return f && f.mat ? { herb: 1, mat: 1 } : { herb: 2, mat: 0 };
  }
  function canPrep(n, form) {
    const f = FORM_BY_KEY[n + '|' + form];
    if (!f) return false;
    const c = prepCost(f);
    if ((state.inv[n] || 0) < c.herb) return false;
    if (c.mat && (state.mats[f.mat] || 0) < c.mat) return false;
    return true;
  }
  function doPrep(n, form) {
    const f = FORM_BY_KEY[n + '|' + form];
    if (!f || !canPrep(n, form)) return;
    const c = prepCost(f);
    state.inv[n] -= c.herb;
    if (!state.inv[n]) delete state.inv[n];
    if (c.mat) {
      state.mats[f.mat] -= c.mat;
      if (!state.mats[f.mat]) delete state.mats[f.mat];
    }
    addPrep(n, form, 1);
    const a = at(n);
    if (a.stage < 2) a.stage = 2;              // 亲手炮制过，即算会用
    if (!a.forms.includes(form)) a.forms.push(form);
    save(); render();
    toast(`炮制得 ${form} 一份`);
  }

  /* —— 开方可选项：生品 + 已炮制品 —— */
  function availableItems() {
    const out = [];
    Object.keys(state.inv).forEach(n => {
      if (state.inv[n] > 0) out.push({ n, form: '生', qty: state.inv[n], label: n });
    });
    Object.keys(state.preps).forEach(n => {
      Object.keys(state.preps[n]).forEach(form => {
        const q = state.preps[n][form];
        if (q > 0) out.push({ n, form, qty: q, label: form });
      });
    });
    return out;
  }

  /* —— 出诊：病人生成 —— */
  function invEffects() {
    const set = new Set();
    Object.keys(state.inv).forEach(n => { if (state.inv[n] > 0) effectsOf(n, null).forEach(e => set.add(e)); });
    return set;
  }
  function genPatient() {
    const have = invEffects();
    const pool = SYNDROMES.filter(s => {
      // 逐个病机看药柜能否应对：至少一半病机有药可应，才算「不超纲」
      const cov = s.p.filter(p => (PATHOGEN_MAP[p] || []).some(e => have.has(e))).length / s.p.length;
      return cov >= 0.5 && s.lv <= 2 + Math.min(3, Math.floor(state.rep / 6));
    });
    const syn = pool.length && Math.random() < 0.85 ? pick(pool) : pick(SYNDROMES.filter(s => s.lv <= 2));
    const reward = 15 + syn.lv * 10;
    return { sid: syn.id, reward, done: false, result: null, tries: 1, look: genLook() };
  }

  /* 复诊优先：上次无效的病人先来，带着「未及之处」的线索 */
  function nextPatientObj() {
    if (state.pending && state.pending.length) {
      const p = state.pending.shift();
      return { sid: p.sid, reward: 15 + S(p.sid).lv * 10, done: false, result: null, tries: (p.tries || 1) + 1, miss: p.miss || [], look: p.look || genLook() };
    }
    return genPatient();
  }
  function currentPatient() {
    if (!state.patient) state.patient = genPatient();
    return state.patient;
  }

  /* —— 药方 —— */
  function formulaUnlocked(f) {
    // 秘方只能靠远行偶遇；常用方集齐组成药材即解锁
    if (f.tier === '秘方') return state.secrets.includes(f.id);
    return f.herbs.every(n => (state.atlas[n] || {}).stage >= 1);
  }
  function formulaProgress(f) {
    return f.herbs.filter(n => (state.atlas[n] || {}).stage >= 1).length;
  }
  function matchFormula(picks) {
    const key = picks.map(p => p.n).slice().sort().join(',');
    return FORMULAS.find(f => f.herbs.slice().sort().join(',') === key) || null;
  }

  /* —— 开方判定 —— */
  function judge(picks, monarchIdx, sid) {
    const syn = S(sid);
    const need = expectedEffects(syn);
    const cov = pathogenCoverage(picks, syn);
    const s1 = sid === state.patient.sid ? SCORE.syndrome : 0;
    const s2 = cov.total ? SCORE.coverage * cov.covered / cov.total : 0;
    let taboo = null;
    for (let i = 0; i < picks.length; i++) {
      for (let j = i + 1; j < picks.length; j++) {
        const a = picks[i].n, b = picks[j].n;
        const hit = INCOMPATIBLE.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
        if (hit) taboo = hit;
      }
    }
    const s3 = (monarchIdx >= 0 ? SCORE.monarch : 0) + (taboo ? 0 : SCORE.noTaboo);
    const formHit = picks.filter(p => {
      if (!p.form || p.form === '生') return false;
      const base = effectsOf(p.n, null);
      return effectsOf(p.n, p.form).some(e => need.includes(e) && !base.includes(e));
    }).length;
    const s4 = picks.length ? Math.round(10 * Math.min(1, formHit / picks.length)) : 0;
    const n = picks.length;
    // 精简分：三到六味为得体，一味太单薄，超过八味则杂乱
    const s5 = n === 0 ? 0 : n === 1 ? 2 : n === 2 ? 5 : n <= 6 ? SCORE.brevity : n <= 8 ? 6 : 3;

    const f = matchFormula(picks);
    const onPoint = f && f.syndrome === state.patient.sid;
    const bonus = onPoint ? SCORE.formulaBonus : 0;
    const total = Math.min(100, Math.round(s1 + s2 + s3 + s4 + s5 + bonus));
    let grade = taboo ? 'worse' : total >= SCORE.grade.great ? 'great' : total >= SCORE.grade.ok ? 'ok' : 'none';
    const have2 = new Set();
    picks.forEach(p => effectsOf(p.n, p.form).forEach(e => have2.add(e)));
    const missing = syn.p.filter(p => !(PATHOGEN_MAP[p] || []).some(e => have2.has(e)));
    return {
      total, s1, s2: Math.round(s2), s3, s4, s5, bonus, grade, taboo,
      covered: cov.covered, need: cov.total, missing,
      formula: onPoint ? f.name : null,
      formulaMisfit: f && !onPoint ? f.name : null
    };
  }

  const GRADE_TEXT = {
    great: { t: '显效', d: '药到病除，病人连声称谢。', money: 1 },
    ok: { t: '好转', d: '症状稍减，尚需调养。', money: 0.4 },
    none: { t: '无效', d: '服后无起色。病人道改日复诊，下次会带上线索。', money: 0 },
    worse: { t: '加重', d: '药性相冲，病人反觉不适。', money: 0 }
  };

  /* —— 视图 —— */
  let tab = 'shop';
  const newPicker = () => ({ picks: [], monarch: -1, filterP: '', fam: null, sid: null, step: 1 });
  let picker = newPicker();
  let fx = {};   // 只在下一次渲染生效的动效标记
  const RANKS = [[0, '学徒'], [5, '郎中'], [15, '坐堂'], [30, '名医'], [60, '国手']];

  function render() {
    $('#money').textContent = state.money;
    $('#rep').textContent = state.rep;
    $('#rank').textContent = RANKS.filter(r => state.rep >= r[0]).pop()[1];
    const t = now();
    const badge = {
      shop: !!state.patient || state.day.visits < VISITS_PER_DAY,
      farm: state.farm.some(s => !s || s.ready <= t),
      land: (state.exp && t >= state.exp.end) || state.day.gathers < GATHERS_PER_DAY,
      atlas: false
    };
    $$('.tabbar button').forEach(b => {
      b.classList.toggle('on', b.dataset.tab === tab);
      b.classList.toggle('dot', !!badge[b.dataset.tab] && b.dataset.tab !== tab);
    });
    const v = { shop: viewShop, farm: viewFarm, land: viewLand, atlas: viewAtlas }[tab];
    $('#main').innerHTML = firstTip(tab) + v();
    bind();
    fx = {};
  }

  function floatText(text, cls) {
    const anchor = $('#money').getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'floater ' + (cls || '');
    el.textContent = text;
    el.style.left = anchor.left + anchor.width / 2 + 'px';
    el.style.top = anchor.bottom + 6 + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
    const m = $('#money');
    m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump');
  }

  /* 药铺 */
  function discipleCard() {
    const cnt = state.disciple || 0;
    const next = cnt < 3 ? DISCIPLE_REQ[cnt] : null;
    const cost = cnt < 3 ? DISCIPLE_COST[cnt] : 0;
    const canHire = cnt < 3 && state.rep >= next && state.money >= cost;
    return `<div class="card"><h3>弟子</h3>
      <p class="dim">现有 ${cnt} 名，每日代诊小病，可得 ${cnt * DISCIPLE_INCOME} 文。</p>
      ${state.passive ? `<p class="good small">今晨弟子已代诊，收入 ${state.passive} 文。</p>` : ''}
      ${cnt < 3
        ? (state.rep < next
          ? `<p class="dim small">再积 ${next - state.rep} 点声望（${state.rep} / ${next}），可再收一名弟子。</p>`
          : `<button data-hire ${canHire ? '' : 'disabled'}>收一名弟子 · ${cost} 文</button>`)
        : '<p class="dim small">已是满门三位，不必再收。</p>'}
    </div>`;
  }

  /* —— 病人形象：程序绘制 —— */
  const SURNAMES = '张王李赵刘陈杨黄周吴徐孙马朱胡郭何林罗高郑梁谢宋唐许韩冯邓曹彭曾萧田董潘袁蔡蒋余于杜叶程魏苏吕丁沈任姚卢傅钟姜崔谭陆范汪廖石金韦贾夏'.split('');
  const PEOPLE = [
    { sex: 'm', age: 'y', call: '小哥' }, { sex: 'f', age: 'y', call: '姑娘' },
    { sex: 'm', age: 'm', call: '大哥' }, { sex: 'f', age: 'm', call: '大嫂' },
    { sex: 'm', age: 'o', call: '老伯' }, { sex: 'f', age: 'o', call: '婆婆' }
  ];
  const ROBES = ['#6d8a96', '#8a6d5a', '#5d7a5f', '#7b6a8f', '#9a7b4f', '#5f6f8a', '#8f5f5f'];
  const FACE = {
    表证: '#f2cfb3', 里热: '#f0b49a', 里寒: '#f3e0d2', 气虚: '#f4e2cf',
    血虚: '#f6e6da', 气滞: '#eec6a6', 血瘀: '#d6ad97', 湿痰: '#e8d3a2'
  };
  const FAMS = ['表证', '里热', '里寒', '气虚', '血虚', '气滞', '血瘀', '湿痰'];
  const FAM_DESC = {
    表证: '外感初起，病在肌表', 里热: '火热内盛', 里寒: '阳虚寒生', 气虚: '乏力气短',
    血虚: '面白心悸', 气滞: '胀痛走窜', 血瘀: '刺痛不移', 湿痰: '困重痰多'
  };
  const LINES = {
    great: ['先生妙手，几服下去身子轻快多了！', '真神了，这下能睡个安稳觉。', '回去定要给先生送块匾来。'],
    ok: ['好些了，就是还没断根。', '比先前强些，回头再来劳烦先生。'],
    none: ['吃了几日，没甚起色……', '怕是没对上症，过几日再来。'],
    worse: ['这药喝下去反倒更难受了！', '先生，这方子怕是有冲撞……']
  };
  const ZHEN = [
    { k: 'w', t: '望', d: '观其舌色' },
    { k: 'q', t: '问', d: '问其所苦' },
    { k: 'pu', t: '切', d: '按其脉象' }
  ];

  function genLook() {
    const p = pick(PEOPLE);
    return { name: pick(SURNAMES) + p.call, sex: p.sex, age: p.age, robe: rnd(ROBES.length) };
  }
  function lookOf(p) {
    if (!p.look) { p.look = genLook(); save(); }
    return p.look;
  }

  function personSvg(look, syn, mood) {
    const face = FACE[syn.family] || '#f2cfb3';
    const hair = look.age === 'o' ? '#cfc9bd' : '#2d2722';
    const robe = ROBES[look.robe % ROBES.length];
    const flush = syn.family === '里热' || mood === 'happy';
    const hairM = `<path d="M33 54 Q32 24 60 23 Q88 24 87 54 Q82 37 60 37 Q38 37 33 54Z" fill="${hair}"/>
      <circle cx="60" cy="20" r="7" fill="${hair}"/><rect x="56" y="12" width="8" height="3" rx="1.5" fill="#8a6440"/>`;
    const hairF = `<path d="M31 66 Q28 22 60 22 Q92 22 89 66 Q86 44 80 38 Q66 44 46 38 Q36 46 31 66Z" fill="${hair}"/>
      <circle cx="60" cy="17" r="10" fill="${hair}"/><path d="M52 15 L70 11" stroke="#b5874a" stroke-width="2" stroke-linecap="round"/>`;
    const beard = look.sex === 'm' && look.age === 'o'
      ? `<path d="M48 78 Q60 100 72 78 Q66 84 60 84 Q54 84 48 78Z" fill="${hair}"/>` : '';
    const lines = look.age === 'o'
      ? `<path d="M40 50 q4 -2 8 0 M72 50 q4 -2 8 0" stroke="#b39279" stroke-width=".8" fill="none" opacity=".6"/>` : '';
    let eyes, brows, mouth;
    if (mood === 'happy') {
      eyes = `<path d="M44 58 q5 -5 10 0 M66 58 q5 -5 10 0" stroke="#2d2722" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      brows = `<path d="M43 49 q6 -3 11 0 M66 49 q6 -3 11 0" stroke="${hair === '#cfc9bd' ? '#9c968a' : '#2d2722'}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
      mouth = `<path d="M51 72 q9 9 18 0" stroke="#8c3b32" stroke-width="2" fill="#c96a5c" stroke-linecap="round"/>`;
    } else if (mood === 'calm') {
      eyes = `<circle cx="49" cy="58" r="2.4" fill="#2d2722"/><circle cx="71" cy="58" r="2.4" fill="#2d2722"/>`;
      brows = `<path d="M43 50 l11 -1 M66 49 l11 1" stroke="#2d2722" stroke-width="1.6" stroke-linecap="round"/>`;
      mouth = `<path d="M53 73 q7 4 14 0" stroke="#8c3b32" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    } else if (mood === 'sad') {
      eyes = `<circle cx="49" cy="59" r="2.2" fill="#2d2722"/><circle cx="71" cy="59" r="2.2" fill="#2d2722"/>
        <path d="M77 62 q2 5 0 7 q-2 -2 0 -7Z" fill="#8fc0e0"/>`;
      brows = `<path d="M43 51 l11 -4 M66 47 l11 4" stroke="#2d2722" stroke-width="1.8" stroke-linecap="round"/>`;
      mouth = `<path d="M51 76 q9 -7 18 0" stroke="#8c3b32" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    } else {
      eyes = `<path d="M45 59 h8 M67 59 h8" stroke="#2d2722" stroke-width="2.2" stroke-linecap="round"/>`;
      brows = `<path d="M43 50 l11 -3 M66 47 l11 3" stroke="#2d2722" stroke-width="1.6" stroke-linecap="round"/>`;
      mouth = `<path d="M53 75 q7 -3 14 0" stroke="#8c3b32" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    }
    return `<svg class="person" viewBox="0 0 120 140" aria-hidden="true">
      <path d="M14 140 Q16 100 60 94 Q104 100 106 140Z" fill="${robe}"/>
      <path d="M46 96 L60 116 L74 96" stroke="#f3ead8" stroke-width="4" fill="none"/>
      <rect x="52" y="82" width="16" height="16" rx="4" fill="${face}"/>
      <ellipse cx="60" cy="58" rx="27" ry="30" fill="${face}"/>
      ${look.sex === 'f' ? hairF : hairM}
      ${flush ? `<ellipse cx="42" cy="68" rx="5" ry="3" fill="#e58b7a" opacity=".45"/><ellipse cx="78" cy="68" rx="5" ry="3" fill="#e58b7a" opacity=".45"/>` : ''}
      ${brows}${eyes}${lines}
      <path d="M59 62 q2 6 -1 8" stroke="#b39279" stroke-width="1.2" fill="none"/>
      ${mouth}${beard}
    </svg>`;
  }

  /* 脉象：从脉诊文本解析快慢、浮沉、形态，画成滚动的脉搏波 */
  function pulseSvg(txt) {
    const t = txt || '';
    const per = /数|疾/.test(t) ? 26 : /迟|缓/.test(t) ? 52 : 38;
    const amp = /洪|滑|浮/.test(t) && !/无力/.test(t) ? 16 : /细|弱|无力|沉|微/.test(t) ? 6 : 11;
    const sharp = /弦|紧/.test(t);
    const rough = /涩|结|代/.test(t);
    const base = 24;
    let d = `M0 ${base}`;
    for (let x = 0, i = 0; x < 320; x += per, i++) {
      const a = rough && i % 3 === 2 ? amp * 0.5 : amp;
      if (sharp) d += ` L${x + per * 0.2} ${base} L${x + per * 0.3} ${base - a} L${x + per * 0.4} ${base + a * 0.3} L${x + per * 0.5} ${base}`;
      else d += ` L${x + per * 0.15} ${base} Q${x + per * 0.3} ${base - a * 2} ${x + per * 0.45} ${base} Q${x + per * 0.55} ${base + a * 0.4} ${x + per * 0.7} ${base}`;
      d += ` L${x + per} ${base}`;
    }
    const dur = (per / 38 * 1.6).toFixed(2);
    return `<svg class="pulse" viewBox="0 0 160 48" preserveAspectRatio="none" aria-label="脉象">
      <g style="--per:-${per}px;animation-duration:${dur}s"><path d="${d}" fill="none" stroke="#9c4a3c" stroke-width="1.6" stroke-linejoin="round"/></g>
    </svg>`;
  }

  /* 场景：百子柜作背景，病人立于柜台后 */
  function sceneView(o) {
    const left = VISITS_PER_DAY - state.day.visits;
    const lamps = Array.from({ length: VISITS_PER_DAY }, (_, i) => `<i class="${i < state.day.visits ? 'off' : ''}"></i>`).join('');
    return `<div class="scene${o.compact ? ' compact' : ''}">
      <div class="cabinet"></div>
      <div class="plaque">杏林堂</div>
      <div class="lamps" title="今日余 ${left} 诊">${lamps}</div>
      ${o.person ? `<div class="patient${fx.enter ? ' enter' : ''}${o.mood === 'happy' ? ' hop' : ''}">${o.person}</div>`
        : `<div class="vacant">堂上暂无病人</div>`}
      ${o.bubble ? `<div class="bubble${fx.enter || fx.result ? ' pop' : ''}">${o.bubble}</div>` : ''}
      ${o.stamp ? `<div class="stamp ${o.stamp.cls}${fx.result ? ' in' : ''}">${o.stamp.t}</div>` : ''}
      <div class="counter">${o.name ? `<span class="nameplate">${o.name}</span>` : ''}</div>
    </div>`;
  }

  function viewShop() {
    const left = VISITS_PER_DAY - state.day.visits;
    if (!state.patient) {
      const wait = (state.pending || []).length;
      let body = sceneView({});
      body += `<div class="card empty">
        ${left > 0
          ? `<p>今日还可出诊 <b>${left}</b> 次${wait ? ` · 门外 <b>${wait}</b> 位复诊` : ''}</p>
             <button class="primary big" data-act="next">请下一位</button>`
          : '<p class="dim">今日已闭门，明日再来。</p>'}
      </div>`;
      if (state.stats) {
        const s = state.stats;
        body += `<div class="card"><h3>行医札记</h3>
          <div class="statrow"><span><b>${s.great}</b>显效</span><span><b>${s.ok}</b>好转</span><span><b>${s.none}</b>无效</span><span><b>${s.worse}</b>加重</span></div></div>`;
      }
      return body + discipleCard();
    }

    const p = state.patient, syn = S(p.sid), look = lookOf(p);
    const fu = p.tries > 1;
    const name = look.name + (fu ? ' · 复诊' : '');

    if (p.done) return resultView(p, syn, look, name);

    if (picker.step === 1) {
      const seen = p.seen || [];
      const all = ZHEN.every(z => seen.includes(z.k));
      const bubble = fu ? `上回的药没见效……${syn.c}。` : `先生，我${syn.c}。`;
      const notes = seen.map(k => {
        const fresh = fx.zhen === k ? ' fresh' : '';
        if (k === 'w') return `<div class="note${fresh}"><span>望</span><div class="note-b">${tongueSvg(syn.w)}<em>${syn.w}</em></div></div>`;
        if (k === 'q') return `<div class="note${fresh}"><span>问</span><div class="note-b"><em>${syn.q}</em></div></div>`;
        return `<div class="note${fresh}"><span>切</span><div class="note-b">${pulseSvg(syn.pu)}<em>${syn.pu}</em></div></div>`;
      }).join('');
      return sceneView({ person: personSvg(look, syn, 'ill'), bubble, name })
        + `<div class="card">
          <div class="zhen">${ZHEN.map(z => `
            <button class="zt${seen.includes(z.k) ? ' done' : ''}" data-zhen="${z.k}"><b>${z.t}</b><span>${z.d}</span></button>`).join('')}
          </div>
          ${notes ? `<div class="notes">${notes}</div>` : '<p class="dim small center">依次点开望、问、切，收齐线索再辨证。</p>'}
          ${fu && p.miss && p.miss.length ? `<p class="small miss">上次未及：<b>${p.miss.join('、')}</b>——这回多顾着这一头。</p>` : ''}
          ${all ? `<p class="hintline${fx.zhen ? ' fresh' : ''}">心中有数 · 治法当 <b>${syn.hint}</b></p>` : ''}
          <div class="row">
            <button data-act="refuse">婉拒</button>
            <button class="primary" data-act="topick" ${all ? '' : 'disabled'}>${all ? '辨证' : `四诊 ${seen.length} / 3`}</button>
          </div>
        </div>`;
    }

    if (picker.step === 2) {
      const fam = picker.fam;
      return `<div class="card case">
          <div class="case-h"><span class="mini-face">${personSvg(look, syn, 'ill')}</span><b>${name}</b><span class="dim small">「${syn.c}」</span></div>
          <p class="small"><span class="k">望</span>${syn.w}</p>
          <p class="small"><span class="k">问</span>${syn.q}</p>
          <p class="small"><span class="k">切</span>${syn.pu}</p>
          <p class="small"><span class="k">法</span><b class="red">${syn.hint}</b></p>
        </div>
        <div class="card"><h3>辨证 · 先定大类</h3>
          <div class="fams">${FAMS.map(f => `
            <button class="fam${fam === f ? ' on' : ''}" data-fam="${f}"><b>${f}</b><span>${FAM_DESC[f]}</span></button>`).join('')}
          </div>
          ${fam ? `<h3 class="sub">再辨具体证型</h3>
            <div class="syns">${SYNDROMES.filter(s => s.family === fam).map(s => `
              <button class="syn${picker.sid === s.id ? ' on' : ''}" data-sid="${s.id}">${s.name}</button>`).join('')}</div>` : ''}
          <div class="row"><button data-act="back1">回看四诊</button>
            <button class="primary" data-act="toherbs" ${picker.sid ? '' : 'disabled'}>据此开方</button></div>
        </div>`;
    }

    return pickerView(p, syn, look, name);
  }

  function pickerView(p, syn, look, name) {
    const dx = S(picker.sid);
    const items = availableItems();
    const have = new Set();
    picker.picks.forEach(x => effectsOf(x.n, x.form).forEach(e => have.add(e)));
    const needE = new Set(expectedEffects(dx));
    let taboo = null;
    for (let i = 0; i < picker.picks.length; i++) for (let j = i + 1; j < picker.picks.length; j++) {
      const a = picker.picks[i].n, b = picker.picks[j].n;
      const hit = INCOMPATIBLE.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
      if (hit) taboo = hit;
    }
    const pills = dx.p.map(t => {
      const ok = (PATHOGEN_MAP[t] || []).some(e => have.has(e));
      return `<button class="pill${ok ? ' ok' : ''}${picker.filterP === t ? ' on' : ''}" data-fp="${t}">${ok ? '✓' : ''}${t}</button>`;
    }).join('');
    const covered = dx.p.filter(t => (PATHOGEN_MAP[t] || []).some(e => have.has(e))).length;

    const slots = picker.picks.map((x, i) => {
      const label = x.form && x.form !== '生' ? x.form : x.n;
      return `<button class="rx-herb${i === picker.monarch ? ' jun' : ''}${fx.picked === i ? ' drop' : ''}" data-rx="${i}">
        ${i === picker.monarch ? '<i>君</i>' : ''}${label}<span class="rm" data-rm="${i}">×</span></button>`;
    }).join('');

    let list = items;
    if (picker.filterP) {
      const want = PATHOGEN_MAP[picker.filterP] || [];
      list = list.filter(it => effectsOf(it.n, it.form).some(e => want.includes(e)));
    }
    const quick = FORMULAS.filter(f => formulaUnlocked(f) && f.herbs.every(n => items.some(it => it.n === n)));

    const drawers = list.map(it => {
      const key = it.n + '|' + it.form;
      const picked = picker.picks.some(x => x.n === it.n && (x.form || '生') === it.form);
      const eff = effectsOf(it.n, it.form).slice().sort((a, b) => needE.has(b) - needE.has(a)).slice(0, 2);
      return `<button class="drawer${picked ? ' on' : ''}" data-pick="${key}">
        <span class="knob"></span>
        <b>${it.label}</b>
        <i>${eff.map(e => needE.has(e) ? `<u>${e}</u>` : e).join(' ')}</i>
        <em>${it.qty}</em>
      </button>`;
    }).join('');

    return `<div class="rx">
        <div class="rx-head">
          <span class="mini-face">${personSvg(look, syn, 'ill')}</span>
          <div><b>${name}</b><span class="dim small">辨为「${dx.name}」</span></div>
          <button class="mini" data-act="back2">改辨证</button>
        </div>
        <div class="rx-paper">
          <span class="rx-title">方</span>
          <div class="rx-slots">${slots || '<span class="dim small">从下方百子柜抓药 · 点方上药名定君药</span>'}</div>
        </div>
        <div class="rx-cover"><span class="dim small">病机 ${covered}/${dx.p.length}</span>${pills}</div>
        ${taboo ? `<p class="warn">⚠ ${taboo[0]}、${taboo[1]}相反，同方必加重</p>` : ''}
        <div class="row">
          <button data-act="refuse">婉拒</button>
          <button class="primary" data-act="submit" ${picker.picks.length ? '' : 'disabled'}>开方抓药 · ${picker.picks.length} 味</button>
        </div>
      </div>
      <div class="card cab">
        ${quick.length ? `<div class="quick"><span class="dim small">成方</span>
          ${quick.map(f => `<button class="chip" data-formula="${f.id}">${f.name}</button>`).join('')}</div>` : ''}
        <div class="cab-head"><b>百子柜</b>
          <span class="dim small">${picker.filterP
            ? `只看能应「${picker.filterP}」的药 · <button class="link" data-fp="">看全部</button>`
            : `共 ${items.length} 格 · 点上方病机可筛`}</span></div>
        ${list.length ? `<div class="drawers">${drawers}</div>`
          : `<p class="dim small">柜里没有能应此病机的药。去药圃种、去山林采，或先炮制。</p>`}
      </div>`;
  }

  function resultView(p, syn, look, name) {
    const r = p.result;
    const mood = r.grade === 'great' ? 'happy' : r.grade === 'ok' ? 'calm' : 'sad';
    const rows = [
      ['辨证', r.s1, SCORE.syndrome], ['病机', r.s2, SCORE.coverage],
      ['君药·配伍', r.s3, SCORE.monarch + SCORE.noTaboo], ['炮制', r.s4, 10],
      ['精简', r.s5, SCORE.brevity], ['成方', r.bonus, SCORE.formulaBonus]
    ];
    const wrongDx = !r.s1 && p.dx && S(p.dx);
    return sceneView({
      person: personSvg(look, syn, mood), bubble: p.line || pick(LINES[r.grade]), name, mood,
      stamp: { t: GRADE_TEXT[r.grade].t, cls: r.grade }
    }) + `<div class="card result">
        <div class="score"><b class="${r.grade}">${r.total}</b><span class="dim">/ 100</span>
          <span class="gain">+${p.pay} 文${p.repDelta ? ` · 声望 ${p.repDelta > 0 ? '+' : ''}${p.repDelta}` : ''}</span></div>
        <div class="bars">${rows.map(([k, v, m]) => `
          <div class="brow"><span>${k}</span><span class="track"><i class="${fx.result ? 'grow' : ''}" style="width:${m ? Math.round(v / m * 100) : 0}%"></i></span><em>${v}/${m}</em></div>`).join('')}
        </div>
        ${wrongDx ? `<p class="small">辨证偏了——你辨为「${wrongDx.name}」，此病属<b class="red">「${syn.family}」</b>一类。</p>` : ''}
        ${r.missing && r.missing.length ? `<p class="small">方中未顾及：<b class="red">${r.missing.join('、')}</b></p>` : ''}
        ${r.formula ? `<p class="small good">套用成方「${r.formula}」，一方中的。</p>` : ''}
        ${r.formulaMisfit ? `<p class="small dim">所开与「${r.formulaMisfit}」组成相同，然不对此证。</p>` : ''}
        ${r.taboo ? `<p class="small warn">触犯配伍禁忌：${r.taboo.join('反')}</p>` : ''}
        ${r.grade === 'none' || r.grade === 'worse' ? '<p class="small dim">诊金照付，病人改日带着线索复诊。</p>' : ''}
        <button class="primary big" data-act="clear">送客</button>
      </div>`;
  }

  /* —— 通用：弹窗 / 奖励 / 药材印章 —— */
  const natColor = t => /寒/.test(t) ? '#4f7ea8' : /凉/.test(t) ? '#5f9a96' : /热/.test(t) ? '#b8432f' : /温/.test(t) ? '#c07a3a' : '#8a7f5a';
  const herbSeal = (n, cls) => `<span class="seal ${cls || ''}" style="--c:${natColor(H(n).t)}">${n[0]}</span>`;
  const stars = st => `<span class="stars">${[1, 2, 3].map(i => `<i class="${i <= st ? 'on' : ''}">★</i>`).join('')}</span>`;

  function openModal(html, onBind) {
    closeModal();
    const m = document.createElement('div');
    m.id = 'modal';
    m.className = 'modal';
    m.innerHTML = `<div class="modal-box">${html}</div>`;
    m.onclick = e => { if (e.target === m || e.target.closest('[data-mclose]')) closeModal(); };
    document.body.appendChild(m);
    if (onBind) onBind(m);
  }
  function closeModal() { const m = $('#modal'); if (m) m.remove(); }

  function itemIcon(it) {
    if (it.k === 'herb') return herbSeal(it.n, 'lg');
    if (it.k === 'seed') return `<span class="ico seed">${it.n[0]}</span>`;
    if (it.k === 'mat') return `<span class="ico jar">${it.n[0]}</span>`;
    return '<span class="ico scroll">秘</span>';
  }
  function showReward(title, items, sub) {
    openModal(`<div class="reward">
      <div class="rays"></div>
      <h2>${title}</h2>${sub ? `<p class="dim small">${sub}</p>` : ''}
      <div class="loot">${items.map((it, i) => `
        <div class="lootitem ${it.k}" style="animation-delay:${(0.15 + i * 0.1).toFixed(2)}s">
          ${it.nw ? '<i class="new">新</i>' : ''}${itemIcon(it)}<b>${it.n}</b>${it.q ? `<em>×${it.q}</em>` : ''}</div>`).join('')}
      </div>
      <button class="primary big" data-mclose>收下</button></div>`);
  }

  /* 药圃 */
  let farmView = 'seed';
  const herbHue = n => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

  function plantSvg(name, stage) {
    const hue = herbHue(name);
    const leaf = `hsl(${95 + hue % 45},42%,36%)`;
    const leaf2 = `hsl(${105 + hue % 45},40%,46%)`;
    const flower = `hsl(${hue},62%,64%)`;
    let g = '<ellipse cx="40" cy="62" rx="24" ry="6" fill="#5a3b22"/>';
    if (stage === 0) g += '<ellipse cx="40" cy="58" rx="11" ry="5" fill="#7a5532"/><circle cx="40" cy="55" r="2.6" fill="#d8b47a"/>';
    if (stage >= 1) {
      const top = stage === 1 ? 46 : 28;
      g += `<path d="M40 60 V${top}" stroke="${leaf}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M40 52 q-11 -7 -15 -2 q6 7 15 2Z" fill="${leaf2}"/><path d="M40 49 q11 -7 15 -2 q-6 7 -15 2Z" fill="${leaf}"/>`;
    }
    if (stage >= 2) g += `<path d="M40 40 q-13 -7 -18 0 q9 7 18 0Z" fill="${leaf}"/><path d="M40 36 q13 -7 18 0 q-9 7 -18 0Z" fill="${leaf2}"/>
        <path d="M40 30 q-6 -8 0 -12 q6 4 0 12Z" fill="${leaf2}"/>`;
    if (stage >= 3) g += `<g fill="${flower}"><circle cx="40" cy="22" r="5.5"/><circle cx="27" cy="33" r="4"/><circle cx="53" cy="31" r="4"/></g>
        <g fill="#f7e27a"><circle cx="40" cy="22" r="2"/><circle cx="27" cy="33" r="1.4"/><circle cx="53" cy="31" r="1.4"/></g>`;
    return `<svg class="plant" viewBox="0 0 80 70" aria-hidden="true">${g}</svg>`;
  }

  function viewFarm() {
    const t = now();
    const plots = state.farm.map((s, i) => {
      if (!s) return `<button class="plot empty" data-sow="${i}">${plantSvg('', -1)}<span class="plot-tag">＋ 播种</span></button>`;
      const left = s.ready - t;
      if (left <= 0) return `<button class="plot ripe" data-harvest="${i}">${plantSvg(s.n, 3)}
        <span class="plot-name">${s.n}</span><span class="plot-tag go">收获</span></button>`;
      const prog = (t - s.at) / (s.ready - s.at);
      const stage = prog < 0.12 ? 0 : prog < 0.5 ? 1 : 2;
      return `<div class="plot">${plantSvg(s.n, stage)}
        <span class="plot-name">${s.n}</span>
        <span class="plot-bar"><i style="width:${Math.min(100, prog * 100)}%"></i></span>
        <span class="plot-time">${fmtLeft(left)}</span></div>`;
    }).join('');
    const seedCnt = Object.values(state.seeds).reduce((a, b) => a + b, 0);
    const invCnt = Object.keys(state.inv).filter(n => state.inv[n] > 0).length;
    const tabs = [['seed', '种子铺'], ['prep', '炮制坊'], ['mat', '辅料']];
    let sub;
    if (farmView === 'prep') sub = viewPrep();
    else if (farmView === 'mat') sub = viewMats();
    else sub = viewSeedShop();
    return `<div class="field">
        <div class="field-sky"><span class="sun"></span><span class="cloud c1"></span><span class="cloud c2"></span></div>
        <div class="plots">${plots}</div>
        <div class="field-bar"><span>种子 <b>${seedCnt}</b></span><span>药柜 <b>${invCnt}</b> 味</span></div>
      </div>
      <div class="wtabs">${tabs.map(([k, l]) => `<button class="${farmView === k ? 'on' : ''}" data-fview="${k}">${l}</button>`).join('')}</div>
      ${sub}`;
  }

  function viewSeedShop() {
    const catalog = ALL_HERB_NAMES.filter(n => H(n).g <= 2 + Math.min(2, Math.floor(state.rep / 5)));
    return `<div class="card"><h3>种子铺<span class="dim small">　声望越高，品类越多</span></h3>
      <div class="packets">${catalog.map(n => {
        const h = H(n), price = SEED_PRICE[h.g], own = state.seeds[n] || 0;
        return `<button class="packet" data-buy="${n}" ${state.money < price ? 'disabled' : ''}>
          ${own ? `<em class="own">${own}</em>` : ''}
          ${herbSeal(n)}<b>${n}</b>
          <span class="dim">${'●'.repeat(h.g)} ${fmtLeft(GROW_SECONDS[h.g] * 1000)}</span>
          <span class="price"><i class="coin-i"></i>${price}</span>
        </button>`;
      }).join('')}</div></div>`;
  }

  function viewMats() {
    return `<div class="card"><h3>辅料<span class="dim small">　炮制所需，远行也会带回</span></h3>
      <div class="jars">${MATERIALS.map(m => `
        <button class="jarcard" data-mat="${m.id}" ${state.money < m.price ? 'disabled' : ''}>
          <span class="ico jar">${m.name[0]}</span><b>${m.name}</b>
          <span class="dim small">${m.desc}</span>
          <span class="row2"><em>存 ${state.mats[m.id] || 0}</em><span class="price"><i class="coin-i"></i>${m.price}</span></span>
        </button>`).join('')}</div></div>`;
  }

  /* 炮制 */
  function viewPrep() {
    const cands = [];
    HERBS.forEach(h => {
      if (!h.fo || !h.fo.length) return;
      if (!(state.inv[h.n] > 0)) return;
      h.fo.forEach(f => cands.push({ n: h.n, f }));
    });
    const carried = Object.keys(state.preps).flatMap(n =>
      Object.keys(state.preps[n]).map(form => ({ n, form, q: state.preps[n][form] }))
    );
    if (!cands.length && !carried.length) {
      return `<div class="card"><h3>炮制坊</h3>
        <p class="dim">生品入柜后即可炮制。同一味药换个制法，药性便有偏重——甘草生用清热、蜜炙补中；当归生用补血、酒炒活血。</p></div>`;
    }
    return `<div class="card"><h3>炮制坊</h3>
      ${carried.length ? `<div class="made">${carried.map(c => `<span>${c.form}<em>×${c.q}</em></span>`).join('')}</div>` : ''}
      <div class="preps">
        ${cands.map(({ n, f }) => {
          const c = prepCost(f);
          const ok = canPrep(n, f.n);
          return `<div class="prepcard${ok ? '' : ' no'}">
            <div class="prep-flow">${herbSeal(n)}<span class="plus">${c.mat ? '+' : '×2'}</span>${c.mat ? `<span class="ico jar sm">${MAT_BY_ID[f.mat].name[0]}</span>` : ''}<span class="arr">→</span><b>${f.n}</b></div>
            <span class="dim small">${f.pr}${f.add ? ' · 增「' + f.add + '」' : ''}</span>
            <button class="primary mini" data-prep="${n}|${f.n}" ${ok ? '' : 'disabled'}>开炉</button>
          </div>`;
        }).join('')}
      </div>
      <p class="dim small">炮制过的药，开方时与生品并列可选，药性会变。</p>
    </div>`;
  }

  function openSow(i) {
    const own = Object.keys(state.seeds).filter(n => state.seeds[n] > 0);
    openModal(`<h2 class="mtitle">选种播下</h2>
      ${own.length ? `<div class="packets">${own.map(n => `
        <button class="packet" data-sowpick="${n}">${herbSeal(n)}<b>${n}</b>
          <span class="dim">${fmtLeft(GROW_SECONDS[H(n).g] * 1000 / TIME_SCALE)}</span><em class="own">${state.seeds[n]}</em></button>`).join('')}</div>`
        : '<p class="dim center">手头没有种子。去种子铺买，或上山采药偶得。</p>'}
      <button class="big" data-mclose>取消</button>`, m => {
      $$('[data-sowpick]', m).forEach(b => b.onclick = () => { closeModal(); plant(i, b.dataset.sowpick); });
    });
  }

  function buyMat(id) {
    const m = MAT_BY_ID[id];
    if (!m || state.money < m.price) return;
    state.money -= m.price;
    state.mats[id] = (state.mats[id] || 0) + 1;
    save(); render();
    toast(`买得${m.name}一份`);
  }

  /* 山林 */
  const MAP_POS = {
    guanDong: [84, 16], huaBei: [63, 27], xiBei: [33, 30], shanDong: [79, 36], huaiQing: [61, 40],
    wanNan: [72, 50], jiangZhe: [85, 55], liangHu: [59, 59], chuanYu: [39, 56], yunGui: [34, 74], lingNan: [62, 80]
  };
  const HOME = [70, 44];
  let landSel = null;

  function mapSvg() {
    const e = state.exp;
    const mtn = (x, y) => `<path d="M${x - 4} ${y} L${x} ${y - 5} L${x + 4} ${y}" fill="#b9a27a" stroke="#8a7350" stroke-width=".5"/>`;
    let trip = '';
    if (e) {
      const [x, y] = MAP_POS[e.rid];
      const r = R(e.rid);
      const total = r.hours * 3600000 / TIME_SCALE;
      const k = Math.max(0, Math.min(1, 1 - (e.end - now()) / total));
      const f = k < 0.5 ? k * 2 : (1 - k) * 2;   // 去程 → 回程
      const px = HOME[0] + (x - HOME[0]) * f, py = HOME[1] + (y - HOME[1]) * f;
      trip = `<path d="M${HOME[0]} ${HOME[1]} L${x} ${y}" stroke="#9c4a3c" stroke-width=".7" stroke-dasharray="1.5 1.5" fill="none"/>
        <g class="porter" transform="translate(${px.toFixed(1)} ${py.toFixed(1)})"><circle r="2.6" fill="#fffdf7" stroke="#9c4a3c" stroke-width=".7"/><text y="1" font-size="3" text-anchor="middle" fill="#9c4a3c">夫</text></g>`;
    }
    const nodes = REGIONS.map(r => {
      const [x, y] = MAP_POS[r.id];
      const locked = state.rep < r.unlockRep;
      const cls = (locked ? ' locked' : '') + (landSel === r.id ? ' sel' : '') + (e && e.rid === r.id ? ' dest' : '');
      return `<g class="node${cls}" data-region="${r.id}" transform="translate(${x} ${y})">
        <circle r="5" class="hit"/><circle r="2.4" class="dot"/>
        <text y="-4" text-anchor="middle">${r.name}${locked ? '🔒' : ''}</text></g>`;
    }).join('');
    return `<svg class="map" viewBox="0 0 100 90">
      <path d="M8 34 Q14 22 28 20 Q40 12 54 16 Q62 8 74 6 Q88 2 96 10 Q98 20 90 26 Q84 30 86 36 Q90 44 88 52 Q90 62 82 70 Q74 82 64 86 Q54 89 48 82 Q40 85 32 80 Q24 75 22 66 Q14 62 12 54 Q4 46 8 34Z"
        fill="#efe1bf" stroke="#b39a6a" stroke-width=".8"/>
      <path d="M18 42 Q30 30 42 35 Q50 24 58 31 Q66 39 78 34" stroke="#d8b064" stroke-width="1.1" fill="none" opacity=".8"/>
      <path d="M22 61 Q34 64 44 59 Q54 65 62 57 Q72 61 88 56" stroke="#7fa6b8" stroke-width="1.2" fill="none" opacity=".85"/>
      ${mtn(26, 46)}${mtn(30, 44)}${mtn(48, 66)}${mtn(52, 68)}${mtn(70, 20)}${mtn(44, 26)}${mtn(28, 66)}
      ${trip}
      <g transform="translate(${HOME[0]} ${HOME[1]})"><rect x="-3" y="-3" width="6" height="6" rx="1" fill="#9c4a3c"/><text y="1.2" font-size="3.4" text-anchor="middle" fill="#fff">堂</text></g>
      ${nodes}
    </svg>`;
  }

  function viewLand() {
    const left = GATHERS_PER_DAY - state.day.gathers;
    const e = state.exp;
    let panel = '';
    if (e) {
      const r = R(e.rid), done = now() >= e.end;
      const total = r.hours * 3600000 / TIME_SCALE;
      panel = `<div class="card trip">
        <h3>脚夫在「${r.name}」路上</h3>
        <div class="plot-bar big"><i style="width:${Math.min(100, (1 - (e.end - now()) / total) * 100)}%"></i></div>
        <p class="dim small">${done ? '脚夫已挑着担子回来了！' : '还需 ' + fmtLeft(e.end - now())}</p>
        ${done ? '<button class="primary big" data-act="claim">验货收下</button>' : ''}
      </div>`;
    } else if (landSel) {
      const r = R(landSel), locked = state.rep < r.unlockRep;
      panel = `<div class="card region-panel">
        <h3>${r.name}<span class="dim small">　${r.climate}</span></h3>
        <p class="small">${r.desc}</p>
        <div class="specs">${r.specialty.filter(n => H(n)).map(n => `<span class="spec">${herbSeal(n)}${n}</span>`).join('')}</div>
        ${locked ? `<p class="dim small center">声望 ${r.unlockRep} 方可前往（现 ${state.rep}）</p>`
          : `<button class="primary big" data-send="${r.id}">遣脚夫前往 · ${fmtLeft(r.hours * 3600000 / TIME_SCALE)}</button>`}
      </div>`;
    } else {
      panel = '<p class="dim small center maptip">点地图上的产区，看当地特产、遣脚夫远行</p>';
    }
    return `<div class="hill">
        <div class="hill-art"><span class="m m1"></span><span class="m m2"></span><span class="m m3"></span><span class="mist"></span></div>
        <div class="hill-body">
          <div><h3>近山采药</h3><p class="small">多得当地常见药，偶得种子</p>
            <div class="baskets">${Array.from({ length: GATHERS_PER_DAY }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}</div></div>
          <button class="primary" data-act="gather" ${left > 0 ? '' : 'disabled'}>${left > 0 ? '上山' : '明日再来'}</button>
        </div>
      </div>
      <div class="card mapcard"><h3>远行 · 十一产区</h3>${mapSvg()}</div>
      ${panel}`;
  }

  /* 图鉴 */
  let atlasView = 'herb';

  const CAT_ORDER = ['解表', '清热', '燥湿', '利湿', '化湿', '化痰', '止咳', '宣肺', '补气', '补血', '补阴', '温阳',
    '行气', '活血', '止血', '安神', '消食', '涩肠', '平肝', '祛风', '温经', '软坚', '降逆', '解毒', '固表', '通络'];

  const hcard = (n, tag) => {
    const a = state.atlas[n], st = a ? a.stage : 0;
    return `<button class="hcard st${st}" data-herb="${n}">
      ${st ? herbSeal(n) : '<span class="seal unk">？</span>'}
      <b>${n}</b>${tag ? `<em class="dd">${tag}</em>` : ''}${st ? stars(st) : '<span class="stars dim">未识</span>'}
    </button>`;
  };

  function viewAtlas() {
    const owned = Object.keys(state.atlas).filter(n => state.atlas[n].stage > 0);
    const tot = ALL_HERB_NAMES.length;
    const tong = owned.filter(n => state.atlas[n].stage >= 2).length;
    const jing = owned.filter(n => state.atlas[n].stage >= 3).length;
    const fGot = FORMULAS.filter(formulaUnlocked).length;
    const bar = (v, m, l) => `<div class="prog"><span>${l}</span><span class="plot-bar"><i style="width:${v / m * 100}%"></i></span><em>${v}/${m}</em></div>`;
    const head = `<div class="card atlas-head">
        <div class="book">${owned.length}<small>/${tot}</small></div>
        <div class="progs">${bar(owned.length, tot, '已识')}${bar(tong, tot, '通')}${bar(jing, tot, '精')}</div>
      </div>
      <div class="wtabs">
        <button class="${atlasView === 'herb' ? 'on' : ''}" data-aview="herb">功效</button>
        <button class="${atlasView === 'region' ? 'on' : ''}" data-aview="region">产地</button>
        <button class="${atlasView === 'formula' ? 'on' : ''}" data-aview="formula">药方 ${fGot}/${FORMULAS.length}</button>
      </div>`;
    if (atlasView === 'formula') return head + viewFormulas();
    if (atlasView === 'region') return head + viewRegions();
    return head + viewHerbGroups();
  }

  function viewRegions() {
    return REGIONS.map(r => {
      const list = HERBS.filter(h => h.r.includes(r.name));
      const known = list.filter(h => (state.atlas[h.n] || {}).stage >= 1).length;
      const locked = state.rep < r.unlockRep;
      return `<div class="card">
        <h3>${r.name}<span class="dim small">　${r.climate}${locked ? ' · 需声望 ' + r.unlockRep : ''}</span><span class="cnt">${known}/${list.length}</span></h3>
        <p class="dim small">${r.desc}</p>
        <div class="hgrid">${list.map(h => hcard(h.n, h.dd === r.name ? '道地' : '')).join('')}</div>
      </div>`;
    }).join('');
  }

  function viewHerbGroups() {
    const map = {};
    HERBS.forEach(h => { const k = h.e[0]; (map[k] = map[k] || []).push(h.n); });
    const keys = Object.keys(map).sort((a, b) => {
      const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return keys.map(k => {
      const known = map[k].filter(n => (state.atlas[n] || {}).stage >= 1).length;
      return `<div class="card"><h3>${k}类<span class="cnt">${known}/${map[k].length}</span></h3>
        <div class="hgrid">${map[k].map(n => hcard(n)).join('')}</div></div>`;
    }).join('');
  }

  function viewFormulas() {
    const tierBlock = (tier, intro) => {
      const list = FORMULAS.filter(f => f.tier === tier);
      const got = list.filter(formulaUnlocked).length;
      return `<div class="card"><h3>${tier}<span class="cnt">${got}/${list.length}</span></h3>
        <p class="dim small">${intro}</p></div>` +
        list.map(f => {
          const have = formulaProgress(f);
          const ok = formulaUnlocked(f);
          const secretLocked = tier === '秘方' && !ok;
          return `<div class="card fml${ok ? ' ok' : ''}${secretLocked ? ' sealed' : ''}">
            <h3>${ok || tier === '常用' ? f.name : '未得秘方'}<span class="dim small">　${S(f.syndrome).name}</span>${ok ? '<span class="got">已得</span>' : ''}</h3>
            ${secretLocked
              ? `<p class="dim small">方名未识。遣脚夫远行，或可于他乡得之。</p>`
              : `<div class="fherbs">${f.herbs.map(n => {
                  const k = (state.atlas[n] || {}).stage >= 1;
                  return `<span class="${k ? '' : 'miss'}">${n}</span>`;
                }).join('')}</div>
                 <p class="dim small">${f.note}</p>
                 ${ok ? '' : `<span class="plot-bar"><i style="width:${have / f.herbs.length * 100}%"></i></span>`}`}
          </div>`;
        }).join('');
    };
    return tierBlock('常用', '集齐组成药材（图鉴「初识」）即自动解锁。开方时可一键套用，对症另得「成方」加成。') +
      tierBlock('秘方', '药材集齐也换不来，只能遣脚夫远行时偶遇孤本。得之则多一条捷径。');
  }

  function herbDetail(name) {
    const h = H(name), a = state.atlas[name] || { stage: 0, uses: 0, regions: [], forms: [] };
    const lock = a.stage < 1;
    return `<div class="hdetail" style="--c:${natColor(h.t)}">
      <div class="hd-top">${lock ? '<span class="seal unk xl">？</span>' : herbSeal(name, 'xl')}
        <div><h2>${name}</h2>${lock ? '<span class="dim small">未识</span>' : stars(a.stage)}</div></div>
      ${lock ? '<p class="dim center">尚未采得此药。种下、采到或买到即可点亮。</p>' : `
        <div class="tags"><span>${h.s}</span><span>性${h.t}</span><span>味${h.f.join('')}</span><span>归${h.m.join('、')}经</span></div>
        <p class="hd-k">功效</p><div class="tags eff">${h.e.map(e => `<span>${e}</span>`).join('')}</div>
        <p class="hd-k">产地</p><p class="small">${h.r.map(r => r === h.dd ? `<b class="red">${r}（道地）</b>` : r).join('　')}</p>
        <p class="hd-desc">${h.x}</p>
        ${h.fo ? `<p class="hd-k">炮制</p><div class="tags">${h.fo.map(f => `<span>${f.n}${f.add ? ' +' + f.add : ''}</span>`).join('')}</div>` : ''}
        ${a.stage >= 2 ? `<p class="dim small">已用 ${a.uses} 次${a.regions.length ? ' · 见于 ' + a.regions.map(id => (R(id) || {}).name || id).join('、') : ''}</p>` : ''}
      `}
      <button class="big" data-mclose>合上</button></div>`;
  }

  /* —— 交互 —— */
  function bind() {
    $$('#main [data-act]').forEach(b => b.onclick = () => act(b.dataset.act));
    $$('#main [data-sid]').forEach(b => b.onclick = () => { picker.sid = b.dataset.sid; render(); });
    $$('#main [data-fam]').forEach(b => b.onclick = () => {
      if (picker.fam !== b.dataset.fam) picker.sid = null;
      picker.fam = b.dataset.fam; render();
    });
    $$('#main [data-zhen]').forEach(b => b.onclick = () => {
      const p = state.patient;
      p.seen = p.seen || [];
      if (!p.seen.includes(b.dataset.zhen)) { p.seen.push(b.dataset.zhen); fx.zhen = b.dataset.zhen; save(); }
      render();
    });
    $$('#main [data-fp]').forEach(b => b.onclick = () => {
      picker.filterP = picker.filterP === b.dataset.fp ? '' : b.dataset.fp; render();
    });
    $$('#main [data-rx]').forEach(b => b.onclick = e => {
      const i = +b.dataset.rx;
      if (e.target.dataset.rm !== undefined) {
        picker.picks.splice(i, 1);
        if (picker.monarch === i) picker.monarch = -1; else if (picker.monarch > i) picker.monarch--;
      } else {
        picker.monarch = picker.monarch === i ? -1 : i;
      }
      render();
    });
    $$('#main [data-formula]').forEach(b => b.onclick = () => {
      const f = FORMULAS.find(x => x.id === b.dataset.formula);
      if (!f) return;
      const items = availableItems();
      picker.picks = f.herbs.map(n => {
        // 优先生品，缺则用炮制品顶上
        const cand = items.filter(it => it.n === n);
        const chosen = cand.find(it => it.form === '生') || cand[0];
        return { n, form: chosen ? chosen.form : '生' };
      });
      picker.monarch = 0;
      render();
    });
    $$('#main [data-aview]').forEach(b => b.onclick = () => { atlasView = b.dataset.aview; render(); });
    $$('#main [data-pick]').forEach(b => b.onclick = () => togglePick(b.dataset.pick));
    $$('#main [data-prep]').forEach(b => b.onclick = () => {
      const [n, form] = b.dataset.prep.split('|');
      doPrep(n, form);
    });
    $$('#main [data-mat]').forEach(b => b.onclick = () => buyMat(b.dataset.mat));
    $$('#main [data-harvest]').forEach(b => b.onclick = () => harvest(+b.dataset.harvest));
    $$('#main [data-sow]').forEach(b => b.onclick = () => openSow(+b.dataset.sow));
    $$('#main [data-fview]').forEach(b => b.onclick = () => { farmView = b.dataset.fview; render(); });
    $$('#main [data-region]').forEach(g => g.onclick = () => { landSel = landSel === g.dataset.region ? null : g.dataset.region; render(); });
    $$('#main [data-buy]').forEach(b => b.onclick = () => buySeed(b.dataset.buy));
    $$('#main [data-send]').forEach(b => b.onclick = () => send(b.dataset.send));
    $$('#main [data-herb]').forEach(b => b.onclick = () => openModal(herbDetail(b.dataset.herb)));
    $$('#main [data-hire]').forEach(b => b.onclick = () => hire());
  }

  function act(a) {
    if (a === 'next') nextPatient();
    if (a === 'topick') { picker.step = 2; render(); }
    if (a === 'back1') { picker.step = 1; render(); }
    if (a === 'toherbs') { picker.step = 3; picker.filterP = ''; render(); window.scrollTo(0, 0); }
    if (a === 'back2') { picker.step = 2; render(); }
    if (a === 'refuse') { state.day.visits++; state.patient = null; picker = newPicker(); save(); toast('婉拒送出，少赚一笔'); render(); }
    if (a === 'submit') submit();
    if (a === 'clear') { state.patient = null; picker = newPicker(); save(); render(); }
    if (a === 'gather') gather();
    if (a === 'claim') claim();
  }

  function nextPatient() {
    state.patient = nextPatientObj();
    picker = newPicker();
    fx.enter = true;
    save(); render();
  }

  function togglePick(key) {
    const [n, form] = key.split('|');
    const i = picker.picks.findIndex(p => p.n === n && (p.form || '生') === form);
    if (i >= 0) {
      picker.picks.splice(i, 1);
      if (picker.monarch === i) picker.monarch = -1; else if (picker.monarch > i) picker.monarch--;
    } else {
      picker.picks.push({ n, form });
      fx.picked = picker.picks.length - 1;
    }
    render();
  }

  function hire() {
    const cnt = state.disciple || 0;
    if (cnt >= 3) return;
    if (state.rep < DISCIPLE_REQ[cnt]) { toast('声望不足'); return; }
    if (state.money < DISCIPLE_COST[cnt]) { toast('银钱不足'); return; }
    state.money -= DISCIPLE_COST[cnt];
    state.disciple = cnt + 1;
    save(); render();
    toast('收到第 ' + state.disciple + ' 名弟子，此后小病由他代诊');
  }

  function submit() {
    const r = judge(picker.picks, picker.monarch, picker.sid);
    const p = state.patient;
    const g = GRADE_TEXT[r.grade];
    const pay = 10 + Math.round(p.reward * g.money);
    state.money += pay;
    state.day.visits++;
    state.stats[r.grade]++;
    const rep0 = state.rep;
    state.rep += r.grade === 'great' ? 2 : r.grade === 'ok' ? 1 : r.grade === 'worse' ? -2 : 0;
    if (r.formula) state.rep += 1;
    if (state.rep < 0) state.rep = 0;
    picker.picks.forEach(x => {
      if ((x.form || '生') === '生') {
        if (state.inv[x.n] > 0) state.inv[x.n]--;
        if (!state.inv[x.n]) delete state.inv[x.n];
      } else {
        usePrep(x.n, x.form, 1);
      }
      const a = at(x.n);
      a.uses++;
      if (r.grade === 'great' || r.grade === 'ok') {
        if (a.stage < 2) a.stage = 2;
        if (x.form !== '生' && !a.forms.includes(x.form)) a.forms.push(x.form);
        if (a.uses >= 3 && a.forms.length >= 1) a.stage = 3;
      }
    });
    p.done = true;
    p.result = r;
    p.pay = pay;
    p.repDelta = state.rep - rep0;
    p.dx = picker.sid;
    p.line = pick(LINES[r.grade]);
    // 无效/加重：病人留下，改日复诊，附「未及之处」
    if (r.grade === 'none' || r.grade === 'worse') {
      if (!state.pending) state.pending = [];
      state.pending.push({ sid: p.sid, tries: p.tries || 1, miss: r.missing || [], look: p.look });
      if (state.pending.length > 4) state.pending.length = 4;
    }
    fx.result = true;
    save(); render();
    window.scrollTo(0, 0);
    floatText('+' + pay + ' 文');
  }

  function plant(i, name) {
    if (!state.seeds[name]) return;
    state.seeds[name]--;
    if (!state.seeds[name]) delete state.seeds[name];
    state.farm[i] = { n: name, at: now(), ready: now() + GROW_SECONDS[H(name).g] * 1000 / TIME_SCALE };
    const a = at(name);
    if (a.stage < 1) a.stage = 1;
    save(); render();
  }

  function harvest(i) {
    const s = state.farm[i];
    if (!s || s.ready > now()) return;
    const n = 1 + rnd(2);
    const nw = !((state.atlas[s.n] || {}).stage >= 1);
    addInv(s.n, n);
    state.farm[i] = null;
    save(); render();
    showReward('丰收', [{ k: 'herb', n: s.n, q: n, nw }], '已收入药柜');
  }

  function buySeed(name) {
    const price = SEED_PRICE[H(name).g];
    if (state.money < price) return;
    state.money -= price;
    addSeed(name, 1);
    save(); render();
    floatText('-' + price + ' 文', 'cost');
  }

  function gather() {
    if (state.day.gathers >= GATHERS_PER_DAY) return;
    state.day.gathers++;
    const rid = pick(REGIONS).id;
    const pool = HERBS.filter(h => h.r.includes(R(rid).name) && h.g <= 2);
    const got = [];
    const k = 1 + rnd(2);
    for (let i = 0; i < k; i++) {
      const h = pick(pool.length ? pool : HERBS.filter(x => x.g <= 2));
      const n = 1 + rnd(2);
      const nw = !((state.atlas[h.n] || {}).stage >= 1);
      addInv(h.n, n);
      const a = at(h.n);
      if (!a.regions.includes(rid)) a.regions.push(rid);
      got.push({ k: 'herb', n: h.n, q: n, nw });
    }
    if (Math.random() < 0.5) {
      const h = pick(HERBS.filter(x => x.g <= 2));
      addSeed(h.n, 1);
      got.push({ k: 'seed', n: h.n + '种', q: 1 });
    }
    save(); render();
    showReward('满载而归', got, '行至' + R(rid).name + '山间');
  }

  function send(rid) {
    const r = R(rid);
    state.exp = { rid, end: now() + r.hours * 3600000 / TIME_SCALE };
    save(); render();
  }

  function claim() {
    const e = state.exp;
    const r = R(e.rid);
    const got = [];
    const pool = HERBS.filter(h => h.r.includes(r.name));
    for (let i = 0; i < 3; i++) {
      const h = pick(pool);
      const n = 1 + rnd(2);
      const nw = !((state.atlas[h.n] || {}).stage >= 1);
      addInv(h.n, n);
      const a = at(h.n);
      if (!a.regions.includes(r.id)) a.regions.push(r.id);
      got.push({ k: 'herb', n: h.n, q: n, nw });
    }
    const sp = pick(r.specialty.filter(n => H(n)));
    addSeed(sp, 1);
    got.push({ k: 'seed', n: sp + '种', q: 1 });

    // 辅料：当地风物，带 1~2 份
    const m = pick(MATERIALS);
    const mq = 1 + rnd(2);
    state.mats[m.id] = (state.mats[m.id] || 0) + mq;
    got.push({ k: 'mat', n: m.name, q: mq });

    // 秘方孤本：未得者约两成机会遇到
    const unknowns = FORMULAS.filter(f => f.tier === '秘方' && !state.secrets.includes(f.id));
    if (unknowns.length && Math.random() < 0.22) {
      const f = pick(unknowns);
      state.secrets.push(f.id);
      got.push({ k: 'secret', n: '《' + f.name + '》', q: 0, nw: true });
    }

    state.exp = null;
    landSel = null;
    save(); render();
    showReward('脚夫归来', got, '自' + r.name + '挑回一担');
  }

  /* —— 开场引导 —— */
  function initIntro() {
    const box = $('#intro');
    if (!box) return;
    if (state.seen && state.seen.intro) { box.remove(); return; }
    const track = $('#introTrack');
    const dots = $('#introDots');
    const pages = $$('.intro-page', track);
    let idx = 0;
    dots.innerHTML = pages.map(() => '<i></i>').join('');
    const paint = () => {
      pages.forEach(p => { p.style.transform = `translateX(-${idx * 100}%)`; });
      $$('i', dots).forEach((d, i) => d.classList.toggle('on', i === idx));
      $('#introNext').textContent = idx === pages.length - 1 ? '开始行医' : '下一步';
    };
    const close = () => {
      state.seen.intro = true; save();
      box.classList.add('hide');
      setTimeout(() => box.remove(), 300);
    };
    $('#introNext').onclick = () => { if (idx >= pages.length - 1) close(); else { idx++; paint(); } };
    $('#introSkip').onclick = close;
    paint();
  }

  /* —— 页面内首次提示 —— */
  const FIRST_TIPS = {
    shop: '点「请下一位」起手；翻开望、问、切三张卡，再按「治法」辨证，到百子柜抓药。',
    farm: '先选空地播种。甘草最快，九十秒就能收；收下来才能开进方子。',
    land: '今日可采药三次，得的多是当地常见药；脚夫远行要几小时，别浪费名额。',
    atlas: '图鉴靠种、采、买点亮；用它治好病人才能升「通」，那才算真会。'
  };
  function firstTip(key) {
    if (!state.seen || state.seen[key]) return '';
    const tip = FIRST_TIPS[key];
    if (!tip) return '';
    return `<div class="card hintfirst"><p class="dim">${tip}</p></div>`;
  }
  function markSeen(key) {
    if (state.seen && !state.seen[key]) { state.seen[key] = true; save(); }
  }

  /* —— 提示 —— */
  let toastTimer;
  function toast(msg) {
    let el = $('#toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
  }

  /* —— 调试出口（也供自动化冒烟测试用） —— */
  window.__bencao = {
    get state() { return state; },
    get picker() { return picker; },
    availableItems, doPrep, canPrep, prepCost, judge, nextPatientObj,
    buyMat, buySeed, gather, plant, harvest, claim, render, save
  };

  /* —— 启动 —— */
  load();
  initIntro();
  const g = $('#helpBtn'), sheet = $('#guide');
  if (g && sheet) {
    g.onclick = () => { sheet.hidden = false; };
    $('#guideClose').onclick = () => { sheet.hidden = true; };
    sheet.onclick = e => { if (e.target === sheet) sheet.hidden = true; };
  }
  $$('.tabbar button').forEach(b => b.onclick = () => {
    tab = b.dataset.tab;
    if (!state.patient) picker = newPicker();
    render();
    markSeen(tab);
  });
  render();
  markSeen('shop');
  setInterval(() => { if (tab === 'farm' || tab === 'land') render(); }, 15000);
})();
