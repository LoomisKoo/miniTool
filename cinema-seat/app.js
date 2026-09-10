/* 观影座舱：真正的低面数 3D 影厅与第一人称座位视角 */
(function () {
  'use strict';

  var halls = [
    { id: 'standard', family: 'standard', rows: 10, cols: 14, no: '01 / 激光', name: '普通激光厅', short: '清晰 · 均衡 · 性价比', intro: '它的价值不是把画面做得最大，而是用稳定亮度和清晰度完成基本功。剧情片、文艺片、对白片和喜剧通常不需要额外加价，中央中后排最省心。', price: '舒适观看', sample: '样片 · 宽幅风景', color: '#ffb36b' },
    { id: 'imax-digital', family: 'giant', rows: 14, cols: 18, no: '02 / IMAX', name: '数字 IMAX 厅', short: '经典巨幕 · 声场开阔', intro: '核心加成是大画面和开阔声场，但没有写“激光”的 IMAX 通常仍可能是 2K 氙灯。适合预算有限又想看大场面；3D、暗场和细节党要谨慎，前五排也更容易有视野压力。', price: '大场面', sample: '样片 · 星空远景', color: '#9db7ff' },
    { id: 'imax-laser', family: 'giant', rows: 16, cols: 20, no: '03 / IMAX LASER', name: '激光 IMAX 厅', short: '激光 · 大画幅 · 震撼', intro: '激光光源带来更亮、更稳的画面，大银幕负责场面感和沉浸感。科幻、战争、超级英雄和 IMAX 摄影机拍摄的大片最能吃到加成，建议选中后排中央。', price: '大片首选', sample: '样片 · 太空远景', color: '#8caeff' },
    { id: 'imax-gt', family: 'giant', rows: 18, cols: 22, no: '04 / IMAX GT', name: 'IMAX GT 巨幕厅', short: '超大画幅 · 满屏沉浸', intro: '它把“更大的画面”和更完整的画幅做到极致，部分影片能呈现 1.43:1 的完整构图，视效大片的场面感最强。代价是前排颈椎和视野压力更明显，适合发烧友从中后排观看。', price: '发烧友', sample: '样片 · 山海全景', color: '#a9c6ff' },
    { id: 'dolby', family: 'premium', rows: 10, cols: 14, no: '05 / 杜比', name: '杜比影院', short: '暗部 · 色彩 · 全景声', intro: '核心不是更大，而是更准的光影和更真实的声音，暗部细节、色彩层次和导演埋进阴影里的信息更容易保留。悬疑、惊悚、诺兰式光影大片和重视音效的作品很适合；注意它不同于只有音响升级的杜比全景声厅。', price: '光影党', sample: '样片 · 暗夜光影', color: '#e4b77d' },
    { id: 'atmos', family: 'standard', rows: 10, cols: 14, no: '06 / 全景声', name: '杜比全景声厅', short: '声音升级 · 画质看配置', intro: '主要加成在声音定位和空间感，爆炸、雨声、配乐会更有层次，但画面设备没有统一保证。适合想听好声音又不想承担巨幕票价的人，购票前别把它误认成完整的杜比影院。', price: '听觉优先', sample: '样片 · 环绕声场', color: '#d9a87a' },
    { id: 'cinity', family: 'premium', rows: 12, cols: 16, no: '07 / CINITY', name: 'CINITY 影院', short: '4K · HDR · 高帧率', intro: '价值点是更流畅的高速运动、更高亮度和更鲜明的 HDR，赛车、体育、武侠和高帧率影片最明显。3D 优先选激光或 LED 版本；CINITY 不一定等于巨幕，想要“大”还要确认实际银幕尺寸。', price: '丝滑动态', sample: '样片 · 高帧城市', color: '#83d0cc' },
    { id: 'cgs', family: 'giant', rows: 14, cols: 18, no: '08 / CGS', name: '中国巨幕厅', short: '宽银幕 · 大声场', intro: '用更大的银幕和声场换取大片冲击力，是预算有限时的巨幕平替。科幻、灾难、动画和史诗场面都合适，但各门店配置差异较大，优先挑激光光源的新厅。', price: '大屏性价比', sample: '样片 · 史诗远景', color: '#d2a1e6' },
    { id: 'screenx', family: 'wrap', rows: 10, cols: 12, no: '09 / 三面', name: 'ScreenX 三面厅', short: '270° · 侧墙延展', intro: '加成来自左右墙面的视觉包围，而不是更高分辨率。场景宏大的科幻、战争和动作片更值得尝试；如果影片侧屏编排很少，体验可能只比普通厅多一点新鲜感，座椅本身不会动。', price: '视野包围', sample: '样片 · 城市飞驰', color: '#d6a4ff' },
    { id: '4dx', family: 'motion', rows: 8, cols: 10, no: '10 / 动感', name: '4DX 动感厅', short: '座椅运动 · 环境特效', intro: '核心是“玩”：晃动、风、水雾、气味和闪光会跟随动作场面出现，适合动画、灾难片和爆米花爽片。容易晕车、怕噪音或想认真看对白的人要避开，带小孩还要确认身高和年龄限制。', price: '好玩优先', sample: '样片 · 动作追逐', color: '#ff8c82' },
    { id: 'gold', family: 'comfort', rows: 6, cols: 8, no: '11 / 舒适', name: '金色贵宾厅', short: '沙发 · 躺椅 · 私享空间', intro: '票价买到的是更宽的躺椅、更大的间距和更安静的私密感，不是更大的画面或更强的特效。适合情侣、纪念日和想舒服看完剧情片的人；如果只追求视效，普通激光或杜比可能更划算。', price: '舒适优先', sample: '样片 · 慢节奏风景', color: '#e5bb8c' }
  ];
  var nearLevels = [
    { short: '0度', blur: 0, quality: 0 },
    { short: '100度', blur: .45, quality: 4 },
    { short: '300度', blur: 1.05, quality: 10 },
    { short: '600度', blur: 1.9, quality: 20 }
  ];
  var astigLevels = [
    { short: '0度', blur: 0, quality: 0 },
    { short: '50度', blur: .28, quality: 3 },
    { short: '100度', blur: .55, quality: 7 },
    { short: '200度', blur: .9, quality: 13 }
  ];
  var state = { hall: 0, row: 5, col: 7, near: 0, astig: 0, sample: false };
  var pendingSeat = { row: 5, col: 7 };
  var pendingHall = 0;
  var seatZoom = 1;
  var seatFitZoom = 1;
  var canvas = document.getElementById('theatreCanvas');
  var renderer = null, scene = null, camera = null, hallGroup = null;
  var screenTexture = null, sampleCanvas = null, sampleCtx = null;
  var raf = 0, zoomAnimation = 0, sampleTime = 0, toastTimer = null, audioCtx = null;
  var video = null, videoTexture = null, videoUrl = '';

  function byId(id) { return document.getElementById(id); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function currentHall() { return halls[state.hall]; }
  function hallRows() { return currentHall().rows; }
  function hallCols() { return currentHall().cols; }
  function normalizeSeat() {
    state.row = clamp(state.row, 1, hallRows());
    state.col = clamp(state.col, 1, hallCols());
  }
  function currentSeat() {
    var center = (hallCols() + 1) / 2;
    return {
      row: state.row,
      col: state.col,
      badge: state.row + '排' + String(state.col).padStart(2, '0') + '座',
      name: state.col < 4 ? '左侧位置' : (state.col > 9 ? '右侧位置' : '中央位置'),
      pan: clamp((state.col - center) / center, -1, 1),
      key: state.row === Math.ceil(hallRows() / 2) && state.col === Math.ceil(hallCols() / 2) ? 'best' : ''
    };
  }
  function material(color, roughness) {
    return new THREE.MeshStandardMaterial({
      color: color, roughness: roughness || .82, metalness: .02,
      emissive: color, emissiveIntensity: .018
    });
  }

  function renderHallList() {
    var list = byId('hallList');
    list.innerHTML = '';
    var activeHall = byId('hallPicker') && !byId('hallPicker').classList.contains('hidden') ? pendingHall : state.hall;
    halls.forEach(function (hall, index) {
      var card = document.createElement('button');
      card.className = 'hall-card' + (index === activeHall ? ' selected' : '');
      card.setAttribute('data-hall', hall.id);
      card.setAttribute('data-family', hall.family);
      card.innerHTML = '<div class="hall-art"></div><h2>' + hall.name + '</h2><p>' + hall.short + '</p><span class="hall-price">' + hall.price + '</span>';
      card.addEventListener('click', function () {
        pendingHall = index;
        renderHallList();
        renderHallDetail(index);
      });
      list.appendChild(card);
    });
  }

  function renderHallDetail(index) {
    var hall = halls[index == null ? state.hall : index];
    var html = '<strong>' + hall.name + ' · ' + hall.rows + '排 × ' + hall.cols + '座</strong><p>' + hall.intro + '</p>';
    byId('hallDetail').innerHTML = html;
    byId('hallPickerDetail').innerHTML = html;
  }
  function confirmHall() {
    state.hall = pendingHall;
    normalizeSeat();
    renderHallList(); renderHallDetail(state.hall); renderHomeSeatPicker();
    byId('hallSelectText').textContent = currentHall().name;
    hideDialog(byId('hallPicker'));
    if (renderer) buildTheatre();
  }

  function renderOneVisionPicker(id, levels, key) {
    var picker = byId(id);
    levels.forEach(function (level, index) {
      var option = picker.children[index];
      if (!option) {
        option = document.createElement('button');
        (function (optionIndex) {
          option.addEventListener('click', function () {
            state[key] = optionIndex;
            renderVisionPickers();
            updateVisionLabels();
            applyVision();
            drawSample();
            renderTheatre();
          });
        })(index);
        picker.appendChild(option);
      }
      option.className = 'vision-option' + (index === state[key] ? ' on' : '');
      option.textContent = level.short;
    });
  }
  function renderVisionPickers() {
    renderOneVisionPicker('homeNearPicker', nearLevels, 'near');
    renderOneVisionPicker('homeAstigPicker', astigLevels, 'astig');
  }

  function renderHomeSeatPicker() {
    var picker = byId('homeSeatPicker');
    picker.innerHTML = '';
    var button = document.createElement('button');
    button.className = 'hall-select-btn seat-select-btn';
    button.textContent = currentSeat().badge + ' · ' + currentSeat().name;
    button.addEventListener('click', openSeatModal);
    picker.appendChild(button);
  }

  function renderSeatPicker() {
    var picker = byId('seatPicker');
    picker.innerHTML = '';
    var button = document.createElement('button');
    button.className = 'hall-select-btn seat-chip seat-select-btn';
    button.textContent = currentSeat().badge + ' · 更换座位';
    button.addEventListener('click', openSeatModal);
    picker.appendChild(button);
  }

  function renderSeatMap(rebuildSeats) {
    var map = byId('seatMap');
    var labels = byId('rowLabels');
    var shouldBuild = rebuildSeats !== false;
    if (shouldBuild) {
      map.innerHTML = '';
      labels.innerHTML = '';
    }
    var seatUnit = 25;
    var seatTotal = hallCols() * seatUnit + 8;
    var screenRatio = currentHall().family === 'giant' ? .9 : (currentHall().family === 'premium' ? .8 : .72);
    var stage = map.parentNode;
    var track = stage.parentNode;
    var trackWidth = track.getBoundingClientRect().width || 300;
    var baseStageWidth = Math.max(trackWidth, seatTotal + 68);
    var screenWidth = Math.max(150, Math.round(seatTotal * screenRatio));
    var screenSign = byId('screenSign');
    var rowTop = (screenSign ? screenSign.offsetHeight : 21) + 16;
    var baseStageHeight = rowTop + hallRows() * 29;
    var groupStart = (baseStageWidth - hallCols() * seatUnit) / 2;
    var bestStartRow = Math.floor(hallRows() * .3) + 1;
    var bestEndRow = Math.floor(hallRows() * .7);
    var bestStartCol = Math.floor(hallCols() * .25) + 1;
    var bestEndCol = hallCols() - bestStartCol + 1;
    var bestTop = rowTop + (bestStartRow - 1) * 29;
    var bestHeight = Math.max(29, (bestEndRow - bestStartRow + 1) * 29);
    var bestLeft = groupStart + (bestStartCol - 1) * seatUnit - 2;
    var bestRight = groupStart + bestEndCol * seatUnit - 2;
    var labelPadding = 4;
    labels.style.top = (rowTop * seatZoom - labelPadding) + 'px';
    labels.style.width = '32px';
    labels.style.height = (hallRows() * 29 * seatZoom + labelPadding * 2) + 'px';
    labels.style.setProperty('--label-height', (hallRows() * 29 * seatZoom + labelPadding * 2) + 'px');
    labels.style.setProperty('--label-scale', seatZoom);
    labels.style.transform = 'translateY(-' + byId('seatTrack').scrollTop + 'px)';
    stage.style.width = Math.round(baseStageWidth) + 'px';
    stage.style.height = Math.round(baseStageHeight) + 'px';
    stage.style.transform = 'scale(' + seatZoom + ')';
    stage.style.transformOrigin = 'top left';
    stage.style.setProperty('--seat-zoom', seatZoom);
    var spacer = byId('seatZoomSpacer');
    if (spacer) {
      spacer.style.left = Math.round(baseStageWidth) + 'px';
      spacer.style.top = '0px';
      spacer.style.width = Math.round(baseStageWidth * Math.max(0, seatZoom - 1)) + 'px';
      spacer.style.height = Math.round(baseStageHeight * Math.max(0, seatZoom - 1)) + 'px';
    }
    stage.style.marginLeft = seatZoom < 1
      ? Math.max(0, (trackWidth - baseStageWidth * seatZoom) / 2) + 'px'
      : '0px';
    stage.classList.toggle('show-seat-numbers', seatZoom >= 1.35);
    stage.style.setProperty('--screen-width', screenWidth + 'px');
    stage.style.setProperty('--seat-top', rowTop + 'px');
    stage.style.setProperty('--center-x', Math.round(baseStageWidth / 2) + 'px');
    stage.style.setProperty('--content-height', (baseStageHeight - rowTop) + 'px');
    stage.style.setProperty('--best-top', bestTop + 'px');
    stage.style.setProperty('--best-height', bestHeight + 'px');
    stage.style.setProperty('--best-left', bestLeft + 'px');
    stage.style.setProperty('--best-width', Math.max(29, bestRight - bestLeft) + 'px');
    syncRowLabels();
    if (!shouldBuild) {
      byId('seatZoomValue').textContent = Math.round(seatZoom * 100) + '%';
      byId('seatTrack').classList.toggle('is-fit', seatZoom <= seatFitZoom + .001);
      syncRowLabels();
      return;
    }
    for (var row = 1; row <= hallRows(); row++) {
      var rowWrap = document.createElement('div');
      var rowSeats = document.createElement('div');
      rowWrap.className = 'seat-row';
      rowSeats.className = 'row-seats';
      var rowLabel = document.createElement('div');
      rowLabel.className = 'row-label-item';
      rowLabel.textContent = row + '排';
      labels.appendChild(rowLabel);
      for (var col = 1; col <= hallCols(); col++) {
        var button = document.createElement('button');
        button.className = 'map-seat' + (row === pendingSeat.row && col === pendingSeat.col ? ' on' : '');
        button.textContent = seatZoom >= 1.35 ? String(col).padStart(2, '0') : '';
        button.setAttribute('aria-label', row + '排' + String(col).padStart(2, '0') + '座');
        (function (r, c) {
          button.addEventListener('click', function () {
            pendingSeat.row = r; pendingSeat.col = c; renderSeatMap();
          });
        })(row, col);
        rowSeats.appendChild(button);
      }
      rowWrap.appendChild(rowSeats);
      map.appendChild(rowWrap);
    }
    byId('modalHallType').textContent = currentHall().name;
    byId('seatZoomValue').textContent = Math.round(seatZoom * 100) + '%';
    byId('seatTrack').classList.toggle('is-fit', seatZoom <= seatFitZoom + .001);
  }
  function syncRowLabels() {
    var labels = byId('rowLabels');
    var track = byId('seatTrack');
    if (!labels || !track) return;
    labels.style.transform = 'translateY(-' + track.scrollTop + 'px)';
  }
  function showDialog(element) {
    element.classList.remove('hidden');
  }
  function hideDialog(element) {
    element.classList.add('hidden');
  }
  function openSeatModal() {
    pendingSeat.row = state.row; pendingSeat.col = state.col;
    showDialog(byId('seatModal'));
    var track = byId('seatTrack');
    var stage = byId('seatMap').parentNode;
    stage.classList.add('no-zoom-transition');
    byId('rowLabels').classList.add('no-zoom-transition');
    seatZoom = 1;
    renderSeatMap();
    var baseWidth = parseFloat(stage.style.width) || track.getBoundingClientRect().width;
    var baseHeight = parseFloat(stage.style.height) || (42 + hallRows() * 29);
    var fitZoom = Math.min(track.clientWidth / baseWidth, track.clientHeight / baseHeight, 1);
    seatFitZoom = clamp(fitZoom, .45, 1);
    seatZoom = Number(seatFitZoom.toFixed(2));
    renderSeatMap();
    track.scrollLeft = seatZoom <= seatFitZoom + .001 ? 0 : Math.max(0, (track.scrollWidth - track.clientWidth) / 2);
    track.scrollTop = 0;
    syncRowLabels();
    requestAnimationFrame(function () {
      renderSeatMap(false);
      track.scrollLeft = 0;
      track.scrollTop = 0;
      syncRowLabels();
      requestAnimationFrame(function () {
        stage.classList.remove('no-zoom-transition');
        byId('rowLabels').classList.remove('no-zoom-transition');
      });
    });
  }
  function setSeatZoom(nextZoom, clientX, clientY, animate, onComplete) {
    var track = byId('seatTrack');
    if (!track) return;
    var stage = byId('seatMap').parentNode;
    if (zoomAnimation) {
      cancelAnimationFrame(zoomAnimation);
      zoomAnimation = 0;
    }
    var rect = track.getBoundingClientRect();
    var oldZoom = seatZoom;
    var oldMargin = parseFloat(stageMargin(stage)) || 0;
    var focalX = clientX == null ? rect.width / 2 : clientX - rect.left;
    var focalY = clientY == null ? rect.height / 2 : clientY - rect.top;
    var contentX = (track.scrollLeft + focalX - oldMargin) / oldZoom;
    var contentY = (track.scrollTop + focalY) / oldZoom;
    var next = clamp(Number(nextZoom.toFixed(2)), .45, 1.8);
    var rebuildSeats = (seatZoom < 1.35) !== (next < 1.35);
    var applyFrame = function (zoom, rebuild) {
      seatZoom = zoom;
      renderSeatMap(rebuild);
      var newMargin = parseFloat(stageMargin(stage)) || 0;
      var isFullyVisible = seatZoom <= seatFitZoom + .001;
      track.scrollLeft = isFullyVisible ? 0 : Math.max(0, contentX * seatZoom + newMargin - focalX);
      track.scrollTop = isFullyVisible ? 0 : Math.max(0, contentY * seatZoom - focalY);
      syncRowLabels();
    };
    stage.classList.add('no-zoom-transition');
    byId('rowLabels').classList.add('no-zoom-transition');
    if (animate === false || oldZoom === next) {
      applyFrame(next, rebuildSeats);
      stage.classList.remove('no-zoom-transition');
      byId('rowLabels').classList.remove('no-zoom-transition');
      if (onComplete) onComplete();
      return;
    }
    var startTime = performance.now();
    var duration = 220;
    var tick = function (now) {
      var progress = clamp((now - startTime) / duration, 0, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      applyFrame(oldZoom + (next - oldZoom) * eased, false);
      if (progress < 1) {
        zoomAnimation = requestAnimationFrame(tick);
        return;
      }
      applyFrame(next, rebuildSeats);
      zoomAnimation = 0;
      stage.classList.remove('no-zoom-transition');
      byId('rowLabels').classList.remove('no-zoom-transition');
      if (onComplete) onComplete();
    };
    zoomAnimation = requestAnimationFrame(tick);
  }
  function stageMargin(stage) {
    return stage && stage.style.marginLeft ? stage.style.marginLeft : '0';
  }
  function changeSeatZoom(delta) {
    var track = byId('seatTrack'), rect = track.getBoundingClientRect();
    setSeatZoom(seatZoom + delta, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  var pinchPointers = {};
  var pinchStartDistance = 0;
  var pinchStartZoom = 1;
  function pointerDistance(a, b) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  function bindSeatPinch() {
    var track = byId('seatTrack');
    track.addEventListener('scroll', syncRowLabels, { passive: true });
    track.addEventListener('pointerdown', function (event) {
      pinchPointers[event.pointerId] = event;
      if (Object.keys(pinchPointers).length === 2) {
        var points = Object.values(pinchPointers);
        pinchStartDistance = pointerDistance(points[0], points[1]);
        pinchStartZoom = seatZoom;
      }
    });
    track.addEventListener('pointermove', function (event) {
      if (!pinchPointers[event.pointerId]) return;
      pinchPointers[event.pointerId] = event;
      var ids = Object.keys(pinchPointers);
      if (ids.length !== 2 || !pinchStartDistance) return;
      event.preventDefault();
      var points = [pinchPointers[ids[0]], pinchPointers[ids[1]]];
      setSeatZoom(pinchStartZoom * pointerDistance(points[0], points[1]) / pinchStartDistance,
        (points[0].clientX + points[1].clientX) / 2,
        (points[0].clientY + points[1].clientY) / 2, false);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      track.addEventListener(type, function (event) {
        delete pinchPointers[event.pointerId];
        if (Object.keys(pinchPointers).length < 2) pinchStartDistance = 0;
      });
    });
  }
  function closeSeatModal() { hideDialog(byId('seatModal')); }
  function confirmSeat() {
    state.row = pendingSeat.row; state.col = pendingSeat.col;
    updateTheatreLabels(); renderHomeSeatPicker(); renderSeatPicker();
    renderTheatre(); playSeatCue(); closeSeatModal();
    showToast('已坐到 ' + currentSeat().badge);
  }

  function scoreForSeat() {
    var seat = currentSeat(), score = 94;
    if (seat.row === 1) score -= 16;
    if (seat.row >= 7) score -= 7;
    if (seat.col <= 2 || seat.col >= 11) score -= 12;
    if (seat.key === 'best') score = 96;
    score -= nearLevels[state.near].quality + astigLevels[state.astig].quality;
    if (currentHall().family === 'giant' && seat.row === 1) score -= 5;
    if (currentHall().family === 'wrap' && (seat.col <= 2 || seat.col >= 11)) score -= 7;
    return clamp(score, 42, 98);
  }
  function updateVisionLabels() {
    byId('nearValue').textContent = nearLevels[state.near].short;
    byId('astigValue').textContent = astigLevels[state.astig].short;
  }
  function visionBlur() {
    return nearLevels[state.near].blur + astigLevels[state.astig].blur;
  }
  function applyVision() {
    if (!canvas) return;
    var blur = visionBlur();
    var ghost = astigLevels[state.astig].blur > 0 ? ' drop-shadow(1px 0 rgba(255,180,155,.28))' : '';
    canvas.style.filter = 'blur(' + blur + 'px)' + ghost;
  }
  function updateTheatreLabels() {
    var hall = currentHall(), seat = currentSeat();
    byId('theatreTitle').textContent = hall.name;
    byId('seatHint').textContent = seat.key === 'best' ? '中央位置，画面与字幕最均衡' : (seat.row < 3 ? '距离银幕较近，沉浸感强但更容易疲劳' : (seat.row >= 7 ? '后排更放松，但银幕占视野比例略低' : '前方座椅逐排升高，视野更接近真实观影'));
    updateVisionLabels();
  }

  function openTheatre() {
    byId('homeView').classList.add('hidden');
    byId('theatreView').classList.remove('hidden');
    updateTheatreLabels(); renderSeatPicker(); updateSampleButton(); resizeRenderer(); buildTheatre();
  }
  function closeTheatre() {
    byId('theatreView').classList.add('hidden');
    state.sample = false; cancelAnimationFrame(raf);
    if (video) video.pause();
    byId('homeView').classList.remove('hidden');
    var homeScroll = byId('homeView').querySelector('.home-scroll');
    if (homeScroll) homeScroll.scrollTop = 0;
  }

  function makeSampleTexture() {
    sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 768; sampleCanvas.height = 432;
    sampleCtx = sampleCanvas.getContext('2d');
    screenTexture = new THREE.CanvasTexture(sampleCanvas);
    screenTexture.needsUpdate = true;
    drawSample();
  }
  function drawSample() {
    if (!sampleCtx || video) return;
    var c = sampleCtx, w = sampleCanvas.width, h = sampleCanvas.height, hall = currentHall();
    c.save();
    c.filter = 'none';
    var g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, hall.family === 'giant' ? '#09162f' : '#223c56');
    g.addColorStop(.55, hall.family === 'premium' ? '#d27962' : '#e19b6e');
    g.addColorStop(1, hall.family === 'wrap' ? '#242052' : '#172333');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,214,158,.7)';
    c.beginPath(); c.arc(w * (.72 + Math.sin(sampleTime * .001) * .025), h * .25, h * .14, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(10,17,32,.65)';
    c.beginPath(); c.moveTo(0, h * .73); c.lineTo(w * .25, h * .43); c.lineTo(w * .52, h * .72); c.lineTo(w * .75, h * .5); c.lineTo(w, h * .72); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    c.strokeStyle = 'rgba(255,220,183,.72)'; c.lineWidth = 2;
    for (var i = 0; i < 8; i++) { c.beginPath(); c.moveTo(w * (.08 + i * .12), h * .84); c.lineTo(w * (.16 + i * .12), h * .55); c.stroke(); }
    c.restore();
    if (screenTexture) screenTexture.needsUpdate = true;
  }

  function roundedBoxGeometry(width, height, depth, radius) {
    var shape = new THREE.Shape();
    var x = width / 2, y = height / 2, r = Math.min(radius, width / 2, height / 2);
    shape.moveTo(-x + r, -y);
    shape.lineTo(x - r, -y);
    shape.quadraticCurveTo(x, -y, x, -y + r);
    shape.lineTo(x, y - r);
    shape.quadraticCurveTo(x, y, x - r, y);
    shape.lineTo(-x + r, y);
    shape.quadraticCurveTo(-x, y, -x, y - r);
    shape.lineTo(-x, -y + r);
    shape.quadraticCurveTo(-x, -y, -x + r, -y);
    var geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: r * .42,
      bevelThickness: r * .42,
      curveSegments: 4
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }

  function createSeat(x, y, z, scale, color) {
    var group = new THREE.Group();
    var seatMat = material(color || 0x1b1820, .98);
    var armMat = material(0x111015, 1);
    var cushion = new THREE.Mesh(roundedBoxGeometry(.54 * scale, .16 * scale, .62 * scale, .08 * scale), seatMat);
    cushion.rotation.x = -Math.PI / 2;
    cushion.position.set(0, .62 * scale, 0);
    var back = new THREE.Mesh(roundedBoxGeometry(.54 * scale, 1.05 * scale, .14 * scale, .08 * scale), seatMat);
    back.position.set(0, 1.02 * scale, .24 * scale);
    back.rotation.x = -.08;
    var armL = new THREE.Mesh(roundedBoxGeometry(.1 * scale, .55 * scale, .7 * scale, .045 * scale), armMat);
    var armR = armL.clone();
    armL.position.set(-.34 * scale, .72 * scale, 0); armR.position.set(.34 * scale, .72 * scale, 0);
    group.add(cushion, back, armL, armR);
    group.position.set(x, y, z);
    return group;
  }

  function addRoomShell(roomW, roomD, roomCenterZ) {
    var floor = new THREE.Mesh(new THREE.BoxGeometry(roomW, .18, roomD), material(0x111017, 1));
    floor.position.set(0, -.1, roomCenterZ);
    hallGroup.add(floor);
    var wallMat = material(0x18151d, 1);
    var left = new THREE.Mesh(new THREE.BoxGeometry(.16, 7, roomD), wallMat);
    var right = left.clone();
    left.position.set(-roomW / 2, 3.5, roomCenterZ); right.position.set(roomW / 2, 3.5, roomCenterZ);
    var ceiling = new THREE.Mesh(new THREE.BoxGeometry(roomW, .15, roomD), material(0x0b0a0e, 1));
    ceiling.position.set(0, 7, roomCenterZ);
    hallGroup.add(left, right, ceiling);
  }

  function buildTheatre() {
    if (!renderer) initRenderer();
    while (hallGroup && hallGroup.children.length) hallGroup.remove(hallGroup.children[0]);
    var hall = currentHall();
    var roomW = Math.max(hall.family === 'giant' ? 16 : 11, hall.cols * .88 + 1.2), roomD = 18;
    var rowPitch = hall.family === 'comfort' ? 1.15 : (hall.family === 'motion' ? 1.08 : 1.04);
    var riserHeight = hall.family === 'giant' ? .2 : (hall.family === 'comfort' ? .14 : .17);
    var frontRowZ = 2.4;
    var backRowZ = frontRowZ + (hallRows() - 1) * rowPitch;
    roomD = backRowZ + 14;
    addRoomShell(roomW, roomD, (backRowZ - 9) / 2);
    var screenW = hall.family === 'giant' ? roomW * .86 : (hall.family === 'wrap' ? roomW * .64 : roomW * .74);
    var screenH = hall.family === 'giant' ? screenW * .52 : (hall.family === 'premium' ? 5.0 : 4.3);
    drawSample();
    var screenFrame = new THREE.Mesh(new THREE.BoxGeometry(screenW + .28, screenH + .28, .18), material(0x332a25, .7));
    screenFrame.position.set(0, 4.05, -10.1);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), new THREE.MeshBasicMaterial({ map: screenTexture }));
    // 相机在 +Z 一侧，银幕需放在边框前方，否则边框实体会把画面遮住。
    screen.position.set(0, 4.05, -9.99);
    hallGroup.add(screenFrame, screen);
    if (hall.family === 'wrap') {
      var sideMat = new THREE.MeshBasicMaterial({ map: screenTexture, color: 0x77717a });
      var sideL = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.4), sideMat);
      var sideR = sideL.clone();
      sideL.position.set(-roomW / 2 + .12, 3.9, -8.8); sideL.rotation.y = Math.PI / 2;
      sideR.position.set(roomW / 2 - .12, 3.9, -8.8); sideR.rotation.y = -Math.PI / 2;
      hallGroup.add(sideL, sideR);
    }
    var baseMat = hall.family === 'comfort' ? 0x30252a : (hall.family === 'motion' ? 0x281d28 : 0x201c25);
    for (var row = 1; row <= hallRows(); row++) {
      var z = frontRowZ + (row - 1) * rowPitch;
      var rise = (row - 1) * riserHeight;
      var platform = new THREE.Mesh(new THREE.BoxGeometry(roomW - .5, .16, rowPitch), material(0x1b1720, 1));
      platform.position.set(0, rise - .02, z);
      hallGroup.add(platform);
      for (var col = 1; col <= hallCols(); col++) {
        var x = (col - (hallCols() + 1) / 2) * .88;
        hallGroup.add(createSeat(x, rise, z, hall.family === 'comfort' ? 1.08 : 1, baseMat));
      }
    }
    updateCamera();
    renderTheatre();
  }

  function updateCamera() {
    if (!camera) return;
    var seat = currentSeat();
    var x = (seat.col - (hallCols() + 1) / 2) * .88;
    var hall = currentHall();
    var rowPitch = hall.family === 'comfort' ? 1.15 : (hall.family === 'motion' ? 1.08 : 1.04);
    var riserHeight = hall.family === 'giant' ? .2 : (hall.family === 'comfort' ? .14 : .17);
    var z = 2.4 + (seat.row - 1) * rowPitch;
    var y = 1.72 + (seat.row - 1) * riserHeight;
    camera.position.set(x, y, z);
    // 视线落在银幕下缘，前排椅背应从画面下方逐级出现。
    camera.lookAt(0, 2.45, -10.2);
  }
  function initRenderer() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09090d);
    camera = new THREE.PerspectiveCamera(58, 1, .1, 80);
    hallGroup = new THREE.Group(); scene.add(hallGroup);
    scene.add(new THREE.HemisphereLight(0x9da8cc, 0x15121a, 1.2));
    var key = new THREE.DirectionalLight(0xffead2, 1.4);
    key.position.set(0, 6, 2); scene.add(key);
    var seatFill = new THREE.PointLight(0xffcda8, 4.2, 16);
    seatFill.position.set(0, 2.6, 5); scene.add(seatFill);
    makeSampleTexture(); resizeRenderer();
  }
  function resizeRenderer() {
    if (!renderer) return;
    var w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function renderTheatre() {
    if (!renderer || byId('theatreView').classList.contains('hidden')) return;
    updateCamera();
    renderer.render(scene, camera);
  }
  function animateSample() {
    if (!state.sample) { raf = 0; return; }
    sampleTime += 16;
    if (!video) drawSample();
    renderTheatre();
    raf = requestAnimationFrame(animateSample);
  }

  function updateSampleButton() {
    var button = byId('sampleBtn');
    var chooseButton = byId('chooseVideoBtn');
    if (!button) return;
    if (!video) {
      button.classList.add('hidden');
      if (chooseButton) {
        chooseButton.classList.remove('hidden');
        chooseButton.innerHTML = '选择视频 <span>＋</span>';
      }
    } else {
      button.classList.remove('hidden');
      button.innerHTML = state.sample ? '暂停视频 <span>Ⅱ</span>' : '播放视频 <span>▶</span>';
      if (chooseButton) {
        chooseButton.classList.remove('hidden');
        chooseButton.innerHTML = '重新选择视频 <span>↻</span>';
      }
    }
  }

  function selectVideo(file) {
    if (!file || !file.type || file.type.indexOf('video/') !== 0) {
      showToast('请选择视频文件');
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = URL.createObjectURL(file);
    if (!video) {
      video = document.createElement('video');
      video.muted = false;
      video.volume = 1;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.preload = 'auto';
    }
    video.src = videoUrl;
    video.onloadeddata = function () {
      if (videoTexture) videoTexture.dispose();
      videoTexture = new THREE.VideoTexture(video);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.needsUpdate = true;
      screenTexture = videoTexture;
      state.sample = true;
      updateSampleButton();
      buildTheatre();
      video.play().catch(function () {});
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(animateSample);
    };
    video.load();
  }

  function getAudio() {
    if (audioCtx) return audioCtx;
    var AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    audioCtx = new AudioCtor(); return audioCtx;
  }
  function tone(freq, time, duration, pan) {
    var ac = getAudio(); if (!ac) return;
    var osc = ac.createOscillator(), gain = ac.createGain(), output = gain;
    if (ac.createStereoPanner) {
      var panner = ac.createStereoPanner(); panner.pan.value = pan;
      gain.connect(panner); panner.connect(ac.destination); output = panner;
    } else { gain.connect(ac.destination); }
    osc.connect(gain); osc.type = 'sine'; osc.frequency.value = freq;
    var now = ac.currentTime + time;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.12, now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.start(now); osc.stop(now + duration + .03); return output;
  }
  function playSeatCue() {
    var ac = getAudio(); if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    tone(392, 0, .38, currentSeat().pan); tone(523.25, .1, .44, currentSeat().pan * -.7);
  }
  function playSoundField() {
    var ac = getAudio();
    if (!ac) { showToast('当前设备不支持试听'); return; }
    if (ac.state === 'suspended') ac.resume();
    var pan = currentSeat().pan;
    tone(261.63, 0, .5, -.92 + pan * .12);
    tone(329.63, .36, .5, .92 + pan * .12);
    tone(392, .72, .64, pan);
    showToast(pan === 0 ? '中央声场：左右均衡' : '试听中：侧边位置声像更偏向一侧');
  }
  function showToast(text) {
    var toast = byId('toast'); toast.textContent = text; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1900);
  }
  function cycleVision(key, levels, label) {
    state[key] = (state[key] + 1) % levels.length;
    renderVisionPickers(); updateVisionLabels(); applyVision(); updateTheatreLabels(); drawSample(); renderTheatre();
    showToast(label + '：' + levels[state[key]].short);
  }
  function openVisionModal(key, levels, title) {
    var modal = byId('visionModal');
    var options = byId('visionOptions');
    byId('visionModalTitle').textContent = title;
    options.innerHTML = '';
    levels.forEach(function (level, index) {
      var option = document.createElement('button');
      option.className = 'vision-dialog-option' + (index === state[key] ? ' on' : '');
      option.textContent = level.short;
      option.addEventListener('click', function () {
        state[key] = index;
        renderVisionPickers();
        updateVisionLabels();
        applyVision();
        drawSample();
        renderTheatre();
        hideDialog(modal);
      });
      options.appendChild(option);
    });
    showDialog(modal);
  }
  function toggleOrientation() {
    var isPortrait = window.matchMedia('(orientation: portrait)').matches;
    var target = isPortrait ? 'landscape' : 'portrait';
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock(target).catch(function () {
        showToast('请使用系统旋转功能切换方向');
      });
    } else {
      showToast('当前设备不支持锁定屏幕方向');
    }
  }
  function switchHall() {
    state.hall = (state.hall + 1) % halls.length;
    normalizeSeat();
    renderHallList(); renderHallDetail(); renderHomeSeatPicker();
    byId('hallSelectText').textContent = currentHall().name;
    updateTheatreLabels(); buildTheatre();
    showToast('已切换：' + currentHall().name);
  }
  function bind() {
    renderHallList(); renderHallDetail(); renderHomeSeatPicker(); renderVisionPickers(); applyVision();
    byId('enterBtn').addEventListener('click', openTheatre);
    byId('backBtn').addEventListener('click', closeTheatre);
    byId('hallSwitchBtn').addEventListener('click', switchHall);
    byId('hallSelectBtn').addEventListener('click', function () {
      pendingHall = state.hall;
      renderHallList(); renderHallDetail(pendingHall);
      showDialog(byId('hallPicker'));
    });
    byId('closeHallPicker').addEventListener('click', function () { hideDialog(byId('hallPicker')); });
    byId('hallPicker').addEventListener('click', function (event) {
      if (event.target === byId('hallPicker')) hideDialog(byId('hallPicker'));
    });
    byId('confirmHall').addEventListener('click', confirmHall);
    byId('closeSeatModal').addEventListener('click', closeSeatModal);
    byId('confirmSeat').addEventListener('click', confirmSeat);
    byId('seatZoomOut').addEventListener('click', function () { changeSeatZoom(-.25); });
    byId('seatZoomIn').addEventListener('click', function () { changeSeatZoom(.25); });
    byId('seatZoomReset').addEventListener('click', function () {
      var track = byId('seatTrack'), rect = track.getBoundingClientRect();
      setSeatZoom(seatFitZoom, rect.left + rect.width / 2, rect.top + rect.height / 2, true);
    });
    bindSeatPinch();
    byId('seatModal').addEventListener('click', function (event) { if (event.target === byId('seatModal')) closeSeatModal(); });
    byId('soundTextBtn').addEventListener('click', playSoundField);
    byId('videoPicker').addEventListener('change', function (event) {
      selectVideo(event.target.files && event.target.files[0]);
      event.target.value = '';
    });
    byId('sampleBtn').addEventListener('click', function () {
      if (!video) {
        byId('videoPicker').click();
        return;
      }
      state.sample = !state.sample;
      if (state.sample) video.play().catch(function () {});
      else video.pause();
      updateSampleButton();
      cancelAnimationFrame(raf);
      if (state.sample) raf = requestAnimationFrame(animateSample); else renderTheatre();
    });
    byId('chooseVideoBtn').addEventListener('click', function () {
      byId('videoPicker').click();
    });
    byId('nearBtn').addEventListener('click', function () { openVisionModal('near', nearLevels, '选择近视度数'); });
    byId('astigBtn').addEventListener('click', function () { openVisionModal('astig', astigLevels, '选择散光度数'); });
    byId('closeVisionModal').addEventListener('click', function () { hideDialog(byId('visionModal')); });
    byId('visionModal').addEventListener('click', function (event) {
      if (event.target === byId('visionModal')) hideDialog(byId('visionModal'));
    });
    byId('orientationBtn').addEventListener('click', toggleOrientation);
    window.addEventListener('resize', function () {
      if (byId('theatreView').classList.contains('hidden')) return;
      resizeRenderer(); renderTheatre();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (state.sample) raf = requestAnimationFrame(animateSample);
      else renderTheatre();
    });
  }
  bind();
})();
