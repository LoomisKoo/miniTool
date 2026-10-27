/**
 * 微光城区的 BGM：不加载任何音频文件，全部用 WebAudio 现场合成。
 *
 * 和项目其它部分保持一致——一辆车、一扇窗都是几何体，那么背景音乐也不该是
 * 一个 3MB 的 mp3。合成的好处是体积 0、可以无限循环不断点、还能跟着昼夜换调。
 *
 * 音色构成（全部是合成器，没有采样）：
 * - pad：三角波 + 微失谐锯齿，过低通。每小节换和弦，1.1 秒起音、1.8 秒收尾，
 *   相邻小节重叠，换和弦时听不到断点。
 * - bass：正弦跟和弦根音，跟着 kick 一起被压下去（sidechain），低音才有"推"。
 * - 鼓：76 BPM 的 lo-fi hiphop，四小节 16 分音符网格。kick / snare / hat / shaker。
 * - air：粉噪过带通，模仿雨后的潮湿和远处车流。
 * - crackle：稀疏脉冲，模仿唱片转动的沙沙声，把"太干净"的电子味压掉。
 * - bell：五声音阶的钟琴音，走一条 0.42 秒的反馈延迟。
 *
 * 起伏靠 8 小节的段落循环（约 25 秒）：只有 pad → 进 kick → 进 snare →
 * 加密 hat → 抽空鼓做 breakdown → 回来。和弦亮度也跟着这条曲线开合，
 * 所以同一套和弦反复听也不会像一条直线。
 */

type Mode = 'night' | 'dusk'

/** 76 BPM。再慢就回到"环境音"，再快就不像漫步了。 */
const BPM = 76
const BEAT = 60 / BPM
/** 16 分音符网格。 */
const STEP = BEAT / 4
/** 一小节 3.16 秒，和弦一小节一换。 */
const BAR = BEAT * 4
/** 段落循环长度（小节）。 */
const CYCLE = 8

/** 每套调性的和弦，第一个数是低音根音，其余是 pad 的上声部（MIDI 音高）。 */
const CHORDS: Record<Mode, number[][]> = {
  // 夜间：Am9 – Fmaj7 – Cmaj7 – G6。小调偏多，情绪是"雨刚停"。
  night: [
    [45, 57, 60, 64, 67, 72],
    [41, 53, 57, 60, 64],
    [48, 55, 59, 64, 67],
    [43, 55, 59, 62, 64],
  ],
  // 黄昏：Fmaj7 – Cmaj7 – Am7 – Dm9。大调多一个，暖一点、亮一点。
  dusk: [
    [41, 53, 57, 60, 64, 67],
    [40, 52, 55, 59, 64],
    [45, 57, 60, 64, 67],
    [38, 50, 53, 57, 60, 64],
  ],
}

/**
 * 主旋律。这是整段音乐唯一"能被记住"的部分，所以它必须是写死的，
 * 不能像之前那样从音阶里随机挑音——随机音阶听起来只是"有音高的噪声"。
 *
 * 格式：[16 分音符网格步数(0~15), MIDI 音高, 时长(步)]
 * 两个 4 小节乐句：前句下行走完停在 B4（悬留），后句把同一个动机
 * 抬高一个八度、推到 A5 再落回 B4 —— 这样第二遍就是"回答"，不是重复。
 *
 * 每个音都落在对应和弦的和弦音或经过音上，不会出现和 pad 打架的音。
 */
type Note = [step: number, midi: number, dur: number]

const MELODY: Record<Mode, Note[][]> = {
  // 夜间 · A 小调。和弦 Am7 | Fmaj7 | Cmaj7 | G6
  night: [
    [[0, 76, 2], [3, 79, 2], [6, 76, 2], [8, 74, 4], [12, 72, 4]],
    [[0, 69, 3], [4, 72, 2], [7, 74, 2], [10, 76, 6]],
    [[0, 79, 2], [3, 76, 2], [6, 74, 2], [8, 72, 4], [12, 74, 4]],
    [[0, 74, 2], [2, 76, 2], [5, 74, 4], [10, 71, 6]],
    // 第二乐句：动机抬高一个八度
    [[0, 81, 3], [3, 79, 2], [6, 76, 2], [8, 74, 2], [11, 72, 4]],
    [[0, 72, 2], [2, 74, 2], [4, 76, 4], [8, 74, 4], [12, 72, 4]],
    [[0, 72, 2], [2, 74, 2], [4, 76, 2], [6, 79, 2], [8, 81, 8]],
    [[0, 79, 4], [4, 76, 2], [6, 74, 2], [8, 71, 8]],
  ],
  // 黄昏 · F 大调。和弦 Fmaj7 | Cmaj7 | Am7 | Dm9
  dusk: [
    [[0, 72, 2], [3, 74, 2], [6, 72, 2], [8, 69, 4], [12, 67, 4]],
    [[0, 76, 3], [4, 72, 2], [7, 69, 2], [10, 67, 6]],
    [[0, 72, 2], [3, 74, 2], [6, 76, 2], [8, 74, 4], [12, 72, 4]],
    [[0, 74, 2], [2, 72, 2], [5, 69, 4], [10, 65, 6]],
    [[0, 77, 3], [3, 76, 2], [6, 72, 2], [8, 69, 2], [11, 67, 4]],
    [[0, 67, 2], [2, 69, 2], [4, 72, 4], [8, 69, 4], [12, 67, 4]],
    [[0, 67, 2], [2, 69, 2], [4, 72, 2], [6, 76, 2], [8, 77, 8]],
    [[0, 74, 4], [4, 72, 2], [6, 69, 2], [8, 65, 8]],
  ],
}

/** 段落表：鼓的密度在 8 小节里起伏，而不是每小节都一样。 */
type Section = {
  kick: boolean
  snare: boolean
  /** 8 分音符的 hat。 */
  hat: boolean
  /** 16 分音符的 ghost hat，密度感更强。 */
  ghost: boolean
  /** 点亮度和低通开合，0~1。 */
  bright: number
  /** 旋律音量系数。breakdown 时把旋律推出来，让它是那一小节的主角。 */
  lead: number
}

const SECTIONS: Section[] = [
  // 0：只有 pad + hat + 旋律，把耳朵先放下来
  { kick: false, snare: false, hat: true, ghost: false, bright: 0.2, lead: 0.8 },
  // 1：kick 进来
  { kick: true, snare: false, hat: true, ghost: false, bright: 0.35, lead: 0.75 },
  // 2-3：完整的 lo-fi 骨架
  { kick: true, snare: true, hat: true, ghost: false, bright: 0.55, lead: 0.7 },
  { kick: true, snare: true, hat: true, ghost: false, bright: 0.6, lead: 0.72 },
  // 4-5：加密，段落最"满"的地方
  { kick: true, snare: true, hat: true, ghost: true, bright: 0.85, lead: 0.66 },
  { kick: true, snare: true, hat: true, ghost: true, bright: 1, lead: 0.62 },
  // 6：breakdown，鼓全部抽走，只留 pad —— 旋律这时候上行到 A5，是整段的顶点
  { kick: false, snare: false, hat: true, ghost: false, bright: 0.3, lead: 1 },
  // 7：回来，准备进下一轮
  { kick: true, snare: true, hat: true, ghost: false, bright: 0.5, lead: 0.8 },
]

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** 粉噪近似：白噪 + 一阶低通。听着比纯白噪柔和，更像空气。 */
function airBuffer(ac: AudioContext, seconds: number) {
  const len = Math.floor(ac.sampleRate * seconds)
  const buf = ac.createBuffer(2, len, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    let b = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b = 0.98 * b + 0.02 * w
      data[i] = b * 5.5 + w * 0.22
    }
  }
  return buf
}

/** 稀疏脉冲。密度不均匀才有"唱片"的手感，均匀的噪声听起来像电视雪花。 */
function crackleBuffer(ac: AudioContext, seconds: number) {
  const len = Math.floor(ac.sampleRate * seconds)
  const buf = ac.createBuffer(2, len, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    let i = 0
    while (i < len) {
      const burst = Math.random() < 0.06 ? 4 + Math.random() * 8 : 1 + Math.random() * 2
      const amp = Math.random() < 0.1 ? 0.45 + Math.random() * 0.4 : Math.random() * 0.2
      for (let k = 0; k < burst && i < len; k++, i++) {
        data[i] = (Math.random() * 2 - 1) * amp * (1 - k / burst)
      }
      i += Math.floor(rand(50, 520))
    }
  }
  return buf
}

class Music {
  private ac: AudioContext | null = null
  /** 所有声音汇到这里，再由 master 统一做用户音量。 */
  private bus: GainNode | null = null
  private master: GainNode | null = null
  /** sidechain：鼓（尤其 kick）响的时候把它压下去，pad 和 bass 就有呼吸。 */
  private duck: GainNode | null = null
  /** 高频搁架：夜间压暗，黄昏提亮。 */
  private tone: BiquadFilterNode | null = null
  private delay: DelayNode | null = null
  /** 白噪常驻，鼓组每一下都从这块 buffer 上取，避免每秒新建一堆 Buffer。 */
  private noise: AudioBuffer | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  private mode: Mode = 'night'
  private bar = 0
  private nextBarAt = 0
  private muted = false
  private started = false
  /** 用户音量。BGM 是背景，但之前压得太狠（0.32）听着像没开。 */
  private readonly volume = 0.5

  /** 在用户手势里调用（本项目就是"进入城市"那一下）。重复调用无副作用。 */
  start(mode: Mode = 'night') {
    this.mode = mode
    if (this.started) {
      void this.resume()
      return
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return

    let ac: AudioContext
    try {
      ac = new Ctor({ latencyHint: 'playback' })
    } catch {
      ac = new Ctor()
    }
    this.ac = ac
    this.started = true

    const master = ac.createGain()
    master.gain.value = 0
    const comp = ac.createDynamicsCompressor()
    // 加了鼓之后峰值高得多，压缩器比之前更用力一点，防止 kick 一直顶到限幅。
    comp.threshold.value = -16
    comp.knee.value = 20
    comp.ratio.value = 4
    comp.attack.value = 0.004
    comp.release.value = 0.28

    // 低频搁架：kick 落在 52Hz，用高通砍 60Hz 以下会把它一起削没。
    // 改成 85Hz 以下整体压 4.5dB —— 保住 kick 的"落地感"，但把那一层
    // 听不清、只让人觉得闷的厚度削掉。
    const rumble = ac.createBiquadFilter()
    rumble.type = 'lowshelf'
    rumble.frequency.value = 85
    rumble.gain.value = -4.5

    master.connect(rumble)
    rumble.connect(comp)
    comp.connect(ac.destination)

    const tone = ac.createBiquadFilter()
    tone.type = 'highshelf'
    tone.frequency.value = 2400
    // 夜间原来砍 3.5dB，把 2.4k 以上全压掉了，旋律的"叮"和 hat 的颗粒一起消失，
    // 只剩一层低频——那是压抑感最直接的来源。现在只压 1.2dB：还能听出是夜晚，
    // 但高频细节留住了。
    tone.gain.value = this.mode === 'night' ? -1.2 : 1
    tone.connect(master)

    const bus = ac.createGain()
    bus.gain.value = 1
    bus.connect(tone)

    const duck = ac.createGain()
    duck.gain.value = 1
    duck.connect(bus)

    // 钟琴音的反馈延迟。0.42 秒接近一拍 142bpm 的附点，但这里只是让
    // 点缀音散开成一片回声。
    const delay = ac.createDelay(1)
    delay.delayTime.value = 0.42
    const fb = ac.createGain()
    fb.gain.value = 0.36
    const wet = ac.createGain()
    wet.gain.value = 0.5
    delay.connect(fb)
    fb.connect(delay)
    delay.connect(wet)
    wet.connect(duck)

    this.master = master
    this.bus = bus
    this.duck = duck
    this.tone = tone
    this.delay = delay

    this.noise = airBuffer(ac, 1)

    this.startBeds()

    // 第一个和弦立刻落在当前时刻，别让开头空一小节。
    this.bar = 0
    this.nextBarAt = ac.currentTime + 0.15
    this.tick()
    this.timer = setInterval(() => this.tick(), 300)

    // 目标音量：静音状态走 0，否则走 volume。起手的 3 秒淡入交给这里。
    master.gain.cancelScheduledValues(ac.currentTime)
    master.gain.setValueAtTime(0.0001, ac.currentTime)
    master.gain.exponentialRampToValueAtTime(
      this.muted ? 0.0001 : this.volume,
      ac.currentTime + 2.6,
    )

    void this.resume()
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  /**
   * 常驻底噪。只剩一条：唱片沙沙声（crackle）。
   *
   * 原来还有一条"空气层"（粉噪 → 带通）。它是一条永不停止的循环噪声，
   * 前面几轮反复听到的"呜~~~~"主要就是它 —— 无论加多高的高通、把音量
   * 压得多低，一条不移动的连续能量在人耳里总是能挑出来。
   * 删掉之后，低频和中频里再没有任何常驻成分，剩下的声音全都是离散的。
   */
  private startBeds() {
    const ac = this.ac
    const bus = this.bus
    if (!ac || !bus) return

    const crackle = ac.createBufferSource()
    crackle.buffer = crackleBuffer(ac, 6)
    crackle.loop = true
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1600
    const cGain = ac.createGain()
    cGain.gain.value = 0.05
    crackle.connect(hp)
    hp.connect(cGain)
    cGain.connect(bus)
    crackle.start()
  }

  private tick() {
    const ac = this.ac
    if (!ac) return
    const now = ac.currentTime
    // 前提 0.7 秒调度：setInterval 抖动、标签页降频都不会让鼓点迟到。
    if (this.nextBarAt < now - 1) this.nextBarAt = now + 0.1
    while (this.nextBarAt < now + 0.7) {
      this.scheduleBar(this.nextBarAt, this.bar)
      this.nextBarAt += BAR
      this.bar++
    }
  }

  private scheduleBar(at: number, bar: number) {
    const ac = this.ac
    const bus = this.bus
    const duck = this.duck
    if (!ac || !bus || !duck) return

    const section = SECTIONS[bar % CYCLE]
    const prog = CHORDS[this.mode]
    const chord = prog[bar % prog.length]

    this.pad(at, chord.slice(1), bus, section.bright)
    this.bass(at, chord[0], duck)

    if (section.kick) this.drums(at, section, duck, bus)

    // 旋律：固定动机，不是随机音阶。跟着 duck 走，kick 时一起让路。
    const phrase = MELODY[this.mode][bar % CYCLE]
    for (const [step, midi, dur] of phrase) {
      this.leadNote(at + step * STEP, midi, dur * STEP, duck, section.lead)
    }
  }

  /** 一小节 16 步的鼓。lo-fi 的关键是"不齐"：kick 和 ghost hat 都带一点随机。 */
  private drums(at: number, section: Section, duck: GainNode, bus: GainNode) {
    // kick：0 和 10 是骨架，偶尔在 3 或 6 补一个三连音的推。
    const kicks = [0, 10]
    if (Math.random() < 0.35) kicks.push(6)
    if (Math.random() < 0.2) kicks.push(3)
    for (const step of kicks) {
      const t = at + step * STEP
      // 微摆：真实鼓手不会精确落在网格上，这一步让循环不容易被听出机械感。
      this.kick(t + rand(-0.008, 0.008), duck)
    }

    if (section.snare) {
      for (const step of [4, 12]) this.snare(at + step * STEP + rand(-0.012, 0.012), bus)
    }

    if (section.hat) {
      for (const step of [2, 6, 10, 14]) {
        // 反拍的 hat 是 lo-fi 的"摇摆"，音量逐拍递减一点更自然。
        this.hat(at + step * STEP + rand(-0.01, 0.01), 0.16 * (step % 4 === 2 ? 1 : 0.7), bus)
      }
    }

    // 段落到了最满的那两小节，才加 16 分的 ghost hat —— 这样"加密"才有对比。
    if (section.ghost) {
      for (const step of [1, 5, 9, 13]) {
        if (Math.random() < 0.6) this.hat(at + step * STEP + rand(-0.01, 0.01), 0.07, bus)
      }
    }

    // shaker 走 8 分的后半拍，只在最满的段落出现，给高频一点颗粒。
    if (section.ghost) {
      for (const step of [3, 7, 11, 15]) {
        this.shaker(at + step * STEP, 0.1, bus)
      }
    }
  }

  /** sidechain：kick 一下，pad 和 bass 立刻让路，再慢慢回来。 */
  private duckAt(at: number, duck: GainNode) {
    duck.gain.setTargetAtTime(0.62, at, 0.015)
    duck.gain.setTargetAtTime(1, at + 0.06, 0.14)
  }

  private kick(at: number, duck: GainNode) {
    const ac = this.ac
    if (!ac) return

    const osc = ac.createOscillator()
    osc.type = 'sine'
    // 从 135Hz 掉到 40Hz 以下，是 kick 的"身体"；不这样扫就只是一声闷响。
    // 但 38Hz 已经接近耳机听不见、只会让画面发闷的次低频。抬到 52Hz：
    // 依然有落地的重量，但不会在胸口糊成一团。
    osc.frequency.setValueAtTime(135, at)
    osc.frequency.exponentialRampToValueAtTime(58, at + 0.07)
    osc.frequency.exponentialRampToValueAtTime(52, at + 0.3)

    const env = ac.createGain()
    env.gain.setValueAtTime(0.0001, at)
    // 0.9 是"重低音"的量，对这种需要长时间播放的背景音乐太压了。
    env.gain.exponentialRampToValueAtTime(0.5, at + 0.006)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.34)

    osc.connect(env)
    env.connect(duck)
    osc.start(at)
    osc.stop(at + 0.45)
    this.duckAt(at, duck)
  }

  private snare(at: number, bus: GainNode) {
    const ac = this.ac
    const noise = this.noise
    if (!ac || !noise) return

    // 噪声层给"沙"，三角波给"皮"。
    const burst = ac.createBufferSource()
    burst.buffer = noise
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1900
    bp.Q.value = 0.7
    const env = ac.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(0.3, at + 0.004)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.19)
    burst.connect(bp)
    bp.connect(env)
    env.connect(bus)
    burst.start(at)
    burst.stop(at + 0.22)

    const body = ac.createOscillator()
    body.type = 'triangle'
    body.frequency.setValueAtTime(210, at)
    body.frequency.exponentialRampToValueAtTime(160, at + 0.1)
    const bodyEnv = ac.createGain()
    bodyEnv.gain.setValueAtTime(0.0001, at)
    bodyEnv.gain.exponentialRampToValueAtTime(0.12, at + 0.004)
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, at + 0.11)
    body.connect(bodyEnv)
    bodyEnv.connect(bus)
    body.start(at)
    body.stop(at + 0.14)
  }

  private hat(at: number, level: number, bus: GainNode) {
    const ac = this.ac
    const noise = this.noise
    if (!ac || !noise) return

    const src = ac.createBufferSource()
    src.buffer = noise
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7200
    const env = ac.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(level, at + 0.003)
    // 收得快才有"嚓"而不是"嘶"。
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.055)
    src.connect(hp)
    hp.connect(env)
    env.connect(bus)
    src.start(at)
    src.stop(at + 0.07)
  }

  private shaker(at: number, level: number, bus: GainNode) {
    const ac = this.ac
    const noise = this.noise
    if (!ac || !noise) return

    const src = ac.createBufferSource()
    src.buffer = noise
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 5200
    bp.Q.value = 1.6
    const env = ac.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(level, at + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.09)
    src.connect(bp)
    bp.connect(env)
    env.connect(bus)
    src.start(at)
    src.stop(at + 0.11)
  }

  /** bright 决定这一小节 pad 有多亮，跟着段落表走。 */
  /**
   * 和弦：不再是"一小节一条长音"，而是每小节两下的短促 stab。
   *
   * 之前不管怎么调包络、怎么切低频，"呜~~~~"都还在，因为根源不是音色而是
   * 形态：一段持续 4 秒、10 个振荡器叠在一起的和弦，无论多轻都是一条不动的
   * 长音。人耳对"不移动的连续能量"最敏感，怎么降音量都还是能挑出来。
   *
   * lo-fi hiphop 本来就是弹短和弦的，不是铺 pad 的。换成打击式包络
   * （25ms 起音、0.5 秒收干）之后，每一下都是独立的点，中间有明确的静音，
   * 长音在物理上就不存在了。
   */
  private pad(at: number, notes: number[], bus: GainNode, bright: number) {
    const ac = this.ac
    if (!ac) return

    const base = this.mode === 'night' ? 980 : 1250
    const cut = base + bright * (this.mode === 'night' ? 1500 : 1900)

    // 和声落在 0 和 10 步，和 bass、kick 同一个骨架，三者才咬得住。
    for (const step of [0, 10]) {
      const t = at + step * STEP

      const filter = ac.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(cut, t)
      filter.Q.value = 0.9

      const hp = ac.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 200
      hp.Q.value = 0.7

      const env = ac.createGain()
      const level = 0.1
      const hold = 0.5
      env.gain.setValueAtTime(0.0001, t)
      // 25ms 起音：够软不"咔"，但够快，能听出这是一下"弹"。
      env.gain.exponentialRampToValueAtTime(level, t + 0.025)
      env.gain.exponentialRampToValueAtTime(level * 0.3, t + hold * 0.5)
      env.gain.exponentialRampToValueAtTime(0.0001, t + hold)

      filter.connect(hp)
      hp.connect(env)
      env.connect(bus)

      const voices: Array<[OscillatorType, number, number]> = [
        ['triangle', -5, 0.5],
        // 锯齿只留一点：它的高次谐波在中低频堆成一层"嗡嗡"的糊。
        ['sawtooth', 5, 0.12],
      ]
      notes.forEach((note) => {
        const f = mtof(note)
        for (const [type, detune, amp] of voices) {
          const osc = ac.createOscillator()
          osc.type = type
          osc.frequency.value = f
          // 固定失谐（不再按声部索引 ±1.5 音分左右摆动）：
          // 那样叠出来会有 1Hz 左右的拍频，正好是"缓慢晃动"的听感。
          osc.detune.value = detune
          const g = ac.createGain()
          g.gain.value = amp
          osc.connect(g)
          g.connect(filter)
          osc.start(t)
          osc.stop(t + hold + 0.05)
        }
      })
    }
  }

  private bass(at: number, root: number, dest: GainNode) {
    const ac = this.ac
    if (!ac) return

    // 之前是"一小节一条长音"：起音 0.9 秒 + 收尾 1.2 秒，87–110Hz 连续不断地
    // 铺满整小节，听起来就是大提琴在中低频拉长弓 —— 这是"压抑"最主要的来源。
    // 现在改成跟着 kick 骨架的短促闷音：8ms 起音、0.5 秒收掉，是"点"不是"线"，
    // 有了律动感，也不再占满那个频段。
    //
    // 而且整个 bass 抬高一个八度（root + 12）：87–110Hz 是次低频，长时间听会
    // 让人胸口发闷；174–220Hz 才是一个轻快的 lo-fi bass 该在的位置，
    // 它照样能被听成"低音"，但不再有压迫感。真正的次低频交给 kick 一个人负责。
    for (const step of [0, 10]) {
      const t = at + step * STEP + rand(-0.006, 0.006)
      const f = mtof(root + 12)

      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f

      // 一点二次谐波，让低音在小喇叭上也能被"感觉到"。
      const harm = ac.createOscillator()
      harm.type = 'triangle'
      harm.frequency.value = f * 2
      const harmGain = ac.createGain()
      harmGain.gain.value = 0.1

      // 低通压掉 500Hz 以上：闷音 bass 的"皮"是圆的，不带齿音。
      const lp = ac.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 500
      lp.Q.value = 0.8

      const env = ac.createGain()
      // 0.115 是"低音是主角"的量。现在它只是把和弦的根音垫住，
      // 加上抬了八度，这个数值必须跟着降下来，不然 174Hz 会更突出、更压。
      const level = 0.055
      env.gain.setValueAtTime(0.0001, t)
      env.gain.exponentialRampToValueAtTime(level, t + 0.008)
      env.gain.exponentialRampToValueAtTime(level * 0.45, t + 0.16)
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.52)

      osc.connect(lp)
      harm.connect(harmGain)
      harmGain.connect(lp)
      lp.connect(env)
      env.connect(dest)
      osc.start(t)
      harm.start(t)
      osc.stop(t + 0.56)
      harm.stop(t + 0.56)
    }
  }

  /**
   * 主旋律音色：加性合成的"电钢琴"。
   *
   * 不用 FM，因为 FM 的音色随 mod index 变得很快、很难调；这里直接叠三个正弦
   * 谐波，让高次谐波衰减更快——起音有"叮"的颗粒，尾巴只剩下温暖的正弦，
   * 正是 lo-fi 里那种便宜电钢的味道。
   *
   * 另外加 5.2Hz 的 vibrato 和一层 detune 0.2% 的复制。完全纯净的正弦
   * 听起来像测试音，微微的抖动和失谐才是"人弹的"。
   */
  private leadNote(at: number, note: number, dur: number, dest: GainNode, level: number) {
    const ac = this.ac
    const delay = this.delay
    if (!ac) return

    const f = mtof(note)
    const end = at + dur

    const env = ac.createGain()
    // 钢琴式包络：12ms 起音（够快，能听出"落指"），然后长衰减。
    // 峰值压在 pad 的总响度之上一点，否则旋律会被 5 个音叠起来的 pad 淹掉。
    const peak = 0.26 * level
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(peak, at + 0.012)
    env.gain.exponentialRampToValueAtTime(peak * 0.4, at + Math.min(0.55, dur * 0.6))
    env.gain.exponentialRampToValueAtTime(0.0001, end + 0.45)

    const lfo = ac.createOscillator()
    lfo.frequency.value = 5.2
    const vib = ac.createGain()
    vib.gain.value = f * 0.0026
    lfo.connect(vib)
    lfo.start(at)
    lfo.stop(end + 0.9)

    const partials: Array<[number, number]> = [
      [1, 1],
      [2, 0.3],
      [3, 0.08],
      // 稍微失谐的第二基频：和主音拍频，产生轻微的合唱感
      [1.002, 0.35],
    ]

    partials.forEach(([ratio, amp]) => {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f * ratio
      vib.connect(osc.frequency)

      const g = ac.createGain()
      // 高次谐波单独更快衰减：只有基频留下长尾巴
      g.gain.setValueAtTime(amp, at)
      g.gain.exponentialRampToValueAtTime(amp * 0.12, at + Math.min(0.3, dur * 0.35))

      osc.connect(g)
      g.connect(env)
      osc.start(at)
      osc.stop(end + 0.9)
    })

    env.connect(dest)
    // 走延迟才有空间感；干声仍然留在前面，不会糊。
    if (delay) env.connect(delay)
  }

  setMode(mode: Mode) {
    if (this.mode === mode) return
    this.mode = mode
    const ac = this.ac
    if (!ac || !this.tone) return
    // 亮度立刻过渡，和弦等下一小节自然换掉——硬切调性比什么都刺耳。
    this.tone.gain.cancelScheduledValues(ac.currentTime)
    this.tone.gain.setTargetAtTime(mode === 'night' ? -1.2 : 1, ac.currentTime, 1.2)
  }

  setMuted(muted: boolean) {
    this.muted = muted
    const ac = this.ac
    if (!ac || !this.master) return
    const now = ac.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setTargetAtTime(muted ? 0.0001 : this.volume, now, 0.5)
  }

  private async resume() {
    if (!this.ac) return
    if (this.ac.state !== 'running') {
      try {
        await this.ac.resume()
      } catch {
        /* 还没有用户手势，下一次点击会再试 */
      }
    }
  }

  /**
   * 硬停并关闭 AudioContext。
   *
   * 给 Vite 热更新用：改代码时旧模块的实例不会自己消失，它还会继续按
   * setInterval 排新音符，于是开发时会出现两套曲子叠着放 —— 听感上就是
   * 一堵永远停不下来的长音，而且怎么改代码都"还有"。
   */
  dispose() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    document.removeEventListener('visibilitychange', this.onVisibility)
    const ac = this.ac
    this.ac = null
    this.bus = null
    this.master = null
    this.duck = null
    this.tone = null
    this.delay = null
    this.noise = null
    this.started = false
    this.bar = 0
    if (ac) void ac.close().catch(() => undefined)
  }

  private onVisibility = () => {
    if (!this.ac) return
    // 切到后台就停：回来时用户不该发现音乐已经跑了两分钟。
    if (document.hidden) void this.ac.suspend()
    else if (!this.muted) void this.ac.resume()
  }
}

export const music = new Music()

// Vite 热更新时旧模块的 AudioContext 不会自动关掉，它会继续排新音符。
// 于是开发时会出现两套曲子叠着放（改一次代码叠一层），听感上就是一堵
// 永远停不下来的长音——"还有"很可能就是这个。这里把它接上。
if (import.meta.hot) {
  import.meta.hot.dispose(() => music.dispose())
}

export type { Mode as MusicMode }
