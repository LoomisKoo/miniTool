/* 词卡物语 · 发音（纯浏览器内置语音合成，零体积、离线可用） */
(function (global) {
  'use strict';

  var synth = global.speechSynthesis;
  var Utter = global.SpeechSynthesisUtterance;
  var supported = !!(synth && Utter);

  var voices = [];
  var unlocked = false;
  var seq = 0;
  var lastAccent = 'us';

  function readVoices() {
    if (!supported) return voices;
    try { voices = synth.getVoices() || voices; } catch (e) {}
    return voices;
  }

  readVoices();

  // 部分 WebView 首次 getVoices() 为空，语音列表异步就绪
  if (supported) {
    var onReady = function () { readVoices(); };
    if (synth.addEventListener) {
      try { synth.addEventListener('voiceschanged', onReady); } catch (e) {}
    } else {
      try { synth.onvoiceschanged = onReady; } catch (e) {}
    }
  }

  function enVoices() {
    var all = readVoices();
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var l = String(all[i].lang || '').replace('_', '-');
      if (/^en/i.test(l)) out.push(all[i]);
    }
    return out;
  }

  function hasEnglish() {
    return enVoices().length > 0;
  }

  function pick(accent) {
    var want = accent === 'uk' ? 'en-gb' : 'en-us';
    var list = enVoices();
    if (!list.length) return null;
    var exact = [];
    for (var i = 0; i < list.length; i++) {
      var l = String(list[i].lang || '').replace('_', '-').toLowerCase();
      if (l.indexOf(want) === 0) exact.push(list[i]);
    }
    var pool = exact.length ? exact : list;
    var prefer = /natural|samantha|serena|daniel|karen|moira|alex|google|microsoft/i;
    for (var j = 0; j < pool.length; j++) {
      if (prefer.test(pool[j].name || '')) return pool[j];
    }
    return pool[0];
  }

  /* 首次必须是用户手势；先播一段静音把音频通道打开（iOS 需要） */
  function unlock() {
    if (!supported || unlocked) return;
    unlocked = true;
    try {
      var u = new Utter(' ');
      u.volume = 0;
      u.lang = 'en-US';
      synth.speak(u);
    } catch (e) {}
  }

  function speak(text, accent) {
    if (!supported || !text) return false;
    unlock();
    accent = accent === 'uk' ? 'uk' : 'us';
    lastAccent = accent;
    var id = ++seq;

    // 连续点击时先停掉上一句；cancel 后立刻 speak 在部分 Chromium 上会吞掉新句
    try { synth.cancel(); } catch (e) {}
    try { if (synth.paused) synth.resume(); } catch (e) {}

    var run = function () {
      if (id !== seq) return;
      var u = new Utter(String(text));
      u.lang = accent === 'uk' ? 'en-GB' : 'en-US';
      u.rate = 0.92;
      u.pitch = 1;
      u.volume = 1;
      var v = pick(accent);
      if (v) {
        u.voice = v;
        if (v.lang) u.lang = v.lang;
      }
      try { synth.speak(u); } catch (e) {}
    };
    if (typeof setTimeout === 'function') setTimeout(run, 40);
    else run();
    return true;
  }

  function stop() {
    seq++;
    if (!supported) return;
    try { synth.cancel(); } catch (e) {}
  }

  function diag() {
    var list = readVoices();
    return {
      supported: supported,
      unlocked: unlocked,
      total: list.length,
      english: enVoices().map(function (v) { return (v.name || '') + ' (' + v.lang + ')' + (v.localService ? ' 本地' : ' 在线'); }),
      picked: {
        us: (function (v) { return v ? (v.name || '') + ' (' + v.lang + ')' : '无'; })(pick('us')),
        uk: (function (v) { return v ? (v.name || '') + ' (' + v.lang + ')' : '无'; })(pick('uk'))
      }
    };
  }

  global.TTS = {
    supported: supported,
    speak: speak,
    stop: stop,
    unlock: unlock,
    hasEnglish: hasEnglish,
    voices: readVoices,
    diag: diag,
    get lastAccent() { return lastAccent; }
  };

  if (global.console && console.log) {
    try { console.log('[TTS]', diag()); } catch (e) {}
  }
})(window);
