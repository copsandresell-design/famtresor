import { useEffect } from 'react'
import { subscribeTable, type SyncTable } from '../lib/sync'
import { useStore } from '../store/useStore'
import type { Task, TaskSubmission, Transaction, User } from '../types'

const TABLES: { table: SyncTable; key: 'users' | 'tasks' | 'submissions' | 'transactions' }[] = [
  { table: 'sync_users', key: 'users' },
  { table: 'sync_tasks', key: 'tasks' },
  { table: 'sync_submissions', key: 'submissions' },
  { table: 'sync_transactions', key: 'transactions' },
]

/**
 * Ã monter une seule fois (App) : garde la famille, les tÃ¢ches, les soumissions
 * et les transactions synchronisÃ©es en temps rÃ©el entre tous les appareils.
 */
export function useDataRealtime() {
  const receiveUpsert = useStore((s) => s.receiveRemoteUpsert)
  const receiveDelete = useStore((s) => s.receiveRemoteDelete)
  const syncFromRemote = useStore((s) => s.syncFromRemote)

  useEffect(() => {
    const unsubs = TABLES.map(({ table, key }) =>
      subscribeTable<User | Task | TaskSubmission | Transaction>(table, (record, eventType) => {
        if (eventType === 'DELETE') receiveDelete(key, (record as { id: string }).id)
        else receiveUpsert(key, record)
      }),
    )

    // Le WebSocket realtime est souvent coupÃ© quand l'app PWA passe en arriÃ¨re-plan
    // sur mobile : au retour au premier plan, on refait un fetch complet par sÃ©curitÃ©.
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
  }, [receiveUpsert, receiveDelete, syncFromRemote])
}
