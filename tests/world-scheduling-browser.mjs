import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const url = process.env.WORLD_TEST_URL || 'file://' + process.cwd() + '/index.html';
const key = '75-magic-machine:v1';
try {
 const page = await browser.newPage(), errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.addInitScript(() => Math.random = () => 0);
 async function seed(count, extra = {}, balance = 10) {
  await page.goto(url);
  await page.evaluate(({ key, count, extra, balance }) => localStorage.setItem(key, JSON.stringify({ version: 2, history: [], inventory: {}, muted: true, tips: ['treasure-play'], energy: { balance }, world: { completedDraws: count, pending: [], ...extra }, garden: { slots: [] } })), { key, count, extra, balance });
  await page.reload();
 }
 const snapshot = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
 async function draw() { await page.keyboard.press('Space'); await page.waitForSelector('#machine[data-state=result]'); }
 // 实际抽奖跨越全部升级门槛；结果一出现就按空格，不能开始新一抽。
 for (const [count, level] of [[9, 'rainbow'], [19, 'winged'], [34, 'castle'], [49, 'life']]) {
  await seed(count); await draw();
  assert.equal((await snapshot()).world.pending[0].level, level);
  await page.keyboard.press('Space');
  if (level === 'life') await page.waitForSelector('#life-upgrade-banner:not([hidden])');
  else await page.waitForSelector('#world-dialog.acted');
  assert.equal((await snapshot()).world.completedDraws, count + 1);
  assert.equal((await snapshot()).energy.balance, 9);
  await page.waitForFunction(level => document.getElementById('machine').dataset.level === level, level);
 }
 // 实际生成访客与新反派，而非直接塞入待播放队列。
 await seed(4, { sinceEvent: 4 }); await draw();
 assert.equal((await snapshot()).world.pending[0].id, 'fairy');
 await page.keyboard.press('Space'); await page.waitForSelector('#world-visitor[data-kind=fairy]:not([hidden])');
 assert.equal((await snapshot()).world.completedDraws, 5);
 for (const [count, opponent, seenOpponents] of [[20, 'witch', ['bat']], [35, 'rock', ['bat', 'witch']]]) {
  await seed(count, { seenOpponents }); await draw();
  assert.equal((await snapshot()).world.pending[0].opponent, opponent);
  if (opponent === 'rock') await page.locator('#draw').click(); else await page.keyboard.press('Space');
  await page.waitForSelector('#witch-stage[data-action=ready]');
  assert.equal((await snapshot()).world.completedDraws, count + 1);
  assert.equal((await snapshot()).energy.balance, 9);
 }
 // 最后一格能量抽出的待升级不能被数学弹层截走。
 await seed(9, {}, 1); await draw(); await page.keyboard.press('Space');
 await page.waitForSelector('#world-dialog.acted');
 assert.equal((await snapshot()).energy.balance, 0);
 assert.equal(await page.locator('#recharge-dialog').isVisible(), false);
 assert.equal((await snapshot()).world.completedDraws, 10);
 assert.deepEqual(errors, []);
 console.log('World scheduling passed: rapid continuation at all upgrades, naturally generated fairy/witch/rock, no extra draw or energy cost, zero-energy priority.');
} finally { await browser.close(); }
