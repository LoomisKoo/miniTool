/* 社交昵称解读 —— 对应 NickInterpreter.swift */
(function () {
  var NM = window.NM;

  var KNOWN = {
    '晚风': { literal: 'Evening Breeze', adapted: 'Soft Breeze', explanationZh: '像傍晚吹来的风，安静、温柔，不刻意制造距离感。', explanationEn: 'A quiet, gentle feeling like a breeze at dusk; calm without feeling distant.', scenes: ['微信', '个人主页'] },
    '清和': { literal: 'Clear and Harmonious', adapted: 'Quiet Grace', explanationZh: '气质干净平和，带一点克制和分寸感，适合长期使用。', explanationEn: 'Clean, calm, and quietly graceful; understated enough to use for a long time.', scenes: ['微信', '个人主页'] },
    '在逃公主': { literal: 'Princess on the Run', adapted: 'Runaway Royalty', explanationZh: '带一点俏皮和反差感，不是真的严肃自称，而是轻松地玩一个角色设定。', explanationEn: 'A playful role-play identity with a little contrast, not a serious claim of royalty.', scenes: ['社交昵称', '个人主页'] },
    'left on read': { literal: 'Left on Read', adapted: 'Seen, Not Answered', explanationZh: '表达已读但暂时不回复的状态，带一点冷幽默和边界感。', explanationEn: 'A dry, slightly humorous way to express being seen but intentionally unanswered.', scenes: ['英文界面', '社交昵称'] },
    'soft launch': { literal: 'Soft Launch', adapted: 'Quiet Reveal', explanationZh: '不高调宣布，只用一种低调的方式让别人慢慢发现。', explanationEn: 'A low-key reveal that lets people discover the story gradually.', scenes: ['英文界面', '个人主页'] },
    'main character': { literal: 'Main Character', adapted: 'The Story Is Mine', explanationZh: '强调把自己的生活当成主线，带一点自信和戏剧感。', explanationEn: 'A confident, slightly theatrical feeling of treating your own life as the main story.', scenes: ['英文界面', '个人主页'] },
    '听风': { literal: 'Listen to the Wind', adapted: 'Wind Listener', explanationZh: '有倾听和留白的感觉，安静但不孤僻。', explanationEn: 'Quiet and observant, with a sense of openness rather than loneliness.', scenes: ['微信', '个人主页'] },
    '见鹿': { literal: 'See the Deer', adapted: 'Find the Deer', explanationZh: '带有自然、温柔和一点偶然相遇的画面感。', explanationEn: 'A gentle nature image with the feeling of an unexpected encounter.', scenes: ['微信', '个人主页'] },
    '向晚': { literal: 'Toward Evening', adapted: 'Toward Dusk', explanationZh: '像一天将晚未晚的时刻，安静、成熟，也有一点浪漫。', explanationEn: 'A mature, quiet, slightly romantic feeling like the moment before dusk.', scenes: ['微信', '个人主页'] },
    '小透明': { literal: 'Little Transparent', adapted: 'Lowkey', explanationZh: '自嘲地表达低调、不抢镜，但不代表没有自己的存在感。', explanationEn: 'A self-deprecating way to be low-key without saying you have no presence.', scenes: ['社交昵称', '个人主页'] },
    '社恐本恐': { literal: 'Social Anxiety Personified', adapted: 'Introvert Energy', explanationZh: '用夸张和自嘲表达不擅长社交，语气偏轻松。', explanationEn: 'A playful, self-deprecating way to say social situations are not your strength.', scenes: ['社交昵称', '游戏'] },
    '摆烂中': { literal: 'Currently Giving Up', adapted: 'Currently Unbothered', explanationZh: '表达暂时不想卷、不想解释，带一点网络式的松弛感。', explanationEn: 'A relaxed internet-style way to say you are opting out of pressure for now.', scenes: ['社交昵称', '游戏'] },
    '把春天寄来': { literal: 'Bǎ Chūn Tiān Jì Lái', adapted: 'Send Spring Here', explanationZh: '像把春天写成一封信寄来，轻盈、明亮，带有期待感。', explanationEn: 'A poetic image of sending spring like a letter; light, hopeful, and full of anticipation.', scenes: ['微信', '个人主页'] },
    'still here': { literal: 'Still Here', adapted: 'Quietly Present', explanationZh: '表示虽然安静或低调，但仍然在自己的位置上。', explanationEn: 'Quietly present, even when not seeking attention.', scenes: ['英文界面', '个人主页'] },
    'not today': { literal: 'Not Today', adapted: 'Maybe Tomorrow', explanationZh: '今天先不处理麻烦和压力，简短又有边界感。', explanationEn: 'A short, boundary-setting way to decline today\'s noise or pressure.', scenes: ['英文界面', '社交昵称'] },
    'slow burn': { literal: 'Slow Burn', adapted: 'Gradually Glowing', explanationZh: '不是一眼惊艳，而是相处后慢慢显出味道。', explanationEn: 'Not instantly loud or flashy; its appeal grows with time.', scenes: ['英文界面', '个人主页'] },
    'final boss': { literal: 'Final Boss', adapted: 'Last Challenge', explanationZh: '带一点游戏感和夸张自信，适合表达强势或难搞的气质。', explanationEn: 'Playfully dramatic and confident, with a gaming-inspired sense of difficulty.', scenes: ['英文界面', '游戏'] },
    'quiet flex': { literal: 'Quiet Flex', adapted: 'Low-Key Confidence', explanationZh: '不大声炫耀，但让人看得出有能力和底气。', explanationEn: 'Confidence shown without loud boasting or trying too hard.', scenes: ['英文界面', '个人主页'] },
    '醉花阴': { literal: 'Drunk Among Flowers', adapted: 'Blossom Reverie', explanationZh: '古典词牌名，带有花影、微醺和含蓄的古典画面感。', explanationEn: 'A classical Chinese lyric title evoking flowers, gentle intoxication, and restrained romance.', scenes: ['英文界面', '个人主页'] }
  };

  var EN_FALLBACK = {
    '简洁': 'A clean, understated nickname that is easy to remember.',
    '文艺': 'A poetic nickname with a visual and atmospheric feeling.',
    '轻松': 'Light, casual, and easy to use in daily social settings.',
    '个性': 'A distinctive nickname with a slightly unconventional edge.',
    '游戏': 'A nickname that fits games and interest communities.',
    '英文': 'An English nickname whose original wording is part of its appeal.',
    '古风': 'A nickname inspired by classical Chinese imagery.',
    '自然': 'A nickname inspired by landscapes and the outdoors.',
    '情侣': 'A paired nickname with a warm, relational feeling.',
    '繁体': 'A traditional-character nickname with a classic visual style.',
    '两字': 'A compact two-character nickname that is easy to remember.',
    '三字': 'A rhythmic three-character nickname with a clear identity.',
    '四字': 'A four-character nickname with a phrase-like rhythm.',
    '简单': 'A straightforward nickname for everyday use.',
    '好听': 'A nickname chosen for its pleasant sound.',
    '符号': 'A decorated nickname using visual symbols.',
    '非主流': 'A niche, scene-inspired nickname with a strong style.',
    '微信': 'A casual nickname suited to everyday messaging.',
    '微博': 'A nickname suited to public posts and online discussion.',
    '空间': 'A nostalgic nickname with a personal-diary feeling.',
    '家族': 'A nickname connected to family identity.',
    '兄弟': 'A friendly nickname for close male friends.',
    '姐妹': 'A warm nickname for close female friends.',
    '小孩': 'A playful nickname with a youthful feeling.'
  };

  var ADAPT = {
    '晚风': 'Evening Breeze', '清和': 'Quiet Grace', '向晚': 'Toward Dusk', '见山': 'See the Mountain',
    '听风': 'Listening to Wind', '见鹿': 'Find the Deer', '未央': 'Never Ending', '小透明': 'Lowkey',
    '在逃公主': 'Princess on the Run', '社恐本恐': 'Introvert Energy', '摆烂中': 'Currently Unbothered', '醉花阴': 'Blossom Reverie'
  };

  var CAT_ADAPT = {
    '古风': 'Classical Echo', '诗意': 'Poetic Reverie', '意境': 'Atmospheric Note', '唯美': 'Quiet Beauty',
    '自然': 'Nature Note', '简洁': 'Quiet Form', '文艺': 'Poetic Mood', '轻松': 'Easygoing Mood',
    '年轻风': 'Current Vibe', '情绪': 'Mood Note', '酷感': 'Cool Edge', '温柔': 'Gentle Tone',
    '女生': 'Feminine Vibe', '男生': 'Masculine Vibe', '可爱': 'Cute Vibe', '小清新': 'Fresh Air',
    '帅气': 'Sharp Style', '霸气': 'Bold Energy', '超拽': 'Bold Attitude', '搞笑': 'Comic Relief',
    '爱情': 'Love Note', '情侣': 'Pair Vibe', '幸福': 'Happy Note', '励志': 'Motivated Spirit',
    '成熟': 'Mature Calm', '内涵': 'Subtle Meaning', '经典': 'Classic Feel', '游戏': 'Gaming Handle',
    '战队': 'Team Handle', '英文': 'English Handle', '中英': 'Bilingual Vibe'
  };

  function hasLatin(t) {
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) return true;
    }
    return false;
  }

  function scenesFor(cat) {
    if (cat === '游戏') return ['游戏', '社交昵称'];
    if (cat === '英文') return ['英文界面', '个人主页'];
    if (cat === '情侣') return ['情侣', '社交昵称'];
    if (cat === '微信') return ['微信', '日常社交'];
    return ['社交昵称', '个人主页'];
  }

  function romanized(text) {
    if (!NM) return text;
    var chars = text.split('');
    var pieces = [];
    var ok = true;
    for (var i = 0; i < chars.length; i++) {
      var it = NM.getChar(chars[i]);
      if (it && it.py) pieces.push(it.py.charAt(0).toUpperCase() + it.py.slice(1));
      else { ok = false; break; }
    }
    if (ok && pieces.length === chars.length) return pieces.join(' ');
    var py = NM.namePinyin(null, chars);
    if (py && py.split(' ').length === chars.length) return py;
    return 'Original Chinese nickname';
  }

  function englishAdapt(text, category) {
    if (ADAPT[text]) return ADAPT[text];
    return CAT_ADAPT[category] || 'A distinctive social mood';
  }

  function interpret(text, category, note, zhNote, enNote) {
    zhNote = zhNote || '';
    enNote = enNote || '';
    note = note || '';
    if (KNOWN[text]) {
      var k = KNOWN[text];
      return {
        literal: k.literal, adapted: k.adapted,
        explanation: k.explanationZh,
        explanationZh: k.explanationZh, explanationEn: k.explanationEn,
        scenes: k.scenes, sceneText: k.scenes.join('、')
      };
    }
    if (hasLatin(text)) {
      return {
        literal: text, adapted: text,
        explanation: zhNote || note || '保留英文原貌，适合英文社交场景。',
        explanationZh: zhNote || note || '保留英文原貌，适合英文社交场景。',
        explanationEn: enNote || EN_FALLBACK[category] || 'A distinctive social nickname with its own mood.',
        scenes: scenesFor(category),
        sceneText: scenesFor(category).join('、')
      };
    }
    var sc = scenesFor(category);
    return {
      literal: romanized(text),
      adapted: englishAdapt(text, category),
      explanation: zhNote || note || ('一个带有' + category + '气质的社交昵称。'),
      explanationZh: zhNote || note || ('一个带有' + category + '气质的社交昵称。'),
      explanationEn: enNote || EN_FALLBACK[category] || 'A distinctive social nickname with its own mood.',
      scenes: sc,
      sceneText: sc.join('、')
    };
  }

  window.NickInterp = { interpret: interpret };
})();
