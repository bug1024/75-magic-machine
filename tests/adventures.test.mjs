import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FINALE_AT,CROWN_ID,normalizeFinale,nextFinaleStage,finaleTap,normalizeAdventureRules,normalizeAdventureState} from '../src/adventure-engine.mjs';
import {normalizeWorldState,normalizeWorldRules,advanceWorld} from '../src/world-engine.mjs';
import {normalizeConfig,drawTreasure,normalizeInventory} from '../src/engine.mjs';
import {normalizeStoryRules,normalizeGardenState} from '../src/garden-engine.mjs';
const rules=normalizeWorldRules(JSON.parse(await readFile('game-config.json','utf8')).world);
test('第75次独占终章，保留旧队列；普通赠品和皇冠不增加抽奖次数',()=>{
 const state=normalizeWorldState({completedDraws:74,pending:[{kind:'event',id:'fairy'}]},[],rules);
 const next=advanceWorld(state,rules,9,3,()=>0);assert.equal(next.completedDraws,FINALE_AT);assert.equal(next.pending[0].kind,'finale');assert.equal(next.pending[1].id,'fairy');
 assert.equal(advanceWorld(next,rules,9,3,()=>0).pending.filter(p=>p.kind==='finale').length,1);
 assert.equal(normalizeWorldState(null,[{source:'event'},{source:'finale'},{source:'draw'},{}],rules).completedDraws,2);
});
test('旧存档补看终章、结束后不重触发；阶段与点击进度恢复且限幅',()=>{
 for(const n of [75,100,1000])assert.equal(normalizeWorldState({completedDraws:n},[],rules).pending[0].kind,'finale');
 const saved=normalizeWorldState({completedDraws:75,finale:{stage:'love',progress:2},pending:[{kind:'finale'},{kind:'finale'}]},[],rules);assert.equal(saved.finale.progress,2);assert.equal(saved.pending.length,1);
 const complete=normalizeWorldState({completedDraws:99,finale:{complete:true},pending:[{kind:'finale'}]},[],rules);assert.equal(complete.pending.length,0);assert.deepEqual(complete.finale.redeemed,['bat','witch','rock','dragon']);assert.ok(!advanceWorld(complete,rules,9,3,()=>.99).pending.some(p=>p.kind==='finale'));
 assert.equal(normalizeFinale({stage:'invalid',progress:99}).stage,'gather');assert.equal(normalizeFinale({stage:'love',progress:99}).progress,3);
 let finale={...normalizeFinale(null),stage:'seal'};for(let i=0;i<10;i++)finale=finaleTap(finale);assert.equal(finale.progress,3);assert.equal(nextFinaleStage(finale).stage,'love');assert.equal(nextFinaleStage(finale).progress,0);
});
test('唯一皇冠不能正常抽取或作弊抽取；库存数量受限',async()=>{
 const treasures=normalizeConfig(JSON.parse(await readFile('treasures.json','utf8')));assert.equal(treasures.find(t=>t.id===CROWN_ID).weight,0);
 for(const equalProbability of [true,false])for(let i=0;i<=1000;i++)assert.notEqual(drawTreasure(treasures,()=>i/1000,{equalProbability,preferUnowned:true,inventory:{}}).id,CROWN_ID);
 assert.equal(normalizeInventory({[CROWN_ID]:9},[])[CROWN_ID],1);assert.equal(normalizeInventory(null,Array(9).fill({prizeId:CROWN_ID}))[CROWN_ID],1);
});
test('每个故事都有唯一遗物，八种天气都有纪念物；旧花园兼容且过滤非法天气',async()=>{
 const stories=normalizeStoryRules(JSON.parse(await readFile('garden-stories.json','utf8')));assert.equal(stories.length,10);assert.ok(stories.every(s=>s.keepsake));assert.equal(new Set(stories.map(s=>s.keepsake.id)).size,10);
 const weather=normalizeAdventureRules(JSON.parse(await readFile('garden-adventures.json','utf8')));assert.equal(weather.length,8);assert.ok(weather.every(w=>w.goal===3));assert.deepEqual(normalizeAdventureState({weatherWins:['snow','snow','unknown']}),{weatherWins:['snow']});assert.deepEqual(normalizeGardenState(null,[],[]).adventures,{weatherWins:[]});
});
