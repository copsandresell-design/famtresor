import { supabase } from './supabase'

// Clé publique VAPID — publique par nature (couplée en face à la clé privée
// côté serveur dans les variables d'env Vercel), donc ok en dur ici comme le
// reste des clés publiques de l'app (voir supabase.ts).
export const VAPID_PUBLIC_KEY =
  'BLx5eYSLVAF-t0Dw4b2OqZIq5Y_3JcwqSI05DnjkWbX3u0ccKtPM9dJlXdMcK99dvEXdKXjuvr77JGcE-EIE3EU'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

export async function isSubscribedToPush(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}

/** Demande la permission puis abonne l'appareil courant aux push pour `userId`. */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      subscription: json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    console.error('❌ Push : abonnement non enregistré', error.message)
    return false
  }
  return true
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

/** Déclenche l'envoi d'un push serveur à tous les appareils abonnés d'un user. */
export function sendPushTo(userId: string, title: string, body: string, icon?: string, link?: string): void {
  void fetch('/api/send-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, title, body, icon, link }),
  }).catch((err) => console.error('❌ Push : envoi serveur échoué', err))
}
