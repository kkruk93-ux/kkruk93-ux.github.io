// Optional sound: a synthesized ship hum + UI blips + Shadow's caw. Off by default; no audio files.
let ctx = null, master = null, hum = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function startHum() {
  const c = ensure(); if (!c) return;
  const out = c.createGain(); out.gain.value = 0; out.connect(master);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 6; lp.connect(out);
  const oscs = [[55, 'sawtooth', .5], [55.35, 'sawtooth', .5], [82.4, 'sine', .35], [27.5, 'sine', .8]].map(([f, t, g]) => {
    const o = c.createOscillator(); o.type = t; o.frequency.value = f;
    const gg = c.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(lp); o.start(); return o;
  });
  const lfo = c.createOscillator(); lfo.frequency.value = 0.06;
  const lfoG = c.createGain(); lfoG.gain.value = 70; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
  // air / vent hiss
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const n = c.createBufferSource(); n.buffer = buf; n.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = .7;
  const ng = c.createGain(); ng.gain.value = 0.012; n.connect(bp); bp.connect(ng); ng.connect(out); n.start();
  out.gain.linearRampToValueAtTime(0.11, c.currentTime + 2.5);
  hum = { out, nodes: [...oscs, lfo, n] };
}
function stopHum() {
  if (!hum || !ctx) return;
  const h = hum; hum = null;
  h.out.gain.cancelScheduledValues(ctx.currentTime);
  h.out.gain.setValueAtTime(h.out.gain.value, ctx.currentTime);
  h.out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  setTimeout(() => h.nodes.forEach((o) => { try { o.stop(); } catch {} }), 800);
}

export const Sound = {
  on: false,
  async toggle() {
    this.on = !this.on;
    if (this.on) { startHum(); this.blip(880, .06); } else stopHum();
    return this.on;
  },
  blip(freq = 660, dur = 0.05) {
    if (!this.on || !ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur + 0.02);
  },
  caw() {
    if (!this.on || !ctx) return;
    [0, 0.28].forEach((t0) => {
      const t = ctx.currentTime + t0;
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(980, t); o.frequency.exponentialRampToValueAtTime(430, t + 0.22);
      f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 3;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.26);
    });
  },
};
