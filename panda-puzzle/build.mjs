#!/usr/bin/env node
/**
 * 打包熊猫拼图 — 小红书小工具（离线 zip）
 *
 * 用法: node build.mjs [xiaohongshu]
 *
 * index.html 是本地预览页（ES module 直引 src/），页面结构以它为准；
 * 打包时抽出 <body> 内容，JS 用 esbuild 合成单个经典脚本并转译到 Chrome 61。
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL = ['xiaohongshu'];
const MAX_ZIP = 10 * 1024 * 1024;
const TARGET = ['es2017', 'chrome61'];
const VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
const AUDIT = path.join(__dirname, '../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs');

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

function read(p) {
  return fs.readFileSync(path.join(__dirname, p), 'utf8');
}

/** 预览页 <body> 里除脚本外的全部结构 */
function extractBody() {
  const html = read('index.html');
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!m) throw new Error('index.html 缺少 <body>');
  return m[1].replace(/<script[\s\S]*?<\/script>\s*/gi, '').trim();
}

/** 源码里 import 带 ?v= 缓存参数，打包时去掉 */
const stripQuery = {
  name: 'strip-query',
  setup(build) {
    build.onResolve({ filter: /\?/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.replace(/\?.*$/, '')),
    }));
  },
};

async function bundleJs() {
  const out = await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/app.js')],
    bundle: true,
    format: 'iife',
    target: TARGET,
    minify: true,
    legalComments: 'none',
    write: false,
    plugins: [stripQuery],
  });
  return out.outputFiles[0].text;
}

async function buildCss() {
  const out = await esbuild.transform(read('src/style.css'), {
    loader: 'css',
    target: ['chrome61'],
    minify: true,
    legalComments: 'none',
  });
  return out.code;
}

function assertArtifact(html, css, js) {
  if (/(?:src|href)=["']https?:\/\//i.test(html)) throw new Error('HTML 含外链资源');
  if (/url\(\s*["']?https?:/i.test(css)) throw new Error('CSS 含外链资源');
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) throw new Error('含内联 script');
  if (/type=["']module["']/i.test(html)) throw new Error('含 module 脚本');
  if (/\son\w+\s*=/i.test(html)) throw new Error('含 HTML 内联事件');
  if (/<iframe|<object|<base\s/i.test(html)) throw new Error('含 iframe / object / base');
  if (/\bfetch\(|XMLHttpRequest|\.download\s*=|\beval\(|new Function\(|window\.open\(/.test(js)) {
    throw new Error('app.js 含被禁能力');
  }
  if (/\?\.(?!\d)|\?\?/.test(js)) {
    throw new Error('app.js 残留 ES2020 语法（?. / ??）');
  }
}

async function buildOne(platformId) {
  const cfgPath = path.join(__dirname, 'platforms', platformId, 'config.json');
  if (!fs.existsSync(cfgPath)) {
    console.error(`跳过未知平台: ${platformId}`);
    return;
  }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const outDir = path.join(__dirname, 'dist', platformId);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });

  const [js, css] = await Promise.all([bundleJs(), buildCss()]);
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="${VIEWPORT}">
<meta name="theme-color" content="#14172e">
<title>${cfg.titleEn ? `${cfg.title} · ${cfg.titleEn}` : cfg.title}</title>
<link rel="icon" href="./assets/icon.jpg">
<link rel="stylesheet" href="./style.css">
</head>
<body>
${extractBody()}
<script src="./three.min.js"></script>
<script src="./app.js"></script>
</body>
</html>
`;
  assertArtifact(html, css, js);

  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.writeFileSync(path.join(outDir, 'style.css'), css);
  fs.writeFileSync(path.join(outDir, 'app.js'), js);
  fs.copyFileSync(path.join(__dirname, 'vendor/three.min.js'), path.join(outDir, 'three.min.js'));
  fs.copyFileSync(path.join(__dirname, 'assets/icon.jpg'), path.join(outDir, 'assets/icon.jpg'));

  if (fs.existsSync(AUDIT)) execSync(`node "${AUDIT}" "${outDir}"`, { stdio: 'inherit' });

  const zipPath = path.join(__dirname, 'dist', `${platformId}-panda-puzzle.zip`);
  fs.rmSync(zipPath, { force: true });
  execSync(`zip -q -r "${zipPath}" . -x '*.DS_Store'`, { cwd: outDir, stdio: 'pipe' });
  const zipBytes = fs.statSync(zipPath).size;
  if (zipBytes > MAX_ZIP) throw new Error('zip 超过 10MB 上限');

  const fmt = (n) => `${(n / 1024).toFixed(1)} KB`;
  const detail = ['index.html', 'style.css', 'app.js', 'three.min.js', 'assets/icon.jpg']
    .map((f) => `${f} ${fmt(fs.statSync(path.join(outDir, f)).size)}`)
    .join(', ');
  console.log(`✓ ${cfg.title} (${platformId}): ${detail}`);
  console.log(`  zip ${fmt(zipBytes)} → ${path.relative(__dirname, zipPath)}`);
}

for (const t of targets) await buildOne(t);
console.log('完成');
