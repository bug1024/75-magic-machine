// 随机事件只在一次正常开奖后判定；赠送的宝物不推进抽奖次数。
export const MACHINE_LEVELS = [
  { id: 'starlight', name: '星光机器', threshold: null },
  { id: 'rainbow', name: '彩虹机器', threshold: 'rainbowAt' },
  { id: 'winged', name: '飞翼机器', threshold: 'wingedAt' },
  { id: 'castle', name: '城堡机器', threshold: 'castleAt' }
];
export function machineLevel(completedDraws, rules) {
  return MACHINE_LEVELS.findLast(level => !level.threshold || completedDraws >= rules[level.threshold]);
}
export function normalizeWorldRules(value) {
  const integer = (v, fallback, min, max) => Math.max(min, Math.min(max, Number.isInteger(v) ? v : fallback));
  const minGap = integer(value?.minGap, 3, 0, 100);
  const kinds = { fairy: { name: '魔法仙子', energyDelta: 2 }, ghost: { name: '捣蛋小幽灵', energyDelta: -1 }, courier: { name: '宝物快递精灵', energyDelta: 0 } };
  const events = Object.entries(kinds).map(([id, defaults]) => {
    const item = value?.events?.find?.(event => event.id === id) || {};
    const image = typeof item.image === 'string' && /^(assets\/[^\s]+\.svg|data:image\/svg\+xml;base64,[a-z0-9+/=]+)$/i.test(item.image) ? item.image : '';
    return { id, name: defaults.name, image, enabled: item.enabled !== false, weight: Number.isFinite(item.weight) && item.weight >= 0 ? item.weight : 1, energyDelta: id === 'fairy' ? integer(item.energyDelta, 2, 1, 10) : id === 'ghost' ? -integer(Math.abs(item.energyDelta ?? -1), 1, 1, 10) : 0, durationMs: integer(item.durationMs, 10000, 2000, 30000) };
  });
  const rainbowAt = integer(value?.rainbowAt, 10, 1, 9998);
  const wingedAt = integer(value?.wingedAt, 20, rainbowAt + 1, 9999);
  const castleAt = integer(value?.castleAt, 35, wingedAt + 1, 10000);
  return { enabled: value?.enabled !== false, chance: Number.isFinite(value?.chance) ? Math.max(0, Math.min(1, value.chance)) : .15, minGap, guaranteeAfter: integer(value?.guaranteeAfter, 8, minGap + 1, 200), rainbowAt, wingedAt, castleAt, events };
}
export function normalizeWorldState(saved, history, rules) {
  const natural = (value, fallback) => Number.isSafeInteger(value) && value >= 0 ? value : fallback;
  const completedDraws = natural(saved?.completedDraws, history.filter(record => record.source !== 'event').length);
  const pending = Array.isArray(saved?.pending) ? saved.pending.filter(item => item && (item.kind === 'upgrade' || (item.kind === 'event' && rules.events.some(event => event.id === item.id)))).map(item => item.kind === 'upgrade' ? { kind: 'upgrade', level: MACHINE_LEVELS.some(level => level.threshold && level.id === item.level) ? item.level : 'rainbow' } : { kind: 'event', id: item.id, giftId: typeof item.giftId === 'string' ? item.giftId : null }).slice(0, 2) : [];
  return { completedDraws, sinceEvent: Math.min(rules.guaranteeAfter, natural(saved?.sinceEvent, 0)), pending };
}
export function advanceWorld(state, rules, balance, warningThreshold, random = Math.random) {
  if (state.pending.length) throw new Error('请先完成魔法事件');
  const next = { ...state, completedDraws: state.completedDraws + 1, sinceEvent: state.sinceEvent + 1, pending: [] };
  for (const level of MACHINE_LEVELS.filter(level => level.threshold)) {
    if (state.completedDraws < rules[level.threshold] && next.completedDraws >= rules[level.threshold]) next.pending.push({ kind: 'upgrade', level: level.id });
  }
  const eligible = rules.events.filter(event => event.enabled && event.weight > 0 && (event.id !== 'ghost' || balance > warningThreshold));
  if (rules.enabled && eligible.length && next.sinceEvent > rules.minGap && (next.sinceEvent >= rules.guaranteeAfter || random() < rules.chance)) {
    let cursor = Math.max(0, Math.min(1 - Number.EPSILON, random())) * eligible.reduce((sum, event) => sum + event.weight, 0);
    const event = eligible.find(event => { cursor -= event.weight; return cursor < 0; }) || eligible.at(-1);
    next.pending.push({ kind: 'event', id: event.id }); next.sinceEvent = 0;
  }
  return next;
}
