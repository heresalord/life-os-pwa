import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kmsstudio.lifeos',
  appName: 'Life OS',
  webDir: 'dist',
  // During development, point to your local dev server so you can live-reload
  // on a real device. Comment this out before a production build.
  // server: {
  //   url: 'http://YOUR_LOCAL_IP:5173',
  //   cleartext: true,
  // },
  ios: {
    contentInset: 'automatic',   // respects notch / Dynamic Island / home indicator
    backgroundColor: '#0a0a0a',
    scrollEnabled: false,        // the app handles its own scrolling
  },
  plugins: {
    // SplashScreen is built into Capacitor — hide it as soon as React mounts
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
  },
}

export default config
