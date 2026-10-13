import { useEffect, useRef } from 'react';
import { BODY_HTML } from './body';
import { applyQmuseHostStyles, watchQmuseHostStyles } from './hostStyles';

declare global {
  interface Window {
    __life_guide_loaded?: boolean;
  }
}

const LEGACY_SCRIPTS = ['legacy/app.js'] as const;

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

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add('life-guide-qmuse');
    if (window.__life_guide_loaded) return;
    const host = hostRef.current;
    if (!host) return;
    window.__life_guide_loaded = true;

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
        if (index >= LEGACY_SCRIPTS.length) {
          // #stack 内 .page 为 absolute：若 flex 高度链断了会整页空白
          const stack = document.getElementById('stack');
          const p0 = document.getElementById('p0');
          if (stack && p0 && !p0.innerHTML.trim()) {
            console.warn('[life-guide] 脚本已加载但首页未渲染');
          }
        }
        injectNext();
      };
      script.onerror = () => {
        console.warn('[life-guide] 加载失败:', rel, resolveLegacyUrl(rel));
        const p0 = document.getElementById('p0');
        if (p0) {
          p0.innerHTML =
            '<p class="empty">应用脚本加载失败，请下拉刷新重试</p>';
        }
        index += 1;
        injectNext();
      };
      setTimeout(() => {
        document.body.appendChild(script);
      }, 0);
    };

    injectNext();

    return () => {
      stopWatch();
    };
  }, []);

  return <div id="app" ref={hostRef} />;
}
