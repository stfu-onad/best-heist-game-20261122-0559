// MIDNIGHT VAULT — keyboard and mouse.
// WASD or arrows walk, Shift sneaks, Q tosses a coin at the mouse, Space
// or a click confirms on the menus, and a click on the floor sets a walk
// target. The game never reads a key the browser needs for its own UI.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_COIN = 4;

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let coinAt = null;
  let clickTarget = null;
  let mouse = { x: 0, y: 0 };

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 800,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyQ') {
      actions |= ACTION_COIN;
      coinAt = { ...mouse };
    }
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('mousemove', (event) => { mouse = canvasPoint(event); });
  canvas.addEventListener('mousedown', (event) => {
    const point = canvasPoint(event);
    mouse = point;
    clickTarget = point;
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Normalised walk direction from the held keys, or null. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const step = MOVE_KEYS[code];
        if (step) { x += step[0]; y += step[1]; }
      }
      if (x === 0 && y === 0) return null;
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    sneaking() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    /** The floor point the last click asked the thief to walk to. */
    clickTarget() { return clickTarget; },
    clearClickTarget() { clickTarget = null; },
    mouse() { return mouse; },
    takeCoinTarget() {
      if (!(actions & ACTION_COIN)) return null;
      actions &= ~ACTION_COIN;
      return coinAt;
    },
    takeActions() {
      // Confirm and pause are consumed here; the coin bit is left for
      // takeCoinTarget, which reads it with the step that throws the coin.
      const taken = actions & (ACTION_CONFIRM | ACTION_PAUSE);
      actions &= ~(ACTION_CONFIRM | ACTION_PAUSE);
      return taken;
    },
  };
}
