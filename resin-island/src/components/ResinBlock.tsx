import { useMemo } from 'react'
import { MeshTransmissionMaterial, RoundedBox } from '@react-three/drei'
import { BLOCK } from '../config/scene'
import { createWaterUniforms } from '../materials/waterMaterial'
import { createSeabedUniforms } from '../materials/seabedMaterial'
import { useWaterHeightfield } from '../hooks/useWaterHeightfield'
import { useQuality } from '../hooks/useQuality'
import { useParams } from '../context/ParamsContext'
import WaterSurface from './WaterSurface'
import Seabed from './Seabed'
import Island from './Island'
import Rocks from './Rocks'

/**
 * 树脂块：块体本身即海水（透射 + 体积吸收得到青绿），
 * 内部包住海床 / 岛屿 / 岩石，顶面是动态水面。
 *
 * 内部内容全部通过块体的透射缓冲呈现（drei 会把整个场景渲进自己的 FBO，
 * 因此半透明水面也会被正确混合进去），块体只需正常写深度即可。
 */
export default function ResinBlock() {
  const { settings } = useQuality()
  const { params, paramsRef } = useParams()

  const waterUniforms = useMemo(() => createWaterUniforms(), [])
  const seabedUniforms = useMemo(() => {
    const u = createSeabedUniforms()
    u.uHeight = waterUniforms.uHeight // 焦散与水面高度场同步
    return u
  }, [waterUniforms])

  const { setPointer } = useWaterHeightfield({
    resolution: settings.waterSim,
    uniforms: waterUniforms,
    paramsRef,
  })

  return (
    <group>
      <Seabed uniforms={seabedUniforms} />
      <Island />
      <Rocks />
      <WaterSurface uniforms={waterUniforms} setPointer={setPointer} />

      <RoundedBox
        args={[BLOCK.size, BLOCK.height, BLOCK.size]}
        radius={BLOCK.radius}
        smoothness={8}
        castShadow={false}
        receiveShadow={false}
      >
        <MeshTransmissionMaterial
          samples={settings.transSamples}
          resolution={settings.transResolution}
          backsideResolution={1}
          transmission={1}
          thickness={1.6}
          roughness={0.075}
          ior={1.36}
          chromaticAberration={0.06}
          anisotropicBlur={0.12}
          distortion={0.12}
          distortionScale={0.28}
          temporalDistortion={0.08}
          color="#f2fffb"
          attenuationColor={params.water.deepColor}
          attenuationDistance={2.0}
          envMapIntensity={1.6}
          backside={false}
        />
      </RoundedBox>
    </group>
  )
}
