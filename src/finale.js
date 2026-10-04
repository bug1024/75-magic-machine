// 第75次魔法的分段庆典；每次点击和阶段转换先保存，重播不结算奖励。
class MagicFinale {
  constructor(world,garden,treasures,callbacks) {
    this.world=world;this.garden=garden;this.treasures=treasures;this.callbacks=callbacks;this.busy=false;
    this.scene=document.getElementById('finale-scene');this.$=id=>document.getElementById(id);
    this.$('finale-next').onclick=()=>this.advance();this.$('finale-dragon').onclick=()=>this.tap();this.$('finale-continue').onclick=()=>this.finish();
    this.$('finale-replay').onclick=()=>{if(callbacks.canPlay())callbacks.replay();};
    new ForegroundLoop((now,elapsed)=>{if(this.busy&&!document.hidden){this.elapsed+=Math.min(elapsed,now-this.stageStarted);this.tick();}},()=>this.busy&&this.state.stage!=='crown'?100:1000);
    this.renderGarden();
  }
  get state(){return this.replay?this.replayState:this.world.state.finale;}
  set state(value){if(this.replay)this.replayState=value;else this.world.state.finale=value;}
  save(){if(!this.replay)this.callbacks.save();}
  async play(replay=false) {
    if(this.busy)return;
    this.busy=true;this.replay=replay;if(replay)this.replayState=normalizeFinale(null);
    this.original={season:this.garden.state.season,time:this.garden.state.timeOfDay};this.garden.endWeather();this.garden.stories.closePanel();
    document.body.classList.remove('scene-resting');document.body.classList.add('finale-active');this.scene.hidden=false;
    let finish;const done=new Promise(resolve=>finish=resolve);this.resolve=finish;
    try {await this.callbacks.unlock();this.enter();await done;}
    finally {
      this.scene.hidden=true;this.busy=false;document.body.classList.remove('finale-active');delete document.body.dataset.finale;
      this.$('finale-partners').replaceChildren();this.$('finale-bits').replaceChildren();this.$('finale-fireworks').replaceChildren();this.$('finale-dragon').hidden=true;
      this.garden.state.season=this.original.season;this.garden.state.timeOfDay=replay?this.original.time:'night';this.garden.renderSeason();this.garden.renderTime();this.renderGarden();this.callbacks.save();this.callbacks.finished();
    }
  }
  enter() {
    this.elapsed=0;this.stageStarted=performance.now();this.lastGroup=-1;this.seasonBeat=-1;this.scene.dataset.stage=this.state.stage;document.body.dataset.finale=this.state.stage;
    this.$('finale-next').hidden=['seal','love','crown'].includes(this.state.stage);this.$('finale-continue').hidden=this.state.stage!=='crown';this.$('finale-dragon').hidden=!['seal','love','celebrate'].includes(this.state.stage);
    this.$('finale-dragon').disabled=this.state.stage==='celebrate';this.$('finale-next').textContent='继续这份魔法 →';
    const lines={gather:['75 的魔法之夜','听！花园伙伴正在回家，庆典要开始啦！'],seasons:['四季送来的祝福','春花、夏风、秋叶、冬雪，都记得你的魔法。'],bloom:['生命树，开花吧！','彩虹、翅膀和城堡，长成了一树彩色星星！'],seal:['大龙被黑雾困住了！','点大龙三次，和花园伙伴打破魔法封印。'],love:['把爱心送给大龙','再送三颗爱心，让大龙想起自己的善良。'],celebrate:['守护龙回来啦！','蝙蝠、女巫、石头怪和大龙，都愿意守护花园！'],crown:['75，你已经成为魔法花园真正的守护者！',this.replay?'这份星光，一直属于你。':'收下唯一的「75 的星光皇冠」！']};
    const [title,line]=lines[this.state.stage];this.$('finale-title').textContent=title;this.$('finale-caption').textContent=line;this.$('announcement').textContent=`${title}。${line}`;
    this.$('finale-progress').textContent=['seal','love'].includes(this.state.stage)?`${this.state.stage==='love'?'♥':'✦'} ${this.state.progress} / 3`:'';
    const dragon=['celebrate','crown'].includes(this.state.stage)?this.callbacks.dragonArt:this.world.rules.witch.dragon.image;this.$('finale-dragon-art').replaceChildren();if(dragon){const image=document.createElement('img');image.src=dragon;image.alt='';this.$('finale-dragon-art').append(image);}else this.$('finale-dragon-art').textContent='🐉';
    this.$('finale-dragon').setAttribute('aria-label',this.state.stage==='love'?'给大龙一颗爱心':'打破大龙的魔法封印');
    this.$('finale-crown').hidden=this.state.stage!=='crown';
    if(this.state.stage==='crown') {
      const crown=this.treasures.find(t=>t.id===CROWN_ID);this.callbacks.art(crown,this.$('finale-crown'));
      if(!this.replay&&!this.state.awarded){this.callbacks.grantCrown(crown);this.state={...this.state,awarded:true};this.save();}
      this.$('finale-continue').textContent=this.replay?'回到永恒花园':'进入永恒花园 · 继续玩';this.$('finale-continue').focus();
    } else if(['seal','love'].includes(this.state.stage))this.$('finale-dragon').focus();
    else this.$('finale-next').focus();
    this.$('finale-partners').classList.remove('finale-help');this.renderPartners(0);this.renderBits();this.callbacks.music(this.state.stage);
  }
  tick() {
    const durations={gather:8000,seasons:9000,bloom:7000,celebrate:11000};const stage=this.state.stage;
    if(stage==='seasons'){
      const beat=Math.min(3,Math.floor(this.elapsed/2000));if(beat!==this.seasonBeat){this.seasonBeat=beat;this.garden.state.season=SEASONS[beat];this.garden.renderSeason();}
    }
    if(stage==='bloom'||stage==='celebrate'||stage==='crown'){if(this.garden.state.timeOfDay!=='night'){this.garden.state.timeOfDay='night';this.garden.renderTime();}}
    if(['gather','celebrate'].includes(stage))this.renderPartners(Math.floor(this.elapsed/1500));
    if((durations[stage]&&this.elapsed>=durations[stage])||(['seal','love'].includes(stage)&&this.state.progress>=3&&this.elapsed>=600))this.advance();
  }
  advance() {
    if(!this.busy||this.state.stage==='crown'||(['seal','love'].includes(this.state.stage)&&this.state.progress<3))return;
    this.state=nextFinaleStage(this.state);this.save();this.enter();
  }
  tap() {
    if(!this.busy||document.hidden||!['seal','love'].includes(this.state.stage)||this.state.progress>=3)return;
    this.state=finaleTap(this.state);this.save();this.elapsed=0;this.stageStarted=performance.now();
    this.$('finale-progress').textContent=`${this.state.stage==='love'?'♥':'✦'} ${this.state.progress} / 3`;
    this.$('finale-dragon').classList.remove('finale-hit');void this.$('finale-dragon').offsetWidth;this.$('finale-dragon').classList.add('finale-hit');
    this.$('finale-caption').textContent=this.state.stage==='love'?['','大龙收到第一颗温暖的爱心！','黑雾散开了，大龙在微笑！','它愿意和你一起守护花园！'][this.state.progress]:['','一道封印裂开了！','花园伙伴也来帮忙啦！','封印打开！再把爱心送给大龙。'][this.state.progress];
    this.$('finale-partners').classList.remove('finale-help');void this.$('finale-partners').offsetWidth;this.$('finale-partners').classList.add('finale-help');
    this.callbacks.hit(this.state.stage,this.state.progress);
  }
  renderPartners(group) {
    if(group===this.lastGroup)return;this.lastGroup=group;
    const owned=this.treasures.filter(t=>this.callbacks.inventory()[t.id]&&t.id!==CROWN_ID);
    const visitors=this.world.rules.events.filter(e=>e.id!=='ghost').map(e=>({id:e.id,name:e.name,appearance:{image:e.image,icon:'🧚'}}));
    const partners=[...owned,...visitors];const actors=this.$('finale-partners');actors.replaceChildren();
    for(let i=0;i<Math.min(6,partners.length);i++){const item=partners[(group*6+i)%partners.length],actor=document.createElement('div');actor.className='finale-partner';actor.style.setProperty('--i',i);this.callbacks.art(item,actor);actor.title=item.name;actors.append(actor);}
  }
  renderBits() {
    const fireworks=this.$('finale-fireworks');fireworks.replaceChildren();
    if (['celebrate','crown'].includes(this.state.stage)) for(let j=0;j<3;j++){const burst=document.createElement('span');burst.className='finale-firework';burst.style.setProperty('--burst',j);for(let i=0;i<12;i++){const ray=document.createElement('i');ray.textContent='✦';ray.style.setProperty('--ray',i);burst.append(ray);}fireworks.append(burst);}
    const bits=this.$('finale-bits');bits.replaceChildren();const festive=['celebrate','crown'].includes(this.state.stage);const symbols=festive?['✦','🌸','⭐','💗']:this.state.stage==='love'?['♥']:['✦','⭐'];
    for(let i=0;i<(festive?24:10);i++){const bit=document.createElement('i');bit.textContent=symbols[i%symbols.length];bit.style.setProperty('--i',i);bit.style.setProperty('--x',`${5+i*37%90}%`);bits.append(bit);}
  }
  finish() {
    if(!this.busy||this.state.stage!=='crown')return;
    if(!this.replay){this.world.state.finale={...this.state,complete:true,redeemed:['bat','witch','rock','dragon']};this.world.state.pending=this.world.state.pending.filter(item=>item.kind!=='finale');this.callbacks.save();}
    this.resolve();
  }
  guardianFriends() {
    if(!this.world.state.finale.complete)return [];
    return ENEMIES.map(enemy=>({id:`friend-${enemy.id}`,name:{bat:'星光蝙蝠',witch:'善良女巫',rock:'勇敢石头伙伴',dragon:'花园守护龙'}[enemy.id],tags:['guardian'],appearance:{image:enemy.id==='dragon'?this.callbacks.dragonArt:enemyRules(this.world.rules.witch,enemy.id).image,icon:{bat:'🦇',witch:'🧙',rock:'🪨',dragon:'🐉'}[enemy.id]},effects:{guardian:enemy.id==='dragon'?'star-shot':enemy.id==='witch'?'heart-shot':enemy.id==='bat'?'bubble-shot':'rainbow-shot'}}));
  }
  renderGarden() {
    const complete=this.world.state.finale.complete;document.body.classList.toggle('eternal-garden',complete);this.$('finale-replay').hidden=!complete;
    this.$('garden-friends').hidden=!complete;this.$('garden-friends').replaceChildren();
    for(const friend of this.guardianFriends()) {
      const button=document.createElement('button');button.type='button';button.className='garden-friend';button.dataset.friend=friend.id;button.title=`${friend.name} · 永久守护伙伴`;button.setAttribute('aria-label',`和${friend.name}玩一玩`);
      const art=document.createElement('span');this.callbacks.art(friend,art);const name=document.createElement('span');name.textContent=friend.name;button.append(art,name);
      button.onclick=()=>{if(!this.callbacks.canPlay())return;button.classList.remove('friend-greeting');void button.offsetWidth;button.classList.add('friend-greeting');this.callbacks.hit('love',1);this.$('announcement').textContent=`${friend.name}：我会和你一起守护花园！`;};this.$('garden-friends').append(button);
    }
    if(complete)this.$('machine-level').textContent='👑 永恒花园 · 完整生命树';
  }
}
