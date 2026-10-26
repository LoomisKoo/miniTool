import { useMemo, useRef } from 'react'
import { Billboard, Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { walker } from '../game/walker'
import { useApp } from '../store'
import { makeGlowTexture } from './textures'

export type MarkerTone = 'place' | 'entrance' | 'space' | 'kiosk'

const TONE: Record<MarkerTone, string> = {
  place: '#8fd0ff',
  entrance: '#a9bfd6',
  space: '#c3b6ff',
  kiosk: '#ffce9a',
}


/** 入口提示：地面上一小圈柔光 + 一圈极细的扫描环。
 *
 * 原来叠了三层光环加一根光柱，加起来像贴在门口的霓虹贴纸，亮度还盖过地面
 * 材质。现在只留"踩上去能看见"的最低限度：池子缩到 3.4m、透明度减半，
 * 只保留一圈细环缓慢转动，光柱去掉。
 */
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
  // 贴图按颜色共享（makeGlowTexture 里有缓存），这里不能 dispose，
  // 否则一个门口卸载会把别处同色的光池一起清掉。
  const poolTex = useMemo(() => makeGlowTexture(color), [color])

  const pool = useRef<THREE.Mesh>(null)
  const ringA = useRef<THREE.Mesh>(null)
  const ringB = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (pool.current) {
      ;(pool.current.material as THREE.MeshBasicMaterial).opacity = (0.12 + Math.sin(t * 1.1) * 0.02) * strength
    }
    if (ringA.current) ringA.current.rotation.z = t * 0.35
    if (ringB.current) ringB.current.rotation.z = -t * 0.6
  })

  return (
    <group position={[x, 0, z]} userData={{ dynamic: true }}>
      {/* 地面光池 */}
      <mesh ref={pool} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[3.4, 3.4]} />
        <meshBasicMaterial
          map={poolTex}
          color={color}
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* 一圈细环：转速很慢，只是让门口"活"着 */}
      <mesh ref={ringA} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.94, 1.0, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.22 * strength}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {/* 外圈断续的一段弧，作为方向感，而不是第二个完整光环 */}
      <mesh ref={ringB} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
        <ringGeometry args={[1.28, 1.31, 64, 1, 0, Math.PI * 0.55]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.16 * strength}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
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
      // 只有走到跟前才展开名字：满城挂气泡是"游戏说明书"，不是城市
      const show = distance < 13 || active
      near.style.opacity = show ? '1' : '0'
      // 只做"淡入 + 微微上浮"，垂直居中和横向偏移交给 CSS 的 transform，
      // 两者互不覆盖；高亮只改描边与光晕，不改变尺寸和布局。
      near.style.translate = show ? '0 0px' : '0 8px'
      near.style.pointerEvents = show ? 'auto' : 'none'
      near.classList.toggle('is-active', active)
      // E 只在真的能按的时候出现：小房间里出口标记永远在 26m 以内，
      // 以前人物旁边就一直挂着一个 E。
      // 用 opacity 而不是 visibility：子元素写 visibility:visible 会盖过休眠场景
      // 外层的 visibility:hidden，进楼后城里的 E 就一直悬在画面上。
      if (eRef.current) eRef.current.style.opacity = active ? '1' : '0'
    }
    if (far) {
      const show = !active && distance >= 13 && distance < 46
      // 越远越淡，天边不留一圈标签
      far.style.opacity = show ? String(0.62 * (1 - (distance - 13) / 33)) : '0'
      far.style.pointerEvents = show ? 'auto' : 'none'
    }

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

/**
 * 只在可交互时出现的小提示：「门号 / 名字 + E」连成一条。
 * 平时不显示任何气泡，门号本身已经印在门牌上。
 * text 省略时只显示一个 E 圆标——门牌就在旁边，再写一遍编号是重复信息。
 */
export function PromptTag({
  x,
  y,
  z,
  text,
  actionId,
}: {
  x: number
  y: number
  z: number
  text?: string
  actionId: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const eRef = useRef<HTMLElement>(null)
  useFrame(() => {
    const el = ref.current
    if (!el) return
    const active = useApp.getState().nearby?.id === actionId
    // 走近就出现，比交互半径宽一点：先看到"这里有人可以聊"，
    // 再走进 E 的判定范围。以前只在能按 E 的那一刻才出现，几乎是贴脸才看见。
    const distance = Math.hypot(walker.position.x - x, walker.position.z - z)
    // 只在交互半径附近才出现：以前 9m 就亮起"按 E"，但判定只有 4.5m，
    // 站在 6~8m 按 E 什么都不会发生，看起来就像"对话没反应"。
    const show = active || distance < 6.5
    el.style.opacity = show ? '1' : '0'
    el.style.translate = show ? '0 0' : '0 6px'
    el.style.pointerEvents = show ? 'auto' : 'none'
    el.classList.toggle('is-active', active)
    if (eRef.current) eRef.current.style.opacity = active ? '1' : '0.35'
  })
  return (
    <group position={[x, y, z]}>
      <Html center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
        <div
          ref={ref}
          className={text ? 'prompt-tag' : 'prompt-tag is-icon'}
          style={{ opacity: 0 }}
          onClick={(event) => {
            // 标签本身可以直接点：鼠标没被锁定的时候不用先按 E
            event.stopPropagation()
            const { nearby } = useApp.getState()
            if (nearby?.id === actionId) nearby.action()
          }}
        >
          {text ? <span>{text}</span> : null}
          <kbd ref={eRef}>E</kbd>
        </div>
      </Html>
    </group>
  )
}
