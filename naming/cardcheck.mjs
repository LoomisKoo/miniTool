import fs from 'fs';
import vm from 'vm';

/* 假装是 canvas，把每次绘制记下来，检查：
   1) 有文字画到了画布外；
   2) 两行文字在竖直方向叠在一起（底部的说明 / 图例 / 页脚最容易撞）。 */
const _m = fs.readFileSync('src/card.js', 'utf8').match(/var W = (\d+), H = (\d+)/);
const W = +_m[1], H = +_m[2];

const texts = [], rects = [];

function makeCtx() {
  const ctx = {
    canvas: { width: W, height: H },
    font: '16px sans-serif', fillStyle: '#000', strokeStyle: '#000',
    lineWidth: 1, textAlign: 'left', textBaseline: 'alphabetic',
    globalAlpha: 1, lineCap: 'butt', lineJoin: 'miter', shadowBlur: 0, shadowColor: '#000',
    measureText(s) {
      const size = parseFloat((this.font.match(/(\d+(?:\.\d+)?)px/) || [0, 16])[1]);
      return { width: String(s).length * size * 0.98 };
    },
    fillText(s, x, y) { texts.push({ s: String(s), x, y, align: ctx.textAlign, baseline: ctx.textBaseline, font: ctx.font }); },
    strokeText(s, x, y) { texts.push({ s: String(s), x, y, align: ctx.textAlign, baseline: ctx.textBaseline, font: ctx.font }); },
    fillRect(x, y, w, h) { rects.push({ x, y, w, h }); },
    strokeRect(x, y, w, h) { rects.push({ x, y, w, h }); },
    clearRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, rect() {}, fill() {}, stroke() {}, clip() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, setTransform() {}, transform() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    drawImage() {}, setLineDash() {}, getLineDash() { return []; },
    globalCompositeOperation: 'source-over'
  };
  return ctx;
}

function mkEl(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(), innerHTML: '', textContent: '', value: '',
    scrollTop: 0, scrollLeft: 0, style: {}, dataset: {}, children: [], _attrs: {},
    classList: { _s: new Set(), add() {}, remove() {}, contains() { return false; }, toggle() {} },
    hasAttribute(k) { return k in this._attrs || (k.startsWith('data-') && k.slice(5) in this.dataset); },
    getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : this.dataset[k.slice(5)]; },
    setAttribute(k, v) { this._attrs[k] = v; }, removeAttribute() {},
    addEventListener() {}, appendChild(c) { this.children.push(c); return c; }, removeChild() {}, remove() {},
    closest() { return this; }, querySelector() { return mkEl(); }, querySelectorAll() { return []; },
    getContext() { return makeCtx(); }, toDataURL() { return 'data:image/png;base64,AA'; },
    getBoundingClientRect() { return { width: 320, height: 480 }; },
    width: W, height: H
  };
  return el;
}
const store = {}; const listeners = {}; const timeouts = [];
const doc = {
  documentElement: mkEl('html'), body: mkEl('body'),
  createElement(t) { return mkEl(t); }, createTextNode() { return mkEl('span'); },
  querySelector(sel) { return (store[sel] = store[sel] || mkEl()); }, querySelectorAll() { return []; },
  addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  getElementById(id) { return doc.querySelector('#' + id); }
};
const sb = {
  window: { NM: {}, scrollTo() {}, devicePixelRatio: 2 }, console, Math, Date, JSON, Object, Array,
  String, Number, Boolean, RegExp, Error, isNaN, parseInt, parseFloat,
  setTimeout(fn) { timeouts.push(fn); return 1; }, clearTimeout() {}, document: doc,
  navigator: { userAgent: 'node' }, location: {}
};
sb.window.document = doc; sb.globalThis = sb;
vm.createContext(sb);
for (const s of [...fs.readFileSync('src/body.html', 'utf8').matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]))
  vm.runInContext(fs.readFileSync('src/' + s, 'utf8'), sb, { filename: s });
const NM = sb.window.NM;
const screen = doc.querySelector('#screen');
const flush = () => { while (timeouts.length) timeouts.shift()(); };
const click = a => { const el = mkEl('button'); Object.assign(el.dataset, a); listeners.click.forEach(f => f({ target: el, preventDefault() {} })); flush(); };

const profile = { trait: { warm: 0.55, out: 0.35, rat: 0.5, sta: 0.45 }, style: { cla: 0.75, sim: 0.4, exp: 0.15 } };

let fail = 0;
function drawCard(mode, rec, label) {
  texts.length = 0; rects.length = 0;
  if (mode === 'zh' && rec) {
    NM.renderCard(mkEl('canvas'), {
      surname: rec.surname, chars: rec.chars, given: rec.given, full: rec.full,
      desc: rec.desc || NM.describe(profile),
      radar: rec.radar || NM.radar(profile, (rec.name && rec.name.vec) || rec.vec),
      note: rec.note, mode: 'zh'
    });
  } else {
    NM.renderCard(mkEl('canvas'), rec);
  }
  // 1) 越界
  const out = texts.filter(t => t.x < -2 || t.x > W + 2 || t.y < -2 || t.y > H - 2);
  // 2) 竖直重叠：同一水平带内，两行文字的 y 间距小于较小的字号 × 0.9
  let overlap = [];
  const sorted = texts.slice().sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i - 1], c = sorted[i];
    const fp = parseFloat((p.font.match(/(\d+(?:\.\d+)?)px/) || [0, 16])[1]);
    const fc = parseFloat((c.font.match(/(\d+(?:\.\d+)?)px/) || [0, 16])[1]);
    // 只有水平方向也有交集时才算真重叠
    const pw = p.s.length * fp * 0.98, cw = c.s.length * fc * 0.98;
    const px = p.align === 'center' ? p.x - pw / 2 : (p.align === 'right' ? p.x - pw : p.x);
    const cx = c.align === 'center' ? c.x - cw / 2 : (c.align === 'right' ? c.x - cw : c.x);
    const xHit = px < cx + cw - 2 && cx < px + pw - 2;
    if (xHit && (c.y - p.y) < Math.min(fp, fc) * 0.85) overlap.push([p.s, p.y, c.s, c.y]);
  }
  const tag = label || mode;
  if (out.length) { console.log('  ✗ ' + tag + ' 文字出画布:', out.map(t => t.s + '@' + t.y).join(' / ')); fail++; }
  if (overlap.length) { console.log('  ✗ ' + tag + ' 文字重合:', overlap.map(o => o[0] + '(' + o[1] + ') vs ' + o[2] + '(' + o[3] + ')').join(' | ')); fail++; }
  if (!out.length && !overlap.length) console.log('  ✓ ' + tag + ' 布局正常（' + texts.length + ' 段文字）');
}

console.log('中文名片：');
const recs = NM.recommend(profile, { count: 8 });
for (const r of recs.slice(0, 5)) drawCard('zh', r, r.full);
drawCard('zh', recs.find(r => r.full.length >= 4) || recs[0], '长名字');
/* 音译中文名是最挤的情况：4 个字加上说明 */
for (const n of ['Olivia', 'Grace', 'Nathaniel', 'Penelope']) {
  const t = NM.translitChars(n, profile)[0];
  drawCard('zh', {
    surname: { c: '陈', py: 'chen', tone: 2 }, chars: t.chars, given: t.given,
    full: '陈' + t.given, desc: t.note, radar: NM.radar(profile, t.vec), mode: 'zh'
  }, n + ' → 陈' + t.given);
}
/* 单名 */
drawCard('zh', { surname: { c: '李', py: 'li', tone: 3 }, chars: ['璨'], given: '璨',
  full: '李璨', desc: '明亮耀眼', radar: NM.radar(profile, { trait: { warm: .5, out: .5, rat: .3, sta: .2 }, style: { cla: .5, sim: .5, exp: .5 } }), mode: 'zh' }, '单名 李璨');

/* 复姓：姓名共 3 字，但姓占两个字，拼音也长一截 */
for (const c of (NM.COMPOUND_SURNAMES || []).slice(0, 6)) {
  const nm = NM.namesForSurname(profile, c, {})[0];
  if (!nm) continue;
  drawCard('zh', {
    surname: c, chars: nm.chars, given: nm.given, full: nm.full,
    desc: NM.describe(profile), radar: NM.radar(profile, nm.vec), mode: 'zh'
  }, '复姓 ' + nm.full);
}

/* 新的「外文名转中文名」：正常中文名（2~3 字），也要过一遍卡片 */
for (const nm of [['Grace'], ['Emma', 'Wilson'], ['Silas'], ['Olivia', 'Chen'], ['Sofia', 'Rossi']]) {
  const t = NM.chineseName(nm[0], profile, { family: nm[1], count: 1 })[0];
  if (!t) continue;
  drawCard('zh', {
    surname: t.surname, chars: t.chars, given: t.given, full: t.full,
    desc: NM.describe(profile), radar: NM.radar(profile, t.vec), mode: 'zh'
  }, nm.join(' ') + ' → ' + t.full);
}

console.log('\n英文名片：');
const enList = NM.NAMES_EN;
for (const e of enList) {
  drawCard('en', {
    enName: e, surname: { c: '陈', py: 'chen', tone: 2 }, chars: [], given: e.zh,
    full: '陈' + e.zh, desc: e.m, radar: NM.radar(profile, { trait: e.tr, style: e.st }), mode: 'en'
  }, e.n + ' ' + e.zh);
}
console.log('英文名片：' + enList.length + ' 条全部检查');
console.log(fail ? '\n发现 ' + fail + ' 处布局问题' : '\n布局检查全部通过');
process.exit(fail ? 1 : 0);
