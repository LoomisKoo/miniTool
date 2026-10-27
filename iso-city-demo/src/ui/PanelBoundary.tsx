// 面板的兜底：面板里任何一个渲染异常都不该把整座城市变成黑屏。
//
// React 18 在渲染阶段抛错时会卸载整棵树，而这个应用的画布也挂在同一棵
// 树上——所以一个 undefined 字段（比如服务端还没重启、少返回一个属性）
// 就会连城市一起消失，只剩一片黑。这里把面板单独圈出来。
//
// 只在 UI 层用：场景里每帧都在跑的东西不适合用「回退到上一次 DOM」的方式兜。

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  /** 变了就重置错误状态：换一个面板应该重新尝试渲染 */
  resetKey: string
  /** 关掉面板用的回调，回退界面上的按钮会用到 */
  onClose: () => void
  children: ReactNode
}

type State = { error: Error | null }

export class PanelBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 开发时留一条完整堆栈；生产里用户看到的是下面的回退卡片。
    console.error('[panel] 渲染失败', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="panel-crash" role="alert">
        <b>这个面板没能打开</b>
        <p>{this.state.error.message || '未知错误'}</p>
        <button className="primary-btn small" onClick={this.props.onClose}>
          关闭面板
        </button>
      </div>
    )
  }
}
