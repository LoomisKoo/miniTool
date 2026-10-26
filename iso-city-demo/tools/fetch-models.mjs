// 从 Poly Haven（CC0）抓取 GLTF 资产到 src/assets/models/。
//
// 官方只提供 zip 或"gltf + include 清单"，这里按清单逐个下载，
// 并把 gltf 内部的绝对 / 远程 uri 改写成相对路径，Vite 才能打包。
//
// 用法：node tools/fetch-models.mjs jacaranda_tree fire_hydrant ...

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const resFlag = args.find((arg) => arg.startsWith('--res='))
const RES = resFlag ? resFlag.slice(6) : '1k'
const ids = args.filter((arg) => !arg.startsWith('--'))
const root = new URL('../src/assets/models/', import.meta.url)

async function download(url, file) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  await mkdir(dirname(fileURLToPath(file)), { recursive: true })
  await writeFile(file, buffer)
  return buffer.length
}

for (const id of ids) {
  const meta = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json()
  const entry = meta?.gltf?.[RES]
  if (!entry) {
    console.warn(`[skip] ${id}: 没有 ${RES} 的 gltf`)
    continue
  }
  const dir = new URL(`${id}/`, root)
  const gltfName = basename(new URL(entry.gltf.url).pathname)

  let total = await download(entry.gltf.url, new URL(gltfName, dir))

  for (const [rel, info] of Object.entries(entry.gltf.include || {})) {
    total += await download(info.url, new URL(rel, dir))
  }

  // 有些 gltf 里的 uri 指向 Poly Haven 上的绝对地址，改成同目录相对路径。
  const gltfPath = new URL(gltfName, dir)
  const text = await readFile(gltfPath, 'utf8')
  const fixed = text.replace(/"uri"\s*:\s*"([^"]+)"/g, (whole, uri) => {
    if (uri.startsWith('data:')) return whole
    return `"uri": "${uri.replace(/^.*\/(textures\/)/, '$1')}"`
  })
  if (fixed !== text) await writeFile(gltfPath, fixed)

  console.log(`[ok] ${id} ${gltfName} + ${Object.keys(entry.gltf.include || {}).length} files, ${(total / 1e6).toFixed(2)} MB`)
}

console.log('done →', join(process.cwd(), 'src/assets/models'))
