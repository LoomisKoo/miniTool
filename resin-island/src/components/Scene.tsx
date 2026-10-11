import { Suspense } from 'react'
import { ContactShadows, PerformanceMonitor } from '@react-three/drei'
import { useQuality } from '../hooks/useQuality'
import CameraRig from './CameraRig'
import Lighting from './Lighting'
import JellyGroup from './JellyGroup'
import ResinBlock from './ResinBlock'
import PostFX from './PostFX'

export default function Scene() {
  const { settings, setLevel } = useQuality()

  return (
    <>
      <color attach="background" args={['#ece5d8']} />

      <CameraRig />
      <Lighting />

      <Suspense fallback={null}>
        <JellyGroup>
          <ResinBlock />
        </JellyGroup>
      </Suspense>

      <ContactShadows
        position={[0, -0.66, 0]}
        opacity={0.44}
        scale={9}
        blur={2.6}
        far={3.2}
        resolution={settings.level === 'high' ? 512 : 256}
        color="#3b352c"
        frames={settings.level === 'high' ? Infinity : 1}
      />

      <PostFX />

      <PerformanceMonitor
        flipflops={2}
        onDecline={() => setLevel('low')}
        onIncline={() => setLevel('high')}
      />
    </>
  )
}
