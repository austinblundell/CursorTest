const keys = {};
const justPressed = new Set();
const touchDir = { up: false, down: false, left: false, right: false };
let actionPressed = false;
let actionJustPressed = false;

export function initInput() {
  window.addEventListener('keydown', e => {
    if (!keys[e.code]) justPressed.add(e.code);
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.code] = false;
  });

  const dpad = document.querySelector('.dpad');
  const actionBtn = document.getElementById('action-btn');

  function bindTouch(btn, onStart, onEnd) {
    btn.addEventListener('touchstart', e => { e.preventDefault(); onStart(); });
    btn.addEventListener('touchend', e => { e.preventDefault(); onEnd(); });
    btn.addEventListener('mousedown', e => { e.preventDefault(); onStart(); });
    btn.addEventListener('mouseup', e => { e.preventDefault(); onEnd(); });
    btn.addEventListener('mouseleave', e => { e.preventDefault(); onEnd(); });
  }

  dpad.querySelectorAll('button[data-dir]').forEach(btn => {
    const dir = btn.dataset.dir;
    bindTouch(btn, () => { touchDir[dir] = true; }, () => { touchDir[dir] = false; });
  });

  bindTouch(actionBtn, () => { actionPressed = true; actionJustPressed = true; }, () => { actionPressed = false; });
}

export function updateInput() {
  // frame bookkeeping handled in isPressed
}

export function isDown(code) {
  if (code === 'ArrowUp') return keys['ArrowUp'] || keys['KeyW'] || touchDir.up;
  if (code === 'ArrowDown') return keys['ArrowDown'] || keys['KeyS'] || touchDir.down;
  if (code === 'ArrowLeft') return keys['ArrowLeft'] || keys['KeyA'] || touchDir.left;
  if (code === 'ArrowRight') return keys['ArrowRight'] || keys['KeyD'] || touchDir.right;
  if (code === 'Enter') return keys['Enter'] || keys['Space'] || keys['KeyZ'] || actionPressed;
  if (code === 'Cancel') return keys['Escape'] || keys['KeyX'] || keys['Backspace'];
  return keys[code];
}

export function isPressed(code) {
  let result = false;
  if (code === 'ArrowUp') result = justPressed.has('ArrowUp') || justPressed.has('KeyW') || touchDir.up;
  else if (code === 'ArrowDown') result = justPressed.has('ArrowDown') || justPressed.has('KeyS') || touchDir.down;
  else if (code === 'ArrowLeft') result = justPressed.has('ArrowLeft') || justPressed.has('KeyA') || touchDir.left;
  else if (code === 'ArrowRight') result = justPressed.has('ArrowRight') || justPressed.has('KeyD') || touchDir.right;
  else if (code === 'Enter') result = justPressed.has('Enter') || justPressed.has('Space') || justPressed.has('KeyZ') || actionJustPressed;
  else if (code === 'Cancel') result = justPressed.has('Escape') || justPressed.has('KeyX') || justPressed.has('Backspace');
  else result = justPressed.has(code);

  return result;
}

export function clearInput() {
  justPressed.clear();
  actionJustPressed = false;
  Object.keys(touchDir).forEach(k => { touchDir[k] = false; });
}

export function clearJustPressed() {
  justPressed.clear();
  actionJustPressed = false;
}
