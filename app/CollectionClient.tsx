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
  WifiOff,
  Snowflake,
  Zap,
  Luggage,
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
  'carry-on-carnage': {
    slug: 'carry-on-carnage',
    href: '/carry-on-carnage',
    cardClass: 'carry-on-carnage-card',
    imgSrc: '/images/carry-on-carnage.png',
    imgAlt:
      "Desperate travelers dogpiling to compress an overstuffed bulging suitcase before the gate agent's metal sizer box as a piñata burst launches rubber ducks and flamingos.",
    loading: 'lazy',
    tagIcon: Luggage,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'bungee-doubles': {
    slug: 'bungee-doubles',
    href: '/bungee-doubles',
    cardClass: 'bungee-doubles-card',
    imgSrc: '/images/bungee-doubles.png',
    imgAlt:
      'Two toy padel players in orange shirts tethered by an elastic bungee cord dive across the court for a smash off the back glass.',
    loading: 'lazy',
    tagIcon: Gamepad2,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'panic-curling': {
    slug: 'panic-curling',
    href: '/panic-curling',
    cardClass: 'panic-curling-card',
    imgSrc: '/images/panic-curling.png',
    imgAlt:
      'Toy curling players in orange and blue sweep ice furiously while a teammate in a laundry basket slides toward the target ring.',
    loading: 'lazy',
    tagIcon: Snowflake,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  basketball: {
    slug: 'basketball',
    href: '/basketball',
    cardClass: 'basketball-card',
    imgSrc: '/images/court-clash.png',
    imgAlt:
      'Four toy basketball players in orange and teal jerseys compete on an outdoor court as one leaps toward the hoop for a slam dunk.',
    loading: 'lazy',
    tagIcon: Gamepad2,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'crane-clash': {
    slug: 'crane-clash',
    href: '/crane-clash',
    cardClass: 'crane-clash-card',
    imgSrc: '/images/crane-clash.png',
    imgAlt:
      'Workers swing from orange and teal crane cables carrying wooden crates toward two teetering towers while their teammates operate the cranes.',
    loading: 'lazy',
    tagIcon: HardHat,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'siege-and-desist': {
    slug: 'siege-and-desist',
    href: '/siege-and-desist',
    cardClass: 'siege-card',
    imgSrc: '/images/siege-and-desist.png',
    imgAlt:
      'Four tiny medieval crew members work one enormous wooden trebuchet on a golden hillside while a boulder sails toward a sandstone keep flying a red banner.',
    loading: 'lazy',
    tagIcon: Castle,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'stack-or-sink': {
    slug: 'stack-or-sink',
    href: '/stack-or-sink',
    cardClass: 'stack-card',
    imgSrc: '/images/stack-or-sink.png',
    imgAlt:
      'Hard-hatted friends stack crates and a sofa above a rising flood in a toy-like salvage yard.',
    fetchPriority: 'high',
    tagIcon: Waves,
    metaIcon1: Users,
  },
  'uphill-delivery': {
    slug: 'uphill-delivery',
    href: '/uphill-delivery',
    cardClass: 'delivery-card',
    imgSrc: '/images/uphill-delivery.png',
    imgAlt:
      'Four hard-hatted friends carry an enormous yellow sofa up a mountain village, past a rope bridge and a stubborn goat.',
    fetchPriority: 'high',
    tagIcon: Mountain,
    metaIcon1: Users,
  },
  'reel-problems': {
    slug: 'reel-problems',
    href: '/reel-problems',
    cardClass: 'reel-card',
    imgSrc: '/images/reel-problems.png',
    imgAlt:
      'Four friends in a tiny coral fishing boat are dragged across a lake by an enormous fish, with tangled lines and one friend overboard.',
    fetchPriority: 'high',
    tagIcon: Fish,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'shelf-control': {
    slug: 'shelf-control',
    href: '/shelf-control',
    cardClass: 'shelf-control-card',
    imgSrc: '/images/shelf-control.png?v=toy-style-2',
    imgAlt:
      'Wooden mannequins sneak a ladder past a distracted night guard in a furniture showroom.',
    loading: 'lazy',
    tagIcon: Eye,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'wrong-floor': {
    slug: 'wrong-floor',
    href: '/wrong-floor',
    cardClass: 'hotel-card',
    imgSrc: '/images/wrong-floor.png',
    imgAlt:
      'Four toy guests check out of a mysterious hotel. Only one sees the shadow sprinting toward their elevator.',
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
    imgSrc: '/images/load-bearing.png',
    imgAlt:
      'A wrecking ball demolishes a toy house while four workers try to protect an upright piano on the exposed upper floor.',
    loading: 'lazy',
    tagIcon: Hammer,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'one-more-button': {
    slug: 'one-more-button',
    href: '/one-more-button',
    cardClass: 'button-card',
    imgSrc: '/images/one-more-button.png',
    imgAlt:
      'A contestant presses a huge red button as a giant boxing glove launches three friends through a toy game-show room.',
    loading: 'lazy',
    tagIcon: CircleDot,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'four-brain-cells': {
    slug: 'four-brain-cells',
    href: '/four-brain-cells',
    cardClass: 'brain-card',
    imgSrc: '/images/four-brain-cells.png',
    imgAlt:
      'A clumsy toy robot with four colored limbs pours coffee, flips pancakes, and accidentally kicks the breakfast table.',
    loading: 'lazy',
    tagIcon: Bot,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'act-natural': {
    slug: 'act-natural',
    href: '/act-natural',
    cardClass: 'cow-card',
    imgSrc: '/images/blend-business.png',
    imgAlt:
      'A cow secretly drags a ladder behind a farmer while the rest of the herd grazes innocently.',
    loading: 'lazy',
    tagIcon: Moon,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'dont-wake-the-giant': {
    slug: 'dont-wake-the-giant',
    href: '/dont-wake-the-giant',
    cardClass: 'giant-card',
    imgSrc: '/images/dont-wake-the-giant.png',
    imgAlt:
      'Two tiny intruders try to sneak a golden harp across the arm of a sleeping giant while he turns in bed.',
    loading: 'lazy',
    tagIcon: Moon,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  chaos: {
    slug: 'chaos',
    href: '/chaos',
    cardClass: 'handwerker-card',
    imgSrc: '/images/chaos.png',
    imgAlt:
      'Four construction workers frantically try to assemble a house as materials fall and a bathtub sits on the roof.',
    loading: 'lazy',
    tagIcon: HardHat,
    metaIcon1: Users,
  },
  'first-person': {
    slug: 'first-person',
    href: '/first-person',
    cardClass: 'first-person-card',
    imgSrc: '/images/first-person.png',
    imgAlt:
      'A first-person view of laying red bricks with a trowel on a partially built house wall.',
    loading: 'lazy',
    tagIcon: Blocks,
    metaIcon1: Users,
  },
  'zorb-clash': {
    slug: 'zorb-clash',
    href: '/zorb-clash',
    cardClass: 'zorb-clash-card',
    imgSrc: '/images/zorb-clash.png',
    imgAlt:
      'Two inflatable zorb balls collide at midfield in an outdoor arena, launching one player spinning into the air.',
    loading: 'lazy',
    tagIcon: Zap,
    metaIcon1: Users,
    metaIcon2: Timer,
  },
  'sample-stampede': {
    slug: 'sample-stampede',
    href: '/sample-stampede',
    cardClass: 'sample-stampede-card',
    imgSrc: '/images/sample-stampede.png',
    imgAlt:
      'Four oversized shopping carts race through a warehouse store aisle, loaded with bags of pet food and toilet paper.',
    loading: 'lazy',
    tagIcon: Gamepad2,
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

      <section className="collection-intro">
        <div className="collection-kicker">
          <span className="live-dot" /> {strings.kicker}
        </div>
        <h1>
          {strings.heroTitleMain}
          <br />
          <span>{strings.heroTitleChaos}</span>
        </h1>
        <p>{strings.heroDesc}</p>
        <ul className="collection-stats">
          <li>
            <Gamepad2 size={14} />{' '}
            {strings.statGames.replace('{count}', String(order.length))}
          </li>
          <li>
            <Users size={14} /> {strings.statPlayers}
          </li>
          <li>
            <Timer size={14} /> {strings.statMinutes}
          </li>
          <li>
            <WifiOff size={14} /> {strings.statNoAccount}
          </li>
        </ul>
      </section>

      <div className="shelf-lead">
        <h2>{strings.shelfLeadTitle}</h2>
        <span>
          <Shuffle size={13} /> {strings.shelfLeadSubtitle}
        </span>
      </div>

      <section className="game-shelf" id="games" aria-label="Choose a game">
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
