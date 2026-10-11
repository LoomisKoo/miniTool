import { useElapsed, useFps } from '../hooks/useFps'
import { useQuality } from '../hooks/useQuality'

/** 产品页式 HUD 覆盖层（纯 DOM，不参与 3D） */
export default function Hud() {
  const fps = useFps()
  const elapsed = useElapsed()
  const { level } = useQuality()

  return (
    <div className="hud">
      <div className="hud-brand">
        <span className="mark" />
        RESIN ISLAND
      </div>

      <div className="hud-nav">
        <span>An interactive little escape</span>
        <span className="about">About this world</span>
      </div>

      <div className="hud-hero">
        <div className="eyebrow">· NATURE, IN MINIATURE</div>
        <h1>
          A world
          <br />
          within water.
        </h1>
        <p>一块树脂，一弯沙滩，一片会呼吸的青绿海水。移动指针，让整座岛轻轻晃起来。</p>
      </div>

      <div className="hud-timer">
        <span className="dot" />
        {elapsed}
      </div>

      <div className="hud-hint">拖动 / 移动指针探索</div>

      <div className="hud-meter">
        <div>
          TIDE SIMULATION · <b>{fps} FPS</b>
        </div>
        <div>
          QUALITY · <b>{level.toUpperCase()}</b>
        </div>
      </div>
    </div>
  )
}
