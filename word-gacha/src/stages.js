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
    scone: '司康是英国茶点文化的代表，通常在下午茶时切开，搭配凝脂奶油与果酱。它起源于英国和苏格兰的烘焙传统，如今仍是伦敦早餐铺与茶室里最有辨识度的点心之一。',
    teacup: '茶杯记录着英国饮茶文化的日常尺度。随着近代茶叶贸易与下午茶风尚兴起，带有精致杯碟的饮茶仪式逐渐成为英国社交生活的一部分。',
    bearskin: '皇家卫兵头戴的熊皮帽来自英国王室卫队的礼仪传统。鲜红军装与高耸黑帽如今已成为白金汉宫卫兵换岗和伦敦城市记忆的重要符号。',
    phonebox: '红色电话亭是英国工业设计的经典意象，源自 20 世纪初的公共通信设施。即使移动通信普及后，它仍作为街头标志被保留下来。',
    bus: '双层巴士是伦敦公共交通最醒目的城市名片之一。红色车身与上下两层的结构，见证了伦敦从马车时代走向现代城市交通的过程。',
    bigben: '大本钟严格来说是伊丽莎白塔内的大钟，1859 年开始报时。它坐落在威斯敏斯特宫旁，钟声与塔楼轮廓共同构成了伦敦的政治和城市象征。'
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
