/**
 * I18nProvider + useTranslation
 * ──────────────────────────────────────────────────────────────────────────
 *   <I18nProvider><App /></I18nProvider>
 *
 *   // Anywhere:
 *   const { t, lang, setLang } = useTranslation();
 *   t('cart.title')                 → "Your Cart" / "आपकी कार्ट"
 *   t('greeting.hi', { name: 'X' }) → interpolation
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { resolve } from './translations';

const STORAGE_KEY = 'quickkart.lang';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'hi') return saved;
    } catch {}
    // Auto-detect from browser
    const browser = (navigator?.language ?? 'en').slice(0, 2);
    return browser === 'hi' ? 'hi' : 'en';
  });

  const setLang = useCallback((next) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key, vars) => resolve(lang, key, vars), [lang]);

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation() must be used inside <I18nProvider>');
  return ctx;
}
