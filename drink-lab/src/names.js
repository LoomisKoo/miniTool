// 根据杯里的东西起名字
const FRUIT = { lemon: '柠檬', lime: '青柠', orange: '香橙', kiwi: '猕猴桃', strawSl: '草莓', berry: '草莓', mango: '芒果', melon: '西瓜', peach: '蜜桃', grape: '葡萄', blueberry: '蓝莓', passion: '百香果', lychee: '荔枝', pine: '菠萝', kumquat: '金桔' };
const TOPPING = { pearl: '珍珠', mini: '波波', crystal: '晶球', taroBall: '芋圆', yamBall: '芋圆', redBean: '红豆', nata: '椰果', grass: '仙草', popMango: '爆珠', popBerry: '爆珠', sago: '西米', pudding: '布丁' };
const SYRUP = { brown: '黑糖', caramel: '焦糖', jam: '草莓', taro: '芋泥', honey: '蜂蜜', choco: '巧克力' };
const FOAM = { cream: '奶盖', cheese: '芝芝', cocoa: '可可', matcha: '抹茶' };
const BASE_ONLY = { water: '冰水', black: '红茶', oolong: '乌龙茶', jasmine: '茉莉绿茶', matcha: '抹茶', coffee: '美式', soda: '气泡水', cola: '可乐', lemonade: '柠檬水', orange: '橙汁', watermelon: '西瓜汁', grape: '葡萄汁', coconutW: '椰子水' };
const WITH_MILK = { water: '鲜奶', black: '奶茶', oolong: '乌龙奶茶', jasmine: '奶绿', matcha: '抹茶拿铁', coffee: '拿铁', soda: '奶油苏打', cola: '奶油可乐', lemonade: '柠檬奶', orange: '香橙奶昔', watermelon: '西瓜奶昔', grape: '葡萄奶昔', coconutW: '椰椰奶' };
const MILK_ONLY = { milk: '鲜奶', thick: '厚乳', coconut: '椰奶', oat: '燕麦奶', soy: '豆奶', yogurt: '酸奶' };

// s: { tea, milk, syrup, foam, fruits[], toppings[], ice, scoop }
export function drinkName(s) {
  const { tea, milk, syrup, foam, fruits, toppings, ice, scoop } = s;
  const has = (arr, id) => arr.includes(id);
  if (!tea && !milk && !syrup && !foam) return fruits.length || toppings.length || ice || scoop ? '一杯小料' : '空杯';

  // 招牌组合
  if (has(fruits, 'mango') && milk === 'coconut' && (has(toppings, 'sago') || has(fruits, 'orange'))) return '杨枝甘露';
  if (has(fruits, 'grape') && foam === 'cheese') return '芝芝多肉葡萄';
  if (syrup === 'brown' && milk && !tea && has(toppings, 'pearl')) return (ice ? '冰·' : '') + '黑糖珍珠鲜奶';
  if (has(fruits, 'berry') && foam === 'cheese' && tea) return '芝芝莓莓';

  let core;
  if (tea && milk) {
    if (milk === 'yogurt') core = (BASE_ONLY[tea] || '') + '酸奶昔';
    else if (tea === 'coffee') core = { coconut: '生椰拿铁', oat: '燕麦拿铁', thick: '厚乳拿铁', soy: '豆乳拿铁' }[milk] || '拿铁';
    else {
      core = WITH_MILK[tea];
      if (milk === 'coconut') core = '椰香' + core;
      else if (milk === 'thick') core = '厚乳' + core;
      else if (milk === 'oat') core = '燕麦' + core;
    }
  } else if (tea) core = BASE_ONLY[tea];
  else if (milk) core = MILK_ONLY[milk];
  else if (syrup) core = SYRUP[syrup] + '糖浆';
  else core = '奶盖';

  const words = [];
  const push = (w) => { if (w && !core.includes(w) && !words.includes(w) && words.length < 2) words.push(w); };
  if (syrup && (tea || milk)) push(SYRUP[syrup]);
  if (fruits.length) push(FRUIT[fruits[0]]);
  if (toppings.length) push(TOPPING[toppings[0]]);
  const foamWord = foam && (tea || milk) ? FOAM[foam] : '';
  return (ice && !scoop ? '冰·' : '') + foamWord + words.join('') + core + (scoop ? '漂浮' : '');
}
