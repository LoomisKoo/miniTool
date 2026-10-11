(function () {
  'use strict';

  var SCENES = [
    { id: 'bubble', title: '吹泡泡', desc: '晶莹浮起', ico: '○' },
    { id: 'dandelion', title: '吹蒲公英', desc: '绒毛纷飞', ico: '❋' },
    { id: 'balloon', title: '吹气球', desc: '胀满礼花', ico: '◉' },
    { id: 'pinwheel', title: '吹风车', desc: '转速看气息', ico: '✿' }
  ];

  var GOALS = {
    bubble: '吹出大泡泡',
    dandelion: '吹散绒毛',
    balloon: '吹到胀满',
    pinwheel: '高速转满 4 秒',
    lung: '坚持吹气 6 秒'
  };

  var HINTS = {
    bubble: '吹气冒出泡泡，越吹越大',
    dandelion: '吹散蒲公英，看绒毛飞远',
    balloon: '吹气让气球变大，胀满就砰',
    pinwheel: '吹动风车，保持高速旋转',
    lung: '深吸后用力吹，尽量坚持'
  };

  var STORAGE_KEY = 'breath-garden-v1';
  var SIM_STRENGTH = 0.78;
  var LUNG_HOLD = 6;

  var $ = function (id) {
    return document.getElementById(id);
  };

  var stage = $('stage3d');
  var glow = $('glow');
  var engine = new BreathEngine();
  var audio = new BreathAudio();
  var runner = new SceneRunner(stage);

  var currentScene = null;
  var playing = false;
  var sessionActive = false;
  var raf = 0;
  var lastT = 0;
  var stabilitySnap = 0.5;
  var pendingResult = null;
  var simLock = { on: false, pointerId: null };
  var dotTimer = 0;

  var el = {
    homeView: $('homeView'),
    playView: $('playView'),
    backBtn: $('backBtn'),
    muteBtn: $('muteBtn'),
    brandBlock: $('brandBlock'),
    playActions: $('playActions'),
    startMicBtn: $('startMicBtn'),
    playHint: $('playHint'),
    simHint: $('simHint'),
    goalChip: $('goalChip'),
    goalLabel: $('goalLabel'),
    goalCount: $('goalCount'),
    goalFill: $('goalFill'),
    meterFill: $('meterFill'),
    meterPeak: $('meterPeak'),
    resultOv: $('resultOv'),
    resultTag: $('resultTag'),
    resultGrade: $('resultGrade'),
    resultStats: $('resultStats'),
    lungBestHint: $('lungBestHint')
  };

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveStore(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  function setSim(on) {
    simLock.on = on;
    engine.setSimulating(on, SIM_STRENGTH);
    if (on) {
      audio.resume();
      engine.tick(16);
      vibrate(12);
    }
  }

  function stopSim() {
    if (!simLock.on) return;
    simLock.on = false;
    simLock.pointerId = null;
    engine.setSimulating(false);
    if (pendingResult) {
      var snap = pendingResult;
      pendingResult = null;
      showResult(snap);
    }
  }

  function isInteractiveTarget(target) {
    if (!target || !target.closest) return false;
    if (target.closest('.overlay:not(.hidden)')) return true;
    if (target.closest('.home:not(.hidden)')) return true;
    if (target.closest('#backBtn, #muteBtn, #startMicBtn, [data-keep-pointer]')) return true;
    return false;
  }

  function buildGrid() {
    var grid = $('sceneGrid');
    grid.innerHTML = '';
    SCENES.forEach(function (s) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.dataset.scene = s.id;
      var ico = document.createElement('span');
      ico.className = 'card-ico';
      ico.setAttribute('aria-hidden', 'true');
      ico.textContent = s.ico;
      var title = document.createElement('span');
      title.className = 'card-title';
      title.textContent = s.title;
      var desc = document.createElement('span');
      desc.className = 'card-desc';
      desc.textContent = s.desc;
      btn.appendChild(ico);
      btn.appendChild(title);
      btn.appendChild(desc);
      btn.addEventListener('click', function () {
        openScene(s.id);
      });
      grid.appendChild(btn);
    });
    var store = loadStore();
    if (store.lung && store.lung.grade) {
      el.lungBestHint.textContent = '最佳 ' + store.lung.grade;
    }
    if (store.muted) {
      audio.setMuted(true);
      el.muteBtn.classList.add('muted');
    }
  }

  function setPlayMode(on) {
    if (on) document.body.classList.add('play-mode');
    else document.body.classList.remove('play-mode');
  }

  function setBlowSession(on) {
    if (on) document.body.classList.add('blow-session');
    else document.body.classList.remove('blow-session');
  }

  function resetGoal() {
    el.goalLabel.textContent = currentScene ? GOALS[currentScene] : '';
    el.goalCount.textContent = '0%';
    el.goalFill.style.width = '0%';
    el.goalChip.hidden = false;
    el.goalChip.classList.remove('show');
    requestAnimationFrame(function () {
      el.goalChip.classList.add('show');
    });
  }

  function prepareScene(id) {
    currentScene = id;
    playing = false;
    sessionActive = false;
    pendingResult = null;
    stopSim();
    setBlowSession(false);
    runner.setScene(id);
    runner.onComplete = onSceneComplete;
    runner.resize();
    el.resultOv.classList.add('hidden');
  }

  function openScene(id) {
    prepareScene(id);
    el.homeView.classList.add('hidden');
    el.playView.classList.remove('hidden');
    el.backBtn.hidden = false;
    el.brandBlock.style.opacity = '0';
    el.muteBtn.hidden = false;
    el.playActions.classList.remove('hidden');
    el.startMicBtn.disabled = false;
    el.startMicBtn.textContent = '开始吹气';
    el.playHint.textContent = '点击「开始吹气」，对准麦克风';
    el.simHint.hidden = true;
    el.meterFill.style.width = '0%';
    el.meterPeak.style.opacity = '0';
    setPlayMode(true);
    resetGoal();
    stopLoop();
    runner.render();
    loop();
  }

  function goHome() {
    currentScene = null;
    playing = false;
    sessionActive = false;
    pendingResult = null;
    stopSim();
    setBlowSession(false);
    engine.stop();
    stopLoop();
    el.homeView.classList.remove('hidden');
    el.playView.classList.add('hidden');
    el.backBtn.hidden = true;
    el.brandBlock.style.opacity = '1';
    el.muteBtn.hidden = true;
    el.resultOv.classList.add('hidden');
    el.goalChip.classList.remove('show');
    setPlayMode(false);
    glow.style.opacity = '0';
  }

  function dots(label, stop) {
    if (dotTimer) {
      clearInterval(dotTimer);
      dotTimer = 0;
    }
    if (stop) {
      el.playHint.textContent = label;
      return;
    }
    var n = 0;
    el.playHint.textContent = label;
    dotTimer = setInterval(function () {
      n = (n + 1) % 4;
      el.playHint.textContent = label + new Array(n + 1).join('·');
    }, 320);
  }

  function beginPlay() {
    engine.resetSession();
    playing = true;
    sessionActive = true;
    setBlowSession(true);
    el.playActions.classList.add('hidden');
    var simOnly = !engine.active;
    el.simHint.hidden = !simOnly;
    if (currentScene === 'lung') {
      var step = 2;
      dots('吸气 2 秒');
      audio.countdown();
      runner.state.phase = 'inhale';
      var iv = setInterval(function () {
        if (!sessionActive) {
          clearInterval(iv);
          return;
        }
        step--;
        if (step <= 0) {
          clearInterval(iv);
          runner.state.phase = 'blow';
          runner.state.blowT = 0;
          audio.countdown();
          dots('用力吹，坚持 ' + LUNG_HOLD + ' 秒', true);
          el.playHint.textContent = '用力吹，坚持 ' + LUNG_HOLD + ' 秒';
        } else {
          el.playHint.textContent = '吸气 ' + step + ' 秒';
        }
      }, 1000);
    } else {
      el.playHint.textContent = HINTS[currentScene] + (simOnly ? '（按住屏幕）' : '');
    }
    lastT = performance.now();
    if (!raf) loop();
  }

  function startMicFlow() {
    el.startMicBtn.disabled = true;
    audio.ensure();
    audio.resume();
    dots('正在聆听环境噪声');
    engine
      .start()
      .then(function () {
        return engine.calibrate(1100);
      })
      .then(function () {
        dots('', true);
        beginPlay();
      })
      .catch(function () {
        dots('', true);
        el.startMicBtn.disabled = false;
        el.playHint.textContent = '没有麦克风权限，按住屏幕模拟吹气';
        el.simHint.hidden = false;
        beginPlay();
      });
  }

  function onSceneComplete() {
    if (!playing) return;
    playing = false;
    audio.fanfare();
    vibrate([14, 40, 22]);
    var snap = engine.scoreLung(stabilitySnap);
    if (simLock.on) {
      pendingResult = snap;
      dots('本关完成，松手查看成绩', true);
      return;
    }
    sessionActive = false;
    setBlowSession(false);
    showResult(snap);
  }

  function animateNumber(node, to, suffix, decimals) {
    var from = 0;
    var t0 = performance.now();
    var dur = 520;
    function frame(now) {
      var p = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      var v = from + (to - from) * e;
      node.textContent = v.toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function addStat(k, value, suffix, decimals) {
    var li = document.createElement('li');
    var kk = document.createElement('span');
    kk.textContent = k;
    var vv = document.createElement('span');
    vv.textContent = decimals ? (0).toFixed(decimals) + suffix : '0' + suffix;
    li.appendChild(kk);
    li.appendChild(vv);
    el.resultStats.appendChild(li);
    animateNumber(vv, value, suffix, decimals);
  }

  function showResult(snap) {
    sessionActive = false;
    setBlowSession(false);
    glow.style.opacity = '0';
    var store = loadStore();
    var tag = '本次';
    if (currentScene === 'lung') {
      tag = '肺活量';
      if (!store.lung || snap.value > (store.lung.value || 0)) {
        store.lung = { grade: snap.grade, value: snap.value };
        saveStore(store);
        el.lungBestHint.textContent = '最佳 ' + snap.grade;
      }
    } else {
      for (var i = 0; i < SCENES.length; i++) {
        if (SCENES[i].id === currentScene) tag = SCENES[i].title;
      }
    }
    el.resultTag.textContent = tag;
    el.resultGrade.textContent = snap.grade;
    el.resultStats.innerHTML = '';
    addStat('峰值气息', Math.round(snap.peak * 100), '%', 0);
    addStat('坚持', snap.sustain, ' 秒', 1);
    addStat('稳定度', Math.round(stabilitySnap * 100), '%', 0);
    el.resultOv.classList.remove('hidden');
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function loop() {
    var now = performance.now();
    var dt = Math.min(48, now - lastT || 16);
    lastT = now;
    if (simLock.on) engine.setSimulating(true, SIM_STRENGTH);
    var breath = engine.tick(dt);
    stabilitySnap = breath.stability;
    el.meterFill.style.width = Math.round(breath.flow * 100) + '%';
    if (breath.peak > 0.06) {
      el.meterPeak.style.left = Math.round(breath.peak * 100) + '%';
      el.meterPeak.style.opacity = '1';
    }
    glow.style.opacity = String(Math.min(0.75, breath.flow * 0.85));
    if (audio.ready && !audio.muted) audio.setFlow(breath.flow);

    if (playing) {
      runner.update(dt, breath);
      var progress = runner.getProgress();
      if (currentScene === 'lung') {
        progress = Math.min(1, breath.sustain / LUNG_HOLD);
        if (runner.state.phase === 'blow' && breath.peak > 0.45 && breath.sustain > LUNG_HOLD) {
          runner.state.phase = 'done';
          onSceneComplete();
        }
      }
      el.goalFill.style.width = Math.round(progress * 100) + '%';
      el.goalCount.textContent = Math.round(progress * 100) + '%';
    }
    runner.render();
    raf = requestAnimationFrame(loop);
  }

  function setupSim() {
    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (!sessionActive || simLock.on) return;
      if (isInteractiveTarget(e.target)) return;
      simLock.pointerId = e.pointerId != null ? e.pointerId : null;
      setSim(true);
      if (e.preventDefault) e.preventDefault();
    }

    function onUp(e) {
      if (!simLock.on) return;
      if (simLock.pointerId != null && e.pointerId != null && e.pointerId !== simLock.pointerId) return;
      if (e.buttons !== undefined && e.buttons !== 0) return;
      stopSim();
    }

    function onMove(e) {
      if (!simLock.on) return;
      if (e.buttons === 0) stopSim();
    }

    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('mouseup', onUp, true);
    window.addEventListener('blur', stopSim);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopSim();
    });
  }

  $('welcomeBtn').addEventListener('click', function () {
    audio.ensure();
    $('welcomeOv').classList.add('hidden');
  });

  el.startMicBtn.addEventListener('click', startMicFlow);

  el.backBtn.addEventListener('click', goHome);

  el.muteBtn.addEventListener('click', function () {
    var muted = !audio.muted;
    audio.ensure();
    audio.setMuted(muted);
    el.muteBtn.classList.toggle('muted', muted);
    var store = loadStore();
    store.muted = muted;
    saveStore(store);
  });

  $('lungCard').addEventListener('click', function () {
    openScene('lung');
  });

  $('resultHomeBtn').addEventListener('click', function () {
    el.resultOv.classList.add('hidden');
    goHome();
  });

  $('resultAgainBtn').addEventListener('click', function () {
    el.resultOv.classList.add('hidden');
    if (!currentScene) return;
    var id = currentScene;
    var resume = function () {
      prepareScene(id);
      setPlayMode(true);
      beginPlay();
      if (!raf) loop();
    };
    if (engine.active) {
      dots('准备再来一次');
      engine.calibrate(420).then(function () {
        dots('', true);
        resume();
      });
    } else {
      resume();
    }
  });

  window.addEventListener('resize', function () {
    runner.resize();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      runner.resize();
    });
  }

  buildGrid();
  setupSim();
  runner.setScene('pinwheel');
  runner.resize();
})();
