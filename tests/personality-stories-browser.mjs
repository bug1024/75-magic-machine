import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const treasures = JSON.parse(await readFile('treasures.json', 'utf8')).treasures;
const stories = JSON.parse(await readFile('garden-stories.json', 'utf8')).stories;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const url = 'file://' + process.cwd() + '/index.html', errors = [];
await mkdir('artifacts/personality', { recursive: true });
async function seed(page, ids, discovered, extra = {}) {
 await page.goto(url);
 await page.evaluate(saved => localStorage.setItem('75-magic-machine:v1', JSON.stringify(saved)), {
  version:1, muted:true, history:[], inventory:Object.fromEntries(ids.map(id=>[id,1])),
  energy:{balance:5,difficulty:'easy'}, garden:{slots:ids,discovered}, ...extra
 });
 await page.reload();
}
try {
 const page = await browser.newPage({viewport:{width:1280,height:800}}); page.on('pageerror',e=>errors.push(e.message));
 // 花园使用同一互动：完整配置覆盖，不增减库存和能量，连点不叠加。
 for (let i = 0; i < treasures.length; i += 6) {
  const batch = treasures.slice(i,i+6);
  await seed(page,batch.map(t=>t.id),stories.map(s=>s.id));
  for (const [slot, treasure] of batch.entries()) {
   const button = page.locator('.garden-slot').nth(slot);
   await button.click(); assert.equal(await button.getAttribute('data-play'),treasure.effects.interaction);
   assert.equal(await button.locator('.play-bits').count(),1); assert.equal(await button.locator('.play-caption').count(),1);
   const line = await button.locator('.play-caption').textContent(); assert.equal(line,treasure.effects.interactionLines[0]);
   await button.click({force:true}); assert.equal(await button.locator('.play-bits').count(),1);
  }
  assert.equal(await page.locator('#power-count').textContent(),'5 / 10');
  assert.equal(await page.locator('#collection-count').textContent(),String(batch.length));
  if(i===0) { await page.evaluate(()=>document.getAnimations().forEach(a=>a.playbackRate=.1)); await page.screenshot({path:'artifacts/personality/garden.png'}); }
 }
 const additions=stories.filter(s=>s.requirements.some(r=>r.id));
 for (const story of additions) {
  const ids=story.requirements.map(r=>r.id), known=stories.filter(s=>s.id!==story.id).map(s=>s.id);
  await seed(page,ids,known);
  await page.waitForSelector(`#garden-story-stage[data-effect=${story.effect}]:not([hidden])`);
  assert.equal(await page.locator('#garden-story-caption').textContent(),story.lines[0]);
  assert.equal(await page.locator('#power-count').textContent(),'6 / 10');
  assert.equal(await page.locator('#garden-story-actors img').count(),2);
  await page.waitForTimeout(600); await page.screenshot({path:`artifacts/personality/${story.effect}.png`});
  if(story.effect==='secret') {
   const original=await page.locator('.story-actor').nth(1).locator('img').getAttribute('src');
   await page.waitForFunction(()=>document.getElementById('garden-story-stage').dataset.beat==='1');
   assert.notEqual(await page.locator('.story-actor').nth(1).locator('img').getAttribute('src'),original);
   assert.equal(await page.locator('#garden-story-caption').textContent(),story.lines[1]);
   await page.waitForFunction(()=>document.getElementById('garden-story-stage').dataset.beat==='2');
   assert.equal(await page.locator('#garden-story-caption').textContent(),story.lines[2]);
   await page.waitForFunction(()=>document.getElementById('garden-story-stage').hidden);
  }
  await page.reload(); assert.equal(await page.locator('#garden-story-stage').isVisible(),false);
  await page.locator('#garden-story-button').click(); await page.locator(`[data-story="${story.id}"]`).click();
  await page.waitForSelector('#garden-story-stage:not([hidden])');
  assert.equal(await page.locator('#power-count').textContent(),'6 / 10');
 }
 const jewels=stories.find(s=>s.effect==='sparkle');
 await seed(page,jewels.requirements.map(r=>r.id),[]);
 await page.waitForSelector('#garden-story-stage[data-effect=sparkle]:not([hidden])');
 // 不同组合同时满足，首个故事结束后不会紧接着自动播放第二个。
 await seed(page,['star-seed','singing-mushrooms','cloud-dolphin','whale-cup'],[]);
 await page.waitForSelector('#garden-story-stage:not([hidden])');
 await page.waitForFunction(()=>document.getElementById('garden-story-stage').hidden);
 await page.waitForTimeout(500); assert.equal(await page.locator('#garden-story-stage').isVisible(),false);
 await page.locator('#garden-story-button').click(); await page.locator('[data-story="forest-concert"]').click();
 await page.waitForSelector('#garden-story-stage:not([hidden])'); assert.equal(await page.locator('#power-count').textContent(),'6 / 10');
 const mobile=await browser.newPage({viewport:{width:320,height:720},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 mobile.on('pageerror',e=>errors.push(e.message));
 await seed(mobile,['super-dad','zizi-owl'],stories.map(s=>s.id));
 await mobile.locator('.garden-slot').first().tap();
 assert.equal(await mobile.locator('.garden-slot img').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 const bounds = await mobile.locator('.play-caption').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right};});
 assert.ok(bounds.left>=0 && bounds.right<=320);
 await mobile.screenshot({path:'artifacts/personality/mobile-toot.png'});
 await mobile.waitForFunction(()=>!document.querySelector('.garden-slot').dataset.play);
 await mobile.locator('.garden-slot').first().tap();
 assert.equal(await mobile.locator('.play-caption').textContent(),treasures.find(t=>t.id==='super-dad').effects.interactionLines[1]);
 const lunar=stories.find(s=>s.effect==='lunar');
 await seed(mobile,lunar.requirements.map(r=>r.id),stories.filter(s=>s.id!==lunar.id).map(s=>s.id));
 await mobile.waitForSelector('#garden-story-stage:not([hidden])');
 assert.equal(await mobile.locator('.story-actor').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mobile.screenshot({path:'artifacts/personality/mobile-lunar.png'});
 for(const kind of additions.map(s=>s.effect)) {
  const result=await page.evaluate(async kind=>{
   const ctx=new OfflineAudioContext(1,44100*4,44100),sound=new MagicAudio(()=>false);sound.setup(ctx);sound.ready=()=>true;sound.story(kind,'night','rain');
   const data=(await ctx.startRendering()).getChannelData(0);let peak=0;for(const x of data)peak=Math.max(peak,Math.abs(x));return {peak,voices:sound.voices.size};
  },kind);
  assert.ok(result.peak>.01&&result.peak<.98);assert.equal(result.voices,0);
 }
 assert.deepEqual(errors,[]);
 console.log('通过：33件花园互动、连点锁定、六个新故事/三幕剧情、刷新与重播不重复领奖、故事空档、手机触摸与简化动画、6种故事音效');
} finally { await browser.close(); }
