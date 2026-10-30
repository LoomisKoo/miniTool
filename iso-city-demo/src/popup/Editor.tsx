import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { bake, bakeHalves, clampCrop, frame, FIT, loadImage, MAX_ZOOM, MIN_ZOOM, type Crop } from './crop'
import { bakeSize, templates, type Slot, type Template } from './templates'
import { presetsFor, wallPresets } from './presets'
import type { Asset, Assets } from './build'
import './editor.css'

/** 裁剪弹层：拖动平移、滚轮/双指/滑杆缩放，预览和最终烘图用同一套 frame() */
function CropModal({ src, aspect, label, onCancel, onOk }: {
  src: string
  aspect: number
  label: string
  onCancel: () => void
  onOk: (c: Crop) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [crop, setCrop] = useState<Crop>(FIT)
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const grab = useRef<{ x: number; y: number; dist: number; crop: Crop } | null>(null)

  useEffect(() => {
    loadImage(src).then((img) => setNatural({ w: img.naturalWidth, h: img.naturalHeight }))
  }, [src])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setBox({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const apply = (next: Crop) => {
    if (!natural.w || !box.w) return setCrop(next)
    setCrop(clampCrop(natural.w, natural.h, box.w, box.h, next))
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const all = [...pts.current.values()]
    if (all.length === 1) grab.current = { x: all[0].x, y: all[0].y, dist: 0, crop }
    else if (all.length === 2) {
      grab.current = {
        x: (all[0].x + all[1].x) / 2,
        y: (all[0].y + all[1].y) / 2,
        dist: Math.hypot(all[0].x - all[1].x, all[0].y - all[1].y),
        crop,
      }
    }
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pts.current.has(e.pointerId)) return
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = grab.current
    if (!g || !box.w) return
    const all = [...pts.current.values()]
    const mx = all.length > 1 ? (all[0].x + all[1].x) / 2 : e.clientX
    const my = all.length > 1 ? (all[0].y + all[1].y) / 2 : e.clientY
    const dist = all.length > 1 ? Math.hypot(all[0].x - all[1].x, all[0].y - all[1].y) : 0
    const zoom = g.dist > 0 && dist > 0 ? g.crop.zoom * (dist / g.dist) : g.crop.zoom
    apply({ zoom, x: g.crop.x + (mx - g.x) / box.w, y: g.crop.y + (my - g.y) / box.h })
  }

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    pts.current.delete(e.pointerId)
    const all = [...pts.current.values()]
    grab.current = all.length ? { x: all[0].x, y: all[0].y, dist: 0, crop } : null
  }

  const f = natural.w && box.w ? frame(natural.w, natural.h, box.w, box.h, crop) : null

  return (
    <div className="ed-modal">
      <div className="ed-crop">
        <header>
          <b>{label}</b>
          <span>拖动调整位置 · 滚轮或双指缩放</span>
        </header>
        <div
          ref={boxRef}
          className="ed-crop-box"
          style={{ '--ar': aspect } as CSSProperties}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={(e) => apply({ ...crop, zoom: crop.zoom * Math.exp(-e.deltaY * 0.0015) })}
        >
          {f && <img src={src} alt="" draggable={false} style={{ left: f.dx, top: f.dy, width: f.dw, height: f.dh }} />}
          <div className="ed-crop-grid" />
        </div>
        <div className="ed-crop-tools">
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={crop.zoom}
            onChange={(e) => apply({ ...crop, zoom: Number(e.target.value) })}
            aria-label="缩放"
          />
          <button type="button" onClick={() => apply(FIT)}>复位</button>
        </div>
        <footer>
          <button type="button" onClick={onCancel}>取消</button>
          <button type="button" className="primary" onClick={() => onOk(crop)}>使用这张</button>
        </footer>
      </div>
    </div>
  )
}

/** 缩略图：上传的位图直接显示，内置素材则把剪纸组件画在缩略框里 */
function AssetThumb({ asset, slot }: { asset?: Asset; slot: Slot }) {
  // 清空过的槽位：虚线框里放个加号，提示还能再放东西
  if (asset?.kind === 'empty') return <i className="is-empty">＋</i>
  if (asset?.kind === 'img') return <img src={asset.src} alt="" />
  if (asset?.kind === 'preset') {
    const art: ReactNode = slot.kind === 'wall'
      ? wallPresets.find((p) => p.id === asset.id)?.art(slot.side)
      : presetsFor(slot.kind).find((p) => p.id === asset.id)?.art(slot.side)
    return <span className="ed-preset-fit">{art}</span>
  }
  return <i>＋</i>
}

/** 换素材：内置还是上传 */
function AssetPicker({ slot, current, onClose, onPreset, onUpload, onClear }: {
  slot: Slot
  current?: Asset
  onClose: () => void
  onPreset: (id: string) => void
  onUpload: () => void
  onClear: () => void
}) {
  const list = presetsFor(slot.kind)
  const hint = slot.kind === 'wall'
    ? '内置背景会同时铺满左右两页'
    : slot.kind === 'floor'
      ? '内置地面也可以换成自己的图片'
      : '内置剪纸素材，也可以换成自己的图片'
  return (
    <div className="ed-modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ed-picker">
        <header>
          <b>{slot.label}</b>
          <span>{hint}</span>
        </header>

        <button type="button" className="ed-upload" onClick={onUpload}>上传图片</button>

        {list.length > 0 && (
          <div className="ed-preset-grid">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`ed-preset ${current?.kind === 'preset' && current.id === p.id ? 'is-on' : ''}`}
                onClick={() => onPreset(p.id)}
              >
                <span className="ed-preset-thumb">{p.art(slot.side)}</span>
                {(() => {
                  const [group, name] = p.label.split(' · ')
                  return name
                    ? <><i className="ed-preset-tag">{group}</i><span>{name}</span></>
                    : <span>{p.label}</span>
                })()}
              </button>
            ))}
          </div>
        )}

        <footer>
          {/* 背景和地面是整本书的框架，只能换不能清空 */}
          {current && slot.kind !== 'wall' && slot.kind !== 'floor' && (
            <button type="button" onClick={onClear}>清空这个槽位</button>
          )}
          <button type="button" onClick={onClose}>关闭</button>
        </footer>
      </div>
    </div>
  )
}

export default function Editor({ template, onTemplate, assets, onSlot, pages, active, onActive, onAdd, onRemove, picked }: {
  template: Template
  onTemplate: (id: string) => void
  assets: Assets
  onSlot: (slot: Slot) => void
  pages: { key: string; name: string }[]
  active: number
  onActive: (i: number) => void
  onAdd: () => void
  onRemove: () => void
  /** 书页上被点中的槽位：菜单项高亮并自动滚到可见位置 */
  picked?: string | null
}) {
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!picked) return
    const el = listRef.current?.querySelector(`[data-slot="${picked}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [picked])

  return (
    <div className="ed-drawer">
      <section>
        <h3>页</h3>
        <div className="ed-pages">
          {pages.map((p, i) => (
            <button
              key={p.key}
              type="button"
              className={`ed-page ${i === active ? 'is-on' : ''}`}
              onClick={() => onActive(i)}
            >
              <b>{i + 1}</b>
              <span>{p.name}</span>
            </button>
          ))}
          <button type="button" className="ed-page ed-page-add" onClick={onAdd} aria-label="新增一页">
            <b>＋</b>
            <span>新页</span>
          </button>
        </div>
        <button type="button" className="ed-clear" onClick={onRemove} disabled={pages.length < 2}>
          删除第 {active + 1} 页
        </button>
      </section>

      <section>
        <h3>模板</h3>
        <div className="ed-tpls">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ed-tpl ${t.id === template.id ? 'is-on' : ''}`}
              onClick={() => onTemplate(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>内容</h3>
        <div className="ed-slots" ref={listRef}>
          {template.slots.map((s) => {
            // 整张背景的槽位实际存在 wallL / wallR 里
            const asset = assets[s.id] ?? (s.halves ? assets.wallL : undefined)
            return (
              <button
                key={s.id}
                type="button"
                data-slot={s.id}
                className={`ed-slot ${s.id === picked ? 'is-pick' : ''}`}
                onClick={() => onSlot(s)}
              >
                <span className="ed-thumb" style={{ aspectRatio: String(s.aspect) }}>
                  <AssetThumb asset={asset} slot={s} />
                </span>
                <span className="ed-slot-txt">
                  <b>{s.label}</b>
                  <span>
                    {asset?.kind === 'empty'
                      ? '空位 · 点书上的 ⇄ 或这里放入素材'
                      : asset ? '点击更换素材' : '内置素材 / 上传图片'}
                  </span>
                </span>              </button>
            )
          })}
        </div>
      </section>

      <p className="ed-note">位置由模板固定，图片只需拖动和缩放裁剪。</p>
    </div>
  )
}

/** 把槽位的裁剪结果烘成位图；整张背景会拆成左右两半 */
export async function renderSlot(slot: Slot, src: string, crop: Crop): Promise<Assets> {
  const { w, h } = bakeSize(slot)
  if (slot.halves) {
    const [left, right] = await bakeHalves(src, w, h, crop)
    return { wallL: { kind: 'img', src: left }, wallR: { kind: 'img', src: right } }
  }
  return { [slot.id]: { kind: 'img', src: await bake(src, w, h, crop) } }
}

export { AssetPicker, CropModal }
