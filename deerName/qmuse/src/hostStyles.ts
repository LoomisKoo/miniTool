const ACCENT = '#c9785c';
const INK = '#4c392f';
const SURFACE = '#fffcf5';
const LINE = '#ebd8c6';
const GRAD =
  'linear-gradient(135deg, #e6a07f 0%, #c9785c 48%, #d6a85f 100%)';

function resetChrome(el: HTMLButtonElement): void {
  el.style.setProperty('-webkit-appearance', 'none', 'important');
  el.style.setProperty('appearance', 'none', 'important');
  el.style.setProperty('box-shadow', 'none', 'important');
}

function styleButton(el: HTMLButtonElement): void {
  resetChrome(el);

  if (el.classList.contains('primary-btn')) {
    el.style.setProperty('background', GRAD, 'important');
    el.style.setProperty('color', '#fff', 'important');
    el.style.setProperty('border', '0', 'important');
    return;
  }

  if (el.classList.contains('pill') && el.classList.contains('primary')) {
    el.style.setProperty('background', GRAD, 'important');
    el.style.setProperty('color', '#fff', 'important');
    el.style.setProperty('border-color', 'transparent', 'important');
    return;
  }

  if (
    el.classList.contains('chip') ||
    el.classList.contains('option') ||
    el.classList.contains('pill')
  ) {
    if (el.classList.contains('on') || el.classList.contains('primary')) {
      el.style.setProperty('background', GRAD, 'important');
      el.style.setProperty('color', '#fff', 'important');
      el.style.setProperty('border-color', 'transparent', 'important');
    } else {
      el.style.setProperty('background-color', SURFACE, 'important');
      el.style.setProperty('color', INK, 'important');
      el.style.setProperty('border-color', LINE, 'important');
    }
    return;
  }

  if (el.classList.contains('tab') && el.classList.contains('on')) {
    el.style.setProperty('color', ACCENT, 'important');
  }
}

export function applyQmuseHostStyles(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>('button').forEach(styleButton);
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
