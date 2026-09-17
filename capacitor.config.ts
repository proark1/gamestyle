import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Jumbleyard Multi-Platform Capacitor Configuration
 *
 * Supports both standalone local asset bundling (`dist/client`)
 * and live-server connected mode (`https://www.jumbleyard.com`).
 */
const config: CapacitorConfig = {
  appId: 'com.jumbleyard.app',
  appName: 'Jumbleyard',
  webDir: 'dist/client',
  server: {
    // If CAPACITOR_SERVER_URL is provided, the native shell connects directly
    // to the live production server with real-time multiplayer WebSockets / WebRTC.
    url: process.env.CAPACITOR_SERVER_URL,
    cleartext: process.env.NODE_ENV !== 'production',
    androidScheme: 'https',
    iosScheme: 'capacitor',
    allowNavigation: [
      'www.jumbleyard.com',
      'jumbleyard.up.railway.app',
      '*.railway.app',
      '10.0.2.2',
      'localhost',
      '*.local',
    ],
  },
  plugins: {
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
