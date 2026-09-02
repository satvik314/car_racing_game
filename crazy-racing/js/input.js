// Keyboard + touch input, mapped to simple polled flags + discrete actions.
export class Input {
  constructor() {
    this.keys = Object.create(null);
    this.touch = { left: false, right: false, gas: false, brake: false, nitro: false, drift: false };
    this.onAction = null; // (action: 'enter'|'pause'|'mute') => void

    window.addEventListener('keydown', (e) => {
      if (e.repeat) { this._prevent(e); return; }
      this.keys[e.code] = true;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') this._action('enter');
      else if (e.code === 'KeyP' || e.code === 'Escape') this._action('pause');
      else if (e.code === 'KeyM') this._action('mute');
      this._prevent(e);
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = Object.create(null); });
  }

  _prevent(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }

  _action(a) { if (this.onAction) this.onAction(a); }

  // Pollable state ----------------------------------------------------
  get steer() {
    const l = this.keys['ArrowLeft'] || this.keys['KeyA'] || this.touch.left;
    const r = this.keys['ArrowRight'] || this.keys['KeyD'] || this.touch.right;
    return (r ? 1 : 0) - (l ? 1 : 0);
  }
  get gas()   { return !!(this.keys['ArrowUp'] || this.keys['KeyW'] || this.touch.gas); }
  get brake() { return !!(this.keys['ArrowDown'] || this.keys['KeyS'] || this.touch.brake); }
  get drift() { return !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.touch.drift); }
  get nitro() { return !!(this.keys['Space'] || this.touch.nitro); }
}
