// 魔法舱：有限数量的小球做碰撞与涡流运动，选中的球真实移动到中央出口。
class GachaChamber {
  constructor(container, treasures, makeArt, isGentle, onCollision) {
    this.container = container; this.isGentle = isGentle; this.onCollision = onCollision;
    this.treasures = treasures; this.makeArt = makeArt; this.displayOffset = 0;
    this.phase = 'idle'; this.balls = []; this.elapsed = 0; this.last = 0; this.hitCooldown = 0;
    this.width = container.clientWidth; this.height = container.clientHeight;
    const count = treasures.length ? Math.min(8, Math.max(6, treasures.length)) : 0;
    for (let i = 0; i < count; i++) {
      const treasure = treasures[i % treasures.length], node = document.createElement('div');
      node.className = 'magic-ball'; node.style.setProperty('--ball-color', treasure.appearance.primaryColor);
      node.dataset.prizeId = treasure.id; makeArt(treasure, node);
      container.append(node);
      this.balls.push({ node, treasure, x: 0, y: 0, vx: 0, vy: 0, angle: i * 18, radius: 32, seed: i });
    }
    this.reset();
    new ResizeObserver(() => this.resize()).observe(container);
    requestAnimationFrame(now => this.frame(now));
  }
  resize() {
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    for (const ball of this.balls) { ball.x *= width / (this.width || width); ball.y *= height / (this.height || height); }
    this.width = width; this.height = height;
    this.radius = Math.max(24, Math.min(35, width * .103));
    this.container.style.setProperty('--ball-size', `${this.radius * 2}px`);
    for (const ball of this.balls) ball.radius = this.radius;
  }
  reset(winner) {
    this.resize(); this.selected = null; this.elapsed = 0;
    // 舱内只展示少量球，轮换形象；真正中奖的宝物始终有对应的球。
    if (winner && this.treasures.length) {
      const displayed = this.balls.map((_, i) => this.treasures[(this.displayOffset + i) % this.treasures.length]);
      if (!displayed.some(treasure => treasure.id === winner.id)) displayed[displayed.length - 1] = winner;
      this.balls.forEach((ball, i) => {
        ball.treasure = displayed[i]; ball.node.dataset.prizeId = displayed[i].id;
        ball.node.style.setProperty('--ball-color', displayed[i].appearance.primaryColor);
        this.makeArt(displayed[i], ball.node);
      });
      this.displayOffset = (this.displayOffset + 3) % this.treasures.length;
    }
    const columns = this.balls.length > 6 ? 4 : 3;
    for (const ball of this.balls) {
      const col = ball.seed % columns, row = Math.floor(ball.seed / columns);
      ball.x = this.width * ((col + .5) / columns); ball.y = this.height * (.33 + row * .37);
      ball.vx = (ball.seed % 2 ? 1 : -1) * (190 + ball.seed * 23); ball.vy = -170 - ball.seed * 25;
      ball.squash = 0;
      ball.node.classList.remove('chosen', 'bump'); ball.node.style.opacity = '1';
    }
  }
  setPhase(phase, winner) {
    this.phase = phase; this.elapsed = 0;
    if (phase === 'charging') this.reset(winner);
    if (phase === 'selecting') {
      this.selected = this.balls.find(ball => ball.treasure.id === winner.id);
      if (!this.selected) throw new Error('中奖宝物没有对应的魔法球');
      if (this.selected) {
        this.selected.node.classList.add('chosen');
        this.origin = { x: this.selected.x, y: this.selected.y };
      }
    }
  }
  hit(ball) {
    ball.squash = .25;
    if (this.hitCooldown > 0) return;
    this.hitCooldown = .16;
    ball.node.classList.remove('bump');
    void ball.node.offsetWidth;
    ball.node.classList.add('bump');
    this.onCollision(ball.treasure, ball.x, ball.y);
  }
  frame(now) {
    const dt = Math.min(.032, (now - (this.last || now)) / 1000); this.last = now;
    if (!document.hidden) {
      this.elapsed += dt; this.hitCooldown -= dt;
      const mixing = this.phase === 'mixing' || this.phase === 'slowing';
      for (const ball of this.balls) {
        if (this.phase === 'selecting' && ball === this.selected) {
          const t = this.isGentle() ? 1 : Math.min(1, this.elapsed / .65), ease = 1 - (1 - t) ** 3;
          ball.x = this.origin.x + (this.width / 2 - this.origin.x) * ease;
          ball.y = this.origin.y + (this.height * .30 - this.origin.y) * ease;
          ball.angle *= .9;
        } else if (mixing && !this.isGentle()) {
          const power = this.phase === 'slowing' ? .45 : 1;
          const dx = ball.x - this.width / 2, dy = ball.y - this.height / 2;
          ball.vx += (-dy * 6 * power - dx * .8) * dt;
          ball.vy += (dx * 6 * power + 420 - dy * .9) * dt;
          ball.x += ball.vx * dt; ball.y += ball.vy * dt;
          ball.angle += ball.vx * dt * .7;
          const r = ball.radius, maxX = this.width - r - 4, maxY = this.height - r - 4;
          if (ball.x < r || ball.x > maxX) { ball.x = Math.min(maxX, Math.max(r, ball.x)); ball.vx *= -.92; this.hit(ball); }
          if (ball.y < r || ball.y > maxY) { ball.y = Math.min(maxY, Math.max(r, ball.y)); ball.vy *= -.94; if (Math.abs(ball.vy) < 80) ball.vy = -160; this.hit(ball); }
          const speed = Math.hypot(ball.vx, ball.vy); if (speed > 580) { ball.vx *= 580 / speed; ball.vy *= 580 / speed; }
        }
      }
      if (mixing && !this.isGentle()) {
        for (let i = 0; i < this.balls.length; i++) for (let j = i + 1; j < this.balls.length; j++) {
          const a = this.balls[i], b = this.balls[j], dx = b.x - a.x, dy = b.y - a.y;
          const distance = Math.hypot(dx, dy), minimum = a.radius + b.radius;
          if (distance > 0 && distance < minimum) {
            const nx = dx / distance, ny = dy / distance, overlap = (minimum - distance) / 2;
            a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
            const velocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (velocity < 0) { a.vx += velocity * nx; a.vy += velocity * ny; b.vx -= velocity * nx; b.vy -= velocity * ny; this.hit(a); }
          }
        }
      }
      for (const ball of this.balls) {
        const idleFloat = this.phase === 'idle' && !this.isGentle() ? Math.sin(now / 900 + ball.seed) * 5 : 0;
        const r = ball.radius;
        if (mixing) { ball.x = Math.max(r, Math.min(this.width - r, ball.x)); ball.y = Math.max(r, Math.min(this.height - r, ball.y)); }
        ball.squash = Math.max(0, ball.squash - dt * 1.8);
        const squash = this.isGentle() ? 0 : ball.squash;
        ball.node.style.transform = `translate(${ball.x - r}px,${ball.y - r + idleFloat}px) rotate(${ball.angle}deg) scale(${1 + squash},${1 - squash})`;
      }
    }
    requestAnimationFrame(time => this.frame(time));
  }
}
