// 祈愿灯 - 共享纹理/工具
(function () {
  const KD = window.KD || (window.KD = {});

  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // 圆形柔光（灯晕 / 粒子）
  function glowTex() {
    const c = makeCanvas(128, 128), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // 天空竖直渐变（高分辨率 + 抖动噪点，消除色带分层）
  function skyTex() {
    const W = 64, H = 1024, c = makeCanvas(W, H), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.0, '#050417');
    g.addColorStop(0.35, '#160f37');
    g.addColorStop(0.62, '#2e1a4a');
    g.addColorStop(0.82, '#5a2f43');
    g.addColorStop(1.0, '#c06a3c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 7000; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.010 + Math.random() * 0.018).toFixed(3) + ')';
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // 烟花火星：中心实亮的锐利光点（不是模糊大光斑）
  function sparkTex() {
    const c = makeCanvas(64, 64), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.14, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.62, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // 孔明灯纸面纹理（暖色渐变 + 竖向竹骨 + 上下收口）
  function lanternTex(color) {
    const c = makeCanvas(160, 256), ctx = c.getContext('2d');
    ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
    ctx.fillRect(0, 0, 160, 256);
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, 'rgba(255,246,220,0.5)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.0)');
    g.addColorStop(1.0, 'rgba(255,140,60,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 160, 256);
    // 纸纤维噪点
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '120,70,35,' : '255,220,170,') + (0.03 + Math.random() * 0.05).toFixed(3) + ')';
      ctx.fillRect(Math.random() * 160, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // 竖向竹骨
    ctx.strokeStyle = 'rgba(110,52,24,0.22)'; ctx.lineWidth = 2;
    for (let x = 8; x < 160; x += 13) { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, 252); ctx.stroke(); }
    // 上下收口
    ctx.strokeStyle = 'rgba(110,52,24,0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(160, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 244); ctx.lineTo(160, 244); ctx.stroke();
    const t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // 多層飛檐寶塔
  function drawPagoda(ctx, cx, baseY, s, tiers) {
    let w = s, y = baseY;
    for (let i = 0; i < tiers; i++) {
      ctx.fillStyle = '#0e0a22';
      ctx.fillRect(cx - w * 0.5, y - s * 0.95, w, s * 0.95);
      // 暖色窗
      ctx.fillStyle = 'rgba(255,200,120,0.85)';
      ctx.fillRect(cx - w * 0.13, y - s * 0.62, w * 0.07, s * 0.32);
      ctx.fillRect(cx + w * 0.06, y - s * 0.62, w * 0.07, s * 0.32);
      ctx.fillStyle = '#0e0a22';
      // 飞檐
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.85, y - s * 0.95);
      ctx.quadraticCurveTo(cx, y - s * 1.32, cx + w * 0.85, y - s * 0.95);
      ctx.quadraticCurveTo(cx, y - s * 1.12, cx - w * 0.85, y - s * 0.95);
      ctx.closePath(); ctx.fill();
      y -= s * 1.05; w *= 0.72;
    }
    // 塔刹
    ctx.beginPath();
    ctx.moveTo(cx - 2, y - s * 0.4); ctx.lineTo(cx + 2, y - s * 0.4);
    ctx.lineTo(cx, y - s * 0.85); ctx.closePath(); ctx.fill();
  }

  // 中式殿宇：屋身 + 起翘飞檐 + 檐下灯笼
  function drawHall(ctx, cx, baseY, w, h) {
    ctx.fillStyle = '#0d0922';
    ctx.fillRect(cx - w * 0.5, baseY - h, w, h);
    // 暖窗
    ctx.fillStyle = 'rgba(255,198,118,0.8)';
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(cx + i * w * 0.26 - w * 0.045, baseY - h * 0.72, w * 0.09, h * 0.3);
    }
    // 飞檐
    const ey = baseY - h;
    ctx.fillStyle = '#0b0720';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.78, ey);
    ctx.quadraticCurveTo(cx, ey - h * 0.52, cx + w * 0.78, ey);
    ctx.quadraticCurveTo(cx, ey - h * 0.2, cx - w * 0.78, ey);
    ctx.closePath(); ctx.fill();
    // 檐下红灯笼
    for (let i = -2; i <= 2; i++) {
      const lx = cx + i * w * 0.3, ly = ey + h * 0.14;
      const r = Math.max(2.5, w * 0.05);
      const gr = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 3);
      gr.addColorStop(0, 'rgba(255,150,110,0.95)');
      gr.addColorStop(1, 'rgba(255,110,70,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(lx, ly, r * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,170,130,0.95)';
      ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 远景：远山 + 城墙垛口 + 中式殿宇群 + 宝塔
  function farTex() {
    const W = 1400, H = 620, c = makeCanvas(W, H), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    // 远山
    ctx.fillStyle = '#100c24';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const y = H - 150 - 115 * Math.abs(Math.sin(x * 0.0038)) - 55 * Math.sin(x * 0.011);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    // 城墙 + 垛口
    const wallY = H - 78;
    ctx.fillStyle = '#0c0820';
    ctx.fillRect(0, wallY, W, 78);
    for (let x = 0; x < W; x += 30) ctx.fillRect(x, wallY - 15, 18, 15);
    // 殿宇群
    drawHall(ctx, W * 0.14, wallY, 150, 96);
    drawHall(ctx, W * 0.33, wallY, 196, 132);
    drawHall(ctx, W * 0.63, wallY, 178, 110);
    drawHall(ctx, W * 0.86, wallY, 146, 84);
    drawHall(ctx, W * 0.48, wallY - 4, 120, 66);
    // 宝塔
    drawPagoda(ctx, W * 0.5, wallY - 10, 104, 5);
    drawPagoda(ctx, W * 0.74, wallY - 4, 66, 4);
    drawPagoda(ctx, W * 0.06, wallY - 4, 58, 4);
    // 底部暖雾
    const hz = ctx.createLinearGradient(0, H - 150, 0, H);
    hz.addColorStop(0, 'rgba(20,12,40,0)'); hz.addColorStop(1, 'rgba(78,42,58,0.5)');
    ctx.fillStyle = hz; ctx.fillRect(0, H - 150, W, 150);
    // 底部整体淡出：避免城墙在贴图下缘形成一条硬边横带（看起来像遮罩）
    ctx.globalCompositeOperation = 'destination-out';
    const fade = ctx.createLinearGradient(0, H - 110, 0, H);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = fade; ctx.fillRect(0, H - 110, W, 110);
    ctx.globalCompositeOperation = 'source-over';
    const t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // 梦幻色雾：三档渐变，上下两端都淡到透明，避免平面出现硬边分层
  function hazeTex(top, mid, bottom) {
    const c = makeCanvas(8, 512), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, top);
    g.addColorStop(0.5, mid);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 512);
    const t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function drawPerson(ctx, x, baseY, h) {
    ctx.beginPath();
    ctx.moveTo(x - h * 0.18, baseY);
    ctx.quadraticCurveTo(x - h * 0.12, baseY - h * 0.55, x - h * 0.07, baseY - h * 0.72);
    ctx.lineTo(x - h * 0.05, baseY - h * 0.82);
    ctx.quadraticCurveTo(x, baseY - h * 0.96, x + h * 0.05, baseY - h * 0.82);
    ctx.lineTo(x + h * 0.07, baseY - h * 0.72);
    ctx.quadraticCurveTo(x + h * 0.12, baseY - h * 0.55, x + h * 0.18, baseY);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, baseY - h * 0.86, h * 0.11, h * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 近景人群（举灯，姿态随机）
  function nearTex() {
    const W = 1200, H = 300, c = makeCanvas(W, H), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#040308';
    let x = -20;
    while (x < W + 20) {
      const h = 110 + rand(0, 80);
      drawPerson(ctx, x, H, h);
      if (Math.random() < 0.5) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const ax = x + side * h * 0.17, ay = H - h * 0.8;
        ctx.strokeStyle = '#040308'; ctx.lineWidth = h * 0.05;
        ctx.beginPath(); ctx.moveTo(x, H - h * 0.6); ctx.lineTo(ax, ay); ctx.stroke();
        const r = h * 0.08;
        const grd = ctx.createRadialGradient(ax, ay, 0, ax, ay, r * 3.2);
        grd.addColorStop(0, 'rgba(255,205,125,0.95)');
        grd.addColorStop(1, 'rgba(255,160,80,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(ax, ay, r * 3.2, 0, Math.PI * 2); ctx.fill();
      }
      x += 24 + rand(0, 22);
    }
    const t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxW) {
    const lines = []; let line = '';
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = ch; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  // 祝福语标签
  function textTex(text, opts) {
    opts = opts || {};
    const fontSize = opts.fontSize || 46;
    const maxW = opts.maxWidth || 520;
    const font = fontSize + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    const c0 = makeCanvas(8, 8), x0 = c0.getContext('2d'); x0.font = font;
    const lines = wrapText(x0, text, maxW);
    const lineH = fontSize * 1.32, padX = 28, padY = 22;
    const w = maxW + padX * 2, h = lines.length * lineH + padY * 2;
    const c = makeCanvas(w, h), ctx = c.getContext('2d'); ctx.font = font;
    ctx.fillStyle = opts.bg || 'rgba(18,10,28,0.5)';
    roundRect(ctx, 0, 0, w, h, 18); ctx.fill();
    ctx.strokeStyle = opts.border || 'rgba(255,210,140,0.5)';
    ctx.lineWidth = 2; roundRect(ctx, 1, 1, w - 2, h - 2, 17); ctx.stroke();
    ctx.fillStyle = opts.color || '#fff3d6';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => ctx.fillText(ln, w / 2, padY + lineH * (i + 0.5)));
    const t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, aspect: w / h };
  }

  // 竖排祝福语：无背景框，只有字（从上到下、从右到左，深色描边保证夜空可读）
  function wishTextTex(text, opts) {
    opts = opts || {};
    const fontSize = opts.fontSize || 46;
    const maxRows = opts.maxRows || 8;
    const chars = Array.from(text || '');
    const cols = Math.max(1, Math.ceil(chars.length / maxRows));
    const rows = Math.max(1, Math.ceil(chars.length / cols));
    const font = fontSize + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    const charW = fontSize, charH = Math.ceil(fontSize * 1.14);
    const padX = 12, padY = 12;
    const w = Math.ceil(cols * charW + padX * 2);
    const h = Math.ceil(rows * charH + padY * 2);
    const c = makeCanvas(w, h), ctx = c.getContext('2d');
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const pos = i => {
      const col = Math.floor(i / rows), row = i % rows;
      return [w - padX - (col + 0.5) * charW, padY + (row + 0.5) * charH];
    };
    ctx.strokeStyle = 'rgba(26,12,6,0.6)'; ctx.lineWidth = 7;
    chars.forEach((ch, i) => { const p = pos(i); ctx.strokeText(ch, p[0], p[1]); });
    ctx.shadowColor = 'rgba(255,190,110,0.95)'; ctx.shadowBlur = 18;
    ctx.fillStyle = opts.color || '#ffe7bd';
    chars.forEach((ch, i) => { const p = pos(i); ctx.fillText(ch, p[0], p[1]); });
    const t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, aspect: w / h, rows: rows, cols: cols, rowRatio: charH };
  }

  KD.util = { glowTex, sparkTex, skyTex, lanternTex, farTex, nearTex, hazeTex, textTex, wishTextTex, roundRect, wrapText, rand };
})();
