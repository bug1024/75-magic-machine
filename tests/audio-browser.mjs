// 真正渲染中奖音乐，并验证手势解锁、鼓点、静音和声音资源回收。
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = process.env.SCREENSHOT_DIR || '/tmp/75-magic-machine-v2';
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  let errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.audioStats = { oscillators: 0, noise: 0, compressors: 0 };
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      createOscillator() { window.audioStats.oscillators++; return super.createOscillator(); }
      createBufferSource() { window.audioStats.noise++; return super.createBufferSource(); }
      createDynamicsCompressor() { window.audioStats.compressors++; return super.createDynamicsCompressor(); }
    };
    Math.random = () => .7;
  });
  await page.goto(pathToFileURL(`${process.cwd()}/index.html`).href);
  await page.screenshot({ path: `${output}/desktop-720.png` });
  const drawBottom = await page.locator('#draw').evaluate(el => el.getBoundingClientRect().bottom);
  assert.ok(drawBottom < 720);
  assert.ok(await page.locator('#collection').evaluate(el => el.getBoundingClientRect().bottom < innerHeight), '720p 屏幕应完整显示宝藏入口');
  await page.locator('#draw').click();
  await page.waitForSelector('#machine[data-state="mixing"]');
  let stats = await page.evaluate(() => audioStats);
  assert.equal(stats.compressors, 1); assert.ok(stats.oscillators > 5); assert.ok(stats.noise > 0);
  await page.locator('#sound').click();
  const muted = await page.evaluate(() => ({ ...audioStats }));
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => audioStats), muted);
  await page.locator('#sound').click();
  await page.waitForSelector('#machine[data-state="celebrating"]');
  await page.waitForTimeout(750);
  await page.screenshot({ path: `${output}/rainbow-720.png` });
  await page.waitForSelector('#machine[data-state="result"]');
  stats = await page.evaluate(() => audioStats);
  assert.ok(stats.oscillators > 40); assert.ok(stats.noise > 15);
  console.log('通过：真实 AudioContext 手势解锁、鼓与旋律节点、静音停止新声音、恢复音效');
  const summaries = [];
  for (const id of ['magic-chime', 'rainbow-song', 'royal-fanfare', 'bubble-giggle']) {
    const result = await page.evaluate(async id => {
      const offline = new OfflineAudioContext(1, 44100 * 4, 44100);
      const audio = new MagicAudio(() => false); audio.setup(offline); audio.ready = () => true;
      audio.celebrate(id);
      const rendered = await offline.startRendering(), samples = rendered.getChannelData(0);
      let peak = 0, squareSum = 0, last = 0;
      for (let i = 0; i < samples.length; i++) { const v = samples[i]; peak = Math.max(peak, Math.abs(v)); squareSum += v * v; if (Math.abs(v) > .0001) last = i; }
      return { samples: [...samples], peak, rms: Math.sqrt(squareSum / samples.length), duration: last / 44100, liveVoices: audio.voices.size };
    }, id);
    assert.ok(result.peak > .05 && result.peak < .98, `${id} 不应静音或削波`);
    assert.ok(result.rms > .01); assert.equal(result.liveVoices, 0);
    const data = Buffer.alloc(44 + result.samples.length * 2);
    data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4); data.write('WAVE', 8); data.write('fmt ', 12);
    data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(44100, 24);
    data.writeUInt32LE(88200, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(data.length - 44, 40);
    result.samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
    await writeFile(`${output}/${id}.wav`, data);
    summaries.push(result.duration);
    console.log(`通过：${id} 音乐渲染，峰值 ${result.peak.toFixed(3)}、时长 ${result.duration.toFixed(2)}s、声音资源已回收`);
  }
  assert.ok(summaries[0] < summaries[1] && summaries[1] < summaries[2]);
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
