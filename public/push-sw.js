// push-sw.js — imported by the Workbox-generated service worker via importScripts().
// Handles Web Push notification display and notification-click routing.
// Keep this file free of ES-module syntax (importScripts requires classic scripts).

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Life OS', body: event.data.text() }
  }

  const title = payload.title ?? 'Life OS'
  const options = {
    body:   payload.body  ?? '',
    icon:   '/icons/icon-192.png',
    badge:  '/icons/icon-192.png',
    data:   { url: payload.url ?? '/' },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing tab if one is already open at this URL
        for (const client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
  )
})
