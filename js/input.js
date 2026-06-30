const held = new Set();
const pulse = new Set();

const keyMap = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Enter: 'ok',
  Space: 'ok',
  KeyZ: 'ok',
  Escape: 'back',
  KeyX: 'back',
};

export function bootInput() {
  window.addEventListener('keydown', e => {
    const k = keyMap[e.code];
    if (!k) return;
    e.preventDefault();
    if (!held.has(k)) pulse.add(k);
    held.add(k);
  });

  window.addEventListener('keyup', e => {
    const k = keyMap[e.code];
    if (k) held.delete(k);
  });

  const pad = document.getElementById('mobile-pad');
  const bind = (el, key, down) => {
    el.addEventListener(down ? 'touchstart' : 'touchend', e => {
      e.preventDefault();
      if (down) {
        if (!held.has(key)) pulse.add(key);
        held.add(key);
      } else {
        held.delete(key);
      }
    });
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      if (!held.has(key)) pulse.add(key);
      held.add(key);
    });
    el.addEventListener('mouseup', () => held.delete(key));
    el.addEventListener('mouseleave', () => held.delete(key));
  };

  pad.querySelectorAll('[data-dir]').forEach(btn => bind(btn, btn.dataset.dir, true));
  pad.querySelectorAll('[data-dir]').forEach(btn => bind(btn, btn.dataset.dir, false));
  bind(document.getElementById('btn-a'), 'ok', true);
  bind(document.getElementById('btn-a'), 'ok', false);
}

export function down(key) {
  return held.has(key);
}

export function tap(key) {
  return pulse.has(key);
}

export function flushTaps() {
  pulse.clear();
}

export function dirVector() {
  if (tap('up') || down('up')) return { x: 0, y: -1, face: 'up' };
  if (tap('down') || down('down')) return { x: 0, y: 1, face: 'down' };
  if (tap('left') || down('left')) return { x: -1, y: 0, face: 'left' };
  if (tap('right') || down('right')) return { x: 1, y: 0, face: 'right' };
  return null;
}
