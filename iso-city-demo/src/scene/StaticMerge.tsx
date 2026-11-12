import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { alreadyUploaded, buildQueueIdle } from './buildQueue'

// 城市里绝大多数构件（窗框、阳台、屋顶设备、街灯、树木……）都是静态的，
// 但每个小方块都是一次 draw call。这里在挂载后把静态网格按「区块 × 材质类」合并：
//
// - 小构件按 64m 网格分块合并，每个块一个网格并保留 frustumCulled，
//   转头或背对街区时整块被 three.js 剔除，阴影 pass 也会一起省掉。
// - 材质颜色烘焙进顶点色，于是"每栋楼各自的墙面色"不再是各自的材质：
//   同粗糙度/金属度的所有楼体可以合成一个 draw call。
// - 跨越多个区块的大件（楼体、地面、路面）合并到全局桶，靠自身包围球剔除。
// - castShadow 也参与合批签名，避免不投影的构件跟着一起进阴影 pass。
// - 角色、车流、行人、脉冲霓虹通过 userData.dynamic 排除。

const CHUNK = 120

/**
 * 合批后的静态件是否降级成 Lambert（逐顶点光照）。
 *
 * 开着：帧时间从 46ms 降到 20ms 量级，代价是静态件没有金属反射
 * 和粗糙度渐变，玻璃看起来是一块平色板。
 * 关掉：回到逐像素 PBR，画面更"真"，但 M1 Pro 上只有 21fps。
 *
 * 需要高光/反射的东西（幕墙、车漆、金属杆件）本来就没进这个分支——
 * 楼体走 facade 的自定义 shader，车流和行人是 dynamic 不合批。
 */
const FLAT_LIGHT = true

type Bucket = {
  material: THREE.Material
  geos: THREE.BufferGeometry[]
  meshes: THREE.Mesh[]
  renderOrder: number
  castShadow: boolean
  receiveShadow: boolean
  lod: { landmark: boolean } | null
}

function isDynamic(node: THREE.Object3D) {
  let current: THREE.Object3D | null = node
  while (current) {
    if (current.userData.dynamic || current.userData.noMerge) return true
    current = current.parent
  }
  return false
}

function lodOf(node: THREE.Object3D): { landmark: boolean } | null {
  let current: THREE.Object3D | null = node
  while (current) {
    if (current.userData.buildingDetailLod) {
      return { landmark: Boolean(current.userData.landmark) }
    }
    current = current.parent
  }
  return null
}

const band = (value: number | undefined, step = 0.15) =>
  value === undefined ? '' : (Math.round(value / step) * step).toFixed(2)

const cache = new Map<string, THREE.Material>()

/** 把"颜色"从材质里抽出来烘焙到顶点色，只保留影响光照的粗糙度/金属度等类别。 */
function classify(source: THREE.Material): { key: string; baked: THREE.Material } | null {
  const std = source as THREE.MeshStandardMaterial
  const basic = source as THREE.MeshBasicMaterial
  const map = basic.map || null
  if (std.alphaMap) return null
  // 普通混合的半透明会依赖绘制顺序，合批会串色，跳过。
  if (source.transparent) {
    const additive = source.blending !== THREE.NormalBlending
    if (!additive || source.depthWrite) return null
  }

  const isBasic = (source as THREE.MeshBasicMaterial).isMeshBasicMaterial === true
  // polygonOffset 必须进签名、也必须复制到合并后的材质：
  // 车道线、井盖、斑马线这些贴花全靠它压住与路面共面的深度竞争。
  // 以前合并时丢了这项，贴花退回"只靠几厘米高差"抢深度，斜视时
  // 路面会被深度偏移拽到贴花前面，看起来就是标线被切掉一段。
  const offsetKey = source.polygonOffset
    ? `po${source.polygonOffsetFactor ?? 0},${source.polygonOffsetUnits ?? 0}`
    : ''
  const key = [
    isBasic ? 'basic' : 'std',
    source.side,
    source.transparent ? 1 : 0,
    source.opacity.toFixed(2),
    source.blending,
    source.depthWrite ? 1 : 0,
    offsetKey,
    isBasic ? '' : band(std.roughness),
    isBasic ? '' : band(std.metalness),
    isBasic ? '' : (std.emissive ? std.emissive.getHexString() : ''),
    isBasic ? '' : band(std.emissiveIntensity, 0.1),
    std.flatShading ? 'flat' : '',
    source.toneMapped ? 'tm' : '',
    map ? map.uuid : '',
    // 叶卡片这类 alphaTest 材质必须按 alpha 裁掉像素，签名里不能漏，
    // 否则会和别的贴图件合并成同一个"实心板"。
    std.alphaTest ? `at${std.alphaTest}` : '',
    std.normalMap ? std.normalMap.uuid : '',
    (source as THREE.MeshStandardMaterial).envMapIntensity !== undefined
      ? band((source as THREE.MeshStandardMaterial).envMapIntensity, 0.25)
      : '',
  ].join('|')

  const cached = cache.get(key)
  if (cached) return { key, baked: cached }

  // 注意：Three 的材质构造函数会对「值 === undefined」的参数打警告，
  // 传 null 或不传都不会。所以这里只在真有贴图时才带上对应的槽位，
  // 而不是写 `map: map || undefined`（那会给每个材质刷两条警告）。
  const shared: THREE.MeshBasicMaterialParameters = {
    color: 0xffffff,
    vertexColors: true,
    transparent: source.transparent,
    opacity: source.opacity,
    blending: source.blending,
    depthWrite: source.depthWrite,
    side: source.side,
    toneMapped: source.toneMapped,
  }

  let created: THREE.Material
  if (isBasic) {
    const params: THREE.MeshBasicMaterialParameters = { ...shared }
    if (map) params.map = map
    created = new THREE.MeshBasicMaterial(params)
  } else if (FLAT_LIGHT) {
    // 合批后的静态件一律走 Lambert（逐顶点光照），不再走 Standard（逐像素 PBR）。
    //
    // 这是帧时间最大的一刀。实测把场景里 6907 个受光网格换成无光照材质，
    // 帧时间从 46.6ms 掉到 16.7ms——也就是说三分之二的时间花在
    // "每个像素算一遍 IBL + 3 盏点光 + PCF 阴影"上。
    //
    // Lambert 在顶点上算一次光照、像素上只做插值，成本差一个数量级。
    // 视觉上损失的是金属反射和粗糙度渐变，但夜景本来就把这些压成了剪影，
    // 而参考那种城市模型的"干净"恰恰来自没有反射和渐变。
    const params: THREE.MeshLambertMaterialParameters = {
      color: 0xffffff,
      vertexColors: true,
      transparent: source.transparent,
      opacity: source.opacity,
      blending: source.blending,
      depthWrite: source.depthWrite,
      side: source.side,
      toneMapped: source.toneMapped,
      emissive: std.emissive,
      emissiveIntensity: std.emissiveIntensity,
    }
    if (map) params.map = map
    if (std.alphaTest) params.alphaTest = std.alphaTest
    if (std.emissiveMap) params.emissiveMap = std.emissiveMap
    created = new THREE.MeshLambertMaterial(params)
  } else {
    const params: THREE.MeshStandardMaterialParameters = {
      ...shared,
      roughness: std.roughness,
      metalness: std.metalness,
      emissive: std.emissive,
      emissiveIntensity: std.emissiveIntensity,
      flatShading: std.flatShading,
      envMapIntensity: std.envMapIntensity,
    }
    // 树冠这类 alphaTest 材质：合批材质必须一起带上贴图和裁剪阈值，
    // 否则叶卡片会退化成一块实心矩形。
    if (std.alphaTest) params.alphaTest = std.alphaTest
    if (map) params.map = map
    if (std.metalnessMap) params.metalnessMap = std.metalnessMap
    if (std.roughnessMap) params.roughnessMap = std.roughnessMap
    // 法线贴图以前在合并时被丢掉，合批后的楼体、路面细节直接退化成
    // 一块平色；Lambert 不支持法线贴图，这里只在 Standard 分支带上。
    if (std.normalMap) params.normalMap = std.normalMap
    const standard = new THREE.MeshStandardMaterial(params)
    if (std.normalMap) standard.normalScale.copy(std.normalScale)
    created = standard
  }
  if (source.polygonOffset) {
    created.polygonOffset = true
    created.polygonOffsetFactor = source.polygonOffsetFactor
    created.polygonOffsetUnits = source.polygonOffsetUnits
  }
  cache.set(key, created)
  return { key, baked: created }
}

/** 每个几何补一份 color 属性，值等于它原材质的颜色。 */
function bakeColor(geo: THREE.BufferGeometry, color: THREE.Color) {
  const count = geo.attributes.position.count
  const existing = geo.attributes.color
  if (existing && existing.itemSize === 3) {
    for (let i = 0; i < count; i++) {
      existing.setXYZ(
        i,
        existing.getX(i) * color.r,
        existing.getY(i) * color.g,
        existing.getZ(i) * color.b,
      )
    }
    existing.needsUpdate = true
    return
  }
  const array = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    array[i * 3] = color.r
    array[i * 3 + 1] = color.g
    array[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(array, 3))
}

type MergeJob = {
  buckets: Bucket[]
  root: THREE.Group
  /** 合并后藏起来、等换入的原件 */
  hidden: THREE.Object3D[]
  cursor: number
}

/**
 * 收集阶段：只做遍历与归类，不拷贝几何。
 * 这一步是几十毫秒级的，可以放在一帧里。
 */
function collectBucketsFrom(roots: THREE.Object3D[]): Bucket[] {
  const buckets = new Map<string, Bucket>()
  const box = new THREE.Box3()
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()

  const visit = (obj: THREE.Object3D) => {
    if (!(obj as THREE.Mesh).isMesh) return
    const mesh = obj as THREE.Mesh
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) return
    if (Array.isArray(mesh.material) || !mesh.material) return
    // 已经合过的不再参与：换昼夜重建时整场景会再排一次队
    if (mesh.userData.merged || mesh.userData.mergedAway) return
    if (isDynamic(mesh)) return
    const geo = mesh.geometry as THREE.BufferGeometry
    if (!geo || !geo.attributes.position || !geo.attributes.normal || !geo.attributes.uv) return
    const classified = classify(mesh.material)
    if (!classified) return

    if (!geo.boundingBox) geo.computeBoundingBox()
    box.copy(geo.boundingBox!).applyMatrix4(mesh.matrixWorld)
    box.getSize(size)
    box.getCenter(center)

    // 跨越多个区块的大件（楼体、地面、路面）走全局桶，靠包围球剔除。
    const spansChunks = size.x > CHUNK * 0.9 || size.z > CHUNK * 0.9
    const cell = spansChunks
      ? 'global'
      : `${Math.floor(center.x / CHUNK)}_${Math.floor(center.z / CHUNK)}`
    const lod = lodOf(mesh)
    // 属性集合与是否索引必须一致，否则 mergeGeometries 会失败。
    const layout = `${geo.index ? 'i' : 'n'}_${Object.keys(geo.attributes).sort().join(',')}`
    const key = `${cell}|${mesh.castShadow ? 1 : 0}|${layout}|${classified.key}|lod${lod ? (lod.landmark ? 'landmark' : 'building') : 'none'}`

    const existing = buckets.get(key)
    if (existing) {
      existing.geos.push(geo)
      existing.meshes.push(mesh)
      existing.renderOrder = Math.max(existing.renderOrder, mesh.renderOrder)
      existing.receiveShadow = existing.receiveShadow || mesh.receiveShadow
      return
    }
    buckets.set(key, {
      material: classified.baked,
      geos: [geo],
      meshes: [mesh],
      renderOrder: mesh.renderOrder,
      castShadow: mesh.castShadow,
      receiveShadow: mesh.receiveShadow,
      lod,
    })
  }

  for (const root of roots) {
    root.updateMatrixWorld(true)
    root.traverse(visit)
  }

  // 顶点数多的桶先做：大件（楼体、路面）先合，小构件垫后。
  // 这样即使中途被打断，屏幕上缺的也只是零星的小构件，不是整栋楼。
  return [...buckets.values()]
    .filter((bucket) => bucket.meshes.length >= 2)
    .sort((a, b) => b.meshes.length - a.meshes.length)
}

/** 合并一个桶。每个桶一次 draw call 的代价换成一次几何拷贝 + 一次 merge。 */
function mergeOneBucket(job: MergeJob): void {
  const bucket = job.buckets[job.cursor++]
  if (!bucket) return

  const baked: THREE.BufferGeometry[] = []
  for (const mesh of bucket.meshes) {
    const clone = mesh.geometry.clone()
    clone.applyMatrix4(mesh.matrixWorld)
    const source = mesh.material as THREE.MeshStandardMaterial
    if (source.color) bakeColor(clone, source.color)
    baked.push(clone)
  }
  const merged = mergeGeometries(baked, false)
  baked.forEach((geo) => geo.dispose())
  if (!merged) return
  merged.computeBoundingSphere()
  merged.computeBoundingBox()

  const mesh = new THREE.Mesh(merged, bucket.material)
  mesh.matrixAutoUpdate = false
  mesh.renderOrder = bucket.renderOrder
  mesh.castShadow = bucket.castShadow
  mesh.receiveShadow = bucket.receiveShadow
  mesh.frustumCulled = true
  mesh.userData.merged = true
  if (bucket.lod) {
    mesh.userData.buildingDetailLod = true
    mesh.userData.landmark = bucket.lod.landmark
  }
  job.root.add(mesh)

  for (const original of bucket.meshes) {
    original.visible = false
    // 合批已经把它画进合并网格了，预热时不要再单独画一遍
    original.userData.mergedAway = true
    job.hidden.push(original)
  }
}

/** 合批是否已经完成。 */
let mergeDone = false

/** 撤掉全部合并网格，把原件放回去（换昼夜时重建）。 */
function disposeJob(job: MergeJob) {
  for (const child of [...job.root.children]) {
    const mesh = child as THREE.Mesh
    mesh.removeFromParent()
    mesh.geometry.dispose()
  }
  job.root.removeFromParent()
  for (const original of job.hidden) {
    original.visible = true
    original.userData.mergedAway = false
  }
}

/**
 * 合批：等全部建完之后一次性收集，再分帧合并。
 *
 * 为什么不在建的过程中边建边合：合批会为合并后的网格新建 BufferGeometry，
 * 也就是把整座城的顶点数据再上传一遍。实测这样会让构建阶段从 3.0s 涨到 4.8s、
 * 合批墙钟涨到 5.5s，总时间从 5.3s 变成 6.4s —— 反而更慢。
 * 顺序执行（先建完再合）反而能把两段的上传分开，各自更快。
 */
export function StaticMerge({ version }: { version: number }) {
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    let cancelled = false
    let raf = 0
    let job: MergeJob | null = null
    let idleFrames = 0

    const step = () => {
      if (cancelled) return
      // 场景还在分批挂载就先不合：否则排在后面的组会漏出合批，
      // 预热也编译不到它们。要连续两帧都空才算真挂完。
      if (!buildQueueIdle()) {
        idleFrames = 0
        raf = requestAnimationFrame(step)
        return
      }
      idleFrames += 1
      if (idleFrames < 2) {
        raf = requestAnimationFrame(step)
        return
      }
      if (!job) {
        const buckets = collectBucketsFrom([scene])
        const root = new THREE.Group()
        root.name = 'static-merged'
        root.frustumCulled = false
        scene.add(root)
        job = { buckets, root, hidden: [], cursor: 0 }
        raf = requestAnimationFrame(step)
        return
      }
      // 合批的真实 CPU 只有 150ms 左右，墙钟却由帧数决定：每多一帧就要多渲染
      // 一遍还没合完的整座城（~75ms）。预算给 8ms 会摊成 34 帧，30ms 只需 9 帧。
      const deadline = performance.now() + 30
      while (job.cursor < job.buckets.length) {
        mergeOneBucket(job)
        if (performance.now() > deadline) break
      }
      if (job.cursor >= job.buckets.length) {
        mergeDone = true
        return
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (job) disposeJob(job)
      mergeDone = false
    }
  }, [scene, version])

  return null
}

/**
 * 场景预热：在片头（欢迎页）期间就开始，而不是等点击"进入城市"。
 *
 * 片头一挂上来，整座城就已经在渲染了。这些材质的 program 和贴图是分批在
 * 头几秒里首次使用的——所以卡顿发生在"开始后几秒"，跟点击入城无关。
 * 以前这里用的是 drei 的 <Preload all />：它同步 compile 全场景 + 用
 * CubeCamera 全向重渲六次，本身就是一个几百毫秒的长任务，正好就是那段卡。
 *
 * 现在改成两件不阻塞主线程的事，并在合批完成后立刻开始：
 *   1. compileAsync —— 支持 KHR_parallel_shader_compile 时由驱动后台编译；
 *   2. initTexture 逐帧上传贴图（每帧 4 张），把上传摊到片头那几秒里。
 */
const prewarm = {
  /** 已经为哪个场景跑过：StrictMode 会重挂载，不能重复跑 */
  scene: null as THREE.Scene | null,
  phase: 'idle' as 'idle' | 'compiling' | 'textures' | 'done',
  textures: [] as THREE.Texture[],
  cursor: 0,
}

/** 每帧上传的贴图张数。2048² 级别的贴图一张几毫秒，4 张是保守值。 */
/**
 * 每帧上传几张。
 *
 * 原来是 4 张。但实测一张 1k 贴图在 Safari 上要 12ms（日志里 +textures=15 对应
 * gl=185ms），4 张就是 48ms——一帧的预算只有 16ms，等于自己造了一个卡帧。
 * 降到 2 张，帧内代价压到 ~24ms，16 张贴图也就多花 4 帧。
 */
const TEXTURES_PER_FRAME = 2

/** 材质上所有可能被采样的贴图槽。漏一个，那个贴图就会在首次绘制时同步上传。 */
const TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'aoMap',
  'alphaMap',
  'bumpMap',
  'displacementMap',
  'lightMap',
  'specularMap',
  'envMap',
  'transmissionMap',
] as const

function collectTextures(scene: THREE.Scene): THREE.Texture[] {
  const seen = new Set<THREE.Texture>()
  const add = (material: THREE.Material) => {
    for (const slot of TEXTURE_SLOTS) {
      const tex = (material as unknown as Record<string, THREE.Texture | null>)[slot]
      // 分批挂载时已经逐帧传过的贴图不再重传：initTexture 是实打实的一次
      // texImage2D，重复调用等于把同一张图又上传一遍。
      if (tex && tex.isTexture && !alreadyUploaded(tex)) seen.add(tex)
    }
  }
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.material) return
    if (Array.isArray(mesh.material)) mesh.material.forEach(add)
    else add(mesh.material)
  })
  return [...seen]
}

export function ScenePrewarm() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  // 逐帧推进：合批做完 → 后台编译 → 分批上传贴图。
  // 全部拆成一帧一件小事，任何一帧都不会超过几十毫秒。
  useFrame(() => {
    if (prewarm.scene !== scene) {
      prewarm.scene = scene
      prewarm.phase = 'idle'
      prewarm.textures = []
      prewarm.cursor = 0
    }

    if (prewarm.phase === 'idle') {
      // 合批还没跑完就再等一帧：合并后的材质也要一起编译
      if (!mergeDone) return
      prewarm.phase = 'compiling'
      prewarm.textures = collectTextures(scene)
      void gl
        .compileAsync(scene, camera)
        .catch(() => undefined)
        .finally(() => {
          prewarm.phase = 'textures'
        })
      return
    }

    if (prewarm.phase !== 'textures') return
    const end = Math.min(prewarm.textures.length, prewarm.cursor + TEXTURES_PER_FRAME)
    for (let i = prewarm.cursor; i < end; i++) gl.initTexture(prewarm.textures[i])
    prewarm.cursor = end
    if (prewarm.cursor >= prewarm.textures.length) {
      prewarm.phase = 'done'
    }
  })

  return null
}
