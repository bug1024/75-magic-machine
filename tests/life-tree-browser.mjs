import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}), url='file://'+process.cwd()+'/index.html', errors=[];
await mkdir('artifacts/life-tree',{recursive:true});
async function seed(page,count,pending=[]){
 await page.goto(url); await page.evaluate(({count,pending})=>localStorage.setItem('75-magic-machine:v1',JSON.stringify({version:1,muted:true,history:[],energy:{balance:10,difficulty:'easy'},world:{completedDraws:count,lastWitchDraw:count,witchWait:0,sinceEvent:0,pending}})),{count,pending});await page.reload();
}
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>Math.random=()=>.5);
 await seed(page,49);assert.equal(await page.locator('#machine').getAttribute('data-level'),'castle');
 await page.keyboard.press('Space');await page.waitForSelector('#life-upgrade-banner:not([hidden])');
 assert.equal(await page.locator('dialog[open]').count(),0);await page.waitForSelector('#machine[data-level=life].life-awakening');
 await page.waitForTimeout(1600);await page.screenshot({path:'artifacts/life-tree/growing.png'});
 await page.keyboard.press('Space');assert.equal(await page.locator('#power-count').textContent(),'9 / 10');
 await page.waitForFunction(()=>document.getElementById('life-upgrade-banner').hidden);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')));assert.equal(saved.world.completedDraws,50);assert.equal(saved.world.pending.length,0);assert.equal(await page.locator('#collection-count').textContent(),'1');
 await page.reload();assert.equal(await page.locator('#machine').getAttribute('data-level'),'life');assert.equal(await page.locator('#life-upgrade-banner').isVisible(),false);
 assert.equal(await page.locator('.life-tree').evaluate(el=>getComputedStyle(el).display),'block');
 for(const season of ['spring','summer','autumn','winter']){
  await page.evaluate(season=>document.body.dataset.season=season,season);await page.screenshot({path:`artifacts/life-tree/${season}.png`});
 }
 await page.evaluate(()=>document.body.dataset.time='night');await page.screenshot({path:'artifacts/life-tree/night.png'});
 await page.keyboard.press('Space');await page.waitForSelector('#machine[data-state=mixing]');assert.equal(await page.locator('.life-canopy').evaluate(el=>getComputedStyle(el).animationDuration),'1.4s');
 await page.waitForSelector('#machine[data-state=result]');assert.equal(await page.locator('#life-upgrade-banner').isVisible(),false);
 // 未结算的旧队列恢复仪式；已累计50次的旧存档直接恢复形态。
 await seed(page,50,[{kind:'upgrade',level:'life'}]);await page.waitForSelector('#life-upgrade-banner:not([hidden])');await page.waitForSelector('#machine.life-awakening');await page.reload();assert.equal(await page.locator('#machine').getAttribute('data-level'),'life');assert.equal(await page.locator('#life-upgrade-banner').isVisible(),false);
 await seed(page,80);assert.equal(await page.locator('#machine').getAttribute('data-level'),'life');
 const colors=[];
 for(const season of ['spring','summer','autumn','winter']){colors.push(await page.evaluate(season=>{document.body.dataset.season=season;return getComputedStyle(document.querySelector('.life-tree')).getPropertyValue('--tree-leaf');},season));}assert.equal(new Set(colors).size,4);
 for(const width of [320,390]){
  const mobile=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});mobile.on('pageerror',e=>errors.push(e.message));await seed(mobile,50);
  assert.equal(await mobile.locator('.life-canopy').evaluate(el=>getComputedStyle(el).animationName),'none');assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.screenshot({path:`artifacts/life-tree/mobile-${width}.png`,fullPage:true});await mobile.close();
 }
 const audio=await page.evaluate(async()=>{
  const results=[];for(const level of ['starlight','rainbow','winged','castle','life']){const ctx=new OfflineAudioContext(1,44100*5,44100),a=new MagicAudio(()=>false);a.setup(ctx);a.ready=()=>true;a.start(level);a.mixing(1);a.land();a.knock(2);a.charge();a.celebrate('magic-chime',true);let peak=0,sum=0;for(const v of (await ctx.startRendering()).getChannelData(0)){peak=Math.max(peak,Math.abs(v));sum+=v*v;}results.push({peak,sum,voices:a.voices.size});}return results;
 });assert.equal(new Set(audio.map(a=>a.sum.toFixed(4))).size,5);for(const a of audio){assert.ok(a.peak>.01&&a.peak<.98);assert.equal(a.voices,0);}
 const ceremony=await page.evaluate(async()=>{const ctx=new OfflineAudioContext(1,44100*5,44100),a=new MagicAudio(()=>false);a.setup(ctx);a.ready=()=>true;a.encounter('upgrade-life');let peak=0;for(const v of (await ctx.startRendering()).getChannelData(0))peak=Math.max(peak,Math.abs(v));return {peak,voices:a.voices.size};});assert.ok(ceremony.peak>.01&&ceremony.peak<.98);assert.equal(ceremony.voices,0);
 assert.deepEqual(errors,[]);console.log('生命树：真实第50次升级、主屏幕生长、输入锁定、存档续演与不重复升级、四季/夜晚、320/390手机柔和动画、五级机器音效和仪式音效通过');
}finally{await browser.close();}
