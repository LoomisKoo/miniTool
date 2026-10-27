import { useEffect, useState } from 'react'
import { CityScene } from './scene/CityScene'
import { InteriorScene } from './indoor/Interiors'
import { useApp } from './store'
import { useGameInput } from './game/input'
import { Hud } from './ui/Hud'
import { Panels } from './ui/Panels'
import { PanelBoundary } from './ui/PanelBoundary'
import { Dialog } from './ui/Dialog'
import { Intro } from './ui/Intro'
import { Toast } from './ui/Toast'
import { music } from './audio/music'

export default function App() {
  const screen = useApp((state) => state.screen)
  const booted = useApp((state) => state.booted)
  // 换一个面板就重置兜底层：同一个面板反复失败也仍然能看到回退卡片。
  const panel = useApp((state) => state.panel)
  const panelKey = panel ? `${panel.type}:${'id' in panel ? panel.id : ''}` : 'none'
  const musicOn = useApp((state) => state.musicOn)
  const night = useApp((state) => state.night)
  const boot = useApp((state) => state.boot)
  // 城市和内景都常驻：切换只改可见性和帧循环，不卸载 Canvas。
  // 以前进一次楼要重建室内整套几何与材质，出来再重建一遍整座城，
  // 每次切换都会掉一大截帧。
  const inCity = screen !== 'interior'
  useGameInput()

  // 先让欢迎页画出来，再建 WebGL 上下文。
  //
  // Canvas 的首帧要建上下文、编译 28 个着色器程序、上传 91 张贴图，实测
  // 700ms。以前它和欢迎页在同一个 commit 里挂载，这 700ms 就把首屏白屏
  // 一起挡住了。隔一帧（rAF 之后浏览器已经完成一次绘制）再挂，用户先看到
  // 欢迎页，那 700ms 卡在页面已经可见之后，观感上就只是"一次小停顿"。
  const [rendererReady, setRendererReady] = useState(false)
  useEffect(() => {
    if (screen !== 'intro') {
      setRendererReady(true)
      return
    }
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setRendererReady(true)))
    return () => cancelAnimationFrame(raf)
  }, [screen])

  useEffect(() => {
    if (!useApp.getState().booted) void boot()
  }, [boot])

  // BGM 跟着昼夜换一套和弦：夜间小调+暗，黄昏大调+亮。
  // start() 是幂等的，重复调用只会顺手 resume 一次被浏览器挂起的 AudioContext。
  useEffect(() => {
    if (screen === 'intro') return
    // 先记静音状态再 start：否则第一次创建 AudioContext 会先淡到满音量再压回 0。
    music.setMuted(!musicOn)
    music.start(night ? 'night' : 'dusk')
  }, [screen, night, musicOn])

  return (
    <div className={`app screen-${screen}`}>
      <div className={inCity ? 'scene-layer' : 'scene-layer scene-asleep'}>
        {rendererReady && <CityScene active={inCity} />}
      </div>
      <div className={inCity ? 'scene-layer scene-asleep' : 'scene-layer'}>
        <InteriorScene active={!inCity} />
      </div>
      <div className="vignette" />
      <div className="grain" />

      {screen === 'intro' && <Intro />}
      <Hud />
      {/* 面板与对话单独圈一层：它们最容易因为服务端少返回一个字段而抛错，
          而 React 一旦抛错会卸载整棵树，连画布一起变成黑屏。 */}
      <PanelBoundary resetKey={panelKey} onClose={() => useApp.getState().closePanel()}>
        <Panels />
        <Dialog />
      </PanelBoundary>
      <Toast />

      {!booted && screen !== 'intro' && (
        <div className="boot-mask">
          <span className="spinner" />
          正在连接城市服务…
        </div>
      )}
    </div>
  )
}
