(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const machine = $('machine'), drawButton = $('draw'), dialog = $('collection-dialog');
  const STORE_KEY = '75-magic-machine:v1';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let treasures = [], history = [], muted = false, gentle = reducedMotion.matches;
  let phase = 'idle', currentTreasure = null, spaceHeld = false, storageAvailable = true;
  // 每次打开页面都默认关闭，作弊开关不写入持久化设置。
  let cheatMode = false;
  const rawGameRules = JSON.parse($('game-config').textContent);
  const gameRules = { ...normalizeGameConfig(rawGameRules), world: normalizeWorldRules(rawGameRules.world) };
  let savedEnergy = null, rechargeStation = null, savedWorld = null, world = null;
  let chamber = null;
  let noticeTimer;
  function notice(message) {
    $('notice').textContent = message; $('notice').hidden = false;
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 6500);
  }
  try {
    treasures = normalizeConfig(JSON.parse($('treasure-config').textContent));
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved?.version === 1) {
      history = validHistory(saved.history);
      savedEnergy = saved.energy; savedWorld = saved.world;
      muted = typeof saved.muted === 'boolean' ? saved.muted : false;
      gentle = reducedMotion.matches || saved.gentle === true;
    }
  } catch (error) {
    if (!treasures.length) {
      drawButton.disabled = true; $('button-text').textContent = '魔法准备中';
      notice('宝物配置无法读取，请检查 treasures.json 后重新构建。');
    } else {
      storageAvailable = false;
      notice('本地收藏暂时无法读取。这次仍可以玩，刷新后可能无法保留能量和收藏。');
    }
  }
  const pool = treasures.filter(t => t.enabled && t.weight > 0);
  if (!pool.length) { drawButton.disabled = true; $('draw-hint').textContent = '请先在配置中启用一个宝物'; }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, history, muted, gentle, energy: rechargeStation?.snapshot() ?? normalizeEnergyState(savedEnergy, gameRules), world: world?.snapshot() ?? normalizeWorldState(savedWorld, history, gameRules.world) }));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
      notice('能量和宝藏留在了这次游戏里，但浏览器未能保存。刷新后可能丢失。');
    }
  }
  function setPhase(value, winner) { phase = value; machine.dataset.state = value; chamber?.setPhase(value, winner); }
  function syncPreferences() {
    document.body.classList.toggle('gentle', gentle);
    $('sound').setAttribute('aria-pressed', String(!muted));
    $('sound').setAttribute('aria-label', muted ? '打开音效' : '关闭音效');
    $('sound').title = muted ? '打开音效' : '关闭音效';
    $('sound').querySelector('.mute-slash').hidden = !muted;
    $('motion').setAttribute('aria-pressed', String(gentle));
    $('motion').setAttribute('aria-label', gentle ? '关闭柔和动画' : '开启柔和动画');
    $('motion').title = gentle ? '关闭柔和动画' : '开启柔和动画';
  }
  syncPreferences();
  const sound = new MagicAudio(() => muted);
  function syncDrawAction() {
    if (!['idle', 'result'].includes(phase) || !pool.length) return;
    const empty = rechargeStation.balance < gameRules.energy.drawCost;
    energy(rechargeStation.balance / gameRules.energy.max);
    $('button-text').textContent = empty ? '补充魔法' : phase === 'result' ? '再来一次' : '开启魔法';
    $('draw-hint').textContent = empty ? '答一道题，点亮一格能量' : phase === 'result' ? (currentTreasure?.effects.interaction ? '点点宝物，和它玩一玩' : '') : '按空格键，或点一下按钮';
  }
  rechargeStation = new RechargeStation(gameRules, savedEnergy, {
    canOpen: () => ['idle', 'result'].includes(phase) && !dialog.open && !world?.busy && !drawButton.disabled,
    onChange: () => { save(); syncDrawAction(); },
    onReward: full => { sound.unlock().then(() => sound.answerCorrect(full)); },
    onFailure: () => { sound.unlock().then(() => sound.answerWrong()); }
  });
  syncDrawAction();
  addEventListener('pointerdown', () => sound.unlock(), { once: true, capture: true });
  rechargeStation.dialog.addEventListener('close', () => { particles.warningClock = 3.2; });
  // 跑马灯沿机舱一圈排布，各灯珠保留独立颜色与错开的追逐节奏。
  const lampColors = ['#ff9add', '#b89aff', '#84c9ff', '#80ffe0', '#ffe29a'];
  for (let i = 0; i < 40; i++) {
    const lamp = document.createElement('span'); lamp.className = 'lamp';
    const edge = Math.floor(i / 10), t = (i % 10) / 9;
    const points = [[12 + t * 76, 0], [100, 9 + t * 82], [88 - t * 76, 100], [0, 91 - t * 82]];
    const [x, y] = points[edge]; lamp.style.left = `${x}%`; lamp.style.top = `${y}%`;
    lamp.style.setProperty('--lamp-color', lampColors[i % lampColors.length]);
    lamp.style.setProperty('--lamp-delay', `${-i * .055}s`); $('marquee').append(lamp);
  }
  new ResizeObserver(() => {
    $('marquee').style.top = `${$('window').offsetTop - 9}px`;
    $('marquee').style.height = `${$('window').offsetHeight + 18}px`;
    $('marquee').style.bottom = 'auto';
  }).observe($('window'));
  function spellPop(text) {
    const pop = $('spell-pop'); pop.textContent = text;
    pop.classList.remove('pop'); void pop.offsetWidth; pop.classList.add('pop');
  }
  function energy(amount) { machine.style.setProperty('--energy', String(amount)); }
  // 页面切到后台时暂停流程，不积累声音和突然跨过开奖阶段。
  function wait(ms) {
    return new Promise(resolve => {
      let elapsed = 0, previous = performance.now();
      function frame(now) {
        if (!document.hidden) elapsed += Math.min(50, now - previous);
        previous = now;
        if (elapsed >= ms) resolve(); else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }
  function makeArt(treasure, target) {
    target.replaceChildren();
    const fallback = document.createElement('span');
    fallback.className = 'fallback-art'; fallback.textContent = treasure.appearance.icon;
    fallback.setAttribute('aria-hidden', 'true');
    if (treasure.appearance.image) {
      const img = document.createElement('img'); img.src = treasure.appearance.image;
      img.alt = treasure.name; img.draggable = false;
      img.addEventListener('error', () => img.replaceWith(fallback), { once: true });
      target.append(img);
    } else target.append(fallback);
  }
  function showTreasure(treasure, final = false) {
    $('treasure-art').hidden = false;
    makeArt(treasure, $('treasure-art'));
    machine.style.setProperty('--primary', treasure.appearance.primaryColor);
    machine.style.setProperty('--accent', treasure.appearance.accentColor);
    if (final) {
      treasurePlay.set(treasure);
      $('rarity').textContent = `✦ ${RARITIES[treasure.rarity].label} ✦`;
      $('prize-name').textContent = treasure.name;
      $('prize-description').textContent = treasure.description;
    }
  }
  const particles = {
    canvas: $('particles'), ctx: $('particles').getContext('2d'), items: [], waves: [], width: 0, height: 0, last: 0, ambientClock: 0, warningClock: 3.2,
    resize() {
      this.width = innerWidth; this.height = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
      if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    center() { const box = $('window').getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height * .38 }; },
    emit(treasure, ambient = false) {
      if (!this.ctx || document.hidden) return;
      const center = this.center(), kind = treasure.effects.ambient;
      const amount = ambient ? 2 : (gentle ? 12 : Math.min(200, Math.round(treasure.effects.params.particleCount * 1.5)));
      const colors = kind === 'rainbow-trail' ? ['#ffb4da', '#ffe5a0', '#83eadc', '#adbcff', '#ba9cff'] : [treasure.appearance.primaryColor, treasure.appearance.accentColor, '#fff1cf'];
      for (let i = 0; i < amount && this.items.length < 280; i++) {
        const angle = Math.random() * Math.PI * 2, speed = ambient || gentle ? 20 + Math.random() * 25 : 150 + Math.random() * 340;
        const rain = kind === 'golden-rain';
        this.items.push({ x: center.x + (rain ? (Math.random() - .5) * 580 : 0), y: rain ? center.y - 190 : center.y, vx: rain ? (Math.random() - .5) * 70 : Math.cos(angle) * speed, vy: rain ? 60 + Math.random() * 140 : Math.sin(angle) * speed - 70, life: 0, max: ambient ? 1.6 : 2.1 + Math.random() * 1.2, size: ambient ? 2 : 4 + Math.random() * 6, angle, color: colors[i % colors.length], gravity: rain ? 25 : 90, star: kind !== 'rainbow-trail' || i % 3 === 0 });
      }
    },
    sparkAt(x, y, colors = lampColors, amount = 12) {
      if (!this.ctx || document.hidden) return;
      for (let i = 0; i < (gentle ? 3 : amount) && this.items.length < 220; i++) {
        const angle = Math.random() * Math.PI * 2, speed = gentle ? 25 : 50 + Math.random() * 110;
        this.items.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0, max: .5 + Math.random() * .4, size: 2 + Math.random() * 3, angle, color: colors[i % colors.length], gravity: 25, star: true });
      }
    },
    shockwave(color) {
      if (gentle) return;
      this.waves.push({ ...this.center(), color, life: 0 });
    },
    frame(now) {
      const dt = Math.min(.04, (now - (this.last || now)) / 1000); this.last = now;
      const warningActive = rechargeStation.balance <= gameRules.energy.warningThreshold && ['idle', 'result'].includes(phase) && !dialog.open && !rechargeStation.dialog.open && !world?.busy && !document.hidden && !muted;
      if (warningActive) {
        this.warningClock += dt;
        const interval = rechargeStation.balance <= 1 ? 2.4 : 3.2;
        if (this.warningClock >= interval && sound.warning(rechargeStation.balance)) this.warningClock = 0;
      } else { this.warningClock = 3.2; sound.stopWarning(); }
      if (this.ctx && !document.hidden) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.waves = this.waves.filter(wave => wave.life < 1);
        for (const wave of this.waves) {
          wave.life += dt;
          const radius = 35 + 360 * (1 - (1 - Math.min(1, wave.life)) ** 3);
          this.ctx.save(); this.ctx.globalAlpha = Math.max(0, .7 * (1 - wave.life));
          this.ctx.strokeStyle = wave.color; this.ctx.lineWidth = 8 * (1 - wave.life) + 1;
          this.ctx.beginPath(); this.ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2); this.ctx.stroke(); this.ctx.restore();
        }
        if (phase === 'result' && currentTreasure && !gentle && !dialog.open && !rechargeStation.dialog.open && !world?.busy) {
          this.ambientClock += dt;
          if (this.ambientClock > .8) { this.emit(currentTreasure, true); this.ambientClock = 0; }
        }
        this.items = this.items.filter(p => p.life < p.max);
        for (const p of this.items) {
          p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt;
          const ctx = this.ctx; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle + p.life * .7);
          ctx.globalAlpha = Math.min(1, (p.max - p.life) * 1.7); ctx.fillStyle = p.color;
          if (p.star) {
            ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? p.size * .3 : p.size; if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
          } else ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
          ctx.restore();
        }
      }
      requestAnimationFrame(time => this.frame(time));
    }
  };
  particles.resize(); requestAnimationFrame(time => particles.frame(time));
  addEventListener('resize', () => particles.resize());
  chamber = new GachaChamber($('magic-balls'), pool, makeArt, () => gentle, (treasure, x, y) => {
    if (dialog.open || rechargeStation.dialog.open || !['mixing', 'slowing'].includes(phase)) return;
    sound.bounce(pool.indexOf(treasure));
    const bounds = $('magic-balls').getBoundingClientRect();
    particles.sparkAt(bounds.left + x, bounds.top + y, [treasure.appearance.primaryColor, '#fff0b7'], 5);
  });
  function updateCount() { $('collection-count').textContent = history.length; }
  updateCount();
  function treasureRecord(treasure, source = 'draw', eventId = null) {
    return { drawId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, prizeId: treasure.id, name: treasure.name, icon: treasure.appearance.icon, description: treasure.description, rarity: treasure.rarity, timestamp: Date.now(), source, eventId };
  }
  world = new MagicWorld(gameRules.world, savedWorld, history, {
    energy: () => rechargeStation.balance, warningThreshold: gameRules.energy.warningThreshold,
    pickGift: () => drawTreasure(treasures, Math.random, { equalProbability: cheatMode }),
    wait, save, art: makeArt, sound: kind => { sound.stopWarning(); sound.encounter(kind); },
    apply: (event, giftId) => {
      if (event.id === 'ghost' && rechargeStation.balance <= gameRules.energy.warningThreshold) return { description: '小幽灵打了个饱嗝！', detail: '它没有拿走你的能量。' };
      if (event.id === 'courier' || (event.id === 'fairy' && rechargeStation.full)) {
        const gift = pool.find(treasure => treasure.id === giftId) || drawTreasure(treasures, Math.random, { equalProbability: cheatMode });
        history.push(treasureRecord(gift, 'event', event.id)); history = history.slice(-1000); updateCount();
        return { gift, description: `额外礼物：${gift.name}`, detail: '已经放进你的宝藏里！' };
      }
      const before = rechargeStation.balance; rechargeStation.change(event.energyDelta, false);
      const delta = rechargeStation.balance - before;
      return { description: event.id === 'fairy' ? '爱心魔法补充啦！' : '噗！小幽灵吸走一颗爱心', detail: `魔法能量 ${delta > 0 ? '+' : ''}${delta} · ${rechargeStation.balance}/${gameRules.energy.max}` };
    }
  });
  async function resumeWorld() {
    drawButton.disabled = true; $('collection').disabled = true; $('cheat').disabled = true; rechargeStation.setLocked(true);
    try { await world.playPending(); }
    catch { notice('魔法伙伴歇了一会儿，刷新后会继续拜访。'); }
    finally { drawButton.disabled = false; $('collection').disabled = false; $('cheat').disabled = false; rechargeStation.setLocked(false); syncDrawAction(); }
  }
  if (world.state.pending.length && pool.length) resumeWorld();
  const treasurePlay = new TreasurePlay($('treasure-art'), {
    canPlay: () => phase === 'result' && !drawButton.disabled && !world.busy && !dialog.open && !rechargeStation.dialog.open && !document.hidden,
    feedback: (treasure, kind, count) => {
      sound.unlock().then(() => { if (phase === 'result' && currentTreasure === treasure && !world.busy && !document.hidden) sound.treasureSound(kind, count); });
      particles.emit(treasure); particles.shockwave(treasure.appearance.primaryColor);
      $('announcement').textContent = kind === 'flower-bloom' ? '星星种子开出魔法花啦！' : `${treasure.name}和你一起玩！`;
    }
  });
  // 抽中结果先选定；小球翻腾与开壳只负责演出，不改变权重或二次抽取。
  async function draw() {
    if (!['idle', 'result'].includes(phase) || dialog.open || rechargeStation.dialog.open || world?.busy || world?.state.pending.length || !pool.length) return;
    if (rechargeStation.balance < gameRules.energy.drawCost) { rechargeStation.open(); return; }
    const winner = drawTreasure(treasures, Math.random, { equalProbability: cheatMode });
    treasurePlay.reset();
    rechargeStation.consume(); rechargeStation.setLocked(true);
    let awarded = false;
    drawButton.disabled = true; drawButton.classList.add('pressed');
    $('collection').disabled = true; $('cheat').disabled = true;
    particles.items = []; particles.waves = []; currentTreasure = null;
    $('treasure-art').hidden = true; $('jackpot').classList.remove('show');
    machine.style.setProperty('--primary', '#ba9cff'); machine.style.setProperty('--accent', '#ffe1f5');
    setPhase('charging', winner); energy(.05); spellPop('魔法启动！');
    $('button-text').textContent = '注入魔法！';
    $('draw-hint').textContent = '能量正在冲进魔法舱';
    $('rarity').textContent = ''; $('prize-name').textContent = '小球，醒来啦！'; $('prize-description').textContent = '一道魔法，点亮整个机器。';
    try {
      await sound.unlock(); sound.stop(); sound.start(machineLevel(world.state.completedDraws, gameRules.world).id);
      const buttonBounds = drawButton.getBoundingClientRect();
      particles.sparkAt(buttonBounds.left + buttonBounds.width / 2, buttonBounds.top, lampColors, 22);
      energy(.25); await wait(260); drawButton.classList.remove('pressed'); energy(.5); await wait(300);
      setPhase('mixing'); $('button-text').textContent = '魔法球跳舞中';
      $('prize-name').textContent = '转呀转，跳呀跳！'; $('prize-description').textContent = '哪一颗会蹦出来呢？';
      $('draw-hint').textContent = '听！小球在唱魔法歌';
      for (let i = 0; i < 6; i++) {
        sound.mixing(i); energy(.5 + (i + 1) * .065);
        if (i === 1) spellPop('转呀转！');
        if (i === 4) spellPop('✦ MAGIC! ✦');
        await wait(220);
      }
      setPhase('slowing'); $('prize-name').textContent = '有一颗被选中啦！';
      $('draw-hint').textContent = '看，它正在寻找出口'; sound.mixing(6); energy(1); await wait(350);
      machine.style.setProperty('--primary', winner.appearance.primaryColor);
      machine.style.setProperty('--accent', winner.appearance.accentColor);
      setPhase('selecting', winner); $('button-text').textContent = '宝物正在到来';
      $('rarity').textContent = '✦ 一颗属于你的魔法球 ✦'; await wait(650);
      setPhase('landing');
      $('prize-name').textContent = '接住你的魔法球！'; $('prize-description').textContent = '里面的小宝物，想出来啦。';
      await wait(350); sound.land(); spellPop('咚！');
      const center = particles.center(); particles.sparkAt(center.x, center.y + 65, [winner.appearance.primaryColor, '#fff2c8'], 18);
      await wait(200); $('spell-pop').classList.remove('pop');
      setPhase('cracking'); $('button-text').textContent = '就要打开啦';
      $('draw-hint').textContent = '摇一摇，魔法就要出来了';
      for (let i = 0; i < 3; i++) { sound.knock(i); await wait(310); }
      setPhase('anticipation'); $('rarity').textContent = '✦ 惊喜就要出现 ✦'; await wait(220);
      if (winner.rarity === 'super') {
        setPhase('overload'); energy(1); sound.charge();
        $('jackpot').classList.add('show'); $('button-text').textContent = '超级幸运！';
        $('prize-name').textContent = '哇！满满的超级魔法！'; await wait(950); $('jackpot').classList.remove('show');
      }
      currentTreasure = winner; machine.dataset.reveal = winner.effects.reveal;
      showTreasure(winner, true); setPhase('celebrating');
      $('button-text').textContent = '找到宝物啦！'; $('draw-hint').textContent = '这份魔法，属于你！';
      history.push(treasureRecord(winner)); awarded = true; history = history.slice(-1000); world.completedDraw(); save(); updateCount();
      $('announcement').textContent = `恭喜 75，获得${RARITIES[winner.rarity].label}：${winner.name}。${winner.description}`;
      sound.celebrate(winner.effects.sound); particles.shockwave(winner.appearance.primaryColor); particles.emit(winner);
      spellPop(winner.rarity === 'super' ? '超级宝物！' : winner.rarity === 'rare' ? '彩虹魔法！' : '找到宝物啦！');
      await wait(420); $('spell-pop').classList.remove('pop');
      particles.emit(winner);
      await wait(winner.effects.params.durationMs - 420);
      setPhase('result'); $('button-text').textContent = '再来一次';
      $('draw-hint').textContent = winner.effects.interaction ? '点点宝物，和它玩一玩' : '';
      await world.playPending();
    } catch {
      if (!awarded) rechargeStation.change(gameRules.energy.drawCost);
      setPhase('idle'); energy(0); $('treasure-art').hidden = true; $('button-text').textContent = '开启魔法';
      notice('机器歇了一小会儿，再按一下试试。');
    } finally {
      rechargeStation.setLocked(false); syncDrawAction();
      drawButton.disabled = false; drawButton.classList.remove('pressed'); $('collection').disabled = false; $('cheat').disabled = false; $('jackpot').classList.remove('show'); $('spell-pop').classList.remove('pop');
    }
  }
  drawButton.addEventListener('click', draw);
  addEventListener('keydown', event => {
    if (event.code !== 'Space') return;
    // 空格是游戏专用键；先拦截浏览器默认按键激活，焦点位置不改变用途。
    event.preventDefault();
    event.stopPropagation();
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.repeat || spaceHeld) return;
    spaceHeld = true; draw();
  }, { capture: true });
  addEventListener('keyup', event => {
    if (event.code !== 'Space') return;
    // 按钮的原生点击通常在松键时发生，因此 keyup 也必须拦截。
    event.preventDefault(); event.stopPropagation(); spaceHeld = false;
  }, { capture: true });
  addEventListener('blur', () => { spaceHeld = false; });
  $('cheat').addEventListener('click', () => {
    if (!['idle', 'result'].includes(phase) || world?.busy || drawButton.disabled) return;
    cheatMode = !cheatMode;
    $('cheat').setAttribute('aria-pressed', String(cheatMode));
    $('cheat').setAttribute('aria-label', cheatMode ? '关闭作弊模式' : '开启作弊模式');
    $('cheat').title = cheatMode ? '关闭作弊模式，恢复原有权重' : '开启作弊模式，宝物等概率';
    $('cheat-state').textContent = cheatMode ? '开' : '关';
    notice(cheatMode ? '作弊模式已开启' : '作弊模式已关闭');
  });
  $('sound').addEventListener('click', () => {
    muted = !muted;
    if (muted) { sound.stop(); sound.context?.suspend().catch(() => {}); } else { sound.unlock().then(() => sound.tone(660, .18)); }
    syncPreferences(); save();
  });
  $('motion').addEventListener('click', () => {
    if (reducedMotion.matches && gentle) { notice('正在遵循设备的减少动态效果设置。'); return; }
    gentle = !gentle; particles.items = []; particles.waves = []; syncPreferences(); save();
    notice(gentle ? '柔和动画已开启' : '完整动画已开启');
  });
  reducedMotion.addEventListener('change', event => { if (event.matches) { gentle = true; particles.items = []; particles.waves = []; syncPreferences(); } });
  document.addEventListener('visibilitychange', () => {
    spaceHeld = false;
    document.body.classList.toggle('background-paused', document.hidden);
    if (document.hidden) sound.context?.suspend().catch(() => {});
    else if (!muted && sound.context) sound.context.resume().catch(() => {});
  });
  $('fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { notice('当前窗口暂不支持全屏，可以最大化浏览器来玩。'); }
  });
  document.addEventListener('fullscreenchange', () => {
    $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '进入全屏');
    $('fullscreen').title = document.fullscreenElement ? '退出全屏' : '进入全屏';
  });
  function textElement(tag, value, className) { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; }
  function renderCollection() {
    const collected = new Set(history.map(r => r.prizeId));
    $('collection-summary').textContent = history.length ? `已经发现 ${collected.size} 种宝物，收获 ${history.length} 次惊喜。` : '宝藏还在星空里等你，去开启第一次魔法吧。';
    $('collection-grid').replaceChildren();
    const archived = [...collected].filter(id => !treasures.some(t => t.id === id)).map(id => {
      const last = history.filter(r => r.prizeId === id).at(-1);
      return { id, name: last.name, description: last.description || '一份过去发现的魔法。', rarity: last.rarity, appearance: { icon: last.icon || '✨', image: '' } };
    });
    for (const treasure of [...treasures, ...archived]) {
      const records = history.filter(r => r.prizeId === treasure.id), latest = records.at(-1);
      const card = document.createElement('article'); card.className = `treasure-card${latest ? '' : ' uncollected'}`;
      const art = document.createElement('div'); makeArt(treasure, art);
      // 收藏插画直接放入网格，保留图片失败时的图标降级。
      card.append(...art.childNodes);
      card.append(textElement('span', RARITIES[treasure.rarity].label, 'rarity'), textElement('h3', treasure.name), textElement('p', latest ? treasure.description : '还没发现，下一次也许就是它。', 'card-description'), textElement('span', latest ? `已获得 × ${records.length}` : '等待发现', 'card-count'));
      if (latest) card.append(textElement('time', `最近发现 · ${new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(latest.timestamp)}`, 'last-date'));
      $('collection-grid').append(card);
    }
    $('collection-summary').textContent += storageAvailable ? '' : ' 本次收藏暂未保存到浏览器。';
  }
  $('collection').addEventListener('click', () => { renderCollection(); dialog.showModal(); });
  $('close-collection').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => $('collection').focus());
})();
