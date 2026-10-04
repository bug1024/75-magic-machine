import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const url = pathToFileURL(`${process.cwd()}/index.html`).href;
const errors = [];
await mkdir('artifacts/garden', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  const id = await page.locator('#treasure-config').evaluate(el => JSON.parse(el.textContent).treasures[0].id);
  await page.evaluate(id => localStorage.setItem('75-magic-machine:v1', JSON.stringify({ version: 1, muted: true, history: [{ prizeId: id, name: '测试宝物', rarity: 'common', timestamp: Date.now(), drawId: 'garden' }] })), id);
  await page.reload();
  assert.equal(await page.locator('.garden-slot').count(), 6);
  await page.locator('#collection').click(); await page.locator('.place-treasure').click();
  assert.equal(await page.locator('#collection-dialog').evaluate(el => el.open), false);
  await page.locator('.garden-slot').nth(2).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('75-magic-machine:v1')).garden.slots[2]), id);
  await page.reload(); assert.equal(await page.locator('.garden-slot').nth(2).locator('img').count(), 1);
  await page.locator('.garden-slot').nth(2).click(); assert.equal(await page.locator('.garden-slot').nth(2).getAttribute('data-play'), 'dress-twirl');
  const kinds = new Set();
  // 控制随机数以确定遍历全部天气，不依赖概率或长时间等待。
  await page.evaluate(() => { Math.random = () => 0; });
  for (const desired of ['rain', 'snow', 'wind', 'meteors']) {
    const previous = await page.locator('body').getAttribute('data-weather');
    const choices = ['rain', 'snow', 'wind', 'meteors'].filter(kind => kind !== previous);
    const value = (choices.indexOf(desired) + .1) / choices.length;
    await page.evaluate(value => { Math.random = () => value; }, value);
    await page.locator('#weather').click();
    const kind = await page.locator('body').getAttribute('data-weather'); kinds.add(kind);
    assert.ok(await page.locator('#weather-layer i').count());
    await page.screenshot({ path: `artifacts/garden/${kind}.png` });
  }
  assert.equal(kinds.size, 4);
  await page.locator('#collection').click(); await page.waitForTimeout(100);
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('weather-paused')), true);
  await page.locator('#close-collection').click();
  await page.locator('.garden-remove').click(); await page.reload();
  assert.equal(await page.locator('.garden-slot img').count(), 0);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 720 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `artifacts/garden/layout-${width}.png`, fullPage: true });
  }
  // 全流程音效确实随等级变化，所有声源正常结束。
  const profiles = await page.evaluate(async () => {
    const outputs = [];
    for (const level of ['starlight', 'rainbow', 'winged', 'castle']) {
      const ctx = new OfflineAudioContext(1, 44100 * 4, 44100), audio = new MagicAudio(() => false); audio.setup(ctx); audio.ready = () => true; audio.level = level;
      audio.mixing(1); audio.land(); audio.knock(2); audio.charge(); audio.celebrate('magic-chime', true);
      const buffer = await ctx.startRendering(), data = buffer.getChannelData(0); let peak = 0, sum = 0;
      for (const sample of data) { peak = Math.max(peak, Math.abs(sample)); sum += sample * sample; }
      outputs.push({ level, peak, rms: Math.sqrt(sum / data.length), voices: audio.voices.size });
    } return outputs;
  });
  assert.equal(new Set(profiles.map(profile => profile.rms.toFixed(5))).size, 4);
  for (const profile of profiles) { assert.ok(profile.peak < .98); assert.ok(profile.rms > .01); assert.equal(profile.voices, 0); }
  assert.deepEqual(errors, []); console.log('Garden/weather/storage/mobile/audio passed', profiles);
} finally { await browser.close(); }
