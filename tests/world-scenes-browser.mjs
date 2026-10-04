import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}),url='file://'+process.cwd()+'/index.html',errors=[];
await mkdir('artifacts/world-scenes',{recursive:true});
async function seed(page,{balance=5,count=40,pending=[],slots=[],inventory={},discovered=[]}={}){
 await page.goto(url);await page.evaluate(saved=>localStorage.setItem('75-magic-machine:v1',JSON.stringify(saved)),{version:1,muted:true,history:[],inventory,energy:{balance,difficulty:'easy'},world:{completedDraws:count,sinceEvent:0,lastWitchDraw:count,pending},garden:{slots,discovered}});await page.reload();
}
async function hit(page){await page.waitForFunction(()=>!document.querySelector('#witch-target').hidden&&!document.querySelector('#witch-target').disabled);await page.locator('#witch-target').click();await page.waitForFunction(()=>!document.querySelector('.witch-shot'));}
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await seed(page,{balance:2,pending:[{kind:'event',id:'fairy',giftId:'cloud-dolphin'}]});
 await page.waitForSelector('#world-visitor[data-action=visiting]');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('#power-count').textContent(),'7 / 10');
 await page.keyboard.press('Space');assert.equal(await page.locator('#power-count').textContent(),'7 / 10');await page.screenshot({path:'artifacts/world-scenes/fairy.png'});
 await page.waitForSelector('#world-visitor[data-action=departing]');await page.waitForFunction(()=>document.getElementById('world-visitor').hidden);assert.equal(await page.locator('#draw').isDisabled(),false);
 await page.reload();assert.equal(await page.locator('#power-count').textContent(),'7 / 10');assert.equal(await page.locator('#world-visitor').isVisible(),false);
 await seed(page,{balance:8,pending:[{kind:'event',id:'fairy'}]});await page.waitForSelector('#world-visitor[data-action=visiting]');assert.equal(await page.locator('#power-count').textContent(),'10 / 10');
 await seed(page,{balance:10,pending:[{kind:'event',id:'fairy',giftId:'cloud-dolphin'}]});await page.waitForSelector('#world-visitor[data-action=visiting]');assert.equal(await page.locator('#visitor-gift img').count(),1);assert.equal(await page.locator('#collection-count').textContent(),'1');await page.reload();assert.equal(await page.locator('#collection-count').textContent(),'1');
 await seed(page,{balance:5,pending:[{kind:'event',id:'ghost'}]});await page.waitForSelector('#world-visitor[data-action=visiting]');assert.equal(await page.locator('#power-count').textContent(),'4 / 10');await page.screenshot({path:'artifacts/world-scenes/ghost.png'});
 await seed(page,{balance:3,pending:[{kind:'event',id:'ghost'}]});await page.waitForSelector('#world-visitor[data-action=visiting]');assert.equal(await page.locator('#power-count').textContent(),'3 / 10');
 // 生命树继承形态，四种新天气能从真实顶部按钮选择。
 await seed(page,{count:50});await page.waitForTimeout(900);for(const selector of ['.machine-rainbow','.machine-wing','.castle-roof','.life-tree'])assert.ok(await page.locator(selector).first().evaluate(el=>getComputedStyle(el).display!=='none'&&getComputedStyle(el).opacity!=='0'));
 const all=['rain','snow','wind','meteors','icecream','coins','sakura','storm'];
 for(const kind of all.slice(4)){
  const current=await page.locator('body').getAttribute('data-weather'), choices=all.filter(k=>k!==current),random=(choices.indexOf(kind)+.1)/choices.length;
  await page.evaluate(random=>{const natural=window.sceneRandom ||= Math.random;let first=true;Math.random=()=>{if(first){first=false;return random}return natural();};},random);await page.locator('#weather').click();assert.equal(await page.locator('body').getAttribute('data-weather'),kind);assert.ok(await page.locator('#weather-layer i').count());await page.screenshot({path:`artifacts/world-scenes/${kind}.png`});
 }
 // 有多个守护者也只自动命中一次，最后一击由玩家完成；刷新不恢复助攻。
 const guards=['pretty-magic-wand','moon-blaster'];
 await seed(page,{balance:0,count:40,pending:[{kind:'witch',opponent:'bat',hits:0,giftId:'cloud-dolphin'}],slots:guards,inventory:Object.fromEntries(guards.map(id=>[id,1])),discovered:['magic-ball']});
 await page.waitForSelector('.assist-shot');const from=await page.locator('.assist-shot').evaluate(el=>parseFloat(el.style.getPropertyValue('--from-x')));const plot=await page.locator('.garden-slot').first().boundingBox();assert.ok(Math.abs(from-(plot.x+plot.width/2-25))<2);
 await page.waitForFunction(()=>document.getElementById('witch-hit-count').textContent==='1 / 3');const snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('75-magic-machine:v1')));assert.equal(snapshot.world.pending[0].assistUsed,true);assert.equal(snapshot.world.pending[0].opponent,'bat');
 assert.equal(await page.locator('dialog[open]').count(),0);await page.screenshot({path:'artifacts/world-scenes/bat-assist.png'});await page.reload();await page.waitForSelector('#witch-stage[data-action=ready]');await page.waitForTimeout(1400);assert.equal(await page.locator('#witch-hit-count').textContent(),'1 / 3');assert.equal(await page.locator('.assist-shot').count(),0);
 await hit(page);assert.equal(await page.locator('#witch-hit-count').textContent(),'2 / 3');await page.waitForTimeout(1800);assert.equal(await page.locator('#witch-hit-count').textContent(),'2 / 3');await hit(page);await page.waitForSelector('#witch-stage[data-action=fleeing]');assert.match(await page.locator('#witch-title').textContent(),/蝙蝠/);await page.waitForSelector('#witch-stage[data-action=won]');assert.equal(await page.locator('#collection-count').textContent(),'3');assert.equal(await page.locator('#power-count').textContent(),'0 / 10');await page.locator('#witch-continue').click();await page.reload();assert.equal(await page.locator('#collection-count').textContent(),'3');
 // 普通宝物不助攻。
 await seed(page,{pending:[{kind:'witch',opponent:'bat',hits:0,giftId:'cloud-dolphin'}],slots:['cloud-dolphin'],inventory:{'cloud-dolphin':1}});await page.waitForSelector('#witch-stage[data-action=ready]');await page.waitForTimeout(1300);assert.equal(await page.locator('#witch-hit-count').textContent(),'0 / 3');
 const mobile=await browser.newPage({viewport:{width:320,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});mobile.on('pageerror',e=>errors.push(e.message));await seed(mobile,{pending:[{kind:'event',id:'fairy'}]});await mobile.waitForSelector('#world-visitor[data-action=visiting]');assert.equal(await mobile.locator('#world-visitor').evaluate(el=>getComputedStyle(el).animationName),'none');await mobile.screenshot({path:'artifacts/world-scenes/mobile-fairy.png'});
 await seed(mobile,{count:50});assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.screenshot({path:'artifacts/world-scenes/mobile-life.png',fullPage:true});
 await seed(mobile,{pending:[{kind:'witch',opponent:'bat',hits:2,assistUsed:false,giftId:'cloud-dolphin'}],slots:['moon-blaster'],inventory:{'moon-blaster':1}});await mobile.waitForSelector('#witch-stage[data-action=ready]');await mobile.waitForTimeout(900);assert.equal(await mobile.locator('.assist-shot').count(),0);await mobile.locator('#witch-target').tap();await mobile.waitForSelector('#witch-stage[data-action=won]');assert.match(await mobile.locator('#witch-title').textContent(),/蝙蝠/);
 for(const kind of ['icecream','coins','sakura','storm','bat-arrive']){const audio=await page.evaluate(async kind=>{const ctx=new OfflineAudioContext(1,44100*3,44100),s=new MagicAudio(()=>false);s.setup(ctx);s.ready=()=>true;if(kind==='bat-arrive')s.encounter(kind);else s.weather(kind);let peak=0;for(const v of (await ctx.startRendering()).getChannelData(0))peak=Math.max(peak,Math.abs(v));return{peak,voices:s.voices.size};},kind);assert.ok(audio.peak>.01&&audio.peak<.98);assert.equal(audio.voices,0);}
 assert.deepEqual(errors,[]);console.log('通过：主场景仙子/幽灵飞入飞走、+5与上限/低能量保护、生命树继承形态、4种新天气、蝙蝠/花圃助攻/一次上限/刷新/最后一击、触摸与简化动画、音效回收');
}finally{await browser.close();}
