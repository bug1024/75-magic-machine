// 组合发现与首次奖励同步保存；重复演出只使用当前花园伙伴。
class GardenStories {
  constructor(garden, rules) {
    this.garden = garden; this.rules = normalizeStoryRules({ version: 1, stories: rules }).filter(story => story.enabled); this.busy = false; this.clock = 0;
    this.stage = document.getElementById('garden-story-stage'); this.panel = document.getElementById('garden-story-panel');
    this.button = document.getElementById('garden-story-button');
    this.button.onclick = () => { if (!garden.callbacks.canPlay()) return; this.panel.hidden = !this.panel.hidden; this.button.setAttribute('aria-expanded', String(!this.panel.hidden)); this.render(); };
    document.getElementById('close-garden-stories').onclick = () => this.closePanel();
    this.panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); this.closePanel(); this.button.focus(); } });
    this.render(); let previous = performance.now();
    const tick = now => {
      const active = !document.hidden && (garden.callbacks.canStory?.() ?? garden.callbacks.canPlay());
      document.body.classList.toggle('story-paused', this.busy && !active);
      this.stage.style.visibility = this.busy && !active ? 'hidden' : '';
      if (this.busy && active) { this.clock += Math.min(50, now - previous); if (this.clock >= this.current.durationMs) this.finish(); }
      else if (!this.busy && active && !garden.chosen && !this.panel.hidden) { /* 查看图鉴时不自动打断。 */ }
      else if (!this.busy && active && !garden.chosen) {
        const next = this.rules.find(story => !garden.state.discovered.includes(story.id) && this.match(story));
        if (next) this.play(next);
      }
      previous = now; requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
  }
  match(story) { return matchGardenStory(story, this.garden.state.slots, this.garden.treasures); }
  closePanel() { this.panel.hidden = true; this.button.setAttribute('aria-expanded', 'false'); }
  render() {
    const grid = document.getElementById('garden-story-list'); grid.replaceChildren();
    const discovered = this.rules.filter(story => this.garden.state.discovered.includes(story.id));
    document.getElementById('garden-story-count').textContent = `${discovered.length}/${this.rules.length}`;
    for (const story of this.rules) {
      const known = this.garden.state.discovered.includes(story.id), ready = !!this.match(story);
      const row = document.createElement('article'); row.className = 'garden-story-card';
      const title = document.createElement('h3'); title.textContent = `${known ? story.icon : '✧'} ${story.name}`;
      const hint = document.createElement('p'); hint.textContent = known && !ready ? `${story.hint} 把伙伴放回花园就能再看。` : story.hint;
      const replay = document.createElement('button'); replay.type = 'button'; replay.dataset.story = story.id;
      replay.textContent = known ? '再看一次 ↻' : ready ? '发现故事 ✦' : '等待发现'; replay.disabled = !ready || this.busy;
      replay.onclick = () => this.play(story); row.append(title, hint, replay); grid.append(row);
    }
  }
  async play(story) {
    const garden = this.garden, canRun = () => garden.callbacks.canStory?.() ?? garden.callbacks.canPlay();
    if (this.busy || !canRun() || !this.match(story)) return;
    // 先锁定，防止解锁音频期间的连点或自动判定产生重复演出。
    this.busy = true; this.current = story; this.clock = 0;
    const first = !garden.state.discovered.includes(story.id), participants = this.match(story);
    this.closePanel(); this.render();
    if (first) {
      garden.state.discovered.push(story.id); garden.callbacks.reward?.(story.energyReward); garden.callbacks.save(); this.render();
    }
    const stage = this.stage; stage.dataset.effect = story.effect; stage.dataset.time = garden.state.timeOfDay; stage.dataset.season = garden.state.season; stage.dataset.weather = garden.weather || 'clear';
    document.body.dataset.story = story.effect;
    document.getElementById('garden-story-title').textContent = story.name;
    document.getElementById('garden-story-caption').textContent = first ? '新故事发现啦！' : '伙伴们，再来一次！';
    const actors = document.getElementById('garden-story-actors'); actors.replaceChildren();
    for (const [index, id] of participants.entries()) {
      const actor = document.createElement('div'); actor.className = 'story-actor'; actor.style.setProperty('--actor', index);
      const treasure = garden.treasures.find(item => item.id === id); garden.callbacks.art(treasure, actor);
      if (story.effect === 'forest' && treasure.appearance.interactionImage) actor.querySelector('img').src = treasure.appearance.interactionImage;
      actors.append(actor);
    }
    const bits = document.getElementById('garden-story-bits'); bits.replaceChildren();
    const symbols = story.effect === 'forest' ? (garden.state.season === 'winter' ? ['❄','♪','✿'] : ['✿','♪','🌱']) : story.effect === 'ocean' ? ['🫧','🐟','💧'] : story.effect === 'ball' ? (garden.state.timeOfDay === 'night' ? ['✦','⭐','🦋'] : ['🦋','🌈','✧']) : ['💨','✦','😆'];
    const count = story.effect === 'ocean' && garden.weather === 'rain' ? 32 : 20;
    for (let i = 0; i < count; i++) { const bit = document.createElement('i'); bit.textContent = symbols[i % symbols.length]; bit.style.setProperty('--i', i); bit.style.setProperty('--x', `${5 + i * 31 % 90}%`); bits.append(bit); }
    stage.hidden = false; document.getElementById('announcement').textContent = `${story.name}开始啦！${first ? '发现了一段新的花园故事。' : ''}`;
    await garden.callbacks.unlock();
    if (this.busy && canRun() && !document.hidden) garden.callbacks.storySound?.(story.effect, garden.state.timeOfDay, garden.weather);
  }
  finish() {
    this.busy = false; this.stage.hidden = true; delete document.body.dataset.story;
    document.getElementById('garden-story-actors').replaceChildren(); document.getElementById('garden-story-bits').replaceChildren(); this.render();
  }
}
