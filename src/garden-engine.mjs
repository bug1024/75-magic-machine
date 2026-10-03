export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const WEATHER_KINDS = ['rain', 'snow', 'wind', 'meteors'];
export function normalizeWeatherRules(raw = {}) {
  const bounded = (value, fallback, min, max) => Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  return { enabled: raw.enabled !== false, firstAfterMs: bounded(raw.firstAfterMs, 12000, 1000, 300000), intervalMs: bounded(raw.intervalMs, 40000, 5000, 300000), durationMs: bounded(raw.durationMs, 16000, 3000, 60000), kinds: WEATHER_KINDS.filter(kind => !Array.isArray(raw.kinds) || raw.kinds.includes(kind)) };
}
export function normalizeGardenState(raw, treasures, history) {
  const owned = new Set(history.map(record => record.prizeId));
  const known = new Set(treasures.map(treasure => treasure.id));
  return { season: SEASONS.includes(raw?.season) ? raw.season : null, timeOfDay: raw?.timeOfDay === 'night' ? 'night' : raw?.timeOfDay === 'day' ? 'day' : null, slots: Array.from({ length: 6 }, (_, index) => {
    const id = raw?.slots?.[index]; return typeof id === 'string' && owned.has(id) && known.has(id) ? id : null;
  }) };
}

export function normalizeDayNightRules(raw = {}) {
  return { enabled: raw?.enabled !== false, initial: raw?.initial === 'night' ? 'night' : 'day', durationMs: Number.isFinite(raw?.durationMs) ? Math.max(10000, Math.min(1800000, Math.round(raw.durationMs))) : 180000 };
}

export function normalizeSeasonRules(raw = {}) {
  return { enabled: raw?.enabled !== false, initial: SEASONS.includes(raw?.initial) ? raw.initial : 'spring', durationMs: Number.isFinite(raw?.durationMs) ? Math.max(10000, Math.min(3600000, Math.round(raw.durationMs))) : 300000 };
}
