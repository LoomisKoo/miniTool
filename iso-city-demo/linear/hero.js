import * as THREE from 'three'
import * as Mat from './mat.js'

function box(w, h, d, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.05, emissive: color, emissiveIntensity: 0 }),
  )
  // 夜里给主角一点自身提亮（街灯点光之外的保底），不再是一团黑影
  Mat.registerMaterial(m.material)
  Mat.registerNight(m.material, 0, 0.3)
  m.castShadow = false // 静态阴影图很少重绘，动态角色改用脚下圆形软影
  return m
}

/** 简易可动主角（腿臂可摆） */
export function buildHero() {
  const group = new THREE.Group()

  const torso = box(0.46, 0.6, 0.28, '#3a5a82')
  torso.position.set(0, 1.16, 0)
  group.add(torso)
  const belt = box(0.48, 0.12, 0.3, '#1f2b3a')
  belt.position.set(0, 0.9, 0)
  group.add(belt)
  const head = box(0.26, 0.24, 0.24, '#e8c9a8')
  head.position.set(0, 1.63, 0)
  group.add(head)
  const hair = box(0.28, 0.11, 0.26, '#20242b')
  hair.position.set(0, 1.77, 0)
  group.add(hair)
  const pack = box(0.3, 0.34, 0.16, '#c85a3a')
  pack.position.set(0, 1.2, -0.2)
  group.add(pack)

  const legs = []
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(s * 0.12, 0.8, 0)
    const leg = box(0.15, 0.66, 0.17, '#3a4656')
    leg.position.set(0, -0.35, 0)
    pivot.add(leg)
    const boot = box(0.16, 0.1, 0.26, '#15191f')
    boot.position.set(0, -0.72, 0.04)
    pivot.add(boot)
    group.add(pivot)
    legs.push(pivot)
  }

  const arms = []
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(s * 0.29, 1.4, 0)
    const arm = box(0.12, 0.56, 0.13, '#43608a')
    arm.position.set(0, -0.28, 0)
    pivot.add(arm)
    const hand = box(0.13, 0.12, 0.14, '#e8c9a8')
    hand.position.set(0, -0.6, 0)
    pivot.add(hand)
    group.add(pivot)
    arms.push(pivot)
  }

  return { group, legs, arms }
}
