import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel:'chrome', headless:true });
const url = pathToFileURL(`${process.cwd()}/index.html`).href, errors=[];
await mkdir('artifacts/witch',{recursive:true});
async function seed(page,count,balance=10,pending=[]) {
  await page.goto(url);
  await page.evaluate(({count,balance,pending})=>localStorage.setItem('75-magic-machine:v1',JSON.stringify({version:1,history:[],muted:true,energy:{balance,difficulty:'easy'},world:{completedDraws:count,sinceEvent:0,pending}})),{count,balance,pending});
  await page.reload();
}
async function hit(page) {
  await page.waitForFunction(()=>!document.querySelector('#witch-target').hidden && !document.querySelector('#witch-target').disabled);
  await page.locator('#witch-target').click();
  await page.waitForFunction(()=>!document.querySelector('.witch-shot'));
}
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Math.random=()=>.5});
  // 真实第50次开奖，耗尽能量也能打女巫。
  await seed(page,49,1);await page.keyboard.press('Space');
  await page.waitForSelector('#witch-stage:not([hidden])');
  assert.equal(await page.locator('#draw').isDisabled(),true);
  assert.equal(await page.locator('#collection-count').textContent(),'1');
  assert.equal(await page.locator('#power-count').textContent(),'0 / 10');
  await page.waitForSelector('#witch-stage[data-action=ready]');
  assert.equal(await page.locator('dialog[open]').count(),0);
  const origin=await page.locator('#window').boundingBox();
  await page.screenshot({path:'artifacts/witch/arrival.png'});
  // 空格和Escape都不改变游戏或启动其他按钮。
  await page.locator('#witch-target').focus();await page.keyboard.press('Space');await page.keyboard.press('Escape');
  assert.equal(await page.locator('#witch-hit-count').textContent(),'0 / 3');
  assert.equal(await page.locator('#witch-stage').evaluate(el=>!el.hidden),true);
  // 点击空白发射，但不计命中；连点同一弹道不会多计。
  await page.mouse.click(1250,770);
  assert.equal(await page.locator('.witch-shot img').count(),1);
  const from=await page.locator('.witch-shot').evaluate(el=>parseFloat(el.style.getPropertyValue('--from-x')));
  assert.ok(Math.abs(from-(origin.x+origin.width/2-25))<2,'宝物从主抽奖机发射');
  await page.waitForFunction(()=>!document.querySelector('.witch-shot'));
  assert.equal(await page.locator('#witch-hit-count').textContent(),'0 / 3');
  await page.waitForFunction(()=>!document.querySelector('#witch-target').disabled);
  await page.locator('#witch-target').click();
  await page.locator('#witch-target').evaluate(el=>{el.click();el.click()});
  await page.evaluate(()=>{window.challengeHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.challengeHidden})});
  await page.waitForTimeout(650);
  assert.equal(await page.locator('#witch-hit-count').textContent(),'0 / 3');
  await page.evaluate(()=>{window.challengeHidden=false});
  await page.waitForFunction(()=>document.querySelector('#witch-hit-count').textContent==='1 / 3');
  assert.equal(await page.locator('#power-count').textContent(),'0 / 10');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')));
  assert.equal(before.world.pending[0].hits,1);assert.equal(before.world.completedDraws,50);
  await page.reload();await page.waitForSelector('#witch-stage:not([hidden])');
  assert.equal(await page.locator('#witch-hit-count').textContent(),'1 / 3');
  await hit(page);assert.equal(await page.locator('#witch-hit-count').textContent(),'2 / 3');
  // Enter可以发射；胜利一次只送一份礼物，不改变等级次数。
  await page.waitForFunction(()=>!document.querySelector('#witch-target').hidden&&!document.querySelector('#witch-target').disabled);
  await page.locator('#witch-target').focus();await page.keyboard.press('Enter');
  await page.waitForSelector('#witch-stage[data-action=fleeing]');
  assert.equal(await page.locator('#witch-reward').isVisible(),false);
  await page.waitForTimeout(850);
  assert.equal(await page.locator('#witch-stage').getAttribute('data-action'),'fleeing');
  await page.screenshot({path:'artifacts/witch/fleeing.png'});
  await page.waitForSelector('#witch-stage[data-action=won]');
  assert.equal(await page.locator('#witch-hit-count').textContent(),'3 / 3');
  assert.equal(await page.locator('#collection-count').textContent(),'2');
  assert.equal(await page.locator('#power-count').textContent(),'0 / 10');
  const won=await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')));
  assert.equal(won.world.pending.length,0);assert.equal(won.world.completedDraws,50);assert.equal(won.history.at(-1).eventId,'witch');
  await page.waitForTimeout(900);await page.screenshot({path:'artifacts/witch/victory.png'});
  await page.locator('#witch-continue').click();await page.waitForFunction(()=>!document.body.classList.contains('world-busy'));
  await page.reload();assert.equal(await page.locator('#collection-count').textContent(),'2');assert.equal(await page.locator('#witch-stage').evaluate(el=>!el.hidden),false);
  // 切换入口不会重复停在同一位置，预存最后一击能在刷新后结算。
  await seed(page,100,7,[{kind:'witch',milestone:100,hits:2,giftId:'cloud-dolphin'}]);
  await page.waitForSelector('#witch-stage[data-action=ready]');
  const slot=await page.locator('#witch-target').getAttribute('data-slot');
  await page.waitForFunction(old=>document.querySelector('#witch-target').dataset.slot!==old,slot);
  await hit(page);await page.waitForSelector('#witch-stage[data-action=won]');
  assert.match(await page.locator('#witch-feedback').textContent(),/云朵小海豚/);assert.equal(await page.locator('#collection-count').textContent(),'1');
  await page.reload();assert.equal(await page.locator('#collection-count').textContent(),'1');
  // 即使在最后一击保存后刷新，也只结算一次奖励。
  await seed(page,150,4,[{kind:'witch',milestone:150,hits:3,giftId:'cloud-dolphin'}]);
  await page.waitForSelector('#witch-stage[data-action=won]');
  assert.equal(await page.locator('#collection-count').textContent(),'1');
  await page.reload();assert.equal(await page.locator('#collection-count').textContent(),'1');
  // 手机触摸和柔和动画仍然能完整完成挑战。
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});mobile.on('pageerror',e=>errors.push(e.message));
  await seed(mobile,50,5,[{kind:'witch',milestone:50,hits:0,giftId:'cloud-dolphin'}]);
  await mobile.waitForSelector('#witch-stage[data-action=ready]');
  assert.equal(await mobile.locator('#witch-stage').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  assert.equal(await mobile.locator('#witch-face').evaluate(el=>getComputedStyle(el).animationName),'none');
  await mobile.screenshot({path:'artifacts/witch/mobile.png'});
  for(let i=0;i<3;i++) {
    await mobile.waitForFunction(()=>!document.querySelector('#witch-target').hidden&&!document.querySelector('#witch-target').disabled);
    await mobile.locator('#witch-target').tap();await mobile.waitForFunction(()=>!document.querySelector('.witch-shot'));
  }
  await mobile.waitForSelector('#witch-stage[data-action=won]');assert.equal(await mobile.locator('#collection-count').textContent(),'1');
  await mobile.locator('#witch-continue').tap();await mobile.waitForFunction(()=>!document.body.classList.contains('world-busy'));
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  // 五种专属音效真实渲染，没有削波或残留节点。
  for(const kind of ['witch-arrive','witch-shot','witch-hit','witch-miss','witch-win']) {
    const result=await page.evaluate(async kind=>{const ctx=new OfflineAudioContext(1,44100*4,44100);const sound=new MagicAudio(()=>false);sound.setup(ctx);sound.ready=()=>true;sound.encounter(kind);const buffer=await ctx.startRendering();let peak=0;for(const value of buffer.getChannelData(0))peak=Math.max(peak,Math.abs(value));return{peak,voices:sound.voices.size}},kind);
    assert.ok(result.peak>.01&&result.peak<.98);assert.equal(result.voices,0);
  }
  assert.deepEqual(errors,[]);
  console.log('通过：真实第50次触发、0能量可玩、三次命中、打空/连点保护、宝物弹道、键盘空格与Enter、刷新续战、奖励仅一次、入口切换、手机触摸/柔和动画、专属音效及节点回收');
} finally {await browser.close()}
