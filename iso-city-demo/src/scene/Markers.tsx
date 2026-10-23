import { useEffect, useMemo, useRef } from 'react'
import { Billboard, Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { walker } from '../game/walker'
import { useApp } from '../store'
import { makeBeamTexture, makeGlowTexture } from './textures'

export type MarkerTone = 'place' | 'entrance' | 'space' | 'kiosk'

const TONE: Record<MarkerTone, string> = {
  place: '#8fd0ff',
  entrance: '#a9bfd6',
  space: '#c3b6ff',
  kiosk: '#ffce9a',
}


/** 入口传送门：地面上的一池光 + 两圈反向旋转的光环 + 一根软光柱。
    视觉上对应"这个门可以进"，比悬空的标签更容易被发现。 */
export function EntrancePortal({
  x,
  z,
  color = '#9fd8ff',
  strength = 1,
}: {
  x: number
  z: number
  color?: string
  strength?: number
}) {
  const poolTex = useMemo(() => makeGlowTexture(color), [color])
  const beamTex = useMemo(() => makeBeamTexture(), [])
  useEffect(
    () => () => {
      poolTex.dispose()
      beamTex.dispose()
    },
    [poolTex, beamTex],
  )

  const pool = useRef<THREE.Mesh>(null)
  const ringA = useRef<THREE.Mesh>(null)
  const ringB = useRef<THREE.Mesh>(null)
  const ringC = useRef<THREE.Mesh>(null)
  const beam = useRef<THREE.Sprite>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const pulse = 1 + Math.sin(t * 1.7) * 0.05
    if (pool.current) {
      ;(pool.current.material as THREE.MeshBasicMaterial).opacity = (0.34 + Math.sin(t * 1.5) * 0.06) * strength
    }
    if (ringA.current) {
      ringA.current.rotation.z = t * 0.55
      ringA.current.scale.setScalar(pulse)
    }
    if (ringB.current) ringB.current.rotation.z = -t * 0.9
    if (ringC.current) ringC.current.rotation.z = t * 0.32
    if (beam.current) {
      const material = beam.current.material as THREE.SpriteMaterial
      material.opacity = (0.16 + Math.sin(t * 1.3) * 0.045) * strength
    }
  })

  return (
    <group position={[x, 0, z]} userData={{ dynamic: true }}>
      {/* 地面光池 */}
      <mesh ref={pool} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[5.2, 5.2]} />
        <meshBasicMaterial
          map={poolTex}
          color={color}
          transparent
          opacity={0.34}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* 主环 + 内环 + 极细的扫描环 */}
      <mesh ref={ringA} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[1.26, 1.44, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6 * strength}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ringB} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <ringGeometry args={[0.9, 0.99, 52]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.34 * strength}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ringC} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.62, 1.66, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.26 * strength}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* 软光柱：把门和上方的标签连起来 */}
      <sprite ref={beam} position={[0, 1.5, 0]} scale={[3.1, 3.2, 1]}>
        <spriteMaterial
          map={beamTex}
          color={color}
          transparent
          opacity={0.16 * strength}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
    </group>
  )
}

type Props = {
  x: number
  y?: number
  z: number
  title: string
  subtitle?: string
  tone?: MarkerTone
  glyph?: string
  /** 与 interactables 对应的 id：命中时气泡高亮，提示可以按 E。 */
  actionId?: string
  onOpen: () => void
}

export function Marker({
  x,
  y = 2.4,
  z,
  title,
  tone = 'place',
  actionId,
  onOpen,
}: Props) {
  const nearRef = useRef<HTMLDivElement>(null)
  const eRef = useRef<HTMLElement>(null)
  const farRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<THREE.Group>(null)
  const dotRef = useRef<THREE.Mesh>(null)
  const color = TONE[tone]

  useFrame((state, delta) => {
    const distance = Math.hypot(walker.position.x - x, walker.position.z - z)
    const active = Boolean(actionId) && useApp.getState().nearby?.id === actionId
    // 远处的发光点不画：整城几十个地点各几个 mesh 就是上百次 draw call。
    if (rootRef.current) rootRef.current.visible = distance < 60

    const near = nearRef.current
    const far = farRef.current

    if (near) {
      const show = distance < 26 || active
      near.style.opacity = show ? '1' : '0'
      // 只做"淡入 + 微微上浮"，垂直居中和横向偏移交给 CSS 的 transform，
      // 两者互不覆盖；高亮只改描边与光晕，不改变尺寸和布局。
      near.style.translate = show ? '0 0px' : '0 8px'
      near.style.pointerEvents = show ? 'auto' : 'none'
      near.classList.toggle('is-active', active)
      if (eRef.current) eRef.current.style.visibility = show ? 'visible' : 'hidden'
    }
    if (far) {
      const show = !active && distance >= 26 && distance < 110
      far.style.opacity = show ? '0.55' : '0'
      far.style.pointerEvents = show ? 'auto' : 'none'
    }

    const t = state.clock.elapsedTime
    if (dotRef.current) {
      const s = active ? 1.5 : 1
      dotRef.current.scale.setScalar(THREE.MathUtils.damp(dotRef.current.scale.x, s, 8, delta))
      ;(dotRef.current.material as THREE.MeshBasicMaterial).opacity = active ? 1 : 0.78
    }
  })

  return (
    <group ref={rootRef} position={[x, y, z]} userData={{ dynamic: true }}>
      <Billboard>
        <mesh ref={dotRef}>
          <circleGeometry args={[0.075, 18]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} toneMapped={false} depthWrite={false} />
        </mesh>
      </Billboard>

      {/* 气泡挂在标记的右侧：不压住标记本身，也不改变画面对标记的判读。 */}
      <Html position={[0, 0, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
        <div className="ar-tag-anchor">
          <div
            ref={nearRef}
            className={`ar-tag tone-${tone}`}
            style={{ transition: 'opacity 200ms var(--ar-ease), translate 260ms var(--ar-ease)' }}
            onClick={(event) => {
              event.stopPropagation()
              onOpen()
            }}
          >
            <b>{title}</b>
          </div>
          <kbd ref={eRef} className="ar-tag-e" aria-hidden="true">
            <span>E</span>
          </kbd>
        </div>
      </Html>

      <Html position={[0, 0, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[19, 0]}>
        <div className="ar-tag-anchor">
          <div
            ref={farRef}
            className="ar-far"
            style={{ transition: 'opacity 240ms var(--ar-ease)' }}
            onClick={(event) => {
              event.stopPropagation()
              onOpen()
            }}
          >
            {title}
          </div>
        </div>
      </Html>
    </group>
  )
}
