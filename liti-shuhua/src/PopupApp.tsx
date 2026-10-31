import { useCallback, useMemo, useState } from 'react'
import PopupBook from './PopupBook'
import Editor, { AssetPicker, CropModal, renderSlot } from './Editor'
import { buildSpread, type Assets } from './build'
import { pickFile, type Crop } from './crop'
import { draftTemplate, templates, type Slot, type Template } from './templates'
import { setFxLevel, type EffectId, type Fx, type FxLevel } from './effects'

/** fx：这一页自己的场景特效，翻页后不沿用 */
type PageState = { key: string; tplId: string; assets: Assets; fx?: Fx[] }

let seq = 0
const uid = (p: string) => {
  seq += 1
  return `${p}${seq}`
}

const tplOf = (id: string): Template => (id === draftTemplate.id ? draftTemplate : templates.find((t) => t.id === id) ?? templates[0])

/** 一套主题的默认开场：背景、地面、四层贴纸各来一个，用户一选就能看到完整场景 */
function seed(tpl: Template): Assets {
  const pick = <T,>(list: T[], i: number) => (list.length ? list[i % list.length] : undefined)
  const wall = pick(tpl.walls, 0)
  const floor = pick(tpl.floors, 0)
  const out: Assets = {}
  if (wall) {
    out.wallL = { kind: 'preset', id: wall }
    out.wallR = { kind: 'preset', id: wall }
  }
  if (floor) out.floor = { kind: 'preset', id: floor }
  const stickers = tpl.stickers
  for (let i = 0; i < 4; i++) {
    const a = pick(stickers, i)
    const b = pick(stickers, i + 4)
    if (a) out[`left-${i + 1}`] = { kind: 'preset', id: a }
    if (b) out[`right-${i + 1}`] = { kind: 'preset', id: b }
  }
  return out
}

const makePage = (tplId = templates[0].id): PageState => {
  const tpl = tplOf(tplId)
  // 主题自带一套氛围特效，一选就能看到场景；之后用户增删都覆盖在这上面
  return { key: uid('p'), tplId: tpl.id, assets: seed(tpl), fx: tpl.fx ? [...tpl.fx] : [] }
}

const INITIAL: PageState[] = [makePage('moon-town'), makePage('halloween')]

export default function PopupApp() {
  const [pages, setPages] = useState<PageState[]>(INITIAL)
  const [active, setActive] = useState(0)
  const [picking, setPicking] = useState<Slot | null>(null)
  const [editing, setEditing] = useState<{ slot: Slot; src: string } | null>(null)
  // 初始是阅读模式：先让人看书，想做再点底部的「制作」
  const [open, setOpen] = useState(false)
  // 书页上点中的槽位：书里描边 + 菜单里高亮并滚过去
  const [picked, setPicked] = useState<string | null>(null)

  const pickSlot = useCallback((id: string) => {
    setPicked((cur) => (cur === id ? null : id))
  }, [])
  /** 菜单里点条目：只选中，让书上亮边框；要看素材列表得点那一行的编辑键 */
  const selectSlot = useCallback((id: string) => setPicked(id), [])

  const closeDrawer = useCallback(() => {
    setOpen(false)
    setPicked(null)
    setPicking(null)
  }, [])

  const changePage = useCallback((i: number) => {
    setActive(i)
    setPicked(null)
  }, [])

  const page = pages[active] ?? pages[0]
  const template = tplOf(page.tplId)
  const assets = page.assets
  const fx = page.fx ?? []

  // 每一页都按自己的模板和素材生成；页数变化时翻页范围跟着变
  const book = useMemo(
    () => pages.map((p, i) => buildSpread(tplOf(p.tplId), p.assets, i)),
    [pages],
  )
  const names = useMemo(() => pages.map((p) => tplOf(p.tplId).name), [pages])
  const pageFx = useMemo(() => pages.map((p) => p.fx ?? []), [pages])

  /** 改当前页 */
  const edit = useCallback((fn: (p: PageState) => PageState) => {
    setPages((list) => list.map((p, i) => (i === active ? fn(p) : p)))
  }, [active])

  const setAssets = useCallback((fn: (a: Assets) => Assets) => {
    edit((p) => ({ ...p, assets: fn(p.assets) }))
  }, [edit])

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
    const file = await pickFile()
    if (!file || !slot) return
    setPicking(null)
    setEditing({ slot, src: file.src })
  }

  /** 选择页里那张上传图的删除：只去掉图片，槽位位置留着 */
  const clearTrimmed = () => {
    const slot = picking
    if (!slot) return
    setAssets((a) => ({ ...a, [slot.id]: { kind: 'empty' } }))
  }

  /** 上传图的裁剪确认 */
  const confirm = async (c: Crop) => {
    if (!editing) return
    const { slot, src } = editing
    setEditing(null)
    const out = await renderSlot(slot, src, c)
    // 槽位 id 决定写给哪一个位置；整张背景一次写 wallL / wallR 两项
    setAssets((a) => ({ ...a, ...out }))
  }

  /** 换主题：直接铺好这个主题的默认场景（含它预设的氛围特效） */
  const applyTemplate = (id: string) => {
    const tpl = tplOf(id)
    setPicked(null)
    edit((p) => ({ ...p, tplId: tpl.id, assets: seed(tpl), fx: tpl.fx ? [...tpl.fx] : [] }))
  }

  const setEffect = (id: EffectId, level: FxLevel) => {
    edit((p) => ({ ...p, fx: setFxLevel(p.fx ?? [], id, level) }))
  }

  const clearEffects = () => {
    edit((p) => ({ ...p, fx: [] }))
  }

  /** 贴纸列表右侧的删除：清掉一个槽位的内容，位置留着 */
  const clearOne = (id: string) => {
    const slot = template.slots.find((s) => s.id === id)
    if (!slot || slot.kind === 'wall' || slot.kind === 'floor') return
    setAssets((a) => ({ ...a, [id]: { kind: 'empty' } }))
  }

  const addPage = () => {
    // 插在当前页后面：正在编辑哪一页，新页就出现在它右边
    const next = makePage(template.id)
    setPages((list) => {
      const out = [...list]
      out.splice(active + 1, 0, next)
      return out
    })
    changePage(active + 1)
  }

  const removePage = () => {
    if (pages.length <= 1) return
    setPages((list) => list.filter((_, i) => i !== active))
    changePage(Math.max(0, Math.min(active, pages.length - 2)))
  }

  return (
    <PopupBook
      book={book}
      reserve={open ? 372 : 0}
      pageIndex={active}
      onPageIndex={changePage}
      locked={open}
      pickedSlot={open ? picked : null}
      onPickSlot={open ? pickSlot : undefined}
      pageFx={pageFx}
      onEdit={() => setOpen((v) => !v)}
      overlay={
        <>
          <div className={open ? 'ed-wrap is-open' : 'ed-wrap'}>
            <Editor
              template={template}
              onTemplate={applyTemplate}
              assets={assets}
              onSlot={setPicking}
              onPick={selectSlot}
              pages={pages.map((p, i) => ({ key: p.key, name: names[i] }))}
              active={active}
              onActive={changePage}
              onAdd={addPage}
              onRemove={removePage}
              onClose={closeDrawer}
              picked={picked}
              fx={fx}
              onEffect={setEffect}
              onClearFx={clearEffects}
              onClearSlot={clearOne}
            />
          </div>
          {picking && (
            <AssetPicker
              slot={picking}
              template={template}
              current={assets[picking.id] ?? (picking.halves ? assets.wallL : undefined)}
              onClose={() => setPicking(null)}
              onPreset={applyPreset}
              onUpload={upload}
              onClear={clearTrimmed}
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
