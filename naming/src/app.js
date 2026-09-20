/* 仙鹿起名 · 界面与流程编排
 * 屏幕：home 首页 / quiz 测试 / bazi 生辰 / result 结果 / pool 候选池 / translit 音译 / studio 工作台 / fav 收藏
 */
(function () {
  var NM = window.NM;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var LS_FAV = 'naming.fav.v1';
  var LS_STATE = 'naming.state.v2';
  var STORAGE_MIN_CLIENT = 9460; /* 小红书客户端 9.46.0 */
  var state = {
    screen: 'home',
    answers: [],
    qi: 0,
    profile: null,
    wantGender: 'u',
    surname: null,
    current: null,
    shown: {},
    candidates: [],
    /* 一组「姓 + 名」的推荐结果，以及已经推过、不要重复出现的姓氏 */
    recs: [],
    recShown: {},
    /* 浮层的搜索词；「我的」里从收藏点进详情时记住来处，返回键要回「我的」 */
    surKeyword: '',
    detailFrom: 'result',
    fav: [],
    /* 推荐反馈：不喜欢的整名 / 排除字 / 想保留的字 */
    feedback: { banFull: {}, banChars: {}, keepChars: [] },
    /* 工作台：选姓与选字各自独立成页（studio-sur / studio-char），
     * 每页有各自的筛选，不筛选时列出全部。 */
    studio: {
      surname: null, slots: [], surKeyword: '', charKeyword: '',
      surF: { type: 'all', pop: 'all', letter: 'all' },
      charF: { dom: 'all', g: 'all', freq: 'all', letter: 'all' }
    },
    translit: { latin: '', result: null },
    /* 取英文名：推荐 / 分类自选 */
    enInput: '',
    enFrom: 'home',
    enMode: 'browse',
    enPicked: null,
    enF: { g: 'all', era: 'all', vibe: 'all', theme: 'all', lang: 'all', keyword: '' },
    /* 「我的」画像/生辰默认收起，避免占满首屏 */
    mineExpand: { profile: false, bazi: false },
    /* 生辰起名：公历生日 + 可选时辰 */
    baziForm: { y: 1998, m: 6, d: 15, hour: -1 },
    baziInfo: null,
    mode: 'zh',
    /* 存储后端：native（小红书 Storage）/ local / none */
    storage: { backend: 'local', ready: false, tip: '', tipShown: false }
  };

  var persistTimer = null;
  var sheetFocusReturn = null;

  function isXhsEnv() {
    return !!(window.xhs && window.xhs.miniTool);
  }

  function readBuildVersion(launchOptions) {
    var env = launchOptions && launchOptions.miniToolEnv;
    return Number(env && env.buildVersion) || 0;
  }

  function getClientVersion(buildVersion) {
    return Math.floor(buildVersion / 1000);
  }

  function isClientVersionAtLeast(buildVersion, minClientVersion) {
    return getClientVersion(buildVersion) >= minClientVersion;
  }

  function getBuildVersion() {
    var xhs = window.xhs;
    var sync = readBuildVersion(xhs && xhs.launchOptions);
    if (sync) return Promise.resolve(sync);
    var miniTool = xhs && xhs.miniTool;
    if (!miniTool || typeof miniTool.getLaunchOptions !== 'function') {
      return Promise.resolve(0);
    }
    return miniTool.getLaunchOptions().then(function (opts) {
      return readBuildVersion(opts);
    }).catch(function () { return 0; });
  }

  function canUseNativeStorage() {
    return getBuildVersion().then(function (bv) {
      var miniTool = window.xhs && window.xhs.miniTool;
      return (
        isClientVersionAtLeast(bv, STORAGE_MIN_CLIENT) &&
        !!miniTool &&
        typeof miniTool.setStorage === 'function' &&
        typeof miniTool.getStorage === 'function'
      );
    });
  }

  function saveData(key, data) {
    return canUseNativeStorage().then(function (ok) {
      if (ok) {
        return window.xhs.miniTool.setStorage({ key: key, data: data }).then(function () {
          state.storage.backend = 'native';
          return true;
        }).catch(function () { return false; });
      }
      try {
        localStorage.setItem(key, JSON.stringify(data));
        state.storage.backend = isXhsEnv() ? 'local' : 'local';
        return true;
      } catch (e) {
        return false;
      }
    });
  }

  function loadData(key) {
    return canUseNativeStorage().then(function (ok) {
      if (ok) {
        return window.xhs.miniTool.getStorage({ key: key }).then(function (res) {
          state.storage.backend = 'native';
          return res && res.data !== undefined ? res.data : null;
        }).catch(function () { return null; });
      }
      try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    });
  }

  function removeData(key) {
    return canUseNativeStorage().then(function (ok) {
      if (ok && typeof window.xhs.miniTool.removeStorage === 'function') {
        return window.xhs.miniTool.removeStorage({ key: key }).then(function () {
          return true;
        }).catch(function () { return false; });
      }
      try { localStorage.removeItem(key); return true; } catch (e) { return false; }
    });
  }

  function normalizeFavItem(f) {
    if (!f || typeof f !== 'object' || !f.full) return null;
    return {
      full: String(f.full),
      py: f.py || '',
      why: f.why || '',
      src: f.src || 'unknown',
      at: f.at || 0,
      note: f.note || ''
    };
  }

  function normalizeFeedback(fb) {
    var out = { banFull: {}, banChars: {}, keepChars: [] };
    if (!fb || typeof fb !== 'object') return out;
    if (fb.banFull && typeof fb.banFull === 'object') out.banFull = fb.banFull;
    if (fb.banChars && typeof fb.banChars === 'object') out.banChars = fb.banChars;
    if (Array.isArray(fb.keepChars)) {
      out.keepChars = fb.keepChars.filter(function (c) {
        return typeof c === 'string' && c.length === 1;
      }).slice(0, 4);
    }
    return out;
  }

  function feedbackOpts() {
    return {
      banFull: state.feedback.banFull || {},
      banChars: state.feedback.banChars || {},
      keepChars: state.feedback.keepChars || []
    };
  }

  function snapshotPersist() {
    return {
      v: 3,
      fav: state.fav.slice(0, 60),
      profile: state.profile,
      baziForm: state.baziForm,
      baziInfo: state.baziInfo
    };
  }

  function applyPersist(data) {
    if (!data || typeof data !== 'object') return;
    if (Array.isArray(data.fav)) {
      state.fav = data.fav.map(normalizeFavItem).filter(Boolean).slice(0, 60);
    }
    if (data.profile) state.profile = data.profile;
    if (data.baziForm && typeof data.baziForm === 'object') {
      state.baziForm.y = +data.baziForm.y || state.baziForm.y;
      state.baziForm.m = +data.baziForm.m || state.baziForm.m;
      state.baziForm.d = +data.baziForm.d || state.baziForm.d;
      state.baziForm.hour = data.baziForm.hour == null ? -1 : +data.baziForm.hour;
    }
    if (data.baziInfo) state.baziInfo = data.baziInfo;
    /* 偏好 / 工作台 / 英文名页等均为会话临时态，不从本地恢复 */
  }

  function clearSessionFeedback() {
    state.feedback = { banFull: {}, banChars: {}, keepChars: [] };
  }

  /* 推荐相关页：结果 / 详情 / 答题 / 生辰；离开后清空偏好 */
  function isRecommendFlow(screen) {
    return screen === 'result' || screen === 'detail' || screen === 'quiz' || screen === 'bazi';
  }

  function paintStorageTip() {
    var el = $('#storage-tip') || document.querySelector('.storage-tip-mine');
    var tip = state.storage.tip || '';
    var nodes = document.querySelectorAll('.storage-tip, .storage-tip-mine');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = tip;
      if (tip) nodes[i].removeAttribute('hidden');
      else nodes[i].setAttribute('hidden', '');
    }
    if (el) { /* keep linter quiet */ }
  }

  function setStorageTip(msg) {
    state.storage.tip = msg || '';
    paintStorageTip();
  }

  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      commitPersist();
    }, 280);
  }

  function commitPersist() {
    var payload = snapshotPersist();
    return saveData(LS_STATE, payload).then(function (ok) {
      if (!ok) {
        state.storage.backend = 'none';
        if (isXhsEnv()) setStorageTip('当前环境未能保存进度，关掉页面后可能丢失');
        else setStorageTip('浏览器未能保存进度，可检查是否禁用了本地存储');
        return false;
      }
      /* 同步旧 key，方便低版本 / 调试；失败忽略 */
      try { localStorage.setItem(LS_FAV, JSON.stringify(state.fav.slice(0, 60))); } catch (e) {}
      if (state.storage.tip && state.storage.backend !== 'none') {
        /* 写入成功后清掉失败提示；版本过低的提示保留 */
        if (state.storage.tip.indexOf('版本较低') === -1) setStorageTip('');
      }
      return true;
    });
  }

  function loadFavLegacy() {
    try {
      var raw = localStorage.getItem(LS_FAV);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map(normalizeFavItem).filter(Boolean) : [];
    } catch (e) { return []; }
  }

  function initPersist() {
    return loadData(LS_STATE).then(function (data) {
      if (data) {
        applyPersist(data);
      } else {
        /* 迁移旧收藏 */
        var legacy = loadFavLegacy();
        if (legacy.length) state.fav = legacy;
      }
      return canUseNativeStorage().then(function (nativeOk) {
        state.storage.ready = true;
        if (isXhsEnv() && !nativeOk) {
          state.storage.backend = 'local';
          setStorageTip('当前小红书版本较低，进度可能无法可靠保存；建议升级到 9.46 及以上');
        } else if (nativeOk) {
          state.storage.backend = 'native';
          /* 若刚从 localStorage 迁过来，立刻写入原生 Storage */
          if (!data && state.fav.length) commitPersist();
        }
        render();
      });
    }).catch(function () {
      state.storage.ready = true;
      var legacy = loadFavLegacy();
      if (legacy.length) state.fav = legacy;
      if (isXhsEnv()) setStorageTip('无法读取已存进度，将按新会话开始');
      render();
    });
  }

  function saveFav() {
    schedulePersist();
  }

  function clearAllLocalData() {
    state.fav = [];
    state.profile = null;
    state.baziInfo = null;
    state.feedback = { banFull: {}, banChars: {}, keepChars: [] };
    state.studio.slots = [];
    state.studio.surname = null;
    state.recs = [];
    state.current = null;
    state.enInput = '';
    state.enPicked = null;
    return removeData(LS_STATE).then(function () {
      try { localStorage.removeItem(LS_FAV); } catch (e) {}
      try { localStorage.removeItem(LS_STATE); } catch (e) {}
      toast('已清除本机数据');
      go('home');
    });
  }

  /* ── 通用 ─────────────────────────────────── */

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  /* 只有在需要「单个姓」的场景（工作台默认值）才随机取一个常见姓。
   * 结果页按已选姓调用 buildRecsForSurname 荐名。 */
  function randomSurname() {
    return NM.SURNAMES[Math.floor(Math.random() * Math.min(40, NM.SURNAMES.length))];
  }

  /* 七轴雷达图。用内联 SVG 画，不引外部库。
   * 近黑多边形 = 你的性格，蓝色多边形 = 这个名字的气质，形状差多少一眼能看出来。
   * selfOnly 只画「你」这一条：画像是自己的，那条蓝色实线没有参照物。
   * 轴标签是画在圆外头的，所以 svg 的盒子要比雷达本体大一圈（RADAR_PAD）：
   * 盒子只按本体量的话标签会溢出去，压到右边那列文字上。 */
  var RADAR_PAD = 12;
  function radarSvg(radar, size, selfOnly) {
    var body = size || 148;                 /* 雷达本体边长 */
    var S = body + RADAR_PAD * 2;           /* svg 盒子，含轴标签的地方 */
    var c = S / 2, R = body * 0.315, LR = body * 0.44;
    var n = radar.length;
    function pt(i, ratio) {
      var a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return [c + Math.cos(a) * R * ratio, c + Math.sin(a) * R * ratio];
    }
    function poly(ratio) {
      return radar.map(function (_, i) {
        var p = pt(i, ratio);
        return p[0].toFixed(1) + ',' + p[1].toFixed(1);
      }).join(' ');
    }
    function shape(key) {
      return radar.map(function (r, i) {
        var p = pt(i, Math.max(0.04, (r[key] || 0) / 100));
        return p[0].toFixed(1) + ',' + p[1].toFixed(1);
      }).join(' ');
    }

    var rings = [0.25, 0.5, 0.75, 1].map(function (r) {
      return '<polygon points="' + poly(r) + '" fill="none" stroke="rgba(190,160,150,0.28)" stroke-width="0.7"/>';
    }).join('');

    var spokes = radar.map(function (_, i) {
      var p = pt(i, 1);
      return '<line x1="' + c + '" y1="' + c + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) +
        '" stroke="rgba(190,160,150,0.20)" stroke-width="0.7"/>';
    }).join('');

    var labels = radar.map(function (r, i) {
      var a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      var x = c + Math.cos(a) * LR, y = c + Math.sin(a) * LR;
      var cos = Math.cos(a);
      var anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
      return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="9" ' +
        'text-anchor="' + anchor + '" dominant-baseline="middle" fill="#b09a92">' +
        esc(r.label) + '</text>';
    }).join('');

    return (
      '<svg width="' + S + '" height="' + S + '" viewBox="0 0 ' + S + ' ' + S + '" aria-hidden="true">' +
      rings + spokes +
      /* 名字形状在下层，你的人格在上层——这样自己这条线始终看得清 */
      (selfOnly ? '' :
        '<polygon points="' + shape('name') + '" fill="rgba(242,109,141,0.18)" stroke="rgba(242,109,141,0.8)" stroke-width="1.4" stroke-linejoin="round"/>') +
      '<polygon points="' + shape('mine') + '" fill="' + (selfOnly ? 'rgba(242,109,141,0.18)' : 'rgba(74,59,54,0.14)') + '" stroke="' + (selfOnly ? 'rgba(242,109,141,0.9)' : 'rgba(74,59,54,0.75)') + '" stroke-width="1.4" stroke-linejoin="round"/>' +
      labels +
      '</svg>'
    );
  }

  /* 右侧那列：七个轴，每行「轴名 + 你偏哪头」。
   * 数值用条子画出来（近黑 = 你，蓝 = 这个名字），比干巴巴写数字好看，
   * 也正好把雷达右边那块横向空间用起来。 */
  function radarItems(radar, selfOnly) {
    return radar.map(function (r) {
      var word = r.mine >= 50 ? r.high : r.low;
      return '<div class="axis axis-' + esc(r.key) + '">' +
        '<b>' + esc(r.label) + '</b>' +
        '<span class="axis-bars">' +
        '  <span class="axis-track you"><i style="width:' + r.mine + '%"></i></span>' +
        (selfOnly ? '' : '<span class="axis-track name"><i style="width:' + r.name + '%"></i></span>') +
        '</span>' +
        '<em>' + esc(word) + '</em></div>';
    }).join('');
  }

  /* selfOnly：画的是「你」一个人的画像，不放「你 / 这个名字」的对照说明，
   * 每一项也不重复写一遍名字的数值（那和自己那条是同一个数）。 */
  function radarBody(radar, selfOnly) {
    return (
      (selfOnly ? '' :
        '<div class="legend-key">' +
        '  <span><i class="k-you"></i>你</span>' +
        '  <span><i class="k-name"></i>这个名字</span>' +
        '</div>') +
      '<div class="radar-wrap">' + radarSvg(radar, null, selfOnly) +
      '  <div class="radar-legend">' + radarItems(radar, selfOnly) + '</div>' +
      '</div>'
    );
  }

  /* 性格画像块：雷达在左，右边那列是七条。
   * 结果页和「我的」共用一块，避免同一个画像在页面上出现两个标题、两张卡。 */
  function portraitBody(radar) {
    return (
      '<div class="radar-wrap">' + radarSvg(radar, null, true) +
      '  <div class="radar-legend">' + radarItems(radar, true) + '</div>' +
      '</div>'
    );
  }

  /* 「性格画像」标题行：一句话性格紧贴着标题右侧（不能让它被 space-between
   * 顶到最右边去），右边还能挂一个小按钮（「我的」里的「重新测」）。 */
  function portraitHead(desc, right) {
    return '<div class="card-title">' +
      '<span class="ct-name">性格画像' +
      (desc ? '<i class="ct-tag">' + esc(desc) + '</i>' : '') + '</span>' +
      (right || '') + '</div>';
  }

  /* 名人同字/同名卡片：详情页与工作台预览共用 */
  function celebCard(given, chars) {
    if (!NM.celebsForName) return '';
    var list = NM.celebsForName(given, chars, 3);
    if (!list.length) return '';
    var rows = list.map(function (x) {
      return '<div class="celeb-row">' +
        '<div class="celeb-top"><b>' + esc(x.name) + '</b>' +
        '<i class="celeb-how">' + esc(x.how) + '</i></div>' +
        '<div class="celeb-era">' + esc(x.era) + '</div>' +
        '<p class="celeb-bio">' + esc(x.bio) + '</p></div>';
    }).join('');
    return (
      '<section class="card">' +
      '  <div class="card-title">相关名人 <span class="muted">灵感参考</span></div>' +
      rows +
      '  <p class="hint" style="margin-top:10px">仅作文化联想，不代表姓名优劣。</p>' +
      '</section>'
    );
  }

  /* 独立成卡片（名字详情页用）。没有性格数据（如刷新后直接看收藏里的名字）时整块不出现。 */
  function radarCard(radar) {
    if (!radar || !radar.length) return '';
    return (
      '<section class="card">' +
      '  <div class="card-title">性格画像</div>' +
      radarBody(radar) +
      '</section>'
    );
  }

  /* ── 首页 ─────────────────────────────────── */

  function renderHome() {
    return (
      '<section class="entry-list">' +
      '  <button class="entry" data-go="result">' +
      '    <span class="entry-icon">性</span>' +
      '    <span class="entry-body"><b>按性格取名</b><i>先定姓氏，再按气质推荐名字</i></span>' +
      '    <span class="entry-arrow">›</span>' +
      '  </button>' +
      '  <button class="entry" data-go="en">' +
      '    <span class="entry-icon">英</span>' +
      '    <span class="entry-body"><b>取英文名</b><i>按性格推荐，或从中文名 / 分类里挑</i></span>' +
      '    <span class="entry-arrow">›</span>' +
      '  </button>' +
      '  <button class="entry" data-go="studio">' +
      '    <span class="entry-icon">选</span>' +
      '    <span class="entry-body"><b>自选姓名</b><i>自己挑姓和字，实时看读感与释义</i></span>' +
      '    <span class="entry-arrow">›</span>' +
      '  </button>' +
      '</section>' +

      '<p class="foot-note">所有计算都在本机完成 · 结果仅供参考</p>' +
      '<p class="storage-tip" id="storage-tip" hidden></p>'
    );
  }

  /* ── 我的：性格画像 + 收藏 ─────────────────
   * 画像来自「8 道题」；没测过就给一个空布局和「去测试」，点进测试流程。 */
  function foldProfileBlock(ex) {
    var p = state.profile;
    if (p && p.answered) {
      return (
        '<section class="card mine-fold">' +
        '  <button type="button" class="mine-fold-hd" data-mine-toggle="profile">' +
        '    <span class="mine-fold-main"><b>性格画像</b><i>' + esc(NM.describe(p)) + '</i></span>' +
        '    <span class="mine-fold-act">' + (ex.profile ? '收起' : '展开') + '</span>' +
        '  </button>' +
        (ex.profile
          ? ('<div class="mine-fold-body">' +
            portraitBody(NM.radarSelf(p)) +
            '<button class="link-btn" data-go="quiz">重新测</button></div>')
          : '') +
        '</section>'
      );
    }
    return (
      '<section class="card mine-fold">' +
      '  <button type="button" class="mine-fold-hd" data-go="quiz">' +
      '    <span class="mine-fold-main"><b>性格画像</b><i>还没有，去测 8 道题</i></span>' +
      '    <span class="mine-fold-act">去测试</span>' +
      '  </button>' +
      '</section>'
    );
  }

  function foldBaziBlock(ex) {
    var bazi = currentBazi();
    if (bazi) {
      return (
        '<section class="card mine-fold">' +
        '  <button type="button" class="mine-fold-hd" data-mine-toggle="bazi">' +
        '    <span class="mine-fold-main"><b>生辰八字</b><i>' + esc(bazi.pillarStr || bazi.summary || '') + '</i></span>' +
        '    <span class="mine-fold-act">' + (ex.bazi ? '收起' : '展开') + '</span>' +
        '  </button>' +
        (ex.bazi
          ? ('<div class="mine-fold-body">' +
            '<p class="bazi-sum" style="margin-top:0">' + esc(bazi.summary) + '</p>' +
            '<div class="bazi-meta">' + esc(bazi.solar.y + '/' + bazi.solar.m + '/' + bazi.solar.d) +
            (bazi.lunar ? ' · ' + esc(lunarText(bazi.lunar)) : '') + '</div>' +
            '<div class="wx-bars">' + wxBars(bazi.counts) + '</div>' +
            '<button class="link-btn" data-go="bazi">改生辰</button></div>')
          : '') +
        '</section>'
      );
    }
    return (
      '<section class="card mine-fold">' +
      '  <button type="button" class="mine-fold-hd" data-go="bazi">' +
      '    <span class="mine-fold-main"><b>生辰八字</b><i>未添加，可作推荐辅助</i></span>' +
      '    <span class="mine-fold-act">添加</span>' +
      '  </button>' +
      '</section>'
    );
  }

  function renderMine() {
    var ex = state.mineExpand || { profile: false, bazi: false };

    var rows = state.fav.map(function (f, i) {
      var meta = [];
      if (f.src && f.src !== 'unknown') meta.push(favSrcLabel(f.src));
      if (f.note) meta.push(f.note);
      return '<div class="fav-row" data-fav-open="' + i + '">' +
        '<button class="fav-open" data-fav-open="' + i + '">' +
        '  <span class="fav-body"><b>' + esc(f.full) + '</b>' +
        (meta.length ? '<i class="fav-meta">' + esc(meta.join(' · ')) + '</i>' : '') +
        '</span>' +
        '</button>' +
        '<button class="fav-del" data-fav-del="' + i + '" aria-label="取消收藏">' +
        '  <svg viewBox="0 0 24 24"><path d="M12 20.5S3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6c0 5.8-8.5 10.9-8.5 10.9z"/></svg>' +
        '</button></div>';
    }).join('');

    var list = rows
      ? '<div class="mine-sec">收藏 · ' + state.fav.length + '</div>' +
        '<section class="card fav-card">' + rows + '</section>'
      : '<div class="mine-sec">收藏</div>' +
        '<section class="card"><p class="empty" style="padding:26px 12px">还没有收藏。看到喜欢的名字，点「收藏」就存这儿了。</p></section>';

    /* 资料置顶；画像/生辰默认收起 */
    return foldProfileBlock(ex) + foldBaziBlock(ex) + list;
  }

  function favSrcLabel(src) {
    return ({
      quiz: '性格推荐', bazi: '生辰', result: '推荐', detail: '详情',
      studio: '自选', translit: '西名中起', en: '英文名', unknown: ''
    })[src] || '';
  }

  /* ── 测试 ─────────────────────────────────── */

  function renderQuiz() {
    var qs = NM.QUESTIONS;
    /* 答完直接切结果页（finishQuiz），不再插一屏「正在排序…」的等待页 */
    if (state.qi >= qs.length) return renderResult();
    var q = qs[state.qi];
    var dots = qs.map(function (_, i) {
      return '<i class="' + (i < state.qi ? 'done' : i === state.qi ? 'cur' : '') + '"></i>';
    }).join('');

    var opts = q.options.map(function (o, i) {
      return '<button class="option" data-ans="' + i + '">' +
        '<span class="opt-key">' + String.fromCharCode(65 + i) + '</span>' +
        '<span>' + esc(o.text) + '</span></button>';
    }).join('');

    return (
      '<div class="quiz-top">' +
      '  <div class="dots">' + dots + '</div>' +
      '  <span class="quiz-count">' + (state.qi + 1) + ' / ' + qs.length + '</span>' +
      '</div>' +
      '<h2 class="q-text">' + esc(q.text) + '</h2>' +
      '<div class="options">' + opts + '</div>' +
      (state.qi > 0 ? '<button class="ghost-btn" data-back-q>上一题</button>' : '')
    );
  }

  function withFeedback(opts) {
    var fb = feedbackOpts();
    opts = opts || {};
    opts.banFull = fb.banFull;
    opts.banChars = fb.banChars;
    opts.keepChars = fb.keepChars;
    return opts;
  }

  /* 按当前偏好重算这个姓下的候选；换名 / 备选都必须走这里，否则会用到偏好变更前的旧列表 */
  function rebuildCandidates() {
    state.candidates = (state.profile && state.surname)
      ? NM.namesForSurname(state.profile, state.surname, withFeedback({ wantGender: state.wantGender }))
      : [];
    return state.candidates;
  }

  /* 偏好刚改完：清掉「已看过」里不合规的，必要时换掉当前名。排除/保留是硬过滤。 */
  function applyFeedbackToDetail(opts) {
    opts = opts || {};
    rebuildCandidates();
    state.shown = {};
    var cur = state.current;
    if (!cur) return { ok: true, swapped: false };
    var keep = state.feedback.keepChars || [];
    var ban = state.feedback.banChars || {};
    var ok = true;
    var i;
    if (state.feedback.banFull && state.feedback.banFull[cur.full]) ok = false;
    for (i = 0; i < (cur.chars || []).length; i++) {
      if (ban[cur.chars[i]]) { ok = false; break; }
    }
    for (i = 0; i < keep.length; i++) {
      if ((cur.chars || []).indexOf(keep[i]) === -1) { ok = false; break; }
    }
    if (ok && !opts.forceSwap) {
      state.shown[cur.full] = 1;
      return { ok: true, swapped: false };
    }
    var nxt = NM.sampleTop(state.candidates, 0.7, 1, state.shown);
    if (nxt.length) {
      state.current = nxt[0];
      state.shown[nxt[0].full] = 1;
      return { ok: true, swapped: true };
    }
    if (state.candidates.length) {
      state.current = state.candidates[0];
      state.shown[state.current.full] = 1;
      return { ok: true, swapped: true };
    }
    return { ok: false, swapped: false };
  }

  function refreshRecs() {
    if (!state.profile) return;
    /* 国内主路径：必须先有姓，只在该姓下荐名 */
    if (!state.surname) {
      state.recs = [];
      return;
    }
    state.recs = buildRecsForSurname(state.surname, {
      count: 6, exclude: state.recShown
    });
    if (!state.recs.length) {
      state.recShown = {};
      state.recs = buildRecsForSurname(state.surname, { count: 6 });
    }
  }

  /* 固定姓氏下，把 namesForSurname 结果收成结果页用的 rec 结构 */
  function buildRecsForSurname(surname, opts) {
    opts = opts || {};
    if (!state.profile || !surname) return [];
    var want = opts.count || 6;
    var exclude = opts.exclude || {};
    var list = NM.namesForSurname(state.profile, surname, withFeedback({
      wantGender: state.wantGender
    }));
    var pool = [];
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      var full = surname.c + x.given;
      if (exclude[x.given] || exclude[full]) continue;
      pool.push({
        surname: surname,
        name: x,
        given: x.given,
        chars: x.chars,
        full: full,
        fit: 1,
        euphony: x.euphony,
        score: x.mix != null ? x.mix : x.score
      });
    }
    var picked = NM.sampleTop(pool, opts.temperature || 0.28, want,
      {}, function (r) { return r.given; });
    return picked.length ? picked : pool.slice(0, want);
  }

  /* 推荐 /「我的」共用的偏好管理卡：可逐项取消 */
  function feedbackPrefCard(opts) {
    opts = opts || {};
    var fb = state.feedback;
    var banNames = Object.keys(fb.banFull || {});
    var banChars = Object.keys(fb.banChars || {});
    var keep = fb.keepChars || [];
    if (!banNames.length && !banChars.length && !keep.length) return '';

    var keepChips = keep.length
      ? '<div class="pref-row"><span class="pref-k keep">保留</span><div class="pref-chips">' +
        keep.map(function (ch) {
          return '<button type="button" class="pref-tag keep" data-unkeep-char="' + esc(ch) + '" title="取消保留">' +
            esc(ch) + '<i aria-hidden="true">×</i></button>';
        }).join('') + '</div></div>'
      : '';

    var banChips = banChars.length
      ? '<div class="pref-row"><span class="pref-k ban">排除</span><div class="pref-chips">' +
        banChars.map(function (ch) {
          return '<button type="button" class="pref-tag ban" data-unban-char="' + esc(ch) + '" title="取消排除">' +
            esc(ch) + '<i aria-hidden="true">×</i></button>';
        }).join('') + '</div></div>'
      : '';

    var banRow = banNames.length
      ? '<div class="pref-row pref-row-link">' +
        '<span class="pref-k">不喜欢</span>' +
        '<button type="button" class="pref-link" data-open-sheet="ban-names">' +
        banNames.length + ' 个名字<span>管理</span></button></div>'
      : '';

    var emptyNote = opts.empty
      ? '<p class="pref-empty-msg">当前偏好把候选都筛掉了，可点标签取消，或清空偏好。</p>'
      : '';

    return (
      '<section class="card pref-card">' +
      '  <div class="card-title">推荐偏好' +
      '    <button type="button" class="link-btn" data-clear-feedback>清空</button></div>' +
      '<div class="pref-body">' + keepChips + banChips + banRow + '</div>' +
      emptyNote +
      '</section>'
    );
  }

  function banNamesSheetHtml() {
    var names = Object.keys(state.feedback.banFull || {});
    if (!names.length) {
      return '<p class="empty">还没有标记不喜欢的名字。在详情页点「换名」会自动记下来。</p>';
    }
    var rows = names.map(function (full) {
      return '<div class="ban-row">' +
        '<span class="ban-name">' + esc(full) + '</span>' +
        '<button type="button" class="link-btn" data-unban-name="' + esc(full) + '">恢复</button></div>';
    }).join('');
    return (
      '<p class="hint" style="margin:4px 0 8px">这些名字不会再出现在推荐里。点「恢复」取消一条。</p>' +
      '<div class="ban-list">' + rows + '</div>'
    );
  }

  function finishQuiz() {
    state.profile = NM.profileFromAnswers(state.answers);
    /* 测完若已有生辰，把宜补五行带上 */
    if (state.profile && state.baziInfo) {
      NM.attachBazi(state.profile, state.baziInfo);
    }
    /* 保留已选姓：国人通常姓已定，只重算该姓下的名 */
    state.shown = {};
    state.current = null;
    state.candidates = [];
    state.recShown = {};
    refreshRecs();
    /* 结果页顶掉答题页：返回键该回首页，不该回最后一题 */
    schedulePersist();
    go('result', true);
  }

  /* ── 生辰起名 ─────────────────────────────── */

  function daysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
  }

  function lunarText(lu) {
    if (!lu) return '';
    var mn = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
    var dn = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
      '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
      '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
    return '农历' + lu.y + '年' + (lu.leap ? '闰' : '') + mn[lu.m - 1] + '月' + (dn[lu.d] || lu.d + '日');
  }

  function wxBars(counts) {
    return NM.BAZI_WX.map(function (w) {
      var n = counts[w] || 0;
      var pct = Math.min(100, Math.round(n / 4 * 100));
      return '<div class="wx-row wx-' + w + '"><span class="wx-k">' + w + '</span>' +
        '<span class="wx-bar"><i style="width:' + pct + '%"></i></span>' +
        '<span class="wx-n">' + (Math.round(n * 10) / 10) + '</span></div>';
    }).join('');
  }

  function baziCard(info, right) {
    if (!info || !info.ok) return '';
    return (
      '<section class="card bazi-card">' +
      '  <div class="card-title"><span class="ct-name">生辰八字</span>' + (right || '') + '</div>' +
      '  <div class="bazi-pillars">' + esc(info.pillarStr) + '</div>' +
      '  <p class="bazi-sum">' + esc(info.summary) + '</p>' +
      '  <div class="bazi-meta">' + esc(info.solar.y + '/' + info.solar.m + '/' + info.solar.d) +
      (info.lunar ? ' · ' + esc(lunarText(info.lunar)) : '') + '</div>' +
      '  <div class="wx-bars">' + wxBars(info.counts) + '</div>' +
      '  <p class="hint" style="margin-top:10px">用字按宜补五行微调，性格仍是主轴。传统文化参考，不代表科学结论。</p>' +
      '</section>'
    );
  }

  function baziPromptCard() {
    return (
      '<section class="card bazi-card bazi-prompt">' +
      '  <div class="card-title"><span class="ct-name">生辰辅助</span></div>' +
      '  <p class="bazi-sum">补充出生日期，推荐时会参考宜补五行。</p>' +
      '  <button class="ghost-btn" data-go="bazi">加生辰</button>' +
      '</section>'
    );
  }

  function currentBazi() {
    return (state.profile && state.profile.bazi) || state.baziInfo || null;
  }

  function hourLabel(h) {
    if (h == null || h < 0) return '时辰未知';
    var zi = Math.floor(((h + 1) % 24) / 2);
    return NM.BAZI_HOURS[zi] || '时辰未知';
  }

  function renderBazi() {
    var f = state.baziForm;
    var maxD = daysInMonth(f.y, f.m);
    if (f.d > maxD) f.d = maxD;

    var preview = '';
    var info = NM.baziFromSolar(f.y, f.m, f.d, f.hour);
    if (info.ok) {
      preview =
        '<section class="card">' +
        '  <div class="card-title">预览</div>' +
        '  <div class="bazi-pillars">' + esc(info.pillarStr) + '</div>' +
        '  <p class="bazi-sum">' + esc(info.summary) + '</p>' +
        '  <div class="bazi-meta">' + esc(lunarText(info.lunar)) + '</div>' +
        '</section>';
    }

    return (
      '<section class="card">' +
      '  <div class="card-title">公历生日</div>' +
      '  <p class="hint">本地排盘，年柱以立春为界。时辰不清楚可留空。结果仅供参考，不代表科学结论。</p>' +
      '  <div class="bazi-pick">' +
      '    <button type="button" class="bazi-field" data-open-sheet="bazi-date">' +
      '      <b>' + f.y + '</b><i>年</i></button>' +
      '    <button type="button" class="bazi-field" data-open-sheet="bazi-date">' +
      '      <b>' + f.m + '</b><i>月</i></button>' +
      '    <button type="button" class="bazi-field" data-open-sheet="bazi-date">' +
      '      <b>' + f.d + '</b><i>日</i></button>' +
      '  </div>' +
      '  <label class="bazi-lab">时辰</label>' +
      '  <button type="button" class="bazi-field bazi-field-wide" data-open-sheet="bazi-hour">' +
      '    <b>' + esc(hourLabel(f.hour).split(' · ')[0]) + '</b>' +
      '    <i>' + esc(f.hour < 0 ? '不清楚可跳过' : (hourLabel(f.hour).split(' · ')[1] || '')) + '</i>' +
      '  </button>' +
      '  <label class="bazi-lab">取名偏向</label>' +
      '  <div class="chips">' +
      [['u', '不限'], ['f', '女生'], ['m', '男生']].map(function (g) {
        return '<button type="button" class="chip' + (state.wantGender === g[0] ? ' active' : '') +
          '" data-gender="' + g[0] + '">' + g[1] + '</button>';
      }).join('') +
      '  </div>' +
      '</section>' +
      preview
    );
  }

  function finishBazi() {
    var f = state.baziForm;
    var info = NM.baziFromSolar(f.y, f.m, f.d, f.hour);
    if (!info.ok) return toast(info.error || '生日无效');
    state.baziInfo = info;
    if (state.profile && state.profile.answered) {
      NM.attachBazi(state.profile, info);
    } else {
      state.profile = NM.profileFromBazi(info);
    }
    state.shown = {};
    state.current = null;
    state.candidates = [];
    state.recShown = {};
    refreshRecs();
    schedulePersist();
    go('result', true);
  }

  /* ── 结果 ─────────────────────────────────── */

  /* 精选名的真实分类（common / literary），拼装名标为「生成」 */
  function tagOf(x) {
    if (x.source !== 'curated') return '生成';
    for (var i = 0; i < NM.GIVEN.length; i++) {
      if (NM.GIVEN[i].n === x.given) return NM.GIVEN[i].tag === 'literary' ? '清雅' : '常见';
    }
    return '常见';
  }

  /* 单字标注：音译字没有实在含义，展示读音即可 */
  function charLabel(ch) {
    var n = NM.charNote(ch);
    return n.phon ? ch + '（' + n.py + '）' : ch + ' ' + n.text;
  }

  function whyFor(c) {
    if (c.note) return c.note;
    if (c.source === 'translit') return c.note;
    var parts = [];
    (c.chars || []).forEach(function (ch) {
      if (NM.getChar(ch)) parts.push(ch + '：' + NM.charNote(ch).text);
    });
    return parts.join('；');
  }

  /* ── 结果：按性格推荐一组「姓 + 名」 ─────── */

  function recRow(rec, i) {
    var saved = state.fav.some(function (f) { return f.full === rec.full; });
    return '<button class="rec' + (saved ? ' saved' : '') + '" data-rec="' + i + '">' +
      '<span class="rec-idx">' + (i + 1) + '</span>' +
      '<span class="rec-body">' +
      '  <span class="rec-top">' +
      '    <b class="rec-name">' + esc(rec.full) + '</b>' +
      '    <i class="rec-py">' + esc(NM.namePinyin(rec.surname, rec.chars)) + '</i>' +
      '  </span>' +
      '  <span class="rec-meta">' + esc(NM.euphonyLabel(rec.euphony)) +
      ' · ' + esc(tagOf(rec.name)) + '</span>' +
      '</span>' +
      '<span class="rec-go">›</span>' +
      '</button>';
  }

  function renderResult() {
    var p = state.profile;
    if (!p) return '<p class="empty">先做一遍测试，才知道该往哪个方向取。</p>';
    var hasSur = !!state.surname;
    var recs = hasSur ? (state.recs || []) : [];
    var hasQuiz = !!p.answered;
    /* 没选姓时先展开资料帮助决策；选好姓后收起，把空间留给推荐名 */
    var ex = hasSur
      ? { profile: false, bazi: false }
      : { profile: true, bazi: true };
    var folds = (hasQuiz ? foldProfileBlock(ex) : '') + foldBaziBlock(ex);

    if (!hasSur) {
      return folds;
    }

    var title = p.bazi && !hasQuiz
      ? '「' + esc(state.surname.c) + '」姓 · 按生辰宜补'
      : (p.bazi
        ? '「' + esc(state.surname.c) + '」姓 · 性格 + 生辰'
        : '「' + esc(state.surname.c) + '」姓 · 按性格推荐');
    var empty = !recs.length;
    var prefCard = feedbackPrefCard({ empty: empty });
    var banN = Object.keys(state.feedback.banFull || {}).length;
    var emptyBlock = empty
      ? ('<div class="rec-empty">' +
        '<p class="rec-empty-t">没找到合适的名字</p>' +
        '<p class="rec-empty-d">' +
        (prefCard
          ? '当前偏好把候选都筛掉了。点上方标签取消一条，或清空偏好。'
          : '可换个性别再试，或稍后再换一批。') +
        '</p>' +
        (prefCard
          ? ('<div class="rec-empty-actions">' +
            (banN
              ? '<button type="button" class="primary-btn" data-open-sheet="ban-names">管理不喜欢的名字</button>'
              : '') +
            '<button type="button" class="ghost-btn" data-clear-feedback>清空全部偏好</button>' +
            '</div>')
          : '') +
        '</div>')
      : '';

    return (
      folds +
      prefCard +
      '<section class="rec-list">' +
      '  <div class="rec-head">' +
      '    <b>' + title + '</b>' +
      '    <button class="mini-btn" data-refresh-rec>换一批</button>' +
      '  </div>' +
      (recs.length ? recs.map(recRow).join('') : emptyBlock) +
      '  <p class="rec-hint">每条是「' + esc(state.surname.c) + '」+ 名。点开看字义、读音和分享卡片。' +
      '「精选」偏真人常用，「生成」按字义拼配。</p>' +
      '</section>'
    );
  }

  /* 底部固定操作栏。放在这里统一渲染，而不是各页各自写在末尾——
   * 写在末尾的话，用户得一路滚到底才能看到按钮。 */
  function dockFor(s) {
    if (s === 'quiz') {
      /* 性别偏好放固定底栏：每道题都在同一个位置，
         不会像以前那样只在第一题露出来、把题目往下顶（第二题布局跳一下）。 */
      return '<div class="dock-chips">' +
        '<span class="dock-chips-k">取名偏向</span>' +
        '<div class="chips">' +
        [['u', '不限'], ['f', '女生'], ['m', '男生']].map(function (g) {
          return '<button class="chip' + (state.wantGender === g[0] ? ' active' : '') +
            '" data-gender="' + g[0] + '">' + g[1] + '</button>';
        }).join('') +
        '</div></div>';
    }
    if (s === 'result') {
      return '<button class="primary-btn" data-open-sheet="surname">' +
        (state.surname ? '换姓氏' : '选姓氏') + '</button>';
    }
    if (s === 'bazi') {
      return '<button class="primary-btn" data-bazi-run>按生辰取名</button>';
    }
    if (s === 'detail') {
      /* 回归干净：这一页只留一个主操作。回到推荐 / 回首页 / 回「我的」
       * 都能用左上角的返回键到达，不再堆一堆入口。 */
      return '<button class="primary-btn" data-card>生成分享卡片</button>';
    }
    if (s === 'translit') {
      var has = !!(state.translit && state.translit.result);
      return has
        ? '<button class="primary-btn" data-tl-save>收藏</button>'
        : '<button class="primary-btn" data-tl-run>生成姓名</button>';
    }
    if (s === 'studio') {
      /* 底栏只留「确定」回首页；收藏做成详情同款红按钮，放在台面内容区 */
      var studioReady = !!(state.studio.surname && state.studio.slots.length);
      return '<button class="primary-btn"' + (studioReady ? ' data-go-back="home"' : ' disabled') + '>确定</button>';
    }
    if (s === 'studio-sur') {
      return '<button class="primary-btn" data-go-back="studio">确定</button>';
    }
    if (s === 'studio-char') {
      /* 已选栏放底栏里：底栏是固定的，选字不会把页面内容顶下去 */
      if (!state.studio.slots.length) return '';
      return '<div class="dock-picked">' +
        '<span class="dock-picked-k">已选 ' + state.studio.slots.length + ' 字</span>' +
        '<div class="picked" id="st-picked">' + pickedChips() + '</div>' +
        '<button type="button" class="link-clear" data-st-clear>清空</button>' +
        '</div>' +
        '<button class="primary-btn" data-go-back="studio">确定</button>';
    }
    /* 「我的」是内容页，底栏不用放任何操作 */
    if (s === 'mine') return '';
    if (s === 'en') {
      /* 推荐是边输边生成的，不留「生成」按钮；挑中一个才需要底栏操作 */
      return state.enPicked
        ? '<button class="primary-btn" data-en-card>生成卡片</button>'
        : '';
    }
    return '';
  }

  /* ── 单个名字的详情 ───────────────────────── */

  function renderDetail() {
    var c = state.current;
    if (!c) return '<p class="empty">没找到合适的名字，换个性别偏好再试试。</p>';
    /* 从「我的」点进来的名字可能是没做测试时在工作台拼的，
     * 这时没有性格数据，雷达和跨文化对照就整块不出现。 */
    var p = state.profile;
    var radar = p && p.answered ? NM.radar(p, c.vec) : null;
    var desc = p && p.answered
      ? NM.describe(p)
      : (p && p.bazi ? p.bazi.short : '从收藏里翻出来的名字');
    var rel = NM.readability(c.surname, c.chars);
    var saved = state.fav.some(function (f) { return f.full === c.full; });
    var eu = c.euphony == null ? NM.euphony(c.surname, c.chars) : c.euphony;
    var wxNote = (p && p.bazi) ? NM.baziExplainName(c.chars || [], p.bazi) : '';

    var charRows = (c.chars || []).map(function (ch) {
      if (!NM.getChar(ch)) return '';
      var wx = NM.domainWx(NM.getChar(ch).dom);
      var banned = !!(state.feedback.banChars && state.feedback.banChars[ch]);
      var kept = (state.feedback.keepChars || []).indexOf(ch) !== -1;
      return '<div class="char-row"><b>' + esc(ch) + '</b><span class="char-py">' + NM.namePinyin(null, [ch]) +
        '</span><span class="char-m">' + esc(NM.charNote(ch).text) +
        (wx ? ' · ' + wx : '') + '</span>' +
        '<span class="char-fb">' +
        '<button type="button" class="chip chip-xs' + (banned ? ' active' : '') + '" data-ban-char="' + esc(ch) + '" title="之后不会再出现这个字">' +
        (banned ? '已排除' : '排除') + '</button>' +
        '<button type="button" class="chip chip-xs' + (kept ? ' active' : '') + '" data-keep-char="' + esc(ch) + '" title="之后名字都必须带这个字">' +
        (kept ? '已保留' : '保留') + '</button>' +
        '</span></div>';
    }).join('');

    var keepHint = (state.feedback.keepChars || []).length || Object.keys(state.feedback.banChars || {}).length
      ? '<p class="hint char-fb-hint">排除 = 之后绝不再出现；保留 = 之后都必须带上。点「换名」会换掉当前名，并记下你不喜欢它。</p>'
      : '<p class="hint char-fb-hint">可「排除」不要的字、「保留」必须留下的字。「换名」= 不喜欢当前名并换下一个。</p>';

    var cc = p && p.answered ? NM.crossCulture(p, { wantGender: state.wantGender }) : { en: null };
    var enAlt = cc.en ? cc.en.name : null;
    var whyBits = [];
    if (c.source === 'curated') whyBits.push(tagOf(c) === '清雅' ? '精选清雅名' : '精选常见名');
    else whyBits.push('按字义拼成');
    if (eu >= 0.85) whyBits.push('念起来顺口');
    if (p && p.answered) whyBits.push('贴合你的性格画像');
    if (wxNote) whyBits.push('兼顾生辰宜补');

    return (
      '<section class="name-card" data-mark="' + esc(c.surname.c) + '">' +
      '  <span class="name-tag">' + esc(desc) + '</span>' +
      '  <div class="name-big">' + esc(c.full) + '</div>' +
      '  <div class="name-py">' + NM.namePinyin(c.surname, c.chars) + '</div>' +
      '  <p class="name-why">' + esc(whyFor(c)) + '</p>' +
      '  <p class="name-reason">适合你，是因为：' + esc(whyBits.join(' · ')) + '</p>' +
      '  <div class="name-actions">' +
      '    <button class="pill primary" data-again>换名</button>' +
      '    <button class="pill" data-open-sheet="pool">备选名</button>' +
      /* 没收藏是红的，收藏后回到普通胶囊色，再点一次取消收藏 */
      '    <button class="pill' + (saved ? '' : ' fav') + '" data-save="' + esc(c.full) + '">' +
      (saved ? '已收藏' : '收藏') + '</button>' +
      '    <button class="pill" data-open-sheet="surname">选姓氏</button>' +
      '  </div>' +
      '</section>' +

      '<section class="card">' +
      '  <div class="card-title">名字里有什么</div>' +
      charRows +
      keepHint +
      '<div class="read-note ' + (eu >= 0.85 ? 'ok' : 'warn') + '">' +
      (rel.ok ? '读感没问题' : rel.issues.join('、')) +
      ' · 念着' + esc(NM.euphonyLabel(eu)) +
      (rel.good.length ? ' · ' + rel.good[0] : '') +
      '</div>' +
      '</section>' +

      (wxNote
        ? '<section class="card"><div class="card-title">生辰用字</div><p class="bazi-sum">' +
          esc(wxNote) + '</p><p class="hint">传统文化参考，不代表科学结论。</p></section>'
        : '') +

      radarCard(radar) +

      celebCard(c.given || (c.chars || []).join(''), c.chars) +

      (enAlt ?
        '<section class="card">' +
        '  <div class="card-title">同一个你，换个文化叫什么</div>' +
        '  <div class="cross-row"><span class="cross-k">中文名</span><b>' + esc(c.full) + '</b></div>' +
        '  <div class="cross-row"><span class="cross-k">英文名</span><b>' + esc(enAlt.n) + '</b>' +
        '<span class="cross-m">' + esc(enAlt.org) + '</span></div>' +
        '  <button class="ghost-btn" data-go="en">看更多英文名</button>' +
        '</section>' : '')
    );
  }

  /* ── 浮层：选姓氏 / 备选名 ──────────────────
   * 这两个都是「给当前这一页换一个选择」，不是新内容，所以都做成底部浮层：
   * 选完就地生效，不往页面栈里插页，浮层一次只显示一种内容（`sheet.type`）。 */
  var SHEET_TITLE = {
    surname: '选姓氏', pool: '备选名字',
    'ban-names': '不喜欢的名字',
    'bazi-date': '选择生日', 'bazi-hour': '选择时辰'
  };
  var SHEET_CLOSE_MS = 260;
  var WHEEL_ITEM = 44; /* 与 CSS .wheel-item 高度一致 */

  var sheet = { type: '', base: '', closing: false, draft: null };
  var sheetCloseTimer = null;
  var wheelTimers = {};

  function sheetIsOpen() {
    var el = $('#sheet');
    return !!(el && el.classList && !el.classList.contains('hidden'));
  }

  function wheelPad() {
    return '<div class="wheel-pad" aria-hidden="true"></div>';
  }

  function wheelItems(list) {
    return list.map(function (it) {
      return '<div class="wheel-item" data-val="' + esc(String(it.v)) + '">' + esc(it.t) + '</div>';
    }).join('');
  }

  function dayOptions(y, m) {
    var max = daysInMonth(y, m), out = [], i;
    for (i = 1; i <= max; i++) out.push({ v: i, t: i + '日' });
    return out;
  }

  function baziPickerHtml(type) {
    var d = sheet.draft || state.baziForm;
    if (type === 'bazi-date') {
      var ys = [], ms = [], i;
      for (i = 1900; i <= 2100; i++) ys.push({ v: i, t: i + '年' });
      for (i = 1; i <= 12; i++) ms.push({ v: i, t: i + '月' });
      return (
        '<div class="wheel" id="bazi-wheel" data-mode="date">' +
        '  <div class="wheel-frame" aria-hidden="true"></div>' +
        '  <div class="wheel-cols">' +
        '    <div class="wheel-col" data-wheel="y">' + wheelPad() + wheelItems(ys) + wheelPad() + '</div>' +
        '    <div class="wheel-col" data-wheel="m">' + wheelPad() + wheelItems(ms) + wheelPad() + '</div>' +
        '    <div class="wheel-col" data-wheel="d" id="wheel-day">' +
              wheelPad() + wheelItems(dayOptions(d.y, d.m)) + wheelPad() +
        '    </div>' +
        '  </div>' +
        '</div>'
      );
    }
    /* hour */
    var hs = [{ v: -1, t: '时辰未知' }];
    var rep = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
    for (i = 0; i < 12; i++) hs.push({ v: rep[i], t: NM.BAZI_HOURS[i] });
    return (
      '<div class="wheel wheel-single" id="bazi-wheel" data-mode="hour">' +
      '  <div class="wheel-frame" aria-hidden="true"></div>' +
      '  <div class="wheel-cols">' +
      '    <div class="wheel-col" data-wheel="hour">' + wheelPad() + wheelItems(hs) + wheelPad() + '</div>' +
      '  </div>' +
      '</div>'
    );
  }

  function wheelIndexOf(col, val) {
    var items = col.querySelectorAll('.wheel-item');
    for (var i = 0; i < items.length; i++) {
      if (+items[i].getAttribute('data-val') === +val) return i;
    }
    return 0;
  }

  function scrollWheelTo(col, index, smooth) {
    if (!col) return;
    var top = Math.max(0, index) * WHEEL_ITEM;
    try {
      col.scrollTo({ top: top, behavior: smooth ? 'smooth' : 'auto' });
    } catch (e) {
      col.scrollTop = top;
    }
  }

  function readWheelVal(col) {
    var items = col.querySelectorAll('.wheel-item');
    if (!items.length) return null;
    var idx = Math.round(col.scrollTop / WHEEL_ITEM);
    if (idx < 0) idx = 0;
    if (idx >= items.length) idx = items.length - 1;
    return +items[idx].getAttribute('data-val');
  }

  function rebuildDayWheel(y, m, preferD) {
    var col = $('#wheel-day');
    if (!col) return preferD;
    var opts = dayOptions(y, m);
    var d = preferD;
    if (d > opts.length) d = opts.length;
    col.innerHTML = wheelPad() + wheelItems(opts) + wheelPad();
    col._wheelBound = false;
    bindWheelCol(col);
    scrollWheelTo(col, d - 1, false);
    return d;
  }

  function syncWheelDraftFromCols() {
    if (!sheet.draft) return;
    var cols = $$('#bazi-wheel .wheel-col');
    for (var i = 0; i < cols.length; i++) {
      var key = cols[i].getAttribute('data-wheel');
      var val = readWheelVal(cols[i]);
      if (val == null || isNaN(val)) continue;
      if (key === 'y' || key === 'm') {
        var prev = sheet.draft[key];
        sheet.draft[key] = val;
        if (prev !== val) {
          sheet.draft.d = rebuildDayWheel(sheet.draft.y, sheet.draft.m, sheet.draft.d);
        }
      } else if (key === 'd') {
        sheet.draft.d = val;
      } else if (key === 'hour') {
        sheet.draft.hour = val;
      }
    }
  }

  function onWheelScroll(col) {
    var key = col.getAttribute('data-wheel');
    if (wheelTimers[key]) clearTimeout(wheelTimers[key]);
    wheelTimers[key] = setTimeout(function () {
      /* 松手后吸附到最近一格 */
      var idx = Math.round(col.scrollTop / WHEEL_ITEM);
      var items = col.querySelectorAll('.wheel-item');
      if (idx < 0) idx = 0;
      if (idx >= items.length) idx = items.length - 1;
      scrollWheelTo(col, idx, true);
      syncWheelDraftFromCols();
    }, 80);
  }

  function bindWheelCol(col) {
    if (!col || col._wheelBound) return;
    col._wheelBound = true;
    col.addEventListener('scroll', function () { onWheelScroll(col); }, { passive: true });
  }

  function mountWheels() {
    var wrap = $('#bazi-wheel');
    if (!wrap || !sheet.draft) return;
    var d = sheet.draft;
    var map = { y: d.y, m: d.m, d: d.d, hour: d.hour };
    var cols = $$('.wheel-col', wrap);
    for (var i = 0; i < cols.length; i++) {
      var col = cols[i];
      var key = col.getAttribute('data-wheel');
      scrollWheelTo(col, wheelIndexOf(col, map[key]), false);
      bindWheelCol(col);
    }
  }

  function commitBaziDraft() {
    if (!sheet.draft) return;
    syncWheelDraftFromCols();
    var d = sheet.draft;
    state.baziForm.y = d.y;
    state.baziForm.m = d.m;
    state.baziForm.d = d.d;
    state.baziForm.hour = d.hour;
    var maxD = daysInMonth(d.y, d.m);
    if (state.baziForm.d > maxD) state.baziForm.d = maxD;
    sheet.draft = null;
  }

  function surnameGrid(list, limit) {
    return list.slice(0, limit).map(function (s) {
      var cur = state.surname && state.surname.c === s.c;
      return '<button class="sur-pick' + (cur ? ' active' : '') + '" data-pick-surname="' + esc(s.c) + '">' +
        '<b>' + esc(s.c) + '</b><i>' + esc(NM.surnameVibe(s)) + '</i></button>';
    }).join('');
  }

  /* 浮层里的姓氏卡片。搜索时只留一栏搜索结果，不和推荐、复姓混在一起 —— 
   * 搜索框下就是答案，没有「顺便看看别的」这种干扰。 */
  function surnameRowsHtml(kw) {
    if (kw) {
      var hit = NM.searchSurnames(NM.allSurnames(), kw);
      return (
        '<section class="card">' +
        '  <div class="card-title">搜索「' + esc(kw) + '」<span class="count" id="sur-all-count">' + hit.length + '</span></div>' +
        '  <div class="sur-grid" id="sur-all">' +
          (surnameGrid(hit, 400) || '<p class="empty">没搜到这个姓。</p>') +
        '</div>' +
        '</section>'
      );
    }
    /* 选姓 = 确认自己的姓，不再按性格「推荐姓氏」 */
    var all = NM.allSurnames();
    return (
      '<section class="card">' +
      '  <div class="sur-grid" id="sur-all">' + surnameGrid(all, 400) + '</div>' +
      '</section>'
    );
  }

  function surnamePickerHtml() {
    if (!state.profile) return '<p class="empty">先做一遍测试，再来选姓氏。</p>';
    var kw = state.surKeyword.trim().toLowerCase();
    return (
      '<div class="sheet-search">' +
      '  <input class="search" id="sur-input" type="search" placeholder="搜汉字或拼音：苏 / su / ouyang"' +
      '    value="' + esc(state.surKeyword) + '">' +
      '</div>' +
      /* 搜索时只重画这一块，输入框不动、焦点不丢 */
      '<div class="sheet-rows" id="sur-rows">' + surnameRowsHtml(kw) + '</div>'
    );
  }

  /* 备选名浮层：当前姓氏下按性格排序的候选，点一条就换掉当前名字 */
  function poolPickerHtml() {
    if (!state.surname) return '<p class="empty">先挑一个姓，再看这个姓下的名字。</p>';
    /* namesForSurname 已经把顺口度揉进排序了，直接用 */
    var base = NM.namesForSurname(state.profile, state.surname, withFeedback({
      wantGender: poolFilter.gender
    }));
    state.candidates = base;

    var shown = base.filter(function (x) {
      if (poolFilter.tag === 'all') return true;
      if (x.source !== 'curated') return false;
      var g = NM.GIVEN.filter(function (n) { return n.n === x.given; })[0];
      return !g || g.tag === poolFilter.tag;
    }).slice(0, 60);

    var rows = shown.map(function (x) {
      var eu = x.euphony == null ? NM.euphony(state.surname, x.chars) : x.euphony;
      var why = whyFor(x);
      /* 一条一行：名字 + 一句释义 + 顺口度标签，不再放序号和匹配度进度条 */
      return '<button class="pool-row pool-row-slim" data-pick="' + esc(x.given) + '">' +
        '<span class="pool-body"><b>' + esc(x.full) + '</b>' +
        '<i>' + esc(tagOf(x)) + ' · ' + esc(why).slice(0, 26) + (why.length > 26 ? '…' : '') + '</i></span>' +
        '<span class="pool-tag">' + esc(NM.euphonyLabel(eu)) + '</span>' +
        '</button>';
    }).join('');

    return (
      '<div class="sheet-search">' +
      '  <div class="chips">' +
      ['u', 'f', 'm'].map(function (g) {
        var label = g === 'u' ? '不限' : g === 'f' ? '女' : '男';
        return '<button class="chip' + (poolFilter.gender === g ? ' active' : '') + '" data-pf-gender="' + g + '">' + label + '</button>';
      }).join('') +
      '  </div>' +
      '  <div class="chips">' +
      [['all', '全部'], ['common', '常见'], ['literary', '清雅']].map(function (t) {
        return '<button class="chip' + (poolFilter.tag === t[0] ? ' active' : '') + '" data-pf-tag="' + t[0] + '">' + t[1] + '</button>';
      }).join('') +
      '  </div>' +
      '</div>' +
      '<div class="pool-head">姓氏：<b>' + esc(state.surname.c) + '</b>' +
      '<span class="pool-vibe">' + esc(NM.surnameVibe(state.surname)) + '</span></div>' +
      '<div class="pool-list">' + (rows || '<p class="empty">没有符合条件的名字。</p>') + '</div>'
    );
  }

  function sheetHtml(type) {
    if (type === 'pool') return poolPickerHtml();
    if (type === 'surname') return surnamePickerHtml();
    if (type === 'ban-names') return banNamesSheetHtml();
    if (type.indexOf('bazi-') === 0) return baziPickerHtml(type);
    return surnamePickerHtml();
  }

  /* 只重画浮层内容，不动面板本身 —— 所以筛选这些都不触发开合动画 */
  function paintSheet(keepScroll) {
    var body = $('#sheet-body');
    var el = $('#sheet');
    if (!body || !el) return;
    var y = keepScroll ? body.scrollTop : 0;
    body.innerHTML = sheet.type ? sheetHtml(sheet.type) : '';
    body.scrollTop = y;
    var title = $('#sheet-title');
    if (title) title.textContent = SHEET_TITLE[sheet.type] || '';
    var closeBtn = $('#sheet-close');
    if (closeBtn) {
      closeBtn.textContent = (sheet.type === 'bazi-date' || sheet.type === 'bazi-hour') ? '完成' : '关闭';
    }
    el.classList.toggle('sheet-auto', sheet.type === 'bazi-date' || sheet.type === 'bazi-hour');
    if (!keepScroll && (sheet.type === 'bazi-date' || sheet.type === 'bazi-hour')) {
      /* 等布局完成再滚到当前值，否则 scrollTop 算不准 */
      setTimeout(mountWheels, 0);
    }
  }

  function openSheet(type) {
    var el = $('#sheet');
    if (!el) return;
    if (sheetCloseTimer) { clearTimeout(sheetCloseTimer); sheetCloseTimer = null; }
    sheet.closing = false;
    sheet.base = state.screen;
    sheet.type = type;
    sheetFocusReturn = document.activeElement;
    if (type === 'surname') state.surKeyword = '';
    if (type === 'bazi-date' || type === 'bazi-hour') {
      sheet.draft = {
        y: state.baziForm.y,
        m: state.baziForm.m,
        d: state.baziForm.d,
        hour: state.baziForm.hour
      };
    } else {
      sheet.draft = null;
    }
    el.classList.toggle('sheet-auto', type === 'bazi-date' || type === 'bazi-hour');
    el.classList.remove('hidden', 'sheet-closing');
    paintSheet(false);
    lockPage(true);
    var ip = $('#sur-input');
    if (ip && ip.focus) { try { ip.focus(); } catch (e) {} }
    else {
      var closeBtn = $('#sheet-close');
      if (closeBtn && closeBtn.focus) { try { closeBtn.focus(); } catch (e2) {} }
    }
  }

  /* 浮层开着的时候锁住底下的页面滚动。
   * 只给 body 加 overflow: hidden 是没用的 —— html 上有 overflow-x: clip，
   * 按规范这时 body 的 overflow 不会再传播到视口，视口照样能滚，
   * 于是在浮层上滑一下就把底下的页面带走了（穿透）。
   * 所以 html 也要一起加：html 的 overflow 才是视口那个。
   * 用 hidden 不用 clip：hidden 仍然允许 window.scrollTo（换页时还要还原位置）。 */
  function lockPage(on) {
    var cls = 'sheet-open';
    var roots = [document.documentElement, document.body];
    for (var i = 0; i < roots.length; i++) {
      var el = roots[i];
      if (!el || !el.classList) continue;
      if (on) el.classList.add(cls); else el.classList.remove(cls);
    }
  }

  function closeSheet() {
    var el = $('#sheet');
    if (!el || !sheetIsOpen() || sheet.closing) return;
    var wasBazi = sheet.type === 'bazi-date' || sheet.type === 'bazi-hour';
    if (wasBazi) commitBaziDraft();
    var done = function () {
      el.classList.add('hidden');
      el.classList.remove('sheet-closing', 'sheet-auto');
      sheet.closing = false;
      sheet.type = '';
      sheet.base = '';
      sheet.draft = null;
      lockPage(false);
      var closeBtn = $('#sheet-close');
      if (closeBtn) closeBtn.textContent = '关闭';
      if (wasBazi) {
        schedulePersist();
        render({ keepScroll: true });
      }
      if (sheetFocusReturn && sheetFocusReturn.focus) {
        try { sheetFocusReturn.focus(); } catch (e) {}
      }
      sheetFocusReturn = null;
    };
    sheet.closing = true;
    if (!canAnimate()) return done();
    /* 关闭也走反向动画：面板下滑 + 遮罩淡出，动画完再真正隐藏 */
    el.classList.add('sheet-closing');
    if (sheetCloseTimer) clearTimeout(sheetCloseTimer);
    sheetCloseTimer = setTimeout(function () {
      sheetCloseTimer = null;
      done();
    }, SHEET_CLOSE_MS);
  }

  /* ── 候选池的筛选（浮层用） ───────────────── */

  var poolFilter = { gender: 'u', tag: 'all', keyword: '' };

  /* ── 外文名 → 正常中文名 ─────────────────── */

  /* 「卫 / 欧阳」这类姓氏后面跟一句为什么取这个姓 */
  function surnameWhy(r) {
    var src = r.family ? '「' + r.family + '」的音头' : '「' + r.latin + '」的开头音';
    return '照' + src + '取，读起来有点原名的影子；' +
      (NM.isCompound(r.surname) ? '复姓，两个字' : '单姓，好写好认');
  }

  function renderTranslit() {
    var r = state.translit.result;
    var examples = ['Emma Wilson', 'Grace', 'Silas', 'Olivia Chen', 'Anouk', 'Liam'];
    var exampleChips = examples.map(function (x) {
      return '<button class="chip" data-tl-example="' + esc(x) + '">' + esc(x) + '</button>';
    }).join('');
    var out = '';

    if (r) {
      var m = r.main;
      var altRows = r.alts.map(function (a, i) {
        return '<button class="alt-row" data-tl-pick="' + i + '"><b>' + esc(a.full) + '</b>' +
          '<i>' + esc(a.chars.map(function (c) { return charLabel(c); }).join(' / ')) + '</i>' +
          '<span class="pool-tag">' + esc(NM.euphonyLabel(a.euphony)) + '</span></button>';
      }).join('');

      var nameRows = m.chars.map(function (c) {
        var it = NM.getChar(c);
        return '<div class="cross-row"><span class="cross-k">' + esc(c) + '</span><b>' +
          (it ? esc(it.py) : '') + '</b><span class="cross-m">' +
          esc(NM.charNote(c).text) + '</span></div>';
      }).join('');
      var rel = NM.readability(r.surname, m.chars);

      out =
        '<section class="name-card" data-mark="' + esc(String(r.surname.c)[0]) + '">' +
        '  <span class="name-tag">照 ' + esc(r.latin) + ' 取的中文名</span>' +
        '  <div class="name-big">' + esc(m.full) + '</div>' +
        '  <div class="name-py">' + NM.namePinyin(r.surname, m.chars) + ' · ' + esc(r.latin) + '</div>' +
        '  <p class="name-why">' + esc(whyFor(m)) + '</p>' +
        '  <div class="name-actions">' +
        '    <button class="pill" data-tl-again>换一组姓名</button>' +
        '    <button class="pill" data-card>存卡片</button>' +
        '  </div>' +
        '</section>' +

        '<section class="card">' +
        '  <div class="card-title">姓是怎么定的</div>' +
        '  <div class="cross-row"><span class="cross-k">姓氏</span><b>' + esc(r.surname.c) + '</b>' +
        '<span class="cross-m">' + esc(NM.surnameVibe(r.surname)) + '</span></div>' +
        '  <p class="card-explain">' + esc(surnameWhy(r)) + '</p>' +
        '</section>' +

        '<section class="card">' +
        '  <div class="card-title">名字里有什么</div>' + nameRows +
        '<div class="read-note ' + (m.euphony >= 0.85 ? 'ok' : 'warn') + '">' +
        esc(rel.ok ? '读感没问题' : rel.issues.join('、')) +
        ' · 念着' + esc(NM.euphonyLabel(m.euphony)) + '</div>' +
        '</section>' +

        (r.translitStyle ?
          '<section class="card">' +
          '  <div class="card-title">如果要音译写法</div>' +
          '  <div class="cross-row"><span class="cross-k">音译</span><b>' + esc(r.translitStyle) + '</b>' +
          '<span class="cross-m">证件、护照上用的写法</span></div>' +
          '</section>' : '') +

        celebCard(m.given || (m.chars || []).join(''), m.chars) +

        '<section class="card"><div class="card-title">换几个名字试试</div>' + altRows + '</section>';
    }

    return (
      '<section class="card">' +
      '  <div class="card-title">输入原名 <span class="muted">取一个中国式名字</span></div>' +
      '  <input class="input" id="tl-input" placeholder="例如 Emma Wilson / Liam / Sofia" value="' + esc(state.translit.latin) + '">' +
      '  <div class="chips" style="margin-top:10px">' + exampleChips + '</div>' +
      '  <p class="hint">给的是中国人真会取的名字（两三个字，姓照原名的音头配，也可能是欧阳、司马这样的复姓），' +
      '不是「格蕾丝」这类只贴读音的音译。</p>' +
      '</section>' + out
    );
  }

  function runTranslit() {
    var raw = ($('#tl-input') && $('#tl-input').value || '').trim();
    if (!raw) { toast('先输入一个外文名'); return; }
    var parts = raw.split(/\s+/).filter(Boolean);
    var family = null, given = parts[0];
    if (parts.length >= 2) { family = parts[parts.length - 1]; given = parts.slice(0, parts.length - 1).join(' '); }

    if (!state.profile) {
      /* 没有性格数据时用中性的默认向量 */
      state.profile = NM.profileFromAnswers([
        { w: { warm: 0.3, out: 0, rat: 0.2, sta: 0.3 }, nov: 0.4 }
      ]);
    }

    var list = NM.chineseName(given, state.profile, {
      family: family, wantGender: state.wantGender, count: 10
    });
    if (!list.length) { toast('这个名字没配出合适的组合，换个拼写试试'); return; }

    /* 音译写法只是附注：证件上用得到，但不再是主答案 */
    var tl = NM.translitChars(given, state.profile, { surname: { c: '卫', py: 'wei', tone: 4 } });
    var tlStyle = tl.length ? (family ? (NM.LATIN_SURNAMES[family] ? NM.LATIN_SURNAMES[family][0] : '') + ' · ' + tl[0].given
      : tl[0].given) : '';

    state.translit.latin = raw;
    state.translit.result = {
      latin: given, family: family, surname: list[0].surname,
      main: list[0], alts: list.slice(1, 9), translitStyle: tlStyle
    };
    render();
  }

  /* ── 工作台 ─────────────────────────────────
   * 拆成三屏：studio 是台面（看拼出来的名），
   * studio-sur / studio-char 是各自独立的挑选页，各有自己的筛选。
   * 筛选条件全为「全部」时列出全部候选，不做截断。 */

  var STUDIO_MAX = 4;

  /* 拼音首字母。zh/ch/sh 归到 z/c/s 下，和常见的姓氏字母表一致 */
  function initialOf(py) {
    var s = String(py || '').toLowerCase();
    return s ? s.charAt(0) : '';
  }

  /* 有哪几个首字母可用，就只画哪几枚字母筛选，不摆一排点不动的按钮 */
  function lettersOf(list, pyOf) {
    var seen = {}, out = [];
    list.forEach(function (x) {
      var l = initialOf(pyOf(x));
      if (l && !seen[l]) { seen[l] = 1; out.push(l); }
    });
    return out.sort();
  }

  function filterRow(items, cur, attr) {
    return items.map(function (it) {
      return '<button class="chip' + (cur === it[0] ? ' active' : '') + '" ' + attr + '="' + esc(it[0]) + '">' +
        esc(it[1]) + '</button>';
    }).join('');
  }

  /* 当前筛选摘要 + 一键清除；无结果时提示放宽 */
  function filterSummary(parts, clearAttr, empty) {
    var active = parts.filter(Boolean);
    if (!active.length && !empty) return '';
    if (!active.length && empty) {
      return '<div class="filter-summary empty-sum">' +
        '<span>没有符合条件的结果</span>' +
        '<button type="button" class="link-btn" ' + clearAttr + '>清除筛选</button></div>';
    }
    return '<div class="filter-summary">' +
      '<span class="filter-summary-k">已筛选</span>' +
      '<span class="filter-summary-v">' + esc(active.join(' · ')) + '</span>' +
      '<button type="button" class="link-btn" ' + clearAttr + '>清除</button></div>';
  }

  function surFilterParts() {
    var f = state.studio.surF, kw = (state.studio.surKeyword || '').trim();
    var parts = [];
    if (f.type === 'single') parts.push('单姓');
    if (f.type === 'compound') parts.push('复姓');
    if (f.pop === 'common') parts.push('常见');
    if (f.pop === 'rare') parts.push('少见');
    if (f.letter !== 'all') parts.push(String(f.letter).toUpperCase());
    if (kw) parts.push('「' + kw + '」');
    return parts;
  }

  function charFilterParts() {
    var f = state.studio.charF, kw = (state.studio.charKeyword || '').trim();
    var parts = [];
    if (f.dom !== 'all' && NM.DOMAINS[f.dom]) {
      parts.push(NM.DOMAINS[f.dom].label.split(' · ')[0]);
    }
    if (f.g === 'f') parts.push('偏女');
    if (f.g === 'm') parts.push('偏男');
    if (f.g === 'u') parts.push('中性');
    if (f.freq === 'common') parts.push('常用');
    if (f.freq === 'rare') parts.push('少见');
    if (f.letter !== 'all') parts.push(String(f.letter).toUpperCase());
    if (kw) parts.push('「' + kw + '」');
    return parts;
  }

  function enFilterParts() {
    var f = state.enF, parts = [];
    if (f.g === 'f') parts.push('偏女');
    if (f.g === 'm') parts.push('偏男');
    if (f.era !== 'all') parts.push(EN_ERA_LABEL[f.era] || f.era);
    if (f.vibe !== 'all') {
      var vibe = EN_VIBE.filter(function (x) { return x[0] === f.vibe; })[0];
      if (vibe) parts.push(vibe[1]);
    }
    if (f.theme !== 'all') parts.push(f.theme);
    if (f.lang !== 'all') parts.push(f.lang);
    if ((f.keyword || '').trim()) parts.push('「' + f.keyword.trim() + '」');
    return parts;
  }

  function studioSurs() {
    var st = state.studio, f = st.surF;
    var list = NM.allSurnames().filter(function (s) {
      if (f.type === 'single' && NM.isCompound(s)) return false;
      if (f.type === 'compound' && !NM.isCompound(s)) return false;
      var pop = s.pop || 3;
      if (f.pop === 'common' && pop < 4) return false;
      if (f.pop === 'rare' && pop >= 4) return false;
      if (f.letter !== 'all' && initialOf(s.py) !== f.letter) return false;
      return true;
    });
    /* 搜索规则和选姓浮层完全一致，都在 NM.searchSurnames 里 */
    return NM.searchSurnames(list, st.surKeyword);
  }

  function studioChars() {
    var st = state.studio, f = st.charF;
    var kw = (st.charKeyword || '').trim().toLowerCase();
    return NM.CHARS.filter(function (c) {
      if (f.dom !== 'all' && c.dom !== f.dom) return false;
      if (f.g !== 'all' && (c.g || 'u') !== f.g) return false;
      var freq = c.freq || 2;
      if (f.freq === 'common' && freq < 3) return false;
      if (f.freq === 'rare' && freq >= 3) return false;
      if (f.letter !== 'all' && initialOf(c.py) !== f.letter) return false;
      if (!kw) return true;
      return c.c.indexOf(kw) !== -1 || String(c.py || '').indexOf(kw) !== -1;
    });
  }

  function surCells(list) {
    var cur = state.studio.surname;
    return list.map(function (s) {
      return '<button class="sur-pick' + (cur && cur.c === s.c ? ' active' : '') + '" data-sur="' + esc(s.c) + '">' +
        '<b>' + esc(s.c) + '</b><i>' + esc(NM.surPy(s)) + '</i></button>';
    }).join('');
  }

  function charCells(list) {
    var slots = state.studio.slots;
    return list.map(function (c) {
      var on = slots.indexOf(c.c) !== -1;
      return '<button class="char-cell' + (on ? ' active' : '') + (c.phon ? ' ph' : '') +
        '" data-char="' + esc(c.c) + '">' + esc(c.c) + '</button>';
    }).join('');
  }

  /* 台面：只放「换姓 / 换名」两个入口和拼出来的名字 */
  function renderStudio() {
    var st = state.studio;
    var slots = st.slots;
    var hasSur = !!st.surname;

    var preview = '';
    if (hasSur && slots.length) {
      var rel = NM.readability(st.surname, slots);
      var why = [];
      slots.forEach(function (ch) {
        var it = NM.getChar(ch);
        if (it) why.push(ch + '：' + it.m);
      });
      /* 主流与否的提示：一个字或三个字以上都给一句，不拦着收藏 */
      var tips = [];
      if (slots.length === 1) tips.push('单字名：干净利落，但重名概率高。');
      if (slots.length >= 3) tips.push('三个字以上的名不常见，属于非主流取名，自己确认喜欢就好。');
      if (slots.length >= STUDIO_MAX) tips.push('已经到 ' + STUDIO_MAX + ' 个字了，再多就不像名字了。');

      var full = st.surname.c + slots.join('');
      var saved = state.fav.some(function (f) { return f.full === full; });

      preview =
        '<div class="studio-preview">' +
        '<div class="name-big small">' + esc(full) + '</div>' +
        '<div class="name-py">' + NM.namePinyin(st.surname, slots) + '</div>' +
        '<p class="name-why">' + esc(why.join('；')) + '</p>' +
        '<div class="read-note ' + (rel.ok ? 'ok' : 'warn') + '">' +
        (rel.ok ? '读感没问题' : rel.issues.join('、')) +
        (rel.good.length ? ' · ' + rel.good.join(' · ') : '') + '</div>' +
        (tips.length ? '<div class="tip-note">' + esc(tips.join(' ')) + '</div>' : '') +
        '<div class="name-actions studio-actions">' +
        '<button type="button" class="pill' + (saved ? '' : ' fav') + '" data-st-save">' +
        (saved ? '已收藏' : '收藏') + '</button>' +
        '<button type="button" class="pill" data-st-clear>清空重选</button>' +
        '</div></div>' +
        celebCard(slots.join(''), slots);
    }

    var surRow =
      '<button class="slot-row" data-go="studio-sur">' +
      '<span class="slot-k">姓</span>' +
      (hasSur
        ? '<span class="slot-v">' + esc(st.surname.c) + '</span>'
        : '<span class="slot-v slot-empty">选择</span>') +
      '<span class="slot-go">›</span></button>';

    var nameRow =
      '<button class="slot-row" data-go="studio-char">' +
      '<span class="slot-k">名</span>' +
      (slots.length
        ? '<span class="slot-v">' + esc(slots.join('')) + '</span>'
        : '<span class="slot-v slot-empty">选择</span>') +
      '<span class="slot-go">›</span></button>';

    return (
      '<section class="card">' +
      surRow + nameRow +
      '</section>' +
      preview
    );
  }

  /* 选姓页：搜索 + 类型/常见度/首字母三组筛选，默认全部 */
  function surIntro(s) {
    if (!s) return '';
    var popLabel = ['', '少见', '较少', '一般', '常见', '大姓'][s.pop] || '一般';
    var kind = NM.isCompound(s) ? '复姓' : '单姓';
    var vibe = NM.surnameVibe(s);
    return (
      '<section class="card picked-card" id="st-sur-intro">' +
      '  <div class="card-title">当前选中</div>' +
      '  <div class="sur-intro">' +
      '    <div class="sur-intro-name">' + esc(s.c) + '</div>' +
      '    <div class="sur-intro-py">' + esc(NM.surPy(s)) +
      (s.en || s.ro ? ' · ' + esc(s.en || s.ro) : '') + '</div>' +
      '    <div class="sur-intro-tags">' +
      '      <span>' + kind + '</span><span>' + popLabel + '</span><span>' + esc(vibe) + '</span>' +
      '    </div>' +
      '    <p class="sur-intro-m">' + esc(s.m || '暂无更多介绍') + '</p>' +
      '  </div>' +
      '</section>'
    );
  }

  function renderStudioSur() {
    var st = state.studio;
    var list = studioSurs();
    var all = NM.allSurnames();
    var letters = lettersOf(all, function (s) { return s.py; });

    var rows =
      '<div class="filter-row">' +
      filterRow([['all', '全部'], ['single', '单姓'], ['compound', '复姓']], st.surF.type, 'data-sur-type') +
      '</div>' +
      '<div class="filter-row">' +
      filterRow([['all', '不限常见度'], ['common', '常见'], ['rare', '少见']], st.surF.pop, 'data-sur-pop') +
      '</div>' +
      '<div class="filter-row">' +
      filterRow([['all', '全部字母']].concat(letters.map(function (l) { return [l, l.toUpperCase()]; })),
        st.surF.letter, 'data-sur-letter') +
      '</div>';

    var picked = '<button class="mini-btn" data-sur-random>随便来一个</button>';
    var parts = surFilterParts();
    var sum = filterSummary(parts, 'data-clear-sur-f', !list.length);

    return (
      '<div class="toolbar">' +
      '  <input class="search" id="st-sur-input" type="search" placeholder="搜汉字或拼音：苏 / su / ouyang"' +
      '    value="' + esc(st.surKeyword || '') + '" aria-label="搜索姓氏">' +
      rows +
      sum +
      '  <div class="toolbar-meta"><span class="count" id="st-sur-count">' +
      list.length + ' / ' + all.length + ' 个</span>' + picked + '</div>' +
      '</div>' +
      surIntro(st.surname) +
      '<div class="sur-grid grid-box" id="st-sur-grid">' +
      (surCells(list) || '<p class="empty">没筛到这个姓，放宽一下条件。<button type="button" class="link-btn" data-clear-sur-f>清除筛选</button></p>') +
      '</div>'
    );
  }

  /* 选字页：搜索 + 意象/性别/常用度/首字母四组筛选，默认全部 1225 个字 */
  function renderStudioChar() {
    var st = state.studio;
    var list = studioChars();
    var letters = lettersOf(NM.CHARS, function (c) { return c.py; });

    var doms = [['all', '全部意象']].concat(Object.keys(NM.DOMAINS).map(function (d) {
      return [d, NM.DOMAINS[d].label.split(' · ')[0]];
    }));

    var rows =
      '<div class="filter-row">' + filterRow(doms, st.charF.dom, 'data-char-dom') + '</div>' +
      '<div class="filter-row">' +
      filterRow([['all', '不限性别'], ['f', '偏女'], ['m', '偏男'], ['u', '中性']], st.charF.g, 'data-char-g') +
      '</div>' +
      '<div class="filter-row">' +
      filterRow([['all', '不限常用度'], ['common', '常用'], ['rare', '少见']], st.charF.freq, 'data-char-freq') +
      '</div>' +
      '<div class="filter-row">' +
      filterRow([['all', '全部字母']].concat(letters.map(function (l) { return [l, l.toUpperCase()]; })),
        st.charF.letter, 'data-char-letter') +
      '</div>';

    var slots = st.slots;
    var parts = charFilterParts();
    var sum = filterSummary(parts, 'data-clear-char-f', !list.length);

    return (
      '<div class="toolbar">' +
      '  <input class="search" id="st-char-input" type="search" placeholder="搜汉字或拼音：沐 / mu"' +
      '    value="' + esc(st.charKeyword || '') + '" aria-label="搜索用字">' +
      rows +
      sum +
      '</div>' +
      '<section class="card">' +
      '  <div class="card-title">全部字库 <span class="count" id="st-char-count">' +
      list.length + ' / ' + NM.CHARS.length + ' 个</span></div>' +
      '  <div class="char-grid grid-box" id="st-char-grid">' +
      (charCells(list) || '<p class="empty">没筛到这个字，放宽一下条件。<button type="button" class="link-btn" data-clear-char-f>清除筛选</button></p>') +
      '</div>' +
      '</section>' +
      '<p class="rec-hint">筛选全部为「全部」时列出全部 ' + NM.CHARS.length +
      ' 个字；点一下选中，再点一下取消，最多 ' + STUDIO_MAX + ' 个字。' +
      (slots.length ? '已选 ' + slots.length + ' 字，在底栏里。' : '') + '</p>'
    );
  }

  /* 已选的字：底栏和台面共用一套小胶囊 */
  function pickedChips() {
    return state.studio.slots.map(function (ch) {
      return '<button type="button" class="picked-chip" data-char="' + esc(ch) + '">' +
        esc(ch) + '<i>×</i></button>';
    }).join('');
  }

  /* ── 收藏 ─────────────────────────────────── */

  /* 从「姓 + 名」的字符串还原出结构。收藏里只存了整串，
   * 复姓要按最长的前缀匹配，否则「欧阳慕晴」会被当成姓「欧」。 */
  function surnameOfFull(full) {
    var pool = NM.allSurnames(), best = null;
    for (var i = 0; i < pool.length; i++) {
      if (full.indexOf(pool[i].c) === 0 && (!best || pool[i].c.length > best.c.length)) best = pool[i];
    }
    return best || { c: full.charAt(0), py: '', tone: 0 };
  }

  function favToName(f) {
    var sur = surnameOfFull(f.full);
    var chars = f.full.slice(sur.c.length).split('');
    return {
      surname: sur, chars: chars, given: chars.join(''), full: f.full,
      vec: NM.vectorOf(chars) || { trait: {}, style: {} },
      source: 'fav', note: f.why || ''
    };
  }

  /* ── 英文名：智能推荐 + 分类自选 ───────── */

  var EN_ERA = [
    ['all', '全部年代'], ['now', '当下'], ['modern', '90后'],
    ['mid', '主流'], ['vintage', '老派'], ['ancient', '古典']
  ];
  var EN_VIBE = [
    ['all', '全部气质'],
    ['warm+', '温暖'], ['warm-', '清冷'],
    ['out+', '外向'], ['out-', '内敛'],
    ['rat+', '理性'], ['rat-', '感性'],
    ['sta+', '稳重'], ['sta-', '跳脱'],
    ['cla+', '古典感'], ['sim+', '简洁'], ['exp+', '直白']
  ];
  var EN_THEME = [
    ['all', '全部寓意'],
    ['光', '光'], ['爱', '爱'], ['美', '美'], ['力', '力量'], ['王', '王者'],
    ['花', '花草'], ['星', '星辰'], ['鸟', '飞鸟'],
    ['守护', '守护'], ['高贵', '高贵'], ['胜利', '胜利'], ['战士', '战士'],
    ['礼物', '礼物'], ['温柔', '温柔'], ['和平', '和平'], ['自由', '自由'],
    ['智慧', '智慧'], ['幸运', '幸运'], ['生命', '生命']
  ];
  var EN_LANG = [
    ['all', '全部语源'],
    ['拉丁', '拉丁'], ['希腊', '希腊'], ['希伯来', '希伯来'], ['日耳曼', '日耳曼'],
    ['古英', '古英'], ['爱尔兰', '爱尔兰'], ['威尔士', '威尔士'], ['苏格兰', '苏格兰'],
    ['法语', '法语'], ['北欧', '北欧'], ['意大利', '意大利'], ['西班牙', '西班牙'],
    ['斯拉夫', '斯拉夫'], ['凯尔特', '凯尔特'], ['波斯', '波斯']
  ];
  var EN_ERA_LABEL = { ancient: '古典', vintage: '老派', mid: '主流', modern: '90后', now: '当下' };

  function ensureProfile() {
    if (!state.profile) state.profile = NM.profileFromAnswers([]);
    return state.profile;
  }

  /* 从中文串抽出名的拼音音节（去掉能匹配上的姓） */
  function pinyinOfZh(raw) {
    var s = String(raw || '').replace(/\s+/g, '');
    if (!s) return [];
    var sur = surnameOfFull(s);
    var given = sur && s.indexOf(sur.c) === 0 ? s.slice(sur.c.length) : s;
    if (!given) given = s;
    var out = [];
    for (var i = 0; i < given.length; i++) {
      var it = NM.getChar(given.charAt(i));
      if (it && it.py) out.push(it.py);
    }
    return out;
  }

  /* 只重算，不重画：输入中文名时可以边走边算 */
  function genEnNames() {
    var p = ensureProfile();
    var syls = pinyinOfZh(state.enInput);
    EN_CACHE = NM.enFromChinese(p, syls, { wantGender: state.wantGender, wantEra: 'now' });
  }

  function enLangOf(it) {
    var raw = String((it.org || '').split('·')[0] || '').trim();
    if (!raw) return '';
    if (raw.indexOf('古英语') === 0 || raw === '英语' || raw === '英') return '古英';
    if (raw.indexOf('古法') === 0 || raw === '法') return '法语';
    if (raw.indexOf('古北欧') === 0 || raw.indexOf('古诺斯') === 0) return '北欧';
    if (raw.indexOf('盖尔') === 0) return '爱尔兰';
    if (raw.indexOf('/') !== -1) return raw.split('/')[0].trim();
    return raw;
  }

  function enMatchVibe(it, vibe) {
    if (!vibe || vibe === 'all') return true;
    var key = vibe.slice(0, -1);
    var pos = vibe.slice(-1) === '+';
    var v = (it.tr && it.tr[key] != null) ? it.tr[key]
      : (it.st && it.st[key] != null) ? it.st[key] : 0;
    return pos ? v >= 0.35 : v <= -0.35;
  }

  function browseEnNames() {
    var f = state.enF;
    var kw = String(f.keyword || '').trim().toLowerCase();
    return NM.NAMES_EN.filter(function (it) {
      if (f.g !== 'all' && it.g !== 'u' && it.g !== f.g) return false;
      if (f.era !== 'all' && it.era !== f.era) return false;
      if (!enMatchVibe(it, f.vibe)) return false;
      if (f.theme !== 'all') {
        var blob = (it.org || '') + (it.m || '');
        if (blob.indexOf(f.theme) === -1) return false;
      }
      if (f.lang !== 'all' && enLangOf(it) !== f.lang) return false;
      if (kw) {
        var aliases = (NM.EN_CELEB_SEARCH && NM.EN_CELEB_SEARCH[String(it.n || '').toLowerCase()]) || [];
        var hay = (it.n + ' ' + (it.zh || '') + ' ' + (it.org || '') + ' ' + (it.m || '') +
          ' ' + (it.nick || []).join(' ') + ' ' + aliases.join(' ')).toLowerCase();
        if (hay.indexOf(kw) === -1) return false;
      }
      return true;
    });
  }

  /* 按序号取当前列表里的那一行（补偿滚动时要用真实 DOM 量位置） */
  function enRowEl(i) {
    try {
      return document.querySelector('.en-row[data-en-pick="' + i + '"]');
    } catch (e) { return null; }
  }

  function enRow(it, i, extra) {
    var enCelebs = (NM.EN_CELEBS && NM.EN_CELEBS[String(it.n || '').toLowerCase()]) || [];
    var celebNames = enCelebs.map(function (x) {
      return x[0] + (x[3] ? '（' + x[3] + '）' : '');
    }).join('、');
    var meta = (it.zh ? it.zh + ' · ' : '') + (it.org || '') +
      (celebNames ? ' · 名人：' + celebNames : '');
    if (extra) meta += extra;
    var on = state.enPicked && state.enPicked.n === it.n;
    return '<button class="pool-row en-row' + (on ? ' active' : '') + '" data-en-pick="' + i + '">' +
      '<span class="pool-idx">' + (i + 1) + '</span>' +
      '<span class="pool-body"><b>' + esc(it.n) + '</b><i>' + esc(meta) + '</i></span>' +
      '<span class="pool-tag">' + esc(EN_ERA_LABEL[it.era] || '') + '</span>' +
      '</button>';
  }

  function enPickedCard() {
    var it = state.enPicked;
    if (!it) return '';
    var enCelebs = (NM.EN_CELEBS && NM.EN_CELEBS[String(it.n || '').toLowerCase()]) || [];
    var celebHtml = enCelebs.length
      ? '<div class="en-celebs"><div class="en-celebs-title">同名名人 <span class="muted">灵感参考</span></div>' +
        enCelebs.map(function (x) {
          return '<div class="en-celeb-row"><b>' + esc(x[0]) +
            (x[3] ? ' <span class="en-celeb-zh">（' + esc(x[3]) + '）</span>' : '') +
            '</b><i>' + esc(x[1]) + '</i><p>' + esc(x[2]) + '</p></div>';
        }).join('') +
        '<p class="hint" style="margin-top:10px;margin-bottom:0">仅作文化联想，不代表姓名优劣。</p></div>'
      : '';
    return (
      '<section class="card picked-card">' +
      '  <div class="card-title">当前选中</div>' +
      '  <div class="sur-intro">' +
      '    <div class="sur-intro-name">' + esc(it.n) + '</div>' +
      '    <div class="sur-intro-py">' + esc(it.zh || '') +
      (it.ph ? ' · /' + esc(it.ph) + '/' : '') + '</div>' +
      '    <div class="sur-intro-tags">' +
      '      <span>' + esc(EN_ERA_LABEL[it.era] || '') + '</span>' +
      '      <span>' + esc(it.g === 'f' ? '偏女' : it.g === 'm' ? '偏男' : '中性') + '</span>' +
      (it.org ? '<span>' + esc(enLangOf(it) || '其他') + '</span>' : '') +
      '    </div>' +
      '    <p class="sur-intro-m">' + esc(it.org || '') +
      (it.m ? '。' + esc(it.m) : '') + '</p>' +
      (it.nick && it.nick.length
        ? '<p class="hint" style="margin-top:8px;margin-bottom:0">昵称：' + esc(it.nick.join(' / ')) + '</p>'
        : '') +
      celebHtml +
      '  </div>' +
      '</section>'
    );
  }

  function renderEnBrowse() {
    var f = state.enF;
    var list = browseEnNames();
    var parts = enFilterParts();
    var sum = filterSummary(parts, 'data-clear-en-f', !list.length);
    var rows = list.length
      ? list.map(function (it, i) { return enRow(it, i, ''); }).join('')
      : '<p class="empty">这个分类下没有名字。<button type="button" class="link-btn" data-clear-en-f>清除筛选</button></p>';

    return (
      '<div class="toolbar">' +
      '  <input class="search" id="en-search" type="search" placeholder="搜英文 / 译名 / 含义：Ava / 艾娃 / 智慧"' +
      '    value="' + esc(f.keyword || '') + '" aria-label="搜索英文名">' +
      '  <div class="filter-row">' +
      filterRow([['all', '不限性别'], ['f', '偏女'], ['m', '偏男']], f.g, 'data-en-g') +
      '  </div>' +
      '  <div class="filter-row">' + filterRow(EN_ERA, f.era, 'data-en-era') + '</div>' +
      '  <div class="filter-row">' + filterRow(EN_VIBE, f.vibe, 'data-en-vibe') + '</div>' +
      '  <div class="filter-row">' + filterRow(EN_THEME, f.theme, 'data-en-theme') + '</div>' +
      '  <div class="filter-row">' + filterRow(EN_LANG, f.lang, 'data-en-lang') + '</div>' +
      sum +
      '</div>' +
      enPickedCard() +
      '<section class="card">' +
      '  <div class="card-title">英文名库 <span class="count" id="en-browse-count">' +
      list.length + ' / ' + NM.NAMES_EN.length + '</span></div>' +
      /* 列表跟着整页滚，不再自己做一个二级滚动区 */
      '  <div class="pool-list" id="en-browse-list">' + rows + '</div>' +
      '</section>' +
      '<p class="rec-hint">可按年代、气质、寓意、语源筛选；点一个名字看介绍，底栏存成卡片。</p>'
    );
  }

  function renderEnRec() {
    var genderRow =
      '<div class="chips" style="margin-top:10px">' +
      ['u', 'f', 'm'].map(function (g) {
        var label = g === 'u' ? '不限' : g === 'f' ? '偏女' : '偏男';
        return '<button class="chip' + (state.wantGender === g ? ' active' : '') + '" data-gender="' + g + '">' + label + '</button>';
      }).join('') +
      '</div>';

    return (
      '<section class="card">' +
      '  <div class="card-title">中文名 <span class="muted">从中文出发取英文名，可留空</span></div>' +
      '  <input class="input" id="en-input" placeholder="例如 沐晴 / 李慕白 / 欧阳见山" value="' + esc(state.enInput) + '">' +
      genderRow +
      '  <p class="hint">填了中文名按拼音贴近；也可只填姓。留空则按性格气质推荐。</p>' +
      '</section>' +
      '<div id="en-rec-out">' + enRecOut() + '</div>'
    );
  }

  /* 推荐结果整块（选中卡 + 结果列表）。输入中文名时只重画这一块，
   * 输入框不会掉焦点，页面也不会跳。 */
  function enRecOut() {
    var list = EN_CACHE.slice(0, 24);
    var rows = list.length
      ? list.map(function (x, i) {
        var extra = x.phon != null ? ' · 音近 ' + Math.round(x.phon * 100) + '%' : '';
        return enRow(x.name, i, extra);
      }).join('')
      : '<p class="empty">换个字试试；想看现成的名字，切到「分类自选」。</p>';

    var title = state.enInput.trim()
      ? '照「' + esc(state.enInput.trim()) + '」配的英文名'
      : '和你的性格最搭的英文名';

    return (state.enPicked ? enPickedCard() : '') +
      '<section class="card"><div class="card-title">' + title +
      (list.length ? ' <span class="muted">' + list.length + ' 个</span>' : '') +
      /* 套一层 pool-list，条目之间才有间距（不然是贴着的） */
      '</div><div class="pool-list">' + rows + '</div></section>';
  }

  function renderEn() {
    var mode = state.enMode === 'rec' ? 'rec' : 'browse';
    var tabs =
      '<div class="chips center" style="margin-bottom:4px">' +
      '<button class="chip' + (mode === 'browse' ? ' active' : '') + '" data-en-mode="browse">分类自选</button>' +
      '<button class="chip' + (mode === 'rec' ? ' active' : '') + '" data-en-mode="rec">智能推荐</button>' +
      '</div>';
    return tabs + (mode === 'browse' ? renderEnBrowse() : renderEnRec());
  }

  /* ── 卡片 ─────────────────────────────────── */

  /* dataURL → Blob（纯本地转码：atob + Uint8Array，不走 fetch，避免构建期网络关键字告警） */
  function dataURLToBlob(dataURL) {
    var parts = dataURL.split(',');
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    var bin = atob(parts[1]);
    var n = bin.length, u8 = new Uint8Array(n);
    for (var i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  var cardExport = { url: '', name: '仙鹿起名.jpg' };

  function openCard(data) {
    var canvas = document.createElement('canvas');
    NM.renderCard(canvas, data);
    var url = NM.cardToDataURL(canvas);
    $('#modal-img').src = url;
    /* 清掉残留的关闭态，确保每次打开都重放进入动画 */
    $('#modal').classList.remove('hidden', 'modal-closing');
    cardExport.url = url;
    cardExport.name = '仙鹿起名-' +
      (data.full || (data.enName && data.enName.n) || 'name') + '.jpg';
    var closeBtn = $('#modal-close');
    if (closeBtn && closeBtn.focus) { try { closeBtn.focus(); } catch (e) {} }
  }

  /* 保存卡片。曾经的写法是把 data: URL 直接挂在 <a download> 上，但部分浏览器
   * （Safari 及某些容器 webview）不认这个 download 属性，点一下会当场导航到该
   * data URL —— macOS 找不到能打开它的 App，就弹「没有可打开的程序」。 */
  function saveCard() {
    if (!cardExport.url) return;
    var dl = $('#modal-dl');
    if (dl) {
      dl.classList.add('is-busy');
      dl.textContent = '保存中…';
    }
    var doneUi = function (ok, msg) {
      if (dl) {
        dl.classList.remove('is-busy');
        dl.textContent = '下载图片';
      }
      if (msg) toast(msg);
    };

    /* 小红书等容器：<a download> 被禁用，改走原生桥存相册（与星空跳一跳同一套） */
    var bridge = window.xhs && window.xhs.miniTool;
    if (bridge && typeof bridge.saveImageToPhotosAlbum === 'function') {
      var toAlbum = function (filePath) {
        return bridge.saveImageToPhotosAlbum({ filePath: filePath });
      };
      var p = typeof bridge.writeTempFile === 'function'
        ? bridge.writeTempFile({ data: cardExport.url }).then(function (res) { return toAlbum(res.filePath); })
        : toAlbum(cardExport.url);
      p.then(function () { doneUi(true, '已保存到相册'); })
       .catch(function () { doneUi(false, '保存失败，请检查相册权限后重试'); });
      return;
    }

    /* 普通浏览器：先转成 blob: 再交给 <a download>，download 才稳定生效 */
    try {
      var objURL = URL.createObjectURL(dataURLToBlob(cardExport.url));
      var a = document.createElement('a');
      a.href = objURL;
      a.download = cardExport.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(objURL); }, 2000);
      doneUi(true, '已开始下载');
    } catch (e) {
      /* 极端兜底：另开一页显示图片，交给用户长按保存 */
      try { window.open(cardExport.url, '_blank'); } catch (e2) {}
      doneUi(false, '请长按图片保存');
    }
  }

  function closeModal() {
    var m = $('#modal');
    if (m.classList.contains('hidden')) return;
    /* 先放反向动画，播完再收掉（加 .hidden → display:none） */
    m.classList.add('modal-closing');
    setTimeout(function () {
      m.classList.add('hidden');
      m.classList.remove('modal-closing');
    }, 240);
  }

  function cardDataFor(c) {
    var p = state.profile;
    var bazi = currentBazi();
    var answered = !!(p && p.answered);
    var desc = answered
      ? NM.describe(p)
      : (bazi && bazi.ok ? bazi.summary : '');
    return {
      surname: c.surname, chars: c.chars, given: c.given, full: c.full,
      desc: desc,
      radar: answered ? NM.radar(p, c.vec) : null,
      bazi: bazi && bazi.ok ? bazi : null,
      baziNote: (bazi && bazi.ok) ? NM.baziExplainName(c.chars || [], bazi) : '',
      answered: answered,
      mode: 'zh'
    };
  }

  /* ── 渲染与事件 ───────────────────────────── */

  var EN_CACHE = [];

  function render(opts) {
    opts = opts || {};
    /* 「换一批」这类原地刷新不该把用户弹回顶部，所以先记住滚动位置 */
    var keepY = opts.keepScroll ? (window.pageYOffset || 0) : 0;
    var s = state.screen;
    var html = '';
    if (s === 'home') html = renderHome();
    else if (s === 'quiz') html = renderQuiz();
    else if (s === 'bazi') html = renderBazi();
    else if (s === 'result') html = renderResult();
    else if (s === 'detail') html = renderDetail();
    else if (s === 'translit') html = renderTranslit();
    else if (s === 'studio') html = renderStudio();
    else if (s === 'studio-sur') html = renderStudioSur();
    else if (s === 'studio-char') html = renderStudioChar();
    else if (s === 'mine') html = renderMine();
    else if (s === 'en') html = renderEn();

    $('#screen').innerHTML = html;

    var dock = $('#dock');
    var dk = dockFor(s);
    if (dock) {
      dock.innerHTML = dk;
      dock.classList.toggle('hidden', !dk);
    }
    /* 底部导航只在两个一级页面出现；子页面是压栈的，进来就收起 */
    var showTabs = s === 'home' || s === 'mine';
    var tb = $('#tabbar');
    if (tb) {
      tb.classList.toggle('hidden', !showTabs);
      var onHome = $('#tab-home'), onMine = $('#tab-mine');
      if (onHome) onHome.classList.toggle('active', s === 'home');
      if (onMine) onMine.classList.toggle('active', s === 'mine');
    }
    if (document.body) {
      document.body.classList.toggle('has-dock', !!dk);
      document.body.classList.toggle('has-tabbar', showTabs);
      /* 选字页的底栏里挂着已选的字，那一条更高，正文要多让一点位置 */
      document.body.classList.toggle(
        'has-dock-picked', s === 'studio-char' && state.studio.slots.length > 0);
      /* 答题页底栏只有一排胶囊，正文让位少一些 */
      document.body.classList.toggle('has-dock-quiz', s === 'quiz');
    }

    /* 一级页面没有上一页可回，返回键收起 */
    $('#hd-back').classList.toggle('hidden', s === 'home' || s === 'mine');
    var title = {
      home: '仙鹿起名', quiz: '性格测试', bazi: '生辰起名', result: '推荐组合',
      /* 详情页不放标题：名字本身已经在页面正中，顶上再写一句是废话 */
      detail: '',
      pool: '备选名字',
      translit: '西名中起', studio: '自选姓名', mine: '我的', en: '取英文名',
      'studio-sur': '选姓氏', 'studio-char': '挑选姓名'
    }[s] || '仙鹿起名';
    $('#hd-title').textContent = title;
    $('#screen').scrollTop = 0;
    window.scrollTo(0, keepY);
    bindGridScroll();
    syncToTop();
    paintStorageTip();
  }

  /* ── 页面切换：iOS NavigationLink 式 ────────
   * 前进 / 返回是两种不同的动效，所以 go() 要带方向：
   *   push 新页从右压入，旧页左移 30% 留在下面
   *   pop  旧页整页右移出屏，上一页从 -30% 归位
   * 旧页会被克隆成一层固定图层（.page-ghost）参与动画，动画结束即丢弃。 */
  var PT_MS = 360;
  var ptTimer = null;

  function canAnimate() {
    if (!document.body || !document.body.classList) return false;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch (e) {}
    return true;
  }

  function clearGhost() {
    var olds = document.querySelectorAll('.page-ghost');
    for (var i = 0; i < olds.length; i++) {
      if (olds[i].parentNode) olds[i].parentNode.removeChild(olds[i]);
    }
  }

  function slideSwap(isPop) {
    /* 旧版用固定幽灵层模拟滑动，会把已滚动页面的内容向上错位。
       页面切换直接重绘，保证每个新页面从顶部稳定开始。 */
    if (ptTimer) { clearTimeout(ptTimer); ptTimer = null; }
    clearGhost();
    render();
  }

  /* 一级页面之间（首页 ⇄ 我的）是平级切换，不走压栈动效：
   * 导航栏里的 tab 只换内容，不推页。 */
  function isTab(a, b) {
    return (a === 'home' || a === 'mine') && (b === 'home' || b === 'mine');
  }

  /* 页面栈：栈顶是当前页的上一页。
   * 只用一张静态映射表记不住「结果 → 详情」这种链，
   * 返回键会跳回两页之前，所以老老实实压栈。
   * 备选名 / 选姓氏不在这里 —— 它们是浮层，不进页面栈。 */
  var hist = [];

  function swapTo(screen, isPop) {
    if (screen === state.screen) return render();
    var from = state.screen;
    /* 离开推荐相关页时清空临时偏好 */
    if (isRecommendFlow(from) && !isRecommendFlow(screen)) clearSessionFeedback();
    state.screen = screen;
    if (isTab(from, screen)) { hist = []; return render(); }
    if (isPop) slideSwap(true);
    else slideSwap(false);
  }

  function go(screen, replace) {
    if (screen === state.screen) return render();
    /* replace：这一页顶掉栈顶（答完题出结果页，返回键该回首页而不是回最后一题） */
    if (!replace && hist[hist.length - 1] !== state.screen && !isTab(state.screen, screen)) {
      hist.push(state.screen);
    }
    swapTo(screen, false);
  }

  /* 返回上一页：走 pop 动效 */
  function goBack(screen) {
    if (screen === state.screen) return render();
    /* 栈里的中间页一并丢掉，只留目标页当上一页 */
    while (hist.length && hist[hist.length - 1] !== screen) hist.pop();
    if (hist.length) hist.pop();
    swapTo(screen, true);
  }

  /* 回到顶部：滚过一段距离才浮出，点了平滑滚回去。
   * 挑选姓/字页的长列表在 .grid-box 里滚，不只听 window。 */
  var TO_TOP_AT = 420;
  var gridScrollEl = null;

  function bindGridScroll() {
    if (gridScrollEl) {
      gridScrollEl.removeEventListener('scroll', syncToTop);
      gridScrollEl = null;
    }
    var id = state.screen === 'studio-char' ? 'st-char-grid'
      : state.screen === 'studio-sur' ? 'st-sur-grid'
      : null;
    if (!id) return;
    var el = $('#' + id);
    if (!el) return;
    gridScrollEl = el;
    el.addEventListener('scroll', syncToTop, { passive: true });
  }

  function syncToTop() {
    var btn = $('#to-top');
    if (!btn || !btn.classList) return;
    var y = window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;
    if (gridScrollEl) y = Math.max(y, gridScrollEl.scrollTop || 0);
    btn.classList.toggle('on', y >= TO_TOP_AT);
  }
  if (window.addEventListener) window.addEventListener('scroll', syncToTop, { passive: true });

  function scrollToTop() {
    if (gridScrollEl) {
      try {
        gridScrollEl.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        gridScrollEl.scrollTop = 0;
      }
    }
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, [data-go], [data-fav-open]');
    if (!t) return;
    var d = t.dataset;

    if (t.id === 'to-top') { scrollToTop(); return; }

    /* 浮层：给当前这一页换一个选择，就地生效，不进页面栈 */
    if (d.openSheet) return openSheet(d.openSheet);

    if (d.mineToggle) {
      if (!state.mineExpand) state.mineExpand = { profile: false, bazi: false };
      state.mineExpand[d.mineToggle] = !state.mineExpand[d.mineToggle];
      return render({ keepScroll: true });
    }

    if (d.goBack) return goBack(d.goBack);

    if (d.go) {
      if (d.go === 'result' && state.profile && state.profile.answered) {
        if (state.surname && (!state.recs || !state.recs.length)) refreshRecs();
        if (!state.surname) state.recs = [];
      }
      if (d.go === 'result' && !(state.profile && state.profile.answered)) d.go = 'quiz';
      if (d.go === 'quiz') { state.answers = []; state.qi = 0; }
      if (d.go === 'bazi' && state.baziInfo && state.baziInfo.solar) {
        state.baziForm.y = state.baziInfo.solar.y;
        state.baziForm.m = state.baziInfo.solar.m;
        state.baziForm.d = state.baziInfo.solar.d;
        state.baziForm.hour = state.baziInfo.solar.hour;
      }
      if (d.go === 'en') {
        state.enFrom = state.screen === 'detail' || state.screen === 'result' ? state.screen : 'home';
        /* 从详情进：带着当前中文名；从首页进：空着等用户填或按性格生成 */
        if (state.screen === 'detail' && state.current) {
          state.enInput = state.current.full || '';
        }
        if (!EN_CACHE.length) genEnNames();
      }
      return go(d.go);
    }
    if (t.hasAttribute('data-bazi-run')) return finishBazi();
    if (d.gender) {
      state.wantGender = d.gender;
      /* 推荐页里换性别要重算，不然列表还是旧性别那批 */
      if (state.screen === 'en' && state.enMode !== 'browse') genEnNames();
      return render({ keepScroll: true });
    }
    if (t.hasAttribute('data-back-q')) {
      state.qi = Math.max(0, state.qi - 1);
      return slideSwap(true);   /* 上一题 = 返回，走 pop */
    }
    if (d.ans !== undefined) {
      var q = NM.QUESTIONS[state.qi];
      state.answers[state.qi] = q.options[+d.ans];
      state.qi++;
      /* 最后一题答完直接进结果页，不经过等待页 */
      if (state.qi >= NM.QUESTIONS.length) return finishQuiz();
      return render();
    }
    if (t.hasAttribute('data-again')) {
      /* 「换名」= 不喜欢当前名（记入 banFull）并换下一个 */
      var curAgain = state.current;
      if (curAgain && curAgain.full) {
        if (!state.feedback.banFull) state.feedback.banFull = {};
        state.feedback.banFull[curAgain.full] = 1;
      }
      rebuildCandidates();
      var one = NM.sampleTop(state.candidates, 0.7, 1, state.shown);
      if (!one.length) {
        state.shown = {};
        one = NM.sampleTop(state.candidates, 0.7, 1, state.shown);
      }
      if (!one.length) {
        toast((state.feedback.keepChars || []).length
          ? '带这些保留字的候选不够了，试试取消部分保留或换姓'
          : '这个姓的候选都用完了，换个姓吧');
        return render({ keepScroll: true });
      }
      state.current = one[0];
      state.shown[one[0].full] = 1;
      return render();
    }
    if (d.rec !== undefined) {
      var rec = (state.recs || [])[+d.rec];
      if (!rec) return;
      state.surname = rec.surname;
      state.current = rec.name;
      state.current.euphony = rec.euphony;
      state.detailFrom = 'result';
      state.shown = {};
      state.shown[rec.full] = 1;
      state.candidates = [];
      return go('detail');
    }
    if (t.hasAttribute('data-refresh-rec')) {
      if (!state.profile) return;
      if (!state.surname) return toast('请先选姓氏');
      state.recs.forEach(function (r) { state.recShown[r.given] = 1; });
      /* 排除记录攒太多会把候选池抽干，定期清一次 */
      if (Object.keys(state.recShown).length > 40) state.recShown = {};
      refreshRecs();
      return render({ keepScroll: true });
    }
    if (d.pickSurname) {
      var ps = NM.allSurnames().filter(function (x) { return x.c === d.pickSurname; })[0];
      if (!ps) return;
      var surBase = sheet.base || state.screen;
      state.surname = ps;
      state.shown = {};
      state.candidates = [];
      state.recShown = {};
      poolFilter.tag = 'all';

      /* 结果页：选姓后直接在该姓下生成名字推荐 */
      if (surBase === 'result') {
        refreshRecs();
        closeSheet();
        return render();
      }

      closeSheet();
      /* 详情页：给新姓配一个最合适的名，原地换掉当前详情 */
      if (surBase === 'detail') {
        if (!state.profile) return toast('先做一遍测试，才能按新姓重排名字');
        var next = NM.namesForSurname(state.profile, ps, withFeedback({ wantGender: state.wantGender }));
        state.candidates = next;
        var one2 = NM.sampleTop(next, 0.7, 1, state.shown);
        if (one2.length) { state.current = one2[0]; state.shown[one2[0].full] = 1; }
        else if (next.length) { state.current = next[0]; }
        return render({ keepScroll: true });
      }
      return render({ keepScroll: true });
    }
    if (t.hasAttribute('data-card')) {
      if (state.screen === 'translit' && state.translit.result) {
        var tr = state.translit.result;
        return openCard({
          surname: tr.surname, chars: tr.main.chars, given: tr.main.given,
          full: tr.main.full, desc: NM.describe(state.profile),
          radar: NM.radar(state.profile, tr.main.vec), mode: 'zh'
        });
      }
      if (!state.current) return;
      return openCard(cardDataFor(state.current));
    }
    /* 详情页的「换个姓」：走浮层，不再跳页 */
    if (t.hasAttribute('data-reroll-surname')) return openSheet('surname');
    if (d.pick) {
      var found = (state.candidates || []).filter(function (x) { return x.given === d.pick; })[0];
      if (!found) return;
      var wasDetail = state.screen === 'detail';
      state.current = found;
      if (!wasDetail) state.detailFrom = 'result';
      state.shown[found.full] = 1;
      closeSheet();
      /* 从详情页开的备选名：就地换掉当前名字，不推页 */
      if (wasDetail) return render({ keepScroll: true });
      return go('detail');
    }
    if (d.save) {
      var cur = state.current;
      if (!cur) return;
      var favAt = -1;
      for (var fi = 0; fi < state.fav.length; fi++) {
        if (state.fav[fi].full === cur.full) { favAt = fi; break; }
      }
      /* 同一颗按钮收藏 / 取消收藏 */
      if (favAt !== -1) {
        state.fav.splice(favAt, 1);
        saveFav();
        toast('已取消收藏');
        return render({ keepScroll: true });
      }
      state.fav.unshift({
        full: cur.full,
        py: NM.namePinyin(cur.surname, cur.chars),
        why: whyFor(cur),
        src: state.detailFrom === 'mine' ? 'detail' : (state.detailFrom || 'detail'),
        at: Date.now(),
        note: ''
      });
      saveFav();
      toast('已收藏');
      return render({ keepScroll: true });
    }
    if (d.pfGender) { poolFilter.gender = d.pfGender; return paintSheet(true); }
    if (d.pfTag) { poolFilter.tag = d.pfTag; return paintSheet(true); }

    if (t.hasAttribute('data-tl-run')) return runTranslit();
    if (t.hasAttribute('data-tl-save')) {
      var trSave = state.translit.result;
      if (!trSave || !trSave.main) return;
      var mSave = trSave.main;
      if (state.fav.some(function (f) { return f.full === mSave.full; })) {
        toast('已经收藏过了');
        return;
      }
      state.fav.unshift({
        full: mSave.full,
        py: NM.namePinyin(mSave.surname, mSave.chars),
        why: whyFor(mSave),
        src: 'translit',
        at: Date.now(),
        note: ''
      });
      saveFav();
      toast('已收藏');
      return;
    }
    if (d.tlExample !== undefined) {
      state.translit.latin = d.tlExample;
      var ip = $('#tl-input');
      if (ip) ip.value = d.tlExample;
      return runTranslit();
    }
    if (t.hasAttribute('data-tl-again')) {
      var r = state.translit.result;
      if (!r) return;
      /* 换一组姓名：连姓一起换；用完了就整批重算 */
      var rest = r.alts.slice();
      if (!rest.length) {
        var again = NM.chineseName(r.latin, state.profile, {
          family: r.family, wantGender: state.wantGender, count: 10
        });
        rest = again.filter(function (x) { return x.full !== r.main.full; });
        if (!rest.length) return toast('没别的组合了');
      }
      r.main = rest[0];
      r.surname = r.main.surname;
      r.alts = rest.slice(1, 9);
      return render();
    }
    if (d.tlPick !== undefined) {
      var rr = state.translit.result;
      if (!rr) return;
      var a = rr.alts[+d.tlPick];
      if (!a) return;
      /* 选中的这个升成主结果，姓也跟着换 */
      var old = rr.main;
      rr.main = a;
      rr.surname = a.surname;
      rr.alts = [old].concat(rr.alts.filter(function (x, i) { return i !== +d.tlPick; })).slice(0, 8);
      return render();
    }

    if (d.sur) {
      state.studio.surname = NM.allSurnames().filter(function (s) { return s.c === d.sur; })[0] || state.studio.surname;
      /* 点姓只选中并展示介绍，底部「确定」才回台面 */
      return render({ keepScroll: true });
    }
    if (t.hasAttribute('data-sur-random')) {
      var pool = studioSurs();
      if (!pool.length) return toast('先放宽一下筛选');
      state.studio.surname = pool[Math.floor(Math.random() * pool.length)];
      return render({ keepScroll: true });
    }
    if (d.surType) { state.studio.surF.type = d.surType; return render({ keepScroll: true }); }
    if (d.surPop) { state.studio.surF.pop = d.surPop; return render({ keepScroll: true }); }
    if (d.surLetter) { state.studio.surF.letter = d.surLetter; return render({ keepScroll: true }); }
    if (d.charDom) { state.studio.charF.dom = d.charDom; return render({ keepScroll: true }); }
    if (d.charG) { state.studio.charF.g = d.charG; return render({ keepScroll: true }); }
    if (d.charFreq) { state.studio.charF.freq = d.charFreq; return render({ keepScroll: true }); }
    if (d.charLetter) { state.studio.charF.letter = d.charLetter; return render({ keepScroll: true }); }
    if (d.char) {
      var c = d.char, s2 = state.studio.slots;
      var at = s2.indexOf(c);
      /* 点已选中的字＝取消；到上限了就不加，提示一下 */
      if (at !== -1) s2.splice(at, 1);
      else if (s2.length >= STUDIO_MAX) { toast('最多 ' + STUDIO_MAX + ' 个字'); return; }
      else s2.push(c);
      /* 选字页有一千多个格子：只改这一个格子和底栏，页面不重画、内容不位移 */
      if (state.screen === 'studio-char') {
        /* 点底栏里的字也能取消，这时要找到对应的格子一起改高亮 */
        var cell = null;
        try { cell = document.querySelector('.char-cell[data-char="' + c + '"]'); } catch (err) { cell = null; }
        (cell && cell.classList ? cell : t).classList.toggle('active', at === -1);
        var dk2 = $('#dock');
        if (dk2) {
          var dkHtml = dockFor('studio-char');
          dk2.innerHTML = dkHtml;
          dk2.classList.toggle('hidden', !dkHtml);
        }
        if (document.body) {
          document.body.classList.toggle('has-dock', !!(dk2 && !dk2.classList.contains('hidden')));
          document.body.classList.toggle('has-dock-picked', s2.length > 0);
        }
        return;
      }
      render({ keepScroll: true });
      return;
    }
    if (t.hasAttribute('data-st-clear')) {
      state.studio.slots = [];
      return render({ keepScroll: true });
    }
    if (t.hasAttribute('data-st-save')) {
      var sc = state.studio, ch = sc.slots.slice();
      if (!sc.surname) return toast('先选姓氏');
      if (!ch.length) return toast('先选一个字');
      var full = sc.surname.c + ch.join('');
      var favAt = -1;
      for (var si = 0; si < state.fav.length; si++) {
        if (state.fav[si].full === full) { favAt = si; break; }
      }
      if (favAt !== -1) {
        state.fav.splice(favAt, 1);
        saveFav();
        toast('已取消收藏');
        return render({ keepScroll: true });
      }
      state.fav.unshift({
        full: full,
        py: NM.namePinyin(sc.surname, ch),
        why: ch.map(function (x) { var it = NM.getChar(x); return x + '：' + (it ? it.m : ''); }).join('；'),
        src: 'studio',
        at: Date.now(),
        note: ''
      });
      saveFav();
      /* 多个字的名给一句「非主流」的提示，但不拦着 */
      toast(ch.length >= 3 ? '已收藏（三字以上的名不常见）' : '已收藏');
      return render({ keepScroll: true });
    }

    if (d.favDel !== undefined) {
      state.fav.splice(+d.favDel, 1);
      saveFav();
      return render({ keepScroll: true });
    }
    if (d.favOpen !== undefined) {
      var ff = state.fav[+d.favOpen];
      if (!ff) return;
      state.current = favToName(ff);
      /* 让「备选名」「换名」也能用 */
      state.surname = state.current.surname;
      state.detailFrom = 'mine';
      return go('detail');
    }
    if (d.enMode) {
      state.enMode = d.enMode;
      state.enPicked = null;
      return render();
    }
    if (d.enG) { state.enF.g = d.enG; return render({ keepScroll: true }); }
    if (d.enEra) { state.enF.era = d.enEra; return render({ keepScroll: true }); }
    if (d.enVibe) { state.enF.vibe = d.enVibe; return render({ keepScroll: true }); }
    if (d.enTheme) { state.enF.theme = d.enTheme; return render({ keepScroll: true }); }
    if (d.enLang) { state.enF.lang = d.enLang; return render({ keepScroll: true }); }
    if (d.enPick !== undefined) {
      var picked = null;
      if (state.enMode === 'browse') {
        picked = browseEnNames()[+d.enPick] || null;
      } else {
        picked = EN_CACHE[+d.enPick] ? EN_CACHE[+d.enPick].name : null;
      }
      if (!picked) return;
      /* 选中卡是插在列表上方的，整块重画会把列表整体往下顶 —— 看起来就像
       * 「点了某一个，列表跳了」。先量一下被点那条在屏幕上的位置，
       * 画完再把这个差值从滚动里补回来，视线里的那一条就纹丝不动。 */
      var row0 = enRowEl(d.enPick);
      var top0 = row0 ? row0.getBoundingClientRect().top : null;
      state.enPicked = picked;
      render({ keepScroll: true });
      var row1 = enRowEl(d.enPick);
      if (row1 && top0 != null) {
        var dy = row1.getBoundingClientRect().top - top0;
        if (dy && window.scrollBy) window.scrollBy(0, dy);
      }
      return;
    }
    if (t.hasAttribute('data-en-card') || t.hasAttribute('data-card-en')) {
      var enIt = state.enPicked || (EN_CACHE[0] && EN_CACHE[0].name);
      if (!enIt) return;
      var pCard = ensureProfile();
      openCard({
        mode: 'en', enName: enIt,
        desc: NM.describe(pCard),
        radar: NM.radar(pCard, { trait: enIt.tr, style: enIt.st })
      });
      return;
    }

    if (d.banName) {
      if (!state.feedback.banFull) state.feedback.banFull = {};
      var nowBanned = false;
      if (state.feedback.banFull[d.banName]) {
        delete state.feedback.banFull[d.banName];
        toast('已恢复「' + d.banName + '」');
      } else {
        state.feedback.banFull[d.banName] = 1;
        toast('已记下不喜欢「' + d.banName + '」');
        nowBanned = true;
      }
      if (state.screen === 'detail') applyFeedbackToDetail({ forceSwap: nowBanned });
      if (state.screen === 'result') refreshRecs();
      if (sheet.type === 'ban-names' && sheetIsOpen()) paintSheet(true);
      return render({ keepScroll: true });
    }
    if (d.unbanName) {
      if (state.feedback.banFull) delete state.feedback.banFull[d.unbanName];
      toast('已恢复「' + d.unbanName + '」');
      if (state.screen === 'detail') applyFeedbackToDetail();
      if (state.screen === 'result') refreshRecs();
      if (sheet.type === 'ban-names' && sheetIsOpen()) {
        if (!Object.keys(state.feedback.banFull || {}).length) closeSheet();
        else paintSheet(true);
      }
      return render({ keepScroll: true });
    }
    if (d.unbanChar) {
      if (state.feedback.banChars) delete state.feedback.banChars[d.unbanChar];
      toast('已取消排除「' + d.unbanChar + '」');
      if (state.screen === 'detail') applyFeedbackToDetail();
      if (state.screen === 'result') refreshRecs();
      return render({ keepScroll: true });
    }
    if (d.unkeepChar) {
      state.feedback.keepChars = (state.feedback.keepChars || []).filter(function (c) {
        return c !== d.unkeepChar;
      });
      toast('已取消保留「' + d.unkeepChar + '」');
      if (state.screen === 'detail') applyFeedbackToDetail();
      if (state.screen === 'result') refreshRecs();
      return render({ keepScroll: true });
    }
    if (d.banChar) {
      if (!state.feedback.banChars) state.feedback.banChars = {};
      if (state.feedback.banChars[d.banChar]) {
        delete state.feedback.banChars[d.banChar];
        toast('已取消排除「' + d.banChar + '」');
        applyFeedbackToDetail();
      } else {
        state.feedback.banChars[d.banChar] = 1;
        state.feedback.keepChars = (state.feedback.keepChars || []).filter(function (c) {
          return c !== d.banChar;
        });
        toast('之后绝不再出现「' + d.banChar + '」');
        var banRes = applyFeedbackToDetail();
        if (!banRes.ok) toast('带当前偏好的候选不够了，试试取消部分排除或换姓');
      }
      if (state.screen === 'result') refreshRecs();
      return render({ keepScroll: true });
    }
    if (d.keepChar) {
      var kc = state.feedback.keepChars || [];
      var kAt = kc.indexOf(d.keepChar);
      if (kAt !== -1) {
        kc.splice(kAt, 1);
        toast('已取消保留「' + d.keepChar + '」');
        applyFeedbackToDetail();
      } else {
        if (kc.length >= 4) { toast('最多保留 4 个字'); return; }
        kc.push(d.keepChar);
        if (state.feedback.banChars) delete state.feedback.banChars[d.keepChar];
        toast('之后名字都必须带「' + d.keepChar + '」');
        var keepRes = applyFeedbackToDetail();
        if (!keepRes.ok) toast('带这些保留字的候选不够了，试试取消部分保留或换姓');
      }
      state.feedback.keepChars = kc;
      if (state.screen === 'result') refreshRecs();
      return render({ keepScroll: true });
    }
    if (t.hasAttribute('data-clear-feedback')) {
      state.feedback = { banFull: {}, banChars: {}, keepChars: [] };
      if (state.profile && state.screen === 'result') {
        state.recShown = {};
        refreshRecs();
      }
      if (state.screen === 'detail') applyFeedbackToDetail();
      if (sheet.type === 'ban-names' && sheetIsOpen()) closeSheet();
      toast('已清空推荐偏好');
      return render({ keepScroll: true });
    }
    if (t.hasAttribute('data-clear-sur-f')) {
      state.studio.surF = { type: 'all', pop: 'all', letter: 'all' };
      state.studio.surKeyword = '';
      return render({ keepScroll: true });
    }
    if (t.hasAttribute('data-clear-char-f')) {
      state.studio.charF = { dom: 'all', g: 'all', freq: 'all', letter: 'all' };
      state.studio.charKeyword = '';
      return render({ keepScroll: true });
    }
    if (t.hasAttribute('data-clear-en-f')) {
      state.enF = { g: 'all', era: 'all', vibe: 'all', theme: 'all', lang: 'all', keyword: '' };
      return render({ keepScroll: true });
    }
  });

  $('#hd-back').addEventListener('click', function () {
    /* 浮层开着的时候，返回键先收浮层（浮层没走页面栈，不该把上一页也弹掉） */
    if (sheetIsOpen()) return closeSheet();
    /* 先信页面栈：从哪儿来的就回哪儿去（进浏览区之前那一页才对得上）。
     * 栈空的时候（比如刷新后直接停在某一页）退回静态映射表兜底。 */
    var target = hist.length ? hist[hist.length - 1] : null;
    if (target) {
      hist.pop();
      return swapTo(target, true);
    }
    /* detail 兜底按来处算（可能是从「我的」点进来的收藏） */
    var fromMine = state.detailFrom === 'mine';
    var back = {
      detail: fromMine ? 'mine' : 'result',
      en: state.enFrom === 'home' ? 'home' : (state.enFrom || 'home'),
      result: 'home', mine: 'home',
      translit: 'home', studio: 'home',
      'studio-sur': 'studio', 'studio-char': 'studio'
    };
    goBack(back[state.screen] || 'home');
  });
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-dl').addEventListener('click', function (e) { e.preventDefault(); saveCard(); });
  $('#sheet-close').addEventListener('click', function () { closeSheet(); });
  $('#sheet-mask').addEventListener('click', function () { closeSheet(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (sheetIsOpen()) { closeSheet(); return; }
      var modal = $('#modal');
      if (modal && !modal.classList.contains('hidden')) { closeModal(); return; }
    }
  });

  /* 搜索框：只重画列表、不整个 render()，否则输入框会掉焦点。 */
  /* 收藏列表的整行按下反馈。
   * 不能只靠 CSS 的 :active —— iOS 的 webview 里它不一定会落到非按钮的祖先元素上，
   * 行中间的空隙按下去就毫无反应。所以自己挂一个 .press：按下时整行变色，抬手摘掉。
   * 按在右边那颗心上不算「点这一条」（那是取消收藏），不亮整行，只亮那颗心。 */
  var pressRow = null;
  function rowPress(on) {
    if (!pressRow) return;
    pressRow.classList.toggle('press', !!on);
    if (!on) pressRow = null;
  }
  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    rowPress(false);
    if (t.closest('.fav-del')) return;
    pressRow = t.closest('.fav-row');
    rowPress(true);
  });
  document.addEventListener('pointerup', function () { rowPress(false); });
  document.addEventListener('pointercancel', function () { rowPress(false); });

  document.addEventListener('input', function (e) {
    var id = e.target && e.target.id;
    if (!id) return;
    var kw = String(e.target.value || '').trim().toLowerCase();

    if (id === 'sur-input') {
      state.surKeyword = e.target.value;
      /* 只重画卡片区：输入框被换掉就掉焦点了 */
      var rows = document.querySelector('#sur-rows');
      if (rows) rows.innerHTML = surnameRowsHtml(kw);
      return;
    }

    /* 工作台的姓 / 字搜索：同理，只换列表不动输入框 */
    if (id === 'st-sur-input') {
      state.studio.surKeyword = e.target.value;
      paintSurGrid();
      return;
    }

    if (id === 'st-char-input') {
      state.studio.charKeyword = e.target.value;
      paintCharGrid();
      return;
    }

    if (id === 'en-input') {
      state.enInput = e.target.value;
      scheduleEnRec();
      return;
    }

    if (id === 'en-search') {
      state.enF.keyword = e.target.value;
      paintEnBrowse();
      return;
    }

    if (id === 'tl-input') {
      state.translit.latin = e.target.value;
      return;
    }
  });

  function paintEnBrowse() {
    var list = browseEnNames();
    var box = $('#en-browse-list');
    var cnt = $('#en-browse-count');
    if (cnt) cnt.textContent = list.length + ' / ' + NM.NAMES_EN.length;
    if (box) {
      box.innerHTML = list.length
        ? list.map(function (it, i) { return enRow(it, i, ''); }).join('')
        : '<p class="empty">这个分类下没有名字，换个筛选试试。</p>';
    }
  }

  /* 输入中文名后只重画推荐结果，不整页重画（否则输入框会掉焦点） */
  function paintEnRec() {
    var box = $('#en-rec-out');
    if (box) box.innerHTML = enRecOut();
    var dk = $('#dock');
    if (dk) dk.innerHTML = dockFor('en');
  }

  /* 边输边算，防抖一下，别每敲一个字就全库排一遍 */
  var enTypingTimer = null;
  function scheduleEnRec() {
    if (enTypingTimer) clearTimeout(enTypingTimer);
    enTypingTimer = setTimeout(function () {
      enTypingTimer = null;
      state.enPicked = null;
      genEnNames();
      paintEnRec();
    }, 180);
  }

  /* 筛选和搜索只重画列表，输入框不会掉焦点、滚动位置也不会跳 */
  function paintSurGrid() {
    var list = studioSurs();
    var box = $('#st-sur-grid');
    if (box) box.innerHTML = surCells(list) || '<p class="empty">没筛到这个姓，放宽一下条件。</p>';
    var cnt = $('#st-sur-count');
    if (cnt) cnt.textContent = list.length + ' / ' + NM.allSurnames().length + ' 个';
    syncToTop();
  }

  function paintCharGrid() {
    var list = studioChars();
    var box = $('#st-char-grid');
    if (box) box.innerHTML = charCells(list) || '<p class="empty">没筛到这个字，放宽一下条件。</p>';
    var cnt = $('#st-char-count');
    if (cnt) cnt.textContent = list.length + ' / ' + NM.CHARS.length + ' 个';
    syncToTop();
  }

  render();
  initPersist();
})();
