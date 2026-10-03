import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const url = pathToFileURL(`${process.cwd()}/index.html`).href;
  for (const selector of ['#sound', '#motion', '#fullscreen', '#collection', '.wordmark', '#draw']) {
    await page.goto(url);
    await page.evaluate(() => {
      localStorage.removeItem('75-magic-machine:v1');
      window.otherClicks = 0;
      document.querySelectorAll('#sound,#motion,#fullscreen,#collection,.wordmark').forEach(button => button.addEventListener('click', () => window.otherClicks++));
    });
    const soundBefore = await page.locator('#sound').getAttribute('aria-pressed');
    const motionBefore = await page.locator('#motion').getAttribute('aria-pressed');
    await page.locator(selector).focus();
    await page.keyboard.down('Space');
    await page.keyboard.down('Space');
    assert.equal(await page.locator('#machine').getAttribute('data-state'), 'charging');
    if (selector === '#sound') {
      await page.waitForSelector('#machine[data-state="result"]');
      await page.keyboard.down('Space');
      assert.equal(await page.locator('#collection-count').textContent(), '1');
      assert.equal(await page.locator('#machine').getAttribute('data-state'), 'result');
    }
    await page.keyboard.up('Space');
    assert.equal(await page.evaluate(() => otherClicks), 0);
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), soundBefore);
    assert.equal(await page.locator('#motion').getAttribute('aria-pressed'), motionBefore);
    assert.equal(await page.locator('#collection-dialog').evaluate(el => el.open), false);
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
    console.log(`通过：焦点 ${selector}，空格仅启动抽奖，未触发其他功能`);
  }
  await page.goto(url);
  await page.locator('#collection').click();
  await page.locator('#close-collection').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#collection-dialog').evaluate(el => el.open), true);
  assert.equal(await page.locator('#machine').getAttribute('data-state'), 'idle');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#collection-dialog').evaluate(el => el.open), false);
  await page.locator('#sound').focus();
  const before = await page.locator('#sound').getAttribute('aria-pressed');
  await page.keyboard.press('Enter');
  assert.notEqual(await page.locator('#sound').getAttribute('aria-pressed'), before);
  assert.deepEqual(errors, []);
  console.log('通过：弹窗内空格无副作用；Enter 仍可正常操作其他按钮');
} finally { await browser.close(); }
