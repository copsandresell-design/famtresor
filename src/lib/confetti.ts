import confetti from 'canvas-confetti'

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function celebrate(colors?: string[]): void {
  if (prefersReducedMotion()) return
  void confetti({
    particleCount: 120,
    spread: 75,
    origin: { y: 0.65 },
    colors: colors ?? ['#FBBF24', '#3B82F6', '#EC4899', '#10B981'],
  })
}

/**
 * Feu d'artifice plein écran (~2,5s, tirs alternés gauche/droite toutes les 250ms) : réservé
 * aux moments forts (tâche validée en temps réel côté enfant, badge débloqué). `celebrate()`
 * reste le petit burst pour les actions ponctuelles côté parent.
 */
export function celebrateFireworks(colors?: string[]): void {
  if (prefersReducedMotion()) return
  const palette = colors ?? ['#FBBF24', '#3B82F6', '#EC4899', '#10B981', '#8B5CF6']
  const duration = 2500
  const end = Date.now() + duration

  void confetti({ particleCount: 140, spread: 100, origin: { y: 0.6 }, colors: palette, scalar: 1.2 })

  const interval = setInterval(() => {
    const timeLeft = end - Date.now()
    if (timeLeft <= 0) {
      clearInterval(interval)
      return
    }
    const particleCount = Math.round(50 * (timeLeft / duration))
    void confetti({
      particleCount,
      startVelocity: 55,
      spread: 65,
      origin: { x: Math.random() * 0.2, y: Math.random() * 0.4 + 0.4 },
      colors: palette,
    })
    void confetti({
      particleCount,
      startVelocity: 55,
      spread: 65,
      origin: { x: 0.8 + Math.random() * 0.2, y: Math.random() * 0.4 + 0.4 },
      colors: palette,
    })
  }, 250)
}
