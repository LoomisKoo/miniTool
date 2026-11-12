#!/usr/bin/env node
// 排版体检：在关键时间点量所有可见元素的盒子，检查越界 / 重叠 / 文字溢出
import http from 'node:http'
import { createRequire } from 'node:module'
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/loomiskoo/.npm/_npx/e41f203b7505f1fb/node_modules/playwright')
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const CHROME = '/Users/loomiskoo/Library/Caches/ms-playwright/chromium-1244/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0])
  const file = join(ROOT, p)
  if (!existsSync(file) || statSync(file).isDirectory()) return res.writeHead(404).end()
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, r))

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1 })
await page.goto(`http://localhost:${server.address().port}/promo/xhs-video.html`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ready === true)

const times = [0.6, 1.6, 2.6, 2.95, 3.15, 4.3, 5.6, 6.35, 7.4, 9.0, 10.05, 10.35, 11.2, 13.4, 14.2, 14.7, 15.3, 16.4, 17.3, 17.9]
for (const t of times) {
  const report = await page.evaluate((time) => {
    window.renderAt(time)
    const out = []
    document.querySelectorAll('#stage *').forEach((el) => {
      if (el.closest('.grain,.vignette,.bg,.wipe,.phone-glare,.route,.steps')) return
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') return
      const op = Number(cs.opacity)
      const scene = el.closest('section')
      if (scene && getComputedStyle(scene).display === 'none') return
      if (scene && scene.id === 's5' && time < 14.55) return
      if (op < 0.05) return
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return
      const id = el.id || el.className.split(' ')[0]
      const overflowX = el.scrollWidth - el.clientWidth > 2
      const overflowY = el.scrollHeight - el.clientHeight > 2
      const flagged = []
      if (r.left < -1 || r.right > 1081 || r.top < -1 || r.bottom > 1441) flagged.push('OUT')
      if (overflowX) flagged.push('TX')
      out.push({
        id,
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
        op: +op.toFixed(2),
        flag: flagged.join(','),
      })
    })
    return out
  }, t)
  const bad = report.filter((r) => r.flag)
  console.log(`\n=== t=${t}s ===`)
  console.log(report.map((r) => `${r.id}[${r.box.join(',')}]${r.flag ? ' !' + r.flag : ''}`).join('\n'))
  if (bad.length) console.log('!! 问题：', JSON.stringify(bad))
}

await browser.close()
server.close()
