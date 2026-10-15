import type { Artist, Gender, Temper } from '../game/types'
import { avatarUrl, bustUrl, resolveFaceId, type FaceId } from '../game/portraits'
export { hashStr } from '../game/util'

export interface FaceSeed {
  seed: string
  gender?: Gender
  temper?: Temper
  color?: string
  color2?: string
  faceId?: string | FaceId
}

/** 圆形小头像（列表用） */
export function AvatarFace({ seed, size = 44, ring, off }: { seed: FaceSeed; size?: number; ring?: boolean; off?: boolean }) {
  const id = resolveFaceId(seed)
  return (
    <div className={`av-wrap ${ring ? 'ring' : ''} ${off ? 'off' : ''}`} style={{ width: size, height: size }}>
      <img className="av-img" src={avatarUrl(id)} alt="" draggable={false} />
    </div>
  )
}

export function ArtistAvatar({ a, size = 44, ring }: { a: Artist; size?: number; ring?: boolean }) {
  const id = resolveFaceId({ seed: a.id + a.name, gender: a.gender, temper: a.temper, faceId: a.faceId })
  return (
    <div className={`av-wrap ${ring ? 'ring' : ''} ${a.status !== 'ok' ? 'off' : ''}`} style={{ width: size, height: size }}>
      <img className="av-img" src={avatarUrl(id)} alt="" draggable={false} />
      {a.rank >= 4 && <span className="av-crown">{a.rank === 5 ? '👑' : '⭐'}</span>}
    </div>
  )
}

/** 对话半身立绘 */
export function PortraitHero({ seed }: { seed: FaceSeed; mood?: string }) {
  const id = resolveFaceId(seed)
  return (
    <div className="hero-portrait">
      <img className="hero-img" src={bustUrl(id)} alt="" draggable={false} />
    </div>
  )
}

/** 详情页半身特写 */
export function PortraitBust({ seed, className }: { seed: FaceSeed; className?: string }) {
  const id = resolveFaceId(seed)
  return <img className={`bust-img ${className ?? ''}`} src={bustUrl(id)} alt="" draggable={false} />
}

export function seedFromArtist(a: Artist): FaceSeed {
  return { seed: a.id + a.name, gender: a.gender, temper: a.temper, faceId: a.faceId }
}
