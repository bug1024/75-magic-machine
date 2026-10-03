import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir('artifacts/day-night', { recursive: true });
const errors = [];
try {
 const page = await browser.newPage({ viewport: { width:1280,height:800 } });page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+process.cwd()+'/index.html');
 assert.equal(await page.locator('body').getAttribute('data-time'),'day');
 for (const id of ['day-night','weather','cheat']) assert.ok(await page.locator('#'+id).evaluate(el => !!el.closest('.topbar')));
 assert.equal(await page.locator('.bottom').evaluate(el=>getComputedStyle(el).position),'fixed');
 await page.screenshot({path:'artifacts/day-night/day.png'});
 const windowHeight = await page.locator('#window').evaluate(el=>el.getBoundingClientRect().height);
 await page.locator('#day-night').click();assert.equal(await page.locator('body').getAttribute('data-time'),'night');
 await page.reload();assert.equal(await page.locator('body').getAttribute('data-time'),'night');
 await page.screenshot({path:'artifacts/day-night/night.png'});
 await page.locator('#fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);
 assert.equal(await page.locator('.intro').isVisible(),false);assert.equal(await page.locator('.wordmark').isVisible(),false);
 assert.equal(await page.locator('#window').evaluate(el=>el.getBoundingClientRect().height),windowHeight);
 assert.equal(await page.locator('#fullscreen').isVisible(),true);
 await page.screenshot({path:'artifacts/day-night/fullscreen.png'});
 await page.locator('#fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);
 assert.equal(await page.locator('.intro').isVisible(),true);
 await page.evaluate(()=>localStorage.setItem('75-magic-machine:v1',JSON.stringify({version:1,muted:true,world:{completedDraws:35,sinceEvent:0,pending:[]}})));await page.reload();
 for(const [width,height] of [[1280,720],[1280,800],[390,844],[320,720]]){
   await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`artifacts/day-night/castle-${width}-${height}.png`,fullPage:true});
 }
 // 加速昼夜时钟验证自动交替和后台暂停。
 await page.evaluate(()=>{const config=JSON.parse(document.getElementById('game-config').textContent);const garden=new MagicGarden({...config.weather,enabled:false},null,[],[],{canPlay:()=>true,canWeather:()=>!window.paused,save:()=>{},art:()=>{},unlock:async()=>{},sound:()=>{},weatherSound:()=>{}},{durationMs:10000});garden.dayElapsed=9990;window.clockGarden=garden;window.paused=true;});
 await page.waitForTimeout(100);assert.equal(await page.locator('body').getAttribute('data-time'),'day');
 await page.evaluate(()=>window.paused=false);await page.waitForFunction(()=>document.body.dataset.time==='night');
 assert.deepEqual(errors,[]);console.log('昼夜切换、保存、自动交替/暂停、真实全屏、窗口尺寸与手机布局通过');
}finally{await browser.close()}
