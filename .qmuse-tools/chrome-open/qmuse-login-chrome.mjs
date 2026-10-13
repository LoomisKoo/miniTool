/**
 * qmuse login：强制 Chrome 打开授权页，并在终端打印完整链接（未弹窗时可手动粘贴）。
 */
import { spawn } from 'node:child_process';
import { loadConfig } from '../node_modules/@qmuse/qmuse-cli/dist/config.js';
import { loginBrowser } from '../node_modules/@qmuse/qmuse-cli/dist/login.js';
import openInChrome from './open-chrome.mjs';

const env = process.argv.includes('--env')
  ? process.argv[process.argv.indexOf('--env') + 1] || 'prod'
  : 'prod';

const cfg = loadConfig(undefined, { environment: env });

const result = await loginBrowser(cfg, { logRequestDetails: true }, {
  open: async (url) => {
    process.stdout.write(`\n\x1b[33m授权页链接（复制到 Chrome 若未自动打开）：\x1b[0m\n${url}\n\n`);
    const ok = await openInChrome(url);
    if (!ok) {
      process.stdout.write('\x1b[31m无法用 Google Chrome 打开，请手动复制上面的链接。\x1b[0m\n');
    } else {
      const activate = spawn('osascript', [
        '-e',
        'tell application "Google Chrome" to activate',
      ], { stdio: 'ignore', detached: true });
      activate.unref();
    }
    return ok;
  },
});

if (result.success) {
  process.exit(0);
}
process.exit(1);
