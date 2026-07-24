import { supabase } from './supabase'

// Sync gÃ©nÃ©rique : chaque entitÃ© partagÃ©e (users, tasks, submissions, transactions)
// est stockÃ©e dans une table Supabase dÃ©diÃ©e sous forme d'un blob JSON (colonne `data`),
// avec l'id mÃ©tier comme clÃ© primaire. Ãa Ã©vite de dupliquer/maintenir un schÃ©ma SQL
// qui doit rester en phase avec les types TypeScript de l'app Ã  chaque Ã©volution.

export type SyncTable = 'sync_users' | 'sync_tasks' | 'sync_submissions' | 'sync_transactions'

export async function fetchAll<T>(table: SyncTable): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('id, data')
  if (error) {
    console.error(`â Sync : lecture ${table} Ã©chouÃ©e`, error.message)
    return []
  }
  return (data ?? []).map((row) => (row as { data: T }).data)
}

export function pushRecord(table: SyncTable, id: string, record: unknown): void {
  void supabase
    .from(table)
    .upsert({ id, data: record, updated_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) console.error(`â Sync : Ã©criture ${table}/${id} Ã©chouÃ©e`, error.message)
    })
}

export function deleteRecord(table: SyncTable, id: string): void {
  void supabase
    .from(table)
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error(`â Sync : suppression ${table}/${id} Ã©chouÃ©e`, error.message)
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
