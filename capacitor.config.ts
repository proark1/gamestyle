import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Jumbleyard Multi-Platform Capacitor Configuration
 *
 * Ships the locally bundled client. Remote pages are development-only.
 */
const config: CapacitorConfig = {
  appId: 'com.jumbleyard.app',
  appName: 'Jumbleyard',
  webDir: 'dist/native',
  server: {
    ...(process.env.CAPACITOR_DEV_SERVER_URL
      ? { url: process.env.CAPACITOR_DEV_SERVER_URL }
      : {}),
    cleartext: !!process.env.CAPACITOR_DEV_SERVER_URL?.startsWith('http:'),
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  plugins: {
    CapacitorHttp: { enabled: true },
    CapacitorCookies: { enabled: true },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#b7d0c3',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#b7d0c3',
    },
  },
};

export default config;
