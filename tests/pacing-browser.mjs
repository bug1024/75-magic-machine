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
 // 连续按空格优先演出已排队升级，不再被第二次抽奖重置欣赏时间。
 assert.equal(await page.locator('#button-text').textContent(),'看看新魔法');
 const energyBefore=await page.locator('#power-count').textContent();
 await page.keyboard.press('Space');await page.waitForSelector('#world-dialog.acted');
 const settled=await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')));
 assert.equal(settled.world.completedDraws,10);assert.equal(await page.locator('#power-count').textContent(),energyBefore);
 assert.equal(await page.locator('#machine').getAttribute('data-level'),'rainbow');
 await page.locator('#continue-world').click();
 // 弹层仍暂停自动演出，关闭后无需再次抽奖就能继续。
 await page.evaluate(()=>localStorage.setItem('75-magic-machine:v1',JSON.stringify({version:2,history:[],inventory:{},muted:true,energy:{balance:10},world:{completedDraws:19,pending:[]},garden:{slots:[]}})));await page.reload();
 await page.keyboard.press('Space');await page.waitForSelector('#machine[data-state=result]');
 await page.locator('#collection').click();await page.waitForTimeout(5300);assert.ok(await page.locator('#world-dialog').isHidden());await page.keyboard.press('Escape');
 await page.waitForSelector('#world-dialog.acted');await page.locator('#continue-world').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')).world.pending.length),0);
 // 较新格式不会被当前版本静默覆盖。
 await page.evaluate(()=>localStorage.setItem('75-magic-machine:v1',JSON.stringify({version:99,history:[],inventory:{a:1}})));await page.reload();await page.locator('#sound').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')).version),99);
 // 绘制帧暂停或极低频时，前台流程计时仍必须完成；后台停表另由性能测试验证。
 const stalledFrames=await browser.newPage();stalledFrames.on('pageerror',e=>errors.push(e.message));
 await stalledFrames.addInitScript(()=>{requestAnimationFrame=()=>0;localStorage.setItem('75-magic-machine:v1',JSON.stringify({version:2,history:[],inventory:{},muted:true,energy:{balance:10},world:{completedDraws:9,pending:[]}}));});
 await stalledFrames.goto('file://'+process.cwd()+'/index.html');await stalledFrames.keyboard.press('Space');await stalledFrames.waitForSelector('#machine[data-state=result]');
 assert.equal(await stalledFrames.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')).world.completedDraws),10);await stalledFrames.keyboard.press('Space');await stalledFrames.waitForSelector('#world-dialog.acted');await stalledFrames.close();
 assert.deepEqual(errors,[]);console.log('Pacing browser checks passed: quiet reveal, active interactions, pending-scene priority, paused overlays, queued upgrade and future-save protection.');
}finally{await browser.close();}
