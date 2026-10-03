import { readFile, writeFile } from 'node:fs/promises';
import { normalizeConfig } from './src/engine.mjs';
const config = { version: 1, treasures: normalizeConfig(JSON.parse(await readFile('treasures.json', 'utf8'))) };
for (const treasure of config.treasures) {
  if (!treasure.appearance.image || treasure.appearance.image.startsWith('data:')) continue;
  try {
    const asset = await readFile(treasure.appearance.image);
    treasure.appearance.image = `data:image/svg+xml;base64,${asset.toString('base64')}`;
  } catch {
    console.warn(`${treasure.id}：插画无法读取，将使用备用图标。`);
    treasure.appearance.image = '';
  }
}
const [template, css, gachaCss, engine, chamber, audio, app] = await Promise.all(['src/template.html', 'src/style.css', 'src/gacha.css', 'src/engine.mjs', 'src/chamber.js', 'src/audio.js', 'src/app.js'].map(path => readFile(path, 'utf8')));
const safeConfig = JSON.stringify(config).replace(/</g, '\\u003c');
const html = template.replace('/* INLINE_STYLES */', () => `${css}\n${gachaCss}`).replace('/* INLINE_CONFIG */', () => safeConfig).replace('/* INLINE_SCRIPT */', () => `${engine.replace(/export /g, '')}\n${chamber}\n${audio}\n${app}`);
await writeFile('index.html', html);
console.log('已生成 index.html：配置、插画、样式与脚本全部内嵌。');
