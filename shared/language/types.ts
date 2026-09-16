export type SupportedLanguage = 'en' | 'de' | (string & {});

export interface LanguageOption {
  code: string;
  label: string;
  shortLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', shortLabel: 'EN' },
  { code: 'de', label: 'Deutsch', shortLabel: 'DE' },
];

export const DEFAULT_LANGUAGE = 'en';

export type Localized<T> = {
  en: T;
  de?: T;
  [lang: string]: T | undefined;
};
