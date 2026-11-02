#!/usr/bin/env node
/**
 * 立体书画 → 小红书小工具离线包
 *
 * 产出：dist/xiaohongshu/index.html + app.js + app.css
 *      dist/xiaohongshu-liti-shuhua.zip（zip 根目录就是 index.html）
 *
 * 规范要点（xiaohongshu/minitool-zip-builder）：
 *   - 单一 index.html 入口，其余资源相对路径
 *   - 脚本外置、经典脚本（无 type="module" / import / 内联 script）
 *   - 顶部安全区 = 手机安全区 + 容器导航 44px
 *   - 包体 ≤ 10MB
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// FX=off 打无特效版，输出单独一套，别覆盖正常包
const FX_OFF = /^(off|0|false)$/i.test(process.env.FX ?? '')
const SUFFIX = FX_OFF ? '-nofx' : ''
const OUT = path.join(__dirname, 'dist', 'xiaohongshu' + SUFFIX)
const RAW = path.join(__dirname, 'dist-xhs')
const ZIP = path.join(__dirname, 'dist', 'xiaohongshu-liti-shuhua' + SUFFIX + '.zip')
const AUDIT = path.resolve(__dirname, '..', 'xiaohongshu', 'minitool-zip-builder', 'scripts', 'audit_artifact.mjs')
const MAX = 10 * 1024 * 1024

function run(cmd) {
  execSync(cmd, { cwd: __dirname, stdio: 'inherit' })
}

// 1. 构建（iife，面向 Chrome 61 / ES2017）
run('npx vite build --config vite.xhs.config.ts')

// 2. 整理产物：容器只认相对路径 + 单一入口
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(RAW)) {
  if (f.endsWith('.map')) continue
  fs.cpSync(path.join(RAW, f), path.join(OUT, f), { recursive: true })
}

if (!fs.existsSync(path.join(OUT, 'app.js'))) throw new Error('缺少 app.js，检查 vite.xhs.config.ts 的输出')
if (!fs.existsSync(path.join(OUT, 'app.css'))) console.warn('⚠ 没有 app.css，样式可能全部内联或丢失')

// 3. 入口页：只换 module script → 经典脚本，其它（含 app.css link）原样保留。
// 不要用「注释 + script」一块匹配：注释里的 --> 会让正则回溯，把中间的 head/body 一起吃掉。
const tpl = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
const entry = /<script type="module"[^>]*><\/script>/
if (!entry.test(tpl)) throw new Error('index.html 里找不到 module script，模板可能被改过')
if (!/<link[^>]+href="\.\/app\.css"/i.test(tpl)) throw new Error('index.html 缺少 ./app.css，预览会空白')
const html = tpl
  .replace(entry, '<script src="./app.js"></script>')
  // 开发注释不必进包
  .replace(/[ \t]*<!--[\s\S]*?-->\s*\n/g, '')
fs.writeFileSync(path.join(OUT, 'index.html'), html)

// 4. 官方审计（产物目录）
console.log('\n—— 审计 ——')
if (fs.existsSync(AUDIT)) run(`node "${AUDIT}" "${OUT}"`)

// 5. 打包：进入目录压缩内容，index.html 必须在 zip 根
fs.rmSync(ZIP, { force: true })
run(`cd "${OUT}" && zip -q -r "${ZIP}" . -x '*.DS_Store'`)

const zipSize = fs.statSync(ZIP).size
const detail = fs.readdirSync(OUT)
  .map((f) => `${f} ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1)}KB`)
  .join(', ')
console.log(`\n✓ 产物 ${OUT} → ${detail}`)
console.log(`${zipSize <= MAX ? '✓' : '✗'} zip ${(zipSize / 1024 / 1024).toFixed(2)}MB → ${path.basename(ZIP)}`)
if (zipSize > MAX) throw new Error('超过小红书 10MB 上限')
