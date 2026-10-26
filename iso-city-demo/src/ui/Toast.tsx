import { useApp } from '../store'

export function Toast() {
  const toast = useApp((state) => state.toast)
  if (!toast) return null
  return (
    <div className="toast" role="status" key={toast}>
      <i />
      {toast}
    </div>
  )
}
