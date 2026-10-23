// 阿里云函数计算 HTTP 触发器入口。
// 运行时：Node.js 18/20，处理程序：fc.handler
// 环境变量：DATABASE_URL / AUTH_SECRET / PUBLIC_APP_URL / ALLOW_ORIGIN
import { createApi } from './api.mjs'
import { JsonStore } from './store/json-store.mjs'
import { PgStore } from './store/pg-store.mjs'

let ready = null

async function getApi() {
  if (!ready) {
    ready = (async () => {
      const store = process.env.DATABASE_URL
        ? await new PgStore(process.env.DATABASE_URL).init()
        : await new JsonStore('/tmp/lumen-db.json').init()
      if (!process.env.DATABASE_URL) {
        console.warn('[lumen-fc] 未设置 DATABASE_URL，/tmp JSON 不跨实例持久化，生产环境请使用 PostgreSQL。')
      }
      return createApi({
        store,
        authSecret: process.env.AUTH_SECRET || 'fc-dev-only-change-me',
        appUrl: process.env.PUBLIC_APP_URL || '',
        storage: process.env.DATABASE_URL ? 'postgres' : 'json',
      })
    })()
  }
  return ready
}

function parseBody(req) {
  if (!req.body) return undefined
  const raw = req.isBase64Encoded ? Buffer.from(req.body, 'base64').toString('utf8') : req.body
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function handler(req, resp) {
  const api = await getApi()
  const path = req.path || req.rawPath || '/'
  const result = await api({
    method: req.method || req.httpMethod || 'GET',
    path,
    query: req.queryParameters || req.query || {},
    headers: Object.fromEntries(
      Object.entries(req.headers || {}).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]),
    ),
    body: parseBody(req),
    ip: req.headers?.['x-forwarded-for']?.split(',')[0] || 'fc',
  })

  resp.statusCode = result.status
  for (const [key, value] of Object.entries(result.headers || {})) resp.setHeader(key, value)
  resp.send(result.body)
}
