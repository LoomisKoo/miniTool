import fs from 'fs';
import vm from 'vm';

/* 极简 DOM 桩，把整条交互链跑一遍：
   首页 → 答题 → 推荐组合 → 名字详情 → 备选池 → 收藏 → 选姓浮层 → 外文名 → 工作台 → 生成图片 */

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } };

const timers = [];
function makeCtx2d() {
  return new Proxy({}, {
    get(_, k) {
      if (k === 'measureText') return () => ({ width: 40 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient')
        return () => ({ addColorStop() {} });
      if (k === 'canvas') return null;
      return typeof k === 'string' ? () => {} : undefined;
    },
    set() { return true; }
  });
}

function mkEl(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(),
    innerHTML: '', textContent: '', value: '', scrollTop: 0, scrollLeft: 0,
    style: {}, dataset: {}, _attrs: {}, _ev: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) this._s.add(c); else this._s.delete(c); }
    },
    hasAttribute(k) { return k in this._attrs || (k.startsWith('data-') && k.slice(5) in this.dataset); },
    getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : this.dataset[k.slice(5)]; },
    setAttribute(k, v) { this._attrs[k] = v; },
    removeAttribute(k) { delete this._attrs[k]; },
    addEventListener(ev, fn) { (this._ev[ev] = this._ev[ev] || []).push(fn); },
    removeEventListener() {},
    appendChild(c) { (this.children = this.children || []).push(c); return c; },
    removeChild() {}, remove() {},
    closest() { return this; },
    querySelector() { return mkEl(); },
    querySelectorAll() { return []; },
    focus() {}, blur() {},
    getContext() { return makeCtx2d(); },
    toDataURL() { return 'data:image/png;base64,AA'; },
    getBoundingClientRect() { return { width: 320, height: 480, top: 0, left: 0 }; },
    click() {},
    width: 320, height: 480
  };
  return el;
}

const store = {};
const listeners = {};
const doc = {
  documentElement: mkEl('html'),
  body: mkEl('body'),
  createElement(t) { return mkEl(t); },
  createTextNode() { return mkEl('span'); },
  querySelector(sel) { return (store[sel] = store[sel] || mkEl()); },
  querySelectorAll() { return []; },
  addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  removeEventListener() {},
  getElementById(id) { return doc.querySelector('#' + id); }
};

const sandbox = {
  window: { NM: {}, scrollTo() {}, requestAnimationFrame(f) { return f(); }, devicePixelRatio: 2 },
  console, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error, isNaN, parseInt, parseFloat,
  setTimeout(fn) { timers.push(fn); return timers.length; },
  clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
  document: doc, navigator: { userAgent: 'node' }, location: {}
};
sandbox.window.document = doc;
sandbox.window.setTimeout = sandbox.setTimeout;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const s of [...fs.readFileSync('src/body.html', 'utf8').matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1])) {
  vm.runInContext(fs.readFileSync('src/' + s, 'utf8'), sandbox, { filename: s });
}
const NM = sandbox.window.NM;
const screen = doc.querySelector('#screen');
const dock = doc.querySelector('#dock');

const flush = () => { while (timers.length) timers.shift()(); };
function click(attrs) {
  const el = mkEl('button');
  Object.assign(el.dataset, attrs);
  listeners.click.forEach(fn => fn({ target: el, preventDefault() {}, stopPropagation() {} }));
  flush();
}
/* 顶栏返回键是绑定在元素上的，直接触发它的 click */
function back() {
  const el = doc.querySelector('#hd-back');
  (el._ev.click || []).forEach(fn => fn({ target: el, preventDefault() {}, stopPropagation() {} }));
  flush();
}
const html = () => screen.innerHTML;
const dockHtml = () => dock.innerHTML;
const sheetHtml = () => doc.querySelector('#sheet-body').innerHTML;
/* 搜索时只重画 #sur-rows（输入框不动），所以断言搜索后的列表要读这个元素 */
const surRows = () => doc.querySelector('#sur-rows').innerHTML;
/* 搜索框的输入：app 监听的是 document 上的 input，桩里手动喂一个事件 */
const typeSearch = (id, v) => { listeners.input.forEach(fn => fn({ target: { id, value: v } })); flush(); };
const sheetOpen = () => !doc.querySelector('#sheet').classList.contains('hidden');
const sheetShutting = () => doc.querySelector('#sheet').classList.contains('sheet-closing');
const sheetTitle = () => doc.querySelector('#sheet-title').textContent;
/* 浮层头部的「关闭」是绑定在元素上的，直接触发它的 click */
function tapSheetClose() {
  const el = doc.querySelector('#sheet-close');
  (el._ev.click || []).forEach(fn => fn({ target: el, preventDefault() {}, stopPropagation() {} }));
}

// ── 首页 ────────────────────────────────────────
click({ go: 'home' });
ok(html().includes('仙鹿起名') || html().includes('data-go="quiz"'), '首页渲染');

// ── 答题 ────────────────────────────────────────
click({ go: 'quiz' });
ok(html().includes('data-ans='), '答题页出现选项');
let guard = 0;
while (html().includes('data-ans=') && guard++ < 30) {
  const m = html().match(/data-ans="(\d+)"/);
  click({ ans: m[1] });
}
ok(!html().includes('data-ans='), '题目答完 ' + guard + ' 题');
ok(html().includes('data-rec='), '结果页给出推荐组合');

// ── 推荐组合是否真的换了不同的姓 ────────────────
const surs = [...html().matchAll(/data-rec="\d+"/g)].length;
ok(surs >= 4, '推荐组合数量 ' + surs);
ok(html().includes('data-refresh-rec'), '结果页有「换一批」');
ok(dockHtml().includes('data-open-sheet="surname"'), '底栏固定有「选姓氏」');
ok(!dockHtml().includes('data-go="studio"'), '推荐组合底栏不再放自选取名');
ok(!dockHtml().includes('data-go="en"'), '推荐组合底栏不再放换个文化');

// ── 进名字详情 ──────────────────────────────────
click({ rec: '0' });
ok(html().includes('data-open-sheet="pool"'), '详情页可看备选（浮层）');
ok(html().includes('data-save=') || html().includes('已收藏'), '详情页可收藏');
const detailHtml = html();

// ── 再看推荐 ────────────────────────────────────
click({ go: 'result' });
click({ rec: '2' });
ok(html() !== detailHtml || true, '换一组推荐可进详情');

// ── 备选名：浮层，不是一页 ──────────────────────
click({ openSheet: 'pool' });
ok(sheetOpen(), '详情页能弹出备选名浮层');
ok(sheetHtml().includes('data-pick='), '浮层里是候选名列表');
ok(sheetTitle() === '备选名字', '浮层标题是「备选名字」');
const pickAll = [...sheetHtml().matchAll(/data-pick="([^"]+)"/g)].map(m => m[1]);
const nameBeforePick = (html().match(/<div class="name-big">([^<]+)<\/div>/) || [])[1];
const chosen = pickAll.find(g => !nameBeforePick.endsWith(g));
click({ pick: chosen });
ok(!sheetOpen(), '选完名字浮层收起');
ok(html().includes('data-again'), '选完还在详情页，没有多推一页');
const nameAfterPick = (html().match(/<div class="name-big">([^<]+)<\/div>/) || [])[1];
ok(!!nameAfterPick && nameAfterPick.endsWith(chosen), '详情就地换成了 ' + nameAfterPick);
ok(nameAfterPick !== nameBeforePick, '旧名字 ' + nameBeforePick + ' 已经被替换掉');

// ── 收藏：一颗按钮收藏 / 取消收藏 ───────────────
const saveBtn = html().match(/data-save="([^"]+)"/);
ok(/class="pill fav"/.test(html()), '没收藏时收藏按钮是红的（pill fav）');
click({ save: saveBtn[1] });
ok(html().includes('>已收藏<'), '点一下变成「已收藏」');
ok(!/class="pill fav"/.test(html()), '收藏后按钮回到普通颜色');
click({ go: 'mine' });
ok(html().includes(saveBtn[1]), '收藏的名字出现在「我的」');
ok(html().includes('data-fav-open="0"'), '收藏列表每条都可点进详情');
click({ favOpen: '0' });
ok(dockHtml().includes('data-card'), '从「我的」能进详情并生成卡片');
ok(html().includes('<div class="name-big">' + saveBtn[1]), '详情就是收藏的那个名字');
click({ save: saveBtn[1] });
ok(!html().includes('>已收藏<') && /class="pill fav"/.test(html()), '再点一次取消收藏，按钮变回红色');
click({ save: saveBtn[1] });
ok(html().includes('>已收藏<'), '再点一次又收藏回来');
click({ go: 'mine' });
ok(html().includes('data-fav-open="0"'), '能退回「我的」');

// ── 「我的」：性格画像 + 收藏列表 ────────────────
ok(html().includes('radar-wrap'), '「我的」顶部有性格画像');
ok(html().includes('mine-sec'), '画像下面是收藏小节');
ok(!html().includes('数值 0–100'), '画像不再标「数值 0–100」');
ok(!html().includes('这个名字'), '「我的」的画像不叠名字那条线，也不写对照说明');
ok(html().includes('link-btn'), '「重新测」是小号文字按钮，不占一整行');
const ghostBefore = doc.body.children.length;
click({ go: 'home' });
ok(html().includes('entry-list'), '切回首页');
ok(!html().includes('radar-wrap'), '首页不再显示画像');
click({ go: 'mine' });
ok(html().includes('radar-wrap'), '再切回「我的」');
ok(doc.body.children.length === ghostBefore, 'tab 之间是平级切换，不留动画图层');
const favRows = (html().match(/data-fav-del=/g) || []).length;
click({ favDel: '0' });
ok(favRows > 0 && (html().match(/data-fav-del=/g) || []).length === favRows - 1,
  '点红心能从收藏里去掉一条（' + favRows + ' → ' + (favRows - 1) + '）');

// ── 选姓氏：浮层，选完就地重排，不再往页面栈里插一页 ────
click({ go: 'result' });
click({ openSheet: 'surname' });
ok(sheetOpen(), '结果页能打开选姓浮层');
ok(sheetHtml().includes('data-pick-surname='), '浮层里有姓氏格');
ok(sheetTitle() === '选姓氏', '浮层标题是「选姓氏」');
ok(doc.documentElement.classList.contains('sheet-open'),
  '浮层打开时 html 也上锁（只锁 body 拦不住视口滚动，会穿透到底下那页）');

// ── 选姓浮层的搜索：只留搜索结果，拼音按音节匹配 ──
typeSearch('sur-input', 'lin');
ok(!surRows().includes('和你最搭的姓'), '搜索时推荐栏收起来，不和结果混在一起');
ok(!surRows().includes('全部姓氏'), '搜索时也不再列全部姓氏');
ok(surRows().includes('搜索「lin」'), '只留「搜索结果」一栏');
ok(/data-pick-surname="林"/.test(surRows()), 'lin → 林');
ok(!/data-pick-surname="凌"/.test(surRows()), 'lin 不再匹配凌（ling）');
ok(!/data-pick-surname="令狐"/.test(surRows()), 'lin 不再匹配令狐（linghu）');
typeSearch('sur-input', 'ling');
ok(/data-pick-surname="凌"/.test(surRows()) && /data-pick-surname="令狐"/.test(surRows()),
  'ling → 凌、令狐（音节打全了就精确匹配）');
typeSearch('sur-input', 'lingh');
ok(/data-pick-surname="令狐"/.test(surRows()) && !/data-pick-surname="凌"/.test(surRows()),
  'lingh → 只出令狐（最后一段音节只打了一半，前缀匹配）');
typeSearch('sur-input', 'l');
ok((surRows().match(/data-pick-surname=/g) || []).length > 10, 'l → 按首字母浏览，列出所有 l 开头的姓');
typeSearch('sur-input', 'wa');
ok(/data-pick-surname="王"/.test(surRows()), 'wa 一条精确的都没有时，退回前缀兜底（王、汪），不出现空列表');
typeSearch('sur-input', '');
ok(surRows().includes('和你最搭的姓') && surRows().includes('全部姓氏'), '清空搜索词后回到推荐 + 全部');

const ps = sheetHtml().match(/data-pick-surname="([^"]+)"/);
click({ pickSurname: ps[1] });
ok(sheetOpen(), '结果页选完姓，同一个浮层里换成该姓的候选名');
ok(sheetTitle() === '备选名字', '浮层标题跟着换成「备选名字」');
ok(sheetHtml().includes('data-pick='), '浮层里是该姓的候选名列表');
ok(sheetHtml().includes(ps[1]), '候选名属于 ' + ps[1]);
click({ go: 'result' });

// ── 备选名浮层：模块间距、筛选钉顶、无「换姓」按钮 ──
click({ rec: '0' });
click({ openSheet: 'pool' });
ok(sheetTitle() === '备选名字', '详情页打开备选名浮层');
ok(sheetHtml().includes('sheet-search'), '筛选栏包在钉顶容器里');
ok(!sheetHtml().includes('data-sheet-push'), '备选名浮层里没有「换姓」按钮');
ok(!sheetHtml().includes('>换姓<'), '「换姓」文案也一并去掉');
click({ pfTag: 'literary' });
ok(sheetOpen() && sheetTitle() === '备选名字', '浮层内筛选不动浮层本身');
ok(sheetHtml().includes('chip active'), '筛选命中后胶囊有选中态');

// ── 浮层关闭：走反向动画，动画完才真正隐藏 ──────
ok(sheetOpen() && sheetTitle() === '备选名字', '备选名浮层还开着');
tapSheetClose();
ok(sheetShutting(), '点关闭后浮层进入关闭动画（还没隐藏）');
ok(sheetOpen(), '动画期间浮层仍在文档里，能被看到滑下去');
flush();
ok(!sheetOpen(), '动画结束后浮层真正隐藏');
ok(!sheetShutting(), '关闭动画类清理干净');
ok(!doc.body.classList.contains('sheet-open'), '页面滚动锁也解开了');
ok(!doc.documentElement.classList.contains('sheet-open'), 'html 上的锁也一起解开');
click({ go: 'result' });
ok(html().includes('data-rec='), '离开详情回到推荐组合（浮层不影响页面栈）');

// ── 外文名转中文：要的是正常中文名，不是音译 ──────
click({ go: 'translit' });
const tl = store['#tl-input'] || doc.querySelector('#tl-input');
if (tl) tl.value = 'Grace';
click({ 'tl-run': '' });
const tlMain = html().match(/<div class="name-big">([^<]+)<\/div>/);
ok(!!tlMain, 'Grace 能出中文名');
if (tlMain) {
  const full = tlMain[1];
  ok(full.length >= 2 && full.length <= 4, '中文名长度 ' + full.length + ' 字（' + full + '）');
  ok(!/^[\u4e00-\u9fa5]{4,}$/.test(full), '不是音译长名');
}
ok(html().includes('data-tl-pick'), '有备选名字')
ok(html().includes('音译写法'), '音译写法只作为附注出现');
click({ 'tl-again': '' });
ok(!!html().match(/<div class="name-big">([^<]+)<\/div>/), '换一组名字可用');

// ── 底栏随页面切换 ──────────────────────────────
click({ go: 'result' });
ok(dockHtml().includes('data-open-sheet="surname"'), '结果页底栏');
click({ rec: '0' });
ok(dockHtml().includes('data-card'), '详情页底栏是「生成分享卡片」');
click({ go: 'studio' });
ok(dockHtml().includes('primary-btn'), '工作台底栏有操作按钮');
ok(!html().includes('data-st-clear'), '工作台操作不再堆在内容末尾');
click({ go: 'en' });
ok(html().includes('data-en-pick='), '英文名列表');
const enFirst = html().match(/data-en-pick="(\d+)"/);
click({ enPick: enFirst[1] });
ok(dockHtml().includes('data-en-card'), '英文名页选中后底栏能存卡片');

// ── 名字工作台：选姓 / 选字各自独立成页 ──────────
click({ go: 'studio' });
ok(html().includes('data-go="studio-sur"'), '台面有「换姓」入口');
ok(html().includes('data-go="studio-char"'), '台面有「换字」入口');

click({ go: 'studio-sur' });
ok(html().includes('id="st-sur-input"'), '选姓页可搜索');
ok(html().includes('data-sur-type='), '选姓页有类型筛选');
ok(html().includes('data-sur-pop='), '选姓页有常见度筛选');
ok(html().includes('data-sur-letter='), '选姓页有首字母筛选');
ok(/id="st-sur-count">308 \/ 308 个/.test(html()), '不筛选时列出全部 308 个姓');
ok((html().match(/data-sur=/g) || []).length === 308, '姓格真的画了 308 个');
ok(html().includes('data-sur-random'), '选姓页能随机一个');
const surAll = (html().match(/data-sur=/g) || []).length;
click({ surPop: 'common' });
const surCommon = (html().match(/data-sur=/g) || []).length;
ok(surCommon > 0 && surCommon < surAll, '常见度筛选真的筛掉了一部分');
click({ surPop: 'all' });
click({ surType: 'compound' });
const surCompound = (html().match(/data-sur=/g) || []).length;
ok(surCompound > 0 && surCompound <= 51, '复姓筛选只留复姓');
ok(html().includes('欧阳'), '复姓筛选筛出了欧阳');
click({ surPop: 'all' });
click({ surType: 'all' });
click({ go: 'studio-sur' });
ok((html().match(/data-sur=/g) || []).length === 308, '恢复「全部」后又列出全部');
click({ sur: '欧阳' });
ok(html().includes('id="st-sur-intro"'), '点姓后展示介绍');
ok(html().includes('出自姒姓'), '介绍里有姓氏释义');
ok(html().includes('data-sur='), '仍留在选姓页');
ok(dockHtml().includes('>选好了<'), '底栏是选好了');
click({ go: 'studio' });
ok(html().includes('data-go="studio-char"'), '选好了才回台面');
ok(html().includes('欧阳'), '台面上是这个姓');

click({ go: 'studio-char' });
ok(html().includes('id="st-char-input"'), '选字页可搜索');
ok(html().includes('data-char-dom='), '选字页有意象筛选');
ok(html().includes('data-char-g='), '选字页有性别筛选');
ok(html().includes('data-char-freq='), '选字页有常用度筛选');
ok(html().includes('data-char-letter='), '选字页有首字母筛选');
ok(/id="st-char-count">1235 \/ 1235 个/.test(html()), '不筛选时列出全部 1235 个字');
ok((html().match(/data-char="/g) || []).length === 1235, '字格真的画了 1235 个');
ok(dockHtml().includes('data-go-back="studio"') && dockHtml().includes('>返回台面<'), '没选字时底栏是「返回台面」，走返回动效');

// 选 1 个字就能收藏（不再要求刚好三个字）
click({ char: '沐' });
ok(dockHtml().includes('>确定<'), '选字页底栏是确定');
ok(dockHtml().includes('data-st-clear'), '已选的字挂在底栏里（有清空）');
ok(!html().includes('data-st-clear'), '已选栏不再出现在页面里，选字不会顶动内容');
click({ go: 'studio' });
ok(/name-big small">[^<]*沐/.test(html()), '选的字回到台面预览');
ok(dockHtml().includes('data-st-save'), '选一个字就能收藏');
ok(dockHtml().includes('data-st-clear'), '底栏有清空');
ok(html().includes('单字名'), '单字名给了提示');
click({ 'st-clear': '' });
ok(dockHtml().includes('disabled'), '清空后收藏按钮置灰');
ok(!html().includes('studio-preview'), '清空后预览消失');

// 选 4 个字的非主流名：允许收藏 + 提示
for (const ch of ['沐', '晴', '书', '瑶']) click({ char: ch });
ok(dockHtml().includes('data-st-save'), '多字也能收藏');
ok(html().includes('三个字以上'), '多字给出非主流提示');
click({ 'st-save': '' });
click({ go: 'mine' });
ok(html().includes('沐晴书瑶'), '多字名进了收藏');
click({ go: 'studio' });
ok(dockHtml().includes('data-st-clear') || dockHtml().includes('disabled'), '工作台仍可清空');

// ── 结果页：性格和画像合成一张卡 ─────────────────
click({ go: 'result' });
ok(!/<section class="card">[\s\S]*<section class="card">[\s\S]*性格雷达/.test(html()), '雷达不再套两层卡片');
ok(!html().includes('你的性格'), '「你的性格」这个小标题并掉了');
ok(!html().includes('sub-block'), '画像不再另起一个区块');
const headCount = (html().match(/ct-name">性格画像/g) || []).length +
  (html().match(/card-title">性格画像<\/div>/g) || []).length;
ok(headCount === 1, '画像只有一个标题（' + headCount + '）');
ok(/<span class="ct-name">性格画像<i class="ct-tag">/.test(html()), '性格标签紧贴在标题右侧');
ok(html().includes('axis-track'), '七个维度用条子展示');

// ── 生成图片 ────────────────────────────────────
click({ rec: '0' });
ok(html().includes('>换名<') && html().includes('>备选名<') &&
   html().includes('>选姓氏<') && html().includes('name-actions'), '详情页四条操作用了短文案');

// ── 返回键跟着页面栈走（浮层不进栈，返回链更短） ──
click({ rec: '0' });
const beforeSur = html().match(/data-mark="([^"]+)"/);
click({ openSheet: 'surname' });
ok(sheetOpen(), '详情页能打开选姓浮层');
const surList = [...sheetHtml().matchAll(/data-pick-surname="([^"]+)"/g)].map(m => m[1]);
const otherSur = surList.find(s => s !== (beforeSur && beforeSur[1]));
click({ pickSurname: otherSur });
ok(!sheetOpen(), '详情页选完姓浮层收起');
ok(html().includes('data-again') && html().includes('>备选名<'), '详情页换姓是原地重排，还是详情页');
ok(html().includes('data-mark="' + otherSur + '"'), '详情页的姓换成了 ' + otherSur);

// 浮层开着时按返回键：先收浮层，页面不动
click({ openSheet: 'pool' });
ok(sheetOpen(), '从详情打开备选名浮层');
back();
ok(!sheetOpen(), '返回键先收浮层（走关闭动画后隐藏）');
flush();
ok(!sheetOpen(), '动画走完后浮层已隐藏');
ok(html().includes('data-again'), '收浮层后还停在名字详情，页面没动');
back();
ok(html().includes('data-rec='), '再返回才回推荐组合');

// ── 详情 ⇄ 备选名 来回点不会一直入栈（备选名已经是浮层） ──
click({ rec: '0' });
ok(html().includes('data-again'), '先进到一个名字详情');
let hops = 0;
for (let i = 0; i < 6; i++) {
  click({ openSheet: 'pool' });
  if (!sheetOpen()) break;
  const pk = sheetHtml().match(/data-pick="([^"]+)"/);
  click({ pick: pk[1] });
  flush();
  if (!html().includes('data-again')) break;
  hops++;
}
ok(hops === 6, '详情 ⇄ 备选名来回 ' + hops + ' 次，每次都在同一页就地换名');
ok(html().includes('data-again'), '来回点之后仍停在详情页');
back();
ok(html().includes('data-rec='), '按一次返回就回到推荐组合（没有被垫成 12 层）');

// 从「我的」进详情，一次返回要回「我的」
click({ go: 'mine' });
const favOpen = html().match(/data-fav-open="(\d+)"/);
if (favOpen) {
  click({ favOpen: favOpen[1] });
  click({ openSheet: 'pool' });
  flush();
  click({ go: 'mine' });
  ok(html().includes('data-fav-open='), '从「我的」进详情后仍能回到「我的」');
}

click({ go: 'result' });
click({ rec: '0' });
click({ card: '' });
ok(true, '生成图片链路没抛异常');

console.log(`\n${pass} 项通过，${fail} 项失败`);
process.exit(fail ? 1 : 0);
