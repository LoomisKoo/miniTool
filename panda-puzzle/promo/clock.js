/**
 * 录制用虚拟时钟
 *
 * 逐帧截图时，真实时间是乱的（截一张要几十毫秒），动画会抖。
 * 这里把 rAF / setTimeout / performance.now 全部接管，由渲染脚本按 1/30s
 * 手动推进，每推进一次截一张 —— 画面严格可复现。
 *
 * CSS transition 不归这套时钟管，所以在 step() 里用 Web Animations API
 * 把正在跑的 transition 暂停、按虚拟时间设置 currentTime（见 syncAnimations）。
 */
(function () {
  var vnow = 0;
  var rafQ = [];
  var timers = [];
  var seq = 1;
  var baseDate = Date.now();

  /* 真实的定时器 / rAF / 时钟，留给渲染脚本用：
   * 应用里有些 await 要等 rAF（材质烘焙分批让帧），虚拟时钟不推进就永远等不到，
   * 所以「等一个异步操作」必须靠这几个真实接口把时间嚼过去。 */
  var realSetTimeout = window.setTimeout.bind(window);
  var realRaf = window.requestAnimationFrame.bind(window);
  var realNow = performance.now.bind(performance);
  window.__real = {
    setTimeout: function (fn, ms) { return realSetTimeout(fn, ms); },
    raf: function (fn) { return realRaf(fn); },
    now: function () { return realNow(); },
  };

  window.requestAnimationFrame = function (cb) {
    var id = seq++;
    rafQ.push({ id: id, cb: cb });
    return id;
  };
  window.cancelAnimationFrame = function (id) {
    rafQ = rafQ.filter(function (x) { return x.id !== id; });
  };

  performance.now = function () { return vnow; };
  Date.now = function () { return baseDate + vnow; };

  window.setTimeout = function (fn, ms) {
    var id = seq++;
    timers.push({ id: id, due: vnow + (ms || 0), fn: fn, rep: 0 });
    return id;
  };
  window.setInterval = function (fn, ms) {
    var id = seq++;
    timers.push({ id: id, due: vnow + (ms || 0), fn: fn, rep: Math.max(1, ms || 1) });
    return id;
  };
  window.clearTimeout = function (id) {
    timers = timers.filter(function (t) { return t.id !== id; });
  };
  window.clearInterval = window.clearTimeout;

  /* 原生平滑滚动走的是合成器时钟，会跟虚拟时间错开，录制时统一改成瞬时 */
  if (window.Element && Element.prototype.scrollBy) {
    var origScrollBy = Element.prototype.scrollBy;
    Element.prototype.scrollBy = function (opts) {
      if (opts && typeof opts === 'object') opts = Object.assign({}, opts, { behavior: 'auto' });
      return origScrollBy.call(this, opts);
    };
    var origScrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function (opts) {
      if (opts && typeof opts === 'object') opts = Object.assign({}, opts, { behavior: 'auto' });
      return origScrollTo.call(this, opts);
    };
  }

  /**
   * 接管 CSS transition：第一次看到时暂停并把起点记在虚拟时钟上，
   * 之后每帧把 currentTime 设成「从起点到现在的虚拟时长」。
   */
  var seen = new WeakMap();
  function syncAnimations() {
    if (!document.getAnimations) return;
    var list;
    try { list = document.getAnimations(); } catch (e) { return; }
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (a.playState === 'finished' || a.playState === 'idle') continue;
      var t0 = seen.get(a);
      if (t0 == null) {
        t0 = vnow;
        seen.set(a, t0);
        try { a.pause(); } catch (e) { continue; }
        try { a.currentTime = 0; } catch (e) {}
      } else {
        var ms = a.effect && a.effect.getTiming ? a.effect.getTiming().duration : 0;
        var v = vnow - t0;
        try { a.currentTime = ms ? Math.min(ms, v) : v; } catch (e) {}
      }
    }
  }

  window.__clock = {
    now: function () { return vnow; },
    step: function (dt) {
      vnow += dt;

      // 到期的定时器按时间顺序跑完（回调里可能再排新的，留给下一帧）
      var due = timers.filter(function (t) { return t.due <= vnow; });
      due.sort(function (a, b) { return a.due - b.due; });
      for (var i = 0; i < due.length; i++) {
        var t = due[i];
        if (t.rep) t.due = vnow + t.rep;
        else timers = timers.filter(function (x) { return x !== t; });
        try { t.fn(); } catch (e) { /* 录制时不要让单个回调打断整条时间线 */ }
      }

      // rAF 回调：这一帧取一份快照，回调里再排的进入下一帧
      var q = rafQ;
      rafQ = [];
      for (var j = 0; j < q.length; j++) {
        try { q[j].cb(vnow); } catch (e) {}
      }

      syncAnimations();
    },
  };
})();
