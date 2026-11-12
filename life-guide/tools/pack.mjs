#!/usr/bin/env node
/**
 * 打平台 zip。
 * 用法：
 *   node tools/pack.mjs              # 默认小红书
 *   node tools/pack.mjs xiaohongshu  # 小红书：拆 app.js + env-xhs
 *   node tools/pack.mjs kuaishou     # 快手：单文件内联，无容器顶栏
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SLUG = 'life-guide';
const ALL = ['xiaohongshu', 'kuaishou'];
const MAX = { xiaohongshu: 10 * 1024 * 1024, kuaishou: 8 * 1024 * 1024 };

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['xiaohongshu'];
for (const t of targets) {
  if (!ALL.includes(t)) throw new Error(`未知平台 ${t}，可选：${ALL.join(' / ')}`);
}

execFileSync('node', [path.join(__dirname, 'build.mjs')], { stdio: 'inherit' });

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1) throw new Error(`应只有 1 段内联脚本，实际 ${scripts.length}`);
const js = scripts[0][1].trim() + '\n';

function stripFavicon(page) {
  return page.replace(/<link rel="(?:icon|apple-touch-icon)"[^>]*>\n?/g, '');
}

function assertCommon(page, label) {
  if (/(?:src|href)=["']https?:\/\//i.test(page)) throw new Error(`${label} 含外链资源`);
  if (/<iframe|<base\s/i.test(page)) throw new Error(`${label} 含 iframe / base`);
  if (/\beval\(|new Function\(/.test(js)) throw new Error(`${label} JS 含 eval / new Function`);
}

function packXiaohongshu() {
  // 小工具图标由平台后台配置；容器顶栏写死 env-xhs，不做运行时检测
  const page = stripFavicon(html)
    .replace('<html lang="zh-CN">', '<html lang="zh-CN" class="env-xhs">')
    .replace(scripts[0][0], '<script src="./app.js"></script>');

  if (!page.includes('class="env-xhs"')) throw new Error('没加上 env-xhs，顶栏不会让开');
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(page)) throw new Error('仍有内联 <script>');
  if (/\son[a-z]+=|javascript:|type="module"/i.test(page)) {
    throw new Error('含行内事件 / javascript: / module');
  }
  assertCommon(page, 'xiaohongshu');

  const outDir = path.join(ROOT, 'dist', 'xiaohongshu');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), page);
  fs.writeFileSync(path.join(outDir, 'app.js'), js);
  return { outDir, files: ['index.html', 'app.js'] };
}

function packKuaishou() {
  // 快手无小红书式容器顶栏；单文件内联即可。--safe-t/--nav-h 置 0，避免多余顶留白
  const platformCss = '\n/* platform:kuaishou */\nhtml{--safe-t:0px;--nav-h:0px}\n';
  let page = stripFavicon(html);
  if (page.includes('</style>')) {
    page = page.replace('</style>', platformCss + '</style>');
  } else {
    page = page.replace('</head>', `<style>${platformCss}</style></head>`);
  }
  assertCommon(page, 'kuaishou');
  if (/class="env-xhs"/.test(page)) throw new Error('快手包不应含 env-xhs');

  const outDir = path.join(ROOT, 'dist', 'kuaishou');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), page);
  return { outDir, files: ['index.html'] };
}

const kb = n => (n / 1024).toFixed(0) + ' KB';

for (const platform of targets) {
  const { outDir, files } = platform === 'kuaishou' ? packKuaishou() : packXiaohongshu();
  const zipPath = path.join(ROOT, 'dist', `${platform}-${SLUG}.zip`);
  fs.rmSync(zipPath, { force: true });
  execFileSync('zip', ['-q', '-r', zipPath, '.', '-x', '*.DS_Store'], { cwd: outDir });

  const sizes = files.map(f => `${f} ${kb(fs.statSync(path.join(outDir, f)).size)}`);
  const zipBytes = fs.statSync(zipPath).size;
  const max = MAX[platform];
  console.log(
    `\n${zipBytes <= max ? '✓' : '✗'} [${platform}] ${sizes.join('，')}，zip ${kb(zipBytes)} → dist/${platform}-${SLUG}.zip`
  );
  if (platform === 'xiaohongshu' && fs.statSync(path.join(outDir, 'app.js')).size > 2 * 1024 * 1024) {
    console.log('  ⚠ app.js 超过 2MiB（677 条正文内联），规范要求人工确认；zip 远低于 10MB 上限');
  }
  if (zipBytes > max) process.exitCode = 1;
}
