import * as THREE from 'three'
import type { FurnitureItem, FurnitureType } from '../types'
import { INDOOR_STYLE, accentColor, calm, deepen, furnitureTone, lighten, pick, rugTone } from './style'

export const FURNITURE_META: Record<
  FurnitureType,
  { label: string; glyph: string; color: string; w: number; d: number; h: number; walk?: boolean }
> = {
  sofa: { label: '沙发', glyph: '▭', color: '#4d7f8c', w: 2.0, d: 0.9, h: 0.9, walk: true },
  table: { label: '茶几', glyph: '▱', color: '#8a6440', w: 1.4, d: 0.85, h: 0.76, walk: true },
  chair: { label: '椅子', glyph: '▤', color: '#c9a838', w: 0.6, d: 0.6, h: 0.95 },
  shelf: { label: '书架', glyph: '▥', color: '#7a5a3c', w: 1.5, d: 0.45, h: 1.95, walk: true },
  plant: { label: '绿植', glyph: '❧', color: '#4f8a4a', w: 0.7, d: 0.7, h: 1.5 },
  lamp: { label: '落地灯', glyph: '✦', color: '#c9a86e', w: 0.45, d: 0.45, h: 1.7 },
  rug: { label: '地毯', glyph: '▦', color: '#7a5cd8', w: 3.2, d: 2.4, h: 0.03 },
  desk: { label: '书桌', glyph: '▰', color: '#8a6440', w: 1.7, d: 0.8, h: 0.78, walk: true },
  bench: { label: '长凳', glyph: '▬', color: '#8a6440', w: 1.7, d: 0.5, h: 0.5, walk: true },
  pedestal: { label: '展台', glyph: '◫', color: '#ded8cc', w: 0.6, d: 0.6, h: 1.3, walk: true },
  speaker: { label: '音箱', glyph: '◉', color: '#3a434a', w: 0.65, d: 0.55, h: 1.3, walk: true },
  bed: { label: '床', glyph: '▭', color: '#5f8fa0', w: 1.7, d: 2.2, h: 0.7, walk: true },
  stool: { label: '圆凳', glyph: '◍', color: '#d98a35', w: 0.5, d: 0.5, h: 0.48 },
  counter: { label: '吧台', glyph: '▬', color: '#7a5a3c', w: 2.2, d: 0.7, h: 1.05, walk: true },
}

/** 四根细腿：金属感比上一版强一档，脚底收细，像参考图里那些细腿家具。 */
function Legs({ w, d, h = 0.5 }: { w: number; d: number; h?: number }) {
  return (
    <>
      {[
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [-w / 2, d / 2],
        [w / 2, d / 2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, h / 2, z]} castShadow>
          <cylinderGeometry args={[0.018, 0.026, h, 8]} />
          <meshStandardMaterial color={INDOOR_STYLE.metal} roughness={0.32} metalness={0.72} envMapIntensity={1.15} />
        </mesh>
      ))}
    </>
  )
}

/** 桌上的一小块自发光屏幕：参考图里"亮起来"的东西基本都来自显示器。 */
function Screen({ x, y, z, rot = 0, w = 0.42, h = 0.26 }: { x: number; y: number; z: number; rot?: number; w?: number; h?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0, -0.012]} castShadow>
        <boxGeometry args={[w + 0.03, h + 0.03, 0.014]} />
        <meshStandardMaterial color={INDOOR_STYLE.frame} roughness={0.45} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          color={INDOOR_STYLE.glow}
          emissive={INDOOR_STYLE.glow}
          emissiveIntensity={1.35}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[w * 0.86, h * 0.2]} />
        <meshBasicMaterial color={deepen(INDOOR_STYLE.glow, 0.72)} transparent opacity={0.55} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function FurnitureMesh({
  item,
  selected,
  editing,
  onSelect,
}: {
  item: FurnitureItem
  selected: boolean
  editing: boolean
  onSelect: () => void
}) {
  const material = (roughness = 0.82, metalness = 0.04) => (
    <meshStandardMaterial
      color={calm(furnitureTone(item.color))}
      roughness={roughness}
      metalness={metalness}
      envMapIntensity={0.8}
    />
  )
  // 同一个 id 稳定取色：同一件家具每次渲染都是同一个点缀色，不会闪。
  const base = calm(furnitureTone(item.color))
  const accentA = accentColor(`${item.id}-a`)
  const accentB = accentColor(`${item.id}-b`)
  const wood = furnitureTone(item.color)
  const content = (() => {
    switch (item.type) {
      case 'sofa':
        return (
          <>
            {/* 木框底座：露出一圈木头，比整块布面更像家具 */}
            <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.98, 0.16, 0.86]} />
              <meshStandardMaterial color={deepen(wood, 0.2)} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.36, 0]} castShadow>
              <boxGeometry args={[1.9, 0.3, 0.8]} />
              {material(0.9)}
            </mesh>
            {/* 两块坐垫，中间一道缝 */}
            {[-0.47, 0.47].map((x) => (
              <mesh key={x} position={[x, 0.55, 0.04]} castShadow>
                <boxGeometry args={[0.82, 0.14, 0.7]} />
                <meshStandardMaterial color={calm(base, 0.16)} roughness={0.95} />
              </mesh>
            ))}
            <mesh position={[0, 0.72, -0.3]} castShadow>
              <boxGeometry args={[1.9, 0.52, 0.2]} />
              {material(0.95)}
            </mesh>
            {[-0.94, 0.94].map((x) => (
              <mesh key={x} position={[x, 0.6, 0]} castShadow>
                <boxGeometry args={[0.16, 0.44, 0.78]} />
                {material(0.95)}
              </mesh>
            ))}
            {/* 抱枕：参考图里沙发上那几个彩色块，是整间屋子的"色点" */}
            {[
              [-0.6, accentA, 0.24],
              [0.55, accentB, -0.16],
            ].map(([x, c, r], i) => (
              <mesh key={i} position={[x as number, 0.73, -0.16]} rotation={[0.16, r as number, 0]} castShadow>
                <boxGeometry args={[0.42, 0.36, 0.14]} />
                <meshStandardMaterial color={c as string} roughness={0.98} />
              </mesh>
            ))}
          </>
        )
      case 'table':
        return (
          <>
            {/* 圆桌面：参考图中间那张小圆桌（浅木台面 + 黄铜包边） */}
            <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.66, 0.66, 0.06, 32]} />
              <meshStandardMaterial color="#ded0b6" roughness={0.48} metalness={0.03} />
            </mesh>
            <mesh position={[0, 0.66, 0]}>
              <torusGeometry args={[0.63, 0.018, 8, 40]} />
              <meshStandardMaterial color={INDOOR_STYLE.brass} roughness={0.35} metalness={0.7} />
            </mesh>
            <mesh position={[0, 0.36, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.08, 0.68, 12]} />
              <meshStandardMaterial color={INDOOR_STYLE.metal} roughness={0.34} metalness={0.66} />
            </mesh>
            <mesh position={[0, 0.03, 0]}>
              <cylinderGeometry args={[0.3, 0.34, 0.05, 20]} />
              <meshStandardMaterial color={INDOOR_STYLE.metalSoft} roughness={0.4} metalness={0.5} />
            </mesh>
            {/* 桌上：一只花瓶 + 一颗小盆栽 */}
            <mesh position={[0.24, 0.82, 0.1]} castShadow>
              <cylinderGeometry args={[0.05, 0.07, 0.2, 12]} />
              <meshStandardMaterial color={accentB} roughness={0.4} />
            </mesh>
            <mesh position={[-0.26, 0.76, -0.06]} castShadow>
              <icosahedronGeometry args={[0.1, 0]} />
              <meshStandardMaterial color={INDOOR_STYLE.leaves[1]} roughness={1} flatShading />
            </mesh>
          </>
        )
      case 'chair': {
        // 椅面按 id 取分区色：一排椅子是多色的，不是一片木色
        const seat = calm(accentColor(item.id), 0.02)
        return (
          <>
            <mesh position={[0, 0.46, 0]} castShadow>
              <boxGeometry args={[0.46, 0.07, 0.46]} />
              <meshStandardMaterial color={seat} roughness={0.72} metalness={0.05} />
            </mesh>
            <mesh position={[0, 0.76, -0.2]} castShadow>
              <boxGeometry args={[0.44, 0.56, 0.06]} />
              <meshStandardMaterial color={seat} roughness={0.78} metalness={0.05} />
            </mesh>
            {/* 靠背上一道横撑，椅子才不"空" */}
            <mesh position={[0, 0.92, -0.23]}>
              <boxGeometry args={[0.4, 0.04, 0.04]} />
              <meshStandardMaterial color={INDOOR_STYLE.metalSoft} roughness={0.4} metalness={0.5} />
            </mesh>
            <Legs w={0.38} d={0.38} h={0.44} />
          </>
        )
      }
      case 'shelf':
        return (
          <>
            {/* 柜体：深木色背板 + 浅木层板 */}
            <mesh position={[0, 1, -0.16]} castShadow receiveShadow>
              <boxGeometry args={[1.44, 1.95, 0.06]} />
              <meshStandardMaterial color={deepen(wood, 0.3)} roughness={0.85} />
            </mesh>
            {[0.22, 0.72, 1.22, 1.7].map((y) => (
              <mesh key={y} position={[0, y, 0]} castShadow>
                <boxGeometry args={[1.48, 0.05, 0.42]} />
                <meshStandardMaterial color={calm(wood, 0.1)} roughness={0.68} />
              </mesh>
            ))}
            {[-0.71, 0.71].map((x) => (
              <mesh key={x} position={[x, 1, 0]} castShadow>
                <boxGeometry args={[0.06, 1.95, 0.42]} />
                <meshStandardMaterial color={deepen(wood, 0.3)} roughness={0.85} />
              </mesh>
            ))}
            {/* 书脊：一本书一个颜色，参考图里散落的彩色小方块 */}
            {[
              [-0.5, 0.32],
              [-0.34, 0.32],
              [-0.18, 0.32],
              [0.2, 0.32],
              [0.36, 0.32],
              [-0.42, 0.82],
              [0.3, 0.82],
              [-0.1, 1.32],
              [0.42, 1.32],
            ].map(([x, y], i) => (
              <mesh key={i} position={[x, y + 0.11, 0.02]} castShadow>
                <boxGeometry args={[0.11, 0.22 + (i % 3) * 0.03, 0.24]} />
                <meshStandardMaterial color={pick(INDOOR_STYLE.spines, `${item.id}${i}`)} roughness={0.86} />
              </mesh>
            ))}
          </>
        )
      case 'plant':
        return (
          <>
            {/* 陶盆：上宽下窄 + 一圈盆沿 */}
            <mesh position={[0, 0.22, 0]} castShadow>
              <cylinderGeometry args={[0.24, 0.17, 0.44, 18]} />
              <meshStandardMaterial color="#c08e62" roughness={0.8} metalness={0.03} envMapIntensity={0.8} />
            </mesh>
            <mesh position={[0, 0.44, 0]}>
              <cylinderGeometry args={[0.255, 0.245, 0.05, 18]} />
              <meshStandardMaterial color={lighten('#c08e62', 0.1)} roughness={0.75} />
            </mesh>
            <mesh position={[0, 0.46, 0]}>
              <cylinderGeometry args={[0.21, 0.21, 0.02, 16]} />
              <meshStandardMaterial color="#4a3a2a" roughness={1} />
            </mesh>
            {/* 三团叶子：深→浅，靠 sizes 堆出体积 */}
            <mesh position={[0, 0.86, 0]} castShadow>
              <icosahedronGeometry args={[0.44, 1]} />
              <meshStandardMaterial color={INDOOR_STYLE.leaves[0]} roughness={1} flatShading />
            </mesh>
            <mesh position={[0.2, 1.16, 0.06]} castShadow>
              <icosahedronGeometry args={[0.32, 1]} />
              <meshStandardMaterial color={INDOOR_STYLE.leaves[1]} roughness={1} flatShading />
            </mesh>
            <mesh position={[-0.22, 1.04, -0.08]} castShadow>
              <icosahedronGeometry args={[0.26, 1]} />
              <meshStandardMaterial color={INDOOR_STYLE.leaves[2]} roughness={1} flatShading />
            </mesh>
          </>
        )
      case 'lamp':
        return (
          <>
            <mesh position={[0, 0.04, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.24, 0.08, 16]} />
              <meshStandardMaterial color={INDOOR_STYLE.metal} roughness={0.32} metalness={0.72} envMapIntensity={1.1} />
            </mesh>
            <mesh position={[0, 0.82, 0]} castShadow>
              <cylinderGeometry args={[0.022, 0.028, 1.56, 8]} />
              <meshStandardMaterial color={INDOOR_STYLE.brass} metalness={0.72} roughness={0.34} envMapIntensity={1.2} />
            </mesh>
            {/* 灯罩：内侧亮、外侧半透，罩口一圈暖光 */}
            <mesh position={[0, 1.62, 0]}>
              <cylinderGeometry args={[0.19, 0.26, 0.32, 20, 1, true]} />
              <meshStandardMaterial
                color="#ffe6b8"
                emissive="#ffc880"
                emissiveIntensity={2.1}
                side={THREE.DoubleSide}
                toneMapped={false}
              />
            </mesh>
            <pointLight position={[0, 1.52, 0]} color="#ffcf94" intensity={1.9} distance={4.6} decay={2} />
          </>
        )
      case 'rug': {
        // 参考图的地面是一块块"带发光边的分区地贴"，不是毛绒地毯：
        // 半透色块 + 一圈更亮的描边 + 内圈一条细线，俯视时就是一张空间分区图。
        const tone = rugTone(item.color, item.id)
        const edge = lighten(tone, 0.28)
        return (
          <group position={[0, 0.008, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[3.1, 2.3]} />
              <meshStandardMaterial
                color={calm(tone, 0.02)}
                roughness={0.86}
                metalness={0.02}
                transparent
                opacity={0.86}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-2}
              />
            </mesh>
            {/* 描边：比本体亮一档，靠 Bloom 收一点点光晕。
                四条细长面片拼一圈，比 RingGeometry 更好控制宽高比。 */}
            {[
              { p: [0, -1.13] as const, s: [3.1, 0.05] as const, o: 0.9 },
              { p: [0, 1.13] as const, s: [3.1, 0.05] as const, o: 0.9 },
              { p: [-1.53, 0] as const, s: [0.05, 2.3] as const, o: 0.9 },
              { p: [1.53, 0] as const, s: [0.05, 2.3] as const, o: 0.9 },
              { p: [0, -1.0] as const, s: [2.85, 0.014] as const, o: 0.38 },
              { p: [0, 1.0] as const, s: [2.85, 0.014] as const, o: 0.38 },
              { p: [-1.4, 0] as const, s: [0.014, 2.0] as const, o: 0.38 },
              { p: [1.4, 0] as const, s: [0.014, 2.0] as const, o: 0.38 },
            ].map((b, i) => (
              <mesh key={i} position={[b.p[0], 0.002, b.p[1]]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[b.s[0], b.s[1]]} />
                <meshBasicMaterial color={edge} transparent opacity={b.o} depthWrite={false} toneMapped={false} />
              </mesh>
            ))}
            {/* 四角小方块：地贴的"锚点"，让色块不至于糊成一片 */}
            {[
              [-1.28, -0.9],
              [1.28, -0.9],
              [-1.28, 0.9],
              [1.28, 0.9],
            ].map(([x, z], i) => (
              <mesh key={i} position={[x, 0.002, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.16, 0.16]} />
                <meshBasicMaterial color={edge} transparent opacity={0.7} depthWrite={false} toneMapped={false} />
              </mesh>
            ))}
          </group>
        )
      }
      case 'desk':
        return (
          <>
            {/* 桌面 + 侧柜：桌面用浅暖白（参考图里办公桌是白台面 + 木柜体） */}
            <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.7, 0.07, 0.78]} />
              <meshStandardMaterial color="#e7dfce" roughness={0.45} metalness={0.03} />
            </mesh>
            <mesh position={[0.56, 0.5, 0]} castShadow>
              <boxGeometry args={[0.52, 0.48, 0.68]} />
              <meshStandardMaterial color={deepen(wood, 0.24)} roughness={0.7} />
            </mesh>
            {/* 抽屉面板：三条横缝 */}
            {[0.62, 0.5, 0.38].map((y) => (
              <mesh key={y} position={[0.56, y, 0.345]}>
                <boxGeometry args={[0.44, 0.012, 0.01]} />
                <meshStandardMaterial color={deepen(wood, 0.5)} roughness={0.9} />
              </mesh>
            ))}
            {[-0.74, 0.1].map((x) => (
              <mesh key={x} position={[x, 0.36, 0]} castShadow>
                <cylinderGeometry args={[0.02, 0.024, 0.72, 8]} />
                <meshStandardMaterial color={INDOOR_STYLE.metal} roughness={0.34} metalness={0.7} envMapIntensity={1.1} />
              </mesh>
            ))}
            {/* 显示器：朝 -Z（坐着的人那一侧） */}
            <group position={[-0.16, 0.78, -0.04]}>
              <mesh position={[0, 0.24, -0.02]} castShadow>
                <boxGeometry args={[0.06, 0.16, 0.05]} />
                <meshStandardMaterial color={INDOOR_STYLE.metalSoft} roughness={0.4} metalness={0.5} />
              </mesh>
              <mesh position={[0, 0.02, -0.02]} castShadow>
                <boxGeometry args={[0.3, 0.02, 0.18]} />
                <meshStandardMaterial color={INDOOR_STYLE.metalSoft} roughness={0.4} metalness={0.5} />
              </mesh>
              <Screen x={0} y={0.34} z={0} w={0.46} h={0.29} />
            </group>
            {/* 键盘 + 鼠标垫 + 一杯水 */}
            <mesh position={[-0.12, 0.785, 0.22]}>
              <boxGeometry args={[0.38, 0.014, 0.13]} />
              <meshStandardMaterial color="#22282c" roughness={0.7} />
            </mesh>
            <mesh position={[-0.12, 0.782, 0.22]}>
              <boxGeometry args={[0.34, 0.004, 0.1]} />
              <meshBasicMaterial color={INDOOR_STYLE.glow} transparent opacity={0.28} toneMapped={false} />
            </mesh>
            <mesh position={[0.34, 0.82, 0.16]} castShadow>
              <cylinderGeometry args={[0.05, 0.045, 0.13, 12]} />
              <meshStandardMaterial color={accentA} roughness={0.35} />
            </mesh>
          </>
        )
      case 'bench':
        return (
          <>
            <mesh position={[0, 0.42, 0]} castShadow>
              <boxGeometry args={[1.65, 0.09, 0.46]} />
              <meshStandardMaterial color={calm(wood, 0.08)} roughness={0.72} />
            </mesh>
            <mesh position={[0, 0.47, 0]}>
              <boxGeometry args={[1.55, 0.02, 0.36]} />
              <meshStandardMaterial color={accentB} roughness={0.95} />
            </mesh>
            {[-0.65, 0.65].map((x) => (
              <mesh key={x} position={[x, 0.2, 0]} castShadow>
                <boxGeometry args={[0.09, 0.4, 0.36]} />
                <meshStandardMaterial color={INDOOR_STYLE.metalSoft} roughness={0.38} metalness={0.55} />
              </mesh>
            ))}
          </>
        )
      case 'pedestal':
        return (
          <>
            <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.62, 1.1, 0.62]} />
              <meshStandardMaterial color={calm(base, 0.04)} roughness={0.8} metalness={0.05} />
            </mesh>
            <mesh position={[0, 0.012, 0]}>
              <boxGeometry args={[0.68, 0.024, 0.68]} />
              <meshStandardMaterial color={INDOOR_STYLE.skirting} roughness={0.6} />
            </mesh>
            {/* 展品：铜环 + 一小束光 */}
            <mesh position={[0, 1.3, 0]} castShadow>
              <torusGeometry args={[0.2, 0.045, 16, 40]} />
              <meshStandardMaterial color={INDOOR_STYLE.brass} roughness={0.28} metalness={0.72} envMapIntensity={1.3} />
            </mesh>
            <mesh position={[0, 1.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.34, 24]} />
              <meshBasicMaterial color={INDOOR_STYLE.glow} transparent opacity={0.14} depthWrite={false} toneMapped={false} />
            </mesh>
          </>
        )
      case 'speaker':
        return (
          <>
            <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.62, 1.2, 0.52]} />
              <meshStandardMaterial color={deepen(wood, 0.35)} roughness={0.7} />
            </mesh>
            {[0.86, 0.44].map((y) => (
              <group key={y}>
                <mesh position={[0, y, 0.27]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.19, 0.19, 0.03, 22]} />
                  <meshStandardMaterial color="#15191b" roughness={0.85} />
                </mesh>
                <mesh position={[0, y, 0.288]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.075, 0.075, 0.012, 18]} />
                  <meshStandardMaterial color={INDOOR_STYLE.brass} roughness={0.4} metalness={0.6} />
                </mesh>
              </group>
            ))}
            <mesh position={[0, 1.2, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.008, 0.008, 0.5, 6]} />
              <meshStandardMaterial color={INDOOR_STYLE.metalSoft} metalness={0.6} roughness={0.35} />
            </mesh>
          </>
        )
      case 'bed':
        return (
          <>
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.72, 0.26, 2.16]} />
              <meshStandardMaterial color={deepen(wood, 0.28)} roughness={0.75} />
            </mesh>
            <mesh position={[0, 0.42, 0]} castShadow>
              <boxGeometry args={[1.62, 0.22, 2.04]} />
              <meshStandardMaterial color="#e6ddcb" roughness={0.95} />
            </mesh>
            {/* 被子：盖住下半张床，颜色跟床的配色走 */}
            <mesh position={[0, 0.55, 0.3]} castShadow>
              <boxGeometry args={[1.6, 0.1, 1.3]} />
              <meshStandardMaterial color={calm(base, 0.04)} roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.605, 0.3]}>
              <boxGeometry args={[1.6, 0.012, 0.1]} />
              <meshStandardMaterial color={lighten(calm(base, 0.04), 0.25)} roughness={0.95} />
            </mesh>
            {/* 枕头 */}
            {[-0.42, 0.42].map((x) => (
              <mesh key={x} position={[x, 0.62, -0.72]} rotation={[0.08, 0, 0]} castShadow>
                <boxGeometry args={[0.74, 0.16, 0.4]} />
                <meshStandardMaterial color="#f3ecdc" roughness={0.98} />
              </mesh>
            ))}
            {/* 床头板 */}
            <mesh position={[0, 0.72, -1.06]} castShadow>
              <boxGeometry args={[1.74, 0.94, 0.1]} />
              <meshStandardMaterial color={deepen(wood, 0.16)} roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.2, -1.06]}>
              <boxGeometry args={[1.74, 0.03, 0.11]} />
              <meshStandardMaterial color={INDOOR_STYLE.brass} roughness={0.35} metalness={0.7} />
            </mesh>
          </>
        )
      case 'stool':
        return (
          <>
            <mesh position={[0, 0.44, 0]} castShadow>
              <cylinderGeometry args={[0.26, 0.22, 0.1, 20]} />
              <meshStandardMaterial color={calm(base, 0.02)} roughness={0.75} />
            </mesh>
            <mesh position={[0, 0.385, 0]}>
              <torusGeometry args={[0.24, 0.012, 8, 24]} />
              <meshStandardMaterial color={INDOOR_STYLE.brass} roughness={0.35} metalness={0.68} />
            </mesh>
            {[0, 2.1, 4.2].map((a) => (
              <mesh key={a} position={[Math.cos(a) * 0.15, 0.2, Math.sin(a) * 0.15]} rotation={[0, 0, Math.cos(a) * 0.14]} castShadow>
                <cylinderGeometry args={[0.016, 0.022, 0.4, 8]} />
                <meshStandardMaterial color={INDOOR_STYLE.metal} roughness={0.34} metalness={0.7} envMapIntensity={1.1} />
              </mesh>
            ))}
          </>
        )
      case 'counter':
        return (
          <>
            {/* 柜体 + 白色台面 + 深色踢脚 */}
            <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.2, 0.88, 0.7]} />
              <meshStandardMaterial color={deepen(wood, 0.18)} roughness={0.72} />
            </mesh>
            <mesh position={[0, 0.06, 0.36]}>
              <boxGeometry args={[2.2, 0.12, 0.02]} />
              <meshStandardMaterial color={INDOOR_STYLE.skirting} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.96, 0]} castShadow>
              <boxGeometry args={[2.32, 0.08, 0.82]} />
              <meshStandardMaterial color="#e8e1d2" roughness={0.42} metalness={0.04} />
            </mesh>
            {/* 台面小物：收银机 + 托盘 + 一盏吊下来的灯 */}
            <mesh position={[-0.58, 1.12, 0]} castShadow>
              <boxGeometry args={[0.44, 0.24, 0.34]} />
              <meshStandardMaterial color={INDOOR_STYLE.metalSoft} metalness={0.35} roughness={0.45} />
            </mesh>
            <Screen x={-0.58} y={1.2} z={0.176} w={0.26} h={0.16} />
            <mesh position={[0.55, 1.03, 0.04]} castShadow>
              <cylinderGeometry args={[0.18, 0.15, 0.06, 20]} />
              <meshStandardMaterial color={accentA} roughness={0.5} />
            </mesh>
            <mesh position={[0.55, 1.09, 0.04]}>
              <icosahedronGeometry args={[0.1, 0]} />
              <meshStandardMaterial color={INDOOR_STYLE.leaves[1]} roughness={1} flatShading />
            </mesh>
          </>
        )
      default:
        return null
    }
  })()

  return (
    <group
      position={[item.x, 0, item.z]}
      rotation={[0, item.rot, 0]}
      onClick={(event) => {
        if (!editing) return
        event.stopPropagation()
        onSelect()
      }}
      onPointerOver={(event) => {
        if (!editing) return
        event.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default'
      }}
    >
      {content}
      {selected && editing && (
        <group position={[0, 0.015, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.56, 0.66, 32]} />
            <meshBasicMaterial color="#d39a52" transparent opacity={0.95} toneMapped={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.56, 32]} />
            <meshBasicMaterial color="#d39a52" transparent opacity={0.12} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  )
}
