const ACCENT = '#e0b478';
const ACCENT_INK = '#1a120a';
const MUTED = '#8a837c';
const INK = 'rgba(244, 239, 232, 0.9)';
const CHIP_BG = 'rgba(255, 255, 255, 0.09)';
const OPTION_BG = 'rgba(255, 255, 255, 0.04)';
const HALL_SELECTED_BG = 'rgba(224, 180, 120, 0.16)';

function resetChrome(el: HTMLButtonElement): void {
  el.style.setProperty('-webkit-appearance', 'none', 'important');
  el.style.setProperty('appearance', 'none', 'important');
  el.style.setProperty('border', '0', 'important');
  el.style.setProperty('box-shadow', 'none', 'important');
}

/** 妙思宿主会后注入 button 白底，用 !important 内联压过 */
function styleButton(el: HTMLButtonElement): void {
  resetChrome(el);

  if (el.classList.contains('primary-btn') || el.classList.contains('modal-confirm')) {
    el.style.setProperty('background-color', ACCENT, 'important');
    el.style.setProperty('color', ACCENT_INK, 'important');
    return;
  }

  if (el.classList.contains('vision-option') || el.classList.contains('vision-dialog-option')) {
    if (el.classList.contains('on')) {
      el.style.setProperty('background-color', ACCENT, 'important');
      el.style.setProperty('color', ACCENT_INK, 'important');
    } else {
      el.style.setProperty('background-color', OPTION_BG, 'important');
      el.style.setProperty('color', MUTED, 'important');
    }
    return;
  }

  if (el.classList.contains('crowd-switch')) {
    if (el.classList.contains('on')) {
      el.style.setProperty('background-color', ACCENT, 'important');
      el.style.setProperty('color', ACCENT_INK, 'important');
    } else {
      el.style.setProperty('background-color', OPTION_BG, 'important');
      el.style.setProperty('color', MUTED, 'important');
    }
    return;
  }

  if (el.classList.contains('hall-card')) {
    el.style.setProperty(
      'background-color',
      el.classList.contains('selected') ? HALL_SELECTED_BG : OPTION_BG,
      'important'
    );
    el.style.setProperty('color', INK, 'important');
    return;
  }

  if (el.classList.contains('ticket-row')) {
    el.style.setProperty('background-color', 'transparent', 'important');
    el.style.removeProperty('color');
    return;
  }

  if (el.classList.contains('map-seat')) {
    if (el.classList.contains('on')) {
      el.style.setProperty('background-color', ACCENT, 'important');
      el.style.setProperty('color', ACCENT_INK, 'important');
    } else {
      el.style.setProperty('background-color', '#2a2730', 'important');
      el.style.removeProperty('color');
    }
    return;
  }

  if (
    el.classList.contains('secondary-btn') ||
    el.classList.contains('text-btn') ||
    el.classList.contains('hall-select-btn') ||
    el.classList.contains('seat-chip') ||
    el.classList.contains('seat-select-btn')
  ) {
    el.style.setProperty('background-color', CHIP_BG, 'important');
    el.style.setProperty('color', INK, 'important');
    return;
  }

  if (
    el.classList.contains('icon-btn') ||
    el.classList.contains('icon-round') ||
    el.classList.contains('chrome-toggle-btn') ||
    el.classList.contains('modal-close')
  ) {
    if (el.classList.contains('light-btn') && el.classList.contains('on')) {
      el.style.setProperty('background-color', ACCENT, 'important');
      el.style.setProperty('color', INK, 'important');
      return;
    }
    if (el.id === 'crowdTheatreBtn' && el.classList.contains('on')) {
      el.style.setProperty('background-color', ACCENT, 'important');
      el.style.setProperty('color', INK, 'important');
      return;
    }
    el.style.setProperty('background-color', CHIP_BG, 'important');
    if (!el.classList.contains('modal-close')) {
      el.style.setProperty('color', INK, 'important');
    }
    return;
  }

  if (el.closest('.height-step') || el.closest('.seat-map-toolbar')) {
    el.style.setProperty('background-color', CHIP_BG, 'important');
    el.style.setProperty('color', INK, 'important');
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
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  return () => {
    window.clearTimeout(timer);
    observer.disconnect();
  };
}
