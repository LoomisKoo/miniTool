import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '../store'
import { cityShareUrl, copyText } from '../util'
import { toggleFlight, toggleOverview, walker } from '../game/walker'

const DIRS = ['北', '西北', '西', '西南', '南', '东南', '东', '东北']

function Icon({
  name,
}: {
  name: 'share' | 'heart' | 'info' | 'drone' | 'fly' | 'moon' | 'sun' | 'spark' | 'back' | 'sound' | 'mute'
}) {
  const paths: Record<string, ReactNode> = {
    share: (
      <>
        <path d="M8.8 13.2 15 9.4" />
        <circle cx="6.4" cy="14.4" r="2.3" />
        <circle cx="17.6" cy="8.2" r="2.3" />
        <path d="M9.2 18.4c1.9 1.5 4.7 1.3 6.3-.6" opacity="0.5" />
      </>
    ),
    heart: <path d="M12 19.2S5.2 15.3 5.2 10.6A3.6 3.6 0 0 1 12 9a3.6 3.6 0 0 1 6.8 1.6c0 4.7-6.8 8.6-6.8 8.6Z" />,
    info: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 11v5.2M12 7.9v.2" />
      </>
    ),
    drone: (
      <>
        <rect x="8.6" y="8.6" width="6.8" height="6.8" rx="1.4" />
        <path d="M5 5l3 3M19 5l-3 3M5 19l3-3M19 19l-3-3" />
        <circle cx="4.4" cy="4.4" r="1.4" />
        <circle cx="19.6" cy="4.4" r="1.4" />
        <circle cx="4.4" cy="19.6" r="1.4" />
        <circle cx="19.6" cy="19.6" r="1.4" />
      </>
    ),
    fly: (
      <>
        <path d="M3.6 13.4 12 9l8.4 4.4" />
        <path d="M6.4 16.8 12 13.6l5.6 3.2" />
        <path d="M12 6.4v3" />
      </>
    ),
    moon: <path d="M15.6 4.8a7.6 7.6 0 1 0 3.6 12.6 6.2 6.2 0 0 1-3.6-12.6Z" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3.4v2M12 18.6v2M3.4 12h2M18.6 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" />
      </>
    ),
    spark: (
      <>
        <path d="M12 4.2 13.8 10l5.8 1.8-5.8 1.8L12 19.4l-1.8-5.8L4.4 11.8 10.2 10Z" />
      </>
    ),
    back: (
      <>
        <path d="M14.4 6.6 9 12l5.4 5.4" />
      </>
    ),
    sound: (
      <>
        <path d="M4.8 9.4h2.8l3.8-3.1v11.4l-3.8-3.1H4.8z" />
        <path d="M15.4 9.3a3.9 3.9 0 0 1 0 5.4M17.8 7a7.3 7.3 0 0 1 0 10" />
      </>
    ),
    mute: (
      <>
        <path d="M4.8 9.4h2.8l3.8-3.1v11.4l-3.8-3.1H4.8z" />
        <path d="M15.6 9.8l4.2 4.2M19.8 9.8 15.6 14" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export function Hud() {
  const screen = useApp((state) => state.screen)
  const interior = useApp((state) => state.interior)
  const interiorLabel = useApp((state) => state.interiorLabel)
  const panel = useApp((state) => state.panel)
  const user = useApp((state) => state.user)
  const world = useApp((state) => state.world)
  const hud = useApp((state) => state.hud)
  const night = useApp((state) => state.night)
  const musicOn = useApp((state) => state.musicOn)
  const toggleMusic = useApp((state) => state.toggleMusic)
  const pointerLocked = useApp((state) => state.pointerLocked)
  const nearby = useApp((state) => state.nearby)
  const spaceDetail = useApp((state) => state.spaceDetail)
  const editor = useApp((state) => state.editor)
  const exitCity = useApp((state) => state.exitCity)
  const openSpace = useApp((state) => state.openSpace)
  const openPanel = useApp((state) => state.openPanel)
  const loadFavorites = useApp((state) => state.loadFavorites)
  const startEditing = useApp((state) => state.startEditing)
  const showToast = useApp((state) => state.showToast)
  const toggleNight = useApp((state) => state.toggleNight)
  const [hintSeen, setHintSeen] = useState(false)

  useEffect(() => {
    if (pointerLocked) setHintSeen(true)
  }, [pointerLocked])

  useEffect(() => {
    if (hintSeen || screen !== 'city') return
    const dismiss = () => setHintSeen(true)
    window.addEventListener('keydown', dismiss, { once: true })
    window.addEventListener('pointerdown', dismiss, { once: true })
    return () => {
      window.removeEventListener('keydown', dismiss)
      window.removeEventListener('pointerdown', dismiss)
    }
  }, [hintSeen, screen])

  const area = useMemo(() => {
    const places = world?.places || []
    let best: { name: string; distance: number } | null = null
    for (const place of places) {
      const distance = Math.hypot(place.x - hud.x, place.z - hud.z)
      if (!best || distance < best.distance) best = { name: place.name, distance }
    }
    if (best && best.distance < 18) return best.name
    if (screen === 'interior') return interiorLabel || '室内空间'
    return '微光城区 · 主街'
  }, [world, hud.x, hud.z, screen, interiorLabel])

  if (screen === 'intro' || !screen) return null

  const yawDeg = ((-hud.yaw * 180) / Math.PI + 360) % 360
  const dir = DIRS[Math.round(yawDeg / 45) % 8]
  const isOwner = Boolean(
    interior?.kind === 'space' && spaceDetail?.space.id === interior.id && spaceDetail.isOwner,
  )

  const share = async () => {
    let url = ''
    if (interior?.kind === 'space') {
      url = cityShareUrl({ space: interior.id })
      if (!spaceDetail || spaceDetail.space.id !== interior.id) void openSpace(interior.id, true)
    } else if (interior?.kind === 'public') {
      url = cityShareUrl({ enter: interior.id })
    } else if (interior?.kind === 'building') {
      url = cityShareUrl({ enter: `building:${interior.id}@${interior.floor ?? 1}` })
    } else {
      url = cityShareUrl()
    }
    const ok = await copyText(url)
    showToast(ok ? '分享链接已复制，发给朋友就能直接进来。' : `复制失败，请手动复制：${url}`)
  }

  const claimedSpace = world?.spaces.find((space) => space.ownerId === user?.id)
  const claimedHere = interior?.kind === 'space' && claimedSpace?.id === interior.id
  const flying = hud.flying

  return (
    <>
      <header className="hud-top">
        <div className="hud-loc">
          {screen === 'interior' ? (
            <button className="hud-round sm" onClick={exitCity} aria-label="返回主街">
              <Icon name="back" />
            </button>
          ) : (
            <span className="hud-mark" aria-hidden="true" />
          )}
          <div className="hud-loc-copy">
            <b>{screen === 'interior' ? interiorLabel : area}</b>
            <em>{screen === 'interior' ? '室内空间' : '微光城区'}</em>
          </div>
          {screen === 'city' && (
            <span className={`hud-status ${pointerLocked ? 'on' : ''}`}>
              {editor ? '编辑中' : pointerLocked ? '在线' : '未接入'}
            </span>
          )}
        </div>

        <div className="hud-tools">
          {screen === 'city' && (
            <button
              className={`hud-round ${hud.overview ? 'on' : ''}`}
              aria-pressed={hud.overview}
              onClick={() => {
                toggleOverview()
                showToast(walker.overview ? '城市总览 · V 返回街道' : '已回到街道视角')
              }}
              title="城市总览 (V)"
              aria-label="城市总览"
            >
              <Icon name="drone" />
            </button>
          )}
          <button
            className="hud-round"
            aria-pressed={night}
            onClick={() => {
              toggleNight()
              showToast(night ? '已切换为黄昏' : '已切换为夜间')
            }}
            title="昼夜 (L)"
            aria-label="切换昼夜"
          >
            <Icon name={night ? 'sun' : 'moon'} />
          </button>
          <button
            className={`hud-round ${musicOn ? 'on' : ''}`}
            aria-pressed={musicOn}
            onClick={() => {
              toggleMusic()
              showToast(musicOn ? '背景音乐已关闭' : '背景音乐已开启')
            }}
            title="背景音乐"
            aria-label="切换背景音乐"
          >
            <Icon name={musicOn ? 'sound' : 'mute'} />
          </button>
          <button className="hud-round" onClick={share} title="分享" aria-label="分享">
            <Icon name="share" />
          </button>
          <button className="hud-round" onClick={() => void loadFavorites()} title="收藏" aria-label="收藏">
            <Icon name="heart" />
          </button>
          <button
            className="hud-round"
            onClick={() => openPanel({ type: 'about' })}
            title="关于与快捷键"
            aria-label="关于"
          >
            <Icon name="info" />
          </button>
        </div>
      </header>

      {screen === 'city' && (
        <div className="hud-compass">
          <span className="hud-compass-arrow" style={{ transform: `rotate(${hud.yaw}rad)` }} />
          <b>{dir}</b>
          <em>
            {hud.x.toFixed(0)} · {hud.z.toFixed(0)}
          </em>
          {flying && (
            <span className="hud-compass-alt">
              {hud.y.toFixed(0)}
              <small>m</small>
            </span>
          )}
        </div>
      )}

      {screen === 'city' && nearby && !panel && (
        <button className="nearby" onClick={nearby.action} aria-label={`${nearby.label}：${nearby.hint}`}>
          <kbd>E</kbd>
          <span>
            <b>{nearby.label}</b>
            <em>{nearby.hint}</em>
          </span>
          <i>›</i>
        </button>
      )}

      <div className="hud-dock">
        {flying && (
          <span className="hud-note">空格上升 · C 下降 · Shift 加速</span>
        )}

        {screen === 'city' && !panel && (
          <div className="hud-dock-row">
            <button
              className={`hud-flight ${flying ? 'on' : ''}`}
              aria-pressed={flying}
              onClick={() => {
                toggleFlight()
                showToast(flying ? '已降落' : '起飞：空格上升 · C 下降 · Shift 加速')
              }}
            >
              <kbd>F</kbd>
              <span>{flying ? '降落' : '起飞'}</span>
            </button>
            {claimedSpace && (
              <button
                className="hud-soft"
                onClick={() => {
                  openSpace(claimedSpace.id)
                  showToast('从对应楼层的房门进去，就是你的空间')
                }}
              >
                我的空间
              </button>
            )}
          </div>
        )}

        {screen === 'interior' && (
          <div className="hud-dock-row">
            {isOwner && !editor && (
              <button className="hud-flight" onClick={startEditing}>
                <Icon name="spark" />
                <span>布置房间</span>
              </button>
            )}
            {claimedHere && editor && <span className="hud-soft">布置中</span>}
          </div>
        )}
      </div>

      {!hintSeen && !pointerLocked && !panel && screen === 'city' && (
        <div className="hud-hint">
          <b>点击画面开始操控</b>
          <em>WASD 行走 · 滚轮缩放 · F 起飞 · V 总览</em>
        </div>
      )}
    </>
  )
}
