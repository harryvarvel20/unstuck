/**
 * Gentle looped ambient focus sound, generated with WebAudio (soft filtered
 * brown noise — like distant rain). No audio assets to load, loops
 * seamlessly, and only ever starts from a user gesture. Off by default.
 */

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;

export function isAmbientPlaying(): boolean {
  return source !== null;
}

export function startAmbient(): void {
  if (typeof window === "undefined" || source) return;
  try {
    ctx = ctx ?? new AudioContext();
    void ctx.resume();

    // 6 seconds of brown noise, looped.
    const seconds = 6;
    const rate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    // Crossfade-free loop: taper the seam slightly.
    const fade = Math.floor(rate * 0.05);
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      const startIdx = i;
      const endIdx = data.length - fade + i;
      const a = data[startIdx] ?? 0;
      const b = data[endIdx] ?? 0;
      data[startIdx] = a * k;
      data[endIdx] = b * (1 - k);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;

    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1.2);

    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
  } catch {
    /* audio unavailable — silently do nothing */
  }
}

export function stopAmbient(): void {
  try {
    if (gain && ctx) {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    }
    const s = source;
    source = null;
    window.setTimeout(() => {
      try {
        s?.stop();
        s?.disconnect();
      } catch {
        /* noop */
      }
    }, 500);
  } catch {
    /* noop */
  }
}
