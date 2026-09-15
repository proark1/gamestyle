import PanicCurlingGame from '@/games/panic-curling/Game';

export const metadata = {
  title: 'Panic Curling — Jumbleyard',
  description:
    'Olympic curling turned into extreme ice and sweeper chaos! Deliver granite blocks, anvils, or teammates in laundry baskets while your crew frantically scrubs thin ice with brooms and blowtorches.',
};

export default function Page() {
  return <PanicCurlingGame />;
}
