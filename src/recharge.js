// 充能小站：一次题目只奖励一次，主动点击下一题，随时可以回到机器。
class RechargeStation {
  constructor(rules, saved, { canOpen, onChange, onReward, onFailure }) {
    this.rules = rules; this.state = normalizeEnergyState(saved, rules);
    this.canOpen = canOpen; this.onChange = onChange; this.onReward = onReward; this.onFailure = onFailure;
    this.$ = id => document.getElementById(id); this.dialog = this.$('recharge-dialog');
    this.question = null; this.answered = false;
    for (let i = 0; i < rules.energy.max; i++) {
      const cell = document.createElement('span'); cell.className = 'power-cell'; cell.setAttribute('aria-hidden', 'true'); cell.innerHTML = '<svg viewBox="0 0 32 30" fill="none"><path d="M16 27S2 18 2 10C2 2 11 0 16 7C21 0 30 2 30 10C30 18 16 27 16 27Z"/><path class="heart-shine" d="M7 10Q7 6 11 6"/></svg>'; this.$('power-cells').append(cell);
    }
    for (const [key, difficulty] of Object.entries(rules.math.difficulties)) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.difficulty = key;
      button.innerHTML = `<b>${difficulty.label}</b><span>${difficulty.max} 以内</span>`;
      button.addEventListener('click', () => {
        if (this.state.difficulty === key) return;
        this.state.difficulty = key; this.newQuestion(); this.render(); this.onChange();
      });
      this.$('difficulty-options').append(button);
    }
    for (let i = 0; i < 22; i++) {
      const spark = document.createElement('span'); spark.textContent = i % 3 === 0 ? '♥' : '✦';
      const angle = i * Math.PI * 2 / 22, radius = 95 + (i % 3) * 25;
      spark.style.setProperty('--burst-x', `${Math.cos(angle) * radius}px`);
      spark.style.setProperty('--burst-y', `${Math.sin(angle) * radius}px`);
      spark.style.setProperty('--burst-color', ['#ffc0df', '#fff0b5', '#aaffdf', '#c9b2ff'][i % 4]);
      spark.style.setProperty('--burst-delay', `${i % 4 * .045}s`);
      this.$('charge-burst').append(spark);
    }
    for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '清空', '0', '⌫']) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = digit;
      button.setAttribute('aria-label', digit === '⌫' ? '删除一位' : digit);
      button.addEventListener('click', () => {
        if (this.answered || this.full) return;
        const input = this.$('math-answer');
        input.value = digit === '清空' ? '' : digit === '⌫' ? input.value.slice(0, -1) : (input.value + digit).slice(0, 3);
        this.checkAutoAnswer();
      });
      this.$('number-pad').append(button);
    }
    this.$('recharge').addEventListener('click', () => this.open());
    this.$('close-recharge').addEventListener('click', () => this.dialog.close());
    this.$('return-to-machine').addEventListener('click', () => this.dialog.close());
    this.$('math-form').addEventListener('submit', event => { event.preventDefault(); this.submit(); });
    this.$('math-answer').addEventListener('input', event => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 3); if (!event.isComposing) this.checkAutoAnswer(); });
    this.$('math-answer').addEventListener('compositionend', () => this.checkAutoAnswer());
    this.dialog.addEventListener('close', () => {
      document.body.classList.remove('recharging'); this.$('full-energy').classList.remove('just-charged'); this.$('draw').focus();
    });
    this.render();
  }
  get balance() { return this.state.balance; }
  get full() { return this.balance >= this.rules.energy.max; }
  snapshot() { return { ...this.state }; }
  setLocked(locked) { this.$('recharge').disabled = locked; }
  change(delta) {
    this.state.balance = changeEnergy(this.balance, delta, this.rules);
    this.render(); this.onChange();
  }
  consume() {
    if (this.balance < this.rules.energy.drawCost) return false;
    this.change(-this.rules.energy.drawCost); return true;
  }
  render() {
    const { max, warningThreshold, drawCost } = this.rules.energy;
    const low = this.balance <= warningThreshold;
    document.body.classList.toggle('low-energy', low);
    document.body.classList.toggle('empty-energy', this.balance < drawCost);
    this.$('power-count').textContent = `${this.balance} / ${max}`;
    this.$('power-cells').setAttribute('aria-label', `魔法能量 ${this.balance} 格，上限 ${max} 格`);
    [...this.$('power-cells').children].forEach((cell, index) => cell.classList.toggle('filled', index < this.balance));
    this.$('power-status').textContent = this.balance < drawCost ? '能量耗尽，快来充能！' : low ? '能量告急！' : '';
    this.$('power-status').hidden = !low;
    this.$('recharge-count').textContent = `${this.balance} / ${max}`;
    this.$('recharge-progress').style.setProperty('--charge', `${this.balance / max * 100}%`);
    this.$('full-energy').hidden = !this.full;
    this.$('math-form').hidden = this.full;
    this.$('difficulty-options').querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.difficulty === this.state.difficulty)); button.disabled = this.full;
    });
    this.$('return-to-machine').textContent = this.balance < drawCost ? '先回机器看看' : '带着能量继续玩';
  }
  open() {
    if (!this.canOpen() || this.dialog.open) return;
    this.newQuestion(); this.render(); document.body.classList.add('recharging');
    this.dialog.showModal();
    // 使用屏幕数字键盘，手机不会自动弹出系统键盘遮住题目。
    this.$('close-recharge').focus();
  }
  checkAutoAnswer() {
    if (!this.answered && !this.full && this.dialog.open && isCorrectAnswer(this.$('math-answer').value, this.question)) this.submit();
  }
  newQuestion() {
    const max = this.rules.math.difficulties[this.state.difficulty].max;
    this.question = makeMathQuestion(max, Math.random, this.question); this.answered = false;
    this.$('math-question').textContent = `${this.question.left} ${this.question.operator} ${this.question.right} =`;
    this.$('math-question').setAttribute('aria-label', `${this.question.left} ${this.question.operator === '+' ? '加' : '减'} ${this.question.right} 等于多少`);
    this.$('math-answer').value = ''; this.$('math-answer').disabled = false;
    this.$('answer-submit').textContent = '送出答案 ✦'; this.$('answer-feedback').textContent = '答对一题，点亮一格魔法';
    this.$('answer-feedback').dataset.kind = 'neutral'; this.$('math-hint').hidden = true;
    this.$('number-pad').querySelectorAll('button').forEach(button => { button.disabled = false; });
    this.$('reward-star').classList.remove('fly'); this.$('full-energy').classList.remove('just-charged');
    this.renderStars();
  }
  renderStars() {
    const q = this.question, visual = this.$('counting-stars'); visual.replaceChildren();
    visual.hidden = this.state.difficulty !== 'easy';
    if (visual.hidden) return;
    const group = (amount, removed = 0) => {
      const node = document.createElement('span'); node.className = 'star-group';
      if (!amount) { node.textContent = '0'; return node; }
      for (let i = 0; i < amount; i++) { const star = document.createElement('span'); star.textContent = '★'; star.className = i >= amount - removed ? 'count-star removed' : 'count-star'; node.append(star); }
      return node;
    };
    visual.append(group(q.left, q.operator === '−' ? q.right : 0));
    if (q.operator === '+') { const plus = document.createElement('span'); plus.textContent = '+'; plus.className = 'star-plus'; visual.append(plus, group(q.right)); }
    visual.setAttribute('aria-label', q.operator === '+' ? `${q.left} 颗星星加上 ${q.right} 颗星星` : `${q.left} 颗星星拿走 ${q.right} 颗，数数剩下的星星`);
  }
  submit() {
    if (this.full || !this.dialog.open) return;
    if (this.answered) { this.newQuestion(); return; }
    const feedback = this.$('answer-feedback');
    if (!this.$('math-answer').value.trim()) { feedback.textContent = '先选一个数字，再送出答案吧。'; return; }
    if (!isCorrectAnswer(this.$('math-answer').value, this.question)) {
      feedback.textContent = '再想一想，你可以的！'; feedback.dataset.kind = 'retry';
      const q = this.question;
      this.$('math-hint').textContent = this.state.difficulty === 'easy' ? (q.operator === '+' ? '把两组星星放在一起数数。' : '划掉的星星被拿走了，数数亮着的。') : q.operator === '+' ? `从 ${q.left} 开始，再往后数 ${q.right} 个。` : `从 ${q.left} 开始，往前数 ${q.right} 个。`;
      this.$('math-hint').hidden = false; this.$('math-answer').value = ''; this.onFailure(); return;
    }
    this.answered = true; this.$('math-answer').disabled = true;
    this.$('number-pad').querySelectorAll('button').forEach(button => { button.disabled = true; });
    const before = this.balance;
    this.change(this.rules.energy.correctReward);
    feedback.textContent = `答对啦！魔法能量 +${this.balance - before}`; feedback.dataset.kind = 'correct';
    this.$('math-hint').hidden = true; this.$('answer-submit').textContent = '再充一格 ✦';
    const star = this.$('reward-star'); star.classList.remove('fly'); void star.offsetWidth; star.classList.add('fly');
    if (this.full) { const full = this.$('full-energy'); full.classList.remove('just-charged'); void full.offsetWidth; full.classList.add('just-charged'); }
    this.onReward(this.full);
  }
}
