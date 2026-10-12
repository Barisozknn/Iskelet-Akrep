/**
 * Procedural Web Audio synthesizer for tactile scorpion feedback.
 * 100% offline, zero external audio asset dependencies.
 */

let audioCtx: AudioContext | null = null;
let lastFootstepTime = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play an organic, crisp chitinous footstep tap when a leg steps on the ground.
 * Throttled to keep the rhythm pleasant even with 20 legs.
 */
export function playFootstep(volume = 0.08) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Throttle footsteps so it sounds like a rhythmic skitter
    if (now - lastFootstepTime < 0.045) return;
    lastFootstepTime = now;

    // Very short micro-noise burst for claw tap
    const bufferSize = Math.floor(ctx.sampleRate * 0.015); // 15ms
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    // Subtle randomized pitch variation per footstep
    const freq = 1800 + Math.random() * 800;
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.setValueAtTime(5.0, now);

    const gainNode = ctx.createGain();
    const v = volume * (0.8 + Math.random() * 0.4);
    gainNode.gain.setValueAtTime(v, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.018);

    // Subtle micro-resonant tap
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    const tapFreq = 340 + Math.random() * 120;
    osc.frequency.setValueAtTime(tapFreq, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.02);

    oscGain.gain.setValueAtTime(v * 0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.02);
  } catch {
    // Audio contexts can be blocked until user gesture, safely ignore
  }
}

/**
 * Play a sharp chitinous snap sound when pincers clamp shut.
 */
export function playPincerSnap(volume = 0.35) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Quick noise burst for chitin click
    const bufferSize = Math.floor(ctx.sampleRate * 0.05); // 50ms
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.setValueAtTime(4.0, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume * 0.8, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    whiteNoise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.05);

    // Subtle low frequency thump
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.06);

    oscGain.gain.setValueAtTime(volume * 0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    // Safely ignore
  }
}

/**
 * Play a venomous whip/thrust sound when the stinger strikes.
 */
export function playStingerStrike(volume = 0.4) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

    gain.gain.setValueAtTime(volume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch {
    // Safely ignore
  }
}

/**
 * Play a crunchy chitin strike and venom burst sound when a prey is stung.
 */
export function playPreyStruck(volume = 0.5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Crunch noise
    const bufferSize = Math.floor(ctx.sampleRate * 0.08); // 80ms
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.08);

    // Resonant pop/squish tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.09);

    oscGain.gain.setValueAtTime(volume * 0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {
    // Safely ignore
  }
}

/**
 * Trigger subtle device vibration if supported.
 */
export function triggerHaptic(duration = 20) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration);
    } catch {
      // Ignored
    }
  }
}

