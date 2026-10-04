// 存档格式独立于稳定的 localStorage key，旧版收藏仍可读。
export function migrateSave(raw) {
  if (raw == null) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || ![1, 2].includes(raw.version)) throw new Error('不支持的存档版本');
  if (!Array.isArray(raw.history) || (raw.inventory != null && (typeof raw.inventory !== 'object' || Array.isArray(raw.inventory)))) throw new Error('存档缺少收藏数据');
  const dates = Object.fromEntries(Object.entries(raw.acquiredAt || {}).filter(([id, date]) => /^[a-z0-9-]{1,64}$/.test(id) && Number.isFinite(date) && date > 0));
  for (const record of raw.history) if (record && typeof record.prizeId === 'string' && Number.isFinite(record.timestamp)) dates[record.prizeId] = Math.max(dates[record.prizeId] || 0, record.timestamp);
  return { ...raw, version: 2, acquiredAt: dates, unread: raw.version === 1 ? [] : Array.isArray(raw.unread) ? [...new Set(raw.unread.filter(id => typeof id === 'string'))] : [], tips: Array.isArray(raw.tips) ? raw.tips.filter(id => typeof id === 'string') : [] };
}
export function collectionOrder(items, inventory, dates, sort = 'owned') {
  const ranks = { common: 0, rare: 1, super: 2 };
  return [...items].sort((a, b) => {
    if (sort === 'recent') return (dates[b.id] || 0) - (dates[a.id] || 0);
    if (sort === 'rarity') return ranks[b.rarity] - ranks[a.rarity] || Number(!!inventory[b.id]) - Number(!!inventory[a.id]);
    return Number(!!inventory[b.id]) - Number(!!inventory[a.id]) || (dates[b.id] || 0) - (dates[a.id] || 0);
  });
}
export class ScenePacing {
  constructor() { this.remaining = 0; }
  quiet(ms) { this.remaining = Math.max(this.remaining, ms); }
  advance(ms, active = true) { if (active) this.remaining = Math.max(0, this.remaining - Math.max(0, ms)); }
  get ready() { return this.remaining === 0; }
}
export function chooseWeather(kinds, weights, random = Math.random) {
  const total = kinds.reduce((sum, kind) => sum + (weights[kind] ?? 1), 0);
  if (!total) return null;
  let cursor = Math.min(.999999, Math.max(0, random())) * total;
  return kinds.find(kind => (cursor -= weights[kind] ?? 1) < 0) || kinds.at(-1);
}
// 低频逻辑不占用显示帧；后台彻底停表，返回时从当前时刻继续。
class ForegroundLoop {
  constructor(callback, cadence = 250) {
    this.callback = callback; this.cadence = cadence; this.timer = null;
    this.onVisibility = () => { clearTimeout(this.timer); this.timer = null; this.previous = performance.now(); this.schedule(); };
    document.addEventListener('visibilitychange', this.onVisibility); this.previous = performance.now(); this.schedule();
  }
  schedule() {
    if (document.hidden || this.timer !== null) return;
    this.timer = setTimeout(() => { this.timer = null; const now = performance.now(), elapsed = Math.min(1000, now - this.previous); this.previous = now; if (!document.hidden) this.callback(now, elapsed); this.schedule(); }, typeof this.cadence === 'function' ? this.cadence() : this.cadence);
  }
}
