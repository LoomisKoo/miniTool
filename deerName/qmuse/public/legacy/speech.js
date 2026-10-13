/* 读音体检（拼音 / 声调 / 多音字 / 读感）—— 对应 SpeechHelper.inspect；朗读仅 iOS App */
(function () {
  var NM = window.NM;

  var POLYPHONES = {
    '茜': { name: 'qiàn', alt: 'xī', note: '名字里多读 qiàn' },
    '柏': { name: 'bó', alt: 'bǎi', note: '人名里多读 bó' },
    '乐': { name: 'lè', alt: 'yuè', note: '名字里常见 lè，也有 yuè' },
    '行': { name: 'xíng', alt: 'háng', note: '名字里多读 xíng' },
    '予': { name: 'yǔ', alt: 'yú', note: '名字里多读 yǔ' },
    '朝': { name: 'cháo', alt: 'zhāo', note: '名字里两种都常见' },
    '重': { name: 'chóng', alt: 'zhòng', note: '名字里多读 chóng' },
    '长': { name: 'cháng', alt: 'zhǎng', note: '名字里多读 cháng' },
    '单': { name: 'shàn', alt: 'dān', note: '作姓读 shàn' },
    '解': { name: 'xiè', alt: 'jiě', note: '作姓读 xiè' },
    '曾': { name: 'zēng', alt: 'céng', note: '作姓读 zēng' },
    '查': { name: 'zhā', alt: 'chá', note: '作姓读 zhā' },
    '区': { name: 'ōu', alt: 'qū', note: '作姓读 ōu' },
    '朴': { name: 'piáo', alt: 'pǔ', note: '作姓读 piáo' },
    '缪': { name: 'miào', alt: 'móu', note: '作姓读 miào' },
    '覃': { name: 'qín', alt: 'tán', note: '作姓读 qín' },
    '仇': { name: 'qiú', alt: 'chóu', note: '作姓读 qiú' },
    '盖': { name: 'gě', alt: 'gài', note: '作姓读 gě' },
    '翟': { name: 'zhái', alt: 'dí', note: '作姓读 zhái' },
    '员': { name: 'yùn', alt: 'yuán', note: '作姓读 yùn' },
    '秘': { name: 'bì', alt: 'mì', note: '作姓读 bì' },
    '繁': { name: 'pó', alt: 'fán', note: '作姓读 pó' },
    '召': { name: 'shào', alt: 'zhào', note: '作姓读 zhào' },
    '万': { name: 'wàn', alt: 'mò', note: '复姓「万俟」读 mò' }
  };

  function inspect(surname, chars) {
    chars = chars || [];
    var syllables = [];
    var polyphones = [];
    var tones = [];

    if (surname) {
      var pys = surname.pys || [surname.py];
      var tns = surname.tones || [surname.tone];
      var sc = surname.c.split('');
      sc.forEach(function (ch, i) {
        var py = i < pys.length ? pys[i] : surname.py;
        syllables.push({ ch: ch, py: py });
        tones.push(i < tns.length ? tns[i] : surname.tone);
        if (POLYPHONES[ch]) {
          var p = POLYPHONES[ch];
          polyphones.push({ ch: ch, namePy: p.name, altPy: p.alt, note: p.note });
        }
      });
    }
    chars.forEach(function (ch) {
      var c = NM.getChar(ch);
      var py = c ? c.py : '';
      syllables.push({ ch: ch, py: py });
      tones.push(c ? c.tone : 0);
      if (POLYPHONES[ch]) {
        var pp = POLYPHONES[ch];
        polyphones.push({ ch: ch, namePy: pp.name, altPy: pp.alt, note: pp.note });
      }
    });

    var readability = NM.readability(surname, chars);
    return { syllables: syllables, polyphones: polyphones, readability: readability, toneWave: tones };
  }

  window.SpeechHelper = {
    polyphones: POLYPHONES,
    inspect: inspect
  };
})();
