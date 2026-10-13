/* 双语名人参考库扩充卷
 * 与 celebrities-bilingual.js 使用同一 schema：
 * en / zh / tokens / job / bio。
 * 这是策选参考，不是完整名录，也不代表人物评价。
 */
var NM = (window.NM = window.NM || {});

NM.BILINGUAL_CELEBS_MORE = [
  /* ── 中国大陆 / 香港 / 台湾 / 新加坡娱乐 ─────────────── */
  { en: 'Ge You', zh: '葛优', tokens: ['Ge', 'You'], job: '中国演员', bio: '以喜剧表演和多部现实题材电影中的鲜明角色闻名。' },
  { en: 'Zhang Yimou', zh: '张艺谋', tokens: ['Zhang', 'Yimou'], job: '中国导演', bio: '执导多部具有国际影响力的华语电影，也参与大型舞台视觉创作。' },
  { en: 'Chen Kaige', zh: '陈凯歌', tokens: ['Chen', 'Kaige'], job: '中国导演', bio: '第五代导演代表人物之一，作品关注历史、个人与时代。' },
  { en: 'Feng Xiaogang', zh: '冯小刚', tokens: ['Feng', 'Xiaogang'], job: '中国导演、编剧', bio: '以都市喜剧和现实题材电影建立鲜明的商业电影风格。' },
  { en: 'Jia Zhangke', zh: '贾樟柯', tokens: ['Jia', 'Zhangke'], job: '中国导演、编剧', bio: '以独立电影记录社会变迁与普通人的生活经验。' },
  { en: 'Wong Jing', zh: '王晶', tokens: ['Wong', 'Jing'], job: '香港导演、编剧', bio: '长期活跃于香港商业电影，创作类型覆盖喜剧、动作与剧情片。' },
  { en: 'Tsui Hark', zh: '徐克', tokens: ['Tsui', 'Hark'], job: '香港导演、编剧', bio: '以武侠电影、类型创新和丰富的视觉想象力著称。' },
  { en: 'Peter Chan', zh: '陈可辛', tokens: ['Peter', 'Chan'], job: '香港导演、制片人', bio: '活跃于香港与华语电影，擅长爱情、历史及现实题材作品。' },
  { en: 'Louis Koo', zh: '古天乐', tokens: ['Louis', 'Koo'], job: '香港演员、制片人', bio: '以电视剧和电影表演为人熟知，也长期参与电影制作与公益。' },
  { en: 'Daniel Wu', zh: '吴彦祖', tokens: ['Daniel', 'Wu'], job: '美籍华人演员、导演', bio: '活跃于香港、华语与美国影视制作，兼任制片与导演。' },
  { en: 'Eddie Peng', zh: '彭于晏', tokens: ['Eddie', 'Peng'], job: '台湾演员', bio: '以动作片、运动题材和历史题材中的表演受到关注。' },
  { en: 'Chang Chen', zh: '张震', tokens: ['Chang', 'Chen'], job: '台湾演员', bio: '长期出演华语作者电影与商业电影，角色类型多样。' },
  { en: 'Mark Chao', zh: '赵又廷', tokens: ['Mark', 'Chao'], job: '台湾演员', bio: '活跃于华语电影和电视剧，凭多种类型角色获得观众认可。' },
  { en: 'Hebe Tien', zh: '田馥甄', tokens: ['Hebe', 'Tien'], job: '台湾歌手', bio: 'S.H.E成员，单飞后以个人化的流行与抒情作品闻名。' },
  { en: 'A-Mei', zh: '张惠妹', tokens: ['A-Mei'], job: '台湾歌手', bio: '以强劲嗓音和现场表现力成为华语流行音乐的重要歌手。' },
  { en: 'Wakin Chau', zh: '周华健', tokens: ['Wakin', 'Chau'], job: '台湾歌手、词曲作者', bio: '以温暖清亮的歌声和大量华语流行经典作品闻名。' },
  { en: 'David Tao', zh: '陶喆', tokens: ['David', 'Tao'], job: '台湾歌手、音乐人', bio: '推动华语流行音乐中的R&B表达，兼具创作与制作能力。' },
  { en: 'Kris Wu', zh: '吴亦凡', tokens: ['Kris', 'Wu'], job: '加拿大华裔艺人', bio: '曾活跃于音乐与影视领域；条目仅作文化资料参考。' },
  { en: 'Jackson Wang', zh: '王嘉尔', tokens: ['Jackson', 'Wang'], job: '香港歌手、舞者', bio: '以团体与个人音乐作品、舞台表演和国际合作受到关注。' },
  { en: 'Lay Zhang', zh: '张艺兴', tokens: ['Lay', 'Zhang'], job: '中国歌手、演员', bio: '活跃于音乐、舞蹈、影视与制作领域。' },
  { en: 'Huang Xiaoming', zh: '黄晓明', tokens: ['Huang', 'Xiaoming'], job: '中国演员、歌手', bio: '出演多部电视剧与电影，也参与影视制作和公益活动。' },
  { en: 'Deng Chao', zh: '邓超', tokens: ['Deng', 'Chao'], job: '中国演员、导演', bio: '在喜剧、剧情片和综艺领域均有长期创作与表演。' },
  { en: 'Xu Zheng', zh: '徐峥', tokens: ['Xu', 'Zheng'], job: '中国演员、导演', bio: '以喜剧表演、导演作品和现实题材商业电影闻名。' },
  { en: 'Shen Teng', zh: '沈腾', tokens: ['Shen', 'Teng'], job: '中国演员、喜剧演员', bio: '以舞台喜剧、电影喜剧和综艺表演获得广泛知名度。' },
  { en: 'Huang Bo', zh: '黄渤', tokens: ['Huang', 'Bo'], job: '中国演员、导演', bio: '以富有生活感的表演和喜剧、剧情电影作品著称。' },
  { en: 'Zhou Xun', zh: '周迅', tokens: ['Zhou', 'Xun'], job: '中国演员、歌手', bio: '以细腻灵动的电影与电视剧表演获得多项重要奖项。' },
  { en: 'Xu Jinglei', zh: '徐静蕾', tokens: ['Xu', 'Jinglei'], job: '中国演员、导演', bio: '活跃于表演、导演、编剧与文化创作等领域。' },
  { en: 'Ni Ni', zh: '倪妮', tokens: ['Ni'], job: '中国演员', bio: '以电影和电视剧中的多样角色受到观众关注。' },
  { en: 'Zhou Dongyu', zh: '周冬雨', tokens: ['Zhou', 'Dongyu'], job: '中国演员', bio: '以自然细腻的电影表演和多种类型角色闻名。' },
  { en: 'Liu Yifei', zh: '刘亦菲', tokens: ['Liu', 'Yifei'], job: '中国演员、歌手', bio: '活跃于华语电视剧、电影及国际影视制作。' },
  { en: 'Yang Mi', zh: '杨幂', tokens: ['Yang', 'Mi'], job: '中国演员、制片人', bio: '长期出演电视剧和电影，也参与影视制作。' },
  { en: 'Dilraba Dilmurat', zh: '迪丽热巴', tokens: ['Dilraba', 'Dilmurat'], job: '中国演员', bio: '活跃于电视剧、电影与综艺领域。' },
  { en: 'Wang Yibo', zh: '王一博', tokens: ['Wang', 'Yibo'], job: '中国歌手、演员、舞者', bio: '从音乐与舞蹈表演拓展到影视和赛车等领域。' },
  { en: 'Jackson Yee', zh: '易烊千玺', tokens: ['Jackson', 'Yee'], job: '中国歌手、演员', bio: '以音乐团体、个人音乐和电影表演受到关注。' },

  /* ── 国际娱乐：美国 / 英国 / 欧洲 / 韩国 / 日本 / 印度 ─── */
  { en: 'Marilyn Monroe', zh: '玛丽莲·梦露', tokens: ['Marilyn', 'Monroe'], job: '美国演员、歌手', bio: '二十世纪最具代表性的电影明星之一，持续影响流行文化。' },
  { en: 'Marlon Brando', zh: '马龙·白兰度', tokens: ['Marlon', 'Brando'], job: '美国演员', bio: '以自然主义表演和《教父》等经典电影成为表演史重要人物。' },
  { en: 'Meryl Streep', zh: '梅丽尔·斯特里普', tokens: ['Meryl', 'Streep'], job: '美国演员', bio: '以角色跨度和细腻表演著称，是当代电影表演的代表人物。' },
  { en: 'Tom Hanks', zh: '汤姆·汉克斯', tokens: ['Tom', 'Hanks'], job: '美国演员、制片人', bio: '出演多部广受欢迎的剧情与喜剧电影，曾获奥斯卡最佳男主角。' },
  { en: 'Tom Cruise', zh: '汤姆·克鲁斯', tokens: ['Tom', 'Cruise'], job: '美国演员、制片人', bio: '以动作电影、特技表演和长期的电影事业闻名。' },
  { en: 'Brad Pitt', zh: '布拉德·皮特', tokens: ['Brad', 'Pitt'], job: '美国演员、制片人', bio: '活跃于商业与作者电影，也参与独立电影制作。' },
  { en: 'Angelina Jolie', zh: '安吉丽娜·朱莉', tokens: ['Angelina', 'Jolie'], job: '美国演员、导演、公益倡导者', bio: '以影视表演、导演工作和难民公益活动受到国际关注。' },
  { en: 'Natalie Portman', zh: '娜塔莉·波特曼', tokens: ['Natalie', 'Portman'], job: '美以演员、制片人', bio: '活跃于电影表演与制作，也关注教育和社会议题。' },
  { en: 'Scarlett Johansson', zh: '斯嘉丽·约翰逊', tokens: ['Scarlett', 'Johansson'], job: '美国演员、歌手', bio: '以商业大片和独立电影中的多样角色闻名。' },
  { en: 'Jennifer Lawrence', zh: '詹妮弗·劳伦斯', tokens: ['Jennifer', 'Lawrence'], job: '美国演员', bio: '凭多部电影塑造的鲜明角色获得奥斯卡最佳女主角。' },
  { en: 'Morgan Freeman', zh: '摩根·弗里曼', tokens: ['Morgan', 'Freeman'], job: '美国演员、旁白', bio: '以沉稳的银幕表演和旁白声线为全球观众熟知。' },
  { en: 'Samuel L. Jackson', zh: '塞缪尔·杰克逊', tokens: ['Samuel', 'Jackson'], job: '美国演员', bio: '出演大量类型电影，以鲜明台词风格和角色气场著称。' },
  { en: 'Joaquin Phoenix', zh: '华金·菲尼克斯', tokens: ['Joaquin', 'Phoenix'], job: '美国演员、制片人', bio: '以深入角色的表演和对动物权益的倡议受到关注。' },
  { en: 'Cate Blanchett', zh: '凯特·布兰切特', tokens: ['Cate', 'Blanchett'], job: '澳大利亚演员、制片人', bio: '活跃于舞台与电影，擅长历史人物和复杂角色。' },
  { en: 'Hugh Jackman', zh: '休·杰克曼', tokens: ['Hugh', 'Jackman'], job: '澳大利亚演员、歌手', bio: '横跨音乐剧、动作片和剧情电影，舞台表演同样出色。' },
  { en: 'Daniel Craig', zh: '丹尼尔·克雷格', tokens: ['Daniel', 'Craig'], job: '英国演员', bio: '因饰演詹姆斯·邦德而国际知名，也出演多种类型电影。' },
  { en: 'Benedict Cumberbatch', zh: '本尼迪克特·康伯巴奇', tokens: ['Benedict', 'Cumberbatch'], job: '英国演员', bio: '以电视剧、舞台和电影中的复杂角色获得国际声誉。' },
  { en: 'Colin Firth', zh: '科林·费尔斯', tokens: ['Colin', 'Firth'], job: '英国演员', bio: '长期活跃于英国影视，擅长文学改编与历史题材。' },
  { en: 'Judi Dench', zh: '朱迪·丹奇', tokens: ['Judi', 'Dench'], job: '英国演员', bio: '英国舞台与银幕表演的重要人物，角色横跨古典与现代作品。' },
  { en: 'Tilda Swinton', zh: '蒂尔达·斯文顿', tokens: ['Tilda', 'Swinton'], job: '英国演员', bio: '以大胆多变的角色选择和作者电影合作闻名。' },
  { en: 'Christopher Nolan', zh: '克里斯托弗·诺兰', tokens: ['Christopher', 'Nolan'], job: '英国导演、编剧', bio: '擅长复杂叙事、时间结构和大银幕电影制作。' },
  { en: 'Steven Spielberg', zh: '史蒂文·斯皮尔伯格', tokens: ['Steven', 'Spielberg'], job: '美国导演、制片人', bio: '执导大量影响全球观众的商业与历史题材电影。' },
  { en: 'Quentin Tarantino', zh: '昆汀·塔伦蒂诺', tokens: ['Quentin', 'Tarantino'], job: '美国导演、编剧', bio: '以非线性叙事、类型混搭和独特对白风格著称。' },
  { en: 'Martin Scorsese', zh: '马丁·斯科塞斯', tokens: ['Martin', 'Scorsese'], job: '美国导演、制片人', bio: '长期探索犯罪、信仰与美国社会，影响世界电影创作。' },
  { en: 'Hayao Miyazaki', zh: '宫崎骏', tokens: ['Hayao', 'Miyazaki'], job: '日本动画导演', bio: '吉卜力重要创作者，以富有想象力和人文关怀的动画闻名。' },
  { en: 'Akira Kurosawa', zh: '黑泽明', tokens: ['Akira', 'Kurosawa'], job: '日本导演、编剧', bio: '以《罗生门》《七武士》等作品影响世界电影语言。' },
  { en: 'Takeshi Kitano', zh: '北野武', tokens: ['Takeshi', 'Kitano'], job: '日本导演、演员', bio: '横跨电影、电视与文学，作品常兼具冷峻幽默和暴力美学。' },
  { en: 'Hirokazu Kore-eda', zh: '是枝裕和', tokens: ['Hirokazu', 'Kore-eda'], job: '日本导演、编剧', bio: '以克制细腻的家庭题材电影观察亲情与社会关系。' },
  { en: 'Bong Joon-ho', zh: '奉俊昊', tokens: ['Bong', 'Joon-ho'], job: '韩国导演、编剧', bio: '以类型片手法讨论阶层、家庭与社会结构，作品具有国际影响。' },
  { en: 'Park Chan-wook', zh: '朴赞郁', tokens: ['Park', 'Chan-wook'], job: '韩国导演、编剧', bio: '以强烈视觉风格和复杂复仇叙事成为韩国电影代表导演。' },
  { en: 'Lee Byung-hun', zh: '李秉宪', tokens: ['Lee', 'Byung-hun'], job: '韩国演员', bio: '活跃于韩国与国际影视制作，角色覆盖动作、历史与剧情类型。' },
  { en: 'Song Kang-ho', zh: '宋康昊', tokens: ['Song', 'Kang-ho'], job: '韩国演员', bio: '以自然、富有层次的表演成为韩国电影的重要演员。' },
  { en: 'Lee Min-ho', zh: '李敏镐', tokens: ['Lee', 'Min-ho'], job: '韩国演员、歌手', bio: '以电视剧、电影和广告作品在亚洲拥有广泛知名度。' },
  { en: 'Kim Soo-hyun', zh: '金秀贤', tokens: ['Kim', 'Soo-hyun'], job: '韩国演员', bio: '以电视剧和电影表演获得多个亚洲地区观众群体关注。' },
  { en: 'IU', zh: '李知恩', tokens: ['IU'], job: '韩国歌手、演员', bio: '以音乐创作、演唱和影视表演形成跨领域事业。' },
  { en: 'G-Dragon', zh: '权志龙', tokens: ['G-Dragon'], job: '韩国歌手、制作人', bio: '以音乐创作、舞台风格和时尚影响力闻名。' },
  { en: 'Aamir Khan', zh: '阿米尔·汗', tokens: ['Aamir', 'Khan'], job: '印度演员、制片人', bio: '以社会题材电影、角色准备和制片工作受到国际关注。' },
  { en: 'Shah Rukh Khan', zh: '沙鲁克·汗', tokens: ['Shah', 'Rukh', 'Khan'], job: '印度演员、制片人', bio: '宝莱坞代表演员之一，长期出演爱情片与社会题材电影。' },
  { en: 'Priyanka Chopra', zh: '朴雅卡·乔普拉', tokens: ['Priyanka', 'Chopra'], job: '印度演员、制片人', bio: '活跃于印度与美国影视，也参与公益和商业事业。' },
  { en: 'Satyajit Ray', zh: '萨蒂亚吉特·雷伊', tokens: ['Satyajit', 'Ray'], job: '印度导演、作家', bio: '印度电影大师，以人文主义电影和细腻叙事享誉世界。' },
  { en: 'Pedro Almodóvar', zh: '佩德罗·阿尔莫多瓦', tokens: ['Pedro', 'Almodovar'], job: '西班牙导演、编剧', bio: '以色彩鲜明、关注身份与家庭关系的电影风格著称。' },
  { en: 'Federico Fellini', zh: '费德里科·费里尼', tokens: ['Federico', 'Fellini'], job: '意大利导演、编剧', bio: '以梦境般的影像和自传性叙事成为意大利电影大师。' },
  { en: 'Sofia Coppola', zh: '索菲亚·科波拉', tokens: ['Sofia', 'Coppola'], job: '美国导演、编剧', bio: '以疏离而细腻的青春、女性与家庭题材电影闻名。' },
  { en: 'Agnès Varda', zh: '阿涅斯·瓦尔达', tokens: ['Agnes', 'Varda'], job: '法国导演、艺术家', bio: '法国新浪潮重要创作者，以纪录片和女性视角作品著称。' },

  /* ── 古代与历史人物：中国 ─────────────────────────── */
  { en: 'Confucius', zh: '孔子', tokens: ['Confucius'], job: '中国思想家、教育家', bio: '儒家学派重要奠基者，关于仁、礼与教育的思想影响东亚文明。' },
  { en: 'Mencius', zh: '孟子', tokens: ['Mencius'], job: '中国思想家', bio: '儒家代表人物，主张性善与仁政，后世尊为亚圣。' },
  { en: 'Laozi', zh: '老子', tokens: ['Laozi'], job: '中国思想家', bio: '道家思想代表人物，《道德经》讨论道、自然与治理。' },
  { en: 'Sun Tzu', zh: '孙武', tokens: ['Sun', 'Tzu'], job: '中国军事家', bio: '《孙子兵法》作者传统上归于其名下，战略思想影响世界军事与管理。' },
  { en: 'Qin Shi Huang', zh: '秦始皇', tokens: ['Qin', 'Shi', 'Huang'], job: '中国皇帝', bio: '建立中国历史上第一个大一统帝国，推行多项制度统一。' },
  { en: 'Emperor Wu of Han', zh: '汉武帝', tokens: ['Emperor', 'Wu', 'Han'], job: '中国皇帝', bio: '西汉重要皇帝，扩展疆域并强化中央制度与文化秩序。' },
  { en: 'Cao Cao', zh: '曹操', tokens: ['Cao', 'Cao'], job: '中国政治家、军事家、诗人', bio: '东汉末年重要政治与军事人物，建安文学代表之一。' },
  { en: 'Liu Bei', zh: '刘备', tokens: ['Liu', 'Bei'], job: '中国政治家', bio: '三国时期蜀汉建立者，后世常以仁厚和用人故事记述。' },
  { en: 'Genghis Khan', zh: '成吉思汗', tokens: ['Genghis', 'Khan'], job: '蒙古帝国建立者', bio: '统一蒙古高原并建立横跨欧亚的帝国，深刻影响中世纪世界史。' },
  { en: 'Kublai Khan', zh: '忽必烈', tokens: ['Kublai', 'Khan'], job: '元朝皇帝', bio: '建立元朝并统治广阔疆域，推动多民族交流与行政整合。' },
  { en: 'Empress Wu Zetian', zh: '武则天', tokens: ['Empress', 'Wu', 'Zetian'], job: '中国皇帝', bio: '中国历史上唯一正统女皇帝，统治时期重视科举和人才选用。' },
  { en: 'Zhuge Liang', zh: '诸葛亮', tokens: ['Zhuge', 'Liang'], job: '中国政治家、军事家', bio: '三国时期蜀汉丞相，以治国、北伐和《出师表》闻名。' },
  { en: 'Li Shimin', zh: '李世民', tokens: ['Li', 'Shimin'], job: '唐朝皇帝', bio: '唐太宗，开创贞观之治，重视纳谏与制度建设。' },
  { en: 'Zheng He', zh: '郑和', tokens: ['Zheng', 'He'], job: '中国航海家', bio: '明代率船队多次远航印度洋，促进外交、贸易与文化交流。' },
  { en: 'Emperor Kangxi', zh: '康熙帝', tokens: ['Emperor', 'Kangxi'], job: '清朝皇帝', bio: '清代重要皇帝，在位时期疆域治理与文化事业均有发展。' },
  { en: 'Emperor Qianlong', zh: '乾隆帝', tokens: ['Emperor', 'Qianlong'], job: '清朝皇帝', bio: '清代在位时间很长的皇帝，重视典籍编纂与疆域治理。' },
  { en: 'Li Hongzhang', zh: '李鸿章', tokens: ['Li', 'Hongzhang'], job: '清朝政治家、外交家', bio: '晚清洋务运动与外交中的关键人物，推动近代军事和工业建设。' },
  { en: 'Empress Dowager Cixi', zh: '慈禧太后', tokens: ['Empress', 'Dowager', 'Cixi'], job: '清朝政治人物', bio: '晚清长期参与最高政治决策，历史评价复杂且影响深远。' },
  { en: 'Sun Yat-sen', zh: '孙中山', tokens: ['Sun', 'Yat-sen'], job: '中国革命家、政治家', bio: '辛亥革命重要领导者，提出三民主义并推动共和思想传播。' },
  { en: 'Mao Zedong', zh: '毛泽东', tokens: ['Mao', 'Zedong'], job: '中国政治人物', bio: '中国近现代历史重要政治人物，参与中华人民共和国建立。' },
  { en: 'Deng Xiaoping', zh: '邓小平', tokens: ['Deng', 'Xiaoping'], job: '中国政治人物', bio: '中国改革开放的重要领导人，推动经济与社会政策转型。' },
  { en: 'Zhou Enlai', zh: '周恩来', tokens: ['Zhou', 'Enlai'], job: '中国政治人物、外交家', bio: '中华人民共和国重要领导人和外交家，长期参与国家建设。' },

  /* ── 古代与历史人物：全球 ─────────────────────────── */
  { en: 'Socrates', zh: '苏格拉底', tokens: ['Socrates'], job: '古希腊哲学家', bio: '以对话和追问方式探讨伦理与知识，深刻影响西方哲学传统。' },
  { en: 'Plato', zh: '柏拉图', tokens: ['Plato'], job: '古希腊哲学家', bio: '苏格拉底弟子，创立学园，关于理念与政治的著作影响深远。' },
  { en: 'Aristotle', zh: '亚里士多德', tokens: ['Aristotle'], job: '古希腊哲学家、科学家', bio: '系统研究逻辑、伦理、政治与自然科学，塑造西方学术传统。' },
  { en: 'Alexander the Great', zh: '亚历山大大帝', tokens: ['Alexander', 'Great'], job: '马其顿国王、军事家', bio: '建立横跨欧亚非的大帝国，促进希腊化时代的文化交流。' },
  { en: 'Julius Caesar', zh: '尤利乌斯·凯撒', tokens: ['Julius', 'Caesar'], job: '罗马政治家、军事家', bio: '罗马共和国末期重要人物，其改革与征战改变欧洲历史进程。' },
  { en: 'Cleopatra', zh: '克娄巴特拉', tokens: ['Cleopatra'], job: '古埃及女王', bio: '托勒密王朝最后的重要统治者，以政治才能与文化修养著称。' },
  { en: 'Augustus', zh: '奥古斯都', tokens: ['Augustus'], job: '罗马皇帝', bio: '罗马帝国首位皇帝，奠定元首制和相对长期的政治秩序。' },
  { en: 'Joan of Arc', zh: '圣女贞德', tokens: ['Joan', 'Arc'], job: '法国军事人物', bio: '百年战争中的法国民族象征，后来被天主教会封为圣人。' },
  { en: 'Leonardo da Vinci', zh: '列奥纳多·达·芬奇', tokens: ['Leonardo', 'Vinci'], job: '意大利艺术家、科学家', bio: '文艺复兴跨学科巨匠，兼具绘画、工程、解剖和科学观察成就。' },
  { en: 'Michelangelo', zh: '米开朗基罗', tokens: ['Michelangelo'], job: '意大利艺术家', bio: '文艺复兴雕塑、绘画与建筑大师，代表作包括《大卫》。' },
  { en: 'Galileo Galilei', zh: '伽利略', tokens: ['Galileo', 'Galilei'], job: '意大利天文学家、物理学家', bio: '以望远镜观测和运动研究推动近代科学方法发展。' },
  { en: 'Nicolaus Copernicus', zh: '哥白尼', tokens: ['Nicolaus', 'Copernicus'], job: '波兰天文学家', bio: '提出日心说，改变人类对太阳系结构的认识。' },
  { en: 'Martin Luther', zh: '马丁·路德', tokens: ['Martin', 'Luther'], job: '德国神学家', bio: '宗教改革重要人物，其思想改变欧洲宗教、政治与文化史。' },
  { en: 'George Washington', zh: '乔治·华盛顿', tokens: ['George', 'Washington'], job: '美国政治家', bio: '美国首任总统和独立战争领导者之一，参与美国建国制度塑造。' },
  { en: 'Abraham Lincoln', zh: '亚伯拉罕·林肯', tokens: ['Abraham', 'Lincoln'], job: '美国总统', bio: '美国第十六任总统，在内战与废奴问题上发挥关键作用。' },
  { en: 'Winston Churchill', zh: '温斯顿·丘吉尔', tokens: ['Winston', 'Churchill'], job: '英国政治家、作家', bio: '二战时期英国首相，以演说、领导力和历史写作著称。' },
  { en: 'Mahatma Gandhi', zh: '圣雄甘地', tokens: ['Mahatma', 'Gandhi'], job: '印度政治家、社会倡导者', bio: '以非暴力抵抗思想领导印度独立运动，影响全球民权运动。' },
  { en: 'Nelson Mandela', zh: '纳尔逊·曼德拉', tokens: ['Nelson', 'Mandela'], job: '南非政治家', bio: '反种族隔离运动领导者和南非总统，倡导和解与民主转型。' },
  { en: 'Martin Luther King Jr.', zh: '马丁·路德·金', tokens: ['Martin', 'King'], job: '美国民权领袖', bio: '美国民权运动重要领袖，以非暴力倡议和演讲影响世界。' },
  { en: 'Mother Teresa', zh: '特蕾莎修女', tokens: ['Mother', 'Teresa'], job: '天主教修女、慈善工作者', bio: '长期服务贫困与病患群体，获诺贝尔和平奖。' },
  { en: 'Rosa Parks', zh: '罗莎·帕克斯', tokens: ['Rosa', 'Parks'], job: '美国民权活动家', bio: '以拒绝让座事件成为美国民权运动的重要象征。' },

  /* ── 科学 / 文学 / 艺术 ───────────────────────────── */
  { en: 'Marie Curie', zh: '玛丽·居里', tokens: ['Marie', 'Curie'], job: '波兰裔法国物理学家、化学家', bio: '发现钋和镭，两度获得诺贝尔奖，推动放射性研究。' },
  { en: 'Albert Einstein', zh: '阿尔伯特·爱因斯坦', tokens: ['Albert', 'Einstein'], job: '德裔物理学家', bio: '提出相对论并解释光电效应，改变现代物理学。' },
  { en: 'Isaac Newton', zh: '艾萨克·牛顿', tokens: ['Isaac', 'Newton'], job: '英国物理学家、数学家', bio: '建立经典力学体系，在光学与微积分方面也有重大贡献。' },
  { en: 'Charles Darwin', zh: '查尔斯·达尔文', tokens: ['Charles', 'Darwin'], job: '英国博物学家', bio: '以自然选择理论解释生物演化，奠定现代进化生物学基础。' },
  { en: 'Ada Lovelace', zh: '阿达·洛夫莱斯', tokens: ['Ada', 'Lovelace'], job: '英国数学家', bio: '为分析机撰写算法，被视为早期计算机程序设计先驱。' },
  { en: 'Alan Turing', zh: '艾伦·图灵', tokens: ['Alan', 'Turing'], job: '英国数学家、计算机科学家', bio: '奠定理论计算机科学基础，并参与二战密码破译。' },
  { en: 'Stephen Hawking', zh: '史蒂芬·霍金', tokens: ['Stephen', 'Hawking'], job: '英国物理学家、作家', bio: '研究黑洞与宇宙学，并以科普写作让现代宇宙学走近大众。' },
  { en: 'Jane Goodall', zh: '珍·古道尔', tokens: ['Jane', 'Goodall'], job: '英国灵长类学家、环保倡导者', bio: '长期研究黑猩猩行为，并推动全球野生动物保护。' },
  { en: 'Rachel Carson', zh: '蕾切尔·卡森', tokens: ['Rachel', 'Carson'], job: '美国海洋生物学家、作家', bio: '《寂静的春天》推动现代环境保护运动。' },
  { en: 'William Shakespeare', zh: '威廉·莎士比亚', tokens: ['William', 'Shakespeare'], job: '英国剧作家、诗人', bio: '创作大量戏剧与诗歌，持续影响世界文学与戏剧表演。' },
  { en: 'Jane Austen', zh: '简·奥斯汀', tokens: ['Jane', 'Austen'], job: '英国作家', bio: '以机智细腻的社会观察创作《傲慢与偏见》等经典小说。' },
  { en: 'Victor Hugo', zh: '维克多·雨果', tokens: ['Victor', 'Hugo'], job: '法国作家', bio: '浪漫主义文学代表，作品充满人道主义关怀与社会批判。' },
  { en: 'Leo Tolstoy', zh: '列夫·托尔斯泰', tokens: ['Leo', 'Tolstoy'], job: '俄国作家', bio: '《战争与和平》《安娜·卡列尼娜》作者，深刻书写历史与人性。' },
  { en: 'Virginia Woolf', zh: '弗吉尼亚·伍尔夫', tokens: ['Virginia', 'Woolf'], job: '英国作家', bio: '现代主义文学重要作家，以意识流和女性写作思想著称。' },
  { en: 'Gabriel García Márquez', zh: '加西亚·马尔克斯', tokens: ['Gabriel', 'Garcia', 'Marquez'], job: '哥伦比亚作家', bio: '魔幻现实主义代表，作品深刻影响拉丁美洲文学。' },
  { en: 'Haruki Murakami', zh: '村上春树', tokens: ['Haruki', 'Murakami'], job: '日本作家', bio: '小说融合都市生活、音乐和超现实元素，拥有广泛国际读者。' },
  { en: 'Frida Kahlo', zh: '弗里达·卡罗', tokens: ['Frida', 'Kahlo'], job: '墨西哥画家', bio: '以自画像和个人经历探索身份、身体与民族文化。' },
  { en: 'Pablo Picasso', zh: '巴勃罗·毕加索', tokens: ['Pablo', 'Picasso'], job: '西班牙画家、雕塑家', bio: '立体主义重要开创者之一，持续重塑现代艺术语言。' },
  { en: 'Vincent van Gogh', zh: '文森特·梵高', tokens: ['Vincent', 'Gogh'], job: '荷兰画家', bio: '后印象派代表，以强烈色彩和笔触表达内在情感。' },
  { en: 'Andy Warhol', zh: '安迪·沃霍尔', tokens: ['Andy', 'Warhol'], job: '美国艺术家', bio: '波普艺术代表人物，将消费图像与大众传媒带入艺术创作。' },
  { en: 'Yayoi Kusama', zh: '草间弥生', tokens: ['Yayoi', 'Kusama'], job: '日本艺术家', bio: '以圆点、重复和沉浸式装置形成独特的当代艺术语言。' },
  { en: 'Ludwig van Beethoven', zh: '路德维希·范·贝多芬', tokens: ['Ludwig', 'Beethoven'], job: '德国作曲家', bio: '古典主义与浪漫主义之间的关键作曲家，作品充满戏剧性力量。' },
  { en: 'Wolfgang Amadeus Mozart', zh: '沃尔夫冈·阿马德乌斯·莫扎特', tokens: ['Wolfgang', 'Mozart'], job: '奥地利作曲家', bio: '古典音乐代表人物，歌剧、协奏曲和交响作品影响深远。' },
  { en: 'Frédéric Chopin', zh: '弗雷德里克·肖邦', tokens: ['Frederic', 'Chopin'], job: '波兰作曲家、钢琴家', bio: '以钢琴作品和富有歌唱性的旋律成为浪漫主义音乐代表。' },
  { en: 'Maya Angelou', zh: '玛雅·安吉罗', tokens: ['Maya', 'Angelou'], job: '美国作家、诗人', bio: '以回忆录、诗歌和公共演讲书写身份、尊严与坚韧。' },
  { en: 'Toni Morrison', zh: '托妮·莫里森', tokens: ['Toni', 'Morrison'], job: '美国作家', bio: '诺贝尔文学奖得主，作品深入探讨美国黑人历史与记忆。' },

  /* ── 商业 / 体育 / 公共人物 ───────────────────────── */
  { en: 'Bill Gates', zh: '比尔·盖茨', tokens: ['Bill', 'Gates'], job: '美国企业家、慈善家', bio: '微软共同创办人，长期参与全球公共卫生与慈善事业。' },
  { en: 'Steve Jobs', zh: '史蒂夫·乔布斯', tokens: ['Steve', 'Jobs'], job: '美国企业家', bio: '苹果共同创办人，深刻影响个人电脑、手机和数字内容产品。' },
  { en: 'Jeff Bezos', zh: '杰夫·贝索斯', tokens: ['Jeff', 'Bezos'], job: '美国企业家', bio: '亚马逊创办人，推动电子商务与云计算业务发展。' },
  { en: 'Warren Buffett', zh: '沃伦·巴菲特', tokens: ['Warren', 'Buffett'], job: '美国投资家', bio: '以长期价值投资理念和伯克希尔·哈撒韦事业闻名。' },
  { en: 'Jack Ma', zh: '马云', tokens: ['Jack', 'Ma'], job: '中国企业家', bio: '阿里巴巴共同创办人，推动中国电子商务发展。' },
  { en: 'Pony Ma', zh: '马化腾', tokens: ['Pony', 'Ma'], job: '中国企业家', bio: '腾讯主要创办人之一，参与发展即时通信与互联网服务。' },
  { en: 'Lei Jun', zh: '雷军', tokens: ['Lei', 'Jun'], job: '中国企业家', bio: '小米创办人，活跃于消费电子与科技创业领域。' },
  { en: 'Mukesh Ambani', zh: '穆克什·安巴尼', tokens: ['Mukesh', 'Ambani'], job: '印度企业家', bio: '印度企业家，领导大型能源、电信与零售企业集团。' },
  { en: 'Princess Diana', zh: '戴安娜王妃', tokens: ['Princess', 'Diana'], job: '英国王室成员、慈善倡导者', bio: '长期参与慈善与公共活动，成为全球知名公共人物。' },
  { en: 'Queen Elizabeth II', zh: '伊丽莎白二世', tokens: ['Queen', 'Elizabeth'], job: '英国女王', bio: '英国在位时间最长的君主之一，见证二十世纪与二十一世纪变迁。' },
  { en: 'Pope Francis', zh: '教宗方济各', tokens: ['Pope', 'Francis'], job: '天主教教宗', bio: '重视贫困、移民、和平与环境议题的宗教领袖。' },
  { en: 'Michelle Obama', zh: '米歇尔·奥巴马', tokens: ['Michelle', 'Obama'], job: '美国作家、公益倡导者', bio: '美国前第一夫人，关注教育、健康与女性发展议题。' },
  { en: 'Angela Merkel', zh: '安格拉·默克尔', tokens: ['Angela', 'Merkel'], job: '德国政治人物', bio: '德国前总理，长期参与欧洲政治与国际事务。' },
  { en: 'Volodymyr Zelenskyy', zh: '弗拉基米尔·泽连斯基', tokens: ['Volodymyr', 'Zelenskyy'], job: '乌克兰政治人物、演员', bio: '乌克兰总统，曾从事喜剧与影视表演。' },
  { en: 'Michael Jordan', zh: '迈克尔·乔丹', tokens: ['Michael', 'Jordan'], job: '美国篮球运动员', bio: 'NBA历史上最具影响力的球员之一，推动篮球全球传播。' },
  { en: 'LeBron James', zh: '勒布朗·詹姆斯', tokens: ['LeBron', 'James'], job: '美国篮球运动员', bio: '长期保持顶尖竞技水平，也参与教育、公益与影视制作。' },
  { en: 'Kobe Bryant', zh: '科比·布莱恩特', tokens: ['Kobe', 'Bryant'], job: '美国篮球运动员', bio: 'NBA传奇球员，退役后参与创作与青年体育教育。' },
  { en: 'David Beckham', zh: '大卫·贝克汉姆', tokens: ['David', 'Beckham'], job: '英国足球运动员、企业家', bio: '前英格兰足球运动员，退役后参与体育管理、品牌与公益。' },
  { en: 'Pelé', zh: '贝利', tokens: ['Pele'], job: '巴西足球运动员', bio: '足球史上最具代表性的球员之一，三次赢得世界杯。' },
  { en: 'Diego Maradona', zh: '迭戈·马拉多纳', tokens: ['Diego', 'Maradona'], job: '阿根廷足球运动员', bio: '以精湛球技和鲜明个性成为足球史上的标志性人物。' },
  { en: 'Roger Federer', zh: '罗杰·费德勒', tokens: ['Roger', 'Federer'], job: '瑞士网球运动员', bio: '以全面技术、优雅球风和长期职业成就闻名。' },
  { en: 'Usain Bolt', zh: '尤塞恩·博尔特', tokens: ['Usain', 'Bolt'], job: '牙买加短跑运动员', bio: '多次打破世界纪录，被视为田径短跑史上的代表人物。' },
  { en: 'Simone Biles', zh: '西蒙·拜尔斯', tokens: ['Simone', 'Biles'], job: '美国体操运动员', bio: '世界顶尖体操运动员之一，以难度、稳定性和心理健康倡议受到关注。' },
  { en: 'Naomi Osaka', zh: '大坂直美', tokens: ['Naomi', 'Osaka'], job: '日本网球运动员', bio: '大满贯冠军，公开讨论心理健康与社会正义议题。' },
  { en: 'Eileen Gu', zh: '谷爱凌', tokens: ['Eileen', 'Gu'], job: '中美自由式滑雪运动员', bio: '自由式滑雪奥运冠军，活跃于体育、教育与公共倡议领域。' },
  { en: 'Sachin Tendulkar', zh: '萨钦·坦杜尔卡', tokens: ['Sachin', 'Tendulkar'], job: '印度板球运动员', bio: '板球史上最具代表性的击球手之一，拥有大量国际纪录。' },
  { en: 'Ryuichi Sakamoto', zh: '坂本龙一', tokens: ['Ryuichi', 'Sakamoto'], job: '日本作曲家、音乐人', bio: '跨越电影配乐、电子音乐与古典创作，具有国际影响力。' },
  { en: 'Simone Weil', zh: '西蒙娜·薇依', tokens: ['Simone', 'Weil'], job: '法国哲学家、作家', bio: '以关于劳动、苦难、正义和精神生活的思想著称。' },
  { en: 'Hannah Arendt', zh: '汉娜·阿伦特', tokens: ['Hannah', 'Arendt'], job: '德裔美国思想家', bio: '研究极权主义、公共领域与政治行动，深刻影响现代政治思想。' },
  { en: 'Noam Chomsky', zh: '诺姆·乔姆斯基', tokens: ['Noam', 'Chomsky'], job: '美国语言学家、思想家', bio: '推动现代语言学发展，也长期参与公共议题讨论。' }
];

/* 追加到主库并建立与原文件完全相同的英文 token / 全名索引。 */
NM.BILINGUAL_CELEBS = (NM.BILINGUAL_CELEBS || []).concat(NM.BILINGUAL_CELEBS_MORE);
var moreBilingualRows = NM.BILINGUAL_CELEBS_MORE.reduce(function (rows, person) {
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
NM.NAMES_EN = NM.NAMES_EN.concat(NM.packEn(moreBilingualRows));

NM.BILINGUAL_CELEBS_MORE.forEach(function (person) {
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
