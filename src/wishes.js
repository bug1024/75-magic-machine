// 魔法台只读取进度，不创建新的事件队列或常驻动画。
class MagicWorkshop {
  constructor(garden, legacy, callbacks) {
    this.garden=garden;this.legacy=legacy;this.callbacks=callbacks;this.panel=document.getElementById('garden-wish');this.machine=document.getElementById('machine');this.busy=false;
    this.challengeMenu=document.querySelector('.garden-challenge-menu');
    document.getElementById('challenge-close').onclick=()=>{this.challengeMenu.open=false;this.challengeMenu.querySelector('summary').focus();};
    document.addEventListener('pointerdown',e=>{if(!this.challengeMenu.contains(e.target))this.challengeMenu.open=false;});
    document.getElementById('workshop-open').onclick=()=>{if(this.canUse()){if(this.panel.hidden){this.open();if(this.goalReady)this.invite();}else this.close();}};
    document.getElementById('workshop-close').onclick=()=>this.close();document.getElementById('lottery-mode').onclick=()=>{if(!this.busy)this.close();};
    document.getElementById('wish-speak').onclick=()=>callbacks.voice(this.current()?.hint||'邀请伙伴，一起创造魔法！');
    document.getElementById('wish-swap').onclick=()=>{if(this.canUse()){const list=garden.stories.rules,index=list.findIndex(s=>s.id===this.state.active);this.select(list[(index+1)%list.length].id);}};
    document.getElementById('wish-invite').onclick=()=>this.invite();
    document.getElementById('wish-action').onclick=()=>this.synthesize();
    document.getElementById('workshop-weather').onclick=async()=>{if(!this.canUse())return;this.challengeMenu.open=false;this.close();await garden.callbacks.unlock();if(this.canUse())garden.startWeather(true);};
    document.getElementById('craft-goal-speak').onclick=()=>{if(this.canUse())this.callbacks.voice(this.goalLine||this.current().hint);};
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(this.challengeMenu.open){this.challengeMenu.open=false;this.challengeMenu.querySelector('summary').focus();}this.close();}});this.sync();
  }
  get state(){return this.garden.state.workshop;}
  current(){return this.garden.stories.rules.find(s=>s.id===this.state.active)||this.garden.stories.rules[0];}
  canUse(){return !this.busy&&this.garden.callbacks.canPlay()&&this.callbacks.canUse();}
  close(){if(this.busy)return;this.panel.hidden=true;delete this.machine.dataset.mode;document.getElementById('wish-action').hidden=true;document.getElementById('workshop-open').setAttribute('aria-pressed','false');document.getElementById('lottery-mode').setAttribute('aria-pressed','true');}
  open(){if(this.canUse()){this.panel.hidden=false;this.machine.dataset.mode='craft';document.getElementById('workshop-result').hidden=true;document.getElementById('workshop-open').setAttribute('aria-pressed','true');document.getElementById('lottery-mode').setAttribute('aria-pressed','false');this.sync();}}
  select(id){if(!this.canUse())return;this.state.active=id;this.state.tray=[];this.callbacks.save();this.open();}
  partners(){const used=new Set();const matched=matchGardenStory(this.current(),Object.keys(this.garden.callbacks.inventory()).filter(id=>this.garden.callbacks.inventory()[id]>0),this.garden.treasures);let index=0;return this.current().requirements.flatMap(role=>Array.from({length:role.count},()=>{const candidates=this.garden.treasures.filter(t=>!used.has(t.id)&&t.tags.includes(role.tag)&&(!role.id||role.id===t.id));const t=(matched&&this.garden.treasures.find(t=>t.id===matched[index++]))||candidates.find(t=>this.garden.callbacks.inventory()[t.id]>0)||candidates[0];if(t)used.add(t.id);return {treasure:t,candidates:candidates.map(t=>t.id)};}));}
  invite(){if(!this.canUse())return;document.getElementById('workshop-result').hidden=true;this.state.tray=this.partners().map(p=>this.garden.callbacks.inventory()[p.treasure?.id]>0?p.treasure.id:null);this.callbacks.save();}
  put(id,index){document.getElementById('workshop-result').hidden=true;if(!this.garden.callbacks.inventory()[id]||this.state.tray.includes(id))return;this.state.tray[index]=id;this.state.tray=this.state.tray.slice(0,3);this.callbacks.save();}
  sync(){
    const story=this.current();if(!story)return;this.state.active=story.id;this.renderGoal();if(this.busy)return;
    if(this.state.focusId&&this.garden.callbacks.inventory()[this.state.focusId]){this.state.focusId=null;this.state.focusRemaining=0;}
    document.getElementById('wish-title').textContent=story.name;document.getElementById('wish-count').textContent=`${this.garden.state.discovered.length}/10`;
    document.getElementById('wish-line').textContent=story.hint;document.getElementById('wish-swap').hidden=false;
    const recipe=document.getElementById('wish-recipe');recipe.replaceChildren();
    this.partners().forEach((p,index)=>{const t=this.garden.treasures.find(t=>t.id===this.state.tray[index]);const b=document.createElement('button');b.type='button';b.className='wish-partner';b.dataset.tray=index;b.style.setProperty('--partner',index);b.style.setProperty('--count',this.partners().length);const art=document.createElement('span');art.className='wish-portrait';if(t)this.garden.callbacks.art(t,art);else if(p.treasure){this.garden.callbacks.art(p.treasure,art);art.classList.add('slot-preview');}else art.textContent='＋';const label=document.createElement('span');label.textContent=t?t.name:this.garden.callbacks.inventory()[p.treasure?.id]?`放入${p.treasure.name}`:`缺${p.treasure?.name||'伙伴'}`;b.append(art,label);b.onclick=()=>{if(!this.canUse())return;if(!p.candidates.some(id=>this.garden.callbacks.inventory()[id]>0)){this.callbacks.voice(this.goalLine);return;}this.callbacks.invite(p.candidates,story.hint,index);};recipe.append(b);});
    const ready=!!this.garden.stories.match(story),known=this.garden.state.discovered.includes(story.id),action=document.getElementById('wish-action');action.hidden=this.panel.hidden;action.disabled=!ready||!this.canUse();action.textContent=known?'再看魔法 ↻':'开始合成 ✦';document.getElementById('wish-invite').disabled=!this.canUse();
    document.getElementById('wish-status').textContent=ready?`✦ ${known?'伙伴准备好啦':'将诞生'} · ${story.keepsake.name}`:'点击伙伴邀请，或一键放入';
    const challenge=document.getElementById('workshop-challenges');challenge.replaceChildren();for(const enemy of ENEMIES){const b=document.createElement('button');b.type='button';b.textContent=`挑战${enemy.name}`;b.dataset.challenge=enemy.id;b.disabled=!this.canUse()||!this.callbacks.canChallenge(enemy.id);b.onclick=()=>{if(this.canUse()&&this.callbacks.canChallenge(enemy.id)){this.challengeMenu.open=false;this.close();this.callbacks.challenge(enemy.id);}};challenge.append(b);}
  }
  nextGoal(){
    if(!this.canUse())return;
    const rules=this.garden.stories.rules,index=rules.findIndex(s=>s.id===this.current().id);
    const next=[...rules.slice(index+1),...rules.slice(0,index+1)].find(s=>!this.garden.state.discovered.includes(s.id))||rules[(index+1)%rules.length];
    this.state.active=next.id;this.state.tray=[];document.getElementById('workshop-result').hidden=true;this.callbacks.save();
  }
  renderGoal(){
    const story=this.current(),partners=this.partners(),inventory=this.garden.callbacks.inventory();
    const missing=partners.filter(p=>!inventory[p.treasure?.id]),known=this.garden.state.discovered.includes(story.id);
    const progress=partners.length-missing.length,ready=!missing.length;this.goalReady=ready;
    this.goalLine=ready?`${story.keepsake.name}的伙伴都找齐啦！一起去合成吧！`:`想合成${story.keepsake.name}，还要抽到${missing.map(p=>p.treasure?.name||'新伙伴').join('和')}。`;
    const goal=document.getElementById('craft-goal');goal.dataset.ready=String(ready);goal.dataset.known=String(known);
    document.getElementById('craft-goal-title').textContent=`${story.keepsake.icon} ${story.keepsake.name}`;
    const digest=JSON.stringify([story.id,partners.map(p=>[p.treasure?.id,!!inventory[p.treasure?.id]])]);
    if(this.goalDigest!==digest){this.goalDigest=digest;const group=document.getElementById('craft-goal-partners');group.replaceChildren();for(const p of partners){const t=p.treasure;if(!t)continue;const owned=!!inventory[t.id],item=document.createElement('div');item.className=`goal-partner ${owned?'found':'wanted'}`;item.dataset.goalTreasure=t.id;const portrait=document.createElement('span');portrait.className='goal-portrait';this.garden.callbacks.art(t,portrait);const label=document.createElement('span');label.textContent=t.name;const status=document.createElement('b');status.textContent=owned?'✓ 已找到':'还想抽到';item.append(portrait,label,status);group.append(item);}}
    document.getElementById('craft-goal-progress').textContent=ready?'伙伴齐啦！点「合成」一起变魔法':`已找到 ${progress}/${partners.length} · 还想抽到${missing.map(p=>p.treasure?.name||'新伙伴').join('、')}`;
    const toggle=document.getElementById('workshop-open'),badge=document.getElementById('craft-task-badge');
    badge.textContent=ready?'可合成':known?'':'新心愿';toggle.dataset.task=ready?'ready':known?'':'wanted';
    toggle.setAttribute('aria-label',ready?'伙伴齐了，切换到合成':`切换到合成，${story.name}${known?'':'，新心愿'}`);
    document.getElementById('craft-goal-speak').disabled=!this.canUse();
  }
  async synthesize(){
    const story=this.current();if(!this.canUse()||this.panel.hidden||!this.garden.stories.match(story))return;
    document.getElementById('workshop-result').hidden=true;this.busy=true;this.renderGoal();this.garden.endWeather();this.panel.dataset.phase='gather';document.getElementById('wish-action').disabled=true;
    for(const id of ['lottery-mode','workshop-open','wish-invite','wish-swap','wish-speak'])document.getElementById(id).disabled=true;
    document.getElementById('wish-status').textContent='伙伴的魔法，正在汇聚……';
    try{
      await this.garden.callbacks.unlock();this.callbacks.craftSound('gather');await this.callbacks.wait(1100);
      this.panel.dataset.phase='fusion';document.getElementById('wish-status').textContent='听！新的魔法要诞生啦！';this.callbacks.craftSound('fusion');await this.callbacks.wait(1700);
      const result=document.getElementById('workshop-result');document.getElementById('workshop-result-art').innerHTML=this.garden.adventures.art(story.effect,story.keepsake.icon);document.getElementById('workshop-result-name').textContent=story.keepsake.name;result.hidden=false;this.panel.dataset.phase='reveal';this.callbacks.craftSound('reveal');document.getElementById('wish-status').textContent='✦ 魔法合成成功！';await this.callbacks.wait(1600);
      this.busy=false;await this.garden.stories.play(story);
    }finally{this.busy=false;delete this.panel.dataset.phase;for(const id of ['lottery-mode','workshop-open','wish-invite','wish-swap','wish-speak'])document.getElementById(id).disabled=false;this.sync();}
  }
  memories(){const memories=this.legacy.filter(w=>this.garden.state.wishes.completed.includes(w.id)).map(w=>({id:`wish-${w.id}`,name:w.souvenir,icon:w.icon,line:w.memoryLine,effect:w.effect,kind:w.memoryKind}));if(this.state.guardWon&&!memories.some(m=>m.id==='wish-little-guardian'))memories.push({id:'wish-little-guardian',name:'花园守护旗',icon:'🛡',line:'守护旗会挡住下一次捣蛋！',effect:'hug',kind:'wish-guardian'});return memories;}
  normalDraw(){if(this.state.focusRemaining>0){this.state.focusRemaining--;if(!this.state.focusRemaining||this.garden.callbacks.inventory()[this.state.focusId]){this.state.focusId=null;this.state.focusRemaining=0;}}}
  focus(){return this.state.focusRemaining>0&&!this.state.broken.includes('wish-gems')?this.state.focusId:null;}
  facility(memory,b){const broken=this.state.broken.includes(memory.id);b.classList.toggle('facility-broken',broken);if(broken)b.title='点击扶正';else if(memory.id==='music-flowers')b.title=`补充2颗爱心 · ${Math.max(0,this.state.musicReadyAt-this.callbacks.draws())}抽后就绪`;else if(memory.id==='wish-gems')b.title=this.state.focusRemaining?`心愿加倍还剩${this.state.focusRemaining}抽`:'选择一件想发现的宝物';else if(memory.id==='wish-little-guardian')b.title=`防护 · ${Math.max(0,this.state.flagReadyAt-this.callbacks.draws())}抽后就绪`;let status=b.querySelector('.facility-state');if(broken||['music-flowers','wish-gems','wish-little-guardian'].includes(memory.id)){if(!status){status=document.createElement('span');status.className='facility-state';b.append(status);}const wait=memory.id==='music-flowers'?this.state.musicReadyAt-this.callbacks.draws():this.state.flagReadyAt-this.callbacks.draws();status.textContent=broken?'点我扶正':memory.id==='wish-gems'?this.state.focusRemaining?`加倍 · ${this.state.focusRemaining}抽`:'✦ 许个愿':wait>0?`${wait}抽后恢复`:memory.id==='music-flowers'?'♥ +2 能量':'🛡 防护就绪';}}
  useFacility(memory,b){if(!this.canUse())return true;if(this.state.broken.includes(memory.id)){this.state.broken=this.state.broken.filter(id=>id!==memory.id);this.callbacks.save();this.garden.adventures.render();return true;}if(memory.id==='music-flowers'){if(this.callbacks.draws()<this.state.musicReadyAt)return true;this.state.musicReadyAt=this.callbacks.draws()+3;this.garden.callbacks.reward(2);this.callbacks.save();this.facility(memory,b);return false;}if(memory.id==='wish-gems'){if(!this.state.focusRemaining)this.callbacks.focus();return true;}return false;}
  flagReady(){return this.memories().some(m=>m.id==='wish-little-guardian')&&!this.state.broken.includes('wish-little-guardian')&&this.callbacks.draws()>=this.state.flagReadyAt;}
}
