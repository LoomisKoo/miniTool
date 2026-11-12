/** 程序音效：解锁后音量够大，避免首枪静音 */
export function createAudio() {
  let ctx = null
  let master = null
  let ready = false

  async function unlock() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      master = ctx.createGain()
      master.gain.value = 0.85
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch (_) {
        /* ignore */
      }
    }
    ready = ctx.state === 'running'
    await loadGuns()
    // 静音短脉冲，强制激活部分浏览器音频管线
    if (ready) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      g.gain.value = 0.0001
      o.connect(g)
      g.connect(master)
      o.start()
      o.stop(ctx.currentTime + 0.01)
    }
    return ready
  }

  function ensure() {
    if (!ctx) unlock()
    if (ctx && ctx.state === 'suspended') ctx.resume()
    return ctx
  }

  function envGain(peak, dur) {
    const c = ensure()
    if (!c || !master) return null
    const g = c.createGain()
    const t0 = c.currentTime
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    g.connect(master)
    return { g, t0, c }
  }

  function tone(freq, dur, type = 'square', peak = 0.2, slide = 0) {
    const e = envGain(peak, dur)
    if (!e) return
    const o = e.c.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, e.t0)
    if (slide) {
      o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), e.t0 + dur)
    }
    o.connect(e.g)
    o.start(e.t0)
    o.stop(e.t0 + dur + 0.03)
  }

  function noise(dur, peak = 0.3, filterFreq = 1600, type = 'bandpass', q = 0.7) {
    const e = envGain(peak, dur)
    if (!e) return
    const n = Math.max(1, Math.floor(e.c.sampleRate * dur))
    const buf = e.c.createBuffer(1, n, e.c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n)
    const src = e.c.createBufferSource()
    const f = e.c.createBiquadFilter()
    f.type = type
    f.frequency.value = filterFreq
    f.Q.value = q
    src.buffer = buf
    src.connect(f)
    f.connect(e.g)
    src.start()
  }

  const GUNS = {
    pistol: { url: './audio/pistol.mp3', dur: 0.42, gain: 0.95 },
    smg: { url: './audio/smg.mp3', dur: 0.11, gain: 0.72 },
    shotgun: { url: './audio/shotgun.mp3', dur: 0.55, gain: 1 },
  }
  const gunBuffers = {}
  let loadingGuns = null

  function loadGuns() {
    const c = ensure()
    if (!c || loadingGuns) return loadingGuns
    loadingGuns = Promise.all(
      Object.entries(GUNS).map(async ([id, spec]) => {
        if (gunBuffers[id]) return
        const res = await fetch(spec.url)
        const raw = await res.arrayBuffer()
        gunBuffers[id] = await c.decodeAudioData(raw.slice(0))
      }),
    ).catch(() => {
      loadingGuns = null
    })
    return loadingGuns
  }

  return {
    unlock,
    shoot(kind = 'pistol') {
      const c = ensure()
      const spec = GUNS[kind] || GUNS.pistol
      const buf = gunBuffers[kind] || gunBuffers.pistol
      if (!c || !master || !buf) {
        loadGuns()
        return
      }
      const src = c.createBufferSource()
      src.buffer = buf
      const g = c.createGain()
      g.gain.value = spec.gain
      src.connect(g)
      g.connect(master)
      src.start(c.currentTime, 0, Math.min(spec.dur, buf.duration))
    },
    break(kind = 'porcelain') {
      ensure()
      if (kind === 'glass') {
        noise(0.05, 0.32, 6500, 'highpass', 0.4)
        tone(2600, 0.22, 'sine', 0.11, -300)
        tone(3900, 0.16, 'sine', 0.05, -500)
        tone(1750, 0.14, 'triangle', 0.04, -150)
      } else if (kind === 'wood') {
        noise(0.08, 0.36, 240, 'lowpass', 0.5)
        noise(0.03, 0.18, 980, 'bandpass', 1.2)
        tone(88, 0.07, 'sine', 0.16, -24)
      } else if (kind === 'metal') {
        noise(0.02, 0.16, 5400, 'highpass', 0.4)
        tone(680, 0.32, 'sine', 0.14, -20)
        tone(1120, 0.26, 'sine', 0.07, -15)
        tone(1780, 0.2, 'triangle', 0.04, -10)
      } else if (kind === 'cardboard') {
        noise(0.06, 0.2, 380, 'lowpass', 0.4)
        tone(62, 0.04, 'sine', 0.05)
      } else if (kind === 'balloon') {
        noise(0.03, 0.48, 2200, 'highpass', 0.5)
        tone(640, 0.06, 'sine', 0.2, -560)
      } else {
        noise(0.09, 0.38, 2400, 'highpass', 0.6)
        tone(820, 0.12, 'triangle', 0.15, -420)
        tone(1540, 0.08, 'sine', 0.07, -700)
        tone(210, 0.06, 'sine', 0.1, -40)
      }
    },
    empty() {
      ensure()
      tone(110, 0.05, 'square', 0.08)
    },
    switch() {
      ensure()
      tone(300, 0.04, 'triangle', 0.1)
      tone(180, 0.06, 'square', 0.06)
    },
    throw() {
      ensure()
      noise(0.06, 0.12, 800)
      tone(140, 0.05, 'triangle', 0.08)
    },
    explode() {
      ensure()
      // 更接近 CS HE：干脆冲击 + 短轰鸣，不拖很长
      noise(0.12, 0.9, 900)
      noise(0.28, 0.85, 220)
      noise(0.22, 0.55, 550)
      tone(70, 0.18, 'sawtooth', 0.45, -35)
      tone(45, 0.32, 'square', 0.35, -20)
      tone(120, 0.1, 'triangle', 0.18, -80)
    },
  }
}
