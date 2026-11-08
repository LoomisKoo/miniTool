/* 本草 — 十一大区（道地产区）
   hours: 派脚夫往返耗时  unlockRep: 解锁所需声望 */
const REGIONS = [
  { id: 'guanDong', name: '关东', climate: '寒冷湿润', desc: '长白山深处，林密雪厚，出参茸细辛。', hours: 12, unlockRep: 0,
    specialty: ['人参', '鹿茸', '五味子', '细辛'] },
  { id: 'huaBei', name: '华北', climate: '温带干燥', desc: '黄土高原与燕赵之地，根茎类药材最盛。', hours: 6, unlockRep: 0,
    specialty: ['黄芪', '黄芩', '柴胡', '知母'] },
  { id: 'huaiQing', name: '怀庆', climate: '四季分明', desc: '太行南麓，四大怀药之名传千年。', hours: 8, unlockRep: 0,
    specialty: ['生地黄', '山药', '牛膝', '菊花'] },
  { id: 'shanDong', name: '山东', climate: '温带海洋', desc: '东阿之水熬胶最良，泰山石下生银花。', hours: 8, unlockRep: 1,
    specialty: ['阿胶', '金银花', '山楂', '全蝎'] },
  { id: 'jiangZhe', name: '江浙', climate: '温润多雨', desc: '水乡泽国，浙八味皆出于此。', hours: 10, unlockRep: 0,
    specialty: ['白术', '白芍', '浙贝母', '菊花'] },
  { id: 'wanNan', name: '安徽', climate: '南北过渡', desc: '亳州药市甲天下，霍山石斛生于崖。', hours: 10, unlockRep: 1,
    specialty: ['白芍', '石斛', '前胡', '牡丹皮'] },
  { id: 'liangHu', name: '两湖', climate: '湿热多雨', desc: '武陵山区，茯苓厚朴生于松林。', hours: 12, unlockRep: 1,
    specialty: ['茯苓', '黄连', '厚朴', '杜仲'] },
  { id: 'chuanYu', name: '川渝', climate: '盆地湿热', desc: '巴山蜀水，川产药材数以千计。', hours: 16, unlockRep: 2,
    specialty: ['川贝母', '川芎', '附子', '麦冬'] },
  { id: 'yunGui', name: '云贵', climate: '高原立体', desc: '云岭之上，一山有四季，十里不同药。', hours: 20, unlockRep: 2,
    specialty: ['三七', '天麻', '木香', '前胡'] },
  { id: 'lingNan', name: '岭南', climate: '湿热', desc: '南国湿热，新会陈皮愈陈愈香。', hours: 16, unlockRep: 2,
    specialty: ['陈皮', '砂仁', '藿香', '巴戟天'] },
  { id: 'xiBei', name: '西北', climate: '高寒干燥', desc: '岷山脚下，当归黄芪皆称道地。', hours: 16, unlockRep: 1,
    specialty: ['当归', '黄芪', '党参', '枸杞子'] }
];
