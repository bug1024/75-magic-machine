import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeWorldRules, normalizeWorldState, advanceWorld, machineLevel, ENEMIES, enemyRules } from '../src/world-engine.mjs';
const config = JSON.parse(await readFile(new URL('../game-config.json', import.meta.url), 'utf8'));
const rules = normalizeWorldRules(config.world);
const initial = () => normalizeWorldState(null, [], rules);
test('事件遵守配置间隔和保底，等待演出时允许继续抽奖', () => {
  const rules = normalizeWorldRules({...config.world, rainbowAt:100, wingedAt:200,castleAt:300,lifeAt:400});
  let state = initial();
  for (let draw = 1; draw <= rules.minGap; draw++) { state = advanceWorld(state, rules, 8, 3, () => 0); assert.equal(state.pending.length, 0); }
  state = advanceWorld(state, rules, 8, 3, () => 0); assert.equal(state.pending[0].id, 'fairy'); assert.equal(state.sinceEvent, 0);
  const waiting = advanceWorld(state, rules, 8, 3); assert.deepEqual(waiting.pending, state.pending); assert.equal(waiting.completedDraws, state.completedDraws + 1);
  state.pending = [];
  for (let draw = 1; draw <= rules.minGap; draw++) { state = advanceWorld(state, rules, 8, 3, () => 0); assert.equal(state.pending.length, 0); }
  state = initial();
  for (let draw = 1; draw < rules.guaranteeAfter; draw++) { state = advanceWorld(state, rules, 8, 3, () => .99); assert.equal(state.pending.length, 0); }
  state = advanceWorld(state, rules, 8, 3, () => .99); assert.equal(state.pending[0].id, 'mermaid');
});
test('按事件权重选择，低能量仍可遇见幽灵，禁用事件不参与抽取', () => {
  const state = { ...initial(), sinceEvent: rules.guaranteeAfter - 1 };
  for (const [random, id] of [[.1,'fairy'], [.5,'ghost'], [.7,'courier'], [.9,'mermaid']]) assert.equal(advanceWorld(state, rules, 8, 3, () => random).pending[0].id, id);
  for (let balance = 0; balance <= 3; balance++) assert.equal(advanceWorld(state, rules, balance, 3, () => .5).pending[0].id, 'ghost');
  const disabled = structuredClone(rules); disabled.enabled = false;
  assert.equal(advanceWorld(state, disabled, 8, 3, () => 0).pending.length, 0);
  disabled.enabled = true; disabled.events.forEach(event => { event.enabled = false; });
  assert.equal(advanceWorld(state, disabled, 8, 3, () => 0).pending.length, 0);
});
test('正常抽奖跨过10次才升级，赠品历史不计数，旧存档与待处理事件可以恢复', () => {
  const history = [...Array.from({ length: 9 }, () => ({ source: 'draw' })), { source: 'event' }];
  const state = normalizeWorldState(null, history, rules); assert.equal(state.completedDraws, 9);
  const next = advanceWorld(state, rules, 0, 3, () => .99); assert.deepEqual(next.pending, [{ kind: 'upgrade', level: 'rainbow' }]);
  const simultaneous = advanceWorld({ ...state, sinceEvent: rules.guaranteeAfter - 1 }, rules, 8, 3, () => .99);
  assert.deepEqual(simultaneous.pending, [{ kind: 'upgrade', level: 'rainbow' }]);
  next.pending = [];
  assert.ok(!advanceWorld(next, rules, 8, 3, () => .99).pending.some(item => item.kind === 'upgrade'));
  assert.equal(normalizeWorldState({ completedDraws: 1500, sinceEvent: 2, pending: [{ kind: 'event', id: 'courier', giftId: 'cloud-dolphin' }] }, history, rules).completedDraws, 1500);
  assert.deepEqual(normalizeWorldState({ pending: [null, { kind: 'bad' }, { kind: 'event', id: 'unknown' }] }, [], rules).pending, []);
});
test('10/20/35/50次跨越时各升级一次，形态保留，旧队列兼容且门槛严格递增', () => {
  for (const [count, id] of [[0, 'starlight'], [9, 'starlight'], [10, 'rainbow'], [19, 'rainbow'], [20, 'winged'], [34, 'winged'], [35, 'castle'], [49, 'castle'], [50, 'life'], [100, 'life']]) assert.equal(machineLevel(count, rules).id, id);
  for (const [count, id] of [[9, 'rainbow'], [19, 'winged'], [34, 'castle'], [49, 'life']]) {
    const next = advanceWorld({ ...initial(), completedDraws: count }, rules, 0, 3, () => .99);
    assert.deepEqual(next.pending, [{ kind: 'upgrade', level: id }]);
    next.pending = []; assert.ok(!advanceWorld(next, rules, 0, 3, () => .99).pending.some(item => item.kind === 'upgrade'));
  }
  assert.deepEqual(normalizeWorldState({ pending: [{ kind: 'upgrade' }] }, [], rules).pending, [{ kind: 'upgrade', level: 'rainbow' }]);
  const restored = normalizeWorldState({ completedDraws: 35, pending: [{ kind: 'upgrade', level: 'castle' }] }, [], rules);
  assert.equal(restored.pending[0].level, 'castle');
  const custom = normalizeWorldRules({ rainbowAt: 10000, wingedAt: 2, castleAt: -1 });
  assert.ok(custom.rainbowAt < custom.wingedAt && custom.wingedAt < custom.castleAt && custom.castleAt < custom.lifeAt);
});
test('角色插画存在，配置参数受限', async () => {
  for (const event of rules.events) assert.match(await readFile(new URL(`../${event.image}`, import.meta.url), 'utf8'), /viewBox="0 0 360 360"/);
  const normalized = normalizeWorldRules({ chance: 9, minGap: -3, guaranteeAfter: -4, rainbowAt: 0 });
  assert.equal(normalized.chance, 1); assert.equal(normalized.minGap, 0); assert.equal(normalized.guaranteeAfter, 1); assert.equal(normalized.rainbowAt, 1);
});
test('每次升级后第一抽首次遇见新反派，旧角色混合出现且遵循冷却/保底', () => {
  for (const [threshold, id] of [['rainbowAt','bat'], ['wingedAt','witch'], ['castleAt','rock'], ['lifeAt','dragon']]) {
    let state = { ...initial(), completedDraws: rules[threshold] - 1, seenOpponents: ENEMIES.filter(e => rules[e.threshold] < rules[threshold]).map(e => e.id) };
    state = advanceWorld(state, rules, 10, 3, () => .99);
    assert.ok(state.pending.some(item => item.kind === 'upgrade'));
    assert.ok(!state.pending.some(item => item.kind === 'witch'));
    state.pending = [];
    state = advanceWorld(state, rules, 10, 3, () => .99);
    assert.equal(state.pending[0].opponent, id);
    assert.ok(state.seenOpponents.includes(id));
    const restored = normalizeWorldState(state, [], rules);
    assert.equal(restored.pending[0].opponent, id);
    assert.ok(restored.seenOpponents.includes(id));
  }
  const quiet = {...rules, enabled:false};
  let state = {...initial(),completedDraws:60,seenOpponents:ENEMIES.map(e=>e.id),lastWitchDraw:60};
  for (let i=1;i<=rules.witch.minGap;i++) {state=advanceWorld(state,quiet,10,3,()=>0);assert.equal(state.pending.length,0);}
  state=advanceWorld(state,quiet,10,3,()=>0);assert.equal(state.pending[0].opponent,'bat');state.pending=[];
  for(let i=1;i<=rules.witch.guaranteeAfter;i++){state=advanceWorld(state,quiet,10,3,()=>.99);assert.equal(state.pending.some(p=>p.kind==='witch'),i===rules.witch.guaranteeAfter);}
  const disabled={...quiet,witch:{...rules.witch,enabled:false}};
  assert.ok(!advanceWorld({...initial(),completedDraws:51},disabled,10,3,()=>0).pending.some(p=>p.kind==='witch'));
});

test('生命树升级独占舞台，旧存档恢复最终形态，待处理升级仍可继续', () => {
 const next = advanceWorld({...initial(),completedDraws:49,sinceEvent:8,witchWait:14},rules,10,3,()=>0);
 assert.deepEqual(next.pending,[{kind:'upgrade',level:'life'}]);
 const restored=normalizeWorldState({completedDraws:50,pending:next.pending},[],rules);
 assert.equal(restored.pending[0].level,'life');
 assert.equal(machineLevel(normalizeWorldState({completedDraws:70},[],rules).completedDraws,rules).id,'life');
 const after=advanceWorld({...next,pending:[]},rules,10,3,()=>0);
 assert.ok(after.pending.some(item=>item.kind==='witch'));
 assert.ok(!after.pending.some(item=>item.kind==='upgrade'));
});
test('仙子默认补5格、反派血量3/4/6/8、助攻/护盾进度与旧存档可恢复', () => {
 assert.equal(rules.events.find(e=>e.id==='fairy').energyDelta,5);
 assert.equal(normalizeWorldRules({}).events.find(e=>e.id==='fairy').energyDelta,5);
 for (const [type,hits] of [['bat',3],['witch',4],['rock',6],['dragon',8]]) assert.equal(enemyRules(rules.witch,type).hits,hits);
 const restored=normalizeWorldState({completedDraws:55,pending:[{kind:'witch',opponent:'dragon',hits:7,assistUsed:true,assistHits:3,usedGuardians:['a','b','a'],shieldUsed:true,interferenceUsed:true}]},[],rules);
 assert.equal(restored.pending[0].hits,7);assert.equal(restored.pending[0].assistHits,3);assert.deepEqual(restored.pending[0].usedGuardians,['a','b']);assert.equal(restored.pending[0].shieldUsed,true);
 const legacy=normalizeWorldState({completedDraws:40,pending:[{kind:'witch',hits:1,assistUsed:true}]},[],rules);
 assert.equal(legacy.pending[0].opponent,undefined);assert.equal(legacy.pending[0].assistHits,1);assert.equal(legacy.pending[0].assistUsed,true);
 assert.deepEqual(legacy.seenOpponents,['bat','witch']);
});

test('首轮访客轮流出现、战斗不清空访客保底，充能余量可恢复', () => {
 let state={...initial(), completedDraws:60,seenOpponents:ENEMIES.map(e=>e.id),sinceEvent:rules.guaranteeAfter-1,lastWitchDraw:0};
 const visits=[];
 for(let i=0;i<4;i++){ state=advanceWorld({...state,pending:[],sinceEvent:rules.guaranteeAfter-1},rules,1,3,()=>0); assert.equal(state.pending[0].kind,'event');visits.push(state.pending[0].id); }
 assert.equal(new Set(visits).size,4);assert.ok(visits.includes('ghost'));
 const saved=normalizeWorldState({...initial(),pending:[{kind:'event',id:'fairy',chargeRemaining:3}]},[],rules);assert.equal(saved.pending[0].chargeRemaining,3);
 const battle=advanceWorld({...initial(),completedDraws:60,seenOpponents:ENEMIES.map(e=>e.id),sinceEvent:5,lastWitchDraw:0},rules,8,3,()=>0);assert.equal(battle.pending[0].kind,'witch');assert.equal(battle.sinceEvent,6);
});
