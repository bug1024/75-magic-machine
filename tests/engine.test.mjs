import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeConfig, drawTreasure, validHistory } from '../src/engine.mjs';
const config = JSON.parse(await readFile(new URL('../treasures.json', import.meta.url), 'utf8'));
test('完整奖池的每个宝物均按自身权重抽取，停用奖品不会进入奖池', () => {
  const pool = normalizeConfig(config);
  assert.equal(pool.length, 33);
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  let cursor = 0;
  for (const treasure of pool) {
    assert.equal(drawTreasure(pool, () => (cursor + treasure.weight / 2) / total).id, treasure.id);
    assert.equal(drawTreasure(pool, () => (cursor + treasure.weight - .000001) / total).id, treasure.id);
    cursor += treasure.weight;
  }
  assert.equal(drawTreasure(pool, () => 1).id, pool.at(-1).id);
  pool[0].enabled = false;
  assert.equal(drawTreasure(pool, () => 0).id, 'rainbow-unicorn');
  assert.throws(() => drawTreasure([]), /没有可抽取/);
});
test('全部宝物插画存在，专属效果已注册', async () => {
  const normalized = normalizeConfig(config);
  for (const treasure of normalized) {
    const svg = await readFile(new URL(`../${treasure.appearance.image}`, import.meta.url), 'utf8');
    assert.match(svg, /viewBox="0 0 360 360"/);
    const original = config.treasures.find(t => t.id === treasure.id);
    assert.equal(treasure.effects.reveal, original.effects.reveal);
    assert.equal(treasure.effects.sound, original.effects.sound);
    assert.equal(treasure.effects.interaction, original.effects.interaction || '');
    if (treasure.appearance.interactionImage) assert.match(await readFile(new URL(`../${treasure.appearance.interactionImage}`, import.meta.url), 'utf8'), /viewBox="0 0 360 360"/);
  }
});
test('作弊模式为每件宝物分配相等区间，关闭后恢复权重且不修改配置', () => {
  const pool = normalizeConfig(config), original = structuredClone(pool);
  for (let i = 0; i < pool.length; i++) {
    assert.equal(drawTreasure(pool, () => (i + .5) / pool.length, { equalProbability: true }).id, pool[i].id);
  }
  assert.equal(drawTreasure(pool, () => 1, { equalProbability: true }).id, pool.at(-1).id);
  assert.notEqual(drawTreasure(pool, () => .2).id, drawTreasure(pool, () => .2, { equalProbability: true }).id);
  assert.deepEqual(pool, original);
  pool[0].enabled = false; pool[1].weight = 0;
  assert.equal(drawTreasure(pool, () => 0, { equalProbability: true }).id, 'moon-castle');
  assert.throws(() => drawTreasure([], () => 0, { equalProbability: true }), /没有可抽取/);
});
test('未知效果降级、参数限制、非法权重和重复 ID', () => {
  const custom = structuredClone(config); const treasure = custom.treasures[0];
  treasure.effects = { reveal: 'unknown', params: { durationMs: -1, particleCount: 10000 } };
  treasure.appearance.primaryColor = 'bad'; treasure.weight = -2;
  const result = normalizeConfig(custom)[0];
  assert.equal(result.effects.reveal, 'sparkle-bloom');
  assert.equal(result.effects.ambient, 'floating-stars');
  assert.equal(result.effects.params.durationMs, 1500);
  assert.equal(result.effects.params.particleCount, 160);
  assert.equal(result.appearance.primaryColor, '#ba9cff');
  assert.equal(result.weight, 0);
  custom.treasures[1].id = treasure.id;
  assert.throws(() => normalizeConfig(custom), /唯一/);
});
test('损坏历史被过滤，收藏最多保留最近 1000 次', () => {
  const record = { prizeId: 'moon-castle', name: '月亮城堡', rarity: 'super', timestamp: 1791012300000, drawId: 'a' };
  assert.deepEqual(validHistory(null), []);
  assert.equal(validHistory([null, {}, { ...record, timestamp: 'bad' }, record]).length, 1);
  assert.equal(validHistory(Array.from({ length: 1005 }, (_, i) => ({ ...record, drawId: String(i) }))).length, 1000);
});
