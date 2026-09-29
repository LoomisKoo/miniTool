/* 姓氏的「音感气质」
 *
 * 姓不好逐个手标气质（257 个），但它的气质几乎全来自读音：
 *   「苏 / 温 / 柳」柔和，「萧 / 秦 / 裴」清冷，「岳 / 赵 / 郑」端正，「江 / 王 / 杨」开阔。
 * 所以这里按「声母类型 × 韵母口型 × 声调」自动派生气质向量，
 * 再给少数有强烈联想的姓手工覆写（苏、温、柳、萧、岳……）。
 *
 * 每组给的是「增量」，最终和字库一样落在 TR 的 [-1,1] 区间。
 */
var NM = (window.NM = window.NM || {});

/* 声母：发音部位决定听感 */
NM.INITIAL_TRAIT = {
  labial:   { tr: { warm: 0.28, sta: 0.05, out: 0.05 }, st: { sim: 0.12 } },              /* b p m f 双唇，柔 */
  apical:   { tr: { out: 0.20, warm: 0.05, sta: -0.05 }, st: { sim: 0.15 } },             /* d t n l 舌尖，利落 */
  velar:    { tr: { sta: 0.25, exp: 0, warm: 0.10, out: 0.10 }, st: { exp: 0.18 } },      /* g k h 舌根，沉稳 */
  palatal:  { tr: { warm: -0.25, rat: 0.20, out: -0.10 }, st: { cla: 0.35, sim: 0.10 } }, /* j q x 舌面，清冷文气 */
  retro:    { tr: { sta: 0.32 }, st: { cla: 0.30 } },                                     /* zh ch sh r 翘舌，端正 */
  sibilant: { tr: { out: 0.15, warm: -0.10 }, st: { sim: 0.25 } },                        /* z c s 平舌，清利 */
  zero:     { tr: { warm: 0.15, sta: 0.15, out: -0.05 }, st: { exp: -0.20 } }             /* y w / 零声母，舒展 */
};

/* 韵母口型：开口度决定开阔还是内敛 */
NM.FINAL_TRAIT = {
  open:   { tr: { out: 0.22, exp: 0, warm: 0.10 }, st: { exp: 0.25 } },   /* a o e 系，开阔直白 */
  front:  { tr: { out: -0.15 }, st: { sim: 0.25, cla: 0.15 } },          /* i 系，细致内敛 */
  round:  { tr: { warm: 0.25, sta: 0.15 }, st: { sim: 0.10 } },          /* u 系，圆润包容 */
  tucked: { tr: { warm: -0.20 }, st: { cla: 0.30, sim: 0.20 } }          /* ü 系，清冷古典 */
};

/* 声调：调型决定语气 */
NM.TONE_TRAIT = {
  1: { tr: { sta: 0.30, out: 0.05 }, st: { sim: 0.15 } },   /* 阴平，平稳舒展 */
  2: { tr: { out: 0.20, warm: 0.15 }, st: { exp: 0.10 } },  /* 阳平，上扬明朗 */
  3: { tr: { warm: 0.30, sta: -0.20 }, st: { exp: -0.15 } },/* 上声，柔转内敛 */
  4: { tr: { sta: 0.20, out: 0.10, warm: -0.15 } }          /* 去声，果断干脆 */
};

/* 手工覆写：这些姓的联想太强，纯按读音推不准。
 * 只写「要盖过自动推导」的分量，其余轴仍走自动结果。 */
NM.SURNAME_OVERRIDE = {
  /* 柔 · 水木花草一类 */
  苏: { tr: { warm: 0.55, sta: 0.25 }, st: { cla: 0.45, sim: 0.35 } },
  温: { tr: { warm: 0.75 }, st: { cla: 0.20, sim: 0.30 } },
  柳: { tr: { warm: 0.45, out: -0.25 }, st: { cla: 0.55, sim: 0.20 } },
  梅: { tr: { warm: 0.35, sta: 0.30 }, st: { cla: 0.60 } },
  兰: { tr: { warm: 0.40 }, st: { cla: 0.55, sim: 0.15 } },
  花: { tr: { warm: 0.50, out: 0.15 }, st: { cla: 0.10, exp: 0.30 } },
  叶: { tr: { warm: 0.30, sta: 0.10 }, st: { cla: 0.35 } },
  桑: { tr: { warm: 0.35, sta: 0.20 }, st: { cla: 0.40 } },
  苗: { tr: { warm: 0.35, out: 0.10 }, st: { cla: 0.25, sim: 0.20 } },
  云: { tr: { out: -0.25, sta: 0.30 }, st: { cla: 0.35, exp: -0.30 } },
  江: { tr: { out: 0.20, sta: 0.35 }, st: { exp: 0.25, cla: 0.15 } },
  湖: { tr: { sta: 0.35 }, st: { exp: 0.20 } },
  海: { tr: { out: 0.35, sta: 0.20 }, st: { exp: 0.35, sim: 0.20 } },
  水: { tr: { warm: 0.30, out: -0.10 }, st: { cla: 0.25, exp: -0.10 } },
  沐: { tr: { warm: 0.50 }, st: { cla: 0.40, sim: 0.25 } },
  林: { tr: { warm: 0.30, sta: 0.20 }, st: { cla: 0.30 } },
  竹: { tr: { out: -0.20, sta: 0.40 }, st: { cla: 0.60, sim: 0.35 } },
  松: { tr: { sta: 0.45, out: 0.10 }, st: { cla: 0.55 } },

  /* 清冷 · 疏离一类 */
  萧: { tr: { warm: -0.45, out: -0.30, sta: 0.20 }, st: { cla: 0.75, exp: -0.35 } },
  冷: { tr: { warm: -0.60, out: -0.35 }, st: { cla: 0.30, exp: -0.30 } },
  寒: { tr: { warm: -0.55, out: -0.30 }, st: { cla: 0.50, exp: -0.25 } },
  霜: { tr: { warm: -0.40, out: -0.25 }, st: { cla: 0.60, sim: 0.30 } },
  雪: { tr: { warm: -0.20, out: -0.15 }, st: { cla: 0.50, sim: 0.40 } },
  月: { tr: { out: -0.30, sta: 0.25 }, st: { cla: 0.65, exp: -0.30 } },
  秦: { tr: { sta: 0.45 }, st: { cla: 0.60 } },
  裴: { tr: { warm: -0.30 }, st: { cla: 0.65, sim: 0.25 } },
  岑: { tr: { warm: -0.20, out: -0.20 }, st: { cla: 0.55, exp: -0.20 } },
  瞿: { tr: { warm: -0.30, out: 0.10 }, st: { cla: 0.35 } },
  倪: { tr: { warm: -0.20, out: 0.15 }, st: { cla: 0.25, sim: 0.35 } },
  顾: { tr: { warm: -0.25, sta: 0.30 }, st: { cla: 0.55, exp: -0.25 } },
  沈: { tr: { out: -0.25, sta: 0.30 }, st: { cla: 0.40, exp: -0.30 } },
  谢: { tr: { out: -0.10, sta: 0.20 }, st: { cla: 0.50 } },

  /* 端正 · 厚重一类 */
  岳: { tr: { sta: 0.55, out: 0.15 }, st: { cla: 0.60, exp: 0.20 } },
  赵: { tr: { sta: 0.40 }, st: { cla: 0.50 } },
  郑: { tr: { sta: 0.45 }, st: { cla: 0.55, sim: 0.20 } },
  韩: { tr: { sta: 0.30, out: 0.15 }, st: { cla: 0.45 } },
  唐: { tr: { out: 0.25, warm: 0.20 }, st: { cla: 0.55, exp: 0.20 } },
  魏: { tr: { sta: 0.40 }, st: { cla: 0.50 } },
  齐: { tr: { sta: 0.35 }, st: { cla: 0.45, sim: 0.30 } },
  鲁: { tr: { sta: 0.45, warm: 0.20 }, st: { cla: 0.55 } },
  石: { tr: { sta: 0.50 }, st: { cla: 0.35, sim: 0.45 } },
  铁: { tr: { sta: 0.55, warm: -0.30 }, st: { exp: 0.35, sim: 0.40 } },
  武: { tr: { out: 0.30, sta: 0.35 }, st: { exp: 0.25, cla: 0.35 } },
  霍: { tr: { out: 0.25, sta: 0.20 }, st: { exp: 0.30 } },
  靖: { tr: { sta: 0.40 }, st: { cla: 0.55 } },

  /* 书卷 · 文气一类 */
  文: { tr: { out: -0.25, sta: 0.25 }, st: { cla: 0.70, sim: 0.25 } },
  书: { tr: { out: -0.30 }, st: { cla: 0.65, sim: 0.35 } },
  墨: { tr: { out: -0.35, warm: -0.15 }, st: { cla: 0.80, sim: 0.30 } },
  砚: { tr: { out: -0.30 }, st: { cla: 0.75 } },
  简: { tr: { out: -0.20 }, st: { cla: 0.35, sim: 0.60 } },
  章: { tr: { sta: 0.25 }, st: { cla: 0.50 } },
  晏: { tr: { warm: 0.30, sta: 0.30 }, st: { cla: 0.50 } },
  钟: { tr: { sta: 0.35 }, st: { cla: 0.55 } },
  崔: { tr: { sta: 0.20 }, st: { cla: 0.55 } },

  /* 明快 · 开阔一类 */
  高: { tr: { out: 0.30, sta: 0.25 }, st: { exp: 0.40 } },
  马: { tr: { out: 0.40, sta: 0.10 }, st: { exp: 0.45, sim: 0.30 } },
  方: { tr: { sta: 0.35 }, st: { sim: 0.45, exp: 0.25 } },
  白: { tr: { warm: 0.20 }, st: { sim: 0.50, exp: 0.20 } },
  周: { tr: { sta: 0.30, warm: 0.15 }, st: { sim: 0.30 } },
  何: { tr: { warm: 0.25, out: 0.20 }, st: { sim: 0.35 } },
  吴: { tr: { warm: 0.20, out: 0.10 }, st: { sim: 0.30 } },
  余: { tr: { out: -0.10 }, st: { cla: 0.35 } },
  新: { tr: { out: 0.25 }, st: { exp: 0.30, sim: 0.30 } },
  旭: { tr: { out: 0.30, warm: 0.25 }, st: { exp: 0.35 } }
};
