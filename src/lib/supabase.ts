import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zqflavaescqohivvvnnmw.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_IZyNBPrgZVVAM7EbfRy7Og_cX-nY-A5'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Types pour les tables
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          type: 'parent' | 'child'
          pin: string | null
          password_hash: string | null
          avatar_url: string | null
          color: string | null
          solde: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Row']>
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          amount: number
          category: string
          icon: string
          type: 'ponctuelle' | 'recurrente'
          recurrence: string | null
          assigned_to: string[]
          created_by: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tasks']['Row']>
      }
      submissions: {
        Row: {
          id: string
          task_id: string
          child_id: string
          status: 'pending' | 'approved' | 'rejected'
          is_initiative: boolean
          photos: string[] | null
          comment: string | null
          rejection_reason: string | null
          submitted_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['submissions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['submissions']['Row']>
      }
      transactions: {
        Row: {
          id: string
          child_id: string
          amount: number
          type: string
          description: string | null
          related_to: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['transactions']['Row']>
      }
      penalties: {
        Row: {
          id: string
          title: string
          amount: number
          description: string | null
          applied_to: string
          applied_by: string
          can_cancel_until: string | null
          is_cancelled: boolean
          cancelled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['penalties']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['penalties']['Row']>
      }
      audit_logs: {
        Row: {
          id: string
          action: string
          actor_id: string | null
          subject_id: string | null
          details: Record<string, any> | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['audit_logs']['Row']>
      }
      profile_photos: {
        Row: {
          id: string
          user_id: string
          photo_url: string
          uploaded_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profile_photos']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profile_photos']['Row']>
      }
    }
  }
}
