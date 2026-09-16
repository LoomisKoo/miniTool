/* 音译专用字表
 *
 * 和 chars.js 分开的原因：
 *   chars.js 是「取名用字」——每个字都能独立表意，讲究意象与品格；
 *   这里是「音译用字」——主要为读音存在（玛 / 蒂 / 尼 / 丝），意义中性甚至空洞。
 * 混在一起会污染自动拼装的名字质量（拼出「李尼蒂」这种东西），所以两套池子分开，
 * 只由「外文名转中文名」这一个玩法使用。
 *
 * 但音译字仍然会进字库索引，所以读感校验、谐音黑名单对它们一样生效。
 * 第 4 位是意象域：同音字之间靠它区分气质，否则一堆同音字无法排序（只能返回随机结果）。
 *   参考域 → 观感：quiet 柔静 / wood 温润 / bright 明快 / mind 端方 / gift 精致 / com 中性
 */
var NM = (window.NM = window.NM || {});

NM.PHON_CHARS = [
  /* 柔静（女名音译首选） */
  ['艾', 'ai', 4, 'quiet'], ['妮', 'ni', 1, 'quiet'], ['娜', 'na', 4, 'quiet'],
  ['丽', 'li', 4, 'quiet'], ['莉', 'li', 4, 'quiet'], ['蕾', 'lei', 3, 'quiet'],
  ['薇', 'wei', 1, 'quiet'], ['茜', 'qian', 4, 'quiet'], ['黛', 'dai', 4, 'quiet'],
  ['丝', 'si', 1, 'quiet'], ['蒂', 'di', 4, 'quiet'], ['蜜', 'mi', 4, 'quiet'],
  ['依', 'yi', 1, 'quiet'], ['露', 'lu', 4, 'quiet'], ['娅', 'ya', 4, 'quiet'],
  ['茜', 'xi', 1, 'quiet'], ['诺', 'nuo', 4, 'quiet'], ['舍', 'she', 4, 'quiet'],

  /* 草木温润 */
  ['梅', 'mei', 2, 'wood'], ['兰', 'lan', 2, 'wood'], ['莲', 'lian', 2, 'wood'],
  ['琳', 'lin', 2, 'wood'], ['莎', 'sha', 1, 'wood'], ['芙', 'fu', 2, 'wood'],
  ['菲', 'fei', 1, 'wood'], ['翡', 'fei', 3, 'wood'], ['芬', 'fen', 1, 'wood'],
  ['蓓', 'bei', 4, 'wood'], ['芙', 'fu', 2, 'wood'], ['梅', 'mei', 2, 'wood'],
  ['桑', 'sang', 1, 'wood'], ['榭', 'xie', 4, 'wood'], ['莱', 'lai', 2, 'wood'],

  /* 明快有力 */
  ['泰', 'tai', 4, 'bright'], ['特', 'te', 4, 'bright'], ['达', 'da', 2, 'bright'],
  ['卡', 'ka', 3, 'bright'], ['凯', 'kai', 3, 'bright'], ['索', 'suo', 3, 'bright'],
  ['塔', 'ta', 3, 'bright'], ['万', 'wan', 4, 'bright'], ['威', 'wei', 1, 'bright'],
  ['维', 'wei', 2, 'bright'], ['斯', 'si', 1, 'bright'], ['汉', 'han', 4, 'bright'],
  ['华', 'hua', 2, 'bright'], ['霍', 'huo', 4, 'bright'], ['杰', 'jie', 2, 'bright'],
  ['加', 'jia', 1, 'bright'], ['夏', 'xia', 4, 'bright'], ['扬', 'yang', 2, 'bright'],
  ['朗', 'lang', 3, 'bright'], ['奥', 'ao', 4, 'bright'], ['赛', 'sai', 4, 'bright'],
  ['萨', 'sa', 4, 'bright'], ['佐', 'zuo', 3, 'bright'], ['邦', 'bang', 1, 'bright'],

  /* 端方稳重 */
  ['恩', 'en', 1, 'mind'], ['德', 'de', 2, 'mind'], ['康', 'kang', 1, 'mind'],
  ['圣', 'sheng', 4, 'mind'], ['尚', 'shang', 4, 'mind'], ['伯', 'bo', 2, 'mind'],
  ['史', 'shi', 3, 'mind'], ['士', 'shi', 4, 'mind'], ['佐', 'zuo', 3, 'mind'],

  /* 精致（玉器珍宝） */
  ['琳', 'lin', 2, 'gift'], ['琪', 'qi', 2, 'gift'], ['琦', 'qi', 2, 'gift'],
  ['珊', 'shan', 1, 'gift'], ['珀', 'po', 4, 'gift'], ['瑙', 'nao', 3, 'gift'],

  /* 中性（只为读音） */
  ['安', 'an', 1, 'com'], ['阿', 'a', 1, 'com'], ['巴', 'ba', 1, 'com'],
  ['贝', 'bei', 4, 'com'], ['本', 'ben', 3, 'com'], ['比', 'bi', 3, 'com'],
  ['彼', 'bi', 3, 'com'], ['波', 'bo', 1, 'com'], ['布', 'bu', 4, 'com'],
  ['戴', 'dai', 4, 'com'], ['丹', 'dan', 1, 'com'], ['迪', 'di', 2, 'com'],
  ['杜', 'du', 4, 'com'], ['多', 'duo', 1, 'com'], ['狄', 'di', 2, 'com'],
  ['厄', 'e', 4, 'com'], ['尔', 'er', 3, 'com'], ['凡', 'fan', 2, 'com'],
  ['弗', 'fu', 2, 'com'], ['甘', 'gan', 1, 'com'], ['格', 'ge', 2, 'com'],
  ['戈', 'ge', 1, 'com'], ['赫', 'he', 4, 'com'], ['亨', 'heng', 1, 'com'],
  ['贾', 'jia', 3, 'com'], ['柯', 'ke', 1, 'com'], ['克', 'ke', 4, 'com'],
  ['拉', 'la', 1, 'com'], ['勒', 'le', 4, 'com'], ['雷', 'lei', 2, 'com'],
  ['里', 'li', 3, 'com'], ['理', 'li', 3, 'com'], ['卢', 'lu', 2, 'com'],
  ['鲁', 'lu', 3, 'com'], ['洛', 'luo', 4, 'com'], ['罗', 'luo', 2, 'com'],
  ['玛', 'ma', 3, 'com'], ['马', 'ma', 3, 'com'], ['迈', 'mai', 4, 'com'],
  ['曼', 'man', 4, 'com'], ['蒙', 'meng', 2, 'com'], ['米', 'mi', 3, 'com'],
  ['密', 'mi', 4, 'com'], ['摩', 'mo', 2, 'com'], ['莫', 'mo', 4, 'com'],
  ['穆', 'mu', 4, 'com'], ['纳', 'na', 4, 'com'], ['奈', 'nai', 4, 'com'],
  ['尼', 'ni', 2, 'com'], ['帕', 'pa', 4, 'com'], ['佩', 'pei', 4, 'com'],
  ['皮', 'pi', 2, 'com'], ['普', 'pu', 3, 'com'], ['奇', 'qi', 2, 'com'],
  ['乔', 'qiao', 2, 'com'], ['森', 'sen', 1, 'com'], ['施', 'shi', 1, 'com'],
  ['苏', 'su', 1, 'com'], ['汤', 'tang', 1, 'com'], ['坦', 'tan', 3, 'com'],
  ['提', 'ti', 2, 'com'], ['托', 'tuo', 1, 'com'], ['瓦', 'wa', 3, 'com'],
  ['韦', 'wei', 2, 'com'], ['文', 'wen', 2, 'com'], ['沃', 'wo', 4, 'com'],
  ['西', 'xi', 1, 'com'], ['希', 'xi', 1, 'com'], ['谢', 'xie', 4, 'com'],
  ['辛', 'xin', 1, 'com'], ['休', 'xiu', 1, 'com'], ['雅', 'ya', 3, 'com'],
  ['亚', 'ya', 4, 'com'], ['伊', 'yi', 1, 'com'], ['因', 'yin', 1, 'com'],
  ['尤', 'you', 2, 'com'], ['于', 'yu', 2, 'com'], ['泽', 'ze', 2, 'com'],
  ['扎', 'zha', 1, 'com'], ['珍', 'zhen', 1, 'com'], ['芝', 'zhi', 1, 'com'],
  ['朱', 'zhu', 1, 'com'], ['卓', 'zhuo', 2, 'com'], ['璐', 'lu', 4, 'com'],
  ['彤', 'tong', 2, 'com'], ['柏', 'bai', 3, 'com'], ['班', 'ban', 1, 'com'],
  ['彭', 'peng', 2, 'com'], ['庞', 'pang', 2, 'com'], ['台', 'tai', 2, 'com'],
  ['郎', 'lang', 2, 'com'], ['温', 'wen', 1, 'com'], ['欣', 'xin', 1, 'com'],
  ['顿', 'dun', 4, 'com'], ['福', 'fu', 2, 'com'], ['考', 'kao', 3, 'com'],
  ['尼', 'ni', 2, 'com'], ['塔', 'ta', 3, 'com'], ['斯', 'si', 1, 'com'],
  ['娃', 'wa', 2, 'com'], ['哈', 'ha', 1, 'com'], ['萝', 'luo', 2, 'wood'],
  ['埃', 'ai', 1, 'com'], ['瑟', 'se', 4, 'sound'], ['茱', 'zhu', 1, 'wood'],
  ['内', 'nei', 4, 'com'], ['典', 'dian', 3, 'mind'], ['约', 'yue', 1, 'mind'],
  ['塞', 'sai', 1, 'com'], ['欧', 'ou', 1, 'com'], ['果', 'guo', 3, 'com'],
  ['大', 'da', 4, 'com'], ['卫', 'wei', 4, 'mind'], ['以', 'yi', 3, 'com'],
  ['设', 'she', 4, 'com'], ['百', 'bai', 3, 'com'], ['撒', 'sa', 1, 'com'],
  ['库', 'ku', 4, 'com'], ['得', 'de', 2, 'com'], ['佛', 'fo', 2, 'com'],
  ['纳', 'na', 4, 'com'], ['缪', 'miu', 4, 'com'], ['姬', 'ji', 1, 'quiet'],
  ['莱', 'lai', 2, 'wood'], ['安', 'an', 1, 'mind'], ['其', 'qi', 2, 'com']
].map(function (x) {
  return {
    c: x[0], py: x[1], tone: x[2], dom: x[3],
    m: '音译常用字，主要取其读音', freq: 3, g: 'u', phon: true
  };
});
