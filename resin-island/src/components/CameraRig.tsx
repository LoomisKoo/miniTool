import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'

const FOV = 24
/** 需要入镜的包围球半径（块体半对角线 + 一点余量） */
const FIT_RADIUS = 2.05
const MARGIN = 1.03

/** 长焦俯视机位方向（归一化），实际距离由取景自适应决定 */
const BASE_DIR = new THREE.Vector3(3.3, 2.6, 4.6).normalize()
const LOOK_AT = new THREE.Vector3(0, -0.02, 0)

const _v = new THREE.Vector3()

/**
 * 产品摄影机位：长焦俯视 + 指针视差。
 * 距离按视口宽高比自动适配（竖屏手机也保证整块入镜）。
 */
export default function CameraRig() {
  const camRef = useRef<THREE.PerspectiveCamera>(null)
  const size = useThree((s) => s.size)

  const distance = useMemo(() => {
    const vFov = THREE.MathUtils.degToRad(FOV)
    const aspect = Math.max(0.35, size.width / Math.max(1, size.height))
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const fov = Math.min(vFov, hFov)
    return (FIT_RADIUS / Math.sin(fov / 2)) * MARGIN
  }, [size.width, size.height])

  const basePos = useMemo(() => BASE_DIR.clone().multiplyScalar(distance), [distance])

  // 视口变化时直接落位，避免相机漂移
  useLayoutEffect(() => {
    const cam = camRef.current
    if (!cam) return
    cam.position.copy(basePos)
    cam.lookAt(LOOK_AT)
  }, [basePos])

  useFrame(({ pointer }) => {
    const cam = camRef.current
    if (!cam) return
    const k = distance * 0.03
    _v.copy(basePos)
    _v.x += pointer.x * k
    _v.y += pointer.y * k * 0.6
    cam.position.lerp(_v, 0.06)
    cam.lookAt(LOOK_AT)
  })

  return (
    <PerspectiveCamera
      ref={camRef}
      makeDefault
      fov={FOV}
      near={0.1}
      far={200}
      position={[basePos.x, basePos.y, basePos.z]}
    />
  )
}
