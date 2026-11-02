/**
 * Chrome 61 没有 ResizeObserver（64 才有）。容器里一 new 就抛错 → 整页黑屏。
 * 有原生就用原生；没有就退回 window.resize + 初次测量。
 *
 * 用默认导出：具名导出在打包成 IIFE 时，两个使用方会被 rollup 拆成
 * `observeSize` / `observeSize$1` 两份副本，压缩后声明被删掉只留调用，
 * 运行时报 `observeSize is not defined`（上传照片开裁剪弹层时才走到）。
 */
export default function observeSize(el: Element, onSize: () => void): () => void {
  onSize()
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(onSize)
    ro.observe(el)
    return () => ro.disconnect()
  }
  window.addEventListener('resize', onSize)
  return () => window.removeEventListener('resize', onSize)
}
