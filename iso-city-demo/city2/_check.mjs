import * as THREE from 'three'
const noop = () => {}
const grad = () => ({ addColorStop: noop })
const ctx = new Proxy(
  { measureText: (t) => ({ width: [...String(t)].length * 10 }), createLinearGradient: grad, createRadialGradient: grad, createPattern: () => null, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)) }), putImageData: noop, createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)) }), canvas: null },
  { get: (t, k) => (k in t ? t[k] : noop), set: () => true }
)
globalThis.document = { createElement: () => { const c = { width: 1, height: 1, style: {}, getContext: () => ctx }; ctx.canvas = c; return c } }
globalThis.window = globalThis
globalThis.self = globalThis
const { buildWorld } = await import('./world.js')
const { buildLife } = await import('./life.js')
const scene = new THREE.Scene()
const w = await buildWorld(scene, () => {})
const life = buildLife(scene, w)
life.update(1 / 60, 0.1, { x: 0, y: 0, z: 0 })
for (const o of scene.children) {
  if (o.type === 'Group') {
    for (const m of o.children) {
      if (!m.isInstancedMesh) continue
      const ic = m.instanceColor
      let black = 0
      if (ic) for (let i = 0; i < m.count; i++) { if (ic.array[i * 3] + ic.array[i * 3 + 1] + ic.array[i * 3 + 2] < 0.05) black++ }
      const ca = m.geometry.attributes.color
      console.log(m.geometry.type, 'count', m.count, 'icol', ic ? ic.count : 'none', 'black', black, 'mat', m.material.type,
        'i0', ic ? Array.from(ic.array.slice(0, 6)).map(v => +v.toFixed(3)) : null,
        'vc0', ca ? Array.from(ca.array.slice(0, 6)).map(v => +v.toFixed(3)) : null)
    }
  }
}
