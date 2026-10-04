import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateSave, collectionOrder, ScenePacing, chooseWeather } from '../src/experience.mjs';
import { drawTreasure } from '../src/engine.mjs';
import { normalizeWorldRules, normalizeWorldState, advanceWorld } from '../src/world-engine.mjs';
test('旧存档迁移保留库存与进度，NEW不追溯标记，拒绝未知版本', () => {
  const old = {version:1,history:[{prizeId:'a',timestamp:100},{prizeId:'a',timestamp:200}],inventory:{a:7},world:{completedDraws:120}};
  const migrated = migrateSave(old);
  assert.equal(migrated.version,2); assert.equal(migrated.inventory.a,7); assert.equal(migrated.world.completedDraws,120); assert.equal(migrated.acquiredAt.a,200); assert.deepEqual(migrated.unread,[]);
  assert.deepEqual(migrateSave(migrated),migrated); assert.equal(old.version,1);
  assert.throws(()=>migrateSave({...old,version:3})); assert.throws(()=>migrateSave({version:2,history:'oops'}));
});
test('收藏排序稳定、稀有度与最近获得独立，未发现不会误算获得时间', () => {
  const items=[{id:'a',rarity:'common'},{id:'b',rarity:'super'},{id:'c',rarity:'rare'}], owned={a:3,c:1},dates={a:100,c:200};
  assert.deepEqual(collectionOrder(items,owned,dates).map(t=>t.id),['c','a','b']);
  assert.deepEqual(collectionOrder(items,owned,dates,'rarity').map(t=>t.id),['b','c','a']);
  assert.deepEqual(collectionOrder(items,owned,dates,'recent').map(t=>t.id),['c','a','b']);
  assert.equal(items[0].id,'a');
});
test('温和防重复和未发现加权；等概率忽略所有收集与重复权重', () => {
  const items=['a','b','c'].map(id=>({id,enabled:true,weight:10}));
  assert.equal(drawTreasure(items,()=>.4).id,'b');
  assert.equal(drawTreasure(items,()=>.36,{inventory:{a:1,b:1},recentIds:['b']}).id,'a');
  for (let i=0;i<3;i++) assert.equal(drawTreasure(items,()=>(i+.5)/3,{equalProbability:true,inventory:{a:100},recentIds:['b','c'],preferUnowned:true}).id,items[i].id);
  for(const r of [0,.5,.999]) assert.equal(drawTreasure(items,()=>r,{inventory:{a:1,b:1},preferUnowned:true}).id,'c');
  assert.ok(drawTreasure(items,()=>.2,{inventory:{a:1,b:1,c:1},preferUnowned:true}));
});
test('纯净时间仅累计可游玩前台时间，后续场景不缩短已有等待', () => {
  const pacing=new ScenePacing(); pacing.quiet(5000);pacing.advance(3000,false);assert.equal(pacing.remaining,5000);
  pacing.advance(2000);pacing.quiet(1000);assert.equal(pacing.remaining,3000);pacing.advance(3000);assert.ok(pacing.ready);
});
test('低权重特殊天气与零权重不会被选中',()=>{
  const kinds=['rain','storm','snow'],weights={rain:5,storm:.4,snow:0};
  assert.equal(chooseWeather(kinds,weights,()=>.9),'rain');assert.equal(chooseWeather(kinds,weights,()=>.99),'storm');assert.equal(chooseWeather(['snow'],weights),null);
});
test('连续抽奖保留原事件且只追加一次跨级升级，不追加随机事件',()=>{
  const rules=normalizeWorldRules({});let state=normalizeWorldState({completedDraws:9,pending:[{kind:'event',id:'fairy'}]},[],rules);
  state=advanceWorld(state,rules,8,3,()=>0);assert.deepEqual(state.pending.map(p=>p.kind),['event','upgrade']);
  state=advanceWorld(state,rules,8,3,()=>0);assert.equal(state.completedDraws,11);assert.equal(state.pending.length,2);
});
