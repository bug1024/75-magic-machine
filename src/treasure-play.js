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
  clearEffect() { clearTimeout(this.timer); this.target.removeAttribute('data-play'); this.target.querySelectorAll('.play-bits, .play-caption').forEach(el => el.remove()); }
  destroy() { this.reset(); document.removeEventListener('visibilitychange', this.onVisibility); }
  reset() {
    this.clearEffect(); this.treasure = null; this.count = 0;
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
    this.target.dataset.play = kind;
    if (kind === 'flower-bloom' && treasure.appearance.interactionImage) {
      const img = this.target.querySelector('img'); if (img) img.src = treasure.appearance.interactionImage;
    }
    const patterns = { 'burp-bubbles': ['🫧'], 'candy-rain': ['🍬'], 'jelly-hop': ['✦'], 'rainbow-flight': ['🌈'], 'mushroom-notes': ['♪'], 'flower-bloom': ['✿'], 'space-trip': ['⭐'], 'sock-giggle': ['♫'] };
    const symbols = treasure.effects.interactionSymbols?.length ? treasure.effects.interactionSymbols : patterns[kind] || ['✦'];
    const layer = document.createElement('span'); layer.className = 'play-bits'; layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 7; i++) {
      const bit = document.createElement('i'); bit.textContent = symbols[i % symbols.length];
      bit.style.setProperty('--i', i); bit.style.setProperty('--x', `${18 + (i * 29 % 70)}%`); layer.append(bit);
    }
    const lines = treasure.effects.interactionLines || [], line = lines[this.count % Math.max(1, lines.length)] || `${treasure.name}和你一起玩！`;
    const caption = document.createElement('span'); caption.className = 'play-caption'; caption.textContent = line; caption.setAttribute('aria-hidden', 'true');
    this.target.append(layer, caption);
    this.count++; this.callbacks.feedback(treasure, kind, this.count, event, line);
    this.timer = setTimeout(() => this.clearEffect(), 2400);
  }
}
