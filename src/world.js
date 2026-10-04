class MagicWorld {
  constructor(rules, saved, history, callbacks) {
    this.rules = rules; this.state = normalizeWorldState(saved, history, rules); this.callbacks = callbacks; this.busy = false;
    this.$ = id => document.getElementById(id); this.dialog = this.$('world-dialog');
    this.dialog.addEventListener('cancel', event => event.preventDefault());
    this.witch = new WitchGame(rules.witch, callbacks);
    this.render();
  }
  snapshot() { return structuredClone(this.state); }
  render(theme = true) {
    const pendingUpgrade = this.state.pending.find(item => item.kind === 'upgrade');
    const threshold = MACHINE_LEVELS.find(level => level.id === pendingUpgrade?.level)?.threshold;
    const level = machineLevel(threshold ? Math.min(this.state.completedDraws, this.rules[threshold] - 1) : this.state.completedDraws, this.rules);
    const next = MACHINE_LEVELS[MACHINE_LEVELS.indexOf(level) + 1];
    if (theme) this.$('machine').dataset.level = level.id;
    this.$('machine-level').textContent = `✦ ${level.name}${next ? ` · ${this.state.completedDraws}/${this.rules[next.threshold]}` : ''} ✦`;
    this.$('machine-level').setAttribute('aria-label', `${level.name}，累计抽奖 ${this.state.completedDraws} 次${next ? `，${this.rules[next.threshold]} 次解锁${next.name}` : '，已完成全部形态升级'}`);
  }
  completedDraw() {
    this.state = advanceWorld(this.state, this.rules, this.callbacks.energy(), this.callbacks.warningThreshold, Math.random);
    for (const pending of this.state.pending) if (pending.kind === 'witch' || (pending.kind === 'event' && pending.id !== 'ghost')) pending.giftId = this.callbacks.pickGift(pending.id).id;
    this.render(false);
  }
  async visit(item) {
    const event = this.rules.events.find(event => event.id === item.id), stage = this.$('world-visitor');
    stage.dataset.kind = item.id; stage.dataset.action = 'arriving'; stage.hidden = false;
    this.$('visitor-art').replaceChildren(); this.$('visitor-gift').replaceChildren();
    if (event.image) { const image = document.createElement('img'); image.src = event.image; image.alt = ''; this.$('visitor-art').append(image); }
    else this.$('visitor-art').textContent = item.id === 'fairy' ? '🧚' : item.id === 'mermaid' ? '🧜‍♀️' : '👻';
    this.$('visitor-title').textContent = `${event.name}来啦！`; this.$('visitor-outcome').textContent = item.id === 'fairy' ? '送你五颗爱心魔法！' : item.id === 'mermaid' ? '听！海洋的歌声来了！' : '咦，谁想偷吸一口魔法？';
    this.callbacks.sound(item.id);
    try {
      await this.callbacks.wait(1400);
      const result = this.callbacks.apply(event, item.giftId);
      this.state.pending.shift(); this.callbacks.save(); this.render();
      stage.dataset.action = 'visiting'; this.$('visitor-title').textContent = result.description; this.$('visitor-outcome').textContent = result.detail;
      if (result.gift) this.callbacks.art(result.gift, this.$('visitor-gift'));
      if (item.id === 'fairy' && !result.gift) {
        const from = this.$('visitor-art').getBoundingClientRect(), to = this.$('power-count').getBoundingClientRect();
        for (let i = 0; i < Math.min(5, result.delta || 0); i++) {
          const heart = document.createElement('span'); heart.className = 'visitor-energy-heart'; heart.textContent = '♥';
          heart.style.left = `${from.left + from.width / 2}px`; heart.style.top = `${from.top + from.height / 2}px`;
          heart.style.setProperty('--dx', `${to.left + to.width / 2 - from.left - from.width / 2}px`); heart.style.setProperty('--dy', `${to.top - from.top - from.height / 2}px`); heart.style.setProperty('--delay', `${i * .14}s`); document.body.append(heart);
        }
      }
      this.$('announcement').textContent = `${result.description}。${result.detail}`;
      await this.callbacks.wait(Math.max(500, event.durationMs - 3000));
      stage.dataset.action = 'departing'; await this.callbacks.wait(1600);
    } finally { stage.hidden = true; document.querySelectorAll('.visitor-energy-heart').forEach(el => el.remove()); this.$('visitor-art').replaceChildren(); this.$('visitor-gift').replaceChildren(); }
  }
  async awakenLifeTree() {
    const machine = this.$('machine'), banner = this.$('life-upgrade-banner');
    banner.hidden = false; this.$('life-upgrade-caption').textContent = '听，泥土里的小心跳……';
    this.$('announcement').textContent = '生命树即将醒来！';
    this.callbacks.sound('upgrade-life');
    await this.callbacks.wait(700);
    this.state.pending.shift(); this.callbacks.save(); this.render();
    machine.classList.add('life-awakening');
    try {
      await this.callbacks.wait(1400); this.$('life-upgrade-caption').textContent = '树根发光，城堡长出新枝叶！';
      await this.callbacks.wait(1600); this.$('life-upgrade-caption').textContent = '星星果实亮起来，生命树机器解锁！';
      this.$('announcement').textContent = '生命树机器解锁！四季树冠、星星果实、木琴和风铃的新魔法。';
      await this.callbacks.wait(1500);
    } finally { machine.classList.remove('life-awakening'); banner.hidden = true; }
  }
  async playPending() {
    if (this.busy || !this.state.pending.length) return;
    this.busy = true; document.body.classList.add('world-busy');
    try {
      for (let scene = 0; scene < 1 && this.state.pending.length; scene++) {
        const item = this.state.pending[0];
        if (item.kind === 'upgrade' && item.level === 'life') { await this.awakenLifeTree(); continue; }
        if (item.kind === 'witch') {
          await this.witch.play(item, () => {
            const result = this.callbacks.apply({ id: item.opponent || 'witch' }, item.giftId);
            this.state.pending.shift(); this.callbacks.save(); this.render();
            return result;
          });
          continue;
        }
        if (item.kind === 'event' && ['fairy', 'ghost', 'mermaid'].includes(item.id)) { await this.visit(item); continue; }
        const event = item.kind === 'event' ? this.rules.events.find(event => event.id === item.id) : null;
        const upgradeLevel = item.level || 'rainbow';
        const upgradeName = MACHINE_LEVELS.find(level => level.id === upgradeLevel)?.name || '彩虹机器';
        this.dialog.dataset.scene = item.kind === 'upgrade' ? 'upgrade' : item.id;
        this.dialog.dataset.upgrade = upgradeLevel;
        this.dialog.classList.remove('acted');
        this.$('scene-title').textContent = event ? `${event.name}来啦！` : { rainbow: '彩虹魔法，正在醒来！', winged: '看！机器要长出翅膀啦！', castle: '一座魔法城堡，正在长大！' }[upgradeLevel];
        this.$('scene-description').textContent = event ? { fairy: '她带来了一点闪亮魔法。', ghost: '咦？谁在偷偷吸一口魔法？', courier: '有一份礼物，专门送给你！' }[item.id] : '你的机器，学会了新的魔法。';
        this.$('scene-outcome').textContent = '';
        this.$('scene-avatar').hidden = !event; this.$('upgrade-emblem').hidden = !!event;
        this.$('scene-avatar').replaceChildren();
        if (event?.image) { const img = document.createElement('img'); img.src = event.image; img.alt = event.name; this.$('scene-avatar').append(img); }
        else if (event) this.$('scene-avatar').textContent = { fairy: '🧚', ghost: '👻', courier: '🧝' }[item.id];
        this.$('scene-reward').replaceChildren();
        this.$('scene-reward').textContent = item.id === 'courier' ? '🎁' : item.kind === 'upgrade' ? '✦' : '♥';
        const button = this.$('continue-world'); button.disabled = true;
        this.dialog.showModal(); this.$('world-dialog').focus();
        this.callbacks.sound(item.kind === 'upgrade' ? `upgrade-${upgradeLevel}` : item.id);
        await this.callbacks.wait(780);
        // 效果与队列一起保存；中途刷新只继续尚未结算的事件。
        const result = item.kind === 'upgrade' ? { description: `${upgradeName}解锁！`, detail: { rainbow: '彩虹外壳 · 新的启动旋律', winged: '星光翅膀 · 云朵底座 · 扇翅起飞', castle: '皇冠塔楼 · 魔法城堡门 · 星星礼炮' }[upgradeLevel] } : this.callbacks.apply(event, item.giftId);
        this.state.pending.shift(); this.callbacks.save(); this.render();
        if (item.kind === 'upgrade') {
          this.$('machine').classList.add('transforming');
          clearTimeout(this.transformTimer); this.transformTimer = setTimeout(() => this.$('machine').classList.remove('transforming'), 2400);
        }
        if (result.gift) this.callbacks.art(result.gift, this.$('scene-reward'));
        this.$('scene-title').textContent = result.description;
        this.$('scene-outcome').textContent = result.detail;
        this.dialog.classList.add('acted');
        this.$('announcement').textContent = `${result.description}。${result.detail}`;
        button.disabled = false;
        let finish;
        const clicked = new Promise(resolve => { finish = resolve; });
        button.onclick = finish;
        await Promise.race([this.callbacks.wait((event?.durationMs || 10000) - 780), clicked]);
        button.onclick = null; this.dialog.close();
      }
    } finally {
      this.busy = false; document.body.classList.remove('world-busy'); this.dialog.close(); this.render();
    }
  }
}
