#!/usr/bin/env node
/**
 * 预处理：把 OFL 字体的字形轮廓抽成 SVG path，供前端直接绘制。
 * 运行: node tools/extract-glyphs.mjs
 * 产出: src/glyphs.js  （window.GLYPHS = {...}）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import opentype from 'opentype.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dirname, 'fonts');
const OUT = path.join(__dirname, '..', 'src', 'glyphs.js');

const CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + 'abcdefghijklmnopqrstuvwxyz' + '0123456789' + "'-&.·";

// id -> 字体文件 / 元信息
const FONTS = [
  { id: 'cinzel', file: 'cinzel.ttf', label: 'Cinzel' },
  { id: 'playfair', file: 'playfair.ttf', label: 'Playfair' },
  { id: 'garamond', file: 'ebgaramond.ttf', label: 'EB Garamond' },
  { id: 'cormorant', file: 'cormorant.ttf', label: 'Cormorant' },
  { id: 'abril', file: 'abrilfatface.ttf', label: 'Abril Fatface' },
  { id: 'fraktur', file: 'unifraktur.ttf', label: 'Unifraktur' },
];

const round = (n) => Math.round(n * 100) / 100;

const out = {};
let total = 0;

for (const f of FONTS) {
  const buf = fs.readFileSync(path.join(FONT_DIR, f.file));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const glyphs = {};

  for (const ch of CHARS) {
    const glyph = font.charToGlyph(ch);
    if (!glyph || !glyph.path || glyph.index === 0) continue;
    const raw = glyph.getBoundingBox();
    // opentype v1 用 x0/y0/x1/y1，v2 用 x1/y1/x2/y2（都是 x-y 轴、y 向上）
    const bb =
      raw.x0 !== undefined
        ? { x0: raw.x0, y0: raw.y0, x1: raw.x1, y1: raw.y1 }
        : { x0: raw.x1, y0: raw.y1, x1: raw.x2, y1: raw.y2 };
    if (!isFinite(bb.x0) || !(bb.x1 - bb.x0 > 0) || !(bb.y1 - bb.y0 > 0)) continue;

    // 自己拼 path 字符串：opentype v2 的 toPathData() 会围绕包围盒再做一次反射，
    // 叠在一起会把字母弄反，这里直接算最终坐标，避免任何隐式变换。
    const fx = (v) => Math.round((v - bb.x0) * 100) / 100;
    const fy = (v) => Math.round((bb.y1 - v) * 100) / 100; // 字体 y 向上 → SVG y 向下
    let d = '';
    for (const cmd of glyph.path.commands) {
      if (cmd.type === 'M') d += `M${fx(cmd.x)} ${fy(cmd.y)}`;
      else if (cmd.type === 'L') d += `L${fx(cmd.x)} ${fy(cmd.y)}`;
      else if (cmd.type === 'C')
        d += `C${fx(cmd.x1)} ${fy(cmd.y1)} ${fx(cmd.x2)} ${fy(cmd.y2)} ${fx(cmd.x)} ${fy(cmd.y)}`;
      else if (cmd.type === 'Q')
        d += `Q${fx(cmd.x1)} ${fy(cmd.y1)} ${fx(cmd.x)} ${fy(cmd.y)}`;
      else if (cmd.type === 'Z') d += 'Z';
    }
    if (!d) continue;

    glyphs[ch] = {
      d,
      w: round(bb.x1 - bb.x0),
      h: round(bb.y1 - bb.y0),
      b: round(bb.y1),                       // 基线到包围盒顶的距离（翻面后坐标系）
      a: round(glyph.advanceWidth || bb.x1 - bb.x0), // 字宽（含左右边距）
      l: round(bb.x0),                       // 左侧边距
      up: /[A-Z0-9]/.test(ch) ? 1 : 0,
    };
    total += d.length;
  }

  out[f.id] = { label: f.label, upm: font.unitsPerEm, glyphs };
  const bytes = JSON.stringify(out[f.id]).length;
  console.log(`${f.id.padEnd(10)} ${Object.keys(glyphs).length} 字形  ${(bytes / 1024).toFixed(1)} KB`);
}

const js =
  '/* 自动生成，勿手改。源: tools/extract-glyphs.mjs —— 字体为 SIL Open Font License 1.1 */\n' +
  'window.GLYPHS=' +
  JSON.stringify(out) +
  ';\n';

fs.writeFileSync(OUT, js);
console.log(`\n合计 ${(js.length / 1024).toFixed(1)} KB → ${path.relative(process.cwd(), OUT)}`);
