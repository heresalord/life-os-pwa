import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kmsstudio.lifeos',
  appName: 'Life OS',
  webDir: 'dist',
  // ── Dev mode: uncomment + set your local IP to enable live reload ──
  // server: {
  //   url: 'http://YOUR_LOCAL_IP:5173',
  //   cleartext: true,
  // },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0a0a0a',
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
  },
}

export default config
