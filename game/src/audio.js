// MIDNIGHT VAULT — every sound is a synthesised oscillator, no audio files.
// The context starts on the first key or click, so a silent page load
// stays silent and a headless screenshot run never throws.

export function createAudio() {
  let context = null;
  let master = null;
  let alarmTimer = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    }
    try {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  /** One short tone: frequency, seconds, wave shape, and a volume slide. */
  function tone(freq, dur, type, volume, slideTo) {
    const ctx = ensure();
    if (!ctx || !master) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // Audio is decoration; a failure here must never stop the game.
    }
  }

  /** A soft filtered-noise tick, used for footsteps. */
  function tick(volume) {
    const ctx = ensure();
    if (!ctx || !master) return;
    try {
      const length = Math.floor(ctx.sampleRate * 0.05);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // Decoration only.
    }
  }

  return {
    unlock() { ensure(); },
    pickup() { tone(880, 0.09, 'sine', 0.5); setTimeout(() => tone(1318, 0.14, 'sine', 0.5), 70); },
    vault() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.5), i * 90));
    },
    coin() { tone(2093, 0.06, 'square', 0.25); setTimeout(() => tone(1568, 0.08, 'square', 0.2), 60); },
    spotted() { tone(220, 0.18, 'sawtooth', 0.35, 330); },
    alarmLoop(on) {
      if (!on) return;
      const now = performance.now();
      if (now - alarmTimer < 900) return;
      alarmTimer = now;
      tone(620, 0.22, 'square', 0.18);
      setTimeout(() => tone(470, 0.22, 'square', 0.18), 240);
    },
    caught() {
      [392, 311, 233, 175].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.4), i * 110));
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.45), i * 110));
    },
    lose() { tone(196, 0.7, 'sawtooth', 0.35, 98); },
    step() { tick(0.12); },
    click() { tone(660, 0.05, 'sine', 0.3); },
  };
}
