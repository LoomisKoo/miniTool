// 室内：一间可复用的「盒中盒」，按业态换家具。靠近才构建，退出即销毁。
import * as THREE from 'three'
import { MeshBuilder, litMat } from './kit.js'

const Y = -200

function roomShell(w, d, h, floorCol, wallCol) {
  const b = new MeshBuilder()
  b.box(w, 0.3, d, floorCol, 0, -0.15, 0, 0, { skipBottom: false })
  b.box(w, h, 0.3, wallCol, 0, h / 2, d / 2, 0)
  b.box(w, h, 0.3, wallCol, 0, h / 2, -d / 2, 0)
  b.box(0.3, h, d, wallCol, w / 2, h / 2, 0, 0)
  b.box(0.3, h, d, wallCol, -w / 2, h / 2, 0, 0)
  b.box(w + 0.4, 0.3, d + 0.4, '#c9c2b4', 0, h, 0, 0)
  return b
}

function shelf(b, x, z, w, d, h, col, rows = 4) {
  b.box(w, h, d, col, x, h / 2, z, 0)
  for (let i = 1; i < rows; i++) b.box(w + 0.05, 0.06, d + 0.05, '#8a8378', x, (h / rows) * i, z, 0)
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < Math.floor(w / 0.5); j++) {
      b.box(0.34, 0.36, d * 0.7, ['#c85a4a', '#3f7a9a', '#c9a24e', '#6a9a5a', '#d8d2c2'][(i + j) % 5], x - w / 2 + 0.3 + j * 0.5, (h / rows) * (i + 0.5) + 0.05, z, 0)
    }
  }
}

export function makeInterior(kind, name) {
  const g = new THREE.Group()
  g.position.set(0, Y, 0)
  const b = new MeshBuilder()
  const glow = new MeshBuilder(0, { grade: false })
  let W = 20
  let D = 16
  let H = 4.4
  let floor = '#6f6a62'
  let wall = '#c9c2b4'
  if (kind === 'mall' || kind === 'metro' || kind === 'station') {
    W = 28
    D = 22
    H = 7.5
    floor = '#8b8b86'
    wall = '#d8d2c4'
  }
  const shell = roomShell(W, D, H, floor, wall)
  b.pos.append(shell.pos)
  b.nor.append(shell.nor)
  b.col.append(shell.col)

  const doorX = 0
  const doorZ = D / 2

  if (kind === 'store' || kind === 'market' || kind === 'fruit' || kind === 'pharmacy') {
    shelf(b, -6.4, -3.4, 1.2, 8, 2.0, '#b9b2a4')
    shelf(b, -2.0, -3.4, 1.2, 8, 2.0, '#b9b2a4')
    shelf(b, 2.4, -3.4, 1.2, 8, 2.0, '#b9b2a4')
    b.box(6, 1.0, 1.2, '#c9c2b4', 6.2, 0.5, -2.2, 0)
    glow.box(5.4, 0.3, 0.2, '#ffd9a2', 6.2, 1.9, -2.2, 0)
    b.box(3.2, 2.2, 1.0, '#d8d2c4', 7.4, 1.1, 3.4, 0)
    glow.box(2.8, 1.0, 0.14, '#ffd9a2', 7.4, 2.4, 3.4, 0)
    for (let i = 0; i < 3; i++) b.cyl(0.24, 0.9, '#3f5a7a', -8.4, 0.9, 5.4 - i * 1.4, 8)
    b.box(14, 0.9, 1.1, '#8a7a62', 4.5, 0.45, -6.6, 0)
    glow.box(13.6, 0.16, 0.14, '#ffe6b8', 4.5, 1.02, -7.1, 0)
    for (let i = 0; i < 4; i++) {
      b.box(0.9, 0.08, 1.6, '#c9a24e', -3 + i * 2.2, 2.6, 1.6, 0)
      b.box(0.12, 2.4, 0.12, '#3a3f45', -3.4 + i * 2.2, 1.4, 1.6, 0)
    }
    glow.box(3.2, 0.2, 0.2, '#7ad2ff', -W / 2 + 0.4, 3.2, 0, 0)
  } else if (kind === 'noodle' || kind === 'breakfast' || kind === 'bbq' || kind === 'restaurant' || kind === 'hotpot' || kind === 'deli') {
    b.box(7, 0.95, 2.2, '#8a7a62', -5.5, 0.48, -5.2, 0)
    for (let i = 0; i < 3; i++) b.cyl(0.34, 1.0, '#8f959c', -7.6 + i * 1.9, 1.0, -6.2, 8)
    b.box(6.6, 0.55, 1.9, '#3a3f45', -5.5, 3.4, -6.4, 0)
    for (let i = 0; i < 4; i++) {
      b.box(1.5, 0.1, 1.5, '#c9a24e', -4 + (i % 2) * 5.2, 1.0, 1.4 + Math.floor(i / 2) * 4.2, 0)
      b.box(0.1, 0.9, 0.1, '#6a5a44', -4.6 + (i % 2) * 5.2, 0.5, 0.9 + Math.floor(i / 2) * 4.2, 0)
      b.box(0.1, 0.9, 0.1, '#6a5a44', -3.4 + (i % 2) * 5.2, 0.5, 0.9 + Math.floor(i / 2) * 4.2, 0)
      b.box(0.6, 0.06, 0.9, '#d8d2c2', -4.4 + (i % 2) * 5.2, 0.5, 0.2 + Math.floor(i / 2) * 4.2, 0)
      b.box(0.6, 0.06, 0.9, '#d8d2c2', -3.6 + (i % 2) * 5.2, 0.5, 0.2 + Math.floor(i / 2) * 4.2, 0)
    }
    glow.box(2.4, 0.9, 0.14, '#ffd9a2', 0, 3.2, -6.6, 0)
    b.box(4, 0.3, 0.9, '#3f7a9a', 6.2, 3.6, -3.4, 0)
  } else if (kind === 'office' || kind === 'civic' || kind === 'hospital' || kind === 'school') {
    b.box(9, 1.1, 2.4, '#b9c3cb', 0, 0.55, 5.2, 0)
    b.box(10, 3.4, 0.4, '#8a9299', 0, 1.7, 7.0, 0)
    glow.box(9, 1.4, 0.16, '#bfd8ec', 0, 2.2, 6.95, 0)
    for (let i = 0; i < 4; i++) {
      b.box(2.4, 1.0, 0.9, '#a8b3bd', -9 + i * 6, 0.5, 6.4, 0)
      b.box(0.9, 1.0, 2.4, '#a8b3bd', -9 + i * 6, 0.5, 6.4, 0)
    }
    for (let i = 0; i < 3; i++) {
      b.box(0.2, 3.2, 0.2, '#c9c2b4', -8 + i * 8, 1.6, -3, 0)
      glow.box(1.6, 0.16, 0.6, '#ffe6b8', -8 + i * 8, 3.3, -3, 0)
    }
    b.box(12, 0.9, 1.0, '#6f8fa6', 0, 0.45, -6.6, 0)
    glow.box(11, 0.3, 0.2, '#7ad2ff', 0, 2.2, -7.1, 0)
  } else if (kind === 'mall' || kind === 'station' || kind === 'metro') {
    b.box(6, 1.0, 3.0, '#b9c3cb', 0, 0.5, 3.0, 0)
    for (let i = 0; i < 4; i++) {
      b.box(3.4, 0.9, 3.4, '#a8b3bd', -9 + i * 6, 0.45, -4.4, 0)
      b.box(0.8, 0.9, 0.8, '#8a9299', -9 + i * 6, 1.4, -4.4, 0)
    }
    glow.box(16, 0.24, 0.24, '#bfd8ec', 0, 5.4, 0, 0)
    b.box(0.4, 5.2, 0.4, '#6f7a83', -10, 2.6, 8, 0)
    glow.box(9, 1.2, 0.16, '#7ad2ff', 0, 4.2, -10.6, 0)
  } else {
    b.box(6, 1.0, 2.2, '#b9b2a4', -3, 0.5, -4.5, 0)
    shelf(b, 5.0, -3.0, 1.4, 7, 1.9, '#b9b2a4', 3)
    glow.box(6, 0.2, 0.2, '#ffd9a2', 0, 3.4, 0, 0)
  }

  // 门内溢光 + 地垫 + 出口指示
  glow.box(2.6, 2.2, 0.12, '#ffe0b0', doorX, 1.1, doorZ - 0.2, 0)
  b.box(2.2, 0.06, 1.2, '#8a3a2a', doorX, 0.03, doorZ - 1.0, 0, { skipBottom: false })
  b.box(1.4, 0.5, 0.1, '#1b2733', doorX + 3.4, 2.4, doorZ - 0.3, 0)
  glow.box(1.2, 0.3, 0.06, '#7ad2ff', doorX + 3.4, 2.4, doorZ - 0.36, 0)

  const mat = litMat({ roughness: 0.85 })
  const mesh = new THREE.Mesh(b.build(), mat)
  g.add(mesh)
  const gm = new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))
  g.add(gm)

  // 店名牌（悬在门内侧）
  const cv = document.createElement('canvas')
  cv.width = 256
  cv.height = 64
  const c2 = cv.getContext('2d')
  c2.fillStyle = '#14181e'
  c2.fillRect(0, 0, 256, 64)
  c2.fillStyle = '#ffe6b8'
  c2.font = '700 32px "PingFang SC","Microsoft YaHei",sans-serif'
  c2.textAlign = 'center'
  c2.textBaseline = 'middle'
  c2.fillText(name.slice(0, 12), 128, 34)
  const tex = new THREE.CanvasTexture(cv)
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
  plate.position.set(0, 3.1, D / 2 - 0.3)
  plate.rotation.y = Math.PI
  g.add(plate)

  const light = new THREE.PointLight('#ffd9a2', 22, 34, 2)
  light.position.set(0, H - 0.8, 0)
  g.add(light)

  return { group: g, spawn: [0, Y + 0.2, D / 2 - 3.2], exit: [0, Y + 0.2, D / 2 - 1.2], size: [W, D] }
}
