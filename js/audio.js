let ctx = null;

export function initAudio() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
}

function resume() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function tone(freq, duration, type = 'square', volume = 0.08, delay = 0) {
  if (!ctx) return;
  resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

export function playCursor() {
  tone(880, 0.05, 'square', 0.06);
}

export function playConfirm() {
  tone(523, 0.08, 'square', 0.07);
  tone(784, 0.12, 'square', 0.07, 0.06);
}

export function playCancel() {
  tone(392, 0.1, 'square', 0.06);
  tone(294, 0.15, 'square', 0.05, 0.08);
}

export function playAttack() {
  tone(200, 0.05, 'sawtooth', 0.1);
  tone(80, 0.15, 'sawtooth', 0.12, 0.04);
}

export function playMagic() {
  for (let i = 0; i < 5; i++) {
    tone(400 + i * 120, 0.08, 'sine', 0.06, i * 0.05);
  }
}

export function playHit() {
  tone(150, 0.1, 'sawtooth', 0.1);
  tone(60, 0.2, 'sawtooth', 0.08, 0.05);
}

export function playVictory() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => tone(n, 0.2, 'square', 0.07, i * 0.15));
}

export function playDefeat() {
  tone(392, 0.3, 'triangle', 0.08);
  tone(294, 0.4, 'triangle', 0.07, 0.25);
  tone(196, 0.6, 'triangle', 0.06, 0.5);
}

export function playEncounter() {
  tone(220, 0.1, 'square', 0.08);
  tone(165, 0.1, 'square', 0.08, 0.1);
  tone(110, 0.2, 'square', 0.08, 0.2);
}

export function playLevelUp() {
  const notes = [523, 659, 784, 988, 1047];
  notes.forEach((n, i) => tone(n, 0.15, 'square', 0.07, i * 0.1));
}

export function playHeal() {
  tone(600, 0.1, 'sine', 0.06);
  tone(800, 0.15, 'sine', 0.06, 0.08);
  tone(1000, 0.2, 'sine', 0.05, 0.16);
}

export function playStep() {
  tone(300, 0.02, 'triangle', 0.02);
}
