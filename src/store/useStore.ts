import { create } from 'zustand'
import { db, load, save } from '../db/storage'
import { defaultSettings, seedTasks, seedUsers } from '../db/seed'
import { computeBalance } from '../lib/balance'
import { hashSecret, makeSalt, verifySecret } from '../lib/crypto'
import { formatEuro } from '../lib/format'
import { uid } from '../lib/id'
import { broadcastNotification } from '../lib/realtime'
import { isTaskAvailable } from '../lib/recurrence'
import { deleteRecord, fetchAll, pushRecord, type SyncTable } from '../lib/sync'
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
  /** RÃ©concilie l'Ã©tat local avec Supabase (familles, tÃ¢ches, soumissions, transactions partagÃ©es). */
  syncFromRemote: () => Promise<void>
  receiveRemoteUpsert: (
    key: 'users' | 'tasks' | 'submissions' | 'transactions',
    record: User | Task | TaskSubmission | Transaction,
  ) => void
  receiveRemoteDelete: (key: 'users' | 'tasks' | 'submissions' | 'transactions', id: string) => void
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

const SYNCED_KEYS = ['users', 'tasks', 'submissions', 'transactions'] as const
type SyncedKey = (typeof SYNCED_KEYS)[number]

function syncTableFor(key: SyncedKey): SyncTable {
  return `sync_${key}` as SyncTable
}

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
    const value = get()[key]
    save(key, value)
    // Familles, tÃ¢ches, soumissions et transactions sont partagÃ©es entre appareils :
    // chaque Ã©criture locale republie l'ensemble du tableau vers Supabase (petits
    // volumes, donc pas besoin de diff fin â plus simple et plus sÃ»r).
    if ((SYNCED_KEYS as readonly string[]).includes(key)) {
      const table = syncTableFor(key as SyncedKey)
      for (const record of value as Array<{ id: string }>) {
        pushRecord(table, record.id, record)
      }
    }
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
      const localUsers = await load<User[]>('users', [])
      let users = localUsers
      let tasks = await load<Task[]>('tasks', [])
      let submissions = await load<TaskSubmission[]>('submissions', [])
      let transactions = await load<Transaction[]>('transactions', [])
      const messages = await load<Message[]>('messages', [])
      const notifications = await load<AppNotification[]>('notifications', [])
      let logs = await load<AuditLog[]>('logs', [])
      const settings = await load<Settings>('settings', defaultSettings)
      let session = await load<Session | null>('session', null)

      // Les identifiants d'utilisateur/tÃ¢che sont gÃ©nÃ©rÃ©s localement Ã  chaque appareil :
      // sans rÃ©conciliation, deux appareils ne parlent jamais de la mÃªme famille.
      // Supabase fait autoritÃ© dÃ¨s qu'il contient des donnÃ©es ; sinon cet appareil sÃ¨me.
      try {
        const remoteUsers = await fetchAll<User>('sync_users')
        if (remoteUsers.length > 0) {
          const previousLocalUser = session ? localUsers.find((u) => u.id === session!.userId) : undefined
          users = remoteUsers
          const [remoteTasks, remoteSubmissions, remoteTransactions] = await Promise.all([
            fetchAll<Task>('sync_tasks'),
            fetchAll<TaskSubmission>('sync_submissions'),
            fetchAll<Transaction>('sync_transactions'),
          ])
          if (remoteTasks.length > 0) tasks = remoteTasks
          submissions = remoteSubmissions
          transactions = remoteTransactions
          save('users', users)
          save('tasks', tasks)
          save('submissions', submissions)
          save('transactions', transactions)

          // Cet appareil avait son propre id local pour l'utilisateur connectÃ© :
          // on le fait correspondre au bon compte partagÃ© via son nom.
          if (session && !users.some((u) => u.id === session!.userId)) {
            const byName = previousLocalUser ? users.find((u) => u.name === previousLocalUser.name) : undefined
            session = byName ? { ...session, userId: byName.id } : null
            save('session', session)
          }
        } else if (users.length === 0) {
          users = await seedUsers()
          tasks = seedTasks(users)
          logs = [
            {
              id: uid(),
              action: 'seed',
              actorId: users[0].id,
              details: 'CrÃ©ation de la famille et des tÃ¢ches de base',
              timestamp: Date.now(),
            },
          ]
          save('users', users)
          save('tasks', tasks)
          save('logs', logs)
          save('settings', settings)
          for (const u of users) pushRecord('sync_users', u.id, u)
          for (const t of tasks) pushRecord('sync_tasks', t.id, t)
        } else {
          // Appareil dÃ©jÃ  utilisÃ© avant l'ajout de la synchro : publie ses donnÃ©es locales.
          for (const u of users) pushRecord('sync_users', u.id, u)
          for (const t of tasks) pushRecord('sync_tasks', t.id, t)
          for (const s of submissions) pushRecord('sync_submissions', s.id, s)
          for (const tr of transactions) pushRecord('sync_transactions', tr.id, tr)
        }
      } catch (e) {
        console.error('â Sync : initialisation distante Ã©chouÃ©e, poursuite en local', e)
        if (users.length === 0) {
          users = await seedUsers()
          tasks = seedTasks(users)
          logs = [
            {
              id: uid(),
              action: 'seed',
              actorId: users[0].id,
              details: 'CrÃ©ation de la famille et des tÃ¢ches de base',
              timestamp: Date.now(),
            },
          ]
          save('users', users)
          save('tasks', tasks)
          save('logs', logs)
          save('settings', settings)
        }
      }

      if (session && session.expiresAt < Date.now()) {
        session = null
        save('session', null)
      }

      set({ ready: true, users, tasks, submissions, transactions, logs, messages, notifications, settings, session })
    },

    syncFromRemote: async () => {
      try {
        const [remoteUsers, remoteTasks, remoteSubmissions, remoteTransactions] = await Promise.all([
          fetchAll<User>('sync_users'),
          fetchAll<Task>('sync_tasks'),
          fetchAll<TaskSubmission>('sync_submissions'),
          fetchAll<Transaction>('sync_transactions'),
        ])
        if (remoteUsers.length === 0) return // rien Ã  rÃ©concilier (pas encore de famille distante)
        set({ users: remoteUsers, tasks: remoteTasks, submissions: remoteSubmissions, transactions: remoteTransactions })
        save('users', remoteUsers)
        save('tasks', remoteTasks)
        save('submissions', remoteSubmissions)
        save('transactions', remoteTransactions)
      } catch (e) {
        console.error('â Sync : rafraÃ®chissement distant Ã©chouÃ©', e)
      }
    },

    receiveRemoteUpsert: (key, record) => {
      set((s) => {
        const arr = s[key] as Array<{ id: string }>
        const idx = arr.findIndex((r) => r.id === (record as { id: string }).id)
        const next = idx === -1 ? [record, ...arr] : arr.map((r) => (r.id === (record as { id: string }).id ? record : r))
        return { [key]: next } as Partial<Store>
      })
      save(key, get()[key])
    },

    receiveRemoteDelete: (key, id) => {
      set((s) => ({ [key]: (s[key] as Array<{ id: string }>).filter((r) => r.id !== id) }) as Partial<Store>)
      save(key, get()[key])
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
      pushLog('login', userId, `${user.name} s'est connectÃ©(e)`)
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
        pushLog('task_updated', actorId, `Â« ${fields.title} Â»`, undefined, fields.amount)
      } else {
        const task: Task = { ...fields, id: uid(), createdBy: actorId, createdAt: Date.now(), isActive: true }
        newlyAssigned = task.assignedTo
        set((s) => ({ tasks: [task, ...s.tasks] }))
        pushLog('task_created', actorId, `Â« ${task.title} Â»`, undefined, task.amount)
      }
      persist('tasks')
      for (const childId of newlyAssigned) {
        notify(
          childId,
          'task_assigned',
          'Nouvelle tÃ¢che pour toi !',
          `${fields.title} Â· +${formatEuro(fields.amount)}`,
          fields.icon,
          '/enfant',
        )
      }
    },

    deleteTask: (taskId, actorId) => {
      const task = get().tasks.find((t) => t.id === taskId)
      if (!task) return
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }))
      pushLog('task_deleted', actorId, `Â« ${task.title} Â»`, undefined, task.amount)
      persist('tasks')
      deleteRecord('sync_tasks', taskId)
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
        `Â« ${task.title} Â»${isInitiative ? ' â­ initiative' : ''}${photoIds?.length ? ` Â· ${photoIds.length} photo(s)` : ''}`,
        childId,
        task.amount,
      )
      persist('submissions')
      const child = get().users.find((u) => u.id === childId)
      notifyParents(
        'task_submitted',
        `${child?.name ?? 'Un enfant'} a terminÃ© une tÃ¢che`,
        `${task.title}${isInitiative ? ' â­ initiative' : ''} Â· Ã  valider`,
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
      pushLog('message_sent', fromId, `Â« ${trimmed} Â»`, toChildId)
      persist('messages')
      const from = get().users.find((u) => u.id === fromId)
      notify(toChildId, 'message', `Message de ${from?.name ?? 'tes parents'}`, trimmed, 'ð', '/enfant/profil')
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
        description: `${task.icon} ${task.title}${bonus > 0 ? ' â­ initiative' : ''}`,
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
      pushLog('submission_approved', parentId, `Â« ${task.title} Â»`, sub.childId, amount)
      persist('submissions')
      persist('transactions')
      notify(
        sub.childId,
        'task_approved',
        'TÃ¢che validÃ©e ! ð',
        `${task.title} Â· +${formatEuro(amount)}${bonus > 0 ? ' (bonus initiative inclus)' : ''}`,
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
      pushLog('submission_rejected', parentId, `Â« ${task?.title ?? '?'} Â» â ${reason || 'sans motif'}`, sub.childId)
      persist('submissions')
      notify(
        sub.childId,
        'task_rejected',
        'TÃ¢che refusÃ©e',
        `${task?.title ?? 'TÃ¢che'}${reason ? ` â ${reason}` : ''}`,
        'ð',
        '/enfant',
      )
    },

    applyPenalty: ({ childId, title, motif, amount }, parentId) => {
      const { transactions, settings } = get()
      const debit = -Math.abs(amount)
      if (computeBalance(transactions, childId) + debit < settings.minBalance) {
        get().toast(
          `Impossible : le solde passerait sous le minimum tolÃ©rÃ© (${settings.minBalance / 100} â¬).`,
          'error',
        )
        return false
      }
      const transaction: Transaction = {
        id: uid(),
        type: 'penalty',
        childId,
        amount: debit,
        description: `â ï¸ ${title}${motif ? ` â ${motif}` : ''}`,
        createdBy: parentId,
        createdAt: Date.now(),
      }
      set((s) => ({ transactions: [transaction, ...s.transactions] }))
      pushLog('penalty_applied', parentId, `Â« ${title} Â»${motif ? ` â ${motif}` : ''}`, childId, debit)
      persist('transactions')
      notify(
        childId,
        'penalty',
        'PÃ©nalitÃ© appliquÃ©e',
        `${title} Â· ${formatEuro(debit)}`,
        'â ï¸',
        '/enfant/historique',
      )
      return true
    },

    cancelPenalty: (transactionId, parentId) => {
      const tx = get().transactions.find((t) => t.id === transactionId)
      if (!tx || tx.type !== 'penalty' || tx.cancelled) return
      if (Date.now() - tx.createdAt > PENALTY_CANCEL_WINDOW) {
        get().toast('Trop tard : une pÃ©nalitÃ© ne peut Ãªtre annulÃ©e que sous 24 h.', 'error')
        return
      }
      const reversal: Transaction = {
        id: uid(),
        type: 'penalty_cancel',
        childId: tx.childId,
        amount: -tx.amount,
        description: `Annulation â ${tx.description}`,
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
        description: 'RÃ©initialisation du solde',
        createdBy: parentId,
        createdAt: Date.now(),
      }
      set((s) => ({ transactions: [transaction, ...s.transactions] }))
      pushLog('balance_reset', parentId, 'Solde remis Ã  zÃ©ro', childId, -balance)
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
      pushLog('avatar_changed', actorId, `Avatar de ${user?.name ?? '?'} modifiÃ©`, userId)
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
      pushLog('secret_changed', actorId, `Code d'accÃ¨s de ${user?.name ?? '?'} modifiÃ©`, userId)
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
