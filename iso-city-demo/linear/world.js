import * as THREE from 'three'
import { freezeStatic, mergeStatic } from './perf.js'
import { W } from './spec.js'
import { buildPlan } from './plan.js'
import { buildNature } from './nature.js'
import { buildWalls } from './wall.js'
import { buildCity } from './city.js'

export function buildWorld() {
  const root = new THREE.Group()
  root.name = 'linear-city'

  const plan = buildPlan()
  root.add(buildNature(W.segmentLength))
  const city = buildCity(plan)
  root.add(city)
  root.add(buildWalls(W.segmentLength))

  root.userData.plan = plan
  root.userData.ferris = city.getObjectByName('ferris')
  root.userData.streetLife = city.userData.streetLife
  root.userData.buildings = city.userData.buildings
  root.userData.queryWalk = city.userData.queryWalk
  // 静态物体不再每帧重算矩阵（摩天轮、船是动的，保留）
  // 静态普通网格按材质+分块合并，减少 draw call
  root.userData.merged = mergeStatic(root, [root.userData.ferris, city.userData.boats, city.userData.streetLife, city.userData.buildings])
  freezeStatic(root, [root.userData.ferris, city.userData.boats])
  return root
}
