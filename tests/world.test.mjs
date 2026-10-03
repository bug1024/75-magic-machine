import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeWorldRules, normalizeWorldState, advanceWorld, machineLevel } from '../src/world-engine.mjs';
const config = JSON.parse(await readFile(new URL('../game-config.json', import.meta.url), 'utf8'));
const rules = normalizeWorldRules(config.world);
const initial = () => normalizeWorldState(null, [], rules);
test('前三次无事件，触发后至少间隔三次，连续八次无事件必定出现', () => {
  let state = initial();
  for (let draw = 1; draw <= 3; draw++) { state = advanceWorld(state, rules, 8, 3, () => 0); assert.equal(state.pending.length, 0); }
  state = advanceWorld(state, rules, 8, 3, () => 0); assert.equal(state.pending[0].id, 'fairy'); assert.equal(state.sinceEvent, 0);
  assert.throws(() => advanceWorld(state, rules, 8, 3), /先完成/);
  state.pending = [];
  for (let draw = 1; draw <= 3; draw++) { state = advanceWorld(state, rules, 8, 3, () => 0); assert.equal(state.pending.length, 0); }
  state = initial();
  for (let draw = 1; draw <= 7; draw++) { state = advanceWorld(state, rules, 8, 3, () => .99); assert.equal(state.pending.length, 0); }
  state = advanceWorld(state, rules, 8, 3, () => .99); assert.equal(state.pending[0].id, 'courier');
});
test('按事件权重选择，低能量排除幽灵，禁用事件不参与抽取', () => {
  const state = { ...initial(), sinceEvent: 7 };
  for (const [random, id] of [[.1,'fairy'], [.5,'ghost'], [.9,'courier']]) assert.equal(advanceWorld(state, rules, 8, 3, () => random).pending[0].id, id);
  for (let balance = 0; balance <= 3; balance++) for (const random of [.1,.5,.9]) assert.notEqual(advanceWorld(state, rules, balance, 3, () => random).pending[0].id, 'ghost');
  const disabled = structuredClone(rules); disabled.enabled = false;
  assert.equal(advanceWorld(state, disabled, 8, 3, () => 0).pending.length, 0);
  disabled.enabled = true; disabled.events.forEach(event => { event.enabled = false; });
  assert.equal(advanceWorld(state, disabled, 8, 3, () => 0).pending.length, 0);
});
test('正常抽奖跨过10次才升级，赠品历史不计数，旧存档与待处理事件可以恢复', () => {
  const history = [...Array.from({ length: 9 }, () => ({ source: 'draw' })), { source: 'event' }];
  const state = normalizeWorldState(null, history, rules); assert.equal(state.completedDraws, 9);
  const next = advanceWorld(state, rules, 0, 3, () => .99); assert.deepEqual(next.pending, [{ kind: 'upgrade', level: 'rainbow' }]);
  const simultaneous = advanceWorld({ ...state, sinceEvent: 7 }, rules, 8, 3, () => .99);
  assert.deepEqual(simultaneous.pending, [{ kind: 'upgrade', level: 'rainbow' }, { kind: 'event', id: 'courier' }]);
  next.pending = [];
  assert.ok(!advanceWorld(next, rules, 8, 3, () => .99).pending.some(item => item.kind === 'upgrade'));
  assert.equal(normalizeWorldState({ completedDraws: 1500, sinceEvent: 2, pending: [{ kind: 'event', id: 'courier', giftId: 'cloud-dolphin' }] }, history, rules).completedDraws, 1500);
  assert.deepEqual(normalizeWorldState({ pending: [null, { kind: 'bad' }, { kind: 'event', id: 'unknown' }] }, [], rules).pending, []);
});
test('10/20/35次跨越时各升级一次，形态保留，旧队列兼容且门槛严格递增', () => {
  for (const [count, id] of [[0, 'starlight'], [9, 'starlight'], [10, 'rainbow'], [19, 'rainbow'], [20, 'winged'], [34, 'winged'], [35, 'castle'], [100, 'castle']]) assert.equal(machineLevel(count, rules).id, id);
  for (const [count, id] of [[9, 'rainbow'], [19, 'winged'], [34, 'castle']]) {
    const next = advanceWorld({ ...initial(), completedDraws: count }, rules, 0, 3, () => .99);
    assert.deepEqual(next.pending, [{ kind: 'upgrade', level: id }]);
    next.pending = []; assert.ok(!advanceWorld(next, rules, 0, 3, () => .99).pending.some(item => item.kind === 'upgrade'));
  }
  assert.deepEqual(normalizeWorldState({ pending: [{ kind: 'upgrade' }] }, [], rules).pending, [{ kind: 'upgrade', level: 'rainbow' }]);
  const restored = normalizeWorldState({ completedDraws: 35, pending: [{ kind: 'upgrade', level: 'castle' }] }, [], rules);
  assert.equal(restored.pending[0].level, 'castle');
  const custom = normalizeWorldRules({ rainbowAt: 10000, wingedAt: 2, castleAt: -1 });
  assert.ok(custom.rainbowAt < custom.wingedAt && custom.wingedAt < custom.castleAt);
});
test('角色插画存在，配置参数受限', async () => {
  for (const event of rules.events) assert.match(await readFile(new URL(`../${event.image}`, import.meta.url), 'utf8'), /viewBox="0 0 360 360"/);
  const normalized = normalizeWorldRules({ chance: 9, minGap: -3, guaranteeAfter: -4, rainbowAt: 0 });
  assert.equal(normalized.chance, 1); assert.equal(normalized.minGap, 0); assert.equal(normalized.guaranteeAfter, 1); assert.equal(normalized.rainbowAt, 1);
});
test('女巫只在每50次正常开奖触发，优先于随机事件，进度与升级队列可恢复', async () => {
  for (const count of [49, 99, 149]) {
    const next = advanceWorld({ ...initial(), completedDraws: count, sinceEvent: 7 }, rules, 0, 3, () => 0);
    assert.deepEqual(next.pending, [{ kind: 'witch', milestone: count + 1, hits: 0, giftId: null }]);
    assert.equal(next.sinceEvent, 8);
  }
  const disabled = normalizeWorldRules({ ...config.world, witch: { ...config.world.witch, enabled: false } });
  assert.ok(!advanceWorld({ ...initial(), completedDraws: 49 }, disabled, 5, 3, () => .99).pending.some(item => item.kind === 'witch'));
  const simultaneous = normalizeWorldRules({ ...config.world, castleAt: 50 });
  assert.deepEqual(advanceWorld({ ...initial(), completedDraws: 49 }, simultaneous, 0, 3, () => 0).pending.map(item => item.kind), ['upgrade', 'witch']);
  const pending = normalizeWorldState({ completedDraws: 50, pending: [{ kind: 'witch', hits: 2, milestone: 50, giftId: 'cloud-dolphin' }] }, [], rules).pending[0];
  assert.equal(pending.hits, 2); assert.equal(pending.giftId, 'cloud-dolphin');
  assert.equal(normalizeWorldState({ pending: [{ kind: 'witch', hits: 99 }] }, [], rules).pending[0].hits, 3);
  assert.match(await readFile(new URL(`../${rules.witch.image}`, import.meta.url), 'utf8'), /viewBox="0 0 360 360"/);
});
