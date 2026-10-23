import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const file = join(__dirname, 'data', 'db.json')
await rm(file, { force: true })
console.log(`已清除本地 JSON 数据：${file}`)
console.log('如果使用 PostgreSQL，请手动执行 TRUNCATE 或重建 schema。')
