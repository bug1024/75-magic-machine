import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
await mkdir('artifacts/experience',{recursive:true});
const errors=[], url='file://'+process.cwd()+'/index.html';
const seed={version:1,muted:true,history:[],inventory:{'loving-mom':1,'longbao-penguin':1,'super-heart':1},energy:{balance:2,difficulty:'easy'},garden:{slots:['loving-mom','longbao-penguin'],discovered:['ocean-friends']},world:{completedDraws:1,pending:[]}};
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.evaluate(s=>localStorage.setItem('75-magic-machine:v1',JSON.stringify(s)),seed);await page.reload();
 assert.equal(await page.locator('.utilities button:visible').count(),4);
 await page.locator('#settings').click();await page.locator('#cheat').click();assert.equal(await page.locator('#cheat').getAttribute('aria-pressed'),'true');
 await page.keyboard.press('Space');assert.equal(await page.locator('#machine').getAttribute('data-state'),'idle');await page.keyboard.press('Escape');
 await page.locator('#environment').click();await page.locator('#season').click();assert.equal(await page.locator('body').getAttribute('data-season'),'summer');
 await page.locator('#collection').click();await page.locator('#collection-filter').selectOption('owned');assert.equal(await page.locator('.treasure-card').count(),3);
 await page.locator('#collection-sort').selectOption('rarity');assert.equal(await page.locator('.treasure-card').first().getAttribute('data-treasure'),'super-heart');
 await page.locator('#collection-filter').selectOption('missing');assert.equal(await page.locator('.treasure-card').count(),await page.locator('#treasure-config').evaluate(el=>JSON.parse(el.textContent).treasures.length)-Object.keys(seed.inventory).length);await page.keyboard.press('Escape');
 await page.locator('#garden-story-button').click();assert.equal(await page.locator('#garden-story-shade').isVisible(),true);assert.ok(await page.locator('.recipe-companion img').count()>0);
 await page.locator('#garden-story-panel').evaluate(el=>el.scrollTop=el.scrollHeight);const r=await page.locator('#close-garden-stories').boundingBox();assert.ok(r.y>0&&r.y<800);await page.keyboard.press('Escape');assert.ok(await page.locator('#garden-story-panel').isHidden());
 await page.locator('#garden-story-button').click();await page.locator('#garden-story-shade').click({position:{x:1000,y:100}});assert.ok(await page.locator('#garden-story-panel').isHidden());
 // Correct answer grants two hearts and cannot be rewarded a second time.
 await page.locator('#recharge').click();const [_, a, op, b] = (await page.locator('#math-question').textContent()).match(/(\d+)\s*([+−])\s*(\d+)/); const left=Number(a), right=Number(b);
 await page.locator('#math-answer').fill(String(op==='+'?left+right:left-right));await page.waitForFunction(()=>document.querySelector('#power-count').textContent==='4 / 10');await page.keyboard.press('Escape');
 await page.locator('#settings').click();const downloadWait=page.waitForEvent('download');await page.locator('#export-save').click();const download=await downloadWait;const exported=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(exported.save.version,2);assert.equal(exported.save.inventory['loving-mom'],1);
 await page.locator('#import-save').setInputFiles({name:'future.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'75-magic-world',save:{...seed,version:99}}))});assert.ok(await page.locator('#confirm-import').isHidden());await page.waitForFunction(()=>document.querySelector('#import-preview').textContent.includes('不支持')); assert.match(await page.locator('#import-preview').textContent(),/不支持/);
 await page.locator('#import-save').setInputFiles({name:'save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.waitForSelector('#confirm-import');await Promise.all([page.waitForEvent('load'),page.locator('#confirm-import').click()]);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')).version),2);assert.ok(await page.evaluate(()=>!!localStorage.getItem('75-magic-machine:v1:backup')));
 // NEW is persisted until explicitly seen, and cheat resets on reload.
 await page.evaluate(()=>Math.random=()=>0);await page.keyboard.press('Space');await page.waitForSelector('#machine[data-state=result]');await page.locator('#collection').click();await page.locator('#collection-filter').selectOption('owned');assert.equal(await page.locator('.new-badge').count(),1);await page.locator('.new-badge').click();await page.keyboard.press('Escape');
 await page.setViewportSize({width:375,height:812});await page.locator('#collection').click();await page.screenshot({path:'artifacts/experience/collection-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.keyboard.press('Escape');
 await page.locator('#garden-story-button').click();await page.screenshot({path:'artifacts/experience/story-mobile.png'});await page.keyboard.press('Escape');
 // 首次故事补能时同步恢复启动按钮，刷新不会重复奖励。
 await page.evaluate(()=>localStorage.setItem('75-magic-machine:v1',JSON.stringify({version:2,history:[],inventory:{'star-seed':1,'singing-mushrooms':1},muted:true,energy:{balance:0},world:{completedDraws:0,pending:[]},garden:{slots:['star-seed','singing-mushrooms']}})));await page.reload();await page.waitForSelector('#garden-story-stage[data-effect=forest]:not([hidden])');assert.equal(await page.locator('#power-count').textContent(),'1 / 10');assert.equal(await page.locator('#button-text').textContent(),'开启魔法');await page.reload();assert.equal(await page.locator('#power-count').textContent(),'1 / 10');
 assert.deepEqual(errors,[]);console.log('Experience browser checks passed: filters, settings, stories, charging, migration, import/export, NEW and mobile.');
} finally { await browser.close(); }
