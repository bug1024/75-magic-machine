import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const url='file://'+process.cwd()+'/index.html';await mkdir('artifacts/visitors',{recursive:true});
async function seed(page,balance,pending){await page.goto(url);await page.evaluate(s=>localStorage.setItem('75-magic-machine:v1',JSON.stringify(s)),{version:2,history:[],inventory:{},muted:true,energy:{balance},world:{completedDraws:40,pending},garden:{slots:[]}});await page.reload();}
const snapshot=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')));
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await seed(page,2,[{kind:'event',id:'fairy'}]);await page.waitForSelector('#world-visitor[data-action=arriving]');assert.equal(await page.locator('#power-count').textContent(),'2 / 10');
 await page.waitForSelector('.visitor-energy-heart');assert.equal(await page.locator('#power-count').textContent(),'2 / 10');
 await page.waitForFunction(()=>document.querySelector('#power-count').textContent==='3 / 10');let saved=await snapshot(page);assert.equal(saved.world.pending[0].chargeRemaining,4);await page.screenshot({path:'artifacts/visitors/fairy.png'});
 await page.reload();for(const n of [4,5,6,7])await page.waitForFunction(n=>document.querySelector('#power-count').textContent===`${n} / 10`,n);await page.waitForFunction(()=>document.querySelector('#world-visitor').hidden);assert.equal((await snapshot(page)).world.pending.length,0);await page.reload();assert.equal(await page.locator('#power-count').textContent(),'7 / 10');
 for(const balance of [3,6]){await seed(page,balance,[{kind:'event',id:'ghost'}]);await page.waitForSelector('#world-visitor[data-kind=ghost][data-action=visiting]');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')).world.pending.length===0);assert.equal(await page.locator('#power-count').textContent(),`${balance===3?3:5} / 10`);assert.equal(await page.locator('dialog[open]').count(),0);}
 for(const id of ['courier','fairy','mermaid']){
  await seed(page,10,[{kind:'event',id,giftId:'cloud-dolphin'}]);await page.waitForSelector('#garden-gift[data-action=waiting]');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('#collection-count').textContent(),'0');
  await page.screenshot({path:`artifacts/visitors/${id}-gift.png`});await page.reload();await page.waitForSelector('#garden-gift[data-action=waiting]');assert.equal((await snapshot(page)).world.pending[0].giftId,'cloud-dolphin');
  await page.locator('#garden-gift').click();await page.waitForSelector('#garden-gift[data-action=opened]');assert.equal(await page.locator('#collection-count').textContent(),'1');await page.reload();assert.equal(await page.locator('#collection-count').textContent(),'1');assert.ok(await page.locator('#garden-gift').isHidden());
 }
 for(const width of [1280,375,320]){
  await page.setViewportSize({width,height:844});await seed(page,5,[{kind:'witch',opponent:'bat',hits:0,giftId:'cloud-dolphin'}]);await page.waitForSelector('#garden-broadcast:not([hidden])');await page.waitForTimeout(750);
  const flower=await page.locator('#garden-broadcast').boundingBox(),machine=await page.locator('#machine').boundingBox();assert.ok(flower.x>=0&&flower.x+flower.width<=width);assert.ok(flower.x+flower.width<=machine.x || flower.x>=machine.x+machine.width || flower.y>=machine.y+machine.height || flower.y+flower.height<=machine.y,'广播不能覆盖机器');const svg=await page.locator('.broadcast-flower svg').boundingBox();assert.ok(svg.width<=70&&svg.height<=91);await page.screenshot({path:`artifacts/visitors/broadcast-${width}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Visitor checks passed: staged hearts and refresh continuity, ghost energy protection, dropped clickable gifts with exactly-once rewards, broadcast placement at 3 widths.');
}finally{await browser.close();}
