import { create } from 'zustand'
import { db, load, save } from '../db/storage'
import { defaultSettings, seedTasks, seedUsers } from '../db/seed'
import { computeBalance } from '../lib/balance'
import { hashSecret, makeSalt, verifySecret } from '../lib/crypto'
import { formatEuro } from '../lib/format'
import { uid } from '../lib/id'
import { broadcastNotification } from '../lib/realtime'
import { isTaskAvailable } from '../lib/recurrence'
import type {
  AppNotification,
  AuditLog,
  Message,
  NotificationType,
  Session,
  Settings,
  Task,
  TaskSubmission,
  Transaction,
  User,
} from '../types'

export const SESSION_DURATION = 30 * 60 * 1000
export const PENALTY_CANCEL_WINDOW = 24 * 60 * 60 * 1000
const MAX_LOGS = 2000
const MAX_NOTIFICATIONS = 200

export interface Toast {
  id: number
  message: string
  kind: 'success' | 'error'
}

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'createdBy' | 'isActive'> & { id?: string }

interface Store {
  ready: boolean
  users: User[]
  tasks: Task[]
  submissions: TaskSubmission[]
  transactions: Transaction[]
  logs: AuditLog[]
  messages: Message[]
  notifications: AppNotification[]
  settings: Settings
  session: Session | null
  toasts: Toast[]

  init: () => Promise<void>
  toast: (message: string, kind?: Toast['kind']) => void
  dismissToast: (id: number) => void

  receiveNotification: (notif: AppNotification) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: (userId: string) => void
  clearNotifications: (userId: string) => void

  login: (userId: string, secret: string) => Promise<boolean>
  logout: () => void
  touchSession: () => void

  saveTask: (input: TaskInput, actorId: string) => void
  deleteTask: (taskId: string, actorId: string) => void

  submitTask: (
    taskId: string,
    childId: string,
    opts: { isInitiative: boolean; photoIds?: string[]; comment?: string },
  ) => boolean
  sendMessage: (toChildId: string, text: string, fromId: string) => void
  approveSubmission: (submissionId: string, parentId: string) => void
  rejectSubmission: (submissionId: string, parentId: string, reason: string) => void

  applyPenalty: (
    input: { childId: string; title: string; motif?: string; amount: number },
    parentId: string,
  ) => boolean
  cancelPenalty: (transactionId: string, parentId: string) => void

  resetBalance: (childId: string, parentId: string) => void
  resetAllBalances: (parentId: string) => void

  updateChild: (
    childId: string,
    patch: Partial<Pick<User, 'name' | 'avatar' | 'color' | 'isActive'>>,
    actorId: string,
  ) => void
  updateAvatar: (
    userId: string,
    patch: { avatar?: string; photoId?: string | null },
    actorId: string,
  ) => void
  changeSecret: (userId: string, newSecret: string, actorId: string) => Promise<void>
  updateSettings: (patch: Partial<Settings>, actorId: string) => void
}

let toastSeq = 0

export const useStore = create<Store>((set, get) => {
  function persist(
    key:
      | 'users'
      | 'tasks'
      | 'submissions'
      | 'transactions'
      | 'logs'
      | 'messages'
      | 'notifications'
      | 'settings',
  ) {
    save(key, get()[key])
  }

  function pushLog(action: string, actorId: string, details: string, subjectId?: string, amount?: number) {
    const entry: AuditLog = { id: uid(), action, actorId, subjectId, amount, details, timestamp: Date.now() }
    set((s) => ({ logs: [entry, ...s.logs].slice(0, MAX_LOGS) }))
    persist('logs')
  }

  function notify(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    icon: string,
    link?: string,
  ) {
    const notif: AppNotification = {
      id: uid(),
      userId,
      type,
      title,
      message,
      icon,
      read: false,
      createdAt: Date.now(),
      link,
    }
    set((s) => ({ notifications: [notif, ...s.notifications].slice(0, MAX_NOTIFICATIONS) }))
    persist('notifications')
    broadcastNotification(notif)
  }

  function notifyParents(type: NotificationType, title: string, message: string, icon: string, link?: string) {
    for (const parent of get().users.filter((u) => u.role === 'parent' && u.isActive)) {
      notify(parent.id, type, title, message, icon, link)
    }
  }

  return {
    ready: false,
    users: [],
    tasks: [],
    submissions: [],
    transactions: [],
    logs: [],
    messages: [],
    notifications: [],
    settings: defaultSettings,
    session: null,
    toasts: [],

    init: async () => {
      let users = await load<User[]>('users', [])
      let tasks = await load<Task[]>('tasks', [])
      const submissions = await load<TaskSubmission[]>('submissions', [])
      const transactions = await load<Transaction[]>('transactions', [])
      const messages = await load<Message[]>('messages', [])
      const notifications = await load<AppNotification[]>('notifications', [])
      let logs = await load<AuditLog[]>('logs', [])
      const settings = await load<Settings>('settings', defaultSettings)
      let session = await load<Session | null>('session', null)

      if (users.length === 0) {
        users = await seedUsers()
        tasks = seedTasks(users)
        logs = [
          {
            id: uid(),
            action: 'seed',
            actorId: users[0].id,
            details: 'Création de la famille et des tâches de base',
            timestamp: Date.now(),
          },
        ]
        save('users', users)
        save('tasks', tasks)
        save('logs', logs)
        save('settings', settings)
      }

      if (session && session.expiresAt < Date.now()) {
        session = null
        save('session', null)
      }

      set({ ready: true, users, tasks, submissions, transactions, logs, messages, notifications, settings, session })
    },

    toast: (message, kind = 'success') => {
      const id = ++toastSeq
      set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
      setTimeout(() => get().dismissToast(id), 3500)
    },

    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    receiveNotification: (notif) => {
      if (get().notifications.some((n) => n.id === notif.id)) return
      set((s) => ({ notifications: [notif, ...s.notifications].slice(0, MAX_NOTIFICATIONS) }))
      persist('notifications')
    },

    markNotificationRead: (id) => {
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }))
      persist('notifications')
    },

    markAllNotificationsRead: (userId) => {
      set((s) => ({
        notifications: s.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)),
      }))
      persist('notifications')
    },

    clearNotifications: (userId) => {
      set((s) => ({ notifications: s.notifications.filter((n) => n.userId !== userId) }))
      persist('notifications')
    },

    login: async (userId, secret) => {
      const user = get().users.find((u) => u.id === userId && u.isActive)
      if (!user) return false
      const ok = await verifySecret(secret, user.secretSalt, user.secretHash)
      if (!ok) return false
      const session: Session = { userId, role: user.role, expiresAt: Date.now() + SESSION_DURATION }
      set({ session })
      save('session', session)
      pushLog('login', userId, `${user.name} s'est connecté(e)`)
      return true
    },

    logout: () => {
      set({ session: null })
      save('session', null)
    },

    touchSession: () => {
      const session = get().session
      if (!session) return
      if (session.expiresAt < Date.now()) {
        get().logout()
        return
      }
      const refreshed = { ...session, expiresAt: Date.now() + SESSION_DURATION }
      set({ session: refreshed })
      save('session', refreshed)
    },

    saveTask: (input, actorId) => {
      const { id, ...fields } = input
      let newlyAssigned: string[] = []
      if (id) {
        const before = get().tasks.find((t) => t.id === id)
        newlyAssigned = fields.assignedTo.filter((c) => !before?.assignedTo.includes(c))
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...fields } : t)) }))
        pushLog('task_updated', actorId, `« ${fields.title} »`, undefined, fields.amount)
      } else {
        const task: Task = { ...fields, id: uid(), createdBy: actorId, createdAt: Date.now(), isActive: true }
        newlyAssigned = task.assignedTo
        set((s) => ({ tasks: [task, ...s.tasks] }))
        pushLog('task_created', actorId, `« ${task.title} »`, undefined, task.amount)
      }
      persist('tasks')
      for (const childId of newlyAssigned) {
        notify(
          childId,
          'task_assigned',
          'Nouvelle tâche pour toi !',
          `${fields.title} · +${formatEuro(fields.amount)}`,
          fields.icon,
          '/enfant',
        )
      }
    },

    deleteTask: (taskId, actorId) => {
      const task = get().tasks.find((t) => t.id === taskId)
      if (!task) return
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }))
      pushLog('task_deleted', actorId, `« ${task.title} »`, undefined, task.amount)
      persist('tasks')
    },

    submitTask: (taskId, childId, { isInitiative, photoIds, comment }) => {
      const { tasks, submissions } = get()
      const task = tasks.find((t) => t.id === taskId)
      if (!task || !isTaskAvailable(task, childId, submissions)) return false
      const submission: TaskSubmission = {
        id: uid(),
        taskId,
        childId,
        status: 'pending',
        isInitiative,
        photoIds: photoIds?.length ? photoIds : undefined,
        comment: comment?.trim() || undefined,
        submittedAt: Date.now(),
        bonusApplied: false,
      }
      set((s) => ({ submissions: [submission, ...s.submissions] }))
      pushLog(
        'task_submitted',
        childId,
        `« ${task.title} »${isInitiative ? ' ⭐ initiative' : ''}${photoIds?.length ? ` · ${photoIds.length} photo(s)` : ''}`,
        childId,
        task.amount,
      )
      persist('submissions')
      const child = get().users.find((u) => u.id === childId)
      notifyParents(
        'task_submitted',
        `${child?.name ?? 'Un enfant'} a terminé une tâche`,
        `${task.title}${isInitiative ? ' ⭐ initiative' : ''} · à valider`,
        task.icon,
        '/parent/validations',
      )
      return true
    },

    sendMessage: (toChildId, text, fromId) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const message: Message = { id: uid(), fromId, toChildId, text: trimmed, createdAt: Date.now() }
      set((s) => ({ messages: [message, ...s.messages] }))
      pushLog('message_sent', fromId, `« ${trimmed} »`, toChildId)
      persist('messages')
      const from = get().users.find((u) => u.id === fromId)
      notify(toChildId, 'message', `Message de ${from?.name ?? 'tes parents'}`, trimmed, '💌', '/enfant/profil')
    },

    approveSubmission: (submissionId, parentId) => {
      const { submissions, tasks, settings } = get()
      const sub = submissions.find((s) => s.id === submissionId)
      const task = sub && tasks.find((t) => t.id === sub.taskId)
      if (!sub || !task || sub.status !== 'pending') return
      const bonus = sub.isInitiative ? settings.initiativeBonus : 0
      const amount = task.amount + bonus
      const transaction: Transaction = {
        id: uid(),
        type: 'task_approval',
        childId: sub.childId,
        amount,
        description: `${task.icon} ${task.title}${bonus > 0 ? ' ⭐ initiative' : ''}`,
        relatedTo: sub.id,
        createdBy: parentId,
        createdAt: Date.now(),
      }
      set((s) => ({
        submissions: s.submissions.map((x) =>
          x.id === submissionId
            ? { ...x, status: 'approved' as const, reviewedAt: Date.now(), reviewedBy: parentId, bonusApplied: bonus > 0 }
            : x,
        ),
        transactions: [transaction, ...s.transactions],
      }))
      pushLog('submission_approved', parentId, `« ${task.title} »`, sub.childId, amount)
      persist('submissions')
      persist('transactions')
      notify(
        sub.childId,
        'task_approved',
        'Tâche validée ! 🎉',
        `${task.title} · +${formatEuro(amount)}${bonus > 0 ? ' (bonus initiative inclus)' : ''}`,
        task.icon,
        '/enfant',
      )
    },

    rejectSubmission: (submissionId, parentId, reason) => {
      const { submissions, tasks } = get()
      const sub = submissions.find((s) => s.id === submissionId)
      const task = sub && tasks.find((t) => t.id === sub.taskId)
      if (!sub || sub.status !== 'pending') return
      set((s) => ({
        submissions: s.submissions.map((x) =>
          x.id === submissionId
            ? { ...x, status: 'rejected' as const, reviewedAt: Date.now(), reviewedBy: parentId, rejectionReason: reason }
            : x,
        ),
      }))
      pushLog('submission_rejected', parentId, `« ${task?.title ?? '?'} » — ${reason || 'sans motif'}`, sub.childId)
      persist('submissions')
      notify(
        sub.childId,
        'task_rejected',
        'Tâche refusée',
        `${task?.title ?? 'Tâche'}${reason ? ` — ${reason}` : ''}`,
        '😕',
        '/enfant',
      )
    },

    applyPenalty: ({ childId, title, motif, amount }, parentId) => {
      const { transactions, settings } = get()
      const debit = -Math.abs(amount)
      if (computeBalance(transactions, childId) + debit < settings.minBalance) {
        get().toast(
          `Impossible : le solde passerait sous le minimum toléré (${settings.minBalance / 100} €).`,
          'error',
        )
        return false
      }
      const transaction: Transaction = {
        id: uid(),
        type: 'penalty',
        childId,
        amount: debit,
        description: `⚠️ ${title}${motif ? ` — ${motif}` : ''}`,
        createdBy: parentId,
        createdAt: Date.now(),
      }
      set((s) => ({ transactions: [transaction, ...s.transactions] }))
      pushLog('penalty_applied', parentId, `« ${title} »${motif ? ` — ${motif}` : ''}`, childId, debit)
      persist('transactions')
      notify(
        childId,
        'penalty',
        'Pénalité appliquée',
        `${title} · ${formatEuro(debit)}`,
        '⚠️',
        '/enfant/historique',
      )
      return true
    },

    cancelPenalty: (transactionId, parentId) => {
      const tx = get().transactions.find((t) => t.id === transactionId)
      if (!tx || tx.type !== 'penalty' || tx.cancelled) return
      if (Date.now() - tx.createdAt > PENALTY_CANCEL_WINDOW) {
        get().toast('Trop tard : une pénalité ne peut être annulée que sous 24 h.', 'error')
        return
      }
      const reversal: Transaction = {
        id: uid(),
        type: 'penalty_cancel',
        childId: tx.childId,
        amount: -tx.amount,
        description: `Annulation — ${tx.description}`,
        relatedTo: tx.id,
        createdBy: parentId,
        createdAt: Date.now(),
      }
      set((s) => ({
        transactions: [
          reversal,
          ...s.transactions.map((t) => (t.id === transactionId ? { ...t, cancelled: true } : t)),
        ],
      }))
      pushLog('penalty_cancelled', parentId, tx.description, tx.childId, -tx.amount)
      persist('transactions')
    },

    resetBalance: (childId, parentId) => {
      const balance = computeBalance(get().transactions, childId)
      if (balance === 0) return
      const transaction: Transaction = {
        id: uid(),
        type: 'manual_adjustment',
        childId,
        amount: -balance,
        description: 'Réinitialisation du solde',
        createdBy: parentId,
        createdAt: Date.now(),
      }
      set((s) => ({ transactions: [transaction, ...s.transactions] }))
      pushLog('balance_reset', parentId, 'Solde remis à zéro', childId, -balance)
      persist('transactions')
    },

    resetAllBalances: (parentId) => {
      for (const child of get().users.filter((u) => u.role === 'child')) {
        get().resetBalance(child.id, parentId)
      }
    },

    updateChild: (childId, patch, actorId) => {
      set((s) => ({ users: s.users.map((u) => (u.id === childId ? { ...u, ...patch } : u)) }))
      const child = get().users.find((u) => u.id === childId)
      pushLog('child_updated', actorId, `${child?.name ?? '?'} : ${Object.keys(patch).join(', ')}`, childId)
      persist('users')
    },

    updateAvatar: (userId, patch, actorId) => {
      set((s) => ({
        users: s.users.map((u) => {
          if (u.id !== userId) return u
          const next = { ...u }
          if (patch.avatar !== undefined) next.avatar = patch.avatar
          if (patch.photoId !== undefined) next.photoId = patch.photoId ?? undefined
          return next
        }),
      }))
      const user = get().users.find((u) => u.id === userId)
      pushLog('avatar_changed', actorId, `Avatar de ${user?.name ?? '?'} modifié`, userId)
      persist('users')
    },

    changeSecret: async (userId, newSecret, actorId) => {
      const secretSalt = makeSalt()
      const secretHash = await hashSecret(newSecret, secretSalt)
      set((s) => ({
        users: s.users.map((u) =>
          u.id === userId ? { ...u, secretHash, secretSalt, usesDefaultSecret: false } : u,
        ),
      }))
      const user = get().users.find((u) => u.id === userId)
      pushLog('secret_changed', actorId, `Code d'accès de ${user?.name ?? '?'} modifié`, userId)
      persist('users')
    },

    updateSettings: (patch, actorId) => {
      set((s) => ({ settings: { ...s.settings, ...patch } }))
      pushLog('settings_updated', actorId, Object.keys(patch).join(', '))
      persist('settings')
    },
  }
})

export function useCurrentUser(): User | null {
  const session = useStore((s) => s.session)
  const users = useStore((s) => s.users)
  return users.find((u) => u.id === session?.userId) ?? null
}

export async function clearAllData(): Promise<void> {
  await db.clear()
  window.location.reload()
}
