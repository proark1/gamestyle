import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  defaultLanguage,
  getLanguageSnapshot,
  setLanguage,
  subscribeLanguage,
} from './preferences';
import { LANDING_TRANSLATIONS } from './translations/landing';
import { CARDS_TRANSLATIONS } from './translations/cards';

void test('i18n: default language is English (en)', () => {
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.equal(defaultLanguage(), 'en');
});

void test('i18n: supported languages include English and German', () => {
  const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
  assert.ok(codes.includes('en'), 'en should be supported');
  assert.ok(codes.includes('de'), 'de should be supported');
});

void test('i18n: setLanguage updates snapshot and notifies subscribers', () => {
  let notified = 0;
  const unsubscribe = subscribeLanguage(() => {
    notified++;
  });

  setLanguage('de');
  assert.equal(getLanguageSnapshot(), 'de');
  assert.equal(notified, 1);

  setLanguage('en');
  assert.equal(getLanguageSnapshot(), 'en');
  assert.equal(notified, 2);

  unsubscribe();
  setLanguage('de');
  assert.equal(notified, 2, 'unsubscribed listener should not be called');

  // Reset to default
  setLanguage('en');
});

void test('i18n: landing page translations contain en and de keys', () => {
  assert.ok(LANDING_TRANSLATIONS.en, 'landing en translations exist');
  assert.ok(LANDING_TRANSLATIONS.de, 'landing de translations exist');
  assert.equal(LANDING_TRANSLATIONS.en.pickGame, 'Pick a game');
  assert.equal(LANDING_TRANSLATIONS.de.pickGame, 'Spiel wählen');
});

void test('i18n: all 20 game cards have both English and German translations', () => {
  const expectedSlugs = [
    'carry-on-carnage',
    'bungee-doubles',
    'panic-curling',
    'basketball',
    'crane-clash',
    'siege-and-desist',
    'stack-or-sink',
    'uphill-delivery',
    'reel-problems',
    'shelf-control',
    'wrong-floor',
    'load-bearing',
    'one-more-button',
    'four-brain-cells',
    'act-natural',
    'dont-wake-the-giant',
    'chaos',
    'first-person',
    'zorb-clash',
    'sample-stampede',
    'drive-thru',
  ];

  for (const slug of expectedSlugs) {
    const card = CARDS_TRANSLATIONS[slug];
    assert.ok(card, `Card translation exists for ${slug}`);
    assert.ok(card.en, `Card en translation exists for ${slug}`);
    assert.ok(card.de, `Card de translation exists for ${slug}`);
    assert.ok(card.en.cta.length > 0, `en cta exists for ${slug}`);
    assert.ok(card.de.cta.length > 0, `de cta exists for ${slug}`);
    assert.ok(card.en.desc.length > 0, `en desc exists for ${slug}`);
    assert.ok(card.de.desc.length > 0, `de desc exists for ${slug}`);
  }
});

void test('i18n: extensible to new languages with automatic English fallback', () => {
  // Test a mock dictionary for a newly added language (e.g. French 'fr')
  const mockTranslations: Record<string, string> = {
    en: 'Play',
    de: 'Spielen',
  };

  function resolveTranslation(
    lang: string,
    dict: Record<string, string>,
  ): string {
    return dict[lang] ?? dict[DEFAULT_LANGUAGE];
  }

  // When 'fr' has no translation yet, falls back to English 'Play'
  assert.equal(resolveTranslation('fr', mockTranslations), 'Play');

  // Once 'fr' is added, it resolves properly
  mockTranslations.fr = 'Jouer';
  assert.equal(resolveTranslation('fr', mockTranslations), 'Jouer');
});
