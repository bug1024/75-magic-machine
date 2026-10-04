import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>Math.random=()=>.999);
 await page.goto('file://'+process.cwd()+'/index.html');
 await page.evaluate(()=>localStorage.setItem('75-magic-machine:v1',JSON.stringify({version:1,history:[],inventory:{},muted:true,energy:{balance:10},world:{completedDraws:9,pending:[]},garden:{slots:[]}})));await page.reload();
 await page.keyboard.press('Space');await page.waitForSelector('#machine[data-state=result]');
 assert.equal(await page.locator('#draw').isDisabled(),false);assert.ok(await page.locator('#world-dialog').isHidden());
 await page.locator('#treasure-art').click();assert.ok(await page.locator('#world-dialog').isHidden());
 // 在超级宝物的纯净时间里依然可以继续抽奖，原升级不会丢失或重复。
 await page.keyboard.press('Space');assert.equal(await page.locator('#machine').getAttribute('data-state'),'charging');await page.waitForSelector('#machine[data-state=result]');
 const pending=await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')).world);assert.equal(pending.completedDraws,11);assert.equal(pending.pending.length,1);assert.equal(pending.pending[0].kind,'upgrade');
 await page.locator('#collection').click();await page.waitForTimeout(5300);assert.ok(await page.locator('#world-dialog').isHidden());await page.keyboard.press('Escape');
 await page.waitForSelector('#world-dialog.acted');await page.locator('#continue-world').click();assert.ok(await page.locator('#world-dialog').isHidden());
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')).world.pending.length),0);
 // 较新格式不会被当前版本静默覆盖。
 await page.evaluate(()=>localStorage.setItem('75-magic-machine:v1',JSON.stringify({version:99,history:[],inventory:{a:1}})));await page.reload();await page.locator('#sound').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')).version),99);
 assert.deepEqual(errors,[]);console.log('Pacing browser checks passed: quiet reveal, active interactions, successive draws, paused overlays, queued upgrade and future-save protection.');
}finally{await browser.close();}
