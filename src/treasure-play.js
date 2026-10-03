// 宝物效果由配置选择；点击不会扣能量、改变概率或重复发奖。
class TreasurePlay {
  constructor(target, callbacks) {
    this.target = target; this.callbacks = callbacks; this.treasure = null; this.timer = null; this.count = 0;
    target.addEventListener('click', event => this.play(event));
    target.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); if (!event.repeat) this.play(event); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clearEffect(); });
  }
  clearEffect() { clearTimeout(this.timer); this.target.removeAttribute('data-play'); this.target.querySelectorAll('.play-bits').forEach(el => el.remove()); }
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
  async play(event) {
    const treasure = this.treasure, kind = treasure?.effects.interaction;
    if (!kind || !this.callbacks.canPlay() || this.target.dataset.play) return;
    this.target.dataset.play = kind;
    if (kind === 'flower-bloom' && treasure.appearance.interactionImage) {
      const img = this.target.querySelector('img'); if (img) img.src = treasure.appearance.interactionImage;
    }
    const patterns = { 'burp-bubbles': '🫧', 'candy-rain': '🍬', 'jelly-hop': '✦', 'rainbow-flight': '🌈', 'mushroom-notes': '♪', 'flower-bloom': '✿', 'space-trip': '⭐', 'sock-giggle': '♫' };
    const layer = document.createElement('span'); layer.className = 'play-bits'; layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 7; i++) {
      const bit = document.createElement('i'); bit.textContent = patterns[kind];
      bit.style.setProperty('--i', i); bit.style.setProperty('--x', `${22 + (i * 29 % 67)}%`); layer.append(bit);
    }
    this.target.append(layer);
    this.count++; this.callbacks.feedback(treasure, kind, this.count, event);
    // 固定短时反馈，不累积重复点击的定时器或音频。
    this.timer = setTimeout(() => this.clearEffect(), 2100);
  }
}
