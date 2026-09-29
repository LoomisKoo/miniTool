/* 双语名人参考库
 * fields: English full name, Chinese full name, standalone English tokens,
 * occupation, short bio.
 * This is a curated cultural reference, not an authoritative directory.
 */
var NM = (window.NM = window.NM || {});

NM.BILINGUAL_CELEBS = [
  { en: 'Jackie Chan', zh: '成龙', tokens: ['Jackie', 'Chan'], job: '香港演员、导演、武术家', bio: '以动作喜剧电影和国际影坛影响力闻名。' },
  { en: 'Jet Li', zh: '李连杰', tokens: ['Jet', 'Li'], job: '中国演员、武术家', bio: '以武术电影和国际影视作品为人熟知。' },
  { en: 'Bruce Lee', zh: '李小龙', tokens: ['Bruce', 'Lee'], job: '美籍华人演员、武术家', bio: '推动功夫电影走向世界，并创立截拳道。' },
  { en: 'Michelle Yeoh', zh: '杨紫琼', tokens: ['Michelle', 'Yeoh'], job: '马来西亚华裔演员', bio: '活跃于亚洲与好莱坞电影，曾获奥斯卡最佳女主角。' },
  { en: 'Donnie Yen', zh: '甄子丹', tokens: ['Donnie', 'Yen'], job: '香港演员、武术家', bio: '以动作片表演和武术指导工作闻名。' },
  { en: 'Andy Lau', zh: '刘德华', tokens: ['Andy', 'Lau'], job: '香港演员、歌手', bio: '华语流行文化中持续活跃的演员与歌手。' },
  { en: 'Tony Leung', zh: '梁朝伟', tokens: ['Tony', 'Leung'], job: '香港演员', bio: '以细腻的电影表演和多部经典华语影片闻名。' },
  { en: 'Stephen Chow', zh: '周星驰', tokens: ['Stephen', 'Chow'], job: '香港演员、导演', bio: '以独特喜剧风格和电影创作建立鲜明风格。' },
  { en: 'Chow Yun-fat', zh: '周润发', tokens: ['Chow', 'Yun-fat'], job: '香港演员', bio: '以警匪片、动作片及多部华语经典作品闻名。' },
  { en: 'Wong Kar-wai', zh: '王家卫', tokens: ['Wong', 'Kar-wai'], job: '香港导演、编剧', bio: '以风格化影像和都市情感电影著称。' },
  { en: 'Ang Lee', zh: '李安', tokens: ['Ang', 'Lee'], job: '华人导演', bio: '执导跨文化题材电影，曾多次获得奥斯卡奖。' },
  { en: 'John Woo', zh: '吴宇森', tokens: ['John', 'Woo'], job: '香港导演', bio: '以动作电影的枪战美学和英雄片风格闻名。' },
  { en: 'Sammo Hung', zh: '洪金宝', tokens: ['Sammo', 'Hung'], job: '香港演员、动作指导', bio: '长期参与华语动作电影的表演、导演与武术指导。' },
  { en: 'Maggie Cheung', zh: '张曼玉', tokens: ['Maggie', 'Cheung'], job: '香港演员', bio: '以多样化的电影角色和细腻表演获得广泛认可。' },
  { en: 'Leslie Cheung', zh: '张国荣', tokens: ['Leslie', 'Cheung'], job: '香港歌手、演员', bio: '在华语音乐与电影领域留下深远影响。' },
  { en: 'Anita Mui', zh: '梅艳芳', tokens: ['Anita', 'Mui'], job: '香港歌手、演员', bio: '以舞台表演、音乐作品和电影角色为人熟知。' },
  { en: 'Aaron Kwok', zh: '郭富城', tokens: ['Aaron', 'Kwok'], job: '香港歌手、演员', bio: '华语流行音乐与电影领域的代表性艺人。' },
  { en: 'Joey Yung', zh: '容祖儿', tokens: ['Joey', 'Yung'], job: '香港歌手', bio: '以流行音乐作品和现场演出闻名。' },
  { en: 'Jay Chou', zh: '周杰伦', tokens: ['Jay', 'Chou'], job: '台湾歌手、音乐人、导演', bio: '以融合流行与多种音乐元素的创作影响华语流行音乐。' },
  { en: 'Jolin Tsai', zh: '蔡依林', tokens: ['Jolin', 'Tsai'], job: '台湾歌手', bio: '以流行音乐、舞蹈与视觉作品持续受到关注。' },
  { en: 'Teresa Teng', zh: '邓丽君', tokens: ['Teresa', 'Teng'], job: '台湾歌手', bio: '其歌曲在华语地区拥有跨世代的传播与影响力。' },
  { en: 'Faye Wong', zh: '王菲', tokens: ['Faye', 'Wong'], job: '香港歌手、演员', bio: '以独特嗓音和个人化的流行音乐风格闻名。' },
  { en: 'Eason Chan', zh: '陈奕迅', tokens: ['Eason', 'Chan'], job: '香港歌手、演员', bio: '以粤语及国语流行音乐作品和现场演出闻名。' },
  { en: 'G.E.M.', zh: '邓紫棋', tokens: ['GEM'], job: '香港歌手、词曲作者', bio: '以流行音乐创作、演唱及现场表现获得国际关注。' },
  { en: 'JJ Lin', zh: '林俊杰', tokens: ['JJ', 'Lin'], job: '新加坡歌手、词曲作者', bio: '以华语流行音乐创作和演唱能力闻名。' },
  { en: 'Stefanie Sun', zh: '孙燕姿', tokens: ['Stefanie', 'Sun'], job: '新加坡歌手', bio: '以华语流行歌曲和清澈的演唱风格受到喜爱。' },
  { en: 'Vivian Hsu', zh: '徐若瑄', tokens: ['Vivian', 'Hsu'], job: '台湾歌手、演员', bio: '活跃于华语音乐、电影与电视领域。' },
  { en: 'Rainie Yang', zh: '杨丞琳', tokens: ['Rainie', 'Yang'], job: '台湾歌手、演员', bio: '在流行音乐、电视剧和电影领域均有代表作品。' },
  { en: 'Zhao Liying', zh: '赵丽颖', tokens: ['Zhao', 'Liying'], job: '中国演员', bio: '以电视剧与电影角色获得广泛观众认可。' },
  { en: 'Fan Bingbing', zh: '范冰冰', tokens: ['Fan', 'Bingbing'], job: '中国演员、制片人', bio: '活跃于华语影视与国际电影活动。' },
  { en: 'Gong Li', zh: '巩俐', tokens: ['Gong', 'Li'], job: '华人演员', bio: '以多部华语及国际电影中的表演闻名。' },
  { en: 'Zhang Ziyi', zh: '章子怡', tokens: ['Zhang', 'Ziyi'], job: '中国演员', bio: '在华语电影及国际制作中塑造过多个代表角色。' },
  { en: 'Yao Ming', zh: '姚明', tokens: ['Yao', 'Ming'], job: '中国篮球运动员', bio: '曾效力于 NBA，并推动篮球运动的国际交流。' },
  { en: 'Guo Jingming', zh: '郭敬明', tokens: ['Guo', 'Jingming'], job: '中国作家、导演', bio: '从事小说创作、电影导演与出版相关工作。' },
  { en: 'Stephen Curry', zh: '斯蒂芬·库里', tokens: ['Stephen', 'Curry'], job: '美国篮球运动员', bio: '以三分球技术和 NBA 职业生涯成就闻名。' },
  { en: 'Rihanna', zh: '蕾哈娜', tokens: ['Rihanna'], job: '巴巴多斯歌手、企业家', bio: '以流行音乐作品和跨领域商业事业闻名。' },
  { en: 'Beyoncé', zh: '碧昂丝', tokens: ['Beyonce'], job: '美国歌手、词曲作者', bio: '以音乐创作、舞台表演和文化影响力闻名。' },
  { en: 'Lionel Messi', zh: '利昂内尔·梅西', tokens: ['Lionel', 'Messi'], job: '阿根廷足球运动员', bio: '世界知名足球运动员，曾多次获得重要个人荣誉。' },
  { en: 'Cristiano Ronaldo', zh: '克里斯蒂亚诺·罗纳尔多', tokens: ['Cristiano', 'Ronaldo'], job: '葡萄牙足球运动员', bio: '以长期职业生涯、进球纪录和竞技表现闻名。' },
  { en: 'Serena Williams', zh: '塞雷娜·威廉姆斯', tokens: ['Serena', 'Williams'], job: '美国网球运动员', bio: '网球史上最具影响力的运动员之一。' },
  { en: 'Oprah Winfrey', zh: '奥普拉·温弗瑞', tokens: ['Oprah', 'Winfrey'], job: '美国主持人、制片人', bio: '以电视节目主持、媒体事业和慈善工作闻名。' },
  { en: 'Barack Obama', zh: '巴拉克·奥巴马', tokens: ['Barack', 'Obama'], job: '美国政治人物、作家', bio: '美国前总统，也是畅销书作者与公共演说者。' },
  { en: 'Kamala Harris', zh: '卡玛拉·哈里斯', tokens: ['Kamala', 'Harris'], job: '美国政治人物、律师', bio: '美国政治人物，曾任美国副总统。' },
  { en: 'Malala Yousafzai', zh: '马拉拉·优素福扎伊', tokens: ['Malala', 'Yousafzai'], job: '巴基斯坦教育倡导者', bio: '因推动女孩教育和人权事业获得诺贝尔和平奖。' },
  { en: 'Greta Thunberg', zh: '格蕾塔·通贝里', tokens: ['Greta', 'Thunberg'], job: '瑞典气候倡导者', bio: '以气候行动倡议和青年公共参与受到国际关注。' },
  { en: 'Emma Watson', zh: '艾玛·沃森', tokens: ['Emma', 'Watson'], job: '英国演员、公益倡导者', bio: '因影视作品和性别平等倡议为人熟知。' },
  { en: 'Robert Downey Jr.', zh: '小罗伯特·唐尼', tokens: ['Robert', 'Downey'], job: '美国演员', bio: '以多部商业电影和丰富的角色塑造闻名。' },
  { en: 'Keanu Reeves', zh: '基努·里维斯', tokens: ['Keanu', 'Reeves'], job: '加拿大演员', bio: '以动作片及多种类型电影中的角色为人熟知。' },
  { en: 'Dwayne Johnson', zh: '道恩·强森', tokens: ['Dwayne', 'Johnson'], job: '美国演员、职业摔角手', bio: '从职业摔角发展至影视表演和制片事业。' },
  { en: 'Zendaya', zh: '赞达亚', tokens: ['Zendaya'], job: '美国演员、歌手', bio: '以影视表演、音乐和时尚领域的作品受到关注。' },
  { en: 'Taylor Swift', zh: '泰勒·斯威夫特', tokens: ['Taylor', 'Swift'], job: '美国歌手、词曲作者', bio: '以叙事性创作和持续变化的音乐风格闻名。' },
  { en: 'Tim Cook', zh: '蒂姆·库克', tokens: ['Tim', 'Cook'], job: '美国企业家', bio: '苹果公司首席执行官，长期参与消费科技产品的发展。' },
  { en: 'Elon Musk', zh: '埃隆·马斯克', tokens: ['Elon', 'Musk'], job: '企业家、工程师', bio: '参与创办和领导多家科技公司，长期关注电动汽车与航天。' }
];

/* 转成现有 token 索引；不把完整姓名伪装成单个英文名。 */
var bilingualTokenRows = NM.BILINGUAL_CELEBS.reduce(function (rows, person) {
  person.tokens.forEach(function (token) {
    rows.push([
      token, '', '', '公众人物常用英文名或姓氏 token', 'now', 'u',
      token.slice(0, 2).toLowerCase(), '',
      [0.2, 0.2, 0.2, 0.2], [0.2, 0.4, 0.1],
      '在双语名人参考中作为独立英文名或姓氏使用'
    ]);
  });
  return rows;
}, []);
NM.NAMES_EN = NM.NAMES_EN.concat(NM.packEn(bilingualTokenRows));

NM.BILINGUAL_CELEBS.forEach(function (person) {
  person.tokens.forEach(function (token) {
    var key = token.toLowerCase();
    NM.EN_CELEBS[key] = NM.EN_CELEBS[key] || [];
    if (!NM.EN_CELEBS[key].some(function (item) { return item[0] === person.en; })) {
      NM.EN_CELEBS[key].push([person.en, person.job, person.bio, person.zh]);
    }
    NM.EN_CELEB_SEARCH[key] = NM.EN_CELEB_SEARCH[key] || [];
    if (NM.EN_CELEB_SEARCH[key].indexOf(person.en.toLowerCase()) === -1) {
      NM.EN_CELEB_SEARCH[key].push(person.en.toLowerCase());
    }
  });
});
