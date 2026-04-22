import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stockbase.app',
  appName: 'StockBase',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      // Все приватные IPv4-диапазоны (RFC 1918), чтобы приложение работало
      // в любой локальной сети без пересборки APK.
      '192.168.*.*',
      '10.*.*.*',
      '172.16.*.*', '172.17.*.*', '172.18.*.*', '172.19.*.*',
      '172.20.*.*', '172.21.*.*', '172.22.*.*', '172.23.*.*',
      '172.24.*.*', '172.25.*.*', '172.26.*.*', '172.27.*.*',
      '172.28.*.*', '172.29.*.*', '172.30.*.*', '172.31.*.*',
      // Link-local и loopback — на случай тестового окружения.
      '169.254.*.*',
      'localhost',
    ],
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;