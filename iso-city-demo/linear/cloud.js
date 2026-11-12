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
          vec3 base = mix(vec3(0.80, 0.84, 0.92), vec3(1.0, 1.0, 0.985), top);
          totalEmissiveRadiance += base * mix(0.52, 0.3, uNight) + vec3(1.0, 0.93, 0.8) * rim * mix(0.35, 0.55, uNight);
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
function puffSprites(n, noise, time) {
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
    uniforms: { uNoise: { value: noise }, uTime: time, uNight: nightU },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec3 iOff; attribute vec3 iP;
      uniform float uTime;
      varying vec2 vUv; varying float vA; varying float vSeed; varying float vY;
      void main() {
        vec3 off = iOff;
        float s = iP.y * 6.2831;
        off += vec3(sin(uTime * 0.7 + s), sin(uTime * 0.9 + s * 1.7) * 0.5, cos(uTime * 0.6 + s * 2.3)) * 0.05;
        vec4 mv = modelViewMatrix * vec4(off, 1.0);
        float a = s + uTime * 0.1 * (fract(iP.y * 7.3) - 0.5);
        vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * (position.xy * iP.x);
        mv.xy += q;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
        vUv = uv; vA = iP.z; vSeed = iP.y; vY = iOff.y;
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
        float a = 1.0 - smoothstep(0.2, 1.0, r + (nn - 0.5) * 0.7);
        a *= a * vA;
        if (a < 0.006) discard;
        // 上亮下暗：顶部近白，底部带一点冷灰蓝（积云的体积感）
        float shade = clamp(0.5 + vY * 1.25 + (nn - 0.5) * 0.45 - r * 0.12, 0.0, 1.0);
        vec3 col = mix(vec3(0.78, 0.82, 0.90), vec3(1.0, 1.0, 0.99), shade);
        // 逆光银边
        col += vec3(1.0, 0.96, 0.88) * smoothstep(0.55, 0.9, r) * (1.0 - smoothstep(0.9, 1.0, r)) * 0.12;
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
function contrailMesh(S, N) {
  const V = S * N * 2
  const geo = new THREE.BufferGeometry()
  const pos = new THREE.BufferAttribute(new Float32Array(V * 3), 3)
  const tan = new THREE.BufferAttribute(new Float32Array(V * 3), 3)
  const side = new THREE.BufferAttribute(new Float32Array(V), 1)
  const age = new THREE.BufferAttribute(new Float32Array(V).fill(1), 1)
  const wid = new THREE.BufferAttribute(new Float32Array(V), 1)
  for (const a of [pos, tan, age, wid]) a.setUsage(THREE.DynamicDrawUsage)
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
  const mat = new THREE.ShaderMaterial({
    uniforms: { uNight: nightU },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec3 aTan; attribute float aSide; attribute float aAge; attribute float aW;
      varying float vAge; varying float vAcross;
      void main() {
        vec3 wp = position;
        vec3 V = normalize(cameraPosition - wp);
        vec3 t = aTan;
        float tl = length(t);
        t = tl > 1e-5 ? t / tl : vec3(0.0, 0.0, 1.0);
        vec3 s = cross(t, V);
        float sl = length(s);
        s = sl > 1e-4 ? s / sl : vec3(0.0, 1.0, 0.0);
        // 尾迹扩散：越老越宽
        wp += s * aSide * aW * (1.0 + aAge * 2.2);
        vAge = aAge; vAcross = aSide;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uNight;
      varying float vAge; varying float vAcross;
      void main() {
        #include <logdepthbuf_fragment>
        // 横截面：中间实、两边柔
        float edge = 1.0 - smoothstep(0.05, 1.0, abs(vAcross));
        edge = edge * edge * (3.0 - 2.0 * edge);
        float fade = smoothstep(0.0, 0.025, vAge) * pow(max(1.0 - vAge, 0.0), 1.3);
        float a = edge * fade * 0.9;
        if (a < 0.004) discard;
        vec3 col = mix(vec3(1.0), vec3(0.9, 0.93, 0.98), vAge * 0.5);
        col *= mix(1.0, 0.8, uNight);
        col += vec3(0.08) * (1.0 - vAge);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 6
  return { mesh, pos, tan, age, wid }
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
  body.add(core)

  // 云絮：贴着扁椭球表面分布，顶部更多（鼓包感），外层更淡
  const NB = 78
  const B = puffSprites(NB, noise, time)
  {
    let s = 11
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < NB; i++) {
      const a = rnd() * Math.PI * 2
      const up = Math.pow(rnd(), 0.7) * 2 - 1 // 偏上半球
      const ring = Math.sqrt(Math.max(0, 1 - up * up))
      const shell = 0.72 + rnd() * 0.32
      const x = Math.cos(a) * ring * 1.12 * shell
      const z = Math.sin(a) * ring * 1.0 * shell
      const y = up * 0.42 * shell + 0.02
      B.iOff.setXYZ(i, x, y, z)
      B.iP.setXYZ(i, 0.5 + rnd() * 0.45 + (1 - shell) * 0.3, rnd(), 0.42 + (1.04 - shell) * 0.9)
    }
    B.iOff.needsUpdate = B.iP.needsUpdate = true
  }
  body.add(B.mesh)

  // 尾迹：左右两道细线 + 中间一道稍宽稍淡（云的局部坐标，+z 朝前）
  const EMIT = [[-0.9, -0.05, -0.55, 0.7], [0.9, -0.05, -0.55, 0.7], [0, -0.12, -0.95, 1.2]]
  const S = EMIT.length
  const N = 160
  const LIFE = 1.3
  const C = contrailMesh(S, N)
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
        }
      }
    }
    C.pos.needsUpdate = C.tan.needsUpdate = C.age.needsUpdate = C.wid.needsUpdate = true
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
        if (emitting) {
          heads = []
          for (let s = 0; s < S; s++) {
            ev.set(EMIT[s][0], EMIT[s][1], EMIT[s][2]).applyMatrix4(g.matrixWorld)
            const h = { x: ev.x, y: ev.y, z: ev.z, t }
            heads.push(h)
            const pts = trails[s]
            const last = pts[0]
            // 记一个轨迹点：间距随速度放大，保证 LIFE 秒的整条尾迹都装得下（巡航 ~117m，冲刺 ~400m）
            const minD = Math.max(1.2, sp3 * LIFE / (N - 24))
            if (!last || (h.x - last.x) ** 2 + (h.y - last.y) ** 2 + (h.z - last.z) ** 2 > minD * minD || t - last.t > 0.05) pts.unshift({ x: h.x, y: h.y, z: h.z, t })
          }
        }
      } else emitting = false
      // 老点：微微上飘 + 过期删除
      let total = 0
      for (const pts of trails) {
        while (pts.length && (t - pts[pts.length - 1].t > LIFE || pts.length > N - 1)) pts.pop()
        for (const p of pts) p.y += dt * 0.25
        total += pts.length
      }
      if (!total && !heads) { C.mesh.visible = false; return }
      C.mesh.visible = writeTrails(t, heads) || !!heads
      void moving
    },
  }
}
