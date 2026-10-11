import { pathToFileURL } from 'node:url';
import path from 'node:path';

const CHROME_OPEN = pathToFileURL(
  path.join(import.meta.dirname, 'open-chrome.mjs'),
).href;

// 把 CLI 依赖的 `open` 包替换为 Chrome 实现
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'open') {
    return { url: CHROME_OPEN, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
