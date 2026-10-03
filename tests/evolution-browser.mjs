import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const url = pathToFileURL(`${process.cwd()}/index.html`).href;
const errors = []; await mkdir('artifacts/evolution', { recursive: true });
async function seed(page, count, pending = []) {
  await page.goto(url);
  await page.evaluate(({count,pending}) => localStorage.setItem('75-magic-machine:v1', JSON.stringify({ version:1, history:[], muted:true, energy:{balance:10,difficulty:'easy'}, world:{completedDraws:count,sinceEvent:0,pending} })), {count,pending});
  await page.reload();
}
try {
  const page = await browser.newPage({ viewport:{width:1280,height:800} }); page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Math.random=()=>.5});
  for(const [before,level,previous,name] of [[19,'winged','rainbow','飞翼机器'],[34,'castle','winged','城堡机器']]) {
    await seed(page,before);
    assert.equal(await page.locator('#machine').getAttribute('data-level'),previous);
    await page.keyboard.press('Space');
    await page.waitForSelector(`#world-dialog[open][data-upgrade="${level}"]`);
    await page.waitForSelector('#world-dialog.acted');
    assert.equal(await page.locator('#machine').getAttribute('data-level'),level);
    assert.match(await page.locator('#scene-title').textContent(),new RegExp(name));
    assert.equal(await page.locator('#power-count').textContent(),'9 / 10');
    assert.equal(await page.locator('#collection-count').textContent(),'1');
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')));
    assert.equal(saved.world.completedDraws,before+1);assert.equal(saved.world.pending.length,0);
    await page.screenshot({path:`artifacts/evolution/${level}-ceremony.png`});
    await page.locator('#continue-world').click();
    await page.waitForFunction(()=>!document.body.classList.contains('world-busy'));
    await page.reload();await page.waitForTimeout(850);
    assert.equal(await page.locator('#machine').getAttribute('data-level'),level);
    assert.equal(await page.locator('#world-dialog').evaluate(el=>el.open),false);
    assert.equal(await page.locator('.machine-wing').first().evaluate(el=>getComputedStyle(el).visibility),'visible');
    assert.equal(await page.locator('.machine-cloud').evaluate(el=>getComputedStyle(el).visibility),'visible');
    if(level==='castle') assert.equal(await page.locator('.castle-roof').evaluate(el=>getComputedStyle(el).visibility),'visible');
    await page.screenshot({path:`artifacts/evolution/${level}-desktop.png`});
    await page.locator('#draw').click();await page.waitForSelector('#machine[data-state="charging"]');
    assert.equal(await page.locator('.machine-wing svg').first().evaluate(el=>getComputedStyle(el).animationName),'wing-flap');
    if(level==='castle') {
      await page.waitForSelector('#machine[data-state="cracking"]');
      assert.equal(await page.locator('.castle-gates').evaluate(el=>getComputedStyle(el).opacity),'1');
      await page.waitForSelector('#machine[data-state="celebrating"]');
      assert.equal(await page.locator('.door-left').evaluate(el=>getComputedStyle(el).animationName),'gate-left');
    }
    await page.waitForSelector('#machine[data-state="result"]');
    assert.equal(await page.locator('#world-dialog').evaluate(el=>el.open),false);
    console.log(`通过：第${before+1}次升级${name}、不重复升级、形态保存、独立仪式、启动翅膀${level==='castle'?'及开门动作':''}`);
  }
  // 未结算升级在刷新后恢复，先展示旧形态，再完成变身。
  await seed(page,35,[{kind:'upgrade',level:'castle'}]);
  await page.waitForSelector('#world-dialog[open]');
  await page.waitForSelector('#world-dialog.acted');
  assert.equal(await page.locator('#machine').getAttribute('data-level'),'castle');
  await page.locator('#continue-world').click();
  for(const [width,height,motion] of [[390,844,'reduce'],[320,720,'no-preference'],[1280,720,'no-preference']]) {
    const mobile=await browser.newPage({viewport:{width,height},reducedMotion:motion});mobile.on('pageerror',e=>errors.push(e.message));
    for(const [count,level] of [[20,'winged'],[35,'castle']]) {
      await seed(mobile,count);await mobile.waitForTimeout(850);
      assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const wing=await mobile.locator('.machine-wing').first().boundingBox();assert.ok(wing.x>=0,'翅膀不超出屏幕');
      assert.equal(await mobile.locator('#draw').isEnabled(),true);
      if(motion==='reduce') assert.equal(await mobile.locator('.machine-wing svg').first().evaluate(el=>getComputedStyle(el).animationName),'none');
      await mobile.screenshot({path:`artifacts/evolution/${level}-${width}.png`,fullPage:true});
    }
    await mobile.close();
  }
  for(const kind of ['winged','castle']) {
    const result=await page.evaluate(async kind=>{
      const ctx=new OfflineAudioContext(1,44100*4,44100);const sound=new MagicAudio(()=>false);sound.setup(ctx);sound.ready=()=>true;
      sound.start(kind);sound.encounter(`upgrade-${kind}`);const buffer=await ctx.startRendering();let peak=0;for(const value of buffer.getChannelData(0))peak=Math.max(peak,Math.abs(value));
      return{peak,voices:sound.voices.size};
    },kind);assert.ok(result.peak>.01&&result.peak<.98);assert.equal(result.voices,0);
  }
  assert.deepEqual(errors,[]);console.log('通过：升级队列恢复、手机/窄屏布局、柔和动画、独立音效实际渲染与回收，无脚本错误');
} finally {await browser.close()}
