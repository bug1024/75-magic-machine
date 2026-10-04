import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const url='file://'+process.cwd()+'/index.html',key='75-magic-machine:v1';await mkdir('artifacts/adventures',{recursive:true});
const base={version:2,history:[],inventory:{'cloud-dolphin':1,'zizi-owl':1,'loving-mom':1},muted:true,energy:{balance:5},world:{completedDraws:60,seenOpponents:['bat','witch','rock','dragon'],pending:[]},garden:{slots:[]}};
async function seed(page,save){await page.goto(url);await page.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key,save});await page.reload();}
const snapshot=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function next(page,stage){await page.locator('#finale-next').click();await page.waitForSelector(`#finale-scene[data-stage=${stage}]`);}
async function toCrown(page){for(const stage of ['seasons','bloom','seal'])await next(page,stage);for(let i=0;i<3;i++)await page.locator('#finale-dragon').click();await page.waitForSelector('#finale-scene[data-stage=love]');for(let i=0;i<3;i++)await page.locator('#finale-dragon').click();await page.waitForSelector('#finale-scene[data-stage=celebrate]');await next(page,'crown');}
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // 旧发现故事直接拥有遗物；点遗物有独立反馈，不要求重放原故事。
 await seed(page,{...base,garden:{slots:[],discovered:['ocean-party','forest-concert']}});assert.equal(await page.locator('.garden-keepsake').count(),2);await page.locator('[data-memory=bubble-pond]').click();assert.ok(await page.locator('[data-memory=bubble-pond] .memory-bits').count());await page.screenshot({path:'artifacts/adventures/memories-desktop.png'});
 // 获取测试实例只用于选择天气；得分与结算完全通过真实按钮。
 await page.evaluate(()=>{const original=MagicGarden.prototype.startWeather;MagicGarden.prototype.startWeather=function(...args){window.testGarden=this;return original.apply(this,args)};});await page.locator('#environment').click();await page.locator('#weather').click();await page.waitForSelector('#weather-play:not([hidden])');
 for(const kind of ['rain','snow','wind','meteors','icecream','coins','sakura','storm']){
  await page.evaluate(kind=>{testGarden.rules.kinds=[kind];testGarden.startWeather();},kind);await page.waitForTimeout(150);
  for(const target of await page.locator('.weather-target').all())await target.click();const saved=await snapshot(page);assert.ok(saved.garden.adventures.weatherWins.includes(kind));assert.ok(await page.locator(`[data-memory=weather-${kind}]`).count());assert.ok(saved.energy.balance<=10);
  await page.locator('#weather-play-close').click();
 }
 let saved=await snapshot(page);assert.equal(saved.garden.adventures.weatherWins.length,8);await page.reload();assert.equal(await page.locator('.garden-keepsake').count(),10);
 // 新故事完成后留下景物、移走宝物仍保留。
 await seed(page,{...base,inventory:{'cloud-dolphin':1,'whale-cup':1},garden:{slots:['cloud-dolphin','whale-cup']}});await page.waitForSelector('#garden-story-stage:not([hidden])');await page.waitForFunction(()=>document.getElementById('garden-story-stage').hidden);assert.equal(await page.locator('[data-memory=bubble-pond]').count(),1);await page.locator('.garden-remove').first().click();assert.equal(await page.locator('[data-memory=bubble-pond]').count(),1);
 // 第75次真实抽奖只进入结局；刷新恢复点击，不额外消耗能量或派奖。
 await seed(page,{...base,energy:{balance:10},world:{completedDraws:74,pending:[]}});await page.keyboard.press('Space');await page.waitForSelector('#finale-scene[data-stage=gather]');saved=await snapshot(page);assert.equal(saved.world.completedDraws,75);assert.equal(saved.energy.balance,9);assert.equal(saved.history.length,0);
 for(const stage of ['seasons','bloom','seal'])await next(page,stage);await page.locator('#finale-dragon').click();await page.reload();await page.waitForSelector('#finale-scene[data-stage=seal]');assert.match(await page.locator('#finale-progress').textContent(),/1 \/ 3/);assert.equal((await snapshot(page)).energy.balance,9);
 for(let i=0;i<2;i++)await page.locator('#finale-dragon').click();await page.waitForSelector('#finale-scene[data-stage=love]');for(let i=0;i<3;i++)await page.locator('#finale-dragon').click();await page.waitForSelector('#finale-scene[data-stage=celebrate]');await page.screenshot({path:'artifacts/adventures/celebration-desktop.png'});await next(page,'crown');assert.equal((await snapshot(page)).inventory['75-starlight-crown'],1);
 await page.reload();await page.waitForSelector('#finale-scene[data-stage=crown]');assert.equal((await snapshot(page)).inventory['75-starlight-crown'],1);await page.locator('#finale-continue').click();await page.waitForFunction(()=>document.body.classList.contains('eternal-garden'));assert.equal(await page.locator('.garden-friend').count(),4);assert.ok((await snapshot(page)).world.finale.complete);
 await page.locator('#finale-replay').click();await page.waitForSelector('#finale-scene[data-stage=gather]');await toCrown(page);await page.locator('#finale-continue').click();assert.equal((await snapshot(page)).inventory['75-starlight-crown'],1);assert.equal((await snapshot(page)).history.length,1);await page.keyboard.press('Space');await page.waitForSelector('#machine[data-state=result]');assert.equal((await snapshot(page)).world.completedDraws,76);
 // 永恒花园无摆放宝物也有守护助攻；普通宝物仍需要摆放。
 saved=await snapshot(page);saved.world.pending=[{kind:'witch',opponent:'dragon',hits:0,giftId:'cloud-dolphin'}];await seed(page,saved);await page.waitForSelector('#witch-stage[data-action=ready]');await page.waitForFunction(()=>!!document.querySelector('.assist-shot'));await page.waitForFunction(()=>document.getElementById('witch-hit-count').textContent==='1 / 8');assert.ok((await snapshot(page)).world.pending[0].usedGuardians[0].startsWith('friend-'));
 // 手机与旧75+存档，最终阶段按钮始终在屏幕内，继续与重播可达。
 for(const width of [375,320]){await page.setViewportSize({width,height:844});await seed(page,{...base,world:{completedDraws:100,finale:{stage:'love',progress:2},pending:[]}});await page.waitForSelector('#finale-scene[data-stage=love]');const dragon=await page.locator('#finale-dragon').boundingBox();assert.ok(dragon.x>=0&&dragon.x+dragon.width<=width);await page.screenshot({path:`artifacts/adventures/finale-${width}.png`});await page.locator('#finale-dragon').click();await page.waitForSelector('#finale-scene[data-stage=celebrate]');await next(page,'crown');await page.locator('#finale-continue').click();assert.equal(await page.locator('.garden-friend').count(),4);assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);console.log('Adventure checks passed: persistent story scenery, 8 playable weathers, 75th finale and refresh recovery, unique crown, replay, continued draws, redeemed guardians, desktop/mobile.');
}finally{await Promise.all(browser.contexts().map(context=>context.close()));await browser.close();}
