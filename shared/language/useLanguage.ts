'use client';

import { useSyncExternalStore, useCallback } from 'react';
import {
  defaultLanguage,
  getLanguageSnapshot,
  setLanguage as setLangPref,
  subscribeLanguage,
} from './preferences';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type Localized } from './types';

export function useLanguage() {
  const language = useSyncExternalStore(
    subscribeLanguage,
    getLanguageSnapshot,
    defaultLanguage,
  );

  const changeLanguage = useCallback((newLang: string) => {
    setLangPref(newLang);
  }, []);

  const t = useCallback(
    <T>(dict: Localized<T>, langOverride?: string): T => {
      const active = langOverride ?? language;
      if (active in dict && dict[active] !== undefined) {
        return dict[active] as T;
      }
      return dict[DEFAULT_LANGUAGE];
    },
    [language],
  );

  return {
    language,
    setLanguage: changeLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    isDefault: language === DEFAULT_LANGUAGE,
    t,
  };
}
