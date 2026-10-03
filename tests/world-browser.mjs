import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const url = pathToFileURL(`${process.cwd()}/index.html`).href;
await mkdir('artifacts/world', { recursive: true });
const errors = [];
const record = i => ({ prizeId: 'starlight-dress', name: '星光公主裙', rarity: 'common', timestamp: Date.now(), drawId: `old-${i}`, source: 'draw' });
async function seed(page, balance, world, count = 0) {
  await page.goto(url);
  await page.evaluate(saved => localStorage.setItem('75-magic-machine:v1', JSON.stringify(saved)), { version: 1, muted: true, history: Array.from({ length: count }, (_, i) => record(i)), energy: { balance, difficulty: 'easy' }, world });
  await page.reload();
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.on('pageerror', e => errors.push(e.message));
  // 保底事件在真实开奖后出现，赠品写入收藏但不会增长升级次数。
  await page.addInitScript(() => { Math.random = () => .9; });
  await seed(page, 8, { completedDraws: 3, sinceEvent: 7, pending: [] }, 3);
  await page.keyboard.press('Space');
  await page.waitForSelector('#world-dialog[open][data-scene="courier"]');
  assert.equal(await page.locator('#draw').isDisabled(), true);
  const before = await page.locator('#power-count').textContent();
  await page.keyboard.press('Space'); await page.keyboard.press('Escape');
  assert.equal(await page.locator('#world-dialog').evaluate(el => el.open), true);
  assert.equal(await page.locator('#power-count').textContent(), before);
  await page.waitForSelector('#world-dialog.acted');
  assert.equal(await page.locator('#collection-count').textContent(), '5');
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('75-magic-machine:v1')));
  assert.equal(snapshot.world.completedDraws, 4); assert.equal(snapshot.world.pending.length, 0); assert.equal(snapshot.history.at(-1).source, 'event');
  await page.screenshot({ path: 'artifacts/world/courier.png' });
  await page.reload();
  assert.equal(await page.locator('#collection-count').textContent(), '5');
  assert.equal(await page.locator('#world-dialog').evaluate(el => el.open), false);
  // 未结算仙子事件恢复后补能量，只到上限；结算后刷新不重复。
  await seed(page, 9, { completedDraws: 4, sinceEvent: 0, pending: [{ kind: 'event', id: 'fairy', giftId: 'cloud-dolphin' }] }, 4);
  await page.waitForSelector('#world-dialog.acted');
  assert.equal(await page.locator('#power-count').textContent(), '10 / 10');
  assert.equal(await page.locator('#collection-count').textContent(), '4');
  await page.screenshot({ path: 'artifacts/world/fairy.png' });
  await page.reload(); assert.equal(await page.locator('#power-count').textContent(), '10 / 10');
  // 满格仙子改送宝物。
  await seed(page, 10, { completedDraws: 4, sinceEvent: 0, pending: [{ kind: 'event', id: 'fairy', giftId: 'cloud-dolphin' }] }, 4);
  await page.waitForSelector('#world-dialog.acted');
  assert.equal(await page.locator('#collection-count').textContent(), '5');
  assert.match(await page.locator('#scene-title').textContent(), /云朵小海豚/);
  await page.locator('#continue-world').click();
  // 幽灵吸能量；不会偷走收藏，3格及以下不吸能量。
  await seed(page, 5, { completedDraws: 4, sinceEvent: 0, pending: [{ kind: 'event', id: 'ghost' }] }, 4);
  await page.waitForSelector('#world-dialog.acted');
  assert.equal(await page.locator('#power-count').textContent(), '4 / 10');
  assert.equal(await page.locator('#collection-count').textContent(), '4');
  await page.screenshot({ path: 'artifacts/world/ghost.png' });
  await page.reload(); assert.equal(await page.locator('#power-count').textContent(), '4 / 10');
  await seed(page, 2, { completedDraws: 4, sinceEvent: 0, pending: [{ kind: 'event', id: 'ghost' }] }, 4);
  await page.waitForSelector('#world-dialog.acted'); assert.equal(await page.locator('#power-count').textContent(), '2 / 10');
  await page.locator('#continue-world').click();
  // 第10次正常抽奖升级，能量耗尽也能完成，升级不消费资源。
  await seed(page, 1, { completedDraws: 9, sinceEvent: 0, pending: [] }, 9);
  await page.locator('#draw').click();
  await page.waitForSelector('#world-dialog[open][data-scene="upgrade"]');
  await page.waitForSelector('#world-dialog.acted');
  assert.equal(await page.locator('#machine').getAttribute('data-level'), 'rainbow');
  assert.equal(await page.locator('#power-count').textContent(), '0 / 10');
  assert.equal(await page.locator('#collection-count').textContent(), '10');
  await page.screenshot({ path: 'artifacts/world/upgrade.png' });
  await page.locator('#continue-world').click();
  await page.waitForFunction(() => !document.body.classList.contains('world-busy'));
  await page.reload();
  assert.equal(await page.locator('#machine').getAttribute('data-level'), 'rainbow');
  assert.equal(await page.locator('#world-dialog').evaluate(el => el.open), false);
  await page.screenshot({ path: 'artifacts/world/rainbow-machine.png' });
  // 升级与事件同时到来时顺序播放；出场中刷新继续未结算队列。
  await seed(page, 7, { completedDraws: 10, sinceEvent: 0, pending: [{ kind: 'upgrade' }, { kind: 'event', id: 'courier', giftId: 'cloud-dolphin' }] }, 10);
  await page.waitForSelector('#world-dialog[open][data-scene="upgrade"]');
  await page.reload();
  await page.waitForSelector('#world-dialog[data-scene="upgrade"].acted');
  assert.equal(await page.locator('#collection-count').textContent(), '10');
  await page.locator('#continue-world').click();
  await page.waitForSelector('#world-dialog[data-scene="courier"].acted');
  assert.equal(await page.locator('#collection-count').textContent(), '11');
  assert.equal(await page.locator('#power-count').textContent(), '7 / 10');
  await page.locator('#continue-world').click();
  await page.reload();
  assert.equal(await page.locator('#collection-count').textContent(), '11');
  assert.equal(await page.locator('#world-dialog').evaluate(el => el.open), false);
  // 手机与柔和动画模式：角色、赠品、升级可见且无横向溢出。
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); mobile.on('pageerror', e => errors.push(e.message));
  await seed(mobile, 7, { completedDraws: 10, sinceEvent: 0, pending: [{ kind: 'event', id: 'courier', giftId: 'cloud-dolphin' }] }, 10);
  await mobile.waitForSelector('#world-dialog.acted');
  assert.equal(await mobile.locator('#world-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  assert.equal(await mobile.locator('.scene-avatar').evaluate(el => getComputedStyle(el).animationName), 'none');
  await mobile.screenshot({ path: 'artifacts/world/mobile-courier.png' });
  await mobile.locator('#continue-world').click();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  // 新事件音效与彩虹启动音真实渲染，音频节点会回收。
  for (const kind of ['fairy', 'ghost', 'courier', 'upgrade', 'rainbow-start']) {
    const rendered = await page.evaluate(async kind => {
      const context = new OfflineAudioContext(1, 44100 * 4, 44100);
      const sound = new MagicAudio(() => false); sound.setup(context); sound.ready = () => true;
      if (kind === 'rainbow-start') sound.start(true); else sound.encounter(kind);
      const buffer = await context.startRendering(); let peak = 0; for (const value of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(value));
      return { peak, voices: sound.voices.size };
    }, kind);
    assert.ok(rendered.peak > .01 && rendered.peak < .98); assert.equal(rendered.voices, 0);
  }
  assert.deepEqual(errors, []);
  console.log('通过：真实开奖后随机事件、额外礼物不推进等级、事件结算/刷新恢复、仙子补能/满格送礼、幽灵低能量保护、第10次升级、持久化、输入锁定、手机柔和动画及专属音效');
} finally { await browser.close(); }
