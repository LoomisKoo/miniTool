#!/usr/bin/env node
/**
 * 打包仙鹿起名
 * 用法:
 *   node build.mjs              # 全部平台
 *   node build.mjs xiaohongshu  # 仅小红书
 *
 * 抖音 / 快手：单文件 index.html（内联 JS/CSS）
 * 小红书：多文件 + 外置 script（容器 CSP 禁止内联脚本，内联会黑屏）
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL = ['douyin', 'kuaishou', 'xiaohongshu'];
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ZIP_XHS = 10 * 1024 * 1024;
const VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
const SLUG = 'deerName';
const AUDIT = path.join(__dirname, '../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs');

/* 源码默认按小红书（安全区 + 容器顶栏）；快手无顶栏/安全区占位 */
const PLATFORM_CSS = {
  kuaishou: ':root{--safe-t:0px;--nav-h:0px;}',
  /* 小红书：--nav-h 保持默认 44px（容器顶栏），一级页标题用容器栏，收起页内 .hd */
  xiaohongshu: `
body.has-tabbar .hd { display: none; }
body.has-tabbar .app { padding-top: var(--safe-top); }
`
};

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const srcDir = path.join(__dirname, 'src');
const body = fs.readFileSync(path.join(srcDir, 'body.html'), 'utf8');
const style = fs.readFileSync(path.join(srcDir, 'style.css'), 'utf8');

function collectScripts(html) {
  const out = [];
  const re = /<script\s+src="([^"]+)"\s*><\/script>\s*/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function assertOffline(text, label) {
  if (/(?:src|href)=["']https?:\/\//i.test(text)) throw new Error(`${label} 含外链资源`);
  if (/<iframe/i.test(text)) throw new Error(`${label} 含 iframe`);
  if (/fetch\s*\(|XMLHttpRequest|axios|WebSocket/i.test(text)) {
    console.warn(`  ⚠ ${label} 检测到网络 API 关键字，请确认未实际发起请求`);
  }
}

function assertXhs(html) {
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) throw new Error('小红书产物含内联 script');
  if (/\son\w+\s*=/i.test(html)) throw new Error('小红书产物含 HTML 内联事件');
  if (/type=["']module["']/i.test(html)) throw new Error('小红书产物含 module 脚本');
}

function copySrcTree(outDir) {
  function walk(rel) {
    const dir = path.join(srcDir, rel);
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'body.html') continue;
      const relPath = rel ? path.join(rel, ent.name) : ent.name;
      const dest = path.join(outDir, relPath);
      if (ent.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        walk(relPath);
      } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(dir, ent.name), dest);
      }
    }
  }
  walk('');
}

function buildInlineHtml(platformId) {
  const scripts = collectScripts(body);
  if (!scripts.length) throw new Error('body.html 里没找到任何 <script src>');

  let js = '';
  const sizes = [];
  for (const rel of scripts) {
    const p = path.join(srcDir, rel);
    if (!fs.existsSync(p)) throw new Error(`缺少脚本: src/${rel}`);
    const code = fs.readFileSync(p, 'utf8');
    sizes.push([rel, Buffer.byteLength(code)]);
    js += `\n/* ===== ${rel} ===== */\n${code}\n`;
  }

  const extraCss = PLATFORM_CSS[platformId]
    ? `\n/* platform:${platformId} */\n${PLATFORM_CSS[platformId]}\n`
    : '';

  let html = body
    .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${style}${extraCss}\n</style>`)
    .replace(/<script\s+src="[^"]+"\s*><\/script>\s*/g, '')
    .replace(
      /<meta name="viewport"[^>]*>/,
      () => `<meta name="viewport" content="${VIEWPORT}">`
    )
    .replace('</body>', () => `<script>\n${js}\n</script>\n</body>`);

  if (/<script\s+src=/.test(html)) throw new Error('还有未内联的脚本');
  if (html.indexOf(js) === -1) throw new Error('内联脚本被替换改写，请检查替换串中的 $ 转义');
  return { html, sizes };
}

function relAssetPaths(html) {
  return html
    .replace(/\shref="(?!https?:|\/|\.\/)([^"]+)"/g, ' href="./$1"')
    .replace(/\ssrc="(?!https?:|\/|\.\/)([^"]+)"/g, ' src="./$1"');
}

function cleanLegacyNamingZips() {
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) return;
  for (const name of fs.readdirSync(distDir)) {
    if (name.endsWith('-naming.zip')) fs.unlinkSync(path.join(distDir, name));
  }
}

function buildXiaohongshu(cfg) {
  const platformId = 'xiaohongshu';
  const outDir = path.join(__dirname, 'dist', platformId);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  copySrcTree(outDir);

  const extraCss = PLATFORM_CSS[platformId]
    ? `\n/* platform:${platformId} */\n${PLATFORM_CSS[platformId]}\n`
    : '';
  fs.writeFileSync(path.join(outDir, 'style.css'), style + extraCss);

  let html = relAssetPaths(body)
    .replace(
      /<meta name="viewport"[^>]*>/,
      () => `<meta name="viewport" content="${VIEWPORT}">`
    )
    .replace(/<title>[^<]*<\/title>/, () => `<title>${cfg.title}</title>`);

  assertXhs(html);
  assertOffline(html + fs.readFileSync(path.join(outDir, 'style.css'), 'utf8'), cfg.name || platformId);

  const indexPath = path.join(outDir, 'index.html');
  fs.writeFileSync(indexPath, html);

  if (fs.existsSync(AUDIT)) {
    execSync(`node "${AUDIT}" "${outDir}"`, { stdio: 'inherit' });
  }

  const distDir = path.join(__dirname, 'dist');
  const zipPath = path.join(distDir, `${platformId}-${SLUG}.zip`);
  const legacyZipPath = path.join(distDir, `${platformId}-naming.zip`);
  fs.rmSync(zipPath, { force: true });
  execSync(`zip -q -r "${zipPath}" . -x '*.DS_Store'`, { cwd: outDir, stdio: 'pipe' });
  fs.copyFileSync(zipPath, legacyZipPath);

  const zipBytes = fs.statSync(zipPath).size;
  const scripts = collectScripts(html).length;
  const ok = zipBytes <= MAX_ZIP_XHS;
  console.log(
    `${ok ? '✓' : '✗'} ${cfg.name}: ${scripts} 个外置脚本, zip ${(zipBytes / 1024).toFixed(1)} KB`
  );
  console.log(`  → dist/${platformId}-${SLUG}.zip`);
  console.log(`  → dist/${platformId}-naming.zip（与上相同；解压后应有多文件，勿用 9 月旧单文件包）`);
  if (!ok) console.error('  超过 10MB 限制，请精简数据文件');
}

function buildInline(platformId, cfg) {
  const outDir = path.join(__dirname, 'dist', platformId);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const { html, sizes } = buildInlineHtml(platformId);
  const total = Buffer.byteLength(html);
  console.log(`源文件 ${sizes.length} 个，内联后 ${(total / 1024).toFixed(1)} KB`);
  for (const [name, bytes] of sizes.sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`  ${name.padEnd(24)} ${(bytes / 1024).toFixed(1)} KB`);
  }

  let out = html.replace(/<title>[^<]*<\/title>/, () => `<title>${cfg.title}</title>`);
  assertOffline(out, cfg.name || platformId);

  const indexPath = path.join(outDir, 'index.html');
  fs.writeFileSync(indexPath, out, 'utf8');

  const zipPath = path.join(__dirname, 'dist', `${platformId}-${SLUG}.zip`);
  fs.rmSync(zipPath, { force: true });
  execSync(`zip -q -j -X "${zipPath}" "${indexPath}"`, { stdio: 'pipe' });

  const bytes = fs.statSync(indexPath).size;
  const zipBytes = fs.statSync(zipPath).size;
  const ok = bytes <= MAX_BYTES && zipBytes <= MAX_BYTES;
  console.log(
    `${ok ? '✓' : '✗'} ${cfg.name}: index.html ${(bytes / 1024).toFixed(1)} KB, ` +
      `zip ${(zipBytes / 1024).toFixed(1)} KB → dist/${platformId}-${SLUG}.zip`
  );
  if (!ok) console.error('  超过 8MB 限制，请精简数据文件');
}

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
cleanLegacyNamingZips();

for (const platformId of targets) {
  const cfgPath = path.join(__dirname, 'platforms', platformId, 'config.json');
  if (!fs.existsSync(cfgPath)) {
    console.error(`跳过未知平台: ${platformId}`);
    continue;
  }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  if (platformId === 'xiaohongshu') buildXiaohongshu(cfg);
  else buildInline(platformId, cfg);
}
