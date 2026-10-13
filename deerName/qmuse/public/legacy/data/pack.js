/* 数据压缩层
 *
 * 数据文件里如果每个条目都写 { c:'澈', py:'che', tone:4, dom:'water', ... }，
 * 光字段名就占掉一半体积和可读性。这里统一改写成位置数组，加载时展开成对象：
 *   姓：['李','li',3,'木名，指李树；唐代国姓','Lee',5]
 *   字：['澈','che',4,'water','水清见底，引申为通透干净',2,'u']
 *   名：['子涵','f','common','温柔大方，最有代表性的现代女名之一']
 * 引擎侧仍然拿到对象，所以不用改任何逻辑。
 */
var NM = (window.NM = window.NM || {});

NM.packChars = function (rows) {
  return rows.map(function (r) {
    return {
      c: r[0], py: r[1], tone: r[2], dom: r[3], m: r[4],
      freq: r[5], g: r[6] || 'u', adj: r[7] || null
    };
  });
};

NM.packSurnames = function (rows) {
  return rows.map(function (r) {
    return {
      c: r[0], py: r[1], tone: r[2], m: r[3],
      en: r[4] || '', pop: r[5] || 3
    };
  });
};

NM.packGiven = function (rows) {
  return rows.map(function (r) {
    return { n: r[0], g: r[1] || 'u', tag: r[2] || 'common', m: r[3] };
  });
};

/* 英文名：['Silas','赛勒斯','ˈsaɪləs','拉丁 · 森林','now','m','sai','Si/Ro',
 *          [warm,out,rat,sta],[cla,sim,exp],'一句话'] —— 向量按轴位展开。 */
NM.packEn = function (rows) {
  return rows.map(function (r) {
    var tr = {}, st = {};
    NM.TRAIT_KEYS.forEach(function (k, i) { tr[k] = r[8][i]; });
    NM.STYLE_KEYS.forEach(function (k, i) { st[k] = r[9][i]; });
    return {
      n: r[0], zh: r[1], ph: r[2], org: r[3], era: r[4] || 'mid',
      g: r[5] || 'u', snd: r[6] || '', nick: r[7] ? r[7].split('/') : [],
      tr: tr, st: st, m: r[10]
    };
  });
};

/* 英文名文件分批加载；同名时保留最先出现的完整记录。 */
NM.dedupeNamesEn = function (rows) {
  var seen = Object.create(null);
  return (rows || []).filter(function (it) {
    var key = String(it && it.n || '').toLowerCase();
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
};

/* 名人：['全名', 匹配键(字符串或数组), '时代·领域', '两三段简介'] */
NM.packCelebs = function (rows) {
  return rows.map(function (r) {
    var keys = r[1];
    if (typeof keys === 'string') keys = [keys];
    return { name: r[0], keys: keys || [], era: r[2] || '', bio: r[3] || '' };
  });
};
