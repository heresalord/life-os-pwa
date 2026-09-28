/// <reference types="vite-plugin-pwa/client" />
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { registerSW } from 'virtual:pwa-register'
import { Capacitor } from '@capacitor/core'

// Register Service Worker on web/PWA only (not in native Capacitor webview,
// where assets are bundled locally in the binary).
// Uses 'prompt' mode (update-on-next-launch) so active sessions are never
// interrupted or reloaded mid-typing.
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  registerSW({ immediate: true })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
