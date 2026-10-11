#!/usr/bin/env node
// 帧藏 iOS · App Store 截图测试数据工具
//
// 用途：直接读写模拟器里 Frame藏 的沙盒数据，快速准备/清空截图用的作品与草稿。
// 数据落盘位置：<容器>/Library/Application Support/{works,presets,draft}.json
// 应用语言：<容器>/Library/Preferences/com.tincom.framezang.plist 的 appLanguage
//
// 用法：
//   node screenshot-data.mjs status          查看容器与现有数据
//   node screenshot-data.mjs clear           清空作品/模板/草稿，语言重置为中文
//   node screenshot-data.mjs seed            写入 8 件作品 + 首页草稿（午夜巴黎）
//   node screenshot-data.mjs lang zh|en      切换界面语言（会自动重启 App）
//   node screenshot-data.mjs pro on|off      切换 Pro 解锁状态（用于截图 5 的 Pro 卡片）
//   node screenshot-data.mjs restart         重启 App
//   node screenshot-data.mjs list            列出可用模板 id
//
// 选项：
//   --device <udid|booted>   指定模拟器，默认 booted
//
// 注意：写入前会自动终止 App，写完需要手动点开（或先跑 restart）。

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CATALOG = resolve(HERE, '../ios/Frame藏/TicketCatalogData.swift')
const ASSETS = resolve(HERE, '../assets')

const BUNDLE = 'com.tincom.framezang'
const APPLE_EPOCH = 978307200 // 2001-01-01T00:00:00Z，Swift Date 的参考起点

const argv = process.argv.slice(2)
const deviceFlag = argv.indexOf('--device')
const device = deviceFlag >= 0 ? argv[deviceFlag + 1] : 'booted'
const args = deviceFlag >= 0
  ? argv.filter((_, i) => i !== deviceFlag && i !== deviceFlag + 1)
  : argv
const command = args[0]

// ---------- 模拟器 ----------

function simctl(...a) {
  return execFileSync('xcrun', ['simctl', ...a], { encoding: 'utf8' })
}

function simctlQuiet(...a) {
  try { execFileSync('xcrun', ['simctl', ...a], { stdio: 'ignore' }) } catch { /* ignore */ }
}

function container() {
  try {
    return simctl('get_app_container', device, BUNDLE, 'data').trim()
  } catch {
    fail(`在 ${device} 上找不到已安装的 ${BUNDLE}，请先用 Xcode 跑到模拟器。`)
  }
}

function supportDir(c) {
  const dir = resolve(c, 'Library/Application Support')
  mkdirSync(dir, { recursive: true })
  return dir
}

/// 偏好设置必须经 cfprefsd 写，直接改 plist 文件会被缓存覆盖
function writePref(key, value) {
  if (value === null) simctlQuiet('spawn', device, 'defaults', 'delete', BUNDLE, key)
  else simctl('spawn', device, 'defaults', 'write', BUNDLE, key, String(value))
}

function readPref(key) {
  try {
    return execFileSync('xcrun', ['simctl', 'spawn', device, 'defaults', 'read', BUNDLE, key], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

function terminate() {
  simctlQuiet('terminate', device, BUNDLE)
}

// ---------- 模板目录解析 ----------

function loadCatalog() {
  const src = readFileSync(CATALOG, 'utf8')
  const re = /TicketTemplate\(id: "([^"]+)", name: "([^"]+)", detail: "([^"]*)", category: \.(\w+), size: CGSize\(width: ([\d.]+), height: ([\d.]+)\), fields: \[(.*?)\], photoSlots: (\d+), isPro: (true|false)\)/g
  const templates = new Map()
  let m
  while ((m = re.exec(src))) {
    const [, id, name, detail, category, w, h, rawFields, slots, isPro] = m
    const fields = {}
    const fre = /\.init\("([^"]+)", "([^"]*)", "([^"]*)"\)/g
    let f
    while ((f = fre.exec(rawFields))) fields[f[1]] = f[3]
    templates.set(id, {
      id, name, detail, category,
      width: Number(w), height: Number(h),
      photoSlots: Number(slots), isPro: isPro === 'true',
      fields,
    })
  }
  if (templates.size === 0) fail(`未能从 ${CATALOG} 解析出任何模板`)
  return templates
}

// ---------- 截图数据定义 ----------

// 顺序即展示顺序：第一件在最左上。daysAgo 越小越新。
const WORKS = [
  { templateID: 'cinema-tear',    photo: 'default-cinema.jpg',   daysAgo: 1,  effects: ['tex-paper', 'mat-matte'], favorite: true, tags: ['电影', '雨夜'] },
  { templateID: 'travel-board',   photo: 'default-travel.jpg',   daysAgo: 5,  effects: ['pat-grid'] },
  { templateID: 'concert-neon',   photo: 'default-concert.jpg',  daysAgo: 9,  effects: ['lit-neon', 'mat-gloss'] },
  { templateID: 'stamp-classic',  photo: 'default-stamp.jpg',    daysAgo: 16, effects: ['tex-paper'] },
  { templateID: 'cinema-poster',  photo: 'default-cinema.jpg',   daysAgo: 23, effects: ['lit-vignette'] },
  { templateID: 'city-map',       photo: 'default-city.jpg',     daysAgo: 31,  effects: ['tex-linen'] },
  { templateID: 'travel-rail',    photo: 'default-travel.jpg',   daysAgo: 300, effects: ['stp-approved'] },
  { templateID: 'city-street',    photo: null,                   daysAgo: 380, effects: ['tex-grain'] },
]

// 首页草稿：截图 1/3/4 的那张（未保存态）
const DRAFT = {
  templateID: 'cinema-tear',
  photo: 'default-cinema.jpg',
  effects: ['mat-paper3d'],
  uuid: '11111111-1111-4111-8111-111111111111',
}

const EFFECT_IDS = new Set([
  'tex-paper', 'tex-grain', 'tex-halftone', 'tex-linen', 'tex-diag', 'tex-noise',
  'pat-corners', 'pat-dash', 'pat-stars', 'pat-grid', 'pat-waves',
  'stp-postmark', 'stp-approved', 'stp-checked', 'stp-paid', 'stp-custom', 'stp-wax',
  'txt-custom', 'txt-time', 'txt-mark', 'txt-diag',
  'lit-glitter', 'lit-rose', 'lit-vignette', 'lit-leak', 'lit-neon', 'lit-beam',
  'mat-flat', 'mat-matte', 'mat-gloss', 'mat-paper3d',
])

// ---------- 构造 SavedTicket ----------

function base64(path) {
  if (!existsSync(path)) fail(`缺少图片：${path}`)
  return readFileSync(path).toString('base64')
}

function savedAtFor(daysAgo) {
  return Math.floor((Date.now() - daysAgo * 86400_000) / 1000) - APPLE_EPOCH
}

function ticket({ templateID, photo, effects, uuid, daysAgo = 0, favorite, tags }) {
  const t = catalog.get(templateID)
  if (!t) fail(`模板不存在：${templateID}`)
  for (const id of effects ?? []) {
    if (!EFFECT_IDS.has(id)) fail(`特效 id 不存在：${id}`)
  }
  const f = t.fields
  const item = {
    id: uuid ?? randomUUID().toUpperCase(),
    title: f.title ?? t.name,
    templateID,
    fields: {
      title: f.title ?? '',
      place: f.place ?? '',
      date: f.date ?? '',
      seat: f.seat ?? '',
      mood: f.mood ?? '',
    },
    savedAt: savedAtFor(daysAgo),
    photoScale: 1,
    effectIDs: effects ?? [],
    background: 'ink',
    stageOpacity: 1,
  }
  if (photo) item.photoData = base64(resolve(ASSETS, photo))
  if (favorite) item.isFavorite = true
  if (tags) item.tags = tags
  return item
}

// ---------- 命令 ----------

function fail(msg) {
  console.error(`✖ ${msg}`)
  process.exit(1)
}

function cmdStatus() {
  const c = container()
  const dir = supportDir(c)
  console.log(`设备   : ${device}`)
  console.log(`容器   : ${c}`)
  for (const name of ['works.json', 'presets.json', 'draft.json']) {
    const p = resolve(dir, name)
    if (!existsSync(p)) { console.log(`${name.padEnd(13)}: 无`) ; continue }
    try {
      const parsed = JSON.parse(readFileSync(p, 'utf8'))
      const n = Array.isArray(parsed) ? `${parsed.length} 条` : '1 条'
      console.log(`${name.padEnd(13)}: ${n}  (${readFileSync(p).length} B)`)
    } catch {
      console.log(`${name.padEnd(13)}: 存在但无法解析`)
    }
  }
  let lang = '(未设置 → 跟随系统)'
  const stored = readPref('appLanguage')
  if (stored) lang = stored
  console.log(`语言   : ${lang}`)
  console.log(`Pro    : ${readPref('framezang.pro.unlocked') ? '已解锁' : '未解锁'}`)
}

function cmdClear() {
  const c = container()
  const dir = supportDir(c)
  terminate()
  let removed = 0
  for (const name of ['works.json', 'presets.json', 'draft.json']) {
    const p = resolve(dir, name)
    if (existsSync(p)) { rmSync(p); removed++ }
  }
  writePref('appLanguage', 'zh-Hans')
  writePref('framezang.pro.unlocked', null)
  console.log(`✔ 已清空：删除 ${removed} 个数据文件，语言重置为中文，Pro 解锁状态已清除`)
  console.log('  下一步：node screenshot-data.mjs seed')
}

function cmdSeed() {
  const c = container()
  const dir = supportDir(c)
  terminate()

  const works = WORKS.map(w => ticket(w))
  const draft = ticket({ ...DRAFT, daysAgo: 0 })
  // 草稿保持「未保存」态：id 不与任何作品冲突
  writeFileSync(resolve(dir, 'works.json'), JSON.stringify(works, null, 2))
  writeFileSync(resolve(dir, 'draft.json'), JSON.stringify(draft, null, 2))
  rmSync(resolve(dir, 'presets.json'), { force: true })

  console.log(`✔ 已写入 ${works.length} 件作品 + 1 份草稿`)
  for (const w of works) {
    const t = catalog.get(w.templateID)
    const flag = [w.photoData ? '照片' : '无照片', w.isFavorite ? '收藏' : '', t.isPro ? 'Pro模板！' : '']
      .filter(Boolean).join(' · ')
    console.log(`   ${w.title.padEnd(12, '　')} [${t.name}]  ${flag}`)
  }
  console.log('  草稿：午夜巴黎 [双联撕裂]（未保存态）')
  console.log('  下一步：node screenshot-data.mjs restart')
}

function cmdLang(value) {
  if (value !== 'zh' && value !== 'en') fail('用法：lang zh|en')
  terminate()
  const target = value === 'en' ? 'en' : 'zh-Hans'
  writePref('appLanguage', target)
  console.log(`✔ 语言已切换为 ${target}，正在重启 App…`)
  cmdRestart()
}

function cmdRestart() {
  terminate()
  simctl('launch', device, BUNDLE)
  console.log('✔ 已冷启动 App')
}

function cmdPro(on) {
  terminate()
  writePref('framezang.pro.unlocked', on === 'on' ? 'true' : null)
  console.log(`✔ Pro 解锁状态：${on === 'on' ? '已解锁' : '未解锁'}`)
}

function cmdList() {
  for (const t of catalog.values()) {
    console.log(`${t.id.padEnd(22)} ${t.category.padEnd(8)} ${t.isPro ? 'Pro' : '免费'}  ${t.width}x${t.height}  ${t.name}`)
  }
}

// ---------- 入口 ----------

const catalog = loadCatalog()

switch (command) {
  case 'status': cmdStatus(); break
  case 'clear': cmdClear(); break
  case 'seed': cmdSeed(); break
  case 'lang': cmdLang(args[1]); break
  case 'pro': cmdPro(args[1]); break
  case 'restart': cmdRestart(); break
  case 'list': cmdList(); break
  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 21).map(l => l.replace(/^\/\/ ?/, '')).join('\n'))
    process.exit(command ? 1 : 0)
}
