const natural = (n, fallback = 0) => Number.isSafeInteger(n) && n >= 0 ? n : fallback;
export function normalizeMechanics(raw, treasures, owned) {
  const valid = id => treasures.some(t => t.id === id) && owned[id] > 0;
  const seen=new Set();
  const tray=(Array.isArray(raw?.tray)?raw.tray:[]).slice(0,3).map(id=>{if(!valid(id)||seen.has(id))return null;seen.add(id);return id;});
  const broken = Array.isArray(raw?.broken) ? [...new Set(raw.broken.filter(id => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id)))].slice(0, 32) : [];
  return { active: typeof raw?.active === 'string' ? raw.active : null, tray, broken, guardWon: raw?.guardWon === true, flagReadyAt: natural(raw?.flagReadyAt), musicReadyAt: natural(raw?.musicReadyAt), focusId: treasures.some(t => t.id === raw?.focusId && t.enabled && t.weight > 0) ? raw.focusId : null, focusRemaining: Math.min(5, natural(raw?.focusRemaining)), challengeReadyAt: natural(raw?.challengeReadyAt) };
}
export function normalizeEnvironment(raw) {
  return { seasonStep: natural(raw?.seasonStep, -1), dayMs: Number.isFinite(raw?.dayMs) ? Math.max(0,Math.min(1799999,Math.floor(raw.dayMs))) : 0, pendingTime: ['day', 'night'].includes(raw?.pendingTime) ? raw.pendingTime : null, pendingSeason: ['spring', 'summer', 'autumn', 'winter'].includes(raw?.pendingSeason) ? raw.pendingSeason : null, weatherDueDraw: natural(raw?.weatherDueDraw, -1), lastKind: typeof raw?.lastKind === 'string' ? raw.lastKind : null };
}
export function weatherNextDraw(count, random = Math.random) { return count + 3 + Math.floor(Math.min(.999999, Math.max(0, random())) * 4); }
export function seasonStepFor(count, levelIndex, eternal) { return eternal ? 4 + Math.floor(Math.max(0, count - 75) / 10) : levelIndex; }
export function tickDay(environment, elapsed, time, duration = 180000) {
  const next = { ...environment, dayMs: environment.dayMs + Math.max(0, elapsed) };
  if (next.dayMs >= duration) { const flips = Math.floor(next.dayMs / duration); next.dayMs %= duration; if (flips % 2) next.pendingTime = (next.pendingTime || time) === 'day' ? 'night' : 'day'; }
  return next;
}
export function normalizeDamage(raw) {
  return { attacks: Math.min(2, natural(raw?.attacks)), energyTaken: Math.min(2, natural(raw?.energyTaken)), trapped: typeof raw?.trapped === 'string' ? raw.trapped : null, facility: typeof raw?.facility === 'string' ? raw.facility : null, flagUsed: raw?.flagUsed === true };
}
export function damageKind(opponent, attackIndex) { return opponent === 'bat' ? 'trap' : opponent === 'rock' ? 'facility' : opponent === 'dragon' ? attackIndex === 0 ? 'facility' : 'trap' : 'energy'; }
export function attackThresholds(opponent, health) { return opponent === 'dragon' ? [Math.max(1, Math.floor(health / 3)), Math.max(2, Math.floor(health * 2 / 3))] : [Math.max(1, Math.floor(health / 2))]; }
export function canChallenge(world, rules, count, readyAt, opponent) { return rules.witch.enabled && !world.pending.length && count >= readyAt && ['bat','witch','rock','dragon'].includes(opponent) && count >= rules[{bat:'rainbowAt',witch:'wingedAt',rock:'castleAt',dragon:'lifeAt'}[opponent]] && (opponent === 'witch' || rules.witch[opponent].enabled); }
