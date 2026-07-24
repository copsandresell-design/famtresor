import { useEffect, useMemo } from 'react'
import { subscribeToNotifications } from '../lib/realtime'
import { playNotificationSound } from '../lib/sound'
import { useStore } from '../store/useStore'

/** Notifications de l'utilisateur connecté, avec actions de lecture. */
export function useNotifications() {
  const session = useStore((s) => s.session)
  const all = useStore((s) => s.notifications)
  const markRead = useStore((s) => s.markNotificationRead)
  const markAllReadStore = useStore((s) => s.markAllNotificationsRead)
  const clearStore = useStore((s) => s.clearNotifications)

  const userId = session?.userId

  const notifications = useMemo(
    () => (userId ? all.filter((n) => n.userId === userId) : []),
    [all, userId],
  )
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead: () => userId && markAllReadStore(userId),
    clearAll: () => userId && clearStore(userId),
  }
}

/**
 * À monter une seule fois (App) : reçoit les notifications diffusées par les
 * autres appareils via Supabase, et alerte l'utilisateur connecté (toast + son).
 */
export function useNotificationRealtime() {
  const receive = useStore((s) => s.receiveNotification)
  const toast = useStore((s) => s.toast)

  useEffect(() => {
    return subscribeToNotifications((notif) => {
      const { session, notifications } = useStore.getState()
      if (notifications.some((n) => n.id === notif.id)) return
      receive(notif)
      if (session && notif.userId === session.userId) {
        toast(`${notif.icon} ${notif.title}`)
        playNotificationSound(notif.type === 'task_rejected' || notif.type === 'penalty' ? 'error' : 'success')
      }
    })
  }, [receive, toast])
}
