import * as THREE from 'three'

/**
 * 海床材质：沙色 PBR + 程序化焦散光斑。
 * 焦散用三层错位的 hash-波源叠加，再叠加高度场轻微调制，让亮斑与水面同步呼吸。
 */

export interface SeabedUniforms {
  uTime: { value: number }
  uHeight: { value: THREE.Texture | null }
  uCausticScale: { value: number }
  uCausticIntensity: { value: number }
  uCausticColor: { value: THREE.Color }
  uSandColor: { value: THREE.Color }
}

export function createSeabedUniforms(): SeabedUniforms {
  return {
    uTime: { value: 0 },
    uHeight: { value: null },
    uCausticScale: { value: 5.5 },
    uCausticIntensity: { value: 1.15 },
    uCausticColor: { value: new THREE.Color('#cdfaff') },
    uSandColor: { value: new THREE.Color('#cdb98b') },
  }
}

const VERT_COMMON = /* glsl */ `
  varying vec2 vSeabedUv;
`

const FRAG_COMMON = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uHeight;
  uniform float uCausticScale;
  uniform float uCausticIntensity;
  uniform vec3 uCausticColor;
  uniform vec3 uSandColor;
  varying vec2 vSeabedUv;

  float chash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float caustic(vec2 p, float t) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float v = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 h = vec2(chash(ip + g), chash(ip + g + 19.73));
        vec2 r = g + 0.5 + 0.42 * vec2(sin(t * 0.9 + 6.2831 * h.x), cos(t * 0.75 + 6.2831 * h.y));
        float d = length(fp - r);
        v += 1.0 / (1.0 + d * d * 20.0);
      }
    }
    return pow(smoothstep(0.35, 1.05, v * 0.085), 2.0);
  }
`

export function createSeabedMaterial(u: SeabedUniforms) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.7,
  })

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_COMMON}`)
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        vec3 transformed = vec3(position);
        vSeabedUv = uv;
      `,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_COMMON}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        diffuseColor.rgb *= uSandColor;
      `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `
        #include <emissivemap_fragment>
        float ripple = texture2D(uHeight, vSeabedUv).r;
        float c = caustic(vSeabedUv * uCausticScale + ripple * 1.5, uTime);
        totalEmissiveRadiance += uCausticColor * c * uCausticIntensity;
        diffuseColor.rgb *= 0.55 + c * 0.85;
      `,
      )
  }

  material.customProgramCacheKey = () => 'resin-seabed'
  return material
}
