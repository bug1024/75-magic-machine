// 花园与天气始终留在主场景；天气时钟只累计前台、无弹层的时间。
class MagicGarden {
  constructor(rules, saved, treasures, history, callbacks, dayNightRules, seasonRules) {
    this.rules = normalizeWeatherRules(rules); this.treasures = treasures; this.callbacks = callbacks;
    this.state = normalizeGardenState(saved, treasures, history); this.chosen = null; this.elapsed = 0; this.weather = null;
    this.dayNightRules = normalizeDayNightRules(dayNightRules); this.dayElapsed = 0;
    this.seasonRules = normalizeSeasonRules(seasonRules); this.seasonElapsed = 0;
    this.state.season ||= this.seasonRules.initial; this.renderSeason();
    document.getElementById('season').onclick = () => { if (callbacks.canPlay()) this.nextSeason(); };
    this.state.timeOfDay ||= this.dayNightRules.initial; this.renderTime();
    document.getElementById('day-night').onclick = () => { if (callbacks.canPlay()) this.toggleTime(); };
    this.nextAt = this.rules.firstAfterMs; this.lastKind = null; this.lastTime = performance.now();
    this.plots = document.getElementById('garden-plots'); this.layer = document.getElementById('weather-layer');
    this.cancel = document.getElementById('garden-cancel'); this.cancel.onclick = () => this.choose(null);
    document.getElementById('weather').onclick = async () => {
      if (!callbacks.canPlay()) return;
      await callbacks.unlock(); if (callbacks.canPlay()) this.startWeather();
    };
    this.render();
    const tick = now => {
      const active = callbacks.canWeather() && !document.hidden;
      document.body.classList.toggle('weather-paused', !active);
      if (active) {
        const delta = Math.min(50, now - this.lastTime); this.elapsed += delta; this.dayElapsed += delta; this.seasonElapsed += delta;
        if (this.seasonRules.enabled && this.seasonElapsed >= this.seasonRules.durationMs) this.nextSeason();
        if (this.dayNightRules.enabled && this.dayElapsed >= this.dayNightRules.durationMs) this.toggleTime();
        if (this.weather && this.elapsed >= this.endsAt) this.endWeather();
        if (!this.weather && this.rules.enabled && this.elapsed >= this.nextAt) this.startWeather();
      }
      this.lastTime = now; requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
  }
  snapshot() { return { season: this.state.season, timeOfDay: this.state.timeOfDay, slots: [...this.state.slots] }; }
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
  choose(treasure) {
    this.chosen = treasure; this.plots.classList.toggle('placing', !!treasure); this.cancel.hidden = !treasure;
    document.getElementById('garden-selection').textContent = treasure ? `${treasure.name} · 点一块花圃` : '';
    this.render();
    if (treasure) this.plots.querySelector('.garden-slot').focus();
  }
  render() {
    this.plots.replaceChildren();
    this.state.slots.forEach((id, index) => {
      const treasure = this.treasures.find(item => item.id === id);
      const plot = document.createElement('div'); plot.className = 'garden-plot';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'garden-slot'; button.dataset.slot = index;
      button.setAttribute('aria-label', this.chosen ? `把${this.chosen.name}放到第${index + 1}块花圃${treasure ? '，替换' + treasure.name : ''}` : treasure ? `和${treasure.name}玩一玩` : `第${index + 1}块空花圃，打开我的宝藏来布置`);
      const art = document.createElement('span'); art.className = 'garden-art';
      if (treasure) this.callbacks.art(treasure, art); else art.textContent = this.chosen ? '＋' : ['🌷', '🌼', '🍄', '🌸', '🌻', '🌿'][index];
      button.append(art); const label = document.createElement('span'); label.className = 'garden-name'; label.textContent = treasure?.name || ''; button.append(label);
      button.onclick = () => {
        if (!this.callbacks.canPlay()) return;
        if (this.chosen) {
          this.state.slots[index] = this.chosen.id; this.chosen = null; this.choose(null); this.callbacks.save();
          this.plots.querySelector(`[data-slot="${index}"]`).focus(); this.callbacks.sound('flower-bloom');
        } else if (treasure && !button.dataset.playing) {
          button.dataset.playing = 'true'; this.callbacks.sound(treasure.effects.interaction || 'flower-bloom');
          if (treasure.effects.interaction === 'flower-bloom' && treasure.appearance.interactionImage) art.querySelector('img').src = treasure.appearance.interactionImage;
          const sparkle = document.createElement('span'); sparkle.className = 'garden-sparkles'; sparkle.textContent = '✦ ✿ ✦'; button.append(sparkle);
          setTimeout(() => { delete button.dataset.playing; sparkle.remove(); }, 1500);
        } else if (!treasure) document.getElementById('collection').click();
      };
      plot.append(button);
      if (treasure) { const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'garden-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', `从花园移走${treasure.name}`); remove.onclick = () => { if (!this.callbacks.canPlay()) return; this.state.slots[index] = null; this.render(); this.callbacks.save(); this.plots.querySelector(`[data-slot="${index}"]`).focus(); }; plot.append(remove); }
      this.plots.append(plot);
    });
  }
  startWeather() {
    if (!this.rules.enabled || !this.rules.kinds.length) return;
    const choices = this.rules.kinds.filter(kind => kind !== this.lastKind);
    const kind = (choices.length ? choices : this.rules.kinds)[Math.floor(Math.random() * (choices.length || this.rules.kinds.length))];
    this.weather = this.lastKind = kind; this.endsAt = this.elapsed + this.rules.durationMs;
    document.body.dataset.weather = kind; this.layer.replaceChildren();
    const labels = { rain: '🌧️ 魔法雨', snow: '❄️ 雪花舞会', wind: '🍃 风精灵', meteors: '🌠 流星雨' };
    document.getElementById('weather-name').textContent = labels[kind].split(' ')[0]; document.getElementById('weather').title = `${labels[kind]}，点击切换天气`; document.getElementById('weather').setAttribute('aria-label', `${labels[kind]}，点击切换天气`);
    const count = kind === 'rain' ? 64 : kind === 'snow' ? 40 : kind === 'wind' ? 20 : 12;
    for (let i = 0; i < count; i++) {
      const bit = document.createElement('i'); bit.style.setProperty('--x', `${Math.random() * 100}%`); bit.style.setProperty('--delay', `${-Math.random() * 8}s`); bit.style.setProperty('--duration', `${kind === 'rain' ? .65 + Math.random() * .4 : 3 + Math.random() * 5}s`); bit.style.setProperty('--size', `${8 + Math.random() * 14}px`);
      bit.textContent = kind === 'snow' ? '❄' : kind === 'wind' ? '🍃' : ''; this.layer.append(bit);
    }
    this.callbacks.weatherSound(kind);
  }
  endWeather() {
    this.weather = null; delete document.body.dataset.weather; this.layer.replaceChildren();
    this.nextAt = this.elapsed + this.rules.intervalMs; document.getElementById('weather-name').textContent = '⛅️'; document.getElementById('weather').title = '晴天，点击切换天气'; document.getElementById('weather').setAttribute('aria-label', '晴天，点击切换天气');
  }
}
