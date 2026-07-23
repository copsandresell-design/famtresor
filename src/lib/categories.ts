import type { Category, Difficulty } from '../types'

export const CATEGORIES: Record<Category, { label: string; emoji: string; color: string }> = {
  cuisine: { label: 'Cuisine', emoji: '🍳', color: '#F97316' },
  menage: { label: 'Ménage', emoji: '🧹', color: '#3B82F6' },
  linge: { label: 'Linge', emoji: '🧺', color: '#06B6D4' },
  rangement: { label: 'Rangement', emoji: '🧸', color: '#8B5CF6' },
  devoirs: { label: 'Devoirs', emoji: '📚', color: '#10B981' },
  autre: { label: 'Autre', emoji: '✨', color: '#64748B' },
}

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[]

export const DIFFICULTIES: Record<Difficulty, { label: string; dots: number }> = {
  easy: { label: 'Facile', dots: 1 },
  medium: { label: 'Moyen', dots: 2 },
  hard: { label: 'Difficile', dots: 3 },
}

export const TASK_EMOJIS = [
  '🍽️', '🍳', '🫧', '🧹', '🗑️', '🧺', '👕', '🛋️', '🛏️', '🧸',
  '📚', '✏️', '🐕', '🌱', '🚗', '🛒', '🥗', '🧽', '🪟', '👟',
  '♻️', '🧦', '🪥', '⭐',
]

export const AVATAR_EMOJIS = [
  '⚡', '🌈', '🦁', '🦄', '🐯', '🐼', '🦊', '🐸', '🚀', '⚽',
  '🎮', '🎸', '🎨', '🌸', '🔥', '🐬', '😎', '🤖', '👑', '🍕',
]
