import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const config = JSON.parse(await readFile('treasures.json', 'utf8'));
const total = config.treasures.reduce((sum, t) => sum + t.weight, 0);
const newcomers = config.treasures.filter(t => t.effects.interaction);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], url = pathToFileURL(`${process.cwd()}/index.html`).href;
await mkdir('artifacts/treasure-play', { recursive: true });
async function check(treasure, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, reducedMotion: mobile ? 'reduce' : 'no-preference' });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  const index = config.treasures.findIndex(t => t.id === treasure.id);
  const random = (config.treasures.slice(0, index).reduce((sum, t) => sum + t.weight, 0) + treasure.weight / 2) / total;
  await page.addInitScript(random => { Math.random = () => random; }, random);
  try {
    await page.goto(url); await page.locator('#sound').click();
    await page.keyboard.press('Space');
    await page.waitForSelector('#machine[data-state="celebrating"]');
    assert.equal(await page.locator('#prize-name').textContent(), treasure.name);
    assert.equal(await page.locator('#machine').getAttribute('data-reveal'), treasure.effects.reveal);
    const art = page.locator('#treasure-art');
    await art.click({ force: true }); // 演出时点击不启动互动。
    assert.equal(await art.getAttribute('data-play'), null);
    await page.waitForSelector('#machine[data-state="result"]');
    assert.equal(await art.getAttribute('role'), 'button');
    assert.equal(await art.locator('img').evaluate(img => img.complete && img.naturalWidth > 0), true);
    const original = await art.locator('img').getAttribute('src');
    await art.click();
    assert.equal(await art.getAttribute('data-play'), treasure.effects.interaction);
    if (treasure.id === 'star-seed') assert.notEqual(await art.locator('img').getAttribute('src'), original);
    if (mobile) assert.equal(await art.locator('img').evaluate(img => getComputedStyle(img).animationName), 'none');
    await page.waitForTimeout(250);
    await page.screenshot({ path: `artifacts/treasure-play/${mobile ? 'mobile-' : ''}${treasure.id}.png` });
    await art.click({ force: true }); assert.equal(await art.locator('.play-bits').count(), 1);
    assert.equal(await page.locator('#power-count').textContent(), '9 / 10');
    assert.equal(await page.locator('#collection-count').textContent(), '1');
    await page.waitForFunction(() => !document.querySelector('#treasure-art').dataset.play);
    await art.focus(); await page.keyboard.press('Enter');
    assert.equal(await art.getAttribute('data-play'), treasure.effects.interaction);
    assert.equal(await page.locator('#collection-count').textContent(), '1');
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#draw').isDisabled(), true);
    assert.equal(await art.getAttribute('data-play'), null);
    assert.equal(await art.getAttribute('role'), null);
    assert.equal(await page.locator('#power-count').textContent(), '8 / 10');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(`通过：${treasure.name}${mobile ? ' 手机柔和模式' : ''}，真实开奖、互动、输入锁定、不重复发奖、空格启动与清理`);
  } finally { await context.close(); }
}
try {
  for (let i = 0; i < newcomers.length; i += 4) await Promise.all(newcomers.slice(i, i + 4).map(t => check(t)));
  await check(newcomers.find(t => t.id === 'star-seed'), true);
  const page = await browser.newPage(); await page.goto(url);
  for (const treasure of newcomers) {
    const rendered = await page.evaluate(async kind => {
      const ctx = new OfflineAudioContext(1, 44100 * 3, 44100);
      const sound = new MagicAudio(() => false); sound.setup(ctx); sound.ready = () => true; sound.celebrate(kind);
      const buffer = await ctx.startRendering(); let peak = 0; for (const sample of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(sample));
      return { peak, voices: sound.voices.size };
    }, treasure.effects.sound);
    assert.ok(rendered.peak > .01 && rendered.peak < .98); assert.equal(rendered.voices, 0);
  }
  assert.deepEqual(errors, []); console.log('通过：8种专属音效实际渲染、无削波、音频节点回收，无浏览器脚本错误');
} finally { await browser.close(); }
