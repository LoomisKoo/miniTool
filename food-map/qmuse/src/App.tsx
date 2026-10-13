import { useEffect, useRef } from 'react';
import { BODY_HTML } from './body';
import { applyQmuseHostStyles, watchQmuseHostStyles } from './hostStyles';

declare global {
  interface Window {
    __foodmap_loaded?: boolean;
    LAND_DATA?: string;
    PROV_LAND_CELL?: number;
    PROV_LAND_LEFT?: number;
    PROV_LAND_TOP?: number;
    PROV_LAND_COLS?: number;
    PROV_LAND_ROWS?: number;
    PROV_LAND_DATA?: string;
    DATA?: unknown;
    L?: unknown;
  }
}

/**
 * 原项目运行所需的外部脚本（与原 index.html 底部 <script> 顺序一致）：
 * land.js -> prov-land.js -> data.js -> app.js
 * 它们通过全局变量通信：window.LAND_DATA / window.PROV_LAND_* / window.DATA。
 */
const LEGACY_SCRIPTS = [
  'legacy/land.js',
  'legacy/prov-land.js',
  'legacy/data.js',
  'legacy/app.js',
] as const;

/** QMuse 正式发布页在 render.*，静态资源在 renderstatic.*，须用注入的 publicPath */
function assetBase(): string {
  const w = window as Window & {
    __basement_public_path__?: string;
    publicPath?: string;
  };
  const injected = w.__basement_public_path__ || w.publicPath;
  if (injected) return injected;
  return document.baseURI;
}

function resolveLegacyUrl(rel: string): string {
  return new URL(rel, assetBase()).href;
}

function ensureToastElement(): void {
  if (document.getElementById('toast')) return;
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  document.body.appendChild(toast);
}

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add('food-map-qmuse');
    // 仅初始化一次：旧脚本共享全局作用域，重复注入会重复绑定事件与绘制循环。
    if (window.__foodmap_loaded) return;
    const host = hostRef.current;
    if (!host) return;
    window.__foodmap_loaded = true;
    ensureToastElement();

    // 先落原始静态结构，再按序注入脚本，避免脚本执行时取不到 DOM。
    host.innerHTML = BODY_HTML;
    applyQmuseHostStyles(host);
    const stopWatch = watchQmuseHostStyles(host);

    let index = 0;
    const injectNext = (): void => {
      if (index >= LEGACY_SCRIPTS.length) return;
      const rel = LEGACY_SCRIPTS[index];
      const script = document.createElement('script');
      script.src = resolveLegacyUrl(rel);
      script.async = false;
      script.onload = () => {
        index += 1;
        injectNext();
      };
      script.onerror = () => {
        console.warn('[food-map] 加载失败:', rel);
        index += 1;
        injectNext();
      };
      document.body.appendChild(script);
    };

    injectNext();

    return () => {
      stopWatch();
    };
  }, []);

  return <div id="app" ref={hostRef} />;
}
