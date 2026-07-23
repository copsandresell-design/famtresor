import { useEffect, useState, useCallback } from 'react'
import { supabase, type Database } from '../lib/supabase'

// Hook pour récupérer les tâches avec sync real-time
export const useTasks = () => {
  const [tasks, setTasks] = useState<Database['public']['Tables']['tasks']['Row'][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch initial tasks
    const fetchTasks = async () => {
      try {
        const { data, error: err } = await supabase
          .from('tasks')
          .select('*')
          .eq('is_active', true)

        if (err) throw err
        setTasks(data || [])
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()

    // Subscribe to real-time updates
    const subscription = supabase
      .from('tasks')
      .on('*', (payload) => {
        if (payload.eventType === 'INSERT') {
          setTasks(prev => [...prev, payload.new as Database['public']['Tables']['tasks']['Row']])
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new as Database['public']['Tables']['tasks']['Row'] : t))
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const createTask = useCallback(async (task: Database['public']['Tables']['tasks']['Insert']) => {
    const { data, error } = await supabase.from('tasks').insert([task]).select()
    if (error) throw error
    return data
  }, [])

  const updateTask = useCallback(async (id: string, updates: Database['public']['Tables']['tasks']['Update']) => {
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select()
    if (error) throw error
    return data
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase.from('tasks').update({ is_active: false }).eq('id', id)
    if (error) throw error
  }, [])

  return { tasks, loading, error, createTask, updateTask, deleteTask }
}

// Hook pour récupérer les soumissions (tâches en attente)
export const useSubmissions = () => {
  const [submissions, setSubmissions] = useState<Database['public']['Tables']['submissions']['Row'][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const { data, error: err } = await supabase
          .from('submissions')
          .select('*')

        if (err) throw err
        setSubmissions(data || [])
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissions()

    // Subscribe to real-time updates
    const subscription = supabase
      .from('submissions')
      .on('*', (payload) => {
        if (payload.eventType === 'INSERT') {
          setSubmissions(prev => [...prev, payload.new as Database['public']['Tables']['submissions']['Row']])
        } else if (payload.eventType === 'UPDATE') {
          setSubmissions(prev => prev.map(s => s.id === payload.new.id ? payload.new as Database['public']['Tables']['submissions']['Row'] : s))
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const submitTask = useCallback(async (submission: Database['public']['Tables']['submissions']['Insert']) => {
    const { data, error } = await supabase.from('submissions').insert([submission]).select()
    if (error) throw error
    return data
  }, [])

  const approveSubmission = useCallback(async (id: string, reviewedBy: string, bonus: boolean) => {
    const { error } = await supabase
      .from('submissions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy
      })
      .eq('id', id)

    if (error) throw error
  }, [])

  const rejectSubmission = useCallback(async (id: string, reviewedBy: string, reason: string) => {
    const { error } = await supabase
      .from('submissions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        rejection_reason: reason
      })
      .eq('id', id)

    if (error) throw error
  }, [])

  return {
    submissions,
    loading,
    error,
    submitTask,
    approveSubmission,
    rejectSubmission
  }
}

// Hook pour récupérer les utilisateurs
export const useUsers = () => {
  const [users, setUsers] = useState<Database['public']['Tables']['users']['Row'][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error: err } = await supabase
          .from('users')
          .select('*')
          .eq('is_active', true)

        if (err) throw err
        setUsers(data || [])
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()

    // Subscribe to real-time updates
    const subscription = supabase
      .from('users')
      .on('*', (payload) => {
        if (payload.eventType === 'UPDATE') {
          setUsers(prev => prev.map(u => u.id === payload.new.id ? payload.new as Database['public']['Tables']['users']['Row'] : u))
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const updateUser = useCallback(async (id: string, updates: Database['public']['Tables']['users']['Update']) => {
    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select()
    if (error) throw error
    return data
  }, [])

  return { users, loading, error, updateUser }
}

// Hook pour récupérer l'historique des transactions
export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Database['public']['Tables']['transactions']['Row'][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const { data, error: err } = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false })

        if (err) throw err
        setTransactions(data || [])
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()

    // Subscribe to real-time updates
    const subscription = supabase
      .from('transactions')
      .on('INSERT', (payload) => {
        setTransactions(prev => [payload.new as Database['public']['Tables']['transactions']['Row'], ...prev])
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const createTransaction = useCallback(async (transaction: Database['public']['Tables']['transactions']['Insert']) => {
    const { data, error } = await supabase.from('transactions').insert([transaction]).select()
    if (error) throw error
    return data
  }, [])

  return { transactions, loading, error, createTransaction }
}
