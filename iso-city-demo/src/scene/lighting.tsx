import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import duskHdr from '../assets/hdr/venice_sunset_1k.hdr?url'
import cityHdr from '../assets/hdr/potsdamer_platz_1k.hdr?url'
import nightHdr from '../assets/hdr/dikhololo_night_1k.hdr?url'

// 基于图像的光照（IBL）。
//
// 这是"像不像真的"里性价比最高的一步：以前金属和玻璃只反射几盏灯的亮点，
// 所以车漆、幕墙、栏杆看起来都是纯色塑料。换成真实 HDR 环境后，天空、太阳
// 和周围楼群会一起进入反射与漫反射，材质立刻有了"被城市包住"的感觉。
//
// 三张图都是 CC0（Poly Haven），1k 分辨率就够：反射主要是低频信息，
// 上 4k 只会让首屏多几 MB 下载，观感几乎没差别。

export type HdrMood = 'dusk' | 'city' | 'night'

const HDRS: Record<HdrMood, string> = {
  dusk: duskHdr,
  city: cityHdr,
  night: nightHdr,
}

// 每个 WebGLRenderer 缓存各自的 PMREM 结果：切昼夜来回时不必重新卷积。
const cache = new WeakMap<THREE.WebGLRenderer, Map<string, THREE.WebGLRenderTarget>>()

/**
 * 同一个 renderer + 同一张 HDR 的在途任务。
 *
 * dev 的 StrictMode 会把组件 mount → cleanup → mount，两次挂载都会走
 * `cache.get(url)` 分支、都是未命中，于是同一张 1.7MB 的 HDR 被解析两遍、
 * PMREM 卷积两遍——这一步是首屏后 1~2 秒里最重的一次主线程工作（RGBE
 * 解码 + 生成 mip 链），表现就是"页面出来一两秒后卡一下"。
 * 这里按 url 合并成一次任务，第二次挂载直接等同一个 promise。
 */
const inflight = new WeakMap<THREE.WebGLRenderer, Map<string, Promise<THREE.WebGLRenderTarget>>>()

function cacheOf(gl: THREE.WebGLRenderer) {
  let map = cache.get(gl)
  if (!map) {
    map = new Map()
    cache.set(gl, map)
  }
  return map
}

function inflightOf(gl: THREE.WebGLRenderer) {
  let map = inflight.get(gl)
  if (!map) {
    map = new Map()
    inflight.set(gl, map)
  }
  return map
}

const loader = new RGBELoader()

/**
 * 中性占位环境：让所有材质从第一帧起就是"带 envMap"的着色器变体。
 * 真 HDR 到达后只换纹理内容，program 不会失效，避免整城重编译。
 */
let placeholder: THREE.WebGLRenderTarget | null = null

export function ImageBasedLighting({
  mood,
  intensity = 1,
  rotation = 0,
  onReady,
}: {
  mood: HdrMood
  /** 环境光强度；太亮会把平行光的对比吃掉，城市会显得"发灰" */
  intensity?: number
  /** 以弧度旋转环境贴图，用来把 HDR 里的太阳对到场景里的太阳方位 */
  rotation?: number
  onReady?: (mood: HdrMood) => void
}) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const url = HDRS[mood]

  // 卸载时只把 scene.environment 摘掉，缓存里的 render target 留给下一次切换复用。
  useEffect(() => {
    let alive = true
    const targets = cacheOf(gl)

    // 先挂一个中性的 PMREM 占位环境。
    //
    // 材质有没有 envMap 是两个不同的着色器变体：scene.environment 从 null 变成
    // 有值的那一刻，全场 MeshStandardMaterial 的 program 缓存 key 都会变，
    // 于是下一次渲染要把整座城重编译一遍——这就是首屏后"过一两秒卡 1 秒多"，
    // 日志里表现为 +programs=27。
    //
    // 先给一个 1×1 的灰环境（PMREM 生成的 mip 链是合法的），程序从一开始就
    // 是带 envMap 的变体；真 HDR 到了只是换一张纹理内容，program 不变，不重编译。
    if (!placeholder) {
      const pmrem = new THREE.PMREMGenerator(gl)
      const empty = new THREE.Scene()
      // 深灰蓝：介于夜景和黄昏之间。真 HDR 到了会有一次轻微的亮度变化，
      // 但那是"从灰变到实景"，不是"从黑跳成亮"。
      empty.background = new THREE.Color(0x2b3340)
      placeholder = pmrem.fromScene(empty, 0.04)
      pmrem.dispose()
    }
    if (!scene.environment) scene.environment = placeholder.texture

    const apply = (texture: THREE.Texture) => {
      scene.environment = texture
      onReady?.(mood)
    }

    /** 同一张 HDR 只解析 + 卷积一次，StrictMode 的二次挂载共用同一个 promise。 */
    const prepare = () => {
      const pending = inflightOf(gl)
      const started = pending.get(url)
      if (started) return started
      const task = new Promise<THREE.WebGLRenderTarget>((resolve, reject) => {
        loader.load(
          url,
          (hdr) => {
            // 解码（CPU，RGBE → half float）和 PMREM 卷积（GPU + mip 链）各自
            // 就是几十毫秒。以前它们挤在同一个回调里，合起来就是首屏后
            // "过一两秒卡一下"——也就是片头页面上那次停顿。
            // 拆到下一帧再做卷积，单帧的长任务直接减半。
            requestAnimationFrame(() => {
              const pmrem = new THREE.PMREMGenerator(gl)
              pmrem.compileEquirectangularShader()
              const target = pmrem.fromEquirectangular(hdr)
              hdr.dispose()
              pmrem.dispose()
              targets.set(url, target)
              pending.delete(url)
              resolve(target)
            })
          },
          undefined,
          (error) => {
            pending.delete(url)
            reject(error)
          },
        )
      })
      pending.set(url, task)
      return task
    }

    const cached = targets.get(url)
    if (cached) {
      apply(cached.texture)
    } else {
      prepare()
        .then((target) => {
          if (alive) apply(target.texture)
        })
        .catch(() => {
          // 加载失败就留在中性占位环境上（不回 null，否则又是一次全场景重编译），
          // 城市照常出现，只是反射变成一片灰。
        })
    }

    return () => {
      alive = false
      // 同样不要把 environment 清成 null：那是 program 层面的一次全局失效。
      // 下一次挂载会立刻 apply 自己的纹理；中间这段留占位。
      if (scene.environment === null && placeholder) scene.environment = placeholder.texture
    }
  }, [url, gl, scene, mood, onReady])

  useEffect(() => {
    scene.environmentIntensity = intensity
    scene.environmentRotation = new THREE.Euler(0, rotation, 0)
  }, [scene, intensity, rotation])

  return null
}

/** 楼内/阳台也要 IBL，否则窗外的亮和窗内的暗对不上。 */
export function useInteriorLighting(night: boolean) {
  return useMemo(
    () => ({
      mood: (night ? 'night' : 'city') as HdrMood,
      intensity: night ? 0.9 : 1.15,
      rotation: night ? 0.6 : 2.1,
    }),
    [night],
  )
}
