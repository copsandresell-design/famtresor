/** Couleur de fin de dégradé pour chaque couleur d'enfant (Lorenzo bleu→cyan, Kelly rose→violet…). */
const GRADIENT_ENDS: Record<string, string> = {
  '#3B82F6': '#06B6D4',
  '#EC4899': '#A855F7',
  '#8B5CF6': '#6366F1',
  '#10B981': '#84CC16',
  '#F97316': '#FBBF24',
  '#06B6D4': '#3B82F6',
  '#F59E0B': '#FBBF24',
}

export function gradientEnd(color: string): string {
  return GRADIENT_ENDS[color] ?? color
}

export function childGradient(color: string): string {
  return `linear-gradient(135deg, ${color}, ${gradientEnd(color)})`
}
