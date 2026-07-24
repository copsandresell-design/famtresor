// Petits sons de notification via Web Audio (aucun fichier audio à charger).

type SoundKind = 'success' | 'error' | 'default'

const TONES: Record<SoundKind, { freq: number; gain: number; duration: number }> = {
  success: { freq: 600, gain: 0.3, duration: 0.3 },
  error: { freq: 400, gain: 0.2, duration: 0.2 },
  default: { freq: 500, gain: 0.1, duration: 0.15 },
}

export function playNotificationSound(kind: SoundKind = 'default'): void {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new Ctx()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    const { freq, gain, duration } = TONES[kind]
    oscillator.frequency.value = freq
    gainNode.gain.setValueAtTime(gain, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)
  } catch {
    // Web Audio indisponible : on reste silencieux.
  }
}
