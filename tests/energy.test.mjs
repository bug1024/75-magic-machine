import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeGameConfig, normalizeEnergyState, changeEnergy, makeMathQuestion, isCorrectAnswer } from '../src/energy.mjs';
const rules = normalizeGameConfig(JSON.parse(await readFile(new URL('../game-config.json', import.meta.url), 'utf8')));
test('首次能量为10，旧存档可升级，耗尽与满格不会越界，难度偏好可恢复', () => {
  assert.deepEqual(normalizeEnergyState(undefined, rules), { balance: 10, difficulty: 'easy' });
  assert.deepEqual(normalizeEnergyState({ balance: 0, difficulty: 'hard' }, rules), { balance: 0, difficulty: 'hard' });
  assert.deepEqual(normalizeEnergyState({ balance: '3', difficulty: 'unknown' }, rules), { balance: 10, difficulty: 'easy' });
  assert.equal(normalizeEnergyState({ balance: 100 }, rules).balance, 10);
  assert.equal(normalizeEnergyState({ balance: -5 }, rules).balance, 0);
  let energy = 10;
  for (let i = 0; i < 10; i++) energy = changeEnergy(energy, -rules.energy.drawCost, rules);
  assert.equal(energy, 0); assert.equal(changeEnergy(energy, -1, rules), 0);
  for (let i = 0; i < 20; i++) energy = changeEnergy(energy, rules.energy.correctReward, rules);
  assert.equal(energy, 10);
});
test('三档题目的运算数和结果均在范围内，加减法覆盖边界且不生成负数', () => {
  for (const max of [10, 20, 100]) {
    for (const operator of ['+', '−']) {
      for (const a of [0, .1, .5, .999999, 1]) for (const b of [0, .2, .8, .999999, 1]) {
        const randoms = [operator === '+' ? .1 : .9, a, b];
        const q = makeMathQuestion(max, () => randoms.shift());
        assert.equal(q.operator, operator);
        for (const n of [q.left, q.right, q.answer]) assert.ok(Number.isInteger(n) && n >= 0 && n <= max);
        assert.equal(q.answer, operator === '+' ? q.left + q.right : q.left - q.right);
      }
    }
    const q = makeMathQuestion(max, () => .2);
    assert.notDeepEqual(makeMathQuestion(max, () => .2, q), q);
  }
});
test('答案严格匹配数字，空白、错误或混杂文本不会获得能量', () => {
  const q = { answer: 7 };
  for (const value of ['', ' ', '7abc', '-7', '7.0', '6']) assert.equal(isCorrectAnswer(value, q), false);
  assert.equal(isCorrectAnswer('7', q), true);
  assert.equal(isCorrectAnswer(' 07 ', q), true);
  assert.equal(isCorrectAnswer('0', { answer: 0 }), true);
});
