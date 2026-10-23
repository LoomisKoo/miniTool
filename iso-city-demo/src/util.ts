export function cityShareUrl(params: { space?: string; place?: string; enter?: string } = {}) {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  if (params.space) {
    url.searchParams.set('space', params.space)
    url.searchParams.set('enter', '1')
  }
  if (params.place) url.searchParams.set('place', params.place)
  if (params.enter) url.searchParams.set('enter', params.enter)
  return url.toString()
}

export async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const input = document.createElement('textarea')
    input.value = text
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(input)
    return ok
  } catch {
    return false
  }
}

export function relativeTime(iso: string) {
  const time = new Date(iso).getTime()
  if (!Number.isFinite(time)) return ''
  const diff = Date.now() - time
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < day * 7) return `${Math.floor(diff / day)} 天前`
  return new Date(time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const PALETTES: Record<string, [string, string, string]> = {
  dawn: ['#d8b48d', '#a9b9b4', '#6f7d80'],
  dusk: ['#c08c72', '#6d7a80', '#3f4a4e'],
  coast: ['#b7c3bd', '#8da4ac', '#d6c5a6'],
  signal: ['#b06b4f', '#d9c3a0', '#58645f'],
  meadow: ['#9baa8d', '#c8c3a4', '#7c8a7f'],
  ember: ['#b98563', '#8c6a55', '#d6c6ab'],
  night: ['#4c5b66', '#7d8c92', '#c0a97f'],
  clay: ['#b57d5e', '#cda483', '#e2d0b4'],
}

export function paletteColors(palette: string) {
  return PALETTES[palette] || PALETTES.dawn
}

export function mediaGradient(ref: string | null) {
  const key = (ref || 'dawn').replace('palette:', '')
  const [a, b, c] = paletteColors(key)
  return `linear-gradient(135deg, ${a}, ${b} 55%, ${c})`
}

export function playSoundPlaceholder(ref: string | null) {
  try {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return false
    const ctx = new AudioCtor()
    const base = ref?.includes('cafe') ? 174.6 : ref?.includes('sound') ? 196 : 146.8
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.06, now + 0.4)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2)
    gain.connect(ctx.destination)
    ;[1, 1.5, 2].forEach((ratio, i) => {
      const osc = ctx.createOscillator()
      osc.type = i === 2 ? 'triangle' : 'sine'
      osc.frequency.value = base * ratio
      const g = ctx.createGain()
      g.gain.value = 0.5 / (i + 1)
      osc.connect(g)
      g.connect(gain)
      osc.start(now + i * 0.12)
      osc.stop(now + 3.3)
    })
    setTimeout(() => void ctx.close().catch(() => undefined), 3600)
    return true
  } catch {
    return false
  }
}
