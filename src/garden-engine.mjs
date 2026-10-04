export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const WEATHER_KINDS = ['rain', 'snow', 'wind', 'meteors'];
export function normalizeWeatherRules(raw = {}) {
  const bounded = (value, fallback, min, max) => Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  return { enabled: raw.enabled !== false, firstAfterMs: bounded(raw.firstAfterMs, 12000, 1000, 300000), intervalMs: bounded(raw.intervalMs, 40000, 5000, 300000), durationMs: bounded(raw.durationMs, 16000, 3000, 60000), kinds: WEATHER_KINDS.filter(kind => !Array.isArray(raw.kinds) || raw.kinds.includes(kind)) };
}
export function normalizeGardenState(raw, treasures, history, inventory = null) {
  const owned = inventory || history.reduce((counts, record) => { counts[record.prizeId] = (counts[record.prizeId] || 0) + 1; return counts; }, Object.create(null));
  const used = Object.create(null);
  const known = new Set(treasures.map(treasure => treasure.id));
  return { discovered: Array.isArray(raw?.discovered) ? [...new Set(raw.discovered.filter(id => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id)))].slice(0, 256) : [], season: SEASONS.includes(raw?.season) ? raw.season : null, timeOfDay: raw?.timeOfDay === 'night' ? 'night' : raw?.timeOfDay === 'day' ? 'day' : null, slots: Array.from({ length: 6 }, (_, index) => {
    const id = raw?.slots?.[index];
    if (typeof id !== 'string' || !known.has(id) || (used[id] || 0) >= (owned[id] || 0)) return null;
    used[id] = (used[id] || 0) + 1; return id;
  }) };
}

export function normalizeDayNightRules(raw = {}) {
  return { enabled: raw?.enabled !== false, initial: raw?.initial === 'night' ? 'night' : 'day', durationMs: Number.isFinite(raw?.durationMs) ? Math.max(10000, Math.min(1800000, Math.round(raw.durationMs))) : 180000 };
}

export function normalizeSeasonRules(raw = {}) {
  return { enabled: raw?.enabled !== false, initial: SEASONS.includes(raw?.initial) ? raw.initial : 'spring', durationMs: Number.isFinite(raw?.durationMs) ? Math.max(10000, Math.min(3600000, Math.round(raw.durationMs))) : 300000 };
}

export const STORY_EFFECTS = ['forest', 'ocean', 'ball', 'prank', 'lunar', 'secret', 'race', 'hug', 'sparkle', 'picnic'];
export function normalizeStoryRules(raw) {
  if (raw?.version !== 1 || !Array.isArray(raw.stories)) return [];
  const seen = new Set();
  return raw.stories.flatMap(item => {
    if (!item || !/^[a-z0-9-]{1,64}$/.test(item.id || '') || seen.has(item.id) || !STORY_EFFECTS.includes(item.effect)) return [];
    const requirements = Array.isArray(item.requirements) ? item.requirements.filter(r => r && /^[a-z][a-z0-9-]{0,31}$/.test(r.tag || '') && Number.isInteger(r.count) && r.count >= 1 && r.count <= 6 && (r.id == null || typeof r.id === 'string' && /^[a-z0-9-]{1,64}$/.test(r.id))).map(r => ({ tag: r.tag, count: r.count, ...(r.id ? { id: r.id } : {}) })) : [];
    if (!requirements.length || requirements.length !== item.requirements.length || requirements.reduce((sum, r) => sum + r.count, 0) > 6) return [];
    seen.add(item.id);
    return [{ id: item.id, name: String(item.name || '花园故事'), icon: String(item.icon || '✦'), hint: String(item.hint || '试试把不同伙伴放在一起。'), lines: Array.isArray(item.lines) ? item.lines.filter(line => typeof line === 'string' && line.trim()).slice(0, 3).map(line => line.slice(0, 100)) : [], enabled: item.enabled !== false, effect: item.effect, requirements, durationMs: Number.isFinite(item.durationMs) ? Math.max(3000, Math.min(15000, Math.round(item.durationMs))) : 6500, energyReward: Number.isInteger(item.energyReward) ? Math.max(0, Math.min(3, item.energyReward)) : 1 }];
  });
}
// 一件宝物只担任一个组合角色，重复摆放同种宝物不会充当不同伙伴。
export function matchGardenStory(story, slots, treasures) {
  const items = [...new Set(slots.filter(Boolean))].map(id => treasures.find(item => item.id === id)).filter(Boolean);
  const needs = story.requirements.flatMap(r => Array(r.count).fill(r));
  function assign(index, used) {
    if (index === needs.length) return used;
    for (const item of items) if (!used.includes(item.id) && item.tags?.includes(needs[index].tag) && (!needs[index].id || item.id === needs[index].id)) { const result = assign(index + 1, [...used, item.id]); if (result) return result; }
    return null;
  }
  return story.enabled ? assign(0, []) : null;
}
