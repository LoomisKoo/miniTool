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
    return { sid: syn.id, reward, done: false, result: null, tries: 1 };
  }

  /* 复诊优先：上次无效的病人先来，带着「未及之处」的线索 */
  function nextPatientObj() {
    if (state.pending && state.pending.length) {
      const p = state.pending.shift();
      return { sid: p.sid, reward: 15 + S(p.sid).lv * 10, done: false, result: null, tries: (p.tries || 1) + 1, miss: p.miss || [] };
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
  let picker = { picks: [], monarch: -1, filter: '', sid: null, step: 1 };

  function render() {
    $('#money').textContent = state.money + ' 文';
    $('#rep').textContent = '声望 ' + state.rep;
    $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const v = { shop: viewShop, farm: viewFarm, land: viewLand, atlas: viewAtlas }[tab];
    $('#main').innerHTML = firstTip(tab) + v();
    bind();
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

  function viewShop() {
    const left = VISITS_PER_DAY - state.day.visits;
    let body;
    if (!state.patient) {
      body = `<div class="card empty">
        <p>今日还可出诊 <b>${left}</b> 次</p>
        ${left > 0 ? '<button class="primary" data-act="next">请下一位病人入内</button>' : '<p class="dim">今日已闭门，明日再来。</p>'}
      </div>`;
      if (state.stats) {
        const s = state.stats;
        body += `<div class="card"><h3>行医札记</h3>
          <p class="dim">显效 ${s.great} · 好转 ${s.ok} · 无效 ${s.none} · 加重 ${s.worse}</p></div>`;
      }
      body += discipleCard();
    } else {
      const p = state.patient, syn = S(p.sid);
      if (p.done) {
        body = `<div class="card"><h3>${GRADE_TEXT[p.result.grade].t}</h3>
          <p>${GRADE_TEXT[p.result.grade].d}</p>
          ${p.result.formula ? `<p class="dim">套用成方「${p.result.formula}」，一方中的，事半功倍。</p>` : ''}
          ${p.result.formulaMisfit ? `<p class="dim">所开与「${p.result.formulaMisfit}」组成相同，然不对此证。</p>` : ''}
          <p class="dim">得分 ${p.result.total} / 100 ${p.result.taboo ? '· 触犯配伍禁忌「' + p.result.taboo.join('反') + '」' : ''}</p>
          <button class="primary" data-act="clear">送客</button></div>`;
      } else if (picker.step === 1) {
        const fu = p.tries > 1;
        body = `<div class="card">
          <h3>病人${fu ? '<span class="tag">复诊 · 第' + p.tries + '次</span>' : ''}</h3>
          ${fu ? '<p class="dim small">「上次服药后仍无起色，今又来诊。」</p>' : ''}
          <p class="complaint">「${syn.c}。」</p>
          <div class="sizhen">
            <div class="wang"><span>望</span><em>${syn.w}</em>${tongueSvg(syn.w)}</div>
            <div><span>问</span>${syn.q}</div>
            <div><span>切</span>${syn.pu}</div>
          </div>
          <p class="dim tip">治法方向：${syn.hint}</p>
          ${fu && p.miss && p.miss.length ? `<p class="dim small miss">上次未及：${p.miss.join('、')}——这回多顾着这一头。</p>` : ''}
          <div class="row">
            <button class="primary" data-act="topick">辨证开方</button>
            <button data-act="refuse">婉拒</button>
          </div>
        </div>`;
      } else if (picker.step === 2) {
        body = `<div class="card"><h3>辨证</h3>
          <div class="chips">${SYNDROMES.map(s => `
            <button class="chip${picker.sid === s.id ? ' on' : ''}" data-sid="${s.id}">${s.name}</button>`).join('')}</div>
          <div class="row"><button data-act="back1">返回</button>
            <button class="primary" data-act="toherbs" ${picker.sid ? '' : 'disabled'}>下一步</button></div>
        </div>`;
      } else {
        body = pickerView();
      }
    }
    return body;
  }

  function pickerView() {
    const items = availableItems();
    const allEffects = new Set();
    items.forEach(it => effectsOf(it.n, it.form).forEach(e => allEffects.add(e)));
    const effects = EFFECTS.filter(e => allEffects.has(e));
    let list = items;
    if (picker.filter) list = list.filter(it => effectsOf(it.n, it.form).includes(picker.filter));
    if (!list.length) {
      return `<div class="card"><h3>开方</h3><p class="dim">药柜里没有可用之药${picker.filter ? '（当前筛选：' + picker.filter + '）' : ''}。去药圃种、去山林采，或在药圃里炮制。</p>
        <div class="row"><button data-act="back2">返回</button><button class="primary" data-act="refuse">婉拒</button></div></div>`;
    }
    const quick = FORMULAS.filter(f => formulaUnlocked(f) && f.herbs.every(n => items.some(it => it.n === n)));
    return `<div class="card"><h3>开方 · 选药</h3>
      ${quick.length ? `<div class="quick"><span class="dim small">成方：</span>
        ${quick.map(f => `<button class="chip" data-formula="${f.id}">${f.name}</button>`).join('')}</div>` : ''}
      <div class="chips small">
        <button class="chip${!picker.filter ? ' on' : ''}" data-filter="">全部</button>
        ${effects.map(e => `<button class="chip${picker.filter === e ? ' on' : ''}" data-filter="${e}">${e}</button>`).join('')}
      </div>
      <div class="herbpick">
        ${list.map(it => {
          const key = it.n + '|' + it.form;
          const idx = picker.picks.findIndex(p => p.n === it.n && (p.form || '生') === it.form);
          const picked = idx >= 0;
          const eff = effectsOf(it.n, it.form);
          const extra = it.form !== '生' && FORM_BY_KEY[key]
            ? FORM_BY_KEY[key].add ? '　+ ' + FORM_BY_KEY[key].add : ''
            : '';
          return `<div class="hp${picked ? ' picked' : ''}">
            <button class="hp-main" data-pick="${key}">
              <b>${it.label}</b>
              ${it.form !== '生' ? `<span class="tag">${it.n}</span>` : ''}
              ${picked && picker.monarch === idx ? '<i class="monarch">君</i>' : ''}
              <span class="dim">${H(it.n).t} · ${eff.slice(0, 3).join(' ')} · 存 ${it.qty}${extra}</span>
            </button>
            ${picked ? `<button class="mini" data-monarch="${key}">君药</button>` : ''}
          </div>`;
        }).join('')}
      </div>
      <p class="dim">已选 ${picker.picks.length} 味${picker.monarch >= 0 ? ' · 君：' + (picker.picks[picker.monarch].form !== '生' ? picker.picks[picker.monarch].form : picker.picks[picker.monarch].n) : ''}</p>
      <div class="row"><button data-act="back2">返回</button>
        <button class="primary" data-act="submit" ${picker.picks.length ? '' : 'disabled'}>确认开方</button></div>
    </div>`;
  }

  /* 药圃 */
  function viewFarm() {
    const t = now();
    const slots = state.farm.map((s, i) => {
      if (!s) return `<div class="slot"><span class="dim">空地</span>
        <select data-plant="${i}"><option value="">选种播下</option>${Object.keys(state.seeds).filter(n => state.seeds[n] > 0)
          .map(n => `<option value="${n}">${n}（${state.seeds[n]}）</option>`).join('')}</select></div>`;
      const left = s.ready - t;
      return `<div class="slot grown">
        <b>${s.n}</b>
        <span class="dim">${left > 0 ? fmtLeft(left) : '可收'}</span>
        ${left > 0 ? `<span class="bar"><i style="width:${Math.min(100, ((t - s.at) / (s.ready - s.at)) * 100)}%"></i></span>`
          : `<button class="primary mini" data-harvest="${i}">收</button>`}
      </div>`;
    }).join('');

    const market = Object.keys(state.seeds);
    const catalog = ALL_HERB_NAMES.filter(n => H(n).g <= 2 + Math.min(2, Math.floor(state.rep / 5)));
    return `<div class="card"><h3>药圃 · ${SLOTS} 畦</h3><div class="farm">${slots}</div></div>
      ${viewPrep()}
      <div class="card"><h3>辅料</h3>
        <p class="dim">手头：${MATERIALS.map(m => `${m.name}×${state.mats[m.id] || 0}`).join('，')}</p>
        <div class="shoplist">
          ${MATERIALS.map(m => `<div class="shoprow"><span><b>${m.name}</b><i class="dim">${m.desc}</i></span>
            <span class="dim">存 ${state.mats[m.id] || 0}</span>
            <button data-mat="${m.id}" ${state.money < m.price ? 'disabled' : ''}>${m.price} 文</button></div>`).join('')}
        </div>
      </div>
      <div class="card"><h3>种子 · 集市</h3>
        <p class="dim">手头种子：${market.length ? market.map(n => `${n}×${state.seeds[n]}`).join('，') : '无'}</p>
        <div class="shoplist">
          ${catalog.map(n => {
            const h = H(n), price = SEED_PRICE[h.g];
            return `<div class="shoprow"><span><b>${n}</b><i class="dim">${'●'.repeat(h.g)}</i></span>
              <span class="dim">${fmtLeft(GROW_SECONDS[h.g] * 1000)}</span>
              <button data-buy="${n}" ${state.money < price ? 'disabled' : ''}>${price} 文</button></div>`;
          }).join('')}
        </div>
      </div>`;
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
      return `<div class="card"><h3>炮制</h3>
        <p class="dim">生品入柜后即可炮制。同一味药换个制法，药性便有偏重——甘草生用清热、蜜炙补中；当归生用补血、酒炒活血。</p></div>`;
    }
    return `<div class="card"><h3>炮制</h3>
      ${carried.length ? `<p class="dim">已制：${carried.map(c => `${c.form}×${c.q}`).join('，')}</p>` : ''}
      <div class="preplist">
        ${cands.map(({ n, f }) => {
          const c = prepCost(f);
          const ok = canPrep(n, f.n);
          const need = c.mat ? `${c.herb} 生品 + 1 ${MAT_BY_ID[f.mat].name}` : `${c.herb} 生品`;
          return `<div class="preprow">
            <span><b>${f.n}</b><i class="dim">${n} · ${f.pr}${f.add ? ' · +' + f.add : ''}</i></span>
            <span class="dim small">${need}</span>
            <button data-prep="${n}|${f.n}" ${ok ? '' : 'disabled'}>制</button>
          </div>`;
        }).join('')}
      </div>
      <p class="dim small">炮制过的药，开方时与生品并列可选，药性会变。</p>
    </div>`;
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
  function viewLand() {
    const left = GATHERS_PER_DAY - state.day.gathers;
    const unlocked = REGIONS.filter(r => state.rep >= r.unlockRep);
    const e = state.exp;
    return `<div class="card"><h3>近山采药</h3>
        <p class="dim">今日还可采药 ${left} 次。采得多是当地常见药，偶得种子。</p>
        <button class="primary" data-act="gather" ${left > 0 ? '' : 'disabled'}>上山采药</button>
      </div>
      <div class="card"><h3>遣脚夫远行</h3>
        ${e ? `<p>正在「${R(e.rid).name}」路上，还需 <b>${fmtLeft(e.end - now())}</b></p>
          ${now() >= e.end ? '<button class="primary" data-act="claim">收货</button>' : ''}`
        : `<div class="regions">${REGIONS.map(r => {
            const ok = state.rep >= r.unlockRep;
            return `<button class="region${ok ? '' : ' locked'}" data-send="${r.id}" ${ok ? '' : 'disabled'}>
              <b>${r.name}</b><span class="dim">${ok ? fmtLeft(r.hours * 3600000 / TIME_SCALE) : '声望 ' + r.unlockRep}</span>
              <span class="dim small">${r.specialty.join(' · ')}</span></button>`;
          }).join('')}</div>
          <p class="dim">已解锁 ${unlocked.length} 地。远行带回当地药材与种子。</p>`}
      </div>`;
  }

  /* 图鉴 */
  let atlasView = 'herb';

  const CAT_ORDER = ['解表', '清热', '燥湿', '利湿', '化湿', '化痰', '止咳', '宣肺', '补气', '补血', '补阴', '温阳',
    '行气', '活血', '止血', '安神', '消食', '涩肠', '平肝', '祛风', '温经', '软坚', '降逆', '解毒', '固表', '通络'];

  function viewAtlas() {
    const owned = Object.keys(state.atlas).filter(n => state.atlas[n].stage > 0);
    const fGot = FORMULAS.filter(formulaUnlocked).length;
    const head = `<div class="card"><h3>药材图鉴</h3>
        <p class="dim">已识 ${owned.length} / ${ALL_HERB_NAMES.length}　通 ${owned.filter(n => state.atlas[n].stage >= 2).length}　精 ${owned.filter(n => state.atlas[n].stage >= 3).length}</p>
        <div class="seg">
          <button class="${atlasView === 'herb' ? 'on' : ''}" data-aview="herb">功效</button>
          <button class="${atlasView === 'region' ? 'on' : ''}" data-aview="region">产地</button>
          <button class="${atlasView === 'formula' ? 'on' : ''}" data-aview="formula">药方 ${fGot}/${FORMULAS.length}</button>
        </div>
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
        <h3>${r.name}<span class="dim small">　${r.climate}${locked ? ' · 需声望 ' + r.unlockRep : ''}</span></h3>
        <p class="dim small">${r.desc}</p>
        <p class="meta">${known} / ${list.length} 已识　特产：${r.specialty.filter(n => H(n)).join('、')}</p>
        <div class="atlasgrid tight">
          ${list.map(h => {
            const st = (state.atlas[h.n] || {}).stage || 0;
            const dd = h.dd === r.name;
            return `<button class="hg st${st}" data-herb="${h.n}"><b>${h.n}</b><span>${dd ? '道地' : ['未识', '初识', '通', '精'][st]}</span></button>`;
          }).join('')}
        </div>
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
    return keys.map(k => `<div class="card"><h3>${k}类</h3><div class="atlasgrid">
        ${map[k].map(n => {
          const a = state.atlas[n], st = a ? a.stage : 0;
          return `<button class="hg st${st}" data-herb="${n}"><b>${n}</b><span>${['未识', '初识', '通', '精'][st]}</span></button>`;
        }).join('')}
      </div></div>`).join('');
  }

  function viewFormulas() {
    const tierBlock = (tier, intro) => {
      const list = FORMULAS.filter(f => f.tier === tier);
      const got = list.filter(formulaUnlocked).length;
      return `<div class="card"><h3>${tier} · ${got} / ${list.length}</h3>
        <p class="dim small">${intro}</p></div>` +
        list.map(f => {
          const have = formulaProgress(f);
          const ok = formulaUnlocked(f);
          const secretLocked = tier === '秘方' && !ok;
          return `<div class="card fml${ok ? ' ok' : ''}${secretLocked ? ' sealed' : ''}">
            <h3>${ok || tier === '常用' ? f.name : '未得秘方'}<span class="dim small">　${S(f.syndrome).name}</span></h3>
            ${secretLocked
              ? `<p class="dim small">方名未识。遣脚夫远行，或可于他乡得之。</p>`
              : `<p class="meta">${f.herbs.join('、')}</p>
                 <p class="dim small">${f.note}</p>
                 <p class="small ${ok ? 'good' : 'dim'}">${ok
                   ? (f.tier === '秘方' ? '✔ 孤本在握，开方时可一键套用' : '✔ 已集齐，开方时可一键套用')
                   : `还差 ${f.herbs.length - have} 味（${have} / ${f.herbs.length}）`}</p>`}
          </div>`;
        }).join('');
    };
    return tierBlock('常用', '集齐组成药材（图鉴「初识」）即自动解锁。开方时可一键套用，对症另得「成方」加成。') +
      tierBlock('秘方', '药材集齐也换不来，只能遣脚夫远行时偶遇孤本。得之则多一条捷径。');
  }

  function herbDetail(name) {
    const h = H(name), a = state.atlas[name] || { stage: 0, uses: 0, regions: [], forms: [] };
    const st = ['未识', '初识', '通', '精'][a.stage];
    const lock = a.stage < 1;
    return `<div class="card">
      <h3>${name} <span class="dim small">${st}</span></h3>
      ${lock ? '<p class="dim">尚未采得此药。种下、采到或买到即可点亮。</p>' : `
        <p class="meta">${h.s} · 性${h.t} · 味${h.f.join('')} · 归${h.m.join('、')}经</p>
        <p class="meta">功效：${h.e.join('、')}</p>
        <p class="meta">产地：${h.r.map(r => r + (r === h.dd ? '◎' : '')).join('　')}</p>
        <p>${h.x}</p>
        ${h.fo ? `<p class="meta">炮制：${h.fo.map(f => f.n + '（' + f.pr + (f.mat ? '·' + f.mat : '·无辅料') + '）' + (f.add ? ' +' + f.add : '')).join('　')}</p>` : ''}
        ${a.stage >= 2 ? `<p class="meta">已用 ${a.uses} 次${a.regions.length ? ' · 见于 ' + a.regions.join('、') : ''}</p>` : ''}
      `}
      <button data-close>返回</button></div>`;
  }

  /* —— 交互 —— */
  function bind() {
    $$('#main [data-act]').forEach(b => b.onclick = () => act(b.dataset.act));
    $$('#main [data-sid]').forEach(b => b.onclick = () => { picker.sid = b.dataset.sid; render(); });
    $$('#main [data-filter]').forEach(b => b.onclick = () => { picker.filter = b.dataset.filter; render(); });
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
    $$('#main [data-monarch]').forEach(b => b.onclick = () => {
      picker.monarch = picker.picks.findIndex(p => p.n + '|' + (p.form || '生') === b.dataset.monarch);
      render();
    });
    $$('#main [data-prep]').forEach(b => b.onclick = () => {
      const [n, form] = b.dataset.prep.split('|');
      doPrep(n, form);
    });
    $$('#main [data-mat]').forEach(b => b.onclick = () => buyMat(b.dataset.mat));
    $$('#main [data-harvest]').forEach(b => b.onclick = () => harvest(+b.dataset.harvest));
    $$('#main [data-plant]').forEach(s => s.onchange = () => { if (s.value) plant(+s.dataset.plant, s.value); });
    $$('#main [data-buy]').forEach(b => b.onclick = () => buySeed(b.dataset.buy));
    $$('#main [data-send]').forEach(b => b.onclick = () => send(b.dataset.send));
    $$('#main [data-herb]').forEach(b => b.onclick = () => { $('#main').innerHTML = herbDetail(b.dataset.herb); $$('#main [data-close]').forEach(x => x.onclick = render); });
    $$('#main [data-hire]').forEach(b => b.onclick = () => hire());
  }

  function act(a) {
    if (a === 'next') nextPatient();
    if (a === 'topick') { picker = { picks: [], monarch: -1, filter: '', sid: null, step: 2 }; render(); }
    if (a === 'back1') { picker.step = 1; render(); }
    if (a === 'toherbs') { picker.step = 3; render(); }
    if (a === 'back2') { picker.step = 2; render(); }
    if (a === 'refuse') { state.day.visits++; state.patient = null; save(); toast('婉拒送出，少赚一笔'); render(); }
    if (a === 'submit') submit();
    if (a === 'clear') { state.patient = null; picker = { picks: [], monarch: -1, filter: '', sid: null, step: 1 }; save(); render(); }
    if (a === 'gather') gather();
    if (a === 'claim') claim();
  }

  function nextPatient() {
    state.patient = nextPatientObj();
    picker = { picks: [], monarch: -1, filter: '', sid: null, step: 1 };
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
    // 无效/加重：病人留下，改日复诊，附「未及之处」
    if (r.grade === 'none' || r.grade === 'worse') {
      if (!state.pending) state.pending = [];
      state.pending.push({ sid: p.sid, tries: p.tries || 1, miss: r.missing || [] });
      if (state.pending.length > 4) state.pending.length = 4;
    }
    save(); render();
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
    addInv(s.n, n);
    state.farm[i] = null;
    save(); render();
    toast(`收获 ${s.n} ×${n}`);
  }

  function buySeed(name) {
    const price = SEED_PRICE[H(name).g];
    if (state.money < price) return;
    state.money -= price;
    addSeed(name, 1);
    save(); render();
    toast(`买下 ${name} 种子`);
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
      addInv(h.n, n);
      const a = at(h.n);
      if (!a.regions.includes(rid)) a.regions.push(rid);
      got.push(h.n + '×' + n);
    }
    if (Math.random() < 0.5) {
      const h = pick(HERBS.filter(x => x.g <= 2));
      addSeed(h.n, 1);
      got.push('种子 ' + h.n);
    }
    save(); render();
    toast('采得：' + got.join('、'));
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
      addInv(h.n, n);
      const a = at(h.n);
      if (!a.regions.includes(r.id)) a.regions.push(r.id);
      got.push(h.n + '×' + n);
    }
    const sp = pick(r.specialty.filter(n => H(n)));
    addSeed(sp, 1);
    got.push('种子 ' + sp);

    // 辅料：当地风物，带 1~2 份
    const m = pick(MATERIALS);
    const mq = 1 + rnd(2);
    state.mats[m.id] = (state.mats[m.id] || 0) + mq;
    got.push(m.name + '×' + mq);

    // 秘方孤本：未得者约两成机会遇到
    const unknowns = FORMULAS.filter(f => f.tier === '秘方' && !state.secrets.includes(f.id));
    if (unknowns.length && Math.random() < 0.22) {
      const f = pick(unknowns);
      state.secrets.push(f.id);
      got.push('秘方《' + f.name + '》');
    }

    state.exp = null;
    save(); render();
    toast('脚夫自' + r.name + '归来：' + got.join('、'));
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
      track.style.transform = `translateX(-${idx * 100}%)`;
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
    shop: '点「请下一位病人入内」起手；看完四诊再辨证，认不出就顺着「治法方向」找药。',
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
    picker = { picks: [], monarch: -1, filter: '', sid: null, step: 1 };
    render();
    markSeen(tab);
  });
  render();
  markSeen('shop');
  setInterval(() => { if (tab === 'farm' || tab === 'land') render(); }, 15000);
})();
