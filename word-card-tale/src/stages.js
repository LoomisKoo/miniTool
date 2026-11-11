/* 漫游关卡：各地区 5 关的主题 + 16×16 像素敌人图
   px 每行 8 字符时左右镜像成 16 列；'.' 透明，k 描边，其余字母查 pal。 */
(function (global) {
  'use strict';

  var BASE = { k: '#2a1712', w: '#ffffff' };

  var S = {
    /* ── 伦敦 ── */
    scone: { en: 'scone', cn: '司康', pal: { r: '#d8344a', w: '#fff6e0', y: '#f2c27a', o: '#d99a4e', d: '#b8763a' }, px: [
      '........', '........', '........', '....kkkk', '..kkrrrr', '.kwwrrww', '.kwwwwww', 'kyyyyyyy',
      'kyyoyyyy', 'kyyyyyoy', 'kddddddd', '.kdddddd', '..kkkkkk', '........', '........', '........'] },
    teacup: { en: 'teacup', cn: '茶杯', pal: { v: '#cfd6e0', t: '#8a4a22', b: '#3a6fd8', s: '#d9e2f0' }, px: [
      '......v.', '.....v..', '......v.', '........', '..kkkkkk', '..kttttt', '..kwwwww', '..kwbbbb',
      '..kwwwww', '...kwwww', '....kwww', 'kkkkkkkk', 'ksssssss', '.kkkkkkk', '........', '........'] },
    bearskin: { en: 'guard', cn: '皇家卫兵', pal: { f: '#1c1820', g: '#3a3442', s: '#f6c9a0', r: '#d02b35', y: '#f2c94c' }, px: [
      '....kkkk', '...kffff', '..kfffff', '..kfgfff', '..kfffff', '..kfffff', '..kfffff', '..kkssss',
      '...kskss', '...kssss', '...kssss', '..krrrrr', '..krrrry', '..krrrrr', '..kkkkkk', '........'] },
    phonebox: { en: 'phone box', cn: '电话亭', pal: { r: '#d4232f', g: '#bfe6ff' }, px: [
      '......kk', '.....krr', '...kkkkk', '...krrrr', '...krwww', '...krrrr', '...krggr', '...krggr',
      '...krrrr', '...krggr', '...krggr', '...krrrr', '...krggr', '...krrrr', '..kkkkkk', '........'] },
    bus: { en: 'double-decker', cn: '双层巴士', pal: { r: '#d4232f', g: '#a8d8ff', y: '#ffe27a' }, px: [
      '........', '.kkkkkkk', '.krrrrrr', '.krggggg', '.krggggg', '.krrrrrr', '.krrryyy', '.krrrrrr',
      '.krggggg', '.krggggg', '.krrrrrr', '.kyrrrrr', '.krrrrrr', '.kkkkkkk', '..kk....', '........'] },
    bigben: { en: 'Big Ben', cn: '大本钟', pal: { g: '#3f6b5a', t: '#d8b97a', w: '#fff6e0', d: '#6a5030' }, px: [
      '.......k', '......kg', '......kg', '.....kgg', '....kggg', '....kttt', '....kwww', '....kwwk',
      '....kwww', '....kttt', '....ktdt', '....kttt', '....ktdt', '...ktttt', '..kttttt', '..kkkkkk'] },

    /* ── 纽约 ── */
    hotdog: { en: 'hot dog', cn: '热狗', pal: { s: '#c8553d', y: '#ffd23f', b: '#f2b866', d: '#c98a43' }, px: [
      '........', '........', '........', '........', '........', '..kkkkkk', '.kssssss', 'kbbsysys',
      'kbbbbbbb', 'kdbbbbbb', '.kdddddd', '..kkkkkk', '........', '........', '........', '........'] },
    pizza: { en: 'pizza', cn: '披萨', pal: { c: '#d99a4e', y: '#ffd46b', r: '#d0413a' }, px: [
      'kkkkkkkk', 'kccccccc', 'kyyyyyyy', '.kyyryyy', '.kyrryyy', '..kyyyyy', '..kyyyry', '...kyyyr',
      '...kyyyy', '....kyyy', '....kyyy', '.....kyy', '.....kyy', '......ky', '.......k', '........'] },
    coffee: { en: 'coffee', cn: '咖啡', pal: { p: '#f4efe6', s: '#a0703c', g: '#2f8f5b' }, px: [
      '........', '...kkkkk', '..kwwwww', '..kkkkkk', '...kpppp', '...kpppp', '...kssss', '...ksssg',
      '...kssss', '....kppp', '....kppp', '....kkkk', '........', '........', '........', '........'] },
    apple: { en: 'apple', cn: '苹果', pal: { r: '#e0303e', w: '#ffb3b8', g: '#4caf50' }, px: [
      '........', '........', '.......k', '......kg', '..kkkkkk', '.krrrrrr', 'krwrrrrr', 'krrrrrrr',
      'krrrrrrr', 'krrrrrrr', '.krrrrrr', '.krrrrrr', '..krrrrr', '...kkkkk', '........', '........'] },
    taxi: { en: 'taxi', cn: '出租车', pal: { y: '#ffc928', g: '#9fd3f0' }, px: [
      '........', '........', '......kk', '.....kww', '..kkkkkk', '.kyyyyyy', '.kyggggg', 'kyyggggg',
      'kyyyyyyy', 'kywyyyyy', 'kykwkwkw', 'kyyyyyyy', 'kkkkkkkk', '.kk.....', '........', '........'] },
    liberty: { en: 'Statue of Liberty', cn: '自由女神', pal: { g: '#6fc2a8', d: '#3e8a74' }, px: [
      '........', '.k...k..', '..k..k.k', '...kkkkk', '..kggggg', '..kgdgdg', '..kggggg', '..kggkgg',
      '..kggggg', '...kgggg', '...kgggd', '....kggg', '...kgggg', '..kggggg', '.kgggggg', '.kkkkkkk'] },

    /* ── 东京 ── */
    onigiri: { en: 'rice ball', cn: '饭团', pal: { n: '#1f3a2c' }, px: [
      '........', '........', '......kk', '.....kww', '....kwww', '....kwww', '...kwwww', '...kwwww',
      '..kwwwww', '..kwwnnn', '.kwwnnnn', '.kwwnnnn', 'kwwwnnnn', 'kkkkkkkk', '........', '........'] },
    sushi: { en: 'sushi', cn: '寿司', pal: { o: '#ff8a5c', p: '#ffd0b8', w: '#fffaf0' }, px: [
      '........', '........', '........', '........', '........', '..kkkkkk', '.kooopoo', 'kooopooo',
      'kkkkkkkk', 'kwwwwwww', 'kwwwwwww', '.kwwwwww', '..kkkkkk', '........', '........', '........'] },
    maneki: { en: 'lucky cat', cn: '招财猫', pal: { p: '#ff9fb2', r: '#d9344a', y: '#ffd23f' }, px: [
      '........', '..kk....', '..kpk...', '..kwwkkk', '.kwwwwww', '.kwkwwww', '.kwwwwwp', '..kwwwww',
      '..krrrry', '.kwwwwww', 'kwkwwwww', 'kwwwyyyy', '.kwwwwww', '.kwwwwww', '.kkkkkkk', '........'] },
    daruma: { en: 'daruma', cn: '达摩', pal: { r: '#d9233a', s: '#ffe0c4', y: '#f2c94c' }, px: [
      '........', '....kkkk', '..kkrrrr', '.krrrrrr', '.krrssss', 'krrsskss', 'krrsssss', 'krrssskk',
      'krrsssss', 'krrrssss', 'krrrrrrr', 'krrrrryy', '.krrrrrr', '..kkrrrr', '....kkkk', '........'] },
    torii: { en: 'torii gate', cn: '鸟居', pal: { r: '#e0422f' }, px: [
      '........', 'kkkkkkkk', 'krrrrrrr', 'kkkkkkkk', '..kr....', 'kkkkkkkk', 'krrrrrrr', 'kkkkkkkk',
      '..kr....', '..kr....', '..kr....', '..kr....', '..kr....', '..kr....', '.kkkk...', '........'] },
    fuji: { en: 'Mount Fuji', cn: '富士山', pal: { b: '#4f6fbf', g: '#5aa65a' }, px: [
      '........', '........', '........', '......kk', '.....kww', '....kwww', '....kwwb', '...kwbwb',
      '...kbbbb', '..kbbbbb', '..kbbbbb', '.kbbbbbb', '.kbbbbbb', 'kbbbbbbb', 'kggggggg', 'kkkkkkkk'] },

    /* ── 巴黎 ── */
    croissant: { en: 'croissant', cn: '可颂', pal: { o: '#e9a54b', d: '#b8702a' }, px: [
      '........', '........', '........', '........', '........', '....kkkk', '...koooo', '..kooodo',
      '.kooodoo', 'kooodooo', 'koodkkkk', 'kokk....', 'kk......', '........', '........', '........'] },
    macaron: { en: 'macaron', cn: '马卡龙', pal: { p: '#ff9ec4', w: '#ffd6e8', c: '#fff6e0' }, px: [
      '........', '........', '........', '........', '..kkkkkk', '.kpppppp', 'kpwppppp', 'kppppppp',
      'kccccccc', 'kppppppp', '.kpppppp', '..kkkkkk', '........', '........', '........', '........'] },
    baguette: { en: 'baguette', cn: '法棍', pal: { b: '#e2a55a', d: '#b8762e' }, px: [
      '.....kkk', '....kbbb', '....kbbb', '....kdbb', '....kbdb', '....kbbb', '....kdbb', '....kbdb',
      '....kbbb', '....kdbb', '....kbdb', '....kbbb', '....kdbb', '....kbbb', '.....kkk', '........'] },
    beret: { en: 'beret', cn: '贝雷帽', pal: { b: '#c8323c', d: '#8e1f28' }, px: [
      '........', '........', '........', '........', '.......k', '...kkkkk', '.kkbbbbb', 'kbbbbbbb',
      'kbbbbbbb', 'kdbbbbbb', '.kkkkkkk', '........', '........', '........', '........', '........'] },
    arc: { en: 'Arc de Triomphe', cn: '凯旋门', pal: { s: '#e6d6b0' }, px: [
      '........', '........', 'kkkkkkkk', 'ksssssss', 'kkkkkkkk', 'ksssssss', 'ksssskk.', 'kssssk..',
      'kssssk..', 'kssssk..', 'kssssk..', 'kssssk..', 'kssssk..', 'kssssk..', 'kkkkkk..', '........'] },
    eiffel: { en: 'Eiffel Tower', cn: '埃菲尔铁塔', pal: { b: '#8a6a4a' }, px: [
      '.......k', '.......k', '......kb', '......kb', '.....kbb', '.....kkk', '.....kbb', '....kbkb',
      '....kbbb', '...kkkkk', '...kbb..', '..kbb...', '..kb....', '.kbb....', '.kb.....', 'kkk.....'] },

    /* ── 新加坡 ── */
    kaya: { en: 'kaya toast', cn: '咖椰吐司', pal: { b: '#b8763a', t: '#f7dca0', g: '#7cb342', y: '#fff3b0' }, px: [
      '........', '........', '........', '...kkkkk', '.kkbbbbb', 'kbtttttt', 'kbtttttt', 'kbgggggg',
      'kbyyyyyy', 'kbtttttt', 'kbtttttt', 'kbbbbbbb', 'kkkkkkkk', '........', '........', '........'] },
    crab: { en: 'chili crab', cn: '辣椒螃蟹', pal: { r: '#e2482c' }, px: [
      '........', '........', '........', '.kk.....', 'krrk....', 'krrk.kkk', '.kkkkrrr', '..krrrrr',
      '..krrkrr', '.krrrrrr', 'krrrrrrr', '.kkrrrrr', 'k.k.kkkk', '........', '........', '........'] },
    satay: { en: 'satay', cn: '沙爹串', pal: { s: '#c49a6c', m: '#a8492a', d: '#d77a3a' }, px: [
      '.......s', '.......s', '....kkkk', '....kmmm', '....kmdm', '....kkkk', '....kmmm', '....kmmd',
      '....kkkk', '....kmmm', '....kmdm', '....kkkk', '.......s', '.......s', '.......s', '........'] },
    durian: { en: 'durian', cn: '榴莲', pal: { g: '#9bbf3a', d: '#5f7f1f' }, px: [
      '........', '........', '...k.k.k', '...kkkkk', '..kggggg', '.kgggdgg', 'kggdgggg', 'kgggggdg',
      'kgdggggg', 'kggggdgg', '.kgggggg', '.kgdgggg', '..kggggg', '...kkkkk', '........', '........'] },
    mbs: { en: 'Marina Bay Sands', cn: '金沙酒店', pal: { s: '#7fa8c8', g: '#9cc2dc', w: '#e6f2fa' }, px: [
      '........', '........', 'kkkkkkkk', 'ksssssss', 'kkkkkkkk', '.kgk..kg', '.kwk..kw', '.kgk..kg',
      '.kwk..kw', '.kgk..kg', '.kwk..kw', '.kgk..kg', '.kwk..kw', '.kgk..kg', '.kgk..kg', 'kkkkkkkk'] },
    merlion: { en: 'Merlion', cn: '鱼尾狮', pal: { b: '#5fb8e8', m: '#cfc8b8', w: '#f6f3ec', s: '#b8c4cc' }, px: [
      '.......b', '......bb', '.......b', '...kkkkk', '..kmmmmm', '.kmmwwww', '.kmwkwww', '.kmwwwww',
      '.kmwwwwk', '..kmwwww', '..kmmmmm', '...kssss', '..ksssss', '..ksssss', '..kbbbbb', '..kkkkkk'] },

    /* ── 伊斯坦布尔 ── */
    simit: { en: 'simit', cn: '芝麻圈', pal: { b: '#b8642e', y: '#f2d38a' }, px: [
      '........', '........', '........', '...kkkkk', '.kkbbbbb', '.kbbybbb', 'kbbbkkkk', 'kbyk....',
      'kbbk....', 'kbbbkkkk', '.kbbbybb', '.kkbbbbb', '...kkkkk', '........', '........', '........'] },
    lokum: { en: 'Turkish delight', cn: '土耳其软糖', pal: { l: '#ffc6dc', p: '#ff7aa8' }, px: [
      '........', '........', '........', '........', '..kkkkkk', '.kllllll', 'kllwllll', 'kppppppp',
      'kppwpppp', 'kppppppp', 'kpppppwp', 'kppppppp', 'kkkkkkkk', '........', '........', '........'] },
    doner: { en: 'doner kebab', cn: '旋转烤肉', pal: { m: '#b5652e', d: '#7a3e1a' }, px: [
      '.......k', '...kkkkk', '..kmmmmm', '..kmdmmm', '..kmmmdm', '...kmmmm', '...kmdmm', '...kmmmm',
      '....kmmd', '....kmmm', '.....kmm', '.....kmm', '.......k', '.......k', '...kkkkk', '........'] },
    nazar: { en: 'evil eye', cn: '恶魔之眼', pal: { b: '#1f5fbf', c: '#7cc8f0' }, px: [
      '........', '........', '....kkkk', '..kkbbbb', '.kbbwwww', 'kbbwwccc', 'kbbwwcck', 'kbbwwcck',
      'kbbwwccc', '.kbbwwww', '.kbbbbbb', '..kkbbbb', '....kkkk', '........', '........', '........'] },
    tulip: { en: 'tulip', cn: '郁金香', pal: { p: '#e8384f', q: '#b0233a', g: '#3f9a4a' }, px: [
      '........', '........', '...k.k.k', '...kkkkk', '..kppppp', '..kpppqp', '..kppppq', '...kpppp',
      '....kkkk', '.......g', '...kgg.g', '....kggg', '.......g', '.......g', '........', '........'] },
    mosque: { en: 'Hagia Sophia', cn: '圣索菲亚', pal: { w: '#efe2c8', d: '#7a8fa8' }, px: [
      '.k......', '.k......', 'kwk..kkk', 'kwk.kddd', 'kwkkdddd', 'kwkddddd', 'kwkkkkkk', 'kwkwwwww',
      'kwkwkwkw', 'kwkwwwww', 'kwkwwwkk', 'kwkwwwkk', 'kwkwwwkk', 'kkkkkkkk', '........', '........'] },
    baklava: { en: 'baklava', cn: '果仁蜜饼', pal: { b: '#e0a84a', d: '#a86a32', g: '#5f9f4a' }, px: [
      '........', '........', '........', '..kkkkkk', '.kbbbbbb', 'kbdbbdbk', 'kbbbbbbk', 'kbdbdbbk',
      'kbbbbbbk', 'kbdbbdbk', '.kbbbbbb', '..kkkkkk', '........', '........', '........', '........'] },

    /* ── 首尔 ── */
    tteokbokki: { en: 'tteokbokki', cn: '炒年糕', pal: { r: '#d8342f', y: '#f0a04b', w: '#ffe0c0' }, px: [
      '........', '........', '........', '..kkkkkk', '.krrrrrr', '.krrwrrr', 'krrrrrrr', 'krrwrrrr',
      'kyyyyyyy', 'krrrrrrr', 'krrwrrrr', '.krrrrrr', '..kkkkkk', '........', '........', '........'] },
    kimbap: { en: 'gimbap', cn: '紫菜包饭', pal: { n: '#20382a', w: '#fff8e6', g: '#e07a3c' }, px: [
      '........', '........', '........', '..kkkkkk', '.knnnnnn', 'knnwwwww', 'knwggggg', 'knwgwwgg',
      'knwggggg', 'knwwwwww', 'knnwwwww', '.knnnnnn', '..kkkkkk', '........', '........', '........'] },
    hotteok: { en: 'hotteok', cn: '糖饼', pal: { b: '#c98a4b', d: '#8a5a26', y: '#f2c94c' }, px: [
      '........', '........', '........', '........', '..kkkkkk', '.kbbbbbb', 'kbbddddd', 'kbbyddyy',
      'kbbyddyy', 'kbbddddd', '.kbbbbbb', '..kkkkkk', '........', '........', '........', '........'] },
    soju: { en: 'soju', cn: '烧酒', pal: { g: '#2f8f5b', w: '#d8ffe8' }, px: [
      '.......k', '......kg', '......kg', '.....kgg', '.....kgg', '....kggg', '...kgwgg', '..kggggg',
      '..kgwggg', '..kggwgg', '..kggggg', '..kgwggg', '..kggggg', '..kkkkkk', '........', '........'] },
    chicken: { en: 'fried chicken', cn: '韩式炸鸡', pal: { b: '#c8762e', w: '#fff6e0' }, px: [
      '........', '........', '........', '....kkkk', '...kbbbb', '..kbbwbb', '..kbbbbb', '..kbbbbb',
      '...kbbbk', '....kkkw', '......kw', '.....kw.', '.....kw.', '......k.', '........', '........'] },
    namsan: { en: 'N Seoul Tower', cn: '南山塔', pal: { w: '#dfe8f2' }, px: [
      '........', '...kk...', '...kk...', '..kwwk..', '..kwwk..', '.kkwwkk.', '.kwwwwk.', '..kwwk..',
      '..kwwk..', '.kkwwkk.', '.kwwwwk.', '..kwwk..', '..kwwk..', '.kkwwkk.', '.kkkkkk.', '........'] },
    gyeongbok: { en: 'Gyeongbokgung', cn: '景福宫', pal: { s: '#5a6a7a', t: '#c8643c', d: '#7a3a22' }, px: [
      '........', '........', '.kkkkkk.', 'kssssssk', 'kkkkkkkk', 'kssssssk', '..kttk..', '.kkttkk.',
      '.kttttk.', '.ktddtk.', '.kttttk.', '.ktddtk.', '.kttttk.', 'kkkkkkkk', 'kddddddk', 'kkkkkkkk'] },

    /* ── 曼谷 ── */
    padthai: { en: 'pad thai', cn: '泰式炒面', pal: { w: '#f4efe6', y: '#f0c860', o: '#e0703c' }, px: [
      '........', '........', '........', '..kkkkkk', '.kwwwwww', 'kwywyyyw', 'kyywyywy', 'kwyyyyyy',
      'kwyoyywy', '.kwwwwww', '..kkkkkk', '........', '........', '........', '........', '........'] },
    tomyum: { en: 'tom yum', cn: '冬阴功', pal: { r: '#d8432c', y: '#f5c451' }, px: [
      '........', '........', '...k....', '..k.k...', '.kkkkkk.', '.krrrrk.', 'kryrrrrk', 'krrrryrk',
      'krrrrrrk', '.krrrrk.', '..kkkkk.', '...kkk..', '........', '........', '........', '........'] },
    tuktuk: { en: 'tuk-tuk', cn: '嘟嘟车', pal: { b: '#3aa0c8', y: '#ffe08a', w: '#333333', g: '#cfe8f8' }, px: [
      '................', '................', '...kkkkkkkkkkk..', '..kbbbbbbbbbbbk.',
      '..kkkkkkkkkkkkk.', '..kgk.....k..k..', '.kggk.....k..k..', 'kyggkkkkkkkkkkk.',
      'kbbbbbbbbbbbbbbk', 'kbbbbbbbbbbbbbbk', '.kkkkkkkkkkkkkk.', '..kwk......kwk..',
      '..kkk......kkk..', '................', '................', '................'] },
    mango: { en: 'mango sticky rice', cn: '芒果糯米饭', pal: { y: '#f2b93a', w: '#fff6e0' }, px: [
      '........', '........', '.....kk.', '....kyyk', '...kyyyk', '..kyyyyy', '.kyyyyyk', '.kyyyyk.',
      '.kyyyk..', '..kyk...', '..kkk...', '.kwwwwk.', 'kwwwwwwk', 'kkkkkkkk', '........', '........'] },
    elephant: { en: 'elephant', cn: '大象', pal: { g: '#9aa0ae', l: '#e8b4c0', w: '#fffaf0' }, px: [
      '........', '.kkk....', 'kgggkkkk', 'kgllkggg', 'kgllkgkg', 'kgllkggg', 'kgllkggg', 'kglgkggg',
      '.kggkwgg', '..kkkwkg', '.....wkg', '......kg', '......kg', '......kg', '......kk', '........'] },
    longboat: { en: 'long-tail boat', cn: '长尾船', pal: { y: '#e0b34a', b: '#7a4a26', w: '#ffe0c0' }, px: [
      '................', '................', '................', '................',
      '................', '....kkkkkkk.....', '...kyyyyyyyk....', '....k.....k.....',
      'kk..k.....k.....', 'kbwbbbbbbbbbbbbk', '.kbbbbbbbbbbbbkk', '..kkkkkkkkkkkk.k',
      '...............k', '..............kw', '................', '................'] },
    watarun: { en: 'Wat Arun', cn: '郑王庙', pal: { w: '#f0e6d2' }, px: [
      '........', '....kk..', '...kwwk.', '...kwwk.', '..kwwwwk', '..kwwwwk', '.kwwwwww', '.kkkkkk.',
      '.kwwwwk.', '..kwwk..', '..kwwk..', '.kwwwwk.', '.kkkkkk.', 'kwwwwwwk', 'kkkkkkkk', '........'] },

    /* ── 墨西哥城 ── */
    taco: { en: 'taco', cn: '塔可', pal: { y: '#e8b23a', r: '#c8352a' }, px: [
      '........', '........', '........', '...kkkk.', '..kyyyyk', '.kyryyyk', 'kyyryyyy', 'kyyyyrry',
      'kyrryyyy', '.kyyyyyk', '..kkkkk.', '........', '........', '........', '........', '........'] },
    churro: { en: 'churro', cn: '吉事果', pal: { y: '#d99a4e', d: '#a8682a', w: '#fff3dc' }, px: [
      '................',
      '...........kd...',
      '..........kyyd..',
      '.........kdyyyd.',
      '........kyddyyk.',
      '.......kdyydwk..',
      '......kyddwyk...',
      '.....kyywddk....',
      '....kywyyyk.....',
      '...kwyydyk......',
      '..kydyyyk.......',
      '.kyyydyk........',
      '.ddyyyk.........',
      '..ddyk..........',
      '...dk...........',
      '................'] },
    cactus: { en: 'cactus', cn: '仙人掌', pal: { g: '#4caf50', p: '#b5652e' }, px: [
      '........', '........', '....kk..', '...kggk.', '...kggk.', 'k..kggk.', 'kgkkggk.', 'kggkggk.',
      '.kgggkk.', '..kggk..', '..kggk..', '.kkggkk.', '.kppppk.', '.kppppk.', '..kkkk..', '........'] },
    skull: { en: 'sugar skull', cn: '糖骷髅', pal: { w: '#f6f3ec', r: '#e0507a' }, px: [
      '........', '........', '..kkkk..', '.kwwwwk.', 'kwwwwwwk', 'kwkwwkwk', 'kwkwwkwk', 'kwwwwwwk',
      'kwwkkwwk', '.kwwwwk.', '..kkkk..', '.krrrrk.', '..kkkk..', '........', '........', '........'] },
    maraca: { en: 'maraca', cn: '沙锤', pal: { r: '#e0402f', w: '#fff3d0', b: '#8a5a26' }, px: [
      '........', '........', '.....kkk', '....krrk', '...krwrk', '..kkkkk.', '...kbbk.', '...kbbk.',
      '...kbbk.', '...kbbk.', '..kbbbbk', '..kkkkkk', '........', '........', '........', '........'] },
    sombrero: { en: 'sombrero', cn: '大草帽', pal: { y: '#e8b23a', r: '#c8352a' }, px: [
      '........', '........', '...kkkk.', '..kyyyyk', '.kyyyyyk', 'kyyyyyyk', 'kkkkkkkk', '.krrrrk.',
      '.kkkkkk.', '........', '........', '........', '........', '........', '........', '........'] },
    angel: { en: 'Angel of Independence', cn: '独立天使', pal: { w: '#f0e6c8', d: '#b89a60' }, px: [
      '........', '....kk..', '...kwwk.', '....kk..', '...kwwk.', '..kwwwwk', '...kwwk.', '...kwwk.',
      '..kwwwwk', '...kwwk.', '..kwwwwk', '..kkkkkk', '.kwwwwww', 'kwwwwwww', 'kkkkkkkk', '........'] },

    /* ── 开罗 ── */
    falafel: { en: 'falafel', cn: '炸豆丸', pal: { b: '#a86a32', w: '#e8d6a0' }, px: [
      '........', '........', '..kkkk..', '.kbbbbk.', 'kbwbbbbk', 'kbbbbbbk', 'kbbbwbbk', 'kbbbbbbk',
      '.kbbbbk.', '..kkkk..', '........', '........', '........', '........', '........', '........'] },
    koshari: { en: 'koshari', cn: '库莎丽', pal: { w: '#f2d38a', r: '#d8432c' }, px: [
      '........', '........', '..kkkk..', '.kwwwwk.', 'kwrrwwrk', 'kwrwwrwk', 'kwwrrwwk', '.kwwwwk.',
      '..kkkk..', '........', '........', '........', '........', '........', '........', '........'] },
    dates: { en: 'dates', cn: '椰枣', pal: { b: '#8a4a22', w: '#e8c890' }, px: [
      '........', '........', '...kkk..', '..kbbk..', '..kbwk..', '.kbbbbk.', '.kbwbbk.', '..kbbk..',
      '...kk...', '........', '........', '........', '........', '........', '........', '........'] },
    lamp: { en: 'magic lamp', cn: '神灯', pal: { y: '#e8b23a', w: '#fff3c0', d: '#b07a1a' }, px: [
      '................', '................', '................', '.......kk.......',
      '......kyyk......', '.....kkkkkk.....', 'kk...kywyyyk.kk.', 'kyk.kyyyyyyyk..k',
      '.kykyyyyyyyyyk.k', '..kyyyyyyyyyyykk', '...kyyyyyyyyyk..', '.....kkdddkk....',
      '....kddddddk....', '....kkkkkkkk....', '................', '................'] },
    camel: { en: 'camel', cn: '骆驼', pal: { b: '#d2a56e', d: '#8a6440' }, px: [
      '................', '.kkk............', 'kbbbk....kkkk...', 'kbkbbk..kbbbbk..',
      '.kkbbk.kbbbbbbk.', '...kbbkbbbbbbbbk', '...kbbbbbbbbbbbk', '....kbbbbbbbbbbk',
      '....kbbbbbbbbbkk', '.....kkkkkkkkk.k', '......d.d..d.d..', '......d.d..d.d..',
      '......d.d..d.d..', '......d.d..d.d..', '......k.k..k.k..', '................'] },
    sphinx: { en: 'sphinx', cn: '狮身人面像', pal: { w: '#e8d6a0', d: '#b89a60', b: '#3a6fd8' }, px: [
      '................', '................', '..kkkk..........', '.kbwbwk.........',
      'kbwkwwbk........', 'kbwwwwbk........', 'kbbwwbbk...kkk..', '.kbwwbkkkkkwwwk.',
      '..kwwkwwwwwwwwwk', '..kwwwwwwwwwwwwk', '.kwwwwwwwwwwwwdk', 'kwwwwkddddddddk.',
      'kkkkkkkkkkkkkkk.', '................', '................', '................'] },
    pyramid: { en: 'pyramid', cn: '金字塔', pal: { w: '#e8d6a0', d: '#b89a60' }, px: [
      '........', '........', '.......k', '......kw', '.....kww', '.....kww', '....kwwd', '....kwwd',
      '...kwwdd', '...kwwdd', '..kwwddd', '..kwwddd', '.kwwdddd', 'kwwddddd', 'kkkkkkkk', '........'] },

    /* ── 里斯本 ── */
    custard: { en: 'custard tart', cn: '葡式蛋挞', pal: { y: '#f0d07a', b: '#b8762e', d: '#8a5a26', w: '#fff6e0' }, px: [
      '........', '........', '..kkkkk.', '.kyyyyyk', 'kyydyyyk', 'kyyyyyyk', 'kbbbbbbk', 'kwbbbbwk',
      'kbwbbbbk', 'kbbbbwbk', 'kbbwbbbk', '.kbbbbk.', '..kkkk..', '........', '........', '........'] },
    sardine: { en: 'sardine tin', cn: '沙丁鱼罐头', pal: { m: '#b8c4cc', s: '#7fa8c8', w: '#f0f6fa', d: '#6a7684' }, px: [
      '........', '..kkkkk.', '.kmmmmmk', 'kmmmmmmk', 'kddddddk', 'kwwwwwwk', 'kwsssswk', 'kwsswswk',
      'kwsssswk', 'kwwwwwwk', 'kddddddk', '.kmmmmmk', '..kkkkk.', '........', '........', '........'] },
    ginjinha: { en: 'cherry liqueur', cn: '樱桃酒', pal: { r: '#a8243c', w: '#ffd0dc', g: '#d8e8f0' }, px: [
      '........', '........', '..kkkk..', '.kggggk.', '.kgrrgk.', '.krrrrk.', '.krwrrk.', '.krrrrk.',
      '.krrrrk.', '.kggggk.', '..kkkk..', '........', '........', '........', '........', '........'] },
    tram28: { en: 'tram 28', cn: '28 路电车', pal: { y: '#f0c33a', w: '#cfe8f8', d: '#8a6a1a' }, px: [
      '........', '...kkkk.', '..kyyyyk', '.kwwwwww', 'kwwwwwww', 'kwwwwwww', 'kwwwwwww', 'kwwwwwww',
      'kkkkkkkk', 'kyyyyyyy', 'kydyyydy', 'kyyyyyyy', 'kkkkkkkk', '.kk..kk.', '.kwk.kwk', '..k...k.'] },
    belem: { en: 'Belem Tower', cn: '贝伦塔', pal: { w: '#efe2c8', d: '#b89a70' }, px: [
      '........', '.k.k.k.k', '.kkkkkkk', 'kwwwwwww', 'kwwwwwww', 'kkkkkkkk', '.kwwwwwk', '.kwddwwk',
      '.kwwwwwk', '.kwddwwk', '.kwwwwwk', '.kkkkkkk', 'kwwwwwww', 'kkkkkkkk', '..kkkkk.', '........'] },

    /* ── 罗马 ── */
    gelato: { en: 'gelato', cn: '意式冰淇淋', pal: { o: '#e0b070', p: '#ffb3c8', g: '#9be0b0', b: '#a06a3c' }, px: [
      '........', '...kkkk.', '..kppppk', '.kpppppk', '.kpppppk', '.kgggggk', '.kgwgggk', '..kkkkk.',
      '...kbbk.', '..kbbbk.', '..kbbbk.', '...kbk..', '...kbk..', '....k...', '........', '........'] },
    espresso: { en: 'espresso', cn: '浓缩咖啡', pal: { w: '#fff6e0', s: '#6a4028', m: '#c8d0d8' }, px: [
      '........', '........', '.....k..', '..kkkkk.', '..ksssk.', '..kssssk', '..kwwwwk', '..kwwwwk',
      '...kkkk.', '.kmmmmmk', 'kkkkkkkk', '........', '........', '........', '........', '........'] },
    panini: { en: 'panini', cn: '帕尼尼', pal: { b: '#c98a4b', w: '#fff6e0', g: '#7cb342', r: '#d0413a' }, px: [
      '........', '..kkkkk.', '.kbbbbbk', 'kbbbbbbk', 'kwwwwwwk', 'kgggrrrk', 'kwwwwwwk', 'kbbbbbbk',
      'kkkkkkkk', '........', '........', '........', '........', '........', '........', '........'] },
    vespa: { en: 'vespa', cn: '小摩托', pal: { r: '#e0483c', w: '#3a3a3a', c: '#cfe8f8' }, px: [
      '................', '................', '................', '..kkk...........',
      '...kk...........', '...krk...kkkkk..', '...krk..kwwwwwk.', '...krrk.krrrrrrk',
      '...krrrkrrrrrrrk', '..krrrrrrrrrrrrk', '..kkkkkkkkkkkkkk', '..kwk......kwk..',
      '..kkk......kkk..', '................', '................', '................'] },
    colosseum: { en: 'Colosseum', cn: '斗兽场', pal: { w: '#e8d6b0', d: '#b89a70' }, px: [
      '........', '.k.k.k..', '.kkkkkk.', 'kwwwwwww', 'kwddwwww', 'kwwwwwww', 'kwddwddw', 'kwwwwwww',
      'kkkkkkkk', '.k....k.', '.k....k.', 'kkkkkkkk', '........', '........', '........', '........'] },

    /* ── 香港 ── */
    pinebun: { en: 'pineapple bun', cn: '菠萝包', pal: { y: '#e8b45a', d: '#c08a3a', w: '#ffe6b0' }, px: [
      '........', '........', '..kkkkk.', '.kyyyyyk', 'kydwyydk', 'kydyyydk', 'kyyyddyk', 'kydyyydk',
      '.kyyyyyk', '..kkkkk.', '........', '........', '........', '........', '........', '........'] },
    wonton: { en: 'wonton noodles', cn: '云吞面', pal: { w: '#f2f6fa', y: '#f0d07a', p: '#ffd0b8' }, px: [
      '........', '........', '..kkkkk.', '.kyyyyyk', 'kypppyyk', 'kyyyypyk', 'kwwwwwwk', 'kwwwwwwk',
      '.kwwwwk.', '..kkkk..', '........', '........', '........', '........', '........', '........'] },
    milktea: { en: 'milk tea', cn: '丝袜奶茶', pal: { t: '#c89060', w: '#f6e6d0' }, px: [
      '........', '.....kkk', '....kttt', '...kttt.', '..kkkkk.', '.ktttttk', '.kttwttk', '.ktttttk',
      '.ktttttk', '.ktttttk', '..kkkkk.', '........', '........', '........', '........', '........'] },
    dingding: { en: 'ding ding tram', cn: '叮叮车', pal: { g: '#2f8f6a', w: '#d8f0e8', y: '#f0c33a' }, px: [
      '.k......', '.k......', 'kkkkkkk.', 'kggggggk', 'kgwwwwwk', 'kgwwwwwk', 'kggggggk', 'kgwwwwwk',
      'kgwwwwwk', 'kggggggk', 'kkkkkkkk', '..k..k..', '.kwk.kwk', '.kkk.kk.', '........', '........'] },
    buddha: { en: 'Tian Tan Buddha', cn: '天坛大佛', pal: { g: '#c8b878', d: '#8a7a4a', y: '#ffe08a' }, px: [
      '........', '...kkk..', '..kyyyk.', '.kyyyyyk', '.kkkkkkk', '..kgggk.', '.kgggggk', 'kggggggk',
      'kkkkkkkk', '.kgggggk', 'kggggggk', 'kkkkkkkk', '.kgggggk', '..kkkkk.', '........', '........'] },

    /* ── 里约 ── */
    acai: { en: 'acai bowl', cn: '巴西莓碗', pal: { p: '#7a3a8a', w: '#f6e6f0', y: '#f0d07a' }, px: [
      '........', '........', '..kkkkk.', '.kpppppk', 'kppwwppk', 'kpyypppk', 'kpppyypk', 'kppppppk',
      '.kwwwwwk', '..kkkkk.', '........', '........', '........', '........', '........', '........'] },
    churrasco: { en: 'churrasco', cn: '巴西烤肉', pal: { m: '#b5652e', d: '#7a3e1a', s: '#c8b8a0' }, px: [
      '.......s', '.......s', '...kkkk.', '..kmmmmk', '..kmdmmk', '..kkkkk.', '..kmmmmk', '..kmmdmk',
      '..kkkkk.', '..kmmmmk', '..kkkkk.', '.......s', '........', '........', '........', '........'] },
    coconut: { en: 'coconut', cn: '椰子', pal: { b: '#8a6a4a', w: '#f6f0e0', r: '#e0507a' }, px: [
      '........', '.....kkk', '....krrr', '...krrr.', '..kkkkk.', '.kwwwwwk', 'kwwbbwww', 'kwwwwwww',
      'kwbwwwbw', '.kwwwwwk', '..kkkkk.', '........', '........', '........', '........', '........'] },
    football: { en: 'football', cn: '足球', pal: { w: '#f6f6f6', k: '#2a2a2a' }, px: [
      '........', '..kkkk..', '.kwwwwk.', 'kwwkkwwk', 'kwwkkwwk', 'kwwwwwwk', '.kwwwwk.', '..kkkk..',
      '........', '........', '........', '........', '........', '........', '........', '........'] },
    christ: { en: 'Christ the Redeemer', cn: '基督像', pal: { w: '#f0ece0' }, px: [
      '........', '...kk...', '..kwwk..', '..kwwk..', '.kwwwwk.', 'kkwwwwkk', '..kwwk..', '..kwwk..',
      '..kwwk..', '.kwwwwk.', '.kkkkkk.', '..kkkk..', '........', '........', '........', '........'] },

    /* ── 孟买 ── */
    samosa: { en: 'samosa', cn: '咖喱角', pal: { y: '#dcae5a', d: '#b8802e' }, px: [
      '........', '........', '.....kk.', '....kyyk', '...kyyyk', '..kyydyk', '.kyyyyyk', 'kyyyyyyk',
      'kkkkkkkk', '........', '........', '........', '........', '........', '........', '........'] },
    naan: { en: 'naan', cn: '印度烤饼', pal: { w: '#f0d8a8', d: '#c8a060' }, px: [
      '........', '........', '..kkkk..', '.kwwwwk.', 'kwwddwwk', 'kwwwwwdk', 'kwddwwwk', '.kwwwwk.',
      '..kkkk..', '........', '........', '........', '........', '........', '........', '........'] },
    chai: { en: 'masala chai', cn: '印度奶茶', pal: { t: '#c08a52', w: '#f6e8d8' }, px: [
      '..k..k..', '...k..k.', '..kkkkk.', '.ktttttk', '.ktwtttk', '.ktttttk', '.ktttttk', '.ktttttk',
      '..kkkkk.', '........', '........', '........', '........', '........', '........', '........'] },
    rickshaw: { en: 'auto rickshaw', cn: '三轮车', pal: { y: '#e8c33a', d: '#2f2f2f', w: '#cfe8f8', g: '#3f8f4a' }, px: [
      '................', '................', '...kkkkkkkkkkk..', '..kyyyyyyyyyyyk.',
      '..kkkkkkkkkkkkk.', '..kwk.....k..k..', '.kwwk.....k..k..', 'kywwkkkkkkkkkkk.',
      'kggggggggggggggk', 'kgdgggggggggggdk', '.kkkkkkkkkkkkkk.', '..kdk......kdk..',
      '..kkk......kkk..', '................', '................', '................'] },
    gateway: { en: 'Gateway of India', cn: '印度门', pal: { y: '#e0c88a', d: '#b09050' }, px: [
      '........', '.kkkkkk.', 'kyyyyyyk', 'kkkkkkkk', 'kyk..kyk', 'kyk..kyk', 'kyk..kyk', 'kyk..kyk',
      'kyk..kyk', 'kyk..kyk', 'kkkkkkkk', '........', '........', '........', '........', '........'] },

    /* ── 莫斯科 ── */
    borscht: { en: 'borscht', cn: '罗宋汤', pal: { r: '#c8323c', w: '#f6efe6' }, px: [
      '........', '........', '..kkkkk.', '.krrrrrk', 'krrwwrrk', 'krrrrrrk', 'krrrwrrk', '.kwwwwwk',
      '..kkkkk.', '........', '........', '........', '........', '........', '........', '........'] },
    blini: { en: 'blini', cn: '布林薄饼', pal: { y: '#e8c070', d: '#c09040', r: '#c8323c' }, px: [
      '........', '........', '..kkkkk.', '.kyyyyyk', 'kyyddyyk', 'kkkkkkkk', '.kyyyyyk', 'kyyydyyk',
      'kkkkkkkk', '.krrrrk.', '..kkkk..', '........', '........', '........', '........', '........'] },
    pelmeni: { en: 'pelmeni', cn: '俄式饺子', pal: { w: '#f2e8d0', d: '#d8c8a0' }, px: [
      '........', '........', '..kkkkk.', '.kwwwwwk', 'kwwddwwk', 'kwdwwdwk', 'kwwddwwk', 'kwwwwwwk',
      'kkkkkkkk', '.kwwwwk.', '..kkkk..', '........', '........', '........', '........', '........'] },
    matryoshka: { en: 'matryoshka', cn: '套娃', pal: { r: '#d8402f', y: '#f0c33a', s: '#f6d8b8' }, px: [
      '........', '...kkk..', '..krrrk.', '..kssrk.', '..kssrk.', '.krrrrrk', 'krryyrrk', 'krryyrrk',
      'krrrrrrk', 'krryyrrk', '.krrrrk.', '..kkkk..', '........', '........', '........', '........'] },
    vassily: { en: 'St Basil Cathedral', cn: '圣瓦西里', pal: { r: '#d8402f', g: '#e8b23a', w: '#f0e8d8' }, px: [
      '...kk...', '..kwwk..', '..krrk..', '.krrrrk.', 'krrrrrrk', 'kkkkkkkk', '.kggggk.', '.kgwwgk.',
      '.kggggk.', 'kkkkkkkk', 'krwwrrwk', 'kkkkkkkk', '.kkkkkk.', '........', '........', '........'] },

    /* ── 以下地区：sym = 8 列镜像后裁切居中；solo = 不镜像、裁切居中 ── */
    /* ── 悉尼 ── */
    meatpie: { en: 'meat pie', cn: '澳式肉派', sym: 1, pal: { p: '#d99a4e', d: '#a8682a' }, px: [
      '...kkkkk', '..kppppp', '.kppdppp', '.kpppppd', 'kddddddd', 'kdpdpdpd', '.kdddddd', '..kkkkkk'] },
    lamington: { en: 'lamington', cn: '拉明顿蛋糕', sym: 1, pal: { c: '#5a3420', w: '#f6efe6' }, px: [
      '.kkkkkkk', 'kwcwcwcw', 'kcwcccwc', 'kccwcccc', 'kcwccwcc', 'kccccwcc', 'kwcccccw', '.kkkkkkk'] },
    boomerang: { en: 'boomerang', cn: '回旋镖', solo: 1, pal: { b: '#c8823a', w: '#f6e6c8' }, px: [
      'kk......kk', 'kbk....kbk', 'kwbk..kbwk', '.kbbkkbbk.', '..kbbbbk..', '...kbbk...', '....kk....'] },
    kangaroo: { en: 'kangaroo', cn: '袋鼠', solo: 1, pal: { b: '#b87a48', l: '#e0b080' }, px: [
      '....kk.......', '...kbbk......', '..kbbbbk.....', '..kbkbbk.....', '...kbbbk.....', '...kbbbbk....',
      '..kbllbbbk...', '..kbllbbbbk..', '...kbbbbbbk..', '...kbbkbbbbk.', '..kbbk.kbbbbk', '.kkkk...kkkk.'] },
    opera: { en: 'Sydney Opera House', cn: '悉尼歌剧院', solo: 1, pal: { w: '#f6f6f0', g: '#c8ccd4', b: '#3a6fa8' }, px: [
      '.....k.....k....', '....kwk...kwk...', '...kwwk..kwwk.k.', '..kwwgk.kwwgkkwk', '.kwwwgkkwwwgkwwk',
      'kwwwwgkwwwwgkwgk', 'kkkkkkkkkkkkkkkk', 'gggggggggggggggg', 'bbbbbbbbbbbbbbbb'] },

    /* ── 巴塞罗那 ── */
    paella: { en: 'paella', cn: '西班牙海鲜饭', sym: 1, pal: { y: '#f2c040', r: '#e05a3a', g: '#5aa04a' }, px: [
      '..kkkkkk', '.kyyyyyy', 'kyyryyyg', 'kyyyygyy', 'kyryyyyy', '.kyyyyyy', '..kkkkkk'] },
    jamon: { en: 'jamon', cn: '西班牙火腿', solo: 1, pal: { m: '#c8505a', f: '#f6e0d0', b: '#8a5a3a' }, px: [
      '......kk', '.....kbk', '....kmmk', '...kmmmk', '..kmmfmk', '.kmmmmk.', 'kmmfmmk.', 'kmmmmk..', '.kkkk...'] },
    fan: { en: 'hand fan', cn: '折扇', sym: 1, pal: { r: '#d8303c', y: '#f2c94c' }, px: [
      '...kkkkk', '.kkrrrrr', 'krryrrry', 'krrryrry', '.krrryry', '..kkrryr', '....kkry', '......kk'] },
    guitar: { en: 'guitar', cn: '吉他', solo: 1, pal: { b: '#c8823a', d: '#5a3420' }, px: [
      '.....kk...', '....kdk...', '....kdk...', '....kdk...', '...kbbbk..', '..kbbbbbk.', '..kbbdbbk.',
      '...kbbbk..', '..kbbbbbk.', '.kbbbbbbbk', '.kbbbbbbbk', '..kbbbbbk.', '...kkkkk..'] },
    sagrada: { en: 'Sagrada Familia', cn: '圣家堂', sym: 1, pal: { s: '#d8c49a', d: '#a8905a' }, px: [
      '.k...k..', 'ksk.ksk.', 'ksk.ksk.', 'kdk.kdk.', 'ksk.ksk.', 'ksskkssk', 'kdssssss', 'kssdssss',
      'ksssskkk', 'kssssddd', 'kkkkkkkk'] },

    /* ── 阿姆斯特丹 ── */
    stroopwafel: { en: 'stroopwafel', cn: '焦糖华夫饼', sym: 1, pal: { y: '#d8a050', d: '#a86a2a' }, px: [
      '...kkkkk', '.kkyyyyy', '.kydydyd', 'kyyyyyyy', 'kydydydy', 'kyyyyyyy', '.kydydyd', '.kkyyyyy', '...kkkkk'] },
    cheese: { en: 'cheese', cn: '奶酪', solo: 1, pal: { y: '#f2c94c', d: '#d8a030' }, px: [
      '.......kk', '.....kkyk', '...kkyyyk', '.kkyydyyk', 'kyyyyyyyk', 'kddyddydk', 'kdddddddk', 'kkkkkkkkk'] },
    clog: { en: 'clog', cn: '木鞋', solo: 1, pal: { y: '#f2c94c', o: '#e08a2a' }, px: [
      '.kkkkk.......', 'kyyyyyk......', 'kyyyyyykkkk..', 'kyyyyyyyyyykk', 'kyyoyyyyyyyyk', '.kyyyyyyyyyyk', '..kkkkkkkkkk.'] },
    bicycle: { en: 'bicycle', cn: '自行车', solo: 1, pal: { r: '#d8303c' }, px: [
      '....kk....kk....', '.....rrrrrr.....', '....r.r..r.r....', '.kkk..r.r...kkk.', 'k...k..r...k...k',
      'k.r.k......k.r.k', 'k...k......k...k', '.kkk........kkk.'] },
    windmill: { en: 'windmill', cn: '风车', sym: 1, pal: { b: '#8a5a3a', w: '#f0e6d2' }, px: [
      'kk......', 'kwk.....', '.kwk....', '..kwk...', '...kwkkk', '....kkbb', '...kwkbb', '..kwkkbb',
      '.kwk.kbb', 'kwk..kbb', 'kk..kbbb', '....kbbb', '...kbbbk', '...kbbbk', '..kkkkkk'] },

    /* ── 柏林 ── */
    pretzel: { en: 'pretzel', cn: '椒盐卷饼', sym: 1, pal: { b: '#a8622a', w: '#f6efe6' }, px: [
      '..kkkk..', '.kbwbbk.', 'kbk..kbk', 'kbk...kb', 'kbk...kb', '.kbk.kbk', '..kbbbk.', '..kbkkbb', '...kbbbk', '....kkk.'] },
    currywurst: { en: 'currywurst', cn: '咖喱香肠', solo: 1, pal: { r: '#d8402f', s: '#b8602a', w: '#f6efe6' }, px: [
      '.kkkkkkkkkkkk.', 'kwrsrrsrrsrrwk', 'kwsrrsrrsrrswk', '.kkkkkkkkkkkk.'] },
    beer: { en: 'beer mug', cn: '啤酒杯', solo: 1, pal: { y: '#f2b830', w: '#fffaf0' }, px: [
      '.kkkkkk...', 'kwwwwwwk..', 'kyyyyyykkk', 'kyyyyyyk.k', 'kyyyyyyk.k', 'kyyyyyykkk', 'kyyyyyyk..', '.kkkkkk...'] },
    ampelmann: { en: 'traffic light man', cn: '红绿灯小人', solo: 1, pal: { g: '#3fbf5a' }, px: [
      '...kkk...', '..kgggk..', 'kkkkkkkkk', '...kgk...', '..kgggk..', '.kgggggk.', 'kgkgggkgk', '...kgk...',
      '..kg.gk..', '.kg...gk.', '.kk...kk.'] },
    brandenburg: { en: 'Brandenburg Gate', cn: '勃兰登堡门', sym: 1, pal: { s: '#e0d0a8', g: '#5a9a7a' }, px: [
      '.....kkk', '.....kgg', 'kkkkkkkk', 'ksssssss', 'kkkkkkkk', 'ksk.ksk.', 'ksk.ksk.', 'ksk.ksk.', 'ksk.ksk.', 'kkkkkkkk'] },

    /* ── 雅典 ── */
    gyro: { en: 'gyro', cn: '希腊卷饼', solo: 1, pal: { p: '#f0d8a8', m: '#b5652e', g: '#5aa04a', r: '#d8402f' }, px: [
      '.kk....kk.', 'kgmrgmrgmk', 'kpmmgmrmpk', '.kpmmmmpk.', '.kppppppk.', '..kppppk..', '..kppppk..', '...kppk...', '....kk....'] },
    olive: { en: 'olive', cn: '橄榄', solo: 1, pal: { g: '#4a8a3a', o: '#6a7a2a' }, px: [
      '....kk....', '...kggk...', '..kgggk...', '..kggk.kk.', '.kkkk.kook', 'koook.kook', 'koook..kk.', '.kkk......'] },
    owl: { en: 'owl', cn: '猫头鹰', sym: 1, pal: { b: '#8a6a4a', y: '#f2c94c', w: '#e8d8b8' }, px: [
      '.k......', '.kk.....', '.kbkkkkk', 'kbwwkbbb', 'kbwykbbb', 'kbwwkbby', 'kbbbbbby', 'kbwbwbbb',
      'kbbwbwbb', '.kbbbbbb', '..kyykkk'] },
    amphora: { en: 'amphora', cn: '双耳陶罐', sym: 1, pal: { o: '#d8783a' }, px: [
      '....kkkk', '.....koo', '..kkkooo', '.k.kooko', '.kkooooo', '..kokkkk', '..kooooo', '..kokoko', '...koooo', '....kooo', '.....kkk'] },
    parthenon: { en: 'Parthenon', cn: '帕特农神庙', sym: 1, pal: { w: '#efe6d0', d: '#b8a888' }, px: [
      '.....kkk', '...kkwww', '.kkwwwww', 'kkkkkkkk', '.kwk.kwk', '.kwk.kwk', '.kwk.kwk', '.kwk.kwk',
      'kkkkkkkk', 'kddddddd', 'kkkkkkkk'] },

    /* ── 马拉喀什 ── */
    tagine: { en: 'tagine', cn: '塔吉锅', sym: 1, pal: { r: '#c8603a', y: '#e8b060', d: '#8a3a22' }, px: [
      '.......k', '......kk', '......kr', '.....krr', '....krry', '...krrrr', '..krryrr', '.krrrrrr', 'kkkkkkkk', 'kddddddd', '.kkkkkkk'] },
    minttea: { en: 'mint tea', cn: '薄荷茶', solo: 1, pal: { g: '#5ab04a', t: '#d8a040', w: '#f0f8f0' }, px: [
      '..gg..', 'kkkkkk', 'kwgggk', 'kttttk', 'kttttk', '.kttk.', '.kttk.', '.kkkk.'] },
    couscous: { en: 'couscous', cn: '古斯米', sym: 1, pal: { y: '#f0d07a', o: '#e08a3a', b: '#4a6fb0' }, px: [
      '...kkkkk', '..kyyyyy', '.kyyoyyy', 'kkkkkkkk', 'kbbbbbbb', '.kbbybbb', '..kbbbbb', '...kkkkk'] },
    lantern: { en: 'lantern', cn: '摩洛哥灯', sym: 1, pal: { y: '#f2c040', r: '#d8603a' }, px: [
      '.......k', '......kk', '.....kyy', '....kkkk', '...kyryr', '..kyryry', '..kryryr', '...kyryr', '....kkkk', '.....kyy', '......kk'] },
    koutoubia: { en: 'Koutoubia Mosque', cn: '库图比亚清真寺', sym: 1, pal: { s: '#d8a070', d: '#a86a3a', y: '#f2c94c' }, px: [
      '.......k', '......ky', '.....kkk', '.....kss', '....kkkk', '....kssd', '....ksds', '....kssd', '....ksds',
      '....kssd', '....ksss', '...kkkkk'] },

    /* ── 河内 ── */
    pho: { en: 'pho', cn: '越南河粉', sym: 1, pal: { w: '#f6efe6', b: '#e0c890', g: '#5aa04a', r: '#d8402f' }, px: [
      '....w..w', '...w..w.', '..kkkkkk', '.kbgbbrb', 'kkkkkkkk', 'kwwwwwww', '.kwwrwww', '..kwwwww', '...kkkkk'] },
    banhmi: { en: 'banh mi', cn: '越南法包', solo: 1, pal: { b: '#e0a050', g: '#5aa04a', r: '#d8402f' }, px: [
      '.....kkkk.', '...kkbbbbk', '.kkbbbbbbk', 'kbbbbbbbk.', 'kgrgrgrk..', 'kbbbbbk...', '.kkkkk....'] },
    phin: { en: 'phin coffee', cn: '越南滴滤咖啡', sym: 1, pal: { m: '#c8ccd4', c: '#5a3420', w: '#f6e6c8' }, px: [
      '..kkkkkk', '..kmmmmm', '...kmmmm', 'kkkkkkkk', '.kwwwwww', '.kcccccc', '.kcccccc', '..kccccc', '..kkkkkk'] },
    nonla: { en: 'conical hat', cn: '越南斗笠', sym: 1, pal: { y: '#e8c870', d: '#b8984a' }, px: [
      '.......k', '......ky', '.....kyd', '....kydy', '...kyydy', '..kydyyd', '.kyyydyy', 'kkkkkkkk'] },
    turtletower: { en: 'Turtle Tower', cn: '龟塔', sym: 1, pal: { s: '#d8c8a0', d: '#a89870', b: '#3a7a8a' }, px: [
      '.......k', '......kk', '.....kss', '.....ksd', '....kkkk', '....kssk', '....ksds', '...kkkkk', '...ksksk',
      '...kssss', 'bbbkkkkk', 'bbbbbbbb'] },

    /* ── 北京 ── */
    duck: { en: 'Peking duck', cn: '北京烤鸭', solo: 1, pal: { r: '#c8642a', y: '#f2c060' }, px: [
      '.......kk.', '......krrk', '..kkkkrrk.', '.krrrrrrk.', 'krryrrrrk.', 'krrrrrrrk.', '.krrrrrk..', '..kkkkk...'] },
    tanghulu: { en: 'candied haws', cn: '糖葫芦', solo: 1, pal: { r: '#e0303e', w: '#ffd0d8', b: '#a8783a' }, px: [
      '..kkk.', '.krwrk', '.krrrk', '..kkk.', '.krwrk', '.krrrk', '..kkk.', '.krwrk', '.krrrk', '..kkk.', '...b..', '...b..', '...b..'] },
    baozi: { en: 'steamed bun', cn: '包子', sym: 1, pal: { w: '#f6efe6', d: '#d8ccb8' }, px: [
      '......kk', '....kkwd', '...kwwdw', '..kwwwwd', '.kwwwwww', 'kwwwwwww', 'kwwwwwww', 'kddddddd', '.kkkkkkk'] },
    kite: { en: 'kite', cn: '风筝', sym: 1, pal: { r: '#d8303c', y: '#f2c94c' }, px: [
      '.......k', '......kr', 'kk...kry', 'krkk.kry', 'kryrkkrr', '.kryrrry', '..kkrrrr', '....kkry', '.....krk', '....kk.k'] },
    templeofheaven: { en: 'Temple of Heaven', cn: '天坛', sym: 1, pal: { b: '#3a5ab8', r: '#c8303c', y: '#e8b23a', w: '#efe6d0' }, px: [
      '.......k', '......ky', '....kkkk', '...kbbbb', '....krrr', '..kkkkkk', '.kbbbbbb', '...krrrr', 'kkkkkkkk',
      'kbbbbbbb', '..krrrrr', 'kkkkkkkk', 'kwwwwwww', 'kkkkkkkk'] },

    /* ── 多伦多 ── */
    pancake: { en: 'maple pancake', cn: '枫糖松饼', sym: 1, pal: { y: '#e8b060', d: '#b8762e', s: '#8a4a1a' }, px: [
      '.....kkk', '..kkksss', '.kyssyys', 'kddddsdd', 'kyyyyyyy', 'kddsdddd', 'kyyyyyyy', 'kddddddd', 'kkkkkkkk'] },
    poutine: { en: 'poutine', cn: '肉汁奶酪薯条', sym: 1, pal: { y: '#f2c94c', b: '#8a4a22', w: '#f6efe6' }, px: [
      '..k.k.k.', '.kykykyk', '.kybbyky', 'kkkkkkkk', 'kwwwwwww', '.kwwwwww', '..kkkkkk'] },
    donut: { en: 'donut', cn: '甜甜圈', sym: 1, pal: { p: '#ff9ec4', b: '#d8a060', y: '#f2c94c', g: '#5ac8ff' }, px: [
      '...kkkkk', '.kkppppp', 'kppypgpp', 'kpgpkkkk', 'kpppk...', 'kbppkkkk', '.kbbbbbb', '..kkkkkk'] },
    mapleleaf: { en: 'maple leaf', cn: '枫叶', sym: 1, pal: { r: '#d8303c' }, px: [
      '.......k', '......kr', '..k..krr', '.krk.krr', 'krrrkkrr', '.krrrrrr', 'kkrrrrrr', 'krrrrrrr', '.kkrrrrr',
      '...kkkrr', '......kk', '.......k'] },
    cntower: { en: 'CN Tower', cn: '加拿大国家电视塔', sym: 1, pal: { g: '#c8ccd4', d: '#8a909a' }, px: [
      '.......k', '.......k', '......kg', '......kg', '....kkkk', '...kgddg', '....kkkk', '......kg', '......kg',
      '.....kgg', '.....kgg', '....kggg', '...kgggg', '..kkkkkk'] },

    /* ── 开普敦 ── */
    biltong: { en: 'biltong', cn: '南非肉干', solo: 1, pal: { m: '#8a3a2a', d: '#5a2418' }, px: [
      '.kk..kk..kk.', 'kmmkkmmkkmmk', 'kmdkkmdkkmdk', 'kmmkkmmkkmmk', 'kdmkkdmkkdmk', 'kmmkkmmkkmmk', '.kk..kk..kk.'] },
    rooibos: { en: 'rooibos tea', cn: '南非博士茶', sym: 1, pal: { r: '#c8603a', w: '#f6efe6' }, px: [
      '....w..w', '..kkkkkk', '..kwrrrr', '..kwwwww', '...kwwww', 'kkkkkkkk', '.kkkkkkk'] },
    protea: { en: 'protea', cn: '帝王花', sym: 1, pal: { p: '#f08ab0', d: '#c8507a', g: '#5aa04a' }, px: [
      '...k.k.k', '..kpkpkp', '.kpdpdpd', 'kpdpdpdp', 'kpdpdpdp', '.kpppppp', '..kkkkgg', '......kg', '.....kgg', '.......g'] },
    penguin: { en: 'penguin', cn: '企鹅', sym: 1, pal: { b: '#2a3040', w: '#f6f6f6', y: '#f2b830' }, px: [
      '....kkkk', '...kbbbb', '..kbwkbb', '..kbbbby', '.kbbwwww', 'kbbwwwww', 'kbbwwwww', '.kbwwwww', '..kwwwww', '..kyykkk'] },
    tablemountain: { en: 'Table Mountain', cn: '桌山', solo: 1, pal: { g: '#5a7a5a', d: '#3a5a4a', w: '#f0f0f0', b: '#3a7ab8' }, px: [
      '...wwwwwwwwww...', '..kkkkkkkkkkkk..', '.kgggggggggggdk.', 'kgggdgggggdgggdk', 'kggggggdggggggdk', 'bbbbbbbbbbbbbbbb'] },

    /* ── 布宜诺斯艾利斯 ── */
    empanada: { en: 'empanada', cn: '阿根廷馅饼', sym: 1, pal: { y: '#e0b060', d: '#b8803a' }, px: [
      '...kkkkk', '.kkyyyyy', 'kyyyyyyy', 'kyyyyyyy', 'kkdkdkdk', '.kkkkkkk'] },
    alfajor: { en: 'alfajor', cn: '阿法乔饼', sym: 1, pal: { w: '#fff6e0', b: '#c89060', c: '#8a5a2a' }, px: [
      '..kwwwww', '.kbbbbbb', 'kkkkkkkk', 'kccccccc', 'kkkkkkkk', '.kbbbbbb', '..kkkkkk'] },
    mate: { en: 'mate', cn: '马黛茶', solo: 1, pal: { g: '#5aa04a', b: '#a8783a', m: '#c8ccd4' }, px: [
      '......kk', '.....km.', '....km..', '.kkkmkk.', 'kgggmggk', 'kbbbbbbk', 'kbbbbbbk', '.kbbbbk.', '..kkkk..'] },
    bandoneon: { en: 'bandoneon', cn: '班多钮手风琴', sym: 1, pal: { r: '#c8303c', w: '#f6efe6' }, px: [
      'kkkkkkkk', 'krrkwkwk', 'krrkwkwk', 'krrkwkwk', 'krrkwkwk', 'kkkkkkkk'] },
    obelisco: { en: 'Obelisco', cn: '方尖碑', sym: 1, pal: { w: '#efe6d0', d: '#b8a888' }, px: [
      '.......k', '......kw', '......kw', '......kw', '......kw', '.....kww', '.....kwd', '.....kww', '.....kwd',
      '.....kww', '.....kww', '....kwww', '...kkkkk'] },

    /* ── 库斯科 ── */
    ceviche: { en: 'ceviche', cn: '秘鲁酸橘汁腌鱼', sym: 1, pal: { w: '#fff6e0', o: '#f08a5a', g: '#5aa04a', y: '#f2c94c', b: '#3a6fb0' }, px: [
      '...kkkkk', '..kwowgy', '.kwogwow', 'kkkkkkkk', 'kbbbbbbb', '.kbbbbbb', '..kkkkkk'] },
    corn: { en: 'corn', cn: '玉米', solo: 1, pal: { y: '#f2c94c', d: '#d8a030', g: '#5aa04a' }, px: [
      '..kkk..', '.kyyyk.', '.kydyk.', '.kyyyk.', 'gkydykg', 'gkyyykg', '.gkdkg.', '..gkg..', '...g...'] },
    panflute: { en: 'pan flute', cn: '排箫', solo: 1, pal: { b: '#c8a060', r: '#d8402f' }, px: [
      'kkkkkkkkk', 'kbkbkbkbk', 'krkrkrkrk', 'kbkbkbkbk', 'kbkbkbk..', 'kbkbkbk..', 'kbkbk....', 'kbk......', 'kk.......'] },
    llama: { en: 'llama', cn: '羊驼', solo: 1, pal: { w: '#f0e6d8', r: '#d8402f' }, px: [
      '..kk......', '.kwwk.....', '.kwkwk....', '..kwwk....', '..kwwk....', '..kwwkkkkk', '..kwwwwwwk', '..krrrrrrk',
      '..kwwwwwwk', '..kwk..kwk', '..kwk..kwk', '..kk...kk.'] },
    machupicchu: { en: 'Machu Picchu', cn: '马丘比丘', solo: 1, pal: { g: '#4a8a4a', d: '#2f5f3a', s: '#a8a090' }, px: [
      '.........k......', '........kgk.....', '.......kgggk....', '......kggdggk...', '.....kgggggdgk..', '....kgdggggggk..',
      '..kksssssssssk..', '.ksksksksksksk..', 'kssssssssssssssk', 'kgggggggggggggg.'] },

    /* ── 旧金山 ── */
    sourdough: { en: 'sourdough', cn: '酸面包', sym: 1, pal: { b: '#c8823a', w: '#f0d8a8' }, px: [
      '...kkkkk', '.kkbbbbb', 'kbbwbbbw', 'kbbbwbbw', 'kbbbbbbb', '.kkkkkkk'] },
    fortune: { en: 'fortune cookie', cn: '幸运饼干', solo: 1, pal: { y: '#e8b060', w: '#fffaf0' }, px: [
      '...kkkk...', '..kyyyyk..', '.kyyyyyyk.', 'kyyykkyyyk', 'kyykwwkyyk', '.kkk..kkk.'] },
    chowder: { en: 'clam chowder', cn: '面包碗浓汤', sym: 1, pal: { b: '#c8823a', w: '#f6efe6' }, px: [
      '..kkkkkk', '.kbwwwww', 'kbbwwwww', 'kbbbbbbb', 'kbbbbbbb', '.kbbbbbb', '..kkkkkk'] },
    cablecar: { en: 'cable car', cn: '叮当车', sym: 1, pal: { r: '#c8303c', y: '#f2c94c', g: '#a8d8ff' }, px: [
      '.kkkkkkk', 'kyyyyyyy', 'kkkkkkkk', 'krgkrgkr', 'krgkrgkr', 'krrrrrrr', 'kyyyyyyy', 'kkkkkkkk', '..kk....'] },
    goldengate: { en: 'Golden Gate Bridge', cn: '金门大桥', solo: 1, pal: { r: '#d8502f', b: '#3a6fb0' }, px: [
      '..k........k....', '.krk......krk...', '.krkk....kkrk...', '.krk.k..k.krk...', '.krk..kk..krk...',
      'kkkkkkkkkkkkkkkk', 'rrrrrrrrrrrrrrrr', '.krk......krk...', 'bbbbbbbbbbbbbbbb'] },

    /* ── 檀香山 ── */
    poke: { en: 'poke bowl', cn: '夏威夷波奇饭', sym: 1, pal: { o: '#f08a6a', g: '#5aa04a', w: '#fff6e0', b: '#3a6fb0' }, px: [
      '...kkkkk', '..kogwog', '.kwoogwo', 'kkkkkkkk', 'kbbbbbbb', '.kbbbbbb', '..kkkkkk'] },
    shaveice: { en: 'shave ice', cn: '彩虹刨冰', sym: 1, pal: { r: '#ff6b8a', y: '#f2c94c', b: '#5ac8ff', w: '#fffaf0' }, px: [
      '....kkkk', '..kkrrrr', '.krrryyy', '.kyyyybb', '..kbbbbb', '...kwwww', '...kwwww', '....kwww', '....kkkk'] },
    pineapple: { en: 'pineapple', cn: '菠萝', sym: 1, pal: { y: '#f2c040', d: '#c8902a', g: '#4caf50' }, px: [
      '......kg', '....kkgg', '.....kgg', '...kkkkk', '..kydydy', '.kyyyyyy', '.kydydyd', '.kyyyyyy', '.kydydyd', '..kyyyyy', '...kkkkk'] },
    surfboard: { en: 'surfboard', cn: '冲浪板', solo: 1, pal: { y: '#f2c94c', r: '#e0507a' }, px: [
      '..kk..', '.kyyk.', '.kyyk.', 'kyrryk', 'kyrryk', 'kyyyyk', 'kyrryk', 'kyyyyk', '.kyyk.', '.kyyk.', '..kk..'] },
    diamondhead: { en: 'Diamond Head', cn: '钻石头山', solo: 1, pal: { g: '#5a8a4a', d: '#3a6a3a', b: '#3a7ab8', s: '#e8d8a0' }, px: [
      '.......kk.......', '.....kkggkk.....', '...kkggdgggkk...', '..kggggggdgggk..', '.kgggdgggggggdk.',
      'kggggggggdgggggk', 'ssssssssssssssss', 'bbbbbbbbbbbbbbbb'] },
  };

  // 每地区：4 个常见物 + 精英地标 + 终关地标
  var REGION_STAGES = {
    london:    { items: ['scone', 'teacup', 'bearskin', 'phonebox'], elite: 'bus', landmark: 'bigben',
                 titles: ['早餐铺', '下午茶', '卫兵广场', '红色街角', '钟楼之巅'] },
    nyc:       { items: ['hotdog', 'pizza', 'coffee', 'apple'], elite: 'taxi', landmark: 'liberty',
                 titles: ['街角餐车', '披萨店', '晨间咖啡', '第五大道', '自由岛'] },
    tokyo:     { items: ['onigiri', 'sushi', 'maneki', 'daruma'], elite: 'torii', landmark: 'fuji',
                 titles: ['便利店', '回转寿司', '招财小巷', '神社参道', '富士山麓'] },
    paris:     { items: ['croissant', 'macaron', 'baguette', 'beret'], elite: 'arc', landmark: 'eiffel',
                 titles: ['面包房', '甜品橱窗', '左岸早市', '凯旋大道', '铁塔广场'] },
    singapore: { items: ['kaya', 'crab', 'satay', 'durian'], elite: 'mbs', landmark: 'merlion',
                 titles: ['早餐档', '海鲜排档', '沙爹街', '水果摊', '鱼尾狮公园'] },
    istanbul:  { items: ['simit', 'lokum', 'doner', 'nazar', 'baklava'], elite: 'tulip', landmark: 'mosque',
                 titles: ['街边面包', '甜品铺', '烤肉巷', '大巴扎', '圣索菲亚'] },
    seoul:     { items: ['tteokbokki', 'kimbap', 'hotteok', 'soju', 'chicken'], elite: 'namsan', landmark: 'gyeongbok',
                 titles: ['夜市小摊', '紫菜饭屋', '糖饼巷口', '烧酒帐篷', '景福宫前'] },
    bangkok:   { items: ['padthai', 'tomyum', 'tuktuk', 'mango', 'elephant'], elite: 'longboat', landmark: 'watarun',
                 titles: ['路边炒锅', '冬阴汤摊', '嘟嘟车巷', '芒果果园', '郑王庙渡口'] },
    mexico:    { items: ['taco', 'churro', 'cactus', 'skull', 'maraca'], elite: 'sombrero', landmark: 'angel',
                 titles: ['塔可摊', '油条车', '仙人掌道', '亡灵节市集', '独立天使'] },
    cairo:     { items: ['falafel', 'koshari', 'dates', 'lamp', 'camel'], elite: 'sphinx', landmark: 'pyramid',
                 titles: ['豆丸摊', '库莎丽食堂', '椰枣铺', '神灯市集', '金字塔下'] },
    lisbon:    { items: ['custard', 'sardine', 'ginjinha'], elite: 'tram28', landmark: 'belem',
                 titles: ['蛋挞老店', '沙丁鱼摊', '小巷酒馆', '电车斜坡', '贝伦塔下'] },
    rome:      { items: ['gelato', 'espresso', 'panini'], elite: 'vespa', landmark: 'colosseum',
                 titles: ['冰淇淋车', '街角咖啡', '帕尼尼铺', '石板小巷', '斗兽场前'] },
    hongkong:  { items: ['pinebun', 'wonton', 'milktea'], elite: 'dingding', landmark: 'buddha',
                 titles: ['茶餐厅', '云吞面档', '奶茶铺', '叮叮车站', '大佛脚下'] },
    rio:       { items: ['acai', 'churrasco', 'coconut'], elite: 'football', landmark: 'christ',
                 titles: ['沙滩果摊', '烤肉架前', '椰子水车', '海滩球场', '基督像下'] },
    mumbai:    { items: ['samosa', 'naan', 'chai'], elite: 'rickshaw', landmark: 'gateway',
                 titles: ['咖喱角摊', '烤饼炉边', '奶茶小铺', '突突车流', '印度门前'] },
    moscow:    { items: ['borscht', 'blini', 'pelmeni'], elite: 'matryoshka', landmark: 'vassily',
                 titles: ['红菜汤馆', '薄饼摊', '饺子食堂', '套娃市集', '红场穹顶'] },
    sydney:    { items: ['meatpie', 'lamington', 'boomerang'], elite: 'kangaroo', landmark: 'opera',
                 titles: ['肉派小店', '甜品柜台', '海港草坪', '袋鼠旷野', '歌剧院前'] },
    barcelona: { items: ['paella', 'jamon', 'fan'], elite: 'guitar', landmark: 'sagrada',
                 titles: ['海鲜饭馆', '火腿铺', '兰布拉大道', '弗拉明戈', '圣家堂下'] },
    amsterdam: { items: ['stroopwafel', 'cheese', 'clog'], elite: 'bicycle', landmark: 'windmill',
                 titles: ['华夫饼摊', '奶酪市场', '木鞋作坊', '单车运河', '风车村'] },
    berlin:    { items: ['pretzel', 'currywurst', 'beer'], elite: 'ampelmann', landmark: 'brandenburg',
                 titles: ['面包房', '香肠小摊', '啤酒花园', '十字路口', '勃兰登堡门'] },
    athens:    { items: ['gyro', 'olive', 'owl'], elite: 'amphora', landmark: 'parthenon',
                 titles: ['卷饼摊', '橄榄园', '普拉卡老街', '陶器店', '卫城之巅'] },
    marrakech: { items: ['tagine', 'minttea', 'couscous'], elite: 'lantern', landmark: 'koutoubia',
                 titles: ['塔吉锅摊', '薄荷茶馆', '古斯米餐馆', '灯具集市', '宣礼塔下'] },
    hanoi:     { items: ['pho', 'banhmi', 'phin'], elite: 'nonla', landmark: 'turtletower',
                 titles: ['河粉小馆', '法包推车', '滴滤咖啡', '斗笠小巷', '还剑湖畔'] },
    beijing:   { items: ['duck', 'tanghulu', 'baozi'], elite: 'kite', landmark: 'templeofheaven',
                 titles: ['烤鸭老店', '糖葫芦摊', '包子铺', '风筝广场', '天坛祈年殿'] },
    toronto:   { items: ['pancake', 'poutine', 'donut'], elite: 'mapleleaf', landmark: 'cntower',
                 titles: ['早餐松饼', '薯条小馆', '甜甜圈店', '枫叶公园', '电视塔下'] },
    capetown:  { items: ['biltong', 'rooibos', 'protea'], elite: 'penguin', landmark: 'tablemountain',
                 titles: ['肉干铺', '红茶馆', '植物园', '企鹅海滩', '桌山之巅'] },
    buenosaires: { items: ['empanada', 'alfajor', 'mate'], elite: 'bandoneon', landmark: 'obelisco',
                 titles: ['馅饼小店', '甜饼铺', '马黛茶摊', '探戈街角', '七月九日大道'] },
    cusco:     { items: ['ceviche', 'corn', 'panflute'], elite: 'llama', landmark: 'machupicchu',
                 titles: ['海鲜小馆', '玉米市集', '排箫乐手', '羊驼山道', '云端古城'] },
    sanfrancisco: { items: ['sourdough', 'fortune', 'chowder'], elite: 'cablecar', landmark: 'goldengate',
                 titles: ['面包老店', '唐人街', '渔人码头', '叮当车坡道', '金门大桥'] },
    honolulu:  { items: ['poke', 'shaveice', 'pineapple'], elite: 'surfboard', landmark: 'diamondhead',
                 titles: ['波奇饭摊', '刨冰小店', '菠萝园', '冲浪海湾', '钻石头山'] },
  };

  // 第 i 关（0-4）的敌人配置：前 4 关首领是放大版常见物，终关是地标
  function theme(regionId, i) {
    var R = REGION_STAGES[regionId] || REGION_STAGES.london, it = R.items, n = it.length;
    return {
      title: R.titles[i] || ('第 ' + (i + 1) + ' 关'),
      drone: it[i % n],
      shooter: it[(i + 1) % n],
      elite: i >= 2 ? R.elite : it[(i + 2) % n],
      boss: i === 4 ? R.landmark : it[(i + 3) % n],
    };
  }

  // 这些物件在左 8 列里已经画完整，镜像会变成"一模一样的两个"；改为不镜像、裁出物件居中放大
  // （沙锤本来就是一对，保留镜像）
  ['wonton', 'vassily', 'tomyum', 'sombrero', 'skull', 'sardine', 'samosa', 'pinebun', 'pelmeni', 'panini',
   'namsan', 'naan', 'matryoshka', 'koshari', 'gyeongbok', 'ginjinha', 'gelato', 'gateway', 'football', 'falafel',
   'espresso', 'dingding', 'dates', 'custard', 'churro', 'christ', 'chai', 'cactus', 'buddha', 'borscht', 'blini',
   'acai', 'watarun', 'mango', 'angel', 'milktea'].forEach(function (id) { if (S[id]) S[id].solo = 1; });

  var REGION_NAMES = {
    london: '伦敦', nyc: '纽约', tokyo: '东京', paris: '巴黎', singapore: '新加坡',
    istanbul: '伊斯坦布尔', seoul: '首尔', bangkok: '曼谷', mexico: '墨西哥城', cairo: '开罗',
    lisbon: '里斯本', rome: '罗马', hongkong: '香港', rio: '里约热内卢', mumbai: '孟买',
    moscow: '莫斯科', sydney: '悉尼', barcelona: '巴塞罗那', amsterdam: '阿姆斯特丹',
    berlin: '柏林', athens: '雅典', marrakech: '马拉喀什', hanoi: '河内', beijing: '北京',
    toronto: '多伦多', capetown: '开普敦', buenosaires: '布宜诺斯艾利斯', cusco: '库斯科',
    sanfrancisco: '旧金山', honolulu: '檀香山'
  };
  var LORE = {
    scone: '司康源自苏格兰，最早用燕麦在铁板上烘烤；19 世纪泡打粉普及后才变成今天蓬松的样子，并成为英式下午茶的代表点心。',
    teacup: '英国饮茶风气始于 17 世纪，下午茶则由 19 世纪公爵夫人安娜推广。精致杯碟从此成为英国社交与茶室文化的象征。',
    bearskin: '皇家卫兵的熊皮帽在滑铁卢战役后沿用，高约 46 厘米、重近 0.7 公斤。鲜红军装与高帽是白金汉宫换岗仪式的标志。',
    phonebox: '红色电话亭 K6 由建筑师斯科特于 1935 年设计，用于纪念乔治五世加冕。移动通信普及后，它仍被保留为伦敦街头符号。',
    bus: '伦敦双层巴士的前身可追溯到 19 世纪马车巴士，1956 年的 Routemaster 让红色双层车成为城市名片。',
    bigben: '大本钟严格来说是伊丽莎白塔内的大钟，1859 年开始报时。塔高约 96 米，钟声是伦敦政治与城市生活的象征。',

    hotdog: '热狗源自 19 世纪德国移民带来的法兰克福香肠，后来在纽约康尼岛一带与长面包结合，成为美国街头快餐的代表。',
    pizza: '纽约披萨由 20 世纪初那不勒斯移民带来，1905 年开业的 Lombardi 披萨店常被视为起点。薄而大的切片可以折叠着吃。',
    coffee: '纽约的咖啡文化由移民、通宵餐馆和街角餐车共同塑造。纸杯咖啡既是通勤燃料，也是这座快节奏城市的日常风景。',
    apple: '纽约的“大苹果”绰号源自 1920 年代赛马记者的比喻，1970 年代城市推广后广为人知，代表这座城市的欲望与机会。',
    taxi: '纽约黄色出租车始于 20 世纪初的计程车行业，1915 年前后黄色涂装被采用，如今成为曼哈顿街景中最醒目的颜色之一。',
    liberty: '自由女神像是法国 1886 年赠予美国的礼物，由巴托尔迪设计。铜制外壳经海风氧化后变成绿色，象征自由与移民之门。',

    onigiri: '饭团在弥生时代已有雏形，江户时代海苔包裹的便携饭团随城市生活普及。如今是便利店与便当里最常见的日本主食。',
    sushi: '江户前寿司诞生于 19 世纪东京街头的屋台，用醋饭配上新鲜鱼料现做现吃。它从快餐发展成日本料理的代表。',
    maneki: '招财猫起源于江户末期的日本，常见说法与今户烧或豪德寺的猫传说有关。举起前爪的姿势被认为能招来客人或财运。',
    daruma: '达摩不倒翁以禅宗祖师菩提达摩为原型，圆形象征不倒。人们许愿时先涂一只眼，愿望实现后再补上另一只。',
    torii: '鸟居是神道中划分世俗与神圣空间的门。稻荷神社的千本鸟居最为著名，每一座常由还愿者捐献。',
    fuji: '富士山海拔 3776 米，是日本最高峰，2013 年列入世界遗产。它长期出现在浮世绘与诗歌中，被视为日本的象征。',

    croissant: '可颂的前身是奥地利的月牙形面包 kipferl，19 世纪传入法国后改用黄油千层面团，成为巴黎面包房的经典。',
    macaron: '马卡龙最早可追溯到意大利，后来在法国发展为两片杏仁蛋白饼夹馅的甜点。巴黎 Ladurée 在 20 世纪初让它广为人知。',
    baguette: '法棍是 19 世纪巴黎城市化中形成的长条面包，外脆内软。2022 年，法棍的制作工艺被列入联合国非遗名录。',
    beret: '贝雷帽源自巴斯克牧羊人的羊毛帽，19 世纪被法国军队采用，后来成为画家、艺术家和法国文化的一种符号。',
    arc: '凯旋门由拿破仑于 1806 年下令建造，1836 年完工，高约 50 米。它位于戴高乐广场，是法国国家纪念与阅兵的重要场所。',
    eiffel: '埃菲尔铁塔为 1889 年巴黎世博会而建，高约 324 米。它最初被许多艺术家批评为丑陋，如今却是巴黎最著名的地标。',

    kaya: '咖椰吐司由海南移民带到新加坡，咖椰酱用椰浆、香兰叶和糖熬成，常配半熟蛋与咖啡，是当地早餐文化的代表。',
    crab: '辣椒螃蟹诞生于 1950 年代的新加坡摊位，用番茄、辣椒和蛋花勾出浓稠酱汁。它后来被视为新加坡的国民海鲜菜。',
    satay: '沙爹是马来与印尼传统的烤肉串，腌肉用炭火烤香，蘸花生酱食用。夜市摊贩让它在东南亚各地流行。',
    durian: '榴莲原产东南亚，因浓烈气味被称为“果王”。猫山王等品种在马来西亚和新加坡尤其受追捧。',
    mbs: '滨海湾金沙于 2010 年开业，由三座塔楼和顶部空中花园组成。它改变了新加坡天际线，也是城市旅游的标志。',
    merlion: '鱼尾狮是 1964 年由新加坡旅游局采用的标志，狮头象征“狮城”，鱼身呼应渔村起源。如今鱼尾狮公园是必到景点。',

    simit: '芝麻圈是奥斯曼帝国时期流传下来的街头面食，外裹芝麻、内里紧实。伊斯坦布尔的清晨常能见到小贩推车售卖。',
    lokum: '土耳其软糖在 18 世纪奥斯曼宫廷流行，据传由糖果师 Haci Bekir 改良。它用糖、淀粉和坚果制成，口感柔软有弹性。',
    doner: '旋转烤肉源于 19 世纪奥斯曼帝国的垂直烤肉法，后来在柏林等地演变为卷饼快餐。它是土耳其饮食全球化的代表。',
    nazar: '恶魔之眼是地中海与中东常见的蓝眼护身符，人们相信它能挡开嫉妒带来的邪气。它常被挂在门口或随身佩戴。',
    tulip: '郁金香原产中亚，奥斯曼帝国时期在伊斯坦布尔广泛栽培。16 世纪传入荷兰后引发著名的郁金香狂热。',
    mosque: '圣索菲亚大教堂建于公元 537 年查士丁尼时期，曾是世界最大教堂，后被改为清真寺、博物馆，2020 年再次成为清真寺。',
    baklava: '果仁蜜饼是奥斯曼宫廷甜点，用极薄的酥皮层层叠起，夹入坚果并淋上糖浆。土耳其加济安泰普的版本尤其有名。',

    tteokbokki: '炒年糕源自朝鲜王朝的宫廷与民间米糕料理，现代辣酱版本在 20 世纪街头流行，是韩国最典型的国民小吃。',
    kimbap: '紫菜包饭受日本海苔卷影响，在 20 世纪初的朝鲜半岛发展出米饭、蔬菜和肉类的组合，常作为便当或野餐食物。',
    hotteok: '糖饼是 19 世纪末传入朝鲜半岛的煎饼，面团里包红糖和坚果，煎到外脆内流心，是冬季街头的温暖记忆。',
    soju: '烧酒最早是高丽时期的蒸馏酒，现代稀释式烧酒在 20 世纪普及。它酒精度较低，是韩国聚餐文化的重要角色。',
    chicken: '韩式炸鸡在 1960 年代随连锁炸鸡店兴起，后来与啤酒组成“炸鸡啤酒”搭配，成为韩国夜宵文化的代表。',
    namsan: '南山塔于 1969 年动工、1975 年开放，坐落在首尔南山。它是首尔的地标，也是情侣挂锁和俯瞰城市夜景的名所。',
    gyeongbok: '景福宫建于 1395 年，是朝鲜王朝的正宫。宫名取自《诗经》，寓意国家安定、福气长存。',

    padthai: '泰式炒面在 1930 年代由泰国政府推动，作为国民料理推广。它用米粉、罗望子、鱼露和花生炒成，酸甜咸香。',
    tomyum: '冬阴功是泰国中部的酸辣汤，用香茅、南姜、柠檬叶和辣椒调味，常加虾或蘑菇。它已成为泰国菜的代表味道。',
    tuktuk: '嘟嘟车源自日本的三轮车设计，二战后在泰国被改装成机动三轮出租车。它因引擎声和开放车厢成为曼谷街景。',
    mango: '芒果糯米饭是泰国传统甜点，用椰浆浸泡的糯米配熟芒果，甜咸交织。芒果季时是街头和餐厅的常见选择。',
    elephant: '大象是泰国国兽，在泰国历史中象征王权与力量。白象尤其被视为吉祥，曾出现在国旗上。',
    longboat: '长尾船是湄南河与运河上的传统小船，后来多改装汽车引擎，速度快、船身窄，是曼谷水上交通的象征。',
    watarun: '郑王庙又称黎明寺，位于曼谷湄南河西岸。中央塔高约 79 米，塔身镶满彩色瓷片，是泰国最著名的寺庙之一。',

    taco: '塔可是墨西哥传统食物，用玉米饼包裹肉、豆类和莎莎酱。它的历史可追溯到前哥伦布时期，如今是墨西哥饮食的代表。',
    churro: '吉事果源自西班牙与葡萄牙，面团挤成星形后油炸，撒糖和肉桂。它常配热巧克力，在拉丁美洲也很流行。',
    cactus: '仙人掌是墨西哥的象征之一，国徽上就有仙人掌与鹰的图案。仙人掌的果实和嫩茎在当地饮食中也有使用。',
    skull: '糖骷髅是墨西哥亡灵节的传统装饰，用糖或巧克力制成。节日期间人们用它纪念逝者，表达对死亡的幽默与亲近。',
    maraca: '沙锤是中南美洲原住民的打击乐器，用葫芦或木壳装种子摇晃发声。它常出现在节庆和传统音乐中。',
    sombrero: '大草帽是墨西哥农民与节庆服饰的一部分，宽帽檐用来遮阳。它在游客印象中常被当作墨西哥文化的符号。',
    angel: '独立天使是墨西哥城独立纪念碑顶端的金色雕像，1910 年为纪念独立百年而建，是城市庆典与游行的重要地标。',

    falafel: '炸豆丸是中东常见的素食炸丸子，埃及多用蚕豆，黎凡特地区多用鹰嘴豆。它常配皮塔饼和蔬菜食用。',
    koshari: '库莎丽是埃及国民街头食物，由米饭、扁豆、意面和鹰嘴豆混合，浇上番茄酱和炸洋葱，源自多元饮食的交汇。',
    dates: '椰枣是中东和北非的重要食物，富含糖分，常用来在斋月开斋。它也是沙漠商旅中的耐储存干粮。',
    lamp: '神灯来自《一千零一夜》中阿拉丁的故事，擦亮后能召唤精灵实现愿望。它已成为中东奇幻想象的代表物。',
    camel: '骆驼被称为“沙漠之舟”，能在缺水环境中长途行走。它在阿拉伯半岛的贸易与游牧文化中至关重要。',
    sphinx: '狮身人面像位于吉萨金字塔群旁，通常被认为代表法老哈夫拉，约建于公元前 2500 年。它见证了古埃及的兴衰。',
    pyramid: '吉萨金字塔群约建于公元前 2600 年，胡夫金字塔是其中最大的一座。它们曾是古代世界七大奇迹中唯一留存至今的。',

    custard: '葡式蛋挞源自里斯本贝伦修道院，18 世纪修女用蛋白制作甜点，1837 年贝伦蛋挞店开业后闻名世界。',
    sardine: '沙丁鱼罐头是葡萄牙渔业与工业化的产物，19 世纪起大量出口。它便于保存，也成为葡萄牙餐桌上的日常食物。',
    ginjinha: '樱桃酒是葡萄牙的传统利口酒，用酸樱桃浸泡而成，常装在小杯里一口喝下，里斯本老城酒吧尤其常见。',
    tram28: '28 路电车是里斯本最著名的黄色老电车，线路穿过老城与山丘。它保留着 20 世纪的木制车厢，是城市交通与旅游符号。',
    belem: '贝伦塔建于 1519 年，位于里斯本贝伦区，是大航海时代的重要防御工事。它后来成为葡萄牙海上扩张的象征。',

    gelato: '意式冰淇淋比普通冰淇淋空气含量更低、口感更密实。它的现代做法可追溯到 16 世纪意大利，后传播到欧洲各地。',
    espresso: '浓缩咖啡诞生于 20 世纪初的意大利，用高压热水快速萃取。它分量小、味道浓，是意大利人日常咖啡文化的基础。',
    panini: '帕尼尼是意大利语中的三明治，通常用恰巴塔或法棍夹奶酪、火腿和蔬菜后加热压烤，是米兰等城市的快餐。',
    vespa: 'Vespa 小摩托由 Piaggio 公司于 1946 年推出，战后意大利需要廉价交通工具，它的曲线车身成为意式设计经典。',
    colosseum: '罗马斗兽场建于公元 1 世纪，公元 80 年落成，可容纳数万观众。它用于角斗和公共表演，是古罗马工程的代表。',

    pinebun: '菠萝包是香港 20 世纪中期出现的甜面包，因表面酥皮格纹像菠萝而得名，常夹黄油成为“菠萝油”。',
    wonton: '云吞面源自广东，20 世纪在香港发展为街头面食。细面配鲜虾云吞和清汤，是香港茶餐厅与面店的经典。',
    milktea: '丝袜奶茶是香港茶餐厅的代表饮品，用多种红茶拼配，以棉布茶袋反复拉茶，口感浓滑，因茶袋颜色像丝袜得名。',
    dingding: '叮叮车是香港双层电车，1904 年开始运行。它因提示铃声得名，是香港岛最便宜的交通工具之一，也保留着老香港记忆。',
    buddha: '天坛大佛位于香港大屿山宝莲禅寺，1993 年开光。佛像高约 34 米，坐于莲花座上，是香港重要的佛教地标。',

    acai: '巴西莓原产亚马逊雨林，当地原住民长期食用。它富含花青素，后来被做成冰沙碗，成为健康饮食的代表。',
    churrasco: '巴西烤肉源自南美高乔牧人，用长签串肉在炭火上慢烤，席间由侍者轮番切肉，是巴西烤肉店的核心体验。',
    coconut: '椰子原产热带海岸，果肉和椰汁可食用，椰壳可做容器。它在巴西、东南亚和太平洋岛屿的饮食中都很常见。',
    football: '足球是巴西最流行的运动，巴西国家队多次夺得世界杯。街头足球与沙滩足球也深深融入当地文化。',
    christ: '基督像位于里约热内卢科尔科瓦多山顶，1931 年落成，高约 30 米，张开的双臂俯瞰城市，是巴西最著名的地标。',

    samosa: '咖喱角源自中东和中亚，后来传入印度，成为常见的油炸点心。它通常包土豆、豌豆和香料，配酸辣酱食用。',
    naan: '印度烤饼是一种发酵面饼，传统上贴在馕坑内壁烤制，外皮微焦、内部柔软，常配咖喱或烤肉。',
    chai: '印度奶茶把红茶与牛奶、糖和香料一起煮，常见香料有豆蔻、姜和肉桂。它在南亚街头和小摊上无处不在。',
    rickshaw: '三轮车是南亚城市常见的短途交通工具，最早由人力拉动，后来发展为机动三轮。孟买的黄色出租车与三轮车都是城市符号。',
    gateway: '印度门位于孟买海滨，1924 年落成，用于纪念乔治五世访印。它面朝阿拉伯海，是孟买最著名的地标之一。',

    borscht: '罗宋汤源自东欧，以甜菜根为主料，因此呈紫红色。它在乌克兰、俄罗斯和波兰都有不同版本，常配酸奶油。',
    blini: '布林薄饼是斯拉夫传统食物，用发酵面糊煎成薄饼，常配鱼子酱、酸奶油或黄油。谢肉节期间尤其常见。',
    pelmeni: '俄式饺子源自乌拉尔地区，可能受西伯利亚与中亚饮食影响。它个头小、皮薄，常冷冻保存后水煮，配黄油或酸奶油。',
    matryoshka: '套娃于 1890 年代在俄罗斯出现，灵感来自日本嵌套人偶。它由多个大小递减的木娃娃组成，成为俄罗斯民间工艺代表。',
    vassily: '圣瓦西里大教堂建于 1555 至 1561 年，由伊凡雷帝下令修建。彩色洋葱顶让它成为莫斯科红场最醒目的地标。',

    meatpie: '澳式肉派源自英国移民的烘焙传统，用酥皮包肉馅，是澳大利亚常见的快餐和体育比赛食品。',
    lamington: '拉明顿蛋糕是澳大利亚传统甜点，方形海绵蛋糕裹巧克力酱再滚椰蓉。它的名字据说来自昆士兰州总督拉明顿。',
    boomerang: '回旋镖是澳大利亚原住民的传统工具，用于狩猎，部分设计能返回投掷者。它也是原住民文化的重要象征。',
    kangaroo: '袋鼠是澳大利亚特有有袋类动物，成年袋鼠靠强健后腿跳跃前进。它是澳大利亚国徽上的动物之一。',
    opera: '悉尼歌剧院由丹麦建筑师伍重设计，1973 年落成。它的贝壳形屋顶成为悉尼港的地标，2007 年列入世界遗产。',

    paella: '西班牙海鲜饭源自瓦伦西亚，最初是农田工人用大锅煮米饭、鸡肉和豆类。藏红花赋予它金黄色和独特香气。',
    jamon: '西班牙火腿用伊比利亚或白猪后腿盐渍风干制成，切片后配面包或蜜瓜食用。伊比利亚火腿因橡果饲养而格外珍贵。',
    fan: '折扇在西班牙被弗拉门戈舞者广泛使用，开合动作配合舞步表达情绪。它也是西班牙传统服饰的一部分。',
    guitar: '吉他的前身可追溯到中世纪欧洲的弦乐器，西班牙在 19 世纪发展出古典吉他。它是弗拉门戈音乐的核心乐器。',
    sagrada: '圣家堂由高迪设计，1882 年开始修建，至今仍未完全完工。它的尖塔与自然主义造型使它成为巴塞罗那的象征。',

    stroopwafel: '焦糖华夫饼诞生于 19 世纪的荷兰豪达，两片薄华夫夹焦糖糖浆。传统吃法是放在热饮杯口上，让焦糖变软。',
    cheese: '荷兰奶酪以豪达和艾登最为著名，早在中世纪就通过市集交易。圆盘形奶酪和奶酪市场是荷兰乡村文化的代表。',
    clog: '木鞋是荷兰传统鞋履，用整块木头挖空制成，过去农民和渔民在潮湿泥地中穿着。如今多作为纪念品和民俗符号。',
    bicycle: '自行车是阿姆斯特丹最主要的交通工具之一，城市拥有密集的自行车道。平地和短距离让骑车成为日常生活方式。',
    windmill: '风车在荷兰历史上用于排水、磨面和锯木，帮助围海造陆。小孩堤防的风车群是世界遗产。',

    pretzel: '椒盐卷饼源自德国巴伐利亚，面团扭成结后浸碱水烘烤，形成深色外皮和独特香气。它常配啤酒或黄油。',
    currywurst: '咖喱香肠据传由柏林人 Herta Heuwer 于 1949 年发明，把香肠切段淋上咖喱番茄酱，是德国街头最受欢迎的小吃之一。',
    beer: '德国啤酒文化深厚，1516 年的《啤酒纯净法》规定只能使用水、麦芽、啤酒花和酵母。啤酒花园是德国社交生活的一部分。',
    ampelmann: '红绿灯小人是东德 1961 年设计的行人信号灯形象，戴帽子的小人比普通信号灯更生动。两德统一后它被保留并成为怀旧符号。',
    brandenburg: '勃兰登堡门建于 1791 年，是柏林仅存的城门。它曾分隔东西柏林，如今象征德国统一与和平。',

    gyro: '希腊卷饼用皮塔饼夹烤肉、番茄、洋葱和酸奶黄瓜酱，是希腊街头最常见的快餐之一。',
    olive: '橄榄是地中海饮食的核心，古希腊人已开始栽培。橄榄油用于烹饪、照明和宗教仪式，雅典娜的神话也与橄榄树有关。',
    owl: '猫头鹰在古希腊是智慧女神雅典娜的圣鸟，因此成为智慧与学问的象征。雅典的银币上也曾铸有猫头鹰图案。',
    amphora: '双耳陶罐是古希腊常见的储物和运输容器，用于装酒、油和谷物。它的形状和比例后来影响了欧洲陶器设计。',
    parthenon: '帕特农神庙建于公元前 447 年，供奉雅典娜，位于雅典卫城。它被视为古希腊建筑与民主时代的象征。',

    tagine: '塔吉锅是摩洛哥传统的锥形陶锅，蒸汽在锥顶凝结后回流，适合慢炖肉类和蔬菜。锅名也指用这种方式烹制的菜。',
    minttea: '薄荷茶是摩洛哥待客的必备饮品，用绿茶、新鲜薄荷和大量糖冲泡。倒茶时高举茶壶形成泡沫，是待客礼仪的一部分。',
    couscous: '古斯米是北非柏柏尔人的传统主食，由粗麦粉搓成小颗粒后蒸熟。它常配炖肉和蔬菜，是马格里布地区的日常食物。',
    lantern: '摩洛哥灯笼用金属镂空和彩色玻璃制成，光线透过花纹投下图案。它常见于集市、庭院和节庆装饰。',
    koutoubia: '库图比亚清真寺建于 12 世纪，位于马拉喀什，其方形宣礼塔高约 77 米。它是摩洛哥阿尔摩哈德王朝建筑的代表。',

    pho: '越南河粉在 20 世纪初的河内出现，可能受法国饮食和中国米粉影响。牛骨汤配米粉、香草和薄切牛肉，是越南国菜。',
    banhmi: '越南法包结合了法国殖民时期的面包与越南本地食材，夹肉、腌菜、香菜和辣椒。它如今是世界知名的街头三明治。',
    phin: '越南滴滤咖啡用金属滤杯慢慢滴入炼乳，形成浓烈的咖啡与甜奶组合。它体现了法国咖啡传统与越南口味的融合。',
    nonla: '越南斗笠用竹篾和棕榈叶制成，遮阳挡雨，过去在农业和船运中广泛使用。它也是越南女性传统服饰的搭配。',
    turtletower: '龟塔位于河内还剑湖中的小岛上，传说黎利王在此归还神剑。塔身虽小，却是河内最著名的城市象征之一。',

    duck: '北京烤鸭的历史可追溯到元明时期，全聚德 1864 年开业后形成挂炉烤鸭流派。鸭皮酥脆，通常配薄饼、葱丝和甜面酱。',
    tanghulu: '糖葫芦是北京冬季街头小吃，用山楂串起裹上麦芽糖，冷却后形成脆壳。酸甜口感让它成为几代人的童年记忆。',
    baozi: '包子是中式蒸制面食，传说三国时期诸葛亮南征时用面团包肉代替人头祭祀。如今有肉、菜、豆沙等丰富馅料。',
    kite: '风筝在中国已有两千多年历史，最早用于军事通信。北京和潍坊的风筝工艺尤其有名，春季放风筝是传统习俗。',
    templeofheaven: '天坛建于 1420 年，是明清皇帝祭天祈谷的场所。祈年殿的圆形三重檐结构象征天圆地方，1998 年列入世界遗产。',

    pancake: '枫糖松饼是北美早餐的代表，松饼淋上加拿大枫糖浆。枫糖采集自糖枫树汁，是原住民早已使用的天然甜味。',
    poutine: '肉汁奶酪薯条诞生于 1950 年代的魁北克，由炸薯条、奶酪凝块和肉汁组成。它从地方小吃变成加拿大国民食物。',
    donut: '甜甜圈在北美发展为环形油炸点心，Tim Hortons 于 1964 年在加拿大创立，让咖啡配甜甜圈成为日常组合。',
    mapleleaf: '枫叶是加拿大的国家象征，国旗中央就是一片红色枫叶。枫树在加拿大东部广泛分布，枫糖产业也与国家历史紧密相连。',
    cntower: '加拿大国家电视塔位于多伦多，1976 年建成，高约 553 米。它曾是世界最高独立建筑，观景台可俯瞰安大略湖。',

    biltong: '南非肉干是荷兰移民带来的腌制风干肉传统，用醋、盐和香料处理牛肉或野味。它比一般肉干更厚，是南非常见的零食。',
    rooibos: '南非博士茶用当地红灌木的针叶冲泡，天然不含咖啡因。它原产于西开普省，是南非最具代表性的草本茶。',
    protea: '帝王花是南非国花，属于山龙眼科，花型巨大、色彩丰富。它适应野火后的环境，是南非凡波斯植被的象征。',
    penguin: '企鹅是南半球海鸟，南非开普敦附近的博尔德斯海滩有非洲企鹅栖息。它们用翅膀游泳，繁殖期在陆地筑巢。',
    tablemountain: '桌山位于开普敦，因山顶平坦如桌而得名。它是南非最著名的自然地标，缆车和徒步路线都能到达山顶。',

    empanada: '阿根廷馅饼源自西班牙 empanada，移民带到南美后发展出牛肉、鸡肉、奶酪等馅料。它是阿根廷家庭聚会和节庆的常见食物。',
    alfajor: '阿法乔饼源自西班牙和阿拉伯的甜点传统，在阿根廷演变为两片饼干夹焦糖牛奶酱、外裹巧克力或糖粉。',
    mate: '马黛茶是南美南部地区流行的草本饮品，用巴拉圭冬青叶冲泡，通过金属吸管共享。它象征友谊与待客之道。',
    bandoneon: '班多钮手风琴由德国发明，19 世纪传入阿根廷后成为探戈音乐的核心乐器。它的音色深沉，适合表达探戈的忧郁。',
    obelisco: '方尖碑位于布宜诺斯艾利斯七月九日大道，1936 年为纪念建城 400 周年而建。它是阿根廷首都最醒目的城市标志。',

    ceviche: '秘鲁酸橘汁腌鱼用新鲜海鱼配青柠汁、洋葱和辣椒腌制，靠酸味使鱼肉“熟化”。它是秘鲁国菜，沿海地区尤其盛行。',
    corn: '玉米是安第斯文明的主食，印加人培育出多种颜色和形态的玉米。它至今仍是秘鲁和拉美饮食的基础。',
    panflute: '排箫是安第斯地区的传统吹奏乐器，用不同长度的竹管排列而成。它在印加音乐和南美民谣中广泛使用。',
    llama: '羊驼是安第斯地区驯化的骆驼科动物，用于驮运和毛料。它们适应高海拔环境，是印加道路系统的重要伙伴。',
    machupicchu: '马丘比丘建于 15 世纪印加帝国时期，位于秘鲁安第斯山脊。它因西班牙征服后被遗弃而保存较好，1983 年列入世界遗产。',

    sourdough: '酸面包用天然酵母发酵，是旧金山淘金热时期矿工的主要食物。它外皮硬脆、内部微酸，成为旧金山的饮食符号。',
    fortune: '幸运饼干据信源自日本，后来在加州由亚洲移民推广。饼干里藏纸条，餐后拆开读运势，成为美式中餐的固定仪式。',
    chowder: '蛤蜊浓汤是美式海鲜汤，常见新英格兰奶油版和曼哈顿番茄版。旧金山常用酸面包挖空作碗，形成独特吃法。',
    cablecar: '旧金山叮当车于 1873 年启用，是世界最后保留人工操作的有轨缆车系统之一。它依靠地下缆绳运行，适应陡峭街道。',
    goldengate: '金门大桥于 1937 年通车，横跨金门海峡，主跨约 1280 米。它的国际橘色涂装让大桥在雾中依然醒目。',

    poke: '波奇饭源自夏威夷，原为渔民把生鱼切块配海盐和海藻食用。现代版本加入米饭、蔬菜和酱汁，成为健康轻食。',
    shaveice: '彩虹刨冰是夏威夷特色甜品，把细刨冰淋上彩色糖浆，常加冰淇淋或红豆。炎热气候和多元移民文化造就了它。',
    pineapple: '菠萝原产南美，19 世纪传入夏威夷后成为重要产业。都乐公司在夏威夷推广种植，菠萝也成为当地旅游符号。',
    surfboard: '冲浪板是夏威夷原住民文化的一部分，早期用整块木板制成。冲浪不仅是运动，也承载着夏威夷的海洋信仰。',
    diamondhead: '钻石头山位于夏威夷欧胡岛，是一座火山口边缘形成的山丘。19 世纪英国水手误把方解石当钻石，因而得名。',
  };

  var cache = {};
  function canvasOf(id, white) {
    var key = id + (white ? '#w' : '');
    if (cache[key]) return cache[key];
    var sp = S[id];
    if (!sp) return null;
    var rows = sp.px.map(function (r) {
      return r.length === 8 && !sp.solo ? r + r.split('').reverse().join('') : r;
    });
    var x0 = 0, y0 = 0, N = 16, ox = 0, oy = 0;
    if (sp.solo || sp.sym) {
      var minX = 99, maxX = -1, minY = 99, maxY = -1;
      rows.forEach(function (r, yy) {
        for (var xx = 0; xx < r.length; xx++) if (r.charAt(xx) !== '.') {
          if (xx < minX) minX = xx; if (xx > maxX) maxX = xx;
          if (yy < minY) minY = yy; if (yy > maxY) maxY = yy;
        }
      });
      var bw = maxX - minX + 1, bh = maxY - minY + 1;
      N = Math.max(bw, bh) + 1;
      x0 = minX; y0 = minY; ox = Math.floor((N - bw) / 2); oy = Math.floor((N - bh) / 2);
    }
    var c = document.createElement('canvas');
    c.width = N; c.height = N;
    var g = c.getContext('2d');
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y] || '';
      for (var x = 0; x < row.length; x++) {
        var ch = row.charAt(x);
        if (!ch || ch === '.') continue;
        g.fillStyle = white ? '#ffffff' : (sp.pal[ch] || BASE[ch] || '#ff00ff');
        g.fillRect(x - x0 + ox, y - y0 + oy, 1, 1);
      }
    }
    cache[key] = c;
    return c;
  }
  function draw(ctx, id, x, y, size, white) {
    var c = canvasOf(id, white);
    if (!c) return;
    var smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    ctx.imageSmoothingEnabled = smooth;
  }

  global.StageArt = {
    SPRITES: S, REGIONS: REGION_STAGES, theme: theme,
    canvas: canvasOf, draw: draw,
    info: function (id) {
      var s = S[id];
      if (!s) return { en: '', cn: '', desc: '' };
      var region = '';
      Object.keys(REGION_STAGES).some(function (rid) {
        var r = REGION_STAGES[rid];
        if (r.items.indexOf(id) >= 0 || r.elite === id || r.landmark === id) {
          region = REGION_NAMES[rid] || rid;
          return true;
        }
        return false;
      });
      return {
        en: s.en,
        cn: s.cn,
        desc: LORE[id] || ('在' + region + '的漫游记录中，' + s.cn + '是当地饮食、日常或城市景观的一部分。它既是辨认这座城市的线索，也承载着当地人的生活记忆。')
      };
    },
  };
})(window);
