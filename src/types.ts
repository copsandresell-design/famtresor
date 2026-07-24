// Tous les montants sont stockés en centimes (entiers) pour éviter les erreurs de flottants.

export type Role = 'parent' | 'child'
export type Category = 'cuisine' | 'menage' | 'linge' | 'rangement' | 'devoirs' | 'autre'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Frequency = 'daily' | 'twice-weekly' | 'weekly' | 'monthly'
export type TaskType = 'ponctuelle' | 'recurrente'
export type SubmissionStatus = 'pending' | 'approved' | 'rejected'
export type TransactionType = 'task_approval' | 'penalty' | 'penalty_cancel' | 'manual_adjustment'
export type Theme = 'light' | 'dark' | 'auto'

export interface User {
  id: string
  role: Role
  name: string
  email?: string
  secretHash: string
  secretSalt: string
  usesDefaultSecret: boolean
  avatar: string
  photoId?: string
  color: string
  createdAt: number
  isActive: boolean
}

export interface Recurrence {
  frequency: Frequency
  /** 0 = lundi … 6 = dimanche */
  dayOfWeek?: number
  /** 1–28 */
  dayOfMonth?: number
}

export interface Task {
  id: string
  title: string
  description?: string
  amount: number
  category: Category
  icon: string
  type: TaskType
  recurrence?: Recurrence
  assignedTo: string[]
  difficulty: Difficulty
  dueDate?: number
  createdBy: string
  createdAt: number
  isActive: boolean
}

export interface TaskSubmission {
  id: string
  taskId: string
  childId: string
  status: SubmissionStatus
  isInitiative: boolean
  photoIds?: string[]
  comment?: string
  submittedAt: number
  reviewedAt?: number
  reviewedBy?: string
  rejectionReason?: string
  bonusApplied: boolean
}

export interface Message {
  id: string
  fromId: string
  toChildId: string
  text: string
  createdAt: number
}

export interface Transaction {
  id: string
  type: TransactionType
  childId: string
  amount: number
  description: string
  relatedTo?: string
  cancelled?: boolean
  createdBy: string
  createdAt: number
}

export interface AuditLog {
  id: string
  action: string
  actorId: string
  subjectId?: string
  amount?: number
  details: string
  timestamp: number
}

export interface Settings {
  familyName: string
  initiativeBonus: number
  minBalance: number
  theme: Theme
}

export interface Session {
  userId: string
  role: Role
  expiresAt: number
}

export type NotificationType =
  | 'task_assigned'
  | 'task_submitted'
  | 'task_approved'
  | 'task_rejected'
  | 'message'
  | 'penalty'

export interface AppNotification {
  id: string
  /** Destinataire */
  userId: string
  /** Nom du destinataire — les ids diffèrent entre appareils, le nom est stable */
  userName?: string
  type: NotificationType
  title: string
  message: string
  icon: string
  read: boolean
  createdAt: number
  /** Route interne à ouvrir au clic */
  link?: string
}
