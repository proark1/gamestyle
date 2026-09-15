import BungeeDoublesGame from '@/games/bungee-doubles/Game';

export const metadata = {
  title: 'Bungee Doubles — Jumbleyard',
  description:
    'Two-on-two tennis and volleyball doubles with a hilarious twist: you and your partner are tied together with an elastic bungee cord! Coordinate, slingshot, and smash.',
};

export default function Page() {
  return <BungeeDoublesGame />;
}
