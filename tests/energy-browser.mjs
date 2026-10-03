import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const url = pathToFileURL(`${process.cwd()}/index.html`).href;
const output = 'artifacts/energy'; await mkdir(output, { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { Math.random = () => .5; }); // 此脚本专注能量，不触发随机事件。
  await page.goto(url);
  assert.equal(await page.locator('#power-count').textContent(), '10 / 10');
  assert.equal(await page.locator('.power-cell.filled').count(), 10);
  await page.screenshot({ path: `${output}/full-machine.png` });
  await page.locator('#recharge').click();
  assert.equal(await page.locator('#full-energy').isVisible(), true);
  await page.locator('#close-recharge').click();
  // 模拟一个已有收藏但没有能量字段的旧存档，初始化不会破坏记录。
  await page.evaluate(() => localStorage.setItem('75-magic-machine:v1', JSON.stringify({ version: 1, history: [{ prizeId: 'super-dad', name: '超级粑粑', rarity: 'rare', timestamp: Date.now(), drawId: 'old' }], muted: true })));
  await page.reload();
  assert.equal(await page.locator('#power-count').textContent(), '10 / 10');
  assert.equal(await page.locator('#collection-count').textContent(), '1');
  await page.evaluate(() => { const saved = JSON.parse(localStorage.getItem('75-magic-machine:v1')); saved.energy = { balance: 4, difficulty: 'easy' }; localStorage.setItem('75-magic-machine:v1', JSON.stringify(saved)); });
  await page.reload();
  for (let expected = 3; expected >= 0; expected--) {
    if (expected === 0) await page.locator('#cheat').click();
    await page.locator('#sound').focus();
    const soundBefore = await page.locator('#sound').getAttribute('aria-pressed');
    await page.keyboard.down('Space'); await page.keyboard.down('Space');
    assert.equal(await page.locator('#power-count').textContent(), `${expected} / 10`);
    assert.equal(await page.locator('#recharge').isDisabled(), true);
    await page.keyboard.up('Space');
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), soundBefore);
    await page.waitForSelector('#machine[data-state="result"]');
    assert.equal(await page.locator('#power-count').textContent(), `${expected} / 10`);
    assert.equal(await page.locator('#machine').evaluate(el => Number(el.style.getPropertyValue('--energy'))), expected / 10);
    assert.equal(await page.locator('#recharge').isDisabled(), false);
    if (expected === 3) {
      assert.equal(await page.locator('body').evaluate(el => el.classList.contains('low-energy')), true);
      assert.equal(await page.locator('.danger-vignette').evaluate(el => getComputedStyle(el).animationName), 'danger-pulse');
      await page.screenshot({ path: `${output}/low-machine.png` });
    }
  }
  assert.equal(await page.locator('#button-text').textContent(), '补充魔法');
  await page.reload();
  assert.equal(await page.locator('#power-count').textContent(), '0 / 10');
  assert.equal(await page.locator('#cheat').getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#recharge-dialog').evaluate(el => el.open), true);
  assert.equal(await page.locator('#machine').getAttribute('data-state'), 'idle');
  const records = await page.locator('#collection-count').textContent();
  await page.waitForTimeout(650);
  assert.equal(await page.locator('.danger-vignette').evaluate(el => getComputedStyle(el).opacity), '0');
  const answerFor = async () => {
    const equation = await page.locator('#math-question').textContent();
    const [, left, operator, right] = equation.match(/(\d+) ([+−]) (\d+)/);
    return operator === '+' ? Number(left) + Number(right) : Number(left) - Number(right);
  };
  await page.locator('#answer-submit').click();
  assert.equal(await page.locator('#power-count').textContent(), '0 / 10');
  await page.locator('#math-answer').fill(String((await answerFor()) + 1));
  await page.locator('#answer-submit').click();
  assert.equal(await page.locator('#power-count').textContent(), '0 / 10');
  assert.equal(await page.locator('#math-hint').isVisible(), true);
  await page.screenshot({ path: `${output}/simple-question.png` });
  await page.locator('#math-answer').fill(String(await answerFor()));
  assert.equal(await page.locator('#power-count').textContent(), '1 / 10');
  await page.locator('#answer-submit').click(); // 下一题不奖励。
  assert.equal(await page.locator('#power-count').textContent(), '1 / 10');
  await page.locator('[data-difficulty="medium"]').click();
  assert.equal(await page.locator('#counting-stars').isVisible(), false);
  await page.locator('[data-difficulty="hard"]').click();
  await page.locator('#math-answer').fill(String(await answerFor()));
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#power-count').textContent(), '2 / 10');
  await page.locator('#close-recharge').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#recharge-dialog').evaluate(el => el.open), true);
  assert.equal(await page.locator('#power-count').textContent(), '2 / 10');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement === document.getElementById('draw'));
  assert.equal(await page.locator('#draw').evaluate(el => el === document.activeElement), true);
  await page.reload();
  assert.equal(await page.locator('#power-count').textContent(), '2 / 10');
  await page.locator('#recharge').click();
  assert.equal(await page.locator('[data-difficulty="hard"]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-difficulty="easy"]').click();
  for (let expected = 3; expected <= 10; expected++) {
    // 使用游戏内数字键盘，验证0和两位数也可以输入。
    const answer = String(await answerFor());
    for (const digit of answer) await page.locator('#number-pad button').filter({ hasText: new RegExp(`^${digit}$`) }).click();
    assert.equal(await page.locator('#power-count').textContent(), `${expected} / 10`);
    if (expected === 4) assert.equal(await page.locator('body').evaluate(el => el.classList.contains('low-energy')), false);
    if (expected < 10) await page.locator('#answer-submit').click();
  }
  assert.equal(await page.locator('#full-energy').isVisible(), true);
  await page.locator('#math-form').evaluate(el => el.dispatchEvent(new Event('submit', { cancelable: true })));
  assert.equal(await page.locator('#power-count').textContent(), '10 / 10');
  assert.equal(await page.locator('#collection-count').textContent(), records);
  await page.locator('#return-to-machine').click();
  assert.equal(await page.locator('#button-text').textContent(), '开启魔法');
  console.log('通过：初始/旧存档、单次扣能量、作弊照常消耗、3格预警、0格拦截、答错重试、正确奖励、重复提交、满格上限、难度保存、弹窗空格和关闭焦点');
  // 开奖演出失败时不发奖并退回能量；刷新进行中的抽奖仍保留启动消耗。
  const recovery = await browser.newPage();
  recovery.on('pageerror', error => errors.push(error.message));
  await recovery.goto(url);
  await recovery.evaluate(() => { window.originalStart = MagicAudio.prototype.start; MagicAudio.prototype.start = () => { throw new Error('test failed animation'); }; });
  await recovery.locator('#draw').click();
  await recovery.waitForFunction(() => document.querySelector('#notice').textContent.includes('机器歇了一小会儿'));
  assert.equal(await recovery.locator('#power-count').textContent(), '10 / 10');
  assert.equal(await recovery.locator('#collection-count').textContent(), '0');
  await recovery.evaluate(() => { MagicAudio.prototype.start = window.originalStart; });
  await recovery.locator('#draw').click();
  assert.equal(await recovery.locator('#power-count').textContent(), '9 / 10');
  await recovery.reload();
  assert.equal(await recovery.locator('#power-count').textContent(), '9 / 10');
  assert.equal(await recovery.locator('#collection-count').textContent(), '0');
  console.log('通过：开奖失败退回能量、中途刷新保留消耗且不发奖');
  // 手机与减少动态效果下，预警保持静态，答题面板可操作且不横向溢出。
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(url);
  await mobile.evaluate(() => localStorage.setItem('75-magic-machine:v1', JSON.stringify({ version: 1, energy: { balance: 3, difficulty: 'easy' }, muted: true })));
  await mobile.reload();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await mobile.locator('.power-cell.filled').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  await mobile.screenshot({ path: `${output}/mobile-machine.png` });
  await mobile.locator('#recharge').click();
  assert.equal(await mobile.locator('#recharge-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await mobile.screenshot({ path: `${output}/mobile-question.png` });
  await mobile.locator('[data-difficulty="hard"]').click();
  assert.equal(await mobile.locator('#recharge-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await mobile.locator('#close-recharge').click();
  // 本地存储不可用时仍能充能，显示保存失败提示。
  const blocked = await browser.newPage();
  blocked.on('pageerror', error => errors.push(error.message));
  await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await blocked.goto(url); await blocked.locator('#sound').click();
  assert.match(await blocked.locator('#notice').textContent(), /未能保存/);
  assert.equal(await blocked.locator('#power-count').textContent(), '10 / 10');
  assert.deepEqual(errors, []);
  console.log(`通过：手机布局、减少动态效果、存储不可用；截图 ${output}`);
} finally { await browser.close(); }
