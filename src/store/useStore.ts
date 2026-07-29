import { create } from 'zustand'
import { db, load, save } from '../db/storage'
import { defaultSettings, seedTasks, seedUsers } from '../db/seed'
import { computeBadges } from '../lib/badges'
import { computeBalance } from '../lib/balance'
import { hashSecret, makeSalt, verifySecret } from '../lib/crypto'
import { formatEuro } from '../lib/format'
import { uid } from '../lib/id'
import { computePoints } from '../lib/points'
import { broadcastNotification } from '../lib/realtime'
import { sendPushTo } from '../lib/push'
import { isTaskAvailable } from '../lib/recurrence'
import { streakMilestonesReached, STREAK_BONUS_POINTS, computeStreak } from '../lib/streak'
import { deleteRecord, fetchAll, pushRecord, type SyncTable } from '../lib/sync'
import type {
  AppNotification,
  AuditLog,
  Message,
  NotificationType,
  PenaltyRule,
  PointsTransaction,
  PointsTransactionType,
  Recurrence,
  Redemption,
  RewardClaim,
  SavingsGoal,
  Session,
  Settings,
  ShopCategory,
  ShopItem,
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

/** Toutes les clés d'état dont les enregistrements sont répliqués individuellement vers Supabase. */
type RemoteEntityKey =
  | 'users'
  | 'tasks'
  | 'submissions'
  | 'transactions'
  | 'savingsGoals'
  | 'logs'
  | 'pointsTransactions'
  | 'rewardClaims'
  | 'penaltyRules'
  | 'shopItems'
  | 'redemptions'

type RemoteEntity =
  | User
  | Task
  | TaskSubmission
  | Transaction
  | SavingsGoal
  | AuditLog
  | PointsTransaction
  | RewardClaim
  | PenaltyRule
  | ShopItem
  | Redemption

interface Store {
  ready: boolean
  users: User[]
  tasks: Task[]
  submissions: TaskSubmission[]
  transactions: Transaction[]
  savingsGoals: SavingsGoal[]
  logs: AuditLog[]
  messages: Message[]
  notifications: AppNotification[]
  pointsTransactions: PointsTransaction[]
  rewardClaims: RewardClaim[]
  penaltyRules: PenaltyRule[]
  shopItems: ShopItem[]
  redemptions: Redemption[]
  settings: Settings
  session: Session | null
  toasts: Toast[]

  init: () => Promise<void>
  /** Réconcilie l'état local avec Supabase (familles, tâches, soumissions, transactions partagées). */
  syncFromRemote: () => Promise<void>
  receiveRemoteUpsert: (key: RemoteEntityKey, record: RemoteEntity) => void
  receiveRemoteDelete: (key: RemoteEntityKey, id: string) => void
  /** Reçoit les réglages (dont les fonctionnalités activées) mis à jour depuis un autre appareil. */
  receiveRemoteSettings: (settings: Settings) => void
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
  /** Contrôle parental étendu : modifie ou supprime une pénalité déjà appliquée, sans limite de temps. */
  editPenaltyTransaction: (
    transactionId: string,
    patch: { title: string; motif?: string; amount: number },
    parentId: string,
  ) => boolean
  deletePenaltyTransaction: (transactionId: string, parentId: string) => boolean
  /** Annule une validation faite par erreur : reverse la transaction et repasse la soumission en attente/refusée. */
  revertApproval: (
    submissionId: string,
    newStatus: 'pending' | 'rejected',
    parentId: string,
    reason?: string,
  ) => boolean

  savePenaltyRule: (
    input: {
      id?: string
      childId: string
      title: string
      amount: number
      recurrence: Recurrence
      active: boolean
    },
    actorId: string,
  ) => void
  deletePenaltyRule: (ruleId: string, actorId: string) => void

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

  addSavingsGoal: (childId: string, title: string, icon: string, targetAmount: number, actorId: string) => void
  deleteSavingsGoal: (goalId: string, actorId: string) => void

  createShopItem: (
    input: { title: string; icon: string; category: ShopCategory; cost: number },
    actorId: string,
  ) => void
  deleteShopItem: (itemId: string, actorId: string) => void
  proposeWish: (childId: string, title: string, icon: string, category: ShopCategory) => void
  approveWish: (itemId: string, cost: number, actorId: string) => void
  rejectWish: (itemId: string, actorId: string) => void
  redeemShopItem: (childId: string, itemId: string, actorId: string) => boolean
  fulfillRedemption: (redemptionId: string, actorId: string) => void
  cancelRedemption: (redemptionId: string, actorId: string) => void
  convertPointsToMoney: (childId: string, points: number, actorId: string) => boolean
}

let toastSeq = 0

// 'logs' est volontairement exclu : jusqu'à MAX_LOGS (2000) entrées, republier tout le
// tableau à chaque nouvelle ligne serait 2000 upserts pour un seul ajout. pushLog() pousse
// donc directement l'entrée unique créée (voir plus bas), en dehors de ce mécanisme générique.
const SYNCED_KEYS = [
  'users',
  'tasks',
  'submissions',
  'transactions',
  'savingsGoals',
  'pointsTransactions',
  'rewardClaims',
  'penaltyRules',
  'shopItems',
  'redemptions',
] as const
type SyncedKey = (typeof SYNCED_KEYS)[number]

const SYNC_TABLE_FOR: Record<SyncedKey, SyncTable> = {
  users: 'sync_users',
  tasks: 'sync_tasks',
  submissions: 'sync_submissions',
  transactions: 'sync_transactions',
  savingsGoals: 'sync_savings_goals',
  pointsTransactions: 'sync_points_transactions',
  rewardClaims: 'sync_reward_claims',
  penaltyRules: 'sync_penalty_rules',
  shopItems: 'sync_shop_items',
  redemptions: 'sync_redemptions',
}

function syncTableFor(key: SyncedKey): SyncTable {
  return SYNC_TABLE_FOR[key]
}

/** Fusionne les réglages chargés (potentiellement anciens, avec des champs manquants) avec les valeurs par défaut. */
function normalizeSettings(raw: Settings): Settings {
  return {
    ...defaultSettings,
    ...raw,
    features: { ...defaultSettings.features, ...raw.features },
    inactivityPenalty: { ...defaultSettings.inactivityPenalty, ...raw.inactivityPenalty },
  }
}

export const useStore = create<Store>((set, get) => {
  function persist(
    key:
      | 'users'
      | 'tasks'
      | 'submissions'
      | 'transactions'
      | 'savingsGoals'
      | 'logs'
      | 'messages'
      | 'notifications'
      | 'pointsTransactions'
      | 'rewardClaims'
      | 'penaltyRules'
      | 'shopItems'
      | 'redemptions',
  ) {
    const value = get()[key]
    save(key, value)
    // Familles, tâches, soumissions, transactions… sont partagées entre appareils :
    // chaque écriture locale republie l'ensemble du tableau vers Supabase (petits
    // volumes, donc pas besoin de diff fin — plus simple et plus sûr). 'logs' fait
    // exception (voir pushLog) : ce tableau peut grossir jusqu'à MAX_LOGS.
    if ((SYNCED_KEYS as readonly string[]).includes(key)) {
      const table = syncTableFor(key as SyncedKey)
      for (const record of value as Array<{ id: string }>) {
        pushRecord(table, record.id, record)
      }
    }
  }

  function pushLog(
    action: string,
    actorId: string,
    details: string,
    subjectId?: string,
    amount?: number,
    relatedId?: string,
  ) {
    const entry: AuditLog = { id: uid(), action, actorId, subjectId, relatedId, amount, details, timestamp: Date.now() }
    set((s) => ({ logs: [entry, ...s.logs].slice(0, MAX_LOGS) }))
    save('logs', get().logs)
    // Un seul enregistrement poussé (pas persist() générique) : voir le commentaire sur SYNCED_KEYS.
    pushRecord('sync_logs', entry.id, entry)
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
      userName: get().users.find((u) => u.id === userId)?.name,
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
    // Push OS réel (marche même app fermée) — best effort, ne bloque jamais l'app.
    sendPushTo(userId, title, message, icon, link)
  }

  function notifyParents(type: NotificationType, title: string, message: string, icon: string, link?: string) {
    for (const parent of get().users.filter((u) => u.role === 'parent' && u.isActive)) {
      notify(parent.id, type, title, message, icon, link)
    }
  }

  function awardReward(
    childId: string,
    key: string,
    points: number,
    title: string,
    type: PointsTransactionType,
    actorId: string,
  ) {
    const claim: RewardClaim = { id: uid(), childId, key, createdAt: Date.now() }
    const ptx: PointsTransaction = {
      id: uid(),
      childId,
      type,
      amount: points,
      description: title,
      createdBy: actorId,
      createdAt: Date.now(),
    }
    set((s) => ({
      rewardClaims: [claim, ...s.rewardClaims],
      pointsTransactions: [ptx, ...s.pointsTransactions],
    }))
    persist('rewardClaims')
    persist('pointsTransactions')
    pushLog('reward_earned', actorId, `${title} (+${points} pts)`, childId)
    notify(childId, 'reward_earned', `+${points} points !`, title, '🏅', '/enfant/profil')
  }

  /** Vérifie, pour chaque enfant, si de nouveaux badges ou paliers de série méritent des points — idempotent via rewardClaims. */
  function checkRewards(actorId: string) {
    const { users, submissions, transactions } = get()
    const children = users.filter((u) => u.role === 'child' && u.isActive)
    for (const child of children) {
      const badges = computeBadges({ childId: child.id, submissions, transactions, children })
      for (const badge of badges) {
        if (!badge.unlocked || badge.points <= 0) continue
        const key = `badge:${badge.id}`
        if (get().rewardClaims.some((r) => r.childId === child.id && r.key === key)) continue
        awardReward(child.id, key, badge.points, `Badge débloqué : ${badge.emoji} ${badge.label}`, 'badge', actorId)
      }
      const streak = computeStreak(child.id, submissions)
      for (const milestone of streakMilestonesReached(streak.count)) {
        const key = `streak:${milestone}`
        if (get().rewardClaims.some((r) => r.childId === child.id && r.key === key)) continue
        awardReward(
          child.id,
          key,
          STREAK_BONUS_POINTS[milestone],
          `Série de ${milestone} jours !`,
          'streak_bonus',
          actorId,
        )
      }
    }
  }

  /** Reverse une transaction de pénalité : marque l'originale annulée, ajoute une écriture d'annulation. */
  function reversePenaltyTx(tx: Transaction, parentId: string) {
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
        ...s.transactions.map((t) => (t.id === tx.id ? { ...t, cancelled: true } : t)),
      ],
    }))
    persist('transactions')
  }

  return {
    ready: false,
    users: [],
    tasks: [],
    submissions: [],
    transactions: [],
    savingsGoals: [],
    logs: [],
    messages: [],
    notifications: [],
    pointsTransactions: [],
    rewardClaims: [],
    penaltyRules: [],
    shopItems: [],
    redemptions: [],
    settings: defaultSettings,
    session: null,
    toasts: [],

    init: async () => {
      const localUsers = await load<User[]>('users', [])
      let users = localUsers
      let tasks = await load<Task[]>('tasks', [])
      let submissions = await load<TaskSubmission[]>('submissions', [])
      let transactions = await load<Transaction[]>('transactions', [])
      let savingsGoals = await load<SavingsGoal[]>('savingsGoals', [])
      const messages = await load<Message[]>('messages', [])
      const notifications = await load<AppNotification[]>('notifications', [])
      let logs = await load<AuditLog[]>('logs', [])
      let pointsTransactions = await load<PointsTransaction[]>('pointsTransactions', [])
      let rewardClaims = await load<RewardClaim[]>('rewardClaims', [])
      let penaltyRules = await load<PenaltyRule[]>('penaltyRules', [])
      let shopItems = await load<ShopItem[]>('shopItems', [])
      let redemptions = await load<Redemption[]>('redemptions', [])
      let settings = normalizeSettings(await load<Settings>('settings', defaultSettings))
      let session = await load<Session | null>('session', null)

      // Les identifiants d'utilisateur/tâche sont générés localement à chaque appareil :
      // sans réconciliation, deux appareils ne parlent jamais de la même famille.
      // Supabase fait autorité dès qu'il contient des données ; sinon cet appareil sème.
      try {
        const remoteUsers = await fetchAll<User>('sync_users')
        if (remoteUsers.length > 0) {
          const previousLocalUser = session ? localUsers.find((u) => u.id === session!.userId) : undefined
          users = remoteUsers
          const [
            remoteTasks,
            remoteSubmissions,
            remoteTransactions,
            remoteSavingsGoals,
            remoteSettingsRows,
            remoteLogs,
            remotePointsTransactions,
            remoteRewardClaims,
            remotePenaltyRules,
            remoteShopItems,
            remoteRedemptions,
          ] = await Promise.all([
            fetchAll<Task>('sync_tasks'),
            fetchAll<TaskSubmission>('sync_submissions'),
            fetchAll<Transaction>('sync_transactions'),
            fetchAll<SavingsGoal>('sync_savings_goals'),
            fetchAll<Settings>('sync_settings'),
            fetchAll<AuditLog>('sync_logs'),
            fetchAll<PointsTransaction>('sync_points_transactions'),
            fetchAll<RewardClaim>('sync_reward_claims'),
            fetchAll<PenaltyRule>('sync_penalty_rules'),
            fetchAll<ShopItem>('sync_shop_items'),
            fetchAll<Redemption>('sync_redemptions'),
          ])
          if (remoteTasks.length > 0) tasks = remoteTasks
          submissions = remoteSubmissions
          transactions = remoteTransactions
          savingsGoals = remoteSavingsGoals
          logs = remoteLogs
          pointsTransactions = remotePointsTransactions
          rewardClaims = remoteRewardClaims
          penaltyRules = remotePenaltyRules
          shopItems = remoteShopItems
          redemptions = remoteRedemptions
          if (remoteSettingsRows.length > 0) {
            settings = normalizeSettings(remoteSettingsRows[0])
          } else {
            pushRecord('sync_settings', 'main', settings)
          }
          save('users', users)
          save('tasks', tasks)
          save('submissions', submissions)
          save('transactions', transactions)
          save('savingsGoals', savingsGoals)
          save('settings', settings)
          save('logs', logs)
          save('pointsTransactions', pointsTransactions)
          save('rewardClaims', rewardClaims)
          save('penaltyRules', penaltyRules)
          save('shopItems', shopItems)
          save('redemptions', redemptions)

          // Cet appareil avait son propre id local pour l'utilisateur connecté :
          // on le fait correspondre au bon compte partagé via son nom.
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
              details: 'Création de la famille et des tâches de base',
              timestamp: Date.now(),
            },
          ]
          save('users', users)
          save('tasks', tasks)
          save('logs', logs)
          save('settings', settings)
          for (const u of users) pushRecord('sync_users', u.id, u)
          for (const t of tasks) pushRecord('sync_tasks', t.id, t)
          for (const l of logs) pushRecord('sync_logs', l.id, l)
          pushRecord('sync_settings', 'main', settings)
        } else {
          // Appareil déjà utilisé avant l'ajout de la synchro : publie ses données locales.
          for (const u of users) pushRecord('sync_users', u.id, u)
          for (const t of tasks) pushRecord('sync_tasks', t.id, t)
          for (const s of submissions) pushRecord('sync_submissions', s.id, s)
          for (const tr of transactions) pushRecord('sync_transactions', tr.id, tr)
          for (const g of savingsGoals) pushRecord('sync_savings_goals', g.id, g)
          for (const l of logs) pushRecord('sync_logs', l.id, l)
          for (const p of pointsTransactions) pushRecord('sync_points_transactions', p.id, p)
          for (const r of rewardClaims) pushRecord('sync_reward_claims', r.id, r)
          for (const p of penaltyRules) pushRecord('sync_penalty_rules', p.id, p)
          for (const s of shopItems) pushRecord('sync_shop_items', s.id, s)
          for (const r of redemptions) pushRecord('sync_redemptions', r.id, r)
          pushRecord('sync_settings', 'main', settings)
        }
      } catch (e) {
        console.error('❌ Sync : initialisation distante échouée, poursuite en local', e)
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
      }

      if (session && session.expiresAt < Date.now()) {
        session = null
        save('session', null)
      }

      set({
        ready: true,
        users,
        tasks,
        submissions,
        transactions,
        savingsGoals,
        logs,
        messages,
        notifications,
        pointsTransactions,
        rewardClaims,
        penaltyRules,
        shopItems,
        redemptions,
        settings,
        session,
      })
    },

    syncFromRemote: async () => {
      try {
        const [
          remoteUsers,
          remoteTasks,
          remoteSubmissions,
          remoteTransactions,
          remoteSavingsGoals,
          remoteSettingsRows,
          remoteLogs,
          remotePointsTransactions,
          remoteRewardClaims,
          remotePenaltyRules,
          remoteShopItems,
          remoteRedemptions,
        ] = await Promise.all([
          fetchAll<User>('sync_users'),
          fetchAll<Task>('sync_tasks'),
          fetchAll<TaskSubmission>('sync_submissions'),
          fetchAll<Transaction>('sync_transactions'),
          fetchAll<SavingsGoal>('sync_savings_goals'),
          fetchAll<Settings>('sync_settings'),
          fetchAll<AuditLog>('sync_logs'),
          fetchAll<PointsTransaction>('sync_points_transactions'),
          fetchAll<RewardClaim>('sync_reward_claims'),
          fetchAll<PenaltyRule>('sync_penalty_rules'),
          fetchAll<ShopItem>('sync_shop_items'),
          fetchAll<Redemption>('sync_redemptions'),
        ])
        if (remoteUsers.length === 0) return // rien à réconcilier (pas encore de famille distante)
        const settings = remoteSettingsRows.length > 0 ? normalizeSettings(remoteSettingsRows[0]) : get().settings
        set({
          users: remoteUsers,
          tasks: remoteTasks,
          submissions: remoteSubmissions,
          transactions: remoteTransactions,
          savingsGoals: remoteSavingsGoals,
          settings,
          logs: remoteLogs,
          pointsTransactions: remotePointsTransactions,
          rewardClaims: remoteRewardClaims,
          penaltyRules: remotePenaltyRules,
          shopItems: remoteShopItems,
          redemptions: remoteRedemptions,
        })
        save('users', remoteUsers)
        save('tasks', remoteTasks)
        save('submissions', remoteSubmissions)
        save('transactions', remoteTransactions)
        save('savingsGoals', remoteSavingsGoals)
        save('settings', settings)
        save('logs', remoteLogs)
        save('pointsTransactions', remotePointsTransactions)
        save('rewardClaims', remoteRewardClaims)
        save('penaltyRules', remotePenaltyRules)
        save('shopItems', remoteShopItems)
        save('redemptions', remoteRedemptions)
      } catch (e) {
        console.error('❌ Sync : rafraîchissement distant échoué', e)
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

    receiveRemoteSettings: (settings) => {
      const merged = normalizeSettings(settings)
      set({ settings: merged })
      save('settings', merged)
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
      checkRewards(childId)
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
      pushLog('submission_approved', parentId, `« ${task.title} »`, sub.childId, amount, sub.id)
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
      checkRewards(parentId)
    },

    revertApproval: (submissionId, newStatus, parentId, reason) => {
      const { submissions, tasks, transactions } = get()
      const sub = submissions.find((s) => s.id === submissionId)
      if (!sub || sub.status !== 'approved') return false
      const task = tasks.find((t) => t.id === sub.taskId)
      const tx = transactions.find((t) => t.relatedTo === sub.id && t.type === 'task_approval')
      if (tx) {
        const reversal: Transaction = {
          id: uid(),
          type: 'approval_reverted',
          childId: sub.childId,
          amount: -tx.amount,
          description: `Annulation de validation — ${task?.title ?? 'tâche'}`,
          relatedTo: tx.id,
          createdBy: parentId,
          createdAt: Date.now(),
        }
        set((s) => ({ transactions: [reversal, ...s.transactions] }))
        persist('transactions')
      }
      set((s) => ({
        submissions: s.submissions.map((x) =>
          x.id === submissionId
            ? {
                ...x,
                status: newStatus,
                reviewedAt: newStatus === 'rejected' ? Date.now() : undefined,
                reviewedBy: newStatus === 'rejected' ? parentId : undefined,
                rejectionReason: newStatus === 'rejected' ? reason : undefined,
                bonusApplied: false,
              }
            : x,
        ),
      }))
      persist('submissions')
      const statusLabel = newStatus === 'pending' ? 'en attente' : 'refusée'
      pushLog(
        'submission_approval_reverted',
        parentId,
        `« ${task?.title ?? '?'} » repassée ${statusLabel}`,
        sub.childId,
        tx ? -tx.amount : undefined,
        sub.id,
      )
      notify(
        sub.childId,
        'task_rejected',
        'Validation annulée',
        `${task?.title ?? 'Une tâche'} a été repassée ${statusLabel} par un parent.`,
        '↩️',
        '/enfant',
      )
      return true
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
      pushLog('penalty_applied', parentId, `« ${title} »${motif ? ` — ${motif}` : ''}`, childId, debit, transaction.id)
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

    // Undo rapide dans la minute suivante (bouton "Annuler" sur la page Pénalités) : fenêtre de 24h.
    cancelPenalty: (transactionId, parentId) => {
      const tx = get().transactions.find((t) => t.id === transactionId)
      if (!tx || tx.type !== 'penalty' || tx.cancelled) return
      if (Date.now() - tx.createdAt > PENALTY_CANCEL_WINDOW) {
        get().toast('Trop tard : une pénalité ne peut être annulée que sous 24 h.', 'error')
        return
      }
      reversePenaltyTx(tx, parentId)
      pushLog('penalty_cancelled', parentId, tx.description, tx.childId, -tx.amount, tx.id)
    },

    // Contrôle parental étendu (page Journal / Pénalités) : pas de limite de temps, correction explicite.
    deletePenaltyTransaction: (transactionId, parentId) => {
      const tx = get().transactions.find((t) => t.id === transactionId)
      if (!tx || tx.type !== 'penalty' || tx.cancelled) return false
      reversePenaltyTx(tx, parentId)
      pushLog('penalty_deleted', parentId, tx.description, tx.childId, -tx.amount, tx.id)
      notify(
        tx.childId,
        'penalty',
        'Pénalité supprimée',
        `« ${tx.description.replace('⚠️ ', '')} » a été annulée par un parent.`,
        '✅',
        '/enfant/historique',
      )
      return true
    },

    editPenaltyTransaction: (transactionId, patch, parentId) => {
      const tx = get().transactions.find((t) => t.id === transactionId)
      if (!tx || tx.type !== 'penalty' || tx.cancelled) return false
      reversePenaltyTx(tx, parentId)
      pushLog('penalty_edited', parentId, `${tx.description} → « ${patch.title} »`, tx.childId, undefined, tx.id)
      return get().applyPenalty(
        { childId: tx.childId, title: patch.title, motif: patch.motif, amount: patch.amount },
        parentId,
      )
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
      const next = { ...get().settings, ...patch }
      set({ settings: next })
      pushLog('settings_updated', actorId, Object.keys(patch).join(', '))
      save('settings', next)
      // Les réglages (dont les fonctionnalités activées) sont partagés en famille,
      // pas seulement sur cet appareil.
      pushRecord('sync_settings', 'main', next)
    },

    savePenaltyRule: (input, actorId) => {
      const { id, ...fields } = input
      if (id) {
        set((s) => ({ penaltyRules: s.penaltyRules.map((r) => (r.id === id ? { ...r, ...fields } : r)) }))
        pushLog('penalty_rule_updated', actorId, `« ${fields.title} »`, fields.childId)
      } else {
        const rule: PenaltyRule = { ...fields, id: uid(), createdBy: actorId, createdAt: Date.now() }
        set((s) => ({ penaltyRules: [rule, ...s.penaltyRules] }))
        pushLog('penalty_rule_created', actorId, `« ${rule.title} »`, rule.childId)
      }
      persist('penaltyRules')
    },

    deletePenaltyRule: (ruleId, actorId) => {
      const rule = get().penaltyRules.find((r) => r.id === ruleId)
      if (!rule) return
      set((s) => ({ penaltyRules: s.penaltyRules.filter((r) => r.id !== ruleId) }))
      pushLog('penalty_rule_deleted', actorId, `« ${rule.title} »`, rule.childId)
      persist('penaltyRules')
      deleteRecord('sync_penalty_rules', ruleId)
    },

    addSavingsGoal: (childId, title, icon, targetAmount, actorId) => {
      const trimmed = title.trim()
      if (!trimmed || targetAmount <= 0) return
      const goal: SavingsGoal = {
        id: uid(),
        childId,
        title: trimmed,
        icon,
        targetAmount,
        createdBy: actorId,
        createdAt: Date.now(),
      }
      set((s) => ({ savingsGoals: [goal, ...s.savingsGoals] }))
      pushLog('savings_goal_created', actorId, `« ${trimmed} » (${formatEuro(targetAmount)})`, childId)
      persist('savingsGoals')
    },

    deleteSavingsGoal: (goalId, actorId) => {
      const goal = get().savingsGoals.find((g) => g.id === goalId)
      if (!goal) return
      set((s) => ({ savingsGoals: s.savingsGoals.filter((g) => g.id !== goalId) }))
      pushLog('savings_goal_deleted', actorId, `« ${goal.title} »`, goal.childId)
      persist('savingsGoals')
      deleteRecord('sync_savings_goals', goalId)
    },

    createShopItem: (input, actorId) => {
      const trimmed = input.title.trim()
      if (!trimmed || input.cost <= 0) return
      const item: ShopItem = {
        id: uid(),
        title: trimmed,
        icon: input.icon,
        category: input.category,
        cost: input.cost,
        status: 'active',
        createdBy: actorId,
        createdAt: Date.now(),
      }
      set((s) => ({ shopItems: [item, ...s.shopItems] }))
      pushLog('shop_item_created', actorId, `« ${trimmed} » (${input.cost} pts)`)
      persist('shopItems')
    },

    deleteShopItem: (itemId, actorId) => {
      const item = get().shopItems.find((i) => i.id === itemId)
      if (!item) return
      set((s) => ({ shopItems: s.shopItems.filter((i) => i.id !== itemId) }))
      pushLog('shop_item_deleted', actorId, `« ${item.title} »`)
      persist('shopItems')
      deleteRecord('sync_shop_items', itemId)
    },

    proposeWish: (childId, title, icon, category) => {
      const trimmed = title.trim()
      if (!trimmed) return
      const item: ShopItem = {
        id: uid(),
        title: trimmed,
        icon,
        category,
        status: 'proposed',
        proposedBy: childId,
        createdBy: childId,
        createdAt: Date.now(),
      }
      set((s) => ({ shopItems: [item, ...s.shopItems] }))
      pushLog('wish_submitted', childId, `« ${trimmed} »`, childId)
      persist('shopItems')
      const child = get().users.find((u) => u.id === childId)
      notifyParents(
        'wish_submitted',
        'Nouveau vœu 🎁',
        `${child?.name ?? 'Un enfant'} aimerait : ${trimmed}`,
        icon,
        '/parent/boutique',
      )
    },

    approveWish: (itemId, cost, actorId) => {
      const item = get().shopItems.find((i) => i.id === itemId)
      if (!item || item.status !== 'proposed' || cost <= 0) return
      set((s) => ({
        shopItems: s.shopItems.map((i) => (i.id === itemId ? { ...i, status: 'active' as const, cost } : i)),
      }))
      pushLog('wish_approved', actorId, `« ${item.title} » ajouté à la boutique (${cost} pts)`, item.proposedBy)
      persist('shopItems')
      if (item.proposedBy) {
        notify(
          item.proposedBy,
          'wish_decided',
          'Ton vœu a été accepté ! 🎉',
          `« ${item.title} » est maintenant dans la boutique pour ${cost} points.`,
          item.icon,
          '/enfant/boutique',
        )
      }
    },

    rejectWish: (itemId, actorId) => {
      const item = get().shopItems.find((i) => i.id === itemId)
      if (!item || item.status !== 'proposed') return
      set((s) => ({ shopItems: s.shopItems.filter((i) => i.id !== itemId) }))
      pushLog('wish_rejected', actorId, `« ${item.title} »`, item.proposedBy)
      persist('shopItems')
      deleteRecord('sync_shop_items', itemId)
      if (item.proposedBy) {
        notify(
          item.proposedBy,
          'wish_decided',
          'Vœu non retenu',
          `« ${item.title} » n'a pas été ajouté à la boutique cette fois.`,
          '😕',
          '/enfant/boutique',
        )
      }
    },

    redeemShopItem: (childId, itemId, actorId) => {
      const item = get().shopItems.find((i) => i.id === itemId)
      if (!item || item.status !== 'active' || item.cost === undefined) return false
      const balance = computePoints(get().pointsTransactions, childId)
      if (balance < item.cost) {
        get().toast('Pas assez de points pour ce lot.', 'error')
        return false
      }
      const redemption: Redemption = {
        id: uid(),
        childId,
        itemId,
        title: item.title,
        icon: item.icon,
        cost: item.cost,
        status: 'pending',
        requestedAt: Date.now(),
      }
      const ptx: PointsTransaction = {
        id: uid(),
        childId,
        type: 'shop_redeem',
        amount: -item.cost,
        description: `${item.icon} ${item.title}`,
        relatedTo: redemption.id,
        createdBy: actorId,
        createdAt: Date.now(),
      }
      set((s) => ({
        redemptions: [redemption, ...s.redemptions],
        pointsTransactions: [ptx, ...s.pointsTransactions],
      }))
      pushLog('redemption_requested', actorId, `« ${item.title} » (${item.cost} pts)`, childId, undefined, redemption.id)
      persist('redemptions')
      persist('pointsTransactions')
      const child = get().users.find((u) => u.id === childId)
      notifyParents(
        'redemption_requested',
        'Échange demandé 🎁',
        `${child?.name ?? 'Un enfant'} veut échanger ${item.cost} points contre « ${item.title} ».`,
        item.icon,
        '/parent/boutique',
      )
      return true
    },

    fulfillRedemption: (redemptionId, actorId) => {
      const red = get().redemptions.find((r) => r.id === redemptionId)
      if (!red || red.status !== 'pending') return
      set((s) => ({
        redemptions: s.redemptions.map((r) =>
          r.id === redemptionId ? { ...r, status: 'fulfilled' as const, fulfilledAt: Date.now(), fulfilledBy: actorId } : r,
        ),
      }))
      pushLog('redemption_fulfilled', actorId, `« ${red.title} »`, red.childId, undefined, red.id)
      persist('redemptions')
      notify(red.childId, 'redemption_fulfilled', 'Ton lot est prêt ! 🎉', `« ${red.title} » t'attend.`, red.icon, '/enfant/boutique')
    },

    cancelRedemption: (redemptionId, actorId) => {
      const red = get().redemptions.find((r) => r.id === redemptionId)
      if (!red || red.status !== 'pending') return
      set((s) => ({
        redemptions: s.redemptions.map((r) => (r.id === redemptionId ? { ...r, status: 'cancelled' as const } : r)),
      }))
      const refund: PointsTransaction = {
        id: uid(),
        childId: red.childId,
        type: 'shop_refund',
        amount: red.cost,
        description: `Remboursement — ${red.title}`,
        relatedTo: red.id,
        createdBy: actorId,
        createdAt: Date.now(),
      }
      set((s) => ({ pointsTransactions: [refund, ...s.pointsTransactions] }))
      pushLog('redemption_cancelled', actorId, `« ${red.title} » — points remboursés`, red.childId, undefined, red.id)
      persist('redemptions')
      persist('pointsTransactions')
      notify(
        red.childId,
        'redemption_fulfilled',
        'Échange annulé',
        `« ${red.title} » a été annulé, tes points sont remboursés.`,
        '↩️',
        '/enfant/boutique',
      )
    },

    convertPointsToMoney: (childId, points, actorId) => {
      if (points <= 0 || !Number.isInteger(points)) return false
      const balance = computePoints(get().pointsTransactions, childId)
      if (points > balance) {
        get().toast('Pas assez de points.', 'error')
        return false
      }
      const cents = Math.round((points / get().settings.pointsPerEuro) * 100)
      if (cents <= 0) return false
      const ptx: PointsTransaction = {
        id: uid(),
        childId,
        type: 'points_to_money',
        amount: -points,
        description: `Conversion en argent (${points} pts)`,
        createdBy: actorId,
        createdAt: Date.now(),
      }
      const tx: Transaction = {
        id: uid(),
        type: 'points_conversion',
        childId,
        amount: cents,
        description: `💱 Conversion de ${points} points`,
        createdBy: actorId,
        createdAt: Date.now(),
      }
      set((s) => ({
        pointsTransactions: [ptx, ...s.pointsTransactions],
        transactions: [tx, ...s.transactions],
      }))
      pushLog('points_converted', actorId, `${points} points → ${formatEuro(cents)}`, childId, cents)
      persist('pointsTransactions')
      persist('transactions')
      get().toast(`${formatEuro(cents)} ajoutés à ton solde !`)
      return true
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
