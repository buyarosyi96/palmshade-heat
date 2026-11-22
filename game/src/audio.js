export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, engineFilter = null, sirenOsc = null, sirenGain = null, musicTimer = null, muted = false, sirenNear = false, sirenFlip = 0;
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }
  function tone(freq, dur, type, vol, when) {
    if (!ensure()) return;
    try {
      const t = (when || ctx.currentTime);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  function startMusic() {
    if (!ctx || musicTimer) return;
    const bass = [55, 55, 65.4, 49];
    let i = 0;
    const tick = () => {
      if (!ctx) return;
      tone(bass[i % bass.length], 1.6, 'triangle', 0.12);
      tone(bass[i % bass.length] * 4, 1.8, 'sine', 0.04);
      i++;
    };
    tick();
    musicTimer = setInterval(tick, 1900);
  }
  return {
    unlock() { if (ensure()) { try { ctx.resume(); } catch (e) {} startMusic(); } },
    setEngine(on, speedNorm) {
      if (!ensure()) return;
      try {
        if (on && !engineOsc) {
          engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
          engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
          engineGain = ctx.createGain(); engineGain.gain.value = 0.05;
          engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
          engineOsc.start();
        }
        if (!on && engineOsc) { try { engineOsc.stop(); } catch (e) {} engineOsc = null; }
        if (engineOsc) { engineOsc.frequency.value = 52 + Math.abs(speedNorm || 0) * 130; engineFilter.frequency.value = 280 + Math.abs(speedNorm || 0) * 700; }
      } catch (e) {}
    },
    setSiren(near) {
      sirenNear = !!near;
      if (!ensure()) return;
      try {
        if (near && !sirenOsc) {
          sirenOsc = ctx.createOscillator(); sirenOsc.type = 'square';
          sirenGain = ctx.createGain(); sirenGain.gain.value = 0.028;
          sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
          sirenFlip = setInterval(() => { if (sirenOsc) sirenOsc.frequency.value = sirenOsc.frequency.value > 700 ? 620 : 880; }, 380);
        }
        if (!near && sirenOsc) { try { sirenOsc.stop(); } catch (e) {} sirenOsc = null; clearInterval(sirenFlip); }
      } catch (e) {}
    },
    blip(freq) { tone(freq || 660, 0.09, 'square', 0.08); },
    cash() { tone(880, 0.1, 'sine', 0.14); setTimeout(() => tone(1320, 0.14, 'sine', 0.12), 60); },
    gunshot() {
      if (!ensure()) return;
      try {
        const dur = 0.12, buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const g = ctx.createGain(); g.gain.value = 0.35;
        src.connect(g); g.connect(master); src.start();
      } catch (e) {}
    },
    thud() { tone(90, 0.12, 'sine', 0.22); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get muted() { return muted; },
  };
}
