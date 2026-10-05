export const WISH_IDS = ['ocean-friends', 'forest-song', 'mom-hug', 'magic-dance', 'weather-friend', 'little-guardian'];
export function normalizeWishRules(raw, stories) {
  if (raw?.version !== 1 || !Array.isArray(raw.wishes)) return [];
  const seen = new Set();
  return raw.wishes.flatMap(item => {
    if (!WISH_IDS.includes(item?.id) || seen.has(item.id) || !['story', 'weather', 'guardian'].includes(item.kind) || (item.kind === 'story' && !stories.some(story => story.id === item.storyId && story.enabled))) return [];
    seen.add(item.id);
    return [{ ...item, name: String(item.name || '伙伴小心愿').slice(0, 50), line: String(item.line || '和伙伴一起玩！').slice(0, 100), souvenir: String(item.souvenir || '心愿小装饰').slice(0, 40), memoryLine: String(item.memoryLine || '花园记得这个心愿！').slice(0, 100), icon: String(item.icon || '✦').slice(0, 12), memoryKind: /^wish-[a-z]+$/.test(item.memoryKind) ? item.memoryKind : 'wish-guardian', effect: ['ocean', 'forest', 'hug', 'ball', 'sparkle'].includes(item.effect) ? item.effect : 'sparkle' }];
  });
}
export function normalizeWishState(raw) {
  return { active: WISH_IDS.includes(raw?.active) ? raw.active : null, completed: Array.isArray(raw?.completed) ? [...new Set(raw.completed.filter(id => WISH_IDS.includes(id)))] : [], storyWins: Array.isArray(raw?.storyWins) ? [...new Set(raw.storyWins.filter(id => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id)))].slice(0, 64) : [], battleWins: Number.isSafeInteger(raw?.battleWins) ? Math.max(0, Math.min(100000, raw.battleWins)) : 0 };
}
// 每个组合角色由不同伙伴担任。优先已有且已摆放的伙伴，不能用同一个多标签宝物顶两位。
export function planWishStory(story, treasures, inventory, slots) {
  if (!story?.enabled) return null;
  const needs = story.requirements.flatMap(role => Array(role.count).fill(role));
  const options = needs.map(role => treasures.filter(t => (t.enabled && t.weight > 0 || inventory[t.id] > 0) && t.tags?.includes(role.tag) && (!role.id || role.id === t.id)));
  let best = null, cost = Infinity;
  const price = item => (inventory[item.id] > 0 ? 0 : 100) + (slots.includes(item.id) ? 0 : 1);
  function assign(index, selected, total) {
    if (total >= cost) return;
    if (index === needs.length) { best = selected; cost = total; return; }
    for (const item of [...options[index]].sort((a, b) => price(a) - price(b))) if (!selected.some(chosen => chosen.id === item.id)) assign(index + 1, [...selected, item], total + price(item));
  }
  assign(0, [], 0);
  return best?.map((item, index) => ({ id: item.id, tag: needs[index].tag, owned: inventory[item.id] > 0, placed: slots.includes(item.id), candidates: options[index].filter(t => !best.some((other, j) => j !== index && other.id === t.id)).map(t => t.id) })) || null;
}
export function wishProgress(wish, state, stories, treasures, inventory, slots, weatherWins = []) {
  if (wish.kind === 'story') {
    const partners = planWishStory(stories.find(story => story.id === wish.storyId), treasures, inventory, slots) || [];
    return { partners, missing: partners.filter(p => !p.owned).length, placed: partners.filter(p => p.placed).length, ready: state.storyWins.includes(wish.storyId), rank: partners.length ? partners.every(p => p.owned) ? 0 : partners.some(p => p.owned) ? 2 : 4 : 5 };
  }
  if (wish.kind === 'guardian') {
    const candidates = treasures.filter(t => t.effects?.guardian && (t.enabled && t.weight > 0 || inventory[t.id] > 0)).sort((a, b) => Number(slots.includes(b.id)) - Number(slots.includes(a.id)) || Number(inventory[b.id] > 0) - Number(inventory[a.id] > 0));
    const item = candidates[0];
    return { partners: item ? [{ id: item.id, owned: inventory[item.id] > 0, placed: slots.includes(item.id), candidates: candidates.map(t => t.id) }] : [], missing: inventory[item?.id] > 0 ? 0 : 1, ready: state.battleWins > 0, rank: inventory[item?.id] > 0 ? 2 : 4 };
  }
  return { partners: [], missing: 0, ready: weatherWins.length > 0, rank: 3 };
}
export function pickWish(rules, state, stories, treasures, inventory, slots, weatherWins, skip = null) {
  if (!Object.values(inventory).some(count => count > 0)) return null;
  const remaining = rules.filter(wish => !state.completed.includes(wish.id));
  const ordered = remaining.map(wish => ({ wish, progress: wishProgress(wish, state, stories, treasures, inventory, slots, weatherWins) })).sort((a, b) => Number(b.progress.ready) - Number(a.progress.ready) || a.progress.rank - b.progress.rank || a.progress.missing - b.progress.missing);
  const index = ordered.findIndex(item => item.wish.id === skip);
  return ordered[(index + 1) % ordered.length]?.wish.id || null;
}
export function completeWish(state, wish, progress) {
  if (!progress.ready || state.completed.includes(wish.id)) return state;
  return { ...state, active: wish.id, completed: [...state.completed, wish.id] };
}
