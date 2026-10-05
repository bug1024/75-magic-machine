import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeConfig } from '../src/engine.mjs';
import { normalizeStoryRules, normalizeGardenState } from '../src/garden-engine.mjs';
import { normalizeWishRules, normalizeWishState, planWishStory, wishProgress, pickWish, completeWish } from '../src/wish-engine.mjs';
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const treasures = normalizeConfig(await json('../treasures.json'));
const stories = normalizeStoryRules(await json('../garden-stories.json'));
const raw = await json('../garden-wishes.json'), rules = normalizeWishRules(raw, stories);
const initial = () => normalizeWishState(null);
test('六个配置心愿引用真实故事与独立纪念物，旧存档安全恢复', () => {
 assert.equal(rules.length, 6); assert.equal(new Set(rules.map(w => w.memoryKind)).size, 6);
 assert.equal(normalizeWishRules({version:1,wishes:[...raw.wishes,raw.wishes[0],{id:'nope',kind:'story'}]},stories).length,6);
 const state=normalizeWishState({active:'bad',completed:['ocean-friends','bad','ocean-friends'],storyWins:['ocean-party',null,'<script>'],battleWins:-1});
 assert.deepEqual(state,{active:null,completed:['ocean-friends'],storyWins:['ocean-party'],battleWins:0});
 assert.deepEqual(normalizeGardenState(null,treasures,[],{}).wishes,initial());
});
test('配方优先已拥有/已摆放，缺失提示不能把一个多标签宝物当两个伙伴', () => {
 const story=stories.find(s=>s.id==='ocean-party');
 const plan=planWishStory(story,treasures,{'cloud-dolphin':1,'whale-cup':1},['cloud-dolphin']);
 assert.deepEqual(plan.map(p=>p.id),['cloud-dolphin','whale-cup']);assert.equal(plan[0].placed,true);assert.equal(plan[1].owned,true);
 assert.ok(!plan[1].candidates.includes('cloud-dolphin'));
 const one={id:'one',enabled:true,weight:1,tags:['outfit','magic']};
 assert.equal(planWishStory(stories.find(s=>s.id==='magic-ball'),[one],{one:1},['one']),null);
});
test('推荐先用现有组合，空收藏不派任务；换心愿可轮到全部六个，不在前两个之间打转', () => {
 const state=initial(),owned=Object.fromEntries(treasures.map(t=>[t.id,1]));
 assert.equal(pickWish(rules,state,stories,treasures,{},[],[]),null);
 assert.equal(pickWish(rules,state,stories,treasures,{'cloud-dolphin':1,'whale-cup':1},[],[]),'ocean-friends');
 const seen=[];let id=null;for(let i=0;i<6;i++){id=pickWish(rules,state,stories,treasures,owned,[],[],id);seen.push(id);}assert.equal(new Set(seen).size,6);
});
test('心愿只在实际故事/天气/守护完成后领奖，每个奖励只结算一次', () => {
 const state=initial(),wish=rules[0];
 let progress=wishProgress(wish,state,stories,treasures,{'cloud-dolphin':1,'whale-cup':1},['cloud-dolphin','whale-cup']);
 assert.equal(progress.ready,false);assert.equal(completeWish(state,wish,progress),state);
 state.storyWins.push(wish.storyId);progress=wishProgress(wish,state,stories,treasures,{},[]);assert.equal(progress.ready,true);
 const done=completeWish(state,wish,progress);assert.deepEqual(done.completed,[wish.id]);assert.equal(completeWish(done,wish,progress),done);
 const weather=rules.find(w=>w.kind==='weather'),guard=rules.find(w=>w.kind==='guardian');
 assert.equal(wishProgress(weather,state,stories,treasures,{},[],['snow']).ready,true);
 assert.equal(wishProgress(guard,state,stories,treasures,{'loving-mom':1},['loving-mom']).ready,false);
 state.battleWins=1;assert.equal(wishProgress(guard,state,stories,treasures,{},[]).ready,true);
});
