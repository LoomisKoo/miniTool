import type { Gender, Temper } from './types'

export interface Portrait {
  char: string
  color: string
  color2?: string
  /** 用于程序化立绘 */
  seed?: string
  gender?: Gender
  temper?: Temper
  faceId?: string
}

export interface DialogOption {
  label: string
  hint?: string
  disabled?: boolean
  run?: (g: import('./types').GameState) => Dialog | string | void
}

export interface Dialog {
  title?: string
  speaker?: string
  sub?: string
  portrait?: Portrait
  text: string
  /** 旁白模式：无立绘，全屏叙事 */
  narrate?: boolean
  options?: DialogOption[]
}
