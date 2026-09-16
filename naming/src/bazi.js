/* 生辰八字 · 轻量本地排盘
 *
 * 公历 →（农历展示）→ 四柱干支 → 五行统计 → 宜补五行。
 * 年柱以立春为界，月柱以「节」为界；日柱用固定锚点推干支。
 * 不做完整旺衰/大运，只服务取名「缺什么补什么」。
 */
(function () {
  var NM = (window.NM = window.NM || {});

  var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var WX = ['木', '火', '土', '金', '水'];
  var GAN_WX = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
  /* 地支本气 */
  var ZHI_WX = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];
  var ZHI_HIDDEN = {
    子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
    辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
    申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲']
  };

  /* 意象域 → 五行（取名加权用） */
  NM.DOMAIN_WX = {
    water: '水', wood: '木', fire: '火', earth: '土', sky: '金',
    gift: '土', mind: '火', quiet: '水', sound: '金', beast: '木',
    bright: '火', com: ''
  };
  NM.domainWx = function (dom) { return NM.DOMAIN_WX[dom] || ''; };

  /* 农历年数据 1900–2100（经典压缩表：闰月 / 每月大小） */
  var LUNAR = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252,
    0x0d520
  ];

  /* 1900 起各节气相对基准的分钟偏移（寿星天文历简化表） */
  var TERM_MIN = [
    0, 21208, 42467, 63836, 85337, 107014, 128867, 150921,
    173149, 195551, 218072, 240693, 263343, 285989, 308563, 331033,
    353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758
  ];
  var TERM_BASE = Date.UTC(1900, 0, 6, 2, 5);

  function termDate(y, n) {
    var ms = 31556925974.7 * (y - 1900) + TERM_MIN[n] * 60000;
    var d = new Date(TERM_BASE + ms);
    return {
      y: d.getUTCFullYear(),
      m: d.getUTCMonth() + 1,
      d: d.getUTCDate(),
      h: d.getUTCHours()
    };
  }

  function ymdNum(y, m, d) { return y * 10000 + m * 100 + d; }

  function leapMonth(y) { return LUNAR[y - 1900] & 0xf; }
  function leapDays(y) {
    if (leapMonth(y)) return (LUNAR[y - 1900] & 0x10000) ? 30 : 29;
    return 0;
  }
  function monthDays(y, m) {
    return (LUNAR[y - 1900] & (0x10000 >> m)) ? 30 : 29;
  }
  function yearDays(y) {
    var i, sum = 348;
    for (i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR[y - 1900] & i) ? 1 : 0;
    return sum + leapDays(y);
  }

  /* 公历 → 农历（展示用） */
  function solarToLunar(y, m, d) {
    if (y < 1900 || y > 2100) return null;
    var base = Date.UTC(1900, 0, 31);
    var target = Date.UTC(y, m - 1, d);
    var offset = Math.round((target - base) / 86400000);
    var i, temp, leap = 0, isLeap = false;
    for (i = 1900; i < 2101 && offset > 0; i++) {
      temp = yearDays(i);
      offset -= temp;
    }
    if (offset < 0) { offset += temp; i--; }
    var ly = i;
    leap = leapMonth(ly);
    for (i = 1; i < 13 && offset > 0; i++) {
      if (leap > 0 && i === leap + 1 && !isLeap) {
        --i; isLeap = true; temp = leapDays(ly);
      } else {
        temp = monthDays(ly, i);
      }
      if (isLeap && i === leap + 1) isLeap = false;
      offset -= temp;
    }
    if (offset === 0 && leap > 0 && i === leap + 1) {
      if (isLeap) isLeap = false;
      else { isLeap = true; --i; }
    }
    if (offset < 0) { offset += temp; --i; }
    return { y: ly, m: i, d: offset + 1, leap: isLeap };
  }

  function gzLabel(gi, zi) { return GAN[gi] + ZHI[zi]; }

  /* 1900-01-01 = 甲戌日（六十甲子第 11 位，index 10） */
  function dayGZ(y, m, d) {
    var base = Date.UTC(1900, 0, 1);
    var t = Date.UTC(y, m - 1, d);
    var offset = Math.round((t - base) / 86400000);
    var idx = (10 + offset) % 60;
    if (idx < 0) idx += 60;
    return { gan: idx % 10, zhi: idx % 12, idx: idx, label: gzLabel(idx % 10, idx % 12) };
  }

  /* 年柱：立春换年。甲子年锚：1984 */
  function yearGZ(y, m, d) {
    var lichun = termDate(y, 2);
    var yy = y;
    if (ymdNum(y, m, d) < ymdNum(lichun.y, lichun.m, lichun.d)) yy = y - 1;
    var gan = (yy - 4) % 10;
    var zhi = (yy - 4) % 12;
    if (gan < 0) gan += 10;
    if (zhi < 0) zhi += 12;
    return { gan: gan, zhi: zhi, label: gzLabel(gan, zhi), year: yy };
  }

  /* 月柱：十二节。立春寅、惊蛰卯… 甲己之年丙作首 */
  function monthGZ(y, m, d, yearGan) {
    var jie = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0];
    var monthZhi = 2; /* 默认寅 */
    var i, t, ty;
    for (i = 0; i < 12; i++) {
      ty = jie[i] === 0 ? y + 1 : y;
      t = termDate(ty, jie[i] === 0 ? 0 : jie[i]);
      if (ymdNum(y, m, d) >= ymdNum(t.y, t.m, t.d)) monthZhi = (i + 2) % 12;
    }
    var startGan = [2, 4, 6, 8, 0][yearGan % 5]; /* 丙戊庚壬甲 */
    var gan = (startGan + ((monthZhi - 2 + 12) % 12)) % 10;
    return { gan: gan, zhi: monthZhi, label: gzLabel(gan, monthZhi) };
  }

  /* 时柱：子时起。甲己还加甲…；hour=-1 表示未知 */
  function hourGZ(dayGan, hour) {
    if (hour == null || hour < 0) return null;
    var zhi = Math.floor(((hour + 1) % 24) / 2);
    var start = [0, 2, 4, 6, 8][dayGan % 5];
    var gan = (start + zhi) % 10;
    return { gan: gan, zhi: zhi, label: gzLabel(gan, zhi) };
  }

  var HOUR_NAMES = [
    '子时 · 23–01', '丑时 · 01–03', '寅时 · 03–05', '卯时 · 05–07',
    '辰时 · 07–09', '巳时 · 09–11', '午时 · 11–13', '未时 · 13–15',
    '申时 · 15–17', '酉时 · 17–19', '戌时 · 19–21', '亥时 · 21–23'
  ];

  function addWx(counts, wx, n) {
    if (!wx) return;
    counts[wx] = (counts[wx] || 0) + (n || 1);
  }

  function analyze(pillars) {
    var counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    var list = [pillars.year, pillars.month, pillars.day];
    if (pillars.hour) list.push(pillars.hour);
    var i, j, g, z, hid;
    for (i = 0; i < list.length; i++) {
      g = list[i].gan; z = list[i].zhi;
      addWx(counts, GAN_WX[g], 1);
      addWx(counts, ZHI_WX[z], 1);
      hid = ZHI_HIDDEN[ZHI[z]] || [];
      for (j = 0; j < hid.length; j++) {
        addWx(counts, GAN_WX[GAN.indexOf(hid[j])], 0.4);
      }
    }
    var lack = [], weak = [], favor = [];
    for (i = 0; i < WX.length; i++) {
      if (counts[WX[i]] < 0.5) lack.push(WX[i]);
      else if (counts[WX[i]] < 1.8) weak.push(WX[i]);
    }
    favor = lack.length ? lack.slice() : weak.slice(0, 2);
    if (!favor.length) {
      /* 都较均衡时，按日主「我生」与「我克」给一点用神倾向：木→火土… */
      var dm = GAN_WX[pillars.day.gan];
      var sheng = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
      var ke = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
      favor = [sheng[dm], ke[dm]];
    }
    return { counts: counts, lack: lack, weak: weak, favor: favor };
  }

  /**
   * @param y,m,d 公历
   * @param hour  0–23，或 -1 / null 表示未知时辰
   */
  NM.baziFromSolar = function (y, m, d, hour) {
    y = +y; m = +m; d = +d;
    if (!y || !m || !d || y < 1900 || y > 2100) {
      return { ok: false, error: '请选择 1900–2100 之间的公历生日' };
    }
    var day = dayGZ(y, m, d);
    var year = yearGZ(y, m, d);
    var month = monthGZ(y, m, d, year.gan);
    var hourPillar = hourGZ(day.gan, hour);
    var pillars = { year: year, month: month, day: day, hour: hourPillar };
    var ax = analyze(pillars);
    var lunar = solarToLunar(y, m, d);
    var dm = GAN[day.gan];
    var dmWx = GAN_WX[day.gan];
    var pillarStr = [year.label, month.label, day.label]
      .concat(hourPillar ? [hourPillar.label] : [])
      .join(' · ');
    var lackTxt = ax.lack.length
      ? ('五行缺' + ax.lack.join('、'))
      : (ax.weak.length ? ('五行偏弱于' + ax.weak.join('、')) : '五行较均衡');
    var favorTxt = '宜补' + ax.favor.join('、');
    return {
      ok: true,
      solar: { y: y, m: m, d: d, hour: hour == null ? -1 : hour },
      lunar: lunar,
      pillars: {
        year: year.label,
        month: month.label,
        day: day.label,
        hour: hourPillar ? hourPillar.label : ''
      },
      pillarStr: pillarStr,
      dayMaster: dm,
      dayWx: dmWx,
      counts: ax.counts,
      lack: ax.lack,
      weak: ax.weak,
      favor: ax.favor,
      summary: '日主' + dm + dmWx + '，' + lackTxt + '，' + favorTxt,
      short: lackTxt + ' · ' + favorTxt
    };
  };

  NM.BAZI_HOURS = HOUR_NAMES;
  NM.BAZI_WX = WX;

  /* 用宜补五行合成一份性格向量（没做过测试时用） */
  NM.profileFromBazi = function (info) {
    var favor = (info && info.favor) || [];
    var wxDom = {
      金: ['sound', 'sky'],
      木: ['wood', 'beast'],
      水: ['water', 'quiet'],
      火: ['fire', 'bright'],
      土: ['earth', 'gift']
    };
    var packs = [];
    var i, j, doms, dom;
    for (i = 0; i < favor.length; i++) {
      doms = wxDom[favor[i]] || [];
      for (j = 0; j < doms.length; j++) {
        dom = NM.DOMAINS[doms[j]];
        if (!dom) continue;
        packs.push({
          warm: dom.tr.warm, out: dom.tr.out, rat: dom.tr.rat, sta: dom.tr.sta,
          cla: dom.st.cla, sim: dom.st.sim, exp: dom.st.exp
        });
      }
    }
    var TK = NM.TRAIT_KEYS, SK = NM.STYLE_KEYS;
    function avg(keys) {
      var out = {}, a, b, sum, cnt;
      for (a = 0; a < keys.length; a++) {
        sum = 0; cnt = 0;
        for (b = 0; b < packs.length; b++) {
          if (typeof packs[b][keys[a]] === 'number') {
            sum += packs[b][keys[a]]; cnt++;
          }
        }
        out[keys[a]] = cnt ? sum / cnt : 0;
      }
      return out;
    }
    return {
      trait: packs.length ? avg(TK) : { warm: 0, out: 0, rat: 0, sta: 0 },
      style: packs.length ? avg(SK) : { cla: 0, sim: 0, exp: 0 },
      nov: 0.45,
      answered: 0,
      bazi: info,
      favorWx: favor.slice()
    };
  };

  NM.attachBazi = function (profile, info) {
    var p = profile || NM.profileFromAnswers([]);
    p.bazi = info;
    p.favorWx = (info && info.favor) ? info.favor.slice() : [];
    return p;
  };

  NM.baziExplainName = function (chars, info) {
    if (!info || !info.favor || !info.favor.length) return '';
    var hits = [], i, it, wx;
    for (i = 0; i < chars.length; i++) {
      it = NM.getChar && NM.getChar(chars[i]);
      if (!it) continue;
      wx = NM.domainWx(it.dom);
      if (wx && info.favor.indexOf(wx) >= 0) hits.push(chars[i] + '属' + wx);
    }
    if (!hits.length) return '宜补' + info.favor.join('、');
    return hits.join('、') + '，合宜补' + info.favor.join('、');
  };
})();
