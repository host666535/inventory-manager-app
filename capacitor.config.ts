import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stockbase.app',
  appName: 'StockBase',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      '192.168.2.139',
      '192.168.*.*',
      '10.*.*.*',
    ],
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
