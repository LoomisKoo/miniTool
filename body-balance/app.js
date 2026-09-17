(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const state = {
    gender: null, tab: 'food', foodCategory: '全部', activityCategory: '全部', logs: [], lastEvent: '', eventHistory: new Map(), milestones: new Set(),
    profile: { height: 167, age: 28, weight: 60, activity: 1.55 }
  };
  const foods = [
    // 主食
    { icon: '🍚', name: '番茄牛腩饭', cal: 580, protein: 24, category: '主食' },
    { icon: '🥚', name: '西红柿炒蛋', cal: 260, protein: 13, category: '主食' },
    { icon: '🍗', name: '香煎鸡排饭', cal: 620, protein: 35, category: '主食' },
    { icon: '🍜', name: '牛肉面', cal: 560, protein: 27, category: '主食' },
    { icon: '🥟', name: '猪肉白菜饺子', cal: 430, protein: 19, category: '主食' },
    { icon: '🍛', name: '咖喱鸡饭', cal: 610, protein: 28, category: '主食' },
    { icon: '🍳', name: '蛋炒饭', cal: 520, protein: 14, category: '主食' },
    { icon: '🍙', name: '白米饭一碗', cal: 230, protein: 4, category: '主食' },
    { icon: '🥣', name: '小米粥', cal: 150, protein: 4, category: '主食' },
    { icon: '🍠', name: '蒸红薯', cal: 130, protein: 2, category: '主食' },
    { icon: '🍞', name: '全麦面包两片', cal: 160, protein: 6, category: '主食' },
    { icon: '🥯', name: '肉包子', cal: 250, protein: 9, category: '主食' },
    // 饮品
    { icon: '🥛', name: '牛奶', cal: 130, protein: 7, category: '饮品' },
    { icon: '🧋', name: '奶茶', cal: 380, protein: 3, category: '饮品' },
    { icon: '💧', name: '白水一杯', cal: 0, protein: 0, category: '饮品' },
    { icon: '🍶', name: '豆浆', cal: 120, protein: 7, category: '饮品' },
    { icon: '☕', name: '美式咖啡', cal: 5, protein: 0, category: '饮品' },
    { icon: '🥤', name: '拿铁', cal: 180, protein: 8, category: '饮品' },
    { icon: '🍨', name: '原味酸奶', cal: 130, protein: 6, category: '饮品' },
    { icon: '🧃', name: '橙汁', cal: 180, protein: 1, category: '饮品' },
    { icon: '🍵', name: '绿茶', cal: 0, protein: 0, category: '饮品' },
    { icon: '🥫', name: '可乐', cal: 140, protein: 0, category: '饮品' },
    // 水果
    { icon: '🍎', name: '苹果', cal: 95, protein: 0, category: '水果' },
    { icon: '🍌', name: '香蕉', cal: 105, protein: 1, category: '水果' },
    { icon: '🍉', name: '西瓜两片', cal: 90, protein: 1, category: '水果' },
    { icon: '🍊', name: '橙子', cal: 62, protein: 1, category: '水果' },
    { icon: '🍇', name: '葡萄一小串', cal: 90, protein: 1, category: '水果' },
    { icon: '🍓', name: '草莓', cal: 35, protein: 1, category: '水果' },
    { icon: '🫐', name: '蓝莓', cal: 60, protein: 1, category: '水果' },
    { icon: '🥝', name: '猕猴桃', cal: 60, protein: 1, category: '水果' },
    { icon: '🥭', name: '芒果', cal: 100, protein: 1, category: '水果' },
    { icon: '🍅', name: '圣女果', cal: 30, protein: 1, category: '水果' },
    { icon: '🍈', name: '火龙果', cal: 110, protein: 2, category: '水果' },
    // 烧烤快餐
    { icon: '🍔', name: '芝士牛肉汉堡', cal: 520, protein: 25, category: '烧烤快餐' },
    { icon: '🍢', name: '孜然羊肉串', cal: 360, protein: 22, category: '烧烤快餐' },
    { icon: '🍟', name: '薯条', cal: 330, protein: 4, category: '烧烤快餐' },
    { icon: '🍖', name: '炸鸡翅', cal: 480, protein: 26, category: '烧烤快餐' },
    { icon: '🌶️', name: '麻辣烫', cal: 550, protein: 20, category: '烧烤快餐' },
    { icon: '🥞', name: '烤冷面', cal: 400, protein: 12, category: '烧烤快餐' },
    { icon: '🥙', name: '煎饼果子', cal: 450, protein: 15, category: '烧烤快餐' },
    { icon: '🍕', name: '披萨两片', cal: 570, protein: 22, category: '烧烤快餐' },
    { icon: '🥧', name: '蛋挞', cal: 220, protein: 4, category: '烧烤快餐' },
    // 零食甜品
    { icon: '🍰', name: '草莓奶油蛋糕', cal: 420, protein: 5, category: '零食甜品' },
    { icon: '🍿', name: '爆米花', cal: 280, protein: 4, category: '零食甜品' },
    { icon: '🥜', name: '一小把坚果', cal: 190, protein: 6, category: '零食甜品' },
    { icon: '🍫', name: '巧克力两块', cal: 160, protein: 2, category: '零食甜品' },
    { icon: '🍦', name: '冰淇淋', cal: 200, protein: 3, category: '零食甜品' },
    { icon: '🥔', name: '薯片', cal: 300, protein: 3, category: '零食甜品' },
    { icon: '🍪', name: '曲奇饼干', cal: 180, protein: 2, category: '零食甜品' },
    { icon: '🥮', name: '蛋黄酥', cal: 250, protein: 6, category: '零食甜品' },
    { icon: '🧁', name: '马卡龙', cal: 120, protein: 2, category: '零食甜品' },
    // 蔬菜
    { icon: '🥗', name: '鸡肉蔬菜沙拉', cal: 310, protein: 24, category: '蔬菜' },
    { icon: '🥦', name: '蒜蓉西兰花', cal: 150, protein: 6, category: '蔬菜' },
    { icon: '🥬', name: '清炒时蔬', cal: 120, protein: 4, category: '蔬菜' },
    { icon: '🥒', name: '凉拌黄瓜', cal: 60, protein: 2, category: '蔬菜' },
    { icon: '🍲', name: '上汤娃娃菜', cal: 130, protein: 5, category: '蔬菜' },
    { icon: '🥔', name: '酸辣土豆丝', cal: 180, protein: 3, category: '蔬菜' },
    { icon: '🫑', name: '青椒炒蛋', cal: 190, protein: 10, category: '蔬菜' },
    { icon: '🌽', name: '水煮玉米', cal: 120, protein: 4, category: '蔬菜' },
    { icon: '🍜', name: '冬瓜虾皮汤', cal: 60, protein: 4, category: '蔬菜' },
    // 蛋白质
    { icon: '🍤', name: '蒜蓉虾', cal: 240, protein: 28, category: '蛋白质' },
    { icon: '🐟', name: '清蒸鲈鱼', cal: 220, protein: 34, category: '蛋白质' },
    { icon: '🥚', name: '水煮蛋', cal: 78, protein: 7, category: '蛋白质' },
    { icon: '🍗', name: '水煮鸡胸肉', cal: 165, protein: 31, category: '蛋白质' },
    { icon: '🧈', name: '麻婆豆腐', cal: 220, protein: 15, category: '蛋白质' },
    { icon: '🥩', name: '煎牛排', cal: 400, protein: 35, category: '蛋白质' },
    { icon: '🦀', name: '清蒸螃蟹', cal: 90, protein: 18, category: '蛋白质' },
    { icon: '🥛', name: '希腊酸奶', cal: 100, protein: 10, category: '蛋白质' },
    { icon: '🍲', name: '猪肝汤', cal: 150, protein: 20, category: '蛋白质' }
  ];
  const exercises = [
    { icon: '🚶', name: '快走 30 分钟', cal: 150, sweat: 1, category: '锻炼' },
    { icon: '🏃', name: '慢跑 30 分钟', cal: 280, sweat: 3, category: '锻炼' },
    { icon: '🚴', name: '骑行 30 分钟', cal: 240, sweat: 2, category: '锻炼' },
    { icon: '🏋️', name: '力量训练 30 分钟', cal: 220, sweat: 2, category: '锻炼' },
    { icon: '🧘', name: '瑜伽 30 分钟', cal: 100, sweat: 1, category: '锻炼' },
    { icon: '🧹', name: '打扫房间 30 分钟', cal: 110, sweat: 1, category: '日常生活' },
    { icon: '🛍️', name: '逛街 1 小时', cal: 180, sweat: 1, category: '日常生活' },
    { icon: '🪜', name: '爬楼 15 分钟', cal: 150, sweat: 2, category: '锻炼' },
    { icon: '🏊', name: '游泳 30 分钟', cal: 320, sweat: 2, category: '锻炼' },
    { icon: '💃', name: '跳舞 30 分钟', cal: 230, sweat: 2, category: '娱乐' },
    { icon: '🎬', name: '看电影 2 小时', cal: 35, sweat: 0, category: '娱乐' },
    { icon: '🎮', name: '打游戏 2 小时', cal: 45, sweat: 0, category: '娱乐' },
    { icon: '🧺', name: '晾衣服 20 分钟', cal: 70, sweat: 0, category: '日常生活' },
    { icon: '🐕', name: '遛狗 30 分钟', cal: 125, sweat: 1, category: '日常生活' }
  ];
  const activities = [['1.2', '久坐少动', '大部分时间坐着'], ['1.375', '轻度活动', '偶尔散步或运动'], ['1.55', '中等活动', '规律运动 3–5 次'], ['1.725', '高强度活动', '经常进行高强度运动']];
  let setupStep = 0, pendingProfile = null, toastTimer;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const toast = (text) => {
    $('#toast').textContent = text; $('#toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 1800);
  };
  function updateRange(el) {
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty('--range', `${pct}%`);
  }
  function bmr() {
    const p = state.profile;
    return Math.round(10 * p.weight + 6.25 * p.height - 5 * p.age + (state.gender === 'male' ? 5 : -161));
  }
  function ageFactor() {
    const age = state.profile.age;
    if (age < 18) return 1.08;
    if (age <= 30) return 1;
    if (age <= 45) return .96;
    if (age <= 60) return .9;
    return .82;
  }
  function dailyBurn() { return Math.round(bmr() * state.profile.activity * ageFactor()); }
  function totals() {
    return state.logs.reduce((all, item) => {
      all[item.type] += item.calories;
      if (item.type === 'food') all.protein += item.protein || 0;
      else all.sweat += item.sweat || 0;
      if (item.name === '白水一杯') all.water += 1;
      return all;
    }, { food: 0, exercise: 0, protein: 0, sweat: 0, water: 0 });
  }
  function renderQuick() {
    const source = state.tab === 'food' ? foods : exercises;
    const categories = ['全部', ...new Set(source.map((x) => x.category))];
    $('#foodCategories').hidden = false;
    $('#foodCategories').innerHTML = state.tab === 'food' ? categories.map((x) =>
      `<button class="food-category ${x === state.foodCategory ? 'active' : ''}" data-category="${x}">${x}</button>`
    ).join('') : categories.map((x) =>
      `<button class="food-category ${x === state.activityCategory ? 'active' : ''}" data-category="${x}">${x}</button>`
    ).join('');
    document.querySelectorAll('.food-category').forEach((el) => el.addEventListener('click', () => {
      if (state.tab === 'food') state.foodCategory = el.dataset.category;
      else state.activityCategory = el.dataset.category;
      renderQuick();
    }));
    const list = state.tab === 'food'
      ? foods.filter((x) => state.foodCategory === '全部' || x.category === state.foodCategory)
      : exercises.filter((x) => state.activityCategory === '全部' || x.category === state.activityCategory);
    $('#quickGrid').innerHTML = list.map((x) =>
      `<button class="quick-item ${state.tab}" data-name="${x.name}" data-cal="${x.cal}"><b>${x.icon} ${x.name}</b><span>${state.tab === 'food' ? '+' : '-'}${x.cal} kcal</span></button>`
    ).join('');
    document.querySelectorAll('.quick-item').forEach((el) => el.addEventListener('click', () => addLog(el.dataset.name, Number(el.dataset.cal), state.tab)));
  }
  function aggregateLogs() {
    const map = new Map();
    state.logs.forEach((item) => {
      const key = `${item.type}:${item.name}`;
      const current = map.get(key) || { ...item, count: 0, total: 0, protein: 0 };
      current.count += 1; current.total += item.calories; current.protein += item.protein || 0;
      map.set(key, current);
    });
    return [...map.values()];
  }
  function renderLogs() {
    $('#statsSummary').textContent = `${state.logs.length} 条记录 · ${aggregateLogs().length} 种项目`;
    if (!state.logs.length) {
      $('#logList').innerHTML = '<p class="empty">还没有记录，给身体发个信号吧</p>'; return;
    }
    $('#logList').innerHTML = aggregateLogs().map((x) =>
      `<div class="log-row ${x.type}"><span class="log-icon">${x.type === 'food' ? '🍽️' : '⚡'}</span><div class="log-main"><b>${x.name}</b><span>共 ${x.count} 次 · ${x.type === 'food' ? '摄入' : '活动消耗'}</span></div><span class="log-cal">${x.type === 'food' ? '+' : '-'}${x.total}</span><button class="remove-log" data-key="${x.type}:${x.name}">×</button></div>`
    ).join('');
    document.querySelectorAll('.remove-log').forEach((el) => el.addEventListener('click', () => {
      state.logs = state.logs.filter((x) => `${x.type}:${x.name}` !== el.dataset.key); render();
    }));
  }
  const faces = {
    neutral: { mouth: 'M-6 0 q6 4 12 0', eye: 'M-4 0 q4 -3.5 8 0' },
    happy: { mouth: 'M-6 -1 q6 8 12 0', eye: 'M-4 1 q4 -5 8 0' },
    eat: { mouth: 'M-6 -1 q6 9 12 0', eye: 'M-4 0 q4 -3.5 8 0' },
    sweat: { mouth: 'M-6 1 q6 -3 12 0', eye: 'M-4 -2 q4 3 8 0' },
    warn: { mouth: 'M-5 1 q5 -3 10 0', eye: 'M-4 0 q4 -3.5 8 0' },
    cool: { mouth: 'M-6 -1 q6 7 12 0', eye: 'M-4 1 q4 -5 8 0' }
  };
  function setFace(name) {
    const f = faces[name] || faces.neutral;
    $('#mouth').firstElementChild.setAttribute('d', f.mouth);
    ['#eyeL', '#eyeR'].forEach((sel) => $(sel).firstElementChild.setAttribute('d', f.eye));
  }
  function renderProfile() {
    const p = state.profile;
    $('#profileGender').textContent = state.gender === 'male' ? '♂ 男生' : state.gender === 'female' ? '♀ 女生' : '—';
    $('#profileHeight').textContent = p.height;
    $('#profileAge').textContent = p.age;
    $('#profileWeight').textContent = p.weight.toFixed(1);
    const act = activities.find((a) => Number(a[0]) === p.activity);
    $('#profileActivity').textContent = act ? `活动量 · ${act[1]}` : '—';
  }
  function switchPage(name) {
    document.querySelectorAll('.page').forEach((el) => { el.hidden = el.dataset.page !== name; });
    document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.page === name));
    if (name === 'mine') renderProfile();
    window.scrollTo(0, 0);
  }
  function renderFeedback(net, t) {
    const mood = $('#mood'), title = $('#heroTitle'), desc = $('#heroDesc'), balanceTitle = $('#balanceTitle'), balanceHint = $('#balanceHint');
    mood.className = 'mood';
    if (!state.logs.length) {
      mood.textContent = '刚刚开始'; title.textContent = '今天想怎么照顾自己？'; desc.textContent = '记录一口吃的、一次运动，看看身体今天收到了什么。'; balanceTitle.textContent = '还没有开始记录'; balanceHint.textContent = '吃东西和活动都会让这个数字变化。'; $('#artCaption').textContent = '今天也要好好照顾自己'; setFace('neutral');
    } else if (t.protein >= 50 && t.exercise >= 200) {
      mood.textContent = '精力满满'; mood.classList.add('cool'); title.textContent = '蛋白质和运动都补充到位了'; desc.textContent = `今天约 ${t.protein}g 蛋白质，开启精力满满的一天！`; balanceTitle.textContent = '身体正在变强'; balanceHint.textContent = `这一轮训练留下了约 ${(t.exercise / 1000).toFixed(2)} kg 的“肌肉成长彩蛋”。`; $('#artCaption').textContent = '今天的状态：精力满满！'; setFace('happy');
    } else if (t.food >= dailyBurn() + t.exercise + 900) {
      mood.textContent = '吃得好撑'; mood.classList.add('warn'); title.textContent = '今天吃得超过消耗不少'; desc.textContent = `今天多进账约 ${t.food - dailyBurn() - t.exercise} kcal，先喝水，给肚子一点时间。`; balanceTitle.textContent = '能量明显盈余'; balanceHint.textContent = '不用补偿性节食，晚点散散步，让身体舒服一点。'; $('#artCaption').textContent = '吃得好撑，先来一杯水？'; setFace('eat');
    } else if (t.food > dailyBurn() + t.exercise + 500) {
      mood.textContent = '吃得有点多'; mood.classList.add('warn'); title.textContent = '能量进账不少'; desc.textContent = '先不用责备自己，喝杯水，晚一点起来走走吧。'; balanceTitle.textContent = '今天摄入偏高'; balanceHint.textContent = '一顿饭不会决定身材，下一步可以选择轻松活动。'; $('#artCaption').textContent = '吃饱了，走一小会儿？'; setFace('warn');
    } else if (t.sweat >= 4) {
      mood.textContent = '大汗淋漓'; mood.classList.add('cool'); title.textContent = '今天的汗没有白流'; desc.textContent = `累计消耗 ${t.exercise} kcal，像刚从夏天里骑回来一样。`; balanceTitle.textContent = '运动量很充足'; balanceHint.textContent = '快补水！如果是在户外，记得找阴凉处休息一下。'; $('#artCaption').textContent = '大汗淋漓，水分补给！'; setFace('sweat');
    } else if (t.exercise >= 300) {
      mood.textContent = '动起来了'; mood.classList.add('cool'); title.textContent = '今天的身体很有活力'; desc.textContent = '运动已经记下来了，补充水分，也给自己一点恢复时间。'; balanceTitle.textContent = '活动量不错'; balanceHint.textContent = '运动后记得喝水和吃些有营养的食物。'; $('#artCaption').textContent = '水分补给完成了吗？'; setFace('cool');
    } else if (net > 0) {
      mood.textContent = '能量盈余'; mood.classList.add('warn'); title.textContent = '今天吃得比平时多'; desc.textContent = '不用紧张，喝水、散步或做一点拉伸都可以。'; balanceTitle.textContent = '有一些能量结余'; balanceHint.textContent = '把注意力放回下一次选择，不需要补偿性节食。'; $('#artCaption').textContent = '起来伸个懒腰吧'; setFace('warn');
    } else if (state.lastEvent) {
      mood.textContent = '身体小剧场'; title.textContent = '刚刚发生了一件小事'; desc.textContent = state.lastEvent; balanceTitle.textContent = '继续记录吧'; balanceHint.textContent = '每一笔都会让这个小身体有一点变化。'; $('#artCaption').textContent = '身体收到了你的信号'; setFace('happy');
    } else {
      mood.textContent = '进行中'; title.textContent = '身体正在处理今天的一切'; desc.textContent = '保持正常吃饭，也别忘了给身体补充水分。'; balanceTitle.textContent = '能量缺口'; balanceHint.textContent = '数字只是参考，规律和舒适比追求极端更重要。'; $('#artCaption').textContent = '慢慢来，身体知道怎么调整'; setFace('neutral');
    }
  }
  function render() {
    const t = totals(), p = state.profile, net = t.food - t.exercise - dailyBurn();
    const visualWeight = p.weight + ((t.food - t.exercise) / 7700);
    const bodyScale = clamp(.88 + (visualWeight - 50) / 120, .78, 1.3) * clamp(1 + (t.food - t.exercise) / 6500, .94, 1.1);
    $('#person').style.setProperty('--body-scale', bodyScale.toFixed(2));
    $('#weightValue').textContent = visualWeight.toFixed(1); $('#changeValue').textContent = `${visualWeight - p.weight >= 0 ? '+' : ''}${(visualWeight - p.weight).toFixed(2)}kg`;
    $('#netValue').textContent = `${net > 0 ? '+' : ''}${net}`; $('#eatValue').textContent = t.food; $('#exerciseValue').textContent = t.exercise; $('#proteinValue').textContent = `${t.protein}g`;
    const ratio = clamp(Math.abs(net) / Math.max(dailyBurn(), 1), .04, 1);
    $('#balanceRing').style.background = `conic-gradient(${net > 0 ? 'var(--orange)' : 'var(--blue)'} ${ratio * 360}deg,#e9eeea 0deg)`;
    renderFeedback(net, t); renderLogs();
  }
  function choose(lines) {
    if (lines.length < 2) return lines[0];
    const key = lines.join('|');
    const previous = state.eventHistory.get(key);
    const choices = lines.filter((line) => line !== previous);
    const line = choices[Math.floor(Math.random() * choices.length)];
    state.eventHistory.set(key, line);
    return line;
  }
  function addLog(name, calories, type) {
    const item = [...foods, ...exercises].find((x) => x.name === name);
    const adjustedActivityCalories = type === 'exercise' ? Math.round(calories * ageFactor()) : calories;
    let actualCalories = adjustedActivityCalories;
    if (type === 'food' && name === '番茄牛腩饭') {
      state.lastEvent = choose(['牛腩饭太香，差点吃太快；慢慢嚼，先喝一小口水。', '米饭在喉咙口打了个结，幸好有番茄汤救场；吃饭别赶时间。', '这一碗热气腾腾，身体提醒你：好吃也要一口一口来。']);
    } else if (type === 'food' && name === '西红柿炒蛋') {
      state.lastEvent = choose(['鸡蛋有点干，差点噎着；配点汤或蔬菜会更舒服。', '番茄的汁水让鸡蛋柔软了一点，今天咀嚼速度记得放慢。', '西红柿炒蛋顺利下肚，身体建议再来几口水。']);
    } else if (type === 'food' && name === '牛奶') {
      state.lastEvent = choose(['肚子咕噜了一下，这杯牛奶可能不太适合你；身体把约 30 kcal 退回去了。', '牛奶刚到胃里就引起了一点小骚动，今天按舒服的量来。', '身体对这杯牛奶眨了眨眼：下次可以试试无乳糖版本。']);
      actualCalories = Math.max(0, calories - 30);
    } else if (type === 'food' && name === '奶茶') {
      state.lastEvent = choose(['甜甜的能量已到账；等会儿喝点白水，嘴巴会舒服些。', '奶茶带来了快乐，也带来了一点糖分；今天记得补一杯白水。', '这一口很快乐，身体正在慢慢拆开这份甜蜜。']);
    } else if (type === 'exercise' && name === '骑行 30 分钟') {
      state.lastEvent = choose(['骑行路上遇到一阵顺风，心情加成 +1；户外记得注意车辆和防晒。', '路边的树影一路陪你骑行，今天的风景也算运动奖励。', '红绿灯让你喘口气；继续骑之前，先确认水和头盔都在。']);
    } else if (type === 'exercise' && name === '慢跑 30 分钟') {
      state.lastEvent = choose(['路边的风把汗吹干了一点，但身体还在发热；慢慢走几分钟再停。', '今天的脚步很稳，最后几分钟别急着冲刺，给心跳一个缓冲。', '跑道旁的小鸟看起来也在给你加油；走几步、喝口水再回家。']);
    } else if (type === 'exercise' && name === '力量训练 30 分钟') {
      state.lastEvent = choose(['肌肉收到训练信号；今天约留下 0.01 kg 的虚拟成长彩蛋。', '最后一组完成，肌肉正在写下“变强中”的小字条。', '力量训练已存档；今天不必逞强，睡一觉也是训练的一部分。']);
    } else if (type === 'exercise' && name === '看电影 2 小时') {
      state.lastEvent = choose(['电影散场了，眼睛和大脑都休息了一会儿；起来接杯水吧。', '片尾字幕滚完啦，肩颈也该离开座位伸展一下。', '这场电影贡献了放松值；站起来走两分钟，身体会更满意。']);
    } else if (type === 'exercise' && name === '打游戏 2 小时') {
      state.lastEvent = choose(['这一局打完了，手腕和眼睛需要暂停一下；眺望远处 20 秒。', '胜负先放一边，手腕已经发来休息申请；起来活动一下吧。', '屏幕时间达成，去窗边看看远处，眼睛会收到奖励。']);
    } else if (type === 'exercise' && name === '逛街 1 小时') {
      state.lastEvent = choose(['逛街走了不少路，路边橱窗给你发来一点心情能量。', '今天的步数藏在一个个橱窗之间，心情和腿都动起来了。', '逛街途中发现了喜欢的东西，身体也顺便收获了一点活动量。']);
    } else if (type === 'food' && actualCalories >= 400) {
      state.lastEvent = choose([`这是一笔 ${actualCalories} kcal 的大额进账，身体正在认真处理。`, `能量大礼包到账：${actualCalories} kcal；接下来喝水、走走都很合适。`, `这一餐很有存在感，身体需要一点时间把 ${actualCalories} kcal 安排好。`]);
    } else if (type === 'food' && name === '白水一杯') {
      state.lastEvent = choose(['水分到账！身体的每个小角落都舒服了一点。', '白水是今天最安静但很重要的奖励，继续保持。', '咕咚一口，身体的水位线往上走了一点。']);
    } else if (type === 'food') {
      state.lastEvent = choose([`${name}已加入身体小账本，今天的能量拼图又完整了一块。`, `${name}变成了身体的小燃料，先享受这一口，再想下一步。`, `收到${name}！身体正在把这份能量分配到今天的各个角落。`]);
    } else {
      state.lastEvent = choose([`${name}完成！身体刚刚消耗了 ${actualCalories} kcal，给自己一点掌声。`, `${name}被身体记住了，今天又多了一点活动量。`, `这一项完成得漂亮，约 ${actualCalories} kcal 的消耗已经到账。`]);
    }
    state.logs.unshift({ id: Date.now() + Math.random(), name, calories: actualCalories, type, protein: item && item.protein, sweat: item && item.sweat });
    render();
    toast(state.lastEvent);
    const t = totals();
    if (t.exercise >= 300 && !state.milestones.has('exercise')) {
      state.milestones.add('exercise'); celebrate('运动达标！', ['🎉', '💪', '✨', '⚡']);
    }
    if (t.protein >= 50 && !state.milestones.has('protein')) {
      state.milestones.add('protein'); celebrate('蛋白质补充足够！', ['🥚', '🍗', '🌟', '💚']);
    }
    if (t.food >= 1200 && !state.milestones.has('food')) {
      state.milestones.add('food'); celebrate('今天的能量补给达标！', ['🍜', '🥗', '🍎', '✨']);
    }
    if (t.water >= 2 && !state.milestones.has('water')) {
      state.milestones.add('water'); celebrate('补水任务完成一小步！', ['💧', '💦', '🌊', '✨']);
    }
    if (state.logs.length >= 5 && !state.milestones.has('records')) {
      state.milestones.add('records'); celebrate('今天的身体互动达到 5 次！', ['🎊', '👏', '🌈', '🍀']);
    }
  }
  function celebrate(message, icons) {
    toast(message);
    const box = $('#celebration');
    box.innerHTML = '';
    for (let i = 0; i < 22; i += 1) {
      const el = document.createElement('span');
      el.className = 'confetti'; el.textContent = icons[i % icons.length];
      el.style.left = `${Math.random() * 100}%`;
      el.style.setProperty('--drift', `${Math.round((Math.random() - .5) * 150)}px`);
      el.style.animationDelay = `${Math.random() * .45}s`;
      box.appendChild(el);
    }
    setTimeout(() => { box.innerHTML = ''; }, 2400);
  }
  function setSetupStep(index) {
    setupStep = index;
    document.querySelectorAll('.setup-step').forEach((el, i) => { el.hidden = i !== index; });
    document.querySelectorAll('.setup-progress i').forEach((el, i) => el.classList.toggle('on', i <= index));
    const next = $('#setupNext');
    next.disabled = index === 0 && !state.gender;
    next.textContent = index === 3 ? '开始记录' : '下一步';
    $('#setupBack').hidden = index === 0;
  }
  function setupRange(id, output, suffix) {
    const el = $(`#${id}`); const out = $(`#${output}`);
    const update = () => { out.textContent = Number(el.value).toFixed(id === 'setupWeight' ? 1 : 0); updateRange(el); };
    el.addEventListener('input', update); update();
  }
  function setEditValues() {
    $('#editHeight').value = state.profile.height; $('#editAge').value = state.profile.age; $('#editWeight').value = state.profile.weight;
    $('#editHeightValue').textContent = `${state.profile.height} cm`; $('#editAgeValue').textContent = `${state.profile.age} 岁`; $('#editWeightValue').textContent = `${state.profile.weight.toFixed(1)} kg`;
    document.querySelectorAll('.edit-choice').forEach((el) => el.classList.toggle('selected', el.dataset.gender === state.gender));
    document.querySelectorAll('.activity-choice').forEach((el) => el.classList.toggle('selected', el.dataset.value === String(state.profile.activity)));
    ['editHeight', 'editAge', 'editWeight'].forEach((id) => updateRange($(`#${id}`)));
  }
  function openSheet(id) {
    const el = $(`#${id}`);
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('visible'));
  }
  function closeSheet(id) {
    const el = $(`#${id}`);
    el.classList.remove('visible');
    setTimeout(() => { el.hidden = true; }, 260);
  }
  document.querySelectorAll('.setup-choice').forEach((el) => el.addEventListener('click', () => {
    state.gender = el.dataset.gender;
    document.querySelectorAll('.setup-choice').forEach((x) => x.classList.toggle('selected', x === el)); $('#setupNext').disabled = false;
  }));
  setupRange('setupHeight', 'setupHeightValue'); setupRange('setupAge', 'setupAgeValue'); setupRange('setupWeight', 'setupWeightValue');
  $('#setupNext').addEventListener('click', () => {
    if (setupStep < 3) { setSetupStep(setupStep + 1); return; }
    state.profile.height = Number($('#setupHeight').value); state.profile.age = Number($('#setupAge').value); state.profile.weight = Number($('#setupWeight').value);
    $('#onboarding').setAttribute('aria-hidden', 'true'); render(); toast('准备好了，开始照顾自己吧');
  });
  $('#setupBack').addEventListener('click', () => { if (setupStep > 0) setSetupStep(setupStep - 1); });
  document.querySelectorAll('.switch').forEach((el) => el.addEventListener('click', () => {
    state.tab = el.dataset.tab; document.querySelectorAll('.switch').forEach((x) => x.classList.toggle('active', x === el)); renderQuick();
  }));
  $('#customTrigger').addEventListener('click', () => { $('#customTitle').textContent = state.tab === 'food' ? '记一项吃的' : '记一次活动'; openSheet('customSheet'); });
  document.querySelectorAll('.tab').forEach((el) => el.addEventListener('click', () => switchPage(el.dataset.page)));
  $('#editProfileBtn2').addEventListener('click', () => { pendingProfile = null; setEditValues(); openSheet('profileSheet'); });
  const d = new Date();
  $('#todayDate').textContent = `${d.getMonth() + 1}月${d.getDate()}日`;
  $('#addCustom').addEventListener('click', () => {
    const name = $('#customName').value.trim(), calories = Number($('#customCalories').value);
    if (!name || !calories) { toast('写下名称和热量再加入'); return; }
    addLog(name, calories, state.tab); $('#customName').value = ''; $('#customCalories').value = ''; closeSheet('customSheet');
  });
  $('#clearLog').addEventListener('click', () => { if (!state.logs.length) return; state.logs = []; state.lastEvent = ''; state.eventHistory.clear(); state.milestones.clear(); render(); toast('今天的统计已清空'); });
  $('#editProfileBtn').addEventListener('click', () => { pendingProfile = null; setEditValues(); openSheet('profileSheet'); });
  document.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => closeSheet(el.dataset.close)));
  document.querySelectorAll('.edit-choice').forEach((el) => el.addEventListener('click', () => {
    pendingProfile = pendingProfile || {}; pendingProfile.gender = el.dataset.gender;
    document.querySelectorAll('.edit-choice').forEach((x) => x.classList.toggle('selected', x === el));
  }));
  activities.forEach((a) => {
    const el = document.createElement('button'); el.className = 'activity-choice'; el.dataset.value = a[0]; el.innerHTML = `<b>${a[1]}</b><span>${a[2]}</span>`;
    el.addEventListener('click', () => { pendingProfile = pendingProfile || {}; pendingProfile.activity = Number(a[0]); document.querySelectorAll('.activity-choice').forEach((x) => x.classList.toggle('selected', x === el)); });
    $('#activityGrid').appendChild(el);
  });
  ['editHeight', 'editAge', 'editWeight'].forEach((id) => $(`#${id}`).addEventListener('input', () => {
    const v = $(`#${id}`).value; updateRange($(`#${id}`));
    pendingProfile = pendingProfile || {};
    if (id === 'editHeight') { pendingProfile.height = Number(v); $('#editHeightValue').textContent = `${v} cm`; }
    if (id === 'editAge') { pendingProfile.age = Number(v); $('#editAgeValue').textContent = `${v} 岁`; }
    if (id === 'editWeight') { pendingProfile.weight = Number(v); $('#editWeightValue').textContent = `${Number(v).toFixed(1)} kg`; }
  }));
  $('#saveProfile').addEventListener('click', () => {
    if (!pendingProfile || !Object.keys(pendingProfile).length) { closeSheet('profileSheet'); return; }
    openSheet('confirmDialog');
  });
  $('#confirmProfile').addEventListener('click', () => {
    state.gender = pendingProfile.gender || state.gender; state.profile = { ...state.profile, ...pendingProfile }; state.logs = []; state.lastEvent = ''; state.eventHistory.clear(); state.milestones.clear(); pendingProfile = null;
    closeSheet('profileSheet'); closeSheet('confirmDialog'); render(); toast('资料已更新，今天重新开始');
  });
  renderQuick(); setSetupStep(0);
})();
