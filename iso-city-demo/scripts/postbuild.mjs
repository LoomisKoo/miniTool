import { copyFile, cp, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// 把原有静态图鉴一起放进 dist，保持旧的部署方式：
// dist/index.html + dist/city.html + dist/assets/
const files = ['index.html', 'canton.html', 'rainy.html', 'city2.html', 'canton-osm.json', 'preview.png', 'preview-detail.png']
await mkdir('dist', { recursive: true })
for (const file of files) {
  if (existsSync(file)) await copyFile(file, join('dist', file))
}
// 新的 700m 城市是纯静态模块，直接整目录拷进去
if (existsSync('city2')) await cp('city2', join('dist', 'city2'), { recursive: true })

if (!existsSync('dist/city.html')) {
  console.error('未找到 dist/city.html，Vite 构建可能失败。')
  process.exit(1)
}

const entries = await readdir('dist')
console.log('\n构建完成：dist/')
console.log(entries.sort().join('  '))
console.log('\n部署时把 dist/ 整个目录作为静态站点即可；API 由 server/ 部署到函数计算。\n')
