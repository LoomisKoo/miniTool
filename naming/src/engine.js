/* 命名引擎 —— 纯函数，不碰 DOM。
 *
 * 思路：题量决定的是「尺子的精度」，不是「能出多少个结果」。
 *   8 道题 → 一个 7 维性格向量
 *   每个名字 → 同样 7 维（由组成它的字合成）
 *   两者求相似度 → 全库排序 → 前 N 名都说得通，再从中采样制造手感
 */
(function () {
  var NM = (window.NM = window.NM || {});
  var TK = NM.TRAIT_KEYS;
  var SK = NM.STYLE_KEYS;

  /* 字库拆在好几个文件里各自维护，重字难免。统一去掉（保留先出现的），
   * 否则同一个字会在拼装时被当成两个不同候选，白占名额。 */
  (function dedupeChars() {
    var seen = {}, keep = [];
    for (var i = 0; i < NM.CHARS.length; i++) {
      var c = NM.CHARS[i];
      if (seen[c.c]) continue;
      seen[c.c] = 1;
      keep.push(c);
    }
    NM.CHARS = keep;
  })();

  /* ── 向量工具 ─────────────────────────────── */

  function zero(keys) {
    var v = {};
    for (var i = 0; i < keys.length; i++) v[keys[i]] = 0;
    return v;
  }

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  /* 把多份权重包按轴取平均，天然落在 [-1,1]，且不受题目数量影响 */
  function averageVec(packs, keys) {
    var sum = zero(keys), cnt = zero(keys);
    for (var i = 0; i < packs.length; i++) {
      var p = packs[i] || {};
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (typeof p[key] === 'number') { sum[key] += p[key]; cnt[key] += 1; }
      }
    }
    var out = {};
    for (var j = 0; j < keys.length; j++) {
      var kk = keys[j];
      out[kk] = cnt[kk] ? clamp(sum[kk] / cnt[kk], -1, 1) : 0;
    }
    return out;
  }

  function cos(a, b, keys) {
    var dot = 0, na = 0, nb = 0;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i],
        x = a[k] || 0,
        y = b[k] || 0;
      dot += x * y; na += x * x; nb += y * y;
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  function addVec(target, src, scale) {
    for (var k in src) if (typeof src[k] === 'number') target[k] = (target[k] || 0) + src[k] * scale;
    return target;
  }

  /* ── 字 → 向量 ────────────────────────────── */

  var charIdx = null;
  function index() {
    if (charIdx) return charIdx;
    charIdx = {};
    var i;
    for (i = 0; i < NM.CHARS.length; i++) charIdx[NM.CHARS[i].c] = NM.CHARS[i];
    /* 音译字也进索引：读感校验与谐音黑名单对它们同样生效 */
    for (i = 0; i < NM.PHON_CHARS.length; i++) {
      if (!charIdx[NM.PHON_CHARS[i].c]) charIdx[NM.PHON_CHARS[i].c] = NM.PHON_CHARS[i];
    }
    return charIdx;
  }

  NM.getChar = function (c) { return index()[c] || null; };

  function charVec(ch) {
    var item = index()[ch];
    if (!item) return null;
    var dom = NM.DOMAINS[item.dom] || NM.DOMAINS.com;
    var t = addVec(addVec(zero(TK), dom.tr, 1), (item.adj && item.adj.tr) || {}, 1);
    var s = addVec(addVec(zero(SK), dom.st, 1), (item.adj && item.adj.st) || {}, 1);
    for (var i = 0; i < TK.length; i++) t[TK[i]] = clamp(t[TK[i]], -1, 1);
    for (var j = 0; j < SK.length; j++) s[SK[j]] = clamp(s[SK[j]], -1, 1);
    return { trait: t, style: s };
  }

  /* 名字向量 = 组成它的字的平均 */
  function givenVec(chars) {
    var ts = [], ss = [], used = [];
    for (var i = 0; i < chars.length; i++) {
      var v = charVec(chars[i]);
      if (!v) continue;
      ts.push(v.trait); ss.push(v.style); used.push(chars[i]);
    }
    if (!ts.length) return null;
    return { trait: averageVec(ts, TK), style: averageVec(ss, SK), chars: used };
  }

  function avgFreq(chars) {
    var n = 0, sum = 0;
    for (var i = 0; i < chars.length; i++) {
      var it = index()[chars[i]];
      if (it) { sum += it.freq; n++; }
    }
    return n ? sum / n : 3;
  }

  /* ── 从回答得到性格向量 ───────────────────── */

  NM.profileFromAnswers = function (answers) {
    var packs = [], novSum = 0, novCnt = 0;
    for (var i = 0; i < answers.length; i++) {
      var opt = answers[i];
      if (!opt) continue;
      if (opt.w) packs.push(opt.w);
      if (typeof opt.nov === 'number') { novSum += opt.nov; novCnt++; }
    }
    return {
      trait: averageVec(packs, TK),
      style: averageVec(packs, SK),
      nov: novCnt ? novSum / novCnt : 0.4,
      answered: packs.length
    };
  };

  /* ── 读感与合规校验（中文名的硬规则） ─────── */

  /* 姓氏拆成音节。单姓一到两个音节都可能：
   * 「李」→ [{py:'li',tone:3}]，「欧阳」→ [{py:'ou',tone:1},{py:'yang',tone:2}]。
   * 顺口度、校验、拼音显示都从这一个口子取，免得复姓到处漏。 */
  function surSyls(s) {
    if (!s) return [];
    if (s.pys && s.pys.length) {
      return s.pys.map(function (p, i) {
        return { py: p, tone: (s.tones && s.tones[i]) || 0 };
      });
    }
    return [{ py: s.py || '', tone: s.tone || 0 }];
  }
  NM.surSyls = surSyls;

  /* 姓氏的完整拼音串（复姓连起来），给「整名撞词」检查用 */
  function surPy(s) {
    var ss = surSyls(s);
    if (!ss.length) return '';
    var out = '';
    for (var i = 0; i < ss.length; i++) out += ss[i].py;
    return out;
  }
  NM.surPy = surPy;

  NM.isCompound = function (s) { return !!(s && s.pys && s.pys.length > 1); };

  /* ── 姓的搜索：拼音按音节对齐，不做「随便包含」 ──────────
   *   l     → 首字母浏览，列出所有 l 开头的姓
   *   ling  → 凌、令狐（音节打完整了，精确匹配）
   *   lingh → 令狐（最后一段音节只打了一半，前缀匹配）
   *   lin   → 只出林。不再顺带出凌（ling）、令狐（linghu）——
   *           「lin」自己已经是一个完整音节，不该再往后借字母。
   * 按上面的规则一条都筛不出来时，退回纯前缀兜底（wa → 王、汪）：
   * 宁可松一点，也不能搜出空列表。 */

  /* 合法音节表：从姓、字库、音译字里收，用来判断「这一段是不是已经打全了」 */
  var sylSet = null;
  function syllables() {
    if (sylSet) return sylSet;
    sylSet = Object.create(null);
    var i, ss;
    var pool = NM.allSurnames();
    for (i = 0; i < pool.length; i++) {
      ss = surSyls(pool[i]);
      for (var j = 0; j < ss.length; j++) if (ss[j].py) sylSet[ss[j].py] = 1;
    }
    var boxes = [NM.CHARS || [], NM.PHON_CHARS || []];
    for (i = 0; i < boxes.length; i++) {
      for (var k = 0; k < boxes[i].length; k++) if (boxes[i][k].py) sylSet[boxes[i][k].py] = 1;
    }
    return sylSet;
  }

  function pyHit(pys, kw) {
    var full = pys.join('');
    if (!full) return false;
    if (kw.length === 1) return full.indexOf(kw) === 0;
    var i = 0;
    for (var k = 0; k < pys.length; k++) {
      var p = pys[k];
      if (i >= kw.length) return true;
      var rest = kw.slice(i);
      if (rest.length >= p.length) {
        /* 这个音节被关键词整段覆盖，必须一字不差 */
        if (kw.slice(i, i + p.length) !== p) return false;
        i += p.length;
        continue;
      }
      /* 最后一段只打了半个音节：允许，但它本身已经是个完整音节就不行 */
      if (p.indexOf(rest) !== 0) return false;
      if (syllables()[rest]) return false;
      return true;
    }
    return i >= kw.length;
  }

  function surHit(s, kw, loose) {
    if (/[^\x00-\x7f]/.test(kw)) return String(s.c).indexOf(kw) !== -1;
    var ss = surSyls(s), pys = [];
    for (var i = 0; i < ss.length; i++) if (ss[i].py) pys.push(ss[i].py);
    if (!pys.length) return false;
    return loose ? pys.join('').indexOf(kw) === 0 : pyHit(pys, kw);
  }

  /* 搜索入口：list 传已经按筛选条件过滤过的姓氏数组 */
  NM.searchSurnames = function (list, kw) {
    kw = String(kw == null ? '' : kw).trim().toLowerCase().replace(/[^a-z\u4e00-\u9fa5]/g, '');
    if (!kw) return list.slice();
    var hit = list.filter(function (s) { return surHit(s, kw, false); });
    return hit.length ? hit : list.filter(function (s) { return surHit(s, kw, true); });
  };

  /* 全部姓氏：单姓 + 复姓。自选姓氏、工作台这类地方要能看到复姓。 */
  NM.allSurnames = function () {
    return NM.SURNAMES.concat(NM.COMPOUND_SURNAMES || []);
  };

  function validate(surname, chars, given, opts) {
    var box = index();
    var skipDomain = opts && opts.skipDomain;
    /* 名里不能再出现姓的那个字：「卫莎卫」看着就不像名字。
     * 复姓要逐字比，否则「欧阳 + 阳帆」这种会漏过去。 */
    if (surname && surname.c) {
      var sc = String(surname.c).split('');
      for (var si = 0; si < sc.length; si++) if (chars.indexOf(sc[si]) !== -1) return false;
      for (var sj = 0; sj < sc.length; sj++) if (given.indexOf(sc[sj]) !== -1) return false;
    }
    /* lite：只跑黑名单。库里自带的人工译名（赛勒斯、阿努克）常含字库外的常用字，
     * 拿字库的读感规则去卡它们只会把最好的答案卡掉。 */
    if (opts && opts.lite) {
      if (NM.isGivenBanned(given)) return false;
      if (NM.isFullBanned(surPy(surname), chars.map(function (c) { return box[c] ? box[c].py : ''; }).join(''))) return false;
      return true;
    }
    if (NM.isGivenBanned(given)) return false;
    if (NM.isFullBanned(surPy(surname), chars.map(function (c) { return box[c] ? box[c].py : ''; }).join(''))) return false;

    var tones = [], pys = [];
    var ss = surSyls(surname);
    for (var q = 0; q < ss.length; q++) { tones.push(ss[q].tone); pys.push(ss[q].py); }
    var nameSyls = 0;
    for (var i = 0; i < chars.length; i++) {
      var it = box[chars[i]];
      if (!it) return false;
      if (NM.isCharBanned(it.c)) return false;
      tones.push(it.tone);
      pys.push(it.py);
      nameSyls++;
    }

    /* 1. 三声连读（李雨婉 lǐ yǔ wǎn）读起来别扭。只看姓之后的名的音节 */
    var tone3 = tones.filter(function (t) { return t === 3; }).length;
    if (tones.length === 3 && tone3 === 3) return false;
    if (nameSyls >= 2 && tones.slice(-nameSyls).every(function (t) { return t === 3; })) return false;

    /* 2. 声调全同，读起来平板 */
    if (tones.length > 1 && tones.every(function (t) { return t === tones[0]; })) return false;

    /* 3. 音节重复（李丽、王婉婉） */
    for (var a = 0; a < pys.length; a++)
      for (var b = a + 1; b < pys.length; b++)
        if (pys[a] === pys[b]) return false;

    /* 4. 两个字不能重复 */
    if (chars.length === 2 && chars[0] === chars[1]) return false;

    /* 5. 意象域必须相容（「澈戈」这种拼不出来）。
     *    音译玩法跳过这一条：音译字本来就是为了读音挑的，语义不搭很正常。 */
    if (!skipDomain && chars.length === 2 && !NM.domainsCompatible(box[chars[0]].dom, box[chars[1]].dom)) return false;

    return true;
  }

  /* ── 打分 ─────────────────────────────────── */

  var W_TRAIT = 0.45, W_STYLE = 0.40, W_NOV = 0.15;
  /* 生辰宜补五行：性格仍是主轴，八字只做加分 */
  var W_WX = 0.14;

  function wxHit(chars, favor) {
    if (!favor || !favor.length) return 0;
    var box = index(), hit = 0, n = 0, i, it, wx;
    for (i = 0; i < chars.length; i++) {
      it = box[chars[i]];
      if (!it || it.phon) continue;
      n++;
      wx = NM.domainWx(it.dom);
      if (wx && favor.indexOf(wx) >= 0) hit++;
    }
    return n ? hit / n : 0;
  }

  function scoreVector(vec, chars, profile, extra) {
    var tSim = (cos(vec.trait, profile.trait, TK) + 1) / 2;   // 映射到 0..1
    var sSim = (cos(vec.style, profile.style, SK) + 1) / 2;
    var novelty = 1 - (avgFreq(chars) - 1) / 4;                // 字越少见越高
    var wx = wxHit(chars, profile.favorWx);
    var sc = W_TRAIT * tSim + W_STYLE * sSim + W_NOV * (profile.nov || 0.4) * novelty
      + W_WX * wx;
    return {
      score: sc + (extra || 0),
      tSim: tSim,
      sSim: sSim,
      novelty: novelty,
      wx: wx
    };
  }

  /* ── 候选生成 ─────────────────────────────── */

  /* topChars 要扫全字库逐字算余弦。rankNames 里每个姓都调一次，
   * 而 recommend 会跑 40 多个姓、chineseName 也要跑好几个 ——
   * 同一个 profile 下结果完全一样，不缓存就是白算上百遍。 */
  var _topMemo = { key: '', box: {} };
  function profileKey(p) {
    var a = [], k;
    for (k = 0; k < TK.length; k++) a.push(((p && p.trait && p.trait[TK[k]]) || 0).toFixed(3));
    for (k = 0; k < SK.length; k++) a.push(((p && p.style && p.style[SK[k]]) || 0).toFixed(3));
    a.push(((p && p.nov) || 0).toFixed(3));
    a.push((p && p.favorWx && p.favorWx.length) ? p.favorWx.join('') : '');
    return a.join(',');
  }

  function buildTopChars(profile, floor) {
    var list = [];
    var favor = profile.favorWx || [];
    for (var i = 0; i < NM.CHARS.length; i++) {
      var ch = NM.CHARS[i];
      if (ch.freq < floor) continue;
      var v = charVec(ch.c);
      var tSim = (cos(v.trait, profile.trait, TK) + 1) / 2;
      var sSim = (cos(v.style, profile.style, SK) + 1) / 2;
      var nov = 1 - (ch.freq - 1) / 4;
      var wx = 0;
      if (favor.length) {
        var w = NM.domainWx(ch.dom);
        if (w && favor.indexOf(w) >= 0) wx = 1;
      }
      list.push({
        ch: ch.c,
        s: W_TRAIT * tSim + W_STYLE * sSim + W_NOV * (profile.nov || 0.4) * nov + W_WX * wx
      });
    }
    list.sort(function (a, b) { return b.s - a.s; });
    return list.map(function (x) { return x.ch; });
  }

  function topChars(profile, n, minFreq) {
    var floor = minFreq || 1;
    var pk = profileKey(profile);
    if (_topMemo.key !== pk) { _topMemo.key = pk; _topMemo.box = {}; }
    if (!_topMemo.box[floor]) _topMemo.box[floor] = buildTopChars(profile, floor);
    return _topMemo.box[floor].slice(0, n);
  }

  function genderOk(chars, want) {
    if (!want || want === 'u') return true;
    var box = index();
    for (var i = 0; i < chars.length; i++) {
      var it = box[chars[i]];
      if (!it) continue;
      if (it.g === 'u') continue;
      if (it.g !== want) return false;
    }
    return true;
  }

  /* 用户反馈：不喜欢整名 / 排除某字 / 必须保留某字 */
  function passesFeedback(chars, given, full, opts) {
    if (!opts) return true;
    if (opts.banFull && opts.banFull[full]) return false;
    if (opts.banGiven && opts.banGiven[given]) return false;
    var i;
    if (opts.banChars) {
      for (i = 0; i < chars.length; i++) if (opts.banChars[chars[i]]) return false;
    }
    if (opts.keepChars && opts.keepChars.length) {
      for (i = 0; i < opts.keepChars.length; i++) {
        if (chars.indexOf(opts.keepChars[i]) === -1) return false;
      }
    }
    return true;
  }

  /**
   * 排序出候选名单。
   * @param profile  NM.profileFromAnswers 的结果
   * @param opts     { surname, wantGender, wantTags, limit, banFull, banGiven, banChars, keepChars }
   */
  NM.rankNames = function (profile, opts) {
    opts = opts || {};
    var surname = opts.surname || { c: '李', py: 'li', tone: 3 };
    var out = [];
    var seen = {};

    function push(given, chars, extra, source, note) {
      if (seen[given]) return;
      /* 精选名是真人用过的组合，跳过「意象域相容」这条——它本来就是给拼装名兜底的 */
      if (!validate(surname, chars, given, { skipDomain: source === 'curated' })) return;
      if (!passesFeedback(chars, given, surname.c + given, opts)) return;
      if (!genderOk(chars, opts.wantGender)) return;
      var vec = givenVec(chars);
      if (!vec) return;
      var sc = scoreVector(vec, chars, profile, extra);
      seen[given] = 1;
      out.push({
        given: given,
        chars: chars,
        surname: surname,
        full: surname.c + given,
        score: sc.score,
        tSim: sc.tSim,
        sSim: sc.sSim,
        novelty: sc.novelty,
        source: source || 'created',
        note: note || '',
        vec: vec
      });
    }

    /* 1) 精选名：真人在用的组合，优先出场 */
    for (var i = 0; i < NM.GIVEN.length; i++) {
      var g = NM.GIVEN[i];
      if (opts.wantTags && opts.wantTags.length && opts.wantTags.indexOf(g.tag) === -1) continue;
      if (opts.wantGender && opts.wantGender !== 'u' && g.g !== 'u' && g.g !== opts.wantGender) continue;
      push(g.n, g.n.split(''), 0, 'curated', g.m);
    }
    /* 精选名整体排在拼装名前：tier 0 在前，各自按分数排 */
    for (var q = 0; q < out.length; q++) out[q].tier = 0;

    /* 2) 字库拼装：组合只用常见一点的字，生僻字留给单字名 */
    var poolLo = topChars(profile, 40, 2);
    var pool = topChars(profile, 30, 3);
    var first = out.length;
    for (var a = 0; a < poolLo.length; a++) {
      push(poolLo[a], [poolLo[a]], -0.05, 'created', '');      // 单字名
    }
    for (var a2 = 0; a2 < pool.length; a2++) {
      for (var b = 0; b < pool.length; b++) {
        if (a2 === b) continue;
        push(pool[a2] + pool[b], [pool[a2], pool[b]], 0, 'created', '');
      }
    }
    for (var r = first; r < out.length; r++) out[r].tier = 1;

    out.sort(function (x, y) {
      if (x.tier !== y.tier) return x.tier - y.tier;
      return y.score - x.score;
    });
    return opts.limit ? out.slice(0, opts.limit) : out;
  };

  /* 单字的展示文案：音译字没有实在含义，就展示读音，别硬凑释义 */
  NM.charNote = function (ch) {
    var it = index()[ch];
    if (!it) return { py: '', text: '音译用字，取其读音', phon: true };
    return { py: it.py, text: it.phon ? '音译用字，取其读音' : it.m, phon: !!it.phon };
  };

  /* 暴露给界面：给定字数组，返回它的性格/审美向量 */
  NM.vectorOf = givenVec;

  /* ── 采样：别永远给 Top1，否则一眼假 ─────── */

  NM.sampleTop = function (list, temperature, count, exclude, keyFn) {
    var key = keyFn || function (x) { return x.full || x.given; };
    var ex = exclude || {};
    var pool = list.filter(function (x) { return !ex[key(x)]; }).slice(0, 60);
    if (!pool.length) return [];
    var T = temperature || 0.7;
    var max = pool[0].score;
    var weights = pool.map(function (x) { return Math.exp((x.score - max) / T); });
    var picked = [], weightsLeft = weights.slice(), idxLeft = pool.map(function (_, i) { return i; });
    for (var n = 0; n < (count || 1); n++) {
      var total = 0;
      for (var i = 0; i < idxLeft.length; i++) total += weightsLeft[idxLeft[i]];
      if (total <= 0) break;
      var r = Math.random() * total, acc = 0, chosen = idxLeft[0];
      for (var j = 0; j < idxLeft.length; j++) {
        acc += weightsLeft[idxLeft[j]];
        if (r <= acc) { chosen = idxLeft[j]; break; }
      }
      picked.push(pool[chosen]);
      idxLeft.splice(idxLeft.indexOf(chosen), 1);
      if (!idxLeft.length) break;
    }
    return picked;
  };

  /* 工作台用：给出「读起来怎么样」的具体反馈，而不是只返回 true/false */
  NM.readability = function (surname, chars) {
    var box = index(), issues = [], good = [];
    var tones = [], pys = [], names = [];
    var ss = surSyls(surname);
    for (var si = 0; si < ss.length; si++) { tones.push(ss[si].tone); pys.push(ss[si].py); }
    names.push(surname.c);
    for (var i = 0; i < chars.length; i++) {
      var it = box[chars[i]];
      if (!it) { issues.push('「' + chars[i] + '」不在字库里'); continue; }
      tones.push(it.tone); pys.push(it.py); names.push(it.c);
    }
    if (tones.length === 3 && tones.every(function (t) { return t === 3; })) issues.push('三个三声连读，念着拗口');
    else if (tones.length > 1 && tones.every(function (t) { return t === tones[0]; })) issues.push('声调全同，念起来太平');
    else good.push('声调有起伏');

    var dupSyl = false;
    for (var a = 0; a < pys.length; a++)
      for (var b = a + 1; b < pys.length; b++)
        if (pys[a] === pys[b]) dupSyl = true;
    if (dupSyl) issues.push('有音节重复，容易混淆');
    else good.push('没有重音');

    if (chars.length === 2) {
      if (chars[0] === chars[1]) issues.push('两个字重复了');
      else if (box[chars[0]] && box[chars[1]] && !NM.domainsCompatible(box[chars[0]].dom, box[chars[1]].dom))
        issues.push('两个字意象差得远，凑在一起不像名字');
      else good.push('字与字意象相容');
    }
    if (NM.isGivenBanned(chars.join(''))) issues.push('这个组合有负面谐音，不建议');
    if (NM.isFullBanned(surPy(surname), chars.map(function (c) { return box[c] ? box[c].py : ''; }).join('')))
      issues.push('连起来读会撞上不好的词');

    var avg = 0, n = 0;
    for (var k = 0; k < chars.length; k++) if (box[chars[k]]) { avg += box[chars[k]].freq; n++; }
    avg = n ? avg / n : 3;
    if (avg <= 1.6) good.push('用字少见，不容易撞名');
    else if (avg >= 4.6) good.push('用字常见，稳妥好认');

    return { ok: issues.length === 0, issues: issues, good: good, full: names.join('') };
  };

  /* ── 姓氏气质与「姓 + 名」顺口度 ─────────── */

  var INI_RE = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])/;

  /* 拆出拉丁化的声母与韵母，用来推音感 */
  function splitPy(py) {
    var s = String(py || '').toLowerCase();
    var m = INI_RE.exec(s);
    return m ? { ini: m[1], fin: s.slice(m[1].length) } : { ini: '', fin: s };
  }

  function iniClass(ini) {
    if (!ini) return 'zero';
    if (/^(zh|ch|sh|r)$/.test(ini)) return 'retro';
    if (/^[zcs]$/.test(ini)) return 'sibilant';
    if (/^[jqx]$/.test(ini)) return 'palatal';
    if (/^[gkh]$/.test(ini)) return 'velar';
    if (/^[bpmf]$/.test(ini)) return 'labial';
    if (/^[dtnl]$/.test(ini)) return 'apical';
    return 'zero';   /* y / w 起头一律按零声母处理 */
  }

  /* 韵母口型：开口 / 齐齿 / 合口 / 撮口 */
  function finClass(fin) {
    if (!fin) return 'open';
    if (/^v/.test(fin)) return 'tucked';
    if (/^u/.test(fin)) return 'round';
    if (/^i/.test(fin)) return 'front';
    return 'open';
  }

  /* 姓的气质 = 声母 + 韵母 + 声调 的推导值，再叠手工覆写。
   * 除以 1.6 是因为三层叠加后总量会超出 [-1,1]，归一化一下。
   * 复姓逐音节累加后按音节数摊平：「欧阳」是 ou+yang 两段音感的平均。 */
  NM.surnameVec = function (s) {
    var t = zero(TK), st = zero(SK);
    if (!s) return { trait: t, style: st };
    var syls = surSyls(s);
    if (!syls.length) return { trait: t, style: st };
    for (var k = 0; k < syls.length; k++) {
      var parts = splitPy(syls[k].py);
      var g = NM.INITIAL_TRAIT[iniClass(parts.ini)];
      if (g) { addVec(t, g.tr, 1); addVec(st, g.st || {}, 1); }
      var f = NM.FINAL_TRAIT[finClass(parts.fin)];
      if (f) { addVec(t, f.tr, 1); addVec(st, f.st || {}, 1); }
      var tn = NM.TONE_TRAIT[syls[k].tone];
      if (tn) { addVec(t, tn.tr, 1); addVec(st, tn.st || {}, 1); }
    }
    /* 复姓的音感总量天然是单姓的两倍，不摊平会让复姓永远「最有性格」 */
    var scale = syls.length > 1 ? 1 / syls.length : 1;
    for (var a = 0; a < TK.length; a++) t[TK[a]] = t[TK[a]] * scale;
    for (var b = 0; b < SK.length; b++) st[SK[b]] = st[SK[b]] * scale;
    var ov = NM.SURNAME_OVERRIDE[s.c];
    if (ov) { addVec(t, ov.tr || {}, 1); addVec(st, ov.st || {}, 1); }
    for (var i = 0; i < TK.length; i++) t[TK[i]] = clamp(t[TK[i]] / 1.6, -1, 1);
    for (var j = 0; j < SK.length; j++) st[SK[j]] = clamp(st[SK[j]] / 1.6, -1, 1);
    return { trait: t, style: st };
  };

  /* 一句话形容这个姓的听感，给推荐列表用。
   * 用绝对阈值不行 —— 声母/韵母/声调三层叠加再除以 1.6 之后，
   * 数值普遍落在 ±0.4 内，绝大多数姓都判成「百搭」，标签等于没有。
   * 改成看这个姓在全体姓氏里的相对位置：取偏得最狠的两个轴来贴标签。 */
  var VIBE_LABEL = {
    warm: ['温润', '清冷'],
    out:  ['开阔', '内敛'],
    sta:  ['端稳', '轻灵'],
    rat:  ['谨严', '疏朗'],
    cla:  ['古典', '时新'],
    sim:  ['简洁', '华美'],
    exp:  ['爽利', '含蕴']
  };

  var _vibeRange = null;
  function vibeRange() {
    if (_vibeRange) return _vibeRange;
    var keys = [], k, i;
    for (k = 0; k < TK.length; k++) keys.push(TK[k]);
    for (k = 0; k < SK.length; k++) keys.push(SK[k]);
    var min = {}, max = {};
    for (i = 0; i < keys.length; i++) { min[keys[i]] = 9; max[keys[i]] = -9; }
    for (i = 0; i < NM.SURNAMES.length; i++) {
      var v = NM.surnameVec(NM.SURNAMES[i]);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var x = v.trait[key] !== undefined ? v.trait[key] : v.style[key];
        if (x < min[key]) min[key] = x;
        if (x > max[key]) max[key] = x;
      }
    }
    _vibeRange = { keys: keys, min: min, max: max, scale: 0 };
    /* 所有轴统一用同一个尺度。不然像 rat 这种只有个别姓非零的轴，
     * 自己的极差极小，稍微一动就被算成「偏得最狠」，把别的轴全压掉。 */
    for (i = 0; i < keys.length; i++) {
      var half = (max[keys[i]] - min[keys[i]]) / 2;
      if (half > _vibeRange.scale) _vibeRange.scale = half;
    }
    if (!_vibeRange.scale) _vibeRange.scale = 1;
    return _vibeRange;
  }

  NM.surnameVibe = function (s) {
    var v = NM.surnameVec(s);
    var R = vibeRange();
    var pick = [];
    for (var i = 0; i < R.keys.length; i++) {
      var key = R.keys[i];
      var x = v.trait[key] !== undefined ? v.trait[key] : v.style[key];
      if (R.max[key] - R.min[key] < 0.06) continue;    /* 这个轴几乎没波动，说了等于没说 */
      var mid = (R.max[key] + R.min[key]) / 2;
      var n = (x - mid) / R.scale;                     /* 相对位置，落在 -1..1 */
      if (Math.abs(n) < 0.34) continue;                /* 不够突出就不说 */
      pick.push({ n: n, label: VIBE_LABEL[key][n > 0 ? 0 : 1] });
    }
    pick.sort(function (a, b) { return Math.abs(b.n) - Math.abs(a.n); });
    var bits = pick.slice(0, 2).map(function (p) { return p.label; });
    if (!bits.length) return '百搭';
    return bits.join(' · ');
  };

  /**
   * 「姓 + 名」念起来顺不顺，返回 0..1。
   * 只做加减、不做归一化：起评分 0.60，加项满分刚好到 1.0，
   * 这样分档（朗朗上口 / 顺口 / 念着顺 / 稍拗口）才有意义。
   * 只看读音；字义是否合适由 scoreVector 管，这里不重复。
   */
  NM.euphony = function (surname, chars) {
    var box = index();
    var tones = [], pys = [];
    var ss = surSyls(surname);
    for (var s = 0; s < ss.length; s++) {
      if (ss[s].py) { tones.push(ss[s].tone); pys.push(ss[s].py); }
    }
    for (var i = 0; i < chars.length; i++) {
      var it = box[chars[i]];
      if (it) { tones.push(it.tone); pys.push(it.py); }
    }
    if (!pys.length) return 0.5;

    var score = 0.60;

    /* 1. 声调硬伤 */
    var allSame = tones.length > 1 && tones.every(function (t) { return t === tones[0]; });
    var threeThird = tones.length >= 3 && tones.every(function (t) { return t === 3; });
    if (threeThird) score -= 0.34;        /* 李雨婉 lǐ yǔ wǎn，连着三个三声最拗口 */
    else if (allSame) score -= 0.24;      /* 全平调，念着呆 */
    for (var a = 0; a + 1 < tones.length; a++) if (tones[a] === tones[a + 1]) score -= 0.09;

    /* 2. 调高起伏。用赵元任五度标记取各调的平均音高，全平的调子拿不到分。 */
    var PITCH = { 1: 5, 2: 4, 3: 2.5, 4: 3 };
    var hi = 0, lo = 9;
    for (var q = 0; q < tones.length; q++) {
      var p = PITCH[tones[q]] || 3;
      if (p > hi) hi = p;
      if (p < lo) lo = p;
    }
    score += ((hi - lo) / 2.5) * 0.10;

    /* 3. 平（1/2 声）仄（3/4 声）交替 */
    var alt = 0, pairs = 0;
    for (var b = 0; b + 1 < tones.length; b++) {
      pairs++;
      if ((tones[b] <= 2) !== (tones[b + 1] <= 2)) alt++;
    }
    if (pairs) score += (alt / pairs) * 0.08;

    /* 4. 整音节重复（李丽、王婉婉）——最伤念感的一条 */
    for (var x = 0; x < pys.length; x++) {
      for (var y = x + 1; y < pys.length; y++) if (pys[x] && pys[x] === pys[y]) score -= 0.32;
    }

    /* 5. 相邻声母 / 韵母别撞车 */
    for (var k = 0; k + 1 < pys.length; k++) {
      var p1 = splitPy(pys[k]), p2 = splitPy(pys[k + 1]);
      if (p1.ini && p1.ini === p2.ini) score -= 0.11;
      if (p1.fin && p1.fin === p2.fin) score -= 0.04;
    }

    /* 6. 口型有变化才活 */
    var cls = [];
    for (var m = 0; m < pys.length; m++) cls.push(finClass(splitPy(pys[m]).fin));
    if (pys.length > 1) {
      var ch = 0;
      for (var n = 0; n + 1 < cls.length; n++) if (cls[n] !== cls[n + 1]) ch++;
      score += (ch / (pys.length - 1)) * 0.08;
    }

    /* 7. 响亮感：开口呼的韵母占比（李知微 li zhi wei 全在齿间，江疏桐 jiang shu tong 就敞亮得多） */
    var open = 0;
    for (var r = 0; r < cls.length; r++) if (cls[r] === 'open' || cls[r] === 'round') open++;
    score += (open / cls.length) * 0.14;

    /* 8. 音节数：三音节最稳，两音节略单薄，五个以上偏长 */
    if (pys.length === 2) score -= 0.05;
    else if (pys.length >= 5) score -= 0.08;

    return clamp(score, 0, 1);
  };

  /* 顺口度给个人话标签。档位是按真实分布切的（中位数 0.85、P90 0.94），
   * 直接显示「顺口度 92%」看着像假的，说人话更好。 */
  NM.euphonyLabel = function (e) {
    if (e >= 0.93) return '朗朗上口';
    if (e >= 0.85) return '顺口';
    if (e >= 0.72) return '念着顺';
    return '稍拗口';
  };

  /**
   * 按性格给姓氏排序。recommend() 内部的打分就是这一套，
   * 单独抽出来是因为自选姓氏页不需要配名，只要「哪些姓和你搭」。
   */
  NM.rankSurnames = function (profile, opts) {
    opts = opts || {};
    var list = [];
    var source = opts.all ? NM.allSurnames() : NM.SURNAMES;
    for (var i = 0; i < source.length; i++) {
      var s = source[i];
      var sv = NM.surnameVec(s);
      var tSim = (cos(sv.trait, profile.trait, TK) + 1) / 2;
      var sSim = (cos(sv.style, profile.style, SK) + 1) / 2;
      var cosFit = 0.58 * tSim + 0.42 * sSim;
      /* 常见度先验。没有它的话，余弦会奖励「信号最强」的姓，
       * 于是储、邬、春、应这些少见姓会挤掉李、王、林、苏。
       * 0.62/0.38 是调出来的：萧（冷，pop4）能压过李（中性，pop5），
       * 但 pop1 的冷门姓压不过常见姓。 */
      var common = ((s.pop || 3) - 1) / 4;
      list.push({ sur: s, fit: 0.62 * cosFit + 0.38 * common, cosFit: cosFit, vec: sv });
    }
    list.sort(function (a, b) { return b.fit - a.fit; });
    return opts.limit ? list.slice(0, opts.limit) : list;
  };

  /* ── 推荐：成套的「姓 + 名」 ─────────────── */

  /**
   * 和 rankNames 的区别：姓本身也参与打分（读音气质 vs 你的性格），
   * 且每组都要求念着顺口。返回的是多组不同姓氏的组合。
   * @param opts { wantGender, count, breadth, temperature, exclude, banFull, banGiven, banChars, keepChars }
   */
  NM.recommend = function (profile, opts) {
    opts = opts || {};
    var want = opts.count || 6;
    var breadth = opts.breadth || 44;
    var fb = {
      banFull: opts.banFull || {},
      banGiven: opts.banGiven || {},
      banChars: opts.banChars || {},
      keepChars: opts.keepChars || []
    };

    /* 1) 所有姓先算「和你有多搭」 */
    var ranked = NM.rankSurnames(profile);

    /* 2) 只在最搭的一批姓里找名字 —— 否则为了凑多样性，会推一个完全不搭的姓。
     *    用 usedGiven 记已经推过的名：不然「婳」这种高度贴合的名会在每个姓下面
     *    都拿第一，六条推荐出来是「梁婳、石婳、周婳」，等于没换。 */
    var out = [];
    var usedGiven = {};
    for (var k = 0; k < Math.min(breadth, ranked.length); k++) {
      var item = ranked[k];
      var names = NM.rankNames(profile, {
        surname: item.sur, wantGender: opts.wantGender, limit: 80,
        banFull: fb.banFull, banGiven: fb.banGiven, banChars: fb.banChars, keepChars: fb.keepChars
      });
      if (!names.length) continue;
      var best = null;
      for (var n = 0; n < names.length; n++) {
        if (usedGiven[names[n].given]) continue;
        if (fb.banFull[item.sur.c + names[n].given]) continue;
        var eu = NM.euphony(item.sur, names[n].chars);
        var sc = names[n].score * 0.70 + eu * 0.30;
        if (!best || sc > best.combined) best = { name: names[n], eu: eu, combined: sc };
      }
      if (!best) continue;
      usedGiven[best.name.given] = true;
      out.push({
        surname: item.sur,
        name: best.name,
        given: best.name.given,
        chars: best.name.chars,
        full: item.sur.c + best.name.given,
        fit: item.fit,
        euphony: best.eu,
        surVec: item.vec,
        score: best.combined * (0.70 + 0.30 * item.fit)
      });
    }

    out.sort(function (a, b) { return b.score - a.score; });
    /* 采样而非取前 N：每次进结果页都有新鲜感，但不会给出明显不搭的姓。
     * 按姓氏去重，所以同一批里不会出现两个同姓。 */
    var picked = NM.sampleTop(out, opts.temperature || 0.28, want,
      opts.exclude || {}, function (x) { return x.surname.c; });
    return picked.length ? picked : out.slice(0, want);
  };

  /* 选了姓之后，列出这个姓下的名字 */
  NM.namesForSurname = function (profile, surname, opts) {
    opts = opts || {};
    var list = NM.rankNames(profile, {
      surname: surname,
      wantGender: opts.wantGender,
      banFull: opts.banFull,
      banGiven: opts.banGiven,
      banChars: opts.banChars,
      keepChars: opts.keepChars
    });
    /* 按「名字好 + 顺口」重排，顺口度占三成——不然会推出「李知微」这种
     * 字都好但两个 i 韵叠在一起的名字 */
    for (var i = 0; i < list.length; i++) {
      list[i].euphony = NM.euphony(surname, list[i].chars);
      list[i].mix = list[i].score * 0.70 + list[i].euphony * 0.30;
    }
    list.sort(function (a, b) {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return b.mix - a.mix;
    });
    return list;
  };

  /* ── 拼音相似度（音译玩法用） ─────────────── */

  function lev(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur.slice();
    }
    return prev[n];
  }

  function phonSim(a, b) {
    a = (a || '').toLowerCase().replace(/[^a-z]/g, '');
    b = (b || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.indexOf(b) === 0 || b.indexOf(a) === 0) return 0.78;
    var d = lev(a, b), max = Math.max(a.length, b.length);
    var sim = 1 - d / max;
    /* 首字母一致加分，中文音译最看重字头 */
    if (a[0] === b[0]) sim += 0.12;
    return clamp(sim, 0, 1);
  }
  NM.phonSim = phonSim;

  /* 把拉丁名切成近似音节：Emma → ['em','ma']，Sofia → ['so','fi','a'] */
  var ONSETS = ['ch', 'sh', 'th', 'ph', 'wh', 'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr',
    'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw',
    'qu', 'kn', 'wr', 'gn', 'ps', 'pn', 'gh'];
  function isVowel(c) { return 'aeiouy'.indexOf(c) !== -1; }

  NM.romanSyllables = function (word) {
    var w = (word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return [];
    var parts = [], cur = '';
    for (var i = 0; i < w.length; i++) {
      var c = w[i];
      if (cur && isVowel(cur[cur.length - 1]) && !isVowel(c)) {
        var rest = w.slice(i);
        var m = rest.match(/^([^aeiouy]+)([aeiouy][\s\S]*)$/);
        if (m) {
          var cons = m[1], on = '';
          for (var k = Math.min(3, cons.length); k >= 1; k--) {
            if (ONSETS.indexOf(cons.slice(cons.length - k)) !== -1) { on = cons.slice(cons.length - k); break; }
          }
          if (!on) on = cons[cons.length - 1];
          var carry = cons.slice(0, cons.length - on.length);   /* 剩下的辅音当韵尾归上一音节 */
          cur += carry;
          parts.push(cur);
          cur = on;
          i += cons.length - 1;
          continue;
        }
      }
      cur += c;
    }
    if (cur) parts.push(cur);
    return parts.length ? parts : [w];
  };

  /* 一个拉丁音节可能对应的中文拼音（含韵母换写、-m → -n 等常见转写规则） */
  /* 一个拉丁音节可能对应的中文拼音。
   * 每个候选取法带「改写代价」：越接近原拼写的取法分越高，
   * 这样 'em' 会优先匹配 en（恩）而不是退化成单个 e（厄）。
   */
  var NUCLEUS = {
    a: ['a', 'ai', 'ya'], e: ['e', 'ei', 'ai', 'i'], ee: ['i'], ea: ['i'], i: ['i', 'yi'],
    ie: ['i'], o: ['o', 'uo', 'ao'], oo: ['u'], u: ['u', 'ou', 'yu'], y: ['i'],
    ai: ['ai'], ay: ['ai', 'ei'], ou: ['ou', 'o'], ow: ['ou', 'ao'], au: ['ao'],
    ei: ['ei'], ey: ['i'], oe: ['o'], ue: ['u', 'yu'], ui: ['ui', 'u'],
    ia: ['ia', 'ya'], io: ['io', 'o'], iu: ['iu', 'you'], ua: ['ua', 'wa'], uo: ['uo', 'o']
  };
  var ONSET_MAP = {
    c: ['k', 's'], k: ['k'], ch: ['q', 'ch'], sh: ['sh'], th: ['s', 't'], ph: ['f'],
    v: ['w', 'f'], w: ['w', 'wei'], x: ['sh', 's'], z: ['z', 's'], j: ['j'],
    qu: ['q'], y: ['y', ''], h: ['h'], r: ['l', 'r'], l: ['l'], g: ['g'],
    gh: ['g'], kn: ['n'], wr: ['r'], wh: ['w'], ps: ['s'], gn: ['n']
  };

  var C_STRIP_CODA = 0.20, C_M_TO_N = 0.15, C_DOUBLE = 0.05, C_EXPAND = 0.15,
    C_SINGLE_VOWEL = 0.22, C_ONSET_FIX = 0.10;

  function syllCandidates(syl) {
    var map = {};
    function add(s, cost) {
      if (!s || s.length > 4 || !/^[a-z]+$/.test(s)) return;
      if (!(s in map) || map[s] > cost) map[s] = cost;
    }
    add(syl, 0);
    add(syl.replace(/m$/, 'n'), C_M_TO_N);
    add(syl.replace(/[mn]$/, ''), C_STRIP_CODA);
    add(syl.replace(/(.)\1/g, '$1'), C_DOUBLE);
    var m = syl.match(/^([^aeiouy]*)([aeiouy]+)([a-z]*)$/);
    if (m) {
      /* 声母（含辅音簇）拆成一组候选，各自带代价。
       * Grace 的 gr 在中文音译里通常取首辅音（格），所以簇本身和各单辅音都要试。 */
      var opts = [];
      if (!m[1]) {
        opts.push({ on: '', cost: 0 });
      } else if (ONSET_MAP[m[1]]) {
        ONSET_MAP[m[1]].forEach(function (o) { opts.push({ on: o, cost: 0 }); });
      } else {
        opts.push({ on: m[1], cost: 0 });
        for (var ci = 0; ci < m[1].length; ci++) {
          (ONSET_MAP[m[1][ci]] || [m[1][ci]]).forEach(function (o) {
            opts.push({ on: o, cost: C_ONSET_FIX });
          });
        }
      }
      var nuc = (NUCLEUS[m[2]] || [m[2]]).slice();
      var singles = [];
      for (var v = 0; v < m[2].length; v++) if (nuc.indexOf(m[2][v]) === -1) singles.push(m[2][v]);
      var codas = [m[3], m[3].replace(/m$/, 'n'), ''];
      for (var i = 0; i < opts.length; i++)
        for (var j = 0; j < nuc.length; j++)
          for (var k = 0; k < codas.length; k++)
            add(opts[i].on + nuc[j] + codas[k], C_EXPAND + opts[i].cost);
      /* 复合韵母再拆成单韵母各试一次：fia → fi（菲 就是这样匹配上的） */
      for (var s2 = 0; s2 < singles.length; s2++)
        for (var k2 = 0; k2 < codas.length; k2++)
          add(opts[0].on + singles[s2] + codas[k2], C_SINGLE_VOWEL);
    }
    return Object.keys(map).map(function (k) { return { py: k, cost: map[k] }; });
  }

  /* 音译：给定拉丁名，找发音最贴的中文字，再按性格/审美排序 */
  NM.translitChars = function (latin, profile, opts) {
    opts = opts || {};
    var syls = NM.romanSyllables(latin);
    if (!syls.length) return [];
    var pool = NM.PHON_CHARS;

    /* 每个音节挑发音最像的一批字（带改写代价，越贴近原音节分越高）。
     * 若一个都没过阈值，就退而取前几名 —— 宁可给个勉强贴音的名字，也别让用户空手而归。 */
    var perSyl = syls.slice(0, 2).map(function (syl) {
      var cands = syllCandidates(syl);
      var scored = pool.map(function (ch) {
        var best = 0;
        for (var i = 0; i < cands.length; i++) {
          var s = phonSim(cands[i].py, ch.py) - cands[i].cost;
          if (s > best) best = s;
        }
        return { ch: ch, sim: best };
      });
      scored.sort(function (a, b) { return b.sim - a.sim; });
      var good = scored.filter(function (x) { return x.sim > 0.55; });
      return (good.length >= 4 ? good : scored).slice(0, 12);
    });
    if (!perSyl.length || !perSyl[0].length) return [];

    var combos = [];
    if (perSyl.length === 1 || !perSyl[1] || !perSyl[1].length) {
      perSyl[0].forEach(function (x) { combos.push({ chars: [x.ch.c], phon: x.sim }); });
    } else {
      perSyl[0].forEach(function (a) {
        perSyl[1].forEach(function (b) {
          if (a.ch.c === b.ch.c) return;
          combos.push({ chars: [a.ch.c, b.ch.c], phon: (a.sim + b.sim) / 2 });
        });
      });
    }

    var sur = opts.surname || { py: '', tone: 0 };
    var out = [];
    for (var i = 0; i < combos.length; i++) {
      var chars = combos[i].chars, given = chars.join('');
      if (!validate(sur, chars, given, { skipDomain: true })) continue;
      var vec = givenVec(chars);
      if (!vec) continue;
      var tSim = (cos(vec.trait, profile.trait, TK) + 1) / 2;
      var sSim = (cos(vec.style, profile.style, SK) + 1) / 2;
      var nov = 1 - (avgFreq(chars) - 1) / 4;
      out.push({
        given: given, chars: chars, phSim: combos[i].phon,
        score: 0.55 * combos[i].phon + 0.25 * tSim + 0.20 * sSim,
        tSim: tSim, sSim: sSim, novelty: nov, vec: vec, source: 'translit',
        note: '贴「' + latin + '」的发音，' + chars.map(function (c) {
          var it = index()[c];
          return c + '取' + (it ? it.py : '') + '音';
        }).join('、')
      });
    }
    out.sort(function (a, b) { return b.score - a.score; });

    /* 去重：音译字表里有同字多条（不同域），会让同一组合重复出现 */
    var seenGiven = {}, uniq = [];
    for (var d = 0; d < out.length; d++) {
      if (seenGiven[out[d].given]) continue;
      seenGiven[out[d].given] = 1;
      uniq.push(out[d]);
    }
    out = uniq;

    /* 常见英文名直接给通行中文写法（Grace → 格蕾丝，而不是算法拼出来的「拉凯」）。
     * 优先用英文名库自带的 zh：它是完整、通行的译名（Silas → 赛勒斯）；
     * 库里没有（用户手打的生僻名）再退回人工对照表。 */
    var key = String(latin).replace(/[^A-Za-z]/g, '').toLowerCase();
    var hit = null;
    for (var e = 0; e < NM.NAMES_EN.length; e++) {
      if (NM.NAMES_EN[e].n.toLowerCase() === key) { hit = NM.NAMES_EN[e].zh; break; }
    }
    if (!hit) {
      for (var k in NM.EN_GIVEN_ZH) {
        if (k.toLowerCase() === key) { hit = NM.EN_GIVEN_ZH[k]; break; }
      }
    }
    if (hit) {
      var hitChars = hit.split('');
      if (validate(sur, hitChars, hit, { lite: true })) {
        /* 库里自带的通行译名常含字库外的常用字（如「阿努克」），
         * 这时 givenVec 会返回 null —— 不能因此丢掉这条最好的结果，退化成中性向量即可。 */
        var hv = givenVec(hitChars);
        if (!hv) hv = { trait: zero(TK), style: zero(SK), chars: hitChars };
        out = out.filter(function (x) { return x.given !== hit; });
        out.unshift({
          given: hit, chars: hitChars, phSim: 1,
          score: 2, tSim: 1, sSim: 1, novelty: 0, vec: hv, source: 'translit',
          note: '「' + latin + '」的通行中文写法，读音与气质都贴合'
        });
      }
    }
    return out;
  };

  /* ── 外文名 → 正常中文名 ─────────────────────
   * 和音译正相反。音译是把音节一个个换成汉字，得到「格蕾丝」这种读音贴、
   * 语义为零的写法。这里要的是中国人真会取的名字：
   *   姓 → 照原名的「音头」挑（g → 高/郭/葛/顾），也可能挑到复姓
   *   名 → 完全走中文取名那套（意象域相容 + 性格向量 + 读感校验 + 顺口度），
   *        只把「音色别离原名太远」当成一个小加分项，不做硬约束
   * 所以 Grace 出来的是「顾清妍」这一类，而不是「格蕾丝」。
   */

  /* 拉丁首字母 → 可以对应的中文声母。不按精确读音配对，按「音头」配对：
   * 外国人取中文姓本来也是这么配的，硬贴读音反而会配出奇怪的姓。 */
  var LATIN_HEAD = {
    b: ['b'], p: ['p'], m: ['m'], f: ['f'], v: ['w', 'f'],
    d: ['d'], t: ['t'], n: ['n'], l: ['l'], r: ['l', 'r'],
    g: ['g'], k: ['k', 'g'], c: ['k', 's'], x: ['s', 'sh', 'x'],
    s: ['s', 'sh', 'x'], z: ['z', 'zh'], j: ['j', 'zh'], q: ['q', 'ch'],
    h: ['h'], w: ['w', 'y'], y: ['y'], e: ['', 'y'], a: ['', 'y'],
    i: ['', 'y'], o: ['', 'y'], u: ['', 'y']
  };

  /* 首字母 → 中文声母 */
  function headClasses(word) {
    var w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return null;
    var two = w.slice(0, 2);
    if (two === 'ch') return ['ch', 'q'];
    if (two === 'sh') return ['sh', 's'];
    if (two === 'th') return ['s', 't'];
    if (two === 'ph') return ['f'];
    if (two === 'wh') return ['w'];
    if (two === 'gh') return ['g'];
    return LATIN_HEAD[w[0]] || null;
  }

  function iniOfPy(py) {
    var ini = splitPy(py).ini;
    /* y / w 起头的拼音在 iniClass 里算零声母，但和拉丁的 y/w 是对得上的 */
    return ini;
  }

  /**
   * 照读音挑姓氏。有 family（Wilson）就用 family 的音，
   * 只有名字（Grace）就用名字首音节的音头 —— 顾/高 听起来像 Grace 的开头。
   * @returns [{ 姓氏对象, head: 音头贴合度 0..1, fit: 综合分 }]
   */
  NM.matchSurnames = function (latin, family, opts) {
    opts = opts || {};
    var src = family || latin;
    var want = headClasses(src);
    var list = [];
    var pool = NM.allSurnames();
    for (var i = 0; i < pool.length; i++) {
      var s = pool[i];
      var first = surSyls(s)[0];
      if (!first) continue;
      var ini = iniOfPy(first.py);
      var head = 0;
      if (want) {
        if (want.indexOf(ini) !== -1) head = 1;
        else if (ini === '' && want.indexOf('') !== -1) head = 1;
        else if (ini && want.indexOf(ini[0]) !== -1) head = 0.5;
      }
      /* 复姓本身少见，给一点点降权，否则「司马杰」这种会挤掉「石杰」 */
      var common = ((s.pop || 3) - 1) / 4;
      var fit = head * 0.62 + common * 0.30 - (NM.isCompound(s) ? 0.06 : 0);
      list.push({ surname: s, head: head, fit: fit });
    }
    list.sort(function (a, b) { return b.fit - a.fit; });
    return list;
  };

  /* 名字的音色跟原名的贴合度（0..1）。对齐方式：名字第 i 个字按比例
   * 落到原名的某个音节上，再看那个字能不能读成该音节的近似音。 */
  function soundAffinity(chars, sylls) {
    if (!sylls || !sylls.length) return 0;
    var box = index();
    var cands = [];
    for (var i = 0; i < sylls.length; i++) cands.push(syllCandidates(sylls[i]));
    var total = 0, n = 0;
    for (var c = 0; c < chars.length; c++) {
      var it = box[chars[c]];
      if (!it) continue;
      var si = chars.length === 1 ? 0
        : Math.round(c * (cands.length - 1) / Math.max(1, chars.length - 1));
      var best = 0, set = cands[si] || [];
      for (var k = 0; k < set.length; k++) {
        var v = phonSim(it.py, set[k].py) - set[k].cost;
        if (v > best) best = v;
      }
      total += Math.max(0, best);
      n++;
    }
    return n ? total / n : 0;
  }
  NM.soundAffinity = soundAffinity;

  /**
   * 外文名 → 一组正常中文名（姓 + 名，名字 1~2 字，总长 2~3 字）
   * @param latin  given 部分，如 'Grace'
   * @param profile NM.profileFromAnswers 的结果
   * @param opts  { family: 'Wilson', wantGender, count }
   * @returns [{ surname, given, chars, full, score, sound, euphony, note, vec }]
   */
  NM.chineseName = function (latin, profile, opts) {
    opts = opts || {};
    latin = String(latin || '').trim();
    if (!latin) return [];
    var sylls = NM.romanSyllables(latin);
    if (!sylls.length) return [];

    var matched = NM.matchSurnames(latin, opts.family, {});
    var surs = matched.slice(0, 6);
    /* 复姓要「能出现」但不必抢戏：单独留一个位置给最合适的复姓，
     * 否则高、郭、葛这些常见单姓会把它挤掉，「当然可以包含复姓」就成了空话。 */
    if (!surs.some(function (x) { return NM.isCompound(x.surname); })) {
      for (var q = 0; q < matched.length; q++) {
        if (NM.isCompound(matched[q].surname)) { surs.push(matched[q]); break; }
      }
    }
    var out = [], seen = {};

    for (var s = 0; s < surs.length; s++) {
      var cand = surs[s], sur = cand.surname;
      /* 复姓已经占两个字，名就只给一个字，总长才落在「两三个字」里 */
      var wantLen = NM.isCompound(sur) ? 1 : 2;
      var pool = NM.namesForSurname(profile, sur, { wantGender: opts.wantGender });
      var taken = 0;
      for (var i = 0; i < pool.length && taken < 140; i++) {
        var x = pool[i];
        if (x.chars.length !== wantLen) continue;
        if (seen[x.full]) continue;
        var sound = soundAffinity(x.chars, sylls);
        var eu = x.euphony == null ? NM.euphony(sur, x.chars) : x.euphony;
        var mix = x.score * 0.54 + eu * 0.20 + sound * 0.13 + cand.fit * 0.13;
        seen[x.full] = 1;
        taken++;
        out.push({
          surname: sur, given: x.given, chars: x.chars, full: x.full,
          score: mix, sound: sound, euphony: eu, surFit: cand.fit,
          source: x.source, note: x.note, vec: x.vec, tier: x.tier
        });
      }
    }

    out.sort(function (a, b) { return b.score - a.score; });
    /* 采样而不是取前 N：都是同一个姓的高分名，直接截断会全挤在一个人身上 */
    var picked = NM.sampleTop(out, opts.temperature || 0.34, opts.count || 8, {},
      function (x) { return x.full; });
    /* 采样是随机的，可能把复姓那条抽掉。至少保一条，让「复姓」真的看得见。 */
    if (opts.allowCompound !== false && !picked.some(function (x) { return NM.isCompound(x.surname); })) {
      var comp = out.filter(function (x) { return NM.isCompound(x.surname); })[0];
      if (comp) {
        if (picked.length >= (opts.count || 8) && picked.length > 1) picked[picked.length - 1] = comp;
        else picked.push(comp);
      }
    }
    return picked;
  };

  /* ── 英文名侧 ─────────────────────────────── */

  NM.rankEnNames = function (profile, opts) {
    opts = opts || {};
    var wantEra = opts.wantEra || 'now';
    var eraScore = { ancient: 0, vintage: 1, mid: 2, modern: 3, now: 4 };
    var wantEraN = eraScore[wantEra] == null ? 4 : eraScore[wantEra];
    var out = [];
    for (var i = 0; i < NM.NAMES_EN.length; i++) {
      var it = NM.NAMES_EN[i];
      if (opts.wantGender && opts.wantGender !== 'u' && it.g !== 'u' && it.g !== opts.wantGender) continue;
      var tSim = (cos(it.tr, profile.trait, TK) + 1) / 2;
      var sSim = (cos(it.st, profile.style, SK) + 1) / 2;
      var dist = Math.abs((eraScore[it.era] == null ? 2 : eraScore[it.era]) - wantEraN);
      var eraFit = 1 - dist / 4;
      out.push({
        name: it, score: 0.42 * tSim + 0.30 * sSim + 0.28 * eraFit,
        tSim: tSim, sSim: sSim, eraFit: eraFit
      });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  };

  /* 中文名 → 英文名：按音近 + 性格 */
  NM.enFromChinese = function (profile, pinyinSyls, opts) {
    var list = NM.rankEnNames(profile, opts);
    if (!pinyinSyls || !pinyinSyls.length) return list;
    var first = pinyinSyls[0];
    for (var i = 0; i < list.length; i++) {
      var it = list[i].name;
      var ps = phonSim(first, it.snd);
      list[i].phon = ps;
      list[i].score = list[i].score * 0.82 + 0.18 * ps;
    }
    list.sort(function (a, b) { return b.score - a.score; });
    return list;
  };

  /* ── 性格雷达（结果页画图用） ─────────────── */

  NM.radar = function (profile, vec) {
    return NM.AXES.map(function (ax) {
      var k = ax.key;
      var mine = (profile[ax.group === 'style' ? 'style' : 'trait'][k] || 0);
      var name = (vec[ax.group === 'style' ? 'style' : 'trait'][k] || 0);
      return {
        key: k,
        label: ax.label,
        low: ax.low,
        high: ax.high,
        mine: Math.round(((mine + 1) / 2) * 100),
        name: Math.round(((name + 1) / 2) * 100)
      };
    });
  };

  /* 只看「你」的雷达图（结果页顶部用，此时还没有具体名字可比） */
  NM.radarSelf = function (profile) {
    return NM.AXES.map(function (ax) {
      var v = profile[ax.group === 'style' ? 'style' : 'trait'][ax.key] || 0;
      var pct = Math.round(((v + 1) / 2) * 100);
      return { key: ax.key, label: ax.label, low: ax.low, high: ax.high, mine: pct, name: pct };
    });
  };

  /* 用一句话描述这个性格（结果页的「一句话人格」） */
  NM.describe = function (profile) {
    var t = profile.trait;
    var parts = [];
    parts.push(t.warm >= 0.15 ? '温和' : t.warm <= -0.15 ? '清冷' : '不冷不热');
    parts.push(t.out >= 0.15 ? '外向' : t.out <= -0.15 ? '内敛' : '张弛有度');
    parts.push(t.rat >= 0.15 ? '偏理性' : t.rat <= -0.15 ? '凭感觉' : '理性与直觉各半');
    parts.push(t.sta >= 0.15 ? '稳' : t.sta <= -0.15 ? '跳脱' : '节奏自由');
    return parts.join('、');
  };

  /* 换文化：同一份性格在别的名字池里叫什么（跨文化对照） */
  NM.crossCulture = function (profile, opts) {
    opts = opts || {};
    var res = {};
    /* 中文 */
    var zh = NM.sampleTop(NM.rankNames(profile, { wantGender: opts.wantGender }), 0.6, 1, opts.excludeZh || {});
    res.zh = zh[0] || null;
    /* 英文 */
    var en = NM.sampleTop(NM.rankEnNames(profile, { wantGender: opts.wantGender }), 0.6, 1,
      opts.excludeEn || {}, function (x) { return x.name.n; });
    res.en = en[0] || null;
    return res;
  };
})();
