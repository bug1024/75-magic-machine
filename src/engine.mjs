export const RARITIES = { common: { label: '闪亮宝物', english: 'STARLIGHT' }, rare: { label: '稀有宝物', english: 'RAINBOW MAGIC' }, super: { label: '超级宝物', english: 'SUPER LUCKY!' } };
export const REVEALS = ['sparkle-bloom', 'rainbow-ring', 'moonrise', 'bubble-pop'];
export const AMBIENTS = ['floating-stars', 'rainbow-trail', 'golden-rain'];
export const SOUNDS = ['magic-chime', 'rainbow-song', 'royal-fanfare', 'bubble-giggle'];
const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
const clamp = (value, min, max, fallback) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
// 校验配置，并为未知效果和不完整字段提供基础表现。
export function normalizeConfig(config) {
  if (config?.version !== 1 || !Array.isArray(config.treasures)) throw new Error('不支持的宝物配置版本');
  const ids = new Set();
  return config.treasures.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) throw new Error('宝物 ID 必须唯一且非空');
    ids.add(item.id);
    const appearance = item.appearance || {}, effects = item.effects || {};
    const image = typeof appearance.image === 'string' && /^(assets\/[^\s]+\.svg|data:image\/(svg\+xml|png|webp|jpeg);base64,[a-z0-9+/=]+)$/i.test(appearance.image) ? appearance.image : '';
    return { id: item.id, name: String(item.name || '神秘宝物'), description: String(item.description || '一份属于你的魔法。'), rarity: RARITIES[item.rarity] ? item.rarity : 'common', weight: Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 0, enabled: item.enabled !== false, appearance: { image, icon: String(appearance.icon || '✨'), primaryColor: color(appearance.primaryColor, '#ba9cff'), accentColor: color(appearance.accentColor, '#ffe1f5') }, effects: { reveal: REVEALS.includes(effects.reveal) ? effects.reveal : REVEALS[0], ambient: AMBIENTS.includes(effects.ambient) ? effects.ambient : AMBIENTS[0], sound: SOUNDS.includes(effects.sound) ? effects.sound : SOUNDS[0], params: { durationMs: clamp(effects.params?.durationMs, 1500, 4000, 2200), particleCount: Math.round(clamp(effects.params?.particleCount, 10, 160, 60)) } } };
  });
}
export function drawTreasure(treasures, random = Math.random, { equalProbability = false } = {}) {
  const pool = treasures.filter(t => t.enabled && t.weight > 0);
  const weightOf = treasure => equalProbability ? 1 : treasure.weight;
  const total = pool.reduce((sum, t) => sum + weightOf(t), 0);
  if (!pool.length || !Number.isFinite(total)) throw new Error('没有可抽取的宝物');
  let cursor = Math.min(1 - Number.EPSILON, Math.max(0, random())) * total;
  for (const treasure of pool) { cursor -= weightOf(treasure); if (cursor < 0) return treasure; }
  return pool[pool.length - 1];
}
export function validHistory(value) {
  return Array.isArray(value) ? value.filter(r => r && typeof r.prizeId === 'string' && typeof r.name === 'string' && Number.isFinite(r.timestamp) && typeof r.drawId === 'string' && RARITIES[r.rarity]).slice(-1000) : [];
}
