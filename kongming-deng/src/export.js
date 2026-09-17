// 祈愿灯 - 许愿卡合成（场景截图 + 标题/祝福语/日期）
(function () {
  const KD = window.KD || (window.KD = {});

  function build() {
    const ec = document.createElement('canvas');
    ec.width = 1080; ec.height = 1920;
    const ctx = ec.getContext('2d');

    // 底色渐变
    const g = ctx.createLinearGradient(0, 0, 0, 1920);
    g.addColorStop(0, '#070617'); g.addColorStop(0.5, '#1a1038'); g.addColorStop(1, '#3a1c34');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);

    // 叠加实时 3D 场景
    try {
      const gl = KD.app.renderer.domElement;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(gl, 0, 0, 1080, 1180);
      ctx.restore();
    } catch (e) {}

    // 底部压暗，保证文字可读
    const dg = ctx.createLinearGradient(0, 880, 0, 1920);
    dg.addColorStop(0, 'rgba(7,6,23,0)');
    dg.addColorStop(1, 'rgba(7,6,23,0.96)');
    ctx.fillStyle = dg; ctx.fillRect(0, 880, 1080, 1040);

    // 标题
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9c0';
    ctx.font = '700 92px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('祈 愿 灯', 540, 1080);

    // 祝福语
    const txt = (document.getElementById('wsInput').value || '').trim() || '平安喜乐';
    ctx.font = '600 66px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#fff3d6';
    const lines = KD.util.wrapText(ctx, txt, 900);
    let y = 1260;
    lines.forEach(l => { ctx.fillText(l, 540, y); y += 90; });

    // 日期
    ctx.font = '400 34px "PingFang SC",sans-serif';
    ctx.fillStyle = 'rgba(255,233,192,0.72)';
    ctx.fillText(new Date().toLocaleDateString('zh-CN'), 540, 1840);

    // 边框
    ctx.strokeStyle = 'rgba(255,210,140,0.4)';
    ctx.lineWidth = 3;
    KD.util.roundRect(ctx, 30, 30, 1020, 1860, 24); ctx.stroke();

    return ec;
  }

  function show() {
    const ec = build();
    const url = ec.toDataURL('image/png');
    document.getElementById('cardImg').src = url;
    document.getElementById('cardOv').classList.add('show');
    document.getElementById('saveBtn').onclick = () => {
      const a = document.createElement('a');
      a.href = url; a.download = '祈愿灯-许愿卡.png'; a.click();
    };
  }

  function hide() { document.getElementById('cardOv').classList.remove('show'); }

  KD.exportCard = { show, hide, build };
})();
