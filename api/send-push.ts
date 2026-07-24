// Fonction serverless Vercel : reçoit une notification créée côté app et l'envoie
// en vraie notification push OS (via Web Push / VAPID) à tous les appareils abonnés
// de l'utilisateur visé — y compris si l'app est complètement fermée sur ces appareils.
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@famtresor.app'

interface PushSubRow {
  id: string
  endpoint: string
  subscription: webpush.PushSubscription
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('send-push: configuration manquante', {
      hasUrl: !!SUPABASE_URL,
      hasServiceKey: !!SUPABASE_SERVICE_KEY,
      hasVapidPublic: !!VAPID_PUBLIC_KEY,
      hasVapidPrivate: !!VAPID_PRIVATE_KEY,
    })
    res.status(500).json({ error: 'Configuration push manquante côté serveur' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const { userId, title, body: message, icon, link } = body

  if (!userId || !title || !message) {
    res.status(400).json({ error: 'userId, title, body requis' })
    return
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, subscription')
    .eq('user_id', userId)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  if (!subs || subs.length === 0) {
    res.status(200).json({ sent: 0 })
    return
  }

  const payload = JSON.stringify({ title, body: message, icon, link })
  let sent = 0

  await Promise.all(
    (subs as PushSubRow[]).map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload)
        sent++
      } catch (err: any) {
        const statusCode = err?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          // Abonnement expiré/révoqué côté navigateur : on le nettoie.
          await supabase.from('push_subscriptions').delete().eq('id', row.id)
        } else {
          console.error('send-push: échec envoi', row.endpoint, statusCode, err?.message)
        }
      }
    }),
  )

  res.status(200).json({ sent })
}
