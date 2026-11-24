/*!
 * xhs-reward.js — 小红书小工具「赞赏」通用入口（§3.19 / §3.20）
 *
 * 依据《小工具容器 · 能力清单》2026-11-10：
 *   · rewardAuthor 无业务参数，客户端负责赞赏开关校验、面板、协议、充值支付与频控；
 *   · 成功只返回 errMsg: "rewardAuthor:ok"，**不含金额与支付结果**，不能据此判断是否付费；
 *   · 需客户端 9.53.3+，且当前小工具需先在创服平台开通赞赏能力；
 *   · SDK 方法存在不代表客户端已支持，旧客户端可能静默无响应，所以调用要带超时兜底；
 *   · setCloseRetentionEnabled 必须配合赞赏使用，开关默认 false，容器关闭后失效。
 *
 * 用法（零配置，引入即用）：引入本文件即可，无需改 HTML / CSS。
 * 需要自定义时再调用：
 *   XhsReward.mount({ label: '请我喝杯茶', position: 'right', retentionAfter: 0 })
 */
(function (global) {
  'use strict';

  if (!global || global.XhsReward) return;

  var MIN_CLIENT = 9533;
  var CALL_TIMEOUT = 8000;
  var PROBE_KEY = 'xhs-reward-unavailable';
  var MOUNT_ID = 'xhsRewardEntry';

  function tool() {
    var x = global.xhs;
    return (x && x.miniTool) || null;
  }

  function hasApi() {
    var m = tool();
    return !!(m && typeof m.rewardAuthor === 'function');
  }

  function buildVersionOf(lo) {
    var env = lo && lo.miniToolEnv;
    return Number(env && env.buildVersion) || 0;
  }

  var versionPromise = null;

  function clientVersion() {
    if (versionPromise) return versionPromise;
    var x = global.xhs;
    var sync = buildVersionOf(x && x.launchOptions);
    if (sync) {
      versionPromise = Promise.resolve(Math.floor(sync / 1000));
      return versionPromise;
    }
    var m = tool();
    if (!m || typeof m.getLaunchOptions !== 'function') {
      versionPromise = Promise.resolve(0);
      return versionPromise;
    }
    versionPromise = Promise.resolve(m.getLaunchOptions()).then(function (lo) {
      return Math.floor(buildVersionOf(lo) / 1000);
    }).catch(function () { return 0; });
    return versionPromise;
  }

  /** 能否展示入口：方法齐备 + 版本达标 + 本次会话没出现过「不可用」 */
  function available() {
    if (!hasApi()) return Promise.resolve(false);
    try {
      if (global.sessionStorage && global.sessionStorage.getItem(PROBE_KEY) === '1') {
        return Promise.resolve(false);
      }
    } catch (e) {}
    return clientVersion().then(function (cv) {
      return !!cv && cv >= MIN_CLIENT;
    });
  }

  function markUnavailable() {
    try {
      if (global.sessionStorage) global.sessionStorage.setItem(PROBE_KEY, '1');
    } catch (e) {}
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject({ errMsg: 'rewardAuthor:timeout', errCode: -2 });
      }, ms || CALL_TIMEOUT);
      Promise.resolve(promise).then(function (v) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      }).catch(function (e) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  function open() {
    var m = tool();
    if (!m || typeof m.rewardAuthor !== 'function') {
      return Promise.reject({ errMsg: 'rewardAuthor:unsupported', errCode: -1 });
    }
    var call;
    try {
      call = m.rewardAuthor();
    } catch (e) {
      return Promise.reject(e);
    }
    return withTimeout(call).catch(function (err) {
      // 容器白名单 / 未开通 / 旧客户端静默：本次会话不再尝试
      var code = err && err.errCode != null ? Number(err.errCode) : NaN;
      if (code === 10001 || code === 10002 || code === 10003 || code === -2 || isNaN(code)) {
        markUnavailable();
      }
      throw err;
    });
  }

  function retention(enabled) {
    var m = tool();
    if (!m || typeof m.setCloseRetentionEnabled !== 'function') return Promise.resolve(false);
    try {
      return Promise.resolve(m.setCloseRetentionEnabled({ enabled: !!enabled }))
        .catch(function () { return false; });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  /* ── 轻提示 ───────────────────────────────── */

  var toastTimer = 0;

  function toast(msg) {
    var el = document.getElementById('xhsRwToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'xhsRwToast';
      el.className = 'xhs-rw-toast';
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2000);
  }

  /* ── 样式（内联 <style> 在容器内允许，§2.6）──── */

  var CSS = [
    '.xhs-rw{position:fixed;left:14px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:60;',
    'display:none;align-items:center;gap:5px;padding:7px 13px;border-radius:999px;',
    'background:rgba(28,18,14,.72);border:1px solid rgba(255,190,120,.42);',
    'color:#ffe0b0;font:700 12px/1 -apple-system,"PingFang SC",sans-serif;letter-spacing:.06em;',
    'box-shadow:0 4px 14px rgba(0,0,0,.28);cursor:pointer;-webkit-tap-highlight-color:transparent;',
    'transition:transform .12s ease,opacity .2s ease;opacity:0;}',
    '.xhs-rw.on{display:inline-flex;opacity:1;}',
    '.xhs-rw:active{transform:scale(.95);}',
    '.xhs-rw[data-pos="right"]{left:auto;right:14px;}',
    '.xhs-rw i{font-style:normal;font-size:13px;line-height:1;color:#ffb347;}',
    '.xhs-rw-toast{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));',
    'z-index:61;max-width:76vw;padding:9px 16px;border-radius:999px;background:rgba(30,20,16,.94);',
    'border:1px solid rgba(255,190,120,.3);color:#ffe0b0;font:700 13px/1.4 -apple-system,"PingFang SC",sans-serif;',
    'text-align:center;opacity:0;visibility:hidden;pointer-events:none;',
    'transform:translateX(-50%) translateY(8px);transition:opacity .2s,transform .2s,visibility .2s;}',
    '.xhs-rw-toast.on{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0);}'
  ].join('');

  function injectStyle() {
    if (document.getElementById('xhsRwStyle')) return;
    var st = document.createElement('style');
    st.id = 'xhsRwStyle';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ── 入口挂载 ─────────────────────────────── */

  var mounted = null;
  var retentionTimer = 0;

  function mount(opts) {
    opts = opts || {};
    if (mounted) return mounted;
    if (!document.body) return null;

    injectStyle();

    var el = document.createElement('div');
    el.id = MOUNT_ID;
    el.className = 'xhs-rw';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    if (opts.position === 'right') el.setAttribute('data-pos', 'right');
    el.innerHTML = '<i>♥</i><span></span>';
    el.querySelector('span').textContent = opts.label || '赞赏支持';
    document.body.appendChild(el);
    mounted = el;

    // 游戏类页面在 window 上监听 pointerdown 做跳跃，必须阻止冒泡
    function swallow(e) { e.stopPropagation(); }
    el.addEventListener('pointerdown', swallow);
    el.addEventListener('touchstart', swallow, { passive: true });

    function trigger(e) {
      e.preventDefault();
      e.stopPropagation();
      if (el.getAttribute('data-busy') === '1') return;
      el.setAttribute('data-busy', '1');
      open().then(function () {
        // 成功只代表流程被唤起，不代表已支付（§3.19）
      }).catch(function (err) {
        var code = err && err.errCode != null ? Number(err.errCode) : NaN;
        if (code === 15503 || code === 2009) {
          toast('今天的赞赏次数已达上限');
        } else if (code === -2) {
          toast('赞赏暂未响应，请稍后再试');
        } else {
          toast('赞赏暂不可用');
          hide();
        }
      }).then(function () {
        el.removeAttribute('data-busy');
      });
    }

    el.addEventListener('click', trigger);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') trigger(e);
    });

    function show() { el.classList.add('on'); }
    function hide() { el.classList.remove('on'); }

    /* 底部工具条抬高：很多工具底部有固定/绝对定位的操作栏，赞赏入口不能压在上面。
       按「所有贴底元素的最上沿」算，这样多行堆叠的底栏（如座位选择 + 操作按钮）也能整体让开。 */
    function liftAboveDock() {
      var vh = global.innerHeight || 0;
      var top = vh;
      var all = document.body ? document.body.getElementsByTagName('*') : [];
      for (var i = 0; i < all.length; i++) {
        var n = all[i];
        if (n === el) continue;
        var r = n.getBoundingClientRect();
        if (r.height < 24 || r.height > vh * 0.6) continue;
        if (r.width < 40) continue;
        if (vh - r.bottom > 24) continue;          // 必须贴底
        var cs = global.getComputedStyle(n);
        if (!cs || cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (Number(cs.opacity) === 0 || cs.pointerEvents === 'none') continue;
        if (r.top < top) top = r.top;
      }
      var lift = top < vh ? vh - top : 0;
      // 额外 10px 让开描边/阴影；无底部栏时回落到 16px
      el.style.bottom = 'calc(' + (lift ? lift + 10 : 0) + 'px + 16px + env(safe-area-inset-bottom, 0px))';
    }

    var liftTimer = 0;
    function scheduleLift() {
      clearTimeout(liftTimer);
      liftTimer = setTimeout(liftAboveDock, 120);
    }

    liftAboveDock();
    global.addEventListener('resize', scheduleLift);
    global.addEventListener('orientationchange', scheduleLift);
    document.addEventListener('visibilitychange', scheduleLift);
    // 工具内切页（如影厅配置 → 3D 观感）会换一套底栏，点击后重新测量
    document.addEventListener('click', scheduleLift, true);
    setTimeout(liftAboveDock, 300);
    setTimeout(liftAboveDock, 1200);

    available().then(function (ok) {
      if (!ok) return;
      show();
      // 页面停留足够久才开启关闭挽留，避免一进来就被拦
      var after = opts.retentionAfter == null ? 60000 : opts.retentionAfter;
      if (after > 0) {
        retentionTimer = setTimeout(function () {
          if (document.visibilityState === 'visible') retention(true);
        }, after);
      }
    });

    mounted._open = open;
    mounted._retention = retention;
    mounted._hide = hide;
    mounted._show = show;
    return mounted;
  }

  function autoMount() {
    // 非小红书容器（抖音 / 快手 / 本地浏览器）直接不挂载
    if (!hasApi()) return;
    mount({});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  global.XhsReward = {
    MIN_CLIENT: MIN_CLIENT,
    available: available,
    open: open,
    retention: retention,
    mount: mount,
    toast: toast
  };
})(window);
