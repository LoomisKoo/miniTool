import { spawn } from 'node:child_process';

/**
 * 覆盖 CLI 内部对 `open` 的默认调用，固定使用 Google Chrome 打开授权页。
 * 原因：qmuse login 会打开 https://qmuse.cn/cli-auth，并沿用浏览器里
 * qmuse.cn 已登录的会话；系统默认浏览器不是 Chrome 时容易绑定到错误账号。
 */
export default async function openInChrome(url) {
  return await new Promise((resolve) => {
    const child = spawn('open', ['-a', 'Google Chrome', url], {
      stdio: 'ignore',
      detached: true,
    });
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}
