// 使用统一总线与压缩器合成鼓、低音、和弦和旋律，声音跟随每个机器动作。
class MagicAudio {
  constructor(isMuted) { this.isMuted = isMuted; this.context = null; this.voices = new Set(); }
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
    source.onended = () => { this.voices.delete(source); source.disconnect(); nodes.forEach(node => node.disconnect()); };
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
  start() { this.kick(0, true); [262, 392, 523, 784].forEach((note, i) => this.tone(note, .22, i * .085)); this.tone(180, .5, 0, .055, 'sine', 1000); }
  mixing(index) { this.kick(); this.noiseHit(.08, .055, .035); this.tone([262, 330, 392, 523][index % 4], .12, .02, .055, 'triangle'); }
  bounce(index) { this.tone(460 + index * 90, .09, 0, .04, 'sine', 300); }
  land() { this.kick(0, true); this.tone(380, .15, 0, .1, 'triangle', 170); }
  knock(index) { this.kick(); this.tone(620 + index * 200, .16, .03, .09, 'triangle'); }
  charge() { this.tone(220, .6, 0, .09, 'sine', 880); this.chord([262, 330, 392], .1, .5); }
  celebrate(id) {
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
  stop() { for (const source of this.voices) { try { source.stop(); } catch {} } }
}
