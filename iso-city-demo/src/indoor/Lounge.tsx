// 公共客厅：青年公寓整栋楼共享的那一间。
//
// 文档 2.2 节里，青年公寓的一楼是「商铺 + 大堂 + 公共客厅」。户型里没有它的
// 平面（它不是一户），所以直接摆在大堂侧面——大堂本来就是这一层整块矩形，
// 有空位。住户的照片挂在墙上，这是"这栋楼有人住"最直观的一条。
//
// 不用真实头像：照片是程序化的色块，跟美术馆的画是同一套纹理。这样既不会
// 把别人的头像贴到公共地方，也不需要任何上传。

import { useMemo } from 'react'
import { makeArtTexture, makeSignTexture } from '../scene/textures'
import { useApp } from '../store'
import type { RoomBox } from './RoomKit'

const PHOTOS = ['dawn', 'coast', 'meadow', 'signal', 'night', 'clay']
const PHOTO_TITLES = ['601 · 阿汐', '703 · 小满', '505 · 老周', '802 · 图南', '604 · 弥生', '901 · 阿礁']

type Spot = { x: number; z: number; yaw: number }

/**
 * 客厅的落位：大堂里离电梯最远的那一端，**背板贴墙**。
 * 照片墙挂在沙发背后，如果客厅浮在大堂中央，那一墙照片就变成悬空的。
 */
function loungeSpot(box: RoomBox, lift: Spot | { x: number; z: number }): Spot {
  // 大堂的长向就是电梯所在的那条轴：电梯在端头，客厅去另一头
  const long = box.W >= box.D ? 'x' : 'z'
  const half = (long === 'x' ? box.W : box.D) / 2
  const dir = -Math.sign((long === 'x' ? lift.x : lift.z) || 1)
  const at = dir * (half - 1.8)
  // 端头在 +x/+z 时整体转 180°，沙发背照样贴墙、朝大堂中心
  const yaw = dir > 0 ? Math.PI : 0
  return long === 'x' ? { x: at, z: 0, yaw } : { x: 0, z: at, yaw }
}

export function Lounge({ box, lift, floor }: { box: RoomBox; lift: Spot; floor: number }) {
  const spot = loungeSpot(box, lift)
  const photos = useMemo(
    () => PHOTOS.map((palette) => makeArtTexture(palette, 2)),
    [],
  )
  const sign = useMemo(() => makeSignTexture(`公共客厅 · ${floor}F`, '#2d3a34'), [floor])
  // 地毯沿大堂长向摆，宽度按房间夹一下：小楼里不能铺出墙外
  const rugW = Math.min(4.6, box.W - 2.4)
  const rugD = Math.min(3.4, box.D - 2.4)

  return (
    <group position={[spot.x, 0, spot.z]} rotation={[0, spot.yaw, 0]}>
      {/* 地毯 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <planeGeometry args={[rugW, rugD]} />
        <meshStandardMaterial color="#7a6350" roughness={0.98} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}>
        <planeGeometry args={[rugW - 0.4, rugD - 0.4]} />
        <meshStandardMaterial color="#8b7460" roughness={0.98} />
      </mesh>

      {/* 沙发：靠背 + 坐垫 + 两侧扶手，朝房间中心 */}
      <group position={[0, 0, -rugD / 2 + 0.45]}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.5, 0.4, 0.85]} />
          <meshStandardMaterial color="#4c5a52" roughness={0.94} />
        </mesh>
        <mesh position={[0, 0.58, -0.32]} castShadow>
          <boxGeometry args={[2.5, 0.62, 0.22]} />
          <meshStandardMaterial color="#43514a" roughness={0.94} />
        </mesh>
        {[-1.1, 1.1].map((x) => (
          <mesh key={x} position={[x, 0.44, 0]} castShadow>
            <boxGeometry args={[0.22, 0.5, 0.85]} />
            <meshStandardMaterial color="#43514a" roughness={0.94} />
          </mesh>
        ))}
        {/* 三个靠垫 */}
        {[-0.8, 0, 0.8].map((x, i) => (
          <mesh key={x} position={[x, 0.62, -0.2]} rotation={[0.12, i * 0.08, 0]} castShadow>
            <boxGeometry args={[0.42, 0.4, 0.14]} />
            <meshStandardMaterial color={['#c58b5e', '#7f9a8c', '#b9a06a'][i]} roughness={0.95} />
          </mesh>
        ))}
      </group>

      {/* 矮桌 */}
      <mesh position={[0, 0.3, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.09, 0.62]} />
        <meshStandardMaterial color="#7c6247" roughness={0.7} />
      </mesh>
      {[
        [-0.48, -0.24],
        [0.48, -0.24],
        [-0.48, 0.24],
        [0.48, 0.24],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.14, 0.15 + z]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.28, 6]} />
          <meshStandardMaterial color="#5f4c37" roughness={0.7} />
        </mesh>
      ))}
      {/* 桌上：一盏小台灯 + 一摞书 */}
      <mesh position={[-0.3, 0.44, 0.15]}>
        <cylinderGeometry args={[0.08, 0.1, 0.24, 12]} />
        <meshStandardMaterial color="#d8ccb2" roughness={0.6} />
      </mesh>
      <mesh position={[-0.3, 0.58, 0.15]}>
        <coneGeometry args={[0.15, 0.14, 14]} />
        <meshStandardMaterial color="#f1d9a6" emissive="#e8bf78" emissiveIntensity={0.5} roughness={0.7} />
      </mesh>
      <pointLight position={[-0.3, 0.7, 0.15]} color="#ffd39a" intensity={0.9} distance={3.4} decay={2} />
      <mesh position={[0.35, 0.39, 0.1]} rotation={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.28, 0.09, 0.2]} />
        <meshStandardMaterial color="#9c6f4f" roughness={0.9} />
      </mesh>

      {/* 书架：靠墙一侧，和沙发垂直 */}
      <group position={[rugW / 2 - 0.15, 0, rugD / 2 - 0.9]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 1.8, 0.32]} />
          <meshStandardMaterial color="#6e553d" roughness={0.78} />
        </mesh>
        {[0.45, 0.85, 1.25, 1.65].map((y) => (
          <mesh key={y} position={[0, y, 0.17]}>
            <boxGeometry args={[1.5, 0.03, 0.02]} />
            <meshStandardMaterial color="#4f3d2b" roughness={0.8} />
          </mesh>
        ))}
        {/* 书脊：用几块不同高度的板随便立着，比整齐的一排像真的 */}
        {[0.28, 0.72, 1.12, 1.52].flatMap((y, row) =>
          [-0.55, -0.3, -0.05, 0.22, 0.48].map((x, i) => (
            <mesh key={`${row}-${i}`} position={[x, y + 0.11, 0.13]} castShadow>
              <boxGeometry args={[0.07, 0.2 - ((i + row) % 3) * 0.03, 0.16]} />
              <meshStandardMaterial
                color={['#9c5f52', '#4f6b73', '#8a7a4a', '#6b5a7a', '#a98a5c'][(i + row) % 5]}
                roughness={0.9}
              />
            </mesh>
          )),
        )}
      </group>

      {/* 住户照片墙：小画框排成两行，挂在沙发背后的墙上 */}
      <group position={[0, 1.55, -rugD / 2 + 0.12]}>
        <mesh position={[0, 0, -0.02]}>
          <boxGeometry args={[2.5, 1.15, 0.04]} />
          <meshStandardMaterial color="#3f4a44" roughness={0.75} />
        </mesh>
        {photos.slice(0, 4).map((tex, i) => (
          <mesh key={i} position={[-0.94 + (i % 2) * 0.63, i < 2 ? 0.28 : -0.28, 0.03]}>
            <planeGeometry args={[0.46, 0.36]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
        ))}
      <mesh position={[0.86, 0, 0.03]}>
        <planeGeometry args={[0.5, 0.24]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      </group>

      {/* 落地灯 */}
      <group position={[-rugW / 2 + 0.4, 0, -rugD / 2 + 0.5]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.16, 0.18, 0.04, 16]} />
          <meshStandardMaterial color="#3c3a35" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.82, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 1.6, 8]} />
          <meshStandardMaterial color="#3c3a35" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.68, 0]}>
          <coneGeometry args={[0.26, 0.3, 16, 1, true]} />
          <meshStandardMaterial color="#efe0c2" side={2} roughness={0.85} emissive="#e9c78e" emissiveIntensity={0.35} />
        </mesh>
        <pointLight position={[0, 1.55, 0]} color="#ffdcab" intensity={1.1} distance={4.5} decay={2} />
      </group>
    </group>
  )
}

/** 客厅的交互点：站在沙发前按 E，读一句这间屋子的用途。 */
export function loungeInteractable(box: RoomBox, lift: { x: number; z: number }) {
  const spot = loungeSpot(box, lift)
  // 往房间中心退 1.6m：门口站着就能触发，不用挤到沙发里
  return {
    id: 'building-lounge',
    label: '公共客厅',
    hint: '整栋楼住户共用 · 墙上是楼里的照片',
    x: spot.x,
    z: spot.z + (spot.yaw ? -1.6 : 1.6),
    radius: 2.8,
    action: () =>
      useApp
        .getState()
        .showToast(
          `公共客厅：谁都能在这儿坐一会儿。墙上挂着 ${PHOTO_TITLES.length} 张住户照片——等有了头像，就会换成真人。`,
        ),
  }
}
