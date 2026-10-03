// 可选插画预览：使用本机已安装的 Playwright，不参与游戏运行。
import { readFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const config = JSON.parse(await readFile('treasures.json', 'utf8'));
const additions = config.treasures.slice(3);
const cards = await Promise.all(additions.map(async treasure => {
  const svg = await readFile(treasure.appearance.image);
  return `<article><img src="data:image/svg+xml;base64,${svg.toString('base64')}"><h2>${treasure.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</h2></article>`;
}));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 690 } });
  await page.setContent(`<html lang="zh-CN"><meta charset="utf-8"><style>
    body{margin:0;padding:24px;background:#17162f;color:#eee4ff;font-family:'Avenir Next','PingFang SC',sans-serif}
    header{display:flex;justify-content:space-between;align-items:center;margin:0 6px 22px}h1{font-size:23px;margin:0}header span{color:#baa8cf;font-size:12px}
    main{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}article{background:linear-gradient(145deg,#3c2a4d,#212443);border:1px solid #af91c63b;border-radius:22px;text-align:center}
    img{width:100%;height:235px;display:block}h2{font-size:17px;margin:0 0 18px}
    </style><header><h1>75's MAGIC MACHINE · 新宝物</h1><span>${additions.length} LITTLE WONDERS</span></header><main>${cards.join('')}</main></html>`);
  await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/treasures-preview.png', fullPage: true });
  console.log('已生成 artifacts/treasures-preview.png');
} finally { await browser.close(); }
