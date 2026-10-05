// 主场景里的故事遗物和天气小游戏，无常驻绘制循环。
class GardenAdventures {
  constructor(garden, rules) {
    this.garden = garden; this.rules = rules; this.active = null; this.clock = 0; this.playing = false;
    this.shelf = document.getElementById('garden-keepsakes'); this.game = document.getElementById('weather-play');
    document.getElementById('weather-play-close').onclick = () => garden.endWeather();
    new ForegroundLoop((now, elapsed) => {
      if (!this.active) return;
      const active = garden.callbacks.canWeather() && !document.hidden;
      this.game.classList.toggle('adventure-paused', !active);
      this.game.inert = !active;
      if (active) { this.clock += elapsed; if (this.playing && this.clock >= 4000) this.stopWeather(); }
    }, () => this.active ? 250 : 1000);
    this.memoryPage=0;this.render();
    this.shelfResize=new ResizeObserver(()=>this.layoutMemories());this.shelfResize.observe(this.shelf);
  }
  render() {
    this.shelf.replaceChildren();
    const memories = this.garden.stories.rules.filter(story => this.garden.state.discovered.includes(story.id) && story.keepsake).map(story=>({...story.keepsake, effect:story.effect, kind:story.effect, storyId:story.id}));
    for (const kind of this.garden.state.adventures.weatherWins) {
      const rule = this.rules.find(rule=>rule.kind===kind); if (rule) memories.push({id:`weather-${kind}`,name:rule.souvenir,icon:rule.icon,line:`${rule.souvenir}记得你和伙伴一起玩的那一天！`,effect:rule.effect,kind});
    }
    memories.push(...(this.garden.workshop?.memories() || []));
    this.shelf.hidden = !memories.length;
    const previous=document.createElement('button'),next=document.createElement('button'),strip=document.createElement('div');
    previous.type=next.type='button';previous.className=next.className='memory-page-button';previous.textContent='‹';next.textContent='›';previous.setAttribute('aria-label','上一页花园景物');next.setAttribute('aria-label','下一页花园景物');
    strip.className='keepsake-strip';this.memoryStrip=strip;this.memoryPrevious=previous;this.memoryNext=next;
    previous.onclick=()=>{this.memoryPage--;this.layoutMemories();};next.onclick=()=>{this.memoryPage++;this.layoutMemories();};
    this.shelf.append(previous,strip,next);
    for (const memory of memories) {
      const button=document.createElement('button');button.type='button';button.className='garden-keepsake';button.dataset.memory=memory.id;button.setAttribute('aria-label',`和${memory.name}玩一玩`);button.title=memory.name;
      const art=document.createElement('span');art.className='memory-art';art.innerHTML=this.art(memory.kind,memory.icon);
      const name=document.createElement('span');name.textContent=memory.name;name.className='memory-name';button.append(art,name);
      this.garden.workshop?.facility(memory,button);button.onclick=()=>{if(!this.garden.workshop?.useFacility(memory,button))this.playMemory(button,memory);};strip.append(button);
    }
    this.layoutMemories();
  }
  layoutMemories() {
    if(this.shelf.hidden||!this.memoryStrip)return;
    const width=this.shelf.clientWidth,itemWidth=innerWidth<=650?70:105;
    const capacity=Math.max(2,Math.min(6,Math.floor((width-76)/itemWidth)));
    this.memoryCapacity=capacity;
    const buttons=[...this.memoryStrip.children],pages=Math.max(1,Math.ceil(buttons.length/capacity));
    this.memoryPage=Math.max(0,Math.min(this.memoryPage,pages-1));
    this.memoryStrip.style.setProperty('--memory-slots',Math.min(capacity,buttons.length));
    buttons.forEach((button,index)=>{button.hidden=Math.floor(index/capacity)!==this.memoryPage;});
    this.memoryPrevious.hidden=this.memoryNext.hidden=pages===1;
    this.memoryPrevious.disabled=this.memoryPage===0;this.memoryNext.disabled=this.memoryPage===pages-1;
    this.memoryStrip.setAttribute('aria-label',`花园景物，第${this.memoryPage+1}页，共${pages}页`);
  }
  revealMemory(id) {
    const buttons=[...this.memoryStrip.children],index=buttons.findIndex(b=>b.dataset.memory===id);
    if(index<0)return;
    this.memoryPage=Math.floor(index/this.memoryCapacity);this.layoutMemories();
  }
  art(kind, icon) {
    const shapes = {
      'wish-ocean':'<path d="M30 80V15h7v65" fill="#e4c3a4"/><path d="M37 15h72l-18 20 18 20H37Z" fill="#9eddeb" stroke="#e3fcff" stroke-width="3"/><path d="M56 36q10-16 30-1q-14 13-30 1l-7 6V29Z" fill="#8698de"/>',
      'wish-forest':'<path d="M64 80V48" stroke="#e0bba0" stroke-width="8"/><path d="M31 25h66v35H31Z" fill="#e6d19b"/><path d="m21 28 43-24 43 24Z" fill="#d59fc4" stroke="#ffedc2" stroke-width="3"/><circle cx="64" cy="37" r="10" fill="#8a709f"/><path d="M45 58h38" stroke="#85b994" stroke-width="5"/>',
      'wish-hug':'<path d="M25 34h78l14 40H11Z" fill="#e9a9c5" stroke="#fff0cc" stroke-width="3"/><path d="M27 43h76M23 57h84M44 35l-7 38m44-38 7 38" stroke="#ffe2cf" stroke-width="3"/><path d="M64 44c-13-14-24 4 0 18c24-14 13-32 0-18Z" fill="#f273a4"/>',
      'wish-ball':'<path d="M64 34v49" stroke="#e3c19f" stroke-width="7"/><path d="M64 34 33 5v29Zm0 0L94 5v29Zm0 0 30 30H64Zm0 0L33 64V34Z" fill="#cbade8" stroke="#fff0ca" stroke-width="3"/><path d="M55 33q-22-22-21-3q0 17 21 11m18-8q22-22 21-3q0 17-21 11" fill="#ffb4d6"/><circle cx="64" cy="35" r="6" fill="#ffe08b"/>',
      'wish-weather':'<path d="M22 77V48a42 42 0 0 1 84 0v29" stroke="#f6adbf" stroke-width="11" fill="none"/><path d="M30 77V48a34 34 0 0 1 68 0v29" stroke="#ffdfa0" stroke-width="8" fill="none"/><path d="M37 77V48a27 27 0 0 1 54 0v29" stroke="#addeda" stroke-width="6" fill="none"/>',
      'wish-guardian':'<path d="M38 80V10" stroke="#e2c59d" stroke-width="7"/><path d="M42 12h63l-12 22 12 23H42Z" fill="#b69ade" stroke="#ffefbf" stroke-width="3"/><path d="m71 22 15 5v12q0 9-15 16q-15-7-15-16V27Z" fill="#ffdf95"/><path d="m64 37 5 5 11-12" stroke="#af77aa" stroke-width="4" fill="none"/>',
      forest:'<path d="M38 79V38m25 41V27m26 52V43" stroke="#63b983" stroke-width="5"/><g fill="#ffbfda"><circle cx="38" cy="36" r="14"/><circle cx="89" cy="39" r="13"/></g><circle cx="63" cy="25" r="16" fill="#ffe695"/><g fill="#bd70a5"><circle cx="38" cy="36" r="5"/><circle cx="63" cy="25" r="5"/><circle cx="89" cy="39" r="5"/></g>',
      ocean:'<ellipse cx="64" cy="61" rx="52" ry="24" fill="#62c8dc" stroke="#b2f1ed" stroke-width="5"/><path d="M26 60q10-7 20 0t20 0t20 0t16 0" stroke="#e0ffff" stroke-width="3" fill="none"/><path d="M51 44q17-17 30-2q-16 17-30 2l-11 9v-19Z" fill="#76a4dd"/>',
      lunar:'<path d="M15 76Q64 6 113 76" fill="none" stroke="#8acfea" stroke-width="12"/><path d="M15 76Q64 6 113 76" fill="none" stroke="#fff3c2" stroke-width="3" stroke-dasharray="5 8"/><path d="M91 13q-15 20 8 31q-26 9-28-11q0-17 20-20Z" fill="#ffe89d"/>',
      secret:'<path d="M64 79V40m0 20q-26-19-30-4m30 9q26-19 30-4" stroke="#79d19c" stroke-width="5" fill="none"/><path d="m64 11 9 17 19 3-14 14 3 20-17-9-17 9 3-20-14-14 19-3Z" fill="#ffe39e"/>',
      race:'<ellipse cx="64" cy="64" rx="50" ry="18" fill="none" stroke="#bddf95" stroke-width="12"/><path d="M95 59V12h22v20H95" stroke="#fff0c4" stroke-width="4"/><path d="M99 14h16v15H99Z" fill="#966b9c"/>',
      hug:'<rect x="23" y="38" width="82" height="30" rx="12" fill="#d79cbe"/><path d="M30 67v15m67-15v15M23 50H13v20m92-20h10v20" stroke="#ffe5be" stroke-width="6"/><path d="M64 17c-18-18-30 2 0 20c30-18 18-38 0-20Z" fill="#ff9dc2"/>',
      sparkle:'<path d="m20 56 17-26h54l17 26-44 29Z" fill="#ad99ee" stroke="#eee0ff" stroke-width="3"/><path d="m37 30 27 55 27-55M20 56h88" stroke="#f7f0ff" stroke-width="3"/>',
      picnic:'<ellipse cx="64" cy="56" rx="49" ry="16" fill="#d6b797"/><path d="M36 64v18m56-18v18" stroke="#f2d5b4" stroke-width="7"/><path d="M39 29h20v21H39Zm36-2h21v21H75Z" fill="#9dddea"/><path d="M59 34q15 7 0 13m37-15q15 7 0 13" stroke="#bde8f1" stroke-width="4" fill="none"/>',
      snow:'<circle cx="64" cy="64" r="23" fill="#ebfaff"/><circle cx="64" cy="30" r="17" fill="#fff"/><path d="M46 45h35" stroke="#eb9ec4" stroke-width="6"/><circle cx="58" cy="28" r="2"/><circle cx="71" cy="28" r="2"/><path d="m65 32 9 3-9 3Z" fill="#ffa965"/><path d="M47 14h34l-6-12H53Z" fill="#aa8bd2"/>',
      wind:'<path d="M64 44v41" stroke="#d6b893" stroke-width="6"/><path d="M64 44 34 14v30Zm0 0 30-30v30Zm0 0 30 30H64Zm0 0L34 74V44Z" fill="#c3a4e9" stroke="#fff0d1" stroke-width="2"/>',
      icecream:'<path d="M64 75V25" stroke="#d6b893" stroke-width="8"/><g fill="#ffc3de"><circle cx="43" cy="35" r="20"/><circle cx="84" cy="35" r="20"/><circle cx="64" cy="17" r="17"/></g><path d="M45 40q19 40 38 0Z" fill="#f4d7a2"/>',
      coins:'<ellipse cx="64" cy="68" rx="43" ry="17" fill="#91d9e6"/><path d="M64 64V22m0 0q-27 0-25 22m25-22q27 0 25 22" stroke="#fff1a8" stroke-width="5" fill="none"/><circle cx="64" cy="16" r="12" fill="#ffd14e" stroke="#fff2b2" stroke-width="3"/>',
      sakura:'<ellipse cx="64" cy="49" rx="40" ry="26" fill="none" stroke="#94c987" stroke-width="7"/><g fill="#ffc7df"><circle cx="28" cy="43" r="11"/><circle cx="64" cy="25" r="12"/><circle cx="99" cy="43" r="11"/><circle cx="64" cy="72" r="11"/></g>',
      storm:'<path d="M27 50v33m74-33v33" stroke="#dab9a1" stroke-width="6"/><path d="M16 48Q64-13 112 48" fill="none" stroke="#f5adc9" stroke-width="10"/><path d="M16 51Q64-10 112 51" fill="none" stroke="#ffe299" stroke-width="5"/>'
    };
    return `<svg viewBox="0 0 128 90" aria-hidden="true"><ellipse cx="64" cy="81" rx="53" ry="8" fill="#274e3e" opacity=".3"/>${shapes[kind]||shapes[{rain:'forest',meteors:'secret',ball:'storm',prank:'lunar'}[kind]]||shapes.sparkle}<text x="102" y="22" font-size="17">${icon.replace(/[<>&]/g, ch=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[ch]))}</text></svg>`;
  }
  playMemory(button,memory) {
    if (!this.garden.callbacks.canPlay() || this.garden.chosen) return;
    clearTimeout(this.memoryTimer);this.shelf.querySelectorAll('.memory-bits').forEach(node=>node.remove());this.shelf.querySelectorAll('[data-playing]').forEach(node=>delete node.dataset.playing);
    button.dataset.playing='true';const bits=document.createElement('span');bits.className='memory-bits';bits.setAttribute('aria-hidden','true');
    const symbols={forest:['♪','♫','✿'],ocean:['🫧','🐬','🐟'],lunar:['🫧','🌙','🐬'],hug:['💗','🐾','💕'],race:['🍃','🏁','🛴'],snow:['❄','🐧','⛄'],coins:['🟡','✨','🟡'],picnic:['🫧','🐳','☕']}[memory.kind]||[memory.icon,'✦','💗'];
    for(let i=0;i<9;i++){const bit=document.createElement('i');bit.textContent=symbols[i%symbols.length];bit.style.setProperty('--i',i);bits.append(bit);}button.append(bits);
    const message=document.getElementById('garden-memory-message');message.hidden=false;message.textContent=memory.line;document.getElementById('announcement').textContent=memory.line;
    this.garden.callbacks.unlock().then(()=>{if(this.garden.callbacks.canPlay())this.garden.callbacks.storySound(memory.effect,this.garden.state.timeOfDay,this.garden.weather);});
    this.memoryTimer=setTimeout(()=>{delete button.dataset.playing;bits.remove();message.hidden=true;},3000);
  }
  startWeather(kind) {
    this.stopWeather();const rule=this.rules.find(rule=>rule.kind===kind);if(!rule)return;
    this.active=rule;this.clock=0;this.playing=false;this.hits=0;this.game.hidden=false;this.game.inert=false;
    this.game.dataset.kind=kind;document.getElementById('weather-play-title').textContent=rule.title;document.getElementById('weather-play-prompt').textContent=rule.prompt;
    this.updateProgress();const targets=document.getElementById('weather-play-targets');targets.replaceChildren();
    for(let i=0;i<3;i++){const target=document.createElement('button');target.type='button';target.className='weather-target';target.style.setProperty('--i',i);target.textContent=rule.symbol;target.setAttribute('aria-label',`${rule.prompt}，第${i+1}个`);target.onclick=()=>this.catch(target);targets.append(target);}
  }
  updateProgress(){document.getElementById('weather-play-progress').textContent=`${'★'.repeat(this.hits)}${'☆'.repeat(3-this.hits)}`;}
  catch(target) {
    if(!this.active||this.playing||target.disabled||!this.garden.callbacks.canWeather()||document.hidden)return;
    target.disabled=true;target.classList.add('caught');this.hits++;this.updateProgress();this.garden.callbacks.sound('gem-sparkle',this.hits);
    if(this.hits<3)return;
    const first=!this.garden.state.adventures.weatherWins.includes(this.active.kind);if(first)this.garden.state.adventures.weatherWins.push(this.active.kind);
    this.garden.callbacks.reward(first?2:1);this.garden.callbacks.save();this.render();this.playing=true;this.clock=0;
    document.getElementById('weather-play-prompt').textContent=first?`${this.active.souvenir}留在花园啦！♥ +2`:'又和伙伴玩了一次！♥ +1';
    document.getElementById('announcement').textContent=document.getElementById('weather-play-prompt').textContent;this.garden.callbacks.storySound(this.active.effect,this.garden.state.timeOfDay,this.active.kind);
  }
  stopWeather(){this.active=null;this.playing=false;this.game.hidden=true;this.game.inert=false;document.getElementById('weather-play-targets').replaceChildren();}
}
