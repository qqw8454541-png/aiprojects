import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mahjongscorer.app',
  appName: 'MahjongScorer',
  webDir: 'out',
  backgroundColor: '#09090b',
  android: {
    backgroundColor: '#09090b',
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#09090b',
      launchAutoHide: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#09090b',
    },
  },
};

export default config;
