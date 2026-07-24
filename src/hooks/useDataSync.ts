import { useEffect } from 'react'
import { subscribeTable, type SyncTable } from '../lib/sync'
import { useStore } from '../store/useStore'
import type { SavingsGoal, Settings, Task, TaskSubmission, Transaction, User } from '../types'

const TABLES: { table: SyncTable; key: 'users' | 'tasks' | 'submissions' | 'transactions' | 'savingsGoals' }[] = [
  { table: 'sync_users', key: 'users' },
  { table: 'sync_tasks', key: 'tasks' },
  { table: 'sync_submissions', key: 'submissions' },
  { table: 'sync_transactions', key: 'transactions' },
  { table: 'sync_savings_goals', key: 'savingsGoals' },
]

/**
 * À monter une seule fois (App) : garde la famille, les tâches, les soumissions,
 * les transactions, les objectifs d'épargne et les réglages synchronisés en
 * temps réel entre tous les appareils.
 */
export function useDataRealtime() {
  const receiveUpsert = useStore((s) => s.receiveRemoteUpsert)
  const receiveDelete = useStore((s) => s.receiveRemoteDelete)
  const receiveSettings = useStore((s) => s.receiveRemoteSettings)
  const syncFromRemote = useStore((s) => s.syncFromRemote)

  useEffect(() => {
    const unsubs = TABLES.map(({ table, key }) =>
      subscribeTable<User | Task | TaskSubmission | Transaction | SavingsGoal>(table, (record, eventType) => {
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
  }, [receiveUpsert, receiveDelete, receiveSettings, syncFromRemote])
}
