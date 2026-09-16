import fs from 'fs';
import vm from 'vm';
// 严格按 body.html 的加载顺序来跑，避免再出现「文件写了但没接线」这种问题
const html = fs.readFileSync('src/body.html','utf8');
const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]).filter(s=>!/^(app|card)\.js$/.test(s));
console.log('body.html 引用脚本', srcs.length, '个');

const sb = { window:{}, console }; sb.window.NM = {}; vm.createContext(sb);
for (const s of srcs) {
  const p = 'src/' + s;
  if (!fs.existsSync(p)) { console.log('!! 缺失', p); continue; }
  vm.runInContext(fs.readFileSync(p,'utf8'), sb, {filename:s});
}
const NM = sb.window.NM;
console.log('去重汉字:', NM.CHARS.length, '| 姓:', NM.SURNAMES.length,
            '| 精选名:', NM.GIVEN.length, '| 英文名:', NM.NAMES_EN.length,
            '| 音译字:', (NM.PHON_CHARS||[]).length);

for (const k of ['recommend','rankSurnames','namesForSurname','euphony','euphonyLabel','surnameVibe','translitChars','radarSelf','sampleTop']) {
  if (typeof NM[k] !== 'function') console.log('!! 缺少 API:', k);
}

const profile = { trait:{warm:0.5,out:0.4,rat:0.5,sta:0.4}, style:{cla:0.7,sim:0.4,exp:0.2} };
const recs = NM.recommend(profile, {count:8});
console.log('\n推荐:', recs.map(r=>r.full).join('、'));
console.log('不同姓:', new Set(recs.map(r=>r.surname.c)).size, '/', recs.length);
console.log('顺口度:', recs.map(r=>r.euphony.toFixed(2)+' '+NM.euphonyLabel(r.euphony)).join(' | '));
const pool = NM.namesForSurname(profile, recs[0].surname);
console.log('\n「'+recs[0].surname.c+'」名下可用名:', pool.length, '| 前6:', pool.slice(0,6).map(x=>x.given).join('、'));
console.log('姓气质:', ['李','苏','赵','吴','萧'].map(c=>c+':'+NM.surnameVibe(NM.SURNAMES.find(s=>s.c===c))).join('  '));
console.log('\n音译写法 Grace →', NM.translitChars('Grace', profile).slice(0,3).map(x=>x.given).join('、'));
console.log('Olivia →', NM.translitChars('Olivia', profile).slice(0,3).map(x=>x.given).join('、'));

console.log('\n外文名 → 中文名（应为正常中文名，非音译）');
for (const nm of [['Grace'], ['Emma', 'Wilson'], ['Silas'], ['Olivia', 'Chen'], ['Anouk'], ['Liam'], ['Sofia', 'Rossi']]) {
  const list = NM.chineseName(nm[0], profile, { family: nm[1], count: 8 });
  console.log('  ' + nm.join(' ') + ' → ' + list.map(x => x.full + '(' + NM.euphonyLabel(x.euphony) + ')').join('、'));
  const bad = list.filter(x => x.chars.length + String(x.surname.c).length < 2 || x.chars.length + String(x.surname.c).length > 4);
  if (bad.length) console.log('    !! 长度越界:', bad.map(x => x.full).join('、'));
  const ash = list.filter(x => x.chars.some(c => !NM.getChar(c)));
  if (ash.length) console.log('    !! 含字库外字:', ash.map(x => x.full).join('、'));
}
const ou = NM.chineseName('Grace', profile, { count: 60 }).filter(x => NM.isCompound(x.surname));
console.log('  复姓出现次数(60 条里):', ou.length, ou.slice(0, 4).map(x => x.full).join('、'));

console.log('\n姓的搜索（拼音按音节匹配）');
const allSur = NM.allSurnames();
for (const kw of ['lin', 'ling', 'lingh', 'zha', 'zhao', 'l', 'ou', 'ouy', 'su', 'wa', '苏']) {
  const hit = NM.searchSurnames(allSur, kw).map(s => s.c);
  console.log('  ' + JSON.stringify(kw).padEnd(8) + String(hit.length).padStart(3) + '  ' + hit.slice(0, 10).join(' '));
}
const lin = NM.searchSurnames(allSur, 'lin').map(s => s.c);
console.log('  !! lin 匹配到不该有的姓:', lin.filter(c => c !== '林').join('、') || '无');
console.log('  !! 音节的词却搜出空列表:', ['wa', 'ouy', 'l', 'su'].filter(k => !NM.searchSurnames(allSur, k).length).join('、') || '无');

