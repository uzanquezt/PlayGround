const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  KeyJ: 'attack',
  KeyX: 'attack',
  KeyK: 'dash',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyE: 'interact',
  Enter: 'interact',
  Escape: 'pause',
  KeyP: 'pause',
  ArrowDown: 'down',
  KeyS: 'down'
};

const GAME_KEYS = new Set(Object.keys(KEYMAP));

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.virtual = new Set();
    this.virtualPressed = new Set();
    this.onPauseKey = null;

    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const action = KEYMAP[e.code];
      if (!action) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.pressedKeys.add(action);
        if (action === 'pause' && this.onPauseKey) this.onPauseKey();
      }
      this.keys.add(action);
    });

    window.addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      this.keys.delete(action);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.virtual.clear();
    });
  }

  setVirtual(action, down) {
    if (down) {
      if (!this.virtual.has(action)) this.virtualPressed.add(action);
      this.virtual.add(action);
    } else {
      this.virtual.delete(action);
    }
  }

  isDown(action) {
    return this.keys.has(action) || this.virtual.has(action);
  }

  pressed(action) {
    return this.pressedKeys.has(action) || this.virtualPressed.has(action);
  }

  axis() {
    return (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
  }

  clearFrame() {
    this.pressedKeys.clear();
    this.virtualPressed.clear();
  }
}

export function bindTouchControls() {
  const buttons = document.querySelectorAll('[data-action]');
  buttons.forEach((button) => {
    const action = button.dataset.action;
    const press = (e) => {
      e.preventDefault();
      button.classList.add('active');
      if (button.setPointerCapture) {
        try {
          button.setPointerCapture(e.pointerId);
        } catch {}
      }
      window.game?.input.setVirtual(action, true);
    };
    const release = (e) => {
      e.preventDefault();
      button.classList.remove('active');
      window.game?.input.setVirtual(action, false);
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}
