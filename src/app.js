(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const machine = $('machine'), drawButton = $('draw'), dialog = $('collection-dialog');
  const STORE_KEY = '75-magic-machine:v1';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let treasures = [], history = [], inventory = Object.create(null), muted = false, gentle = reducedMotion.matches;
  let phase = 'idle', currentTreasure = null, spaceHeld = false, storageAvailable = true, storageWritable = true;
  // 每次打开页面都默认关闭，作弊开关不写入持久化设置。
  let cheatMode = false;
  const rawGameRules = JSON.parse($('game-config').textContent);
  const gameRules = { ...normalizeGameConfig(rawGameRules), world: normalizeWorldRules(rawGameRules.world) };
  let savedEnergy = null, rechargeStation = null, savedWorld = null, world = null;
  let chamber = null, garden = null, savedGarden = null, finale = null;
  let noticeTimer;
  let wishCollectionIds = null, wishCollectionLine = null, collectionMode = null, trayIndex = 0;
  let acquiredAt = {}, unread = new Set(), tips = new Set();
  const pacing = new ScenePacing();
  const extraOverlay = () => $('settings-dialog').open || $('environment-dialog').open || !$('garden-story-panel').hidden;
  const quietReady = () => pacing.ready && !extraOverlay();
  function acquired(treasure) { acquiredAt[treasure.id] = Date.now(); if (!inventory[treasure.id]) unread.add(treasure.id); }
  function tip(id, message) { if (tips.has(id)) return; tips.add(id); notice(message); save(); }
  function notice(message) {
    $('notice').textContent = message; $('notice').hidden = false;
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 6500);
  }
  try {
    treasures = normalizeConfig(JSON.parse($('treasure-config').textContent));
    const rawSaved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (rawSaved?.version > 2) storageWritable = false;
    const saved = migrateSave(rawSaved);
    if (saved?.version === 2) {
      acquiredAt = saved.acquiredAt; unread = new Set(saved.unread); tips = new Set(saved.tips);
      history = validHistory(saved.history); inventory = normalizeInventory(saved.inventory, history);
      savedEnergy = saved.energy; savedWorld = saved.world; savedGarden = saved.garden;
      muted = typeof saved.muted === 'boolean' ? saved.muted : false;
      gentle = reducedMotion.matches || saved.gentle === true;
    }
  } catch (error) {
    if (!treasures.length) {
      drawButton.disabled = true; $('button-text').textContent = '魔法准备中';
      notice('宝物配置无法读取，请检查 treasures.json 后重新构建。');
    } else {
      storageAvailable = false;
      notice(storageWritable ? '本地收藏暂时无法读取。这次仍可以玩，刷新后可能无法保留能量和收藏。' : '这是较新版本的存档，本页不会覆盖它。请用对应版本打开。');
    }
  }
  const pool = treasures.filter(t => t.enabled && t.weight > 0);
  if (!pool.length) { drawButton.disabled = true; $('draw-hint').textContent = '请先在配置中启用一个宝物'; }
  function save() {
    garden?.workshop?.sync();
    if (!storageWritable) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ version: 2, acquiredAt, unread: [...unread], tips: [...tips], history, inventory, muted, gentle, energy: rechargeStation?.snapshot() ?? normalizeEnergyState(savedEnergy, gameRules), garden: garden?.snapshot() ?? normalizeGardenState(savedGarden, treasures, history, inventory), world: world?.snapshot() ?? normalizeWorldState(savedWorld, history, gameRules.world) }));
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
  let lastAction = performance.now();
  const wakeScene = () => { lastAction = performance.now(); document.body.classList.remove('scene-resting'); };
  addEventListener('pointerdown', wakeScene, { passive: true }); addEventListener('keydown', wakeScene);
  new ForegroundLoop(now => document.body.classList.toggle('scene-resting', now - lastAction > 8000 && ['idle', 'result'].includes(phase) && ((!world?.busy && !finale?.busy && !garden?.stories?.busy) || (finale?.busy && finale.state.stage === 'crown' && finale.elapsed > 8000))), 1000);
  const sound = new MagicAudio(() => muted);
  function syncDrawAction() {
    if (!['idle', 'result'].includes(phase) || !pool.length) return;
    const pending = world?.state.pending[0];
    const empty = rechargeStation.balance < gameRules.energy.drawCost;
    energy(rechargeStation.balance / gameRules.energy.max);
    $('button-text').textContent = pending ? pending.kind === 'upgrade' ? '看看新魔法' : pending.kind === 'witch' ? '守护花园' : pending.kind === 'finale' ? '开启星光庆典' : '迎接魔法伙伴' : empty ? '补充魔法' : phase === 'result' ? '再来一次' : '开启魔法';
    $('draw-hint').textContent = pending ? '按空格键，或点一下按钮' : empty ? '答一道题，点亮两格能量' : phase === 'result' ? (currentTreasure?.effects.interaction ? '点点宝物，和它玩一玩' : '') : '按空格键，或点一下按钮';
  }
  rechargeStation = new RechargeStation(gameRules, savedEnergy, {
    canOpen: () => ['idle', 'result'].includes(phase) && !extraOverlay() && !dialog.open && !world?.busy && !finale?.busy && !garden?.workshop?.busy && !drawButton.disabled,
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
      let elapsed = 0, previous = performance.now(), timer = null;
      const schedule = () => {
        if (!document.hidden && timer === null) timer = setTimeout(tick, Math.min(50, ms - elapsed));
      };
      const tick = () => {
        timer = null;
        const now = performance.now();
        if (!document.hidden) elapsed += now - previous;
        previous = now;
        if (elapsed >= ms) {
          document.removeEventListener('visibilitychange', visibility);
          resolve();
        } else schedule();
      };
      const visibility = () => {
        clearTimeout(timer); timer = null;
        previous = performance.now();
        schedule();
      };
      document.addEventListener('visibilitychange', visibility);
      schedule();
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
    canvas: $('particles'), ctx: $('particles').getContext('2d'), items: [], waves: [], width: 0, height: 0, last: 0, warningClock: 3.2,
    resize() {
      this.width = innerWidth; this.height = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(3000000 / (this.width * this.height)));
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
      this.wake();
    },
    sparkAt(x, y, colors = lampColors, amount = 12) {
      if (!this.ctx || document.hidden) return;
      for (let i = 0; i < (gentle ? 3 : amount) && this.items.length < 220; i++) {
        const angle = Math.random() * Math.PI * 2, speed = gentle ? 25 : 50 + Math.random() * 110;
        this.items.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0, max: .5 + Math.random() * .4, size: 2 + Math.random() * 3, angle, color: colors[i % colors.length], gravity: 25, star: true });
      }
      this.wake();
    },
    shockwave(color) {
      if (gentle) return;
      this.waves.push({ ...this.center(), color, life: 0 }); this.wake();
    },
    clear() {
      this.items = []; this.waves = []; cancelAnimationFrame(this.frameId); clearTimeout(this.timer); this.frameId = null; this.timer = null;
      if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height);
    },
    wake() {
      if (!this.ctx || document.hidden || this.frameId || (!this.items.length && !this.waves.length)) return;
      clearTimeout(this.timer); this.timer = null; this.frameId = requestAnimationFrame(now => this.frame(now));
    },
    frame(now) {
      this.frameId = null;
      const dt = Math.min(.066, (now - (this.last || now)) / 1000); this.last = now;
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
      if (this.items.length || this.waves.length) this.timer = setTimeout(() => this.wake(), 16);
    }
  };
  particles.resize();
  new ForegroundLoop((now, elapsed) => {
    const warningActive = rechargeStation.balance <= gameRules.energy.warningThreshold && ['idle', 'result'].includes(phase) && !dialog.open && !rechargeStation.dialog.open && !extraOverlay() && !world?.busy && !finale?.busy && !muted;
    if (warningActive) { particles.warningClock += elapsed / 1000; const interval = rechargeStation.balance <= 1 ? 2.4 : 3.2; if (particles.warningClock >= interval && sound.warning(rechargeStation.balance)) particles.warningClock = 0; }
    else { particles.warningClock = 3.2; if (sound.warningVoices.size) sound.stopWarning(); }
  }, 500);
  addEventListener('resize', () => particles.resize());
  chamber = new GachaChamber($('magic-balls'), pool, makeArt, () => gentle, (treasure, x, y) => {
    if (dialog.open || rechargeStation.dialog.open || !['mixing', 'slowing'].includes(phase)) return;
    sound.bounce(pool.indexOf(treasure));
    const bounds = $('magic-balls').getBoundingClientRect();
    particles.sparkAt(bounds.left + x, bounds.top + y, [treasure.appearance.primaryColor, '#fff0b7'], 5);
  });
  function updateCount() { $('collection-count').textContent = Object.values(inventory).reduce((sum, count) => sum + count, 0); }
  updateCount();
  function treasureRecord(treasure, source = 'draw', eventId = null) {
    return { drawId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, prizeId: treasure.id, name: treasure.name, icon: treasure.appearance.icon, description: treasure.description, rarity: treasure.rarity, timestamp: Date.now(), source, eventId };
  }
  let refillTimer;
  function acquirePower(treasure) {
    if (treasure.effects.onAcquire !== 'refill-energy') return;
    rechargeStation.change(gameRules.energy.max, false);
    machine.classList.remove('heart-refill'); void machine.offsetWidth; machine.classList.add('heart-refill');
    clearTimeout(refillTimer); refillTimer = setTimeout(() => machine.classList.remove('heart-refill'), 2600);
  }
  world = new MagicWorld(gameRules.world, savedWorld, history, {
    energy: () => rechargeStation.balance, maxEnergy: gameRules.energy.max, energySound: () => sound.tone(520 + rechargeStation.balance * 65, .18), warningThreshold: gameRules.energy.warningThreshold,
    pickGift: eventId => { const ocean = pool.filter(t => ['water', 'ocean', 'sea', 'bubbles'].some(tag => t.tags.includes(tag)) || ['cloud-dolphin', 'mermaid-outfit', 'whale-cup'].includes(t.id)); return drawTreasure(eventId === 'mermaid' && ocean.length ? ocean : treasures, Math.random, { equalProbability: cheatMode, inventory, preferUnowned: ['courier', 'mermaid'].includes(eventId) }); },
    pickAmmo: () => {
      const collected = pool.filter(treasure => history.some(record => record.prizeId === treasure.id));
      const ammo = collected.length ? collected : pool;
      return ammo[Math.floor(Math.random() * ammo.length)] || pool[0];
    },
    guardianOrigin: id => { const friend = document.querySelector(`[data-friend="${id}"]`); if (friend) return friend.getBoundingClientRect(); const index = garden?.state.slots.indexOf(id); return document.querySelector(`[data-slot="${index}"]`)?.getBoundingClientRect() || $('window').getBoundingClientRect(); },
    guardians: () => [...[...new Set(garden?.state.slots.filter(Boolean) || [])].map(id => treasures.find(t => t.id === id)).filter(t => t?.effects.guardian), ...(finale?.guardianFriends() || [])],
    damageTarget: (item,requested) => {
      const state=garden.state.workshop,facility=[...$('garden-keepsakes').querySelectorAll('[data-memory]')].find(b=>!state.broken.includes(b.dataset.memory));
      const slot=garden.state.slots.findIndex(id=>id&&id!==item.damage?.trapped);
      const kind=requested==='facility'&&!facility||requested==='trap'&&slot<0?'energy':requested;
      const mother=kind==='energy'&&!item.shieldUsed&&world.callbacks.guardians().find(t=>t.effects.guardian==='heart-shield'&&t.id!==item.damage?.trapped);
      if(mother)return world.callbacks.guardianOrigin(mother.id);
      const target=garden.workshop.flagReady()?document.querySelector('[data-memory="wish-little-guardian"]'):kind==='facility'?facility:kind==='trap'?document.querySelector(`[data-slot="${slot}"]`):$('power-cells');
      if(target.dataset.memory)garden.adventures.revealMemory(target.dataset.memory);
      return target.getBoundingClientRect();
    },
    damage: (item, requested) => {
      item.damage ||= normalizeDamage();const damage=item.damage,state=garden.state.workshop;
      const facilities=[...$('garden-keepsakes').querySelectorAll('[data-memory]')].filter(b=>!state.broken.includes(b.dataset.memory));
      const slots=garden.state.slots.filter(id=>id&&id!==damage.trapped);
      const kind=requested==='facility'&&!facilities.length||requested==='trap'&&!slots.length?'energy':requested;
      damage.attacks++;
      const mother=kind==='energy'&&world.callbacks.guardians().find(t=>t.effects.guardian==='heart-shield'&&t.id!==damage.trapped&&!item.shieldUsed);
      if(mother){item.shieldUsed=true;save();return {shield:true,line:`${mother.name}挡住了黑雾！`};}
      if(garden.workshop.flagReady()){state.flagReadyAt=world.state.completedDraws+3;damage.flagUsed=true;save();return {shield:true,line:'守护旗挡住了这次捣蛋！'};}
      if(kind==='trap'){damage.trapped=slots[0];garden.renderDamage();save();return {line:'伙伴被蜘蛛网困住了！打跑反派就能救回来！'};}
      if(kind==='facility'){damage.facility=facilities[0].dataset.memory;state.broken.push(damage.facility);garden.adventures.render();save();return {line:'设施被撞倒了！获胜后点它扶正！'};}
      const taken=Math.min(1,rechargeStation.balance);damage.energyTaken+=taken;rechargeStation.change(-taken,false);save();return {line:taken?'黑雾吸走了一颗爱心！胜利后会回来。':'黑雾扑了个空！零能量也能继续守护。'};
    },
    battleSettled: item => {const taken=item.damage?.energyTaken||0;if(item.damage){item.damage.energyTaken=0;item.damage.trapped=null;}if(item.manual)garden.state.workshop.challengeReadyAt=world.state.completedDraws+3;garden.state.workshop.guardWon=true;garden.renderDamage();if(taken)rechargeStation.change(taken,false);garden.adventures.render();},
    eternal: () => world.state.finale.complete, finale: () => finale.play(),
    voice: text => { if (!globalThis.speechSynthesis) return; speechSynthesis.cancel(); if (!muted && text) { const speech = new SpeechSynthesisUtterance(text); speech.lang = 'zh-CN'; speech.rate = .9; speech.pitch = 1.2; speechSynthesis.speak(speech); } },
    wait, save, art: makeArt, sound: kind => { sound.stopWarning(); sound.encounter(kind); },
    apply: (event, giftId) => {
      if (event.id === 'ghost' && rechargeStation.balance <= gameRules.energy.warningThreshold) return { description: '小幽灵打了个饱嗝！', detail: '它没有拿走你的能量。' };
      if (['witch', 'bat', 'rock', 'dragon', 'courier', 'mermaid'].includes(event.id) || (event.id === 'fairy' && rechargeStation.full && event.energyDelta !== 1)) {
        if (['witch', 'bat', 'rock', 'dragon'].includes(event.id) && garden.state.slots.some(id => treasures.find(t => t.id === id)?.effects.guardian)) garden.state.workshop.guardWon = true;
        const gift = pool.find(treasure => treasure.id === giftId) || drawTreasure(treasures, Math.random, { equalProbability: cheatMode });
        acquired(gift); acquirePower(gift); inventory[gift.id] = (inventory[gift.id] || 0) + 1; history.push(treasureRecord(gift, 'event', event.id)); history = history.slice(-1000); updateCount();
        return { gift, description: `额外礼物：${gift.name}`, detail: gift.effects.onAcquire === 'refill-energy' ? '能量补满十格！爱心已经放进宝藏。' : '已经放进你的宝藏里！' };
      }
      const before = rechargeStation.balance; rechargeStation.change(event.energyDelta, false);
      const delta = rechargeStation.balance - before;
      return { delta, description: event.id === 'fairy' ? '爱心魔法补充啦！' : '噗！小幽灵吸走一颗爱心', detail: `魔法能量 ${delta > 0 ? '+' : ''}${delta} · ${rechargeStation.balance}/${gameRules.energy.max}` };
    }
  });
  async function resumeWorld() {
    drawButton.disabled = true; $('collection').disabled = true; $('cheat').disabled = true; rechargeStation.setLocked(true);
    garden?.workshop?.close();
    try { await world.playPending(); }
    catch { notice('魔法伙伴歇了一会儿，刷新后会继续拜访。'); }
    finally { pacing.quiet(6000); drawButton.disabled = false; $('collection').disabled = false; $('cheat').disabled = false; rechargeStation.setLocked(false); garden.workshop.sync();garden.adventures.render();syncDrawAction(); }
  }
  const treasurePlay = new TreasurePlay($('treasure-art'), {
    canPlay: () => !garden?.stories?.busy && phase === 'result' && !drawButton.disabled && !world.busy && !finale?.busy && !extraOverlay() && !dialog.open && !rechargeStation.dialog.open && !document.hidden,
    feedback: (treasure, kind, count, event, line, reaction) => {
      sound.unlock().then(() => { if (phase === 'result' && currentTreasure === treasure && !world.busy && !finale?.busy && !document.hidden) sound.interact(treasure, count, reaction); });
      particles.emit(treasure, true);
      if (reaction?.surprise) particles.shockwave(treasure.appearance.primaryColor);
      $('announcement').textContent = line;
    }
  });
  garden = new MagicGarden(rawGameRules.weather, savedGarden, treasures, history, {
    inventory: () => inventory, reward: amount => { rechargeStation.change(amount, false); syncDrawAction(); },
    art: makeArt, save, unlock: () => sound.unlock(),
    canPlay: () => !garden?.workshop?.busy && !garden?.stories?.busy && ['idle', 'result'].includes(phase) && !drawButton.disabled && !world.busy && !finale?.busy && !extraOverlay() && !dialog.open && !rechargeStation.dialog.open && !document.hidden,
    canStory: () => ['idle', 'result'].includes(phase) && !drawButton.disabled && !world.busy && !finale?.busy && !$('settings-dialog').open && !$('environment-dialog').open && !dialog.open && !rechargeStation.dialog.open,
    canAutoStory: () => false,
    draws: () => world.state.completedDraws,
    inFinale: () => !!finale?.busy,
    seasonStep: () => seasonStepFor(world.state.completedDraws, MACHINE_LEVELS.findIndex(level => level.id === machine.dataset.level), world.state.finale.complete),
    trapped: () => world.state.pending.find(item => item.kind === 'witch')?.damage?.trapped,
    canEnvironment: () => !world.state.pending.length && garden?.callbacks.canPlay(),
    storyFinished: id => { pacing.quiet(6000); garden.workshop?.sync(); save(); },
    weatherFinished: () => pacing.quiet(4000),
    canWeather: () => !world.state.pending.length && (!!garden?.weather || quietReady()) && ['idle', 'result'].includes(phase) && !drawButton.disabled && !garden?.stories?.busy && !world.busy && !finale?.busy && !extraOverlay() && !dialog.open && !rechargeStation.dialog.open,
    sound: (kind, count = 1, reaction, treasure) => sound.unlock().then(() => { if (!document.hidden && !world.busy && !finale?.busy) treasure ? sound.interact(treasure, count, reaction) : sound.treasureSound(kind, count); }),
    storySound: (kind, time, weather) => sound.story(kind, time, weather),
    weatherSound: kind => sound.weather(kind)
  }, rawGameRules.dayNight, rawGameRules.seasons, rawGameRules.gardenStories);
  garden.adventures = new GardenAdventures(garden, rawGameRules.adventures || []);
  garden.workshop = new MagicWorkshop(garden, rawGameRules.wishes || [], {
    save, wait, craftSound: stage => { if(stage==='gather')sound.story('lunar',garden.state.timeOfDay,null);else if(stage==='fusion')sound.story('sparkle',garden.state.timeOfDay,null);else sound.celebrate('royal-fanfare',false); }, canUse: () => !world.state.pending.length, draws: () => world.state.completedDraws,
    voice: text => world.callbacks.voice(text),
    invite: (ids, line, index) => { collectionMode='craft';trayIndex=index;wishCollectionIds=new Set(ids);wishCollectionLine=line;$('collection-filter').value='owned';renderCollection();dialog.showModal(); },
    focus: () => { collectionMode='focus';$('collection-filter').value='missing';renderCollection();dialog.showModal(); },
    canChallenge: enemy => canChallenge(world.state, gameRules.world, world.state.completedDraws, garden.state.workshop.challengeReadyAt, enemy),
    challenge: enemy => { if(!canChallenge(world.state,gameRules.world,world.state.completedDraws,garden.state.workshop.challengeReadyAt,enemy))return;garden.endWeather();world.state.lastWitchDraw=world.state.completedDraws;world.state.witchWait=0;world.state.seenOpponents=[...new Set([...world.state.seenOpponents,enemy])];world.state.pending.push({kind:'witch',opponent:enemy,manual:true,hits:0,assistHits:0,usedGuardians:[],damage:normalizeDamage(),giftId:world.callbacks.pickGift(enemy).id});save();resumeWorld(); }
  });
  garden.adventures.render();garden.stories.render();
  finale = new MagicFinale(world, garden, treasures, {
    dragonArt: rawGameRules.guardianDragon, inventory: () => inventory, save, art: makeArt, unlock: () => sound.unlock(),
    canPlay: () => garden.callbacks.canPlay(),
    grantCrown: crown => { if (!inventory[crown.id]) { acquired(crown); inventory[crown.id] = 1; history.push(treasureRecord(crown, 'finale')); history = history.slice(-1000); updateCount(); } },
    music: stage => { sound.stop(); sound.stopWarning(); if (stage === 'celebrate' || stage === 'crown') sound.celebrate('royal-fanfare',true); else sound.story(stage === 'love' ? 'hug' : stage === 'seasons' ? 'forest' : 'sparkle','night',null); },
    hit: (stage,count) => { sound.unlock().then(()=>stage === 'love' ? sound.tone(520+count*100,.22) : sound.encounter('witch-hit')); },
    finished: () => { pacing.quiet(6000); syncDrawAction(); },
    replay: async () => { if (!garden.callbacks.canPlay()) return; drawButton.disabled = true; rechargeStation.setLocked(true); try { await finale.play(true); } finally { drawButton.disabled=false; rechargeStation.setLocked(false); syncDrawAction(); } }
  });
  const paceTick = (now, elapsed) => {
    const active = !document.hidden && ['idle', 'result'].includes(phase) && !drawButton.disabled && !world.busy && !finale?.busy && !garden.workshop.busy && !garden.stories.busy && !dialog.open && !rechargeStation.dialog.open && !extraOverlay();
    pacing.advance(elapsed, active);
    if (active && pacing.ready && world.state.pending.length && pool.length) { garden.endWeather(); resumeWorld(); }
    }; new ForegroundLoop(paceTick, () => pacing.remaining || world.state.pending.length ? 100 : 500);
  // 抽中结果先选定；小球翻腾与开壳只负责演出，不改变权重或二次抽取。
  async function draw() {
    if (garden?.workshop?.busy || garden?.stories?.busy || !['idle', 'result'].includes(phase) || dialog.open || rechargeStation.dialog.open || world?.busy || finale?.busy || extraOverlay() || !pool.length) return;
    // 已排队的演出优先于下一抽；孩子主动继续时无需等欣赏倒计时。
    // 必须在能量检查前处理，零能量也能升级、接受仙子补能和守护花园。
    if (world.state.pending.length) { if (garden.weather) garden.endWeather(); await resumeWorld(); return; }
    garden.workshop.close();
    if (rechargeStation.balance < gameRules.energy.drawCost) { rechargeStation.open(); return; }
    if (!world.state.finale.complete && world.state.completedDraws + 1 === FINALE_AT) { await finalDraw(); return; }
    if (garden.weather) garden.endWeather();
    const winner = drawTreasure(treasures, Math.random, { equalProbability: cheatMode, inventory, focusId: garden.workshop.focus(), recentIds: history.filter(r => r.source !== 'event' && r.source !== 'finale').slice(-3).reverse().map(r => r.prizeId) });
    treasurePlay.reset(); garden.choose(null); garden.stories.closePanel();
    rechargeStation.consume(); rechargeStation.setLocked(true);
    let awarded = false;
    drawButton.disabled = true; drawButton.classList.add('pressed');
    $('collection').disabled = true; $('cheat').disabled = true;
    particles.clear(); currentTreasure = null;
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
      acquired(winner); acquirePower(winner); inventory[winner.id] = (inventory[winner.id] || 0) + 1; history.push(treasureRecord(winner)); awarded = true; history = history.slice(-1000); world.completedDraw(); garden.workshop.normalDraw();garden.adventures.render(); save(); updateCount();
      $('announcement').textContent = `恭喜 75，获得${RARITIES[winner.rarity].label}：${winner.name}。${winner.description}`;
      sound.celebrate(winner.effects.sound, true); particles.shockwave(winner.appearance.primaryColor); particles.emit(winner);
      spellPop(winner.rarity === 'super' ? '超级宝物！' : winner.rarity === 'rare' ? '彩虹魔法！' : '找到宝物啦！');
      await wait(420); $('spell-pop').classList.remove('pop');
      particles.emit(winner);
      await wait(winner.effects.params.durationMs - 420);
      setPhase('result'); $('button-text').textContent = '再来一次';
      $('draw-hint').textContent = winner.effects.interaction ? '点点宝物，和它玩一玩' : '';
      pacing.quiet(winner.rarity === 'super' ? 5000 : winner.rarity === 'rare' ? 3000 : 2000);
      tip('treasure-play', '点一下宝物，它还有自己的小魔法！从收藏里可以把伙伴放进花园。');
    } catch {
      if (!awarded) rechargeStation.change(gameRules.energy.drawCost);
      setPhase('idle'); energy(0); $('treasure-art').hidden = true; $('button-text').textContent = '开启魔法';
      notice('机器歇了一小会儿，再按一下试试。');
    } finally {
      rechargeStation.setLocked(false); syncDrawAction();
      drawButton.disabled = false; drawButton.classList.remove('pressed'); $('collection').disabled = false; $('cheat').disabled = false; $('jackpot').classList.remove('show'); $('spell-pop').classList.remove('pop');garden.workshop.sync();
    }
  }
  async function finalDraw() {
    treasurePlay.reset(); garden.choose(null); garden.endWeather(); particles.clear();
    rechargeStation.consume(); rechargeStation.setLocked(true); drawButton.disabled=true; $('collection').disabled=true;
    world.completedDraw(); garden.workshop.normalDraw();garden.adventures.render(); save();
    setPhase('charging', pool[0]); $('button-text').textContent='第75次，魔法醒来！'; $('prize-name').textContent='小球变成星星啦！'; $('prize-description').textContent='花园正在准备一份特别的惊喜。'; $('treasure-art').hidden=true;
    try { await sound.unlock(); sound.start('life'); await wait(1200); setPhase('idle'); await resumeWorld(); }
    finally { setPhase('idle'); drawButton.disabled=false; $('collection').disabled=false; rechargeStation.setLocked(false); syncDrawAction(); }
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
    if (muted) { globalThis.speechSynthesis?.cancel(); sound.stop(); sound.context?.suspend().catch(() => {}); } else { sound.unlock().then(() => sound.tone(660, .18)); }
    syncPreferences(); save();
  });
  $('motion').addEventListener('click', () => {
    if (reducedMotion.matches && gentle) { notice('正在遵循设备的减少动态效果设置。'); return; }
    gentle = !gentle; particles.clear(); syncPreferences(); save();
    notice(gentle ? '柔和动画已开启' : '完整动画已开启');
  });
  reducedMotion.addEventListener('change', event => { if (event.matches) { gentle = true; particles.clear(); syncPreferences(); } });
  document.addEventListener('visibilitychange', () => {
    spaceHeld = false;
    document.body.classList.toggle('background-paused', document.hidden);
    if (document.hidden) { cancelAnimationFrame(particles.frameId); clearTimeout(particles.timer); particles.frameId = null; sound.context?.suspend().catch(() => {}); globalThis.speechSynthesis?.cancel(); }
    else { particles.last = 0; particles.wake(); if (!muted && sound.context) sound.context.resume().catch(() => {}); }
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
    const collected = new Set(Object.keys(inventory));
    $('collection-summary').textContent = collected.size ? `已经发现 ${collected.size} 种宝物，收获 ${Object.values(inventory).reduce((sum, count) => sum + count, 0)} 次惊喜。` : '宝藏还在花园里等你，去开启第一次魔法吧。';
    $('collection-grid').replaceChildren();
    const archived = [...collected].filter(id => !treasures.some(t => t.id === id)).map(id => {
      const last = history.filter(r => r.prizeId === id).at(-1);
      return { id, name: last?.name || '过去的宝物', description: last?.description || '一份过去发现的魔法。', rarity: last?.rarity || 'common', appearance: { icon: last?.icon || '✨', image: '' } };
    });
    const filter = $('collection-filter').value;
    const items = collectionOrder([...treasures, ...archived], inventory, acquiredAt, $('collection-sort').value).filter(t => filter === 'all' || (filter === 'owned' ? !!inventory[t.id] : !inventory[t.id]));
    if (wishCollectionIds) items.sort((a, b) => Number(wishCollectionIds.has(b.id)) - Number(wishCollectionIds.has(a.id)) || Number(!!inventory[b.id]) - Number(!!inventory[a.id]));
    for (const treasure of items) {
      const records = history.filter(r => r.prizeId === treasure.id), latest = records.at(-1);
      const owned = inventory[treasure.id] || 0, used = garden.used(treasure.id);
      const card = document.createElement('article'); card.dataset.treasure = treasure.id; card.className = `treasure-card${owned ? '' : ' uncollected'}`;
      if (wishCollectionIds?.has(treasure.id)) { card.classList.add('wish-candidate'); card.append(textElement('span', owned ? '💌 心愿伙伴' : '💌 想找的伙伴', 'wish-card-badge')); }
      if (owned && unread.has(treasure.id)) { const badge = textElement('button', 'NEW', 'new-badge'); badge.type = 'button'; badge.setAttribute('aria-label', `标记${treasure.name}已看`); badge.onclick = () => { unread.delete(treasure.id); save(); badge.remove(); }; card.append(badge); }
      const art = document.createElement('div'); makeArt(treasure, art);
      // 收藏插画直接放入网格，保留图片失败时的图标降级。
      card.append(...art.childNodes);
      card.append(textElement('span', treasure.id === CROWN_ID ? '超级宝物 · ONLY ONE' : RARITIES[treasure.rarity].label, 'rarity'), textElement('h3', treasure.name), textElement('p', owned ? treasure.description : treasure.id === CROWN_ID ? '完成第75次魔法之夜，获得唯一皇冠。' : '还没发现，下一次也许就是它。', 'card-description'), textElement('span', owned ? `拥有 ${owned} · 已摆放 ${used} · 可摆放 ${Math.max(0, owned - used)}` : '等待发现', 'card-count'));
      if (treasure.effects?.guardian) card.append(textElement('span', used ? (treasure.effects.guardian === 'heart-shield' ? '🛡 已摆放 · 爱心助攻与护盾' : '🛡 已摆放 · 魔法助攻') : '🛡 放进花园后可守护', 'guardian-card-badge'));
      const recentDate = acquiredAt[treasure.id] || latest?.timestamp;
      if (recentDate) card.append(textElement('time', `最近获得 · ${new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(recentDate)}`, 'last-date'));
      if (owned && treasures.some(item => item.id === treasure.id)) {
        const place = textElement('button', owned > used ? wishCollectionIds?.has(treasure.id) ? '邀请到花园' : '放进花园' : '已全部摆放', 'place-treasure'); place.type = 'button'; place.disabled = (collectionMode !== 'craft' && owned <= used) || garden.stories.busy; if(collectionMode==='craft')place.textContent='邀请到魔法台';
        place.onclick = () => { if(world.busy||world.state.pending.length||garden.workshop.busy)return;if(collectionMode==='craft'){garden.workshop.put(treasure.id,trayIndex);dialog.close();return;} if (garden.stories.busy || garden.available(treasure.id) <= 0) return; unread.delete(treasure.id); save(); dialog.close(); garden.choose(treasure); tip('garden-place', '点花园里的空位置，伙伴就住进来啦！不同伙伴放在一起，还会发现小故事。'); }; card.append(place);
      }
      if(collectionMode==='focus'&&!owned&&treasure.enabled&&treasure.weight>0){const select=textElement('button','许愿 · 接下来5抽机会加倍','place-treasure');select.type='button';select.onclick=()=>{garden.state.workshop.focusId=treasure.id;garden.state.workshop.focusRemaining=5;save();dialog.close();};card.append(select);}
      $('collection-grid').append(card);
    }
    if (!items.length) $('collection-grid').append(textElement('p', filter === 'missing' ? '宝藏已经收集齐啦！' : '这里暂时没有宝物。'));
    if (wishCollectionLine) $('collection-summary').textContent = `${wishCollectionLine} ${$('collection-summary').textContent}`;
    $('collection-summary').textContent += storageAvailable ? '' : ' 本次收藏暂未保存到浏览器。';
  }
  $('collection-filter').onchange = renderCollection; $('collection-sort').onchange = renderCollection;
  $('collection').addEventListener('click', () => { if(garden.workshop.busy||world.busy||garden.stories.busy)return;collectionMode=null;renderCollection(); dialog.showModal(); });
  $('close-collection').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => { wishCollectionIds = null; wishCollectionLine = null; collectionMode = null; if (garden?.chosen) garden.plots.querySelector('.garden-slot').focus(); else $('collection').focus(); });
  for (const id of ['settings', 'environment']) {
    const panel = $(`${id}-dialog`);
    $(id).onclick = () => { if (!world.busy && !finale?.busy && !garden.workshop.busy && !garden.stories.busy && ['idle', 'result'].includes(phase)) panel.showModal(); };
    panel.querySelector('[data-close]').onclick = () => panel.close();
    panel.addEventListener('click', event => { if (event.target === panel) { const r = panel.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) panel.close(); } });
    panel.addEventListener('close', () => $(id).focus());
  }
  // 环境控件是主动操作，可以覆盖自动事件的等待时间。
  for (const id of ['season', 'day-night', 'weather']) {
    const original = $(id).onclick;
    $(id).onclick = async () => { $('environment-dialog').close(); await original?.(); };
  }
  $('export-save').onclick = () => {
    save(); if (!storageAvailable) return;
    const blob = new Blob([JSON.stringify({ format: '75-magic-world', savedAt: new Date().toISOString(), save: JSON.parse(localStorage.getItem(STORE_KEY)) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `75-magic-world-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  let importCandidate = null;
  $('import-save').onchange = async () => {
    importCandidate = null; $('confirm-import').hidden = true;
    try {
      const file = $('import-save').files[0]; if (!file) return; if (file.size > 5000000) throw new Error('存档文件太大');
      const data = JSON.parse(await file.text());
      if (data.format !== '75-magic-world') throw new Error('这不是魔法世界存档');
      const candidate = migrateSave(data.save); if (!candidate) throw new Error('存档为空');
      candidate.history = validHistory(candidate.history); candidate.inventory = normalizeInventory(candidate.inventory, candidate.history);
      candidate.energy = normalizeEnergyState(candidate.energy, gameRules); candidate.world = normalizeWorldState(candidate.world, candidate.history, gameRules.world);
      candidate.garden = normalizeGardenState(candidate.garden, treasures, candidate.history, candidate.inventory);
      importCandidate = candidate; $('import-preview').textContent = `将恢复 ${Object.keys(candidate.inventory).length} 种宝物、${candidate.energy.balance} 格能量和 ${candidate.world.completedDraws} 次抽奖。当前进度会替换，原存档将保留为本地备份。`;
      $('confirm-import').hidden = false;
    } catch (error) { $('import-preview').textContent = `无法导入：${error.message}`; }
  };
  $('confirm-import').onclick = () => {
    if (!importCandidate || !storageWritable) return;
    try { save(); if (!storageAvailable) throw new Error('无法备份当前进度'); localStorage.setItem(`${STORE_KEY}:backup`, localStorage.getItem(STORE_KEY)); localStorage.setItem(STORE_KEY, JSON.stringify(importCandidate)); location.reload(); }
    catch { $('import-preview').textContent = '浏览器无法保存，当前进度没有替换。'; }
  };
})();
