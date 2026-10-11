import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type QualityLevel = 'high' | 'low'

export interface QualitySettings {
  level: QualityLevel
  dpr: [number, number]
  /** 高度场模拟分辨率 */
  waterSim: number
  /** 水面网格分段 */
  waterSeg: number
  /** 树脂块折射采样数 */
  transSamples: number
  /** 树脂块折射缓冲分辨率 */
  transResolution: number
  /** 阴影贴图尺寸 */
  shadowMap: number
  postFX: boolean
  dof: boolean
}

const HIGH: QualitySettings = {
  level: 'high',
  dpr: [1, 2],
  waterSim: 256,
  waterSeg: 160,
  transSamples: 6,
  transResolution: 1024,
  shadowMap: 2048,
  postFX: true,
  dof: true,
}

const LOW: QualitySettings = {
  level: 'low',
  dpr: [1, 1.5],
  waterSim: 128,
  waterSeg: 72,
  transSamples: 3,
  transResolution: 768,
  shadowMap: 1024,
  postFX: true,
  dof: false,
}

function detectLevel(): QualityLevel {
  if (typeof window === 'undefined') return 'high'
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const small = Math.min(window.innerWidth, window.innerHeight) < 760
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4
  return coarse || small || fewCores ? 'low' : 'high'
}

interface QualityContextValue {
  settings: QualitySettings
  level: QualityLevel
  setLevel: (l: QualityLevel) => void
}

const QualityContext = createContext<QualityContextValue | null>(null)

export function QualityProvider({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState<QualityLevel>(detectLevel)
  const value = useMemo<QualityContextValue>(
    () => ({
      level,
      setLevel,
      settings: level === 'high' ? HIGH : LOW,
    }),
    [level],
  )
  return <QualityContext.Provider value={value}>{children}</QualityContext.Provider>
}

export function useQuality() {
  const ctx = useContext(QualityContext)
  if (!ctx) throw new Error('useQuality 必须在 QualityProvider 内使用')
  return ctx
}
