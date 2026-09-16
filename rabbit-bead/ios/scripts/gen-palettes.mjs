// 从 H5 端 palettes.js 生成 iOS 用的 Palettes.json。
// 色卡数据源：HansBug/pindou-color-data (MIT License, Copyright (c) 2026 HansBug)。
// 许可全文在 palettes.js 头部，随 H5 产物一起分发；iOS 端见「关于」页的「许可全文」。
//
//   node ios/scripts/gen-palettes.mjs
//
// 产物：ios/RabbitBead/RabbitBead/Resources/Palettes.json

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../palettes.js');
const out = resolve(here, '../RabbitBead/RabbitBead/Resources/Palettes.json');

// palettes.js 末尾是 `})(typeof window !== "undefined" ? window : this)`，
// 所以先补一个 window，再执行，让它把数据挂到 window.BEAD_PALETTES。
const sandbox = {};
new Function('window', readFileSync(src, 'utf8'))(sandbox);

const palettes = sandbox.BEAD_PALETTES;
if (!palettes) throw new Error('palettes.js 未导出 BEAD_PALETTES');

const ordered = Object.keys(palettes).map((key) => {
  const p = palettes[key];
  return {
    id: key,
    name: p.name || p.id,
    colors: p.colors.map(([code, r, g, b]) => ({ code, r, g, b })),
  };
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(ordered, null, 2) + '\n');

for (const p of ordered) {
  console.log(`${p.id}: ${p.name} ${p.colors.length} 色`);
}
console.log(`→ ${out}`);
