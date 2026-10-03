// 女巫挑战：同一个帧时钟管理冒头、发射与命中；后台暂停，刷新保存进度。
class WitchGame {
  constructor(rules, callbacks) {
    this.rules = rules; this.callbacks = callbacks; this.$ = id => document.getElementById(id);
    this.stage = this.$('witch-stage'); this.target = this.$('witch-target');
    document.addEventListener('click', event => {
      if (event.target.closest('#witch-target') || !event.target.closest('button,a,input,dialog,#machine,.topbar,.witch-hud')) this.shoot(event);
    });
    addEventListener('resize', () => this.position());
    addEventListener('scroll', () => this.position(), { passive: true });
    this.target.addEventListener('keydown', event => { if (event.key === 'Enter' && event.repeat) event.preventDefault(); });
  }
  updateHits() {
    this.$('witch-hit-count').textContent = `${this.item.hits} / ${this.rules.hits}`;
    this.$('witch-hit-count').setAttribute('aria-label', `已命中 ${this.item.hits} 次，共需 ${this.rules.hits} 次`);
    this.$('witch-hit-stars').replaceChildren();
    for (let i = 0; i < this.rules.hits; i++) { const star = document.createElement('span'); star.textContent = '★'; star.className = i < this.item.hits ? 'filled' : ''; this.$('witch-hit-stars').append(star); }
  }
  position() {
    if (!this.item || this.state === 'idle') return;
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
  }
  shoot(event) {
    if (this.state !== 'visible' || document.hidden) return;
    const hit = !!event.target.closest('#witch-target');
    const bounds = this.stage.getBoundingClientRect(), aim = this.target.getBoundingClientRect(), cannon = this.$('window').getBoundingClientRect();
    const toX = hit ? aim.left + aim.width / 2 - bounds.left : event.clientX - bounds.left;
    const toY = hit ? aim.top + aim.height * .6 - bounds.top : event.clientY - bounds.top;
    const projectile = document.createElement('div'); projectile.className = 'witch-shot'; projectile.setAttribute('aria-hidden', 'true');
    projectile.style.setProperty('--from-x', `${cannon.left + cannon.width / 2 - bounds.left - 25}px`);
    projectile.style.setProperty('--from-y', `${cannon.top + cannon.height * .42 - bounds.top - 25}px`);
    projectile.style.setProperty('--to-x', `${toX - 25}px`); projectile.style.setProperty('--to-y', `${toY - 25}px`);
    this.callbacks.art(this.callbacks.pickAmmo(), projectile); this.stage.append(projectile); this.projectile = projectile;
    this.target.disabled = true; this.state = 'shot'; this.clock = 0; this.shotHit = hit;
    this.stage.dataset.action = 'firing'; this.$('machine').classList.add('witch-firing'); this.callbacks.sound('witch-shot');
  }
  impact() {
    this.projectile?.remove(); this.projectile = null; this.$('machine').classList.remove('witch-firing');
    if (this.shotHit) {
      this.item.hits++; this.updateHits(); this.callbacks.save();
      this.target.classList.add('hit'); this.callbacks.sound('witch-hit');
      this.$('witch-feedback').textContent = this.item.hits >= this.rules.hits ? '打中了！女巫要逃跑啦！' : ['','哇，打中了！','再来一下！'][this.item.hits] || '打中了！';
      if (this.item.hits >= this.rules.hits) { this.win(); return; }
      this.state = 'hit'; this.clock = 0; this.stage.dataset.action = 'hit';
    } else {
      this.$('witch-feedback').textContent = '咻——再试一下！'; this.callbacks.sound('witch-miss');
      this.state = 'visible'; this.clock = 0; this.target.disabled = false; this.stage.dataset.action = 'ready';
    }
  }
  win() {
    const reward = this.settle(); // 奖励与移除待处理挑战由世界队列原子保存。
    this.state = 'won'; this.clock = 0; this.target.disabled = true; this.target.classList.remove('hit'); this.target.classList.add('fleeing');
    this.stage.dataset.action = 'won'; this.$('witch-title').textContent = '女巫被你打跑啦！';
    this.$('witch-instruction').textContent = '守护魔法世界，收到一份礼物！';
    this.$('witch-feedback').textContent = reward.gift.name;
    this.$('witch-reward').hidden = false; this.callbacks.art(reward.gift, this.$('witch-reward'));
    this.$('witch-continue').hidden = false; this.callbacks.sound('witch-win');
    this.$('announcement').textContent = `女巫被打跑了，获得额外宝物：${reward.gift.name}。`;
  }
  async play(item, settle) {
    this.item = item; this.settle = settle; this.slot = 1; this.clock = 0; this.state = 'intro';
    this.stage.dataset.action = 'intro'; this.target.hidden = true; this.target.disabled = true; this.target.classList.remove('hit', 'fleeing');
    this.$('witch-title').textContent = '邪恶女巫来捣蛋啦！'; this.$('witch-instruction').textContent = `点女巫，发射宝物！打中 ${this.rules.hits} 次赶跑她。`;
    this.$('witch-feedback').textContent = item.hits ? '继续守护你的魔法世界！' : '你的宝物，准备出击！';
    this.$('witch-reward').hidden = true; this.$('witch-reward').replaceChildren(); this.$('witch-continue').hidden = true;
    this.$('witch-face').replaceChildren();
    if (this.rules.image) { const img = document.createElement('img'); img.src = this.rules.image; img.alt = ''; this.$('witch-face').append(img); }
    else this.$('witch-face').textContent = '🧙‍♀️';
    this.updateHits(); this.stage.hidden = false; document.body.classList.add('witch-active');
    this.$('announcement').textContent = `女巫出现在星空里了！点击她，命中 ${this.rules.hits} 次赶跑她。`; this.callbacks.sound('witch-arrive');
    let finish;
    const done = new Promise(resolve => { finish = resolve; });
    this.finish = finish; this.$('witch-continue').onclick = () => { if (this.state === 'won') finish(); };
    let previous = performance.now();
    const frame = now => {
      if (!document.hidden) this.clock += Math.min(50, now - previous); previous = now;
      if (this.state === 'intro' && this.clock >= 700) { if (item.hits >= this.rules.hits) this.win(); else this.move(); }
      else if (this.state === 'visible' && this.clock >= this.rules.visibleMs) { this.state = 'hidden'; this.clock = 0; this.target.hidden = true; this.target.disabled = true; }
      else if (this.state === 'hidden' && this.clock >= this.rules.hiddenMs) this.move();
      else if (this.state === 'shot' && this.clock >= 450) this.impact();
      else if (this.state === 'hit' && this.clock >= 500) { this.state = 'hidden'; this.clock = 0; this.target.hidden = true; }
      else if (this.state === 'won' && this.clock >= 10000) finish();
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
    try { await done; }
    finally { cancelAnimationFrame(this.frameId); this.projectile?.remove(); this.projectile = null; this.$('witch-continue').onclick = null; this.state = 'idle'; this.stage.hidden = true; this.$('machine').classList.remove('witch-firing'); document.body.classList.remove('witch-active'); }
  }
}
