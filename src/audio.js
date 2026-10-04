// 使用统一总线与压缩器合成鼓、低音、和弦和旋律，声音跟随每个机器动作。
class MagicAudio {
  constructor(isMuted) { this.isMuted = isMuted; this.context = null; this.level = 'starlight'; this.voices = new Set(); this.warningVoices = new Set(); }
  setup(ctx) {
    this.context = ctx;
    this.master = ctx.createGain(); this.master.gain.value = .65;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18; this.compressor.knee.value = 18; this.compressor.ratio.value = 5;
    this.master.connect(this.compressor); this.compressor.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * .35, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  async unlock() {
    if (this.isMuted()) return;
    try {
      if (!this.context) {
        this.setup(new (window.AudioContext || window.webkitAudioContext)());
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch { /* 音频不可用时不阻止游戏。 */ }
  }
  ready() { return !this.isMuted() && !document.hidden && this.context?.state === 'running'; }
  track(source, nodes, end) {
    this.voices.add(source);
    source.onended = () => { this.voices.delete(source); this.warningVoices.delete(source); source.disconnect(); nodes.forEach(node => node.disconnect()); };
    source.stop(end);
  }
  tone(frequency, length = .16, delay = 0, volume = .08, type = 'triangle', slideTo) {
    if (!this.ready()) return;
    const ctx = this.context, start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator(), envelope = ctx.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + length);
    envelope.gain.setValueAtTime(.0001, start); envelope.gain.exponentialRampToValueAtTime(volume, start + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + length);
    oscillator.connect(envelope); envelope.connect(this.master); oscillator.start(start);
    this.track(oscillator, [envelope], start + length + .03);
    return oscillator;
  }
  noiseHit(delay = 0, length = .09, volume = .06, highpass = 2200) {
    if (!this.ready()) return;
    const ctx = this.context, start = ctx.currentTime + delay, source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = highpass;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(.0001, start + length);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(start);
    this.track(source, [filter, gain], start + length);
  }
  kick(delay = 0, strong = false) { this.tone(135, .19, delay, strong ? .28 : .16, 'sine', 45); }
  chord(notes, delay = 0, length = .45) { notes.forEach(note => this.tone(note, length, delay, .045)); }
  start(level = false) { this.level = level === true ? 'rainbow' : ['rainbow', 'winged', 'castle', 'life'].includes(level) ? level : 'starlight'; if (level === 'life') { this.machineNotes([1, 1.5, 2, 2.5, 3], .28); this.tone(1200, .18, .25, .035, 'sine', 1900); this.tone(1400, .2, .5, .03, 'sine', 2100); return; } if (level === 'winged' || level === 'castle') { const notes = level === 'castle' ? [392, 523, 659, 784, 1047, 1319] : [659, 784, 1047, 1319, 1568]; notes.forEach((note, i) => this.tone(note, .25, i * .09, .085)); this.chord(level === 'castle' ? [196, 262, 330] : [330, 392, 523], 0, .55); this.kick(0, true); if (level === 'winged') this.noiseHit(.2, .15, .035, 3000); return; } if (level === true || level === 'rainbow') { [523, 659, 784, 1047, 1319].forEach((note, i) => this.tone(note, .2, i * .075, .085)); this.chord([262, 330, 392], 0, .4); this.kick(0, true); return; } this.kick(0, true); [262, 392, 523, 784].forEach((note, i) => this.tone(note, .22, i * .085)); this.tone(180, .5, 0, .055, 'sine', 1000); }
  profile() {
    return { starlight: { root: 262, type: 'triangle', step: .1 }, rainbow: { root: 330, type: 'sine', step: .075 }, winged: { root: 523, type: 'sine', step: .06 }, castle: { root: 196, type: 'square', step: .12 }, life: { root: 392, type: 'sine', step: .085 } }[this.level];
  }
  machineNotes(notes, length = .15, delay = 0) {
    const profile = this.profile(); notes.forEach((ratio, i) => this.tone(profile.root * ratio, length, delay + i * profile.step, profile.type === 'square' ? .035 : .065, profile.type));
  }
  mixing(index) {
    const profile = this.profile();
    if (this.level === 'life') { this.machineNotes([[1, 2], [1.5, 3], [2, 2.5], [1.25, 2.5]][index % 4], .2); this.tone(1568 + index * 45, .15, .12, .025, 'sine'); return; }
    this.kick(0, this.level === 'castle'); this.noiseHit(.08, .055, .035);
    this.machineNotes([[1, 1.25], [1.25, 1.5], [1.5, 2], [2, 2.5]][index % 4], .12);
    if (this.level === 'winged') { this.noiseHit(.03, .16, .025, 3500); this.tone(profile.root * 3, .2, .12, .025, 'sine'); }
    if (this.level === 'castle') { this.tone(98, .22, .04, .1, 'sine'); this.noiseHit(.16, .13, .055, 900); }
  }
  bounce(index) { const profile = this.profile(); this.tone(profile.root * 1.5 + index * 55, .09, 0, .035, profile.type, profile.root); }
  land() { if (this.level === 'life') { this.machineNotes([.5, 1, 2], .22); return; } this.kick(0, true); const profile = this.profile(); this.tone(profile.root * 1.5, .2, 0, .075, profile.type, profile.root * .65); if (this.level !== 'starlight') this.machineNotes([1, 1.5, 2], .17, .1); }
  knock(index) { if (this.level === 'life') { this.tone(392 + index * 98, .12, 0, .08, 'sine'); this.tone(1176 + index * 196, .17, .06, .03, 'sine'); return; } this.kick(); this.machineNotes([1.5 + index * .25, 2 + index * .25], .16, .03); }
  charge() {
    const profile = this.profile(); this.tone(profile.root * .6, .6, 0, .075, 'sine', profile.root * 4);
    this.machineNotes([1, 1.25, 1.5, 2], .4, .1);
    if (this.level === 'life') { this.machineNotes([2, 3, 4], .4, .3); this.tone(1000, .35, .6, .035, 'sine', 2000); }
    if (this.level === 'castle') this.chord([98, 147, 196], .1, .55);
    if (this.level === 'winged') this.noiseHit(.25, .25, .035, 3500);
  }
  levelFinale() {
    if (this.level === 'starlight') return;
    if (this.level === 'life') { this.machineNotes([1, 1.5, 2, 2.5, 3, 4], .35, .1); [0, .3, .6].forEach((at, i) => this.tone(1200 + i * 150, .17, .8 + at, .035, 'sine', 2000 + i * 150)); return; }
    const notes = this.level === 'castle' ? [1, 1.5, 2, 2, 3, 4] : this.level === 'winged' ? [1, 1.5, 2, 2.5, 3, 4] : [1, 1.25, 1.5, 2, 2.5];
    this.machineNotes(notes, .3, .15);
    if (this.level === 'castle') { this.kick(.15, true); this.kick(.39, true); this.chord([196, 294, 392], .6, .6); }
    if (this.level === 'winged') { this.noiseHit(.1, .2, .025, 3200); this.noiseHit(.35, .2, .025, 3200); }
  }
  story(kind, time, weather) {
    if (kind === 'forest') { this.treasureSound('mushroom-notes'); [523, 659, 784, 1047].forEach((note, i) => this.tone(note, .3, 1.5 + i * .2, .065)); }
    else if (kind === 'ocean') { this.treasureSound('flower-bloom'); for (let i = 0; i < (weather === 'rain' ? 8 : 5); i++) this.tone(350 + i * 110, .15, 1.2 + i * .17, .055, 'sine', 850 + i * 100); }
    else if (kind === 'ball') { this.celebrate(time === 'night' ? 'magic-chime' : 'rainbow-song'); }
    else if (kind === 'lunar') { this.treasureSound('dolphin-dive'); this.tone(392, 1.1, 1.2, .05, 'sine', 1047); }
    else if (kind === 'secret') { this.treasureSound('owl-peek'); this.treasureSound('flower-bloom'); }
    else if (kind === 'race') { this.treasureSound('wheel-zoom'); [523, 659, 784].forEach((n, i) => this.tone(n, .25, 1.6 + i * .2, .06)); }
    else if (kind === 'hug') this.treasureSound('warm-hug');
    else if (kind === 'sparkle') this.treasureSound('gem-sparkle');
    else if (kind === 'picnic') { this.treasureSound('whale-spout'); this.tone(523, .3, 1.6, .06, 'sine'); }
    else this.celebrate('bubble-giggle');
  }
  weather(kind) {
    if (kind === 'storm') { this.noiseHit(0, .35, .055, 250); this.tone(65, .8, .08, .08, 'sine', 38); this.noiseHit(.45, .3, .035, 800); return; }
    if (['icecream', 'coins', 'sakura'].includes(kind)) { const notes = kind === 'coins' ? [1568, 2093, 1568, 2637] : kind === 'icecream' ? [523, 659, 784, 1047] : [784, 988, 1175, 1568]; notes.forEach((n, i) => this.tone(n, .4, i * .18, .045, 'sine')); return; }
    if (kind === 'rain' || kind === 'wind') { for (let i = 0; i < 6; i++) this.noiseHit(i * .18, .28, kind === 'rain' ? .025 : .035, kind === 'rain' ? 2000 : 700); }
    else (kind === 'snow' ? [1568, 1319, 1047, 784] : [523, 784, 1047, 1568, 2093]).forEach((note, i) => this.tone(note, .4, i * .14, .04, 'sine'));
  }
  celebrate(id, machineReward = false) {
    if (machineReward) this.levelFinale();
    if (INTERACTIONS.includes(id)) { this.treasureSound(id); return; }
    if (id === 'bubble-giggle') {
      [0, .19, .38].forEach((delay, i) => this.tone(120 + i * 25, .16, delay, .08, 'sawtooth', 55));
      [523, 784, 659, 1047, 784, 1319].forEach((note, i) => this.tone(note, .23, .55 + i * .16, .085));
      this.kick(.55); this.chord([262, 330, 392], .55, .6); this.chord([523, 659, 784], 1.5, .6);
      return;
    }
    const scores = {
      'magic-chime': { melody: [523, 659, 784, 1047, 784, 1047, 1319, 1047], chords: [[262, 330, 392], [349, 440, 523]], bass: [131, 131, 175, 196] },
      'rainbow-song': { melody: [523, 659, 784, 988, 1047, 988, 784, 1319, 1175, 1047, 1319, 1568], chords: [[262, 330, 392], [294, 370, 440], [349, 440, 523]], bass: [131, 147, 175, 196] },
      'royal-fanfare': { melody: [392, 523, 659, 784, 1047, 784, 1047, 1319, 1568, 1319, 1175, 1047, 1319, 1568, 2093, 1568], chords: [[196, 262, 330], [262, 330, 392], [349, 440, 523], [392, 494, 587]], bass: [98, 131, 175, 196] }
    };
    const score = scores[id] || scores['magic-chime'], step = .155;
    this.kick(0, true); this.noiseHit(0, .3, .1, 1200);
    score.melody.forEach((note, i) => {
      this.tone(note, .27, i * step, .105, 'triangle');
      this.tone(note * 2, .18, i * step, .017, 'sine');
      this.noiseHit(i * step + .075, .035, .025, 4500);
      if (i % 2 === 0) { this.kick(i * step); this.tone(score.bass[(i / 2) % 4], .25, i * step, .13, 'sine'); }
      else this.noiseHit(i * step, .1, .055, 1000);
    });
    score.chords.forEach((notes, i) => this.chord(notes, i * step * 4, .65));
    const end = score.melody.length * step;
    this.chord([523, 659, 784, 1047], end, .6); this.kick(end, true);
  }
  encounter(kind) {
    if (kind === 'broadcast') { this.tone(523, .16, 0, .055, 'sine'); this.tone(784, .25, .22, .055, 'sine'); return; }
    if (kind === 'guardian-shield') { this.treasureSound('warm-hug'); return; }
    if (kind === 'rock-arrive') { [0,.25,.5].forEach(at => this.noiseHit(at,.2,.04,500)); this.machineNotes([.5,.75,1], .4); return; }
    if (kind === 'dragon-arrive') { this.tone(110,.8,0,.07,'sine',65); this.machineNotes([.5,.75,1,1.5],.45); return; }
    if (kind === 'mermaid') { [659,784,988,1175,988,784,659].forEach((n,i)=>this.tone(n,.5,i*.3,.05,'sine')); return; }
    if (kind === 'bat-arrive') { this.noiseHit(0, .2, .04, 1500); this.noiseHit(.25, .2, .04, 1500); this.machineNotes([1, .75, 1.25], .25); return; }
    if (kind === 'witch-arrive') { [330, 247, 294, 220].forEach((note, i) => this.tone(note, .3, i * .17, .065)); this.chord([147, 220, 294], .3, .6); return; }
    if (kind === 'witch-shot') { this.tone(220, .18, 0, .075, 'sine', 880); this.noiseHit(.03, .06, .035, 2800); return; }
    if (kind === 'witch-hit') { this.kick(0, true); this.tone(784, .16, .04, .085, 'triangle', 392); this.tone(1047, .2, .18, .075); return; }
    if (kind === 'witch-miss') { this.tone(440, .18, 0, .05, 'sine', 330); return; }
    if (kind === 'witch-flee') { [660, 880, 660, 988, 784, 523, 392].forEach((note, i) => this.tone(note, .14, i * .2, .065, 'triangle', note * .75)); this.noiseHit(1.4, .3, .055, 1500); return; }
    if (kind === 'witch-win') { this.celebrate('royal-fanfare'); return; }
    if (kind === 'ghost') { this.tone(330, .32, 0, .085, 'triangle', 180); this.tone(150, .22, .8, .07, 'sawtooth', 90); this.tone(440, .17, 1.05, .07); return; }
    if (kind === 'upgrade-life') { this.level = 'life'; this.machineNotes([.5, 1, 1.5, 2, 2.5, 3, 4], .55); [1.4, 1.8, 2.2, 2.8, 3.2, 3.6].forEach((at, i) => this.tone(784 * [1, 1.25, 1.5][i % 3], .45, at, .055, 'sine')); [2.7, 3.4, 4].forEach(at => this.tone(1300, .25, at, .035, 'sine', 2200)); return; }
    if (kind.startsWith('upgrade')) { if (kind === 'upgrade-winged') this.treasureSound('rainbow-flight'); else this.celebrate(kind === 'upgrade-castle' ? 'royal-fanfare' : 'rainbow-song'); return; }
    const notes = kind === 'fairy' ? [784, 1047, 1319, 1568, 1319] : [523, 659, 784, 1047];
    notes.forEach((note, i) => this.tone(note, .25, i * .14, .08)); this.chord([262, 330, 392], .6, .5);
  }
  treasureSound(kind, count = 1, reaction) {
    if (reaction?.surprise) [1319,1760,2093].forEach((n,i)=>this.tone(n,.25,.9+i*.12,.04,'sine'));
    else if (reaction?.motion === 'launch' || reaction?.motion === 'fountain') this.tone(330,.3,.8,.035,'sine',1320);
    else if (reaction?.motion === 'peek') this.tone(1568,.12,.8,.035,'sine',1047);
    const scores = {
      'burp-bubbles': [262, 330, 523, 659], 'candy-rain': [1047, 784, 659, 523, 784, 1047],
      'jelly-hop': [330, 523, 784, 523, 1047], 'rainbow-flight': [523, 659, 784, 1047, 1319, 1568],
      'mushroom-notes': [[523, 659, 784], [659, 784, 1047], [784, 1047, 1319]][(count - 1) % 3],
      'flower-bloom': [523, 784, 1047, 1319, 1568], 'space-trip': [392, 330, 262, 523, 784, 1047],
      'sock-giggle': [523, 392, 659, 523, 784, 659],
      'dress-twirl': [523, 659, 784, 659, 523], 'castle-glow': [392, 523, 784, 1047],
      'dolphin-dive': [880, 1319, 1760, 1175], 'owl-peek': [1047, 1047, 784, 1047],
      'snow-wobble': [392, 523, 392, 659, 523], 'bubble-scrub': [660, 880, 1100, 1320],
      'coin-jingle': [1568, 2093, 1568, 1319], 'gem-sparkle': [1047, 1568, 2093, 1568],
      'rainbow-toot': [196, 147, 262, 330], 'warm-hug': [262, 330, 392, 330, 262],
      'cat-purr': [440, 523, 440, 330], 'wheel-zoom': [262, 392, 523, 784],
      'wand-spell': [659, 988, 1319, 1760], 'bubble-shot': [784, 1047, 1319],
      'ear-wiggle': [659, 523, 659, 784], 'wiggle-drive': [330, 262, 392, 330, 523],
      'alarm-ring': [1047, 784, 1047, 784, 1047], 'whale-spout': [330, 660, 990, 660]
    };
    if (kind === 'rainbow-toot') { [0, .13, .28].forEach((at, i) => this.tone(110 - i * 18, .17, at, .075, 'sawtooth', 45)); }
    if (kind === 'dolphin-dive') this.tone(650, .35, 0, .07, 'sine', 1700);
    if (kind === 'owl-peek') { this.tone(1600, .09, 0, .05, 'sine', 1000); this.tone(1700, .12, .13, .05, 'sine', 1100); }
    if (kind === 'cat-purr') this.tone(300, .45, 0, .07, 'sine', 160);
    if (['whale-spout', 'bubble-scrub', 'bubble-shot'].includes(kind)) this.tone(240, .18, 0, .06, 'sine', 900);
    if (kind === 'wheel-zoom' || kind === 'wiggle-drive') this.noiseHit(0, .3, .04, 650);
    if (kind === 'burp-bubbles') this.tone(160, .27, 0, .08, 'sawtooth', 65);
    if (kind === 'space-trip') { this.noiseHit(.6, .35, .08, 1000); this.tone(160, .6, .6, .06, 'sine', 900); }
    const notes = scores[kind] || scores['flower-bloom'];
    notes.forEach((note, i) => this.tone(note, .23, .3 + i * .15, .085, kind === 'candy-rain' ? 'sine' : 'triangle'));
    this.chord([262, 330, 392], .3, .5); this.kick(.3);
  }
  answerCorrect(full = false) {
    // 小胜利的上行乐句；满格时追加和弦与一段更长的庆祝旋律。
    const notes = full ? [523, 659, 784, 1047, 1319, 1568, 1047] : [659, 784, 1047, 1319];
    notes.forEach((note, i) => this.tone(note, .24, i * .11, .085, 'triangle'));
    this.chord([262, 330, 392], 0, .35);
    if (full) { this.kick(.22); this.chord([523, 659, 784, 1047], .66, .65); }
  }
  answerWrong() {
    // 短促的下降音，提醒重试，不盖过孩子的思考。
    this.tone(330, .18, 0, .08, 'triangle', 262);
    this.tone(247, .23, .19, .065, 'triangle', 196);
  }
  warning(balance) {
    if (!this.ready()) return false;
    this.stopWarning();
    // 一小段下降双音和低频脉冲，和中奖音乐区分；余额越少，音调越低。
    const pitch = balance <= 1 ? 440 : 523;
    const sources = [this.tone(pitch, .14, 0, .11, 'triangle'), this.tone(pitch * .75, .22, .18, .1, 'triangle', pitch * .6), this.tone(150, .2, .38, .07, 'sine', 90)];
    sources.filter(Boolean).forEach(source => this.warningVoices.add(source));
    return true;
  }
  stopWarning() { for (const source of this.warningVoices) { try { source.stop(); } catch {} } this.warningVoices.clear(); }
  stop() { for (const source of this.voices) { try { source.stop(); } catch {} } }
}
