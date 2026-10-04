import { spawnSync } from 'node:child_process';
// 无服务器、独立临时浏览器环境，绝不修改正在游玩的存档。
const suites=['garden-finale-browser.mjs','performance-browser.mjs','visitors-browser.mjs','experience-browser.mjs','pacing-browser.mjs','space-key-browser.mjs','guardian-placement-browser.mjs','new-treasures-browser.mjs','interaction-audio-browser.mjs'];
for(const suite of suites){
 console.log(`\nBrowser regression: ${suite}`);
 const result=spawnSync(process.execPath,[`tests/${suite}`],{stdio:'inherit',env:process.env,timeout:240000});
 if(result.error){console.error(result.error.message);process.exit(1);}
 if(result.status!==0)process.exit(result.status||1);
}
