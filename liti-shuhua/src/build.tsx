import type { ReactNode } from 'react'
import type { Layer, Spread } from './spreads'
import { WALL_ASPECT, type Slot, type Template } from './templates'
import { floorPreset, subjectPreset, wallPreset } from './presets'

/** 一个槽位里的内容是“上传的位图”“内置剪纸素材”，或用户清空后留下的白框占位 */
export type Asset =
  | { kind: 'img'; src: string; aspect?: number }
  | { kind: 'preset'; id: string }
  | { kind: 'empty' }
export type Assets = Record<string, Asset>

/** 上传图按槽位比例画；内置剪纸按它自己的宽高比、且不超过 maxH 地缩进槽位 */
function fitWidth(slot: Slot, aspect: number) {
  const w = slot.w ?? 300
  if (!slot.maxH) return w
  return Math.min(w, aspect * slot.maxH)
}

function node(asset: Asset | undefined, aspect: number, side: 'left' | 'right', print = false): ReactNode {
  if (!asset) return undefined
  // 清空后保留一个白色虚线框占位，位置和“立起来”的行为都还在，只是没有内容
  if (asset.kind === 'empty') {
    return <div className="pb-empty" style={{ aspectRatio: String(aspect) }} />
  }
  if (asset.kind === 'img') {
    // print：贴纸层的照片印成相片纸（白边），背景墙上的图不加边框
    return (
      <img
        className={'pb-slot-img' + (print ? ' is-print' : '')}
        src={asset.src}
        alt=""
        style={{ aspectRatio: String(aspect) }}
      />
    )
  }
  const s = subjectPreset(asset.id)
  if (s) return s.art()
  const f = floorPreset(asset.id)
  if (f) return f.art()
  const w = wallPreset(asset.id)
  if (w) return w.art(side)
  return undefined
}

export function buildSpread(tpl: Template, assets: Assets, index = 0, draft = false): Spread {
  const layers = (side: 'left' | 'right'): Layer[] =>
    tpl.slots
      .filter((s) => s.kind !== 'wall' && s.side === side && assets[s.id])
      .map((s) => {
        const a = assets[s.id]
        const preset = a.kind === 'preset' ? subjectPreset(a.id) : undefined
        // 内置主体用剪纸自己的比例，上传图和占位框用槽位比例；
        // 预置的宣传照片自带 4:5，按自己的比例立起来才不会被横向裁掉人脸
        const aspect = (a.kind === 'img' && a.aspect) || preset?.aspect || s.aspect
        return {
          art: node(a, aspect, side, a.kind === 'img') ?? <div className="pb-wall-blank" />,
          x: s.x ?? 250,
          y: s.y ?? 460,
          w: fitWidth(s, aspect),
          // 地面的框按槽位比例给死高度，窄画幅的地面素材（贝壳、碎石）按框等比缩，
          // 不会因为只按宽度缩放而往书页下面溢出
          h: s.flat ? (s.w ?? 300) / (s.aspect || 4) : undefined,
          flat: s.flat,
          rot: s.rot,
          id: s.id,
          // 白色虚线占位不是纸片：不给它投影和折痕
          empty: a.kind === 'empty',
        }
      })

  // 整张背景时左右墙都指向同一个槽位，点哪面墙都高亮同一个菜单项
  const single = tpl.slots.find((s) => s.kind === 'wall' && s.halves)?.id
  return {
    title: tpl.name,
    sub: `PAGE ${String(index + 1).padStart(2, '0')}`,
    text: '',
    page: tpl.page,
    dots: tpl.dots,
    wallLeft: node(assets.wallL, WALL_ASPECT, 'left') ?? <div className="pb-wall-blank" />,
    wallRight: node(assets.wallR, WALL_ASPECT, 'right') ?? <div className="pb-wall-blank" />,
    wallLeftId: single ?? 'wallL',
    wallRightId: single ?? 'wallR',
    // 背景和地面是整本书的框架，不能移除
    locked: tpl.slots.filter((s) => s.kind === 'wall' || s.kind === 'floor').map((s) => s.id),
    draft,
    left: layers('left'),
    right: layers('right'),
  }
}
