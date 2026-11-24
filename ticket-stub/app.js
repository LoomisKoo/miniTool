/**
 * 票根分类、风格与字段配置 + HTML 模板
 */
(function (global) {
  // 按分类的柔焦占位图：中心构图，cover 裁切不易露馅
  const DEFAULT_PHOTOS = {
    cinema: 'assets/default-cinema.jpg',
    travel: 'assets/default-travel.jpg',
    concert: 'assets/default-concert.jpg',
    city: 'assets/default-city.jpg',
    stamp: 'assets/default-stamp.jpg',
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

  /* 复古印刷券：4 种结构 × 配色，[id, 名称, 说明, 结构, 配色, 分类, [图标], 默认值]
     liner=凹角横版船票 circus=拱顶主券+花边存根 badge=六角徽章 gallery=上下两段画廊券 */
  const VINTAGE_TICKETS = [
    ['vt-liner-teal', '远洋船票', '横图 16:9 · 凹角金框 + 撕线存根', 'liner', 'teal', 'travel', ['ship', 'compass'],
      { title: 'OCEAN LINER', place: 'GRAND VOYAGE', datetime: '2026.06.18', seat: 'NO.0417', mood: '甲板上的风，一直吹到了下一个港口' }],
    ['vt-liner-wine', '酒红航券', '横图 16:9 · 凹角金框 + 撕线存根', 'liner', 'wine', 'travel', ['train-front', 'map'],
      { title: 'ORIENT EXPRESS', place: 'NIGHT TRAIN', datetime: '2026.11.02', seat: 'NO.1908', mood: '窗外的灯一盏一盏往后退' }],
    ['vt-liner-forest', '林绿航券', '横图 16:9 · 凹角金框 + 撕线存根', 'liner', 'forest', 'travel', ['plane', 'globe'],
      { title: 'SKY CLIPPER', place: 'FIRST FLIGHT', datetime: '2026.03.21', seat: 'NO.0032', mood: '云层下面，是还没去过的地方' }],
    ['vt-badge-olive', '山野徽章', '方图 1:1 · 六角徽章 + 缝线', 'badge', 'olive', 'travel', ['mountain', 'trees'],
      { title: 'ADVENTURE PASS', place: 'MOUNTAIN RETREAT', datetime: '2026.08.09', seat: 'NO.0726', mood: 'VALID FOR ONE YEAR' }],
    ['vt-badge-lake', '湖畔徽章', '方图 1:1 · 六角徽章 + 缝线', 'badge', 'lake', 'travel', ['tent', 'waves'],
      { title: 'LAKESIDE CAMP', place: 'SUMMER CLUB', datetime: '2026.07.04', seat: 'NO.0311', mood: '篝火熄了，星星还亮着' }],
    ['vt-badge-plum', '花园徽章', '方图 1:1 · 六角徽章 + 缝线', 'badge', 'plum', 'city', ['flower-2', 'leaf'],
      { title: 'ROSE GARDEN', place: 'BOTANIC PASS', datetime: '2026.05.12', seat: 'NO.0520', mood: '一整个下午，都是花香' }],
    ['vt-circus-red', '马戏大棚', '竖图 3:4 · 拱顶主券 + 花边存根', 'circus', 'red', 'concert', ['tent', 'crown'],
      { title: 'CIRCUS WONDERS', place: 'BIG TOP · A区', datetime: '2026.10.01  19:30', seat: 'NO.12345', mood: '灯一亮，所有人都变回了小孩' }],
    ['vt-circus-navy', '歌剧拱券', '竖图 3:4 · 拱顶主券 + 花边存根', 'circus', 'navy', 'concert', ['drama', 'music'],
      { title: 'OPERA NIGHT', place: '大剧院 · 池座', datetime: '2026.12.24  19:00', seat: 'NO.00824', mood: '最后一个高音，全场都屏住了呼吸' }],
    ['vt-circus-green', '剧场拱券', '竖图 3:4 · 拱顶主券 + 花边存根', 'circus', 'green', 'cinema', ['clapperboard', 'popcorn'],
      { title: 'MATINEE SHOW', place: '老影院 · 3号厅', datetime: '2026.04.18  14:00', seat: 'NO.00217', mood: '午后的场次，整个厅只有十个人' }],
    ['vt-gallery-navy', '画廊展券', '横图 16:9 · 两段式 + 侧边缺口', 'gallery', 'navy', 'city', ['landmark', 'palette'],
      { title: 'Grand Art Exhibition', place: 'GALLERY 4A', datetime: '2026.09.14', seat: 'NO.0916', mood: 'PRIVATE VIEW' }],
    ['vt-gallery-emerald', '翡翠展券', '横图 16:9 · 两段式 + 侧边缺口', 'gallery', 'emerald', 'city', ['gem', 'sparkles'],
      { title: 'Jade & Porcelain', place: '东方馆 · 2F', datetime: '2026.06.06', seat: 'NO.0606', mood: '釉色里藏着一整片湖' }],
    ['vt-gallery-wine', '酒红展券', '横图 16:9 · 两段式 + 侧边缺口', 'gallery', 'wine', 'cinema', ['film', 'star'],
      { title: 'Silver Screen', place: '经典影展 · 1号厅', datetime: '2026.02.14', seat: 'ROW 5 · 08', mood: '黑白片里的吻，比彩色的更久' }],
  ];

  /* 胶带相片票：照片 + 圆孔撕线 + 信息栏 + 条码，[id, 名称, 说明, 配色, 照片位置, 标题字体, 胶带, 圆角, 分类, 默认值]
     胶带：kraft=牛皮纸 grid=格纹 ''=不贴 */
  const SNAP_TICKETS = [
    ['sn-sage', '竹影相片票', '横图 4:3 · 左图右文 + 手写标题 + 胶带', 'sage', 'left', 'script', 'kraft', false, 'city',
      { title: 'Framing The Present Moment', place: 'MONDAY', datetime: 'Jun 29,2026', seat: '9:49 AM', mood: '' }],
    ['sn-blush', '樱粉相片票', '横图 4:3 · 左文右图 + 圆角', 'blush', 'right', 'serif', '', true, 'city',
      { title: '「Through The Lens Exhibition」', place: 'FRIDAY', datetime: 'Jul 10,2026', seat: '2:32 PM', mood: '' }],
    ['sn-moss', '墨绿相片票', '横图 4:3 · 深色信息栏 + 格纹胶带', 'moss', 'left', 'sans', 'grid', false, 'city',
      { title: '中国湿地博物馆', place: 'SATURDAY', datetime: 'Jul 18,2026', seat: '2:50 PM', mood: '🎫 / 🎟️ · 🦢 / 🦌 ·' }],
    ['sn-sky', '晴空相片票', '横图 4:3 · 左文右图 + 手写标题 + 胶带', 'sky', 'right', 'script', 'kraft', false, 'travel',
      { title: 'Somewhere By The Sea', place: 'SUNDAY', datetime: 'Aug 16,2026', seat: '5:20 PM', mood: '' }],
    ['sn-night', '夜航相片票', '横图 4:3 · 深色圆角 + 左图右文', 'night', 'left', 'sans', '', true, 'travel',
      { title: '去看一场日落', place: 'WEDNESDAY', datetime: 'Sep 02,2026', seat: '6:48 PM', mood: '🌅 / 🚃 · 🐚 / 🌊 ·' }],
    ['sn-cream', '奶油相片票', '横图 4:3 · 左文右图 + 格纹胶带', 'cream', 'right', 'serif', 'grid', false, 'cinema',
      { title: 'Midnight Screening', place: 'THURSDAY', datetime: 'Oct 22,2026', seat: '11:30 PM', mood: '' }],
  ];

  const SNAP_LABELS = ['标题', '星期 / 副题', '日期', '时间', '贴纸 / 短句（可空）'];

  const VINTAGE_LABELS = {
    liner: ['目的地 / 大标题', '副题 / 航线', '日期', '票号', '旅行短句'],
    badge: ['大标题', '副题', '签发日期', '会员号', '底部短句'],
    circus: ['演出名', '场馆 / 区域', '日期场次', '票号', '一句话'],
    gallery: ['展名', '展厅', '日期', '票号', '观展短评'],
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

  function vintageStyleEntries(cat) {
    return VINTAGE_TICKETS.filter((t) => t[5] === cat).map(([id, name, desc, variant, , , , dv]) => ({
      id,
      name,
      desc,
      fields: fieldsOf(VINTAGE_LABELS[variant], dv),
    }));
  }

  function snapStyleEntries(cat) {
    return SNAP_TICKETS.filter((t) => t[8] === cat).map(([id, name, desc, , , , , , , dv]) => ({
      id,
      name,
      desc,
      fields: fieldsOf(SNAP_LABELS, dv),
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
        ...vintageStyleEntries('cinema'),
        ...snapStyleEntries('cinema'),
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
        ...vintageStyleEntries('travel'),
        ...snapStyleEntries('travel'),
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
        ...vintageStyleEntries('concert'),
        ...snapStyleEntries('concert'),
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
        ...vintageStyleEntries('city'),
        ...snapStyleEntries('city'),
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
    return String(s == null ? '' : s)
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
      // 两张票根各带一个照片位，必须显式传 slot：
      // 都退回默认 0 的话，两张图会被当成同一个槽位（改一张两张都变，第二张也无法调）
      const pane = (flag, tag, photo, slot) => `<div class="tw-pane${flag}">
        <span class="tw-head">${tag}</span>
        ${photoBox(photo, 'tw-photo', slot)}
        <h3 class="tk-title">${esc(d.title)}</h3>
        <p class="tk-place">${esc(d.place)}</p>
        <div class="tw-row"><span>${esc(d.datetime)}</span><span>${esc(d.seat)}</span></div>
      </div>`;
      return `<article class="tk tk-cinema-twoup tk-2div">
        ${pane('', 'ADMIT ONE', p0, 0)}
        ${pane(' tw-pane--b', 'ADMIT TWO', p1, 1)}
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
      // 往返两张票各是一个独立照片位：slot 不传会都退回 0，导致两张图联动且第二张无法调
      const half = (tag, seat, photo, slot) => `<div class="rt2-half">
        ${photoBox(photo, '', slot)}
        <div>
          <span class="rt2-tag">${tag}</span>
          <h3 class="tk-title">${esc(d.title)}</h3>
          <p class="tk-place">${esc(d.place)}</p>
          <div class="rt2-row"><span>${esc(d.datetime)}</span><span>${seat}</span></div>
        </div>
      </div>`;
      return `<article class="tk tk-concert-roundtrip">
        ${half('OUTBOUND · 去', esc(d.seat), p0, 0)}
        ${half('RETURN · 返', esc(d.seat), p1, 1)}
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

  function vintageRenderer(variant, pal, icons) {
    const ico = (i) => `<i data-lucide="${icons[i]}"></i>`;
    return (d, photo) => {
      const title = `<h3 class="tk-title">${esc(d.title)}</h3>`;
      const place = `<p class="tk-place">${esc(d.place)}</p>`;
      const mood = `<p class="tk-mood">${esc(d.mood)}</p>`;
      const line = (k, v) => `<div class="vt-line"><span>${k}</span><b>${esc(v)}</b></div>`;
      let body = '';

      if (variant === 'liner') {
        body = `<span class="vt-frame" aria-hidden="true"></span>
          <div class="vt-main">
            ${place}${title}
            <div class="vt-shotrow">
              <span class="vt-ico">${ico(0)}</span>
              ${photoBox(photo, 'vt-photo')}
              <span class="vt-ico">${ico(1)}</span>
            </div>
            <div class="vt-lines">${line('DATE:', d.datetime)}${line('NO.', d.seat)}</div>
            ${mood}
          </div>
          <div class="vt-stub"><span class="vt-ico">${ico(0)}</span><b>${esc(d.seat)}</b></div>`;
      } else if (variant === 'circus') {
        body = `<div class="vt-arch">
            ${title}
            ${photoBox(photo, 'vt-photo')}
            ${mood}
          </div>
          <div class="vt-stub">
            <span class="vt-ico">${ico(0)}</span>
            <p class="vt-admit">ADMIT ONE</p>
            <span class="vt-ico vt-ico--big">${ico(1)}</span>
            <p class="vt-no">${esc(d.seat)}</p>
            ${line('DATE:', d.datetime)}
            ${line('SECTION:', d.place)}
          </div>`;
      } else if (variant === 'badge') {
        body = `<svg class="vt-stitch" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon points="31.5,2.6 68.5,2.6 96.6,19.6 96.6,80.4 68.5,97.4 31.5,97.4 3.4,80.4 3.4,19.6" />
          </svg>
          <div class="vt-top"><span class="vt-ico">${ico(0)}</span>${place}${title}</div>
          <div class="vt-mid">
            <span class="vt-ico">${ico(0)}</span>
            ${photoBox(photo, 'vt-photo')}
            <span class="vt-ico">${ico(1)}</span>
          </div>
          <div class="vt-foot">${mood}${line('NO.', d.seat)}${line('ISSUED:', d.datetime)}</div>`;
      } else {
        const md = String(d.datetime).match(/\d{4}\D(\d{1,2})\D(\d{1,2})/);
        const big = md ? `${md[1]}.${md[2]}` : String(d.datetime).slice(0, 5);
        body = `<div class="vt-upper">
            <span class="vt-frame" aria-hidden="true"></span>
            ${title}
            <div class="vt-shotrow">
              ${photoBox(photo, 'vt-photo')}
              <p class="vt-big">${esc(big)}</p>
            </div>
          </div>
          <div class="vt-lower">
            <span class="vt-frame" aria-hidden="true"></span>
            <span class="vt-ico">${ico(0)}</span>
            <div class="vt-card">
              <p class="vt-admit">ADMIT ONE</p>
              ${mood}${place}
              ${line('DATE:', d.datetime)}
            </div>
            <span class="vt-ico">${ico(1)}</span>
          </div>`;
      }

      return `<article class="tk tk-vt tk-vt--${variant} tk-vt--${pal}">
        ${body}
        <span class="fx-layer fx-glitter" aria-hidden="true"></span>
      </article>`;
    };
  }

  VINTAGE_TICKETS.forEach(([id, , , variant, pal, , icons]) => {
    renderers[id] = vintageRenderer(variant, pal, icons);
  });

  function snapRenderer(pal, side, font, tape, round) {
    const cls = [
      'tk tk-snap',
      `tk-snap--${pal}`,
      `tk-snap--font-${font}`,
      side === 'right' ? 'tk-snap--flip' : '',
      round ? 'tk-snap--round' : '',
    ].filter(Boolean).join(' ');
    const tapes = tape
      ? `<span class="sn-tape sn-tape--${tape} sn-tape--a" aria-hidden="true"></span>
        <span class="sn-tape sn-tape--${tape} sn-tape--b" aria-hidden="true"></span>`
      : '';
    return (d, photo) => {
      const shot = `<div class="sn-shot">${photoBox(photo, 'sn-photo')}</div>`;
      const info = `<div class="sn-info">
          <p class="sn-tag">TICKET<i aria-hidden="true"></i></p>
          <h3 class="tk-title">${esc(d.title)}</h3>
          ${d.mood ? `<p class="tk-mood">${esc(d.mood)}</p>` : ''}
          <div class="sn-when"><b>${esc(d.seat)}</b><span>${esc(d.place)}</span><span>${esc(d.datetime)}</span></div>
          <div class="sn-bar"><span aria-hidden="true"></span><em>ADMIT ONE</em></div>
        </div>`;
      return `<article class="${cls}">
        <div class="sn-card">
          ${side === 'right' ? info : shot}
          <span class="sn-perf" aria-hidden="true"></span>
          ${side === 'right' ? shot : info}
          <span class="fx-layer fx-glitter" aria-hidden="true"></span>
        </div>
        ${tapes}
      </article>`;
    };
  }

  SNAP_TICKETS.forEach(([id, , , pal, side, font, tape, round]) => {
    renderers[id] = snapRenderer(pal, side, font, tape, round);
  });

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

/**
 * 票根用户特效：目录、实例、挂载到 背景 / 照片 / 前景
 */
(function (global) {
  const LAYERS = [
    { id: 'bg', label: '背景' },
    { id: 'photo', label: '照片' },
    { id: 'top', label: '前景' },
  ];

  const TABS = [
    { id: 'texture', label: '纹理' },
    { id: 'pattern', label: '图案' },
    { id: 'stamp', label: '印章' },
    { id: 'text', label: '文字' },
    { id: 'light', label: '光效' },
    { id: 'material', label: '纸感' },
  ];

  const FONTS = [
    { id: 'ticket', label: '票券', family: "'JetBrains Mono', ui-monospace, monospace" },
    { id: 'memo', label: '纪念', family: "'Instrument Serif', Georgia, serif" },
    { id: 'body', label: '正文', family: "'DM Sans', system-ui, sans-serif" },
    { id: 'news', label: '晚报', family: "Georgia, 'Times New Roman', serif" },
    { id: 'steel', label: '钢印', family: "Impact, 'Arial Black', sans-serif" },
  ];

  const BORDER_STYLES = [
    { id: 'solid', label: '实线' },
    { id: 'dashed', label: '虚线' },
    { id: 'double', label: '双线' },
  ];

  const BORDER_SHAPES = [
    { id: 'rect', label: '直角' },
    { id: 'round', label: '圆角' },
    { id: 'pill', label: '胶囊' },
  ];

  const GLITTER_SHAPES = [
    { id: 'dot', label: '细点' },
    { id: 'spark', label: '圆点' },
    { id: 'star', label: '星点' },
    { id: 'cross', label: '十字' },
    { id: 'diamond', label: '菱形' },
  ];

  const COLORS = [
    '#1a1612', '#5c4033', '#8b1a1a', '#a67c2a', '#2f5d50',
    '#1e3a5f', '#6b2d5c', '#f6f1e8', '#c4b5a0', '#e8c27a',
  ];

  /** @type {Array<object>} */
  const CATALOG = [
    // —— 纹理 ——
    { id: 'tex-paper', tab: 'texture', name: '纸纹', hint: '做旧', kind: 'fill', css: 'ufx-paper', defaultOpacity: 0.45, hasColor: true, defaultColor: '#5c4033', hasDensity: true },
    { id: 'tex-grain', tab: 'texture', name: '胶片颗粒', hint: '做旧', kind: 'fill', css: 'ufx-grain', defaultOpacity: 0.4, hasDensity: true },
    { id: 'tex-halftone', tab: 'texture', name: '网点', hint: '报刊', kind: 'fill', css: 'ufx-halftone', defaultOpacity: 0.35, hasColor: true, defaultColor: '#1a1612', hasDensity: true },
    { id: 'tex-linen', tab: 'texture', name: '亚麻', hint: '布纹', kind: 'fill', css: 'ufx-linen', defaultOpacity: 0.38, hasColor: true, defaultColor: '#6b5a48', hasDensity: true },
    { id: 'tex-diag', tab: 'texture', name: '斜纹', hint: '票券', kind: 'fill', css: 'ufx-diag', defaultOpacity: 0.28, hasColor: true, defaultColor: '#1a1612', hasDensity: true },
    { id: 'tex-noise', tab: 'texture', name: '噪点', hint: '做旧', kind: 'fill', css: 'ufx-noise', defaultOpacity: 0.32, hasDensity: true },

    // —— 图案 ——
    { id: 'pat-corners', tab: 'pattern', name: '角花', hint: '装饰', kind: 'fill', css: 'ufx-corners', defaultOpacity: 0.55, hasColor: true, defaultColor: '#a67c2a' },
    { id: 'pat-dash', tab: 'pattern', name: '虚线边', hint: '票券', kind: 'fill', css: 'ufx-dashborder', defaultOpacity: 0.5, hasColor: true, defaultColor: '#5c4033' },
    { id: 'pat-stars', tab: 'pattern', name: '星点', hint: '点缀', kind: 'fill', css: 'ufx-stars', defaultOpacity: 0.45, hasColor: true, defaultColor: '#e8c27a', hasDensity: true },
    { id: 'pat-grid', tab: 'pattern', name: '地图格', hint: '旅行', kind: 'fill', css: 'ufx-mapgrid', defaultOpacity: 0.3, hasColor: true, defaultColor: '#1e3a5f', hasDensity: true },
    { id: 'pat-waves', tab: 'pattern', name: '水纹', hint: '轻柔', kind: 'fill', css: 'ufx-waves', defaultOpacity: 0.35, hasColor: true, defaultColor: '#2f5d50', hasDensity: true },

    // —— 印章 ——
    { id: 'stp-postmark', tab: 'stamp', name: '邮戳', hint: '做旧', kind: 'stamp', movable: true, hasText: true, defaultText: 'POSTED', defaultOpacity: 0.72, hasColor: true, defaultColor: '#8b1a1a', font: 'steel', rotate: -18, shape: 'postmark' },
    { id: 'stp-approved', tab: 'stamp', name: '钢印 APPROVED', hint: '纪念', kind: 'stamp', movable: true, hasText: true, defaultText: 'APPROVED', defaultOpacity: 0.7, hasColor: true, defaultColor: '#8b1a1a', font: 'steel', rotate: -14, shape: 'rect' },
    { id: 'stp-checked', tab: 'stamp', name: '已验票', hint: '纪念', kind: 'stamp', movable: true, hasText: true, defaultText: '已验票', defaultOpacity: 0.75, hasColor: true, defaultColor: '#8b1a1a', font: 'steel', rotate: -10, shape: 'roundrect' },
    { id: 'stp-paid', tab: 'stamp', name: 'PAID', hint: '票务', kind: 'stamp', movable: true, hasText: true, defaultText: 'PAID', defaultOpacity: 0.7, hasColor: true, defaultColor: '#1e3a5f', font: 'steel', rotate: 12, shape: 'oval' },
    { id: 'stp-custom', tab: 'stamp', name: '自定义章', hint: '可改字', kind: 'stamp', movable: true, hasText: true, defaultText: 'MEMENTO', defaultOpacity: 0.72, hasColor: true, defaultColor: '#5c4033', font: 'memo', rotate: -8, shape: 'roundrect' },
    { id: 'stp-wax', tab: 'stamp', name: '火漆', hint: '装饰', kind: 'stamp', movable: true, hasText: false, defaultOpacity: 0.85, shape: 'wax' },

    // —— 文字 ——
    { id: 'txt-custom', tab: 'text', name: '自定义字', hint: '可改字', kind: 'stamp', movable: true, hasText: true, textControls: true, defaultText: '在此输入', defaultOpacity: 0.85, hasColor: true, defaultColor: '#1a1612', font: 'memo', rotate: -8, shape: 'plain', defaultBorder: true },
    { id: 'txt-time', tab: 'text', name: '时间戳', hint: '纪念', kind: 'stamp', movable: true, hasText: true, textControls: true, defaultText: '', textMode: 'datetime', defaultOpacity: 0.65, hasColor: true, defaultColor: '#1a1612', font: 'ticket', rotate: 0, shape: 'plain', defaultBorder: false },
    { id: 'txt-mark', tab: 'text', name: '水印字', hint: '可改字', kind: 'stamp', movable: true, hasText: true, textControls: true, defaultText: 'TICKET', defaultOpacity: 0.35, hasColor: true, defaultColor: '#1a1612', font: 'memo', rotate: -24, shape: 'plain', defaultBorder: false },
    { id: 'txt-diag', tab: 'text', name: '斜向水印', hint: '满铺感', kind: 'fill', css: 'ufx-diagtext', defaultOpacity: 0.18, hasText: true, defaultText: 'ARCHIVE', hasColor: true, defaultColor: '#1a1612', font: 'steel', hasDensity: true },

    // —— 光效 ——
    { id: 'lit-glitter', tab: 'light', name: '闪粉', hint: '炫', kind: 'fill', css: 'ufx-glitter', defaultOpacity: 0.5, hasDensity: true, hasGlitter: true, defaultGlitterShape: 'dot' },
    { id: 'lit-rose', tab: 'light', name: '玫瑰金粉', hint: '炫', kind: 'fill', css: 'ufx-glitter-rose', defaultOpacity: 0.42, hasDensity: true, hasGlitter: true, defaultGlitterShape: 'dot' },
    { id: 'lit-vignette', tab: 'light', name: '暗角', hint: '做旧', kind: 'fill', css: 'ufx-vignette', defaultOpacity: 0.55 },
    { id: 'lit-leak', tab: 'light', name: '漏光', hint: '胶片', kind: 'fill', css: 'ufx-leak', defaultOpacity: 0.4, hasColor: true, defaultColor: '#e8a060' },
    { id: 'lit-neon', tab: 'light', name: '霓虹雾', hint: '炫', kind: 'fill', css: 'ufx-neon', defaultOpacity: 0.45, hasColor: true, defaultColor: '#ff4d8d' },
    { id: 'lit-beam', tab: 'light', name: '放映光', hint: '电影', kind: 'fill', css: 'ufx-beam', defaultOpacity: 0.35 },
  ];

  const byId = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

  function uid() {
    return 'fx' + Math.random().toString(36).slice(2, 9);
  }

  function fontFamily(id) {
    const f = FONTS.find((x) => x.id === id);
    return f ? f.family : FONTS[0].family;
  }

  function resolveText(item, params, ticketData) {
    if (item.textMode === 'datetime') {
      if (params.text && params.text.trim()) return params.text;
      if (ticketData && ticketData.datetime) return ticketData.datetime;
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    return params.text != null ? params.text : item.defaultText || '';
  }

  function createInstance(catalogId, target, ticketData) {
    const item = byId[catalogId];
    if (!item) return null;
    const params = {
      opacity: item.defaultOpacity != null ? item.defaultOpacity : 0.5,
      density: 1,
      scale: 1,
      rotate: item.rotate != null ? item.rotate : 0,
      x: item.movable ? 70 : 50,
      y: item.movable ? 22 : 50,
      color: item.defaultColor || '#5c4033',
      font: item.font || 'memo',
      text: item.defaultText || '',
      border: !!item.defaultBorder,
      borderStyle: 'solid',
      borderShape: 'round',
      fontSize: item.textControls ? 16 : 15,
      glitterShape: item.defaultGlitterShape || 'dot',
      glitterSize: 1,
    };
    if (item.textMode === 'datetime') {
      params.text = resolveText(item, params, ticketData);
    }
    // 印章默认挂顶层更合理；调用方可覆盖
    const layer = target || (item.movable ? 'top' : 'bg');
    return { id: uid(), catalogId, target: layer, params };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderStampInner(item, params, ticketData) {
    const text = resolveText(item, params, ticketData) || ' ';
    const color = params.color || item.defaultColor || '#8b1a1a';
    const font = fontFamily(params.font || item.font || 'steel');
    const fontSize = params.fontSize != null ? params.fontSize : 15;

    if (item.shape === 'wax') {
      return `<span class="ufx-wax" aria-hidden="true"></span>`;
    }
    if (item.shape === 'postmark') {
      return `<span class="ufx-postmark" style="color:${esc(color)};font-family:${font}">
        <span class="ufx-postmark-ring"></span>
        <span class="ufx-postmark-text">${esc(text)}</span>
      </span>`;
    }

    // 文字特效：可开关边框 + 边框样式
    if (item.shape === 'plain' || item.textControls) {
      const borderOn = !!params.border;
      const bStyle = params.borderStyle || 'solid';
      const bShape = params.borderShape || 'round';
      const cls = [
        'ufx-plain',
        borderOn ? 'ufx-plain--border' : '',
        borderOn ? `ufx-plain--${bStyle}` : '',
        borderOn ? `ufx-plain--shape-${bShape}` : '',
      ].filter(Boolean).join(' ');
      return `<span class="${cls}" style="color:${esc(color)};border-color:${esc(color)};font-family:${font};font-size:${fontSize}px">${esc(text)}</span>`;
    }

    if (item.shape === 'oval') {
      return `<span class="ufx-stamp ufx-stamp--oval" style="color:${esc(color)};border-color:${esc(color)};font-family:${font};font-size:${fontSize}px">${esc(text)}</span>`;
    }
    if (item.shape === 'rect') {
      return `<span class="ufx-stamp ufx-stamp--rect" style="color:${esc(color)};border-color:${esc(color)};font-family:${font};font-size:${fontSize}px">${esc(text)}</span>`;
    }
    return `<span class="ufx-stamp ufx-stamp--round" style="color:${esc(color)};border-color:${esc(color)};font-family:${font};font-size:${fontSize}px">${esc(text)}</span>`;
  }

  function renderInstanceHTML(inst, ticketData, selectedId) {
    const item = byId[inst.catalogId];
    if (!item) return '';
    const p = inst.params || {};
    const op = p.opacity != null ? p.opacity : 0.5;
    const dens = p.density != null ? p.density : 1;
    const selected = inst.id === selectedId ? ' is-selected' : '';

    if (item.kind === 'fill') {
      const color = p.color || item.defaultColor || 'currentColor';
      const font = fontFamily(p.font || item.font || 'steel');
      const text = item.hasText ? resolveText(item, p, ticketData) : '';
      const gShape = p.glitterShape || item.defaultGlitterShape || 'dot';
      const gSize = p.glitterSize != null ? p.glitterSize : 1;
      const shapeCls = item.hasGlitter ? ` ufx-glitter--shape-${esc(gShape)}` : '';
      const glitterBase = item.id === 'lit-rose' ? 130 : 110;
      const glitterPx = Math.round(glitterBase * gSize);
      const glitterVar = item.hasGlitter ? `--ufx-glitter-size:${glitterPx}px;` : '';
      return `<div class="ufx-item ufx-fill ${item.css || ''}${shapeCls}${selected}" data-fx-id="${esc(inst.id)}"
        style="opacity:${op};color:${esc(color)};--ufx-density:${dens};${glitterVar}--ufx-text:'${esc(text).replace(/'/g, '\\\'')}';font-family:${font}"
        aria-hidden="true"></div>`;
    }

    // stamp / movable
    const scale = p.scale != null ? p.scale : 1;
    const rotate = p.rotate != null ? p.rotate : 0;
    const x = p.x != null ? p.x : 50;
    const y = p.y != null ? p.y : 50;
    return `<div class="ufx-item ufx-movable${selected}" data-fx-id="${esc(inst.id)}"
      style="left:${x}%;top:${y}%;opacity:${op};transform:translate(-50%,-50%) rotate(${rotate}deg) scale(${scale})">
      ${renderStampInner(item, p, ticketData)}
    </div>`;
  }

  function ensureSlots(ticket) {
    if (!ticket) return;
    if (!ticket.querySelector('[data-fx-slot="bg"]')) {
      const el = document.createElement('div');
      el.className = 'fx-user-slot fx-user-slot--bg';
      el.dataset.fxSlot = 'bg';
      ticket.insertBefore(el, ticket.firstChild);
    }
    ticket.querySelectorAll('.photo-frame').forEach((frame) => {
      if (!frame.querySelector('[data-fx-slot="photo"]')) {
        const el = document.createElement('div');
        el.className = 'fx-user-slot fx-user-slot--photo';
        el.dataset.fxSlot = 'photo';
        frame.appendChild(el);
      }
    });
    if (!ticket.querySelector('[data-fx-slot="top"]')) {
      const el = document.createElement('div');
      el.className = 'fx-user-slot fx-user-slot--top';
      el.dataset.fxSlot = 'top';
      ticket.appendChild(el);
    }
  }

  function mount(ticket, instances, opts) {
    if (!ticket) return;
    const ticketData = (opts && opts.ticketData) || {};
    const selectedId = opts && opts.selectedId;
    const editing = !!(opts && opts.editing);

    ensureSlots(ticket);
    ticket.classList.toggle('is-fx-editing', editing);

    const groups = { bg: [], photo: [], top: [] };
    (instances || []).forEach((inst) => {
      const t = groups[inst.target] ? inst.target : 'top';
      groups[t].push(inst);
    });

    ['bg', 'photo', 'top'].forEach((layer) => {
      const html = groups[layer].map((inst) => renderInstanceHTML(inst, ticketData, selectedId)).join('');
      ticket.querySelectorAll(`[data-fx-slot="${layer}"]`).forEach((slot) => {
        slot.innerHTML = html;
      });
    });
  }

  function stripUserFx(root) {
    if (!root) return;
    root.querySelectorAll('.fx-user-slot, .ufx-item').forEach((n) => n.remove());
    root.classList.remove('is-fx-editing');
  }

  function catalogByTab(tabId) {
    return CATALOG.filter((c) => c.tab === tabId);
  }

  function getItem(id) {
    return byId[id];
  }

  global.TicketEffects = {
    LAYERS,
    TABS,
    FONTS,
    COLORS,
    BORDER_STYLES,
    BORDER_SHAPES,
    GLITTER_SHAPES,
    CATALOG,
    createInstance,
    mount,
    stripUserFx,
    catalogByTab,
    getItem,
    resolveText,
    fontFamily,
  };
})(window);

/**
 * 票根「纸感 3D」：DOM 光栅化纹理 + WebGL 光照/纸纹着色（预览与导出同源）
 */
(function (global) {
  const PRESETS = {
    matte: { label: '哑光纸', grain: 0.42, warmth: 0.1, specular: 0.22, curl: 0.12 },
    vintage: { label: '复古纸', grain: 0.68, warmth: 0.2, specular: 0.12, curl: 0.18 },
    card: { label: '卡纸', grain: 0.28, warmth: 0.06, specular: 0.42, curl: 0.08 },
  };

  const VERT = `
    varying vec2 vUv;
    uniform float uCurl;
    void main() {
      vUv = uv;
      vec3 pos = position;
      float edge = 1.0 - abs(uv.y - 0.5) * 2.0;
      pos.z += uCurl * sin(uv.x * 3.14159265) * edge * 0.12;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const FRAG = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uMap;
    uniform vec3 uLightDir;
    uniform float uGrain;
    uniform float uWarmth;
    uniform float uSpecular;
    uniform vec2 uTexel;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec4 base = texture2D(uMap, vUv);
      if (base.a < 0.02) discard;

      float g = (hash(vUv * 900.0 + uTexel * 12.0) - 0.5) * uGrain * 0.11;
      vec3 col = base.rgb + g;
      col = mix(col, col * vec3(1.06, 1.02, 0.92), uWarmth);

      vec3 n = normalize(vec3(
        (hash(vUv * 1200.0) - 0.5) * uGrain * 0.35,
        (hash(vUv * 1200.0 + 1.7) - 0.5) * uGrain * 0.35,
        1.0
      ));
      vec3 l = normalize(uLightDir);
      float diff = clamp(dot(n, l), 0.0, 1.0) * 0.38 + 0.62;
      vec3 v = vec3(0.0, 0.0, 1.0);
      vec3 h = normalize(l + v);
      float spec = pow(clamp(dot(n, h), 0.0, 1.0), 48.0) * uSpecular;

      col *= diff;
      col += spec * vec3(1.0, 0.98, 0.94);

      float vig = smoothstep(0.92, 0.38, length(vUv - 0.5) * 1.25);
      col *= mix(0.86, 1.0, vig);

      gl_FragColor = vec4(col, base.a);
    }
  `;

  function presetParams(id) {
    return PRESETS[id] || PRESETS.matte;
  }

  function attach(hostEl) {
    if (!global.THREE || !hostEl) return null;

    const wrap = hostEl.querySelector('.paper-gl-wrap');
    const canvas = hostEl.querySelector('.paper-gl-canvas');
    const busyEl = hostEl.querySelector('.paper-gl-busy');
    if (!wrap || !canvas) return null;

    const THREE = global.THREE;
    let disposed = false;
    let w = 2;
    let h = 2;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    camera.position.z = 2;

    const geo = new THREE.PlaneGeometry(1, 1, 32, 24);
    const tex = new THREE.Texture();
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    const uniforms = {
      uMap: { value: tex },
      uLightDir: { value: new THREE.Vector3(-0.35, 0.45, 0.82) },
      uGrain: { value: PRESETS.matte.grain },
      uWarmth: { value: PRESETS.matte.warmth },
      uSpecular: { value: PRESETS.matte.specular },
      uCurl: { value: PRESETS.matte.curl },
      uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    function resize(wPx, hPx) {
      if (wPx < 2 || hPx < 2) return;
      w = wPx;
      h = hPx;
      const aspect = w / h;
      if (aspect >= 1) {
        camera.left = -0.5 * aspect;
        camera.right = 0.5 * aspect;
        camera.top = 0.5;
        camera.bottom = -0.5;
      } else {
        camera.left = -0.5;
        camera.right = 0.5;
        camera.top = 0.5 / aspect;
        camera.bottom = -0.5 / aspect;
      }
      camera.updateProjectionMatrix();
      mesh.scale.set(w, h, 1);
      renderer.setSize(w, h, false);
      wrap.style.width = `${w}px`;
      wrap.style.height = `${h}px`;
      uniforms.uTexel.value.set(1 / w, 1 / h);
    }

    function setParams(opts) {
      const base = presetParams(opts.preset || 'matte');
      uniforms.uGrain.value = opts.grain != null ? opts.grain : base.grain;
      uniforms.uWarmth.value = opts.warmth != null ? opts.warmth : base.warmth;
      uniforms.uSpecular.value = opts.specular != null ? opts.specular : base.specular;
      uniforms.uCurl.value = opts.curl != null ? opts.curl : base.curl;
      if (opts.light != null) {
        const s = opts.light;
        uniforms.uLightDir.value.set(-0.25 - s * 0.35, 0.35 + s * 0.25, 0.78).normalize();
      }
    }

    function setLight(rxDeg, ryDeg) {
      const rx = (rxDeg * Math.PI) / 180;
      const ry = (ryDeg * Math.PI) / 180;
      const x = Math.sin(ry) * 0.65 - 0.2;
      const y = Math.sin(rx) * 0.55 + 0.35;
      const z = 0.72 + Math.cos(rx) * 0.15 + Math.cos(ry) * 0.1;
      uniforms.uLightDir.value.set(x, y, z).normalize();
    }

    function updateFromCanvas(sourceCanvas) {
      if (disposed || !sourceCanvas) return false;
      tex.image = sourceCanvas;
      tex.needsUpdate = true;
      resize(sourceCanvas.width, sourceCanvas.height);
      renderer.render(scene, camera);
      wrap.classList.add('is-ready');
      if (busyEl) busyEl.hidden = true;
      return true;
    }

    function renderFrame() {
      if (!disposed) renderer.render(scene, camera);
    }

    function setBusy(on) {
      if (busyEl) busyEl.hidden = !on;
    }

    function show() {
      wrap.hidden = false;
    }

    function hide() {
      wrap.hidden = true;
      wrap.classList.remove('is-ready');
    }

    function dispose() {
      disposed = true;
      tex.dispose();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    }

    function capturePngFromCanvas(sourceCanvas, params) {
      setParams(params || {});
      updateFromCanvas(sourceCanvas);
      return renderer.domElement.toDataURL('image/png');
    }

    return {
      setParams,
      setLight,
      updateFromCanvas,
      renderFrame,
      setBusy,
      show,
      hide,
      dispose,
      capturePngFromCanvas,
      resize,
    };
  }

  async function rasterizeNode(node, htmlToImage, pixelRatio) {
    if (!htmlToImage || !node) throw new Error('rasterize');
    const opts = {
      pixelRatio: pixelRatio || 1,
      cacheBust: true,
      backgroundColor: null,
    };
    // 字体以 data: 预内联，离线容器里不必再去取字体文件
    if (global.__FONT_EMBED_CSS) opts.fontEmbedCSS = global.__FONT_EMBED_CSS;
    return htmlToImage.toCanvas(node, opts);
  }

  global.TicketPaper = {
    PRESETS,
    DEBOUNCE_MS: 250,
    attach,
    rasterizeNode,
  };
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
  const Kit = window.TicketKit;
  const Fx = window.TicketEffects;
  const $ = (id) => document.getElementById(id);

  const catTabs = $('catTabs');
  const styleGrid = $('styleGrid');
  const styleSheet = $('styleSheet');
  const styleScrim = $('styleScrim');
  const sheetClose = $('sheetClose');
  const sheetTitle = $('sheetTitle');
  const styleTrigger = $('styleTrigger');
  const triggerThumbBox = $('triggerThumbBox');
  const triggerThumb = $('triggerThumb');
  const triggerCat = $('triggerCat');
  const triggerName = $('triggerName');
  const fieldsEl = $('fields');
  const fieldsBtn = $('fieldsBtn');
  const fieldsSheet = $('fieldsSheet');
  const fieldsClose = $('fieldsClose');
  const fieldsScrim = $('fieldsScrim');
  const ticketHost = $('ticketHost');
  const photoInput = $('photoInput');
  const photoSlots = $('photoSlots');
  const exportBtn = $('exportBtn');
  const tiltScene = $('tiltScene');
  const tiltCard = $('tiltCard');
  const fxBtn = $('fxBtn');
  const fxSheet = $('fxSheet');
  const fxClose = $('fxClose');
  const fxLayerBar = $('fxLayerBar');
  const fxTabs = $('fxTabs');
  const fxCatalog = $('fxCatalog');
  const fxUsed = $('fxUsed');
  const fxParams = $('fxParams');
  const fxClearAll = $('fxClearAll');
  const fxScrim = $('fxScrim');
  const fxLayerHint = $('fxLayerHint');
  const fxFooter = $('fxFooter');
  const fxCommitBtn = $('fxCommitBtn');
  const photoSheet = $('photoSheet');
  const photoScrim = $('photoScrim');
  const photoClose = $('photoClose');
  const photoSheetTitle = $('photoSheetTitle');
  const photoAdjustViewport = $('photoAdjustViewport');
  const photoAdjustImg = $('photoAdjustImg');
  const photoReplaceBtn = $('photoReplaceBtn');
  const photoConfirmBtn = $('photoConfirmBtn');
  const stagePanel = $('stagePanel');
  const stageArtboard = $('stageArtboard');
  const stageBgEl = $('stageBg');
  const stageBgImg = $('stageBgImg');
  const stageBgInput = $('stageBgInput');
  const stageBtn = $('stageBtn');
  const stageSheet = $('stageSheet');
  const stageClose = $('stageClose');
  const stageScrim = $('stageScrim');
  const stageColorGrid = $('stageColorGrid');
  const stageColorValue = $('stageColorValue');
  const stageMedia = $('stageMedia');
  const stageMediaEmpty = $('stageMediaEmpty');
  const stageMediaFilled = $('stageMediaFilled');
  const stageMediaPickTile = $('stageMediaPickTile');
  const stageMediaImg = $('stageMediaImg');
  const stageBgViewport = $('stageMediaViewport');
  const stageStyleField = $('stageStyleField');
  const stageBgPickBtn = $('stageBgPickBtn');
  const stageBgClearBtn = $('stageBgClearBtn');
  const stageBgControls = $('stageBgControls');
  const stageOpacityUi = $('stageOpacityUi');
  const exportSheet = $('exportSheet');
  const exportScrim = $('exportScrim');
  const exportClose = $('exportClose');
  const exportTicketBtn = $('exportTicketBtn');
  const exportSceneBtn = $('exportSceneBtn');
  const publishBtn = $('publishBtn');
  const publishSheet = $('publishSheet');
  const publishClose = $('publishClose');
  const publishScrim = $('publishScrim');
  const publishTicketBtn = $('publishTicketBtn');
  const publishNoteBtn = $('publishNoteBtn');

  let catId = Kit.CATEGORIES[0].id;
  let styleId = Kit.CATEGORIES[0].styles[0].id;
  /** @type {Record<number, string>} 用户上传的 data URL，按槽位 0/1 */
  const customPhotos = {};
  /** @type {Record<number, { x: number, y: number, scale: number }>} */
  const photoFit = {};
  /** @type {Record<number, number>} 上传图宽高比 Iw/Ih */
  const photoAspect = {};
  let activePickSlot = 0;
  let adjustSlot = 0;
  let photoOpen = false;
  let photoCloseTimer = 0;
  let photoDrag = null;
  let photoPinch = null;
  /** @type {Map<number, { x: number, y: number }>} */
  const photoPointers = new Map();
  const PHOTO_DOUBLE_TAP_MS = 320;
  const PHOTO_DOUBLE_TAP_PX = 16;
  const PHOTO_DOUBLE_ZOOM = 2;
  let photoLastTapAt = 0;
  let photoLastTapX = 0;
  let photoLastTapY = 0;
  let photoSuppressDblClick = false;
  const formData = {};

  /* —— 特效状态 —— */
  let fxInstances = [];
  let fxDraft = null; // 目录预览，未点「添加」不入库
  let fxTarget = 'top';
  let fxTab = 'texture';
  let fxSelectedId = null;
  let fxOpen = false;

  /** 纸感 3D 呈现 */
  let paperPresentMode = 'flat';
  let paperPreset = 'matte';
  let paperGrain = 0.42;
  let paperCurl = 0.12;
  let paperLight = 0.65;
  let paperGl = null;
  let paperRenderTimer = 0;
  let paperRenderGen = 0;

  const STAGE_STYLE_FILTERS = {
    none: '',
    mono: 'grayscale(1) contrast(1.06)',
    vintage: 'sepia(0.42) saturate(0.85) contrast(1.05)',
    soft: 'blur(2px) brightness(1.08) saturate(1.12)',
  };

  const STAGE_COLOR_PRESETS = [
    '#ebe6dc',
    '#f4f0e8',
    '#faf8f4',
    '#ffffff',
    '#1c1916',
    '#2e2924',
    '#4a4038',
    '#8b7355',
    '#c9b896',
    '#d4c4a8',
    '#e8dcc8',
    '#7d6b5d',
    '#4a6741',
    '#2d5016',
    '#3d5a80',
    '#5c4033',
    '#8b1a1a',
    '#6b4c7a',
    '#c45c3e',
    '#e8c27a',
    '#b8c4ce',
    '#1a3a4a',
    '#f0e4d4',
    '#908880',
  ];

  /** 画板背景图原始宽高比，用于平移范围计算 */
  let stageBgImageAspect = 0;
  const STAGE_BG_MAX_SCALE = 2.6;
  const stageBgPointers = new Map();
  let stageBgDrag = null;
  let stageBgPinch = null;
  let stageBgLastTapAt = 0;
  let stageBgLastTapX = 0;
  let stageBgLastTapY = 0;
  let stageBgSuppressDblClick = false;
  /** @type {null | { setValue: (v: number, silent?: boolean) => void }} */
  let stageOpacityCtl = null;

  const stageBgState = {
    color: '#232327',
    imageUrl: null,
    fit: { x: 50, y: 50, scale: 1 },
    opacity: 1,
    stylize: 'none',
  };

  let stageOpen = false;
  let stageCloseTimer = 0;
  let exportSheetOpen = false;
  let exportCloseTimer = 0;
  let publishSheetOpen = false;
  let publishCloseTimer = 0;
  let exportBusy = false;

  const FX_LAYER_HINT = {
    bg: '背景层：铺在票面底色上，文字和照片下方',
    photo: '照片层：只盖在照片上，随裁切，出框部分没有',
    top: '前景：盖在全部内容之上，适合印章和水印',
  };

  function activePhotos() {
    const n = Kit.photoSlotCount(styleId);
    const def = Kit.defaultPhotoFor(styleId);
    return Array.from({ length: n }, (_, i) => customPhotos[i] || def);
  }

  function activePhoto() {
    return activePhotos()[0];
  }

  const DEFAULT_PHOTO_FIT = { x: 50, y: 50, scale: 1 };

  function clampPct(n) {
    return Math.min(100, Math.max(0, n));
  }

  /** cover + scale 下各轴是否还有可平移余量 */
  function photoPanAxes(slot, fit, imageAspect) {
    const frameR = frameAspectRatio(slot);
    if (!Number.isFinite(imageAspect) || imageAspect <= 0 || !Number.isFinite(frameR) || frameR <= 0) {
      return { canPanX: false, canPanY: false };
    }
    const R = imageAspect / frameR;
    const S = fit.scale > 0 ? fit.scale : 1;
    const eps = 1.002;
    return {
      canPanX: R * S > eps,
      canPanY: S / R > eps,
    };
  }

  function clampPhotoFit(slot, fit, imageAspect) {
    const { canPanX, canPanY } = photoPanAxes(slot, fit, imageAspect);
    return {
      x: canPanX ? clampPct(fit.x) : 50,
      y: canPanY ? clampPct(fit.y) : 50,
      scale: Math.min(2.6, Math.max(1, fit.scale || 1)),
    };
  }

  function slotImageAspect(slot) {
    if (photoAspect[slot] > 0) return photoAspect[slot];
    return frameAspectRatio(slot);
  }

  function ensurePhotoAspect(slot) {
    if (photoAspect[slot] > 0) return Promise.resolve(photoAspect[slot]);
    const url = customPhotos[slot];
    if (!url) return Promise.resolve(frameAspectRatio(slot));
    return loadImageAspect(url).then((a) => {
      photoAspect[slot] = a;
      return a;
    });
  }

  function getPhotoFit(slot) {
    const f = photoFit[slot];
    const raw = {
      x: Number.isFinite(f && f.x) ? f.x : DEFAULT_PHOTO_FIT.x,
      y: Number.isFinite(f && f.y) ? f.y : DEFAULT_PHOTO_FIT.y,
      scale: Number.isFinite(f && f.scale) ? f.scale : DEFAULT_PHOTO_FIT.scale,
    };
    return clampPhotoFit(slot, raw, slotImageAspect(slot));
  }

  function setPhotoFit(slot, partial) {
    const merged = Object.assign({}, getPhotoFit(slot), partial);
    photoFit[slot] = clampPhotoFit(slot, merged, slotImageAspect(slot));
  }

  function resetPhotoFit(slot) {
    delete photoFit[slot];
  }

  function clearPhotoSlot(slot) {
    delete customPhotos[slot];
    resetPhotoFit(slot);
    delete photoAspect[slot];
  }

  function applyFitToImg(img, fit) {
    if (!img) return;
    img.style.objectFit = 'cover';
    img.style.objectPosition = `${fit.x}% ${fit.y}%`;
    img.style.transform = `scale(${fit.scale})`;
    img.style.transformOrigin = `${fit.x}% ${fit.y}%`;
  }

  function getTicketRoot() {
    const dom = ticketHost.querySelector('.ticket-dom');
    if (dom && dom.firstElementChild) return dom.firstElementChild;
    return ticketHost.firstElementChild;
  }

  function paperParams() {
    const base = window.TicketPaper && TicketPaper.PRESETS[paperPreset];
    return {
      preset: paperPreset,
      grain: paperGrain,
      curl: paperCurl,
      light: paperLight,
      warmth: base ? base.warmth : 0.1,
      specular: base ? base.specular : 0.22,
    };
  }

  function ensurePaperGl() {
    if (!window.TicketPaper) return null;
    if (!paperGl) paperGl = TicketPaper.attach(ticketHost);
    return paperGl;
  }

  function prepareCloneForRaster(node) {
    const clip = node.cloneNode(true);
    clip.style.transform = '';
    // 纸感模式下 .ticket-dom 是 visibility:hidden，克隆出去光栅化会是一片空白
    clip.style.visibility = 'visible';
    clip.classList.remove('is-fx-editing');
    clip.removeAttribute('data-fx-target');
    clip.querySelectorAll('.ufx-item.is-selected, .fx-user-slot.is-active-target').forEach((n) => {
      n.classList.remove('is-selected', 'is-active-target');
    });
    if (fxDraft) {
      clip.querySelectorAll(`[data-fx-id="${fxDraft.id}"]`).forEach((n) => n.remove());
    }
    return clip;
  }

  function schedulePaperRender() {
    if (paperPresentMode !== 'paper3d' || !window.TicketPaper) return;
    if (paperRenderTimer) clearTimeout(paperRenderTimer);
    paperRenderTimer = setTimeout(() => {
      paperRenderTimer = 0;
      runPaperRender();
    }, TicketPaper.DEBOUNCE_MS || 250);
  }

  async function runPaperRender() {
    if (paperPresentMode !== 'paper3d' || !window.htmlToImage) return;
    const gl = ensurePaperGl();
    const ticket = getTicketRoot();
    if (!gl || !ticket) return;

    const gen = ++paperRenderGen;
    let busyTimer = setTimeout(() => gl.setBusy(true), 200);

    const stage = document.createElement('div');
    stage.className = 'export-stage';
    const clip = prepareCloneForRaster(ticket);
    // 纸感预览也走同一套光栅化，所以同样要先把多层镂空压平
    flattenMasks(clip);
    stage.appendChild(clip);
    document.body.appendChild(stage);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const pr = Math.min(1.75, Math.max(1, window.devicePixelRatio || 1));
      const canvas = await TicketPaper.rasterizeNode(stage.firstElementChild, htmlToImage, pr);
      if (gen !== paperRenderGen) return;
      gl.setParams(paperParams());
      gl.updateFromCanvas(canvas);
      gl.show();
      ticketHost.classList.remove('is-paper-fallback');
    } catch (err) {
      console.error('纸感渲染失败', err);
      ticketHost.classList.add('is-paper-fallback');
      gl.hide();
    } finally {
      clearTimeout(busyTimer);
      gl.setBusy(false);
      stage.remove();
      requestAnimationFrame(() => fitTicket(false));
    }
  }

  function photoFitImgsForSlot(slot) {
    const imgs = [];
    if (photoAdjustImg && slot === adjustSlot) imgs.push(photoAdjustImg);
    const ticket = getTicketRoot();
    if (ticket) {
      ticket.querySelectorAll(`.photo-frame[data-photo-slot="${slot}"] .photo-img`).forEach((img) => {
        imgs.push(img);
      });
    }
    return imgs;
  }

  function clearPhotoFitAnim(imgs) {
    imgs.forEach((img) => img.classList.remove('is-photo-fit-anim'));
  }

  function animatePhotoFitForSlot(slot, targetPartial) {
    const from = getPhotoFit(slot);
    const merged = clampPhotoFit(
      slot,
      Object.assign({}, from, targetPartial),
      slotImageAspect(slot)
    );
    const imgs = photoFitImgsForSlot(slot);
    clearPhotoFitAnim(imgs);
    imgs.forEach((img) => applyFitToImg(img, from));

    const isRest =
      merged.scale <= 1.02 && Math.abs(merged.x - 50) < 1.5 && Math.abs(merged.y - 50) < 1.5;
    if (isRest) delete photoFit[slot];
    else photoFit[slot] = merged;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        imgs.forEach((img) => {
          img.classList.add('is-photo-fit-anim');
          applyFitToImg(img, merged);
        });
        window.setTimeout(() => {
          clearPhotoFitAnim(imgs);
          schedulePaperRender();
        }, 340);
      });
    });
  }

  function applyPhotoFit(ticket) {
    if (!ticket) return;
    ticket.querySelectorAll('.photo-frame').forEach((frame) => {
      const img = frame.querySelector('.photo-img');
      if (!img) return;
      const slot = Number(frame.dataset.photoSlot);
      const si = Number.isFinite(slot) ? slot : 0;
      applyFitToImg(img, getPhotoFit(si));
    });
  }

  function photoFrameAspect(slot) {
    const ticket = getTicketRoot();
    if (!ticket) return '1 / 1';
    const frame =
      ticket.querySelector(`.photo-frame[data-photo-slot="${slot}"]`) ||
      ticket.querySelectorAll('.photo-frame')[slot];
    if (!frame) return '1 / 1';
    const cs = getComputedStyle(frame);
    if (cs.aspectRatio && cs.aspectRatio !== 'auto') return cs.aspectRatio;
    const r = frame.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return `${r.width} / ${r.height}`;
    return '1 / 1';
  }

  function parseAspectRatioValue(arStr) {
    if (!arStr) return 1;
    const parts = String(arStr)
      .split('/')
      .map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1];
    const n = parseFloat(arStr);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function frameAspectRatio(slot) {
    return parseAspectRatioValue(photoFrameAspect(slot));
  }

  function layoutPhotoAdjustViewport() {
    if (!photoAdjustViewport) return;
    const ratio = frameAspectRatio(adjustSlot);
    const body = photoAdjustViewport.closest('.photo-adjust-body');
    const maxW = Math.min(body ? body.clientWidth - 4 : 320, 360);
    const maxH = Math.min(window.innerHeight * 0.36, 280);
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    photoAdjustViewport.style.width = `${Math.max(120, Math.round(w))}px`;
    photoAdjustViewport.style.height = `${Math.max(80, Math.round(h))}px`;
  }

  function loadImageAspect(dataUrl) {
    return new Promise((resolve, reject) => {
      const probe = new Image();
      probe.onload = () => {
        if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
          resolve(probe.naturalWidth / probe.naturalHeight);
        } else {
          reject(new Error('bad image'));
        }
      };
      probe.onerror = () => reject(new Error('load fail'));
      probe.src = dataUrl;
    });
  }

  /** 图片与票框宽高比差异明显时需要构图 */
  function needsPhotoCompose(slot, imageAspect) {
    const frameR = frameAspectRatio(slot);
    if (!Number.isFinite(imageAspect) || imageAspect <= 0) return false;
    const rel = Math.abs(Math.log(imageAspect / frameR));
    return rel > 0.14;
  }

  function syncPhotoAdjustPreview() {
    if (!photoAdjustViewport || !photoAdjustImg) return;
    layoutPhotoAdjustViewport();
    photoAdjustImg.src = activePhotos()[adjustSlot] || '';
    applyFitToImg(photoAdjustImg, getPhotoFit(adjustSlot));
  }

  function syncPhotoAdjustFromFit() {
    syncPhotoAdjustPreview();
    applyPhotoFit(getTicketRoot());
    schedulePaperRender();
  }

  function openPhotoSheet(slot) {
    if (!photoSheet || photoOpen) return;
    if (fieldsOpen) closeFieldsSheet();
    if (fxOpen) closeFxSheet();
    adjustSlot = slot;
    activePickSlot = slot;
    if (photoCloseTimer) {
      clearTimeout(photoCloseTimer);
      photoCloseTimer = 0;
    }
    photoOpen = true;
    const panel = photoSheet.querySelector('.photo-panel');
    if (photoSheetTitle) {
      const n = Kit.photoSlotCount(styleId);
      photoSheetTitle.textContent = n > 1 ? `调整构图 · 图 ${slot + 1}` : '调整构图';
    }
    syncPhotoAdjustPreview();
    ensurePhotoAspect(slot).then(() => {
      setPhotoFit(slot, getPhotoFit(slot));
      syncPhotoAdjustFromFit();
    });
    setSheetPush(panel, true);
    photoSheet.classList.remove('is-closing');
    photoSheet.classList.add('is-open');
    photoSheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('photo-open');
    document.documentElement.classList.add('photo-open');
    resetTilt();
    if (window.lucide) lucide.createIcons({ nodes: [photoSheet] });
  }

  function closePhotoSheet() {
    if (!photoSheet || !photoSheet.classList.contains('is-open')) return;
    photoOpen = false;
    photoDrag = null;
    photoPinch = null;
    photoPointers.clear();
    photoLastTapAt = 0;
    photoSuppressDblClick = false;
    if (photoAdjustViewport) photoAdjustViewport.classList.remove('is-dragging');
    setSheetPush(null, false);
    photoSheet.classList.add('is-closing');
    photoSheet.classList.remove('is-open');
    if (photoCloseTimer) clearTimeout(photoCloseTimer);
    photoCloseTimer = setTimeout(() => {
      photoCloseTimer = 0;
      photoSheet.classList.remove('is-closing');
      photoSheet.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('photo-open');
      document.documentElement.classList.remove('photo-open');
    }, 340);
  }

  function syncPhotoSlots() {
    if (!photoSlots) return;
    const slotCount = Kit.photoSlotCount(styleId);
    const visible = slotCount;
    const parts = [];
    for (let i = 0; i < visible; i += 1) {
      const url = customPhotos[i];
      if (url) {
        parts.push(`<div class="photo-slot photo-slot--filled">
          <button type="button" class="photo-slot-btn photo-slot-btn--thumb" data-adjust="${i}" aria-label="调整构图">
            <img src="${escapeAttr(url)}" alt="" draggable="false" />
          </button>
          <button type="button" class="photo-slot-clear" data-clear="${i}" aria-label="移除照片">
            <i data-lucide="x"></i>
          </button>
        </div>`);
      } else {
        parts.push(`<button type="button" class="photo-slot photo-slot--empty photo-slot-btn" data-add="${i}" aria-label="添加照片">
          <i data-lucide="image-plus"></i>
        </button>`);
      }
    }
    photoSlots.innerHTML = parts.join('');
    if (window.lucide) lucide.createIcons({ nodes: [photoSlots] });
  }

  let fieldsOpen = false;
  let fieldsCloseTimer = 0;
  let styleCloseTimer = 0;
  let pushFitTimer = 0;

  /** 画板留白比例：以票根长边为基准，四周等宽。
      0.10 → 票根长边约占画板的 83%，短边约 70%，
      像「裱在画框里」，既能看到背景又不会显得空。 */
  const STAGE_FRAME_PAD = 0.1;

  function stageFramePad(w, h) {
    return Math.max(w, h) * STAGE_FRAME_PAD;
  }

  /** 画板宽高比 =「票根 + 四周等宽留白」的外框比例。
      这样预览/导出画面既有票根的形，又能露出一圈背景；
      只依赖票根固有尺寸，所以 sheet 顶起时不会变。 */
  function layoutStageArtboard() {
    if (!ticketHost) return;
    const w = Number(ticketHost.dataset.natW) || 0;
    const h = Number(ticketHost.dataset.natH) || 0;
    if (w <= 0 || h <= 0) return;
    const p = stageFramePad(w, h);
    const ar = (w + p * 2) / (h + p * 2);
    document.documentElement.style.setProperty('--stage-ar', ar.toFixed(4));

    // 画板尺寸的基线层：容器查询（cqw/cqh）不可用时 CSS 会退回这两个变量，
    // 所以这里顺手把 px 值也算好（现代内核里仍以 cqw/cqh 为准）
    const panelW = stagePanel ? stagePanel.clientWidth : 0;
    const panelH = stagePanel ? stagePanel.clientHeight : 0;
    if (panelW > 0 && panelH > 0) {
      const bw = Math.min(panelW, panelH * ar);
      const bh = Math.min(panelH, panelW / ar);
      document.documentElement.style.setProperty('--stage-w', `${bw.toFixed(2)}px`);
      document.documentElement.style.setProperty('--stage-h', `${bh.toFixed(2)}px`);
    }
  }

  /* 内置样图是包内相对路径，而导出用的光栅化库靠 fetch 把资源内联成 data:（离线容器不保证取得到），
     所以启动后把它们统一读成 data URL 写回 DEFAULT_PHOTOS：
     之后预览与导出都只用内存地址，不再依赖运行时取文件。
     读不到（例如画布被污染）就保留原路径，行为与现在一致。 */
  function localizeDefaultPhotos() {
    const map = Kit.DEFAULT_PHOTOS;
    if (!map) return;
    const keys = Object.keys(map).filter((k) => map[k] && map[k].indexOf('data:') !== 0);
    if (!keys.length) return;
    let rest = keys.length;
    const done = () => {
      rest -= 1;
      if (rest === 0) {
        renderAll();
        fitTicket(true);
      }
    };
    keys.forEach((k) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          map[k] = c.toDataURL('image/jpeg', 0.92);
        } catch (_) {
          /* 跨源污染等情况：保留原始路径 */
        }
        done();
      };
      img.onerror = done;
      img.src = map[k];
    });
  }

  let pushPanel = null;
  let pushObserver = null;

  /** 面板高度可能在过渡中才稳定（图片/换行/dvh 变化），
      所以在 340ms 后再量一次，并用 ResizeObserver 持续兜底，
      保证预览区底边始终贴着 sheet 顶边 */
  function applySheetPushHeight() {
    if (!pushPanel) return;
    const h = Math.max(0, Math.round(pushPanel.offsetHeight));
    document.documentElement.style.setProperty('--sheet-push', `${h}px`);
    fitTicket(false);
  }

  function watchPushPanel(panel) {
    if (pushObserver) {
      pushObserver.disconnect();
      pushObserver = null;
    }
    if (!panel || !window.ResizeObserver) return;
    pushObserver = new ResizeObserver(() => {
      if (!pushPanel) return;
      applySheetPushHeight();
    });
    pushObserver.observe(panel);
  }

  function setSheetPush(panel, on) {
    if (pushFitTimer) {
      clearTimeout(pushFitTimer);
      pushFitTimer = 0;
    }
    if (!on || !panel) {
      pushPanel = null;
      watchPushPanel(null);
      document.documentElement.style.setProperty('--sheet-push', '0px');
      document.body.classList.remove('is-sheet-push');
      // 强制同步一次布局后再 fit，随后 ResizeObserver 跟过渡平滑插值
      void document.body.offsetHeight;
      fitTicket(false);
      pushFitTimer = setTimeout(() => {
        pushFitTimer = 0;
        fitTicket(false);
      }, 360);
      return;
    }
    pushPanel = panel;
    // offsetHeight 不受 transform 影响，开启动画前就能定高
    document.documentElement.style.setProperty(
      '--sheet-push',
      `${Math.max(0, Math.round(panel.offsetHeight))}px`
    );
    document.body.classList.add('is-sheet-push');
    void document.body.offsetHeight;
    fitTicket(false);
    watchPushPanel(panel);
    pushFitTimer = setTimeout(() => {
      pushFitTimer = 0;
      applySheetPushHeight();
    }, 360);
  }

  function openFieldsSheet() {
    if (!fieldsSheet || fieldsOpen) return;
    if (fieldsCloseTimer) {
      clearTimeout(fieldsCloseTimer);
      fieldsCloseTimer = 0;
    }
    fieldsOpen = true;
    const panel = fieldsSheet.querySelector('.fields-panel');
    fieldsSheet.classList.remove('is-closing');
    fieldsSheet.classList.add('is-open');
    fieldsSheet.setAttribute('aria-hidden', 'false');
    if (fieldsBtn) fieldsBtn.classList.add('is-active');
    document.body.classList.add('fields-open');
    document.documentElement.classList.add('fields-open');
    // 先开再量（自适应高度），同一帧内定推高，减少跳动
    setSheetPush(panel, true);
    if (window.lucide) lucide.createIcons({ nodes: [fieldsSheet] });
  }

  function closeFieldsSheet() {
    if (!fieldsSheet || !fieldsSheet.classList.contains('is-open')) return;
    fieldsOpen = false;
    if (fieldsBtn) fieldsBtn.classList.remove('is-active');
    setSheetPush(null, false);
    fieldsSheet.classList.add('is-closing');
    fieldsSheet.classList.remove('is-open');
    if (fieldsCloseTimer) clearTimeout(fieldsCloseTimer);
    fieldsCloseTimer = setTimeout(() => {
      fieldsCloseTimer = 0;
      fieldsSheet.classList.remove('is-closing');
      fieldsSheet.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('fields-open');
      document.documentElement.classList.remove('fields-open');
    }, 340);
  }

  function mountUiRange(wrap, opts) {
    const track = wrap.querySelector('.ui-range-track');
    const fill = wrap.querySelector('.ui-range-fill');
    const thumb = wrap.querySelector('.ui-range-thumb');
    if (!track || !fill || !thumb) return null;
    const min = opts.min;
    const max = opts.max;
    let value = opts.value;

    function clamp(v) {
      return Math.max(min, Math.min(max, v));
    }

    function render() {
      const span = max - min || 1;
      const t = (value - min) / span;
      const p = t * 100;
      fill.style.width = `${p}%`;
      // 圆点位置交给 CSS 用比例变量算：轨道两侧有留白，圆点走的是轨道内容区
      wrap.style.setProperty('--ui-range-p', String(t));
      thumb.setAttribute('aria-valuenow', String(Math.round(value)));
      thumb.setAttribute('aria-valuemin', String(min));
      thumb.setAttribute('aria-valuemax', String(max));
    }

    function setValue(v, silent) {
      value = clamp(v);
      render();
      if (!silent && opts.onInput) opts.onInput(value);
    }

    /** 拖拽期间轨道 rect 兜底：极端情况下（行被隐藏/布局塌陷）rect 会变成 0 宽，
        此时用上一次的有效 rect，避免把值算成最小值 */
    let lastTrackRect = null;

    function valueFromClientX(clientX) {
      const rect = track.getBoundingClientRect();
      const use = rect.width > 0 ? rect : lastTrackRect;
      if (rect.width > 0) lastTrackRect = rect;
      if (!use || use.width <= 0) return;
      const t = (clientX - use.left) / use.width;
      // 注意：这里必须用归一化的 0~1 夹取，
      // 不能复用上面的 clamp()（它按 min/max 夹取，会把比例变成 5 导致滑条永远卡在最大值）
      const nt = Math.min(1, Math.max(0, t));
      setValue(min + nt * (max - min));
    }

    /** pointer / touch / mouse 三套事件都挂上：
        某些 WebView / 旧浏览器不派发 PointerEvent，
        只靠 pointerdown 会导致滑条完全拖不动。 */
    let dragging = false;
    let dragSource = null; // 'pointer' | 'touch' | 'mouse'
    let dragKey = null; // pointerId 或 touch identifier

    function touchClientX(list, key) {
      if (!list) return null;
      for (let i = 0; i < list.length; i += 1) {
        if (list[i].identifier === key) return list[i].clientX;
      }
      return null;
    }

    function onDocPointerMove(e) {
      if (dragSource !== 'pointer' || e.pointerId !== dragKey) return;
      if (e.cancelable) e.preventDefault();
      valueFromClientX(e.clientX);
    }

    function onDocPointerUp(e) {
      if (dragSource !== 'pointer' || e.pointerId !== dragKey) return;
      endDrag();
    }

    function onDocTouchMove(e) {
      if (dragSource !== 'touch') return;
      const x = touchClientX(e.touches, dragKey);
      if (x == null) return;
      if (e.cancelable) e.preventDefault();
      valueFromClientX(x);
    }

    function onDocTouchEnd(e) {
      if (dragSource !== 'touch') return;
      if (touchClientX(e.changedTouches, dragKey) == null && touchClientX(e.touches, dragKey) == null) {
        return;
      }
      endDrag();
    }

    function onDocMouseMove(e) {
      if (dragSource !== 'mouse') return;
      e.preventDefault();
      valueFromClientX(e.clientX);
    }

    function onDocMouseUp() {
      if (dragSource !== 'mouse') return;
      endDrag();
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      dragSource = null;
      dragKey = null;
      document.removeEventListener('pointermove', onDocPointerMove, true);
      document.removeEventListener('pointerup', onDocPointerUp, true);
      document.removeEventListener('pointercancel', onDocPointerUp, true);
      document.removeEventListener('touchmove', onDocTouchMove, true);
      document.removeEventListener('touchend', onDocTouchEnd, true);
      document.removeEventListener('touchcancel', onDocTouchEnd, true);
      document.removeEventListener('mousemove', onDocMouseMove, true);
      document.removeEventListener('mouseup', onDocMouseUp, true);
      window.removeEventListener('blur', endDrag);
    }

    function beginDrag(source, key, clientX) {
      // 自愈：万一上一轮拖拽状态残留，先复位再开始，避免滑条永久失效
      if (dragging) endDrag();
      dragging = true;
      dragSource = source;
      dragKey = key;
      valueFromClientX(clientX);
      document.addEventListener('pointermove', onDocPointerMove, true);
      document.addEventListener('pointerup', onDocPointerUp, true);
      document.addEventListener('pointercancel', onDocPointerUp, true);
      document.addEventListener('touchmove', onDocTouchMove, { capture: true, passive: false });
      document.addEventListener('touchend', onDocTouchEnd, true);
      document.addEventListener('touchcancel', onDocTouchEnd, true);
      document.addEventListener('mousemove', onDocMouseMove, true);
      document.addEventListener('mouseup', onDocMouseUp, true);
      window.addEventListener('blur', endDrag);
    }

    wrap.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (dragging) return;
        if (e.cancelable) e.preventDefault();
        // 指针捕获 + document 兜底：手指/鼠标移出滑条也能继续拖
        try {
          wrap.setPointerCapture(e.pointerId);
        } catch (_) {
          /* ignore */
        }
        beginDrag('pointer', e.pointerId, e.clientX);
      },
      { passive: false }
    );

    wrap.addEventListener(
      'touchstart',
      (e) => {
        if (dragging) return;
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        if (e.cancelable) e.preventDefault();
        beginDrag('touch', t.identifier, t.clientX);
      },
      { passive: false }
    );

    wrap.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (dragging) return;
      e.preventDefault();
      beginDrag('mouse', null, e.clientX);
    });

    render();
    return {
      setValue,
      getValue: () => value,
    };
  }

  function syncStageColorChips() {
    if (!stageColorGrid) return;
    const cur = stageBgState.color.toLowerCase();
    stageColorGrid.querySelectorAll('[data-color]').forEach((btn) => {
      const on = btn.dataset.color.toLowerCase() === cur;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (stageColorValue) stageColorValue.textContent = stageBgState.color.toUpperCase();
  }

  function buildStageColorGrid() {
    if (!stageColorGrid || stageColorGrid.dataset.ready) return;
    stageColorGrid.dataset.ready = '1';
    stageColorGrid.innerHTML = STAGE_COLOR_PRESETS.map(
      (c) =>
        `<button type="button" class="stage-color-chip" data-color="${c}" style="background-color:${c}" aria-label="${c}" role="option"></button>`
    ).join('');
    stageColorGrid.querySelectorAll('[data-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stageBgState.color = btn.dataset.color || stageBgState.color;
        applyStageBg();
        syncStageSheetUI();
      });
    });
  }

  function pickStageBgFile() {
    if (stageBgInput) {
      stageBgInput.value = '';
      stageBgInput.click();
    }
  }

  function clearStageBgImage() {
    stageBgState.imageUrl = null;
    stageBgState.fit = { x: 50, y: 50, scale: 1 };
    stageBgState.opacity = 1;
    stageBgState.stylize = 'none';
    stageBgImageAspect = 0;
    stageBgPointers.clear();
    stageBgDrag = null;
    stageBgPinch = null;
    applyStageBg();
    syncStageSheetUI();
  }

  function syncStageMedia() {
    const url = stageBgState.imageUrl;
    const has = !!url;
    if (stageMediaEmpty) stageMediaEmpty.classList.toggle('is-hidden', has);
    if (stageMediaFilled) stageMediaFilled.classList.toggle('is-hidden', !has);
    // 缩略图底色跟画板一致，拖透明度时能直接看到「透出底色」的效果
    if (stageBgViewport) stageBgViewport.style.backgroundColor = stageBgState.color;
    if (stageMediaImg) {
      if (url) {
        if (stageMediaImg.getAttribute('src') !== url) stageMediaImg.src = url;
      } else {
        stageMediaImg.removeAttribute('src');
      }
      // 与画板保持完全一致：透明度 + 风格化滤镜都要应用到缩略图
      stageMediaImg.style.opacity = String(stageBgState.opacity);
      stageMediaImg.style.filter = STAGE_STYLE_FILTERS[stageBgState.stylize] || '';
    }
  }

  /** 画板固定比例（与预览区、导出画面一致），不从实时 rect 取，避免过渡中读到中间值 */
  function stageArtboardRatioValue() {
    const raw = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--stage-ar')
    );
    if (Number.isFinite(raw) && raw > 0) return Math.min(3, Math.max(0.34, raw));
    return 16 / 10;
  }

  function stageBgFrameRatio() {
    return stageArtboardRatioValue();
  }

  function stageBgPanAxes(fit) {
    const frameR = stageBgFrameRatio();
    const ar = stageBgImageAspect > 0 ? stageBgImageAspect : frameR;
    const R = ar / frameR;
    const S = fit.scale > 0 ? fit.scale : 1;
    const eps = 1.002;
    return { canPanX: R * S > eps, canPanY: S / R > eps };
  }

  function clampStageBgFit(fit) {
    const { canPanX, canPanY } = stageBgPanAxes(fit);
    return {
      x: canPanX ? clampPct(fit.x) : 50,
      y: canPanY ? clampPct(fit.y) : 50,
      scale: Math.min(STAGE_BG_MAX_SCALE, Math.max(1, fit.scale || 1)),
    };
  }

  function getStageBgFit() {
    return clampStageBgFit(stageBgState.fit);
  }

  function applyStageBgFit() {
    stageBgState.fit = clampStageBgFit(stageBgState.fit);
    applyFitToImg(stageBgImg, stageBgState.fit);
    applyFitToImg(stageMediaImg, stageBgState.fit);
  }

  function setStageBgFit(partial) {
    stageBgState.fit = clampStageBgFit(Object.assign({}, getStageBgFit(), partial));
    applyStageBgFit();
  }

  let stageBgFitAnimTimer = 0;

  function clearStageBgFitAnim() {
    if (stageBgFitAnimTimer) {
      clearTimeout(stageBgFitAnimTimer);
      stageBgFitAnimTimer = 0;
    }
    if (stageBgImg) stageBgImg.classList.remove('is-bg-fit-anim');
    if (stageMediaImg) stageMediaImg.classList.remove('is-bg-fit-anim');
  }

  /** 双击缩放专用：先落到起点，下一帧再加过渡切到终点。
      直接 setStageBgFit 是瞬移（双击会「跳」一下），
      而拖拽/捏合必须保持无过渡的跟手感，所以动画只在这一处开 */
  function animateStageBgFit(partial) {
    const from = getStageBgFit();
    const to = clampStageBgFit(Object.assign({}, from, partial));
    const imgs = [stageBgImg, stageMediaImg].filter(Boolean);
    if (!imgs.length) {
      setStageBgFit(to);
      return;
    }
    clearStageBgFitAnim();
    imgs.forEach((img) => applyFitToImg(img, from));
    stageBgState.fit = to;
    // 同一帧里改样式不会产生起点，必须等一帧让起点真实上屏
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        imgs.forEach((img) => {
          img.classList.add('is-bg-fit-anim');
          applyFitToImg(img, to);
        });
        stageBgFitAnimTimer = setTimeout(clearStageBgFitAnim, 360);
      });
    });
  }

  function isStageBgRestState() {
    const f = getStageBgFit();
    return f.scale <= 1.02 && Math.abs(f.x - 50) < 1.5 && Math.abs(f.y - 50) < 1.5;
  }

  function stageBgPointerDistance() {
    const pts = [...stageBgPointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function beginStageBgPinch() {
    const dist = stageBgPointerDistance();
    if (dist < 6) return;
    // 手指落下就结束双击动画，捏合必须即时跟手
    clearStageBgFitAnim();
    stageBgDrag = null;
    stageBgPinch = { startDist: dist, origScale: getStageBgFit().scale };
  }

  function beginStageBgPan(e) {
    clearStageBgFitAnim();
    const fit = getStageBgFit();
    const axes = stageBgPanAxes(fit);
    stageBgDrag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: fit.x,
      origY: fit.y,
      canPanX: axes.canPanX,
      canPanY: axes.canPanY,
      rect: stageBgViewport.getBoundingClientRect(),
      moved: 0,
    };
    stageBgViewport.classList.add('is-dragging');
  }

  function toggleStageBgDoubleZoom(clientX, clientY) {
    if (isStageBgRestState()) {
      const rect = stageBgViewport.getBoundingClientRect();
      let x = 50;
      let y = 50;
      if (rect.width > 0 && rect.height > 0) {
        x = clampPct(((clientX - rect.left) / rect.width) * 100);
        y = clampPct(((clientY - rect.top) / rect.height) * 100);
      }
      animateStageBgFit({ scale: PHOTO_DOUBLE_ZOOM, x, y });
    } else {
      animateStageBgFit({ scale: 1, x: 50, y: 50 });
    }
  }

  function tryStageBgDoubleTap(clientX, clientY) {
    const now = Date.now();
    const dt = now - stageBgLastTapAt;
    const dist = Math.hypot(clientX - stageBgLastTapX, clientY - stageBgLastTapY);
    if (dt > 0 && dt < PHOTO_DOUBLE_TAP_MS && dist < PHOTO_DOUBLE_TAP_PX * 2.5) {
      stageBgLastTapAt = 0;
      stageBgSuppressDblClick = true;
      toggleStageBgDoubleZoom(clientX, clientY);
      return;
    }
    stageBgLastTapAt = now;
    stageBgLastTapX = clientX;
    stageBgLastTapY = clientY;
  }

  function applyStageBg() {
    if (stageBgEl) stageBgEl.style.backgroundColor = stageBgState.color;
    const has = !!stageBgState.imageUrl;
    if (stageBgControls) stageBgControls.classList.toggle('is-hidden', !has);
    if (stageStyleField) stageStyleField.classList.toggle('is-hidden', !has);
    if (!stageBgImg) return;
    if (has) {
      // 之前空背景图时会把 <img> 从画板里摘掉（避免光栅化失败），这里补回去
      if (stageBgEl && !stageBgImg.parentNode) stageBgEl.appendChild(stageBgImg);
      stageBgImg.hidden = false;
      if (stageBgImg.getAttribute('src') !== stageBgState.imageUrl) {
        stageBgImg.src = stageBgState.imageUrl;
      }
      stageBgImg.style.opacity = String(stageBgState.opacity);
      stageBgImg.style.filter = STAGE_STYLE_FILTERS[stageBgState.stylize] || '';
      applyStageBgFit();
    } else {
      // 没有背景图时把 <img> 整个摘掉，而不是只 hidden + 去掉 src：
      // 没有 src 的空 <img> 会让光栅化库抛 Event，导出「预览画面」直接整体失败
      // （表现就是点了导出没反应），所以它一秒都不能留在画板里
      if (stageBgImg.parentNode) stageBgImg.parentNode.removeChild(stageBgImg);
    }
  }

  function syncStageSheetUI() {
    syncStageColorChips();
    syncStageMedia();
    if (stageOpacityCtl) stageOpacityCtl.setValue(Math.round(stageBgState.opacity * 100), true);
    const seg = $('stageStyleSeg');
    if (seg) {
      seg.querySelectorAll('[data-stage-style]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.stageStyle === stageBgState.stylize);
      });
    }
  }

  function openStageSheet() {
    if (!stageSheet || stageOpen) return;
    if (photoOpen) closePhotoSheet();
    if (exportSheetOpen) closeExportSheet();
    if (publishSheetOpen) closePublishSheet();
    buildStageColorGrid();
    if (stageCloseTimer) {
      clearTimeout(stageCloseTimer);
      stageCloseTimer = 0;
    }
    stageOpen = true;
    syncStageSheetUI();
    applyStageBgFit();
    const panel = stageSheet.querySelector('.fields-panel');
    stageSheet.classList.remove('is-closing');
    stageSheet.classList.add('is-open');
    stageSheet.setAttribute('aria-hidden', 'false');
    if (stageBtn) stageBtn.classList.add('is-active');
    document.body.classList.add('stage-open');
    document.documentElement.classList.add('stage-open');
    setSheetPush(panel, true);
    if (window.lucide) lucide.createIcons({ nodes: [stageSheet] });
  }

  function closeStageSheet() {
    if (!stageSheet || !stageSheet.classList.contains('is-open')) return;
    stageOpen = false;
    stageBgDrag = null;
    stageBgPinch = null;
    stageBgPointers.clear();
    if (stageBgViewport) stageBgViewport.classList.remove('is-dragging');
    if (stageBtn) stageBtn.classList.remove('is-active');
    setSheetPush(null, false);
    stageSheet.classList.add('is-closing');
    stageSheet.classList.remove('is-open');
    if (stageCloseTimer) clearTimeout(stageCloseTimer);
    stageCloseTimer = setTimeout(() => {
      stageCloseTimer = 0;
      stageSheet.classList.remove('is-closing');
      stageSheet.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('stage-open');
      document.documentElement.classList.remove('stage-open');
    }, 340);
  }

  function openExportSheet() {
    if (!exportSheet || exportSheetOpen || exportBusy) return;
    if (publishSheetOpen) closePublishSheet();
    if (exportCloseTimer) {
      clearTimeout(exportCloseTimer);
      exportCloseTimer = 0;
    }
    exportSheetOpen = true;
    // 导出面板不顶起预览，直接盖在画面上
    exportSheet.classList.remove('is-closing');
    exportSheet.classList.add('is-open');
    exportSheet.setAttribute('aria-hidden', 'false');
    if (window.lucide) lucide.createIcons({ nodes: [exportSheet] });
  }

  function closeExportSheet() {
    if (!exportSheet || !exportSheet.classList.contains('is-open')) return;
    exportSheetOpen = false;
    exportSheet.classList.add('is-closing');
    exportSheet.classList.remove('is-open');
    if (exportCloseTimer) clearTimeout(exportCloseTimer);
    exportCloseTimer = setTimeout(() => {
      exportCloseTimer = 0;
      exportSheet.classList.remove('is-closing');
      exportSheet.setAttribute('aria-hidden', 'true');
    }, 340);
  }

  function openPublishSheet() {
    if (!publishSheet || publishSheetOpen || exportBusy) return;
    if (exportSheetOpen) closeExportSheet();
    if (publishCloseTimer) {
      clearTimeout(publishCloseTimer);
      publishCloseTimer = 0;
    }
    publishSheetOpen = true;
    // 发布面板不顶起预览，直接盖在画面上
    publishSheet.classList.remove('is-closing');
    publishSheet.classList.add('is-open');
    publishSheet.setAttribute('aria-hidden', 'false');
    if (window.lucide) lucide.createIcons({ nodes: [publishSheet] });
  }

  function closePublishSheet() {
    if (!publishSheet || !publishSheet.classList.contains('is-open')) return;
    publishSheetOpen = false;
    publishSheet.classList.add('is-closing');
    publishSheet.classList.remove('is-open');
    if (publishCloseTimer) clearTimeout(publishCloseTimer);
    publishCloseTimer = setTimeout(() => {
      publishCloseTimer = 0;
      publishSheet.classList.remove('is-closing');
      publishSheet.setAttribute('aria-hidden', 'true');
    }, 340);
  }

  function currentCat() {
    return Kit.CATEGORIES.find((c) => c.id === catId) || Kit.CATEGORIES[0];
  }

  function currentStyle() {
    const cat = currentCat();
    return cat.styles.find((s) => s.id === styleId) || cat.styles[0];
  }

  function hydrateFieldsFromStyle(style, keepExisting) {
    style.fields.forEach((f) => {
      if (!keepExisting || formData[f.key] == null || formData[f.key] === '') {
        formData[f.key] = f.value;
      }
    });
  }

  /** 当前票根所属分类：打开面板时用它对齐 tab，
      同时给那个 tab 标一个小圆点（用户可能正在浏览别的分类） */
  function catIdOfStyle(id) {
    const found = Kit.CATEGORIES.find((c) => c.styles.some((s) => s.id === id));
    return found ? found.id : catId;
  }

  /** 把 child 滚到容器中间（横向用于 tab 条，纵向用于票根列表） */
  function centerChildIn(child, container, axis) {
    if (!child || !container) return;
    const box = container.getBoundingClientRect();
    const r = child.getBoundingClientRect();
    if (!box.height || !box.width) return;
    if (axis === 'y') {
      const top = container.scrollTop + (r.top - box.top) - (box.height - r.height) / 2;
      container.scrollTop = Math.max(0, top);
    } else {
      const left = container.scrollLeft + (r.left - box.left) - (box.width - r.width) / 2;
      container.scrollLeft = Math.max(0, left);
    }
  }

  function renderCats() {
    const curCat = catIdOfStyle(styleId);
    catTabs.innerHTML = Kit.CATEGORIES.map(
      (c) => `<button type="button" class="cat-tab${c.id === catId ? ' is-active' : ''}${c.id === curCat ? ' has-current' : ''}" data-cat="${c.id}"${
        c.id === catId ? ' aria-current="true"' : ''
      }>
        <i data-lucide="${c.icon}"></i><span>${c.tab || c.name}</span>
      </button>`
    ).join('');
    catTabs.querySelectorAll('.cat-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.cat === catId) return;
        // 只切换「正在浏览的分类」：当前选中的票根、已填的票面数据都不动
        catId = btn.dataset.cat;
        renderCats();
        renderStyleGrid();
      });
    });
    // 分类多到要横向滚动时，当前 tab 可能藏在视口外，滚出来
    centerChildIn(catTabs.querySelector('.cat-tab.is-active'), catTabs, 'x');
  }

  /* —— 缩略图：把真实票根渲染进小盒子，等比缩放居中 ——
     返回是否真正渲染成功：失败时清空内容（否则会留下一张未缩放的原始票根，
     被 .si-box 的 overflow 裁成一条横缝，看起来就是「票根显示异常」），
     并交给调用方稍后重试 */
  function mountThumb(host, sid, boxW, boxH, pad) {
    const fail = () => {
      host.style.width = '';
      host.style.height = '';
      host.innerHTML = '';
      return false;
    };
    const found = Kit.findStyle(sid);
    if (!found || !found.style || boxW < 8 || boxH < 8) return fail();
    const data = {};
    found.style.fields.forEach((f) => {
      data[f.key] = f.value;
    });

    host.style.width = '';
    host.style.height = '';
    host.innerHTML = Kit.renderTicket(sid, data);

    const ticket = host.firstElementChild;
    if (!ticket) return fail();

    // 缩略图只有 100px 高，闪粉层（mix-blend-mode + 噪点底图）在这里看不见，
    // 却会让每次滚动重绘都做一次全层混合，直接去掉
    ticket.querySelectorAll('.fx-layer').forEach((n) => n.remove());
    if (Fx) Fx.stripUserFx(ticket);

    const w = ticket.offsetWidth;
    const h = ticket.offsetHeight;
    if (!w || !h) return fail();

    const s = Math.min(boxW / w, boxH / h) * (pad == null ? 0.88 : pad);
    ticket.style.transformOrigin = 'top left';
    ticket.style.transform = `scale(${s})`;
    host.style.width = `${Math.ceil(w * s)}px`;
    host.style.height = `${Math.ceil(h * s)}px`;

    if (window.lucide) lucide.createIcons({ nodes: [host] });
    return true;
  }

  function renderTrigger() {
    const cat = currentCat();
    const style = currentStyle();
    triggerCat.textContent = cat.name;
    triggerName.textContent = style.name;
    mountThumb(triggerThumb, style.id, triggerThumbBox.clientWidth, triggerThumbBox.clientHeight, 0.8);
  }

  /* —— 按需渲染：只挂「进入视口附近」的缩略图 ——
     关键是不在滚动帧里干活：IntersectionObserver 回调只做入队，
     真正的渲染放到 setTimeout 分批做（每批限时 6ms），这样滚动不会掉帧 */
  let gridObserver = null;
  const thumbQueue = [];
  let thumbPump = 0;

  function queueThumb(btn) {
    if (!btn || btn.dataset.thumbDone === '2' || btn.dataset.thumbQueued === '1') return;
    btn.dataset.thumbQueued = '1';
    thumbQueue.push(btn);
    if (!thumbPump) thumbPump = setTimeout(pumpThumbs, 0);
  }

  function pumpThumbs() {
    thumbPump = 0;
    const t0 = performance.now();
    let again = false;
    // 每批最多占 6ms，剩下的交给下一帧，保证主线程始终有空处理滚动
    while (thumbQueue.length && performance.now() - t0 < 6) {
      const btn = thumbQueue.shift();
      btn.dataset.thumbQueued = '';
      const box = btn.querySelector('.si-box');
      const host = btn.querySelector('.si-host');
      if (!box || !host) continue;
      const ok = mountThumb(host, btn.dataset.style, box.clientWidth, box.clientHeight);
      if (ok) {
        btn.dataset.thumbDone = '2';
        btn.classList.add('has-thumb');
        continue;
      }
      // 尺寸还没量出来（sheet 刚打开/布局未稳定）时不要一次失败就永久放弃
      const tries = Number(btn.dataset.thumbTry || 0) + 1;
      btn.dataset.thumbTry = String(tries);
      if (tries < 8) {
        thumbQueue.push(btn);
        again = true;
      } else {
        btn.dataset.thumbDone = '2';
      }
    }
    if (thumbQueue.length) thumbPump = setTimeout(pumpThumbs, again ? 32 : 16);
  }

  function flushThumbQueue() {
    if (thumbPump) clearTimeout(thumbPump);
    thumbPump = 0;
    thumbQueue.length = 0;
  }

  function mountGridThumbs() {
    flushThumbQueue();
    if (gridObserver) gridObserver.disconnect();

    if (!window.IntersectionObserver) {
      // 兜底：没有 IntersectionObserver 就全量入队（旧环境）
      styleGrid.querySelectorAll('.style-item').forEach(queueThumb);
      return;
    }

    gridObserver = new IntersectionObserver(
      (entries) => {
        // 回调里只入队，不渲染 —— 这里还在滚动帧里
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          gridObserver.unobserve(entry.target);
          queueThumb(entry.target);
        });
      },
      { root: styleGrid, rootMargin: '700px 0px' }
    );

    styleGrid.querySelectorAll('.style-item').forEach((btn) => gridObserver.observe(btn));
  }

  /** 兜底补扫：快速滑动时 IntersectionObserver 可能跳过个别 item，
      滚动停下后把视口附近的空白缩略图补进队列 */
  let sweepTimer = 0;
  function sweepVisibleThumbs() {
    if (!sheetOpen) return;
    const gr = styleGrid.getBoundingClientRect();
    const top = gr.top - 500;
    const bottom = gr.bottom + 500;
    styleGrid.querySelectorAll('.style-item').forEach((btn) => {
      const host = btn.querySelector('.si-host');
      if (!host || host.firstElementChild) return;
      const r = btn.getBoundingClientRect();
      if (r.bottom < top || r.top > bottom) return;
      queueThumb(btn);
    });
  }

  styleGrid.addEventListener(
    'scroll',
    () => {
      clearTimeout(sweepTimer);
      sweepTimer = setTimeout(sweepVisibleThumbs, 90);
    },
    { passive: true }
  );

  function renderStyleGrid() {
    // 顶部栏标题固定，分类交给下面的 tab 表达（换分类时标题不再跳字）
    sheetTitle.textContent = '票根模板';
    styleGrid.scrollTop = 0;
    styleGrid.innerHTML = currentCat().styles
      .map(
        (s) => `<button type="button" class="style-item${s.id === styleId ? ' is-active' : ''}" data-style="${s.id}" role="option" aria-selected="${s.id === styleId}">
        <span class="si-box">
          <span class="si-host" aria-hidden="true"></span>
          <span class="si-cap">
            <span class="si-name">${s.name}</span>
            <span class="si-desc">${s.desc}</span>
          </span>
        </span>
        <span class="si-check" aria-hidden="true"><i data-lucide="check"></i></span>
      </button>`
      )
      .join('');
    styleGrid.querySelectorAll('.style-item').forEach((btn) => {
      btn.addEventListener('click', () => selectStyle(btn.dataset.style));
    });
    if (window.lucide) lucide.createIcons({ nodes: [styleGrid] });
    mountGridThumbs();
    scrollActiveStyleIntoView();
  }

  /** 列表滚到当前票根：打开面板时不用自己翻到它，
      面板高度是固定的（min(64dvh, 540px)），所以量一次就准 */
  function scrollActiveStyleIntoView() {
    const active = styleGrid.querySelector('.style-item.is-active');
    if (!active) return;
    // 面板刚打开的这一帧宽高可能还没落定，补一帧再量
    centerChildIn(active, styleGrid, 'y');
    requestAnimationFrame(() => centerChildIn(active, styleGrid, 'y'));
  }

  /** 只刷选中态，不重建列表：选中票根后 sheet 不关闭，重建会丢掉滚动位置和已渲染缩略图 */
  function syncStyleSelection() {
    styleGrid.querySelectorAll('.style-item').forEach((btn) => {
      const on = btn.dataset.style === styleId;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', String(on));
    });
  }

  function selectStyle(id) {
    const kept = [];
    const keptFit = [];
    const keptAspect = [];
    if (customPhotos[0]) kept[0] = customPhotos[0];
    if (customPhotos[1]) kept[1] = customPhotos[1];
    if (photoFit[0]) keptFit[0] = photoFit[0];
    if (photoFit[1]) keptFit[1] = photoFit[1];
    if (photoAspect[0]) keptAspect[0] = photoAspect[0];
    if (photoAspect[1]) keptAspect[1] = photoAspect[1];
    styleId = id;
    // 搜索结果可能来自别的分类：把 catId 对齐过去，
    // 否则 currentCat()/currentStyle() 会指回原分类（触发栏显示错的模板名）
    catId = catIdOfStyle(id);
    Object.keys(customPhotos).forEach((k) => delete customPhotos[k]);
    Object.keys(photoFit).forEach((k) => delete photoFit[k]);
    Object.keys(photoAspect).forEach((k) => delete photoAspect[k]);
    const slots = Kit.photoSlotCount(styleId);
    if (kept[0]) customPhotos[0] = kept[0];
    if (slots >= 2 && kept[1]) customPhotos[1] = kept[1];
    if (keptFit[0]) photoFit[0] = keptFit[0];
    if (slots >= 2 && keptFit[1]) photoFit[1] = keptFit[1];
    if (keptAspect[0]) photoAspect[0] = keptAspect[0];
    if (slots >= 2 && keptAspect[1]) photoAspect[1] = keptAspect[1];
    hydrateFieldsFromStyle(currentStyle(), false);
    // 选中后不关闭 sheet：用户可以连续对比不同票根，预览区实时跟着更新
    renderAll({ keepStyleGrid: true });
  }

  let sheetOpen = false;
  let lastGridWidth = 0;

  function openSheet() {
    if (sheetOpen) return;
    if (styleCloseTimer) {
      clearTimeout(styleCloseTimer);
      styleCloseTimer = 0;
    }
    styleSheet.classList.remove('is-closing');
    sheetOpen = true;
    styleSheet.classList.add('is-open');
    styleSheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-open');
    lastGridWidth = styleGrid.clientWidth;
    // 打开时对齐到当前票根所在的分类（之后点 tab 只换浏览，不改选中）
    catId = catIdOfStyle(styleId);
    renderCats();
    renderStyleGrid();
    // 先渲染好列表再量高度：和其他 sheet 一样把预览区顶到面板上方
    setSheetPush(styleSheet.querySelector('.style-panel'), true);
    sheetClose.focus({ preventScroll: true });
  }

  function closeSheet() {
    if (!sheetOpen && !styleSheet.classList.contains('is-open')) return;
    if (styleSheet.classList.contains('is-closing')) return;
    sheetOpen = false;
    document.body.classList.remove('sheet-open');
    setSheetPush(null, false);
    styleSheet.classList.add('is-closing');
    styleSheet.classList.remove('is-open');
    // 停掉观察器与待渲染队列，避免面板关闭后还挂着已卸载的节点
    if (gridObserver) {
      gridObserver.disconnect();
      gridObserver = null;
    }
    flushThumbQueue();
    if (styleCloseTimer) clearTimeout(styleCloseTimer);
    styleCloseTimer = setTimeout(() => {
      styleCloseTimer = 0;
      styleSheet.classList.remove('is-closing');
      styleSheet.setAttribute('aria-hidden', 'true');
    }, 340);
  }

  styleTrigger.addEventListener('click', openSheet);
  sheetClose.addEventListener('click', () => {
    closeSheet();
    styleTrigger.focus({ preventScroll: true });
  });
  if (styleScrim) styleScrim.addEventListener('click', closeSheet);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen) closeSheet();
    if (e.key === 'Escape' && fxOpen) closeFxSheet();
    if (e.key === 'Escape' && fieldsOpen) closeFieldsSheet();
    if (e.key === 'Escape' && photoOpen) closePhotoSheet();
    if (e.key === 'Escape' && stageOpen) closeStageSheet();
    if (e.key === 'Escape' && exportSheetOpen) closeExportSheet();
    if (e.key === 'Escape' && publishSheetOpen) closePublishSheet();
  });

  function renderFields() {
    const style = currentStyle();
    fieldsEl.innerHTML = style.fields
      .map((f) => {
        const val = formData[f.key] != null ? formData[f.key] : f.value;
        return `<div class="field">
          <label for="f-${f.key}">${f.label}</label>
          <input id="f-${f.key}" data-key="${f.key}" type="text" maxlength="64" value="${escapeAttr(val)}" placeholder="${escapeAttr(f.placeholder)}" />
        </div>`;
      })
      .join('');
    fieldsEl.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        formData[input.dataset.key] = input.value;
        renderTicketOnly();
      });
    });
  }

  function escapeAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function ticketData() {
    const style = currentStyle();
    const data = {};
    style.fields.forEach((f) => {
      data[f.key] = formData[f.key] != null ? formData[f.key] : f.value;
    });
    return data;
  }

  function renderTicketOnly() {
    const html = Kit.renderTicket(styleId, ticketData(), activePhotos());
    if (paperPresentMode === 'paper3d' && window.TicketPaper) {
      ticketHost.classList.add('ticket-host--paper3d');
      ticketHost.innerHTML = `<div class="ticket-dom">${html}</div><div class="paper-gl-wrap" hidden><canvas class="paper-gl-canvas"></canvas><span class="paper-gl-busy" hidden>纸感渲染中…</span></div>`;
      if (paperGl) paperGl.dispose();
      paperGl = TicketPaper.attach(ticketHost);
      if (!paperGl) {
        ticketHost.classList.add('is-paper-fallback');
      } else {
        paperGl.show();
      }
    } else {
      ticketHost.classList.remove('ticket-host--paper3d', 'is-paper-fallback');
      ticketHost.innerHTML = html;
      if (paperGl) paperGl.hide();
    }
    delete ticketHost.dataset.natW;
    delete ticketHost.dataset.natH;
    applyUserFx();
    applyPhotoFit(getTicketRoot());
    if (window.lucide) lucide.createIcons({ nodes: [ticketHost] });
    requestAnimationFrame(() => fitTicket(true));
    schedulePaperRender();
  }

  function parseRadius(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** 照片高亮圆角：优先用 photo-frame 自身；若为直角但被祖先 overflow+圆角裁切，则同步可见轮廓 */
  function syncPhotoTargetRadii(ticket) {
    ticket.querySelectorAll('.fx-user-slot--photo').forEach((slot) => {
      const frame = slot.closest('.photo-frame');
      if (!frame) return;
      const fr = getComputedStyle(frame);
      let tl = parseRadius(fr.borderTopLeftRadius);
      let tr = parseRadius(fr.borderTopRightRadius);
      let br = parseRadius(fr.borderBottomRightRadius);
      let bl = parseRadius(fr.borderBottomLeftRadius);

      if (tl + tr + br + bl === 0) {
        const fRect = frame.getBoundingClientRect();
        let node = frame.parentElement;
        while (node && ticket.contains(node)) {
          const cs = getComputedStyle(node);
          const clips = cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
          const rtl = parseRadius(cs.borderTopLeftRadius);
          const rtr = parseRadius(cs.borderTopRightRadius);
          const rbr = parseRadius(cs.borderBottomRightRadius);
          const rbl = parseRadius(cs.borderBottomLeftRadius);
          if (clips && rtl + rtr + rbr + rbl > 0) {
            const aRect = node.getBoundingClientRect();
            const eps = 2;
            if (Math.abs(fRect.top - aRect.top) < eps && Math.abs(fRect.left - aRect.left) < eps) tl = rtl;
            if (Math.abs(fRect.top - aRect.top) < eps && Math.abs(fRect.right - aRect.right) < eps) tr = rtr;
            if (Math.abs(fRect.bottom - aRect.bottom) < eps && Math.abs(fRect.right - aRect.right) < eps) br = rbr;
            if (Math.abs(fRect.bottom - aRect.bottom) < eps && Math.abs(fRect.left - aRect.left) < eps) bl = rbl;
            break;
          }
          node = node.parentElement;
        }
      }

      slot.style.setProperty('--fx-photo-radii', `${tl}px ${tr}px ${br}px ${bl}px`);
    });
  }

  function applyUserFx() {
    if (!Fx) return;
    const ticket = getTicketRoot();
    if (!ticket) return;
    const list = fxDraft ? fxInstances.concat([fxDraft]) : fxInstances.slice();
    Fx.mount(ticket, list, {
      ticketData: ticketData(),
      selectedId: fxOpen ? fxSelectedId : null,
      editing: fxOpen,
    });
    ticket.dataset.fxTarget = fxTarget;
    ticket.querySelectorAll('[data-fx-slot]').forEach((slot) => {
      slot.classList.toggle('is-active-target', fxOpen && slot.dataset.fxSlot === fxTarget);
    });
    if (fxOpen && fxTarget === 'photo') syncPhotoTargetRadii(ticket);
    bindStampGestures(ticket);
  }

  function selectedFx() {
    if (fxDraft && fxDraft.id === fxSelectedId) return fxDraft;
    return fxInstances.find((x) => x.id === fxSelectedId) || null;
  }

  function findFxById(id) {
    if (fxDraft && fxDraft.id === id) return fxDraft;
    return fxInstances.find((x) => x.id === id) || null;
  }

  function syncFxFooter(show) {
    if (!fxFooter) return;
    fxFooter.classList.toggle('is-hidden', !show);
  }

  function commitFxDraft() {
    if (!fxDraft) return;
    const committed = {
      id: fxDraft.id,
      catalogId: fxDraft.catalogId,
      target: fxDraft.target,
      params: Object.assign({}, fxDraft.params),
    };
    fxInstances.push(committed);
    fxDraft = null;
    fxSelectedId = committed.id;
    renderTicketOnly();
    refreshFxUI();
    closeFxSheet();
  }

  function refreshFxUI() {
    if (!Fx || !fxLayerBar) return;

    fxLayerBar.innerHTML = Fx.LAYERS.map(
      (l) => `<button type="button" class="fx-chip fx-chip--layer${l.id === fxTarget ? ' is-active' : ''}" data-layer="${l.id}" role="radio" aria-checked="${l.id === fxTarget}">${l.label}</button>`
    ).join('');
    fxLayerBar.querySelectorAll('[data-layer]').forEach((btn) => {
      btn.addEventListener('click', () => {
        fxTarget = btn.dataset.layer;
        if (fxDraft) fxDraft.target = fxTarget;
        const sel = selectedFx();
        // 已选中的已用项：同步改它所在层
        if (sel && !(fxDraft && sel.id === fxDraft.id)) {
          sel.target = fxTarget;
        }
        applyUserFx();
        refreshFxUI();
      });
    });
    if (fxLayerHint) fxLayerHint.textContent = FX_LAYER_HINT[fxTarget] || '';

    fxTabs.innerHTML = Fx.TABS.map(
      (t) => `<button type="button" class="fx-tab${t.id === fxTab ? ' is-active' : ''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');
    fxTabs.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        fxTab = btn.dataset.tab;
        if (fxTab === 'material') {
          refreshFxUI();
          return;
        }
        if (fxTab === 'stamp' || fxTab === 'text') fxTarget = 'top';
        if (fxTab === 'texture' && fxTarget === 'top') fxTarget = 'bg';
        refreshFxUI();
        applyUserFx();
      });
    });

    const fxLayerRow = fxSheet && fxSheet.querySelector('.fx-layer-row');
    const fxUsedWrap = fxSheet && fxSheet.querySelector('.fx-used-wrap');
    if (fxLayerRow) fxLayerRow.hidden = fxTab === 'material';
    if (fxLayerHint) fxLayerHint.hidden = fxTab === 'material';

    if (fxTab === 'material') {
      renderMaterialPanel();
      return;
    }
    if (fxUsedWrap) fxUsedWrap.hidden = false;

    const list = Fx.catalogByTab(fxTab);
    const previewId = fxDraft ? fxDraft.catalogId : null;
    fxCatalog.classList.remove('is-mat');
    fxCatalog.innerHTML = list
      .map(
        (c) => `<button type="button" class="fx-cat-item${previewId === c.id ? ' is-preview' : ''}" data-preview="${c.id}">
        <span class="fx-cat-name">${c.name}</span>
      </button>`
      )
      .join('');
    fxCatalog.querySelectorAll('[data-preview]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const catalogId = btn.dataset.preview;
        // 再次点同一项：取消预览
        if (fxDraft && fxDraft.catalogId === catalogId) {
          fxDraft = null;
          fxSelectedId = null;
          renderTicketOnly();
          refreshFxUI();
          return;
        }
        const inst = Fx.createInstance(catalogId, fxTarget, ticketData());
        if (!inst) return;
        fxDraft = inst;
        fxSelectedId = inst.id;
        renderTicketOnly();
        refreshFxUI();
      });
    });

    const layerLabel = Object.fromEntries(Fx.LAYERS.map((l) => [l.id, l.label]));
    if (!fxInstances.length) {
      fxUsed.innerHTML = '';
    } else {
      fxUsed.innerHTML = fxInstances
        .map((inst) => {
          const item = Fx.getItem(inst.catalogId);
          const name = item ? item.name : inst.catalogId;
          return `<button type="button" class="fx-used-item${inst.id === fxSelectedId ? ' is-active' : ''}" data-sel="${inst.id}">
            ${name}·${layerLabel[inst.target] || inst.target}
            <span class="fx-used-del" data-del="${inst.id}" title="删除">×</span>
          </button>`;
        })
        .join('');
      fxUsed.querySelectorAll('[data-sel]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          if (e.target.closest('[data-del]')) return;
          fxDraft = null; // 改已用项时收起预览
          fxSelectedId = btn.dataset.sel;
          const inst = selectedFx();
          if (inst) fxTarget = inst.target;
          renderTicketOnly();
          refreshFxUI();
        });
      });
      fxUsed.querySelectorAll('[data-del]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.del;
          fxInstances = fxInstances.filter((x) => x.id !== id);
          if (fxSelectedId === id) fxSelectedId = null;
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }

    renderFxParams();
  }

  function renderMaterialPanel() {
    if (!fxCatalog || !fxParams || !window.TicketPaper) return;
    const presets = TicketPaper.PRESETS;
    // :has() 在 Chrome 61 里整条规则会被丢掉，所以同时挂一个 class 给基线层用
    fxCatalog.classList.add('is-mat');
    fxCatalog.innerHTML = `<div class="mat-panel">
      <p class="mat-hint">平面模式即时预览；纸感 3D 约 0.25 秒刷新，导出与预览一致。</p>
      <div class="fx-field"><label>呈现</label>
        <div class="fx-seg" id="paperModeSeg">
          <button type="button" class="fx-seg-btn${paperPresentMode === 'flat' ? ' is-active' : ''}" data-paper-mode="flat">经典平面</button>
          <button type="button" class="fx-seg-btn${paperPresentMode === 'paper3d' ? ' is-active' : ''}" data-paper-mode="paper3d">纸感 3D</button>
        </div>
      </div>
      <div class="fx-field"><label>纸材预设</label>
        <div class="fx-seg fx-seg--wrap" id="paperPresetSeg">${Object.keys(presets)
          .map(
            (id) =>
              `<button type="button" class="fx-seg-btn${paperPreset === id ? ' is-active' : ''}" data-paper-preset="${id}">${presets[id].label}</button>`
          )
          .join('')}</div>
      </div>
    </div>`;
    fxUsed.innerHTML = '';
    if (fxSheet && fxSheet.querySelector('.fx-used-wrap')) {
      fxSheet.querySelector('.fx-used-wrap').hidden = true;
    }

    fxParams.innerHTML = `<div class="fx-field"><label>纸纹 ${Math.round(paperGrain * 100)}%</label>
      <input type="range" id="paperGrainRange" min="0" max="100" value="${Math.round(paperGrain * 100)}" /></div>
      <div class="fx-field"><label>光照 ${Math.round(paperLight * 100)}%</label>
      <input type="range" id="paperLightRange" min="20" max="100" value="${Math.round(paperLight * 100)}" /></div>
      <div class="fx-field"><label>微卷 ${Math.round(paperCurl * 100)}%</label>
      <input type="range" id="paperCurlRange" min="0" max="35" value="${Math.round(paperCurl * 100)}" /></div>`;
    syncFxFooter(false);

    fxCatalog.querySelectorAll('[data-paper-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        paperPresentMode = btn.dataset.paperMode;
        renderTicketOnly();
        refreshFxUI();
      });
    });
    fxCatalog.querySelectorAll('[data-paper-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        paperPreset = btn.dataset.paperPreset;
        const p = presets[paperPreset] || presets.matte;
        paperGrain = p.grain;
        paperCurl = p.curl;
        if (paperGl) paperGl.setParams(paperParams());
        if (paperPresentMode === 'paper3d') schedulePaperRender();
        refreshFxUI();
      });
    });

    const grainEl = $('paperGrainRange');
    const lightEl = $('paperLightRange');
    const curlEl = $('paperCurlRange');
    const bindPaperRange = (el, key, labelPrefix, div) => {
      if (!el) return;
      el.addEventListener('input', () => {
        const v = Number(el.value);
        if (key === 'grain') paperGrain = v / 100;
        if (key === 'light') paperLight = v / 100;
        if (key === 'curl') paperCurl = v / 100;
        if (paperGl) {
          paperGl.setParams(paperParams());
          paperGl.renderFrame();
        }
        if (paperPresentMode === 'paper3d' && key !== 'light') schedulePaperRender();
        const label = el.closest('.fx-field') && el.closest('.fx-field').querySelector('label');
        if (label) label.textContent = `${labelPrefix} ${v}%`;
      });
    };
    bindPaperRange(grainEl, 'grain', '纸纹');
    bindPaperRange(lightEl, 'light', '光照');
    bindPaperRange(curlEl, 'curl', '微卷');
  }

  function renderFxParams() {
    const inst = selectedFx();
    const isDraft = !!(fxDraft && inst && inst.id === fxDraft.id);
    if (!inst || !Fx) {
      fxParams.innerHTML = '<p class="fx-params-empty">点素材预览，或点已用项调整</p>';
      syncFxFooter(false);
      return;
    }
    const item = Fx.getItem(inst.catalogId);
    if (!item) {
      fxParams.innerHTML = '<p class="fx-params-empty">未知特效</p>';
      syncFxFooter(false);
      return;
    }
    const p = inst.params;
    const parts = [];

    if (isDraft) {
      parts.push(`<div class="fx-preview-banner">预览中 · ${item.name}（未添加）</div>`);
    }

    // 文字类：输入框放最前
    if (item.hasText) {
      parts.push(`<div class="fx-field"><label>文字内容</label>
        <input type="text" class="fx-text-input" maxlength="40" placeholder="输入文字…" value="${escapeAttr(p.text || '')}" data-param="text" /></div>`);
    }

    if (item.textControls) {
      const borderOn = !!p.border;
      parts.push(`<div class="fx-field"><label>边框</label>
        <div class="fx-seg" id="fxBorderToggle">
          <button type="button" class="fx-seg-btn${!borderOn ? ' is-active' : ''}" data-border="0">无</button>
          <button type="button" class="fx-seg-btn${borderOn ? ' is-active' : ''}" data-border="1">有</button>
        </div></div>`);
      if (borderOn) {
        parts.push('<div class="fx-field"><label>边框样式</label><div class="fx-seg" id="fxBorderStyle"></div></div>');
        parts.push('<div class="fx-field"><label>边框形状</label><div class="fx-seg" id="fxBorderShape"></div></div>');
      }
      parts.push(`<div class="fx-field"><label>字号 ${Math.round(p.fontSize || 16)}</label>
        <input type="range" min="10" max="36" value="${Math.round(p.fontSize || 16)}" data-param="fontSize" /></div>`);
      parts.push('<div class="fx-field"><label>字体</label><div class="fx-fonts" id="fxFontRow"></div></div>');
      parts.push('<div class="fx-field"><label>颜色</label><div class="fx-swatches" id="fxColorRow"></div></div>');
    } else if (item.hasText) {
      parts.push('<div class="fx-field"><label>字体</label><div class="fx-fonts" id="fxFontRow"></div></div>');
      if (item.hasColor || item.hasText) {
        parts.push('<div class="fx-field"><label>颜色</label><div class="fx-swatches" id="fxColorRow"></div></div>');
      }
    } else if (item.hasColor) {
      parts.push('<div class="fx-field"><label>颜色</label><div class="fx-swatches" id="fxColorRow"></div></div>');
    }

    parts.push(`<div class="fx-field"><label>强度 ${Math.round((p.opacity || 0) * 100)}%</label>
      <input type="range" min="5" max="100" value="${Math.round((p.opacity || 0.5) * 100)}" data-param="opacity" /></div>`);

    if (item.hasDensity) {
      parts.push(`<div class="fx-field"><label>密度 ${Math.round((p.density || 1) * 100)}%</label>
        <input type="range" min="50" max="200" value="${Math.round((p.density || 1) * 100)}" data-param="density" /></div>`);
    }
    if (item.hasGlitter) {
      parts.push(`<div class="fx-field"><label>颗粒大小 ${Math.round((p.glitterSize || 1) * 100)}%</label>
        <input type="range" min="50" max="200" value="${Math.round((p.glitterSize || 1) * 100)}" data-param="glitterSize" /></div>`);
      parts.push('<div class="fx-field"><label>形状</label><div class="fx-seg fx-seg--wrap" id="fxGlitterShape"></div></div>');
    }
    if (item.movable) {
      parts.push(`<div class="fx-field"><label>水平位置 ${Math.round(p.x || 50)}%</label>
        <input type="range" min="5" max="95" value="${Math.round(p.x || 50)}" data-param="x" /></div>`);
      parts.push(`<div class="fx-field"><label>垂直位置 ${Math.round(p.y || 50)}%</label>
        <input type="range" min="5" max="95" value="${Math.round(p.y || 50)}" data-param="y" /></div>`);
      parts.push(`<div class="fx-field"><label>缩放</label>
        <input type="range" min="40" max="220" value="${Math.round((p.scale || 1) * 100)}" data-param="scale" /></div>`);
      parts.push(`<div class="fx-field"><label>旋转 ${Math.round(p.rotate || 0)}°</label>
        <input type="range" min="-180" max="180" value="${Math.round(p.rotate || 0)}" data-param="rotate" /></div>`);
    }

    fxParams.innerHTML = parts.join('');
    syncFxFooter(isDraft);

    fxParams.querySelectorAll('[data-param]').forEach((el) => {
      el.addEventListener('input', () => {
        const key = el.dataset.param;
        if (key === 'opacity' || key === 'density' || key === 'scale' || key === 'glitterSize') {
          p[key] = Number(el.value) / 100;
        } else if (key === 'rotate' || key === 'x' || key === 'y' || key === 'fontSize') {
          p[key] = Number(el.value);
        } else if (key === 'text') {
          p.text = el.value;
        }
        renderTicketOnly();
        if (key !== 'text') {
          const label = el.closest('.fx-field') && el.closest('.fx-field').querySelector('label');
          if (label && key === 'opacity') label.textContent = `强度 ${Math.round(p.opacity * 100)}%`;
          if (label && key === 'rotate') label.textContent = `旋转 ${Math.round(p.rotate)}°`;
          if (label && key === 'x') label.textContent = `水平位置 ${Math.round(p.x)}%`;
          if (label && key === 'y') label.textContent = `垂直位置 ${Math.round(p.y)}%`;
          if (label && key === 'fontSize') label.textContent = `字号 ${Math.round(p.fontSize)}`;
          if (label && key === 'density') label.textContent = `密度 ${Math.round(p.density * 100)}%`;
          if (label && key === 'glitterSize') label.textContent = `颗粒大小 ${Math.round(p.glitterSize * 100)}%`;
        }
      });
    });

    const glitterShapeRow = $('fxGlitterShape');
    if (glitterShapeRow && Fx.GLITTER_SHAPES) {
      const cur = p.glitterShape || 'dot';
      glitterShapeRow.innerHTML = Fx.GLITTER_SHAPES.map(
        (s) => `<button type="button" class="fx-seg-btn${cur === s.id ? ' is-active' : ''}" data-gshape="${s.id}">${s.label}</button>`
      ).join('');
      glitterShapeRow.querySelectorAll('[data-gshape]').forEach((btn) => {
        btn.addEventListener('click', () => {
          p.glitterShape = btn.dataset.gshape;
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }

    const borderToggle = $('fxBorderToggle');
    if (borderToggle) {
      borderToggle.querySelectorAll('[data-border]').forEach((btn) => {
        btn.addEventListener('click', () => {
          p.border = btn.dataset.border === '1';
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }

    const borderStyleRow = $('fxBorderStyle');
    if (borderStyleRow && Fx.BORDER_STYLES) {
      borderStyleRow.innerHTML = Fx.BORDER_STYLES.map(
        (s) => `<button type="button" class="fx-seg-btn${(p.borderStyle || 'solid') === s.id ? ' is-active' : ''}" data-bstyle="${s.id}">${s.label}</button>`
      ).join('');
      borderStyleRow.querySelectorAll('[data-bstyle]').forEach((btn) => {
        btn.addEventListener('click', () => {
          p.borderStyle = btn.dataset.bstyle;
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }

    const borderShapeRow = $('fxBorderShape');
    if (borderShapeRow && Fx.BORDER_SHAPES) {
      borderShapeRow.innerHTML = Fx.BORDER_SHAPES.map(
        (s) => `<button type="button" class="fx-seg-btn${(p.borderShape || 'round') === s.id ? ' is-active' : ''}" data-bshape="${s.id}">${s.label}</button>`
      ).join('');
      borderShapeRow.querySelectorAll('[data-bshape]').forEach((btn) => {
        btn.addEventListener('click', () => {
          p.borderShape = btn.dataset.bshape;
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }

    const fontRow = $('fxFontRow');
    if (fontRow) {
      fontRow.innerHTML = Fx.FONTS.map(
        (f) => `<button type="button" class="fx-font-btn${p.font === f.id ? ' is-active' : ''}" data-font="${f.id}" style="font-family:${f.family}">${f.label}</button>`
      ).join('');
      fontRow.querySelectorAll('[data-font]').forEach((btn) => {
        btn.addEventListener('click', () => {
          p.font = btn.dataset.font;
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }

    const colorRow = $('fxColorRow');
    if (colorRow) {
      colorRow.innerHTML = Fx.COLORS.map(
        (c) => `<button type="button" class="fx-swatch${p.color === c ? ' is-active' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`
      ).join('');
      colorRow.querySelectorAll('[data-color]').forEach((btn) => {
        btn.addEventListener('click', () => {
          p.color = btn.dataset.color;
          renderTicketOnly();
          refreshFxUI();
        });
      });
    }
  }

  let dragState = null;

  function bindStampGestures(ticket) {
    if (!fxOpen || !ticket) return;
    ticket.querySelectorAll('.ufx-movable').forEach((el) => {
      el.addEventListener('pointerdown', onStampPointerDown);
    });
  }

  function onStampPointerDown(e) {
    if (!fxOpen) return;
    const el = e.currentTarget;
    const id = el.dataset.fxId;
    const inst = findFxById(id);
    if (!inst) return;
    fxSelectedId = id;
    refreshFxUI();

    const slot = el.closest('[data-fx-slot]');
    if (!slot) return;
    const rect = slot.getBoundingClientRect();
    dragState = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: inst.params.x,
      origY: inst.params.y,
      rectW: rect.width,
      rectH: rect.height,
    };
    try {
      el.setPointerCapture(e.pointerId);
    } catch (_) {}
    e.preventDefault();
    e.stopPropagation();
  }

  function onStampPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const inst = findFxById(dragState.id);
    if (!inst) return;
    const dx = ((e.clientX - dragState.startX) / dragState.rectW) * 100;
    const dy = ((e.clientY - dragState.startY) / dragState.rectH) * 100;
    inst.params.x = Math.min(95, Math.max(5, dragState.origX + dx));
    inst.params.y = Math.min(95, Math.max(5, dragState.origY + dy));
    ticketHost.querySelectorAll(`.ufx-movable[data-fx-id="${inst.id}"]`).forEach((node) => {
      const scale = inst.params.scale || 1;
      const rotate = inst.params.rotate || 0;
      node.style.left = `${inst.params.x}%`;
      node.style.top = `${inst.params.y}%`;
      node.style.transform = `translate(-50%,-50%) rotate(${rotate}deg) scale(${scale})`;
    });
  }

  function onStampPointerUp(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    dragState = null;
  }

  window.addEventListener('pointermove', onStampPointerMove);
  window.addEventListener('pointerup', onStampPointerUp);
  window.addEventListener('pointercancel', onStampPointerUp);

  let fxCloseTimer = 0;

  function lockFxScroll(lock) {
    document.body.classList.toggle('fx-open', lock);
    document.documentElement.classList.toggle('fx-open', lock);
  }

  function onFxTouchMove(e) {
    if (!fxOpen && !fieldsOpen && !photoOpen && !stageOpen) return;
    if (
      e.target.closest &&
      (e.target.closest('.fx-body') ||
        e.target.closest('.fields-body') ||
        e.target.closest('.stage-media-viewport') ||
        e.target.closest('.photo-adjust-body'))
    ) {
      return;
    }
    e.preventDefault();
  }

  function openFxSheet() {
    if (!Fx || fxOpen) return;
    if (fxCloseTimer) {
      clearTimeout(fxCloseTimer);
      fxCloseTimer = 0;
    }
    fxOpen = true;
    const panel = fxSheet.querySelector('.fx-panel');
    // 先定推高再播 sheet，预览与面板同帧起步，避免高度后知后觉
    setSheetPush(panel, true);
    fxSheet.classList.remove('is-closing');
    fxSheet.classList.add('is-open');
    fxSheet.setAttribute('aria-hidden', 'false');
    fxBtn.classList.add('is-active');
    lockFxScroll(true);
    resetTilt();
    refreshFxUI();
    applyUserFx();
    if (window.lucide) lucide.createIcons({ nodes: [fxSheet, fxBtn] });
  }

  function closeFxSheet() {
    if (!fxOpen && !fxSheet.classList.contains('is-open')) return;
    if (!fxSheet.classList.contains('is-open')) return;

    fxOpen = false;
    fxDraft = null;
    if (fxSelectedId && !fxInstances.some((x) => x.id === fxSelectedId)) {
      fxSelectedId = null;
    }
    syncFxFooter(false);
    fxBtn.classList.remove('is-active');
    setSheetPush(null, false);

    // 先播关闭动画，再卸状态（避免 visibility 瞬间切掉）
    fxSheet.classList.add('is-closing');
    fxSheet.classList.remove('is-open');
    if (fxCloseTimer) clearTimeout(fxCloseTimer);
    fxCloseTimer = setTimeout(() => {
      fxCloseTimer = 0;
      fxSheet.classList.remove('is-closing');
      fxSheet.setAttribute('aria-hidden', 'true');
      lockFxScroll(false);
      applyUserFx();
    }, 340);
  }

  if (fxBtn) fxBtn.addEventListener('click', () => (fxOpen ? closeFxSheet() : openFxSheet()));
  if (fxClose) fxClose.addEventListener('click', closeFxSheet);
  if (fxScrim) fxScrim.addEventListener('click', closeFxSheet);
  if (fxCommitBtn) fxCommitBtn.addEventListener('click', commitFxDraft);
  if (fieldsBtn) fieldsBtn.addEventListener('click', () => (fieldsOpen ? closeFieldsSheet() : openFieldsSheet()));
  if (fieldsClose) fieldsClose.addEventListener('click', closeFieldsSheet);
  if (fieldsScrim) fieldsScrim.addEventListener('click', closeFieldsSheet);
  if (photoClose) photoClose.addEventListener('click', closePhotoSheet);
  if (photoScrim) photoScrim.addEventListener('click', closePhotoSheet);
  if (photoReplaceBtn) {
    photoReplaceBtn.addEventListener('click', () => {
      activePickSlot = adjustSlot;
      photoInput.value = '';
      photoInput.click();
    });
  }
  if (photoConfirmBtn) {
    photoConfirmBtn.addEventListener('click', closePhotoSheet);
  }

  function photoPointerDistance() {
    const pts = [...photoPointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  }

  function beginPhotoPinch() {
    const dist = photoPointerDistance();
    if (dist < 6) return;
    photoDrag = null;
    photoPinch = {
      startDist: dist,
      origScale: getPhotoFit(adjustSlot).scale,
    };
  }

  function beginPhotoPan(e) {
    const fit = getPhotoFit(adjustSlot);
    const ar = slotImageAspect(adjustSlot);
    const pan = photoPanAxes(adjustSlot, fit, ar);
    photoDrag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: fit.x,
      origY: fit.y,
      canPanX: pan.canPanX,
      canPanY: pan.canPanY,
      rect: photoAdjustViewport.getBoundingClientRect(),
      moved: 0,
    };
    photoAdjustViewport.classList.add('is-dragging');
  }

  function isPhotoFitRestState(slot) {
    const f = getPhotoFit(slot);
    return f.scale <= 1.02 && Math.abs(f.x - 50) < 1.5 && Math.abs(f.y - 50) < 1.5;
  }

  function togglePhotoDoubleZoom(clientX, clientY) {
    if (isPhotoFitRestState(adjustSlot)) {
      const rect = photoAdjustViewport.getBoundingClientRect();
      let x = 50;
      let y = 50;
      if (rect.width > 0 && rect.height > 0) {
        x = clampPct(((clientX - rect.left) / rect.width) * 100);
        y = clampPct(((clientY - rect.top) / rect.height) * 100);
      }
      animatePhotoFitForSlot(adjustSlot, { scale: PHOTO_DOUBLE_ZOOM, x, y });
    } else {
      animatePhotoFitForSlot(adjustSlot, DEFAULT_PHOTO_FIT);
    }
  }

  function tryPhotoDoubleTap(clientX, clientY) {
    const now = Date.now();
    const dt = now - photoLastTapAt;
    const dist = Math.hypot(clientX - photoLastTapX, clientY - photoLastTapY);
    if (dt > 0 && dt < PHOTO_DOUBLE_TAP_MS && dist < PHOTO_DOUBLE_TAP_PX * 2.5) {
      photoLastTapAt = 0;
      photoSuppressDblClick = true;
      togglePhotoDoubleZoom(clientX, clientY);
      return;
    }
    photoLastTapAt = now;
    photoLastTapX = clientX;
    photoLastTapY = clientY;
  }

  if (photoAdjustViewport) {
    photoAdjustViewport.addEventListener('pointerdown', (e) => {
      if (!photoOpen) return;
      if (e.button != null && e.button !== 0) return;
      clearPhotoFitAnim(photoFitImgsForSlot(adjustSlot));
      photoPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        photoAdjustViewport.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (photoPointers.size === 1) {
        beginPhotoPan(e);
      } else if (photoPointers.size === 2) {
        beginPhotoPinch();
      }
      e.preventDefault();
    });
    photoAdjustViewport.addEventListener('pointermove', (e) => {
      if (!photoOpen || !photoPointers.has(e.pointerId)) return;
      photoPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (photoPinch && photoPointers.size >= 2) {
        const dist = photoPointerDistance();
        if (dist < 6) return;
        const scale = Math.min(2.6, Math.max(1, photoPinch.origScale * (dist / photoPinch.startDist)));
        setPhotoFit(adjustSlot, { scale });
        syncPhotoAdjustFromFit();
        return;
      }
      if (!photoDrag || photoPointers.size !== 1 || e.pointerId !== photoDrag.pointerId) return;
      photoDrag.moved = Math.max(
        photoDrag.moved,
        Math.hypot(e.clientX - photoDrag.startX, e.clientY - photoDrag.startY)
      );
      const dx = ((e.clientX - photoDrag.startX) / photoDrag.rect.width) * 100;
      const dy = ((e.clientY - photoDrag.startY) / photoDrag.rect.height) * 100;
      const next = { scale: getPhotoFit(adjustSlot).scale };
      if (photoDrag.canPanX) next.x = clampPct(photoDrag.origX - dx);
      if (photoDrag.canPanY) next.y = clampPct(photoDrag.origY - dy);
      setPhotoFit(adjustSlot, next);
      syncPhotoAdjustFromFit();
    });
    const endPhotoGesture = (e) => {
      if (!photoPointers.has(e.pointerId)) return;
      const drag = photoDrag && e.pointerId === photoDrag.pointerId ? photoDrag : null;
      photoPointers.delete(e.pointerId);
      if (drag) {
        if (drag.moved < PHOTO_DOUBLE_TAP_PX) {
          tryPhotoDoubleTap(e.clientX, e.clientY);
        }
        photoDrag = null;
      }
      if (photoPointers.size < 2) photoPinch = null;
      if (photoPointers.size === 0) {
        photoAdjustViewport.classList.remove('is-dragging');
      }
    };
    photoAdjustViewport.addEventListener('pointerup', endPhotoGesture);
    photoAdjustViewport.addEventListener('pointercancel', endPhotoGesture);
    photoAdjustViewport.addEventListener('dblclick', (e) => {
      if (!photoOpen) return;
      if (photoSuppressDblClick) {
        photoSuppressDblClick = false;
        e.preventDefault();
        return;
      }
      e.preventDefault();
      togglePhotoDoubleZoom(e.clientX, e.clientY);
    });
    photoAdjustViewport.addEventListener(
      'wheel',
      (e) => {
        if (!photoOpen) return;
        e.preventDefault();
        const fit = getPhotoFit(adjustSlot);
        const next = Math.min(2.6, Math.max(1, fit.scale - e.deltaY * 0.002));
        setPhotoFit(adjustSlot, { scale: next });
        syncPhotoAdjustFromFit();
      },
      { passive: false }
    );
  }

  document.addEventListener('touchmove', onFxTouchMove, { passive: false });
  if (fxClearAll) {
    fxClearAll.addEventListener('click', () => {
      fxInstances = [];
      fxDraft = null;
      fxSelectedId = null;
      renderTicketOnly();
      refreshFxUI();
    });
  }

  function renderAll(opts) {
    renderCats();
    renderTrigger();
    renderFields();
    syncPhotoSlots();
    renderTicketOnly();
    if (sheetOpen) {
      // 选票根时只同步选中态，避免重建列表导致滚动位置/缩略图全部重来
      if (opts && opts.keepStyleGrid) syncStyleSelection();
      else renderStyleGrid();
    }
    if (fxOpen) refreshFxUI();
    if (window.lucide) lucide.createIcons();
  }

  /** 竖屏优先：按预览区宽高等比缩进
   *  缓存票面固有尺寸，避免过渡中反复「清缩放→闪大图→再缩小」 */
  let fitScale = 1;
  function fitTicket(forceRemeasure) {
    const ticket = getTicketRoot();
    if (!ticket || !tiltScene || !tiltCard) return;

    let w = Number(ticketHost.dataset.natW) || 0;
    let h = Number(ticketHost.dataset.natH) || 0;

    if (forceRemeasure || !w || !h) {
      const keepT = ticketHost.style.transform;
      const keepW = ticketHost.style.width;
      const keepH = ticketHost.style.height;
      ticketHost.style.transform = 'none';
      ticketHost.style.width = '';
      ticketHost.style.height = '';
      w = ticket.offsetWidth;
      h = ticket.offsetHeight;
      if (!forceRemeasure && (keepW || keepT)) {
        ticketHost.style.width = keepW;
        ticketHost.style.height = keepH;
        ticketHost.style.transform = keepT;
      }
      if (!w || !h) return;
      ticketHost.dataset.natW = String(w);
      ticketHost.dataset.natH = String(h);
    }

    // 画板宽高比跟着票根走（换模板/票型后这里会重新对齐）
    layoutStageArtboard();

    // 按「票根 + 四周等宽留白」的外框来定缩放，
    // 于是票根在画板里正好留出一圈均匀的背景边
    const fp = stageFramePad(w, h);
    const frameW = w + fp * 2;
    const frameH = h + fp * 2;
    const availW = Math.max(tiltScene.clientWidth, 60);
    const availH = Math.max(tiltScene.clientHeight, 60);
    fitScale = Math.min(availW / frameW, availH / frameH);
    fitScale = Math.min(1.35, Math.max(0.22, fitScale));

    ticketHost.style.width = `${w}px`;
    ticketHost.style.height = `${h}px`;
    ticketHost.style.transformOrigin = 'top left';
    ticketHost.style.transform = `scale(${fitScale})`;
    tiltCard.style.width = `${Math.ceil(w * fitScale)}px`;
    tiltCard.style.height = `${Math.ceil(h * fitScale)}px`;
  }

  if (photoSlots) {
    photoSlots.addEventListener('click', (e) => {
      const clearBtn = e.target.closest('[data-clear]');
      if (clearBtn) {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(clearBtn.dataset.clear);
        clearPhotoSlot(idx);
        renderTicketOnly();
        renderTrigger();
        syncPhotoSlots();
        return;
      }
      const adjustBtn = e.target.closest('[data-adjust]');
      if (adjustBtn) {
        const idx = Number(adjustBtn.dataset.adjust);
        if (!Number.isFinite(idx)) return;
        openPhotoSheet(idx);
        return;
      }
      const pickBtn = e.target.closest('[data-add]');
      if (!pickBtn) return;
      activePickSlot = Number(pickBtn.dataset.add);
      if (!Number.isFinite(activePickSlot)) return;
      photoInput.value = '';
      photoInput.click();
    });
  }

  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    // 必须读成 data URL，不能用 URL.createObjectURL：
    // blob: 地址 html-to-image 无法内联，会导致导出直接失败
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const slot = activePickSlot;
      customPhotos[slot] = url;
      resetPhotoFit(slot);
      loadImageAspect(url)
        .then((imageAspect) => {
          photoAspect[slot] = imageAspect;
          renderTicketOnly();
          renderTrigger();
          syncPhotoSlots();
          if (photoOpen && adjustSlot === slot) {
            syncPhotoAdjustFromFit();
            return;
          }
          if (needsPhotoCompose(slot, imageAspect)) {
            requestAnimationFrame(() => openPhotoSheet(slot));
          }
        })
        .catch(() => {
          renderTicketOnly();
          renderTrigger();
          syncPhotoSlots();
        });
    };
    reader.onerror = () => {
      alert('图片读取失败，请重试');
    };
    reader.readAsDataURL(file);
  });

  /* —— 预览投影 ——
     预览区的倾斜（跟随光标改变角度 + 动态光照）已移除，
     这里只负责把票根的固定投影恢复成静止状态。 */
  function resetTilt() {
    if (paperPresentMode === 'paper3d' && paperGl) {
      paperGl.setLight(0, 0);
      paperGl.renderFrame();
      ticketHost.style.filter = 'drop-shadow(4px 10px 16px rgba(40, 34, 26, 0.12))';
      return;
    }
    ticketHost.style.filter = 'drop-shadow(6px 12px 18px rgba(0,0,0,0.32))';
  }

  window.addEventListener('resize', () => {
    resetTilt();
    layoutStageArtboard();
    fitTicket(true);
    if (photoOpen) layoutPhotoAdjustViewport();
    renderTrigger();
    // 只有宽度真的变了才重建列表（移动端地址栏收起也会触发 resize）
    if (sheetOpen && styleGrid.clientWidth !== lastGridWidth) {
      lastGridWidth = styleGrid.clientWidth;
      renderStyleGrid();
    }
  });
  if (window.ResizeObserver) {
    // 用缓存固有尺寸持续跟 avail，过渡中不会闪大图
    new ResizeObserver(() => fitTicket(false)).observe(tiltScene);
    // 预览区尺寸变化（sheet 顶起 / 过渡）→ 同步画板等比缩放
    new ResizeObserver(() => layoutStageArtboard()).observe(stagePanel);
  }
  resetTilt();

  /* —— 导出补镂空 ——
     导出走 html-to-image（把 DOM 塞进 SVG foreignObject 光栅化），
     这条路径对 CSS mask（尤其 mask-composite: intersect）不可靠：
     孔常常没被真的打穿，导出的 PNG 上就留一块灰。
     这里按同一份 CSS 几何，在光栅化结果上把孔擦成真正的透明。 */

  /** 按括号深度切逗号：gradient 里的逗号不能当分隔符 */
  function splitTopLevel(str) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (let i = 0; i < String(str).length; i += 1) {
      const ch = str[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  /** 按空白切词，但 calc(100% - 103px) 这种要当成一个整体 */
  function splitTokens(str) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of String(str).trim()) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (/\s/.test(ch) && depth === 0) {
        if (cur) out.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }

  let maskProbe = null;

  /** 用「探针元素」求 CSS 长度：百分比按盒宽高解、calc 交给浏览器算，
      比在 JS 里重写一遍 calc 语义可靠 */
  function resolveCssLen(expr, boxW, boxH, axis) {
    if (expr == null || expr === '') return 0;
    let v = String(expr).trim();
    const kw = { left: '0px', top: '0px', right: '100%', bottom: '100%', center: '50%' };
    if (kw[v]) v = kw[v];
    if (!maskProbe) {
      const box = document.createElement('div');
      const probe = document.createElement('div');
      box.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;';
      probe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0';
      box.appendChild(probe);
      document.body.appendChild(box);
      maskProbe = { box, probe };
    }
    const { box, probe } = maskProbe;
    box.style.width = `${Math.max(0, boxW)}px`;
    box.style.height = `${Math.max(0, boxH)}px`;
    probe.style.left = '0';
    probe.style.top = '0';
    if (axis === 'x') probe.style.left = v;
    else probe.style.top = v;
    const b = box.getBoundingClientRect();
    const p = probe.getBoundingClientRect();
    probe.style.left = '0';
    probe.style.top = '0';
    return axis === 'x' ? p.left - b.left : p.top - b.top;
  }

  /** 解析一层 mask-image，返回它在元素内打出的孔（元素自身坐标，不含 transform）。
      只处理「圆孔」：radial-gradient + 透明色停靠点 */
  function maskLayerHoles(img, size, repeat, position, ew, eh) {
    if (!/radial-gradient\(/i.test(img)) return null;
    const inner = img.slice(img.indexOf('(') + 1, img.lastIndexOf(')'));
    const parts = splitTopLevel(inner);
    const shape = parts[0] || '';
    const stops = parts.slice(1);

    const atMatch = shape.match(/\bat\b([\s\S]+)$/i);
    let cxExpr = '50%';
    let cyExpr = '50%';
    if (atMatch) {
      const toks = splitTokens(atMatch[1]);
      if (toks.length >= 2) {
        cxExpr = toks[0];
        cyExpr = toks[1];
      }
    }

    // 半径写在 `circle 9px` 里，或由透明色停靠点给出（transparent 0 93% → 0.93R）
    const explicit = parseFloat((shape.match(/circle\s+([\d.]+)px/i) || [])[1]);
    let radius = 0;
    stops.forEach((st) => {
      const alpha0 =
        /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(st) || /\btransparent\b/i.test(st);
      if (!alpha0) return;
      const m = st.match(/(-?[\d.]+)(px|%)\s*$/);
      if (!m) return;
      const n = parseFloat(m[1]);
      if (m[2] === '%') {
        if (Number.isFinite(explicit) && explicit > 0) radius = explicit * (n / 100);
      } else {
        radius = n;
      }
    });
    if (!(radius > 0)) return null;

    const sizeToks = splitTokens(size || 'auto');
    const lw = !sizeToks[0] || sizeToks[0] === 'auto' ? ew : resolveCssLen(sizeToks[0], ew, eh, 'x');
    const lh = !sizeToks[1] || sizeToks[1] === 'auto' ? eh : resolveCssLen(sizeToks[1], ew, eh, 'y');
    if (!(lw > 0) || !(lh > 0)) return null;

    const cx = resolveCssLen(cxExpr, lw, lh, 'x');
    const cy = resolveCssLen(cyExpr, lw, lh, 'y');
    const posToks = splitTokens(position || '0% 0%');
    const posX = resolveCssLen(posToks[0] || '0%', Math.max(0, ew - lw), eh, 'x');
    const posY = resolveCssLen(posToks[1] != null ? posToks[1] : '0%', ew, Math.max(0, eh - lh), 'y');
    const baseX = posX + cx;
    const baseY = posY + cy;

    const rep = String(repeat || 'repeat').trim();
    const repX = rep === 'repeat' || rep === 'repeat-x' || rep === 'space' || rep === 'round';
    const repY = rep === 'repeat' || rep === 'repeat-y' || rep === 'space' || rep === 'round';

    const xs = [];
    if (repX) {
      const k0 = Math.floor((-radius - baseX) / lw);
      const k1 = Math.ceil((ew + radius - baseX) / lw);
      for (let k = k0; k <= k1; k += 1) xs.push(baseX + k * lw);
    } else if (baseX > -radius && baseX < ew + radius) {
      xs.push(baseX);
    }

    const ys = [];
    if (repY) {
      const k0 = Math.floor((-radius - baseY) / lh);
      const k1 = Math.ceil((eh + radius - baseY) / lh);
      for (let k = k0; k <= k1; k += 1) ys.push(baseY + k * lh);
    } else if (baseY > -radius && baseY < eh + radius) {
      ys.push(baseY);
    }
    if (!xs.length || !ys.length) return null;

    const out = [];
    xs.forEach((x) => ys.forEach((y) => out.push({ x, y, r: radius })));
    return out;
  }

  /** 单块不透明渐变（如 linear-gradient(#000, #000)）：只铺底、不贡献孔 */
  function isOpaqueFullLayer(img) {
    const s = String(img).trim();
    if (!/^linear-gradient\(/i.test(s)) return false;
    const ink = '(?:rgb\\(0,\\s*0,\\s*0\\)|rgba\\(0,\\s*0,\\s*0,\\s*1\\)|#000000|#000|black)';
    const pos = '(?:\\s+-?[\\d.]+(?:px|%))?';
    return new RegExp(`^linear-gradient\\(\\s*${ink}${pos}\\s*,\\s*${ink}${pos}\\s*\\)$`, 'i').test(s);
  }

  /** 把孔位写成一张单层 SVG 遮罩。
      注意：url() 图片遮罩走的是 alpha 通道（不是亮度），所以孔必须是
      真·透明；同时保留白色底块+纯黑孔，万一按亮度解释也还是同一个结果。
      白底还顶掉了原来那层 linear-gradient(#000,#000)，
      整块遮罩只剩一层，不再需要 mask-composite。 */
  function maskSvgUrl(ew, eh, holes) {
    const r2 = (n) => Math.round(n * 100) / 100;
    const circles = holes
      .filter((h) => h.x + h.r > 0 && h.x - h.r < ew && h.y + h.r > 0 && h.y - h.r < eh)
      .map((h) => `<circle cx="${r2(h.x)}" cy="${r2(h.y)}" r="${r2(h.r)}" fill="#000" fill-opacity="0"/>`)
      .join('');
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(ew)}" height="${r2(eh)}" ` +
      `viewBox="0 0 ${r2(ew)} ${r2(eh)}">` +
      `<rect width="${r2(ew)}" height="${r2(eh)}" fill="#fff"/>` +
      circles +
      `</svg>`;
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }

  /** 把「多层 + mask-composite: intersect」的镂空压成等价的单层遮罩。
      邮票齿孔原本是 5 层 radial-gradient 相交出来的，但光栅化（html-to-image
      把 DOM 塞进 SVG foreignObject）常把 composite 当成 add：第一层整块底色
      一盖，孔就被填实 —— 导出的票根看起来「没有镂空」。
      压成单层后不再依赖 composite；而且元素自身的阴影/描边会跟着孔一起被裁掉，
      否则只能事后擦像素，孔边会留下一条阴影线。
      返回还原函数（用在画板这类不能改坏的实时节点上）。 */
  function flattenMasks(rootEl) {
    const restored = [];
    if (!rootEl) return () => {};
    const set = (el, prop, value) => {
      restored.push({
        el,
        prop,
        prev: el.style.getPropertyValue(prop),
        pri: el.style.getPropertyPriority(prop),
      });
      el.style.setProperty(prop, value, 'important');
    };
    const nodes = [rootEl].concat(Array.from(rootEl.querySelectorAll('*')));
    nodes.forEach((el) => {
      let cs;
      try {
        cs = getComputedStyle(el);
      } catch (_) {
        return;
      }
      if (!cs || cs.display === 'none') return;
      const raw = cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage : cs.webkitMaskImage;
      if (!raw || raw === 'none') return;
      const images = splitTopLevel(raw);
      if (images.length < 2) return; // 单层遮罩本来就正常，不动它
      const composite = `${cs.maskComposite || ''} ${cs.webkitMaskComposite || ''}`;
      if (!/intersect|source-in/i.test(composite)) return;
      const ew = el.offsetWidth;
      const eh = el.offsetHeight;
      if (!ew || !eh) return;
      const sizes = splitTopLevel(cs.maskSize || 'auto');
      const repeats = splitTopLevel(cs.maskRepeat || 'repeat');
      const positions = splitTopLevel(cs.maskPosition || '0% 0%');
      const holes = [];
      for (let i = 0; i < images.length; i += 1) {
        const img = images[i];
        if (isOpaqueFullLayer(img)) continue;
        const layer = maskLayerHoles(
          img,
          sizes[i % sizes.length],
          repeats[i % repeats.length],
          positions[i % positions.length],
          ew,
          eh
        );
        // 有一层解析不了就整体放弃：宁可保持原样，也不要改出一个错的孔
        if (!layer) return;
        holes.push(...layer);
      }
      if (!holes.length) return;
      const url = maskSvgUrl(ew, eh, holes);
      set(el, '-webkit-mask-image', url);
      set(el, 'mask-image', url);
      set(el, '-webkit-mask-size', '100% 100%');
      set(el, 'mask-size', '100% 100%');
      set(el, '-webkit-mask-repeat', 'no-repeat');
      set(el, 'mask-repeat', 'no-repeat');
      set(el, '-webkit-mask-position', '0 0');
      set(el, 'mask-position', '0 0');
      set(el, '-webkit-mask-composite', 'source-over');
      set(el, 'mask-composite', 'add');
      set(el, 'mask-origin', 'border-box');
      set(el, 'mask-clip', 'border-box');
    });
    return () => {
      restored.forEach(({ el, prop, prev, pri }) => {
        if (prev) el.style.setProperty(prop, prev, pri);
        else el.style.removeProperty(prop);
      });
    };
  }

  /* —— 导出落地 ——
     容器里没有 a[download]、blob 下载也被禁，导出必须走 JSBridge：
     canvas.toDataURL() → writeTempFile → saveImageToPhotosAlbum。
     普通浏览器（本地预览）没有 window.xhs，退回 a[download]。 */

  function xhsMiniTool() {
    const m = window.xhs && window.xhs.miniTool;
    return m && typeof m.writeTempFile === 'function' && typeof m.saveImageToPhotosAlbum === 'function'
      ? m
      : null;
  }

  async function savePng(dataUrl, filename) {
    const miniTool = xhsMiniTool();
    if (!miniTool) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.click();
      return;
    }
    const res = await miniTool.writeTempFile({ data: dataUrl });
    const filePath = res && res.filePath;
    if (!filePath) throw new Error('writeTempFile 未返回 filePath');
    await miniTool.saveImageToPhotosAlbum({ filePath });
    alert('已保存到相册');
  }

  function xhsPostNote() {
    const m = window.xhs && window.xhs.miniTool;
    return m && typeof m.postNote === 'function' ? m : null;
  }

  function noteText() {
    const cat = currentCat();
    const style = currentStyle();
    const data = ticketData();
    const values = style.fields
      .map((field) => data[field.key])
      .filter((value) => value != null && String(value).trim())
      .map((value) => String(value).trim())
      .slice(0, 4);
    const title = `${cat.name || '我的'}票根`.slice(0, 20);
    const content = [
      `用帧藏做了一张${cat.name || ''}·${style.name || '票根'}`,
      values.join('｜'),
      '#帧藏 #票根 #生活记录',
    ].filter(Boolean).join('\n').slice(0, 1000);
    return { title, content };
  }

  async function postNote(dataUrl) {
    const miniTool = xhsPostNote();
    if (!miniTool) {
      alert('当前不在支持小红书发布的环境');
      return;
    }
    const { title, content } = noteText();
    await miniTool.postNote({
      title,
      content,
      pageType: 'photo_publish',
      mediaInfo: { image_resources: [{ url: dataUrl }] },
    });
  }

  /** 光栅化参数：把字体以 data: 内联进 SVG，避免运行时去取字体文件
      （离线容器里取包内资源不可靠，会静默退化成系统字体） */
  function rasterOptions(extra) {
    const opts = Object.assign(
      { pixelRatio: 2, cacheBust: true, backgroundColor: null },
      extra || {}
    );
    if (window.__FONT_EMBED_CSS) opts.fontEmbedCSS = window.__FONT_EMBED_CSS;
    return opts;
  }

  async function rasterizeForExport(node, pixelRatio) {
    if (window.TicketPaper && TicketPaper.rasterizeNode) {
      return TicketPaper.rasterizeNode(node, window.htmlToImage, pixelRatio);
    }
    return window.htmlToImage.toCanvas(node, rasterOptions({ pixelRatio }));
  }

  /** 画布几乎全透明？用来兜住「遮罩被当成全透明」这种极端情况 */
  function isNearlyEmptyCanvas(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return true;
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const step = 4 * Math.max(1, Math.round(data.length / 4 / 40000));
      let opaque = 0;
      let total = 0;
      for (let i = 3; i < data.length; i += step) {
        total += 1;
        if (data[i] > 24) opaque += 1;
      }
      return !total || opaque / total < 0.1;
    } catch (_) {
      return false; // 读不了（被污染）就当正常，别乱回退
    }
  }

  /** 光栅化前清掉没有 src 的 <img>：
      光栅化库会为它们抛出一个没有信息的 Event，导致整次导出失败
      （表现为「点了导出没反应」），所以任何导出入口都先过一遍 */
  function stripEmptyImgs(node) {
    if (!node) return;
    node.querySelectorAll('img:not([src])').forEach((n) => {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
  }

  /* —— export —— */
  async function exportTicketPng(shouldPost = false) {
    if (!window.htmlToImage) {
      alert('截图库加载失败，请重试');
      return;
    }
    const node = getTicketRoot();
    if (!node) return;

    exportBusy = true;
    exportBtn.disabled = true;
    const label = exportBtn.querySelector('span');
    const prevLabel = label ? label.textContent : '导出';
    if (label) label.textContent = '导出中…';

    const stage = document.createElement('div');
    stage.className = 'export-stage';
    stage.setAttribute('aria-hidden', 'true');
    const clip = prepareCloneForRaster(node);
    stage.appendChild(clip);
    document.body.appendChild(stage);
    stripEmptyImgs(clip);

    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      let dataUrl;
      const pixelRatio = 2;
      // 先把多层镂空压成单层，否则光栅化会丢掉 mask-composite，票根就没有镂空了
      flattenMasks(clip);
      let canvas = await rasterizeForExport(clip, pixelRatio);
      if (isNearlyEmptyCanvas(canvas)) {
        // 万一单层遮罩在光栅化里被当成全透明（整张票连同阴影都没了），
        // 宁可不要镂空也不能导出空白
        console.warn('镂空遮罩未生效，回退为不裁切');
        [clip].concat(Array.from(clip.querySelectorAll('*'))).forEach((n) => {
          n.style.setProperty('-webkit-mask-image', 'none', 'important');
          n.style.setProperty('mask-image', 'none', 'important');
        });
        canvas = await rasterizeForExport(clip, pixelRatio);
      }
      if (paperPresentMode === 'paper3d' && window.TicketPaper) {
        const gl = ensurePaperGl();
        dataUrl = gl ? gl.capturePngFromCanvas(canvas, paperParams()) : canvas.toDataURL('image/png');
      } else {
        dataUrl = canvas.toDataURL('image/png');
      }

      if (shouldPost) {
        await postNote(dataUrl);
      } else {
        await savePng(dataUrl, `ticket-${styleId}-${Date.now()}.png`);
      }
    } catch (err) {
      console.error('导出失败', err);
      alert(shouldPost ? '发布失败，请重试' : '导出失败，请重试；若仍失败可换一张本地图片');
    } finally {
      stage.remove();
      exportBusy = false;
      exportBtn.disabled = false;
      if (label) label.textContent = prevLabel;
      if (window.lucide) lucide.createIcons({ nodes: [exportBtn] });
    }
  }

  async function exportScenePng(shouldPost = false) {
    if (!window.htmlToImage || !stagePanel || !stageArtboard) {
      alert('截图库加载失败，请重试');
      return;
    }

    exportBusy = true;
    exportBtn.disabled = true;
    const label = exportBtn.querySelector('span');
    const prevLabel = label ? label.textContent : '导出';
    if (label) label.textContent = '导出中…';

    const savedFilter = ticketHost.style.filter;
    resetTilt();
    if (paperPresentMode === 'paper3d' && paperGl) {
      paperGl.setLight(0, 0);
      paperGl.renderFrame();
    }

    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const pixelRatio = 2;
      /* 画板宽度是容器查询单位（cqw/cqh）算出来的：光栅化时克隆脱离了
         .stage 这个查询容器，cq 单位会退化成视口尺寸 → 画板变大、票根位置跑偏。
         所以先把它锁成当前实际像素尺寸 */
      const artRect = stageArtboard.getBoundingClientRect();
      const prevW = stageArtboard.style.width;
      const prevH = stageArtboard.style.height;
      stageArtboard.style.width = `${artRect.width}px`;
      stageArtboard.style.height = `${artRect.height}px`;

      let dataUrl;
      // 多层镂空压成单层，光栅化才会真的把票根裁出孔（孔里直接露出画板背景）
      const restoreMasks = flattenMasks(stageArtboard);
      try {
        // 兜底：没有 src 的空 <img> 会让光栅化抛 Event，整次导出失败
        stripEmptyImgs(stageArtboard);
        const canvas = await htmlToImage.toCanvas(stageArtboard, rasterOptions({ pixelRatio }));
        dataUrl = canvas.toDataURL('image/png');
      } finally {
        restoreMasks();
        stageArtboard.style.width = prevW;
        stageArtboard.style.height = prevH;
      }

      if (shouldPost) {
        await postNote(dataUrl);
      } else {
        await savePng(dataUrl, `preview-${styleId}-${Date.now()}.png`);
      }
    } catch (err) {
      console.error('预览导出失败', err);
      alert(shouldPost ? '发布失败，请重试' : '预览导出失败，请重试');
    } finally {
      ticketHost.style.filter = savedFilter;
      exportBusy = false;
      exportBtn.disabled = false;
      if (label) label.textContent = prevLabel;
      if (window.lucide) lucide.createIcons({ nodes: [exportBtn] });
    }
  }

  if (stageBtn) stageBtn.addEventListener('click', () => (stageOpen ? closeStageSheet() : openStageSheet()));
  if (stageClose) stageClose.addEventListener('click', closeStageSheet);
  if (stageScrim) stageScrim.addEventListener('click', closeStageSheet);
  buildStageColorGrid();
  if (stageMediaPickTile) {
    stageMediaPickTile.addEventListener('click', () => pickStageBgFile());
  }
  if (stageBgPickBtn) {
    stageBgPickBtn.addEventListener('click', () => pickStageBgFile());
  }
  if (stageBgClearBtn) {
    stageBgClearBtn.addEventListener('click', () => clearStageBgImage());
  }
  if (stageOpacityUi) {
    stageOpacityCtl = mountUiRange(stageOpacityUi, {
      min: 5,
      max: 100,
      value: Math.round(stageBgState.opacity * 100),
      onInput(v) {
        stageBgState.opacity = v / 100;
        applyStageBg();
        syncStageSheetUI();
      },
    });
  }
  if (stageBgInput) {
    stageBgInput.addEventListener('change', () => {
      const file = stageBgInput.files && stageBgInput.files[0];
      if (!file) return;
      const onLoaded = (url) => {
        stageBgState.imageUrl = url;
        stageBgState.fit = { x: 50, y: 50, scale: 1 };
        stageBgState.opacity = 1;
        stageBgImageAspect = 0;
        loadImageAspect(url)
          .then((a) => {
            stageBgImageAspect = a;
          })
          .catch(() => {
            stageBgImageAspect = 0;
          })
          .finally(() => {
            applyStageBg();
            syncStageSheetUI();
            applyStageBgFit();
          });
      };
      const reader = new FileReader();
      reader.onload = () => onLoaded(String(reader.result));
      reader.onerror = () => alert('图片读取失败，请重试');
      reader.readAsDataURL(file);
    });
  }
  if (stageBgViewport) {
    stageBgViewport.addEventListener('pointerdown', (e) => {
      if (!stageOpen || !stageBgState.imageUrl) return;
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest && e.target.closest('.stage-media-clear')) return;
      stageBgPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        stageBgViewport.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      if (stageBgPointers.size === 1) beginStageBgPan(e);
      else if (stageBgPointers.size === 2) beginStageBgPinch();
      e.preventDefault();
    });
    stageBgViewport.addEventListener('pointermove', (e) => {
      if (!stageOpen || !stageBgPointers.has(e.pointerId)) return;
      stageBgPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (stageBgPinch && stageBgPointers.size >= 2) {
        const dist = stageBgPointerDistance();
        if (dist < 6) return;
        setStageBgFit({
          scale: stageBgPinch.origScale * (dist / stageBgPinch.startDist),
        });
        return;
      }
      if (!stageBgDrag || stageBgPointers.size !== 1 || e.pointerId !== stageBgDrag.pointerId) return;
      stageBgDrag.moved = Math.max(
        stageBgDrag.moved,
        Math.hypot(e.clientX - stageBgDrag.startX, e.clientY - stageBgDrag.startY)
      );
      const dx = ((e.clientX - stageBgDrag.startX) / stageBgDrag.rect.width) * 100;
      const dy = ((e.clientY - stageBgDrag.startY) / stageBgDrag.rect.height) * 100;
      const next = { scale: getStageBgFit().scale };
      if (stageBgDrag.canPanX) next.x = clampPct(stageBgDrag.origX - dx);
      if (stageBgDrag.canPanY) next.y = clampPct(stageBgDrag.origY - dy);
      setStageBgFit(next);
    });
    const endStageBgGesture = (e) => {
      if (!stageBgPointers.has(e.pointerId)) return;
      const drag = stageBgDrag && e.pointerId === stageBgDrag.pointerId ? stageBgDrag : null;
      stageBgPointers.delete(e.pointerId);
      if (drag) {
        if (drag.moved < PHOTO_DOUBLE_TAP_PX) tryStageBgDoubleTap(e.clientX, e.clientY);
        stageBgDrag = null;
      }
      if (stageBgPointers.size < 2) stageBgPinch = null;
      if (stageBgPointers.size === 0) stageBgViewport.classList.remove('is-dragging');
    };
    stageBgViewport.addEventListener('pointerup', endStageBgGesture);
    stageBgViewport.addEventListener('pointercancel', endStageBgGesture);
    stageBgViewport.addEventListener('dblclick', (e) => {
      if (!stageOpen || !stageBgState.imageUrl) return;
      e.preventDefault();
      if (stageBgSuppressDblClick) {
        stageBgSuppressDblClick = false;
        return;
      }
      toggleStageBgDoubleZoom(e.clientX, e.clientY);
    });
    stageBgViewport.addEventListener(
      'wheel',
      (e) => {
        if (!stageOpen || !stageBgState.imageUrl) return;
        e.preventDefault();
        const fit = getStageBgFit();
        setStageBgFit({ scale: fit.scale - e.deltaY * 0.002 });
      },
      { passive: false }
    );
  }
  const stageStyleSeg = $('stageStyleSeg');
  if (stageStyleSeg) {
    stageStyleSeg.querySelectorAll('[data-stage-style]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stageBgState.stylize = btn.dataset.stageStyle || 'none';
        applyStageBg();
        syncStageSheetUI();
      });
    });
  }

  exportBtn.addEventListener('click', () => openExportSheet());
  if (publishBtn) publishBtn.addEventListener('click', () => openPublishSheet());
  if (exportClose) exportClose.addEventListener('click', closeExportSheet);
  if (exportScrim) exportScrim.addEventListener('click', closeExportSheet);
  if (publishClose) publishClose.addEventListener('click', closePublishSheet);
  if (publishScrim) publishScrim.addEventListener('click', closePublishSheet);
  if (exportTicketBtn) {
    exportTicketBtn.addEventListener('click', async () => {
      closeExportSheet();
      await exportTicketPng();
    });
  }
  if (exportSceneBtn) {
    exportSceneBtn.addEventListener('click', async () => {
      closeExportSheet();
      await exportScenePng();
    });
  }
  function updatePublishNoteButton() {
    if (publishNoteBtn) {
      publishNoteBtn.querySelector('.export-option-desc').textContent = xhsPostNote()
        ? '将当前预览画面生成图片笔记并打开发布页'
        : '请在小红书小工具内打开后使用此功能';
    }
  }
  updatePublishNoteButton();
  window.setTimeout(updatePublishNoteButton, 500);
  if (publishNoteBtn) {
    publishNoteBtn.addEventListener('click', async () => {
      closePublishSheet();
      await exportScenePng(true);
    });
  }
  if (publishTicketBtn) {
    publishTicketBtn.addEventListener('click', async () => {
      closePublishSheet();
      await exportTicketPng(true);
    });
  }

  applyStageBg();
  syncStageSheetUI();
  hydrateFieldsFromStyle(currentStyle(), false);
  renderAll();
  layoutStageArtboard();
  fitTicket(false);
  requestAnimationFrame(() => {
    layoutStageArtboard();
    fitTicket(false);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => layoutStageArtboard());
  }
  localizeDefaultPhotos();
})();

/* == xhs-reward:begin（由 shared/sync-reward.mjs 维护，勿手改）== */
/*!
 * xhs-reward.js — 小红书小工具「赞赏」通用入口（§3.19 / §3.20）
 *
 * 依据《小工具容器 · 能力清单》2026-11-10：
 *   · rewardAuthor 无业务参数，客户端负责赞赏开关校验、面板、协议、充值支付与频控；
 *   · 成功只返回 errMsg: "rewardAuthor:ok"，**不含金额与支付结果**，不能据此判断是否付费；
 *   · 需客户端 9.53.3+，且当前小工具需先在创服平台开通赞赏能力；
 *   · SDK 方法存在不代表客户端已支持，旧客户端可能静默无响应，所以调用要带超时兜底；
 *   · setCloseRetentionEnabled 必须配合赞赏使用，开关默认 false，容器关闭后失效。
 *
 * 用法（零配置，引入即用）：引入本文件即可，无需改 HTML / CSS。
 * 需要自定义时再调用：
 *   XhsReward.mount({ label: '请我喝杯茶', position: 'right', retentionAfter: 0 })
 */
(function (global) {
  'use strict';

  if (!global || global.XhsReward) return;

  var MIN_CLIENT = 9533;
  var CALL_TIMEOUT = 8000;
  var PROBE_KEY = 'xhs-reward-unavailable';
  var MOUNT_ID = 'xhsRewardEntry';

  function tool() {
    var x = global.xhs;
    return (x && x.miniTool) || null;
  }

  function hasApi() {
    var m = tool();
    return !!(m && typeof m.rewardAuthor === 'function');
  }

  function buildVersionOf(lo) {
    var env = lo && lo.miniToolEnv;
    return Number(env && env.buildVersion) || 0;
  }

  var versionPromise = null;

  function clientVersion() {
    if (versionPromise) return versionPromise;
    var x = global.xhs;
    var sync = buildVersionOf(x && x.launchOptions);
    if (sync) {
      versionPromise = Promise.resolve(Math.floor(sync / 1000));
      return versionPromise;
    }
    var m = tool();
    if (!m || typeof m.getLaunchOptions !== 'function') {
      versionPromise = Promise.resolve(0);
      return versionPromise;
    }
    versionPromise = Promise.resolve(m.getLaunchOptions()).then(function (lo) {
      return Math.floor(buildVersionOf(lo) / 1000);
    }).catch(function () { return 0; });
    return versionPromise;
  }

  /** 能否展示入口：方法齐备 + 版本达标 + 本次会话没出现过「不可用」 */
  function available() {
    if (!hasApi()) return Promise.resolve(false);
    try {
      if (global.sessionStorage && global.sessionStorage.getItem(PROBE_KEY) === '1') {
        return Promise.resolve(false);
      }
    } catch (e) {}
    return clientVersion().then(function (cv) {
      return !!cv && cv >= MIN_CLIENT;
    });
  }

  function markUnavailable() {
    try {
      if (global.sessionStorage) global.sessionStorage.setItem(PROBE_KEY, '1');
    } catch (e) {}
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject({ errMsg: 'rewardAuthor:timeout', errCode: -2 });
      }, ms || CALL_TIMEOUT);
      Promise.resolve(promise).then(function (v) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      }).catch(function (e) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  function open() {
    var m = tool();
    if (!m || typeof m.rewardAuthor !== 'function') {
      return Promise.reject({ errMsg: 'rewardAuthor:unsupported', errCode: -1 });
    }
    var call;
    try {
      call = m.rewardAuthor();
    } catch (e) {
      return Promise.reject(e);
    }
    return withTimeout(call).catch(function (err) {
      // 容器白名单 / 未开通 / 旧客户端静默：本次会话不再尝试
      var code = err && err.errCode != null ? Number(err.errCode) : NaN;
      if (code === 10001 || code === 10002 || code === 10003 || code === -2 || isNaN(code)) {
        markUnavailable();
      }
      throw err;
    });
  }

  function retention(enabled) {
    var m = tool();
    if (!m || typeof m.setCloseRetentionEnabled !== 'function') return Promise.resolve(false);
    try {
      return Promise.resolve(m.setCloseRetentionEnabled({ enabled: !!enabled }))
        .catch(function () { return false; });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  /* ── 轻提示 ───────────────────────────────── */

  var toastTimer = 0;

  function toast(msg) {
    var el = document.getElementById('xhsRwToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'xhsRwToast';
      el.className = 'xhs-rw-toast';
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2000);
  }

  /* ── 样式（内联 <style> 在容器内允许，§2.6）──── */

  var CSS = [
    '.xhs-rw{position:fixed;left:14px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:60;',
    'display:none;align-items:center;gap:5px;padding:7px 13px;border-radius:999px;',
    'background:rgba(28,18,14,.72);border:1px solid rgba(255,190,120,.42);',
    'color:#ffe0b0;font:700 12px/1 -apple-system,"PingFang SC",sans-serif;letter-spacing:.06em;',
    'box-shadow:0 4px 14px rgba(0,0,0,.28);cursor:pointer;-webkit-tap-highlight-color:transparent;',
    'transition:transform .12s ease,opacity .2s ease;opacity:0;}',
    '.xhs-rw.on{display:inline-flex;opacity:1;}',
    '.xhs-rw:active{transform:scale(.95);}',
    '.xhs-rw[data-pos="right"]{left:auto;right:14px;}',
    '.xhs-rw i{font-style:normal;font-size:13px;line-height:1;color:#ffb347;}',
    '.xhs-rw-toast{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));',
    'z-index:61;max-width:76vw;padding:9px 16px;border-radius:999px;background:rgba(30,20,16,.94);',
    'border:1px solid rgba(255,190,120,.3);color:#ffe0b0;font:700 13px/1.4 -apple-system,"PingFang SC",sans-serif;',
    'text-align:center;opacity:0;visibility:hidden;pointer-events:none;',
    'transform:translateX(-50%) translateY(8px);transition:opacity .2s,transform .2s,visibility .2s;}',
    '.xhs-rw-toast.on{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0);}'
  ].join('');

  function injectStyle() {
    if (document.getElementById('xhsRwStyle')) return;
    var st = document.createElement('style');
    st.id = 'xhsRwStyle';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ── 入口挂载 ─────────────────────────────── */

  var mounted = null;
  var retentionTimer = 0;

  function mount(opts) {
    opts = opts || {};
    if (mounted) return mounted;
    if (!document.body) return null;

    injectStyle();

    var el = document.createElement('div');
    el.id = MOUNT_ID;
    el.className = 'xhs-rw';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    if (opts.position === 'right') el.setAttribute('data-pos', 'right');
    el.innerHTML = '<i>♥</i><span></span>';
    el.querySelector('span').textContent = opts.label || '赞赏支持';
    document.body.appendChild(el);
    mounted = el;

    // 游戏类页面在 window 上监听 pointerdown 做跳跃，必须阻止冒泡
    function swallow(e) { e.stopPropagation(); }
    el.addEventListener('pointerdown', swallow);
    el.addEventListener('touchstart', swallow, { passive: true });

    function trigger(e) {
      e.preventDefault();
      e.stopPropagation();
      if (el.getAttribute('data-busy') === '1') return;
      el.setAttribute('data-busy', '1');
      open().then(function () {
        // 成功只代表流程被唤起，不代表已支付（§3.19）
      }).catch(function (err) {
        var code = err && err.errCode != null ? Number(err.errCode) : NaN;
        if (code === 15503 || code === 2009) {
          toast('今天的赞赏次数已达上限');
        } else if (code === -2) {
          toast('赞赏暂未响应，请稍后再试');
        } else {
          toast('赞赏暂不可用');
          hide();
        }
      }).then(function () {
        el.removeAttribute('data-busy');
      });
    }

    el.addEventListener('click', trigger);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') trigger(e);
    });

    function show() { el.classList.add('on'); }
    function hide() { el.classList.remove('on'); }

    /* 底部工具条抬高：很多工具底部有固定/绝对定位的操作栏，赞赏入口不能压在上面。
       按「所有贴底元素的最上沿」算，这样多行堆叠的底栏（如座位选择 + 操作按钮）也能整体让开。 */
    function liftAboveDock() {
      var vh = global.innerHeight || 0;
      var top = vh;
      var all = document.body ? document.body.getElementsByTagName('*') : [];
      for (var i = 0; i < all.length; i++) {
        var n = all[i];
        if (n === el) continue;
        var r = n.getBoundingClientRect();
        if (r.height < 24 || r.height > vh * 0.6) continue;
        if (r.width < 40) continue;
        if (vh - r.bottom > 24) continue;          // 必须贴底
        var cs = global.getComputedStyle(n);
        if (!cs || cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (Number(cs.opacity) === 0 || cs.pointerEvents === 'none') continue;
        if (r.top < top) top = r.top;
      }
      var lift = top < vh ? vh - top : 0;
      // 额外 10px 让开描边/阴影；无底部栏时回落到 16px
      el.style.bottom = 'calc(' + (lift ? lift + 10 : 0) + 'px + 16px + env(safe-area-inset-bottom, 0px))';
    }

    var liftTimer = 0;
    function scheduleLift() {
      clearTimeout(liftTimer);
      liftTimer = setTimeout(liftAboveDock, 120);
    }

    liftAboveDock();
    global.addEventListener('resize', scheduleLift);
    global.addEventListener('orientationchange', scheduleLift);
    document.addEventListener('visibilitychange', scheduleLift);
    // 工具内切页（如影厅配置 → 3D 观感）会换一套底栏，点击后重新测量
    document.addEventListener('click', scheduleLift, true);
    setTimeout(liftAboveDock, 300);
    setTimeout(liftAboveDock, 1200);

    available().then(function (ok) {
      if (!ok) return;
      show();
      // 页面停留足够久才开启关闭挽留，避免一进来就被拦
      var after = opts.retentionAfter == null ? 60000 : opts.retentionAfter;
      if (after > 0) {
        retentionTimer = setTimeout(function () {
          if (document.visibilityState === 'visible') retention(true);
        }, after);
      }
    });

    mounted._open = open;
    mounted._retention = retention;
    mounted._hide = hide;
    mounted._show = show;
    return mounted;
  }

  function autoMount() {
    // 非小红书容器（抖音 / 快手 / 本地浏览器）直接不挂载
    if (!hasApi()) return;
    mount({});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  global.XhsReward = {
    MIN_CLIENT: MIN_CLIENT,
    available: available,
    open: open,
    retention: retention,
    mount: mount,
    toast: toast
  };
})(window);
/* == xhs-reward:end == */