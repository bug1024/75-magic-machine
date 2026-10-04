// 展示区和花园使用同一套配置；互动不扣能量、不改变概率、不重复发奖。
class TreasurePlay {
  constructor(target, callbacks, bindEvents = true) {
    this.target = target; this.callbacks = callbacks; this.treasure = null; this.timer = null; this.count = 0;
    if (bindEvents) {
      target.addEventListener('click', event => this.play(event));
      target.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); if (!event.repeat) this.play(event); } });
    }
    this.onVisibility = () => { if (document.hidden) this.clearEffect(); };
    document.addEventListener('visibilitychange', this.onVisibility);
  }
  clearEffect() { clearTimeout(this.timer); this.target.removeAttribute('data-play'); this.target.removeAttribute('data-reaction'); this.target.removeAttribute('data-surprise'); this.target.querySelectorAll('.play-bits, .play-caption').forEach(el => el.remove()); }
  destroy() { this.reset(); document.removeEventListener('visibilitychange', this.onVisibility); }
  reset() {
    this.clearEffect(); this.treasure = null; this.count = 0; this.previousReaction = ''; this.lastPlayed = 0;
    this.target.removeAttribute('role'); this.target.removeAttribute('tabindex'); this.target.removeAttribute('aria-label'); this.target.removeAttribute('data-interactive');
  }
  set(treasure) {
    this.reset(); this.treasure = treasure;
    if (!treasure.effects.interaction) return;
    this.target.dataset.interactive = 'true'; this.target.tabIndex = 0; this.target.setAttribute('role', 'button');
    this.target.setAttribute('aria-label', `和${treasure.name}玩一玩，点击或按回车`);
  }
  play(event) {
    const treasure = this.treasure, kind = treasure?.effects.interaction;
    if (!kind || !this.callbacks.canPlay() || this.target.dataset.play) return;
    if (Date.now() - this.lastPlayed > 12000) this.count = 0;
    this.lastPlayed = Date.now(); this.count++;
    const reaction = chooseReaction(treasure.effects.reactions || [], this.count, this.previousReaction);
    if (reaction) { this.previousReaction = reaction.id; this.target.dataset.reaction = reaction.motion; this.target.dataset.surprise = String(reaction.surprise); }
    this.target.dataset.play = kind;
    if (kind === 'flower-bloom' && treasure.appearance.interactionImage) {
      const img = this.target.querySelector('img'); if (img) img.src = treasure.appearance.interactionImage;
    }
    const patterns = { 'burp-bubbles': ['🫧'], 'candy-rain': ['🍬'], 'jelly-hop': ['✦'], 'rainbow-flight': ['🌈'], 'mushroom-notes': ['♪'], 'flower-bloom': ['✿'], 'space-trip': ['⭐'], 'sock-giggle': ['♫'] };
    const symbols = reaction?.symbols?.length ? reaction.symbols : treasure.effects.interactionSymbols?.length ? treasure.effects.interactionSymbols : patterns[kind] || ['✦'];
    const layer = document.createElement('span'); layer.className = 'play-bits'; layer.setAttribute('aria-hidden', 'true');
    const rect = this.target.getBoundingClientRect();
    for (let i = 0; i < (reaction?.surprise ? 13 : 7); i++) {
      const bit = document.createElement('i'); bit.textContent = symbols[i % symbols.length];
      const x = Number.isFinite(event?.clientX) && event.clientX > 0 ? event.clientX - rect.left : rect.width / 2;
      const y = Number.isFinite(event?.clientY) && event.clientY > 0 ? event.clientY - rect.top : rect.height / 2;
      bit.style.setProperty('--aim-x', `${x}px`); bit.style.setProperty('--aim-y', `${y}px`);
      bit.style.setProperty('--i', i); bit.style.setProperty('--x', `${18 + (i * 29 % 70)}%`); layer.append(bit);
    }
    const lines = treasure.effects.interactionLines || [], line = reaction?.line || lines[(this.count - 1) % Math.max(1, lines.length)] || `${treasure.name}和你一起玩！`;
    const caption = document.createElement('span'); caption.className = 'play-caption'; caption.textContent = line; caption.setAttribute('aria-hidden', 'true');
    this.target.append(layer, caption);
    this.callbacks.feedback(treasure, kind, this.count, event, line, reaction);
    this.timer = setTimeout(() => this.clearEffect(), 2400);
  }
}
