let ctx = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

export function primeAudio() {
  const c = ensure();
  if (c?.state === 'suspended') c.resume();
}

function tone(freq, dur, type = 'square', vol = 0.08, when = 0) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function arp(notes, step = 0.07, type = 'square', vol = 0.06) {
  notes.forEach((n, i) => tone(n, step * 0.9, type, vol, i * step));
}

export function sfxCursor() {
  tone(660, 0.05, 'square', 0.05);
}

export function sfxBack() {
  tone(280, 0.08, 'triangle', 0.05);
}

export function sfxConfirm() {
  arp([523, 659, 784], 0.06);
}

export function sfxStep() {
  tone(180, 0.03, 'triangle', 0.02);
}

export function sfxHit() {
  arp([220, 160, 110], 0.05, 'sawtooth', 0.07);
}

export function sfxMagic() {
  arp([440, 554, 659, 880], 0.05, 'sine', 0.06);
}

export function sfxHeal() {
  arp([523, 659, 784, 1047], 0.06, 'sine', 0.05);
}

export function sfxEncounter() {
  arp([110, 98, 87, 73], 0.12, 'sawtooth', 0.08);
}

export function sfxVictory() {
  arp([523, 659, 784, 1047, 1319], 0.1, 'square', 0.06);
}

export function sfxDefeat() {
  arp([392, 330, 262, 196], 0.15, 'triangle', 0.06);
}

export function sfxFlee() {
  arp([440, 392, 349, 294], 0.07, 'triangle', 0.04);
}
