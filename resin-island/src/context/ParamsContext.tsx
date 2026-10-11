import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { folder, useControls } from 'leva'

/**
 * 结构化的场景参数。注意：leva 的 useControls 返回值是**扁平**的
 * （key 为叶子名，folder() 只影响面板分组），因此这里把扁平值组装成嵌套结构，
 * 供全场景以 params.water.deepColor 这种可读方式消费。
 */
export interface SceneParams {
  water: {
    deepColor: string
    shallowColor: string
  }
  surface: {
    waveHeight: number
    rippleStrength: number
    foam: number
    tide: number
  }
  sun: {
    azimuth: number
    elevation: number
    intensity: number
  }
  jelly: {
    softness: number
    tilt: number
  }
  camera: {
    focusDistance: number
    focalLength: number
    bokehScale: number
  }
}

interface ParamsContextValue {
  /** 响应式参数（驱动 React 侧属性） */
  params: SceneParams
  /** 每帧可读的最新参数（驱动 shader uniform，不触发重渲染） */
  paramsRef: RefObject<SceneParams>
}

const ParamsContext = createContext<ParamsContextValue | null>(null)

export function ParamsProvider({ children }: { children: ReactNode }) {
  const v = useControls({
    水体: folder(
      {
        deepColor: { value: '#0d6b5c', label: '深水色' },
        shallowColor: { value: '#7fe6d2', label: '浅水色' },
      },
      { collapsed: false },
    ),
    水面: folder({
      waveHeight: { value: 0.12, min: 0, max: 0.5, step: 0.005, label: '浪高' },
      rippleStrength: { value: 1.0, min: 0, max: 3, step: 0.01, label: '涟漪强度' },
      foam: { value: 0.5, min: 0, max: 1, step: 0.01, label: '岸边泡沫' },
      tide: { value: 0, min: -1, max: 1, step: 0.01, label: '潮位' },
    }),
    光照: folder({
      sunAzimuth: { value: 46, min: 0, max: 360, step: 1, label: '太阳方位' },
      sunElevation: { value: 40, min: 3, max: 88, step: 1, label: '太阳高度' },
      sunIntensity: { value: 2.2, min: 0, max: 6, step: 0.05, label: '日照强度' },
    }),
    果冻: folder({
      jellySoftness: { value: 0.42, min: 0, max: 1, step: 0.01, label: '果冻软硬' },
      jellyTilt: { value: 0.09, min: 0, max: 0.35, step: 0.005, label: '摆动幅度' },
    }),
    相机: folder({
      focusDistance: { value: 0.014, min: 0, max: 0.2, step: 0.001, label: '焦平面' },
      focalLength: { value: 0.045, min: 0.001, max: 0.25, step: 0.001, label: '景深范围' },
      bokehScale: { value: 3.2, min: 0, max: 9, step: 0.1, label: '景深强度' },
    }),
  })

  const params = useMemo<SceneParams>(
    () => ({
      water: { deepColor: v.deepColor, shallowColor: v.shallowColor },
      surface: {
        waveHeight: v.waveHeight,
        rippleStrength: v.rippleStrength,
        foam: v.foam,
        tide: v.tide,
      },
      sun: { azimuth: v.sunAzimuth, elevation: v.sunElevation, intensity: v.sunIntensity },
      jelly: { softness: v.jellySoftness, tilt: v.jellyTilt },
      camera: {
        focusDistance: v.focusDistance,
        focalLength: v.focalLength,
        bokehScale: v.bokehScale,
      },
    }),
    [
      v.deepColor,
      v.shallowColor,
      v.waveHeight,
      v.rippleStrength,
      v.foam,
      v.tide,
      v.sunAzimuth,
      v.sunElevation,
      v.sunIntensity,
      v.jellySoftness,
      v.jellyTilt,
      v.focusDistance,
      v.focalLength,
      v.bokehScale,
    ],
  )

  const paramsRef = useRef<SceneParams>(params)
  paramsRef.current = params

  const value = useMemo<ParamsContextValue>(() => ({ params, paramsRef }), [params])

  return <ParamsContext.Provider value={value}>{children}</ParamsContext.Provider>
}

export function useParams() {
  const ctx = useContext(ParamsContext)
  if (!ctx) throw new Error('useParams 必须在 ParamsProvider 内使用')
  return ctx
}
