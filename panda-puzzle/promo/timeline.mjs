/**
 * 宣传片时间线 —— 画面、字幕标注、音效共用这一份，改节奏只改这里。
 *
 * 19s / 30fps。整片固定 90° 正俯视（和 App 生成拼图后的默认视角一致），
 * 不做任何倾斜；立体感靠拼块飞起、落位的高度差和投影，不靠斜拍。
 *
 * 节奏按「一个功能一段」排：
 * 成品 → 行列设置 → 撒开 → 旋转 → 提示 → 打散 → 揭晓 → 保存。
 * 每段 1.7–2.6s，字幕不写在全片顶部，而是贴在对应按钮旁边。
 */
export const FPS = 30;
export const DURATION = 19;

/** 所有动作的时间点。build-video 按它触发，audio 按它对音效。 */
export const CUES = {
  /** 点「选图」打开设置面板 */
  sheet: 2.5,
  /** 行列加减各两次：4×6 → 6×8 */
  steppers: [3.3, 3.55, 3.8, 4.05],
  /** 点「开始拼图」 */
  apply: 4.55,
  /** 整幅收回托盘 */
  scatter: 5.6,
  /** 选第一块 */
  select1: 7.2,
  /** 点旋转 */
  rotate: 7.8,
  /** 放到槽位（飞行 420ms） */
  place: 8.7,
  land: 9.12,
  /** 选第二块 + 开提示 */
  select2: 9.4,
  hint: 9.7,
  /** 关掉提示，避免和后面的「打散」两个橙圈同时亮 */
  hintOff: 11.55,
  /** 打散托盘里没拼的块 */
  shuffleTray: 11.9,
  /** 一键揭晓 */
  reveal: 13.4,
  /** 最后一块落位、撒花 */
  win: 14.45,
  /** 点保存 */
  save: 15.4,
  /** 成品图铺满画面 */
  poster: 16.55,
  /** 结尾一行字 */
  outro: 17.0,
};

/**
 * 标注。有 anchor 的贴在按钮旁边，用一条线连过去；没有的居中飘在画面上。
 * text 里的 \n 是换行，每行尽量 ≤6 字，整句 ≤8 字。
 */
export const BEATS = [
  { at: 0.35, end: 2.45, text: '一张照片\n切成拼图', y: 792 },
  { at: 2.95, end: 4.75, text: '几行几列\n自己定', anchor: '#colsPlus' },
  { at: 5.35, end: 7.3, text: '48 块\n全部撒开重拼', y: 726 },
  { at: 7.35, end: 8.95, text: '点一下\n转 90°', anchor: '#rotateBtn' },
  { at: 9.55, end: 11.7, text: '卡住了？\n提示它该放哪', anchor: '#hintBtn' },
  { at: 11.75, end: 13.3, text: '乱了就\n一键打散', anchor: '#scatterBtn' },
  { at: 13.4, end: 14.35, text: '不想拼？\n直接揭晓', anchor: '#solveBtn' },
  { at: 15.45, end: 16.45, text: '存成图\n直接发', anchor: '#saveBtn' },
];
