// 花园与天气始终留在主场景；天气时钟只累计前台、无弹层的时间。
class MagicGarden {
  constructor(rules, saved, treasures, history, callbacks, dayNightRules, seasonRules, storyRules) {
    this.rules = normalizeWeatherRules(rules); this.treasures = treasures; this.callbacks = callbacks;
    this.state = normalizeGardenState(saved, treasures, history, callbacks.inventory?.()); this.chosen = null; this.elapsed = 0; this.weather = null;
    this.dayNightRules = normalizeDayNightRules(dayNightRules); this.dayElapsed = 0;
    this.seasonRules = normalizeSeasonRules(seasonRules); this.seasonElapsed = 0;
    this.state.season ||= this.seasonRules.initial; this.renderSeason();
    document.getElementById('season').onclick = () => { if (callbacks.canPlay()) this.nextSeason(); };
    this.state.timeOfDay ||= this.dayNightRules.initial; this.renderTime();
    document.getElementById('day-night').onclick = () => { if (callbacks.canPlay()) this.toggleTime(); };
    this.nextAt = this.rules.firstAfterMs; this.lastKind = null;
    this.plots = document.getElementById('garden-plots'); this.layer = document.getElementById('weather-layer');
    this.cancel = document.getElementById('garden-cancel'); this.cancel.onclick = () => this.choose(null);
    document.getElementById('weather').onclick = async () => {
      if (!callbacks.canPlay()) return;
      await callbacks.unlock(); if (callbacks.canPlay()) this.startWeather();
    };
    this.render();
    this.stories = new GardenStories(this, storyRules);
    if (JSON.stringify(saved?.slots || []) !== JSON.stringify(this.state.slots) && saved?.slots) queueMicrotask(() => callbacks.save());
    const tick = (now, elapsed) => {
      const active = callbacks.canWeather() && !document.hidden;
      document.body.classList.toggle('weather-paused', !active);
      if (active) {
        const delta = elapsed; this.elapsed += delta; this.dayElapsed += delta; this.seasonElapsed += delta;
        if (this.seasonRules.enabled && this.seasonElapsed >= this.seasonRules.durationMs) this.nextSeason();
        if (this.dayNightRules.enabled && this.dayElapsed >= this.dayNightRules.durationMs) this.toggleTime();
        if (this.weather && this.elapsed >= this.endsAt) this.endWeather();
        if (!this.weather && this.rules.enabled && this.elapsed >= this.nextAt) this.startWeather(false);
      }
    }; new ForegroundLoop(tick, 250);
  }
  snapshot() { return { adventures: structuredClone(this.state.adventures), discoveredAt: {...this.state.discoveredAt}, discovered: [...this.state.discovered], season: this.state.season, timeOfDay: this.state.timeOfDay, slots: [...this.state.slots] }; }
  renderSeason() {
    const seasons = { spring: ['🌸', '春天'], summer: ['🌿', '夏天'], autumn: ['🍁', '秋天'], winter: ['❄', '冬天'] };
    document.body.dataset.season = this.state.season;
    const [icon, name] = seasons[this.state.season], next = seasons[SEASONS[(SEASONS.indexOf(this.state.season) + 1) % 4]][1];
    const button = document.getElementById('season'); button.textContent = icon; button.title = `${name}，点击切换${next}`; button.setAttribute('aria-label', `现在是${name}，切换到${next}`);
  }
  nextSeason() { this.state.season = SEASONS[(SEASONS.indexOf(this.state.season) + 1) % 4]; this.seasonElapsed = 0; this.renderSeason(); this.callbacks.save(); }
  renderTime() {
    const day = this.state.timeOfDay === 'day'; document.body.dataset.time = this.state.timeOfDay;
    const button = document.getElementById('day-night'); button.textContent = day ? '☀' : '☾'; button.title = day ? '白天，点击切换黑夜' : '黑夜，点击切换白天';
    button.setAttribute('aria-label', day ? '现在是白天，切换到黑夜' : '现在是黑夜，切换到白天');
    button.setAttribute('aria-pressed', String(!day));
  }
  toggleTime() { this.state.timeOfDay = this.state.timeOfDay === 'day' ? 'night' : 'day'; this.dayElapsed = 0; this.renderTime(); this.callbacks.save(); }
  used(id) { return this.state.slots.filter(value => value === id).length; }
  available(id) { return Math.max(0, (this.callbacks.inventory?.()[id] || 0) - this.used(id)); }
  choose(treasure) {
    if (treasure && this.available(treasure.id) <= 0) return false;
    this.chosen = treasure; this.plots.classList.toggle('placing', !!treasure); this.cancel.hidden = !treasure;
    document.getElementById('garden-selection').textContent = treasure ? `${treasure.name} · 点一块花圃` : '';
    this.render();
    if (treasure) this.plots.querySelector('.garden-slot:not(:disabled)')?.focus();
    return true;
  }
  render() {
    this.players?.forEach(player => player.destroy()); this.players = [];
    this.plots.replaceChildren();
    this.state.slots.forEach((id, index) => {
      const treasure = this.treasures.find(item => item.id === id);
      const plot = document.createElement('div'); plot.className = 'garden-plot';
      const button = document.createElement('button'); button.type = 'button'; button.className = `garden-slot${treasure ? '' : ' empty'}`; button.dataset.slot = index;
      button.setAttribute('aria-label', this.chosen ? `把${this.chosen.name}放到第${index + 1}块花圃${treasure ? '，替换' + treasure.name : ''}` : treasure ? `和${treasure.name}玩一玩` : `第${index + 1}块空花圃，打开我的宝藏来布置`);
      const art = document.createElement('span'); art.className = 'garden-art';
      if (treasure) this.callbacks.art(treasure, art);
      else { const placeholder = document.createElement('span'); placeholder.className = 'garden-placeholder'; placeholder.textContent = '＋'; placeholder.setAttribute('aria-hidden', 'true'); art.append(placeholder); }
      if (this.chosen && treasure?.id === this.chosen.id) button.disabled = true;
      button.append(art); const label = document.createElement('span'); label.className = 'garden-name'; label.textContent = treasure?.name || (this.chosen ? '放这里' : '待摆放'); button.append(label);
      const play = treasure ? new TreasurePlay(button, {
        canPlay: () => this.callbacks.canPlay() && !this.chosen,
        feedback: (item, kind, count, event, line, reaction) => { this.callbacks.sound(kind, count, reaction, item); document.getElementById('announcement').textContent = line; }
      }, false) : null;
      if (treasure?.effects.guardian) { const badge = document.createElement('span'); badge.className = 'guardian-badge'; badge.textContent = '🛡'; badge.title = treasure.effects.guardian === 'heart-shield' ? '守护已生效：每场爱心助攻一次并抵挡一次迷雾，移走后失效' : '守护已生效：每件每场最多助攻一次，总助攻不超过一半血量，移走后失效'; button.append(badge); }
      if (play) { const actionLabel = button.getAttribute('aria-label'); play.set(treasure); if (this.chosen) button.setAttribute('aria-label', actionLabel); this.players.push(play); }
      button.onclick = event => {
        if (!this.callbacks.canPlay()) return;
        if (this.chosen) {
          if (this.available(this.chosen.id) <= 0) { this.choose(null); return; }
          this.state.slots[index] = this.chosen.id; this.chosen = null; this.choose(null); this.callbacks.save();
          this.plots.querySelector(`[data-slot="${index}"]`).focus(); this.callbacks.sound('flower-bloom');
        } else if (treasure) play.play(event);
        else document.getElementById('collection').click();
      };
      plot.append(button);
      if (treasure) { const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'garden-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', `从花园移走${treasure.name}`); remove.onclick = () => { if (!this.callbacks.canPlay()) return; this.state.slots[index] = null; this.render(); this.callbacks.save(); this.plots.querySelector(`[data-slot="${index}"]`).focus(); }; plot.append(remove); }
      this.plots.append(plot);
    });
    this.stories?.render();
  }
  startWeather(manual = true) {
    if (!this.rules.enabled || !this.rules.kinds.length) return;
    const choices = this.rules.kinds.filter(kind => kind !== this.lastKind);
    const kind = chooseWeather(choices.length ? choices : this.rules.kinds, this.rules.weights);
    if (!kind) return;
    this.callbacks.weatherStarted?.(manual);
    this.weather = this.lastKind = kind; this.endsAt = this.elapsed + this.rules.durationMs;
    document.body.dataset.weather = kind; this.layer.replaceChildren();
    const labels = { rain: '🌧️ 魔法雨', snow: '❄️ 雪花舞会', wind: '🍃 风精灵', meteors: '🌠 流星雨', icecream: '🍦 冰激凌雨', coins: '🪙 金币雨', sakura: '🌸 樱花雨', storm: '⛈️ 魔法大风暴' };
    document.getElementById('weather-name').textContent = labels[kind].split(' ')[0]; document.getElementById('weather').title = `${labels[kind]}，点击切换天气`; document.getElementById('weather').setAttribute('aria-label', `${labels[kind]}，点击切换天气`);
    const count = kind === 'storm' ? 72 : kind === 'rain' ? 64 : kind === 'snow' || kind === 'sakura' ? 40 : kind === 'wind' ? 20 : kind === 'meteors' ? 12 : 28;
    for (let i = 0; i < count; i++) {
      const bit = document.createElement('i'); bit.style.setProperty('--x', `${Math.random() * 100}%`); bit.style.setProperty('--delay', `${-Math.random() * 8}s`); bit.style.setProperty('--duration', `${['rain', 'storm'].includes(kind) ? .65 + Math.random() * .4 : 3 + Math.random() * 5}s`); bit.style.setProperty('--size', `${8 + Math.random() * 14}px`);
      bit.textContent = { snow: '❄', wind: '🍃', icecream: ['🍦','🍨'][i % 2], coins: '★', sakura: '🌸' }[kind] || '';
      if (kind === 'storm' && i % 5 === 0) { bit.textContent = '🍃'; bit.className = 'storm-leaf'; } this.layer.append(bit);
    }
    this.adventures?.startWeather(kind);
    this.callbacks.weatherSound(kind);
  }
  endWeather() {
    this.adventures?.stopWeather();
    if (this.weather) this.callbacks.weatherFinished?.();
    this.weather = null; delete document.body.dataset.weather; this.layer.replaceChildren();
    this.nextAt = this.elapsed + this.rules.intervalMs; document.getElementById('weather-name').textContent = '⛅️'; document.getElementById('weather').title = '晴天，点击切换天气'; document.getElementById('weather').setAttribute('aria-label', '晴天，点击切换天气');
  }
}
