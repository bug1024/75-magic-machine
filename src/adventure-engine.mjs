export const FINALE_AT = 75;
export const CROWN_ID = '75-starlight-crown';
export const FINALE_STAGES = ['gather', 'seasons', 'bloom', 'seal', 'love', 'celebrate', 'crown'];
export function normalizeFinale(raw) {
  const complete = raw?.complete === true;
  return { complete, stage: FINALE_STAGES.includes(raw?.stage) ? raw.stage : 'gather', progress: Number.isInteger(raw?.progress) ? Math.max(0, Math.min(3, raw.progress)) : 0, awarded: complete || raw?.awarded === true, redeemed: complete ? ['bat','witch','rock','dragon'] : [] };
}
export function nextFinaleStage(state) {
  const index = FINALE_STAGES.indexOf(state.stage);
  return { ...state, stage: FINALE_STAGES[Math.min(FINALE_STAGES.length - 1, index + 1)], progress: 0 };
}
export function finaleTap(state) {
  if (!['seal','love'].includes(state.stage) || state.progress >= 3) return state;
  return { ...state, progress: state.progress + 1 };
}
export function normalizeAdventureRules(raw) {
  if (raw?.version !== 1) return [];
  const kinds = ['rain','snow','wind','meteors','icecream','coins','sakura','storm'];
  return kinds.flatMap(kind => {
    const item = raw.weather?.find(item => item.kind === kind); if (!item) return [];
    return [{ kind, title: String(item.title || '天气小冒险').slice(0,50), prompt: String(item.prompt || '点点小魔法').slice(0,80), symbol: String(item.symbol || '✦').slice(0,12), souvenir: String(item.souvenir || '天气纪念物').slice(0,50), icon: String(item.icon || '✦').slice(0,12), effect: String(item.effect || 'sparkle'), goal: 3 }];
  });
}
export function normalizeAdventureState(raw) {
  const kinds = ['rain','snow','wind','meteors','icecream','coins','sakura','storm'];
  return { weatherWins: Array.isArray(raw?.weatherWins) ? [...new Set(raw.weatherWins.filter(kind=>kinds.includes(kind)))] : [] };
}
