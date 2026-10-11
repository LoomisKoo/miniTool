(function () {
  const Kit = window.TicketKit;
  const Fx = window.TicketEffects;
  const $ = (id) => document.getElementById(id);

  const catTabs = $('catTabs');
  const styleGrid = $('styleGrid');
  const styleSheet = $('styleSheet');
  const styleScrim = $('styleScrim');
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
  const photoSheet = $('photoSheet');
  const photoScrim = $('photoScrim');
  const photoClose = $('photoClose');
  const photoSheetTitle = $('photoSheetTitle');
  const photoAdjustViewport = $('photoAdjustViewport');
  const photoAdjustImg = $('photoAdjustImg');
  const photoReplaceBtn = $('photoReplaceBtn');
  const photoConfirmBtn = $('photoConfirmBtn');
  const stagePanel = $('stagePanel');
  const stageArtboard = $('stageArtboard');
  const stageBgEl = $('stageBg');
  const stageBgImg = $('stageBgImg');
  const stageBgInput = $('stageBgInput');
  const stageBtn = $('stageBtn');
  const stageSheet = $('stageSheet');
  const stageClose = $('stageClose');
  const stageScrim = $('stageScrim');
  const stageColorGrid = $('stageColorGrid');
  const stageColorValue = $('stageColorValue');
  const stageMedia = $('stageMedia');
  const stageMediaEmpty = $('stageMediaEmpty');
  const stageMediaFilled = $('stageMediaFilled');
  const stageMediaPickTile = $('stageMediaPickTile');
  const stageMediaImg = $('stageMediaImg');
  const stageBgViewport = $('stageMediaViewport');
  const stageStyleField = $('stageStyleField');
  const stageBgPickBtn = $('stageBgPickBtn');
  const stageBgClearBtn = $('stageBgClearBtn');
  const stageBgControls = $('stageBgControls');
  const stageOpacityUi = $('stageOpacityUi');
  const exportSheet = $('exportSheet');
  const exportScrim = $('exportScrim');
  const exportClose = $('exportClose');
  const exportTicketBtn = $('exportTicketBtn');
  const exportSceneBtn = $('exportSceneBtn');
  const publishBtn = $('publishBtn');
  const publishSheet = $('publishSheet');
  const publishClose = $('publishClose');
  const publishScrim = $('publishScrim');
  const publishTicketBtn = $('publishTicketBtn');
  const publishNoteBtn = $('publishNoteBtn');

  let catId = Kit.CATEGORIES[0].id;
  let styleId = Kit.CATEGORIES[0].styles[0].id;
  /** @type {Record<number, string>} 用户上传的 data URL，按槽位 0/1 */
  const customPhotos = {};
  /** @type {Record<number, { x: number, y: number, scale: number }>} */
  const photoFit = {};
  /** @type {Record<number, number>} 上传图宽高比 Iw/Ih */
  const photoAspect = {};
  let activePickSlot = 0;
  let adjustSlot = 0;
  let photoOpen = false;
  let photoCloseTimer = 0;
  let photoDrag = null;
  let photoPinch = null;
  /** @type {Map<number, { x: number, y: number }>} */
  const photoPointers = new Map();
  const PHOTO_DOUBLE_TAP_MS = 320;
  const PHOTO_DOUBLE_TAP_PX = 16;
  const PHOTO_DOUBLE_ZOOM = 2;
  let photoLastTapAt = 0;
  let photoLastTapX = 0;
  let photoLastTapY = 0;
  let photoSuppressDblClick = false;
  const formData = {};

  /* —— 特效状态 —— */
  let fxInstances = [];
  let fxDraft = null; // 目录预览，未点「添加」不入库
  let fxTarget = 'top';
  let fxTab = 'texture';
  let fxSelectedId = null;
  let fxOpen = false;

  /** 纸感 3D 呈现 */
  let paperPresentMode = 'flat';
  let paperPreset = 'matte';
  let paperGrain = 0.42;
  let paperCurl = 0.12;
  let paperLight = 0.65;
  let paperGl = null;
  let paperRenderTimer = 0;
  let paperRenderGen = 0;

  const STAGE_STYLE_FILTERS = {
    none: '',
    mono: 'grayscale(1) contrast(1.06)',
    vintage: 'sepia(0.42) saturate(0.85) contrast(1.05)',
    soft: 'blur(2px) brightness(1.08) saturate(1.12)',
  };

  const STAGE_COLOR_PRESETS = [
    '#ebe6dc',
    '#f4f0e8',
    '#faf8f4',
    '#ffffff',
    '#1c1916',
    '#2e2924',
    '#4a4038',
    '#8b7355',
    '#c9b896',
    '#d4c4a8',
    '#e8dcc8',
    '#7d6b5d',
    '#4a6741',
    '#2d5016',
    '#3d5a80',
    '#5c4033',
    '#8b1a1a',
    '#6b4c7a',
    '#c45c3e',
    '#e8c27a',
    '#b8c4ce',
    '#1a3a4a',
    '#f0e4d4',
    '#908880',
  ];

  /** 画板背景图原始宽高比，用于平移范围计算 */
  let stageBgImageAspect = 0;
  const STAGE_BG_MAX_SCALE = 2.6;
  const stageBgPointers = new Map();
  let stageBgDrag = null;
  let stageBgPinch = null;
  let stageBgLastTapAt = 0;
  let stageBgLastTapX = 0;
  let stageBgLastTapY = 0;
  let stageBgSuppressDblClick = false;
  /** @type {null | { setValue: (v: number, silent?: boolean) => void }} */
  let stageOpacityCtl = null;

  const stageBgState = {
    color: '#232327',
    imageUrl: null,
    fit: { x: 50, y: 50, scale: 1 },
    opacity: 1,
    stylize: 'none',
  };

  let stageOpen = false;
  let stageCloseTimer = 0;
  let exportSheetOpen = false;
  let exportCloseTimer = 0;
  let publishSheetOpen = false;
  let publishCloseTimer = 0;
  let exportBusy = false;

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

  const DEFAULT_PHOTO_FIT = { x: 50, y: 50, scale: 1 };

  function clampPct(n) {
    return Math.min(100, Math.max(0, n));
  }

  /** cover + scale 下各轴是否还有可平移余量 */
  function photoPanAxes(slot, fit, imageAspect) {
    const frameR = frameAspectRatio(slot);
    if (!Number.isFinite(imageAspect) || imageAspect <= 0 || !Number.isFinite(frameR) || frameR <= 0) {
      return { canPanX: false, canPanY: false };
    }
    const R = imageAspect / frameR;
    const S = fit.scale > 0 ? fit.scale : 1;
    const eps = 1.002;
    return {
      canPanX: R * S > eps,
      canPanY: S / R > eps,
    };
  }

  function clampPhotoFit(slot, fit, imageAspect) {
    const { canPanX, canPanY } = photoPanAxes(slot, fit, imageAspect);
    return {
      x: canPanX ? clampPct(fit.x) : 50,
      y: canPanY ? clampPct(fit.y) : 50,
      scale: Math.min(2.6, Math.max(1, fit.scale || 1)),
    };
  }

  function slotImageAspect(slot) {
    if (photoAspect[slot] > 0) return photoAspect[slot];
    return frameAspectRatio(slot);
  }

  function ensurePhotoAspect(slot) {
    if (photoAspect[slot] > 0) return Promise.resolve(photoAspect[slot]);
    const url = customPhotos[slot];
    if (!url) return Promise.resolve(frameAspectRatio(slot));
    return loadImageAspect(url).then((a) => {
      photoAspect[slot] = a;
      return a;
    });
  }

  function getPhotoFit(slot) {
    const f = photoFit[slot];
    const raw = {
      x: Number.isFinite(f && f.x) ? f.x : DEFAULT_PHOTO_FIT.x,
      y: Number.isFinite(f && f.y) ? f.y : DEFAULT_PHOTO_FIT.y,
      scale: Number.isFinite(f && f.scale) ? f.scale : DEFAULT_PHOTO_FIT.scale,
    };
    return clampPhotoFit(slot, raw, slotImageAspect(slot));
  }

  function setPhotoFit(slot, partial) {
    const merged = Object.assign({}, getPhotoFit(slot), partial);
    photoFit[slot] = clampPhotoFit(slot, merged, slotImageAspect(slot));
  }

  function resetPhotoFit(slot) {
    delete photoFit[slot];
  }

  function clearPhotoSlot(slot) {
    delete customPhotos[slot];
    resetPhotoFit(slot);
    delete photoAspect[slot];
  }

  function applyFitToImg(img, fit) {
    if (!img) return;
    img.style.objectFit = 'cover';
    img.style.objectPosition = `${fit.x}% ${fit.y}%`;
    img.style.transform = `scale(${fit.scale})`;
    img.style.transformOrigin = `${fit.x}% ${fit.y}%`;
  }

  function getTicketRoot() {
    const dom = ticketHost.querySelector('.ticket-dom');
    if (dom && dom.firstElementChild) return dom.firstElementChild;
    return ticketHost.firstElementChild;
  }

  function paperParams() {
    const base = window.TicketPaper && TicketPaper.PRESETS[paperPreset];
    return {
      preset: paperPreset,
      grain: paperGrain,
      curl: paperCurl,
      light: paperLight,
      warmth: base ? base.warmth : 0.1,
      specular: base ? base.specular : 0.22,
    };
  }

  function ensurePaperGl() {
    if (!window.TicketPaper) return null;
    if (!paperGl) paperGl = TicketPaper.attach(ticketHost);
    return paperGl;
  }

  function prepareCloneForRaster(node) {
    const clip = node.cloneNode(true);
    clip.style.transform = '';
    // 纸感模式下 .ticket-dom 是 visibility:hidden，克隆出去光栅化会是一片空白
    clip.style.visibility = 'visible';
    clip.classList.remove('is-fx-editing');
    clip.removeAttribute('data-fx-target');
    clip.querySelectorAll('.ufx-item.is-selected, .fx-user-slot.is-active-target').forEach((n) => {
      n.classList.remove('is-selected', 'is-active-target');
    });
    if (fxDraft) {
      clip.querySelectorAll(`[data-fx-id="${fxDraft.id}"]`).forEach((n) => n.remove());
    }
    return clip;
  }

  function schedulePaperRender() {
    if (paperPresentMode !== 'paper3d' || !window.TicketPaper) return;
    if (paperRenderTimer) clearTimeout(paperRenderTimer);
    paperRenderTimer = setTimeout(() => {
      paperRenderTimer = 0;
      runPaperRender();
    }, TicketPaper.DEBOUNCE_MS || 250);
  }

  async function runPaperRender() {
    if (paperPresentMode !== 'paper3d' || !window.htmlToImage) return;
    const gl = ensurePaperGl();
    const ticket = getTicketRoot();
    if (!gl || !ticket) return;

    const gen = ++paperRenderGen;
    let busyTimer = setTimeout(() => gl.setBusy(true), 200);

    const stage = document.createElement('div');
    stage.className = 'export-stage';
    const clip = prepareCloneForRaster(ticket);
    // 纸感预览也走同一套光栅化，所以同样要先把多层镂空压平
    flattenMasks(clip);
    stage.appendChild(clip);
    document.body.appendChild(stage);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const pr = Math.min(1.75, Math.max(1, window.devicePixelRatio || 1));
      const canvas = await TicketPaper.rasterizeNode(stage.firstElementChild, htmlToImage, pr);
      if (gen !== paperRenderGen) return;
      gl.setParams(paperParams());
      gl.updateFromCanvas(canvas);
      gl.show();
      ticketHost.classList.remove('is-paper-fallback');
    } catch (err) {
      console.error('纸感渲染失败', err);
      ticketHost.classList.add('is-paper-fallback');
      gl.hide();
    } finally {
      clearTimeout(busyTimer);
      gl.setBusy(false);
      stage.remove();
      requestAnimationFrame(() => fitTicket(false));
    }
  }

  function photoFitImgsForSlot(slot) {
    const imgs = [];
    if (photoAdjustImg && slot === adjustSlot) imgs.push(photoAdjustImg);
    const ticket = getTicketRoot();
    if (ticket) {
      ticket.querySelectorAll(`.photo-frame[data-photo-slot="${slot}"] .photo-img`).forEach((img) => {
        imgs.push(img);
      });
    }
    return imgs;
  }

  function clearPhotoFitAnim(imgs) {
    imgs.forEach((img) => img.classList.remove('is-photo-fit-anim'));
  }

  function animatePhotoFitForSlot(slot, targetPartial) {
    const from = getPhotoFit(slot);
    const merged = clampPhotoFit(
      slot,
      Object.assign({}, from, targetPartial),
      slotImageAspect(slot)
    );
    const imgs = photoFitImgsForSlot(slot);
    clearPhotoFitAnim(imgs);
    imgs.forEach((img) => applyFitToImg(img, from));

    const isRest =
      merged.scale <= 1.02 && Math.abs(merged.x - 50) < 1.5 && Math.abs(merged.y - 50) < 1.5;
    if (isRest) delete photoFit[slot];
    else photoFit[slot] = merged;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        imgs.forEach((img) => {
          img.classList.add('is-photo-fit-anim');
          applyFitToImg(img, merged);
        });
        window.setTimeout(() => {
          clearPhotoFitAnim(imgs);
          schedulePaperRender();
        }, 340);
      });
    });
  }

  function applyPhotoFit(ticket) {
    if (!ticket) return;
    ticket.querySelectorAll('.photo-frame').forEach((frame) => {
      const img = frame.querySelector('.photo-img');
      if (!img) return;
      const slot = Number(frame.dataset.photoSlot);
      const si = Number.isFinite(slot) ? slot : 0;
      applyFitToImg(img, getPhotoFit(si));
    });
  }

  function photoFrameAspect(slot) {
    const ticket = getTicketRoot();
    if (!ticket) return '1 / 1';
    const frame =
      ticket.querySelector(`.photo-frame[data-photo-slot="${slot}"]`) ||
      ticket.querySelectorAll('.photo-frame')[slot];
    if (!frame) return '1 / 1';
    const cs = getComputedStyle(frame);
    if (cs.aspectRatio && cs.aspectRatio !== 'auto') return cs.aspectRatio;
    const r = frame.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return `${r.width} / ${r.height}`;
    return '1 / 1';
  }

  function parseAspectRatioValue(arStr) {
    if (!arStr) return 1;
    const parts = String(arStr)
      .split('/')
      .map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1];
    const n = parseFloat(arStr);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function frameAspectRatio(slot) {
    return parseAspectRatioValue(photoFrameAspect(slot));
  }

  function layoutPhotoAdjustViewport() {
    if (!photoAdjustViewport) return;
    const ratio = frameAspectRatio(adjustSlot);
    const body = photoAdjustViewport.closest('.photo-adjust-body');
    const maxW = Math.min(body ? body.clientWidth - 4 : 320, 360);
    const maxH = Math.min(window.innerHeight * 0.36, 280);
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    photoAdjustViewport.style.width = `${Math.max(120, Math.round(w))}px`;
    photoAdjustViewport.style.height = `${Math.max(80, Math.round(h))}px`;
  }

  function loadImageAspect(dataUrl) {
    return new Promise((resolve, reject) => {
      const probe = new Image();
      probe.onload = () => {
        if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
          resolve(probe.naturalWidth / probe.naturalHeight);
        } else {
          reject(new Error('bad image'));
        }
      };
      probe.onerror = () => reject(new Error('load fail'));
      probe.src = dataUrl;
    });
  }

  /** 图片与票框宽高比差异明显时需要构图 */
  function needsPhotoCompose(slot, imageAspect) {
    const frameR = frameAspectRatio(slot);
    if (!Number.isFinite(imageAspect) || imageAspect <= 0) return false;
    const rel = Math.abs(Math.log(imageAspect / frameR));
    return rel > 0.14;
  }

  function syncPhotoAdjustPreview() {
    if (!photoAdjustViewport || !photoAdjustImg) return;
    layoutPhotoAdjustViewport();
    photoAdjustImg.src = activePhotos()[adjustSlot] || '';
    applyFitToImg(photoAdjustImg, getPhotoFit(adjustSlot));
  }

  function syncPhotoAdjustFromFit() {
    syncPhotoAdjustPreview();
    applyPhotoFit(getTicketRoot());
    schedulePaperRender();
  }

  function openPhotoSheet(slot) {
    if (!photoSheet || photoOpen) return;
    if (fieldsOpen) closeFieldsSheet();
    if (fxOpen) closeFxSheet();
    adjustSlot = slot;
    activePickSlot = slot;
    if (photoCloseTimer) {
      clearTimeout(photoCloseTimer);
      photoCloseTimer = 0;
    }
    photoOpen = true;
    const panel = photoSheet.querySelector('.photo-panel');
    if (photoSheetTitle) {
      const n = Kit.photoSlotCount(styleId);
      photoSheetTitle.textContent = n > 1 ? `调整构图 · 图 ${slot + 1}` : '调整构图';
    }
    syncPhotoAdjustPreview();
    ensurePhotoAspect(slot).then(() => {
      setPhotoFit(slot, getPhotoFit(slot));
      syncPhotoAdjustFromFit();
    });
    setSheetPush(panel, true);
    photoSheet.classList.remove('is-closing');
    photoSheet.classList.add('is-open');
    photoSheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('photo-open');
    document.documentElement.classList.add('photo-open');
    resetTilt();
    if (window.lucide) lucide.createIcons({ nodes: [photoSheet] });
  }

  function closePhotoSheet() {
    if (!photoSheet || !photoSheet.classList.contains('is-open')) return;
    photoOpen = false;
    photoDrag = null;
    photoPinch = null;
    photoPointers.clear();
    photoLastTapAt = 0;
    photoSuppressDblClick = false;
    if (photoAdjustViewport) photoAdjustViewport.classList.remove('is-dragging');
    setSheetPush(null, false);
    photoSheet.classList.add('is-closing');
    photoSheet.classList.remove('is-open');
    if (photoCloseTimer) clearTimeout(photoCloseTimer);
    photoCloseTimer = setTimeout(() => {
      photoCloseTimer = 0;
      photoSheet.classList.remove('is-closing');
      photoSheet.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('photo-open');
      document.documentElement.classList.remove('photo-open');
    }, 340);
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
          <button type="button" class="photo-slot-btn photo-slot-btn--thumb" data-adjust="${i}" aria-label="调整构图">
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

  /** 画板留白比例：以票根长边为基准，四周等宽。
      0.10 → 票根长边约占画板的 83%，短边约 70%，
      像「裱在画框里」，既能看到背景又不会显得空。 */
  const STAGE_FRAME_PAD = 0.1;

  function stageFramePad(w, h) {
    return Math.max(w, h) * STAGE_FRAME_PAD;
  }

  /** 画板宽高比 =「票根 + 四周等宽留白」的外框比例。
      这样预览/导出画面既有票根的形，又能露出一圈背景；
      只依赖票根固有尺寸，所以 sheet 顶起时不会变。 */
  function layoutStageArtboard() {
    if (!ticketHost) return;
    const w = Number(ticketHost.dataset.natW) || 0;
    const h = Number(ticketHost.dataset.natH) || 0;
    if (w <= 0 || h <= 0) return;
    const p = stageFramePad(w, h);
    const ar = (w + p * 2) / (h + p * 2);
    document.documentElement.style.setProperty('--stage-ar', ar.toFixed(4));

    // 画板尺寸的基线层：容器查询（cqw/cqh）不可用时 CSS 会退回这两个变量，
    // 所以这里顺手把 px 值也算好（现代内核里仍以 cqw/cqh 为准）
    const panelW = stagePanel ? stagePanel.clientWidth : 0;
    const panelH = stagePanel ? stagePanel.clientHeight : 0;
    if (panelW > 0 && panelH > 0) {
      const bw = Math.min(panelW, panelH * ar);
      const bh = Math.min(panelH, panelW / ar);
      document.documentElement.style.setProperty('--stage-w', `${bw.toFixed(2)}px`);
      document.documentElement.style.setProperty('--stage-h', `${bh.toFixed(2)}px`);
    }
  }

  /* 内置样图是包内相对路径，而导出用的光栅化库靠 fetch 把资源内联成 data:（离线容器不保证取得到），
     所以启动后把它们统一读成 data URL 写回 DEFAULT_PHOTOS：
     之后预览与导出都只用内存地址，不再依赖运行时取文件。
     读不到（例如画布被污染）就保留原路径，行为与现在一致。 */
  function localizeDefaultPhotos() {
    const map = Kit.DEFAULT_PHOTOS;
    if (!map) return;
    const keys = Object.keys(map).filter((k) => map[k] && map[k].indexOf('data:') !== 0);
    if (!keys.length) return;
    let rest = keys.length;
    const done = () => {
      rest -= 1;
      if (rest === 0) {
        renderAll();
        fitTicket(true);
      }
    };
    keys.forEach((k) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          map[k] = c.toDataURL('image/jpeg', 0.92);
        } catch (_) {
          /* 跨源污染等情况：保留原始路径 */
        }
        done();
      };
      img.onerror = done;
      img.src = map[k];
    });
  }

  let pushPanel = null;
  let pushObserver = null;

  /** 面板高度可能在过渡中才稳定（图片/换行/dvh 变化），
      所以在 340ms 后再量一次，并用 ResizeObserver 持续兜底，
      保证预览区底边始终贴着 sheet 顶边 */
  function applySheetPushHeight() {
    if (!pushPanel) return;
    const h = Math.max(0, Math.round(pushPanel.offsetHeight));
    document.documentElement.style.setProperty('--sheet-push', `${h}px`);
    fitTicket(false);
  }

  function watchPushPanel(panel) {
    if (pushObserver) {
      pushObserver.disconnect();
      pushObserver = null;
    }
    if (!panel || !window.ResizeObserver) return;
    pushObserver = new ResizeObserver(() => {
      if (!pushPanel) return;
      applySheetPushHeight();
    });
    pushObserver.observe(panel);
  }

  function setSheetPush(panel, on) {
    if (pushFitTimer) {
      clearTimeout(pushFitTimer);
      pushFitTimer = 0;
    }
    if (!on || !panel) {
      pushPanel = null;
      watchPushPanel(null);
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
    pushPanel = panel;
    // offsetHeight 不受 transform 影响，开启动画前就能定高
    document.documentElement.style.setProperty(
      '--sheet-push',
      `${Math.max(0, Math.round(panel.offsetHeight))}px`
    );
    document.body.classList.add('is-sheet-push');
    void document.body.offsetHeight;
    fitTicket(false);
    watchPushPanel(panel);
    pushFitTimer = setTimeout(() => {
      pushFitTimer = 0;
      applySheetPushHeight();
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

  function mountUiRange(wrap, opts) {
    const track = wrap.querySelector('.ui-range-track');
    const fill = wrap.querySelector('.ui-range-fill');
    const thumb = wrap.querySelector('.ui-range-thumb');
    if (!track || !fill || !thumb) return null;
    const min = opts.min;
    const max = opts.max;
    let value = opts.value;

    function clamp(v) {
      return Math.max(min, Math.min(max, v));
    }

    function render() {
      const span = max - min || 1;
      const t = (value - min) / span;
      const p = t * 100;
      fill.style.width = `${p}%`;
      // 圆点位置交给 CSS 用比例变量算：轨道两侧有留白，圆点走的是轨道内容区
      wrap.style.setProperty('--ui-range-p', String(t));
      thumb.setAttribute('aria-valuenow', String(Math.round(value)));
      thumb.setAttribute('aria-valuemin', String(min));
      thumb.setAttribute('aria-valuemax', String(max));
    }

    function setValue(v, silent) {
      value = clamp(v);
      render();
      if (!silent && opts.onInput) opts.onInput(value);
    }

    /** 拖拽期间轨道 rect 兜底：极端情况下（行被隐藏/布局塌陷）rect 会变成 0 宽，
        此时用上一次的有效 rect，避免把值算成最小值 */
    let lastTrackRect = null;

    function valueFromClientX(clientX) {
      const rect = track.getBoundingClientRect();
      const use = rect.width > 0 ? rect : lastTrackRect;
      if (rect.width > 0) lastTrackRect = rect;
      if (!use || use.width <= 0) return;
      const t = (clientX - use.left) / use.width;
      // 注意：这里必须用归一化的 0~1 夹取，
      // 不能复用上面的 clamp()（它按 min/max 夹取，会把比例变成 5 导致滑条永远卡在最大值）
      const nt = Math.min(1, Math.max(0, t));
      setValue(min + nt * (max - min));
    }

    /** pointer / touch / mouse 三套事件都挂上：
        某些 WebView / 旧浏览器不派发 PointerEvent，
        只靠 pointerdown 会导致滑条完全拖不动。 */
    let dragging = false;
    let dragSource = null; // 'pointer' | 'touch' | 'mouse'
    let dragKey = null; // pointerId 或 touch identifier

    function touchClientX(list, key) {
      if (!list) return null;
      for (let i = 0; i < list.length; i += 1) {
        if (list[i].identifier === key) return list[i].clientX;
      }
      return null;
    }

    function onDocPointerMove(e) {
      if (dragSource !== 'pointer' || e.pointerId !== dragKey) return;
      if (e.cancelable) e.preventDefault();
      valueFromClientX(e.clientX);
    }

    function onDocPointerUp(e) {
      if (dragSource !== 'pointer' || e.pointerId !== dragKey) return;
      endDrag();
    }

    function onDocTouchMove(e) {
      if (dragSource !== 'touch') return;
      const x = touchClientX(e.touches, dragKey);
      if (x == null) return;
      if (e.cancelable) e.preventDefault();
      valueFromClientX(x);
    }

    function onDocTouchEnd(e) {
      if (dragSource !== 'touch') return;
      if (touchClientX(e.changedTouches, dragKey) == null && touchClientX(e.touches, dragKey) == null) {
        return;
      }
      endDrag();
    }

    function onDocMouseMove(e) {
      if (dragSource !== 'mouse') return;
      e.preventDefault();
      valueFromClientX(e.clientX);
    }

    function onDocMouseUp() {
      if (dragSource !== 'mouse') return;
      endDrag();
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      dragSource = null;
      dragKey = null;
      document.removeEventListener('pointermove', onDocPointerMove, true);
      document.removeEventListener('pointerup', onDocPointerUp, true);
      document.removeEventListener('pointercancel', onDocPointerUp, true);
      document.removeEventListener('touchmove', onDocTouchMove, true);
      document.removeEventListener('touchend', onDocTouchEnd, true);
      document.removeEventListener('touchcancel', onDocTouchEnd, true);
      document.removeEventListener('mousemove', onDocMouseMove, true);
      document.removeEventListener('mouseup', onDocMouseUp, true);
      window.removeEventListener('blur', endDrag);
    }

    function beginDrag(source, key, clientX) {
      // 自愈：万一上一轮拖拽状态残留，先复位再开始，避免滑条永久失效
      if (dragging) endDrag();
      dragging = true;
      dragSource = source;
      dragKey = key;
      valueFromClientX(clientX);
      document.addEventListener('pointermove', onDocPointerMove, true);
      document.addEventListener('pointerup', onDocPointerUp, true);
      document.addEventListener('pointercancel', onDocPointerUp, true);
      document.addEventListener('touchmove', onDocTouchMove, { capture: true, passive: false });
      document.addEventListener('touchend', onDocTouchEnd, true);
      document.addEventListener('touchcancel', onDocTouchEnd, true);
      document.addEventListener('mousemove', onDocMouseMove, true);
      document.addEventListener('mouseup', onDocMouseUp, true);
      window.addEventListener('blur', endDrag);
    }

    wrap.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (dragging) return;
        if (e.cancelable) e.preventDefault();
        // 指针捕获 + document 兜底：手指/鼠标移出滑条也能继续拖
        try {
          wrap.setPointerCapture(e.pointerId);
        } catch (_) {
          /* ignore */
        }
        beginDrag('pointer', e.pointerId, e.clientX);
      },
      { passive: false }
    );

    wrap.addEventListener(
      'touchstart',
      (e) => {
        if (dragging) return;
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        if (e.cancelable) e.preventDefault();
        beginDrag('touch', t.identifier, t.clientX);
      },
      { passive: false }
    );

    wrap.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (dragging) return;
      e.preventDefault();
      beginDrag('mouse', null, e.clientX);
    });

    render();
    return {
      setValue,
      getValue: () => value,
    };
  }

  function syncStageColorChips() {
    if (!stageColorGrid) return;
    const cur = stageBgState.color.toLowerCase();
    stageColorGrid.querySelectorAll('[data-color]').forEach((btn) => {
      const on = btn.dataset.color.toLowerCase() === cur;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (stageColorValue) stageColorValue.textContent = stageBgState.color.toUpperCase();
  }

  function buildStageColorGrid() {
    if (!stageColorGrid || stageColorGrid.dataset.ready) return;
    stageColorGrid.dataset.ready = '1';
    stageColorGrid.innerHTML = STAGE_COLOR_PRESETS.map(
      (c) =>
        `<button type="button" class="stage-color-chip" data-color="${c}" style="background-color:${c}" aria-label="${c}" role="option"></button>`
    ).join('');
    stageColorGrid.querySelectorAll('[data-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stageBgState.color = btn.dataset.color || stageBgState.color;
        applyStageBg();
        syncStageSheetUI();
      });
    });
  }

  function pickStageBgFile() {
    if (stageBgInput) {
      stageBgInput.value = '';
      stageBgInput.click();
    }
  }

  function clearStageBgImage() {
    stageBgState.imageUrl = null;
    stageBgState.fit = { x: 50, y: 50, scale: 1 };
    stageBgState.opacity = 1;
    stageBgState.stylize = 'none';
    stageBgImageAspect = 0;
    stageBgPointers.clear();
    stageBgDrag = null;
    stageBgPinch = null;
    applyStageBg();
    syncStageSheetUI();
  }

  function syncStageMedia() {
    const url = stageBgState.imageUrl;
    const has = !!url;
    if (stageMediaEmpty) stageMediaEmpty.classList.toggle('is-hidden', has);
    if (stageMediaFilled) stageMediaFilled.classList.toggle('is-hidden', !has);
    // 缩略图底色跟画板一致，拖透明度时能直接看到「透出底色」的效果
    if (stageBgViewport) stageBgViewport.style.backgroundColor = stageBgState.color;
    if (stageMediaImg) {
      if (url) {
        if (stageMediaImg.getAttribute('src') !== url) stageMediaImg.src = url;
      } else {
        stageMediaImg.removeAttribute('src');
      }
      // 与画板保持完全一致：透明度 + 风格化滤镜都要应用到缩略图
      stageMediaImg.style.opacity = String(stageBgState.opacity);
      stageMediaImg.style.filter = STAGE_STYLE_FILTERS[stageBgState.stylize] || '';
    }
  }

  /** 画板固定比例（与预览区、导出画面一致），不从实时 rect 取，避免过渡中读到中间值 */
  function stageArtboardRatioValue() {
    const raw = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--stage-ar')
    );
    if (Number.isFinite(raw) && raw > 0) return Math.min(3, Math.max(0.34, raw));
    return 16 / 10;
  }

  function stageBgFrameRatio() {
    return stageArtboardRatioValue();
  }

  function stageBgPanAxes(fit) {
    const frameR = stageBgFrameRatio();
    const ar = stageBgImageAspect > 0 ? stageBgImageAspect : frameR;
    const R = ar / frameR;
    const S = fit.scale > 0 ? fit.scale : 1;
    const eps = 1.002;
    return { canPanX: R * S > eps, canPanY: S / R > eps };
  }

  function clampStageBgFit(fit) {
    const { canPanX, canPanY } = stageBgPanAxes(fit);
    return {
      x: canPanX ? clampPct(fit.x) : 50,
      y: canPanY ? clampPct(fit.y) : 50,
      scale: Math.min(STAGE_BG_MAX_SCALE, Math.max(1, fit.scale || 1)),
    };
  }

  function getStageBgFit() {
    return clampStageBgFit(stageBgState.fit);
  }

  function applyStageBgFit() {
    stageBgState.fit = clampStageBgFit(stageBgState.fit);
    applyFitToImg(stageBgImg, stageBgState.fit);
    applyFitToImg(stageMediaImg, stageBgState.fit);
  }

  function setStageBgFit(partial) {
    stageBgState.fit = clampStageBgFit(Object.assign({}, getStageBgFit(), partial));
    applyStageBgFit();
  }

  let stageBgFitAnimTimer = 0;

  function clearStageBgFitAnim() {
    if (stageBgFitAnimTimer) {
      clearTimeout(stageBgFitAnimTimer);
      stageBgFitAnimTimer = 0;
    }
    if (stageBgImg) stageBgImg.classList.remove('is-bg-fit-anim');
    if (stageMediaImg) stageMediaImg.classList.remove('is-bg-fit-anim');
  }

  /** 双击缩放专用：先落到起点，下一帧再加过渡切到终点。
      直接 setStageBgFit 是瞬移（双击会「跳」一下），
      而拖拽/捏合必须保持无过渡的跟手感，所以动画只在这一处开 */
  function animateStageBgFit(partial) {
    const from = getStageBgFit();
    const to = clampStageBgFit(Object.assign({}, from, partial));
    const imgs = [stageBgImg, stageMediaImg].filter(Boolean);
    if (!imgs.length) {
      setStageBgFit(to);
      return;
    }
    clearStageBgFitAnim();
    imgs.forEach((img) => applyFitToImg(img, from));
    stageBgState.fit = to;
    // 同一帧里改样式不会产生起点，必须等一帧让起点真实上屏
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        imgs.forEach((img) => {
          img.classList.add('is-bg-fit-anim');
          applyFitToImg(img, to);
        });
        stageBgFitAnimTimer = setTimeout(clearStageBgFitAnim, 360);
      });
    });
  }

  function isStageBgRestState() {
    const f = getStageBgFit();
    return f.scale <= 1.02 && Math.abs(f.x - 50) < 1.5 && Math.abs(f.y - 50) < 1.5;
  }

  function stageBgPointerDistance() {
    const pts = [...stageBgPointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function beginStageBgPinch() {
    const dist = stageBgPointerDistance();
    if (dist < 6) return;
    // 手指落下就结束双击动画，捏合必须即时跟手
    clearStageBgFitAnim();
    stageBgDrag = null;
    stageBgPinch = { startDist: dist, origScale: getStageBgFit().scale };
  }

  function beginStageBgPan(e) {
    clearStageBgFitAnim();
    const fit = getStageBgFit();
    const axes = stageBgPanAxes(fit);
    stageBgDrag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: fit.x,
      origY: fit.y,
      canPanX: axes.canPanX,
      canPanY: axes.canPanY,
      rect: stageBgViewport.getBoundingClientRect(),
      moved: 0,
    };
    stageBgViewport.classList.add('is-dragging');
  }

  function toggleStageBgDoubleZoom(clientX, clientY) {
    if (isStageBgRestState()) {
      const rect = stageBgViewport.getBoundingClientRect();
      let x = 50;
      let y = 50;
      if (rect.width > 0 && rect.height > 0) {
        x = clampPct(((clientX - rect.left) / rect.width) * 100);
        y = clampPct(((clientY - rect.top) / rect.height) * 100);
      }
      animateStageBgFit({ scale: PHOTO_DOUBLE_ZOOM, x, y });
    } else {
      animateStageBgFit({ scale: 1, x: 50, y: 50 });
    }
  }

  function tryStageBgDoubleTap(clientX, clientY) {
    const now = Date.now();
    const dt = now - stageBgLastTapAt;
    const dist = Math.hypot(clientX - stageBgLastTapX, clientY - stageBgLastTapY);
    if (dt > 0 && dt < PHOTO_DOUBLE_TAP_MS && dist < PHOTO_DOUBLE_TAP_PX * 2.5) {
      stageBgLastTapAt = 0;
      stageBgSuppressDblClick = true;
      toggleStageBgDoubleZoom(clientX, clientY);
      return;
    }
    stageBgLastTapAt = now;
    stageBgLastTapX = clientX;
    stageBgLastTapY = clientY;
  }

  function applyStageBg() {
    if (stageBgEl) stageBgEl.style.backgroundColor = stageBgState.color;
    const has = !!stageBgState.imageUrl;
    if (stageBgControls) stageBgControls.classList.toggle('is-hidden', !has);
    if (stageStyleField) stageStyleField.classList.toggle('is-hidden', !has);
    if (!stageBgImg) return;
    if (has) {
      // 之前空背景图时会把 <img> 从画板里摘掉（避免光栅化失败），这里补回去
      if (stageBgEl && !stageBgImg.parentNode) stageBgEl.appendChild(stageBgImg);
      stageBgImg.hidden = false;
      if (stageBgImg.getAttribute('src') !== stageBgState.imageUrl) {
        stageBgImg.src = stageBgState.imageUrl;
      }
      stageBgImg.style.opacity = String(stageBgState.opacity);
      stageBgImg.style.filter = STAGE_STYLE_FILTERS[stageBgState.stylize] || '';
      applyStageBgFit();
    } else {
      // 没有背景图时把 <img> 整个摘掉，而不是只 hidden + 去掉 src：
      // 没有 src 的空 <img> 会让光栅化库抛 Event，导出「预览画面」直接整体失败
      // （表现就是点了导出没反应），所以它一秒都不能留在画板里
      if (stageBgImg.parentNode) stageBgImg.parentNode.removeChild(stageBgImg);
    }
  }

  function syncStageSheetUI() {
    syncStageColorChips();
    syncStageMedia();
    if (stageOpacityCtl) stageOpacityCtl.setValue(Math.round(stageBgState.opacity * 100), true);
    const seg = $('stageStyleSeg');
    if (seg) {
      seg.querySelectorAll('[data-stage-style]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.stageStyle === stageBgState.stylize);
      });
    }
  }

  function openStageSheet() {
    if (!stageSheet || stageOpen) return;
    if (photoOpen) closePhotoSheet();
    if (exportSheetOpen) closeExportSheet();
    if (publishSheetOpen) closePublishSheet();
    buildStageColorGrid();
    if (stageCloseTimer) {
      clearTimeout(stageCloseTimer);
      stageCloseTimer = 0;
    }
    stageOpen = true;
    syncStageSheetUI();
    applyStageBgFit();
    const panel = stageSheet.querySelector('.fields-panel');
    stageSheet.classList.remove('is-closing');
    stageSheet.classList.add('is-open');
    stageSheet.setAttribute('aria-hidden', 'false');
    if (stageBtn) stageBtn.classList.add('is-active');
    document.body.classList.add('stage-open');
    document.documentElement.classList.add('stage-open');
    setSheetPush(panel, true);
    if (window.lucide) lucide.createIcons({ nodes: [stageSheet] });
  }

  function closeStageSheet() {
    if (!stageSheet || !stageSheet.classList.contains('is-open')) return;
    stageOpen = false;
    stageBgDrag = null;
    stageBgPinch = null;
    stageBgPointers.clear();
    if (stageBgViewport) stageBgViewport.classList.remove('is-dragging');
    if (stageBtn) stageBtn.classList.remove('is-active');
    setSheetPush(null, false);
    stageSheet.classList.add('is-closing');
    stageSheet.classList.remove('is-open');
    if (stageCloseTimer) clearTimeout(stageCloseTimer);
    stageCloseTimer = setTimeout(() => {
      stageCloseTimer = 0;
      stageSheet.classList.remove('is-closing');
      stageSheet.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('stage-open');
      document.documentElement.classList.remove('stage-open');
    }, 340);
  }

  function openExportSheet() {
    if (!exportSheet || exportSheetOpen || exportBusy) return;
    if (publishSheetOpen) closePublishSheet();
    if (exportCloseTimer) {
      clearTimeout(exportCloseTimer);
      exportCloseTimer = 0;
    }
    exportSheetOpen = true;
    const panel = exportSheet.querySelector('.fields-panel');
    exportSheet.classList.remove('is-closing');
    exportSheet.classList.add('is-open');
    exportSheet.setAttribute('aria-hidden', 'false');
    setSheetPush(panel, true);
    if (window.lucide) lucide.createIcons({ nodes: [exportSheet] });
  }

  function closeExportSheet() {
    if (!exportSheet || !exportSheet.classList.contains('is-open')) return;
    exportSheetOpen = false;
    setSheetPush(null, false);
    exportSheet.classList.add('is-closing');
    exportSheet.classList.remove('is-open');
    if (exportCloseTimer) clearTimeout(exportCloseTimer);
    exportCloseTimer = setTimeout(() => {
      exportCloseTimer = 0;
      exportSheet.classList.remove('is-closing');
      exportSheet.setAttribute('aria-hidden', 'true');
    }, 340);
  }

  function openPublishSheet() {
    if (!publishSheet || publishSheetOpen || exportBusy) return;
    if (exportSheetOpen) closeExportSheet();
    if (publishCloseTimer) {
      clearTimeout(publishCloseTimer);
      publishCloseTimer = 0;
    }
    publishSheetOpen = true;
    const panel = publishSheet.querySelector('.fields-panel');
    publishSheet.classList.remove('is-closing');
    publishSheet.classList.add('is-open');
    publishSheet.setAttribute('aria-hidden', 'false');
    setSheetPush(panel, true);
    if (window.lucide) lucide.createIcons({ nodes: [publishSheet] });
  }

  function closePublishSheet() {
    if (!publishSheet || !publishSheet.classList.contains('is-open')) return;
    publishSheetOpen = false;
    setSheetPush(null, false);
    publishSheet.classList.add('is-closing');
    publishSheet.classList.remove('is-open');
    if (publishCloseTimer) clearTimeout(publishCloseTimer);
    publishCloseTimer = setTimeout(() => {
      publishCloseTimer = 0;
      publishSheet.classList.remove('is-closing');
      publishSheet.setAttribute('aria-hidden', 'true');
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

  /** 当前票根所属分类：打开面板时用它对齐 tab，
      同时给那个 tab 标一个小圆点（用户可能正在浏览别的分类） */
  function catIdOfStyle(id) {
    const found = Kit.CATEGORIES.find((c) => c.styles.some((s) => s.id === id));
    return found ? found.id : catId;
  }

  /** 把 child 滚到容器中间（横向用于 tab 条，纵向用于票根列表） */
  function centerChildIn(child, container, axis) {
    if (!child || !container) return;
    const box = container.getBoundingClientRect();
    const r = child.getBoundingClientRect();
    if (!box.height || !box.width) return;
    if (axis === 'y') {
      const top = container.scrollTop + (r.top - box.top) - (box.height - r.height) / 2;
      container.scrollTop = Math.max(0, top);
    } else {
      const left = container.scrollLeft + (r.left - box.left) - (box.width - r.width) / 2;
      container.scrollLeft = Math.max(0, left);
    }
  }

  function renderCats() {
    const curCat = catIdOfStyle(styleId);
    catTabs.innerHTML = Kit.CATEGORIES.map(
      (c) => `<button type="button" class="cat-tab${c.id === catId ? ' is-active' : ''}${c.id === curCat ? ' has-current' : ''}" data-cat="${c.id}"${
        c.id === catId ? ' aria-current="true"' : ''
      }>
        <i data-lucide="${c.icon}"></i><span>${c.tab || c.name}</span>
      </button>`
    ).join('');
    catTabs.querySelectorAll('.cat-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.cat === catId) return;
        // 只切换「正在浏览的分类」：当前选中的票根、已填的票面数据都不动
        catId = btn.dataset.cat;
        renderCats();
        renderStyleGrid();
      });
    });
    // 分类多到要横向滚动时，当前 tab 可能藏在视口外，滚出来
    centerChildIn(catTabs.querySelector('.cat-tab.is-active'), catTabs, 'x');
  }

  /* —— 缩略图：把真实票根渲染进小盒子，等比缩放居中 ——
     返回是否真正渲染成功：失败时清空内容（否则会留下一张未缩放的原始票根，
     被 .si-box 的 overflow 裁成一条横缝，看起来就是「票根显示异常」），
     并交给调用方稍后重试 */
  function mountThumb(host, sid, boxW, boxH, pad) {
    const fail = () => {
      host.style.width = '';
      host.style.height = '';
      host.innerHTML = '';
      return false;
    };
    const found = Kit.findStyle(sid);
    if (!found || !found.style || boxW < 8 || boxH < 8) return fail();
    const data = {};
    found.style.fields.forEach((f) => {
      data[f.key] = f.value;
    });

    host.style.width = '';
    host.style.height = '';
    host.innerHTML = Kit.renderTicket(sid, data);

    const ticket = host.firstElementChild;
    if (!ticket) return fail();

    // 缩略图只有 100px 高，闪粉层（mix-blend-mode + 噪点底图）在这里看不见，
    // 却会让每次滚动重绘都做一次全层混合，直接去掉
    ticket.querySelectorAll('.fx-layer').forEach((n) => n.remove());
    if (Fx) Fx.stripUserFx(ticket);

    const w = ticket.offsetWidth;
    const h = ticket.offsetHeight;
    if (!w || !h) return fail();

    const s = Math.min(boxW / w, boxH / h) * (pad == null ? 0.88 : pad);
    ticket.style.transformOrigin = 'top left';
    ticket.style.transform = `scale(${s})`;
    host.style.width = `${Math.ceil(w * s)}px`;
    host.style.height = `${Math.ceil(h * s)}px`;

    if (window.lucide) lucide.createIcons({ nodes: [host] });
    return true;
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
    if (!btn || btn.dataset.thumbDone === '2' || btn.dataset.thumbQueued === '1') return;
    btn.dataset.thumbQueued = '1';
    thumbQueue.push(btn);
    if (!thumbPump) thumbPump = setTimeout(pumpThumbs, 0);
  }

  function pumpThumbs() {
    thumbPump = 0;
    const t0 = performance.now();
    let again = false;
    // 每批最多占 6ms，剩下的交给下一帧，保证主线程始终有空处理滚动
    while (thumbQueue.length && performance.now() - t0 < 6) {
      const btn = thumbQueue.shift();
      btn.dataset.thumbQueued = '';
      const box = btn.querySelector('.si-box');
      const host = btn.querySelector('.si-host');
      if (!box || !host) continue;
      const ok = mountThumb(host, btn.dataset.style, box.clientWidth, box.clientHeight);
      if (ok) {
        btn.dataset.thumbDone = '2';
        btn.classList.add('has-thumb');
        continue;
      }
      // 尺寸还没量出来（sheet 刚打开/布局未稳定）时不要一次失败就永久放弃
      const tries = Number(btn.dataset.thumbTry || 0) + 1;
      btn.dataset.thumbTry = String(tries);
      if (tries < 8) {
        thumbQueue.push(btn);
        again = true;
      } else {
        btn.dataset.thumbDone = '2';
      }
    }
    if (thumbQueue.length) thumbPump = setTimeout(pumpThumbs, again ? 32 : 16);
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
    // 顶部栏标题固定，分类交给下面的 tab 表达（换分类时标题不再跳字）
    sheetTitle.textContent = '票根模板';
    styleGrid.scrollTop = 0;
    styleGrid.innerHTML = currentCat().styles
      .map(
        (s) => `<button type="button" class="style-item${s.id === styleId ? ' is-active' : ''}" data-style="${s.id}" role="option" aria-selected="${s.id === styleId}">
        <span class="si-box">
          <span class="si-host" aria-hidden="true"></span>
          <span class="si-cap">
            <span class="si-name">${s.name}</span>
            <span class="si-desc">${s.desc}</span>
          </span>
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
    scrollActiveStyleIntoView();
  }

  /** 列表滚到当前票根：打开面板时不用自己翻到它，
      面板高度是固定的（min(64dvh, 540px)），所以量一次就准 */
  function scrollActiveStyleIntoView() {
    const active = styleGrid.querySelector('.style-item.is-active');
    if (!active) return;
    // 面板刚打开的这一帧宽高可能还没落定，补一帧再量
    centerChildIn(active, styleGrid, 'y');
    requestAnimationFrame(() => centerChildIn(active, styleGrid, 'y'));
  }

  /** 只刷选中态，不重建列表：选中票根后 sheet 不关闭，重建会丢掉滚动位置和已渲染缩略图 */
  function syncStyleSelection() {
    styleGrid.querySelectorAll('.style-item').forEach((btn) => {
      const on = btn.dataset.style === styleId;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', String(on));
    });
  }

  function selectStyle(id) {
    const kept = [];
    const keptFit = [];
    const keptAspect = [];
    if (customPhotos[0]) kept[0] = customPhotos[0];
    if (customPhotos[1]) kept[1] = customPhotos[1];
    if (photoFit[0]) keptFit[0] = photoFit[0];
    if (photoFit[1]) keptFit[1] = photoFit[1];
    if (photoAspect[0]) keptAspect[0] = photoAspect[0];
    if (photoAspect[1]) keptAspect[1] = photoAspect[1];
    styleId = id;
    // 搜索结果可能来自别的分类：把 catId 对齐过去，
    // 否则 currentCat()/currentStyle() 会指回原分类（触发栏显示错的模板名）
    catId = catIdOfStyle(id);
    Object.keys(customPhotos).forEach((k) => delete customPhotos[k]);
    Object.keys(photoFit).forEach((k) => delete photoFit[k]);
    Object.keys(photoAspect).forEach((k) => delete photoAspect[k]);
    const slots = Kit.photoSlotCount(styleId);
    if (kept[0]) customPhotos[0] = kept[0];
    if (slots >= 2 && kept[1]) customPhotos[1] = kept[1];
    if (keptFit[0]) photoFit[0] = keptFit[0];
    if (slots >= 2 && keptFit[1]) photoFit[1] = keptFit[1];
    if (keptAspect[0]) photoAspect[0] = keptAspect[0];
    if (slots >= 2 && keptAspect[1]) photoAspect[1] = keptAspect[1];
    hydrateFieldsFromStyle(currentStyle(), false);
    // 选中后不关闭 sheet：用户可以连续对比不同票根，预览区实时跟着更新
    renderAll({ keepStyleGrid: true });
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
    // 打开时对齐到当前票根所在的分类（之后点 tab 只换浏览，不改选中）
    catId = catIdOfStyle(styleId);
    renderCats();
    renderStyleGrid();
    // 先渲染好列表再量高度：和其他 sheet 一样把预览区顶到面板上方
    setSheetPush(styleSheet.querySelector('.style-panel'), true);
    sheetClose.focus({ preventScroll: true });
  }

  function closeSheet() {
    if (!sheetOpen && !styleSheet.classList.contains('is-open')) return;
    if (styleSheet.classList.contains('is-closing')) return;
    sheetOpen = false;
    document.body.classList.remove('sheet-open');
    setSheetPush(null, false);
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
  if (styleScrim) styleScrim.addEventListener('click', closeSheet);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen) closeSheet();
    if (e.key === 'Escape' && fxOpen) closeFxSheet();
    if (e.key === 'Escape' && fieldsOpen) closeFieldsSheet();
    if (e.key === 'Escape' && photoOpen) closePhotoSheet();
    if (e.key === 'Escape' && stageOpen) closeStageSheet();
    if (e.key === 'Escape' && exportSheetOpen) closeExportSheet();
    if (e.key === 'Escape' && publishSheetOpen) closePublishSheet();
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
    return String(s == null ? '' : s)
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
    const html = Kit.renderTicket(styleId, ticketData(), activePhotos());
    if (paperPresentMode === 'paper3d' && window.TicketPaper) {
      ticketHost.classList.add('ticket-host--paper3d');
      ticketHost.innerHTML = `<div class="ticket-dom">${html}</div><div class="paper-gl-wrap" hidden><canvas class="paper-gl-canvas"></canvas><span class="paper-gl-busy" hidden>纸感渲染中…</span></div>`;
      if (paperGl) paperGl.dispose();
      paperGl = TicketPaper.attach(ticketHost);
      if (!paperGl) {
        ticketHost.classList.add('is-paper-fallback');
      } else {
        paperGl.show();
      }
    } else {
      ticketHost.classList.remove('ticket-host--paper3d', 'is-paper-fallback');
      ticketHost.innerHTML = html;
      if (paperGl) paperGl.hide();
    }
    delete ticketHost.dataset.natW;
    delete ticketHost.dataset.natH;
    applyUserFx();
    applyPhotoFit(getTicketRoot());
    if (window.lucide) lucide.createIcons({ nodes: [ticketHost] });
    requestAnimationFrame(() => fitTicket(true));
    schedulePaperRender();
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
    const ticket = getTicketRoot();
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
        if (fxTab === 'material') {
          refreshFxUI();
          return;
        }
        if (fxTab === 'stamp' || fxTab === 'text') fxTarget = 'top';
        if (fxTab === 'texture' && fxTarget === 'top') fxTarget = 'bg';
        refreshFxUI();
        applyUserFx();
      });
    });

    const fxLayerRow = fxSheet && fxSheet.querySelector('.fx-layer-row');
    const fxUsedWrap = fxSheet && fxSheet.querySelector('.fx-used-wrap');
    if (fxLayerRow) fxLayerRow.hidden = fxTab === 'material';
    if (fxLayerHint) fxLayerHint.hidden = fxTab === 'material';

    if (fxTab === 'material') {
      renderMaterialPanel();
      return;
    }
    if (fxUsedWrap) fxUsedWrap.hidden = false;

    const list = Fx.catalogByTab(fxTab);
    const previewId = fxDraft ? fxDraft.catalogId : null;
    fxCatalog.classList.remove('is-mat');
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

  function renderMaterialPanel() {
    if (!fxCatalog || !fxParams || !window.TicketPaper) return;
    const presets = TicketPaper.PRESETS;
    // :has() 在 Chrome 61 里整条规则会被丢掉，所以同时挂一个 class 给基线层用
    fxCatalog.classList.add('is-mat');
    fxCatalog.innerHTML = `<div class="mat-panel">
      <p class="mat-hint">平面模式即时预览；纸感 3D 约 0.25 秒刷新，导出与预览一致。</p>
      <div class="fx-field"><label>呈现</label>
        <div class="fx-seg" id="paperModeSeg">
          <button type="button" class="fx-seg-btn${paperPresentMode === 'flat' ? ' is-active' : ''}" data-paper-mode="flat">经典平面</button>
          <button type="button" class="fx-seg-btn${paperPresentMode === 'paper3d' ? ' is-active' : ''}" data-paper-mode="paper3d">纸感 3D</button>
        </div>
      </div>
      <div class="fx-field"><label>纸材预设</label>
        <div class="fx-seg fx-seg--wrap" id="paperPresetSeg">${Object.keys(presets)
          .map(
            (id) =>
              `<button type="button" class="fx-seg-btn${paperPreset === id ? ' is-active' : ''}" data-paper-preset="${id}">${presets[id].label}</button>`
          )
          .join('')}</div>
      </div>
    </div>`;
    fxUsed.innerHTML = '';
    if (fxSheet && fxSheet.querySelector('.fx-used-wrap')) {
      fxSheet.querySelector('.fx-used-wrap').hidden = true;
    }

    fxParams.innerHTML = `<div class="fx-field"><label>纸纹 ${Math.round(paperGrain * 100)}%</label>
      <input type="range" id="paperGrainRange" min="0" max="100" value="${Math.round(paperGrain * 100)}" /></div>
      <div class="fx-field"><label>光照 ${Math.round(paperLight * 100)}%</label>
      <input type="range" id="paperLightRange" min="20" max="100" value="${Math.round(paperLight * 100)}" /></div>
      <div class="fx-field"><label>微卷 ${Math.round(paperCurl * 100)}%</label>
      <input type="range" id="paperCurlRange" min="0" max="35" value="${Math.round(paperCurl * 100)}" /></div>`;
    syncFxFooter(false);

    fxCatalog.querySelectorAll('[data-paper-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        paperPresentMode = btn.dataset.paperMode;
        renderTicketOnly();
        refreshFxUI();
      });
    });
    fxCatalog.querySelectorAll('[data-paper-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        paperPreset = btn.dataset.paperPreset;
        const p = presets[paperPreset] || presets.matte;
        paperGrain = p.grain;
        paperCurl = p.curl;
        if (paperGl) paperGl.setParams(paperParams());
        if (paperPresentMode === 'paper3d') schedulePaperRender();
        refreshFxUI();
      });
    });

    const grainEl = $('paperGrainRange');
    const lightEl = $('paperLightRange');
    const curlEl = $('paperCurlRange');
    const bindPaperRange = (el, key, labelPrefix, div) => {
      if (!el) return;
      el.addEventListener('input', () => {
        const v = Number(el.value);
        if (key === 'grain') paperGrain = v / 100;
        if (key === 'light') paperLight = v / 100;
        if (key === 'curl') paperCurl = v / 100;
        if (paperGl) {
          paperGl.setParams(paperParams());
          paperGl.renderFrame();
        }
        if (paperPresentMode === 'paper3d' && key !== 'light') schedulePaperRender();
        const label = el.closest('.fx-field') && el.closest('.fx-field').querySelector('label');
        if (label) label.textContent = `${labelPrefix} ${v}%`;
      });
    };
    bindPaperRange(grainEl, 'grain', '纸纹');
    bindPaperRange(lightEl, 'light', '光照');
    bindPaperRange(curlEl, 'curl', '微卷');
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
    if (!fxOpen && !fieldsOpen && !photoOpen && !stageOpen) return;
    if (
      e.target.closest &&
      (e.target.closest('.fx-body') ||
        e.target.closest('.fields-body') ||
        e.target.closest('.stage-media-viewport') ||
        e.target.closest('.photo-adjust-body'))
    ) {
      return;
    }
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
  if (photoClose) photoClose.addEventListener('click', closePhotoSheet);
  if (photoScrim) photoScrim.addEventListener('click', closePhotoSheet);
  if (photoReplaceBtn) {
    photoReplaceBtn.addEventListener('click', () => {
      activePickSlot = adjustSlot;
      photoInput.value = '';
      photoInput.click();
    });
  }
  if (photoConfirmBtn) {
    photoConfirmBtn.addEventListener('click', closePhotoSheet);
  }

  function photoPointerDistance() {
    const pts = [...photoPointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  }

  function beginPhotoPinch() {
    const dist = photoPointerDistance();
    if (dist < 6) return;
    photoDrag = null;
    photoPinch = {
      startDist: dist,
      origScale: getPhotoFit(adjustSlot).scale,
    };
  }

  function beginPhotoPan(e) {
    const fit = getPhotoFit(adjustSlot);
    const ar = slotImageAspect(adjustSlot);
    const pan = photoPanAxes(adjustSlot, fit, ar);
    photoDrag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: fit.x,
      origY: fit.y,
      canPanX: pan.canPanX,
      canPanY: pan.canPanY,
      rect: photoAdjustViewport.getBoundingClientRect(),
      moved: 0,
    };
    photoAdjustViewport.classList.add('is-dragging');
  }

  function isPhotoFitRestState(slot) {
    const f = getPhotoFit(slot);
    return f.scale <= 1.02 && Math.abs(f.x - 50) < 1.5 && Math.abs(f.y - 50) < 1.5;
  }

  function togglePhotoDoubleZoom(clientX, clientY) {
    if (isPhotoFitRestState(adjustSlot)) {
      const rect = photoAdjustViewport.getBoundingClientRect();
      let x = 50;
      let y = 50;
      if (rect.width > 0 && rect.height > 0) {
        x = clampPct(((clientX - rect.left) / rect.width) * 100);
        y = clampPct(((clientY - rect.top) / rect.height) * 100);
      }
      animatePhotoFitForSlot(adjustSlot, { scale: PHOTO_DOUBLE_ZOOM, x, y });
    } else {
      animatePhotoFitForSlot(adjustSlot, DEFAULT_PHOTO_FIT);
    }
  }

  function tryPhotoDoubleTap(clientX, clientY) {
    const now = Date.now();
    const dt = now - photoLastTapAt;
    const dist = Math.hypot(clientX - photoLastTapX, clientY - photoLastTapY);
    if (dt > 0 && dt < PHOTO_DOUBLE_TAP_MS && dist < PHOTO_DOUBLE_TAP_PX * 2.5) {
      photoLastTapAt = 0;
      photoSuppressDblClick = true;
      togglePhotoDoubleZoom(clientX, clientY);
      return;
    }
    photoLastTapAt = now;
    photoLastTapX = clientX;
    photoLastTapY = clientY;
  }

  if (photoAdjustViewport) {
    photoAdjustViewport.addEventListener('pointerdown', (e) => {
      if (!photoOpen) return;
      if (e.button != null && e.button !== 0) return;
      clearPhotoFitAnim(photoFitImgsForSlot(adjustSlot));
      photoPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        photoAdjustViewport.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (photoPointers.size === 1) {
        beginPhotoPan(e);
      } else if (photoPointers.size === 2) {
        beginPhotoPinch();
      }
      e.preventDefault();
    });
    photoAdjustViewport.addEventListener('pointermove', (e) => {
      if (!photoOpen || !photoPointers.has(e.pointerId)) return;
      photoPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (photoPinch && photoPointers.size >= 2) {
        const dist = photoPointerDistance();
        if (dist < 6) return;
        const scale = Math.min(2.6, Math.max(1, photoPinch.origScale * (dist / photoPinch.startDist)));
        setPhotoFit(adjustSlot, { scale });
        syncPhotoAdjustFromFit();
        return;
      }
      if (!photoDrag || photoPointers.size !== 1 || e.pointerId !== photoDrag.pointerId) return;
      photoDrag.moved = Math.max(
        photoDrag.moved,
        Math.hypot(e.clientX - photoDrag.startX, e.clientY - photoDrag.startY)
      );
      const dx = ((e.clientX - photoDrag.startX) / photoDrag.rect.width) * 100;
      const dy = ((e.clientY - photoDrag.startY) / photoDrag.rect.height) * 100;
      const next = { scale: getPhotoFit(adjustSlot).scale };
      if (photoDrag.canPanX) next.x = clampPct(photoDrag.origX - dx);
      if (photoDrag.canPanY) next.y = clampPct(photoDrag.origY - dy);
      setPhotoFit(adjustSlot, next);
      syncPhotoAdjustFromFit();
    });
    const endPhotoGesture = (e) => {
      if (!photoPointers.has(e.pointerId)) return;
      const drag = photoDrag && e.pointerId === photoDrag.pointerId ? photoDrag : null;
      photoPointers.delete(e.pointerId);
      if (drag) {
        if (drag.moved < PHOTO_DOUBLE_TAP_PX) {
          tryPhotoDoubleTap(e.clientX, e.clientY);
        }
        photoDrag = null;
      }
      if (photoPointers.size < 2) photoPinch = null;
      if (photoPointers.size === 0) {
        photoAdjustViewport.classList.remove('is-dragging');
      }
    };
    photoAdjustViewport.addEventListener('pointerup', endPhotoGesture);
    photoAdjustViewport.addEventListener('pointercancel', endPhotoGesture);
    photoAdjustViewport.addEventListener('dblclick', (e) => {
      if (!photoOpen) return;
      if (photoSuppressDblClick) {
        photoSuppressDblClick = false;
        e.preventDefault();
        return;
      }
      e.preventDefault();
      togglePhotoDoubleZoom(e.clientX, e.clientY);
    });
    photoAdjustViewport.addEventListener(
      'wheel',
      (e) => {
        if (!photoOpen) return;
        e.preventDefault();
        const fit = getPhotoFit(adjustSlot);
        const next = Math.min(2.6, Math.max(1, fit.scale - e.deltaY * 0.002));
        setPhotoFit(adjustSlot, { scale: next });
        syncPhotoAdjustFromFit();
      },
      { passive: false }
    );
  }

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

  function renderAll(opts) {
    renderCats();
    renderTrigger();
    renderFields();
    syncPhotoSlots();
    renderTicketOnly();
    if (sheetOpen) {
      // 选票根时只同步选中态，避免重建列表导致滚动位置/缩略图全部重来
      if (opts && opts.keepStyleGrid) syncStyleSelection();
      else renderStyleGrid();
    }
    if (fxOpen) refreshFxUI();
    if (window.lucide) lucide.createIcons();
  }

  /** 竖屏优先：按预览区宽高等比缩进
   *  缓存票面固有尺寸，避免过渡中反复「清缩放→闪大图→再缩小」 */
  let fitScale = 1;
  function fitTicket(forceRemeasure) {
    const ticket = getTicketRoot();
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

    // 画板宽高比跟着票根走（换模板/票型后这里会重新对齐）
    layoutStageArtboard();

    // 按「票根 + 四周等宽留白」的外框来定缩放，
    // 于是票根在画板里正好留出一圈均匀的背景边
    const fp = stageFramePad(w, h);
    const frameW = w + fp * 2;
    const frameH = h + fp * 2;
    const availW = Math.max(tiltScene.clientWidth, 60);
    const availH = Math.max(tiltScene.clientHeight, 60);
    fitScale = Math.min(availW / frameW, availH / frameH);
    fitScale = Math.min(1.35, Math.max(0.22, fitScale));

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
        clearPhotoSlot(idx);
        renderTicketOnly();
        renderTrigger();
        syncPhotoSlots();
        return;
      }
      const adjustBtn = e.target.closest('[data-adjust]');
      if (adjustBtn) {
        const idx = Number(adjustBtn.dataset.adjust);
        if (!Number.isFinite(idx)) return;
        openPhotoSheet(idx);
        return;
      }
      const pickBtn = e.target.closest('[data-add]');
      if (!pickBtn) return;
      activePickSlot = Number(pickBtn.dataset.add);
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
      const url = String(reader.result);
      const slot = activePickSlot;
      customPhotos[slot] = url;
      resetPhotoFit(slot);
      loadImageAspect(url)
        .then((imageAspect) => {
          photoAspect[slot] = imageAspect;
          renderTicketOnly();
          renderTrigger();
          syncPhotoSlots();
          if (photoOpen && adjustSlot === slot) {
            syncPhotoAdjustFromFit();
            return;
          }
          if (needsPhotoCompose(slot, imageAspect)) {
            requestAnimationFrame(() => openPhotoSheet(slot));
          }
        })
        .catch(() => {
          renderTicketOnly();
          renderTrigger();
          syncPhotoSlots();
        });
    };
    reader.onerror = () => {
      alert('图片读取失败，请重试');
    };
    reader.readAsDataURL(file);
  });

  /* —— 预览投影 ——
     预览区的倾斜（跟随光标改变角度 + 动态光照）已移除，
     这里只负责把票根的固定投影恢复成静止状态。 */
  function resetTilt() {
    if (paperPresentMode === 'paper3d' && paperGl) {
      paperGl.setLight(0, 0);
      paperGl.renderFrame();
      ticketHost.style.filter = 'drop-shadow(4px 10px 16px rgba(40, 34, 26, 0.12))';
      return;
    }
    ticketHost.style.filter = 'drop-shadow(6px 12px 18px rgba(0,0,0,0.32))';
  }

  window.addEventListener('resize', () => {
    resetTilt();
    layoutStageArtboard();
    fitTicket(true);
    if (photoOpen) layoutPhotoAdjustViewport();
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
    // 预览区尺寸变化（sheet 顶起 / 过渡）→ 同步画板等比缩放
    new ResizeObserver(() => layoutStageArtboard()).observe(stagePanel);
  }
  resetTilt();

  /* —— 导出补镂空 ——
     导出走 html-to-image（把 DOM 塞进 SVG foreignObject 光栅化），
     这条路径对 CSS mask（尤其 mask-composite: intersect）不可靠：
     孔常常没被真的打穿，导出的 PNG 上就留一块灰。
     这里按同一份 CSS 几何，在光栅化结果上把孔擦成真正的透明。 */

  /** 按括号深度切逗号：gradient 里的逗号不能当分隔符 */
  function splitTopLevel(str) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (let i = 0; i < String(str).length; i += 1) {
      const ch = str[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  /** 按空白切词，但 calc(100% - 103px) 这种要当成一个整体 */
  function splitTokens(str) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of String(str).trim()) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (/\s/.test(ch) && depth === 0) {
        if (cur) out.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }

  let maskProbe = null;

  /** 用「探针元素」求 CSS 长度：百分比按盒宽高解、calc 交给浏览器算，
      比在 JS 里重写一遍 calc 语义可靠 */
  function resolveCssLen(expr, boxW, boxH, axis) {
    if (expr == null || expr === '') return 0;
    let v = String(expr).trim();
    const kw = { left: '0px', top: '0px', right: '100%', bottom: '100%', center: '50%' };
    if (kw[v]) v = kw[v];
    if (!maskProbe) {
      const box = document.createElement('div');
      const probe = document.createElement('div');
      box.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;';
      probe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0';
      box.appendChild(probe);
      document.body.appendChild(box);
      maskProbe = { box, probe };
    }
    const { box, probe } = maskProbe;
    box.style.width = `${Math.max(0, boxW)}px`;
    box.style.height = `${Math.max(0, boxH)}px`;
    probe.style.left = '0';
    probe.style.top = '0';
    if (axis === 'x') probe.style.left = v;
    else probe.style.top = v;
    const b = box.getBoundingClientRect();
    const p = probe.getBoundingClientRect();
    probe.style.left = '0';
    probe.style.top = '0';
    return axis === 'x' ? p.left - b.left : p.top - b.top;
  }

  /** 解析一层 mask-image，返回它在元素内打出的孔（元素自身坐标，不含 transform）。
      只处理「圆孔」：radial-gradient + 透明色停靠点 */
  function maskLayerHoles(img, size, repeat, position, ew, eh) {
    if (!/radial-gradient\(/i.test(img)) return null;
    const inner = img.slice(img.indexOf('(') + 1, img.lastIndexOf(')'));
    const parts = splitTopLevel(inner);
    const shape = parts[0] || '';
    const stops = parts.slice(1);

    const atMatch = shape.match(/\bat\b([\s\S]+)$/i);
    let cxExpr = '50%';
    let cyExpr = '50%';
    if (atMatch) {
      const toks = splitTokens(atMatch[1]);
      if (toks.length >= 2) {
        cxExpr = toks[0];
        cyExpr = toks[1];
      }
    }

    // 半径写在 `circle 9px` 里，或由透明色停靠点给出（transparent 0 93% → 0.93R）
    const explicit = parseFloat((shape.match(/circle\s+([\d.]+)px/i) || [])[1]);
    let radius = 0;
    stops.forEach((st) => {
      const alpha0 =
        /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(st) || /\btransparent\b/i.test(st);
      if (!alpha0) return;
      const m = st.match(/(-?[\d.]+)(px|%)\s*$/);
      if (!m) return;
      const n = parseFloat(m[1]);
      if (m[2] === '%') {
        if (Number.isFinite(explicit) && explicit > 0) radius = explicit * (n / 100);
      } else {
        radius = n;
      }
    });
    if (!(radius > 0)) return null;

    const sizeToks = splitTokens(size || 'auto');
    const lw = !sizeToks[0] || sizeToks[0] === 'auto' ? ew : resolveCssLen(sizeToks[0], ew, eh, 'x');
    const lh = !sizeToks[1] || sizeToks[1] === 'auto' ? eh : resolveCssLen(sizeToks[1], ew, eh, 'y');
    if (!(lw > 0) || !(lh > 0)) return null;

    const cx = resolveCssLen(cxExpr, lw, lh, 'x');
    const cy = resolveCssLen(cyExpr, lw, lh, 'y');
    const posToks = splitTokens(position || '0% 0%');
    const posX = resolveCssLen(posToks[0] || '0%', Math.max(0, ew - lw), eh, 'x');
    const posY = resolveCssLen(posToks[1] != null ? posToks[1] : '0%', ew, Math.max(0, eh - lh), 'y');
    const baseX = posX + cx;
    const baseY = posY + cy;

    const rep = String(repeat || 'repeat').trim();
    const repX = rep === 'repeat' || rep === 'repeat-x' || rep === 'space' || rep === 'round';
    const repY = rep === 'repeat' || rep === 'repeat-y' || rep === 'space' || rep === 'round';

    const xs = [];
    if (repX) {
      const k0 = Math.floor((-radius - baseX) / lw);
      const k1 = Math.ceil((ew + radius - baseX) / lw);
      for (let k = k0; k <= k1; k += 1) xs.push(baseX + k * lw);
    } else if (baseX > -radius && baseX < ew + radius) {
      xs.push(baseX);
    }

    const ys = [];
    if (repY) {
      const k0 = Math.floor((-radius - baseY) / lh);
      const k1 = Math.ceil((eh + radius - baseY) / lh);
      for (let k = k0; k <= k1; k += 1) ys.push(baseY + k * lh);
    } else if (baseY > -radius && baseY < eh + radius) {
      ys.push(baseY);
    }
    if (!xs.length || !ys.length) return null;

    const out = [];
    xs.forEach((x) => ys.forEach((y) => out.push({ x, y, r: radius })));
    return out;
  }

  /** 单块不透明渐变（如 linear-gradient(#000, #000)）：只铺底、不贡献孔 */
  function isOpaqueFullLayer(img) {
    const s = String(img).trim();
    if (!/^linear-gradient\(/i.test(s)) return false;
    const ink = '(?:rgb\\(0,\\s*0,\\s*0\\)|rgba\\(0,\\s*0,\\s*0,\\s*1\\)|#000000|#000|black)';
    const pos = '(?:\\s+-?[\\d.]+(?:px|%))?';
    return new RegExp(`^linear-gradient\\(\\s*${ink}${pos}\\s*,\\s*${ink}${pos}\\s*\\)$`, 'i').test(s);
  }

  /** 把孔位写成一张单层 SVG 遮罩。
      注意：url() 图片遮罩走的是 alpha 通道（不是亮度），所以孔必须是
      真·透明；同时保留白色底块+纯黑孔，万一按亮度解释也还是同一个结果。
      白底还顶掉了原来那层 linear-gradient(#000,#000)，
      整块遮罩只剩一层，不再需要 mask-composite。 */
  function maskSvgUrl(ew, eh, holes) {
    const r2 = (n) => Math.round(n * 100) / 100;
    const circles = holes
      .filter((h) => h.x + h.r > 0 && h.x - h.r < ew && h.y + h.r > 0 && h.y - h.r < eh)
      .map((h) => `<circle cx="${r2(h.x)}" cy="${r2(h.y)}" r="${r2(h.r)}" fill="#000" fill-opacity="0"/>`)
      .join('');
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(ew)}" height="${r2(eh)}" ` +
      `viewBox="0 0 ${r2(ew)} ${r2(eh)}">` +
      `<rect width="${r2(ew)}" height="${r2(eh)}" fill="#fff"/>` +
      circles +
      `</svg>`;
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }

  /** 把「多层 + mask-composite: intersect」的镂空压成等价的单层遮罩。
      邮票齿孔原本是 5 层 radial-gradient 相交出来的，但光栅化（html-to-image
      把 DOM 塞进 SVG foreignObject）常把 composite 当成 add：第一层整块底色
      一盖，孔就被填实 —— 导出的票根看起来「没有镂空」。
      压成单层后不再依赖 composite；而且元素自身的阴影/描边会跟着孔一起被裁掉，
      否则只能事后擦像素，孔边会留下一条阴影线。
      返回还原函数（用在画板这类不能改坏的实时节点上）。 */
  function flattenMasks(rootEl) {
    const restored = [];
    if (!rootEl) return () => {};
    const set = (el, prop, value) => {
      restored.push({
        el,
        prop,
        prev: el.style.getPropertyValue(prop),
        pri: el.style.getPropertyPriority(prop),
      });
      el.style.setProperty(prop, value, 'important');
    };
    const nodes = [rootEl].concat(Array.from(rootEl.querySelectorAll('*')));
    nodes.forEach((el) => {
      let cs;
      try {
        cs = getComputedStyle(el);
      } catch (_) {
        return;
      }
      if (!cs || cs.display === 'none') return;
      const raw = cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage : cs.webkitMaskImage;
      if (!raw || raw === 'none') return;
      const images = splitTopLevel(raw);
      if (images.length < 2) return; // 单层遮罩本来就正常，不动它
      const composite = `${cs.maskComposite || ''} ${cs.webkitMaskComposite || ''}`;
      if (!/intersect|source-in/i.test(composite)) return;
      const ew = el.offsetWidth;
      const eh = el.offsetHeight;
      if (!ew || !eh) return;
      const sizes = splitTopLevel(cs.maskSize || 'auto');
      const repeats = splitTopLevel(cs.maskRepeat || 'repeat');
      const positions = splitTopLevel(cs.maskPosition || '0% 0%');
      const holes = [];
      for (let i = 0; i < images.length; i += 1) {
        const img = images[i];
        if (isOpaqueFullLayer(img)) continue;
        const layer = maskLayerHoles(
          img,
          sizes[i % sizes.length],
          repeats[i % repeats.length],
          positions[i % positions.length],
          ew,
          eh
        );
        // 有一层解析不了就整体放弃：宁可保持原样，也不要改出一个错的孔
        if (!layer) return;
        holes.push(...layer);
      }
      if (!holes.length) return;
      const url = maskSvgUrl(ew, eh, holes);
      set(el, '-webkit-mask-image', url);
      set(el, 'mask-image', url);
      set(el, '-webkit-mask-size', '100% 100%');
      set(el, 'mask-size', '100% 100%');
      set(el, '-webkit-mask-repeat', 'no-repeat');
      set(el, 'mask-repeat', 'no-repeat');
      set(el, '-webkit-mask-position', '0 0');
      set(el, 'mask-position', '0 0');
      set(el, '-webkit-mask-composite', 'source-over');
      set(el, 'mask-composite', 'add');
      set(el, 'mask-origin', 'border-box');
      set(el, 'mask-clip', 'border-box');
    });
    return () => {
      restored.forEach(({ el, prop, prev, pri }) => {
        if (prev) el.style.setProperty(prop, prev, pri);
        else el.style.removeProperty(prop);
      });
    };
  }

  /* —— 导出落地 ——
     容器里没有 a[download]、blob 下载也被禁，导出必须走 JSBridge：
     canvas.toDataURL() → writeTempFile → saveImageToPhotosAlbum。
     普通浏览器（本地预览）没有 window.xhs，退回 a[download]。 */

  function xhsMiniTool() {
    const m = window.xhs && window.xhs.miniTool;
    return m && typeof m.writeTempFile === 'function' && typeof m.saveImageToPhotosAlbum === 'function'
      ? m
      : null;
  }

  async function savePng(dataUrl, filename) {
    const miniTool = xhsMiniTool();
    if (!miniTool) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.click();
      return;
    }
    const res = await miniTool.writeTempFile({ data: dataUrl });
    const filePath = res && res.filePath;
    if (!filePath) throw new Error('writeTempFile 未返回 filePath');
    await miniTool.saveImageToPhotosAlbum({ filePath });
    alert('已保存到相册');
  }

  function xhsPostNote() {
    const m = window.xhs && window.xhs.miniTool;
    return m && typeof m.postNote === 'function' ? m : null;
  }

  function noteText() {
    const cat = currentCat();
    const style = currentStyle();
    const data = ticketData();
    const values = style.fields
      .map((field) => data[field.key])
      .filter((value) => value != null && String(value).trim())
      .map((value) => String(value).trim())
      .slice(0, 4);
    const title = `${cat.name || '我的'}票根`.slice(0, 20);
    const content = [
      `用帧藏做了一张${cat.name || ''}·${style.name || '票根'}`,
      values.join('｜'),
      '#帧藏 #票根 #生活记录',
    ].filter(Boolean).join('\n').slice(0, 1000);
    return { title, content };
  }

  async function postNote(dataUrl) {
    const miniTool = xhsPostNote();
    if (!miniTool) {
      alert('当前不在支持小红书发布的环境');
      return;
    }
    const { title, content } = noteText();
    await miniTool.postNote({
      title,
      content,
      pageType: 'photo_publish',
      mediaInfo: { image_resources: [{ url: dataUrl }] },
    });
  }

  /** 光栅化参数：把字体以 data: 内联进 SVG，避免运行时去取字体文件
      （离线容器里取包内资源不可靠，会静默退化成系统字体） */
  function rasterOptions(extra) {
    const opts = Object.assign(
      { pixelRatio: 2, cacheBust: true, backgroundColor: null },
      extra || {}
    );
    if (window.__FONT_EMBED_CSS) opts.fontEmbedCSS = window.__FONT_EMBED_CSS;
    return opts;
  }

  async function rasterizeForExport(node, pixelRatio) {
    if (window.TicketPaper && TicketPaper.rasterizeNode) {
      return TicketPaper.rasterizeNode(node, window.htmlToImage, pixelRatio);
    }
    return window.htmlToImage.toCanvas(node, rasterOptions({ pixelRatio }));
  }

  /** 画布几乎全透明？用来兜住「遮罩被当成全透明」这种极端情况 */
  function isNearlyEmptyCanvas(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return true;
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const step = 4 * Math.max(1, Math.round(data.length / 4 / 40000));
      let opaque = 0;
      let total = 0;
      for (let i = 3; i < data.length; i += step) {
        total += 1;
        if (data[i] > 24) opaque += 1;
      }
      return !total || opaque / total < 0.1;
    } catch (_) {
      return false; // 读不了（被污染）就当正常，别乱回退
    }
  }

  /** 光栅化前清掉没有 src 的 <img>：
      光栅化库会为它们抛出一个没有信息的 Event，导致整次导出失败
      （表现为「点了导出没反应」），所以任何导出入口都先过一遍 */
  function stripEmptyImgs(node) {
    if (!node) return;
    node.querySelectorAll('img:not([src])').forEach((n) => {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
  }

  /* —— export —— */
  async function exportTicketPng(shouldPost = false) {
    if (!window.htmlToImage) {
      alert('截图库加载失败，请重试');
      return;
    }
    const node = getTicketRoot();
    if (!node) return;

    exportBusy = true;
    exportBtn.disabled = true;
    const label = exportBtn.querySelector('span');
    const prevLabel = label ? label.textContent : '导出';
    if (label) label.textContent = '导出中…';

    const stage = document.createElement('div');
    stage.className = 'export-stage';
    stage.setAttribute('aria-hidden', 'true');
    const clip = prepareCloneForRaster(node);
    stage.appendChild(clip);
    document.body.appendChild(stage);
    stripEmptyImgs(clip);

    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      let dataUrl;
      const pixelRatio = 2;
      // 先把多层镂空压成单层，否则光栅化会丢掉 mask-composite，票根就没有镂空了
      flattenMasks(clip);
      let canvas = await rasterizeForExport(clip, pixelRatio);
      if (isNearlyEmptyCanvas(canvas)) {
        // 万一单层遮罩在光栅化里被当成全透明（整张票连同阴影都没了），
        // 宁可不要镂空也不能导出空白
        console.warn('镂空遮罩未生效，回退为不裁切');
        [clip].concat(Array.from(clip.querySelectorAll('*'))).forEach((n) => {
          n.style.setProperty('-webkit-mask-image', 'none', 'important');
          n.style.setProperty('mask-image', 'none', 'important');
        });
        canvas = await rasterizeForExport(clip, pixelRatio);
      }
      if (paperPresentMode === 'paper3d' && window.TicketPaper) {
        const gl = ensurePaperGl();
        dataUrl = gl ? gl.capturePngFromCanvas(canvas, paperParams()) : canvas.toDataURL('image/png');
      } else {
        dataUrl = canvas.toDataURL('image/png');
      }

      if (shouldPost) {
        await postNote(dataUrl);
      } else {
        await savePng(dataUrl, `ticket-${styleId}-${Date.now()}.png`);
      }
    } catch (err) {
      console.error('导出失败', err);
      alert(shouldPost ? '发布失败，请重试' : '导出失败，请重试；若仍失败可换一张本地图片');
    } finally {
      stage.remove();
      exportBusy = false;
      exportBtn.disabled = false;
      if (label) label.textContent = prevLabel;
      if (window.lucide) lucide.createIcons({ nodes: [exportBtn] });
    }
  }

  async function exportScenePng(shouldPost = false) {
    if (!window.htmlToImage || !stagePanel || !stageArtboard) {
      alert('截图库加载失败，请重试');
      return;
    }

    exportBusy = true;
    exportBtn.disabled = true;
    const label = exportBtn.querySelector('span');
    const prevLabel = label ? label.textContent : '导出';
    if (label) label.textContent = '导出中…';

    const savedFilter = ticketHost.style.filter;
    resetTilt();
    if (paperPresentMode === 'paper3d' && paperGl) {
      paperGl.setLight(0, 0);
      paperGl.renderFrame();
    }

    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const pixelRatio = 2;
      /* 画板宽度是容器查询单位（cqw/cqh）算出来的：光栅化时克隆脱离了
         .stage 这个查询容器，cq 单位会退化成视口尺寸 → 画板变大、票根位置跑偏。
         所以先把它锁成当前实际像素尺寸 */
      const artRect = stageArtboard.getBoundingClientRect();
      const prevW = stageArtboard.style.width;
      const prevH = stageArtboard.style.height;
      stageArtboard.style.width = `${artRect.width}px`;
      stageArtboard.style.height = `${artRect.height}px`;

      let dataUrl;
      // 多层镂空压成单层，光栅化才会真的把票根裁出孔（孔里直接露出画板背景）
      const restoreMasks = flattenMasks(stageArtboard);
      try {
        // 兜底：没有 src 的空 <img> 会让光栅化抛 Event，整次导出失败
        stripEmptyImgs(stageArtboard);
        const canvas = await htmlToImage.toCanvas(stageArtboard, rasterOptions({ pixelRatio }));
        dataUrl = canvas.toDataURL('image/png');
      } finally {
        restoreMasks();
        stageArtboard.style.width = prevW;
        stageArtboard.style.height = prevH;
      }

      if (shouldPost) {
        await postNote(dataUrl);
      } else {
        await savePng(dataUrl, `preview-${styleId}-${Date.now()}.png`);
      }
    } catch (err) {
      console.error('预览导出失败', err);
      alert(shouldPost ? '发布失败，请重试' : '预览导出失败，请重试');
    } finally {
      ticketHost.style.filter = savedFilter;
      exportBusy = false;
      exportBtn.disabled = false;
      if (label) label.textContent = prevLabel;
      if (window.lucide) lucide.createIcons({ nodes: [exportBtn] });
    }
  }

  if (stageBtn) stageBtn.addEventListener('click', () => (stageOpen ? closeStageSheet() : openStageSheet()));
  if (stageClose) stageClose.addEventListener('click', closeStageSheet);
  if (stageScrim) stageScrim.addEventListener('click', closeStageSheet);
  buildStageColorGrid();
  if (stageMediaPickTile) {
    stageMediaPickTile.addEventListener('click', () => pickStageBgFile());
  }
  if (stageBgPickBtn) {
    stageBgPickBtn.addEventListener('click', () => pickStageBgFile());
  }
  if (stageBgClearBtn) {
    stageBgClearBtn.addEventListener('click', () => clearStageBgImage());
  }
  if (stageOpacityUi) {
    stageOpacityCtl = mountUiRange(stageOpacityUi, {
      min: 5,
      max: 100,
      value: Math.round(stageBgState.opacity * 100),
      onInput(v) {
        stageBgState.opacity = v / 100;
        applyStageBg();
        syncStageSheetUI();
      },
    });
  }
  if (stageBgInput) {
    stageBgInput.addEventListener('change', () => {
      const file = stageBgInput.files && stageBgInput.files[0];
      if (!file) return;
      const onLoaded = (url) => {
        stageBgState.imageUrl = url;
        stageBgState.fit = { x: 50, y: 50, scale: 1 };
        stageBgState.opacity = 1;
        stageBgImageAspect = 0;
        loadImageAspect(url)
          .then((a) => {
            stageBgImageAspect = a;
          })
          .catch(() => {
            stageBgImageAspect = 0;
          })
          .finally(() => {
            applyStageBg();
            syncStageSheetUI();
            applyStageBgFit();
          });
      };
      const reader = new FileReader();
      reader.onload = () => onLoaded(String(reader.result));
      reader.onerror = () => alert('图片读取失败，请重试');
      reader.readAsDataURL(file);
    });
  }
  if (stageBgViewport) {
    stageBgViewport.addEventListener('pointerdown', (e) => {
      if (!stageOpen || !stageBgState.imageUrl) return;
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest && e.target.closest('.stage-media-clear')) return;
      stageBgPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        stageBgViewport.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      if (stageBgPointers.size === 1) beginStageBgPan(e);
      else if (stageBgPointers.size === 2) beginStageBgPinch();
      e.preventDefault();
    });
    stageBgViewport.addEventListener('pointermove', (e) => {
      if (!stageOpen || !stageBgPointers.has(e.pointerId)) return;
      stageBgPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (stageBgPinch && stageBgPointers.size >= 2) {
        const dist = stageBgPointerDistance();
        if (dist < 6) return;
        setStageBgFit({
          scale: stageBgPinch.origScale * (dist / stageBgPinch.startDist),
        });
        return;
      }
      if (!stageBgDrag || stageBgPointers.size !== 1 || e.pointerId !== stageBgDrag.pointerId) return;
      stageBgDrag.moved = Math.max(
        stageBgDrag.moved,
        Math.hypot(e.clientX - stageBgDrag.startX, e.clientY - stageBgDrag.startY)
      );
      const dx = ((e.clientX - stageBgDrag.startX) / stageBgDrag.rect.width) * 100;
      const dy = ((e.clientY - stageBgDrag.startY) / stageBgDrag.rect.height) * 100;
      const next = { scale: getStageBgFit().scale };
      if (stageBgDrag.canPanX) next.x = clampPct(stageBgDrag.origX - dx);
      if (stageBgDrag.canPanY) next.y = clampPct(stageBgDrag.origY - dy);
      setStageBgFit(next);
    });
    const endStageBgGesture = (e) => {
      if (!stageBgPointers.has(e.pointerId)) return;
      const drag = stageBgDrag && e.pointerId === stageBgDrag.pointerId ? stageBgDrag : null;
      stageBgPointers.delete(e.pointerId);
      if (drag) {
        if (drag.moved < PHOTO_DOUBLE_TAP_PX) tryStageBgDoubleTap(e.clientX, e.clientY);
        stageBgDrag = null;
      }
      if (stageBgPointers.size < 2) stageBgPinch = null;
      if (stageBgPointers.size === 0) stageBgViewport.classList.remove('is-dragging');
    };
    stageBgViewport.addEventListener('pointerup', endStageBgGesture);
    stageBgViewport.addEventListener('pointercancel', endStageBgGesture);
    stageBgViewport.addEventListener('dblclick', (e) => {
      if (!stageOpen || !stageBgState.imageUrl) return;
      e.preventDefault();
      if (stageBgSuppressDblClick) {
        stageBgSuppressDblClick = false;
        return;
      }
      toggleStageBgDoubleZoom(e.clientX, e.clientY);
    });
    stageBgViewport.addEventListener(
      'wheel',
      (e) => {
        if (!stageOpen || !stageBgState.imageUrl) return;
        e.preventDefault();
        const fit = getStageBgFit();
        setStageBgFit({ scale: fit.scale - e.deltaY * 0.002 });
      },
      { passive: false }
    );
  }
  const stageStyleSeg = $('stageStyleSeg');
  if (stageStyleSeg) {
    stageStyleSeg.querySelectorAll('[data-stage-style]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stageBgState.stylize = btn.dataset.stageStyle || 'none';
        applyStageBg();
        syncStageSheetUI();
      });
    });
  }

  exportBtn.addEventListener('click', () => openExportSheet());
  if (publishBtn) publishBtn.addEventListener('click', () => openPublishSheet());
  if (exportClose) exportClose.addEventListener('click', closeExportSheet);
  if (exportScrim) exportScrim.addEventListener('click', closeExportSheet);
  if (publishClose) publishClose.addEventListener('click', closePublishSheet);
  if (publishScrim) publishScrim.addEventListener('click', closePublishSheet);
  if (exportTicketBtn) {
    exportTicketBtn.addEventListener('click', async () => {
      closeExportSheet();
      await exportTicketPng();
    });
  }
  if (exportSceneBtn) {
    exportSceneBtn.addEventListener('click', async () => {
      closeExportSheet();
      await exportScenePng();
    });
  }
  function updatePublishNoteButton() {
    if (publishNoteBtn) {
      publishNoteBtn.querySelector('.export-option-desc').textContent = xhsPostNote()
        ? '将当前预览画面生成图片笔记并打开发布页'
        : '请在小红书小工具内打开后使用此功能';
    }
  }
  updatePublishNoteButton();
  window.setTimeout(updatePublishNoteButton, 500);
  if (publishNoteBtn) {
    publishNoteBtn.addEventListener('click', async () => {
      closePublishSheet();
      await exportScenePng(true);
    });
  }
  if (publishTicketBtn) {
    publishTicketBtn.addEventListener('click', async () => {
      closePublishSheet();
      await exportTicketPng(true);
    });
  }

  applyStageBg();
  syncStageSheetUI();
  hydrateFieldsFromStyle(currentStyle(), false);
  renderAll();
  layoutStageArtboard();
  fitTicket(false);
  requestAnimationFrame(() => {
    layoutStageArtboard();
    fitTicket(false);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => layoutStageArtboard());
  }
  localizeDefaultPhotos();
})();
