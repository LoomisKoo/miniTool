/**
 * 卡造 · 模板库
 * 六个玩法：人设 / 搭子 / 追星 / 毛孩子 / 证件 / 周边
 */
(function (global) {
  var PXMM = 8;

  var CATS = [
    { id: 'card', name: '名片', hint: '宠物 · 社交 · 游戏 · 开发者' },
    { id: 'online', name: '主页', hint: '代码 · 社交 · NFC' },
    { id: 'persona', name: '人设', hint: '自嘲 · 玄学 · 状态' },
    { id: 'social', name: '搭子', hint: '组队 · 交友 · 宿舍' },
    { id: 'love', name: '恋爱', hint: '契约 · 天数 · 异地' },
    { id: 'fan', name: '追星', hint: '小卡 · 应援 · 出道' },
    { id: 'pet', name: '毛孩子', hint: '宠物 · 铲屎官 · 幼崽' },
    { id: 'id', name: '证件', hint: '工牌 · 学生证' },
    { id: 'fantasy', name: '异世界', hint: '魔法 · 英雄 · 特工 · 星际' },
    { id: 'merch', name: '周边', hint: '贴纸 · 行李 · 谷子' }
  ];
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function v(d, k) { return esc(d[k] || ''); }
  function has(d, k) { return !!(d[k] && String(d[k]).trim()); }

  function photo(d, cls, fallback) {
    if (d.__photo) return '<div class="ph ' + cls + '"><img src="' + d.__photo + '" alt=""></div>';
    return '<div class="ph ' + cls + ' is-empty"><span class="ph-fill">' + esc(fallback || d.__initial || '') + '</span></div>';
  }
  function qr(d, cls) {
    if (!d.__qr) return '';
    return '<img class="qr ' + cls + '" src="' + d.__qr + '" alt="">';
  }
  function tags(d, key, cls) {
    var arr = String(d[key] || '').split(/[,\/|，、]/).filter(function (x) { return x.trim(); });
    return arr.map(function (t) { return '<span class="' + cls + '">' + esc(t.trim()) + '</span>'; }).join('');
  }

  var PAW =
    '<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="22" rx="7" ry="5.6"/>' +
    '<ellipse cx="7.6" cy="15.2" rx="3.1" ry="4.2" transform="rotate(-18 7.6 15.2)"/>' +
    '<ellipse cx="13" cy="9.4" rx="3.1" ry="4.4"/>' +
    '<ellipse cx="20" cy="9.4" rx="3.1" ry="4.4"/>' +
    '<ellipse cx="24.8" cy="15.2" rx="3.1" ry="4.2" transform="rotate(18 24.8 15.2)"/></svg>';

  var STEM =
    '<svg viewBox="0 0 120 60" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round">' +
    '<path d="M8 54C30 54 48 40 60 12"/>' +
    '<path d="M60 12C66 24 78 34 92 38"/>' +
    '<path d="M60 12C56 26 48 38 36 46"/>' +
    '<path d="M38 30c-8-3-13-9-14-16 8 0 14 4 17 11"/>' +
    '<path d="M48 22c8-2 14-7 17-14-8-1-15 3-19 10"/>' +
    '<path d="M70 26c8 1 16-1 21-6-6-5-13-5-19-1"/>' +
    '</g></svg>';

  // ============================================================
  // 身份
  // ============================================================

  var T_ID_LANYARD = {
    id: 'id-lanyard', cat: 'id', name: '挂绳工牌', desc: '竖版 · 挂绳孔 · 双面',
    w: 54, h: 86, shape: 'rect', radius: 3,
    fields: ['name', 'role', 'org', 'id', 'validity', 'photo', 'logo', 'qr'],
    demo: { name: '林知远', role: '什么都干一点', org: 'LUMEN CLUB', id: 'NO.0823', validity: '长期有效' },
    front: function (d) {
      return (
        '<div class="card t-lanyard">' +
        '<div class="ly-glow"></div><div class="ly-slot"></div>' +
        '<div class="ly-head"><span class="ly-org">' +
        (d.__logo ? '<img class="ly-logo" src="' + d.__logo + '" alt="">' : '') + v(d, 'org') +
        '</span><span class="ly-tag lbl">STAFF</span></div>' +
        '<div class="ly-photo">' + photo(d, 'ly-ph', d.name.slice(0, 1)) + '</div>' +
        '<div class="ly-name">' + v(d, 'name') + '</div>' +
        '<div class="ly-role">' + v(d, 'role') + '</div>' +
        '<div class="ly-id mono">' + v(d, 'id') + '</div>' +
        '<div class="ly-rule"></div>' +
        '<div class="ly-foot">' + qr(d, 'ly-qr') +
        '<div class="ly-foot-txt"><span class="lbl">ACCESS</span><b>' + v(d, 'validity') + '</b></div>' +
        '<div class="ly-bars"></div></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-lanyard t-back-back">' +
        '<div class="ly-glow"></div><div class="ly-slot"></div>' +
        '<div class="bk-head"><span class="lbl">PROPERTY OF</span><b>' + v(d, 'org') + '</b></div>' +
        '<div class="ly-bk-rule"></div>' +
        '<div class="ly-bk-text">此证件仅限本人使用，如有拾获请交回前台。</div>' +
        '<div class="ly-bk-rows mono"><span>' + v(d, 'id') + '</span><span>EMERGENCY 021-0000 0000</span></div>' +
        '<div class="ly-bk-qr">' + qr(d, '') + '</div>' +
        '<div class="ly-bk-foot">' + v(d, 'name') + ' · ' + v(d, 'org') + '</div></div>'
      );
    }
  };

  var T_ID_STUDENT = {
    id: 'id-student', cat: 'id', name: '学生证', desc: '横版 · 校徽 · 防伪纹',
    w: 85.6, h: 54, shape: 'rect', radius: 2.6,
    fields: ['name', 'role', 'org', 'id', 'validity', 'photo', 'logo', 'qr'],
    demo: { name: '林知远', role: '视觉传达设计 · 2024 级', org: '麓鸣艺术学院', id: '20240318', validity: '2030.06' },
    front: function (d) {
      return (
        '<div class="card t-student">' +
        '<div class="sd-guilloche"></div><div class="sd-holo"></div>' +
        '<div class="sd-crest">' + (d.__logo ? '<img class="sd-logo" src="' + d.__logo + '" alt="">' : '<span>L</span><small>ARTS</small>') + '</div>' +
        '<div class="sd-head"><b>' + v(d, 'org') + '</b><span class="lbl">STUDENT ID</span></div>' +
        '<div class="sd-photo">' + photo(d, 'sd-ph', d.name.slice(0, 1)) + '</div>' +
        '<div class="sd-info"><div class="sd-name">' + v(d, 'name') + '</div>' +
        '<div class="sd-role">' + v(d, 'role') + '</div>' +
        '<div class="sd-meta mono"><span>NO ' + v(d, 'id') + '</span><span>VALID ' + v(d, 'validity') + '</span></div></div>' +
        '<div class="sd-qr">' + qr(d, '') + '</div>' +
        '<div class="sd-foot"><span>CAMPUS CARD</span><span>仅限本人使用 · 不得转借</span></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-student t-student-back">' +
        '<div class="sd-guilloche"></div><div class="sd-bk-mag"></div>' +
        '<div class="sd-bk-body"><div class="sd-bk-title lbl">CAMPUS LIBRARY · 借阅凭证</div>' +
        '<div class="sd-bk-name">' + v(d, 'name') + '<span class="mono">' + v(d, 'id') + '</span></div>' +
        '<div class="sd-bk-line"></div>' +
        '<div class="sd-bk-foot"><span>' + v(d, 'org') + '</span><span>LOST &amp; FOUND · 021-0000 0000</span></div></div>' +
        '<div class="sd-bk-qr">' + qr(d, '') + '</div></div>'
      );
    }
  };


  // ============================================================
  // 异世界（原创世界观，不使用任何真实 IP）
  // ============================================================

  var T_MAGIC_OFFER = {
    id: 'magic-offer', cat: 'fantasy', name: '魔法学院录取通知', desc: '竖版 · 羊皮纸 · 火漆印 · 猫头鹰送信',
    w: 54, h: 86, shape: 'rect', radius: 2,
    fields: ['name', 'academy', 'house', 'date', 'note'],
    demo: { name: '林知远', academy: 'LUMEN 魔法学院', house: '星语学院', date: '2026.09.01', note: '请携带魔杖、猫头鹰，以及一点好奇心。' },
    front: function (d) {
      return (
        '<div class="card t-moffer"><div class="mo-paper"></div><div class="mo-edge"></div>' +
        '<div class="mo-top"><span class="lbl">LUMEN ACADEMY</span><span class="mono">EST. 1692</span></div>' +
        '<div class="mo-crest">✦</div>' +
        '<div class="mo-title">录取通知书</div>' +
        '<div class="mo-rule"></div>' +
        '<div class="mo-body">兹录取 <b>' + v(d, 'name') + '</b> 为<br><em>' + v(d, 'academy') + '</em> 一年级新生，<br>分配至 <b>' + v(d, 'house') + '</b>。</div>' +
        '<div class="mo-rows">' +
        '<div><span class="lbl">开学</span><b class="mono">' + v(d, 'date') + '</b></div>' +
        '<div><span class="lbl">报到</span><b>午夜车站 · 13 号站台</b></div></div>' +
        '<div class="mo-seal">魔法<br>学院</div>' +
        '<div class="mo-foot">' + v(d, 'note') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-moffer t-moffer-back"><div class="mo-paper"></div><div class="mo-edge"></div>' +
        '<div class="mo-bk-title">新生须知</div>' +
        '<div class="mo-bk-list">' +
        '<p><b>01</b> 通知书上的火漆印不可撕毁。</p>' +
        '<p><b>02</b> 午夜后请勿独自前往钟楼。</p>' +
        '<p><b>03</b> 若见走廊尽头有人招手，请先确认它有影子。</p></div>' +
        '<div class="mo-bk-sign">' + v(d, 'name') + ' · ' + v(d, 'house') + '</div>' +
        '<div class="mo-bk-mark mono">' + v(d, 'academy') + '</div></div>'
      );
    }
  };

  var T_MAGIC_ID = {
    id: 'magic-id', cat: 'fantasy', name: '魔法学院学生证', desc: '横版 · 学院徽章 · 选课记录',
    w: 85.6, h: 54, shape: 'rect', radius: 2.6,
    fields: ['name', 'academy', 'house', 'course', 'id', 'photo'],
    demo: { name: '林知远', academy: 'LUMEN 魔法学院', house: '星语学院', course: '变形术 · 星象占卜 · 魔药基础', id: 'M-0823' },
    front: function (d) {
      return (
        '<div class="card t-magicide"><div class="mi-runen"></div><div class="mi-stars"></div>' +
        '<div class="mi-crest">✦</div>' +
        '<div class="mi-head"><b>' + v(d, 'academy') + '</b><span class="lbl">STUDENT WIZARD ID</span></div>' +
        '<div class="mi-photo">' + photo(d, 'mi-ph', String(d.name || '魔').slice(0, 1)) + '</div>' +
        '<div class="mi-info">' +
        '<div class="mi-name">' + v(d, 'name') + '</div>' +
        '<div class="mi-house">' + v(d, 'house') + '</div>' +
        '<div class="mi-course"><span class="lbl">主修</span>' + v(d, 'course') + '</div></div>' +
        '<div class="mi-meta mono"><span>NO ' + v(d, 'id') + '</span><span>VALID ∞</span></div>' +
        '<div class="mi-foot"><span>本证仅限校内魔法场域使用</span><span class="mi-sig">✦</span></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-magicide t-magicide-back"><div class="mi-runen"></div>' +
        '<div class="mi-bk-title">选课记录</div>' +
        '<div class="mi-bk-rows">' +
        '<div><span>周一</span><b>魔咒学 · 三教室</b></div>' +
        '<div><span>周三</span><b>飞行课 · 北塔草坡</b></div>' +
        '<div><span>周五</span><b>星象占卜 · 天文台（凌晨）</b></div></div>' +
        '<div class="mi-bk-note">' + v(d, 'course') + '</div>' +
        '<div class="mi-bk-sign">' + v(d, 'name') + ' · ' + v(d, 'house') + '</div></div>'
      );
    }
  };

  var T_HERO_CARD = {
    id: 'hero-register', cat: 'fantasy', name: '英雄注册卡', desc: '横版 · 能量条 · 弱点自曝',
    w: 85.6, h: 54, shape: 'rect', radius: 3,
    fields: ['codename', 'name', 'power', 'level', 'weakness', 'id'],
    demo: { codename: '夜航者', name: '林知远', power: '城市上空短距飞行 / 夜视', level: 'A-07', weakness: '非常怕冷，冬天战斗力减半', id: 'H-0823' },
    front: function (d) {
      return (
        '<div class="card t-herocard"><div class="hc-halftone"></div><div class="hc-beam"></div>' +
        '<div class="hc-top"><span class="lbl">HERO REGISTRY</span><span class="mono">' + v(d, 'id') + '</span></div>' +
        '<div class="hc-code">' + v(d, 'codename') + '</div>' +
        '<div class="hc-name">真名 · ' + v(d, 'name') + '</div>' +
        '<div class="hc-power"><span class="lbl">能力</span>' + v(d, 'power') + '</div>' +
        '<div class="hc-meter"><i></i><i></i><i></i><i></i><i class="off"></i></div>' +
        '<div class="hc-level"><span class="lbl">等级</span><b class="mono">' + v(d, 'level') + '</b></div>' +
        '<div class="hc-weak">弱点：' + v(d, 'weakness') + '</div>' +
        '<div class="hc-stamp">已登记</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-herocard t-herocard-back"><div class="hc-halftone"></div>' +
        '<div class="hc-bk-title">出勤记录</div>' +
        '<div class="hc-bk-rows">' +
        '<div><span>本月</span><b>救下 3 只卡在树上的猫</b></div>' +
        '<div><span>战绩</span><b>阻止一次便利店抢劫（未成功）</b></div>' +
        '<div><span>投诉</span><b>飞行时风太大，吹乱了路人的头发</b></div></div>' +
        '<div class="hc-bk-sign">' + v(d, 'codename') + ' · ' + v(d, 'level') + '</div>' +
        '<div class="hc-stamp">待复训</div></div>'
      );
    }
  };

  var T_PARALLEL = {
    id: 'parallel-pass', cat: 'fantasy', name: '平行宇宙通行证', desc: '竖版 · 护照式 · 机读码',
    w: 54, h: 86, shape: 'rect', radius: 3,
    fields: ['name', 'origin', 'destination', 'date', 'id', 'photo'],
    demo: { name: '林知远', origin: '地球 · 2026', destination: '宇宙 B-07 · 无冬城', date: '2026.10.19', id: 'U-0823' },
    front: function (d) {
      return (
        '<div class="card t-parallel"><div class="pp-guilloche"></div><div class="pp-glow"></div>' +
        '<div class="pp-top"><span class="lbl">INTERDIMENSIONAL PASS</span><span class="pp-star">✦</span></div>' +
        '<div class="pp-title">通行证</div>' +
        '<div class="pp-photo">' + photo(d, 'pp-ph', String(d.name || '旅').slice(0, 1)) + '</div>' +
        '<div class="pp-name">' + v(d, 'name') + '</div>' +
        '<div class="pp-rows">' +
        '<div><span class="lbl">来自</span><b>' + v(d, 'origin') + '</b></div>' +
        '<div><span class="lbl">前往</span><b>' + v(d, 'destination') + '</b></div>' +
        '<div><span class="lbl">签发</span><b class="mono">' + v(d, 'date') + '</b></div></div>' +
        '<div class="pp-mrz mono">P&lt;' + String(d.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '') + '&lt;&lt;' + '</div>' +
        '<div class="pp-foot">仅限单次穿越 · 请勿携带本宇宙的猫</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-parallel t-parallel-back"><div class="pp-guilloche"></div>' +
        '<div class="pp-bk-kicker">穿越协议</div>' +
        '<div class="pp-bk-list">' +
        '<p><b>01</b> 落地后 24 小时内不得透露原宇宙信息。</p>' +
        '<p><b>02</b> 若遇到另一个自己，请立刻离开。</p>' +
        '<p><b>03</b> 回程票需自行寻找，我们不负责接。</p></div>' +
        '<div class="pp-bk-sign">' + v(d, 'destination') + '</div>' +
        '<div class="pp-mrz mono">&lt;&lt;' + String(d.name || '').toUpperCase() + '&lt;&lt;' + '</div></div>'
      );
    }
  };

  var T_AGENT = {
    id: 'agent-file', cat: 'fantasy', name: '特工档案卡', desc: '横版 · 机密红章 · 权限分级',
    w: 85.6, h: 54, shape: 'rect', radius: 2,
    fields: ['codename', 'name', 'division', 'clearance', 'mission', 'id'],
    demo: { codename: '白鸽', name: '林知远', division: '情报处 · 第七科', clearance: 'L-4', mission: '盯住那个每天同一时间出现在咖啡馆的人', id: 'AG-0823' },
    front: function (d) {
      return (
        '<div class="card t-agentfile"><div class="af-scan"></div><div class="af-grid"></div>' +
        '<div class="af-top"><span class="lbl">CLASSIFIED FILE</span><span class="af-warn">仅限授权人员</span></div>' +
        '<div class="af-row">' +
        '<div class="af-code">' + v(d, 'codename') + '</div>' +
        '<div class="af-clear"><span class="lbl">权限</span><b class="mono">' + v(d, 'clearance') + '</b></div></div>' +
        '<div class="af-name">' + v(d, 'name') + '<span>' + v(d, 'division') + '</span></div>' +
        '<div class="af-mission"><span class="lbl">当前任务</span><p>' + v(d, 'mission') + '</p></div>' +
        '<div class="af-foot"><span class="mono">' + v(d, 'id') + '</span><span class="af-bars"></span></div>' +
        '<div class="af-stamp">绝密</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-agentfile t-agentfile-back"><div class="af-scan"></div><div class="af-grid"></div>' +
        '<div class="af-bk-title">行动记录</div>' +
        '<div class="af-bk-rows">' +
        '<div><span>03:12</span><b>目标离开住所，携带一只纸袋</b></div>' +
        '<div><span>03:40</span><b>目标在同一路口往返三次</b></div>' +
        '<div><span>04:05</span><b>跟丢。原因：他走进了不存在的门</b></div></div>' +
        '<div class="af-bk-sign">' + v(d, 'codename') + ' · 归档</div>' +
        '<div class="af-stamp">待查</div></div>'
      );
    }
  };

  var T_STARFLEET = {
    id: 'star-crew', cat: 'fantasy', name: '星际舰队船员证', desc: '横版 · 星图 · 扫描环',
    w: 85.6, h: 54, shape: 'rect', radius: 3,
    fields: ['name', 'starship', 'rank', 'sector', 'id', 'photo'],
    demo: { name: '林知远', starship: '夜莺号 · NCC-0823', rank: '二级领航员', sector: '第 7 星区', id: 'SF-0823' },
    front: function (d) {
      return (
        '<div class="card t-starcrew"><div class="sf-starfield"></div><div class="sf-ring"></div>' +
        '<div class="sf-top"><span class="lbl">STARFLEET CREW ID</span><span class="mono">' + v(d, 'id') + '</span></div>' +
        '<div class="sf-photo">' + photo(d, 'sc-ph', String(d.name || '星').slice(0, 1)) + '</div>' +
        '<div class="sf-info">' +
        '<div class="sf-name">' + v(d, 'name') + '</div>' +
        '<div class="sf-ship">' + v(d, 'starship') + '</div>' +
        '<div class="sf-rows">' +
        '<div><span class="lbl">职务</span><b>' + v(d, 'rank') + '</b></div>' +
        '<div><span class="lbl">星区</span><b>' + v(d, 'sector') + '</b></div></div></div>' +
        '<div class="sf-badge">✧</div>' +
        '<div class="sf-foot"><span>本证在真空环境中同样有效</span><span class="mono">SECTOR 7</span></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-starcrew t-starcrew-back"><div class="sf-starfield"></div>' +
        '<div class="sf-bk-title">航行日志</div>' +
        '<div class="sf-bk-rows">' +
        '<div><span>D-041</span><b>穿越星云，全员失眠</b></div>' +
        '<div><span>D-058</span><b>收到一段无法解析的问候</b></div>' +
        '<div><span>D-073</span><b>决定不去想它，继续飞</b></div></div>' +
        '<div class="sf-bk-sign">' + v(d, 'starship') + '</div>' +
        '<div class="sf-bk-mark mono">' + v(d, 'rank') + ' · ' + v(d, 'sector') + '</div></div>'
      );
    }
  };

  var T_TCG = {
    id: 'tcg-card', cat: 'fantasy', name: '集换式战力卡', desc: '竖版 · 63×88 · 稀有度闪卡',
    w: 63, h: 88, shape: 'rect', radius: 3.4,
    fields: ['name', 'title', 'power', 'atk', 'def', 'skill', 'rarity', 'photo'],
    demo: { name: '夜航者', title: '城市的守夜人', power: '飞行 · 夜视', atk: '7', def: '4', skill: '夜幕降临时，攻击力 +2；若场上有月亮，抽一张牌。', rarity: 'SR' },
    front: function (d) {
      return (
        '<div class="card t-tcg"><div class="tc-holo"></div><div class="tc-frame"></div>' +
        '<div class="tc-art">' + photo(d, 'tc-ph', String(d.name || '卡').slice(0, 1)) + '</div>' +
        '<div class="tc-top"><span class="tc-rarity">' + v(d, 'rarity') + '</span><span class="mono">NO. 0823</span></div>' +
        '<div class="tc-title-bar"><b>' + v(d, 'name') + '</b><span>' + v(d, 'title') + '</span></div>' +
        '<div class="tc-stats">' +
        '<div><span class="lbl">ATK</span><b class="mono">' + v(d, 'atk') + '</b></div>' +
        '<div><span class="lbl">DEF</span><b class="mono">' + v(d, 'def') + '</b></div></div>' +
        '<div class="tc-power"><span class="lbl">能力</span>' + v(d, 'power') + '</div>' +
        '<div class="tc-foot"><span class="mono">TCG · SERIES 01</span><span class="tc-star">✦</span></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-tcg t-tcg-back"><div class="tc-holo"></div><div class="tc-frame"></div>' +
        '<div class="tc-bk-head"><span class="tc-rarity">' + v(d, 'rarity') + '</span><b>' + v(d, 'name') + '</b></div>' +
        '<div class="tc-bk-rule"></div>' +
        '<div class="tc-bk-skill"><span class="lbl">技能</span><p>' + v(d, 'skill') + '</p></div>' +
        '<div class="tc-bk-flavor">「' + v(d, 'title') + '」</div>' +
        '<div class="tc-bk-foot mono">'+ v(d, 'atk') + ' / ' + v(d, 'def') + ' · SERIES 01 · 0823</div></div>'
      );
    }
  };

  // ============================================================
  // 名片
  // ============================================================



  var T_CONTACT_SOCIAL = {
    id: 'contact-social', cat: 'social', name: '加我卡', desc: '竖版 · 玻璃渐变 · 扫码交友',
    w: 54, h: 86, shape: 'rect', radius: 4,
    fields: ['name', 'handle', 'role', 'site', 'qr', 'photo'],
    demo: { name: '林知远', handle: '@lumen', role: '拍照 / 修图 / 写文案', site: 'lumen.studio' },
    front: function (d) {
      return (
        '<div class="card t-social"><div class="sc-glow"></div><div class="sc-noise"></div>' +
        '<div class="sc-avatar">' + photo(d, 'sc-ph', d.name.slice(0, 1)) + '</div>' +
        '<div class="sc-name">' + v(d, 'name') + '</div>' +
        '<div class="sc-handle mono">' + v(d, 'handle') + '</div>' +
        '<div class="sc-tags"><span>' + v(d, 'role') + '</span><span>' + v(d, 'site') + '</span></div>' +
        '<div class="sc-qr">' + qr(d, '') + '</div>' +
        '<div class="sc-tip lbl">SCAN TO CONNECT</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-social t-social-back"><div class="sc-glow"></div>' +
        '<div class="sc-bk-mark">' + v(d, 'handle') + '</div>' +
        '<div class="sc-bk-qr">' + qr(d, '') + '</div>' +
        '<div class="sc-bk-tip">扫码加我<br><span class="mono">' + v(d, 'site') + '</span></div></div>'
      );
    }
  };

  // ============================================================
  // 主页 / 社交卡片
  // ============================================================

  var I_PIN = '<svg class="nx-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.7c2.3 0 4.1 1.8 4.1 4.1C12.1 9 8 14.4 8 14.4S3.9 9 3.9 5.8C3.9 3.5 5.7 1.7 8 1.7Z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="5.8" r="1.4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  var I_CAL = '<svg class="nx-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.2" y="3.4" width="11.6" height="10.4" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.2 6.6h11.6M5.4 1.9v2.6M10.6 1.9v2.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  var I_CHECK = '<svg class="nx-ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5.2 8.2 7.1 10l3.8-3.9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /** 贡献热力图：固定伪随机，保证每次渲染一致 */
  function grassCells(seed, total) {
    var out = '';
    var r = seed || 7;
    for (var i = 0; i < (total || 112); i++) {
      r = (r * 9301 + 49297) % 233280;
      var x = r / 233280;
      var lv = x < 0.22 ? 0 : x < 0.52 ? 1 : x < 0.76 ? 2 : x < 0.92 ? 3 : 4;
      out += '<i class="dv-cell l' + lv + '"></i>';
    }
    return out;
  }

  var T_DEV_PROFILE = {
    id: 'dev-profile', cat: 'online', name: '代码资料卡', desc: '横版 · 编辑器 · 头像 / 贡献图',
    w: 85.6, h: 54, shape: 'rect', radius: 2.2,
    fields: ['name', 'role', 'stack', 'motto', 'now', 'handle', 'photo', 'contributions', 'period'],
    demo: {
      name: '林知远', role: 'iOS Developer', stack: 'Swift, Rust',
      motto: 'Make it wonderful', now: 'building in public', handle: '@vincent',
      contributions: '2,321', period: '2024.06 — 2025.01'
    },
    front: function (d) {
      var skills = String(d.stack || '').split(/[,，、\/]/)
        .filter(function (s) { return s.trim(); }).slice(0, 2)
        .map(function (s) { return '<span class="s">"' + esc(s.trim()) + '"</span>'; })
        .join('<span class="p">, </span>');
      if (!skills) skills = '<span class="s">"Swift"</span>';
      var ind = '<i class="dv-ind"></i>';
      return (
        '<div class="card t-devprofile"><div class="dv-ambient"></div>' +
        '<div class="dv-win">' +
        '<div class="dv-bar"><span class="dv-dots"><i class="r"></i><i class="y"></i><i class="g"></i></span>' +
        '<span class="dv-tab">{ } profile.json</span><span class="dv-bar-r">⌘K</span></div>' +
        '<div class="dv-crumb">bonjour &gt; geek &gt; <b>profile.json</b> &gt; …</div>' +
        '<div class="dv-main">' +
        '<div class="dv-code">' +
        '<div class="dv-row"><span class="dv-ln">1</span><span class="dv-line"><b class="p">{</b></span></div>' +
        '<div class="dv-row"><span class="dv-ln">2</span><span class="dv-line">' + ind + '<span class="k">"name"</span><span class="p">: </span><span class="s">"' + v(d, 'name') + '"</span><span class="p">,</span></span></div>' +
        '<div class="dv-row"><span class="dv-ln">3</span><span class="dv-line">' + ind + '<span class="k">"role"</span><span class="p">: </span><span class="s">"' + v(d, 'role') + '"</span><span class="p">,</span></span></div>' +
        '<div class="dv-row"><span class="dv-ln">4</span><span class="dv-line">' + ind + '<span class="k">"skills"</span><span class="p">: [</span>' + skills + '<span class="p">],</span></span></div>' +
        '<div class="dv-row"><span class="dv-ln">5</span><span class="dv-line">' + ind + '<span class="k">"motto"</span><span class="p">: </span><span class="s">"' + v(d, 'motto') + '"</span><span class="p">,</span></span></div>' +
        '<div class="dv-row"><span class="dv-ln">6</span><span class="dv-line">' + ind + '<span class="k">"now"</span><span class="p">: </span><span class="s">"' + v(d, 'now') + '"</span><span class="p">,</span></span></div>' +
        '<div class="dv-row"><span class="dv-ln">7</span><span class="dv-line">' + ind + '<span class="k">"contact"</span><span class="p">: </span><span class="s">"' + v(d, 'handle') + '"</span></span></div>' +
        '<div class="dv-row"><span class="dv-ln">8</span><span class="dv-line"><b class="p">}</b><span class="dv-caret"></span></span></div>' +
        '</div>' +
        '<div class="dv-side">' +
        '<div class="dv-ava">' + photo(d, 'dv-ph', String(d.name || '我').slice(0, 1)) + '</div>' +
        '<div class="dv-side-name">' + v(d, 'name') + '</div>' +
        '<div class="dv-side-handle">' + v(d, 'handle') + '</div>' +
        '<div class="dv-side-tag"><span class="dv-live"></span>open to collab</div>' +
        '</div></div>' +
        '<div class="dv-term"><span class="p">$</span> whoami <span class="dv-term-out">→ a dreamer with a keyboard</span></div>' +
        '<div class="dv-foot"><span>main*</span><span class="dv-foot-r">UTF-8 · JSON · Ln 8, Col 2</span></div>' +
        '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-devprofile t-devprofile-back"><div class="dv-ambient"></div>' +
        '<div class="dv-bk-head"><span class="lbl">CONTRIBUTION GRAPH</span><span class="mono">' + v(d, 'handle') + '</span></div>' +
        '<div class="dv-grass">' + grassCells(23, 196) + '</div>' +
        '<div class="dv-legend"><span>Less</span><i class="dv-cell l0"></i><i class="dv-cell l1"></i><i class="dv-cell l2"></i><i class="dv-cell l3"></i><i class="dv-cell l4"></i><span>More</span></div>' +
        '<div class="dv-bk-row">' +
        '<div class="dv-bk-count"><i class="dv-check">✓</i><b class="mono">' + v(d, 'contributions') + '</b><span>Contributions</span></div>' +
        '<div class="dv-bk-period mono">' + v(d, 'period') + '</div></div>' +
        '<div class="dv-bk-foot">持续输出中 · 偶尔断更 · ' + v(d, 'now') + '</div></div>'
      );
    }
  };

  var T_NEON_GLASS = {
    id: 'neon-glass', cat: 'online', name: '霓虹主页卡', desc: '竖版 · 玻璃描边 · 社交主页',
    w: 54, h: 86, shape: 'rect', radius: 2.8,
    fields: ['name', 'handle', 'bio', 'location', 'joined', 'following', 'followers', 'photo'],
    demo: {
      name: '知远', handle: '@zhiyuan', bio: '23 · 全职在忙 · 正在做 @lumen_lab',
      location: 'zhiyuan.studio', joined: '2019 年 3 月加入',
      following: '717', followers: '5,336'
    },
    front: function (d) {
      return (
        '<div class="card t-neonglass"><div class="ng-bg"></div><div class="ng-bloom"></div>' +
        '<div class="ng-frame"><div class="ng-inner">' +
        '<div class="ng-head">' +
        '<div class="ng-ava">' + photo(d, 'ng-ph', String(d.name || '主').slice(0, 1)) + '</div>' +
        '<div class="ng-id"><div class="ng-name"><span class="ng-nm">' + v(d, 'name') + '</span><i class="ng-verified">✓</i></div>' +
        '<div class="ng-handle">' + v(d, 'handle') + '</div></div></div>' +
        '<div class="ng-bio">' + v(d, 'bio') + '</div>' +
        '<div class="ng-rows">' +
        '<div>' + I_PIN + '<span>' + v(d, 'location') + '</span></div>' +
        '<div>' + I_CAL + '<span>' + v(d, 'joined') + '</span></div>' +
        '<div>' + I_CHECK + '<span>已验证手机号</span></div></div>' +
        '<div class="ng-stats"><div><b class="mono">' + v(d, 'following') + '</b><span>Following</span></div>' +
        '<div><b class="mono">' + v(d, 'followers') + '</b><span>Followers</span></div></div>' +
        '<div class="ng-foot">PROFILE · 2026</div>' +
        '</div></div></div>'
      );
    }
  };

  var T_HOME_CARD = {
    id: 'home-card', cat: 'online', name: '主页名片', desc: '横版 · 霓虹框 · 头像 / 数据 / 二维码',
    w: 85.6, h: 54, shape: 'rect', radius: 2.2,
    fields: ['name', 'handle', 'bio', 'location', 'tags', 'following', 'followers', 'likes', 'photo', 'qr'],
    demo: {
      name: '爱折腾的三斤', handle: 'SanJinCode',
      bio: '无业游民，键盘已经冒烟。喜欢瞎折腾，做了很多好玩又没用的小东西。',
      location: 'IP 属地：北京', tags: '18 岁, 北京朝阳, 产品经理',
      following: '4', followers: '1.3 万', likes: '5.0 万'
    },
    front: function (d) {
      return (
        '<div class="card t-homecard"><div class="sh-bg"></div><div class="sh-bloom-a"></div><div class="sh-bloom-b"></div>' +
        '<div class="sh-frame"><div class="sh-inner">' +
        '<div class="sh-head">' +
        '<div class="sh-ava">' + photo(d, 'sh-ph', String(d.name || '主').slice(0, 1)) + '</div>' +
        '<div class="sh-id"><div class="sh-name"><span class="sh-nm">@ ' + v(d, 'name') + '</span><span class="sh-badge">主页</span></div>' +
        '<div class="sh-sub">主页号：' + v(d, 'handle') + ' · ' + v(d, 'location') + '</div></div>' +
        '<div class="sh-qr">' + qr(d, '') + '</div></div>' +
        '<div class="sh-bio">' + v(d, 'bio') + '</div>' +
        '<div class="sh-tags">' + tags(d, 'tags', 'sh-tag') + '</div>' +
        '<div class="sh-stats">' +
        '<div><b class="mono">' + v(d, 'following') + '</b><span>关注</span></div>' +
        '<div><b class="mono">' + v(d, 'followers') + '</b><span>粉丝</span></div>' +
        '<div><b class="mono">' + v(d, 'likes') + '</b><span>获赞与收藏</span></div></div>' +
        '</div></div></div>'
      );
    }
  };

  var T_NFC_CARD = {
    id: 'nfc-card', cat: 'online', name: 'NFC 碰一碰卡', desc: '竖版 · COB 卡 · 碰一下交换主页',
    w: 54, h: 86, shape: 'rect', radius: 2.4,
    fields: ['name', 'handle', 'motto', 'site', 'photo', 'qr'],
    demo: { name: '林知远', handle: '@vincent', motto: 'Make Something Wonderful', site: 'link.bio/vincent' },
    front: function (d) {
      return (
        '<div class="card t-nfccard"><div class="nf-sheen"></div><div class="nf-dots"></div>' +
        '<div class="nf-top"><span class="nf-chip"></span><span class="mono">NFC · 13.56 MHz</span></div>' +
        '<div class="nf-ava">' + photo(d, 'nf-ph', String(d.name || '我').slice(0, 1)) + '</div>' +
        '<div class="nf-name">' + v(d, 'name') + '</div>' +
        '<div class="nf-handle">' + v(d, 'handle') + '</div>' +
        '<div class="nf-motto">' + v(d, 'motto') + '</div>' +
        '<div class="nf-tap"><svg class="nf-wave" viewBox="0 0 60 60" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round">' +
        '<path d="M18 20a14 14 0 0 1 0 20"/><path d="M27 13a26 26 0 0 1 0 34"/><path d="M36 6a38 38 0 0 1 0 48"/></g></svg>' +
        '<span>碰一下 · 交个朋友</span></div>' +
        '<div class="nf-foot">' +
        '<div class="nf-qr">' + qr(d, '') + '</div>' +
        '<div class="nf-site"><span class="lbl">TAP OR SCAN</span><b class="mono">' + v(d, 'site') + '</b></div></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-nfccard t-nfccard-back"><div class="nf-sheen"></div><div class="nf-dots"></div>' +
        '<div class="nf-bk-mark">NFC</div>' +
        '<div class="nf-bk-qr">' + qr(d, '') + '</div>' +
        '<div class="nf-bk-text">手机靠近卡片<br>自动打开我的主页</div>' +
        '<div class="nf-bk-site mono">' + v(d, 'site') + '</div>' +
        '<div class="nf-bk-foot">' + v(d, 'name') + ' · ' + v(d, 'handle') + '</div></div>'
      );
    }
  };

  // ============================================================
  // 整活
  // ============================================================

  var T_FUN_SLACKER = {
    id: 'fun-slacker', cat: 'persona', name: '摸鱼许可证', desc: '横版 · 红头公章 · 工位必备',
    w: 90, h: 54, shape: 'rect', radius: 2,
    fields: ['name', 'dept', 'level', 'date'],
    demo: { name: '林知远', dept: '市场部', level: '资深摸鱼师 · Lv.8', date: '2026.10' },
    front: function (d) {
      return (
        '<div class="card t-slacker"><div class="sk-paper"></div><div class="sk-corner"></div>' +
        '<div class="sk-head"><span class="lbl">SLACK PERMIT</span><span class="mono">NO. 2026-08</span></div>' +
        '<div class="sk-title">摸鱼许可证<span>PERMIT TO SLACK</span></div>' +
        '<div class="sk-body">兹证明 <b>' + v(d, 'name') + '</b> 同志，现任 <b>' + v(d, 'dept') + '</b>，<br>在岗期间<em>带薪摸鱼、神情自若</em>，表现优异，特发此证。</div>' +
        '<div class="sk-lv">' + v(d, 'level') + '</div>' +
        '<div class="sk-seal">摸鱼<br>专用章</div>' +
        '<div class="sk-foot"><span>有效期 · 长期</span><span class="mono">' + v(d, 'date') + '</span></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-slacker t-slacker-back"><div class="sk-paper"></div>' +
        '<div class="sk-bk-title">摸鱼守则</div>' +
        '<div class="sk-bk-list"><p><b>01</b> 收到消息先等三分钟，多半别人已经解决了。</p>' +
        '<p><b>02</b> 屏幕上永远开着一个看起来很重要的文档。</p>' +
        '<p><b>03</b> 摸鱼不是偷懒，是为下一次冲刺养精蓄锐。</p></div>' +
        '<div class="sk-bk-sign">' + v(d, 'name') + ' <span>/ 本人已阅</span></div></div>'
      );
    }
  };

  var T_FUN_NIUNIU = {
    id: 'fun-niuniu', cat: 'persona', name: '牛马证', desc: '竖版 · 荧光黑 · 自嘲限定',
    w: 54, h: 86, shape: 'rect', radius: 3.2,
    fields: ['name', 'org', 'role', 'id', 'tagline'],
    demo: { name: '林知远', org: '某互联网公司', role: '资深牛马 / 全栈背锅', id: 'NO.996', tagline: '今天也在认真拉磨' },
    front: function (d) {
      return (
        '<div class="card t-niuniu"><div class="nn-glow"></div><div class="nn-grid"></div>' +
        '<div class="nn-top"><span class="nn-pill">ASSET</span><span class="mono">' + v(d, 'id') + '</span></div>' +
        '<div class="nn-title">牛马证</div>' +
        '<div class="nn-name">' + v(d, 'name') + '</div>' +
        '<div class="nn-role">' + v(d, 'role') + '</div>' +
        '<div class="nn-strip"></div>' +
        '<div class="nn-rows"><div><span>所属</span><b>' + v(d, 'org') + '</b></div>' +
        '<div><span>状态</span><b class="nn-live">持续运转中</b></div>' +
        '<div><span>属性</span><b>能扛 · 能熬 · 能改需求</b></div></div>' +
        '<div class="nn-tag">' + v(d, 'tagline') + '</div>' +
        '<div class="nn-foot">本证仅供自嘲 · 不可用于离职</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-niuniu t-niuniu-back"><div class="nn-glow"></div><div class="nn-grid"></div>' +
        '<div class="nn-bk-title">免责声明</div>' +
        '<div class="nn-bk-text">持证人自愿承认自己是一头牛马。<br>加班属个人爱好，与公司无关。<br>如有异议，请先改完这版再说。</div>' +
        '<div class="nn-bk-seal">已阅</div>' +
        '<div class="nn-foot mono">' + v(d, 'id') + ' · ' + v(d, 'name') + '</div></div>'
      );
    }
  };

  var T_FUN_MBTI = {
    id: 'fun-mbti', cat: 'persona', name: 'MBTI 卡', desc: '竖版 · 大字人格 · 社交货币',
    w: 54, h: 90, shape: 'rect', radius: 4,
    fields: ['name', 'mbti', 'alias', 'traits'],
    demo: { name: '林知远', mbti: 'INFP', alias: '调停者 · 白日梦想家', traits: '共情力强 · 内心戏多 · 拖延但善良' },
    front: function (d) {
      return (
        '<div class="card t-mbti"><div class="mt-blob"></div><div class="mt-noise"></div>' +
        '<div class="mt-top">PERSONALITY<br>TYPE</div>' +
        '<div class="mt-type">' + v(d, 'mbti') + '</div>' +
        '<div class="mt-name">' + v(d, 'name') + '</div>' +
        '<div class="mt-alias">' + v(d, 'alias') + '</div>' +
        '<div class="mt-traits">' + v(d, 'traits') + '</div>' +
        '<div class="mt-foot">16 TYPES · JUST FOR FUN</div></div>'
      );
    },
    back: function (d) {
      var t = String(d.mbti || 'INFP').toUpperCase();
      var pairs = [['I', 'E', '内向', '外向'], ['N', 'S', '直觉', '实感'], ['F', 'T', '情感', '思考'], ['P', 'J', '感知', '判断']];
      var bars = pairs.map(function (p) {
        var left = t.indexOf(p[0]) >= 0;
        return '<div class="mt-bar"><span>' + p[0] + '</span>' +
          '<i class="' + (left ? 'is-left' : 'is-right') + '"></i>' +
          '<span>' + p[1] + '</span>' +
          '<em>' + (left ? p[2] : p[3]) + '</em></div>';
      }).join('');
      return (
        '<div class="card t-mbti t-mbti-back"><div class="mt-blob"></div><div class="mt-noise"></div>' +
        '<div class="mt-bk-top">' + v(d, 'mbti') + ' <span>/ ' + v(d, 'name') + '</span></div>' +
        '<div class="mt-bars">' + bars + '</div>' +
        '<div class="mt-bk-note">' + v(d, 'traits') + '</div>' +
        '<div class="mt-foot">本卡不具备任何心理学效力</div></div>'
      );
    }
  };

  var T_FUN_BUDDY = {
    id: 'fun-buddy', cat: 'social', name: '搭子卡', desc: '横版 · 高饱和 · 招人一起玩',
    w: 90, h: 54, shape: 'rect', radius: 3,
    fields: ['name', 'handle', 'tags', 'qr', 'tagline'],
    demo: { name: '林知远', handle: '@lumen', tags: '饭搭子 / 旅行搭子 / 演唱会', tagline: '一个人也行，两个人更好' },
    front: function (d) {
      return (
        '<div class="card t-buddy"><div class="bd-blob"></div><div class="bd-ring"></div>' +
        '<div class="bd-tag">搭子招募中</div>' +
        '<div class="bd-name">' + v(d, 'name') + '</div>' +
        '<div class="bd-handle mono">' + v(d, 'handle') + '</div>' +
        '<div class="bd-tags">' + tags(d, 'tags', 'bd-chip') + '</div>' +
        '<div class="bd-qr">' + qr(d, '') + '</div>' +
        '<div class="bd-foot">' + v(d, 'tagline') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-buddy t-buddy-back"><div class="bd-blob"></div>' +
        '<div class="bd-bk-title">扫码找我玩</div>' +
        '<div class="bd-bk-qr">' + qr(d, '') + '</div>' +
        '<div class="bd-bk-tags">' + tags(d, 'tags', 'bd-chip') + '</div></div>'
      );
    }
  };

  var T_FUN_FAN = {
    id: 'fun-fan', cat: 'fan', name: '追星小卡', desc: '竖版 · 拍立得 · 自印应援',
    w: 54, h: 86, shape: 'rect', radius: 2.4,
    fields: ['name', 'group', 'era', 'photo'],
    demo: { name: '林知远', group: 'LUMEN', era: '2026 · 巡演限定' },
    front: function (d) {
      return (
        '<div class="card t-fan">' +
        '<div class="fn-photo">' + photo(d, 'fn-ph', d.name.slice(0, 1)) + '</div>' +
        '<div class="fn-shade"></div>' +
        '<div class="fn-top"><span class="lbl">PHOTOCARD</span><span class="mono">NO.01</span></div>' +
        '<div class="fn-bottom"><b>' + v(d, 'name') + '</b><span>' + v(d, 'group') + '</span></div>' +
        '<div class="fn-badge">' + v(d, 'era') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-fan t-fan-back"><div class="fn-bk-mark">' + v(d, 'group') + '</div>' +
        '<div class="fn-bk-line"></div>' +
        '<div class="fn-bk-text">「谢谢你出现在我的<br>普通日子里。」</div>' +
        '<div class="fn-bk-sign">— ' + v(d, 'name') + '</div>' +
        '<div class="fn-bk-no mono">' + v(d, 'era') + '</div></div>'
      );
    }
  };

  var T_FUN_GAME = {
    id: 'fun-game', cat: 'social', name: '游戏 ID 卡', desc: '横版 · 霓虹网格 · 车队名片',
    w: 85.6, h: 54, shape: 'rect', radius: 2.6,
    fields: ['name', 'game', 'rank', 'id', 'qr'],
    demo: { name: 'LUMEN', game: 'VALORANT', rank: '不朽 · IMMORTAL 2', id: 'PLAYER#0823' },
    front: function (d) {
      return (
        '<div class="card t-game"><div class="gm-grid"></div><div class="gm-glow"></div>' +
        '<div class="gm-top"><span class="lbl">PLAYER CARD</span><span class="mono">' + v(d, 'id') + '</span></div>' +
        '<div class="gm-name">' + v(d, 'name') + '</div>' +
        '<div class="gm-rank">' + v(d, 'rank') + '</div>' +
        '<div class="gm-game">' + v(d, 'game') + '</div>' +
        '<div class="gm-qr">' + qr(d, '') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-game t-game-back"><div class="gm-grid"></div><div class="gm-glow"></div>' +
        '<div class="gm-bk-title">ADD ME</div>' +
        '<div class="gm-bk-id mono">' + v(d, 'id') + '</div>' +
        '<div class="gm-bk-qr">' + qr(d, '') + '</div>' +
        '<div class="gm-bk-tip">扫码 / 搜 ID · 晚上八点开黑</div></div>'
      );
    }
  };

  var T_FUN_SINGLE = {
    id: 'fun-single', cat: 'persona', name: '单身认证', desc: '横版 · 大红钢印 · 随缘发放',
    w: 90, h: 54, shape: 'rect', radius: 1.8,
    fields: ['name', 'date', 'id'],
    demo: { name: '林知远', date: '2026.10', id: 'NO.0001' },
    front: function (d) {
      return (
        '<div class="card t-single"><div class="sg-frame"></div><div class="sg-lines"></div>' +
        '<div class="sg-top">CERTIFICATE OF SINGLENESS</div>' +
        '<div class="sg-name">' + v(d, 'name') + '</div>' +
        '<div class="sg-text">经本委员会审核，此人目前<br><em>单身、可撩、非诚勿扰</em></div>' +
        '<div class="sg-seal">单身<br>认证</div>' +
        '<div class="sg-no mono">' + v(d, 'id') + ' · ' + v(d, 'date') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-single t-single-back"><div class="sg-frame"></div>' +
        '<div class="sg-bk-title">单身宣言</div>' +
        '<div class="sg-bk-text">不是没人要，<br>是还没遇到值得我洗头的人。</div>' +
        '<div class="sg-bk-foot">— ' + v(d, 'name') + ' · ' + v(d, 'date') + '</div></div>'
      );
    }
  };

  var T_FUN_NIGHTOWL = {
    id: 'fun-nightowl', cat: 'persona', name: '熬夜冠军', desc: '横版 · 星空 · 凌晨三点俱乐部',
    w: 90, h: 54, shape: 'rect', radius: 3,
    fields: ['name', 'time', 'note'],
    demo: { name: '林知远', time: '03:47', note: '再刷五分钟，结果天亮了' },
    front: function (d) {
      return (
        '<div class="card t-nightowl"><div class="no-stars"></div><div class="no-moon"></div>' +
        '<div class="no-top"><span class="lbl">NIGHT OWL AWARD</span><span class="mono">23:00 — 06:00</span></div>' +
        '<div class="no-title">熬夜冠军</div>' +
        '<div class="no-name">' + v(d, 'name') + '</div>' +
        '<div class="no-rule"></div>' +
        '<div class="no-bottom">' +
        '<div class="no-note">' + v(d, 'note') + '</div>' +
        '<div class="no-clock"><span class="lbl">入睡时间</span><b class="mono">' + v(d, 'time') + '</b></div>' +
        '</div>' +
        '<div class="no-foot">本奖项由深夜的手机屏幕赞助</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-nightowl t-nightowl-back"><div class="no-stars"></div>' +
        '<div class="no-bk-title">熬夜战绩</div>' +
        '<div class="no-bk-rows"><div><span>入睡时间</span><b class="mono">' + v(d, 'time') + '</b></div>' +
        '<div><span>夺冠理由</span><b>' + v(d, 'note') + '</b></div>' +
        '<div><span>明日计划</span><b>一定早睡</b></div></div>' +
        '<div class="no-bk-stamp">已放弃治疗</div></div>'
      );
    }
  };

  // ============================================================
  // 归属
  // ============================================================

  var T_TAG_PET = {
    id: 'tag-pet', cat: 'pet', name: '宠物牌', desc: '圆形 Ø38 · 金属刻字 · 双面',
    w: 38, h: 38, shape: 'circle', radius: 999,
    fields: ['name', 'breed', 'phone', 'qr'],
    demo: { name: '团子', breed: '英短 · 3 岁', phone: '138 0013 8000' },
    front: function (d) {
      return (
        '<div class="card t-pet"><div class="pt-metal"></div><div class="pt-ring"></div><div class="pt-hole"></div>' +
        '<div class="pt-paw">' + PAW + '</div>' +
        '<div class="pt-name">' + v(d, 'name') + '</div>' +
        '<div class="pt-breed lbl">' + v(d, 'breed') + '</div>' +
        '<div class="pt-rule"></div>' +
        '<div class="pt-phone mono">' + v(d, 'phone') + '</div>' +
        '<div class="pt-tip lbl">MY HUMAN</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-pet t-pet-back"><div class="pt-metal"></div><div class="pt-ring"></div>' +
        '<div class="pt-bk-qr">' + qr(d, '') + '</div>' +
        '<div class="pt-tip lbl">SCAN MY DAILY LIFE</div></div>'
      );
    }
  };

  var T_TAG_LUGGAGE = {
    id: 'tag-luggage', cat: 'merch', name: '行李牌', desc: '竖版 · 皮革缝线 · 双面',
    w: 54, h: 90, shape: 'rect', radius: 3.4,
    fields: ['name', 'phone', 'email', 'addr', 'qr'],
    demo: { name: '林知远', phone: '+86 138 0013 8000', email: 'hi@lumen.studio', addr: '上海 · 徐汇区' },
    front: function (d) {
      return (
        '<div class="card t-luggage"><div class="lg-stitch"></div><div class="lg-hole"></div>' +
        '<div class="lg-top"><span class="lbl">LUGGAGE TAG</span><span class="mono">NO.01</span></div>' +
        '<div class="lg-name">' + v(d, 'name') + '</div>' +
        '<div class="lg-rule"></div>' +
        '<div class="lg-rows mono"><span>' + v(d, 'phone') + '</span><span>' + v(d, 'email') + '</span><span>' + v(d, 'addr') + '</span></div>' +
        '<div class="lg-qr">' + qr(d, '') + '</div>' +
        '<div class="lg-tip lbl">THIS BAG HAS BEEN TO 12 CITIES</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-luggage t-luggage-back"><div class="lg-stitch"></div><div class="lg-hole"></div>' +
        '<div class="lg-bk-title">如果它走丢了<br>请帮我叫它回家</div>' +
        '<div class="lg-bk-cn">' + v(d, 'phone') + '</div>' +
        '<div class="lg-bk-reward lbl">THANK YOU · 请你喝咖啡</div>' +
        '<div class="lg-bk-mark mono">' + v(d, 'name') + '</div></div>'
      );
    }
  };

  var T_TAG_KID = {
    id: 'tag-kid', cat: 'pet', name: '人类幼崽档案', desc: '竖版 · 醒目黄 · 记录成长',
    w: 54, h: 86, shape: 'rect', radius: 4.5,
    fields: ['name', 'age', 'hobby', 'quote', 'guardian', 'photo'],
    demo: { name: '林小满', age: '5 岁 · 中班', hobby: '画画、抠墙皮、拒绝睡觉', quote: '我不要！', guardian: '妈妈 139 0013 9000' },
    front: function (d) {
      return (
        '<div class="card t-kid"><div class="kd-band">HUMAN CUB FILE · 人类幼崽</div>' +
        '<div class="kd-photo">' + photo(d, 'kd-ph', d.name.slice(0, 1)) + '</div>' +
        '<div class="kd-name">' + v(d, 'name') + '</div>' +
        '<div class="kd-sub">' + v(d, 'age') + '</div>' +
        '<div class="kd-call"><span class="lbl">口头禅</span><b>「' + v(d, 'quote') + '」</b></div>' +
        '<div class="kd-note">爱好：' + v(d, 'hobby') + '<br>监护人：' + v(d, 'guardian') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-kid t-kid-back"><div class="kd-band kd-band--back">GROWTH RECORD · 成长记录</div>' +
        '<div class="kd-bk-rows">' +
        '<div><span class="lbl">本月战绩</span><b>学会自己穿鞋（左右偶尔反）</b></div>' +
        '<div><span class="lbl">最爱的食物</span><b>面条，只吃白面条</b></div>' +
        '<div><span class="lbl">最怕的东西</span><b>洗头、剪指甲、说晚安</b></div>' +
        '<div><span class="lbl">监护人</span><b class="mono">' + v(d, 'guardian') + '</b></div></div>' +
        '<div class="kd-bk-name">' + v(d, 'name') + '</div></div>'
      );
    }
  };

  var T_FUN_PETID = {
    id: 'fun-petid', cat: 'pet', name: '猫主子身份证', desc: '横版 · 正经证件 · 不正经内容',
    w: 85.6, h: 54, shape: 'rect', radius: 2.6,
    fields: ['name', 'breed', 'human', 'photo'],
    demo: { name: '团子', breed: '英国短毛猫 · 3 岁', human: '林知远' },
    front: function (d) {
      return (
        '<div class="card t-petid"><div class="pi-guilloche"></div>' +
        '<div class="pi-head"><span class="lbl">CAT IDENTITY CARD</span><span class="mono">NO.0001</span></div>' +
        '<div class="pi-photo">' + photo(d, 'pi-ph', d.name.slice(0, 1)) + '</div>' +
        '<div class="pi-info"><div class="pi-name">' + v(d, 'name') + '</div>' +
        '<div class="pi-breed">' + v(d, 'breed') + '</div>' +
        '<div class="pi-rows"><div><span>铲屎官</span><b>' + v(d, 'human') + '</b></div>' +
        '<div><span>家庭地位</span><b>第一顺位</b></div></div></div>' +
        '<div class="pi-paw">' + PAW + '</div>' +
        '<div class="pi-foot">本喵脾气一般，撸前请三思</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-petid t-petid-back"><div class="pi-guilloche"></div>' +
        '<div class="pi-bk-title">日常行为记录</div>' +
        '<div class="pi-bk-rows"><div><span>凌晨三点</span><b>在客厅跑酷</b></div>' +
        '<div><span>早上七点</span><b>踩脸叫起床</b></div>' +
        '<div><span>任意时间</span><b>拒绝被抱，但跟着你上厕所</b></div></div>' +
        '<div class="pi-bk-sign">' + v(d, 'name') + ' <span>爪印已按</span></div></div>'
      );
    }
  };

  // ============================================================
  // 周边
  // ============================================================




  var T_LABEL_GOODS = {
    id: 'label-goods', cat: 'merch', name: '谷子吊牌', desc: '横版 · 应援色 · 挂件专属',
    w: 60, h: 40, shape: 'rect', radius: 2,
    fields: ['name', 'org', 'batch'],
    demo: { name: '限定徽章 · 巡演 ver.', org: 'LUMEN 2026', batch: 'NO.018 / 200' },
    front: function (d) {
      return (
        '<div class="card t-goods"><div class="gd-holo"></div><div class="gd-border"></div>' +
        '<div class="gd-top">ORIGINAL GOODS</div>' +
        '<div class="gd-name">' + v(d, 'name') + '</div>' +
        '<div class="gd-row"><span class="mono">' + v(d, 'batch') + '</span><span>' + v(d, 'org') + '</span></div>' +
        '<div class="gd-star">✦</div></div>'
      );
    }
  };

  var T_FUN_STICKER = {
    id: 'fun-sticker', cat: 'merch', name: '贴纸卡', desc: '方形 · 彩虹描边 · 贴哪都行',
    w: 60, h: 60, shape: 'rect', radius: 14,
    fields: ['name', 'tagline'],
    demo: { name: '今日份营业', tagline: '不营业的时候在充电' },
    front: function (d) {
      return (
        '<div class="card t-sticker"><div class="st-ring"></div><div class="st-grain"></div>' +
        '<div class="st-star">✳</div>' +
        '<div class="st-main">' + v(d, 'name') + '</div>' +
        '<div class="st-sub">' + v(d, 'tagline') + '</div>' +
        '<div class="st-foot">CARD STUDIO · 2026</div></div>'
      );
    }
  };

  var T_FUN_IDOL = {
    id: 'fun-idol', cat: 'fan', name: '出道卡', desc: '竖版 · 舞台光 · 自封 C 位',
    w: 54, h: 86, shape: 'rect', radius: 3.4,
    fields: ['name', 'position', 'debut', 'photo'],
    demo: { name: '林知远', position: '主舞 / 门面 / 气氛组', debut: 'DEBUT 2026.10' },
    front: function (d) {
      return (
        '<div class="card t-idol"><div class="io-glow"></div><div class="io-beam"></div>' +
        '<div class="io-photo">' + photo(d, 'io-ph', d.name.slice(0, 1)) + '</div>' +
        '<div class="io-top">DEBUT STAGE</div>' +
        '<div class="io-name">' + v(d, 'name') + '</div>' +
        '<div class="io-pos">' + v(d, 'position') + '</div>' +
        '<div class="io-debut">' + v(d, 'debut') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-idol t-idol-back"><div class="io-glow"></div>' +
        '<div class="io-bk-title">应援口号</div>' +
        '<div class="io-bk-text">「' + v(d, 'name') + '，<br>你只管发光，<br>我们负责尖叫。」</div>' +
        '<div class="io-bk-foot mono">' + v(d, 'debut') + '</div></div>'
      );
    }
  };

  var T_FUN_MOOD = {
    id: 'fun-mood', cat: 'persona', name: '今日状态牌', desc: '横版 · 大字 · 立桌上',
    w: 90, h: 54, shape: 'rect', radius: 2,
    fields: ['name', 'mood', 'note'],
    demo: { name: '林知远', mood: '勿 扰', note: '在忙，也可能只是在发呆' },
    front: function (d) {
      return (
        '<div class="card t-mood"><div class="md-band"></div><div class="md-grain"></div>' +
        '<div class="md-top"><span class="lbl">TODAY\'S STATUS</span><span class="mono">' + v(d, 'name') + '</span></div>' +
        '<div class="md-mood">' + v(d, 'mood') + '</div>' +
        '<div class="md-rule"></div>' +
        '<div class="md-note">' + v(d, 'note') + '</div>' +
        '<div class="md-dots"><i></i><i></i><i></i></div>' +
        '<div class="md-en">DO NOT DISTURB</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-mood t-mood-back"><div class="md-band"></div><div class="md-grain"></div>' +
        '<div class="md-bk-title">今日状态可选</div>' +
        '<div class="md-bk-grid"><span>营业中</span><span class="on">勿扰</span><span>已下班</span><span>充电中</span></div>' +
        '<div class="md-bk-note">翻到正面，把牌子立起来。</div></div>'
      );
    }
  };

  var T_FUN_SCRIPT = {
    id: 'fun-script', cat: 'persona', name: '剧本杀角色卡', desc: '竖版 · 悬疑 · 秘密翻面',
    w: 54, h: 86, shape: 'rect', radius: 2.4,
    fields: ['name', 'character', 'secret', 'note'],
    demo: { name: '林知远', character: '沉默的钟表匠', secret: '你其实见过凶手，只是当时没有认出他。', note: '第二幕结束前，不要暴露你和死者的关系。' },
    front: function (d) {
      return (
        '<div class="card t-script"><div class="sr-noise"></div><div class="sr-vignette"></div>' +
        '<div class="sr-top"><span class="lbl">CHARACTER CARD</span><span class="mono">NO.07</span></div>' +
        '<div class="sr-kicker">SCRIPT · 剧本杀</div>' +
        '<div class="sr-name">' + v(d, 'character') + '</div>' +
        '<div class="sr-line"></div>' +
        '<div class="sr-label lbl">扮演者</div>' +
        '<div class="sr-player">' + v(d, 'name') + '</div>' +
        '<div class="sr-secret">秘密任务见背面 · 开局前请勿翻看</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-script t-script-back"><div class="sr-noise"></div><div class="sr-vignette"></div>' +
        '<div class="sr-bk-title">你的秘密</div>' +
        '<div class="sr-bk-text">' + v(d, 'secret') + '</div>' +
        '<div class="sr-bk-note">' + v(d, 'note') + '</div>' +
        '<div class="sr-bk-stamp">TOP SECRET</div></div>'
      );
    }
  };

  var T_FUN_BIRTHDAY = {
    id: 'fun-birthday', cat: 'social', name: '生日邀请卡', desc: '横版 · 大字日期 · 发给朋友',
    w: 90, h: 54, shape: 'rect', radius: 3,
    fields: ['name', 'date', 'addr', 'note'],
    demo: { name: '林知远', date: '10.19', addr: '徐汇区永嘉路 42 号', note: '晚上七点 · 带点吃的来' },
    front: function (d) {
      return (
        '<div class="card t-birthday"><div class="bh-dots"></div><div class="bh-sun"></div>' +
        '<div class="bh-top"><span class="lbl">YOU\'RE INVITED</span><span class="mono">NO.01</span></div>' +
        '<div class="bh-kicker">BIRTHDAY PARTY</div>' +
        '<div class="bh-name">' + v(d, 'name') + '<small> 的生日</small></div>' +
        '<div class="bh-date">' + v(d, 'date') + '</div>' +
        '<div class="bh-addr"><span class="lbl">WHERE</span>' + v(d, 'addr') + '</div>' +
        '<div class="bh-foot"><span>' + v(d, 'note') + '</span><span class="mono">SEE YOU THERE</span></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-birthday t-birthday-back"><div class="bh-dots"></div>' +
        '<div class="bh-bk-kicker">A NOTE FOR YOU</div>' +
        '<div class="bh-bk-text">不用带礼物，<br>人来就好。</div>' +
        '<div class="bh-bk-sign">— ' + v(d, 'name') + '</div>' +
        '<div class="bh-bk-mark mono">' + v(d, 'date') + ' · ' + v(d, 'addr') + '</div></div>'
      );
    }
  };

  // ============================================================
  // 恋爱 / 纪念
  // ============================================================

  var T_LOVE_PACT = {
    id: 'love-pact', cat: 'love', name: '恋爱契约', desc: '横版 · 双方签字 · 吵架自动失效',
    w: 90, h: 54, shape: 'rect', radius: 3,
    fields: ['a', 'b', 'promise', 'date'],
    demo: { a: '林知远', b: '小林', promise: '吵架不过夜，生气要说出来，谁先笑谁赢。', date: '2023.05.20' },
    front: function (d) {
      return (
        '<div class="card t-lovepact"><div class="lp-paper"></div>' +
        '<div class="lp-top"><span class="lbl">RELATIONSHIP AGREEMENT</span><span class="mono">NO. 001</span></div>' +
        '<div class="lp-title">恋爱契约</div>' +
        '<div class="lp-parties">' +
        '<div class="lp-party"><span class="lbl">甲方</span><b>' + v(d, 'a') + '</b></div>' +
        '<div class="lp-heart">♥</div>' +
        '<div class="lp-party is-right"><span class="lbl">乙方</span><b>' + v(d, 'b') + '</b></div>' +
        '</div>' +
        '<div class="lp-body">' + v(d, 'promise') + '</div>' +
        '<div class="lp-foot"><span>签订于 ' + v(d, 'date') + '</span><span class="lp-seal">已生效</span></div>' +
        '</div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-lovepact t-lovepact-back"><div class="lp-paper"></div>' +
        '<div class="lp-bk-title">附加条款</div>' +
        '<div class="lp-bk-list">' +
        '<p><b>01</b> 吵架可以，隔夜不行。</p>' +
        '<p><b>02</b> 谁先低头不是输，是在乎。</p>' +
        '<p><b>03</b> 本协议在拥抱后自动续约。</p></div>' +
        '<div class="lp-bk-sign">' + v(d, 'a') + '<i>♥</i>' + v(d, 'b') + '</div></div>'
      );
    }
  };

  var T_LOVE_DAYS = {
    id: 'love-days', cat: 'love', name: '恋爱天数', desc: '竖版 · 自动算天数 · 每天换一张',
    w: 54, h: 86, shape: 'rect', radius: 4,
    countFrom: 'since',
    fields: ['a', 'b', 'since', 'note'],
    demo: { a: '林知远', b: '小林', since: '2023.05.20', note: '还在，还爱，还想继续。' },
    front: function (d) {
      var n = d.__days == null ? '—' : String(d.__days);
      return (
        '<div class="card t-lovedays"><div class="ld-glow"></div>' +
        '<div class="ld-top"><span class="lbl">TOGETHER FOR</span><span class="mono">SINCE ' + v(d, 'since') + '</span></div>' +
        '<div class="ld-num' + (n.length > 4 ? ' is-long' : '') + '">' + n + '</div>' +
        '<div class="ld-unit">DAYS</div>' +
        '<div class="ld-names"><b>' + v(d, 'a') + '</b><i>♥</i><b>' + v(d, 'b') + '</b></div>' +
        '<div class="ld-note">' + v(d, 'note') + '</div>' +
        '<div class="ld-foot">每一天都算数</div></div>'
      );
    },
    back: function (d) {
      var n = d.__days == null ? '—' : String(d.__days);
      return (
        '<div class="card t-lovedays t-lovedays-back"><div class="ld-glow"></div>' +
        '<div class="ld-bk-kicker">' + v(d, 'since') + ' 至今</div>' +
        '<div class="ld-bk-text">和你在一起之后，<br>普通的日子也值得截图。</div>' +
        '<div class="ld-bk-sign">' + v(d, 'a') + ' &amp; ' + v(d, 'b') + '</div>' +
        '<div class="ld-bk-days">' + n + ' DAYS</div></div>'
      );
    }
  };

  var T_LONGDIST = {
    id: 'love-longdist', cat: 'love', name: '异地恋时区卡', desc: '横版 · 两座城市 · 同一轮月亮',
    w: 90, h: 54, shape: 'rect', radius: 3,
    fields: ['a', 'b', 'cityA', 'cityB', 'next', 'note'],
    demo: { a: '林知远', b: '小林', cityA: '上海', cityB: '伦敦', next: '12.24', note: '隔着 8 小时时差，和同一轮月亮。' },
    front: function (d) {
      return (
        '<div class="card t-longdist"><div class="ldist-stars"></div><div class="ldist-arc"></div>' +
        '<div class="ldist-top"><span class="lbl">LONG DISTANCE</span><span class="mono">NEXT MEET</span></div>' +
        '<div class="ldist-cities">' +
        '<div class="ldist-city"><b>' + v(d, 'cityA') + '</b><span class="mono">UTC +8</span></div>' +
        '<div class="ldist-link"><i>✈</i></div>' +
        '<div class="ldist-city is-right"><b>' + v(d, 'cityB') + '</b><span class="mono">UTC +0</span></div>' +
        '</div>' +
        '<div class="ldist-mid">' + v(d, 'a') + '<i>×</i>' + v(d, 'b') + '</div>' +
        '<div class="ldist-next"><span class="lbl">下次见面</span><b>' + v(d, 'next') + '</b></div>' +
        '<div class="ldist-note">' + v(d, 'note') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-longdist t-longdist-back"><div class="ldist-stars"></div>' +
        '<div class="ldist-bk-mark">✧</div>' +
        '<div class="ldist-bk-text">距离不是问题，<br>不能抱到你才是。</div>' +
        '<div class="ldist-bk-rows"><span>' + v(d, 'cityA') + '</span><i>—</i><span>' + v(d, 'cityB') + '</span></div>' +
        '<div class="ldist-bk-sign">' + v(d, 'b') + ' 等 ' + v(d, 'a') + ' 回来</div></div>'
      );
    }
  };

  // ============================================================
  // 恶搞
  // ============================================================

  var T_FUN_GOODCARD = {
    id: 'fun-goodcard', cat: 'persona', name: '好人卡', desc: '横版 · 体面拒绝 · 一卡封神',
    w: 90, h: 54, shape: 'rect', radius: 3,
    fields: ['to', 'reason', 'from', 'date'],
    demo: { to: '你', reason: '你人真的很好，但我还不想谈恋爱。', from: '一个不想负责的人', date: '2026.10' },
    front: function (d) {
      return (
        '<div class="card t-goodcard"><div class="gc-stripe"></div><div class="gc-glow"></div>' +
        '<div class="gc-top"><span class="lbl">FRIEND ZONE PASS</span><span class="mono">NO. 0001</span></div>' +
        '<div class="gc-main"><div class="gc-big">好人卡</div>' +
        '<div class="gc-to">致 <b>' + v(d, 'to') + '</b></div>' +
        '<div class="gc-reason">' + v(d, 'reason') + '</div></div>' +
        '<div class="gc-seal">婉<br>拒</div>' +
        '<div class="gc-foot"><span>签发人 · ' + v(d, 'from') + '</span><span class="mono">' + v(d, 'date') + '</span></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-goodcard t-goodcard-back"><div class="gc-stripe"></div>' +
        '<div class="gc-bk-title">使用须知</div>' +
        '<div class="gc-bk-list">' +
        '<p><b>01</b> 本卡一经发出，不可撤回。</p>' +
        '<p><b>02</b> 持卡人仍可享受节日问候服务。</p>' +
        '<p><b>03</b> 若对方回头，请自行作废。</p></div>' +
        '<div class="gc-bk-sign">' + v(d, 'to') + ' 收 · ' + v(d, 'date') + '</div></div>'
      );
    }
  };

  var T_FUN_MENTAL = {
    id: 'fun-mental', cat: 'persona', name: '精神状态鉴定书', desc: '竖版 · 医院诊断单 · 建议观察',
    w: 54, h: 86, shape: 'rect', radius: 2.4,
    fields: ['name', 'state', 'level', 'date'],
    demo: { name: '林知远', state: '间歇性想开了，持续性想不开', level: '中度 · 建议多睡觉', date: '2026.10.19' },
    front: function (d) {
      return (
        '<div class="card t-mental"><div class="mn-grid"></div>' +
        '<div class="mn-head"><span class="mn-cross">✚</span>' +
        '<div><b>精神状态鉴定书</b><span>MENTAL STATUS REPORT</span></div></div>' +
        '<div class="mn-rule"></div>' +
        '<div class="mn-row"><span class="lbl">姓名</span><b>' + v(d, 'name') + '</b></div>' +
        '<div class="mn-row"><span class="lbl">主诉</span><b>' + v(d, 'state') + '</b></div>' +
        '<div class="mn-row"><span class="lbl">程度</span><b>' + v(d, 'level') + '</b></div>' +
        '<div class="mn-conclusion"><span class="lbl">医嘱</span><p>少想一点，多睡一点。<br>实在不行，就点杯奶茶。</p></div>' +
        '<div class="mn-sign">医师签名 <i>×××</i></div>' +
        '<div class="mn-foot mono">' + v(d, 'date') + ' · NO. 2026</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-mental t-mental-back"><div class="mn-grid"></div>' +
        '<div class="mn-bk-kicker">复诊记录</div>' +
        '<div class="mn-bk-rows">' +
        '<div><span>上周</span><b>说好早睡，凌晨两点还在刷</b></div>' +
        '<div><span>这周</span><b>把头像换成了「勿扰」</b></div>' +
        '<div><span>下周</span><b>大概还是这样</b></div></div>' +
        '<div class="mn-bk-stamp">继续观察</div>' +
        '<div class="mn-foot mono">' + v(d, 'name') + '</div></div>'
      );
    }
  };

  var T_FUN_IOU = {
    id: 'fun-iou', cat: 'persona', name: '欠条', desc: '横版 · 手写便签 · 赖不掉',
    w: 90, h: 54, shape: 'rect', radius: 2.4,
    fields: ['from', 'to', 'item', 'count', 'date'],
    demo: { from: '林知远', to: '小林', item: '一顿火锅', count: '×1', date: '2026.10' },
    front: function (d) {
      return (
        '<div class="card t-iou"><div class="iu-lines"></div><div class="iu-hole"></div>' +
        '<div class="iu-top"><span class="lbl">I.O.U.</span><span class="mono">' + v(d, 'date') + '</span></div>' +
        '<div class="iu-title">欠 条</div>' +
        '<div class="iu-body">今欠 <b>' + v(d, 'to') + '</b> <em>' + v(d, 'item') + '</em> <b>' + v(d, 'count') + '</b>，<br>说好了要还，不许装忘记。</div>' +
        '<div class="iu-hint">逾期不还，按饭局利息计算。</div>' +
        '<div class="iu-foot"><span>欠款人 <b>' + v(d, 'from') + '</b></span><span class="iu-stamp">赖不掉</span></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-iou t-iou-back"><div class="iu-lines"></div>' +
        '<div class="iu-bk-title">还款记录</div>' +
        '<div class="iu-bk-rows"><div><span>第一期</span><b>已还 · 一杯奶茶</b></div>' +
        '<div><span>第二期</span><b>待还 · 一顿火锅</b></div>' +
        '<div><span>利息</span><b>再请一次</b></div></div>' +
        '<div class="iu-bk-sign">' + v(d, 'from') + ' → ' + v(d, 'to') + '</div></div>'
      );
    }
  };

  // ============================================================
  // 毛孩子 / 票根
  // ============================================================

  var T_PET_SHIFT = {
    id: 'pet-shift', cat: 'pet', name: '宠物工时表', desc: '横版 · 打卡上班 · 罐头结算',
    w: 90, h: 54, shape: 'rect', radius: 3,
    fields: ['pet', 'job', 'hours', 'salary', 'note'],
    demo: { pet: '团子', job: '家庭氛围组组长', hours: '全天待命 · 随时下班', salary: '罐头 ×2 / 天', note: '主要工作：睡觉、监视人类、假装听不懂。' },
    front: function (d) {
      return (
        '<div class="card t-petshift"><div class="pst-paws"></div>' +
        '<div class="pst-top"><span class="lbl">PET SHIFT SCHEDULE</span><span class="mono">WEEK 01</span></div>' +
        '<div class="pst-name">' + v(d, 'pet') + '</div>' +
        '<div class="pst-job">' + v(d, 'job') + '</div>' +
        '<div class="pst-rows">' +
        '<div><span>工时</span><b>' + v(d, 'hours') + '</b></div>' +
        '<div><span>薪资</span><b>' + v(d, 'salary') + '</b></div></div>' +
        '<div class="pst-meter"><i></i></div>' +
        '<div class="pst-meter-tip lbl">今日营业进度 · 80%</div>' +
        '<div class="pst-note">' + v(d, 'note') + '</div>' +
        '<div class="pst-stamp">在岗</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-petshift t-petshift-back"><div class="pst-paws"></div>' +
        '<div class="pst-bk-title">本周考勤</div>' +
        '<div class="pst-bk-grid">' +
        '<i class="on">一</i><i class="on">二</i><i class="on">三</i><i>四</i><i class="on">五</i><i>六</i><i>日</i>' +
        '</div>' +
        '<div class="pst-bk-note">缺勤原因：晒太阳太忙。</div>' +
        '<div class="pst-bk-sign">' + v(d, 'pet') + ' 的直属领导</div></div>'
      );
    }
  };

  var T_CINEMA = {
    id: 'merch-cinema', cat: 'merch', name: '电影票根', desc: '竖版 · 撕口 · 看完就发',
    w: 54, h: 86, shape: 'rect', radius: 2,
    fields: ['movie', 'date', 'time', 'seat', 'cinema', 'note'],
    demo: { movie: '爱在黎明破晓前', date: '2026.10.02', time: '19:40', seat: '7 排 8 座', cinema: 'LUMEN CINEMA · 3 号厅', note: '散场之后，在门口站了很久。' },
    front: function (d) {
      return (
        '<div class="card t-cinema"><div class="ci-holes"></div><div class="ci-glow"></div>' +
        '<div class="ci-top"><span class="lbl">ADMIT ONE</span><span class="mono">NO. 0823</span></div>' +
        '<div class="ci-movie">' + v(d, 'movie') + '</div>' +
        '<div class="ci-cinema">' + v(d, 'cinema') + '</div>' +
        '<div class="ci-meta">' +
        '<div><span class="lbl">DATE</span><b class="mono">' + v(d, 'date') + '</b></div>' +
        '<div><span class="lbl">TIME</span><b class="mono">' + v(d, 'time') + '</b></div>' +
        '<div><span class="lbl">SEAT</span><b class="mono">' + v(d, 'seat') + '</b></div>' +
        '</div>' +
        '<div class="ci-tear"></div>' +
        '<div class="ci-bars"></div>' +
        '<div class="ci-note">' + v(d, 'note') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-cinema t-cinema-back"><div class="ci-holes"></div><div class="ci-glow"></div>' +
        '<div class="ci-bk-kicker">AFTER THE MOVIE</div>' +
        '<div class="ci-bk-text">「电影会散场，<br>但今晚不会。」</div>' +
        '<div class="ci-bk-sign">' + v(d, 'date') + ' · ' + v(d, 'time') + '</div>' +
        '<div class="ci-bk-mark mono">' + v(d, 'movie') + '</div></div>'
      );
    }
  };

  var T_FUN_AURA = {
    id: 'fun-aura', cat: 'persona', name: '朋友圈人设', desc: '横版 · 大字标签 · 社交画像',
    w: 90, h: 54, shape: 'rect', radius: 4,
    fields: ['name', 'tags', 'note', 'handle'],
    demo: { name: '小林', tags: 'i 人 / 熟了很吵 / 已读乱回', note: '在线，但不一定回。', handle: '@lumen' },
    front: function (d) {
      return (
        '<div class="card t-aura"><div class="au-grid"></div><div class="au-blob"></div>' +
        '<div class="au-top"><span class="au-pill">MY VIBE</span><span class="mono">' + v(d, 'handle') + '</span></div>' +
        '<div class="au-name">' + v(d, 'name') + '</div>' +
        '<div class="au-tags">' + String(d.tags || '').split(/[\/,，、]/).filter(function (t) {
          return t.trim();
        }).map(function (t) {
          return '<span>' + esc(t.trim()) + '</span>';
        }).join('') + '</div>' +
        '<div class="au-note">' + v(d, 'note') + '</div>' +
        '<div class="au-foot"><span class="au-like">♡ 已赞</span><span class="lbl">NO CAP</span></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-aura t-aura-back"><div class="au-grid"></div>' +
        '<div class="au-bk-title">人设补充</div>' +
        '<div class="au-bk-tags">' + String(d.tags || '').split(/[\/,，、]/).map(function (t) {
          return '<span>#' + esc(t.trim()) + '</span>';
        }).join('') + '</div>' +
        '<div class="au-bk-note">' + v(d, 'note') + '</div>' +
        '<div class="au-bk-sign mono">' + v(d, 'handle') + '</div></div>'
      );
    }
  };

  var T_FUN_TAROT = {
    id: 'fun-tarot', cat: 'persona', name: '今日玄学', desc: '竖版 · 抽签 · 运势卡',
    w: 54, h: 86, shape: 'rect', radius: 5,
    fields: ['name', 'fortune', 'note', 'date'],
    demo: { name: '小林', fortune: '大 吉', note: '适合翘掉不重要的会，去晒十分钟太阳。', date: '2026.10.19' },
    front: function (d) {
      return (
        '<div class="card t-tarot"><div class="tt-stars"></div><div class="tt-frame"></div>' +
        '<div class="tt-top"><span class="lbl">DAILY ORACLE</span><span class="mono">' + v(d, 'date') + '</span></div>' +
        '<div class="tt-sun">☼</div>' +
        '<div class="tt-fortune">' + v(d, 'fortune') + '</div>' +
        '<div class="tt-name">' + v(d, 'name') + '</div>' +
        '<div class="tt-note">' + v(d, 'note') + '</div>' +
        '<div class="tt-foot">仅供娱乐 · 别太当真</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-tarot t-tarot-back"><div class="tt-stars"></div><div class="tt-frame"></div>' +
        '<div class="tt-bk-mark">✦</div>' +
        '<div class="tt-bk-title">今日宜 / 忌</div>' +
        '<div class="tt-bk-rows">' +
        '<div><span>宜</span><b>发呆 · 撸猫 · 拒绝</b></div>' +
        '<div><span>忌</span><b>回工作消息 · 做重大决定</b></div>' +
        '<div><span>幸运色</span><b>荧光绿</b></div></div>' +
        '<div class="tt-bk-note">' + v(d, 'note') + '</div></div>'
      );
    }
  };

  var T_FUN_DORM = {
    id: 'fun-dorm', cat: 'social', name: '宿舍床位牌', desc: '横版 · 便利贴 · 门后贴一张',
    w: 90, h: 54, shape: 'rect', radius: 3,
    fields: ['name', 'room', 'bed', 'note'],
    demo: { name: '阿远', room: '302', bed: '下铺 · 靠窗', note: '打呼轻一点，谢谢' },
    front: function (d) {
      return (
        '<div class="card t-dorm"><div class="dm-lines"></div><div class="dm-tape"></div>' +
        '<div class="dm-top"><span class="lbl">ROOM</span><span class="dm-room mono">' + v(d, 'room') + '</span></div>' +
        '<div class="dm-name">' + v(d, 'name') + '</div>' +
        '<div class="dm-bed">' + v(d, 'bed') + '</div>' +
        '<div class="dm-note">' + v(d, 'note') + '</div>' +
        '<div class="dm-foot">请勿在凌晨两点外放</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-dorm t-dorm-back"><div class="dm-lines"></div>' +
        '<div class="dm-bk-title">宿舍公约</div>' +
        '<div class="dm-bk-list"><p>01 谁最后一个上床谁关灯</p><p>02 外卖到了在群里喊一声</p><p>03 可以借洗发水，但要还</p></div>' +
        '<div class="dm-bk-sign">' + v(d, 'name') + ' · ' + v(d, 'room') + '</div></div>'
      );
    }
  };

  var T_FUN_SQUAD = {
    id: 'fun-squad', cat: 'social', name: '社团成员卡', desc: '竖版 · 剪报拼贴 · 乐队 / 社团',
    w: 54, h: 86, shape: 'rect', radius: 3,
    fields: ['name', 'role', 'group', 'tags', 'photo'],
    demo: { name: '阿远', role: '吉他 / 副唱', group: '深夜排练室', tags: '朋克, 后摇, 排练迟到' },
    front: function (d) {
      return (
        '<div class="card t-squad"><div class="sq-crop"></div><div class="sq-photo">' +
        photo(d, 'sq-ph', String(d.name || 'L').slice(0, 1)) + '</div>' +
        '<div class="sq-shade"></div>' +
        '<div class="sq-top"><span class="sq-stamp">MEMBER</span><span class="mono">NO.07</span></div>' +
        '<div class="sq-group">' + v(d, 'group') + '</div>' +
        '<div class="sq-name">' + v(d, 'name') + '</div>' +
        '<div class="sq-role">' + v(d, 'role') + '</div>' +
        '<div class="sq-tags">' + tags(d, 'tags', 'sq-tag') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-squad t-squad-back"><div class="sq-crop"></div>' +
        '<div class="sq-bk-title">' + v(d, 'group') + '</div>' +
        '<div class="sq-bk-name">' + v(d, 'name') + '<span>' + v(d, 'role') + '</span></div>' +
        '<div class="sq-bk-rule"></div>' +
        '<div class="sq-bk-tags">' + tags(d, 'tags', 'sq-tag') + '</div>' +
        '<div class="sq-bk-note">排练迟到是传统艺能</div></div>'
      );
    }
  };

  var T_FUN_BANNER = {
    id: 'fun-banner', cat: 'fan', name: '应援手幅', desc: '横版 · 大字口号 · 举起来',
    w: 90, h: 54, shape: 'rect', radius: 2,
    fields: ['name', 'slogan', 'group'],
    demo: { name: '小林', slogan: '你只管发光', group: 'LUMEN 2026' },
    front: function (d) {
      return (
        '<div class="card t-banner"><div class="bn-stripe"></div><div class="bn-glow"></div>' +
        '<div class="bn-stars">✦ ✧ ✦</div>' +
        '<div class="bn-slogan">' + v(d, 'slogan') + '</div>' +
        '<div class="bn-name">' + v(d, 'name') + '</div>' +
        '<div class="bn-foot"><span>' + v(d, 'group') + '</span><span class="mono">HAND BANNER</span></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-banner t-banner-back"><div class="bn-stripe"></div>' +
        '<div class="bn-bk-heart">♡</div>' +
        '<div class="bn-bk-text">' + v(d, 'slogan') + '</div>' +
        '<div class="bn-bk-name">' + v(d, 'name') + ' · ' + v(d, 'group') + '</div></div>'
      );
    }
  };

  var T_FUN_PETSTAFF = {
    id: 'fun-petstaff', cat: 'pet', name: '铲屎官证', desc: '横版 · 玩梗证件 · 持证上岗',
    w: 85.6, h: 54, shape: 'rect', radius: 3,
    fields: ['name', 'pet', 'since', 'duty'],
    demo: { name: '阿远', pet: '团子 / 英短', since: '2023.05', duty: '铲屎 · 投喂 · 挨打' },
    front: function (d) {
      return (
        '<div class="card t-petstaff"><div class="ps-paws"></div><div class="ps-band"></div>' +
        '<div class="ps-head"><span class="lbl">PET STAFF LICENSE</span><span class="mono">NO.0001</span></div>' +
        '<div class="ps-title">铲屎官证</div>' +
        '<div class="ps-name">' + v(d, 'name') + '</div>' +
        '<div class="ps-rows"><div><span>服务对象</span><b>' + v(d, 'pet') + '</b></div>' +
        '<div><span>上岗时间</span><b class="mono">' + v(d, 'since') + '</b></div>' +
        '<div><span>岗位职责</span><b>' + v(d, 'duty') + '</b></div></div>' +
        '<div class="ps-seal">喵<br>已阅</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-petstaff t-petstaff-back"><div class="ps-paws"></div>' +
        '<div class="ps-bk-title">持证须知</div>' +
        '<div class="ps-bk-text">一、猫是老板，你是员工。<br>二、凌晨跑酷不得阻拦。<br>三、被踩醒也要说早安。</div>' +
        '<div class="ps-bk-sign">' + v(d, 'pet') + ' 的专属人类 · ' + v(d, 'name') + '</div></div>'
      );
    }
  };

  var T_FUN_FESTIVAL = {
    id: 'fun-festival', cat: 'merch', name: '音乐节纪念卡', desc: '竖版 · 票根 · 打孔',
    w: 54, h: 86, shape: 'rect', radius: 2,
    fields: ['name', 'fest', 'date', 'note'],
    demo: { name: '林知远', fest: '草莓音乐节', date: '2026.10.02', note: '第一天，嗓子已经废了' },
    front: function (d) {
      return (
        '<div class="card t-festival"><div class="fv-holes"></div><div class="fv-lines"></div>' +
        '<div class="fv-top"><span class="lbl">ADMIT ONE</span><span class="mono">' + v(d, 'date') + '</span></div>' +
        '<div class="fv-fest">' + v(d, 'fest') + '</div>' +
        '<div class="fv-rule"></div>' +
        '<div class="fv-row"><span class="lbl">NAME</span><b>' + v(d, 'name') + '</b></div>' +
        '<div class="fv-row"><span class="lbl">NOTE</span><b>' + v(d, 'note') + '</b></div>' +
        '<div class="fv-bars"></div>' +
        '<div class="fv-foot">NO REFUND · NO REGRET</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-festival t-festival-back"><div class="fv-holes"></div><div class="fv-lines"></div>' +
        '<div class="fv-bk-title">现场记录</div>' +
        '<div class="fv-bk-rows"><div><span>最爱的舞台</span><b>主舞台 · 日落场</b></div>' +
        '<div><span>买到的东西</span><b>一件 T 恤、两根荧光棒</b></div>' +
        '<div><span>下次还来</span><b>来</b></div></div>' +
        '<div class="fv-bk-mark mono">' + v(d, 'fest') + '</div></div>'
      );
    }
  };

  /* ---------------- 名片场景 ---------------- */

  var T_CARD_PET = {
    id: 'card-pet', cat: 'card', name: '宠物名片', desc: '横版 · 大头照 · 遛狗递一张',
    w: 90, h: 54, shape: 'rect', radius: 4,
    fields: ['name', 'breed', 'note', 'handle', 'photo'],
    demo: { name: '团子', breed: '英短 · 3 岁 · 5.2kg', note: '社恐，但对零食很热情', handle: '@tuanzi.cat' },
    front: function (d) {
      return (
        '<div class="card t-cardpet"><div class="cp-blob"></div>' +
        '<div class="cp-photo">' + photo(d, 'cp-ph', String(d.name || '宠').slice(0, 1)) + '</div>' +
        '<div class="cp-body">' +
        '<div class="cp-tag">MY PET</div>' +
        '<div class="cp-name">' + v(d, 'name') + '</div>' +
        '<div class="cp-breed">' + v(d, 'breed') + '</div>' +
        '<div class="cp-note">' + v(d, 'note') + '</div>' +
        '<div class="cp-foot"><span class="mono">' + v(d, 'handle') + '</span><span class="cp-paw">🐾</span></div>' +
        '</div><div class="cp-edge"></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-cardpet t-cardpet-back"><div class="cp-blob"></div>' +
        '<div class="cp-bk-title">关于 ' + v(d, 'name') + '</div>' +
        '<div class="cp-bk-rows"><div><span>最爱</span><b>冻干、纸箱、你的键盘</b></div>' +
        '<div><span>最怕</span><b>吸尘器、洗澡、关门</b></div>' +
        '<div><span>技能</span><b>凌晨三点跑酷</b></div></div>' +
        '<div class="cp-bk-sign mono">' + v(d, 'handle') + '</div></div>'
      );
    }
  };

  var T_CARD_SOCIAL = {
    id: 'card-social-new', cat: 'card', name: '社交名片', desc: '竖版 · 大头像 · 见面扫码',
    w: 54, h: 86, shape: 'rect', radius: 5,
    fields: ['name', 'handle', 'tags', 'site', 'qr', 'photo'],
    demo: { name: '小林', handle: '@lumen', tags: '拍照, 露营, 咖啡', site: 'lumen.studio' },
    front: function (d) {
      return (
        '<div class="card t-cardsocial"><div class="cs-dots"></div>' +
        '<div class="cs-top"><span class="lbl">NICE TO MEET</span><span class="mono">2026</span></div>' +
        '<div class="cs-photo">' + photo(d, 'cs-ph', String(d.name || 'L').slice(0, 1)) + '</div>' +
        '<div class="cs-name">' + v(d, 'name') + '</div>' +
        '<div class="cs-handle mono">' + v(d, 'handle') + '</div>' +
        '<div class="cs-tags">' + tags(d, 'tags', 'cs-chip') + '</div>' +
        '<div class="cs-bottom"><div class="cs-qr">' + qr(d, '') + '</div>' +
        '<div class="cs-site"><b class="lbl">FIND ME</b><span class="mono">' + v(d, 'site') + '</span></div></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-cardsocial t-cardsocial-back"><div class="cs-dots"></div>' +
        '<div class="cs-bk-qr">' + qr(d, '') + '</div>' +
        '<div class="cs-bk-tip">扫码认识一下</div>' +
        '<div class="cs-bk-tags">' + tags(d, 'tags', 'cs-chip') + '</div>' +
        '<div class="cs-bk-mark mono">' + v(d, 'site') + '</div></div>'
      );
    }
  };

  var T_CARD_GAME = {
    id: 'card-game', cat: 'card', name: '游戏名片', desc: '横版 · 段位徽章 · 找队友',
    w: 85.6, h: 54, shape: 'rect', radius: 4,
    fields: ['name', 'rank', 'role', 'hours', 'id', 'qr'],
    demo: { name: 'LUMEN', rank: '不朽 II', role: '决斗位 · 主玩捷风', hours: '晚 8 点后在线', id: 'PLAYER#0823' },
    front: function (d) {
      return (
        '<div class="card t-cardgame"><div class="cg-glow"></div><div class="cg-lines"></div>' +
        '<div class="cg-top"><span class="lbl">PLAYER CARD</span><span class="mono">' + v(d, 'id') + '</span></div>' +
        '<div class="cg-main"><div class="cg-name">' + v(d, 'name') + '</div>' +
        '<div class="cg-rank">' + v(d, 'rank') + '</div>' +
        '<div class="cg-role">' + v(d, 'role') + '</div></div>' +
        '<div class="cg-hour"><i></i><span class="mono">' + v(d, 'hours') + '</span></div>' +
        '<div class="cg-qr">' + qr(d, '') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-cardgame t-cardgame-back"><div class="cg-glow"></div><div class="cg-lines"></div>' +
        '<div class="cg-bk-title">开黑吗</div>' +
        '<div class="cg-bk-id mono">' + v(d, 'id') + '</div>' +
        '<div class="cg-bk-qr">' + qr(d, '') + '</div>' +
        '<div class="cg-bk-tip">扫码加好友 · ' + v(d, 'hours') + '</div></div>'
      );
    }
  };

  var T_CARD_DEV = {
    id: 'card-dev', cat: 'card', name: '开发者名片', desc: '横版 · 终端窗口 · 技术栈',
    w: 90, h: 54, shape: 'rect', radius: 4,
    fields: ['name', 'role', 'stack', 'site', 'email', 'qr'],
    demo: { name: '小林', role: '前端 / 独立开发', stack: 'TypeScript, React, Node', site: 'github.com/lumen', email: 'hi@lumen.dev' },
    front: function (d) {
      return (
        '<div class="card t-carddev"><div class="cd-bar"><i></i><i></i><i></i><span class="mono">~/hello</span></div>' +
        '<div class="cd-body">' +
        '<div class="cd-line"><span class="cd-prompt">$</span><span class="cd-cmd mono">whoami</span></div>' +
        '<div class="cd-name">' + v(d, 'name') + '</div>' +
        '<div class="cd-role">' + v(d, 'role') + '</div>' +
        '<div class="cd-line"><span class="cd-prompt">$</span><span class="cd-cmd mono">cat stack.txt</span></div>' +
        '<div class="cd-tags">' + tags(d, 'stack', 'cd-chip') + '</div>' +
        '<div class="cd-foot mono"><span>' + v(d, 'site') + '</span><span>' + v(d, 'email') + '</span></div>' +
        '</div><div class="cd-qr">' + qr(d, '') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-carddev t-carddev-back"><div class="cd-bar"><i></i><i></i><i></i><span class="mono">~/contact</span></div>' +
        '<div class="cd-bk-body">' +
        '<div class="cd-line"><span class="cd-prompt">$</span><span class="cd-cmd mono">./say-hi.sh</span></div>' +
        '<div class="cd-bk-text">有想法就聊，<br>不用先想清楚需求。</div>' +
        '<div class="cd-bk-rows mono"><span>' + v(d, 'email') + '</span><span>' + v(d, 'site') + '</span></div>' +
        '</div><div class="cd-bk-qr">' + qr(d, '') + '</div></div>'
      );
    }
  };

  var T_CARD_PHOTO = {
    id: 'card-photo', cat: 'card', name: '摄影师名片', desc: '竖版 · 作品满幅 · 约拍',
    w: 54, h: 86, shape: 'rect', radius: 3,
    fields: ['name', 'specialty', 'handle', 'photo'],
    demo: { name: '小林', specialty: '人像 / 胶片 / 婚礼跟拍', handle: '@lumen.shot' },
    front: function (d) {
      return (
        '<div class="card t-cardphoto">' +
        '<div class="cph-photo">' + photo(d, 'cph-ph', String(d.name || 'L').slice(0, 1)) + '</div>' +
        '<div class="cph-shade"></div>' +
        '<div class="cph-top"><span class="cph-badge">OPEN FOR BOOKING</span></div>' +
        '<div class="cph-bottom"><div class="cph-name">' + v(d, 'name') + '</div>' +
        '<div class="cph-spec">' + v(d, 'specialty') + '</div>' +
        '<div class="cph-handle mono">' + v(d, 'handle') + '</div></div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-cardphoto t-cardphoto-back">' +
        '<div class="cph-bk-frame"></div>' +
        '<div class="cph-bk-title">拍摄流程</div>' +
        '<div class="cph-bk-rows"><div><b>01</b><span>聊聊想拍什么</span></div>' +
        '<div><b>02</b><span>定时间与场地</span></div>' +
        '<div><b>03</b><span>出片，一起挑</span></div></div>' +
        '<div class="cph-bk-mark mono">' + v(d, 'handle') + '</div></div>'
      );
    }
  };

  var T_CARD_MUSIC = {
    id: 'card-music', cat: 'card', name: '音乐人名片', desc: '横版 · 声波 · 演出联络',
    w: 90, h: 54, shape: 'rect', radius: 4,
    fields: ['name', 'genre', 'role', 'site', 'qr'],
    demo: { name: '小林', genre: '独立 / 后摇 / 电子', role: '吉他 · 编曲', site: '@lumen.band' },
    front: function (d) {
      return (
        '<div class="card t-cardmusic"><div class="cm-wave"></div><div class="cm-glow"></div>' +
        '<div class="cm-top"><span class="lbl">ARTIST CARD</span><span class="mono">SIDE A</span></div>' +
        '<div class="cm-name">' + v(d, 'name') + '</div>' +
        '<div class="cm-genre">' + v(d, 'genre') + '</div>' +
        '<div class="cm-role">' + v(d, 'role') + '</div>' +
        '<div class="cm-foot"><span class="mono">' + v(d, 'site') + '</span><span class="cm-dot">●</span></div>' +
        '<div class="cm-qr">' + qr(d, '') + '</div></div>'
      );
    },
    back: function (d) {
      return (
        '<div class="card t-cardmusic t-cardmusic-back"><div class="cm-wave"></div><div class="cm-glow"></div>' +
        '<div class="cm-bk-title">来找我们演出</div>' +
        '<div class="cm-bk-text">' + v(d, 'genre') + '</div>' +
        '<div class="cm-bk-qr">' + qr(d, '') + '</div>' +
        '<div class="cm-bk-mark mono">' + v(d, 'site') + '</div></div>'
      );
    }
  };

  var LIST = [
    T_CARD_SOCIAL, T_CARD_PET, T_CARD_GAME, T_CARD_DEV, T_CARD_PHOTO, T_CARD_MUSIC,
    T_DEV_PROFILE, T_NEON_GLASS, T_HOME_CARD, T_NFC_CARD,
    T_FUN_AURA, T_FUN_MBTI, T_FUN_TAROT, T_FUN_MOOD, T_FUN_SLACKER, T_FUN_NIUNIU,
    T_FUN_SINGLE, T_FUN_NIGHTOWL, T_FUN_SCRIPT, T_FUN_BIRTHDAY,
    T_FUN_GOODCARD, T_FUN_MENTAL, T_FUN_IOU,
    T_FUN_BUDDY, T_FUN_DORM, T_FUN_SQUAD, T_FUN_GAME, T_CONTACT_SOCIAL,
    T_LOVE_PACT, T_LOVE_DAYS, T_LONGDIST,
    T_FUN_FAN, T_FUN_IDOL, T_FUN_BANNER,
    T_TAG_PET, T_FUN_PETID, T_FUN_PETSTAFF, T_TAG_KID, T_PET_SHIFT,
    T_ID_LANYARD, T_ID_STUDENT,
    T_MAGIC_OFFER, T_MAGIC_ID, T_HERO_CARD, T_PARALLEL, T_AGENT, T_STARFLEET, T_TCG,
    T_FUN_STICKER, T_LABEL_GOODS, T_FUN_FESTIVAL, T_TAG_LUGGAGE, T_CINEMA
  ];

  var MAP = {};
  for (var i = 0; i < LIST.length; i++) MAP[LIST[i].id] = LIST[i];

  global.CardTemplates = {
    PXMM: PXMM,
    CATS: CATS,
    list: LIST,
    get: function (id) { return MAP[id] || LIST[0]; },
    render: function (tpl, side, d) {
      var html = side === 'back' && tpl.back ? tpl.back(d) : tpl.front(d);
      // 横版大片幅的基准字号偏小，统一放大一档，避免整张卡看起来空
      if (tpl.w >= 80) html = html.replace('<div class="card ', '<div class="card is-wide ');
      return html;
    }
  };
})(window);
