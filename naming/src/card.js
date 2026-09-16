/* 分享卡片：canvas 竖版 3:4（900×1200），直接长按保存发小红书 */
(function () {
  var NM = (window.NM = window.NM || {});
  var W = 900, H = 1200;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function pinyinOf(chars) {
    return chars.map(function (c) {
      var it = NM.getChar(c);
      return it ? it.py : '';
    }).filter(Boolean).join(' ');
  }

  var TONE_MARK = {
    a: ['ā', 'á', 'ǎ', 'à'], o: ['ō', 'ó', 'ǒ', 'ò'], e: ['ē', 'é', 'ě', 'è'],
    i: ['ī', 'í', 'ǐ', 'ì'], u: ['ū', 'ú', 'ǔ', 'ù'], v: ['ǖ', 'ǘ', 'ǚ', 'ǜ']
  };
  function toned(py, tone) {
    if (!tone) return py;
    var idx = -1, ch = '';
    if (py.indexOf('a') !== -1) { idx = py.indexOf('a'); ch = 'a'; }
    else if (py.indexOf('o') !== -1) { idx = py.indexOf('o'); ch = 'o'; }
    else if (py.indexOf('e') !== -1) { idx = py.indexOf('e'); ch = 'e'; }
    else if (py.indexOf('iu') !== -1) { idx = py.indexOf('u'); ch = 'u'; }
    else {
      for (var i = 0; i < py.length; i++) {
        if ('iu v'.indexOf(py[i]) !== -1 && 'aoe'.indexOf(py[i]) === -1) { idx = i; ch = py[i]; }
      }
    }
    if (idx < 0) return py;
    var marks = TONE_MARK[ch === 'v' ? 'v' : ch];
    if (!marks) return py;
    return py.slice(0, idx) + marks[tone - 1] + py.slice(idx + 1);
  }

  NM.namePinyin = function (surname, chars) {
    var out = [];
    /* 复姓有两个音节，「欧阳」要出 ou yang 而不是 ou */
    var syls = NM.surSyls ? NM.surSyls(surname) : (surname ? [{ py: surname.py, tone: surname.tone }] : []);
    for (var s = 0; s < syls.length; s++) {
      if (syls[s] && syls[s].py) out.push(toned(syls[s].py, syls[s].tone));
    }
    for (var i = 0; i < chars.length; i++) {
      var it = NM.getChar(chars[i]);
      if (it) out.push(toned(it.py, it.tone));
    }
    return out.join(' ');
  };

  /* 印记：和界面里的 .seal 是同一个语言，卡片上要能对得上 */
  function drawSeal(ctx, x, y, size, ch, outline) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-4 * Math.PI / 180);
    var r = size * 0.5;   /* 圆形印记，和界面里的 .seal 一致 */
    if (outline) {
      ctx.strokeStyle = 'rgba(242,109,141,0.9)';
      ctx.lineWidth = 4;
      rr(ctx, -size / 2, -size / 2, size, size, r);
      ctx.stroke();
      ctx.fillStyle = 'rgba(242,109,141,0.92)';
    } else {
      ctx.fillStyle = 'rgba(242,109,141,0.93)';
      rr(ctx, -size / 2, -size / 2, size, size, r);
      ctx.fill();
      ctx.fillStyle = '#fff';
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 ' + Math.round(size * 0.56) + 'px ' + SANS;
    ctx.fillText(ch, 0, size * 0.04);
    ctx.restore();
  }

  function drawRadar(ctx, cx, cy, r, items) {
    var n = items.length;
    /* 网 */
    for (var ring = 1; ring <= 3; ring++) {
      ctx.beginPath();
      for (var i = 0; i <= n; i++) {
        var a = -Math.PI / 2 + (i % n) * (Math.PI * 2 / n);
        var rr2 = r * ring / 3;
        var x = cx + Math.cos(a) * rr2, y = cy + Math.sin(a) * rr2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(120,110,95,' + (ring === 3 ? 0.34 : 0.16) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    /* 轴 */
    for (var k = 0; k < n; k++) {
      var ang = -Math.PI / 2 + k * (Math.PI * 2 / n);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      ctx.strokeStyle = 'rgba(74,59,54,0.10)';
      ctx.stroke();
    }
    /* 名字多边形 */
    ctx.beginPath();
    items.forEach(function (it, i) {
      var ang = -Math.PI / 2 + i * (Math.PI * 2 / n);
      var v = r * (it.name / 100);
      var x = cx + Math.cos(ang) * v, y = cy + Math.sin(ang) * v;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(242,109,141,0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,109,141,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    /* 你的多边形（虚线） */
    ctx.beginPath();
    items.forEach(function (it, i) {
      var ang = -Math.PI / 2 + i * (Math.PI * 2 / n);
      var v = r * (it.mine / 100);
      var x = cx + Math.cos(ang) * v, y = cy + Math.sin(ang) * v;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(74,59,54,0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.setLineDash([]);
    /* 标签 */
    ctx.font = '500 22px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = '#b09a92';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    items.forEach(function (it, i) {
      var ang = -Math.PI / 2 + i * (Math.PI * 2 / n);
      var x = cx + Math.cos(ang) * (r + 34), y = cy + Math.sin(ang) * (r + 26);
      ctx.fillText(it.label, x, y);
    });
  }

  /**
   * @param canvas 目标 canvas
   * @param data { surname, chars, given, full, desc, radar, note, mode, enName }
   */
  /* 卡片底部纵向分区（900×1200）。上半段（名字 + 拼音 + 一句话）压紧一点，
   * 省下来的高度全给内容区和雷达图 —— 之前 530~622、827~874 两段都是空白，
   * 而字义说明和雷达反而挤着画。现在：
   *   584 ─ 829  内容区（字义拆解 / 英文信息行）
   *   850 ─ 1082 雷达图（含轴标签）
   *   1100       图例说明
   *   1148       页脚
   * CONTENT_BOTTOM 不能直接取雷达圆的上沿：轴标签画在圆外 r+26 处
   * （middle 基线，22px 字），上沿在 850。 */
  var CONTENT_TOP = 608;
  var RADAR_CY = 1000, RADAR_R = 92;
  var RADAR_LABEL_TOP = RADAR_CY - (RADAR_R + 26) - 11;   /* 871 */
  var CONTENT_BOTTOM = RADAR_LABEL_TOP - 10;              /* 861 */
  var LEGEND_Y = 1150;
  var FOOT_Y = 1190;
  var SANS = '-apple-system, "PingFang SC", sans-serif';
  var SERIF = SANS;   /* 名字也用系统字，和界面同一套字面 */

  /* 雷达图 + 图例，中英卡共用。
   * 画的是完整那张性格画像：七个轴全上（温度/社交/决策/节奏 + 时代/繁简/表达），
   * 和「我的」里那张雷达同一份数据，只是这里额外叠了名字的实线。
   * 没有性格数据（比如工作台上手拼的名字）就整块不画，不留一条孤零零的图例。 */
  function drawRadarBlock(ctx, data) {
    var items = data.radar || [];
    if (!items.length) return;
    drawRadar(ctx, W / 2, RADAR_CY, RADAR_R, items);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '400 20px ' + SANS;
    ctx.fillStyle = '#b09a92';
    ctx.fillText('实线 = 名字的气质 · 虚线 = 你的性格', W / 2, LEGEND_Y);
  }

  /**
   * @param canvas 目标 canvas
   * @param data { surname, chars, given, full, desc, radar, note, mode, enName, names }
   */
  NM.renderCard = function (canvas, data) {
    var ctx = canvas.getContext('2d');
    var dpr = 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    ctx.scale(dpr, dpr);

    /* 背景：纯白。Apple 的体系里没有渐变和纹理，卡片的边界交给发丝线 */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    /* 细边框 */
    ctx.strokeStyle = '#f6e3d9';
    ctx.lineWidth = 1;
    rr(ctx, 34, 34, W - 68, H - 68, 24);
    ctx.stroke();

    /* 顶部标识 */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '500 24px ' + SANS;
    ctx.fillStyle = '#b09a92';
    var label;
    if (data.mode === 'en') label = '由性格取的英文名';
    else if (data.bazi && data.answered) label = '性格 · 生辰取名';
    else if (data.bazi) label = '由生辰取的中文名';
    else label = '由性格取的中文名';
    ctx.fillText(label.split('').join(' '), W / 2, 118);

    if (data.mode === 'en') {
      renderEn(ctx, data);
    } else {
      renderZh(ctx, data);
    }

    /* 页脚 */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '500 22px ' + SANS;
    ctx.fillStyle = '#b09a92';
    ctx.fillText('仙鹿起名 · 名字实验室', W / 2, FOOT_Y);
  };

  function renderZh(ctx, data) {
    /* 大字名字。四个字（奥利维亚这类音译名）要用小一号，否则超出画布 */
    var full = data.full || (data.surname.c + (data.given || ''));
    var size = full.length >= 4 ? 124 : full.length === 3 ? 156 : 196;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 ' + size + 'px ' + SERIF;
    ctx.fillStyle = '#4a3b36';
    ctx.fillText(full, W / 2, 300);

    /* 姓氏印记，压在名字右上 */
    drawSeal(ctx, W - 148, 248, 104, data.surname.c);

    /* 拼音 */
    ctx.font = '400 31px ' + SANS;
    ctx.fillStyle = '#a08a83';
    ctx.fillText(NM.namePinyin(data.surname, data.chars), W / 2, 372);

    /* 分隔 */
    ctx.beginPath();
    ctx.moveTo(W / 2 - 60, 406);
    ctx.lineTo(W / 2 + 60, 406);
    ctx.strokeStyle = 'rgba(242,109,141,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* 一句话人格 / 生辰摘要（引文样式，居中舒展，上方一枚浅色装饰引号） */
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '600 48px ' + SANS; ctx.fillStyle = 'rgba(242,109,141,0.20)';
    ctx.fillText('“', W / 2, 438);
    ctx.font = '400 32px ' + SANS; ctx.fillStyle = '#6b5852';
    wrapText(ctx, data.desc || '', W / 2, 466, W - 180, 46, 2);

    /* 有生辰时在一句话下面补四柱 + 宜补，字义区略下移 */
    var contentTop = CONTENT_TOP;
    if (data.bazi) {
      ctx.font = '500 27px ' + SANS;
      ctx.fillStyle = '#e8557b';
      ctx.fillText(data.bazi.pillarStr || '', W / 2, 578);
      ctx.font = '400 23px ' + SANS;
      ctx.fillStyle = '#a08a83';
      var bzLine = data.baziNote || data.bazi.short || '';
      if (bzLine) ctx.fillText(bzLine, W / 2, 612);
      contentTop = 640;
    }

    /* 字义拆解：每个字做成一枚「字卡」——左边圆角浅粉底放大字、右边拼音 + 释义，
     * 两列清楚分开，不再把字 / 拼音 / 释义水平挤在一行。整块在内容区里垂直居中。 */
    if (!data.bazi) {
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = '600 26px ' + SANS; ctx.fillStyle = '#f26d8d';
      ctx.fillText('字义拆解', 108, contentTop - 24);
    }
    var chars = (data.chars || []).filter(function (c) { return NM.getChar(c); });
    var n = Math.max(1, chars.length);
    var range = CONTENT_BOTTOM - contentTop;
    var step = Math.min(160, Math.floor(range / n));
    var fs = Math.max(22, Math.min(64, Math.round(step * 0.60)));
    var size = Math.round(fs * 1.15);                 /* 字块边长 */
    var pyFs = Math.max(12, Math.round(fs * 0.32));
    var mFs = Math.max(15, Math.round(fs * 0.40));
    var noteLines = n >= 3 ? 1 : 2;                   /* 三个字以上释义只留一行，避免撞行 */
    var noteLh = Math.round(mFs * 1.35);
    var colH = pyFs + noteLh * noteLines;             /* 右列（拼音 + 释义）占高 */
    var rowH = Math.max(size, colH) + 12;             /* 一行实际占高 */
    var y0 = contentTop + Math.max(0, Math.round((range - rowH * n) / 2)) + Math.round(rowH / 2);
    var bx = 108, tx = bx + size + 30;                /* 字块左 / 拼音·释义左 */
    chars.forEach(function (c) {
      var cy = y0;                                    /* 本行基准（字块垂直居中） */
      var bt = cy - size / 2;                         /* 字块顶边 */
      ctx.fillStyle = 'rgba(242,109,141,0.10)';
      rr(ctx, bx, bt, size, size, 18); ctx.fill();
      ctx.strokeStyle = 'rgba(242,109,141,0.28)'; ctx.lineWidth = 2;
      rr(ctx, bx, bt, size, size, 18); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 ' + fs + 'px ' + SERIF; ctx.fillStyle = '#4a3b36';
      ctx.fillText(c, bx + size / 2, bt + size / 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = '400 ' + pyFs + 'px ' + SANS; ctx.fillStyle = 'rgba(242,109,141,0.9)';
      ctx.fillText(NM.namePinyin(null, [c]), tx, cy - fs * 0.20);
      ctx.font = '400 ' + mFs + 'px ' + SANS; ctx.fillStyle = '#6b5852';
      wrapText(ctx, NM.charNote(c).text, tx, cy + fs * 0.30, W - tx - 64, noteLh, noteLines);
      y0 += rowH;
    });

    drawRadarBlock(ctx, data);
  }

  function renderEn(ctx, data) {
    var it = data.enName;
    if (!it) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    var nameSize = it.n.length > 9 ? 92 : it.n.length > 7 ? 106 : 118;
    ctx.font = '600 ' + nameSize + 'px ' + SANS;
    ctx.fillStyle = '#4a3b36';
    ctx.fillText(it.n, W / 2, 296);

    drawSeal(ctx, W - 148, 246, 100, '名');

    ctx.font = '400 30px ' + SANS;
    ctx.fillStyle = '#a08a83';
    ctx.fillText(it.ph + '  ·  ' + it.zh, W / 2, 368);

    ctx.beginPath();
    ctx.moveTo(W / 2 - 60, 402);
    ctx.lineTo(W / 2 + 60, 402);
    ctx.strokeStyle = 'rgba(242,109,141,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '400 30px ' + SANS;
    ctx.fillStyle = '#6b5852';
    /* 一句话（引文样式，与中文卡一致） */
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '600 48px ' + SANS; ctx.fillStyle = 'rgba(242,109,141,0.20)';
    ctx.fillText('“', W / 2, 438);
    ctx.font = '400 32px ' + SANS; ctx.fillStyle = '#6b5852';
    wrapText(ctx, it.m || '', W / 2, 466, W - 180, 46, 2);

    /* 信息行：4 行平分内容区，每行锁一行，
     * 否则「来源」这种偏长的说明折成两行就会撞上雷达图。 */
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '600 26px ' + SANS; ctx.fillStyle = '#f26d8d';
    ctx.fillText('名字档案', 108, CONTENT_TOP - 24);

    var rows = [
      ['来源', it.org],
      ['年代感', { ancient: '古典 / 神话', vintage: '老派（祖母辈）', mid: '战后主流', modern: '90 后', now: '当下正红' }[it.era]],
      ['昵称', it.nick && it.nick.length ? it.nick.join(' / ') : '—'],
      ['适用', it.st.cla > 0.6 ? '正式场合、学术、职场' : it.st.exp > 0.4 ? '朋友间、日常、社交' : '通用']
    ];
    var step = Math.min(84, Math.floor((CONTENT_BOTTOM - CONTENT_TOP) / rows.length));
    var y = CONTENT_TOP + Math.round(step * 0.52);
    rows.forEach(function (r) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '500 24px ' + SANS;
      ctx.fillStyle = 'rgba(242,109,141,0.85)';
      ctx.fillText(r[0], 108, y);
      ctx.font = '400 27px ' + SANS;
      ctx.fillStyle = '#6b5852';
      wrapText(ctx, r[1], 232, y, W - 350, 34, 1);
      y += step;
    });

    drawRadarBlock(ctx, data);
  }

  function wrapText(ctx, text, cx, y, maxW, lh, maxLines) {
    if (!text) return y;
    var lines = [], cur = '';
    for (var i = 0; i < text.length; i++) {
      var t = cur + text[i];
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = text[i]; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, '') + '…';
    }
    var start = y;
    lines.forEach(function (ln, i) {
      ctx.fillText(ln, cx, start + i * lh);
    });
    return start + lines.length * lh;
  }

  NM.cardToDataURL = function (canvas) {
    return canvas.toDataURL('image/jpeg', 0.92);
  };
})();
