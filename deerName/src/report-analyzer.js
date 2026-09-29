/* 名字对比报告 —— 对应 NameReportAnalyzer.swift */
(function () {
  var NM = window.NM;
  var SpeechHelper = window.SpeechHelper;

  function givenMeaning(given) {
    if (!NM.GIVEN) return '';
    for (var i = 0; i < NM.GIVEN.length; i++) {
      if (NM.GIVEN[i].n === given) return NM.GIVEN[i].m || '';
    }
    return '';
  }

  function domainLabel(dom) {
    var d = NM.data && NM.data.domains && NM.data.domains[dom];
    return d ? d.label : dom;
  }

  function personalityFit(name, profile) {
    var radar = NM.radar(profile, name.vec);
    if (!radar.length) return 0;
    var sum = 0;
    radar.forEach(function (r) { sum += r.name; });
    return Math.round(sum / radar.length);
  }

  function favorTouchCount(chars, bazi) {
    if (!bazi || !bazi.favor) return 0;
    var favor = {};
    bazi.favor.forEach(function (w) { favor[w] = 1; });
    var n = 0;
    (chars || []).forEach(function (ch) {
      var it = NM.getChar(ch);
      if (!it) return;
      var wx = NM.domainWx(it.dom);
      if (wx && favor[wx]) n++;
    });
    return n;
  }

  function touchesFavorWx(chars, favor) {
    var set = {};
    (favor || []).forEach(function (w) { set[w] = 1; });
    for (var i = 0; i < (chars || []).length; i++) {
      var it = NM.getChar(chars[i]);
      if (!it) continue;
      var wx = NM.domainWx(it.dom);
      if (wx && set[wx]) return true;
    }
    return false;
  }

  function qualityScore(name, profile, bazi) {
    var read = NM.readability(name.surname, name.chars);
    var sound = name.euphony != null ? name.euphony : NM.euphony(name.surname, name.chars);
    var score = Math.round(sound * 55);
    if (read.ok) score += 25;
    if (SpeechHelper) {
      var sp = SpeechHelper.inspect(name.surname, name.chars);
      if (!sp.polyphones.length) score += 10;
    }
    if (profile && profile.answered) score += Math.floor(personalityFit(name, profile) / 10);
    var chart = (bazi && bazi.ok) ? bazi : (profile && profile.bazi);
    if (chart && chart.ok && favorTouchCount(name.chars, chart) > 0) score += 5;
    return Math.min(100, Math.max(0, score));
  }

  function compareCandidates(names, profile, bazi) {
    if (!names || names.length < 2) return null;
    var picks = [];
    var scored = names.map(function (n) { return { name: n, score: qualityScore(n, profile, bazi) }; });
    scored.sort(function (a, b) { return b.score - a.score; });
    if (scored[0]) {
      picks.push({
        dimension: '综合评分',
        winner: scored[0].name.full,
        detail: scored[0].score + '/100——读感、音韵、性格与生辰一起权衡后的领先者。'
      });
    }
    if (profile && profile.answered) {
      var fits = names.map(function (n) { return { name: n, fit: personalityFit(n, profile) }; });
      fits.sort(function (a, b) { return b.fit - a.fit; });
      picks.push({
        dimension: '性格贴合',
        winner: fits[0].name.full,
        detail: '七维综合约 ' + fits[0].fit + '%，和你测出来的气质画像最接近。'
      });
    }
    var sounds = names.map(function (n) {
      return { name: n, sound: n.euphony != null ? n.euphony : NM.euphony(n.surname, n.chars) };
    });
    sounds.sort(function (a, b) { return b.sound - a.sound; });
    picks.push({
      dimension: '读音顺口',
      winner: sounds[0].name.full,
      detail: NM.euphonyLabel(sounds[0].sound) + '——日常被叫、点名时更省力。'
    });
    var reads = names.map(function (n) {
      var r = NM.readability(n.surname, n.chars);
      return { name: n, issues: r.issues.length, ok: r.ok };
    });
    reads.sort(function (a, b) {
      if (a.issues !== b.issues) return b.issues - a.issues;
      return (a.ok ? 0 : 1) - (b.ok ? 0 : 1);
    });
    picks.push({
      dimension: '读感避雷',
      winner: reads[0].name.full,
      detail: reads[0].ok ? '未发现明显拗口、谐音或意象冲突。' : '仍有需要注意的读感点，见该名下方「读音与避雷」。'
    });
    if (bazi && bazi.ok && bazi.favor && bazi.favor.length) {
      var wx = names.map(function (n) { return { name: n, n: favorTouchCount(n.chars, bazi) }; });
      wx.sort(function (a, b) { return b.n - a.n; });
      if (wx[0].n > 0) {
        picks.push({
          dimension: '生辰五行',
          winner: wx[0].name.full,
          detail: '有 ' + wx[0].n + ' 个字踩在宜补的五行上，更贴近传统「补缺」取名。'
        });
      } else {
        picks.push({
          dimension: '生辰五行',
          winner: '都不算补运向',
          detail: '几个名字都未直接带出宜补的' + (bazi.favor || []).join('、') + '，更适合按字义、气质来选。'
        });
      }
    }
    var celebLoad = names.map(function (n) {
      var given = n.given || (n.chars || []).join('');
      var top = NM.celebsForName ? (NM.celebsForName(given, n.chars, 1)[0] || {}) : {};
      return { name: n, score: top.score || 0 };
    });
    celebLoad.sort(function (a, b) { return a.score - b.score; });
    picks.push({
      dimension: '名人联想',
      winner: celebLoad[0].name.full,
      detail: celebLoad[0].score >= 180
        ? '几个名字联想都偏强，这项只是相对更低调。'
        : '名人标签相对轻，不容易被公众人物「抢戏」。'
    });

    var summary = [];
    if (names.length === 2 && scored.length >= 2) {
      var left = scored[0], right = scored[1];
      if (left.name.full !== right.name.full && left.score !== right.score) {
        summary.push('综合分上「' + (left.score >= right.score ? left.name.full : right.name.full) + '」领先 ' +
          Math.abs(left.score - right.score) + ' 分；若家人更看重顺口或八字，请看上表对应项的胜出名字。');
      }
    }
    if (!summary.length) {
      summary.push('家人讨论时先对齐：更看重顺口、补运、还是文化寓意，再按上表对应项拍板。');
    }
    return { picks: picks, summary: summary };
  }

  function analyze(name, profile, bazi) {
    var sections = [];
    var given = name.given || (name.chars || []).join('');
    var culture = cultureSection(given, name.chars);
    if (culture.length) sections.push({ title: '文化联想与名义', lines: culture });
    var chars = charSection(name.surname, name.chars, bazi);
    if (chars.length) sections.push({ title: '用字来由与意象', lines: chars });
    if (profile && profile.answered) {
      var pers = personalitySection(profile, name.vec);
      if (pers.length) sections.push({ title: '性格气质是否合拍', lines: pers });
    }
    var wx = baziSection(name.chars, bazi);
    if (wx.length) sections.push({ title: '生辰与五行', lines: wx });
    var caution = cautionSection(name.surname, name.chars, given);
    if (caution.length) sections.push({ title: '读音与避雷', lines: caution });
    return sections;
  }

  function cultureSection(given, chars) {
    var lines = [];
    var curated = null;
    for (var i = 0; i < (NM.GIVEN || []).length; i++) {
      if (NM.GIVEN[i].n === given) { curated = NM.GIVEN[i]; break; }
    }
    if (curated) {
      if (curated.tag === 'literary') lines.push('这是精选「清雅」名，多从诗词意境、典籍语感里挑字组合，文化气质偏文气、书卷。');
      else lines.push('这是常见精选名，字义清晰、好认好叫，文化联想相对中性。');
    }
    var meaning = givenMeaning(given);
    if (meaning) lines.push('名义脉络：' + meaning + '。向长辈解释「为什么选这个名字」时，可以先把这句说清楚。');
    if (NM.celebsForName) {
      NM.celebsForName(given, chars, 2).forEach(function (hit) {
        var bio = (hit.bio || '').length > 120 ? hit.bio.slice(0, 117) + '…' : hit.bio;
        lines.push('因' + hit.how + '会联想到 ' + hit.name + '（' + hit.era + '）。' + bio);
      });
    }
    if (chars.length === 2) {
      var c0 = NM.getChar(chars[0]), c1 = NM.getChar(chars[1]);
      if (c0 && c1 && NM.domainsCompatible) {
        var l0 = domainLabel(c0.dom), l1 = domainLabel(c1.dom);
        if (NM.domainsCompatible(c0.dom, c1.dom)) {
          lines.push('两字意象「' + l0 + '」与「' + l1 + '」能放在同一幅画里，不是硬凑的生僻组合。');
        } else {
          lines.push('两字意象「' + l0 + '」与「' + l1 + '」跨度较大，名字会更有反差感。');
        }
      }
    }
    return lines;
  }

  function charSection(surname, chars, bazi) {
    var lines = [];
    var favor = {};
    if (bazi && bazi.favor) bazi.favor.forEach(function (w) { favor[w] = 1; });
    (chars || []).forEach(function (ch) {
      var it = NM.getChar(ch);
      if (!it) return;
      var note = NM.charNote(ch);
      var dom = domainLabel(it.dom);
      var line = '「' + ch + '」读 ' + note.py + '，字义取「' + note.text + '」，意象「' + dom + '」。';
      var wx = NM.domainWx(it.dom);
      if (wx) {
        if (bazi && bazi.ok && Object.keys(favor).length) {
          if (favor[wx]) line += '五行属' + wx + '，和你生辰里宜补的方向一致。';
          else if (bazi.lack && bazi.lack.indexOf(wx) !== -1) line += '五行属' + wx + '，而你八字里偏偏缺这一行。';
          else line += '五行属' + wx + '，不冲突，但也不是专门来补你八字的。';
        } else line += '五行属' + wx + '。';
      }
      lines.push(line);
    });
    if (chars.length === 2 && NM.domainsCompatible) {
      var a = NM.getChar(chars[0]), b = NM.getChar(chars[1]);
      if (a && b) {
        lines.push(NM.domainsCompatible(a.dom, b.dom)
          ? '两个字意象能互相托住，读起来像一个完整意思。'
          : '两个字意象差别大，名字会更「跳」、更有记忆点。');
      }
    }
    return lines;
  }

  function personalitySection(profile, vec) {
    var radar = NM.radar(profile, vec);
    if (!radar.length) return [];
    var fit = Math.round(radar.reduce(function (s, r) { return s + r.name; }, 0) / radar.length);
    var lines = ['七维综合贴合约 ' + fit + '%——不是「像不像你」的唯一标准，但能帮家人理解气质方向。'];
    var ranked = radar.map(function (r) {
      return { item: r, gap: Math.abs(r.name - r.mine) };
    }).sort(function (a, b) { return a.gap - b.gap; });
    if (ranked[0] && ranked[0].gap <= 14) {
      var best = ranked[0].item;
      lines.push('最合拍的是「' + best.label + '」：你偏' + (best.mine >= 50 ? best.high : best.low) +
        '，名字也偏' + (best.name >= 50 ? best.high : best.low) + '。');
    }
    return lines;
  }

  function baziSection(chars, bazi) {
    if (!bazi || !bazi.ok) return ['未填生辰时，下面五行只按字义与意象理解，不作「补运」结论。'];
    var lines = [bazi.summary];
    var explain = NM.baziExplainName(chars, bazi);
    if (explain) {
      lines.push(touchesFavorWx(chars, bazi.favor)
        ? '从五行看：' + explain + '——和传统「生辰补缺」方向一致。'
        : '从五行看：名字没有带出宜补的五行（' + explain + '）。更适合当「好义、好听」名。');
    }
    return lines;
  }

  function cautionSection(surname, chars, given) {
    var read = NM.readability(surname, chars);
    var lines = [];
    if (SpeechHelper) {
      SpeechHelper.inspect(surname, chars).polyphones.forEach(function (h) {
        lines.push('多音字「' + h.ch + '」名字里更常读 ' + h.namePy + '（另有 ' + h.altPy + '）。');
      });
    }
    read.issues.forEach(function (iss) {
      lines.push('要注意：' + iss + '——长期被叫时，这个问题比纸面看名字更影响体验。');
    });
    if (NM.validate && !NM.validate(surname, chars, given, { lite: true })) {
      lines.push('谐音或连读触发了内置避雷规则，不建议作为正式大名，除非你们非常确定要承担误会风险。');
    }
    read.good.slice(0, 3).forEach(function (g) { lines.push('顺口方面：' + g + '。'); });
    if (read.ok && !lines.length) lines.push('读音与连读未发现明显雷点，日常称呼比较省心。');
    return lines;
  }

  NM.report = {
    analyze: analyze,
    compareCandidates: compareCandidates,
    qualityScore: qualityScore,
    radarItems: function (profile, vec) { return NM.radar(profile, vec); }
  };
})();
