import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const jpg = path.resolve(here, '../../cinema-seat/assets/sample-screen.jpg');
const out = path.resolve(here, '../src/sampleScreenDataUrl.ts');
const b64 = fs.readFileSync(jpg).toString('base64');
fs.writeFileSync(
  out,
  '/* Generated from cinema-seat/assets/sample-screen.jpg — do not edit */\n'
    + `export const SAMPLE_SCREEN_DATA_URL = "data:image/jpeg;base64,${b64}" as const;\n`
);
