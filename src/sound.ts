// Audio for the rest phase.
// - startRestTone / stopRestTone play an ocean-waves mp3 during the 20-second rest.
// - playChime plays a short bell tone when the rest ends.

let audio: HTMLAudioElement | null = null
let audioContext: AudioContext | null = null

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

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(`${import.meta.env.BASE_URL}ocean-waves.mp3`)
    audio.preload = 'auto'
  }
  return audio
}

export function startRestTone(): void {
  const el = getAudio()
  if (!el.paused) return
  el.currentTime = 0
  void el.play().catch(() => {
    // Autoplay may be blocked in some contexts; silently ignore.
  })
}

export function stopRestTone(): void {
  if (!audio) return
  audio.pause()
  audio.currentTime = 0
}

// Two slightly detuned sine oscillators with an exponential decay envelope —
// gives a soft, bell-like tone instead of a harsh beep.
export function playChime(): void {
  const ctx = getContext()
  const now = ctx.currentTime
  const gain = ctx.createGain()
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.2, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6)

  for (const freq of [880, 1318.5]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(gain)
    osc.start(now)
    osc.stop(now + 1.7)
  }
}
