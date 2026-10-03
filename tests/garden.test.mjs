import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWeatherRules, normalizeGardenState, normalizeDayNightRules, normalizeSeasonRules } from '../src/garden-engine.mjs';
test('花园恢复只接受已收藏的有效宝物，旧存档保留六块空花圃', () => {
  assert.deepEqual(normalizeGardenState(null, [], []).slots, Array(6).fill(null));
  assert.deepEqual(normalizeGardenState({ slots: ['a', 'b', 'missing', 3, 'a'] }, [{ id: 'a' }, { id: 'b' }], [{ prizeId: 'a' }]).slots, ['a', null, null, null, null, null]);
});
test('天气参数限幅，非法天气不会执行，禁用设置保留', () => {
  const rules = normalizeWeatherRules({ enabled: false, firstAfterMs: -1, intervalMs: Infinity, durationMs: 999999, kinds: ['snow', 'evil'] });
  assert.deepEqual(rules, { enabled: false, firstAfterMs: 1000, intervalMs: 40000, durationMs: 60000, kinds: ['snow'] });
});

test('昼夜规则限幅，旧存档交由初始规则决定，当前状态可恢复', () => {
  assert.deepEqual(normalizeDayNightRules(), { enabled: true, initial: 'day', durationMs: 180000 });
  assert.deepEqual(normalizeDayNightRules({ enabled: false, initial: 'night', durationMs: -5 }), { enabled: false, initial: 'night', durationMs: 10000 });
  assert.equal(normalizeGardenState({ timeOfDay: 'night' }, [], []).timeOfDay, 'night');
  assert.equal(normalizeGardenState({}, [], []).timeOfDay, null);
});

test('四季规则校验、旧存档兼容、状态恢复', () => {
  assert.deepEqual(normalizeSeasonRules(), { enabled: true, initial: 'spring', durationMs: 300000 });
  assert.deepEqual(normalizeSeasonRules({ enabled: false, initial: 'oops', durationMs: Infinity }), { enabled: false, initial: 'spring', durationMs: 300000 });
  assert.equal(normalizeGardenState({ season: 'winter' }, [], []).season, 'winter');
  assert.equal(normalizeGardenState({ season: 'oops' }, [], []).season, null);
});
