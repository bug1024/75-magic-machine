import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'chrome',headless:true}); const url='file://'+process.cwd()+'/index.html';
await mkdir('artifacts/stories',{recursive:true}); const errors=[];
const record=id=>({drawId:id,prizeId:id,name:id,rarity:'common',timestamp:Date.now(),source:'draw'});
async function seed(page,ids,slots=[],extra={}){await page.goto(url);await page.evaluate(saved=>localStorage.setItem('75-magic-machine:v1',JSON.stringify(saved)),{version:1,muted:true,history:ids.map(record),energy:{balance:5,difficulty:'easy'},garden:{slots},...extra});await page.reload();}
async function place(page,id,slot){await page.locator('#collection').click();await page.evaluate(id=>{const treasures=JSON.parse(document.getElementById('treasure-config').textContent).treasures;const name=treasures.find(t=>t.id===id).name;[...document.querySelectorAll('.treasure-card')].find(el=>el.querySelector('h3').textContent===name).querySelector('.place-treasure').click();},id);await page.locator('.garden-slot').nth(slot).click();}
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await seed(page,['cloud-dolphin'],Array(6).fill('cloud-dolphin'));
 assert.equal(await page.locator('.garden-slot img').count(),1);
 await page.locator('#collection').click();assert.equal(await page.locator('.place-treasure').isDisabled(),true);assert.match(await page.locator('.card-count').filter({hasText:'拥有 1'}).textContent(),/已摆放 1 · 可摆放 0/);await page.locator('#close-collection').click();
 await page.locator('.garden-remove').click();await place(page,'cloud-dolphin',4);assert.equal(await page.locator('.garden-slot img').count(),1);
 // 两件同种可以摆放两格，组合只算一种。
 await seed(page,['cloud-dolphin','cloud-dolphin']);await place(page,'cloud-dolphin',0);await place(page,'cloud-dolphin',1);assert.equal(await page.locator('.garden-slot img').count(),2);assert.equal(await page.locator('#garden-story-stage').isVisible(),false);
 await seed(page,['cloud-dolphin','starlight-dress']);await place(page,'cloud-dolphin',0);await place(page,'starlight-dress',0);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')).garden.slots[0]),'starlight-dress');await page.locator('#collection').click();assert.match(await page.locator('.card-count').filter({hasText:'已摆放 0 · 可摆放 1'}).first().textContent(),/拥有 1/);await page.locator('#close-collection').click();
 // 首次自动演出，奖励+1；刷新/重播不再领奖。
 const cases=[['forest-concert',['star-seed','singing-mushrooms'],'forest'],['ocean-party',['cloud-dolphin','whale-cup'],'ocean'],['magic-ball',['starlight-dress','rainbow-unicorn'],'ball'],['prank-party',['giggle-baby','super-dad'],'prank']];
 for(const [id,ids,effect] of cases){
   await seed(page,ids);await place(page,ids[0],0);await place(page,ids[1],3);
   await page.waitForSelector(`#garden-story-stage[data-effect=${effect}]:not([hidden])`);assert.equal(await page.locator('#power-count').textContent(),'6 / 10');assert.equal(await page.locator('#collection-count').textContent(),'2');
   assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('#garden-story-actors img').count(),2);
   const snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')));assert.deepEqual(snapshot.garden.discovered,[id]);
   await page.screenshot({path:`artifacts/stories/${effect}.png`});
   await page.keyboard.press('Space');assert.equal(await page.locator('#power-count').textContent(),'6 / 10');
   // 充能面板暂停演出，恢复后继续；不能在暂停中换掉组合伙伴。
   if(effect==='forest'){await page.locator('#collection').click();assert.ok(await page.locator('.place-treasure').first().isDisabled());await page.waitForTimeout(700);assert.equal(await page.locator('#garden-story-stage').evaluate(el=>getComputedStyle(el).visibility),'hidden');await page.locator('#close-collection').click();await page.waitForFunction(()=>document.getElementById('garden-story-stage').hidden);assert.equal(await page.locator('#garden-story-bits i').count(),0);}
   await page.reload();assert.equal(await page.locator('#power-count').textContent(),'6 / 10');assert.equal(await page.locator('#garden-story-stage').isVisible(),false);
   await page.locator('#garden-story-button').click();await page.locator(`[data-story="${id}"]`).click();await page.waitForSelector('#garden-story-stage:not([hidden])');assert.equal(await page.locator('#power-count').textContent(),'6 / 10');
   await page.reload();assert.equal(await page.locator('#collection-count').textContent(),'2');
 }
 // 历史不含旧宝物时，独立库存仍支持收藏展示/摆放；满格奖励不溢出。
 await seed(page,[],[],{history:Array.from({length:1000},(_,i)=>({...record('cloud-dolphin'),drawId:'old-'+i})),world:{completedDraws:0,sinceEvent:0,pending:[]},inventory:{'cloud-dolphin':1500,'whale-cup':1},energy:{balance:10,difficulty:'easy'}});await place(page,'cloud-dolphin',0);await place(page,'whale-cup',1);await page.waitForSelector('#garden-story-stage:not([hidden])');assert.equal(await page.locator('#power-count').textContent(),'10 / 10');assert.equal(await page.locator('#collection-count').textContent(),'1501');
 await page.reload();await page.locator('.garden-remove').first().click();await page.locator('#garden-story-button').click();assert.equal(await page.locator('[data-story="ocean-party"]').isDisabled(),true);await page.keyboard.press('Space');await page.waitForSelector('#machine[data-state=result]');const ledger=await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')));assert.equal(ledger.history.length,1000);assert.equal(Object.values(ledger.inventory).reduce((sum,n)=>sum+n,0),1502);assert.equal(await page.locator('#garden-story-panel').isVisible(),false);
 const mobile=await browser.newPage({viewport:{width:320,height:720},isMobile:true,hasTouch:true,reducedMotion:'reduce'});mobile.on('pageerror',e=>errors.push(e.message));await seed(mobile,['giggle-baby','super-dad'],['giggle-baby','super-dad']);await mobile.waitForSelector('#garden-story-stage:not([hidden])');assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await mobile.locator('.story-actor').first().evaluate(el=>getComputedStyle(el).animationName),'none');await mobile.screenshot({path:'artifacts/stories/mobile.png',fullPage:true});
 for(const kind of ['forest','ocean','ball','prank']){const rendered=await page.evaluate(async kind=>{const ctx=new OfflineAudioContext(1,44100*4,44100);const audio=new MagicAudio(()=>false);audio.setup(ctx);audio.ready=()=>true;audio.story(kind,'night','rain');const data=(await ctx.startRendering()).getChannelData(0);let peak=0;for(const value of data)peak=Math.max(peak,Math.abs(value));return {peak,voices:audio.voices.size};},kind);assert.ok(rendered.peak>.01&&rendered.peak<.98);assert.equal(rendered.voices,0);}
 await mobile.reload();await mobile.locator('#collection').tap();assert.equal(await mobile.locator('.place-treasure').first().isDisabled(),true);await mobile.locator('#close-collection').tap();await mobile.locator('#garden-story-button').tap();await mobile.screenshot({path:'artifacts/stories/replay-panel.png'});await mobile.locator('[data-story="prank-party"]').tap();await mobile.waitForSelector('#garden-story-stage:not([hidden])');assert.equal(await mobile.locator('#power-count').textContent(),'6 / 10');
 assert.deepEqual(errors,[]);console.log('数量限制/迁移、独立库存、四个组合、自动演出、重播不领奖、暂停/输入锁定、满格奖励、手机柔和动画通过');
}finally{await browser.close();}
