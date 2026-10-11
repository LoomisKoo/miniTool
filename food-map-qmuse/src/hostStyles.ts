const ACCENT = '#ff7a1a';
const TEXT3 = 'rgba(245, 245, 247, .32)';
const ACCENT_BG = 'rgba(255, 122, 26, .14)';

function resetChrome(el: HTMLButtonElement): void {
  el.style.setProperty('-webkit-appearance', 'none', 'important');
  el.style.setProperty('appearance', 'none', 'important');
  el.style.setProperty('border', '0', 'important');
  el.style.setProperty('box-shadow', 'none', 'important');
}

/** 妙思宿主会给 button 白字/白底，收藏心形选中态须压回主题橙 */
function styleButton(el: HTMLButtonElement): void {
  if (!el.classList.contains('fav-heart')) return;
  resetChrome(el);

  if (el.classList.contains('fav-toggle') || el.classList.contains('pick-chip')) {
    if (el.classList.contains('on')) {
      el.style.setProperty('background-color', ACCENT_BG, 'important');
      el.style.setProperty('color', ACCENT, 'important');
    } else {
      el.style.setProperty('background-color', 'transparent', 'important');
      el.style.setProperty('color', TEXT3, 'important');
    }
    return;
  }

  el.style.setProperty('background-color', 'transparent', 'important');
  if (el.classList.contains('on')) {
    el.style.setProperty('color', ACCENT, 'important');
  } else {
    el.style.setProperty('color', TEXT3, 'important');
  }
}

export function applyQmuseHostStyles(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>('button.fav-heart').forEach(styleButton);
}

export function watchQmuseHostStyles(root: HTMLElement): () => void {
  applyQmuseHostStyles(root);
  let timer = 0;
  const observer = new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => applyQmuseHostStyles(root), 0);
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  });
  return () => {
    window.clearTimeout(timer);
    observer.disconnect();
  };
}
