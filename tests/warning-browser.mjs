import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir('artifacts/energy', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(`${process.cwd()}/index.html`).href);
  assert.equal(await page.locator('#power-status').isVisible(), false);
  assert.ok(!(await page.locator('body').innerText()).includes('每次魔法消耗一格'));
  assert.equal(await page.locator('#machine .power-cell svg').count(), 10);
  assert.ok(await page.locator('.power-panel').evaluate(el => el.getBoundingClientRect().top > document.querySelector('#draw').getBoundingClientRect().bottom));
  await page.evaluate(() => localStorage.setItem('75-magic-machine:v1', JSON.stringify({ version: 1, energy: { balance: 2, difficulty: 'easy' } })));
  await page.reload();
  await page.evaluate(() => {
    window.warningCount = 0; window.warningAudio = null;
    const original = MagicAudio.prototype.warning;
    MagicAudio.prototype.warning = function(balance) { const result = original.call(this, balance); if (result) { window.warningCount++; window.warningAudio = this; } return result; };
  });
  await page.locator('.wordmark').click();
  await page.waitForFunction(() => window.warningCount > 0);
  const first = await page.locator('.danger-vignette').evaluate(el => getComputedStyle(el).opacity);
  await page.waitForTimeout(400);
  const second = await page.locator('.danger-vignette').evaluate(el => getComputedStyle(el).opacity);
  assert.notEqual(first, second);
  assert.equal(await page.locator('.power-cell.filled').count(), 2);
  assert.ok(await page.locator('#collection').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), '720p低能量状态应完整显示底部入口');
  await page.screenshot({ path: 'artifacts/energy/heart-warning-720.png' });
  await page.waitForFunction(() => warningCount >= 2);
  await page.locator('#recharge').click();
  await page.waitForTimeout(650);
  const count = await page.evaluate(() => warningCount);
  assert.equal(await page.evaluate(() => warningAudio.warningVoices.size), 0);
  assert.equal(await page.locator('.danger-vignette').evaluate(el => getComputedStyle(el).opacity), '0');
  await page.waitForTimeout(2600);
  assert.equal(await page.evaluate(() => warningCount), count);
  await page.locator('#close-recharge').click();
  await page.waitForFunction(previous => warningCount > previous, count);
  await page.locator('#sound').click();
  const mutedCount = await page.evaluate(() => warningCount);
  await page.waitForTimeout(3500);
  assert.equal(await page.evaluate(() => warningCount), mutedCount);
  await page.locator('#sound').click();
  await page.waitForFunction(previous => warningCount > previous, mutedCount);
  await page.locator('#motion').click();
  assert.equal(await page.locator('.danger-vignette').evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.locator('#recharge').click();
  for (let i = 0; i < 2; i++) {
    const text = await page.locator('#math-question').textContent();
    const [, left, operator, right] = text.match(/(\d+) ([+−]) (\d+)/);
    await page.locator('#math-answer').fill(String(operator === '+' ? Number(left) + Number(right) : Number(left) - Number(right)));
    if (i === 0) await page.locator('#answer-submit').click();
  }
  await page.locator('#return-to-machine').click();
  assert.equal(await page.locator('#power-count').textContent(), '4 / 10');
  const restoredCount = await page.evaluate(() => warningCount);
  await page.waitForTimeout(3500);
  assert.equal(await page.evaluate(() => warningCount), restoredCount);
  assert.equal(await page.locator('#power-status').isVisible(), false);
  // 离线渲染专属预警声，验证非静音、无削波且节点能回收。
  const audio = await page.evaluate(async () => {
    const context = new OfflineAudioContext(1, 44100, 44100);
    const sound = new MagicAudio(() => false); sound.setup(context); sound.ready = () => true; sound.warning(1);
    const buffer = await context.startRendering();
    let peak = 0; for (const sample of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(sample));
    return { peak, voices: sound.voices.size, warningVoices: sound.warningVoices.size };
  });
  assert.ok(audio.peak > .01 && audio.peak < .98); assert.equal(audio.voices, 0); assert.equal(audio.warningVoices, 0);
  assert.deepEqual(errors, []);
  console.log('通过：机器底部10颗爱心、删除说明、720p布局、红色动态闪烁、周期预警音、答题暂停、静音/恢复、柔和动画、4格解除、音频渲染与节点回收');
} finally { await browser.close(); }
