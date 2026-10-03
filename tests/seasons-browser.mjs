import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel:'chrome',headless:true });
await mkdir('artifacts/seasons',{recursive:true});const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+process.cwd()+'/index.html');
 const height=await page.locator('#window').evaluate(el=>el.getBoundingClientRect().height);
 const colors=[];
 for(const season of ['spring','summer','autumn','winter']){
  assert.equal(await page.locator('body').getAttribute('data-season'),season);
  await page.waitForTimeout(1600);
  colors.push(await page.locator('.tree-light').evaluate(el=>getComputedStyle(el).stopColor));
  assert.equal(await page.locator('#window').evaluate(el=>el.getBoundingClientRect().height),height);
  await page.screenshot({path:`artifacts/seasons/${season}.png`});
  if(season!=='winter')await page.locator('#season').click();
 }
 assert.equal(new Set(colors).size,4);
 await page.reload();assert.equal(await page.locator('body').getAttribute('data-season'),'winter');
 await page.locator('#day-night').click();await page.waitForTimeout(1600);await page.screenshot({path:'artifacts/seasons/winter-night.png'});
 const collision=()=>{const a=document.querySelector('.garden-celestial').getBoundingClientRect(),b=document.querySelector('.utilities').getBoundingClientRect();return a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;};
 assert.equal(await page.evaluate(collision),false);
 const machineBottom=await page.locator('#machine').evaluate(el=>el.getBoundingClientRect().bottom);assert.ok(machineBottom>720&&machineBottom<800);
 await page.locator('#fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);assert.equal(await page.evaluate(collision),false);await page.screenshot({path:'artifacts/seasons/fullscreen.png'});await page.locator('#fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:720});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.evaluate(collision),false);assert.equal(await page.evaluate(()=>{const a=document.querySelector('#collection').getBoundingClientRect(),b=document.querySelector('#recharge').getBoundingClientRect();return a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;}),false);await page.screenshot({path:`artifacts/seasons/mobile-${width}.png`,fullPage:true});}
 await page.evaluate(()=>{window.seasonPaused=true;const garden=new MagicGarden({enabled:false},null,[],[],{canPlay:()=>true,canWeather:()=>!window.seasonPaused,save:()=>{},art:()=>{},unlock:async()=>{},weatherSound:()=>{},sound:()=>{}},{enabled:false},{durationMs:10000});garden.seasonElapsed=9990;});
 await page.waitForTimeout(100);assert.equal(await page.locator('body').getAttribute('data-season'),'spring');await page.evaluate(()=>window.seasonPaused=false);await page.waitForFunction(()=>document.body.dataset.season==='summer');assert.deepEqual(errors,[]);console.log('四季颜色、存档、自动轮换/暂停、日夜与季节组合、落地位置、手机/全屏控件避让通过');
}finally{await browser.close()}
