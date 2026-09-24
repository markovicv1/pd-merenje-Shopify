// Zvučni efekti Z01–Z04 generisani Web Audio API-jem (docs/zvucni-signali.md, sekcija 7).
let ctx = null;

export function unlockSfx() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}

function tone(freq, start, dur, gain = 0.25, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(start); o.stop(start + dur + 0.02);
}

function click(start, dur = 0.04, gain = 0.35) {
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 0.8; g.gain.value = gain;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(start);
}

const run = (fn) => { if (!ctx) return; try { fn(ctx.currentTime + 0.01); } catch { /* bez zvuka */ } };

export const sfx = {
  tick: (last = false) => run((t) => tone(last ? 1500 : 1000, t, 0.09)),       // Z01
  shutter: () => run((t) => { click(t); click(t + 0.07); }),                    // Z02
  success: () => run((t) => { tone(660, t, 0.18, 0.2); tone(990, t + 0.12, 0.35, 0.2); }), // Z03
  error: () => run((t) => { tone(440, t, 0.18, 0.12); tone(330, t + 0.15, 0.25, 0.12); }), // Z04
};

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* nije podržano (iOS) */ }
}
