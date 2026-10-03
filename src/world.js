class MagicWorld {
  constructor(rules, saved, history, callbacks) {
    this.rules = rules; this.state = normalizeWorldState(saved, history, rules); this.callbacks = callbacks; this.busy = false;
    this.$ = id => document.getElementById(id); this.dialog = this.$('world-dialog');
    this.dialog.addEventListener('cancel', event => event.preventDefault());
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
    for (const pending of this.state.pending) if (pending.kind === 'event' && pending.id !== 'ghost') pending.giftId = this.callbacks.pickGift().id;
    this.render(false);
  }
  async playPending() {
    if (this.busy || !this.state.pending.length) return;
    this.busy = true; document.body.classList.add('world-busy');
    try {
      while (this.state.pending.length) {
        const item = this.state.pending[0];
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
