'use client';

/* eslint-disable next/no-html-link-for-pages, next/no-img-element */
import {
  ArrowDown,
  ArrowUpRight,
  Castle,
  Gamepad2,
  Users,
  Waves,
  Eye,
  Timer,
  Mountain,
  Moon,
  HardHat,
  Blocks,
  Fish,
  CircleDot,
  Bot,
  Shuffle,
  Hammer,
  Snowflake,
  Zap,
  Luggage,
  Utensils,
  Building2,
  Link2,
} from 'lucide-react';
import type { ElementType, ReactElement } from 'react';
import AccountButton from '@/shared/accounts/AccountButton';
import WardrobeButton from '@/shared/wardrobe/WardrobeButton';
import LanguageSwitcher from '@/shared/language/LanguageSwitcher';
import { useLanguage } from '@/shared/language/useLanguage';
import { LANDING_TRANSLATIONS } from '@/shared/language/translations/landing';
import {
  CARDS_TRANSLATIONS,
  type CardTranslation,
} from '@/shared/language/translations/cards';
import './collection.css';
import {
  ClubhouseWelcome,
  ClubhouseParty,
} from '@/shared/clubhouse/ClubhouseWelcome';
import { CastGuide } from '@/shared/clubhouse/Cast';
import { CLUBHOUSE_COPY } from '@/shared/clubhouse/copy';
import { AdventureDesk } from '@/shared/clubhouse/AdventureDesk';

interface CardStaticConfig {
  slug: string;
  href: string;
  cardClass: string;
  artClass?: string;
  imgSrc: string;
  imgAlt: string;
  fetchPriority?: 'high' | 'low' | 'auto';
  loading?: 'lazy' | 'eager';
  tagIcon: ElementType;
  metaIcon1: ElementType;
  metaIcon2?: ElementType;
}

const CARD_CONFIGS: Record<string, CardStaticConfig> = {
  'cage-clash': {
    slug: 'cage-clash',
    href: '/cage-clash',
    cardClass: 'bungee-doubles-card',
    imgSrc: '/images/cage-clash.svg',
    imgAlt: 'Two martial artists face off inside a clay green octagonal cage.',
    loading: 'lazy',
    tagIcon: Gamepad2,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'on-the-ropes': {
    slug: 'on-the-ropes',
    href: '/on-the-ropes',
    cardClass: 'bungee-doubles-card',
    imgSrc: '/images/on-the-ropes.png',
    imgAlt:
      'Red and blue boxers face off in a soft clay boxing ring with teammates waiting at their corners.',
    loading: 'lazy',
    tagIcon: Gamepad2,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'carry-on-carnage': {
    slug: 'carry-on-carnage',
    href: '/carry-on-carnage',
    cardClass: 'carry-on-carnage-card',
    imgSrc: '/images/court-cast-v1/carry-on-carnage.jpg',
    imgAlt:
      'Four clay travelers squash an overstuffed suitcase beside an airport luggage sizer as toys pop out.',
    loading: 'lazy',
    tagIcon: Luggage,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'bungee-doubles': {
    slug: 'bungee-doubles',
    href: '/bungee-doubles',
    cardClass: 'bungee-doubles-card',
    imgSrc: '/images/court-cast-v1/bungee-doubles.jpg',
    imgAlt:
      'Four clay players compete at padel, with the red pair linked by a stretching bungee cord.',
    loading: 'lazy',
    tagIcon: Gamepad2,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'panic-curling': {
    slug: 'panic-curling',
    href: '/panic-curling',
    cardClass: 'panic-curling-card',
    imgSrc: '/images/court-cast-v1/panic-curling.jpg',
    imgAlt:
      'Four clay friends sweep a curling rink as a teammate rides a laundry basket toward the target.',
    loading: 'lazy',
    tagIcon: Snowflake,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  basketball: {
    slug: 'basketball',
    href: '/basketball',
    cardClass: 'basketball-card',
    imgSrc: '/images/court-cast-v1/court-clash.jpg',
    imgAlt:
      'Four clay basketball players in red and blue jerseys jump and reach for a dunk on an outdoor court.',
    loading: 'lazy',
    tagIcon: Gamepad2,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'crane-clash': {
    slug: 'crane-clash',
    href: '/crane-clash',
    cardClass: 'crane-clash-card',
    imgSrc: '/images/court-cast-v1/crane-clash.jpg',
    imgAlt:
      'Four clay workers use red and blue cranes to stack crates into competing towers.',
    loading: 'lazy',
    tagIcon: HardHat,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'siege-and-desist': {
    slug: 'siege-and-desist',
    href: '/siege-and-desist',
    cardClass: 'siege-card',
    imgSrc: '/images/court-cast-v1/siege-and-desist.jpg',
    imgAlt:
      'Four clay medieval crew members struggle with a trebuchet beside a distant sandstone castle.',
    loading: 'lazy',
    tagIcon: Castle,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'stack-or-sink': {
    slug: 'stack-or-sink',
    href: '/stack-or-sink',
    cardClass: 'stack-card',
    imgSrc: '/images/court-cast-v1/stack-or-sink.jpg',
    imgAlt:
      'Four clay friends stack furniture and crates above rising turquoise floodwater.',
    fetchPriority: 'high',
    tagIcon: Waves,
    metaIcon1: Users,
  },
  'uphill-delivery': {
    slug: 'uphill-delivery',
    href: '/uphill-delivery',
    cardClass: 'delivery-card',
    imgSrc: '/images/court-cast-v1/uphill-delivery.jpg',
    imgAlt:
      'Four clay friends in work overalls carry a yellow sofa up village steps beside a goat and rope bridge.',
    fetchPriority: 'high',
    tagIcon: Mountain,
    metaIcon1: Users,
  },
  'reel-problems-2': {
    slug: 'reel-problems-2',
    href: '/reel-problems-2',
    cardClass: 'reel-card',
    imgSrc: '/images/court-cast-v1/reel-problems.jpg',
    imgAlt:
      'Four clay friends in life jackets reel in an enormous fish from a rocking orange boat.',
    fetchPriority: 'high',
    tagIcon: Fish,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'reel-problems': {
    slug: 'reel-problems',
    href: '/reel-problems',
    cardClass: 'reel-card',
    imgSrc: '/images/court-cast-v1/reel-problems.jpg',
    imgAlt:
      'Four clay friends in life jackets reel in an enormous fish from a rocking orange boat.',
    fetchPriority: 'high',
    tagIcon: Fish,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'shelf-control': {
    slug: 'shelf-control',
    href: '/shelf-control',
    cardClass: 'shelf-control-card',
    imgSrc: '/images/court-cast-v1/shelf-control.jpg',
    imgAlt:
      'Four familiar clay-faced display mannequins sneak a ladder through a furniture showroom behind a guard.',
    loading: 'lazy',
    tagIcon: Eye,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'wrong-floor': {
    slug: 'wrong-floor',
    href: '/wrong-floor',
    cardClass: 'hotel-card',
    imgSrc: '/images/court-cast-v1/wrong-floor.jpg',
    imgAlt:
      'Four clay hotel guests approach an elevator while one spots a shadow down the corridor.',
    loading: 'lazy',
    tagIcon: Eye,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'load-bearing': {
    slug: 'load-bearing',
    href: '/load-bearing',
    cardClass: 'wreck-card',
    artClass: 'wreck-art',
    imgSrc: '/images/court-cast-v1/load-bearing.jpg',
    imgAlt:
      'Four clay workers protect an upright piano as a wrecking ball breaks a house wall.',
    loading: 'lazy',
    tagIcon: Hammer,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'one-more-button': {
    slug: 'one-more-button',
    href: '/one-more-button',
    cardClass: 'button-card',
    imgSrc: '/images/court-cast-v1/one-more-button.jpg',
    imgAlt:
      'One clay contestant presses a red button, launching a boxing glove toward three surprised friends.',
    loading: 'lazy',
    tagIcon: CircleDot,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'four-brain-cells': {
    slug: 'four-brain-cells',
    href: '/four-brain-cells',
    cardClass: 'brain-card',
    imgSrc: '/images/court-cast-v1/four-brain-cells.jpg',
    imgAlt:
      'Four clay friends pilot a clumsy robot that pours coffee, flips pancakes and kicks the breakfast table.',
    loading: 'lazy',
    tagIcon: Bot,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'act-natural': {
    slug: 'act-natural',
    href: '/act-natural',
    cardClass: 'cow-card',
    imgSrc: '/images/court-cast-v1/blend-business.jpg',
    imgAlt:
      'Four clay friends in cow disguises sneak a ladder toward a pasture gate behind a distracted farmer.',
    loading: 'lazy',
    tagIcon: Moon,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'dont-wake-the-giant': {
    slug: 'dont-wake-the-giant',
    href: '/dont-wake-the-giant',
    cardClass: 'giant-card',
    imgSrc: '/images/court-cast-v1/tiptoe-thieves.jpg',
    imgAlt:
      'Four tiny clay adventurers steal a golden necklace from a sleeping giant in a cozy cottage.',
    loading: 'lazy',
    tagIcon: Moon,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  chaos: {
    slug: 'chaos',
    href: '/chaos',
    cardClass: 'handwerker-card',
    imgSrc: '/images/court-cast-v1/permit-pending.jpg',
    imgAlt:
      'Four clay builders carry a sofa and guide a crane lifting a bathtub onto a half-built house.',
    loading: 'lazy',
    tagIcon: HardHat,
    metaIcon1: Users,
  },
  'first-person': {
    slug: 'first-person',
    href: '/first-person',
    cardClass: 'first-person-card',
    imgSrc: '/images/court-cast-v1/brick-by-hand.jpg',
    imgAlt:
      'Clay hands lay a brick with a trowel while three familiar friends work beyond the wall.',
    loading: 'lazy',
    tagIcon: Blocks,
    metaIcon1: Users,
  },
  'zorb-clash': {
    slug: 'zorb-clash',
    href: '/zorb-clash',
    cardClass: 'zorb-clash-card',
    imgSrc: '/images/court-cast-v1/zorb-clash.jpg',
    imgAlt:
      'Four clay players in clear zorb bubbles collide and tumble around a soccer ball.',
    loading: 'lazy',
    tagIcon: Zap,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'sample-stampede': {
    slug: 'sample-stampede',
    href: '/sample-stampede',
    cardClass: 'sample-stampede-card',
    imgSrc: '/images/court-cast-v1/sample-stampede.jpg',
    imgAlt:
      'Four clay friends race two loaded shopping carts toward a tray of supermarket samples.',
    loading: 'lazy',
    tagIcon: Gamepad2,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'drive-thru': {
    slug: 'drive-thru',
    href: '/drive-thru',
    cardClass: 'drive-thru-card',
    imgSrc: '/images/court-cast-v1/drive-thru.jpg',
    imgAlt:
      'Three clay travelers reach from a car for a wobbling burger tray served by their friend at a drive-thru.',
    loading: 'lazy',
    tagIcon: Utensils,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'chain-of-fools': {
    slug: 'chain-of-fools',
    href: '/chain-of-fools',
    cardClass: 'chain-of-fools-card',
    imgSrc: '/images/court-cast-v1/chain-of-fools.jpg',
    imgAlt:
      'Four clay demolition workers linked by a chain haul a dangling teammate onto a girder.',
    loading: 'lazy',
    tagIcon: Link2,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'scaffold-scramble': {
    slug: 'scaffold-scramble',
    href: '/scaffold-scramble',
    cardClass: 'scaffold-scramble-card',
    imgSrc: '/images/court-cast-v1/scaffold-scramble.jpg',
    imgAlt:
      'Four clay window cleaners cling to a tilted suspended scaffold as a bucket spills soapy water.',
    loading: 'lazy',
    tagIcon: Building2,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
};

function LocalizedGameCard({
  config,
  translation,
}: {
  config: CardStaticConfig;
  translation: CardTranslation;
}): ReactElement {
  const TagIcon = config.tagIcon;
  const MetaIcon1 = config.metaIcon1;
  const MetaIcon2 = config.metaIcon2;

  return (
    <a
      key={config.slug}
      className={`game-card ${config.cardClass}`}
      href={config.href}
    >
      <div className={`game-card-art ${config.artClass ?? ''}`}>
        <img
          src={config.imgSrc}
          alt={config.imgAlt}
          width="1536"
          height="1024"
          loading={config.loading}
          fetchPriority={config.fetchPriority}
        />
        <span className="game-card-tag">
          <TagIcon size={14} /> {translation.tag}
        </span>
        {translation.isNew && (
          <span className="new-game-tag">
            {translation.newTag ?? 'NEW TO JUMBLEYARD'}
          </span>
        )}
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <MetaIcon1 size={14} /> {translation.players}
          </span>
          <span>
            {MetaIcon2 && <MetaIcon2 size={14} />} {translation.duration}
          </span>
        </div>
        <h2>
          {translation.titleMain}
          {translation.titleHighlight && (
            <span>{translation.titleHighlight}</span>
          )}
          {translation.titleSuffix}
          <span className="game-title-dot">.</span>
        </h2>
        <p>{translation.desc}</p>
        <div className="game-card-bottom">
          <span>{translation.tagline}</span>
          <strong>
            {translation.cta} <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  );
}

export default function CollectionClient({ order }: { order: string[] }) {
  const { t } = useLanguage();
  const strings = t(LANDING_TRANSLATIONS);
  const clubhouse = t(CLUBHOUSE_COPY);
  const adventures = order.flatMap((slug) => {
    const config = CARD_CONFIGS[slug];
    const dictionary = CARDS_TRANSLATIONS[slug];
    if (!config || !dictionary) return [];
    const copy = t(dictionary);
    return [
      {
        slug,
        href: config.href,
        image: config.imgSrc,
        title:
          `${copy.titleMain}${copy.titleHighlight ?? ''}${copy.titleSuffix ?? ''}`.replace(
            /\.$/,
            '',
          ),
        players: copy.players,
        cta: copy.cta,
      },
    ];
  });

  return (
    <main className="collection">
      <header className="collection-header">
        <a className="collection-brand" href="/">
          <span>
            <Gamepad2 size={24} />
          </span>
          JUMBLEYARD<span className="brand-period">.</span>
        </a>
        <span className="collection-header-note">{strings.headerNote}</span>
        <div className="collection-header-actions">
          <a className="collection-nav" href="#games">
            {strings.pickGame} <ArrowDown size={15} />
          </a>
          <LanguageSwitcher variant="header" />
          <WardrobeButton variant="header" />
          <AccountButton variant="header" />
        </div>
      </header>

      <ClubhouseWelcome count={order.length} />
      <AdventureDesk games={adventures} />
      <ClubhouseParty />

      <div className="clubhouse-shelf-heading" id="games">
        <div>
          <h2>{clubhouse.shelf}</h2>
          <p>
            <Shuffle size={13} /> {strings.shelfLeadSubtitle}
          </p>
        </div>
        <CastGuide message="shelfHint" />
      </div>

      <section className="game-shelf" aria-label={clubhouse.pick}>
        {order.map((slug) => {
          const config = CARD_CONFIGS[slug];
          const cardTransDict = CARDS_TRANSLATIONS[slug];
          if (!config || !cardTransDict) return null;
          const translation = t(cardTransDict);
          return (
            <LocalizedGameCard
              key={slug}
              config={config}
              translation={translation}
            />
          );
        })}
      </section>

      <footer className="collection-footer">
        <span>
          <Gamepad2 size={17} /> {strings.footerNote}
        </span>
        <span>{strings.footerGuarantee}</span>
      </footer>
    </main>
  );
}
