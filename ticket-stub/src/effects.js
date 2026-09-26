/**
 * 票根用户特效：目录、实例、挂载到 背景 / 照片 / 前景
 */
(function (global) {
  const LAYERS = [
    { id: 'bg', label: '背景' },
    { id: 'photo', label: '照片' },
    { id: 'top', label: '前景' },
  ];

  const TABS = [
    { id: 'texture', label: '纹理' },
    { id: 'pattern', label: '图案' },
    { id: 'stamp', label: '印章' },
    { id: 'text', label: '文字' },
    { id: 'light', label: '光效' },
  ];

  const FONTS = [
    { id: 'ticket', label: '票券', family: "'JetBrains Mono', ui-monospace, monospace" },
    { id: 'memo', label: '纪念', family: "'Instrument Serif', Georgia, serif" },
    { id: 'body', label: '正文', family: "'DM Sans', system-ui, sans-serif" },
    { id: 'news', label: '晚报', family: "Georgia, 'Times New Roman', serif" },
    { id: 'steel', label: '钢印', family: "Impact, 'Arial Black', sans-serif" },
  ];

  const BORDER_STYLES = [
    { id: 'solid', label: '实线' },
    { id: 'dashed', label: '虚线' },
    { id: 'double', label: '双线' },
  ];

  const BORDER_SHAPES = [
    { id: 'rect', label: '直角' },
    { id: 'round', label: '圆角' },
    { id: 'pill', label: '胶囊' },
  ];

  const GLITTER_SHAPES = [
    { id: 'dot', label: '细点' },
    { id: 'spark', label: '圆点' },
    { id: 'star', label: '星点' },
    { id: 'cross', label: '十字' },
    { id: 'diamond', label: '菱形' },
  ];

  const COLORS = [
    '#1a1612', '#5c4033', '#8b1a1a', '#a67c2a', '#2f5d50',
    '#1e3a5f', '#6b2d5c', '#f6f1e8', '#c4b5a0', '#e8c27a',
  ];

  /** @type {Array<object>} */
  const CATALOG = [
    // —— 纹理 ——
    { id: 'tex-paper', tab: 'texture', name: '纸纹', hint: '做旧', kind: 'fill', css: 'ufx-paper', defaultOpacity: 0.45, hasColor: true, defaultColor: '#5c4033', hasDensity: true },
    { id: 'tex-grain', tab: 'texture', name: '胶片颗粒', hint: '做旧', kind: 'fill', css: 'ufx-grain', defaultOpacity: 0.4, hasDensity: true },
    { id: 'tex-halftone', tab: 'texture', name: '网点', hint: '报刊', kind: 'fill', css: 'ufx-halftone', defaultOpacity: 0.35, hasColor: true, defaultColor: '#1a1612', hasDensity: true },
    { id: 'tex-linen', tab: 'texture', name: '亚麻', hint: '布纹', kind: 'fill', css: 'ufx-linen', defaultOpacity: 0.38, hasColor: true, defaultColor: '#6b5a48', hasDensity: true },
    { id: 'tex-diag', tab: 'texture', name: '斜纹', hint: '票券', kind: 'fill', css: 'ufx-diag', defaultOpacity: 0.28, hasColor: true, defaultColor: '#1a1612', hasDensity: true },
    { id: 'tex-noise', tab: 'texture', name: '噪点', hint: '做旧', kind: 'fill', css: 'ufx-noise', defaultOpacity: 0.32, hasDensity: true },

    // —— 图案 ——
    { id: 'pat-corners', tab: 'pattern', name: '角花', hint: '装饰', kind: 'fill', css: 'ufx-corners', defaultOpacity: 0.55, hasColor: true, defaultColor: '#a67c2a' },
    { id: 'pat-dash', tab: 'pattern', name: '虚线边', hint: '票券', kind: 'fill', css: 'ufx-dashborder', defaultOpacity: 0.5, hasColor: true, defaultColor: '#5c4033' },
    { id: 'pat-stars', tab: 'pattern', name: '星点', hint: '点缀', kind: 'fill', css: 'ufx-stars', defaultOpacity: 0.45, hasColor: true, defaultColor: '#e8c27a', hasDensity: true },
    { id: 'pat-grid', tab: 'pattern', name: '地图格', hint: '旅行', kind: 'fill', css: 'ufx-mapgrid', defaultOpacity: 0.3, hasColor: true, defaultColor: '#1e3a5f', hasDensity: true },
    { id: 'pat-waves', tab: 'pattern', name: '水纹', hint: '轻柔', kind: 'fill', css: 'ufx-waves', defaultOpacity: 0.35, hasColor: true, defaultColor: '#2f5d50', hasDensity: true },

    // —— 印章 ——
    { id: 'stp-postmark', tab: 'stamp', name: '邮戳', hint: '做旧', kind: 'stamp', movable: true, hasText: true, defaultText: 'POSTED', defaultOpacity: 0.72, hasColor: true, defaultColor: '#8b1a1a', font: 'steel', rotate: -18, shape: 'postmark' },
    { id: 'stp-approved', tab: 'stamp', name: '钢印 APPROVED', hint: '纪念', kind: 'stamp', movable: true, hasText: true, defaultText: 'APPROVED', defaultOpacity: 0.7, hasColor: true, defaultColor: '#8b1a1a', font: 'steel', rotate: -14, shape: 'rect' },
    { id: 'stp-checked', tab: 'stamp', name: '已验票', hint: '纪念', kind: 'stamp', movable: true, hasText: true, defaultText: '已验票', defaultOpacity: 0.75, hasColor: true, defaultColor: '#8b1a1a', font: 'steel', rotate: -10, shape: 'roundrect' },
    { id: 'stp-paid', tab: 'stamp', name: 'PAID', hint: '票务', kind: 'stamp', movable: true, hasText: true, defaultText: 'PAID', defaultOpacity: 0.7, hasColor: true, defaultColor: '#1e3a5f', font: 'steel', rotate: 12, shape: 'oval' },
    { id: 'stp-custom', tab: 'stamp', name: '自定义章', hint: '可改字', kind: 'stamp', movable: true, hasText: true, defaultText: 'MEMENTO', defaultOpacity: 0.72, hasColor: true, defaultColor: '#5c4033', font: 'memo', rotate: -8, shape: 'roundrect' },
    { id: 'stp-wax', tab: 'stamp', name: '火漆', hint: '装饰', kind: 'stamp', movable: true, hasText: false, defaultOpacity: 0.85, shape: 'wax' },

    // —— 文字 ——
    { id: 'txt-custom', tab: 'text', name: '自定义字', hint: '可改字', kind: 'stamp', movable: true, hasText: true, textControls: true, defaultText: '在此输入', defaultOpacity: 0.85, hasColor: true, defaultColor: '#1a1612', font: 'memo', rotate: -8, shape: 'plain', defaultBorder: true },
    { id: 'txt-time', tab: 'text', name: '时间戳', hint: '纪念', kind: 'stamp', movable: true, hasText: true, textControls: true, defaultText: '', textMode: 'datetime', defaultOpacity: 0.65, hasColor: true, defaultColor: '#1a1612', font: 'ticket', rotate: 0, shape: 'plain', defaultBorder: false },
    { id: 'txt-mark', tab: 'text', name: '水印字', hint: '可改字', kind: 'stamp', movable: true, hasText: true, textControls: true, defaultText: 'TICKET', defaultOpacity: 0.35, hasColor: true, defaultColor: '#1a1612', font: 'memo', rotate: -24, shape: 'plain', defaultBorder: false },
    { id: 'txt-diag', tab: 'text', name: '斜向水印', hint: '满铺感', kind: 'fill', css: 'ufx-diagtext', defaultOpacity: 0.18, hasText: true, defaultText: 'ARCHIVE', hasColor: true, defaultColor: '#1a1612', font: 'steel', hasDensity: true },

    // —— 光效 ——
    { id: 'lit-glitter', tab: 'light', name: '闪粉', hint: '炫', kind: 'fill', css: 'ufx-glitter', defaultOpacity: 0.5, hasDensity: true, hasGlitter: true, defaultGlitterShape: 'dot' },
    { id: 'lit-rose', tab: 'light', name: '玫瑰金粉', hint: '炫', kind: 'fill', css: 'ufx-glitter-rose', defaultOpacity: 0.42, hasDensity: true, hasGlitter: true, defaultGlitterShape: 'dot' },
    { id: 'lit-vignette', tab: 'light', name: '暗角', hint: '做旧', kind: 'fill', css: 'ufx-vignette', defaultOpacity: 0.55 },
    { id: 'lit-leak', tab: 'light', name: '漏光', hint: '胶片', kind: 'fill', css: 'ufx-leak', defaultOpacity: 0.4, hasColor: true, defaultColor: '#e8a060' },
    { id: 'lit-neon', tab: 'light', name: '霓虹雾', hint: '炫', kind: 'fill', css: 'ufx-neon', defaultOpacity: 0.45, hasColor: true, defaultColor: '#ff4d8d' },
    { id: 'lit-beam', tab: 'light', name: '放映光', hint: '电影', kind: 'fill', css: 'ufx-beam', defaultOpacity: 0.35 },
  ];

  const byId = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

  function uid() {
    return 'fx' + Math.random().toString(36).slice(2, 9);
  }

  function fontFamily(id) {
    const f = FONTS.find((x) => x.id === id);
    return f ? f.family : FONTS[0].family;
  }

  function resolveText(item, params, ticketData) {
    if (item.textMode === 'datetime') {
      if (params.text && params.text.trim()) return params.text;
      if (ticketData && ticketData.datetime) return ticketData.datetime;
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    return params.text != null ? params.text : item.defaultText || '';
  }

  function createInstance(catalogId, target, ticketData) {
    const item = byId[catalogId];
    if (!item) return null;
    const params = {
      opacity: item.defaultOpacity != null ? item.defaultOpacity : 0.5,
      density: 1,
      scale: 1,
      rotate: item.rotate != null ? item.rotate : 0,
      x: item.movable ? 70 : 50,
      y: item.movable ? 22 : 50,
      color: item.defaultColor || '#5c4033',
      font: item.font || 'memo',
      text: item.defaultText || '',
      border: !!item.defaultBorder,
      borderStyle: 'solid',
      borderShape: 'round',
      fontSize: item.textControls ? 16 : 15,
      glitterShape: item.defaultGlitterShape || 'dot',
      glitterSize: 1,
    };
    if (item.textMode === 'datetime') {
      params.text = resolveText(item, params, ticketData);
    }
    // 印章默认挂顶层更合理；调用方可覆盖
    const layer = target || (item.movable ? 'top' : 'bg');
    return { id: uid(), catalogId, target: layer, params };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderStampInner(item, params, ticketData) {
    const text = resolveText(item, params, ticketData) || ' ';
    const color = params.color || item.defaultColor || '#8b1a1a';
    const font = fontFamily(params.font || item.font || 'steel');
    const fontSize = params.fontSize != null ? params.fontSize : 15;

    if (item.shape === 'wax') {
      return `<span class="ufx-wax" aria-hidden="true"></span>`;
    }
    if (item.shape === 'postmark') {
      return `<span class="ufx-postmark" style="color:${esc(color)};font-family:${font}">
        <span class="ufx-postmark-ring"></span>
        <span class="ufx-postmark-text">${esc(text)}</span>
      </span>`;
    }

    // 文字特效：可开关边框 + 边框样式
    if (item.shape === 'plain' || item.textControls) {
      const borderOn = !!params.border;
      const bStyle = params.borderStyle || 'solid';
      const bShape = params.borderShape || 'round';
      const cls = [
        'ufx-plain',
        borderOn ? 'ufx-plain--border' : '',
        borderOn ? `ufx-plain--${bStyle}` : '',
        borderOn ? `ufx-plain--shape-${bShape}` : '',
      ].filter(Boolean).join(' ');
      return `<span class="${cls}" style="color:${esc(color)};border-color:${esc(color)};font-family:${font};font-size:${fontSize}px">${esc(text)}</span>`;
    }

    if (item.shape === 'oval') {
      return `<span class="ufx-stamp ufx-stamp--oval" style="color:${esc(color)};border-color:${esc(color)};font-family:${font};font-size:${fontSize}px">${esc(text)}</span>`;
    }
    if (item.shape === 'rect') {
      return `<span class="ufx-stamp ufx-stamp--rect" style="color:${esc(color)};border-color:${esc(color)};font-family:${font};font-size:${fontSize}px">${esc(text)}</span>`;
    }
    return `<span class="ufx-stamp ufx-stamp--round" style="color:${esc(color)};border-color:${esc(color)};font-family:${font};font-size:${fontSize}px">${esc(text)}</span>`;
  }

  function renderInstanceHTML(inst, ticketData, selectedId) {
    const item = byId[inst.catalogId];
    if (!item) return '';
    const p = inst.params || {};
    const op = p.opacity != null ? p.opacity : 0.5;
    const dens = p.density != null ? p.density : 1;
    const selected = inst.id === selectedId ? ' is-selected' : '';

    if (item.kind === 'fill') {
      const color = p.color || item.defaultColor || 'currentColor';
      const font = fontFamily(p.font || item.font || 'steel');
      const text = item.hasText ? resolveText(item, p, ticketData) : '';
      const gShape = p.glitterShape || item.defaultGlitterShape || 'dot';
      const gSize = p.glitterSize != null ? p.glitterSize : 1;
      const shapeCls = item.hasGlitter ? ` ufx-glitter--shape-${esc(gShape)}` : '';
      const glitterBase = item.id === 'lit-rose' ? 130 : 110;
      const glitterPx = Math.round(glitterBase * gSize);
      const glitterVar = item.hasGlitter ? `--ufx-glitter-size:${glitterPx}px;` : '';
      return `<div class="ufx-item ufx-fill ${item.css || ''}${shapeCls}${selected}" data-fx-id="${esc(inst.id)}"
        style="opacity:${op};color:${esc(color)};--ufx-density:${dens};${glitterVar}--ufx-text:'${esc(text).replace(/'/g, '\\\'')}';font-family:${font}"
        aria-hidden="true"></div>`;
    }

    // stamp / movable
    const scale = p.scale != null ? p.scale : 1;
    const rotate = p.rotate != null ? p.rotate : 0;
    const x = p.x != null ? p.x : 50;
    const y = p.y != null ? p.y : 50;
    return `<div class="ufx-item ufx-movable${selected}" data-fx-id="${esc(inst.id)}"
      style="left:${x}%;top:${y}%;opacity:${op};transform:translate(-50%,-50%) rotate(${rotate}deg) scale(${scale})">
      ${renderStampInner(item, p, ticketData)}
    </div>`;
  }

  function ensureSlots(ticket) {
    if (!ticket) return;
    if (!ticket.querySelector('[data-fx-slot="bg"]')) {
      const el = document.createElement('div');
      el.className = 'fx-user-slot fx-user-slot--bg';
      el.dataset.fxSlot = 'bg';
      ticket.insertBefore(el, ticket.firstChild);
    }
    ticket.querySelectorAll('.photo-frame').forEach((frame) => {
      if (!frame.querySelector('[data-fx-slot="photo"]')) {
        const el = document.createElement('div');
        el.className = 'fx-user-slot fx-user-slot--photo';
        el.dataset.fxSlot = 'photo';
        frame.appendChild(el);
      }
    });
    if (!ticket.querySelector('[data-fx-slot="top"]')) {
      const el = document.createElement('div');
      el.className = 'fx-user-slot fx-user-slot--top';
      el.dataset.fxSlot = 'top';
      ticket.appendChild(el);
    }
  }

  function mount(ticket, instances, opts) {
    if (!ticket) return;
    const ticketData = (opts && opts.ticketData) || {};
    const selectedId = opts && opts.selectedId;
    const editing = !!(opts && opts.editing);

    ensureSlots(ticket);
    ticket.classList.toggle('is-fx-editing', editing);

    const groups = { bg: [], photo: [], top: [] };
    (instances || []).forEach((inst) => {
      const t = groups[inst.target] ? inst.target : 'top';
      groups[t].push(inst);
    });

    ['bg', 'photo', 'top'].forEach((layer) => {
      const html = groups[layer].map((inst) => renderInstanceHTML(inst, ticketData, selectedId)).join('');
      ticket.querySelectorAll(`[data-fx-slot="${layer}"]`).forEach((slot) => {
        slot.innerHTML = html;
      });
    });
  }

  function stripUserFx(root) {
    if (!root) return;
    root.querySelectorAll('.fx-user-slot, .ufx-item').forEach((n) => n.remove());
    root.classList.remove('is-fx-editing');
  }

  function catalogByTab(tabId) {
    return CATALOG.filter((c) => c.tab === tabId);
  }

  function getItem(id) {
    return byId[id];
  }

  global.TicketEffects = {
    LAYERS,
    TABS,
    FONTS,
    COLORS,
    BORDER_STYLES,
    BORDER_SHAPES,
    GLITTER_SHAPES,
    CATALOG,
    createInstance,
    mount,
    stripUserFx,
    catalogByTab,
    getItem,
    resolveText,
    fontFamily,
  };
})(window);
