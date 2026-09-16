import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './types';
export { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './types';

const KEY = 'jumbleyard-language-v1';

export function loadLanguagePreference(): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_LANGUAGE;
    }
    const saved = localStorage.getItem(KEY);
    if (saved && typeof saved === 'string') {
      const match = SUPPORTED_LANGUAGES.find((l) => l.code === saved);
      if (match) return match.code;
    }
    return DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function saveLanguagePreference(lang: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(KEY, lang);
    }
  } catch {
    // Non-blocking if storage is restricted
  }
}

const subscribers = new Set<() => void>();
let current: string | null = null;

export function getLanguageSnapshot(): string {
  if (current === null) {
    current = loadLanguagePreference();
  }
  return current;
}

export function defaultLanguage(): string {
  return DEFAULT_LANGUAGE;
}

export function subscribeLanguage(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function setLanguage(lang: string) {
  current = lang;
  saveLanguagePreference(lang);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
  for (const sub of subscribers) {
    sub();
  }
}
