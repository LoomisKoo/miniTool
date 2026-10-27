import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useApp } from '../store'
import { breedOf, catalogBreedsOf, catalogKeyOf, RARITY_LABEL, RARITY_STARS, SPECIES, type Breed, type Rarity } from '../catalog/species'
import { petThumb } from '../catalog/thumb3d'
import { voxelMaterial } from '../pets/voxel/build'
import { partMatrices, petModel, petScale } from '../pets/voxel/runtime'
import { HUNGRY_AT, hungerLabel, hungerOf } from '../pets/hunger'
import type { FurnitureType, PetDetail, Post, SpaceDetail } from '../types'
import { api } from '../api'
import { cityShareUrl, copyText, mediaGradient, playSoundPlaceholder, relativeTime } from '../util'
import { FURNITURE_META } from '../indoor/Furniture'
import { floorLabel, floorList, floorsOf, unitBuilding, unitsOf } from '../data/units'

export const TEMPLATE_LABELS: Record<string, string> = {
  home: '个人小屋',
  gallery: '作品展厅',
  music: '音乐空间',
  collection: '收藏室',
  studio: '工作室',
  shop: '店铺展示间',
}

const TEMPLATE_OPTIONS = Object.keys(TEMPLATE_LABELS)
const WALL_COLORS = ['#f1ece3', '#e8ddcd', '#dfe4dd', '#d9d3c6', '#c9d0cb', '#c7b7a3', '#b9c2c6', '#d7c1ae']
const FLOOR_COLORS = ['#c9b79f', '#b99a78', '#b7b2a6', '#8f8b82', '#a9a08d', '#cbbd9e', '#7e7a70', '#d6c9b4']
const FURNITURE_COLORS = ['#8c9a92', '#6f7f74', '#b48c65', '#9a7d5d', '#c9a15c', '#587a58', '#7f6a86', '#3f4543', '#d8cfbf', '#b06b4f']
const ART_OPTIONS = [
  { id: 'dawn', label: '晨雾' },
  { id: 'coast', label: '海岸' },
  { id: 'meadow', label: '草坡' },
  { id: 'signal', label: '信标' },
  { id: 'night', label: '夜航' },
  { id: 'clay', label: '陶土' },
]
const IMAGE_OPTIONS = ['dawn', 'coast', 'meadow', 'signal', 'night', 'clay']
const AUDIO_OPTIONS = [
  { id: 'rain', label: '雨棚上的雨' },
  { id: 'night', label: '夜里的空调外机' },
  { id: 'street', label: '主街车流' },
  { id: 'hum', label: '咖啡机低鸣' },
]

function ShareButton({ params, label = '分享' }: { params: { space?: string; place?: string; enter?: string }; label?: string }) {
  const showToast = useApp((state) => state.showToast)
  return (
    <button
      className="mini-btn"
      onClick={async () => {
        const url = cityShareUrl(params)
        const ok = await copyText(url)
        showToast(ok ? '分享链接已复制。' : `复制失败：${url}`)
      }}
    >
      ↗ {label}
    </button>
  )
}

type PanelGlyphName = 'place' | 'space' | 'elevator' | 'favorites' | 'about' | 'edit'

/** 面板共用的细线图标，避免每个页面各画一套粗细不一的符号 */
function PanelGlyph({ name }: { name: PanelGlyphName }) {
  const paths: Record<PanelGlyphName, ReactNode> = {
    place: (
      <>
        <path d="M12 20.8s6.3-5.9 6.3-10.7a6.3 6.3 0 1 0-12.6 0C5.7 14.9 12 20.8 12 20.8Z" />
        <circle cx="12" cy="10" r="2.4" />
      </>
    ),
    space: (
      <>
        <path d="M4.2 10.6 12 4.2l7.8 6.4v9.1a1 1 0 0 1-1 1h-4.5v-6H9.7v6H5.2a1 1 0 0 1-1-1Z" />
      </>
    ),
    elevator: (
      <>
        <rect x="5" y="3.8" width="14" height="16.4" rx="3" />
        <path d="m9.5 8.7 2.5-2.5 2.5 2.5M9.5 15.3l2.5 2.5 2.5-2.5" />
      </>
    ),
    favorites: (
      <>
        <path d="m12 4 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8Z" />
      </>
    ),
    about: (
      <>
        <circle cx="12" cy="12" r="8.2" />
        <path d="M12 11.2v5.2M12 7.8v.2" />
      </>
    ),
    edit: (
      <>
        <path d="m4.6 19.4 4.1-1 9.3-9.3a2 2 0 0 0-2.8-2.8L5.9 15.6Z" />
        <path d="m13.9 7.6 2.8 2.8" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function Modal({
  label,
  title,
  subtitle,
  onClose,
  children,
  wide,
  icon,
}: {
  label: string
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  icon?: PanelGlyphName
}) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])
  return (
    <div
      className="panel-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className={`panel ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <header className="panel-head">
          {icon && (
            <span className={`panel-glyph ${icon}`} aria-hidden="true">
              <PanelGlyph name={icon} />
            </span>
          )}
          <div className="panel-head-copy">
            <p className="panel-label">{label}</p>
            <h2>{title}</h2>
            {subtitle && <p className="panel-sub">{subtitle}</p>}
          </div>
          <button className="close-btn" onClick={onClose} aria-label="关闭">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>
        <div className="panel-body">{children}</div>
      </section>
    </div>
  )
}

function PostComposer({
  targetType,
  targetId,
  targetName,
  compact,
  parentId,
  onDone,
}: {
  targetType: 'place' | 'space' | 'pet'
  targetId: string
  targetName: string
  compact?: boolean
  parentId?: string | null
  onDone?: () => void
}) {
  const sendMessage = useApp((state) => state.sendMessage)
  const [body, setBody] = useState('')
  const [mediaKind, setMediaKind] = useState<'none' | 'image' | 'audio'>('none')
  const [mediaRef, setMediaRef] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const limit = 240

  const submit = async () => {
    if (!body.trim() || busy) return
    setBusy(true)
    const ok = await sendMessage({
      targetType,
      targetId,
      body: body.trim(),
      parentId: parentId || null,
      mediaKind,
      mediaRef: mediaKind === 'none' ? null : mediaRef,
    })
    setBusy(false)
    if (ok) {
      setBody('')
      setMediaKind('none')
      setMediaRef(null)
      onDone?.()
    }
  }

  return (
    <div className={`composer ${compact ? 'compact' : ''}`}>
      <textarea
        value={body}
        maxLength={limit}
        rows={compact ? 2 : 3}
        placeholder={
          parentId
            ? '回复一句…'
            : targetType === 'place'
              ? `在「${targetName}」留下一条公开留言…`
              : targetType === 'space'
                ? `给「${targetName}」的访客留句话…`
                : `给「${targetName}」留句话…`
        }
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void submit()
        }}
      />
      <div className="composer-bar">
        <div className="media-toggles">
          <button
            className={mediaKind === 'image' ? 'on' : ''}
            onClick={() => {
              setMediaKind(mediaKind === 'image' ? 'none' : 'image')
              setMediaRef(mediaKind === 'image' ? null : 'dawn')
            }}
            title="附带一张程序化图像"
          >
            ▧ 图片
          </button>
          <button
            className={mediaKind === 'audio' ? 'on' : ''}
            onClick={() => {
              setMediaKind(mediaKind === 'audio' ? 'none' : 'audio')
              setMediaRef(mediaKind === 'audio' ? null : 'rain')
            }}
            title="附带一段声音占位"
          >
            ◉ 声音
          </button>
          <span className="char-count">
            {body.length}/{limit}
          </span>
        </div>
        <button className="primary-btn small" disabled={!body.trim() || busy} onClick={() => void submit()}>
          {busy ? '发送中…' : parentId ? '发送回复' : '留下留言'}
        </button>
      </div>
      {mediaKind === 'image' && (
        <div className="media-picker">
          <span>选择图像</span>
          {IMAGE_OPTIONS.map((key) => (
            <button
              key={key}
              className={`swatch art ${mediaRef === key ? 'selected' : ''}`}
              style={{ background: mediaGradient(`palette:${key}`) }}
              onClick={() => setMediaRef(key)}
              title={key}
            />
          ))}
        </div>
      )}
      {mediaKind === 'audio' && (
        <div className="media-picker">
          <span>选择声音</span>
          {AUDIO_OPTIONS.map((item) => (
            <button
              key={item.id}
              className={`text-chip ${mediaRef === item.id ? 'selected' : ''}`}
              onClick={() => setMediaRef(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PostItem({
  post,
  targetType,
  targetId,
  targetName,
  replies,
}: {
  post: Post
  targetType: 'place' | 'space' | 'pet'
  targetId: string
  targetName: string
  replies: Post[]
}) {
  const user = useApp((state) => state.user)
  const deletePost = useApp((state) => state.deletePost)
  const reportPost = useApp((state) => state.reportPost)
  const reportedIds = useApp((state) => state.reportedIds)
  const showToast = useApp((state) => state.showToast)
  const [replyOpen, setReplyOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const mine = user?.id === post.authorId

  return (
    <article className={`post ${mine ? 'mine' : ''}`}>
      <div className="post-author">
        <span className="avatar" style={{ background: post.author.color }}>
          {post.author.name.slice(0, 1)}
        </span>
        <div>
          <b>
            {post.author.name}
            {mine && <i className="you">我</i>}
          </b>
          <em>{relativeTime(post.createdAt)}</em>
        </div>
        <span className="post-kind">{post.kind === 'system' ? '系统' : '访客'}</span>
      </div>
      <p className="post-body">{post.body}</p>

      {post.mediaKind === 'image' && (
        <div className="post-art" style={{ background: mediaGradient(`palette:${post.mediaRef || 'dawn'}`) }}>
          <span>IMAGE · {post.mediaRef || 'dawn'}</span>
        </div>
      )}
      {post.mediaKind === 'audio' && (
        <button
          className={`post-audio ${playing ? 'playing' : ''}`}
          onClick={() => {
            const ok = playSoundPlaceholder(post.mediaRef)
            if (!ok) showToast('当前浏览器无法播放声音占位。')
            setPlaying(true)
            setTimeout(() => setPlaying(false), 3200)
          }}
        >
          <i>{playing ? '❚❚' : '▶'}</i>
          <span className="wave">
            {Array.from({ length: 22 }).map((_, index) => (
              <b key={index} style={{ height: `${20 + ((index * 37) % 70)}%` }} />
            ))}
          </span>
          <em>{AUDIO_OPTIONS.find((item) => item.id === post.mediaRef)?.label || '声音占位'} · 00:18</em>
        </button>
      )}

      <div className="post-actions">
        <button onClick={() => setReplyOpen((value) => !value)}>
          ↩ 回复{replies.length > 0 ? ` ${replies.length}` : ''}
        </button>
        <button
          disabled={reportedIds.includes(post.id)}
          onClick={() => {
            if (window.confirm('确认举报这条内容？累计 3 次举报会自动隐藏。')) void reportPost(post.id)
          }}
        >
          {reportedIds.includes(post.id) ? '已举报' : '⚑ 举报'}
        </button>
        {mine && (
          <button
            className="danger"
            onClick={() => {
              if (window.confirm('删除这条留言？此操作不可撤销。')) void deletePost(post.id)
            }}
          >
            删除
          </button>
        )}
      </div>

      {replies.length > 0 && (
        <div className="replies">
          {replies.map((reply) => (
            <div key={reply.id} className="reply">
              <span className="avatar tiny" style={{ background: reply.author.color }}>
                {reply.author.name.slice(0, 1)}
              </span>
              <div>
                <b>{reply.author.name}</b>
                <p>{reply.body}</p>
                <em>{relativeTime(reply.createdAt)}</em>
              </div>
              {user?.id === reply.authorId && (
                <button className="reply-delete" onClick={() => void deletePost(reply.id)}>
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {replyOpen && (
        <PostComposer
          targetType={targetType}
          targetId={targetId}
          targetName={targetName}
          compact
          parentId={post.id}
          onDone={() => setReplyOpen(false)}
        />
      )}
    </article>
  )
}

function PostList({
  posts,
  targetType,
  targetId,
  targetName,
}: {
  posts: Post[]
  targetType: 'place' | 'space' | 'pet'
  targetId: string
  targetName: string
}) {
  const roots = posts.filter((post) => !post.parentId)
  const repliesFor = (id: string) => posts.filter((post) => post.parentId === id)
  return (
    <div className="post-list">
      {roots.length === 0 && <p className="empty-note">还没有留言。做第一个留下字句的人。</p>}
      {roots.map((post) => (
        <PostItem
          key={post.id}
          post={post}
          targetType={targetType}
          targetId={targetId}
          targetName={targetName}
          replies={repliesFor(post.id)}
        />
      ))}
    </div>
  )
}

function PlacePanel({ id }: { id: string }) {
  const detail = useApp((state) => state.placeDetail)
  const loading = useApp((state) => state.loadingPanel)
  const error = useApp((state) => state.panelError)
  const closePanel = useApp((state) => state.closePanel)
  const toggleFavorite = useApp((state) => state.toggleFavorite)
  const enterTarget = useApp((state) => state.enterTarget)

  const place = detail?.place.id === id ? detail.place : null
  if (!place && loading) {
    return (
      <Modal label="地点" title="正在读取地点…" onClose={closePanel} icon="place">
        <div className="loading-block">
          <span className="spinner" />
          正在把这座城市的留言取回来
        </div>
      </Modal>
    )
  }
  if (!place) {
    return (
      <Modal label="地点" title="地点暂时无法打开" onClose={closePanel} icon="place">
        <p className="error-note">{error || '地点不存在或已被移除。'}</p>
      </Modal>
    )
  }

  const interiorMap: Record<string, 'gallery' | 'cafe'> = {
    'gallery-lobby': 'gallery',
    'corner-cafe': 'cafe',
  }
  const enter = interiorMap[place.id]

  return (
    <Modal label="地点留言板" title={place.name} subtitle={place.description} onClose={closePanel} wide icon="place">
      <div className="detail-strip">
        <div className="detail-meta">
          <span className="pill">{place.subtitle}</span>
          <span className="pill soft">{place.postCount} 条留言</span>
          <span className="pill soft">收藏 {detail?.favorite.count ?? 0}</span>
        </div>
        <div className="detail-strip-actions">
          <button
            className={`mini-btn ${detail?.favorite.favorited ? 'on' : ''}`}
            onClick={() => void toggleFavorite('place', place.id)}
          >
            {detail?.favorite.favorited ? '★ 已收藏' : '☆ 收藏'}
          </button>
          <ShareButton params={{ place: place.id }} label="分享地点" />
          {enter && (
            <button className="mini-btn accent" onClick={() => enterTarget({ kind: 'public', id: enter }, place.name)}>
              ↗ 进入室内
            </button>
          )}
        </div>
      </div>

      <section className="panel-section">
        <div className="section-head">
          <h3>留言</h3>
          <span>{detail?.posts.length ?? 0}</span>
        </div>
        <PostComposer targetType="place" targetId={place.id} targetName={place.name} />
        <PostList
          posts={detail?.posts || []}
          targetType="place"
          targetId={place.id}
          targetName={place.name}
        />
      </section>
    </Modal>
  )
}

function SpacePanel({ id }: { id: string }) {
  const detail = useApp((state) => state.spaceDetail)
  const loading = useApp((state) => state.loadingPanel)
  const error = useApp((state) => state.panelError)
  const user = useApp((state) => state.user)
  const world = useApp((state) => state.world)
  const closePanel = useApp((state) => state.closePanel)
  const toggleFavorite = useApp((state) => state.toggleFavorite)
  const claimSpace = useApp((state) => state.claimSpace)
  const releaseSpace = useApp((state) => state.releaseSpace)
  const startEditing = useApp((state) => state.startEditing)
  const enterTarget = useApp((state) => state.enterTarget)

  const space: SpaceDetail['space'] | null = detail?.space.id === id ? detail.space : null
  const claimedElsewhere = world?.userClaimedSpaceId && world.userClaimedSpaceId !== id
  const otherSpaceName = world?.spaces.find((item) => item.id === world.userClaimedSpaceId)?.name

  if (!space && loading) {
    return (
      <Modal label="个人空间" title="正在开门…" onClose={closePanel} icon="space">
        <div className="loading-block">
          <span className="spinner" />
          正在读取房间布置与访客印记
        </div>
      </Modal>
    )
  }
  if (!space) {
    return (
      <Modal label="个人空间" title="空间暂时无法打开" onClose={closePanel} icon="space">
        <p className="error-note">{error || '空间不存在或已被移除。'}</p>
      </Modal>
    )
  }

  const isOwner = Boolean(user && space.ownerId === user.id)
  const unclaimed = !space.ownerId

  return (
    <Modal
      label="个人空间"
      title={space.name}
      subtitle={space.description}
      onClose={closePanel}
      wide
      icon="space"
    >
      <div className="detail-strip">
        <div className="detail-meta">
          <span className="pill">{TEMPLATE_LABELS[space.template] || space.template}</span>
          <span className="pill soft">{space.postCount} 条留言</span>
          <span className="pill soft">{space.visitCount} 次访问</span>
          <span className="pill soft">{space.layout.items.length} 件陈设</span>
        </div>
        <div className="detail-strip-actions">
          <button
            className={`mini-btn ${detail?.favorite.favorited ? 'on' : ''}`}
            onClick={() => void toggleFavorite('space', space.id)}
          >
            {detail?.favorite.favorited ? '★ 已收藏' : '☆ 收藏'}
          </button>
          <ShareButton params={{ space: space.id }} label="分享房间" />
          <button className="mini-btn accent" onClick={() => enterTarget({ kind: 'space', id: space.id }, space.name)}>
            ↗ 进入房间
          </button>
        </div>
      </div>

      <div className="space-grid">
        <div className="space-card">
          <span className="card-label">房间主人</span>
          {space.owner ? (
            <div className="owner-row">
              <span className="avatar" style={{ background: space.owner.color }}>
                {space.owner.name.slice(0, 1)}
              </span>
              <div>
                <b>{space.owner.name}</b>
                <em>{isOwner ? '这是你的空间' : '可留言，留下访问印记'}</em>
              </div>
            </div>
          ) : (
            <div className="owner-row">
              <span className="avatar empty">◇</span>
              <div>
                <b>尚未认领</b>
                <em>当前为样板陈设，家具与颜色由系统预置</em>
              </div>
            </div>
          )}
          {unclaimed && (
            <div className="claim-box">
              <p>认领后可以改名、换墙面与地面、摆放最多 16 件家具，并挂一幅画。</p>
              <button
                className="primary-btn small"
                disabled={Boolean(claimedElsewhere)}
                onClick={() => {
                  if (window.confirm('确认认领这间空间？每位访客同时只能拥有一间。')) void claimSpace(space.id)
                }}
              >
                {claimedElsewhere ? `你已认领「${otherSpaceName || '另一间'}」` : '认领这间空间'}
              </button>
              {claimedElsewhere && <em className="hint-line">先放弃当前空间，才能认领这里。</em>}
            </div>
          )}
          {isOwner && (
            <div className="owner-actions">
              <button className="primary-btn small" onClick={startEditing}>
                ✎ 布置房间
              </button>
              <button
                className="mini-btn danger"
                onClick={() => {
                  if (window.confirm('确认放弃这间空间？布置会保留，但其他人可以接手。')) void releaseSpace(space.id)
                }}
              >
                放弃空间
              </button>
            </div>
          )}
          {!isOwner && space.owner && (
            <p className="hint-line">这里已经有主人了。你仍然可以进入参观、收藏、留言和留下访问印记。</p>
          )}
        </div>

        <div className="space-card">
          <span className="card-label">布置摘要</span>
          <div className="swatch-row">
            <span>
              墙面 <i style={{ background: space.wallColor }} />
            </span>
            <span>
              地面 <i style={{ background: space.floorColor }} />
            </span>
            <span>
              画作 <b>{space.art.title}</b>
            </span>
          </div>
          <div className="furniture-chips">
            {space.layout.items.length === 0 && <em className="hint-line">这间房还没有摆家具。</em>}
            {space.layout.items.map((item) => (
              <span key={item.id} title={FURNITURE_META[item.type]?.label}>
                {FURNITURE_META[item.type]?.label || item.type}
              </span>
            ))}
          </div>
          <div className="visits">
            <span className="card-label">最近访问</span>
            {detail?.visits.length ? (
              <div className="visit-row">
                {detail.visits.slice(0, 7).map((visit, index) => (
                  <span
                    key={visit.id}
                    className="visit-dot"
                    title={`${visit.user?.name || '某位访客'} · ${relativeTime(visit.createdAt)}`}
                    style={{ background: visit.user?.color || '#9a958a', zIndex: 10 - index }}
                  >
                    {visit.user?.name.slice(0, 1) || '·'}
                  </span>
                ))}
                <em>{detail.visits.length} 次印记</em>
              </div>
            ) : (
              <em className="hint-line">
                {isOwner ? '还没有访客留下印记。' : '你的到访会被记入主人的房间日志。'}
              </em>
            )}
          </div>
        </div>
      </div>

      <section className="panel-section">
        <div className="section-head">
          <h3>留言</h3>
          <span>{detail?.posts.length ?? 0}</span>
        </div>
        <PostComposer targetType="space" targetId={space.id} targetName={space.name} />
        <PostList
          posts={detail?.posts || []}
          targetType="space"
          targetId={space.id}
          targetName={space.name}
        />
      </section>
    </Modal>
  )
}

function EditorPanel() {
  const editor = useApp((state) => state.editor)
  const spaceDetail = useApp((state) => state.spaceDetail)
  const patch = useApp((state) => state.editorPatch)
  const cancel = useApp((state) => state.cancelEditing)
  const save = useApp((state) => state.saveEditor)
  const add = useApp((state) => state.paletteAdd)
  const placing = useApp((state) => state.placingType)
  const selectedId = useApp((state) => state.selectedFurnitureId)
  const select = useApp((state) => state.selectFurniture)
  const remove = useApp((state) => state.removeSelected)
  const rotate = useApp((state) => state.rotateSelected)
  const color = useApp((state) => state.colorSelected)
  const brush = useApp((state) => state.brushColor)
  const loading = useApp((state) => state.loadingPanel)
  const [tab, setTab] = useState<'room' | 'furniture'>('room')

  if (!editor || !spaceDetail) return null
  const selected = editor.layout.items.find((item) => item.id === selectedId) || null
  const addFurniture = (type: FurnitureType) => {
    add(type)
    setTab('furniture')
  }

  return (
    <div className="editor-shell">
      <aside className="editor-dock">
        <header className="editor-head">
          <span className="panel-glyph edit" aria-hidden="true">
            <PanelGlyph name="edit" />
          </span>
          <div className="editor-head-copy">
            <p className="panel-label">布置模式</p>
            <h2>{editor.name || '未命名空间'}</h2>
            <em>{spaceDetail.space.id} · 保存后访客立即可见</em>
          </div>
          <button className="close-btn" onClick={cancel} title="退出布置">
            ×
          </button>
        </header>

        <div className="editor-tabs">
          <button className={tab === 'room' ? 'on' : ''} onClick={() => setTab('room')}>
            房间与画作
          </button>
          <button className={tab === 'furniture' ? 'on' : ''} onClick={() => setTab('furniture')}>
            家具 {editor.layout.items.length}/16
          </button>
        </div>

        <div className="editor-scroll">
          {tab === 'room' && (
            <>
              <label className="field">
                <span>房间名称</span>
                <input
                  value={editor.name}
                  maxLength={24}
                  onChange={(event) => patch({ name: event.target.value })}
                />
              </label>
              <label className="field">
                <span>简介</span>
                <textarea
                  value={editor.description}
                  maxLength={120}
                  rows={2}
                  onChange={(event) => patch({ description: event.target.value })}
                />
              </label>
              <label className="field">
                <span>用途模板</span>
                <select value={editor.template} onChange={(event) => patch({ template: event.target.value })}>
                  {TEMPLATE_OPTIONS.map((key) => (
                    <option key={key} value={key}>
                      {TEMPLATE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field">
                <span>墙面颜色</span>
                <div className="swatch-row wrap">
                  {WALL_COLORS.map((value) => (
                    <button
                      key={value}
                      className={`swatch ${editor.wallColor === value ? 'selected' : ''}`}
                      style={{ background: value }}
                      onClick={() => patch({ wallColor: value })}
                      title={value}
                    />
                  ))}
                </div>
              </div>
              <div className="field">
                <span>地面颜色</span>
                <div className="swatch-row wrap">
                  {FLOOR_COLORS.map((value) => (
                    <button
                      key={value}
                      className={`swatch ${editor.floorColor === value ? 'selected' : ''}`}
                      style={{ background: value }}
                      onClick={() => patch({ floorColor: value })}
                      title={value}
                    />
                  ))}
                </div>
              </div>

              <div className="field">
                <span>墙上画作</span>
                <div className="swatch-row wrap">
                  {ART_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      className={`art-choice ${editor.art.palette === option.id ? 'selected' : ''}`}
                      style={{ background: mediaGradient(`palette:${option.id}`) }}
                      onClick={() => patch({ art: { ...editor.art, palette: option.id } })}
                      title={option.label}
                    >
                      <em>{option.label}</em>
                    </button>
                  ))}
                </div>
                <input
                  className="inline-input"
                  value={editor.art.title}
                  maxLength={30}
                  onChange={(event) => patch({ art: { ...editor.art, title: event.target.value } })}
                  placeholder="画作标题"
                />
              </div>

              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={editor.isOpen}
                  onChange={(event) => patch({ isOpen: event.target.checked })}
                />
                <span>开放给访客（关闭后链接仍可见，但会显示为暂未开放）</span>
              </label>
            </>
          )}

          {tab === 'furniture' && (
            <>
              <p className="editor-note">
                {placing
                  ? `正在放置「${FURNITURE_META[placing].label}」：点击房间地面放下。`
                  : selected
                    ? '已选中家具：点击地面移动，使用下方按钮旋转、换色或删除。'
                    : '从底部选择家具；选中后点击地面移动。最多 16 件。'}
              </p>
              <div className="placed-list">
                {editor.layout.items.length === 0 && <em className="hint-line">还没有家具，从底部挑一件开始。</em>}
                {editor.layout.items.map((item) => (
                  <button
                    key={item.id}
                    className={`placed-item ${selectedId === item.id ? 'on' : ''}`}
                    onClick={() => select(item.id)}
                  >
                    <i style={{ background: item.color }} />
                    {FURNITURE_META[item.type]?.label || item.type}
                    <em>
                      {item.x.toFixed(1)}, {item.z.toFixed(1)}
                    </em>
                  </button>
                ))}
              </div>
              {selected && (
                <div className="selection-tools">
                  <span className="card-label">选中：{FURNITURE_META[selected.type]?.label}</span>
                  <div className="tool-row">
                    <button onClick={() => rotate(-Math.PI / 4)}>↺ 左转 45°</button>
                    <button onClick={() => rotate(Math.PI / 4)}>↻ 右转 45°</button>
                    <button className="danger" onClick={remove}>
                      删除
                    </button>
                  </div>
                  <div className="swatch-row wrap">
                    {FURNITURE_COLORS.map((value) => (
                      <button
                        key={value}
                        className={`swatch small ${selected.color === value ? 'selected' : ''}`}
                        style={{ background: value }}
                        onClick={() => color(value)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="editor-footer">
          <span className="brush-note">
            当前颜色 <i style={{ background: brush }} />
          </span>
          <button className="mini-btn" onClick={cancel}>
            取消
          </button>
          <button
            className="primary-btn small"
            disabled={loading || !editor.name.trim()}
            onClick={() => void save()}
          >
            {loading ? '保存中…' : '保存并开放'}
          </button>
        </footer>
      </aside>

      <div className="palette-dock">
        {(Object.keys(FURNITURE_META) as FurnitureType[]).map((type) => (
          <button
            key={type}
            className={`palette-item ${placing === type ? 'on' : ''}`}
            onClick={() => addFurniture(type)}
            title={`放置${FURNITURE_META[type].label}`}
          >
            <span>{FURNITURE_META[type].glyph}</span>
            {FURNITURE_META[type].label}
          </button>
        ))}
      </div>
    </div>
  )
}

function FavoritesPanel() {
  const favorites = useApp((state) => state.favorites)
  const loading = useApp((state) => state.loadingPanel)
  const error = useApp((state) => state.panelError)
  const closePanel = useApp((state) => state.closePanel)
  const openPlace = useApp((state) => state.openPlace)
  const openSpace = useApp((state) => state.openSpace)
  const openPanel = useApp((state) => state.openPanel)

  return (
    <Modal label="我的收藏" title="留着以后再去" onClose={closePanel} icon="favorites">
      {loading && (
        <div className="loading-block">
          <span className="spinner" />
          读取中
        </div>
      )}
      {!loading && error && <p className="error-note">{error}</p>}
      {!loading && !error && favorites.length === 0 && (
        <div className="panel-empty">
          <span className="panel-empty-icon" aria-hidden="true">
            <PanelGlyph name="favorites" />
          </span>
          <b>还没有收藏</b>
          <p>在地点、空间或宠物主页里点一下 ☆，就会收进这里。</p>
        </div>
      )}
      {!loading && !error && favorites.length > 0 && (
        <>
          <div className="favorite-summary">
            <span className="card-label">已收藏</span>
            <em>{favorites.length} 个</em>
          </div>
          <div className="favorite-list">
            {favorites.map((favorite) => {
              // 宠物可能还没起名：名字回落到品种中文名，由客户端查表。
              const name =
                favorite.targetType === 'pet'
                  ? favorite.name ||
                    (favorite.speciesId && favorite.breedId
                      ? breedOf(favorite.speciesId, favorite.breedId).name
                      : '一只宠物')
                  : favorite.name || '已失效的地点'
              const label =
                favorite.targetType === 'place' ? '地点' : favorite.targetType === 'space' ? '空间' : '宠物'
              return (
                <button
                  key={`${favorite.targetType}-${favorite.targetId}`}
                  className="favorite-row"
                  onClick={() => {
                    if (favorite.targetType === 'pet') openPanel({ type: 'pet', id: favorite.targetId })
                    else if (favorite.targetType === 'place') void openPlace(favorite.targetId)
                    else void openSpace(favorite.targetId)
                  }}
                >
                  <span className={`favorite-icon ${favorite.targetType}`}>
                    <PanelGlyph name={favorite.targetType === 'space' ? 'space' : 'place'} />
                  </span>
                  <b>{name}</b>
                  <em>{label}</em>
                  <i aria-hidden="true">›</i>
                </button>
              )
            })}
          </div>
        </>
      )}
    </Modal>
  )
}

function AboutPanel() {
  const user = useApp((state) => state.user)
  const closePanel = useApp((state) => state.closePanel)
  const renameSelf = useApp((state) => state.renameSelf)
  const showToast = useApp((state) => state.showToast)
  const [name, setName] = useState(user?.name || '')
  const [copied, setCopied] = useState(false)

  return (
    <Modal
      label="关于"
      title="微光城区"
      subtitle="isocity 的第三入口 · 一座可以走进去的小城"
      onClose={closePanel}
      wide
      icon="about"
    >
      <div className="about-grid">
        <section className="about-card about-hero">
          <div className="about-hero-row">
            <span className="avatar xl" style={{ background: user?.color || '#9a958a' }}>
              {user?.name.slice(0, 1)}
            </span>
            <div className="about-hero-copy">
              <span className="card-label">访客身份</span>
              <b>{user?.name}</b>
              <em>{user?.id}</em>
            </div>
            <span className="about-badge">本地访客</span>
          </div>
          <label className="field about-rename">
            <span>修改昵称</span>
            <div className="inline-form">
              <input
                value={name}
                maxLength={18}
                onChange={(event) => setName(event.target.value)}
                placeholder="起一个名字"
              />
              <button
                className="mini-btn accent"
                disabled={!name.trim() || name.trim() === user?.name}
                onClick={() => void renameSelf(name.trim())}
              >
                保存
              </button>
            </div>
          </label>
          <p className="hint-line">进入城市时自动签发访客凭据，不需要注册；留言、认领与房间保存以服务端身份为准。</p>
        </section>

        <section className="about-card">
          <h3>操作</h3>
          <dl className="control-grid">
            <div>
              <dt><kbd>WASD</kbd></dt>
              <dd>移动</dd>
            </div>
            <div>
              <dt><kbd>Shift</kbd></dt>
              <dd>奔跑 / 加速飞行</dd>
            </div>
            <div>
              <dt><kbd>F</kbd></dt>
              <dd>起飞或降落</dd>
            </div>
            <div>
              <dt><kbd>空格</kbd> <kbd>C</kbd></dt>
              <dd>跳跃；飞行时上升 / 下降</dd>
            </div>
            <div>
              <dt><kbd>V</kbd></dt>
              <dd>城市总览</dd>
            </div>
            <div>
              <dt><kbd>L</kbd></dt>
              <dd>切换昼夜</dd>
            </div>
            <div>
              <dt><kbd>E</kbd></dt>
              <dd>与最近的地点或入口互动</dd>
            </div>
            <div>
              <dt><kbd>Esc</kbd></dt>
              <dd>释放鼠标 / 关闭面板</dd>
            </div>
          </dl>
          <p className="hint-line">飞行不消耗体力。方向跟随视角：视线朝下时，按 W 会向下飞。</p>
        </section>

        <section className="about-card">
          <h3>内容与治理</h3>
          <ul className="about-list">
            <li>留言带有服务端作者身份、地点关联与时间。</li>
            <li>累计 3 次举报自动隐藏，自己的留言可随时删除。</li>
            <li>收藏是轻量互动；访问房间只记录一次访客印记。</li>
          </ul>
          <div className="about-actions">
            <button
              className="mini-btn"
              onClick={async () => {
                const ok = await copyText(cityShareUrl())
                setCopied(ok)
                showToast(ok ? '首页链接已复制。' : '复制失败，请手动复制浏览器地址。')
              }}
            >
              {copied ? '✓ 已复制' : '分享城市'}
            </button>
            <a className="mini-btn" href="./index.html">
              返回 isocity
            </a>
          </div>
        </section>

      </div>
    </Modal>
  )
}

function ElevatorPanel({ id }: { id: string }) {
  const building = unitBuilding(id)
  const current = useApp((state) => state.buildingFloor)
  const setFloor = useApp((state) => state.setBuildingFloor)
  const closePanel = useApp((state) => state.closePanel)
  const exitCity = useApp((state) => state.exitCity)

  if (!building) return null
  const floors = floorList(building) as number[]

  return (
    <Modal
      label={`${building.name} · 电梯`}
      title="选择楼层"
      subtitle={`共 ${floorsOf(building)} 层 · 每层 ${unitsOf(building)} 户`}
      onClose={closePanel}
      wide
      icon="elevator"
    >
      <div className="elevator-hero">
        <div>
          <span className="card-label">当前停留</span>
          <b>{floorLabel(current)}</b>
          <em>{current === 1 ? '大堂层' : current < 0 ? '地下层' : '住宅层'}</em>
        </div>
        <span className="elevator-badge">{floors.length} 层可选</span>
      </div>
      <div className="elevator-grid">
        {floors.map((floor) => (
          <button
            key={floor}
            className={`elevator-floor ${floor === current ? 'on' : ''}`}
            onClick={() => setFloor(floor)}
          >
            <b>{floorLabel(floor)}</b>
            <span>{floor === 1 ? '大堂' : floor < 0 ? '地下' : '住宅'}</span>
          </button>
        ))}
      </div>
      <div className="elevator-foot">
        <span className="empty-note">每层 {unitsOf(building)} 户 · 共 {floorsOf(building)} 层</span>
        <button className="mini-btn" onClick={exitCity}>
          ← 返回街道
        </button>
      </div>
    </Modal>
  )
}

/**
 * 缩略图是 3D 离屏渲染出来的，一张要一两次 draw。30 个品种一次全渲会在打开
 * 面板的瞬间顿一下，所以按帧切片：每帧最多 10ms，先出图先显示。
 */
const RARITY_COLOR: Record<Rarity, string> = {
  common: '#8ea0b5',
  uncommon: '#7fd1a8',
  rare: '#f2c86b',
  epic: '#b79bf0',
  legendary: '#f28e6b',
}

/** 图鉴里的星数：直接看品种自己的稀有度，同一个物种里的不同品种会不一样 */
const starsOf = (breed: Breed) => '★'.repeat(RARITY_STARS[breed.rarity])
const hourText = (perHour: number) =>
  perHour >= 1 ? `每小时约 ${perHour.toFixed(1)} 只` : `约 ${(1 / perHour).toFixed(1)} 小时 1 只`

function useCatalogThumbs() {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const list = useMemo(
    () => SPECIES.flatMap((species) => species.breeds.map((breed) => ({ species: species.id, breed: breed.id }))),
    [],
  )

  useEffect(() => {
    let cancelled = false
    let cursor = 0

    const step = () => {
      if (cancelled) return
      const started = performance.now()
      const batch: Record<string, string> = {}
      while (cursor < list.length && performance.now() - started < 10) {
        const item = list[cursor++]
        try {
          const url = petThumb(item.species, item.breed)
          if (url) batch[`${item.species}/${item.breed}`] = url
        } catch {
          /* 拿不到 WebGL 上下文时退回纯色块，不挡住图鉴本身 */
        }
      }
      if (Object.keys(batch).length) setUrls((prev) => ({ ...prev, ...batch }))
      if (cursor < list.length) requestAnimationFrame(step)
    }

    step()
    return () => {
      cancelled = true
    }
  }, [list])

  return urls
}

function CatalogPanel() {
  const closePanel = useApp((state) => state.closePanel)
  const seen = useApp((state) => state.seenPets)
  const thumbs = useCatalogThumbs()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const seenSet = useMemo(() => new Set(seen), [seen])
  const total = useMemo(() => SPECIES.reduce((sum, species) => sum + species.breeds.length, 0), [])
  const found = useMemo(
    () => SPECIES.reduce((sum, species) => sum + species.breeds.filter((b) => seen.includes(`${species.id}/${b.id}`)).length, 0),
    [seen],
  )
  const selected = useMemo(() => {
    if (!selectedKey) return null
    for (const species of SPECIES) {
      const breed = catalogBreedsOf(species).find((item) => catalogKeyOf(species.id, item.id) === selectedKey)
      if (breed) return { species, breed }
    }
    return null
  }, [selectedKey])

  const rarityColor = selected ? RARITY_COLOR[selected.breed.rarity] : ''

  return (
    <Modal
      label="图鉴"
      title="宠物图鉴"
      subtitle={`已记录 ${found} / ${total} · 在街上走近野生宠物按 E 观察`}
      onClose={closePanel}
      wide
    >
      {selected && (
        <section
          className="about-card"
          style={{ marginBottom: 20, borderColor: `${rarityColor}55` }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div
              style={{
                width: 96,
                height: 96,
                flex: '0 0 auto',
                borderRadius: 12,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.045)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {thumbs[selectedKey!] ? (
                <img
                  src={thumbs[selectedKey!]}
                  alt={selected.breed.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ width: '54%', height: '54%', borderRadius: '50%', background: selected.breed.swatch }} />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <span className="card-label">{selected.species.name} · {selected.breed.name}</span>
              <h3 style={{ margin: '4px 0 6px' }}>{selected.breed.name}</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
                <span style={{ color: rarityColor }}>
                  {RARITY_LABEL[selected.breed.rarity]} {starsOf(selected.breed)}
                </span>
                <span style={{ color: '#8ea0b5' }}>{hourText(selected.breed.perHour)}</span>
                <span style={{ color: '#8ea0b5' }}>出现时间：全天</span>
              </div>
            </div>
          </div>
          <p className="hint-line" style={{ margin: '12px 0 0' }}>{selected.species.description}</p>
          <p className="hint-line" style={{ margin: '6px 0 0' }}>
            {seenSet.has(selectedKey!) ? '你已经在城市里见过它。' : '还没有在城市里遇见它。'}
          </p>
        </section>
      )}
      {SPECIES.map((species) => {
        const speciesFound = species.breeds.filter((b) => seenSet.has(`${species.id}/${b.id}`)).length
        return (
          <section key={species.id} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <b style={{ fontSize: 13, letterSpacing: 0.6 }}>
                {species.name}
                {species.kind === 'wild' ? ' · 野生' : ''}
                <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 400, color: RARITY_COLOR[species.rarity] }}>
                  {RARITY_LABEL[species.rarity]}
                </span>
              </b>
              <span style={{ fontSize: 11, color: '#8ea0b5' }}>
                {speciesFound} / {species.breeds.length}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
                gap: 8,
              }}
            >
              {species.breeds.map((breed) => {
                const key = `${species.id}/${breed.id}`
                const known = seenSet.has(key)
                const url = thumbs[key]
                return (
                  <figure
                    key={breed.id}
                    style={{ margin: 0, cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                    aria-label={`查看${breed.name}详情`}
                    onClick={() => setSelectedKey(key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedKey(key)
                      }
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: '1 / 1',
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.045)',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={known ? breed.name : ''}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            // 没记录过的只降低饱和度：保留剪影和名称，鼓励玩家去城市里寻找。
                            filter: known ? 'none' : 'saturate(0.45) brightness(0.78)',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            width: '54%',
                            height: '54%',
                            borderRadius: '50%',
                            background: known ? breed.swatch : 'rgba(255,255,255,0.12)',
                          }}
                        />
                      )}
                    </div>
                    <figcaption
                      style={{
                        marginTop: 4,
                        fontSize: 10.5,
                        lineHeight: 1.4,
                        textAlign: 'center',
                        color: known ? '#e8eef5' : '#5c6b7c',
                      }}
                    >
                      {breed.name}
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          </section>
        )
      })}
    </Modal>
  )
}

function CatalogPetScene({
  model,
  matrices,
  scale,
  playing,
  material,
}: {
  model: ReturnType<typeof petModel>
  matrices: THREE.Matrix4[]
  scale: number
  playing: boolean
  material: THREE.MeshStandardMaterial
}) {
  const group = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!group.current) return
    partMatrices(model, playing ? 'idle' : null, playing ? state.clock.elapsedTime : 0, matrices)
    group.current.children.forEach((child, index) => {
      child.matrix.copy(matrices[index])
    })
  })

  return (
    <group ref={group} scale={[scale, scale, scale]} position={[0, -0.42, 0]}>
      {model.parts.map((part, index) => (
        <mesh
          key={part.name}
          geometry={part.geometry}
          material={material}
          matrix={matrices[index]}
          matrixAutoUpdate={false}
          castShadow
        />
      ))}
    </group>
  )
}

function CatalogPetViewer({ speciesId, breedId }: { speciesId: string; breedId: string }) {
  const model = useMemo(() => petModel(speciesId, breedId), [speciesId, breedId])
  const matrices = useMemo(() => partMatrices(model, null, 0, []), [model])
  const [playing, setPlaying] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [color, setColor] = useState('#ffffff')
  const material = useMemo(() => voxelMaterial().clone(), [])
  const scale = petScale(speciesId, model) * 1.42
  const colors = ['#ffffff', '#f2b36d', '#d98f76', '#9ba9bd', '#8c7c72', '#5b5964', '#d8c58f']

  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    material.color.set(color)
  }, [color, material])

  return (
    <div className="catalog-viewer">
      <div className="catalog-viewer-tools">
        <button className="catalog-motion-toggle" onClick={() => setPlaying((value) => !value)}>
          {playing ? '静止' : '动作'}
        </button>
        <button className="catalog-motion-toggle" onClick={() => setColorOpen((value) => !value)}>
          颜色
        </button>
        {colorOpen && (
          <div className="catalog-color-popover">
            <span>选择外观颜色</span>
            <div>
              {colors.map((value) => (
                <button
                  key={value}
                  className={color === value ? 'selected' : ''}
                  style={{ background: value }}
                  aria-label={`选择颜色 ${value}`}
                  onClick={() => {
                    setColor(value)
                    setColorOpen(false)
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <Canvas camera={{ position: [2.5, 1.7, 3.1], fov: 38 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#182126']} />
        <ambientLight intensity={1.8} />
        <directionalLight position={[2, 4, 3]} intensity={3.2} color="#fff2dc" />
        <directionalLight position={[-3, 2, 1]} intensity={1.1} color="#bcd8ff" />
        <CatalogPetScene model={model} matrices={matrices} scale={scale} playing={playing} material={material} />
        <OrbitControls enablePan={false} minDistance={1.5} maxDistance={4.5} target={[0, 0.15, 0]} />
      </Canvas>
      <span className="catalog-viewer-hint">拖动查看 · 滚轮缩放</span>
    </div>
  )
}

function CatalogPanelV2() {
  const closePanel = useApp((state) => state.closePanel)
  const seen = useApp((state) => state.seenPets)
  const adopted = useApp((state) => state.pets)
  const openPanel = useApp((state) => state.openPanel)
  const thumbs = useCatalogThumbs()
  const first = catalogKeyOf(SPECIES[0].id, catalogBreedsOf(SPECIES[0])[0].id)
  const [selectedKey, setSelectedKey] = useState(first)
  const seenSet = useMemo(() => new Set(seen), [seen])
  const selected = useMemo(() => {
    for (const species of SPECIES) {
      const breed = catalogBreedsOf(species).find((item) => catalogKeyOf(species.id, item.id) === selectedKey)
      if (breed) return { species, breed }
    }
    return null
  }, [selectedKey])
  const total = SPECIES.reduce((sum, species) => sum + catalogBreedsOf(species).length, 0)
  const found = SPECIES.reduce(
    (sum, species) => sum + catalogBreedsOf(species).filter((b) => seenSet.has(catalogKeyOf(species.id, b.id))).length,
    0,
  )

  if (!selected) return null
  const rarityColor = RARITY_COLOR[selected.breed.rarity]

  return (
    <Modal
      label="图鉴"
      title="宠物图鉴"
      subtitle={`已记录 ${found} / ${total} · 点击左侧品种查看详情`}
      onClose={closePanel}
      wide
    >
      {adopted.length > 0 && (
        <section className="catalog-owned">
          <span className="card-label">我的宠物</span>
          <div className="catalog-owned-row">
            {adopted.map((pet) => (
              <button
                key={pet.id}
                className="catalog-owned-item"
                onClick={() => openPanel({ type: 'pet', id: pet.id })}
              >
                <span className="avatar" style={{ background: pet.owner.color }}>
                  {(pet.nickname || breedOf(pet.speciesId, pet.breedId).name).slice(0, 1)}
                </span>
                <span>
                  <b>{pet.nickname || breedOf(pet.speciesId, pet.breedId).name}</b>
                  <em>{breedOf(pet.speciesId, pet.breedId).name} · 主页与留言</em>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="catalog-layout">
        <aside className="catalog-list">
          {SPECIES.map((species) => (
            <section key={species.id}>
              <div className="catalog-list-head">
                <b>{species.name}</b>
              </div>
              {catalogBreedsOf(species).map((breed) => {
                const key = catalogKeyOf(species.id, breed.id)
                const thumbKey = `${species.id}/${breed.id}`
                const known = seenSet.has(key)
                return (
                  <button
                    key={key}
                    className={`catalog-list-item ${key === selectedKey ? 'selected' : ''}`}
                    onClick={() => setSelectedKey(key)}
                  >
                    <span
                      className="catalog-list-thumb"
                      style={{ backgroundImage: thumbs[thumbKey] ? `url(${thumbs[thumbKey]})` : undefined }}
                    >
                      {!thumbs[thumbKey] && <i style={{ background: known ? breed.swatch : 'rgba(255,255,255,0.12)' }} />}
                    </span>
                    <span>
                      <b>{breed.name}</b>
                      <em className="catalog-item-rarity">
                        <span style={{ color: RARITY_COLOR[breed.rarity] }}>{starsOf(breed)}</span>
                      </em>
                      <em>{known ? '已发现' : '未发现'}</em>
                    </span>
                  </button>
                )
              })}
            </section>
          ))}
        </aside>

        <section className="catalog-detail">
          <CatalogPetViewer
            key={selectedKey}
            speciesId={selected.species.id}
            breedId={selected.breed.id}
          />
          <div className="catalog-detail-copy">
            <div className="catalog-detail-title">
              <div>
                <span className="card-label">{selected.species.name} · {selected.species.kind === 'wild' ? '野生' : '宠物'}</span>
                <h3>
                  {selected.breed.name}{' '}
                  <strong style={{ color: rarityColor }}>{starsOf(selected.breed)}</strong>
                </h3>
              </div>
            </div>
            <p>{selected.breed.description}</p>
            <div className="catalog-facts">
              <span><b>稀有度</b>{RARITY_LABEL[selected.breed.rarity]}</span>
              <span><b>出现频率</b>{hourText(selected.breed.perHour)}</span>
              <span><b>出现时间</b>全天</span>
            </div>
            <p className="hint-line">
              {seenSet.has(selectedKey) ? '你已经在城市里见过它。' : '还没有在城市里遇见它，去街上找找看吧。'}
            </p>
          </div>
        </section>
      </div>
    </Modal>
  )
}

function PetPanel({ id }: { id: string }) {
  const closePanel = useApp((state) => state.closePanel)
  const toggleFavorite = useApp((state) => state.toggleFavorite)
  const [detail, setDetail] = useState<PetDetail | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    void api
      .petDetail(id)
      .then(setDetail)
      .catch((reason) => setError(reason instanceof Error ? reason.message : '宠物信息暂时无法打开'))
  }

  useEffect(() => {
    load()
  }, [id])

  if (!detail) {
    return (
      <Modal label="宠物留言" title={error || '正在打开宠物主页…'} onClose={closePanel}>
        {error ? <p className="empty-note">请稍后再试。</p> : <div className="loading-block"><span className="spinner" />正在读取留言</div>}
      </Modal>
    )
  }

  const pet = detail.pet
  const breed = breedOf(pet.speciesId, pet.breedId)
  const title = pet.nickname || breed.name
  // 饱腹度由「最后一次吃饱的时间」推导，不进数据库也不需要轮询。
  const hunger = hungerOf(pet, Date.now())
  const hungry = hunger < HUNGRY_AT
  return (
    <Modal label="宠物主页" title={title} subtitle={`${breed.name} · 主人 @${pet.owner.name}`} onClose={closePanel} wide>
      <div className="pet-profile">
        <span className="avatar" style={{ background: pet.owner.color }}>{pet.owner.name.slice(0, 1)}</span>
        <div>
          <b>@{pet.owner.name}</b>
          <p>{relativeTime(pet.adoptedAt)}领养 · 给它留一句话，主人回来时会看到。</p>
        </div>
        <span className={`pet-hunger${hungry ? ' is-hungry' : ''}`} title={`饱腹度 ${Math.round(hunger)}%`}>
          <i style={{ width: `${Math.max(3, Math.round(hunger))}%` }} />
          <em>{hungerLabel(hunger)}</em>
        </span>
      </div>
      <div className="detail-strip">
        <div className="detail-meta">
          <span className="pill soft">{detail.favorite.count} 人收藏</span>
          <span className="pill soft">{detail.notes.length} 条留言</span>
        </div>
        <div className="detail-strip-actions">
          <button
            className={`mini-btn ${detail.favorite.favorited ? 'on' : ''}`}
            onClick={() => {
              void toggleFavorite('pet', pet.id).then((result) => {
                if (result) setDetail((prev) => (prev ? { ...prev, favorite: result } : prev))
              })
            }}
          >
            {detail.favorite.favorited ? '★ 已收藏' : '☆ 收藏'}
          </button>
        </div>
      </div>
      <PostComposer
        targetType="pet"
        targetId={pet.id}
        targetName={title}
        onDone={load}
      />
      <PostList posts={detail.notes} targetType="pet" targetId={pet.id} targetName={title} />
    </Modal>
  )
}

export function Panels() {
  const panel = useApp((state) => state.panel)
  const closePanel = useApp((state) => state.closePanel)
  if (!panel) return null
  if (panel.type === 'place') return <PlacePanel id={panel.id} />
  if (panel.type === 'pet') return <PetPanel id={panel.id} />
  if (panel.type === 'space') return <SpacePanel id={panel.id} />
  if (panel.type === 'elevator') return <ElevatorPanel id={panel.id} />
  if (panel.type === 'favorites') return <FavoritesPanel />
  if (panel.type === 'catalog') return <CatalogPanelV2 />
  if (panel.type === 'about') return <AboutPanel />
  if (panel.type === 'editor') return <EditorPanel />
  return (
    <Modal label="微光城区" title="没有找到这个面板" onClose={closePanel}>
      <p className="empty-note">可能链接已经失效。</p>
    </Modal>
  )
}
