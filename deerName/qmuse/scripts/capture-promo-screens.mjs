/**
 * 宣传截图（带演示数据）：需先 npm run dev -- --port 5174
 * node scripts/capture-promo-screens.mjs
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, '..', 'covers', 'promo-qmuse');
const BASE = 'http://127.0.0.1:5174/';

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
}

async function clickAnswer(page) {
  await page.locator('button.option').first().click();
  await page.waitForTimeout(260);
}

async function runPersonalityQuiz(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('button[data-go="zh"]').click();
  await page.locator('button.entry').filter({ hasText: '按性格取名' }).click();
  await page.waitForSelector('button.option', { timeout: 10000 });
  for (let i = 0; i < 8; i++) {
    await clickAnswer(page);
  }
  await page.waitForSelector('h1:has-text("推荐组合")', { timeout: 15000 });
}

async function pickSurname(page, sn = '李') {
  await page.locator('button.sur-picker').click();
  await page.locator(`button[data-pick-surname="${sn}"]`).click();
  await page.waitForTimeout(700);
  await page.waitForSelector('button.rec', { timeout: 12000 });
}

async function expandProfileFold(page) {
  const btn = page.locator('button[data-mine-toggle="profile"]');
  if (await btn.isVisible().catch(() => false)) {
    const act = await btn.locator('.mine-fold-act').textContent();
    if (act && act.includes('展开')) await btn.click();
    await page.waitForTimeout(400);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...devices['iPhone 14 Pro'],
  locale: 'zh-CN',
  reducedMotion: 'reduce',
});
const page = await context.newPage();
await mkdir(OUT, { recursive: true });

await runPersonalityQuiz(page);
await pickSurname(page, '李');
await expandProfileFold(page);
await page.waitForTimeout(500);
await shot(page, '01-result-profile-recs.png');

await page.locator('button.rec').first().click();
await page.waitForSelector('button.fav-heart, button[data-save]', { timeout: 10000 });
await page.waitForTimeout(600);
await shot(page, '02-name-detail.png');

const fav = page.locator('button.fav-heart, button[data-save]').first();
if (await fav.isVisible()) {
  const label = await fav.getAttribute('aria-label');
  if (label !== '已收藏') await fav.click();
  await page.waitForTimeout(300);
}

await page.locator('button[data-card]').click();
await page.waitForFunction(() => {
  const img = document.getElementById('modal-img');
  const modal = document.getElementById('modal');
  return (
    modal && !modal.classList.contains('hidden') &&
    img && img.complete && img.naturalWidth >= 400 &&
    (img.src || '').startsWith('data:image')
  );
}, { timeout: 15000 });
await page.waitForTimeout(200);
await page.locator('#modal-img').screenshot({ path: path.join(OUT, '03-share-card.png') });
await page.locator('#modal-close').click({ timeout: 3000 }).catch(() => {});

/* 再收藏一条，方便「我的」列表更丰富 */
await page.locator('button[data-open-sheet="pool"]').click();
await page.waitForSelector('button[data-pick]', { timeout: 8000 });
await page.locator('button[data-pick]').nth(2).click();
await page.waitForTimeout(500);
const fav2 = page.locator('button.fav-heart, button[data-save]').first();
if (await fav2.getAttribute('aria-label') !== '已收藏') await fav2.click();
await page.waitForTimeout(300);

await page.locator('button[data-go="home"], button.nav-item').filter({ hasText: '首页' }).first().click({ timeout: 5000 }).catch(async () => {
  await page.goto(BASE);
});
await page.getByRole('button', { name: '我的' }).click();
await page.waitForTimeout(400);
await expandProfileFold(page);
await page.waitForTimeout(500);
await shot(page, '04-mine-profile-favs.png');

await browser.close();
console.log('Saved marketing shots to', OUT);
