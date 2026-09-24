/* 影厅模拟器：真正的低面数 3D 影厅与第一人称座位视角 */
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
    { short: '200度', blur: .75, quality: 7 },
    { short: '300度', blur: 1.05, quality: 10 },
    { short: '400度', blur: 1.4, quality: 14 },
    { short: '600度', blur: 1.9, quality: 20 }
  ];
  var astigLevels = [
    { short: '0度', blur: 0, quality: 0 },
    { short: '50度', blur: .28, quality: 3 },
    { short: '100度', blur: .55, quality: 7 },
    { short: '150度', blur: .72, quality: 10 },
    { short: '200度', blur: .9, quality: 13 },
    { short: '300度', blur: 1.15, quality: 16 }
  ];
  var state = { hall: 0, row: 5, col: 7, near: 0, astig: 0, sample: false, light: false, height: 175, crowd: false };
  var heightOptions = [150, 155, 160, 165, 170, 175, 180, 185, 190];
  var pendingSeat = { row: 5, col: 7 };
  var pendingHall = 0;
  var seatZoom = 1;
  var seatFitZoom = 1;
  var SEAT_ZOOM_MIN = 0.52;
  var seatFitsView = true;
  var seatVisualW = 0;
  var seatVisualH = 0;
  var seatOffsetX = 0;
  var seatOffsetY = 0;
  var viewLayout = null;
  function layoutFor(hall) {
    var giant = hall.family === 'giant';
    var rowPitch = hall.family === 'comfort' ? 1.32 : (hall.family === 'motion' ? 1.15 : (giant ? 1.05 : 1.18));
    var roomW = Math.max(giant ? 18 : 12, hall.cols * 0.9 + 1.6);
    var aspect = hall.id === 'imax-gt' ? 1.43 : (giant ? 1.9 : (hall.family === 'premium' ? 2.39 : 2.2));
    var frontGap = giant ? 4.8 : 7.6;
    var backDist = frontGap + (hall.rows - 1) * rowPitch;
    var targetDeg = giant ? 34 : (hall.family === 'premium' ? 22 : 18);
    var screenH = 2 * backDist * Math.tan(targetDeg * Math.PI / 360);
    var screenW = screenH * aspect;
    var maxW = roomW * (giant ? 0.98 : 0.8);
    if (screenW > maxW) {
      screenW = maxW;
      screenH = screenW / aspect;
    }
    if (giant) {
      var minDeg = 30;
      var angle = Math.atan((screenH * 0.5) / backDist) * 360 / Math.PI;
      if (angle < minDeg) {
        var needDist = (screenH * 0.5) / Math.tan(minDeg * Math.PI / 360);
        rowPitch = Math.max(1.02, (needDist - frontGap) / Math.max(1, hall.rows - 1));
        backDist = frontGap + (hall.rows - 1) * rowPitch;
      }
    }
    /* 银幕竖向位置：巨幕/IMAX/CGS 下缘贴近地面；杜比/普通厅脚下留出台面（约 1.1–1.25m） */
    var screenBottomMin = giant ? 0.45
      : (hall.family === 'premium' ? 1.12
        : (hall.family === 'wrap' ? 1.05
          : (hall.family === 'motion' ? 1.15
            : (hall.family === 'comfort' ? 1.2 : 1.22))));
    var screenY;
    if (giant) {
      screenY = screenBottomMin + screenH * 0.5;
    } else {
      screenY = Math.max(2.75, 0.82 + screenH * 0.44);
      var screenBottom = screenY - screenH * 0.5;
      if (screenBottom < screenBottomMin) screenY += screenBottomMin - screenBottom;
    }
    var rises = sightlineRises(hall.rows, rowPitch, frontGap, screenY - screenH / 2);
    var lastRise = rises[rises.length - 1] || 0;
    return {
      rowPitch: rowPitch,
      rises: rises,
      roomW: roomW,
      roomD: backDist + 3.2,
      roomH: Math.max(7.4, screenY + screenH * 0.5 + 1.4, lastRise + 2.8),
      screenW: screenW,
      screenH: screenH,
      screenY: screenY,
      screenZ: 0,
      frontRowZ: frontGap
    };
  }
  // 眼睛靠在自己的椅背前。每排抬高到：看银幕下沿时，视线从上一排头顶上方过去。
  function sightlineRises(rows, pitch, frontGap, screenBottom) {
    var eyeOff = 0.1;
    var headOff = 0.1;
    var eye = 1.2;
    var crown = 1.34;
    var clearance = 0.1;
    var rises = [0];
    for (var row = 1; row < rows; row++) {
      var eyeZ = frontGap + row * pitch + eyeOff;
      var headZ = frontGap + (row - 1) * pitch + headOff;
      var k = (eyeZ - headZ) / eyeZ;
      var crownY = rises[row - 1] + crown;
      var eyeY = (crownY + clearance - screenBottom * k) / (1 - k);
      rises.push(Math.max(rises[row - 1] + 0.16, eyeY - eye));
    }
    return rises;
  }
  function rowRise(layout, row) {
    return layout.rises[row - 1] || 0;
  }
  var aimEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  var lookYaw = 0;
  var lookPitch = 0;
  /* 约 ±95° 水平，便于看到同排左右观众；垂直仍留抬头看银幕余量 */
  var LOOK_YAW_LIMIT = 1.65;
  var LOOK_PITCH_LIMIT = 1.35;
  /* 竖屏下垂直 FOV；横屏按相同水平 FOV 反算垂直 FOV，避免宽高比一变视角差很多 */
  var CAMERA_VFOV_PORTRAIT = 46;
  var lookDragging = false;
  var lookLastX = 0;
  var lookLastY = 0;
  var lookPointerId = null;
  var viewAnimating = false;
  var sheetTimers = {};
  var canvas = document.getElementById('theatreCanvas');
  var renderer = null, scene = null, camera = null, hallGroup = null;
  var hemiLight = null, keyLight = null, seatFillLight = null, screenBounce = null;
  /* 场灯（开灯时亮起的顶灯）：灯体挂在 hallGroup 里，每次 buildTheatre 重建；
     三盏 PointLight 常驻场景，靠 intensity 开关，不用反复 add/remove。 */
  var houseLamps = [], houseLights = [];
  var audienceGroup = null;
  var screenTexture = null, sampleCanvas = null, sampleCtx = null;
  var sampleImageTexture = null, sampleImageReady = false;
  var SAMPLE_SCREEN_URL = 'assets/sample-screen.jpg';
  var raf = 0, zoomAnimation = 0, sampleTime = 0, toastTimer = null, audioCtx = null;
  var video = null, videoTexture = null, videoUrl = '';

  function byId(id) { return document.getElementById(id); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
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
      pan: clamp((state.col - center) / center, -1, 1),
      key: state.row === Math.ceil(hallRows() / 2) && state.col === Math.ceil(hallCols() / 2) ? 'best' : ''
    };
  }
  function fabricMat(color) {
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: .78,
      metalness: 0,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
  }
  /* 影院黑绒椅：中性深色 albedo + 高粗糙 + sheen，开灯时仍偏黑、边缘有织物高光 */
  function seatFabricMat(color) {
    var base = {
      color: color,
      roughness: .97,
      metalness: 0,
      emissive: 0x000000,
      emissiveIntensity: 0
    };
    if (THREE.MeshPhysicalMaterial) {
      var mat = new THREE.MeshPhysicalMaterial(base);
      mat.sheen = 0.38;
      mat.sheenRoughness = 0.78;
      mat.sheenColor = new THREE.Color(0x141418);
      return mat;
    }
    return new THREE.MeshStandardMaterial(base);
  }
  function hallCarpetMat(color) {
    return seatFabricMat(color);
  }
  function plasticMat(color) {
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: .92,
      metalness: 0,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
  }
  function seatedEye(cm) {
    // 坐姿眼高：压实座面约 0.44m，眼高于座面约 0.52×身高 − 0.15m
    return 0.29 + cm * 0.0052;
  }
  /* 观众靠椅背：略低于正坐，头顶仍露出椅背上沿（椅背顶约 y≈1.06） */
  function audienceSlouchPose(cm, scale) {
    var eye = seatedEye(cm);
    return {
      bodyY: 0.74 * scale,
      bodyZ: 0.07 * scale,
      headY: eye - 0.05 * scale,
      headZ: 0.05 * scale,
      headTilt: 0.28
    };
  }
  function refreshEye() {
    if (!renderer || !byId('theatreView').classList.contains('is-open')) return;
    updateCamera();
    renderTheatre();
  }
  function renderBodyControls() {
    byId('heightValue').textContent = state.height + 'cm';
    byId('crowdBtn').classList.toggle('on', state.crowd);
    byId('crowdBtn').textContent = state.crowd ? '有人' : '空座';
    byId('crowdBtn').setAttribute('aria-pressed', state.crowd ? 'true' : 'false');
    var theatreCrowd = byId('crowdTheatreBtn');
    if (theatreCrowd) {
      theatreCrowd.classList.toggle('on', state.crowd);
      theatreCrowd.setAttribute('aria-label', state.crowd ? '隐藏周围的人' : '显示周围的人');
      theatreCrowd.setAttribute('aria-pressed', state.crowd ? 'true' : 'false');
    }
  }
  function stepHeight(dir) {
    var index = heightOptions.indexOf(state.height);
    if (index < 0) index = 0;
    state.height = heightOptions[clamp(index + dir, 0, heightOptions.length - 1)];
    renderBodyControls();
    refreshEye();
  }
  function toggleCrowd() {
    state.crowd = !state.crowd;
    renderBodyControls();
    fillAudience();
    renderTheatre();
    if (byId('theatreView').classList.contains('is-open')) {
      showToast(state.crowd ? '已显示周围的人' : '已隐藏周围的人');
    }
  }
  function material(color, roughness) {
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: roughness == null ? .88 : roughness,
      metalness: .02,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
  }

  function renderHallList() {
    var list = byId('hallList');
    list.innerHTML = '';
    var activeHall = byId('hallPicker') && byId('hallPicker').classList.contains('is-open') ? pendingHall : state.hall;
    halls.forEach(function (hall, index) {
      var card = document.createElement('button');
      card.className = 'hall-card' + (index === activeHall ? ' selected' : '');
      card.setAttribute('data-hall', hall.id);
      card.innerHTML = '<h2>' + hall.name + '</h2><p>' + hall.short + '</p><span class="hall-price">' + hall.price + '</span>';
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
    renderHallList(); renderHallDetail(state.hall); renderHomeSeatPicker(); renderHomeHall();
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

  function renderHomeHall() {
    var hall = currentHall();
    byId('hallSelectText').textContent = hall.name;
    byId('hallSelectSub').textContent = hall.short;
    byId('hallSelectPrice').textContent = hall.price;
    byId('hallSelectBtn').setAttribute('data-family', hall.family);
  }

  function renderHomeSeatPicker() {
    var picker = byId('homeSeatPicker');
    picker.innerHTML = '';
    var seat = currentSeat();
    var hall = currentHall();
    var button = document.createElement('button');
    button.className = 'ticket-row';
    button.type = 'button';
    button.innerHTML =
      '<span class="ticket-kicker">座位</span>' +
      '<span class="ticket-main">' +
        '<strong>' + seat.badge + '</strong>' +
        '<em>' + hall.rows + '排 · 每排' + hall.cols + '座</em>' +
      '</span>' +
      '<span class="ticket-tag" aria-hidden="true"></span>' +
      '<span class="chev" aria-hidden="true"></span>';
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

  function syncSeatMapShellHeight(visualH) {
    var track = byId('seatTrack');
    var shell = track && track.parentNode;
    if (!shell || !shell.classList.contains('seat-map-shell')) return;
    var vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    var cap = Math.min(vh * 0.38, 360);
    var floor = 132;
    var target = Math.ceil(visualH) + 8;
    shell.style.height = Math.round(Math.min(cap, Math.max(floor, target))) + 'px';
  }
  function resetSeatMapShellHeight() {
    var track = byId('seatTrack');
    var shell = track && track.parentNode;
    if (shell && shell.classList.contains('seat-map-shell')) shell.style.height = '';
  }
  function lockSeatMapShellHeight() {
    syncSeatMapShellHeight(seatVisualH);
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
    // 舞台按内容宽度，避免被拉满后银幕视觉偏左
    var baseStageWidth = seatTotal + 68;
    var screenWidth = Math.max(150, Math.round(seatTotal * screenRatio));
    var screenSign = byId('screenSign');
    var rowTop = (screenSign ? screenSign.offsetHeight : 21) + 16;
    var baseStageHeight = rowTop + hallRows() * 29 + 10;
    var groupStart = (baseStageWidth - hallCols() * seatUnit) / 2;
    var bestStartRow = Math.floor(hallRows() * .3) + 1;
    var bestEndRow = Math.floor(hallRows() * .7);
    var bestStartCol = Math.floor(hallCols() * .25) + 1;
    var bestEndCol = hallCols() - bestStartCol + 1;
    var bestTop = rowTop + (bestStartRow - 1) * 29;
    var bestHeight = Math.max(29, (bestEndRow - bestStartRow + 1) * 29);
    var bestLeft = groupStart + (bestStartCol - 1) * seatUnit - 2;
    var bestRight = groupStart + bestEndCol * seatUnit - 2;
    var visualW = baseStageWidth * seatZoom;
    var visualH = baseStageHeight * seatZoom;
    seatVisualW = visualW;
    seatVisualH = visualH;
    // clientWidth/Height 不受横屏 rotate(90deg) 影响
    var trackWidth = track.clientWidth || 300;
    var trackHeight = track.clientHeight || Math.max(132, Math.ceil(visualH));
    seatOffsetX = visualW < trackWidth ? (trackWidth - visualW) / 2 : 0;
    seatOffsetY = visualH < trackHeight ? (trackHeight - visualH) / 2 : 0;
    var labelPadding = 4;
    var labelWidth = 32;
    // 排号栏在 shell 坐标里定位，而座位在轨道内居中（seatOffsetX）。
    // 让它横向跟着座位组走、并始终留 4px 间隙，否则座位居中后两者会隔很远。
    labels.style.left = Math.round(track.offsetLeft + seatOffsetX + groupStart * seatZoom - labelWidth - 4) + 'px';
    labels.style.top = (seatOffsetY + rowTop * seatZoom - labelPadding) + 'px';
    labels.style.width = labelWidth + 'px';
    labels.style.height = (hallRows() * 29 * seatZoom + labelPadding * 2) + 'px';
    labels.style.setProperty('--label-height', (hallRows() * 29 * seatZoom + labelPadding * 2) + 'px');
    labels.style.setProperty('--label-scale', seatZoom);
    labels.style.transform = 'translateY(-' + byId('seatTrack').scrollTop + 'px)';
    stage.style.width = Math.round(baseStageWidth) + 'px';
    stage.style.height = Math.round(baseStageHeight) + 'px';
    stage.style.marginLeft = '0px';
    stage.style.marginTop = '0px';
    stage.style.transformOrigin = '0 0';
    stage.style.transform = 'translate(' + seatOffsetX + 'px,' + seatOffsetY + 'px) scale(' + seatZoom + ')';
    stage.style.setProperty('--seat-zoom', seatZoom);
    var spacer = byId('seatZoomSpacer');
    if (spacer) {
      spacer.style.left = '0px';
      spacer.style.top = '0px';
      spacer.style.width = Math.ceil(Math.max(visualW, trackWidth)) + 'px';
      spacer.style.height = Math.ceil(Math.max(visualH, trackHeight)) + 'px';
    }
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
      byId('seatTrack').classList.toggle('is-fit', seatIsFit());
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
    byId('seatTrack').classList.toggle('is-fit', seatIsFit());
  }
  function syncRowLabels() {
    var labels = byId('rowLabels');
    var track = byId('seatTrack');
    if (!labels || !track) return;
    labels.style.transform = 'translateY(-' + track.scrollTop + 'px)';
  }
  function showSheet(element) {
    if (!element) return;
    var id = element.id || 'sheet';
    if (sheetTimers[id]) {
      clearTimeout(sheetTimers[id]);
      sheetTimers[id] = null;
    }
    element.classList.add('is-open');
  }
  function hideSheet(element) {
    if (!element) return;
    var id = element.id || 'sheet';
    element.classList.remove('is-open');
    if (prefersReducedMotion()) return;
    if (sheetTimers[id]) clearTimeout(sheetTimers[id]);
    sheetTimers[id] = setTimeout(function () { sheetTimers[id] = null; }, 300);
  }
  function showDialog(element) { showSheet(element); }
  function hideDialog(element) { hideSheet(element); }
  function seatDefaultZoom() {
    return Math.min(1, Math.max(seatFitZoom, SEAT_ZOOM_MIN));
  }
  function scrollSeatIntoView() {
    var track = byId('seatTrack');
    var stage = byId('seatMap') && byId('seatMap').parentNode;
    if (!track || !stage) return;
    var seatUnit = 25;
    var baseWidth = parseFloat(stage.style.width) || track.clientWidth;
    var rowTop = parseFloat(stage.style.getPropertyValue('--seat-top')) || 38;
    var groupStart = (baseWidth - hallCols() * seatUnit) / 2;
    var cx = (groupStart + (pendingSeat.col - 0.5) * seatUnit) * seatZoom + seatOffsetX;
    var cy = (rowTop + (pendingSeat.row - 0.5) * 29) * seatZoom + seatOffsetY;
    var limit = seatScrollLimit(track);
    track.scrollLeft = clamp(cx - track.clientWidth / 2, 0, limit.x);
    track.scrollTop = clamp(cy - track.clientHeight / 2, 0, limit.y);
    syncRowLabels();
  }
  function seatContentFitsTrack() {
    var track = byId('seatTrack');
    if (!track) return false;
    return seatVisualW <= track.clientWidth + 2 && seatVisualH <= track.clientHeight + 2;
  }
  function seatIsFit() {
    return seatFitsView && seatZoom <= seatFitZoom + .001 && seatContentFitsTrack();
  }
  // 滚动边界必须按缩放后的实际可视尺寸算：舞台的布局盒是未缩放尺寸，
  // 直接读 scrollWidth/scrollHeight 会比可视内容大，能一路拖到座位全部移出视野。
  function seatScrollLimit(track) {
    return {
      x: Math.max(0, seatVisualW - track.clientWidth),
      y: Math.max(0, seatVisualH - track.clientHeight)
    };
  }
  function clampSeatScroll(track) {
    if (!track) return;
    var limit = seatScrollLimit(track);
    if (track.scrollLeft > limit.x) track.scrollLeft = limit.x;
    if (track.scrollTop > limit.y) track.scrollTop = limit.y;
    if (track.scrollLeft < 0) track.scrollLeft = 0;
    if (track.scrollTop < 0) track.scrollTop = 0;
  }
  function centerSeatTrack(track) {
    if (!track) return;
    if (seatIsFit()) {
      track.scrollLeft = 0;
      track.scrollTop = 0;
      return;
    }
    var limit = seatScrollLimit(track);
    track.scrollLeft = limit.x / 2;
    track.scrollTop = limit.y / 2;
  }
  function openSeatModal() {
    pendingSeat.row = state.row; pendingSeat.col = state.col;
    resetSeatMapShellHeight();
    showSheet(byId('seatModal'));
    requestAnimationFrame(function () {
      var track = byId('seatTrack');
      var stage = byId('seatMap').parentNode;
      stage.classList.add('no-zoom-transition');
      byId('rowLabels').classList.add('no-zoom-transition');
      seatZoom = 1;
      renderSeatMap();
      var baseWidth = parseFloat(stage.style.width) || track.clientWidth;
      var baseHeight = parseFloat(stage.style.height) || (42 + hallRows() * 29);
      var fitSlack = 10;
      var fitZoom = Math.min(
        (track.clientWidth - fitSlack) / baseWidth,
        (track.clientHeight - fitSlack) / baseHeight,
        1
      );
      if (!isFinite(fitZoom) || fitZoom <= 0) fitZoom = 1;
      seatFitZoom = clamp(fitZoom, .2, 1);
      seatFitsView = fitZoom >= seatFitZoom - .001;
      seatZoom = Number(seatDefaultZoom().toFixed(2));
      renderSeatMap();
      if (seatIsFit()) centerSeatTrack(track);
      else scrollSeatIntoView();
      requestAnimationFrame(function () {
        renderSeatMap(false);
        if (seatIsFit()) centerSeatTrack(track);
        else scrollSeatIntoView();
        lockSeatMapShellHeight();
        renderSeatMap(false);
        if (seatIsFit()) centerSeatTrack(track);
        else scrollSeatIntoView();
        requestAnimationFrame(function () {
          stage.classList.remove('no-zoom-transition');
          byId('rowLabels').classList.remove('no-zoom-transition');
        });
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
    var oldOffsetX = seatOffsetX;
    var oldOffsetY = seatOffsetY;
    var focalX = track.clientWidth / 2;
    var focalY = track.clientHeight / 2;
    if (!isSeatRotated() && clientX != null && clientY != null) {
      focalX = clientX - rect.left;
      focalY = clientY - rect.top;
    }
    var contentX = (track.scrollLeft + focalX - oldOffsetX) / oldZoom;
    var contentY = (track.scrollTop + focalY - oldOffsetY) / oldZoom;
    var next = clamp(Number(nextZoom.toFixed(2)), SEAT_ZOOM_MIN, 1.8);
    var rebuildSeats = (seatZoom < 1.35) !== (next < 1.35);
    var applyFrame = function (zoom, rebuild) {
      seatZoom = zoom;
      renderSeatMap(rebuild);
      var isFullyVisible = seatIsFit();
      if (isFullyVisible) {
        track.scrollLeft = 0;
        track.scrollTop = 0;
      } else {
        track.scrollLeft = Math.max(0, contentX * seatZoom + seatOffsetX - focalX);
        track.scrollTop = Math.max(0, contentY * seatZoom + seatOffsetY - focalY);
      }
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
    var duration = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 0 : 220;
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
  function resetSeatZoom() {
    var track = byId('seatTrack');
    if (!track) return;
    if (zoomAnimation) {
      cancelAnimationFrame(zoomAnimation);
      zoomAnimation = 0;
    }
    var wasZoomedIn = seatZoom >= 1.35;
    seatZoom = Number(seatDefaultZoom().toFixed(2));
    renderSeatMap(wasZoomedIn);
    if (seatIsFit()) centerSeatTrack(track);
    else scrollSeatIntoView();
  }
  function changeSeatZoom(delta) {
    var track = byId('seatTrack'), rect = track.getBoundingClientRect();
    setSeatZoom(seatZoom + delta, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  var pinchPointers = {};
  var pinchStartDistance = 0;
  var pinchStartZoom = 1;
  var panPointerId = null;
  var panActive = false;
  var panStartX = 0;
  var panStartY = 0;
  var panLastX = 0;
  var panLastY = 0;
  var seatMapSuppressClick = false;
  var PAN_THRESHOLD = 6;
  function isSeatLandscape() {
    return document.body.classList.contains('orientation-landscape')
      || byId('seatModal').classList.contains('orientation-landscape');
  }
  // 竖屏视口下横屏模式会加 .rotate-stage（见 applyLandscapeRotation）
  function isSeatRotated() {
    return byId('seatModal').classList.contains('rotate-90');
  }
  function seatTrackScrollable() {
    var track = byId('seatTrack');
    if (!track) return false;
    var limit = seatScrollLimit(track);
    return limit.x > 1 || limit.y > 1;
  }
  // 舞台用 transform 缩放，原生 scrollWidth 不可靠；放大后可拖拽平移（横屏旋转时轴互换）。
  function canPanSeatMap() {
    return seatTrackScrollable();
  }
  function pointerDistance(a, b) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  function bindSeatPinch() {
    var track = byId('seatTrack');
    track.addEventListener('scroll', function () {
      clampSeatScroll(track);
      syncRowLabels();
    }, { passive: true });
    track.addEventListener('pointerdown', function (event) {
      pinchPointers[event.pointerId] = event;
      if (Object.keys(pinchPointers).length === 2) {
        panPointerId = null;
        panActive = false;
        var points = Object.values(pinchPointers);
        pinchStartDistance = pointerDistance(points[0], points[1]);
        pinchStartZoom = seatZoom;
        return;
      }
      // 这里刻意不 setPointerCapture：一旦捕获，click 会被轨道截获，座位按钮就永远点不中。
      // 等拖动超过阈值、确认是拖拽而不是点击时，再接管指针。
      if (canPanSeatMap() && Object.keys(pinchPointers).length === 1) {
        panPointerId = event.pointerId;
        panActive = false;
        panStartX = event.clientX;
        panStartY = event.clientY;
      }
    });
    track.addEventListener('pointermove', function (event) {
      if (!pinchPointers[event.pointerId]) return;
      pinchPointers[event.pointerId] = event;
      var ids = Object.keys(pinchPointers);
      if (ids.length === 2 && pinchStartDistance) {
        event.preventDefault();
        var points = [pinchPointers[ids[0]], pinchPointers[ids[1]]];
        setSeatZoom(pinchStartZoom * pointerDistance(points[0], points[1]) / pinchStartDistance,
          (points[0].clientX + points[1].clientX) / 2,
          (points[0].clientY + points[1].clientY) / 2, false);
        return;
      }
      // 整屏 rotate(90deg) 后本地轴与屏幕轴互换：local.x = 屏幕 y，local.y = -屏幕 x。
      // 两个方向的符号按实机手感校准过，改其中一个会让横向/纵向其中一轴反过来。
      if (panPointerId === event.pointerId && canPanSeatMap()) {
        if (!panActive) {
          if (Math.hypot(event.clientX - panStartX, event.clientY - panStartY) < PAN_THRESHOLD) return;
          panActive = true;
          seatMapSuppressClick = true;
          panLastX = panStartX;
          panLastY = panStartY;
          try { track.setPointerCapture(event.pointerId); } catch (err) {}
        }
        event.preventDefault();
        var dx = event.clientX - panLastX;
        var dy = event.clientY - panLastY;
        panLastX = event.clientX;
        panLastY = event.clientY;
        if (isSeatRotated()) {
          track.scrollLeft += dy;
          track.scrollTop -= dx;
        } else {
          track.scrollLeft -= dx;
          track.scrollTop -= dy;
        }
        clampSeatScroll(track);
        syncRowLabels();
      }
    });
    track.addEventListener('wheel', function (event) {
      if (!seatTrackScrollable()) return;
      event.preventDefault();
      if (isSeatRotated()) {
        track.scrollLeft += event.deltaY;
        track.scrollTop -= event.deltaX;
      } else {
        track.scrollLeft += event.deltaX;
        track.scrollTop += event.deltaY;
      }
      clampSeatScroll(track);
      syncRowLabels();
    }, { passive: false });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      track.addEventListener(type, function (event) {
        delete pinchPointers[event.pointerId];
        if (panPointerId === event.pointerId) {
          panPointerId = null;
          panActive = false;
        }
        if (Object.keys(pinchPointers).length < 2) pinchStartDistance = 0;
      });
    });
    track.addEventListener('click', function (event) {
      if (!seatMapSuppressClick) return;
      seatMapSuppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  }
  function closeSeatModal() {
    hideDialog(byId('seatModal'));
    resetSeatMapShellHeight();
  }
  function confirmSeat() {
    state.row = pendingSeat.row; state.col = pendingSeat.col;
    lookYaw = 0; lookPitch = 0;
    updateTheatreLabels(); renderHomeSeatPicker(); renderSeatPicker();
    fillAudience();
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
    var near = byId('nearValue');
    var astig = byId('astigValue');
    if (near) near.textContent = nearLevels[state.near].short;
    if (astig) astig.textContent = astigLevels[state.astig].short;
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
    updateVisionLabels();
  }

  function openTheatre() {
    if (viewAnimating) return;
    var theatre = byId('theatreView');
    updateTheatreLabels(); renderSeatPicker(); updateSampleButton();
    theatre.classList.add('is-open');
    var landscape = theatre.classList.contains('orientation-landscape');
    applyLandscapeRotation(landscape);
    setSheetLandscape(landscape);
    resizeRenderer(); buildTheatre();
    if (prefersReducedMotion()) return;
    viewAnimating = true;
    setTimeout(function () { viewAnimating = false; }, 360);
  }
  function closeTheatre() {
    if (viewAnimating) return;
    var theatre = byId('theatreView');
    state.sample = false; cancelAnimationFrame(raf);
    if (video) video.pause();
    theatre.classList.remove('is-open');
    setSheetLandscape(false);
    var homeScroll = byId('homeView').querySelector('.home-scroll');
    if (homeScroll) homeScroll.scrollTop = 0;
    if (prefersReducedMotion()) return;
    viewAnimating = true;
    setTimeout(function () { viewAnimating = false; }, 360);
  }

  function applySampleImageTexture(tex) {
    if (video) return;
    sampleImageTexture = tex;
    sampleImageReady = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    if (screenTexture && screenTexture !== videoTexture && screenTexture.dispose) screenTexture.dispose();
    screenTexture = tex;
    if (byId('theatreView').classList.contains('is-open')) buildTheatre();
    else renderTheatre();
  }
  function makeSampleTexture() {
    if (sampleImageReady && sampleImageTexture) {
      screenTexture = sampleImageTexture;
      return;
    }
    sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 768; sampleCanvas.height = 432;
    sampleCtx = sampleCanvas.getContext('2d');
    sampleCtx.fillStyle = '#0a1020';
    sampleCtx.fillRect(0, 0, sampleCanvas.width, sampleCanvas.height);
    screenTexture = new THREE.CanvasTexture(sampleCanvas);
    screenTexture.needsUpdate = true;
    new THREE.TextureLoader().load(SAMPLE_SCREEN_URL, applySampleImageTexture, undefined, function () {
      drawSample();
      screenTexture = new THREE.CanvasTexture(sampleCanvas);
      screenTexture.needsUpdate = true;
      if (byId('theatreView').classList.contains('is-open')) buildTheatre();
    });
  }
  function drawSample() {
    if (!sampleCtx || video || sampleImageReady) return;
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
      bevelSegments: 12,
      steps: 1,
      bevelSize: r * .85,
      bevelThickness: r * .7,
      curveSegments: 20
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }

  var seatGeoCache = {};
  function seatGeometries(scale) {
    var key = String(scale);
    if (seatGeoCache[key]) return seatGeoCache[key];
    var geos = {
      cushion: roundedBoxGeometry(.52 * scale, .1 * scale, .5 * scale, .04 * scale),
      back: roundedBoxGeometry(.5 * scale, .62 * scale, .1 * scale, .04 * scale),
      head: roundedBoxGeometry(.38 * scale, .14 * scale, .1 * scale, .04 * scale),
      arm: roundedBoxGeometry(.08 * scale, .18 * scale, .4 * scale, .03 * scale),
      base: roundedBoxGeometry(.28 * scale, .32 * scale, .28 * scale, .03 * scale)
    };
    seatGeoCache[key] = geos;
    return geos;
  }

  function createSeat(x, y, z, scale, seatMat, armMat, baseMat) {
    var group = new THREE.Group();
    var geos = seatGeometries(scale);
    var cushion = new THREE.Mesh(geos.cushion, seatMat);
    cushion.position.set(0, .43 * scale, -.04 * scale);
    var back = new THREE.Mesh(geos.back, seatMat);
    back.position.set(0, .76 * scale, .2 * scale);
    back.rotation.x = .16;
    var head = new THREE.Mesh(geos.head, seatMat);
    head.position.set(0, 1.08 * scale, .16 * scale);
    head.rotation.x = .16;
    var armL = new THREE.Mesh(geos.arm, armMat);
    var armR = new THREE.Mesh(geos.arm, armMat);
    armL.position.set(-.3 * scale, .5 * scale, -.02 * scale);
    armR.position.set(.3 * scale, .5 * scale, -.02 * scale);
    var pedestal = new THREE.Mesh(geos.base, baseMat);
    pedestal.position.set(0, .19 * scale, 0);
    group.add(cushion, back, head, armL, armR, pedestal);
    group.position.set(x, y, z);
    return group;
  }

  function addRoomShell(roomW, roomD, roomCenterZ, roomH) {
    var h = roomH || 7.4;
    var floor = new THREE.Mesh(new THREE.BoxGeometry(roomW, .18, roomD), hallCarpetMat(0x040406));
    floor.position.set(0, -.1, roomCenterZ);
    hallGroup.add(floor);
    var wallMat = material(0x1c1820, .92);
    var left = new THREE.Mesh(new THREE.BoxGeometry(.16, h, roomD), wallMat);
    var right = left.clone();
    left.position.set(-roomW / 2, h / 2, roomCenterZ); right.position.set(roomW / 2, h / 2, roomCenterZ);
    var ceiling = new THREE.Mesh(new THREE.BoxGeometry(roomW, .15, roomD), material(0x100e14, .95));
    ceiling.position.set(0, h, roomCenterZ);
    hallGroup.add(left, right, ceiling);

    // 顶棚灯带：只有开灯时可见（MeshBasicMaterial 不吃灯光，关灯时要整块藏掉）
    houseLamps = [];
    var lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1d8 });
    var lampZStart = roomCenterZ - roomD / 2 + 2.6;
    var lampCount = Math.max(3, Math.round(roomD / 5.4));
    for (var i = 0; i < lampCount; i++) {
      for (var s = -1; s <= 1; s += 2) {
        var lamp = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.9, roomW * .2), .06, .42), lampMat);
        lamp.position.set(s * roomW * .24, h - 0.12, lampZStart + i * ((roomD - 5.2) / (lampCount - 1 || 1)));
        lamp.visible = false;
        houseLamps.push(lamp);
        hallGroup.add(lamp);
      }
    }
  }

  var audienceMats = null;
  function audienceMaterials() {
    if (audienceMats) return audienceMats;
    var black = seatFabricMat(0x050508);
    audienceMats = { cloth: black, skin: black, hair: black };
    return audienceMats;
  }
  function fillAudience() {
    if (audienceGroup && audienceGroup.parent) audienceGroup.parent.remove(audienceGroup);
    audienceGroup = null;
    if (!state.crowd || !hallGroup || !viewLayout) return;
    var mats = audienceMaterials();
    var layout = viewLayout;
    var scale = currentHall().family === 'comfort' ? 1.08 : 1;
    var bodyGeo = roundedBoxGeometry(.32 * scale, .42 * scale, .18 * scale, .07 * scale);
    var headGeo = new THREE.SphereGeometry(.082 * scale, 12, 10);
    // 发帽覆盖到头顶，避免皮肤从顶部露出；头部略微前移，避免嵌进椅背。
    var hairGeo = new THREE.SphereGeometry(.086 * scale, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.86);
    audienceGroup = new THREE.Group();
    var mine = currentSeat();
    for (var row = 1; row <= hallRows(); row++) {
      for (var col = 1; col <= hallCols(); col++) {
        if (row === mine.row && col === mine.col) continue;
        // 观众身高只做轻微差异，避免同排人物出现夸张高低差。
        var cm = 170 + ((row + col) % 3 - 1) * 3;
        var pose = audienceSlouchPose(cm, scale);
        var person = new THREE.Group();
        var body = new THREE.Mesh(bodyGeo, mats.cloth);
        body.position.set(0, pose.bodyY, pose.bodyZ);
        var head = new THREE.Mesh(headGeo, mats.skin);
        head.position.set(0, pose.headY, pose.headZ);
        head.rotation.x = pose.headTilt;
        var hair = new THREE.Mesh(hairGeo, mats.hair);
        hair.position.set(0, pose.headY + .012 * scale, pose.headZ + .006 * scale);
        hair.rotation.x = pose.headTilt + 0.18;
        hair.scale.set(1, .94, 1.06);
        person.add(body, head, hair);
        person.position.set(
          (col - (hallCols() + 1) / 2) * .88,
          rowRise(layout, row),
          layout.frontRowZ + (row - 1) * layout.rowPitch
        );
        audienceGroup.add(person);
      }
    }
    hallGroup.add(audienceGroup);
  }

  function buildTheatre() {
    if (!renderer) initRenderer();
    while (hallGroup && hallGroup.children.length) hallGroup.remove(hallGroup.children[0]);
    var hall = currentHall();
    var layout = layoutFor(hall);
    viewLayout = layout;
    var roomW = layout.roomW;
    var roomCenterZ = layout.frontRowZ + (hall.rows - 1) * layout.rowPitch * 0.45;
    addRoomShell(roomW, layout.roomD, roomCenterZ, layout.roomH);
    var screenW = layout.screenW;
    var screenH = layout.screenH;
    drawSample();
    var screenFrame = new THREE.Mesh(new THREE.BoxGeometry(screenW + .28, screenH + .28, .18), material(0x111111, .8));
    screenFrame.position.set(0, layout.screenY, layout.screenZ - 0.12);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), new THREE.MeshBasicMaterial({ map: screenTexture }));
    screen.position.set(0, layout.screenY, layout.screenZ);
    hallGroup.add(screenFrame, screen);
    if (hall.family === 'wrap') {
      var sideMat = new THREE.MeshBasicMaterial({ map: screenTexture, color: 0x77717a });
      var sideL = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.4), sideMat);
      var sideR = sideL.clone();
      sideL.position.set(-roomW / 2 + .12, layout.screenY, 1.4); sideL.rotation.y = Math.PI / 2;
      sideR.position.set(roomW / 2 - .12, layout.screenY, 1.4); sideR.rotation.y = -Math.PI / 2;
      hallGroup.add(sideL, sideR);
    }
    var seatScale = hall.family === 'comfort' ? 1.08 : 1;
    var seatMat = seatFabricMat(0x050508);
    var armMat = plasticMat(0x0a0a0c);
    var footMat = plasticMat(0x08080a);
    var rowPitch = layout.rowPitch;
    var frontRowZ = layout.frontRowZ;
    for (var row = 1; row <= hallRows(); row++) {
      var z = frontRowZ + (row - 1) * rowPitch;
      var rise = rowRise(layout, row);
      var prev = row > 1 ? rowRise(layout, row - 1) : 0;
      var stepH = Math.max(0.2, rise - prev + 0.08);
      var platform = new THREE.Mesh(new THREE.BoxGeometry(roomW - .5, stepH, rowPitch), hallCarpetMat(0x040406));
      platform.position.set(0, rise - stepH / 2, z);
      hallGroup.add(platform);
      for (var col = 1; col <= hallCols(); col++) {
        var x = (col - (hallCols() + 1) / 2) * .88;
        hallGroup.add(createSeat(x, rise, z, seatScale, seatMat, armMat, footMat));
      }
    }
    updateCamera();
    applyHallLight();
    fillAudience();
    renderTheatre();
  }

  /* 开灯 / 关灯：只改光强与环境色，不动银幕（银幕是 MeshBasicMaterial，
     本来就不参与光照，所以开灯不会把画面冲淡）。 */
  function applyHallLight() {
    var on = state.light;
    /* 关灯：中性弱光；开灯：偏白场灯照亮通道，避免暖光把黑绒染成褐 */
    if (hemiLight) {
      if (on) {
        hemiLight.color.setHex(0xc8ccd2);
        hemiLight.groundColor.setHex(0x060608);
        hemiLight.intensity = 1.05;
      } else {
        hemiLight.color.setHex(0x5c6066);
        hemiLight.groundColor.setHex(0x030303);
        hemiLight.intensity = 0.028;
      }
    }
    if (keyLight) {
      keyLight.color.setHex(on ? 0xe8eaee : 0x8a8e92);
      keyLight.intensity = on ? 0.88 : 0.03;
    }
    if (seatFillLight) {
      seatFillLight.color.setHex(on ? 0xd0d4d8 : 0x7a7e82);
      seatFillLight.intensity = on ? 0.78 : 0.012;
    }
    if (screenBounce) {
      screenBounce.color.setHex(on ? 0xb0b6be : 0x9aa0a8);
      screenBounce.intensity = on ? 0.14 : 0.045;
    }
    houseLights.forEach(function (light) {
      if (on) light.color.setHex(0xf4f6f8);
      light.intensity = on ? 3.75 : 0;
    });
    houseLamps.forEach(function (lamp) { lamp.visible = on; });
    if (scene) scene.background = new THREE.Color(on ? 0x2c2a34 : 0x07070a);
    var button = byId('lightBtn');
    if (button) {
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.setAttribute('aria-label', on ? '关灯' : '开灯');
    }
  }
  function toggleHallLight() {
    state.light = !state.light;
    if (state.light) ensureTheatreBuilt();
    applyHallLight();
    renderTheatre();
    showToast(state.light ? '已开灯：看清座椅与通道' : '已关灯：观影模式');
  }
  /* 只有在影厅已渲染过（home 页没建过 3D）时才需要重建灯体 */
  function ensureTheatreBuilt() {
    if (!renderer) initRenderer();
    if (!houseLamps.length && byId('theatreView').classList.contains('is-open')) buildTheatre();
  }

  function updateCamera() {
    if (!camera) return;
    var seat = currentSeat();
    var layout = viewLayout || layoutFor(currentHall());
    var rise = rowRise(layout, seat.row);
    var x = (seat.col - (hallCols() + 1) / 2) * .88;
    var z = layout.frontRowZ + (seat.row - 1) * layout.rowPitch + 0.1;
    var y = rise + seatedEye(state.height);
    camera.position.set(x, y, z);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, layout.screenY, layout.screenZ);
    aimEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    aimEuler.y -= lookYaw;
    aimEuler.x -= lookPitch;
    aimEuler.z = 0;
    camera.quaternion.setFromEuler(aimEuler);
  }
  function initRenderer() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    if (renderer.outputEncoding !== undefined && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    if (renderer.outputColorSpace !== undefined && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070a);
    camera = new THREE.PerspectiveCamera(46, 1, .04, 120);
    hallGroup = new THREE.Group(); scene.add(hallGroup);
    hemiLight = new THREE.HemisphereLight(0x5c6066, 0x030303, 0.028);
    scene.add(hemiLight);
    keyLight = new THREE.DirectionalLight(0x8a8e92, 0.03);
    keyLight.position.set(2.2, 6.5, 3.5); scene.add(keyLight);
    seatFillLight = new THREE.PointLight(0x7a7e82, 0.012, 14, 2);
    seatFillLight.position.set(0, 3.2, 6); scene.add(seatFillLight);
    screenBounce = new THREE.DirectionalLight(0x9aa0a8, 0.045);
    screenBounce.position.set(0, 3.8, -8); scene.add(screenBounce);
    houseLights = [-7, 0, 7].map(function (z) {
      var light = new THREE.PointLight(0xf4f6f8, 0, 26, 2);
      light.position.set(0, 6.2, z);
      scene.add(light);
      return light;
    });
    makeSampleTexture(); resizeRenderer();
    applyHallLight();
  }
  function cameraHorizontalFovDeg(vertFovDeg, aspect) {
    var v = vertFovDeg * Math.PI / 180;
    return 2 * Math.atan(Math.tan(v / 2) * aspect) * 180 / Math.PI;
  }
  function cameraVerticalFovFromHorizontal(hFovDeg, aspect) {
    var h = hFovDeg * Math.PI / 180;
    return clamp(2 * Math.atan(Math.tan(h / 2) / aspect) * 180 / Math.PI, 24, 75);
  }
  function referenceCameraHorizontalFovDeg() {
    var pw = Math.min(window.innerWidth, window.innerHeight);
    var ph = Math.max(window.innerWidth, window.innerHeight);
    return cameraHorizontalFovDeg(CAMERA_VFOV_PORTRAIT, pw / ph);
  }
  function applyCameraProjection(w, h) {
    if (!camera) return;
    var aspect = w / h;
    camera.aspect = aspect;
    camera.fov = cameraVerticalFovFromHorizontal(referenceCameraHorizontalFovDeg(), aspect);
    camera.updateProjectionMatrix();
  }
  function resizeRenderer() {
    if (!renderer) return;
    var canvasEl = canvas;
    var view = byId('theatreView');
    var w = Math.max(1, canvasEl.clientWidth || view.clientWidth || window.innerWidth);
    var h = Math.max(1, canvasEl.clientHeight || view.clientHeight || window.innerHeight);
    renderer.setSize(w, h, false);
    applyCameraProjection(w, h);
  }
  function renderTheatre() {
    if (!renderer || !byId('theatreView').classList.contains('is-open')) return;
    updateCamera();
    renderer.render(scene, camera);
  }
  function animateSample() {
    if (!state.sample) { raf = 0; return; }
    sampleTime += 16;
    if (!video && !sampleImageReady) drawSample();
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

  function xhsMiniTool() {
    return window.xhs && window.xhs.miniTool ? window.xhs.miniTool : null;
  }

  function isVideoFile(file) {
    if (!file) return false;
    if (file.type && file.type.indexOf('video/') === 0) return true;
    return /\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name || '');
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('read failed')); };
      reader.readAsDataURL(file);
    });
  }

  function ensureVideoEl() {
    if (video) return video;
    video = document.createElement('video');
    video.muted = false;
    video.volume = 1;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.onerror = function () {
      showToast('视频无法播放，请换更短 mp4 或先用样片');
    };
    return video;
  }

  function applyVideoSrc(src) {
    ensureVideoEl();
    if (videoUrl && videoUrl.indexOf('blob:') === 0) URL.revokeObjectURL(videoUrl);
    videoUrl = src;
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
      showToast('视频已载入');
    };
    video.src = src;
    video.load();
  }

  function selectVideo(file) {
    if (!isVideoFile(file)) {
      showToast('请选择视频文件');
      return;
    }
    var bridge = xhsMiniTool();
    if (bridge && typeof bridge.writeTempFile === 'function') {
      showToast('正在载入视频…');
      fileToDataUrl(file).then(function (dataUrl) {
        if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:') !== 0) {
          throw new Error('bad data url');
        }
        return bridge.writeTempFile({ data: dataUrl });
      }).then(function (res) {
        if (!res || !res.filePath) throw new Error('no path');
        applyVideoSrc(res.filePath);
      }).catch(function () {
        showToast('小红书内载入失败，请用更短视频（建议 30 秒内）');
      });
      return;
    }
    if (videoUrl && videoUrl.indexOf('blob:') === 0) URL.revokeObjectURL(videoUrl);
    videoUrl = URL.createObjectURL(file);
    applyVideoSrc(videoUrl);
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
  // 竖屏视口才需要把内容旋转 90° 摆成「横版」给横着拿手机的用户看；
  // 视口本身已经是横屏（抖音等允许横屏）时内容天然是横的，再转就整个侧躺了。
  function setSheetLandscape(on) {
    byId('seatModal').classList.toggle('orientation-landscape', on);
    byId('visionModal').classList.toggle('orientation-landscape', on);
    document.body.classList.toggle('orientation-landscape', on);
    document.documentElement.classList.toggle('orientation-landscape', on);
    if (!on) {
      byId('seatModal').classList.remove('rotate-90');
      byId('visionModal').classList.remove('rotate-90');
    }
  }
  function applyLandscapeRotation(isLandscape) {
    var rotate = !!isLandscape && window.innerHeight > window.innerWidth;
    byId('theatreView').classList.toggle('rotate-stage', rotate);
    byId('theatreView').classList.toggle('rotate-90', false);
    var sheetsToo = isLandscape && byId('theatreView').classList.contains('is-open');
    byId('seatModal').classList.toggle('rotate-90', sheetsToo && rotate);
    byId('visionModal').classList.toggle('rotate-90', sheetsToo && rotate);
    return rotate;
  }
  function toggleTheatreChrome() {
    var view = byId('theatreView');
    var collapsed = view.classList.toggle('chrome-collapsed');
    var btn = byId('chromeToggleBtn');
    btn.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    btn.setAttribute('aria-label', collapsed ? '显示控制栏' : '隐藏控制栏');
    renderTheatre();
  }
  function toggleOrientation() {
    var theatreView = byId('theatreView');
    var isLandscape = theatreView.classList.toggle('orientation-landscape');
    theatreView.classList.remove('chrome-collapsed');
    var chromeBtn = byId('chromeToggleBtn');
    if (chromeBtn) {
      chromeBtn.setAttribute('aria-pressed', 'false');
      chromeBtn.setAttribute('aria-label', '隐藏控制栏');
    }
    setSheetLandscape(isLandscape);
    applyLandscapeRotation(isLandscape);
    lookYaw = 0;
    lookPitch = 0;
    resizeRenderer();
    renderTheatre();
  }
  function switchHall() {
    state.hall = (state.hall + 1) % halls.length;
    normalizeSeat();
    renderHallList(); renderHallDetail(); renderHomeSeatPicker(); renderHomeHall();
    updateTheatreLabels(); buildTheatre();
    showToast('已切换：' + currentHall().name);
  }
  function lookDragSensitivity() {
    if (!camera || !canvas) return { yaw: 0.002, pitch: 0.002 };
    var h = Math.max(1, canvas.clientHeight);
    var w = Math.max(1, canvas.clientWidth);
    var vFov = camera.fov * Math.PI / 180;
    var hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    return { yaw: hFov / w, pitch: vFov / h };
  }
  function bindLookPan() {
    if (!canvas) return;
    canvas.addEventListener('pointerdown', function (event) {
      if (event.button != null && event.button !== 0) return;
      if (event.target !== canvas) return;
      lookDragging = true;
      lookPointerId = event.pointerId;
      lookLastX = event.clientX;
      lookLastY = event.clientY;
      canvas.classList.add('is-dragging');
      try { canvas.setPointerCapture(event.pointerId); } catch (err) {}
    });
    canvas.addEventListener('pointermove', function (event) {
      if (!lookDragging || event.pointerId !== lookPointerId) return;
      var dx = event.clientX - lookLastX;
      var dy = event.clientY - lookLastY;
      lookLastX = event.clientX;
      lookLastY = event.clientY;
      var sens = lookDragSensitivity();
      if (byId('theatreView').classList.contains('rotate-stage')) {
        lookYaw = clamp(lookYaw - dy * sens.yaw, -LOOK_YAW_LIMIT, LOOK_YAW_LIMIT);
        lookPitch = clamp(lookPitch + dx * sens.pitch, -LOOK_PITCH_LIMIT, LOOK_PITCH_LIMIT);
      } else {
        lookYaw = clamp(lookYaw - dx * sens.yaw, -LOOK_YAW_LIMIT, LOOK_YAW_LIMIT);
        lookPitch = clamp(lookPitch - dy * sens.pitch, -LOOK_PITCH_LIMIT, LOOK_PITCH_LIMIT);
      }
      renderTheatre();
    });
    function endLook(event) {
      if (event.pointerId !== lookPointerId) return;
      lookDragging = false;
      lookPointerId = null;
      canvas.classList.remove('is-dragging');
    }
    canvas.addEventListener('pointerup', endLook);
    canvas.addEventListener('pointercancel', endLook);
  }
  function bind() {
    renderHallList(); renderHallDetail(); renderHomeSeatPicker(); renderHomeHall(); renderVisionPickers(); renderBodyControls(); applyVision();
    byId('heightDown').addEventListener('click', function () { stepHeight(-1); });
    byId('heightUp').addEventListener('click', function () { stepHeight(1); });
    byId('crowdBtn').addEventListener('click', toggleCrowd);
    byId('crowdTheatreBtn').addEventListener('click', toggleCrowd);
    byId('enterBtn').addEventListener('click', openTheatre);
    byId('backBtn').addEventListener('click', closeTheatre);
    byId('hallSelectBtn').addEventListener('click', function () {
      pendingHall = state.hall;
      renderHallList(); renderHallDetail(pendingHall);
      showSheet(byId('hallPicker'));
    });
    byId('closeHallPicker').addEventListener('click', function () { hideSheet(byId('hallPicker')); });
    byId('hallPicker').addEventListener('click', function (event) {
      if (event.target === byId('hallPicker')) hideSheet(byId('hallPicker'));
    });
    byId('confirmHall').addEventListener('click', confirmHall);
    byId('closeSeatModal').addEventListener('click', closeSeatModal);
    byId('confirmSeat').addEventListener('click', confirmSeat);
    byId('seatZoomOut').addEventListener('click', function () { changeSeatZoom(-.25); });
    byId('seatZoomIn').addEventListener('click', function () { changeSeatZoom(.25); });
    byId('seatZoomReset').addEventListener('click', resetSeatZoom);
    bindSeatPinch();
    bindLookPan();
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
    byId('closeVisionModal').addEventListener('click', function () { hideSheet(byId('visionModal')); });
    byId('visionModal').addEventListener('click', function (event) {
      if (event.target === byId('visionModal')) hideSheet(byId('visionModal'));
    });
    byId('orientationBtn').addEventListener('click', toggleOrientation);
    byId('chromeToggleBtn').addEventListener('click', toggleTheatreChrome);
    byId('lightBtn').addEventListener('click', toggleHallLight);
    window.addEventListener('resize', function () {
      var rotatedBefore = isSeatRotated();
      if (document.body.classList.contains('orientation-landscape')) {
        var rotatedNow = applyLandscapeRotation(true);
        if (rotatedNow !== rotatedBefore && byId('seatModal').classList.contains('is-open')) {
          resetSeatZoom();
        }
      }
      if (!byId('theatreView').classList.contains('is-open')) return;
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
