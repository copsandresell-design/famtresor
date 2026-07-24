import { supabase } from './supabase'
import type { AppNotification } from '../types'

// Canal broadcast Supabase : diffuse les notifications entre appareils
// sans passer par une table (les données restent locales à la famille).

const CHANNEL = 'famtresor-notifications'
const EVENT = 'notification'

let channel: ReturnType<typeof supabase.channel> | null = null

function getChannel() {
  if (!channel) {
    channel = supabase.channel(CHANNEL, { config: { broadcast: { self: false } } })
  }
  return channel
}

export function subscribeToNotifications(
  onNotification: (notif: AppNotification) => void,
): () => void {
  const ch = getChannel()
  ch.on('broadcast', { event: EVENT }, (payload: any) => {
    const notif = payload?.payload as AppNotification | undefined
    if (notif?.id && notif.userId) onNotification(notif)
  })
  ch.subscribe()
  return () => {
    if (channel) {
      void supabase.removeChannel(channel)
      channel = null
    }
  }
}

export function broadcastNotification(notif: AppNotification): void {
  void getChannel().send({ type: 'broadcast', event: EVENT, payload: notif })
}
