#!/usr/bin/env node
// 将 promo/xhs-video.html 逐帧渲染成 1080×1440（3:4）小红书视频
//
//   node promo/build-video.mjs            渲染完整视频
//   node promo/build-video.mjs --preview  只导出几张关键帧，检查排版
//
import http from 'node:http'
import { createRequire } from 'node:module'
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/loomiskoo/.npm/_npx/e41f203b7505f1fb/node_modules/playwright')

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT = resolve(fileURLToPath(new URL('./out', import.meta.url)))
const FRAMES = '/tmp/framezang-frames'
const CHROME = '/Users/loomiskoo/Library/Caches/ms-playwright/chromium-1244/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const FFMPEG = '/Applications/Downie 4.app/Contents/Resources/ffmpeg'

const FPS = 30
const DURATION = 18
const TOTAL = FPS * DURATION
const preview = process.argv.includes('--preview')

mkdirSync(OUT, { recursive: true })
mkdirSync(FRAMES, { recursive: true })

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
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
const page = await browser.newPage({
  viewport: { width: 1080, height: 1440 },
  deviceScaleFactor: 1,
})
page.on('pageerror', (err) => console.error('pageerror:', err.message))

await page.goto(`http://localhost:${PORT}/promo/xhs-video.html`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ready === true, { timeout: 30000 })
await page.evaluate(() => Promise.all(
  Array.from(document.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r })))
))
await page.waitForTimeout(400)

const frames = preview ? [0.6, 1.5, 2.6, 2.95, 3.15, 4.3, 5.4, 6.3, 7.6, 9.0, 12.0, 13.0, 14.2, 14.7, 15.3, 16.4, 17.2, 17.9] : []

if (preview) {
  for (const t of frames) {
    await page.evaluate((time) => window.renderAt(time), t)
    await page.screenshot({ path: join(OUT, `preview-${String(t).replace('.', '_')}.jpg`), type: 'jpeg', quality: 92 })
    console.log('✓ preview', t)
  }
} else {
  rmSync(FRAMES, { recursive: true, force: true })
  mkdirSync(FRAMES, { recursive: true })

  const started = Date.now()
  for (let i = 0; i < TOTAL; i++) {
    const t = i / FPS
    await page.evaluate((time) => window.renderAt(time), t)
    await page.screenshot({ path: join(FRAMES, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 })
    if (i % 60 === 0) {
      const pct = ((i / TOTAL) * 100).toFixed(0)
      console.log(`  ${pct}%  ${i}/${TOTAL}  ${(Date.now() - started) / 1000 | 0}s`)
    }
  }

  // 封面：CTA 完全落定的那一帧
  await page.evaluate(() => window.renderAt(17.4))
  await page.screenshot({ path: join(OUT, 'cover-3x4.png') })

  const mp4 = join(OUT, 'framezang-xhs-3x4.mp4')
  execFileSync(FFMPEG, [
    '-y',
    '-framerate', String(FPS),
    '-i', join(FRAMES, 'f%04d.jpg'),
    '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p',
    '-c:v', 'h264_videotoolbox',
    '-b:v', '9M',
    '-color_range', 'tv',
    '-colorspace', 'bt709',
    '-color_primaries', 'bt709',
    '-color_trc', 'bt709',
    '-movflags', '+faststart',
    mp4,
  ], { stdio: 'inherit' })
  console.log('✓', mp4)
}

await browser.close()
server.close()
