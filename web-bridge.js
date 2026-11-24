/*! Loomis web bridge — hide Xiaohongshu-only chrome when ?platform=web */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var inXhs = !!(window.xhs && window.xhs.miniTool);
  var isWeb = params.get('platform') === 'web' || !inXhs;
  if (!isWeb) return;
  document.documentElement.classList.add('platform-web');

  var STYLE = document.createElement('style');
  STYLE.textContent = [
    '.platform-web #startRankBtn,',
    '.platform-web #endRankBtn,',
    '.platform-web #rankOv,',
    '.platform-web .rank-entry,',
    '.platform-web .xhs-follow,',
    '.platform-web [data-xhs-follow],',
    '.platform-web [data-follow-author],',
    '.platform-web .follow-entry,',
    '.platform-web .xhs-only,',
    '.platform-web [data-platform="xhs"]{display:none!important;}'
  ].join('');
  document.documentElement.appendChild(STYLE);

  function scrubCap() {
    var cap = window.XhsCap;
    if (!cap || cap.__webPatched || typeof cap.ready !== 'function') return;
    var ready = cap.ready.bind(cap);
    cap.ready = function (name) {
      if (name === 'rank' || name === 'follow' || name === 'share' || name === 'comment' || name === 'reward' || name === 'cloud') {
        return Promise.resolve(false);
      }
      return ready(name);
    };
    cap.__webPatched = true;
  }

  function scrub() {
    scrubCap();
    document.querySelectorAll(
      '#startRankBtn,#endRankBtn,#rankOv,.rank-entry,.xhs-follow,[data-xhs-follow],[data-follow-author],.follow-entry,.xhs-only,[data-platform="xhs"]'
    ).forEach(function (el) {
      el.hidden = true;
      el.style.setProperty('display', 'none', 'important');
    });
  }

  // Esc inside cross-origin iframe → tell the studio parent to close the shell.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'loomis-work-esc' }, '*');
      }
    } catch (err) {}
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scrub);
  else scrub();
  setTimeout(scrub, 600);
  setTimeout(scrub, 2000);
})();
