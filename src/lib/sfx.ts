// Tiny WebAudio synth: every sound is generated, no audio files.

let ctx: AudioContext | null = null
let muted = false

export function setMuted(m: boolean) {
  muted = m
}

function audio(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.2, slideTo?: number) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + start
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

function clack(start: number, gain = 0.35) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + start
  const len = Math.floor(a.sampleRate * 0.03)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  const src = a.createBufferSource()
  src.buffer = buf
  const bp = a.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1800 + Math.random() * 2200
  bp.Q.value = 3
  const g = a.createGain()
  g.gain.value = gain
  src.connect(bp).connect(g).connect(a.destination)
  src.start(t)
}

export const sfx = {
  // Make sure the context exists inside a user gesture (iOS needs this).
  unlock: () => void audio(),

  roll(n: number) {
    for (let i = 0; i < 6 + n * 2; i++) clack(Math.random() * 0.45, 0.15 + Math.random() * 0.2)
    for (let i = 0; i < n; i++) clack(0.55 + i * 0.07 + Math.random() * 0.05, 0.4)
  },

  tick: () => tone(1100, 0, 0.05, 'triangle', 0.12),
  untick: () => tone(700, 0, 0.05, 'triangle', 0.1),
  nope: () => tone(160, 0, 0.12, 'square', 0.06),

  bank() {
    tone(988, 0, 0.12, 'square', 0.08)
    tone(1319, 0.08, 0.4, 'square', 0.08)
    tone(2637, 0.08, 0.3, 'sine', 0.05)
  },

  hot() {
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.06, 0.18, 'sawtooth', 0.06))
  },

  // A two-tone bray: "hee" up high, "haw" down low.
  bray() {
    tone(820, 0, 0.22, 'sawtooth', 0.09, 980)
    tone(410, 0.22, 0.45, 'sawtooth', 0.11, 260)
    tone(860, 0.7, 0.18, 'sawtooth', 0.07, 1000)
    tone(400, 0.88, 0.5, 'sawtooth', 0.09, 220)
  },

  win() {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.14))
    tone(1047, 0.5, 0.8, 'triangle', 0.14)
    tone(1319, 0.5, 0.8, 'triangle', 0.1)
  },
}

export function buzz(pattern: number | number[]) {
  if (muted || typeof navigator === 'undefined') return
  navigator.vibrate?.(pattern)
}
