// Tiny Web Audio API helper for the rest-phase tone.
// Module-level singletons keep the AudioContext alive across calls so we
// never stack overlapping oscillators.

let audioContext: AudioContext | null = null
let oscillator: OscillatorNode | null = null
let gain: GainNode | null = null

function getContext(): AudioContext {
  if (!audioContext) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    audioContext = new Ctor()
  }
  return audioContext
}

export function startRestTone(): void {
  // If a tone is already playing, do nothing.
  if (oscillator) return

  const ctx = getContext()
  const osc = ctx.createOscillator()
  const g = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.value = 440
  g.gain.value = 0.1

  osc.connect(g)
  g.connect(ctx.destination)
  osc.start()

  oscillator = osc
  gain = g
}

export function stopRestTone(): void {
  if (oscillator) {
    try {
      oscillator.stop()
    } catch {
      // already stopped
    }
    oscillator.disconnect()
    oscillator = null
  }
  if (gain) {
    gain.disconnect()
    gain = null
  }
}
