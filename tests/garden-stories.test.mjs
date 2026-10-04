import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeConfig, normalizeInventory } from '../src/engine.mjs';
import { normalizeGardenState, normalizeStoryRules, matchGardenStory } from '../src/garden-engine.mjs';
const treasures = normalizeConfig(JSON.parse(await readFile(new URL('../treasures.json',import.meta.url),'utf8')));
const rules = normalizeStoryRules(JSON.parse(await readFile(new URL('../garden-stories.json',import.meta.url),'utf8')));
test('实际库存限制摆放，超额旧花圃按顺序整理；库存不受历史上限影响', () => {
 const inventory = normalizeInventory(null,[{prizeId:'a'}]);
 assert.equal(inventory.a,1);
 assert.deepEqual(normalizeGardenState({slots:['a','a','a','b']},[{id:'a'},{id:'b'}],[],inventory).slots,['a',null,null,null,null,null]);
 const ledger = normalizeInventory({a:1500,b:-2,c:'2'},[]); assert.equal(ledger.a,1500); assert.equal(ledger.b,undefined);
 assert.deepEqual(normalizeGardenState({slots:['a','a']},[{id:'a'}],[],ledger).slots,['a','a',null,null,null,null]);
});
test('所有宝物拥有有效去重标签；旧配置无标签仍可抽奖',()=>{
 assert.ok(treasures.every(t=>t.tags.length>0));
 const normalized = normalizeConfig({version:1,treasures:[{id:'x',tags:['animal','animal','<script>',6]}]});assert.deepEqual(normalized[0].tags,['animal']);
 assert.deepEqual(normalizeConfig({version:1,treasures:[{id:'x'}]})[0].tags,[]);
});
test('四种组合支持不同角色；多标签单件与同种重复不能凑数',()=>{
 const cases = [['forest-concert',['star-seed','singing-mushrooms']],['ocean-party',['cloud-dolphin','whale-cup']],['magic-ball',['starlight-dress','rainbow-unicorn']],['prank-party',['giggle-baby','super-dad']]];
 for(const [id,slots] of cases) assert.equal(matchGardenStory(rules.find(r=>r.id===id),slots,treasures).length,2);
 assert.equal(matchGardenStory(rules[0],['singing-mushrooms','singing-mushrooms'],treasures),null);
 assert.equal(matchGardenStory(rules[1],Array(6).fill('cloud-dolphin'),treasures),null);
 assert.equal(matchGardenStory(rules[1],['cloud-dolphin','pearl-mermaid-set'],treasures).length,2);
 assert.equal(matchGardenStory({...rules[0],enabled:false},['star-seed','singing-mushrooms'],treasures),null);
});
test('非法组合不会放宽触发要求，效果与奖励受限',()=>{
 assert.equal(normalizeStoryRules({version:1,stories:[{...rules[0],requirements:[{tag:'plant',count:1},{tag:'x',count:0}]}]}).length,0);
 assert.equal(normalizeStoryRules({version:1,stories:[{...rules[0],effect:'unknown'}]}).length,0);
 assert.equal(normalizeStoryRules({version:1,stories:[{...rules[0],energyReward:50}]} )[0].energyReward,3);
});
test('六个新故事限定真实伙伴，标签相同的其他宝物不能替代', () => {
 const specific = rules.filter(story => story.requirements.some(role => role.id));
 assert.equal(specific.length, 6);
 for (const story of specific) {
  const ids = story.requirements.map(role => role.id);
  assert.deepEqual(matchGardenStory(story, ids, treasures), ids);
  assert.equal(story.lines.length, 3);
  for (let i = 0; i < ids.length; i++) {
   const other = treasures.find(t => t.id !== ids[i] && t.tags.includes(story.requirements[i].tag));
   if (other) assert.equal(matchGardenStory(story, ids.map((id,j) => j === i ? other.id : id), treasures), null);
  }
 }
 const bad = {...specific[0], requirements: [{tag:'ocean',id:'<invalid>',count:1}]};
 assert.deepEqual(normalizeStoryRules({version:1,stories:[bad]}), []);
});
