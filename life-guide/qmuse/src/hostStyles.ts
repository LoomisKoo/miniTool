/**
 * 妙思宿主常把 button 刷成白底。策略：实心主题色 + 白字，禁止白底/描边；
 * 点击后异步覆盖时靠 observer / rAF / 短轮询再压回去。
 */
const PINK = '#f2729c';
const PINK_DEEP = '#de4f80';
const SKY = '#5aa9f0';
const MUTED = '#958aa0';
const STAR = '#ffb020';
const SOFT = '#3a3242'; // 深色模式下的次要底，避免白底

function reset(el: HTMLElement): void {
  el.style.setProperty('-webkit-appearance', 'none', 'important');
  el.style.setProperty('appearance', 'none', 'important');
  el.style.setProperty('box-shadow', 'none', 'important');
  el.style.setProperty('border', '0', 'important');
  el.style.setProperty('border-width', '0', 'important');
  el.style.setProperty('border-style', 'none', 'important');
  el.style.setProperty('border-color', 'transparent', 'important');
}

function fill(el: HTMLElement, bg: string, fg: string): void {
  reset(el);
  el.style.setProperty('background', bg, 'important');
  el.style.setProperty('background-color', bg, 'important');
  el.style.setProperty('color', fg, 'important');
  el.style.setProperty('-webkit-text-fill-color', fg, 'important');
}

function ghost(el: HTMLElement, fg: string): void {
  reset(el);
  el.style.setProperty('background', 'transparent', 'important');
  el.style.setProperty('background-color', 'transparent', 'important');
  el.style.setProperty('color', fg, 'important');
  el.style.setProperty('-webkit-text-fill-color', fg, 'important');
}

function styleButton(el: HTMLButtonElement): void {
  if (el.closest('.seg')) {
    if (el.classList.contains('on')) fill(el, PINK, '#ffffff');
    else ghost(el, MUTED);
    return;
  }

  if (el.closest('.tabbar')) {
    ghost(el, el.classList.contains('on') ? PINK : MUTED);
    return;
  }

  if (el.classList.contains('tab') && el.closest('.frow')) {
    if (el.classList.contains('on')) fill(el, PINK, '#ffffff');
    else fill(el, SOFT, MUTED);
    return;
  }

  if (el.classList.contains('act-share') || (el.classList.contains('done') && !el.classList.contains('ghost'))) {
    fill(el, PINK, '#ffffff');
    el.style.setProperty('font-weight', '700', 'important');
    return;
  }

  if (el.classList.contains('sheet-clear') || (el.classList.contains('done') && el.classList.contains('ghost'))) {
    fill(el, SOFT, MUTED);
    return;
  }

  if (el.classList.contains('act-src')) {
    fill(el, SKY, '#ffffff');
    return;
  }

  if (el.classList.contains('fbtn')) {
    if (el.classList.contains('on')) fill(el, PINK, '#ffffff');
    else fill(el, SOFT, MUTED);
    return;
  }

  if (el.classList.contains('star')) {
    ghost(el, el.classList.contains('on') ? STAR : MUTED);
    return;
  }

  if (el.classList.contains('heart')) {
    if (el.classList.contains('on')) fill(el, PINK_DEEP, '#ffffff');
    else fill(el, SOFT, PINK);
    return;
  }

  if (el.classList.contains('back') || el.classList.contains('tbback')) {
    fill(el, SOFT, PINK);
    return;
  }

  if (el.classList.contains('hero-rand')) {
    fill(el, SOFT, PINK);
    return;
  }

  if (el.classList.contains('banner') || el.classList.contains('cell') || el.classList.contains('row') || el.classList.contains('more') || el.classList.contains('srcrow') || el.classList.contains('refchip')) {
    reset(el);
    // 不强制白底；只清边框，颜色交给主题 CSS
    return;
  }

  // 未知按钮：至少别留白底
  reset(el);
  const bg = getComputedStyle(el).backgroundColor;
  if (isNearWhite(bg)) fill(el, SOFT, MUTED);
}

function isNearWhite(bg: string): boolean {
  const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return false;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.85;
}

function styleToast(): void {
  document.querySelectorAll<HTMLElement>('.toast').forEach((el) => fill(el, PINK, '#ffffff'));
}

function styleSearch(): void {
  const q = document.getElementById('q') as HTMLInputElement | null;
  if (!q) return;
  q.style.setProperty('color', '#f7f2fa', 'important');
  q.style.setProperty('-webkit-text-fill-color', '#f7f2fa', 'important');
  q.style.setProperty('caret-color', PINK, 'important');
}

export function applyQmuseHostStyles(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>('button').forEach(styleButton);
  document.querySelectorAll<HTMLButtonElement>('#sheet button, .sheet button').forEach(styleButton);
  styleToast();
  styleSearch();
}

export function watchQmuseHostStyles(root: HTMLElement): () => void {
  const run = () => applyQmuseHostStyles(root);
  run();
  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 0);
    requestAnimationFrame(() => requestAnimationFrame(run));
  };
  const observer = new MutationObserver(schedule);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  });
  const onPointer = () => schedule();
  document.addEventListener('click', onPointer, true);
  document.addEventListener('pointerup', onPointer, true);
  const interval = window.setInterval(run, 600);
  return () => {
    window.clearTimeout(timer);
    window.clearInterval(interval);
    observer.disconnect();
    document.removeEventListener('click', onPointer, true);
    document.removeEventListener('pointerup', onPointer, true);
  };
}
