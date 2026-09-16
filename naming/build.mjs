#!/usr/bin/env node
/**
 * 打包仙鹿起名 — 各平台单文件产物 + zip
 * 用法:
 *   node build.mjs              # 打包全部平台
 *   node build.mjs douyin       # 仅抖音
 *
 * src/body.html 里按顺序声明了所有脚本，构建时依次读取并内联成单个 index.html。
 * 数据文件用经典 script（非 ESM），所以拼接顺序 = HTML 里的声明顺序。
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL = ['douyin', 'kuaishou', 'xiaohongshu'];
const MAX_BYTES = 8 * 1024 * 1024;
const VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
const SLUG = 'naming';

/* 源码默认按小红书（安全区 + 容器顶栏）；快手无顶栏/安全区占位 */
const PLATFORM_CSS = {
  kuaishou: ':root{--safe-t:0px;--nav-h:0px;}'
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

function buildHtml(platformId) {
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

  /* 注意：替换串里用函数形式（而不是模板字符串）——
   * String.replace 会把替换串中的 $$ 还原成 $、$& 当匹配内容，
   * 直接传字符串会把源码里的 `$$` 悄悄改写成 `$`，导致产物里函数被覆盖。 */
  let html = body
    .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${style}${extraCss}\n</style>`)
    .replace(/<script\s+src="[^"]+"\s*><\/script>\s*/g, '')
    .replace(
      /<meta name="viewport"[^>]*>/,
      () => `<meta name="viewport" content="${VIEWPORT}">`
    )
    .replace('</body>', () => `<script>\n${js}\n</script>\n</body>`);

  if (/<script\s+src=/.test(html)) throw new Error('还有未内联的脚本');
  /* 内联的 JS 必须原样出现在产物里，防止上面这类替换事故 */
  if (html.indexOf(js) === -1) throw new Error('内联脚本被替换改写，请检查替换串中的 $ 转义');
  return { html, sizes };
}

function zipFiles(zipPath, files) {
  execSync(`zip -q -j -X "${zipPath}" ${files.map((f) => `"${f}"`).join(' ')}`, { stdio: 'pipe' });
}

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });

let loggedSizes = false;
for (const platformId of targets) {
  const cfgPath = path.join(__dirname, 'platforms', platformId, 'config.json');
  if (!fs.existsSync(cfgPath)) {
    console.error(`跳过未知平台: ${platformId}`);
    continue;
  }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const outDir = path.join(__dirname, 'dist', platformId);
  fs.mkdirSync(outDir, { recursive: true });

  const { html, sizes } = buildHtml(platformId);
  if (!loggedSizes) {
    const total = Buffer.byteLength(html);
    console.log(`源文件 ${sizes.length} 个，内联后 ${(total / 1024).toFixed(1)} KB`);
    for (const [name, bytes] of sizes.sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`  ${name.padEnd(24)} ${(bytes / 1024).toFixed(1)} KB`);
    }
    loggedSizes = true;
  }

  let out = html.replace(/<title>[^<]*<\/title>/, () => `<title>${cfg.title}</title>`);
  assertOffline(out, cfg.name || platformId);

  const indexPath = path.join(outDir, 'index.html');
  fs.writeFileSync(indexPath, out, 'utf8');

  const zipPath = path.join(__dirname, 'dist', `${platformId}-${SLUG}.zip`);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  zipFiles(zipPath, [indexPath]);

  const bytes = fs.statSync(indexPath).size;
  const zipBytes = fs.statSync(zipPath).size;
  const ok = bytes <= MAX_BYTES && zipBytes <= MAX_BYTES;
  console.log(
    `${ok ? '✓' : '✗'} ${cfg.name}: index.html ${(bytes / 1024).toFixed(1)} KB, ` +
      `zip ${(zipBytes / 1024).toFixed(1)} KB → dist/${platformId}-${SLUG}.zip`
  );
  if (!ok) console.error('  超过 8MB 限制，请精简数据文件');
}
