import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { ParamsProvider } from './context/ParamsContext'
import { QualityProvider, useQuality } from './hooks/useQuality'
import Scene from './components/Scene'
import Hud from './components/Hud'

function Stage() {
  const { settings } = useQuality()

  return (
    <Canvas
      dpr={settings.dpr}
      shadows
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
      camera={{ position: [3.3, 2.75, 4.7], fov: 24, near: 0.1, far: 100 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.shadowMap.type = THREE.PCFSoftShadowMap
      }}
    >
      <Scene />
    </Canvas>
  )
}

export default function App() {
  return (
    <QualityProvider>
      <ParamsProvider>
        <Stage />
        <Hud />
      </ParamsProvider>
    </QualityProvider>
  )
}
