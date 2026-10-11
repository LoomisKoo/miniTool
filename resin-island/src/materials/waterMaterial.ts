import * as THREE from 'three'

/**
 * 水面材质：在 MeshStandardMaterial 上注入顶点位移 + 梯度法线 + 深浅混色 + 岸边泡沫。
 * 保留官方 PBR 管线，因此能吃到 scene.environment 的环境反射与定向光高光。
 */

export interface WaterUniforms {
  uHeight: { value: THREE.Texture | null }
  uTime: { value: number }
  uTexel: { value: THREE.Vector2 }
  uWaveHeight: { value: number }
  uDeepColor: { value: THREE.Color }
  uShallowColor: { value: THREE.Color }
  uIslandCenter: { value: THREE.Vector2 }
  uIslandRadius: { value: number }
  uFoam: { value: number }
}

export function createWaterUniforms(): WaterUniforms {
  return {
    uHeight: { value: null },
    uTime: { value: 0 },
    uTexel: { value: new THREE.Vector2(1 / 256, 1 / 256) },
    uWaveHeight: { value: 0.12 },
    uDeepColor: { value: new THREE.Color('#0a4038') },
    uShallowColor: { value: new THREE.Color('#3fd8c6') },
    uIslandCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uIslandRadius: { value: 0.3 },
    uFoam: { value: 0.5 },
  }
}

/** 1x1 全零高度场，避免首帧 sampler 为空 */
export function createBlankHeightTexture() {
  const data = new Float32Array([0, 0, 0, 1])
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat, THREE.FloatType)
  tex.needsUpdate = true
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

const VERT_COMMON = /* glsl */ `
  uniform sampler2D uHeight;
  uniform float uTime;
  uniform vec2 uTexel;
  uniform float uWaveHeight;
  varying vec2 vWaveUv;
  varying float vWaveHeight;

  float idleWave(vec2 p, float t) {
    return sin(p.x * 7.0 + t * 1.1) * 0.5
         + sin(p.y * 6.3 - t * 0.9) * 0.5
         + sin((p.x + p.y) * 11.0 + t * 1.6) * 0.25;
  }
`

const FRAG_COMMON = /* glsl */ `
  uniform sampler2D uHeight;
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec2 uIslandCenter;
  uniform float uIslandRadius;
  uniform float uFoam;
  varying vec2 vWaveUv;
  varying float vWaveHeight;
`

export function createWaterMaterial(u: WaterUniforms) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.045,
    metalness: 0.0,
    transparent: true,
    opacity: 0.68,
    envMapIntensity: 1.7,
    depthWrite: false,
  })

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_COMMON}`)
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
        vec2 wuv0 = uv;
        float hC = texture2D(uHeight, wuv0).r;
        float hL = texture2D(uHeight, wuv0 - vec2(uTexel.x, 0.0)).r;
        float hR = texture2D(uHeight, wuv0 + vec2(uTexel.x, 0.0)).r;
        float hD = texture2D(uHeight, wuv0 - vec2(0.0, uTexel.y)).r;
        float hU = texture2D(uHeight, wuv0 + vec2(0.0, uTexel.y)).r;
        float gradX = (hR - hL) * 0.5 / uTexel.x;
        float gradZ = (hU - hD) * 0.5 / uTexel.y;
        float idleGrad = idleWave(wuv0, uTime) * 0.004;
        vec3 objectNormal = normalize(vec3(
          -(gradX * uWaveHeight * 2.0 + idleGrad),
          1.0,
          -(gradZ * uWaveHeight * 2.0 + idleGrad)
        ));
        vWaveUv = wuv0;
        vWaveHeight = hC;
      `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        vec3 transformed = vec3(position);
        float hv = texture2D(uHeight, uv).r;
        transformed.y += hv * uWaveHeight + idleWave(uv, uTime) * 0.004;
      `,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_COMMON}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        vec2 wuv = vWaveUv;
        float edge = min(min(wuv.x, 1.0 - wuv.x), min(wuv.y, 1.0 - wuv.y));
        float dIsland = distance(wuv, uIslandCenter);
        float shore = 1.0 - smoothstep(uIslandRadius * 0.15, uIslandRadius * 1.35, dIsland);
        float rim = 1.0 - smoothstep(0.0, 0.24, edge);
        float shallow = clamp(max(shore, rim), 0.0, 1.0);
        diffuseColor.rgb = mix(uDeepColor, uShallowColor, shallow);

        float crest = smoothstep(0.08, 0.42, abs(vWaveHeight));
        float foamEdge = 1.0 - smoothstep(0.0, 0.1, edge);
        float foamShore = smoothstep(0.72, 1.0, shore);
        float foam = clamp(foamEdge * 0.55 + foamShore * 0.9 + crest * 0.45, 0.0, 1.0) * uFoam;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.99, 0.97), foam * 0.85);
      `,
      )
  }

  material.customProgramCacheKey = () => 'resin-water'
  return material
}
