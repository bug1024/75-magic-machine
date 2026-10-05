import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const stories=JSON.parse(await readFile('garden-stories.json','utf8')).stories,wishes=JSON.parse(await readFile('garden-wishes.json','utf8')).wishes;
 await page.addInitScript(({stories,wishes})=>localStorage.setItem('75-magic-machine:v1',JSON.stringify({version:2,history:[],inventory:{},muted:true,energy:{balance:10},world:{completedDraws:40,pending:[]},garden:{slots:[],discovered:stories.map(s=>s.id),adventures:{weatherWins:['rain','snow','wind','meteors','icecream','coins','sakura','storm']},wishes:{completed:wishes.map(s=>s.id)},workshop:{guardWon:true}}})),{stories,wishes});
 await page.goto('file://'+process.cwd()+'/index.html');await page.evaluate(()=>{const original=GardenAdventures.prototype.layoutMemories;GardenAdventures.prototype.layoutMemories=function(...args){window.layoutAdventures=this;return original.apply(this,args);};});await mkdir('artifacts/garden-layout',{recursive:true});
 for(const width of [1280,900,375,320]){
  await page.setViewportSize({width,height:900});
  const menu=page.locator('.garden-challenge-menu'),summary=menu.locator('summary');
  const before=await summary.boundingBox();await summary.click();assert.equal(await menu.getAttribute('open'),'');
  const after=await summary.boundingBox();assert.ok(Math.abs(before.y-after.y)<1);
  await summary.click();assert.equal(await menu.getAttribute('open'),null);
  await summary.click();await page.locator('#challenge-close').click();assert.equal(await menu.getAttribute('open'),null);
  await summary.click();await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('open'),null);
  await summary.click();await page.locator('.intro h1').click({force:true});assert.equal(await menu.getAttribute('open'),null);
  const seen=new Set();let height;
  for(;;){
   await page.waitForTimeout(100);
   const visible=await page.locator('.garden-keepsake:not([hidden])').evaluateAll(nodes=>nodes.map(el=>({id:el.dataset.memory,x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right})));
   visible.forEach(item=>{seen.add(item.id);assert.ok(item.x>=0&&item.right<=width+.5);});
   const rect=await page.locator('#garden-keepsakes').boundingBox();if(height!==undefined)assert.ok(Math.abs(rect.height-height)<2);else height=rect.height;
   if(await page.locator('.memory-page-button').last().isDisabled())break;
   await page.locator('.memory-page-button').last().click();
  }
  assert.equal(seen.size,await page.locator('.garden-keepsake').count());
  await page.evaluate(()=>layoutAdventures.revealMemory('music-flowers'));assert.ok(await page.locator('[data-memory=music-flowers]').isVisible());
  assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth));
  await page.screenshot({path:`artifacts/garden-layout/${width}.png`,fullPage:true});
  while(!await page.locator('.memory-page-button').first().isDisabled())await page.locator('.memory-page-button').first().click();
 }
 assert.deepEqual(errors,[]);console.log('Garden layout: stationary challenge entry, four closing paths, all memories reachable with bounded one-row pagination at desktop/mobile widths.');
}finally{await browser.close();}
