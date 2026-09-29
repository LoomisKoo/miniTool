/** 由 scripts/sync-from-source.mjs 从 ../src/body.html 生成，请勿手改 */
export const BODY_HTML = `<div class="app">
  <header class="hd">
    <button class="hd-btn hd-back hidden" id="hd-back" aria-label="返回">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
    </button>
    <h1 class="hd-title" id="hd-title">仙鹿起名</h1>
  </header>

  <main id="screen"></main>
  <div class="dock hidden" id="dock"></div>
</div>

<button class="to-top" id="to-top" type="button" aria-label="回到顶部">
  <svg viewBox="0 0 24 24"><path d="M12 18.5V5.5M6 11.5l6-6 6 6"/></svg>
</button>

<nav class="tabbar hidden" id="tabbar">
  <button class="tab" data-go="home" id="tab-home">
    <svg viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/></svg>
    <span>首页</span>
  </button>
  <button class="tab" data-go="mine" id="tab-mine">
    <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20.5c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5"/></svg>
    <span>我的</span>
  </button>
</nav>

<div class="sheet hidden" id="sheet">
  <div class="sheet-mask" id="sheet-mask"></div>
  <div class="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-hd">
      <span class="sheet-title" id="sheet-title">选姓氏</span>
      <button class="sheet-close" id="sheet-close" type="button">关闭</button>
    </div>
    <div class="sheet-body" id="sheet-body"></div>
  </div>
</div>

<div class="modal hidden" id="modal" role="dialog" aria-modal="true" aria-label="名字卡片预览">
  <div class="modal-top">
    <button class="modal-btn" id="modal-close" type="button">关闭</button>
  </div>
  <div class="modal-body"><img id="modal-img" alt="名字卡片"></div>
  <div class="modal-foot"><a class="modal-dl" id="modal-dl" href="#" download>下载图片</a></div>
</div>

<div class="toast" id="toast"></div>`;
