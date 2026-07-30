import { useEffect } from 'react'
import { subscribeTable, type SyncTable } from '../lib/sync'
import { useDemoMode } from '../store/demoStore'
import { useStore } from '../store/useStore'
import type {
  AuditLog,
  BadgeDef,
  PenaltyRule,
  PointsTransaction,
  RankDef,
  Redemption,
  RewardClaim,
  SavingsGoal,
  Settings,
  ShopItem,
  StreakDef,
  Task,
  TaskSubmission,
  Transaction,
  User,
} from '../types'

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
  | 'streakDefs'
  | 'badgeDefs'
  | 'rankDefs'

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
  | StreakDef
  | BadgeDef
  | RankDef

const TABLES: { table: SyncTable; key: RemoteEntityKey }[] = [
  { table: 'sync_users', key: 'users' },
  { table: 'sync_tasks', key: 'tasks' },
  { table: 'sync_submissions', key: 'submissions' },
  { table: 'sync_transactions', key: 'transactions' },
  { table: 'sync_savings_goals', key: 'savingsGoals' },
  { table: 'sync_logs', key: 'logs' },
  { table: 'sync_points_transactions', key: 'pointsTransactions' },
  { table: 'sync_reward_claims', key: 'rewardClaims' },
  { table: 'sync_penalty_rules', key: 'penaltyRules' },
  { table: 'sync_shop_items', key: 'shopItems' },
  { table: 'sync_redemptions', key: 'redemptions' },
  { table: 'sync_streak_defs', key: 'streakDefs' },
  { table: 'sync_badge_defs', key: 'badgeDefs' },
  { table: 'sync_rank_defs', key: 'rankDefs' },
]

/**
 * À monter une seule fois (App) : garde la famille, les tâches, les soumissions,
 * les transactions, le journal, les points, les règles de pénalité, la boutique
 * et les réglages synchronisés en temps réel entre tous les appareils.
 */
export function useDataRealtime() {
  const demoActive = useDemoMode((s) => s.active)
  const receiveUpsert = useStore((s) => s.receiveRemoteUpsert)
  const receiveDelete = useStore((s) => s.receiveRemoteDelete)
  const receiveSettings = useStore((s) => s.receiveRemoteSettings)
  const syncFromRemote = useStore((s) => s.syncFromRemote)

  useEffect(() => {
    // Mode démo : aucune donnée réelle ne doit transiter par le réseau (voir store/demoStore.ts)
    // — on coupe entièrement la synchro Supabase tant que la démo est active.
    if (demoActive) return
    const unsubs = TABLES.map(({ table, key }) =>
      subscribeTable<RemoteEntity>(table, (record, eventType) => {
        if (eventType === 'DELETE') receiveDelete(key, (record as { id: string }).id)
        else receiveUpsert(key, record)
      }),
    )
    unsubs.push(
      subscribeTable<Settings>('sync_settings', (record, eventType) => {
        if (eventType !== 'DELETE') receiveSettings(record)
      }),
    )

    // Le WebSocket realtime est souvent coupé quand l'app PWA passe en arrière-plan
    // sur mobile : au retour au premier plan, on refait un fetch complet par sécurité.
    const refetch = () => {
      if (document.visibilityState === 'visible') void syncFromRemote()
    }
    document.addEventListener('visibilitychange', refetch)
    window.addEventListener('focus', refetch)

    return () => {
      document.removeEventListener('visibilitychange', refetch)
      window.removeEventListener('focus', refetch)
      unsubs.forEach((u) => u())
    }
  }, [receiveUpsert, receiveDelete, receiveSettings, syncFromRemote, demoActive])
}
