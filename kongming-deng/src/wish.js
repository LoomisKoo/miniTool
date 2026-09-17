// 祈愿灯 - 祝福语交互（预选 chip 高亮 + 输入 + 镜头前放飞）
(function () {
  const KD = window.KD || (window.KD = {});
  const PRESETS = ['平安喜乐', '前程似锦', '岁岁平安', '心想事成', '家人安康', '山河无恙'];

  function clearActive() {
    document.querySelectorAll('#chips .chip').forEach(c => c.classList.remove('on'));
  }

  function init() {
    const chips = document.getElementById('chips');
    const input = document.getElementById('wsInput');
    PRESETS.forEach(p => {
      const b = document.createElement('div');
      b.className = 'chip'; b.textContent = p;
      b.onclick = () => {
        input.value = p;
        clearActive();
        b.classList.add('on');
      };
      chips.appendChild(b);
    });
    input.oninput = clearActive;
    document.getElementById('launchBtn').onclick = launch;
    document.getElementById('cardBtn').onclick = () => KD.exportCard.show();
  }

  function launch() {
    const ta = document.getElementById('wsInput');
    const txt = (ta.value || '').trim() || '平安喜乐';
    // 镜头前专属孔明灯，缓缓升空
    KD.lanterns.spawn({ hero: true, text: txt, x: 0, z: 20, y: 7, color: 0xffd27a, vy: 3.2 });
    // 远近天空大量烟花 + 人群喝彩
    KD.fireworks.celebrate();
    KD.audio.cheer();
    // 放飞后隐藏祝福语模块，专心看灯飞
    KD.uiHidden = true;
    document.getElementById('ui').classList.add('hidden');
  }

  KD.wish = { init, launch, PRESETS };
})();
