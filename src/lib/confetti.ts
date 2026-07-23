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
