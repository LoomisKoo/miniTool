/**
 * 小红书 WebView 基线（Chrome 61）缺的能力，必须在业务代码之前补上。
 * 注意：Chrome 61 也没有 globalThis（71 才有），一律用 window。
 */
const w = window as Window & {
  process?: { env: Record<string, string> }
  ResizeObserver?: new (cb: ResizeObserverCallback) => ResizeObserver
}

// React 生产构建偶发残留 process.env 时不至于直接炸掉
w.process = w.process || { env: {} }
w.process.env = w.process.env || {}
if (!w.process.env.NODE_ENV) w.process.env.NODE_ENV = 'production'

// Chrome 61 无 ResizeObserver：空实现兜底；业务侧 observeSize 还会走 resize 回退
if (typeof w.ResizeObserver === 'undefined') {
  w.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// 容器里看不到控制台：首屏挂了就把错误写到页面上
w.addEventListener('error', (ev) => {
  const root = document.getElementById('root')
  if (!root || root.childElementCount > 0) return
  root.textContent = `立体书画运行错误：${ev.message || String(ev.error || '')}`
  root.setAttribute('style', 'padding:24px;color:#fbeed2;font:14px/1.5 sans-serif;white-space:pre-wrap')
})
