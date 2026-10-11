import { useEffect, useRef } from 'react';
import { BODY_HTML } from './body';
import { SAMPLE_SCREEN_DATA_URL } from './sampleScreenDataUrl';
import { applyQmuseHostStyles, watchQmuseHostStyles } from './hostStyles';

declare global {
  interface Window {
    __cinema_seat_loaded?: boolean;
    __CINEMA_SAMPLE_URL__?: string;
    THREE?: unknown;
  }
}

const LEGACY_SCRIPTS = ['legacy/three.min.js', 'legacy/app.js'] as const;

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
    document.documentElement.classList.add('cinema-seat-qmuse');
    if (window.__cinema_seat_loaded) return;
    const host = hostRef.current;
    if (!host) return;
    window.__cinema_seat_loaded = true;
    window.__CINEMA_SAMPLE_URL__ = SAMPLE_SCREEN_DATA_URL;

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
        console.warn('[cinema-seat] 加载失败:', rel);
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
