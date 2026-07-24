import { supabase } from './supabase'

// Sync générique : chaque entité partagée (users, tasks, submissions, transactions)
// est stockée dans une table Supabase dédiée sous forme d'un blob JSON (colonne `data`),
// avec l'id métier comme clé primaire. Ça évite de dupliquer/maintenir un schéma SQL
// qui doit rester en phase avec les types TypeScript de l'app à chaque évolution.

export type SyncTable =
  | 'sync_users'
  | 'sync_tasks'
  | 'sync_submissions'
  | 'sync_transactions'
  | 'sync_savings_goals'
  | 'sync_settings'

export async function fetchAll<T>(table: SyncTable): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('id, data')
  if (error) {
    console.error(`❌ Sync : lecture ${table} échouée`, error.message)
    return []
  }
  return (data ?? []).map((row) => (row as { data: T }).data)
}

export function pushRecord(table: SyncTable, id: string, record: unknown): void {
  void supabase
    .from(table)
    .upsert({ id, data: record, updated_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) console.error(`❌ Sync : écriture ${table}/${id} échouée`, error.message)
    })
}

export function deleteRecord(table: SyncTable, id: string): void {
  void supabase
    .from(table)
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error(`❌ Sync : suppression ${table}/${id} échouée`, error.message)
    })
}

export function subscribeTable<T>(
  table: SyncTable,
  onChange: (record: T, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void,
): () => void {
  const channel = supabase
    .channel(`${table}-${Math.random()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: { data?: T }; old: { data?: T; id?: string } }) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old?.data ?? ({ id: payload.old?.id } as unknown as T)
          onChange(old, 'DELETE')
        } else if (payload.new?.data) {
          onChange(payload.new.data, payload.eventType)
        }
      },
    )
    .subscribe()
  return () => void supabase.removeChannel(channel)
}
