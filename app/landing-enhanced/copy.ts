import type { Localized } from '@/shared/language/types';

export interface EnhancedLandingCopy {
  journey: string;
  welcome: string;
  adventure: string;
  party: string;
  games: string;
  trailerKicker: string;
  enter: string;
  skip: string;
  progress: string;
}

export const ENHANCED_LANDING_COPY: Localized<EnhancedLandingCopy> = {
  en: {
    journey: 'Around the yard',
    welcome: 'Welcome',
    adventure: 'Next adventure',
    party: 'Party mode',
    games: 'Game shelf',
    trailerKicker: 'The yard is waking up',
    enter: 'Enter the yard',
    skip: 'Skip the intro',
    progress: 'Arrival progress',
  },
  de: {
    journey: 'Durch die Spielwiese',
    welcome: 'Willkommen',
    adventure: 'Nächstes Abenteuer',
    party: 'Party-Modus',
    games: 'Spieleregal',
    trailerKicker: 'Die Spielwiese erwacht',
    enter: 'Spielwiese betreten',
    skip: 'Intro überspringen',
    progress: 'Ankunftsfortschritt',
  },
};
