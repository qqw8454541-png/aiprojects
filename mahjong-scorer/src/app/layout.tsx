import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import I18nProvider from '@/components/I18nProvider';
import ThemeProviders from '@/components/ThemeProviders';
import TopBar from '@/components/TopBar';
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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${notoSansJP.variable} font-sans antialiased bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-dvh`}
      >
        <ThemeProviders>
          <I18nProvider>
            <SyncProvider>
              <TopBar />
              {children}
            </SyncProvider>
          </I18nProvider>
        </ThemeProviders>
      </body>
    </html>
  );
}
