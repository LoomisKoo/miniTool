import { Fragment, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { bake, bakeHalves, clampCrop, frame, FIT, loadImage, MAX_ZOOM, MIN_ZOOM, type Crop } from './crop'
import { bakeSize, templates, type Slot, type Template } from './templates'
import { presetsFor, wallPresets } from './presets'
import observeSize from './observeSize'
import { effectDefs, fxFull, MAX_FX, type EffectId, type Fx, type FxLevel } from './effects'
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
    return observeSize(el, () => setBox({ w: el.clientWidth, h: el.clientHeight }))
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

/** 特效强度的四档：无 / 弱 / 中 / 强 */
const LEVELS: { v: FxLevel; text: string }[] = [
  { v: 0, text: '无' },
  { v: 1, text: '弱' },
  { v: 2, text: '中' },
  { v: 3, text: '强' },
]

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

/** 换素材：内置还是上传。上传作为列表第一格，内置素材排在其后 */
function AssetPicker({ slot, template, current, onClose, onPreset, onUpload, onClear }: {
  slot: Slot
  template: Template
  current?: Asset
  onClose: () => void
  onPreset: (id: string) => void
  onUpload: () => void
  onClear: () => void
  }) {
  const all = presetsFor(slot.kind)
  // 收放都走同一条路径：先播放退出动画，再让父组件卸载，避免直接消失
  const [closing, setClosing] = useState(false)
  const leave = (after: () => void) => {
    if (closing) return
    setClosing(true)
    window.setTimeout(after, 200)
  }
  const close = () => leave(onClose)
  // 素材所有主题共用，只把本主题推荐的排在前面
  const pinned = slot.kind === 'wall' ? template.walls : slot.kind === 'floor' ? template.floors : template.stickers
  const list = [...all.filter((p) => pinned.includes(p.id)), ...all.filter((p) => !pinned.includes(p.id))]
  const hint = slot.kind === 'wall'
    ? '内置背景会同时铺满左右两页'
    : slot.kind === 'floor'
      ? '内置地面也可以换成自己的图片'
      : '内置贴纸，也可以换成自己的图片'
  const isImg = current?.kind === 'img'
  return (
    <div
      className={`ed-modal ${closing ? 'is-closing' : ''}`}
      onPointerDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="ed-picker">
        <header>
          <b>{slot.label}</b>
          <span>{hint}</span>
        </header>

        <div className={`ed-preset-grid ${slot.kind === 'subject' ? '' : 'is-wall'}`}>
          {/* 上传是第一格：没有图时是加号，有图就显示裁好的结果，右上角可以删掉 */}
          <div className={`ed-preset ed-upload-tile ${isImg ? 'has-img' : ''}`}>
            <button
              type="button"
              className="ed-upload-hit"
              onClick={() => leave(onUpload)}
              aria-label="上传图片"
            >
              <span className="ed-preset-thumb">
                {isImg ? <img src={current.src} alt="" /> : <i className="ed-upload-plus">＋</i>}
              </span>
              <span>上传图片</span>
            </button>
            {isImg && (
              <button
                type="button"
                className="ed-preset-del"
                onClick={onClear}
                aria-label="去掉这张图片"
              >
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`ed-preset ${current?.kind === 'preset' && current.id === p.id ? 'is-on' : ''}`}
              onClick={() => leave(() => onPreset(p.id))}
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
      </div>

      {/* 关闭键在整张 sheet 外面，底部居中 */}
      <button type="button" className="ed-modal-close" onClick={close}>关闭</button>
    </div>
  )
}

export default function Editor({ template, onTemplate, assets, onSlot, onPick, pages, active, onActive, onAdd, onRemove, onClose, picked, fx, onEffect, onClearFx, onClearSlot }: {
  template: Template
  onTemplate: (id: string) => void
  assets: Assets
  /** 打开素材选择页 */
  onSlot: (slot: Slot) => void
  /** 只选中：书页上给对应纸片描边 */
  onPick: (id: string) => void
  pages: { key: string; name: string }[]
  active: number
  onActive: (i: number) => void
  onAdd: () => void
  onRemove: () => void
  onClose: () => void
  /** 书页上被点中的槽位：菜单项高亮并自动滚到可见位置 */
  picked?: string | null
  /** 当前页自己的场景特效 */
  fx: Fx[]
  onEffect: (id: EffectId, level: FxLevel) => void
  /** 清空当前页所有特效 */
  onClearFx: () => void
  /** 清掉某个槽位的素材（背景和地面不在此列） */
  onClearSlot: (id: string) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  // 主题 / 特效 是同一个层级的两个 tab：贴纸归在主题下面
  const [tab, setTab] = useState<'theme' | 'fx'>('theme')
  useEffect(() => {
    if (!picked) return
    const el = listRef.current?.querySelector(`[data-slot="${picked}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [picked])

  // 删除页是破坏性操作：先就地确认，换页或取消就收起
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => setConfirmDel(false), [active])

  const levelOf = (id: EffectId) => fx.find((f) => f.id === id)?.level ?? 0
  const full = fxFull(fx)

  // 背景和地面是整本书的框架，铺在最上面；贴纸按左右页分两列
  const frameSlots = template.slots.filter((s) => s.kind !== 'subject')
  const sideSlots = (side: 'left' | 'right') => template.slots.filter((s) => s.kind === 'subject' && s.side === side)

  const slotItem = (s: Slot, compact = false) => {
    // 整张背景的槽位实际存在 wallL / wallR 里
    const asset = assets[s.id] ?? (s.halves ? assets.wallL : undefined)
    // 背景和地面是整本书的框架，只能换不能删
    const removable = s.kind === 'subject'
    // 分栏后每格只有半宽，前缀「左页 · 」交给列表头，条目里只留「前景」这种短名
    const name = compact ? s.label.split(' · ').pop() ?? s.label : s.label
    return (
      <div
        key={s.id}
        data-slot={s.id}
        className={`ed-slot ${compact ? 'is-compact' : ''} ${s.id === picked ? 'is-pick' : ''}`}
      >
        {/* 点条目只是选中（书页上亮边框），不打开选择页 */}
        <button type="button" className="ed-slot-main" onClick={() => onPick(s.id)}>
          <span className="ed-thumb">
            <AssetThumb asset={asset} slot={s} />
          </span>
          <span className="ed-slot-txt">
            <b>{name}</b>
            {asset?.kind === 'empty' && <span>空位</span>}
            {!asset && <span>未选择</span>}
          </span>
        </button>
        <div className="ed-slot-acts">
          {removable && (
            <button
              type="button"
              className="ed-slot-act"
              onClick={() => onClearSlot(s.id)}
              disabled={!asset || asset.kind === 'empty'}
              aria-label={`删除${s.label}`}
              title="删除这个位置的素材"
            >
              <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                <path
                  d="M3.2 4.6h9.6M6.4 4.6V3.2h3.2v1.4M4.4 4.6l.6 8.2h6l.6-8.2M6.6 6.8v4M9.4 6.8v4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          {/* 只有这个键才打开素材选择页 */}
          <button
            type="button"
            className="ed-slot-act"
            onClick={() => onSlot(s)}
            aria-label={`更换${s.label}`}
            title="更换素材"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path
                d="M11.2 2.8l2 2-7.2 7.2-2.6.6.6-2.6 7.2-7.2ZM10 4l2 2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ed-drawer">
      <header className="ed-head">
        <div>
          <h2>{template.name}</h2>
          <p>{template.summary}</p>
        </div>
        <button type="button" className="ed-close" onClick={onClose} aria-label="关闭制作面板">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      </header>

      <div className="ed-body">
        <section>
          {/* 横向一条，像相册的页缩略：翻着找比网格更顺手；新增键跟在当前页后面，插在哪儿一眼可见 */}
          <div className="ed-pages">
            {pages.map((p, i) => (
              <Fragment key={p.key}>
                <div className={`ed-page-wrap ${i === active ? 'is-on' : ''}`}>
                  <button
                    type="button"
                    className={`ed-page ${i === active ? 'is-on' : ''}`}
                    onClick={() => onActive(i)}
                  >
                    <b>{i + 1}</b>
                    <span>{p.name}</span>
                  </button>
                  {/* 删除只挂在当前页的角上：一眼知道删的是哪一页 */}
                  {i === active && pages.length > 1 && (
                    <button
                      type="button"
                      className="ed-page-del"
                      onClick={() => setConfirmDel(true)}
                      aria-label="删除这一页"
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                        <path
                          d="M3.2 4.6h9.6M6.4 4.6V3.2h3.2v1.4M4.4 4.6l.6 8.2h6l.6-8.2M6.6 6.8v4M9.4 6.8v4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                {i === active && (
                  <button
                    type="button"
                    className="ed-page ed-page-insert"
                    onClick={onAdd}
                    aria-label="在后面插入一页"
                  >
                    <b>＋</b>
                  </button>
                )}
              </Fragment>
            ))}
          </div>
          {confirmDel && (
            <div className="ed-confirm" role="alertdialog" aria-label="确认删除这一页">
              <span>删除这一页？</span>
              <button type="button" onClick={() => setConfirmDel(false)}>取消</button>
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  setConfirmDel(false)
                  onRemove()
                }}
              >删除</button>
            </div>
          )}
        </section>

        <div className="ed-tabbar">
          <div className="ed-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'theme'}
              className={`ed-tab ${tab === 'theme' ? 'is-on' : ''}`}
              onClick={() => setTab('theme')}
            >主题</button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'fx'}
              className={`ed-tab ${tab === 'fx' ? 'is-on' : ''}`}
              onClick={() => setTab('fx')}
            >特效</button>
          </div>
        </div>

        {tab === 'theme' ? (
          <>
            <section>
              <div className="ed-tpls">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`ed-tpl ${t.id === template.id ? 'is-on' : ''}`}
                    onClick={() => onTemplate(t.id)}
                    title={t.summary}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <p className="ed-note">换主题会按场景重新铺好背景、地面、贴纸和氛围特效。</p>
            </section>

            <section>
              <div className="ed-slots-wrap" ref={listRef}>
                {/* 背景、地面：整本书的框架，整行两张 */}
                <div className="ed-slots">{frameSlots.map((s) => slotItem(s))}</div>

                {/* 贴纸按左右页分两列：左列只放左页的，右列只放右页的 */}
                <div className="ed-slots-head">
                  <span>左页</span>
                  <span>右页</span>
                </div>
                <div className="ed-cols">
                  <div className="ed-col">{sideSlots('left').map((s) => slotItem(s, true))}</div>
                  <div className="ed-col">{sideSlots('right').map((s) => slotItem(s, true))}</div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section>
            <div className="ed-h3-row">
              <h3>
                场景特效
                <i className="ed-h3-note">只作用于当前页 · {fx.length}/{MAX_FX}</i>
              </h3>
              <button
                type="button"
                className="ed-fx-clear"
                onClick={onClearFx}
                disabled={!fx.length}
                title="清空当前页的所有特效"
              >清除</button>
            </div>
            <div className="ed-fxs">
              {effectDefs.map((e) => {
                const lv = levelOf(e.id)
                // 开满 4 个之后，还没开的不能再往上开
                const blocked = !lv && full
                return (
                  <div
                    key={e.id}
                    className={`ed-fx ${lv ? 'is-on' : ''} ${blocked ? 'is-locked' : ''}`}
                  >
                    <div className="ed-fx-top">
                      <span className="ed-fx-pic" aria-hidden>
                        <span className={`ed-fx-ico is-${e.id}`} />
                      </span>
                      <b>{e.label}</b>
                    </div>
                    <div
                      className="ed-fx-seg"
                      role="radiogroup"
                      aria-label={`${e.label}强度`}
                    >
                      {LEVELS.map((l) => (
                        <button
                          key={l.v}
                          type="button"
                          role="radio"
                          aria-checked={lv === l.v}
                          className={`ed-fx-opt ${lv === l.v ? 'is-on' : ''}`}
                          disabled={blocked && l.v !== 0}
                          onClick={() => onEffect(e.id, l.v)}
                          title={blocked && l.v !== 0 ? `最多同时开 ${MAX_FX} 个特效，先关掉一个` : e.hint}
                        >{l.text}</button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="ed-note">
              每页独立：翻页时会淡出，换成下一页自己的特效。最多同时开 {MAX_FX} 个。
            </p>
          </section>
        )}
      </div>
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
