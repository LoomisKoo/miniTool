#!/usr/bin/env node
/**
 * 宣传片录制（竖屏 1080×1920，无 BGM）
 *
 * 跑 dist/xiaohongshu 里那份发布会用的产物，用真实鼠标事件驱动
 * 「拖空白处转视角 / 点书页翻页 / 横屏」，照片通过 ?photos= 预先铺好，
 * 录制过程里完全不出现制作面板。
 *
 * 帧率：Playwright 的 recordVideo 固定按 25fps CFR 出片，页面跑 60fps 时
 * 有 1/3 的帧是重复的，转成 30fps 就是一眼可见的顿。这里改成 CDP
 * Page.startScreencast：浏览器每真正画一帧就给一张带时间戳的图，
 * 按真实间隔拼成视频，翻页和多图层 3D 转动才是连续的。
 *
 * 产物：dist/promo/liti-shuhua-promo-9x16.mp4
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = path.join(ROOT, 'dist', 'xiaohongshu')
const SHOTS = path.join(ROOT, 'scripts', 'photos')
const OUT = path.join(ROOT, 'dist', 'promo')
const PORT = 8791
// 视口 810×1440：按 1080 录时这台机器上 Playwright 的录像 ffmpeg 会卡住不退出，
// 810 稳定，成片再 lanczos 放大约 1.33 倍到 1080，清晰度介于 540 和原生 1080 之间。
// 下面手势坐标仍写 540×960 的逻辑值，用时乘 S。
const T0 = Date.now()
const mark = (m) => console.error('@' + ((Date.now() - T0) / 1000).toFixed(1) + ' ' + m)
const S = 1.5
const VW = 540 * S
const VH = 960 * S
const sx = (v) => Math.round(v * S)

// 每页一组「用户自己的照片」，顺序和 pages 对应。
// 落在每页的后景/前景两层（左页、右页各两张），照片和内置剪纸混在一起像真的拼贴。
const PAGES = 'moon-town,daily,blossom,sky,neon,meadow,winter'
const GROUPS = [
  'face2.jpg,laugh.jpg,coffee.jpg,cat2.jpg',   // 月夜小镇：首帧也得有照片，否则四个空相框全是白块
  'coffee.jpg,cat1.jpg,face1.jpg,face3.jpg',   // 生活照：咖啡、猫、自拍
  'face2.jpg,wedding.jpg,party1.jpg,face2.jpg', // 人像 + 婚礼 + 庆祝
  'mountain.jpg,village.jpg,face4.jpg,surfer.jpg', // 旅行
  'party1.jpg,party2.jpg,face4.jpg,face1.jpg', // 生日 / 聚会
  'dog1.jpg,dog2.jpg,park.jpg,cat2.jpg',       // 猫狗
  'mountain.jpg,face2.jpg,cat1.jpg,dog1.jpg',  // 雪夜
]
const src = (f) => (fs.existsSync(path.join(SHOTS, f)) ? 'photos/' + f : '')
const PHOTOS = GROUPS.map((g) => g.split(',').map(src).filter(Boolean).join(',')).join(';')

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' }
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0])
  const base = rel.startsWith('/photos/') ? path.join(SHOTS, rel.slice(8)) : path.join(SITE, rel === '/' ? 'index.html' : rel)
  if (!base.startsWith(rel.startsWith('/photos/') ? SHOTS : SITE) || !fs.existsSync(base) || fs.statSync(base).isDirectory()) {
    res.writeHead(404)
    return res.end('404')
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(base)] ?? 'application/octet-stream' })
  fs.createReadStream(base).pipe(res)
})
await new Promise((r) => server.listen(PORT, r))

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  // 关掉帧率上限：headless 默认跟着 60Hz 走，翻页最吃帧的那几百毫秒正好卡在
  // 掉帧的边界上；放开之后按实际渲染速度出帧，下面按时间戳拼视频又补得回来。
  args: [
    '--use-angle=metal',
    '--enable-gpu-rasterization',
    '--ignore-gpu-blocklist',
    '--enable-zero-copy',
    // 1080 的 CSS 视口下不要开「不限帧率」：页面会以最大速度出帧把 CPU 打满，
    // CDP 的输入/截图请求排队几十秒（表现就是点「横屏」卡死）。录屏本身是 25fps CFR，
    // 限帧不影响成片。
    '--hide-scrollbars',
  ],
})
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  // 注意：这里用 Playwright 自带的 recordVideo，不用 CDP screencast。
  // 这台机器的 Chrome 跑 screencast 时会漏掉 GPU 光栅化的层：书页里的剪纸、
  // 文字全变成空白/方块（截图正常，只有 screencast 出问题），没法用。
  //
  // size 必须等于 viewport：Playwright 内部是 `-vf pad=w:h:0:0:gray`，
  // 只 pad 不缩放，写成 1080×1920 时 540×960 的帧会被塞进左上角，
  // 右边和下边留一整块灰。所以这里按原始尺寸录，放大交给后面 ffmpeg 的 lanczos。
  recordVideo: { dir: path.join(OUT, 'raw'), size: { width: VW, height: VH } },
})
const page = await ctx.newPage()
// 机位直接走 URL：书默认是俯视的 rx=50，宣传片要正面平视，用 rx 覆盖掉
const RX = process.env.RX || '8'
const url = 'http://127.0.0.1:' + PORT + '/?pages=' + PAGES + '&rx=' + RX + '&fxboost=1' + (PHOTOS ? '&photos=' + encodeURIComponent(PHOTOS) : '')
await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('.pb-book')
// 等图片解码完再开录，否则片头会有一两帧白框
await page.evaluate(() => Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => 0) : 0))))
await page.waitForTimeout(600)

// ---- 字幕层：DOM 叠在书上面，pointer-events:none，不影响手势 ----
// 文案两行：粗体大字卖点 + 一行小字补充。字大、带投影，缩到手机上看也读得清。
const u = (css) => css.replace(/(\d*\.?\d+)px/g, (_, n) => +(n * S).toFixed(2) + 'px')
const CSS = u([
  // 字幕单独一层：和片头共用一层时，Chrome 会把字幕的字形拆成一列一列地画（本机 GPU 光栅的毛病）
  '#rl,#rl2{position:fixed;top:0;right:0;bottom:0;left:0;pointer-events:none;z-index:9000;',
  // 不要写 PingFang SC：这台机器上 Chrome 会把它解析成一个没有中文字形的字体，整句变方块
  'font-family:system-ui,-apple-system,"Hiragino Sans GB","Microsoft YaHei",sans-serif;color:#fff}',
  '.rl-el{position:absolute;opacity:0;transition:opacity .2s ease,transform .28s cubic-bezier(.32,.72,0,1)}',
  '.rl-on{opacity:1}',
  // 上下压暗：字幕压在书本画面上，不加一层渐变就糊在一起了
  '.rl-scrim{position:absolute;left:0;right:0;opacity:0;transition:opacity .24s ease}',
  '.rl-scrim.is-on{opacity:1}',
  '.rl-scrim-top{top:0;height:34%;background:linear-gradient(180deg,rgba(14,7,2,.82),rgba(14,7,2,0))}',
  '.rl-scrim-bot{bottom:0;height:36%;background:linear-gradient(0deg,rgba(8,4,1,.88),rgba(8,4,1,0))}',
  // 片头：品牌名 + 一句主张，压在书的上方
  '.rl-title{left:0;right:0;top:6.5%;text-align:center;transform:translateY(16px)}',
  '.rl-title.rl-on{transform:none}',
  '.rl-title u{display:inline-block;text-decoration:none;padding:5px 14px;border-radius:999px;font-size:15px;',
  'letter-spacing:.34em;color:#ffe6b8;background:rgba(30,16,8,.5);box-shadow:inset 0 0 0 .5px rgba(255,214,150,.45)}',
  '.rl-title b{display:block;margin-top:14px;font-size:60px;line-height:1.08;letter-spacing:.06em;font-weight:900;color:#fffaf0;',
  'text-shadow:0 5px 0 rgba(58,26,6,.42),0 16px 40px rgba(0,0,0,.55)}',
  '.rl-title b em{font-style:normal;color:#ffd77a}',
  '.rl-title i{display:block;margin-top:16px;font-size:21px;font-style:normal;letter-spacing:.1em;',
  'color:rgba(255,246,226,.92);text-shadow:0 2px 10px rgba(0,0,0,.7)}',
  // 场景字幕：大字卖点 + 小字说明，整体放在底部控制条上方
  '.rl-cap{left:0;right:0;bottom:126px;text-align:center;transform:translateY(12px)}',
  '.rl-cap.rl-on{transform:none}',
  '.rl-cap b{display:block;font-size:38px;line-height:1.2;font-weight:900;letter-spacing:.02em;color:#fffaf0;',
  'text-shadow:0 3px 0 rgba(48,22,6,.4),0 10px 28px rgba(0,0,0,.62)}',
  '.rl-cap b em{font-style:normal;color:#ffd77a}',
  '.rl-cap i{display:inline-block;margin-top:12px;padding:6px 15px;border-radius:999px;font-style:normal;',
  'font-size:16px;letter-spacing:.06em;color:#fbecc8;background:rgba(28,16,10,.66);',
  'box-shadow:inset 0 0 0 .5px rgba(255,226,180,.28)}',
  // 结尾：一句行动号召
  '.rl-end{left:0;right:0;top:0;bottom:0;display:grid;place-content:center;text-align:center;transform:translateY(12px)}',
  '.rl-end::before{content:"";position:absolute;top:0;right:0;bottom:0;left:0;',
  'background:radial-gradient(60% 26% at 50% 50%, rgba(10,6,3,.7), rgba(10,6,3,0) 76%)}',
  '.rl-end.rl-on{transform:none}',
  '.rl-end b,.rl-end i,.rl-end u{position:relative}',
  '.rl-end b{display:block;font-size:54px;line-height:1.16;font-weight:900;letter-spacing:.04em;color:#fffaf0;',
  'text-shadow:0 4px 0 rgba(48,22,6,.36),0 14px 34px rgba(0,0,0,.55)}',
  '.rl-end b em{font-style:normal;color:#ffd77a}',
  '.rl-end i{display:block;margin-top:18px;font-size:19px;font-style:normal;letter-spacing:.14em;color:rgba(255,246,226,.9)}',
  '.rl-end u{display:inline-block;margin-top:22px;text-decoration:none;padding:9px 20px;border-radius:999px;',
  'font-size:17px;letter-spacing:.16em;color:#3a1c06;background:linear-gradient(180deg,#ffe0a0,#f6c463);',
  'box-shadow:0 8px 22px rgba(0,0,0,.4)}',
].join(''))

const HTML = [
  '<div class="rl-scrim rl-scrim-top" id="rl-scrim-top"></div>',
  '<div class="rl-el rl-title" id="rl-title"><u>立体书画</u>',
  '<b>把你的照片<br>收进<em>立体书</em></b><i>会立起来的那种</i></div>',
  '<div class="rl-el rl-end" id="rl-end"><b>翻一页<br><em>就是一段回忆</em></b>',
  '<i>生日 · 旅行 · 猫猫狗狗</i><u>现在去做一本</u></div>',
].join('')
/** 字幕层：独立挂一个容器，见上面 CSS 里的注释 */
const HTML2 = [
  '<div class="rl-scrim rl-scrim-bot" id="rl-scrim-bot"></div>',
  '<div class="rl-el rl-cap" id="rl-cap"><b></b><i></i></div>',
].join('')

await page.addStyleTag({ content: CSS })
await page.evaluate(([html, html2]) => {
  const root = document.createElement('div')
  root.id = 'rl'
  root.innerHTML = html
  document.body.appendChild(root)
  const root2 = document.createElement('div')
  root2.id = 'rl2'
  root2.innerHTML = html2
  document.body.appendChild(root2)
  const scrim = (id, on) => document.getElementById(id).classList.toggle('is-on', on)
  window.__rl = {
    show(id, on) {
      document.getElementById(id).classList.toggle('rl-on', on)
      if (id === 'rl-title') scrim('rl-scrim-top', on)
      if (id === 'rl-end') { scrim('rl-scrim-top', on); scrim('rl-scrim-bot', on) }
    },
    /** 传空字符串就整体淡出；主语和副标可以只给一个 */
    cap(big, small) {
      const el = document.getElementById('rl-cap')
      el.querySelector('b').innerHTML = big ?? ''
      el.querySelector('i').textContent = small ?? ''
      el.querySelector('i').style.display = small ? '' : 'none'
      el.classList.toggle('rl-on', !!big)
      scrim('rl-scrim-bot', !!big)
    },
  }
}, [HTML, HTML2])

const sleep = (ms) => page.waitForTimeout(ms)
const show = (id, on) => page.evaluate(([i, o]) => window.__rl.show(i, o), [id, on !== false])
const cap = (big, small) => page.evaluate(([b, s]) => window.__rl.cap(b, s), [big ?? '', small ?? ''])
const shot = async (n) => { if (process.env.DBG === '1') await page.screenshot({ path: path.join(OUT, 'dbg-' + n + '.png') }) }

/** 点书页翻一页；没翻过去就用底部按键兜底 */
async function next() {
  const before = await page.evaluate(() => Number(document.querySelector('.pb-pager span b').textContent))
  await page.mouse.move(Math.round(VW * 0.74), Math.round(VH * 0.56))
  await page.mouse.down()
  await sleep(50)
  await page.mouse.up()
  await sleep(840)
  const after = await page.evaluate(() => Number(document.querySelector('.pb-pager span b').textContent))
  if (after === before) {
    await page.click('[aria-label="下一页"]')
    await sleep(840)
  }
}

// ===== 先把视角摆到位，再开始正片 =====
// 视角已经由 URL 的 &rx 定死（正面平视），这里不再靠拖拽：拖拽在录制状态下每次
// pointermove 都要等编码器回帧，慢且成片里一跳一跳。
// 也不推滚轮：正面机位下书已经铺到画面两侧，再放大会把书边裁出画外。
await sleep(200)

// 品红闪一帧：编码时按这一帧定位切点
await page.evaluate(() => {
  const d = document.createElement('div')
  d.id = 'rl-cut'
  d.style.cssText = 'position:fixed;inset:0;background:#ff00ff;z-index:99999;pointer-events:none'
  document.body.appendChild(d)
  setTimeout(() => d.remove(), 220)
})
await sleep(500)

// ===== 正片 =====
mark('START')
const recStart = Date.now()

await show('rl-title')
await sleep(1900)
await show('rl-title', false)
await sleep(220)

// 1) 转个角度再转回来：在空白处按住拖动，横向是绕屏幕中心转（rz）、纵向是抬俯角（rx）。
//    注意拖拽的「距离」就是 CSS 像素，度数是 dx*0.22 / dy*0.18，这里故意写 sx() 把
//    540 基准的设计值换算成当前 810 视口下的像素，别再用固定的 CSS 数字。
const drag = async (x0, y0, dx, dy, steps = 18) => {
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + (dx * i) / steps, y0 + (dy * i) / steps)
    await sleep(26)
  }
  await page.mouse.up()
  await sleep(320)
}
await cap('换个角度<br>每一层都<em>立着</em>', '空白处拖一拖')

await sleep(500)
await drag(sx(20), sx(480), sx(-60), 0)     // rz ≈ +20°
await sleep(420)
await drag(sx(20), sx(480), 0, sx(40))      // rx 82 → 71°
await sleep(900)
await drag(sx(20), sx(480), sx(60), 0)      // 转回正面
await sleep(300)
await drag(sx(20), sx(480), 0, sx(-40))     // 抬回正面平视（clamp 上限 82）
await sleep(500)
await cap('')
await sleep(200)

// 2) 一路翻过去：每页都是用户放进来的照片。翻页之间留够停住的时间，不然像在赶场
mark('NEXT2')
await next()                          // 午后生活：咖啡 + 猫 + 自拍
await cap('生活照<em>随手拍</em>', '放进书里就是主角')
await sleep(1200)
await cap('')
await sleep(380)
mark('NEXT3')
await next()                          // 春日花见：人像 + 婚礼
await sleep(900)
mark('NEXT4')
await next()                          // 云上飞行：旅行
await sleep(900)
mark('NEXT5')
await next()                          // 霓虹夜市：生日 / 聚会
await cap('生日聚会<em>都能装</em>', '庆祝照一翻就是现场')
await sleep(1200)
await cap('')
await sleep(380)
mark('NEXT6')
await next()                          // 田原午后：猫狗
await cap('猫猫狗狗<em>也有位置</em>', '毛孩子也进立体书')
await sleep(1200)
await cap('')
await sleep(380)

mark('ZOOM')
// 3) 放大看细节：滚轮分几次推，像真的在捏合（挑一页亮的，别在夜景上放大）
// 前面已经推过一格，这里三步就够，再多会把书边顶出画外
await page.mouse.move(sx(300), sx(500))
for (let i = 0; i < 3; i++) {
  await page.mouse.wheel(0, -84)
  await sleep(36)
}
await cap('照片<em>自己会裁</em>', '不用学设计，拖一下就好')
await sleep(1400)
await cap('')
for (let i = 0; i < 3; i++) {
  await page.mouse.wheel(0, 84)
  await sleep(32)
}
await sleep(260)

mark('NEXT7')
await next()                          // 冬日雪夜
await sleep(420)
await shot('winter')

mark('LANDSCAPE')
// 4) 横屏。切横屏会复位视角，但 DEFAULT_VIEW 已经从 URL 拿到 rx，复位也是正面平视。
//    横屏下书只占中间一条，推两格滚轮把桌面收掉。
await page.click('[aria-label="横屏显示"]')
await sleep(1000)
await page.mouse.move(sx(270), sx(480))
for (let i = 0; i < 2; i++) {
  await page.mouse.wheel(0, -84)
  await sleep(90)
}
await sleep(340)
mark('CAPLAND')
await cap('横过来<em>摊在桌上</em>', '手机上也能看全')
await sleep(1300)
await cap('')
for (let i = 0; i < 2; i++) {
  await page.mouse.wheel(0, 84)
  await sleep(80)
}
await sleep(260)
await page.click('[aria-label="横屏显示"]')
await sleep(1000)

mark('END')
// 5) 结尾
await show('rl-end')
await sleep(2100)

mark('CLOSE')
const total = (Date.now() - recStart) / 1000
// 顺序很重要：video.path() 会一直等到录像收尾，而收尾发生在 ctx.close() 里。
// 先取句柄、关上下文、再取路径，否则两边互等，进程就卡死在这儿。
const rec = page.video()
await ctx.close()
const rawVideo = await rec.path()
await browser.close()
server.close()

// 找品红切点：取低分辨率帧，第一个中心像素是品红的帧就是正片的起点
function findCut(file) {
  const raw = execSync(
    `ffmpeg -v error -i "${file}" -vf "fps=25,scale=16:28" -f rawvideo -pix_fmt rgb24 -`,
    { maxBuffer: 1 << 26 },
  )
  const F = 16 * 28 * 3
  for (let i = 0; i < Math.floor(raw.length / F); i++) {
    const o = i * F + Math.floor(F / 2) - 1
    if (raw[o] > 200 && raw[o + 1] < 60 && raw[o + 2] > 200) return i / 25
  }
  return 0
}
const cutAt = findCut(rawVideo)
// recordVideo 出来的是固定 25fps 的 webm；原始帧已经是 1080×1920，不再放大
const mp4 = path.join(OUT, 'liti-shuhua-promo-9x16.mp4')
const dur = total + 0.3
const vf = [
  'fade=t=in:st=0:d=0.25',
  `fade=t=out:st=${Math.max(0, dur - 0.6).toFixed(2)}:d=0.6`,
  'scale=1080:1920:flags=lanczos',
  'unsharp=3:3:0.35:3:3:0.0',
  'format=yuv420p',
].join(',')
execSync(
  `ffmpeg -y -loglevel error -ss ${(cutAt + 0.3).toFixed(2)} -i "${rawVideo}" -an -vf "${vf}" ` +
    `-c:v libx264 -preset medium -crf 18 -tune animation -r 25 -movflags +faststart "${mp4}"`,
  { stdio: 'inherit' },
)
fs.rmSync(path.join(OUT, 'raw'), { recursive: true, force: true })
console.log(`OK ${mp4} ${(total - cutAt).toFixed(1)}s ${(fs.statSync(mp4).size / 1024 / 1024).toFixed(2)}MB 25fps`)
