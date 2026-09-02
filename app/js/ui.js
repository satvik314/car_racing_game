// HUD + overlays + popups + touch controls. All DOM lives in index.html;
// this module wires and updates it.

export class UI {
  constructor(input, audio, onRestartRequest) {
    this.input = input;
    this.audio = audio;
    this.onRestartRequest = onRestartRequest;

    this.el = {
      hud: document.getElementById('hud'),
      score: document.getElementById('score'),
      mult: document.getElementById('mult'),
      dist: document.getElementById('dist'),
      best: document.getElementById('best'),
      nitroFill: document.getElementById('nitro-fill'),
      nitroBox: document.getElementById('nitro-box'),
      gauge: document.getElementById('gauge'),
      popups: document.getElementById('popups'),
      menu: document.getElementById('menu'),
      pause: document.getElementById('pause'),
      gameover: document.getElementById('gameover'),
      finalScore: document.getElementById('final-score'),
      finalBest: document.getElementById('final-best'),
      newBest: document.getElementById('new-best'),
      restartBtn: document.getElementById('restart-btn'),
      startBtn: document.getElementById('start-btn'),
      touch: document.getElementById('touch'),
      muteTag: document.getElementById('mute-tag'),
      vignette: document.getElementById('vignette'),
    };
    this.gctx = this.el.gauge.getContext('2d');

    this._lastScore = -1;
    this._lastMult = -1;
    this._lastDist = -1;

    this.el.restartBtn.addEventListener('click', () => this.onRestartRequest());
    this.el.startBtn.addEventListener('click', () => this.onRestartRequest());

    this._bindTouch();
  }

  // ---------------------------------------------------------- overlays
  showMenu(best) {
    this.el.menu.classList.remove('hidden');
    this.el.pause.classList.add('hidden');
    this.el.gameover.classList.add('hidden');
    this.el.hud.classList.add('hidden');
    this.el.touch.classList.add('hidden');
    this.el.best.textContent = String(best).padStart(6, '0');
  }

  showHUD() {
    this.el.menu.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.gameover.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    if (this.isTouch) this.el.touch.classList.remove('hidden');
  }

  showPause(show) {
    this.el.pause.classList.toggle('hidden', !show);
  }

  showGameOver(score, best, isNew) {
    this.el.gameover.classList.remove('hidden');
    this.el.touch.classList.add('hidden');
    this.el.finalScore.textContent = String(score).padStart(6, '0');
    this.el.finalBest.textContent = String(best).padStart(6, '0');
    this.el.newBest.classList.toggle('hidden', !isNew);
  }

  setMuted(m) {
    this.el.muteTag.classList.toggle('hidden', !m);
  }

  // ---------------------------------------------------------- popups
  popup(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    d.style.left = (42 + Math.random() * 16) + '%';
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), 1400);
    // cap popup count
    while (this.el.popups.children.length > 6) this.el.popups.firstChild.remove();
  }

  // ---------------------------------------------------------- HUD
  update(speedKmh, score, mult, nitro01, distKm, nitroActive) {
    const s = Math.round(score);
    if (s !== this._lastScore) { this.el.score.textContent = String(s).padStart(6, '0'); this._lastScore = s; }
    if (mult !== this._lastMult) {
      this.el.mult.textContent = 'x' + mult;
      this.el.mult.classList.toggle('hot', mult > 1);
      this._lastMult = mult;
    }
    const dk = distKm.toFixed(1);
    if (dk !== this._lastDist) { this.el.dist.textContent = dk + ' km'; this._lastDist = dk; }

    this.el.nitroFill.style.width = (nitro01 * 100).toFixed(1) + '%';
    this.el.nitroBox.classList.toggle('boosting', nitroActive);
    this.el.vignette.classList.toggle('nitro', nitroActive);

    this._drawGauge(speedKmh);
  }

  _drawGauge(kmh) {
    const ctx = this.gctx;
    const W = 200, H = 200, cx = 100, cy = 112, r = 78;
    ctx.clearRect(0, 0, W, H);
    const a0 = Math.PI * 0.85, a1 = Math.PI * 2.15; // sweep
    // dial bg
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(28,18,20,0.55)';
    ctx.fill();
    // arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.strokeStyle = 'rgba(244,162,97,0.28)';
    ctx.lineWidth = 9;
    ctx.stroke();
    // active arc
    const t = Math.min(1, kmh / 340);
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * t);
    ctx.strokeStyle = t > 0.82 ? '#e76f51' : '#f4a261';
    ctx.lineWidth = 9;
    ctx.stroke();
    // ticks
    ctx.strokeStyle = 'rgba(247,214,196,0.75)';
    ctx.fillStyle = 'rgba(247,214,196,0.75)';
    ctx.lineWidth = 2;
    ctx.font = '11px "Chakra Petch", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= 320; v += 40) {
      const a = a0 + (a1 - a0) * (v / 340);
      const c = Math.cos(a), s2 = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(cx + c * (r - 12), cy + s2 * (r - 12));
      ctx.lineTo(cx + c * (r - 4), cy + s2 * (r - 4));
      ctx.stroke();
      ctx.fillText(String(v), cx + c * (r - 24), cy + s2 * (r - 24));
    }
    // needle
    const na = a0 + (a1 - a0) * t;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(na) * 10, cy - Math.sin(na) * 10);
    ctx.lineTo(cx + Math.cos(na) * (r - 16), cy + Math.sin(na) * (r - 16));
    ctx.strokeStyle = '#ffe9d2';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fillStyle = '#e76f51'; ctx.fill();
    // digital
    ctx.font = 'bold 30px "Chakra Petch", monospace';
    ctx.fillStyle = '#ffe9d2';
    ctx.fillText(String(Math.round(kmh)), cx, cy + 42);
    ctx.font = '11px "Chakra Petch", monospace';
    ctx.fillStyle = 'rgba(247,214,196,0.6)';
    ctx.fillText('km/h', cx, cy + 60);
  }

  // ---------------------------------------------------------- touch
  _bindTouch() {
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!this.isTouch) return;
    const bind = (id, key) => {
      const el = document.getElementById(id);
      const on = (e) => { e.preventDefault(); this.input.touch[key] = true; el.classList.add('held'); };
      const off = (e) => { e.preventDefault(); this.input.touch[key] = false; el.classList.remove('held'); };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off, { passive: false });
      el.addEventListener('touchcancel', off, { passive: false });
    };
    bind('t-left', 'left');
    bind('t-right', 'right');
    bind('t-gas', 'gas');
    bind('t-brake', 'brake');
    bind('t-nitro', 'nitro');
    bind('t-drift', 'drift');
  }
}
