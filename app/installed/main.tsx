import { Component, Suspense, lazy, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import CollectionClient from '../../app/CollectionClient';
import NativeProvider from '../../shared/browser/NativeProvider';
import PartyRibbon from '../../shared/ui/PartyRibbon';
import AdventureTracker from '../../shared/clubhouse/AdventureTracker';
import { GAME_IDS, isGame } from '../../shared/games/identity';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '../../app/globals.css';
import '../../shared/styles/game-ui.css';
import '../../shared/styles/construction-theme.css';
const games = {
  'act-natural': lazy(() => import('../../games/act-natural/Game')),
  basketball: lazy(() => import('../../games/basketball/Game')),
  'bungee-doubles': lazy(() => import('../../games/bungee-doubles/Game')),
  'carry-on-carnage': lazy(() => import('../../games/carry-on-carnage/Game')),
  'chain-of-fools': lazy(() => import('../../games/chain-of-fools/Game')),
  chaos: lazy(() => import('../../games/chaos/Game')),
  'crane-clash': lazy(() => import('../../games/crane-clash/Game')),
  'dont-wake-the-giant': lazy(
    () => import('../../games/dont-wake-the-giant/Game'),
  ),
  'drive-thru': lazy(() => import('../../games/drive-thru/Game')),
  'first-person': lazy(() => import('../../games/first-person/Game')),
  'four-brain-cells': lazy(() => import('../../games/four-brain-cells/Game')),
  'load-bearing': lazy(() => import('../../games/load-bearing/Game')),
  'one-more-button': lazy(() => import('../../games/one-more-button/Game')),
  'panic-curling': lazy(() => import('../../games/panic-curling/Game')),
  'reel-problems-2': lazy(() => import('../../games/reel-problems-2/Game')),
  'reel-problems': lazy(() => import('../../games/reel-problems/Game')),
  'sample-stampede': lazy(() => import('../../games/sample-stampede/Game')),
  'scaffold-scramble': lazy(() => import('../../games/scaffold-scramble/Game')),
  'shelf-control': lazy(() => import('../../games/shelf-control/Game')),
  'siege-and-desist': lazy(() => import('../../games/siege-and-desist/Game')),
  'stack-or-sink': lazy(() => import('../../games/stack-or-sink/Game')),
  'uphill-delivery': lazy(() => import('../../games/uphill-delivery/Game')),
  'wrong-floor': lazy(() => import('../../games/wrong-floor/Game')),
  'zorb-clash': lazy(() => import('../../games/zorb-clash/Game')),
};
const Party = lazy(() => import('../../app/party/PartyClient'));
class Recovery extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main>
        <h1>The game could not start</h1>
        <p>Your installed games are available from the collection.</p>
        <a href="/">Return to collection</a>
      </main>
    ) : (
      this.props.children
    );
  }
}
const slug = location.pathname.split('/').filter(Boolean)[0] ?? '';
const query = new URLSearchParams(location.search);
if (!slug && query.has('room'))
  location.replace('/stack-or-sink' + location.search);
if (!slug && query.has('raum')) location.replace('/chaos' + location.search);
const Game = isGame(slug) ? games[slug] : null;
createRoot(document.getElementById('root')!).render(
  <Recovery>
    <NativeProvider />
    <AdventureTracker slugs={[...GAME_IDS]} />
    <PartyRibbon />
    <Suspense fallback={<output>Loading game…</output>}>
      {Game ? (
        slug === 'chaos' || slug === 'first-person' ? (
          <div className="handwerker">
            <Game />
          </div>
        ) : (
          <Game />
        )
      ) : slug === 'party' ? (
        <Party initialCode={query.get('room') ?? undefined} />
      ) : (
        <CollectionClient order={[...GAME_IDS]} />
      )}
    </Suspense>
  </Recovery>,
);
