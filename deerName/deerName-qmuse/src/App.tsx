import { useEffect, useRef } from 'react';
import { BODY_HTML } from './body';
import { LEGACY_SCRIPTS } from './legacy-scripts';
import { applyQmuseHostStyles, watchQmuseHostStyles } from './hostStyles';

declare global {
  interface Window {
    __deername_loaded?: boolean;
    NM?: unknown;
  }
}

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
    document.documentElement.classList.add('deername-qmuse');
    if (window.__deername_loaded) return;
    const host = hostRef.current;
    if (!host) return;
    window.__deername_loaded = true;

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
        console.warn('[deerName] 加载失败:', rel);
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

  return <div className="deername-shell" ref={hostRef} />;
}
