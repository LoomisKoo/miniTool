import { useCallback, useMemo, useState } from 'react'
import PopupBook from './PopupBook'
import Editor, { AssetPicker, CropModal, renderSlot } from './Editor'
import { buildSpread, type Assets } from './build'
import { pickFile, type Crop } from './crop'
import { templates, type Slot, type Template } from './templates'

type PageState = { key: string; tplId: string; assets: Assets }

let seq = 0
/** 两套开场画面：一页月夜小镇，一页森林露营，直接把四层景深演示出来 */
const OPENERS: Assets[] = [
  {
    wallL: { kind: 'preset', id: 'night' },
    wallR: { kind: 'preset', id: 'night' },
    floor: { kind: 'preset', id: 'cobble' },
    'left-1': { kind: 'preset', id: 'windmill' },
    'left-2': { kind: 'preset', id: 'house' },
    'left-3': { kind: 'preset', id: 'girl' },
    'left-4': { kind: 'preset', id: 'cart' },
    'right-1': { kind: 'preset', id: 'row' },
    'right-2': { kind: 'preset', id: 'postoffice' },
    'right-3': { kind: 'preset', id: 'cat' },
    'right-4': { kind: 'preset', id: 'picnic' },
  },
  {
    wallL: { kind: 'preset', id: 'forest' },
    wallR: { kind: 'preset', id: 'forest' },
    floor: { kind: 'preset', id: 'grass' },
    'left-1': { kind: 'preset', id: 'pines' },
    'left-2': { kind: 'preset', id: 'deer' },
    'left-3': { kind: 'preset', id: 'campfire' },
    'left-4': { kind: 'preset', id: 'picnic' },
    'right-1': { kind: 'preset', id: 'tree' },
    'right-2': { kind: 'preset', id: 'owl' },
    'right-3': { kind: 'preset', id: 'girl-sit' },
    'right-4': { kind: 'preset', id: 'cart' },
  },
]

const newPage = (): PageState => {
  seq += 1
  return {
    key: `p${seq}`,
    tplId: templates[0].id,
    assets: { ...OPENERS[(seq - 1) % OPENERS.length] },
  }
}

const tplOf = (id: string): Template => templates.find((t) => t.id === id) ?? templates[0]

export default function PopupApp() {
  const [pages, setPages] = useState<PageState[]>(() => [newPage(), newPage()])
  const [active, setActive] = useState(0)
  const [picking, setPicking] = useState<Slot | null>(null)
  const [editing, setEditing] = useState<{ slot: Slot; src: string } | null>(null)
  const [open, setOpen] = useState(true)
  // 书页上点中的槽位：书里描边 + 菜单里高亮并滚过去
  const [picked, setPicked] = useState<string | null>(null)

  const pickSlot = useCallback((id: string) => {
    setPicked((cur) => (cur === id ? null : id))
  }, [])

  // 收起面板 = 阅读模式：清掉选中，虚线框和按钮都不该留在书上
  const toggleOpen = useCallback(() => {
    setOpen((v) => {
      if (v) setPicked(null)
      return !v
    })
  }, [])

  const changePage = useCallback((i: number) => {
    setActive(i)
    setPicked(null)
  }, [])

  const page = pages[active] ?? pages[0]
  const template = tplOf(page.tplId)
  const assets = page.assets

  // 每一页都按自己的模板和素材生成；页数变化时翻页范围跟着变
  const book = useMemo(
    () => pages.map((p, i) => buildSpread(tplOf(p.tplId), p.assets, i)),
    [pages],
  )
  const names = useMemo(
    () => pages.map((p) => tplOf(p.tplId).name),
    [pages],
  )

  const patch = useCallback((fn: (p: PageState) => PageState) => {
    setPages((list) => list.map((p, i) => (i === active ? fn(p) : p)))
  }, [active])

  const setAssets = useCallback((fn: (a: Assets) => Assets) => {
    patch((p) => ({ ...p, assets: fn(p.assets) }))
  }, [patch])

  const applyPreset = (id: string) => {
    const slot = picking
    if (!slot) return
    // 一套背景天生是左右一对，内置素材一次铺满两页
    setAssets((a) => (slot.kind === 'wall'
      ? { ...a, wallL: { kind: 'preset', id }, wallR: { kind: 'preset', id } }
      : { ...a, [slot.id]: { kind: 'preset', id } }))
    setPicking(null)
  }

  const upload = async () => {
    const slot = picking
    const picked = await pickFile()
    if (!picked || !slot) return
    setPicking(null)
    setEditing({ slot, src: picked.src })
  }

  const clearSlot = () => {
    const slot = picking
    if (!slot || slot.kind === 'wall' || slot.kind === 'floor') return
    // 不删除 key，而是留一个 empty：占位框还站在原地，用户随时可以再换回来
    setAssets((a) => ({ ...a, [slot.id]: { kind: 'empty' } }))
    setPicking(null)
  }

  /** 选中纸片右上角的两个按钮 */
  const slotAction = (id: string, action: 'switch' | 'clear') => {
    const slot = template.slots.find((s) => s.id === id)
    if (!slot) return
    if (action === 'clear') {
      if (slot.kind === 'wall' || slot.kind === 'floor') return
      setAssets((a) => ({ ...a, [id]: { kind: 'empty' } }))
      return
    }
    setPicking(slot)
  }

  const confirm = async (crop: Crop) => {
    if (!editing) return
    const { slot, src } = editing
    setEditing(null)
    const out = await renderSlot(slot, src, crop)
    // 槽位 id 决定写给哪一个位置；整张背景一次写 wallL / wallR 两项
    setAssets((a) => ({ ...a, ...out }))
  }

  const addPage = () => {
    const next = newPage()
    setPages((list) => {
      const out = [...list]
      out.splice(active + 1, 0, next)
      return out
    })
    changePage(active + 1)
  }

  const removePage = () => {
    if (pages.length < 2) return
    setPages((list) => list.filter((_, i) => i !== active))
    changePage(Math.max(0, Math.min(active, pages.length - 2)))
  }

  return (
    <PopupBook
      book={book}
      reserve={open ? 360 : 0}
      pageIndex={active}
      onPageIndex={changePage}
      locked={open}
      pickedSlot={open ? picked : null}
      onPickSlot={open ? pickSlot : undefined}
      onSlotAction={slotAction}
      overlay={
        <>
          <button
            type="button"
            className={`ed-toggle ${open ? 'is-on' : ''}`}
            onClick={toggleOpen}
            aria-expanded={open}
          >
            {open ? '收起' : '制作'}
          </button>
          <div className={open ? 'ed-wrap is-open' : 'ed-wrap'}>
            <Editor
              template={template}
              onTemplate={(id) => patch((p) => ({ ...p, tplId: id }))}
              assets={assets}
              onSlot={setPicking}
              pages={pages.map((p, i) => ({ key: p.key, name: names[i] }))}
              active={active}
              onActive={changePage}
              onAdd={addPage}
              onRemove={removePage}
              picked={picked}
            />
          </div>
          {picking && (
            <AssetPicker
              slot={picking}
              current={assets[picking.id] ?? (picking.halves ? assets.wallL : undefined)}
              onClose={() => setPicking(null)}
              onPreset={applyPreset}
              onUpload={upload}
              onClear={clearSlot}
            />
          )}
          {editing && (
            <CropModal
              src={editing.src}
              aspect={editing.slot.aspect}
              label={editing.slot.label}
              onCancel={() => setEditing(null)}
              onOk={confirm}
            />
          )}
        </>
      }
    />
  )
}
