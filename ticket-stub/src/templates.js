/**
 * 票根分类、风格与字段配置 + HTML 模板
 */
(function (global) {
  // 按分类的柔焦占位图：中心构图，cover 裁切不易露馅
  const DEFAULT_PHOTOS = {
    cinema: 'assets/default-cinema.png',
    travel: 'assets/default-travel.png',
    concert: 'assets/default-concert.png',
    city: 'assets/default-city.png',
    stamp: 'assets/default-stamp.png',
  };
  const DEFAULT_PHOTO = DEFAULT_PHOTOS.cinema;
  // ============================================================
  // 批量风格数据：一处定义 → 自动生成「风格条目 + 渲染器」
  // ============================================================

  const FIELD_KEYS = ['title', 'place', 'datetime', 'seat', 'mood'];

  // 图案联票：[id, 名称, 说明, 配色, 版式, 图案带位置, [图标], 默认值]
  // 版式：side(单方图) / tall(竖图) / wide(横图) / top(顶部宽图) / duo(顶部两张方图)
  const TRAVEL_TRIPS = [
    ['trip-sakura', '樱花联票', '横图 1:1 · 粉樱配色 + 细点阵带', 'sakura', 'side', 'right', ['flower-2', 'plane'],
      { title: 'KYOTO', place: 'JAPAN', datetime: '2026.03.28', seat: 'NO.0001', mood: '花开的时候刚好经过' }],
    ['trip-desert', '沙漠联票', '横图 1:1 · 沙岩配色 + 人字纹带', 'desert', 'duo', 'right', ['sun', 'map-pin'],
      { title: 'GIZA', place: 'EGYPT', datetime: '2026.04.09', seat: 'NO.0002', mood: '风把沙吹成了山的形状' }],
    ['trip-jungle', '雨林联票', '竖图 3:4 · 墨绿配色 + 斜纹带', 'jungle', 'tall', 'right', ['leaf', 'compass'],
      { title: 'TIKAL', place: 'GUATEMALA', datetime: '2026.05.16', seat: 'NO.0003', mood: '树太高了，天空只剩一条缝' }],
    ['trip-aurora', '极光联票', '顶部宽图 · 蓝紫配色 + 同心圆带', 'aurora', 'top', 'right', ['sparkles', 'snowflake'],
      { title: 'REYKJAVIK', place: 'ICELAND', datetime: '2026.02.09', seat: 'NO.0005', mood: '绿色的光在天上淌了一整夜' }],
    ['trip-lagoon', '泻湖联票', '顶部宽图 16:9 · 天蓝配色 + 竖纹带', 'lagoon', 'top', 'right', ['waves', 'anchor'],
      { title: 'SANTORINI', place: 'GREECE', datetime: '2026.06.14', seat: 'NO.0007', mood: '白墙蓝顶，是夏天写下的诗' }],
    ['trip-safari', '草原联票', '顶部宽图 · 橄榄配色 + 网点带', 'safari', 'top', 'right', ['mountain', 'sun'],
      { title: 'NAIROBI', place: 'KENYA', datetime: '2026.08.17', seat: 'NO.0008', mood: '草原的风，吹了整整一天' }],
    ['trip-mono', '黑白联票', '竖图 3:4 · 圆照片 + 黑白点阵带', 'mono', 'tall', 'left', ['compass', 'plane'],
      { title: 'TOKYO', place: 'JAPAN', datetime: '2026.03.02', seat: 'NO.0101', mood: '黑白两色，也够描述一座城' }],
    ['trip-coral', '珊瑚联票', '顶部两张方图 · 砖红配色 + 细网格带', 'coral', 'duo', 'right', ['sunset', 'waves'],
      { title: 'LISBON', place: 'PORTUGAL', datetime: '2026.08.04', seat: 'NO.0102', mood: '电车拐弯的时候，海就出现了' }],
    ['trip-mint', '薄荷联票', '顶部两张方图 · 墨绿人字纹带', 'mint', 'duo', 'right', ['leaf', 'flower-2'],
      { title: 'CHIANG MAI', place: 'THAILAND', datetime: '2026.07.21', seat: 'NO.0103', mood: '雨来得很快，走的时候也很轻' }],
    ['trip-cobalt', '钴蓝联票', '顶部宽图 16:9 · 宝蓝配色 + 竖纹带', 'cobalt', 'top', 'right', ['plane', 'globe'],
      { title: 'OSLO', place: 'NORWAY', datetime: '2026.01.30', seat: 'NO.0104', mood: '天亮得很晚，反而睡得更好' }],
    ['trip-sand', '沙丘联票', '顶部宽图 · 米黄配色 + 细点阵带', 'sand', 'top', 'right', ['sun', 'mountain'],
      { title: 'SAHARA', place: 'MOROCCO', datetime: '2026.05.06', seat: 'NO.0105', mood: '夜里冷得像另一颗星球' }],
    ['trip-plum', '梅子联票', '竖图 3:4 · 圆照片 + 紫红同心圆', 'plum', 'tall', 'left', ['sparkles', 'star'],
      { title: 'VIENNA', place: 'AUSTRIA', datetime: '2026.12.11', seat: 'NO.0106', mood: '音乐会散场，雪还在下' }],
    ['trip-fjord', '峡湾联票', '竖图 3:4 · 冰蓝配色 + 细网格带', 'fjord', 'tall', 'left', ['ship', 'waves'],
      { title: 'BERGEN', place: 'NORWAY', datetime: '2026.02.19', seat: 'NO.0107', mood: '船贴着崖壁走，水黑得发亮' }],
    ['trip-volcano', '火山联票', '顶部宽图 16:9 · 熔岩配色 + 人字纹带', 'volcano', 'top', 'right', ['flame', 'mountain'],
      { title: 'ETNA', place: 'ITALY', datetime: '2026.04.27', seat: 'NO.0108', mood: '石头是热的，风是冷的' }],
    ['trip-tea', '茶山联票', '横图 1:1 · 茶绿配色 + 斜纹带', 'tea', 'side', 'right', ['leaf', 'coffee'],
      { title: 'HANGZHOU', place: 'CHINA', datetime: '2026.04.05', seat: 'NO.0109', mood: '清明前的芽，一小把就够香' }],
  ];

  const CONCERT_TRIPS = [
    ['trip-neon', '霓虹联票', '横图 1:1 · 霓虹紫 + 点阵带', 'neon', 'side', 'right', ['music', 'mic-2'],
      { title: 'STILL LIGHT', place: '上海梅赛德斯中心', datetime: '2026.11.21  19:30', seat: '内场A 08排12', mood: '散场以后，耳朵里还在响' }],
    ['trip-rock', '摇滚联票', '顶部宽图 · 黑红配色 + 斜纹带', 'rock', 'top', 'right', ['zap', 'mic-2'],
      { title: 'LOUD TOUR', place: '北京工人体育馆', datetime: '2026.09.05  20:00', seat: '看台B 03排07', mood: '嗓子哑了，值' }],
    ['trip-fest', '音乐节联票', '顶部两张方图 · 橙黄配色 + 人字纹带', 'fest', 'duo', 'right', ['sun', 'music'],
      { title: 'SUMMER FEST', place: '海边的舞台', datetime: '2026.07.18  18:00', seat: 'GA · WRIST 0417', mood: '风吹过来，全是夏天的味道' }],
    ['trip-jazz', '爵士联票', '顶部宽图 16:9 · 深蓝金 + 网点带', 'jazz', 'top', 'right', ['moon', 'music'],
      { title: 'BLUE NOTE', place: '上海 · JZ Club', datetime: '2026.10.12  21:00', seat: '内场 05桌', mood: '萨克斯一响，夜就慢了' }],
    ['trip-electro', '电音联票', '竖图 3:4 · 青蓝配色 + 竖纹带', 'electro', 'tall', 'right', ['waves', 'sparkles'],
      { title: 'PULSE NIGHT', place: '深圳 · 春茧', datetime: '2026.08.30  22:00', seat: 'STANDING 0218', mood: '灯光一暗，所有人都在跳' }],
    ['trip-folk', '民谣联票', '顶部宽图 · 暖棕配色 + 网格带', 'folk', 'top', 'right', ['coffee', 'music'],
      { title: 'OLD SONGS', place: '成都 · 小酒馆', datetime: '2026.06.28  20:30', seat: '自由坐 · 012', mood: '只唱了三首，就有人哭了' }],
    ['trip-grunge', '摇滚现场', '横图 1:1 · 石灰配色 + 交叉纹带', 'grunge', 'side', 'left', ['guitar', 'zap'],
      { title: 'RAW NOISE', place: '广州 · 声音共和', datetime: '2026.10.24  20:30', seat: '站区 0033', mood: '耳朵嗡嗡的，回家路上还在笑' }],
    ['trip-ember', '橘光现场', '横图 1:1 · 落日配色 + 点阵带', 'ember', 'side', 'right', ['sunset', 'mic-2'],
      { title: 'GOLDEN HOUR', place: '杭州 · 大剧院', datetime: '2026.05.16  19:00', seat: '池座 12排09', mood: '最后一首正好赶上日落' }],
    ['trip-drum', '鼓点现场', '顶部宽图 16:9 · 木色配色 + 同心圆带', 'drum', 'wide', 'right', ['drum', 'speaker'],
      { title: 'RHYTHM LAB', place: '上海 · MAO Live', datetime: '2026.12.06  21:30', seat: '内场 02排15', mood: '鼓一响，心跳就跟着走' }],
  ];

  // 竖版海报：[id, 名称, 说明, 配色, 默认值]
  const CINEMA_POSTERS = [
    ['pstr-mono', '黑白海报', '竖图 3:4 · 黑白点阵条', 'mono',
      { title: '光影留声', place: '上海影城 · SHO', datetime: '2026.02.14  19:30', seat: '5排 08座', mood: '黑白的画面，反而更吵' }],
    ['pstr-sunset', '日落海报', '竖图 3:4 · 紫橘人字纹条', 'sunset',
      { title: '落日大道', place: '百丽宫影城', datetime: '2026.05.21  20:00', seat: '7排 12座', mood: '结尾那个长镜头，舍不得眨眼' }],
    ['pstr-ocean', '海洋海报', '竖图 3:4 · 深蓝竖纹条', 'ocean',
      { title: '潮汐之间', place: '万达影城 · IMAX', datetime: '2026.07.09  21:15', seat: '4排 06座', mood: '散场后，耳朵里还是海浪' }],
    ['pstr-forest', '森林海报', '竖图 3:4 · 深绿斜纹条', 'forest',
      { title: '林中路', place: 'CGV 影城 · 3号厅', datetime: '2026.04.17  18:40', seat: '6排 09座', mood: '安静得能听见呼吸' }],
    ['pstr-neon', '霓虹海报', '竖图 3:4 · 霓虹紫同心圆条', 'neon',
      { title: '午夜电车', place: 'UA 影城 · LUXE', datetime: '2026.11.02  22:30', seat: '8排 03座', mood: '城市睡了，故事才醒' }],
    ['pstr-sepia', '复古海报', '竖图 3:4 · 深棕网格条', 'sepia',
      { title: '旧城之光', place: '大光明电影院', datetime: '2026.03.08  14:00', seat: '2排 11座', mood: '像在别人的旧照片里坐了两小时' }],
    ['pstr-crimson', '猩红海报', '竖图 3:4 · 猩红人字纹条', 'crimson',
      { title: '红房间', place: '百老汇影城', datetime: '2026.08.22  21:40', seat: '9排 05座', mood: '整场只有一个房间，却看得人心慌' }],
    ['pstr-moss', '苔绿海报', '竖图 3:4 · 苔绿斜纹条', 'moss',
      { title: '深山来信', place: '嘉禾影城 · 2号厅', datetime: '2026.06.03  16:20', seat: '3排 14座', mood: '镜头一直没离开那片林子的' }],
    ['pstr-amber', '琥珀海报', '竖图 3:4 · 琥珀点阵条', 'amber',
      { title: '夏日重现', place: 'UA 影城 · LUXE', datetime: '2026.07.18  15:00', seat: '5排 02座', mood: '蝉声一响，整个夏天都回来了' }],
  ];

  // 异形票：[id, 名称, 说明, 形状, 默认值]
  const CITY_SHAPES = [
    ['shape-hex', '宝石六边', '方图 1:1 · 六边裁形', 'hex',
      { title: '外滩', place: 'THE BUND', datetime: '2026.10.02', seat: 'NO.01', mood: '灯光落在江面上，像另一座城' }],
    ['shape-ribbon', '缎带券', '方图 1:1 · 左右 V 型凹口', 'ribbon',
      { title: '武康路', place: 'WUKANG RD', datetime: '2026.09.19', seat: 'NO.02', mood: '梧桐把整条路盖成了一间屋子' }],
    ['shape-shield', '盾形券', '方图 1:1 · 底部收尖', 'shield',
      { title: '城隍庙', place: 'CHENGHUANG TEMPLE', datetime: '2026.08.15', seat: 'NO.03', mood: '香火和小笼包的味道混在一起' }],
    ['shape-slant', '斜切券', '方图 1:1 · 底边斜切', 'slant',
      { title: '西岸', place: 'WEST BUND', datetime: '2026.09.28', seat: 'NO.04', mood: '美术馆的落地窗，把江面框成了画' }],
    ['shape-notch', '双缺口券', '方图 1:1 · 左右双缺口', 'notch',
      { title: '永康路', place: 'YONGKANG RD', datetime: '2026.10.06', seat: 'NO.05', mood: '一杯咖啡的时间，看完了半条街' }],
    ['shape-note', '波浪券', '方图 1:1 · 下缘波浪', 'note',
      { title: '苏州河', place: 'SUZHOU CREEK', datetime: '2026.11.13', seat: 'NO.06', mood: '桥下的水，比桥上安静' }],
    ['shape-tri', '三角票', '方图 1:1 · 三角圆角裁形', 'tri',
      { title: '天山公园', place: 'TIANSHAN PARK', datetime: '2026.11.20', seat: 'NO.07', mood: '草地上躺了一下午，什么都没想' }],
  ];

  const TRIP_LABELS = {
    travel: {
      kind: ['目的地', '地区', '日期', '票号', '旅行短句'],
      band: ['DESTINATION:', 'DATE:', 'TICKET NO:'],
    },
    concert: {
      kind: ['演出名', '场馆', '日期场次', '区域座位', '应援短句'],
      band: ['VENUE:', 'DATE:', 'SEAT:'],
    },
  };

  const POSTER_LABELS = ['片名', '影院 / 厅', '日期场次', '座位 / 编号', '一句话短评'];
  const SHAPE_LABELS = ['地点', '副题 / 英文', '日期', '编号', '漫游短句'];
  const STAMP_LABELS = ['主题', '副题 / 英文', '发行日期', '面值 / 编号', '一句话'];

  /* 邮票：12 种结构 × 配色，[id, 名称, 说明, 结构, 配色, 点缀, 默认值]
     点缀 icon=加图标 rule=加细分隔线 ''=不加，用来让同结构的几枚也有差别 */
  const STAMP_ISSUES = [
    // —— 竖版标准栏 ——
    ['stmp-col-ruby', '经典邮资', '竖图 4:5 · 发行行 + 面值框', 'column', 'ruby', 'icon',
      { title: '苏州园林', place: 'SUZHOU GARDEN', datetime: '2026.05.18', seat: '120分  NO.2026-07', mood: '把一整个园子，压进方寸之间' }],
    ['stmp-col-pine', '松绿邮资', '竖图 4:5 · 发行行 + 细分隔', 'column', 'pine', 'rule',
      { title: '黄山云海', place: 'HUANG SHAN', datetime: '2026.08.15', seat: '150分  NO.2026-09', mood: '云把山藏起来，又还回来' }],
    ['stmp-col-ink', '墨线邮资', '竖图 4:5 · 素面细栏', 'column', 'ink', '',
      { title: '老城墙根', place: 'CITY WALL', datetime: '2026.04.02', seat: '80分  NO.2026-03', mood: '砖缝里长出的草，比城墙还老' }],
    // —— 拱窗 ——
    ['stmp-arch-indigo', '拱窗邮资', '竖图 3:4 · 拱形照片窗 · 靛蓝', 'arch', 'indigo', '',
      { title: '石窟造像', place: 'GROTTO', datetime: '2026.06.11', seat: '200分  NO.2026-12', mood: '仰头看了很久，脖子酸了才走' }],
    ['stmp-arch-ochre', '拱门邮资', '竖图 3:4 · 拱形照片窗 · 赭金', 'arch', 'ochre', 'icon',
      { title: '清真寺穹顶', place: 'DOME', datetime: '2026.09.07', seat: '180分  NO.2026-14', mood: '穹顶下的回声，比人声还干净' }],
    // —— 方章 ——
    ['stmp-seal-ruby', '朱印方票', '方图 1:1 · 双细框 + 居中排版', 'seal', 'ruby', '',
      { title: '朱文印', place: 'SEAL SCRIPT', datetime: '2026.02.08', seat: '60分  NO.2026-02', mood: '一方小印，比签名更认真' }],
    ['stmp-seal-pine', '苍绿方票', '方图 1:1 · 双细框 + 居中排版', 'seal', 'pine', 'rule',
      { title: '青绿山水', place: 'LANDSCAPE', datetime: '2026.07.21', seat: '90分  NO.2026-10', mood: '颜料是石头磨的，所以山不会褪色' }],
    ['stmp-seal-plum', '绛紫方票', '方图 1:1 · 双细框 + 居中排版', 'seal', 'plum', '',
      { title: '夜合花', place: 'MAGNOLIA', datetime: '2026.11.05', seat: '110分  NO.2026-17', mood: '花开在夜里，只有风知道' }],
    // —— 徽记 ——
    ['stmp-crest-lake', '徽记邮资', '横图 16:10 · 圆形徽章压角', 'crest', 'lake', '',
      { title: '远洋邮路', place: 'OCEAN ROUTE', datetime: '2026.03.16', seat: '220分  NO.2026-05', mood: '船走了四十天，信还得再走十天' }],
    ['stmp-crest-ink', '徽章邮资', '横图 16:10 · 圆形徽章压角', 'crest', 'ink', '',
      { title: '铁路通车', place: 'RAILWAY', datetime: '2026.10.01', seat: '100分  NO.2026-16', mood: '铁轨把两个城市缝在了一起' }],
    // —— 面值水印 ——
    ['stmp-denom-clay', '面值水印', '方图 1:1 · 大号面值做底纹', 'denom', 'clay', '',
      { title: '陶器纹样', place: 'POTTERY', datetime: '2026.01.19', seat: '500分  NO.2026-01', mood: '一只手转着泥，转了三十年' }],
    ['stmp-denom-indigo', '大额水印', '方图 1:1 · 大号面值做底纹', 'denom', 'indigo', '',
      { title: '天文观测', place: 'OBSERVATORY', datetime: '2026.12.22', seat: '800分  NO.2026-20', mood: '冬至那天，星星最清楚' }],
    // —— 刻度带 ——
    ['stmp-coord-pine', '刻度邮资', '横图 21:9 · 双层刻度信息带', 'coords', 'pine', '',
      { title: '北纬三十度', place: 'TRIG POINT', datetime: '2026.05.30', seat: '130分  NO.2026-08', mood: '站在线上，也看不出线在哪' }],
    ['stmp-coord-lake', '测绘邮资', '横图 21:9 · 双层刻度信息带', 'coords', 'lake', '',
      { title: '海图测绘', place: 'CHART 117', datetime: '2026.08.08', seat: '160分  NO.2026-13', mood: '先画出海岸，才知道船能停哪' }],
    // —— 缎带 ——
    ['stmp-bann-plum', '缎带邮资', '竖图 4:5 · 顶部缎带标题', 'banner', 'plum', '',
      { title: '牡丹亭', place: 'PEONY PAVILION', datetime: '2026.04.18', seat: '150分  NO.2026-06', mood: '梦里的那一折，唱了三百年' }],
    ['stmp-bann-ochre', '绶带邮资', '竖图 4:5 · 顶部缎带标题', 'banner', 'ochre', '',
      { title: '金榜题名', place: 'IMPERIAL EXAM', datetime: '2026.06.06', seat: '260分  NO.2026-09', mood: '一张纸，压了十年的灯油' }],
    // —— 卷筒 ——
    ['stmp-coil-ruby', '卷筒邮资', '横图 3:2 · 仅上下齿孔', 'coil', 'ruby', '',
      { title: '街角邮筒', place: 'POST BOX', datetime: '2026.02.28', seat: '50分  NO.2026-01', mood: '投进去的那一下，声音很实' }],
    ['stmp-coil-ink', '长卷邮资', '横图 3:2 · 仅上下齿孔', 'coil', 'ink', '',
      { title: '电报大楼', place: 'TELEGRAPH', datetime: '2026.09.25', seat: '70分  NO.2026-15', mood: '字越少，越贵' }],
    // —— 椭圆肖像 ——
    ['stmp-oval-ochre', '椭圆肖像', '椭圆照片 · 环形细框', 'oval', 'ochre', '',
      { title: '木偶艺人', place: 'PUPPETEER', datetime: '2026.03.03', seat: '140分  NO.2026-04', mood: '他手上的线，比命还长' }],
    ['stmp-oval-plum', '椭圆肖像', '椭圆照片 · 环形细框', 'oval', 'plum', '',
      { title: '说书先生', place: 'STORYTELLER', datetime: '2026.10.17', seat: '170分  NO.2026-18', mood: '惊堂木一响，满屋子人都不喘气' }],
    // —— 竖排门券 ——
    ['stmp-gate-clay', '竖排门券', '左竖排字带 · 右图右文', 'gate', 'clay', '',
      { title: '城门楼', place: 'CITY GATE', datetime: '2026.07.14', seat: '190分  NO.2026-11', mood: '门开着，里面是另一个朝代' }],
    ['stmp-gate-pine', '竖排邮券', '左竖排字带 · 右图右文', 'gate', 'pine', '',
      { title: '竹林小径', place: 'BAMBOO PATH', datetime: '2026.11.28', seat: '210分  NO.2026-19', mood: '风一过，整条路都在响' }],
    // —— 图上叠字 ——
    ['stmp-vign-lake', '晕影邮资', '横图 5:4 · 图上叠字', 'vignette', 'lake', '',
      { title: '夜航', place: 'NIGHT FLIGHT', datetime: '2026.01.07', seat: '240分  NO.2026-01', mood: '舷窗外只剩黑，和一点点灯' }],
    ['stmp-vign-plum', '暮色邮资', '横图 5:4 · 图上叠字', 'vignette', 'plum', '',
      { title: '暮色码头', place: 'DUSK PIER', datetime: '2026.05.11', seat: '180分  NO.2026-07', mood: '船开走以后，水面才安静下来' }],
    // —— 台账 ——
    ['stmp-ledg-ink', '台账邮资', '方图 1:1 + 标签横线', 'ledger', 'ink', '',
      { title: '古书修复', place: 'BOOK REPAIR', datetime: '2026.08.26', seat: '280分  NO.2026-13', mood: '补一页纸，比写一页纸慢' }],
    ['stmp-ledg-ochre', '档案邮资', '方图 1:1 + 标签横线', 'ledger', 'ochre', '',
      { title: '手稿入藏', place: 'MANUSCRIPT', datetime: '2026.12.05', seat: '320分  NO.2026-20', mood: '纸会黄，字还在' }],
    ['stmp-ledg-indigo', '标本邮资', '方图 1:1 + 标签横线', 'ledger', 'indigo', '',
      { title: '植物标本', place: 'HERBARIUM', datetime: '2026.04.09', seat: '150分  NO.2026-05', mood: '夹在书里的春天，保存了一百年' }],
  ];

  // 结构 → 图标（拱窗的图标是点缀，徽记的图标是徽章本体）
  const SM_ICON = {
    column: 'stamp', arch: 'sun', seal: 'award', crest: 'compass', denom: 'gem',
    coords: 'ruler', banner: 'flag', coil: 'mailbox', oval: 'user-round',
    gate: 'door-open', vignette: 'camera', ledger: 'book-open',
  };

  function fieldsOf(labels, dv) {
    return FIELD_KEYS.map((k, i) => ({ key: k, label: labels[i], placeholder: dv[k], value: dv[k] }));
  }

  function tripStyleEntries(list, kind) {
    const labels = TRIP_LABELS[kind].kind;
    return list.map(([id, name, desc, pal, pos, icons, dv]) => ({
      id,
      name,
      desc,
      fields: fieldsOf(labels, dv),
    }));
  }

  function posterStyleEntries(list) {
    return list.map(([id, name, desc, pal, dv]) => ({
      id,
      name,
      desc,
      fields: fieldsOf(POSTER_LABELS, dv),
    }));
  }

  function shapeStyleEntries(list) {
    return list.map(([id, name, desc, shape, dv]) => ({
      id,
      name,
      desc,
      fields: fieldsOf(SHAPE_LABELS, dv),
    }));
  }

  function stampStyleEntries(list) {
    return list.map(([id, name, desc, variant, pal, flair, dv]) => ({
      id,
      name,
      desc,
      fields: fieldsOf(STAMP_LABELS, dv),
    }));
  }

  const CATEGORIES = [
    {
      id: 'cinema',
      name: '电影票',
      tab: '电影',
      icon: 'clapperboard',
      styles: [
        {
          id: 'cinema-tear',
          name: '双联撕裂',
          desc: '经典影院票根 · 虚线撕边',
          fields: [
            { key: 'title', label: '片名', placeholder: '午夜巴黎', value: '午夜巴黎' },
            { key: 'place', label: '影院 / 厅', placeholder: '和平影都 · 3 号厅', value: '和平影都 · 3号厅' },
            { key: 'datetime', label: '日期场次', placeholder: '2026.04.02  19:30', value: '2026.04.02  19:30' },
            { key: 'seat', label: '座位 / 编号', placeholder: '7排 12座  NO.A204', value: '7排12座  NO.A204' },
            { key: 'mood', label: '一句话短评', placeholder: '雨夜落幕，仍想回那座城', value: '雨夜落幕，仍想回那座城' },
          ],
        },
        {
          id: 'cinema-polaroid',
          name: '拍立得卡',
          desc: '圆角相纸 · 下方留白签名',
          fields: [
            { key: 'title', label: '片名', placeholder: '花样年华', value: '花样年华' },
            { key: 'place', label: '地点', placeholder: '香港 · 旺角', value: '香港 · 旺角' },
            { key: 'datetime', label: '日期', placeholder: '2026.03.18', value: '2026.03.18' },
            { key: 'mood', label: '签名 / 心情', placeholder: '那些年的慢镜头', value: '那些年的慢镜头' },
          ],
        },
        {
          id: 'cinema-ovation',
          name: '黑金巨幕',
          desc: '深色海报 · 金色排号',
          fields: [
            { key: 'title', label: '片名', placeholder: '奥本海默', value: '奥本海默' },
            { key: 'place', label: '影厅', placeholder: 'IMAX 激光厅', value: 'IMAX 激光厅' },
            { key: 'seat', label: '座位', placeholder: 'J 排 09 座', value: 'J 排 09 座' },
            { key: 'datetime', label: '场次', placeholder: '2026.06.08  21:00', value: '2026.06.08  21:00' },
            { key: 'mood', label: '一句话短评', placeholder: '光与尘，都在大银幕上', value: '光与尘，都在大银幕上' },
          ],
        },
        {
          id: 'cinema-filmstrip',
          name: '胶片齿孔',
          desc: '两侧打孔 · 复古胶片感',
          fields: [
            { key: 'title', label: '片名', placeholder: 'THE GODFATHER', value: 'THE GODFATHER' },
            { key: 'place', label: '影院', placeholder: '胜利电影院', value: '胜利电影院' },
            { key: 'datetime', label: '场次', placeholder: '2026.02.14  14:20', value: '2026.02.14  14:20' },
            { key: 'seat', label: '座位 / 编号', placeholder: '5排 04座  NO.C118', value: '5排 04座  NO.C118' },
            { key: 'mood', label: '一句话短评', placeholder: '老电影，像旧信一样慢', value: '老电影，像旧信一样慢' },
          ],
        },
        {
          id: 'cinema-poster',
          name: '竖版海报',
          desc: '竖图 2:3 · 片名压在图底',
          fields: [
            { key: 'title', label: '片名', placeholder: '海边的曼彻斯特', value: '海边的曼彻斯特' },
            { key: 'place', label: '导演 / 年份', placeholder: '2016 · 剧情', value: '2016 · 剧情' },
            { key: 'datetime', label: '场次', placeholder: '2026.05.20  19:00', value: '2026.05.20  19:00' },
            { key: 'seat', label: '影厅座位', placeholder: '二号厅  6排 07座', value: '二号厅  6排 07座' },
            { key: 'mood', label: '一句话短评', placeholder: '有些冷，一直没化开', value: '有些冷，一直没化开' },
          ],
        },
        {
          id: 'cinema-cinescope',
          name: '长廊巨幕',
          desc: '横图 21:9 · 超宽画幅',
          fields: [
            { key: 'title', label: '片名', placeholder: '沙丘', value: '沙丘' },
            { key: 'place', label: '影院 / 厅', placeholder: '寰映影城 · 巨幕厅', value: '寰映影城 · 巨幕厅' },
            { key: 'datetime', label: '场次', placeholder: '2026.07.11  21:30', value: '2026.07.11  21:30' },
            { key: 'seat', label: '座位 / 编号', placeholder: '9排 15座  NO.D072', value: '9排 15座  NO.D072' },
            { key: 'mood', label: '一句话短评', placeholder: '风沙里也有诗', value: '风沙里也有诗' },
          ],
        },
        {
          id: 'cinema-double',
          name: '双栏票卡',
          desc: '方图 1:1 · 左图右文',
          fields: [
            { key: 'title', label: '片名', placeholder: '爱在黎明破晓前', value: '爱在黎明破晓前' },
            { key: 'place', label: '影院', placeholder: '艺术影院 · 一号厅', value: '艺术影院 · 一号厅' },
            { key: 'datetime', label: '日期', placeholder: '2026.03.09  20:10', value: '2026.03.09  20:10' },
            { key: 'seat', label: '座位', placeholder: '3排 02座', value: '3排 02座' },
            { key: 'mood', label: '一句话短评', placeholder: '一夜很长，够说一辈子', value: '一夜很长，够说一辈子' },
          ],
        },
        {
          id: 'cinema-stubpair',
          name: '存根联票',
          desc: '主票 + 存根 · 撕线双圆孔',
          fields: [
            { key: 'title', label: '片名', placeholder: '天堂电影院', value: '天堂电影院' },
            { key: 'place', label: '影院 / 厅', placeholder: '百丽宫 · 影厅 6', value: '百丽宫 · 影厅 6' },
            { key: 'datetime', label: '日期场次', placeholder: '2026.04.18  19:45', value: '2026.04.18  19:45' },
            { key: 'seat', label: '排号座位', placeholder: '10排 08座', value: '10排 08座' },
            { key: 'mood', label: '一句话短评', placeholder: '散场后，还想再坐一会儿', value: '散场后，还想再坐一会儿' },
          ],
        },
        {
          id: 'cinema-redclassic',
          name: '经典红票',
          desc: '红底烫金 · 左右双圆孔',
          fields: [
            { key: 'title', label: '片名', placeholder: '罗马假日', value: '罗马假日' },
            { key: 'place', label: '影院', placeholder: '大光明电影院', value: '大光明电影院' },
            { key: 'datetime', label: '日期场次', placeholder: '2026.02.14  13:30', value: '2026.02.14  13:30' },
            { key: 'seat', label: '座位 / 编号', placeholder: '8排 06座  NO.A118', value: '8排 06座  NO.A118' },
            { key: 'mood', label: '一句话短评', placeholder: '老电影里的罗马，永远晴天', value: '老电影里的罗马，永远晴天' },
          ],
        },
        {
          id: 'cinema-archive',
          name: '档案卡',
          desc: '横图 16:10 · 左侧打孔 + 归档章',
          fields: [
            { key: 'title', label: '片名', placeholder: '花样年华', value: '花样年华' },
            { key: 'place', label: '影院 / 厅', placeholder: '国泰电影院 · 1号厅', value: '国泰电影院 · 1号厅' },
            { key: 'datetime', label: '日期场次', placeholder: '2026.01.24  19:00', value: '2026.01.24  19:00' },
            { key: 'seat', label: '座位 / 编号', placeholder: '6排 11座  NO.B073', value: '6排 11座  NO.B073' },
            { key: 'mood', label: '一句话短评', placeholder: '那些没说出口的，都在镜头里', value: '那些没说出口的，都在镜头里' },
          ],
        },
        {
          id: 'card-reel',
          name: '锯齿影票',
          desc: '横图 4:3 · 红壳细锯齿 + 胶片筒',
          fields: [
            { key: 'title', label: '片名', placeholder: '天堂电影院', value: '天堂电影院' },
            { key: 'place', label: '影院 / 厅', placeholder: '大光明 · 2号厅', value: '大光明 · 2号厅' },
            { key: 'datetime', label: '场次', placeholder: '2026.06.19  20:00', value: '2026.06.19  20:00' },
            { key: 'seat', label: '排 / 座', placeholder: '5排 09座', value: '5排 09座' },
            { key: 'mood', label: '一句话短评', placeholder: '散场后不想走，坐到了最后', value: '散场后不想走，坐到了最后' },
          ],
        },
        ...posterStyleEntries(CINEMA_POSTERS),
        {
          id: 'cinema-twoup',
          name: '双联票',
          desc: '左右两联同款 · 中缝撕线咬口',
          fields: [
            { key: 'title', label: '片名', placeholder: '花样年华', value: '花样年华' },
            { key: 'place', label: '影院 / 厅', placeholder: '国泰电影院 · 1号厅', value: '国泰电影院 · 1号厅' },
            { key: 'datetime', label: '日期场次', placeholder: '2026.01.24  19:00', value: '2026.01.24  19:00' },
            { key: 'seat', label: '座位 / 编号', placeholder: '6排 11座', value: '6排 11座 / 6排 12座' },
            { key: 'mood', label: '一句话短评', placeholder: '两个人一起看，座位才连号', value: '两个人一起看，座位才连号' },
          ],
        },
        {
          id: 'cinema-threestub',
          name: '三联副券',
          desc: '主体 + 底部三张可撕副券',
          fields: [
            { key: 'title', label: '片名', placeholder: '星际漫游', value: '星际漫游' },
            { key: 'place', label: '影院 / 厅', placeholder: '万达影城 · IMAX', value: '万达影城 · IMAX' },
            { key: 'datetime', label: '日期场次', placeholder: '2026.07.09  21:15', value: '2026.07.09  21:15' },
            { key: 'seat', label: '座位 / 编号', placeholder: '4排 06-08座', value: '4排 06 / 07 / 08' },
            { key: 'mood', label: '一句话短评', placeholder: '三个人的科幻夜', value: '三个人的科幻夜' },
          ],
        },
        {
          id: 'cinema-sheet',
          name: '拼版小票',
          desc: '2×2 拼版 · 裁切线虚线',
          fields: [
            { key: 'title', label: '片名', placeholder: '光影留声', value: '光影留声' },
            { key: 'place', label: '影院 / 厅', placeholder: '上海影城 · SHO', value: '上海影城 · SHO' },
            { key: 'datetime', label: '日期场次', placeholder: '2026.02.14  19:30', value: '2026.02.14  19:30' },
            { key: 'seat', label: '座位 / 编号', placeholder: '5排 08座', value: '5排 08座' },
            { key: 'mood', label: '一句话短评', placeholder: '一整版的同一场电影', value: '一整版的同一场电影' },
          ],
        },
        {
          id: 'card-filmwide',
          name: '宽幅影票',
          desc: '横图 21:9 · 右侧场次信息',
          fields: [
            { key: 'title', label: '片名', placeholder: '星际漫游', value: '星际漫游' },
            { key: 'place', label: '影院 / 厅', placeholder: '万达影城 · IMAX', value: '万达影城 · IMAX' },
            { key: 'datetime', label: '场次', placeholder: '2026.07.09  21:15', value: '2026.07.09  21:15' },
            { key: 'seat', label: '排 / 座', placeholder: '4排 06座', value: '4排 06座' },
            { key: 'mood', label: '一句话短评', placeholder: '一张票，换两个宇宙', value: '一张票，换两个宇宙' },
          ],
        },
        {
          id: 'card-ornate',
          name: '古典花框',
          desc: '横图 16:9 · 米白双线花框',
          fields: [
            { key: 'title', label: '活动名', placeholder: '光影留声 · 展映', value: '光影留声 · 展映' },
            { key: 'place', label: '场馆', placeholder: '上海影城 · 3号厅', value: '上海影城 · 3号厅' },
            { key: 'datetime', label: '日期', placeholder: '2026.02.14  19:30', value: '2026.02.14  19:30' },
            { key: 'seat', label: '票号', placeholder: 'NO.0081', value: 'NO.0081' },
            { key: 'mood', label: '一句话短评', placeholder: '旧片重映，像重逢', value: '旧片重映，像重逢' },
          ],
        },
      ],
    },
    {
      id: 'travel',
      name: '旅行通票',
      tab: '旅行',
      icon: 'plane',
      styles: [
        {
          id: 'travel-board',
          name: '登机牌',
          desc: '航线 · 打卡戳 · 登机口',
          fields: [
            { key: 'title', label: '目的地', placeholder: 'KYOTO', value: 'KYOTO' },
            { key: 'place', label: '出发地', placeholder: 'SHAO XING', value: 'SHAO XING' },
            { key: 'datetime', label: '航班日期', placeholder: '2026.05.12  CX 882', value: '2026.05.12  CX882' },
            { key: 'seat', label: '座位 / 登机口', placeholder: '14A  GATE B7', value: '14A  GATE B7' },
            { key: 'mood', label: '旅行短句', placeholder: '云层之上，心事变轻', value: '云层之上，心事变轻' },
          ],
        },
        {
          id: 'travel-postcard',
          name: '风景明信片',
          desc: '复古邮戳 · 手写感',
          fields: [
            { key: 'title', label: '地名', placeholder: '绍兴 · 水乡', value: '绍兴 · 水乡' },
            { key: 'place', label: '寄自', placeholder: 'FROM EAST CHINA', value: 'FROM EAST CHINA' },
            { key: 'datetime', label: '日期', placeholder: 'APR 02 2026', value: 'APR 02 2026' },
            { key: 'mood', label: '背面短笺', placeholder: '愿你路过时，也被温柔接住', value: '愿你路过时，也被温柔接住' },
          ],
        },
        {
          id: 'travel-tag',
          name: '行李牌',
          desc: '牛皮纸 · 顶部打孔挂绳',
          fields: [
            { key: 'title', label: '目的地', placeholder: 'REYKJAVIK', value: 'REYKJAVIK' },
            { key: 'place', label: '出发地', placeholder: 'FROM SHANGHAI', value: 'FROM SHANGHAI' },
            { key: 'datetime', label: '出行日期', placeholder: '2026.09.30  MU 205', value: '2026.09.30  MU205' },
            { key: 'seat', label: '座位 / 行李', placeholder: '32K  23KG', value: '32K  23KG' },
            { key: 'mood', label: '旅行短句', placeholder: '把冬天装进行李箱', value: '把冬天装进行李箱' },
          ],
        },
        {
          id: 'travel-rail',
          name: '火车票',
          desc: '蓝皮磁条 · 二维码检票',
          fields: [
            { key: 'title', label: '到达站', placeholder: '杭州东', value: '杭州东' },
            { key: 'place', label: '出发站', placeholder: '上海虹桥', value: '上海虹桥' },
            { key: 'datetime', label: '车次 / 时间', placeholder: 'G1234  2026.04.02 09:05', value: 'G1234  2026.04.02 09:05' },
            { key: 'seat', label: '座位 / 检票口', placeholder: '08车 12F  2号口', value: '08车 12F  2号口' },
            { key: 'mood', label: '旅途心情', placeholder: '窗外掠过一整个春天', value: '窗外掠过一整个春天' },
          ],
        },
        {
          id: 'travel-passport',
          name: '护照内页',
          desc: '竖图 4:5 · 米色内页 + 印章',
          fields: [
            { key: 'title', label: '目的地', placeholder: 'ICELAND', value: 'ICELAND' },
            { key: 'place', label: '出发地', placeholder: 'FROM SHANGHAI', value: 'FROM SHANGHAI' },
            { key: 'datetime', label: '日期', placeholder: '2026.01.16', value: '2026.01.16' },
            { key: 'seat', label: '签证 / 入口', placeholder: 'ENTRY 01 · KEF', value: 'ENTRY 01 · KEF' },
            { key: 'mood', label: '旅行短句', placeholder: '追光的人，最后自己发了光', value: '追光的人，最后自己发了光' },
          ],
        },
        {
          id: 'travel-aerial',
          name: '航拍明信片',
          desc: '横图 16:9 · 白边大图',
          fields: [
            { key: 'title', label: '地名', placeholder: '泸沽湖', value: '泸沽湖' },
            { key: 'place', label: '寄自', placeholder: 'FROM YUNNAN', value: 'FROM YUNNAN' },
            { key: 'datetime', label: '日期', placeholder: '2026.06.21', value: '2026.06.21' },
            { key: 'mood', label: '手写短句', placeholder: '水面像一张没写完的信纸', value: '水面像一张没写完的信纸' },
          ],
        },
        {
          id: 'travel-luggage',
          name: '行李条',
          desc: '横图 3:1 · 窄长机场条',
          fields: [
            { key: 'title', label: '目的地', placeholder: 'LISBON', value: 'LISBON' },
            { key: 'place', label: '航线 / 承运', placeholder: 'PVG → LIS · TP 202', value: 'PVG → LIS · TP202' },
            { key: 'datetime', label: '日期', placeholder: '2026.08.04', value: '2026.08.04' },
            { key: 'seat', label: '座位 / 行李', placeholder: '21A  26KG', value: '21A  26KG' },
            { key: 'mood', label: '旅行短句', placeholder: '行李很轻，期待很重', value: '行李很轻，期待很重' },
          ],
        },
        {
          id: 'travel-voucher',
          name: '旅行券',
          desc: '点阵底 · 四角圆孔 + 虚线框',
          fields: [
            { key: 'title', label: '目的地', placeholder: 'MACHU PICCHU', value: 'MACHU PICCHU' },
            { key: 'place', label: '出发地', placeholder: 'FROM LIMA', value: 'FROM LIMA' },
            { key: 'datetime', label: '日期 / 班次', placeholder: '2026.07.02  LA 2043', value: '2026.07.02  LA2043' },
            { key: 'seat', label: '座位 / 舱位', placeholder: '18C · ECONOMY', value: '18C · ECONOMY' },
            { key: 'mood', label: '旅行短句', placeholder: '走了很远，才看见自己很小', value: '走了很远，才看见自己很小' },
          ],
        },
        {
          id: 'travel-boardvintage',
          name: '复古登机牌',
          desc: '右上撕角 · 左侧双圆孔',
          fields: [
            { key: 'title', label: '目的地', placeholder: 'TOKYO', value: 'TOKYO' },
            { key: 'place', label: '出发地', placeholder: 'SHANGHAI', value: 'SHANGHAI' },
            { key: 'datetime', label: '日期 / 航班', placeholder: '2026.03.27  MU 523', value: '2026.03.27  MU523' },
            { key: 'seat', label: '座位 / 登机口', placeholder: '27A  GATE C4', value: '27A  GATE C4' },
            { key: 'mood', label: '旅行短句', placeholder: '起飞那一刻，心才落地', value: '起飞那一刻，心才落地' },
          ],
        },
        {
          id: 'travel-badge',
          name: '徽章贴纸',
          desc: '方图 1:1 · 圆形徽章 + 同心圈',
          fields: [
            { key: 'title', label: '目的地', placeholder: 'SANTORINI', value: 'SANTORINI' },
            { key: 'place', label: '出发地', placeholder: 'FROM ATHENS', value: 'FROM ATHENS' },
            { key: 'datetime', label: '日期', placeholder: '2026.06.14', value: '2026.06.14' },
            { key: 'seat', label: '编号 / 印章', placeholder: 'BADGE 026', value: 'BADGE 026' },
            { key: 'mood', label: '旅行短句', placeholder: '去过的地方，都成了底气', value: '去过的地方，都成了底气' },
          ],
        },
        {
          id: 'travel-country',
          name: '国旅票根',
          desc: '横图 4:3 · 左图 + 右存根，撕口半圆',
          fields: [
            { key: 'title', label: '国名 / 地区', placeholder: 'JAPAN', value: 'JAPAN' },
            { key: 'place', label: '目的地', placeholder: 'KYOTO, JAPAN', value: 'KYOTO, JAPAN' },
            { key: 'datetime', label: '日期', placeholder: '2026.03.28', value: '2026.03.28' },
            { key: 'seat', label: '票号', placeholder: 'NO.0001', value: 'NO.0001' },
            { key: 'mood', label: '旅行短句', placeholder: '花开的时候刚好经过', value: '花开的时候刚好经过' },
          ],
        },
        {
          id: 'travel-triptych',
          name: '三段票',
          desc: '方图 1:1 · 画框照片 + 信息 + 图案带',
          fields: [
            { key: 'title', label: '目的地', placeholder: 'CUSCO, PERU', value: 'CUSCO, PERU' },
            { key: 'place', label: '出发地', placeholder: 'FROM LIMA', value: 'FROM LIMA' },
            { key: 'datetime', label: '日期', placeholder: '2026.07.02', value: '2026.07.02' },
            { key: 'seat', label: '座位 / 票号', placeholder: '18C · NO.0003', value: '18C · NO.0003' },
            { key: 'mood', label: '旅行短句', placeholder: '走了很远，才看见自己很小', value: '走了很远，才看见自己很小' },
          ],
        },
        {
          id: 'travel-medallion',
          name: '圆形纪念章',
          desc: '圆图 1:1 · 放射边 + 同心圈',
          fields: [
            { key: 'title', label: '地名', placeholder: 'SANTORINI', value: 'SANTORINI' },
            { key: 'place', label: '副题', placeholder: 'AEGEAN SEA', value: 'AEGEAN SEA' },
            { key: 'datetime', label: '日期', placeholder: '2026.06.14', value: '2026.06.14' },
            { key: 'seat', label: '编号', placeholder: 'NO.0007', value: 'NO.0007' },
            { key: 'mood', label: '旅行短句', placeholder: '白墙蓝顶，是夏天写下的诗', value: '白墙蓝顶，是夏天写下的诗' },
          ],
        },
        {
          id: 'travel-arch',
          name: '拱门票',
          desc: '竖图 3:4 · 顶部圆拱门洞',
          fields: [
            { key: 'title', label: '地名', placeholder: 'KYOTO', value: 'KYOTO' },
            { key: 'place', label: '副题', placeholder: 'HIGASHIYAMA', value: 'HIGASHIYAMA' },
            { key: 'datetime', label: '日期', placeholder: '2026.03.28', value: '2026.03.28' },
            { key: 'seat', label: '票号', placeholder: 'NO.0001', value: 'NO.0001' },
            { key: 'mood', label: '旅行短句', placeholder: '走过鸟居，像走进另一个季节', value: '走过鸟居，像走进另一个季节' },
          ],
        },
        {
          id: 'travel-mountain',
          name: '雪山票',
          desc: '横图 4:3 · 山峰剪影 + 城市名',
          fields: [
            { key: 'title', label: '城市', placeholder: 'REYKJAVIK', value: 'REYKJAVIK' },
            { key: 'place', label: '副题', placeholder: 'ICELAND', value: 'ICELAND' },
            { key: 'datetime', label: '日期', placeholder: '2026.02.09', value: '2026.02.09' },
            { key: 'seat', label: '航班', placeholder: 'FI 306', value: 'FI 306' },
            { key: 'mood', label: '旅行短句', placeholder: '冷到发抖，也舍不得回屋', value: '冷到发抖，也舍不得回屋' },
          ],
        },
        {
          id: 'travel-patch',
          name: '布贴徽章',
          desc: '横图 16:10 · 虚线缝线 + 布纹',
          fields: [
            { key: 'title', label: '地名', placeholder: 'NAIROBI', value: 'NAIROBI' },
            { key: 'place', label: '副题', placeholder: 'KENYA · SAFARI', value: 'KENYA · SAFARI' },
            { key: 'datetime', label: '日期', placeholder: '2026.08.17', value: '2026.08.17' },
            { key: 'seat', label: '编号', placeholder: 'PATCH 008', value: 'PATCH 008' },
            { key: 'mood', label: '旅行短句', placeholder: '草原的风，吹了整整一天', value: '草原的风，吹了整整一天' },
          ],
        },
        {
          id: 'travel-keycard',
          name: '房卡',
          desc: '方图 1:1 · 磁条 + 房号 + 芯片',
          fields: [
            { key: 'title', label: '酒店名', placeholder: 'GARDEN HOTEL', value: 'GARDEN HOTEL' },
            { key: 'place', label: '住客', placeholder: 'MR. LOOMIS', value: 'MR. LOOMIS' },
            { key: 'datetime', label: '入住日期', placeholder: '2026.05.02', value: '2026.05.02' },
            { key: 'seat', label: '房间号', placeholder: '1208', value: '1208' },
            { key: 'mood', label: '旅行短句', placeholder: '门一关，城市就安静了', value: '门一关，城市就安静了' },
          ],
        },
        ...tripStyleEntries(TRAVEL_TRIPS, 'travel'),
        {
          id: 'travel-bifold',
          name: '折叠册',
          desc: '左封面满图 + 右内页 · 中缝折痕',
          fields: [
            { key: 'title', label: '地名', placeholder: '云南 · 大理', value: '云南 · 大理' },
            { key: 'place', label: '副题 / 英文', placeholder: 'DALI, YUNNAN', value: 'DALI, YUNNAN' },
            { key: 'datetime', label: '日期', placeholder: '2026.07.15', value: '2026.07.15' },
            { key: 'seat', label: '同行 / 编号', placeholder: '2 PEOPLE · NO.7', value: '2 PEOPLE · NO.7' },
            { key: 'mood', label: '旅行短句', placeholder: '苍山下的风，比空调好闻', value: '苍山下的风，比空调好闻' },
          ],
        },
        {
          id: 'travel-sleeve',
          name: '护封票夹',
          desc: '深色护封 + 底部抽出内票',
          fields: [
            { key: 'title', label: '目的地', placeholder: 'LISBON', value: 'LISBON' },
            { key: 'place', label: '标签', placeholder: 'TICKET HOLDER', value: 'TICKET HOLDER' },
            { key: 'datetime', label: '日期', placeholder: '2026.08.04', value: '2026.08.04' },
            { key: 'seat', label: '编号', placeholder: 'NO.0102', value: 'NO.0102' },
            { key: 'mood', label: '旅行短句', placeholder: '机票和心情都收在这里', value: '机票和心情都收在这里' },
          ],
        },
        {
          id: 'travel-magcard',
          name: '磁卡',
          desc: '磁条横贯 + 芯片 + 条码',
          fields: [
            { key: 'title', label: '酒店 / 品牌', placeholder: 'NORDIC INN', value: 'NORDIC INN' },
            { key: 'place', label: '住客', placeholder: 'MR. LOOMIS', value: 'MR. LOOMIS' },
            { key: 'datetime', label: '有效日期', placeholder: 'VALID 2026.01.30', value: 'VALID 2026.01.30' },
            { key: 'seat', label: '房号', placeholder: 'ROOM 0912', value: 'ROOM 0912' },
            { key: 'mood', label: '旅行短句', placeholder: '刷一下，就回到那间房', value: '刷一下，就回到那间房' },
          ],
        },
        {
          id: 'card-flower',
          name: '便签卡',
          desc: '竖图 3:4 · 粉调标线 + 花',
          fields: [
            { key: 'title', label: '标题', placeholder: '春日记录', value: '春日记录' },
            { key: 'place', label: '地点', placeholder: '京都 · 哲学之道', value: '京都 · 哲学之道' },
            { key: 'datetime', label: '日期', placeholder: '2026.03.28', value: '2026.03.28' },
            { key: 'seat', label: '编号', placeholder: 'NO.0001', value: 'NO.0001' },
            { key: 'mood', label: '备注短句', placeholder: '花瓣落在肩上，没舍得拍掉', value: '花瓣落在肩上，没舍得拍掉' },
          ],
        },
        {
          id: 'card-camera',
          name: '胶片卡',
          desc: '竖图 3:4 · 蓝调标线 + 相机',
          fields: [
            { key: 'title', label: '标题', placeholder: '路上的光', value: '路上的光' },
            { key: 'place', label: '地点', placeholder: '青海 · 茶卡', value: '青海 · 茶卡' },
            { key: 'datetime', label: '日期', placeholder: '2026.06.21', value: '2026.06.21' },
            { key: 'seat', label: '拍摄者', placeholder: 'TAKEN BY LOOMIS', value: 'TAKEN BY LOOMIS' },
            { key: 'mood', label: '事件短句', placeholder: '盐湖把天空翻了过来', value: '盐湖把天空翻了过来' },
          ],
        },
        {
          id: 'card-safari',
          name: '记录卡',
          desc: '竖图 4:5 · 橄榄绿 + 观察记录',
          fields: [
            { key: 'title', label: '标题', placeholder: 'SAFARI', value: 'SAFARI' },
            { key: 'place', label: '地点', placeholder: 'KENYA · MASAI MARA', value: 'KENYA · MASAI MARA' },
            { key: 'datetime', label: '日期', placeholder: '2026.08.17', value: '2026.08.17' },
            { key: 'seat', label: '编号', placeholder: 'NO.0042', value: 'NO.0042' },
            { key: 'mood', label: '观察记录', placeholder: '象群走过，尘土在光里飞', value: '象群走过，尘土在光里飞' },
          ],
        },
        {
          id: 'card-scallop',
          name: '游猎门票',
          desc: '横图 2.35:1 · 赭黄波浪边 + 填空栏',
          fields: [
            { key: 'title', label: '园区', placeholder: 'YELLOWSTONE', value: 'YELLOWSTONE' },
            { key: 'place', label: '向导', placeholder: 'GUIDE · ANNA', value: 'GUIDE · ANNA' },
            { key: 'datetime', label: '日期', placeholder: '2026.09.12', value: '2026.09.12' },
            { key: 'seat', label: '观察到', placeholder: 'BISON × 6', value: 'BISON × 6' },
            { key: 'mood', label: '观察记录', placeholder: '看见一头鹿，它先看见了我', value: '看见一头鹿，它先看见了我' },
          ],
        },
        {
          id: 'card-splash',
          name: '水岸票',
          desc: '横图 3:2 · 两侧中缝缺口',
          fields: [
            { key: 'title', label: '水岸', placeholder: '泸沽湖', value: '泸沽湖' },
            { key: 'place', label: '地点', placeholder: '云南 · 宁蒗', value: '云南 · 宁蒗' },
            { key: 'datetime', label: '日期', placeholder: '2026.06.21', value: '2026.06.21' },
            { key: 'seat', label: '水温 / 编号', placeholder: '18°C · NO.0006', value: '18°C · NO.0006' },
            { key: 'mood', label: '旅行短句', placeholder: '水面像一张没写完的信纸', value: '水面像一张没写完的信纸' },
          ],
        },
      ],
    },
    {
      id: 'concert',
      name: '演唱会票',
      tab: '演唱会',
      icon: 'mic-2',
      styles: [
        {
          id: 'concert-neon',
          name: '霓虹暗色',
          desc: '暗底炫光 · 夜间舞台感',
          fields: [
            { key: 'title', label: '艺人 / 巡演', placeholder: 'NOCTURNE LIVE', value: 'NOCTURNE LIVE' },
            { key: 'place', label: '场馆', placeholder: '梅奔中心 · 上海', value: '梅奔中心 · 上海' },
            { key: 'datetime', label: '日期场次', placeholder: '2026.08.16  20:00', value: '2026.08.16  20:00' },
            { key: 'seat', label: '区域座位', placeholder: '看台 B区  12排 08', value: '看台B区 12排08' },
            { key: 'mood', label: '应援短句', placeholder: '今夜星河都为你亮起', value: '今夜星河都为你亮起' },
          ],
        },
        {
          id: 'concert-fest',
          name: '音乐节票',
          desc: '全息反光 · 音符点缀',
          fields: [
            { key: 'title', label: '音乐节名', placeholder: 'RIVER SOUND FEST', value: 'RIVER SOUND FEST' },
            { key: 'place', label: '场地', placeholder: '西岸艺术中心', value: '西岸艺术中心' },
            { key: 'datetime', label: '日期', placeholder: 'DAY 02 · 2026.07.19', value: 'DAY 02 · 2026.07.19' },
            { key: 'seat', label: '通行证', placeholder: 'WEEKEND PASS', value: 'WEEKEND PASS' },
            { key: 'mood', label: '心情记录', placeholder: '耳机外的世界也在跳舞', value: '耳机外的世界也在跳舞' },
          ],
        },
        {
          id: 'concert-lanyard',
          name: '挂绳胸牌',
          desc: '工牌造型 · 顶部卡槽孔',
          fields: [
            { key: 'title', label: '艺人', placeholder: '林宥嘉', value: '林宥嘉' },
            { key: 'place', label: '场馆', placeholder: '上海体育场', value: '上海体育场' },
            { key: 'datetime', label: '日期', placeholder: '2026.11.08', value: '2026.11.08' },
            { key: 'seat', label: '区域 / 权限', placeholder: '内场 A2 · ALL ACCESS', value: '内场 A2 · ALL ACCESS' },
            { key: 'mood', label: '应援短句', placeholder: '唱到最后一首才舍得走', value: '唱到最后一首才舍得走' },
          ],
        },
        {
          id: 'concert-paper',
          name: '热敏纸票',
          desc: '黑白打印 · 扫码入场',
          fields: [
            { key: 'title', label: '演出名', placeholder: 'CITY LIGHTS TOUR', value: 'CITY LIGHTS TOUR' },
            { key: 'place', label: '场馆', placeholder: 'MAO Livehouse', value: 'MAO Livehouse' },
            { key: 'datetime', label: '时间', placeholder: '2026.10.03  20:30', value: '2026.10.03  20:30' },
            { key: 'seat', label: '票种 / 编号', placeholder: 'GA  NO.00831', value: 'GA  NO.00831' },
            { key: 'mood', label: '一句话', placeholder: '鼓点落下的瞬间，全场都亮了', value: '鼓点落下的瞬间，全场都亮了' },
          ],
        },
        {
          id: 'concert-backstage',
          name: '后台通行证',
          desc: '竖图 3:4 · 荧光斜纹',
          fields: [
            { key: 'title', label: '艺人', placeholder: 'MUSE', value: 'MUSE' },
            { key: 'place', label: '场馆', placeholder: '上海体育馆', value: '上海体育馆' },
            { key: 'datetime', label: '日期', placeholder: '2026.12.05', value: '2026.12.05' },
            { key: 'seat', label: '区域 / 权限', placeholder: 'STAGE LEFT · CREW', value: 'STAGE LEFT · CREW' },
            { key: 'mood', label: '应援短句', placeholder: '灯灭之前，都是我们的时间', value: '灯灭之前，都是我们的时间' },
          ],
        },
        {
          id: 'concert-stage',
          name: '满幅现场',
          desc: '方图 1:1 · 图文满幅叠压',
          fields: [
            { key: 'title', label: '演出名', placeholder: 'NEON NIGHTS', value: 'NEON NIGHTS' },
            { key: 'place', label: '场馆', placeholder: '回声公园 · 上海', value: '回声公园 · 上海' },
            { key: 'datetime', label: '时间', placeholder: '2026.09.12  20:00', value: '2026.09.12  20:00' },
            { key: 'seat', label: '票种', placeholder: 'STANDING · GA', value: 'STANDING · GA' },
            { key: 'mood', label: '一句话', placeholder: '那一刻，音量就是心跳', value: '那一刻，音量就是心跳' },
          ],
        },
        {
          id: 'concert-vinyl',
          name: '黑胶唱片',
          desc: '方图 1:1 · 圆形唱片构图',
          fields: [
            { key: 'title', label: '专辑 / 艺人', placeholder: '日光机场', value: '日光机场' },
            { key: 'place', label: '厂牌 / 场馆', placeholder: 'SUMMER RECORDS', value: 'SUMMER RECORDS' },
            { key: 'datetime', label: '年份 / 日期', placeholder: '2026 · SIDE A', value: '2026 · SIDE A' },
            { key: 'seat', label: '曲目 / 编号', placeholder: 'TRACK 04 · NO.0231', value: 'TRACK 04 · NO.0231' },
            { key: 'mood', label: '短句', placeholder: '循环一整晚，也不腻', value: '循环一整晚，也不腻' },
          ],
        },
        {
          id: 'concert-raffle',
          name: '抽奖联',
          desc: '大票号存根 · 放射线 + 双圆孔',
          fields: [
            { key: 'title', label: '演出名', placeholder: 'MIDNIGHT TOUR', value: 'MIDNIGHT TOUR' },
            { key: 'place', label: '场馆', placeholder: '上海大舞台', value: '上海大舞台' },
            { key: 'datetime', label: '日期', placeholder: '2026.10.31  19:30', value: '2026.10.31  19:30' },
            { key: 'seat', label: '票号 / 区域', placeholder: 'NO.008421 · B区', value: 'NO.008421 · B区' },
            { key: 'mood', label: '应援短句', placeholder: '这一晚，所有的歌都刚好', value: '这一晚，所有的歌都刚好' },
          ],
        },
        {
          id: 'concert-wristband',
          name: '手环票',
          desc: '长条手环 · 两端圆孔 + 虚线',
          fields: [
            { key: 'title', label: '演出名', placeholder: 'SUMMER WAVE', value: 'SUMMER WAVE' },
            { key: 'place', label: '场馆', placeholder: '海边的舞台', value: '海边的舞台' },
            { key: 'datetime', label: '时间', placeholder: '2026.08.22  18:00', value: '2026.08.22  18:00' },
            { key: 'seat', label: '区域 / 编号', placeholder: 'GA · WRIST 0417', value: 'GA · WRIST 0417' },
            { key: 'mood', label: '一句话', placeholder: '风吹过来，全是夏天的味道', value: '风吹过来，全是夏天的味道' },
          ],
        },
        {
          id: 'concert-stub',
          name: '演出存根',
          desc: '主票 + 条码存根 · 撕线双圆孔',
          fields: [
            { key: 'title', label: '演出名', placeholder: 'STILL LIGHT TOUR', value: 'STILL LIGHT TOUR' },
            { key: 'place', label: '场馆', placeholder: '上海梅赛德斯中心', value: '上海梅赛德斯中心' },
            { key: 'datetime', label: '日期场次', placeholder: '2026.11.21  19:30', value: '2026.11.21  19:30' },
            { key: 'seat', label: '区域座位', placeholder: '看台 C区 08排 12', value: '看台 C区 08排 12' },
            { key: 'mood', label: '应援短句', placeholder: '散场以后，耳朵里还在响', value: '散场以后，耳朵里还在响' },
          ],
        },
        {
          id: 'concert-scallop',
          name: '花边票',
          desc: '横图 16:10 · 上下花边 + 五角星',
          fields: [
            { key: 'title', label: '演出名', placeholder: 'SUMMER FEST', value: 'SUMMER FEST' },
            { key: 'place', label: '场馆', placeholder: '上海 · 梅奔中心', value: '上海 · 梅奔中心' },
            { key: 'datetime', label: '日期', placeholder: '2026.07.18  20:00', value: '2026.07.18  20:00' },
            { key: 'seat', label: '区域座位', placeholder: '内场 A区 05排 09', value: '内场 A区 05排 09' },
            { key: 'mood', label: '应援短句', placeholder: '那一晚，我们一起唱到了最后', value: '那一晚，我们一起唱到了最后' },
          ],
        },
        ...tripStyleEntries(CONCERT_TRIPS, 'concert'),
        {
          id: 'concert-badge',
          name: '挂绳工牌',
          desc: '顶部挂绳槽 · 大照片 + 大字姓名',
          fields: [
            { key: 'title', label: '姓名 / 称呼', placeholder: 'LOOMIS', value: 'LOOMIS' },
            { key: 'place', label: '身份', placeholder: 'VIP · 内场通行', value: 'VIP · 内场通行' },
            { key: 'datetime', label: '日期', placeholder: '2026.11.21', value: '2026.11.21' },
            { key: 'seat', label: '区域 / 编号', placeholder: 'A区 08排 12', value: 'A区 08排 12' },
            { key: 'mood', label: '应援短句', placeholder: '挂着它，就不会走丢', value: '挂着它，就不会走丢' },
          ],
        },
        {
          id: 'concert-note',
          name: '手写便签',
          desc: '横线纸 + 胶带 · 手写体',
          fields: [
            { key: 'title', label: '标题', placeholder: '致那一晚', value: '致那一晚' },
            { key: 'place', label: '场馆', placeholder: '成都 · 小酒馆', value: '成都 · 小酒馆' },
            { key: 'datetime', label: '日期', placeholder: '2026.06.28', value: '2026.06.28' },
            { key: 'seat', label: '座位', placeholder: '自由坐 · 012', value: '自由坐 · 012' },
            { key: 'mood', label: '手写短句', placeholder: '只唱了三首，就有人哭了', value: '只唱了三首，就有人哭了' },
          ],
        },
        {
          id: 'concert-roundtrip',
          name: '往返双联',
          desc: '去 / 返两联 · 共用一条撕线',
          fields: [
            { key: 'title', label: '演出名', placeholder: 'OLD SONGS TOUR', value: 'OLD SONGS TOUR' },
            { key: 'place', label: '场馆', placeholder: '北京工人体育馆', value: '北京工人体育馆' },
            { key: 'datetime', label: '日期', placeholder: '2026.09.05  20:00', value: '2026.09.05  20:00' },
            { key: 'seat', label: '区域座位', placeholder: '看台B 03排 07', value: '看台B 03排 07' },
            { key: 'mood', label: '应援短句', placeholder: '去的时候激动，回来的时候安静', value: '去的时候激动，回来的时候安静' },
          ],
        },
        {
          id: 'card-blacklabel',
          name: '黑底标签卡',
          desc: '竖图 3:4 · 黑色信息带 + 图标',
          fields: [
            { key: 'title', label: '演出 / 场所', placeholder: 'TEMPLE LIVE', value: 'TEMPLE LIVE' },
            { key: 'place', label: '地点', placeholder: '上海 · 育音堂', value: '上海 · 育音堂' },
            { key: 'datetime', label: '日期', placeholder: '2026.09.19  20:30', value: '2026.09.19  20:30' },
            { key: 'seat', label: '编号', placeholder: 'NO.0139', value: 'NO.0139' },
            { key: 'mood', label: '应援短句', placeholder: '小小的场地，声音却很满', value: '小小的场地，声音却很满' },
          ],
        },
        {
          id: 'card-redlabel',
          name: '红底标签卡',
          desc: '竖图 3:4 · 砖红信息带 + 图标',
          fields: [
            { key: 'title', label: '演出 / 场所', placeholder: 'SAKURA HALL', value: 'SAKURA HALL' },
            { key: 'place', label: '地点', placeholder: '东京 · 涩谷', value: '东京 · 涩谷' },
            { key: 'datetime', label: '日期', placeholder: '2026.04.04  19:00', value: '2026.04.04  19:00' },
            { key: 'seat', label: '编号', placeholder: 'NO.0248', value: 'NO.0248' },
            { key: 'mood', label: '应援短句', placeholder: '散场下着小雨，谁都没走快', value: '散场下着小雨，谁都没走快' },
          ],
        },
      ],
    },
    {
      id: 'city',
      name: '漫游',
      tab: '漫游',
      icon: 'map-pinned',
      styles: [
        {
          id: 'city-press',
          name: '报刊风',
          desc: '极简排版 · 文艺专栏',
          fields: [
            { key: 'title', label: '栏目 / 主题', placeholder: 'CITY WALK VOL.09', value: 'CITY WALK VOL.09' },
            { key: 'place', label: '城市路线', placeholder: '苏州河 · 苏州河畔', value: '苏州河 · 苏州河畔' },
            { key: 'datetime', label: '日期', placeholder: 'Sunday · 2026.04.06', value: 'Sunday · 2026.04.06' },
            { key: 'mood', label: '短评', placeholder: '慢下来，街角都是故事', value: '慢下来，街角都是故事' },
          ],
        },
        {
          id: 'city-capsule',
          name: '胶囊卡片',
          desc: '咖啡街景 · 圆角胶囊',
          fields: [
            { key: 'title', label: '店名 / 地点', placeholder: 'Afternoon Light Café', value: 'Afternoon Light Café' },
            { key: 'place', label: '街区', placeholder: '武康路 · 上海', value: '武康路 · 上海' },
            { key: 'datetime', label: '到访', placeholder: '2026.04.02  15:20', value: '2026.04.02  15:20' },
            { key: 'seat', label: '桌号 / 标签', placeholder: '窗边 · 美式', value: '窗边 · 美式' },
            { key: 'mood', label: '心情', placeholder: '阳光刚好，不想离开', value: '阳光刚好，不想离开' },
          ],
        },
        {
          id: 'city-map',
          name: '地图打卡',
          desc: '墨绿网格 · 定位图钉',
          fields: [
            { key: 'title', label: '地点', placeholder: '愚园路 · 梧桐区', value: '愚园路 · 梧桐区' },
            { key: 'place', label: '路线', placeholder: 'WALK 03 · 3.2 KM', value: 'WALK 03 · 3.2 KM' },
            { key: 'datetime', label: '坐标 / 日期', placeholder: '31.22N 121.44E', value: '31.22N 121.44E' },
            { key: 'seat', label: '打卡点', placeholder: '老洋房 · 邮局 · 面包店', value: '老洋房 · 邮局 · 面包店' },
            { key: 'mood', label: '短评', placeholder: '今天的风，很像小时候', value: '今天的风，很像小时候' },
          ],
        },
        {
          id: 'city-bookmark',
          name: '书签长条',
          desc: '窄长造型 · 顶部圆孔',
          fields: [
            { key: 'title', label: '主题', placeholder: '秋日阅读计划', value: '秋日阅读计划' },
            { key: 'place', label: '地点', placeholder: '多抓鱼书店 · 上海', value: '多抓鱼书店 · 上海' },
            { key: 'datetime', label: '日期', placeholder: '2026.10.18', value: '2026.10.18' },
            { key: 'seat', label: '标签', placeholder: 'READING DAY 07', value: 'READING DAY 07' },
            { key: 'mood', label: '摘抄 / 心得', placeholder: '书页翻动，时间就慢下来', value: '书页翻动，时间就慢下来' },
          ],
        },
        {
          id: 'city-square',
          name: '方卡速写',
          desc: '方图 1:1 · 极简留白',
          fields: [
            { key: 'title', label: '主题', placeholder: '街角速写', value: '街角速写' },
            { key: 'place', label: '地点', placeholder: '安福路 · 上海', value: '安福路 · 上海' },
            { key: 'datetime', label: '日期', placeholder: '2026.05.06  16:00', value: '2026.05.06  16:00' },
            { key: 'mood', label: '短评', placeholder: '只是路过，却站了很久', value: '只是路过，却站了很久' },
          ],
        },
        {
          id: 'city-street',
          name: '街景长幅',
          desc: '横图 21:9 · 街拍长幅',
          fields: [
            { key: 'title', label: '街道 / 地点', placeholder: '衡山路 · 梧桐道', value: '衡山路 · 梧桐道' },
            { key: 'place', label: '路线', placeholder: 'WALK 08 · 2.6 KM', value: 'WALK 08 · 2.6 KM' },
            { key: 'datetime', label: '日期', placeholder: '2026.11.02', value: '2026.11.02' },
            { key: 'seat', label: '打卡点', placeholder: '旧书店 · 面包房 · 桥洞', value: '旧书店 · 面包房 · 桥洞' },
            { key: 'mood', label: '短评', placeholder: '走慢一点，城市才肯说话', value: '走慢一点，城市才肯说话' },
          ],
        },
        {
          id: 'city-zine',
          name: '独立杂志',
          desc: '竖图 4:5 · 米白排版',
          fields: [
            { key: 'title', label: '专题', placeholder: '秋日散步特辑', value: '秋日散步特辑' },
            { key: 'place', label: '地点', placeholder: '上海 · 徐汇', value: '上海 · 徐汇' },
            { key: 'datetime', label: '日期', placeholder: '2026.10.24', value: '2026.10.24' },
            { key: 'seat', label: '期号', placeholder: 'ISSUE 12', value: 'ISSUE 12' },
            { key: 'mood', label: '短评', placeholder: '城市最好的部分，都在走路时出现', value: '城市最好的部分，都在走路时出现' },
          ],
        },
        {
          id: 'city-transit',
          name: '城际票',
          desc: '网格底 · 中缝虚线与双圆孔',
          fields: [
            { key: 'title', label: '到达站', placeholder: '苏州', value: '苏州' },
            { key: 'place', label: '出发站', placeholder: '上海站', value: '上海站' },
            { key: 'datetime', label: '车次 / 时间', placeholder: 'D3126  2026.04.11 10:12', value: 'D3126  2026.04.11 10:12' },
            { key: 'seat', label: '座位 / 车厢', placeholder: '05车 09A', value: '05车 09A' },
            { key: 'mood', label: '旅途心情', placeholder: '一小时的车程，刚好听完一张专辑', value: '一小时的车程，刚好听完一张专辑' },
          ],
        },
        {
          id: 'city-exhibit',
          name: '展览门票',
          desc: '顶部圆孔 · 底部虚线撕口',
          fields: [
            { key: 'title', label: '展览名', placeholder: '光与影：印象派特展', value: '光与影：印象派特展' },
            { key: 'place', label: '场馆', placeholder: '西岸美术馆 · 2F', value: '西岸美术馆 · 2F' },
            { key: 'datetime', label: '日期时间', placeholder: '2026.09.14  14:00', value: '2026.09.14  14:00' },
            { key: 'seat', label: '票种 / 编号', placeholder: '成人票 NO.EX2210', value: '成人票 NO.EX2210' },
            { key: 'mood', label: '观展短评', placeholder: '站在画前，时间变得很慢', value: '站在画前，时间变得很慢' },
          ],
        },
        {
          id: 'city-notice',
          name: '公告海报',
          desc: '横图 4:3 · 顶部图钉 + 双钉孔',
          fields: [
            { key: 'title', label: '标题', placeholder: '梧桐区散步通知', value: '梧桐区散步通知' },
            { key: 'place', label: '地点', placeholder: '上海 · 衡复风貌区', value: '上海 · 衡复风貌区' },
            { key: 'datetime', label: '日期', placeholder: '2026.10.11  Sunday', value: '2026.10.11  Sunday' },
            { key: 'seat', label: '编号 / 落款', placeholder: 'NO.07 · 街道办', value: 'NO.07 · 街道办' },
            { key: 'mood', label: '正文短句', placeholder: '今秋最短的一条路，值得走二十分钟', value: '今秋最短的一条路，值得走二十分钟' },
          ],
        },
        ...shapeStyleEntries(CITY_SHAPES),
        {
          id: 'city-collage',
          name: '票根墙',
          desc: '三张错位叠放的小票',
          fields: [
            { key: 'title', label: '地名', placeholder: '武康路', value: '武康路' },
            { key: 'place', label: '副题', placeholder: 'WUKANG RD', value: 'WUKANG RD' },
            { key: 'datetime', label: '日期', placeholder: '2026.09.19', value: '2026.09.19' },
            { key: 'seat', label: '编号', placeholder: 'NO.02', value: 'NO.02' },
            { key: 'mood', label: '漫游短句', placeholder: '梧桐把整条路盖成了一间屋子', value: '梧桐把整条路盖成了一间屋子' },
          ],
        },
        {
          id: 'city-gatecard',
          name: '门禁卡',
          desc: '竖版 · 挂孔 + 芯片 + 条码',
          fields: [
            { key: 'title', label: '姓名', placeholder: 'LOOMIS', value: 'LOOMIS' },
            { key: 'place', label: '通行范围', placeholder: 'ALL ACCESS', value: 'ALL ACCESS' },
            { key: 'datetime', label: '签发日期', placeholder: '2026.10.02', value: '2026.10.02' },
            { key: 'seat', label: '卡号', placeholder: 'NO.0088', value: 'NO.0088' },
            { key: 'mood', label: '漫游短句', placeholder: '刷一下，就进了这座城', value: '刷一下，就进了这座城' },
          ],
        },
        {
          id: 'card-museum',
          name: '展签卡',
          desc: '竖图 3:4 · 深蓝挂绳段 + 米白信息段',
          fields: [
            { key: 'title', label: '展名', placeholder: '光影留声', value: '光影留声' },
            { key: 'place', label: '展馆', placeholder: '上海当代艺术博物馆', value: '上海当代艺术博物馆' },
            { key: 'datetime', label: '日期', placeholder: '2026.05.18', value: '2026.05.18' },
            { key: 'seat', label: '时间 / 票号', placeholder: '14:00 · NO.0217', value: '14:00 · NO.0217' },
            { key: 'mood', label: '观展短评', placeholder: '站在画前，时间变得很慢', value: '站在画前，时间变得很慢' },
          ],
        },
        {
          id: 'card-gilt',
          name: '鎏金匾额',
          desc: '竖图 4:5 · 金框卷草 + 匾面刻字',
          fields: [
            { key: 'title', label: '展名', placeholder: 'EXHIBITION TITLE', value: '光影留声' },
            { key: 'place', label: '策展人', placeholder: 'CURATOR', value: 'CURATOR · 林一' },
            { key: 'datetime', label: '日期', placeholder: '2026.05.18', value: '2026.05.18' },
            { key: 'seat', label: '场馆', placeholder: 'VENUE', value: '上海当代艺术博物馆' },
            { key: 'mood', label: '观展短评', placeholder: '站在画前，时间变得很慢', value: '站在画前，时间变得很慢' },
          ],
        },
        {
          id: 'card-round',
          name: '圆形徽票',
          desc: '圆图 1:1 · 放射边 + 同心圈',
          fields: [
            { key: 'title', label: '地名', placeholder: '外滩', value: '外滩' },
            { key: 'place', label: '副题', placeholder: 'THE BUND', value: 'THE BUND' },
            { key: 'datetime', label: '日期', placeholder: '2026.10.02', value: '2026.10.02' },
            { key: 'seat', label: '编号', placeholder: 'NO.01', value: 'NO.01' },
            { key: 'mood', label: '漫游短句', placeholder: '灯光落在江面上，像另一座城', value: '灯光落在江面上，像另一座城' },
          ],
        },
        {
          id: 'card-hexcolor',
          name: '彩色六边',
          desc: '横图 16:10 · 拼色几何 + 内嵌白卡',
          fields: [
            { key: 'title', label: '地名', placeholder: '里约', value: '里约' },
            { key: 'place', label: '副题', placeholder: 'RIO DE JANEIRO', value: 'RIO DE JANEIRO' },
            { key: 'datetime', label: '日期', placeholder: '2026.12.28', value: '2026.12.28' },
            { key: 'seat', label: '编号', placeholder: 'BLOCO 0012', value: 'BLOCO 0012' },
            { key: 'mood', label: '漫游短句', placeholder: '街上全是颜色和鼓声', value: '街上全是颜色和鼓声' },
          ],
        },
      ],
    },
    {
      id: 'stamp',
      name: '邮票',
      tab: '邮票',
      icon: 'stamp',
      styles: [
        {
          id: 'stamp-classic',
          name: '经典邮票',
          desc: '竖图 4:5 · 四边齿孔 + 面值',
          fields: [
            { key: 'title', label: '主题', placeholder: '苏州园林', value: '苏州园林' },
            { key: 'place', label: '副题 / 地点', placeholder: 'SUZHOU GARDEN', value: 'SUZHOU GARDEN' },
            { key: 'datetime', label: '发行 / 日期', placeholder: '2026.05.18', value: '2026.05.18' },
            { key: 'seat', label: '面值 / 编号', placeholder: '120分  NO.2026-07', value: '120分  NO.2026-07' },
            { key: 'mood', label: '一句话', placeholder: '把一整个园子，压进方寸之间', value: '把一整个园子，压进方寸之间' },
          ],
        },
        {
          id: 'stamp-sheet',
          name: '小全张',
          desc: '方图 1:1 · 四枚联印 + 齿孔',
          fields: [
            { key: 'title', label: '主题', placeholder: '四季 · 秋', value: '四季 · 秋' },
            { key: 'place', label: '副题', placeholder: 'AUTUMN SET', value: 'AUTUMN SET' },
            { key: 'datetime', label: '发行日期', placeholder: '2026.09.23', value: '2026.09.23' },
            { key: 'seat', label: '编号', placeholder: 'SPECIMEN 04', value: 'SPECIMEN 04' },
            { key: 'mood', label: '题词', placeholder: '一叶落地，秋天就算数了', value: '一叶落地，秋天就算数了' },
          ],
        },
        {
          id: 'stamp-postmark',
          name: '邮戳明信片',
          desc: '横图 16:10 · 圆形邮戳 + 波浪注销',
          fields: [
            { key: 'title', label: '地名', placeholder: '鼓浪屿', value: '鼓浪屿' },
            { key: 'place', label: '寄自', placeholder: 'FROM XIAMEN', value: 'FROM XIAMEN' },
            { key: 'datetime', label: '日期', placeholder: '2026.03.30', value: '2026.03.30' },
            { key: 'seat', label: '邮编号', placeholder: 'POST 361002', value: 'POST 361002' },
            { key: 'mood', label: '背面短笺', placeholder: '海风把信纸吹得哗哗响', value: '海风把信纸吹得哗哗响' },
          ],
        },
        {
          id: 'stamp-firstday',
          name: '首日封',
          desc: '方图 1:1 · 右上邮票 + 首日邮戳',
          fields: [
            { key: 'title', label: '主题', placeholder: '中国航天', value: '中国航天' },
            { key: 'place', label: '寄件人', placeholder: 'FROM 酒泉', value: 'FROM 酒泉' },
            { key: 'datetime', label: '首发日期', placeholder: '2026.04.24', value: '2026.04.24' },
            { key: 'seat', label: '编号 / 邮资', placeholder: 'FDC 2026-03', value: 'FDC 2026-03' },
            { key: 'mood', label: '题记', placeholder: '第一次抬头看天，是在写信的时候', value: '第一次抬头看天，是在写信的时候' },
          ],
        },
        {
          id: 'stamp-wax',
          name: '火漆封缄',
          desc: '横图 4:3 · 火漆印章 + 上下锯齿',
          fields: [
            { key: 'title', label: '主题', placeholder: '致十年后的自己', value: '致十年后的自己' },
            { key: 'place', label: '封缄人', placeholder: 'SEALED BY ME', value: 'SEALED BY ME' },
            { key: 'datetime', label: '日期', placeholder: '2026.12.31', value: '2026.12.31' },
            { key: 'seat', label: '编号', placeholder: 'NO.0001', value: 'NO.0001' },
            { key: 'mood', label: '封缄短句', placeholder: '有些话，得封起来才说得出口', value: '有些话，得封起来才说得出口' },
          ],
        },
        {
          id: 'stamp-pair',
          name: '双连票',
          desc: '两枚方票相连 · 中缝齿孔 + 两枚面值',
          fields: [
            { key: 'title', label: '主题', placeholder: '西湖双峰', value: '西湖双峰' },
            { key: 'place', label: '副题', placeholder: 'TWO PEAKS', value: 'TWO PEAKS' },
            { key: 'datetime', label: '发行日期', placeholder: '2026.07.08', value: '2026.07.08' },
            { key: 'seat', label: '编号 / 面值', placeholder: '120分  NO.2026-11', value: '120分  NO.2026-11' },
            { key: 'mood', label: '一句话', placeholder: '一半给山，一半给湖', value: '一半给山，一半给湖' },
          ],
        },
        {
          id: 'stamp-four',
          name: '四方连',
          desc: '2×2 四枚联印 · 十字齿孔 + 双图',
          fields: [
            { key: 'title', label: '主题', placeholder: '四季 · 春', value: '四季 · 春' },
            { key: 'place', label: '副题', placeholder: 'SPRING SET', value: 'SPRING SET' },
            { key: 'datetime', label: '发行日期', placeholder: '2026.03.20', value: '2026.03.20' },
            { key: 'seat', label: '编号', placeholder: 'BLOCK 01', value: 'BLOCK 01' },
            { key: 'mood', label: '题词', placeholder: '风一软，花就开了', value: '风一软，花就开了' },
          ],
        },
        {
          id: 'stamp-miniature',
          name: '小型张',
          desc: '横图 4:3 · 大图 + 宽边纸编号',
          fields: [
            { key: 'title', label: '主题', placeholder: '黄山云海', value: '黄山云海' },
            { key: 'place', label: '副题', placeholder: 'HUANG SHAN', value: 'HUANG SHAN' },
            { key: 'datetime', label: '发行日期', placeholder: '2026.08.15', value: '2026.08.15' },
            { key: 'seat', label: '边纸编号', placeholder: 'M 2026-09', value: 'M 2026-09' },
            { key: 'mood', label: '一句话', placeholder: '云把山藏起来，又还回来', value: '云把山藏起来，又还回来' },
          ],
        },
        {
          id: 'stamp-panorama',
          name: '全景邮票',
          desc: '宽图 3:1 · 满幅风景 + 底部信息带',
          fields: [
            { key: 'title', label: '主题', placeholder: '川西雪山', value: '川西雪山' },
            { key: 'place', label: '副题 / 地点', placeholder: 'WEST SICHUAN', value: 'WEST SICHUAN' },
            { key: 'datetime', label: '日期', placeholder: '2026.10.05', value: '2026.10.05' },
            { key: 'seat', label: '编号', placeholder: 'PANO 012', value: 'PANO 012' },
            { key: 'mood', label: '一句话', placeholder: '一整个下午，山都在发光', value: '一整个下午，山都在发光' },
          ],
        },
        {
          id: 'stamp-portrait',
          name: '人物邮票',
          desc: '竖图 3:4 · 椭圆肖像 + 纪年表',
          fields: [
            { key: 'title', label: '人物', placeholder: '林徽因', value: '林徽因' },
            { key: 'place', label: '副题', placeholder: 'ARCHITECT', value: 'ARCHITECT' },
            { key: 'datetime', label: '生卒 / 日期', placeholder: '1904 — 1955', value: '1904 — 1955' },
            { key: 'seat', label: '面值 / 编号', placeholder: '150分  NO.2026-15', value: '150分  NO.2026-15' },
            { key: 'mood', label: '评语', placeholder: '你是人间四月天', value: '你是人间四月天' },
          ],
        },
        {
          id: 'stamp-airmail',
          name: '航空邮票',
          desc: '方图 1:1 · 红蓝航空纹 + 飞机标识',
          fields: [
            { key: 'title', label: '主题', placeholder: '飞越秦岭', value: '飞越秦岭' },
            { key: 'place', label: '航线', placeholder: 'XI\'AN → LHASA', value: 'XI\'AN → LHASA' },
            { key: 'datetime', label: '航班 / 日期', placeholder: 'CA4402  2026.05.09', value: 'CA4402  2026.05.09' },
            { key: 'seat', label: '邮资', placeholder: 'A.R. 220分', value: 'A.R. 220分' },
            { key: 'mood', label: '一句话', placeholder: '云在窗下，山在云上', value: '云在窗下，山在云上' },
          ],
        },
        {
          id: 'stamp-vintage',
          name: '复古邮票',
          desc: '做旧泛黄 · 两侧撕口 + 波浪注销',
          fields: [
            { key: 'title', label: '主题', placeholder: '民国老邮局', value: '民国老邮局' },
            { key: 'place', label: '副题', placeholder: 'OLD POST', value: 'OLD POST' },
            { key: 'datetime', label: '年份', placeholder: '1936', value: '1936' },
            { key: 'seat', label: '编号 / 面值', placeholder: 'CUSTOMS 5c', value: 'CUSTOMS 5c' },
            { key: 'mood', label: '一句话', placeholder: '信走了半年，人走了一辈子', value: '信走了半年，人走了一辈子' },
          ],
        },
        {
          id: 'stamp-night',
          name: '荧光邮票',
          desc: '竖图 4:5 · 深底冷光 + 金粉',
          fields: [
            { key: 'title', label: '主题', placeholder: '极光之夜', value: '极光之夜' },
            { key: 'place', label: '副题 / 地点', placeholder: 'TROMSØ', value: 'TROMSØ' },
            { key: 'datetime', label: '日期', placeholder: '2026.11.21', value: '2026.11.21' },
            { key: 'seat', label: '编号 / 面值', placeholder: 'UV 80分  NO.31', value: 'UV 80分  NO.31' },
            { key: 'mood', label: '一句话', placeholder: '绿光落在雪上，像有人轻声说话', value: '绿光落在雪上，像有人轻声说话' },
          ],
        },
        {
          id: 'stamp-tri',
          name: '三角邮票',
          desc: '三角形 · 经典开普异形票',
          fields: [
            { key: 'title', label: '主题', placeholder: '好望角', value: '好望角' },
            { key: 'place', label: '副题', placeholder: 'CAPE OF GOOD HOPE', value: 'CAPE OF GOOD HOPE' },
            { key: 'datetime', label: '日期 / 年份', placeholder: '1853', value: '1853' },
            { key: 'seat', label: '面值', placeholder: '4d  RED', value: '4d  RED' },
            { key: 'mood', label: '一句话', placeholder: '三角形的信，寄给远方', value: '三角形的信，寄给远方' },
          ],
        },
        {
          id: 'stamp-round',
          name: '圆形邮票',
          desc: '圆图 1:1 · 环形齿孔 + 圆框肖像',
          fields: [
            { key: 'title', label: '主题', placeholder: '土星', value: '土星' },
            { key: 'place', label: '副题', placeholder: 'SATURN', value: 'SATURN' },
            { key: 'datetime', label: '日期', placeholder: '2026.02.14', value: '2026.02.14' },
            { key: 'seat', label: '面值 / 编号', placeholder: '200分  NO.2026-02', value: '200分  NO.2026-02' },
            { key: 'mood', label: '一句话', placeholder: '把光环戴在手指上', value: '把光环戴在手指上' },
          ],
        },
        {
          id: 'stamp-hex',
          name: '六边邮票',
          desc: '六边形 · 幻彩底 + 异形裁切',
          fields: [
            { key: 'title', label: '主题', placeholder: '蜂巢', value: '蜂巢' },
            { key: 'place', label: '副题', placeholder: 'HONEYCOMB', value: 'HONEYCOMB' },
            { key: 'datetime', label: '日期', placeholder: '2026.06.21', value: '2026.06.21' },
            { key: 'seat', label: '面值 / 编号', placeholder: '90分  NO.2026-18', value: '90分  NO.2026-18' },
            { key: 'mood', label: '一句话', placeholder: '六边里装满了整个夏天', value: '六边里装满了整个夏天' },
          ],
        },
        {
          id: 'stamp-tab',
          name: '附捐邮票',
          desc: '横图 5:4 · 主票 + 下附签',
          fields: [
            { key: 'title', label: '主题', placeholder: '希望小学', value: '希望小学' },
            { key: 'place', label: '副题', placeholder: 'HOPE PROJECT', value: 'HOPE PROJECT' },
            { key: 'datetime', label: '日期', placeholder: '2026.09.01', value: '2026.09.01' },
            { key: 'seat', label: '面值 / 附捐', placeholder: '120分 + 60分', value: '120分 + 60分' },
            { key: 'mood', label: '附签短句', placeholder: '多出的那一分，去了更远的地方', value: '多出的那一分，去了更远的地方' },
          ],
        },
        ...stampStyleEntries(STAMP_ISSUES),
      ],
    },
  ];

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function photoBox(photoUrl, extraClass, slot) {
    const si = slot == null ? 0 : slot;
    return `<div class="photo-frame ${extraClass || ''}" data-photo-slot="${si}">
      <img class="photo-img" src="${esc(photoUrl)}" alt="票面照片" draggable="false" />
      <div class="fx-user-slot fx-user-slot--photo" data-fx-slot="photo" aria-hidden="true"></div>
    </div>`;
  }

  // 未上传照片时加 is-noimg，模板可据此隐藏占位图或换排版
  function photoClass(photoUrl) {
    return photoUrl ? '' : 'is-noimg';
  }

  const renderers = {
    'cinema-tear'(d, photo) {
      return `<article class="tk tk-cinema-tear paper">
        <span class="bg-layer bg-dots" aria-hidden="true"></span>
        ${photoBox(photo)}
        <div class="tk-meta">
          <div class="tk-row top">
            <span class="tk-label"><i data-lucide="film"></i> CINEMA</span>
            <span class="tk-code">${esc(d.seat)}</span>
          </div>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place"><i data-lucide="map-pin"></i> ${esc(d.place)}</p>
          <p class="tk-time">${esc(d.datetime)}</p>
          <p class="tk-mood">「${esc(d.mood)}」</p>
        </div>
        <div class="tear-line" aria-hidden="true"></div>
        <aside class="tk-stub">
          <span class="stub-no">ADMIT ONE</span>
          <span class="stub-title">${esc(d.title)}</span>
          <span class="stub-seat">${esc(d.seat)}</span>
          <span class="stub-date">${esc(d.datetime)}</span>
          <div class="stub-bars" aria-hidden="true"></div>
        </aside>
      </article>`;
    },

    'cinema-polaroid'(d, photo) {
      return `<article class="tk tk-cinema-polaroid paper">
        <span class="bg-layer bg-grid" aria-hidden="true"></span>
        ${photoBox(photo, 'polaroid-shot')}
        <div class="pola-foot">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)} · ${esc(d.datetime)}</p>
          <p class="tk-mood handwritten">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'cinema-ovation'(d, photo) {
      return `<article class="tk tk-cinema-ovation">
        <header class="ov-head">
          <span class="ov-hall">IMAX</span>
          <span class="ov-tag">PREMIERE</span>
        </header>
        ${photoBox(photo, 'ov-photo')}
        <div class="ov-body">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place"><i data-lucide="map-pin"></i> ${esc(d.place)}</p>
          <div class="ov-seat">
            <span class="ov-seat-label">SEAT</span>
            <b>${esc(d.seat)}</b>
          </div>
          <div class="ov-foot">
            <span>${esc(d.datetime)}</span>
            <span>${esc(d.mood)}</span>
          </div>
        </div>
      </article>`;
    },

    'cinema-filmstrip'(d, photo) {
      return `<article class="tk tk-cinema-filmstrip">
        ${photoBox(photo, 'fs-photo')}
        <div class="fs-caption">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <p class="tk-time">${esc(d.datetime)} · ${esc(d.seat)}</p>
          <p class="tk-mood">「${esc(d.mood)}」</p>
        </div>
        <div class="fs-perf" aria-hidden="true"></div>
      </article>`;
    },

    'cinema-poster'(d, photo) {
      return `<article class="tk tk-cinema-poster">
        <div class="po-frame">
          ${photoBox(photo, 'po-photo')}
          <div class="po-overlay">
            <span class="po-kicker">NOW SHOWING</span>
            <h3 class="tk-title">${esc(d.title)}</h3>
            <p class="tk-place">${esc(d.place)}</p>
          </div>
        </div>
        <div class="po-body">
          <div class="po-rows">
            <div><span>SHOWTIME</span><b>${esc(d.datetime)}</b></div>
            <div><span>HALL / SEAT</span><b>${esc(d.seat)}</b></div>
          </div>
          <p class="tk-mood">「${esc(d.mood)}」</p>
        </div>
      </article>`;
    },

    'cinema-cinescope'(d, photo) {
      return `<article class="tk tk-cinema-cinescope">
        <header class="cs-head">
          <span>CINEMASCOPE 2.39:1</span>
          <span class="cs-rec">REC</span>
        </header>
        ${photoBox(photo, 'cs-photo')}
        <div class="cs-body">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="cs-row"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'cinema-double'(d, photo) {
      return `<article class="tk tk-cinema-double">
        <div class="db-left">${photoBox(photo, 'db-photo')}</div>
        <div class="db-right">
          <span class="db-tag">ADMIT ONE</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <p class="db-line">${esc(d.datetime)}</p>
          <p class="db-seat">${esc(d.seat)}</p>
          <p class="tk-mood">「${esc(d.mood)}」</p>
        </div>
      </article>`;
    },

    'cinema-stubpair'(d, photo) {
      return `<article class="tk tk-cinema-stubpair">
        <div class="sp-main">
          <span class="sp-tag">ADMIT ONE</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place"><i data-lucide="map-pin"></i> ${esc(d.place)}</p>
          <p class="sp-line">${esc(d.datetime)}</p>
          <p class="sp-seat">${esc(d.seat)}</p>
          <p class="tk-mood">「${esc(d.mood)}」</p>
        </div>
        <div class="sp-perf" aria-hidden="true"></div>
        <div class="sp-stub">
          ${photoBox(photo, 'sp-photo')}
          <span class="sp-no">NO.A204</span>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'cinema-redclassic'(d, photo) {
      return `<article class="tk tk-cinema-redclassic">
        <div class="rc-frame">
          <span class="rc-brand">CINEMA TICKET</span>
          ${photoBox(photo, 'rc-photo')}
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="rc-row"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
          <p class="tk-mood">「${esc(d.mood)}」</p>
        </div>
        <span class="fx-layer fx-goldlines" aria-hidden="true"></span>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
        <span class="fx-layer fx-vignette" aria-hidden="true"></span>
      </article>`;
    },

    'travel-board'(d, photo) {
      return `<article class="tk tk-travel-board paper">
        <header class="board-head">
          <div>
            <span class="board-tag"><i data-lucide="plane"></i> BOARDING PASS</span>
            <p class="board-route"><strong>${esc(d.place)}</strong><i data-lucide="move-right"></i><strong>${esc(d.title)}</strong></p>
          </div>
          <div class="board-stamp">CHECKED</div>
        </header>
        <div class="board-body">
          ${photoBox(photo)}
          <div class="board-info">
            <div class="info-grid">
              <div><span>DATE / FLIGHT</span><b>${esc(d.datetime)}</b></div>
              <div><span>SEAT / GATE</span><b>${esc(d.seat)}</b></div>
            </div>
            <p class="tk-mood">${esc(d.mood)}</p>
            <div class="flight-path" aria-hidden="true"></div>
          </div>
        </div>
      </article>`;
    },

    'travel-postcard'(d, photo) {
      return `<article class="tk tk-travel-postcard paper">
        <span class="bg-layer bg-chevron" aria-hidden="true"></span>
        ${photoBox(photo, 'pc-photo')}
        <div class="pc-panel">
          <div class="pc-stamp"><i data-lucide="mail"></i><span>POST</span></div>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <p class="tk-time">${esc(d.datetime)}</p>
          <p class="tk-mood handwritten">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'travel-tag'(d, photo) {
      return `<article class="tk tk-travel-tag">
        <header class="tag-head">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
        </header>
        <div class="tag-body">
          ${photoBox(photo)}
          <div class="tag-rows">
            <div><span>DATE / FLIGHT</span><b>${esc(d.datetime)}</b></div>
            <div><span>SEAT / BAG</span><b>${esc(d.seat)}</b></div>
          </div>
          <p class="tag-mood">「${esc(d.mood)}」</p>
        </div>
      </article>`;
    },

    'travel-rail'(d, photo) {
      return `<article class="tk tk-travel-rail">
        <header class="rail-head">
          <span class="rail-city"><strong>${esc(d.place)}</strong><i data-lucide="move-right"></i><strong>${esc(d.title)}</strong></span>
          <span class="rail-tag">TICKET</span>
        </header>
        <div class="rail-body">
          ${photoBox(photo)}
          <div class="rail-grid">
            <div><span>TRAIN / TIME</span><b>${esc(d.datetime)}</b></div>
            <div><span>SEAT / GATE</span><b>${esc(d.seat)}</b></div>
          </div>
          <div class="rail-mag" aria-hidden="true"></div>
          <div class="rail-foot">
            <p class="tk-mood">${esc(d.mood)}</p>
            <div class="rail-qr" aria-hidden="true"></div>
          </div>
        </div>
      </article>`;
    },

    'travel-passport'(d, photo) {
      return `<article class="tk tk-travel-passport">
        <header class="pp-head">
          <span class="pp-brand">PASSPORT</span>
          <span class="pp-no">NO.20260924</span>
        </header>
        <div class="pp-body">
          <div class="pp-photo-wrap">
            ${photoBox(photo, 'pp-photo')}
            <span class="pp-stamp">APPROVED</span>
          </div>
          <div class="pp-fields">
            <div><span>DESTINATION</span><b>${esc(d.title)}</b></div>
            <div><span>ISSUED AT</span><b>${esc(d.place)}</b></div>
            <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
            <div><span>ENTRY</span><b>${esc(d.seat)}</b></div>
          </div>
        </div>
        <p class="pp-mood">「${esc(d.mood)}」</p>
      </article>`;
    },

    'travel-aerial'(d, photo) {
      return `<article class="tk tk-travel-aerial">
        <span class="bg-layer bg-dots" aria-hidden="true"></span>
        <div class="ae-shot">
          ${photoBox(photo, 'ae-photo')}
          <span class="ae-badge">16:9</span>
        </div>
        <div class="ae-copy">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <p class="ae-date">${esc(d.datetime)}</p>
          <p class="tk-mood handwritten">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'travel-luggage'(d, photo) {
      return `<article class="tk tk-travel-luggage">
        ${photoBox(photo, 'lg-photo')}
        <div class="lg-body">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="lg-row"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
          <p class="tk-mood">${esc(d.mood)}</p>
          <div class="lg-bar" aria-hidden="true"></div>
        </div>
      </article>`;
    },

    'travel-voucher'(d, photo) {
      return `<article class="tk tk-travel-voucher">
        <div class="vc-inner">
          <div class="vc-head">
            <span class="vc-brand">TRAVEL VOUCHER</span>
            <span class="vc-brand">ONE WAY</span>
          </div>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="vc-grid">
            <div><span>DATE / FLIGHT</span><b>${esc(d.datetime)}</b></div>
            <div><span>SEAT / CLASS</span><b>${esc(d.seat)}</b></div>
          </div>
          ${photoBox(photo, 'vc-photo')}
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <span class="fx-layer fx-grain" aria-hidden="true"></span>
      </article>`;
    },

    'travel-boardvintage'(d, photo) {
      return `<article class="tk tk-travel-boardvintage">
        <header class="bv-head">
          <span class="bv-brand">BOARDING PASS</span>
          <span class="bv-class">ECONOMY</span>
        </header>
        <p class="bv-route"><strong>${esc(d.place)}</strong><i data-lucide="move-right"></i><strong>${esc(d.title)}</strong></p>
        ${photoBox(photo)}
        <div class="bv-grid">
          <div><span>DATE / FLIGHT</span><b>${esc(d.datetime)}</b></div>
          <div><span>SEAT / GATE</span><b>${esc(d.seat)}</b></div>
        </div>
        <p class="tk-mood">${esc(d.mood)}</p>
        <span class="fx-layer fx-grain" aria-hidden="true"></span>
      </article>`;
    },

    'concert-neon'(d, photo) {
      return `<article class="tk tk-concert-neon">
        <div class="neon-glow" aria-hidden="true"></div>
        ${photoBox(photo)}
        <div class="neon-body">
          <span class="neon-tag"><i data-lucide="sparkles"></i> LIVE SHOW</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place"><i data-lucide="map-pin"></i> ${esc(d.place)}</p>
          <div class="neon-row">
            <span>${esc(d.datetime)}</span>
            <span>${esc(d.seat)}</span>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'concert-fest'(d, photo) {
      return `<article class="tk tk-concert-fest paper">
        <div class="holo" aria-hidden="true"></div>
        <div class="fest-top">
          <i data-lucide="music-2"></i>
          <span>FESTIVAL PASS</span>
          <i data-lucide="audio-lines"></i>
        </div>
        ${photoBox(photo)}
        <div class="fest-body">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="fest-chips">
            <span>${esc(d.datetime)}</span>
            <span>${esc(d.seat)}</span>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'concert-lanyard'(d, photo) {
      return `<article class="tk tk-concert-lanyard">
        <div class="lanyard-slot" aria-hidden="true"></div>
        <div class="lanyard-strap" aria-hidden="true"></div>
        <header class="lanyard-head">
          <span class="lanyard-role">ALL ACCESS</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
        </header>
        ${photoBox(photo, 'lanyard-photo')}
        <div class="lanyard-body">
          <div class="lanyard-rows">
            <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
            <div><span>ZONE</span><b>${esc(d.seat)}</b></div>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
          <div class="lanyard-bars" aria-hidden="true"></div>
        </div>
      </article>`;
    },

    'concert-paper'(d, photo) {
      return `<article class="tk tk-concert-paper tk-tooth">
        <span class="bg-layer bg-halftone" aria-hidden="true"></span>
        <p class="paper-brand">LIVE NATION · E-TICKET</p>
        <h3 class="tk-title">${esc(d.title)}</h3>
        <p class="tk-place">${esc(d.place)}</p>
        <div class="paper-dash" aria-hidden="true"></div>
        ${photoBox(photo, 'paper-photo')}
        <div class="paper-dash" aria-hidden="true"></div>
        <div class="paper-rows">
          <div><dt>TIME</dt><dd>${esc(d.datetime)}</dd></div>
          <div><dt>TICKET</dt><dd>${esc(d.seat)}</dd></div>
        </div>
        <p class="tk-mood">${esc(d.mood)}</p>
        <div class="paper-code" aria-hidden="true"></div>
      </article>`;
    },

    'concert-backstage'(d, photo) {
      return `<article class="tk tk-concert-backstage">
        <div class="bs-ribbon"><span>BACKSTAGE</span><span>CREW</span></div>
        ${photoBox(photo, 'bs-photo')}
        <div class="bs-body">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="bs-rows"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'concert-stage'(d, photo) {
      return `<article class="tk tk-concert-stage">
        ${photoBox(photo, 'st-photo')}
        <div class="st-overlay">
          <span class="st-tag">LIVE</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="st-row"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'concert-vinyl'(d, photo) {
      return `<article class="tk tk-concert-vinyl">
        <div class="vy-disc">
          ${photoBox(photo, 'vy-photo')}
          <span class="vy-hole" aria-hidden="true"></span>
        </div>
        <div class="vy-body">
          <span class="vy-tag">SIDE A</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="vy-tracks">
            <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
            <div><span>TRACK</span><b>${esc(d.seat)}</b></div>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'concert-raffle'(d, photo) {
      return `<article class="tk tk-concert-raffle">
        <div class="rf-main">
          <span class="rf-lot">LOTTERY / ADMIT ONE</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place"><i data-lucide="map-pin"></i> ${esc(d.place)}</p>
          <div class="rf-row"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <div class="sp-perf" aria-hidden="true"></div>
        <div class="rf-stub">
          ${photoBox(photo, 'sp-photo')}
          <span class="rf-no">NO.008421</span>
        </div>
        <span class="fx-layer fx-rays" aria-hidden="true"></span>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'concert-wristband'(d, photo) {
      return `<article class="tk tk-concert-wristband">
        <span class="wb-slot wb-slot--l" aria-hidden="true"></span>
        <span class="wb-slot wb-slot--r" aria-hidden="true"></span>
        <span class="wb-tag">WRISTBAND</span>
        ${photoBox(photo, 'wb-photo')}
        <span class="wb-logo" aria-hidden="true"></span>
        <h3 class="tk-title">${esc(d.title)}</h3>
        <p class="tk-place">${esc(d.place)}</p>
        <div class="wb-row"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
        <p class="tk-mood">${esc(d.mood)}</p>
        <span class="fx-layer fx-glitter fx-glitter--rose" aria-hidden="true"></span>
      </article>`;
    },

    'city-press'(d, photo) {
      return `<article class="tk tk-city-press paper">
        <span class="bg-layer bg-grid" aria-hidden="true"></span>
        <header class="press-head">
          <span>THE DAILY STROLL</span>
          <span>${esc(d.datetime)}</span>
        </header>
        <div class="press-grid">
          ${photoBox(photo)}
          <div class="press-copy">
            <p class="press-kicker">FEATURE</p>
            <h3 class="tk-title">${esc(d.title)}</h3>
            <p class="tk-place"><i data-lucide="map-pinned"></i> ${esc(d.place)}</p>
            <p class="tk-mood">${esc(d.mood)}</p>
          </div>
        </div>
      </article>`;
    },

    'city-capsule'(d, photo) {
      return `<article class="tk tk-city-capsule paper">
        <span class="bg-layer bg-rings" aria-hidden="true"></span>
        ${photoBox(photo, 'cap-photo')}
        <div class="cap-body">
          <span class="cap-tag"><i data-lucide="coffee"></i> CITY CAPSULE</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="cap-meta">
            <span><i data-lucide="clock-3"></i> ${esc(d.datetime)}</span>
            <span><i data-lucide="hash"></i> ${esc(d.seat)}</span>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'city-map'(d, photo) {
      return `<article class="tk tk-city-map">
        <header class="map-head">
          <div>
            <h3 class="tk-title">${esc(d.title)}</h3>
            <p class="tk-place">${esc(d.place)}</p>
          </div>
          <div class="map-coord">${esc(d.datetime)}</div>
        </header>
        ${photoBox(photo)}
        <div class="map-body">
          <p class="map-pin"><i data-lucide="map-pin"></i> ${esc(d.seat)}</p>
          <p class="tk-mood">${esc(d.mood)}</p>
          <div class="map-scale" aria-hidden="true"></div>
        </div>
      </article>`;
    },

    'city-bookmark'(d, photo) {
      return `<article class="tk tk-city-bookmark">
        <div class="bm-top">
          <span class="bm-tag">${esc(d.seat)}</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
        </div>
        <div class="bm-line" aria-hidden="true"></div>
        ${photoBox(photo, 'bm-photo')}
        <p class="tk-mood">「${esc(d.mood)}」</p>
        <p class="bm-date">${esc(d.datetime)}</p>
      </article>`;
    },

    'city-square'(d, photo) {
      return `<article class="tk tk-city-square">
        ${photoBox(photo, 'sq-photo')}
        <div class="sq-body">
          <span class="sq-tag">SKETCH</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <p class="tk-mood">${esc(d.mood)}</p>
          <p class="sq-foot">${esc(d.datetime)}</p>
        </div>
      </article>`;
    },

    'city-street'(d, photo) {
      return `<article class="tk tk-city-street">
        ${photoBox(photo, 'sw-photo')}
        <div class="sw-body">
          <span class="sw-tag">STREET WALK</span>
          <div class="sw-main">
            <div>
              <h3 class="tk-title">${esc(d.title)}</h3>
              <p class="tk-place">${esc(d.place)}</p>
            </div>
            <span class="sw-date">${esc(d.datetime)}</span>
          </div>
          <p class="sw-pins"><i data-lucide="map-pin"></i> ${esc(d.seat)}</p>
          <p class="tk-mood">${esc(d.mood)}</p>
          <div class="sw-marks" aria-hidden="true"></div>
        </div>
      </article>`;
    },

    'city-zine'(d, photo) {
      return `<article class="tk tk-city-zine">
        <span class="bg-layer bg-grid" aria-hidden="true"></span>
        <header class="zn-head">
          <span class="zn-brand">THE STROLLER</span>
          <span>${esc(d.seat)}</span>
        </header>
        ${photoBox(photo, 'zn-photo')}
        <div class="zn-body">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place"><i data-lucide="map-pinned"></i> ${esc(d.place)}</p>
          <p class="zn-note">${esc(d.mood)}</p>
          <div class="zn-foot"><span>${esc(d.datetime)}</span><span>PAGE 07</span></div>
        </div>
      </article>`;
    },

    'city-transit'(d, photo) {
      return `<article class="tk tk-city-transit">
        <div class="tr-main">
          <span class="tr-no">INTERCITY · TICKET</span>
          <p class="tr-route"><strong>${esc(d.place)}</strong><i data-lucide="move-right"></i><strong>${esc(d.title)}</strong></p>
          <div class="tr-grid">
            <div><span>TRAIN / TIME</span><b>${esc(d.datetime)}</b></div>
            <div><span>CAR / SEAT</span><b>${esc(d.seat)}</b></div>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <div class="sp-perf" aria-hidden="true"></div>
        <div class="tr-stub">
          ${photoBox(photo, 'sp-photo')}
          <div class="tr-code" aria-hidden="true"></div>
        </div>
        <span class="fx-layer fx-grain" aria-hidden="true"></span>
      </article>`;
    },

    'city-exhibit'(d, photo) {
      return `<article class="tk tk-city-exhibit">
        <div class="ex-head">
          <span class="ex-brand">ADMISSION</span>
          <span class="ex-no">NO.EX2210</span>
        </div>
        <h3 class="tk-title">${esc(d.title)}</h3>
        <p class="tk-place">${esc(d.place)}</p>
        ${photoBox(photo)}
        <div class="ex-grid">
          <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
          <div><span>TICKET</span><b>${esc(d.seat)}</b></div>
        </div>
        <div class="ex-tear">
          <p class="tk-mood">「${esc(d.mood)}」</p>
        </div>
        <span class="fx-layer fx-vignette" aria-hidden="true"></span>
      </article>`;
    },

    'cinema-archive'(d, photo) {
      return `<article class="tk tk-cinema-archive">
        <span class="bg-layer bg-dots" aria-hidden="true"></span>
        <header class="ar-head">
          <span class="ar-brand">ARCHIVE / CINEMA</span>
          <span class="ar-no">FILE NO.B073</span>
        </header>
        ${photoBox(photo)}
        <h3 class="tk-title">${esc(d.title)}</h3>
        <div class="ar-rows">
          <div><span>CINEMA</span><b>${esc(d.place)}</b></div>
          <div><span>SHOWTIME</span><b>${esc(d.datetime)}</b></div>
          <div><span>SEAT</span><b>${esc(d.seat)}</b></div>
        </div>
        <span class="ar-stampbox">FILED</span>
        <p class="tk-mood">${esc(d.mood)}</p>
      </article>`;
    },

    'travel-badge'(d, photo) {
      return `<article class="tk tk-travel-badge">
        <span class="bg-layer bg-dots" aria-hidden="true"></span>
        <div class="bd-disc">
          ${photoBox(photo, 'bd-photo')}
          <span class="bd-star">EST · ${esc(d.datetime)}</span>
        </div>
        <div class="bd-body">
          <span class="bd-tag">TRAVEL BADGE</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="bd-row"><span>${esc(d.seat)}</span><span>${esc(d.datetime)}</span></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'concert-stub'(d, photo) {
      return `<article class="tk tk-concert-stub">
        <div class="cs2-main">
          <span class="cs2-tag">ADMIT ONE</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place"><i data-lucide="map-pin"></i> ${esc(d.place)}</p>
          <div class="cs2-row"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <div class="sp-perf" aria-hidden="true"></div>
        <div class="cs2-stub">
          ${photoBox(photo, 'sp-photo')}
          <div class="cs2-bars" aria-hidden="true"></div>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'city-notice'(d, photo) {
      return `<article class="tk tk-city-notice">
        <span class="bg-layer bg-stripes" aria-hidden="true"></span>
        <span class="nt-pin" aria-hidden="true"></span>
        <span class="nt-tag">NOTICE</span>
        <h3 class="tk-title">${esc(d.title)}</h3>
        <div class="nt-rule" aria-hidden="true"></div>
        ${photoBox(photo)}
        <div class="nt-body">
          <p class="tk-place">${esc(d.place)}</p>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <div class="nt-foot"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
      </article>`;
    },

    'stamp-classic'(d, photo) {
      return `<article class="tk tk-stamp-classic tk-perf">
        <div class="sc-face">
          <div class="sc-top"><span>CHINA POST</span><span class="sc-value">120</span></div>
          ${photoBox(photo, 'sc-photo')}
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <p class="sc-meta"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></p>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <span class="fx-layer fx-glitter fx-glitter--rose" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-sheet'(d, photos) {
      const p0 = photos[0];
      const p1 = photos[1];
      return `<article class="tk tk-stamp-sheet tk-perf">
        <div class="sh-head"><span>SPECIMEN SET</span><span>${esc(d.seat)}</span></div>
        <div class="sh-grid">
          <div class="sh-cell sh-cell--photo">${photoBox(p0, 'sh-photo', 0)}</div>
          <div class="sh-cell">
            <span class="sh-val">60</span>
            <h3 class="tk-title">${esc(d.title)}</h3>
            <p class="tk-place">${esc(d.place)}</p>
          </div>
          <div class="sh-cell">
            <span class="sh-val">80</span>
            <p class="sh-meta">${esc(d.datetime)}</p>
            <p class="tk-mood">${esc(d.mood)}</p>
          </div>
          <div class="sh-cell sh-cell--photo">${photoBox(p1, 'sh-photo', 1)}</div>
        </div>
        <span class="fx-layer fx-glitter fx-glitter--rose" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-postmark'(d, photo) {
      return `<article class="tk tk-stamp-postmark">
        <span class="bg-layer bg-diag" aria-hidden="true"></span>
        ${photoBox(photo, 'pm-photo')}
        <div class="pm-body">
          <div class="pm-cancel" aria-hidden="true"></div>
          <div class="pm-mark">POST<br>${esc(d.datetime)}</div>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <div class="pm-row"><span>${esc(d.place)}</span><span>${esc(d.seat)}</span></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'stamp-firstday'(d, photo) {
      return `<article class="tk tk-stamp-firstday tk-tooth">
        <span class="bg-layer bg-dots" aria-hidden="true"></span>
        <div class="fd-stamp tk-perf">${photoBox(photo, 'fd-photo')}</div>
        <div class="fd-mark">FIRST DAY<br>${esc(d.datetime)}</div>
        <div class="fd-sender">
          <p class="fd-to">FROM</p>
          <p class="fd-from">${esc(d.place)}</p>
        </div>
        <div class="fd-body">
          <p class="fd-to">TO</p>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <div class="fd-lines" aria-hidden="true"></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <footer class="fd-foot"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></footer>
      </article>`;
    },

    'stamp-wax'(d, photo) {
      return `<article class="tk tk-stamp-wax tk-tooth">
        <div class="wx-ribbon" aria-hidden="true"></div>
        <div class="wx-ribbon wx-ribbon--b" aria-hidden="true"></div>
        <div class="wx-seal" aria-hidden="true"></div>
        <div class="wx-body">
          ${photoBox(photo, 'wx-photo')}
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="wx-rows">
            <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
            <div><span>NO.</span><b>${esc(d.seat)}</b></div>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <span class="fx-layer fx-glitter fx-glitter--rose" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-pair'(d, photo) {
      return `<article class="tk tk-stamp-pair ${photoClass(photo)}">
        <div class="sp-cell">
          ${photoBox(photo, 'sp-photo')}
          <span class="sp-val">80</span>
        </div>
        <div class="sp-cell">
          <div>
            <h3 class="tk-title">${esc(d.title)}</h3>
            <p class="tk-place">${esc(d.place)}</p>
          </div>
          <div class="sp-rows">
            <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
            <div><span>NO.</span><b>${esc(d.seat)}</b></div>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
          <span class="sp-val">80</span>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-four'(d, photos) {
      const p0 = photos[0];
      const p1 = photos[1];
      return `<article class="tk tk-stamp-four ${photoClass(p0)}">
        <div class="sf4">
          ${photoBox(p0, 'sf4-photo', 0)}
          <span class="sf4-val">40</span>
        </div>
        <div class="sf4">
          <p class="sf4-k">SPECIMEN</p>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="sf4-k">${esc(d.datetime)}</p>
        </div>
        <div class="sf4">
          <p class="sf4-k">${esc(d.place)}</p>
          <p class="tk-mood">${esc(d.mood)}</p>
          <span class="sf4-val">60</span>
        </div>
        <div class="sf4">
          ${photoBox(p1, 'sf4-photo', 1)}
          <p class="sf4-k">${esc(d.seat)}</p>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-miniature'(d, photo) {
      return `<article class="tk tk-stamp-miniature ${photoClass(photo)}">
        <span class="bg-layer bg-rings" aria-hidden="true"></span>
        <div class="mn-inner">
          ${photoBox(photo, 'mn-photo')}
          <div class="mn-cap">
            <div>
              <h3 class="tk-title">${esc(d.title)}</h3>
              <p class="tk-place">${esc(d.place)}</p>
            </div>
            <span class="mn-val">120</span>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <div class="mn-edge"><span>CHINA POST</span><span>${esc(d.datetime)} · ${esc(d.seat)}</span></div>
        <span class="fx-layer fx-glitter fx-glitter--rose" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-panorama'(d, photo) {
      return `<article class="tk tk-stamp-panorama ${photoClass(photo)}">
        <div class="pn-hero">
          ${photoBox(photo, 'pn-photo')}
          <span class="pn-tag">PANORAMA · ${esc(d.datetime)}</span>
        </div>
        <div class="pn-bar">
          <div>
            <h3 class="tk-title">${esc(d.title)}</h3>
            <p class="tk-place">${esc(d.place)}</p>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
          <span class="pn-val">${esc(d.seat)}</span>
        </div>
      </article>`;
    },

    'stamp-portrait'(d, photo) {
      return `<article class="tk tk-stamp-portrait ${photoClass(photo)}">
        <div class="pt-frame">${photoBox(photo, 'pt-photo')}</div>
        <h3 class="pt-name">${esc(d.title)}</h3>
        <span class="pt-rule" aria-hidden="true"></span>
        <p class="tk-place">${esc(d.place)}</p>
        <div class="pt-rows">
          <div><span>LIFE</span><b>${esc(d.datetime)}</b></div>
          <div><span>NO.</span><b>${esc(d.seat)}</b></div>
        </div>
        <p class="tk-mood">${esc(d.mood)}</p>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-airmail'(d, photo) {
      return `<article class="tk tk-stamp-airmail ${photoClass(photo)}">
        <span class="am-stripe am-stripe--t" aria-hidden="true"></span>
        <div class="am-body">
          ${photoBox(photo, 'am-photo')}
          <div>
            <p class="am-k"><span><i data-lucide="plane"></i> PAR AVION</span><span class="am-val">${esc(d.seat)}</span></p>
            <h3 class="tk-title">${esc(d.title)}</h3>
            <p class="tk-place">${esc(d.place)}</p>
            <div class="am-rows">
              <div><span>FLIGHT</span><b>${esc(d.datetime)}</b></div>
            </div>
            <p class="tk-mood">${esc(d.mood)}</p>
          </div>
        </div>
        <span class="am-stripe am-stripe--b" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-vintage'(d, photo) {
      return `<article class="tk tk-stamp-vintage ${photoClass(photo)}">
        <div class="vg-head"><span>CHINA POST</span><span>${esc(d.datetime)}</span></div>
        ${photoBox(photo, 'vg-photo')}
        <span class="vg-cancel" aria-hidden="true"></span>
        <h3 class="tk-title">${esc(d.title)}</h3>
        <p class="tk-place">${esc(d.place)} · ${esc(d.seat)}</p>
        <p class="tk-mood">${esc(d.mood)}</p>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-night'(d, photo) {
      return `<article class="tk tk-stamp-night ${photoClass(photo)}">
        <div class="ng-top"><span>CHINA POST</span><span>FLUORESCENT</span></div>
        ${photoBox(photo, 'ng-photo')}
        <h3 class="tk-title">${esc(d.title)}</h3>
        <p class="tk-place">${esc(d.place)}</p>
        <div class="ng-meta"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
        <p class="tk-mood">${esc(d.mood)}</p>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-tri'(d, photo) {
      return `<article class="tk tk-stamp-tri ${photoClass(photo)}">
        <span class="tr-cap">CHINA POST</span>
        ${photoBox(photo, 'tr-photo')}
        <h3 class="tk-title">${esc(d.title)}</h3>
        <p class="tr-meta">${esc(d.datetime)} · ${esc(d.seat)}</p>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-round'(d, photo) {
      return `<article class="tk tk-stamp-round ${photoClass(photo)}">
        <span class="rd-top">CHINA POST</span>
        ${photoBox(photo, 'rd-photo')}
        <h3 class="tk-title">${esc(d.title)}</h3>
        <p class="tk-place">${esc(d.place)}</p>
        <p class="tk-mood">${esc(d.mood)}</p>
        <span class="rd-top">${esc(d.datetime)} · ${esc(d.seat)}</span>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-hex'(d, photo) {
      return `<article class="tk tk-stamp-hex ${photoClass(photo)}">
        ${photoBox(photo, 'hx-photo')}
        <h3 class="tk-title">${esc(d.title)}</h3>
        <p class="tk-place">${esc(d.place)}</p>
        <div class="hx-meta"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'stamp-tab'(d, photo) {
      return `<article class="tk tk-stamp-tab ${photoClass(photo)}">
        <div class="tb-main">
          ${photoBox(photo, 'tb-photo')}
          <div class="tb-row">
            <div>
              <h3 class="tk-title">${esc(d.title)}</h3>
              <p class="tk-place">${esc(d.place)}</p>
            </div>
            <span class="tb-val">120</span>
          </div>
        </div>
        <div class="tb-tab">
          <p class="tb-k">附捐 · SURTAX</p>
          <p class="tk-mood">${esc(d.mood)}</p>
          <div class="tb-meta"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
        </div>
        <span class="fx-layer fx-glitter fx-glitter--rose" aria-hidden="true"></span>
      </article>`;
    },

    'travel-country'(d, photo) {
      return `<article class="tk tk-travel-country">
        <div class="tc-left">
          ${photoBox(photo, 'tc-photo')}
          <div class="tc-foot">
            <span class="tc-country">${esc(d.title)}</span>
            <span class="tc-rule" aria-hidden="true"></span>
            <span class="tc-rule" aria-hidden="true"></span>
            <p class="tk-mood">${esc(d.mood)}</p>
          </div>
        </div>
        <div class="tc-right">
          <p class="tc-k">DESTINATION:</p>
          <p class="tc-v">${esc(d.place)}</p>
          <p class="tc-k">DATE:</p>
          <p class="tc-v">${esc(d.datetime)}</p>
          <p class="tc-k">TICKET NO:</p>
          <p class="tc-v">${esc(d.seat)}</p>
          <span class="tc-emblem"><i data-lucide="sparkles"></i></span>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'travel-triptych'(d, photo) {
      return `<article class="tk tk-travel-triptych">
        <div class="tt-shot">${photoBox(photo, 'tt-photo')}</div>
        <div class="tt-info">
          <div><p class="tt-k">DESTINATION:</p><p class="tt-v">${esc(d.title)}</p></div>
          <div><p class="tt-k">FROM / DATE:</p><p class="tt-v">${esc(d.place)} · ${esc(d.datetime)}</p></div>
          <div><p class="tt-k">SEAT / NO:</p><p class="tt-v">${esc(d.seat)}</p></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <div class="tt-band"><i data-lucide="plane"></i><i data-lucide="map-pin"></i></div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'travel-medallion'(d, photo) {
      return `<article class="tk tk-travel-medallion">
        <span class="ml-edge" aria-hidden="true"></span>
        <span class="ml-ring" aria-hidden="true"></span>
        <div class="ml-body">
          ${photoBox(photo, 'ml-photo')}
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="ml-rows">
            <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
            <div><span>NO.</span><b>${esc(d.seat)}</b></div>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'travel-arch'(d, photo) {
      return `<article class="tk tk-travel-arch">
        ${photoBox(photo, 'ta-photo')}
        <div class="ta-body">
          <span class="ta-flower"><i data-lucide="flower-2"></i></span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="ta-rows">
            <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
            <div><span>NO.</span><b>${esc(d.seat)}</b></div>
          </div>
        </div>
        <div class="ta-tear">
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <span class="fx-layer fx-glitter fx-glitter--rose" aria-hidden="true"></span>
      </article>`;
    },

    'travel-mountain'(d, photo) {
      return `<article class="tk tk-travel-mountain">
        <div class="mt-scene">
          <span class="mt-peak" aria-hidden="true"></span>
          <span class="mt-name">${esc(d.title)}</span>
          <span class="mt-flake"><i data-lucide="snowflake"></i></span>
        </div>
        <div class="mt-frame">${photoBox(photo, 'mt-photo')}</div>
        <div class="mt-body">
          <p class="tk-place">${esc(d.place)}</p>
          <div class="mt-row"><span>DATE</span><b>${esc(d.datetime)}</b></div>
          <div class="mt-row"><span>FLIGHT</span><b>${esc(d.seat)}</b></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'travel-patch'(d, photo) {
      return `<article class="tk tk-travel-patch">
        <span class="pa-stitch" aria-hidden="true"></span>
        ${photoBox(photo, 'pa-photo')}
        <div class="pa-body">
          <span class="pa-tag">TRAVEL PATCH</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="pa-rows">
            <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
            <div><span>NO.</span><b>${esc(d.seat)}</b></div>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'travel-keycard'(d, photo) {
      return `<article class="tk tk-travel-keycard">
        <div class="kc-stripe" aria-hidden="true"></div>
        <div class="kc-body">
          <div class="kc-top">
            <div>
              <span class="kc-hotel">HOTEL KEY CARD</span>
              <p class="kc-room">${esc(d.seat)}</p>
            </div>
            ${photoBox(photo, 'kc-photo')}
          </div>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <div class="kc-rows">
            <div><span>CHECK-IN</span><b>${esc(d.datetime)}</b></div>
            <div><span>GUEST</span><b>${esc(d.place)}</b></div>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <span class="kc-chip" aria-hidden="true"></span>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'concert-scallop'(d, photo) {
      return `<article class="tk tk-concert-scallop tk-tooth">
        <h3 class="sc2-title">${esc(d.title)}</h3>
        <p class="sc2-sub">ADMIT ONE · EVENT TICKET</p>
        ${photoBox(photo, 'sc2-photo')}
        <div class="sc2-rows">
          <div><span>PLACE</span><b>${esc(d.place)}</b></div>
          <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
          <div><span>SEAT</span><b>${esc(d.seat)}</b></div>
        </div>
        <p class="tk-mood">${esc(d.mood)}</p>
        <span class="sc2-star"><i data-lucide="star"></i></span>
        <span class="fx-layer fx-glitter fx-glitter--rose" aria-hidden="true"></span>
      </article>`;
    },
  };

  // —— 结构不同的这一批：每个版式的 DOM 都不一样 ——

  Object.assign(renderers, {
    'cinema-twoup'(d, photos) {
      const p0 = photos[0];
      const p1 = photos[1];
      const pane = (flag, tag, photo) => `<div class="tw-pane${flag}">
        <span class="tw-head">${tag}</span>
        ${photoBox(photo, 'tw-photo')}
        <h3 class="tk-title">${esc(d.title)}</h3>
        <p class="tk-place">${esc(d.place)}</p>
        <div class="tw-row"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
      </div>`;
      return `<article class="tk tk-cinema-twoup tk-2div">
        ${pane('', 'ADMIT ONE', p0)}
        ${pane(' tw-pane--b', 'ADMIT TWO', p1)}
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'cinema-threestub'(d, photo) {
      const stub = (k, v) => `<div class="ts2-stub"><span>${k}</span><b>${v}</b></div>`;
      return `<article class="tk tk-cinema-threestub">
        <div class="ts2-body">
          ${photoBox(photo)}
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="tw-row"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <div class="ts2-stubs">
          ${stub('STUB 01', esc(d.seat))}
          ${stub('STUB 02', esc(d.datetime))}
          ${stub('STUB 03', 'NO.003')}
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'cinema-sheet'(d, photos) {
      const p0 = photos[0];
      const p1 = photos[1];
      return `<article class="tk tk-cinema-sheet">
        <div class="sh2-head"><span>SHEET · 4 UP</span><span>${esc(d.datetime)}</span></div>
        <div class="sh2-grid">
          <div class="sh2-cell">${photoBox(p0, '', 0)}<h3 class="tk-title">${esc(d.title)}</h3></div>
          <div class="sh2-cell"><p class="sh2-note">CINEMA</p><p class="sh2-note">${esc(d.place)}</p><p class="sh2-note">${esc(d.seat)}</p></div>
          <div class="sh2-cell"><p class="sh2-note">SHOWTIME</p><p class="sh2-note">${esc(d.datetime)}</p><p class="sh2-note">ADMIT ONE</p></div>
          <div class="sh2-cell">${photoBox(p1, '', 1)}<p class="tk-mood">${esc(d.mood)}</p></div>
        </div>
      </article>`;
    },

    'travel-bifold'(d, photo) {
      return `<article class="tk tk-travel-bifold tk-2div">
        <div class="bf-cover">
          ${photoBox(photo)}
          <div class="bf-cover-in">
            <h3 class="bf-title">${esc(d.title)}</h3>
            <p class="bf-sub">${esc(d.place)}</p>
          </div>
        </div>
        <div class="bf-inner">
          <span class="bf-kicker">TRAVEL FOLDER</span>
          <div class="bf-row"><span>DATE</span><b>${esc(d.datetime)}</b></div>
          <div class="bf-row"><span>PARTY</span><b>${esc(d.seat)}</b></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'travel-sleeve'(d, photo) {
      return `<article class="tk tk-travel-sleeve">
        <div class="sl-sleeve">
          <span class="sl-label">TICKET HOLDER</span>
          <h3 class="sl-title">${esc(d.title)}</h3>
          <span class="sl-rule" aria-hidden="true"></span>
          <p class="sl-note">${esc(d.mood)}</p>
        </div>
        <div class="sl-ticket">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="sl-row"><span>DATE</span><b>${esc(d.datetime)}</b></div>
          <div class="sl-row"><span>NO.</span><b>${esc(d.seat)}</b></div>
          ${photoBox(photo)}
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'travel-magcard'(d, photo) {
      return `<article class="tk tk-travel-magcard">
        <div class="mg-stripe" aria-hidden="true"></div>
        <div class="mg-body">
          <div>
            <p class="mg-k">HOTEL</p>
            <h3 class="tk-title">${esc(d.title)}</h3>
            <p class="mg-k">GUEST</p>
            <p class="mg-v">${esc(d.place)}</p>
            <p class="mg-k">VALID</p>
            <p class="mg-v">${esc(d.datetime)}</p>
            <p class="mg-k">ROOM</p>
            <p class="mg-v">${esc(d.seat)}</p>
          </div>
          <div>
            ${photoBox(photo, 'mg-photo')}
            <span class="mg-chip" aria-hidden="true"></span>
          </div>
        </div>
        <span class="mg-code" aria-hidden="true"></span>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'concert-badge'(d, photo) {
      return `<article class="tk tk-concert-badge">
        <span class="cb-slot" aria-hidden="true"></span>
        ${photoBox(photo, 'cb-photo')}
        <div class="cb-body">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="cb-rows">
            <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
            <div><span>SEAT</span><b>${esc(d.seat)}</b></div>
          </div>
          <p class="cb-note">${esc(d.mood)}</p>
        </div>
        <span class="cb-code" aria-hidden="true"></span>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'concert-note'(d, photo) {
      return `<article class="tk tk-concert-note">
        <span class="cn-tape" aria-hidden="true"></span>
        ${photoBox(photo, 'cn-photo')}
        <h3 class="tk-title">${esc(d.title)}</h3>
        <p class="tk-place">${esc(d.place)}</p>
        <div class="cn-rows">
          <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
          <div><span>SEAT</span><b>${esc(d.seat)}</b></div>
        </div>
        <p class="tk-mood">${esc(d.mood)}</p>
      </article>`;
    },

    'concert-roundtrip'(d, photos) {
      const p0 = photos[0];
      const p1 = photos[1];
      const half = (tag, seat, photo) => `<div class="rt2-half">
        ${photoBox(photo)}
        <div>
          <span class="rt2-tag">${tag}</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="rt2-row"><span>${esc(d.datetime)}</span><span>${seat}</span></div>
        </div>
      </div>`;
      return `<article class="tk tk-concert-roundtrip">
        ${half('OUTBOUND · 去', esc(d.seat), p0)}
        ${half('RETURN · 返', esc(d.seat), p1)}
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'city-collage'(d, photos) {
      const p0 = photos[0];
      const p1 = photos[1];
      return `<article class="tk tk-city-collage">
        <div class="cl-scrap cl-scrap--a">
          ${photoBox(p0, '', 0)}
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
        </div>
        <div class="cl-scrap cl-scrap--b">
          ${photoBox(p1, '', 1)}
          <p class="cl-rows"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></p>
        </div>
        <div class="cl-scrap cl-scrap--c">
          <p class="cl-rows"><span>DATE</span><span>${esc(d.datetime)}</span></p>
          <p class="cl-rows"><span>NO.</span><span>${esc(d.seat)}</span></p>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'city-gatecard'(d, photo) {
      return `<article class="tk tk-city-gatecard">
        <span class="gc-slot" aria-hidden="true"></span>
        <div class="gc-top">
          ${photoBox(photo, 'gc-photo')}
          <div>
            <h3 class="gc-name">${esc(d.title)}</h3>
            <p class="gc-sub">${esc(d.place)}</p>
          </div>
        </div>
        <div class="gc-rows">
          <div><span>ISSUED</span><b>${esc(d.datetime)}</b></div>
          <div><span>CARD NO.</span><b>${esc(d.seat)}</b></div>
        </div>
        <p class="tk-mood">${esc(d.mood)}</p>
        <span class="gc-code" aria-hidden="true"></span>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },
  });

  // ============================================================
  // 批量版式的渲染器：由上面的数据表自动生成
  // ============================================================

  function tripRenderer(pal, layout, pos, icons, band) {
    return (d, photo) => {
      const strip = `<div class="tp-band"><i data-lucide="${icons[0]}"></i><i data-lucide="${icons[1]}"></i></div>`;
      const info = `<div class="tp-info">
          <span class="bg-layer bg-dots" aria-hidden="true"></span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <div><p class="tp-k">${band[0]}</p><p class="tp-v">${esc(d.place)}</p></div>
          <div><p class="tp-k">${band[1]}</p><p class="tp-v">${esc(d.datetime)}</p></div>
          <div><p class="tp-k">${band[2]}</p><p class="tp-v">${esc(d.seat)}</p></div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>`;

      // 顶部整幅图：一张宽图 或 两张方图；下方是「信息 + 图案带」，分界处左右各咬一个半圆
      if (layout === 'top' || layout === 'duo') {
        const p0 = Array.isArray(photo) ? photo[0] : photo;
        const p1 = Array.isArray(photo) ? photo[1] : photo;
        const hero = layout === 'duo'
          ? `<div class="tp-hero tp-hero--duo">${photoBox(p0, '', 0)}${photoBox(p1, '', 1)}</div>`
          : `<div class="tp-hero">${photoBox(p0, '', 0)}</div>`;
        return `<article class="tk tk-trip tk-trip--top tk-hdiv tk-trip--${pal}">
          ${hero}
          <div class="tp-lower">${info}${strip}</div>
          <span class="fx-layer fx-glitter" aria-hidden="true"></span>
        </article>`;
      }

      // 左侧图列：单方图 / 竖图 / 横图；图列宽度与照片比例由版式类决定
      const shot = `<div class="tp-shot">${photoBox(photo, 'tp-photo')}</div>`;
      const cls = `tk-trip tk-2div tk-trip--${pal} tk-trip--${layout}${pos === 'left' ? ' tk-trip--flip' : ''}`;
      return `<article class="tk ${cls}">
        ${pos === 'left' ? strip : shot}
        ${info}
        ${pos === 'left' ? shot : strip}
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    };
  }

  function posterRenderer(pal) {
    return (d, photo) => `<article class="tk tk-pstr tk-pstr--${pal}">
      <div class="ps-top">
        ${photoBox(photo, 'ps-photo')}
        <div class="ps-over">
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
        </div>
      </div>
      <div class="ps-strip">
        <div class="ps-row"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
        <p class="tk-mood">${esc(d.mood)}</p>
      </div>
      <span class="fx-layer fx-glitter" aria-hidden="true"></span>
    </article>`;
  }

  function shapeRenderer(shape) {
    return (d, photo) => `<article class="tk tk-shape tk-shape--${shape}">
      ${photoBox(photo, 'sf-photo')}
      <h3 class="tk-title">${esc(d.title)}</h3>
      <p class="tk-place">${esc(d.place)}</p>
      <div class="sf-rows">
        <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
        <div><span>NO.</span><b>${esc(d.seat)}</b></div>
      </div>
      <p class="tk-mood">${esc(d.mood)}</p>
      <span class="fx-layer fx-glitter" aria-hidden="true"></span>
    </article>`;
  }

  /* 邮票：12 种结构共用一套零件（发行行 / 面值框 / 虚线行 / 照片），
     结构只决定「照片什么形状、信息怎么排」，配色只换 CSS 变量，
     点缀负责让同结构的几枚拉开差别 */
  function stampRenderer(variant, pal, flair) {
    const ico = `<i data-lucide="${SM_ICON[variant] || 'stamp'}"></i>`;
    const flairHtml = flair === 'icon'
      ? `<span class="sm-flair" aria-hidden="true">${ico}</span>`
      : flair === 'rule'
        ? `<span class="sm-rule" aria-hidden="true"></span>`
        : '';

    return (d, photo) => {
      const head = `<div class="sm-head"><span class="sm-org">CHINA POST</span><span>${esc(d.datetime)}</span></div>`;
      const val = `<span class="sm-val">${esc(d.seat)}</span>`;
      const solo = `<div class="sm-meta sm-meta--solo"><span>${esc(d.seat)}</span></div>`;
      const title = `<h3 class="tk-title">${esc(d.title)}</h3>`;
      const place = `<p class="tk-place">${esc(d.place)}</p>`;
      const mood = `<p class="tk-mood">${esc(d.mood)}</p>`;
      // 面值水印只取数字，太长会撑破版面
      const digits = (String(d.seat).match(/\d+/g) || []).join('').slice(0, 3) || '1';

      const bodies = {
        column: `<div class="sm-face">
          <div class="sm-head"><span class="sm-org">CHINA POST</span>${val}</div>
          ${photoBox(photo, 'sm-photo')}
          ${title}${place}${flairHtml}${solo}${mood}
        </div>`,

        arch: `<div class="sm-face">
          ${head}
          <div class="sm-arch">${photoBox(photo, 'sm-photo')}</div>
          ${title}${place}${flairHtml}${solo}${mood}
        </div>`,

        seal: `<div class="sm-face sm-face--box">
          ${head}
          ${photoBox(photo, 'sm-photo')}
          <div class="sm-center">${title}${place}</div>
          ${flairHtml}${solo}${mood}
        </div>`,

        crest: `<div class="sm-face">
          ${head}
          <div class="sm-crest">
            ${photoBox(photo, 'sm-photo')}
            <span class="sm-badge" aria-hidden="true">${ico}</span>
          </div>
          ${title}${place}${solo}${mood}
        </div>`,

        denom: `<div class="sm-face">
          <span class="sm-wmark" aria-hidden="true">${esc(digits)}</span>
          ${head}
          ${photoBox(photo, 'sm-photo')}
          ${title}${place}${solo}${mood}
        </div>`,

        coords: `<div class="sm-bleed">${photoBox(photo, 'sm-photo')}</div>
        <div class="sm-face">
          ${title}${place}
          <div class="sm-scale">
            <div><span class="sm-k">ISSUED</span><b>${esc(d.datetime)}</b></div>
            <div><span class="sm-k">CAT.NO</span><b>${esc(d.seat)}</b></div>
          </div>
          ${mood}
        </div>`,

        banner: `<div class="sm-face">
          ${head}
          <p class="sm-banner">${esc(d.title)}</p>
          ${photoBox(photo, 'sm-photo')}
          ${place}${solo}${mood}
        </div>`,

        coil: `<div class="sm-face">
          <div class="sm-head"><span class="sm-org">CHINA POST</span>${val}</div>
          ${photoBox(photo, 'sm-photo')}
          ${title}${place}
          <div class="sm-meta sm-meta--solo"><span>${esc(d.datetime)}</span></div>
          ${mood}
        </div>`,

        oval: `<div class="sm-face">
          ${head}
          <div class="sm-ring">${photoBox(photo, 'sm-photo')}</div>
          <div class="sm-center">${title}${place}</div>
          <span class="sm-rule" aria-hidden="true"></span>
          ${solo}${mood}
        </div>`,

        gate: `<div class="sm-face sm-face--gate">
          <span class="sm-gband"><b>${esc(d.place)}</b></span>
          <div class="sm-gbody">
            ${head}
            ${photoBox(photo, 'sm-photo')}
            ${title}${solo}${mood}
          </div>
        </div>`,

        vignette: `<div class="sm-face">
          ${head}
          <div class="sm-hero">
            ${photoBox(photo, 'sm-photo')}
            <div class="sm-veil">${title}${place}</div>
          </div>
          ${solo}${mood}
        </div>`,

        ledger: `<div class="sm-face sm-face--ledger">
          ${photoBox(photo, 'sm-photo')}
          <div class="sm-ledge">
            ${head}
            <div class="sm-lrow"><span class="sm-lk">TOPIC</span><span class="sm-lv">${esc(d.title)}</span></div>
            <div class="sm-lrow"><span class="sm-lk">PLACE</span><span class="sm-lv">${esc(d.place)}</span></div>
            <div class="sm-lrow"><span class="sm-lk">NO.</span><span class="sm-lv">${esc(d.seat)}</span></div>
            ${mood}
          </div>
        </div>`,
      };

      // 卷筒票只有上下两条齿边，用的是另一套遮罩
      const maskCls = variant === 'coil' ? 'tk-tooth' : 'tk-perf';
      return `<article class="tk tk-stmp tk-stmp--${variant} tk-stmp--${pal} ${maskCls} ${photoClass(photo)}">
        ${bodies[variant]}
      </article>`;
    };
  }

  const TRIP_BAND = { travel: TRIP_LABELS.travel.band, concert: TRIP_LABELS.concert.band };

  TRAVEL_TRIPS.forEach(([id, , , pal, layout, pos, icons]) => {
    renderers[id] = tripRenderer(pal, layout, pos, icons, TRIP_BAND.travel);
  });
  CONCERT_TRIPS.forEach(([id, , , pal, layout, pos, icons]) => {
    renderers[id] = tripRenderer(pal, layout, pos, icons, TRIP_BAND.concert);
  });
  CINEMA_POSTERS.forEach(([id, , , pal]) => {
    renderers[id] = posterRenderer(pal);
  });
  CITY_SHAPES.forEach(([id, , , shape]) => {
    renderers[id] = shapeRenderer(shape);
  });
  STAMP_ISSUES.forEach(([id, , , variant, pal, flair]) => {
    renderers[id] = stampRenderer(variant, pal, flair);
  });

  // —— 复刻：照片卡系列 ——

  Object.assign(renderers, {
    'card-filmwide'(d, photo) {
      return `<article class="tk tk-widecard tk-widecard--film">
        <div class="wc-hero">${photoBox(photo, 'wc-photo')}</div>
        <div class="wc-body">
          <div class="wc-grid">
            <div><p class="wc-k">FILM:</p><p class="wc-v">${esc(d.title)}</p></div>
            <div><p class="wc-k">CINEMA:</p><p class="wc-v">${esc(d.place)}</p></div>
            <div><p class="wc-k">SCREEN / DATE:</p><p class="wc-v">${esc(d.datetime)}</p></div>
            <div><p class="wc-k">ROW / SEAT:</p><p class="wc-v">${esc(d.seat)}</p></div>
          </div>
          <div class="wc-foot">
            <p class="wc-admit">ADMIT ONE</p>
            <p class="tk-mood">${esc(d.mood)}</p>
            <span class="wc-icon"><i data-lucide="clapperboard"></i></span>
          </div>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'card-ornate'(d, photo) {
      return `<article class="tk tk-classic">
        <span class="cl-frame" aria-hidden="true"></span>
        <span class="cl-curl cl-curl--tl" aria-hidden="true"></span>
        <span class="cl-curl cl-curl--tr" aria-hidden="true"></span>
        <span class="cl-curl cl-curl--bl" aria-hidden="true"></span>
        <span class="cl-curl cl-curl--br" aria-hidden="true"></span>
        <div class="cl-body">
          <div class="cl-shot">
            ${photoBox(photo, 'cl-photo')}
            <p class="cl-mood">${esc(d.mood)}</p>
          </div>
          <div class="cl-rows">
            <span class="cl-icon"><i data-lucide="landmark"></i></span>
            <div class="cl-row"><span class="cl-k">EVENT:</span><span class="cl-v">${esc(d.title)}</span></div>
            <div class="cl-row"><span class="cl-k">DATE:</span><span class="cl-v">${esc(d.datetime)}</span></div>
            <div class="cl-row"><span class="cl-k">VENUE:</span><span class="cl-v">${esc(d.place)}</span></div>
            <div class="cl-row"><span class="cl-k">TICKET NO:</span><span class="cl-v">${esc(d.seat)}</span></div>
          </div>
        </div>
      </article>`;
    },

    'card-flower'(d, photo) {
      return `<article class="tk tk-card tk-card--flower">
        ${photoBox(photo, 'cd-photo')}
        <div class="cd-rows">
          <div><span>NAME</span><b>${esc(d.title)}</b></div>
          <div><span>LOCATION</span><b>${esc(d.place)}</b></div>
          <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
          <div><span>NO.</span><b>${esc(d.seat)}</b></div>
          <p class="tk-mood">${esc(d.mood)}</p>
          <span class="cd-icon"><i data-lucide="flower-2"></i></span>
        </div>
        <span class="fx-layer fx-glitter fx-glitter--rose" aria-hidden="true"></span>
      </article>`;
    },

    'card-camera'(d, photo) {
      return `<article class="tk tk-card tk-card--camera">
        ${photoBox(photo, 'cd-photo')}
        <div class="cd-rows">
          <div><span>NAME</span><b>${esc(d.title)}</b></div>
          <div><span>LOCATION</span><b>${esc(d.place)}</b></div>
          <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
          <div><span>TAKEN BY</span><b>${esc(d.seat)}</b></div>
          <p class="tk-mood">${esc(d.mood)}</p>
          <span class="cd-icon"><i data-lucide="camera"></i></span>
        </div>
      </article>`;
    },

    'card-safari'(d, photo) {
      return `<article class="tk tk-card tk-card--safari">
        ${photoBox(photo, 'cd-photo')}
        <div class="cd-rows">
          <div><span>SAFARI</span><b>${esc(d.title)}</b></div>
          <div><span>LOCATION</span><b>${esc(d.place)}</b></div>
          <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
          <div><span>NO.</span><b>${esc(d.seat)}</b></div>
          <p class="tk-mood">${esc(d.mood)}</p>
          <span class="cd-icon"><i data-lucide="trees"></i></span>
        </div>
      </article>`;
    },

    'card-scallop'(d, photo) {
      /* 波浪齿的数量按票宽固定，空白由 space-between 均分 */
      const teeth = '<i></i>'.repeat(14);
      return `<article class="tk tk-park">
        <span class="pk-band pk-band--t" aria-hidden="true">${teeth}</span>
        <span class="pk-band pk-band--b" aria-hidden="true">${teeth}</span>
        <div class="pk-plate">
          <div class="pk-shot">
            ${photoBox(photo, 'pk-photo')}
            <p class="pk-mood">${esc(d.mood)}</p>
          </div>
          <div class="pk-info">
            <span class="pk-tree"><i data-lucide="trees"></i></span>
            <div class="pk-row"><span class="pk-k">PARK:</span><span class="pk-v">${esc(d.title)}</span></div>
            <div class="pk-row"><span class="pk-k">DATE:</span><span class="pk-v">${esc(d.datetime)}</span></div>
            <div class="pk-row"><span class="pk-k">GUIDE:</span><span class="pk-v">${esc(d.place)}</span></div>
            <div class="pk-row"><span class="pk-k">SPOTTED:</span><span class="pk-v">${esc(d.seat)}</span></div>
          </div>
        </div>
      </article>`;
    },

    'card-reel'(d, photo) {
      return `<article class="tk tk-reel">
        <div class="rl-inner">
          <span class="rl-badge"><i data-lucide="film"></i></span>
          <span class="rl-dash" aria-hidden="true"></span>
          ${photoBox(photo, 'rl-photo')}
          <span class="rl-dash" aria-hidden="true"></span>
          <div class="rl-info">
            <p class="rl-title">${esc(d.title)}</p>
            <p class="rl-row">${esc(d.place)}</p>
            <p class="rl-row">${esc(d.datetime)}</p>
            <p class="rl-row">ADMIT ONE · ${esc(d.seat)}</p>
            <p class="rl-mood">${esc(d.mood)}</p>
          </div>
        </div>
      </article>`;
    },

    'card-gilt'(d, photo) {
      return `<article class="tk tk-gilt">
        <div class="gt-gold">
          <span class="gt-curl gt-curl--tl" aria-hidden="true"></span>
          <span class="gt-curl gt-curl--tr" aria-hidden="true"></span>
          <span class="gt-curl gt-curl--bl" aria-hidden="true"></span>
          <span class="gt-curl gt-curl--br" aria-hidden="true"></span>
          <div class="gt-plate">
            ${photoBox(photo, 'gt-photo')}
            <p class="gt-title">${esc(d.title)}</p>
            <span class="gt-rule" aria-hidden="true"></span>
            <div class="gt-lines">
              <p class="gt-line">${esc(d.place)}</p>
              <p class="gt-line">${esc(d.datetime)}</p>
              <p class="gt-line">${esc(d.seat)}</p>
            </div>
            <p class="gt-mood">${esc(d.mood)}</p>
          </div>
        </div>
      </article>`;
    },

    'card-splash'(d, photo) {
      return `<article class="tk tk-widecard tk-widecard--splash">
        <div class="wc-hero">
          ${photoBox(photo, 'wc-photo')}
          <span class="wc-notch wc-notch--l" aria-hidden="true"></span>
          <span class="wc-notch wc-notch--r" aria-hidden="true"></span>
        </div>
        <div class="wc-body">
          <div class="wc-grid">
            <div><p class="wc-k">LOCATION:</p><p class="wc-v">${esc(d.place)}</p></div>
            <div><p class="wc-k">DATE:</p><p class="wc-v">${esc(d.datetime)}</p></div>
            <div><p class="wc-k">WATER TEMP:</p><p class="wc-v">${esc(d.seat)}</p></div>
            <div><p class="wc-k">SPOT:</p><p class="wc-v">${esc(d.title)}</p></div>
          </div>
          <div class="wc-foot">
            <p class="wc-admit">ADMIT ONE</p>
            <p class="tk-mood">${esc(d.mood)}</p>
            <span class="wc-icon"><i data-lucide="sailboat"></i></span>
          </div>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'card-museum'(d, photo) {
      return `<article class="tk tk-muscard">
        <div class="mc-top">
          <span class="mc-slot" aria-hidden="true"></span>
          ${photoBox(photo, 'mc-photo')}
        </div>
        <div class="mc-bot">
          <div><p class="wc-k">EXHIBIT:</p><p class="wc-v">${esc(d.title)}</p></div>
          <div><p class="wc-k">DATE:</p><p class="wc-v">${esc(d.datetime)}</p></div>
          <div><p class="wc-k">TIME / NO.:</p><p class="wc-v">${esc(d.seat)}</p></div>
          <div><p class="wc-k">PLACE:</p><p class="wc-v">${esc(d.place)}</p></div>
          <p class="tk-mood">${esc(d.mood)}</p>
          <span class="mc-icon"><i data-lucide="landmark"></i></span>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'card-round'(d, photo) {
      return `<article class="tk tk-roundcard">
        <div class="rw-body">
          ${photoBox(photo, 'rw-photo')}
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="rw-rows">
            <div><span>DATE</span><b>${esc(d.datetime)}</b></div>
            <div><span>NO.</span><b>${esc(d.seat)}</b></div>
          </div>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'card-hexcolor'(d, photo) {
      return `<article class="tk tk-hexcolor">
        <div class="hx-inner">
          ${photoBox(photo, 'hx-photo')}
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <p class="hx-row">${esc(d.datetime)} · ${esc(d.seat)}</p>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
      </article>`;
    },

    'card-blacklabel'(d, photo) {
      return `<article class="tk tk-labelcard tk-labelcard--black">
        ${photoBox(photo)}
        <div class="lc-band">
          <div><span class="lc-k">STAGE:</span><span class="lc-v">${esc(d.title)}</span></div>
          <div><span class="lc-k">LOCATION:</span><span class="lc-v">${esc(d.place)}</span></div>
          <div><span class="lc-k">DATE:</span><span class="lc-v">${esc(d.datetime)}</span></div>
          <div><span class="lc-k">NO.:</span><span class="lc-v">${esc(d.seat)}</span></div>
          <span class="lc-icon"><i data-lucide="torii-gate"></i></span>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    },

    'card-redlabel'(d, photo) {
      return `<article class="tk tk-labelcard tk-labelcard--red">
        ${photoBox(photo)}
        <div class="lc-band">
          <div><span class="lc-k">STAGE:</span><span class="lc-v">${esc(d.title)}</span></div>
          <div><span class="lc-k">LOCATION:</span><span class="lc-v">${esc(d.place)}</span></div>
          <div><span class="lc-k">DATE:</span><span class="lc-v">${esc(d.datetime)}</span></div>
          <div><span class="lc-k">NO.:</span><span class="lc-v">${esc(d.seat)}</span></div>
          <span class="lc-icon"><i data-lucide="flower-2"></i></span>
          <p class="tk-mood">${esc(d.mood)}</p>
        </div>
        <span class="fx-layer fx-glitter fx-glitter--rose" aria-hidden="true"></span>
      </article>`;
    },
  });

  const DUAL_PHOTO_STYLE_IDS = new Set([
    'cinema-twoup',
    'stamp-four',
    'cinema-sheet',
    'stamp-sheet',
    'concert-roundtrip',
    'city-collage',
  ]);

  const TRIP_LAYOUT_BY_ID = Object.fromEntries([
    ...TRAVEL_TRIPS.map((t) => [t[0], t[4]]),
    ...CONCERT_TRIPS.map((t) => [t[0], t[4]]),
  ]);

  function photoSlotCount(styleId) {
    if (DUAL_PHOTO_STYLE_IDS.has(styleId)) return 2;
    if (TRIP_LAYOUT_BY_ID[styleId] === 'duo') return 2;
    return 1;
  }

  function findStyle(styleId) {
    for (const cat of CATEGORIES) {
      const s = cat.styles.find((x) => x.id === styleId);
      if (s) return { cat, style: s };
    }
    return { cat: CATEGORIES[0], style: CATEGORIES[0].styles[0] };
  }

  function defaultPhotoFor(styleIdOrCatId) {
    if (DEFAULT_PHOTOS[styleIdOrCatId]) return DEFAULT_PHOTOS[styleIdOrCatId];
    const found = findStyle(styleIdOrCatId);
    return DEFAULT_PHOTOS[found.cat.id] || DEFAULT_PHOTO;
  }

  function normalizePhotoUrls(photos, styleId) {
    const n = photoSlotCount(styleId);
    const def = defaultPhotoFor(styleId);
    const list = Array.isArray(photos) ? photos : photos != null && photos !== '' ? [photos] : [];
    return Array.from({ length: n }, (_, i) => list[i] || def);
  }

  function renderTicket(styleId, data, photos) {
    const urls = normalizePhotoUrls(photos, styleId);
    const fn = renderers[styleId] || renderers['cinema-tear'];
    if (photoSlotCount(styleId) > 1) return fn(data, urls);
    return fn(data, urls[0]);
  }

  global.TicketKit = {
    DEFAULT_PHOTO,
    DEFAULT_PHOTOS,
    defaultPhotoFor,
    photoSlotCount,
    CATEGORIES,
    findStyle,
    renderTicket,
  };
})(window);
