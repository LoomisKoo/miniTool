import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const children = []
let stopping = false

function run(name, args) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: process.env,
  })
  child.on('exit', (code) => {
    if (!stopping && code !== 0) {
      console.error(`[${name}] exited with code ${code}`)
      shutdown(1)
    }
  })
  children.push(child)
  return child
}

function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 200)
}

if (!existsSync('node_modules')) {
  console.error('未找到 node_modules，请先运行 npm install')
  process.exit(1)
}

console.log('\n  微光城区 / LUMEN DISTRICT')
console.log('  web  http://localhost:5173/city.html')
console.log('  api  http://localhost:8787/api/health\n')

run('api', ['server/index.mjs'])
run('web', ['node_modules/vite/bin/vite.js'])

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
