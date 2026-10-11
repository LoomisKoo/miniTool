import { useMemo, type ReactElement } from 'react'
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useQuality } from '../hooks/useQuality'
import { useParams } from '../context/ParamsContext'

/**
 * 产品摄影后处理：微缩景深 + 轻泛光 + 暗角 + 色调映射。
 *
 * 注意：@react-three/postprocessing 的 EffectComposer 在合成时会强制
 * gl.toneMapping = NoToneMapping（见其源码的 toneMappingGuard），
 * 所以色调映射必须作为最后一个效果显式加入，否则画面会缺少高光滚降、发闷。
 */
export default function PostFX() {
  const { settings } = useQuality()
  const { params } = useParams()

  const effects = useMemo(() => {
    const list: ReactElement[] = []

    if (settings.dof) {
      list.push(
        <DepthOfField
          key="dof"
          focusDistance={params.camera.focusDistance}
          focalLength={params.camera.focalLength}
          bokehScale={params.camera.bokehScale}
          height={480}
        />,
      )
    }

    list.push(
      <Bloom key="bloom" intensity={0.34} luminanceThreshold={0.78} luminanceSmoothing={0.3} mipmapBlur />,
      <Vignette key="vignette" offset={0.32} darkness={0.34} />,
      <ToneMapping key="tonemap" mode={ToneMappingMode.ACES_FILMIC} />,
    )

    return list
  }, [settings.dof, params.camera.focusDistance, params.camera.focalLength, params.camera.bokehScale])

  if (!settings.postFX) return null

  return <EffectComposer multisampling={settings.level === 'high' ? 4 : 0}>{effects}</EffectComposer>
}
