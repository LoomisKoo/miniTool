import { useEffect } from 'react'
import { CityScene } from './scene/CityScene'
import { InteriorScene } from './indoor/Interiors'
import { useApp } from './store'
import { useGameInput } from './game/input'
import { Hud } from './ui/Hud'
import { Panels } from './ui/Panels'
import { Intro } from './ui/Intro'
import { Toast } from './ui/Toast'

export default function App() {
  const screen = useApp((state) => state.screen)
  const booted = useApp((state) => state.booted)
  const interiorId = useApp((state) => state.interior?.id)
  const boot = useApp((state) => state.boot)
  useGameInput()

  useEffect(() => {
    if (!useApp.getState().booted) void boot()
  }, [boot])

  return (
    <div className={`app screen-${screen}`}>
      {(screen === 'city' || screen === 'intro') && <CityScene />}
      {screen === 'interior' && <InteriorScene key={interiorId} />}
      <div className="vignette" />
      <div className="grain" />

      {screen === 'intro' && <Intro />}
      <Hud />
      <Panels />
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
