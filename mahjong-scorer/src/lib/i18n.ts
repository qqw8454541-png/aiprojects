'use client';

import { createContext, useContext } from 'react';
import { translations, type TranslationKey } from './translations';

export type Locale = 'ja' | 'zh' | 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  ja: '日本語',
  zh: '简体中文',
  en: 'English',
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

export const I18nContext = createContext<I18nContextValue>({
  locale: 'ja',
  setLocale: () => {},
  t: (key) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

export function translate(locale: Locale, key: TranslationKey): string {
  return translations[locale]?.[key] ?? translations['ja'][key] ?? key;
}

export function getSavedLocale(): Locale {
  if (typeof window === 'undefined') return 'ja';
  
  // 1. User manual selection from localStorage
  const saved = localStorage.getItem('mahjong-locale');
  if (saved && (saved === 'ja' || saved === 'zh' || saved === 'en')) {
    return saved as Locale;
  }
  
  // 2. Auto-detect browser language
  try {
    const navLang = navigator.language.toLowerCase();
    if (navLang.startsWith('zh')) return 'zh';
    if (navLang.startsWith('ja')) return 'ja';
    return 'en';
  } catch {
    return 'en'; // Safe fallback
  }
}

export function saveLocale(locale: Locale) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('mahjong-locale', locale);
  }
}
