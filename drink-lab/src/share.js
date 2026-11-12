// 分享图：把 3D 场景渲染成 3:4（小红书竖图）的海报，加上品名和话题标签。
const THREE = window.THREE;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 按最大宽度折行
function wrap(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; }
    else line += ch;
  }
  if (line) out.push(line);
  return out;
}

export function makePoster({ renderer, scene, camera, spec, name, sub = '', tags = [] }) {
  const W = 1080, H = 1440;
  // 直接把主画布临时渲染成 3:4 的超采样尺寸再缩下来，
  // 颜色和屏幕上看到的完全一致（不经过 render target 的色彩空间转换）。
  const SW = Math.round(W * 1.5), SH = Math.round(H * 1.5);
  const oldPR = renderer.getPixelRatio();
  const oldSize = renderer.getSize(new THREE.Vector2());

  renderer.setPixelRatio(1);
  renderer.setSize(SW, SH, false);

  const cam = camera.clone();
  cam.aspect = W / H;
  cam.clearViewOffset();
  const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const y0 = -0.35, y1 = spec.H + 1.4;
  const halfW = (spec.kind === 1 ? spec.Rs : Math.max(spec.rt, spec.rb)) + 1.05;
  const dist = Math.max((y1 - y0) / 2 / (tan * 0.74), halfW / (tan * cam.aspect * 0.94));
  const ty = (y0 + y1) / 2;
  cam.position.set(0, ty + dist * 0.14, dist);
  cam.lookAt(0, ty, 0);
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(renderer.domElement, 0, 0, W, H);

  // 恢复实时画布，下一帧照常渲染
  renderer.setPixelRatio(oldPR);
  renderer.setSize(oldSize.x, oldSize.y, false);

  // 和页面一致的暖色分级 + 细颗粒，海报和实时画面才像同一套风格
  ctx.globalCompositeOperation = 'soft-light';
  const warm = ctx.createRadialGradient(W * 0.5, H * 0.3, W * 0.05, W * 0.5, H * 0.5, W * 0.9);
  warm.addColorStop(0, 'rgba(255,244,224,0.55)');
  warm.addColorStop(1, 'rgba(160,100,60,0.35)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  // 细颗粒
  const gr = document.createElement('canvas');
  gr.width = gr.height = 160;
  const gg = gr.getContext('2d');
  const img = gg.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 120 + Math.random() * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
    img.data[i + 3] = 26;
  }
  gg.putImageData(img, 0, 0);
  ctx.fillStyle = ctx.createPattern(gr, 'repeat');
  ctx.fillRect(0, 0, W, H);

  // 和页面一致的轻微暗角，主体更聚焦
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.42, W * 0.22, W * 0.5, H * 0.46, W * 0.92);
  vg.addColorStop(0, 'rgba(60,30,15,0)');
  vg.addColorStop(1, 'rgba(60,30,15,0.10)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // 底部柔和的奶油色渐变，压住画面下沿好放字
  const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
  g.addColorStop(0, 'rgba(250,238,226,0)');
  g.addColorStop(0.45, 'rgba(250,238,226,0.72)');
  g.addColorStop(1, 'rgba(250,238,226,0.97)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  // 顶部小小的品牌标
  ctx.fillStyle = 'rgba(90,54,32,0.5)';
  ctx.font = '600 26px -apple-system, "PingFang SC", "Helvetica Neue", sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('调饮实验室  DRINK LAB', 64, 72);
  ctx.fillRect(64, 96, 96, 3);

  // 品名
  const maxW = W - 128;
  let size = 84;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${size}px -apple-system, "PingFang SC", "Helvetica Neue", sans-serif`;
  let lines = wrap(ctx, name, maxW);
  while (lines.length > 2 && size > 52) {
    size -= 6;
    ctx.font = `800 ${size}px -apple-system, "PingFang SC", "Helvetica Neue", sans-serif`;
    lines = wrap(ctx, name, maxW);
  }
  const lh = size * 1.16;
  let y = H - 300 - (lines.length - 1) * lh;
  ctx.fillStyle = '#4a2a1a';
  ctx.shadowColor = 'rgba(255,248,240,0.8)';
  ctx.shadowBlur = 18;
  for (const l of lines) { ctx.fillText(l, 64, y); y += lh; }
  ctx.shadowBlur = 0;

  // 配方一行（太长就省略）
  if (sub) {
    ctx.font = '500 28px -apple-system, "PingFang SC", "Helvetica Neue", sans-serif';
    ctx.fillStyle = 'rgba(74,42,26,0.62)';
    let t = sub;
    while (t.length > 4 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    ctx.fillText(t === sub ? sub : t + '…', 64, y + 12);
  }

  // 话题标签：小圆角标签
  y = H - 112;
  ctx.font = '600 30px -apple-system, "PingFang SC", "Helvetica Neue", sans-serif';
  let x = 64;
  for (const t of tags.slice(0, 3)) {
    const tw = ctx.measureText(t).width + 40;
    if (x + tw > W - 64) break;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    roundRect(ctx, x, y - 40, tw, 58, 29); ctx.fill();
    ctx.fillStyle = '#7a4a2a';
    ctx.fillText(t, x + 20, y);
    x += tw + 14;
  }

  // 右下角一行小字
  ctx.fillStyle = 'rgba(90,54,32,0.45)';
  ctx.font = '500 24px -apple-system, "PingFang SC", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('自己调的一杯', W - 64, H - 46);
  ctx.textAlign = 'left';
  return c;
}
