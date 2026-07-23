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
    { ...base, id: uid(), title: 'Remplir le lave-vaisselle', amount: 150, category: 'cuisine', icon: '🍽️', difficulty: 'easy', recurrence: { frequency: 'daily' } },
    { ...base, id: uid(), title: 'Vider le lave-vaisselle', amount: 150, category: 'cuisine', icon: '🫧', difficulty: 'easy', recurrence: { frequency: 'daily' } },
    { ...base, id: uid(), title: "Passer l'aspirateur", amount: 200, category: 'menage', icon: '🧹', difficulty: 'medium', recurrence: { frequency: 'weekly', dayOfWeek: 5 } },
    { ...base, id: uid(), title: 'Vider les poubelles', amount: 100, category: 'menage', icon: '🗑️', difficulty: 'easy', recurrence: { frequency: 'twice-weekly' } },
    { ...base, id: uid(), title: 'Étendre le linge', amount: 200, category: 'linge', icon: '🧺', difficulty: 'medium', recurrence: { frequency: 'twice-weekly' } },
    { ...base, id: uid(), title: 'Ramasser le linge', amount: 200, category: 'linge', icon: '👕', difficulty: 'easy', recurrence: { frequency: 'twice-weekly' } },
    { ...base, id: uid(), title: 'Ranger le canapé', amount: 100, category: 'rangement', icon: '🛋️', difficulty: 'easy', recurrence: { frequency: 'daily' } },
  ]
}

export const defaultSettings: Settings = {
  familyName: 'FamTrésor',
  initiativeBonus: 50,
  minBalance: -1000,
  theme: 'dark',
}
