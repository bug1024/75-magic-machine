import { readFile, writeFile } from 'node:fs/promises';
import { normalizeConfig } from './src/engine.mjs';
import { normalizeGameConfig } from './src/energy.mjs';
import { normalizeWorldRules } from './src/world-engine.mjs';
const rawGame = JSON.parse(await readFile('game-config.json', 'utf8'));
const gameConfig = { ...normalizeGameConfig(rawGame), world: normalizeWorldRules(rawGame.world) };
for (const event of gameConfig.world.events) if (event.image.startsWith('assets/')) event.image = `data:image/svg+xml;base64,${(await readFile(event.image)).toString('base64')}`;
const config = { version: 1, treasures: normalizeConfig(JSON.parse(await readFile('treasures.json', 'utf8'))) };
for (const treasure of config.treasures) {
  for (const field of ['image', 'interactionImage']) {
    const path = treasure.appearance[field];
    if (!path || path.startsWith('data:')) continue;
    try { treasure.appearance[field] = `data:image/svg+xml;base64,${(await readFile(path)).toString('base64')}`; }
    catch { console.warn(`${treasure.id}：插画无法读取，将使用备用图标。`); treasure.appearance[field] = ''; }
  }
}
const [template, css, gachaCss, engine, chamber, audio, energyEngine, recharge, energyCss, worldEngine, world, worldCss, treasurePlay, treasureCss, evolutionCss, app] = await Promise.all(['src/template.html', 'src/style.css', 'src/gacha.css', 'src/engine.mjs', 'src/chamber.js', 'src/audio.js', 'src/energy.mjs', 'src/recharge.js', 'src/energy.css', 'src/world-engine.mjs', 'src/world.js', 'src/world.css', 'src/treasure-play.js', 'src/treasure-play.css', 'src/evolution.css', 'src/app.js'].map(path => readFile(path, 'utf8')));
const safeConfig = JSON.stringify(config).replace(/</g, '\\u003c');
const html = template.replace('/* INLINE_STYLES */', () => `${css}\n${gachaCss}\n${energyCss}\n${worldCss}\n${treasureCss}\n${evolutionCss}`).replace('/* INLINE_GAME_CONFIG */', () => JSON.stringify(gameConfig).replace(/</g, '\\u003c')).replace('/* INLINE_CONFIG */', () => safeConfig).replace('/* INLINE_SCRIPT */', () => `${engine.replace(/export /g, '')}\n${chamber}\n${audio}\n${energyEngine.replace(/export /g, '')}\n${recharge}\n${worldEngine.replace(/export /g, '')}\n${world}\n${treasurePlay}\n${app}`);
await writeFile('index.html', html);
console.log('已生成 index.html：配置、插画、样式与脚本全部内嵌。');
