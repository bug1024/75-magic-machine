// 组合发现与首次奖励同步保存；重复演出只使用当前花园伙伴。
class GardenStories {
  constructor(garden, rules) {
    this.garden = garden; this.rules = normalizeStoryRules({ version: 1, stories: rules }).filter(story => story.enabled); this.busy = false; this.clock = 0; this.quietUntil = 0;
    this.stage = document.getElementById('garden-story-stage'); this.panel = document.getElementById('garden-story-panel');
    this.button = document.getElementById('garden-story-button');
    this.button.onclick = () => { if (this.panel.hidden && !garden.callbacks.canPlay()) return; this.panel.hidden = !this.panel.hidden; document.getElementById('garden-story-shade').hidden = this.panel.hidden; if (!this.panel.hidden) document.getElementById('close-garden-stories').focus(); this.button.setAttribute('aria-expanded', String(!this.panel.hidden)); this.render(); };
    document.getElementById('close-garden-stories').onclick = () => this.closePanel();
    document.getElementById('garden-story-shade').onclick = () => this.closePanel();
    document.addEventListener('keydown', event => { if (!this.panel.hidden && event.key === 'Escape') { event.preventDefault(); this.closePanel(); this.button.focus(); } });
    this.panel.addEventListener('keydown', event => { if (event.key !== 'Tab') return; const controls = [...this.panel.querySelectorAll('button:not(:disabled)')]; const first = controls[0], last = controls.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } });
    this.render();
    const tick = (now, elapsed) => {
      const active = !document.hidden && (garden.callbacks.canStory?.() ?? garden.callbacks.canPlay());
      document.body.classList.toggle('story-paused', this.busy && !active);
      this.stage.style.visibility = this.busy && !active ? 'hidden' : '';
      if (this.busy && active) { this.clock += elapsed; this.renderBeat(); if (this.clock >= this.current.durationMs) this.finish(); }
      else if (!this.busy && active && !garden.chosen && !this.panel.hidden) { /* 查看图鉴时不自动打断。 */ }
      else if (!this.busy && active && !garden.chosen && now >= this.quietUntil && (garden.callbacks.canAutoStory?.() ?? true)) {
        const ready = this.rules.filter(story => !garden.state.discovered.includes(story.id) && this.match(story));
        const next = ready.find(story => story.requirements.some(role => role.id)) || ready[0];
        if (next) this.play(next);
      }
    }; new ForegroundLoop(tick, () => this.busy ? 100 : 250);
  }
  match(story) { return matchGardenStory(story, this.garden.state.workshop.tray, this.garden.treasures); }
  closePanel() { const wasOpen = !this.panel.hidden; this.panel.hidden = true; document.getElementById('garden-story-shade').hidden = true; if (wasOpen) this.button.focus(); this.button.setAttribute('aria-expanded', 'false'); }
  render() {
    const grid = document.getElementById('garden-story-list'); grid.replaceChildren();
    const discovered = this.rules.filter(story => this.garden.state.discovered.includes(story.id));
    document.getElementById('garden-story-count').textContent = `${discovered.length}/${this.rules.length}`;
    const ordered = [...this.rules].sort((a, b) => Number(this.garden.state.discovered.includes(b.id)) - Number(this.garden.state.discovered.includes(a.id)) || (this.garden.state.discoveredAt[b.id] || 0) - (this.garden.state.discoveredAt[a.id] || 0));
    for (const story of ordered) {
      const known = this.garden.state.discovered.includes(story.id), ready = !!this.match(story);
      const row = document.createElement('article'); row.className = 'garden-story-card';
      const title = document.createElement('h3'); title.textContent = `${known ? story.icon : '✧'} ${story.name}`;
      const hint = document.createElement('p'); hint.textContent = known && !ready ? `${story.hint} 邀请伙伴到魔法台就能再看。` : story.hint;
      const replay = document.createElement('button'); replay.type = 'button'; replay.dataset.story = story.id;
      replay.textContent = known ? '再看一次 ↻' : ready ? '发现故事 ✦' : '等待发现'; replay.disabled = this.busy;
      const recipe = document.createElement('div'); recipe.className = 'story-recipe'; recipe.setAttribute('aria-label', story.hint);
      const used = new Set(), matched = this.match(story); let roleIndex = 0;
      for (const role of story.requirements) for (let i = 0; i < role.count; i++) {
        const candidates = this.garden.treasures.filter(t => !used.has(t.id) && t.tags.includes(role.tag) && (!role.id || t.id === role.id));
        const companion = matched ? this.garden.treasures.find(t => t.id === matched[roleIndex]) : candidates.find(t => !!this.garden.callbacks.inventory()[t.id]) || candidates[0]; roleIndex++;
        if (recipe.childNodes.length) { const plus = document.createElement('span'); plus.textContent = '+'; recipe.append(plus); }
        const portrait = document.createElement('div'); portrait.className = 'recipe-companion';
        if (companion) { used.add(companion.id); this.garden.callbacks.art(companion, portrait); portrait.title = `${companion.name}${!!this.garden.callbacks.inventory()[companion.id] ? ' · 已拥有' : ' · 待发现'}${role.id ? '' : '（也可换同类伙伴）'}`; if (!!!this.garden.callbacks.inventory()[companion.id]) portrait.classList.add('missing'); }
        else portrait.textContent = '?'; recipe.append(portrait);
      }
      replay.onclick = () => { this.closePanel(); this.garden.workshop.select(story.id); }; row.append(title, recipe, hint, replay); grid.append(row);
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
      garden.state.discovered.push(story.id); garden.state.discoveredAt[story.id] = Date.now(); garden.callbacks.reward?.(story.energyReward); garden.callbacks.save(); this.render();
    }
    const stage = this.stage; stage.dataset.effect = story.effect; stage.dataset.time = garden.state.timeOfDay; stage.dataset.season = garden.state.season; stage.dataset.weather = garden.weather || 'clear';
    document.body.dataset.story = story.effect;
    document.getElementById('garden-story-title').textContent = story.name;
    this.first = first; this.beat = -1; this.renderBeat();
    const actors = document.getElementById('garden-story-actors'); actors.replaceChildren();
    for (const [index, id] of participants.entries()) {
      const actor = document.createElement('div'); actor.className = 'story-actor'; actor.style.setProperty('--actor', index);
      const treasure = garden.treasures.find(item => item.id === id); actor.dataset.treasure = id; garden.callbacks.art(treasure, actor);
      if (story.effect === 'forest' && treasure.appearance.interactionImage) actor.querySelector('img').src = treasure.appearance.interactionImage;
      actors.append(actor);
    }
    const bits = document.getElementById('garden-story-bits'); bits.replaceChildren();
    const symbols = {
      forest: garden.state.season === 'winter' ? ['❄','♪','✿'] : ['✿','♪','🌱'], ocean: ['🫧','🐟','💧'],
      ball: garden.state.timeOfDay === 'night' ? ['✦','⭐','🦋'] : ['🦋','🌈','✧'], prank: ['💨','🌈','😆'],
      lunar: ['⭐','🫧','🌙'], secret: ['🌱','✿','✧'], race: ['🍃','🏁','✦'], hug: ['💗','🐾','💕'],
      sparkle: ['💎','⭐','✧'], picnic: ['🫧','💧','🌸']
    }[story.effect];
    const count = story.effect === 'ocean' && garden.weather === 'rain' ? 32 : 20;
    for (let i = 0; i < count; i++) { const bit = document.createElement('i'); bit.textContent = symbols[i % symbols.length]; bit.style.setProperty('--i', i); bit.style.setProperty('--x', `${5 + i * 31 % 90}%`); bits.append(bit); }
    stage.hidden = false; document.getElementById('announcement').textContent = `${story.name}开始啦！${first ? '发现了一段新的花园故事。' : ''}`;
    await garden.callbacks.unlock();
    if (this.busy && canRun() && !document.hidden) garden.callbacks.storySound?.(story.effect, garden.state.timeOfDay, garden.weather);
  }
  renderBeat() {
    const lines = this.current.lines || [], beat = Math.min(2, Math.floor(this.clock / (this.current.durationMs / 3)));
    if (this.beat === beat) return;
    this.beat = beat; this.stage.dataset.beat = beat;
    if (this.current.effect === 'secret' && beat >= 1) {
      for (const actor of document.getElementById('garden-story-actors').children) {
        const treasure = this.garden.treasures.find(item => item.id === actor.dataset.treasure);
        if (treasure?.appearance.interactionImage) actor.querySelector('img').src = treasure.appearance.interactionImage;
      }
    }
    document.getElementById('garden-story-caption').textContent = lines[beat] || (this.first ? '新故事发现啦！' : '伙伴们，再来一次！');
  }
  finish() {
    // 让孩子有时间看自己的花园，多个组合不会连续抢占舞台。
    this.quietUntil = performance.now() + 10000;
    this.busy = false; this.garden.adventures?.render(); this.garden.callbacks.storyFinished?.(this.current.id); this.stage.hidden = true; delete document.body.dataset.story;
    document.getElementById('garden-story-actors').replaceChildren(); document.getElementById('garden-story-bits').replaceChildren(); this.render();
  }
}
