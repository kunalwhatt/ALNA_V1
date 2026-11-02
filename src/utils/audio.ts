// Web Audio API harmonic sound synthesizer for Kintsugi gold mending and porcelain chimes
let audioCtx: AudioContext | null = null;
let ambientOscillators: OscillatorNode[] = [];
let ambientGain: GainNode | null = null;
let isAmbientPlaying = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a resonant, celestial chime simulating molten gold flowing into porcelain cracks
 */
export function playGoldChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const frequencies = [528, 660, 792, 1056]; // Solfeggio golden ratio harmonies

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.06 / (idx + 1), now + idx * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 1.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.8);
    });
  } catch (e) {
    console.debug("Audio play skipped:", e);
  }
}

/**
 * Subtle tactile porcelain click
 */
export function playPorcelainClick() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.06);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch (e) {
    console.debug("Audio click skipped:", e);
  }
}

/**
 * Subtle tactile typewriter key clack
 */
export function playTypewriterClick() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800 + Math.random() * 200, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.035);

    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch (e) {
    // ignore
  }
}

/**
 * Toggles a soothing, meditative ambient frequency (432Hz deep harmonic warmth)
 */
export function toggleAmbientSoundscape(): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (isAmbientPlaying) {
      if (ambientGain) {
        ambientGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
      }
      setTimeout(() => {
        ambientOscillators.forEach((osc) => {
          try {
            osc.stop();
            osc.disconnect();
          } catch (_) {}
        });
        ambientOscillators = [];
        ambientGain = null;
      }, 500);
      isAmbientPlaying = false;
      return false;
    } else {
      const now = ctx.currentTime;
      ambientGain = ctx.createGain();
      ambientGain.gain.setValueAtTime(0.0001, now);
      ambientGain.gain.linearRampToValueAtTime(0.035, now + 1.5);

      // Low harmonic pad: 108Hz, 216Hz, 432Hz
      const chords = [108, 162, 216, 432];
      ambientOscillators = chords.map((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = i % 2 === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(ambientGain!);
        osc.start(now);
        return osc;
      });

      ambientGain.connect(ctx.destination);
      isAmbientPlaying = true;
      return true;
    }
  } catch (e) {
    console.debug("Ambient toggle error:", e);
    return false;
  }
}

export function isAmbientActive(): boolean {
  return isAmbientPlaying;
}
