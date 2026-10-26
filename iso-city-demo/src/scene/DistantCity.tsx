import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { CITY_BOUNDS, WALK_BOUNDS } from '../data/city'
import { seeded } from './theme'

/**
 * 城外的高楼群：街区四周一圈 60~260m 的塔楼，让街道有"峡谷感"，
 * 天边有连续的天际线。全部是一个 InstancedMesh，窗格在着色器里按世界坐标算。
 *
 * 质感的关键不在窗子本身，而在窗子"周围"：
 * 窗洞要有退进的侧壁、窗台要有亮边、窗下要有滴水痕、楼层之间要有楼板带，
 * 楼顶要有女儿墙压顶和屋顶设备。没有这些，一栋塔就是一整块黑板贴满亮方块。
 */

type Tower = {
  x: number
  z: number
  w: number
  d: number
  h: number
  /** 墙面基色（每栋都不同：混凝土、石灰岩、深色玻璃） */
  tone: THREE.Color
  seed: number
}

function makeTowers(): Tower[] {
  const rnd = seeded('distant-city-v2')
  const out: Tower[] = []
  const inner = CITY_BOUNDS + 26
  // 城外的高楼不能压进可行走范围：它们没有碰撞体，人走进去会直接穿墙。
  // 以前内圈半径 174m、而 WALK_BOUNDS 是 196m，有三十来栋塔正好落在城里，
  // 其中一栋还跨在河面上——"水里那栋能穿过去的楼"就是它。
  const safe = WALK_BOUNDS + 4
  // 三种真实城市里最常见的墙面：暖石灰岩、冷混凝土、深色幕墙
  const TONES = ['#8e8879', '#9a9690', '#7d848c', '#6f7680', '#a29785', '#5d6670']
  for (let i = 0; i < 230; i++) {
    const a = rnd() * Math.PI * 2
    // 越靠近城区越密、越高：近处形成一堵楼墙，远处慢慢稀疏
    const r = inner + Math.pow(rnd(), 1.6) * 230
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const near = 1 - (r - inner) / 230
    const tall = rnd() < 0.12
    const h = tall ? 170 + rnd() * 110 : 45 + Math.pow(rnd(), 1.4) * 120 * (0.6 + near * 0.6)
    const w = 18 + rnd() * 22
    const d = 18 + rnd() * 22
    // 体量伸进城就整栋不要：这些楼只是布景，没有碰撞
    if (x - w / 2 < safe && x + w / 2 > -safe && z - d / 2 < safe && z + d / 2 > -safe) continue
    if (out.some((t) => Math.abs(t.x - x) < (t.w + w) / 2 + 4 && Math.abs(t.z - z) < (t.d + d) / 2 + 4)) continue
    const tone = new THREE.Color(TONES[Math.floor(rnd() * TONES.length)])
    // 每栋再偏一点点：完全同色的楼群最像 CG 预览图
    tone.offsetHSL((rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.12)
    out.push({ x, z, w, d, h, tone, seed: rnd() * 100 })
  }
  return out
}

function towerMaterial(night: boolean) {
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.82,
    metalness: 0.06,
    // 楼墙也要吃环境反射：没有天空反光的墙面永远是"哑光塑料"
    envMapIntensity: night ? 0.55 : 0.9,
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = { value: night ? 1 : 0 }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vTW;\nvarying vec3 vTN;\nvarying float vTSeed;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vTW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vTN = normalize(mat3(instanceMatrix) * objectNormal);
        vTSeed = float(gl_InstanceID);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        varying vec3 vTW;
        varying vec3 vTN;
        varying float vTSeed;
        float th(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        // 值噪声：墙面的脏污、雨痕用
        float tn(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(th(i), th(i + vec2(1,0)), f.x), mix(th(i + vec2(0,1)), th(i + vec2(1,1)), f.x), f.y);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float vertical = step(abs(vTN.y), 0.5);
          float along = abs(vTN.x) > abs(vTN.z) ? vTW.z : vTW.x;
          float u0 = along / 3.0;
          float v0 = vTW.y / 3.7;
          vec2 f = vec2(fract(u0), fract(v0));
          vec2 fw = max(vec2(fwidth(u0), fwidth(v0)) * 1.35, 0.0035);

          // ---- 开间划分：竖向柱垛 + 窗洞 ----
          // 窗洞 0.20~0.80，两侧留 0.20 的柱垛；窗高 0.26~0.86
          float wx = smoothstep(0.20 - fw.x, 0.20 + fw.x, f.x) * (1.0 - smoothstep(0.80 - fw.x, 0.80 + fw.x, f.x));
          float wy = smoothstep(0.26 - fw.y, 0.26 + fw.y, f.y) * (1.0 - smoothstep(0.86 - fw.y, 0.86 + fw.y, f.y));
          float win = wx * wy * vertical * step(4.5, vTW.y);

          // ---- 窗框：洞口内侧一圈深色铝框 ----
          // 这是"真窗"最强的线索。没有框，窗就是贴在墙上的发光矩形。
          float inX = smoothstep(0.20 - fw.x, 0.20 + fw.x, f.x) * (1.0 - smoothstep(0.80 - fw.x, 0.80 + fw.x, f.x));
          float deepX = smoothstep(0.235 - fw.x, 0.235 + fw.x, f.x) * (1.0 - smoothstep(0.765 - fw.x, 0.765 + fw.x, f.x));
          float inY = smoothstep(0.26 - fw.y, 0.26 + fw.y, f.y) * (1.0 - smoothstep(0.86 - fw.y, 0.86 + fw.y, f.y));
          float deepY = smoothstep(0.305 - fw.y, 0.305 + fw.y, f.y) * (1.0 - smoothstep(0.815 - fw.y, 0.815 + fw.y, f.y));
          float frame = clamp((inX - deepX) + (inY - deepY), 0.0, 1.0) * vertical * step(4.5, vTW.y);

          // ---- 窗台：洞口下沿一条挑出的亮边，并在下方拖一道滴水痕 ----
          float sill = (1.0 - smoothstep(0.26 - fw.y, 0.26 + fw.y, f.y)) * smoothstep(0.215 - fw.y, 0.215 + fw.y, f.y)
                     * smoothstep(0.15 - fw.x, 0.15 + fw.x, f.x) * (1.0 - smoothstep(0.85 - fw.x, 0.85 + fw.x, f.x));
          float drip = (1.0 - smoothstep(0.215 - fw.y, 0.215 + fw.y, f.y)) * smoothstep(0.10 - fw.y, 0.10 + fw.y, f.y) * wx;

          // ---- 楼层线：楼板外沿一条阴影带 ----
          float slab = smoothstep(0.0, 0.02, f.y) * (1.0 - smoothstep(0.02, 0.05, f.y)) * vertical;
          // ---- 竖向柱垛的高光边（受光侧亮、背光侧暗） ----
          float pier = (1.0 - wx) * vertical;

          // ---- 墙面材质：噪声脏污 + 竖向雨痕 ----
          // 噪声按像素足迹淡出：远处的高频脏污会闪成沙粒噪点
          float nfade = 1.0 - smoothstep(0.02, 0.16, max(fw.x, fw.y));
          float grime = mix(0.72, 1.0, tn(vec2(along * 0.55, vTW.y * 0.09) + vTSeed * 3.1));
          float streakA = mix(0.88, 1.0, tn(vec2(along * 2.4, vTW.y * 0.05) + vTSeed * 1.7));
          float wallTone = mix(1.0, grime * streakA, nfade);

          // ---- 玻璃（窗框以内的部分） ----
          float glass = win * (1.0 - frame);
          vec2 cell = vec2(floor(u0), floor(v0));
          // 灯按"户/租户"成片亮：同一层连续 3~6 个开间是一家，一起开一起关。
          // 逐格随机点亮就是一张打孔卡，真实夜景里亮窗是一段一段的横条。
          float unitW = 3.0 + floor(th(vec2(cell.y * 0.37, vTSeed * 1.3)) * 4.0);
          float unit = floor((cell.x + floor(th(vec2(cell.y, vTSeed * 2.1)) * 5.0)) / unitW);
          float unitPick = th(vec2(unit, cell.y) + vTSeed * 7.13);
          float officeFloor = step(0.93, th(vec2(cell.y, vTSeed)));
          // 塔楼上部常常整段没人：按楼层分段压低亮灯率
          float zone = th(vec2(floor(cell.y / 6.0), vTSeed * 4.7));
          float cellLit = max(step(unitPick, 0.12 + 0.2 * zone), officeFloor);
          // 亮着的户里也有个别房间没开灯
          cellLit *= step(0.14, th(cell * 1.7 + vTSeed * 2.7));
          float lit = cellLit * glass;
          // 亮度按户变化，不按窗：同一家的窗色温和亮度是一致的
          float vary = 0.45 + 0.9 * th(vec2(unit * 1.31, cell.y) + vTSeed);
          vec3 warm = vec3(1.0, 0.74, 0.46);
          vec3 neutral = vec3(1.0, 0.9, 0.76);
          vec3 cool = vec3(0.74, 0.86, 1.0);
          float tPick = th(vec2(unit, cell.y * 1.9) + vTSeed * 3.3);
          vec3 litCol = mix(mix(warm, neutral, step(0.55, tPick)), cool, max(officeFloor, step(0.93, tPick)));
          litCol *= vary;
          // 视差：视线越往上看，越能看到天花板（亮）；往下看是地板（暗）
          vec3 V = normalize(vTW - cameraPosition);
          float ceilLine = clamp(0.62 - V.y * 0.55, 0.25, 0.95);
          float roomShade = mix(0.32, 1.0, smoothstep(ceilLine - 0.25, ceilLine + 0.08, f.y));
          roomShade *= mix(0.55, 1.0, smoothstep(0.26, 0.36, f.y));
          // 吸顶灯热点：窗户上沿靠中间最亮
          roomShade += 0.5 * exp(-pow((f.x - 0.5) * 3.2, 2.0)) * smoothstep(0.6, 0.84, f.y);
          // 部分户拉了百叶：细横纹 + 整体变暗
          float blind = step(0.72, th(vec2(unit * 2.3, cell.y * 0.7) + vTSeed * 5.9));
          roomShade *= mix(1.0, 0.55 + 0.25 * step(0.5, fract(f.y * 22.0)), blind);

          // 未开灯：深蓝玻璃，靠菲涅尔吃一点天光；纯黑就是贴纸
          float fres = pow(1.0 - clamp(abs(vTN.y) + 0.4, 0.0, 1.0), 2.0);
          vec3 darkGlass = vec3(0.028, 0.034, 0.045) + vec3(0.09, 0.11, 0.14) * fres;

          // ---- 合成墙面 ----
          diffuseColor.rgb *= wallTone;
          // 檐口 / 柱垛受光面稍亮，形成竖向节奏
          diffuseColor.rgb *= mix(1.0, 1.1, pier);
          // 楼层板带压暗
          diffuseColor.rgb *= 1.0 - slab * 0.35;
          // 窗下滴水痕（脏、发暗）
          diffuseColor.rgb *= 1.0 - drip * 0.22;
          // 窗台亮边
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.55 + vec3(0.03, 0.028, 0.024), sill);
          // 窗框：深色铝 + 一点点镜面（靠 roughness 在标准材质里已有，这里只压色）
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045, 0.048, 0.052), frame * 0.9);
          // 玻璃本体：窗洞内侧压暗一圈，让玻璃"退进墙里"
          diffuseColor.rgb = mix(diffuseColor.rgb, darkGlass, glass * 0.88);
          // 楼脚的城市光反弹：街灯、车灯、被照亮的沥青都往上打光，
          // 所以塔楼底部一定比塔顶暖、比塔顶亮。限在 30m 以内，
          // 再高就不是"被街灯照亮"而是整栋土黄了。
          diffuseColor.rgb += vec3(0.042, 0.03, 0.018) * (1.0 - smoothstep(4.0, 30.0, vTW.y)) * uNight;

          // ---- 夜间墙体的城市天光 ----
          // 夜里楼不是纯黑剪影：低云把城市灯光反射回来，墙面有一层很暗的漫射光，
          // 底部偏暖（街灯/橱窗），越往上越冷越暗。没有这层，楼就是一块黑板贴亮方块。
          // 暖色只留在最低那一段：以前整栋楼从脚到底都吃这层橙，远看一排塔全是土黄，
          // 配合暖色雾就成了"傍晚"。现在暖色衰减得快，往上迅速转冷。
          float hN = smoothstep(0.0, 70.0, vTW.y);
          vec3 skyGlow = mix(vec3(0.075, 0.055, 0.038), vec3(0.022, 0.028, 0.045), hN);
          totalEmissiveRadiance += diffuseColor.rgb * skyGlow * (1.0 - glass) * uNight * 2.0;
          // 亮窗的光溢到窗台和窗洞侧壁上
          totalEmissiveRadiance += litCol * cellLit * (sill * 0.35 + frame * 0.18) * uNight;

          // ---- 发光：只有开了灯的窗 ----
          totalEmissiveRadiance += litCol * lit * uNight * roomShade * 0.95;
          // 白天玻璃反射天光（比墙略亮一点），夜里不开灯的窗交给 darkGlass
          totalEmissiveRadiance += vec3(0.03, 0.036, 0.045) * glass * (1.0 - uNight);
        }`,
      )
      .replace(
        '#include <fog_fragment>',
        `#ifdef USE_FOG
        {
          // 高度雾：贴地的空气被街灯照得发亮，楼脚融进雾里、楼顶清晰。
          // 线性距离雾在 100~200m 只有两成，远楼和近楼一样黑一样锐，没有空气感。
          float hd = length(vTW - cameraPosition);
          float hfall = exp(-max(vTW.y, 0.0) / mix(90.0, 55.0, uNight));
          float haze = (1.0 - exp(-hd * 0.0042)) * mix(0.25, 1.0, hfall) * mix(0.45, 0.7, uNight);
          // 雾色不再乘大系数：乘 1.7 会把暖色的远楼和天边一起提亮，
          // 那就是图里"天边一圈昏黄"的直接来源。夜里雾应比天空暗。
          vec3 hazeCol = fogColor * mix(1.0, 1.15, hfall * uNight);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeCol, haze);
        }
        #endif
        #include <fog_fragment>`,
      )
  }
  mat.customProgramCacheKey = () => `distant-tower-v4-${night ? 'n' : 'd'}`
  return mat
}

export function DistantCity({ night }: { night: boolean }) {
  const towers = useMemo(makeTowers, [])
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1)
    g.translate(0, 0.5, 0)
    return g
  }, [])
  const material = useMemo(() => towerMaterial(night), [night])

  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, material, towers.length)
    const mtx = new THREE.Matrix4()
    const c = new THREE.Color()
    towers.forEach((t, i) => {
      m.setMatrixAt(i, mtx.makeScale(t.w, t.h, t.d).setPosition(t.x, 0, t.z))
      // 夜间压暗但仍保留各栋的色相差异：同色的楼群最像 CG 预览
      c.copy(t.tone)
      if (night) c.multiplyScalar(0.72)
      m.setColorAt(i, c)
    })
    m.instanceColor!.needsUpdate = true
    m.frustumCulled = false
    m.userData.dynamic = true
    return m
  }, [geo, material, towers, night])

  // 屋顶女儿墙压顶：比塔身外扩 0.7m、高 1.1m。
  // 一排没有压顶的方盒子在楼顶看过去就是"积木"。
  const cornice = useMemo(() => {
    const m = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ color: night ? '#3b3f45' : '#b3aca0', roughness: 0.9, metalness: 0.05 }),
      towers.length,
    )
    const mtx = new THREE.Matrix4()
    towers.forEach((t, i) => m.setMatrixAt(i, mtx.makeScale(t.w + 1.4, 1.1, t.d + 1.4).setPosition(t.x, t.h - 0.9, t.z)))
    m.frustumCulled = false
    m.userData.dynamic = true
    return m
  }, [geo, towers, night])

  // 屋顶设备：水箱、空调机组、楼梯间出屋面。楼顶视角下这是"有人用"的证据。
  const rooftop = useMemo(() => {
    const rnd = seeded('distant-roof-clutter')
    const items: Array<{ p: [number, number, number]; s: [number, number, number] }> = []
    for (const t of towers) {
      const n = 1 + Math.floor(rnd() * 3)
      for (let k = 0; k < n; k++) {
        const sw = 2 + rnd() * Math.min(9, t.w * 0.45)
        const sd = 2 + rnd() * Math.min(9, t.d * 0.45)
        const sh = 1.4 + rnd() * 3.6
        items.push({
          p: [t.x + (rnd() - 0.5) * (t.w - sw - 2), t.h - 0.3, t.z + (rnd() - 0.5) * (t.d - sd - 2)],
          s: [sw, sh, sd],
        })
      }
    }
    const m = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ color: night ? '#2b2e33' : '#8d8b86', roughness: 0.95, metalness: 0.04 }),
      items.length,
    )
    const mtx = new THREE.Matrix4()
    items.forEach((it, i) => m.setMatrixAt(i, mtx.makeScale(it.s[0], it.s[1], it.s[2]).setPosition(it.p[0], it.p[1], it.p[2])))
    m.frustumCulled = false
    m.userData.dynamic = true
    return m
  }, [geo, towers, night])

  // 高塔顶上的红色航空灯
  const beacons = useMemo(() => towers.filter((t) => t.h > 150), [towers])

  useEffect(
    () => () => {
      material.dispose()
      cornice.material.dispose()
      rooftop.material.dispose()
    },
    [material, cornice, rooftop],
  )
  useEffect(() => () => geo.dispose(), [geo])

  return (
    <group userData={{ dynamic: true }}>
      <primitive object={mesh} />
      <primitive object={cornice} />
      <primitive object={rooftop} />
      {/* 城外地面：城市底盘只有 560m，外面这圈楼要有地可站 */}
      {/* 做成圆环：中间留给城市底盘和河道，不能盖住比地面低的河面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <ringGeometry args={[279, 900, 72, 1]} />
        <meshStandardMaterial color={night ? '#121212' : '#7d8285'} roughness={1} />
      </mesh>
      {night &&
        beacons.map((t, i) => (
          <mesh key={i} position={[t.x, t.h + 1.2, t.z]}>
            <sphereGeometry args={[0.9, 8, 6]} />
            <meshBasicMaterial color="#ff3b30" toneMapped={false} />
          </mesh>
        ))}
    </group>
  )
}
