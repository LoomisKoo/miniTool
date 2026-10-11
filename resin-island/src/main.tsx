import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

// 不用 StrictMode：R3F 场景 / 高度场模拟不应被双执行初始化
createRoot(container).render(<App />)
