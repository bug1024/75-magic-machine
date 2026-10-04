// 数学题与能量规则独立于界面，题目不出现负数或超出范围的结果。
export function normalizeGameConfig(config) {
  const integer = (value, fallback, min, max) => Math.max(min, Math.min(max, Number.isInteger(value) ? value : fallback));
  const max = integer(config?.energy?.max, 10, 1, 30);
  const energy = {
    max, initial: integer(config?.energy?.initial, max, 0, max),
    warningThreshold: integer(config?.energy?.warningThreshold, 3, 0, max),
    drawCost: integer(config?.energy?.drawCost, 1, 1, max),
    correctReward: integer(config?.energy?.correctReward, 2, 1, max)
  };
  const difficulties = {};
  for (const [key, label, range] of [['easy', '简单', 10], ['medium', '中等', 20], ['hard', '困难', 100]]) {
    difficulties[key] = { label, max: integer(config?.math?.difficulties?.[key]?.max, range, 1, 100) };
  }
  return { energy, math: { difficulties, defaultDifficulty: difficulties[config?.math?.defaultDifficulty] ? config.math.defaultDifficulty : 'easy' } };
}
export function normalizeEnergyState(saved, rules) {
  return {
    balance: Number.isInteger(saved?.balance) ? Math.max(0, Math.min(rules.energy.max, saved.balance)) : rules.energy.initial,
    difficulty: rules.math.difficulties[saved?.difficulty] ? saved.difficulty : rules.math.defaultDifficulty
  };
}
export function changeEnergy(balance, delta, rules) { return Math.max(0, Math.min(rules.energy.max, balance + delta)); }
export function makeMathQuestion(max, random = Math.random, previous = null) {
  const roll = limit => Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, random())) * (limit + 1));
  let question;
  for (let attempt = 0; attempt < 8; attempt++) {
    const operator = random() < .5 ? '+' : '−', left = roll(max);
    const right = roll(operator === '+' ? max - left : left);
    question = { left, right, operator, answer: operator === '+' ? left + right : left - right };
    if (!previous || question.left !== previous.left || question.right !== previous.right || question.operator !== previous.operator) return question;
  }
  const left = (previous.left + 1) % (max + 1);
  return { left, right: 0, operator: '+', answer: left };
}
export function isCorrectAnswer(value, question) {
  const text = String(value).trim();
  return /^\d{1,3}$/.test(text) && Number(text) === question.answer;
}
