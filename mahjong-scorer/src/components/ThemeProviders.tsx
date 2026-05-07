'use client';

import { ThemeProvider } from 'next-themes';
import { Capacitor } from '@capacitor/core';

export default function ThemeProviders({ children }: { children: React.ReactNode }) {
  const isNative = Capacitor.isNativePlatform();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={isNative ? 'dark' : 'system'}
      enableSystem={!isNative}
    >
      {children}
    </ThemeProvider>
  );
}
