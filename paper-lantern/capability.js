/*!
 * xhs-capability.js — 小红书小工具平台能力适配层
 * 经典脚本 · 无依赖 · 须在业务 app.js 之前引入
 * 依据《小工具容器 · 能力清单》(2026-11-10) §3.6 / §3.7 / §3.11 / §3.13 / §3.16 / §3.17 / §3.18 / §3.19
 *
 * 设计原则：
 *   1) 每个能力都先判「方法是否存在」再判「客户端版本是否达标」，缺失即静默降级；
 *   2) 统一 Promise 形态，失败一律 reject，业务只需 catch；
 *   3) 不把浏览器存储当可靠方案，原生存储失败时回退 localStorage 并容忍失败；
 *   4) 容器内不主动调用被禁用的 navigator.vibrate（§4.1），仅普通浏览器预览时兜底。
 *
 * 用法：
 *   XhsCap.ready('rank').then(ok => ...)
 *   XhsCap.rank.load('day').then(pack => ...)
 *   XhsCap.vibrate.short('light')
 *   XhsCap.note.post({ dataUrl }) / XhsCap.share.imageFromDataUrl(dataUrl)
 *   XhsCap.storage.set('best', '12')
 *   XhsCap.window.auto()
 */
(function (global) {
  'use strict';

  // 各能力的最低客户端版本（取 buildVersion / 1000）
  var MIN_CLIENT = {
    storage: 9460,
    fs: 9490,
    windowInfo: 9490,
    location: 9490,
    vibrate: 9500,
    gyroscope: 9500,
    follow: 9510,
    cloud: 9510,
    rank: 9510,
    share: 9530,
    comment: 9490,
    reward: 9533,
    retention: 9533
  };

  // 各能力依赖的 miniTool 方法
  var NEED = {
    storage: ['setStorage', 'getStorage'],
    fs: ['writeFile', 'readFile'],
    windowInfo: ['getWindowInfo'],
    location: ['getLocation'],
    vibrate: ['vibrateShort'],
    gyroscope: ['startGyroscope', 'onGyroscopeChange'],
    follow: ['followAuthor', 'getFollowStatus'],
    cloud: ['addCloudStorage', 'queryCloudStorage'],
    rank: ['submitScore', 'getRankList', 'getMyRank'],
    share: ['share'],
    comment: ['interactionOpenApi'],
    reward: ['rewardAuthor'],
    retention: ['setCloseRetentionEnabled']
  };

  var RANK_CACHE_MS = 45000;
  var RANK_SCORE_MAX = 1000000;
  var SNAPSHOT_MAX = 2048;

  function tool() {
    var x = global.xhs;
    return (x && x.miniTool) || null;
  }

  function hasMethods(names) {
    var m = tool();
    if (!m) return false;
    for (var i = 0; i < names.length; i++) {
      if (typeof m[names[i]] !== 'function') return false;
    }
    return true;
  }

  function errCode(err) {
    if (!err) return NaN;
    return err.errCode != null ? Number(err.errCode) : NaN;
  }

  function impossible(name, code) {
    return { errMsg: name + ':unsupported', errCode: code == null ? -1 : code };
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* ── 版本 ─────────────────────────────────────── */

  function buildVersionOf(launchOptions) {
    var env = launchOptions && launchOptions.miniToolEnv;
    return Number(env && env.buildVersion) || 0;
  }

  function toClientVersion(buildVersion) {
    return Math.floor((Number(buildVersion) || 0) / 1000);
  }

  var versionPromise = null;

  function version() {
    if (versionPromise) return versionPromise;
    var x = global.xhs;
    var sync = buildVersionOf(x && x.launchOptions);
    if (sync) {
      versionPromise = Promise.resolve(toClientVersion(sync));
      return versionPromise;
    }
    var m = tool();
    if (!m || typeof m.getLaunchOptions !== 'function') {
      versionPromise = Promise.resolve(0);
      return versionPromise;
    }
    versionPromise = Promise.resolve(m.getLaunchOptions()).then(function (lo) {
      return toClientVersion(buildVersionOf(lo));
    }).catch(function () { return 0; });
    return versionPromise;
  }

  function versionText(cv) {
    cv = Number(cv) || 0;
    if (!cv) return '未知';
    return (cv / 1000).toFixed(2);
  }

  /** 能力是否可用：方法齐备 + 客户端版本达标。两者都不满足即 false。 */
  function ready(feature) {
    var need = NEED[feature];
    if (!need) return Promise.resolve(false);
    if (!hasMethods(need)) return Promise.resolve(false);
    var min = MIN_CLIENT[feature] || 0;
    return version().then(function (cv) {
      if (!cv) return false;
      return cv >= min;
    });
  }

  /* ── 通用调用 ─────────────────────────────────── */

  function call(name, options) {
    var m = tool();
    if (!m || typeof m[name] !== 'function') {
      return Promise.reject(impossible(name));
    }
    try {
      var ret = options === undefined ? m[name]() : m[name](options);
      return Promise.resolve(ret);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /* ── 存储：原生优先，失败回退 localStorage ------ */

  function lsGet(key) {
    try {
      var v = global.localStorage.getItem(key);
      return v == null ? null : v;
    } catch (e) { return null; }
  }

  function lsSet(key, str) {
    try {
      global.localStorage.setItem(key, str);
      return true;
    } catch (e) { return false; }
  }

  function lsRemove(key) {
    try { global.localStorage.removeItem(key); } catch (e) {}
  }

  var storage = {
    get: function (key) {
      var m = tool();
      if (m && typeof m.getStorage === 'function') {
        return call('getStorage', { key: key }).then(function (res) {
          var d = res && res.data;
          if (d === undefined || d === null) return null;
          return typeof d === 'string' ? d : JSON.stringify(d);
        }).catch(function () { return lsGet(key); });
      }
      return Promise.resolve(lsGet(key));
    },
    set: function (key, data) {
      var str;
      try {
        str = typeof data === 'string' ? data : JSON.stringify(data);
      } catch (e) { return Promise.resolve(false); }
      if (typeof str !== 'string') return Promise.resolve(false);
      var m = tool();
      if (m && typeof m.setStorage === 'function') {
        return call('setStorage', { key: key, data: str }).then(function () {
          lsSet(key, str);
          return true;
        }).catch(function () {
          // 原生写入失败才落到浏览器存储；容器不保证其持久性
          return lsSet(key, str);
        });
      }
      return Promise.resolve(lsSet(key, str));
    },
    remove: function (key) {
      lsRemove(key);
      return call('removeStorage', { key: key }).then(function () { return true; })
        .catch(function () { return false; });
    },
    info: function () {
      return call('getStorageInfo', {});
    }
  };

  /* ── 临时文件 ─────────────────────────────────── */

  function toTempPath(data) {
    if (!data) return Promise.resolve(null);
    if (!hasMethods(['writeTempFile'])) return Promise.resolve(null);
    return call('writeTempFile', { data: data }).then(function (res) {
      return (res && res.filePath) || null;
    }).catch(function () { return null; });
  }

  /* ── 振动 ─────────────────────────────────────── */

  var VIBRATE_MS = { light: 8, medium: 16, heavy: 26 };

  /** 把旧的毫秒值 / 数组模式折算成轻中重三档（平台不支持自定义波形） */
  function intensityOf(pattern) {
    var ms = 0;
    if (pattern && typeof pattern.length === 'number' && typeof pattern !== 'string') {
      for (var i = 0; i < pattern.length; i++) ms += Number(pattern[i]) || 0;
    } else {
      ms = Number(pattern) || 0;
    }
    if (ms >= 40) return 'heavy';
    if (ms >= 24) return 'medium';
    return 'light';
  }

  function previewVibrate(ms) {
    // 仅普通浏览器预览使用；容器内 §4.1 已禁用 navigator.vibrate
    if (tool()) return Promise.resolve(false);
    try {
      if (global.navigator && typeof global.navigator.vibrate === 'function') {
        global.navigator.vibrate(ms);
      }
    } catch (e) {}
    return Promise.resolve(false);
  }

  var vibrate = {
    short: function (type) {
      var t = type === 'heavy' || type === 'medium' ? type : 'light';
      if (hasMethods(['vibrateShort'])) {
        return call('vibrateShort', { type: t }).catch(function () { return false; });
      }
      return previewVibrate(VIBRATE_MS[t]);
    },
    long: function () {
      if (hasMethods(['vibrateLong'])) {
        return call('vibrateLong', {}).catch(function () { return false; });
      }
      return previewVibrate(42);
    },
    /** 兼容旧写法的毫秒数 / 振动数组，映射到平台三档强度 */
    pattern: function (pattern) {
      return vibrate.short(intensityOf(pattern));
    }
  };

  /* ── 排行榜（内测 · 需勾选头像昵称授权）──────── */

  var rankCache = {};
  var rankDenied = false;
  var RANK_BOARD = 1;

  function rankDeny() {
    rankDenied = true;
    rankCache = {};
  }

  function rankClamp(score) {
    var n = Number(score);
    if (!isFinite(n)) return 0;
    if (n > RANK_SCORE_MAX) return RANK_SCORE_MAX;
    if (n < -RANK_SCORE_MAX) return -RANK_SCORE_MAX;
    return n;
  }

  var rank = {
    isDenied: function () { return rankDenied; },
    reset: function () { rankDenied = false; rankCache = {}; },
    submit: function (score, board) {
      if (rankDenied) return Promise.resolve(null);
      var s = rankClamp(score);
      if (!(s > 0)) return Promise.resolve(null);
      if (!hasMethods(NEED.rank)) return Promise.resolve(null);
      return call('submitScore', { board: board || RANK_BOARD, score: s }).then(function (res) {
        rankCache = {};
        return res || null;
      }).catch(function (err) {
        var c = errCode(err);
        if (c === 1005 || c === 1006) rankDeny();
        return null;
      });
    },
    list: function (period, board, attempt) {
      attempt = attempt || 0;
      if (rankDenied) return Promise.reject({ errMsg: 'getRankList:denied', errCode: 1005 });
      if (!hasMethods(NEED.rank)) return Promise.reject(impossible('getRankList'));
      return call('getRankList', {
        board: board || RANK_BOARD,
        period: period || 'day'
      }).then(function (res) {
        return (res && res.data) || [];
      }).catch(function (err) {
        var c = errCode(err);
        // 2002：榜单缓存未就绪，不能当空榜渲染，有限次退避
        if (c === 2002 && attempt < 4) {
          return sleep([500, 1000, 2000, 4000][attempt]).then(function () {
            return rank.list(period, board, attempt + 1);
          });
        }
        if (c === 1005 || c === 1006) rankDeny();
        throw err;
      });
    },
    mine: function (period, board) {
      if (rankDenied) return Promise.reject({ errMsg: 'getMyRank:denied', errCode: 1005 });
      if (!hasMethods(NEED.rank)) return Promise.reject(impossible('getMyRank'));
      return call('getMyRank', {
        board: board || RANK_BOARD,
        period: period || 'day'
      }).then(function (res) {
        return res || null;
      }).catch(function (err) {
        var c = errCode(err);
        if (c === 1005 || c === 1006) rankDeny();
        throw err;
      });
    },
    /** 一次取「榜单 + 我的排名」，带 45s 缓存；list 失败会向上 reject */
    load: function (period, board, force) {
      period = period || 'day';
      board = board || RANK_BOARD;
      var hit = rankCache[period];
      if (!force && hit && (Date.now() - hit.at) < RANK_CACHE_MS) {
        return Promise.resolve(hit);
      }
      return Promise.all([
        rank.list(period, board),
        rank.mine(period, board).catch(function () { return null; })
      ]).then(function (pair) {
        var pack = { at: Date.now(), period: period, list: pair[0] || [], mine: pair[1] };
        rankCache[period] = pack;
        return pack;
      });
    }
  };

  /* ── 分享 ─────────────────────────────────────── */

  var SHARE_HINT = {
    10001: '分享参数有误，暂时不能分享',
    15501: '图片格式或大小不支持',
    15502: '当前页面不支持分享，请在 App 全屏打开',
    15503: '今天的分享次数已达上限'
  };

  var share = {
    card: function () { return call('share', { type: 'card' }); },
    image: function (resource) {
      return call('share', { type: 'image', image_resource: resource });
    },
    /** 大图先落临时文件再分享，避免超长 base64（§3.18） */
    imageFromDataUrl: function (dataUrl) {
      return toTempPath(dataUrl).then(function (path) {
        return share.image(path || dataUrl);
      });
    },
    hint: function (err) {
      return SHARE_HINT[errCode(err)] || '分享失败，请稍后再试';
    }
  };

  /* ── 评论区 ───────────────────────────────────── */

  var comment = {
    /** opts: { content, images:[dataUrl], snapshot, saveToAlbum } */
    open: function (opts) {
      opts = opts || {};
      var images = opts.images || [];
      var jobs = [];
      for (var i = 0; i < images.length; i++) jobs.push(toTempPath(images[i]));
      return Promise.all(jobs).then(function (paths) {
        var beans = [];
        for (var k = 0; k < paths.length; k++) {
          // media_bean 只接受容器本地文件句柄，data URI 与网络地址无效
          if (paths[k]) beans.push({ media_type: 'image', cover_image_url: paths[k] });
        }
        var payload = {
          action: opts.action || 'post_comment',
          content: String(opts.content || '')
        };
        if (beans.length) payload.media_bean = beans;
        if (opts.snapshot) {
          var snap = JSON.stringify(opts.snapshot);
          if (typeof snap === 'string' && snap.length <= SNAPSHOT_MAX) {
            payload.miniToolSnapshotInfo = snap;
          }
        }
        return call('interactionOpenApi', {
          payload: payload,
          saveToAlbum: opts.saveToAlbum !== false
        });
      });
    }
  };

  /* ── 窗口信息 / 安全区避让 ────────────────────── */

  var win = {
    get: function () { return call('getWindowInfo'); },
    /**
     * 把容器尺寸写进 CSS 变量，供布局消费：
     *   --safe-area-inset-top    状态栏高度
     *   --safe-area-inset-bottom 底部安全区
     *   --container-nav-h        顶部原生按钮（返回 / 分享）占位高度
     */
    applySafeArea: function (info) {
      if (!info || !global.document) return info;
      var root = global.document.documentElement;
      if (!root || !root.style) return info;
      var safe = info.safeArea || {};
      var top = Number(safe.top);
      if (!isFinite(top)) top = Number(info.statusBarHeight);
      if (!isFinite(top)) top = 0;
      root.style.setProperty('--safe-area-inset-top', top + 'px');

      var bottom = Number(safe.bottom);
      var winH = Number(info.windowHeight);
      if (isFinite(bottom) && isFinite(winH)) {
        root.style.setProperty('--safe-area-inset-bottom', Math.max(0, winH - bottom) + 'px');
      }

      var btnTop = 0;
      var btns = info.menuButtons;
      if (btns) {
        var keys = ['back', 'me', 'share'];
        for (var i = 0; i < keys.length; i++) {
          var r = btns[keys[i]];
          if (r && isFinite(Number(r.bottom))) btnTop = Math.max(btnTop, Number(r.bottom));
        }
      }
      root.style.setProperty('--container-nav-h', Math.max(0, btnTop - top) + 'px');
      return info;
    },
    auto: function () {
      return win.get().then(win.applySafeArea).catch(function () { return null; });
    }
  };


  /* ── 发笔记（postNote）─────────────────────────── */

  var NOTE_HINT = {
    10001: '参数有误，暂时不能发布',
    10003: '当前环境暂不支持发笔记'
  };

  var note = {
    available: function () { return hasMethods(['postNote']); },
    /** opts: { dataUrl, title, content } */
    post: function (opts) {
      opts = opts || {};
      if (!hasMethods(['postNote'])) return Promise.reject(impossible('postNote'));
      var title = String(opts.title || '').slice(0, 20);
      var content = String(opts.content || '').slice(0, 1000);
      var dataUrl = opts.dataUrl || '';
      function send(url) {
        var payload = { title: title, content: content };
        if (url) payload.mediaInfo = { image_resources: [{ url: url }] };
        return call('postNote', payload);
      }
      if (!dataUrl) return send('');
      return toTempPath(dataUrl).then(function (path) {
        return send(path || dataUrl);
      });
    },
    hint: function (err) {
      return NOTE_HINT[errCode(err)] || '打开发布页失败，请稍后再试';
    }
  };

  /* ── 关注 / 赞赏 / AI ─────────────────────────── */

  var follow = {
    status: function () { return call('getFollowStatus'); },
    open: function () { return call('followAuthor'); }
  };

  var reward = {
    open: function () { return call('rewardAuthor'); },
    retain: function (enabled) {
      return call('setCloseRetentionEnabled', { enabled: !!enabled });
    }
  };

  var ai = {
    available: function () {
      var a = global.xhs && global.xhs.AI;
      return !!(a && typeof a.createModel === 'function');
    },
    /** opts: { model, messages, maxOutputTokens, temperature } */
    generate: function (opts) {
      opts = opts || {};
      var a = global.xhs && global.xhs.AI;
      if (!a || typeof a.createModel !== 'function') {
        return Promise.reject(impossible('AI', 10003));
      }
      var model = a.createModel(opts.model || 'deepseek-v4-flash');
      var body = {
        messages: opts.messages || [],
        max_output_tokens: Math.min(opts.maxOutputTokens || 800, 2048),
        temperature: opts.temperature == null ? 0.8 : opts.temperature
      };
      return Promise.resolve(model.generateText(body)).then(function (res) {
        var msg = res && res.choices && res.choices[0] && res.choices[0].message;
        return {
          text: (msg && msg.content) || '',
          requestId: res && res.request_id,
          raw: res
        };
      });
    }
  };

  global.XhsCap = {
    MIN_CLIENT: MIN_CLIENT,
    tool: tool,
    has: hasMethods,
    ready: ready,
    call: call,
    version: version,
    versionText: versionText,
    errCode: errCode,
    toTempPath: toTempPath,
    storage: storage,
    vibrate: vibrate,
    rank: rank,
    share: share,
    note: note,
    comment: comment,
    window: win,
    follow: follow,
    reward: reward,
    ai: ai
  };
})(window);
