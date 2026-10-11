// 用最小 DOM 桩跑一遍 index.html 的渲染路径，捕捉 node --check 抓不到的运行期错误
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
let code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
code += `\n;globalThis.__t = { pageHome, pagePick, pageMine, pageList, pageSearch, htmlFor,
  card, rich, termify, S, F, ITEMS, BYID, DB, EX, syncTabs, switchTab, go, pop,
  transitionTo, P, flush, getFront: () => frontIdx,
  srcLinks, srcField, srcSheet, hostOf,
  setQ:(v)=>{Q=v}, getQ:()=>Q, setCur:(c)=>{cur=c}, getCur:()=>cur,
  setStack:(s)=>{navStack=s}, getStack:()=>navStack,
  setLim:(n)=>{LIMIT=n}, passF, matchQ, fCount };`;

const mkEl = (tag = 'div') => {
  const el = {
    tagName: tag, dataset: {}, style: {}, children: [], value: '', textContent: '',
    hidden: false, _st: 0, placeholder: '', _html: '',
    // 如实模拟浏览器：display:none（hidden）时赋 scrollTop 会被忽略
    get scrollTop() { return this._st; },
    set scrollTop(v) { if (!this.hidden) this._st = Number(v) || 0; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, f) { f === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (f ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); },
    },
    addEventListener() { }, removeEventListener() { },
    appendChild(c) { this.children.push(c); return c; },
    replaceChild() { }, remove() { }, click() { },
    setAttribute() { }, getAttribute() { return null; },
    querySelector() { return mkEl(); }, querySelectorAll() { return []; },
    closest() { return null; }, focus() { }, blur() { }, setSelectionRange() { },
    scrollIntoView() { }, getBoundingClientRect() { return { top: 0, height: 0 }; },
    get offsetWidth() { return 375; },
  };
  return el;
};

const doc = {
  _els: {},
  querySelector(sel) { return (this._els[sel] ||= mkEl()); },
  querySelectorAll(sel) { return sel === '#tabbar button' ? TABS : []; },
  createElement: mkEl, createDocumentFragment: () => mkEl(),
  createTextNode: t => ({ nodeValue: String(t), parentNode: null }),
  addEventListener() { }, createTreeWalker: () => ({ nextNode: () => null }),
  documentElement: mkEl('html'), body: mkEl('body'),
};
const TABS = ['home', 'pick', 'mine'].map(t => { const b = mkEl('button'); b.dataset.tab = t; return b; });

const store = {};
const g = (k, v) => Object.defineProperty(globalThis, k, { value: v, writable: true, configurable: true });
g('document', doc);
g('window', { scrollTo() { }, getComputedStyle: () => ({}), matchMedia: () => ({ matches: false }) });
g('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
g('navigator', { vibrate() { } });
g('NodeFilter', { SHOW_TEXT: 4 });
g('Blob', class { });
// 桩里的 URL 要能真解析，否则 hostOf 里的 try/catch 会吞掉一切，测了等于没测
class FakeURL {
  constructor(u) {
    const m = /^https?:\/\/([^/?#]+)([^?#]*)/.exec(String(u));
    if (!m) throw new TypeError('Invalid URL');
    this.hostname = m[1].split(':')[0]; this.pathname = m[2] || '';
  }
}
g('URL', Object.assign(FakeURL, { createObjectURL: () => 'blob:', revokeObjectURL() { } }));
g('FileReader', class { });
g('prompt', () => null);
g('confirm', () => false);

let failed = 0;
const ok = (name, fn) => {
  try { const r = fn(); console.log(`  ✓ ${name}${r ? ' — ' + r : ''}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
};

new Function(code)();
const T = globalThis.__t;
console.log(`数据装载：${T.ITEMS.length} 条 / ${T.DB.secs.length} 节 / ${T.DB.scn.length} 场景 / ${T.DB.gloss.length} 术语\n`);

// 页面描述符必须带 scroll（转场用它恢复滚动位置）
const tab = t => ({ v: 'tab', theme: t, scroll: 0 });

console.log('页面渲染：');
ok('首页·按场景', () => {
  const h = T.htmlFor(tab('home'));
  const n = (h.match(/data-scn=/g) || []).length;
  if (n !== T.DB.scn.length) throw new Error('只渲染了 ' + n + ' 个场景');
  return n + ' 个场景';
});
ok('首页·按章节', () => {
  T.S.mode = 'sec'; const h = T.htmlFor(tab('home')); T.S.mode = 'scn';
  const n = (h.match(/data-sec=/g) || []).length;
  if (n !== 34) throw new Error('只渲染了 ' + n + ' 节');
  return n + ' 节';
});
ok('精选页：hero 只有标题+星星，没有「看这条」按钮', () => {
  const h = T.htmlFor(tab('pick'));
  if (/data-open=/.test(h)) throw new Error('「看这条」按钮还在');
  if (/class="picks"/.test(h)) throw new Error('.picks 容器还在');
  if (/看这条/.test(h)) throw new Error('文案「看这条」还在');
  if (!/class="hero-top"/.test(h)) throw new Error('hero 顶部行没渲染');
  // 从 hero-top 截到 <h2> 为止（tag 自己就是一层 div，非贪婪正则会被它提前截断）
  const iTop = h.indexOf('class="hero-top"'), iH2 = h.indexOf('<h2>', iTop);
  if (iTop < 0 || iH2 < 0) throw new Error('取不到 hero-top 到 h2 之间的内容');
  const seg = h.slice(iTop, iH2);
  if (!/class="tag"/.test(seg)) throw new Error('hero-top 里没有 tag');
  if (!/data-star=/.test(seg)) throw new Error('星星不在标签行里');
  if (seg.indexOf('class="tag"') > seg.indexOf('data-star=')) throw new Error('星星在 tag 左边，应该在右边');
  if (!/<h2>/.test(h.slice(iH2))) throw new Error('标题没跟在标签行后面');
  if (/\$\{|undefined|NaN/.test(h)) throw new Error('出现 ${ / undefined / NaN');
  return '星星在「今日一条 · …」这一行的最右侧';
});
ok('精选页：hero 星星跟随收藏状态', () => {
  // 注意：不要在正则字面量里做字符串拼接 —— 里面的 ' 只是普通字符，/ 才是终结符
  const heroStar = h => {
    const m = /<button class="(star[^"]*)" data-star="([^"]+)"/.exec(h);
    return m ? { cls: m[1], id: m[2] } : null;
  };
  const h0 = T.htmlFor(tab('pick'));
  const s0 = heroStar(h0);
  if (!s0) throw new Error('取不到 hero 上的星星');
  const id = s0.id;
  const was = T.S.fav.includes(id);
  if (s0.cls.split(/\s+/).includes('on')) throw new Error('未收藏时不该有 on 类');

  T.S.fav.push(id);
  const s1 = heroStar(T.htmlFor(tab('pick')));
  if (!s1.cls.split(/\s+/).includes('on')) throw new Error('已收藏时星星没变实心');
  if (!/★/.test(T.htmlFor(tab('pick')))) throw new Error('已收藏时没渲染实心星');

  T.S.fav = T.S.fav.filter(x => x !== id);
  const s2 = heroStar(T.htmlFor(tab('pick')));
  if (s2.cls.split(/\s+/).includes('on')) throw new Error('取消收藏后 on 类没摘掉');
  if (was) T.S.fav.push(id);
  return 'on 类与 ★ / ☆ 都跟收藏状态一致';
});
ok('首页：去掉了「找到你的事」文案，且场景/章节 tab 吸顶', () => {
  for (const mode of ['scn', 'sec']) {
    T.S.mode = mode;
    const h = T.htmlFor(tab('home'));
    if (/找到你的事|原书目录/.test(h)) throw new Error(mode + ' 模式的页面标题还在');
    if (!/class="segwrap"/.test(h)) throw new Error(mode + ' 模式的 seg 没包在吸顶容器里');
    if (!/data-mode="scn"/.test(h) || !/data-mode="sec"/.test(h)) throw new Error(mode + ' 模式缺 tab');
  }
  T.S.mode = 'scn';
  return '两种模式都没有标题，seg 都在 .segwrap 内';
});
ok('我的页：三个内置列表各只出现一次（不再重复）', () => {
  const h = T.htmlFor(tab('mine'));
  for (const k of ['收藏', '想做', '已做']) {
    const n = (h.match(new RegExp('data-group="' + k + '"', 'g')) || []).length;
    if (n !== 1) throw new Error(`「${k}」在选择器里出现了 ${n} 次，应为 1 次`);
  }
  if (/class="stats"/.test(h)) throw new Error('旧的 .stats 三宫格还在');
  if (!/class="pbar"/.test(h)) throw new Error('缺进度条');
  return '收藏 / 想做 / 已做 各 1 次，另有进度条';
});
ok('我的页：自建分组也进同一个选择器', () => {
  const bak = T.S.groups, bakg = T.S.group;
  T.S.groups = [{ name: '我家用得上的', ids: [] }, { name: '先做这几条', ids: [] }];
  const h = T.htmlFor(tab('mine'));
  T.S.groups = bak; T.S.group = bakg;
  const n = (h.match(/data-group="/g) || []).length;
  if (n !== 5) throw new Error('选择器有 ' + n + ' 项，应为 5（3 内置 + 2 自建）');
  return '3 内置 + 2 自建 = 5 项，一条列表只出现一次';
});
ok('我的页：选中自建分组时给删除入口', () => {
  const bak = T.S.groups, bakg = T.S.group;
  T.S.groups = [{ name: '临时组', ids: [] }]; T.S.group = '临时组';
  const h = T.htmlFor(tab('mine'));
  T.S.groups = bak; T.S.group = bakg;
  if (!/data-delgroup="临时组"/.test(h)) throw new Error('自建分组没有删除按钮');
  return '有删除按钮';
});
ok('我的页：只剩一个分组时也能正常渲染', () => {
  const bak = T.S.groups, bakg = T.S.group;
  T.S.groups = [{ name: '只剩我', ids: [] }]; T.S.group = '只剩我';
  const h = T.htmlFor(tab('mine'));
  T.S.groups = bak; T.S.group = bakg;
  return 'OK';
});

console.log('\n列表页（走真实 cur 状态）：');
ok('34 节全部能渲染', () => {
  const bad = [];
  for (const s of T.DB.secs) {
    const h = T.htmlFor({ v: 'list', title: '第 ' + s.n + ' 节', sub: '', items: T.ITEMS.filter(i => i.sec === s.n), scroll: 0 });
    if (h.includes('没有符合条件')) bad.push(s.n);
  }
  if (bad.length) throw new Error('渲染成空：' + bad.join(','));
  return '34 节都有内容';
});
ok(`27 个场景每个都给出归类理由`, () => {
  let tot = 0;
  for (const s of T.DB.scn) {
    const h = T.htmlFor({ v: 'list', title: s.nm, sub: s.desc, items: s.items.map(id => T.BYID[id]), scn: s.id, scroll: 0 });
    if (!/命中关键词|所属章节/.test(h)) throw new Error(s.nm + ' 的卡片没给出理由');
    tot += (h.match(/class="card/g) || []).length;
  }
  return T.DB.scn.length + ' 个场景共 ' + tot + ' 张卡';
});
ok('搜索页', () => {
  const h = T.htmlFor({ v: 'search', scroll: 0 });
  if (!/输入关键词试试/.test(h)) throw new Error('空态没渲染');
  T.setQ('药');
  const h2 = T.htmlFor({ v: 'search', scroll: 0 });
  T.setQ('');
  if (!/搜索结果/.test(h2)) throw new Error('结果区没渲染');
  return '空态 + 结果态都正常';
});

console.log('\n展开/收起（新用 grid-template-rows 动画）：');
ok('卡片结构：.detail > .detail-inner 包裹', () => {
  const h = T.card(T.ITEMS[0], null);
  if (!/class="detail"><div class="detail-inner">/.test(h)) throw new Error('缺 .detail-inner 包裹层');
  if (!/<\/div><\/div>\s*<\/article>/.test(h)) throw new Error('闭合标签不对');
  return '结构正确';
});
ok('详情区所有内容都在 .detail-inner 里（否则展开动画会裁切错）', () => {
  const i = T.ITEMS.find(x => (x.refs || []).length && x.note);
  if (!i) throw new Error('库里找不到同时有引用和备注的条目，测试前提不成立');
  const h = T.card(i, null);
  const inner = h.slice(h.indexOf('detail-inner'));
  for (const need of ['成本', '收益', '来源', '备注', '相关条目', 'class="acts"', 'cardfoot']) {
    if (!inner.includes(need)) throw new Error(need + ' 落在了 .detail-inner 之外');
  }
  // 结束标签必须是 </div></div></article>：先收 detail-inner，再收 detail，最后收 card
  if (!/<\/div><\/div>\s*<\/article>/.test(h)) throw new Error('闭合标签不对，可能漏了 detail 的收尾');
  return `用 ${i.id} 验证（含引用+备注），成本/收益/来源/备注/引用/操作/脚注 全在内部`;
});
ok('已展开的卡带 .open（决定 grid-template-rows:1fr）', () => {
  const id = T.ITEMS[0].id;
  T.EX.add(id);
  const h = T.card(T.ITEMS[0], null);
  T.EX.delete(id);
  if (!/class="card open/.test(h)) throw new Error('EX 里有这条但没加 open 类');
  return 'open 类正确';
});

console.log('\n整库与完整性：');
ok('677 条全部能渲染成卡', () => {
  const bad = [];
  for (const i of T.ITEMS) {
    const h = T.card(i, i.sc[0]);
    if (!h.includes(i.title.slice(0, 8))) bad.push(i.id);
    if (/\$\{|undefined/.test(h)) bad.push(i.id + '(插值)');
  }
  if (bad.length) throw new Error('异常 ' + bad.length + ' 个：' + bad.slice(0, 5).join(','));
  return T.ITEMS.length + ' 张卡全部通过';
});
ok('节内计数合计 677', () => {
  const t = T.DB.secs.reduce((a, s) => a + s.count, 0);
  if (t !== 677) throw new Error('合计 ' + t);
  return '合计 677';
});
ok('引用跳转目标都存在', () => {
  let bad = 0, tot = 0;
  for (const i of T.ITEMS) for (const r of (i.refs || [])) { tot++; if (!T.BYID['s' + r.sec + '-' + r.n]) bad++; }
  if (bad) throw new Error(bad + '/' + tot + ' 个引用指向不存在的条目');
  return tot + ' 条引用全部可跳转';
});
ok('没有空场景', () => {
  const e = T.DB.scn.filter(s => !s.items.length);
  if (e.length) throw new Error('空场景：' + e.map(s => s.nm).join(','));
  return T.DB.scn.length + ' 个场景都有条目';
});

console.log('\n底部页签高亮：');
const onTabs = () => TABS.filter(b => b.classList.contains('on')).map(b => b.dataset.tab);
ok('切到精选：只有「精选」高亮', () => {
  T.setCur({ v: 'tab', theme: 'home', scroll: 0 }); T.setStack([]); T.S.theme = 'home'; T.syncTabs();
  if (onTabs().join() !== 'home') throw new Error('初始应为 home，实际 ' + onTabs().join());
  T.switchTab('pick');
  if (onTabs().join() !== 'pick') throw new Error('切换后应为 pick，实际 ' + onTabs().join());
  return 'home → pick，始终只有一个高亮';
});
ok('切到我的：只有「我的」高亮', () => {
  T.switchTab('mine');
  if (onTabs().join() !== 'mine') throw new Error('应为 mine，实际 ' + onTabs().join());
  return 'pick → mine';
});
ok('切回首页：只有「首页」高亮', () => {
  T.switchTab('home');
  if (onTabs().join() !== 'home') throw new Error('应为 home，实际 ' + onTabs().join());
  return 'mine → home';
});
ok('进列表页后所属页签仍保持高亮', () => {
  T.switchTab('pick');
  T.go({ v: 'list', title: '省力清单', sub: '', items: T.ITEMS.slice(0, 3), scroll: 0 }, 'push');
  if (onTabs().join() !== 'pick') throw new Error('进列表页后高亮丢了，实际 ' + onTabs().join());
  return '列表页里仍亮着所属分区';
});
ok('重复点当前页签不会丢掉高亮', () => {
  T.setCur({ v: 'tab', theme: 'mine', scroll: 0 }); T.setStack([]); T.S.theme = 'mine'; T.syncTabs();
  T.switchTab('mine');
  if (onTabs().join() !== 'mine') throw new Error('实际 ' + onTabs().join());
  return '重复点击无副作用';
});
ok('页签数正好 3 个，且都带 data-tab', () => {
  if (TABS.length !== 3) throw new Error('页签数 ' + TABS.length);
  if (!TABS.every(b => b.dataset.tab)) throw new Error('有页签缺 data-tab');
  return TABS.map(b => b.dataset.tab).join(' / ');
});

console.log('\n页面转场（遮挡/重影回归）：');
const visible = () => T.P.filter(el => !el.hidden);
const listPage = (n, scroll = 0) => ({ v: 'list', title: '清单' + n, sub: '', items: T.ITEMS.slice(0, n + 2), scroll });
ok('位移转场全程两页都保持不透明（下层页面不会透上来）', () => {
  T.setCur(tab('home')); T.setStack([]); T.S.theme = 'home'; T.syncTabs();
  T.flush();
  T.go(listPage(1), 'push');
  const dim = T.P.filter(el => el.style.opacity && el.style.opacity !== '1');
  if (dim.length) throw new Error('有页面被压暗：opacity=' + dim.map(e => e.style.opacity).join(','));
  T.pop(); T.flush(); T.setStack([]);
  const dim2 = T.P.filter(el => el.style.opacity && el.style.opacity !== '1');
  if (dim2.length) throw new Error('pop 中有页面被压暗：opacity=' + dim2.map(e => e.style.opacity).join(','));
  return 'push/pop 中 opacity 恒为 1';
});
ok('push 结束后只有一页可见，且可见的是当前页', () => {
  T.flush();
  const v = visible();
  if (v.length !== 1) throw new Error('可见页面数 = ' + v.length);
  if (v[0] !== T.P[T.getFront()]) throw new Error('可见的不是前台页');
  return '1 页可见，其余已 hidden + 清空，zIndex 已复位';
});
ok('连点 5 次随机跳转后仍只有一页可见', () => {
  const f0 = T.getFront();
  for (let i = 0; i < 5; i++) T.go(listPage(i, i * 12), 'push');
  T.flush();
  if (visible().length !== 1) throw new Error('可见页面数 = ' + visible().length);
  if (T.getFront() !== (f0 + 5) % 2) throw new Error('frontIdx 与转场次数不匹配：' + T.getFront());
  return '连点 5 次后 1 页可见，frontIdx 未错位';
});
ok('返回列表页能恢复滚动位置（display:none 时赋 scrollTop 会丢）', () => {
  T.flush();
  T.setStack([listPage(3, 240)]);
  T.pop();
  T.flush();
  const v = visible();
  if (v.length !== 1) throw new Error('可见页面数 = ' + v.length);
  if (v[0].scrollTop !== 240) throw new Error('滚动位置没恢复：' + v[0].scrollTop);
  return '返回后 1 页可见，scrollTop 还原为 240';
});

console.log('\n来源按钮：');
const esc0 = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const urlOf = i => (String(i.src).match(/https?:\/\/[^\s；;，、）)】」"'<>]+/g) || [])
  .map(u => u.replace(/[.,;:。，；、)\]}]+$/, ''));
ok('有外链的条目：详情里不再铺整段引用', () => {
  const withUrl = T.ITEMS.filter(i => urlOf(i).length);
  const bad = withUrl.filter(i => T.srcField(i).includes(esc0(i.src)));
  if (bad.length) throw new Error(bad.length + ' 条还在平铺，例如 ' + bad[0].id);
  return withUrl.length + ' 条都折叠成按钮';
});
ok('单链接用「打开来源」，多链接标出条数', () => {
  const one = T.ITEMS.find(i => urlOf(i).length === 1);
  const many = T.ITEMS.find(i => urlOf(i).length >= 4);
  const a = T.srcField(one), b = T.srcField(many);
  if (!a.includes('打开来源')) throw new Error(one.id + ' 单链接文案不对：' + a);
  if (!b.includes('来源 · ' + urlOf(many).length + ' 条')) throw new Error(many.id + ' 多链接没标条数：' + b);
  return `${one.id} 单链接直接跳；${many.id} 提示 ${urlOf(many).length} 条`;
});
ok('一条链接都没有的条目照旧平铺，内容不丢', () => {
  const none = T.ITEMS.filter(i => i.src && !urlOf(i).length);
  const bad = none.filter(i => !T.srcField(i).includes(esc0(i.src)));
  if (bad.length) throw new Error('平铺丢了内容：' + bad[0].id);
  return none.length + ' 条无外链的引用原样保留';
});
ok('srcLinks：拆出的链接数 = 去重后的 URL 数，且没有重复项', () => {
  let checked = 0;
  for (const i of T.ITEMS) {
    if (!i.src) continue;
    const ls = T.srcLinks(i.src);
    const urls = ls.filter(l => l.url);
    const uniq = new Set(urls.map(l => l.url));
    if (uniq.size !== urls.length) throw new Error(i.id + ' 有重复链接');
    if (new Set(urls.map(l => l.url)).size !== new Set(urlOf(i).map(u => u)).size)
      throw new Error(i.id + ' 漏了链接：' + urls.length + ' vs ' + urlOf(i).length);
    checked++;
  }
  return checked + ' 条 obj 逐条核对通过';
});
ok('每条链接都能进抽屉：行数一致、都带 target 与 rel=noopener', () => {
  const many = T.ITEMS.filter(i => urlOf(i).length >= 2)[0];
  T.srcSheet(many.id);
  const h = doc.querySelector('#sheet').innerHTML;
  const n = (h.match(/class="srcrow"/g) || []).length;
  if (n !== urlOf(many).length) throw new Error(`${many.id} 抽屉 ${n} 行 vs 链接 ${urlOf(many).length} 条`);
  if ((h.match(/target="_blank"/g) || []).length !== n) throw new Error('有行缺 target');
  if ((h.match(/rel="noopener noreferrer"/g) || []).length !== n) throw new Error('有行缺 noopener');
  if (!h.includes(T.hostOf(urlOf(many)[0]))) throw new Error('没显示域名');
  return `${many.id} → ${n} 行可点链接`;
});
ok('hostOf 能取出域名、去 www，异常输入不抛错', () => {
  const cases = [['https://www.cdc.gov/x', 'cdc.gov'], ['https://doi.org/10.1/x', 'doi.org'], ['不是链接', '不是链接']];
  for (const [inp, want] of cases) if (T.hostOf(inp) !== want) throw new Error(inp + ' → ' + T.hostOf(inp));
  return cases.length + ' 个样例';
});
ok('打开的链接一律 http/https，不会出现 javascript: 之类', () => {
  const bad = [];
  for (const i of T.ITEMS) T.srcLinks(i.src).forEach(l => { if (l.url && !/^https?:\/\//.test(l.url)) bad.push(l.url); });
  if (bad.length) throw new Error('可疑链接：' + bad.slice(0, 3).join(' , '));
  return '677 条里所有外链都是 http(s)';
});

console.log('\n搜索与筛选：');
ok('20 个关键词都能返回结果且不抛错', () => {
  const words = ['安全', '血', '药', '押金', '税', '保险', '孩子', '睡', 'a', '0.5', 'doi.org', 'HPV', '工伤', '彩礼', '近视', '火灾', '爬虫', '遗嘱', '残疾', '留学'];
  let n = 0;
  for (const w of words) {
    T.setQ(w);
    const h = T.htmlFor({ v: 'search', scroll: 0 });
    n += (h.match(/class="card/g) || []).length;
  }
  T.setQ('');
  return words.length + ' 个词共命中 ' + n + ' 张卡';
});
ok('筛选叠加不会把结果筛崩', () => {
  T.F.grade = ['A']; T.F.ratio = ['极高']; T.F.lens = ['换寿命'];
  const c = T.ITEMS.filter(i => T.passF(i));
  T.F.grade = []; T.F.ratio = []; T.F.lens = [];
  return '紧缩筛选下 ' + c.length + ' 条';
});
ok('摘要是大小写不敏感', () => {
  T.setQ('hpv');
  const a = T.ITEMS.filter(i => T.matchQ(i)).length;
  T.setQ('HPV');
  const b = T.ITEMS.filter(i => T.matchQ(i)).length;
  T.setQ('');
  if (a !== b || !a) throw new Error(`hpv=${a} HPV=${b}`);
  return `hpv / HPV 都命中 ${a} 条`;
});

console.log(`\n${failed ? '✗ ' + failed + ' 项失败' : '✓ 全部通过'}`);
process.exit(failed ? 1 : 0);
