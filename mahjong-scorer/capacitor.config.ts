import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mahjongscorer.app',
  appName: 'デジタル点棒',
  webDir: 'out',
  backgroundColor: '#ffffff',
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'xkpebhhwkuqrywqckrlu.supabase.co',
      'llm-web-api.vercel.app',
    ],
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#ffffff',
      launchAutoHide: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
