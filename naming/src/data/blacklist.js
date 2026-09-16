/* 黑名单：算法推不出来的部分，只能人工维护。
 * 三类：
 *   BAD_CHARS  单字黑名单（笔画多到看不清 / 有强烈负面联想）
 *   BAD_GIVEN  双字组合黑名单（拼装时会撞出来的谐音名）
 *   BAD_FULL   整名拼音黑名单（姓+名连读撞词）
 */
var NM = (window.NM = window.NM || {});

NM.BAD_CHARS = ['死', '鬼', '病', '贫', '亡', '衰', '贱', '奸', '毒', '尸', '冥', '殇', '煞', '凶', '灾'];

NM.BAD_GIVEN = [
  '子腾', '珍香', '逸群', '云涛', '炎杰', '静冰', '建仁', '仁范', '寿生',
  '无能', '范统', '史真', '翠花', '二狗', '大壮', '招娣', '来娣', '引娣',
  '盼弟', '铁柱', '栓柱', '狗剩', '钢蛋', '富贵', '金凤', '淑芬', '桂兰'
];

NM.BAD_FULL = [
  'yangwei', 'wuneng', 'futian', 'zhusi', 'shizhen', 'liliang', 'weijin',
  'baiyue', 'goutou', 'wangba', 'bieren', 'zhuangbi', 'shabi', 'dabian',
  'xiaohe', 'liuyan', 'chenmo'
];

NM.isCharBanned = function (ch) {
  return NM.BAD_CHARS.indexOf(ch) !== -1;
};

NM.isGivenBanned = function (given) {
  return NM.BAD_GIVEN.indexOf(given) !== -1;
};

/* 整名 pinyin 连读检查：姓+名 拼成一串拼音，看是否撞词 */
NM.isFullBanned = function (surnamePy, given) {
  const full = (surnamePy + given).toLowerCase();
  return NM.BAD_FULL.some(function (bad) { return full === bad; });
};
