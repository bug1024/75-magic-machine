import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {}),headless:true});
const url='file://'+process.cwd()+'/index.html',errors=[];
const encounter={kind:'witch',opponent:'bat',hits:0,giftId:'cloud-dolphin'};
async function battle(page){
 await page.evaluate(item=>{const key='75-magic-machine:v1',saved=JSON.parse(localStorage.getItem(key));saved.world.pending=[item];localStorage.setItem(key,JSON.stringify(saved));},encounter);
 await page.reload();await page.waitForSelector('#witch-stage[data-action=ready]');
}
async function noAssist(page){await page.waitForTimeout(1800);assert.equal(await page.locator('#witch-hit-count').textContent(),'0 / 3');assert.equal(await page.locator('.assist-shot').count(),0);}
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
 for(const [id,name,effect] of [['loving-mom','亲爱的暖暖妈妈','heart-shield'],['super-dad','超级粑粑','rainbow-shot']]){
  await page.goto(url);await page.evaluate(id=>localStorage.setItem('75-magic-machine:v1',JSON.stringify({version:1,muted:true,history:[],inventory:{[id]:1},energy:{balance:10,difficulty:'easy'},world:{completedDraws:40,lastWitchDraw:40,pending:[]},garden:{slots:[]}})),id);await page.reload();
  await page.locator('#collection').click();let card=page.locator('.treasure-card').filter({has:page.locator('h3',{hasText:name})});assert.match(await card.locator('.guardian-card-badge').textContent(),/放进花园后可守护/);await page.locator('#close-collection').click();
  await battle(page);await noAssist(page);
  // 通过真实放置入口摆放，只有一个槽位也能助攻。
  await page.evaluate(()=>{const key='75-magic-machine:v1',saved=JSON.parse(localStorage.getItem(key));saved.world.pending=[];localStorage.setItem(key,JSON.stringify(saved));});await page.reload();
  await page.locator('#collection').click();await card.locator('.place-treasure').click();await page.locator('.garden-slot[data-slot="0"]').click();assert.equal(await page.locator('.guardian-badge').count(),1);assert.equal(await page.locator('.garden-slot.empty').count(),5);
  await page.locator('#collection').click();assert.match(await card.locator('.guardian-card-badge').textContent(),/爱心助攻与护盾|魔法助攻/);await page.locator('#close-collection').click();
  await battle(page); if (effect === 'heart-shield') { await page.waitForFunction(() => !!document.querySelector('.assist-shot[data-guardian="heart-shot"]')); await page.waitForFunction(()=>document.getElementById('witch-hit-count').textContent==='1 / 3'); await page.waitForFunction(()=>document.getElementById('witch-stage').classList.contains('guardian-shield')); await page.reload(); await page.waitForSelector('#witch-stage[data-action=ready]'); await page.waitForTimeout(1800); assert.equal(await page.locator('#witch-hit-count').textContent(),'1 / 3'); assert.equal(await page.locator('.assist-shot').count(),0); } else { await page.waitForFunction(effect => !!document.querySelector(`.assist-shot[data-guardian="${effect}"]`), effect); await page.waitForFunction(()=>document.getElementById('witch-hit-count').textContent==='1 / 3'); }
  // 移走宝物，收藏仍在，下一场不再助攻。
  await page.evaluate(()=>{const key='75-magic-machine:v1',saved=JSON.parse(localStorage.getItem(key));saved.world.pending=[];localStorage.setItem(key,JSON.stringify(saved));});await page.reload();await page.locator('.garden-remove').click();assert.equal(await page.locator('.guardian-badge').count(),0);
  await page.locator('#collection').click();assert.match(await card.locator('.guardian-card-badge').textContent(),/放进花园后可守护/);await page.locator('#close-collection').click();await battle(page);await noAssist(page);
  assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('75-magic-machine:v1')).inventory[id],id),1);
 }
 assert.deepEqual(errors,[]);console.log('通过：妈妈/超级粑粑仅收藏不助攻、真实摆放一个槽位生效、爱心护盾/彩虹弹道、移走后失效且收藏保留');
}finally{await browser.close();}
