import { useApp } from '../store'

export function Intro() {
  const booted = useApp((state) => state.booted)
  const booting = useApp((state) => state.booting)
  const bootError = useApp((state) => state.bootError)
  const world = useApp((state) => state.world)
  const startExploring = useApp((state) => state.startExploring)
  const boot = useApp((state) => state.boot)
  const openPanel = useApp((state) => state.openPanel)

  return (
    <div className="intro">
      <div className="intro-scrim" aria-hidden="true" />

      <header className="intro-top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">isocity</span>
        </div>
        <button className="intro-link" onClick={() => openPanel({ type: 'about' })}>
          关于与操作
        </button>
      </header>

      <main className="intro-hero">
        <span className="intro-eyebrow">
          <i aria-hidden="true" />
          微光城区 · 第三入口
        </span>

        <h1>
          会发光的
          <br />
          城市。
        </h1>

        <p className="intro-lede">
          雨后的夜间街区。三条大道、镜池广场、回声巷，以及五处可以走进去的空间。
          留言、认领一间房、挂上自己的画，再把门牌分享出去。
        </p>

        <div className="intro-actions">
          <button className="intro-primary" disabled={!booted || booting} onClick={startExploring}>
            {booted ? '进入城市' : booting ? '正在点亮城市…' : '城市还没有醒来'}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </button>
          {bootError ? (
            <button className="intro-ghost" onClick={() => void boot()}>
              重试连接
            </button>
          ) : null}
        </div>

        {bootError && <p className="intro-error">{bootError}</p>}

        <dl className="intro-stats">
          <div>
            <dt>位访客</dt>
            <dd>{world?.stats.citizens ?? '—'}</dd>
          </div>
          <div>
            <dt>间空间</dt>
            <dd>{world?.stats.spaces ?? '—'}</dd>
          </div>
          <div>
            <dt>已认领</dt>
            <dd>{world?.stats.claimed ?? '—'}</dd>
          </div>
          <div>
            <dt>条留言</dt>
            <dd>{world?.stats.messages ?? '—'}</dd>
          </div>
        </dl>
      </main>

      <footer className="intro-footer">
        <span>无需注册 · 自动签发访客身份</span>
        <span className="intro-footer-sep" aria-hidden="true" />
        <span>WASD 行走 · F 起飞 · V 总览</span>
      </footer>
    </div>
  )
}
