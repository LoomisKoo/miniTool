import { create } from 'zustand'
import { api, ApiError, clearToken, getToken, setToken } from './api'
import { restoreReturnSpot, saveReturnSpot, startCityFlyIn } from './game/walker'
import { floorLabel, unitBuilding } from './data/units'
import { music } from './audio/music'
import type {
  AdoptedPet,
  AdoptPetInput,
  EditorDraft,
  Favorite,
  FurnitureItem,
  FurnitureType,
  InteriorRef,
  NearbyInfo,
  PlaceDetail,
  SpaceDetail,
  User,
  World,
} from './types'

export type Panel =
  | { type: 'place'; id: string }
  | { type: 'pet'; id: string }
  | { type: 'space'; id: string }
  | { type: 'elevator'; id: string }
  | { type: 'editor'; id: string }
  | { type: 'favorites' }
  | { type: 'catalog' }
  | { type: 'about' }

export type Screen = 'intro' | 'city' | 'interior'

/** 对话里的一次选择（例如「带它回家」），点按后才执行。 */
export type DialogChoice = {
  label: string
  note?: string
  primary?: boolean
  onClick: () => void | Promise<void>
}

/** NPC 对话：一句一句往下翻，翻完自动关闭。 */
export type Dialog = {
  name: string
  role: string
  lines: string[]
  index: number
  /** 说话人的位置：走远了自动结束对话 */
  x?: number
  z?: number
  /** 宠物主人信息：有值时在对话里显示主人条 */
  owner?: { name: string; color: string; since: string | null }
  /** 宠物面板：有值时显示口粮余量和「喂它 / 改名」 */
  pet?: { id: string; own: boolean }
  /** 最后一句出现的选项；有选项时按 E 不会再直接关闭对话 */
  choices?: DialogChoice[]
}

type Hud = {
  x: number
  y: number
  z: number
  yaw: number
  stamina: number
  gliding: boolean
  flying: boolean
  overview: boolean
  speed: number
}

type AppState = {
  booted: boolean
  booting: boolean
  bootError: string | null
  user: User | null
  world: World | null
  /** 已经开始入城流程（片头淡出中）：用于提前预热场景。 */
  entering: boolean
  screen: Screen
  interior: InteriorRef | null
  interiorLabel: string
  buildingFloor: number
  /** 从楼内走廊/公共室内进入房间时，返回上一层而不是直接回街道。 */
  returnTarget: InteriorRef | null
  panel: Panel | null
  placeDetail: PlaceDetail | null
  spaceDetail: SpaceDetail | null
  loadingPanel: boolean
  panelError: string | null
  nearby: NearbyInfo | null
  toast: string | null
  dialog: Dialog | null
  hud: Hud
  night: boolean
  /** 画质档位：0 流畅 / 1 标准 / 2 精细，由帧率自适应调整，也可手动切换。 */
  quality: number
  pointerLocked: boolean
  favorites: Favorite[]
  visitedSpaces: string[]
  reportedIds: string[]
  /** 已记录的宠物，格式 `族/品种`。存在 localStorage，不依赖后端。 */
  seenPets: string[]
  /** 已经被领养的宠物（服务端返回）；野生池会过滤掉这些 id。 */
  pets: AdoptedPet[]
  /** 剩余口粮。喂宠物用，每天补 3 份。 */
  rations: number
  editor: EditorDraft | null
  selectedFurnitureId: string | null
  placingType: FurnitureType | null
  brushColor: string
  /** 背景音乐开关。存在 localStorage，和音量无关——这里只有开/关。 */
  musicOn: boolean

  boot: () => Promise<void>
  startExploring: () => void
  /** 点击“进入城市”的瞬间：让场景趁片头淡出预热一次，别把开销留到运镜收尾。 */
  beginEnter: () => void
  refreshWorld: () => Promise<void>
  openPlace: (id: string, silent?: boolean) => Promise<void>
  openSpace: (id: string, silent?: boolean) => Promise<void>
  closePanel: () => void
  openPanel: (panel: Panel) => void
  enterTarget: (target: InteriorRef, label?: string) => void
  exitCity: () => void
  openElevator: (id: string) => void
  setBuildingFloor: (floor: number) => void
  markVisited: (id: string) => Promise<void>
  sendMessage: (input: {
    targetType: 'place' | 'space' | 'pet'
    targetId: string
    body: string
    parentId?: string | null
    mediaKind?: 'none' | 'image' | 'audio'
    mediaRef?: string | null
  }) => Promise<boolean>
  deletePost: (id: string) => Promise<void>
  reportPost: (id: string) => Promise<void>
  toggleFavorite: (
    targetType: 'place' | 'space' | 'pet',
    targetId: string,
  ) => Promise<{ favorited: boolean; count: number } | null>
  loadFavorites: () => Promise<void>
  claimSpace: (id: string) => Promise<void>
  releaseSpace: (id: string) => Promise<void>
  renameSelf: (name: string) => Promise<void>
  setHud: (hud: Hud) => void
  setNearby: (nearby: NearbyInfo | null) => void
  /** 记录一只观察过的宠物。重复调用无副作用。 */
  recordPet: (key: string) => void
  /** 领养一只野生宠物。并发失败时提示主人名字并返回 null。 */
  adoptPet: (input: AdoptPetInput) => Promise<AdoptedPet | null>
  /** 喂一只宠物（消耗 1 份口粮），喂过之后才能给它留言。 */
  feedPet: (id: string) => Promise<boolean>
  renamePet: (id: string, name: string) => Promise<boolean>
  /** 每天补 3 份口粮（上限 6），启动时调一次。 */
  claimRations: () => Promise<void>
  setPointerLocked: (locked: boolean) => void
  toggleNight: () => void
  toggleMusic: () => void
  setQuality: (quality: number) => void
  showToast: (message: string) => void
  openDialog: (dialog: Omit<Dialog, 'index'>) => void
  nextDialog: () => void
  closeDialog: () => void
  startEditing: () => void
  cancelEditing: () => void
  editorPatch: (patch: Partial<EditorDraft>) => void
  paletteAdd: (type: FurnitureType) => void
  setBrushColor: (color: string) => void
  selectFurniture: (id: string | null) => void
  editorFloorClick: (x: number, z: number) => void
  rotateSelected: (delta: number) => void
  colorSelected: (color: string) => void
  removeSelected: () => void
  saveEditor: () => Promise<void>
}

const DEFAULT_TITLE = '微光城区 · LUMEN DISTRICT'
const DEFAULT_DESC =
  '一座可以走进去的 3D 城市。探索广场与街巷，进入建筑，认领你的房间，留下留言与访问印记。'

function setMeta(title: string, description: string) {
  document.title = title
  let meta = document.querySelector('meta[name="description"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'description')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', description)
  const ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) ogTitle.setAttribute('content', title)
  const ogDesc = document.querySelector('meta[property="og:description"]')
  if (ogDesc) ogDesc.setAttribute('content', description)
}

const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : error instanceof Error ? error.message : '出了点问题，请稍后再试'

let toastTimer: ReturnType<typeof setTimeout> | undefined

let curtainBusy = false

/**
 * 先压一层暗幕再执行重建类改动，等暗幕盖满才切，切完下一帧再揭开。
 * 昼夜切换、画质档切换都会重建材质/后处理，那几帧是画面最不稳的时候。
 */
function behindCurtain(apply: () => void) {
  if (curtainBusy) return
  curtainBusy = true
  document.body.classList.add('night-switching')
  setTimeout(() => {
    apply()
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setTimeout(() => {
          document.body.classList.remove('night-switching')
          curtainBusy = false
        }, 60),
      ),
    )
  }, 220)
}

function releasePointer() {
  if (document.pointerLockElement) document.exitPointerLock()
}

function draftFromSpace(space: SpaceDetail['space']): EditorDraft {
  return {
    name: space.name,
    description: space.description,
    template: space.template,
    wallColor: space.wallColor,
    floorColor: space.floorColor,
    art: { ...space.art },
    layout: { items: space.layout.items.map((item) => ({ ...item })) },
    isOpen: space.isOpen,
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `item-${Math.random().toString(36).slice(2)}`

// 图鉴记录：只记「见过哪些品种」，不涉及后端，所以放本地。
const SEEN_KEY = 'lumen-pets-seen'

function loadSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveSeen(list: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(list))
  } catch {
    /* 隐私模式下写不进去，这一局照样能看图鉴 */
  }
}

const MUSIC_KEY = 'lumen-music-on'

function loadMusicOn(): boolean {
  try {
    return window.localStorage.getItem(MUSIC_KEY) !== 'off'
  } catch {
    return true
  }
}

export const useApp = create<AppState>((set, get) => ({
  booted: false,
  booting: false,
  bootError: null,
  user: null,
  world: null,
  entering: false,
  screen: 'intro',
  interior: null,
  interiorLabel: '',
  buildingFloor: 1,
  returnTarget: null,
  panel: null,
  placeDetail: null,
  spaceDetail: null,
  loadingPanel: false,
  panelError: null,
  nearby: null,
  toast: null,
  dialog: null,
  hud: { x: 0, y: 0, z: 26, yaw: 0, stamina: 1, gliding: false, flying: false, overview: false, speed: 0 },
  night: true,
  quality: 2,
  pointerLocked: false,
  favorites: [],
  visitedSpaces: [],
  reportedIds: [],
  seenPets: loadSeen(),
  pets: [],
  rations: 0,
  editor: null,
  selectedFurnitureId: null,
  placingType: null,
  brushColor: '#8a7a63',
  musicOn: loadMusicOn(),

  boot: async () => {
    if (get().booting) return
    set({ booting: true, bootError: null })
    try {
      let user: User | null = null
      if (getToken()) {
        try {
          const me = await api.me()
          user = me.user
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) throw error
          clearToken()
        }
      }
      if (!user) {
        const session = await api.createSession()
        setToken(session.token)
        user = session.user
      }
      const world = await api.world()
      set({
        user,
        world,
        pets: world.pets ?? [],
        booted: true,
        booting: false,
        bootError: null,
      })
      setMeta(DEFAULT_TITLE, DEFAULT_DESC)
      // 登录后补发当天口粮：跨天才发，一天只发一次
      void get().claimRations()

      const params = new URLSearchParams(window.location.search)
      const space = params.get('space')
      const place = params.get('place')
      const enter = params.get('enter')
      if (space || place || enter) set({ screen: 'city', entering: true })
      if (space) {
        await get().openSpace(space)
        if (params.get('enter') === '1') get().enterTarget({ kind: 'space', id: space })
      } else if (place) {
        await get().openPlace(place)
      } else if (enter === 'gallery' || enter === 'cafe') {
        get().enterTarget({ kind: 'public', id: enter })
      } else if (enter?.startsWith('building:')) {
        const [id, floor] = enter.slice(9).split('@')
        get().enterTarget({ kind: 'building', id, floor: floor ? Number(floor) : 1 })
      } else if (enter?.startsWith('space:')) {
        get().enterTarget({ kind: 'space', id: enter.slice(6) })
      }
    } catch (error) {
      set({ booting: false, bootError: errorMessage(error) })
    }
  },

  beginEnter: () => {
    // 这里仍然是"进入城市"那次点击的同步调用栈，是浏览器允许启动音频的时机。
    // 放到 startExploring 里就晚了 300ms，Safari 会判定为自动播放而拦掉。
    music.setMuted(!get().musicOn)
    music.start(get().night ? 'night' : 'dusk')
    set({ entering: true })
  },

  startExploring: () => {
    // 先记时间戳：镜头接下来会从片头的高空机位俯冲到主角身后
    startCityFlyIn()
    set({ screen: 'city', entering: true })
    setMeta(DEFAULT_TITLE, DEFAULT_DESC)
  },

  refreshWorld: async () => {
    try {
      const world = await api.world()
      set({ world, user: world.user || get().user, pets: world.pets ?? [] })
    } catch {
      /* 保持当前内容，不打断游玩 */
    }
  },

  openPlace: async (id, silent = false) => {
    if (!silent) {
      releasePointer()
      set({ panel: { type: 'place', id }, loadingPanel: true, panelError: null })
    }
    try {
      const detail = await api.place(id)
      set({ placeDetail: detail, loadingPanel: false, panelError: null })
      if (!silent) setMeta(`${detail.place.name} · 微光城区`, detail.place.description)
    } catch (error) {
      if (!silent) set({ loadingPanel: false, panelError: errorMessage(error) })
    }
  },

  openSpace: async (id, silent = false) => {
    if (!silent) {
      releasePointer()
      set({ panel: { type: 'space', id }, loadingPanel: true, panelError: null })
    }
    try {
      const detail = await api.space(id)
      set({ spaceDetail: detail, loadingPanel: false, panelError: null })
      if (!silent) setMeta(`${detail.space.name} · 微光城区`, detail.space.description)
    } catch (error) {
      if (!silent) set({ loadingPanel: false, panelError: errorMessage(error) })
    }
  },

  closePanel: () => {
    set({ panel: null, editor: null, selectedFurnitureId: null, placingType: null })
    setMeta(DEFAULT_TITLE, DEFAULT_DESC)
    if (document.pointerLockElement) document.exitPointerLock()
  },

  openPanel: (panel) => {
    releasePointer()
    set({ panel })
  },

  enterTarget: (target, label) => {
    if (get().screen === 'city') saveReturnSpot()
    const current = get().interior
    const fromInterior = get().screen === 'interior' && current !== null
    const returnTarget =
      target.kind === 'space' && fromInterior && current && current.kind !== 'space' ? current : null
    const building = target.kind === 'building' ? unitBuilding(target.id) : null
    const floor = target.kind === 'building' ? target.floor ?? 1 : 1
    const name =
      label ||
      (target.kind === 'public'
        ? target.id === 'gallery'
          ? '光盒美术馆 · 中庭'
          : '街角咖啡'
        : target.kind === 'building'
          ? `${building?.name || target.id} · ${floorLabel(floor)}`
          : get().world?.spaces.find((s) => s.id === target.id)?.name || '个人空间')
    set({
      screen: 'interior',
      interior: target.kind === 'building' ? { ...target, floor } : target,
      buildingFloor: floor,
      interiorLabel: name,
      returnTarget,
      panel: null,
      editor: null,
      selectedFurnitureId: null,
      placingType: null,
      nearby: null,
      loadingPanel: false,
      panelError: null,
    })
    if (document.pointerLockElement) document.exitPointerLock()
    if (target.kind === 'space') {
      void get().openSpace(target.id, true)
      void get().markVisited(target.id)
    } else if (target.kind === 'public') {
      void get().openPlace(target.id === 'gallery' ? 'gallery-lobby' : 'corner-cafe', true)
    }
  },

  openElevator: (id) => {
    releasePointer()
    set({ panel: { type: 'elevator', id } })
  },

  setBuildingFloor: (floor) => {
    const interior = get().interior
    if (!interior || interior.kind !== 'building') return
    const building = unitBuilding(interior.id)
    const name = building?.name || interior.id
    set({
      interior: { ...interior, floor, from: undefined },
      buildingFloor: floor,
      interiorLabel: `${name} · ${floorLabel(floor)}`,
      panel: null,
      nearby: null,
    })
    if (document.pointerLockElement) document.exitPointerLock()
    get().showToast(`电梯到达 ${floorLabel(floor)}`)
  },

  exitCity: () => {
    const back = get().returnTarget
    if (back) {
      const floor = back.kind === 'building' ? back.floor ?? 1 : 1
      const label =
        back.kind === 'building'
          ? `${unitBuilding(back.id)?.name || back.id} · ${floorLabel(floor)}`
          : back.kind === 'public'
            ? back.id === 'gallery'
              ? '光盒美术馆 · 中庭'
              : '街角咖啡'
            : '室内空间'
      const current = get().interior
      set({
        screen: 'interior',
        interior: back.kind === 'building' && current?.kind === 'space' ? { ...back, from: current.id } : back,
        interiorLabel: label,
        buildingFloor: floor,
        returnTarget: null,
        panel: null,
        editor: null,
        nearby: null,
        selectedFurnitureId: null,
        placingType: null,
      })
      if (document.pointerLockElement) document.exitPointerLock()
      return
    }
    restoreReturnSpot()
    set({
      screen: 'city',
      interior: null,
      interiorLabel: '',
      buildingFloor: 1,
      returnTarget: null,
      panel: null,
      editor: null,
      nearby: null,
      selectedFurnitureId: null,
      placingType: null,
    })
    setMeta(DEFAULT_TITLE, DEFAULT_DESC)
  },

  markVisited: async (id) => {
    const { visitedSpaces, user, spaceDetail } = get()
    if (visitedSpaces.includes(id)) return
    if (spaceDetail?.space.ownerId && spaceDetail.space.ownerId === user?.id) {
      set({ visitedSpaces: [...visitedSpaces, id] })
      return
    }
    try {
      const result = await api.visit(id)
      set((state) => ({
        visitedSpaces: [...state.visitedSpaces, id],
        spaceDetail:
          state.spaceDetail && state.spaceDetail.space.id === id
            ? {
                ...state.spaceDetail,
                space: { ...state.spaceDetail.space, visitCount: result.count },
              }
            : state.spaceDetail,
      }))
      get().showToast(result.already ? '你之前来过这里，印记还在。' : '已在空间里留下访问印记。')
    } catch {
      /* 访问记录失败不挡进入 */
    }
  },

  sendMessage: async ({ targetType, targetId, body, parentId, mediaKind = 'none', mediaRef = null }) => {
    try {
      const result = await api.createPost({ targetType, targetId, body, parentId, mediaKind, mediaRef })
      set((state) => {
        if (targetType === 'place' && state.placeDetail) {
          return { placeDetail: { ...state.placeDetail, posts: [result.post, ...state.placeDetail.posts] } }
        }
        if (targetType === 'space' && state.spaceDetail) {
          return { spaceDetail: { ...state.spaceDetail, posts: [result.post, ...state.spaceDetail.posts] } }
        }
        return {}
      })
      get().showToast(parentId ? '回复已送达。' : '留言已留在城市里。')
      void get().refreshWorld()
      return true
    } catch (error) {
      get().showToast(errorMessage(error))
      return false
    }
  },

  deletePost: async (id) => {
    try {
      await api.deletePost(id)
      set((state) => {
        const strip = (posts: PlaceDetail['posts']) =>
          posts.filter((post) => post.id !== id && post.parentId !== id)
        return {
          placeDetail: state.placeDetail
            ? { ...state.placeDetail, posts: strip(state.placeDetail.posts) }
            : null,
          spaceDetail: state.spaceDetail
            ? { ...state.spaceDetail, posts: strip(state.spaceDetail.posts) }
            : null,
        }
      })
      get().showToast('留言已删除。')
      void get().refreshWorld()
    } catch (error) {
      get().showToast(errorMessage(error))
    }
  },

  reportPost: async (id) => {
    try {
      await api.reportPost(id, '访客举报：不适当内容')
      set((state) => ({ reportedIds: [...state.reportedIds, id] }))
      get().showToast('已提交举报。累计 3 次举报的内容会自动隐藏。')
    } catch (error) {
      get().showToast(errorMessage(error))
    }
  },

  toggleFavorite: async (targetType, targetId) => {
    try {
      const result = await api.toggleFavorite(targetType, targetId)
      set((state) => {
        if (targetType === 'place' && state.placeDetail?.place.id === targetId) {
          return { placeDetail: { ...state.placeDetail, favorite: result } }
        }
        if (targetType === 'space' && state.spaceDetail?.space.id === targetId) {
          return { spaceDetail: { ...state.spaceDetail, favorite: result } }
        }
        return {}
      })
      get().showToast(
        result.favorited
          ? targetType === 'pet'
            ? '已把它收进收藏。'
            : '已收藏这个地点。'
          : '已取消收藏。',
      )
      return result
    } catch (error) {
      get().showToast(errorMessage(error))
      return null
    }
  },

  loadFavorites: async () => {
    releasePointer()
    set({ panel: { type: 'favorites' }, loadingPanel: true, panelError: null })
    try {
      const result = await api.favorites()
      set({ favorites: result.favorites, loadingPanel: false })
    } catch (error) {
      set({ loadingPanel: false, panelError: errorMessage(error) })
    }
  },

  claimSpace: async (id) => {
    try {
      await api.claim(id)
      await get().openSpace(id)
      await get().refreshWorld()
      get().showToast('认领成功。现在可以布置这间空间了。')
    } catch (error) {
      get().showToast(errorMessage(error))
    }
  },

  releaseSpace: async (id) => {
    try {
      await api.release(id)
      await get().openSpace(id)
      await get().refreshWorld()
      get().showToast('已放弃这间空间，其他人现在可以认领。')
    } catch (error) {
      get().showToast(errorMessage(error))
    }
  },

  renameSelf: async (name) => {
    try {
      const result = await api.rename(name)
      set({ user: result.user })
      get().showToast('昵称已更新。')
    } catch (error) {
      get().showToast(errorMessage(error))
    }
  },

  setHud: (hud) => set({ hud }),
  toggleNight: () => {
    // 昼夜切换要重建一批贴图和合批网格，会卡一两帧。先压一层暗幕，
    // 等暗幕盖满再切，卡顿发生在幕后；切完下一帧再揭开。
    behindCurtain(() => set({ night: !get().night }))
  },
  toggleMusic: () => {
    const on = !get().musicOn
    set({ musicOn: on })
    music.setMuted(!on)
    try {
      window.localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off')
    } catch {
      /* 隐私模式下记不住，这一局仍然生效 */
    }
  },
  setQuality: (quality) => {
    if (get().quality === quality) return
    // 档位现在只改 AO 采样与 Bloom 强度，不会重建 composer / canvas，
    // 所以不需要暗幕：走暗幕反而会在每次降档时闪一下黑。
    set({ quality })
  },

  setNearby: (nearby) => {
    const current = get().nearby
    if (nearby?.id === current?.id && nearby?.hint === current?.hint) return
    set({ nearby })
  },

  recordPet: (key) => {
    if (get().seenPets.includes(key)) return
    const next = [...get().seenPets, key]
    saveSeen(next)
    set({ seenPets: next })
  },

  adoptPet: async (input) => {
    try {
      const { pet } = await api.adoptPet(input)
      set({ pets: [...get().pets.filter((item) => item.id !== pet.id), pet] })
      get().recordPet(`${input.speciesId}/${input.breedId}`)
      return pet
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        if (error.data.code === 'pet_limit') {
          get().showToast('每位访客只能领养一只宠物')
          return null
        }
        // 两个人同时点同一只：服务端只让一个成功，另一个人要知道它去了哪。
        const ownerName = String(error.data.ownerName || '别人')
        get().closeDialog()
        get().showToast(`晚了一步，它刚被 @${ownerName} 带走了`)
        void get().refreshWorld()
        return null
      }
      get().showToast(errorMessage(error))
      return null
    }
  },

  feedPet: async (id) => {
    if (get().rations < 1) {
      get().showToast('口粮不够了，明天再来吧')
      return false
    }
    try {
      const { pet, rations } = await api.feedPet(id)
      set({ rations, pets: get().pets.map((item) => (item.id === pet.id ? { ...item, ...pet } : item)) })
      get().showToast(`喂了 ${pet.nickname || '它'} 一顿。`)
      return true
    } catch (error) {
      get().showToast(errorMessage(error))
      return false
    }
  },

  renamePet: async (id, name) => {
    try {
      const { pet } = await api.renamePet(id, name)
      set({ pets: get().pets.map((item) => (item.id === pet.id ? { ...item, ...pet } : item)) })
      get().showToast(`从现在起它叫「${pet.nickname}」了。`)
      return true
    } catch (error) {
      get().showToast(errorMessage(error))
      return false
    }
  },

  claimRations: async () => {
    try {
      const { rations, granted } = await api.claimRations()
      set({ rations })
      if (granted > 0) get().showToast(`领到 ${granted} 份口粮，可以去喂宠物了。`)
    } catch {
      /* 口粮是锦上添花，拿不到不打断进城的流程 */
    }
  },

  setPointerLocked: (pointerLocked) => set({ pointerLocked }),

  openDialog: (dialog) => {
    set({ dialog: { ...dialog, index: 0 } })
  },

  nextDialog: () => {
    const d = get().dialog
    if (!d) return
    if (d.index + 1 >= d.lines.length) {
      // 最后一句有选项时不能直接关掉：领养要由玩家明确选择。
      if (d.choices?.length) return
      set({ dialog: null })
    } else set({ dialog: { ...d, index: d.index + 1 } })
  },

  closeDialog: () => set({ dialog: null }),

  showToast: (message) => {
    set({ toast: message })
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ toast: null }), 3200)
  },

  startEditing: () => {
    const detail = get().spaceDetail
    if (!detail?.isOwner) return
    releasePointer()
    if (get().screen !== 'interior' || get().interior?.id !== detail.space.id) {
      get().enterTarget({ kind: 'space', id: detail.space.id }, detail.space.name)
    }
    set({
      editor: draftFromSpace(detail.space),
      panel: { type: 'editor', id: detail.space.id },
      selectedFurnitureId: null,
      placingType: null,
      brushColor: '#8a7a63',
    })
  },

  cancelEditing: () => {
    const detail = get().spaceDetail
    set({
      editor: null,
      selectedFurnitureId: null,
      placingType: null,
      panel: detail ? { type: 'space', id: detail.space.id } : null,
    })
  },

  editorPatch: (patch) => {
    const editor = get().editor
    if (!editor) return
    set({ editor: { ...editor, ...patch, art: patch.art ? { ...patch.art } : editor.art } })
  },

  paletteAdd: (type) => set({ placingType: type, selectedFurnitureId: null }),

  setBrushColor: (color) => set({ brushColor: color }),

  selectFurniture: (id) => set({ selectedFurnitureId: id, placingType: null }),

  editorFloorClick: (x, z) => {
    const { editor, placingType, selectedFurnitureId, brushColor } = get()
    if (!editor) return
    const px = clamp(x, -5.7, 5.7)
    const pz = clamp(z, -3.8, 3.8)
    if (placingType) {
      if (editor.layout.items.length >= 16) {
        get().showToast('最多摆放 16 件家具，先移除一件吧。')
        return
      }
      const item: FurnitureItem = {
        id: newId(),
        type: placingType,
        x: Math.round(px * 100) / 100,
        z: Math.round(pz * 100) / 100,
        rot: 0,
        color: brushColor,
      }
      set({
        editor: { ...editor, layout: { items: [...editor.layout.items, item] } },
        selectedFurnitureId: item.id,
        placingType: null,
      })
      return
    }
    if (selectedFurnitureId) {
      set({
        editor: {
          ...editor,
          layout: {
            items: editor.layout.items.map((item) =>
              item.id === selectedFurnitureId
                ? { ...item, x: Math.round(px * 100) / 100, z: Math.round(pz * 100) / 100 }
                : item,
            ),
          },
        },
      })
    }
  },

  rotateSelected: (delta) => {
    const { editor, selectedFurnitureId } = get()
    if (!editor || !selectedFurnitureId) return
    set({
      editor: {
        ...editor,
        layout: {
          items: editor.layout.items.map((item) =>
            item.id === selectedFurnitureId ? { ...item, rot: item.rot + delta } : item,
          ),
        },
      },
    })
  },

  colorSelected: (color) => {
    const { editor, selectedFurnitureId } = get()
    set({ brushColor: color })
    if (!editor || !selectedFurnitureId) return
    set({
      editor: {
        ...editor,
        layout: {
          items: editor.layout.items.map((item) =>
            item.id === selectedFurnitureId ? { ...item, color } : item,
          ),
        },
      },
    })
  },

  removeSelected: () => {
    const { editor, selectedFurnitureId } = get()
    if (!editor || !selectedFurnitureId) return
    set({
      editor: {
        ...editor,
        layout: { items: editor.layout.items.filter((item) => item.id !== selectedFurnitureId) },
      },
      selectedFurnitureId: null,
    })
  },

  saveEditor: async () => {
    const { editor, spaceDetail } = get()
    if (!editor || !spaceDetail) return
    set({ loadingPanel: true })
    try {
      const body = {
        name: editor.name.trim(),
        description: editor.description.trim(),
        template: editor.template,
        wallColor: editor.wallColor,
        floorColor: editor.floorColor,
        art: editor.art,
        layout: { items: editor.layout.items },
        isOpen: editor.isOpen,
      }
      const result = await api.updateSpace(spaceDetail.space.id, body)
      set({
        spaceDetail: { ...spaceDetail, space: result.space },
        editor: null,
        selectedFurnitureId: null,
        placingType: null,
        loadingPanel: false,
        panel: { type: 'space', id: spaceDetail.space.id },
      })
      get().showToast('空间已保存，访客现在看到的是新布置。')
      void get().refreshWorld()
    } catch (error) {
      set({ loadingPanel: false })
      get().showToast(errorMessage(error))
    }
  },
}))
