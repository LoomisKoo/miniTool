// 唱片机：一小段现场合成的循环，不是音频文件。
//
// 和 BGM 不同，这是「房间里的声音」：音量低、只有一架电钢式的琶音和一点沙沙，
// 不留低频，所以它贴着 BGM 也能听出是另一台机器在放。开关由户内那台唱片机控制，
// 离开房间自动关（调用方负责 stop）。
//
// 打开时把 BGM 静音，关掉时按用户偏好恢复——不然两条旋律叠在一起会很吵。

import { useApp } from '../store'
import { music } from './music'

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19]
const BPM = 58
const STEP = 60 / BPM / 2

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

class Record {
  private ac: AudioContext | null = null
  private bus: GainNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private step = 0
  private nextAt = 0
  private playing = false

  get on() {
    return this.playing
  }

  toggle() {
    if (this.playing) this.stop()
    else this.start()
    return this.playing
  }

  start() {
    if (this.playing) return
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ac = new Ctor({ latencyHint: 'playback' })
    this.ac = ac
    const bus = ac.createGain()
    bus.gain.value = 0.0001
    // 高切一点，像老唱片机的喇叭
    const tone = ac.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 4200
    bus.connect(tone)
    tone.connect(ac.destination)
    this.bus = bus
    bus.gain.exponentialRampToValueAtTime(0.5, ac.currentTime + 1.2)

    this.step = 0
    this.nextAt = ac.currentTime + 0.1
    this.playing = true
    // 房间里有声音时把 BGM 让开
    music.setMuted(true)
    this.timer = setInterval(() => this.tick(), 200)
    this.tick()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.playing = false
    const ac = this.ac
    const bus = this.bus
    this.ac = null
    this.bus = null
    if (ac) {
      if (bus) {
        bus.gain.cancelScheduledValues(ac.currentTime)
        bus.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25)
      }
      window.setTimeout(() => void ac.close().catch(() => undefined), 900)
    }
    // 恢复 BGM：用户关掉音乐时保持关着
    music.setMuted(!useApp.getState().musicOn)
  }

  private tick() {
    const ac = this.ac
    const bus = this.bus
    if (!ac || !bus) return
    if (this.nextAt < ac.currentTime - 1) this.nextAt = ac.currentTime + 0.1
    while (this.nextAt < ac.currentTime + 0.6) {
      this.note(this.nextAt, bus)
      this.nextAt += STEP
      this.step++
    }
  }

  /** 一小步：五声音阶上慢慢爬，每 8 步落一次根音。 */
  private note(at: number, bus: GainNode) {
    const ac = this.ac
    if (!ac) return
    const s = this.step % 16
    const phrase = [0, 2, 4, 5, 7, 5, 4, 2]
    const midi = 60 + PENTA[phrase[Math.floor(s / 2) % phrase.length]]
    // 每 8 步落一次根音，给琶音一个骨架
    if (s % 8 === 0) this.voice(at, midi - 12, 0.5, 1.4)
    // 后半拍轻一点，像随手拨的
    this.voice(at, midi, 0.22, s % 4 === 0 ? 1 : 0.55)
  }

  private voice(at: number, midi: number, level: number, dur: number) {
    const ac = this.ac
    const bus = this.bus
    if (!ac || !bus) return
    const f = mtof(midi)
    const env = ac.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(level, at + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    env.connect(bus)
    for (const [ratio, amp] of [
      [1, 1],
      [2, 0.28],
      [3.02, 0.08],
    ]) {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f * ratio
      const g = ac.createGain()
      g.gain.value = amp
      osc.connect(g)
      g.connect(env)
      osc.start(at)
      osc.stop(at + dur + 0.05)
    }
  }

  dispose() {
    this.stop()
  }
}

export const record = new Record()

if (import.meta.hot) {
  import.meta.hot.dispose(() => record.dispose())
}
