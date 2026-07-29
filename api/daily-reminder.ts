// Fonction serverless Vercel (cron quotidien, voir vercel.json) : envoie un petit rappel
// push à chaque enfant qui n'a encore rien signalé de la journée. Auto-contenue (pas
// d'import depuis src/), même logique que api/check-inactivity.ts.
//
// Limite du plan Vercel Hobby : un cron ne peut s'exécuter qu'une fois par jour. Ce fichier
// est donc appelé une seule fois (voir schedule dans vercel.json, ~17h30 UTC) et compare
// l'heure locale (Europe/Paris) au réglage `dailyReminder.hour` du parent : si l'heure
// configurée est postérieure à l'heure réelle d'exécution du cron, le rappel de ce jour-là
// est tout simplement sauté (pas de second essai avant le lendemain).
//
// Idempotence : un rappel n'est envoyé qu'une fois par jour et par enfant, via la table
// sync_automation_log (clé 'reminder:<childId>:<date>'), comme pour l'inactivité.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const CRON_SECRET = process.env.CRON_SECRET || ''

interface User {
  id: string
  role: 'parent' | 'child'
  name: string
  isActive: boolean
}

interface TaskSubmission {
  id: string
  childId: string
  submittedAt: number
}

interface DailyReminderSettings {
  enabled: boolean
  hour: number
}

interface Settings {
  dailyReminder?: DailyReminderSettings
}

/** Date du jour au format AAAA-MM-JJ dans le fuseau Europe/Paris (clé d'idempotence). */
function parisDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Heure locale (0-23) dans le fuseau Europe/Paris. */
function parisHour(d: Date): number {
  return parseInt(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: 'numeric', hourCycle: 'h23' }).format(d),
    10,
  )
}

const uid = () => crypto.randomUUID()

export default async function handler(req: any, res: any) {
  if (CRON_SECRET) {
    const auth = req.headers?.authorization || req.headers?.Authorization
    if (auth !== `Bearer ${CRON_SECRET}`) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('daily-reminder: configuration Supabase manquante')
    res.status(500).json({ error: 'Configuration Supabase manquante côté serveur' })
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const now = new Date()
  const today = parisDateKey(now)

  async function readTable<T>(table: string): Promise<T[]> {
    const { data, error } = await supabase.from(table).select('id, data')
    if (error) {
      console.error(`daily-reminder: lecture ${table} échouée`, error.message)
      return []
    }
    return (data ?? []).map((row: any) => row.data as T)
  }

  async function alreadySent(key: string): Promise<boolean> {
    const { data } = await supabase.from('sync_automation_log').select('id').eq('data->>key', key).limit(1)
    return !!data && data.length > 0
  }

  async function markSent(key: string): Promise<void> {
    const id = uid()
    await supabase.from('sync_automation_log').insert({ id, data: { id, key, createdAt: Date.now() } })
  }

  async function pushLog(childId: string, details: string) {
    const row = {
      id: uid(),
      action: 'daily_reminder_sent',
      actorId: 'system',
      subjectId: childId,
      details,
      timestamp: Date.now(),
    }
    await supabase.from('sync_logs').upsert({ id: row.id, data: row, updated_at: new Date().toISOString() })
  }

  async function sendPush(userId: string, title: string, body: string, icon: string, link: string) {
    try {
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
      if (!base) return
      await fetch(`${base}/api/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, body, icon, link }),
      })
    } catch (err) {
      console.error('daily-reminder: push échoué', err)
    }
  }

  const settingsRows = await readTable<Settings>('sync_settings')
  const settings = settingsRows[0]
  const reminder = settings?.dailyReminder
  if (!reminder?.enabled) {
    res.status(200).json({ skipped: true, reason: 'disabled' })
    return
  }
  if (parisHour(now) < reminder.hour) {
    res.status(200).json({ skipped: true, reason: 'before-configured-hour' })
    return
  }

  const users = await readTable<User>('sync_users')
  const children = users.filter((u) => u.role === 'child' && u.isActive)
  const submissions = await readTable<TaskSubmission>('sync_submissions')

  let sent = 0
  for (const child of children) {
    const doneToday = submissions.some((s) => s.childId === child.id && parisDateKey(new Date(s.submittedAt)) === today)
    if (doneToday) continue

    const key = `reminder:${child.id}:${today}`
    if (await alreadySent(key)) continue

    const message = "N'oublie pas tes tâches du jour !"
    await sendPush(child.id, 'Petit rappel 👋', message, '⏰', '/enfant')
    await pushLog(child.id, `${child.name} : rappel envoyé (aucune tâche signalée aujourd'hui)`)
    await markSent(key)
    sent++
  }

  res.status(200).json({ ok: true, sent })
}
