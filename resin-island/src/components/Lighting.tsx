import { useMemo } from 'react'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { useQuality } from '../hooks/useQuality'
import { useParams } from '../context/ParamsContext'

function sunPosition(azimuth: number, elevation: number, radius = 9) {
  const az = THREE.MathUtils.degToRad(azimuth)
  const el = THREE.MathUtils.degToRad(elevation)
  return new THREE.Vector3(
    radius * Math.cos(el) * Math.cos(az),
    radius * Math.sin(el),
    radius * Math.cos(el) * Math.sin(az),
  )
}

/** 产品摄影布光：studio 环境光 + 可调的太阳主光 + 一盏很弱的背光补边 */
export default function Lighting() {
  const { settings } = useQuality()
  const { params } = useParams()

  const sunPos = useMemo(() => sunPosition(params.sun.azimuth, params.sun.elevation), [params.sun.azimuth, params.sun.elevation])

  return (
    <>
      <ambientLight intensity={0.32} />
      <hemisphereLight args={['#fdf6e6', '#7a7466', 0.35]} />

      <directionalLight
        position={sunPos}
        intensity={params.sun.intensity}
        castShadow
        shadow-mapSize-width={settings.shadowMap}
        shadow-mapSize-height={settings.shadowMap}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-3.2}
        shadow-camera-right={3.2}
        shadow-camera-top={3.2}
        shadow-camera-bottom={-3.2}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
      />

      <directionalLight position={[-5, 3.2, -4.5]} intensity={0.45} color="#cfe9e4" />
      <directionalLight position={[0.5, -3, 2]} intensity={0.12} color="#ffffff" />

      <Environment preset="studio" />
    </>
  )
}
