import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const url = pathToFileURL(`${process.cwd()}/index.html`).href;
await mkdir('artifacts/energy', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem('75-magic-machine:v1', JSON.stringify({ version: 1, energy: { balance: 0, difficulty: 'hard' } })));
  await page.reload();
  await page.evaluate(() => {
    Math.random = () => .25;
    window.answerSounds = { correct: 0, wrong: 0, full: 0 };
    const correct = MagicAudio.prototype.answerCorrect, wrong = MagicAudio.prototype.answerWrong;
    MagicAudio.prototype.answerCorrect = function(full) { if (this.ready()) { answerSounds.correct++; if (full) answerSounds.full++; } return correct.call(this, full); };
    MagicAudio.prototype.answerWrong = function() { if (this.ready()) answerSounds.wrong++; return wrong.call(this); };
  });
  await page.locator('#recharge').click();
  assert.equal(await page.locator('#math-question').textContent(), '25 + 19 =');
  await page.locator('#math-answer').pressSequentially('4');
  assert.equal(await page.locator('#power-count').textContent(), '0 / 10');
  assert.deepEqual(await page.evaluate(() => answerSounds), { correct: 0, wrong: 0, full: 0 });
  await page.locator('#math-answer').pressSequentially('4');
  assert.equal(await page.locator('#power-count').textContent(), '1 / 10');
  await page.waitForFunction(() => answerSounds.correct === 1);
  assert.equal(await page.locator('#math-answer').isDisabled(), true);
  // 重复 input / submit 不会再发放当前题奖励。
  await page.locator('#math-answer').dispatchEvent('input');
  await page.locator('#answer-submit').click();
  assert.equal(await page.locator('#power-count').textContent(), '1 / 10');
  await page.locator('#math-answer').fill('999');
  assert.equal(await page.evaluate(() => answerSounds.wrong), 0);
  await page.locator('#answer-submit').click();
  await page.waitForFunction(() => answerSounds.wrong === 1);
  assert.equal(await page.locator('#power-count').textContent(), '1 / 10');
  assert.equal(await page.locator('#math-hint').isVisible(), true);
  // 三位数答案输入中不误报失败，完整输入后自动充能。
  await page.evaluate(() => { let values = [0, .9999, 0]; Math.random = () => values.length ? values.shift() : .25; });
  await page.locator('[data-difficulty="medium"]').click(); // 消耗上述随机数，然后重新指定给困难题。
  await page.evaluate(() => { let values = [0, .9999, 0]; Math.random = () => values.length ? values.shift() : .25; });
  await page.locator('[data-difficulty="hard"]').click();
  assert.equal(await page.locator('#math-question').textContent(), '100 + 0 =');
  await page.locator('#math-answer').pressSequentially('10');
  assert.equal(await page.locator('#power-count').textContent(), '1 / 10');
  await page.locator('#math-answer').pressSequentially('0');
  assert.equal(await page.locator('#power-count').textContent(), '2 / 10');
  await page.waitForFunction(() => answerSounds.correct === 2);
  await page.evaluate(() => { Math.random = () => 0; });
  await page.locator('[data-difficulty="easy"]').click();
  assert.equal(await page.locator('#math-question').textContent(), '0 + 0 =');
  await page.locator('#number-pad button').filter({ hasText: /^0$/ }).click();
  assert.equal(await page.locator('#power-count').textContent(), '3 / 10');
  // 静音时正确答案依旧生效，但不播放反馈音。
  await page.locator('#close-recharge').click(); await page.locator('#sound').click();
  const beforeMuted = await page.evaluate(() => ({ ...answerSounds }));
  await page.locator('#recharge').click();
  const answerFor = async () => { const text = await page.locator('#math-question').textContent(); const [, left, op, right] = text.match(/(\d+) ([+−]) (\d+)/); return op === '+' ? +left + +right : +left - +right; };
  await page.locator('#math-answer').fill(String(await answerFor()));
  assert.equal(await page.locator('#power-count').textContent(), '4 / 10');
  await page.waitForTimeout(120);
  assert.deepEqual(await page.evaluate(() => answerSounds), beforeMuted);
  await page.locator('#close-recharge').click(); await page.locator('#sound').click();
  await page.locator('#recharge').click();
  for (let balance = 5; balance <= 10; balance++) {
    const answer = String(await answerFor());
    for (const digit of answer) await page.locator('#number-pad button').filter({ hasText: new RegExp(`^${digit}$`) }).click();
    assert.equal(await page.locator('#power-count').textContent(), `${balance} / 10`);
    if (balance < 10) await page.locator('#answer-submit').click();
  }
  await page.waitForFunction(() => answerSounds.full === 1);
  assert.equal(await page.locator('#full-energy').isVisible(), true);
  assert.equal(await page.locator('#full-energy').evaluate(el => el.classList.contains('just-charged')), true);
  assert.equal(await page.locator('.full-heart').evaluate(el => getComputedStyle(el).animationName), 'full-heart-pop');
  assert.equal(await page.locator('#charge-burst span').count(), 22);
  await page.waitForTimeout(260);
  await page.screenshot({ path: 'artifacts/energy/full-charge-celebration.png' });
  await page.locator('#return-to-machine').click(); await page.locator('#recharge').click();
  assert.equal(await page.locator('#full-energy').evaluate(el => el.classList.contains('just-charged')), false);
  assert.equal(await page.evaluate(() => answerSounds.full), 1);
  await page.locator('#close-recharge').click(); await page.reload();
  assert.equal(await page.locator('#power-count').textContent(), '10 / 10');
  // 离线音频验证：三种音效非静音、无削波，声音节点全部回收。
  for (const kind of ['correct', 'wrong', 'full']) {
    const result = await page.evaluate(async kind => {
      const context = new OfflineAudioContext(1, 44100 * 2, 44100);
      const sound = new MagicAudio(() => false); sound.setup(context); sound.ready = () => true;
      if (kind === 'wrong') sound.answerWrong(); else sound.answerCorrect(kind === 'full');
      const buffer = await context.startRendering(); let peak = 0;
      for (const value of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(value));
      return { peak, live: sound.voices.size };
    }, kind);
    assert.ok(result.peak > .01 && result.peak < .98); assert.equal(result.live, 0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { const saved = JSON.parse(localStorage.getItem('75-magic-machine:v1')); saved.energy.balance = 9; localStorage.setItem('75-magic-machine:v1', JSON.stringify(saved)); });
  await page.reload(); await page.locator('#recharge').click();
  await page.locator('#math-answer').fill(String(await answerFor()));
  assert.equal(await page.locator('#full-energy').isVisible(), true);
  assert.equal(await page.locator('#recharge-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'artifacts/energy/mobile-full-charge.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.body.classList.contains('gentle'));
  assert.equal(await page.locator('.full-heart').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.deepEqual(errors, []);
  console.log('通过：键盘/数字键盘自动提交、0/两位/三位答案、部分输入不判错、失败音效、重复奖励拦截、静音、满格动画及音效仅播放一次、余额保存、音频渲染与回收');
} finally { await browser.close(); }
