import { hashSecret, makeSalt } from '../lib/crypto'
import { uid } from '../lib/id'
import type { Settings, Task, User } from '../types'

export const DEFAULT_SECRETS: Record<string, string> = {
  Marion: 'parent',
  Julien: 'parent',
  Lorenzo: '1111',
  Kelly: '2222',
}

async function makeUser(
  base: Omit<User, 'id' | 'secretHash' | 'secretSalt' | 'usesDefaultSecret' | 'createdAt' | 'isActive'>,
  secret: string,
): Promise<User> {
  const secretSalt = makeSalt()
  return {
    ...base,
    id: uid(),
    secretHash: await hashSecret(secret, secretSalt),
    secretSalt,
    usesDefaultSecret: true,
    createdAt: Date.now(),
    isActive: true,
  }
}

export async function seedUsers(): Promise<User[]> {
  return Promise.all([
    makeUser(
      { role: 'parent', name: 'Marion', email: 'marion@famtresor.family', avatar: '🌸', color: '#F59E0B' },
      DEFAULT_SECRETS.Marion,
    ),
    makeUser(
      { role: 'parent', name: 'Julien', email: 'julien@famtresor.family', avatar: '🎸', color: '#F59E0B' },
      DEFAULT_SECRETS.Julien,
    ),
    makeUser(
      { role: 'child', name: 'Lorenzo', avatar: '⚡', color: '#3B82F6' },
      DEFAULT_SECRETS.Lorenzo,
    ),
    makeUser(
      { role: 'child', name: 'Kelly', avatar: '🌈', color: '#EC4899' },
      DEFAULT_SECRETS.Kelly,
    ),
  ])
}

// Catalogue canonique (16 tâches) : mêmes titres/points que la migration de la famille de
// production (voir supabase/migrations) — une nouvelle famille démarre avec le même barème.
export function seedTasks(users: User[]): Task[] {
  const parent = users.find((u) => u.role === 'parent')!
  const children = users.filter((u) => u.role === 'child').map((u) => u.id)
  const base = {
    assignedTo: children,
    createdBy: parent.id,
    createdAt: Date.now(),
    isActive: true,
    type: 'recurrente' as const,
  }
  return [
    // Quotidiennes
    { ...base, id: uid(), title: 'Vider le lave-vaisselle', points: 10, category: 'cuisine', icon: '🍽️', difficulty: 'easy', recurrence: { frequency: 'daily' } },
    { ...base, id: uid(), title: 'Remplir le lave-vaisselle', points: 10, category: 'cuisine', icon: '🫧', difficulty: 'easy', recurrence: { frequency: 'daily' } },
    { ...base, id: uid(), title: 'Mettre la table', points: 10, category: 'cuisine', icon: '🍽️', difficulty: 'easy', recurrence: { frequency: 'daily' } },
    { ...base, id: uid(), title: 'Débarrasser et essuyer la table', points: 10, category: 'cuisine', icon: '🧽', difficulty: 'easy', recurrence: { frequency: 'daily' } },
    { ...base, id: uid(), title: 'Ranger le canapé', points: 8, category: 'rangement', icon: '🛋️', difficulty: 'easy', recurrence: { frequency: 'daily' } },
    { ...base, id: uid(), title: 'Ranger chaussures et sac à l’entrée', points: 8, category: 'rangement', icon: '👟', difficulty: 'easy', recurrence: { frequency: 'daily' } },
    // 2× par semaine
    { ...base, id: uid(), title: 'Vider les poubelles', points: 20, category: 'menage', icon: '🗑️', difficulty: 'easy', recurrence: { frequency: 'twice-weekly' } },
    { ...base, id: uid(), title: 'Ramasser le linge', points: 25, category: 'linge', icon: '👕', difficulty: 'easy', recurrence: { frequency: 'twice-weekly' } },
    { ...base, id: uid(), title: 'Étendre le linge', points: 30, category: 'linge', icon: '🧺', difficulty: 'medium', recurrence: { frequency: 'twice-weekly' } },
    { ...base, id: uid(), title: 'Réviser 15 minutes une leçon', points: 30, category: 'devoirs', icon: '✏️', difficulty: 'medium', recurrence: { frequency: 'twice-weekly' } },
    { ...base, id: uid(), title: "Faire ses devoirs sans qu'on le demande", points: 35, category: 'devoirs', icon: '📚', difficulty: 'medium', recurrence: { frequency: 'twice-weekly' } },
    // Hebdomadaires
    { ...base, id: uid(), title: 'Arroser les plantes', points: 25, category: 'autre', icon: '🌱', difficulty: 'easy', recurrence: { frequency: 'weekly', dayOfWeek: 0 } },
    { ...base, id: uid(), title: 'Passer la pièce', points: 45, category: 'menage', icon: '🪣', difficulty: 'medium', recurrence: { frequency: 'weekly', dayOfWeek: 2 } },
    { ...base, id: uid(), title: "Passer l'aspirateur", points: 55, category: 'menage', icon: '🧹', difficulty: 'medium', recurrence: { frequency: 'weekly', dayOfWeek: 5 } },
    { ...base, id: uid(), title: 'Ranger sa chambre', points: 60, category: 'rangement', icon: '🛏️', difficulty: 'hard', recurrence: { frequency: 'weekly', dayOfWeek: 6 } },
    { ...base, id: uid(), title: 'Aider à préparer le repas', points: 75, category: 'cuisine', icon: '🍳', difficulty: 'hard', recurrence: { frequency: 'weekly', dayOfWeek: 4 } },
  ]
}

export const defaultSettings: Settings = {
  familyName: 'FamTrésor',
  initiativeBonus: 15,
  minBalance: -1000,
  theme: 'dark',
  features: {
    savingsGoals: true,
    streaks: true,
    leaderboard: true,
    shop: true,
    inactivityPenalties: false,
    recurringPenalties: true,
  },
  pointsPerEuro: 100,
  inactivityPenalty: {
    thresholdDays: 1,
    baseAmountCents: 50,
    baseAmountPoints: 0,
    applyMoney: true,
    applyPoints: false,
    severityMultiplier: 1,
  },
}
