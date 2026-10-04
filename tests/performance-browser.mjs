import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.perfCounts={raf:0,clear:0,transforms:0};const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>{perfCounts.raf++;cb(t)});const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){perfCounts.clear++;return clear.apply(this,args)};Math.random=()=>0;});
 await page.goto('file://'+process.cwd()+'/index.html');
 await page.evaluate(()=>new MutationObserver(rs=>perfCounts.transforms+=rs.length).observe(document.querySelector('#magic-balls'),{attributes:true,subtree:true,attributeFilter:['style']}));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
 async function idle(label){await page.waitForTimeout(2000);const start=await cdp.send('Performance.getMetrics');await page.evaluate(()=>window.perfCounts={raf:0,clear:0,transforms:0});await page.waitForTimeout(3000);const end=await cdp.send('Performance.getMetrics');const counts=await page.evaluate(()=>perfCounts);const task=m=>m.metrics.find(m=>m.name==='TaskDuration').value;assert.equal(counts.raf,0,`${label}不能永久刷新动画帧`);assert.equal(counts.clear,0,`${label}不能重绘空画布`);assert.equal(counts.transforms,0,`${label}不能反复写机舱样式`);return {...counts,taskMs:Math.round((task(end)-task(start))*1000)};}
 const results={idle:await idle('待机')};
 assert.ok(await page.locator('#particles').evaluate(el=>el.width*el.height<=3000000+5000));
 await page.keyboard.press('Space');await page.waitForSelector('#machine[data-state=mixing]');await page.waitForTimeout(300);assert.ok((await page.evaluate(()=>perfCounts)).transforms>0,'抽奖时必须恢复真实机舱运动');await page.waitForSelector('#machine[data-state=result]');
 await page.waitForTimeout(2000);results.result=await idle('开奖后');
 await page.waitForFunction(()=>document.body.classList.contains('scene-resting'));assert.ok(await page.locator('.lamp,.machine-wing svg,#treasure-art img,.light-strip').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).animationPlayState==='paused')),'静置时暂停装饰及其子元素的 CSS 动画');await page.locator('#treasure-art').click();assert.ok(!await page.locator('body').evaluate(el=>el.classList.contains('scene-resting')));await page.waitForTimeout(200);assert.ok((await page.evaluate(()=>perfCounts)).clear>0,'点宝物必须唤醒粒子');
 await page.waitForTimeout(1500);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(200);await page.evaluate(()=>window.perfCounts={raf:0,clear:0,transforms:0});await page.waitForTimeout(1000);assert.equal((await page.evaluate(()=>perfCounts)).raf,0,'后台暂停调度');await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 assert.deepEqual(errors,[]);await mkdir('artifacts/performance',{recursive:true});await writeFile('artifacts/performance/results.json',JSON.stringify(results,null,2));console.log('Performance checks passed:',JSON.stringify(results));
}finally{await browser.close();}
