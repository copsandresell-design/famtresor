import type { ShopCategory } from '../types'

export const SHOP_CATEGORIES: Record<ShopCategory, { label: string; emoji: string }> = {
  cinema: { label: 'Ciné', emoji: '🎬' },
  resto: { label: 'Resto', emoji: '🍔' },
  jeu_video: { label: 'Jeu vidéo', emoji: '🎮' },
  sortie: { label: 'Sortie', emoji: '🎡' },
  ecran: { label: 'Temps d’écran', emoji: '📱' },
  cadeau: { label: 'Cadeau', emoji: '🎁' },
}

export const SHOP_CATEGORY_KEYS = Object.keys(SHOP_CATEGORIES) as ShopCategory[]

/** Icônes prédéfinies par catégorie — pas d'upload de photo, pas de génération IA. */
export const SHOP_ICON_LIBRARY: Record<ShopCategory, string[]> = {
  cinema: ['🎬', '🍿', '🎟️', '📽️'],
  resto: ['🍔', '🍕', '🍦', '🍟', '🌮'],
  jeu_video: ['🎮', '🕹️', '👾', '🎯'],
  sortie: ['🎡', '🎳', '🏊', '🎢', '🛼'],
  ecran: ['📱', '💻', '📺', '⏱️'],
  cadeau: ['🎁', '🧸', '📚', '🎨'],
}

/** Exemples suggérés au parent lors de la création d'un lot. */
export const SHOP_EXAMPLES: { title: string; category: ShopCategory; icon: string }[] = [
  { title: 'Soirée ciné', category: 'cinema', icon: '🎬' },
  { title: 'Repas au McDo', category: 'resto', icon: '🍔' },
  { title: '1h de jeu vidéo bonus', category: 'ecran', icon: '📱' },
  { title: 'Sortie au choix', category: 'sortie', icon: '🎡' },
]
