import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  PALETTES,
  PALETTE_NAMES,
  PET_BLUEPRINTS,
  FISH_BLUEPRINTS,
  PET_COUNT,
  FISH_COUNT,
  SIZE_SCALE,
  type Palette,
  type PetRecipe,
  type FishRecipe,
} from './recipes'
import {
  CELL,
  PET_FRAMES,
  FISH_FRAMES,
  PET_POSES,
  PET_POSE_LABEL,
  FISH_POSE_LABEL,
  DECOS,
  DECO_LABEL,
  rasterizePet,
  rasterizeFish,
  rasterizeDeco,
  rasterizeCollar,
  decodeSlot,
  decodeShade,
  shadeMul,
  type DecoId,
} from './rasterize'
import { ATLAS_SIZE, atlasJobs, paintCell } from './layout'

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

const SLOT_NAME = ['身体', '肚皮', '花纹', '眼睛', '耳/鳍', '尾巴', '项圈', '装饰']
const BODY_LABEL = ['团子', '圆', '扁', '高', '长条', '方', '水滴', '星']
const EAR_LABEL = ['尖耳', '垂耳', '圆耳', '角', '触角', '无']
const TAIL_LABEL = ['卷', '蓬', '细长', '鳍', '光点', '无']
const EYE_LABEL = ['圆', '豆', '星', '竖瞳', '闭']
const PATTERN_LABEL = ['无', '斑点', '条纹', '渐变', '背脊', '肚皮', '雪花', '光纹']
const SIZE_LABEL = ['小', '中', '大']
const FISH_BODY_LABEL = ['纺锤', '扁', '长鳗', '圆胖', '扁头']
const FISH_FIN_LABEL = ['扇形', '旗形', '飘带', '棘']
const FISH_TAIL_LABEL = ['叉', '圆', '月', '细']

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
}

function composite(base: Uint8Array, ...layers: Uint8Array[]) {
  const out = new Uint8Array(base.length)
  out.set(base)
  for (const layer of layers) {
    for (let i = 0; i < out.length; i++) if (layer[i]) out[i] = layer[i]
  }
  return out
}

// ---------------------------------------------------------------------------
// 像素画布
// ---------------------------------------------------------------------------

function CellCanvas({
  bytes,
  palette,
  scale,
  title,
}: {
  bytes: Uint8Array
  palette: Palette
  scale: number
  title?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const img = ctx.createImageData(CELL, CELL)
    const rgb = palette.map(hexToRgb)
    for (let i = 0; i < CELL * CELL; i++) {
      const b = bytes[i]
      const o = i * 4
      if (!b) {
        img.data[o + 3] = 0
        continue
      }
      const slot = decodeSlot(b)
      const k = shadeMul(decodeShade(b))
      const c = rgb[slot] ?? [255, 0, 255]
      img.data[o] = Math.min(255, Math.round(c[0] * k))
      img.data[o + 1] = Math.min(255, Math.round(c[1] * k))
      img.data[o + 2] = Math.min(255, Math.round(c[2] * k))
      img.data[o + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [bytes, palette])

  return (
    <div
      title={title}
      style={{
        width: CELL * scale,
        height: CELL * scale,
        backgroundImage:
          'linear-gradient(45deg,#22272e 25%,transparent 25%),linear-gradient(-45deg,#22272e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#22272e 75%),linear-gradient(-45deg,transparent 75%,#22272e 75%)',
        backgroundSize: `${Math.max(8, scale * 2)}px ${Math.max(8, scale * 2)}px`,
        backgroundPosition: `0 0, 0 ${Math.max(4, scale)}px, ${Math.max(4, scale)}px -${Math.max(4, scale)}px, -${Math.max(4, scale)}px 0`,
        backgroundColor: '#181d23',
        borderRadius: 6,
        flex: '0 0 auto',
      }}
    >
      <canvas
        ref={ref}
        width={CELL}
        height={CELL}
        style={{ width: CELL * scale, height: CELL * scale, imageRendering: 'pixelated', display: 'block' }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 控件
// ---------------------------------------------------------------------------

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
      <span style={{ width: 42, color: '#8ea0b5', flex: '0 0 auto' }}>{label}</span>
      {children}
    </label>
  )
}

function Select({ value, list, onChange }: { value: number; list: string[]; onChange: (v: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ flex: 1, background: '#1d232b', color: '#e8eef5', border: '1px solid #2c3540', borderRadius: 6, padding: '4px 6px', fontSize: 12 }}
    >
      {list.map((t, i) => (
        <option key={i} value={i}>
          {t}
        </option>
      ))}
    </select>
  )
}

function Button({
  children,
  onClick,
  active,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? '#5aa9e6' : '#2c3540'}`,
        background: active ? '#173247' : '#1d232b',
        color: disabled ? '#556' : '#e8eef5',
        fontSize: 12,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: '#6d7f94', margin: '0 0 8px' }}>
        {title}
      </h3>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 主页面
// ---------------------------------------------------------------------------

export function Preview() {
  const [mode, setMode] = useState<'pet' | 'fish'>('pet')
  const [recipe, setRecipe] = useState<PetRecipe>(PET_BLUEPRINTS[0].recipe)
  const [fish, setFish] = useState<FishRecipe>(FISH_BLUEPRINTS[0].recipe)
  const [palette, setPalette] = useState<Palette>(PALETTES[0])
  const [deco, setDeco] = useState<DecoId | null>(null)
  const [collar, setCollar] = useState(false)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState<number | null>(null)
  const [bpIndex, setBpIndex] = useState(0)

  const frames = mode === 'pet' ? PET_FRAMES : FISH_FRAMES

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setFrame((f) => (f + 1) % frames), mode === 'pet' ? 160 : 320)
    return () => window.clearInterval(id)
  }, [playing, frames, mode])

  const pixel = useMemo(() => {
    if (mode === 'fish') return rasterizeFish(fish, frame)
    const base = rasterizePet(recipe, frame)
    const layers: Uint8Array[] = []
    if (collar) layers.push(rasterizeCollar(recipe.body))
    if (deco) layers.push(rasterizeDeco(deco))
    return layers.length ? composite(base, ...layers) : base
  }, [mode, recipe, fish, frame, collar, deco])

  const strip = useMemo(() => {
    if (mode === 'fish') return Array.from({ length: FISH_FRAMES }, (_, f) => rasterizeFish(fish, f))
    const base = Array.from({ length: PET_FRAMES }, (_, f) => rasterizePet(recipe, f))
    if (!collar && !deco) return base
    const collarLayer = collar ? rasterizeCollar(recipe.body) : null
    const decoLayer = deco ? rasterizeDeco(deco) : null
    return base.map((b) => {
      const layers: Uint8Array[] = []
      if (collarLayer) layers.push(collarLayer)
      if (decoLayer) layers.push(decoLayer)
      return layers.length ? composite(b, ...layers) : b
    })
  }, [mode, recipe, fish, collar, deco])

  const randomize = useCallback(() => {
    if (mode === 'pet') {
      const bp = PET_BLUEPRINTS[Math.floor(Math.random() * PET_COUNT)]
      setRecipe({ ...bp.recipe })
      setBpIndex(Number(bp.id.slice(4)))
    } else {
      setFish({ ...FISH_BLUEPRINTS[Math.floor(Math.random() * FISH_COUNT)].recipe })
    }
    setPalette(PALETTES[Math.floor(Math.random() * PALETTES.length)])
  }, [mode])

  const loadBlueprint = useCallback(
    (i: number) => {
      const bp = PET_BLUEPRINTS[i]
      if (!bp) return
      setRecipe({ ...bp.recipe })
      setBpIndex(i)
    },
    [],
  )

  // ---- 图集导出 --------------------------------------------------------

  const exportAtlas = useCallback(async () => {
    setProgress(0)
    const buf = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE)
    const jobs = Array.from(atlasJobs(PET_COUNT, PET_FRAMES))
    const total = jobs.length
    for (let i = 0; i < jobs.length; i += 96) {
      const end = Math.min(i + 96, jobs.length)
      for (let j = i; j < end; j++) {
        const { blueprint, frame: f, cell } = jobs[j]
        paintCell(buf, cell, rasterizePet(PET_BLUEPRINTS[blueprint].recipe, f))
      }
      setProgress(end / total)
      await new Promise((r) => window.setTimeout(r, 0))
    }

    // 装饰与项圈接在宠物格子后面
    DECOS.forEach((id, i) => paintCell(buf, total + i, rasterizeDeco(id)))
    for (let b = 0; b < 8; b++) paintCell(buf, total + DECOS.length + b, rasterizeCollar(b))

    const cv = document.createElement('canvas')
    cv.width = ATLAS_SIZE
    cv.height = ATLAS_SIZE
    const ctx = cv.getContext('2d')
    if (ctx) {
      const img = ctx.createImageData(ATLAS_SIZE, ATLAS_SIZE)
      for (let i = 0; i < buf.length; i++) {
        const o = i * 4
        img.data[o] = buf[i]
        img.data[o + 1] = buf[i]
        img.data[o + 2] = buf[i]
        img.data[o + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
      download(cv, 'pets-atlas-index.png')
    }

    const meta = {
      atlasSize: ATLAS_SIZE,
      cell: CELL,
      frames: PET_FRAMES,
      encoding: 'byte = 1 + slot + 16*shade; 0 = transparent',
      decoOffset: total,
      collarOffset: total + DECOS.length,
      decos: DECOS,
      blueprints: PET_BLUEPRINTS,
      palettes: PALETTES.map((p, i) => ({ name: PALETTE_NAMES[i], colors: p })),
    }
    const blob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' })
    triggerDownload(URL.createObjectURL(blob), 'pets-index.json')

    setProgress(null)
  }, [])

  const scale = 8

  return (
    <div
      style={{
        display: 'flex',
        gap: 24,
        padding: 24,
        minHeight: '100vh',
        background: '#0f1319',
        color: '#e8eef5',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "PingFang SC", sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* 左：参数 */}
      <aside style={{ width: 300, flex: '0 0 auto' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 4px', fontWeight: 900 }}>像素图鉴 · 配方台</h1>
        <p style={{ fontSize: 11, color: '#6d7f94', margin: '0 0 18px' }}>
          一只宠物 = 8 个数字。调完参数点右下角导出图集。
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <Button active={mode === 'pet'} onClick={() => setMode('pet')}>
            宠物 · {PET_COUNT}
          </Button>
          <Button active={mode === 'fish'} onClick={() => setMode('fish')}>
            鱼 · {FISH_COUNT}
          </Button>
        </div>

        <Panel title="结构">
          {mode === 'pet' ? (
            <>
              <Row label="体型">
                <Select value={recipe.body} list={BODY_LABEL} onChange={(v) => setRecipe({ ...recipe, body: v })} />
              </Row>
              <Row label="耳朵">
                <Select value={recipe.ears} list={EAR_LABEL} onChange={(v) => setRecipe({ ...recipe, ears: v })} />
              </Row>
              <Row label="尾巴">
                <Select value={recipe.tail} list={TAIL_LABEL} onChange={(v) => setRecipe({ ...recipe, tail: v })} />
              </Row>
              <Row label="眼睛">
                <Select value={recipe.eyes} list={EYE_LABEL} onChange={(v) => setRecipe({ ...recipe, eyes: v })} />
              </Row>
              <Row label="花纹">
                <Select value={recipe.pattern} list={PATTERN_LABEL} onChange={(v) => setRecipe({ ...recipe, pattern: v })} />
              </Row>
              <Row label="大小">
                <Select value={recipe.size} list={SIZE_LABEL} onChange={(v) => setRecipe({ ...recipe, size: v })} />
              </Row>
              <Row label="抖动">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={recipe.seed}
                  onChange={(e) => setRecipe({ ...recipe, seed: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
              </Row>
            </>
          ) : (
            <>
              <Row label="体型">
                <Select value={fish.body} list={FISH_BODY_LABEL} onChange={(v) => setFish({ ...fish, body: v })} />
              </Row>
              <Row label="背鳍">
                <Select value={fish.fin} list={FISH_FIN_LABEL} onChange={(v) => setFish({ ...fish, fin: v })} />
              </Row>
              <Row label="尾鳍">
                <Select value={fish.tail} list={FISH_TAIL_LABEL} onChange={(v) => setFish({ ...fish, tail: v })} />
              </Row>
              <Row label="花纹">
                <Select value={fish.pattern} list={PATTERN_LABEL} onChange={(v) => setFish({ ...fish, pattern: v })} />
              </Row>
              <Row label="抖动">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={fish.seed}
                  onChange={(e) => setFish({ ...fish, seed: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
              </Row>
            </>
          )}
        </Panel>

        {mode === 'pet' && (
          <Panel title="归属标记">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <Button active={collar} onClick={() => setCollar(!collar)}>
                项圈
              </Button>
              <Button active={deco === null} onClick={() => setDeco(null)}>
                无装饰
              </Button>
              {DECOS.map((id) => (
                <Button key={id} active={deco === id} onClick={() => setDeco(id)}>
                  {DECO_LABEL[id]}
                </Button>
              ))}
            </div>
          </Panel>
        )}

        <Panel title="调色板">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {PALETTES.map((p, i) => (
              <button
                key={i}
                title={PALETTE_NAMES[i]}
                onClick={() => setPalette(p)}
                style={{
                  width: 34,
                  height: 24,
                  borderRadius: 6,
                  border: `1px solid ${palette === p ? '#5aa9e6' : '#2c3540'}`,
                  background: `linear-gradient(90deg, ${p[0]} 0 33%, ${p[2]} 33% 66%, ${p[1]} 66% 100%)`,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          {palette.map((hex, i) => (
            <Row key={i} label={SLOT_NAME[i]}>
              <input
                type="color"
                value={hex}
                onChange={(e) => {
                  const next = palette.slice() as Palette
                  next[i] = e.target.value
                  setPalette(next)
                }}
                style={{ width: 36, height: 24, padding: 0, border: 'none', background: 'none' }}
              />
              <code style={{ fontSize: 11, color: '#6d7f94' }}>{hex}</code>
            </Row>
          ))}
        </Panel>
      </aside>

      {/* 中：主预览 */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 18 }}>
          <div style={{ position: 'relative' }}>
            <CellCanvas bytes={pixel} palette={palette} scale={scale} />
            <div style={{ position: 'absolute', inset: 0, border: '1px solid #2c3540', borderRadius: 6, pointerEvents: 'none' }} />
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.9, color: '#8ea0b5' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#e8eef5', marginBottom: 2 }}>
              {mode === 'pet' ? `${PET_BLUEPRINTS[bpIndex]?.name ?? '自定义'}` : FISH_BLUEPRINTS[0].name}
            </div>
            <div>
              帧 {frame + 1}/{frames} · {mode === 'pet' ? PET_POSE_LABEL[frame] : FISH_POSE_LABEL[frame]}
            </div>
            <div>
              世界高度 {(0.6 * SIZE_SCALE[mode === 'pet' ? recipe.size : fish.size]).toFixed(2)}m
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <Button onClick={() => setPlaying(!playing)}>{playing ? '暂停' : '播放'}</Button>
              <Button onClick={randomize}>随机一只</Button>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <Button onClick={() => setFrame((f) => (f + frames - 1) % frames)}>‹</Button>
              <Button onClick={() => setFrame((f) => (f + 1) % frames)}>›</Button>
            </div>
          </div>
        </div>

        <Panel title="图鉴蓝图">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: 6 }}>
            {PET_BLUEPRINTS.map((bp, i) => (
              <button
                key={bp.id}
                title={`${bp.name} · ${bp.id}`}
                onClick={() => loadBlueprint(i)}
                style={{
                  padding: 2,
                  borderRadius: 6,
                  border: `1px solid ${i === bpIndex ? '#5aa9e6' : '#222a33'}`,
                  background: '#151a20',
                  cursor: 'pointer',
                  aspectRatio: '1 / 1',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <BpThumb recipe={bp.recipe} />
              </button>
            ))}
          </div>
        </Panel>
      </main>

      {/* 右：动画 / 距离 / 导出 */}
      <aside style={{ width: 260, flex: '0 0 auto' }}>
        <Panel title="逐帧">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {strip.map((bytes, i) => (
              <CellCanvas key={i} bytes={bytes} palette={palette} scale={2} title={String(i)} />
            ))}
          </div>
        </Panel>

        <Panel title="实际观感（0.6m）">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 14,
              padding: 12,
              background: 'linear-gradient(#2a3140,#12161c)',
              borderRadius: 8,
            }}
          >
            {[1, 0.5, 0.25].map((k) => (
              <div key={k} style={{ textAlign: 'center', fontSize: 10, color: '#6d7f94' }}>
                <CellCanvas bytes={pixel} palette={palette} scale={Math.max(1, 3 * k)} />
                <div style={{ marginTop: 4 }}>{Math.round(48 * k)}px</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: '#6d7f94', margin: '8px 0 0', lineHeight: 1.6 }}>
            放大用 NearestFilter 保硬边；缩小时靠 mipmap，不能让远处闪成噪点。
          </p>
        </Panel>

        <Panel title="图集">
          <div style={{ fontSize: 11, color: '#8ea0b5', lineHeight: 1.8, marginBottom: 8 }}>
            <div>2048² / 64px = 1024 格</div>
            <div>
              宠物 {PET_COUNT}×{PET_FRAMES} = {PET_COUNT * PET_FRAMES} 格
            </div>
            <div>装饰 {DECOS.length} + 项圈 8 格</div>
            <div>余 {1024 - PET_COUNT * PET_FRAMES - DECOS.length - 8} 格</div>
          </div>
          <Button onClick={exportAtlas} disabled={progress !== null}>
            {progress === null ? '导出图集' : `生成中 ${Math.round(progress * 100)}%`}
          </Button>
          {progress !== null && (
            <div style={{ height: 4, background: '#222a33', borderRadius: 2, marginTop: 8 }}>
              <div style={{ height: 4, width: `${progress * 100}%`, background: '#5aa9e6', borderRadius: 2 }} />
            </div>
          )}
        </Panel>
      </aside>
    </div>
  )
}

function BpThumb({ recipe }: { recipe: PetRecipe }) {
  const bytes = useMemo(() => rasterizePet(recipe, 0), [recipe])
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(CELL, CELL)
    const p = PALETTES[0]
    const rgb = p.map(hexToRgb)
    for (let i = 0; i < CELL * CELL; i++) {
      const b = bytes[i]
      const o = i * 4
      if (!b) {
        img.data[o + 3] = 0
        continue
      }
      const k = shadeMul(decodeShade(b))
      const c = rgb[decodeSlot(b)] ?? [255, 0, 255]
      img.data[o] = Math.min(255, Math.round(c[0] * k))
      img.data[o + 1] = Math.min(255, Math.round(c[1] * k))
      img.data[o + 2] = Math.min(255, Math.round(c[2] * k))
      img.data[o + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [bytes])
  return (
    <canvas
      ref={ref}
      width={CELL}
      height={CELL}
      style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
    />
  )
}

function download(canvas: HTMLCanvasElement, name: string) {
  canvas.toBlob((blob) => {
    if (blob) triggerDownload(URL.createObjectURL(blob), name)
  }, 'image/png')
}

function triggerDownload(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
