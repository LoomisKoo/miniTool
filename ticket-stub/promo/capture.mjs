#!/usr/bin/env node
// 从本地 web 版「帧藏」抓取真实界面截图 / 票根贴图，供推广视频合成使用
import http from 'node:http'
import { createRequire } from 'node:module'
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/loomiskoo/.npm/_npx/e41f203b7505f1fb/node_modules/playwright')

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT = resolve(fileURLToPath(new URL('./assets', import.meta.url)))
mkdirSync(OUT, { recursive: true })

const CHROME = '/Users/loomiskoo/Library/Caches/ms-playwright/chromium-1244/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

const server = http.createServer((req, res) => {
  let path = decodeURIComponent(req.url.split('?')[0])
  if (path.endsWith('/')) path += 'index.html'
  const file = join(ROOT, path)
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end('not found')
    return
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(res)
})

await new Promise((r) => server.listen(0, r))
const PORT = server.address().port

const browser = await chromium.launch({ executablePath: CHROME })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
})
const page = await context.newPage()
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' })
await page.waitForSelector('.ticket-host .tk', { timeout: 15000 })
await page.waitForTimeout(2500)

const shot = async (name) => {
  await page.screenshot({ path: join(OUT, name) })
  console.log('✓', name)
}

/* ---------- 界面截图（要带 App 深色底） ---------- */
await shot('ui-home.png')

await page.click('#styleTrigger')
await page.waitForTimeout(1200)
await shot('ui-templates.png')
await page.click('#sheetClose')
await page.waitForTimeout(500)

await page.click('#fxBtn')
await page.waitForTimeout(1000)
await shot('ui-effects.png')
await page.click('#fxClose')
await page.waitForTimeout(500)

await page.click('#exportBtn')
await page.waitForTimeout(900)
await shot('ui-export.png')
await page.click('#exportClose')
await page.waitForTimeout(500)

/* ---------- 票根贴图（必须真透明） ----------
   直接截 .ticket-host 会把舞台底色一起拍进去，票根的咬口和圆角就变成深色块。
   这里先把整条祖先链的底色 / 阴影 / 3D 变换全部清掉，再 omitBackground 截取。 */
const TRANSPARENT_CSS = `
  html, body, .app, .workspace, .stage, .stage-artboard, .stage-bg,
  .tilt-scene, .tilt-card, .ticket-host, .ticket-dom {
    background: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
  }
  .stage-bg, .controls, .dock { display: none !important; }
  .tilt-card { transform: none !important; filter: none !important; }
`
await page.addStyleTag({ content: TRANSPARENT_CSS })

const styles = [
  [null, 'cinema-tear', 'ticket-cinema-tear'],
  ['travel', 'travel-board', 'ticket-travel-board'],
  ['concert', 'concert-neon', 'ticket-concert-neon'],
  ['stamp', 'stamp-classic', 'ticket-stamp-classic'],
  ['city', 'city-map', 'ticket-city-map'],
  ['cinema', 'cinema-polaroid', 'ticket-cinema-polaroid'],
  ['travel', 'travel-postcard', 'ticket-travel-postcard'],
  ['cinema', 'cinema-redclassic', 'ticket-cinema-redclassic'],
  ['cinema', 'cinema-poster', 'ticket-cinema-poster'],
]

for (const [cat, style, name] of styles) {
  if (cat) {
    // 面板和按钮在透明模式下已被隐藏，用 DOM 点击绕开可见性检查
    await page.evaluate(() => document.getElementById('styleTrigger').click())
    await page.waitForTimeout(350)
    await page.evaluate((c) => document.querySelector(`#catTabs .cat-tab[data-cat="${c}"]`).click(), cat)
    await page.waitForTimeout(250)
    await page.evaluate((s) => document.querySelector(`#styleGrid .style-item[data-style="${s}"]`).click(), style)
    await page.waitForTimeout(650)
    await page.evaluate(() => document.getElementById('sheetClose').click())
    await page.waitForTimeout(850)
  }
  await page.locator('.ticket-host').screenshot({ path: join(OUT, `${name}.png`), omitBackground: true })
  console.log('✓', `${name}.png`)
}

await browser.close()
server.close()
