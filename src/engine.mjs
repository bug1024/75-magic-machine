export const RARITIES = { common: { label: '闪亮宝物', english: 'STARLIGHT' }, rare: { label: '稀有宝物', english: 'RAINBOW MAGIC' }, super: { label: '超级宝物', english: 'SUPER LUCKY!' } };
export const REVEALS = ['sparkle-bloom', 'rainbow-ring', 'moonrise', 'bubble-pop', 'egg-hatch', 'cloud-puff', 'jelly-bounce', 'dragon-flight', 'mushroom-song', 'seed-sprout', 'rocket-launch', 'sock-dance'];
export const AMBIENTS = ['floating-stars', 'rainbow-trail', 'golden-rain'];
export const INTERACTIONS = ['burp-bubbles', 'candy-rain', 'jelly-hop', 'rainbow-flight', 'mushroom-notes', 'flower-bloom', 'space-trip', 'sock-giggle', 'dress-twirl', 'castle-glow', 'dolphin-dive', 'owl-peek', 'snow-wobble', 'bubble-scrub', 'coin-jingle', 'gem-sparkle', 'rainbow-toot', 'warm-hug', 'cat-purr', 'wheel-zoom', 'wand-spell', 'bubble-shot', 'ear-wiggle', 'wiggle-drive', 'alarm-ring', 'whale-spout'];
export const SOUNDS = ['magic-chime', 'rainbow-song', 'royal-fanfare', 'bubble-giggle', ...INTERACTIONS];
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
    const interactionImage = typeof appearance.interactionImage === 'string' && /^(assets\/[^\s]+\.svg|data:image\/svg\+xml;base64,[a-z0-9+/=]+)$/i.test(appearance.interactionImage) ? appearance.interactionImage : '';
    return { id: item.id, tags: Array.isArray(item.tags) ? [...new Set(item.tags.filter(tag => typeof tag === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(tag)))].slice(0, 16) : [], name: String(item.name || '神秘宝物'), description: String(item.description || '一份属于你的魔法。'), rarity: RARITIES[item.rarity] ? item.rarity : 'common', weight: Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 0, enabled: item.enabled !== false, appearance: { image, interactionImage, icon: String(appearance.icon || '✨'), primaryColor: color(appearance.primaryColor, '#ba9cff'), accentColor: color(appearance.accentColor, '#ffe1f5') }, effects: { interactionLines: Array.isArray(effects.interactionLines) ? effects.interactionLines.filter(line => typeof line === 'string' && line.trim()).slice(0, 4).map(line => line.slice(0, 80)) : [], interactionSymbols: Array.isArray(effects.interactionSymbols) ? effects.interactionSymbols.filter(symbol => typeof symbol === 'string' && symbol.trim()).slice(0, 4).map(symbol => symbol.slice(0, 12)) : [], interaction: INTERACTIONS.includes(effects.interaction) ? effects.interaction : '', reveal: REVEALS.includes(effects.reveal) ? effects.reveal : REVEALS[0], ambient: AMBIENTS.includes(effects.ambient) ? effects.ambient : AMBIENTS[0], sound: SOUNDS.includes(effects.sound) ? effects.sound : SOUNDS[0], params: { durationMs: clamp(effects.params?.durationMs, 1500, 4000, 2200), particleCount: Math.round(clamp(effects.params?.particleCount, 10, 160, 60)) } } };
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

// 数量独立于最近1000条开奖历史，旧存档从已有记录迁移。
export function normalizeInventory(saved, history) {
  const result = Object.create(null);
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const [id, count] of Object.entries(saved)) if (id && Number.isSafeInteger(count) && count > 0) result[id] = count;
  } else for (const record of history) result[record.prizeId] = (result[record.prizeId] || 0) + 1;
  return result;
}
