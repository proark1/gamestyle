import ChainOfFoolsGame from '@/games/chain-of-fools/Game';

export const metadata = {
  title: 'Chain of Fools — Jumbleyard',
  description:
    'Four workers on one safety line across a half-demolished site. When one goes over, the rest are holding them — or following them.',
};

export default function Page() {
  return <ChainOfFoolsGame />;
}
