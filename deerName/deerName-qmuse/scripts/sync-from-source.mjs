#!/usr/bin/env node
/**
 * 从 ../src/body.html 提取 DOM 与脚本列表，复制 legacy JS 到 public/legacy/。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const srcRoot = path.join(projectRoot, '..', 'src');
const bodyPath = path.join(srcRoot, 'body.html');
const stylePath = path.join(srcRoot, 'style.css');
const legacyRoot = path.join(projectRoot, 'public', 'legacy');
const outDir = path.join(projectRoot, 'src');

function collectScripts(html) {
  const out = [];
  const re = /<script\s+src="([^"]+)"\s*><\/script>\s*/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function extractBodyHtml(html) {
  const open = html.match(/<body[^>]*>/i);
  if (!open) throw new Error('body.html 缺少 <body>');
  const start = open.index + open[0].length;
  const scriptIdx = html.indexOf('<script', start);
  if (scriptIdx < 0) throw new Error('body.html 缺少 <script src>');
  return html.slice(start, scriptIdx).trim();
}

function escapeForTsLiteral(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

const bodyHtml = fs.readFileSync(bodyPath, 'utf8');
const scripts = collectScripts(bodyHtml);
if (!scripts.length) throw new Error('未找到脚本列表');

fs.rmSync(legacyRoot, { recursive: true, force: true });
fs.mkdirSync(legacyRoot, { recursive: true });

for (const rel of scripts) {
  const from = path.join(srcRoot, rel);
  const to = path.join(legacyRoot, rel);
  if (!fs.existsSync(from)) throw new Error(`缺失源文件: ${rel}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

const inner = extractBodyHtml(bodyHtml);
const bodyTs = `/** 由 scripts/sync-from-source.mjs 从 ../src/body.html 生成，请勿手改 */\nexport const BODY_HTML = \`${escapeForTsLiteral(inner)}\`;\n`;
fs.writeFileSync(path.join(outDir, 'body.ts'), bodyTs);

const legacyTs = `/** 由 scripts/sync-from-source.mjs 生成 */\nexport const LEGACY_SCRIPTS = ${JSON.stringify(
  scripts.map((s) => `legacy/${s}`),
  null,
  2
)} as const;\n`;
fs.writeFileSync(path.join(outDir, 'legacy-scripts.ts'), legacyTs);

const overridesPath = path.join(outDir, 'qmuse-overrides.css');
const overrides = fs.existsSync(overridesPath)
  ? fs.readFileSync(overridesPath, 'utf8')
  : '';
const style = fs.readFileSync(stylePath, 'utf8');
const indexCss = `${style}\n\n/* ── QMuse 宿主（sync 时追加 qmuse-overrides.css）── */\n${overrides}`;
fs.writeFileSync(path.join(outDir, 'index.css'), indexCss);

console.log(`sync: ${scripts.length} 个 legacy 脚本, body ${inner.length} 字符`);
