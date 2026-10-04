// 女巫挑战：同一个帧时钟管理冒头、发射与命中；后台暂停，刷新保存进度。
class WitchGame {
  constructor(rules, callbacks) {
    this.rules = rules; this.callbacks = callbacks; this.$ = id => document.getElementById(id);
    this.stage = this.$('witch-stage'); this.target = this.$('witch-target');
    document.addEventListener('click', event => {
      if (event.target.closest('#witch-target') || !event.target.closest('button,a,input,dialog,#machine,.topbar,.witch-hud')) this.shoot(event);
    });
    addEventListener('resize', () => { this.position(); this.positionBroadcast(); });
    addEventListener('scroll', () => this.position(), { passive: true });
    new ResizeObserver(() => this.positionBroadcast()).observe(this.stage.querySelector('.witch-hud'));
    this.target.addEventListener('keydown', event => { if (event.key === 'Enter' && event.repeat) event.preventDefault(); });
  }
  positionBroadcast() {
    const broadcast = this.$('garden-broadcast'), machine = this.$('machine').getBoundingClientRect();
    const hud = this.stage.querySelector('.witch-hud').getBoundingClientRect();
    if (innerWidth <= 650 && hud.top - machine.bottom >= 112) { broadcast.style.width = '120px'; broadcast.style.left = '12px'; broadcast.style.bottom = `${innerHeight - hud.top + 8}px`; return; }
    const room = Math.max(machine.left, innerWidth - machine.right), width = Math.min(160, Math.max(32, room - 12));
    const left = machine.left >= innerWidth - machine.right ? Math.max(4, machine.left - width - 8) : Math.min(innerWidth - width - 4, machine.right + 8);
    broadcast.style.width = `${width}px`; broadcast.style.left = `${left}px`; broadcast.style.bottom = '22px';
  }
  updateHits() {
    this.$('witch-hit-count').textContent = `${this.item.hits} / ${this.challengeRules.hits}`;
    this.$('witch-hit-count').setAttribute('aria-label', `已命中 ${this.item.hits} 次，共需 ${this.challengeRules.hits} 次`);
    this.$('witch-hit-stars').replaceChildren();
    for (let i = 0; i < this.challengeRules.hits; i++) { const star = document.createElement('span'); star.textContent = '♥'; star.className = i < this.item.hits ? 'filled' : ''; star.setAttribute('aria-hidden', 'true'); this.$('witch-hit-stars').append(star); }
  }
  position() {
    if (!this.item || this.state === 'idle' || this.state === 'fleeing') return;
    const machine = this.$('machine').getBoundingClientRect(), small = innerWidth <= 650;
    const width = this.target.offsetWidth || (small ? 88 : 140), height = this.target.offsetHeight || (small ? 116 : 170);
    const side = small ? width / 2 + 3 : 145;
    const left = small ? side : machine.left - side, right = small ? innerWidth - side : machine.right + side;
    const top = machine.top + (small ? 42 : 35), bottom = machine.bottom - (small ? 95 : 110);
    const positions = [[left, top], [right, top], [left, bottom], [right, bottom]];
    const [x, y] = positions[this.slot];
    this.target.style.left = `${Math.max(width / 2 + 2, Math.min(innerWidth - width / 2 - 2, x))}px`;
    this.target.style.top = `${Math.max(85 + height / 2, Math.min(innerHeight - height / 2 - (small ? 132 : 18), y))}px`;
  }
  move() {
    const choices = [0, 1, 2, 3].filter(index => index !== this.slot);
    this.slot = choices[Math.floor(Math.random() * choices.length)];
    this.target.classList.remove('hit', 'fleeing'); this.target.hidden = false; this.target.disabled = false;
    this.position(); this.target.dataset.slot = this.slot;
    this.state = 'visible'; this.clock = 0; this.stage.dataset.action = 'ready';
    if (this.item.hits >= Math.floor(this.challengeRules.hits / 2) && !this.item.interferenceUsed) {
      this.item.interferenceUsed = true;
      const shield = this.guardians.find(g => g.effects.guardian === 'heart-shield' && !this.item.shieldUsed);
      if (shield) { this.item.shieldUsed = true; this.stage.classList.add('guardian-shield'); this.$('witch-feedback').textContent = `${shield.name}的爱心护盾挡住了捣蛋迷雾！`; this.callbacks.sound('guardian-shield'); }
      else { this.fogClock = 2200; this.stage.classList.add('enemy-fog'); this.$('witch-feedback').textContent = '捣蛋迷雾来了，找找它躲在哪里！'; }
      this.callbacks.save();
    }
    if (this.item.opponent === 'dragon') this.stage.dataset.phase = this.item.hits >= Math.ceil(this.challengeRules.hits / 2) ? 'angry' : 'sleepy';
  }
  shoot(event, guardian = null) {
    if (this.state !== 'visible' || document.hidden) return;
    const hit = !!guardian || !!event.target.closest('#witch-target');
    const bounds = this.stage.getBoundingClientRect(), aim = this.target.getBoundingClientRect(), cannon = guardian ? this.callbacks.guardianOrigin(guardian.id) : this.$('window').getBoundingClientRect();
    const toX = hit ? aim.left + aim.width / 2 - bounds.left : event.clientX - bounds.left;
    const toY = hit ? aim.top + aim.height * .6 - bounds.top : event.clientY - bounds.top;
    const projectile = document.createElement('div'); projectile.className = 'witch-shot'; projectile.setAttribute('aria-hidden', 'true');
    projectile.style.setProperty('--from-x', `${cannon.left + cannon.width / 2 - bounds.left - 25}px`);
    projectile.style.setProperty('--from-y', `${cannon.top + cannon.height * .42 - bounds.top - 25}px`);
    projectile.style.setProperty('--to-x', `${toX - 25}px`); projectile.style.setProperty('--to-y', `${toY - 25}px`);
    this.shotAssist = !!guardian; this.shotGuardian = guardian;
    if (guardian) { projectile.classList.add('assist-shot'); projectile.dataset.guardian = guardian.effects.guardian === 'heart-shield' ? 'heart-shot' : guardian.effects.guardian; this.$('witch-feedback').textContent = `${guardian.name}，魔法助攻！`; }
    this.callbacks.art(guardian || this.callbacks.pickAmmo(), projectile); this.stage.append(projectile); this.projectile = projectile;
    this.target.disabled = true; this.state = 'shot'; this.clock = 0; this.shotHit = hit;
    this.stage.dataset.action = 'firing'; this.$('machine').classList.add('witch-firing'); this.callbacks.sound('witch-shot');
  }
  impact() {
    this.projectile?.remove(); this.projectile = null; this.$('machine').classList.remove('witch-firing');
    if (this.shotHit) {
      if (this.shotAssist) { this.item.assistUsed = true; this.item.assistHits++; this.item.usedGuardians.push(this.shotGuardian.id); }
      this.item.hits++; this.updateHits(); this.callbacks.save();
      this.target.classList.add('hit'); this.callbacks.sound('witch-hit');
      this.$('witch-feedback').textContent = this.item.hits >= this.challengeRules.hits ? `打中了！${this.enemyName}要逃跑啦！` : ['','哇，打中了！','再来一下！'][this.item.hits] || '打中了！';
      if (this.shotAssist) this.$('witch-feedback').textContent = `${this.shotGuardian.name}帮你打中了！接下来交给你！`;
      if (this.item.hits >= this.challengeRules.hits) { this.win(); return; }
      this.state = 'hit'; this.clock = 0; this.stage.dataset.action = 'hit';
    } else {
      this.$('witch-feedback').textContent = '咻——再试一下！'; this.callbacks.sound('witch-miss');
      this.state = 'visible'; this.clock = 0; this.target.disabled = false; this.stage.dataset.action = 'ready';
    }
  }
  win() {
    this.reward = this.settle(); // 奖励与移除待处理挑战由世界队列原子保存。
    this.target.hidden = false; this.position();
    const bounds = this.target.getBoundingClientRect();
    this.target.style.setProperty('--escape-x', `${innerWidth - bounds.left + 180}px`);
    this.target.style.setProperty('--escape-y', `${-bounds.top - 200}px`);
    this.state = 'fleeing'; this.clock = 0; this.target.disabled = true;
    this.target.classList.remove('hit'); this.target.classList.add('fleeing');
    this.stage.dataset.action = 'fleeing'; this.$('witch-title').textContent = `哎呀！${this.enemyName}落荒而逃！`;
    this.$('witch-instruction').textContent = { bat: '扑棱扑棱，蝙蝠慌忙飞走啦！', witch: '扫帚，快快飞起来！', rock: '咕噜咕噜，石头怪滚走啦！', dragon: '大龙扇着翅膀，慌忙逃走啦！' }[this.item.opponent || 'witch']; this.callbacks.sound('witch-flee');
  }
  nextGuardian() {
    if (this.item.assistHits >= Math.floor(this.challengeRules.hits / 2) || this.item.hits >= this.challengeRules.hits - 1) return null;
    return this.guardians.find(g => !this.item.usedGuardians.includes(g.id));
  }
  showVictory() {
    const reward = this.reward; this.state = 'won'; this.clock = 0; this.target.hidden = true;
    this.stage.dataset.action = 'won'; this.$('witch-title').textContent = `${this.enemyName}被你打跑啦！`;
    this.$('witch-instruction').textContent = '守护魔法世界，收到一份礼物！';
    this.$('witch-feedback').textContent = reward.gift.name;
    this.positionBroadcast(); this.$('garden-broadcast').dataset.action = 'rising'; this.$('broadcast-message').textContent = innerWidth <= 650 ? '安全啦！' : '花园安全啦！谢谢小小守护者！'; this.callbacks.sound('broadcast'); this.callbacks.voice?.('花园安全啦！谢谢小小守护者！');
    this.$('witch-reward').hidden = false; this.callbacks.art(reward.gift, this.$('witch-reward'));
    this.$('witch-continue').hidden = false; this.callbacks.sound('witch-win');
    this.$('announcement').textContent = `${this.enemyName}被打跑了，获得额外宝物：${reward.gift.name}。`;
  }
  async play(item, settle) {
    this.enemyName = ENEMIES.find(e => e.id === (item.opponent || 'witch'))?.name || '邪恶女巫';
    this.challengeRules = enemyRules(this.rules, item.opponent);
    this.guardians = this.callbacks.guardians?.() || [];
    item.usedGuardians ||= []; item.assistHits ??= item.assistUsed ? 1 : 0;
    this.shotAssist = false; this.fogClock = 0; this.stage.dataset.enemy = item.opponent || 'witch'; this.stage.dataset.health = String(this.challengeRules.hits); this.stage.dataset.phase = 'sleepy';
    this.stage.classList.remove('enemy-fog', 'guardian-shield');
    this.target.setAttribute('aria-label', `点击${this.enemyName}发射宝物`);
    this.item = item; this.settle = settle; this.slot = 1; this.clock = 0; this.state = 'intro';
    this.stage.dataset.action = 'intro'; this.target.hidden = true; this.target.disabled = true; this.target.classList.remove('hit', 'fleeing');
    this.$('witch-title').textContent = `${this.enemyName}入侵花园！`; this.$('witch-instruction').textContent = `点${this.enemyName}，发射宝物！打中 ${this.challengeRules.hits} 次赶跑它。`;
    this.$('witch-feedback').textContent = item.hits ? '继续守护你的魔法世界！' : this.guardians.length ? '花园伙伴准备来帮忙！' : '你的宝物，准备出击！';
    this.$('witch-reward').hidden = true; this.$('witch-reward').replaceChildren(); this.$('witch-continue').hidden = true;
    this.$('witch-face').replaceChildren();
    if (this.challengeRules.image) { const img = document.createElement('img'); img.src = this.challengeRules.image; img.alt = ''; this.$('witch-face').append(img); }
    else this.$('witch-face').textContent = item.opponent === 'bat' ? '🦇' : '🧙‍♀️';
    this.updateHits(); this.stage.hidden = false; this.stage.setAttribute('aria-label', `${this.enemyName}挑战`); document.body.classList.add('witch-active');
    this.$('announcement').textContent = `${this.enemyName}出现在花园里了！点击它，命中 ${this.challengeRules.hits} 次赶跑它。`;
    const broadcast = this.$('garden-broadcast'); broadcast.hidden = false; this.positionBroadcast(); requestAnimationFrame(() => this.positionBroadcast()); broadcast.dataset.action = 'rising';
    const warning = `注意！${this.enemyName}来捣蛋啦！`; this.$('broadcast-message').textContent = innerWidth <= 650 ? `${this.enemyName}来了！` : warning;
    this.callbacks.sound('broadcast'); this.callbacks.voice?.(warning);
    let finish;
    const done = new Promise(resolve => { finish = resolve; });
    this.finish = finish; this.$('witch-continue').onclick = () => { if (this.state === 'won') finish(); };
    let previous = performance.now();
    const frame = now => {
      if (!document.hidden) { const delta = Math.min(50, now - previous); this.clock += delta; this.fogClock = Math.max(0, this.fogClock - delta); if (!this.fogClock) this.stage.classList.remove('enemy-fog'); } previous = now;
      if (this.state === 'intro' && this.clock >= 2600) { broadcast.dataset.action = 'sinking'; this.callbacks.sound(`${item.opponent || 'witch'}-arrive`); if (item.hits >= this.challengeRules.hits) this.win(); else this.move(); }
      else if (this.state === 'visible' && this.nextGuardian() && this.clock >= 900) this.shoot(null, this.nextGuardian());
      else if (this.state === 'visible' && this.clock >= this.challengeRules.visibleMs * (this.stage.dataset.phase === 'angry' ? .8 : 1)) { this.state = 'hidden'; this.clock = 0; this.target.hidden = true; this.target.disabled = true; }
      else if (this.state === 'hidden' && this.clock >= this.challengeRules.hiddenMs) this.move();
      else if (this.state === 'shot' && this.clock >= 450) this.impact();
      else if (this.state === 'hit' && this.clock >= 500) { this.state = 'hidden'; this.clock = 0; this.target.hidden = true; }
      else if (this.state === 'fleeing' && this.clock >= 2800) this.showVictory();
      else if (this.state === 'won' && this.clock >= 10000) finish();
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
    try { await done; }
    finally { cancelAnimationFrame(this.frameId); this.projectile?.remove(); this.projectile = null; this.$('witch-continue').onclick = null; this.state = 'idle'; this.stage.hidden = true; broadcast.hidden = true; this.callbacks.voice?.(''); this.stage.classList.remove('enemy-fog', 'guardian-shield'); this.$('machine').classList.remove('witch-firing'); document.body.classList.remove('witch-active'); }
  }
}
