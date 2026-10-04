import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {}),headless:true}),errors=[];
try {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+process.cwd()+'/index.html');
 // 真正渲染36件宝物的声音的四种互动，检查非静音、无削波、节点回收、分支区别。
 const results=await page.evaluate(async()=>{
  const treasures=normalizeConfig(JSON.parse(document.getElementById('treasure-config').textContent));const results=[];
  for(const treasure of treasures){const variants=[];let baseline;
   for(const reaction of treasure.effects.reactions){
    const ctx=new OfflineAudioContext(1,44100*3,44100),audio=new MagicAudio(()=>false);audio.setup(ctx);audio.ready=()=>true;
    audio.treasureSound=()=>{throw Error('点击不应调用开奖声音')};audio.interact(treasure,1,reaction);
    const data=(await ctx.startRendering()).getChannelData(0);let peak=0,energy=0,signature=0,difference=0;
    for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));energy+=data[i]*data[i];if(baseline)difference+=(data[i]-baseline[i])**2;if(i%101===0)signature+=Math.abs(data[i])*(i%17+1);}
    if(!baseline)baseline=data;variants.push({peak,energy,signature,difference,voices:audio.voices.size});
   }
   results.push({id:treasure.id,profile:treasure.effects.interactionSound,variants});
  }return results;
 });
 assert.equal(results.length,36);assert.equal(new Set(results.map(r=>r.profile)).size,36);
 for(const r of results){for(const v of r.variants){assert.ok(v.peak>.005&&v.peak<.95,`${r.id}: peak ${v.peak}`);assert.equal(v.voices,0);}assert.ok(r.variants[1].difference/Math.max(r.variants[0].energy,.0001)>.05,`${r.id} 分支应有声音变化`);}
 // 真实开奖后的点击、Enter及花园点击，都传入宝物与具体分支，且不重播中奖函数。
 if(await page.locator('#sound').getAttribute('aria-pressed')!=='true')await page.locator('#sound').click();await page.keyboard.press('Space');await page.waitForSelector('#machine[data-state=result]'); const drawnEnergy = await page.locator('#power-count').textContent();
 await page.evaluate(()=>{window.originalTreasureSound=MagicAudio.prototype.treasureSound;window.playCalls=[];const original=MagicAudio.prototype.interact;MagicAudio.prototype.interact=function(t,c,r){original.call(this,t,c,r);window.playCalls.push({id:t.id,profile:t.effects.interactionSound,reaction:r?.id,voices:this.voices.size})};MagicAudio.prototype.treasureSound=()=>{throw Error('互动误用了开奖音效')};});
 await page.locator('#treasure-art').click();await page.waitForFunction(()=>window.playCalls.length===1);await page.waitForTimeout(2500);await page.locator('#treasure-art').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.playCalls.length===2);
 const calls=await page.evaluate(()=>window.playCalls);assert.ok(calls.every(c=>c.voices>0),'真实点击应创建音频节点');assert.equal(calls[0].id,calls[1].id);assert.notEqual(calls[0].reaction,calls[1].reaction);assert.equal(await page.locator('#power-count').textContent(),drawnEnergy);assert.equal(await page.locator('#collection-count').textContent(),'1');
 await page.evaluate(()=>MagicAudio.prototype.treasureSound=window.originalTreasureSound);await page.locator('#collection').click();await page.locator('.treasure-card:not(.uncollected) .place-treasure').click();await page.locator('.garden-slot[data-slot="0"]').click();await page.evaluate(()=>MagicAudio.prototype.treasureSound=()=>{throw Error('花园互动误用了开奖音效')});await page.locator('.garden-slot[data-slot="0"]').click();await page.waitForFunction(()=>window.playCalls.length===3);assert.equal((await page.evaluate(()=>window.playCalls))[2].profile,calls[0].profile);
 await page.evaluate(async()=>{const ctx=new OfflineAudioContext(1,44100,44100),audio=new MagicAudio(()=>true);audio.setup(ctx);const treasure=normalizeConfig(JSON.parse(document.getElementById('treasure-config').textContent))[0];audio.interact(treasure);if(audio.voices.size)throw Error('静音时创建了声音');});
 assert.deepEqual(errors,[]);console.log('通过：36件宝物×4分支实际合成、分支差异、音量/无削波/节点回收、真实开奖与花园点击/Enter接入、静音、无重复开奖音效');
}finally{await browser.close();}
