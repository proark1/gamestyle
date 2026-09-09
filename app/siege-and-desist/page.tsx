import SiegeAndDesist from '@/games/siege-and-desist/Game';
export const metadata = {
  title: 'Siege and Desist — Jumbleyard',
  description:
    'One trebuchet. Four opinions. Wind the counterweight, load the sling, and bring down the keep’s banner before dawn. A medieval co-op siege for one to four players.',
};
export default function Page() {
  return <SiegeAndDesist />;
}
