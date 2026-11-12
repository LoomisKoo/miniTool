import * as THREE from 'three'
import { nightU } from './mat.js'

/**
 * 筋斗云 v5：只是一团云
 *  - 一朵积云：中心大团 + 一圈小团 + 顶上三团鼓包（低模实心，脚下可踩），底部压扁
 *  - 外面裹一层柔边公告板云絮（噪声侵蚀边缘、上亮下暗、缓慢翻涌）→ 体积感、没有硬边
 *  - 没有云尾 / 云卷等多余部件
 *  - 拖尾：移动时从云后两侧 + 中间拉出三道细细的白色"飞机尾迹"，越远越宽越淡，停下后自然散掉
 */
const CORE = [
  [0, 0, 0, 0.8],
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + 0.26
    return [Math.cos(a) * 0.66, -0.07, Math.sin(a) * 0.6, 0.5 - (i % 2) * 0.06]
  }),
  [0.18, 0.26, 0.12, 0.46], [-0.24, 0.22, -0.06, 0.42], [0.06, 0.2, -0.3, 0.4],
]

function coreMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, envMapIntensity: 0.5 })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = nightU
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLY;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vLY = (instanceMatrix * vec4(position, 1.0)).y;
        #else
          vLY = position.y;
        #endif`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vLY;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 Vv = normalize(vViewPosition);
          float rim = pow(1.0 - clamp(abs(dot(normalize(vNormal), Vv)), 0.0, 1.0), 2.0);
          float top = smoothstep(-0.4, 0.45, vLY);
          vec3 base = mix(vec3(0.94, 0.96, 1.0), vec3(1.0), top);
          totalEmissiveRadiance += base * mix(0.85, 0.3, uNight) + vec3(1.0, 0.95, 0.86) * rim * mix(0.42, 0.55, uNight);
        }`)
  }
  return m
}

/** 可平铺的 fbm 值噪声（R 通道），给云絮边缘侵蚀用 */
function noiseTexture() {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  const rnd = (i, j, p) => {
    const x = ((i % p) + p) % p
    const y = ((j % p) + p) % p
    const h = Math.sin(x * 127.1 + y * 311.7 + p * 74.7) * 43758.5453
    return h - Math.floor(h)
  }
  const vn = (u, v, p) => {
    const x = u * p
    const y = v * p
    const i = Math.floor(x)
    const j = Math.floor(y)
    let fx = x - i
    let fy = y - j
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    const a = rnd(i, j, p)
    const b = rnd(i + 1, j, p)
    const cc = rnd(i, j + 1, p)
    const d = rnd(i + 1, j + 1, p)
    return (a + (b - a) * fx) * (1 - fy) + (cc + (d - cc) * fx) * fy
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S
      const v = y / S
      const n = vn(u, v, 4) * 0.5 + vn(u, v, 8) * 0.27 + vn(u, v, 16) * 0.15 + vn(u, v, 32) * 0.08
      const o = (y * S + x) * 4
      const b = Math.max(0, Math.min(255, n * 255)) | 0
      img.data[o] = img.data[o + 1] = img.data[o + 2] = b
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.NoColorSpace
  return t
}

/**
 * 柔边云絮公告板（实例化四边形，云的局部空间）：iOff 位置 · iP = (尺寸, 种子, 不透明度)
 */
function puffSprites(n, noise, time, stretchU) {
  const base = new THREE.PlaneGeometry(1, 1)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = base.index
  geo.setAttribute('position', base.attributes.position)
  geo.setAttribute('uv', base.attributes.uv)
  const iOff = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
  const iP = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
  geo.setAttribute('iOff', iOff)
  geo.setAttribute('iP', iP)
  geo.instanceCount = n
  const mat = new THREE.ShaderMaterial({
    uniforms: { uNoise: { value: noise }, uTime: time, uNight: nightU, uStretch: stretchU },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec3 iOff; attribute vec3 iP;
      uniform float uTime; uniform float uStretch;
      varying vec2 vUv; varying float vA; varying float vSeed; varying float vY;
      void main() {
        vec3 off = iOff;
        float s = iP.y * 6.2831;
        off += vec3(sin(uTime * 0.7 + s), sin(uTime * 0.9 + s * 1.7) * 0.5, cos(uTime * 0.6 + s * 2.3)) * 0.06;
        // t34 头尾：云后半（局部 -z）行进时被拖长、变大变淡，像彗尾一样化开；前半（头）保持圆润，同样软边
        float back = clamp(-off.z, 0.0, 1.6);
        off.z -= uStretch * back * back * 1.7;
        off.y += uStretch * back * 0.12 + uStretch * back * back * 0.08 * sin(uTime * 1.3 + s);
        off.x *= 1.0 - uStretch * smoothstep(0.2, 1.4, back) * 0.35;
        float sz = iP.x * (1.0 + uStretch * back * 0.7);
        vec4 mv = modelViewMatrix * vec4(off, 1.0);
        float a = s + uTime * 0.1 * (fract(iP.y * 7.3) - 0.5);
        vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * (position.xy * sz);
        mv.xy += q;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
        vUv = uv; vSeed = iP.y; vY = iOff.y;
        vA = iP.z * (1.0 - uStretch * smoothstep(0.25, 1.7, back) * 0.75);
      }`,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uNoise; uniform float uTime; uniform float uNight;
      varying vec2 vUv; varying float vA; varying float vSeed; varying float vY;
      void main() {
        #include <logdepthbuf_fragment>
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        float n1 = texture2D(uNoise, vUv * 0.6 + vec2(vSeed * 3.1, vSeed * 1.7) + vec2(uTime * 0.015, 0.0)).r;
        float n2 = texture2D(uNoise, vUv * 1.4 - vec2(vSeed * 2.3, uTime * 0.03)).r;
        float nn = n1 * 0.62 + n2 * 0.38;
        // t34：高斯软核（没有圆形硬边）+ 噪声侵蚀；大量云絮大面积重叠 → 连成一整团体积，数不出单个球
        float d = r + (nn - 0.5) * 0.6;
        float a = clamp((exp(-d * d * 3.4) - 0.034) / 0.966, 0.0, 1.0);
        a *= vA;
        if (a < 0.004) discard;
        // 体积光：伪法线 + 局部高度，上亮下暗，只在团内缓变
        float nz = sqrt(max(0.0, 1.0 - r * r));
        float ny = (vUv.y - 0.5) * 2.0;
        // 云是「自发光的天光散射体」，不该被当成白漆球去受光：底色直接抬到 0.93，
        // 阴面也只压到 0.9 —— 之前底部 0.80 + 混合蓝天空色的透明叠加，整团看着发灰。
        float shade = clamp(0.60 + vY * 1.1 + ny * 0.18 * nz + (nn - 0.5) * 0.3, 0.0, 1.0);
        vec3 col = mix(vec3(0.93, 0.95, 1.0), vec3(1.0, 1.0, 1.0), shade);
        col *= mix(1.0, 0.6, uNight);
        col += vec3(0.95, 0.85, 0.65) * 0.08 * uNight;
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 5
  return { mesh, iOff, iP }
}

/**
 * 飞机尾迹：S 条世界空间飘带（每条 N 个点 × 2 顶点），顶点着色器里朝镜头展开成细带；
 * 一次 draw。越老越宽越淡，头部淡入（从云后面"长"出来）
 */
function contrailMesh(S, N, time, fadeU) {
  const V = S * N * 2
  const geo = new THREE.BufferGeometry()
  const pos = new THREE.BufferAttribute(new Float32Array(V * 3), 3)
  const tan = new THREE.BufferAttribute(new Float32Array(V * 3), 3)
  const side = new THREE.BufferAttribute(new Float32Array(V), 1)
  const age = new THREE.BufferAttribute(new Float32Array(V).fill(1), 1)
  const wid = new THREE.BufferAttribute(new Float32Array(V), 1)
  // 沿轨迹的里程（米，跟着世界点走）：给边缘起伏 / 烟团噪声做坐标，花纹不随云滑动
  const len = new THREE.BufferAttribute(new Float32Array(V), 1)
  for (const a of [pos, tan, age, wid, len]) a.setUsage(THREE.DynamicDrawUsage)
  for (let i = 0; i < V; i++) side.array[i] = i % 2 ? 1 : -1
  const idx = []
  for (let s = 0; s < S; s++) {
    for (let i = 0; i < N - 1; i++) {
      const a = (s * N + i) * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  geo.setIndex(idx)
  geo.setAttribute('position', pos)
  geo.setAttribute('aTan', tan)
  geo.setAttribute('aSide', side)
  geo.setAttribute('aAge', age)
  geo.setAttribute('aW', wid)
  geo.setAttribute('aL', len)
  const mat = new THREE.ShaderMaterial({
    uniforms: { uNight: nightU, uTime: time, uFade: fadeU },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float uTime; uniform float uFade;
      attribute vec3 aTan; attribute float aSide; attribute float aAge; attribute float aW; attribute float aL;
      varying float vAge; varying float vAcross; varying float vL;
      void main() {
        vec3 wp = position;
        vec3 V = normalize(cameraPosition - wp);
        vec3 t = aTan;
        float tl = length(t);
        t = tl > 1e-5 ? t / tl : vec3(0.0, 0.0, 1.0);
        vec3 s = cross(t, V);
        float sl = length(s);
        s = sl > 1e-4 ? s / sl : vec3(0.0, 1.0, 0.0);
        // 烟团起伏：沿里程两组慢波叠加，宽窄不一（不再是一根等宽的硬管子）
        float puff = 0.8 + 0.2 * sin(aL * 0.42 - uTime * 2.2) + 0.12 * sin(aL * 1.25 + uTime * 1.4);
        // 越老越散越宽；停下后整体再慢慢摊开（像烟在空气里化开）
        float grow = 1.0 + aAge * 1.5 + uFade * 1.8;
        float taper = mix(0.45, 1.0, 1.0 - smoothstep(0.6, 1.0, aAge));
        wp += s * aSide * aW * puff * grow * taper;
        vAge = aAge; vAcross = aSide; vL = aL;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uNight; uniform float uTime; uniform float uFade;
      varying float vAge; varying float vAcross; varying float vL;
      void main() {
        #include <logdepthbuf_fragment>
        // 横截面：中间实、两边柔；边缘按里程/时间起伏 → 毛边、不是一刀直线
        float wob = 0.22 * sin(vL * 0.9 + uTime * 2.3 + vAcross * 1.7) + 0.14 * sin(vL * 2.6 - uTime * 3.1);
        float across = abs(vAcross) * (1.0 + wob * (0.6 + vAge));
        float edge = clamp((exp(-across * across * 3.0) - 0.05) / 0.95, 0.0, 1.0);
        // 头部从云后淡入，尾部长长地淡出（不再 2.2 次方一下就没了）
        float fade = smoothstep(0.0, 0.26, vAge) * pow(max(1.0 - vAge, 0.0), 1.6);
        // 停下后：整条慢慢变淡，并碎成一团团（烟散开），不是瞬间消失
        float br = 0.5 + 0.5 * sin(vL * 1.6 + uTime * 1.1) * sin(vL * 0.55 - uTime * 0.7);
        float dis = pow(max(1.0 - uFade, 0.0), 1.5) * mix(1.0, 0.45 + 0.55 * br, uFade);
        float a = edge * fade * dis * 0.55;
        if (a < 0.004) discard;
        vec3 col = mix(vec3(1.0), vec3(0.9, 0.93, 0.98), vAge * 0.5);
        col *= mix(1.0, 0.8, uNight);
        col += vec3(0.08) * (1.0 - vAge) * (1.0 - uFade);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 6
  return { mesh, pos, tan, age, wid, len }
}

export function buildCloud(scene) {
  const g = new THREE.Group()
  g.name = 'cloud'
  g.visible = false
  scene.add(g)
  const body = new THREE.Group()
  g.add(body)

  const time = { value: 0 }
  const noise = noiseTexture()

  // 一团积云的实心芯（底部压扁）
  const mat = coreMaterial()
  const core = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), mat, CORE.length)
  const dm = new THREE.Object3D()
  CORE.forEach(([x, y, z, r], i) => {
    dm.position.set(x, y, z)
    dm.scale.set(r, r * 0.72, r)
    dm.updateMatrix()
    core.setMatrixAt(i, dm.matrix)
  })
  // t34：实心芯不再画（10 个不透明球 + 边缘光就是「一颗颗棉花球」的来源）；体积全部交给软云絮
  core.visible = false
  body.add(core)

  // 云絮：贴着扁椭球表面分布，顶部更多（鼓包感），外层更淡
  const NB = 150
  const stretchU = { value: 0 }
  const B = puffSprites(NB, noise, time, stretchU)
  {
    let s = 11
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < NB; i++) {
      // 三层：内核（大、密、几乎不透明）/ 中层鼓包（偏上）/ 外层絮丝（淡、偏下）
      const layer = i < 50 ? 0 : i < 112 ? 1 : 2
      const a = rnd() * Math.PI * 2
      const up = layer === 1 ? Math.pow(rnd(), 0.6) * 2 - 1 : layer === 2 ? rnd() * 1.4 - 1 : rnd() * 2 - 1
      const ring = Math.sqrt(Math.max(0, 1 - up * up))
      const shell = layer === 0 ? 0.2 + rnd() * 0.42 : layer === 1 ? 0.66 + rnd() * 0.3 : 0.95 + rnd() * 0.3
      const x = Math.cos(a) * ring * 1.12 * shell
      let z = Math.sin(a) * ring * 1.06 * shell
      const y = up * (layer === 2 ? 0.3 : 0.4) * shell + 0.02
      // 头部（+z）收圆、尾部（-z）略拉长
      if (z < 0) z *= 1.18
      const head = z > 0.5 ? 0.82 : 1
      const size = (layer === 0 ? 1.0 + rnd() * 0.35 : layer === 1 ? 0.62 + rnd() * 0.36 : 0.5 + rnd() * 0.32) * head
      const op = layer === 0 ? 0.8 + rnd() * 0.15 : layer === 1 ? 0.5 + rnd() * 0.2 : 0.16 + rnd() * 0.14
      B.iOff.setXYZ(i, x, y, z)
      B.iP.setXYZ(i, size, rnd(), op)
    }
    B.iOff.needsUpdate = B.iP.needsUpdate = true
  }
  body.add(B.mesh)

  // 尾迹：左右两道细线 + 中间一道稍宽稍淡（云的局部坐标，+z 朝前）
  // t34：发射点藏进云体后半（尾迹从云里化出来，不是从表面插出三根管）；更宽更淡
  const EMIT = [[-0.55, -0.04, -0.7, 0.95], [0.55, -0.04, -0.7, 0.95], [0, -0.1, -0.95, 1.5]]
  const S = EMIT.length
  const N = 120
  // 行进中：寿命 0.85s、最长 40m（比 t25 之前 100m+ 的长尾短，但能看清是一道尾迹）
  const LIFE = 0.85
  const MAX_LEN = 40
  // 停下后：已有尾迹留在原地，约 1.9s 内慢慢变淡、摊开、上飘，像烟散掉
  const LINGER = 1.9
  const fadeU = { value: 0 }
  const odo = EMIT.map(() => 0)
  const C = contrailMesh(S, N, time, fadeU)
  C.mesh.name = 'contrail'
  scene.add(C.mesh)
  const trails = EMIT.map(() => [])
  const ev = new THREE.Vector3()
  let emitting = false

  function writeTrails(now, heads) {
    let any = false
    for (let s = 0; s < S; s++) {
      const pts = trails[s]
      const w0 = EMIT[s][3]
      const base = s * N * 2
      const list = heads ? [heads[s], ...pts] : pts
      const n = Math.min(N, list.length)
      for (let i = 0; i < N; i++) {
        const k = Math.min(i, n - 1)
        const p = k >= 0 ? list[k] : null
        const v = base + i * 2
        if (!p || i >= n) {
          // 空槽：退化到最后一点、完全透明
          const q = p || { x: 0, y: -9999, z: 0 }
          for (const o of [v, v + 1]) {
            C.pos.setXYZ(o, q.x, q.y, q.z)
            C.age.setX(o, 1)
            C.wid.setX(o, 0)
            C.len.setX(o, q.l || 0)
          }
          continue
        }
        const a = list[Math.max(0, k - 1)]
        const b = list[Math.min(n - 1, k + 1)]
        const ag = Math.min(1, (now - p.t) / LIFE)
        if (ag < 1) any = true
        for (const o of [v, v + 1]) {
          C.pos.setXYZ(o, p.x, p.y, p.z)
          C.tan.setXYZ(o, a.x - b.x, a.y - b.y, a.z - b.z)
          C.age.setX(o, ag)
          C.wid.setX(o, w0)
          C.len.setX(o, p.l || 0)
        }
      }
    }
    C.pos.needsUpdate = C.tan.needsUpdate = C.age.needsUpdate = C.wid.needsUpdate = C.len.needsUpdate = true
    return any
  }

  return {
    group: g,
    update(dt, t, px, py, pz, moving, vx = 0, vz = 0, vy = 0) {
      time.value = t
      const sp = Math.hypot(vx, vz)
      const sp3 = Math.hypot(vx, vy, vz)
      let heads = null
      if (g.visible) {
        g.position.set(px, py - 0.5 + Math.sin(t * 1.5) * 0.05, pz)
        const yaw = sp > 0.5 ? Math.atan2(vx, vz) : g.rotation.y
        g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt * 10)
        body.rotation.x = Math.min(0.08, sp * 0.0012)
        g.updateMatrixWorld()
        emitting = sp3 > 3
        const st = Math.min(1, Math.max(0, (sp3 - 2) / 26))
        stretchU.value += (st - stretchU.value) * Math.min(1, dt * (st > stretchU.value ? 3 : 1.4))
        if (emitting) {
          heads = []
          for (let s = 0; s < S; s++) {
            ev.set(EMIT[s][0], EMIT[s][1], EMIT[s][2]).applyMatrix4(g.matrixWorld)
            const pts = trails[s]
            const last = pts[0]
            const dl = last ? Math.hypot(ev.x - last.x, ev.y - last.y, ev.z - last.z) : 0
            const h = { x: ev.x, y: ev.y, z: ev.z, t, l: odo[s] + dl }
            heads.push(h)
            // 记一个轨迹点：整条尾迹大约几十米（巡航约 30m，冲刺上限 MAX_LEN）
            const minD = Math.max(0.9, sp3 * LIFE / (N - 20))
            if (!last || dl > minD || t - last.t > 0.05) {
              odo[s] += dl
              pts.unshift({ x: h.x, y: h.y, z: h.z, t, l: odo[s], dx: 0, dz: 0 })
            }
          }
        }
      } else emitting = false
      // 停下 / 下云：不再加速老化（以前 p.t -= dt*1.8 + 0.48s 寿命 → 不到 0.2s 整条没了）。
      // 改成：老化放慢到 35%，整条用 uFade 在 LINGER 秒内淡掉，同时摊宽、上飘、轻微横向飘散
      if (emitting) fadeU.value = Math.max(0, fadeU.value - dt * 4)
      else fadeU.value = Math.min(1, fadeU.value + dt / LINGER)
      let total = 0
      for (let s = 0; s < S; s++) {
        const pts = trails[s]
        if (!emitting) {
          for (let i = 0; i < pts.length; i++) {
            const p = pts[i]
            p.t += dt * 0.65
            // 烟散开：每个点按里程给一个缓慢的横向飘移
            p.dx += Math.sin(p.l * 0.37 + s * 2.1) * dt * 0.35
            p.dz += Math.cos(p.l * 0.29 + s * 1.3) * dt * 0.35
            p.x += p.dx * dt
            p.z += p.dz * dt
            p.y += dt * 0.35
          }
          if (fadeU.value >= 1) pts.length = 0
        }
        while (pts.length) {
          const oldP = pts[pts.length - 1]
          const young = pts[0]
          const len = emitting && young && oldP ? Math.hypot(young.x - oldP.x, young.y - oldP.y, young.z - oldP.z) : 0
          if (t - oldP.t > LIFE || pts.length > N - 1 || len > MAX_LEN) pts.pop()
          else break
        }
        for (const p of pts) p.y += dt * 0.2
        total += pts.length
      }
      if (!total && !heads) { C.mesh.visible = false; fadeU.value = 0; return }
      C.mesh.visible = writeTrails(t, heads) || !!heads
      void moving
    },
  }
}
