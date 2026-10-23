import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { BuildingDef } from '../data/city'
import { useApp } from '../store'
import { makeSignTexture } from './textures'
import { bodyColor, palettes, seeded, type Palette } from './theme'
import { useFrame } from '@react-three/fiber'
import { GlowDisc } from './GlowDisc'
import { createFacadeMaterial } from './facade'

type Props = { def: BuildingDef }

/** 切角八边形体量：把方盒子四个角削掉，剪影立刻不再是"四四方方"。
    所有窗框仍贴在四个正面上，所以不影响窗户布置。 */
function massGeometry(w: number, d: number, h: number, chamfer: number) {
  const cw = w / 2
  const cd = d / 2
  const c = Math.max(0.4, Math.min(chamfer, Math.min(cw, cd) * 0.42))
  const shape = new THREE.Shape()
  shape.moveTo(-cw + c, -cd)
  shape.lineTo(cw - c, -cd)
  shape.lineTo(cw, -cd + c)
  shape.lineTo(cw, cd - c)
  shape.lineTo(cw - c, cd)
  shape.lineTo(-cw + c, cd)
  shape.lineTo(-cw, cd - c)
  shape.lineTo(-cw, -cd + c)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, steps: 1 })
  geo.rotateX(-Math.PI / 2)
  geo.computeVertexNormals()
  return geo
}

function Roof({ def, width, depth, top, palette }: { def: BuildingDef; width: number; depth: number; top: number; palette: Palette }) {
  const metal = palette.key === 'night' ? '#33465a' : '#9b9b92'
  const cone = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!cone.current) return
    const t = state.clock.elapsedTime
    const mat = cone.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 1.4 + Math.sin(t * 2.2 + width) * 0.5
  })

  return (
    <group position={[0, top, 0]}>
      {/* 女儿墙 */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.3, 0.7, depth + 0.3]} />
        <meshStandardMaterial color={palette.trim} roughness={0.72} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[width - 0.4, 0.14, depth - 0.4]} />
        <meshStandardMaterial color={palette.key === 'night' ? '#16222f' : '#b3b8b7'} roughness={0.85} />
      </mesh>

      {def.roof === 'mechanical' && (
        <>
          <mesh position={[-width * 0.16, 2.0, -depth * 0.16]} castShadow>
            <boxGeometry args={[width * 0.3, 1.9, depth * 0.26]} />
            <meshStandardMaterial color={metal} roughness={0.6} metalness={0.35} />
          </mesh>
          <mesh position={[width * 0.22, 1.5, depth * 0.18]} castShadow>
            <boxGeometry args={[width * 0.18, 1.1, depth * 0.18]} />
            <meshStandardMaterial color={metal} roughness={0.6} metalness={0.35} />
          </mesh>
          <mesh position={[width * 0.3, 2.6, -depth * 0.2]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 1.4, 14]} />
            <meshStandardMaterial color={metal} roughness={0.7} metalness={0.3} />
          </mesh>
          <mesh position={[-width * 0.3, 2.6, depth * 0.22]}>
            <cylinderGeometry args={[0.07, 0.07, 3, 6]} />
            <meshStandardMaterial color={palette.trim} />
          </mesh>
          {/* 屋顶空调外机阵列 */}
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i} position={[width * (0.05 + i * 0.06), 1.35, -depth * 0.32]} castShadow>
              <boxGeometry args={[0.9, 0.7, 0.9]} />
              <meshStandardMaterial color={metal} roughness={0.65} metalness={0.4} />
            </mesh>
          ))}
        </>
      )}

      {def.roof === 'garden' && (
        <>
          {[-0.26, 0.02, 0.3].map((t, i) => (
            <group key={i} position={[t * width, 0, (i % 2 ? 1 : -1) * depth * 0.22]}>
              <mesh position={[0, 1.2, 0]} castShadow>
                <boxGeometry args={[1.4, 0.7, 1.4]} />
                <meshStandardMaterial color={palette.trim} roughness={0.9} />
              </mesh>
              <mesh position={[0, 2.2, 0]} castShadow>
                <icosahedronGeometry args={[1.5, 1]} />
                <meshStandardMaterial color={palette.tree} roughness={1} flatShading />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 1.15, 0]} castShadow>
            <boxGeometry args={[width * 0.32, 0.5, depth * 0.26]} />
            <meshStandardMaterial color={palette.trim} roughness={0.92} />
          </mesh>
        </>
      )}

      {def.roof === 'antenna' && (
        <>
          <mesh position={[0, 1.9, 0]} castShadow>
            <boxGeometry args={[width * 0.2, 1.8, depth * 0.2]} />
            <meshStandardMaterial color={metal} roughness={0.6} metalness={0.35} />
          </mesh>
          <mesh position={[width * 0.22, 5.4, 0]}>
            <cylinderGeometry args={[0.08, 0.14, 7, 8]} />
            <meshStandardMaterial color={palette.trim} metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[width * 0.22, 9.0, 0]}>
            <sphereGeometry args={[0.24, 12, 12]} />
            <meshStandardMaterial color="#9fe8ff" emissive="#5fd8ff" emissiveIntensity={2.4} toneMapped={false} />
          </mesh>
        </>
      )}

      {def.roof === 'crown' && (
        <>
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[width * 0.72, 1.6, depth * 0.72]} />
            <meshStandardMaterial color={palette.key === 'night' ? '#35516a' : '#9fb3b8'} roughness={0.35} metalness={0.6} />
          </mesh>
          <mesh position={[0, 2.32, 0]}>
            <boxGeometry args={[width * 0.76, 0.12, depth * 0.76]} />
            <meshBasicMaterial color={palette.ar} toneMapped={false} />
          </mesh>
          <mesh position={[0, 8.4, 0]}>
            <cylinderGeometry args={[0.1, 0.36, 12, 10]} />
            <meshStandardMaterial color={palette.trim} metalness={0.55} roughness={0.4} />
          </mesh>
          <mesh ref={cone} userData={{ noMerge: true }} position={[0, 14.6, 0]}>
            <sphereGeometry args={[0.34, 14, 14]} />
            <meshStandardMaterial color="#d8f8ff" emissive="#6fe2ff" emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </>
      )}
    </group>
  )
}

function Balconies({ def, width, depth, palette }: { def: BuildingDef; width: number; depth: number; palette: Palette }) {
  const floors = useMemo(() => {
    const count = Math.max(2, Math.min(6, Math.floor(def.h / 9)))
    return Array.from({ length: count }).map((_, i) => 8 + i * 5.4)
  }, [def.h])

  return (
    <group>
      {floors.map((y, fi) =>
        [-0.3, 0.02, 0.32].map((t, ci) => (
          <group key={`${fi}-${ci}`} position={[t * width, y, depth / 2 + 0.62]}>
            <mesh castShadow>
              <boxGeometry args={[Math.min(2.8, width * 0.24), 0.16, 1.3]} />
              <meshStandardMaterial color={palette.trim} roughness={0.8} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.52, 0.58]}>
              <boxGeometry args={[Math.min(2.8, width * 0.24) - 0.16, 0.12, 0.06]} />
              <meshStandardMaterial color={palette.key === 'night' ? '#3d5468' : '#8e9ba3'} metalness={0.6} roughness={0.35} />
            </mesh>
            {[-1, -0.5, 0, 0.5, 1].map((k) => (
              <mesh key={k} position={[(k * Math.min(2.6, width * 0.22)) / 2, 0.3, 0.58]}>
                <boxGeometry args={[0.035, 0.55, 0.035]} />
                <meshStandardMaterial color={palette.key === 'night' ? '#3d5468' : '#8e9ba3'} metalness={0.6} roughness={0.4} />
              </mesh>
            ))}
            {ci !== 1 && (
              <mesh position={[0, 0.36, 0]}>
                <boxGeometry args={[0.34, 0.4, 0.34]} />
                <meshStandardMaterial color={palette.tree} roughness={1} />
              </mesh>
            )}
          </group>
        )),
      )}
    </group>
  )
}

/** 檐口：两三层向外叠出的石材线脚。真实建筑最有辨识度的轮廓细节，
    也是"方盒子"和"建筑"之间最省成本的一道分界。 */
function Cornice({ width, depth, y, palette }: { width: number; depth: number; y: number; palette: Palette }) {
  const stone = palette.key === 'night' ? '#3a4d60' : '#cdd3d2'
  const shadow = palette.key === 'night' ? '#22303f' : '#9aa4a6'
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, -0.06, 0]} castShadow>
        <boxGeometry args={[width + 0.16, 0.12, depth + 0.16]} />
        <meshStandardMaterial color={shadow} roughness={0.82} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <boxGeometry args={[width + 0.62, 0.26, depth + 0.62]} />
        <meshStandardMaterial color={stone} roughness={0.72} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.34, 0]} castShadow>
        <boxGeometry args={[width + 0.34, 0.14, depth + 0.34]} />
        <meshStandardMaterial color={stone} roughness={0.66} metalness={0.14} />
      </mesh>
    </group>
  )
}

/** 墙基：深色石材勒脚，让楼体"扎"进地面，而不是浮着。 */
function Plinth({ width, depth, palette }: { width: number; depth: number; palette: Palette }) {
  return (
    <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
      <boxGeometry args={[width + 0.3, 0.56, depth + 0.3]} />
      <meshStandardMaterial
        color={palette.key === 'night' ? '#1c2833' : '#9aa19c'}
        roughness={0.78}
        metalness={0.16}
      />
    </mesh>
  )
}

export function Building({ def }: Props) {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk

  const podium = def.setback ? 5.6 : 0
  const bodyW = def.setback ? def.w * 0.86 : def.w
  const bodyD = def.setback ? def.d * 0.86 : def.d
  const bodyH = Math.max(4, def.h - podium)
  const side = def.entranceSide || 'south'
  const signTexture = useMemo(
    () => (def.sign ? makeSignTexture(def.sign, def.signColor || '#12232f') : null),
    [def.sign, def.signColor],
  )
  useEffect(() => () => signTexture?.dispose(), [signTexture])

  const baseColor = useMemo(() => bodyColor(def.body, palette), [def.body, palette])

  // 玻璃塔切角更大，砖石楼只轻微削角；同一街区也有强弱变化。
  const chamfer = useMemo(() => {
    const rnd = seeded(def.id + '-mass')
    const base = def.style === 'glass' ? 0.1 : 0.06
    return Math.min(Math.min(bodyW, bodyD) * (base + rnd() * 0.05), 3.4)
  }, [def.id, def.style, bodyW, bodyD])


  // 程序化立面：窗户、窗台、楼层线与夜间灯光都在着色器里算完，
  // 一栋楼只剩这一个材质 / 一次 draw call。
  const bodyMaterial = useMemo(
    () =>
      createFacadeMaterial({
        wall: baseColor,
        trim: palette.trim,
        glass: def.style === 'glass' ? palette.glass : palette.windowDark,
        litWarm: palette.windowLit[0],
        litCool: palette.windowLit[2],
        style: def.style,
        night: palette.key === 'night',
        width: def.setback ? def.w * 0.86 : def.w,
        depth: def.setback ? def.d * 0.86 : def.d,
        height: Math.max(4, def.h - (def.setback ? 5.6 : 0)),
        base: def.setback ? 4.4 : 3.6,
        inset: chamfer + 0.5,
        // 临街面一定有窗；背面按种子留山墙，街区看着才不像四面都开满窗的模型
        blank:
          seeded(def.id + '-gable')() > 0.55
            ? def.entranceSide === 'east' || def.entranceSide === 'west'
              ? 'z'
              : 'x'
            : 'none',
        seed: seeded(def.id + '-facade')(),
      }),
    [baseColor, def.style, def.id, def.w, def.d, def.h, def.setback, palette],
  )
  useEffect(() => () => bodyMaterial.dispose(), [bodyMaterial])

  const faceWidth = Math.min(side === 'east' || side === 'west' ? bodyD : bodyW, 10)
  const baseW = def.setback ? def.w + 1.6 : def.w
  const baseD = def.setback ? def.d + 1.6 : def.d
  const faceBase = side === 'east' ? baseW / 2 : side === 'west' ? -baseW / 2 : 0
  const faceBaseZ = side === 'south' ? baseD / 2 : side === 'north' ? -baseD / 2 : 0
  const rotation = side === 'east' ? Math.PI / 2 : side === 'west' ? -Math.PI / 2 : side === 'north' ? Math.PI : 0
  // 店面整组离墙 16cm：原来贴墙 10cm 时，店面玻璃/门框背面正好和墙面共面，
  // 走动时那条接缝会闪成一条亮线。
  const offset = 0.16
  const accent = def.accent || palette.ar

  const mass = useMemo(
    () => massGeometry(bodyW, bodyD, bodyH, chamfer),
    [bodyW, bodyH, chamfer],
  )
  useEffect(() => () => mass.dispose(), [mass])

  // 轮廓线也要跟着切角体量走，否则会在削掉的墙角外侧悬空。
  const outline = useMemo(() => {
    const edges = new THREE.EdgesGeometry(mass, 24)
    return edges
  }, [mass])

  const cap = useMemo(
    () => massGeometry(bodyW + 0.2, bodyD + 0.2, 0.16, chamfer + 0.1),
    [bodyW, bodyD, chamfer],
  )
  useEffect(() => () => cap.dispose(), [cap])

  const roofLine = useMemo(() => {
    const geo = new THREE.BoxGeometry(bodyW + 0.4, 0.5, bodyD + 0.4)
    const edges = new THREE.EdgesGeometry(geo)
    geo.dispose()
    return edges
  }, [bodyW, bodyD])

  useEffect(() => () => outline?.dispose(), [outline])

  return (
    <group position={[def.x, 0, def.z]}>
      {def.setback && (
        <>
          <mesh position={[0, podium / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[baseW, podium, baseD]} />
            <meshStandardMaterial
              color={palette.key === 'night' ? '#20303f' : '#b7c1c4'}
              roughness={0.62}
              metalness={0.28}
            />
          </mesh>
          {/* 裙房顶的 AR 灯带 */}
          <mesh position={[0, podium - 0.06, baseD / 2 + 0.055]}>
            <boxGeometry args={[baseW * 0.96, 0.06, 0.06]} />
            <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={palette.key === 'night' ? 0.85 : 0.35} />
          </mesh>
        </>
      )}

      <mesh
        position={[0, podium, 0]}
        castShadow
        receiveShadow
        material={bodyMaterial}
        geometry={mass}
        // 自定义 shader 不能被合批（合批会换成普通材质）
        userData={{ noMerge: true }}
      />

      {def.balconies && <Balconies def={def} width={bodyW} depth={bodyD} palette={palette} />}

      {/* 首层店面 */}
      <group
        position={[
          faceBase + (side === 'east' ? offset : side === 'west' ? -offset : 0),
          0,
          faceBaseZ + (side === 'south' ? offset : side === 'north' ? -offset : 0),
        ]}
        rotation={[0, rotation, 0]}
      >
        <mesh position={[0, 2.0, 0]}>
          <boxGeometry args={[faceWidth, 3.6, 0.2]} />
          <meshStandardMaterial
            color={palette.key === 'night' ? '#0c1a26' : '#3c4e55'}
            roughness={0.12}
            metalness={0.8}
            emissive={palette.glowWarm}
            emissiveIntensity={palette.key === 'night' ? 0.14 : 0.05}
          />
        </mesh>
        <mesh position={[0, 2.0, 0.11]}>
          <boxGeometry args={[faceWidth - 1.4, 2.85, 0.04]} />
          <meshBasicMaterial color={palette.key === 'night' ? '#8ad9ee' : '#7f959c'} transparent opacity={palette.key === 'night' ? 0.12 : 0.28} />
        </mesh>
        {/* 门框与门 */}
        <mesh position={[0, 1.5, 0.14]}>
          <boxGeometry args={[2.6, 3.0, 0.16]} />
          <meshStandardMaterial color={palette.key === 'night' ? '#16242f' : '#56676e'} roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 1.35, 0.24]}>
          <boxGeometry args={[2.2, 2.7, 0.08]} />
          <meshStandardMaterial
            color={palette.key === 'night' ? '#0d2230' : '#4b6169'}
            emissive={palette.glowWarm}
            emissiveIntensity={palette.key === 'night' ? 0.35 : 0.08}
            roughness={0.15}
            metalness={0.6}
          />
        </mesh>
        <mesh position={[1.0, 1.4, 0.3]}>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
        {[-0.34, 0, 0.34].map((p, i) => (
          <mesh key={i} position={[p * faceWidth, 2.0, 0.17]}>
            <boxGeometry args={[0.09, 3.2, 0.1]} />
            <meshStandardMaterial color={palette.trim} roughness={0.5} metalness={0.5} />
          </mesh>
        ))}
        {/* 雨棚 */}
        <mesh position={[0, 3.75, 1.2]} castShadow>
          <boxGeometry args={[Math.min(faceWidth * 0.82, 8), 0.14, 2.6]} />
          <meshStandardMaterial color={palette.trim} roughness={0.55} metalness={0.4} />
        </mesh>
        <mesh position={[0, 3.66, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[Math.min(faceWidth * 0.78, 7.6), 2.4]} />
          <meshBasicMaterial color={accent} transparent opacity={0.4} toneMapped={false} />
        </mesh>
        <mesh position={[0, 3.6, 0.24]}>
          <boxGeometry args={[Math.min(faceWidth * 0.82, 8), 0.09, 0.07]} />
          <meshBasicMaterial color={palette.glowWarm} toneMapped={false} />
        </mesh>
        {palette.key === 'night' && (
          <>
            <mesh position={[0, 0.16, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[faceWidth * 0.9, 2.2]} />
              <meshBasicMaterial color={palette.glowWarm} transparent opacity={0.16} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            <mesh position={[0, 4.1, 0.2]}>
              <boxGeometry args={[faceWidth * 0.86, 0.05, 0.05]} />
              <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={0.8} />
            </mesh>
          </>
        )}
        {signTexture && (
          <mesh position={[0, 4.85, 0.22]}>
            <planeGeometry args={[Math.min(faceWidth * 0.72, 7.4), 1.8]} />
            <meshBasicMaterial map={signTexture} toneMapped={false} transparent opacity={0.96} />
          </mesh>
        )}
        {palette.key === 'night' && (
          <>
            {/* 店铺暖光溢出：用加色平面代替点光源，几十栋楼叠加也不会拖垮帧率 */}
            <GlowDisc position={[0, 0.7, 2.6]} size={9} color="#ffd2a0" opacity={0.22} />
            <GlowDisc position={[0, 2.2, 1.5]} size={6.5} color="#ffc98f" opacity={0.16} vertical />
          </>
        )}
      </group>

      <Plinth width={bodyW} depth={bodyD} palette={palette} />
      <Cornice width={bodyW} depth={bodyD} y={def.h - 0.9} palette={palette} />

      <Roof def={def} width={bodyW} depth={bodyD} top={def.h} palette={palette} />

      {/* 顶部压边：跟着切角走，才不会在削角处露出一个方角 */}
      <mesh position={[0, podium + bodyH - 0.08, 0]} geometry={cap}>
        <meshStandardMaterial color={palette.trim} roughness={0.5} metalness={0.45} />
      </mesh>

      {/* 轮廓线只留给地标：普通楼体在移动时这条细亮线会闪成"漏光" */}
      {outline && def.landmark && (
        <lineSegments position={[0, podium, 0]} geometry={outline}>
          <lineBasicMaterial
            color={accent}
            transparent
            opacity={0.4}
            toneMapped={false}
          />
        </lineSegments>
      )}

      {palette.key === 'night' && (
        <group position={[0, def.h + 1.2, 0]}>
          <mesh position={[bodyW * 0.36, 0, bodyD * 0.36]}>
            <sphereGeometry args={[0.28, 10, 10]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
          <mesh position={[bodyW * 0.36, 0, bodyD * 0.36]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.62, 20]} />
            <meshBasicMaterial color={accent} transparent opacity={0.4} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {/* 屋顶一圈 AR 光环，俯瞰时勾勒出城市轮廓 */}
      {palette.key === 'night' && (
        <lineSegments position={[0, def.h + 0.35, 0]} geometry={roofLine}>
          <lineBasicMaterial color={accent} transparent opacity={def.landmark ? 0.75 : 0.45} toneMapped={false} />
        </lineSegments>
      )}

      {/* 楼体竖向光缝（少量） */}
      {def.landmark && (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (bodyW / 2 + 0.06), podium + bodyH / 2, bodyD / 2 * 0.3]}>
              <boxGeometry args={[0.05, bodyH * 0.72, 0.05]} />
              <meshBasicMaterial color={accent} transparent opacity={0.5} toneMapped={false} />
            </mesh>
          ))}
        </>
      )}
    </group>
  )
}

/** 外围填充楼：只画体量 + 立面 + 檐口 + 临街店面。
    高一点的楼分成两段退台，剪影不再是"一根方柱"；
    所有构件都用标准材质，静态合批会一起吃掉，几十栋也只多几十次 draw call。 */
export function InfillBuilding({ def }: Props) {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk
  const wall = useMemo(() => bodyColor(def.body, palette), [def.body, palette])
  const lightsOn = palette.key === 'night'

  const chamfer = useMemo(
    () => Math.min(Math.min(def.w, def.d) * 0.07, 2.6),
    [def.w, def.d],
  )

  // 退台：高楼的 78% 处收一次，上段更窄。真实高层几乎都有这个层次。
  const stepped = def.setback && def.h > 44
  const tiers = useMemo(() => {
    if (!stepped) return [{ y0: 0, y1: def.h, w: def.w, d: def.d }]
    const cut = def.h * 0.76
    return [
      { y0: 0, y1: cut, w: def.w, d: def.d },
      { y0: cut, y1: def.h, w: def.w * 0.8, d: def.d * 0.8 },
    ]
  }, [stepped, def.h, def.w, def.d])

  // 每段的体量、压顶、材质
  const parts = useMemo(
    () =>
      tiers.map((t) => {
        const c = Math.min(chamfer, Math.min(t.w, t.d) * 0.4)
        return {
          tier: t,
          chamfer: c,
          mass: massGeometry(t.w, t.d, t.y1 - t.y0, c),
          cap: massGeometry(t.w + 0.24, t.d + 0.24, 0.18, c + 0.1),
          material: createFacadeMaterial({
            wall,
            trim: palette.trim,
            glass: def.style === 'glass' ? palette.glass : palette.windowDark,
            litWarm: palette.windowLit[0],
            litCool: palette.windowLit[2],
            style: def.style,
            night: lightsOn,
            width: t.w,
            depth: t.d,
            height: t.y1 - t.y0,
            // 首层留给店面；上段用负的 base 接着下段的楼层继续排，
            // 不会在退台处出现半层错位
            base: (def.style === 'glass' ? 4.2 : 3.4) - t.y0,
            inset: c + 0.5,
            // 背街一面留作山墙
            blank:
              seeded(def.id + '-gable')() > 0.45
                ? def.facing === 'east' || def.facing === 'west'
                  ? 'z'
                  : 'x'
                : 'none',
            seed: seeded(def.id + '-facade')(),
          }),
        }
      }),
    [tiers, chamfer, wall, def.style, def.id, palette, lightsOn],
  )
  useEffect(
    () => () => {
      for (const p of parts) {
        p.mass.dispose()
        p.cap.dispose()
        p.material.dispose()
      }
    },
    [parts],
  )

  const facing = def.facing ?? 'south'
  const rotation =
    facing === 'east' ? Math.PI / 2 : facing === 'west' ? -Math.PI / 2 : facing === 'north' ? Math.PI : 0
  const span = facing === 'east' || facing === 'west' ? def.d : def.w
  const frontDepth = (facing === 'east' || facing === 'west' ? def.w : def.d) / 2
  const front = {
    x: facing === 'east' ? frontDepth : facing === 'west' ? -frontDepth : 0,
    z: facing === 'south' ? frontDepth : facing === 'north' ? -frontDepth : 0,
  }
  const shopW = Math.min(span * 0.8, 11)
  const hasShop = useMemo(() => seeded(def.id + '-shop')() > 0.2, [def.id])

  return (
    <group position={[def.x, 0, def.z]}>
      {parts.map((p, i) => (
        <group key={i} position={[0, p.tier.y0, 0]}>
          <mesh
            geometry={p.mass}
            material={p.material}
            castShadow
            receiveShadow
            userData={{ noMerge: true }}
          />
          <Cornice width={p.tier.w} depth={p.tier.d} y={p.tier.y1 - p.tier.y0 - 0.85} palette={palette} />
          <mesh position={[0, p.tier.y1 - p.tier.y0 - 0.09, 0]} geometry={p.cap}>
            <meshStandardMaterial color={palette.trim} roughness={0.6} metalness={0.3} />
          </mesh>
        </group>
      ))}

      <Plinth width={def.w} depth={def.d} palette={palette} />

      {hasShop && (
        <group position={[front.x, 0, front.z]} rotation={[0, rotation, 0]}>
          {/* 店面推离墙面 0.2m：勒脚比墙面外凸 0.15m，贴太近会被它挡住 */}
          <mesh position={[0, 1.75, 0.2]}>
            <boxGeometry args={[shopW, 3.3, 0.14]} />
            <meshStandardMaterial
              color={lightsOn ? '#0d1723' : '#3f4d57'}
              roughness={0.1}
              metalness={0.78}
              emissive={palette.glowWarm}
              emissiveIntensity={lightsOn ? 0.16 : 0.04}
            />
          </mesh>
          {/* 店内暖光：加色平面，比点光源便宜几十倍 */}
          <mesh position={[0, 1.5, 0.33]}>
            <planeGeometry args={[shopW * 0.8, 2.2]} />
            <meshBasicMaterial
              color={palette.glowWarm}
              transparent
              opacity={lightsOn ? 0.16 : 0.05}
              toneMapped={false}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* 雨棚 + 灯带 */}
          <mesh position={[0, 3.62, 0.95]} castShadow>
            <boxGeometry args={[shopW + 0.4, 0.16, 1.9]} />
            <meshStandardMaterial color={palette.trim} roughness={0.55} metalness={0.35} />
          </mesh>
          <mesh position={[0, 3.5, 1.88]}>
            <boxGeometry args={[shopW + 0.2, 0.05, 0.06]} />
            <meshBasicMaterial
              color={def.style === 'glass' ? palette.glass : palette.ar}
              transparent
              opacity={lightsOn ? 0.8 : 0.28}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
    </group>
  )
}
