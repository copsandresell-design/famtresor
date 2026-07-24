/// <reference lib="webworker" />
// Service worker custom (stratégie injectManifest) : precache Workbox comme avant,
// + gestion des vraies notifications push (reçues même app fermée) et du clic dessus.
// Exclu du typecheck de l'app (voir tsconfig.app.json) car les libs DOM/WebWorker
// sont incompatibles entre elles — esbuild (vite build) transpile sans vérifier les types.
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
self.addEventListener('activate', () => {
  void self.clients.claim()
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

interface PushPayload {
  title: string
  body: string
  icon?: string
  link?: string
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = { title: 'FamTrésor', body: 'Nouvelle notification' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    if (event.data) payload.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icons/icon.svg',
      badge: '/icons/icon.svg',
      data: { link: payload.link || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const link = (event.notification.data?.link as string) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          void client.focus()
          if ('navigate' in client) void (client as WindowClient).navigate(link)
          return
        }
      }
      return self.clients.openWindow(link)
    }),
  )
})
