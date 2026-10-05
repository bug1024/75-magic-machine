import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const key='75-magic-machine:v1',url='file://'+process.cwd()+'/index.html';
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base={version:2,history:[],inventory:{'cloud-dolphin':1,'whale-cup':1},muted:true,energy:{balance:6},world:{completedDraws:2,pending:[]},garden:{slots:['cloud-dolphin']}};
 const seed=async save=>{await page.goto(url);await page.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key,save});await page.reload();};
 const snapshot=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 await page.goto(url);assert.ok(await page.locator('#garden-wish').isHidden());await page.keyboard.press('Space');await page.waitForSelector('#machine[data-state=result]');assert.equal((await snapshot()).world.completedDraws,1);
 await seed(base);await page.locator('#garden-story-button').click();await page.locator('[data-story=ocean-party]').click();await page.locator('#wish-invite').click();assert.deepEqual((await snapshot()).garden.workshop.tray,['cloud-dolphin','whale-cup']);assert.equal((await snapshot()).garden.slots.filter(Boolean).length,1);
 await page.locator('#wish-action').click();await page.waitForSelector('#garden-story-stage:not([hidden])');await page.waitForFunction(()=>document.getElementById('garden-story-stage').hidden);let saved=await snapshot();assert.deepEqual(saved.garden.discovered,['ocean-party']);assert.equal(saved.energy.balance,7);assert.equal(saved.world.completedDraws,2);assert.deepEqual(saved.inventory,base.inventory);assert.equal(await page.locator('[data-memory=bubble-pond]').count(),1);
 await page.locator('#wish-action').click();await page.waitForSelector('#garden-story-stage:not([hidden])');await page.waitForFunction(()=>document.getElementById('garden-story-stage').hidden);assert.equal((await snapshot()).energy.balance,7);
 await page.locator('#wish-invite').click();await page.locator('[data-tray="0"]').click();await page.locator('[data-treasure="cloud-dolphin"] .place-treasure').click();assert.equal((await snapshot()).garden.slots[0],'cloud-dolphin');assert.equal((await snapshot()).inventory['cloud-dolphin'],1);
 // Legacy souvenirs stay available, while all ten stories share one discovery ledger.
 await seed({...base,garden:{slots:[],wishes:{completed:['ocean-friends']}}});assert.equal(await page.locator('[data-memory=wish-ocean-friends]').count(),1);await page.locator('#workshop-open').click();const titles=new Set();for(let i=0;i<10;i++){titles.add(await page.locator('#wish-title').textContent());await page.locator('#wish-swap').click();}assert.equal(titles.size,10);
 await mkdir('artifacts/workshop',{recursive:true});for(const width of [1280,375,320]){await page.setViewportSize({width,height:900});assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth));await page.screenshot({path:`artifacts/workshop/tray-${width}.png`});}
 await page.setViewportSize({width:1280,height:900});await seed({...base,world:{completedDraws:10,pending:[{kind:'upgrade',level:'rainbow'}]}});await page.locator('#workshop-open').click();assert.ok(await page.locator('#garden-wish').isHidden());await page.keyboard.press('Space');await page.waitForSelector('#world-dialog.acted');assert.equal((await snapshot()).world.completedDraws,10);await page.locator('#continue-world').click();assert.deepEqual(errors,[]);
 console.log('Workshop: separate owned tray, non-consuming manual invitation, ten recipes, explicit synthesis/replay, single reward, legacy memories, mobile fit and queued upgrade priority.');
}finally{await browser.close();}
