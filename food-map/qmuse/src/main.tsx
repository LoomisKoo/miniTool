import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// 不使用 React.StrictMode：旧版内联/外部脚本注入在 StrictMode 双执行下会重复初始化。
const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root not found');
}

createRoot(rootEl).render(<App />);
