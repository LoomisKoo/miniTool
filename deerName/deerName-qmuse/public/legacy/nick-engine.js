/* 小名 / 社交昵称引擎 —— 对应 NickEngine.swift；H5 全量开放 */
(function () {
  var NM = window.NM;
  var NickInterp = window.NickInterp;

  var SOCIAL_BATCH = 8;

  var CURATED = [
    ['简洁', ['松声', '云岫', '川页', '知微', '见素', '清昼', '和光', '栖迟', '向晚', '微澜', '听松', '照野'], '短而耐看，适合长期使用'],
    ['文艺', ['借一场风', '月落之后', '把春天寄来', '路过人间', '山止于此', '听见潮汐', '风从远方来', '灯下有诗', '在雾里行走', '把日子写成诗'], '有画面感，不局限于单一情绪'],
    ['轻松', ['今天不赶路', '先吃饭再说', '随手一朵云', '偶尔认真', '快乐有回声', '暂时不营业', '给生活加糖', '散步选手', '低调开心', '刚好路过'], '轻松自然，适合日常社交'],
    ['个性', ['偏航日记', '备用频道', '无固定答案', '正在成形', '不按剧本', '低频发光', '自带留白', '慢速更新', '隐藏章节', '另一个版本'], '有辨识度，但不过分中二'],
    ['游戏', ['夜行频道', '静默开局', '边线观察员', '最后一局', '野区散步', '反向输出', '不急着赢', '暂停一下', '备用血条', '凌晨排位'], '适合游戏或兴趣社区'],
    ['英文', ['quiet orbit', 'soft signal', 'northbound', 'afterglow', 'slow morning', 'open secret', 'blue note', 'small wonder', 'common ground', 'off the record'], '简短自然，适合英文社交场景']
  ];

  var VIBE_BIAS = {
    '温柔': [0.55, 0.1, 0.1, 0, 0], '自然': [0.4, 0, 0.2, 0.2, 0],
    '女生': [0.45, 0.15, -0.1, 0, 0.1], '可爱': [0.5, 0.2, -0.25, 0, 0.15],
    '小清新': [0.35, -0.05, 0.1, 0.25, -0.05], '唯美': [0.25, -0.1, 0.45, 0, -0.1],
    '幸福': [0.5, 0.25, -0.1, 0, 0.1], '爱情': [0.45, 0.15, 0.05, 0, 0.1],
    '情侣': [0.4, 0.2, 0, 0, 0.05],
    '酷感': [-0.45, -0.15, 0, 0.1, -0.1], '霸气': [-0.2, 0.35, 0, -0.1, 0.25],
    '超拽': [-0.25, 0.2, -0.2, 0, 0.15], '帅气': [-0.15, 0.25, 0, 0.1, 0.1],
    '男生': [-0.1, 0.15, 0.05, 0.15, 0], '游戏': [-0.1, 0.3, -0.35, 0, 0.2],
    '战队': [-0.15, 0.35, -0.2, 0, 0.15], '给力': [0.1, 0.4, -0.3, -0.1, 0.3],
    '年轻风': [0.1, 0.35, -0.45, 0, 0.2], '轻松': [0.2, 0.3, -0.3, 0.1, 0.15],
    '情绪': [0.15, 0.1, -0.2, 0, 0.25], '搞笑': [0.15, 0.4, -0.35, 0, 0.35],
    '颜文字': [0.1, 0.15, -0.4, -0.1, 0.25], 'Emoji': [0.1, 0.2, -0.4, 0, 0.2],
    '非主流': [0, 0.2, -0.2, -0.2, 0.2], '符号': [0, 0.1, -0.15, -0.1, 0.15],
    '文艺': [0.1, -0.15, 0.55, 0.1, -0.15], '古风': [0, -0.1, 0.6, 0, -0.2],
    '诗意': [0.1, -0.2, 0.55, 0.1, -0.2], '意境': [0.05, -0.25, 0.5, 0.15, -0.25],
    '繁体': [0, -0.1, 0.5, 0.1, -0.15], '经典': [0.15, 0, 0.4, 0.1, 0],
    '简洁': [0, -0.1, 0.1, 0.5, -0.1], '简单': [0, 0, 0, 0.45, 0.05],
    '两字': [0, 0, 0.05, 0.4, 0], '好听': [0.2, 0, 0.25, 0.3, 0],
    '英文': [0, 0.1, -0.1, 0.2, 0.1], '中英': [0.05, 0.2, -0.25, 0, 0.2], '三字': [0, 0.05, -0.05, 0.15, 0.05],
    '四字': [0, 0, 0.15, 0.1, 0], '内涵': [0, -0.2, 0.25, 0.1, -0.25],
    '成熟': [-0.05, -0.1, 0.15, 0.2, -0.15], '励志': [0.15, 0.25, 0, 0, 0.2],
    '伤感': [-0.15, -0.25, 0.15, 0, 0.05], '忧伤': [-0.05, -0.3, 0.35, 0.1, -0.1],
    '颓废': [-0.2, -0.1, -0.25, 0, 0.1], '重口味': [-0.35, 0.05, -0.1, -0.1, 0.1],
    '微信': [0.1, 0, 0, 0.25, 0], '微博': [0, 0.25, -0.2, 0, 0.2],
    '空间': [0.1, 0.05, 0.1, 0, 0.05], '个性': [0, 0.2, -0.15, 0, 0.2],
    '家族': [0.35, 0.2, 0.1, 0, 0.1], '兄弟': [0.1, 0.35, -0.1, 0, 0.2],
    '姐妹': [0.35, 0.35, -0.1, 0, 0.2], '兄妹': [0.3, 0.25, 0, 0, 0.15],
    '小孩': [0.4, 0.2, -0.2, 0.1, 0.15]
  };

  var ZH_MEANINGS = {
    'left on read': '已读但故意没有回复。', 'still here': '安静地保持在线，也保持自己的存在感。',
    'not today': '今天先不处理这些事。', 'after hours': '下班后或深夜才真正有精神的人。',
    'soft launch': '低调公开，不刻意宣布。', 'main character': '把自己的生活当成值得认真书写的故事。',
    'side quest': '暂时离开主线，去探索有趣的支线。', 'final boss': '最后的挑战，也可以指全场最强的人。',
    'plot twist': '事情即将出现意料之外的转折。', 'slow burn': '慢慢升温、逐渐产生感觉。',
    'guest mode': '只是暂时路过，不透露太多自己。', 'name taken': '想用的名字已经被别人占用了。',
    'user deleted': '俏皮地表示自己暂时消失。', 'untitled': '没有定义，也故意不急着完成。',
    'low battery': '社交或现实电量都快用完了。', 'blue hour': '日出前或日落后的安静蓝调时刻。',
    'golden hour': '温暖明亮、值得记住的一段时间。', 'close friends': '只留给熟悉和信任的人的小空间。',
    'lurker': '安静围观，不太主动发言的人。', 'quiet flex': '不张扬地展示自信和实力。'
  };

  function loadGroups() {
    var pack = window.NICK_PACK;
    var merged = CURATED.map(function (g) { return [g[0], g[1].slice(), g[2]]; });
    if (!pack || !pack.groups) return merged;
    var excluded = { '颜文字': 1, 'Emoji': 1 };
    pack.groups.forEach(function (gr) {
      if (excluded[gr.category]) return;
      var idx = -1;
      for (var i = 0; i < merged.length; i++) {
        if (merged[i][0] === gr.category) { idx = i; break; }
      }
      if (idx === -1) {
        merged.push([gr.category, gr.words.slice(), gr.note]);
      } else {
        var exist = merged[idx][1];
        gr.words.forEach(function (w) {
          if (exist.indexOf(w) === -1) exist.push(w);
        });
      }
    });
    return merged;
  }

  var SOCIAL_GROUPS = loadGroups();
  var SOCIAL_BASE = buildSocialItems('');
  var SOCIAL_GROUPED = {};
  var SOCIAL_NOTES = {};
  SOCIAL_BASE.forEach(function (it) {
    if (!SOCIAL_GROUPED[it.category]) SOCIAL_GROUPED[it.category] = [];
    SOCIAL_GROUPED[it.category].push(it);
  });
  SOCIAL_GROUPS.forEach(function (g) { SOCIAL_NOTES[g[0]] = g[2]; });

  function item(text, type, category, tags, score, note, zhNote, enNote) {
    return {
      text: text, type: type, category: category, tags: tags || [category],
      score: score == null ? 0.5 : score, note: note || '',
      zhNote: zhNote || '', enNote: enNote || '',
      id: text + '|' + type + '|' + category
    };
  }

  function englishNote(cat, word) {
    if (word && NickInterp) { /* handled in build */ }
    var notes = {
      '年轻风': '偏网感、轻松的日常叫法。', '情绪': '表达心情或状态的昵称。',
      '轻松': '轻松自然，适合日常社交。', '酷感': '有一点距离感的酷昵称。',
      '温柔': '温柔、有温度的叫法。', '简洁': '短而耐看，好记。',
      '文艺': '有画面感和文气。', '古风': '古典意象。', '自然': '自然与户外意象。',
      '女生': '偏柔和的叫法。', '男生': '偏干净利落的叫法。', '可爱': '可爱亲切。',
      '游戏': '适合游戏社区。', '英文': '英文社交昵称。', '中英': '中英混合。',
      '情侣': '有配对感。', '微信': '适合日常聊天。', '微博': '适合公开讨论。'
    };
    return notes[cat] || '有独特气质的社交昵称。';
  }

  function buildSocialItems(given) {
    given = (given || '').trim();
    var seen = {};
    var items = [];
    SOCIAL_GROUPS.forEach(function (grp) {
      var category = grp[0], words = grp[1], note = grp[2];
      words.forEach(function (word) {
        var text = given ? (word + '·' + given.charAt(0)) : word;
        text = text.replace(/\u3000/g, '').trim();
        if (seen[text]) return;
        seen[text] = 1;
        var zhNote = ZH_MEANINGS[word] || note;
        items.push(item(text, '社交昵称', category, [category, '成人'], 0.5, note, zhNote, englishNote(category, word)));
      });
    });
    return items;
  }

  function scriptMatches(script, text) {
    var cjk = false, latin = false;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c >= 0x4E00 && c <= 0x9FFF) cjk = true;
      if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) latin = true;
    }
    if (cjk && latin) return script === 'mix';
    if (latin) return script === 'en';
    if (cjk) return script === 'zh';
    return script !== 'en';
  }

  function socialWeight(category, profile) {
    if (!profile || !profile.answered) return 1;
    var b = VIBE_BIAS[category] || [0, 0, 0, 0, 0];
    var warm = profile.trait.warm || 0;
    var out = profile.trait.out || 0;
    var cla = profile.style.cla || 0;
    var sim = profile.style.sim || 0;
    var exp = profile.style.exp || 0;
    var w = 1.1 + b[0] * warm + b[1] * out + b[2] * cla + b[3] * sim + b[4] * exp;
    return Math.max(0.35, w);
  }

  function pool(script, vibes) {
    var base;
    if (!vibes || !vibes.length) base = SOCIAL_BASE;
    else {
      base = [];
      vibes.forEach(function (v) {
        var arr = SOCIAL_GROUPED[v] || [];
        base = base.concat(arr);
      });
    }
    return base.filter(function (it) { return scriptMatches(script, it.text); });
  }

  function scoreNick(chars, profile) {
    if (!profile || !profile.answered || !NM.vectorOf) return 0.5;
    var known = chars.filter(function (c) { return NM.getChar(c); });
    var vec = NM.vectorOf(known);
    if (!vec) return 0.5;
    var t = (NM.cos(vec.trait, profile.trait, NM.data.traitKeys) + 1) / 2;
    var s = (NM.cos(vec.style, profile.style, NM.data.styleKeys) + 1) / 2;
    return 0.6 * t + 0.4 * s;
  }

  function softest(chars) {
    var softDoms = { quiet: 1, water: 1, gift: 1, mind: 1, sound: 1 };
    var best = null, bestS = -1;
    chars.forEach(function (ch) {
      var c = NM.getChar(ch);
      if (!c) return;
      var s = 1 - c.freq / 5;
      if (softDoms[c.dom]) s += 0.35;
      if (c.g === 'f') s += 0.1;
      if (s > bestS) { bestS = s; best = ch; }
    });
    return best || chars[chars.length - 1];
  }

  function derived(given, surname, profile) {
    given = given || '';
    var chars = given.split('').filter(Boolean);
    if (!chars.length) return [];
    var raw = [];
    var last = chars[chars.length - 1];
    if (last.length === 1) raw.push({ text: last + last, type: '叠字', tags: ['亲昵派生'], note: '叠字小名，柔软亲昵' });
    raw.push({ text: '小' + chars[0], type: '小X', tags: ['亲昵派生'], note: '「小」字开头，日常亲昵' });
    raw.push({ text: last + '儿', type: 'X儿', tags: ['亲昵派生'], note: '儿化音，北方语感' });
    raw.push({ text: '阿' + chars[0], type: '阿X', tags: ['亲昵派生'], note: '「阿」字开头，南方语感' });
    if (surname && surname.c) {
      var head = surname.c.charAt(0);
      if (head !== chars[0]) raw.push({ text: '阿' + head, type: '阿X', tags: ['亲昵派生'], note: '以姓称呼，家里常用' });
    }
    var soft = softest(chars);
    if (soft) raw.push({ text: soft, type: '单字', tags: ['亲昵派生'], note: '单字小名，干净好叫' });

    var seen = {};
    var items = [];
    var allowed = { '儿': 1, '小': 1, '阿': 1 };
    raw.forEach(function (r) {
      var t = r.text.trim();
      if (t.length < 1 || t.length > 3 || seen[t]) return;
      seen[t] = 1;
      var nickChars = t.split('');
      for (var i = 0; i < nickChars.length; i++) {
        if (!NM.getChar(nickChars[i]) && !allowed[nickChars[i]]) return;
      }
      items.push(item(t, r.type, r.tags[0], r.tags, scoreNick(nickChars, profile), r.note));
    });
    return items.sort(function (a, b) { return b.score - a.score; });
  }

  function childLibrary(profile) {
    var groups = [
      ['植物', ['芽芽', '豆豆', '苗苗', '果果', '桃桃', '杏杏', '梨梨', '柚柚', '禾禾', '米米', '朵朵', '葵葵'], '植物意象，清新有生命力'],
      ['动物', ['鹿鹿', '兔兔', '团团', '熊熊', '喵喵', '鱼鱼', '燕燕', '雀雀', '鹅鹅', '虎虎', '糖豆', '小鹿'], '动物意象，亲切有画面感'],
      ['食物', ['饼饼', '果冻', '布丁', '奶糖', '糯米', '汤圆', '年糕', '小麦', '芝麻', '花生', '柿子', '团子'], '食物意象，软糯又好叫'],
      ['自然', ['星星', '月月', '云云', '阳阳', '晨晨', '露露', '风风', '雨雨', '雪雪', '溪溪', '暖暖', '晴晴'], '自然意象，轻盈明亮'],
      ['性格', ['乐乐', '安安', '宁宁', '笑笑', '欢欢', '甜甜', '乖乖', '慢慢', '灵灵', '暖宝', '开心', '自在'], '性格意象，表达家人的祝愿'],
      ['可爱物件', ['铃铛', '泡泡', '点点', '圆圆', '球球', '果冻', '饺子', '小满', '糖糖', '星宝', '团子', '萌萌'], '可爱物件，轻松有记忆点']
    ];
    var out = [];
    groups.forEach(function (g) {
      g[1].forEach(function (word) {
        out.push(item(word, '词库', g[0], [g[0], '可爱'], scoreNick(word.split(''), profile), g[2]));
      });
    });
    return out;
  }

  function drawSocial(script, vibes, profile, excluding, count) {
    excluding = excluding || {};
    count = count == null ? SOCIAL_BATCH : count;
    var vibeList = vibes && vibes.length ? vibes : [];
    var items = pool(script, vibeList).filter(function (it) { return !excluding[it.text]; });
    if (!items.length) items = pool(script, vibeList);
    if (!items.length) return [];
    var keyed = items.map(function (it) {
      return { item: it, w: socialWeight(it.category, profile) * (0.55 + Math.random() * 0.9) };
    });
    keyed.sort(function (a, b) { return b.w - a.w; });
    return keyed.slice(0, count).map(function (k) {
      return item(k.item.text, k.item.type, k.item.category, k.item.tags, k.w, k.item.note, k.item.zhNote, k.item.enNote);
    });
  }

  function drawChild(fromItems, excluding, count) {
    excluding = excluding || {};
    count = count == null ? SOCIAL_BATCH : count;
    var p = fromItems.filter(function (it) { return !excluding[it.text]; });
    if (!p.length) p = fromItems.slice();
    for (var i = p.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = p[i]; p[i] = p[j]; p[j] = t;
    }
    return p.slice(0, count);
  }

  function socialVibes(script) {
    return SOCIAL_GROUPS.map(function (g) { return g[0]; }).filter(function (cat) {
      var arr = SOCIAL_GROUPED[cat] || [];
      return arr.some(function (it) { return scriptMatches(script, it.text); });
    });
  }

  function categories(mode) {
    if (mode === 'child') return ['全部', '植物', '动物', '食物', '自然', '性格', '可爱物件', '亲昵派生'];
    return ['全部'].concat(SOCIAL_GROUPS.map(function (g) { return g[0]; }));
  }

  function derive(given, surname, profile) {
    return childLibrary(profile).concat(derived(given, surname, profile))
      .sort(function (a, b) { return b.score - a.score; });
  }

  function interpretation(it) {
    return NickInterp.interpret(it.text, it.category, it.note, it.zhNote, it.enNote);
  }

  window.NickEngine = {
    socialBatchSize: SOCIAL_BATCH,
    categories: categories,
    derive: derive,
    drawSocial: drawSocial,
    drawChild: drawChild,
    socialVibes: socialVibes,
    socialNote: function (cat) { return SOCIAL_NOTES[cat]; },
    interpretation: interpretation,
    localizedNote: function (it) { return interpretation(it).explanation; },
    scriptMatches: scriptMatches
  };
})();
