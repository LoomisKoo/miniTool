import { useMemo } from 'react'
import * as THREE from 'three'
import { useApp } from '../store'
import {
  alley,
  alleyMouth,
  buildings as landmarkBuildings,
  buildingById,
  cedarLane,
  crossStreet,
  eastAvenue,
  mainStreet,
  plaza,
  plazaFountain,
  southCross,
  westAvenue,
  type BuildingDef,
} from '../data/city'
import { allBuildings } from '../data/infill'
import { FLOOR_HEIGHT, unitBuilding } from '../data/units'
import { SkyDome } from '../scene/osm/SkyDome'
import { palettes, bodyColor, type Palette } from '../scene/theme'
import { UnitShell, type ShellCut } from '../scene/UnitShell'
import { Water } from '../scene/Water'
import { FerrisWheel } from '../scene/FerrisWheel'
import { Building, InfillBuilding } from '../scene/Building'
import { makePavingTexture } from '../scene/textures'

/**
 * 窗外看到的城市。
 *
 * 楼内是独立 Canvas。房间按它在楼层平面里的真实位置摆放：
 * 整座城平移 -(楼栋中心 + 房间中心)，向下平移本层标高，不再旋转。
 * 本栋楼直接用街上同一个 UnitShell 画，只把"自己这一户 / 这个厅"的玻璃和阳台留空，
 * 所以窗洞、阳台、楼上楼下、邻居家的窗，全都和街上看到的是同一栋楼。
 */
const RADIUS = 320
/** 复用真实楼体的栋数上限：再多就要一次性编译几十个立面着色器。 */
const REAL_LIMIT = 34
const FAR_LIMIT = 150

const LANDMARK_IDS = new Set(landmarkBuildings.map((def) => def.id))

const ROADS = [
  mainStreet,
  crossStreet,
  southCross,
  westAvenue,
  eastAvenue,
  cedarLane,
  alley,
  alleyMouth,
]

/** 远处的一圈：只给雾色块，保留剪影的层次就够。 */
function FarBlock({ def, palette }: { def: BuildingDef; palette: Palette }) {
  const color = useMemo(() => {
    const base = new THREE.Color(bodyColor(def.body, palette))
    return base.lerp(new THREE.Color(palette.fog), 0.55)
  }, [def.body, palette])
  return (
    <mesh position={[def.x, def.h / 2, def.z]}>
      <boxGeometry args={[def.w, def.h, def.d]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

export function CityBackdrop({
  buildingId,
  floor,
  origin = [0, 0],
  cut = null,
  minDist = 0,
}: {
  buildingId: string
  floor: number
  /** 房间中心在楼栋局部坐标里的位置（楼栋中心为原点，不旋转）。 */
  origin?: [number, number]
  /** 本栋楼壳里留给室内自己画的那一户 / 那个厅；null 表示不画本栋楼壳。 */
  cut?: ShellCut | null
  /** 剔掉太近的邻居。 */
  minDist?: number
}) {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk
  const center = buildingById[buildingId]
  const unitDef = unitBuilding(buildingId)

  const baseY = -(Math.max(1, floor) - 1) * FLOOR_HEIGHT
  const ox = (center?.x ?? 0) + origin[0]
  const oz = (center?.z ?? 0) + origin[1]

  const groundMap = useMemo(() => {
    const tex = makePavingTexture(palette.paving, palette.pavingLine)
    tex.repeat.set(64, 64)
    return tex
  }, [palette])

  const neighbours = useMemo(() => {
    if (!center) return []
    return allBuildings
      .filter((def) => def.id !== buildingId)
      .map((def) => ({ def, dist: Math.hypot(def.x - center.x, def.z - center.z) }))
      .filter((item) => item.dist < RADIUS && item.dist > minDist)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, FAR_LIMIT)
  }, [buildingId, center, minDist])

  if (!center) return null

  const real = neighbours.slice(0, REAL_LIMIT)
  const far = neighbours.slice(REAL_LIMIT)

  return (
    <>
      {cut && unitDef && (
        <group position={[-origin[0], baseY, -origin[1]]}>
          <UnitShell building={unitDef} body={center.body} palette={palette} cut={cut} shadows={false} />
        </group>
      )}

      <group>
        <SkyDome
          night={night}
          horizon={palette.fog}
          zenith={palette.sky}
          sunDir={palette.sunPos}
          sunColor={palette.sun}
          sunGain={night ? 2.4 : 1.1}
        />

        {/* 地面：楼层的世界高度差直接折算成负 Y。
            必须用会吃光的 Standard 材质：室内这套灯光会让它亮起来，
            隔着阳台栏杆往下看才读得出"地在这个高度"。
            以前这里是一块不受光的深色 Basic 平面，夜里等于一片虚空。 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseY - 0.07, 0]} receiveShadow>
          <planeGeometry args={[900, 900]} />
          <meshStandardMaterial map={groundMap} color="#ffffff" roughness={0.9} metalness={0.04} />
        </mesh>

        {/* 街道：先铺比路宽 3.4m 的浅色带当人行道，再把暗色路面压上去。
            这两层只差 1~2cm，而这里的相机 near=0.05、视野远到 900m：
            在两三百米外，1cm 的高度差已经小于深度缓冲能分辨的最小间隔，
            于是路面上出现一条条虚线状的闪烁带。所以除了抬高，还必须用
            polygonOffset 在深度空间里再压一次（单位是深度缓冲级，与距离无关）。 */}
        {ROADS.map((road, i) => (
          <group key={`road${i}`} position={[road.x - ox, baseY - 0.05, road.z - oz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
              <planeGeometry args={[road.w + 3.4, road.d + 3.4]} />
              <meshStandardMaterial
                color={palette.paving}
                roughness={0.86}
                metalness={0.03}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-6}
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
              <planeGeometry args={[road.w, road.d]} />
              <meshStandardMaterial
                color={night ? '#111924' : '#3d444a'}
                roughness={0.55}
                metalness={0.08}
                polygonOffset
                polygonOffsetFactor={-4}
                polygonOffsetUnits={-12}
              />
            </mesh>
          </group>
        ))}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[plaza.x - ox, baseY - 0.015, plaza.z - oz]}
          receiveShadow
        >
          <planeGeometry args={[plaza.w, plaza.d]} />
          <meshStandardMaterial
            color={palette.paving}
            roughness={0.86}
            polygonOffset
            polygonOffsetFactor={-3}
            polygonOffsetUnits={-8}
          />
        </mesh>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[plazaFountain.x - ox, baseY + 0.02, plazaFountain.z - oz]}
        >
          <circleGeometry args={[plazaFountain.r, 40]} />
          <meshStandardMaterial
            color={night ? '#1d4a60' : '#7f9aa4'}
            emissive={night ? '#2b7f9c' : '#000000'}
            emissiveIntensity={night ? 0.35 : 0}
            roughness={0.12}
            metalness={0.4}
          />
        </mesh>

        {/* 近处一圈：主城里的真实楼体。放在"城市绝对坐标 → 相对本栋"的偏移组里，
            就能原封不动复用它们的体量、退台、屋檐和店面。 */}
        <group position={[-ox, baseY - 0.05, -oz]}>
          <Water />
          <FerrisWheel />
          {real.map(({ def }) =>
            LANDMARK_IDS.has(def.id) ? (
              <Building key={def.id} def={def} />
            ) : (
              <InfillBuilding key={def.id} def={def} />
            ),
          )}
        </group>

        {/* 远处一圈：雾色块，撑起天际线 */}
        <group position={[-ox, baseY - 0.05, -oz]}>
          {far.map(({ def }) => (
            <FarBlock key={def.id} def={def} palette={palette} />
          ))}
        </group>
      </group>
    </>
  )
}
