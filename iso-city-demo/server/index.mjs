import dotenv from 'dotenv'
import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createApi } from './api.mjs'
import { JsonStore } from './store/json-store.mjs'
import { PgStore } from './store/pg-store.mjs'

dotenv.config({ path: ['.env', 'server/.env'] })

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const PORT = Number(process.env.PORT || 8787)
const authSecret = process.env.AUTH_SECRET || 'local-dev-only-change-before-deploy'
if (!process.env.AUTH_SECRET) {
  console.warn('[lumen] AUTH_SECRET 未设置，正在使用本地开发默认值。部署前必须设置。')
}

const store = process.env.DATABASE_URL
  ? await new PgStore(process.env.DATABASE_URL).init()
  : await new JsonStore(join(__dirname, 'data', 'db.json')).init()

if (!process.env.DATABASE_URL) {
  console.warn('[lumen] 未设置 DATABASE_URL，使用单实例 JSON 存储（仅适合本地试玩）。')
}

const api = createApi({
  store,
  authSecret,
  appUrl: process.env.PUBLIC_APP_URL || 'http://localhost:5173/city.html',
  storage: process.env.DATABASE_URL ? 'postgres' : 'json',
})

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', true)
app.use(express.json({ limit: '64kb' }))

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

app.all('/api/*', async (req, res) => {
  try {
    const result = await api({
      method: req.method,
      path: req.path,
      query: req.query,
      headers: req.headers,
      body: req.body,
      ip: req.ip,
    })
    res.status(result.status)
    for (const [key, value] of Object.entries(result.headers || {})) res.setHeader(key, value)
    res.send(result.body)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '城市服务暂时不可用' })
  }
})

app.use(express.json({ limit: '64kb' }))
app.use(express.static(join(root, 'dist')))
if (existsSync(join(root, 'dist', 'index.html'))) {
  app.get('/', (_req, res) => res.sendFile(join(root, 'dist', 'index.html')))
}

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: '请求格式不正确' })
  console.error(error)
  res.status(500).json({ error: '服务暂时不可用' })
})

const server = app.listen(PORT, () => {
  console.log(`[lumen] API ready on http://localhost:${PORT} (${process.env.DATABASE_URL ? 'postgres' : 'json'})`)
  console.log('[lumen] web dev: npm run dev  →  http://localhost:5173/city.html')
})

function shutdown() {
  server.close(async () => {
    if (store.close) await store.close()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
