// HUD + overlays + garage pickers + popups + touch controls.
// All DOM lives in index.html; this module wires and updates it.

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(input, audio, callbacks) {
    this.input = input;
    this.audio = audio;
    this.cb = callbacks; // { onStart, onGarageChange }

    this.el = {
      hud: $('hud'), score: $('score'), mult: $('mult'), bonusMult: $('bonus-mult'), dist: $('dist'), kills: $('kills'),
      best: $('best'), nitroFill: $('nitro-fill'), nitroBox: $('nitro-box'), gauge: $('gauge'), popups: $('popups'),
      menu: $('menu'), pause: $('pause'), gameover: $('gameover'),
      finalScore: $('final-score'), finalBest: $('final-best'), newBest: $('new-best'),
      finalDist: $('final-dist'), finalKills: $('final-kills'), finalTop: $('final-top'), finalWorlds: $('final-worlds'),
      restartBtn: $('restart-btn'), startBtn: $('start-btn'), touch: $('touch'), muteTag: $('mute-tag'),
      vignette: $('vignette'), flash: $('flash'), toast: $('theme-toast'), fxBar: $('fx-bar'),
      ammo: $('ammo'), ammoN: $('ammo-n'), shieldTag: $('shield-tag'), shieldN: $('shield-n'),
      themeName: $('theme-name'), themeTag: $('theme-tag'), themeDots: $('theme-dots'),
      carName: $('car-name'), carClass: $('car-class'), carBars: $('car-bars'), carBlurb: $('car-blurb'), carDots: $('car-dots'),
    };
    this.gctx = this.el.gauge.getContext('2d');
    this._lastScore = -1; this._lastMult = -1; this._lastDist = -1; this._lastKills = -1; this._lastAmmo = -1; this._lastShield = -1;
    this.chips = new Map();
    this._vigClass = '';

    this.el.restartBtn.addEventListener('click', (e) => { e.stopPropagation(); this.cb.onStart(); });
    this.el.startBtn.addEventListener('click', (e) => { e.stopPropagation(); this.cb.onStart(); });
    this.el.gameover.addEventListener('click', () => this.cb.onStart());

    $('theme-prev').addEventListener('click', () => this.cb.onGarageChange('theme', -1));
    $('theme-next').addEventListener('click', () => this.cb.onGarageChange('theme', 1));
    $('car-prev').addEventListener('click', () => this.cb.onGarageChange('car', -1));
    $('car-next').addEventListener('click', () => this.cb.onGarageChange('car', 1));

    this._bindTouch();
  }

  // ---------------------------------------------------------- garage
  renderGarage(cars, themes, carIdx, themeIdx) {
    const t = themes[themeIdx], c = cars[carIdx];
    this.el.themeName.textContent = t.name;
    this.el.themeTag.textContent = t.tagline;
    this.el.themeDots.innerHTML = themes.map((_, i) => `<span class="${i === themeIdx ? 'on' : ''}"></span>`).join('');
    this.el.carName.textContent = c.name;
    this.el.carClass.textContent = c.cls;
    this.el.carBlurb.textContent = c.blurb;
    this.el.carBars.innerHTML = Object.entries(c.bars).map(([k, v]) =>
      `<span>${k.toUpperCase()}</span><div class="bar"><div style="width:${v * 10}%"></div></div>`).join('');
    this.el.carDots.innerHTML = cars.map((_, i) => `<span class="${i === carIdx ? 'on' : ''}"></span>`).join('');
    this.setAccent(t.accent);
  }

  setAccent(hex) { document.documentElement.style.setProperty('--accent', hex); }

  // ---------------------------------------------------------- overlays
  showMenu(best) {
    this.el.menu.classList.remove('hidden');
    this.el.pause.classList.add('hidden');
    this.el.gameover.classList.add('hidden');
    this.el.hud.classList.add('hidden');
    this.el.touch.classList.add('hidden');
    this.el.best.textContent = String(best).padStart(6, '0');
    this.setVignette('');
  }

  showHUD() {
    this.el.menu.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.gameover.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    if (this.isTouch) this.el.touch.classList.remove('hidden');
    for (const [, el] of this.chips) el.remove();
    this.chips.clear();
    this._lastScore = -1; this._lastMult = -1; this._lastDist = -1; this._lastKills = -1; this._lastAmmo = -1; this._lastShield = -1;
  }

  showPause(show) { this.el.pause.classList.toggle('hidden', !show); }

  showGameOver(score, best, isNew, stats) {
    this.el.gameover.classList.remove('hidden');
    this.el.touch.classList.add('hidden');
    this.el.finalScore.textContent = String(score).padStart(6, '0');
    this.el.finalBest.textContent = String(best).padStart(6, '0');
    this.el.newBest.classList.toggle('hidden', !isNew);
    this.el.finalDist.textContent = stats.dist.toFixed(1) + ' km';
    this.el.finalKills.textContent = String(stats.kills);
    this.el.finalTop.textContent = Math.round(stats.top) + ' km/h';
    this.el.finalWorlds.textContent = String(stats.worlds);
    this.setVignette('');
  }

  setMuted(m) { this.el.muteTag.classList.toggle('hidden', !m); }

  themeToast(name) {
    const t = this.el.toast;
    t.classList.add('hidden');
    void t.offsetWidth;
    t.textContent = name;
    t.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add('hidden'), 2700);
  }

  flash() {
    const f = this.el.flash;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  setVignette(cls) {
    if (cls === this._vigClass) return;
    this.el.vignette.className = cls;
    this._vigClass = cls;
  }

  // ---------------------------------------------------------- popups
  popup(text, cls = '', color = null) {
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    d.style.left = (42 + Math.random() * 16) + '%';
    if (color) d.style.setProperty('--pc', color);
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), 1400);
    while (this.el.popups.children.length > 7) this.el.popups.firstChild.remove();
  }

  // ---------------------------------------------------------- HUD
  update(speedKmh, score, mult, nitro01, distKm, nitroActive, hud) {
    const s = Math.round(score);
    if (s !== this._lastScore) { this.el.score.textContent = String(s).padStart(6, '0'); this._lastScore = s; }
    if (mult !== this._lastMult) {
      this.el.mult.textContent = 'x' + mult;
      this.el.mult.classList.toggle('hot', mult > 1);
      this._lastMult = mult;
    }
    this.el.bonusMult.classList.toggle('hidden', hud.bonusMult <= 1);
    const dk = distKm.toFixed(1);
    if (dk !== this._lastDist) { this.el.dist.textContent = dk + ' km'; this._lastDist = dk; }
    if (hud.kills !== this._lastKills) { this.el.kills.textContent = String(hud.kills); this._lastKills = hud.kills; }
    if (hud.ammo !== this._lastAmmo) {
      this.el.ammo.classList.toggle('hidden', hud.ammo <= 0);
      this.el.ammoN.textContent = 'x' + hud.ammo;
      this._lastAmmo = hud.ammo;
    }
    if (hud.shield !== this._lastShield) {
      this.el.shieldTag.classList.toggle('hidden', hud.shield <= 0);
      this.el.shieldN.textContent = 'x' + hud.shield;
      this._lastShield = hud.shield;
    }

    this.el.nitroFill.style.width = (nitro01 * 100).toFixed(1) + '%';
    this.el.nitroBox.classList.toggle('boosting', nitroActive);
    this.el.nitroBox.classList.toggle('mega', hud.mega);
    this.setVignette(hud.vignette || (nitroActive ? 'nitro' : ''));

    // effect chips
    const seen = new Set();
    for (const f of hud.fx) {
      seen.add(f.id);
      let el = this.chips.get(f.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'fx-chip';
        el.style.setProperty('--c', f.color);
        el.innerHTML = `<div>${f.label}</div><div class="bar"><div></div></div>`;
        this.el.fxBar.appendChild(el);
        this.chips.set(f.id, el);
      }
      el.firstElementChild.nextElementSibling.firstElementChild.style.width = (f.t01 * 100).toFixed(0) + '%';
      el.classList.toggle('ending', f.t01 < 0.22);
    }
    for (const [id, el] of this.chips) if (!seen.has(id)) { el.remove(); this.chips.delete(id); }

    this._drawGauge(speedKmh);
  }

  _drawGauge(kmh) {
    const ctx = this.gctx;
    const W = 200, H = 200, cx = 100, cy = 112, r = 78;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f4a261';
    ctx.clearRect(0, 0, W, H);
    const a0 = Math.PI * 0.85, a1 = Math.PI * 2.15;
    ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,12,18,0.6)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 9; ctx.stroke();
    const maxK = 700;
    const t = Math.min(1, kmh / maxK);
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * t);
    ctx.strokeStyle = t > 0.82 ? '#ff4a3a' : accent; ctx.lineWidth = 9; ctx.stroke();
    ctx.strokeStyle = 'rgba(247,214,196,0.75)'; ctx.fillStyle = 'rgba(247,214,196,0.75)';
    ctx.lineWidth = 2; ctx.font = '10px "Chakra Petch", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= 700; v += 100) {
      const a = a0 + (a1 - a0) * (v / maxK);
      const c = Math.cos(a), s2 = Math.sin(a);
      ctx.beginPath(); ctx.moveTo(cx + c * (r - 12), cy + s2 * (r - 12)); ctx.lineTo(cx + c * (r - 4), cy + s2 * (r - 4)); ctx.stroke();
      ctx.fillText(String(v), cx + c * (r - 24), cy + s2 * (r - 24));
    }
    const na = a0 + (a1 - a0) * t;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(na) * 10, cy - Math.sin(na) * 10);
    ctx.lineTo(cx + Math.cos(na) * (r - 16), cy + Math.sin(na) * (r - 16));
    ctx.strokeStyle = '#ffe9d2'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
    ctx.font = 'bold 30px "Chakra Petch", monospace'; ctx.fillStyle = '#ffe9d2';
    ctx.fillText(String(Math.round(kmh)), cx, cy + 42);
    ctx.font = '11px "Chakra Petch", monospace'; ctx.fillStyle = 'rgba(247,214,196,0.6)';
    ctx.fillText('km/h', cx, cy + 60);
  }

  // ---------------------------------------------------------- touch
  _bindTouch() {
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!this.isTouch) return;
    const bind = (id, key) => {
      const el = $(id);
      const on = (e) => { e.preventDefault(); this.input.touch[key] = true; el.classList.add('held'); };
      const off = (e) => { e.preventDefault(); this.input.touch[key] = false; el.classList.remove('held'); };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off, { passive: false });
      el.addEventListener('touchcancel', off, { passive: false });
    };
    bind('t-left', 'left'); bind('t-right', 'right'); bind('t-gas', 'gas');
    bind('t-brake', 'brake'); bind('t-nitro', 'nitro'); bind('t-drift', 'drift');
    const fire = $('t-fire');
    fire.addEventListener('touchstart', (e) => { e.preventDefault(); fire.classList.add('held'); this.input.fire(); }, { passive: false });
    fire.addEventListener('touchend', (e) => { e.preventDefault(); fire.classList.remove('held'); }, { passive: false });
  }
}
