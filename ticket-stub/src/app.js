(function () {
  const Kit = window.TicketKit;
  const Fx = window.TicketEffects;
  const $ = (id) => document.getElementById(id);

  const catTabs = $('catTabs');
  const styleGrid = $('styleGrid');
  const styleSheet = $('styleSheet');
  const sheetClose = $('sheetClose');
  const sheetTitle = $('sheetTitle');
  const styleTrigger = $('styleTrigger');
  const triggerThumbBox = $('triggerThumbBox');
  const triggerThumb = $('triggerThumb');
  const triggerCat = $('triggerCat');
  const triggerName = $('triggerName');
  const fieldsEl = $('fields');
  const fieldsBtn = $('fieldsBtn');
  const fieldsSheet = $('fieldsSheet');
  const fieldsClose = $('fieldsClose');
  const fieldsScrim = $('fieldsScrim');
  const ticketHost = $('ticketHost');
  const photoInput = $('photoInput');
  const photoSlots = $('photoSlots');
  const exportBtn = $('exportBtn');
  const tiltScene = $('tiltScene');
  const tiltCard = $('tiltCard');
  const fxBtn = $('fxBtn');
  const fxSheet = $('fxSheet');
  const fxClose = $('fxClose');
  const fxLayerBar = $('fxLayerBar');
  const fxTabs = $('fxTabs');
  const fxCatalog = $('fxCatalog');
  const fxUsed = $('fxUsed');
  const fxParams = $('fxParams');
  const fxClearAll = $('fxClearAll');
  const fxScrim = $('fxScrim');
  const fxLayerHint = $('fxLayerHint');
  const fxFooter = $('fxFooter');
  const fxCommitBtn = $('fxCommitBtn');

  let catId = Kit.CATEGORIES[0].id;
  let styleId = Kit.CATEGORIES[0].styles[0].id;
  /** @type {Record<number, string>} 用户上传的 data URL，按槽位 0/1 */
  const customPhotos = {};
  let activePickSlot = 0;
  const formData = {};

  /* —— 特效状态 —— */
  let fxInstances = [];
  let fxDraft = null; // 目录预览，未点「添加」不入库
  let fxTarget = 'top';
  let fxTab = 'texture';
  let fxSelectedId = null;
  let fxOpen = false;

  const FX_LAYER_HINT = {
    bg: '背景层：铺在票面底色上，文字和照片下方',
    photo: '照片层：只盖在照片上，随裁切，出框部分没有',
    top: '前景：盖在全部内容之上，适合印章和水印',
  };

  function activePhotos() {
    const n = Kit.photoSlotCount(styleId);
    const def = Kit.defaultPhotoFor(styleId);
    return Array.from({ length: n }, (_, i) => customPhotos[i] || def);
  }

  function activePhoto() {
    return activePhotos()[0];
  }

  function syncPhotoSlots() {
    if (!photoSlots) return;
    const slotCount = Kit.photoSlotCount(styleId);
    const visible = slotCount;
    const parts = [];
    for (let i = 0; i < visible; i += 1) {
      const url = customPhotos[i];
      if (url) {
        parts.push(`<div class="photo-slot photo-slot--filled">
          <button type="button" class="photo-slot-btn photo-slot-btn--thumb" data-pick="${i}" aria-label="更换照片">
            <img src="${escapeAttr(url)}" alt="" draggable="false" />
          </button>
          <button type="button" class="photo-slot-clear" data-clear="${i}" aria-label="移除照片">
            <i data-lucide="x"></i>
          </button>
        </div>`);
      } else {
        parts.push(`<button type="button" class="photo-slot photo-slot--empty photo-slot-btn" data-add="${i}" aria-label="添加照片">
          <i data-lucide="image-plus"></i>
        </button>`);
      }
    }
    photoSlots.innerHTML = parts.join('');
    if (window.lucide) lucide.createIcons({ nodes: [photoSlots] });
  }

  let fieldsOpen = false;
  let fieldsCloseTimer = 0;
  let styleCloseTimer = 0;
  let pushFitTimer = 0;

  /** 抖音式：预览区高度收到 sheet 顶，底部贴齐 sheet 顶部 */
  function setSheetPush(panel, on) {
    if (pushFitTimer) {
      clearTimeout(pushFitTimer);
      pushFitTimer = 0;
    }
    if (!on || !panel) {
      document.documentElement.style.setProperty('--sheet-push', '0px');
      document.body.classList.remove('is-sheet-push');
      // 强制同步一次布局后再 fit，随后 ResizeObserver 跟过渡平滑插值
      void document.body.offsetHeight;
      fitTicket(false);
      pushFitTimer = setTimeout(() => {
        pushFitTimer = 0;
        fitTicket(false);
      }, 360);
      return;
    }
    // offsetHeight 不受 transform 影响，开启动画前就能定高
    const h = Math.max(0, Math.round(panel.offsetHeight));
    document.documentElement.style.setProperty('--sheet-push', `${h}px`);
    document.body.classList.add('is-sheet-push');
    void document.body.offsetHeight;
    fitTicket(false);
    pushFitTimer = setTimeout(() => {
      pushFitTimer = 0;
      fitTicket(false);
    }, 360);
  }

  function openFieldsSheet() {
    if (!fieldsSheet || fieldsOpen) return;
    if (fieldsCloseTimer) {
      clearTimeout(fieldsCloseTimer);
      fieldsCloseTimer = 0;
    }
    fieldsOpen = true;
    const panel = fieldsSheet.querySelector('.fields-panel');
    fieldsSheet.classList.remove('is-closing');
    fieldsSheet.classList.add('is-open');
    fieldsSheet.setAttribute('aria-hidden', 'false');
    if (fieldsBtn) fieldsBtn.classList.add('is-active');
    document.body.classList.add('fields-open');
    document.documentElement.classList.add('fields-open');
    // 先开再量（自适应高度），同一帧内定推高，减少跳动
    setSheetPush(panel, true);
    if (window.lucide) lucide.createIcons({ nodes: [fieldsSheet] });
  }

  function closeFieldsSheet() {
    if (!fieldsSheet || !fieldsSheet.classList.contains('is-open')) return;
    fieldsOpen = false;
    if (fieldsBtn) fieldsBtn.classList.remove('is-active');
    setSheetPush(null, false);
    fieldsSheet.classList.add('is-closing');
    fieldsSheet.classList.remove('is-open');
    if (fieldsCloseTimer) clearTimeout(fieldsCloseTimer);
    fieldsCloseTimer = setTimeout(() => {
      fieldsCloseTimer = 0;
      fieldsSheet.classList.remove('is-closing');
      fieldsSheet.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('fields-open');
      document.documentElement.classList.remove('fields-open');
    }, 340);
  }
  function currentCat() {
    return Kit.CATEGORIES.find((c) => c.id === catId) || Kit.CATEGORIES[0];
  }

  function currentStyle() {
    const cat = currentCat();
    return cat.styles.find((s) => s.id === styleId) || cat.styles[0];
  }

  function hydrateFieldsFromStyle(style, keepExisting) {
    style.fields.forEach((f) => {
      if (!keepExisting || formData[f.key] == null || formData[f.key] === '') {
        formData[f.key] = f.value;
      }
    });
  }

  function renderCats() {
    catTabs.innerHTML = Kit.CATEGORIES.map(
      (c) => `<button type="button" class="cat-tab${c.id === catId ? ' is-active' : ''}" data-cat="${c.id}">
        <i data-lucide="${c.icon}"></i><span>${c.tab || c.name}</span>
      </button>`
    ).join('');
    catTabs.querySelectorAll('.cat-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        catId = btn.dataset.cat;
        styleId = currentCat().styles[0].id;
        hydrateFieldsFromStyle(currentStyle(), false);
        renderAll();
      });
    });
  }

  /* —— 缩略图：把真实票根渲染进小盒子，等比缩放居中 —— */
  function mountThumb(host, sid, boxW, boxH, pad) {
    const found = Kit.findStyle(sid);
    if (!found || !found.style || boxW < 8 || boxH < 8) return;
    const data = {};
    found.style.fields.forEach((f) => {
      data[f.key] = f.value;
    });

    host.style.width = '';
    host.style.height = '';
    host.innerHTML = Kit.renderTicket(sid, data);

    const ticket = host.firstElementChild;
    if (!ticket) return;

    // 缩略图只有 100px 高，闪粉层（mix-blend-mode + 噪点底图）在这里看不见，
    // 却会让每次滚动重绘都做一次全层混合，直接去掉
    ticket.querySelectorAll('.fx-layer').forEach((n) => n.remove());
    if (Fx) Fx.stripUserFx(ticket);

    const w = ticket.offsetWidth;
    const h = ticket.offsetHeight;
    if (!w || !h) return;

    const s = Math.min(boxW / w, boxH / h) * (pad == null ? 0.88 : pad);
    ticket.style.transformOrigin = 'top left';
    ticket.style.transform = `scale(${s})`;
    host.style.width = `${Math.ceil(w * s)}px`;
    host.style.height = `${Math.ceil(h * s)}px`;

    if (window.lucide) lucide.createIcons({ nodes: [host] });
  }

  function renderTrigger() {
    const cat = currentCat();
    const style = currentStyle();
    triggerCat.textContent = cat.name;
    triggerName.textContent = style.name;
    mountThumb(triggerThumb, style.id, triggerThumbBox.clientWidth, triggerThumbBox.clientHeight, 0.8);
  }

  /* —— 按需渲染：只挂「进入视口附近」的缩略图 ——
     关键是不在滚动帧里干活：IntersectionObserver 回调只做入队，
     真正的渲染放到 setTimeout 分批做（每批限时 6ms），这样滚动不会掉帧 */
  let gridObserver = null;
  const thumbQueue = [];
  let thumbPump = 0;

  function queueThumb(btn) {
    if (!btn || btn.dataset.thumbDone) return;
    btn.dataset.thumbDone = '1';
    thumbQueue.push(btn);
    if (!thumbPump) thumbPump = setTimeout(pumpThumbs, 0);
  }

  function pumpThumbs() {
    thumbPump = 0;
    const t0 = performance.now();
    // 每批最多占 6ms，剩下的交给下一帧，保证主线程始终有空处理滚动
    while (thumbQueue.length && performance.now() - t0 < 6) {
      const btn = thumbQueue.shift();
      const box = btn.querySelector('.si-box');
      const host = btn.querySelector('.si-host');
      if (box && host) mountThumb(host, btn.dataset.style, box.clientWidth, box.clientHeight);
    }
    if (thumbQueue.length) thumbPump = setTimeout(pumpThumbs, 16);
  }

  function flushThumbQueue() {
    if (thumbPump) clearTimeout(thumbPump);
    thumbPump = 0;
    thumbQueue.length = 0;
  }

  function mountGridThumbs() {
    flushThumbQueue();
    if (gridObserver) gridObserver.disconnect();

    if (!window.IntersectionObserver) {
      // 兜底：没有 IntersectionObserver 就全量入队（旧环境）
      styleGrid.querySelectorAll('.style-item').forEach(queueThumb);
      return;
    }

    gridObserver = new IntersectionObserver(
      (entries) => {
        // 回调里只入队，不渲染 —— 这里还在滚动帧里
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          gridObserver.unobserve(entry.target);
          queueThumb(entry.target);
        });
      },
      { root: styleGrid, rootMargin: '700px 0px' }
    );

    styleGrid.querySelectorAll('.style-item').forEach((btn) => gridObserver.observe(btn));
  }

  /** 兜底补扫：快速滑动时 IntersectionObserver 可能跳过个别 item，
      滚动停下后把视口附近的空白缩略图补进队列 */
  let sweepTimer = 0;
  function sweepVisibleThumbs() {
    if (!sheetOpen) return;
    const gr = styleGrid.getBoundingClientRect();
    const top = gr.top - 500;
    const bottom = gr.bottom + 500;
    styleGrid.querySelectorAll('.style-item').forEach((btn) => {
      const host = btn.querySelector('.si-host');
      if (!host || host.firstElementChild) return;
      const r = btn.getBoundingClientRect();
      if (r.bottom < top || r.top > bottom) return;
      queueThumb(btn);
    });
  }

  styleGrid.addEventListener(
    'scroll',
    () => {
      clearTimeout(sweepTimer);
      sweepTimer = setTimeout(sweepVisibleThumbs, 90);
    },
    { passive: true }
  );

  function renderStyleGrid() {
    const cat = currentCat();
    sheetTitle.textContent = `${cat.name} · ${cat.styles.length} 款`;
    styleGrid.scrollTop = 0;
    styleGrid.innerHTML = cat.styles
      .map(
        (s) => `<button type="button" class="style-item${s.id === styleId ? ' is-active' : ''}" data-style="${s.id}" role="option" aria-selected="${s.id === styleId}">
        <span class="si-box" aria-hidden="true"><span class="si-host"></span></span>
        <span class="si-text">
          <span class="si-name">${s.name}</span>
          <span class="si-desc">${s.desc}</span>
        </span>
        <span class="si-check" aria-hidden="true"><i data-lucide="check"></i></span>
      </button>`
      )
      .join('');
    styleGrid.querySelectorAll('.style-item').forEach((btn) => {
      btn.addEventListener('click', () => selectStyle(btn.dataset.style));
    });
    if (window.lucide) lucide.createIcons({ nodes: [styleGrid] });
    mountGridThumbs();
  }

  function selectStyle(id) {
    const kept = [];
    if (customPhotos[0]) kept[0] = customPhotos[0];
    if (customPhotos[1]) kept[1] = customPhotos[1];
    styleId = id;
    Object.keys(customPhotos).forEach((k) => delete customPhotos[k]);
    const slots = Kit.photoSlotCount(styleId);
    if (kept[0]) customPhotos[0] = kept[0];
    if (slots >= 2 && kept[1]) customPhotos[1] = kept[1];
    hydrateFieldsFromStyle(currentStyle(), false);
    closeSheet();
    renderAll();
  }

  let sheetOpen = false;
  let lastGridWidth = 0;

  function openSheet() {
    if (sheetOpen) return;
    if (styleCloseTimer) {
      clearTimeout(styleCloseTimer);
      styleCloseTimer = 0;
    }
    styleSheet.classList.remove('is-closing');
    sheetOpen = true;
    styleSheet.classList.add('is-open');
    styleSheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-open');
    lastGridWidth = styleGrid.clientWidth;
    renderStyleGrid();
    sheetClose.focus({ preventScroll: true });
  }

  function closeSheet() {
    if (!sheetOpen && !styleSheet.classList.contains('is-open')) return;
    if (styleSheet.classList.contains('is-closing')) return;
    sheetOpen = false;
    document.body.classList.remove('sheet-open');
    styleSheet.classList.add('is-closing');
    styleSheet.classList.remove('is-open');
    // 停掉观察器与待渲染队列，避免面板关闭后还挂着已卸载的节点
    if (gridObserver) {
      gridObserver.disconnect();
      gridObserver = null;
    }
    flushThumbQueue();
    if (styleCloseTimer) clearTimeout(styleCloseTimer);
    styleCloseTimer = setTimeout(() => {
      styleCloseTimer = 0;
      styleSheet.classList.remove('is-closing');
      styleSheet.setAttribute('aria-hidden', 'true');
    }, 340);
  }

  styleTrigger.addEventListener('click', openSheet);
  sheetClose.addEventListener('click', () => {
    closeSheet();
    styleTrigger.focus({ preventScroll: true });
  });
  styleSheet.addEventListener('click', (e) => {
    if (e.target === styleSheet) closeSheet();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen) closeSheet();
    if (e.key === 'Escape' && fxOpen) closeFxSheet();
    if (e.key === 'Escape' && fieldsOpen) closeFieldsSheet();
  });

  function renderFields() {
    const style = currentStyle();
    fieldsEl.innerHTML = style.fields
      .map((f) => {
        const val = formData[f.key] != null ? formData[f.key] : f.value;
        return `<div class="field">
          <label for="f-${f.key}">${f.label}</label>
          <input id="f-${f.key}" data-key="${f.key}" type="text" maxlength="64" value="${escapeAttr(val)}" placeholder="${escapeAttr(f.placeholder)}" />
        </div>`;
      })
      .join('');
    fieldsEl.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        formData[input.dataset.key] = input.value;
        renderTicketOnly();
      });
    });
  }

  function escapeAttr(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function ticketData() {
    const style = currentStyle();
    const data = {};
    style.fields.forEach((f) => {
      data[f.key] = formData[f.key] != null ? formData[f.key] : f.value;
    });
    return data;
  }

  function renderTicketOnly() {
    ticketHost.innerHTML = Kit.renderTicket(styleId, ticketData(), activePhotos());
    delete ticketHost.dataset.natW;
    delete ticketHost.dataset.natH;
    applyUserFx();
    if (window.lucide) lucide.createIcons({ nodes: [ticketHost] });
    requestAnimationFrame(() => fitTicket(true));
  }

  function parseRadius(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** 照片高亮圆角：优先用 photo-frame 自身；若为直角但被祖先 overflow+圆角裁切，则同步可见轮廓 */
  function syncPhotoTargetRadii(ticket) {
    ticket.querySelectorAll('.fx-user-slot--photo').forEach((slot) => {
      const frame = slot.closest('.photo-frame');
      if (!frame) return;
      const fr = getComputedStyle(frame);
      let tl = parseRadius(fr.borderTopLeftRadius);
      let tr = parseRadius(fr.borderTopRightRadius);
      let br = parseRadius(fr.borderBottomRightRadius);
      let bl = parseRadius(fr.borderBottomLeftRadius);

      if (tl + tr + br + bl === 0) {
        const fRect = frame.getBoundingClientRect();
        let node = frame.parentElement;
        while (node && ticket.contains(node)) {
          const cs = getComputedStyle(node);
          const clips = cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
          const rtl = parseRadius(cs.borderTopLeftRadius);
          const rtr = parseRadius(cs.borderTopRightRadius);
          const rbr = parseRadius(cs.borderBottomRightRadius);
          const rbl = parseRadius(cs.borderBottomLeftRadius);
          if (clips && rtl + rtr + rbr + rbl > 0) {
            const aRect = node.getBoundingClientRect();
            const eps = 2;
            if (Math.abs(fRect.top - aRect.top) < eps && Math.abs(fRect.left - aRect.left) < eps) tl = rtl;
            if (Math.abs(fRect.top - aRect.top) < eps && Math.abs(fRect.right - aRect.right) < eps) tr = rtr;
            if (Math.abs(fRect.bottom - aRect.bottom) < eps && Math.abs(fRect.right - aRect.right) < eps) br = rbr;
            if (Math.abs(fRect.bottom - aRect.bottom) < eps && Math.abs(fRect.left - aRect.left) < eps) bl = rbl;
            break;
          }
          node = node.parentElement;
        }
      }

      slot.style.setProperty('--fx-photo-radii', `${tl}px ${tr}px ${br}px ${bl}px`);
    });
  }

  function applyUserFx() {
    if (!Fx) return;
    const ticket = ticketHost.firstElementChild;
    if (!ticket) return;
    const list = fxDraft ? fxInstances.concat([fxDraft]) : fxInstances.slice();
    Fx.mount(ticket, list, {
      ticketData: ticketData(),
      selectedId: fxOpen ? fxSelectedId : null,
      editing: fxOpen,
    });
    ticket.dataset.fxTarget = fxTarget;
    ticket.querySelectorAll('[data-fx-slot]').forEach((slot) => {
      slot.classList.toggle('is-active-target', fxOpen && slot.dataset.fxSlot === fxTarget);
    });
    if (fxOpen && fxTarget === 'photo') syncPhotoTargetRadii(ticket);
    bindStampGestures(ticket);
  }

  function selectedFx() {
    if (fxDraft && fxDraft.id === fxSelectedId) return fxDraft;
    return fxInstances.find((x) => x.id === fxSelectedId) || null;
  }

  function findFxById(id) {
    if (fxDraft && fxDraft.id === id) return fxDraft;
    return fxInstances.find((x) => x.id === id) || null;
  }

  function syncFxFooter(show) {
    if (!fxFooter) return;
    fxFooter.classList.toggle('is-hidden', !show);
  }

  function commitFxDraft() {
    if (!fxDraft) return;
    const committed = {
      id: fxDraft.id,
      catalogId: fxDraft.catalogId,
      target: fxDraft.target,
      params: Object.assign({}, fxDraft.params),
    };
    fxInstances.push(committed);
    fxDraft = null;
    fxSelectedId = committed.id;
    renderTicketOnly();
    refreshFxUI();
    closeFxSheet();
  }

  function refreshFxUI() {
    if (!Fx || !fxLayerBar) return;

    fxLayerBar.innerHTML = Fx.LAYERS.map(
      (l) => `<button type="button" class="fx-chip fx-chip--layer${l.id === fxTarget ? ' is-active' : ''}" data-layer="${l.id}" role="radio" aria-checked="${l.id === fxTarget}">${l.label}</button>`
    ).join('');
    fxLayerBar.querySelectorAll('[data-layer]').forEach((btn) => {
      btn.addEventListener('click', () => {
        fxTarget = btn.dataset.layer;
        if (fxDraft) fxDraft.target = fxTarget;
        const sel = selectedFx();
        // 已选中的已用项：同步改它所在层
        if (sel && !(fxDraft && sel.id === fxDraft.id)) {
          sel.target = fxTarget;
        }
        applyUserFx();
        refreshFxUI();
      });
    });
    if (fxLayerHint) fxLayerHint.textContent = FX_LAYER_HINT[fxTarget] || '';

    fxTabs.innerHTML = Fx.TABS.map(
      (t) => `<button type="button" class="fx-tab${t.id === fxTab ? ' is-active' : ''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');
    fxTabs.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        fxTab = btn.dataset.tab;
        if (fxTab === 'stamp' || fxTab === 'text') fxTarget = 'top';
        if (fxTab === 'texture' && fxTarget === 'top') fxTarget = 'bg';
        refreshFxUI();
        applyUserFx();
      });
    });

    const list = Fx.catalogByTab(fxTab);
    const previewId = fxDraft ? fxDraft.catalogId : null;
    fxCatalog.innerHTML = list
      .map(
        (c) => `<button type="button" class="fx-cat-item${previewId === c.id ? ' is-preview' : ''}" data-preview="${c.id}">
        <span class="fx-cat-name">${c.name}</span>
      </button>`
      )
      .join('');
    fxCatalog.querySelectorAll('[data-preview]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const catalogId = btn.dataset.preview;
        // 再次点同一项：取消预览
        if (fxDraft && fxDraft.catalogId === catalogId) {
          fxDraft = null;
          fxSelectedId = null;
          renderTicketOnly();
          refreshFxUI();
          return;
        }
        const inst = Fx.createInstance(catalogId, fxTarget, ticketData());
        if (!inst) return;
        fxDraft = inst;
        fxSelectedId = inst.id;
        renderTicketOnly();
        refreshFxUI();
      });
    });

    const layerLabel = Object.fromEntries(Fx.LAYERS.map((l) => [l.id, l.label]));
    if (!fxInstances.length) {
      fxUsed.innerHTML = '';
    } else {
      fxUsed.innerHTML = fxInstances
        .map((inst) => {
          const item = Fx.getItem(inst.catalogId);
          const name = item ? item.name : inst.catalogId;
          return `<button type="button" class="fx-used-item${inst.id === fxSelectedId ? ' is-active' : ''}" data-sel="${inst.id}">
            ${name}·${layerLabel[inst.target] || inst.target}
            <span class="fx-used-del" data-del="${inst.id}" title="删除">×</span>
          </button>`;
        })
        .join('');
      fxUsed.querySelectorAll('[data-sel]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          if (e.target.closest('[data-del]')) return;
          fxDraft = null; // 改已用项时收起预览
          fxSelectedId = btn.dataset.sel;
          const inst = selectedFx();
          if (inst) fxTarget = inst.target;
          renderTicketOnly();
          refreshFxUI();
        });
      });
      fxUsed.querySelectorAll('[data-del]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.del;
          fxInstances = fxInstances.filter((x) => x.id !== id);
          if (fxSelectedId === id) fxSelectedId = null;
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }

    renderFxParams();
  }

  function renderFxParams() {
    const inst = selectedFx();
    const isDraft = !!(fxDraft && inst && inst.id === fxDraft.id);
    if (!inst || !Fx) {
      fxParams.innerHTML = '<p class="fx-params-empty">点素材预览，或点已用项调整</p>';
      syncFxFooter(false);
      return;
    }
    const item = Fx.getItem(inst.catalogId);
    if (!item) {
      fxParams.innerHTML = '<p class="fx-params-empty">未知特效</p>';
      syncFxFooter(false);
      return;
    }
    const p = inst.params;
    const parts = [];

    if (isDraft) {
      parts.push(`<div class="fx-preview-banner">预览中 · ${item.name}（未添加）</div>`);
    }

    // 文字类：输入框放最前
    if (item.hasText) {
      parts.push(`<div class="fx-field"><label>文字内容</label>
        <input type="text" class="fx-text-input" maxlength="40" placeholder="输入文字…" value="${escapeAttr(p.text || '')}" data-param="text" /></div>`);
    }

    if (item.textControls) {
      const borderOn = !!p.border;
      parts.push(`<div class="fx-field"><label>边框</label>
        <div class="fx-seg" id="fxBorderToggle">
          <button type="button" class="fx-seg-btn${!borderOn ? ' is-active' : ''}" data-border="0">无</button>
          <button type="button" class="fx-seg-btn${borderOn ? ' is-active' : ''}" data-border="1">有</button>
        </div></div>`);
      if (borderOn) {
        parts.push('<div class="fx-field"><label>边框样式</label><div class="fx-seg" id="fxBorderStyle"></div></div>');
        parts.push('<div class="fx-field"><label>边框形状</label><div class="fx-seg" id="fxBorderShape"></div></div>');
      }
      parts.push(`<div class="fx-field"><label>字号 ${Math.round(p.fontSize || 16)}</label>
        <input type="range" min="10" max="36" value="${Math.round(p.fontSize || 16)}" data-param="fontSize" /></div>`);
      parts.push('<div class="fx-field"><label>字体</label><div class="fx-fonts" id="fxFontRow"></div></div>');
      parts.push('<div class="fx-field"><label>颜色</label><div class="fx-swatches" id="fxColorRow"></div></div>');
    } else if (item.hasText) {
      parts.push('<div class="fx-field"><label>字体</label><div class="fx-fonts" id="fxFontRow"></div></div>');
      if (item.hasColor || item.hasText) {
        parts.push('<div class="fx-field"><label>颜色</label><div class="fx-swatches" id="fxColorRow"></div></div>');
      }
    } else if (item.hasColor) {
      parts.push('<div class="fx-field"><label>颜色</label><div class="fx-swatches" id="fxColorRow"></div></div>');
    }

    parts.push(`<div class="fx-field"><label>强度 ${Math.round((p.opacity || 0) * 100)}%</label>
      <input type="range" min="5" max="100" value="${Math.round((p.opacity || 0.5) * 100)}" data-param="opacity" /></div>`);

    if (item.hasDensity) {
      parts.push(`<div class="fx-field"><label>密度 ${Math.round((p.density || 1) * 100)}%</label>
        <input type="range" min="50" max="200" value="${Math.round((p.density || 1) * 100)}" data-param="density" /></div>`);
    }
    if (item.hasGlitter) {
      parts.push(`<div class="fx-field"><label>颗粒大小 ${Math.round((p.glitterSize || 1) * 100)}%</label>
        <input type="range" min="50" max="200" value="${Math.round((p.glitterSize || 1) * 100)}" data-param="glitterSize" /></div>`);
      parts.push('<div class="fx-field"><label>形状</label><div class="fx-seg fx-seg--wrap" id="fxGlitterShape"></div></div>');
    }
    if (item.movable) {
      parts.push(`<div class="fx-field"><label>水平位置 ${Math.round(p.x || 50)}%</label>
        <input type="range" min="5" max="95" value="${Math.round(p.x || 50)}" data-param="x" /></div>`);
      parts.push(`<div class="fx-field"><label>垂直位置 ${Math.round(p.y || 50)}%</label>
        <input type="range" min="5" max="95" value="${Math.round(p.y || 50)}" data-param="y" /></div>`);
      parts.push(`<div class="fx-field"><label>缩放</label>
        <input type="range" min="40" max="220" value="${Math.round((p.scale || 1) * 100)}" data-param="scale" /></div>`);
      parts.push(`<div class="fx-field"><label>旋转 ${Math.round(p.rotate || 0)}°</label>
        <input type="range" min="-180" max="180" value="${Math.round(p.rotate || 0)}" data-param="rotate" /></div>`);
    }

    fxParams.innerHTML = parts.join('');
    syncFxFooter(isDraft);

    fxParams.querySelectorAll('[data-param]').forEach((el) => {
      el.addEventListener('input', () => {
        const key = el.dataset.param;
        if (key === 'opacity' || key === 'density' || key === 'scale' || key === 'glitterSize') {
          p[key] = Number(el.value) / 100;
        } else if (key === 'rotate' || key === 'x' || key === 'y' || key === 'fontSize') {
          p[key] = Number(el.value);
        } else if (key === 'text') {
          p.text = el.value;
        }
        renderTicketOnly();
        if (key !== 'text') {
          const label = el.closest('.fx-field') && el.closest('.fx-field').querySelector('label');
          if (label && key === 'opacity') label.textContent = `强度 ${Math.round(p.opacity * 100)}%`;
          if (label && key === 'rotate') label.textContent = `旋转 ${Math.round(p.rotate)}°`;
          if (label && key === 'x') label.textContent = `水平位置 ${Math.round(p.x)}%`;
          if (label && key === 'y') label.textContent = `垂直位置 ${Math.round(p.y)}%`;
          if (label && key === 'fontSize') label.textContent = `字号 ${Math.round(p.fontSize)}`;
          if (label && key === 'density') label.textContent = `密度 ${Math.round(p.density * 100)}%`;
          if (label && key === 'glitterSize') label.textContent = `颗粒大小 ${Math.round(p.glitterSize * 100)}%`;
        }
      });
    });

    const glitterShapeRow = $('fxGlitterShape');
    if (glitterShapeRow && Fx.GLITTER_SHAPES) {
      const cur = p.glitterShape || 'dot';
      glitterShapeRow.innerHTML = Fx.GLITTER_SHAPES.map(
        (s) => `<button type="button" class="fx-seg-btn${cur === s.id ? ' is-active' : ''}" data-gshape="${s.id}">${s.label}</button>`
      ).join('');
      glitterShapeRow.querySelectorAll('[data-gshape]').forEach((btn) => {
        btn.addEventListener('click', () => {
          p.glitterShape = btn.dataset.gshape;
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }

    const borderToggle = $('fxBorderToggle');
    if (borderToggle) {
      borderToggle.querySelectorAll('[data-border]').forEach((btn) => {
        btn.addEventListener('click', () => {
          p.border = btn.dataset.border === '1';
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }

    const borderStyleRow = $('fxBorderStyle');
    if (borderStyleRow && Fx.BORDER_STYLES) {
      borderStyleRow.innerHTML = Fx.BORDER_STYLES.map(
        (s) => `<button type="button" class="fx-seg-btn${(p.borderStyle || 'solid') === s.id ? ' is-active' : ''}" data-bstyle="${s.id}">${s.label}</button>`
      ).join('');
      borderStyleRow.querySelectorAll('[data-bstyle]').forEach((btn) => {
        btn.addEventListener('click', () => {
          p.borderStyle = btn.dataset.bstyle;
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }

    const borderShapeRow = $('fxBorderShape');
    if (borderShapeRow && Fx.BORDER_SHAPES) {
      borderShapeRow.innerHTML = Fx.BORDER_SHAPES.map(
        (s) => `<button type="button" class="fx-seg-btn${(p.borderShape || 'round') === s.id ? ' is-active' : ''}" data-bshape="${s.id}">${s.label}</button>`
      ).join('');
      borderShapeRow.querySelectorAll('[data-bshape]').forEach((btn) => {
        btn.addEventListener('click', () => {
          p.borderShape = btn.dataset.bshape;
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }

    const fontRow = $('fxFontRow');
    if (fontRow) {
      fontRow.innerHTML = Fx.FONTS.map(
        (f) => `<button type="button" class="fx-font-btn${p.font === f.id ? ' is-active' : ''}" data-font="${f.id}" style="font-family:${f.family}">${f.label}</button>`
      ).join('');
      fontRow.querySelectorAll('[data-font]').forEach((btn) => {
        btn.addEventListener('click', () => {
          p.font = btn.dataset.font;
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }

    const colorRow = $('fxColorRow');
    if (colorRow) {
      colorRow.innerHTML = Fx.COLORS.map(
        (c) => `<button type="button" class="fx-swatch${p.color === c ? ' is-active' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`
      ).join('');
      colorRow.querySelectorAll('[data-color]').forEach((btn) => {
        btn.addEventListener('click', () => {
          p.color = btn.dataset.color;
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }
  }

  let dragState = null;

  function bindStampGestures(ticket) {
    if (!fxOpen || !ticket) return;
    ticket.querySelectorAll('.ufx-movable').forEach((el) => {
      el.addEventListener('pointerdown', onStampPointerDown);
    });
  }

  function onStampPointerDown(e) {
    if (!fxOpen) return;
    const el = e.currentTarget;
    const id = el.dataset.fxId;
    const inst = findFxById(id);
    if (!inst) return;
    fxSelectedId = id;
    refreshFxUI();

    const slot = el.closest('[data-fx-slot]');
    if (!slot) return;
    const rect = slot.getBoundingClientRect();
    dragState = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: inst.params.x,
      origY: inst.params.y,
      rectW: rect.width,
      rectH: rect.height,
    };
    try {
      el.setPointerCapture(e.pointerId);
    } catch (_) {}
    e.preventDefault();
    e.stopPropagation();
  }

  function onStampPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const inst = findFxById(dragState.id);
    if (!inst) return;
    const dx = ((e.clientX - dragState.startX) / dragState.rectW) * 100;
    const dy = ((e.clientY - dragState.startY) / dragState.rectH) * 100;
    inst.params.x = Math.min(95, Math.max(5, dragState.origX + dx));
    inst.params.y = Math.min(95, Math.max(5, dragState.origY + dy));
    ticketHost.querySelectorAll(`.ufx-movable[data-fx-id="${inst.id}"]`).forEach((node) => {
      const scale = inst.params.scale || 1;
      const rotate = inst.params.rotate || 0;
      node.style.left = `${inst.params.x}%`;
      node.style.top = `${inst.params.y}%`;
      node.style.transform = `translate(-50%,-50%) rotate(${rotate}deg) scale(${scale})`;
    });
  }

  function onStampPointerUp(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    dragState = null;
  }

  window.addEventListener('pointermove', onStampPointerMove);
  window.addEventListener('pointerup', onStampPointerUp);
  window.addEventListener('pointercancel', onStampPointerUp);

  let fxCloseTimer = 0;

  function lockFxScroll(lock) {
    document.body.classList.toggle('fx-open', lock);
    document.documentElement.classList.toggle('fx-open', lock);
  }

  function onFxTouchMove(e) {
    if (!fxOpen && !fieldsOpen) return;
    if (e.target.closest && (e.target.closest('.fx-body') || e.target.closest('.fields-body'))) return;
    e.preventDefault();
  }

  function openFxSheet() {
    if (!Fx || fxOpen) return;
    if (fxCloseTimer) {
      clearTimeout(fxCloseTimer);
      fxCloseTimer = 0;
    }
    fxOpen = true;
    const panel = fxSheet.querySelector('.fx-panel');
    // 先定推高再播 sheet，预览与面板同帧起步，避免高度后知后觉
    setSheetPush(panel, true);
    fxSheet.classList.remove('is-closing');
    fxSheet.classList.add('is-open');
    fxSheet.setAttribute('aria-hidden', 'false');
    fxBtn.classList.add('is-active');
    lockFxScroll(true);
    resetTilt();
    refreshFxUI();
    applyUserFx();
    if (window.lucide) lucide.createIcons({ nodes: [fxSheet, fxBtn] });
  }

  function closeFxSheet() {
    if (!fxOpen && !fxSheet.classList.contains('is-open')) return;
    if (!fxSheet.classList.contains('is-open')) return;

    fxOpen = false;
    fxDraft = null;
    if (fxSelectedId && !fxInstances.some((x) => x.id === fxSelectedId)) {
      fxSelectedId = null;
    }
    syncFxFooter(false);
    fxBtn.classList.remove('is-active');
    setSheetPush(null, false);

    // 先播关闭动画，再卸状态（避免 visibility 瞬间切掉）
    fxSheet.classList.add('is-closing');
    fxSheet.classList.remove('is-open');
    if (fxCloseTimer) clearTimeout(fxCloseTimer);
    fxCloseTimer = setTimeout(() => {
      fxCloseTimer = 0;
      fxSheet.classList.remove('is-closing');
      fxSheet.setAttribute('aria-hidden', 'true');
      lockFxScroll(false);
      applyUserFx();
    }, 340);
  }

  if (fxBtn) fxBtn.addEventListener('click', () => (fxOpen ? closeFxSheet() : openFxSheet()));
  if (fxClose) fxClose.addEventListener('click', closeFxSheet);
  if (fxScrim) fxScrim.addEventListener('click', closeFxSheet);
  if (fxCommitBtn) fxCommitBtn.addEventListener('click', commitFxDraft);
  if (fieldsBtn) fieldsBtn.addEventListener('click', () => (fieldsOpen ? closeFieldsSheet() : openFieldsSheet()));
  if (fieldsClose) fieldsClose.addEventListener('click', closeFieldsSheet);
  if (fieldsScrim) fieldsScrim.addEventListener('click', closeFieldsSheet);
  document.addEventListener('touchmove', onFxTouchMove, { passive: false });
  if (fxClearAll) {
    fxClearAll.addEventListener('click', () => {
      fxInstances = [];
      fxDraft = null;
      fxSelectedId = null;
      renderTicketOnly();
      refreshFxUI();
    });
  }

  function renderAll() {
    renderCats();
    renderTrigger();
    renderFields();
    syncPhotoSlots();
    renderTicketOnly();
    if (sheetOpen) renderStyleGrid();
    if (fxOpen) refreshFxUI();
    if (window.lucide) lucide.createIcons();
  }

  /** 竖屏优先：按预览区宽高等比缩进
   *  缓存票面固有尺寸，避免过渡中反复「清缩放→闪大图→再缩小」 */
  let fitScale = 1;
  function fitTicket(forceRemeasure) {
    const ticket = ticketHost.firstElementChild;
    if (!ticket || !tiltScene || !tiltCard) return;

    let w = Number(ticketHost.dataset.natW) || 0;
    let h = Number(ticketHost.dataset.natH) || 0;

    if (forceRemeasure || !w || !h) {
      const keepT = ticketHost.style.transform;
      const keepW = ticketHost.style.width;
      const keepH = ticketHost.style.height;
      ticketHost.style.transform = 'none';
      ticketHost.style.width = '';
      ticketHost.style.height = '';
      w = ticket.offsetWidth;
      h = ticket.offsetHeight;
      if (!forceRemeasure && (keepW || keepT)) {
        ticketHost.style.width = keepW;
        ticketHost.style.height = keepH;
        ticketHost.style.transform = keepT;
      }
      if (!w || !h) return;
      ticketHost.dataset.natW = String(w);
      ticketHost.dataset.natH = String(h);
    }

    const pad = 4;
    const availW = Math.max(tiltScene.clientWidth - pad, 60);
    const availH = Math.max(tiltScene.clientHeight - pad, 60);
    fitScale = Math.min(availW / w, availH / h);
    fitScale = Math.min(1, Math.max(0.22, fitScale * 0.92));

    ticketHost.style.width = `${w}px`;
    ticketHost.style.height = `${h}px`;
    ticketHost.style.transformOrigin = 'top left';
    ticketHost.style.transform = `scale(${fitScale})`;
    tiltCard.style.width = `${Math.ceil(w * fitScale)}px`;
    tiltCard.style.height = `${Math.ceil(h * fitScale)}px`;
  }

  if (photoSlots) {
    photoSlots.addEventListener('click', (e) => {
      const clearBtn = e.target.closest('[data-clear]');
      if (clearBtn) {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(clearBtn.dataset.clear);
        delete customPhotos[idx];
        renderTicketOnly();
        renderTrigger();
        syncPhotoSlots();
        return;
      }
      const pickBtn = e.target.closest('[data-pick], [data-add]');
      if (!pickBtn) return;
      activePickSlot = Number(pickBtn.dataset.pick ?? pickBtn.dataset.add);
      if (!Number.isFinite(activePickSlot)) return;
      photoInput.value = '';
      photoInput.click();
    });
  }

  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    // 必须读成 data URL，不能用 URL.createObjectURL：
    // blob: 地址 html-to-image 无法内联，会导致导出直接失败
    const reader = new FileReader();
    reader.onload = () => {
      customPhotos[activePickSlot] = String(reader.result);
      renderTicketOnly();
      renderTrigger();
      syncPhotoSlots();
    };
    reader.onerror = () => {
      alert('图片读取失败，请重试');
    };
    reader.readAsDataURL(file);
  });

  /* —— CSS 3D tilt —— */
  let raf = 0;
  function onMove(e) {
    if (fxOpen) return;
    const rect = tiltScene.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - y) * 6;
    const ry = (x - 0.5) * 8;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      tiltCard.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      const shadeX = (0.5 - x) * 20;
      const shadeY = (0.5 - y) * 16;
      ticketHost.style.filter = `drop-shadow(${shadeX}px ${14 + shadeY}px 22px rgba(0, 0, 0, 0.38))`;
    });
  }

  function resetTilt() {
    tiltCard.style.transform = 'rotateX(0deg) rotateY(0deg)';
    ticketHost.style.filter = 'drop-shadow(6px 12px 18px rgba(0,0,0,0.32))';
  }

  tiltScene.addEventListener('pointermove', onMove);
  tiltScene.addEventListener('pointerleave', resetTilt);
  window.addEventListener('resize', () => {
    resetTilt();
    fitTicket(true);
    renderTrigger();
    // 只有宽度真的变了才重建列表（移动端地址栏收起也会触发 resize）
    if (sheetOpen && styleGrid.clientWidth !== lastGridWidth) {
      lastGridWidth = styleGrid.clientWidth;
      renderStyleGrid();
    }
  });
  if (window.ResizeObserver) {
    // 用缓存固有尺寸持续跟 avail，过渡中不会闪大图
    new ResizeObserver(() => fitTicket(false)).observe(tiltScene);
  }
  resetTilt();

  /* —— export ——
     渲染到离屏的原始尺寸副本上，预览区全程不动，
     所以既不会跳动，也不会因为预览的缩放/3D 变换影响截图结果 */
  async function exportPng() {
    if (!window.htmlToImage) {
      alert('截图库加载失败，请检查网络后重试');
      return;
    }
    const node = ticketHost.firstElementChild;
    if (!node) return;

    exportBtn.disabled = true;
    const label = exportBtn.querySelector('span');
    const prevLabel = label ? label.textContent : '导出';
    if (label) label.textContent = '导出中…';

    const stage = document.createElement('div');
    stage.className = 'export-stage';
    stage.setAttribute('aria-hidden', 'true');
    const clip = node.cloneNode(true);
    // 清掉可能从缩略图流程带进来的缩放
    clip.style.transform = '';
    clip.classList.remove('is-fx-editing');
    clip.removeAttribute('data-fx-target');
    clip.querySelectorAll('.ufx-item.is-selected, .fx-user-slot.is-active-target').forEach((n) => {
      n.classList.remove('is-selected', 'is-active-target');
    });
    // 未点「添加」的预览不进导出
    if (fxDraft) {
      clip.querySelectorAll(`[data-fx-id="${fxDraft.id}"]`).forEach((n) => n.remove());
    }
    stage.appendChild(clip);
    document.body.appendChild(stage);

    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const dataUrl = await htmlToImage.toPng(clip, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: null,
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `ticket-${styleId}-${Date.now()}.png`;
      a.click();
    } catch (err) {
      console.error('导出失败', err);
      alert('导出失败，请重试；若仍失败可换一张本地图片');
    } finally {
      stage.remove();
      exportBtn.disabled = false;
      if (label) label.textContent = prevLabel;
      if (window.lucide) lucide.createIcons({ nodes: [exportBtn] });
    }
  }

  exportBtn.addEventListener('click', exportPng);

  hydrateFieldsFromStyle(currentStyle(), false);
  renderAll();
})();
