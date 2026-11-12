// 液体与杯型数据。A 吸收 / S 散射（每单位长度，1 单位 ≈ 4.5cm），
// rho 密度 g/cm³，visc 相对水的粘稠度，fizz 含气量。

export const BASES = {
  water:     { name: '纯净水', dot: '#e8f4fb', A: [0.004, 0.003, 0.002], S: [0, 0, 0], rho: 1.0, visc: 1 },
  black:     { name: '红茶',   dot: '#9a4a1c', A: [0.3, 1.8, 5.5],    S: [0, 0, 0],          rho: 1.0, visc: 1 },
  oolong:    { name: '乌龙',   dot: '#c0802c', A: [0.18, 0.8, 2.6],   S: [0, 0, 0],          rho: 1.0, visc: 1 },
  jasmine:   { name: '茉莉绿', dot: '#d9c46a', A: [0.2, 0.1, 0.75],   S: [0.03, 0.03, 0.03], rho: 1.0, visc: 1 },
  matcha:    { name: '抹茶',   dot: '#7aa445', A: [1.5, 0.3, 1.3],    S: [1.1, 1.2, 0.9],    rho: 1.01, visc: 1.2 },
  coffee:    { name: '咖啡',   dot: '#3b2216', A: [2.2, 3.1, 4.3],    S: [0.12, 0.12, 0.12], rho: 1.0, visc: 1 },
  soda:      { name: '气泡水', dot: '#dff3ff', A: [0.004, 0.002, 0.002], S: [0, 0, 0], rho: 1.0, visc: 1, fizz: 1 },
  cola:      { name: '可乐',   dot: '#3a1c10', A: [1.2, 2.4, 4.0],    S: [0, 0, 0],          rho: 1.04, visc: 1, fizz: 1 },
  lemonade:  { name: '柠檬水', dot: '#f3ea9c', A: [0.05, 0.05, 0.6],  S: [0.25, 0.25, 0.22], rho: 1.02, visc: 1 },
  orange:    { name: '橙汁',   dot: '#f39a26', A: [0.08, 0.55, 3.2],  S: [3.2, 3.0, 2.6],    rho: 1.04, visc: 1.8 },
  watermelon:{ name: '西瓜汁', dot: '#f05a62', A: [0.12, 2.2, 1.5],   S: [1.4, 1.2, 1.2],    rho: 1.03, visc: 1.3 },
  grape:     { name: '葡萄汁', dot: '#6b2a5a', A: [1.4, 3.5, 1.5],    S: [0.15, 0.15, 0.15], rho: 1.05, visc: 1.2 },
  coconutW:  { name: '椰子水', dot: '#f4f1e4', A: [0.02, 0.02, 0.05], S: [0.25, 0.25, 0.24], rho: 1.02, visc: 1 },
};

export const MILKS = {
  milk:    { name: '牛奶',   dot: '#fbf6ec', A: [0.08, 0.22, 0.62],  S: [5.0, 4.9, 4.7], rho: 1.03, visc: 1.3 },
  thick:   { name: '厚乳',   dot: '#f6ead2', A: [0.09, 0.26, 0.75],  S: [6.4, 6.2, 5.9], rho: 1.04, visc: 2.5 },
  coconut: { name: '椰奶',   dot: '#ffffff', A: [0.02, 0.05, 0.14],  S: [6, 5.9, 5.8],  rho: 1.0,  visc: 1.6 },
  oat:     { name: '燕麦奶', dot: '#efe1c4', A: [0.07, 0.19, 0.55],  S: [4.6, 4.5, 4.2], rho: 1.03, visc: 1.8 },
  soy:     { name: '豆奶',   dot: '#f3e6c6', A: [0.08, 0.21, 0.6],   S: [4.9, 4.8, 4.5], rho: 1.03, visc: 1.4 },
  yogurt:  { name: '酸奶',   dot: '#fdfbf6', A: [0.07, 0.2, 0.58],   S: [7, 6.9, 6.6],  rho: 1.06, visc: 9 },
};

// 酱料：比底饮重得多，倒进去先沉底、沿杯壁挂出纹路，摇匀才会化开
export const SYRUPS = {
  brown:    { name: '黑糖',   dot: '#4a2410', A: [2.0, 4.0, 7.0], S: [0.4, 0.3, 0.2], rho: 1.33, visc: 30 },
  caramel:  { name: '焦糖',   dot: '#b8651e', A: [0.5, 1.8, 4.6], S: [0.5, 0.4, 0.3], rho: 1.3,  visc: 25 },
  jam:      { name: '草莓酱', dot: '#d8284a', A: [0.25, 4.0, 2.8], S: [2.2, 1.0, 1.1], rho: 1.3, visc: 35 },
  taro:     { name: '芋泥',   dot: '#a98bc9', A: [0.5, 0.9, 0.35], S: [9, 8, 9.5],    rho: 1.2,  visc: 45 },
  honey:    { name: '蜂蜜',   dot: '#e9a92c', A: [0.12, 0.55, 2.6], S: [0.1, 0.1, 0.1], rho: 1.42, visc: 60 },
  choco:    { name: '巧克力', dot: '#3d1f12', A: [2.4, 3.4, 4.4], S: [1.6, 1.2, 1.0], rho: 1.3,  visc: 40 },
};

// 奶盖：浮在最上面的绵密一层，dust 是表面撒的粉
export const FOAMS = {
  cream:  { name: '奶盖',     dot: '#fffaf0', col: [0.97, 0.95, 0.9],  rho: 0.45, visc: 6 },
  cheese: { name: '芝士奶盖', dot: '#fbeec2', col: [0.98, 0.92, 0.74], rho: 0.45, visc: 6 },
  cocoa:  { name: '可可奶盖', dot: '#7a4a32', col: [0.97, 0.94, 0.88], dust: [0.32, 0.18, 0.1], rho: 0.45, visc: 6 },
  matcha: { name: '抹茶奶盖', dot: '#9cbf5a', col: [0.97, 0.95, 0.88], dust: [0.36, 0.55, 0.16], rho: 0.45, visc: 6 },
};

// 每点一次倒入的量（占杯容量）
export const POUR = { tea: 0.16, milk: 0.1, syrup: 0.035, foam: 0.09 };
// 奶盖最多堆到杯容量的这个比例（会高出杯口）
export const FOAM_MAX = 0.2;

export const CUP_SHAPES = [
  { id: 'straight', name: '直筒杯', rb: 1.0, rt: 1.0, h: 3.6, base: 0.14 },
  { id: 'boba', name: '奶茶杯', rb: 0.8, rt: 1.1, h: 3.9, base: 0.1, plastic: true },
  { id: 'highball', name: '高球杯', rb: 0.78, rt: 0.8, h: 4.3, base: 0.24 },
  { id: 'rocks', name: '古典杯', rb: 1.18, rt: 1.24, h: 2.3, base: 0.32 },
  { id: 'bubble', name: '圆肚杯', sphere: 1.45, base: 0.14 },
  { id: 'mason', name: '梅森杯', rb: 1.05, rt: 1.02, h: 3.5, base: 0.18, mason: true },
];

export const CUP_SIZES = [
  { id: 's', name: '小杯', k: 0.82 },
  { id: 'm', name: '中杯', k: 1 },
  { id: 'l', name: '大杯', k: 1.15 },
];
