import fs from 'fs';
import vm from 'vm';

/* 这次踩过的坑：data 文件写好了、却没挂到 body.html 上，等于白发。
   所以这里专门查「目录里有、页面没引」和「页面引了、文件不在」。 */

const body = fs.readFileSync('src/body.html', 'utf8');
const refs = [...body.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let fail = 0;

for (const s of refs) {
  if (!fs.existsSync('src/' + s)) { console.log('✗ 页面引用了不存在的文件 ' + s); fail++; }
}
const onDisk = fs.readdirSync('src/data').filter(f => f.endsWith('.js'));
for (const f of onDisk) {
  if (!refs.includes('data/' + f)) { console.log('✗ data/' + f + ' 没有被 body.html 加载'); fail++; }
}
console.log(fail ? '' : '✓ 脚本接线完整（' + refs.length + ' 个引用 / ' + onDisk.length + ' 个数据文件）');

/* 数据规模与唯一性 */
const sb = { window: {}, console }; sb.window.NM = {}; vm.createContext(sb);
for (const s of refs) {
  if (/^(app|card)\.js$/.test(s)) continue;
  vm.runInContext(fs.readFileSync('src/' + s, 'utf8'), sb, { filename: s });
}
const NM = sb.window.NM;
const uniqChars = new Set(NM.CHARS.map(c => c.c)).size;
if (uniqChars !== NM.CHARS.length) { console.log('✗ 字表去重失败'); fail++; }
const dupName = NM.NAMES_EN.length !== new Set(NM.NAMES_EN.map(x => x.n)).size;
if (dupName) { console.log('✗ 英文名有重名'); fail++; }
const missingChar = NM.GIVEN.filter(g => !g.n.split('').every(c => NM.getChar(c))).length;
if (missingChar) { console.log('✗ 有 ' + missingChar + ' 个精选名含字库外的字'); fail++; }

console.log('汉字 ' + NM.CHARS.length + ' | 姓 ' + NM.SURNAMES.length +
  ' | 精选名 ' + NM.GIVEN.length + ' | 英文名 ' + NM.NAMES_EN.length +
  ' | 音译字 ' + NM.PHON_CHARS.length);
process.exit(fail ? 1 : 0);
