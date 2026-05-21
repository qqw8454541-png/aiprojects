import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import I18nProvider from '@/components/I18nProvider';
import ThemeProviders from '@/components/ThemeProviders';
import TopBar from '@/components/TopBar';
import SwipeNavigation from '@/components/SwipeNavigation';
import { SyncProvider } from '@/components/SyncProvider';
import './globals.css';

const notoSansJP = Noto_Sans_JP({
  variable: '--font-noto-sans-jp',
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
});

export const metadata: Metadata = {
  title: '麻雀スコアラー | Mahjong Scorer',
  description: 'オフライン麻雀の戦績管理ツール - Offline Riichi Mahjong Score Tracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MJ Scorer',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${notoSansJP.variable} font-sans antialiased bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-dvh safe-area-px`}
      >
        <ThemeProviders>
          <I18nProvider>
            <SyncProvider>
              <TopBar />
              <SwipeNavigation />
              {children}
            </SyncProvider>
          </I18nProvider>
        </ThemeProviders>
      </body>
    </html>
  );
}
