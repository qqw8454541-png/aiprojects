'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { I18nContext, type Locale, getSavedLocale, saveLocale, translate } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/translations';

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ja');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(getSavedLocale());
    setMounted(true);
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    saveLocale(l);
  }

  function t(key: TranslationKey): string {
    return translate(locale, key);
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <I18nContext.Provider value={{ locale: 'ja', setLocale, t: (key) => translate('ja', key) }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
