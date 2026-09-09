import ShelfControl from '@/games/shelf-control/Game';
export const metadata = {
  title: 'Shelf Control — Jumbleyard',
  description:
    'One to four friends and invited NPCs, one night guard, three living mannequins. Blend into the displays, cut security and sneak out before opening time.',
};
export default function Page() {
  return <ShelfControl />;
}
