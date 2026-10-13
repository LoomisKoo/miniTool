/* 复姓库
 * 复姓是两个字两个音节，所以比单姓多带 pys/tones 两个字段：
 *   pys   逐音节拼音（用来算顺口度、显示拼音）
 *   tones 逐音节声调
 * py/tone 保留成首音节，兼容只认单音节的旧代码路径。
 * ro 是常见罗马字，用来给外文名匹配音头（Ouyang → 欧阳）。
 */
var NM = (window.NM = window.NM || {});

NM.COMPOUND_SURNAMES = [
  { c: '欧阳', py: 'ou',   tone: 1, pys: ['ou', 'yang'],      tones: [1, 2], ro: 'Ouyang',    pop: 3, m: '出自姒姓，越王之后，封于欧余山之阳' },
  { c: '上官', py: 'shang', tone: 4, pys: ['shang', 'guan'],  tones: [4, 1], ro: 'Shangguan', pop: 3, m: '出自芈姓，楚怀王封子兰为上官邑大夫' },
  { c: '司马', py: 'si',   tone: 1, pys: ['si', 'ma'],        tones: [1, 3], ro: 'Sima',      pop: 3, m: '源自官职，掌军事；司马迁、司马光之姓' },
  { c: '诸葛', py: 'zhu',  tone: 1, pys: ['zhu', 'ge'],       tones: [1, 3], ro: 'Zhuge',     pop: 3, m: '原为葛姓，居诸县，合称诸葛；诸葛亮之姓' },
  { c: '东方', py: 'dong', tone: 1, pys: ['dong', 'fang'],    tones: [1, 1], ro: 'Dongfang',  pop: 3, m: '出自伏羲之后，以方位为氏；东方朔之姓' },
  { c: '慕容', py: 'mu',   tone: 4, pys: ['mu', 'rong'],      tones: [4, 2], ro: 'Murong',    pop: 3, m: '鲜卑部族之姓，燕国国姓' },
  { c: '皇甫', py: 'huang', tone: 2, pys: ['huang', 'fu'],    tones: [2, 3], ro: 'Huangfu',   pop: 3, m: '出自子姓，宋戴公之子充石字皇父' },
  { c: '尉迟', py: 'yu',   tone: 4, pys: ['yu', 'chi'],       tones: [4, 2], ro: 'Yuchi',     pop: 3, m: '鲜卑部族之姓；唐代尉迟恭' },
  { c: '长孙', py: 'zhang', tone: 3, pys: ['zhang', 'sun'],   tones: [3, 1], ro: 'Zhangsun',  pop: 3, m: '鲜卑拓跋氏宗室之长，故称长孙' },
  { c: '宇文', py: 'yu',   tone: 3, pys: ['yu', 'wen'],       tones: [3, 2], ro: 'Yuwen',     pop: 3, m: '鲜卑部族之姓，北周国姓' },
  { c: '令狐', py: 'ling', tone: 2, pys: ['ling', 'hu'],      tones: [2, 2], ro: 'Linghu',    pop: 3, m: '出自姬姓，封于令狐邑' },
  { c: '独孤', py: 'du',   tone: 2, pys: ['du', 'gu'],        tones: [2, 1], ro: 'Dugu',      pop: 2, m: '鲜卑部族之姓，刘姓一支改称' },
  { c: '南宫', py: 'nan',  tone: 2, pys: ['nan', 'gong'],     tones: [2, 1], ro: 'Nangong',   pop: 2, m: '出自姬姓，居南宫，以地为氏' },
  { c: '西门', py: 'xi',   tone: 1, pys: ['xi', 'men'],       tones: [1, 2], ro: 'Ximen',     pop: 2, m: '居西门，以地为氏；西门豹之姓' },
  { c: '夏侯', py: 'xia',  tone: 4, pys: ['xia', 'hou'],      tones: [4, 2], ro: 'Xiahou',    pop: 3, m: '出自姒姓，杞国之后，受封为夏侯' },
  { c: '公孙', py: 'gong', tone: 1, pys: ['gong', 'sun'],     tones: [1, 1], ro: 'Gongsun',   pop: 3, m: '诸侯之孙为公孙，以爵系为氏' },
  { c: '闻人', py: 'wen',  tone: 2, pys: ['wen', 'ren'],      tones: [2, 2], ro: 'Wenren',    pop: 1, m: '出自春秋鲁国，以「闻于人」为氏' },
  { c: '赫连', py: 'he',   tone: 4, pys: ['he', 'lian'],      tones: [4, 2], ro: 'Helian',    pop: 2, m: '匈奴铁弗部之姓，取「赫赫连天」' },
  { c: '澹台', py: 'tan',  tone: 2, pys: ['tan', 'tai'],      tones: [2, 2], ro: 'Tantai',    pop: 1, m: '出自春秋鲁国澹台灭明之后' },
  { c: '公冶', py: 'gong', tone: 1, pys: ['gong', 'ye'],      tones: [1, 3], ro: 'Gongye',    pop: 1, m: '出自春秋鲁国，以邑为氏；公冶长' },
  { c: '宗政', py: 'zong', tone: 1, pys: ['zong', 'zheng'],   tones: [1, 4], ro: 'Zongzheng', pop: 1, m: '源自官职宗正，掌皇族事务' },
  { c: '濮阳', py: 'pu',   tone: 2, pys: ['pu', 'yang'],      tones: [2, 2], ro: 'Puyang',    pop: 1, m: '以邑为氏，地在今河南濮阳' },
  { c: '淳于', py: 'chun', tone: 2, pys: ['chun', 'yu'],      tones: [2, 2], ro: 'Chunyu',    pop: 1, m: '出自姜姓，以国为氏；淳于髡' },
  { c: '单于', py: 'chan', tone: 2, pys: ['chan', 'yu'],      tones: [2, 2], ro: 'Chanyu',    pop: 1, m: '匈奴君长称号，后以为氏' },
  { c: '太叔', py: 'tai',  tone: 4, pys: ['tai', 'shu'],      tones: [4, 1], ro: 'Taishu',    pop: 1, m: '出自姬姓，郑庄公之弟之后' },
  { c: '申屠', py: 'shen', tone: 1, pys: ['shen', 'tu'],      tones: [1, 2], ro: 'Shentu',    pop: 1, m: '出自姜姓，以地为氏；申屠嘉' },
  { c: '仲孙', py: 'zhong', tone: 4, pys: ['zhong', 'sun'],   tones: [4, 1], ro: 'Zhongsun',  pop: 1, m: '出自姬姓，鲁桓公之后' },
  { c: '钟离', py: 'zhong', tone: 1, pys: ['zhong', 'li'],    tones: [1, 2], ro: 'Zhongli',   pop: 2, m: '出自嬴姓，徐国之后；钟离眜' },
  { c: '鲜于', py: 'xian', tone: 1, pys: ['xian', 'yu'],      tones: [1, 2], ro: 'Xianyu',    pop: 1, m: '出自子姓，箕子之后' },
  { c: '闾丘', py: 'lv',   tone: 2, pys: ['lv', 'qiu'],        tones: [2, 1], ro: 'Lyuqiu',    pop: 1, m: '出自姜姓，以地为氏；闾丘婴' },
  { c: '司徒', py: 'si',   tone: 1, pys: ['si', 'tu'],        tones: [1, 2], ro: 'Situ',      pop: 2, m: '源自官职，掌教化' },
  { c: '司空', py: 'si',   tone: 1, pys: ['si', 'kong'],      tones: [1, 1], ro: 'Sikong',    pop: 2, m: '源自官职，掌工程；司空图' },
  { c: '端木', py: 'duan', tone: 1, pys: ['duan', 'mu'],      tones: [1, 4], ro: 'Duanmu',    pop: 2, m: '出自姬姓；孔子弟子端木赐' },
  { c: '巫马', py: 'wu',   tone: 1, pys: ['wu', 'ma'],        tones: [1, 3], ro: 'Wuma',      pop: 1, m: '源自官职，掌养马；孔子弟子巫马施' },
  { c: '公西', py: 'gong', tone: 1, pys: ['gong', 'xi'],      tones: [1, 1], ro: 'Gongxi',    pop: 1, m: '出自姬姓；孔子弟子公西赤' },
  { c: '漆雕', py: 'qi',   tone: 1, pys: ['qi', 'diao'],      tones: [1, 1], ro: 'Qidiao',    pop: 1, m: '出自姬姓；孔子弟子漆雕开' },
  { c: '乐正', py: 'yue',  tone: 4, pys: ['yue', 'zheng'],    tones: [4, 4], ro: 'Yuezheng',  pop: 1, m: '源自官职，掌宫廷音乐' },
  { c: '拓跋', py: 'tuo',  tone: 4, pys: ['tuo', 'ba'],       tones: [4, 2], ro: 'Tuoba',     pop: 2, m: '鲜卑部族之姓，北魏国姓' },
  { c: '夹谷', py: 'jia',  tone: 2, pys: ['jia', 'gu'],       tones: [2, 3], ro: 'Jiagu',     pop: 1, m: '出自女真，以地为氏' },
  { c: '谷梁', py: 'gu',   tone: 3, pys: ['gu', 'liang'],     tones: [3, 2], ro: 'Guliang',   pop: 1, m: '出自姬姓，以邑为氏；谷梁赤' },
  { c: '段干', py: 'duan', tone: 4, pys: ['duan', 'gan'],     tones: [4, 1], ro: 'Duangan',   pop: 1, m: '出自老子之后，段干木' },
  { c: '百里', py: 'bai',  tone: 3, pys: ['bai', 'li'],       tones: [3, 3], ro: 'Baili',     pop: 2, m: '出自姬姓，以地为氏；百里奚' },
  { c: '东郭', py: 'dong', tone: 1, pys: ['dong', 'guo'],     tones: [1, 1], ro: 'Dongguo',   pop: 1, m: '居城东郭，以地为氏；东郭先生' },
  { c: '南门', py: 'nan',  tone: 2, pys: ['nan', 'men'],      tones: [2, 2], ro: 'Nanmen',    pop: 1, m: '居南门，以地为氏' },
  { c: '呼延', py: 'hu',   tone: 1, pys: ['hu', 'yan'],       tones: [1, 2], ro: 'Huyan',     pop: 2, m: '鲜卑部族之姓；呼延赞、呼延灼' },
  { c: '羊舌', py: 'yang', tone: 2, pys: ['yang', 'she'],     tones: [2, 2], ro: 'Yangshe',   pop: 1, m: '出自姬姓，以邑为氏；羊舌肸' },
  { c: '微生', py: 'wei',  tone: 1, pys: ['wei', 'sheng'],    tones: [1, 1], ro: 'Weisheng',  pop: 1, m: '出自春秋鲁国；微生高' },
  { c: '梁丘', py: 'liang', tone: 2, pys: ['liang', 'qiu'],   tones: [2, 1], ro: 'Liangqiu',  pop: 1, m: '以邑为氏；梁丘据' },
  { c: '左丘', py: 'zuo',  tone: 3, pys: ['zuo', 'qiu'],      tones: [3, 1], ro: 'Zuoqiu',    pop: 1, m: '居左丘，以地为氏；左丘明' },
  { c: '东门', py: 'dong', tone: 1, pys: ['dong', 'men'],     tones: [1, 2], ro: 'Dongmen',   pop: 1, m: '居东门，以地为氏' },
  { c: '第五', py: 'di',   tone: 4, pys: ['di', 'wu'],        tones: [4, 3], ro: 'Diwu',      pop: 1, m: '出自田姓，汉初迁齐田氏分第一至第八，以次为氏' }
];
