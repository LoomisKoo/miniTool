import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { facadeGrid, type FacadeStyle } from './facade'

/**
 * 立面上的实体窗：窗套（墙色，凸出墙面）、深色窗框 + 中梃、窗台板。
 *
 * 玻璃和亮灯仍由立面着色器画在墙面上；这里只补"有厚度"的部分，
 * 窗套在玻璃上投下真实的阴影，窗才读成嵌在墙里的洞，而不是贴在墙上的色块。
 * 排窗网格与着色器同源（facadeGrid），只放整扇窗：顶层放不下、
 * 退台处被楼板截断的那一格整格不排，着色器那边同样跳过。
 */
type Props = {
  style: FacadeStyle
  width: number
  depth: number
  height: number
  base: number
  inset: number
  blank: 'x' | 'z' | 'none'
  wall: THREE.Color
}

const box = new THREE.BoxGeometry(1, 1, 1)
const frameMat = new THREE.MeshStandardMaterial({ color: '#141519', roughness: 0.6, metalness: 0.2 })

const OUT = 0.16
const T = 0.11
const FRAME = 0.07

type Inst = { p: [number, number, number]; s: [number, number, number] }

function collect({ style, width, depth, height, base, inset, blank }: Props) {
  const surround: Inst[] = []
  const frame: Inst[] = []
  const faces: Array<{ axis: 'x' | 'z'; sign: number; span: number; wallAt: number }> = []
  for (const sign of [-1, 1]) {
    if (blank !== 'z') faces.push({ axis: 'z', sign, span: width, wallAt: depth / 2 })
    if (blank !== 'x') faces.push({ axis: 'x', sign, span: depth, wallAt: width / 2 })
  }
  for (const f of faces) {
    const g = facadeGrid(style, f.span, inset)
    const top = Math.min(0.95 * g.floorH, g.sill + g.winH)
    // a：沿墙位置；y：中心高度；out：伸出墙面的中心距离；sa/sy/so：沿墙/竖向/出墙尺寸
    const put = (list: Inst[], a: number, y: number, out: number, sa: number, sy: number, so: number) => {
      const n = f.sign * (f.wallAt + out)
      list.push(
        f.axis === 'z'
          ? { p: [a, y, n], s: [sa, sy, so] }
          : { p: [n, y, a], s: [so, sy, sa] },
      )
    }
    for (let row = 0; ; row++) {
      const fl = base + row * g.floorH
      if (fl + top > height - 1.05) break
      const y0 = fl + g.sill
      const y1 = fl + top
      if (y0 < 0.05) continue
      const h = y1 - y0
      const ym = (y0 + y1) / 2
      for (const a of g.centers) {
        const w = g.winW
        put(surround, a - w / 2 - T / 2, ym + T / 2, OUT / 2, T, h + T, OUT)
        put(surround, a + w / 2 + T / 2, ym + T / 2, OUT / 2, T, h + T, OUT)
        put(surround, a, y1 + T / 2, OUT / 2, w + T * 2, T, OUT)
        put(frame, a - w / 2 + FRAME / 2, ym, 0.03, FRAME, h, 0.06)
        put(frame, a + w / 2 - FRAME / 2, ym, 0.03, FRAME, h, 0.06)
        put(frame, a, y1 - FRAME / 2, 0.03, w, FRAME, 0.06)
        put(frame, a, y0 + FRAME / 2, 0.03, w, FRAME, 0.06)
        if (w > 1.2) put(frame, a, ym, 0.03, 0.06, h, 0.06)
        put(frame, a, y0 - 0.05, 0.1, w + T * 2 + 0.12, 0.1, 0.2)
      }
    }
  }
  return { surround, frame }
}

function Instances({ list, material }: { list: Inst[]; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    list.forEach((it, i) => {
      m.compose(p.set(...it.p), q, s.set(...it.s))
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [list])
  if (!list.length) return null
  return <instancedMesh ref={ref} args={[box, material, list.length]} castShadow receiveShadow />
}

export function FacadeWindows(props: Props) {
  const { style, width, depth, height, base, inset, blank, wall } = props
  const { surround, frame } = useMemo(
    () => collect(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [style, width, depth, height, base, inset, blank],
  )
  const surroundMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: wall.clone().multiplyScalar(0.92), roughness: 0.85 }),
    [wall],
  )
  useEffect(() => () => surroundMat.dispose(), [surroundMat])
  if (style === 'glass') return null
  return (
    <group userData={{ buildingDetailLod: true }}>
      <Instances list={surround} material={surroundMat} />
      <Instances list={frame} material={frameMat} />
    </group>
  )
}
