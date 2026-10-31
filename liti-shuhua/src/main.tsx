/**
 * 立体书 → 小红书小工具入口
 * 经典脚本（iife）、Chrome 61 / ES2017 基线，见 vite.xhs.config.ts。
 */
import './polyfills'
import React from 'react'
import { createRoot } from 'react-dom/client'
import PopupApp from './PopupApp'
import './popup.css'
import './xhs-base.css'

/**
 * Chrome 61 基线没有 Flex 版 gap（只能识别 Grid gap），而 @supports / CSS.supports
 * 只验证语法、证明不了 Flex 布局真的生效，所以这里按规范做一次行为检测：
 * 两个纵向 div + row-gap:1px，正常应该把容器撑到 1px。检测失败挂 .no-flex-gap，
 * 由 index.html 里的 margin 基线接管间距。
 */
function detectFlexGap() {
  try {
    const flex = document.createElement('div')
    flex.style.cssText = 'position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px'
    flex.appendChild(document.createElement('div'))
    flex.appendChild(document.createElement('div'))
    document.body.appendChild(flex)
    const ok = flex.scrollHeight === 1
    if (flex.parentNode) flex.parentNode.removeChild(flex)
    if (!ok) document.documentElement.classList.add('no-flex-gap')
  } catch {
    document.documentElement.classList.add('no-flex-gap')
  }
}

detectFlexGap()

const root = document.getElementById('root')
if (root) {
  try {
    createRoot(root).render(React.createElement(PopupApp))
  } catch (err) {
    // 容器里没控制台时，至少别只剩一块黑：把错误写到页面上
    root.textContent = `立体书画启动失败：${err instanceof Error ? err.message : String(err)}`
    root.style.cssText = 'padding:24px;color:#fbeed2;font:14px/1.5 sans-serif;white-space:pre-wrap'
  }
}
