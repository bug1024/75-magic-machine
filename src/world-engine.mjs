// 随机事件只在一次正常开奖后判定；赠送的宝物不推进抽奖次数。
export const MACHINE_LEVELS = [
  { id: 'starlight', name: '星光机器', threshold: null },
  { id: 'rainbow', name: '彩虹机器', threshold: 'rainbowAt' },
  { id: 'winged', name: '飞翼机器', threshold: 'wingedAt' },
  { id: 'castle', name: '城堡机器', threshold: 'castleAt' },
  { id: 'life', name: '生命树机器', threshold: 'lifeAt' }
];
export const ENEMIES = [
  { id: 'bat', name: '淘气蝙蝠', threshold: 'rainbowAt' },
  { id: 'witch', name: '邪恶女巫', threshold: 'wingedAt' },
  { id: 'rock', name: '捣蛋石头怪', threshold: 'castleAt' },
  { id: 'dragon', name: '邪恶大龙', threshold: 'lifeAt' }
];
export function enemyRules(rules, type) { return { ...rules, ...(type && type !== 'witch' ? rules[type] : {}) }; }
export function machineLevel(completedDraws, rules) {
  return MACHINE_LEVELS.findLast(level => !level.threshold || completedDraws >= rules[level.threshold]);
}
export function normalizeWorldRules(value) {
  const integer = (v, fallback, min, max) => Math.max(min, Math.min(max, Number.isInteger(v) ? v : fallback));
  const minGap = integer(value?.minGap, 3, 0, 100);
  const kinds = { fairy: { name: '魔法仙子', energyDelta: 5 }, ghost: { name: '捣蛋小幽灵', energyDelta: -1 }, courier: { name: '宝物快递精灵', energyDelta: 0 }, mermaid: { name: '美人鱼公主', energyDelta: 0 } };
  const events = Object.entries(kinds).map(([id, defaults]) => {
    const item = value?.events?.find?.(event => event.id === id) || {};
    const image = typeof item.image === 'string' && /^(assets\/[^\s]+\.svg|data:image\/svg\+xml;base64,[a-z0-9+/=]+)$/i.test(item.image) ? item.image : '';
    return { id, name: defaults.name, image, enabled: item.enabled !== false, weight: Number.isFinite(item.weight) && item.weight >= 0 ? item.weight : 1, energyDelta: id === 'fairy' ? integer(item.energyDelta, 5, 1, 10) : id === 'ghost' ? -integer(Math.abs(item.energyDelta ?? -1), 1, 1, 10) : 0, durationMs: integer(item.durationMs, 10000, 2000, 30000) };
  });
  const rainbowAt = integer(value?.rainbowAt, 10, 1, 9998);
  const wingedAt = integer(value?.wingedAt, 20, rainbowAt + 1, 9999);
  const castleAt = integer(value?.castleAt, 35, wingedAt + 1, 10000);
  const lifeAt = integer(value?.lifeAt, 50, castleAt + 1, 10001);
  const witchMinGap = integer(value?.witch?.minGap, 5, 0, 100);
  const witch = { chance: Number.isFinite(value?.witch?.chance) ? Math.max(0, Math.min(1, value.witch.chance)) : .25, minGap: witchMinGap, guaranteeAfter: integer(value?.witch?.guaranteeAfter, 10, witchMinGap + 1, 200), enabled: value?.witch?.enabled !== false, hits: integer(value?.witch?.hits, 4, 1, 10), visibleMs: integer(value?.witch?.visibleMs, 2800, 1500, 10000), hiddenMs: integer(value?.witch?.hiddenMs, 450, 200, 3000), image: typeof value?.witch?.image === 'string' && /^(assets\/[^\s]+\.svg|data:image\/svg\+xml;base64,[a-z0-9+/=]+)$/i.test(value.witch.image) ? value.witch.image : '' };
  for (const [id, hits, visibleMs] of [['bat', 3, 2400], ['rock', 6, 4300], ['dragon', 8, 5000]]) {
    const entry = value?.witch?.[id] || {};
    witch[id] = { ...witch[id], enabled: entry.enabled !== false, hits: integer(entry.hits, hits, 3, 10), visibleMs: integer(entry.visibleMs, visibleMs, 1500, 10000), hiddenMs: integer(entry.hiddenMs, 650, 200, 3000), image: typeof entry.image === 'string' && /^(assets\/[^\s]+\.svg|data:image\/svg\+xml;base64,[a-z0-9+/=]+)$/i.test(entry.image) ? entry.image : '' };
  }
  return { enabled: value?.enabled !== false, chance: Number.isFinite(value?.chance) ? Math.max(0, Math.min(1, value.chance)) : .15, minGap, guaranteeAfter: integer(value?.guaranteeAfter, 8, minGap + 1, 200), rainbowAt, wingedAt, castleAt, lifeAt, events, witch };
}
export function normalizeWorldState(saved, history, rules) {
  const natural = (value, fallback) => Number.isSafeInteger(value) && value >= 0 ? value : fallback;
  const completedDraws = natural(saved?.completedDraws, history.filter(record => record.source !== 'event').length);
  const pending = Array.isArray(saved?.pending) ? saved.pending.filter(item => item && (item.kind === 'upgrade' || item.kind === 'witch' || (item.kind === 'event' && rules.events.some(event => event.id === item.id)))).map(item => item.kind === 'upgrade' ? { kind: 'upgrade', level: MACHINE_LEVELS.some(level => level.threshold && level.id === item.level) ? item.level : 'rainbow' } : item.kind === 'witch' ? { kind: 'witch', ...(ENEMIES.some(e => e.id === item.opponent) ? { opponent: item.opponent } : {}), assistUsed: item.assistUsed === true, usedGuardians: Array.isArray(item.usedGuardians) ? [...new Set(item.usedGuardians.filter(id => typeof id === 'string'))].slice(0, 6) : [], assistHits: Math.min(5, natural(item.assistHits, item.assistUsed ? 1 : 0)), shieldUsed: item.shieldUsed === true, interferenceUsed: item.interferenceUsed === true, milestone: natural(item.milestone, completedDraws), hits: Math.min(enemyRules(rules.witch, item.opponent).hits, natural(item.hits, 0)), giftId: typeof item.giftId === 'string' ? item.giftId : null } : { kind: 'event', id: item.id, giftId: typeof item.giftId === 'string' ? item.giftId : null }).slice(0, 8) : [];
  const oldChallenge = pending.find(item => item.kind === 'witch');
  const fallbackWitch = oldChallenge ? Math.min(completedDraws, oldChallenge.milestone) : history.some(record => ENEMIES.some(enemy => enemy.id === record.eventId)) ? completedDraws : null;
  const candidateWitch = natural(saved?.lastWitchDraw, fallbackWitch);
  const lastWitchDraw = candidateWitch === null ? null : Math.min(completedDraws, candidateWitch);
  const seenOpponents = Array.isArray(saved?.seenOpponents) ? [...new Set(saved.seenOpponents.filter(id => ENEMIES.some(e => e.id === id)))] : saved ? ENEMIES.filter(e => completedDraws >= rules[e.threshold] && (e.id === 'bat' || e.id === 'witch')).map(e => e.id) : [];
  return { completedDraws, seenOpponents, lastWitchDraw, witchWait: Math.min(rules.witch.guaranteeAfter, natural(saved?.witchWait, 0)), sinceEvent: Math.min(rules.guaranteeAfter, natural(saved?.sinceEvent, 0)), pending };
}
export function advanceWorld(state, rules, balance, warningThreshold, random = Math.random) {
  const next = { ...state, completedDraws: state.completedDraws + 1, sinceEvent: state.sinceEvent + 1, pending: [...state.pending] };
  for (const level of MACHINE_LEVELS.filter(level => level.threshold)) {
    if (state.completedDraws < rules[level.threshold] && next.completedDraws >= rules[level.threshold]) next.pending.push({ kind: 'upgrade', level: level.id });
  }
  if (state.pending.length) return next;
  if (next.pending.some(item => item.kind === 'upgrade')) { next.sinceEvent = 0; return next; }
  // 升级当次留给机器；升级后的第一抽安排新角色登场，之后混合旧角色。
  const unlocked = ENEMIES.filter(enemy => next.completedDraws >= rules[enemy.threshold] && (enemy.id === 'witch' || rules.witch[enemy.id].enabled));
  const seen = state.seenOpponents || [];
  const debut = unlocked.findLast(enemy => !seen.includes(enemy.id));
  if (unlocked.length && !next.pending.some(item => item.kind === 'upgrade')) {
    next.witchWait = (state.witchWait || 0) + 1;
    const canVisit = state.lastWitchDraw == null || next.completedDraws - state.lastWitchDraw > rules.witch.minGap;
    if (rules.witch.enabled && (debut || (canVisit && (next.witchWait >= rules.witch.guaranteeAfter || random() < rules.witch.chance)))) {
      const enemy = debut || unlocked[Math.min(unlocked.length - 1, Math.floor(Math.max(0, Math.min(.999999, random())) * unlocked.length))];
      next.pending.push({ kind: 'witch', opponent: enemy.id, assistUsed: false, usedGuardians: [], assistHits: 0, shieldUsed: false, interferenceUsed: false, milestone: next.completedDraws, hits: 0, giftId: null });
      next.seenOpponents = [...new Set([...seen, enemy.id])];
      next.lastWitchDraw = next.completedDraws; next.witchWait = 0; next.sinceEvent = 0;
      return next;
    }
  }
  const eligible = rules.events.filter(event => event.enabled && event.weight > 0 && (event.id !== 'ghost' || balance > warningThreshold));
  if (rules.enabled && eligible.length && next.sinceEvent > rules.minGap && (next.sinceEvent >= rules.guaranteeAfter || random() < rules.chance)) {
    let cursor = Math.max(0, Math.min(1 - Number.EPSILON, random())) * eligible.reduce((sum, event) => sum + event.weight, 0);
    const event = eligible.find(event => { cursor -= event.weight; return cursor < 0; }) || eligible.at(-1);
    next.pending.push({ kind: 'event', id: event.id }); next.sinceEvent = 0;
  }
  return next;
}
