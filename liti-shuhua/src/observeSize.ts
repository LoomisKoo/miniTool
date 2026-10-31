/**
 * Chrome 61 没有 ResizeObserver（64 才有）。容器里一 new 就抛错 → 整页黑屏。
 * 有原生就用原生；没有就退回 window.resize + 初次测量。
 */
export function observeSize(el: Element, onSize: () => void): () => void {
  onSize()
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(onSize)
    ro.observe(el)
    return () => ro.disconnect()
  }
  window.addEventListener('resize', onSize)
  return () => window.removeEventListener('resize', onSize)
}
